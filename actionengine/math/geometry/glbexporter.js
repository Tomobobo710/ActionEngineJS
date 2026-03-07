// actionengine/math/geometry/glbexporter.js

/**
 * GLBExporter handles exporting ActionEngine Triangle arrays to GLTF/GLB format.
 * Uses materials for each color with proper primitive separation.
 * Pure ActionEngine format.
 */
class GLBExporter {
    constructor() {
        this.textEncoder = new TextEncoder();
    }

    /**
     * Export Triangle array to GLB file and trigger download
     * @param {Triangle[]} triangles - Array of Triangle objects
     * @param {string} filename - Output filename (without extension)
     */
    static exportTriangles(triangles, filename = "model") {
        try {
            const exporter = new GLBExporter();
            const glbBuffer = exporter.createGLBFromTriangles(triangles, filename);
            exporter.downloadFile(glbBuffer, `${filename}.glb`);
            console.log(`Exported ${filename}.glb from ${triangles.length} triangles`);
        } catch (error) {
            console.error("GLB export failed:", error);
            throw error;
        }
    }

    /**
     * Export ActionModel3D to GLB file, preserving object structure and hierarchy
     * @param {ActionModel3D} model - ActionModel3D instance with objects
     * @param {string} filename - Output filename (without extension)
     */
    static exportActionModel(model, filename = "model") {
        try {
            const exporter = new GLBExporter();
            const glbBuffer = exporter.createGLBFromActionModel(model, filename);
            exporter.downloadFile(glbBuffer, `${filename}.glb`);
            console.log(`Exported ${filename}.glb from ActionModel3D with ${model.objects.length} objects`);
        } catch (error) {
            console.error("ActionModel GLB export failed:", error);
            throw error;
        }
    }

