//actionengine/geometry/glbloader.js

/**
 * GLBLoader handles loading and parsing of GLTF/GLB 3D model files.
 * Supports skeletal animations, mesh data, and materials.
 */
class GLBLoader {
    /**
     * Creates a new GLBLoader instance.
     * Initializes empty arrays for storing model data.
     */
    constructor() {
        this.nodes = [];
        this.nodeMap = {}; // Name -> index lookup
        this.meshes = [];
        this.skins = [];
        this.animations = [];
        this.triangles = [];
        this.textures = []; // Array of texture image data
        this.textureMetadata = []; // Array of texture metadata (name, width, height)
    }

    /**
     * Loads a 3D model from either base64 string or ArrayBuffer input.
     * @param {string|ArrayBuffer} input - The model data as either base64 string or ArrayBuffer
     * @returns {GLBLoader} A loader instance containing the parsed model
     * @throws {Error} If input format is not supported
     */
    static loadModel(input) {
        if (typeof input === "string") {
            return GLBLoader.loadFromBase64(input);
        } else if (input instanceof ArrayBuffer) {
            return GLBLoader.loadFromArrayBuffer(input);
        } else {
            throw new Error("Unsupported input format. Please provide a base64 string or ArrayBuffer.");
        }
    }

    /**
     * Loads a 3D model from a File object (from file input).
     * @param {File} file - File object from input element
     * @param {Function} [onProgress] - Optional callback for progress updates: (progress: number) => void (0-1)
     * @returns {Promise<GLBLoader|ActionModel3D>} A promise resolving to a loader instance containing the parsed model
     * @throws {Error} If the file cannot be read or parsed
     */
    static async loadFromFile(file, onProgress = null) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onprogress = (e) => {
                if (onProgress && e.lengthComputable) {
                    onProgress(e.loaded / e.total * 0.3); // 0-30% for file reading
                }
            };
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    // Parse with progress callback (30-100% for parsing), async with yielding
                    const model = await GLBLoader.loadFromArrayBufferAsync(arrayBuffer, onProgress);
                    resolve(model);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => {
                reject(new Error(`Failed to read file: ${file.name}`));
            };
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Yield to browser to allow UI updates
     * @private
     */
    static async yield() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    /**
     * Construct ActionModel3D from parsed worker data
     * Worker sends back gltf + binaryData, this constructs the full model
     * @param {Object} parsedData - { gltf, binaryData, textures, textureMetadata }
     * @returns {ActionModel3D}
     * @static
     */
    static constructFromParsedData(parsedData) {
        const { gltf, binaryData, textures, textureMetadata } = parsedData;
        const loader = new GLBLoader();
        const model = new ActionModel3D();

        // First create all nodes
        if (gltf.nodes && gltf.nodes.length > 0) {
            loader.nodes = gltf.nodes.map((node, i) => new Node(node, i));
            model.nodes = loader.nodes;

            // Then hook up node hierarchy
            for (let i = 0; i < gltf.nodes.length; i++) {
                const nodeData = gltf.nodes[i];
                if (nodeData.children) {
                    const childRefs = [];
                    for (const childIndex of nodeData.children) {
                        if (childIndex >= 0 && childIndex < loader.nodes.length) {
                            childRefs.push(loader.nodes[childIndex]);
                        }
                    }
                    loader.nodes[i].children = childRefs;
                }
                loader.nodeMap[loader.nodes[i].name] = i;
            }
            model.nodeMap = loader.nodeMap;

            // Identify root nodes
            const childSet = new Set();
            for (const node of loader.nodes) {
                for (const child of node.children) {
                    childSet.add(child);
                }
            }
            for (const node of loader.nodes) {
                if (!childSet.has(node)) {
                    const nodeIdx = loader.nodes.indexOf(node);
                    model.rootNodes.push(nodeIdx);
                    node.updateWorldMatrix();
                }
            }
        }

        // Create skins after nodes exist
        if (gltf.skins) {
            loader.skins = gltf.skins.map((skin, i) => new Skin(gltf, skin, i));
            model.skins = loader.skins;

            for (const node of loader.nodes) {
                if (node.skin !== null) {
                    node.skin = loader.skins[node.skin];
                }
            }
        }

        // Load meshes and create RenderableObjects
        GLBLoader.loadMeshesWithObjects(model, loader, gltf, binaryData);

        // Load animations
        if (gltf.animations) {
            loader.animations = gltf.animations.map((anim) => new Animation(gltf, anim));
            model.animations = loader.animations;
        }

        // Store textures in model
        model.textures = textures;
        model.textureMetadata = textureMetadata;

        // For backward compatibility
        loader.triangles = model.getAllTriangles();

        return model;
    }

    /**
     * Loads a 3D model from a base64 encoded string.
     * @param {string} base64String - The model data encoded as base64
     * @returns {GLBLoader} A loader instance containing the parsed model
     * @private
     */
    static loadFromBase64(base64String) {
        const binaryString = atob(base64String);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return GLBLoader.loadFromArrayBuffer(bytes.buffer);
    }

    /**
     * Async version that yields to browser between major work chunks
     * @param {ArrayBuffer} arrayBuffer - The GLB file data
     * @param {Function} [onProgress] - Optional callback for progress updates
     * @returns {Promise<ActionModel3D>}
     * @private
     */
    static async loadFromArrayBufferAsync(arrayBuffer, onProgress = null) {
        const loader = new GLBLoader();
        const { gltf, binaryData } = GLBLoader.parseGLB(arrayBuffer);
        gltf.binaryData = binaryData;
        if (onProgress) onProgress(0.05);
        await GLBLoader.yield();

        // Extract textures from the model
        GLBLoader.loadTextures(loader, gltf, binaryData);
        if (onProgress) onProgress(0.1);
        await GLBLoader.yield();

        // Create ActionModel3D to hold the structured data
        const model = new ActionModel3D();

        // First create all nodes
        if (gltf.nodes && gltf.nodes.length > 0) {
            loader.nodes = gltf.nodes.map((node, i) => new Node(node, i));
            model.nodes = loader.nodes;

            // Then hook up node hierarchy
            for (let i = 0; i < gltf.nodes.length; i++) {
                const nodeData = gltf.nodes[i];
                if (nodeData.children) {
                    // Convert child indices to actual node references
                    const childRefs = [];
                    for (const childIndex of nodeData.children) {
                        if (childIndex >= 0 && childIndex < loader.nodes.length) {
                            childRefs.push(loader.nodes[childIndex]);
                        }
                    }
                    loader.nodes[i].children = childRefs;
                }
                // Build node lookup map
                loader.nodeMap[loader.nodes[i].name] = i;
            }
            model.nodeMap = loader.nodeMap;

            // Identify root nodes (nodes that are not children of any other node)
            const childSet = new Set();
            for (const node of loader.nodes) {
                for (const child of node.children) {
                    childSet.add(child);
                }
            }
            for (const node of loader.nodes) {
                if (!childSet.has(node)) {
                    const nodeIdx = loader.nodes.indexOf(node);
                    model.rootNodes.push(nodeIdx);
                    node.updateWorldMatrix();
                }
            }
        }
        if (onProgress) onProgress(0.25);
        await GLBLoader.yield();

        // Create skins after nodes exist
        if (gltf.skins) {
            loader.skins = gltf.skins.map((skin, i) => new Skin(gltf, skin, i));
            model.skins = loader.skins;

            // Hook up skin references in nodes
            for (const node of loader.nodes) {
                if (node.skin !== null) {
                    node.skin = loader.skins[node.skin];
                }
            }
        }
        if (onProgress) onProgress(0.4);
        await GLBLoader.yield();

        // Load meshes and create RenderableObjects
        GLBLoader.loadMeshesWithObjects(model, loader, gltf, binaryData);
        if (onProgress) onProgress(0.7);
        await GLBLoader.yield();

        // Finally load animations after everything else is set up
        if (gltf.animations) {
            loader.animations = gltf.animations.map((anim) => new Animation(gltf, anim));
            model.animations = loader.animations;
        }

        // Store textures in model
        model.textures = loader.textures;
        model.textureMetadata = loader.textureMetadata;

        // For backward compatibility, also populate loader.triangles with all triangles
        loader.triangles = model.getAllTriangles();
        if (onProgress) onProgress(1.0);
        await GLBLoader.yield();

        // Return ActionModel3D as the primary structure
        return model;
    }

