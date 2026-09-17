//actionengine/gl/shaders/particleshader.js
// game/display/gl/shaders/particleshader.js
class ParticleShader {
    constructor() {
        // Built-in variant self-registers into ShaderRegistry.for('particle') (see bottom of this
        // file), the same way a game/mod-registered variant would.
        this.currentVariant = "default";
    }

    /**
     * Set the current particle shader variant
     * @param {string} variantName - Name of the variant to use
     */
    setVariant(variantName) {
        if (ShaderRegistry.for('particle').has(variantName)) {
            this.currentVariant = variantName;
            console.log(`[ParticleShader] Set particle shader variant to: ${variantName}`);
        } else {
            console.warn(`[ParticleShader] Unknown variant: ${variantName}, using default`);
            this.currentVariant = "default";
        }
    }

    /** @returns {string} - Current variant name */
    getCurrentVariant() {
        return this.currentVariant;
    }

    /** @returns {string} - Vertex shader source code for the current variant */
    getVertexShader() {
        return ShaderRegistry.for('particle').get(this.currentVariant).getVertexShader.call(this);
    }

    /** @returns {string} - Fragment shader source code for the current variant */
    getFragmentShader() {
        return ShaderRegistry.for('particle').get(this.currentVariant).getFragmentShader.call(this);
    }

    getDefaultVertexShader() {
        return `#version 300 es
        in vec3 aPosition;
        in float aSize;
        in vec4 aColor;
     
         uniform mat4 uProjectionMatrix;
         uniform mat4 uViewMatrix;
     
         out vec4 vColor;
         out float vFragDepth;  // For logarithmic depth
    
        void main() {
            gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 1.0);
            gl_PointSize = aSize;
            vColor = aColor;
            
            // Store depth for logarithmic depth buffer
            vFragDepth = 1.0 + gl_Position.w;
        }`;
    }

    getDefaultFragmentShader() {
        return `#version 300 es
        precision mediump float;
        in vec4 vColor;
        in float vFragDepth;  // For logarithmic depth
        out vec4 fragColor;
         uniform int uParticleType;
         uniform float uFarPlane;  // For logarithmic depth
         void main() {
             vec2 coord = gl_PointCoord * 2.0 - 1.0;
             if (uParticleType == 1 || uParticleType == 2) {  // Rain types
                 coord.y *= 12.0; // Longer streaks
                 float r = dot(coord, coord);
                 float streak = smoothstep(1.0, 0.0, r);
                 float trail = smoothstep(1.0, 0.0, coord.y);
                 float droplet = streak * trail;
                 fragColor = vec4(0.8, 0.85, 1.0, 1.0); // Blueish tint, more transparent
             } else {
                 float r = dot(coord, coord);
                 if (r > 1.0) discard;
                 fragColor = vColor;
             }
             
             // Logarithmic depth buffer encoding
             float logDepth = log2(vFragDepth) / log2(uFarPlane + 1.0);
             gl_FragDepth = logDepth;
         }`;
    }
}

// Self-register the built-in variant, same pattern any later particle-shader variant follows.
ShaderRegistry.for('particle').register('default', {
    getVertexShader: ParticleShader.prototype.getDefaultVertexShader,
    getFragmentShader: ParticleShader.prototype.getDefaultFragmentShader
});
