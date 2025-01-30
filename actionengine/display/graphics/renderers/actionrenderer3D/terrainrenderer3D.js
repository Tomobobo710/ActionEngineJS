// actionengine/display/graphics/renderers/actionrenderer3D/terrainrenderer3D.js
class TerrainRenderer3D {
    constructor(renderer, gl, programManager, lightingManager) {
        this.renderer = renderer;
        this.gl = gl;
        this.programManager = programManager;
        this.lightingManager = lightingManager;
    }

    renderShadowPass(terrainBuffers, terrainIndexCount, shaderSet) {
        this.gl.uniformMatrix4fv(
            shaderSet.shadow.locations.lightSpaceMatrix,
            false,
            this.lightingManager.getLightSpaceMatrix()
        );
        this.gl.uniformMatrix4fv(shaderSet.shadow.locations.modelMatrix, false, Matrix4.create());
        this.drawTerrain(shaderSet.shadow.locations, terrainBuffers, terrainIndexCount);
    }

    render(terrainBuffers, terrainIndexCount, camera, shaderSet, currentTime) {
        // Set up shared matrices
        const projection = Matrix4.perspective(Matrix4.create(), camera.fov, Game.WIDTH / Game.HEIGHT, 0.1, 10000.0);
        const view = Matrix4.create();
        Matrix4.lookAt(view, camera.position.toArray(), camera.target.toArray(), camera.up.toArray());
        const model = Matrix4.create();

        // Render terrain with shadow map if using PBR shader
        this.gl.useProgram(shaderSet.terrain.program);
        this.setupTerrainShader(shaderSet.terrain.locations, projection, view, model, camera);

        if (shaderSet === this.programManager.getProgramRegistry().shaders.get("pbr")) {
            // Bind shadow map texture
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.lightingManager.getShadowMap());
            this.gl.uniform1i(shaderSet.terrain.locations.shadowMap, 0);
        }
        if (shaderSet === this.programManager.getProgramRegistry().shaders.get("default")) {
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.renderer.textureManager.getGrassTexture());
            this.gl.uniform1i(shaderSet.terrain.locations.texture, 0);
            this.gl.uniform1i(shaderSet.terrain.locations.useTexture, 1);
        } else {
            // For all other shaders, set useTexture to 0
            this.gl.uniform1i(shaderSet.terrain.locations.useTexture, 0);
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

        // Add optional texture coordinate handling
        if (locations.texCoord !== undefined && locations.texCoord !== -1) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, terrainBuffers.uv);
            this.gl.vertexAttribPointer(locations.texCoord, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.enableVertexAttribArray(locations.texCoord);
        }

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, terrainBuffers.indices);
        this.gl.drawElements(this.gl.TRIANGLES, indexCount, this.gl.UNSIGNED_SHORT, 0);
    }
}