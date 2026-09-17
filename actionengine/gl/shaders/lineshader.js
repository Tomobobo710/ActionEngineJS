//actionengine/gl/shaders/lineshader.js

class LineShader {
    constructor() {
        // Built-in variants self-register into ShaderRegistry.for('line') (see bottom of this file),
        // the same way a game/mod-registered variant would - looked up there, not on an instance field.

        // Current active variant (default to 'default')
        this.currentVariant = "default";
    }

    /**
     * Set the current line shader variant
     * @param {string} variantName - Name of the variant to use
     */
    setVariant(variantName) {
        if (ShaderRegistry.for('line').has(variantName)) {
            this.currentVariant = variantName;
            console.log(`[LineShader] Set line shader variant to: ${variantName}`);
        } else {
            console.warn(`[LineShader] Unknown variant: ${variantName}, using default`);
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
        return ShaderRegistry.for('line').get(this.currentVariant).getVertexShader.call(this);
    }

    /**
     * Get the current variant's fragment shader
     * @returns {string} - Fragment shader source code
     */
    getFragmentShader() {
        return ShaderRegistry.for('line').get(this.currentVariant).getFragmentShader.call(this);
    }

    /**
     * Default line vertex shader
     * @returns {string} - Vertex shader source code
     */
    getDefaultVertexShader() {
        return `#version 300 es
    in vec3 aPosition;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform float uTime;
    
    out float vFragDepth;  // For logarithmic depth
    
    void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 1.0);
        
        // Store depth for logarithmic depth buffer
        vFragDepth = 1.0 + gl_Position.w;
    }`;
    }

    /**
     * Default line fragment shader
     * @returns {string} - Fragment shader source code
     */
    getDefaultFragmentShader() {
        return `#version 300 es
    precision mediump float;
    out vec4 fragColor;
    
    in float vFragDepth;  // For logarithmic depth
    
    uniform vec3 uColor;
    uniform float uFarPlane;  // For logarithmic depth
    
    void main() {
        fragColor = vec4(uColor, 1.0);
        
        // Logarithmic depth buffer encoding
        float logDepth = log2(vFragDepth) / log2(uFarPlane + 1.0);
        gl_FragDepth = logDepth;
    }`;
    }

    /**
     * VirtualBoy line vertex shader
     * @returns {string} - Vertex shader source code
     */
    getVirtualBoyVertexShader() {
        return `#version 300 es
    in vec3 aPosition;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    
    out float vFragDepth;  // For logarithmic depth
    
    void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 1.0);
        
        // Store depth for logarithmic depth buffer
        vFragDepth = 1.0 + gl_Position.w;
    }`;
    }

    /**
     * VirtualBoy line fragment shader
     * @returns {string} - Fragment shader source code
     */
    getVirtualBoyFragmentShader() {
        return `#version 300 es
    precision mediump float;
    out vec4 fragColor;
    
    in float vFragDepth;  // For logarithmic depth
    
    uniform float uFarPlane;  // For logarithmic depth
    
    void main() {
        fragColor = vec4(1.0, 0.0, 0.0, 1.0);
        
        // Logarithmic depth buffer encoding
        float logDepth = log2(vFragDepth) / log2(uFarPlane + 1.0);
        gl_FragDepth = logDepth;
    }`;
    }
}

// Self-register the built-in variants, same pattern any later line-shader variant (engine or game)
// follows. getVertexShader/getFragmentShader are called with `this` bound to the LineShader instance
// (see LineShader.getVertexShader/getFragmentShader).
ShaderRegistry.for('line').register('default', {
    getVertexShader: LineShader.prototype.getDefaultVertexShader,
    getFragmentShader: LineShader.prototype.getDefaultFragmentShader
});
ShaderRegistry.for('line').register('virtualboy', {
    getVertexShader: LineShader.prototype.getVirtualBoyVertexShader,
    getFragmentShader: LineShader.prototype.getVirtualBoyFragmentShader
});
