import { WebGLUtils } from './webglUtils.js';

// Renderer class to handle WebGL rendering
export class Renderer {
    constructor(gl) {
        this.gl = gl;
        this.shaderPrograms = {};
    }

    initGL() {
        const gl = this.gl;

        // Configure WebGL
        gl.clearColor(0.6, 0.8, 1.0, 1.0); // Sky blue
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
    }

    addShaderProgram(name, vsSource, fsSource) {
        this.shaderPrograms[name] = WebGLUtils.createShaderProgram(this.gl, vsSource, fsSource);
        return this.shaderPrograms[name];
    }

    getShaderProgram(name) {
        return this.shaderPrograms[name];
    }

    setupShader(programName, modelMatrix, viewMatrix, projectionMatrix, lightDirection = [0.5, 1.0, 0.5]) {
        const gl = this.gl;
        const program = this.shaderPrograms[programName];

        gl.useProgram(program);

        // Set uniforms
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "uModelMatrix"), false, modelMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "uViewMatrix"), false, viewMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "uProjectionMatrix"), false, projectionMatrix);
        gl.uniform3fv(gl.getUniformLocation(program, "uLightDirection"), lightDirection);
    }

    drawMesh(mesh, programName, modelMatrix, viewMatrix, projectionMatrix, lightDirection = [0.5, 1.0, 0.5]) {
        const gl = this.gl;
        const program = this.shaderPrograms[programName];

        // Setup shader and uniforms
        this.setupShader(programName, modelMatrix, viewMatrix, projectionMatrix, lightDirection);

        // Bind vertex attributes
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
        const vertexPositionLocation = gl.getAttribLocation(program, "aVertexPosition");
        gl.vertexAttribPointer(vertexPositionLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vertexPositionLocation);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
        const vertexNormalLocation = gl.getAttribLocation(program, "aVertexNormal");
        gl.vertexAttribPointer(vertexNormalLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vertexNormalLocation);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colorBuffer);
        const vertexColorLocation = gl.getAttribLocation(program, "aVertexColor");
        gl.vertexAttribPointer(vertexColorLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vertexColorLocation);

        // Draw the mesh
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
        gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    clear(r = 0.6, g = 0.8, b = 1.0, a = 1.0) {
        const gl = this.gl;
        gl.clearColor(r, g, b, a);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
}