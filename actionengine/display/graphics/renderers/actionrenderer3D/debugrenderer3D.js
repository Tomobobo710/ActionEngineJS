// actionengine/display/graphics/renderers/actionrenderer3D/debugrenderer3D.js
class DebugRenderer3D {
    constructor(gl, programManager, lightingManager) {
        this.gl = gl;
        this.programManager = programManager;
        this.lightingManager = lightingManager;

        // Create buffer for direction indicators
        this.directionBuffer = this.gl.createBuffer();
        
        
        // Line buffer for drawing
        this.directionBuffer = this.gl.createBuffer();
        
    }
    
    
    drawDebugLines(camera, character, currentTime) {
    if (!character) return;
    
    // Clear previous data
    const shaderSet = this.programManager.getProgramRegistry().getCurrentShaderSet();
    const currentTriangle = character.getCurrentTriangle();
    
    if (currentTriangle) {
        this.drawTriangleNormal(currentTriangle, camera, shaderSet.lines, currentTime);
    }

    // Draw other debug stuff if needed
    if (character) {
        if (currentTriangle) {
            this.drawTriangleNormal(currentTriangle, camera, shaderSet.lines, currentTime);
        }
        this.drawDirectionIndicator(character, camera, shaderSet.lines, currentTime);
    }
}

    drawTriangleNormal(triangle, camera, lineShader, currentTime) {
        // Calculate triangle center
        const v1 = triangle.vertices[0];
        const v2 = triangle.vertices[1];
        const v3 = triangle.vertices[2];
        const center = [(v1.x + v2.x + v3.x) / 3, (v1.y + v2.y + v3.y) / 3, (v1.z + v2.z + v3.z) / 3];

        // Create normal line
        const normalLength = 10;
        const end = [
            center[0] + triangle.normal.x * normalLength,
            center[1] + triangle.normal.y * normalLength,
            center[2] + triangle.normal.z * normalLength
        ];

        this.drawLine(center, end, camera, lineShader, currentTime);
    }

    drawDirectionIndicator(character, camera, lineShader, currentTime) {
        const center = character.position;
        const directionEnd = new Vector3(
            center.x + character.facingDirection.x * character.size * 2,
            center.y,
            center.z + character.facingDirection.z * character.size * 2
        );

        this.drawLine(center.toArray(), directionEnd.toArray(), camera, lineShader, currentTime);
    }

    drawLine(start, end, camera, lineShader, currentTime) {
        const lineVerts = new Float32Array([...start, ...end]);

        this.gl.useProgram(lineShader.program);

        // Set up matrices
        const projection = Matrix4.perspective(Matrix4.create(), camera.fov, Game.WIDTH / Game.HEIGHT, 0.1, 10000.0);
        const view = Matrix4.create();
        Matrix4.lookAt(view, camera.position.toArray(), camera.target.toArray(), camera.up.toArray());

        this.gl.uniformMatrix4fv(lineShader.locations.projectionMatrix, false, projection);
        this.gl.uniformMatrix4fv(lineShader.locations.viewMatrix, false, view);
        this.gl.uniform3f(lineShader.locations.color, 0.2, 0.2, 1.0);
        lineShader.locations.color = this.gl.getUniformLocation(lineShader.program, "uColor");
        // Buffer and draw the line
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.directionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, lineVerts, this.gl.STATIC_DRAW);
        
        this.gl.vertexAttribPointer(lineShader.locations.position, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(lineShader.locations.position);

        this.gl.drawArrays(this.gl.LINES, 0, 2);
    }
}