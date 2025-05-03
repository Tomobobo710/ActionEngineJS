// game/display/gl/shaders/pbrshader.js
class PBRShader {
    getStandardVertexShader(isWebGL2) {
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
    uniform mat4 uLightSpaceMatrix;  // Added for shadow mapping

    uniform vec3 uLightDir;
    uniform vec3 uCameraPos;
    
    // Outputs to fragment shader
    ${isWebGL2 ? "out" : "varying"} vec3 vNormal;        // Surface normal
    ${isWebGL2 ? "out" : "varying"} vec3 vWorldPos;      // Position in world space
    ${isWebGL2 ? "out" : "varying"} vec4 vFragPosLightSpace;  // Added for shadow mapping

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
        
        // Position in light space for shadow mapping
        vFragPosLightSpace = uLightSpaceMatrix * worldPos;
        
        // Pass color and texture info to fragment shader
        vColor = aColor;
        vTexCoord = aTexCoord;
        vTextureIndex = aTextureIndex;
        vUseTexture = aUseTexture;
        
        // Final position
        gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
    }`;
    }

    getStandardFragmentShader(isWebGL2) {
        // Directly include shadow calculation functions instead of creating a ShadowShader instance
        const shadowFunctions = isWebGL2 ? 
        `
            // Sample from shadow map with hardware-enabled filtering
            float shadowCalculation(vec4 fragPosLightSpace, sampler2D shadowMap) {
                // Perform perspective divide to get NDC coordinates
                vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
                
                // Transform to [0,1] range for texture lookup
                projCoords = projCoords * 0.5 + 0.5;
                
                // Check if position is outside the shadow map bounds
                if(projCoords.x < 0.0 || projCoords.x > 1.0 || 
                   projCoords.y < 0.0 || projCoords.y > 1.0 || 
                   projCoords.z < 0.0 || projCoords.z > 1.0) {
                    return 1.0; // No shadow outside shadow map
                }
                
                // Explicitly sample shadow map with explicit texture binding
                // This helps avoid texture binding conflicts
                float closestDepth = texture(shadowMap, projCoords.xy).r;
                
                // Get current depth value
                float currentDepth = projCoords.z;
                
                // Apply bias from uniform to avoid shadow acne
                float bias = uShadowBias;
                
                // Check if fragment is in shadow
                float shadow = currentDepth - bias > closestDepth ? 0.0 : 1.0;
                
                return shadow;
            }
            
            // PCF shadow mapping for smoother shadows
            float shadowCalculationPCF(vec4 fragPosLightSpace, sampler2D shadowMap) {
                // Check if PCF is disabled - fall back to basic shadow calculation
                if (!uPCFEnabled) {
                    return shadowCalculation(fragPosLightSpace, shadowMap);
                }
                
                // Perform perspective divide to get NDC coordinates
                vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
                
                // Transform to [0,1] range for texture lookup
                projCoords = projCoords * 0.5 + 0.5;
                
                // Check if position is outside the shadow map bounds
                if(projCoords.x < 0.0 || projCoords.x > 1.0 || 
                   projCoords.y < 0.0 || projCoords.y > 1.0 || 
                   projCoords.z < 0.0 || projCoords.z > 1.0) {
                    return 1.0; // No shadow outside shadow map
                }
                
                // Get current depth value
                float currentDepth = projCoords.z;
                
                // Apply bias from uniform - adjust using softness factor
                float softnessFactor = max(0.1, uShadowSoftness); // Ensure minimum softness
                float bias = uShadowBias * softnessFactor;
                
                // Calculate PCF with explicit shadow map sampling
                float shadow = 0.0;
                vec2 texelSize = 1.0 / vec2(textureSize(shadowMap, 0));
                
                // Determine PCF kernel radius based on uPCFSize
                int pcfRadius = uPCFSize / 2;
                float totalSamples = 0.0;
                
                // Dynamic PCF sampling using the specified kernel size
                for(int x = -pcfRadius; x <= pcfRadius; ++x) {
                    for(int y = -pcfRadius; y <= pcfRadius; ++y) {
                        // Skip samples outside the kernel radius 
                        // (needed for non-square kernels like 3x3, 5x5, etc.)
                        if (abs(x) <= pcfRadius && abs(y) <= pcfRadius) {
                            // Apply softness factor to sampling coordinates
                            vec2 offset = vec2(x, y) * texelSize * mix(1.0, 2.0, uShadowSoftness);
                            
                            // Explicitly sample shadow map with clear texture binding
                            float pcfDepth = texture(shadowMap, projCoords.xy + offset).r; 
                            shadow += currentDepth - bias > pcfDepth ? 0.0 : 1.0;
                            totalSamples += 1.0;
                        }
                    }
                }
                
                // Average samples
                shadow /= max(1.0, totalSamples);
                
                return shadow;
            }` :
        `
            // Unpack depth from RGBA color
            float unpackDepth(vec4 packedDepth) {
                const vec4 bitShift = vec4(1.0, 1.0/256.0, 1.0/(256.0*256.0), 1.0/(256.0*256.0*256.0));
                return dot(packedDepth, bitShift);
            }
            
