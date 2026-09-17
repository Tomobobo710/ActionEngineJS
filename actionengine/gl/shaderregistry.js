//actionengine/gl/shaderregistry.js
// Central registry shader variants self-register into. Each shader PIPELINE (object, line, sprite,
// water, particle, shadow) gets its own independent namespace via ShaderRegistry.for(kind) - so an
// "object" variant named 'glow' and a "line" variant named 'glow' never collide, and each pipeline's
// ProgramManager method (setObjectShaderVariant, setLineShaderVariant, ...) only ever looks in its
// own namespace.
//
// A shader file calls ShaderRegistry.for('line').register(name, {...}) once at module load (bottom
// of its own file) instead of a shader class hardcoding every variant inline - so a new variant (a
// mod, a game-specific effect) can add itself without editing that shader's own file.
//
// getVertexShader/getFragmentShader (or getVertexShader/getFragmentShader equivalents for pipelines
// that don't use that exact pair - see each shader class's own convention) are called with `this`
// bound to the owning shader instance, so a variant can reuse that shader class's own helper methods
// exactly like its built-in variants do.
class ShaderRegistry {
    static _namespaces = new Map(); // kind -> ShaderRegistry instance

    /**
     * Get (creating if needed) the registry namespace for one shader pipeline kind.
     * @param {string} kind - Pipeline name, e.g. "object", "line", "sprite", "water", "particle", "shadow".
     * @returns {ShaderRegistry} - A registry scoped to that kind alone.
     */
    static for(kind) {
        if (!kind || typeof kind !== 'string') {
            throw new Error('[ShaderRegistry] for() requires a non-empty string kind');
        }
        let ns = ShaderRegistry._namespaces.get(kind);
        if (!ns) {
            ns = new ShaderRegistry();
            ShaderRegistry._namespaces.set(kind, ns);
        }
        return ns;
    }

    constructor() {
        this._variants = new Map();
    }

    /**
     * Register a shader variant into this namespace.
     * @param {string} name - Variant name, e.g. "pbr", "glow", "virtualboy".
     * @param {Object} variant - An object of named functions returning GLSL source strings (e.g.
     *   {getVertexShader, getFragmentShader}). The exact keys are up to the owning shader class's
     *   convention; ShaderRegistry itself doesn't inspect them beyond requiring at least one.
     */
    register(name, variant) {
        if (!name || typeof name !== 'string') {
            throw new Error('[ShaderRegistry] register() requires a non-empty string name');
        }
        if (!variant || typeof variant !== 'object' || Object.keys(variant).length === 0) {
            throw new Error(`[ShaderRegistry] register("${name}") requires a non-empty variant object`);
        }
        for (const key of Object.keys(variant)) {
            if (typeof variant[key] !== 'function') {
                throw new Error(`[ShaderRegistry] register("${name}").${key} must be a function`);
            }
        }
        this._variants.set(name, variant);
    }

    /** True if a variant with this name has been registered in this namespace. */
    has(name) {
        return this._variants.has(name);
    }

    /** The variant object for a registered name in this namespace, or undefined. */
    get(name) {
        return this._variants.get(name);
    }

    /** Every currently registered variant name in this namespace. */
    names() {
        return Array.from(this._variants.keys());
    }
}
