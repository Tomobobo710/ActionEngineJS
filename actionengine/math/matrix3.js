//actionengine/math/matrix3.js
/**
 * Matrix3 - 3x3 matrix with instance fields, allocation-free.
 *
 * The rotation/inertia type. Every operation writes into the receiver or an out parameter rather than
 * returning a new object, because callers run these in tight loops.
 *
 * Element naming is eRC: row R, column C.
 *
 *      | e00 e01 e02 |
 *      | e10 e11 e12 |
 *      | e20 e21 e22 |
 */
class Matrix3 {

    constructor() {
        this.e00 = 1; this.e01 = 0; this.e02 = 0;
        this.e10 = 0; this.e11 = 1; this.e12 = 0;
        this.e20 = 0; this.e21 = 0; this.e22 = 1;
    }

    identity() {
        this.e00 = 1; this.e01 = 0; this.e02 = 0;
        this.e10 = 0; this.e11 = 1; this.e12 = 0;
        this.e20 = 0; this.e21 = 0; this.e22 = 1;
        return this;
    }

    zero() {
        this.e00 = 0; this.e01 = 0; this.e02 = 0;
        this.e10 = 0; this.e11 = 0; this.e12 = 0;
        this.e20 = 0; this.e21 = 0; this.e22 = 0;
        return this;
    }

    copy(m) {
        this.e00 = m.e00; this.e01 = m.e01; this.e02 = m.e02;
        this.e10 = m.e10; this.e11 = m.e11; this.e12 = m.e12;
        this.e20 = m.e20; this.e21 = m.e21; this.e22 = m.e22;
        return this;
    }

    /** Diagonal matrix from a vector — how a principal-axis inertia tensor is built. */
    setDiagonal(v) {
        this.zero();
        this.e00 = v.x; this.e11 = v.y; this.e22 = v.z;
        return this;
    }

    /**
     * Rotation matrix equivalent to a unit quaternion. Assumes q is normalised; a non-unit
     * quaternion produces a matrix that also scales.
     */
    fromQuaternion(q) {
        const x = q.x, y = q.y, z = q.z, w = q.w;
        const x2 = x + x, y2 = y + y, z2 = z + z;
        const xx = x * x2, xy = x * y2, xz = x * z2;
        const yy = y * y2, yz = y * z2, zz = z * z2;
        const wx = w * x2, wy = w * y2, wz = w * z2;

        this.e00 = 1 - (yy + zz); this.e01 = xy - wz;       this.e02 = xz + wy;
        this.e10 = xy + wz;       this.e11 = 1 - (xx + zz); this.e12 = yz - wx;
        this.e20 = xz - wy;       this.e21 = yz + wx;       this.e22 = 1 - (xx + yy);
        return this;
    }

    /** this = transpose(m). For a rotation matrix this is also its inverse. */
    transposeInto(m) {
        const e01 = m.e01, e02 = m.e02, e12 = m.e12;
        this.e00 = m.e00; this.e01 = m.e10; this.e02 = m.e20;
        this.e10 = e01;   this.e11 = m.e11; this.e12 = m.e21;
        this.e20 = e02;   this.e21 = e12;   this.e22 = m.e22;
        return this;
    }

    transpose() {
        return this.transposeInto(this);
    }

    /** this = this * m */
    multiply(m) {
        return this.multiplyFrom(this, m);
    }

    /** this = a * b. Safe when `this` aliases either argument. */
    multiplyFrom(a, b) {
        const a00 = a.e00, a01 = a.e01, a02 = a.e02;
        const a10 = a.e10, a11 = a.e11, a12 = a.e12;
        const a20 = a.e20, a21 = a.e21, a22 = a.e22;
        const b00 = b.e00, b01 = b.e01, b02 = b.e02;
        const b10 = b.e10, b11 = b.e11, b12 = b.e12;
        const b20 = b.e20, b21 = b.e21, b22 = b.e22;

        this.e00 = a00 * b00 + a01 * b10 + a02 * b20;
        this.e01 = a00 * b01 + a01 * b11 + a02 * b21;
        this.e02 = a00 * b02 + a01 * b12 + a02 * b22;
        this.e10 = a10 * b00 + a11 * b10 + a12 * b20;
        this.e11 = a10 * b01 + a11 * b11 + a12 * b21;
        this.e12 = a10 * b02 + a11 * b12 + a12 * b22;
        this.e20 = a20 * b00 + a21 * b10 + a22 * b20;
        this.e21 = a20 * b01 + a21 * b11 + a22 * b21;
        this.e22 = a20 * b02 + a21 * b12 + a22 * b22;
        return this;
    }

    determinant() {
        return this.e00 * (this.e11 * this.e22 - this.e12 * this.e21)
             - this.e01 * (this.e10 * this.e22 - this.e12 * this.e20)
             + this.e02 * (this.e10 * this.e21 - this.e11 * this.e20);
    }

    /**
     * this = inverse(m). Returns false and leaves `this` as identity if m is singular.
     *
     * Singular is a real, reachable case: a body with zero inertia about some axis (an
     * infinitely thin shape, or a degenerate mesh) produces one. Reporting it lets the
     * caller decide, rather than propagating Infinity into every subsequent computation.
     */
    invertInto(m) {
        const c00 = m.e11 * m.e22 - m.e12 * m.e21;
        const c01 = m.e12 * m.e20 - m.e10 * m.e22;
        const c02 = m.e10 * m.e21 - m.e11 * m.e20;
        const det = m.e00 * c00 + m.e01 * c01 + m.e02 * c02;

        if (det === 0) {
            this.identity();
            return false;
        }

        const inv = 1 / det;
        const e00 = m.e00, e01 = m.e01, e02 = m.e02;
        const e10 = m.e10, e11 = m.e11, e12 = m.e12;
        const e20 = m.e20, e21 = m.e21, e22 = m.e22;

        this.e00 = c00 * inv;
        this.e01 = (e02 * e21 - e01 * e22) * inv;
        this.e02 = (e01 * e12 - e02 * e11) * inv;
        this.e10 = c01 * inv;
        this.e11 = (e00 * e22 - e02 * e20) * inv;
        this.e12 = (e02 * e10 - e00 * e12) * inv;
        this.e20 = c02 * inv;
        this.e21 = (e01 * e20 - e00 * e21) * inv;
        this.e22 = (e00 * e11 - e01 * e10) * inv;
        return true;
    }

    invert() {
        return this.invertInto(this);
    }

    /** Rotate v in place by this matrix. */
    transformVector3(v) {
        const x = v.x, y = v.y, z = v.z;
        v.x = this.e00 * x + this.e01 * y + this.e02 * z;
        v.y = this.e10 * x + this.e11 * y + this.e12 * z;
        v.z = this.e20 * x + this.e21 * y + this.e22 * z;
        return v;
    }

    transformVector3Into(v, out) {
        const x = v.x, y = v.y, z = v.z;
        out.x = this.e00 * x + this.e01 * y + this.e02 * z;
        out.y = this.e10 * x + this.e11 * y + this.e12 * z;
        out.z = this.e20 * x + this.e21 * y + this.e22 * z;
        return out;
    }

    isFinite() {
        return Number.isFinite(this.e00) && Number.isFinite(this.e01) && Number.isFinite(this.e02) &&
               Number.isFinite(this.e10) && Number.isFinite(this.e11) && Number.isFinite(this.e12) &&
               Number.isFinite(this.e20) && Number.isFinite(this.e21) && Number.isFinite(this.e22);
    }
}
