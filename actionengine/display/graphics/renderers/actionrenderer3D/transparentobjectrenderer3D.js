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

    render(camera) {
        // If there are transparent objects in the queue, draw them
        if (this.objectRenderer._transparentQueue && this.objectRenderer._transparentQueue.length > 0) {
            this.objectRenderer.drawTransparent(camera);
        } else {
            this.objectRenderer._finalizeFrame();
        }
    }
}
