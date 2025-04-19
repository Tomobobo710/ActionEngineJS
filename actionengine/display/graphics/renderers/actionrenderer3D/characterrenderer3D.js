class CharacterRenderer3D {
    constructor(gl, programManager, lightingManager) {
        this.gl = gl;
        this.programManager = programManager;
        this.lightingManager = lightingManager;
    }
    
    render(character, characterBuffers, characterIndexCount, camera, shaderSet, currentTime) {
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
            currentTime
        );
        this.drawCharacter(shaderSet.character.locations, characterBuffers, characterIndexCount);
    }

    setupCharacterShader(locations, projection, view, modelMatrix, currentTime) {
        this.gl.uniformMatrix4fv(locations.projectionMatrix, false, projection);
        this.gl.uniformMatrix4fv(locations.viewMatrix, false, view);
        this.gl.uniformMatrix4fv(locations.modelMatrix, false, modelMatrix);

        // Set time uniform if it exists for this shader
        if (locations.time !== undefined) {
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

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, characterBuffers.indices);
        this.gl.drawElements(this.gl.TRIANGLES, indexCount, this.gl.UNSIGNED_SHORT, 0);
    }
}