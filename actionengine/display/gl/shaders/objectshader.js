// actionengine/display/gl/shaders/objectshader.js

class ObjectShader {
    constructor() {
        // Store references to different object shader variants
        this.variants = {
            default: {
                getVertexShader: this.getDefaultVertexShader,
                getFragmentShader: this.getDefaultFragmentShader
            },
            pbr: {
                getVertexShader: this.getPBRVertexShader,
                getFragmentShader: this.getPBRFragmentShader
            },
            virtualboy: {
                getVertexShader: this.getVirtualBoyVertexShader,
                getFragmentShader: this.getVirtualBoyFragmentShader
            }
            // Additional variants can be added here
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
     * @param {boolean} isWebGL2 - Whether WebGL2 is being used
     * @returns {string} - Vertex shader source code
     */
    getVertexShader(isWebGL2) {
        return this.variants[this.currentVariant].getVertexShader.call(this, isWebGL2);
    }

    /**
     * Get the current variant's fragment shader
     * @param {boolean} isWebGL2 - Whether WebGL2 is being used
     * @returns {string} - Fragment shader source code
     */
    getFragmentShader(isWebGL2) {
        return this.variants[this.currentVariant].getFragmentShader.call(this, isWebGL2);
    }

    //--------------------------------------------------------------------------
    // DEFAULT SHADER VARIANT
    //--------------------------------------------------------------------------

    /**
     * Default object vertex shader
     * @param {boolean} isWebGL2 - Whether WebGL2 is being used
     * @returns {string} - Vertex shader source code
     */
    getDefaultVertexShader(isWebGL2) {
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

    /**
     * Default object fragment shader
     * @param {boolean} isWebGL2 - Whether WebGL2 is being used
     * @returns {string} - Fragment shader source code
     */
    getDefaultFragmentShader(isWebGL2) {
        // Directly include shadow calculation functions
        const shadowFunctions = isWebGL2
            ? `
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
            }`
            : `
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
    
    // Texture array for albedo textures
    ${isWebGL2 ? "uniform sampler2DArray uTextureArray;" : "uniform sampler2D uTexture;"}
    
    // Shadow map with explicit separate binding
    // Always use sampler2D for shadow maps
    uniform sampler2D uShadowMap;
    ${isWebGL2 ? "uniform samplerCube uPointShadowMap;" : "uniform sampler2D uPointShadowMap;"}
    
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
    uniform samplerCube uPointShadowMap1;
    uniform bool uPointShadowsEnabled1;
    
    // Additional point light shadow maps
    uniform samplerCube uPointShadowMap2;
    uniform bool uPointShadowsEnabled2;
    uniform samplerCube uPointShadowMap3;
    uniform bool uPointShadowsEnabled3;
    
    uniform float uIntensityFactor; // Factor controlling intensity effect in default shader
    uniform bool uShadowsEnabled;
    uniform bool uPointShadowsEnabled; // Enable point light shadows
    //uniform int uPointLightCount; // Number of point lights
    uniform float uShadowBias; // Shadow bias uniform for controlling shadow acne
    uniform float uShadowMapSize; // Shadow map size for texture calculations
    uniform float uShadowSoftness; // Controls shadow edge softness (0-1)
    uniform int uPCFSize; // Controls PCF kernel size (1, 3, 5, 7, 9)
    uniform bool uPCFEnabled; // Controls whether PCF filtering is enabled
    uniform float uFarPlane; // Far plane for point light shadows
    
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
    
    ${isWebGL2 ? "out vec4 fragColor;" : ""}
    
    // Shadow mapping functions
    ${shadowFunctions}
    
    // Point light shadow functions
    ${
        isWebGL2
            ? `
    // Calculate shadow for omnidirectional point light with cubemap shadow
    float pointShadowCalculation(vec3 fragPos, vec3 lightPos, samplerCube shadowMap, float farPlane) {
        // Calculate fragment-to-light vector
        vec3 fragToLight = fragPos - lightPos;
        
        // Get current distance from fragment to light
        float currentDepth = length(fragToLight);
        
        // Normalize to [0,1] range using far plane
        currentDepth = currentDepth / farPlane;
        
        // Apply bias
        float bias = uShadowBias;
        
        // Sample from cubemap shadow map in the direction of fragToLight
        float closestDepth = texture(shadowMap, fragToLight).r;
        
        // Check if fragment is in shadow
        float shadow = currentDepth - bias > closestDepth ? 0.0 : 1.0;
        
        return shadow;
    }
    
    // PCF shadow calculation for omnidirectional point light
    float pointShadowCalculationPCF(vec3 fragPos, vec3 lightPos, samplerCube shadowMap, float farPlane) {
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
        
        // Apply bias, adjusted by softness
        float softnessFactor = max(0.1, uShadowSoftness); // Ensure minimum softness
        float bias = uShadowBias * softnessFactor;
        
        // Set up PCF sampling
        float shadow = 0.0;
        int samples = 0;
        float diskRadius = 0.01 * softnessFactor; // Adjust based on softness and distance
        
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
                
                // Sample from the cubemap with offset
                float closestDepth = texture(shadowMap, normalize(fragToLight + offset)).r;
                
                // Check if fragment is in shadow with bias
                shadow += currentDepth - bias > closestDepth ? 0.0 : 1.0;
                samples++;
            }
        }
        
        // Average all samples
        shadow /= float(max(samples, 1));
        
        return shadow;
    }`
            : `
    // For WebGL1 without cubemap support, calculate shadow from a single face
    float pointShadowCalculation(vec3 fragPos, vec3 lightPos, sampler2D shadowMap, float farPlane) {
        // We can't do proper cubemap in WebGL1, so this is just an approximation
        // using the first face of what would be a cubemap
        vec3 fragToLight = fragPos - lightPos;
        
        // Get current distance from fragment to light
        float currentDepth = length(fragToLight);
        
        // Normalize to [0,1] range using far plane
        currentDepth = currentDepth / farPlane;
        
        // Simple planar mapping for the single shadow map face
        // This is just a fallback - won't look great but better than nothing
        vec2 shadowCoord = vec2(
            (fragToLight.x / abs(fragToLight.x + 0.0001) + 1.0) * 0.25,
            (fragToLight.y / abs(fragToLight.y + 0.0001) + 1.0) * 0.25
        );
        
        // Apply bias
        float bias = uShadowBias;
        
        // Sample from shadow map 
        vec4 packedDepth = texture2D(shadowMap, shadowCoord);
        float closestDepth = unpackDepth(packedDepth);
        
        // Check if fragment is in shadow
        float shadow = currentDepth - bias > closestDepth ? 0.0 : 1.0;
        
        return shadow;
    }
    
    // Simplified PCF for WebGL1 single-face approximation
    float pointShadowCalculationPCF(vec3 fragPos, vec3 lightPos, sampler2D shadowMap, float farPlane) {
        // Check if PCF is disabled - fall back to basic shadow calculation
        if (!uPCFEnabled) {
            return pointShadowCalculation(fragPos, lightPos, shadowMap, farPlane);
        }
        
        // Calculate fragment-to-light vector
        vec3 fragToLight = fragPos - lightPos;
        
        // Get current distance from fragment to light
        float currentDepth = length(fragToLight);
        
        // Normalize to [0,1] range using far plane
        currentDepth = currentDepth / farPlane;
        
        // Simple planar mapping for the single shadow map face
        vec2 shadowCoord = vec2(
            (fragToLight.x / abs(fragToLight.x + 0.0001) + 1.0) * 0.25,
            (fragToLight.y / abs(fragToLight.y + 0.0001) + 1.0) * 0.25
        );
        
        // Apply bias
        float softnessFactor = max(0.1, uShadowSoftness); // Ensure minimum softness
        float bias = uShadowBias * softnessFactor;
        
        // Set up PCF sampling
        float shadow = 0.0;
        float texelSize = 1.0 / uShadowMapSize;
        
        // Determine PCF kernel radius based on uPCFSize
        int pcfRadius = int(uPCFSize) / 2;
        float totalSamples = 0.0;
        
        // Limit loop size for WebGL1
        for(int x = -4; x <= 4; ++x) {
            for(int y = -4; y <= 4; ++y) {
                // Skip samples outside the requested kernel radius
                if (abs(x) <= pcfRadius && abs(y) <= pcfRadius) {
                    // Apply softness factor to sampling coordinates
                    vec2 offset = vec2(x, y) * texelSize * mix(1.0, 2.0, uShadowSoftness);
                    
                    vec4 packedDepth = texture2D(shadowMap, shadowCoord + offset);
                    float pcfDepth = unpackDepth(packedDepth);
                    shadow += currentDepth - bias > pcfDepth ? 0.0 : 1.0;
                    totalSamples += 1.0;
                }
            }
        }
        
        // Average samples
        shadow /= max(1.0, totalSamples);
        
        return shadow;
    }`
    }
    
    void main() {
        // Base color calculation
        vec4 baseColor;
        if (vUseTexture > 0.5) {  // Check if this fragment uses texture
            ${isWebGL2 ? "baseColor = texture(uTextureArray, vec3(vTexCoord, vTextureIndex));" : "baseColor = texture2D(uTexture, vTexCoord);"}
        } else {
            baseColor = vec4(vColor, 1.0);
        }
        
        // Apply ambient and diffuse lighting
        float ambient = 0.3; // Higher ambient to ensure dungeon isn't too dark
        // Negate light direction to be consistent with shadow mapping convention
        float diffuse = max(0.0, dot(normalize(vNormal), normalize(-uLightDir)));
        
        // Apply light intensity directly - use a more dramatic effect
        // Scale from 0 (no light) to very bright at high intensity values
        float intensity = uLightIntensity / 100.0; // More aggressive scaling
        diffuse = diffuse * clamp(intensity, 0.1, 10.0); // Allow for dramatically brighter light
        
        // Calculate shadow factor for directional light
        float shadow = 1.0;
        if (uShadowsEnabled) {
            // Use explicit texture lookup to avoid sampler conflicts
            float shadowFactor = shadowCalculationPCF(vFragPosLightSpace, uShadowMap);
            // Match the PBR shader calculation - shadows should be darker
            shadow = 1.0 - (1.0 - shadowFactor) * 0.8;
        }
        
        // Calculate point light contributions
        vec3 pointLightColors = vec3(0.0);
        
        // Process all point lights from the data texture
        for (int i = 0; i < uPointLightCount; i++) {
            if (i >= 100) break; // Reasonable safety limit
            
            // Extract light data from texture
            PointLight light = getPointLight(i);
            
            vec3 lightDir = normalize(vFragPos - light.position);
            float pointDiffuse = max(0.0, dot(normalize(vNormal), -lightDir));
            
            // Calculate distance attenuation
            float distance = length(vFragPos - light.position);
            float attenuation = 1.0 / (1.0 + (distance * distance) / (light.radius * light.radius));
            
            // Calculate shadow for point light
            float pointShadow = 1.0;
            if (light.shadowsEnabled) {
                // Handle first 8 shadow maps with a switch statement
                int lightIdx = i % 8; // Limit to 8 shadowed lights
                switch(lightIdx) {
                    case 0:
                        if (uPointShadowsEnabled) {
                            float pointShadowFactor = pointShadowCalculationPCF(vFragPos, light.position, uPointShadowMap, uFarPlane);
                            pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
                        }
                        break;
                    case 1:
                        if (uPointShadowsEnabled1) {
                            float pointShadowFactor = pointShadowCalculationPCF(vFragPos, light.position, uPointShadowMap1, uFarPlane);
                            pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
                        }
                        break;
                    case 2:
                        if (uPointShadowsEnabled2) {
                            float pointShadowFactor = pointShadowCalculationPCF(vFragPos, light.position, uPointShadowMap2, uFarPlane);
                            pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
                        }
                        break;
                    case 3:
                        if (uPointShadowsEnabled3) {
                            float pointShadowFactor = pointShadowCalculationPCF(vFragPos, light.position, uPointShadowMap3, uFarPlane);
                            pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
                        }
                        break;
                }
            }
            
            // Calculate final point light contribution
            float pointLightFactor = max(0.0, pointDiffuse * attenuation * pointShadow);
            
            // Add contribution from this light
            pointLightColors += baseColor.rgb * pointLightFactor * light.color * light.intensity;
        }
        
        // Legacy point light handling - only use if no new lights are available
        if (uPointLightCount == 0) {
            // Backward compatibility for first point light
            vec3 lightDir = normalize(vFragPos - uPointLightPos);
            float pointDiffuse = max(0.0, dot(normalize(vNormal), -lightDir));
            
            float distance = length(vFragPos - uPointLightPos);
            float attenuation = 1.0 / (1.0 + (distance * distance) / (uLightRadius * uLightRadius));
            
            float pointShadow = 1.0;
            if (uPointShadowsEnabled) {
                float pointShadowFactor = pointShadowCalculationPCF(vFragPos, uPointLightPos, uPointShadowMap, uFarPlane);
                pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
            }
            
            float pointLightFactor = max(0.0, pointDiffuse * attenuation * pointShadow);
            pointLightColors = baseColor.rgb * pointLightFactor * uPointLightColor * uPointLightIntensity;
            
            // Legacy second point light
            if (uPointLightCount > 1) {
                lightDir = normalize(vFragPos - uPointLightPos1);
                pointDiffuse = max(0.0, dot(normalize(vNormal), -lightDir));
                
                distance = length(vFragPos - uPointLightPos1);
                attenuation = 1.0 / (1.0 + (distance * distance) / (uPointLightRadius1 * uPointLightRadius1));
                
                pointShadow = 1.0;
                if (uPointShadowsEnabled1) {
                    float pointShadowFactor = pointShadowCalculationPCF(vFragPos, uPointLightPos1, uPointShadowMap1, uFarPlane);
                    pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
                }
                
                pointLightFactor = max(0.0, pointDiffuse * attenuation * pointShadow);
                pointLightColors += baseColor.rgb * pointLightFactor * uPointLightColor1 * uPointLightIntensity1;
            }
        }
        
        // Get total directional light contribution
        float lighting = ambient; // Start with ambient
        vec3 directionalContribution = vec3(0.0);
        
        // Process all directional lights from the data texture
        for (int i = 0; i < uDirectionalLightCount; i++) {
            if (i >= 100) break; // Reasonable safety limit
            
            // Extract light data from texture
            DirectionalLight light = getDirectionalLight(i);
            
            // Calculate diffuse component
            float lightDiffuse = max(0.0, dot(normalize(vNormal), normalize(-light.direction)));
            
            // Calculate shadow - currently only first light gets shadow mapping
            float lightShadow = 1.0;
            if (light.shadowsEnabled && i == 0 && uShadowsEnabled) {
                lightShadow = shadow;
            }
            
            // Add this light's contribution
            float contribution = lightDiffuse * lightShadow * light.intensity * uIntensityFactor;
            directionalContribution += baseColor.rgb * contribution * light.color;
        }
        
        // If there are no directional lights or for backward compatibility
        if (uDirectionalLightCount == 0 && uShadowsEnabled) {
            // Legacy directional light calculation
            float legacyContribution = diffuse * shadow * uLightIntensity * uIntensityFactor;
            directionalContribution = baseColor.rgb * (ambient + legacyContribution);
        } else if (uDirectionalLightCount == 0) {
            // Just ambient with no directional lights
            directionalContribution = baseColor.rgb * ambient;
        } else {
            // Add ambient to the direct contribution
            directionalContribution += baseColor.rgb * ambient;
        }
        
        // Properly handle the combination of both light types
        // This ensures they're physically correctly combined and don't over-brighten
        vec3 result = directionalContribution;
        
        // Only add point light if it exists
        if (uPointLightCount > 0) {
            // NO BLENDING - JUST ADD THE LIGHT CONTRIBUTIONS DIRECTLY
            // This eliminates the intensity-based blend factor that was causing inversion
            result = directionalContribution + pointLightColors;
            
            // OPTIONAL: To prevent over-brightening, we could clamp the result
            // but for now let's see what happens with direct addition
            // result = min(vec3(1.0), result);
        }
        
        ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(result, baseColor.a);
    }`;
    }

    //--------------------------------------------------------------------------
    // PBR SHADER VARIANT
    //--------------------------------------------------------------------------

    /**
     * PBR vertex shader
     * @param {boolean} isWebGL2 - Whether WebGL2 is being used
     * @returns {string} - Vertex shader source code
     */
    getPBRVertexShader(isWebGL2) {
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
    ${isWebGL2 ? "out" : "varying"} vec3 vFragPos;
    ${isWebGL2 ? "out" : "varying"} vec3 vColor;
    ${isWebGL2 ? "out" : "varying"} vec3 vViewDir;       // Direction to camera
    ${isWebGL2 ? "flat out" : "varying"} float vTextureIndex;
    ${isWebGL2 ? "out" : "varying"} vec2 vTexCoord;
    ${isWebGL2 ? "flat out" : "varying"} float vUseTexture;
    
    void main() {
        // Calculate world position
        vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
        vWorldPos = worldPos.xyz;
        vFragPos = worldPos.xyz;
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

    /**
     * PBR fragment shader
     * @param {boolean} isWebGL2 - Whether WebGL2 is being used
     * @returns {string} - Fragment shader source code
     */
    getPBRFragmentShader(isWebGL2) {
        // Directly include shadow calculation functions
        const shadowFunctions = isWebGL2
            ? `
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
        }
        
        // Calculate shadow for omnidirectional point light with cubemap shadow
        float pointShadowCalculation(vec3 fragPos, vec3 lightPos, samplerCube shadowMap, float farPlane) {
            // Calculate fragment-to-light vector
            vec3 fragToLight = fragPos - lightPos;
            
            // Get current distance from fragment to light
            float currentDepth = length(fragToLight);
            
            // Normalize to [0,1] range using far plane
            currentDepth = currentDepth / farPlane;
            
            // Apply bias
            float bias = uShadowBias;
            
            // Sample from cubemap shadow map in the direction of fragToLight
            float closestDepth = texture(shadowMap, fragToLight).r;
            
            // Check if fragment is in shadow
            float shadow = currentDepth - bias > closestDepth ? 0.0 : 1.0;
            
            return shadow;
        }
        
        // PCF shadow calculation for omnidirectional point light
        float pointShadowCalculationPCF(vec3 fragPos, vec3 lightPos, samplerCube shadowMap, float farPlane) {
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
            
            // Apply bias, adjusted by softness
            float softnessFactor = max(0.1, uShadowSoftness); // Ensure minimum softness
            float bias = uShadowBias * softnessFactor;
            
            // Set up PCF sampling
            float shadow = 0.0;
            int samples = 0;
            float diskRadius = 0.01 * softnessFactor; // Adjust based on softness and distance
            
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
                    
                    // Sample from the cubemap with offset
                    float closestDepth = texture(shadowMap, normalize(fragToLight + offset)).r;
                    
                    // Check if fragment is in shadow with bias
                    shadow += currentDepth - bias > closestDepth ? 0.0 : 1.0;
                    samples++;
                }
            }
            
            // Average all samples
            shadow /= float(max(samples, 1));
            
            return shadow;
        }`
            : `
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
        }
        
        // For WebGL1 without cubemap support, calculate shadow from a single face
        float pointShadowCalculation(vec3 fragPos, vec3 lightPos, sampler2D shadowMap, float farPlane) {
            // We can't do proper cubemap in WebGL1, so this is just an approximation
            // using the first face of what would be a cubemap
            vec3 fragToLight = fragPos - lightPos;
            
            // Get current distance from fragment to light
            float currentDepth = length(fragToLight);
            
            // Normalize to [0,1] range using far plane
            currentDepth = currentDepth / farPlane;
            
            // Simple planar mapping for the single shadow map face
            // This is just a fallback - won't look great but better than nothing
            vec2 shadowCoord = vec2(
                (fragToLight.x / abs(fragToLight.x + 0.0001) + 1.0) * 0.25,
                (fragToLight.y / abs(fragToLight.y + 0.0001) + 1.0) * 0.25
            );
            
            // Apply bias
            float bias = uShadowBias;
            
            // Sample from shadow map 
            vec4 packedDepth = texture2D(shadowMap, shadowCoord);
            float closestDepth = unpackDepth(packedDepth);
            
            // Check if fragment is in shadow
            float shadow = currentDepth - bias > closestDepth ? 0.0 : 1.0;
            
            return shadow;
        }
        
        // Simplified PCF for WebGL1 single-face approximation
        float pointShadowCalculationPCF(vec3 fragPos, vec3 lightPos, sampler2D shadowMap, float farPlane) {
            // Check if PCF is disabled - fall back to basic shadow calculation
            if (!uPCFEnabled) {
                return pointShadowCalculation(fragPos, lightPos, shadowMap, farPlane);
            }
            
            // Calculate fragment-to-light vector
            vec3 fragToLight = fragPos - lightPos;
            
            // Get current distance from fragment to light
            float currentDepth = length(fragToLight);
            
            // Normalize to [0,1] range using far plane
            currentDepth = currentDepth / farPlane;
            
            // Simple planar mapping for the single shadow map face
            vec2 shadowCoord = vec2(
                (fragToLight.x / abs(fragToLight.x + 0.0001) + 1.0) * 0.25,
                (fragToLight.y / abs(fragToLight.y + 0.0001) + 1.0) * 0.25
            );
            
            // Apply bias
            float softnessFactor = max(0.1, uShadowSoftness); // Ensure minimum softness
            float bias = uShadowBias * softnessFactor;
            
            // Set up PCF sampling
            float shadow = 0.0;
            float texelSize = 1.0 / uShadowMapSize;
            
            // Determine PCF kernel radius based on uPCFSize
            int pcfRadius = int(uPCFSize) / 2;
            float totalSamples = 0.0;
            
            // Limit loop size for WebGL1
            for(int x = -4; x <= 4; ++x) {
                for(int y = -4; y <= 4; ++y) {
                    // Skip samples outside the requested kernel radius
                    if (abs(x) <= pcfRadius && abs(y) <= pcfRadius) {
                        // Apply softness factor to sampling coordinates
                        vec2 offset = vec2(x, y) * texelSize * mix(1.0, 2.0, uShadowSoftness);
                        
                        vec4 packedDepth = texture2D(shadowMap, shadowCoord + offset);
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
${isWebGL2 ? "in" : "varying"} vec3 vFragPos;  // THIS IS IMPORTANT - now we include vFragPos from the vertex shader

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
uniform vec3 uLightPos;        // Used for directional light position
uniform vec3 uPointLightPos;  // Position for point light #0
uniform vec3 uLightDir;
uniform vec3 uCameraPos;
uniform float uLightIntensity;
uniform float uPointLightIntensity; // Separate uniform for point light intensity

// Shadow mapping
uniform sampler2D uShadowMap;
${isWebGL2 ? "uniform samplerCube uPointShadowMap;" : "uniform sampler2D uPointShadowMap;"}
uniform bool uShadowsEnabled;
uniform bool uPointShadowsEnabled; // Enable point light shadows
uniform int uPointLightCount; // Number of point lights
uniform float uLightRadius; // Point light radius

// Additional light textures and data
uniform sampler2D uDirectionalLightData;
uniform vec2 uDirectionalLightTextureSize;
uniform sampler2D uPointLightData;
uniform vec2 uPointLightTextureSize;
uniform int uDirectionalLightCount;

// Additional point lights
${isWebGL2 ? "uniform samplerCube uPointShadowMap1;" : "uniform sampler2D uPointShadowMap1;"}
${isWebGL2 ? "uniform samplerCube uPointShadowMap2;" : "uniform sampler2D uPointShadowMap2;"}
${isWebGL2 ? "uniform samplerCube uPointShadowMap3;" : "uniform sampler2D uPointShadowMap3;"}
uniform bool uPointShadowsEnabled1; // Second point light shadows
uniform bool uPointShadowsEnabled2; // Third point light shadows
uniform bool uPointShadowsEnabled3; // Fourth point light shadows
uniform float uPointLightIntensity1; // Second point light intensity
uniform vec3 uPointLightPos1; // Second point light position

uniform vec3 uPointLightColor1; // Second point light color
uniform float uPointLightRadius1; // Second point light radius
uniform float uShadowBias; // Shadow bias uniform for controlling shadow acne
uniform float uShadowMapSize; // Shadow map size for texture calculations
uniform float uShadowSoftness; // Controls shadow edge softness (0-1)
uniform int uPCFSize; // Controls PCF kernel size (1, 3, 5, 7, 9)
uniform bool uPCFEnabled; // Controls whether PCF filtering is enabled
uniform float uFarPlane; // Far plane for point light shadows
uniform vec3 uLightColor;      // Directional light color
uniform vec3 uPointLightColor; // Point light color



// Texture sampler
uniform sampler2DArray uPBRTextureArray;

${isWebGL2 ? "out vec4 fragColor;" : ""}

// Constants for performance
#define PI 3.14159265359
#define RECIPROCAL_PI 0.31830988618

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
        // The shadow map
        float shadowFactor = shadowCalculationPCF(vFragPosLightSpace, uShadowMap);
        // Adjust shadow intensity for PBR - not completely black shadows
        shadow = 1.0 - (1.0 - shadowFactor) * 0.8;
    }
    
    // Calculate directional light contribution (if active)
    vec3 directionalColor = vec3(0.0);
    
    // Process all directional lights from the data texture
    if (uDirectionalLightCount > 0) {
        for (int i = 0; i < uDirectionalLightCount; i++) {
            if (i >= 100) break; // Reasonable safety limit
            
            // Extract light data from texture
            DirectionalLight light = getDirectionalLight(i);
            
            // Calculate diffuse component
            float lightDiffuse = max(0.0, dot(normalize(N), normalize(-light.direction)));
            
            // Calculate shadow - currently only first light gets shadow mapping
            float lightShadow = 1.0;
            if (light.shadowsEnabled && i == 0 && uShadowsEnabled) {
                lightShadow = shadow;
            }
            
            // Calculate light-specific attenuation
            float lightDistance = length(vWorldPos - light.position);
            float lightAttenuation = 1.0 / (1.0 + 0.0001 * lightDistance * lightDistance);
            
            // Add this light's contribution
            directionalColor += (kD * albedo * RECIPROCAL_PI + specular) * lightDiffuse * 
                               lightShadow * light.intensity * lightAttenuation * light.color;
        }
    } else if (uShadowsEnabled) { 
        // Fallback to legacy directional light if no lights in texture
        // Apply intensity scaling for PBR
        float scaledLegacyIntensity = uLightIntensity * 0.00001;
        directionalColor = (kD * albedo * RECIPROCAL_PI + specular) * NdotL * scaledLegacyIntensity * distanceAttenuation * shadow * uLightColor;
    }
    
    // Calculate point light contributions
    vec3 pointLightColors = vec3(0.0);
    
    // Process all point lights from the data texture
    for (int i = 0; i < uPointLightCount; i++) {
        if (i >= 100) break; // Reasonable safety limit
        
        // Extract light data from texture
        PointLight light = getPointLight(i);
        
        // Direction from fragment to point light (we need to negate for consistent lighting)
        vec3 pointL = normalize(light.position - vWorldPos);
        float pointNdotL = max(dot(N, pointL), 0.0);
        
        // Calculate distance attenuation for point light
        float pointDistance = length(vWorldPos - light.position);
        float pointAttenuation = 1.0 / (1.0 + (pointDistance * pointDistance) / (light.radius * light.radius));
        
        // Calculate specular for point light
        vec3 pointSpecular = specularBRDF(N, pointL, V, baseF0, roughness);
        vec3 pointKD = (vec3(1.0) - pointSpecular) * (1.0 - metallic);
        
        // Calculate shadow for point light
        float pointShadow = 1.0;
        if (light.shadowsEnabled) {
            // Handle first 4 shadow maps with a switch statement
            int lightIdx = i % 4; // Limit to 4 shadowed lights
            switch(lightIdx) {
                case 0:
                    if (uPointShadowsEnabled) {
                        float pointShadowFactor = pointShadowCalculationPCF(vFragPos, light.position, uPointShadowMap, uFarPlane);
                        pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
                    }
                    break;
                case 1:
                    if (uPointShadowsEnabled1) {
                        float pointShadowFactor = pointShadowCalculationPCF(vFragPos, light.position, uPointShadowMap1, uFarPlane);
                        pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
                    }
                    break;
                case 2:
                    if (uPointShadowsEnabled2) {
                        float pointShadowFactor = pointShadowCalculationPCF(vFragPos, light.position, uPointShadowMap2, uFarPlane);
                        pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
                    }
                    break;
                case 3:
                    if (uPointShadowsEnabled3) {
                        float pointShadowFactor = pointShadowCalculationPCF(vFragPos, light.position, uPointShadowMap3, uFarPlane);
                        pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
                    }
                    break;
            }
        }
        
        // Calculate point light color with proper PBR contribution
        pointLightColors += (pointKD * albedo * RECIPROCAL_PI + pointSpecular) * pointNdotL * 
                light.intensity * pointAttenuation * pointShadow * light.color;
    }
    
    // Legacy point light handling - only use if no new lights are available
    if (uPointLightCount == 0) {
        // Backward compatibility for first point light
        vec3 pointL = normalize(uPointLightPos - vWorldPos);
        float pointNdotL = max(dot(N, pointL), 0.0);
        
        float pointDistance = length(vWorldPos - uPointLightPos);
        float pointAttenuation = 1.0 / (1.0 + (pointDistance * pointDistance) / (uLightRadius * uLightRadius));
        
        vec3 pointSpecular = specularBRDF(N, pointL, V, baseF0, roughness);
        vec3 pointKD = (vec3(1.0) - pointSpecular) * (1.0 - metallic);
        
        float pointShadow = 1.0;
        if (uPointShadowsEnabled) {
            float pointShadowFactor = pointShadowCalculationPCF(vFragPos, uPointLightPos, uPointShadowMap, uFarPlane);
            pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
        }
        
        // First light contribution
        pointLightColors += (pointKD * albedo * RECIPROCAL_PI + pointSpecular) * pointNdotL * 
                uPointLightIntensity * pointAttenuation * pointShadow * uPointLightColor;
        
        // Second point light - only if more than one light is available
        if (uPointLightCount > 1) {
            pointL = normalize(uPointLightPos1 - vWorldPos);
            pointNdotL = max(dot(N, pointL), 0.0);
            
            pointDistance = length(vWorldPos - uPointLightPos1);
            pointAttenuation = 1.0 / (1.0 + (pointDistance * pointDistance) / (uPointLightRadius1 * uPointLightRadius1));
            
            pointSpecular = specularBRDF(N, pointL, V, baseF0, roughness);
            pointKD = (vec3(1.0) - pointSpecular) * (1.0 - metallic);
            
            pointShadow = 1.0;
            if (uPointShadowsEnabled1) {
                float pointShadowFactor = pointShadowCalculationPCF(vFragPos, uPointLightPos1, uPointShadowMap1, uFarPlane);
                pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
            }
            
            // Add second light contribution
            pointLightColors += (pointKD * albedo * RECIPROCAL_PI + pointSpecular) * pointNdotL * 
                    uPointLightIntensity1 * pointAttenuation * pointShadow * uPointLightColor1;
        }
    }
    
    // Combine lighting with physically correct blending
    vec3 color = directionalColor;
    
    // Blend point light if it exists
    if (uPointLightCount > 0) {
        // Direct addition of light contributions is physically accurate
        color = directionalColor + pointLightColors;
    }

    // Add ambient light (pre-computed constant)
    color += vec3(0.3) * albedo;

    ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(color, 1.0);
}`;
    }

    //--------------------------------------------------------------------------
    // VIRTUALBOY SHADER VARIANT
    //--------------------------------------------------------------------------

    /**
     * VirtualBoy vertex shader
     * @param {boolean} isWebGL2 - Whether WebGL2 is being used
     * @returns {string} - Vertex shader source code
     */
    getVirtualBoyVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
        ${isWebGL2 ? "in" : "attribute"} vec3 aNormal;
        ${isWebGL2 ? "in" : "attribute"} vec3 aColor;
        
        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        uniform mat4 uModelMatrix;
        uniform vec3 uLightDir;
        
        ${
            isWebGL2
                ? "flat out float vLighting;\nout vec3 vBarycentricCoord;"
                : "varying float vLighting;\nvarying vec3 vBarycentricCoord;"
        }
        
        void main() {
            gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
            vec3 worldNormal = normalize(mat3(uModelMatrix) * aNormal);
            // Negate light direction to be consistent with other shaders
            vLighting = max(0.3, min(1.0, dot(worldNormal, normalize(-uLightDir))));
            
            float id = float(gl_VertexID % 3);
            vBarycentricCoord = vec3(id == 0.0, id == 1.0, id == 2.0);
        }`;
    }

    /**
     * VirtualBoy fragment shader
     * @param {boolean} isWebGL2 - Whether WebGL2 is being used
     * @returns {string} - Fragment shader source code
     */
    getVirtualBoyFragmentShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        precision mediump float;
        ${
            isWebGL2
                ? "flat in float vLighting;\nin vec3 vBarycentricCoord;\nout vec4 fragColor;"
                : "varying float vLighting;\nvarying vec3 vBarycentricCoord;"
        }
        
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
}