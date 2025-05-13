// actionengine/display/gl/shadersetregistry.js
class ShaderSetRegistry {
    constructor() {
        // Don't allow multiple instances
        if (typeof ShaderSetRegistry.instance !== 'undefined') {
            return ShaderSetRegistry.instance;
        }

        // Initialize static properties first time
        if (typeof ShaderSetRegistry.shaderSets === 'undefined') {
            ShaderSetRegistry.shaderSets = {};
            ShaderSetRegistry.shaderNames = [];
        }

        ShaderSetRegistry.instance = this;
    }

    /**
     * Register a new shader with the registry
     * @param {string} name - Unique name for the shader
     * @param {class} shaderClass - The shader class to register
     */
    static registerShaderSet(name, shaderClass) {
        // Ensure static properties exist
        if (!ShaderSetRegistry.shaderSets) {
            ShaderSetRegistry.shaderSets = {};
            ShaderSetRegistry.shaderNames = [];
        }

        // Create new instance of the shader
        const shaderInstance = new shaderClass();
        
        // Store in shaderSets object
        ShaderSetRegistry.shaderSets[name] = shaderInstance;
        
        // Add to names array if not already present
        if (!ShaderSetRegistry.shaderNames.includes(name)) {
            ShaderSetRegistry.shaderNames.push(name);
        }
    }

    /**
     * Get a shader by name
     * @param {string} name - Name of shader to retrieve
     * @returns {object|null} The shader instance or null if not found
     */
    static getShaderSet(name) {
        return ShaderSetRegistry.shaderSets[name] || null;
    }

    /**
     * Get array of all registered shader names
     * @returns {string[]} Array of shader names in registration order
     */
    static getAllShaderNames() {
        return Array.from(ShaderSetRegistry.shaderNames);
    }
}

// Create self as a singleton instance
new ShaderSetRegistry();