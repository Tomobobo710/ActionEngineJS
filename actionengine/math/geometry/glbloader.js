/**
 * Static loader class for processing GLB format 3D models into ActionModel3D instances
 */
class GLBLoader {
    /**
     * Loads a GLB model from either base64 string or ArrayBuffer
     * @param {string|ArrayBuffer} input - GLB data as either base64 string or ArrayBuffer
     * @returns {ActionModel3D} Loaded 3D model
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
     * Loads a GLB model from base64 string
     * @param {string} base64String - Base64 encoded GLB data
     * @returns {ActionModel3D} Loaded 3D model
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
     * Loads a GLB model from ArrayBuffer
     * @param {ArrayBuffer} arrayBuffer - Raw GLB file data
     * @returns {ActionModel3D} Loaded 3D model
     * @private
     */
    static loadFromArrayBuffer(arrayBuffer) {
        const model = new ActionModel3D();
        const { gltf, binaryData } = GLBLoader.parseGLB(arrayBuffer);

        for (const mesh of gltf.meshes) {
            for (const primitive of mesh.primitives) {
                const positions = GLBLoader.getAttributeData(primitive.attributes.POSITION, gltf, binaryData);
                const indices = GLBLoader.getIndexData(primitive.indices, gltf, binaryData);
                const uvs = GLBLoader.getUVs(primitive, gltf, binaryData);
                const vertexColors = GLBLoader.getVertexColors(primitive, gltf, binaryData);
                const { materialColor, textureData, textureWidth, textureHeight } = GLBLoader.getMaterialData(
                    primitive,
                    gltf,
                    binaryData,
                    uvs,
                    indices
                );

                GLBLoader.createTriangles(
                    model.triangles,
                    positions,
                    indices,
                    vertexColors,
                    uvs,
                    materialColor,
                    textureData,
                    textureWidth,
                    textureHeight
                );
            }
        }

        // Load node hierarchy
        if (gltf.nodes) {
            for (let i = 0; i < gltf.nodes.length; i++) {
                const gltfNode = gltf.nodes[i];
                const node = {
                    name: gltfNode.name || `node_${i}`,
                    index: i,
                    children: gltfNode.children || [],
                    parent: null, // We'll set this in a second pass

                    // Transform data
                    translation: gltfNode.translation || [0, 0, 0],
                    rotation: gltfNode.rotation || [0, 0, 0, 1], // Quaternion
                    scale: gltfNode.scale || [1, 1, 1]
                };

                model.nodes.push(node);
                model.nodeMap[node.name] = node;
            }

            // Second pass to set up parent references
            for (const node of model.nodes) {
                for (const childIndex of node.children) {
                    model.nodes[childIndex].parent = node.index;
                }
            }
        }
        // Load skin data if present
        if (gltf.skins && gltf.skins.length > 0) {
            const skin = gltf.skins[0]; // Usually just one skin
            console.log("[GLBLoader] Raw skin data:", skin);
            // Get joints (which nodes are used for skinning)
            model.joints = skin.joints;

            // Load inverse bind matrices (initial pose)
            if (skin.inverseBindMatrices !== undefined) {
                console.log("[GLBLoader] Found inverse bind matrices accessor:", skin.inverseBindMatrices);
                const ibmData = GLBLoader.getAttributeData(skin.inverseBindMatrices, gltf, binaryData);
                console.log("[GLBLoader] Raw IBM data length:", ibmData.length);
                // Convert flat array to 4x4 matrices
                for (let i = 0; i < ibmData.length; i += 16) {
                    model.inverseBindMatrices.push(Array.from(ibmData.slice(i, i + 16)));
                }
            }

            // Load vertex weights
            const primitive = gltf.meshes[0].primitives[0]; // Assuming single mesh/primitive for now
            if (primitive.attributes.JOINTS_0 && primitive.attributes.WEIGHTS_0) {
                const jointIndices = GLBLoader.getAttributeData(primitive.attributes.JOINTS_0, gltf, binaryData);
                const weights = GLBLoader.getAttributeData(primitive.attributes.WEIGHTS_0, gltf, binaryData);

                // Store joint/weight data per vertex
                for (let i = 0; i < jointIndices.length; i += 4) {
                    model.weights.push({
                        joints: [jointIndices[i], jointIndices[i + 1], jointIndices[i + 2], jointIndices[i + 3]],
                        weights: [weights[i], weights[i + 1], weights[i + 2], weights[i + 3]]
                    });
                }
            }
        }

        // Load animations
        if (gltf.animations) {
            for (const animation of gltf.animations) {
                const animData = {
                    name: animation.name || "unnamed",
                    duration: 0,
                    channels: []
                };

                for (const channel of animation.channels) {
                    const sampler = animation.samplers[channel.sampler];
                    const target = channel.target;

                    // Get keyframe times
                    const times = GLBLoader.getAttributeData(sampler.input, gltf, binaryData);

                    // Get keyframe data based on path type (position, rotation, scale)
                    const values = GLBLoader.getAttributeData(sampler.output, gltf, binaryData);

                    const channelData = {
                        target: target.node,
                        times: Array.from(times)
                    };

                    // Organize values based on animation type
                    switch (target.path) {
                        case "translation":
                            channelData.positions = GLBLoader.groupVec3Values(values);
                            break;
                        case "rotation":
                            channelData.rotations = GLBLoader.groupVec4Values(values);
                            break;
                        case "scale":
                            channelData.scales = GLBLoader.groupVec3Values(values);
                            break;
                    }

                    animData.channels.push(channelData);
                    animData.duration = Math.max(animData.duration, times[times.length - 1]);
                }

                model.animations[animData.name] = animData;
            }
        }
        return model;
    }

