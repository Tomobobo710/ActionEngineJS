class CharacterRenderer3D {
    constructor(gl, programManager, lightingManager) {
        this.gl = gl;
        this.programManager = programManager;
        this.programRegistry = programManager.getProgramRegistry();
        this.lightingManager = lightingManager;
    }
    
    render(character, characterBuffers, characterIndexCount, camera, shaderSet, currentTime, renderer) {
        if (!character) return;

        // Set up shared matrices
        const projection = Matrix4.perspective(Matrix4.create(), camera.fov, Game.WIDTH / Game.HEIGHT, 0.1, 10000.0);
        const view = Matrix4.create();
        Matrix4.lookAt(view, camera.position.toArray(), camera.target.toArray(), camera.up.toArray());

        this.gl.useProgram(shaderSet.character.program);
        this.setupCharacterShader(
            shaderSet.character.locations, 
            projection, 
            view, 
            character.getModelMatrix(),
            camera,
            currentTime
        );
        
        // Set up texturing for any shader that needs it
        const isPBRShader = this.programRegistry?.shaders.get("pbr") === shaderSet;
        const isDefaultShader = this.programRegistry?.shaders.get("default") === shaderSet;
        
        // Handle default shader textures
        if (isDefaultShader && 
            shaderSet.character.locations.textureArray !== undefined && 
            shaderSet.character.locations.textureArray !== null &&
            shaderSet.character.locations.textureArray !== -1 &&
            renderer && renderer.textureArray) {
            // Bind texture array
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, renderer.textureArray);
            this.gl.uniform1i(shaderSet.character.locations.textureArray, 0);
        }
        
        // Handle PBR shader textures
        if (isPBRShader && 
            shaderSet.character.locations.textureArray !== undefined && 
            shaderSet.character.locations.textureArray !== null &&
            shaderSet.character.locations.textureArray !== -1 &&
            renderer && renderer.textureArray) {
            // Bind texture array to a different texture unit
            this.gl.activeTexture(this.gl.TEXTURE1);
            this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, renderer.textureArray);
            this.gl.uniform1i(shaderSet.character.locations.textureArray, 1);
        }
        
        this.drawCharacter(shaderSet.character.locations, characterBuffers, characterIndexCount);
    }

    setupCharacterShader(locations, projection, view, modelMatrix, camera, currentTime) {
        this.gl.uniformMatrix4fv(locations.projectionMatrix, false, projection);
        this.gl.uniformMatrix4fv(locations.viewMatrix, false, view);
        this.gl.uniformMatrix4fv(locations.modelMatrix, false, modelMatrix);

        // Set camera position if available
        if (locations.cameraPos !== undefined && locations.cameraPos !== null && locations.cameraPos !== -1) {
            this.gl.uniform3fv(locations.cameraPos, camera.position.toArray());
        }

        // Set lighting properties if available
        const config = this.lightingManager.getLightConfig();
        
        if (locations.lightDir !== undefined && locations.lightDir !== null && locations.lightDir !== -1) {
            this.gl.uniform3fv(locations.lightDir, this.lightingManager.getLightDir().toArray());
        }

        // Set PBR material properties if available
        if (locations.roughness !== undefined && locations.roughness !== null && locations.roughness !== -1) {
            this.gl.uniform1f(locations.roughness, config.MATERIAL.ROUGHNESS);
        }

        if (locations.metallic !== undefined && locations.metallic !== null && locations.metallic !== -1) {
            this.gl.uniform1f(locations.metallic, config.MATERIAL.METALLIC);
        }

        // Set time uniform if it exists for this shader
        if (locations.time !== undefined && locations.time !== null && locations.time !== -1) {
            this.gl.uniform1f(locations.time, currentTime);
        }
    }

    drawCharacter(locations, characterBuffers, indexCount) {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, characterBuffers.position);
        this.gl.vertexAttribPointer(locations.position, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(locations.position);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, characterBuffers.normal);
        this.gl.vertexAttribPointer(locations.normal, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(locations.normal);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, characterBuffers.color);
        this.gl.vertexAttribPointer(locations.color, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(locations.color);
        
        // Set default values for texture attributes
        if (locations.texCoord !== undefined && locations.texCoord !== null && locations.texCoord !== -1) {
            this.gl.disableVertexAttribArray(locations.texCoord);
            this.gl.vertexAttrib2f(locations.texCoord, 0.0, 0.0);
        }

        if (locations.textureIndex !== undefined && locations.textureIndex !== null && locations.textureIndex !== -1) {
            this.gl.disableVertexAttribArray(locations.textureIndex);
            this.gl.vertexAttrib1f(locations.textureIndex, 0.0);
        }

        if (locations.useTexture !== undefined && locations.useTexture !== null && locations.useTexture !== -1) {
            this.gl.disableVertexAttribArray(locations.useTexture);
            this.gl.vertexAttrib1f(locations.useTexture, 0.0);
        }

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, characterBuffers.indices);
        this.gl.drawElements(this.gl.TRIANGLES, indexCount, this.gl.UNSIGNED_SHORT, 0);
    }
}