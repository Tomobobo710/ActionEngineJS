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

    deleteBuffers() {
        // Delete renderable buffers
        this.gl.deleteBuffer(this.renderableBuffers.position);
        this.gl.deleteBuffer(this.renderableBuffers.normal);
        this.gl.deleteBuffer(this.renderableBuffers.color);
        this.gl.deleteBuffer(this.renderableBuffers.indices);
    }

    getBufferInfo() {
        return {
            renderableBuffers: this.renderableBuffers,
            renderableIndexCount: this.renderableIndexCount
        };
    }
}