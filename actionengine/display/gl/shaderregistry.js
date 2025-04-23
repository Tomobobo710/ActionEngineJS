// actionengine/display/gl/shaderregistry.js
class ShaderRegistry {
    constructor() {
        // Don't allow multiple instances
        if (typeof ShaderRegistry.instance !== 'undefined') {
            return ShaderRegistry.instance;
        }

        // Initialize static properties first time
        if (typeof ShaderRegistry.shaders === 'undefined') {
            ShaderRegistry.shaders = {};
            ShaderRegistry.shaderNames = [];
        }

        ShaderRegistry.instance = this;
    }

    /**
     * Register a new shader with the registry
     * @param {string} name - Unique name for the shader
     * @param {class} shaderClass - The shader class to register
     */
    static register(name, shaderClass) {
        // Ensure static properties exist
        if (!ShaderRegistry.shaders) {
            ShaderRegistry.shaders = {};
            ShaderRegistry.shaderNames = [];
        }

        // Create new instance of the shader
        const shaderInstance = new shaderClass();
        
        // Store in shaders object
        ShaderRegistry.shaders[name] = shaderInstance;
        
        // Add to names array if not already present
        if (!ShaderRegistry.shaderNames.includes(name)) {
            ShaderRegistry.shaderNames.push(name);
        }
    }

    /**
     * Get a shader by name
     * @param {string} name - Name of shader to retrieve
     * @returns {object|null} The shader instance or null if not found
     */
    static getShader(name) {
        return ShaderRegistry.shaders[name] || null;
    }

    /**
     * Get array of all registered shader names
     * @returns {string[]} Array of shader names in registration order
     */
    static getAllShaderNames() {
        return Array.from(ShaderRegistry.shaderNames);
    }

    /**
     * Get total count of registered shaders
     * @returns {number} Number of registered shaders
     */
    static getShaderCount() {
        return ShaderRegistry.shaderNames.length;
    }

    /**
     * Check if a shader is registered
     * @param {string} name - Name of shader to check
     * @returns {boolean} True if shader exists
     */
    static hasShader(name) {
        return name in ShaderRegistry.shaders;
    }
}

// Create the singleton instance
new ShaderRegistry();