    /**
     * Create GLB from ActionModel3D preserving hierarchy and object structure
     *
     * Uses model.nodes for hierarchy and model.objects for mesh data.
     * Each mesh node gets its own mesh in the GLB.
     * Transform nodes (no mesh) are preserved without geometry.
     *
     * @param {ActionModel3D} model - Model with nodes and objects array
     * @param {string} modelName - Name for the root node
     * @returns {ArrayBuffer} Complete GLB file buffer
     */
    createGLBFromActionModel(model, modelName) {
        if (!model.objects || model.objects.length === 0) {
            return this.createGLBFromTriangles([], modelName);
        }

        // If model has no nodes (procedurally created), generate flat hierarchy
        if (!model.nodes || model.nodes.length === 0) {
            console.log("[GLBExporter] No nodes found, generating flat hierarchy for procedural model");
            model.nodes = [];
            model.objectToNodeIndex = {};
            model.rootNodes = [];

            for (let objIdx = 0; objIdx < model.objects.length; objIdx++) {
                const obj = model.objects[objIdx];
                const nodeData = {
                    name: obj.name || `object_${objIdx}`,
                    children: [], // Store indices, not Node objects
                    childIndices: [], // Track which indices are children for reference
                    mesh: objIdx,
                    translation: obj.transform
                        ? [obj.transform.position.x, obj.transform.position.y, obj.transform.position.z]
                        : [0, 0, 0],
                    rotation: obj.transform
                        ? [
                              obj.transform.rotation.x,
                              obj.transform.rotation.y,
                              obj.transform.rotation.z,
                              obj.transform.rotation.w
                          ]
                        : [0, 0, 0, 1],
                    scale: obj.transform
                        ? [obj.transform.scale.x, obj.transform.scale.y, obj.transform.scale.z]
                        : [1, 1, 1]
                };
                const node = new Node(nodeData, objIdx);
                model.nodes.push(node);
                model.objectToNodeIndex[objIdx] = objIdx;
                model.rootNodes.push(objIdx);
            }
        }

        // Build object lookup by node index for quick access
        const objectByNodeIdx = {};
        for (let objIdx = 0; objIdx < model.objects.length; objIdx++) {
            const nodeIdx = model.objectToNodeIndex[objIdx];
            objectByNodeIdx[nodeIdx] = model.objects[objIdx];
        }

        // Deduplicate meshes by Triangle array reference (WeakMap equivalent using object identity)
        const triangleArrayToMeshInfo = new Map();
        const meshIdByNodeIdx = {}; // Which mesh (by reference) each node uses
        let meshId = 0;

        // First pass: Identify unique Triangle arrays and which nodes use them
        for (let nodeIdx = 0; nodeIdx < model.nodes.length; nodeIdx++) {
            if (objectByNodeIdx[nodeIdx]) {
                const obj = objectByNodeIdx[nodeIdx];
                const triangleArray = obj.triangles;

                // Use array reference as key (JavaScript object identity)
                if (!triangleArrayToMeshInfo.has(triangleArray)) {
                    triangleArrayToMeshInfo.set(triangleArray, {
                        meshId: meshId++,
                        triangles: triangleArray,
                        nodes: []
                    });
                }
                meshIdByNodeIdx[nodeIdx] = triangleArrayToMeshInfo.get(triangleArray).meshId;
                triangleArrayToMeshInfo.get(triangleArray).nodes.push(nodeIdx);
            }
        }

        // Process unique meshes - keep vertices separate per-mesh, not global
        const textureRegistry = new Map();
        const meshData = []; // Each element: { vertices, uvs, materialGroups, meshId, nodeIndices }
        const nodeTransforms = {}; // Store node transforms by index

        // Collect all node transforms first
        for (let nodeIdx = 0; nodeIdx < model.nodes.length; nodeIdx++) {
            const node = model.nodes[nodeIdx];
            nodeTransforms[nodeIdx] = {
                translation: node.translation.clone
                    ? node.translation.clone()
                    : new Vector3(node.translation.x, node.translation.y, node.translation.z),
                rotation: new Quaternion(node.rotation.x, node.rotation.y, node.rotation.z, node.rotation.w),
                scale: node.scale.clone ? node.scale.clone() : new Vector3(node.scale.x, node.scale.y, node.scale.z)
            };
        }

        // Export each unique mesh once with its own vertex pool
        for (const [triangleArray, meshInfo] of triangleArrayToMeshInfo) {
            const meshVertices = []; // Local vertex pool for this mesh
            const meshUVs = []; // Local UVs for this mesh
            const materialGroups = new Map();

            // Group triangles by material
            triangleArray.forEach((triangle) => {
                const color = triangle.color || "#808080";
                const hasTexture = triangle.texture && triangle.texture.imageData;

                let materialKey = color;
                let textureId = null;

                if (hasTexture) {
                    const texName = triangle.texture.name || `texture_${textureRegistry.size}`;
                    if (!textureRegistry.has(texName)) {
                        textureRegistry.set(texName, triangle.texture);
                    }
                    textureId = texName;
                    materialKey = `${color}:${textureId}`;
                }

                // Also collect texture maps (normal, metallic/roughness, emissive) from material
                if (triangle.material) {
                    // Register normal map texture
                    if (
                        triangle.material.normalMapIndex >= 0 &&
                        model.textures &&
                        model.textures[triangle.material.normalMapIndex]
                    ) {
                        const normalMapName = `normal_map_${triangle.material.normalMapIndex}`;
                        if (!textureRegistry.has(normalMapName)) {
                            textureRegistry.set(normalMapName, {
                                imageData: model.textures[triangle.material.normalMapIndex],
                                mimeType:
                                    model.textureMetadata[triangle.material.normalMapIndex]?.mimeType || "image/png",
                                name: model.textureMetadata[triangle.material.normalMapIndex]?.name || normalMapName
                            });
                        }
                    }

                    // Register metallic/roughness map texture
                    if (
                        triangle.material.metallicRoughnessMapIndex >= 0 &&
                        model.textures &&
                        model.textures[triangle.material.metallicRoughnessMapIndex]
                    ) {
                        const metalRoughMapName = `metallic_roughness_map_${triangle.material.metallicRoughnessMapIndex}`;
                        if (!textureRegistry.has(metalRoughMapName)) {
                            textureRegistry.set(metalRoughMapName, {
                                imageData: model.textures[triangle.material.metallicRoughnessMapIndex],
                                mimeType:
                                    model.textureMetadata[triangle.material.metallicRoughnessMapIndex]?.mimeType ||
                                    "image/png",
                                name:
                                    model.textureMetadata[triangle.material.metallicRoughnessMapIndex]?.name ||
                                    metalRoughMapName
                            });
                        }
                    }

                    // Register emissive map texture
                    if (
                        triangle.material.emissiveMapIndex >= 0 &&
                        model.textures &&
                        model.textures[triangle.material.emissiveMapIndex]
                    ) {
                        const emissiveMapName = `emissive_map_${triangle.material.emissiveMapIndex}`;
                        if (!textureRegistry.has(emissiveMapName)) {
                            textureRegistry.set(emissiveMapName, {
                                imageData: model.textures[triangle.material.emissiveMapIndex],
                                mimeType:
                                    model.textureMetadata[triangle.material.emissiveMapIndex]?.mimeType || "image/png",
                                name: model.textureMetadata[triangle.material.emissiveMapIndex]?.name || emissiveMapName
                            });
                        }
                    }
                }

                if (!materialGroups.has(materialKey)) {
                    materialGroups.set(materialKey, {
                        triangles: [],
                        indices: [],
                        color: color,
                        textureId: textureId,
                        hasTexture: hasTexture
                    });
                }

                // Deduplicate vertices by position + UV WITHIN this mesh's pool
                const vertexIndices = [];
                for (let vi = 0; vi < 3; vi++) {
                    const vertex = triangle.vertices[vi];
                    const uv = hasTexture && triangle.uvs && triangle.uvs[vi] ? triangle.uvs[vi] : null;

                    // Create deduplication key including UV
                    const uvStr = uv
                        ? `${(uv.u !== undefined ? uv.u : uv.x).toFixed(6)},${(uv.v !== undefined ? uv.v : uv.y).toFixed(6)}`
                        : "0,0";
                    const posKey = `${vertex.x.toFixed(6)},${vertex.y.toFixed(6)},${vertex.z.toFixed(6)},${uvStr}`;

                    let vertexIndex;
                    if (!materialGroups.get(materialKey).vertexMap) {
                        materialGroups.get(materialKey).vertexMap = new Map();
                    }
                    const vertexMap = materialGroups.get(materialKey).vertexMap;

                    if (vertexMap.has(posKey)) {
                        // Vertex+UV combo already in this mesh's pool
                        vertexIndex = vertexMap.get(posKey);
                    } else {
                        // New vertex+UV combo - add to LOCAL mesh pool
                        vertexIndex = meshVertices.length;
                        meshVertices.push(vertex);
                        vertexMap.set(posKey, vertexIndex);

                        // Add UV for this vertex to LOCAL mesh UV list
                        if (hasTexture && uv) {
                            meshUVs.push(uv.u !== undefined ? uv.u : uv.x);
                            meshUVs.push(uv.v !== undefined ? uv.v : uv.y);
                        } else {
                            meshUVs.push(0);
                            meshUVs.push(0);
                        }
                    }

                    vertexIndices.push(vertexIndex);
                }

                materialGroups.get(materialKey).indices.push(...vertexIndices);
                materialGroups.get(materialKey).triangles.push(triangle);
            });

            meshData.push({
                vertices: meshVertices, // This mesh's local vertices
                uvs: meshUVs, // This mesh's local UVs
                materialGroups: materialGroups,
                meshId: meshInfo.meshId,
                nodeIndices: meshInfo.nodes
            });
        }

        // Check if any mesh needs Uint32 indices
        const useUint32 = meshData.some((m) => m.vertices.length > 65535);

        // Create GLTF with hierarchy preserved
        const gltf = this.createGLTFWithHierarchy(
            meshData,
            textureRegistry,
            model,
            nodeTransforms,
            modelName,
            useUint32
        );

        const binaryData = this.createBinaryData(meshData, textureRegistry, useUint32);
        return this.assembleGLB(gltf, binaryData);
    }

