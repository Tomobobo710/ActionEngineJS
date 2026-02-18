// actionengine/math/quaternion.js
class Quaternion {
    constructor(x = 0, y = 0, z = 0, w = 1) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }

    static fromAxisAngle(axis, angle) {
        const halfAngle = angle * 0.5;
        const s = Math.sin(halfAngle);
        return new Quaternion(axis.x * s, axis.y * s, axis.z * s, Math.cos(halfAngle));
    }

    static fromEulerY(yAngle) {
        const halfAngle = yAngle * 0.5;
        return new Quaternion(0, Math.sin(halfAngle), 0, Math.cos(halfAngle));
    }

    static fromEuler(roll, pitch, yaw) {
        // Convert euler angles to quaternion
        // Rotation order: roll (Z-axis) -> pitch (X-axis) -> yaw (Y-axis)
        // This matches the old Arwing.transformVertex() rotation order
        const cr = Math.cos(roll * 0.5);
        const sr = Math.sin(roll * 0.5);
        const cp = Math.cos(pitch * 0.5);
        const sp = Math.sin(pitch * 0.5);
        const cy = Math.cos(yaw * 0.5);
        const sy = Math.sin(yaw * 0.5);

        // ZXY order: Qz * Qx * Qy
        const w = cy * cp * cr + sy * sp * sr;
        const x = cy * sp * cr + sy * cp * sr;
        const y = sy * cp * cr - cy * sp * sr;
        const z = cy * cp * sr - sy * sp * cr;

        return new Quaternion(x, y, z, w);
    }

    setAxisAngle(axis, angle) {
        const halfAngle = angle * 0.5;
        const s = Math.sin(halfAngle);
        this.x = axis.x * s;
        this.y = axis.y * s;
        this.z = axis.z * s;
        this.w = Math.cos(halfAngle);
        return this;
    }

    setFromEuler(roll, pitch, yaw) {
        // Convert euler angles to quaternion
        // Rotation order: roll (Z-axis) -> pitch (X-axis) -> yaw (Y-axis)
        // This matches the old Arwing.transformVertex() rotation order
        const cr = Math.cos(roll * 0.5);
        const sr = Math.sin(roll * 0.5);
        const cp = Math.cos(pitch * 0.5);
        const sp = Math.sin(pitch * 0.5);
        const cy = Math.cos(yaw * 0.5);
        const sy = Math.sin(yaw * 0.5);

        // ZXY order: Qz * Qx * Qy
        this.w = cy * cp * cr + sy * sp * sr;
        this.x = cy * sp * cr + sy * cp * sr;
        this.y = sy * cp * cr - cy * sp * sr;
        this.z = cy * cp * sr - sy * sp * cr;
        return this;
    }

    slerp(other, t) {
        let cosHalfTheta = this.x * other.x + this.y * other.y + this.z * other.z + this.w * other.w;

        if (Math.abs(cosHalfTheta) >= 1.0) {
            return this;
        }

        const halfTheta = Math.acos(cosHalfTheta);
        const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);

        if (Math.abs(sinHalfTheta) < 0.001) {
            return new Quaternion(
                this.x * 0.5 + other.x * 0.5,
                this.y * 0.5 + other.y * 0.5,
                this.z * 0.5 + other.z * 0.5,
                this.w * 0.5 + other.w * 0.5
            );
        }

        const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
        const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

        return new Quaternion(
            this.x * ratioA + other.x * ratioB,
            this.y * ratioA + other.y * ratioB,
            this.z * ratioA + other.z * ratioB,
            this.w * ratioA + other.w * ratioB
        );
    }

    /**
     * Transform a vector by this quaternion rotation
     * Uses the formula: v' = q * v * q^-1
     * @param {Vector3} vector - The vector to rotate
     * @returns {Vector3} The rotated vector
     */
    transformVector(vector) {
        const x = vector.x,
            y = vector.y,
            z = vector.z;
        const qx = this.x,
            qy = this.y,
            qz = this.z,
            qw = this.w;

        // Calculate q * v
        const ix = qw * x + qy * z - qz * y;
        const iy = qw * y + qz * x - qx * z;
        const iz = qw * z + qx * y - qy * x;
        const iw = -qx * x - qy * y - qz * z;

        // Calculate (q * v) * q^-1
        const rx = ix * qw + iw * -qx + iy * -qz - iz * -qy;
        const ry = iy * qw + iw * -qy + iz * -qx - ix * -qz;
        const rz = iz * qw + iw * -qz + ix * -qy - iy * -qx;

        return new Vector3(rx, ry, rz);
    }
}
