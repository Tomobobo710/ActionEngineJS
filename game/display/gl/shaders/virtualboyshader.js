// game/display/gl/shaders/virtualboyshader.js
class VirtualBoyShader {
    getTerrainVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
        ${isWebGL2 ? "in" : "attribute"} vec3 aNormal;
        ${isWebGL2 ? "in" : "attribute"} vec3 aColor;
        
        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        uniform mat4 uModelMatrix;
        uniform vec3 uLightDir;
        
        ${isWebGL2 ? "flat out float vLighting;\nout vec3 vBarycentricCoord;" 
            : "varying float vLighting;\nvarying vec3 vBarycentricCoord;"}
        
        void main() {
            gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
            vec3 worldNormal = normalize(mat3(uModelMatrix) * aNormal);
            vLighting = max(0.3, min(1.0, dot(worldNormal, normalize(uLightDir))));
            
            float id = float(gl_VertexID % 3);
            vBarycentricCoord = vec3(id == 0.0, id == 1.0, id == 2.0);
        }`;
    }

    getTerrainFragmentShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        precision mediump float;
        ${isWebGL2 ? "flat in float vLighting;\nin vec3 vBarycentricCoord;\nout vec4 fragColor;" 
            : "varying float vLighting;\nvarying vec3 vBarycentricCoord;"}
        
        void main() {
            float edgeWidth = 1.0;
            vec3 d = fwidth(vBarycentricCoord);
            vec3 a3 = smoothstep(vec3(0.0), d * edgeWidth, vBarycentricCoord);
            float edge = min(min(a3.x, a3.y), a3.z);
            
            if (edge < 0.9) {
                ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(1.0, 0.0, 0.0, 1.0) * vLighting;
            } else {
                ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(0.0, 0.0, 0.0, 1.0);
            }
        }`;
    }

    getCharacterVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
        ${isWebGL2 ? "in" : "attribute"} vec3 aNormal;
        ${isWebGL2 ? "in" : "attribute"} vec3 aColor;
        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        uniform mat4 uModelMatrix;
        ${isWebGL2 ? "flat out float vLighting;\nflat out vec3 vColor;\nout vec3 vBarycentricCoord;" 
            : "varying float vLighting;\nvarying vec3 vColor;\nvarying vec3 vBarycentricCoord;"}
        
        void main() {
            gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
            vec3 worldNormal = normalize(mat3(uModelMatrix) * aNormal);
            vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
            vLighting = max(0.3, min(1.0, dot(worldNormal, lightDir)));
            vColor = aColor;
            
            float id = float(gl_VertexID % 3);
            vBarycentricCoord = vec3(id == 0.0, id == 1.0, id == 2.0);
        }`;
    }

    getCharacterFragmentShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        precision mediump float;
        ${isWebGL2 ? "flat in float vLighting;\nflat in vec3 vColor;\nin vec3 vBarycentricCoord;\nout vec4 fragColor;" 
            : "varying float vLighting;\nvarying vec3 vColor;\nvarying vec3 vBarycentricCoord;"}
        
        void main() {
            float edgeWidth = 1.0;
            vec3 d = fwidth(vBarycentricCoord);
            vec3 a3 = smoothstep(vec3(0.0), d * edgeWidth, vBarycentricCoord);
            float edge = min(min(a3.x, a3.y), a3.z);
            
            vec3 wireColor = vec3(1.0, vColor.y, 0.0);
            
            if (edge < 0.9) {
                ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(wireColor * vLighting, 1.0);
            } else {
                ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(0.0, 0.0, 0.0, 1.0);
            }
        }`;
    }

    getLineVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        
        void main() {
            gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 1.0);
        }`;
    }

    getLineFragmentShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        precision mediump float;
        ${isWebGL2 ? "out vec4 fragColor;\n" : ""}
        void main() {
            ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(1.0, 0.0, 0.0, 1.0);
        }`;
    }
}

// Auto-register at end of file
console.log('[VirtualBoyShader] Registering Virtal Boy shader..');
ShaderRegistry.register('virtualboy', VirtualBoyShader);