    /**
     * Create GLTF with full node hierarchy preserved
     * meshData now contains { vertices, uvs, materialGroups, meshId, nodeIndices } - one entry per unique mesh
     */
    createGLTFWithHierarchy(meshData, textureRegistry, model, nodeTransforms, modelName, useUint32) {
        // Build mesh index by meshId (one mesh per unique Triangle array)
        const meshIndexByMeshId = {};
        let meshIndex = 0;
        for (const meshInfo of meshData) {
            meshIndexByMeshId[meshInfo.meshId] = meshIndex++;
        }

        // Build reverse lookup: which meshId each node uses
        const meshIdByNodeIdx = {};
        for (const meshInfo of meshData) {
            for (const nodeIdx of meshInfo.nodeIndices) {
                meshIdByNodeIdx[nodeIdx] = meshInfo.meshId;
            }
        }

        // Calculate total buffer size
        const indexSize = useUint32 ? 4 : 2;
        let totalBufferSize = 0;

        // Each mesh: positions + normals + uvs (if any) + indices
        for (const meshInfo of meshData) {
            const vertexCount = meshInfo.vertices.length;
            totalBufferSize += vertexCount * 3 * 4; // positions
            totalBufferSize += vertexCount * 3 * 4; // normals
            if (meshInfo.uvs.length > 0) {
                totalBufferSize += meshInfo.uvs.length * 4; // UVs (already float pairs)
            }
            for (const group of meshInfo.materialGroups.values()) {
                totalBufferSize += group.indices.length * indexSize;
            }
        }

        // Textures
        let totalTextureSize = 0;
        for (const texture of textureRegistry.values()) {
            totalTextureSize += texture.imageData.byteLength;
        }
        totalBufferSize += totalTextureSize;

        let bufferOffset = 0;
         let accessorIndex = 0;
         let bufferViewIndex = 0;
        
         const gltf = {
             asset: { version: "2.0", generator: "ActionEngine GLBExporter" },
             scene: 0,
             scenes: [{ nodes: [] }],
             nodes: [],
             meshes: [],
             materials: [],
             buffers: [{ byteLength: totalBufferSize }],
             bufferViews: [],
             accessors: [],
             extensionsUsed: ["KHR_materials_ior", "KHR_materials_transmission", "KHR_materials_volume", "KHR_materials_sheen", "KHR_materials_clearcoat", "KHR_materials_anisotropy", "KHR_materials_dispersion", "KHR_materials_iridescence"]
         };

        // Create accessor metadata for each mesh (positions, normals, uvs, indices per mesh)
        const meshAccessorData = []; // Maps meshIndex -> { positionAccessor, normalAccessor, uvAccessor, indexAccessors }

        for (let mIdx = 0; mIdx < meshData.length; mIdx++) {
            const meshInfo = meshData[mIdx];
            const vertexCount = meshInfo.vertices.length;
            const accessorData = {
                positionAccessor: null,
                normalAccessor: null,
                uvAccessor: null,
                indexAccessors: []
            };

            // Positions for this mesh
            const positionsSize = vertexCount * 3 * 4;
            gltf.bufferViews.push({
                buffer: 0,
                byteOffset: bufferOffset,
                byteLength: positionsSize,
                target: 34962
            });
            gltf.accessors.push({
                bufferView: bufferViewIndex++,
                componentType: 5126,
                count: vertexCount,
                type: "VEC3",
                min: this.calculateMinVertices(meshInfo.vertices),
                max: this.calculateMaxVertices(meshInfo.vertices)
            });
            accessorData.positionAccessor = accessorIndex++;
            bufferOffset += positionsSize;

            // Normals for this mesh
            const normalsSize = vertexCount * 3 * 4;
            gltf.bufferViews.push({
                buffer: 0,
                byteOffset: bufferOffset,
                byteLength: normalsSize,
                target: 34962
            });
            gltf.accessors.push({
                bufferView: bufferViewIndex++,
                componentType: 5126,
                count: vertexCount,
                type: "VEC3"
            });
            accessorData.normalAccessor = accessorIndex++;
            bufferOffset += normalsSize;

            // UVs for this mesh (if any)
            if (meshInfo.uvs.length > 0) {
                const uvsSize = meshInfo.uvs.length * 4;
                gltf.bufferViews.push({
                    buffer: 0,
                    byteOffset: bufferOffset,
                    byteLength: uvsSize,
                    target: 34962
                });
                gltf.accessors.push({
                    bufferView: bufferViewIndex++,
                    componentType: 5126,
                    count: vertexCount,
                    type: "VEC2"
                });
                accessorData.uvAccessor = accessorIndex++;
                bufferOffset += uvsSize;
            }

            // Index buffers for each material group
            for (const [materialKey, group] of meshInfo.materialGroups) {
                const indicesSize = group.indices.length * indexSize;
                gltf.bufferViews.push({
                    buffer: 0,
                    byteOffset: bufferOffset,
                    byteLength: indicesSize,
                    target: 34963
                });
                gltf.accessors.push({
                    bufferView: bufferViewIndex++,
                    componentType: useUint32 ? 5125 : 5123,
                    count: group.indices.length,
                    type: "SCALAR"
                });
                accessorData.indexAccessors.push(accessorIndex++);
                bufferOffset += indicesSize;
            }

            meshAccessorData.push(accessorData);
        }

        // Textures - map texture names to indices
        const textureNameToIndex = new Map();
        if (textureRegistry.size > 0) {
            gltf.images = [];
            gltf.textures = [];

            let textureIdx = 0;
            for (const [texName, texture] of textureRegistry) {
                gltf.images.push({
                    name: texName,
                    mimeType: texture.mimeType,
                    bufferView: bufferViewIndex
                });

                gltf.bufferViews.push({
                    buffer: 0,
                    byteOffset: bufferOffset,
                    byteLength: texture.imageData.byteLength
                });
                bufferOffset += texture.imageData.byteLength;
                bufferViewIndex++;

                gltf.textures.push({
                    source: gltf.images.length - 1
                });

                textureNameToIndex.set(texName, textureIdx++);
            }
        }

        // Build material index map and GLTF materials
        const materialIndexMap = new Map();
        let materialIndex = 0;

        for (const meshInfo of meshData) {
            for (const [materialKey, group] of meshInfo.materialGroups) {
                if (!materialIndexMap.has(materialKey)) {
                    const color = group.color;
                    const rgb = this.hexToRgb(color);
                    const alpha =
                        group.triangles.length > 0 && group.triangles[0].alpha !== undefined
                            ? group.triangles[0].alpha
                            : 1.0;
                    let metallic = 0,
                        roughness = 1.0;
                    let emissive = [0, 0, 0];
                    let ior = 1.5;

                    if (group.triangles.length > 0) {
                        const firstTriangle = group.triangles[0];
                        if (firstTriangle.metallic !== undefined) {
                            metallic = firstTriangle.metallic;
                        }
                        if (firstTriangle.roughness !== undefined) {
                            roughness = firstTriangle.roughness;
                        }
                        if (firstTriangle.emissive !== undefined) {
                            emissive = firstTriangle.emissive;
                        }
                        if (firstTriangle.ior !== undefined) {
                            ior = firstTriangle.ior;
                        }
                    }

                    const material = {
                        name: materialKey,
                        pbrMetallicRoughness: {
                            baseColorFactor: [rgb.r / 255, rgb.g / 255, rgb.b / 255, alpha],
                            metallicFactor: metallic,
                            roughnessFactor: roughness
                        }
                    };

                    if (emissive[0] !== 0 || emissive[1] !== 0 || emissive[2] !== 0) {
                        material.emissiveFactor = emissive;
                    }

                    // Initialize extensions object if needed
                    if (!material.extensions) {
                        material.extensions = {};
                    }

                    // Add IOR as extension
                    if (ior !== 1.5) {
                        material.extensions.KHR_materials_ior = {
                            ior: ior
                        };
                    }

                    // Add transmission extension
                    if (group.triangles.length > 0) {
                        const firstTriangle = group.triangles[0];
                        
                        // KHR_materials_transmission
                        if (firstTriangle.transmission !== undefined && firstTriangle.transmission > 0) {
                            material.extensions.KHR_materials_transmission = {
                                transmissionFactor: firstTriangle.transmission
                            };
                        }

                        // KHR_materials_volume
                        if (firstTriangle.volume && (firstTriangle.volume.thicknessFactor > 0 || 
                            firstTriangle.volume.attenuationDistance !== Infinity)) {
                            material.extensions.KHR_materials_volume = {
                                thicknessFactor: firstTriangle.volume.thicknessFactor,
                                attenuationDistance: firstTriangle.volume.attenuationDistance,
                                attenuationColorFactor: firstTriangle.volume.attenuationColor
                            };
                        }

                        // KHR_materials_sheen
                        if (firstTriangle.sheen && (firstTriangle.sheen.colorFactor[0] > 0 || 
                            firstTriangle.sheen.colorFactor[1] > 0 || firstTriangle.sheen.colorFactor[2] > 0 ||
                            firstTriangle.sheen.roughnessFactor > 0)) {
                            material.extensions.KHR_materials_sheen = {
                                sheenColorFactor: firstTriangle.sheen.colorFactor,
                                sheenRoughnessFactor: firstTriangle.sheen.roughnessFactor
                            };
                        }

                        // KHR_materials_clearcoat
                        if (firstTriangle.clearcoat && (firstTriangle.clearcoat.factor > 0 || 
                            firstTriangle.clearcoat.roughnessFactor > 0)) {
                            material.extensions.KHR_materials_clearcoat = {
                                clearcoatFactor: firstTriangle.clearcoat.factor,
                                clearcoatRoughnessFactor: firstTriangle.clearcoat.roughnessFactor
                            };
                        }

                        // KHR_materials_anisotropy
                        if (firstTriangle.anisotropy && (firstTriangle.anisotropy.strength > 0 || 
                            firstTriangle.anisotropy.rotation > 0)) {
                            material.extensions.KHR_materials_anisotropy = {
                                anisotropyStrength: firstTriangle.anisotropy.strength,
                                anisotropyRotation: firstTriangle.anisotropy.rotation
                            };
                        }

                        // KHR_materials_dispersion
                        if (firstTriangle.dispersion !== undefined && firstTriangle.dispersion > 0) {
                            material.extensions.KHR_materials_dispersion = {
                                dispersiveIor: firstTriangle.dispersion
                            };
                        }

                        // KHR_materials_iridescence
                        if (firstTriangle.iridescence && (firstTriangle.iridescence.factor > 0 || 
                            firstTriangle.iridescence.thickness > 0)) {
                            material.extensions.KHR_materials_iridescence = {
                                iridescenceFactor: firstTriangle.iridescence.factor,
                                iridescenceIor: firstTriangle.iridescence.ior,
                                iridescenceThickness: firstTriangle.iridescence.thickness
                            };
                        }
                    }

                    if (alpha < 1.0) {
                        material.alphaMode = "BLEND";
                    }

                    if (group.hasTexture && group.textureId && textureNameToIndex.has(group.textureId)) {
                        material.pbrMetallicRoughness.baseColorTexture = {
                            index: textureNameToIndex.get(group.textureId)
                        };
                    }

                    // Add texture maps if available from material data
                    if (group.triangles.length > 0) {
                        const firstTriangle = group.triangles[0];
                        if (firstTriangle.material) {
                            // Add normal map texture if present
                            if (firstTriangle.material.normalMapIndex >= 0) {
                                const normalTexName = `normal_map_${firstTriangle.material.normalMapIndex}`;
                                if (textureNameToIndex.has(normalTexName)) {
                                    material.normalTexture = {
                                        index: textureNameToIndex.get(normalTexName)
                                    };
                                }
                            }

                            // Add metallic/roughness map texture if present
                            if (firstTriangle.material.metallicRoughnessMapIndex >= 0) {
                                const metalRoughTexName = `metallic_roughness_map_${firstTriangle.material.metallicRoughnessMapIndex}`;
                                if (textureNameToIndex.has(metalRoughTexName)) {
                                    material.pbrMetallicRoughness.metallicRoughnessTexture = {
                                        index: textureNameToIndex.get(metalRoughTexName)
                                    };
                                }
                            }

                            // Add emissive map texture if present
                            if (firstTriangle.material.emissiveMapIndex >= 0) {
                                const emissiveTexName = `emissive_map_${firstTriangle.material.emissiveMapIndex}`;
                                if (textureNameToIndex.has(emissiveTexName)) {
                                    material.emissiveTexture = {
                                        index: textureNameToIndex.get(emissiveTexName)
                                    };
                                }
                            }
                        }
                    }

                    gltf.materials.push(material);
                    materialIndexMap.set(materialKey, materialIndex++);
                }
            }
        }

        // Create meshes (one per mesh info)
        let currentMeshIdx = 0;
        let indexAccessorIdx = 0;
        for (let mIdx = 0; mIdx < meshData.length; mIdx++) {
            const meshInfo = meshData[mIdx];
            const accessorData = meshAccessorData[mIdx];
            const primitives = [];

            // Each material group gets a primitive
            let groupIdx = 0;
            for (const [materialKey, group] of meshInfo.materialGroups) {
                const primitiveAttributes = {
                    POSITION: accessorData.positionAccessor,
                    NORMAL: accessorData.normalAccessor
                };
                if (accessorData.uvAccessor !== null) {
                    primitiveAttributes.TEXCOORD_0 = accessorData.uvAccessor;
                }

                primitives.push({
                    attributes: primitiveAttributes,
                    indices: accessorData.indexAccessors[groupIdx],
                    material: materialIndexMap.get(materialKey),
                    mode: 4
                });
                groupIdx++;
            }

            gltf.meshes.push({
                name: `mesh_${mIdx}`,
                primitives: primitives
            });
            currentMeshIdx++;
        }

        // Build quick lookup map for Node objects to their indices (for imported models)
        const nodeToIndexMap = new Map();
        for (let i = 0; i < model.nodes.length; i++) {
            nodeToIndexMap.set(model.nodes[i], i);
        }

        // Create nodes with hierarchy
        for (let nodeIdx = 0; nodeIdx < model.nodes.length; nodeIdx++) {
            const node = model.nodes[nodeIdx];
            const transform = nodeTransforms[nodeIdx];

            const gltfNode = {
                name: node.name || `node_${nodeIdx}`,
                translation: [transform.translation.x, transform.translation.y, transform.translation.z],
                rotation: [transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w],
                scale: [transform.scale.x, transform.scale.y, transform.scale.z]
            };

            // If this node has a mesh, reference it (use meshId to look up mesh index)
            if (meshIdByNodeIdx[nodeIdx] !== undefined) {
                const meshId = meshIdByNodeIdx[nodeIdx];
                gltfNode.mesh = meshIndexByMeshId[meshId];
            }

            // Add children - node.children may contain indices OR Node objects (from imported models)
            if (node.children && node.children.length > 0) {
                gltfNode.children = [];
                for (const child of node.children) {
                    if (typeof child === "number") {
                        // Already an index - use directly
                        if (child >= 0 && child < model.nodes.length) {
                            gltfNode.children.push(child);
                        }
                    } else if (child && typeof child === "object") {
                        // Child is a Node object - look up its index
                        const childIdx = nodeToIndexMap.get(child);
                        if (childIdx !== undefined && childIdx >= 0) {
                            gltfNode.children.push(childIdx);
                        }
                    }
                }
            }

            gltf.nodes.push(gltfNode);
        }

        // Set root nodes in scene
        if (model.rootNodes && model.rootNodes.length > 0) {
            gltf.scenes[0].nodes = model.rootNodes;
        } else if (model.nodes.length === 0 && meshData.length > 0) {
            // Fallback for procedural models with no hierarchy: create single root node with mesh
            const rootNode = {
                name: modelName || "root",
                mesh: 0, // Reference first mesh
                translation: [0, 0, 0],
                rotation: [0, 0, 0, 1],
                scale: [1, 1, 1]
            };
            gltf.nodes.push(rootNode);
            gltf.scenes[0].nodes = [0];
        } else {
            // Fallback: nodes with no parent
            const childSet = new Set();
            for (const node of model.nodes) {
                if (node.children) {
                    for (const child of node.children) {
                        childSet.add(model.nodes.indexOf(child));
                    }
                }
            }
            gltf.scenes[0].nodes = model.nodes.map((_, idx) => idx).filter((idx) => !childSet.has(idx));
        }

        return gltf;
    }

