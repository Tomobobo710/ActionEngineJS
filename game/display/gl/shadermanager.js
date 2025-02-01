// game/display/gl/shadermanager.js
class ShaderManager {
    constructor(gl) {
        this.gl = gl;
        this.isWebGL2 = gl.getParameter(gl.VERSION).includes("WebGL 2.0");

        // Initialize buffers
        this.terrainBuffers = this.createBuffers();
        this.characterBuffers = this.createBuffers();
        this.renderableBuffers = this.createBuffers();

        this.terrainIndexCount = 0;
        this.characterIndexCount = 0;
        this.renderableIndexCount = 0;
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
                terrain: {
                    vertex: shader.getTerrainVertexShader?.(this.isWebGL2),
                    fragment: shader.getTerrainFragmentShader?.(this.isWebGL2)
                },
                character: {
                    vertex: shader.getCharacterVertexShader?.(this.isWebGL2),
                    fragment: shader.getCharacterFragmentShader?.(this.isWebGL2)
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

        const terrainVertex = this.getShader("TerrainVertex", name);
        const terrainFragment = this.getShader("TerrainFragment", name);
        if (terrainVertex && terrainFragment) {
            shaderSet.terrain = {
                vertex: terrainVertex,
                fragment: terrainFragment
            };
        }

        const characterVertex = this.getShader("CharacterVertex", name);
        const characterFragment = this.getShader("CharacterFragment", name);
        if (characterVertex && characterFragment) {
            shaderSet.character = {
                vertex: characterVertex,
                fragment: characterFragment
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

    updateTerrainBuffers(terrain) {
        const positions = [];
        const normals = [];
        const colors = [];
        const uvs = [];
        const textureIndices = [];
        const useTextureFlags = []; // New array

        terrain.triangles.forEach((triangle, i) => {
            // Add positions, normals, colors as before
            positions.push(...triangle.getVertexArray());
            normals.push(...triangle.getNormalArray());
            colors.push(...triangle.getColorArray());

            if (triangle.texture) {
                // Add UVs if the triangle has a texture
                if (triangle.uvs) {
                    triangle.uvs.forEach((uv) => {
                        uvs.push(uv.u, uv.v);
                    });
                } else {
                    // Default UVs if none specified
                    uvs.push(0, 0, 1, 0, 0.5, 1);
                }

                // Get texture index for textured triangles
                const textureIndex = this.getTextureIndexForProceduralTexture(triangle.texture);
                textureIndices.push(textureIndex, textureIndex, textureIndex);
                useTextureFlags.push(1, 1, 1);
            } else {
                // Push dummy UVs and texture index since we won't use them
                uvs.push(0, 0, 0, 0, 0, 0);
                textureIndices.push(0, 0, 0);
                useTextureFlags.push(0, 0, 0);
            }
        });

        // Update all buffers
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.terrainBuffers.position);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.terrainBuffers.normal);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(normals), this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.terrainBuffers.color);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.terrainBuffers.uv);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(uvs), this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.terrainBuffers.textureIndex);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(textureIndices), this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.terrainBuffers.useTexture);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(useTextureFlags), this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.terrainBuffers.indices);
        const indices = new Uint16Array(terrain.triangles.length * 3);
        for (let i = 0; i < indices.length; i++) {
            indices[i] = i;
        }
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW);

        this.terrainIndexCount = indices.length;
        return this.terrainIndexCount;
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
    updateCharacterBuffers(character) {
        const characterModel = character.getCharacterModelTriangles();

        const vertices = new Float32Array(characterModel.flatMap((triangle) => triangle.getVertexArray()));
        const normals = new Float32Array(characterModel.flatMap((triangle) => triangle.getNormalArray()));
        const colors = new Float32Array(characterModel.flatMap((triangle) => triangle.getColorArray()));

        const indices = new Uint16Array(characterModel.length * 3);
        for (let i = 0; i < indices.length; i++) {
            indices[i] = i;
        }

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.characterBuffers.position);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.characterBuffers.normal);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, normals, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.characterBuffers.color);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, colors, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.characterBuffers.indices);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW);

        this.characterIndexCount = indices.length;
        return this.characterIndexCount;
    }

    updateRenderableBuffers(renderable) {
        const positions = new Float32Array(renderable.triangles.length * 9);
        const normals = new Float32Array(renderable.triangles.length * 9);
        const colors = new Float32Array(renderable.triangles.length * 9);

        renderable.triangles.forEach((triangle, i) => {
            const baseIndex = i * 9;

            for (let j = 0; j < 3; j++) {
                positions[baseIndex + j * 3] = triangle.vertices[j].x;
                positions[baseIndex + j * 3 + 1] = triangle.vertices[j].y;
                positions[baseIndex + j * 3 + 2] = triangle.vertices[j].z;

                normals[baseIndex + j * 3] = triangle.normal.x;
                normals[baseIndex + j * 3 + 1] = triangle.normal.y;
                normals[baseIndex + j * 3 + 2] = triangle.normal.z;
            }

            const r = parseInt(triangle.color.substr(1, 2), 16) / 255;
            const g = parseInt(triangle.color.substr(3, 2), 16) / 255;
            const b = parseInt(triangle.color.substr(5, 2), 16) / 255;

            for (let j = 0; j < 3; j++) {
                colors[baseIndex + j * 3] = r;
                colors[baseIndex + j * 3 + 1] = g;
                colors[baseIndex + j * 3 + 2] = b;
            }
        });

        const indices = new Uint16Array(renderable.triangles.length * 3);
        for (let i = 0; i < indices.length; i++) {
            indices[i] = i;
        }
        const uvs = new Float32Array(renderable.triangles.length * 6);
        uvs.fill(0); // Fill with zeros since they won't be used anyway

        // Use the existing buffers!
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.renderableBuffers.position);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.renderableBuffers.normal);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, normals, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.renderableBuffers.color);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, colors, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.renderableBuffers.indices);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.renderableBuffers.uv);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, uvs, this.gl.STATIC_DRAW);

        this.renderableIndexCount = indices.length;
        return this.renderableIndexCount;
    }

    deleteBuffers() {
        // Delete terrain buffers
        this.gl.deleteBuffer(this.terrainBuffers.position);
        this.gl.deleteBuffer(this.terrainBuffers.normal);
        this.gl.deleteBuffer(this.terrainBuffers.color);
        this.gl.deleteBuffer(this.terrainBuffers.indices);

        // Delete character buffers
        this.gl.deleteBuffer(this.characterBuffers.position);
        this.gl.deleteBuffer(this.characterBuffers.normal);
        this.gl.deleteBuffer(this.characterBuffers.color);
        this.gl.deleteBuffer(this.characterBuffers.indices);

        // Delete renderable buffers
        this.gl.deleteBuffer(this.renderableBuffers.position);
        this.gl.deleteBuffer(this.renderableBuffers.normal);
        this.gl.deleteBuffer(this.renderableBuffers.color);
        this.gl.deleteBuffer(this.renderableBuffers.indices);
    }

    getBufferInfo() {
        return {
            terrainBuffers: this.terrainBuffers,
            terrainIndexCount: this.terrainIndexCount,
            characterBuffers: this.characterBuffers,
            characterIndexCount: this.characterIndexCount,
            renderableBuffers: this.renderableBuffers,
            renderableIndexCount: this.renderableIndexCount
        };
    }
}