    /**
     * Loads a 3D model from an ArrayBuffer containing GLB data.
     * Handles the complete loading process including node hierarchy,
     * skins, meshes, and animations.
     * Returns both GLBLoader (for backward compat) and ActionModel3D (new structure).
     * @param {ArrayBuffer} arrayBuffer - The GLB file data
     * @param {Function} [onProgress] - Optional callback for progress updates: (progress: number) => void (0-1)
     * @returns {GLBLoader|ActionModel3D} A loader instance containing the parsed model
     * @private
     */
    static loadFromArrayBuffer(arrayBuffer, onProgress = null) {
        const loader = new GLBLoader();
        const { gltf, binaryData } = GLBLoader.parseGLB(arrayBuffer);
        gltf.binaryData = binaryData;
        if (onProgress) onProgress(0.5);

        // Extract textures from the model
        GLBLoader.loadTextures(loader, gltf, binaryData);
        if (onProgress) onProgress(0.6);

        // Create ActionModel3D to hold the structured data
        const model = new ActionModel3D();

        // First create all nodes
        if (gltf.nodes && gltf.nodes.length > 0) {
            loader.nodes = gltf.nodes.map((node, i) => new Node(node, i));
            model.nodes = loader.nodes;

            // Then hook up node hierarchy
            for (let i = 0; i < gltf.nodes.length; i++) {
                const nodeData = gltf.nodes[i];
                if (nodeData.children) {
                    // Convert child indices to actual node references
                    const childRefs = [];
                    for (const childIndex of nodeData.children) {
                        if (childIndex >= 0 && childIndex < loader.nodes.length) {
                            childRefs.push(loader.nodes[childIndex]);
                        }
                    }
                    loader.nodes[i].children = childRefs;
                }
                // Build node lookup map
                loader.nodeMap[loader.nodes[i].name] = i;
            }
            model.nodeMap = loader.nodeMap;

            // Identify root nodes (nodes that are not children of any other node)
            const childSet = new Set();
            for (const node of loader.nodes) {
                for (const child of node.children) {
                    childSet.add(child);
                }
            }
            for (const node of loader.nodes) {
                if (!childSet.has(node)) {
                    const nodeIdx = loader.nodes.indexOf(node);
                    model.rootNodes.push(nodeIdx);
                    node.updateWorldMatrix();
                }
            }
        }
        if (onProgress) onProgress(0.7);

        // Create skins after nodes exist
        if (gltf.skins) {
            loader.skins = gltf.skins.map((skin, i) => new Skin(gltf, skin, i));
            model.skins = loader.skins;

            // Hook up skin references in nodes
            for (const node of loader.nodes) {
                if (node.skin !== null) {
                    node.skin = loader.skins[node.skin];
                }
            }
        }
        if (onProgress) onProgress(0.8);

        // Load meshes and create RenderableObjects
        GLBLoader.loadMeshesWithObjects(model, loader, gltf, binaryData);
        if (onProgress) onProgress(0.9);

        // Finally load animations after everything else is set up
        if (gltf.animations) {
            loader.animations = gltf.animations.map((anim) => new Animation(gltf, anim));
            model.animations = loader.animations;
        }

        // Store textures in model
        model.textures = loader.textures;
        model.textureMetadata = loader.textureMetadata;

        // For backward compatibility, also populate loader.triangles with all triangles
        loader.triangles = model.getAllTriangles();
        if (onProgress) onProgress(1.0);

        // Return ActionModel3D as the primary structure
        return model;
    }

    /**
     * Parses a GLB format binary buffer into JSON and binary data chunks.
     * @param {ArrayBuffer} arrayBuffer - The GLB file data
     * @returns {{gltf: Object, binaryData: ArrayBuffer}} Parsed GLB containing JSON and binary chunks
     * @throws {Error} If GLB file format is invalid
     * @private
     */
    static parseGLB(arrayBuffer) {
        const dataView = new DataView(arrayBuffer);
        const magic = dataView.getUint32(0, true);
        if (magic !== 0x46546c67) {
            throw new Error("Invalid GLB file");
        }

        const jsonLength = dataView.getUint32(12, true);
        const jsonText = new TextDecoder().decode(new Uint8Array(arrayBuffer, 20, jsonLength));
        const json = JSON.parse(jsonText);
        const binaryData = arrayBuffer.slice(20 + jsonLength + 8);

        return { gltf: json, binaryData };
    }