    /**
     * Create GLTF with one mesh per object
     */
    createGLTFWithMultipleMeshes(allVertices, allUVs, meshData, textureRegistry, modelName, useUint32) {
        const vertexCount = allVertices.length;
        const positionsSize = vertexCount * 3 * 4;
        const normalsSize = vertexCount * 3 * 4;
        const uvsSize = allUVs.length > 0 ? (allUVs.length / 2) * 2 * 4 : 0;

        const indexSize = useUint32 ? 4 : 2;
        let totalIndicesSize = 0;
        for (const meshInfo of meshData) {
            for (const group of meshInfo.materialGroups.values()) {
                totalIndicesSize += group.indices.length * indexSize;
            }
        }

        let totalTextureSize = 0;
        for (const texture of textureRegistry.values()) {
            totalTextureSize += texture.imageData.byteLength;
        }

        const totalBufferSize = positionsSize + normalsSize + uvsSize + totalIndicesSize + totalTextureSize;

        let bufferOffset = 0;
        let accessorIndex = 0;
        let bufferViewIndex = 0;

        const gltf = {
            asset: { version: "2.0", generator: "ActionEngine GLBExporter" },
            scene: 0,
            scenes: [{ nodes: [] }],
            nodes: [],
            meshes: [],
            materials: [],
            buffers: [{ byteLength: totalBufferSize }],
            bufferViews: [],
            accessors: []
        };

        // Positions
        gltf.bufferViews.push({
            buffer: 0,
            byteOffset: bufferOffset,
            byteLength: positionsSize,
            target: 34962
        });
        bufferOffset += positionsSize;

        gltf.accessors.push({
            bufferView: bufferViewIndex++,
            componentType: 5126,
            count: vertexCount,
            type: "VEC3",
            min: this.calculateMinVertices(allVertices),
            max: this.calculateMaxVertices(allVertices)
        });
        const positionAccessor = accessorIndex++;

        // Normals
        gltf.bufferViews.push({
            buffer: 0,
            byteOffset: bufferOffset,
            byteLength: normalsSize,
            target: 34962
        });
        bufferOffset += normalsSize;

        gltf.accessors.push({
            bufferView: bufferViewIndex++,
            componentType: 5126,
            count: vertexCount,
            type: "VEC3"
        });
        const normalAccessor = accessorIndex++;

        // UVs
        let uvAccessor = null;
        if (allUVs.length > 0) {
            gltf.bufferViews.push({
                buffer: 0,
                byteOffset: bufferOffset,
                byteLength: uvsSize,
                target: 34962
            });
            bufferOffset += uvsSize;

            gltf.accessors.push({
                bufferView: bufferViewIndex++,
                componentType: 5126,
                count: vertexCount,
                type: "VEC2"
            });
            uvAccessor = accessorIndex++;
        }

        // Textures - map texture names to indices
        let imageDataOffset = positionsSize + normalsSize + uvsSize + totalIndicesSize;
        const textureNameToIndex = new Map();
        if (textureRegistry.size > 0) {
            gltf.images = [];
            gltf.textures = [];

            let textureIdx = 0;
            for (const [texName, texture] of textureRegistry) {
                gltf.images.push({
                    name: texName,
                    mimeType: texture.mimeType,
                    bufferView: bufferViewIndex
                });

                gltf.bufferViews.push({
                    buffer: 0,
                    byteOffset: imageDataOffset,
                    byteLength: texture.imageData.byteLength
                });
                imageDataOffset += texture.imageData.byteLength;
                bufferViewIndex++;

                gltf.textures.push({
                    source: gltf.images.length - 1
                });

                textureNameToIndex.set(texName, textureIdx++);
            }
        }

        // Create one mesh per object
        let materialIndex = 0;
        for (const meshInfo of meshData) {
            const mesh = {
                name: meshInfo.objectName,
                primitives: []
            };

            for (const [materialKey, group] of meshInfo.materialGroups) {
                // Create material object
                const rgb = this.hexToRgb(group.color);
                const alpha =
                    group.triangles.length > 0 && group.triangles[0].alpha !== undefined
                        ? group.triangles[0].alpha
                        : 1.0;
                let metallic = 0,
                    roughness = 1.0;
                let emissive = [0, 0, 0];

                if (group.triangles.length > 0) {
                    const firstTriangle = group.triangles[0];
                    if (firstTriangle.metallic !== undefined) {
                        metallic = firstTriangle.metallic;
                    }
                    if (firstTriangle.roughness !== undefined) {
                        roughness = firstTriangle.roughness;
                    }
                    if (firstTriangle.emissive !== undefined) {
                        emissive = firstTriangle.emissive;
                    }
                }

                const material = {
                    name: materialKey,
                    pbrMetallicRoughness: {
                        baseColorFactor: [rgb.r / 255, rgb.g / 255, rgb.b / 255, alpha],
                        metallicFactor: metallic,
                        roughnessFactor: roughness
                    }
                };

                if (emissive[0] !== 0 || emissive[1] !== 0 || emissive[2] !== 0) {
                    material.emissiveFactor = emissive;
                }

                if (alpha < 1.0) {
                    material.alphaMode = "BLEND";
                }

                if (group.hasTexture && group.textureId && textureNameToIndex.has(group.textureId)) {
                    material.pbrMetallicRoughness.baseColorTexture = {
                        index: textureNameToIndex.get(group.textureId)
                    };
                }

                const materialIdx = gltf.materials.length;
                gltf.materials.push(material);

                const indicesSize = group.indices.length * indexSize;
                gltf.bufferViews.push({
                    buffer: 0,
                    byteOffset: bufferOffset,
                    byteLength: indicesSize,
                    target: 34963
                });
                bufferOffset += indicesSize;

                gltf.accessors.push({
                    bufferView: bufferViewIndex++,
                    componentType: useUint32 ? 5125 : 5123,
                    count: group.indices.length,
                    type: "SCALAR"
                });

                const primitiveAttributes = {
                    POSITION: positionAccessor,
                    NORMAL: normalAccessor
                };

                if (uvAccessor !== null && group.hasTexture) {
                    primitiveAttributes.TEXCOORD_0 = uvAccessor;
                }

                mesh.primitives.push({
                    attributes: primitiveAttributes,
                    indices: accessorIndex++,
                    material: materialIdx,
                    mode: 4
                });
            }

            gltf.meshes.push(mesh);
        }

        // Create one node per mesh, all at root level
        for (let i = 0; i < gltf.meshes.length; i++) {
            gltf.nodes.push({
                mesh: i,
                name: meshData[i].objectName
            });
            gltf.scenes[0].nodes.push(i);
        }

        return gltf;
    }

