// actionengine/math/transform.js

/**
 * Transform - Encapsulates position, rotation, scale and model matrix calculation
 * Used by all 3D objects to track their world transform
 */
class Transform {
    constructor() {
        this.position = new Vector3(0, 0, 0);
        this.rotation = new Quaternion(0, 0, 0, 1);
        this.scale = 1.0;
    }

    /**
     * Build 4x4 model matrix from position, rotation, scale
     * @param {number} heightOffset - Optional vertical offset (default: 0)
     * @returns {Matrix4} Model matrix for shader
     */
    getMatrix(heightOffset = 0) {
        const matrix = Matrix4.create();

        if (heightOffset) {
            Matrix4.translate(matrix, matrix, [0, heightOffset / 8, 0]);
        }

        Matrix4.translate(matrix, matrix, this.position.toArray());

        // Apply quaternion rotation
        if (this.rotation) {
            if (typeof this.rotation === "object" && this.rotation.w !== undefined) {
                const rotationMatrix = Matrix4.create();
                Matrix4.fromQuat(rotationMatrix, this.rotation);
                Matrix4.multiply(matrix, matrix, rotationMatrix);
            } else if (typeof this.rotation === "number") {
                Matrix4.rotateY(matrix, matrix, this.rotation);
            }
        }

        Matrix4.scale(matrix, matrix, [this.scale, this.scale, this.scale]);

        return matrix;
    }

    /**
     * Sync transform from a physics body
     * @param {Goblin.RigidBody} body - Physics body with position and rotation
     */
    syncFromPhysicsBody(body) {
        if (!body) return;

        this.position.x = body.position.x;
        this.position.y = body.position.y;
        this.position.z = body.position.z;

        this.rotation = body.rotation;
    }

    /**
     * Copy this transform's values
     * @returns {Transform} New Transform with same values
     */
    clone() {
        const clone = new Transform();
        clone.position = this.position.clone();
        clone.rotation = new Quaternion(this.rotation.x, this.rotation.y, this.rotation.z, this.rotation.w);
        clone.scale = this.scale;
        return clone;
    }
}
