// game/display/gl/shadermanager.js
class ShaderManager {
    constructor(renderer3D, initialSize = 500) {
        this.gl = renderer3D.gl;
        this.isWebGL2 = this.gl.getParameter(this.gl.VERSION).includes("WebGL 2.0");

        // Initialize buffers
        this.renderableBuffers = this.createBuffers();

        this.characterIndexCount = 0;
        this.renderableIndexCount = 0;

        this.positions = new Float32Array(initialSize * 9);
        this.normals = new Float32Array(initialSize * 9);
        this.colors = new Float32Array(initialSize * 9);
        this.indices = new Uint16Array(initialSize * 3);
        this.uvs = new Float32Array(initialSize * 6);
        this.colorCache = new Map();

        // Pre-calculate commonly used values
        this.colorMultiplier = 1 / 255;
    }

    createBuffers() {
        return {
            position: this.gl.createBuffer(),
            normal: this.gl.createBuffer(),
            color: this.gl.createBuffer(),
            uv: this.gl.createBuffer(),
            textureIndex: this.gl.createBuffer(),
            useTexture: this.gl.createBuffer(),
            indices: this.gl.createBuffer()
        };
    }

    registerAllShaders(renderer) {
        // Register each shader with the renderer
        ShaderRegistry.getAllShaderNames().forEach((name) => {
            const shader = ShaderRegistry.getShader(name);
            const shaderSet = {
                standard: {
                    vertex: shader.getStandardVertexShader?.(this.isWebGL2),
                    fragment: shader.getStandardFragmentShader?.(this.isWebGL2)
                },
                // Character shader removed - characters now use standard shader
                lines: {
                    vertex: shader.getLineVertexShader?.(this.isWebGL2),
                    fragment: shader.getLineFragmentShader?.(this.isWebGL2)
                }
            };
            renderer.programRegistry.registerShaderSet(name, shaderSet);
        });
    }

    getShader(type, shaderName) {
        const shader = ShaderRegistry.getShader(shaderName);
        if (!shader) return null;

        const methodName = `get${type}Shader`;
        return shader[methodName]?.(this.isWebGL2);
    }

    registerShaderSet(renderer, name) {
        const shaderSet = {};

        const standardVertex = this.getShader("StandardVertex", name);
        const standardFragment = this.getShader("StandardFragment", name);
        if (standardVertex && standardFragment) {
            shaderSet.standard = {
                vertex: standardVertex,
                fragment: standardFragment
            };
        }

        // Character shader registration removed - characters now use standard shader

        const lineVertex = this.getShader("LineVertex", name);
        const lineFragment = this.getShader("LineFragment", name);
        if (lineVertex && lineFragment) {
            shaderSet.lines = {
                vertex: lineVertex,
                fragment: lineFragment
            };
        }

        if (Object.keys(shaderSet).length > 0) {
            renderer.registerShaderSet(name, shaderSet);
        }
    }

    // Terrain is now handled as a regular object through updateRenderableBuffers
    getTextureIndexForProceduralTexture(proceduralTexture) {
        // Loop through textureRegistry to find which texture this is
        for (let i = 0; i < textureRegistry.textureList.length; i++) {
            const name = textureRegistry.textureList[i];
            if (textureRegistry.get(name) === proceduralTexture) {
                return i;
            }
        }
        return 0; // Default to first texture if not found
    }
    
    updateRenderableBuffers(renderable) {
        const triangleCount = renderable.triangles.length;

        // Resize buffers if needed
        this.ensureBufferCapacity(triangleCount);

        // Direct array access is faster than repeated property lookups
        const positions = this.positions;
        const normals = this.normals;
        const colors = this.colors;
        const colorCache = this.colorCache;
        const triangles = renderable.triangles;

        // Process in chunks for better cache utilization
        const CHUNK_SIZE = 64; // Adjust based on testing

        for (let chunkStart = 0; chunkStart < triangleCount; chunkStart += CHUNK_SIZE) {
            const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, triangleCount);

            for (let i = chunkStart; i < chunkEnd; i++) {
                const triangle = triangles[i];
                const baseIndex = i * 9;

                // Unroll the vertex loop for better performance
                // Vertex 0
                const v0 = triangle.vertices[0];
                positions[baseIndex] = v0.x;
                positions[baseIndex + 1] = v0.y;
                positions[baseIndex + 2] = v0.z;

                // Vertex 1
                const v1 = triangle.vertices[1];
                positions[baseIndex + 3] = v1.x;
                positions[baseIndex + 4] = v1.y;
                positions[baseIndex + 5] = v1.z;

                // Vertex 2
                const v2 = triangle.vertices[2];
                positions[baseIndex + 6] = v2.x;
                positions[baseIndex + 7] = v2.y;
                positions[baseIndex + 8] = v2.z;

                // Normal (same for all vertices in triangle)
                const normal = triangle.normal;
                for (let j = 0; j < 3; j++) {
                    const normalOffset = baseIndex + j * 3;
                    normals[normalOffset] = normal.x;
                    normals[normalOffset + 1] = normal.y;
                    normals[normalOffset + 2] = normal.z;
                }

                // Optimized color processing
                let rgb = colorCache.get(triangle.color);
                if (!rgb) {
                    const color = triangle.color;
                    rgb = {
                        r: parseInt(color.slice(1, 3), 16) * this.colorMultiplier,
                        g: parseInt(color.slice(3, 5), 16) * this.colorMultiplier,
                        b: parseInt(color.slice(5, 7), 16) * this.colorMultiplier
                    };
                    colorCache.set(color, rgb);
                }

                // Unrolled color assignment
                colors[baseIndex] = colors[baseIndex + 3] = colors[baseIndex + 6] = rgb.r;
                colors[baseIndex + 1] = colors[baseIndex + 4] = colors[baseIndex + 7] = rgb.g;
                colors[baseIndex + 2] = colors[baseIndex + 5] = colors[baseIndex + 8] = rgb.b;
            }
        }