    /**
     * Create GLB from any Triangle array (no model hierarchy required)
     * Converts flat Triangle[] into the same meshData format as ActionModel export
     * This makes ANY geometry exportable without being GLB-aware
     */
    createGLBFromTriangles(triangles, modelName) {
        // Convert flat Triangle[] into meshData format (same as ActionModel pipeline)
        const meshVertices = []; // Local vertex pool for dedup
        const meshUVs = []; // Local UVs for dedup
        const materialGroups = new Map();
        const textureRegistry = new Map();

        // Group triangles by material and deduplicate vertices
        triangles.forEach((triangle) => {
            const color = triangle.color || "#808080";
            const hasTexture = triangle.texture && triangle.texture.imageData;

            let materialKey = color;
            let textureId = null;

            if (hasTexture) {
                const texName = triangle.texture.name || `texture_${textureRegistry.size}`;
                if (!textureRegistry.has(texName)) {
                    textureRegistry.set(texName, triangle.texture);
                }
                textureId = texName;
                materialKey = `${color}:${textureId}`;
            }

            if (!materialGroups.has(materialKey)) {
                materialGroups.set(materialKey, {
                    triangles: [],
                    indices: [],
                    color: color,
                    textureId: textureId,
                    hasTexture: hasTexture
                });
            }

            // Deduplicate vertices by position + UV WITHIN this mesh
            const vertexIndices = [];
            for (let vi = 0; vi < 3; vi++) {
                const vertex = triangle.vertices[vi];
                const uv = hasTexture && triangle.uvs && triangle.uvs[vi] ? triangle.uvs[vi] : null;

                // Create dedup key including UV
                const uvStr = uv
                    ? `${(uv.u !== undefined ? uv.u : uv.x).toFixed(6)},${(uv.v !== undefined ? uv.v : uv.y).toFixed(6)}`
                    : "0,0";
                const posKey = `${vertex.x.toFixed(6)},${vertex.y.toFixed(6)},${vertex.z.toFixed(6)},${uvStr}`;

                let vertexIndex;
                if (!materialGroups.get(materialKey).vertexMap) {
                    materialGroups.get(materialKey).vertexMap = new Map();
                }
                const vertexMap = materialGroups.get(materialKey).vertexMap;

                if (vertexMap.has(posKey)) {
                    vertexIndex = vertexMap.get(posKey);
                } else {
                    // New vertex - add to mesh pool
                    vertexIndex = meshVertices.length;
                    meshVertices.push(vertex);
                    vertexMap.set(posKey, vertexIndex);

                    // Add UV for this vertex
                    if (hasTexture && uv) {
                        meshUVs.push(uv.u !== undefined ? uv.u : uv.x);
                        meshUVs.push(uv.v !== undefined ? uv.v : uv.y);
                    } else {
                        meshUVs.push(0);
                        meshUVs.push(0);
                    }
                }

                vertexIndices.push(vertexIndex);
            }

            materialGroups.get(materialKey).indices.push(...vertexIndices);
            materialGroups.get(materialKey).triangles.push(triangle);
        });

        // Convert to meshData format for unified export pipeline
        const meshData = [
            {
                vertices: meshVertices,
                uvs: meshUVs,
                materialGroups: materialGroups,
                meshId: 0,
                nodeIndices: [0] // Single mesh, single node
            }
        ];

        const useUint32 = meshVertices.length > 65535;

        console.log(
            `GLB Export: ${triangles.length} triangles, ${meshVertices.length} unique vertices, ${materialGroups.size} materials`,
            useUint32 ? "(using 32-bit indices)" : "(using 16-bit indices)"
        );

        // Use unified export pipeline
        const gltf = this.createGLTFWithHierarchy(
            meshData,
            textureRegistry,
            { nodes: [], rootNodes: [] }, // Empty hierarchy for flat export
            {},
            modelName,
            useUint32
        );

        const binaryData = this.createBinaryData(meshData, textureRegistry, useUint32);

        return this.assembleGLB(gltf, binaryData);
    }

