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
        // Register each shader with the renderer
        ShaderRegistry.getAllShaderNames().forEach((name) => {
            const shader = ShaderRegistry.getShader(name);
            const shaderSet = {
                standard: {
                    vertex: shader.getStandardVertexShader?.(this.isWebGL2),
                    fragment: shader.getStandardFragmentShader?.(this.isWebGL2)
                },
                lines: {
                    vertex: shader.getLineVertexShader?.(this.isWebGL2),
                    fragment: shader.getLineFragmentShader?.(this.isWebGL2)
                }
            };
            renderer.programRegistry.registerShaderSet(name, shaderSet);
        });
    }

    getShader(type, shaderName) {
        const shader = ShaderRegistry.getShader(shaderName);
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