//actionengine/math/quaternion.js
class Quaternion {
    constructor(x = 0, y = 0, z = 0, w = 1) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }

    // Normalises the axis, for the same reason as setAxisAngle below.
    static fromAxisAngle(axis, angle) {
        return new Quaternion().setAxisAngle(axis, angle);
    }

    static fromEulerY(yAngle) {
        const halfAngle = yAngle * 0.5;
        return new Quaternion(0, Scalar.sin(halfAngle), 0, Scalar.cos(halfAngle));
    }

    static fromEuler(roll, pitch, yaw) {
        // Convert euler angles to quaternion
        // Rotation order: roll (Z-axis) -> pitch (X-axis) -> yaw (Y-axis)
        // This matches the old Arwing.transformVertex() rotation order
        const cr = Scalar.cos(roll * 0.5);
        const sr = Scalar.sin(roll * 0.5);
        const cp = Scalar.cos(pitch * 0.5);
        const sp = Scalar.sin(pitch * 0.5);
        const cy = Scalar.cos(yaw * 0.5);
        const sy = Scalar.sin(yaw * 0.5);

        // ZXY order: Qz * Qx * Qy
        const w = cy * cp * cr + sy * sp * sr;
        const x = cy * sp * cr + sy * cp * sr;
        const y = sy * cp * cr - cy * sp * sr;
        const z = cy * cp * sr - sy * sp * cr;

        return new Quaternion(x, y, z, w);
    }

    // Orientation that points a +Z-forward object (mesh, projectile) along a direction vector.
    // Uses the same Euler convention as fromEuler(0, -pitch, yaw), so a +Z model faces exactly
    // where it's heading. Returns identity for a near-zero vector.
    static fromDirection(vx, vy, vz) {
        const sp = Scalar.hypot3(vx, vy, vz);
        if (sp < 1e-6) return new Quaternion(0, 0, 0, 1);
        const yaw = Scalar.atan2(vx, vz);
        const pitch = Scalar.asin(Math.max(-1, Math.min(1, vy / sp)));
        return Quaternion.fromEuler(0, -pitch, yaw);
    }

    // Hamilton product a∘b (applies b first, then a). Composes two rotations into one.
    static multiply(a, b) {
        return new Quaternion(
            a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
            a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
            a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
            a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
        );
    }

    // The axis is normalized here, so a non-unit axis still yields a unit quaternion. Skipping that
    // scales the whole quaternion by |axis|, and a non-unit quaternion silently scales every vector it
    // rotates. A zero axis gives identity rather than NaN.
    setAxisAngle(axis, angle) {
        const lsq = axis.x * axis.x + axis.y * axis.y + axis.z * axis.z;
        if (lsq === 0) return this.identity();
        const inv = 1 / Math.sqrt(lsq);
        const halfAngle = angle * 0.5;
        const s = Scalar.sin(halfAngle) * inv;
        this.x = axis.x * s;
        this.y = axis.y * s;
        this.z = axis.z * s;
        this.w = Scalar.cos(halfAngle);
        return this;
    }

    setFromEuler(roll, pitch, yaw) {
        // Convert euler angles to quaternion
        // Rotation order: roll (Z-axis) -> pitch (X-axis) -> yaw (Y-axis)
        // This matches the old Arwing.transformVertex() rotation order
        const cr = Scalar.cos(roll * 0.5);
        const sr = Scalar.sin(roll * 0.5);
        const cp = Scalar.cos(pitch * 0.5);
        const sp = Scalar.sin(pitch * 0.5);
        const cy = Scalar.cos(yaw * 0.5);
        const sy = Scalar.sin(yaw * 0.5);

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

        const halfTheta = Scalar.acos(cosHalfTheta);
        const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);

        if (Math.abs(sinHalfTheta) < 0.001) {
            return new Quaternion(
                this.x * 0.5 + other.x * 0.5,
                this.y * 0.5 + other.y * 0.5,
                this.z * 0.5 + other.z * 0.5,
                this.w * 0.5 + other.w * 0.5
            );
        }

        const ratioA = Scalar.sin((1 - t) * halfTheta) / sinHalfTheta;
        const ratioB = Scalar.sin(t * halfTheta) / sinHalfTheta;

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

    // ---- in-place / allocation-free forms ----
    // The physics solver runs these thousands of times per tick and cannot allocate per operation.
    // The allocating forms above are unchanged.

    set(x, y, z, w) {
        this.x = x; this.y = y; this.z = z; this.w = w;
        return this;
    }

    copy(q) {
        this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w;
        return this;
    }

    clone() {
        return new Quaternion(this.x, this.y, this.z, this.w);
    }

    identity() {
        return this.set(0, 0, 0, 1);
    }

    // this = this * q
    multiplyInPlace(q) {
        return this.multiplyQuaternions(this, q);
    }

    // this = a * b. Safe when this aliases either argument.
    multiplyQuaternions(a, b) {
        const ax = a.x, ay = a.y, az = a.z, aw = a.w;
        const bx = b.x, by = b.y, bz = b.z, bw = b.w;
        this.x = aw * bx + ax * bw + ay * bz - az * by;
        this.y = aw * by - ax * bz + ay * bw + az * bx;
        this.z = aw * bz + ax * by - ay * bx + az * bw;
        this.w = aw * bw - ax * bx - ay * by - az * bz;
        return this;
    }

    // Rescale to unit length. A rotation built by repeated multiplication drifts off the unit sphere,
    // and a non-unit quaternion silently SCALES every vector it rotates - the object appears to grow or
    // shrink. slerp() also assumes unit length: its acos(dot) is only the half-angle if both are unit,
    // which is what the >= 1.0 guard there is really working around.
    // A zero quaternion becomes identity rather than NaN.
    normalize() {
        const lsq = this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
        if (lsq === 0) return this.identity();
        const inv = 1 / Math.sqrt(lsq);
        this.x *= inv; this.y *= inv; this.z *= inv; this.w *= inv;
        return this;
    }

    // this = inverse of q. Conjugate only - assumes unit length.
    invertQuaternion(q) {
        this.x = -q.x; this.y = -q.y; this.z = -q.z; this.w = q.w;
        return this;
    }

    invert() {
        return this.invertQuaternion(this);
    }

    dot(q) {
        return this.x * q.x + this.y * q.y + this.z * q.z + this.w * q.w;
    }

    lengthSquared() {
        return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
    }

    length() {
        return Math.sqrt(this.lengthSquared());
    }

    // Rotate `vector` IN PLACE. Cross-product form - no temporary quaternions, no allocation.
    transformVectorInPlace(vector) {
        const qx = this.x, qy = this.y, qz = this.z, qw = this.w;
        const vx = vector.x, vy = vector.y, vz = vector.z;

        const tx = 2 * (qy * vz - qz * vy);
        const ty = 2 * (qz * vx - qx * vz);
        const tz = 2 * (qx * vy - qy * vx);

        vector.x = vx + qw * tx + (qy * tz - qz * ty);
        vector.y = vy + qw * ty + (qz * tx - qx * tz);
        vector.z = vz + qw * tz + (qx * ty - qy * tx);
        return vector;
    }

    // out = this applied to vector, leaving vector untouched.
    transformVectorInto(vector, out) {
        out.x = vector.x; out.y = vector.y; out.z = vector.z;
        return this.transformVectorInPlace(out);
    }

    // Unsigned angle to q, in [0, PI]. |dot| handles double cover: q and -q are the same rotation.
    angleBetween(q) {
        let d = Math.abs(this.dot(q));
        if (d > 1) d = 1;
        return 2 * Scalar.acos(d);
    }

    // Signed angle about `axis`, in [-PI, PI]. Joint limits need direction, not just magnitude.
    signedAngleBetween(q, axis) {
        const ix = -this.x, iy = -this.y, iz = -this.z, iw = this.w;
        const dx = q.w * ix + q.x * iw + q.y * iz - q.z * iy;
        const dy = q.w * iy - q.x * iz + q.y * iw + q.z * ix;
        const dz = q.w * iz + q.x * iy - q.y * ix + q.z * iw;
        const dw = q.w * iw - q.x * ix - q.y * iy - q.z * iz;

        const vecLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (vecLen === 0) return 0;
        const angle = 2 * Scalar.atan2(vecLen, dw);
        const sign = (dx * axis.x + dy * axis.y + dz * axis.z) >= 0 ? 1 : -1;
        const TWO_PI = 6.283185307179586;
        return sign * (angle > Math.PI ? angle - TWO_PI : angle);
    }

    isFinite() {
        return Number.isFinite(this.x) && Number.isFinite(this.y) &&
               Number.isFinite(this.z) && Number.isFinite(this.w);
    }

    equals(q) {
        return this.x === q.x && this.y === q.y && this.z === q.z && this.w === q.w;
    }

    toString() {
        return '(' + this.x + ', ' + this.y + ', ' + this.z + ', ' + this.w + ')';
    }
}
