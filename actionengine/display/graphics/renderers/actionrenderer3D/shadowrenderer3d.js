// actionengine/display/graphics/renderers/actionrenderer3D/shadowrenderer3d.js

class ShadowRenderer3D {
    constructor(gl, lightManager, glStateManager) {
        this.gl = gl;
        this.lightManager = lightManager;
        this.glStateManager = glStateManager;

        // Pre-allocated scratch array for valid objects — reused every frame
        // to avoid the per-frame allocation from objects.filter().
        this._validObjects = [];
    }

    /**
     * Render shadow maps for all shadow-casting lights
     * @param {Array} objects - Objects to render to shadow maps
     */
    render(objects) {
        // Early exit if no objects
        if (!objects || objects.length === 0) {
            return;
        }

        // Populate reusable scratch array instead of allocating a new one via filter().
        // This avoids a per-frame heap allocation (and eventual GC) in the shadow pass.
        const validObjects = this._validObjects;
        validObjects.length = 0;
        for (let i = 0; i < objects.length; i++) {
            const obj = objects[i];
            if (obj && obj.triangles && obj.triangles.length > 0) {
                validObjects.push(obj);
            }
        }

        if (validObjects.length === 0) {
            return;
        }

        // Set up GL state for shadow rendering (no blending, depth writes enabled)
        this.glStateManager.setupState("shadow");

        // Render directional light shadow maps
        this._renderDirectionalLightShadows(validObjects);

        // Render point light shadow maps
        this._renderPointLightShadows(validObjects);

        // Reset state after shadow rendering
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.useProgram(null);
    }

    /**
     * Render shadow maps for all directional lights
     * @private
     */
    _renderDirectionalLightShadows(objects) {
        for (const light of this.lightManager.directionalLights) {
            if (!light.getShadowsEnabled()) {
                continue;
            }

            light.beginShadowPass();

            // Render objects to shadow map
            for (const object of objects) {
                light.renderObjectToShadowMap(object);
            }

            light.endShadowPass();
        }
    }

    /**
     * Render shadow maps for all point lights (omnidirectional)
     * @private
     */
    _renderPointLightShadows(objects) {
        for (let lightIndex = 0; lightIndex < this.lightManager.pointLights.length; lightIndex++) {
            const light = this.lightManager.pointLights[lightIndex];

            if (!light.getShadowsEnabled()) {
                continue;
            }

            // For omnidirectional lights, render the shadow map for each face (6 faces for cubemap)
            for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
                light.beginShadowPass(faceIndex, lightIndex);

                // Render objects to shadow map for this face
                for (const object of objects) {
                    light.renderObjectToShadowMap(object);
                }

                light.endShadowPass();
            }
        }
    }
}