    /**
     * Loads and processes textures from the GLTF model.
     * Extracts image data and stores it for later use by the TextureManager.
     * @param {GLBLoader} model - The loader instance to store texture data
     * @param {Object} gltf - The parsed GLTF JSON data
     * @param {ArrayBuffer} binaryData - The binary buffer containing texture data
     * @private
     */
    static loadTextures(model, gltf, binaryData) {
        if (!gltf.images) return;

        for (let i = 0; i < gltf.images.length; i++) {
            const imageData = gltf.images[i];
            let textureData = null;

            // Handle URI-based images (data URIs or file paths)
            if (imageData.uri) {
                if (imageData.uri.startsWith("data:")) {
                    // Data URI embedded in JSON
                    const base64Data = imageData.uri.split(",")[1];
                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let j = 0; j < binaryString.length; j++) {
                        bytes[j] = binaryString.charCodeAt(j);
                    }
                    textureData = bytes;
                }
            }
            // Handle buffer view-based images (binary data in GLB)
            else if (imageData.bufferView !== undefined) {
                const bufferView = gltf.bufferViews[imageData.bufferView];
                const byteOffset = bufferView.byteOffset || 0;
                const byteLength = bufferView.byteLength;
                textureData = new Uint8Array(binaryData, byteOffset, byteLength);
            }

            if (textureData) {
                model.textures.push(textureData);
                model.textureMetadata.push({
                    name: imageData.name || `texture_${i}`,
                    mimeType: imageData.mimeType || "image/png"
                });
            }
        }
    }

    /**
     * Load meshes and create RenderableObjects for ActionModel3D
     * Creates one RenderableObject per mesh node, preserving hierarchy
     * @param {ActionModel3D} model - ActionModel3D to populate with objects
     * @param {GLBLoader} loader - GLBLoader with node data
     * @param {Object} gltf - The parsed GLTF JSON data
     * @param {ArrayBuffer} binaryData - The binary buffer containing geometry data
     * @private
     */
    static loadMeshesWithObjects(model, loader, gltf, binaryData) {
        if (!gltf.meshes || !gltf.nodes) return;

        // Cache Triangle arrays by mesh index to avoid duplication
        const meshCache = {};
        // Cache primitive data by mesh index for physics creation
        const primitivesCache = {};

        // Collect all physics shapes and their transforms for compound shape creation
        const physicsShapes = [];
        const physicsShapeTransforms = [];
        const allDebugVertices = [];
        const allDebugIndices = [];
        let debugIndexOffset = 0;

        // Process each node with a mesh
        for (let nodeIdx = 0; nodeIdx < gltf.nodes.length; nodeIdx++) {
            const nodeData = gltf.nodes[nodeIdx];
            if (nodeData.mesh !== undefined) {
                const node = loader.nodes[nodeIdx];
                const meshIdx = nodeData.mesh;
                const mesh = gltf.meshes[meshIdx];
                const meshData = {
                    name: node.name || mesh.name || `mesh_${model.meshes.length}`,
                    nodeMatrix: node.matrix,
                    nodeIndex: nodeIdx
                };



                // Check if we've already created triangles and physics primitives for this mesh index
                let meshTriangles;
                if (meshCache[meshIdx]) {
                    // Reuse the cached Triangle array reference (in local space)
                    meshTriangles = meshCache[meshIdx];
                } else {
                    // First time seeing this mesh index - create Triangle array in LOCAL SPACE
                    meshTriangles = [];
                    const physicsGeometry = [];

                    for (const primitive of mesh.primitives) {
                        // Extract primitive data for rendering
                        const positions = GLBLoader.getAttributeData(primitive.attributes.POSITION, gltf, binaryData);
                        const indices = GLBLoader.getIndexData(primitive.indices, gltf, binaryData);

                        const primData = {
                            positions,
                            indices,
                            joints: primitive.attributes.JOINTS_0
                                ? GLBLoader.getAttributeData(primitive.attributes.JOINTS_0, gltf, binaryData)
                                : null,
                            weights: primitive.attributes.WEIGHTS_0
                                ? GLBLoader.getAttributeData(primitive.attributes.WEIGHTS_0, gltf, binaryData)
                                : null,
                            material:
                                primitive.material !== undefined
                                    ? GLBLoader.getMaterialData(gltf.materials[primitive.material], gltf)
                                    : { useTexture: false, textureIndex: -1, color: null },
                            nodeMatrix: null // Don't bake transform - keep in local space
                        };

                        // Extract UV coordinates if present
                        if (primitive.attributes.TEXCOORD_0) {
                            primData.texCoords = GLBLoader.getAttributeData(
                                primitive.attributes.TEXCOORD_0,
                                gltf,
                                binaryData
                            );
                        }

                        // Extract vertex normals if present (for smooth shading from Blender)
                        if (primitive.attributes.NORMAL) {
                            primData.normals = GLBLoader.getAttributeData(
                                primitive.attributes.NORMAL,
                                gltf,
                                binaryData
                            );
                        }

                        // Create triangles for this primitive
                        const primTriangles = GLBLoader.createTrianglesFromPrimitive(primData, loader);
                        meshTriangles.push(...primTriangles);

                        // Store only positions and indices for physics (don't keep rendering data)
                        physicsGeometry.push({ positions, indices });
                    }
                    // Cache this mesh's Triangle array and physics geometry for future nodes
                    meshCache[meshIdx] = meshTriangles;
                    primitivesCache[meshIdx] = physicsGeometry;
                }

                // Create RenderableObject for this mesh
                if (meshTriangles.length > 0) {
                    // Extract world transform from the node's world matrix
                    const worldTranslation = new Vector3(node.matrix[12], node.matrix[13], node.matrix[14]);

                    // Extract world scale from matrix rows
                    const sx = Math.sqrt(
                        node.matrix[0] * node.matrix[0] +
                            node.matrix[1] * node.matrix[1] +
                            node.matrix[2] * node.matrix[2]
                    );
                    const sy = Math.sqrt(
                        node.matrix[4] * node.matrix[4] +
                            node.matrix[5] * node.matrix[5] +
                            node.matrix[6] * node.matrix[6]
                    );
                    const sz = Math.sqrt(
                        node.matrix[8] * node.matrix[8] +
                            node.matrix[9] * node.matrix[9] +
                            node.matrix[10] * node.matrix[10]
                    );
                    const worldScale = new Vector3(sx, sy, sz);

                    // Extract rotation by normalizing out the scale and converting to quaternion
                    const trace = node.matrix[0] / sx + node.matrix[5] / sy + node.matrix[10] / sz;
                    let worldRotation = new Quaternion(0, 0, 0, 1);

                    if (trace > 0) {
                        const s = Math.sqrt(trace + 1) * 2;
                        worldRotation.w = 0.25 * s;
                        worldRotation.x = (node.matrix[6] / sz - node.matrix[9] / sy) / s;
                        worldRotation.y = (node.matrix[8] / sx - node.matrix[2] / sz) / s;
                        worldRotation.z = (node.matrix[1] / sx - node.matrix[4] / sy) / s;
                    } else if (node.matrix[0] > node.matrix[5] && node.matrix[0] > node.matrix[10]) {
                        const s = Math.sqrt(1 + node.matrix[0] / sx - node.matrix[5] / sy - node.matrix[10] / sz) * 2;
                        worldRotation.w = (node.matrix[6] / sz - node.matrix[9] / sy) / s;
                        worldRotation.x = 0.25 * s;
                        worldRotation.y = (node.matrix[1] / sx + node.matrix[4] / sy) / s;
                        worldRotation.z = (node.matrix[8] / sx + node.matrix[2] / sz) / s;
                    } else if (node.matrix[5] > node.matrix[10]) {
                        const s = Math.sqrt(1 + node.matrix[5] / sy - node.matrix[0] / sx - node.matrix[10] / sz) * 2;
                        worldRotation.w = (node.matrix[8] / sx - node.matrix[2] / sz) / s;
                        worldRotation.x = (node.matrix[1] / sx + node.matrix[4] / sy) / s;
                        worldRotation.y = 0.25 * s;
                        worldRotation.z = (node.matrix[6] / sz + node.matrix[9] / sy) / s;
                    } else {
                        const s = Math.sqrt(1 + node.matrix[10] / sz - node.matrix[0] / sx - node.matrix[5] / sy) * 2;
                        worldRotation.w = (node.matrix[1] / sx - node.matrix[4] / sy) / s;
                        worldRotation.x = (node.matrix[8] / sx + node.matrix[2] / sz) / s;
                        worldRotation.y = (node.matrix[6] / sz + node.matrix[9] / sy) / s;
                        worldRotation.z = 0.25 * s;
                    }

                    // Create physics mesh for this object using primitive data directly
                    let physicsData = null;
                    const primitives = primitivesCache[meshIdx];
                    if (primitives && primitives.length > 0) {
                        // Build vertices and indices from primitives (already deduplicated by GLTF)
                        const allVertices = [];
                        const allIndices = [];
                        let indexOffset = 0;

                        for (const primData of primitives) {
                            const positions = primData.positions;
                            const indices = primData.indices;

                            // Transform vertices to world space
                            const worldVertices = PhysicsShapeBuilder3D.transformVerticesToWorldSpace(
                                positions,
                                worldTranslation,
                                worldRotation,
                                worldScale
                            );
                            allVertices.push(...worldVertices);

                            // Add indices with offset
                            for (let i = 0; i < indices.length; i++) {
                                allIndices.push(indices[i] + indexOffset);
                            }

                            indexOffset += positions.length / 3;
                        }

                        // Create physics shape using PhysicsShapeBuilder3D
                        if (allVertices.length > 0 && allIndices.length > 0) {
                            physicsData = PhysicsShapeBuilder3D.createMeshShape(allVertices, allIndices, 0);
                            if (physicsData) {
                                physicsData.debugVertices = allVertices;
                                physicsData.debugIndices = allIndices;

                                // Collect for compound shape
                                physicsShapes.push(physicsData.shape);
                                physicsShapeTransforms.push({
                                    position: new PhysicsBackend.Vector3(
                                        worldTranslation.x,
                                        worldTranslation.y,
                                        worldTranslation.z
                                    ),
                                    rotation: new PhysicsBackend.Quaternion(
                                        worldRotation.x,
                                        worldRotation.y,
                                        worldRotation.z,
                                        worldRotation.w
                                    )
                                });

                                // Collect debug geometry for compound visualization
                                allDebugVertices.push(...allVertices);
                                for (const idx of allIndices) {
                                    allDebugIndices.push(idx + debugIndexOffset);
                                }
                                debugIndexOffset += allVertices.length;
                            }
                        }
                    }

                    model.addObject(
                        meshData.name,
                        meshTriangles,
                        nodeIdx,
                        worldTranslation,
                        worldRotation,
                        worldScale,
                        physicsData
                    );
                }

                model.meshes.push(meshData);
            }
        }

        // Create compound shape from all collected shapes
        if (physicsShapes.length > 0) {
            model.compoundPhysicsData = PhysicsShapeBuilder3D.createCompoundPhysics(
                physicsShapes,
                allDebugVertices,
                allDebugIndices
            );

            if (model.compoundPhysicsData) {
                console.log(
                    `[GLBLoader] Created compound physics shape with ${physicsShapes.length} child shapes (vertices in world space)`
                );
            }
        }
    }

    /**
     * Create Triangle objects from primitive data
     * @param {Object} primData - Primitive data with positions, indices, material
     * @param {GLBLoader} loader - GLBLoader instance for texture access
     * @returns {Triangle[]} Array of Triangle objects
     * @private
     */
    static createTrianglesFromPrimitive(primData, loader) {
        const { positions, indices, joints, weights, material, texCoords, nodeMatrix, normals } = primData;
        const triangles = [];

        // Calculate tangents if we have UV coordinates (needed for normal mapping)
        let tangents = null;
        if (texCoords) {
            // Compute face normals for tangent calculation
            const faceNormals = new Float32Array(indices.length);
            for (let i = 0; i < indices.length; i += 3) {
                const i0 = indices[i];
                const i1 = indices[i + 1];
                const i2 = indices[i + 2];

                const p0 = new Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
                const p1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
                const p2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

                const edge1 = p1.sub(p0);
                const edge2 = p2.sub(p0);
                const faceNormal = edge1.cross(edge2).normalize();

                faceNormals[i] = faceNormal.x;
                faceNormals[i + 1] = faceNormal.y;
                faceNormals[i + 2] = faceNormal.z;
            }
            tangents = GLBLoader.calculateTangents(positions, faceNormals, texCoords, indices);
        }

        // Build vertex pool with deduplication by position + UV (to match Blender's vertex count)
        const vertexPool = [];
        const vertexMap = new Map(); // position+UV string key -> vertex data
        const vertexData = [];

        for (let i = 0; i < positions.length / 3; i++) {
            let position = new Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);

            // Apply node transform if available (but NOT for skeletal meshes - joints handle transforms)
            if (nodeMatrix && !joints) {
                // Transform position by node matrix: p' = M * p
                const x = position.x,
                    y = position.y,
                    z = position.z;
                position.x = nodeMatrix[0] * x + nodeMatrix[4] * y + nodeMatrix[8] * z + nodeMatrix[12];
                position.y = nodeMatrix[1] * x + nodeMatrix[5] * y + nodeMatrix[9] * z + nodeMatrix[13];
                position.z = nodeMatrix[2] * x + nodeMatrix[6] * y + nodeMatrix[10] * z + nodeMatrix[14];
            }

            // Get UV coordinates for this vertex
            const uv = texCoords ? { u: texCoords[i * 2], v: texCoords[i * 2 + 1] } : null;

            // Get tangent for this vertex
            const tangent = tangents ? new Vector3(tangents[i * 3], tangents[i * 3 + 1], tangents[i * 3 + 2]) : null;

            // Get vertex normal if available (from Blender smoothing)
            const normal = normals ? new Vector3(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]) : null;

            // Create a key for deduplication including UV (position + UV = unique vertex in rendering)
            // Use full precision to avoid collapsing nearly-identical vertices
            const uvStr = uv ? `${uv.u},${uv.v}` : "0,0";
            const vertexKey = `${position.x},${position.y},${position.z},${uvStr}`;

            let vertexIdx;
            if (vertexMap.has(vertexKey)) {
                // Reuse existing position+UV combo
                vertexIdx = vertexMap.get(vertexKey);
            } else {
                // First time seeing this position+UV combo, add to pool
                vertexIdx = vertexPool.length;
                vertexPool.push(position);
                vertexMap.set(vertexKey, vertexIdx);
            }

            vertexData.push({
                poolIndex: vertexIdx,
                position: position,
                tangent: tangent,
                normal: normal,
                jointIndices: joints ? [joints[i * 4], joints[i * 4 + 1], joints[i * 4 + 2], joints[i * 4 + 3]] : null,
                weights: weights ? [weights[i * 4], weights[i * 4 + 1], weights[i * 4 + 2], weights[i * 4 + 3]] : null,
                uv: uv
            });
        }

        // Create triangles using pooled vertices
        for (let i = 0; i < indices.length; i += 3) {
            const vertices = [vertexData[indices[i]], vertexData[indices[i + 1]], vertexData[indices[i + 2]]];

            // Extract color from material object
            let color = "#FFFFFF";
            if (material && material.color) {
                color = material.color;
            }

            const triangle = new Triangle(vertices[0].position, vertices[1].position, vertices[2].position, color);

            // If vertex normals were loaded from GLB, assign them for smooth shading
            if (vertices[0].normal || vertices[1].normal || vertices[2].normal) {
                triangle.vertexNormals = [
                    vertices[0].normal || new Vector3(triangle.normal.x, triangle.normal.y, triangle.normal.z),
                    vertices[1].normal || new Vector3(triangle.normal.x, triangle.normal.y, triangle.normal.z),
                    vertices[2].normal || new Vector3(triangle.normal.x, triangle.normal.y, triangle.normal.z)
                ];
            }

            // Apply material properties to triangle
            if (material) {
                if (material.alpha !== undefined) {
                    triangle.alpha = material.alpha;
                }
                if (material.metallic !== undefined) {
                    triangle.metallic = material.metallic;
                }
                if (material.roughness !== undefined) {
                    triangle.roughness = material.roughness;
                }
                if (material.emissive !== undefined) {
                    triangle.emissive = material.emissive;
                }
                if (material.ior !== undefined) {
                    triangle.ior = material.ior;
                }
                if (material.transmission !== undefined) {
                    triangle.transmission = material.transmission;
                }
                if (material.volume) {
                    triangle.volume = material.volume;
                }
                if (material.sheen) {
                    triangle.sheen = material.sheen;
                }
                if (material.clearcoat) {
                    triangle.clearcoat = material.clearcoat;
                }
                if (material.anisotropy) {
                    triangle.anisotropy = material.anisotropy;
                }
                if (material.dispersion !== undefined) {
                    triangle.dispersion = material.dispersion;
                }
                if (material.iridescence) {
                    triangle.iridescence = material.iridescence;
                }
                // Store material with all texture map indices
                triangle.material = material;
            }

            // Store UV coordinates
            if (texCoords) {
                triangle.uvs = vertices.map((v) => v.uv);
            }

            // Store tangent coordinates
             if (tangents) {
                 triangle.tangents = vertices.map((v) => v.tangent);
             }

             // Store skeletal animation data (joint indices and blend weights)
             if (vertices[0].jointIndices || vertices[1].jointIndices || vertices[2].jointIndices) {
                 triangle.jointData = vertices.map((v) => v.jointIndices || [0, 0, 0, 0]);
                 triangle.weightData = vertices.map((v) => v.weights || [1, 0, 0, 0]);
             }
             
             // Attach texture image data if available
            if (
                material &&
                material.useTexture &&
                material.textureIndex >= 0 &&
                loader &&
                loader.textures[material.textureIndex]
            ) {
                triangle.texture = {
                    imageData: loader.textures[material.textureIndex],
                    mimeType: loader.textureMetadata[material.textureIndex].mimeType,
                    name: loader.textureMetadata[material.textureIndex].name
                };
            }

            // Attach joint and weight data for skeletal animation
            if (joints && weights) {
                triangle.jointData = vertices.map((v) => v.jointIndices);
                triangle.weightData = vertices.map((v) => v.weights);
            }

            triangles.push(triangle);
        }

        return triangles;
    }

    /**
     * Extracts material information from a GLTF material.
     * Returns color, texture data, and texture indices for normal/metallic/roughness/emissive maps.
     * @param {Object} material - GLTF material data
     * @param {Object} gltf - The complete GLTF data object
     * @returns {Object} Material data with color and optional texture indices
     * @private
     */
    static getMaterialData(material, gltf) {
        const materialData = {
            useTexture: false,
            textureIndex: -1,
            normalMapIndex: -1,
            metallicRoughnessMapIndex: -1,
            emissiveMapIndex: -1,
            color: null,
            alpha: 1.0,
            name: null,
            // PBR properties
            metallic: 0.0,
            roughness: 1.0,
            emissive: [0, 0, 0],
            ior: 1.5 // Default IOR, will be overridden if present in material
        };

        if (!material) return materialData;

        // Extract material name if present
        if (material.name) {
            materialData.name = material.name;
        }

        // Extract base color texture if present
        if (material.pbrMetallicRoughness?.baseColorTexture) {
            const texIdx = material.pbrMetallicRoughness.baseColorTexture.index;
            // Resolve texture index to image source index
            const texture = gltf.textures ? gltf.textures[texIdx] : null;
            const imageIdx = texture && typeof texture.source === "number" ? texture.source : texIdx;
            if (imageIdx !== undefined && gltf.images && gltf.images[imageIdx]) {
                materialData.useTexture = true;
                materialData.textureIndex = imageIdx;
            } else if (texIdx >= 0) {
                console.warn(`[GLBLoader] Material requests texture index ${texIdx} but image source not found`);
            }
        }

        // Extract normal map if present
        if (material.normalTexture) {
            const texIdx = material.normalTexture.index;
            const texture = gltf.textures ? gltf.textures[texIdx] : null;
            const imageIdx = texture && typeof texture.source === "number" ? texture.source : texIdx;
            if (imageIdx !== undefined && gltf.images && gltf.images[imageIdx]) {
                materialData.normalMapIndex = imageIdx;
            }
        }

        // Extract metallic/roughness map if present
        if (material.pbrMetallicRoughness?.metallicRoughnessTexture) {
            const texIdx = material.pbrMetallicRoughness.metallicRoughnessTexture.index;
            const texture = gltf.textures ? gltf.textures[texIdx] : null;
            const imageIdx = texture && typeof texture.source === "number" ? texture.source : texIdx;
            if (imageIdx !== undefined && gltf.images && gltf.images[imageIdx]) {
                materialData.metallicRoughnessMapIndex = imageIdx;
            }
        }

        // Extract emissive map if present
        if (material.emissiveTexture) {
            const texIdx = material.emissiveTexture.index;
            const texture = gltf.textures ? gltf.textures[texIdx] : null;
            const imageIdx = texture && typeof texture.source === "number" ? texture.source : texIdx;
            if (imageIdx !== undefined && gltf.images && gltf.images[imageIdx]) {
                materialData.emissiveMapIndex = imageIdx;
            }
        }

        // Always extract color factor as fallback
        if (material.pbrMetallicRoughness?.baseColorFactor) {
            const [r, g, b, a] = material.pbrMetallicRoughness.baseColorFactor;
            materialData.color = `#${Math.floor(r * 255)
                .toString(16)
                .padStart(2, "0")}${Math.floor(g * 255)
                .toString(16)
                .padStart(2, "0")}${Math.floor(b * 255)
                .toString(16)
                .padStart(2, "0")}`;

            // Extract alpha if present
            if (a !== undefined) {
                materialData.alpha = a;
            }
        }

        // Extract PBR material properties
        if (material.pbrMetallicRoughness) {
            if (material.pbrMetallicRoughness.metallicFactor !== undefined) {
                materialData.metallic = material.pbrMetallicRoughness.metallicFactor;
            }
            if (material.pbrMetallicRoughness.roughnessFactor !== undefined) {
                materialData.roughness = material.pbrMetallicRoughness.roughnessFactor;
            }
        }

        // Extract emissive factor
        if (material.emissiveFactor) {
            materialData.emissive = material.emissiveFactor;
        }

        // Extract IOR from KHR_materials_ior extension
        if (material.extensions?.KHR_materials_ior?.ior !== undefined) {
            materialData.ior = material.extensions.KHR_materials_ior.ior;
        }

        // Extract KHR_materials_transmission
        if (material.extensions?.KHR_materials_transmission?.transmissionFactor !== undefined) {
            materialData.transmission = material.extensions.KHR_materials_transmission.transmissionFactor;
        }

        // Extract KHR_materials_volume
        if (material.extensions?.KHR_materials_volume) {
            const vol = material.extensions.KHR_materials_volume;
            materialData.volume = {
                thicknessFactor: vol.thicknessFactor ?? 0.0,
                attenuationDistance: vol.attenuationDistance ?? 1.0,
                attenuationColor: vol.attenuationColorFactor ?? [1, 1, 1]
            };
        }

        // Extract KHR_materials_sheen
        if (material.extensions?.KHR_materials_sheen) {
            const sheen = material.extensions.KHR_materials_sheen;
            materialData.sheen = {
                colorFactor: sheen.sheenColorFactor ?? [0, 0, 0],
                roughnessFactor: sheen.sheenRoughnessFactor ?? 0.0
            };
        }

        // Extract KHR_materials_clearcoat
        if (material.extensions?.KHR_materials_clearcoat) {
            const cc = material.extensions.KHR_materials_clearcoat;
            materialData.clearcoat = {
                factor: cc.clearcoatFactor ?? 0.0,
                roughnessFactor: cc.clearcoatRoughnessFactor ?? 0.0
            };
        }

        // Extract KHR_materials_anisotropy
        if (material.extensions?.KHR_materials_anisotropy) {
            const aniso = material.extensions.KHR_materials_anisotropy;
            materialData.anisotropy = {
                strength: aniso.anisotropyStrength ?? 0.0,
                rotation: aniso.anisotropyRotation ?? 0.0
            };
        }

        // Extract KHR_materials_dispersion
        if (material.extensions?.KHR_materials_dispersion?.dispersiveIor !== undefined) {
            materialData.dispersion = material.extensions.KHR_materials_dispersion.dispersiveIor;
        }

        // Extract KHR_materials_iridescence
        if (material.extensions?.KHR_materials_iridescence) {
            const irid = material.extensions.KHR_materials_iridescence;
            materialData.iridescence = {
                factor: irid.iridescenceFactor ?? 0.0,
                ior: irid.iridescenceIor ?? 1.3,
                thickness: irid.iridescenceThickness ?? 0.0
            };
        }

        return materialData;
    }

    /**
     * Calculate tangents for a primitive's vertices using positions, normals, and UVs.
     * Uses the Lengyel algorithm for robust tangent generation.
     * @param {Float32Array} positions - Vertex positions (x,y,z per vertex)
     * @param {Float32Array} normals - Vertex normals (x,y,z per vertex)
     * @param {Float32Array} texCoords - UV coordinates (u,v per vertex)
     * @param {Uint32Array|Uint16Array} indices - Triangle indices
     * @returns {Float32Array} Tangents (x,y,z per vertex)
     * @private
     */
    static calculateTangents(positions, normals, texCoords, indices) {
        const vertexCount = positions.length / 3;
        const tangents = new Float32Array(positions.length); // Same layout as positions
        const bitangents = new Float32Array(positions.length);

        // Initialize accumulators
        for (let i = 0; i < vertexCount; i++) {
            tangents[i * 3] = 0;
            tangents[i * 3 + 1] = 0;
            tangents[i * 3 + 2] = 0;
            bitangents[i * 3] = 0;
            bitangents[i * 3 + 1] = 0;
            bitangents[i * 3 + 2] = 0;
        }

        // Process each triangle
        for (let i = 0; i < indices.length; i += 3) {
            const i0 = indices[i];
            const i1 = indices[i + 1];
            const i2 = indices[i + 2];

            // Get vertex positions
            const p0 = new Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
            const p1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
            const p2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

            // Get UV coordinates
            const u0 = new Vector2(texCoords[i0 * 2], texCoords[i0 * 2 + 1]);
            const u1 = new Vector2(texCoords[i1 * 2], texCoords[i1 * 2 + 1]);
            const u2 = new Vector2(texCoords[i2 * 2], texCoords[i2 * 2 + 1]);

            // Edge vectors
            const edge1 = p1.sub(p0);
            const edge2 = p2.sub(p0);

            // UV differences
            const dUV1 = new Vector2(u1.x - u0.x, u1.y - u0.y);
            const dUV2 = new Vector2(u2.x - u0.x, u2.y - u0.y);

            // Calculate determinant
            const r = 1.0 / (dUV1.x * dUV2.y - dUV1.y * dUV2.x);
            if (!isFinite(r)) continue; // Skip degenerate triangles

            // Calculate tangent and bitangent
            const tangent = edge1.scale(dUV2.y).sub(edge2.scale(dUV1.y)).scale(r);
            const bitangent = edge2.scale(dUV1.x).sub(edge1.scale(dUV2.x)).scale(r);

            // Accumulate to vertices
            for (const idx of [i0, i1, i2]) {
                tangents[idx * 3] += tangent.x;
                tangents[idx * 3 + 1] += tangent.y;
                tangents[idx * 3 + 2] += tangent.z;
                bitangents[idx * 3] += bitangent.x;
                bitangents[idx * 3 + 1] += bitangent.y;
                bitangents[idx * 3 + 2] += bitangent.z;
            }
        }

        // Orthonormalize tangents against normals (Gram-Schmidt)
        for (let i = 0; i < vertexCount; i++) {
            const n = new Vector3(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
            const t = new Vector3(tangents[i * 3], tangents[i * 3 + 1], tangents[i * 3 + 2]);
            const b = new Vector3(bitangents[i * 3], bitangents[i * 3 + 1], bitangents[i * 3 + 2]);

            // t = (t - (n · t) * n)
            const dot = n.dot(t);
            t.sub(n.scale(dot));
            t.normalizeInPlace();

            // Determine handedness
            const cross = n.cross(t);
            const handedness = cross.dot(b) < 0 ? -1 : 1;

            // Store tangent with handedness in w component (we'll pack it as xyz only)
            tangents[i * 3] = t.x;
            tangents[i * 3 + 1] = t.y;
            tangents[i * 3 + 2] = t.z;
        }

        return tangents;
    }

    /**
     * Extracts color information from a GLTF material (legacy method for compatibility).
     * @param {Object} material - GLTF material data
     * @returns {string|null} Hex color string or null if no color defined
     * @private
     */
    static getMaterialColor(material) {
        if (material?.pbrMetallicRoughness?.baseColorFactor) {
            const [r, g, b] = material.pbrMetallicRoughness.baseColorFactor;
            return `#${Math.floor(r * 255)
                .toString(16)
                .padStart(2, "0")}${Math.floor(g * 255)
                .toString(16)
                .padStart(2, "0")}${Math.floor(b * 255)
                .toString(16)
                .padStart(2, "0")}`;
        }
        return null;
    }

    /**
     * Gets typed array data from a GLTF accessor.
     * Handles different component types and creates appropriate typed arrays.
     * @param {number} accessorIndex - Index of the accessor in GLTF accessors array
     * @param {Object} gltf - The parsed GLTF JSON data
     * @param {ArrayBuffer} binaryData - The binary buffer containing the actual data
     * @returns {TypedArray} Data as appropriate TypedArray (Float32Array, Uint16Array, etc)
     * @private
     */
    static getAttributeData(accessorIndex, gltf, binaryData) {
        const accessor = gltf.accessors[accessorIndex];
        const bufferView = gltf.bufferViews[accessor.bufferView];
        const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
        const count = accessor.count;
        const components = {
            SCALAR: 1,
            VEC2: 2,
            VEC3: 3,
            VEC4: 4,
            MAT4: 16
        }[accessor.type];

        // Choose array type based on component type
        let ArrayType = Float32Array;
        if (accessor.componentType === 5121) {
            // UNSIGNED_BYTE
            ArrayType = Uint8Array;
        } else if (accessor.componentType === 5123) {
            // UNSIGNED_SHORT
            ArrayType = Uint16Array;
        } else if (accessor.componentType === 5125) {
            // UNSIGNED_INT
            ArrayType = Uint32Array;
        }

        return new ArrayType(
            binaryData.slice(byteOffset, byteOffset + count * components * ArrayType.BYTES_PER_ELEMENT)
        );
    }

    /**
     * Gets index data from a GLTF accessor.
     * Creates appropriate typed array for vertex indices.
     * @param {number} accessorIndex - Index of the accessor in GLTF accessors array
     * @param {Object} gltf - The parsed GLTF JSON data
     * @param {ArrayBuffer} binaryData - The binary buffer containing the actual data
     * @returns {TypedArray|null} Index data as Uint32Array or Uint16Array, or null if no indices
     * @private
     */
    static getIndexData(accessorIndex, gltf, binaryData) {
        if (accessorIndex === undefined) return null;

        const accessor = gltf.accessors[accessorIndex];
        const bufferView = gltf.bufferViews[accessor.bufferView];
        const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);

        return accessor.componentType === 5125
            ? new Uint32Array(binaryData, byteOffset, accessor.count)
            : new Uint16Array(binaryData, byteOffset, accessor.count);
    }
}

