// actionengine/display/gl/programregistry.js
class ProgramRegistry {
    constructor(gl) {
        this.gl = gl;
        this.shaderSets = new Map();
        this.currentShaderIndex = 0;
        this.isWebGL2 = gl.getParameter(gl.VERSION).includes("WebGL 2.0");
    }

    /**
     * Store a shader set with program and locations
     * @param {string} name - Name of the shader set
     * @param {object} shaderSet - Object containing program and locations
     */
    storeShaderSet(name, shaderSet) {
        this.shaderSets.set(name, shaderSet);
        console.log(`[ProgramRegistry] Stored shader set: ${name}`);
    }

    /**
     * Cycle to the next shader set
     * @param {function} onVariantChange - Callback for when shader variant changes
     * @returns {string} - Name of the new shader set
     */
    cycleShaderSets(onVariantChange) {
        const shaderNames = Array.from(this.shaderSets.keys());
        this.currentShaderIndex = (this.currentShaderIndex + 1) % shaderNames.length;
        const newShaderName = shaderNames[this.currentShaderIndex];
        console.log(`[ProgramRegistry] Switched to shader set: ${newShaderName}`);
        
        // Call the callback if provided
        if (onVariantChange && typeof onVariantChange === 'function') {
            onVariantChange(newShaderName);
        }
        
        return newShaderName;
    }

    /**
     * Get the current shader set
     * @returns {object} - The current shader set
     */
    getCurrentShaderSet() {
        const shaderNames = Array.from(this.shaderSets.keys());
        return this.shaderSets.get(shaderNames[this.currentShaderIndex]);
    }
    
    /**
     * Get name of the current shader set
     * @returns {string} - The name of the current shader set
     */
    getCurrentShaderName() {
        const shaderNames = Array.from(this.shaderSets.keys());
        return shaderNames[this.currentShaderIndex];
    }
}