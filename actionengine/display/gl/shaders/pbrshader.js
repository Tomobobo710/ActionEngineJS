// game/display/gl/shaders/pbrshader.js
class PBRShader {
    getStandardVertexShader(isWebGL2) { // Renamed from getTerrainVertexShader
        return `${isWebGL2 ? "#version 300 es\n" : ""}
    // Attributes - data coming in per vertex
    ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
    ${isWebGL2 ? "in" : "attribute"} vec3 aNormal;
    ${isWebGL2 ? "in" : "attribute"} vec3 aColor;
    ${isWebGL2 ? "in" : "attribute"} vec2 aTexCoord;
    ${isWebGL2 ? "in" : "attribute"} float aTextureIndex;
    ${isWebGL2 ? "in" : "attribute"} float aUseTexture;
    
    // Uniforms - shared data for all vertices
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;

    uniform vec3 uLightDir;
    uniform vec3 uCameraPos;
    
    // Outputs to fragment shader
    ${isWebGL2 ? "out" : "varying"} vec3 vNormal;        // Surface normal
    ${isWebGL2 ? "out" : "varying"} vec3 vWorldPos;      // Position in world space

    ${isWebGL2 ? "out" : "varying"} vec3 vColor;
    ${isWebGL2 ? "out" : "varying"} vec3 vViewDir;       // Direction to camera
    ${isWebGL2 ? "flat out" : "varying"} float vTextureIndex;
    ${isWebGL2 ? "out" : "varying"} vec2 vTexCoord;
    ${isWebGL2 ? "flat out" : "varying"} float vUseTexture;
    
    void main() {
        // Calculate world position
        vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
        vWorldPos = worldPos.xyz;
        
        // Transform normal to world space
        vNormal = mat3(uModelMatrix) * aNormal;
        
        // Calculate view direction
        vViewDir = normalize(uCameraPos - worldPos.xyz);
        

        
        // Pass color and texture info to fragment shader
        vColor = aColor;
        vTexCoord = aTexCoord;
        vTextureIndex = aTextureIndex;
        vUseTexture = aUseTexture;
        
        // Final position
        gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
    }`;
    }

    getStandardFragmentShader(isWebGL2) { // Renamed from getTerrainFragmentShader
        return `${isWebGL2 ? "#version 300 es\n" : ""}
precision highp float;
${isWebGL2 ? "precision mediump sampler2DArray;\n" : ""}

// Inputs from vertex shader
${isWebGL2 ? "in" : "varying"} vec3 vNormal;
${isWebGL2 ? "in" : "varying"} vec3 vWorldPos;

${isWebGL2 ? "in" : "varying"} vec3 vColor;
${isWebGL2 ? "in" : "varying"} vec3 vViewDir;
${isWebGL2 ? "flat in" : "varying"} float vTextureIndex;
${isWebGL2 ? "in" : "varying"} vec2 vTexCoord;
${isWebGL2 ? "flat in" : "varying"} float vUseTexture;

// Material properties
uniform float uRoughness;
uniform float uMetallic;
uniform float uBaseReflectivity;

// Light properties
uniform vec3 uLightPos;
uniform vec3 uLightDir;
uniform vec3 uCameraPos;

uniform float uLightIntensity;

// Texture sampler
uniform sampler2DArray uPBRTextureArray;

${isWebGL2 ? "out vec4 fragColor;" : ""}

// Constants for performance
const float PI = 3.14159265359;
const float RECIPROCAL_PI = 0.31830988618;

// Optimized PBR function that combines GGX and Fresnel calculations
// This is faster than separate function calls
vec3 specularBRDF(vec3 N, vec3 L, vec3 V, vec3 F0, float roughness) {
    vec3 H = normalize(V + L);
    float NdotH = max(dot(N, H), 0.0);
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float HdotV = max(dot(H, V), 0.0);
    
    // Roughness terms
    float a = roughness * roughness;
    float a2 = a * a;
    
    // Distribution
    float NdotH2 = NdotH * NdotH;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    float D = a2 / (PI * denom * denom);
    
    // Geometry
    float k = ((roughness + 1.0) * (roughness + 1.0)) / 8.0;
    float G1_V = NdotV / (NdotV * (1.0 - k) + k);
    float G1_L = NdotL / (NdotL * (1.0 - k) + k);
    float G = G1_V * G1_L;
    
    // Fresnel
    vec3 F = F0 + (1.0 - F0) * pow(1.0 - HdotV, 5.0);
    
    // Combined specular term
    return (D * G * F) / (4.0 * NdotV * NdotL + 0.001);
}

void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    vec3 L = normalize(uLightDir);  // Light direction
    float NdotL = max(dot(N, L), 0.0);

    // Fast path for distance attenuation calculation
    float distanceToLight = length(vWorldPos - uLightPos);
    float distanceAttenuation = 1.0 / (1.0 + 0.0001 * distanceToLight * distanceToLight);

    // Efficient texture sampling with conditional
    vec3 albedo = (vUseTexture > 0.5) ? 
        texture(uPBRTextureArray, vec3(vTexCoord, vTextureIndex)).rgb : 
        vColor;

    // Base reflectivity with pre-computed metallic mix
    vec3 baseF0 = mix(vec3(uBaseReflectivity), albedo, uMetallic);

    // Calculate specular using our optimized function
    vec3 specular = specularBRDF(N, L, V, baseF0, uRoughness);

    // Efficient diffuse calculation
    vec3 kD = (vec3(1.0) - specular) * (1.0 - uMetallic);
    
    // Combined lighting equation - multiply terms together for fewer operations
    vec3 color = (kD * albedo * RECIPROCAL_PI + specular) * NdotL * uLightIntensity * distanceAttenuation;

    // Add ambient light (pre-computed constant)
    color += vec3(0.03) * albedo;

    // Optimized tonemapping and gamma in one step to reduce calculations
    // This approximation is faster than doing them separately
    color = pow(color / (color + 1.0), vec3(0.4545)); // 1/2.2 ≈ 0.4545

    ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(color, 1.0);
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

// Register the shader
//console.log("[PBRShader] Registering PBR shader..");
ShaderRegistry.register("pbr", PBRShader);