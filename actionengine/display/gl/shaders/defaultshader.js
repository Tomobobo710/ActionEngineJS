// game/display/gl/shaders/defaultshader.js
class DefaultShader {
    getStandardVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
    // Add precision qualifier to make it match fragment shader
    precision mediump float;
    
    ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
    ${isWebGL2 ? "in" : "attribute"} vec3 aNormal;
    ${isWebGL2 ? "in" : "attribute"} vec3 aColor;
    ${isWebGL2 ? "in" : "attribute"} vec2 aTexCoord;
    ${isWebGL2 ? "in" : "attribute"} float aTextureIndex;
    ${isWebGL2 ? "in" : "attribute"} float aUseTexture;
    
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;
    uniform mat4 uLightSpaceMatrix;  // Added for shadow mapping
    uniform vec3 uLightDir;
    
    ${isWebGL2 ? "out" : "varying"} vec3 vColor;
    ${isWebGL2 ? "out" : "varying"} vec2 vTexCoord;
    ${isWebGL2 ? "out" : "varying"} float vLighting;
    ${isWebGL2 ? "flat out" : "varying"} float vTextureIndex;
    ${isWebGL2 ? "flat out" : "varying"} float vUseTexture;
    ${isWebGL2 ? "out" : "varying"} vec4 vFragPosLightSpace;  // Added for shadow mapping
    ${isWebGL2 ? "out" : "varying"} vec3 vNormal;
    ${isWebGL2 ? "out" : "varying"} vec3 vFragPos;
    
    void main() {
        vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
        vFragPos = worldPos.xyz;
        gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
        
        // Position in light space for shadow mapping
        vFragPosLightSpace = uLightSpaceMatrix * worldPos;
        
        // Pass world-space normal
        vNormal = mat3(uModelMatrix) * aNormal;
        
        // Calculate basic diffuse lighting
        // Note: We negate the light direction to make it consistent with shadow mapping
        vec3 worldNormal = normalize(vNormal);
        vLighting = max(0.3, min(1.0, dot(worldNormal, normalize(-uLightDir))));
        
        // Pass other variables to fragment shader
        vColor = aColor;
        vTexCoord = aTexCoord;
        vTextureIndex = aTextureIndex;
        vUseTexture = aUseTexture;
    }`;
    }

    getStandardFragmentShader(isWebGL2) {
        // Include shadow calculation functions from ShadowShader
        const shadowFunctions = new ShadowShader().getShadowSamplingFunctions(isWebGL2);
        
        return `${isWebGL2 ? "#version 300 es\n" : ""}
    precision mediump float;
    ${isWebGL2 ? "precision mediump sampler2DArray;\n" : ""}
    
    ${isWebGL2 ? "in" : "varying"} vec3 vColor;
    ${isWebGL2 ? "in" : "varying"} vec2 vTexCoord;
    ${isWebGL2 ? "in" : "varying"} float vLighting;
    ${isWebGL2 ? "flat in" : "varying"} float vTextureIndex;
    ${isWebGL2 ? "flat in" : "varying"} float vUseTexture;
    ${isWebGL2 ? "in" : "varying"} vec4 vFragPosLightSpace;
    ${isWebGL2 ? "in" : "varying"} vec3 vNormal;
    ${isWebGL2 ? "in" : "varying"} vec3 vFragPos;
    
    // Texture array for albedo textures (unit 0)
    ${isWebGL2 ? "uniform sampler2DArray uTextureArray;" : "uniform sampler2D uTexture;"}
    
    // Shadow map with explicit separate binding (unit 7)
    // Always use sampler2D for shadow maps
    uniform sampler2D uShadowMap;
    uniform vec3 uLightPos;
    uniform vec3 uLightDir;
    uniform bool uShadowsEnabled;
    uniform float uShadowBias; // Shadow bias uniform for controlling shadow acne
    uniform float uShadowMapSize; // Shadow map size for texture calculations
    uniform float uShadowSoftness; // Controls shadow edge softness (0-1)
    uniform int uPCFSize; // Controls PCF kernel size (1, 3, 5, 7, 9)
    uniform bool uPCFEnabled; // Controls whether PCF filtering is enabled
    
    ${isWebGL2 ? "out vec4 fragColor;" : ""}
    
    // Shadow mapping functions
    ${shadowFunctions}
    
    void main() {
        // Base color calculation
        vec4 baseColor;
        if (vUseTexture > 0.5) {  // Check if this fragment uses texture
            ${isWebGL2 ? "baseColor = texture(uTextureArray, vec3(vTexCoord, vTextureIndex));" : "baseColor = texture2D(uTexture, vTexCoord);"}
        } else {
            baseColor = vec4(vColor, 1.0);
        }
        
        // Apply ambient and diffuse lighting
        float ambient = 0.2;
        // Negate light direction to be consistent with shadow mapping convention
        float diffuse = max(0.0, dot(normalize(vNormal), normalize(-uLightDir)));
        
        // Calculate shadow factor
        float shadow = 1.0;
        if (uShadowsEnabled) {
            // Use explicit texture lookup to avoid sampler conflicts
            // The shadow map is bound to texture unit 7
            float shadowFactor = shadowCalculationPCF(vFragPosLightSpace, uShadowMap);
            // Match the PBR shader calculation - shadows should be darker
            shadow = 1.0 - (1.0 - shadowFactor) * 0.8;
        }
        
        // Final lighting calculation with shadow
        float lighting = ambient + (diffuse * shadow);
        
        // Apply lighting to color
        vec3 result = baseColor.rgb * lighting;
        
        ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(result, baseColor.a);
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
    uniform vec3 uColor;
    ${isWebGL2 ? "out vec4 fragColor;\n" : ""}
    void main() {
        ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(uColor, 1.0);
    }`;
    }
}