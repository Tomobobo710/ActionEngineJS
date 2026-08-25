//actionengine/math/transform.js

/**
 * Transform - Encapsulates position, rotation, scale and model matrix calculation
 * Used by all 3D objects to track their world transform
 */
class Transform {
    constructor() {
        this.position = new Vector3(0, 0, 0);
        this.rotation = new Quaternion(0, 0, 0, 1);
        this.scale = new Vector3(1, 1, 1);
    }

    /**
     * Sync transform from a physics body
     * @param {Object} body - Physics body with position and rotation
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
        clone.scale = this.scale.clone();
        return clone;
    }

    /**
     * Transform a point from local space to world space
     * Applies rotation, scale, and translation
     * @param {Vector3} point - Point in local space
     * @returns {Vector3} Point in world space
     */
    transformPoint(point) {
        // 1. Scale first (Local Space)
        const sx = point.x * this.scale.x;
        const sy = point.y * this.scale.y;
        const sz = point.z * this.scale.z;

        // 2. Rotate (after scaling)
        const qx = this.rotation.x,
            qy = this.rotation.y,
            qz = this.rotation.z,
            qw = this.rotation.w;

        // q * v (v is the scaled point)
        const ix = qw * sx + qy * sz - qz * sy;
        const iy = qw * sy + qz * sx - qx * sz;
        const iz = qw * sz + qx * sy - qy * sx;
        const iw = -qx * sx - qy * sy - qz * sz;

        // (q * v) * q^-1
        const rx = ix * qw + iw * -qx + iy * -qz - iz * -qy;
        const ry = iy * qw + iw * -qy + iz * -qx - ix * -qz;
        const rz = iz * qw + iw * -qz + ix * -qy - iy * -qx;

        // 3. Translate
        return new Vector3(rx + this.position.x, ry + this.position.y, rz + this.position.z);
    }

    /**
     * Transform a vector from local space to world space
     * Only applies rotation and scale (no translation)
     * @param {Vector3} vector - Vector in local space
     * @returns {Vector3} Vector in world space
     */
    transformVector(vector) {
        // 1. Scale first (Local Space)
        const sx = vector.x * this.scale.x;
        const sy = vector.y * this.scale.y;
        const sz = vector.z * this.scale.z;

        // 2. Rotate (after scaling)
        const qx = this.rotation.x,
            qy = this.rotation.y,
            qz = this.rotation.z,
            qw = this.rotation.w;

        // q * v (v is the scaled vector)
        const ix = qw * sx + qy * sz - qz * sy;
        const iy = qw * sy + qz * sx - qx * sz;
        const iz = qw * sz + qx * sy - qy * sx;
        const iw = -qx * sx - qy * sy - qz * sz;

        // (q * v) * q^-1
        const rx = ix * qw + iw * -qx + iy * -qz - iz * -qy;
        const ry = iy * qw + iw * -qy + iz * -qx - ix * -qz;
        const rz = iz * qw + iw * -qz + ix * -qy - iy * -qx;

        return new Vector3(rx, ry, rz);
    }

    /**
     * Transform a point from local space to world space into a destination vector
     * Applies rotation, scale, and translation
     * Reuses the destination vector to avoid allocation
     * @param {Vector3} point - Point in local space
     * @param {Vector3} dest - Destination vector to store result
     * @returns {Vector3} The destination vector
     */
    transformPointInto(point, dest) {
        // 1. Scale first (Local Space)
        const sx = point.x * this.scale.x;
        const sy = point.y * this.scale.y;
        const sz = point.z * this.scale.z;

        // 2. Rotate (after scaling)
        const qx = this.rotation.x,
            qy = this.rotation.y,
            qz = this.rotation.z,
            qw = this.rotation.w;

        // q * v
        const ix = qw * sx + qy * sz - qz * sy;
        const iy = qw * sy + qz * sx - qx * sz;
        const iz = qw * sz + qx * sy - qy * sx;
        const iw = -qx * sx - qy * sy - qz * sz;

        // (q * v) * q^-1
        const rx = ix * qw + iw * -qx + iy * -qz - iz * -qy;
        const ry = iy * qw + iw * -qy + iz * -qx - ix * -qz;
        const rz = iz * qw + iw * -qz + ix * -qy - iy * -qx;

        // 3. Translate and store in destination
        dest.x = rx + this.position.x;
        dest.y = ry + this.position.y;
        dest.z = rz + this.position.z;
        return dest;
    }

    /**
     * Transform a vector from local space to world space into a destination vector
     * Only applies rotation and scale (no translation)
     * Reuses the destination vector to avoid allocation
     * @param {Vector3} vector - Vector in local space
     * @param {Vector3} dest - Destination vector to store result
     * @returns {Vector3} The destination vector
     */
    transformVectorInto(vector, dest) {
        // 1. Scale first (Local Space)
        const sx = vector.x * this.scale.x;
        const sy = vector.y * this.scale.y;
        const sz = vector.z * this.scale.z;

        // 2. Rotate (after scaling)
        const qx = this.rotation.x,
            qy = this.rotation.y,
            qz = this.rotation.z,
            qw = this.rotation.w;

        // q * v
        const ix = qw * sx + qy * sz - qz * sy;
        const iy = qw * sy + qz * sx - qx * sz;
        const iz = qw * sz + qx * sy - qy * sx;
        const iw = -qx * sx - qy * sy - qz * sz;

        // (q * v) * q^-1
        const rx = ix * qw + iw * -qx + iy * -qz - iz * -qy;
        const ry = iy * qw + iw * -qy + iz * -qx - ix * -qz;
        const rz = iz * qw + iw * -qz + ix * -qy - iy * -qx;

        // Store in destination
        dest.x = rx;
        dest.y = ry;
        dest.z = rz;
        return dest;
    }
}