    /**
     * Parses a GLB file into its JSON and binary components
     * @param {ArrayBuffer} arrayBuffer - Raw GLB file data
     * @returns {{gltf: Object, binaryData: ArrayBuffer}} Parsed GLB with GLTF JSON and binary data
     * @throws {Error} If the GLB file format is invalid
     * @private
     */
    static parseGLB(arrayBuffer) {
        const dataView = new DataView(arrayBuffer);
        const magic = dataView.getUint32(0, true);
        if (magic !== 0x46546c67) {
            throw new Error("Invalid GLB file");
        }

        const jsonChunkLength = dataView.getUint32(12, true);
        const binaryChunkStart = 20 + jsonChunkLength;
        const jsonData = new TextDecoder().decode(new Uint8Array(arrayBuffer, 20, jsonChunkLength));
        const gltf = JSON.parse(jsonData);
        const binaryData = arrayBuffer.slice(binaryChunkStart + 8);

        return { gltf, binaryData };
    }

    /**
     * Extracts UV coordinates from mesh primitive data if available
     * @param {Object} primitive - GLTF mesh primitive containing attribute data
     * @param {Object} gltf - Parsed GLTF data
     * @param {ArrayBuffer} binaryData - Binary buffer containing mesh data
     * @returns {Float32Array|null} UV coordinate data if present, null otherwise
     * @private
     */
    static getUVs(primitive, gltf, binaryData) {
        return primitive.attributes.TEXCOORD_0
            ? GLBLoader.getAttributeData(primitive.attributes.TEXCOORD_0, gltf, binaryData)
            : null;
    }

    /**
     * Extracts vertex color data from mesh primitive if available
     * @param {Object} primitive - GLTF mesh primitive containing attribute data
     * @param {Object} gltf - Parsed GLTF data
     * @param {ArrayBuffer} binaryData - Binary buffer containing mesh data
     * @returns {Float32Array|null} Vertex color data if present, null otherwise
     * @private
     */
    static getVertexColors(primitive, gltf, binaryData) {
        return primitive.attributes.COLOR_0
            ? GLBLoader.getAttributeData(primitive.attributes.COLOR_0, gltf, binaryData)
            : null;
    }

    /**
     * Extracts material and texture information from a mesh primitive
     * @param {Object} primitive - GLTF mesh primitive containing material data
     * @param {Object} gltf - Parsed GLTF data
     * @param {ArrayBuffer} binaryData - Binary buffer containing mesh data
     * @param {Float32Array} uvs - UV coordinate data for texture mapping
     * @param {Uint16Array|Uint32Array} indices - Vertex indices
     * @returns {{
     *   materialColor: string|null,
     *   textureData: Uint8Array|null,
     *   textureWidth: number,
     *   textureHeight: number
     * }} Material and texture information
     * @private
     */
    static getMaterialData(primitive, gltf, binaryData, uvs, indices) {
        let materialColor = null;
        let textureData = null;
        let textureWidth = 0;
        let textureHeight = 0;

        if (primitive.material !== undefined) {
            const material = gltf.materials[primitive.material];

            if (material?.pbrMetallicRoughness?.baseColorFactor) {
                const [r, g, b] = material.pbrMetallicRoughness.baseColorFactor;
                materialColor = `#${Math.floor(r * 255)
                    .toString(16)
                    .padStart(2, "0")}${Math.floor(g * 255)
                    .toString(16)
                    .padStart(2, "0")}${Math.floor(b * 255)
                    .toString(16)
                    .padStart(2, "0")}`;
            }

            if (material?.pbrMetallicRoughness?.baseColorTexture) {
                const { data, width, height } = GLBLoader.getTextureData(material, gltf, binaryData, uvs, indices);
                textureData = data;
                textureWidth = width;
                textureHeight = height;
            }
        }

        return { materialColor, textureData, textureWidth, textureHeight };
    }

