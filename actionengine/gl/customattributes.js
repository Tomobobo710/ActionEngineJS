//actionengine/gl/customattributes.js
// Open registry for game-defined per-triangle custom vertex attributes, so a game (or a variant
// shader it registers via ShaderRegistry) can pass arbitrary extra per-vertex data to the GPU
// without ever touching ObjectRenderer3D/Triangle again after this file exists.
//
// Usage (game-side, once, before any mesh using it is first queued):
//   CustomAttributeRegistry.define('wetness', { defaultValue: 0 });
// Then any Triangle can carry it:
//   triangle.custom = { wetness: 1.0 };
// And any object-shader variant can read it under the generated attribute name:
//   in float aCustom_wetness;
//
// A triangle that doesn't set triangle.custom.<name> gets that attribute's defaultValue - existing
// triangles/meshes that never touch `custom` are completely unaffected (the default shaders don't
// declare these attributes at all, so the extra buffers are simply never bound for them).
class CustomAttributeRegistry {
    static _attributes = new Map(); // name -> { defaultValue, glName }

    /**
     * Define a new custom per-triangle attribute. Safe to call multiple times with the same name
     * and identical options (no-op); throws if redefined with different options, since two features
     * silently agreeing to share a name with different defaults would be a hard-to-diagnose bug.
     * @param {string} name - Attribute name, e.g. "wetness". Must be a valid GLSL identifier suffix.
     * @param {{defaultValue?: number}} [options]
     */
    static define(name, options = {}) {
        if (!name || typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
            throw new Error(`[CustomAttributeRegistry] Invalid attribute name "${name}" - must be a valid identifier`);
        }
        const defaultValue = options.defaultValue !== undefined ? options.defaultValue : 0;
        const existing = CustomAttributeRegistry._attributes.get(name);
        if (existing) {
            if (existing.defaultValue !== defaultValue) {
                throw new Error(`[CustomAttributeRegistry] "${name}" already defined with defaultValue ${existing.defaultValue}, cannot redefine as ${defaultValue}`);
            }
            return;
        }
        CustomAttributeRegistry._attributes.set(name, { defaultValue, glName: `aCustom_${name}` });
    }

    /** True if this custom attribute name has been defined. */
    static has(name) {
        return CustomAttributeRegistry._attributes.has(name);
    }

    /** { defaultValue, glName } for a defined attribute, or undefined. */
    static get(name) {
        return CustomAttributeRegistry._attributes.get(name);
    }

    /** Every defined attribute name, in definition order (stable - used to order buffers/keys). */
    static names() {
        return Array.from(CustomAttributeRegistry._attributes.keys());
    }
}
