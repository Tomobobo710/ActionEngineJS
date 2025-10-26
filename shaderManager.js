import { WebGLUtils } from './webglUtils.js';

// Shader Manager for WebGL shader creation and management
export class ShaderManager {
    constructor(gl) {
        this.gl = gl;
        this.shaders = new Map();
    }

    createBasicShaders() {
        const vertexShaderSource = `
            attribute vec4 aVertexPosition;
            attribute vec3 aVertexNormal;
            attribute vec3 aVertexColor;

            uniform mat4 uModelMatrix;
            uniform mat4 uViewMatrix;
            uniform mat4 uProjectionMatrix;

            varying vec3 vNormal;
            varying vec3 vColor;

            void main() {
                gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * aVertexPosition;
                vNormal = mat3(uModelMatrix) * aVertexNormal;
                vColor = aVertexColor;
            }
        `;

        const fragmentShaderSource = `
            precision mediump float;

            varying vec3 vNormal;
            varying vec3 vColor;

            uniform vec3 uLightDirection;

            void main() {
                vec3 normal = normalize(vNormal);
                float light = max(dot(normal, normalize(uLightDirection)), 0.0);
                vec3 ambient = vColor * 0.3;
                vec3 diffuse = vColor * light * 0.7;
                gl_FragColor = vec4(ambient + diffuse, 1.0);
            }
        `;

        this.shaders.set('basic', {
            vertex: vertexShaderSource,
            fragment: fragmentShaderSource
        });

        return { vertex: vertexShaderSource, fragment: fragmentShaderSource };
    }

    createProjectionMatrix(canvasWidth, canvasHeight) {
        const projectionMatrix = window.Matrix4 ? window.Matrix4.create() : new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        if (window.Matrix4) {
            window.Matrix4.perspective(
                projectionMatrix,
                (60 * Math.PI) / 180, // 60 degrees FOV
                canvasWidth / canvasHeight,
                0.1,
                1000.0
            );
        }
        return projectionMatrix;
    }

}