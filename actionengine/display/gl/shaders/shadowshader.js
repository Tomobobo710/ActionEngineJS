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
}