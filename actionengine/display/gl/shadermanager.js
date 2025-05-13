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

        // Pre-calculate commonly used values
        this.colorMultiplier = 1 / 255;
    }

    registerAllShaders(renderer) {
        console.log(`[ShaderManager] Registering all shaders, WebGL2: ${this.isWebGL2}`);
        // Register each shader with the renderer
        ShaderSetRegistry.getAllShaderNames().forEach((name) => {
            console.log(`[ShaderManager] Registering shader set: ${name}`);
            try {
                const shader = ShaderSetRegistry.getShaderSet(name);
                if (!shader) {
                    console.error(`[ShaderManager] Error: Shader '${name}' not found in registry`);
                    return;
                }
                
                // Print info to debug method calls
                console.log(`[ShaderManager] Shader class: ${shader.constructor.name}`);
                console.log(`[ShaderManager] Has getStandardVertexShader: ${!!shader.getStandardVertexShader}`);
                console.log(`[ShaderManager] Has getStandardFragmentShader: ${!!shader.getStandardFragmentShader}`);
                
                // Get shader source with error checking
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
                
                let lineVertex = null;
                try {
                    lineVertex = shader.getLineVertexShader?.(this.isWebGL2);
                } catch (e) {
                    console.error(`[ShaderManager] Error getting line vertex shader for '${name}': ${e.message}`);
                }
                
                let lineFragment = null;
                try {
                    lineFragment = shader.getLineFragmentShader?.(this.isWebGL2);
                } catch (e) {
                    console.error(`[ShaderManager] Error getting line fragment shader for '${name}': ${e.message}`);
                }
                
                const shaderSet = {
                    standard: {
                        vertex: standardVertex,
                        fragment: standardFragment
                    },
                    lines: {
                        vertex: lineVertex,
                        fragment: lineFragment
                    }
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
        const shader = ShaderSetRegistry.getShaderSet(shaderName);
        if (!shader) return null;

        const methodName = `get${type}Shader`;
        return shader[methodName]?.(this.isWebGL2);
    }

    registerShaderSet(renderer, name) {
        const shaderSet = {};

        const standardVertex = this.getShader("StandardVertex", name);
        const standardFragment = this.getShader("StandardFragment", name);
        if (standardVertex && standardFragment) {
            shaderSet.standard = {
                vertex: standardVertex,
                fragment: standardFragment
            };
        }

        const lineVertex = this.getShader("LineVertex", name);
        const lineFragment = this.getShader("LineFragment", name);
        if (lineVertex && lineFragment) {
            shaderSet.lines = {
                vertex: lineVertex,
                fragment: lineFragment
            };
        }

        if (Object.keys(shaderSet).length > 0) {
            renderer.registerShaderSet(name, shaderSet);
        }
    }    
}