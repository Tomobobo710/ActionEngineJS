// game/display/gl/shaders/virtualboyshaderset.js
class VirtualBoyShaderSet {
    getStandardVertexShader(isWebGL2) { // Renamed from getTerrainVertexShader
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
            // Negate light direction to be consistent with other shaders
            vLighting = max(0.3, min(1.0, dot(worldNormal, normalize(-uLightDir))));
            
            float id = float(gl_VertexID % 3);
            vBarycentricCoord = vec3(id == 0.0, id == 1.0, id == 2.0);
        }`;
    }

    getStandardFragmentShader(isWebGL2) { // Renamed from getTerrainFragmentShader
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

    // Line shader methods removed - now handled by the dedicated LineShader class
}

// Shader sets are now registered by ShaderManager