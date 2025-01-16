class GLBLoader {
    constructor() {
        this.triangles = [];
    }

    loadModel(input) {
        if (typeof input === 'string') {
            // Handle base64 string
            return this.loadFromBase64(input);
        } else if (input instanceof ArrayBuffer) {
            // Handle array buffer directly
            return this.loadFromArrayBuffer(input);
        } else {
            throw new Error('Unsupported input format. Please provide a base64 string or ArrayBuffer.');
        }
    }

    loadFromBase64(base64String) {
        const binaryString = atob(base64String);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return this.loadFromArrayBuffer(bytes.buffer);
    }
    
    loadFromArrayBuffer(arrayBuffer) {
        const { gltf, binaryData } = this.parseGLB(arrayBuffer);

        for (const mesh of gltf.meshes) {
            for (const primitive of mesh.primitives) {
                const positions = this.getAttributeData(primitive.attributes.POSITION, gltf, binaryData);
                const indices = this.getIndexData(primitive.indices, gltf, binaryData);
                const uvs = this.getUVs(primitive, gltf, binaryData);
                const vertexColors = this.getVertexColors(primitive, gltf, binaryData);
                const { materialColor, textureData, textureWidth, textureHeight } = 
                    this.getMaterialData(primitive, gltf, binaryData, uvs, indices);

                this.createTriangles(positions, indices, vertexColors, uvs, 
                    materialColor, textureData, textureWidth, textureHeight);
            }
        }

        return this.triangles;
    }

    parseGLB(arrayBuffer) {
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

    getUVs(primitive, gltf, binaryData) {
        return primitive.attributes.TEXCOORD_0 ? 
            this.getAttributeData(primitive.attributes.TEXCOORD_0, gltf, binaryData) : null;
    }

    getVertexColors(primitive, gltf, binaryData) {
        return primitive.attributes.COLOR_0 ?
            this.getAttributeData(primitive.attributes.COLOR_0, gltf, binaryData) : null;
    }

    getMaterialData(primitive, gltf, binaryData, uvs, indices) {
        let materialColor = null;
        let textureData = null;
        let textureWidth = 0;
        let textureHeight = 0;

        if (primitive.material !== undefined) {
            const material = gltf.materials[primitive.material];
            
            // Get material color
            if (material?.pbrMetallicRoughness?.baseColorFactor) {
                const [r, g, b] = material.pbrMetallicRoughness.baseColorFactor;
                materialColor = `#${Math.floor(r * 255).toString(16).padStart(2, "0")}${Math.floor(g * 255).toString(16).padStart(2, "0")}${Math.floor(b * 255).toString(16).padStart(2, "0")}`;
            }

            // Get texture data
            if (material?.pbrMetallicRoughness?.baseColorTexture) {
                const { data, width, height } = this.getTextureData(material, gltf, binaryData, uvs, indices);
                textureData = data;
                textureWidth = width;
                textureHeight = height;
            }
        }

        return { materialColor, textureData, textureWidth, textureHeight };
    }

    getTextureData(material, gltf, binaryData, uvs, indices) {
    const textureInfo = material.pbrMetallicRoughness.baseColorTexture;
    const texture = gltf.textures[textureInfo.index];
    const image = gltf.images[texture.source];

    if (image.bufferView !== undefined) {
        const bufferView = gltf.bufferViews[image.bufferView];
        const imageBytes = new Uint8Array(binaryData, bufferView.byteOffset || 0, bufferView.byteLength);

        // Define grid size based on UVs and image resolution
        const gridSize = 4;
        const samples = new Uint8Array(gridSize * gridSize * 4);
        
        const width = image.width || 64;
        const height = image.height || 64;

        for (let i = 0; i < indices.length; i += 3) {
            // Get the UV coordinates for the current triangle
            const uv1 = { u: uvs[indices[i] * 2], v: uvs[indices[i] * 2 + 1] };
            const uv2 = { u: uvs[indices[i + 1] * 2], v: uvs[indices[i + 1] * 2 + 1] };
            const uv3 = { u: uvs[indices[i + 2] * 2], v: uvs[indices[i + 2] * 2 + 1] };

            // Calculate the average UV coordinates for the triangle
            const u = (uv1.u + uv2.u + uv3.u) / 3;
            const v = (uv1.v + uv2.v + uv3.v) / 3;

            // Map UV coordinates to image pixels
            const x = Math.floor(u * (width - 1));
            const y = Math.floor((1 - v) * (height - 1));

            // Sample the image at the calculated pixel
            const srcIdx = (y * width + x) * 4;
            const r = imageBytes[srcIdx];
            const g = imageBytes[srcIdx + 1];
            const b = imageBytes[srcIdx + 2];
            const a = imageBytes[srcIdx + 3];

            // Assign the sampled color to the corresponding grid cell
            const dstIdx = i / 3 * 4;
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


    getColorFromTextureCoords(uvs, indices, i, textureData, textureWidth, textureHeight) {
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
            return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
        }
        return null;
    }

    createTriangles(positions, indices, vertexColors, uvs, materialColor, textureData, textureWidth, textureHeight) {
        for (let i = 0; i < indices.length; i += 3) {
            const vertices = [
                new Vector3(
                    positions[indices[i] * 3],
                    positions[indices[i] * 3 + 1],
                    positions[indices[i] * 3 + 2]
                ),
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

            let color = "#FF0000"; // default

            if (vertexColors) {
                const colorIndex = indices[i];
                const r = vertexColors[colorIndex * 4];
                const g = vertexColors[colorIndex * 4 + 1];
                const b = vertexColors[colorIndex * 4 + 2];
                color = `#${Math.floor(r * 255).toString(16).padStart(2, "0")}${Math.floor(g * 255).toString(16).padStart(2, "0")}${Math.floor(b * 255).toString(16).padStart(2, "0")}`;
            } 
            else if (uvs && textureData) {
                const textureColor = this.getColorFromTextureCoords(uvs, indices, i, textureData, textureWidth, textureHeight);
                if (textureColor) color = textureColor;
            }
            else if (materialColor) {
                color = materialColor;
            }

            this.triangles.push(new Triangle(vertices[0], vertices[1], vertices[2], color));
        }
    }

    getAttributeData(accessorIndex, gltf, binaryData) {
        const accessor = gltf.accessors[accessorIndex];
        const bufferView = gltf.bufferViews[accessor.bufferView];

        // Get the actual number of components (2 for UV, 3 for positions/normals, etc)
        const componentsCount = {
            SCALAR: 1,
            VEC2: 2,
            VEC3: 3,
            VEC4: 4
        }[accessor.type];

        return new Float32Array(
            binaryData,
            (bufferView.byteOffset || 0) + (accessor.byteOffset || 0),
            accessor.count * componentsCount // Use actual component count
        );
    }

    getIndexData(accessorIndex, gltf, binaryData) {
        const accessor = gltf.accessors[accessorIndex];
        const bufferView = gltf.bufferViews[accessor.bufferView];

        // Handle different index formats
        const IndexArray = accessor.componentType === 5125 ? Uint32Array : Uint16Array;

        return new IndexArray(binaryData, (bufferView.byteOffset || 0) + (accessor.byteOffset || 0), accessor.count);
    }
}