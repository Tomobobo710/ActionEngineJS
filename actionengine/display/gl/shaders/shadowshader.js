// actionengine/display/gl/shaders/shadowshader.js
class ShadowShader {
    /**
     * Dedicated vertex shader for directional shadow mapping
     * This is the clean version that only handles directional shadows
     */
    getDirectionalShadowVertexShader() {
        return `#version 300 es
        in vec3 aPosition;
        
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
    getShadowVertexShader() {
        return `#version 300 es
        in vec3 aPosition;
         
         uniform mat4 uLightSpaceMatrix;
         uniform mat4 uModelMatrix;
         out vec4 vWorldPos; // For omnidirectional shadows
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
    getOmniShadowVertexShader() {
        return `#version 300 es
        in vec3 aPosition;
         
         uniform mat4 uLightSpaceMatrix;
         uniform mat4 uModelMatrix;
         uniform vec3 uLightPos;
         
         out vec3 vFragPos;
        
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
    getDirectionalShadowFragmentShader() {
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
    }

    getShadowFragmentShader() {
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
    }

    /**
     * Fragment shader specifically for omnidirectional shadow mapping
     * Optimized for point lights with cubemap shadows
     */
    getOmniShadowFragmentShader() {
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
    }
}