        const indexCount = triangleCount * 3;

        // Only update indices if count changed
        if (indexCount !== this.lastIndexCount) {
            for (let i = 0; i < indexCount; i++) {
                this.indices[i] = i;
            }
            this.lastIndexCount = indexCount;
        }

        // Batch GL updates using VAOs if available
        const gl = this.gl;

        if (this.vao) {
            gl.bindVertexArray(this.vao);
        }

        // Use vertex buffer subdata for partial updates
        gl.bindBuffer(gl.ARRAY_BUFFER, this.renderableBuffers.position);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions.subarray(0, triangleCount * 9));

        gl.bindBuffer(gl.ARRAY_BUFFER, this.renderableBuffers.normal);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, normals.subarray(0, triangleCount * 9));

        gl.bindBuffer(gl.ARRAY_BUFFER, this.renderableBuffers.color);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, colors.subarray(0, triangleCount * 9));

        if (indexCount !== this.lastIndexCount) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.renderableBuffers.indices);
            gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, this.indices.subarray(0, indexCount));
        }

        // No need to update UVs if they're always zero

        if (this.vao) {
            gl.bindVertexArray(null);
        }

        this.renderableIndexCount = indexCount;
        return indexCount;
    }

    // Helper method
    ensureBufferCapacity(triangleCount) {
        const required = triangleCount * 9;
        if (this.positions.length < required) {
            const newSize = Math.ceil(required * 1.5); // Add some extra for growth
            this.positions = new Float32Array(newSize);
            this.normals = new Float32Array(newSize);
            this.colors = new Float32Array(newSize);
            this.indices = new Uint16Array(triangleCount * 3);
            this.uvs = new Float32Array(triangleCount * 6);
        }
    }

    goodupdateRenderableBuffers(renderable) {
        const triangleCount = renderable.triangles.length;
        const positions = new Float32Array(triangleCount * 9);
        const normals = new Float32Array(triangleCount * 9);
        const colors = new Float32Array(triangleCount * 9);

        // Pre-calculate color values outside the loop
        const colorCache = new Map();

        for (let i = 0; i < triangleCount; i++) {
            const triangle = renderable.triangles[i];
            const baseIndex = i * 9;

            // Process vertices and normals
            const vertices = triangle.vertices;
            const normal = triangle.normal;

            for (let j = 0; j < 3; j++) {
                const vertexOffset = baseIndex + j * 3;
                const vertex = vertices[j];

                // Positions
                positions[vertexOffset] = vertex.x;
                positions[vertexOffset + 1] = vertex.y;
                positions[vertexOffset + 2] = vertex.z;

                // Normals
                normals[vertexOffset] = normal.x;
                normals[vertexOffset + 1] = normal.y;
                normals[vertexOffset + 2] = normal.z;
            }

            // Process colors with caching
            let rgb = colorCache.get(triangle.color);
            if (!rgb) {
                rgb = {
                    r: parseInt(triangle.color.substr(1, 2), 16) / 255,
                    g: parseInt(triangle.color.substr(3, 2), 16) / 255,
                    b: parseInt(triangle.color.substr(5, 2), 16) / 255
                };
                colorCache.set(triangle.color, rgb);
            }

            // Fill colors for all vertices of the triangle
            for (let j = 0; j < 3; j++) {
                const colorOffset = baseIndex + j * 3;
                colors[colorOffset] = rgb.r;
                colors[colorOffset + 1] = rgb.g;
                colors[colorOffset + 2] = rgb.b;
            }
        }

        // Create and fill indices array
        const indexCount = triangleCount * 3;
        const indices = new Uint16Array(indexCount);
        for (let i = 0; i < indexCount; i++) {
            indices[i] = i;
        }

        // Create UV array
        const uvs = new Float32Array(triangleCount * 6);
        // No need to fill with zeros as TypedArrays are zero-initialized

        // Batch GL operations
        const gl = this.gl;

        // Update all buffers
        const bufferUpdates = [
            { buffer: this.renderableBuffers.position, data: positions },
            { buffer: this.renderableBuffers.normal, data: normals },
            { buffer: this.renderableBuffers.color, data: colors },
            { buffer: this.renderableBuffers.uv, data: uvs }
        ];

        for (const { buffer, data } of bufferUpdates) {
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        }

        // Update indices separately as it uses ELEMENT_ARRAY_BUFFER
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.renderableBuffers.indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        this.renderableIndexCount = indexCount;
        return indexCount;
    }

    deleteBuffers() {
        // Delete renderable buffers
        this.gl.deleteBuffer(this.renderableBuffers.position);
        this.gl.deleteBuffer(this.renderableBuffers.normal);
        this.gl.deleteBuffer(this.renderableBuffers.color);
        this.gl.deleteBuffer(this.renderableBuffers.indices);
    }

    getBufferInfo() {
        return {
            // Character buffers removed - characters now use standard rendering
            renderableBuffers: this.renderableBuffers,
            renderableIndexCount: this.renderableIndexCount
        };
    }
}