    /**
     * Processes and samples texture data from the model
     * @param {Object} material - GLTF material containing texture information
     * @param {Object} gltf - Parsed GLTF data
     * @param {ArrayBuffer} binaryData - Binary buffer containing texture data
     * @param {Float32Array} uvs - UV coordinate data for texture mapping
     * @param {Uint16Array|Uint32Array} indices - Vertex indices
     * @returns {{
     *   data: Uint8Array|null,
     *   width: number,
     *   height: number
     * }} Processed texture data and dimensions
     * @private
     */
    static getTextureData(material, gltf, binaryData, uvs, indices) {
        const textureInfo = material.pbrMetallicRoughness.baseColorTexture;
        const texture = gltf.textures[textureInfo.index];
        const image = gltf.images[texture.source];

        if (image.bufferView !== undefined) {
            const bufferView = gltf.bufferViews[image.bufferView];
            const imageBytes = new Uint8Array(binaryData, bufferView.byteOffset || 0, bufferView.byteLength);

            const gridSize = 4;
            const samples = new Uint8Array(gridSize * gridSize * 4);

            const width = image.width || 64;
            const height = image.height || 64;

            for (let i = 0; i < indices.length; i += 3) {
                const uv1 = { u: uvs[indices[i] * 2], v: uvs[indices[i] * 2 + 1] };
                const uv2 = { u: uvs[indices[i + 1] * 2], v: uvs[indices[i + 1] * 2 + 1] };
                const uv3 = { u: uvs[indices[i + 2] * 2], v: uvs[indices[i + 2] * 2 + 1] };

                const u = (uv1.u + uv2.u + uv3.u) / 3;
                const v = (uv1.v + uv2.v + uv3.v) / 3;

                const x = Math.floor(u * (width - 1));
                const y = Math.floor((1 - v) * (height - 1));

                const srcIdx = (y * width + x) * 4;
                const r = imageBytes[srcIdx];
                const g = imageBytes[srcIdx + 1];
                const b = imageBytes[srcIdx + 2];
                const a = imageBytes[srcIdx + 3];

                const dstIdx = (i / 3) * 4;
                samples[dstIdx] = r;
                samples[dstIdx + 1] = g;
                samples[dstIdx + 2] = b;
                samples[dstIdx + 3] = a;
            }

            return {
                data: samples,
                width: gridSize,
                height: gridSize
            };
        }
        return { data: null, width: 0, height: 0 };
    }

    /**
     * Calculates texture color for a specific triangle based on UV coordinates
     * @param {Float32Array} uvs - UV coordinate data
     * @param {Uint16Array|Uint32Array} indices - Vertex indices
     * @param {number} i - Current triangle index
     * @param {Uint8Array} textureData - Texture pixel data
     * @param {number} textureWidth - Texture width in pixels
     * @param {number} textureHeight - Texture height in pixels
     * @returns {string|null} Hex color string or null if coordinates are invalid
     * @private
     */
    static getColorFromTextureCoords(uvs, indices, i, textureData, textureWidth, textureHeight) {
        const uv1 = { u: uvs[indices[i] * 2], v: uvs[indices[i] * 2 + 1] };
        const uv2 = { u: uvs[indices[i + 1] * 2], v: uvs[indices[i + 1] * 2 + 1] };
        const uv3 = { u: uvs[indices[i + 2] * 2], v: uvs[indices[i + 2] * 2 + 1] };

        const u = (uv1.u + uv2.u + uv3.u) / 3;
        const v = (uv1.v + uv2.v + uv3.v) / 3;

        const x = Math.floor(u * (textureWidth - 1));
        const y = Math.floor((1 - v) * (textureHeight - 1));

        const pixelIndex = (y * textureWidth + x) * 4;
        if (pixelIndex < textureData.length - 3) {
            const r = textureData[pixelIndex];
            const g = textureData[pixelIndex + 1];
            const b = textureData[pixelIndex + 2];
            return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
        }
        return null;
    }