            // Shadow calculation for WebGL1
            float shadowCalculation(vec4 fragPosLightSpace, sampler2D shadowMap) {
                // Perform perspective divide to get NDC coordinates
                vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
                
                // Transform to [0,1] range for texture lookup
                projCoords = projCoords * 0.5 + 0.5;
                
                // Check if position is outside the shadow map bounds
                if(projCoords.x < 0.0 || projCoords.x > 1.0 || 
                   projCoords.y < 0.0 || projCoords.y > 1.0 || 
                   projCoords.z < 0.0 || projCoords.z > 1.0) {
                    return 1.0; // No shadow outside shadow map
                }
                
                // Get packed depth value
                vec4 packedDepth = texture2D(shadowMap, projCoords.xy);
                
                // Unpack the depth value
                float closestDepth = unpackDepth(packedDepth);
                
                // Get current depth value
                float currentDepth = projCoords.z;
                
                // Apply bias from uniform to avoid shadow acne
                float bias = uShadowBias;
                
                // Check if fragment is in shadow
                float shadow = currentDepth - bias > closestDepth ? 0.0 : 1.0;
                
                return shadow;
            }
            
            // PCF shadow calculation for WebGL1
            float shadowCalculationPCF(vec4 fragPosLightSpace, sampler2D shadowMap) {
                // Check if PCF is disabled - fall back to basic shadow calculation
                if (!uPCFEnabled) {
                    return shadowCalculation(fragPosLightSpace, shadowMap);
                }
                
                // Perform perspective divide to get NDC coordinates
                vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
                
                // Transform to [0,1] range for texture lookup
                projCoords = projCoords * 0.5 + 0.5;
                
                // Check if position is outside the shadow map bounds
                if(projCoords.x < 0.0 || projCoords.x > 1.0 || 
                   projCoords.y < 0.0 || projCoords.y > 1.0 || 
                   projCoords.z < 0.0 || projCoords.z > 1.0) {
                    return 1.0; // No shadow outside shadow map
                }
                
                // Get current depth value
                float currentDepth = projCoords.z;
                
                // Apply bias from uniform - adjust using softness factor
                float softnessFactor = max(0.1, uShadowSoftness); // Ensure minimum softness
                float bias = uShadowBias * softnessFactor;
                
                // Calculate PCF with explicit shadow map sampling
                float shadow = 0.0;
                float texelSize = 1.0 / uShadowMapSize;
                
                // Determine PCF kernel radius based on uPCFSize
                int pcfRadius = int(uPCFSize) / 2;
                float totalSamples = 0.0;
                
                // WebGL1 has more limited loop support, so limit to max 9x9 kernel
                // We need fixed loop bounds in WebGL1
                for(int x = -4; x <= 4; ++x) {
                    for(int y = -4; y <= 4; ++y) {
                        // Skip samples outside the requested kernel radius
                        if (abs(x) <= pcfRadius && abs(y) <= pcfRadius) {
                            // Apply softness factor to sampling coordinates
                            vec2 offset = vec2(x, y) * texelSize * mix(1.0, 2.0, uShadowSoftness);
                            
                            vec4 packedDepth = texture2D(shadowMap, projCoords.xy + offset);
                            float pcfDepth = unpackDepth(packedDepth);
                            shadow += currentDepth - bias > pcfDepth ? 0.0 : 1.0;
                            totalSamples += 1.0;
                        }
                    }
                }
                
                // Average samples
                shadow /= max(1.0, totalSamples);
                
                return shadow;
            }`;
        
        return `${isWebGL2 ? "#version 300 es\n" : ""}
precision highp float;
${isWebGL2 ? "precision mediump sampler2DArray;\n" : ""}

// Inputs from vertex shader
${isWebGL2 ? "in" : "varying"} vec3 vNormal;
${isWebGL2 ? "in" : "varying"} vec3 vWorldPos;
${isWebGL2 ? "in" : "varying"} vec4 vFragPosLightSpace;  // Added for shadow mapping

${isWebGL2 ? "in" : "varying"} vec3 vColor;
${isWebGL2 ? "in" : "varying"} vec3 vViewDir;
${isWebGL2 ? "flat in" : "varying"} float vTextureIndex;
${isWebGL2 ? "in" : "varying"} vec2 vTexCoord;
${isWebGL2 ? "flat in" : "varying"} float vUseTexture;

// Material properties - global defaults
uniform float uRoughness;
uniform float uMetallic;
uniform float uBaseReflectivity;

// Material properties texture (each texel contains roughness, metallic, baseReflectivity)
uniform sampler2D uMaterialPropertiesTexture;
uniform bool uUsePerTextureMaterials;

// Light properties
uniform vec3 uLightPos;
uniform vec3 uLightDir;
uniform vec3 uCameraPos;
uniform float uLightIntensity;

// Shadow mapping (always on texture unit 7)
uniform sampler2D uShadowMap;
uniform bool uShadowsEnabled;
uniform float uShadowBias; // Shadow bias uniform for controlling shadow acne
uniform float uShadowMapSize; // Shadow map size for texture calculations
uniform float uShadowSoftness; // Controls shadow edge softness (0-1)
uniform int uPCFSize; // Controls PCF kernel size (1, 3, 5, 7, 9)
uniform bool uPCFEnabled; // Controls whether PCF filtering is enabled

// Texture sampler
uniform sampler2DArray uPBRTextureArray;

${isWebGL2 ? "out vec4 fragColor;" : ""}

// Constants for performance
const float PI = 3.14159265359;
const float RECIPROCAL_PI = 0.31830988618;

// Shadow mapping functions
${shadowFunctions}

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
    // Negate light direction to be consistent with shadow mapping convention
    vec3 L = normalize(-uLightDir);  // Light direction (negated for consistency)
    float NdotL = max(dot(N, L), 0.0);

