// actionengine/display/gl/shaders/objectshader.js

class ObjectShader {
    constructor() {
        // Normal mapping helper functions (shared across all shaders)
        this.normalMappingFunctions = `
            // Sample normal from normal map and convert from tangent to world space
            vec3 sampleNormalMap(sampler2DArray normalMap, int mapIndex, vec2 texCoord, vec3 normal, vec3 tangent, vec3 bitangent) {
                // Check if normal map index is valid
                if (mapIndex < 0) return normal;
                
                // Sample from normal map texture array
                vec4 sampledNormal = texture(normalMap, vec3(texCoord, float(mapIndex)));
                
                // Convert from [0,1] to [-1,1] range (assuming GL_RGB or GL_RGBA format)
                vec3 normalTangentSpace = normalize(sampledNormal.rgb * 2.0 - 1.0);
                
                // Construct TBN matrix (from tangent space to world space)
                vec3 N = normalize(normal);
                vec3 T = normalize(tangent);
                vec3 B = normalize(bitangent);
                mat3 TBN = mat3(T, B, N);
                
                // Transform normal from tangent space to world space
                vec3 normalWorldSpace = TBN * normalTangentSpace;
                return normalize(normalWorldSpace);
            }
        `;

        // Store references to different object shader variants
        this.variants = {
            default: {
                getVertexShader: this.getDefaultVertexShader,
                getFragmentShader: this.getDefaultFragmentShader
            },
            virtualboy: {
                getVertexShader: this.getVirtualBoyVertexShader,
                getFragmentShader: this.getVirtualBoyFragmentShader
            }
        };

        // Current active variant (default to 'default')
        this.currentVariant = "default";
    }

    /**
     * Set the current shader variant
     * @param {string} variantName - Name of the variant to use
     */
    setVariant(variantName) {
        if (this.variants[variantName]) {
            this.currentVariant = variantName;
            console.log(`[ObjectShader] Set shader variant to: ${variantName}`);
        } else {
            console.warn(`[ObjectShader] Unknown variant: ${variantName}, using default`);
            this.currentVariant = "default";
        }
    }

    /**
     * Get the current variant name
     * @returns {string} - Current variant name
     */
    getCurrentVariant() {
        return this.currentVariant;
    }

    /**
     * Get the current variant's vertex shader
     * @returns {string} - Vertex shader source code
     */
    getVertexShader() {
        return this.variants[this.currentVariant].getVertexShader.call(this);
    }

    /**
     * Get the current variant's fragment shader
     * @returns {string} - Fragment shader source code
     */
    getFragmentShader() {
        return this.variants[this.currentVariant].getFragmentShader.call(this);
    }

    //--------------------------------------------------------------------------
    // DEFAULT SHADER VARIANT
    //--------------------------------------------------------------------------

    /**
     * Helper functions for GPU-side matrix construction
     * Matches Matrix4.fromQuat() from matrix4.js to ensure correct orientation
     * @returns {string} - GLSL helper functions
     */
    getMatrixConstructionHelpers() {
        return `
    // Convert quaternion to 3x3 rotation matrix
    // Uses the same formula as Matrix4.fromQuat() in the JS math library
    mat3 quaternionToMatrix(vec4 q) {
        float x = q.x, y = q.y, z = q.z, w = q.w;
        float x2 = x + x, y2 = y + y, z2 = z + z;
        float xx = x * x2, xy = x * y2, xz = x * z2;
        float yy = y * y2, yz = y * z2, zz = z * z2;
        float wx = w * x2, wy = w * y2, wz = w * z2;
        
        return mat3(
            1.0 - (yy + zz), xy + wz,       xz - wy,
            xy - wz,       1.0 - (xx + zz), yz + wx,
            xz + wy,       yz - wx,       1.0 - (xx + yy)
        );
    }
    
    // Build full 4x4 model matrix from position, quaternion rotation, scale
    mat4 buildModelMatrix(vec3 position, vec4 rotation, float scale) {
        mat3 rotMatrix = quaternionToMatrix(rotation);
        mat3 scaledRotMatrix = rotMatrix * mat3(scale);
        
        return mat4(
            vec4(scaledRotMatrix[0], 0.0),
            vec4(scaledRotMatrix[1], 0.0),
            vec4(scaledRotMatrix[2], 0.0),
            vec4(position, 1.0)
        );
    }`;
    }