    /**
     * Create GLTF structure with separate materials and primitives
     * @param {Vector3[]} allVertices - All vertex positions
     * @param {number[]} allUVs - All UV coordinates
     * @param {Map} materialGroups - Material groupings
     * @param {Map} textureRegistry - Texture data
     * @param {string} modelName - Model name
     * @param {boolean} useUint32 - Use 32-bit indices
     */
    createGLTFWithMaterials(allVertices, allUVs, materialGroups, textureRegistry, modelName, useUint32) {
        const vertexCount = allVertices.length;

        // Calculate buffer sizes
        const positionsSize = vertexCount * 3 * 4; // Float32
        const normalsSize = vertexCount * 3 * 4; // Float32
        const uvsSize = allUVs.length > 0 ? (allUVs.length / 2) * 2 * 4 : 0; // Float32

        // Calculate index buffer sizes for each material group
        const indexSize = useUint32 ? 4 : 2; // Uint32 or Uint16
        let totalIndicesSize = 0;
        for (const group of materialGroups.values()) {
            totalIndicesSize += group.indices.length * indexSize;
        }

        // Calculate texture image buffer sizes
        let totalTextureSize = 0;
        for (const texture of textureRegistry.values()) {
            totalTextureSize += texture.imageData.byteLength;
        }

        const totalBufferSize = positionsSize + normalsSize + uvsSize + totalIndicesSize + totalTextureSize;

        let bufferOffset = 0;
        let accessorIndex = 0;
        let bufferViewIndex = 0;

        const gltf = {
            asset: {
                version: "2.0",
                generator: "ActionEngine GLBExporter"
            },
            scene: 0,
            scenes: [{ nodes: [0] }],
            nodes: [{ mesh: 0, name: modelName }],
            meshes: [
                {
                    name: modelName,
                    primitives: []
                }
            ],
            materials: [],
            buffers: [{ byteLength: totalBufferSize }],
            bufferViews: [],
            accessors: []
        };

        // Create shared position and normal accessors
        // Positions buffer view
        gltf.bufferViews.push({
            buffer: 0,
            byteOffset: bufferOffset,
            byteLength: positionsSize,
            target: 34962 // ARRAY_BUFFER
        });
        bufferOffset += positionsSize;

        // Positions accessor
        gltf.accessors.push({
            bufferView: bufferViewIndex++,
            componentType: 5126, // FLOAT
            count: vertexCount,
            type: "VEC3",
            min: this.calculateMinVertices(allVertices),
            max: this.calculateMaxVertices(allVertices)
        });
        const positionAccessor = accessorIndex++;

        // Normals buffer view
        gltf.bufferViews.push({
            buffer: 0,
            byteOffset: bufferOffset,
            byteLength: normalsSize,
            target: 34962 // ARRAY_BUFFER
        });
        bufferOffset += normalsSize;

        // Normals accessor
        gltf.accessors.push({
            bufferView: bufferViewIndex++,
            componentType: 5126, // FLOAT
            count: vertexCount,
            type: "VEC3"
        });
        const normalAccessor = accessorIndex++;

        // UV accessor (if we have UVs)
        let uvAccessor = null;
        if (allUVs.length > 0) {
            gltf.bufferViews.push({
                buffer: 0,
                byteOffset: bufferOffset,
                byteLength: uvsSize,
                target: 34962 // ARRAY_BUFFER
            });
            bufferOffset += uvsSize;

            gltf.accessors.push({
                bufferView: bufferViewIndex++,
                componentType: 5126, // FLOAT
                count: vertexCount,
                type: "VEC2"
            });
            uvAccessor = accessorIndex++;
        }

        // Create images and textures array for textures
        let imageDataOffset = positionsSize + normalsSize + uvsSize + totalIndicesSize;
        if (textureRegistry.size > 0) {
            gltf.images = [];
            gltf.textures = [];

            let imageIndex = 0;
            for (const [texName, texture] of textureRegistry) {
                // Create image entry referencing the buffer view
                gltf.images.push({
                    name: texName,
                    mimeType: texture.mimeType,
                    bufferView: bufferViewIndex
                });

                // Create buffer view for this image
                gltf.bufferViews.push({
                    buffer: 0,
                    byteOffset: imageDataOffset,
                    byteLength: texture.imageData.byteLength
                });
                imageDataOffset += texture.imageData.byteLength;
                bufferViewIndex++;

                // Create texture entry
                gltf.textures.push({
                    name: texName,
                    source: imageIndex,
                    sampler: 0
                });

                imageIndex++;
            }

            // Create default sampler
            gltf.samplers = [
                {
                    magFilter: 9729, // LINEAR
                    minFilter: 9987, // LINEAR_MIPMAP_LINEAR
                    wrapS: 10497, // REPEAT
                    wrapT: 10497 // REPEAT
                }
            ];
        }

        // Map texture names to their indices in gltf.textures
        const textureNameToIndex = new Map();
        let textureIndex = 0;
        for (const texName of textureRegistry.keys()) {
            textureNameToIndex.set(texName, textureIndex++);
        }

        // Create material and primitive for each material group
        let materialIndex = 0;
        for (const [materialKey, group] of materialGroups) {
            // Create material
            const rgb = this.hexToRgb(group.color);

            // Extract alpha from triangles in this group (use first triangle's alpha, or default to 1.0)
            let alpha = 1.0;
            if (group.triangles.length > 0 && group.triangles[0].alpha !== undefined) {
                alpha = group.triangles[0].alpha;
            }

            // Use preserved material name if available, otherwise generate from color
            let materialName = `Material_${group.color.slice(1)}`;
            if (group.hasTexture && group.triangles.length > 0 && group.triangles[0].texture?.materialName) {
                materialName = group.triangles[0].texture.materialName;
            }

            // Extract PBR properties from first triangle (all in group should be same material)
            let metallic = 0.0;
            let roughness = 1.0;
            let emissive = [0, 0, 0];

            if (group.triangles.length > 0) {
                const firstTriangle = group.triangles[0];
                if (firstTriangle.metallic !== undefined) {
                    metallic = firstTriangle.metallic;
                }
                if (firstTriangle.roughness !== undefined) {
                    roughness = firstTriangle.roughness;
                }
                if (firstTriangle.emissive !== undefined) {
                    emissive = firstTriangle.emissive;
                }
            }

            const material = {
                name: materialName,
                pbrMetallicRoughness: {
                    baseColorFactor: [rgb.r / 255, rgb.g / 255, rgb.b / 255, alpha],
                    metallicFactor: metallic,
                    roughnessFactor: roughness
                }
            };

            // Add emissive factor if it's not zero
            if (emissive[0] !== 0 || emissive[1] !== 0 || emissive[2] !== 0) {
                material.emissiveFactor = emissive;
            }

            // Enable transparency if alpha < 1.0
            if (alpha < 1.0) {
                material.alphaMode = "BLEND";
            }

            // Add texture reference if this material uses a texture
            if (group.hasTexture && group.textureId) {
                const texIdx = textureNameToIndex.get(group.textureId);
                if (texIdx !== undefined) {
                    material.pbrMetallicRoughness.baseColorTexture = {
                        index: texIdx
                    };
                }
            }

            gltf.materials.push(material);

            // Create indices buffer view for this material group
            const indicesSize = group.indices.length * indexSize;
            gltf.bufferViews.push({
                buffer: 0,
                byteOffset: bufferOffset,
                byteLength: indicesSize,
                target: 34963 // ELEMENT_ARRAY_BUFFER
            });
            bufferOffset += indicesSize;

            // Create indices accessor
            gltf.accessors.push({
                bufferView: bufferViewIndex++,
                componentType: useUint32 ? 5125 : 5123, // UNSIGNED_INT : UNSIGNED_SHORT
                count: group.indices.length,
                type: "SCALAR"
            });

            // Create primitive attributes
            const primitiveAttributes = {
                POSITION: positionAccessor,
                NORMAL: normalAccessor
            };

            // Add UV coordinates if available
            if (uvAccessor !== null && group.hasTexture) {
                primitiveAttributes.TEXCOORD_0 = uvAccessor;
            }

            // Add primitive to main flat mesh (all materials in one mesh)
            gltf.meshes[0].primitives.push({
                attributes: primitiveAttributes,
                indices: accessorIndex++,
                material: materialIndex++,
                mode: 4 // TRIANGLES
            });
        }

        return gltf;
    }