    /**
     * Creates triangle objects from mesh data
     * @param {Triangle[]} triangles - Array to store created triangles
     * @param {Float32Array} positions - Vertex position data
     * @param {Uint16Array|Uint32Array} indices - Vertex indices
     * @param {Float32Array|null} vertexColors - Vertex color data if present
     * @param {Float32Array|null} uvs - UV coordinate data if present
     * @param {string|null} materialColor - Base material color if present
     * @param {Uint8Array|null} textureData - Texture pixel data if present
     * @param {number} textureWidth - Texture width in pixels
     * @param {number} textureHeight - Texture height in pixels
     * @private
     */
    static createTriangles(
        triangles,
        positions,
        indices,
        vertexColors,
        uvs,
        materialColor,
        textureData,
        textureWidth,
        textureHeight
    ) {
        for (let i = 0; i < indices.length; i += 3) {
            const vertices = [
                new Vector3(positions[indices[i] * 3], positions[indices[i] * 3 + 1], positions[indices[i] * 3 + 2]),
                new Vector3(
                    positions[indices[i + 1] * 3],
                    positions[indices[i + 1] * 3 + 1],
                    positions[indices[i + 1] * 3 + 2]
                ),
                new Vector3(
                    positions[indices[i + 2] * 3],
                    positions[indices[i + 2] * 3 + 1],
                    positions[indices[i + 2] * 3 + 2]
                )
            ];

            let color = "#FF0000";

            if (vertexColors) {
                const colorIndex = indices[i];
                const r = vertexColors[colorIndex * 4];
                const g = vertexColors[colorIndex * 4 + 1];
                const b = vertexColors[colorIndex * 4 + 2];
                color = `#${Math.floor(r * 255)
                    .toString(16)
                    .padStart(2, "0")}${Math.floor(g * 255)
                    .toString(16)
                    .padStart(2, "0")}${Math.floor(b * 255)
                    .toString(16)
                    .padStart(2, "0")}`;
            } else if (uvs && textureData) {
                const textureColor = GLBLoader.getColorFromTextureCoords(
                    uvs,
                    indices,
                    i,
                    textureData,
                    textureWidth,
                    textureHeight
                );
                if (textureColor) color = textureColor;
            } else if (materialColor) {
                color = materialColor;
            }

            triangles.push(new Triangle(vertices[0], vertices[1], vertices[2], color));
        }
    }

    /**
     * Extracts attribute data (positions, normals, etc.) from the binary buffer
     * @param {number} accessorIndex - Index of the accessor in GLTF data
     * @param {Object} gltf - Parsed GLTF data
     * @param {ArrayBuffer} binaryData - Binary buffer containing attribute data
     * @returns {Float32Array} Extracted attribute data
     * @private
     */
    static getAttributeData(accessorIndex, gltf, binaryData) {
        const accessor = gltf.accessors[accessorIndex];
        const bufferView = gltf.bufferViews[accessor.bufferView];

        const componentsCount = {
            SCALAR: 1,
            VEC2: 2,
            VEC3: 3,
            VEC4: 4,
            MAT4: 16
        }[accessor.type];

        if (!componentsCount) {
            console.warn(`Unknown accessor type: ${accessor.type}`);
            return new Float32Array(0);
        }

        return new Float32Array(
            binaryData,
            (bufferView.byteOffset || 0) + (accessor.byteOffset || 0),
            accessor.count * componentsCount
        );
    }

    /**
     * Extracts vertex indices from the binary buffer
     * @param {number} accessorIndex - Index of the accessor in GLTF data
     * @param {Object} gltf - Parsed GLTF data
     * @param {ArrayBuffer} binaryData - Binary buffer containing index data
     * @returns {Uint16Array|Uint32Array} Extracted index data
     * @private
     */
    static getIndexData(accessorIndex, gltf, binaryData) {
        const accessor = gltf.accessors[accessorIndex];
        const bufferView = gltf.bufferViews[accessor.bufferView];

        const IndexArray = accessor.componentType === 5125 ? Uint32Array : Uint16Array;

        return new IndexArray(binaryData, (bufferView.byteOffset || 0) + (accessor.byteOffset || 0), accessor.count);
    }

    /**
     * Groups flat array into vec3 arrays
     * @private
     */
    static groupVec3Values(flat) {
        const grouped = [];
        for (let i = 0; i < flat.length; i += 3) {
            grouped.push([flat[i], flat[i + 1], flat[i + 2]]);
        }
        return grouped;
    }

    /**
     * Groups flat array into vec4 arrays (for quaternions)
     * @private
     */
    static groupVec4Values(flat) {
        const grouped = [];
        for (let i = 0; i < flat.length; i += 4) {
            grouped.push([flat[i], flat[i + 1], flat[i + 2], flat[i + 3]]);
        }
        return grouped;
    }
}