// actionengine/display/graphics/renderers/actionrenderer3D/sunrenderer3D.js
class SunRenderer3D {
    constructor(gl, programManager) {
        this.gl = gl;
        this.programManager = programManager;
        
        // Create shader program for the sun
        this.createShaderProgram();
        
        // Create sun point buffer
        this.createSunBuffer();
    }
    
    createShaderProgram() {
        // Simple vertex shader with point size
        const vsSource = `#version 300 es
        in vec3 aPosition;
        
        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        uniform float uPointSize;
        
        void main() {
            gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 1.0);
            gl_PointSize = uPointSize;
        }`;
        
        // Fragment shader with a circular point
        const fsSource = `#version 300 es
        precision mediump float;
        
        uniform vec3 uSunColor;
        out vec4 fragColor;
        
        void main() {
            // Calculate distance from center of point
            vec2 coord = gl_PointCoord - vec2(0.5);
            float distance = length(coord);
            
            // Create a soft circle
            float alpha = 1.0 - smoothstep(0.0, 0.5, distance);
            
            // Sun color with alpha based on distance
            fragColor = vec4(uSunColor, alpha);
        }`;
        
        // Create shader program
        const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fsSource);
        
        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);
        
        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            console.error('Unable to initialize sun shader program:', this.gl.getProgramInfoLog(this.program));
            return;
        }
        
        // Get attribute and uniform locations
        this.locations = {
            position: this.gl.getAttribLocation(this.program, 'aPosition'),
            projectionMatrix: this.gl.getUniformLocation(this.program, 'uProjectionMatrix'),
            viewMatrix: this.gl.getUniformLocation(this.program, 'uViewMatrix'),
            pointSize: this.gl.getUniformLocation(this.program, 'uPointSize'),
            sunColor: this.gl.getUniformLocation(this.program, 'uSunColor')
        };
    }
    
    compileShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }
    
    createSunBuffer() {
        // Create a buffer for a single point
        this.sunBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.sunBuffer);
        
        // Just one point at origin, will be positioned later
        const position = new Float32Array([0, 0, 0]);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, position, this.gl.STATIC_DRAW);
    }
    
    render(camera, lightPos, isVirtualBoyShaderSet) {
        const gl = this.gl;
        
        // Use our sun shader program
        gl.useProgram(this.program);
        
        // Set matrices
        const projectionMatrix = Matrix4.perspective(Matrix4.create(), camera.fov, Game.WIDTH / Game.HEIGHT, 0.1, 100000.0);
        const viewMatrix = Matrix4.create();
        Matrix4.lookAt(viewMatrix, camera.position.toArray(), camera.target.toArray(), camera.up.toArray());
        
        gl.uniformMatrix4fv(this.locations.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(this.locations.viewMatrix, false, viewMatrix);
        
        // Set sun color based on active shader
        if (isVirtualBoyShaderSet) {
            // Red for VirtualBoy shader set
            gl.uniform3f(this.locations.sunColor, 1.0, 0.0, 0.0);
        } else {
            // Default yellow-orange
            gl.uniform3f(this.locations.sunColor, 1.0, 0.9, 0.5);
        }
        
        // Set point size (5x smaller as requested)
        gl.uniform1f(this.locations.pointSize, 100.0);
        
        // Bind position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.sunBuffer);
        gl.vertexAttribPointer(this.locations.position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.locations.position);
        
        // Update the buffer with the sun position
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array([lightPos.x, lightPos.y, lightPos.z]));
        
        // Enable blending
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        // Draw the sun as a point
        gl.drawArrays(gl.POINTS, 0, 1);
        
        // Clean up
        gl.disable(gl.BLEND);
        gl.disableVertexAttribArray(this.locations.position);
    }
}