    /**
     * Default object vertex shader
     * Features: normal mapping, texture arrays, shadow mapping, skeletal animation
     * @returns {string} - Vertex shader source code
     */
    getDefaultVertexShader() {
        return `#version 300 es
    // Attributes - data coming in per vertex
    in vec3 aPosition;
    in vec3 aNormal;
    in vec3 aTangent;
    in vec3 aColor;
    in float aAlpha;
    in vec2 aTexCoord;
    in float aTextureIndex;
    in float aUseTexture;
    in float aNormalMapIndex;
    in float aMetallicRoughnessMapIndex;
    in float aEmissiveMapIndex;
    
    // Skeletal animation attributes
    in ivec4 aBoneIndices;
    in vec4 aBoneWeights;
    
    // Uniforms - shared data for all vertices
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform vec3 uModelPos;
    uniform vec4 uModelRotation;
    uniform float uModelScale;
    uniform mat4 uLightSpaceMatrix;  // Added for shadow mapping

    uniform vec3 uLightDir;
    uniform vec3 uCameraPos;
    uniform vec3 uLightColor;
    uniform float uLightIntensity;
    
    // Bone matrices for skeletal animation (max 256 bones)
    layout(std140) uniform BoneMatrices {
        mat4 matrices[256];
    } boneData;
    
    // Outputs to fragment shader
    out vec3 vNormal;        // Surface normal
    out vec3 vTangent;       // Surface tangent
    out vec3 vBitangent;     // Surface bitangent
    out vec3 vWorldPos;      // Position in world space
    out vec4 vFragPosLightSpace;  // Added for shadow mapping
    out vec3 vFragPos;
    out vec3 vColor;
    out float vAlpha;
    out vec3 vViewDir;       // Direction to camera
    flat out float vTextureIndex;
    out vec2 vTexCoord;
    flat out float vUseTexture;
    out float vFragDepth;    // For logarithmic depth buffer
    flat out float vNormalMapIndex;
    flat out float vMetallicRoughnessMapIndex;
    flat out float vEmissiveMapIndex;
    
    ${this.getMatrixConstructionHelpers()}
    
    void main() {
        // Apply skeletal animation if bone weights are present
        vec3 skinnedPosition = aPosition;
        vec3 skinnedNormal = aNormal;
        
        float totalWeight = aBoneWeights.x + aBoneWeights.y + aBoneWeights.z + aBoneWeights.w;
        if (totalWeight > 0.001) {
            // Normalize weights in case they don't sum to 1.0
            vec4 normalizedWeights = aBoneWeights / totalWeight;
            
            skinnedPosition = vec3(0.0);
            skinnedNormal = vec3(0.0);
            
            // Apply up to 4 bone influences
            for (int i = 0; i < 4; i++) {
                mat4 boneMatrix = boneData.matrices[aBoneIndices[i]];
                skinnedPosition += (boneMatrix * vec4(aPosition, 1.0)).xyz * normalizedWeights[i];
                skinnedNormal += (boneMatrix * vec4(aNormal, 0.0)).xyz * normalizedWeights[i];
            }
        }
        
        // Calculate world position from GPU-constructed matrix
        mat4 modelMatrix = buildModelMatrix(uModelPos, uModelRotation, uModelScale);
        vec4 worldPos = modelMatrix * vec4(skinnedPosition, 1.0);
        vWorldPos = worldPos.xyz;
        vFragPos = worldPos.xyz;
        // Transform normal to world space (use 3x3 rotation part for normal)
        vec3 worldNormal = normalize(quaternionToMatrix(uModelRotation) * skinnedNormal);
        vNormal = worldNormal;
        
        // Transform tangent to world space and calculate bitangent
        vTangent = quaternionToMatrix(uModelRotation) * aTangent;
        vBitangent = cross(normalize(vNormal), normalize(vTangent));
        
        // Calculate view direction
        vViewDir = normalize(uCameraPos - worldPos.xyz);
        
        // Position in light space for shadow mapping
        vFragPosLightSpace = uLightSpaceMatrix * worldPos;
        
        // Pass color and texture info to fragment shader
        vColor = aColor;
        vAlpha = aAlpha;
        vTexCoord = aTexCoord;
        vTextureIndex = aTextureIndex;
        vUseTexture = aUseTexture;
        vNormalMapIndex = aNormalMapIndex;
        vMetallicRoughnessMapIndex = aMetallicRoughnessMapIndex;
        vEmissiveMapIndex = aEmissiveMapIndex;
        
        // Final position
        gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
        
        // Store depth for logarithmic depth buffer (after gl_Position is set)
        vFragDepth = 1.0 + gl_Position.w;
    }`;
    }

