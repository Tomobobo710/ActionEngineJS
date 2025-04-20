// game/display/gl/shaders/defaultshader.js
class DefaultShader {
    getStandardVertexShader(isWebGL2) { // Renamed from getTerrainVertexShader
        return `#version 300 es
    in vec3 aPosition;
    in vec3 aNormal;
    in vec3 aColor;
    in vec2 aTexCoord;
    in float aTextureIndex;
    in float aUseTexture;  // New attribute
    
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;
    uniform vec3 uLightDir;
    
    flat out vec3 vColor;
    out vec2 vTexCoord;
    out float vLighting;
    flat out float vTextureIndex;
    flat out float vUseTexture;  // Pass to fragment shader
    
    void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
        
        vec3 worldNormal = normalize(mat3(uModelMatrix) * aNormal);
        vLighting = max(0.3, min(1.0, dot(worldNormal, normalize(uLightDir))));
        vColor = aColor;
        vTexCoord = aTexCoord;
        vTextureIndex = aTextureIndex;
        vUseTexture = aUseTexture;
    }`;
    }

    getStandardFragmentShader(isWebGL2) { // Renamed from getTerrainFragmentShader
        return `#version 300 es
    precision mediump float;
    precision mediump sampler2DArray;
    
    flat in vec3 vColor;
    in vec2 vTexCoord;
    in float vLighting;
    flat in float vTextureIndex;
    flat in float vUseTexture;
    
    uniform sampler2DArray uTextureArray;
    
    out vec4 fragColor;
    
    void main() {
        if (vUseTexture == 1.0) {  // Check if this vertex uses texture
            vec4 texColor = texture(uTextureArray, vec3(vTexCoord, vTextureIndex));
            fragColor = texColor * vec4(vec3(vLighting), 1.0);
        } else {
            fragColor = vec4(vColor * vLighting, 1.0);
        }
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