// actionengine/math/geometry/glbexporter.js

/**
 * GLBExporter handles exporting ActionEngine geometry to GLTF/GLB format.
 * Supports both single-color and multi-color geometry with material-based colors.
 * Compatible with ActionEngine's GLBLoader for complete roundtrip workflows.
 */
class GLBExporter {
    constructor() {
        this.textEncoder = new TextEncoder();
    }
    
    /**
     * Export geometry to GLB file and trigger download
     * @param {Object} geometry - ActionEngine geometry object
     * @param {string} filename - Output filename (without extension)
     */
    exportModel(geometry, filename = 'model') {
        try {
            const glbBuffer = this.createGLB(geometry, filename);
            this.downloadFile(glbBuffer, `${filename}.glb`);
            console.log(`Exported ${filename}.glb`);
        } catch (error) {
            console.error('GLB export failed:', error);
            throw error;
        }
    }
    
    /**
     * Create GLB binary from ActionEngine geometry format
     * @param {Object} geometry - Geometry with vertices and faces/coloredFaces
     * @param {string} modelName - Name for the model
     * @returns {ArrayBuffer} GLB binary data
     */
    createGLB(geometry, modelName) {
        // Create GLTF JSON structure
        const gltf = this.createGLTFStructure(geometry, modelName);
        
        // Create binary vertex data
        const binaryData = this.createBinaryData(geometry);
        
        // Combine into GLB format
        return this.assembleGLB(gltf, binaryData);
    }
    
    /**
     * Create GLTF JSON structure with materials and primitives
     * @param {Object} geometry - ActionEngine geometry
     * @param {string} modelName - Model name
     * @returns {Object} GLTF JSON structure
     */
    createGLTFStructure(geometry, modelName) {
        const vertexCount = geometry.vertices.length;
        
        // Create materials and primitives for each color group
        const { materials, primitives, totalIndexCount } = this.createMaterialsAndPrimitives(geometry);
        
        // Calculate buffer sizes
        const positionBufferSize = vertexCount * 3 * 4; // 3 floats * 4 bytes each
        const indexBufferSize = totalIndexCount * 2; // Uint16 indices * 2 bytes each
        const totalBufferSize = positionBufferSize + indexBufferSize;
        
        const gltf = {
            asset: {
                version: "2.0",
                generator: "ActionEngine GLB Exporter"
            },
            scene: 0,
            scenes: [{
                nodes: [0]
            }],
            nodes: [{
                mesh: 0,
                name: modelName
            }],
            meshes: [{
                primitives: primitives
            }],
            materials: materials,
            accessors: [
                // Position accessor (accessor 0)
                {
                    bufferView: 0,
                    componentType: 5126, // FLOAT
                    count: vertexCount,
                    type: "VEC3",
                    max: this.getVertexMax(geometry.vertices),
                    min: this.getVertexMin(geometry.vertices)
                }
                // Index accessors will be added dynamically for each primitive
            ].concat(this.createIndexAccessors(geometry, totalIndexCount)),
            bufferViews: [
                // Position buffer view
                {
                    buffer: 0,
                    byteOffset: 0,
                    byteLength: positionBufferSize,
                    target: 34962 // ARRAY_BUFFER
                }
                // Index buffer views will be added dynamically for each primitive
            ].concat(this.createIndexBufferViews(geometry, positionBufferSize)),
            buffers: [{
                byteLength: totalBufferSize
            }]
        };
        
        return gltf;
    }
    
    /**
     * Create materials and mesh primitives based on geometry color structure
     * @param {Object} geometry - ActionEngine geometry
     * @returns {Object} Materials, primitives, and total index count
     */
    createMaterialsAndPrimitives(geometry) {
        const materials = [];
        const primitives = [];
        let accessorIndex = 1; // Start after position accessor (0)
        let totalIndexCount = 0;
        
        if (geometry.coloredFaces) {
            // Multi-color geometry - create material and primitive for each color group
            geometry.coloredFaces.forEach((colorGroup, groupIndex) => {
                // Create material with baseColorFactor
                const material = {
                    name: `Material_${groupIndex}`,
                    pbrMetallicRoughness: {
                        baseColorFactor: this.hexToRGBA(colorGroup.color),
                        metallicFactor: 0.1,
                        roughnessFactor: 0.8
                    }
                };
                materials.push(material);
                
                // Create primitive referencing this material
                const primitive = {
                    attributes: {
                        POSITION: 0
                    },
                    indices: accessorIndex,
                    material: groupIndex
                };
                primitives.push(primitive);
                
                totalIndexCount += colorGroup.faces.length * 3;
                accessorIndex++;
            });
        } else {
            // Single color geometry - one material and primitive
            const material = {
                name: 'Material_0',
                pbrMetallicRoughness: {
                    baseColorFactor: this.hexToRGBA(geometry.color || '#808080'),
                    metallicFactor: 0.1,
                    roughnessFactor: 0.8
                }
            };
            materials.push(material);
            
            const primitive = {
                attributes: {
                    POSITION: 0
                },
                indices: 1,
                material: 0
            };
            primitives.push(primitive);
            
            totalIndexCount = geometry.faces.length * 3;
        }
        
        return { materials, primitives, totalIndexCount };
    }
    