/**
 * Represents a node in the GLTF scene graph hierarchy.
 * Handles transformations, mesh references, and skeletal data.
 */
class Node {
    /**
     * Creates a new Node from GLTF node data.
     * @param {Object} nodeData - The GLTF node data
     * @param {number} nodeID - Unique identifier for this node
     * @param {string} [nodeData.name] - Optional name for the node
     * @param {number[]} [nodeData.children] - Array of child node indices
     * @param {number} [nodeData.mesh] - Index of associated mesh
     * @param {number} [nodeData.skin] - Index of associated skin
     * @param {number[]} [nodeData.translation] - Translation [x,y,z]
     * @param {number[]} [nodeData.rotation] - Rotation quaternion [x,y,z,w]
     * @param {number[]} [nodeData.scale] - Scale [x,y,z]
     */
    constructor(nodeData, nodeID) {
        this.nodeID = nodeID;
        this.name = nodeData.name || `node_${nodeID}`;

        // Core node properties
        /** @type {Node[]} Array of child nodes */
        this.children = nodeData.children || [];
        /** @type {number|null} Index of associated mesh */
        this.mesh = nodeData.mesh !== undefined ? nodeData.mesh : null;
        /** @type {number|null} Index of associated skin */
        this.skin = nodeData.skin !== undefined ? nodeData.skin : null;

        // Transform components
        /** @type {Vector3} Node's position in local space */
        this.translation = new Vector3(
            nodeData.translation ? nodeData.translation[0] : 0,
            nodeData.translation ? nodeData.translation[1] : 0,
            nodeData.translation ? nodeData.translation[2] : 0
        );

        /** @type {Quaternion} Node's rotation in local space */
        this.rotation = new Quaternion(
            nodeData.rotation ? nodeData.rotation[0] : 0,
            nodeData.rotation ? nodeData.rotation[1] : 0,
            nodeData.rotation ? nodeData.rotation[2] : 0,
            nodeData.rotation ? nodeData.rotation[3] : 1
        );

        /** @type {Vector3} Node's scale in local space */
        this.scale = new Vector3(
            nodeData.scale ? nodeData.scale[0] : 1,
            nodeData.scale ? nodeData.scale[1] : 1,
            nodeData.scale ? nodeData.scale[2] : 1
        );

        /** @type {Float32Array} Node's transformation matrix */
        this.matrix = Matrix4.create();
        this.updateMatrix();
    }

