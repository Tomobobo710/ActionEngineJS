// actionengine/display/graphics/renderers/actionrenderer3D/objectrenderer3D.js
class ObjectRenderer3D {
    constructor(renderer, gl, programManager, lightingManager) {
        this.renderer = renderer;
        this.gl = gl;
        this.programManager = programManager;
        this.lightingManager = lightingManager;

        // Create buffer for each renderable object
        this.buffers = {
            position: this.gl.createBuffer(),
            normal: this.gl.createBuffer(),
            color: this.gl.createBuffer(),
            indices: this.gl.createBuffer()
        };
    }

    render(object, camera, shaderSet, currentTime) {
        const triangleCount = object.triangles.length;
        const vertexCount = triangleCount * 9;

        // Preallocate arrays once and reuse them if size hasn't changed
        if (!this.cachedArrays || this.cachedArrays.positions.length !== vertexCount) {
            this.cachedArrays = {
                positions: new Float32Array(vertexCount),
                normals: new Float32Array(vertexCount),
                colors: new Float32Array(vertexCount),
                indices: new Uint16Array(triangleCount * 3)
            };

            // Indices array can be initialized once since it's always sequential
            for (let i = 0; i < this.cachedArrays.indices.length; i++) {
                this.cachedArrays.indices[i] = i;
            }
        }

        const { positions, normals, colors, indices } = this.cachedArrays;

        // Use for loop instead of forEach for better performance
        for (let i = 0; i < triangleCount; i++) {
            const triangle = object.triangles[i];
            const baseIndex = i * 9;

            // Cache color conversion
            const color = triangle.color;
            if (color !== triangle.lastColor) {
                triangle.cachedColor = {
                    r: parseInt(color.substr(1, 2), 16) / 255,
                    g: parseInt(color.substr(3, 2), 16) / 255,
                    b: parseInt(color.substr(5, 2), 16) / 255
                };
                triangle.lastColor = color;
            }
            const { r, g, b } = triangle.cachedColor;

            // Batch vertex operations
            for (let j = 0; j < 3; j++) {
                const vertexOffset = baseIndex + j * 3;
                const vertex = triangle.vertices[j];

                // Position
                positions[vertexOffset] = vertex.x;
                positions[vertexOffset + 1] = vertex.y;
                positions[vertexOffset + 2] = vertex.z;

                // Normal
                normals[vertexOffset] = triangle.normal.x;
                normals[vertexOffset + 1] = triangle.normal.y;
                normals[vertexOffset + 2] = triangle.normal.z;

                // Color
                colors[vertexOffset] = r;
                colors[vertexOffset + 1] = g;
                colors[vertexOffset + 2] = b;
            }
        }

        // Cache GL context and commonly used values
        const gl = this.gl;
        const ARRAY_BUFFER = gl.ARRAY_BUFFER;
        const STATIC_DRAW = gl.STATIC_DRAW;

        // Batch buffer updates
        const bufferUpdates = [
            { buffer: this.buffers.position, data: positions },
            { buffer: this.buffers.normal, data: normals },
            { buffer: this.buffers.color, data: colors }
        ];

        for (const { buffer, data } of bufferUpdates) {
            gl.bindBuffer(ARRAY_BUFFER, buffer);
            gl.bufferData(ARRAY_BUFFER, data, STATIC_DRAW);
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, STATIC_DRAW);

        // Cache matrix operations
        const projection = Matrix4.perspective(
            this.cachedProjection || (this.cachedProjection = Matrix4.create()),
            camera.fov,
            Game.WIDTH / Game.HEIGHT,
            0.1,
            10000.0
        );

        const view = this.cachedView || (this.cachedView = Matrix4.create());
        Matrix4.lookAt(view, camera.position.toArray(), camera.target.toArray(), camera.up.toArray());

        const model = this.cachedModel || (this.cachedModel = Matrix4.create());

        // Setup shader and draw
        const terrainProgram = shaderSet.terrain;
        gl.useProgram(terrainProgram.program);
        this.setupObjectShader(terrainProgram.locations, projection, view, model, camera);

        this.drawObject(terrainProgram.locations, indices.length);
    }

    setupObjectShader(locations, projection, view, model, camera) {
        this.gl.uniformMatrix4fv(locations.projectionMatrix, false, projection);
        this.gl.uniformMatrix4fv(locations.viewMatrix, false, view);
        this.gl.uniformMatrix4fv(locations.modelMatrix, false, model);

        const config = this.lightingManager.getLightConfig();
        this.gl.uniform3fv(locations.lightPos, [config.POSITION.x, config.POSITION.y, config.POSITION.z]);
        this.gl.uniform3fv(locations.lightDir, this.lightingManager.getLightDir().toArray());
        this.gl.uniform1f(locations.lightIntensity, config.INTENSITY);

        this.gl.uniform1f(locations.roughness, config.MATERIAL.ROUGHNESS);
        this.gl.uniform1f(locations.metallic, config.MATERIAL.METALLIC);
        this.gl.uniform1f(locations.baseReflectivity, config.MATERIAL.BASE_REFLECTIVITY);
    }

    drawObject(locations, indexCount) {
        // Position attribute
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.position);
        this.gl.vertexAttribPointer(locations.position, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(locations.position);

        // Normal attribute
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.normal);
        this.gl.vertexAttribPointer(locations.normal, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(locations.normal);

        // Color attribute
        if (locations.color !== -1) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.color);
            this.gl.vertexAttribPointer(locations.color, 3, this.gl.FLOAT, false, 0, 0);
            this.gl.enableVertexAttribArray(locations.color);
        }

        // Set default values for texture attributes without creating buffers
        if (locations.useTexture !== -1) {
            this.gl.disableVertexAttribArray(locations.useTexture);
            this.gl.vertexAttrib1f(locations.useTexture, 0.0);
        }

        if (locations.textureIndex !== -1) {
            this.gl.disableVertexAttribArray(locations.textureIndex);
            this.gl.vertexAttrib1f(locations.textureIndex, 0.0);
        }

        if (locations.texCoord !== -1) {
            this.gl.disableVertexAttribArray(locations.texCoord);
            this.gl.vertexAttrib2f(locations.texCoord, 0.0, 0.0);
        }

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
        this.gl.drawElements(this.gl.TRIANGLES, indexCount, this.gl.UNSIGNED_SHORT, 0);
    }
}