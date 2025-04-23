// actionengine/display/graphics/renderableobject.js
class RenderableObject {
    constructor() {
        // Add visual update tracking
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
    getModelMatrix() {
        const matrix = Matrix4.create();
        const rotationMatrix = Matrix4.create();

        // Apply initial vertical offset
        Matrix4.translate(matrix, matrix, [0, this.height / 8, 0]);

        // Apply position
        Matrix4.translate(matrix, matrix, this.position.toArray());

        // Apply full rotation from physics body if it exists
        if (this.body) {
            Matrix4.fromQuat(rotationMatrix, this.body.rotation);
            Matrix4.multiply(matrix, matrix, rotationMatrix);
        } else {
            // Fall back to simple Y rotation if no physics body
            Matrix4.rotateY(matrix, matrix, this.rotation);
        }

        // Apply scale
        Matrix4.scale(matrix, matrix, [this.scale, this.scale, this.scale]);

        return matrix;
    }
}