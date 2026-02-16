// actionengine/display/graphics/renderableobject.js

/**
 * RenderableObject - Base class for all 3D renderable objects
 * Provides transform and visual state management
 */
class RenderableObject {
    constructor() {
        this.transform = new Transform();
        this.height = 0;

        this.body = null;
        this.physicsWorld = null;

        this._visualDirty = true;
        this._lastPosition = null;
        this._lastRotation = null;
    }

    markVisualDirty() {
        this._visualDirty = true;
    }

    isVisualDirty() {
        return this._visualDirty;
    }

    /**
     * Build model matrix from this object's transform
     * @returns {Matrix4} Model matrix for shader
     */
    getModelMatrix() {
        if (this.body && this.body.rotation) {
            const matrix = Matrix4.create();
            const rotationMatrix = Matrix4.create();

            Matrix4.translate(matrix, matrix, [0, this.height / 8, 0]);
            Matrix4.translate(matrix, matrix, this.transform.position.toArray());

            Matrix4.fromQuat(rotationMatrix, this.body.rotation);
            Matrix4.multiply(matrix, matrix, rotationMatrix);

            Matrix4.scale(matrix, matrix, [this.transform.scale, this.transform.scale, this.transform.scale]);

            return matrix;
        }

        return this.transform.getMatrix(this.height);
    }

    /**
     * Update game logic
     * @param {number} deltaTime - Time since last update
     */
    update(deltaTime) {}

    /**
     * Update visual representation
     * Called after update(). Subclasses override to sync visual state.
     */
    updateVisual() {}
}
