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
    static exportTriangles(triangles, filename = 'model') {
        try {
            const exporter = new GLBExporter();
            const glbBuffer = exporter.createGLBFromTriangles(triangles, filename);
            exporter.downloadFile(glbBuffer, `${filename}.glb`);
            console.log(`Exported ${filename}.glb from ${triangles.length} triangles`);
        } catch (error) {
            console.error('GLB export failed:', error);
            throw error;
        }
    }
    
    /**
     * Create GLB from triangles using materials for each color
     */
    createGLBFromTriangles(triangles, modelName) {
        // Group triangles by color
        const colorGroups = new Map();
        const allVertices = [];
        
        triangles.forEach((triangle, triIndex) => {
            const color = triangle.color || '#808080';
            
            if (!colorGroups.has(color)) {
                colorGroups.set(color, {
                    triangles: [],
                    indices: []
                });
            }
            
            // Add vertices to global array
            const startIndex = allVertices.length;
            triangle.vertices.forEach(vertex => {
                allVertices.push(vertex);
            });
            
            // Store indices for this color group
            colorGroups.get(color).indices.push(startIndex, startIndex + 1, startIndex + 2);
            colorGroups.get(color).triangles.push(triangle);
        });
        
        console.log(`GLB Export: ${triangles.length} triangles, ${colorGroups.size} colors:`, Array.from(colorGroups.keys()));
        
        // Create GLTF structure
        const gltf = this.createGLTFWithMaterials(allVertices, colorGroups, modelName);
        
        // Create binary data
        const binaryData = this.createBinaryData(allVertices, colorGroups);
        
        return this.assembleGLB(gltf, binaryData);
    }
    
    /**
     * Create GLTF structure with separate materials and primitives
     */
    createGLTFWithMaterials(allVertices, colorGroups, modelName) {
        const vertexCount = allVertices.length;
        
        // Calculate buffer sizes
        const positionsSize = vertexCount * 3 * 4; // Float32
        const normalsSize = vertexCount * 3 * 4;   // Float32
        
        // Calculate index buffer sizes for each color group
        let totalIndicesSize = 0;
        for (const group of colorGroups.values()) {
            totalIndicesSize += group.indices.length * 2; // Uint16
        }
        
        const totalBufferSize = positionsSize + normalsSize + totalIndicesSize;
        
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
            meshes: [{
                name: modelName,
                primitives: []
            }],
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
        
        // Create material and primitive for each color group
        let materialIndex = 0;
        for (const [color, group] of colorGroups) {
            // Create material
            const rgb = this.hexToRgb(color);
            gltf.materials.push({
                name: `Material_${color.slice(1)}`,
                pbrMetallicRoughness: {
                    baseColorFactor: [rgb.r / 255, rgb.g / 255, rgb.b / 255, 1.0],
                    metallicFactor: 0.0,
                    roughnessFactor: 1.0
                }
            });
            
            // Create indices buffer view for this color group
            const indicesSize = group.indices.length * 2;
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
                componentType: 5123, // UNSIGNED_SHORT
                count: group.indices.length,
                type: "SCALAR"
            });
            
            // Create primitive
            gltf.meshes[0].primitives.push({
                attributes: {
                    POSITION: positionAccessor,
                    NORMAL: normalAccessor
                },
                indices: accessorIndex++,
                material: materialIndex++,
                mode: 4 // TRIANGLES
            });
        }
        
        return gltf;
    }
    
    /**
     * Create binary data with shared vertices and separate indices
     */
    createBinaryData(allVertices, colorGroups) {
        // Create position data
        const positions = new Float32Array(allVertices.length * 3);
        const normals = new Float32Array(allVertices.length * 3);
        
        // We need to calculate normals from triangles since vertices are shared
        const vertexNormals = new Array(allVertices.length).fill(null).map(() => new Vector3(0, 0, 0));
        const vertexCounts = new Array(allVertices.length).fill(0);
        
        // Calculate normals by averaging triangle normals
        let vertexIndex = 0;
        for (const [color, group] of colorGroups) {
            group.triangles.forEach(triangle => {
                for (let i = 0; i < 3; i++) {
                    vertexNormals[vertexIndex].x += triangle.normal.x;
                    vertexNormals[vertexIndex].y += triangle.normal.y;
                    vertexNormals[vertexIndex].z += triangle.normal.z;
                    vertexCounts[vertexIndex]++;
                    vertexIndex++;
                }
            });
        }
        
        // Normalize and fill arrays
        for (let i = 0; i < allVertices.length; i++) {
            const vertex = allVertices[i];
            positions[i * 3] = vertex.x;
            positions[i * 3 + 1] = vertex.y;
            positions[i * 3 + 2] = vertex.z;
            
            // Normalize the accumulated normal
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
        
        // Create index buffers for each color group
        const indexBuffers = [];
        for (const [color, group] of colorGroups) {
            const indices = new Uint16Array(group.indices);
            indexBuffers.push(indices);
        }
        
        // Combine all buffers
        const totalSize = positions.byteLength + normals.byteLength + 
                         indexBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
        
        const combinedBuffer = new ArrayBuffer(totalSize);
        const view = new Uint8Array(combinedBuffer);
        
        let offset = 0;
        
        // Copy positions
        view.set(new Uint8Array(positions.buffer), offset);
        offset += positions.byteLength;
        
        // Copy normals
        view.set(new Uint8Array(normals.buffer), offset);
        offset += normals.byteLength;
        
        // Copy index buffers
        for (const indexBuffer of indexBuffers) {
            view.set(new Uint8Array(indexBuffer.buffer), offset);
            offset += indexBuffer.byteLength;
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
        view.setUint32(offset, 0x46546C67, true); // 'glTF'
        view.setUint32(offset + 4, 2, true); // version
        view.setUint32(offset + 8, totalSize, true);
        offset += 12;
        
        // JSON chunk
        view.setUint32(offset, paddedJsonLength, true);
        view.setUint32(offset + 4, 0x4E4F534A, true); // 'JSON'
        offset += 8;
        bytes.set(jsonBuffer, offset);
        offset += jsonBuffer.length;
        for (let i = 0; i < jsonPadding; i++) {
            bytes[offset++] = 0x20;
        }
        
        // Binary chunk
        view.setUint32(offset, paddedBinaryLength, true);
        view.setUint32(offset + 4, 0x004E4942, true); // 'BIN\0'
        offset += 8;
        bytes.set(new Uint8Array(binaryData), offset);
        
        return glb;
    }
    
    downloadFile(buffer, filename) {
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 128, g: 128, b: 128 };
    }
    
    calculateMinVertices(vertices) {
        return [
            Math.min(...vertices.map(v => v.x)),
            Math.min(...vertices.map(v => v.y)),
            Math.min(...vertices.map(v => v.z))
        ];
    }
    
    calculateMaxVertices(vertices) {
        return [
            Math.max(...vertices.map(v => v.x)),
            Math.max(...vertices.map(v => v.y)),
            Math.max(...vertices.map(v => v.z))
        ];
    }
}