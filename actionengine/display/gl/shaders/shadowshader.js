// actionengine/display/gl/shaders/shadowshader.js
class ShadowShader {
    /**
     * Vertex shader for the shadow mapping pass
     * This shader simply transforms vertices to light space
     */
    getShadowVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
        
        uniform mat4 uLightSpaceMatrix;
        uniform mat4 uModelMatrix;
        
        void main() {
            gl_Position = uLightSpaceMatrix * uModelMatrix * vec4(aPosition, 1.0);
        }`;
    }

    /**
     * Fragment shader for the shadow mapping pass
     * This shader outputs depth values to the shadow map
     */
    getShadowFragmentShader(isWebGL2) {
        if (isWebGL2) {
            return `#version 300 es
        precision mediump float;
        
        // Debug uniforms
        uniform bool uDebugShadowMap;
        uniform bool uForceShadowMapTest;
        uniform float uShadowMapSize;  // New uniform for shadow map size
        
        out vec4 fragColor;
        
        void main() {
    // Encode depth as RGBA color
    float depth = gl_FragCoord.z;
    
    // Apply forcing if in test mode
    if (uForceShadowMapTest) {
        vec2 center = vec2(0.5, 0.5);
        vec2 normalizedCoord = gl_FragCoord.xy / uShadowMapSize;
        
        float testSize = 256.0 / uShadowMapSize;
        if (abs(normalizedCoord.x - center.x) < testSize && 
            abs(normalizedCoord.y - center.y) < testSize) {
            depth = 0.5; // Force a mid-range depth value in test area
        }
    }
    
    // Pack depth into RGBA (manual encoding for better precision)
    const vec4 bitShift = vec4(1.0, 256.0, 256.0*256.0, 256.0*256.0*256.0);
    const vec4 bitMask = vec4(1.0/256.0, 1.0/256.0, 1.0/256.0, 0.0);
    vec4 encodedDepth = fract(depth * bitShift);
    encodedDepth -= encodedDepth.gbaa * bitMask;
    
    fragColor = encodedDepth;
}`;
        } else {
            // WebGL1 version
            return `precision highp float;
        
        // Debug uniforms
        uniform bool uDebugShadowMap;
        uniform bool uForceShadowMapTest;
        uniform float uShadowMapSize;  // New uniform for shadow map size
        
        void main() {
            // Create test pattern if enabled
            if (uForceShadowMapTest) {
                vec2 center = vec2(0.5, 0.5);
                vec2 normalizedCoord = gl_FragCoord.xy / uShadowMapSize;
                
                float testSize = 256.0 / uShadowMapSize;
                if (abs(normalizedCoord.x - center.x) < testSize && 
                    abs(normalizedCoord.y - center.y) < testSize) {
                    // For WebGL1, we need to encode depth as RGBA
                    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // White = 1.0 depth
                    return;
                }
            }
            
            // Encode depth value using a color texture
            float depth = gl_FragCoord.z;
            
            if (uDebugShadowMap) {
                // For debug visualization
                gl_FragColor = vec4(depth, depth * 0.5, depth * 0.2, 1.0);
                
                // Show test area if enabled
                if (uForceShadowMapTest) {
                    vec2 center = vec2(0.5, 0.5);
                    vec2 normalizedCoord = gl_FragCoord.xy / uShadowMapSize;
                    
                    float testSize = 256.0 / uShadowMapSize;
                    if (abs(normalizedCoord.x - center.x) < testSize && 
                        abs(normalizedCoord.y - center.y) < testSize) {
                        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // Red for test area
                    }
                }
            } else {
                // Pack depth into RGBA (bit-wise encoding) for normal operation
                const vec4 bitShift = vec4(1.0, 256.0, 256.0*256.0, 256.0*256.0*256.0);
                const vec4 bitMask = vec4(1.0/256.0, 1.0/256.0, 1.0/256.0, 0.0);
                vec4 color = fract(depth * bitShift);
                color -= color.gbaa * bitMask;
                
                gl_FragColor = color;
            }
        }`;
        }
    }

    /**
     * Helper methods to include shadow maps in standard rendering shaders
     *
     * SHADOW CONVENTION:
     * - shadowCalculationPCF() returns 1.0 for lit areas and 0.0 for shadowed areas
     * - In all shaders, we process this raw value with: shadow = 1.0 - (1.0 - shadowFactor) * 0.8;
     * - This gives shadowed areas a value of 0.2 and lit areas a value of 1.0
     * - Higher shadow values (closer to 1.0) mean MORE light (less shadow)
     */
    getShadowSamplingFunctions(isWebGL2) {
        if (isWebGL2) {
            return `
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
            }`;
        } else {
            // WebGL1 version with manual depth unpacking
            return `
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
        }
    }
}