    /**
     * Updates the node's world matrix by combining local transform with parent's world transform.
     * Recursively updates all child nodes.
     * @param {Float32Array|null} parentWorldMatrix - Parent node's world transform matrix
     */
    updateWorldMatrix(parentWorldMatrix = null) {
        // First update local matrix
        const tempMatrix = Matrix4.create();
        Matrix4.fromRotationTranslation(tempMatrix, this.rotation, this.translation);
        Matrix4.scale(this.matrix, tempMatrix, this.scale.toArray());

        // If we have a parent, multiply by parent's world matrix
        if (parentWorldMatrix) {
            Matrix4.multiply(this.matrix, parentWorldMatrix, this.matrix);
        }

        // Update all children
        for (const child of this.children) {
            child.updateWorldMatrix(this.matrix);
        }
    }

    /**
     * Updates the node's local transformation matrix from TRS components.
     */
    updateMatrix() {
        // Create matrix from TRS components
        const tempMatrix = Matrix4.create();
        Matrix4.fromRotationTranslation(tempMatrix, this.rotation, this.translation);
        Matrix4.scale(this.matrix, tempMatrix, this.scale.toArray());
    }

    /**
     * Traverses the node hierarchy starting from this node.
     * @param {Node|null} parent - Parent node for hierarchy traversal
     * @param {Function} executeFunc - Function to execute on each node
     */
    traverse(parent, executeFunc) {
        executeFunc(this, parent);
        for (const childIndex of this.children) {
            nodes[childIndex].traverse(this, executeFunc);
        }
    }
}

