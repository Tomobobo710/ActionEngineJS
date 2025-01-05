// game/display/gl/shaders/defaultshader.js
class DefaultShader {
    getTerrainVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
        ${isWebGL2 ? "in" : "attribute"} vec3 aNormal;
        ${isWebGL2 ? "in" : "attribute"} vec3 aColor;
        
        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        uniform mat4 uModelMatrix;
        uniform vec3 uLightDir;
        
        ${isWebGL2 ? "flat out vec3 vColor;" : "varying vec3 vColor;"}
        
        void main() {
            gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
            
            vec3 worldNormal = normalize(mat3(uModelMatrix) * aNormal);
            float lighting = max(0.3, min(1.0, dot(worldNormal, normalize(uLightDir))));
            vColor = aColor * lighting;
        }`;
    }

    getTerrainFragmentShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        precision mediump float;
        ${isWebGL2 ? "flat in vec3 vColor;\nout vec4 fragColor;" : "varying vec3 vColor;"}
        
        void main() {
            ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(vColor, 1.0);
        }`;
    }

    getCharacterVertexShader() {
        if (this.isWebGL2) {
            return `#version 300 es
        in vec3 aPosition;
        in vec3 aNormal;
        in vec3 aColor;
        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        uniform mat4 uModelMatrix;
        flat out vec3 vColor;
        
        void main() {
            gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
            // Basic directional lighting calculated per vertex
            vec3 worldNormal = normalize(mat3(uModelMatrix) * aNormal);
            vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
            float diffuse = max(dot(worldNormal, lightDir), 0.0);
            vColor = aColor * (0.3 + 0.7 * diffuse);
        }`;
        } else {
            // Keep existing WebGL 1 vertex shader
            return `
        attribute vec3 aPosition;
        attribute vec3 aNormal;
        attribute vec3 aColor;
        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        uniform mat4 uModelMatrix;
        varying vec3 vNormal;
        varying vec3 vColor;
        
        void main() {
            gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
            vNormal = mat3(uModelMatrix) * aNormal;
            vColor = aColor;
        }`;
        }
    }

    getCharacterFragmentShader() {
        if (this.isWebGL2) {
            return `#version 300 es
        precision mediump float;
        flat in vec3 vColor;
        out vec4 fragColor;

        void main() {
            fragColor = vec4(vColor, 1.0);
        }`;
        } else {
            // Keep existing WebGL 1 fragment shader
            return `
        precision mediump float;
        varying vec3 vNormal;
        varying vec3 vColor;

        void main() {
            vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
            float diffuse = max(dot(normalize(vNormal), lightDir), 0.0);
            vec3 finalColor = vColor * (0.3 + 0.7 * diffuse);
            gl_FragColor = vec4(finalColor, 1.0);
        }`;
        }
    }

    getLineVertexShader() {
    return `${this.isWebGL2 ? "#version 300 es\n" : ""}
    ${this.isWebGL2 ? "in" : "attribute"} vec3 aPosition;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 1.0);
    }`;
}

getLineFragmentShader() {
    return `${this.isWebGL2 ? "#version 300 es\n" : ""}
    precision mediump float;
    uniform vec3 uColor;
    ${this.isWebGL2 ? "out vec4 fragColor;\n" : ""}
    void main() {
        ${this.isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(uColor, 1.0);
    }`;
}
}