    /**
     * Create binary data from per-mesh geometry
     * Each mesh has its own vertex pool, UVs, and index buffers
     */
    createBinaryData(meshData, textureRegistry, useUint32) {
        const IndexArrayType = useUint32 ? Uint32Array : Uint16Array;

        // Collect all binary data in order: positions, normals, UVs, indices (per mesh), textures
        const bufferParts = [];

        // Process each mesh to build all binary data
        for (const meshInfo of meshData) {
            const vertexCount = meshInfo.vertices.length;

            // Positions for this mesh
            const positions = new Float32Array(vertexCount * 3);
            for (let i = 0; i < vertexCount; i++) {
                const v = meshInfo.vertices[i];
                positions[i * 3] = v.x;
                positions[i * 3 + 1] = v.y;
                positions[i * 3 + 2] = v.z;
            }
            bufferParts.push(new Uint8Array(positions.buffer));

            // Normals for this mesh (calculate from triangle normals)
            const normals = new Float32Array(vertexCount * 3);
            const vertexNormals = new Array(vertexCount).fill(null).map(() => new Vector3(0, 0, 0));
            const vertexCounts = new Array(vertexCount).fill(0);

            // Accumulate normals from all triangles
            for (const group of meshInfo.materialGroups.values()) {
                for (let idx = 0; idx < group.indices.length; idx++) {
                    const vertexIndex = group.indices[idx];
                    const triangleIdx = Math.floor(idx / 3);
                    const triangle = group.triangles[triangleIdx];

                    vertexNormals[vertexIndex].x += triangle.normal.x;
                    vertexNormals[vertexIndex].y += triangle.normal.y;
                    vertexNormals[vertexIndex].z += triangle.normal.z;
                    vertexCounts[vertexIndex]++;
                }
            }

            // Normalize and fill normals array
            for (let i = 0; i < vertexCount; i++) {
                if (vertexCounts[i] > 0) {
                    vertexNormals[i].x /= vertexCounts[i];
                    vertexNormals[i].y /= vertexCounts[i];
                    vertexNormals[i].z /= vertexCounts[i];
                    const length = Math.sqrt(
                        vertexNormals[i].x * vertexNormals[i].x +
                            vertexNormals[i].y * vertexNormals[i].y +
                            vertexNormals[i].z * vertexNormals[i].z
                    );
                    if (length > 0) {
                        vertexNormals[i].x /= length;
                        vertexNormals[i].y /= length;
                        vertexNormals[i].z /= length;
                    }
                }
                normals[i * 3] = vertexNormals[i].x;
                normals[i * 3 + 1] = vertexNormals[i].y;
                normals[i * 3 + 2] = vertexNormals[i].z;
            }
            bufferParts.push(new Uint8Array(normals.buffer));

            // UVs for this mesh
            if (meshInfo.uvs.length > 0) {
                const uvData = new Float32Array(meshInfo.uvs);
                bufferParts.push(new Uint8Array(uvData.buffer));
            }

            // Index buffers for each material group
            for (const group of meshInfo.materialGroups.values()) {
                const indices = new IndexArrayType(group.indices);
                bufferParts.push(new Uint8Array(indices.buffer));
            }
        }

        // Add texture data
        for (const texture of textureRegistry.values()) {
            bufferParts.push(new Uint8Array(texture.imageData));
        }

        // Combine all parts into single buffer
        const totalSize = bufferParts.reduce((sum, part) => sum + part.byteLength, 0);
        const combinedBuffer = new ArrayBuffer(totalSize);
        const combinedView = new Uint8Array(combinedBuffer);

        let offset = 0;
        for (const part of bufferParts) {
            combinedView.set(part, offset);
            offset += part.byteLength;
        }

        return combinedBuffer;
    }