/**
 * Handles interpolation of keyframe data for animations.
 * Supports linear interpolation for translations/scales and spherical interpolation for rotations.
 */
class AnimationSampler {
    /**
     * Creates a new AnimationSampler from GLTF sampler data.
     * @param {Object} gltf - The complete GLTF data object
     * @param {Object} samplerData - The GLTF animation sampler data
     * @param {number} samplerData.input - Accessor index for keyframe times
     * @param {number} samplerData.output - Accessor index for keyframe values
     * @param {string} [samplerData.interpolation='LINEAR'] - Interpolation method
     */
    constructor(gltf, samplerData) {
        /** @type {Float32Array} Array of keyframe timestamps */
        this.times = GLBLoader.getAttributeData(samplerData.input, gltf, gltf.binaryData);

        /** @type {Float32Array} Array of keyframe values (translations, rotations, or scales) */
        this.values = GLBLoader.getAttributeData(samplerData.output, gltf, gltf.binaryData);

        /** @type {string} Interpolation method ('LINEAR' by default) */
        this.interpolation = samplerData.interpolation || "LINEAR";

        /** @type {number} Current keyframe index for playback */
        this.currentIndex = 0;

        /** @type {number} Total duration of this animation track in seconds */
        this.duration = this.times[this.times.length - 1];

        /** @type {number} Time offset for handling animation loops */
        this.loopOffset = 0;
    }

