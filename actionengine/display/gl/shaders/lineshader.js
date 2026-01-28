// actionengine/display/gl/shaders/lineshader.js

class LineShader {
    constructor() {
        // Store references to different line shader variants
        this.variants = {
            default: {
                getVertexShader: this.getDefaultVertexShader,
                getFragmentShader: this.getDefaultFragmentShader
            },
            virtualboy: {
                getVertexShader: this.getVirtualBoyVertexShader,
                getFragmentShader: this.getVirtualBoyFragmentShader
            }
            // Additional variants can be added here
        };
        
        // Current active variant (default to 'default')
        this.currentVariant = 'default';
    }
    
    /**
     * Set the current line shader variant
     * @param {string} variantName - Name of the variant to use
     */
    setVariant(variantName) {
        if (this.variants[variantName]) {
            this.currentVariant = variantName;
            console.log(`[LineShader] Set line shader variant to: ${variantName}`);
        } else {
            console.warn(`[LineShader] Unknown variant: ${variantName}, using default`);
            this.currentVariant = 'default';
        }
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
    
    /**
     * Default line vertex shader
     * @param {boolean} isWebGL2 - Whether WebGL2 is being used
     * @returns {string} - Vertex shader source code
     */
    getDefaultVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
    ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform float uTime;
    
    ${isWebGL2 ? "out" : "varying"} float vFragDepth;  // For logarithmic depth
    
    void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 1.0);
        
        // Store depth for logarithmic depth buffer
        vFragDepth = 1.0 + gl_Position.w;
    }`;
    }
    
    /**
     * Default line fragment shader
     * @param {boolean} isWebGL2 - Whether WebGL2 is being used
     * @returns {string} - Fragment shader source code
     */
    getDefaultFragmentShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
    precision mediump float;
    ${isWebGL2 ? "out vec4 fragColor;\n" : ""}
    
    ${isWebGL2 ? "in" : "varying"} float vFragDepth;  // For logarithmic depth
    
    uniform vec3 uColor;
    uniform float uFarPlane;  // For logarithmic depth
    
    void main() {
        ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(uColor, 1.0);
        
        // Logarithmic depth buffer encoding
        float logDepth = log2(vFragDepth) / log2(uFarPlane + 1.0);
        ${isWebGL2 ? "gl_FragDepth" : "gl_FragDepth"} = logDepth;
    }`;
    }
    
    /**
     * VirtualBoy line vertex shader
     * @param {boolean} isWebGL2 - Whether WebGL2 is being used
     * @returns {string} - Vertex shader source code
     */
    getVirtualBoyVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
    ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    
    ${isWebGL2 ? "out" : "varying"} float vFragDepth;  // For logarithmic depth
    
    void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 1.0);
        
        // Store depth for logarithmic depth buffer
        vFragDepth = 1.0 + gl_Position.w;
    }`;
    }
    
    /**
     * VirtualBoy line fragment shader
     * @param {boolean} isWebGL2 - Whether WebGL2 is being used
     * @returns {string} - Fragment shader source code
     */
    getVirtualBoyFragmentShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
    precision mediump float;
    ${isWebGL2 ? "out vec4 fragColor;\n" : ""}
    
    ${isWebGL2 ? "in" : "varying"} float vFragDepth;  // For logarithmic depth
    
    uniform float uFarPlane;  // For logarithmic depth
    
    void main() {
        ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(1.0, 0.0, 0.0, 1.0);
        
        // Logarithmic depth buffer encoding
        float logDepth = log2(vFragDepth) / log2(uFarPlane + 1.0);
        ${isWebGL2 ? "gl_FragDepth" : "gl_FragDepth"} = logDepth;
    }`;
    }
}
