// actionengine/display/graphics/renderers/actionrenderer3D/transparentobjectrenderer3D.js

/**
 * TransparentObjectRenderer3D
 *
 * Handles rendering of transparent objects (alpha < 1.0) in back-to-front order.
 * Works in conjunction with ObjectRenderer3D which separates and sorts transparent triangles.
 *
 * Architecture:
 * - ObjectRenderer3D: Builds geometry buffers, separates opaque/transparent, sorts transparent triangles
 * - TransparentObjectRenderer3D: Executes the transparent render pass with correct GL state
 */
class TransparentObjectRenderer3D {
    constructor(objectRenderer3D) {
        this.objectRenderer = objectRenderer3D;
    }

    /**
     * Render transparent objects in sorted order (back-to-front)
     * Called after opaque rendering with glStateManager.setupState("transparent")
     * @param {ActionCamera} camera - Current camera
     */
    render(camera) {
        // Delegate to ObjectRenderer3D's internal transparent rendering
        // ObjectRenderer3D has already separated opaque/transparent triangles
        // and built the transparent index buffer

        // If there are transparent triangles, draw them and finalize
        // Otherwise finalize without drawing (to reset frame state)
        if (this.objectRenderer.transparentTriangles.length > 0) {
            this.objectRenderer.drawTransparent(camera);
        } else {
            this.objectRenderer._finalizeFrame();
        }
    }
}