    // Fast path for distance attenuation calculation
    float distanceToLight = length(vWorldPos - uLightPos);
    float distanceAttenuation = 1.0 / (1.0 + 0.0001 * distanceToLight * distanceToLight);

    // Efficient texture sampling with conditional
    vec3 albedo = (vUseTexture > 0.5) ? 
        texture(uPBRTextureArray, vec3(vTexCoord, vTextureIndex)).rgb : 
        vColor;

    // Get material properties based on texture index if using textures
    float roughness = uRoughness;
    float metallic = uMetallic;
    float baseReflectivity = uBaseReflectivity;
    
    if (uUsePerTextureMaterials && vUseTexture > 0.5) {
        // Sample material properties from the material texture
        // Convert texture index to texture coordinates (0-1 range)
        float textureCoord = (vTextureIndex + 0.5) / float(textureSize(uMaterialPropertiesTexture, 0).x);
        vec4 materialProps = texture(uMaterialPropertiesTexture, vec2(textureCoord, 0.5));
        
        // Extract material properties
        roughness = materialProps.r;
        metallic = materialProps.g;
        baseReflectivity = materialProps.b;
    }

    // Base reflectivity with per-texture material mix
    vec3 baseF0 = mix(vec3(baseReflectivity), albedo, metallic);

    // Calculate specular using our optimized function with per-texture roughness
    // Note: L is already negated above for consistency with shadow mapping
    vec3 specular = specularBRDF(N, L, V, baseF0, roughness);

    // Efficient diffuse calculation with per-texture metallic
    vec3 kD = (vec3(1.0) - specular) * (1.0 - metallic);
    
    // Calculate shadow factor if shadows are enabled
    float shadow = 1.0;
    if (uShadowsEnabled) {
        // Use the PCF shadow calculation for soft shadows
        // The shadow map is bound to texture unit 7
        float shadowFactor = shadowCalculationPCF(vFragPosLightSpace, uShadowMap);
        // Adjust shadow intensity for PBR - not completely black shadows
        shadow = 1.0 - (1.0 - shadowFactor) * 0.8;
    }
    
    // Combined lighting equation with shadow
    vec3 color = (kD * albedo * RECIPROCAL_PI + specular) * NdotL * uLightIntensity * distanceAttenuation * shadow;

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
ShaderRegistry.register("pbr", PBRShader);