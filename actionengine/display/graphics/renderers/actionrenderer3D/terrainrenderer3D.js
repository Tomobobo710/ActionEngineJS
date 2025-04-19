// actionengine/display/graphics/renderers/actionrenderer3D/terrainrenderer3D.js
class TerrainRenderer3D {
    constructor(renderer, gl, programManager, lightingManager) {
        this.renderer = renderer;
        this.gl = gl;
        this.programManager = programManager;
        this.lightingManager = lightingManager;
    }

    render(terrainBuffers, terrainIndexCount, camera, shaderSet, currentTime) {
        // Set up shared matrices
        const projection = Matrix4.perspective(Matrix4.create(), camera.fov, Game.WIDTH / Game.HEIGHT, 0.1, 10000.0);
        const view = Matrix4.create();
        Matrix4.lookAt(view, camera.position.toArray(), camera.target.toArray(), camera.up.toArray());
        const model = Matrix4.create();

        // Render terrain
        this.gl.useProgram(shaderSet.terrain.program);
        this.setupTerrainShader(shaderSet.terrain.locations, projection, view, model, camera);

        // If using default shader, set up texturing
        if (shaderSet === this.programManager.getProgramRegistry().shaders.get("default")) {
            // Bind texture array
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, this.renderer.textureManager.textureArray);
            this.gl.uniform1i(shaderSet.terrain.locations.textureArray, 0);
        }

        this.drawTerrain(shaderSet.terrain.locations, terrainBuffers, terrainIndexCount);
    }

    setupTerrainShader(locations, projection, view, model, camera) {
        this.gl.uniformMatrix4fv(locations.projectionMatrix, false, projection);
        this.gl.uniformMatrix4fv(locations.viewMatrix, false, view);
        this.gl.uniformMatrix4fv(locations.modelMatrix, false, model);

        // Light properties from LightingManager
        const config = this.lightingManager.getLightConfig();

        this.gl.uniform3fv(locations.lightPos, [config.POSITION.x, config.POSITION.y, config.POSITION.z]);
        this.gl.uniform3fv(locations.lightDir, this.lightingManager.getLightDir().toArray());
        this.gl.uniform1f(locations.lightIntensity, config.INTENSITY);

        // PBR material properties
        this.gl.uniform1f(locations.roughness, config.MATERIAL.ROUGHNESS);
        this.gl.uniform1f(locations.metallic, config.MATERIAL.METALLIC);
        this.gl.uniform1f(locations.baseReflectivity, config.MATERIAL.BASE_REFLECTIVITY);
    }

    drawTerrain(locations, terrainBuffers, indexCount) {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, terrainBuffers.position);
        this.gl.vertexAttribPointer(locations.position, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(locations.position);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, terrainBuffers.normal);
        this.gl.vertexAttribPointer(locations.normal, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(locations.normal);

        if (locations.color !== -1) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, terrainBuffers.color);
            this.gl.vertexAttribPointer(locations.color, 3, this.gl.FLOAT, false, 0, 0);
            this.gl.enableVertexAttribArray(locations.color);
        }

        // Set up texture coordinates if they exist
        if (locations.texCoord !== undefined && locations.texCoord !== -1) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, terrainBuffers.uv);
            this.gl.vertexAttribPointer(locations.texCoord, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.enableVertexAttribArray(locations.texCoord);
        }

        // Set up texture index attribute
        if (locations.textureIndex !== undefined && locations.textureIndex !== -1) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, terrainBuffers.textureIndex);
            this.gl.vertexAttribPointer(locations.textureIndex, 1, this.gl.FLOAT, false, 0, 0);
            this.gl.enableVertexAttribArray(locations.textureIndex);
        }

        // Set default value of 0 for useTexture if it's not bound
        if (locations.useTexture !== undefined && locations.useTexture !== -1) {
            if (terrainBuffers.useTexture) {
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, terrainBuffers.useTexture);
                this.gl.vertexAttribPointer(locations.useTexture, 1, this.gl.FLOAT, false, 0, 0);
                this.gl.enableVertexAttribArray(locations.useTexture);
            } else {
                this.gl.vertexAttrib1f(locations.useTexture, 0.0);
            }
        }

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, terrainBuffers.indices);
        this.gl.drawElements(this.gl.TRIANGLES, indexCount, this.gl.UNSIGNED_SHORT, 0);
    }
}