    /**
     * Default object fragment shader
     * Features: normal mapping, texture arrays, shadow mapping, point/directional lights
     * @returns {string} - Fragment shader source code
     */
    getDefaultFragmentShader() {
        return this._getDefaultFragmentShaderImpl();
    }

    /**
     * Default fragment shader implementation
     * @returns {string} - Fragment shader source code
     */
    _getDefaultFragmentShaderImpl() {
        // Directly include shadow calculation functions for WebGL2
        const shadowFunctions = `
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
                
                // Explicitly sample shadow map with separate texture binding
                float closestDepth = texture(shadowMap, projCoords.xy).r;
                
                // Get current depth value
                float currentDepth = projCoords.z;
                
                // Apply shadow bias to reduce self-shadowing artifacts
                float bias = uShadowBias;
                
                // Check if fragment is in shadow
                float shadow = currentDepth - bias > closestDepth ? 0.0 : 1.0;
                
                return shadow;
            }
            
            // ===== PBR FUNCTIONS =====
            
            // PBR Constants
            const float PI = 3.14159265359;
            const float RECIPROCAL_PI = 1.0 / PI;
            
            // Fresnel-Schlick approximation for specular reflection
            vec3 fresnelSchlick(float cosTheta, vec3 baseF0) {
                return baseF0 + (1.0 - baseF0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
            }
            
            // GGX normal distribution function
            float distributionGGX(vec3 N, vec3 H, float roughness) {
                float a = roughness * roughness;
                float a2 = a * a;
                float NdotH = max(dot(N, H), 0.0);
                float NdotH2 = NdotH * NdotH;
                float nom = a2;
                float denom = (NdotH2 * (a2 - 1.0) + 1.0);
                denom = PI * denom * denom;
                return nom / denom;
            }
            
            // Schlick-GGX geometry function
            float geometrySchlickGGX(float NdotV, float roughness) {
                float r = (roughness + 1.0);
                float k = (r * r) / 8.0;
                float nom = NdotV;
                float denom = NdotV * (1.0 - k) + k;
                return nom / denom;
            }
            
            // Smith geometry function
            float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
                float NdotV = max(dot(N, V), 0.0);
                float NdotL = max(dot(N, L), 0.0);
                float ggx2 = geometrySchlickGGX(NdotV, roughness);
                float ggx1 = geometrySchlickGGX(NdotL, roughness);
                return ggx1 * ggx2;
            }
            
            // Cook-Torrance BRDF specular calculation
            vec3 specularBRDF(vec3 N, vec3 L, vec3 V, vec3 baseF0, float roughness) {
                vec3 H = normalize(V + L);
                
                float NdotV = max(dot(N, V), 0.0);
                float NdotL = max(dot(N, L), 0.0);
                
                // Calculate BRDF components
                vec3 F = fresnelSchlick(max(dot(H, V), 0.0), baseF0);
                float D = distributionGGX(N, H, roughness);
                float G = geometrySmith(N, V, L, roughness);
                
                // Calculate specular component
                vec3 numerator = D * G * F;
                float denominator = 4.0 * max(NdotV, 0.001) * max(NdotL, 0.001);
                vec3 specular = numerator / denominator;
                
                return specular;
            }
            
            // PCF shadow mapping for smoother shadows
            float shadowCalculationPCF(vec4 fragPosLightSpace, sampler2D shadowMap, vec3 normal, vec3 lightDir) {
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
                
                // Apply bias with slope-scale adjustment
                float bias = uShadowBias;
                
                // Calculate slope factor based on surface angle relative to light
                // Surfaces perpendicular to light get more bias to reduce shadow acne on steep angles
                float slopeFactor = max(0.0, 1.0 - dot(normalize(normal), normalize(lightDir)));
                bias += slopeFactor * uShadowSlopeScaleBias;
                
                // Softness factor for PCF sampling spread (0 = hard, 1 = soft)
                float softnessFactor = clamp(uShadowSoftness, 0.0, 1.0);
                
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
                            // Apply softness factor to sampling coordinates (0 = no spread/hard, 1 = full spread/soft)
                            vec2 offset = vec2(x, y) * texelSize * mix(0.0, 2.0, softnessFactor);
                            
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
            }`;

        return `#version 300 es
    precision mediump float;
    precision mediump sampler2DArray;
    
    in vec3 vColor;
    in float vAlpha;
    in vec2 vTexCoord;
    in float vLighting;
    flat in float vTextureIndex;
    flat in float vUseTexture;
    in vec4 vFragPosLightSpace;
    in vec3 vNormal;
    in vec3 vTangent;
    in vec3 vBitangent;
    in vec3 vFragPos;
    in vec3 vWorldPos;  // Position in world space
    in vec3 vViewDir;   // Direction to camera
    in float vFragDepth;  // For logarithmic depth
    flat in float vNormalMapIndex;
    flat in float vMetallicRoughnessMapIndex;
    flat in float vEmissiveMapIndex;
    
    // Texture array for albedo textures
    uniform sampler2DArray uTextureArray;
    
    // Shadow map with explicit separate binding
    // Always use sampler2D for shadow maps
    uniform sampler2D uShadowMap;
    uniform highp samplerCubeShadow uPointShadowMap;
    
    // Light counts
    uniform int uDirectionalLightCount;
    uniform int uPointLightCount;
    uniform int uSpotLightCount;
    
    // Light data textures - each light has multiple pixels for all properties
    uniform sampler2D uDirectionalLightData;
    uniform vec2 uDirectionalLightTextureSize;
    uniform sampler2D uPointLightData;
    uniform vec2 uPointLightTextureSize;
    
    // Legacy directional light uniforms (for backward compatibility)
    uniform vec3 uLightPos;
    uniform vec3 uLightDir;
    uniform float uLightIntensity; 
    uniform vec3 uLightColor;
    
    // Legacy point light uniforms (for backward compatibility)
    uniform vec3 uPointLightPos; 
    uniform float uPointLightIntensity;
    uniform float uLightRadius; 
    uniform vec3 uPointLightColor;
    
    // Legacy second point light uniforms
    uniform vec3 uPointLightPos1;
    uniform float uPointLightIntensity1;
    uniform float uPointLightRadius1;
    uniform vec3 uPointLightColor1;
    uniform highp samplerCubeShadow uPointShadowMap1;
    uniform bool uPointShadowsEnabled1;
    
    // Additional point light shadow maps
    uniform highp samplerCubeShadow uPointShadowMap2;
    uniform bool uPointShadowsEnabled2;
    uniform highp samplerCubeShadow uPointShadowMap3;
    uniform bool uPointShadowsEnabled3;
    
    uniform bool uShadowsEnabled;
    uniform bool uPointShadowsEnabled; // Enable point light shadows
    //uniform int uPointLightCount; // Number of point lights
    uniform float uShadowBias; // Shadow bias to reduce self-shadowing artifacts
    uniform float uShadowSlopeScaleBias; // Additional bias based on surface slope relative to light
    uniform float uShadowMapSize; // Shadow map size for texture calculations
    uniform float uShadowSoftness; // Controls shadow edge softness (0-1)
    uniform int uPCFSize; // Controls PCF kernel size (1, 3, 5, 7, 9)
    uniform bool uPCFEnabled; // Controls whether PCF filtering is enabled
    uniform float uFarPlane; // Far plane for logarithmic depth buffer
    uniform float uPointShadowFarPlane; // Far plane for point light shadow depth comparison
    uniform bool uDirectionalLightAttenuation; // Enable attenuation for directional lights
    uniform float uNormalMapStrength; // Normal map intensity
    
    // PBR Material properties
    uniform float uRoughness;
    uniform float uMetallic;
    uniform float uIOR;
    uniform sampler2D uMaterialPropertiesTexture;
    
    // Lighting intensity controls
    uniform float uAmbientIntensity;
    uniform float uShadowDarkness;
    
    // Structures to hold light data
    struct DirectionalLight {
        vec3 position;
        vec3 direction;
        vec3 color;
        float intensity;
        bool shadowsEnabled;
    };
    
    struct PointLight {
        vec3 position;
        vec3 color;
        float intensity;
        float radius;
        bool shadowsEnabled;
    };
    
    // Functions to extract light data from textures
    DirectionalLight getDirectionalLight(int index) {
        // Each light takes 3 pixels horizontally
        int basePixel = index * 3;
        
        // Calculate UV coordinates for each pixel
        // First pixel: position + enabled
        float u1 = (float(basePixel) + 0.5) / uDirectionalLightTextureSize.x;
        // Second pixel: direction + shadowEnabled
        float u2 = (float(basePixel + 1) + 0.5) / uDirectionalLightTextureSize.x;
        // Third pixel: color + intensity
        float u3 = (float(basePixel + 2) + 0.5) / uDirectionalLightTextureSize.x;
        
        // Use centered V coordinate (there's only one row)
        float v = 0.5 / uDirectionalLightTextureSize.y;
        
        // Sample pixels from texture
        vec4 posData = texture(uDirectionalLightData, vec2(u1, v));
        vec4 dirData = texture(uDirectionalLightData, vec2(u2, v));
        vec4 colorData = texture(uDirectionalLightData, vec2(u3, v));
        
        // Create and populate the light structure
        DirectionalLight light;
        light.position = posData.xyz;
        light.direction = dirData.xyz;
        light.color = colorData.rgb;
        light.intensity = colorData.a;
        light.shadowsEnabled = dirData.a > 0.5;
        
        return light;
    }
    
    PointLight getPointLight(int index) {
        // Each light takes 3 pixels horizontally
        int basePixel = index * 3;
        
        // Calculate UV coordinates for each pixel
        // First pixel: position + enabled
        float u1 = (float(basePixel) + 0.5) / uPointLightTextureSize.x;
        // Second pixel: color + intensity
        float u2 = (float(basePixel + 1) + 0.5) / uPointLightTextureSize.x;
        // Third pixel: radius + shadowEnabled + padding
        float u3 = (float(basePixel + 2) + 0.5) / uPointLightTextureSize.x;
        
        // Use centered V coordinate (there's only one row)
        float v = 0.5 / uPointLightTextureSize.y;
        
        // Sample pixels from texture
        vec4 posData = texture(uPointLightData, vec2(u1, v));
        vec4 colorData = texture(uPointLightData, vec2(u2, v));
        vec4 radiusData = texture(uPointLightData, vec2(u3, v));
        
        // Create and populate the light structure
        PointLight light;
        light.position = posData.xyz;
        light.color = colorData.rgb;
        light.intensity = colorData.a;
        light.radius = radiusData.r;
        light.shadowsEnabled = radiusData.g > 0.5;
        
        return light;
    }
    
    out vec4 fragColor;
    
    // Shadow mapping functions
    ${shadowFunctions}
    
    // Normal mapping functions
    ${this.normalMappingFunctions}
    
    // Point light shadow functions
    // Calculate shadow for omnidirectional point light with cubemap shadow
    float pointShadowCalculation(vec3 fragPos, vec3 lightPos, highp samplerCubeShadow shadowMap, float farPlane) {
        // Calculate fragment-to-light vector
        vec3 fragToLight = fragPos - lightPos;
        
        // Get current distance from fragment to light
        float currentDepth = length(fragToLight);
        
        // Normalize to [0,1] range using far plane
        currentDepth = currentDepth / farPlane;
        
        // Apply bias
        float bias = uShadowBias;
        
        // Hardware depth comparison (texture params set COMPARE_MODE + COMPARE_FUNC)
        // Returns 1.0 if passes comparison, 0.0 if fails
        float shadow = texture(shadowMap, vec4(fragToLight, currentDepth - bias));
        
        return shadow;
    }
    
    // PCF shadow calculation for omnidirectional point light
    float pointShadowCalculationPCF(vec3 fragPos, vec3 lightPos, highp samplerCubeShadow shadowMap, float farPlane) {
        // Check if PCF is disabled - fall back to basic shadow calculation
        if (!uPCFEnabled) {
            return pointShadowCalculation(fragPos, lightPos, shadowMap, farPlane);
        }
        
        // Calculate fragment-to-light vector (will be used as cubemap direction)
        vec3 fragToLight = fragPos - lightPos;
        
        // Get current distance from fragment to light
        float currentDepth = length(fragToLight);
        
        // Normalize to [0,1] range using far plane
        currentDepth = currentDepth / farPlane;
        
        // Apply bias from uniform (decoupled from softness)
        float bias = uShadowBias;
        
        // Softness factor for PCF sampling spread (0 = hard, 1 = soft)
        float softnessFactor = clamp(uShadowSoftness, 0.0, 1.0);
        
        // Set up PCF sampling
        float shadow = 0.0;
        int samples = 0;
        float diskRadius = 0.01 * softnessFactor; // Radius of sampling cone based on softness (0-1)
        
        // Generate a tangent space TBN matrix for sampling in a cone
        vec3 absFragToLight = abs(fragToLight);
        vec3 tangent, bitangent;
        
        // Find least used axis to avoid precision issues
        if (absFragToLight.x <= absFragToLight.y && absFragToLight.x <= absFragToLight.z) {
            tangent = vec3(0.0, fragToLight.z, -fragToLight.y);
        } else if (absFragToLight.y <= absFragToLight.x && absFragToLight.y <= absFragToLight.z) {
            tangent = vec3(fragToLight.z, 0.0, -fragToLight.x);
        } else {
            tangent = vec3(fragToLight.y, -fragToLight.x, 0.0);
        }
        
        tangent = normalize(tangent);
        bitangent = normalize(cross(fragToLight, tangent));
        
        // Determine sample count based on PCF size
        int pcfRadius = uPCFSize / 2;
        int maxSamples = (pcfRadius * 2 + 1) * (pcfRadius * 2 + 1);
        
        for (int i = 0; i < maxSamples; i++) {
            // Skip if we exceed the requested PCF size
            int x = (i % 9) - 4;
            int y = (i / 9) - 4;
            
            if (abs(x) <= pcfRadius && abs(y) <= pcfRadius) {
                // Generate offset direction based on x, y grid position
                float angle = float(x) * (3.14159265359 / float(pcfRadius + 1)); // Convert x to angle
                float distance = float(y) + 0.1; // Add small offset to avoid zero
                
                // Calculate offset direction in tangent space
                vec3 offset = tangent * (cos(angle) * distance * diskRadius) + 
                              bitangent * (sin(angle) * distance * diskRadius);
                
                // Sample from the cubemap with offset and hardware comparison
                 vec3 sampleDir = normalize(fragToLight + offset);
                 shadow += texture(shadowMap, vec4(sampleDir, currentDepth - bias));
                samples++;
            }
        }
        
        // Average all samples
        shadow /= float(max(samples, 1));
        
        return shadow;
    }
    
    void main() {
        // Base color calculation
        vec4 baseColor;
        if (vUseTexture > 0.5) {  // Check if this fragment uses texture
            baseColor = texture(uTextureArray, vec3(vTexCoord, vTextureIndex));
            baseColor.a *= vAlpha;  // Apply triangle alpha to textured fragments
        } else {
            baseColor = vec4(vColor, vAlpha);
        }
        
        // Sample normal map if available
        vec3 surfaceNormal = normalize(vNormal);
        int normalMapIdx = int(vNormalMapIndex);
        if (normalMapIdx >= 0) {
            vec3 sampledNormal = sampleNormalMap(uTextureArray, normalMapIdx, vTexCoord, vNormal, vTangent, vBitangent);
            // Blend between surface normal and sampled normal based on strength
            surfaceNormal = normalize(mix(surfaceNormal, sampledNormal, uNormalMapStrength));
        }
        
        // Sample emissive map if available
        vec3 emissiveColor = vec3(0.0);
        int emissiveMapIdx = int(vEmissiveMapIndex);
        if (emissiveMapIdx >= 0) {
            emissiveColor = texture(uTextureArray, vec3(vTexCoord, emissiveMapIdx)).rgb;
        }
        
        // Compute PBR lighting
        vec3 N = surfaceNormal;
        vec3 V = normalize(vViewDir);
        vec3 L = normalize(-uLightDir); // Negate for consistency with shadow mapping
        
        // Get material properties
        float roughness = uRoughness;
        float metallic = uMetallic;
        float ior = uIOR;
        
        if (vUseTexture > 0.5) {
            // Sample per-texture material properties
            float textureCoord = (vTextureIndex + 0.5) / float(textureSize(uMaterialPropertiesTexture, 0).x);
            vec4 materialProps = texture(uMaterialPropertiesTexture, vec2(textureCoord, 0.5));
            roughness = materialProps.r;
            metallic = materialProps.g;
            ior = materialProps.b;
        }
        
        // Calculate F0 from IOR: F0 = ((n - 1) / (n + 1))^2
        float f0 = pow((ior - 1.0) / (ior + 1.0), 2.0);
        vec3 baseF0 = mix(vec3(f0), baseColor.rgb, metallic);
        
        // Calculate specular BRDF
        vec3 specular = specularBRDF(N, L, V, baseF0, roughness);
        
        // Diffuse component with metallic
        vec3 kD = (vec3(1.0) - specular) * (1.0 - metallic);
        
        // Calculate shadow factor
        float shadow = 1.0;
        if (uShadowsEnabled) {
            float shadowFactor = shadowCalculationPCF(vFragPosLightSpace, uShadowMap, N, L);
            shadow = 1.0 - (1.0 - shadowFactor) * uShadowDarkness;
        }
        
        // Ambient lighting
        vec3 ambient = vec3(uAmbientIntensity);
        
        // Diffuse lighting with light color
        vec3 lightColor = length(uLightColor) > 0.0 ? uLightColor : vec3(0.3);
        float diffuse = max(dot(N, L), 0.0);
        vec3 diffuseLighting = lightColor * diffuse * max(uLightIntensity, 1.0);
        
        // Combine diffuse and ambient
        vec3 phongDiffuse = diffuseLighting + ambient;
        
        // Calculate point light contributions
        vec3 pointLightColors = vec3(0.0);
        
        // Process all point lights from the data texture with PBR
        for (int i = 0; i < uPointLightCount; i++) {
            if (i >= 100) break;
            
            PointLight light = getPointLight(i);
            
            // Direction from fragment to point light
            vec3 pointL = normalize(light.position - vWorldPos);
            float pointNdotL = max(dot(N, pointL), 0.0);
            
            // Distance attenuation
            float pointDistance = length(vWorldPos - light.position);
            float pointAttenuation = 1.0 / (1.0 + (pointDistance * pointDistance) / (light.radius * light.radius));
            
            // PBR specular for point light
            vec3 pointSpecular = specularBRDF(N, pointL, V, baseF0, roughness);
            vec3 pointKD = (vec3(1.0) - pointSpecular) * (1.0 - metallic);
            
            // Shadow for point light
            float pointShadow = 1.0;
            if (light.shadowsEnabled) {
                int lightIdx = i % 4;
                switch(lightIdx) {
                    case 0:
                        if (uPointShadowsEnabled) {
                            float pointShadowFactor = pointShadowCalculationPCF(vFragPos, light.position, uPointShadowMap, uPointShadowFarPlane);
                            pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
                        }
                        break;
                    case 1:
                        if (uPointShadowsEnabled1) {
                            float pointShadowFactor = pointShadowCalculationPCF(vFragPos, light.position, uPointShadowMap1, uPointShadowFarPlane);
                            pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
                        }
                        break;
                    case 2:
                        if (uPointShadowsEnabled2) {
                            float pointShadowFactor = pointShadowCalculationPCF(vFragPos, light.position, uPointShadowMap2, uPointShadowFarPlane);
                            pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
                        }
                        break;
                    case 3:
                        if (uPointShadowsEnabled3) {
                            float pointShadowFactor = pointShadowCalculationPCF(vFragPos, light.position, uPointShadowMap3, uPointShadowFarPlane);
                            pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
                        }
                        break;
                }
            }
            
            // PBR point light contribution
            pointLightColors += (pointKD * baseColor.rgb * RECIPROCAL_PI + pointSpecular) * pointNdotL * 
                    light.intensity * pointAttenuation * pointShadow * light.color;
        }
        
        // Legacy point light handling with PBR - only use if no new lights
        if (uPointLightCount == 0) {
            // First legacy point light
            vec3 pointL = normalize(uPointLightPos - vWorldPos);
            float pointNdotL = max(dot(N, pointL), 0.0);
            
            float pointDistance = length(vWorldPos - uPointLightPos);
            float pointAttenuation = 1.0 / (1.0 + (pointDistance * pointDistance) / (uLightRadius * uLightRadius));
            
            vec3 pointSpecular = specularBRDF(N, pointL, V, baseF0, roughness);
            vec3 pointKD = (vec3(1.0) - pointSpecular) * (1.0 - metallic);
            
            float pointShadow = 1.0;
            if (uPointShadowsEnabled) {
                float pointShadowFactor = pointShadowCalculationPCF(vFragPos, uPointLightPos, uPointShadowMap, uPointShadowFarPlane);
                pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
            }
            
            pointLightColors = (pointKD * baseColor.rgb * RECIPROCAL_PI + pointSpecular) * pointNdotL * 
                    uPointLightIntensity * pointAttenuation * pointShadow * uPointLightColor;
            
            // Legacy second point light
            if (uPointLightCount > 1) {
                pointL = normalize(uPointLightPos1 - vWorldPos);
                pointNdotL = max(dot(N, pointL), 0.0);
                
                pointDistance = length(vWorldPos - uPointLightPos1);
                pointAttenuation = 1.0 / (1.0 + (pointDistance * pointDistance) / (uPointLightRadius1 * uPointLightRadius1));
                
                pointSpecular = specularBRDF(N, pointL, V, baseF0, roughness);
                pointKD = (vec3(1.0) - pointSpecular) * (1.0 - metallic);
                
                pointShadow = 1.0;
                if (uPointShadowsEnabled1) {
                    float pointShadowFactor = pointShadowCalculationPCF(vFragPos, uPointLightPos1, uPointShadowMap1, uPointShadowFarPlane);
                    pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
                }
                
                pointLightColors += (pointKD * baseColor.rgb * RECIPROCAL_PI + pointSpecular) * pointNdotL * 
                        uPointLightIntensity1 * pointAttenuation * pointShadow * uPointLightColor1;
            }
        }
        
        // Calculate directional light contribution with PBR
        vec3 directionalColor = phongDiffuse * baseColor.rgb;
        directionalColor += specular;
        
        if (uShadowsEnabled) {
            directionalColor *= shadow;
        }
        
        // Combine lighting contributions
        vec3 color = directionalColor;
        
        // Add point light if present
        if (uPointLightCount > 0) {
            color = directionalColor + pointLightColors;
        }
        
        // Add emissive
        color += emissiveColor;
        
        fragColor = vec4(color, baseColor.a);
        
        // Logarithmic depth buffer encoding
        // Increases precision for distant fragments
        // Formula: log2(depth) / log2(farPlane + 1.0)
        float logDepth = log2(vFragDepth) / log2(uFarPlane + 1.0);
        gl_FragDepth = logDepth;
    }`;
    }