    /**
     * Create index accessors for each primitive
     * @param {Object} geometry - ActionEngine geometry
     * @param {number} totalIndexCount - Total number of indices
     * @returns {Array} Index accessor definitions
     */
    createIndexAccessors(geometry, totalIndexCount) {
        const accessors = [];
        
        if (geometry.coloredFaces) {
            geometry.coloredFaces.forEach((colorGroup, groupIndex) => {
                const indexCount = colorGroup.faces.length * 3;
                accessors.push({
                    bufferView: groupIndex + 1, // +1 because position is bufferView 0
                    componentType: 5123, // UNSIGNED_SHORT
                    count: indexCount,
                    type: "SCALAR"
                });
            });
        } else {
            accessors.push({
                bufferView: 1,
                componentType: 5123, // UNSIGNED_SHORT
                count: geometry.faces.length * 3,
                type: "SCALAR"
            });
        }
        
        return accessors;
    }
    
    /**
     * Create buffer views for index data
     * @param {Object} geometry - ActionEngine geometry
     * @param {number} positionBufferSize - Size of position buffer
     * @returns {Array} Buffer view definitions
     */
    createIndexBufferViews(geometry, positionBufferSize) {
        const bufferViews = [];
        let byteOffset = positionBufferSize;
        
        if (geometry.coloredFaces) {
            geometry.coloredFaces.forEach((colorGroup) => {
                const indexCount = colorGroup.faces.length * 3;
                const byteLength = indexCount * 2; // Uint16 indices
                
                bufferViews.push({
                    buffer: 0,
                    byteOffset: byteOffset,
                    byteLength: byteLength,
                    target: 34963 // ELEMENT_ARRAY_BUFFER
                });
                
                byteOffset += byteLength;
            });
        } else {
            const indexCount = geometry.faces.length * 3;
            const byteLength = indexCount * 2;
            
            bufferViews.push({
                buffer: 0,
                byteOffset: byteOffset,
                byteLength: byteLength,
                target: 34963 // ELEMENT_ARRAY_BUFFER
            });
        }
        
        return bufferViews;
    }
    
    /**
     * Create binary data buffer with positions and indices
     * @param {Object} geometry - ActionEngine geometry
     * @returns {ArrayBuffer} Combined binary data
     */
    createBinaryData(geometry) {
        const vertexCount = geometry.vertices.length;
        
        // Create position buffer (Float32Array)
        const positionBuffer = new Float32Array(vertexCount * 3);
        for (let i = 0; i < geometry.vertices.length; i++) {
            const vertex = geometry.vertices[i];
            positionBuffer[i * 3] = vertex.x;
            positionBuffer[i * 3 + 1] = vertex.y;
            positionBuffer[i * 3 + 2] = vertex.z;
        }
        
        // Create separate index buffers for each color group
        const indexBuffers = this.createIndexBuffers(geometry);
        
        // Calculate total size and combine buffers
        const indexBuffersSize = indexBuffers.reduce((total, buffer) => total + buffer.byteLength, 0);
        const totalSize = positionBuffer.byteLength + indexBuffersSize;
        const combinedBuffer = new ArrayBuffer(totalSize);
        const combinedView = new Uint8Array(combinedBuffer);
        
        // Copy position data
        combinedView.set(new Uint8Array(positionBuffer.buffer), 0);
        
        // Copy index buffers
        let offset = positionBuffer.byteLength;
        for (const indexBuffer of indexBuffers) {
            combinedView.set(new Uint8Array(indexBuffer.buffer), offset);
            offset += indexBuffer.byteLength;
        }
        
        return combinedBuffer;
    }
    