    /**
     * Standard GLB assembly
     */
    assembleGLB(gltf, binaryData) {
        const jsonString = JSON.stringify(gltf);
        const jsonBuffer = this.textEncoder.encode(jsonString);

        const jsonPadding = (4 - (jsonBuffer.length % 4)) % 4;
        const paddedJsonLength = jsonBuffer.length + jsonPadding;

        const binaryPadding = (4 - (binaryData.byteLength % 4)) % 4;
        const paddedBinaryLength = binaryData.byteLength + binaryPadding;

        const totalSize = 12 + 8 + paddedJsonLength + 8 + paddedBinaryLength;

        const glb = new ArrayBuffer(totalSize);
        const view = new DataView(glb);
        const bytes = new Uint8Array(glb);

        let offset = 0;

        // GLB header
        view.setUint32(offset, 0x46546c67, true); // 'glTF'
        view.setUint32(offset + 4, 2, true); // version
        view.setUint32(offset + 8, totalSize, true);
        offset += 12;

        // JSON chunk
        view.setUint32(offset, paddedJsonLength, true);
        view.setUint32(offset + 4, 0x4e4f534a, true); // 'JSON'
        offset += 8;
        bytes.set(jsonBuffer, offset);
        offset += jsonBuffer.length;
        for (let i = 0; i < jsonPadding; i++) {
            bytes[offset++] = 0x20;
        }

        // Binary chunk
        view.setUint32(offset, paddedBinaryLength, true);
        view.setUint32(offset + 4, 0x004e4942, true); // 'BIN\0'
        offset += 8;
        bytes.set(new Uint8Array(binaryData), offset);

        return glb;
    }

    downloadFile(buffer, filename) {
        const blob = new Blob([buffer], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? {
                  r: parseInt(result[1], 16),
                  g: parseInt(result[2], 16),
                  b: parseInt(result[3], 16)
              }
            : { r: 128, g: 128, b: 128 };
    }

    calculateMinVertices(vertices) {
        if (vertices.length === 0) return [0, 0, 0];

        let minX = vertices[0].x;
        let minY = vertices[0].y;
        let minZ = vertices[0].z;

        for (let i = 1; i < vertices.length; i++) {
            const v = vertices[i];
            if (v.x < minX) minX = v.x;
            if (v.y < minY) minY = v.y;
            if (v.z < minZ) minZ = v.z;
        }

        return [minX, minY, minZ];
    }

    calculateMaxVertices(vertices) {
        if (vertices.length === 0) return [0, 0, 0];

        let maxX = vertices[0].x;
        let maxY = vertices[0].y;
        let maxZ = vertices[0].z;

        for (let i = 1; i < vertices.length; i++) {
            const v = vertices[i];
            if (v.x > maxX) maxX = v.x;
            if (v.y > maxY) maxY = v.y;
            if (v.z > maxZ) maxZ = v.z;
        }

        return [maxX, maxY, maxZ];
    }
}
