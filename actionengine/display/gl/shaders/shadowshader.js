// actionengine/display/gl/shaders/shadowshader.js
class ShadowShader {
    /**
     * Dedicated vertex shader for directional shadow mapping
     * This is the clean version that only handles directional shadows
     */
    getDirectionalShadowVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
        
        uniform mat4 uLightSpaceMatrix;
        uniform mat4 uModelMatrix;
        
        void main() {
            gl_Position = uLightSpaceMatrix * uModelMatrix * vec4(aPosition, 1.0);
        }`;
    }
    
    /**
     * Vertex shader for the shadow mapping pass
     * This shader simply transforms vertices to light space
     */
    getShadowVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
        
        uniform mat4 uLightSpaceMatrix;
        uniform mat4 uModelMatrix;
        ${isWebGL2 ? "out" : "varying"} vec4 vWorldPos; // For omnidirectional shadows
        uniform vec3 uLightPos; // For omnidirectional shadows
        
        void main() {
            vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
            vWorldPos = worldPos;
            gl_Position = uLightSpaceMatrix * worldPos;
        }`;
    }
    
    /**
     * Get the vertex shader for omnidirectional shadow mapping
     * This variant is optimized for point lights with cubemap shadows
     */
    getOmniShadowVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
        
        uniform mat4 uLightSpaceMatrix;
        uniform mat4 uModelMatrix;
        uniform vec3 uLightPos;
        
        ${isWebGL2 ? "out" : "varying"} vec3 vFragPos;
        
        void main() {
            vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
            vFragPos = worldPos.xyz;
            gl_Position = uLightSpaceMatrix * worldPos;
        }`;
    }

    /**
     * Fragment shader for the shadow mapping pass
     * This shader outputs depth values to the shadow map
     */
    getDirectionalShadowFragmentShader(isWebGL2) {
        if (isWebGL2) {
            return `#version 300 es
            precision mediump float;
            
            // Debug uniforms
            uniform bool uDebugShadowMap;
            uniform bool uForceShadowMapTest;
            uniform float uShadowMapSize;
            
            out vec4 fragColor;
            
            void main() {
                // DIRECTIONAL ONLY: Direct depth from gl_FragCoord.z
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
            uniform float uShadowMapSize;
            
            void main() {
                // DIRECTIONAL ONLY: Direct depth from gl_FragCoord.z
                float depth = gl_FragCoord.z;
                
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
    
    getShadowFragmentShader(isWebGL2) {
        if (isWebGL2) {
            return `#version 300 es
        precision mediump float;
        
        // Debug uniforms
        uniform bool uDebugShadowMap;
        uniform bool uForceShadowMapTest;
        uniform float uShadowMapSize;  // New uniform for shadow map size
        
        // For omnidirectional shadows
        in vec4 vWorldPos;
        uniform vec3 uLightPos;
        uniform float uFarPlane;
        
        out vec4 fragColor;
        
        void main() {
    // For omnidirectional shadows, compute distance from light to fragment
    vec3 fragToLight = vWorldPos.xyz - uLightPos;
    float lightDistance = length(fragToLight);
    
    // Normalize to [0,1] range based on far plane
    float depth = lightDistance / uFarPlane;
    
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
        
        // For omnidirectional shadows
        varying vec4 vWorldPos;
        uniform vec3 uLightPos;
        uniform float uFarPlane;
        
        void main() {
            // For omnidirectional shadows, compute distance from light to fragment
            vec3 fragToLight = vWorldPos.xyz - uLightPos;
            float lightDistance = length(fragToLight);
            
            // Normalize to [0,1] range based on far plane
            float depth = lightDistance / uFarPlane;
            
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
     * Fragment shader specifically for omnidirectional shadow mapping
     * Optimized for point lights with cubemap shadows
     */
    getOmniShadowFragmentShader(isWebGL2) {
        if (isWebGL2) {
            return `#version 300 es
        precision mediump float;
        
        in vec3 vFragPos;
        uniform vec3 uLightPos;
        uniform float uFarPlane;
        
        out vec4 fragColor;
        
        void main() {
            // Get distance between fragment and light source
            float lightDistance = length(vFragPos - uLightPos);
            
            // Map to [0,1] range by dividing by far plane
            lightDistance = lightDistance / uFarPlane;
            
            // Write this as depth value
            const vec4 bitShift = vec4(1.0, 256.0, 256.0*256.0, 256.0*256.0*256.0);
            const vec4 bitMask = vec4(1.0/256.0, 1.0/256.0, 1.0/256.0, 0.0);
            vec4 encodedDepth = fract(lightDistance * bitShift);
            encodedDepth -= encodedDepth.gbaa * bitMask;
            
            fragColor = encodedDepth;
        }`;
        } else {
            // WebGL1 version
            return `precision highp float;
        
        varying vec3 vFragPos;
        uniform vec3 uLightPos;
        uniform float uFarPlane;
        
        void main() {
            // Get distance between fragment and light source
            float lightDistance = length(vFragPos - uLightPos);
            
            // Map to [0,1] range by dividing by far plane
            lightDistance = lightDistance / uFarPlane;
            
            // Write this as depth value
            const vec4 bitShift = vec4(1.0, 256.0, 256.0*256.0, 256.0*256.0*256.0);
            const vec4 bitMask = vec4(1.0/256.0, 1.0/256.0, 1.0/256.0, 0.0);
            vec4 color = fract(lightDistance * bitShift);
            color -= color.gbaa * bitMask;
            
            gl_FragColor = color;
        }`;
        }
    }
}