    /**
     * Gets the interpolated value at the specified time.
     * Handles looping and different types of transform data.
     * @param {number} t - Current time in seconds
     * @returns {Vector3|Quaternion} Interpolated value (Vector3 for translation/scale, Quaternion for rotation)
     */
    getValue(t) {
        // Wrap time to animation duration
        t = t % this.duration;

        // Reset for new loop if needed
        if (t < this.times[this.currentIndex]) {
            this.currentIndex = 0;
            this.loopOffset = 0;
        }

        // Find appropriate keyframe pair
        while (this.currentIndex < this.times.length - 1 && t >= this.times[this.currentIndex + 1]) {
            this.currentIndex++;
        }

        // Loop back if we hit the end
        if (this.currentIndex >= this.times.length - 1) {
            this.currentIndex = 0;
        }

        // Calculate interpolation parameters
        const t0 = this.times[this.currentIndex];
        const t1 = this.times[this.currentIndex + 1];
        const progress = (t - t0) / (t1 - t0);

        // Get value indices based on component count
        const i0 = (this.currentIndex * this.values.length) / this.times.length;
        const i1 = i0 + this.values.length / this.times.length;

        // Handle different transform types
        if (this.values.length / this.times.length === 3) {
            // Translation or scale (Vector3)
            return new Vector3(
                this.lerp(this.values[i0], this.values[i1], progress),
                this.lerp(this.values[i0 + 1], this.values[i1 + 1], progress),
                this.lerp(this.values[i0 + 2], this.values[i1 + 2], progress)
            );
        } else {
            // Rotation (Quaternion)
            const start = new Quaternion(
                this.values[i0],
                this.values[i0 + 1],
                this.values[i0 + 2],
                this.values[i0 + 3]
            );
            const end = new Quaternion(this.values[i1], this.values[i1 + 1], this.values[i1 + 2], this.values[i1 + 3]);
            return start.slerp(end, progress);
        }
    }

