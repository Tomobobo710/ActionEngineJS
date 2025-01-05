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

    renderShadowPass(object, renderableBuffers, renderableIndexCount, shaderSet) {
        this.gl.uniformMatrix4fv(
            shaderSet.shadow.locations.lightSpaceMatrix,
            false,
            this.lightingManager.getLightSpaceMatrix()
        );
        this.gl.uniformMatrix4fv(shaderSet.shadow.locations.modelMatrix, false, object.getModelMatrix());
        this.drawObject(shaderSet.shadow.locations, renderableBuffers, renderableIndexCount);
    }

    render(object, camera, shaderSet, currentTime) {
        // Update buffers for this specific object
        const positions = new Float32Array(object.triangles.length * 9);
        const normals = new Float32Array(object.triangles.length * 9);
        const colors = new Float32Array(object.triangles.length * 9);
        
        object.triangles.forEach((triangle, i) => {
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

        const indices = new Uint16Array(object.triangles.length * 3);
        for (let i = 0; i < indices.length; i++) {
            indices[i] = i;
        }

        // Update buffers with this object's data
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.position);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.normal);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, normals, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.color);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, colors, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW);

        // Set up matrices and render
        const projection = Matrix4.perspective(Matrix4.create(), camera.fov, Game.WIDTH / Game.HEIGHT, 0.1, 10000.0);
        const view = Matrix4.create();
        Matrix4.lookAt(view, camera.position.toArray(), camera.target.toArray(), camera.up.toArray());
        const model = Matrix4.create(); // Identity matrix for now

        this.gl.useProgram(shaderSet.terrain.program);
        this.setupObjectShader(shaderSet.terrain.locations, projection, view, model, camera);

        if (shaderSet === this.programManager.getProgramRegistry().shaders.get("pbr")) {
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.lightingManager.getShadowMap());
            this.gl.uniform1i(shaderSet.terrain.locations.shadowMap, 0);
        }

        // Draw this object
        this.drawObject(shaderSet.terrain.locations, indices.length);
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
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.position);
        this.gl.vertexAttribPointer(locations.position, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(locations.position);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.normal);
        this.gl.vertexAttribPointer(locations.normal, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(locations.normal);

        if (locations.color !== -1) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.color);
            this.gl.vertexAttribPointer(locations.color, 3, this.gl.FLOAT, false, 0, 0);
            this.gl.enableVertexAttribArray(locations.color);
        }

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
        this.gl.drawElements(this.gl.TRIANGLES, indexCount, this.gl.UNSIGNED_SHORT, 0);
    }
}