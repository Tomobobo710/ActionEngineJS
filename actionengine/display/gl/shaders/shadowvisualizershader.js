// game/display/gl/shaders/shadowvisualizershader.js
class ShadowVisualizerShader {
    getStandardVertexShader(isWebGL2) {
        // Use same vertex shader as DefaultShader to ensure compatibility
        return `${isWebGL2 ? "#version 300 es\n" : ""}
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
    uniform mat4 uLightSpaceMatrix;
    uniform vec3 uLightDir;
    
    ${isWebGL2 ? "out" : "varying"} vec3 vColor;
    ${isWebGL2 ? "out" : "varying"} vec2 vTexCoord;
    ${isWebGL2 ? "out" : "varying"} float vLighting;
    ${isWebGL2 ? "flat out" : "varying"} float vTextureIndex;
    ${isWebGL2 ? "flat out" : "varying"} float vUseTexture;
    ${isWebGL2 ? "out" : "varying"} vec4 vFragPosLightSpace;
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
        
        // Pass other variables to fragment shader
        vColor = aColor;
        vTexCoord = aTexCoord;
        vTextureIndex = aTextureIndex;
        vUseTexture = aUseTexture;
    }`;
    }

    getStandardFragmentShader(isWebGL2) {
        // Include shadow calculation functions first (same as in default shader)
        const shadowFunctions = isWebGL2 ? 
            // WebGL2 shadow functions (same as in your default/PBR shaders)
            `...` : // I'm omitting the implementation to save space
            // WebGL1 shadow functions 
            `...`; 
        
        // The fragment shader will ONLY visualize shadow factors on the actual objects
        return `${isWebGL2 ? "#version 300 es\n" : ""}
    precision mediump float;
    ${isWebGL2 ? "precision mediump sampler2DArray;\n" : ""}
    
    ${isWebGL2 ? "in" : "varying"} vec3 vColor;
    ${isWebGL2 ? "in" : "varying"} vec2 vTexCoord;
    ${isWebGL2 ? "flat in" : "varying"} float vTextureIndex;
    ${isWebGL2 ? "flat in" : "varying"} float vUseTexture;
    ${isWebGL2 ? "in" : "varying"} vec4 vFragPosLightSpace;
    ${isWebGL2 ? "in" : "varying"} vec3 vNormal;
    ${isWebGL2 ? "in" : "varying"} vec3 vFragPos;
    
    ${isWebGL2 ? "uniform sampler2DArray uTextureArray;" : "uniform sampler2D uTexture;"}
    uniform sampler2D uShadowMap;
    uniform vec3 uLightPos;
    uniform vec3 uLightDir;
    uniform bool uShadowsEnabled;
    uniform float uShadowBias;
    uniform float uShadowMapSize;
    uniform float uShadowSoftness;
    uniform int uPCFSize;
    uniform bool uPCFEnabled;
    
    // Visualization mode: 0=shadow only, 1=heatmap, 2=with object color
    uniform int uVisualizationMode;
    
    ${isWebGL2 ? "out vec4 fragColor;" : ""}
    
    // Shadow calculation functions
    ${shadowFunctions}
    
    void main() {
        // Calculate shadow factor - THIS IS THE ACTUAL SHADOW CALCULATION
        // That gets applied to objects in your scene
        float shadowFactor = 1.0;
        if (uShadowsEnabled) {
            shadowFactor = shadowCalculationPCF(vFragPosLightSpace, uShadowMap);
            shadowFactor = 1.0 - (1.0 - shadowFactor) * 0.8; // Apply intensity scale
        }
        
        // Mode 0: Pure shadow factor (black = shadowed, white = lit)
        if (uVisualizationMode == 0) {
            ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(vec3(shadowFactor), 1.0);
        }
        // Mode 1: Heatmap visualization (blue = shadowed, red = lit)
        else if (uVisualizationMode == 1) {
            vec3 color = mix(vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0), shadowFactor);
            ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(color, 1.0);
        }
        // Mode 2: Object color with only shadow (no other lighting)
        else {
            vec4 baseColor;
            if (vUseTexture > 0.5) {
                ${isWebGL2 ? "baseColor = texture(uTextureArray, vec3(vTexCoord, vTextureIndex));" : 
                             "baseColor = texture2D(uTexture, vTexCoord);"}
            } else {
                baseColor = vec4(vColor, 1.0);
            }
            vec3 result = baseColor.rgb * shadowFactor;
            ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(result, baseColor.a);
        }
    }`;
    }

    // Lines shaders remain the same as other shader sets
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

// Register the shader
//ShaderRegistry.register("shadowvisualizer", ShadowVisualizerShader);