    /**
     * Create index buffers for each color group
     * @param {Object} geometry - ActionEngine geometry
     * @returns {Array<Uint16Array>} Index buffers
     */
    createIndexBuffers(geometry) {
        const indexBuffers = [];
        
        if (geometry.coloredFaces) {
            geometry.coloredFaces.forEach((colorGroup) => {
                const indexCount = colorGroup.faces.length * 3;
                const indexBuffer = new Uint16Array(indexCount);
                
                let bufferOffset = 0;
                colorGroup.faces.forEach((face) => {
                    indexBuffer[bufferOffset++] = face[0];
                    indexBuffer[bufferOffset++] = face[1];
                    indexBuffer[bufferOffset++] = face[2];
                });
                
                indexBuffers.push(indexBuffer);
            });
        } else {
            const indexCount = geometry.faces ? geometry.faces.length * 3 : 0;
            const indexBuffer = new Uint16Array(indexCount);
            
            let bufferOffset = 0;
            geometry.faces.forEach((face) => {
                indexBuffer[bufferOffset++] = face[0];
                indexBuffer[bufferOffset++] = face[1];
                indexBuffer[bufferOffset++] = face[2];
            });
            
            indexBuffers.push(indexBuffer);
        }
        
        return indexBuffers;
    }
    
    /**
     * Assemble final GLB binary format
     * @param {Object} gltf - GLTF JSON structure
     * @param {ArrayBuffer} binaryData - Binary geometry data
     * @returns {ArrayBuffer} Complete GLB file
     */
    assembleGLB(gltf, binaryData) {
        // Convert JSON to buffer
        const jsonString = JSON.stringify(gltf);
        const jsonBuffer = this.textEncoder.encode(jsonString);
        
        // Pad JSON to 4-byte boundary
        const jsonPadding = (4 - (jsonBuffer.length % 4)) % 4;
        const paddedJsonLength = jsonBuffer.length + jsonPadding;
        
        // Pad binary data to 4-byte boundary
        const binaryPadding = (4 - (binaryData.byteLength % 4)) % 4;
        const paddedBinaryLength = binaryData.byteLength + binaryPadding;
        
        // Calculate total GLB size
        const headerSize = 12;
        const jsonChunkHeaderSize = 8;
        const binaryChunkHeaderSize = 8;
        const totalSize = headerSize + jsonChunkHeaderSize + paddedJsonLength + 
                         binaryChunkHeaderSize + paddedBinaryLength;
        
        // Create GLB buffer
        const glbBuffer = new ArrayBuffer(totalSize);
        const view = new DataView(glbBuffer);
        const uint8View = new Uint8Array(glbBuffer);
        
        let offset = 0;
        
        // GLB Header
        view.setUint32(offset, 0x46546C67, true); // Magic: 'glTF'
        view.setUint32(offset + 4, 2, true);       // Version: 2
        view.setUint32(offset + 8, totalSize, true); // Total length
        offset += 12;
        
        // JSON Chunk Header
        view.setUint32(offset, paddedJsonLength, true); // JSON length
        view.setUint32(offset + 4, 0x4E4F534A, true);   // Type: 'JSON'
        offset += 8;
        
        // JSON Chunk Data
        uint8View.set(jsonBuffer, offset);
        // Pad JSON with spaces
        for (let i = 0; i < jsonPadding; i++) {
            uint8View[offset + jsonBuffer.length + i] = 0x20; // Space
        }
        offset += paddedJsonLength;
        
        // Binary Chunk Header
        view.setUint32(offset, paddedBinaryLength, true); // Binary length
        view.setUint32(offset + 4, 0x004E4942, true);     // Type: 'BIN\0'
        offset += 8;
        
        // Binary Chunk Data
        uint8View.set(new Uint8Array(binaryData), offset);
        // Binary padding with zeros (already initialized to 0)
        
        return glbBuffer;
    }
    
    /**
     * Download file as blob
     * @param {ArrayBuffer} buffer - File data
     * @param {string} filename - Output filename
     */
    downloadFile(buffer, filename) {
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }
    
    // Helper methods
    hexToRGBA(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return [r, g, b, 1.0];
    }
    
    getVertexMax(vertices) {
        return [
            Math.max(...vertices.map(v => v.x)),
            Math.max(...vertices.map(v => v.y)),
            Math.max(...vertices.map(v => v.z))
        ];
    }
    
    getVertexMin(vertices) {
        return [
            Math.min(...vertices.map(v => v.x)),
            Math.min(...vertices.map(v => v.y)),
            Math.min(...vertices.map(v => v.z))
        ];
    }
}
