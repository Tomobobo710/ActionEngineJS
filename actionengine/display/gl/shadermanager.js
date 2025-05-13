// actionengine/display/gl/shadermanager.js
class ShaderManager {
    constructor(renderer3D, initialSize = 500) {
        this.gl = renderer3D.gl;
        this.isWebGL2 = this.gl.getParameter(this.gl.VERSION).includes("WebGL 2.0");

        this.positions = new Float32Array(initialSize * 9);
        this.normals = new Float32Array(initialSize * 9);
        this.colors = new Float32Array(initialSize * 9);
        this.indices = new Uint16Array(initialSize * 3);
        this.uvs = new Float32Array(initialSize * 6);
        this.colorCache = new Map();

        // Instead of using ShaderSetRegistry, we'll manage shader sets directly
        this.shaderSets = {};
        this.shaderNames = [];
        
        // Register standard shader sets
        this.registerStandardShaderSets();

        // Pre-calculate commonly used values
        this.colorMultiplier = 1 / 255;
    }

    /**
     * Register a shader set directly with the ShaderManager
     * @param {string} name - Name of the shader set
     * @param {object|function} shaderSetClass - Shader set class or instance
     */
    registerShaderSet(name, shaderSetClass) {
        // Create new instance of the shader if it's a class
        const shaderInstance = typeof shaderSetClass === 'function' 
            ? new shaderSetClass() 
            : shaderSetClass;
        
        // Store in shaderSets object
        this.shaderSets[name] = shaderInstance;
        
        // Add to names array if not already present
        if (!this.shaderNames.includes(name)) {
            this.shaderNames.push(name);
        }

        console.log(`[ShaderManager] Registered shader set: ${name}`);
    }

    /**
     * Get a shader set by name
     * @param {string} name - Name of the shader to retrieve
     * @returns {object|null} - The shader set instance or null if not found
     */
    getShaderSet(name) {
        return this.shaderSets[name] || null;
    }

    /**
     * Get names of all registered shader sets
     * @returns {string[]} - Array of shader set names
     */
    getAllShaderNames() {
        return Array.from(this.shaderNames);
    }
    
    /**
     * Register all standard shader sets
     */
    registerStandardShaderSets() {
        //this.registerShaderSet("default", DefaultShaderSet);
        this.registerShaderSet("pbr", PBRShaderSet);
        this.registerShaderSet("virtualboy", VirtualBoyShaderSet);
        
        console.log("[ShaderManager] Registered standard shader sets");
    }

    registerAllShaders(renderer) {
        console.log(`[ShaderManager] Registering all shaders, WebGL2: ${this.isWebGL2}`);
        // Register each shader with the renderer
        this.getAllShaderNames().forEach((name) => {
            console.log(`[ShaderManager] Registering shader set: ${name}`);
            try {
                const shader = this.getShaderSet(name);
                if (!shader) {
                    console.error(`[ShaderManager] Error: Shader '${name}' not found in registry`);
                    return;
                }
                
                // Print info to debug method calls
                console.log(`[ShaderManager] Shader class: ${shader.constructor.name}`);
                console.log(`[ShaderManager] Has getStandardVertexShader: ${!!shader.getStandardVertexShader}`);
                console.log(`[ShaderManager] Has getStandardFragmentShader: ${!!shader.getStandardFragmentShader}`);
                
                // Get shader source with error checking - line shaders now handled separately
                let standardVertex = null;
                try {
                    standardVertex = shader.getStandardVertexShader?.(this.isWebGL2);
                } catch (e) {
                    console.error(`[ShaderManager] Error getting standard vertex shader for '${name}': ${e.message}`);
                }
                
                let standardFragment = null;
                try {
                    standardFragment = shader.getStandardFragmentShader?.(this.isWebGL2);
                } catch (e) {
                    console.error(`[ShaderManager] Error getting standard fragment shader for '${name}': ${e.message}`);
                }
                
                // Line shaders are now handled by the dedicated LineShader class
                
                const shaderSet = {
                    standard: {
                        vertex: standardVertex,
                        fragment: standardFragment
                    }
                    // Lines removed - now handled by LineShader
                };
                
                try {
                    renderer.programRegistry.registerShaderSet(name, shaderSet);
                    console.log(`[ShaderManager] Successfully registered shader set: ${name}`);
                } catch (e) {
                    console.error(`[ShaderManager] Error registering shader set '${name}': ${e.message}`);
                }
            } catch (e) {
                console.error(`[ShaderManager] Fatal error processing shader '${name}': ${e.message}`);
            }
        });
    }

    getShader(type, shaderName) {
        const shader = this.getShaderSet(shaderName);
        if (!shader) return null;

        const methodName = `get${type}Shader`;
        return shader[methodName]?.(this.isWebGL2);
    }
}