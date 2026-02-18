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

    /**
     * Transform a point from local space to world space
     * Applies rotation, scale, and translation
     * @param {Vector3} point - Point in local space
     * @returns {Vector3} Point in world space
     */
    transformPoint(point) {
        // Rotate using quaternion math: v' = q * v * q^-1
        const x = point.x,
            y = point.y,
            z = point.z;
        const qx = this.rotation.x,
            qy = this.rotation.y,
            qz = this.rotation.z,
            qw = this.rotation.w;

        // q * v
        const ix = qw * x + qy * z - qz * y;
        const iy = qw * y + qz * x - qx * z;
        const iz = qw * z + qx * y - qy * x;
        const iw = -qx * x - qy * y - qz * z;

        // (q * v) * q^-1
        const rx = ix * qw + iw * -qx + iy * -qz - iz * -qy;
        const ry = iy * qw + iw * -qy + iz * -qx - ix * -qz;
        const rz = iz * qw + iw * -qz + ix * -qy - iy * -qx;

        // Scale
        const sx = rx * this.scale;
        const sy = ry * this.scale;
        const sz = rz * this.scale;

        // Translate
        return new Vector3(sx + this.position.x, sy + this.position.y, sz + this.position.z);
    }

    /**
     * Transform a vector from local space to world space
     * Only applies rotation and scale (no translation)
     * @param {Vector3} vector - Vector in local space
     * @returns {Vector3} Vector in world space
     */
    transformVector(vector) {
        // Rotate using quaternion math: v' = q * v * q^-1
        const x = vector.x,
            y = vector.y,
            z = vector.z;
        const qx = this.rotation.x,
            qy = this.rotation.y,
            qz = this.rotation.z,
            qw = this.rotation.w;

        // q * v
        const ix = qw * x + qy * z - qz * y;
        const iy = qw * y + qz * x - qx * z;
        const iz = qw * z + qx * y - qy * x;
        const iw = -qx * x - qy * y - qz * z;

        // (q * v) * q^-1
        const rx = ix * qw + iw * -qx + iy * -qz - iz * -qy;
        const ry = iy * qw + iw * -qy + iz * -qx - ix * -qz;
        const rz = iz * qw + iw * -qz + ix * -qy - iy * -qx;

        // Scale
        return new Vector3(rx * this.scale, ry * this.scale, rz * this.scale);
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
        // Rotate using quaternion math: v' = q * v * q^-1
        const x = point.x,
            y = point.y,
            z = point.z;
        const qx = this.rotation.x,
            qy = this.rotation.y,
            qz = this.rotation.z,
            qw = this.rotation.w;

        // q * v
        const ix = qw * x + qy * z - qz * y;
        const iy = qw * y + qz * x - qx * z;
        const iz = qw * z + qx * y - qy * x;
        const iw = -qx * x - qy * y - qz * z;

        // (q * v) * q^-1
        const rx = ix * qw + iw * -qx + iy * -qz - iz * -qy;
        const ry = iy * qw + iw * -qy + iz * -qx - ix * -qz;
        const rz = iz * qw + iw * -qz + ix * -qy - iy * -qx;

        // Scale
        const sx = rx * this.scale;
        const sy = ry * this.scale;
        const sz = rz * this.scale;

        // Translate and store in destination
        dest.x = sx + this.position.x;
        dest.y = sy + this.position.y;
        dest.z = sz + this.position.z;
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
        // Rotate using quaternion math: v' = q * v * q^-1
        const x = vector.x,
            y = vector.y,
            z = vector.z;
        const qx = this.rotation.x,
            qy = this.rotation.y,
            qz = this.rotation.z,
            qw = this.rotation.w;

        // q * v
        const ix = qw * x + qy * z - qz * y;
        const iy = qw * y + qz * x - qx * z;
        const iz = qw * z + qx * y - qy * x;
        const iw = -qx * x - qy * y - qz * z;

        // (q * v) * q^-1
        const rx = ix * qw + iw * -qx + iy * -qz - iz * -qy;
        const ry = iy * qw + iw * -qy + iz * -qx - ix * -qz;
        const rz = iz * qw + iw * -qz + ix * -qy - iy * -qx;

        // Scale and store in destination
        dest.x = rx * this.scale;
        dest.y = ry * this.scale;
        dest.z = rz * this.scale;
        return dest;
    }
}