    /**
     * Linear interpolation between two values.
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} Interpolated value
     * @private
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    }
}

/**
 * Represents an animation in the GLTF model.
 * Handles playback of keyframe animations affecting node transforms.
 */
class Animation {
    /**
     * Creates a new Animation from GLTF animation data.
     * @param {Object} gltf - The complete GLTF data object
     * @param {Object} animData - The GLTF animation data
     * @param {string} [animData.name] - Optional name for the animation
     * @param {Object[]} animData.samplers - Array of animation sampler data
     * @param {Object[]} animData.channels - Array of animation channel data
     * @param {Object} animData.channels[].target - Target information for the channel
     * @param {number} animData.channels[].target.node - Index of target node
     * @param {string} animData.channels[].target.path - Property to animate ('translation', 'rotation', or 'scale')
     * @param {number} animData.channels[].sampler - Index of sampler to use
     */
    constructor(gltf, animData) {
        /** @type {string} Name of the animation */
        this.name = animData.name || "unnamed";

        /**
         * @type {AnimationSampler[]} Array of samplers that handle interpolation
         * Each sampler manages keyframe data for a specific transform component
         */
        this.samplers = animData.samplers.map((s) => new AnimationSampler(gltf, s));

        /**
         * @type {Object[]} Array of channels that connect samplers to nodes
         * Each channel maps a sampler to a specific node's transform property
         */
        this.channels = animData.channels.map((c) => ({
            sampler: this.samplers[c.sampler],
            targetNode: c.target.node,
            targetPath: c.target.path
        }));

        /** @type {number} Total duration of the animation in seconds */
        this.duration = Math.max(...this.samplers.map((s) => s.duration));
    }

    /**
     * Updates the animation state at the given time.
     * Applies interpolated transform values to nodes and updates the node hierarchy.
     * @param {number} t - Current time in seconds
     * @param {Node[]} nodes - Array of all nodes in the model
     */
    update(t, nodes) {
        // Update each animation channel
        for (const channel of this.channels) {
            // Get interpolated value from sampler
            const value = channel.sampler.getValue(t);
            const node = nodes[channel.targetNode];

            // Apply value to appropriate transform component
            switch (channel.targetPath) {
                case "translation":
                    node.translation = value;
                    break;
                case "rotation":
                    node.rotation = value;
                    break;
                case "scale":
                    node.scale = value;
                    break;
            }
        }

        // Update world matrices starting from root nodes
        for (const node of nodes) {
            // Only process root nodes (nodes with no parents)
            if (!nodes.some((n) => n.children.includes(node))) {
                node.updateWorldMatrix();
            }
        }
    }
}

/**
 * Represents a skin (skeleton) in the GLTF model.
 * Handles skeletal animation data and joint transformations.
 */
class Skin {
    /**
     * Creates a new Skin from GLTF skin data.
     * @param {Object} gltf - The complete GLTF data object
     * @param {Object} skinData - The GLTF skin data
     * @param {number[]} skinData.joints - Array of node indices representing joints
     * @param {number} [skinData.inverseBindMatrices] - Accessor index for inverse bind matrices
     * @param {number} skinID - Unique identifier for this skin
     */
    constructor(gltf, skinData, skinID) {
        /** @type {number} Unique identifier for this skin */
        this.skinID = skinID;

        /** @type {number[]} Array of node indices representing joints in the skeleton */
        this.joints = skinData.joints;

        /**
         * @type {Float32Array[]} Array of inverse bind matrices for each joint
         * These transform vertices from model space to joint space
         */
        if (skinData.inverseBindMatrices !== undefined) {
            const data = GLBLoader.getAttributeData(skinData.inverseBindMatrices, gltf, gltf.binaryData);
            this.inverseBindMatrices = [];
            // Each matrix is 16 floats (4x4)
            for (let i = 0; i < data.length; i += 16) {
                const matrix = Matrix4.create();
                for (let j = 0; j < 16; j++) {
                    matrix[j] = data[i + j];
                }
                this.inverseBindMatrices.push(matrix);
            }
        } else {
            // Default to identity matrices if none provided
            this.inverseBindMatrices = this.joints.map(() => Matrix4.create());
        }

        /**
         * @type {Float32Array[]} Array of joint matrices for runtime transform updates
         * These store the final transforms used for vertex skinning
         */
        this.jointMatrices = new Array(this.joints.length);
        for (let i = 0; i < this.jointMatrices.length; i++) {
            this.jointMatrices[i] = Matrix4.create();
        }
    }

    /**
     * Updates joint matrices based on current node transforms.
     * Combines joint world matrices with inverse bind matrices to get final vertex transforms.
     * @param {Node[]} nodes - Array of all nodes in the model
     */
    update(nodes) {
        for (let i = 0; i < this.joints.length; i++) {
            const joint = nodes[this.joints[i]];
            const invBind = this.inverseBindMatrices[i];
            const jointMatrix = this.jointMatrices[i];

            // Final transform = joint's world transform * inverse bind matrix
            Matrix4.multiply(jointMatrix, joint.matrix, invBind);
        }
    }
}

class ModelAnimationController {
    constructor(model) {
        this.model = model;
        this.currentAnimation = null;
        this.currentTime = 0;
        this.isPlaying = false;
        this.isLooping = true;
        this.startTime = 0;

        // Create animation name map
        this.animationMap = new Map();
        this.model.animations.forEach((anim, index) => {
            if (anim.name) {
                this.animationMap.set(anim.name.toLowerCase(), index);
            }
        });
    }

    play(animation, shouldLoop = true) {
        let animationIndex;
        if (typeof animation === "string") {
            animationIndex = this.animationMap.get(animation.toLowerCase());
            if (animationIndex === undefined) {
                console.warn(`Animation "${animation}" not found`);
                return;
            }
        } else if (typeof animation === "number") {
            if (animation >= 0 && animation < this.model.animations.length) {
                animationIndex = animation;
            } else {
                return;
            }
        }

        // If the same animation is already playing, just update loop status
        if (this.currentAnimation === this.model.animations[animationIndex]) {
            this.isLooping = shouldLoop;
            return;
        }

        this.currentAnimation = this.model.animations[animationIndex];
        this.isPlaying = true;
        this.isLooping = shouldLoop;
        this.startTime = performance.now() / 1000;
        this.currentTime = 0;
    }

    getAnimationNames() {
        return Array.from(this.animationMap.keys());
    }

    pause() {
        this.isPlaying = false;
    }

    resume() {
        if (this.currentAnimation) {
            this.isPlaying = true;
            this.startTime = performance.now() / 1000 - this.currentTime;
        }
    }

    stop() {
        this.isPlaying = false;
        this.currentTime = 0;
    }

    update() {
        if (!this.isPlaying || !this.currentAnimation) return;

        this.currentTime = performance.now() / 1000 - this.startTime;

        if (this.currentTime > this.currentAnimation.duration) {
            if (this.isLooping) {
                this.startTime = performance.now() / 1000;
                this.currentTime = 0;
            } else {
                this.isPlaying = false;
                return;
            }
        }

        this.currentAnimation.update(this.currentTime, this.model.nodes);
        if (this.model.skins.length > 0) {
            this.model.skins[0].update(this.model.nodes);
        }
    }
}