    //--------------------------------------------------------------------------
    // VIRTUALBOY SHADER VARIANT
    //--------------------------------------------------------------------------

    /**
     * VirtualBoy vertex shader
     * @returns {string} - Vertex shader source code
     */
    getVirtualBoyVertexShader() {
        return `#version 300 es
        in vec3 aPosition;
        in vec3 aNormal;
        in vec3 aColor;
        in float aAlpha;
        
        // Skeletal animation attributes
        in ivec4 aBoneIndices;
        in vec4 aBoneWeights;
        
        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        uniform vec3 uModelPos;
        uniform vec4 uModelRotation;
        uniform float uModelScale;
        uniform vec3 uLightDir;
        
        // Bone matrices for skeletal animation (max 256 bones)
        layout(std140) uniform BoneMatrices {
            mat4 matrices[256];
        } boneData;
        
        flat out float vLighting;
        out vec3 vBarycentricCoord;
        out float vAlpha;
        out float vFragDepth;  // For logarithmic depth buffer
        
        ${this.getMatrixConstructionHelpers()}
        
        void main() {
            // Apply skeletal animation if bone weights are present
            vec3 skinnedPosition = aPosition;
            vec3 skinnedNormal = aNormal;
            
            float totalWeight = aBoneWeights.x + aBoneWeights.y + aBoneWeights.z + aBoneWeights.w;
            if (totalWeight > 0.001) {
                // Normalize weights in case they don't sum to 1.0
                vec4 normalizedWeights = aBoneWeights / totalWeight;
                
                skinnedPosition = vec3(0.0);
                skinnedNormal = vec3(0.0);
                
                // Apply up to 4 bone influences
                for (int i = 0; i < 4; i++) {
                    mat4 boneMatrix = boneData.matrices[aBoneIndices[i]];
                    skinnedPosition += (boneMatrix * vec4(aPosition, 1.0)).xyz * normalizedWeights[i];
                    skinnedNormal += (boneMatrix * vec4(aNormal, 0.0)).xyz * normalizedWeights[i];
                }
            }
            
            mat4 modelMatrix = buildModelMatrix(uModelPos, uModelRotation, uModelScale);
            vec4 worldPos = modelMatrix * vec4(skinnedPosition, 1.0);
            gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
            vec3 worldNormal = normalize(quaternionToMatrix(uModelRotation) * skinnedNormal);
            // Negate light direction to be consistent with other shaders
            vLighting = max(0.3, min(1.0, dot(worldNormal, normalize(-uLightDir))));
            
            vAlpha = aAlpha;
            float id = float(gl_VertexID % 3);
            vBarycentricCoord = vec3(id == 0.0, id == 1.0, id == 2.0);
            
            // Store depth for logarithmic depth buffer
            vFragDepth = 1.0 + gl_Position.w;
        }`;
    }

    /**
     * VirtualBoy fragment shader
     * @returns {string} - Fragment shader source code
     */
    getVirtualBoyFragmentShader() {
        return `#version 300 es
        precision mediump float;
        flat in float vLighting;
        in vec3 vBarycentricCoord;
        in float vAlpha;
        in float vFragDepth;  // For logarithmic depth buffer
        out vec4 fragColor;
        
        uniform float uFarPlane;  // For logarithmic depth
        
        void main() {
            float edgeWidth = 1.0;
            vec3 d = fwidth(vBarycentricCoord);
            vec3 a3 = smoothstep(vec3(0.0), d * edgeWidth, vBarycentricCoord);
            float edge = min(min(a3.x, a3.y), a3.z);
            
            if (edge < 0.9) {
                fragColor = vec4(1.0, 0.0, 0.0, vAlpha) * vLighting;
            } else {
                fragColor = vec4(0.0, 0.0, 0.0, vAlpha);
            }
            
            // Logarithmic depth buffer encoding
            float logDepth = log2(vFragDepth) / log2(uFarPlane + 1.0);
            gl_FragDepth = logDepth;
        }`;
    }
}
