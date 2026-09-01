// ActionPhysics 0.1.0 — built 2026-08-31T10:40:27.605Z
// ==== src/intro.js ====
/**
 * ActionPhysics - a deterministic, dependency-free 3D physics engine. Ships as one concatenated
 * file, loadable from a <script> tag or require().
 *
 * Math is injectable: ActionPhysics runs on ActionMath and bundles its own copy, but if the host
 * already has ActionMath (via window.ActionMath, or the classes in scope) it adopts those instead,
 * so a page loading both doesn't end up with two Vector3 classes and `instanceof` false across them.
 */
(function (root, factory) {
    'use strict';

    // A host that concatenates its own ActionMath exposes the classes at script scope (`typeof`
    // reaches them, `root.X` does not).
    var injected = (typeof root.ActionMath === 'object' && root.ActionMath) ? root.ActionMath : {};
    function adopt(name, scoped) {
        if (injected[name]) return injected[name];
        return scoped || null;
    }
    var host = {
        Scalar:     adopt('Scalar',     typeof Scalar     !== 'undefined' ? Scalar     : null),
        Vector2:    adopt('Vector2',    typeof Vector2    !== 'undefined' ? Vector2    : null),
        Vector3:    adopt('Vector3',    typeof Vector3    !== 'undefined' ? Vector3    : null),
        Matrix3:    adopt('Matrix3',    typeof Matrix3    !== 'undefined' ? Matrix3    : null),
        Matrix4:    adopt('Matrix4',    typeof Matrix4    !== 'undefined' ? Matrix4    : null),
        Quaternion: adopt('Quaternion', typeof Quaternion !== 'undefined' ? Quaternion : null),
        Transform:  adopt('Transform',  typeof Transform  !== 'undefined' ? Transform  : null)
    };

    var api = factory(host);
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        root.ActionPhysics = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (host) {
    'use strict';

    const ActionPhysics = {};

    // True when every math class came from the host rather than the bundled copy.
    ActionPhysics.usingHostMath = false;


// ==== src/math/Scalar.js ====
var Scalar;
if (host.Scalar) {
    Scalar = host.Scalar;
} else {
    // Part of ActionMath - the shared math library. This file is pasted here VERBATIM from its source of
    // truth and must not be edited locally. Anything this engine needs is added to ActionMath first, then
    // arrives here through the same paste.
    /**
     * Deterministic scalar functions.
     *
     * The JS spec mandates correctly-rounded arithmetic and sqrt with no extended precision, so that much
     * is already bit-identical across engines and platforms. It does NOT specify sin/cos/tan/asin/acos/atan/
     * atan2/pow/exp/log - those are implementation-approximated and differ in low bits between V8,
     * SpiderMonkey and JavaScriptCore.
     *
     * Everything the rest of the maths needs from that list is implemented here in terms of the operations
     * that ARE specified, so results are reproducible across machines. Anything that must be deterministic
     * calls Scalar rather than Math.
     */
    var Scalar = {};

    Scalar.PI = 3.141592653589793;
    Scalar.TWO_PI = 6.283185307179586;
    Scalar.HALF_PI = 1.5707963267948966;
    Scalar.EPSILON = 1e-9;

    /**
     * Reduce an angle to [-PI, PI]. Uses Cody-Waite style splitting of 2*PI into high and low
     * parts so the subtraction stays exact for the magnitudes physics produces; a single
     * multiply-subtract loses precision for large angles.
     */
    Scalar.wrapAngle = function (x) {
        const TWO_PI_HI = 6.28318530717958623200;
        const TWO_PI_LO = 2.44929359829470635445e-16;
        if (x >= -Scalar.PI && x <= Scalar.PI) {
            return x;
        }
        // Round-to-nearest count of full turns, without Math.round on a huge value.
        const turns = x / Scalar.TWO_PI;
        const n = turns >= 0 ? Math.floor(turns + 0.5) : Math.ceil(turns - 0.5);
        return (x - n * TWO_PI_HI) - n * TWO_PI_LO;
    };

    /**
     * sin(x) — minimax polynomial on the reduced argument.
     *
     * Reduce to [-PI, PI], fold into [-PI/2, PI/2] using sin(PI - x) = sin(x), then evaluate a
     * degree-13 odd polynomial in x^2. Odd-only terms keep sin(-x) === -sin(x) exactly, which
     * matters more for a physics engine than the last ULP: an asymmetric sine injects a
     * directional bias into anything that rotates.
     */
    Scalar.sin = function (x) {
        x = Scalar.wrapAngle(x);

        // Odd: fold to [0, PI] and carry the sign. Doing this by sign rather than by
        // polynomial keeps sin(-x) === -sin(x) bit-exact.
        let sign = 1;
        if (x < 0) { x = -x; sign = -1; }

        // sin(PI - x) = sin(x): fold to [0, PI/2].
        if (x > Scalar.HALF_PI) x = Scalar.PI - x;

        // Both kernels below are only accurate to ~PI/4, so use whichever identity keeps the
        // argument small: sin near 0, cos near PI/2.
        if (x > 0.7853981633974483) {
            return sign * Scalar._cosKernel(Scalar.HALF_PI - x);
        }
        return sign * Scalar._sinKernel(x);
    };

    /** sin on [0, PI/4]. Odd-only polynomial in x^2. */
    Scalar._sinKernel = function (x) {
        const x2 = x * x;
        let p = 1.58962301576546568060e-10;
        p = p * x2 - 2.50507477628578072866e-8;
        p = p * x2 + 2.75573136213857245213e-6;
        p = p * x2 - 1.98412698295895385996e-4;
        p = p * x2 + 8.33333333332211858878e-3;
        p = p * x2 - 1.66666666666666307295e-1;
        return x + x * x2 * p;
    };

    /** cos on [0, PI/4]. Even-only polynomial in x^2. */
    Scalar._cosKernel = function (x) {
        const x2 = x * x;
        let p = -1.13585365213876817300e-11;
        p = p * x2 + 2.08757008419747316778e-9;
        p = p * x2 - 2.75573141792967388112e-7;
        p = p * x2 + 2.48015872888517179954e-5;
        p = p * x2 - 1.38888888888730564116e-3;
        p = p * x2 + 4.16666666666665929218e-2;
        return 1 - 0.5 * x2 + x2 * x2 * p;
    };

    /**
     * cos(x) — its own reduction and its own even polynomial in x^2.
     *
     * NOT sin(x + PI/2): that shift destroys exact evenness (the added constant is not
     * symmetric about zero) and pushes arguments near the peak out to x = PI, the worst point
     * for sin's polynomial — measured cos(0) at 6e-12 off instead of exact. Evaluating an
     * even-only polynomial here makes cos(-x) === cos(x) bit-exact.
     */
    Scalar.cos = function (x) {
        x = Scalar.wrapAngle(x);
        if (x < 0) x = -x;              // even: fold to [0, PI]

        // cos(PI - x) = -cos(x): fold to [0, PI/2].
        let sign = 1;
        if (x > Scalar.HALF_PI) {
            x = Scalar.PI - x;
            sign = -1;
        }

        // Same octant split as sin, for the same reason: each kernel is accurate to ~PI/4.
        if (x > 0.7853981633974483) {
            return sign * Scalar._sinKernel(Scalar.HALF_PI - x);
        }
        return sign * Scalar._cosKernel(x);
    };

    /**
     * atan(x) on the full range, by range reduction onto [0, tan(PI/12)] and an odd polynomial.
     * Odd-only again, so atan(-x) === -atan(x) exactly.
     */
    Scalar.atan = function (x) {
        if (x !== x) return NaN;

        const negate = x < 0;
        if (negate) x = -x;

        let offset = 0;
        if (x > 1) {
            // atan(x) = PI/2 - atan(1/x)
            x = 1 / x;
            offset = Scalar.HALF_PI;
        }
        let invert = offset !== 0;

        // Second reduction: atan(x) = PI/6 + atan((x*sqrt(3) - 1) / (x + sqrt(3)))
        const SQRT3 = 1.7320508075688772;
        let extra = 0;
        if (x > 0.2679491924311227) { // tan(PI/12)
            x = (x * SQRT3 - 1) / (x + SQRT3);
            extra = 0.5235987755982988; // PI/6
        }

        // Rational approximation (Cephes atan), accurate to near machine precision on the
        // reduced range |x| <= tan(PI/12).
        const x2 = x * x;
        let num = -8.750608600031904122785e-1;
        num = num * x2 - 1.615753718733365076637e1;
        num = num * x2 - 7.500855792314704667340e1;
        num = num * x2 - 1.228866684490136173410e2;
        num = num * x2 - 6.485021904942025371773e1;

        let den = x2 + 2.485846490142306297962e1;
        den = den * x2 + 1.650270098316988542046e2;
        den = den * x2 + 4.328810604912902668951e2;
        den = den * x2 + 4.853903996359136964868e2;
        den = den * x2 + 1.945506571482613964425e2;

        let r = x + x * x2 * (num / den);

        r += extra;
        if (invert) r = offset - r;
        return negate ? -r : r;
    };

    /** atan2(y, x) — quadrant-correct, built on Scalar.atan. */
    Scalar.atan2 = function (y, x) {
        if (x > 0) return Scalar.atan(y / x);
        if (x < 0) return y >= 0 ? Scalar.atan(y / x) + Scalar.PI : Scalar.atan(y / x) - Scalar.PI;
        // x === 0
        if (y > 0) return Scalar.HALF_PI;
        if (y < 0) return -Scalar.HALF_PI;
        return 0;
    };

    /**
     * asin(x) for x in [-1, 1]. Out-of-range input is clamped rather than returning NaN:
     * callers reach this through dot products of unit vectors, where |x| can exceed 1 by a few
     * ULP purely from rounding, and that is not an error.
     */
    Scalar.asin = function (x) {
        if (x >= 1) return Scalar.HALF_PI;
        if (x <= -1) return -Scalar.HALF_PI;
        // asin(x) = atan(x / sqrt(1 - x^2)), stable away from |x| = 1.
        return Scalar.atan(x / Math.sqrt(1 - x * x));
    };

    /** acos(x) = PI/2 - asin(x), with the same clamping rationale. */
    Scalar.acos = function (x) {
        if (x >= 1) return 0;
        if (x <= -1) return Scalar.PI;
        return Scalar.HALF_PI - Scalar.asin(x);
    };

    /** tan(x) = sin(x)/cos(x). Callers are responsible for avoiding the poles. */
    Scalar.tan = function (x) {
        return Scalar.sin(x) / Scalar.cos(x);
    };

    /**
     * sqrt(x^2 + y^2 + z^2). Math.hypot is implementation-defined (it does extra work to avoid overflow at
     * extreme magnitudes, and engines differ in how); the direct form is exact under the spec's guarantees
     * for * + and sqrt, and the magnitudes here never approach overflow.
     */
    Scalar.hypot3 = function (x, y, z) {
        return Math.sqrt(x * x + y * y + z * z);
    };

    /** Clamp v into [lo, hi]. */
    Scalar.clamp = function (v, lo, hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    };

    ActionPhysics.Scalar = Scalar;

}
ActionPhysics.Scalar = Scalar;


// ==== src/math/Vector2.js ====
var Vector2;
if (host.Vector2) {
    Vector2 = host.Vector2;
} else {
    // Part of ActionMath - the shared math library. This file is pasted here VERBATIM from its source of
    // truth and must not be edited locally. Anything this engine needs is added to ActionMath first, then
    // arrives here through the same paste.
    Vector2 = class Vector2 {
        constructor(x = 0, y = 0) {
            this.x = x;
            this.y = y;
        }

        // Static creation methods
        static create(x = 0, y = 0) {
            return new Vector2(x, y);
        }

        static fromAngle(angle) {
            return new Vector2(Scalar.cos(angle), Scalar.sin(angle));
        }

        static fromArray(arr, offset = 0) {
            return new Vector2(arr[offset], arr[offset + 1]);
        }

        static zero() {
            return new Vector2(0, 0);
        }

        static one() {
            return new Vector2(1, 1);
        }

        static up() {
            return new Vector2(0, -1);
        }

        static down() {
            return new Vector2(0, 1);
        }

        static left() {
            return new Vector2(-1, 0);
        }

        static right() {
            return new Vector2(1, 0);
        }

        // Basic operations (modifying this vector)
        set(x, y) {
            this.x = x;
            this.y = y;
            return this;
        }

        copy(v) {
            this.x = v.x;
            this.y = v.y;
            return this;
        }

        add(v) {
            this.x += v.x;
            this.y += v.y;
            return this;
        }

        subtract(v) {
            this.x -= v.x;
            this.y -= v.y;
            return this;
        }

        multiply(v) {
            this.x *= v.x;
            this.y *= v.y;
            return this;
        }

        divide(v) {
            this.x /= v.x;
            this.y /= v.y;
            return this;
        }

        scale(scalar) {
            this.x *= scalar;
            this.y *= scalar;
            return this;
        }

        negate() {
            this.x = -this.x;
            this.y = -this.y;
            return this;
        }

        normalize() {
            const len = this.length();
            if (len > 0) {
                this.x /= len;
                this.y /= len;
            }
            return this;
        }

        rotate(angle) {
            const cos = Scalar.cos(angle);
            const sin = Scalar.sin(angle);
            const x = this.x * cos - this.y * sin;
            const y = this.x * sin + this.y * cos;
            this.x = x;
            this.y = y;
            return this;
        }

        // Vector properties
        length() {
            return Math.sqrt(this.x * this.x + this.y * this.y);
        }

        lengthSquared() {
            return this.x * this.x + this.y * this.y;
        }

        angle() {
            return Scalar.atan2(this.y, this.x);
        }

        distanceTo(v) {
            const dx = this.x - v.x;
            const dy = this.y - v.y;
            return Math.sqrt(dx * dx + dy * dy);
        }

        distanceToSquared(v) {
            const dx = this.x - v.x;
            const dy = this.y - v.y;
            return dx * dx + dy * dy;
        }

        dot(v) {
            return this.x * v.x + this.y * v.y;
        }

        cross(v) {
            return this.x * v.y - this.y * v.x;
        }

        // Utility methods
        clone() {
            return new Vector2(this.x, this.y);
        }

        equals(v) {
            return this.x === v.x && this.y === v.y;
        }

        isZero() {
            return this.x === 0 && this.y === 0;
        }

        toString() {
            return `Vector2(${this.x}, ${this.y})`;
        }

        toArray() {
            return [this.x, this.y];
        }

        // Static operations (returning new vectors)
        static add(out, a, b) {
            out.x = a.x + b.x;
            out.y = a.y + b.y;
            return out;
        }

        static subtract(out, a, b) {
            out.x = a.x - b.x;
            out.y = a.y - b.y;
            return out;
        }

        static multiply(out, a, b) {
            out.x = a.x * b.x;
            out.y = a.y * b.y;
            return out;
        }

        static divide(out, a, b) {
            out.x = a.x / b.x;
            out.y = a.y / b.y;
            return out;
        }

        static scale(out, v, scalar) {
            out.x = v.x * scalar;
            out.y = v.y * scalar;
            return out;
        }

        static lerp(out, a, b, t) {
            out.x = a.x + (b.x - a.x) * t;
            out.y = a.y + (b.y - a.y) * t;
            return out;
        }

        static min(out, a, b) {
            out.x = Math.min(a.x, b.x);
            out.y = Math.min(a.y, b.y);
            return out;
        }

        static max(out, a, b) {
            out.x = Math.max(a.x, b.x);
            out.y = Math.max(a.y, b.y);
            return out;
        }

        static normalize(out, v) {
            const len = v.length();
            if (len > 0) {
                out.x = v.x / len;
                out.y = v.y / len;
            }
            return out;
        }

        static rotate(out, v, angle) {
            const cos = Scalar.cos(angle);
            const sin = Scalar.sin(angle);
            out.x = v.x * cos - v.y * sin;
            out.y = v.x * sin + v.y * cos;
            return out;
        }

        static dot(a, b) {
            return a.x * b.x + a.y * b.y;
        }

        static cross(a, b) {
            return a.x * b.y - a.y * b.x;
        }

        static distance(a, b) {
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            return Math.sqrt(dx * dx + dy * dy);
        }

        static distanceSquared(a, b) {
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            return dx * dx + dy * dy;
        }

        static angle(a, b) {
            return Scalar.atan2(b.y - a.y, b.x - a.x);
        }

        // Advanced operations
        static reflect(out, v, normal) {
            const dot = v.x * normal.x + v.y * normal.y;
            out.x = v.x - 2 * dot * normal.x;
            out.y = v.y - 2 * dot * normal.y;
            return out;
        }

        static project(out, a, b) {
            const dot = (a.x * b.x + a.y * b.y) / (b.x * b.x + b.y * b.y);
            out.x = b.x * dot;
            out.y = b.y * dot;
            return out;
        }

        static perpendicular(out, v) {
            out.x = -v.y;
            out.y = v.x;
            return out;
        }
    }

    ActionPhysics.Vector2 = Vector2;

}
ActionPhysics.Vector2 = Vector2;


// ==== src/math/Vector3.js ====
var Vector3;
if (host.Vector3) {
    Vector3 = host.Vector3;
} else {
    // Part of ActionMath - the shared math library. This file is pasted here VERBATIM from its source of
    // truth and must not be edited locally. Anything this engine needs is added to ActionMath first, then
    // arrives here through the same paste.
    Vector3 = class Vector3 {
        // Vector pool for object reuse
        static _pool = [];
        static _poolSize = 0;
        static _maxPoolSize = 1000;

        // Get a vector from the pool or create a new one
        static getFromPool(x = 0, y = 0, z = 0) {
            if (Vector3._poolSize > 0) {
                const vec = Vector3._pool[--Vector3._poolSize];
                vec.set(x, y, z);
                return vec;
            }
            return new Vector3(x, y, z);
        }

        // Return a vector to the pool when done with it
        static returnToPool(vec) {
            if (Vector3._poolSize < Vector3._maxPoolSize) {
                Vector3._pool[Vector3._poolSize++] = vec;
            }
        }
        constructor(x = 0, y = 0, z = 0) {
            this.x = x;
            this.y = y;
            this.z = z;
        }
        set(x, y, z) {
            if (y === undefined && z === undefined && x.x !== undefined) {
                // If passed another vector
                this.x = x.x;
                this.y = x.y;
                this.z = x.z;
            } else {
                // If passed 3 numbers
                this.x = x;
                this.y = y;
                this.z = z;
            }
            return this;
        }

        // Distance between two vectors
        static distance(a, b) {
            return Scalar.hypot3(a.x - b.x, a.y - b.y, a.z - b.z);
        }

        // For distance calculations between points
        distanceTo(other) {
            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const dz = this.z - other.z;
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }

        // More efficient squared distance, avoids costly sqrt when possible
        distanceSquared(other) {
            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const dz = this.z - other.z;
            return dx * dx + dy * dy + dz * dz;
        }

        // For horizontal distance (ignoring Y) - useful for camera calculations
        horizontalDistanceTo(other) {
            const dx = this.x - other.x;
            const dz = this.z - other.z;
            return Math.sqrt(dx * dx + dz * dz);
        }

        // More efficient squared horizontal distance
        horizontalDistanceSquared(other) {
            const dx = this.x - other.x;
            const dz = this.z - other.z;
            return dx * dx + dz * dz;
        }

        // For applying movement/translation
        translate(direction, amount) {
            return new Vector3(this.x + direction.x * amount, this.y + direction.y * amount, this.z + direction.z * amount);
        }

        // In-place version to avoid creating a new Vector3
        translateInPlace(direction, amount) {
            this.x += direction.x * amount;
            this.y += direction.y * amount;
            this.z += direction.z * amount;
            return this;
        }

        // For rotation around Y axis (useful for camera orbiting)
        rotateY(angle) {
            const cos = Scalar.cos(angle);
            const sin = Scalar.sin(angle);
            return new Vector3(this.x * cos + this.z * sin, this.y, -this.x * sin + this.z * cos);
        }

        // In-place version to avoid creating a new Vector3
        rotateYInPlace(angle) {
            const cos = Scalar.cos(angle);
            const sin = Scalar.sin(angle);
            const x = this.x;
            const z = this.z;
            this.x = x * cos + z * sin;
            this.z = -x * sin + z * cos;
            return this;
        }

        // Gets a normalized vector representing just the horizontal component
        horizontalNormalize() {
            return new Vector3(this.x, 0, this.z).normalize();
        }

        static transformMat4(vec, mat) {
            // Make sure we can access the matrix data whether it's Array or Float32Array
            const getElement = (idx) => (mat[idx] !== undefined ? mat[idx] : mat.at(idx));

            const x = vec.x;
            const y = vec.y;
            const z = vec.z;
            let w = getElement(3) * x + getElement(7) * y + getElement(11) * z + getElement(15);
            if (w === 0) w = 1;

            return new Vector3(
                (getElement(0) * x + getElement(4) * y + getElement(8) * z + getElement(12)) / w,
                (getElement(1) * x + getElement(5) * y + getElement(9) * z + getElement(13)) / w,
                (getElement(2) * x + getElement(6) * y + getElement(10) * z + getElement(14)) / w
            );
        }
        static fromValues(x, y, z) {
            return new Vector3(x, y, z);
        }

        static min(out, a, b) {
            out.x = Math.min(a.x, b.x);
            out.y = Math.min(a.y, b.y);
            out.z = Math.min(a.z, b.z);
            return out;
        }

        static max(out, a, b) {
            out.x = Math.max(a.x, b.x);
            out.y = Math.max(a.y, b.y);
            out.z = Math.max(a.z, b.z);
            return out;
        }
        static create(x = 0, y = 0, z = 0) {
            return new Vector3(x, y, z);
        }

        // Add optimized add operation that creates less garbage
        add(other) {
            return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
        }

        // In-place addition
        addInPlace(other) {
            this.x += other.x;
            this.y += other.y;
            this.z += other.z;
            return this;
        }

        // Add optimized subtract operation
        sub(other) {
            return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
        }
        // Subtract vector b from vector a
        static subtract(a, b) {
            return new Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
        }
        // In-place subtraction
        subInPlace(other) {
            this.x -= other.x;
            this.y -= other.y;
            this.z -= other.z;
            return this;
        }

        // Vector normalization
        normalize() {
            const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
            if (len === 0) {
                return new Vector3(0, 0, 0);
            }
            return new Vector3(this.x / len, this.y / len, this.z / len);
        }

        // In-place normalization
        normalizeInPlace() {
            const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
            if (len !== 0) {
                this.x /= len;
                this.y /= len;
                this.z /= len;
            }
            return this;
        }

        // Add dot product operation
        dot(other) {
            return this.x * other.x + this.y * other.y + this.z * other.z;
        }

        // Add cross product operation
        cross(other) {
            return new Vector3(
                this.y * other.z - this.z * other.y,
                this.z * other.x - this.x * other.z,
                this.x * other.y - this.y * other.x
            );
        }

        // Static cross product that writes to an output vector (no allocation)
        // Both operands are read into locals BEFORE any write, so this is safe when `out` is also `a` or
        // `b`. Writing directly would corrupt components still needed by the next line.
        static crossInto(out, a, b) {
            const ax = a.x, ay = a.y, az = a.z;
            const bx = b.x, by = b.y, bz = b.z;
            out.x = ay * bz - az * by;
            out.y = az * bx - ax * bz;
            out.z = ax * by - ay * bx;
            return out;
        }

        // Array conversion
        toArray() {
            return [this.x, this.y, this.z];
        }

        // Length calculation
        length() {
            return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        }

        // Squared length (faster, avoids sqrt)
        lengthSquared() {
            return this.x * this.x + this.y * this.y + this.z * this.z;
        }

        mult(n) {
            return new Vector3(this.x * n, this.y * n, this.z * n);
        }

        scale(scalar) {
            return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar);
        }

        // Scale a vector by a scalar
        static scale(v, scalar) {
            return new Vector3(v.x * scalar, v.y * scalar, v.z * scalar);
        }

        divideScalar(scalar) {
            if (scalar === 0) {
                console.warn("Vector3: Division by zero!");
                return new Vector3(0, 0, 0);
            }

            return new Vector3(this.x / scalar, this.y / scalar, this.z / scalar);
        }

        subtract(other) {
            return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
        }

        equals(other) {
            const epsilon = 0.000001; // Small threshold for floating point comparison
            return (
                Math.abs(this.x - other.x) < epsilon &&
                Math.abs(this.y - other.y) < epsilon &&
                Math.abs(this.z - other.z) < epsilon
            );
        }

        clone() {
            return new Vector3(this.x, this.y, this.z);
        }

        /**
         * Copy the values from another Vector3 into this one
         * @param {Vector3} v - Vector to copy from
         * @returns {Vector3} this vector
         */
        copy(v) {
            this.x = v.x;
            this.y = v.y;
            this.z = v.z;
            return this;
        }

        lerp(target, t) {
            return new Vector3(
                this.x + (target.x - this.x) * t,
                this.y + (target.y - this.y) * t,
                this.z + (target.z - this.z) * t
            );
        }

        // ---- in-place / allocation-free forms ----
        // The physics solver runs these thousands of times per tick and cannot allocate per operation.
        // The allocating forms above are unchanged. `Into` follows the existing crossInto: write into `out`.

        // out = a + b
        static addInto(out, a, b) {
            out.x = a.x + b.x; out.y = a.y + b.y; out.z = a.z + b.z;
            return out;
        }

        // out = a - b
        static subInto(out, a, b) {
            out.x = a.x - b.x; out.y = a.y - b.y; out.z = a.z - b.z;
            return out;
        }

        // out = v * s
        static scaleInto(out, v, s) {
            out.x = v.x * s; out.y = v.y * s; out.z = v.z * s;
            return out;
        }

        // out = normalized v. A zero vector stays zero rather than becoming NaN.
        static normalizeInto(out, v) {
            const lsq = v.x * v.x + v.y * v.y + v.z * v.z;
            if (lsq === 0) { out.x = 0; out.y = 0; out.z = 0; return out; }
            const inv = 1 / Math.sqrt(lsq);
            out.x = v.x * inv; out.y = v.y * inv; out.z = v.z * inv;
            return out;
        }

        // this += v * s
        addScaledInPlace(v, s) {
            this.x += v.x * s; this.y += v.y * s; this.z += v.z * s;
            return this;
        }

        scaleInPlace(s) {
            this.x *= s; this.y *= s; this.z *= s;
            return this;
        }

        // Component-wise product, in place.
        multiplyInPlace(v) {
            this.x *= v.x; this.y *= v.y; this.z *= v.z;
            return this;
        }

        negateInPlace() {
            this.x = -this.x; this.y = -this.y; this.z = -this.z;
            return this;
        }

        // this = this x v. Caches BOTH operands - v may be this, and v x v must give zero.
        crossInPlace(v) {
            const x = this.x, y = this.y, z = this.z;
            const vx = v.x, vy = v.y, vz = v.z;
            this.x = y * vz - z * vy;
            this.y = z * vx - x * vz;
            this.z = x * vy - y * vx;
            return this;
        }

        // A unit vector perpendicular to v. Crosses with the cardinal axis v is LEAST aligned to - a
        // nearly-parallel axis gives a near-zero vector that normalizes into noise.
        findOrthogonal(v) {
            const ax = Math.abs(v.x), ay = Math.abs(v.y), az = Math.abs(v.z);
            if (ax <= ay && ax <= az) { this.x = 0; this.y = -v.z; this.z = v.y; }
            else if (ay <= az) { this.x = -v.z; this.y = 0; this.z = v.x; }
            else { this.x = -v.y; this.y = v.x; this.z = 0; }
            return this.normalizeInPlace();
        }

        minInPlace(v) {
            if (v.x < this.x) this.x = v.x;
            if (v.y < this.y) this.y = v.y;
            if (v.z < this.z) this.z = v.z;
            return this;
        }

        maxInPlace(v) {
            if (v.x > this.x) this.x = v.x;
            if (v.y > this.y) this.y = v.y;
            if (v.z > this.z) this.z = v.z;
            return this;
        }

        isFinite() {
            return Number.isFinite(this.x) && Number.isFinite(this.y) && Number.isFinite(this.z);
        }

        isZero() {
            return this.x === 0 && this.y === 0 && this.z === 0;
        }

        // Exact equality - equals() above uses an epsilon, which is wrong for identity checks.
        equalsExact(v) {
            return this.x === v.x && this.y === v.y && this.z === v.z;
        }

        toString() {
            return '(' + this.x + ', ' + this.y + ', ' + this.z + ')';
        }
    }

    ActionPhysics.Vector3 = Vector3;

}
ActionPhysics.Vector3 = Vector3;


// ==== src/math/Matrix3.js ====
var Matrix3;
if (host.Matrix3) {
    Matrix3 = host.Matrix3;
} else {
    // Part of ActionMath - the shared math library. This file is pasted here VERBATIM from its source of
    // truth and must not be edited locally. Anything this engine needs is added to ActionMath first, then
    // arrives here through the same paste.
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
    Matrix3 = class Matrix3 {

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
         * Rotation matrix equivalent to a unit quaternion. Assumes q is normalized; a non-unit
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

    ActionPhysics.Matrix3 = Matrix3;

}
ActionPhysics.Matrix3 = Matrix3;


// ==== src/math/Matrix4.js ====
var Matrix4;
if (host.Matrix4) {
    Matrix4 = host.Matrix4;
} else {
    // Part of ActionMath - the shared math library. This file is pasted here VERBATIM from its source of
    // truth and must not be edited locally. Anything this engine needs is added to ActionMath first, then
    // arrives here through the same paste.
    Matrix4 = class Matrix4 {
        // Float32Array: what a GPU wants, and what rendering should use.
        static create() {
            return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        }

        // Float64Array, for callers that cannot afford 32-bit rounding.
        //
        // float32 carries ~7 significant digits, so a position in the tens resolves to about 1e-5 - coarser
        // than the quantities a physics solver works in (contact depths around 1e-3, and corrections an
        // order of magnitude below that). It also defeats reproducibility, since the rounding compounds
        // through every transform.
        //
        // Every static below is written as plain indexed reads and writes, so all of them operate on either
        // array type without change.
        static createPrecise() {
            return new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        }

        static identity(out) {
            out[0] = 1;
            out[1] = 0;
            out[2] = 0;
            out[3] = 0;
            out[4] = 0;
            out[5] = 1;
            out[6] = 0;
            out[7] = 0;
            out[8] = 0;
            out[9] = 0;
            out[10] = 1;
            out[11] = 0;
            out[12] = 0;
            out[13] = 0;
            out[14] = 0;
            out[15] = 1;
            return out;
        }
        /**
         * Multiply a vector by a matrix
         * @param {Array} out - Output vector (will be modified)
         * @param {Array|Float32Array} matrix - 4x4 matrix
         * @param {Array} vec - Input vector [x, y, z, w]
         * @returns {Array} - The output vector
         */
        static multiplyVector(out, matrix, vec) {
            const x = vec[0];
            const y = vec[1];
            const z = vec[2];
            const w = vec[3] || 1.0;

            out[0] = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w;
            out[1] = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w;
            out[2] = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w;
            out[3] = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15] * w;

            return out;
        }

        static transformVector(vector, viewMatrix, projectionMatrix) {
            // First multiply by view matrix
            const viewResult = [0, 0, 0, 0];
            for (let i = 0; i < 4; i++) {
                viewResult[i] =
                    vector[0] * viewMatrix[i] +
                    vector[1] * viewMatrix[i + 4] +
                    vector[2] * viewMatrix[i + 8] +
                    vector[3] * viewMatrix[i + 12];
            }

            // Then multiply by projection matrix
            const result = [0, 0, 0, 0];
            for (let i = 0; i < 4; i++) {
                result[i] =
                    viewResult[0] * projectionMatrix[i] +
                    viewResult[1] * projectionMatrix[i + 4] +
                    viewResult[2] * projectionMatrix[i + 8] +
                    viewResult[3] * projectionMatrix[i + 12];
            }

            return result;
        }

        // In-place version that writes to output array (no allocation)
        static transformVectorInto(vector, viewMatrix, projectionMatrix, out) {
            // First multiply by view matrix
            const viewResultX =
                vector[0] * viewMatrix[0] +
                vector[1] * viewMatrix[4] +
                vector[2] * viewMatrix[8] +
                vector[3] * viewMatrix[12];
            const viewResultY =
                vector[0] * viewMatrix[1] +
                vector[1] * viewMatrix[5] +
                vector[2] * viewMatrix[9] +
                vector[3] * viewMatrix[13];
            const viewResultZ =
                vector[0] * viewMatrix[2] +
                vector[1] * viewMatrix[6] +
                vector[2] * viewMatrix[10] +
                vector[3] * viewMatrix[14];
            const viewResultW =
                vector[0] * viewMatrix[3] +
                vector[1] * viewMatrix[7] +
                vector[2] * viewMatrix[11] +
                vector[3] * viewMatrix[15];

            // Then multiply by projection matrix
            out[0] =
                viewResultX * projectionMatrix[0] +
                viewResultY * projectionMatrix[4] +
                viewResultZ * projectionMatrix[8] +
                viewResultW * projectionMatrix[12];
            out[1] =
                viewResultX * projectionMatrix[1] +
                viewResultY * projectionMatrix[5] +
                viewResultZ * projectionMatrix[9] +
                viewResultW * projectionMatrix[13];
            out[2] =
                viewResultX * projectionMatrix[2] +
                viewResultY * projectionMatrix[6] +
                viewResultZ * projectionMatrix[10] +
                viewResultW * projectionMatrix[14];
            out[3] =
                viewResultX * projectionMatrix[3] +
                viewResultY * projectionMatrix[7] +
                viewResultZ * projectionMatrix[11] +
                viewResultW * projectionMatrix[15];
        }
        static fromQuat(out, q) {
            const x = q.x,
                y = q.y,
                z = q.z,
                w = q.w;
            const x2 = x + x,
                y2 = y + y,
                z2 = z + z;
            const xx = x * x2,
                xy = x * y2,
                xz = x * z2;
            const yy = y * y2,
                yz = y * z2,
                zz = z * z2;
            const wx = w * x2,
                wy = w * y2,
                wz = w * z2;

            out[0] = 1 - (yy + zz);
            out[1] = xy + wz;
            out[2] = xz - wy;
            out[3] = 0;

            out[4] = xy - wz;
            out[5] = 1 - (xx + zz);
            out[6] = yz + wx;
            out[7] = 0;

            out[8] = xz + wy;
            out[9] = yz - wx;
            out[10] = 1 - (xx + yy);
            out[11] = 0;

            out[12] = 0;
            out[13] = 0;
            out[14] = 0;
            out[15] = 1;

            return out;
        }

        static fromLightDirection(out, dir) {
            // Make sure the direction is normalized
            const nx = dir.x;
            const ny = dir.y;
            const nz = dir.z;

            // Find a perpendicular vector for the "right" direction
            // Using world-up (0,1,0) as a reference
            const right = [
                nz, // Cross product of dir with (0,1,0)
                0,
                -nx
            ];

            // Normalize right vector
            const rLength = Math.sqrt(right[0] * right[0] + right[2] * right[2]);
            right[0] /= rLength;
            right[2] /= rLength;

            // Get up vector by crossing right with direction
            const up = [
                -nx * ny, // Cross product of right with dir
                nx * nx + nz * nz,
                -ny * nz
            ];

            // Build the view matrix
            out[0] = right[0];
            out[1] = up[0];
            out[2] = nx;
            out[3] = 0;

            out[4] = right[1];
            out[5] = up[1];
            out[6] = ny;
            out[7] = 0;

            out[8] = right[2];
            out[9] = up[2];
            out[10] = nz;
            out[11] = 0;

            out[12] = 0;
            out[13] = 0;
            out[14] = 0;
            out[15] = 1;

            return out;
        }
        static copy(out, a) {
            out[0] = a[0];
            out[1] = a[1];
            out[2] = a[2];
            out[3] = a[3];
            out[4] = a[4];
            out[5] = a[5];
            out[6] = a[6];
            out[7] = a[7];
            out[8] = a[8];
            out[9] = a[9];
            out[10] = a[10];
            out[11] = a[11];
            out[12] = a[12];
            out[13] = a[13];
            out[14] = a[14];
            out[15] = a[15];
            return out;
        }

        static multiply(out, a, b) {
            const a00 = a[0],
                a01 = a[1],
                a02 = a[2],
                a03 = a[3];
            const a10 = a[4],
                a11 = a[5],
                a12 = a[6],
                a13 = a[7];
            const a20 = a[8],
                a21 = a[9],
                a22 = a[10],
                a23 = a[11];
            const a30 = a[12],
                a31 = a[13],
                a32 = a[14],
                a33 = a[15];

            let b0 = b[0],
                b1 = b[1],
                b2 = b[2],
                b3 = b[3];
            out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
            out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
            out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
            out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

            b0 = b[4];
            b1 = b[5];
            b2 = b[6];
            b3 = b[7];
            out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
            out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
            out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
            out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

            b0 = b[8];
            b1 = b[9];
            b2 = b[10];
            b3 = b[11];
            out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
            out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
            out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
            out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

            b0 = b[12];
            b1 = b[13];
            b2 = b[14];
            b3 = b[15];
            out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
            out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
            out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
            out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
            return out;
        }
        static fromRotationTranslation(out, q, v) {
            // Similar to his code but using our Quaternion class
            const x = q.x,
                y = q.y,
                z = q.z,
                w = q.w;
            const x2 = x + x;
            const y2 = y + y;
            const z2 = z + z;

            const xx = x * x2;
            const xy = x * y2;
            const xz = x * z2;
            const yy = y * y2;
            const yz = y * z2;
            const zz = z * z2;
            const wx = w * x2;
            const wy = w * y2;
            const wz = w * z2;

            out[0] = 1 - (yy + zz);
            out[1] = xy + wz;
            out[2] = xz - wy;
            out[3] = 0;
            out[4] = xy - wz;
            out[5] = 1 - (xx + zz);
            out[6] = yz + wx;
            out[7] = 0;
            out[8] = xz + wy;
            out[9] = yz - wx;
            out[10] = 1 - (xx + yy);
            out[11] = 0;
            out[12] = v.x;
            out[13] = v.y;
            out[14] = v.z;
            out[15] = 1;
            return out;
        }

        static transformVertex(vertex, modelMatrix) {
            const v = [vertex.x, vertex.y, vertex.z, 1];
            const result = [0, 0, 0, 0];

            for (let i = 0; i < 4; i++) {
                result[i] =
                    v[0] * modelMatrix[i] +
                    v[1] * modelMatrix[i + 4] +
                    v[2] * modelMatrix[i + 8] +
                    v[3] * modelMatrix[i + 12];
            }

            return new Vector3(result[0] / result[3], result[1] / result[3], result[2] / result[3]);
        }

        static transformNormal(normal, modelMatrix) {
            // Calculate inverse transpose of 3x3 portion of model matrix
            const a = modelMatrix[0],
                b = modelMatrix[1],
                c = modelMatrix[2],
                d = modelMatrix[4],
                e = modelMatrix[5],
                f = modelMatrix[6],
                g = modelMatrix[8],
                h = modelMatrix[9],
                i = modelMatrix[10];

            const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
            const invdet = 1.0 / det;

            const invTranspose = [
                (e * i - f * h) * invdet,
                (c * h - b * i) * invdet,
                (b * f - c * e) * invdet,
                (f * g - d * i) * invdet,
                (a * i - c * g) * invdet,
                (c * d - a * f) * invdet,
                (d * h - e * g) * invdet,
                (b * g - a * h) * invdet,
                (a * e - b * d) * invdet
            ];

            const x = normal.x * invTranspose[0] + normal.y * invTranspose[1] + normal.z * invTranspose[2];
            const y = normal.x * invTranspose[3] + normal.y * invTranspose[4] + normal.z * invTranspose[5];
            const z = normal.x * invTranspose[6] + normal.y * invTranspose[7] + normal.z * invTranspose[8];

            return new Vector3(x, y, z).normalize();
        }
        static perspective(out, fovy, aspect, near, far) {
            const f = 1.0 / Scalar.tan(fovy / 2);
            out[0] = f / aspect;
            out[1] = 0;
            out[2] = 0;
            out[3] = 0;
            out[4] = 0;
            out[5] = f;
            out[6] = 0;
            out[7] = 0;
            out[8] = 0;
            out[9] = 0;
            out[10] = (far + near) / (near - far);
            out[11] = -1;
            out[12] = 0;
            out[13] = 0;
            out[14] = (2 * far * near) / (near - far);
            out[15] = 0;
            return out;
        }

        static ortho(out, left, right, bottom, top, near, far) {
            const lr = 1 / (left - right);
            const bt = 1 / (bottom - top);
            const nf = 1 / (near - far);
            out[0] = -2 * lr;
            out[1] = 0;
            out[2] = 0;
            out[3] = 0;
            out[4] = 0;
            out[5] = -2 * bt;
            out[6] = 0;
            out[7] = 0;
            out[8] = 0;
            out[9] = 0;
            out[10] = 2 * nf;
            out[11] = 0;
            out[12] = (left + right) * lr;
            out[13] = (top + bottom) * bt;
            out[14] = (far + near) * nf;
            out[15] = 1;
            return out;
        }

        static translate(out, a, v) {
            const x = v[0],
                y = v[1],
                z = v[2];

            if (a !== out) {
                out[0] = a[0];
                out[1] = a[1];
                out[2] = a[2];
                out[3] = a[3];
                out[4] = a[4];
                out[5] = a[5];
                out[6] = a[6];
                out[7] = a[7];
                out[8] = a[8];
                out[9] = a[9];
                out[10] = a[10];
                out[11] = a[11];
            }

            out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
            out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
            out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
            out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];

            return out;
        }

        static rotate(out, a, rad, axis) {
            let x = axis[0],
                y = axis[1],
                z = axis[2];

            let len = Scalar.hypot3(x, y, z);
            if (len < 0.000001) {
                return null;
            }
            len = 1 / len;
            x *= len;
            y *= len;
            z *= len;

            const s = Scalar.sin(rad);
            const c = Scalar.cos(rad);
            const t = 1 - c;

            const a00 = a[0],
                a01 = a[1],
                a02 = a[2],
                a03 = a[3];
            const a10 = a[4],
                a11 = a[5],
                a12 = a[6],
                a13 = a[7];
            const a20 = a[8],
                a21 = a[9],
                a22 = a[10],
                a23 = a[11];

            const b00 = x * x * t + c;
            const b01 = y * x * t + z * s;
            const b02 = z * x * t - y * s;
            const b10 = x * y * t - z * s;
            const b11 = y * y * t + c;
            const b12 = z * y * t + x * s;
            const b20 = x * z * t + y * s;
            const b21 = y * z * t - x * s;
            const b22 = z * z * t + c;

            out[0] = a00 * b00 + a10 * b01 + a20 * b02;
            out[1] = a01 * b00 + a11 * b01 + a21 * b02;
            out[2] = a02 * b00 + a12 * b01 + a22 * b02;
            out[3] = a03 * b00 + a13 * b01 + a23 * b02;
            out[4] = a00 * b10 + a10 * b11 + a20 * b12;
            out[5] = a01 * b10 + a11 * b11 + a21 * b12;
            out[6] = a02 * b10 + a12 * b11 + a22 * b12;
            out[7] = a03 * b10 + a13 * b11 + a23 * b12;
            out[8] = a00 * b20 + a10 * b21 + a20 * b22;
            out[9] = a01 * b20 + a11 * b21 + a21 * b22;
            out[10] = a02 * b20 + a12 * b21 + a22 * b22;
            out[11] = a03 * b20 + a13 * b21 + a23 * b22;

            if (a !== out) {
                out[12] = a[12];
                out[13] = a[13];
                out[14] = a[14];
                out[15] = a[15];
            }
            return out;
        }

        static scale(out, a, v) {
            const x = v[0],
                y = v[1],
                z = v[2];
            out[0] = a[0] * x;
            out[1] = a[1] * x;
            out[2] = a[2] * x;
            out[3] = a[3] * x;
            out[4] = a[4] * y;
            out[5] = a[5] * y;
            out[6] = a[6] * y;
            out[7] = a[7] * y;
            out[8] = a[8] * z;
            out[9] = a[9] * z;
            out[10] = a[10] * z;
            out[11] = a[11] * z;
            out[12] = a[12];
            out[13] = a[13];
            out[14] = a[14];
            out[15] = a[15];
            return out;
        }

        static invert(out, a) {
            const a00 = a[0],
                a01 = a[1],
                a02 = a[2],
                a03 = a[3];
            const a10 = a[4],
                a11 = a[5],
                a12 = a[6],
                a13 = a[7];
            const a20 = a[8],
                a21 = a[9],
                a22 = a[10],
                a23 = a[11];
            const a30 = a[12],
                a31 = a[13],
                a32 = a[14],
                a33 = a[15];

            const b00 = a00 * a11 - a01 * a10;
            const b01 = a00 * a12 - a02 * a10;
            const b02 = a00 * a13 - a03 * a10;
            const b03 = a01 * a12 - a02 * a11;
            const b04 = a01 * a13 - a03 * a11;
            const b05 = a02 * a13 - a03 * a12;
            const b06 = a20 * a31 - a21 * a30;
            const b07 = a20 * a32 - a22 * a30;
            const b08 = a20 * a33 - a23 * a30;
            const b09 = a21 * a32 - a22 * a31;
            const b10 = a21 * a33 - a23 * a31;
            const b11 = a22 * a33 - a23 * a32;

            let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
            if (!det) {
                return null;
            }
            det = 1.0 / det;

            out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
            out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
            out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
            out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
            out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
            out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
            out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
            out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
            out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
            out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
            out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
            out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
            out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
            out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
            out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
            out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

            return out;
        }

        static lookAt(out, eye, center, up) {
            let x0, x1, x2, y0, y1, y2, z0, z1, z2, len;
            const eyex = eye[0];
            const eyey = eye[1];
            const eyez = eye[2];
            const upx = up[0];
            const upy = up[1];
            const upz = up[2];
            const centerx = center[0];
            const centery = center[1];
            const centerz = center[2];

            if (
                Math.abs(eyex - centerx) < 0.000001 &&
                Math.abs(eyey - centery) < 0.000001 &&
                Math.abs(eyez - centerz) < 0.000001
            ) {
                return Matrix4.identity(out);
            }

            z0 = eyex - centerx;
            z1 = eyey - centery;
            z2 = eyez - centerz;

            len = 1 / Scalar.hypot3(z0, z1, z2);
            z0 *= len;
            z1 *= len;
            z2 *= len;

            // Cross product of up and z
            x0 = upy * z2 - upz * z1;
            x1 = upz * z0 - upx * z2;
            x2 = upx * z1 - upy * z0;
            len = Scalar.hypot3(x0, x1, x2);

            // Handle the case where up and z are colinear (or nearly so)
            if (len < 0.000001) {
                // Find a perpendicular vector to z
                // Try cross product with (1,0,0) first
                if (Math.abs(z0) < 0.9) {
                    // Cross with X axis
                    x0 = 0;
                    x1 = z2;
                    x2 = -z1;
                } else {
                    // Cross with Z axis if Z is near X
                    x0 = z1;
                    x1 = -z0;
                    x2 = 0;
                }
                len = Scalar.hypot3(x0, x1, x2);
                len = 1 / len;
                x0 *= len;
                x1 *= len;
                x2 *= len;
            } else {
                // Normal case - normalize the computed cross product
                len = 1 / len;
                x0 *= len;
                x1 *= len;
                x2 *= len;
            }

            y0 = z1 * x2 - z2 * x1;
            y1 = z2 * x0 - z0 * x2;
            y2 = z0 * x1 - z1 * x0;

            len = Scalar.hypot3(y0, y1, y2);
            if (!len) {
                y0 = 0;
                y1 = 0;
                y2 = 0;
            } else {
                len = 1 / len;
                y0 *= len;
                y1 *= len;
                y2 *= len;
            }

            out[0] = x0;
            out[1] = y0;
            out[2] = z0;
            out[3] = 0;
            out[4] = x1;
            out[5] = y1;
            out[6] = z1;
            out[7] = 0;
            out[8] = x2;
            out[9] = y2;
            out[10] = z2;
            out[11] = 0;
            out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
            out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
            out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
            out[15] = 1;

            return out;
        }

        static transpose(out, a) {
            if (out === a) {
                const a01 = a[1],
                    a02 = a[2],
                    a03 = a[3],
                    a12 = a[6],
                    a13 = a[7],
                    a23 = a[11];

                out[1] = a[4];
                out[2] = a[8];
                out[3] = a[12];
                out[4] = a01;
                out[6] = a[9];
                out[7] = a[13];
                out[8] = a02;
                out[9] = a12;
                out[11] = a[14];
                out[12] = a03;
                out[13] = a13;
                out[14] = a23;
            } else {
                out[0] = a[0];
                out[1] = a[4];
                out[2] = a[8];
                out[3] = a[12];
                out[4] = a[1];
                out[5] = a[5];
                out[6] = a[9];
                out[7] = a[13];
                out[8] = a[2];
                out[9] = a[6];
                out[10] = a[10];
                out[11] = a[14];
                out[12] = a[3];
                out[13] = a[7];
                out[14] = a[11];
                out[15] = a[15];
            }

            return out;
        }

        static rotateX(out, a, rad) {
            const s = Scalar.sin(rad);
            const c = Scalar.cos(rad);
            const a10 = a[4];
            const a11 = a[5];
            const a12 = a[6];
            const a13 = a[7];
            const a20 = a[8];
            const a21 = a[9];
            const a22 = a[10];
            const a23 = a[11];

            out[4] = a10 * c + a20 * s;
            out[5] = a11 * c + a21 * s;
            out[6] = a12 * c + a22 * s;
            out[7] = a13 * c + a23 * s;
            out[8] = a20 * c - a10 * s;
            out[9] = a21 * c - a11 * s;
            out[10] = a22 * c - a12 * s;
            out[11] = a23 * c - a13 * s;

            // If the source and destination differ, we need to copy the unchanged rows
            if (a !== out) {
                out[0] = a[0];
                out[1] = a[1];
                out[2] = a[2];
                out[3] = a[3];
                out[12] = a[12];
                out[13] = a[13];
                out[14] = a[14];
                out[15] = a[15];
            }

            return out;
        }
        static rotateZ(out, a, rad) {
            const s = Scalar.sin(rad);
            const c = Scalar.cos(rad);
            const a00 = a[0];
            const a01 = a[1];
            const a02 = a[2];
            const a03 = a[3];
            const a10 = a[4];
            const a11 = a[5];
            const a12 = a[6];
            const a13 = a[7];

            out[0] = a00 * c + a10 * s;
            out[1] = a01 * c + a11 * s;
            out[2] = a02 * c + a12 * s;
            out[3] = a03 * c + a13 * s;
            out[4] = a10 * c - a00 * s;
            out[5] = a11 * c - a01 * s;
            out[6] = a12 * c - a02 * s;
            out[7] = a13 * c - a03 * s;

            // If the source and destination differ, we need to copy the unchanged rows
            if (a !== out) {
                out[8] = a[8];
                out[9] = a[9];
                out[10] = a[10];
                out[11] = a[11];
                out[12] = a[12];
                out[13] = a[13];
                out[14] = a[14];
                out[15] = a[15];
            }

            return out;
        }

        static rotateY(out, a, rad) {
            const s = Scalar.sin(rad);
            const c = Scalar.cos(rad);
            const a00 = a[0];
            const a01 = a[1];
            const a02 = a[2];
            const a03 = a[3];
            const a20 = a[8];
            const a21 = a[9];
            const a22 = a[10];
            const a23 = a[11];

            out[0] = a00 * c - a20 * s;
            out[1] = a01 * c - a21 * s;
            out[2] = a02 * c - a22 * s;
            out[3] = a03 * c - a23 * s;
            out[8] = a00 * s + a20 * c;
            out[9] = a01 * s + a21 * c;
            out[10] = a02 * s + a22 * c;
            out[11] = a03 * s + a23 * c;

            // If the source and destination differ, we need to copy the unchanged rows
            if (a !== out) {
                out[4] = a[4];
                out[5] = a[5];
                out[6] = a[6];
                out[7] = a[7];
                out[12] = a[12];
                out[13] = a[13];
                out[14] = a[14];
                out[15] = a[15];
            }

            return out;
        }
    }

    ActionPhysics.Matrix4 = Matrix4;

}
ActionPhysics.Matrix4 = Matrix4;


// ==== src/math/Quaternion.js ====
var Quaternion;
if (host.Quaternion) {
    Quaternion = host.Quaternion;
} else {
    // Part of ActionMath - the shared math library. This file is pasted here VERBATIM from its source of
    // truth and must not be edited locally. Anything this engine needs is added to ActionMath first, then
    // arrives here through the same paste.
    Quaternion = class Quaternion {
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

    ActionPhysics.Quaternion = Quaternion;

}
ActionPhysics.Quaternion = Quaternion;


// ==== src/math/Transform.js ====
var Transform;
if (host.Transform) {
    Transform = host.Transform;
} else {
    // Part of ActionMath - the shared math library. This file is pasted here VERBATIM from its source of
    // truth and must not be edited locally. Anything this engine needs is added to ActionMath first, then
    // arrives here through the same paste.

    /**
     * Transform - Encapsulates position, rotation, scale and model matrix calculation
     * Used by all 3D objects to track their world transform
     */
    Transform = class Transform {
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

    ActionPhysics.Transform = Transform;

}
ActionPhysics.Transform = Transform;


// ==== src/spatial/AABB.js ====
// Axis-aligned bounding box (min/max Vector3s). Every method is allocation-free.
class AABB {
    constructor() {
        this.min = new Vector3(Infinity, Infinity, Infinity);
        this.max = new Vector3(-Infinity, -Infinity, -Infinity);
    }

    setEmpty() {
        this.min.set(Infinity, Infinity, Infinity);
        this.max.set(-Infinity, -Infinity, -Infinity);
        return this;
    }

    setFromMinMax(minX, minY, minZ, maxX, maxY, maxZ) {
        this.min.set(minX, minY, minZ);
        this.max.set(maxX, maxY, maxZ);
        return this;
    }

    copy(other) {
        this.min.copy(other.min);
        this.max.copy(other.max);
        return this;
    }

    // this = the box around center +/- halfExtents, both Vector3.
    setFromCenterHalfExtents(center, halfExtents) {
        this.min.x = center.x - halfExtents.x;
        this.min.y = center.y - halfExtents.y;
        this.min.z = center.z - halfExtents.z;
        this.max.x = center.x + halfExtents.x;
        this.max.y = center.y + halfExtents.y;
        this.max.z = center.z + halfExtents.z;
        return this;
    }

    // Grow this box (in place) to also contain `other`.
    combineInPlace(other) {
        if (other.min.x < this.min.x) this.min.x = other.min.x;
        if (other.min.y < this.min.y) this.min.y = other.min.y;
        if (other.min.z < this.min.z) this.min.z = other.min.z;
        if (other.max.x > this.max.x) this.max.x = other.max.x;
        if (other.max.y > this.max.y) this.max.y = other.max.y;
        if (other.max.z > this.max.z) this.max.z = other.max.z;
        return this;
    }

    // this = union(a, b). Safe when this aliases a or b.
    static combineInto(out, a, b) {
        out.min.x = Math.min(a.min.x, b.min.x);
        out.min.y = Math.min(a.min.y, b.min.y);
        out.min.z = Math.min(a.min.z, b.min.z);
        out.max.x = Math.max(a.max.x, b.max.x);
        out.max.y = Math.max(a.max.y, b.max.y);
        out.max.z = Math.max(a.max.z, b.max.z);
        return out;
    }

    // Grow every face outward by `margin` (in place). Used for a speculative-contact skin, so a
    // fast-moving body's broadphase box still catches a pair before penetration.
    expandInPlace(margin) {
        this.min.x -= margin; this.min.y -= margin; this.min.z -= margin;
        this.max.x += margin; this.max.y += margin; this.max.z += margin;
        return this;
    }

    intersects(other) {
        return this.min.x <= other.max.x && this.max.x >= other.min.x &&
               this.min.y <= other.max.y && this.max.y >= other.min.y &&
               this.min.z <= other.max.z && this.max.z >= other.min.z;
    }

    containsPoint(p) {
        return p.x >= this.min.x && p.x <= this.max.x &&
               p.y >= this.min.y && p.y <= this.max.y &&
               p.z >= this.min.z && p.z <= this.max.z;
    }

    containsAABB(other) {
        return other.min.x >= this.min.x && other.max.x <= this.max.x &&
               other.min.y >= this.min.y && other.max.y <= this.max.y &&
               other.min.z >= this.min.z && other.max.z <= this.max.z;
    }

    // Half of the box's surface area (xy + yz + zx face pairs). A cheap, consistent BVH split
    // heuristic — never called per-tick, only when the static tree is (re)built.
    surfaceArea() {
        const dx = this.max.x - this.min.x;
        const dy = this.max.y - this.min.y;
        const dz = this.max.z - this.min.z;
        return dx * dy + dy * dz + dz * dx;
    }

    centerInto(out) {
        out.x = (this.min.x + this.max.x) * 0.5;
        out.y = (this.min.y + this.max.y) * 0.5;
        out.z = (this.min.z + this.max.z) * 0.5;
        return out;
    }

    isFinite() {
        return this.min.isFinite() && this.max.isFinite();
    }
}

ActionPhysics.AABB = AABB;


// ==== src/shapes/Shape.js ====
// Shape contract, all in local space: supportInto (the only GJK/EPA primitive), localAABBInto,
// computeMassData (density 1), volume (for density scaling). No allocation on supportInto/localAABBInto.
class Shape {
    constructor(type) {
        this.type = type;
    }

    supportInto(out, direction) {
        throw new Error('Shape.supportInto not implemented for ' + this.type);
    }

    localAABBInto(out) {
        throw new Error('Shape.localAABBInto not implemented for ' + this.type);
    }

    computeMassData() {
        throw new Error('Shape.computeMassData not implemented for ' + this.type);
    }

    volume() {
        throw new Error('Shape.volume not implemented for ' + this.type);
    }

    // The local-space inertia tensor for this shape at total mass `mass`. computeMassData() returns
    // density-1 values, so this rescales by mass/volume - the same scaling RigidBody.setMassFromShape
    // applies. Returns a fresh Matrix3. mass <= 0 (or zero volume) gives the zero tensor.
    getInertiaTensor(mass) {
        const out = new Matrix3();
        const vol = this.volume();
        if (!(mass > 0) || !(vol > 0)) { out.zero(); return out; }
        const s = mass / vol;
        const i = this.computeMassData().inertia;
        out.copy(i);
        out.e00 *= s; out.e01 *= s; out.e02 *= s;
        out.e10 *= s; out.e11 *= s; out.e12 *= s;
        out.e20 *= s; out.e21 *= s; out.e22 *= s;
        return out;
    }
}

ActionPhysics.Shape = Shape;


// ==== src/shapes/BoxShape.js ====
// Dimensions are half-extents.
class BoxShape extends Shape {
    constructor(halfWidth, halfHeight, halfDepth) {
        super('box');
        this.halfWidth = halfWidth;
        this.halfHeight = halfHeight;
        this.halfDepth = halfDepth;
    }

    supportInto(out, direction) {
        out.x = direction.x >= 0 ? this.halfWidth : -this.halfWidth;
        out.y = direction.y >= 0 ? this.halfHeight : -this.halfHeight;
        out.z = direction.z >= 0 ? this.halfDepth : -this.halfDepth;
        return out;
    }

    localAABBInto(out) {
        out.min.set(-this.halfWidth, -this.halfHeight, -this.halfDepth);
        out.max.set(this.halfWidth, this.halfHeight, this.halfDepth);
        return out;
    }

    volume() {
        return 8 * this.halfWidth * this.halfHeight * this.halfDepth;
    }

    computeMassData() {
        const w = 2 * this.halfWidth, h = 2 * this.halfHeight, d = 2 * this.halfDepth;
        const mass = this.volume();
        // Solid cuboid, density 1: I_xx = m(h^2+d^2)/12, cyclic.
        const inertia = new Matrix3().setDiagonal(new Vector3(
            mass * (h * h + d * d) / 12,
            mass * (w * w + d * d) / 12,
            mass * (w * w + h * h) / 12
        ));
        return { mass: mass, inertia: inertia, centerOfMass: new Vector3(0, 0, 0) };
    }
}

ActionPhysics.BoxShape = BoxShape;


// ==== src/shapes/SphereShape.js ====
class SphereShape extends Shape {
    constructor(radius) {
        super('sphere');
        this.radius = radius;
    }

    supportInto(out, direction) {
        // Direction need not be unit length; normalize here so the support point sits exactly
        // on the surface regardless of the caller's vector magnitude.
        const lsq = direction.x * direction.x + direction.y * direction.y + direction.z * direction.z;
        if (lsq === 0) { out.x = this.radius; out.y = 0; out.z = 0; return out; }
        const s = this.radius / Math.sqrt(lsq);
        out.x = direction.x * s; out.y = direction.y * s; out.z = direction.z * s;
        return out;
    }

    localAABBInto(out) {
        out.min.set(-this.radius, -this.radius, -this.radius);
        out.max.set(this.radius, this.radius, this.radius);
        return out;
    }

    volume() {
        return (4 / 3) * Scalar.PI * this.radius * this.radius * this.radius;
    }

    computeMassData() {
        const mass = this.volume();
        const i = 0.4 * mass * this.radius * this.radius; // solid sphere, density 1: I = 2/5 m r^2
        const inertia = new Matrix3().setDiagonal(new Vector3(i, i, i));
        return { mass: mass, inertia: inertia, centerOfMass: new Vector3(0, 0, 0) };
    }
}

ActionPhysics.SphereShape = SphereShape;


// ==== src/shapes/CylinderShape.js ====
// Axis is local Y. halfHeight is a half-extent, matching every other shape's convention
// (CapsuleShape's total-height constructor is the one deliberate exception).
class CylinderShape extends Shape {
    constructor(radius, halfHeight) {
        super('cylinder');
        this.radius = radius;
        this.halfHeight = halfHeight;
    }

    supportInto(out, direction) {
        const sigma = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
        if (sigma > 0) {
            const s = this.radius / sigma;
            out.x = direction.x * s;
            out.z = direction.z * s;
        } else {
            out.x = 0;
            out.z = 0;
        }
        out.y = direction.y >= 0 ? this.halfHeight : -this.halfHeight;
        return out;
    }

    localAABBInto(out) {
        out.min.set(-this.radius, -this.halfHeight, -this.radius);
        out.max.set(this.radius, this.halfHeight, this.radius);
        return out;
    }

    volume() {
        return Scalar.PI * this.radius * this.radius * (2 * this.halfHeight);
    }

    computeMassData() {
        const r = this.radius, h = 2 * this.halfHeight;
        const mass = this.volume();
        const iAxis = 0.5 * mass * r * r;                                   // about Y
        const iSide = mass * (3 * r * r + h * h) / 12;                       // about X and Z
        const inertia = new Matrix3().setDiagonal(new Vector3(iSide, iAxis, iSide));
        return { mass: mass, inertia: inertia, centerOfMass: new Vector3(0, 0, 0) };
    }
}

ActionPhysics.CylinderShape = CylinderShape;


// ==== src/shapes/ConeShape.js ====
// Axis is local Y, apex at +halfHeight, base circle at -halfHeight. halfHeight is a half-extent.
class ConeShape extends Shape {
    constructor(radius, halfHeight) {
        super('cone');
        this.radius = radius;
        this.halfHeight = halfHeight;
    }

    // Exact support of a cone is either the apex or a base-rim point, chosen by whichever the
    // direction favors — no iteration needed, unlike a general convex hull.
    supportInto(out, direction) {
        const h = this.halfHeight;
        const sigma = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
        // Base-rim candidate's projection onto `direction`, compared against the apex's.
        const rimProjection = sigma * this.radius - direction.y * h;
        const apexProjection = direction.y * h;
        if (apexProjection >= rimProjection) {
            out.x = 0; out.y = h; out.z = 0;
            return out;
        }
        if (sigma > 0) {
            const s = this.radius / sigma;
            out.x = direction.x * s;
            out.z = direction.z * s;
        } else {
            out.x = 0; out.z = 0;
        }
        out.y = -h;
        return out;
    }

    localAABBInto(out) {
        out.min.set(-this.radius, -this.halfHeight, -this.radius);
        out.max.set(this.radius, this.halfHeight, this.radius);
        return out;
    }

    volume() {
        return Scalar.PI * this.radius * this.radius * (2 * this.halfHeight) / 3;
    }

    // Solid cone, density 1, apex up. Standard formulas are about the base; centerOfMass shifts
    // the origin from local (0,0,0) — the geometric mid-height used for the AABB and support
    // function — to that centroid, at h/4 above the base (i.e. -halfHeight + h/4).
    computeMassData() {
        const r = this.radius, h = 2 * this.halfHeight;
        const mass = this.volume();
        const iAxis = 0.3 * mass * r * r;                                    // about Y, apex frame
        const iSideApex = mass * (3 * r * r + 2 * h * h) / 20;               // about X/Z through apex
        // Parallel-axis shift from the apex-based formula to the centroid (h/4 below apex along axis).
        const centroidOffset = h / 4;
        const iSideCentroid = iSideApex - mass * centroidOffset * centroidOffset;
        const inertia = new Matrix3().setDiagonal(new Vector3(iSideCentroid, iAxis, iSideCentroid));
        return {
            mass: mass,
            inertia: inertia,
            centerOfMass: new Vector3(0, -this.halfHeight + centroidOffset, 0)
        };
    }
}

ActionPhysics.ConeShape = ConeShape;


// ==== src/shapes/CapsuleShape.js ====
// Axis is local Y. Constructor takes TOTAL height (includes hemispherical caps), unlike every
// other shape's half-extent convention.
class CapsuleShape extends Shape {
    constructor(radius, totalHeight) {
        super('capsule');
        if (totalHeight < 2 * radius) {
            throw new Error('CapsuleShape: totalHeight must be >= 2 * radius');
        }
        this.radius = radius;
        this.totalHeight = totalHeight;
        this.segmentHalfLength = totalHeight / 2 - radius;
    }

    // Sphere-swept-segment support: radius*normalize(dir) offset by the farther cap center. At
    // dir.y ~0 the true farthest point is the barrel equator, not a cap center - handled explicitly.
    supportInto(out, direction) {
        const lsq = direction.x * direction.x + direction.y * direction.y + direction.z * direction.z;
        if (lsq === 0) { out.x = 0; out.y = 0; out.z = 0; return out; }
        if (Math.abs(direction.y) < 1e-9) {
            const s = this.radius / Math.sqrt(lsq);
            out.x = direction.x * s;
            out.y = 0;
            out.z = direction.z * s;
            return out;
        }
        const centerY = direction.y > 0 ? this.segmentHalfLength : -this.segmentHalfLength;
        const s = this.radius / Math.sqrt(lsq);
        out.x = direction.x * s;
        out.y = direction.y * s + centerY;
        out.z = direction.z * s;
        return out;
    }

    localAABBInto(out) {
        const halfExtent = this.segmentHalfLength + this.radius;
        out.min.set(-this.radius, -halfExtent, -this.radius);
        out.max.set(this.radius, halfExtent, this.radius);
        return out;
    }

    volume() {
        const r = this.radius, hs = this.segmentHalfLength;
        const cylinder = Scalar.PI * r * r * (2 * hs);
        const sphere = (4 / 3) * Scalar.PI * r * r * r;
        return cylinder + sphere;
    }

    // Cylinder core + two hemispherical caps, each with its own parallel-axis term.
    computeMassData() {
        const r = this.radius, hs = this.segmentHalfLength;
        const cylinderVolume = Scalar.PI * r * r * (2 * hs);
        const hemisphereVolume = (2 / 3) * Scalar.PI * r * r * r;
        const mass = cylinderVolume + 2 * hemisphereVolume;

        const cylinderMass = cylinderVolume;
        const hemisphereMass = hemisphereVolume;

        const iAxisCyl = 0.5 * cylinderMass * r * r;
        const iSideCyl = cylinderMass * (3 * r * r + (2 * hs) * (2 * hs)) / 12;

        const iAxisHemi = 0.4 * hemisphereMass * r * r;
        const hemiCentroidOffset = (3 / 8) * r;
        const iSideHemiAboutOwnCentroid = hemisphereMass * (83 / 320) * r * r;
        const distFromCapsuleCenter = hs + hemiCentroidOffset;
        const iSideHemiShifted = iSideHemiAboutOwnCentroid + hemisphereMass * distFromCapsuleCenter * distFromCapsuleCenter;

        const iAxis = iAxisCyl + 2 * iAxisHemi;
        const iSide = iSideCyl + 2 * iSideHemiShifted;

        const inertia = new Matrix3().setDiagonal(new Vector3(iSide, iAxis, iSide));
        return { mass: mass, inertia: inertia, centerOfMass: new Vector3(0, 0, 0) };
    }
}

ActionPhysics.CapsuleShape = CapsuleShape;


// ==== src/shapes/ConvexShape.js ====
// Arbitrary convex hull from a local-space point cloud. Support is a brute-force max-dot scan;
// mass/hull data is built lazily via incremental 3D Quickhull.
class ConvexShape extends Shape {

    constructor(points) {
        super('convex');
        this.points = points;
        this._hullFaces = null; // lazy: [[ia,ib,ic], ...] indices into points, outward-wound
        this._massData = null;  // lazy: { mass, inertia, centerOfMass } for density 1
    }

    // Triangulated hull faces, as { a, b, c } where each of a/b/c is { point: Vector3 } - the
    // point being a vertex of that triangle, outward-wound. Built lazily from the same Quickhull
    // pass the mass integration uses. Useful for building a render mesh of the hull.
    get faces() {
        if (this._facesView) return this._facesView;
        const hull = this._hull();
        const pts = this.points;
        this._facesView = hull.map(function (tri) {
            return {
                a: { point: pts[tri[0]] },
                b: { point: pts[tri[1]] },
                c: { point: pts[tri[2]] }
            };
        });
        return this._facesView;
    }

    supportInto(out, direction) {
        const pts = this.points;
        let bestDot = -Infinity, bestIndex = 0;
        for (let i = 0; i < pts.length; i++) {
            const d = pts[i].x * direction.x + pts[i].y * direction.y + pts[i].z * direction.z;
            if (d > bestDot) { bestDot = d; bestIndex = i; }
        }
        out.x = pts[bestIndex].x; out.y = pts[bestIndex].y; out.z = pts[bestIndex].z;
        return out;
    }

    localAABBInto(out) {
        out.setEmpty();
        const pts = this.points;
        for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            if (p.x < out.min.x) out.min.x = p.x;
            if (p.y < out.min.y) out.min.y = p.y;
            if (p.z < out.min.z) out.min.z = p.z;
            if (p.x > out.max.x) out.max.x = p.x;
            if (p.y > out.max.y) out.max.y = p.y;
            if (p.z > out.max.z) out.max.z = p.z;
        }
        return out;
    }

    volume() {
        return this._computeMassData().mass;
    }

    computeMassData() {
        const m = this._computeMassData();
        return {
            mass: m.mass,
            inertia: new Matrix3().copy(m.inertia),
            centerOfMass: new Vector3(m.centerOfMass.x, m.centerOfMass.y, m.centerOfMass.z)
        };
    }

    // Divergence-theorem integration: signed tetrahedra from the local origin to each hull face.
    _computeMassData() {
        if (this._massData) return this._massData;
        const faces = this._hull();

        let volume = 0;
        const comAccum = new Vector3(0, 0, 0);
        let Ixx = 0, Iyy = 0, Izz = 0, Ixy = 0, Ixz = 0, Iyz = 0;

        const pts = this.points;
        for (let f = 0; f < faces.length; f++) {
            const a = pts[faces[f][0]], b = pts[faces[f][1]], c = pts[faces[f][2]];

            const cx = b.y * c.z - b.z * c.y, cy = b.z * c.x - b.x * c.z, cz = b.x * c.y - b.y * c.x;
            const tetVol = (a.x * cx + a.y * cy + a.z * cz) / 6;
            volume += tetVol;

            comAccum.x += tetVol * (a.x + b.x + c.x) / 4;
            comAccum.y += tetVol * (a.y + b.y + c.y) / 4;
            comAccum.z += tetVol * (a.z + b.z + c.z) / 4;

            const sx2 = a.x * a.x + b.x * b.x + c.x * c.x, sy2 = a.y * a.y + b.y * b.y + c.y * c.y, sz2 = a.z * a.z + b.z * b.z + c.z * c.z;
            const sx = a.x + b.x + c.x, sy = a.y + b.y + c.y, sz = a.z + b.z + c.z;
            const sxy = a.x * a.y + b.x * b.y + c.x * c.y;
            const sxz = a.x * a.z + b.x * b.z + c.x * c.z;
            const syz = a.y * a.z + b.y * b.z + c.y * c.z;
            const k = tetVol / 20;
            const ix2 = k * (sx2 + sx * sx), iy2 = k * (sy2 + sy * sy), iz2 = k * (sz2 + sz * sz);
            Ixx += iy2 + iz2;
            Iyy += ix2 + iz2;
            Izz += ix2 + iy2;
            Ixy += k * (sxy + sx * sy);
            Ixz += k * (sxz + sx * sz);
            Iyz += k * (syz + sy * sz);
        }

        volume = Math.abs(volume);
        const com = volume > 0 ? new Vector3(comAccum.x / volume, comAccum.y / volume, comAccum.z / volume) : new Vector3(0, 0, 0);

        // Parallel axis theorem: shift origin-relative moments to the center of mass.
        const cx = com.x, cy = com.y, cz = com.z;
        const IxxC = Math.abs(Ixx - volume * (cy * cy + cz * cz));
        const IyyC = Math.abs(Iyy - volume * (cx * cx + cz * cz));
        const IzzC = Math.abs(Izz - volume * (cx * cx + cy * cy));
        const IxyC = Ixy - volume * cx * cy;
        const IxzC = Ixz - volume * cx * cz;
        const IyzC = Iyz - volume * cy * cz;

        const inertia = new Matrix3();
        inertia.e00 = IxxC; inertia.e01 = -IxyC; inertia.e02 = -IxzC;
        inertia.e10 = -IxyC; inertia.e11 = IyyC; inertia.e12 = -IyzC;
        inertia.e20 = -IxzC; inertia.e21 = -IyzC; inertia.e22 = IzzC;

        this._massData = { mass: volume, inertia: inertia, centerOfMass: com };
        return this._massData;
    }

    // Incremental 3D Quickhull: seed tetrahedron -> repeatedly absorb the farthest outside point,
    // remove faces it can see, re-triangulate the horizon -> stop when no outside points remain.
    _hull() {
        if (this._hullFaces) return this._hullFaces;
        const pts = this.points;
        if (pts.length < 4) { this._hullFaces = []; return this._hullFaces; }

        const seed = ConvexShape._seedTetrahedron(pts);
        let faces = seed.faces; // each: { a, b, c: point indices; outside: index[] }
        for (let i = 0; i < pts.length; i++) {
            if (seed.used.has(i)) continue;
            ConvexShape._assignToOutsideSet(faces, pts, i);
        }

        while (true) {
            let face = null;
            for (let f = 0; f < faces.length; f++) if (faces[f].outside.length > 0) { face = faces[f]; break; }
            if (!face) break;

            let farIdx = -1, farDist = -Infinity;
            for (let k = 0; k < face.outside.length; k++) {
                const idx = face.outside[k];
                const d = ConvexShape._planeDistance(pts, face, idx);
                if (d > farDist) { farDist = d; farIdx = idx; }
            }

            const visible = [];
            for (let f = 0; f < faces.length; f++) {
                if (ConvexShape._planeDistance(pts, faces[f], farIdx) > 1e-9) visible.push(f);
            }

            const visibleSet = new Set(visible);
            const edgeCount = new Map(); // "lo:hi" -> { count, a, b }
            for (let vi = 0; vi < visible.length; vi++) {
                const fc = faces[visible[vi]];
                ConvexShape._forEachEdge(fc, function (a, b) {
                    const key = a < b ? a + ':' + b : b + ':' + a;
                    let e = edgeCount.get(key);
                    if (!e) { e = { count: 0, a: a, b: b }; edgeCount.set(key, e); }
                    e.count++;
                });
            }
            const horizon = [];
            edgeCount.forEach(function (e) { if (e.count === 1) horizon.push([e.a, e.b]); });

            let orphanPool = [];
            for (let vi = 0; vi < visible.length; vi++) orphanPool = orphanPool.concat(faces[visible[vi]].outside);

            const sortedVisible = visible.slice().sort(function (x, y) { return y - x; });
            for (let vi = 0; vi < sortedVisible.length; vi++) faces.splice(sortedVisible[vi], 1);

            const newFaces = [];
            for (let h = 0; h < horizon.length; h++) {
                const nf = ConvexShape._makeFace(pts, horizon[h][0], horizon[h][1], farIdx, seed.centroid);
                newFaces.push(nf);
            }

            for (let o = 0; o < orphanPool.length; o++) {
                if (orphanPool[o] === farIdx) continue;
                ConvexShape._assignToOutsideSet(newFaces, pts, orphanPool[o]);
            }

            faces = faces.concat(newFaces);
        }

        this._hullFaces = faces.map(function (f) { return [f.a, f.b, f.c]; });
        return this._hullFaces;
    }

    static _seedTetrahedron(pts) {
        let minX = 0, maxX = 0, minY = 0, maxY = 0, minZ = 0, maxZ = 0;
        for (let i = 1; i < pts.length; i++) {
            if (pts[i].x < pts[minX].x) minX = i; if (pts[i].x > pts[maxX].x) maxX = i;
            if (pts[i].y < pts[minY].y) minY = i; if (pts[i].y > pts[maxY].y) maxY = i;
            if (pts[i].z < pts[minZ].z) minZ = i; if (pts[i].z > pts[maxZ].z) maxZ = i;
        }
        const candidates = [minX, maxX, minY, maxY, minZ, maxZ];

        let ia = candidates[0], ib = candidates[1], bestD = -Infinity;
        for (let i = 0; i < candidates.length; i++) {
            for (let j = i + 1; j < candidates.length; j++) {
                const d = pts[candidates[i]].distanceSquared(pts[candidates[j]]);
                if (d > bestD) { bestD = d; ia = candidates[i]; ib = candidates[j]; }
            }
        }

        let ic = -1, bestLineD = -Infinity;
        for (let i = 0; i < pts.length; i++) {
            if (i === ia || i === ib) continue;
            const d = ConvexShape._pointLineDistanceSquared(pts[i], pts[ia], pts[ib]);
            if (d > bestLineD) { bestLineD = d; ic = i; }
        }

        const normal = ConvexShape._faceNormal(pts[ia], pts[ib], pts[ic]);
        let id = -1, bestPlaneD = -Infinity;
        for (let i = 0; i < pts.length; i++) {
            if (i === ia || i === ib || i === ic) continue;
            const dx = pts[i].x - pts[ia].x, dy = pts[i].y - pts[ia].y, dz = pts[i].z - pts[ia].z;
            const d = Math.abs(dx * normal.x + dy * normal.y + dz * normal.z);
            if (d > bestPlaneD) { bestPlaneD = d; id = i; }
        }

        const centroid = new Vector3(
            (pts[ia].x + pts[ib].x + pts[ic].x + pts[id].x) / 4,
            (pts[ia].y + pts[ib].y + pts[ic].y + pts[id].y) / 4,
            (pts[ia].z + pts[ib].z + pts[ic].z + pts[id].z) / 4
        );

        const faces = [
            ConvexShape._makeFace(pts, ia, ib, ic, centroid),
            ConvexShape._makeFace(pts, ia, ib, id, centroid),
            ConvexShape._makeFace(pts, ia, ic, id, centroid),
            ConvexShape._makeFace(pts, ib, ic, id, centroid)
        ];

        const used = new Set([ia, ib, ic, id]);
        return { faces: faces, used: used, centroid: centroid };
    }

    // Winds i0,i1,i2 so the outward normal points away from insidePoint.
    static _makeFace(pts, i0, i1, i2, insidePoint) {
        const normal = ConvexShape._faceNormal(pts[i0], pts[i1], pts[i2]);
        const toInside = insidePoint.x * normal.x + insidePoint.y * normal.y + insidePoint.z * normal.z
            - (pts[i0].x * normal.x + pts[i0].y * normal.y + pts[i0].z * normal.z);
        if (toInside > 0) return { a: i0, b: i2, c: i1, outside: [] };
        return { a: i0, b: i1, c: i2, outside: [] };
    }

    static _faceNormal(a, b, c) {
        const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
        const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
        return new Vector3(aby * acz - abz * acy, abz * acx - abx * acz, abx * acy - aby * acx);
    }

    // Signed distance to face's plane; positive = outside.
    static _planeDistance(pts, face, idx) {
        const a = pts[face.a], b = pts[face.b], c = pts[face.c], p = pts[idx];
        const n = ConvexShape._faceNormal(a, b, c);
        const len = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
        if (len < 1e-12) return -Infinity;
        return ((p.x - a.x) * n.x + (p.y - a.y) * n.y + (p.z - a.z) * n.z) / len;
    }

    static _assignToOutsideSet(faces, pts, idx) {
        let bestFace = null, bestDist = 1e-9;
        for (let f = 0; f < faces.length; f++) {
            const d = ConvexShape._planeDistance(pts, faces[f], idx);
            if (d > bestDist) { bestDist = d; bestFace = faces[f]; }
        }
        if (bestFace) bestFace.outside.push(idx);
    }

    static _forEachEdge(face, fn) {
        fn(face.a, face.b);
        fn(face.b, face.c);
        fn(face.c, face.a);
    }

    static _pointLineDistanceSquared(p, a, b) {
        const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
        const apx = p.x - a.x, apy = p.y - a.y, apz = p.z - a.z;
        const abLenSq = abx * abx + aby * aby + abz * abz;
        if (abLenSq < 1e-12) return apx * apx + apy * apy + apz * apz;
        const t = (apx * abx + apy * aby + apz * abz) / abLenSq;
        const cx = a.x + t * abx, cy = a.y + t * aby, cz = a.z + t * abz;
        const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
        return dx * dx + dy * dy + dz * dz;
    }
}

ActionPhysics.ConvexShape = ConvexShape;


// ==== src/shapes/PlaneShape.js ====
// A finite zero-thickness rectangle. `orientation` ('x'/'y'/'z') is the normal axis; halfW/halfL
// extend along the other two in cross-product cyclic order (y,z)/(z,x)/(x,y).
class PlaneShape extends Shape {
    constructor(orientation, halfW, halfL) {
        super('plane');
        this.orientation = orientation;
        this.halfW = halfW;
        this.halfL = halfL;
    }

    // Zero thickness means the support point always lies exactly on the plane, regardless of
    // the direction's component along the normal.
    supportInto(out, direction) {
        if (this.orientation === 'x') {
            out.x = 0;
            out.y = direction.y >= 0 ? this.halfW : -this.halfW;
            out.z = direction.z >= 0 ? this.halfL : -this.halfL;
        } else if (this.orientation === 'y') {
            out.x = direction.x >= 0 ? this.halfL : -this.halfL;
            out.y = 0;
            out.z = direction.z >= 0 ? this.halfW : -this.halfW;
        } else {
            out.x = direction.x >= 0 ? this.halfW : -this.halfW;
            out.y = direction.y >= 0 ? this.halfL : -this.halfL;
            out.z = 0;
        }
        return out;
    }

    localAABBInto(out) {
        if (this.orientation === 'x') out.setFromMinMax(0, -this.halfW, -this.halfL, 0, this.halfW, this.halfL);
        else if (this.orientation === 'y') out.setFromMinMax(-this.halfL, 0, -this.halfW, this.halfL, 0, this.halfW);
        else out.setFromMinMax(-this.halfW, -this.halfL, 0, this.halfW, this.halfL, 0);
        return out;
    }

    // A plane is meant for static/kinematic use (infinite-mass equivalent geometry); it carries
    // zero volume and zero-mass data rather than pretending to a solid it is not.
    volume() { return 0; }

    computeMassData() {
        return { mass: 0, inertia: new Matrix3().zero(), centerOfMass: new Vector3(0, 0, 0) };
    }
}

ActionPhysics.PlaneShape = PlaneShape;


// ==== src/shapes/TriangleShape.js ====
// A single zero-thickness triangle. Used standalone and as the per-triangle shape from a mesh.
class TriangleShape extends Shape {
    constructor(a, b, c) {
        super('triangle');
        this.a = a; this.b = b; this.c = c;
    }

    supportInto(out, direction) {
        const a = this.a, b = this.b, c = this.c;
        const da = a.x * direction.x + a.y * direction.y + a.z * direction.z;
        const db = b.x * direction.x + b.y * direction.y + b.z * direction.z;
        const dc = c.x * direction.x + c.y * direction.y + c.z * direction.z;
        const best = (da >= db && da >= dc) ? a : (db >= dc ? b : c);
        out.x = best.x; out.y = best.y; out.z = best.z;
        return out;
    }

    localAABBInto(out) {
        out.setEmpty();
        const pts = [this.a, this.b, this.c];
        for (let i = 0; i < 3; i++) {
            const p = pts[i];
            if (p.x < out.min.x) out.min.x = p.x;
            if (p.y < out.min.y) out.min.y = p.y;
            if (p.z < out.min.z) out.min.z = p.z;
            if (p.x > out.max.x) out.max.x = p.x;
            if (p.y > out.max.y) out.max.y = p.y;
            if (p.z > out.max.z) out.max.z = p.z;
        }
        return out;
    }

    volume() { return 0; }

    computeMassData() {
        return { mass: 0, inertia: new Matrix3().zero(), centerOfMass: new Vector3(0, 0, 0) };
    }
}

ActionPhysics.TriangleShape = TriangleShape;


// ==== src/shapes/MeshShape.js ====
// Static triangle mesh: vertex list plus flat index triples. Zero mass; static/kinematic only.
// The midphase BVH over its triangles is built lazily elsewhere.
class MeshShape extends Shape {
    constructor(vertices, indices) {
        super('mesh');
        this.vertices = vertices;   // Vector3[]
        this.indices = indices;     // flat Uint32Array-able index triples
        this.triangleCount = (indices.length / 3) | 0;
    }

    triangleAt(i, outA, outB, outC) {
        const base = i * 3;
        const va = this.vertices[this.indices[base]];
        const vb = this.vertices[this.indices[base + 1]];
        const vc = this.vertices[this.indices[base + 2]];
        outA.copy(va); outB.copy(vb); outC.copy(vc);
    }

    // A mesh has no single well-defined support point (it's a shell, not a solid convex body) —
    // narrowphase dispatches per-triangle via TriangleShape instead of calling this directly.
    supportInto(out, direction) {
        throw new Error('MeshShape.supportInto: dispatch per-triangle, a mesh is not itself convex');
    }

    localAABBInto(out) {
        out.setEmpty();
        const verts = this.vertices;
        for (let i = 0; i < verts.length; i++) {
            const p = verts[i];
            if (p.x < out.min.x) out.min.x = p.x;
            if (p.y < out.min.y) out.min.y = p.y;
            if (p.z < out.min.z) out.min.z = p.z;
            if (p.x > out.max.x) out.max.x = p.x;
            if (p.y > out.max.y) out.max.y = p.y;
            if (p.z > out.max.z) out.max.z = p.z;
        }
        return out;
    }

    volume() { return 0; }

    computeMassData() {
        return { mass: 0, inertia: new Matrix3().zero(), centerOfMass: new Vector3(0, 0, 0) };
    }
}

ActionPhysics.MeshShape = MeshShape;


// ==== src/shapes/CompoundShape.js ====
// A CompoundShapeChild is a leaf shape at a fixed local offset/orientation within a compound.
// Plain data — the compound's owning body drives everything else.
class CompoundShapeChild {
    constructor(shape, localPosition, localRotation) {
        this.shape = shape;
        this.localPosition = localPosition;       // Vector3
        this.localRotation = localRotation;        // Quaternion
    }
}

// A rigid union of child shapes, each at its own local offset. Mass properties combine via the
// parallel-axis theorem per child; the midphase BVH over children is built by whatever consumes
// this shape, same division of ownership as MeshShape.
class CompoundShape extends Shape {
    constructor(children) {
        super('compound');
        this.children = children || []; // CompoundShapeChild[]
    }

    addChildShape(shape, localPosition, localRotation) {
        this.children.push(new CompoundShapeChild(shape, localPosition, localRotation));
        return this;
    }

    // Not itself convex — narrowphase dispatches per-child, same reasoning as MeshShape.
    supportInto(out, direction) {
        throw new Error('CompoundShape.supportInto: dispatch per-child, a compound is not itself convex');
    }

    localAABBInto(out) {
        out.setEmpty();
        const childAABB = new AABB();
        const rotMat = new Matrix3();
        const corner = new Vector3();
        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];
            child.shape.localAABBInto(childAABB);
            rotMat.fromQuaternion(child.localRotation);
            // Rotate the child's local AABB conservatively: transform all 8 corners.
            for (let cx = 0; cx < 2; cx++) for (let cy = 0; cy < 2; cy++) for (let cz = 0; cz < 2; cz++) {
                corner.x = cx ? childAABB.max.x : childAABB.min.x;
                corner.y = cy ? childAABB.max.y : childAABB.min.y;
                corner.z = cz ? childAABB.max.z : childAABB.min.z;
                rotMat.transformVector3(corner);
                corner.addInPlace(child.localPosition);
                if (corner.x < out.min.x) out.min.x = corner.x;
                if (corner.y < out.min.y) out.min.y = corner.y;
                if (corner.z < out.min.z) out.min.z = corner.z;
                if (corner.x > out.max.x) out.max.x = corner.x;
                if (corner.y > out.max.y) out.max.y = corner.y;
                if (corner.z > out.max.z) out.max.z = corner.z;
            }
        }
        return out;
    }

    volume() {
        let v = 0;
        for (let i = 0; i < this.children.length; i++) v += this.children[i].shape.volume();
        return v;
    }

    // Combines child mass data about the compound's own local origin, via the parallel-axis
    // theorem: a child's inertia about the compound origin is its own local inertia (rotated into
    // the compound frame) plus m * (translation contribution from the offset).
    computeMassData() {
        let totalMass = 0;
        const centerOfMass = new Vector3(0, 0, 0);
        const childData = [];
        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];
            const data = child.shape.computeMassData();
            childData.push(data);
            totalMass += data.mass;
            centerOfMass.addScaledInPlace(child.localPosition, data.mass);
        }
        if (totalMass > 0) centerOfMass.scaleInPlace(1 / totalMass);

        const inertia = new Matrix3().zero();
        const rotMat = new Matrix3();
        const rotated = new Matrix3();
        const rotatedT = new Matrix3();
        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];
            const data = childData[i];
            rotMat.fromQuaternion(child.localRotation);
            // rotated = R * I_local * R^T — child's local inertia expressed in the compound frame.
            rotated.multiplyFrom(rotMat, data.inertia);
            rotatedT.transposeInto(rotMat);
            rotated.multiply(rotatedT);

            // Parallel-axis shift from the child's own centroid to the compound's centerOfMass.
            const dx = child.localPosition.x + data.centerOfMass.x - centerOfMass.x;
            const dy = child.localPosition.y + data.centerOfMass.y - centerOfMass.y;
            const dz = child.localPosition.z + data.centerOfMass.z - centerOfMass.z;
            const d2 = dx * dx + dy * dy + dz * dz;
            const m = data.mass;

            inertia.e00 += rotated.e00 + m * (d2 - dx * dx);
            inertia.e01 += rotated.e01 + m * (-dx * dy);
            inertia.e02 += rotated.e02 + m * (-dx * dz);
            inertia.e10 += rotated.e10 + m * (-dy * dx);
            inertia.e11 += rotated.e11 + m * (d2 - dy * dy);
            inertia.e12 += rotated.e12 + m * (-dy * dz);
            inertia.e20 += rotated.e20 + m * (-dz * dx);
            inertia.e21 += rotated.e21 + m * (-dz * dy);
            inertia.e22 += rotated.e22 + m * (d2 - dz * dz);
        }

        return { mass: totalMass, inertia: inertia, centerOfMass: centerOfMass };
    }
}

ActionPhysics.CompoundShapeChild = CompoundShapeChild;
ActionPhysics.CompoundShape = CompoundShape;


// ==== src/shapes/LineSweptShape.js ====
// `shape` swept along a local-space segment start->end (Minkowski sum with the segment). Used for
// swept queries.
class LineSweptShape extends Shape {
    constructor(shape, start, end) {
        super('lineswept');
        this.shape = shape;
        this.start = start;
        this.end = end;
        this.aabb = new AABB();
        this._recomputeAABB();
    }

    _recomputeAABB() {
        this.shape.localAABBInto(this.aabb);
        const sx = this.start.x, sy = this.start.y, sz = this.start.z;
        const ex = this.end.x, ey = this.end.y, ez = this.end.z;
        this.aabb.min.x += Math.min(sx, ex); this.aabb.max.x += Math.max(sx, ex);
        this.aabb.min.y += Math.min(sy, ey); this.aabb.max.y += Math.max(sy, ey);
        this.aabb.min.z += Math.min(sz, ez); this.aabb.max.z += Math.max(sz, ez);
        return this.aabb;
    }

    // Minkowski sum with a segment: support(d) = shape.support(d) + endpoint(d), where the
    // endpoint chosen is whichever end of the segment is farther along d (has the larger dot
    // product with d).
    supportInto(out, direction) {
        this.shape.supportInto(out, direction);
        const ds = this.start.x * direction.x + this.start.y * direction.y + this.start.z * direction.z;
        const de = this.end.x * direction.x + this.end.y * direction.y + this.end.z * direction.z;
        if (de >= ds) { out.x += this.end.x; out.y += this.end.y; out.z += this.end.z; }
        else { out.x += this.start.x; out.y += this.start.y; out.z += this.start.z; }
        return out;
    }

    // Point-in-shape support, matching RigidBody.findSupportPoint's own direct-shape convention.
    findSupportPoint(direction, out) {
        return this.supportInto(out, direction);
    }

    localAABBInto(out) {
        out.min.copy(this.aabb.min);
        out.max.copy(this.aabb.max);
        return out;
    }

    // A sweep is a query tool, not a body shape — it carries no mass properties of its own.
    volume() { return 0; }

    computeMassData() {
        return { mass: 0, inertia: new Matrix3().zero(), centerOfMass: new Vector3(0, 0, 0) };
    }
}

ActionPhysics.LineSweptShape = LineSweptShape;


// ==== src/bodies/RigidBody.js ====
const BODY_STATIC = 0;
const BODY_KINEMATIC = 1;
const BODY_DYNAMIC = 2;

let _nextBodyId = 1;

// Shape + world transform + (for dynamic bodies) mass/motion state. See Forces.js, DerivedState.js,
// Accessors.js.
class RigidBody {
    // new RigidBody(shape, mass) - mass > 0 makes a DYNAMIC body, mass <= 0 a STATIC one.
    // new RigidBody(shape, mass, { kinematic: true }) makes a KINEMATIC body: infinite effective
    // mass (contacts never move it, forces/impulses are ignored), but the integrator advances its
    // position from linear_velocity and its rotation from angular_velocity every tick, and a direct
    // position/rotation write is honoured. Drive it by setting its velocity (or writing its
    // transform) each tick - moving platforms, elevators, doors.
    constructor(shape, mass, options) {
        const kinematic = !!(options && options.kinematic);

        // ---- Identity ----
        this.id = _nextBodyId++;
        this.shape = shape;
        this.debugName = null;
        this.world = null; // set by World.addRigidBody
        this.bodyType = kinematic ? BODY_KINEMATIC : (mass > 0 ? BODY_DYNAMIC : BODY_STATIC);

        // ---- Transform ----
        this.position = new Vector3(0, 0, 0);
        this.rotation = new Quaternion(0, 0, 0, 1);
        this._aabb = new AABB();            // tight geometric bound (getAABB)
        this._broadphaseAABB = new AABB();  // fattened for speculative contacts (getBroadphaseAABB)
        this._aabbDirty = true;

        // ---- Mass ----
        // A KINEMATIC or mass<=0 body has infinite effective mass: zero inverse mass, zero inertia.
        // A KINEMATIC body still moves - the integrator drives its transform from its velocity - it
        // just does not RESPOND to contacts or forces.
        this._mass = kinematic ? 0 : (mass || 0);
        this._mass_inverted = this._mass > 0 ? 1 / this._mass : 0;
        this.inertiaTensor = new Matrix3();       // local-space, set by setMassFromShape()
        this.inverseInertiaTensor = new Matrix3(); // local-space inverse
        this._worldInverseInertiaTensor = new Matrix3(); // R * I^-1_local * R^T, refreshed by updateDerived()
        if (shape && this._mass > 0) this.setMassFromShape(shape, this._mass);

        // ---- Motion ----
        this.linear_velocity = new Vector3(0, 0, 0);
        this.angular_velocity = new Vector3(0, 0, 0);
        this.linear_factor = new Vector3(1, 1, 1);   // per-axis velocity mask, e.g. lock an axis with 0
        this.angular_factor = new Vector3(1, 1, 1);

        // ---- Forces ----
        this.accumulated_force = new Vector3(0, 0, 0);
        this.accumulated_torque = new Vector3(0, 0, 0);
        this.gravity = null; // null = use World.gravity; setGravity() overrides per-body

        // ---- Material ---- (matches ActionEngineJS's MATERIAL_DEFAULTS)
        this.friction = 3.0;
        this.restitution = 0.33;
        this.linear_damping = 0.1;
        this.angular_damping = 0.9; // nonzero, or a cleanly rolling shape never stops on friction alone
        // Caps relative angular velocity in the contact's tangent plane, like friction caps slip.
        this.angular_friction = 0.05;

        // ---- Filtering ----
        this.collision_mask = 0xFFFFFFFF;
        this.collision_groups = 1;

        // ---- Events ----
        this._listeners = {};

        // Sleep state, owned entirely by the sleep manager.
        this.isAwake = true;
        this.sleepTimer = 0;
        // Set by the solver when a moving body pushes on this one; consumed by the rest-pin logic in
        // Solver._reconcileRestVelocity to release a pinned body the tick it is disturbed.
        this._restDisturbed = false;
    }

    get is_static() { return this.bodyType === RigidBody.STATIC; }
    get mass() { return this._mass; }

    // Assigning mass re-derives the inertia tensor from the current shape. mass <= 0 (including
    // Infinity, treated as "no dynamics") makes the body STATIC; a positive mass makes it DYNAMIC.
    // A KINEMATIC body's type is not changed by a mass write (it is code-driven regardless).
    set mass(value) {
        const m = (value === Infinity || !(value > 0)) ? 0 : value;
        this.setMassFromShape(this.shape, m);
        if (this.bodyType !== RigidBody.KINEMATIC) {
            this.bodyType = m > 0 ? RigidBody.DYNAMIC : RigidBody.STATIC;
        }
    }

    // This tick's linear acceleration from applied force: F * m^-1. Zero for a body with infinite
    // effective mass (static/kinematic). Read it after applying forces and before step() for "how
    // hard is this being pushed"; it is not a stored integration value (XPBD has no 'a' term), it
    // is recomputed into a per-body vector on each read.
    get acceleration() {
        const a = this._acceleration || (this._acceleration = new Vector3());
        const mi = this._mass_inverted;
        a.x = this.accumulated_force.x * mi;
        a.y = this.accumulated_force.y * mi;
        a.z = this.accumulated_force.z * mi;
        return a;
    }

    // The tight world AABB (same object getAABB() returns). Assumes updateDerived() has run this
    // tick - a stale read is a caller bug, not patched over here.
    get aabb() { return this._aabb; }

    // Sets mass and re-derives the local inertia tensor from the shape (Shape.getInertiaTensor does
    // the density-1 -> mass scaling). mass <= 0 gives the zero tensor (infinite effective mass).
    setMassFromShape(shape, mass) {
        this._mass = mass;
        this._mass_inverted = mass > 0 ? 1 / mass : 0;
        if (mass <= 0) {
            this.inertiaTensor.zero();
            this.inverseInertiaTensor.zero();
            return;
        }
        this.inertiaTensor.copy(shape.getInertiaTensor(mass));
        this.inverseInertiaTensor.invertInto(this.inertiaTensor);
    }

    setGravity(x, y, z) {
        this.gravity = new Vector3(x, y, z);
        return this;
    }

    // Park this body: the solver skips it until something wakes it. A sleeping body holds still by
    // definition, so its velocity is zeroed here. No-op for non-dynamic bodies (they are never awake
    // in the sleep sense) and for an already-sleeping body.
    sleep() {
        if (this.bodyType !== BODY_DYNAMIC || !this.isAwake) return this;
        this.isAwake = false;
        this.sleepTimer = 0;
        this.linear_velocity.set(0, 0, 0);
        this.angular_velocity.set(0, 0, 0);
        return this;
    }

    // Wake this body and restart its sleep countdown. Called by the sleep manager when an island is
    // disturbed, and by the force/impulse API so a push on a sleeping body takes effect.
    wakeUp() {
        if (this.bodyType !== BODY_DYNAMIC) return this;
        this.isAwake = true;
        this.sleepTimer = 0;
        return this;
    }
}

// Scratch for DerivedState.js's allocation-free recompute.
RigidBody._scratchLocalAABB = new AABB();
RigidBody._scratchMat3 = new Matrix3();
RigidBody._scratchMat3b = new Matrix3();
RigidBody._scratchVec = new Vector3();
RigidBody._scratchInvRot = new Quaternion();
RigidBody._scratchSupportDir = new Vector3();
RigidBody._scratchForcePoint = new Vector3(); // Forces.js applyForceAtLocalPoint

RigidBody.STATIC = BODY_STATIC;
RigidBody.KINEMATIC = BODY_KINEMATIC;
RigidBody.DYNAMIC = BODY_DYNAMIC;

RigidBody.SPECULATIVE_MARGIN = 0.02; // meters; matches NarrowPhase.SPECULATIVE_BASE

ActionPhysics.RigidBody = RigidBody;


// ==== src/bodies/Forces.js ====
// Impulse (instantaneous velocity change) and force/torque (continuous, integrated per-substep,
// cleared once per tick) application.
var proto = RigidBody.prototype;

proto.applyImpulse = function (impulse) {
    if (this._mass_inverted <= 0) return this;
    if (!this.isAwake) this.wakeUp();
    this.linear_velocity.x += impulse.x * this._mass_inverted * this.linear_factor.x;
    this.linear_velocity.y += impulse.y * this._mass_inverted * this.linear_factor.y;
    this.linear_velocity.z += impulse.z * this._mass_inverted * this.linear_factor.z;
    return this;
};

// Add a velocity delta directly - mass-independent (dv, not an impulse J = m*dv). Use this for a
// "shove" whose strength should not depend on how heavy the target is (a game gravity-gun, a
// scripted knockback). A static/kinematic body (no finite mass) is unaffected. linear_factor still
// masks locked axes.
proto.addLinearVelocity = function (dv) {
    if (this._mass_inverted <= 0) return this;
    if (!this.isAwake) this.wakeUp();
    this.linear_velocity.x += dv.x * this.linear_factor.x;
    this.linear_velocity.y += dv.y * this.linear_factor.y;
    this.linear_velocity.z += dv.z * this.linear_factor.z;
    return this;
};

// Impulse at a world-space point: linear change plus the angular change it produces about the
// center (dw = I^-1 * (r x impulse)).
proto.applyImpulseAtPoint = function (impulse, worldPoint) {
    if (this._mass_inverted <= 0) return this;
    this.applyImpulse(impulse);
    const rx = worldPoint.x - this.position.x, ry = worldPoint.y - this.position.y, rz = worldPoint.z - this.position.z;
    const tqx = ry * impulse.z - rz * impulse.y, tqy = rz * impulse.x - rx * impulse.z, tqz = rx * impulse.y - ry * impulse.x;
    const I = this._worldInverseInertiaTensor;
    this.angular_velocity.x += (I.e00 * tqx + I.e01 * tqy + I.e02 * tqz) * this.angular_factor.x;
    this.angular_velocity.y += (I.e10 * tqx + I.e11 * tqy + I.e12 * tqz) * this.angular_factor.y;
    this.angular_velocity.z += (I.e20 * tqx + I.e21 * tqy + I.e22 * tqz) * this.angular_factor.z;
    return this;
};

proto.applyTorqueImpulse = function (torqueImpulse) {
    if (this._mass_inverted <= 0) return this;
    if (!this.isAwake) this.wakeUp();
    const I = this._worldInverseInertiaTensor;
    const tx = torqueImpulse.x, ty = torqueImpulse.y, tz = torqueImpulse.z;
    this.angular_velocity.x += (I.e00 * tx + I.e01 * ty + I.e02 * tz) * this.angular_factor.x;
    this.angular_velocity.y += (I.e10 * tx + I.e11 * ty + I.e12 * tz) * this.angular_factor.y;
    this.angular_velocity.z += (I.e20 * tx + I.e21 * ty + I.e22 * tz) * this.angular_factor.z;
    return this;
};

// Continuous force, integrated by the solver every substep until cleared. Adds, not overwrites -
// multiple calls in the same tick (gravity plus thrust plus wind) all contribute.
proto.applyForce = function (force) {
    if (!this.isAwake && (force.x !== 0 || force.y !== 0 || force.z !== 0)) this.wakeUp();
    this.accumulated_force.x += force.x;
    this.accumulated_force.y += force.y;
    this.accumulated_force.z += force.z;
    return this;
};

proto.applyTorque = function (torque) {
    if (!this.isAwake && (torque.x !== 0 || torque.y !== 0 || torque.z !== 0)) this.wakeUp();
    this.accumulated_torque.x += torque.x;
    this.accumulated_torque.y += torque.y;
    this.accumulated_torque.z += torque.z;
    return this;
};

// A force at a world-space point contributes the force itself plus the torque it produces about
// the center (r x force) - the continuous-force analogue of applyImpulseAtPoint.
proto.applyForceAtWorldPoint = function (force, worldPoint) {
    this.applyForce(force);
    const rx = worldPoint.x - this.position.x, ry = worldPoint.y - this.position.y, rz = worldPoint.z - this.position.z;
    this.accumulated_torque.x += ry * force.z - rz * force.y;
    this.accumulated_torque.y += rz * force.x - rx * force.z;
    this.accumulated_torque.z += rx * force.y - ry * force.x;
    return this;
};

// Same as applyForceAtWorldPoint but the point is given in this body's local frame - transformed to
// world via the current transform, then delegated.
proto.applyForceAtLocalPoint = function (force, localPoint) {
    const world = RigidBody._scratchForcePoint;
    this.getTransform().transformPointInto(localPoint, world);
    return this.applyForceAtWorldPoint(force, world);
};

// Velocity of a point on this body: v_linear + omega x r, where r is `offset` - a vector from the
// center of mass, in world axes (the "local" in the name is historical; the offset is not rotated
// into the body frame). `out` receives the result. Zero angular/linear -> just the linear velocity.
proto.getVelocityInLocalPoint = function (offset, out) {
    const w = this.angular_velocity, v = this.linear_velocity;
    out.x = v.x + (w.y * offset.z - w.z * offset.y);
    out.y = v.y + (w.z * offset.x - w.x * offset.z);
    out.z = v.z + (w.x * offset.y - w.y * offset.x);
    return out;
};

// Zeroes accumulated force/torque. Called by World.step once per TICK (not per substep) - a
// caller who wants a force to keep acting must call applyForce again next tick.
proto.clearForces = function () {
    this.accumulated_force.set(0, 0, 0);
    this.accumulated_torque.set(0, 0, 0);
    return this;
};


// ==== src/bodies/DerivedState.js ====
// Recomputes tight AABB, fattened broadphase AABB, and world inverse inertia from position/rotation.
// Runs once per body per tick; narrowphase and the solver assume it already has.
var proto = RigidBody.prototype;

proto.updateDerived = function (dt) {
    this._recomputeAABB();
    this._recomputeBroadphaseAABB(dt || 0);
    this._recomputeWorldInverseInertia();
    return this;
};

// The TIGHT world AABB: the exact rotated bound of the shape at the current transform, no margin -
// the body's geometric truth, what getAABB()/a raycast wants. Broadphase uses the fattened variant.
proto._recomputeAABB = function () {
    const local = RigidBody._scratchLocalAABB;
    this.shape.localAABBInto(local);
    // Conservative rotated bound via the 8-corner sweep (same technique CompoundShape uses),
    // correct for any rotation, not just axis-aligned ones.
    const rotMat = RigidBody._scratchMat3;
    rotMat.fromQuaternion(this.rotation);
    const corner = RigidBody._scratchVec;
    this._aabb.setEmpty();
    for (let cx = 0; cx < 2; cx++) for (let cy = 0; cy < 2; cy++) for (let cz = 0; cz < 2; cz++) {
        corner.x = cx ? local.max.x : local.min.x;
        corner.y = cy ? local.max.y : local.min.y;
        corner.z = cz ? local.max.z : local.min.z;
        rotMat.transformVector3(corner);
        corner.addInPlace(this.position);
        if (corner.x < this._aabb.min.x) this._aabb.min.x = corner.x;
        if (corner.y < this._aabb.min.y) this._aabb.min.y = corner.y;
        if (corner.z < this._aabb.min.z) this._aabb.min.z = corner.z;
        if (corner.x > this._aabb.max.x) this._aabb.max.x = corner.x;
        if (corner.y > this._aabb.max.y) this._aabb.max.y = corner.y;
        if (corner.z > this._aabb.max.z) this._aabb.max.z = corner.z;
    }
    this._aabbDirty = false;
};

// Tight AABB fattened by SPECULATIVE_MARGIN plus a directional velocity sweep, so a fast approach
// is caught a tick before overlap. Fattening only adds candidate pairs; narrowphase culls precisely.
proto._recomputeBroadphaseAABB = function (dt) {
    const m = RigidBody.SPECULATIVE_MARGIN;
    const sx = this.linear_velocity.x * dt, sy = this.linear_velocity.y * dt, sz = this.linear_velocity.z * dt;
    // Angular sweep: a corner at bounding radius R moves at |omega|*R; applied isotropically.
    const ex = (this._aabb.max.x - this._aabb.min.x) * 0.5;
    const ey = (this._aabb.max.y - this._aabb.min.y) * 0.5;
    const ez = (this._aabb.max.z - this._aabb.min.z) * 0.5;
    const R = Math.sqrt(ex * ex + ey * ey + ez * ez);
    const wMag = Math.sqrt(this.angular_velocity.x * this.angular_velocity.x +
        this.angular_velocity.y * this.angular_velocity.y + this.angular_velocity.z * this.angular_velocity.z);
    const a = wMag * R * dt;
    this._broadphaseAABB.min.x = this._aabb.min.x - m - a - (sx < 0 ? -sx : 0);
    this._broadphaseAABB.max.x = this._aabb.max.x + m + a + (sx > 0 ? sx : 0);
    this._broadphaseAABB.min.y = this._aabb.min.y - m - a - (sy < 0 ? -sy : 0);
    this._broadphaseAABB.max.y = this._aabb.max.y + m + a + (sy > 0 ? sy : 0);
    this._broadphaseAABB.min.z = this._aabb.min.z - m - a - (sz < 0 ? -sz : 0);
    this._broadphaseAABB.max.z = this._aabb.max.z + m + a + (sz > 0 ? sz : 0);
};

proto._recomputeWorldInverseInertia = function () {
    if (this._mass_inverted === 0) { this._worldInverseInertiaTensor.zero(); return; }
    const rotMat = RigidBody._scratchMat3;
    rotMat.fromQuaternion(this.rotation);
    const rotT = RigidBody._scratchMat3b;
    rotT.transposeInto(rotMat);
    this._worldInverseInertiaTensor.multiplyFrom(rotMat, this.inverseInertiaTensor);
    this._worldInverseInertiaTensor.multiply(rotT);
};

// Assumes updateDerived() has already run this tick - never recomputes on its own, so a stale call
// is a caller bug surfaced as a stale box, not silently patched over here.
proto.getAABB = function () {
    return this._aabb;
};

// Broadphase/midphase read THIS, not getAABB(), so a pair surfaces the tick before overlap.
proto.getBroadphaseAABB = function () {
    return this._broadphaseAABB;
};


// ==== src/bodies/Accessors.js ====
// Support point, transform sync, ray cast, and event listeners.
var proto = RigidBody.prototype;

// A Transform synced from this body's position/rotation, for consumers wanting Transform's API.
// The body's real state stays in position/rotation. Lazily allocated, re-synced per call.
proto.getTransform = function () {
    if (!this._transform) this._transform = new Transform();
    this._transform.syncFromPhysicsBody(this);
    return this._transform;
};

// World-space support point: the farthest point on this body's shape along world-space
// `direction`. Same composition MinkowskiSupport uses internally (inverse-rotate into local space,
// call the shape's own supportInto, rotate back, translate) - exposed standalone for a caller with
// no reason to construct a MinkowskiSupport (which pairs two bodies) for a single-body question.
proto.findSupportPoint = function (direction, out) {
    const scratchDir = RigidBody._scratchSupportDir;
    RigidBody._scratchInvRot.copy(this.rotation).invert();
    RigidBody._scratchInvRot.transformVectorInto(direction, scratchDir);
    this.shape.supportInto(out, scratchDir);
    this.rotation.transformVectorInPlace(out);
    out.addInPlace(this.position);
    return out;
};

// Casts against THIS body alone, for a caller that already holds a body reference and wants a hit
// test against just that shape without World.rayIntersect's whole-scene search.
proto.rayIntersect = function (start, end) {
    return Queries.rayIntersectBody(start, end, this);
};

proto.addListener = function (event, fn) {
    (this._listeners[event] || (this._listeners[event] = [])).push(fn);
    return this;
};

proto.emit = function (event, arg) {
    const list = this._listeners[event];
    if (!list) return;
    for (let i = 0; i < list.length; i++) list[i](arg);
};

// Runs this body's speculativeContact listeners; returns false if any vetoes the point.
proto._speculativeVeto = function (contact, other) {
    const list = this._listeners.speculativeContact;
    if (!list) return true;
    for (let i = 0; i < list.length; i++) {
        if (list[i]({ contact: contact, other: other }) === false) return false;
    }
    return true;
};


// ==== src/spatial/BVH.js ====
// Static BVH over a fixed leaf set, built once. Flattened parallel typed arrays (min/max xyz,
// left/right/leafIndex; leafIndex -1 = internal node). Median-split on the widest axis, no SAH.
class BVH {
    constructor() {
        this.nodeCount = 0;
        this._capacity = 0;
        this.minX = null; this.minY = null; this.minZ = null;
        this.maxX = null; this.maxY = null; this.maxZ = null;
        this.left = null; this.right = null; this.leafIndex = null;
        this.root = -1;
    }

    _ensureCapacity(n) {
        if (n <= this._capacity) return;
        this._capacity = n;
        this.minX = new Float64Array(n); this.minY = new Float64Array(n); this.minZ = new Float64Array(n);
        this.maxX = new Float64Array(n); this.maxY = new Float64Array(n); this.maxZ = new Float64Array(n);
        this.left = new Int32Array(n).fill(-1);
        this.right = new Int32Array(n).fill(-1);
        this.leafIndex = new Int32Array(n).fill(-1);
    }

    // leafAABBInto(out, i) fills `out` with leaf i's bound.
    build(leafCount, leafAABBInto) {
        this.nodeCount = 0;
        this.root = -1;
        if (leafCount === 0) return this;

        this._ensureCapacity(Math.max(1, 2 * leafCount - 1));

        const scratch = new AABB();
        const indices = new Int32Array(leafCount);
        const centerX = new Float64Array(leafCount), centerY = new Float64Array(leafCount), centerZ = new Float64Array(leafCount);
        const leafMinX = new Float64Array(leafCount), leafMinY = new Float64Array(leafCount), leafMinZ = new Float64Array(leafCount);
        const leafMaxX = new Float64Array(leafCount), leafMaxY = new Float64Array(leafCount), leafMaxZ = new Float64Array(leafCount);
        for (let i = 0; i < leafCount; i++) {
            leafAABBInto(scratch, i);
            indices[i] = i;
            leafMinX[i] = scratch.min.x; leafMinY[i] = scratch.min.y; leafMinZ[i] = scratch.min.z;
            leafMaxX[i] = scratch.max.x; leafMaxY[i] = scratch.max.y; leafMaxZ[i] = scratch.max.z;
            centerX[i] = (scratch.min.x + scratch.max.x) * 0.5;
            centerY[i] = (scratch.min.y + scratch.max.y) * 0.5;
            centerZ[i] = (scratch.min.z + scratch.max.z) * 0.5;
        }

        const self = this;
        function boundsOf(lo, hi) {
            let bx0 = Infinity, by0 = Infinity, bz0 = Infinity, bx1 = -Infinity, by1 = -Infinity, bz1 = -Infinity;
            for (let k = lo; k < hi; k++) {
                const i = indices[k];
                if (leafMinX[i] < bx0) bx0 = leafMinX[i]; if (leafMaxX[i] > bx1) bx1 = leafMaxX[i];
                if (leafMinY[i] < by0) by0 = leafMinY[i]; if (leafMaxY[i] > by1) by1 = leafMaxY[i];
                if (leafMinZ[i] < bz0) bz0 = leafMinZ[i]; if (leafMaxZ[i] > bz1) bz1 = leafMaxZ[i];
            }
            return { minX: bx0, minY: by0, minZ: bz0, maxX: bx1, maxY: by1, maxZ: bz1 };
        }

        function buildRange(lo, hi) {
            const b = boundsOf(lo, hi);
            const nodeIdx = self.nodeCount++;
            self.minX[nodeIdx] = b.minX; self.minY[nodeIdx] = b.minY; self.minZ[nodeIdx] = b.minZ;
            self.maxX[nodeIdx] = b.maxX; self.maxY[nodeIdx] = b.maxY; self.maxZ[nodeIdx] = b.maxZ;

            if (hi - lo === 1) {
                self.leafIndex[nodeIdx] = indices[lo];
                self.left[nodeIdx] = -1; self.right[nodeIdx] = -1;
                return nodeIdx;
            }

            const sx = b.maxX - b.minX, sy = b.maxY - b.minY, sz = b.maxZ - b.minZ;
            let axis = 0, getCenter = centerX;
            if (sy >= sx && sy >= sz) { axis = 1; getCenter = centerY; }
            else if (sz >= sx && sz >= sy) { axis = 2; getCenter = centerZ; }

            const sub = indices.subarray(lo, hi);
            Array.prototype.sort.call(sub, function (ia, ib) { return getCenter[ia] - getCenter[ib]; });
            const mid = lo + ((hi - lo) >> 1);

            self.leafIndex[nodeIdx] = -1;
            self.left[nodeIdx] = buildRange(lo, mid);
            self.right[nodeIdx] = buildRange(mid, hi);
            return nodeIdx;
        }

        this.root = buildRange(0, leafCount);
        return this;
    }

    // Visits every leaf whose node AABB intersects queryAABB. Explicit stack, no allocation.
    query(queryAABB, onLeaf) {
        if (this.root === -1) return;
        const qminx = queryAABB.min.x, qminy = queryAABB.min.y, qminz = queryAABB.min.z;
        const qmaxx = queryAABB.max.x, qmaxy = queryAABB.max.y, qmaxz = queryAABB.max.z;

        const stack = this._stack || (this._stack = []);
        let sp = 0;
        stack[sp++] = this.root;
        while (sp > 0) {
            const node = stack[--sp];
            if (this.minX[node] > qmaxx || this.maxX[node] < qminx ||
                this.minY[node] > qmaxy || this.maxY[node] < qminy ||
                this.minZ[node] > qmaxz || this.maxZ[node] < qminz) continue;

            if (this.leafIndex[node] !== -1) { onLeaf(this.leafIndex[node]); continue; }
            stack[sp++] = this.left[node];
            stack[sp++] = this.right[node];
        }
    }
}

ActionPhysics.BVH = BVH;


// ==== src/phases/SAPBroadphase.js ====
// Sweep-and-prune over fattened AABBs (body.getBroadphaseAABB()), sorted along the most-spread axis.
class SAPBroadphase {
    constructor() {
        this._entries = []; // { body, aabb } - aabb is a live reference
        this._axis = 'x';
    }

    add(body) {
        this._entries.push({ body: body, aabb: body.getBroadphaseAABB() });
    }

    remove(body) {
        for (let i = 0; i < this._entries.length; i++) {
            if (this._entries[i].body === body) { this._entries.splice(i, 1); return; }
        }
    }

    _pickAxis() {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (let i = 0; i < this._entries.length; i++) {
            const c = this._entries[i].aabb;
            if (c.min.x < minX) minX = c.min.x; if (c.max.x > maxX) maxX = c.max.x;
            if (c.min.y < minY) minY = c.min.y; if (c.max.y > maxY) maxY = c.max.y;
            if (c.min.z < minZ) minZ = c.min.z; if (c.max.z > maxZ) maxZ = c.max.z;
        }
        const sx = maxX - minX, sy = maxY - minY, sz = maxZ - minZ;
        this._axis = (sx >= sy && sx >= sz) ? 'x' : (sy >= sz ? 'y' : 'z');
    }

    // [bodyA, bodyB][], A.id < B.id always.
    computePairs() {
        const n = this._entries.length;
        const pairs = [];
        if (n < 2) return pairs;

        this._pickAxis();
        const axis = this._axis;
        this._entries.sort(function (a, b) { return a.aabb.min[axis] - b.aabb.min[axis]; });

        for (let i = 0; i < n; i++) {
            const ei = this._entries[i];
            const maxOnAxis = ei.aabb.max[axis];
            for (let j = i + 1; j < n; j++) {
                const ej = this._entries[j];
                if (ej.aabb.min[axis] > maxOnAxis) break; // mins only increase from here
                if (!ei.aabb.intersects(ej.aabb)) continue;
                const a = ei.body, b = ej.body;
                if (a.bodyType !== RigidBody.DYNAMIC && b.bodyType !== RigidBody.DYNAMIC) continue;
                if ((a.collision_mask & b.collision_groups) === 0) continue;
                if ((b.collision_mask & a.collision_groups) === 0) continue;
                if (a.id < b.id) pairs.push([a, b]); else pairs.push([b, a]);
            }
        }
        return pairs;
    }
}

ActionPhysics.SAPBroadphase = SAPBroadphase;


// ==== src/phases/Midphase.js ====
// Expands a broadphase body pair into candidate primitive-shape pairs (compound children / mesh
// triangles whose world AABB overlaps the other side). See BVHCache.js and ExpandPair.js.
class Midphase {
    constructor() {
        // otherBodyId -> { shape, min/max bounds, hits:[leafIndex] }. Empty results are cached too
        // (otherwise a resting body re-walks the BVH every tick).
        this._leafCache = new Map();

        // Per-expandPair() world-placement pools, grown as needed. See ExpandPair.js.
        this._triSlots = [];
        this._triSlotIndex = 0;
        this._childSlots = [];
        this._childSlotIndex = 0;
        this._primSlots = [];
        this._primSlotIndex = 0;
        // Scratch placements for nested compound recursion, indexed by depth.
        this._nestedBodies = [];
        // Reused return value of expandPairSides(); arrays are truncated, never replaced.
        this._sides = { a: [], b: [] };
    }

    // Call when a static/kinematic compound/mesh body's geometry or transform changes.
    invalidate() {
        this._leafCache.clear();
    }
}

// At or below this triangle count, a mesh is expanded wholesale instead of BVH-queried - see
// _expandSide. Tiled CompoundShape ground is the motivating case (2 triangles per tile).
Midphase.SMALL_MESH_TRIS = 4;

ActionPhysics.Midphase = Midphase;


// ==== src/phases/BVHCache.js ====
// Per-shape BVH (built once, cached on the shape) and cached leaf queries.
var proto = Midphase.prototype;

// Builds shape._midphaseBVH on first use: one leaf per compound child, or per mesh triangle.
// Free function (no Midphase state) so the query path (Queries.js) can build/get the same cached
// tree - a mesh/compound ray or shape cast otherwise linear-scans every triangle.
function ensureShapeBVH(shape) {
    if (shape._midphaseBVH) return shape._midphaseBVH;
    const bvh = new BVH();
    if (shape instanceof CompoundShape) {
        const scratch = new AABB();
        const rotMat = new Matrix3();
        const corner = new Vector3();
        bvh.build(shape.children.length, function (out, i) {
            const child = shape.children[i];
            child.shape.localAABBInto(scratch);
            rotMat.fromQuaternion(child.localRotation);
            out.setEmpty();
            for (let cx = 0; cx < 2; cx++) for (let cy = 0; cy < 2; cy++) for (let cz = 0; cz < 2; cz++) {
                corner.x = cx ? scratch.max.x : scratch.min.x;
                corner.y = cy ? scratch.max.y : scratch.min.y;
                corner.z = cz ? scratch.max.z : scratch.min.z;
                rotMat.transformVector3(corner);
                corner.addInPlace(child.localPosition);
                if (corner.x < out.min.x) out.min.x = corner.x;
                if (corner.y < out.min.y) out.min.y = corner.y;
                if (corner.z < out.min.z) out.min.z = corner.z;
                if (corner.x > out.max.x) out.max.x = corner.x;
                if (corner.y > out.max.y) out.max.y = corner.y;
                if (corner.z > out.max.z) out.max.z = corner.z;
            }
        });
    } else if (shape instanceof MeshShape) {
        const a = new Vector3(), b = new Vector3(), c = new Vector3();
        bvh.build(shape.triangleCount, function (out, i) {
            shape.triangleAt(i, a, b, c);
            out.setEmpty();
            out.min.x = Math.min(a.x, b.x, c.x); out.max.x = Math.max(a.x, b.x, c.x);
            out.min.y = Math.min(a.y, b.y, c.y); out.max.y = Math.max(a.y, b.y, c.y);
            out.min.z = Math.min(a.z, b.z, c.z); out.max.z = Math.max(a.z, b.z, c.z);
        });
    }
    shape._midphaseBVH = bvh;
    return bvh;
}

proto._ensureBVH = function (shape) { return ensureShapeBVH(shape); };

// Exposed so Queries.js (ray/shape casts) can reuse the same per-shape tree the midphase builds.
ActionPhysics.ensureShapeBVH = ensureShapeBVH;

// Leaf indices of `shape` whose AABB overlaps `localQueryAABB` (in shape-local space). Cached per
// (other body, shape): expanding one body pair queries many shapes under the same otherBodyId -
// every nested mesh child of a compound ground - so keying on the body alone makes each query evict
// the previous one and the cache never hits.
proto._queryLeaves = function (shape, otherBodyId, localQueryAABB) {
    let byShape = this._leafCache.get(otherBodyId);
    if (byShape === undefined) {
        byShape = new Map();
        this._leafCache.set(otherBodyId, byShape);
    }
    const cached = byShape.get(shape);
    if (cached &&
        cached.minx === localQueryAABB.min.x && cached.miny === localQueryAABB.min.y && cached.minz === localQueryAABB.min.z &&
        cached.maxx === localQueryAABB.max.x && cached.maxy === localQueryAABB.max.y && cached.maxz === localQueryAABB.max.z) {
        return cached.hits; // may be [] - a valid, cached answer
    }
    const bvh = this._ensureBVH(shape);
    const hits = cached ? cached.hits : [];
    hits.length = 0;
    bvh.query(localQueryAABB, function (i) { hits.push(i); });
    if (cached) {
        cached.minx = localQueryAABB.min.x; cached.miny = localQueryAABB.min.y; cached.minz = localQueryAABB.min.z;
        cached.maxx = localQueryAABB.max.x; cached.maxy = localQueryAABB.max.y; cached.maxz = localQueryAABB.max.z;
    } else {
        byShape.set(shape, {
            minx: localQueryAABB.min.x, miny: localQueryAABB.min.y, minz: localQueryAABB.min.z,
            maxx: localQueryAABB.max.x, maxy: localQueryAABB.max.y, maxz: localQueryAABB.max.z,
            hits: hits
        });
    }
    return hits;
};


// ==== src/phases/ExpandPair.js ====
// Expanding a broadphase body pair into primitive-vs-primitive candidates.
var proto = Midphase.prototype;

// Expands one side into primitive candidates. `otherAABB`: the other body's fattened AABB, for
// culling. `otherBodyId`: leaf-cache key. `isNestedChild`: `body` is a compound child's placement
// being recursed into (no speculative margin of its own, so the own-margin fattening is skipped).
// `out`: caller-owned array, reset by the caller; results (including nested recursion) append to it.
proto._expandSide = function (body, otherAABB, otherBodyId, isNestedChild, out, depth) {
    depth = depth || 0;
    const shape = body.shape;
    if (!(shape instanceof CompoundShape) && !(shape instanceof MeshShape)) {
        const slot = this._nextPrimSlot();
        slot.shape = shape;
        slot.position = body.position;
        slot.rotation = body.rotation;
        slot.bodyCenter = null;
        out.push(slot);
        return out;
    }

    // A tiny mesh (one tile of a big CompoundShape ground) doesn't earn a BVH walk: per-triangle
    // culling saves at most a test or two, while the local query AABB plus the tree walk costs more.
    // Still cull the mesh as a whole - a distant one must yield no candidates - but do it with a
    // direct world-space AABB overlap against the shape's own bounds.
    if (shape instanceof MeshShape && shape.triangleCount <= Midphase.SMALL_MESH_TRIS) {
        const bounds = Midphase._scratchSmallAABB;
        shape.localAABBInto(bounds);
        if (!Midphase._worldOverlaps(bounds, body, otherAABB)) return out;
        this._emitTriangles(shape, body, out, null);
        return out;
    }

    // Bring the other body's world AABB into this body's local space by inverse-transforming its 8
    // corners - conservative (may over-include), never under-includes.
    const invRot = Midphase._scratchQuat.copy(body.rotation).invert();
    const localQuery = Midphase._scratchAABB.setEmpty();
    const corner = Midphase._scratchVec;
    for (let cx = 0; cx < 2; cx++) for (let cy = 0; cy < 2; cy++) for (let cz = 0; cz < 2; cz++) {
        corner.x = cx ? otherAABB.max.x : otherAABB.min.x;
        corner.y = cy ? otherAABB.max.y : otherAABB.min.y;
        corner.z = cz ? otherAABB.max.z : otherAABB.min.z;
        corner.subInPlace(body.position);
        invRot.transformVectorInPlace(corner);
        if (corner.x < localQuery.min.x) localQuery.min.x = corner.x;
        if (corner.y < localQuery.min.y) localQuery.min.y = corner.y;
        if (corner.z < localQuery.min.z) localQuery.min.z = corner.z;
        if (corner.x > localQuery.max.x) localQuery.max.x = corner.x;
        if (corner.y > localQuery.max.y) localQuery.max.y = corner.y;
        if (corner.z > localQuery.max.z) localQuery.max.z = corner.z;
    }

    // otherAABB has the other body's margin but not this one's - fatten by this body's own
    // broadphase-vs-tight delta (largest per-axis, so a rotated body isn't under-estimated).
    if (!isNestedChild) {
        const tightAABB = body.getAABB(), bpAABB = body.getBroadphaseAABB();
        const marginX = Math.max(bpAABB.max.x - tightAABB.max.x, tightAABB.min.x - bpAABB.min.x);
        const marginY = Math.max(bpAABB.max.y - tightAABB.max.y, tightAABB.min.y - bpAABB.min.y);
        const marginZ = Math.max(bpAABB.max.z - tightAABB.max.z, tightAABB.min.z - bpAABB.min.z);
        const ownMargin = Math.max(marginX, marginY, marginZ, 0);
        localQuery.min.x -= ownMargin; localQuery.min.y -= ownMargin; localQuery.min.z -= ownMargin;
        localQuery.max.x += ownMargin; localQuery.max.y += ownMargin; localQuery.max.z += ownMargin;
    }

    const hits = this._queryLeaves(shape, otherBodyId, localQuery);
    if (shape instanceof CompoundShape) {
        // Per-depth scratch: this frame keeps reading `body` across iterations, so the callee
        // can't be handed the object we're reading from.
        const nestedBody = this._nestedBodyAt(depth);
        for (let k = 0; k < hits.length; k++) {
            const child = shape.children[hits[k]];
            const slot = this._nextChildSlot();
            body.rotation.transformVectorInto(child.localPosition, slot.position);
            slot.position.addInPlace(body.position);
            slot.rotation.multiplyQuaternions(body.rotation, child.localRotation);
            if (child.shape instanceof MeshShape || child.shape instanceof CompoundShape) {
                // A compound child that is itself a mesh/compound (e.g. a CompoundShape ground
                // made of many small MeshShape tiles) is not itself a primitive - recurse into it
                // at its own world placement, same as expanding a top-level body's shape.
                nestedBody.shape = child.shape;
                nestedBody.position = slot.position;
                nestedBody.rotation = slot.rotation;
                this._expandSide(nestedBody, otherAABB, otherBodyId, true, out, depth + 1);
            } else {
                const prim = this._nextPrimSlot();
                prim.shape = child.shape;
                prim.position = slot.position;
                prim.rotation = slot.rotation;
                prim.bodyCenter = null;
                out.push(prim);
            }
        }
    } else {
        this._emitTriangles(shape, body, out, hits);
    }
    return out;
};

// Appends `shape`'s triangles, baked to world space, into `out`. `hits`: leaf indices to emit, or
// null for all of them.
proto._emitTriangles = function (shape, body, out, hits) {
    const a = Midphase._scratchTriA, b = Midphase._scratchTriB, c = Midphase._scratchTriC;
    const n = hits ? hits.length : shape.triangleCount;
    for (let k = 0; k < n; k++) {
        shape.triangleAt(hits ? hits[k] : k, a, b, c);
        // Baked to world space at identity rotation, so the narrowphase has nothing to undo.
        const slot = this._nextTriSlot();
        body.rotation.transformVectorInto(a, slot.a); slot.a.addInPlace(body.position);
        body.rotation.transformVectorInto(b, slot.b); slot.b.addInPlace(body.position);
        body.rotation.transformVectorInto(c, slot.c); slot.c.addInPlace(body.position);
        slot.shape.a = slot.a; slot.shape.b = slot.b; slot.shape.c = slot.c;
        // position stays at origin (verts are already world-space); bodyCenter is a hint TriTri
        // uses to orient the contact normal.
        slot.bodyCenter.copy(body.position);
        // The slot is already the shape the narrowphase reads - hand it over directly.
        out.push(slot);
    }
};

// Pooled world-space triangle slot, grown as needed. The pool index resets once per expandPair()
// (both sides draw from it).
proto._nextTriSlot = function () {
    if (this._triSlotIndex >= this._triSlots.length) {
        this._triSlots.push({
            a: new Vector3(), b: new Vector3(), c: new Vector3(),
            position: new Vector3(0, 0, 0), rotation: new Quaternion(),
            bodyCenter: new Vector3(), shape: null
        });
        const slot = this._triSlots[this._triSlots.length - 1];
        slot.shape = new TriangleShape(slot.a, slot.b, slot.c);
    }
    return this._triSlots[this._triSlotIndex++];
};

// One pooled { position, rotation } slot for a compound child's world placement, same pooling
// pattern as _nextTriSlot (the child's own shape is reused directly - CompoundShape.children never
// changes at runtime, so child.shape itself needs no pooling).
proto._nextChildSlot = function () {
    if (this._childSlotIndex >= this._childSlots.length) {
        this._childSlots.push({ position: new Vector3(), rotation: new Quaternion() });
    }
    return this._childSlots[this._childSlotIndex++];
};

// Pooled placement for a non-triangle primitive. Holds references to vectors owned elsewhere.
proto._nextPrimSlot = function () {
    if (this._primSlotIndex >= this._primSlots.length) {
        this._primSlots.push({ shape: null, position: null, rotation: null, bodyCenter: null });
    }
    return this._primSlots[this._primSlotIndex++];
};

// Scratch placement for recursing into a nested compound child, one per depth.
proto._nestedBodyAt = function (depth) {
    while (this._nestedBodies.length <= depth) {
        this._nestedBodies.push({ shape: null, position: null, rotation: null });
    }
    return this._nestedBodies[depth];
};

// Expands a broadphase pair into the two sides' primitive lists; the candidate set is their
// cross-product, which callers walk directly instead of materialising it.
//
// Returns a reused { a, b } - arrays and placements are pooled and valid only until the next call.
proto.expandPairSides = function (bodyA, bodyB) {
    // Both sides draw from the same pools, so they reset once here, not per side.
    this._triSlotIndex = 0;
    this._childSlotIndex = 0;
    this._primSlotIndex = 0;
    const sides = this._sides;
    sides.a.length = 0;
    sides.b.length = 0;
    // The fattened broadphase AABB is used for child/triangle culling too, so a compound child or
    // mesh triangle a body is about to reach surfaces the same tick early as the body pair itself.
    this._expandSide(bodyA, bodyB.getBroadphaseAABB(), bodyB.id, false, sides.a, 0);
    this._expandSide(bodyB, bodyA.getBroadphaseAABB(), bodyA.id, false, sides.b, 0);
    return sides;
};

// Materialised cross-product form of expandPairSides, for external callers and tests.
proto.expandPair = function (bodyA, bodyB) {
    const sides = this.expandPairSides(bodyA, bodyB);
    const out = [];
    for (let i = 0; i < sides.a.length; i++) {
        for (let j = 0; j < sides.b.length; j++) {
            out.push({ a: sides.a[i], b: sides.b[j] });
        }
    }
    return out;
};

// Does `local` (a shape-local AABB placed at `body`) overlap the world-space `otherAABB`? The
// local box is rotated into world space by its 8 corners - conservative, never under-includes.
Midphase._worldOverlaps = function (local, body, otherAABB) {
    const rot = body.rotation, pos = body.position;
    const corner = Midphase._scratchVec;
    let minx = Infinity, miny = Infinity, minz = Infinity;
    let maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
    for (let cx = 0; cx < 2; cx++) for (let cy = 0; cy < 2; cy++) for (let cz = 0; cz < 2; cz++) {
        corner.set(cx ? local.max.x : local.min.x, cy ? local.max.y : local.min.y, cz ? local.max.z : local.min.z);
        rot.transformVectorInPlace(corner);
        corner.addInPlace(pos);
        if (corner.x < minx) minx = corner.x;
        if (corner.y < miny) miny = corner.y;
        if (corner.z < minz) minz = corner.z;
        if (corner.x > maxx) maxx = corner.x;
        if (corner.y > maxy) maxy = corner.y;
        if (corner.z > maxz) maxz = corner.z;
    }
    return maxx >= otherAABB.min.x && minx <= otherAABB.max.x &&
        maxy >= otherAABB.min.y && miny <= otherAABB.max.y &&
        maxz >= otherAABB.min.z && minz <= otherAABB.max.z;
};

Midphase._scratchSmallAABB = new AABB();
Midphase._scratchQuat = new Quaternion();
Midphase._scratchAABB = new AABB();
Midphase._scratchVec = new Vector3();
// Local-space triangle vertices, read fresh from shape.triangleAt() each hit, then transformed
// into that hit's own pooled world-space slot - see _nextTriSlot.
Midphase._scratchTriA = new Vector3();
Midphase._scratchTriB = new Vector3();
Midphase._scratchTriC = new Vector3();


// ==== src/collision/MinkowskiSupport.js ====
// World-space support over the Minkowski difference A-B of two placed { shape, position, rotation }
// sides. supportA(d) - supportB(-d), each side rotated local->world via its inverse rotation.
// Allocation-free: writes into caller-owned `out`; one instance reused per narrowphase pair.
class MinkowskiSupport {
    constructor(placedA, placedB) {
        this.a = placedA;
        this.b = placedB;
        this._localDir = new Vector3();
        this._invRotA = new Quaternion();
        this._invRotB = new Quaternion();
        this._invRotA.copy(placedA.rotation).invert();
        this._invRotB.copy(placedB.rotation).invert();
        // Per-instance, never shared - a shared scratch would corrupt a still-live prior result.
        this._scratchA = new Vector3();
        this._scratchB = new Vector3();
        this._scratchNeg = new Vector3();
    }

    // Re-derives cached inverse rotations after a placed side's rotation is mutated in place.
    refresh() {
        this._invRotA.copy(this.a.rotation).invert();
        this._invRotB.copy(this.b.rotation).invert();
        return this;
    }

    // Rebinds this instance to a different pair (e.g. reused across pairs within one tick) and
    // re-derives the cached inverse rotations for the new sides.
    setSides(placedA, placedB) {
        this.a = placedA;
        this.b = placedB;
        return this.refresh();
    }

    // World-space support of one placed side along world direction `dir`.
    static supportOfInto(out, placed, invRot, dir, scratchDir) {
        invRot.transformVectorInto(dir, scratchDir);
        placed.shape.supportInto(out, scratchDir);
        placed.rotation.transformVectorInPlace(out);
        out.addInPlace(placed.position);
        return out;
    }

    // out = supportA(dir) - supportB(-dir). outA/outB (optional) get the world witness points -
    // EPA needs those per vertex to recover contact points once the winning face is known.
    supportInto(out, dir, outA, outB) {
        const sa = outA || this._scratchA;
        const sb = outB || this._scratchB;
        MinkowskiSupport.supportOfInto(sa, this.a, this._invRotA, dir, this._localDir);
        const negDir = this._scratchNeg.set(-dir.x, -dir.y, -dir.z);
        MinkowskiSupport.supportOfInto(sb, this.b, this._invRotB, negDir, this._localDir);
        Vector3.subInto(out, sa, sb);
        return out;
    }
}

ActionPhysics.MinkowskiSupport = MinkowskiSupport;


// ==== src/collision/GJK.js ====
// GJK distance/overlap test via the Minkowski difference (Ericson ch. 5). Two outcomes: OVERLAPPING
// (handed to EPA) or SEPARATED (distance, witness points, normal). Exact-touch cases are handled by
// degenerate fallbacks in the simplex routines rather than producing NaN. See Seeding.js,
// Simplex.js, Run.js.
class GJK {
    constructor() {
        // Simplex: up to 4 points, each (w = Minkowski diff point, a/b = world points on A/B).
        this._wx = new Float64Array(4); this._wy = new Float64Array(4); this._wz = new Float64Array(4);
        this._ax = new Float64Array(4); this._ay = new Float64Array(4); this._az = new Float64Array(4);
        this._bx = new Float64Array(4); this._by = new Float64Array(4); this._bz = new Float64Array(4);
        this._count = 0;

        this._dir = new Vector3();
        this._newW = new Vector3();
        this._newA = new Vector3();
        this._newB = new Vector3();
        this._closest = new Vector3();
        this._scratchRef = new Vector3();
        this._initialProbeDir = new Vector3();
        this._newDir4 = new Vector3();
        this._probeDir = new Vector3();
        this._probeW = new Vector3();
    }

    _clear() { this._count = 0; }

    _push(w, a, b) {
        const i = this._count++;
        this._wx[i] = w.x; this._wy[i] = w.y; this._wz[i] = w.z;
        this._ax[i] = a.x; this._ay[i] = a.y; this._az[i] = a.z;
        this._bx[i] = b.x; this._by[i] = b.y; this._bz[i] = b.z;
    }

    // Keep only the points at `indices`, after a closest-feature reduction.
    _reduceTo(indices) {
        const wx = this._wx.slice(), wy = this._wy.slice(), wz = this._wz.slice();
        const ax = this._ax.slice(), ay = this._ay.slice(), az = this._az.slice();
        const bx = this._bx.slice(), by = this._by.slice(), bz = this._bz.slice();
        for (let k = 0; k < indices.length; k++) {
            const src = indices[k];
            this._wx[k] = wx[src]; this._wy[k] = wy[src]; this._wz[k] = wz[src];
            this._ax[k] = ax[src]; this._ay[k] = ay[src]; this._az[k] = az[src];
            this._bx[k] = bx[src]; this._by[k] = by[src]; this._bz[k] = bz[src];
        }
        this._count = indices.length;
    }
}

// Closest-distance below which a stalled walk is treated as overlapping rather than separated.
GJK.OVERLAP_DISTANCE_EPSILON = 1e-5;

ActionPhysics.GJK = GJK;


// ==== src/collision/Seeding.js ====
// Tetrahedron seeding + strict-interior probe. Seeding from several diverse direction sets, rather
// than growing one incrementally, tells a real 3D overlap apart from an exact touch (incremental
// growth stalls in the touching plane).
var proto = GJK.prototype;

// Multiple sets because any single one can produce a degenerate seed for some shape-size pair. The
// irrational-looking components avoid support ties on sparse hulls (e.g. two coincident octahedra).
GJK.SEED_DIRECTION_SETS = [
    [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
    [[1, 1, -1], [1, -1, 1], [-1, 1, 1], [-1, -1, -1]],
    [[1, 0, 0], [-1, 0.3, 0.3], [0, -1, 0.3], [0, 0.3, -1]],
    [[0.8763, 0.2451, 0.4127], [0.3312, -0.9021, 0.2734], [-0.6543, 0.1298, -0.7452], [-0.5532, -0.6789, 0.4821]]
];

// The 6 signed axes span every face normal of an axis-aligned contact, for the strict-interior
// probe below; the search direction itself is probed separately for oblique contacts.
GJK.INTERIOR_PROBE_DIRS = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
];

// Tries each seed set. Returns { overlapping: true } on a confirmed enclosing tetrahedron, else
// { overlapping: false, direction, closest } from whichever seed's reduction got closest to the origin.
proto._seedTetrahedron = function (support) {
    let bestDistSq = Infinity, bestSet = -1;
    for (let s = 0; s < GJK.SEED_DIRECTION_SETS.length; s++) {
        this._clear();
        const dirs = GJK.SEED_DIRECTION_SETS[s];
        for (let i = 0; i < 4; i++) {
            const d = dirs[i];
            this._newDir4.set(d[0], d[1], d[2]);
            support.supportInto(this._newW, this._newDir4, this._newA, this._newB);
            this._push(this._newW, this._newA, this._newB);
        }
        const result = this._simplexTetrahedron();
        if (result.containsOrigin) return { overlapping: true, simplex: this };
        const distSq = result.closest.x * result.closest.x + result.closest.y * result.closest.y + result.closest.z * result.closest.z;
        if (distSq < bestDistSq) { bestDistSq = distSq; bestSet = s; }
    }
    // Re-run the best set to restore its simplex/direction/closest as the live state.
    this._clear();
    const bestDirs = GJK.SEED_DIRECTION_SETS[bestSet];
    for (let i = 0; i < 4; i++) {
        const d = bestDirs[i];
        this._newDir4.set(d[0], d[1], d[2]);
        support.supportInto(this._newW, this._newDir4, this._newA, this._newB);
        this._push(this._newW, this._newA, this._newB);
    }
    const finalResult = this._simplexTetrahedron();
    return { overlapping: false, direction: finalResult.direction, closest: finalResult.closest };
};

// True iff the origin is strictly inside the Minkowski difference (real penetration) vs merely on
// its boundary (exact touch), tested by checking the support extent exceeds a margin in every
// probe direction.
proto._originStrictlyInside = function (support) {
    const margin = GJK.OVERLAP_DISTANCE_EPSILON;
    // The collapsed search direction is numerically along the contact normal - test it first, both signs.
    if (this._closest.lengthSquared() > 1e-20) {
        const l = Math.sqrt(this._closest.lengthSquared());
        this._probeDir.set(this._closest.x / l, this._closest.y / l, this._closest.z / l);
        if (!this._supportExceeds(support, this._probeDir, margin)) return false;
        this._probeDir.set(-this._probeDir.x, -this._probeDir.y, -this._probeDir.z);
        if (!this._supportExceeds(support, this._probeDir, margin)) return false;
    }
    for (let a = 0; a < GJK.INTERIOR_PROBE_DIRS.length; a++) {
        const d = GJK.INTERIOR_PROBE_DIRS[a];
        this._probeDir.set(d[0], d[1], d[2]);
        if (!this._supportExceeds(support, this._probeDir, margin)) return false;
    }
    return true;
};

// support(dir).dir > margin? (margin scaled by |dir| so the comparison is a true distance along dir.)
proto._supportExceeds = function (support, dir, margin) {
    support.supportInto(this._probeW, dir);
    const along = this._probeW.x * dir.x + this._probeW.y * dir.y + this._probeW.z * dir.z;
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
    return along > margin * len;
};


// ==== src/collision/Simplex.js ====
// Simplex reduction: closest point to the origin for a 2/3/4-point simplex, with degenerate
// fallbacks so a flush contact never produces NaN.
var proto = GJK.prototype;

// Dispatches by point count; a 4-point simplex either encloses the origin or reduces to a triangle.
proto._doSimplex = function () {
    if (this._count === 2) return this._simplexLine();
    if (this._count === 3) return this._simplexTriangle();
    return this._simplexTetrahedron();
};

// Closest point on segment AB to the origin. Degenerate (coincident A/B) falls back to A.
proto._simplexLine = function () {
    const ax = this._wx[0], ay = this._wy[0], az = this._wz[0];
    const bx = this._wx[1], by = this._wy[1], bz = this._wz[1];
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const lenSq = abx * abx + aby * aby + abz * abz;

    let t;
    if (lenSq < 1e-20) t = 0;
    else {
        t = -(ax * abx + ay * aby + az * abz) / lenSq;
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
    }

    const closest = new Vector3(ax + abx * t, ay + aby * t, az + abz * t);
    if (t <= 0) this._reduceTo([0]);
    else if (t >= 1) this._reduceTo([1]);

    // Origin exactly on the segment -> direction is (0,0,0), reported as a zero-distance touch by run().
    const dir = new Vector3(-closest.x, -closest.y, -closest.z);
    return { containsOrigin: false, direction: dir, closest: closest };
};

proto._simplexTriangle = function () {
    const ax = this._wx[0], ay = this._wy[0], az = this._wz[0];
    const bx = this._wx[1], by = this._wy[1], bz = this._wz[1];
    const cx = this._wx[2], cy = this._wy[2], cz = this._wz[2];
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    const nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
    const nLenSq = nx * nx + ny * ny + nz * nz;

    if (nLenSq < 1e-20) return this._degenerateTriangleFallback(); // three (near-)collinear points

    const closest = GJK._closestPointOnTriangleToOrigin(ax, ay, az, bx, by, bz, cx, cy, cz, nx, ny, nz, nLenSq);
    const dir = new Vector3(-closest.x, -closest.y, -closest.z);

    if (closest.onEdge !== null) this._reduceTo(closest.onEdge);
    return { containsOrigin: false, direction: dir, closest: new Vector3(closest.x, closest.y, closest.z) };
};

// Zero-area triangle: pick whichever of its three edges (as a 2-point simplex) is truly closest
// to the origin, tested directly.
proto._degenerateTriangleFallback = function () {
    const pts = [
        [this._wx[0], this._wy[0], this._wz[0]],
        [this._wx[1], this._wy[1], this._wz[1]],
        [this._wx[2], this._wy[2], this._wz[2]]
    ];
    const edges = [[0, 1], [1, 2], [2, 0]];
    let best = null, bestDistSq = Infinity, bestIdx = null;
    for (let e = 0; e < 3; e++) {
        const p0 = pts[edges[e][0]], p1 = pts[edges[e][1]];
        const abx = p1[0] - p0[0], aby = p1[1] - p0[1], abz = p1[2] - p0[2];
        const lenSq = abx * abx + aby * aby + abz * abz;
        let t = lenSq < 1e-20 ? 0 : (-(p0[0] * abx + p0[1] * aby + p0[2] * abz) / lenSq);
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
        const cx = p0[0] + abx * t, cy = p0[1] + aby * t, cz = p0[2] + abz * t;
        const dSq = cx * cx + cy * cy + cz * cz;
        if (dSq < bestDistSq) { bestDistSq = dSq; best = [cx, cy, cz]; bestIdx = t <= 0 ? [edges[e][0]] : (t >= 1 ? [edges[e][1]] : edges[e]); }
    }
    this._reduceTo(bestIdx);
    const dir = new Vector3(-best[0], -best[1], -best[2]);
    return { containsOrigin: false, direction: dir, closest: new Vector3(best[0], best[1], best[2]) };
};

proto._simplexTetrahedron = function () {
    // The 4 distinct faces of tetrahedron {0,1,2,3}, each with its opposite vertex.
    const idx = [[0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 3, 1], [1, 2, 3, 0]];
    for (let f = 0; f < 4; f++) {
        const [ia, ib, ic, id] = idx[f];
        const ax = this._wx[ia], ay = this._wy[ia], az = this._wz[ia];
        const bx = this._wx[ib], by = this._wy[ib], bz = this._wz[ib];
        const cx = this._wx[ic], cy = this._wy[ic], cz = this._wz[ic];
        const dx = this._wx[id], dy = this._wy[id], dz = this._wz[id];
        const abx = bx - ax, aby = by - ay, abz = bz - az;
        const acx = cx - ax, acy = cy - ay, acz = cz - az;
        let nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
        const nLenSq = nx * nx + ny * ny + nz * nz;
        if (nLenSq < 1e-20) continue; // degenerate face: another face decides

        // Orient the normal away from the opposite point.
        const toD = (dx - ax) * nx + (dy - ay) * ny + (dz - az) * nz;
        if (toD > 0) { nx = -nx; ny = -ny; nz = -nz; }
        const toOriginRaw = -ax * nx - ay * ny - az * nz;
        // Signed DISTANCE (not raw dot) - |n| scales with the face's own size, so a raw-dot epsilon
        // gives a different real-world tolerance per shape pair.
        const signedDist = toOriginRaw / Math.sqrt(nLenSq);
        // Threshold is negative, not zero: a face the origin sits exactly ON (an exact touch) must
        // not count as enclosure, only strictly-behind does.
        if (signedDist > -1e-9) {
            this._reduceTo([ia, ib, ic]);
            return this._simplexTriangle();
        }
    }
    // Inside every face. Confirm the tetrahedron isn't itself near-degenerate (near-coplanar
    // points can pass every per-face test without genuinely surrounding the origin in 3D).
    const v0x = this._wx[1] - this._wx[0], v0y = this._wy[1] - this._wy[0], v0z = this._wz[1] - this._wz[0];
    const v1x = this._wx[2] - this._wx[0], v1y = this._wy[2] - this._wy[0], v1z = this._wz[2] - this._wz[0];
    const v2x = this._wx[3] - this._wx[0], v2y = this._wy[3] - this._wy[0], v2z = this._wz[3] - this._wz[0];
    const cxv = v1y * v2z - v1z * v2y, cyv = v1z * v2x - v1x * v2z, czv = v1x * v2y - v1y * v2x;
    const volume6 = Math.abs(v0x * cxv + v0y * cyv + v0z * czv);
    const extentSq = Math.max(v0x*v0x+v0y*v0y+v0z*v0z, v1x*v1x+v1y*v1y+v1z*v1z, v2x*v2x+v2y*v2y+v2z*v2z);
    if (volume6 * volume6 < 1e-12 * extentSq * extentSq * extentSq) {
        this._reduceTo([0, 1, 2]);
        return this._simplexTriangle();
    }
    return { containsOrigin: true, direction: null, closest: null };
};

// Closest point on triangle ABC to the origin, given its (non-unit) normal N and |N|^2. Returns
// { x,y,z, onEdge: null|[indices] } - onEdge non-null means the closest feature is a vertex/edge.
GJK._closestPointOnTriangleToOrigin = function (ax, ay, az, bx, by, bz, cx, cy, cz, nx, ny, nz, nLenSq) {
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    const apx = -ax, apy = -ay, apz = -az;

    const d1 = abx * apx + aby * apy + abz * apz;
    const d2 = acx * apx + acy * apy + acz * apz;
    if (d1 <= 0 && d2 <= 0) return { x: ax, y: ay, z: az, onEdge: [0] };

    const bpx = -bx, bpy = -by, bpz = -bz;
    const d3 = abx * bpx + aby * bpy + abz * bpz;
    const d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) return { x: bx, y: by, z: bz, onEdge: [1] };

    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        const t = d1 / (d1 - d3);
        return { x: ax + abx * t, y: ay + aby * t, z: az + abz * t, onEdge: [0, 1] };
    }

    const cpx = -cx, cpy = -cy, cpz = -cz;
    const d5 = abx * cpx + aby * cpy + abz * cpz;
    const d6 = acx * cpx + acy * cpy + acz * cpz;
    if (d6 >= 0 && d5 <= d6) return { x: cx, y: cy, z: cz, onEdge: [2] };

    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
        const t = d2 / (d2 - d6);
        return { x: ax + acx * t, y: ay + acy * t, z: az + acz * t, onEdge: [0, 2] };
    }

    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
        const t = (d4 - d3) / ((d4 - d3) + (d5 - d6));
        return { x: bx + (cx - bx) * t, y: by + (cy - by) * t, z: bz + (cz - bz) * t, onEdge: [1, 2] };
    }

    // Interior: project the origin onto the triangle's plane along its normal.
    const k = (ax * nx + ay * ny + az * nz) / nLenSq;
    return { x: nx * k, y: ny * k, z: nz * k, onEdge: null };
};


// ==== src/collision/Run.js ====
// The main GJK loop, plus building the SEPARATED result from a converged simplex.
var proto = GJK.prototype;

/**
 * Runs GJK for the pair of placed shapes wrapped by `support` (a MinkowskiSupport). Returns:
 *   { overlapping: true,  simplex: this }                            -> hand to EPA
 *   { overlapping: false, distance, normal, pointA, pointB }         -> separated
 * `normal` points from B to A (world space). maxIterations guards non-convergence; hitting it
 * returns the best answer found so far, reported honestly as separated.
 */
proto.run = function (support, maxIterations) {
    maxIterations = maxIterations || 64;
    this._clear();

    // Seed a tetrahedron from diverse directions (see Seeding.js). If none encloses, its best
    // reduction seeds the incremental loop below.
    let seeded = this._seedTetrahedron(support);
    if (seeded.overlapping) return seeded;
    this._dir.copy(seeded.direction);
    this._closest.copy(seeded.closest);

    if (this._dir.lengthSquared() < 1e-20) {
        // Origin lies on the Minkowski-difference boundary - either an exact touch or a shallow
        // penetration the seed tetrahedra couldn't enclose. Disambiguate via strict interiority.
        return this._originStrictlyInside(support) ? { overlapping: true, simplex: this } : this._separatedResult(support);
    }

    for (let iter = 0; iter < maxIterations; iter++) {
        support.supportInto(this._newW, this._dir, this._newA, this._newB);

        // Standard GJK termination (Ericson 5.4): no progress if the new support doesn't project
        // further along `dir` than the simplex already does.
        const newAlong = this._newW.x * this._dir.x + this._newW.y * this._dir.y + this._newW.z * this._dir.z;
        let bestAlong = -Infinity;
        for (let k = 0; k < this._count; k++) {
            const along = this._wx[k] * this._dir.x + this._wy[k] * this._dir.y + this._wz[k] * this._dir.z;
            if (along > bestAlong) bestAlong = along;
        }
        if (newAlong <= bestAlong + 1e-10) {
            // Stall. Near-zero closest distance means the origin is on/inside the boundary - defer
            // to the strict-interior check; otherwise separated.
            const closestDistSq = this._closest.x * this._closest.x + this._closest.y * this._closest.y + this._closest.z * this._closest.z;
            if (closestDistSq < GJK.OVERLAP_DISTANCE_EPSILON * GJK.OVERLAP_DISTANCE_EPSILON) {
                return this._originStrictlyInside(support) ? { overlapping: true, simplex: this } : this._separatedResult(support);
            }
            return this._separatedResult(support);
        }

        this._push(this._newW, this._newA, this._newB);

        const result = this._doSimplex();
        if (result.containsOrigin) return { overlapping: true, simplex: this };
        this._dir.copy(result.direction);
        this._closest.copy(result.closest);

        if (this._dir.lengthSquared() < 1e-20) {
            return this._originStrictlyInside(support) ? { overlapping: true, simplex: this } : this._separatedResult(support);
        }
    }
    return this._separatedResult(support); // iteration cap - report honestly as separated
};

// SEPARATED result from the simplex's closest point to the origin. Witness points are recovered
// from barycentric weights on the stored support points, so they stay consistent with `distance`.
proto._separatedResult = function (support, forcedNormal) {
    const bary = this._barycentricOfClosest();
    const pointA = new Vector3(), pointB = new Vector3();
    for (let i = 0; i < this._count; i++) {
        pointA.x += bary[i] * this._ax[i]; pointA.y += bary[i] * this._ay[i]; pointA.z += bary[i] * this._az[i];
        pointB.x += bary[i] * this._bx[i]; pointB.y += bary[i] * this._by[i]; pointB.z += bary[i] * this._bz[i];
    }
    const dist = Math.sqrt(this._closest.x * this._closest.x + this._closest.y * this._closest.y + this._closest.z * this._closest.z);
    let normal;
    if (forcedNormal) {
        normal = new Vector3().copy(forcedNormal).normalizeInPlace();
    } else if (dist > 1e-12) {
        normal = new Vector3(this._closest.x / dist, this._closest.y / dist, this._closest.z / dist);
    } else {
        // Exact touching: `closest` carries no direction. Recover a normal from the simplex's own
        // geometry instead of a fixed axis.
        normal = new Vector3();
        this._degenerateTouchingNormalInto(normal);
    }
    return { overlapping: false, distance: dist, normal: normal, pointA: pointA, pointB: pointB };
};

// Recovers a normal for a zero-distance (exact touching) simplex. A 3-point simplex through the
// origin has a well-defined plane normal; a 2- or 1-point simplex falls back to findOrthogonal()
// (never NaN, even though not always the true contact normal for that degenerate case).
proto._degenerateTouchingNormalInto = function (out) {
    if (this._count === 3) {
        const abx = this._wx[1] - this._wx[0], aby = this._wy[1] - this._wy[0], abz = this._wz[1] - this._wz[0];
        const acx = this._wx[2] - this._wx[0], acy = this._wy[2] - this._wy[0], acz = this._wz[2] - this._wz[0];
        out.x = aby * acz - abz * acy; out.y = abz * acx - abx * acz; out.z = abx * acy - aby * acx;
        const lenSq = out.x * out.x + out.y * out.y + out.z * out.z;
        if (lenSq > 1e-20) { out.scaleInPlace(1 / Math.sqrt(lenSq)); return; }
    }
    this._scratchRef.set(this._wx[0], this._wy[0], this._wz[0]);
    out.findOrthogonal(this._scratchRef);
};

// Barycentric weights of `this._closest` w.r.t. the current simplex (1-3 points). Degenerate
// simplices fall back explicitly rather than dividing by zero.
proto._barycentricOfClosest = function () {
    if (this._count === 1) return [1];
    if (this._count === 2) {
        const abx = this._wx[1] - this._wx[0], aby = this._wy[1] - this._wy[0], abz = this._wz[1] - this._wz[0];
        const lenSq = abx * abx + aby * aby + abz * abz;
        if (lenSq < 1e-20) return [1, 0];
        const apx = this._closest.x - this._wx[0], apy = this._closest.y - this._wy[0], apz = this._closest.z - this._wz[0];
        let t = (apx * abx + apy * aby + apz * abz) / lenSq;
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
        return [1 - t, t];
    }
    // count === 3: barycentric of a point already known to be in the triangle's plane.
    const v0x = this._wx[1] - this._wx[0], v0y = this._wy[1] - this._wy[0], v0z = this._wz[1] - this._wz[0];
    const v1x = this._wx[2] - this._wx[0], v1y = this._wy[2] - this._wy[0], v1z = this._wz[2] - this._wz[0];
    const v2x = this._closest.x - this._wx[0], v2y = this._closest.y - this._wy[0], v2z = this._closest.z - this._wz[0];
    const d00 = v0x * v0x + v0y * v0y + v0z * v0z;
    const d01 = v0x * v1x + v0y * v1y + v0z * v1z;
    const d11 = v1x * v1x + v1y * v1y + v1z * v1z;
    const d20 = v2x * v0x + v2y * v0y + v2z * v0z;
    const d21 = v2x * v1x + v2y * v1y + v2z * v1z;
    const denom = d00 * d11 - d01 * d01;
    if (Math.abs(denom) < 1e-20) return [1 / 3, 1 / 3, 1 / 3];
    const v = (d11 * d20 - d01 * d21) / denom;
    const w = (d00 * d21 - d01 * d20) / denom;
    const u = 1 - v - w;
    return [u, v, w];
};


// ==== src/collision/EPA.js ====
// EPA: penetration depth, normal (B->A), and witness points from a GJK simplex that already
// encloses the origin (van den Bergen). See InitialTetrahedron.js and Expand.js.
class EPA {
    constructor() {
        // Polytope vertices, parallel arrays like GJK's. Capacity grows geometrically.
        this._capacity = 64;
        this._wx = new Float64Array(this._capacity); this._wy = new Float64Array(this._capacity); this._wz = new Float64Array(this._capacity);
        this._ax = new Float64Array(this._capacity); this._ay = new Float64Array(this._capacity); this._az = new Float64Array(this._capacity);
        this._bx = new Float64Array(this._capacity); this._by = new Float64Array(this._capacity); this._bz = new Float64Array(this._capacity);
        this._vertexCount = 0;

        // Faces: index triples + outward normal + distance-to-origin. Removed faces are marked dead
        // (faceAlive), not spliced, to avoid reindexing.
        this._faceCapacity = 128;
        this._faceA = new Int32Array(this._faceCapacity);
        this._faceB = new Int32Array(this._faceCapacity);
        this._faceC = new Int32Array(this._faceCapacity);
        this._faceNx = new Float64Array(this._faceCapacity);
        this._faceNy = new Float64Array(this._faceCapacity);
        this._faceNz = new Float64Array(this._faceCapacity);
        this._faceDist = new Float64Array(this._faceCapacity);
        this._faceAlive = new Uint8Array(this._faceCapacity);
        this._faceCount = 0;

        this._newW = new Vector3();
        this._newA = new Vector3();
        this._newB = new Vector3();
        this._dirScratch = new Vector3();
    }

    _growVertices() {
        const cap = this._capacity * 2;
        const grow = (arr) => { const n = new arr.constructor(cap); n.set(arr); return n; };
        this._wx = grow(this._wx); this._wy = grow(this._wy); this._wz = grow(this._wz);
        this._ax = grow(this._ax); this._ay = grow(this._ay); this._az = grow(this._az);
        this._bx = grow(this._bx); this._by = grow(this._by); this._bz = grow(this._bz);
        this._capacity = cap;
    }

    _growFaces() {
        const cap = this._faceCapacity * 2;
        const grow = (arr) => { const n = new arr.constructor(cap); n.set(arr); return n; };
        this._faceA = grow(this._faceA); this._faceB = grow(this._faceB); this._faceC = grow(this._faceC);
        this._faceNx = grow(this._faceNx); this._faceNy = grow(this._faceNy); this._faceNz = grow(this._faceNz);
        this._faceDist = grow(this._faceDist);
        this._faceAlive = grow(this._faceAlive);
        this._faceCapacity = cap;
    }

    _pushVertex(w, a, b) {
        if (this._vertexCount >= this._capacity) this._growVertices();
        const i = this._vertexCount++;
        this._wx[i] = w.x; this._wy[i] = w.y; this._wz[i] = w.z;
        this._ax[i] = a.x; this._ay[i] = a.y; this._az[i] = a.z;
        this._bx[i] = b.x; this._by[i] = b.y; this._bz[i] = b.z;
        return i;
    }

    // Adds a face from three vertex indices, oriented outward from `centroidHint`. Returns the new
    // face's index, or -1 if the three points are degenerate (collinear/zero area) - skipped
    // rather than added with an undefined normal.
    _addFace(ia, ib, ic, centroidHint) {
        const ax = this._wx[ia], ay = this._wy[ia], az = this._wz[ia];
        const bx = this._wx[ib], by = this._wy[ib], bz = this._wz[ib];
        const cx = this._wx[ic], cy = this._wy[ic], cz = this._wz[ic];
        const abx = bx - ax, aby = by - ay, abz = bz - az;
        const acx = cx - ax, acy = cy - ay, acz = cz - az;
        let nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
        const nLenSq = nx * nx + ny * ny + nz * nz;
        if (nLenSq < 1e-20) return -1;

        const invLen = 1 / Math.sqrt(nLenSq);
        nx *= invLen; ny *= invLen; nz *= invLen;

        const toHint = (centroidHint.x - ax) * nx + (centroidHint.y - ay) * ny + (centroidHint.z - az) * nz;
        if (toHint > 0) { nx = -nx; ny = -ny; nz = -nz; }

        const dist = ax * nx + ay * ny + az * nz;

        if (this._faceCount >= this._faceCapacity) this._growFaces();
        const fi = this._faceCount++;
        this._faceA[fi] = ia; this._faceB[fi] = ib; this._faceC[fi] = ic;
        this._faceNx[fi] = nx; this._faceNy[fi] = ny; this._faceNz[fi] = nz;
        this._faceDist[fi] = dist;
        this._faceAlive[fi] = 1;
        return fi;
    }
}

ActionPhysics.EPA = EPA;


// ==== src/collision/InitialTetrahedron.js ====
// Grows GJK's simplex (which may be as few as 1 point) into a full non-degenerate tetrahedron for
// EPA, one dimension at a time via Minkowski support points.
var proto = EPA.prototype;

proto._buildInitialTetrahedron = function (support, simplex) {
    this._vertexCount = 0;
    const n = simplex._count !== undefined ? simplex._count : 4;
    for (let i = 0; i < n; i++) {
        this._pushVertex(
            { x: simplex._wx[i], y: simplex._wy[i], z: simplex._wz[i] },
            { x: simplex._ax[i], y: simplex._ay[i], z: simplex._az[i] },
            { x: simplex._bx[i], y: simplex._by[i], z: simplex._bz[i] }
        );
    }
    const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [0, 1, 1], [1, 0, 1]];

    // 1 point -> 2: add a support along any axis that gives a distinct point.
    if (this._vertexCount === 1) {
        for (let a = 0; a < AXES.length && this._vertexCount < 2; a++) {
            for (let s = -1; s <= 1 && this._vertexCount < 2; s += 2) {
                this._dirScratch.set(AXES[a][0] * s, AXES[a][1] * s, AXES[a][2] * s);
                support.supportInto(this._newW, this._dirScratch, this._newA, this._newB);
                if (this._distinctFrom(0)) this._pushVertex(this._newW, this._newA, this._newB);
            }
        }
        if (this._vertexCount < 2) return false;
    }
    // 2 points -> 3: add a support perpendicular to the segment.
    if (this._vertexCount === 2) {
        const ex = this._wx[1] - this._wx[0], ey = this._wy[1] - this._wy[0], ez = this._wz[1] - this._wz[0];
        for (let a = 0; a < AXES.length && this._vertexCount < 3; a++) {
            let dx = AXES[a][0], dy = AXES[a][1], dz = AXES[a][2];
            const dot = (dx * ex + dy * ey + dz * ez) / (ex * ex + ey * ey + ez * ez + 1e-30);
            dx -= dot * ex; dy -= dot * ey; dz -= dot * ez;
            if (dx * dx + dy * dy + dz * dz < 1e-12) continue;
            for (let s = -1; s <= 1 && this._vertexCount < 3; s += 2) {
                this._dirScratch.set(dx * s, dy * s, dz * s);
                support.supportInto(this._newW, this._dirScratch, this._newA, this._newB);
                if (this._notCollinear(0, 1)) this._pushVertex(this._newW, this._newA, this._newB);
            }
        }
        if (this._vertexCount < 3) return false;
    }
    // 3 points -> 4: add support along the triangle normal (both sides).
    if (this._vertexCount === 3) {
        const ax = this._wx[0], ay = this._wy[0], az = this._wz[0];
        const abx = this._wx[1] - ax, aby = this._wy[1] - ay, abz = this._wz[1] - az;
        const acx = this._wx[2] - ax, acy = this._wy[2] - ay, acz = this._wz[2] - az;
        let nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (nl < 1e-12) return false; // triangle itself degenerate
        nx /= nl; ny /= nl; nz /= nl;
        for (let s = -1; s <= 1 && this._vertexCount < 4; s += 2) {
            this._dirScratch.set(nx * s, ny * s, nz * s);
            support.supportInto(this._newW, this._dirScratch, this._newA, this._newB);
            if (this._offPlane(0, 1, 2)) this._pushVertex(this._newW, this._newA, this._newB);
        }
        if (this._vertexCount < 4) return false;
    }
    return this._vertexCount >= 4;
};

proto._distinctFrom = function (i) {
    const dx = this._newW.x - this._wx[i], dy = this._newW.y - this._wy[i], dz = this._newW.z - this._wz[i];
    return dx * dx + dy * dy + dz * dz > 1e-10;
};
proto._notCollinear = function (i, j) {
    const ex = this._wx[j] - this._wx[i], ey = this._wy[j] - this._wy[i], ez = this._wz[j] - this._wz[i];
    const fx = this._newW.x - this._wx[i], fy = this._newW.y - this._wy[i], fz = this._newW.z - this._wz[i];
    const cx = ey * fz - ez * fy, cy = ez * fx - ex * fz, cz = ex * fy - ey * fx;
    return cx * cx + cy * cy + cz * cz > 1e-12;
};
proto._offPlane = function (i, j, k) {
    const ax = this._wx[i], ay = this._wy[i], az = this._wz[i];
    const abx = this._wx[j] - ax, aby = this._wy[j] - ay, abz = this._wz[j] - az;
    const acx = this._wx[k] - ax, acy = this._wy[k] - ay, acz = this._wz[k] - az;
    const nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
    const dx = this._newW.x - ax, dy = this._newW.y - ay, dz = this._newW.z - az;
    const vol = dx * nx + dy * ny + dz * nz;
    return vol * vol > 1e-14;
};

// Flat (zero-volume) contact: zero depth from the simplex's first witness points and search normal.
proto._zeroDepthResult = function (simplex) {
    const pointA = new Vector3(simplex._ax[0], simplex._ay[0], simplex._az[0]);
    const pointB = new Vector3(simplex._bx[0], simplex._by[0], simplex._bz[0]);
    let nx = 0, ny = 1, nz = 0;
    if (simplex._closest && simplex._closest.lengthSquared && simplex._closest.lengthSquared() > 1e-20) {
        const l = Math.sqrt(simplex._closest.lengthSquared());
        nx = simplex._closest.x / l; ny = simplex._closest.y / l; nz = simplex._closest.z / l;
    }
    return { distance: 0, normal: new Vector3(nx, ny, nz), pointA: pointA, pointB: pointB };
};


// ==== src/collision/Expand.js ====
// EPA expansion loop and result extraction.
var proto = EPA.prototype;

// Expands `simplex` into penetration depth and normal. maxIterations guards non-convergence;
// hitting the cap still returns the live polytope's closest alive face.
proto.run = function (support, simplex, maxIterations) {
    maxIterations = maxIterations || 64;
    this._vertexCount = 0;
    this._faceCount = 0;

    if (!this._buildInitialTetrahedron(support, simplex)) {
        return this._zeroDepthResult(simplex); // exact touch / numerically flat: zero depth
    }
    const idx = [0, 1, 2, 3];
    const cx = (this._wx[idx[0]] + this._wx[idx[1]] + this._wx[idx[2]] + this._wx[idx[3]]) / 4;
    const cy = (this._wy[idx[0]] + this._wy[idx[1]] + this._wy[idx[2]] + this._wy[idx[3]]) / 4;
    const cz = (this._wz[idx[0]] + this._wz[idx[1]] + this._wz[idx[2]] + this._wz[idx[3]]) / 4;
    const centroid = { x: cx, y: cy, z: cz };

    // The 4 faces of the seed tetrahedron.
    this._addFace(idx[0], idx[1], idx[2], centroid);
    this._addFace(idx[0], idx[1], idx[3], centroid);
    this._addFace(idx[0], idx[2], idx[3], centroid);
    this._addFace(idx[1], idx[2], idx[3], centroid);

    for (let iter = 0; iter < maxIterations; iter++) {
        const face = this._closestAliveFace();
        const faceDist = this._faceDist[face];

        this._dirScratch.set(this._faceNx[face], this._faceNy[face], this._faceNz[face]);
        support.supportInto(this._newW, this._dirScratch, this._newA, this._newB);

        const newDist = this._newW.x * this._faceNx[face] + this._newW.y * this._faceNy[face] + this._newW.z * this._faceNz[face];

        if (newDist - faceDist < 1e-6) break; // converged

        this._expandAt(this._newW, this._newA, this._newB, centroid);
    }

    return this._resultFromFace(this._closestAliveFace());
};

// Linear scan for the alive face closest to the origin (polytope stays small).
proto._closestAliveFace = function () {
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < this._faceCount; i++) {
        if (!this._faceAlive[i]) continue;
        if (this._faceDist[i] < bestDist) { bestDist = this._faceDist[i]; best = i; }
    }
    return best;
};

// Adds `newPoint` and re-triangulates: every alive face visible from it is removed, and the
// resulting hole's horizon is re-closed with new faces to the new point.
proto._expandAt = function (newW, newA, newB, centroid) {
    const newIdx = this._pushVertex(newW, newA, newB);

    // Horizon: edges shared by exactly one visible face and one non-visible face. A shared
    // internal edge between two visible faces is seen twice and cancels out.
    const horizonA = [], horizonB = [];
    function edgeKey(a, b) { return a < b ? a + ',' + b : b + ',' + a; }
    const edgeSeen = new Map();

    for (let i = 0; i < this._faceCount; i++) {
        if (!this._faceAlive[i]) continue;
        const a = this._faceA[i], b = this._faceB[i], c = this._faceC[i];
        const nx = this._faceNx[i], ny = this._faceNy[i], nz = this._faceNz[i];
        const visible = (newW.x - this._wx[a]) * nx + (newW.y - this._wy[a]) * ny + (newW.z - this._wz[a]) * nz > 1e-10;
        if (!visible) continue;

        this._faceAlive[i] = 0;
        const edges = [[a, b], [b, c], [c, a]];
        for (let e = 0; e < 3; e++) {
            const from = edges[e][0], to = edges[e][1];
            const key = edgeKey(from, to);
            if (edgeSeen.has(key)) edgeSeen.delete(key);
            else edgeSeen.set(key, { from: from, to: to });
        }
    }

    edgeSeen.forEach(function (e) { horizonA.push(e.from); horizonB.push(e.to); });

    for (let i = 0; i < horizonA.length; i++) {
        this._addFace(horizonA[i], horizonB[i], newIdx, centroid);
    }
};

// Recovers { distance, normal, pointA, pointB } from a face - barycentric weights of the face's
// own closest point to the origin, applied to its three world witness points.
proto._resultFromFace = function (face) {
    const ia = this._faceA[face], ib = this._faceB[face], ic = this._faceC[face];
    const nx = this._faceNx[face], ny = this._faceNy[face], nz = this._faceNz[face];
    const dist = this._faceDist[face];

    // The plane is {x : x.n_hat = dist}, so dist*n_hat is the closest point on it to the origin.
    const ax = this._wx[ia], ay = this._wy[ia], az = this._wz[ia];
    const closestX = nx * dist, closestY = ny * dist, closestZ = nz * dist;

    const bx = this._wx[ib], by = this._wy[ib], bz = this._wz[ib];
    const cx = this._wx[ic], cy = this._wy[ic], cz = this._wz[ic];
    const v0x = bx - ax, v0y = by - ay, v0z = bz - az;
    const v1x = cx - ax, v1y = cy - ay, v1z = cz - az;
    const v2x = closestX - ax, v2y = closestY - ay, v2z = closestZ - az;
    const d00 = v0x * v0x + v0y * v0y + v0z * v0z;
    const d01 = v0x * v1x + v0y * v1y + v0z * v1z;
    const d11 = v1x * v1x + v1y * v1y + v1z * v1z;
    const d20 = v2x * v0x + v2y * v0y + v2z * v0z;
    const d21 = v2x * v1x + v2y * v1y + v2z * v1z;
    const denom = d00 * d11 - d01 * d01;
    let u, v, w;
    if (Math.abs(denom) < 1e-20) {
        u = 1 / 3; v = 1 / 3; w = 1 / 3;
    } else {
        v = (d11 * d20 - d01 * d21) / denom;
        w = (d00 * d21 - d01 * d20) / denom;
        u = 1 - v - w;
    }

    const pointA = new Vector3(
        u * this._ax[ia] + v * this._ax[ib] + w * this._ax[ic],
        u * this._ay[ia] + v * this._ay[ib] + w * this._ay[ic],
        u * this._az[ia] + v * this._az[ib] + w * this._az[ic]
    );
    const pointB = new Vector3(
        u * this._bx[ia] + v * this._bx[ib] + w * this._bx[ic],
        u * this._by[ia] + v * this._by[ib] + w * this._by[ic],
        u * this._bz[ia] + v * this._bz[ib] + w * this._bz[ic]
    );

    // Face normal points A-side to B-side; negate for the pipeline's B->A convention.
    return {
        distance: Math.max(0, dist),
        normal: new Vector3(-nx, -ny, -nz),
        pointA: pointA,
        pointB: pointB
    };
};


// ==== src/collision/ContactDetails.js ====
// One contact point between a primitive shape pair. signedDistance: negative = separated,
// positive = overlapping. normal points B to A. pointOnA/pointOnB are witness points on each
// shape's surface; `point` is their midpoint.
class ContactDetails {
    constructor() {
        this.point = new Vector3();
        this.pointOnA = new Vector3();
        this.pointOnB = new Vector3();
        this.normal = new Vector3();
        this.signedDistance = 0;
        this.normalLambda = 0;   // warm-start data, preserved across a match
        this.tangentLambda1 = 0;
        this.tangentLambda2 = 0;

        // Set once at creation, re-read each substep for the live gap (PositionSolve.js).
        this.localAnchorA = new Vector3();
        this.localAnchorB = new Vector3();

        this._preSolveNormalVel = 0; // for restitution, written each substep
        this.fromMeshFace = false;   // set by TriTri/ConvexTri; gates the mesh-face merge and patch solve

        // Source triangle for a mesh-face contact, in world space (the mesh side is static ground,
        // so these verts don't move within a tick). Lets GeometryRefresh re-clip only the triangle
        // that produced this point each substep instead of re-running the whole midphase +
        // narrowphase for the pair. Set by TriTri/ConvexTri alongside fromMeshFace; meshTriValid
        // stays false when unset so the refresh can fall back.
        this.meshTriValid = false;
        this.meshTriA = new Vector3();
        this.meshTriB = new Vector3();
        this.meshTriC = new Vector3();
        this.meshTriBodyCenter = new Vector3();
        this.meshTriIsSideA = false; // was the triangle placedA (true) or placedB (false) in the pair
    }

    // Derives local anchors from the current witness points. Called once at creation, never on a
    // re-matched point.
    setLocalAnchors(bodyA, bodyB) {
        const invRotA = ContactDetails._scratchQuat.copy(bodyA.rotation).invert();
        Vector3.subInto(this.localAnchorA, this.pointOnA, bodyA.position);
        invRotA.transformVectorInPlace(this.localAnchorA);

        const invRotB = ContactDetails._scratchQuat.copy(bodyB.rotation).invert();
        Vector3.subInto(this.localAnchorB, this.pointOnB, bodyB.position);
        invRotB.transformVectorInPlace(this.localAnchorB);
        return this;
    }

    currentAnchorAInto(out, bodyA) {
        out.copy(this.localAnchorA);
        bodyA.rotation.transformVectorInPlace(out);
        out.addInPlace(bodyA.position);
        return out;
    }

    currentAnchorBInto(out, bodyB) {
        out.copy(this.localAnchorB);
        bodyB.rotation.transformVectorInPlace(out);
        out.addInPlace(bodyB.position);
        return out;
    }

    // GJK separated result (distance = non-negative gap) -> negative signedDistance.
    setFromGJKSeparated(gjkResult) {
        this.fromMeshFace = false;
        this.pointOnA.copy(gjkResult.pointA);
        this.pointOnB.copy(gjkResult.pointB);
        this.normal.copy(gjkResult.normal);
        this.signedDistance = -gjkResult.distance;
        Vector3.addInto(this.point, gjkResult.pointA, gjkResult.pointB).scaleInPlace(0.5);
        return this;
    }

    // EPA result (distance = non-negative depth) -> positive signedDistance.
    setFromEPA(epaResult) {
        this.fromMeshFace = false;
        this.pointOnA.copy(epaResult.pointA);
        this.pointOnB.copy(epaResult.pointB);
        this.normal.copy(epaResult.normal);
        this.signedDistance = epaResult.distance;
        Vector3.addInto(this.point, epaResult.pointA, epaResult.pointB).scaleInPlace(0.5);
        return this;
    }

    copy(other) {
        this.point.copy(other.point);
        this.pointOnA.copy(other.pointOnA);
        this.pointOnB.copy(other.pointOnB);
        this.normal.copy(other.normal);
        this.signedDistance = other.signedDistance;
        this.normalLambda = other.normalLambda;
        this.tangentLambda1 = other.tangentLambda1;
        this.tangentLambda2 = other.tangentLambda2;
        this.fromMeshFace = other.fromMeshFace;
        this.meshTriValid = other.meshTriValid;
        if (other.meshTriValid) {
            this.meshTriA.copy(other.meshTriA);
            this.meshTriB.copy(other.meshTriB);
            this.meshTriC.copy(other.meshTriC);
            this.meshTriBodyCenter.copy(other.meshTriBodyCenter);
            this.meshTriIsSideA = other.meshTriIsSideA;
        }
        return this;
    }

    // Records the world-space source triangle for a mesh-face contact (see the field comments).
    setMeshTriangle(a, b, c, bodyCenter, isSideA) {
        this.meshTriValid = true;
        this.meshTriA.copy(a);
        this.meshTriB.copy(b);
        this.meshTriC.copy(c);
        if (bodyCenter) this.meshTriBodyCenter.copy(bodyCenter); else this.meshTriBodyCenter.set(0, 0, 0);
        this.meshTriIsSideA = isSideA;
        return this;
    }

    clone() {
        return new ContactDetails().copy(this);
    }
}

ContactDetails._scratchQuat = new Quaternion();

ActionPhysics.ContactDetails = ContactDetails;


// ==== src/collision/ContactManifold.js ====
// Persistent contact state for one primitive-shape pair. update() (once per tick, never per
// substep) matches this tick's GJK/EPA result against existing points by bodyA-local proximity,
// refreshing matched points in place to preserve their warm-start lambda. Only update() removes a
// point. See Update.js and Reduction.js.
class ContactManifold {
    constructor(bodyA, bodyB) {
        this.bodyA = bodyA;
        this.bodyB = bodyB;
        this.points = []; // ContactDetails[], 0..MAX_POINTS
        this._localAnchors = []; // bodyA-local anchor per point, for next-tick matching
        this.next_manifold = null; // linked-list view, maintained by ContactManifoldList._relink()
    }

    get pointCount() { return this.points.length; }
}

ContactManifold.MAX_POINTS = 4;
// Base match radius; Update.js._matchDistance widens it by the point's tangential travel per tick.
ContactManifold.MATCH_DISTANCE = 0.05;
// Signed-distance band where GJK/EPA's normal is ambiguous; a matched point keeps its old normal.
ContactManifold.EXACT_TOUCH_BAND = 0.001;
// Same-tick mesh-face points closer than this (meters) with a matching normal are merged (Reduction.js).
ContactManifold.COINCIDENCE_DIST = 0.05;

ContactManifold._scratchNormal = new Vector3();
ContactManifold._scratchRA = new Vector3();
ContactManifold._scratchRB = new Vector3();
ContactManifold._scratchInvRot = new Quaternion();
ContactManifold._scratchLocal = new Vector3();

ActionPhysics.ContactManifold = ContactManifold;


// ==== src/collision/Update.js ====
// Per-tick manifold update: match existing points against this tick's narrowphase result, warm-
// start matched points, add genuinely new ones, remove unconfirmed ones. Fires contact lifecycle
// events on both bodies:
//   speculativeContact - a predicted point the body has NOT yet reached (still more than a
//                        speculative-margin away), vetoable by a listener
//   contact            - EVERY tick a point is "in contact": overlapping, OR held right at the
//                        surface by the speculative solve (signedDistance >= -CONTACT_BAND). Fires
//                        on the tick it first touches and every tick it stays - matching "while in
//                        contact" semantics, not just the leading edge. Because speculation stops a
//                        slow body BEFORE it overlaps, an exact-touch-only band would never fire for
//                        a body resting against a wall it approached slowly.
//   endContact         - a point that was present last tick is gone this tick
//   endAllContact      - the manifold went from having points to having none
var proto = ContactManifold.prototype;

// A point at or within this signed-distance of the surface counts as "in contact" for events: the
// solver is actively constraining the pair against each other here (it holds a speculative body at
// roughly the base speculative margin, not at exactly 0). Matches RigidBody.SPECULATIVE_MARGIN.
ContactManifold.CONTACT_BAND = 0.02;
ContactManifold._isTouching = function (signedDistance) {
    return signedDistance >= -ContactManifold.CONTACT_BAND;
};

proto.update = function (newContacts, dt) {
    const hadPointsBefore = this.points.length > 0;
    const matched = new Array(newContacts.length).fill(false);

    // Match each existing point against the best (closest, in bodyA-local space) unmatched
    // incoming contact.
    for (let i = this.points.length - 1; i >= 0; i--) {
        const existing = this.points[i];
        const existingLocal = this._localAnchors[i];
        const matchDist = this._matchDistance(existing, dt);
        let bestJ = -1, bestDistSq = matchDist * matchDist;
        for (let j = 0; j < newContacts.length; j++) {
            if (matched[j]) continue;
            const localCandidate = ContactManifold._toLocal(this.bodyA, newContacts[j].pointOnA, ContactManifold._scratchLocal);
            const dx = localCandidate.x - existingLocal.x, dy = localCandidate.y - existingLocal.y, dz = localCandidate.z - existingLocal.z;
            const distSq = dx * dx + dy * dy + dz * dz;
            if (distSq < bestDistSq) { bestDistSq = distSq; bestJ = j; }
        }
        if (bestJ === -1) {
            // Not re-confirmed this tick: remove (the only removal path, never mid-substep).
            this.points.splice(i, 1);
            this._localAnchors.splice(i, 1);
            this._emitBoth('endContact', existing);
            continue;
        }
        matched[bestJ] = true;
        // Capture the warm-start lambdas before copy() zeroes them from the fresh incoming contact.
        const keepNormalLambda = existing.normalLambda;
        const keepTangentLambda1 = existing.tangentLambda1;
        const keepTangentLambda2 = existing.tangentLambda2;
        // Inside EXACT_TOUCH_BAND, GJK/EPA's recovered normal is ambiguous - keep the established
        // one, or a persistent contact hits a penetrate-then-launch limit cycle.
        const keepNormal = Math.abs(newContacts[bestJ].signedDistance) < ContactManifold.EXACT_TOUCH_BAND
            ? ContactManifold._scratchNormal.copy(existing.normal)
            : null;
        const wasOverlapping = existing.signedDistance >= 0;
        existing.copy(newContacts[bestJ]);
        existing.normalLambda = keepNormalLambda;
        existing.tangentLambda1 = keepTangentLambda1;
        existing.tangentLambda2 = keepTangentLambda2;
        if (keepNormal) existing.normal.copy(keepNormal);
        ContactManifold._toLocal(this.bodyA, existing.pointOnA, existingLocal);
        // Fire 'contact' every tick the point is touching (not just the entry edge), so a body
        // resting against another keeps notifying its listeners. `wasOverlapping` is unused now but
        // kept above in case a consumer ever wants an entry-only variant.
        void wasOverlapping;
        if (ContactManifold._isTouching(existing.signedDistance)) this._emitBoth('contact', existing);
    }

    // Any incoming contact not matched to an existing point is genuinely new.
    for (let j = 0; j < newContacts.length; j++) {
        if (matched[j]) continue;
        const nc = newContacts[j];
        if (nc.signedDistance < 0 && !ContactManifold._isTouching(nc.signedDistance)) {
            // Genuinely separated (beyond the exact-touch band): a predicted point only.
            if (!this._speculativeAllowed(nc)) continue; // vetoed by a listener
            this._addPoint(nc);
            this._emitBoth('speculativeContact', nc);
        } else {
            this._addPoint(nc);
            this._emitBoth('contact', nc);
        }
    }

    if (hadPointsBefore && this.points.length === 0) this._emitBoth('endAllContact', null);
};

// MATCH_DISTANCE widened by the contact point's tangential travel this tick, so a fast-sliding or
// rolling contact's point still matches instead of rebuilding the manifold (and losing warm-start).
proto._matchDistance = function (point, dt) {
    if (!dt) return ContactManifold.MATCH_DISTANCE;
    const bodyA = this.bodyA, bodyB = this.bodyB;
    point.currentAnchorAInto(ContactManifold._scratchRA, bodyA);
    point.currentAnchorBInto(ContactManifold._scratchRB, bodyB);
    const rax = ContactManifold._scratchRA.x - bodyA.position.x, ray = ContactManifold._scratchRA.y - bodyA.position.y, raz = ContactManifold._scratchRA.z - bodyA.position.z;
    const rbx = ContactManifold._scratchRB.x - bodyB.position.x, rby = ContactManifold._scratchRB.y - bodyB.position.y, rbz = ContactManifold._scratchRB.z - bodyB.position.z;
    const wa = bodyA.angular_velocity, va = bodyA.linear_velocity;
    const wb = bodyB.angular_velocity, vb = bodyB.linear_velocity;
    const vax = va.x + (wa.y * raz - wa.z * ray), vay = va.y + (wa.z * rax - wa.x * raz), vaz = va.z + (wa.x * ray - wa.y * rax);
    const vbx = vb.x + (wb.y * rbz - wb.z * rby), vby = vb.y + (wb.z * rbx - wb.x * rbz), vbz = vb.z + (wb.x * rby - wb.y * rbx);
    const relx = vbx - vax, rely = vby - vay, relz = vbz - vaz;
    const n = point.normal;
    const vdotn = relx * n.x + rely * n.y + relz * n.z;
    const tx = relx - vdotn * n.x, ty = rely - vdotn * n.y, tz = relz - vdotn * n.z;
    const tangentialSpeed = Math.sqrt(tx * tx + ty * ty + tz * tz);
    return ContactManifold.MATCH_DISTANCE + tangentialSpeed * dt;
};

// A speculativeContact listener on either body may veto the point before it's added.
proto._speculativeAllowed = function (contact) {
    return this.bodyA._speculativeVeto(contact, this.bodyB) !== false &&
        this.bodyB._speculativeVeto(contact, this.bodyA) !== false;
};

proto._emitBoth = function (event, contact) {
    this.bodyA.emit(event, { contact: contact, other: this.bodyB });
    this.bodyB.emit(event, { contact: contact, other: this.bodyA });
};

// World point -> bodyA-local space, for next-tick matching. Writes into caller-owned `out`.
ContactManifold._toLocal = function (bodyA, worldPoint, out) {
    Vector3.subInto(out, worldPoint, bodyA.position);
    ContactManifold._scratchInvRot.copy(bodyA.rotation).invert();
    ContactManifold._scratchInvRot.transformVectorInPlace(out);
    return out;
};


// ==== src/collision/Reduction.js ====
// Adding a point, and the 4-point manifold cap reduction: always keep the deepest point, and among
// the rest keep whichever 3 form the largest-area quadrilateral with it - maximizing spread gives
// better torque resistance (a corner-only manifold rocks; 4 spread corners don't).
var proto = ContactManifold.prototype;

proto._addPoint = function (contact) {
    // Adjacent mesh triangles report the same shared corner (TriTri emits one contact per clipped
    // vertex). Merge same-tick mesh-face duplicates so the 4-point reduction isn't biased toward
    // one edge. Scoped to fromMeshFace so primitive manifolds keep their point spread.
    if (contact.fromMeshFace) for (let i = 0; i < this.points.length; i++) {
        const ex = this.points[i];
        if (!ex.fromMeshFace) continue;
        const dx = ex.point.x - contact.point.x, dy = ex.point.y - contact.point.y, dz = ex.point.z - contact.point.z;
        if (dx * dx + dy * dy + dz * dz > ContactManifold.COINCIDENCE_DIST * ContactManifold.COINCIDENCE_DIST) continue;
        if (ex.normal.x * contact.normal.x + ex.normal.y * contact.normal.y + ex.normal.z * contact.normal.z < 0.99) continue;
        if (contact.signedDistance > ex.signedDistance) {
            const keepN = ex.normalLambda, keepT1 = ex.tangentLambda1, keepT2 = ex.tangentLambda2;
            ex.copy(contact);
            ex.normalLambda = keepN; ex.tangentLambda1 = keepT1; ex.tangentLambda2 = keepT2;
            ex.setLocalAnchors(this.bodyA, this.bodyB);
            ContactManifold._toLocal(this.bodyA, ex.pointOnA, this._localAnchors[i]);
        }
        return;
    }

    const point = contact.clone();
    point.normalLambda = 0; point.tangentLambda1 = 0; point.tangentLambda2 = 0;
    point.setLocalAnchors(this.bodyA, this.bodyB);
    const local = ContactManifold._toLocal(this.bodyA, point.pointOnA, new Vector3());

    if (this.points.length < ContactManifold.MAX_POINTS) {
        this.points.push(point);
        this._localAnchors.push(local);
        return;
    }
    this._reduceToFour(point, local);
};

proto._reduceToFour = function (candidatePoint, candidateLocal) {
    // Deepest = largest signedDistance (most overlapping), the point the solver most needs.
    let deepestIdx = -1, deepestVal = candidatePoint.signedDistance;
    for (let i = 0; i < this.points.length; i++) {
        if (this.points[i].signedDistance > deepestVal) { deepestVal = this.points[i].signedDistance; deepestIdx = i; }
    }
    const deepestIsCandidate = deepestIdx === -1;
    const deepestPoint = deepestIsCandidate ? candidatePoint : this.points[deepestIdx];

    // Remaining candidates for the 3 non-deepest slots: exactly 4 of them (4 existing + candidate,
    // minus the deepest), so there are exactly 4 possible triples - enumerate directly.
    const pool = [];
    for (let i = 0; i < this.points.length; i++) if (i !== deepestIdx) pool.push({ point: this.points[i], local: this._localAnchors[i] });
    if (!deepestIsCandidate) pool.push({ point: candidatePoint, local: candidateLocal });

    let bestOmit = 0, bestArea = -1;
    for (let omit = 0; omit < pool.length; omit++) {
        const tri = [];
        for (let i = 0; i < pool.length; i++) if (i !== omit) tri.push(pool[i]);
        const area = ContactManifold._quadArea(deepestPoint.point, tri[0].point.point, tri[1].point.point, tri[2].point.point);
        if (area > bestArea) { bestArea = area; bestOmit = omit; }
    }

    const kept = [];
    for (let i = 0; i < pool.length; i++) if (i !== bestOmit) kept.push(pool[i]);

    this.points = deepestIsCandidate ? [candidatePoint] : [deepestPoint];
    this._localAnchors = deepestIsCandidate ? [candidateLocal] : [this._localAnchors[deepestIdx]];
    for (let i = 0; i < kept.length; i++) { this.points.push(kept[i].point); this._localAnchors.push(kept[i].local); }
};

// Rough quad area via the two diagonal-split triangles - a fine proxy for "how spread out", not a
// proper convex-hull-ordered area.
ContactManifold._quadArea = function (a, b, c, d) {
    return ContactManifold._triArea(a, b, c) + ContactManifold._triArea(a, c, d);
};

ContactManifold._triArea = function (a, b, c) {
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
    const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
    const cx = aby * acz - abz * acy, cy = abz * acx - abx * acz, cz = abx * acy - aby * acx;
    return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
};


// ==== src/collision/ContactManifoldList.js ====
// One ContactManifold per body pair, keyed by canonical id. refresh() runs once per tick and
// prunes any manifold left with zero points.
class ContactManifoldList {
    constructor() {
        this._manifolds = new Map(); // "idA:idB" (idA < idB) -> ContactManifold
        // Singly-linked-list view over the live (non-empty) manifolds, relinked at the end of every
        // refresh(). Walk it as: for (let m = list.first; m; m = m.next_manifold). The canonical
        // iteration is values(); this exists for consumers that expect the linked-list shape.
        this.first = null;
    }

    static _key(bodyA, bodyB) {
        return bodyA.id < bodyB.id ? bodyA.id + ':' + bodyB.id : bodyB.id + ':' + bodyA.id;
    }

    // Lower id becomes bodyA, so local-space matching is stable regardless of argument order.
    getOrCreate(bodyA, bodyB) {
        const key = ContactManifoldList._key(bodyA, bodyB);
        let m = this._manifolds.get(key);
        if (!m) {
            const first = bodyA.id < bodyB.id ? bodyA : bodyB;
            const second = bodyA.id < bodyB.id ? bodyB : bodyA;
            m = new ContactManifold(first, second);
            this._manifolds.set(key, m);
        }
        return m;
    }

    // contactsByPair: key -> ContactDetails[] for this tick (missing = empty). Callers create new
    // pairs via getOrCreate() before this runs.
    refresh(contactsByPair, dt) {
        for (const [key, manifold] of this._manifolds) {
            const contacts = contactsByPair.get(key) || [];
            manifold.update(contacts, dt);
            if (manifold.pointCount === 0) this._manifolds.delete(key);
        }
        this._relink();
    }

    // Rebuild the .first / .next_manifold chain over the surviving manifolds, in Map insertion
    // order (same order values() yields), so the linked-list view and values() agree.
    _relink() {
        let prev = null;
        this.first = null;
        for (const manifold of this._manifolds.values()) {
            manifold.next_manifold = null;
            if (prev) prev.next_manifold = manifold;
            else this.first = manifold;
            prev = manifold;
        }
    }

    values() {
        return this._manifolds.values();
    }

    get size() { return this._manifolds.size; }
}

ActionPhysics.ContactManifoldList = ContactManifoldList;


// ==== src/phases/NarrowPhase.js ====
// Dispatches Midphase's primitive-shape pairs through the closed-form tests / GJK/EPA into
// ContactManifoldList. See PairTest.js, SpeculativeMargin.js, GeometryRefresh.js.
class NarrowPhase {
    constructor() {
        this.manifolds = new ContactManifoldList();
        // Same object under the Goblin-style name; walk it as .contact_manifolds.first ->
        // .next_manifold. The `contacts` World event delivers this same list.
        this.contact_manifolds = this.manifolds;
        this._dt = 1 / 60; // set each tick by step()
        this._gjk = new GJK();
        this._epa = new EPA();
        // Rebound per pair via setSides() (PairTest.js).
        this._support = new MinkowskiSupport({ shape: null, position: new Vector3(), rotation: new Quaternion() }, { shape: null, position: new Vector3(), rotation: new Quaternion() });
        this._contactPool = []; // reused ContactDetails, grown as needed
        this._poolIndex = 0;
        this._pairResultScratch = [];
    }
}

NarrowPhase.SPECULATIVE_BASE = 0.02; // meters, see SpeculativeMargin.js

ActionPhysics.NarrowPhase = NarrowPhase;


// ==== src/phases/SphereSphere.js ====
// Closed-form sphere-sphere.
const SphereSphere = {};

SphereSphere.applies = function (placedA, placedB) {
    return placedA.shape instanceof SphereShape && placedB.shape instanceof SphereShape;
};

// Below this center-to-center distance the separating direction is undefined; use a fixed axis.
SphereSphere.DEGENERATE_EPSILON = 1e-9;

SphereSphere.test = function (placedA, placedB, out) {
    const ax = placedA.position.x, ay = placedA.position.y, az = placedA.position.z;
    const bx = placedB.position.x, by = placedB.position.y, bz = placedB.position.z;
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const distSq = dx * dx + dy * dy + dz * dz;
    const dist = Math.sqrt(distSq);
    const ra = placedA.shape.radius, rb = placedB.shape.radius;

    let nx, ny, nz;
    if (dist > SphereSphere.DEGENERATE_EPSILON) {
        // normal points B -> A, matching GJK/EPA's own convention.
        nx = -dx / dist; ny = -dy / dist; nz = -dz / dist;
    } else {
        nx = 0; ny = 1; nz = 0;
    }

    out.pointOnA.set(ax - nx * ra, ay - ny * ra, az - nz * ra);
    out.pointOnB.set(bx + nx * rb, by + ny * rb, bz + nz * rb);
    out.normal.set(nx, ny, nz);
    out.signedDistance = (ra + rb) - dist; // positive = overlapping, matching the pipeline convention
    Vector3.addInto(out.point, out.pointOnA, out.pointOnB).scaleInPlace(0.5);
    return out;
};


// ==== src/phases/SphereBox.js ====
// Closed-form sphere-box: closest point on the oriented box to the sphere center, clamped per-axis.
const SphereBox = {};

SphereBox.applies = function (placedA, placedB) {
    return (placedA.shape instanceof SphereShape && placedB.shape instanceof BoxShape) ||
        (placedA.shape instanceof BoxShape && placedB.shape instanceof SphereShape);
};

// Below this distance from box surface to sphere center the normal is undefined; use a fixed axis.
SphereBox.DEGENERATE_EPSILON = 1e-9;

SphereBox.test = function (placedA, placedB, out) {
    const sphereFirst = placedA.shape instanceof SphereShape;
    const spherePlaced = sphereFirst ? placedA : placedB;
    const boxPlaced = sphereFirst ? placedB : placedA;
    const sphere = spherePlaced.shape, box = boxPlaced.shape;

    // Sphere center in the box's local frame.
    const invRot = SphereBox._scratchQuat.copy(boxPlaced.rotation).invert();
    const local = SphereBox._scratchV1;
    local.copy(spherePlaced.position).subInPlace(boxPlaced.position);
    invRot.transformVectorInPlace(local);

    // Closest point on the box to that center, clamped per axis; also track whether the center is
    // strictly inside (all three axes already within their half-extent - deep penetration).
    const hw = box.halfWidth, hh = box.halfHeight, hd = box.halfDepth;
    const insideX = local.x > -hw && local.x < hw;
    const insideY = local.y > -hh && local.y < hh;
    const insideZ = local.z > -hd && local.z < hd;
    const inside = insideX && insideY && insideZ;

    const closest = SphereBox._scratchV2;
    let localNx = 0, localNy = 0, localNz = 0, penetration = 0;
    if (inside) {
        // Center inside the box: push out along the axis of least penetration.
        const px = hw - Math.abs(local.x), py = hh - Math.abs(local.y), pz = hd - Math.abs(local.z);
        if (px <= py && px <= pz) { localNx = local.x >= 0 ? 1 : -1; penetration = px; closest.set(local.x >= 0 ? hw : -hw, local.y, local.z); }
        else if (py <= pz) { localNy = local.y >= 0 ? 1 : -1; penetration = py; closest.set(local.x, local.y >= 0 ? hh : -hh, local.z); }
        else { localNz = local.z >= 0 ? 1 : -1; penetration = pz; closest.set(local.x, local.y, local.z >= 0 ? hd : -hd); }
    } else {
        closest.set(
            Math.max(-hw, Math.min(hw, local.x)),
            Math.max(-hh, Math.min(hh, local.y)),
            Math.max(-hd, Math.min(hd, local.z))
        );
    }

    const dx = local.x - closest.x, dy = local.y - closest.y, dz = local.z - closest.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    const dist = Math.sqrt(distSq);

    let worldNx, worldNy, worldNz;
    if (inside) {
        // Normal already chosen above (box-local axis of least penetration).
        SphereBox._scratchV1.set(localNx, localNy, localNz);
        boxPlaced.rotation.transformVectorInPlace(SphereBox._scratchV1);
    } else if (dist > SphereBox.DEGENERATE_EPSILON) {
        SphereBox._scratchV1.set(dx / dist, dy / dist, dz / dist);
        boxPlaced.rotation.transformVectorInPlace(SphereBox._scratchV1);
    } else {
        SphereBox._scratchV1.set(0, 1, 0);
        boxPlaced.rotation.transformVectorInPlace(SphereBox._scratchV1);
    }
    worldNx = SphereBox._scratchV1.x; worldNy = SphereBox._scratchV1.y; worldNz = SphereBox._scratchV1.z;
    // Local derivation gives sphere->box; flip to the pipeline's B->A when the box is placed first.
    if (!sphereFirst) { worldNx = -worldNx; worldNy = -worldNy; worldNz = -worldNz; }

    const worldClosest = SphereBox._scratchV3;
    worldClosest.copy(closest);
    boxPlaced.rotation.transformVectorInPlace(worldClosest);
    worldClosest.addInPlace(boxPlaced.position);

    const signedDistance = inside ? (sphere.radius + penetration) : (sphere.radius - dist);

    const pointOnSphere = SphereBox._scratchV4;
    // Point on the sphere's own surface, along the normal from the box back toward the sphere.
    const towardSphereX = sphereFirst ? worldNx : -worldNx, towardSphereY = sphereFirst ? worldNy : -worldNy, towardSphereZ = sphereFirst ? worldNz : -worldNz;
    pointOnSphere.set(
        spherePlaced.position.x - towardSphereX * sphere.radius,
        spherePlaced.position.y - towardSphereY * sphere.radius,
        spherePlaced.position.z - towardSphereZ * sphere.radius
    );

    if (sphereFirst) {
        out.pointOnA.copy(pointOnSphere);
        out.pointOnB.copy(worldClosest);
    } else {
        out.pointOnA.copy(worldClosest);
        out.pointOnB.copy(pointOnSphere);
    }
    out.normal.set(worldNx, worldNy, worldNz);
    out.signedDistance = signedDistance;
    Vector3.addInto(out.point, out.pointOnA, out.pointOnB).scaleInPlace(0.5);
    return out;
};

SphereBox._scratchQuat = new Quaternion();
SphereBox._scratchV1 = new Vector3();
SphereBox._scratchV2 = new Vector3();
SphereBox._scratchV3 = new Vector3();
SphereBox._scratchV4 = new Vector3();


// ==== src/phases/BoxBox.js ====
// Closed-form box-box: 15-axis SAT (3+3 face normals, 9 edge-cross axes) picks the minimum-
// penetration separating axis, then either clips the incident face against the reference face's
// side planes (face contact, up to 4 points) or takes the closest points between the two
// contributing edges (edge-edge contact, 1 point). Own epsilon, no shared GJK/EPA state.
const BoxBox = {};

BoxBox.applies = function (placedA, placedB) {
    return placedA.shape instanceof BoxShape && placedB.shape instanceof BoxShape;
};

// An edge-edge axis only beats the best face axis if it wins by more than this fraction of the
// face overlap. Guards face-to-face resting boxes, where an edge axis can numerically tie a face
// axis and flicker the manifold between 4 points and 1 tick to tick.
BoxBox.RELATIVE_TOLERANCE = 0.25;
// Absolute floor under the tie-break: near exact touch, RELATIVE_TOLERANCE * faceOverlap vanishes
// and float noise alone would pick the edge branch.
BoxBox.ABSOLUTE_TOLERANCE = 1e-6;
// Edge-cross axes below this squared length are near-parallel edges (degenerate axis).
BoxBox.PARALLEL_EPSILON = 1e-9;
// How far a still-separated pair is trusted to report a speculative contact via SAT before falling
// through to GJK/EPA. Generous; PairTest.step does the real speculative-margin filtering.
BoxBox.SEPARATED_AXIS_LIMIT = 1.0;

// out: array to push ContactDetails into (pooled via nextContact()). Returns out.
BoxBox.test = function (placedA, placedB, out, nextContact) {
    const a = placedA.shape, b = placedB.shape;
    const posA = placedA.position, posB = placedB.position;
    const rotA = placedA.rotation, rotB = placedB.rotation;

    const ax = BoxBox._axesA, bx = BoxBox._axesB;
    ax[0].set(1, 0, 0); rotA.transformVectorInPlace(ax[0]);
    ax[1].set(0, 1, 0); rotA.transformVectorInPlace(ax[1]);
    ax[2].set(0, 0, 1); rotA.transformVectorInPlace(ax[2]);
    bx[0].set(1, 0, 0); rotB.transformVectorInPlace(bx[0]);
    bx[1].set(0, 1, 0); rotB.transformVectorInPlace(bx[1]);
    bx[2].set(0, 0, 1); rotB.transformVectorInPlace(bx[2]);

    const halfA = BoxBox._halfA, halfB = BoxBox._halfB;
    halfA[0] = a.halfWidth; halfA[1] = a.halfHeight; halfA[2] = a.halfDepth;
    halfB[0] = b.halfWidth; halfB[1] = b.halfHeight; halfB[2] = b.halfDepth;

    const d = BoxBox._d;
    Vector3.subInto(d, posB, posA);

    // R[i][j] = ax[i] . bx[j]; absR adds a small epsilon (standard SAT robustness fix so a
    // near-parallel pair of face axes doesn't zero out a projected extent).
    const R = BoxBox._R, absR = BoxBox._absR;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            R[i][j] = ax[i].dot(bx[j]);
            absR[i][j] = Math.abs(R[i][j]) + 1e-9;
        }
    }

    const dA = [d.dot(ax[0]), d.dot(ax[1]), d.dot(ax[2])];
    const dB = [d.dot(bx[0]), d.dot(bx[1]), d.dot(bx[2])];

    // Least-overlap axis across all 15 candidates, whether or not any is separating: a negative
    // overlap is the gap, which PairTest.step compares against the speculative margin. No early
    // bail on the first separating axis - that would drop every speculative box-box contact.
    let minOverlap = Infinity;
    let bestAxisType = -1; // 0 = face of A, 1 = face of B
    let bestI = -1, bestSign = 1;

    // Face axes of A (3).
    for (let i = 0; i < 3; i++) {
        const ra = halfA[i];
        const rb = halfB[0] * absR[i][0] + halfB[1] * absR[i][1] + halfB[2] * absR[i][2];
        const overlap = ra + rb - Math.abs(dA[i]);
        if (overlap < minOverlap) { minOverlap = overlap; bestAxisType = 0; bestI = i; bestSign = dA[i] >= 0 ? 1 : -1; }
    }
    // Face axes of B (3). bestSign is flipped vs A's: d = posB - posA, so d.dot(bx[j]) >= 0 means
    // A sits on B's -bx[j] side, making that the reference face.
    for (let j = 0; j < 3; j++) {
        const rb = halfB[j];
        const ra = halfA[0] * absR[0][j] + halfA[1] * absR[1][j] + halfA[2] * absR[2][j];
        const overlap = ra + rb - Math.abs(dB[j]);
        if (overlap < minOverlap) { minOverlap = overlap; bestAxisType = 1; bestI = j; bestSign = dB[j] >= 0 ? -1 : 1; }
    }

    const faceOverlap = minOverlap;

    // Edge-edge axes: ax[i] x bx[j], for all 9 combinations.
    let bestEdgeOverlap = Infinity, bestEdgeI = -1, bestEdgeJ = -1;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            const axis = BoxBox._edgeAxis;
            Vector3.crossInto(axis, ax[i], bx[j]);
            const axisLenSq = axis.x * axis.x + axis.y * axis.y + axis.z * axis.z;
            if (axisLenSq < BoxBox.PARALLEL_EPSILON) continue;

            axis.scaleInPlace(1 / Math.sqrt(axisLenSq));

            const dist = Math.abs(d.dot(axis));
            let ra = 0, rb = 0;
            for (let k = 0; k < 3; k++) {
                ra += halfA[k] * Math.abs(ax[k].dot(axis));
                rb += halfB[k] * Math.abs(bx[k].dot(axis));
            }
            const overlap = ra + rb - dist;
            if (overlap < bestEdgeOverlap) { bestEdgeOverlap = overlap; bestEdgeI = i; bestEdgeJ = j; }
        }
    }

    // Prefer the face axis unless an edge axis is a clearly tighter fit, and only take the edge
    // branch when the boxes actually overlap. While separated, SAT's "largest gap wins" rule picks
    // an edge-cross axis over the true face axis under even modest relative tilt, collapsing a
    // speculative face contact into a degenerate edge point that warm-starts wrong. Scale the margin
    // by |faceOverlap| so it behaves the same overlapping or separated. A real corner/edge-first
    // collision (box-box/corner-drop) still clears this and takes the edge branch.
    const tieBreakMargin = Math.max(BoxBox.RELATIVE_TOLERANCE * Math.abs(faceOverlap), BoxBox.ABSOLUTE_TOLERANCE);
    if (faceOverlap >= 0 && bestEdgeI >= 0 && bestEdgeOverlap < faceOverlap - tieBreakMargin) {
        BoxBox._buildEdgeContact(placedA, placedB, ax, bx, halfA, halfB, posA, posB,
            bestEdgeI, bestEdgeJ, bestEdgeOverlap, out, nextContact);
        return out;
    }

    // Too far apart for face clipping to mean anything - let GJK/EPA handle it.
    if (faceOverlap < -BoxBox.SEPARATED_AXIS_LIMIT) return null;

    BoxBox._buildFaceContact(placedA, placedB, ax, bx, halfA, halfB, posA, posB,
        bestAxisType, bestI, bestSign, out, nextContact);
    return out;
};

// Edge-edge contact: closest points between the two axis-aligned segments (A's edge i, B's edge
// j), each a line through its box center along that local axis, clamped to the box's own
// half-extent on the other two axes (the edge nearest the other box, not just any parallel edge).
BoxBox._buildEdgeContact = function (placedA, placedB, ax, bx, halfA, halfB, posA, posB, i, j, overlap, out, nextContact) {
    // Edge i of A: pick the two non-i axes' signs from which side of A the segment nearest B sits on.
    const d = BoxBox._d; // still B - A from test()
    const otherA1 = (i + 1) % 3, otherA2 = (i + 2) % 3;
    const signA1 = d.dot(ax[otherA1]) >= 0 ? 1 : -1;
    const signA2 = d.dot(ax[otherA2]) >= 0 ? 1 : -1;

    const pA = BoxBox._pA, uA = BoxBox._uA;
    pA.copy(posA);
    pA.x += ax[otherA1].x * halfA[otherA1] * signA1 + ax[otherA2].x * halfA[otherA2] * signA2;
    pA.y += ax[otherA1].y * halfA[otherA1] * signA1 + ax[otherA2].y * halfA[otherA2] * signA2;
    pA.z += ax[otherA1].z * halfA[otherA1] * signA1 + ax[otherA2].z * halfA[otherA2] * signA2;
    uA.copy(ax[i]);

    const otherB1 = (j + 1) % 3, otherB2 = (j + 2) % 3;
    const signB1 = -d.dot(bx[otherB1]) >= 0 ? 1 : -1;
    const signB2 = -d.dot(bx[otherB2]) >= 0 ? 1 : -1;

    const pB = BoxBox._pB, uB = BoxBox._uB;
    pB.copy(posB);
    pB.x += bx[otherB1].x * halfB[otherB1] * signB1 + bx[otherB2].x * halfB[otherB2] * signB2;
    pB.y += bx[otherB1].y * halfB[otherB1] * signB1 + bx[otherB2].y * halfB[otherB2] * signB2;
    pB.z += bx[otherB1].z * halfB[otherB1] * signB1 + bx[otherB2].z * halfB[otherB2] * signB2;
    uB.copy(bx[j]);

    // Closest points between the two infinite lines pA + s*uA and pB + t*uB, clamped to each
    // edge's own half-extent along i / j respectively (standard segment-segment closest point).
    const r = BoxBox._segR;
    Vector3.subInto(r, pA, pB);
    const uu = uA.dot(uA), uv = uA.dot(uB), vv = uB.dot(uB);
    const ur = uA.dot(r), vr = uB.dot(r);
    const denom = uu * vv - uv * uv;

    let s = Math.abs(denom) > 1e-9 ? (uv * vr - vv * ur) / denom : 0;
    let t = (uv * s + vr) / vv;
    s = Math.max(-halfA[i], Math.min(halfA[i], s));
    t = Math.max(-halfB[j], Math.min(halfB[j], t));

    const closestA = BoxBox._closestA, closestB = BoxBox._closestB;
    closestA.set(pA.x + uA.x * s, pA.y + uA.y * s, pA.z + uA.z * s);
    closestB.set(pB.x + uB.x * t, pB.y + uB.y * t, pB.z + uB.z * t);

    // Normal: the edge-cross axis, oriented A -> B then flipped to the pipeline's B -> A convention.
    const normal = BoxBox._contactNormal;
    Vector3.crossInto(normal, uA, uB);
    const lenSq = normal.x * normal.x + normal.y * normal.y + normal.z * normal.z;
    if (lenSq > BoxBox.PARALLEL_EPSILON) normal.scaleInPlace(1 / Math.sqrt(lenSq));
    else normal.set(0, 1, 0);
    if (normal.dot(d) < 0) normal.scaleInPlace(-1); // point from A toward B first...
    normal.scaleInPlace(-1); // ...then flip to B -> A, matching SphereSphere/SphereBox's convention.

    const contact = nextContact();
    contact.pointOnA.copy(closestA);
    contact.pointOnB.copy(closestB);
    contact.normal.copy(normal);
    contact.signedDistance = overlap;
    Vector3.addInto(contact.point, closestA, closestB).scaleInPlace(0.5);
    out.push(contact);
};

// Face contact: clip the incident face (the face of the non-reference box most anti-parallel to
// the reference normal) against the reference face's 4 side planes (Sutherland-Hodgman), then keep
// clipped points at or behind the reference face itself (the actual overlap region).
BoxBox._buildFaceContact = function (placedA, placedB, ax, bx, halfA, halfB, posA, posB, axisType, i, sign, out, nextContact) {
    const refIsA = axisType === 0;
    const refAxes = refIsA ? ax : bx, incAxes = refIsA ? bx : ax;
    const refHalf = refIsA ? halfA : halfB, incHalf = refIsA ? halfB : halfA;
    const refPos = refIsA ? posA : posB, incPos = refIsA ? posB : posA;

    const refNormal = BoxBox._refNormal;
    refNormal.copy(refAxes[i]);
    refNormal.scaleInPlace(sign);

    // Incident face: the other box's face most anti-parallel to refNormal (min dot over +/- each axis).
    let incFaceIndex = 0, incFaceSign = 1, best = Infinity;
    for (let k = 0; k < 3; k++) {
        const dp = incAxes[k].dot(refNormal);
        if (dp < best) { best = dp; incFaceIndex = k; incFaceSign = 1; }
        if (-dp < best) { best = -dp; incFaceIndex = k; incFaceSign = -1; }
    }
    const incNormal = BoxBox._incNormal;
    incNormal.copy(incAxes[incFaceIndex]);
    incNormal.scaleInPlace(incFaceSign);

    // The other two axes of each box, used to build the 4 corners of each face.
    const refU = (i + 1) % 3, refV = (i + 2) % 3;
    const incU = (incFaceIndex + 1) % 3, incV = (incFaceIndex + 2) % 3;

    const refCenter = BoxBox._refCenter;
    refCenter.set(
        refPos.x + refNormal.x * refHalf[i],
        refPos.y + refNormal.y * refHalf[i],
        refPos.z + refNormal.z * refHalf[i]
    );
    const incCenter = BoxBox._incCenter;
    incCenter.set(
        incPos.x + incNormal.x * incHalf[incFaceIndex],
        incPos.y + incNormal.y * incHalf[incFaceIndex],
        incPos.z + incNormal.z * incHalf[incFaceIndex]
    );

    // Incident face's 4 corners in world space.
    let poly = BoxBox._polyA;
    const hu = incHalf[incU], hv = incHalf[incV];
    const uAxis = incAxes[incU], vAxis = incAxes[incV];
    for (let c = 0; c < 4; c++) {
        const su = (c === 0 || c === 3) ? -1 : 1;
        const sv = (c < 2) ? -1 : 1;
        poly[c].set(
            incCenter.x + uAxis.x * hu * su + vAxis.x * hv * sv,
            incCenter.y + uAxis.y * hu * su + vAxis.y * hv * sv,
            incCenter.z + uAxis.z * hu * su + vAxis.z * hv * sv
        );
    }
    let polyCount = 4;
    let clipped = BoxBox._polyB;

    // Clip against the reference face's 4 side planes (Sutherland-Hodgman), each plane running
    // through the reference face center, normal = +/- refU or +/- refV axis.
    const sidePlanes = BoxBox._sidePlanes;
    sidePlanes[0].axis = refAxes[refU]; sidePlanes[0].sign = 1; sidePlanes[0].limit = refHalf[refU];
    sidePlanes[1].axis = refAxes[refU]; sidePlanes[1].sign = -1; sidePlanes[1].limit = refHalf[refU];
    sidePlanes[2].axis = refAxes[refV]; sidePlanes[2].sign = 1; sidePlanes[2].limit = refHalf[refV];
    sidePlanes[3].axis = refAxes[refV]; sidePlanes[3].sign = -1; sidePlanes[3].limit = refHalf[refV];

    for (let p = 0; p < 4; p++) {
        const plane = sidePlanes[p];
        const planeAxis = plane.axis, planeSign = plane.sign, limit = plane.limit;
        let outCount = 0;
        for (let c = 0; c < polyCount; c++) {
            const cur = poly[c], next = poly[(c + 1) % polyCount];
            const curDist = (Vector3.subInto(BoxBox._tmp, cur, refCenter).dot(planeAxis)) * planeSign - limit;
            const nextDist = (Vector3.subInto(BoxBox._tmp, next, refCenter).dot(planeAxis)) * planeSign - limit;
            const curInside = curDist <= 0, nextInside = nextDist <= 0;
            if (curInside) clipped[outCount++].copy(cur);
            if (curInside !== nextInside) {
                const t = curDist / (curDist - nextDist);
                clipped[outCount++].set(
                    cur.x + (next.x - cur.x) * t,
                    cur.y + (next.y - cur.y) * t,
                    cur.z + (next.z - cur.z) * t
                );
            }
        }
        polyCount = outCount;
        const swap = poly; poly = clipped; clipped = swap;
        if (polyCount === 0) return; // fully clipped away - shouldn't happen given overlap > 0, but safe
    }

    // Keep points behind the reference face (penetrating) and those just in front of it (still
    // separated - a speculative contact). Reporting all 4 corners together before touch, rather
    // than one at a time as they sink in, is what keeps a flat flush approach torque-free.
    const normalAtoB = BoxBox._normalAtoB;
    normalAtoB.copy(refNormal);
    if (!refIsA) normalAtoB.scaleInPlace(-1); // refNormal is B's outward normal when B is reference; flip to A->B

    for (let c = 0; c < polyCount; c++) {
        const pt = poly[c];
        const rel = Vector3.subInto(BoxBox._tmp, pt, refCenter);
        const depth = -rel.dot(refNormal); // positive = behind the reference face (penetrating)
        if (depth < -BoxBox.SEPARATED_AXIS_LIMIT) continue;

        const contact = nextContact();
        // Project the incident-face point onto the reference face along refNormal for the
        // reference-side witness point; the incident point itself is the incident-side witness.
        const onRef = BoxBox._tmp2;
        onRef.set(pt.x + refNormal.x * depth, pt.y + refNormal.y * depth, pt.z + refNormal.z * depth);

        if (refIsA) { contact.pointOnA.copy(onRef); contact.pointOnB.copy(pt); }
        else { contact.pointOnA.copy(pt); contact.pointOnB.copy(onRef); }

        // Pipeline convention: normal points B -> A.
        contact.normal.set(-normalAtoB.x, -normalAtoB.y, -normalAtoB.z);
        contact.signedDistance = depth;
        Vector3.addInto(contact.point, contact.pointOnA, contact.pointOnB).scaleInPlace(0.5);
        out.push(contact);
    }
};

// --- scratch state -----------------------------------------------------------------------
BoxBox._axesA = [new Vector3(), new Vector3(), new Vector3()];
BoxBox._axesB = [new Vector3(), new Vector3(), new Vector3()];
BoxBox._halfA = [0, 0, 0];
BoxBox._halfB = [0, 0, 0];
BoxBox._d = new Vector3();
BoxBox._R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
BoxBox._absR = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
BoxBox._edgeAxis = new Vector3();

BoxBox._pA = new Vector3();
BoxBox._uA = new Vector3();
BoxBox._pB = new Vector3();
BoxBox._uB = new Vector3();
BoxBox._segR = new Vector3();
BoxBox._closestA = new Vector3();
BoxBox._closestB = new Vector3();
BoxBox._contactNormal = new Vector3();

BoxBox._refNormal = new Vector3();
BoxBox._incNormal = new Vector3();
BoxBox._refCenter = new Vector3();
BoxBox._incCenter = new Vector3();
BoxBox._normalAtoB = new Vector3();
BoxBox._tmp = new Vector3();
BoxBox._tmp2 = new Vector3();
BoxBox._polyA = [new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3()];
BoxBox._polyB = [new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3()];
BoxBox._sidePlanes = [{ axis: null, sign: 1, limit: 0 }, { axis: null, sign: 1, limit: 0 }, { axis: null, sign: 1, limit: 0 }, { axis: null, sign: 1, limit: 0 }];

ActionPhysics.BoxBox = BoxBox;


// ==== src/phases/TriTri.js ====
// Closed-form triangle-triangle face contact: clip the incident triangle against the reference
// triangle's edge half-planes (Sutherland-Hodgman) and emit one contact per surviving vertex.
// Routing a flat mesh face contact through GJK/EPA instead gives one witness point per triangle
// pair, all landing on the shared diagonal - a single-edge manifold that torques a flat drop.
const TriTri = {};

TriTri.applies = function (placedA, placedB) {
    return placedA.shape instanceof TriangleShape && placedB.shape instanceof TriangleShape;
};

// Opposing-face pair: outward normals anti-parallel to within ~2.5 deg.
TriTri.ANTIPARALLEL_DOT = -0.999;
TriTri.SEPARATION_LIMIT = 0.5;  // report a speculative face contact up to this gap in front of A's plane
TriTri.PENETRATION_LIMIT = 1.0; // keep resolving as a face contact up to this depth behind it
TriTri.MIN_AREA = 0.02;         // below this the clipped overlap is a sliver, not a face
TriTri.PERPENDICULAR_DOT = 0.25;
TriTri.EDGE_COINCIDENCE = 1e-3;
TriTri.AREA_EPSILON = 1e-12;

// Unit outward normal of a world-space triangle into `out`. Returns false if degenerate.
TriTri._normalInto = function (out, a, b, c) {
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
    const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
    let nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
    const lenSq = nx * nx + ny * ny + nz * nz;
    if (lenSq < TriTri.AREA_EPSILON) return false;
    const inv = 1 / Math.sqrt(lenSq);
    out.set(nx * inv, ny * inv, nz * inv);
    return true;
};

// Does segment p->q pierce triangle (t0,t1,t2) strictly between its endpoints?
TriTri._segmentHitsTri = function (px, py, pz, qx, qy, qz, t0, t1, t2, tn) {
    const dx = qx - px, dy = qy - py, dz = qz - pz;
    const denom = dx * tn.x + dy * tn.y + dz * tn.z;
    if (denom > -1e-12 && denom < 1e-12) return false;
    const t = ((t0.x - px) * tn.x + (t0.y - py) * tn.y + (t0.z - pz) * tn.z) / denom;
    if (t <= 1e-9 || t >= 1 - 1e-9) return false;
    return TriTri._pointInTri(px + dx * t, py + dy * t, pz + dz * t, t0, t1, t2, tn);
};

// Point-in-triangle, point assumed on the triangle's plane.
TriTri._pointInTri = function (hx, hy, hz, t0, t1, t2, tn) {
    const e0x = t1.x - t0.x, e0y = t1.y - t0.y, e0z = t1.z - t0.z;
    const e1x = t2.x - t1.x, e1y = t2.y - t1.y, e1z = t2.z - t1.z;
    const e2x = t0.x - t2.x, e2y = t0.y - t2.y, e2z = t0.z - t2.z;
    const c0x = hx - t0.x, c0y = hy - t0.y, c0z = hz - t0.z;
    const c1x = hx - t1.x, c1y = hy - t1.y, c1z = hz - t1.z;
    const c2x = hx - t2.x, c2y = hy - t2.y, c2z = hz - t2.z;
    const d0 = tn.x * (e0y * c0z - e0z * c0y) + tn.y * (e0z * c0x - e0x * c0z) + tn.z * (e0x * c0y - e0y * c0x);
    const d1 = tn.x * (e1y * c1z - e1z * c1y) + tn.y * (e1z * c1x - e1x * c1z) + tn.z * (e1x * c1y - e1y * c1x);
    const d2 = tn.x * (e2y * c2z - e2z * c2y) + tn.y * (e2z * c2x - e2x * c2z) + tn.z * (e2x * c2y - e2y * c2x);
    return (d0 >= 0 && d1 >= 0 && d2 >= 0) || (d0 <= 0 && d1 <= 0 && d2 <= 0);
};

// Some edge of one triangle pierces the interior of the other. Shared-boundary touching does not count.
TriTri._trianglesIntersect = function (a0, a1, a2, nA, b0, b1, b2, nB) {
    return TriTri._segmentHitsTri(a0.x, a0.y, a0.z, a1.x, a1.y, a1.z, b0, b1, b2, nB) ||
        TriTri._segmentHitsTri(a1.x, a1.y, a1.z, a2.x, a2.y, a2.z, b0, b1, b2, nB) ||
        TriTri._segmentHitsTri(a2.x, a2.y, a2.z, a0.x, a0.y, a0.z, b0, b1, b2, nB) ||
        TriTri._segmentHitsTri(b0.x, b0.y, b0.z, b1.x, b1.y, b1.z, a0, a1, a2, nA) ||
        TriTri._segmentHitsTri(b1.x, b1.y, b1.z, b2.x, b2.y, b2.z, a0, a1, a2, nA) ||
        TriTri._segmentHitsTri(b2.x, b2.y, b2.z, b0.x, b0.y, b0.z, a0, a1, a2, nA);
};

// Returns `out` on success (may be empty, which vetoes the GJK/EPA fallback in PairTest), or null
// to fall through to GJK/EPA.
TriTri.test = function (placedA, placedB, out, nextContact) {
    const sA = placedA.shape, sB = placedB.shape;
    const a0 = sA.a, a1 = sA.b, a2 = sA.c;
    const b0 = sB.a, b1 = sB.b, b2 = sB.c;

    const nA = TriTri._nA, nB = TriTri._nB;
    if (!TriTri._normalInto(nA, a0, a1, a2)) return null;
    if (!TriTri._normalInto(nB, b0, b1, b2)) return null;

    const ndot = nA.x * nB.x + nA.y * nB.y + nA.z * nB.z;

    if (ndot > TriTri.ANTIPARALLEL_DOT) {
        // Near-perpendicular pair meeting edge-on without interpenetrating (a box's side wall and
        // the top face another box rests on). GJK/EPA would report that shared edge as a contact
        // with an arbitrary horizontal normal; veto it. Real edge-first collisions interpenetrate
        // and reach GJK/EPA via the null return.
        if (Math.abs(ndot) < TriTri.PERPENDICULAR_DOT &&
            !TriTri._trianglesIntersect(a0, a1, a2, nA, b0, b1, b2, nB)) {
            return out;
        }
        return null;
    }

    // refN = A's face normal oriented A->B. Winding is unreliable (inverted-winding meshes point
    // their normals inward), so take the sign from the owning body centers when the midphase
    // provided them; the two flush face triangles' own offset is float noise and flips tick to tick.
    const refN = TriTri._refN;
    refN.copy(nA);
    const cenA = placedA.bodyCenter, cenB = placedB.bodyCenter;
    if (cenA && cenB) {
        if ((cenB.x - cenA.x) * nA.x + (cenB.y - cenA.y) * nA.y + (cenB.z - cenA.z) * nA.z < 0) refN.scaleInPlace(-1);
    } else {
        let farAbs = -1, farSigned = 0;
        for (let k = 0; k < 3; k++) {
            const v = k === 0 ? b0 : (k === 1 ? b1 : b2);
            const d = (v.x - a0.x) * nA.x + (v.y - a0.y) * nA.y + (v.z - a0.z) * nA.z;
            if (Math.abs(d) > farAbs) { farAbs = Math.abs(d); farSigned = d; }
        }
        if (farSigned < 0) refN.scaleInPlace(-1);
    }

    const cBx = (b0.x + b1.x + b2.x) / 3, cBy = (b0.y + b1.y + b2.y) / 3, cBz = (b0.z + b1.z + b2.z) / 3;
    const centroidGap = -((cBx - a0.x) * refN.x + (cBy - a0.y) * refN.y + (cBz - a0.z) * refN.z);
    if (centroidGap < -TriTri.SEPARATION_LIMIT || centroidGap > TriTri.PENETRATION_LIMIT) return null;

    // Clip B against A's three edge half-planes (each with inward normal refN x edge).
    let poly = TriTri._polyIn, clipped = TriTri._polyOut;
    poly[0].set(b0.x, b0.y, b0.z);
    poly[1].set(b1.x, b1.y, b1.z);
    poly[2].set(b2.x, b2.y, b2.z);
    let polyCount = 3;

    const aVerts = TriTri._aVerts;
    aVerts[0] = a0; aVerts[1] = a1; aVerts[2] = a2;

    for (let e = 0; e < 3; e++) {
        const p = aVerts[e], q = aVerts[(e + 1) % 3], r = aVerts[(e + 2) % 3];
        const ex = q.x - p.x, ey = q.y - p.y, ez = q.z - p.z;
        let hx = refN.y * ez - refN.z * ey;
        let hy = refN.z * ex - refN.x * ez;
        let hz = refN.x * ey - refN.y * ex;
        if ((r.x - p.x) * hx + (r.y - p.y) * hy + (r.z - p.z) * hz < 0) { hx = -hx; hy = -hy; hz = -hz; }

        let outCount = 0;
        for (let c = 0; c < polyCount; c++) {
            const cur = poly[c], next = poly[(c + 1) % polyCount];
            const curD = (cur.x - p.x) * hx + (cur.y - p.y) * hy + (cur.z - p.z) * hz;
            const nextD = (next.x - p.x) * hx + (next.y - p.y) * hy + (next.z - p.z) * hz;
            const curIn = curD >= 0, nextIn = nextD >= 0;
            if (curIn) clipped[outCount++].copy(cur);
            if (curIn !== nextIn) {
                const t = curD / (curD - nextD);
                clipped[outCount++].set(
                    cur.x + (next.x - cur.x) * t,
                    cur.y + (next.y - cur.y) * t,
                    cur.z + (next.z - cur.z) * t
                );
            }
        }
        polyCount = outCount;
        const swap = poly; poly = clipped; clipped = swap;
        if (polyCount < 3) return null;
    }

    let area2 = 0;
    for (let c = 1; c < polyCount - 1; c++) {
        const p0 = poly[0], p1 = poly[c], p2 = poly[c + 1];
        const ux = p1.x - p0.x, uy = p1.y - p0.y, uz = p1.z - p0.z;
        const vx = p2.x - p0.x, vy = p2.y - p0.y, vz = p2.z - p0.z;
        const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
        area2 += Math.sqrt(cx * cx + cy * cy + cz * cz);
    }
    if (area2 * 0.5 < TriTri.MIN_AREA) return null;

    let emitted = 0;
    for (let c = 0; c < polyCount; c++) {
        const pt = poly[c];
        const below = -((pt.x - a0.x) * refN.x + (pt.y - a0.y) * refN.y + (pt.z - a0.z) * refN.z);
        if (below < -TriTri.SEPARATION_LIMIT || below > TriTri.PENETRATION_LIMIT) continue;

        const contact = nextContact();
        contact.pointOnB.set(pt.x, pt.y, pt.z);
        contact.pointOnA.set(pt.x + refN.x * below, pt.y + refN.y * below, pt.z + refN.z * below);
        contact.normal.set(-refN.x, -refN.y, -refN.z); // pipeline convention: B -> A
        contact.signedDistance = below;
        contact.fromMeshFace = true;
        Vector3.addInto(contact.point, contact.pointOnA, contact.pointOnB).scaleInPlace(0.5);
        out.push(contact);
        emitted++;
    }

    if (emitted === 0) return null;
    return out;
};

TriTri._nA = new Vector3();
TriTri._nB = new Vector3();
TriTri._refN = new Vector3();
TriTri._aVerts = [null, null, null];
TriTri._polyIn = [new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3()];
TriTri._polyOut = [new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3()];

ActionPhysics.TriTri = TriTri;


// ==== src/phases/ConvexTri.js ====
// Closed-form curved-convex-vs-triangle face contact, replacing GJK/EPA's single witness point,
// whose normal degenerates near a triangle edge or a tile seam. The triangle is treated as a
// one-sided face: the normal is the triangle normal oriented toward the convex's centre, and a
// contact is kept from SEPARATION_LIMIT in front of the face to PENETRATION_LIMIT behind it.
//
// Flat-faced convexes (BoxShape, ConvexShape) are not handled here - GJK/EPA already gives them a
// stable face contact, and this deepest-point path regresses a rotated box landing across a seam.
const ConvexTri = {};

ConvexTri._isCurvedConvex = function (shape) {
    return (shape instanceof SphereShape) || (shape instanceof CylinderShape) ||
        (shape instanceof ConeShape) || (shape instanceof CapsuleShape);
};

ConvexTri.applies = function (placedA, placedB) {
    const aTri = placedA.shape instanceof TriangleShape;
    const bTri = placedB.shape instanceof TriangleShape;
    if (aTri === bTri) return false; // need exactly one triangle
    return aTri ? ConvexTri._isCurvedConvex(placedB.shape) : ConvexTri._isCurvedConvex(placedA.shape);
};

ConvexTri.SEPARATION_LIMIT = 0.5;   // speculative: report a face contact up to this gap in front of the plane
ConvexTri.PENETRATION_LIMIT = 1.0;  // keep resolving as a face contact up to this depth behind it
ConvexTri.MIN_CULL_LIMIT = 0.05;    // floor on the margin-derived 'separated' cull distance
ConvexTri.EDGE_SLACK = 0.06;        // how far outside the triangle a support point may project and still count
ConvexTri.AREA_EPSILON = 1e-12;
ConvexTri.DEDUPE_DIST_SQ = 1e-6;
// Support probes tilted off the contact normal, spaced evenly around it. Four gives a flat-based
// convex a square patch; the tilt is how far off-normal each probe leans.
ConvexTri.PROBE_COUNT = 4;
ConvexTri.PROBE_TILT = 0.5;
// cos/sin of the probe angles scaled by PROBE_TILT, written out because build.js rejects Math.sin/cos.
ConvexTri._PROBE_U = [ConvexTri.PROBE_TILT, 0, -ConvexTri.PROBE_TILT, 0];
ConvexTri._PROBE_V = [0, ConvexTri.PROBE_TILT, 0, -ConvexTri.PROBE_TILT];

// Unit winding normal of a world-space triangle into `out`. Returns false if degenerate.
ConvexTri._normalInto = function (out, a, b, c) {
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
    const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
    let nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
    const lenSq = nx * nx + ny * ny + nz * nz;
    if (lenSq < ConvexTri.AREA_EPSILON) return false;
    const inv = 1 / Math.sqrt(lenSq);
    out.set(nx * inv, ny * inv, nz * inv);
    return true;
};

// Point-in-triangle (point assumed on the plane), with an outward slack of EDGE_SLACK metres.
ConvexTri._pointInTri = function (hx, hy, hz, t0, t1, t2, tn, slack) {
    const e0x = t1.x - t0.x, e0y = t1.y - t0.y, e0z = t1.z - t0.z;
    const e1x = t2.x - t1.x, e1y = t2.y - t1.y, e1z = t2.z - t1.z;
    const e2x = t0.x - t2.x, e2y = t0.y - t2.y, e2z = t0.z - t2.z;
    const c0x = hx - t0.x, c0y = hy - t0.y, c0z = hz - t0.z;
    const c1x = hx - t1.x, c1y = hy - t1.y, c1z = hz - t1.z;
    const c2x = hx - t2.x, c2y = hy - t2.y, c2z = hz - t2.z;
    // signed area (x2) of each sub-triangle about tn; divide by edge length for a metric distance.
    const s0 = tn.x * (e0y * c0z - e0z * c0y) + tn.y * (e0z * c0x - e0x * c0z) + tn.z * (e0x * c0y - e0y * c0x);
    const s1 = tn.x * (e1y * c1z - e1z * c1y) + tn.y * (e1z * c1x - e1x * c1z) + tn.z * (e1x * c1y - e1y * c1x);
    const s2 = tn.x * (e2y * c2z - e2z * c2y) + tn.y * (e2z * c2x - e2x * c2z) + tn.z * (e2x * c2y - e2y * c2x);
    const l0 = Math.sqrt(e0x * e0x + e0y * e0y + e0z * e0z) || 1;
    const l1 = Math.sqrt(e1x * e1x + e1y * e1y + e1z * e1z) || 1;
    const l2 = Math.sqrt(e2x * e2x + e2y * e2y + e2z * e2z) || 1;
    // `tn` here is refN, which may have been flipped away from the triangle's winding normal, so
    // the three sub-areas share a sign but which one is unknown - accept either, like TriTri.
    const d0 = s0 / l0, d1 = s1 / l1, d2 = s2 / l2;
    // How far outside the nearest edge (metres); <= 0 means inside. Take the better of the two
    // winding-sign interpretations.
    const outPos = Math.max(-d0, -d1, -d2);   // if the triangle is CCW about tn
    const outNeg = Math.max(d0, d1, d2);      // if CW
    ConvexTri._lastOutside = Math.min(outPos, outNeg);
    return ConvexTri._lastOutside <= slack;
};

// out: array to push ContactDetails into (pooled via nextContact()). Returns out on success (may
// be empty, which still vetoes the GJK/EPA fallback), or null to fall through to GJK/EPA.
//
// hintNormalBToA (optional): established contact normal (B -> A) from an existing manifold point,
// used to orient the reference face instead of the convex-centre heuristic. GeometryRefresh passes
// it every substep - a settling convex's centroid can creep to within a hair of the triangle plane,
// where the centre heuristic flips the normal and shoves the body through.
// margin (optional): the pair's speculative margin. Only tightens the 'separated' verdict.
ConvexTri.test = function (placedA, placedB, out, nextContact, hintNormalBToA, margin) {
    const aIsTri = placedA.shape instanceof TriangleShape;
    const triPlaced = aIsTri ? placedA : placedB;
    const cvxPlaced = aIsTri ? placedB : placedA;
    const tri = triPlaced.shape;
    const t0 = tri.a, t1 = tri.b, t2 = tri.c;

    // refN = the triangle normal oriented toward the convex. Match an established contact normal
    // when one is supplied; otherwise use the convex's centre, which is unambiguous at first
    // contact - the only place that branch runs.
    const refN = ConvexTri._refN;
    if (!ConvexTri._normalInto(refN, t0, t1, t2)) return null;
    if (hintNormalBToA) {
        // want refN aligned with: aIsTri ? -hintNormal : +hintNormal
        const dot = refN.x * hintNormalBToA.x + refN.y * hintNormalBToA.y + refN.z * hintNormalBToA.z;
        if ((aIsTri && dot > 0) || (!aIsTri && dot < 0)) refN.scaleInPlace(-1);
    } else {
        const cvxPos = cvxPlaced.position;
        if ((cvxPos.x - t0.x) * refN.x + (cvxPos.y - t0.y) * refN.y + (cvxPos.z - t0.z) * refN.z < 0) {
            refN.scaleInPlace(-1);
        }
    }

    // Read by GeometryRefresh's fast re-clip to decide whether a stored triangle is still the one
    // carrying the body. lastDeepestOutsideDist is how far outside the triangle the deepest point
    // projects, in metres (0 when inside).
    ConvexTri.lastDeepestInTriangle = false;
    ConvexTri.lastDeepestOutsideDist = Infinity;
    // 'separated' = provably no contact, caller may skip the GJK/EPA fallback. 'maybe' = no face
    // contact but an edge/vertex hit is still possible.
    ConvexTri.lastVerdict = 'maybe';

    // Deepest convex point toward the triangle = support along -refN.
    const probeDir = ConvexTri._probeDir;
    const dp = ConvexTri._dp;
    const invRot = ConvexTri._invRot.copy(cvxPlaced.rotation).invert();
    const scratchDir = ConvexTri._scratchDir;

    // PairTest.step discards contacts past the pair's margin, so past that the GJK/EPA fallback is
    // wasted work. Marginless callers keep the flat SEPARATION_LIMIT.
    const cullLimit = (margin === undefined || margin === null)
        ? ConvexTri.SEPARATION_LIMIT
        : Math.min(ConvexTri.SEPARATION_LIMIT, Math.max(margin, ConvexTri.MIN_CULL_LIMIT));

    probeDir.set(-refN.x, -refN.y, -refN.z);
    MinkowskiSupport.supportOfInto(dp, cvxPlaced, invRot, probeDir, scratchDir);
    const gap = (dp.x - t0.x) * refN.x + (dp.y - t0.y) * refN.y + (dp.z - t0.z) * refN.z;
    if (gap > ConvexTri.SEPARATION_LIMIT) {
        // SEPARATION_LIMIT, not cullLimit: this branch also gates whether the pair gets a
        // speculative face contact, so narrowing it changes trajectories.
        ConvexTri.lastVerdict = 'separated';
        return null;
    }
    if (gap < -ConvexTri.PENETRATION_LIMIT) return null; // deep behind - let GJK/EPA judge

    // The deepest point, plus tilted probes giving a flat-based or side-lying convex a multi-point
    // patch. Probe directions come from the convex's own frame, not the triangle's, so a prop
    // straddling a seam gets the same set from every triangle under it.
    //
    // A sphere takes the deepest point alone: it touches a plane at one point, and a probe tilted
    // PROBE_TILT off the normal lands r*(1-cos(TILT)) off the plane - far past DEDUPE_DIST_SQ, so
    // the probes would survive as a phantom flat base.
    const cand = ConvexTri._cand;
    let nCand = 0;
    cand[nCand++].copy(dp);

    // Tangent basis for refN, chosen deterministically from refN alone so it does not rotate with
    // the body or the triangle.
    const tanU = ConvexTri._tanU, tanV = ConvexTri._tanV;
    const ax = Math.abs(refN.x), ay = Math.abs(refN.y), az = Math.abs(refN.z);
    if (ax <= ay && ax <= az) tanU.set(0, -refN.z, refN.y);
    else if (ay <= az) tanU.set(-refN.z, 0, refN.x);
    else tanU.set(-refN.y, refN.x, 0);
    const tl = Math.sqrt(tanU.x * tanU.x + tanU.y * tanU.y + tanU.z * tanU.z) || 1;
    tanU.scaleInPlace(1 / tl);
    tanV.set(refN.y * tanU.z - refN.z * tanU.y,
        refN.z * tanU.x - refN.x * tanU.z,
        refN.x * tanU.y - refN.y * tanU.x);

    const probeCount = (cvxPlaced.shape instanceof SphereShape) ? 0 : ConvexTri.PROBE_COUNT;
    for (let e = 0; e < probeCount; e++) {
        const cu = ConvexTri._PROBE_U[e], cv = ConvexTri._PROBE_V[e];
        probeDir.set(-refN.x + tanU.x * cu + tanV.x * cv,
            -refN.y + tanU.y * cu + tanV.y * cv,
            -refN.z + tanU.z * cu + tanV.z * cv);
        const pl = Math.sqrt(probeDir.x * probeDir.x + probeDir.y * probeDir.y + probeDir.z * probeDir.z) || 1;
        probeDir.scaleInPlace(1 / pl);
        MinkowskiSupport.supportOfInto(cand[nCand], cvxPlaced, invRot, probeDir, scratchDir);
        nCand++;
    }

    // refN points from the triangle toward the convex. Pipeline convention: contact.normal points
    // from B to A. So if the convex is B, normal = -refN; if the convex is A, normal = +refN.
    const cvxIsA = !aIsTri;
    const normX = cvxIsA ? refN.x : -refN.x;
    const normY = cvxIsA ? refN.y : -refN.y;
    const normZ = cvxIsA ? refN.z : -refN.z;

    let emitted = 0;
    for (let i = 0; i < nCand; i++) {
        const p = cand[i];
        const g = (p.x - t0.x) * refN.x + (p.y - t0.y) * refN.y + (p.z - t0.z) * refN.z;
        // Record how the true deepest point relates to this triangle, in/out-of-band included.
        if (i === 0 && (g > ConvexTri.SEPARATION_LIMIT || g < -ConvexTri.PENETRATION_LIMIT)) {
            ConvexTri.lastDeepestOutsideDist = Infinity;
        }
        if (g > ConvexTri.SEPARATION_LIMIT || g < -ConvexTri.PENETRATION_LIMIT) continue;
        // project onto the triangle plane
        const projX = p.x - g * refN.x, projY = p.y - g * refN.y, projZ = p.z - g * refN.z;
        const inTri = ConvexTri._pointInTri(projX, projY, projZ, t0, t1, t2, refN, ConvexTri.EDGE_SLACK);
        if (i === 0) {
            ConvexTri.lastDeepestOutsideDist = ConvexTri._lastOutside;
            if (inTri) ConvexTri.lastDeepestInTriangle = true;
        }
        if (!inTri) continue;

        // dedupe against already-emitted points
        let dup = false;
        for (let j = 0; j < emitted; j++) {
            const q = out[out.length - 1 - j];
            const ddx = q.pointOnA.x - p.x, ddy = q.pointOnA.y - p.y, ddz = q.pointOnA.z - p.z;
            if (ddx * ddx + ddy * ddy + ddz * ddz < ConvexTri.DEDUPE_DIST_SQ) { dup = true; break; }
        }
        if (dup) continue;

        const contact = nextContact();
        // pointOnA / pointOnB per the pair's actual A/B roles.
        if (aIsTri) {
            contact.pointOnB.set(p.x, p.y, p.z);                 // convex (B)
            contact.pointOnA.set(projX, projY, projZ);           // triangle (A)
        } else {
            contact.pointOnA.set(p.x, p.y, p.z);                 // convex (A)
            contact.pointOnB.set(projX, projY, projZ);           // triangle (B)
        }
        contact.normal.set(normX, normY, normZ);                 // B -> A
        contact.signedDistance = -g;                             // positive = penetrating
        contact.fromMeshFace = true;
        contact.setMeshTriangle(t0, t1, t2, triPlaced.bodyCenter, aIsTri); // for per-substep re-clip
        Vector3.addInto(contact.point, contact.pointOnA, contact.pointOnB).scaleInPlace(0.5);
        out.push(contact);
        emitted++;
    }

    if (emitted === 0) {
        // The deepest point projects outside the triangle, so its nearest feature is an edge and
        // hypot(along-plane gap, how-far-outside) lower-bounds the distance. Clearing the
        // speculative band by that bound proves separation and lets the caller skip GJK/EPA.
        const outside = ConvexTri.lastDeepestOutsideDist;
        const along = gap > 0 ? gap : 0;
        if (isFinite(outside) && Math.sqrt(along * along + outside * outside) > cullLimit) {
            ConvexTri.lastVerdict = 'separated';
        }
        return null;
    }
    return out;
};

ConvexTri._refN = new Vector3();
ConvexTri._probeDir = new Vector3();
ConvexTri._scratchDir = new Vector3();
ConvexTri._invRot = new Quaternion();
ConvexTri._dp = new Vector3();
ConvexTri._edgeMid = new Vector3();
ConvexTri._tanU = new Vector3();
ConvexTri._tanV = new Vector3();
// One slot for the deepest point plus one per probe.
ConvexTri._cand = [];
for (var _ci = 0; _ci <= ConvexTri.PROBE_COUNT; _ci++) ConvexTri._cand.push(new Vector3());
ConvexTri.lastDeepestInTriangle = false;
ConvexTri.lastDeepestOutsideDist = Infinity;
ConvexTri._lastOutside = 0;
ConvexTri.lastVerdict = 'maybe';
// Metres the deepest point may sit outside a stored triangle and still let the fast re-clip trust
// it: covers jitter and a shallow overhang, not a slide onto the neighbouring tile.
ConvexTri.REFRESH_DRIFT_TOLERANCE = 0.35;

ActionPhysics.ConvexTri = ConvexTri;


// ==== src/phases/BoxTriFace.js ====
// Closed-form contact for a BoxShape face lying flat on a mesh triangle.
//
// GJK/EPA reports one witness point per (box, triangle) pair. A mesh quad is two triangles and a
// resting box usually overlaps both, so each side contributes one wandering point, the manifold
// flickers between one and two points, and every dropped point loses its warm-start lambda - the
// box rocks and gains energy instead of settling.
//
// When the box face is near-parallel to the triangle plane, the contact is instead the box face
// polygon clipped to the triangle: a stable 3-6 point patch. Anything else (box on edge, on a
// corner, or tilted past PARALLEL_COS_LIMIT) returns null and falls through to GJK/EPA, which is
// correct for those - they are single-feature contacts.
const BoxTriFace = {};

BoxTriFace.applies = function (placedA, placedB) {
    const aTri = placedA.shape instanceof TriangleShape;
    const bTri = placedB.shape instanceof TriangleShape;
    if (aTri === bTri) return false; // need exactly one triangle
    // Strictly a BoxShape on the other side. A CompoundShape is not itself convex - its children are
    // dispatched individually by the midphase - so it must never reach the support-map code here.
    const other = aTri ? placedB.shape : placedA.shape;
    return other instanceof BoxShape;
};

// cos of the angle between the box face normal and the triangle normal, above which they count as
// parallel. 0.90 ~ 26 degrees: past that the box is on an edge, not a face. Wide on purpose - a
// tighter limit lets a one-tick landing wobble drop the patch, and the single GJK point that
// replaces it torques the box further over, so the dot never recovers.
BoxTriFace.PARALLEL_COS_LIMIT = 0.90;
// Same speculative band as ConvexTri, so the two paths report contacts over the same range.
BoxTriFace.SEPARATION_LIMIT = 0.5;
BoxTriFace.PENETRATION_LIMIT = 1.0;
// A clipped vertex this far outside the triangle plane's band is dropped.
BoxTriFace.EDGE_SLACK = 0.02;
BoxTriFace.DEDUPE_DIST_SQ = 1e-8;
// Box face area must be within this multiple of the triangle's area for the face patch to apply.
BoxTriFace.MAX_FACE_AREA_RATIO = 4;

BoxTriFace.lastVerdict = 'maybe';
// Fraction of the box face still over this triangle after clipping (1 = entirely inside). Read by
// GeometryRefresh's fast re-clip to tell whether the stored triangle still carries the box.
BoxTriFace.lastFaceCoverage = 0;
BoxTriFace.lastBestDot = 0;

// Returns `out` when it produced a face patch (vetoing GJK/EPA), else null to fall through.
// hintNormalBToA: established manifold normal, used to orient the reference face (same contract as
// ConvexTri.test - the box-centre heuristic flips once a settling box's centre nears the plane).
BoxTriFace.test = function (placedA, placedB, out, nextContact, hintNormalBToA) {
    BoxTriFace.lastVerdict = 'maybe';
    BoxTriFace.lastFaceCoverage = 0;
BoxTriFace.lastBestDot = 0;
    const aIsTri = placedA.shape instanceof TriangleShape;
    const triPlaced = aIsTri ? placedA : placedB;
    const boxPlaced = aIsTri ? placedB : placedA;
    const tri = triPlaced.shape;
    const t0 = tri.a, t1 = tri.b, t2 = tri.c;

    const refN = BoxTriFace._refN;
    if (!ConvexTri._normalInto(refN, t0, t1, t2)) return null;
    if (hintNormalBToA) {
        const d = refN.x * hintNormalBToA.x + refN.y * hintNormalBToA.y + refN.z * hintNormalBToA.z;
        if ((aIsTri && d > 0) || (!aIsTri && d < 0)) refN.scaleInPlace(-1);
    } else {
        const c = boxPlaced.position;
        if ((c.x - t0.x) * refN.x + (c.y - t0.y) * refN.y + (c.z - t0.z) * refN.z < 0) refN.scaleInPlace(-1);
    }

    // Pick the box face whose outward normal is most opposed to refN - the face pointing at the
    // triangle. Bail unless it is near parallel; a tilted box is a single-feature contact.
    const rot = boxPlaced.rotation;
    const axis = BoxTriFace._axis;
    let bestAxis = -1, bestDot = 0, bestSign = 1;
    for (let a = 0; a < 3; a++) {
        axis.set(a === 0 ? 1 : 0, a === 1 ? 1 : 0, a === 2 ? 1 : 0);
        rot.transformVectorInPlace(axis);
        const d = axis.x * refN.x + axis.y * refN.y + axis.z * refN.z;
        const ad = d < 0 ? -d : d;
        if (ad > bestDot) { bestDot = ad; bestAxis = a; bestSign = d < 0 ? 1 : -1; }
    }
    BoxTriFace.lastBestDot = bestDot; // diagnostic: how parallel the chosen face was
    if (bestDot < BoxTriFace.PARALLEL_COS_LIMIT) return null; // not lying flat - let GJK/EPA judge

    // Build the face's four world-space corners: centre + sign*halfExtent along the face axis, then
    // +/- the other two half-extents.
    const shape = boxPlaced.shape;
    const hx = BoxTriFace._hx;
    hx[0] = shape.halfWidth; hx[1] = shape.halfHeight; hx[2] = shape.halfDepth;

    // The patch is the BOX face clipped to the triangle, so it is only the right contact when the
    // box face is the smaller feature. A large static box (a ground slab) under a small mesh
    // triangle is the reverse case: the triangle lies entirely within the face, clipping yields the
    // triangle back, and the resulting patch fights the mesh's own contacts. Fall through to GJK/EPA
    // whenever the box face is not comfortably smaller than the triangle.
    if (!BoxTriFace._boxFaceIsSmaller(hx, bestAxis, t0, t1, t2)) return null;

    const u = BoxTriFace._u, v = BoxTriFace._v, nAxis = BoxTriFace._nAxis;
    const iu = (bestAxis + 1) % 3, iv = (bestAxis + 2) % 3;
    nAxis.set(bestAxis === 0 ? 1 : 0, bestAxis === 1 ? 1 : 0, bestAxis === 2 ? 1 : 0);
    u.set(iu === 0 ? 1 : 0, iu === 1 ? 1 : 0, iu === 2 ? 1 : 0);
    v.set(iv === 0 ? 1 : 0, iv === 1 ? 1 : 0, iv === 2 ? 1 : 0);
    rot.transformVectorInPlace(nAxis);
    rot.transformVectorInPlace(u);
    rot.transformVectorInPlace(v);

    const cx = boxPlaced.position.x + nAxis.x * hx[bestAxis] * bestSign;
    const cy = boxPlaced.position.y + nAxis.y * hx[bestAxis] * bestSign;
    const cz = boxPlaced.position.z + nAxis.z * hx[bestAxis] * bestSign;
    const eu = hx[iu], ev = hx[iv];

    const poly = BoxTriFace._poly;
    let n = 0;
    for (let su = -1; su <= 1; su += 2) {
        for (let sv = -1; sv <= 1; sv += 2) {
            // wind the quad consistently: (-,-), (+,-), (+,+), (-,+)
            const s2 = su < 0 ? sv : -sv;
            const p = poly[n++];
            p.set(cx + u.x * eu * su + v.x * ev * s2,
                cy + u.y * eu * su + v.y * ev * s2,
                cz + u.z * eu * su + v.z * ev * s2);
        }
    }

    // Clip the face quad against the triangle's three edge half-planes, in the triangle's plane.
    let src = poly, srcN = 4, dst = BoxTriFace._clip, dstN = 0;
    const eA = BoxTriFace._eA, eN = BoxTriFace._eN;
    const triVerts = [t0, t1, t2];
    for (let e = 0; e < 3; e++) {
        const va = triVerts[e], vb = triVerts[(e + 1) % 3];
        eA.set(vb.x - va.x, vb.y - va.y, vb.z - va.z);
        // Inward half-plane normal: edge x faceNormal, oriented toward the opposite vertex.
        eN.set(eA.y * refN.z - eA.z * refN.y, eA.z * refN.x - eA.x * refN.z, eA.x * refN.y - eA.y * refN.x);
        const vc = triVerts[(e + 2) % 3];
        if ((vc.x - va.x) * eN.x + (vc.y - va.y) * eN.y + (vc.z - va.z) * eN.z < 0) eN.scaleInPlace(-1);
        const inv = 1 / (Math.sqrt(eN.x * eN.x + eN.y * eN.y + eN.z * eN.z) || 1);
        eN.scaleInPlace(inv);

        dstN = 0;
        for (let i = 0; i < srcN; i++) {
            const cur = src[i], nxt = src[(i + 1) % srcN];
            const dCur = (cur.x - va.x) * eN.x + (cur.y - va.y) * eN.y + (cur.z - va.z) * eN.z + BoxTriFace.EDGE_SLACK;
            const dNxt = (nxt.x - va.x) * eN.x + (nxt.y - va.y) * eN.y + (nxt.z - va.z) * eN.z + BoxTriFace.EDGE_SLACK;
            if (dCur >= 0) dst[dstN++].copy(cur);
            if ((dCur >= 0) !== (dNxt >= 0)) {
                const tt = dCur / (dCur - dNxt);
                dst[dstN++].set(cur.x + (nxt.x - cur.x) * tt, cur.y + (nxt.y - cur.y) * tt, cur.z + (nxt.z - cur.z) * tt);
            }
        }
        if (dstN === 0) return null; // face does not overlap this triangle at all
        const tmp = src; src = dst; srcN = dstN; dst = tmp;
    }
    // Coverage = clipped polygon area / full face area, both measured in the triangle's plane.
    BoxTriFace.lastFaceCoverage = BoxTriFace._polyArea(src, srcN, refN) / (4 * eu * ev);

    // Emit the surviving polygon vertices that are within the speculative band.
    const cvxIsA = !aIsTri;
    const normX = cvxIsA ? refN.x : -refN.x;
    const normY = cvxIsA ? refN.y : -refN.y;
    const normZ = cvxIsA ? refN.z : -refN.z;

    let emitted = 0;
    for (let i = 0; i < srcN; i++) {
        const p = src[i];
        const g = (p.x - t0.x) * refN.x + (p.y - t0.y) * refN.y + (p.z - t0.z) * refN.z;
        if (g > BoxTriFace.SEPARATION_LIMIT || g < -BoxTriFace.PENETRATION_LIMIT) continue;
        const projX = p.x - g * refN.x, projY = p.y - g * refN.y, projZ = p.z - g * refN.z;

        let dup = false;
        for (let j = 0; j < emitted; j++) {
            const q = out[out.length - 1 - j];
            const qa = cvxIsA ? q.pointOnA : q.pointOnB;
            const dx = qa.x - p.x, dy = qa.y - p.y, dz = qa.z - p.z;
            if (dx * dx + dy * dy + dz * dz < BoxTriFace.DEDUPE_DIST_SQ) { dup = true; break; }
        }
        if (dup) continue;

        const contact = nextContact();
        if (aIsTri) {
            contact.pointOnB.set(p.x, p.y, p.z);
            contact.pointOnA.set(projX, projY, projZ);
        } else {
            contact.pointOnA.set(p.x, p.y, p.z);
            contact.pointOnB.set(projX, projY, projZ);
        }
        contact.normal.set(normX, normY, normZ);
        contact.signedDistance = -g;
        contact.fromMeshFace = true;
        contact.setMeshTriangle(t0, t1, t2, triPlaced.bodyCenter, aIsTri);
        Vector3.addInto(contact.point, contact.pointOnA, contact.pointOnB).scaleInPlace(0.5);
        out.push(contact);
        emitted++;
    }

    if (emitted === 0) return null;
    return out;
};

// Area of a planar polygon with the given face normal (fan sum of cross products).
BoxTriFace._polyArea = function (p, n, nrm) {
    if (n < 3) return 0;
    let sx = 0, sy = 0, sz = 0;
    for (let i = 1; i < n - 1; i++) {
        const ax = p[i].x - p[0].x, ay = p[i].y - p[0].y, az = p[i].z - p[0].z;
        const bx = p[i + 1].x - p[0].x, by = p[i + 1].y - p[0].y, bz = p[i + 1].z - p[0].z;
        sx += ay * bz - az * by; sy += az * bx - ax * bz; sz += ax * by - ay * bx;
    }
    return 0.5 * Math.abs(sx * nrm.x + sy * nrm.y + sz * nrm.z);
};

// Is the box face (the two half-extents perpendicular to `axis`) smaller than the triangle? Compares
// the face's area against the triangle's; a ground slab under a small mesh triangle fails this.
BoxTriFace._boxFaceIsSmaller = function (hx, axis, t0, t1, t2) {
    const faceArea = 4 * hx[(axis + 1) % 3] * hx[(axis + 2) % 3];
    const ax = t1.x - t0.x, ay = t1.y - t0.y, az = t1.z - t0.z;
    const bx = t2.x - t0.x, by = t2.y - t0.y, bz = t2.z - t0.z;
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    const triArea = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
    return faceArea <= triArea * BoxTriFace.MAX_FACE_AREA_RATIO;
};

BoxTriFace._refN = new Vector3();
BoxTriFace._axis = new Vector3();
BoxTriFace._hx = [0, 0, 0];
BoxTriFace._u = new Vector3();
BoxTriFace._v = new Vector3();
BoxTriFace._nAxis = new Vector3();
BoxTriFace._eA = new Vector3();
BoxTriFace._eN = new Vector3();
// Clip buffers: a quad clipped by three half-planes can reach 7 vertices.
BoxTriFace._poly = [];
BoxTriFace._clip = [];
for (let i = 0; i < 8; i++) { BoxTriFace._poly.push(new Vector3()); BoxTriFace._clip.push(new Vector3()); }

ActionPhysics.BoxTriFace = BoxTriFace;


// ==== src/phases/TriPlaneCull.js ====
// Cheap conservative "is this convex provably not touching this triangle" test, for the GJK/EPA
// fallback in PairTest to skip. One support-map query plus a point-in-triangle check, vs GJK
// running a full iteration loop only to report the same separation.
//
// Dominant case for a big CompoundShape ground: a prop rests on one tile, its broadphase AABB
// overlaps the neighbouring coplanar tiles, and GJK would run on each just to say "separated".
// ConvexTri already does this for curved convexes as a side effect of building its face contact;
// this covers the flat-faced ones (BoxShape, ConvexShape) it deliberately skips.
const TriPlaneCull = {};

// Same generous bound ConvexTri uses: beyond this a convex can't be in contact with the triangle.
// Comfortably exceeds any per-pair speculative margin at these speeds, so a pair rejected here is
// one PairTest.step() would have discarded against the real margin anyway.
TriPlaneCull.FACE_LIMIT = 0.5;

// placedA/placedB: exactly one is a TriangleShape (world-space verts, identity transform), the
// other any convex. Returns true only when separation is certain (safe to skip GJK/EPA).
TriPlaneCull.separated = function (placedA, placedB) {
    const aTri = placedA.shape instanceof TriangleShape;
    const tri = (aTri ? placedA : placedB).shape;
    const cvx = aTri ? placedB : placedA;
    const t0 = tri.a, t1 = tri.b, t2 = tri.c;

    const n = TriPlaneCull._n;
    if (!ConvexTri._normalInto(n, t0, t1, t2)) return false; // degenerate triangle - let GJK handle

    // Orient n toward the convex, then find the convex's deepest point back toward the triangle.
    const cvxPos = cvx.position;
    if ((cvxPos.x - t0.x) * n.x + (cvxPos.y - t0.y) * n.y + (cvxPos.z - t0.z) * n.z < 0) n.scaleInPlace(-1);

    const probe = TriPlaneCull._probe.set(-n.x, -n.y, -n.z);
    const dp = TriPlaneCull._dp;
    const invRot = TriPlaneCull._invRot.copy(cvx.rotation).invert();
    MinkowskiSupport.supportOfInto(dp, cvx, invRot, probe, TriPlaneCull._scratchDir);

    // Signed distance of the deepest point from the triangle's plane (negative = pokes behind).
    const along = (dp.x - t0.x) * n.x + (dp.y - t0.y) * n.y + (dp.z - t0.z) * n.z;
    if (along < -TriPlaneCull.FACE_LIMIT) return false; // pokes well behind - GJK/EPA judges depth
    if (along > TriPlaneCull.FACE_LIMIT) return true;   // whole convex clears the plane - separated

    // Deepest point is within the band of the plane. Project it and measure how far outside the
    // triangle that projection lands; the true gap is then hypot(along, outside).
    const px = dp.x - along * n.x, py = dp.y - along * n.y, pz = dp.z - along * n.z;
    ConvexTri._pointInTri(px, py, pz, t0, t1, t2, n, 0); // sets ConvexTri._lastOutside
    const outside = ConvexTri._lastOutside;
    if (outside <= 0) return false; // deepest point is over the triangle - contact plausible
    const a = along > 0 ? along : 0;
    return Math.sqrt(a * a + outside * outside) > TriPlaneCull.FACE_LIMIT;
};

TriPlaneCull._n = new Vector3();
TriPlaneCull._probe = new Vector3();
TriPlaneCull._dp = new Vector3();
TriPlaneCull._invRot = new Quaternion();
TriPlaneCull._scratchDir = new Vector3();

ActionPhysics.TriPlaneCull = TriPlaneCull;


// ==== src/phases/PairTest.js ====
// Per-tick pair dispatch and GJK/EPA testing for one primitive-shape pair.
var proto = NarrowPhase.prototype;

proto._nextPooledContact = function () {
    if (this._poolIndex >= this._contactPool.length) this._contactPool.push(new ContactDetails());
    const c = this._contactPool[this._poolIndex++];
    c.fromMeshFace = false;
    c.meshTriValid = false;
    return c;
};

// midphase expands compound/mesh pairs to primitives; dt sizes the speculative margin.
proto.step = function (broadphasePairs, midphase, dt) {
    if (dt) this._dt = dt;
    this._midphase = midphase; // used by the per-substep mesh-face refresh
    this._poolIndex = 0;
    const contactsByPair = new Map(); // canonical "idA:idB" key -> ContactDetails[]

    // Tick-start speeds, consulted by the per-substep geometry refresh to skip re-clipping a
    // manifold whose bodies are effectively at rest (their contact geometry is not moving within
    // the tick, so a re-clip would reproduce the tick-start geometry anyway).
    const spd = this._tickStartSpeedSq || (this._tickStartSpeedSq = new Map());
    spd.clear();
    for (let p = 0; p < broadphasePairs.length; p++) {
        for (let s = 0; s < 2; s++) {
            const b = broadphasePairs[p][s];
            if (b.bodyType !== RigidBody.DYNAMIC || spd.has(b.id)) continue;
            const lv = b.linear_velocity, av = b.angular_velocity;
            spd.set(b.id, {
                lin: lv.x * lv.x + lv.y * lv.y + lv.z * lv.z,
                ang: av.x * av.x + av.y * av.y + av.z * av.z
            });
        }
    }

    for (let p = 0; p < broadphasePairs.length; p++) {
        const bodyA = broadphasePairs[p][0], bodyB = broadphasePairs[p][1];
        const sides = midphase.expandPairSides(bodyA, bodyB);
        const sidesA = sides.a, sidesB = sides.b;
        const key = bodyA.id < bodyB.id ? bodyA.id + ':' + bodyB.id : bodyB.id + ':' + bodyA.id;
        const margin = this._speculativeMargin(bodyA, bodyB);

        // If this pair already has a mesh-face manifold, hand ConvexTri its established normal so
        // it orients the reference face by that instead of the convex-centre heuristic (which
        // flips once a settling convex's centroid creeps to the triangle plane). First contact
        // has no prior manifold and falls back to the heuristic, which is safe when approaching
        // from clearly outside.
        const existing = this.manifolds._manifolds.get(key);
        this._ctHintNormal = (existing && existing.points.length > 0 && existing.points[0].fromMeshFace)
            ? existing.points[0].normal : null;
        // Contacts past this gap are discarded below, so closed-form tests can use it to skip the
        // GJK/EPA fallback. Cleared after the loop; the refresh path has no pair margin.
        this._curMargin = margin;

        let sawMeshFace = false;
        for (let i = 0; i < sidesA.length; i++) {
            for (let j = 0; j < sidesB.length; j++) {
                const pairContacts = this._testPrimitivePair(sidesA[i], sidesB[j]);
                for (let c = 0; c < pairContacts.length; c++) {
                    const contact = pairContacts[c];
                    if (contact.signedDistance < -margin) continue; // gap beyond the speculative margin
                    if (contact.fromMeshFace) sawMeshFace = true;
                    let list = contactsByPair.get(key);
                    if (!list) { list = []; contactsByPair.set(key, list); }
                    list.push(contact);
                }
            }
        }

        // A TriTri face manifold is authoritative for the pair; drop the GJK/EPA single points from
        // its other triangle combinations, which would only unbalance the point set.
        if (sawMeshFace) {
            const list = contactsByPair.get(key);
            let w = 0;
            for (let r = 0; r < list.length; r++) if (list[r].fromMeshFace) list[w++] = list[r];
            list.length = w;
        }

        // Ensure a manifold exists even with zero contacts, so refresh() can prune a separated pair.
        this.manifolds.getOrCreate(bodyA, bodyB);
    }
    this._curMargin = null;

    this.manifolds.refresh(contactsByPair, this._dt);
    return this.manifolds;
};

// Contacts for one primitive pair, into a reused scratch array (copy out before the next call).
// Uses a closed-form test when one applies, else GJK/EPA. Never culls.
proto._testPrimitivePair = function (placedA, placedB) {
    const results = this._pairResultScratch;
    results.length = 0;

    if (SphereSphere.applies(placedA, placedB)) {
        results.push(SphereSphere.test(placedA, placedB, this._nextPooledContact()));
        return results;
    }
    if (SphereBox.applies(placedA, placedB)) {
        results.push(SphereBox.test(placedA, placedB, this._nextPooledContact()));
        return results;
    }
    if (BoxBox.applies(placedA, placedB)) {
        const self = this;
        // null = separated; fall through to GJK/EPA.
        const boxResult = BoxBox.test(placedA, placedB, results, function () { return self._nextPooledContact(); });
        if (boxResult !== null) return results;
    }

    if (TriTri.applies(placedA, placedB)) {
        const self = this;
        // null = not a face pair; fall through to GJK/EPA (same contract as BoxBox.test above).
        const triResult = TriTri.test(placedA, placedB, results, function () { return self._nextPooledContact(); });
        if (triResult !== null) return results;
    }

    if (BoxTriFace.applies(placedA, placedB)) {
        const self = this;
        // Face patch when the box lies flat on the triangle; null = not a face case, keep going.
        const bf = BoxTriFace.test(placedA, placedB, results, function () { return self._nextPooledContact(); }, this._ctHintNormal);
        if (bf !== null) return results;
    }

    if (ConvexTri.applies(placedA, placedB)) {
        const self = this;
        // _ctHintNormal is set per pair by step() from the existing manifold, null on first contact.
        const ctResult = ConvexTri.test(placedA, placedB, results, function () { return self._nextPooledContact(); }, this._ctHintNormal, this._curMargin);
        if (ctResult !== null) return results;                       // face contact
        if (ConvexTri.lastVerdict === 'separated') return results;   // provably no contact - skip GJK/EPA
        // 'maybe': non-face contact still possible (edge/vertex) - fall through to GJK/EPA.
    } else if ((placedA.shape instanceof TriangleShape) !== (placedB.shape instanceof TriangleShape)) {
        // Any other convex (box, hull) vs a mesh triangle: a cheap conservative separation test
        // before GJK/EPA. A prop's broadphase AABB overlaps every tile it is near, but it only
        // touches one - GJK would run full iterations just to report "separated" on the rest. The
        // 0.5m bound comfortably exceeds any per-pair speculative margin at these speeds, so this
        // only rejects pairs step() would discard anyway.
        if (TriPlaneCull.separated(placedA, placedB)) return results;
    }

    const contact = this._nextPooledContact();
    const support = this._support.setSides(placedA, placedB);
    const gjkResult = this._gjk.run(support);
    if (gjkResult.overlapping) {
        const epaResult = this._epa.run(support, gjkResult.simplex);
        contact.setFromEPA(epaResult);
    } else {
        contact.setFromGJKSeparated(gjkResult);
    }
    results.push(contact);
    return results;
};

proto._isCompoundOrMesh = function (shape) {
    return (typeof CompoundShape !== 'undefined' && shape instanceof CompoundShape) ||
        (typeof MeshShape !== 'undefined' && shape instanceof MeshShape);
};


// ==== src/phases/SpeculativeMargin.js ====
// How far ahead of touch a contact is reported, so the predicted-position solve has a constraint
// to work with before overlap. Base margin plus how far the pair closes in one tick.
var proto = NarrowPhase.prototype;

proto._speculativeMargin = function (bodyA, bodyB) {
    const dvx = bodyA.linear_velocity.x - bodyB.linear_velocity.x;
    const dvy = bodyA.linear_velocity.y - bodyB.linear_velocity.y;
    const dvz = bodyA.linear_velocity.z - bodyB.linear_velocity.z;
    const relSpeed = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);
    // A rotating body's corner moves faster than its center; add each body's angular corner speed.
    const angSpeed = NarrowPhase._angularCornerSpeed(bodyA) + NarrowPhase._angularCornerSpeed(bodyB);
    return NarrowPhase.SPECULATIVE_BASE + (relSpeed + angSpeed) * this._dt;
};

// Upper bound on how fast any point on `body` moves purely from rotation: |omega| * bounding radius.
NarrowPhase._angularCornerSpeed = function (body) {
    const w = body.angular_velocity;
    const wMag = Math.sqrt(w.x * w.x + w.y * w.y + w.z * w.z);
    if (wMag === 0) return 0;
    const aabb = body.getAABB();
    const ex = (aabb.max.x - aabb.min.x) * 0.5, ey = (aabb.max.y - aabb.min.y) * 0.5, ez = (aabb.max.z - aabb.min.z) * 0.5;
    return wMag * Math.sqrt(ex * ex + ey * ey + ez * ez);
};


// ==== src/phases/GeometryRefresh.js ====
// Per-substep contact geometry refresh: re-measures existing manifold points against current
// predicted transforms. Geometry only - never adds, removes, or re-matches points.
var proto = NarrowPhase.prototype;

// Speed-squared below which mesh-face contact geometry stays at tick-start values for the substeps.
// Looser than the solver's rest thresholds: a nearly-settled curved prop jitters a few cm/s across a
// tile seam, and re-clipping it each substep only to bail to a full re-expansion is pure cost.
// NarrowPhase.step() still refreshes the tick-start clip once per tick.
NarrowPhase.REFRESH_REST_LIN_SQ = 0.30 * 0.30;
NarrowPhase.REFRESH_REST_ANG_SQ = 0.60 * 0.60;

proto.refreshManifoldGeometry = function (manifolds) {
    // Contacts pooled here are transient - copied into manifold points or the accumulator within
    // this call - and step()'s were already consumed by manifolds.refresh(). Rewinding each substep
    // keeps _poolIndex from climbing all tick and growing the pool.
    this._poolIndex = 0;
    this._ctHintNormal = null; // stale from step()'s pair loop; each branch below sets it as needed
    for (const manifold of manifolds.values()) {
        const bodyA = manifold.bodyA, bodyB = manifold.bodyB;

        if (manifold.points.length > 0 && this._allMeshFace(manifold)) {
            // At rest -> geometry isn't moving this tick; skip the re-clip entirely.
            if (this._pairAtRest(bodyA, bodyB)) continue;
            // Fast path: every point carries its source triangle (ConvexTri), so re-clip only
            // those triangles against the current transform - no midphase re-expansion, no
            // GJK/EPA fallback on non-contact triangles.
            if (this._allMeshTriTagged(manifold)) {
                // Fast re-clip of just the stored triangles. Returns false when a stored triangle
                // stopped producing a contact (the body drifted toward an adjacent tile) - then
                // fall back to the full re-expansion so the new supporting triangle is found.
                if (this._refreshMeshFaceManifoldFast(manifold, bodyA, bodyB)) continue;
                if (this._midphase) {
                    this._ctHintNormal = manifold.points[0].fromMeshFace ? manifold.points[0].normal : null;
                    this._refreshMeshFaceManifold(manifold, bodyA, bodyB);
                    this._ctHintNormal = null;
                }
                continue;
            }
            // Slow path: mixed / TriTri mesh-face manifold - re-expand the pair. Hand any ConvexTri
            // sub-pair the established normal too.
            if (this._midphase) {
                this._ctHintNormal = manifold.points[0].fromMeshFace ? manifold.points[0].normal : null;
                this._refreshMeshFaceManifold(manifold, bodyA, bodyB);
                this._ctHintNormal = null;
                continue;
            }
            continue;
        }

        // Other compound/mesh contacts don't track per-point triangle identity - keep tick-start geometry.
        if (this._isCompoundOrMesh(bodyA.shape) || this._isCompoundOrMesh(bodyB.shape)) continue;

        const placedA = { shape: bodyA.shape, position: bodyA.position, rotation: bodyA.rotation };
        const placedB = { shape: bodyB.shape, position: bodyB.position, rotation: bodyB.rotation };
        const freshList = this._testPrimitivePair(placedA, placedB);
        if (freshList.length === 0) continue;

        // Move each existing point onto its nearest fresh point (BoxBox reports up to 4).
        for (let i = 0; i < manifold.points.length; i++) {
            const p = manifold.points[i];
            let best = null, bestDistSq = Infinity;
            for (let f = 0; f < freshList.length; f++) {
                const fresh = freshList[f];
                const dx = p.point.x - fresh.point.x, dy = p.point.y - fresh.point.y, dz = p.point.z - fresh.point.z;
                const d = dx * dx + dy * dy + dz * dz;
                if (d < bestDistSq) { bestDistSq = d; best = fresh; }
            }
            if (!best) continue;
            p.point.copy(best.point);
            p.pointOnA.copy(best.pointOnA);
            p.pointOnB.copy(best.pointOnB);
            p.signedDistance = best.signedDistance;
            // Keep the established normal inside the exact-touch band (GJK/EPA is ambiguous there).
            if (Math.abs(best.signedDistance) >= ContactManifold.EXACT_TOUCH_BAND) p.normal.copy(best.normal);
            p.setLocalAnchors(bodyA, bodyB); // lambda untouched, warm start survives
        }
    }
};

proto._pairAtRest = function (bodyA, bodyB) {
    const spd = this._tickStartSpeedSq;
    if (!spd) return false;
    const a = spd.get(bodyA.id), b = spd.get(bodyB.id);
    // A body with no entry is static/kinematic (never moves) - treat as at rest.
    if (a && (a.lin > NarrowPhase.REFRESH_REST_LIN_SQ || a.ang > NarrowPhase.REFRESH_REST_ANG_SQ)) return false;
    if (b && (b.lin > NarrowPhase.REFRESH_REST_LIN_SQ || b.ang > NarrowPhase.REFRESH_REST_ANG_SQ)) return false;
    return true;
};

proto._allMeshFace = function (manifold) {
    const pts = manifold.points;
    for (let i = 0; i < pts.length; i++) if (!pts[i].fromMeshFace) return false;
    return true;
};

proto._allMeshTriTagged = function (manifold) {
    const pts = manifold.points;
    for (let i = 0; i < pts.length; i++) if (!pts[i].meshTriValid) return false;
    return true;
};

// Re-clip only the distinct source triangles the manifold's points came from. The mesh side is
// static ground, so its stored world verts are still valid; only the convex has moved. One
// closed-form test per triangle - no BVH query, no re-expansion, no GJK/EPA fallback.
proto._refreshMeshFaceManifoldFast = function (manifold, bodyA, bodyB) {
    const pts = manifold.points;
    const acc = this._meshRefreshAcc || (this._meshRefreshAcc = []);
    acc.length = 0;

    const cvx = pts[0].meshTriIsSideA ? bodyB : bodyA;
    // This calls the closed-form test directly on the body's own shape, so the shape must be one
    // those tests handle - a CompoundShape passed to a support-map test throws.
    //
    // Boxes are excluded: re-clipping only the stored triangles works for a curved convex, which
    // rests on essentially one triangle, but a box face spans several tiles and the stored set can
    // miss one that carries it, dropping that support and sinking the box through. Boxes take the
    // slow route, which re-expands and finds every triangle under the face.
    const isBox = cvx.shape instanceof BoxShape;
    if (isBox || !ConvexTri._isCurvedConvex(cvx.shape)) return false;
    const cvxSide = { shape: cvx.shape, position: cvx.position, rotation: cvx.rotation };
    const triSide = this._meshRefreshTri || (this._meshRefreshTri = {
        shape: new TriangleShape(new Vector3(), new Vector3(), new Vector3()),
        position: new Vector3(0, 0, 0), rotation: new Quaternion(), bodyCenter: new Vector3()
    });

    for (let i = 0; i < pts.length; i++) {
        const src = pts[i];
        // Points usually share one triangle - skip a re-test for a triangle already done this call.
        let seen = false;
        for (let j = 0; j < i; j++) {
            const o = pts[j];
            if (_coincidentTri(src, o)) { seen = true; break; }
        }
        if (seen) continue;

        triSide.shape.a.copy(src.meshTriA);
        triSide.shape.b.copy(src.meshTriB);
        triSide.shape.c.copy(src.meshTriC);
        triSide.bodyCenter.copy(src.meshTriBodyCenter);

        // Established normal as the orientation hint - the convex-centre heuristic is unsafe for a
        // nearly-settled body. Pooled contacts stay valid for the rest of the tick, so they go
        // straight into `acc`; the next ConvexTri.test reuses `fresh` but not what it already holds.
        const self = this;
        const nc = function () { return self._nextPooledContact(); };
        const fresh = this._meshRefreshFresh || (this._meshRefreshFresh = []);
        fresh.length = 0;
        const a = src.meshTriIsSideA ? triSide : cvxSide;
        const b = src.meshTriIsSideA ? cvxSide : triSide;
        const r = ConvexTri.test(a, b, fresh, nc, src.normal);
        // The stored triangle only stays trustworthy while the body's contact feature is still over
        // it. Once it moves off (settling onto a neighbour tile) the re-clip returns nothing, or for
        // ConvexTri only shallow edge probes - enough to look non-empty but missing the real depth,
        // which starves then over-corrects the solver. Bail to the full re-expansion.
        if (!r || !ConvexTri.lastDeepestInTriangle) return false;
        for (let c = 0; c < r.length; c++) if (r[c].fromMeshFace) acc.push(r[c]);
    }

    if (acc.length === 0) return false; // lost contact this substep - re-expand to confirm

    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        let best = null, bestDistSq = Infinity;
        for (let f = 0; f < acc.length; f++) {
            const dx = p.point.x - acc[f].point.x, dy = p.point.y - acc[f].point.y, dz = p.point.z - acc[f].point.z;
            const d = dx * dx + dy * dy + dz * dz;
            if (d < bestDistSq) { bestDistSq = d; best = acc[f]; }
        }
        if (!best) continue;
        p.point.copy(best.point);
        p.pointOnA.copy(best.pointOnA);
        p.pointOnB.copy(best.pointOnB);
        p.signedDistance = best.signedDistance;
        if (Math.abs(best.signedDistance) >= ContactManifold.EXACT_TOUCH_BAND) p.normal.copy(best.normal);
        p.setLocalAnchors(bodyA, bodyB);
    }
    return true;
};

// Re-clip the pair and move each existing point onto its nearest fresh clip point. Geometry only;
// point count and warm-start lambdas are untouched.
proto._refreshMeshFaceManifold = function (manifold, bodyA, bodyB) {
    const sides = this._midphase.expandPairSides(bodyA, bodyB);
    const sidesA = sides.a, sidesB = sides.b;
    // _testPrimitivePair reuses its scratch array per call, so copy the results into a private list.
    const acc = this._meshRefreshAcc || (this._meshRefreshAcc = []);
    acc.length = 0;
    // Only fromMeshFace contacts are kept below, and GJK/EPA never produces those - so run just the
    // closed-form face tests here. Going through the full _testPrimitivePair dispatch would fire
    // GJK on every non-contact triangle of the expansion purely to discard the result.
    const self = this;
    const nc = function () { return self._nextPooledContact(); };
    for (let i = 0; i < sidesA.length; i++) {
        for (let j = 0; j < sidesB.length; j++) {
            const pa = sidesA[i], pb = sidesB[j];
            const pc = this._pairResultScratch;
            pc.length = 0;
            if (BoxTriFace.applies(pa, pb)) BoxTriFace.test(pa, pb, pc, nc, this._ctHintNormal);
            else if (ConvexTri.applies(pa, pb)) ConvexTri.test(pa, pb, pc, nc, this._ctHintNormal);
            else if (TriTri.applies(pa, pb)) TriTri.test(pa, pb, pc, nc);
            else continue;
            for (let c = 0; c < pc.length; c++) if (pc[c].fromMeshFace) {
                const s = this._nextPooledContact();
                s.copy(pc[c]);
                acc.push(s);
            }
        }
    }
    if (acc.length === 0) return; // lost contact this substep - keep last good geometry

    for (let i = 0; i < manifold.points.length; i++) {
        const p = manifold.points[i];
        let best = null, bestDistSq = Infinity;
        for (let f = 0; f < acc.length; f++) {
            const dx = p.point.x - acc[f].point.x, dy = p.point.y - acc[f].point.y, dz = p.point.z - acc[f].point.z;
            const d = dx * dx + dy * dy + dz * dz;
            if (d < bestDistSq) { bestDistSq = d; best = acc[f]; }
        }
        if (!best) continue;
        p.point.copy(best.point);
        p.pointOnA.copy(best.pointOnA);
        p.pointOnB.copy(best.pointOnB);
        p.signedDistance = best.signedDistance;
        if (Math.abs(best.signedDistance) >= ContactManifold.EXACT_TOUCH_BAND) p.normal.copy(best.normal);
        p.setLocalAnchors(bodyA, bodyB);
    }
};

// Two mesh-face contacts sharing the same source triangle (vertex A coincident is enough - the
// tiles are distinct and non-overlapping, so a shared A vertex means the same tile triangle).
var _COINCIDENT_TRI_SQ = 1e-8;
function _coincidentTri(p, q) {
    if (!p.meshTriValid || !q.meshTriValid) return false;
    const dx = p.meshTriA.x - q.meshTriA.x, dy = p.meshTriA.y - q.meshTriA.y, dz = p.meshTriA.z - q.meshTriA.z;
    return dx * dx + dy * dy + dz * dz < _COINCIDENT_TRI_SQ;
}


// ==== src/solver/Solver.js ====
// XPBD solver (Muller et al. 2020). Velocity is derived from position (v = (x - x_prev) / h).
// Per substep: integrate -> refresh contact geometry -> reset lambdas -> solve positions ->
// derive velocity -> solve contact velocity. See Integrate/PositionSolve/VelocitySolve.
class Solver {
    constructor(opts) {
        opts = opts || {};
        this.substeps = opts.substeps || 4;
        this.iterations = opts.iterations || 4; // position-solve passes per substep

        this._rA = new Vector3(); this._rB = new Vector3();
        this._deltaPos = new Vector3();
        this._impulse = new Vector3();
        this._tangent1 = new Vector3(); this._tangent2 = new Vector3();
        this._angularCorrA = new Vector3(); this._angularCorrB = new Vector3();
        this._tmpDispA = new Vector3(); this._tmpDispB = new Vector3(); this._tmpPrev = new Vector3();
        this._prevPos = new Map();
        this._prevRot = new Map();
        this._preGravityVel = new Map();
        this._biasDelta = new Map(); // per-body bias-only correction this substep; excluded from derived velocity
        this._restRing = new Map(); // per-body ring buffer of recent transforms for rest-velocity reconciliation
    }

    // Widens what counts as "explainable by the body's own velocity" in _solvePoint's
    // position/velocity split (PositionSolve.js).
    static EXPLAINABLE_MARGIN = 3;

    // Advances dynamic bodies by dt, resolving manifolds and constraints. `refresh(manifolds)`, if
    // given, re-measures contact geometry each substep before the solve.
    step(bodies, manifolds, gravity, dt, refresh, constraints) {
        const h = dt / this.substeps;
        for (let s = 0; s < this.substeps; s++) {
            this._substep(bodies, manifolds, gravity, h, refresh, constraints);
        }
        this._reconcileRestVelocity(bodies, dt);
    }

    // Zeroes the velocity of a body whose sustained motion over the last REST_WINDOW ticks is below
    // the rest thresholds, from a per-body ring buffer of recent transforms. Once a body has stayed
    // that quiet for REST_PIN_STREAK consecutive ticks it is also transform-pinned: each tick's
    // residual drift is reverted to the previous sampled pose. The per-point Gauss-Seidel contact
    // solve leaks a little tangential drift every substep for non-box shapes (box patches are already
    // centroid-solved, see VelocitySolve.js), so a "settled" cylinder/cone/sphere slowly walks across
    // its support with its reported velocity reading zero. The streak gate keeps this off any body
    // that is only briefly quiet - a rider settling onto a carrier, a shape between bounces - so only
    // a genuinely parked body gets pinned, and a sleeping body then matches a never-slept one exactly.
    // See NOTES.md.
    _reconcileRestVelocity(bodies, dt) {
        const win = REST_WINDOW;
        for (let i = 0; i < bodies.length; i++) {
            const b = bodies[i];
            if (b.bodyType !== RigidBody.DYNAMIC || !b.isAwake) continue;
            let r = this._restRing.get(b.id);
            if (!r) {
                r = { pos: [], rot: [], head: 0, count: 0, quietStreak: 0,
                      pinPos: new Vector3(), pinRot: new Quaternion(), pinned: false };
                for (let k = 0; k < win; k++) { r.pos.push(new Vector3()); r.rot.push(new Quaternion()); }
                this._restRing.set(b.id, r);
            }

            if (r.count === win) {
                // Oldest sample is the one about to be overwritten at head; newest was written last tick.
                const oldPos = r.pos[r.head], oldRot = r.rot[r.head];
                const span = win * dt;
                const ndx = b.position.x - oldPos.x, ndy = b.position.y - oldPos.y, ndz = b.position.z - oldPos.z;
                const windowedLinSpeed = Math.sqrt(ndx * ndx + ndy * ndy + ndz * ndz) / span;
                const linQuiet = windowedLinSpeed < REST_LINEAR_SPEED;
                Solver._deriveAngularVelocity(this._tmpDispA, oldRot, b.rotation, span);
                const angQuiet = this._tmpDispA.length() < REST_ANGULAR_SPEED;

                if (linQuiet) b.linear_velocity.set(0, 0, 0);
                if (angQuiet) b.angular_velocity.set(0, 0, 0);

                const disturbed = b._restDisturbed;
                b._restDisturbed = false;
                if (disturbed) { r.quietStreak = 0; r.pinned = false; }

                if (linQuiet && angQuiet && !disturbed) {
                    r.quietStreak++;
                    if (r.quietStreak >= REST_PIN_STREAK) {
                        if (!r.pinned) {
                            // First pinned tick: capture the pose to hold. Use the oldest ring sample
                            // (REST_WINDOW ticks back) - it predates most of the drift accumulated
                            // during this quiet stretch, so holding it cancels the walk rather than
                            // freezing wherever the walk had reached.
                            r.pinPos.copy(oldPos);
                            r.pinRot.copy(oldRot);
                            r.pinned = true;
                        }
                        b.position.copy(r.pinPos);
                        b.rotation.copy(r.pinRot);
                    }
                } else {
                    r.quietStreak = 0;
                    r.pinned = false;
                }
            } else {
                r.count++;
            }
            r.pos[r.head].copy(b.position);
            r.rot[r.head].copy(b.rotation);
            r.head = (r.head + 1) % win;
        }
    }

    _substep(bodies, manifolds, gravity, h, refresh, constraints) {
        this._integrate(bodies, gravity, h);

        if (refresh) refresh(manifolds);

        this._markRestDisturbances(manifolds);
        this._resetLambdas(manifolds);
        this._solvePositions(manifolds, constraints, h);
        this._deriveVelocities(bodies, h);
        this._solveContactVelocities(manifolds, gravity, h);
    }

    // Flags a dynamic body as disturbed when it shares a touching manifold with an externally-driven
    // mover (see _bodyIsMoving). _reconcileRestVelocity reads the flag to break the body's rest pin
    // the same tick it is pushed, rather than waiting out the trailing window while the pin holds the
    // push out (which reads as an "unpushable" resting object).
    _markRestDisturbances(manifolds) {
        for (const manifold of manifolds.values()) {
            const a = manifold.bodyA, b = manifold.bodyB;
            let touching = false;
            for (let i = 0; i < manifold.points.length; i++) {
                if (manifold.points[i].signedDistance >= -REST_TOUCH_BAND) { touching = true; break; }
            }
            if (!touching) continue;
            if (a.bodyType === RigidBody.DYNAMIC && Solver._bodyIsMoving(b)) a._restDisturbed = true;
            if (b.bodyType === RigidBody.DYNAMIC && Solver._bodyIsMoving(a)) b._restDisturbed = true;
        }
    }

    // Is `body` an externally-driven mover whose contact should break a resting neighbour's pin? A
    // moving kinematic (platform), or a character controller's velocity-driven ghost body (dynamic in
    // type but commanded every tick, flagged isKinematicCharacter), both qualify while actually
    // moving. A plain dynamic body does NOT: a still-settling pile carries residual velocity that must
    // not chatter its neighbours' pins, and a real dynamic-on-dynamic impact wakes and unpins through
    // the ordinary sleep/streak path.
    static _bodyIsMoving(body) {
        const driven = body.bodyType === RigidBody.KINEMATIC || body.isKinematicCharacter === true;
        if (!driven) return false;
        const lv = body.linear_velocity, av = body.angular_velocity;
        return lv.x * lv.x + lv.y * lv.y + lv.z * lv.z > REST_LINEAR_SPEED * REST_LINEAR_SPEED ||
            av.x * av.x + av.y * av.y + av.z * av.z > REST_ANGULAR_SPEED * REST_ANGULAR_SPEED;
    }

    _resetLambdas(manifolds) {
        for (const manifold of manifolds.values()) {
            for (let i = 0; i < manifold.points.length; i++) {
                manifold.points[i].normalLambda = 0;
                manifold.points[i].tangentLambda1 = 0;
                manifold.points[i].tangentLambda2 = 0;
            }
        }
    }

    _solvePositions(manifolds, constraints, h) {
        for (let iter = 0; iter < this.iterations; iter++) {
            for (const manifold of manifolds.values()) {
                this._solveManifold(manifold, h);
            }
            if (constraints) {
                for (let i = 0; i < constraints.length; i++) {
                    if (constraints[i].enabled) constraints[i].solve(h);
                }
            }
        }
    }

    // A contact can only do work if at least one of its bodies is free to move: an awake dynamic
    // body. Two static bodies, or a sleeping body against a static one, form an inert manifold - and
    // solving it anyway lets sub-micron narrowphase drift accumulate into the sleeping body's
    // resting-surface penetration, which then discharges as a position pop when it wakes. A sleeping
    // body against an AWAKE dynamic one is not inert here, but the island manager has already woken
    // it this tick (a touching contact with a restless neighbour force-wakes), so that case does not
    // actually reach the solver with one side still asleep.
    static _manifoldIsInert(bodyA, bodyB) {
        const aFree = bodyA.bodyType === RigidBody.DYNAMIC && bodyA.isAwake;
        const bFree = bodyB.bodyType === RigidBody.DYNAMIC && bodyB.isAwake;
        return !aFree && !bFree;
    }

    _solveManifold(manifold, h) {
        const bodyA = manifold.bodyA, bodyB = manifold.bodyB;
        if (Solver._manifoldIsInert(bodyA, bodyB)) return;
        const n = manifold.points.length;
        if (n <= 1) {
            if (n === 1) this._solvePoint(manifold.points[0], bodyA, bodyB, h);
            return;
        }
        for (let i = 0; i < n; i++) {
            this._solvePoint(manifold.points[i], bodyA, bodyB, h, true);
        }
    }

    _solveContactVelocities(manifolds, gravity, h) {
        for (const manifold of manifolds.values()) {
            const bodyA = manifold.bodyA, bodyB = manifold.bodyB;
            if (Solver._manifoldIsInert(bodyA, bodyB)) continue;
            // A flat face patch solves once at its centroid; everything else per-point.
            if (!this._boxFacePatchVelocity(manifold, bodyA, bodyB, gravity, h)) {
                for (let i = 0; i < manifold.points.length; i++) {
                    this._solveContactVelocity(manifold.points[i], bodyA, bodyB, gravity, h);
                }
            }
            if (manifold.points.length > 0) {
                // Angular friction acts at the most-engaged point.
                let ref = manifold.points[0];
                for (let i = 1; i < manifold.points.length; i++) {
                    if (Math.abs(manifold.points[i].normalLambda) > Math.abs(ref.normalLambda)) ref = manifold.points[i];
                }
                this._solveAngularFriction(ref, bodyA, bodyB, h);
            }
        }
    }
}

// Approach speeds below (gravityMag*h)*this don't bounce - suppresses a resting body's one-substep
// gravity nudge without a fixed absolute cutoff that would kill real small/slow bounces.
Solver.RESTITUTION_SLOP_FACTOR = 8;

// Largest single-point penetration a multi-point manifold resolves per substep (PositionSolve.js).
// The rest is picked up next substep, so one point's correction doesn't move the body before its
// siblings are read.
Solver.MAX_PENETRATION_PER_SUBSTEP = 0.005;

// Rest-velocity reconciliation thresholds (see Solver._reconcileRestVelocity, NOTES.md).
var REST_WINDOW = 8;              // ticks in the trailing velocity window
var REST_LINEAR_SPEED = 0.02;     // units/s windowed speed below which a settled body is zeroed
var REST_ANGULAR_SPEED = 0.05;    // rad/s windowed speed below which a settled body is zeroed
var REST_PIN_STREAK = 12;         // consecutive fully-quiet ticks before a body's transform is pinned
var REST_TOUCH_BAND = 0.005;      // gap (m) within which a manifold point counts as real contact

ActionPhysics.Solver = Solver;


// ==== src/solver/Integrate.js ====
// Integrate velocity and predict position each substep, plus the rotation helpers.
var proto = Solver.prototype;

proto._integrate = function (bodies, gravity, h) {
    for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];

        // A KINEMATIC body is code-driven: no gravity, no forces, no damping, and its velocity is
        // authoritative (never derived back from position). Just carry its transform along its
        // current velocity so contacts this substep see it where it will be, exactly as a dynamic
        // body's predicted position is used. A driver that writes position directly instead of
        // setting velocity leaves linear/angular velocity at zero and this is a no-op.
        if (b.bodyType === RigidBody.KINEMATIC) {
            const lv = b.linear_velocity;
            if (lv.x !== 0 || lv.y !== 0 || lv.z !== 0) b.position.addScaledInPlace(lv, h);
            const av = b.angular_velocity;
            if (av.x !== 0 || av.y !== 0 || av.z !== 0) Solver._integrateRotation(b.rotation, av, h);
            continue;
        }

        if (b.bodyType !== RigidBody.DYNAMIC || !b.isAwake) continue;

        // These snapshots only need to survive within the substep (derived-velocity + restitution
        // read them later this substep, never across substeps), so reuse the per-body slot rather
        // than allocating a fresh Vector3/Quaternion every body every substep - ~6000 allocs/tick
        // otherwise, forever, even at rest.
        let prevPos = this._prevPos.get(b.id);
        if (!prevPos) { prevPos = new Vector3(); this._prevPos.set(b.id, prevPos); }
        prevPos.copy(b.position);
        let prevRot = this._prevRot.get(b.id);
        if (!prevRot) { prevRot = new Quaternion(); this._prevRot.set(b.id, prevRot); }
        prevRot.copy(b.rotation);
        let bias = this._biasDelta.get(b.id);
        if (!bias) { bias = new Vector3(); this._biasDelta.set(b.id, bias); }
        bias.set(0, 0, 0);
        // Pre-gravity snapshot; restitution's pre-solve velocity reads this.
        let preGrav = this._preGravityVel.get(b.id);
        if (!preGrav) { preGrav = new Vector3(); this._preGravityVel.set(b.id, preGrav); }
        preGrav.copy(b.linear_velocity);

        const g = b.gravity || gravity;
        b.linear_velocity.x += g.x * h * b.linear_factor.x;
        b.linear_velocity.y += g.y * h * b.linear_factor.y;
        b.linear_velocity.z += g.z * h * b.linear_factor.z;

        const af = b.accumulated_force;
        if (af.x !== 0 || af.y !== 0 || af.z !== 0) {
            b.linear_velocity.x += af.x * b._mass_inverted * h * b.linear_factor.x;
            b.linear_velocity.y += af.y * b._mass_inverted * h * b.linear_factor.y;
            b.linear_velocity.z += af.z * b._mass_inverted * h * b.linear_factor.z;
        }
        const at = b.accumulated_torque;
        if (at.x !== 0 || at.y !== 0 || at.z !== 0) {
            const I = b._worldInverseInertiaTensor;
            b.angular_velocity.x += (I.e00 * at.x + I.e01 * at.y + I.e02 * at.z) * h * b.angular_factor.x;
            b.angular_velocity.y += (I.e10 * at.x + I.e11 * at.y + I.e12 * at.z) * h * b.angular_factor.y;
            b.angular_velocity.z += (I.e20 * at.x + I.e21 * at.y + I.e22 * at.z) * h * b.angular_factor.z;
        }

        if (b.linear_damping > 0) b.linear_velocity.scaleInPlace(Math.max(0, 1 - b.linear_damping * h));
        if (b.angular_damping > 0) b.angular_velocity.scaleInPlace(Math.max(0, 1 - b.angular_damping * h));

        b.position.addScaledInPlace(b.linear_velocity, h);
        Solver._integrateRotation(b.rotation, b.angular_velocity, h);
        b._recomputeWorldInverseInertia(); // rotation changed

    }
};

proto._deriveVelocities = function (bodies, h) {
    for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        if (b.bodyType !== RigidBody.DYNAMIC || !b.isAwake) continue;
        const prevPos = this._prevPos.get(b.id);
        const prevRot = this._prevRot.get(b.id);
        const bias = this._biasDelta.get(b.id);
        // Bias-only motion (PositionSolve.js) is excluded so it derives no velocity.
        b.linear_velocity.x = (b.position.x - prevPos.x - bias.x) / h;
        b.linear_velocity.y = (b.position.y - prevPos.y - bias.y) / h;
        b.linear_velocity.z = (b.position.z - prevPos.z - bias.z) / h;
        Solver._deriveAngularVelocity(b.angular_velocity, prevRot, b.rotation, h);
    }
};

// Exact exponential-map quaternion integration: dq = (cos(theta/2), sin(theta/2)*axis).
Solver._integrateRotation = function (rotation, angularVelocity, h) {
    const wx = angularVelocity.x, wy = angularVelocity.y, wz = angularVelocity.z;
    const wLenSq = wx * wx + wy * wy + wz * wz;
    if (wLenSq < 1e-24) return;
    const wLen = Math.sqrt(wLenSq);
    const halfAngle = wLen * h * 0.5;
    const s = Scalar.sin(halfAngle) / wLen;
    const dqx = wx * s, dqy = wy * s, dqz = wz * s, dqw = Scalar.cos(halfAngle);

    const qx = rotation.x, qy = rotation.y, qz = rotation.z, qw = rotation.w;
    const rx = dqw * qx + dqx * qw + dqy * qz - dqz * qy;
    const ry = dqw * qy - dqx * qz + dqy * qw + dqz * qx;
    const rz = dqw * qz + dqx * qy - dqy * qx + dqz * qw;
    const rw = dqw * qw - dqx * qx - dqy * qy - dqz * qz;
    rotation.x = rx; rotation.y = ry; rotation.z = rz; rotation.w = rw;
    rotation.normalize();
};

// Angular velocity from the rotation delta between prevRot and rotation: dq = rotation * conj(prevRot).
Solver._deriveAngularVelocity = function (out, prevRot, rotation, h) {
    let dqx = rotation.w * (-prevRot.x) + rotation.x * prevRot.w + rotation.y * (-prevRot.z) - rotation.z * (-prevRot.y);
    let dqy = rotation.w * (-prevRot.y) - rotation.x * (-prevRot.z) + rotation.y * prevRot.w + rotation.z * (-prevRot.x);
    let dqz = rotation.w * (-prevRot.z) + rotation.x * (-prevRot.y) - rotation.y * (-prevRot.x) + rotation.z * prevRot.w;
    let dqw = rotation.w * prevRot.w - rotation.x * (-prevRot.x) - rotation.y * (-prevRot.y) - rotation.z * (-prevRot.z);
    if (dqw < 0) { dqx = -dqx; dqy = -dqy; dqz = -dqz; dqw = -dqw; } // shorter path
    const sinHalf = Math.sqrt(dqx * dqx + dqy * dqy + dqz * dqz);
    if (sinHalf < 1e-12) { out.x = 0; out.y = 0; out.z = 0; return; }
    const halfAngle = Scalar.atan2(sinHalf, dqw);
    const scale = (2 * halfAngle / h) / sinHalf;
    out.x = dqx * scale; out.y = dqy * scale; out.z = dqz * scale;
};


// ==== src/solver/PositionSolve.js ====
// Position-level XPBD solve for one contact point.
var proto = Solver.prototype;

proto._solvePoint = function (point, bodyA, bodyB, h, capPenetration) {
    point.currentAnchorAInto(this._rA, bodyA);
    point.currentAnchorBInto(this._rB, bodyB);
    const nx = point.normal.x, ny = point.normal.y, nz = point.normal.z;
    // C = (anchorB - anchorA).normal, recomputed live (point.signedDistance is a stale tick-start
    // snapshot). Normal points B->A; C > 0 = penetrating.
    const C = (this._rB.x - this._rA.x) * nx + (this._rB.y - this._rA.y) * ny + (this._rB.z - this._rA.z) * nz;
    if (C <= 0) return; // speculative contact not yet touching

    // Captured on the substep this point engages, from pre-gravity velocity, for restitution.
    point._preSolveNormalVel = this._contactRelativeNormalVelocityPreGravity(point, bodyA, bodyB);

    Vector3.subInto(this._rA, this._rA, bodyA.position);
    Vector3.subInto(this._rB, this._rB, bodyB.position);

    const wSum = this._effectiveMass(bodyA, bodyB, this._rA, this._rB, nx, ny, nz);
    if (wSum < 1e-12) return;

    const cappedC = capPenetration ? Math.min(C, Solver.MAX_PENETRATION_PER_SUBSTEP) : C;

    const oldLambda = point.normalLambda;
    let newLambda = oldLambda - cappedC / wSum;
    if (newLambda > 0) newLambda = 0; // a contact pushes apart, never pulls together
    const deltaLambda = newLambda - oldLambda;
    point.normalLambda = newLambda;

    // Only the share explainable by the body's own closing velocity becomes derived velocity; the
    // rest is a pure position edit (biasDelta), subtracted back out in the velocity-derivation
    // step. Lets a loaded resting body correct fully while a raw spawn overlap resolves gently.
    const liveRelVel = this._contactRelativeNormalVelocity(point, bodyA, bodyB);
    const explainableBySubstep = Math.max(liveRelVel, 0) * h * Solver.EXPLAINABLE_MARGIN;
    let velocityC = cappedC;
    if (velocityC > explainableBySubstep) velocityC = explainableBySubstep;
    const velocityDelta = -velocityC / wSum;
    const biasDelta = deltaLambda - velocityDelta;
    this._applyPositionalCorrection(bodyA, bodyB, this._rA, this._rB, nx, ny, nz, velocityDelta, false);
    this._applyPositionalCorrection(bodyA, bodyB, this._rA, this._rB, nx, ny, nz, biasDelta, true);
};

// Generalized inverse mass along direction (dx,dy,dz): linear + angular contribution from both bodies.
proto._effectiveMass = function (bodyA, bodyB, rA, rB, dx, dy, dz) {
    let w = bodyA._mass_inverted + bodyB._mass_inverted;

    const rax = rA.y * dz - rA.z * dy, ray = rA.z * dx - rA.x * dz, raz = rA.x * dy - rA.y * dx;
    const rbx = rB.y * dz - rB.z * dy, rby = rB.z * dx - rB.x * dz, rbz = rB.x * dy - rB.y * dx;

    if (bodyA._mass_inverted > 0) {
        const IA = bodyA._worldInverseInertiaTensor;
        const ix = IA.e00 * rax + IA.e01 * ray + IA.e02 * raz;
        const iy = IA.e10 * rax + IA.e11 * ray + IA.e12 * raz;
        const iz = IA.e20 * rax + IA.e21 * ray + IA.e22 * raz;
        w += rax * ix + ray * iy + raz * iz;
    }
    if (bodyB._mass_inverted > 0) {
        const IB = bodyB._worldInverseInertiaTensor;
        const ix = IB.e00 * rbx + IB.e01 * rby + IB.e02 * rbz;
        const iy = IB.e10 * rbx + IB.e11 * rby + IB.e12 * rbz;
        const iz = IB.e20 * rbx + IB.e21 * rby + IB.e22 * rbz;
        w += rbx * ix + rby * iy + rbz * iz;
    }
    return w;
};

// Applies dLambda*n (plus angular correction) to both bodies: A along -n, B along +n. When `bias`,
// the movement is also recorded into this._biasDelta so the velocity-derivation step subtracts it.
proto._applyPositionalCorrection = function (bodyA, bodyB, rA, rB, nx, ny, nz, dLambda, bias) {
    const px = nx * dLambda, py = ny * dLambda, pz = nz * dLambda;

    if (bodyA._mass_inverted > 0) {
        const dx = -px * bodyA._mass_inverted * bodyA.linear_factor.x;
        const dy = -py * bodyA._mass_inverted * bodyA.linear_factor.y;
        const dz = -pz * bodyA._mass_inverted * bodyA.linear_factor.z;
        bodyA.position.x += dx; bodyA.position.y += dy; bodyA.position.z += dz;
        if (bias) {
            const b = this._biasDelta.get(bodyA.id);
            if (b) { b.x += dx; b.y += dy; b.z += dz; }
        }
        this._applyAngularCorrection(bodyA, rA, -px, -py, -pz);
    }
    if (bodyB._mass_inverted > 0) {
        const dx = px * bodyB._mass_inverted * bodyB.linear_factor.x;
        const dy = py * bodyB._mass_inverted * bodyB.linear_factor.y;
        const dz = pz * bodyB._mass_inverted * bodyB.linear_factor.z;
        bodyB.position.x += dx; bodyB.position.y += dy; bodyB.position.z += dz;
        if (bias) {
            const b = this._biasDelta.get(bodyB.id);
            if (b) { b.x += dx; b.y += dy; b.z += dz; }
        }
        this._applyAngularCorrection(bodyB, rB, px, py, pz);
    }
};

// Small-angle PBD angular update from a linear positional impulse p at offset r: I^-1*(r x p)*0.5.
proto._applyAngularCorrection = function (body, r, px, py, pz) {
    const torqueX = r.y * pz - r.z * py, torqueY = r.z * px - r.x * pz, torqueZ = r.x * py - r.y * px;
    const I = body._worldInverseInertiaTensor;
    const wx = I.e00 * torqueX + I.e01 * torqueY + I.e02 * torqueZ;
    const wy = I.e10 * torqueX + I.e11 * torqueY + I.e12 * torqueZ;
    const wz = I.e20 * torqueX + I.e21 * torqueY + I.e22 * torqueZ;
    const ax = wx * body.angular_factor.x, ay = wy * body.angular_factor.y, az = wz * body.angular_factor.z;
    this._angularCorrA.set(ax, ay, az);
    Solver._integrateRotation(body.rotation, this._angularCorrA, 1); // h=1: this IS the delta, not a rate
};


// ==== src/solver/VelocitySolve.js ====
// Phase 3: velocity-pass contact solve (restitution + Coulomb friction + rolling resistance),
// applied after positions are solved, plus the velocity-space helpers they share.
var proto = Solver.prototype;

// Solving restitution + friction point-by-point over a flat face patch fabricates lateral drift on
// a symmetric drop: each point's off-center impulse spins the body a hair, the next reads the spun
// state, and the impulses no longer cancel. For a genuine face patch (a BoxBox face manifold, or a
// mesh face manifold whose points all come from TriTri) resolve it once at the centroid instead.
// Everything else keeps the per-point solve.
proto.COPLANAR_NORMAL_DOT = 0.9999;

proto._boxFacePatchVelocity = function (manifold, bodyA, bodyB, gravity, h) {
    const pts = manifold.points, n = pts.length;
    if (n < 2) return false;
    const bothBoxes = (bodyA.shape instanceof BoxShape) && (bodyB.shape instanceof BoxShape);
    let allMeshFace = !bothBoxes;
    if (allMeshFace) for (let i = 0; i < n; i++) if (!pts[i].fromMeshFace) { allMeshFace = false; break; }
    if (!bothBoxes && !allMeshFace) return false;

    // A mesh face patch is one face by construction, so use all its points for the centroid - not
    // just the ones the position sweep left engaged this substep. A BoxBox patch uses engaged-only.
    const useAll = allMeshFace;
    let cAx = 0, cAy = 0, cAz = 0, cBx = 0, cBy = 0, cBz = 0;
    let nx = 0, ny = 0, nz = 0, cnt = 0, engaged = 0, maxPre = 0, totLam = 0;
    for (let i = 0; i < n; i++) {
        const p = pts[i];
        const isEngaged = p.normalLambda < 0;
        if (isEngaged) {
            engaged++;
            if (p._preSolveNormalVel > maxPre) maxPre = p._preSolveNormalVel;
            totLam += Math.abs(p.normalLambda);
        }
        if (!useAll && !isEngaged) continue;
        p.currentAnchorAInto(this._rA, bodyA);
        p.currentAnchorBInto(this._rB, bodyB);
        cAx += this._rA.x; cAy += this._rA.y; cAz += this._rA.z;
        cBx += this._rB.x; cBy += this._rB.y; cBz += this._rB.z;
        nx += p.normal.x; ny += p.normal.y; nz += p.normal.z;
        cnt++;
    }
    if (engaged < 1 || cnt < 2) return false;
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (nl < 1e-9) return false;
    nx /= nl; ny /= nl; nz /= nl;
    for (let i = 0; i < n; i++) {
        const p = pts[i];
        if (!useAll && p.normalLambda >= 0) continue;
        if (p.normal.x * nx + p.normal.y * ny + p.normal.z * nz < this.COPLANAR_NORMAL_DOT) return false; // not coplanar
    }

    const inv = 1 / cnt;
    cAx *= inv; cAy *= inv; cAz *= inv; cBx *= inv; cBy *= inv; cBz *= inv;
    this._rA.set(cAx - bodyA.position.x, cAy - bodyA.position.y, cAz - bodyA.position.z);
    this._rB.set(cBx - bodyB.position.x, cBy - bodyB.position.y, cBz - bodyB.position.z);

    // --- Restitution at the centroid ---
    const restitution = Math.max(bodyA.restitution, bodyB.restitution);
    if (restitution > 0) {
        const g = bodyA.gravity || bodyB.gravity || gravity;
        const gravityMag = Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z);
        const restitutionThreshold = gravityMag * h * Solver.RESTITUTION_SLOP_FACTOR;
        if (maxPre > restitutionThreshold) {
            const va = this._pointVelocity(bodyA, this._rA, this._tmpDispB);
            const vax = va.x, vay = va.y, vaz = va.z;
            const vb = this._pointVelocity(bodyB, this._rB, this._tmpDispB);
            const relN = (vb.x - vax) * nx + (vb.y - vay) * ny + (vb.z - vaz) * nz;
            const targetN = -restitution * maxPre;
            if (targetN < relN) {
                const wN = this._effectiveMass(bodyA, bodyB, this._rA, this._rB, nx, ny, nz);
                if (wN >= 1e-12) this._applyVelocityImpulse(bodyA, bodyB, this._rA, this._rB, nx, ny, nz, (targetN - relN) / wN);
            }
        }
    }

    // --- Friction at the centroid (Coulomb cap = friction * total engaged normal impulse) ---
    const friction = Math.sqrt(bodyA.friction * bodyB.friction);
    if (friction > 0) {
        const maxImpulse = friction * totLam / h;
        if (maxImpulse > 0) {
            const va = this._pointVelocity(bodyA, this._rA, this._tmpDispB);
            const vax = va.x, vay = va.y, vaz = va.z;
            const vb = this._pointVelocity(bodyB, this._rB, this._tmpDispB);
            const rvx = vb.x - vax, rvy = vb.y - vay, rvz = vb.z - vaz;
            const vn = rvx * nx + rvy * ny + rvz * nz;
            const vtx = rvx - vn * nx, vty = rvy - vn * ny, vtz = rvz - vn * nz;
            const vtMag = Math.sqrt(vtx * vtx + vty * vty + vtz * vtz);
            if (vtMag >= 1e-12) {
                const tx = vtx / vtMag, ty = vty / vtMag, tz = vtz / vtMag;
                const wT = this._effectiveMass(bodyA, bodyB, this._rA, this._rB, tx, ty, tz);
                if (wT >= 1e-12) {
                    let jt = vtMag / wT;
                    if (jt > maxImpulse) jt = maxImpulse;
                    this._applyVelocityImpulse(bodyA, bodyB, this._rA, this._rB, -tx, -ty, -tz, jt);
                }
            }
        }
    }
    return true;
};

proto._solveContactVelocity = function (point, bodyA, bodyB, gravity, h) {
    if (point.normalLambda >= 0) return; // never engaged this substep - nothing to correct

    point.currentAnchorAInto(this._rA, bodyA);
    point.currentAnchorBInto(this._rB, bodyB);
    Vector3.subInto(this._rA, this._rA, bodyA.position);
    Vector3.subInto(this._rB, this._rB, bodyB.position);
    const nx = point.normal.x, ny = point.normal.y, nz = point.normal.z;

    // --- Restitution (normal) ---
    const restitution = Math.max(bodyA.restitution, bodyB.restitution);
    const relN = this._contactRelativeNormalVelocity(point, bodyA, bodyB);
    const g = bodyA.gravity || bodyB.gravity || gravity;
    const gravityMag = Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z);
    const restitutionThreshold = gravityMag * h * Solver.RESTITUTION_SLOP_FACTOR;
    if (restitution > 0 && point._preSolveNormalVel > restitutionThreshold) {
        const targetN = -restitution * point._preSolveNormalVel;
        if (targetN < relN) { // only add separation, never damp an already-separating contact
            const wN = this._effectiveMass(bodyA, bodyB, this._rA, this._rB, nx, ny, nz);
            if (wN >= 1e-12) this._applyVelocityImpulse(bodyA, bodyB, this._rA, this._rB, nx, ny, nz, (targetN - relN) / wN);
        }
    }

    // --- Friction (tangent) ---
    const friction = Math.sqrt(bodyA.friction * bodyB.friction);
    if (friction <= 0) return;
    const maxImpulse = friction * Math.abs(point.normalLambda) / h;
    if (maxImpulse <= 0) return;

    this._contactRelativeVelocity(point, bodyA, bodyB, this._tmpDispA);
    const vn = this._tmpDispA.x * nx + this._tmpDispA.y * ny + this._tmpDispA.z * nz;
    let vtx = this._tmpDispA.x - vn * nx, vty = this._tmpDispA.y - vn * ny, vtz = this._tmpDispA.z - vn * nz;
    const vtMag = Math.sqrt(vtx * vtx + vty * vty + vtz * vtz);
    if (vtMag < 1e-12) return;

    const tx = vtx / vtMag, ty = vty / vtMag, tz = vtz / vtMag;
    const wT = this._effectiveMass(bodyA, bodyB, this._rA, this._rB, tx, ty, tz);
    if (wT < 1e-12) return;
    let jt = vtMag / wT; // impulse to fully stop tangential motion, clamped to Coulomb cap
    if (jt > maxImpulse) jt = maxImpulse;
    this._applyVelocityImpulse(bodyA, bodyB, this._rA, this._rB, -tx, -ty, -tz, jt);
};

// Damps relative angular velocity in the contact's tangent plane (spin about the normal is left
// alone). Applied once per manifold at the most-engaged point; per-point splitting oscillates.
proto._solveAngularFriction = function (point, bodyA, bodyB, h) {
    const angularFriction = Math.sqrt(Math.max(bodyA.angular_friction, 0) * Math.max(bodyB.angular_friction, 0));
    if (angularFriction <= 0) return;

    const nx = point.normal.x, ny = point.normal.y, nz = point.normal.z;
    const rw = bodyA.angular_velocity, ww = bodyB.angular_velocity;
    let relWx = ww.x - rw.x, relWy = ww.y - rw.y, relWz = ww.z - rw.z;
    const relWn = relWx * nx + relWy * ny + relWz * nz;
    relWx -= relWn * nx; relWy -= relWn * ny; relWz -= relWn * nz;
    const relWMag = Math.sqrt(relWx * relWx + relWy * relWy + relWz * relWz);
    if (relWMag < 1e-9) return;

    const ax = relWx / relWMag, ay = relWy / relWMag, az = relWz / relWMag;
    let wSum = 0;
    if (bodyA._mass_inverted > 0) {
        const IA = bodyA._worldInverseInertiaTensor;
        wSum += ax * (IA.e00 * ax + IA.e01 * ay + IA.e02 * az) + ay * (IA.e10 * ax + IA.e11 * ay + IA.e12 * az) + az * (IA.e20 * ax + IA.e21 * ay + IA.e22 * az);
    }
    if (bodyB._mass_inverted > 0) {
        const IB = bodyB._worldInverseInertiaTensor;
        wSum += ax * (IB.e00 * ax + IB.e01 * ay + IB.e02 * az) + ay * (IB.e10 * ax + IB.e11 * ay + IB.e12 * az) + az * (IB.e20 * ax + IB.e21 * ay + IB.e22 * az);
    }
    if (wSum < 1e-12) return;

    const maxAngImpulse = angularFriction * Math.abs(point.normalLambda) / h;
    if (maxAngImpulse <= 0) return;
    let j = relWMag / wSum;
    if (j > maxAngImpulse) j = maxAngImpulse;

    if (bodyA._mass_inverted > 0) {
        const IA = bodyA._worldInverseInertiaTensor;
        const tqx = ax * j, tqy = ay * j, tqz = az * j;
        bodyA.angular_velocity.x += (IA.e00 * tqx + IA.e01 * tqy + IA.e02 * tqz) * bodyA.angular_factor.x;
        bodyA.angular_velocity.y += (IA.e10 * tqx + IA.e11 * tqy + IA.e12 * tqz) * bodyA.angular_factor.y;
        bodyA.angular_velocity.z += (IA.e20 * tqx + IA.e21 * tqy + IA.e22 * tqz) * bodyA.angular_factor.z;
    }
    if (bodyB._mass_inverted > 0) {
        const IB = bodyB._worldInverseInertiaTensor;
        const tqx = -ax * j, tqy = -ay * j, tqz = -az * j;
        bodyB.angular_velocity.x += (IB.e00 * tqx + IB.e01 * tqy + IB.e02 * tqz) * bodyB.angular_factor.x;
        bodyB.angular_velocity.y += (IB.e10 * tqx + IB.e11 * tqy + IB.e12 * tqz) * bodyB.angular_factor.y;
        bodyB.angular_velocity.z += (IB.e20 * tqx + IB.e21 * tqy + IB.e22 * tqz) * bodyB.angular_factor.z;
    }
};

// Contact-relative velocity (B's point velocity minus A's) into `out`.
proto._contactRelativeVelocity = function (point, bodyA, bodyB, out) {
    point.currentAnchorAInto(this._tmpPrev, bodyA);
    this._tmpPrev.subInPlace(bodyA.position);
    const va = this._pointVelocity(bodyA, this._tmpPrev, this._tmpDispB);
    const vax = va.x, vay = va.y, vaz = va.z;
    point.currentAnchorBInto(this._tmpPrev, bodyB);
    this._tmpPrev.subInPlace(bodyB.position);
    const vb = this._pointVelocity(bodyB, this._tmpPrev, this._tmpDispB);
    out.set(vb.x - vax, vb.y - vay, vb.z - vaz);
    return out;
};

// Velocity of the material point at center-relative offset r on `body`: v + omega x r.
proto._pointVelocity = function (body, r, out) {
    const w = body.angular_velocity, v = body.linear_velocity;
    out.set(
        v.x + (w.y * r.z - w.z * r.y),
        v.y + (w.z * r.x - w.x * r.z),
        v.z + (w.x * r.y - w.y * r.x)
    );
    return out;
};

proto._contactRelativeNormalVelocity = function (point, bodyA, bodyB) {
    this._contactRelativeVelocity(point, bodyA, bodyB, this._tmpDispA);
    return this._tmpDispA.x * point.normal.x + this._tmpDispA.y * point.normal.y + this._tmpDispA.z * point.normal.z;
};

// Same as _contactRelativeNormalVelocity but using each body's linear velocity from before this
// substep's gravity add - used only for restitution's pre-solve capture (PositionSolve.js).
proto._contactRelativeNormalVelocityPreGravity = function (point, bodyA, bodyB) {
    point.currentAnchorAInto(this._tmpPrev, bodyA);
    this._tmpPrev.subInPlace(bodyA.position);
    const preA = this._preGravityVel.get(bodyA.id) || bodyA.linear_velocity;
    const wa = bodyA.angular_velocity, ra = this._tmpPrev;
    const vax = preA.x + (wa.y * ra.z - wa.z * ra.y);
    const vay = preA.y + (wa.z * ra.x - wa.x * ra.z);
    const vaz = preA.z + (wa.x * ra.y - wa.y * ra.x);

    point.currentAnchorBInto(this._tmpPrev, bodyB);
    this._tmpPrev.subInPlace(bodyB.position);
    const preB = this._preGravityVel.get(bodyB.id) || bodyB.linear_velocity;
    const wb = bodyB.angular_velocity, rb = this._tmpPrev;
    const vbx = preB.x + (wb.y * rb.z - wb.z * rb.y);
    const vby = preB.y + (wb.z * rb.x - wb.x * rb.z);
    const vbz = preB.z + (wb.x * rb.y - wb.y * rb.x);

    const dx = vbx - vax, dy = vby - vay, dz = vbz - vaz;
    return dx * point.normal.x + dy * point.normal.y + dz * point.normal.z;
};

// Applies velocity-space impulse j*(dx,dy,dz) at contact offsets rA/rB (A: -j, B: +j).
proto._applyVelocityImpulse = function (bodyA, bodyB, rA, rB, dx, dy, dz, j) {
    const px = dx * j, py = dy * j, pz = dz * j;
    if (bodyA._mass_inverted > 0) {
        bodyA.linear_velocity.x -= px * bodyA._mass_inverted * bodyA.linear_factor.x;
        bodyA.linear_velocity.y -= py * bodyA._mass_inverted * bodyA.linear_factor.y;
        bodyA.linear_velocity.z -= pz * bodyA._mass_inverted * bodyA.linear_factor.z;
        this._applyAngularVelocityImpulse(bodyA, rA, -px, -py, -pz);
    }
    if (bodyB._mass_inverted > 0) {
        bodyB.linear_velocity.x += px * bodyB._mass_inverted * bodyB.linear_factor.x;
        bodyB.linear_velocity.y += py * bodyB._mass_inverted * bodyB.linear_factor.y;
        bodyB.linear_velocity.z += pz * bodyB._mass_inverted * bodyB.linear_factor.z;
        this._applyAngularVelocityImpulse(bodyB, rB, px, py, pz);
    }
};

proto._applyAngularVelocityImpulse = function (body, r, px, py, pz) {
    const tqx = r.y * pz - r.z * py, tqy = r.z * px - r.x * pz, tqz = r.x * py - r.y * px;
    const I = body._worldInverseInertiaTensor;
    body.angular_velocity.x += (I.e00 * tqx + I.e01 * tqy + I.e02 * tqz) * body.angular_factor.x;
    body.angular_velocity.y += (I.e10 * tqx + I.e11 * tqy + I.e12 * tqz) * body.angular_factor.y;
    body.angular_velocity.z += (I.e20 * tqx + I.e21 * tqy + I.e22 * tqz) * body.angular_factor.z;
};

// Two unit vectors spanning the plane perpendicular to `normal`.
Solver._tangentBasis = function (normal, outT1, outT2) {
    outT1.findOrthogonal(normal);
    Vector3.crossInto(outT2, normal, outT1);
};


// ==== src/solver/IslandManager.js ====
// Decides which bodies are asleep each tick, as coupled groups (islands), parking or waking whole
// islands together. Per-body sleep is wrong for stacks: the bottom body sleeps while the top is
// still settling and sags into it. Two dynamic bodies are coupled by a contact manifold or an
// enabled constraint; static/kinematic bodies are boundaries, not links (or the floor would chain
// the whole world into one island). Runs after narrowphase, before the solver.
class IslandManager {
    // A body is "quiet" this tick when both speeds are below these. The angular threshold sits well
    // above the ~0.071 rad/s band a side-resting cylinder oscillates in forever, so it doesn't
    // sleep/wake on the boundary.
    static LINEAR_SLEEP_THRESHOLD = 0.05;        // m/s
    static ANGULAR_SLEEP_THRESHOLD = 0.12;       // rad/s

    // Seconds an entire island must stay quiet before it parks.
    static TIME_TO_SLEEP = 0.5;

    constructor() {
        this._parent = new Map();  // union-find, rebuilt each tick: bodyId -> bodyId
        this._islands = new Map(); // island root id -> { members, allQuiet }, rebuilt each tick
    }

    _find(id) {
        let root = id;
        while (this._parent.get(root) !== root) root = this._parent.get(root);
        // Path compression.
        let cur = id;
        while (this._parent.get(cur) !== root) {
            const next = this._parent.get(cur);
            this._parent.set(cur, root);
            cur = next;
        }
        return root;
    }

    _union(a, b) {
        const ra = this._find(a), rb = this._find(b);
        if (ra !== rb) this._parent.set(ra, rb);
    }

    _ensure(id) {
        if (!this._parent.has(id)) this._parent.set(id, id);
    }

    // Updates sleep state for every dynamic body. After this runs, isAwake === false means the
    // solver may skip the body this tick.
    update(bodies, manifolds, constraints, dt) {
        this._parent.clear();
        this._islands.clear();

        // 1. Seed the forest with every dynamic body as a singleton.
        for (let i = 0; i < bodies.length; i++) {
            const b = bodies[i];
            if (b.bodyType === RigidBody.DYNAMIC) this._ensure(b.id);
        }

        // 2. Union dynamic bodies coupled by a contact.
        for (const manifold of manifolds.values()) {
            const a = manifold.bodyA, b = manifold.bodyB;
            const aDyn = a.bodyType === RigidBody.DYNAMIC, bDyn = b.bodyType === RigidBody.DYNAMIC;
            if (aDyn && bDyn) this._union(a.id, b.id);
        }

        // 3. Union dynamic bodies coupled by an enabled constraint (bodyB null = world-anchored, no union).
        if (constraints) {
            for (let i = 0; i < constraints.length; i++) {
                const c = constraints[i];
                if (!c.enabled || !c.bodyB) continue;
                const aDyn = c.bodyA.bodyType === RigidBody.DYNAMIC, bDyn = c.bodyB.bodyType === RigidBody.DYNAMIC;
                if (aDyn && bDyn) this._union(c.bodyA.id, c.bodyB.id);
            }
        }

        // 4. Force awake any dynamic body touching a moving kinematic body or an awake dynamic one,
        //    regardless of its own speed. A static contact is not a forcing influence.
        const forcedAwake = new Set();
        for (const manifold of manifolds.values()) {
            const a = manifold.bodyA, b = manifold.bodyB;
            IslandManager._maybeForceAwakeFromNeighbor(a, b, forcedAwake);
            IslandManager._maybeForceAwakeFromNeighbor(b, a, forcedAwake);
        }

        // 5. Group by island root, recording each body's quietness.
        const bodyById = IslandManager._indexById(bodies);
        for (const [id, ] of this._parent) {
            const root = this._find(id);
            let island = this._islands.get(root);
            if (!island) { island = { members: [], allQuiet: true }; this._islands.set(root, island); }
            const body = bodyById.get(id);
            island.members.push(body);
            const quiet = !forcedAwake.has(id) && IslandManager._isQuiet(body);
            if (!quiet) island.allQuiet = false;
        }

        // 6. Park an island once every member has been quiet past TIME_TO_SLEEP; wake the whole
        //    island if any member is restless.
        for (const island of this._islands.values()) {
            if (island.allQuiet) {
                let minTimer = Infinity;
                for (const body of island.members) {
                    body.sleepTimer += dt;
                    if (body.sleepTimer < minTimer) minTimer = body.sleepTimer;
                }
                if (minTimer >= IslandManager.TIME_TO_SLEEP) {
                    for (const body of island.members) body.sleep();
                }
            } else {
                for (const body of island.members) {
                    if (!body.isAwake) body.wakeUp();
                    body.sleepTimer = 0;
                }
            }
        }
    }

    // Force `body` awake if `other` is a moving kinematic body or an awake dynamic one.
    static _maybeForceAwakeFromNeighbor(body, other, forcedAwake) {
        if (body.bodyType !== RigidBody.DYNAMIC) return;
        if (other.bodyType === RigidBody.KINEMATIC) {
            if (!IslandManager._isQuiet(other)) forcedAwake.add(body.id);
        } else if (other.bodyType === RigidBody.DYNAMIC) {
            if (other.isAwake && !IslandManager._isQuiet(other)) forcedAwake.add(body.id);
        }
    }

    static _isQuiet(body) {
        const lv = body.linear_velocity, av = body.angular_velocity;
        const linSq = lv.x * lv.x + lv.y * lv.y + lv.z * lv.z;
        const angSq = av.x * av.x + av.y * av.y + av.z * av.z;
        return linSq <= IslandManager.LINEAR_SLEEP_THRESHOLD * IslandManager.LINEAR_SLEEP_THRESHOLD &&
            angSq <= IslandManager.ANGULAR_SLEEP_THRESHOLD * IslandManager.ANGULAR_SLEEP_THRESHOLD;
    }

    static _indexById(bodies) {
        const map = new Map();
        for (let i = 0; i < bodies.length; i++) map.set(bodies[i].id, bodies[i]);
        return map;
    }
}

ActionPhysics.IslandManager = IslandManager;


// ==== src/constraints/Constraint.js ====
// Base class for the joints (Point, Hinge, Slider, Weld). Each computes its own position error C
// and corrects it with the contact solver's generalized-inverse-mass math; solve() runs once per
// substep before velocity is derived. All rigid, no compliance.
class Constraint {
    constructor(bodyA, bodyB) {
        this.bodyA = bodyA;
        this.bodyB = bodyB; // null = anchored to the world
        this.enabled = true;
    }
}

ActionPhysics.Constraint = Constraint;


// ==== src/constraints/PointConstraint.js ====
// Ball/socket joint: pins bodyA's local anchor to bodyB's (or a fixed world point if bodyB null).
// Full 3x3 coupled XPBD solve (C = worldB - worldA), not 3 independent scalar passes.
class PointConstraint extends Constraint {
    constructor(bodyA, bodyB, localAnchorA, localAnchorB) {
        super(bodyA, bodyB);
        this.localAnchorA = new Vector3().copy(localAnchorA);
        this.localAnchorB = new Vector3().copy(localAnchorB); // world point if bodyB is null

        this._worldA = new Vector3();
        this._worldB = new Vector3();
        this._rA = new Vector3();
        this._rB = new Vector3();
        this._C = new Vector3();
        this._delta = new Vector3();
        this._K = new Matrix3();
        this._Kinv = new Matrix3();
        this.breaking_threshold = null; // null = never breaks
    }

    _anchorAWorld(out) {
        out.copy(this.localAnchorA);
        this.bodyA.rotation.transformVectorInPlace(out);
        out.addInPlace(this.bodyA.position);
        return out;
    }

    _anchorBWorld(out) {
        if (!this.bodyB) { out.copy(this.localAnchorB); return out; }
        out.copy(this.localAnchorB);
        this.bodyB.rotation.transformVectorInPlace(out);
        out.addInPlace(this.bodyB.position);
        return out;
    }

    solve(h) {
        if (!this.enabled) return;
        const bodyA = this.bodyA, bodyB = this.bodyB;
        const hasB = !!(bodyB && bodyB._mass_inverted > 0);

        this._anchorAWorld(this._worldA);
        this._anchorBWorld(this._worldB);
        Vector3.subInto(this._C, this._worldB, this._worldA);
        if (this._C.lengthSquared() < 1e-20) return;

        Vector3.subInto(this._rA, this._worldA, bodyA.position);
        if (hasB) Vector3.subInto(this._rB, this._worldB, bodyB.position);
        else this._rB.set(0, 0, 0);

        this._buildEffectiveMassMatrix(this._K, bodyA, hasB ? bodyB : null, this._rA, this._rB);
        if (!this._Kinv.invertInto(this._K)) return;

        const cx = -this._C.x, cy = -this._C.y, cz = -this._C.z;
        const K = this._Kinv;
        this._delta.set(
            K.e00 * cx + K.e01 * cy + K.e02 * cz,
            K.e10 * cx + K.e11 * cy + K.e12 * cz,
            K.e20 * cx + K.e21 * cy + K.e22 * cz
        );

        // delta/h^2 is the force-equivalent breaking_threshold checks - raw C alone stays near zero
        // regardless of load.
        if (this.breaking_threshold != null && this._delta.length() / (h * h) > this.breaking_threshold) {
            this.enabled = false;
            return;
        }

        this._applyCorrection(bodyA, this._rA, this._delta, -1);
        if (hasB) this._applyCorrection(bodyB, this._rB, this._delta, 1);
    }

    // K = (1/mA + 1/mB)*I3 - [rA×]*IA^-1*[rA×] - [rB×]*IB^-1*[rB×].
    _buildEffectiveMassMatrix(out, bodyA, bodyB, rA, rB) {
        const mSum = bodyA._mass_inverted + (bodyB ? bodyB._mass_inverted : 0);
        out.e00 = mSum; out.e01 = 0; out.e02 = 0;
        out.e10 = 0; out.e11 = mSum; out.e12 = 0;
        out.e20 = 0; out.e21 = 0; out.e22 = mSum;
        if (bodyA._mass_inverted > 0) PointConstraint._subtractSkewInertiaSkew(out, rA, bodyA._worldInverseInertiaTensor);
        if (bodyB && bodyB._mass_inverted > 0) PointConstraint._subtractSkewInertiaSkew(out, rB, bodyB._worldInverseInertiaTensor);
    }

    // out -= [r×]^T * I * [r×]
    static _subtractSkewInertiaSkew(out, r, I) {
        const rx = r.x, ry = r.y, rz = r.z;
        const m00 = I.e01 * rz - I.e02 * ry, m01 = -I.e00 * rz + I.e02 * rx, m02 = I.e00 * ry - I.e01 * rx;
        const m10 = I.e11 * rz - I.e12 * ry, m11 = -I.e10 * rz + I.e12 * rx, m12 = I.e10 * ry - I.e11 * rx;
        const m20 = I.e21 * rz - I.e22 * ry, m21 = -I.e20 * rz + I.e22 * rx, m22 = I.e20 * ry - I.e21 * rx;
        out.e00 -= (-rz * m10 + ry * m20); out.e01 -= (-rz * m11 + ry * m21); out.e02 -= (-rz * m12 + ry * m22);
        out.e10 -= (rz * m00 - rx * m20); out.e11 -= (rz * m01 - rx * m21); out.e12 -= (rz * m02 - rx * m22);
        out.e20 -= (-ry * m00 + rx * m10); out.e21 -= (-ry * m01 + rx * m11); out.e22 -= (-ry * m02 + rx * m12);
    }

    // sign: -1 for bodyA, +1 for bodyB (matches C = worldB - worldA).
    _applyCorrection(body, r, delta, sign) {
        if (body._mass_inverted <= 0) return;
        body.position.x += sign * delta.x * body._mass_inverted * body.linear_factor.x;
        body.position.y += sign * delta.y * body._mass_inverted * body.linear_factor.y;
        body.position.z += sign * delta.z * body._mass_inverted * body.linear_factor.z;

        const px = sign * delta.x, py = sign * delta.y, pz = sign * delta.z;
        const torqueX = r.y * pz - r.z * py, torqueY = r.z * px - r.x * pz, torqueZ = r.x * py - r.y * px;
        const I = body._worldInverseInertiaTensor;
        const wx = I.e00 * torqueX + I.e01 * torqueY + I.e02 * torqueZ;
        const wy = I.e10 * torqueX + I.e11 * torqueY + I.e12 * torqueZ;
        const wz = I.e20 * torqueX + I.e21 * torqueY + I.e22 * torqueZ;
        PointConstraint._scratchAngular.set(wx * body.angular_factor.x, wy * body.angular_factor.y, wz * body.angular_factor.z);
        Solver._integrateRotation(body.rotation, PointConstraint._scratchAngular, 1);
    }
}

PointConstraint._scratchAngular = new Vector3();

ActionPhysics.PointConstraint = PointConstraint;


// ==== src/constraints/HingeConstraint.js ====
// Hinge: pivot (3 DOF, via composed PointConstraint) + axis lock (2 DOF), optional swing limit/motor.
class HingeConstraint extends Constraint {
    constructor(bodyA, hingeAxisA, pivotA, bodyB, pivotB) {
        super(bodyA, bodyB);
        this.localAxisA = new Vector3().copy(hingeAxisA).normalizeInPlace();
        this.localPivotA = new Vector3().copy(pivotA);
        this.localPivotB = new Vector3().copy(pivotB || new Vector3());

        this.localAxisB = new Vector3();
        if (bodyB) {
            const worldAxis = HingeConstraint._scratchV1.copy(this.localAxisA);
            bodyA.rotation.transformVectorInPlace(worldAxis);
            const invRotB = HingeConstraint._scratchQ.copy(bodyB.rotation).invert();
            this.localAxisB.copy(worldAxis);
            invRotB.transformVectorInPlace(this.localAxisB);
        }
        this._pivot = new PointConstraint(bodyA, bodyB, this.localPivotA, bodyB ? this.localPivotB : this._worldPivotBPlaceholder());

        // Swing-angle reference vector, perpendicular to the axis, in each body's local space.
        this._refA = HingeConstraint._perpendicularTo(this.localAxisA);
        if (bodyB) {
            const worldRef = HingeConstraint._scratchV1.copy(this._refA);
            bodyA.rotation.transformVectorInPlace(worldRef);
            const invRotB = HingeConstraint._scratchQ.copy(bodyB.rotation).invert();
            this._refB = new Vector3().copy(worldRef);
            invRotB.transformVectorInPlace(this._refB);
        } else {
            this._refB = null;
            this._fixedWorldRef = HingeConstraint._scratchV1.copy(this._refA);
            bodyA.rotation.transformVectorInPlace(this._fixedWorldRef);
            this._fixedWorldRef = new Vector3().copy(this._fixedWorldRef);
        }

        this.limit = { min: null, max: null, set: function (min, max) { this.min = min; this.max = max; return this; } };
        this.motor = { targetVelocity: 0, maxTorque: 0, set: function (targetVelocity, maxTorque) { this.targetVelocity = targetVelocity; this.maxTorque = maxTorque; return this; } };
    }

    // Gram-Schmidt: any vector not parallel to axis, made perpendicular + unit length.
    static _perpendicularTo(axis) {
        const seed = Math.abs(axis.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
        const d = seed.x * axis.x + seed.y * axis.y + seed.z * axis.z;
        const perp = new Vector3(seed.x - d * axis.x, seed.y - d * axis.y, seed.z - d * axis.z);
        return perp.normalizeInPlace();
    }

    // Null bodyB: PointConstraint wants a world point, so use bodyA's own world pivot at construction.
    _worldPivotBPlaceholder() {
        const world = HingeConstraint._scratchV2.copy(this.localPivotA);
        this.bodyA.rotation.transformVectorInPlace(world);
        world.addInPlace(this.bodyA.position);
        return new Vector3().copy(world);
    }

    solve(h) {
        if (!this.enabled) return;
        this._pivot.solve(h);
        this._solveAxisAlignment();
        if (this.limit.min != null || this.limit.max != null) this._solveLimit();
        if (this.motor.maxTorque > 0) this._solveMotor(h);
    }

    // Signed swing angle about the axis, refB -> refA, both projected into the plane perpendicular to axis.
    _swingAngle() {
        const bodyA = this.bodyA, bodyB = this.bodyB;
        const axis = HingeConstraint._scratchAxis.copy(this.localAxisA);
        bodyA.rotation.transformVectorInPlace(axis);

        const refA = HingeConstraint._scratchV1.copy(this._refA);
        bodyA.rotation.transformVectorInPlace(refA);

        const refB = HingeConstraint._scratchV2;
        if (bodyB) { refB.copy(this._refB); bodyB.rotation.transformVectorInPlace(refB); }
        else refB.copy(this._fixedWorldRef);

        HingeConstraint._projectOntoPlane(refA, axis);
        HingeConstraint._projectOntoPlane(refB, axis);
        const dot = refA.x * refB.x + refA.y * refB.y + refA.z * refB.z;
        const cx = refB.y * refA.z - refB.z * refA.y, cy = refB.z * refA.x - refB.x * refA.z, cz = refB.x * refA.y - refB.y * refA.x;
        const crossDotAxis = cx * axis.x + cy * axis.y + cz * axis.z;
        return Scalar.atan2(crossDotAxis, dot);
    }

    static _projectOntoPlane(v, axis) {
        const d = v.x * axis.x + v.y * axis.y + v.z * axis.z;
        v.x -= d * axis.x; v.y -= d * axis.y; v.z -= d * axis.z;
        const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        if (len > 1e-12) { v.x /= len; v.y /= len; v.z /= len; }
    }

    _solveLimit() {
        const angle = this._swingAngle();
        const min = this.limit.min != null ? this.limit.min : -Infinity;
        const max = this.limit.max != null ? this.limit.max : Infinity;
        let violation = 0;
        if (angle < min) violation = angle - min;
        else if (angle > max) violation = angle - max;
        else return;

        const bodyA = this.bodyA, bodyB = this.bodyB;
        const axis = HingeConstraint._scratchAxis.copy(this.localAxisA);
        bodyA.rotation.transformVectorInPlace(axis);

        let wSum = 0;
        const hasB = !!(bodyB && bodyB._mass_inverted > 0);
        if (bodyA._mass_inverted > 0) wSum += HingeConstraint._angularEffectiveMass(bodyA, axis.x, axis.y, axis.z);
        if (hasB) wSum += HingeConstraint._angularEffectiveMass(bodyB, axis.x, axis.y, axis.z);
        if (wSum < 1e-12) return;

        const scale = -violation / wSum;
        const tx = axis.x * scale, ty = axis.y * scale, tz = axis.z * scale;
        if (bodyA._mass_inverted > 0) HingeConstraint._applyAngularDelta(bodyA, tx, ty, tz);
        if (hasB) HingeConstraint._applyAngularDelta(bodyB, -tx, -ty, -tz);
    }

    // Position-space motor: writes a bounded angle step (not velocity directly, since the solver
    // derives velocity from position delta after all constraints run).
    _solveMotor(h) {
        const bodyA = this.bodyA, bodyB = this.bodyB;
        const axis = HingeConstraint._scratchAxis.copy(this.localAxisA);
        bodyA.rotation.transformVectorInPlace(axis);

        let wSum = 0;
        const hasB = !!(bodyB && bodyB._mass_inverted > 0);
        if (bodyA._mass_inverted > 0) wSum += HingeConstraint._angularEffectiveMass(bodyA, axis.x, axis.y, axis.z);
        if (hasB) wSum += HingeConstraint._angularEffectiveMass(bodyB, axis.x, axis.y, axis.z);
        if (wSum < 1e-12) return;

        const wA = bodyA.angular_velocity, wB = hasB ? bodyB.angular_velocity : HingeConstraint._zero;
        const relOmega = (wA.x - wB.x) * axis.x + (wA.y - wB.y) * axis.y + (wA.z - wB.z) * axis.z;
        const velError = this.motor.targetVelocity - relOmega;
        if (velError === 0) return;

        const maxDeltaOmega = this.motor.maxTorque * wSum;
        const deltaOmega = velError > 0 ? Math.min(velError, maxDeltaOmega) : Math.max(velError, -maxDeltaOmega);
        let step = deltaOmega * h;
        if (step === 0) return;

        if (this.limit.min != null || this.limit.max != null) {
            const angle = this._swingAngle();
            const min = this.limit.min != null ? this.limit.min : -Infinity;
            const max = this.limit.max != null ? this.limit.max : Infinity;
            if (step > 0 && angle + step > max) step = Math.max(0, max - angle);
            else if (step < 0 && angle + step < min) step = Math.min(0, min - angle);
            if (step === 0) return;
        }

        const scale = step / wSum;
        const tx = axis.x * scale, ty = axis.y * scale, tz = axis.z * scale;
        if (bodyA._mass_inverted > 0) HingeConstraint._applyAngularDelta(bodyA, tx, ty, tz);
        if (hasB) HingeConstraint._applyAngularDelta(bodyB, -tx, -ty, -tz);
    }

    _solveAxisAlignment() {
        const bodyA = this.bodyA, bodyB = this.bodyB;
        const axisA = HingeConstraint._scratchV1.copy(this.localAxisA);
        bodyA.rotation.transformVectorInPlace(axisA);

        const axisB = HingeConstraint._scratchV2;
        if (bodyB) {
            axisB.copy(this.localAxisB);
            bodyB.rotation.transformVectorInPlace(axisB);
        } else {
            if (!this._fixedWorldAxis) {
                this._fixedWorldAxis = new Vector3().copy(this.localAxisA);
                this.bodyA.rotation.transformVectorInPlace(this._fixedWorldAxis);
            }
            axisB.copy(this._fixedWorldAxis);
        }

        // axisA x axisB: zero when parallel, magnitude ~sin(angle), direction = correction rotation.
        const ex = axisA.y * axisB.z - axisA.z * axisB.y;
        const ey = axisA.z * axisB.x - axisA.x * axisB.z;
        const ez = axisA.x * axisB.y - axisA.y * axisB.x;
        const errLenSq = ex * ex + ey * ey + ez * ez;
        if (errLenSq < 1e-20) return;

        const errLen = Math.sqrt(errLenSq);
        const dx = ex / errLen, dy = ey / errLen, dz = ez / errLen;
        let wSum = 0;
        const hasB = !!(bodyB && bodyB._mass_inverted > 0);
        if (bodyA._mass_inverted > 0) wSum += HingeConstraint._angularEffectiveMass(bodyA, dx, dy, dz);
        if (hasB) wSum += HingeConstraint._angularEffectiveMass(bodyB, dx, dy, dz);
        if (wSum < 1e-12) return;

        const scale = -1 / wSum;
        const tx = ex * scale, ty = ey * scale, tz = ez * scale;

        if (bodyA._mass_inverted > 0) HingeConstraint._applyAngularDelta(bodyA, -tx, -ty, -tz);
        if (hasB) HingeConstraint._applyAngularDelta(bodyB, tx, ty, tz);
    }

    static _angularEffectiveMass(body, dx, dy, dz) {
        const I = body._worldInverseInertiaTensor;
        const ix = I.e00 * dx + I.e01 * dy + I.e02 * dz;
        const iy = I.e10 * dx + I.e11 * dy + I.e12 * dz;
        const iz = I.e20 * dx + I.e21 * dy + I.e22 * dz;
        return dx * ix + dy * iy + dz * iz;
    }

    static _applyAngularDelta(body, tx, ty, tz) {
        const I = body._worldInverseInertiaTensor;
        const wx = I.e00 * tx + I.e01 * ty + I.e02 * tz;
        const wy = I.e10 * tx + I.e11 * ty + I.e12 * tz;
        const wz = I.e20 * tx + I.e21 * ty + I.e22 * tz;
        HingeConstraint._scratchAngular.set(wx * body.angular_factor.x, wy * body.angular_factor.y, wz * body.angular_factor.z);
        Solver._integrateRotation(body.rotation, HingeConstraint._scratchAngular, 1);
    }
}

HingeConstraint._scratchV1 = new Vector3();
HingeConstraint._scratchV2 = new Vector3();
HingeConstraint._scratchAxis = new Vector3();
HingeConstraint._scratchQ = new Quaternion();
HingeConstraint._scratchAngular = new Vector3();
HingeConstraint._zero = new Vector3();

ActionPhysics.HingeConstraint = HingeConstraint;


// ==== src/constraints/WeldConstraint.js ====
// Rigidly fuses two bodies at a shared point: pivot (composed PointConstraint) + full 3-DOF
// rotation lock at whatever relative orientation existed at construction.
class WeldConstraint extends Constraint {
    constructor(bodyA, bodyB, pivotA, pivotB) {
        super(bodyA, bodyB);
        this.localPivotA = new Vector3().copy(pivotA);
        this.localPivotB = new Vector3().copy(pivotB || new Vector3());

        // Relative rotation to hold: qRel = qB^-1 * qA (or bodyA's own rotation for a world weld).
        this.targetRel = new Quaternion();
        if (bodyB) {
            const invB = WeldConstraint._scratchQ.copy(bodyB.rotation).invert();
            this.targetRel.multiplyQuaternions(invB, bodyA.rotation);
        } else {
            this.targetRel.copy(bodyA.rotation);
        }

        this._pivot = bodyB
            ? new PointConstraint(bodyA, bodyB, this.localPivotA, this.localPivotB)
            : new PointConstraint(bodyA, null, this.localPivotA, WeldConstraint._worldPoint(bodyA, this.localPivotA));
    }

    static _worldPoint(body, localPoint) {
        const w = new Vector3().copy(localPoint);
        body.rotation.transformVectorInPlace(w);
        w.addInPlace(body.position);
        return w;
    }

    solve(h) {
        if (!this.enabled) return;
        this._pivot.solve(h);
        this._solveRotationLock();
    }

    _solveRotationLock() {
        const bodyA = this.bodyA, bodyB = this.bodyB;
        const currentRel = WeldConstraint._scratchQ2;
        if (bodyB) {
            const invB = WeldConstraint._scratchQ.copy(bodyB.rotation).invert();
            currentRel.multiplyQuaternions(invB, bodyA.rotation);
        } else {
            currentRel.copy(bodyA.rotation);
        }
        // error = currentRel * targetRel^-1; imaginary part is a direct small-angle correction.
        const invCurrent = WeldConstraint._scratchQ3.copy(currentRel).invert();
        const errQ = WeldConstraint._scratchQ4.multiplyQuaternions(this.targetRel, invCurrent);
        if (errQ.w < 0) { errQ.x = -errQ.x; errQ.y = -errQ.y; errQ.z = -errQ.z; errQ.w = -errQ.w; }
        const ex = errQ.x, ey = errQ.y, ez = errQ.z;
        const errLenSq = ex * ex + ey * ey + ez * ez;
        if (errLenSq < 1e-20) return;

        // error is in bodyB's local frame (currentRel = qB^-1 * qA); rotate to world before applying.
        const worldErr = WeldConstraint._scratchV;
        worldErr.set(ex, ey, ez);
        if (bodyB) bodyB.rotation.transformVectorInPlace(worldErr);
        const wex = worldErr.x, wey = worldErr.y, wez = worldErr.z;
        const wLen = Math.sqrt(wex * wex + wey * wey + wez * wez);
        if (wLen < 1e-12) return;
        const dx = wex / wLen, dy = wey / wLen, dz = wez / wLen;

        let wSum = 0;
        const hasB = !!(bodyB && bodyB._mass_inverted > 0);
        if (bodyA._mass_inverted > 0) wSum += WeldConstraint._angularEffectiveMass(bodyA, dx, dy, dz);
        if (hasB) wSum += WeldConstraint._angularEffectiveMass(bodyB, dx, dy, dz);
        if (wSum < 1e-12) return;

        const scale = -1 / wSum;
        const tx = wex * scale, ty = wey * scale, tz = wez * scale;
        if (bodyA._mass_inverted > 0) WeldConstraint._applyAngularDelta(bodyA, -tx, -ty, -tz);
        if (hasB) WeldConstraint._applyAngularDelta(bodyB, tx, ty, tz);
    }

    static _angularEffectiveMass(body, dx, dy, dz) {
        const I = body._worldInverseInertiaTensor;
        const ix = I.e00 * dx + I.e01 * dy + I.e02 * dz;
        const iy = I.e10 * dx + I.e11 * dy + I.e12 * dz;
        const iz = I.e20 * dx + I.e21 * dy + I.e22 * dz;
        return dx * ix + dy * iy + dz * iz;
    }

    static _applyAngularDelta(body, tx, ty, tz) {
        const I = body._worldInverseInertiaTensor;
        const wx = I.e00 * tx + I.e01 * ty + I.e02 * tz;
        const wy = I.e10 * tx + I.e11 * ty + I.e12 * tz;
        const wz = I.e20 * tx + I.e21 * ty + I.e22 * tz;
        WeldConstraint._scratchAngular.set(wx * body.angular_factor.x, wy * body.angular_factor.y, wz * body.angular_factor.z);
        Solver._integrateRotation(body.rotation, WeldConstraint._scratchAngular, 1);
    }
}

WeldConstraint._scratchQ = new Quaternion();
WeldConstraint._scratchQ2 = new Quaternion();
WeldConstraint._scratchQ3 = new Quaternion();
WeldConstraint._scratchQ4 = new Quaternion();
WeldConstraint._scratchV = new Vector3();
WeldConstraint._scratchAngular = new Vector3();

ActionPhysics.WeldConstraint = WeldConstraint;


// ==== src/constraints/SliderConstraint.js ====
// Piston joint: rotation fully locked (reuses WeldConstraint's angular half), position locked
// perpendicular to the slide axis, free to move along it.
class SliderConstraint extends Constraint {
    constructor(bodyA, localAxisA, anchorA, bodyB, anchorB) {
        super(bodyA, bodyB);
        this.localAxis = new Vector3().copy(localAxisA).normalizeInPlace();
        this.localAnchorA = new Vector3().copy(anchorA);
        this.localAnchorB = new Vector3().copy(anchorB || new Vector3());

        // Only ever calls _solveRotationLock, never the pivot - the slider has its own
        // axis-restricted positional constraint below.
        this._weld = new WeldConstraint(bodyA, bodyB, new Vector3(), new Vector3());

        this._worldA = new Vector3();
        this._worldB = new Vector3();
        this._rA = new Vector3();
        this._rB = new Vector3();
        this._t1 = new Vector3();
        this._t2 = new Vector3();
    }

    _anchorAWorld(out) {
        out.copy(this.localAnchorA);
        this.bodyA.rotation.transformVectorInPlace(out);
        out.addInPlace(this.bodyA.position);
        return out;
    }
    _anchorBWorld(out) {
        if (!this.bodyB) { out.copy(this.localAnchorB); return out; }
        out.copy(this.localAnchorB);
        this.bodyB.rotation.transformVectorInPlace(out);
        out.addInPlace(this.bodyB.position);
        return out;
    }

    solve(h) {
        if (!this.enabled) return;
        this._weld._solveRotationLock();
        this._solvePerpendicularPosition();
    }

    _solvePerpendicularPosition() {
        const bodyA = this.bodyA, bodyB = this.bodyB;
        const hasB = !!(bodyB && bodyB._mass_inverted > 0);

        this._anchorAWorld(this._worldA);
        this._anchorBWorld(this._worldB);

        const axis = SliderConstraint._scratchAxis;
        axis.copy(this.localAxis);
        bodyA.rotation.transformVectorInPlace(axis);

        // Strip the along-axis component - what's left is the perpendicular error to correct.
        const sepX = this._worldB.x - this._worldA.x, sepY = this._worldB.y - this._worldA.y, sepZ = this._worldB.z - this._worldA.z;
        const along = sepX * axis.x + sepY * axis.y + sepZ * axis.z;
        const cx = sepX - along * axis.x, cy = sepY - along * axis.y, cz = sepZ - along * axis.z;
        const errLenSq = cx * cx + cy * cy + cz * cz;
        if (errLenSq < 1e-20) return;

        Vector3.subInto(this._rA, this._worldA, bodyA.position);
        if (hasB) Vector3.subInto(this._rB, this._worldB, bodyB.position);
        else this._rB.set(0, 0, 0);

        const t1 = this._t1, t2 = this._t2;
        t1.findOrthogonal(axis);
        Vector3.crossInto(t2, axis, t1);

        const c1 = cx * t1.x + cy * t1.y + cz * t1.z;
        const c2 = cx * t2.x + cy * t2.y + cz * t2.z;

        this._solveAxis(bodyA, hasB ? bodyB : null, this._rA, this._rB, t1, c1);
        this._solveAxis(bodyA, hasB ? bodyB : null, this._rA, this._rB, t2, c2);
    }

    _solveAxis(bodyA, bodyB, rA, rB, dir, C) {
        const dx = dir.x, dy = dir.y, dz = dir.z;
        let wSum = bodyA._mass_inverted + (bodyB ? bodyB._mass_inverted : 0);
        const rax = rA.y * dz - rA.z * dy, ray = rA.z * dx - rA.x * dz, raz = rA.x * dy - rA.y * dx;
        if (bodyA._mass_inverted > 0) {
            const IA = bodyA._worldInverseInertiaTensor;
            const ix = IA.e00 * rax + IA.e01 * ray + IA.e02 * raz;
            const iy = IA.e10 * rax + IA.e11 * ray + IA.e12 * raz;
            const iz = IA.e20 * rax + IA.e21 * ray + IA.e22 * raz;
            wSum += rax * ix + ray * iy + raz * iz;
        }
        const rbx = rB.y * dz - rB.z * dy, rby = rB.z * dx - rB.x * dz, rbz = rB.x * dy - rB.y * dx;
        if (bodyB && bodyB._mass_inverted > 0) {
            const IB = bodyB._worldInverseInertiaTensor;
            const ix = IB.e00 * rbx + IB.e01 * rby + IB.e02 * rbz;
            const iy = IB.e10 * rbx + IB.e11 * rby + IB.e12 * rbz;
            const iz = IB.e20 * rbx + IB.e21 * rby + IB.e22 * rbz;
            wSum += rbx * ix + rby * iy + rbz * iz;
        }
        if (wSum < 1e-12) return;

        // Soft correction: only resolve a fraction per iteration to prevent overshooting
        // Multiple solver iterations per substep will gradually converge
        const correctionFraction = 0.1;
        const deltaLambda = -C * correctionFraction / wSum;
        const px = dx * deltaLambda, py = dy * deltaLambda, pz = dz * deltaLambda;

        if (bodyA._mass_inverted > 0) {
            bodyA.position.x -= px * bodyA._mass_inverted * bodyA.linear_factor.x;
            bodyA.position.y -= py * bodyA._mass_inverted * bodyA.linear_factor.y;
            bodyA.position.z -= pz * bodyA._mass_inverted * bodyA.linear_factor.z;
            SliderConstraint._applyAngular(bodyA, rA, -px, -py, -pz);
        }
        if (bodyB && bodyB._mass_inverted > 0) {
            bodyB.position.x += px * bodyB._mass_inverted * bodyB.linear_factor.x;
            bodyB.position.y += py * bodyB._mass_inverted * bodyB.linear_factor.y;
            bodyB.position.z += pz * bodyB._mass_inverted * bodyB.linear_factor.z;
            SliderConstraint._applyAngular(bodyB, rB, px, py, pz);
        }
    }

    static _applyAngular(body, r, px, py, pz) {
        const torqueX = r.y * pz - r.z * py, torqueY = r.z * px - r.x * pz, torqueZ = r.x * py - r.y * px;
        const I = body._worldInverseInertiaTensor;
        const wx = I.e00 * torqueX + I.e01 * torqueY + I.e02 * torqueZ;
        const wy = I.e10 * torqueX + I.e11 * torqueY + I.e12 * torqueZ;
        const wz = I.e20 * torqueX + I.e21 * torqueY + I.e22 * torqueZ;
        SliderConstraint._scratchAngular.set(wx * body.angular_factor.x, wy * body.angular_factor.y, wz * body.angular_factor.z);
        Solver._integrateRotation(body.rotation, SliderConstraint._scratchAngular, 1);
    }
}

SliderConstraint._scratchAxis = new Vector3();
SliderConstraint._scratchAngular = new Vector3();

ActionPhysics.SliderConstraint = SliderConstraint;


// ==== src/queries/Queries.js ====
// Ray casts and shape sweeps against world.bodies, via GJK's closest-distance result (a ray is a
// zero-radius sphere). O(n) over the body list after a cheap AABB reject. See RayIntersect.js,
// ShapeIntersect.js, Advance.js.
class Queries {
    static _isIgnored(body, ignore) {
        if (!ignore) return false;
        if (Array.isArray(ignore)) return ignore.indexOf(body) !== -1;
        return body === ignore;
    }

    static _isCompound(shape) {
        return typeof CompoundShape !== 'undefined' && shape instanceof CompoundShape;
    }

    static _isMesh(shape) {
        return typeof MeshShape !== 'undefined' && shape instanceof MeshShape;
    }

    // World-space placement of one mesh triangle onto a cached scratch TriangleShape (no per-
    // triangle allocation). MeshShape.triangleAt already hands back body-local vertices.
    static _placedTriangleInto(outPlaced, body, triShape, a, b, c) {
        triShape.a = a; triShape.b = b; triShape.c = c;
        outPlaced.shape = triShape;
        outPlaced.position = body.position;
        outPlaced.rotation = body.rotation;
        return outPlaced;
    }

    // World-space placement of one compound child, matching Midphase's own convention: world
    // position = bodyPos + bodyRot * childLocalPos; world rotation = bodyRot * childLocalRot.
    static _placedChildInto(outPlaced, body, child) {
        outPlaced.shape = child.shape;
        outPlaced.rotation.multiplyQuaternions(body.rotation, child.localRotation);
        outPlaced.position.copy(child.localPosition);
        body.rotation.transformVectorInPlace(outPlaced.position);
        outPlaced.position.addInPlace(body.position);
        return outPlaced;
    }
}

Queries._gjk = new GJK();
Queries._epa = new EPA();
Queries._identityQuat = new Quaternion(0, 0, 0, 1);
Queries._scratchPos = new Vector3();
Queries._scratchPlacedA = { shape: null, position: new Vector3(), rotation: new Quaternion(0, 0, 0, 1) };
Queries._scratchPlacedB = { shape: null, position: new Vector3(), rotation: new Quaternion(0, 0, 0, 1) };
Queries._scratchSupport = new MinkowskiSupport(Queries._scratchPlacedA, Queries._scratchPlacedB);
Queries._scratchPointShape = new SphereShape(0); // zero-radius sphere: a point, via the existing Shape contract
Queries._scratchLocalAABB = new AABB();
Queries._scratchExpandedAABB = new AABB();
Queries._scratchCompoundChild = { shape: null, position: new Vector3(), rotation: new Quaternion(0, 0, 0, 1) };
Queries._scratchTriangleShape = new TriangleShape(new Vector3(), new Vector3(), new Vector3());
// Mesh/compound BVH-prune scratch (RayIntersect.js / ShapeIntersect.js).
Queries._scratchInvRot = new Quaternion(0, 0, 0, 1);
Queries._scratchCorner = new Vector3();
Queries._scratchLeafList = [];
Queries._scratchTriA = new Vector3();
Queries._scratchTriB = new Vector3();
Queries._scratchTriC = new Vector3();

ActionPhysics.Queries = Queries;


// ==== src/queries/Advance.js ====
// Shared conservative-advancement sweep core plus the AABB rejects rayIntersect/shapeIntersect use.

// Casts `placedMover` from `start` toward start + dir*fullLen by conservative advancement, using
// GJK.run()'s separated distance as the step size (safe, never overshoots). Corner-on approaches
// converge geometrically, so cap/epsilon (160, 1e-4) are generous.
Queries._advance = function (support, placedMover, start, dirX, dirY, dirZ, fullLen) {
    const ux = dirX / fullLen, uy = dirY / fullLen, uz = dirZ / fullLen;
    let traveled = 0;
    // Last normal from a non-degenerate GJK call - GJK's exact-touch fallback normal is arbitrary.
    let lastGoodNx = -ux, lastGoodNy = -uy, lastGoodNz = -uz;

    for (let iter = 0; iter < 160; iter++) {
        const result = Queries._gjk.run(support);
        if (result.overlapping) {
            // Already inside/touching: EPA expands the same simplex into a real surface normal.
            // This (not a reversed-travel-direction fallback) is what correctly handles a sweep that
            // starts embedded - the reversed-direction fallback can't tell "approaching a surface
            // ahead" from "already past it and moving away".
            const epaResult = Queries._epa.run(support, result.simplex);
            return Queries._finishHit(start, dirX, dirY, dirZ, traveled, fullLen, epaResult.normal.x, epaResult.normal.y, epaResult.normal.z);
        }
        if (result.distance < 1e-4) {
            return Queries._finishHit(start, dirX, dirY, dirZ, traveled, fullLen, lastGoodNx, lastGoodNy, lastGoodNz);
        }
        lastGoodNx = result.normal.x; lastGoodNy = result.normal.y; lastGoodNz = result.normal.z;
        if (traveled + result.distance > fullLen) return null; // cannot reach within the segment
        traveled += result.distance;
        placedMover.position.set(start.x + ux * traveled, start.y + uy * traveled, start.z + uz * traveled);
        support.refresh();
    }
    return null; // did not converge within the cap - treat as a miss, never a false hit
};

Queries._finishHit = function (start, dirX, dirY, dirZ, traveled, fullLen, nx, ny, nz) {
    const fraction = traveled / fullLen;
    return {
        point: new Vector3(start.x + dirX * fraction, start.y + dirY * fraction, start.z + dirZ * fraction),
        normal: new Vector3(nx, ny, nz),
        distance: traveled,
        fraction: fraction
    };
};

// Cheap ray-vs-AABB reject (slab method) before ever constructing a GJK support for a body.
Queries._rayIntersectsAABB = function (start, end, aabb) {
    let tmin = 0, tmax = 1;
    const dirs = [end.x - start.x, end.y - start.y, end.z - start.z];
    const starts = [start.x, start.y, start.z];
    const mins = [aabb.min.x, aabb.min.y, aabb.min.z];
    const maxs = [aabb.max.x, aabb.max.y, aabb.max.z];
    for (let axis = 0; axis < 3; axis++) {
        const d = dirs[axis], s = starts[axis];
        if (Math.abs(d) < 1e-12) {
            if (s < mins[axis] || s > maxs[axis]) return false; // parallel and outside the slab
            continue;
        }
        let t1 = (mins[axis] - s) / d, t2 = (maxs[axis] - s) / d;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return false;
    }
    return true;
};

// Cheap reject for a shape sweep: expand the body's AABB by the swept shape's bounding radius
// (conservative, no-false-negatives, same discipline as broadphase's own margin) and ray-test that.
Queries._sweptAABBMayHit = function (start, end, radius, aabb) {
    const expanded = Queries._scratchExpandedAABB;
    expanded.copy(aabb).expandInPlace(radius);
    return Queries._rayIntersectsAABB(start, end, expanded);
};


// ==== src/queries/RayIntersect.js ====
// rayIntersect and its compound/mesh point-sweep dispatch.

// rayIntersect(bodies, start, end, ignore) -> { body, point, normal, distance, fraction } | null.
// The first body the segment hits, or null. `ignore`: a single RigidBody or array, excluded before
// the AABB reject (a caller casting from its own surface would otherwise hit itself at distance 0).
Queries.rayIntersect = function (bodies, start, end, ignore) {
    const dirX = end.x - start.x, dirY = end.y - start.y, dirZ = end.z - start.z;
    const fullLen = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
    if (fullLen < 1e-12) return null; // zero-length ray hits nothing

    let best = null, bestFraction = Infinity;
    for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        if (Queries._isIgnored(body, ignore)) continue;
        const aabb = body.getAABB();
        if (!Queries._rayIntersectsAABB(start, end, aabb)) continue;

        const hit = Queries._sweepPointVsBody(start, dirX, dirY, dirZ, fullLen, body);
        if (hit && hit.fraction < bestFraction) { bestFraction = hit.fraction; best = hit; best.body = body; }
    }
    return best;
};

// rayIntersectAll(bodies, start, end, ignore) -> array of { body, point, normal, distance, fraction },
// EVERY body the segment crosses, sorted nearest-first (empty array = no hit). Same per-body test as
// rayIntersect; use this when the caller filters hits itself (e.g. skip-my-own-body-then-take-the-next).
Queries.rayIntersectAll = function (bodies, start, end, ignore) {
    const dirX = end.x - start.x, dirY = end.y - start.y, dirZ = end.z - start.z;
    const fullLen = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
    const out = [];
    if (fullLen < 1e-12) return out;

    for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        if (Queries._isIgnored(body, ignore)) continue;
        if (!Queries._rayIntersectsAABB(start, end, body.getAABB())) continue;

        const hit = Queries._sweepPointVsBody(start, dirX, dirY, dirZ, fullLen, body);
        if (hit) { hit.body = body; out.push(hit); }
    }
    out.sort(function (a, b) { return a.fraction - b.fraction; });
    return out;
};

// Same result shape, against exactly one known body - no candidate filtering/AABB reject. What
// RigidBody.rayIntersect delegates to.
Queries.rayIntersectBody = function (start, end, body) {
    const dirX = end.x - start.x, dirY = end.y - start.y, dirZ = end.z - start.z;
    const fullLen = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
    if (fullLen < 1e-12) return null;
    return Queries._sweepPointVsBody(start, dirX, dirY, dirZ, fullLen, body);
};

// Casts a zero-radius point against one body via a single GJK query. CompoundShape isn't itself
// convex (supportInto throws by design), so a compound body dispatches per child.
Queries._sweepPointVsBody = function (start, dirX, dirY, dirZ, fullLen, body) {
    if (Queries._isCompound(body.shape)) {
        return Queries._sweepPointVsCompound(start, dirX, dirY, dirZ, fullLen, body);
    }
    if (Queries._isMesh(body.shape)) {
        return Queries._sweepPointVsMesh(start, dirX, dirY, dirZ, fullLen, body);
    }
    const pointShape = Queries._scratchPointShape;
    const placedPoint = Queries._scratchPlacedA;
    placedPoint.shape = pointShape;
    placedPoint.position = Queries._scratchPos.set(start.x, start.y, start.z);
    placedPoint.rotation = Queries._identityQuat;

    const placedBody = Queries._scratchPlacedB;
    placedBody.shape = body.shape;
    placedBody.position = body.position;
    placedBody.rotation = body.rotation;

    const support = Queries._scratchSupport;
    support.a = placedPoint; support.b = placedBody;
    support._invRotA.copy(Queries._identityQuat);
    support._invRotB.copy(body.rotation).invert();

    return Queries._advance(support, placedPoint, start, dirX, dirY, dirZ, fullLen);
};

// The AABB of the ray segment [start, start + dir*fullLen], transformed into `body`'s local space
// (8-corner inverse transform, conservative), written into `out`. Used to prune a mesh/compound
// BVH so a cast doesn't sweep every triangle/child.
Queries._localRayAABBInto = function (out, body, start, dirX, dirY, dirZ, fullLen) {
    const ex = start.x, ey = start.y, ez = start.z;
    const fx = start.x + dirX, fy = start.y + dirY, fz = start.z + dirZ; // dir is already scaled to fullLen by the callers
    const invRot = Queries._scratchInvRot.copy(body.rotation).invert();
    out.setEmpty();
    for (let k = 0; k < 2; k++) {
        const wx = k ? fx : ex, wy = k ? fy : ey, wz = k ? fz : ez;
        Queries._scratchCorner.set(wx - body.position.x, wy - body.position.y, wz - body.position.z);
        invRot.transformVectorInPlace(Queries._scratchCorner);
        const cx = Queries._scratchCorner.x, cy = Queries._scratchCorner.y, cz = Queries._scratchCorner.z;
        if (cx < out.min.x) out.min.x = cx; if (cx > out.max.x) out.max.x = cx;
        if (cy < out.min.y) out.min.y = cy; if (cy > out.max.y) out.max.y = cy;
        if (cz < out.min.z) out.min.z = cz; if (cz > out.max.z) out.max.z = cz;
    }
    return out;
};

Queries._sweepPointVsCompound = function (start, dirX, dirY, dirZ, fullLen, body) {
    const shape = body.shape;
    let best = null, bestFraction = Infinity;

    // BVH-prune: only test children whose local AABB the ray's local AABB overlaps.
    let indices = null;
    if (shape.children.length > Midphase.SMALL_MESH_TRIS) {
        const bvh = ActionPhysics.ensureShapeBVH(shape);
        Queries._localRayAABBInto(Queries._scratchLocalAABB, body, start, dirX, dirY, dirZ, fullLen);
        indices = Queries._scratchLeafList; indices.length = 0;
        bvh.query(Queries._scratchLocalAABB, function (i) { indices.push(i); });
    }
    const count = indices ? indices.length : shape.children.length;

    // Snapshot the child index list before the loop: a mesh/compound child recurses, and the
    // recursion reuses Queries._scratchLeafList.
    const childIndices = indices ? indices.slice() : null;
    for (let k = 0; k < count; k++) {
        const child = shape.children[childIndices ? childIndices[k] : k];

        // A child that is itself a mesh or a nested compound is NOT a convex primitive - GJK would
        // hit MeshShape.supportInto and throw. Recurse into it at its own world placement, exactly
        // as the midphase expands such a child.
        if (Queries._isMesh(child.shape) || Queries._isCompound(child.shape)) {
            const sub = Queries._childAsBody(body, child);
            const hit = Queries._sweepPointVsBody(start, dirX, dirY, dirZ, fullLen, sub);
            if (hit && hit.fraction < bestFraction) { bestFraction = hit.fraction; best = hit; }
            continue;
        }

        const placedChild = Queries._placedChildInto(Queries._scratchCompoundChild, body, child);

        const placedPoint = Queries._scratchPlacedA;
        placedPoint.shape = Queries._scratchPointShape;
        placedPoint.position = Queries._scratchPos.set(start.x, start.y, start.z);
        placedPoint.rotation = Queries._identityQuat;

        const support = Queries._scratchSupport;
        support.a = placedPoint; support.b = placedChild;
        support._invRotA.copy(Queries._identityQuat);
        support._invRotB.copy(placedChild.rotation).invert();

        const hit = Queries._advance(support, placedPoint, start, dirX, dirY, dirZ, fullLen);
        if (hit && hit.fraction < bestFraction) { bestFraction = hit.fraction; best = hit; }
    }
    return best;
};

// A one-off body object placing `child` (a CompoundShapeChild) at its world transform under
// `parentBody`, so a mesh/compound child can be run through the same per-body query path as a
// top-level body. Allocates - only hit when a query ray actually crosses a compound-of-meshes,
// which is rare (a static model collider, once per probe).
Queries._childAsBody = function (parentBody, child) {
    const pos = new Vector3();
    parentBody.rotation.transformVectorInto(child.localPosition, pos);
    pos.addInPlace(parentBody.position);
    const rot = new Quaternion();
    rot.multiplyQuaternions(parentBody.rotation, child.localRotation);
    return {
        shape: child.shape,
        position: pos,
        rotation: rot,
        getAABB: function () { return parentBody.getAABB(); } // conservative; only used for the mesh BVH-prune's own placement math, which reads position/rotation
    };
};

Queries._sweepPointVsMesh = function (start, dirX, dirY, dirZ, fullLen, body) {
    const shape = body.shape;
    const a = Queries._scratchTriA, b = Queries._scratchTriB, c = Queries._scratchTriC;
    let best = null, bestFraction = Infinity;

    // BVH-prune: only sweep triangles whose local AABB the ray's local AABB overlaps. A tiny mesh
    // scans all - a couple of triangles is cheaper than building/walking a tree.
    let indices = null;
    if (shape.triangleCount > Midphase.SMALL_MESH_TRIS) {
        const bvh = ActionPhysics.ensureShapeBVH(shape);
        Queries._localRayAABBInto(Queries._scratchLocalAABB, body, start, dirX, dirY, dirZ, fullLen);
        indices = Queries._scratchLeafList; indices.length = 0;
        bvh.query(Queries._scratchLocalAABB, function (i) { indices.push(i); });
    }
    const count = indices ? indices.length : shape.triangleCount;

    for (let k = 0; k < count; k++) {
        shape.triangleAt(indices ? indices[k] : k, a, b, c);
        const placedTri = Queries._placedTriangleInto(Queries._scratchCompoundChild, body, Queries._scratchTriangleShape, a, b, c);

        const placedPoint = Queries._scratchPlacedA;
        placedPoint.shape = Queries._scratchPointShape;
        placedPoint.position = Queries._scratchPos.set(start.x, start.y, start.z);
        placedPoint.rotation = Queries._identityQuat;

        const support = Queries._scratchSupport;
        support.a = placedPoint; support.b = placedTri;
        support._invRotA.copy(Queries._identityQuat);
        support._invRotB.copy(placedTri.rotation).invert();

        const hit = Queries._advance(support, placedPoint, start, dirX, dirY, dirZ, fullLen);
        if (hit && hit.fraction < bestFraction) { bestFraction = hit.fraction; best = hit; }
    }
    return best;
};


// ==== src/queries/ShapeIntersect.js ====
// shapeIntersect (swept-shape cast) and its compound/mesh dispatch, plus the stationary-overlap
// test used for a zero-length sweep.

// shapeIntersect(bodies, shape, start, end, rotation, ignore) -> same result shape as rayIntersect.
// Sweeps `shape` (fixed orientation) from start to end. `ignore`: see rayIntersect.
Queries.shapeIntersect = function (bodies, shape, start, end, rotation, ignore) {
    const dirX = end.x - start.x, dirY = end.y - start.y, dirZ = end.z - start.z;
    const fullLen = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
    // A zero-length sweep is a stationary overlap test - unlike a zero-length ray (degenerate,
    // reports a miss), a real shape held still genuinely can overlap something.
    if (fullLen < 1e-12) return Queries._overlapTest(bodies, shape, start, rotation, ignore);
    const localAABB = Queries._scratchLocalAABB;
    shape.localAABBInto(localAABB);
    const radius = Math.sqrt(
        Math.max(localAABB.min.x * localAABB.min.x, localAABB.max.x * localAABB.max.x) +
        Math.max(localAABB.min.y * localAABB.min.y, localAABB.max.y * localAABB.max.y) +
        Math.max(localAABB.min.z * localAABB.min.z, localAABB.max.z * localAABB.max.z)
    );

    let best = null, bestFraction = Infinity;
    for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        if (Queries._isIgnored(body, ignore)) continue;
        const aabb = body.getAABB();
        if (!Queries._sweptAABBMayHit(start, end, radius, aabb)) continue;

        const hit = Queries._sweepShapeVsBody(shape, rotation, start, dirX, dirY, dirZ, fullLen, body);
        if (hit && hit.fraction < bestFraction) { bestFraction = hit.fraction; best = hit; best.body = body; }
    }
    return best;
};

Queries._sweepShapeVsBody = function (shape, rotation, start, dirX, dirY, dirZ, fullLen, body) {
    if (Queries._isCompound(body.shape)) {
        return Queries._sweepShapeVsCompound(shape, rotation, start, dirX, dirY, dirZ, fullLen, body);
    }
    if (Queries._isMesh(body.shape)) {
        return Queries._sweepShapeVsMesh(shape, rotation, start, dirX, dirY, dirZ, fullLen, body);
    }
    const placedShape = Queries._scratchPlacedA;
    placedShape.shape = shape;
    placedShape.position = Queries._scratchPos.set(start.x, start.y, start.z);
    placedShape.rotation = rotation || Queries._identityQuat;

    const placedBody = Queries._scratchPlacedB;
    placedBody.shape = body.shape;
    placedBody.position = body.position;
    placedBody.rotation = body.rotation;

    const support = Queries._scratchSupport;
    support.a = placedShape; support.b = placedBody;
    support._invRotA.copy(placedShape.rotation).invert();
    support._invRotB.copy(body.rotation).invert();

    return Queries._advance(support, placedShape, start, dirX, dirY, dirZ, fullLen);
};

// Local-space AABB of the swept region: the segment [start, start+dir] fattened by `pad` (the
// moving shape's bounding radius), inverse-transformed into `body`'s frame. Conservative.
Queries._localSweptAABBInto = function (out, body, start, dirX, dirY, dirZ, pad) {
    const invRot = Queries._scratchInvRot.copy(body.rotation).invert();
    out.setEmpty();
    for (let k = 0; k < 2; k++) {
        const wx = start.x + (k ? dirX : 0), wy = start.y + (k ? dirY : 0), wz = start.z + (k ? dirZ : 0);
        Queries._scratchCorner.set(wx - body.position.x, wy - body.position.y, wz - body.position.z);
        invRot.transformVectorInPlace(Queries._scratchCorner);
        const cx = Queries._scratchCorner.x, cy = Queries._scratchCorner.y, cz = Queries._scratchCorner.z;
        if (cx < out.min.x) out.min.x = cx; if (cx > out.max.x) out.max.x = cx;
        if (cy < out.min.y) out.min.y = cy; if (cy > out.max.y) out.max.y = cy;
        if (cz < out.min.z) out.min.z = cz; if (cz > out.max.z) out.max.z = cz;
    }
    out.min.x -= pad; out.min.y -= pad; out.min.z -= pad;
    out.max.x += pad; out.max.y += pad; out.max.z += pad;
    return out;
};

Queries._sweepShapeVsCompound = function (shape, rotation, start, dirX, dirY, dirZ, fullLen, body) {
    const compound = body.shape;
    let best = null, bestFraction = Infinity;

    let indices = null;
    if (compound.children.length > Midphase.SMALL_MESH_TRIS) {
        const bvh = ActionPhysics.ensureShapeBVH(compound);
        Queries._localSweptAABBInto(Queries._scratchLocalAABB, body, start, dirX, dirY, dirZ, Queries._sweptShapeRadius(shape));
        indices = Queries._scratchLeafList; indices.length = 0;
        bvh.query(Queries._scratchLocalAABB, function (i) { indices.push(i); });
    }
    const count = indices ? indices.length : compound.children.length;
    const childIndices = indices ? indices.slice() : null; // recursion reuses _scratchLeafList

    for (let k = 0; k < count; k++) {
        const child = compound.children[childIndices ? childIndices[k] : k];

        // Mesh / nested-compound child: not a convex primitive. Recurse at its world placement.
        if (Queries._isMesh(child.shape) || Queries._isCompound(child.shape)) {
            const sub = Queries._childAsBody(body, child);
            const hit = Queries._sweepShapeVsBody(shape, rotation, start, dirX, dirY, dirZ, fullLen, sub);
            if (hit && hit.fraction < bestFraction) { bestFraction = hit.fraction; best = hit; }
            continue;
        }

        const placedChild = Queries._placedChildInto(Queries._scratchCompoundChild, body, child);

        const placedShape = Queries._scratchPlacedA;
        placedShape.shape = shape;
        placedShape.position = Queries._scratchPos.set(start.x, start.y, start.z);
        placedShape.rotation = rotation || Queries._identityQuat;

        const support = Queries._scratchSupport;
        support.a = placedShape; support.b = placedChild;
        support._invRotA.copy(placedShape.rotation).invert();
        support._invRotB.copy(placedChild.rotation).invert();

        const hit = Queries._advance(support, placedShape, start, dirX, dirY, dirZ, fullLen);
        if (hit && hit.fraction < bestFraction) { bestFraction = hit.fraction; best = hit; }
    }
    return best;
};

Queries._sweepShapeVsMesh = function (shape, rotation, start, dirX, dirY, dirZ, fullLen, body) {
    const meshShape = body.shape;
    const a = Queries._scratchTriA, b = Queries._scratchTriB, c = Queries._scratchTriC;
    let best = null, bestFraction = Infinity;

    let indices = null;
    if (meshShape.triangleCount > Midphase.SMALL_MESH_TRIS) {
        const bvh = ActionPhysics.ensureShapeBVH(meshShape);
        Queries._localSweptAABBInto(Queries._scratchLocalAABB, body, start, dirX, dirY, dirZ, Queries._sweptShapeRadius(shape));
        indices = Queries._scratchLeafList; indices.length = 0;
        bvh.query(Queries._scratchLocalAABB, function (i) { indices.push(i); });
    }
    const count = indices ? indices.length : meshShape.triangleCount;

    for (let k = 0; k < count; k++) {
        meshShape.triangleAt(indices ? indices[k] : k, a, b, c);
        const placedTri = Queries._placedTriangleInto(Queries._scratchCompoundChild, body, Queries._scratchTriangleShape, a, b, c);

        const placedShape = Queries._scratchPlacedA;
        placedShape.shape = shape;
        placedShape.position = Queries._scratchPos.set(start.x, start.y, start.z);
        placedShape.rotation = rotation || Queries._identityQuat;

        const support = Queries._scratchSupport;
        support.a = placedShape; support.b = placedTri;
        support._invRotA.copy(placedShape.rotation).invert();
        support._invRotB.copy(placedTri.rotation).invert();

        const hit = Queries._advance(support, placedShape, start, dirX, dirY, dirZ, fullLen);
        if (hit && hit.fraction < bestFraction) { bestFraction = hit.fraction; best = hit; }
    }
    return best;
};

// Bounding-sphere radius of `shape` about its local origin - the pad for a swept-shape AABB.
Queries._sweptShapeRadius = function (shape) {
    const lb = Queries._scratchExpandedAABB;
    shape.localAABBInto(lb);
    return Math.sqrt(
        Math.max(lb.min.x * lb.min.x, lb.max.x * lb.max.x) +
        Math.max(lb.min.y * lb.min.y, lb.max.y * lb.max.y) +
        Math.max(lb.min.z * lb.min.z, lb.max.z * lb.max.z)
    );
};

// Stationary overlap test: does `shape`, held fixed at `start`, touch anything? One GJK query per
// candidate, same AABB-reject structure as the swept queries, but EPA runs directly on an
// overlapping result (no travel direction to fall back on).
Queries._overlapTest = function (bodies, shape, start, rotation, ignore) {
    const localAABB = Queries._scratchLocalAABB;
    shape.localAABBInto(localAABB);
    const radius = Math.sqrt(
        Math.max(localAABB.min.x * localAABB.min.x, localAABB.max.x * localAABB.max.x) +
        Math.max(localAABB.min.y * localAABB.min.y, localAABB.max.y * localAABB.max.y) +
        Math.max(localAABB.min.z * localAABB.min.z, localAABB.max.z * localAABB.max.z)
    );
    const rot = rotation || Queries._identityQuat;

    for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        if (Queries._isIgnored(body, ignore)) continue;
        if (Queries._isCompound(body.shape)) {
            const hit = Queries._overlapTestCompound(shape, start, rot, body);
            if (hit) return hit;
            continue;
        }
        if (Queries._isMesh(body.shape)) {
            const hit = Queries._overlapTestMesh(shape, start, rot, body);
            if (hit) return hit;
            continue;
        }
        const aabb = body.getAABB();
        const expanded = Queries._scratchExpandedAABB;
        expanded.copy(aabb).expandInPlace(radius);
        if (start.x < expanded.min.x || start.x > expanded.max.x ||
            start.y < expanded.min.y || start.y > expanded.max.y ||
            start.z < expanded.min.z || start.z > expanded.max.z) continue;

        const hit = Queries._overlapTestOne(shape, start, rot, body);
        if (hit) return hit;
    }
    return null;
};

Queries._overlapTestOne = function (shape, start, rotation, body) {
    const placedShape = Queries._scratchPlacedA;
    placedShape.shape = shape;
    placedShape.position = start;
    placedShape.rotation = rotation;

    const placedBody = Queries._scratchPlacedB;
    placedBody.shape = body.shape;
    placedBody.position = body.position;
    placedBody.rotation = body.rotation;

    const support = Queries._scratchSupport;
    support.a = placedShape; support.b = placedBody;
    support._invRotA.copy(rotation).invert();
    support._invRotB.copy(body.rotation).invert();

    const gjkResult = Queries._gjk.run(support);
    if (!gjkResult.overlapping) return null;
    const epaResult = Queries._epa.run(support, gjkResult.simplex);
    return { point: epaResult.pointA, normal: epaResult.normal, distance: 0, fraction: 0, body: body };
};

// Local-space AABB of `shape` held at world `start` (its bounding sphere -> an axis box),
// inverse-transformed into `body`'s frame, for BVH pruning an overlap test.
Queries._localOverlapAABBInto = function (out, body, start, shape) {
    const r = Queries._sweptShapeRadius(shape);
    Queries._scratchCorner.set(start.x - body.position.x, start.y - body.position.y, start.z - body.position.z);
    Queries._scratchInvRot.copy(body.rotation).invert().transformVectorInPlace(Queries._scratchCorner);
    out.min.x = Queries._scratchCorner.x - r; out.max.x = Queries._scratchCorner.x + r;
    out.min.y = Queries._scratchCorner.y - r; out.max.y = Queries._scratchCorner.y + r;
    out.min.z = Queries._scratchCorner.z - r; out.max.z = Queries._scratchCorner.z + r;
    return out;
};

Queries._overlapTestCompound = function (shape, start, rotation, body) {
    const compound = body.shape;
    let indices = null;
    if (compound.children.length > Midphase.SMALL_MESH_TRIS) {
        const bvh = ActionPhysics.ensureShapeBVH(compound);
        Queries._localOverlapAABBInto(Queries._scratchLocalAABB, body, start, shape);
        indices = Queries._scratchLeafList; indices.length = 0;
        bvh.query(Queries._scratchLocalAABB, function (i) { indices.push(i); });
    }
    const children = compound.children;
    const count = indices ? indices.length : children.length;
    const childIndices = indices ? indices.slice() : null; // recursion reuses _scratchLeafList
    for (let k = 0; k < count; k++) {
        const child = children[childIndices ? childIndices[k] : k];

        // Mesh / nested-compound child: recurse at its world placement (GJK can't take a mesh).
        if (Queries._isMesh(child.shape) || Queries._isCompound(child.shape)) {
            const sub = Queries._childAsBody(body, child);
            const hit = Queries._isMesh(child.shape)
                ? Queries._overlapTestMesh(shape, start, rotation, sub)
                : Queries._overlapTestCompound(shape, start, rotation, sub);
            if (hit) return { point: hit.point, normal: hit.normal, distance: 0, fraction: 0, body: body };
            continue;
        }

        const placedChild = Queries._placedChildInto(Queries._scratchCompoundChild, body, child);
        const placedShape = Queries._scratchPlacedA;
        placedShape.shape = shape;
        placedShape.position = start;
        placedShape.rotation = rotation;

        const support = Queries._scratchSupport;
        support.a = placedShape; support.b = placedChild;
        support._invRotA.copy(rotation).invert();
        support._invRotB.copy(placedChild.rotation).invert();

        const gjkResult = Queries._gjk.run(support);
        if (!gjkResult.overlapping) continue;
        const epaResult = Queries._epa.run(support, gjkResult.simplex);
        return { point: epaResult.pointA, normal: epaResult.normal, distance: 0, fraction: 0, body: body };
    }
    return null;
};

Queries._overlapTestMesh = function (shape, start, rotation, body) {
    const meshShape = body.shape;
    const a = Queries._scratchTriA, b = Queries._scratchTriB, c = Queries._scratchTriC;
    let indices = null;
    if (meshShape.triangleCount > Midphase.SMALL_MESH_TRIS) {
        const bvh = ActionPhysics.ensureShapeBVH(meshShape);
        Queries._localOverlapAABBInto(Queries._scratchLocalAABB, body, start, shape);
        indices = Queries._scratchLeafList; indices.length = 0;
        bvh.query(Queries._scratchLocalAABB, function (i) { indices.push(i); });
    }
    const count = indices ? indices.length : meshShape.triangleCount;
    for (let k = 0; k < count; k++) {
        meshShape.triangleAt(indices ? indices[k] : k, a, b, c);
        const placedTri = Queries._placedTriangleInto(Queries._scratchCompoundChild, body, Queries._scratchTriangleShape, a, b, c);
        const placedShape = Queries._scratchPlacedA;
        placedShape.shape = shape;
        placedShape.position = start;
        placedShape.rotation = rotation;

        const support = Queries._scratchSupport;
        support.a = placedShape; support.b = placedTri;
        support._invRotA.copy(rotation).invert();
        support._invRotB.copy(placedTri.rotation).invert();

        const gjkResult = Queries._gjk.run(support);
        if (!gjkResult.overlapping) continue;
        const epaResult = Queries._epa.run(support, gjkResult.simplex);
        return { point: epaResult.pointA, normal: epaResult.normal, distance: 0, fraction: 0, body: body };
    }
    return null;
};


// ==== src/world/World.js ====
// Pipeline glue: owns the body list, drives one tick through broadphase -> midphase/narrowphase ->
// solver. Query methods delegate to Queries.js.
class World {
    constructor(broadphase, narrowphase, solver) {
        this.broadphase = broadphase;
        this.narrowphase = narrowphase;
        this.solver = solver;
        this.midphase = new Midphase();
        this.islandManager = new IslandManager();
        // When false, the island manager is skipped and every dynamic body is solved every tick -
        // nothing ever parks. Sleeping is otherwise transparent (a parked body resumes exactly where
        // it stopped), so this is only for debugging or for a scene that wants to rule sleep out.
        this.allowSleeping = true;
        this.gravity = new Vector3(0, -9.81, 0);
        this.bodies = [];
        this.constraints = [];
        this._listeners = {};
    }

    addListener(event, fn) {
        (this._listeners[event] || (this._listeners[event] = [])).push(fn);
        return this;
    }

    emit(event, arg) {
        const list = this._listeners[event];
        if (!list) return;
        for (let i = 0; i < list.length; i++) list[i](arg);
    }

    addConstraint(constraint) {
        this.constraints.push(constraint);
        return this;
    }

    removeConstraint(constraint) {
        const i = this.constraints.indexOf(constraint);
        if (i !== -1) this.constraints.splice(i, 1);
        return this;
    }

    addRigidBody(body) {
        body.world = this;
        body.updateDerived();
        this.bodies.push(body);
        this.broadphase.add(body);
        return this;
    }

    removeRigidBody(body) {
        const i = this.bodies.indexOf(body);
        if (i !== -1) this.bodies.splice(i, 1);
        this.broadphase.remove(body);
        body.world = null;
        return this;
    }

    step(dt) {
        this.emit('stepStart', dt);
        for (let i = 0; i < this.bodies.length; i++) this.bodies[i].updateDerived(dt);

        const pairs = this.broadphase.computePairs();
        const manifolds = this.narrowphase.step(pairs, this.midphase, dt);

        // Decide sleep state before the solver runs; it skips !isAwake dynamic bodies.
        if (this.allowSleeping) this.islandManager.update(this.bodies, manifolds, this.constraints, dt);

        const narrowphase = this.narrowphase;
        this.solver.step(this.bodies, manifolds, this.gravity, dt, function (mans) {
            narrowphase.refreshManifoldGeometry(mans); // per-substep geometry re-measure
        }, this.constraints);

        for (let i = 0; i < this.bodies.length; i++) { // forces are per-tick
            const b = this.bodies[i];
            if (b.bodyType === RigidBody.DYNAMIC) b.clearForces();
        }

        // Resolved contacts, for listeners. Emitted post-solve so positions reflect the result.
        this.emit('contacts', manifolds);

        this.emit('stepEnd', dt);
    }

    rayIntersect(start, end, ignore) {
        return Queries.rayIntersect(this.bodies, start, end, ignore);
    }

    // Every body the segment crosses, nearest-first (empty array = miss). For a caller that filters
    // hits itself; rayIntersect() is the single-nearest form.
    rayIntersectAll(start, end, ignore) {
        return Queries.rayIntersectAll(this.bodies, start, end, ignore);
    }

    shapeIntersect(shape, start, end, rotation, ignore) {
        return Queries.shapeIntersect(this.bodies, shape, start, end, rotation, ignore);
    }
}

ActionPhysics.World = World;


// ==== src/character/CharacterController.js ====
/**
 * Spring-based character controller: a capsule body held at a fixed ride height above the ground
 * by a raycast spring, with slope-projected movement and a small falling/grounded/jumping state
 * machine. This is the smaller of ActionPhysics's two character controllers (the other is the
 * FPS controller) — see the design plan's Component 10 for why they are independent, not a
 * base + specialization.
 *
 * Uses the World/RigidBody privileged interface directly (raw force application, direct velocity
 * writes) rather than the public gameplay surface — a character controller is documented as
 * needing that access.
 */
class CharacterController {
    constructor(world, options) {
        this.world = world;
        options = options || {};

        const radius = options.radius || 2;
        const totalHeight = options.height || 6;
        this.shape = new CapsuleShape(radius, totalHeight);
        this.body = new RigidBody(this.shape, options.mass || 1);

        this.body.angular_factor = options.allowYRotation === false
            ? new Vector3(0, 0, 0)
            : new Vector3(0, 1, 0);

        // Movement configuration
        this.moveSpeed = options.moveSpeed || 50;
        this.maxSpeed = options.maxSpeed || 50;
        this.stopFactor = options.stopFactor || 0.9;
        this.stoppingThreshold = options.stoppingThreshold || 0.1;
        this.jumpForce = options.jumpForce || 60;
        this.airAcceleration = options.airAcceleration || 0.3;
        this.groundAcceleration = options.groundAcceleration || 0.3;

        // Input handling
        this._inputDirection = new Vector3();
        this._hasInputThisFrame = false;
        this._jumpRequested = false;

        // Working vectors
        this.contactNormal = new Vector3(0, 1, 0);
        this.tempVector = new Vector3();
        this.moveVector = new Vector3();
        this.projectedMove = new Vector3();

        // Ground spring config. Once the capsule touches the ground the solver's own contact
        // constraint pins it there regardless of spring force, so the spring must stop a fall before
        // the shape reaches the surface - hence a stiff springStrength default. springDamping is set
        // near critical damping for that strength (2*sqrt(strength*mass)), not scaled proportionally
        // with it - proportional scaling is underdamped and bounces for a long time before settling.
        this.rideHeight = options.rideHeight || 4;
        this.rayLength = options.rayLength || totalHeight;
        this.springStrength = options.springStrength || 300;
        this.springDamping = options.springDamping || 30;

        // State management
        this.states = {};
        this.currentState = null;
        this._lastStateChange = { from: null, to: null, time: Date.now() };

        // Debug tracking
        this._lastGroundHit = null;
        this._lastHeightError = null;
        this._lastSpringForce = null;
        this._lastMoveDelta = new Vector3();
        this._lastProjectedMove = new Vector3();
        this._lastAppliedForce = null;

        this._listeners = {};

        this._initializeStates();
        this.changeState('falling');
    }

    _initializeStates() {
        this.states.falling = {
            name: 'falling',
            enter: () => {},
            update: (deltaTime) => {
                this.updateGroundSpring();
                if (this._hasInputThisFrame) this.move(this._inputDirection, deltaTime);
                if (this._lastGroundHit) return 'grounded';
            },
            exit: () => {}
        };

        this.states.grounded = {
            name: 'grounded',
            enter: () => {},
            update: (deltaTime) => {
                this.updateGroundSpring();

                if (this._jumpRequested) {
                    this._jumpRequested = false;
                    return 'jumping';
                }

                if (this._hasInputThisFrame) {
                    this.move(this._inputDirection, deltaTime);
                } else {
                    const vx = this.body.linear_velocity.x, vz = this.body.linear_velocity.z;
                    const currentHorizontalSpeed = Math.sqrt(vx * vx + vz * vz);
                    if (currentHorizontalSpeed > this.stoppingThreshold) {
                        this.body.linear_velocity.x *= this.stopFactor;
                        this.body.linear_velocity.z *= this.stopFactor;
                    } else {
                        this.body.linear_velocity.x = 0;
                        this.body.linear_velocity.z = 0;
                    }
                }

                if (!this._lastGroundHit) return 'falling';
            },
            exit: () => {}
        };

        this.states.jumping = {
            name: 'jumping',
            enter: () => {
                this.body.linear_velocity.y = this.jumpForce;
            },
            update: (deltaTime) => {
                if (this._hasInputThisFrame) this.move(this._inputDirection, deltaTime);
                if (this.body.linear_velocity.y <= 0) return 'falling';
            },
            exit: () => {}
        };
    }

    /** Requests a jump; only takes effect while grounded. */
    wishJump() {
        if (this.currentState && this.currentState.name === 'grounded') {
            this._jumpRequested = true;
        }
    }

    changeState(newStateName) {
        const newState = this.states[newStateName];
        if (!newState) throw new Error('Invalid state: ' + newStateName);

        if (this.currentState) this.currentState.exit();

        this._lastStateChange = {
            from: this.currentState ? this.currentState.name : null,
            to: newState.name,
            time: Date.now()
        };

        this.currentState = newState;
        this.currentState.enter();
    }

    /** Stores input direction for processing during update(). */
    handleInput(direction) {
        if (direction && direction.lengthSquared() > 0) {
            this._inputDirection.copy(direction);
            this._hasInputThisFrame = true;
        } else {
            this._inputDirection.set(0, 0, 0);
            this._hasInputThisFrame = false;
        }
    }

    /** Advances the state machine. Call once per frame after handleInput(). */
    update(deltaTime) {
        if (this.currentState) {
            const nextState = this.currentState.update(deltaTime);
            if (nextState && nextState !== this.currentState.name) {
                this.changeState(nextState);
            }
        }
        this._hasInputThisFrame = false;
    }

    /**
     * Raycasts straight down from the capsule's base and applies a spring force to hold the body
     * at rideHeight above whatever it hits. Call while in FALLING or GROUNDED.
     */
    updateGroundSpring() {
        const halfHeight = this.shape.totalHeight / 2;
        const rayStart = new Vector3(
            this.body.position.x,
            this.body.position.y - halfHeight - 0.00001,
            this.body.position.z
        );
        const rayEnd = new Vector3(rayStart.x, rayStart.y - this.rayLength, rayStart.z);

        const hit = this.world.rayIntersect(rayStart, rayEnd, this.body);

        if (hit) {
            this._lastGroundHit = hit;
            this.contactNormal.copy(hit.normal);

            const heightError = this.rideHeight - hit.distance;
            const verticalVelocity = this.body.linear_velocity.y;
            const springForce = (heightError * this.springStrength) - (verticalVelocity * this.springDamping);

            this._lastHeightError = heightError;
            this._lastSpringForce = springForce;
            this._lastAppliedForce = { x: 0, y: springForce, z: 0 };

            this.body.applyForce(new Vector3(0, springForce, 0));
        } else {
            this._lastGroundHit = null;
            this._lastHeightError = null;
            this._lastSpringForce = null;
            this._lastAppliedForce = null;
            this.contactNormal.set(0, 1, 0);
        }
    }

    /** Projects `direction` onto the current ground (or air) and drives velocity toward it. */
    move(direction, deltaTime) {
        this.moveVector.copy(direction);
        this.moveVector.scaleInPlace(this.moveSpeed);
        this._lastMoveDelta.copy(this.moveVector);

        if (this.currentState.name === 'falling' || this.currentState.name === 'jumping') {
            const currentY = this.body.linear_velocity.y;
            this.body.linear_velocity.x += (this.moveVector.x - this.body.linear_velocity.x) * this.airAcceleration;
            this.body.linear_velocity.z += (this.moveVector.z - this.body.linear_velocity.z) * this.airAcceleration;
            this.body.linear_velocity.y = currentY;
        } else {
            const dot = this.moveVector.dot(this.contactNormal);
            this.projectedMove.copy(this.moveVector);
            this.tempVector.copy(this.contactNormal);
            this.tempVector.scaleInPlace(dot);
            this.projectedMove.subInPlace(this.tempVector);
            this._lastProjectedMove.copy(this.projectedMove);

            this.body.linear_velocity.x += (this.projectedMove.x - this.body.linear_velocity.x) * this.groundAcceleration;
            this.body.linear_velocity.z += (this.projectedMove.z - this.body.linear_velocity.z) * this.groundAcceleration;
        }

        const vx = this.body.linear_velocity.x, vz = this.body.linear_velocity.z;
        const currentSpeed = Math.sqrt(vx * vx + vz * vz);
        if (currentSpeed > this.maxSpeed) {
            const scale = this.maxSpeed / currentSpeed;
            this.body.linear_velocity.x *= scale;
            this.body.linear_velocity.z *= scale;
        }
    }

    /** Everything about current movement state, forces and contacts — for debugging/inspection. */
    getDebugInfo() {
        return {
            physics: {
                position: { x: this.body.position.x, y: this.body.position.y, z: this.body.position.z },
                velocity: { x: this.body.linear_velocity.x, y: this.body.linear_velocity.y, z: this.body.linear_velocity.z }
            },
            movement: {
                input_direction: this._hasInputThisFrame
                    ? { x: this._inputDirection.x, y: this._inputDirection.y, z: this._inputDirection.z }
                    : null,
                raw_move: { x: this._lastMoveDelta.x, y: this._lastMoveDelta.y, z: this._lastMoveDelta.z },
                projected_move: { x: this._lastProjectedMove.x, y: this._lastProjectedMove.y, z: this._lastProjectedMove.z },
                applied_force: this._lastAppliedForce
            },
            spring: {
                hit_distance: this._lastGroundHit ? this._lastGroundHit.distance : null,
                height_error: this._lastHeightError,
                spring_force: this._lastSpringForce,
                target_height: this.rideHeight,
                spring_strength: this.springStrength,
                spring_damping: this.springDamping
            },
            contact: {
                normal: { x: this.contactNormal.x, y: this.contactNormal.y, z: this.contactNormal.z },
                hit: this._lastGroundHit
                    ? { point: this._lastGroundHit.point, normal: this._lastGroundHit.normal, distance: this._lastGroundHit.distance }
                    : null
            },
            state: { current: this.currentState ? this.currentState.name : null, lastTransition: this._lastStateChange }
        };
    }

    addListener(event, fn) {
        (this._listeners[event] || (this._listeners[event] = [])).push(fn);
        return this;
    }

    emit(event, arg) {
        const list = this._listeners[event];
        if (!list) return;
        for (let i = 0; i < list.length; i++) list[i](arg);
    }
}

ActionPhysics.CharacterController = CharacterController;


// ==== src/character/fps/FPSControllerConstants.js ====
/**
 * Every tunable default for FPSCharacterController, in ONE place, grouped by subsystem. The
 * controller reads each default from here (constructor: `o.walkSpeed !== undefined ?
 * o.walkSpeed : FPS_CONTROLLER_DEFAULTS.movement.walkSpeed`), so a caller can still
 * override any single value per-instance via the options object — this is only the fallback.
 *
 * What is NOT here (on purpose): algorithm-internal epsilons/thresholds inside the collision +
 * slope math (1e-4 guards, normal.y classifications, sub-step fractions) — those are
 * implementation details, not feel knobs, and stay at their use site in
 * CharacterController/Constants.js (the FPSC object).
 *
 * @class FPS_CONTROLLER_DEFAULTS
 * @static
 */
var FPS_CONTROLLER_DEFAULTS = {
    // ---- Collider dimensions + mass (pre-scale "base" values; _applyScale multiplies at runtime) ----
    dimensions: {
        width: 0.6,
        depth: 0.6,
        height: 1.8,
        mass: 10,
        eyeHeightRatio: 0.42, // eyeHeight default = height * this (overridable directly via o.eyeHeight)
        crouchRatio: 0.55,    // crouched collider height as a fraction of standing height
    },

    // ---- Ground movement. Three gaits: walk (held modifier) < move/run (default) < sprint. ----
    movement: {
        walkSpeed: 3.8,        // deliberate slow gait (held walk modifier)
        moveSpeed: 7,          // RUN speed — the no-modifier default
        sprintSpeed: 11.5,     // top gait
        crouchSpeedMult: 0.5,  // multiplies whichever gait is active while crouched (unitless)
        sprintDecay: 10,       // units/sec bleed of excess speed after releasing sprint (Infinity = instant)
        groundStopDecel: 80,   // units/sec decel when all move keys released (idle stop)
        airControl: 0.12,      // steering authority while airborne (0..1)
        friction: 0,           // body friction (0 keeps wall-slides clean; kinematic grounding holds slopes)
    },

    // ---- Jump + forgiveness windows ----
    jump: {
        jumpSpeed: 4.6,
        stepHeight: 0.4,       // max ledge height the mover steps up onto (base/1x; scales linearly with player scale)
        stepDownDist: 0.5,     // max drop the mover snaps down to keep grounded
        coyoteTime: 0.1,       // sec after leaving a ledge a jump still registers
        jumpBuffer: 0.12,      // sec before landing a jump press is remembered and fires on touchdown
    },

    // ---- Slopes ----
    slopes: {
        maxSlopeAngle: 45.57,  // max standable slope, degrees (>=90 disables the limit)
        climbSteepSlopes: false, // can the player ascend a too-steep slope by walking into it
    },

    // ---- Slide (crouch-at-speed) ----
    slide: {
        enabled: true,
        requiresMoveInput: true,  // ENTRY requires a movement key held (not crouch alone); exit does not
        allowLandingWithoutInput: true, // ...EXCEPT on the landing frame, where crouch + speed alone can start a slide
        minSpeed: 7.8,         // speed at/above which a crouch launches a slide
        endSpeed: 1,           // slide ends when speed bleeds below this
        friction: 6,           // flat-ground slide friction
        boost: 1.3,            // launch speed multiplier
        control: 0.14,         // steering authority while sliding (0..1)
        slopeAccel: 1.5,       // downhill acceleration factor while sliding
        slopeMin: 0.2,         // sin(angle) at/above which the slide is gravity-governed (Infinity disables)
        slopeFriction: 1.5,    // cross-slope friction while gravity-sliding
        reversalBrakeMult: 4,  // multiplier on slopeFriction for how hard a deliberate reversal brakes
    },

    // ---- Ladders (see _updateLadder) ----
    ladder: {
        climbSpeed: 2.5,        // vertical speed while climbing (pre-scale)
        strafeSpeed: 2.5,       // lateral speed along the ladder's face while climbing (pre-scale)
        // Forward/back and strafe contributions are summed WITHOUT normalizing the combined wish
        // vector, unlike ground movement — holding both diagonally into a ladder climbs strictly
        // faster than either alone. Intentional.
        mountReach: 0.2,        // reach (pre-scale) past the collider's own half-width for the mount probe
        dismountPushSpeed: 7.0, // horizontal shove speed away from the face on a jump-off dismount (pre-scale)
    },

    // ---- Ghost: the solver body that trails the player and pushes objects (see _syncGhost) ----
    ghost: {
        pushMassBaseMult: 35,  // objects heavier than mass * this block like a wall; lighter yield proportionally
        // Physics material of the ghost body itself (not the chase drive, which targets the
        // character's predicted end-of-tick position directly). Zero friction/restitution/
        // linearDamping so the chase-drive velocity is never fought by the solver; high
        // angularDamping keeps contact torque from spinning it up while it shoves objects.
        material: {
            friction: 0,
            restitution: 0,
            linearDamping: 0,
            angularDamping: 0.9,
        },
    },

    // ---- Knockback: how the player RECEIVES a push from an object (see _readGhostKnockback) ----
    knockback: {
        receivePush: true,        // gate the whole knockback path
        maxSpeed: 16,             // cap on received knockback speed
        knockbackFraction: 1.0,   // scale received knockback
        selfPush: false,          // false = only an object with its OWN inbound momentum knocks you (no self-push
                                  //         oscillation); true = legacy relative-closing gate (oscillates)
    },

    // ---- Netcode / prediction behavior for the ghost (both default ON; false reverts to older behavior) ----
    netcode: {
        driveGhostDuringResim: true,    // run the ghost drive during rollback resim (off = objects rubber-band)
        hardsnapGhostOnReconcile: true, // snap ghost onto authority on setState (off = objects oscillate)
    },

    // ---- View / aim ----
    view: {
        yaw: 0,
        pitch: 0,
        maxPitch: 1.5,         // clamp, radians
    },

    // ---- Render (sub-tick eye interpolation) ----
    render: {
        snapDist: 0.8,         // per-tick eye jump (units) above which the interp snaps instead of sliding
    },

    // ---- Mantle (ledge grab + pull-up arc) ----
    mantle: {
        height: 2.2,        // max rise (feet to ledge top) that can be mantled (pre-scale); above this = too tall
        reach: 0.25,        // extra reach past the collider's half-width for the forward ledge probe (pre-scale)
        duration: 0.35,     // total arc time in seconds (lift + vault)
        liftFrac: 0.6,      // fraction of duration spent in the lift phase; remainder is the vault
        speed: 6.0,         // drive speed for both lift and vault phases (pre-scale, units/sec)
    },

    // ---- Misc identity defaults (not feel knobs, but kept here so nothing is scattered) ----
    misc: {
        color: "#cc4444",
        visible: false,        // the collider body is invisible by default (a model/render layer draws the player)
        bodyName: "fpsControllerBody",
        scale: 1,              // 1 = no scaling
        spawn: { x: 0, y: 2, z: 0 }, // fallback spawn when no position is passed
    },
};

ActionPhysics.FPS_CONTROLLER_DEFAULTS = FPS_CONTROLLER_DEFAULTS;


// ==== src/character/fps/FPSCharacterController.js ====
/**
 * Engine-agnostic, reusable first-person character controller built on the physics engine
 * (NOT `CharacterController` — that's a separate, spring-based capsule controller; this
 * one is a kinematic box mover with its own ground/wall/slope/ghost handling). Uses a BOX
 * collider that is angular-locked so it can never tip. Grounding, slopes, walls and resting are
 * handled by hand-written raycast/sweep probes each tick, not by the physics solver — the
 * controller does NOT hard-teleport the body to the ground every frame (that fights the solver
 * and jitters). It only:
 *   - sets HORIZONTAL velocity from input each step (snappy, no momentum fighting),
 *   - projects that velocity along the ground plane (no sliding on slopes) and off walls
 *     (smooth move-and-slide, so we never ram the solver), and
 *   - applies targeted raycast assists for STEP-UP and STEP-DOWN, which the solver can't
 *     do with a box collider.
 * Vertical motion (gravity, landing) is left to the solver; only jump / jetpack thrust write
 * the vertical velocity directly.
 *
 * Also handles two further movement states parallel to ground/air: climbing a body tagged
 * isLadder (see _updateLadder), and riding a body tagged isPlatform via base-velocity inheritance
 * (see _baseVelocity in the constructor, and beginStep/endStep/_updateVertical) — jumping off a
 * rising platform adds its velocity into the jump.
 *
 * DESIGN SEAMS:
 *   The controller never reads input directly. Gameplay samples an input command (pure data, so
 *   any caller can run remote characters' commands through the exact same path) and feeds it in,
 *   bracketing a single physics world step:
 *       const cmd = mySampleInput(input);       // input mapping is policy, lives outside this class
 *       controller.beginStep(cmd, dt);           // pre-physics: velocity + assists
 *       world.step(dt);                          // ONE world step (all bodies)
 *       controller.endStep(dt);                  // post-physics: grounded + step-down
 *
 * EXTENSIBILITY:
 *   This base IS the default "kit" (instantiate it directly). A game adds an alternate kit by
 *   subclassing and overriding `_updateVertical` (jump/gravity) and/or `_getMoveSpeed` without
 *   touching ground/step/wall logic.
 *
 * Units: METERS (gravity -9.81 by default); defaults are in meters (a ~1.8m human ≈ 1.8 units
 * tall). Use `scale` to resize the whole character.
 *
 * @class FPSCharacterController
 * @constructor
 * @param {World} world - The physics world this controller's body/ghost live in.
 * @param {Object} [options] - See FPS_CONTROLLER_DEFAULTS (FPSControllerConstants.js) for every
 *   tunable default and its meaning; each `options.X` below overrides that default per-instance.
 * @param {Vector3} [options.position] - Spawn position (body center). Default (0,20,0).
 * @param {Number} [options.scale=1] - Uniform size multiplier for the whole character.
 * @param {Number} [options.width] - Collider width (x) before scale.
 * @param {Number} [options.depth] - Collider depth (z) before scale.
 * @param {Number} [options.height] - Collider height (y) before scale.
 * @param {Number} [options.mass] - Body mass before scale.
 * @param {Number} [options.eyeHeight] - Eye offset above body CENTER before scale.
 * @param {Number} [options.walkSpeed] - Held-walk gait speed before scale (slower than run).
 * @param {Number} [options.moveSpeed] - RUN speed (the default no-modifier gait) before scale.
 * @param {Number} [options.sprintSpeed] - Sprint move speed before scale.
 * @param {Number} [options.crouchSpeedMult] - Multiplier on the active gait while crouched.
 * @param {Number} [options.sprintDecay] - Rate (units/sec) the sprint boost fades after release.
 * @param {Number} [options.groundStopDecel] - Deceleration (units/sec) on releasing all move keys.
 * @param {Number} [options.airControl] - 0..1 horizontal steering authority per step while airborne.
 * @param {Number} [options.jumpSpeed] - Jump velocity before scale.
 * @param {Number} [options.friction] - Body friction (0 keeps wall-slides clean; kinematic
 *   grounding holds slopes without relying on solver friction).
 * @param {Number} [options.stepHeight] - Max step-UP height before scale.
 * @param {Number} [options.stepDownDist] - Max step-DOWN snap before scale.
 * @param {Number} [options.coyoteTime] - Seconds after leaving a ledge you can still jump (0=off).
 * @param {Number} [options.jumpBuffer] - Seconds before landing a jump press is remembered (0=off).
 * @param {Boolean} [options.slideEnabled=true] - Enable crouch-at-speed sliding.
 * @param {Boolean} [options.slideRequiresMoveInput=true] - Require a movement key held to START a slide (exit never requires it).
 * @param {Boolean} [options.slideAllowLandingWithoutInput=true] - Waive the movement-key requirement on the landing frame, so an impact-slide can start from crouch + speed alone.
 * @param {Number} [options.slideMinSpeed] - Min along-ground speed (pre-scale) to start a slide.
 * @param {Number} [options.slideEndSpeed] - Flat slide ends below this speed (pre-scale).
 * @param {Number} [options.slideFriction] - Speed bled per second on flat ground (pre-scale).
 * @param {Number} [options.slideBoost] - Launch speed multiplier at slide entry.
 * @param {Number} [options.slideControl] - 0..1 carve authority while sliding (speed-preserving).
 * @param {Number} [options.slideSlopeAccel] - Gravity-along-slope multiplier while sliding.
 * @param {Number} [options.slideSlopeMin] - Min slope (sin of angle) that sustains a slide via gravity.
 * @param {Number} [options.slideSlopeFriction] - Cross-slope bleed per second on a sustaining slope.
 * @param {Number} [options.slideReversalBrakeMult] - Multiplier on slideSlopeFriction for how hard a
 *   deliberate on-slope reversal (wish opposing current slide direction) brakes before the carve
 *   steering picks the new heading back up.
 * @param {Boolean} [options.receivePush=true] - Enable object-to-character knockback via the ghost body.
 * @param {Number} [options.receiveMaxSpeed] - Cap on how fast a single object hit can knock the character.
 * @param {Number} [options.receiveKnockbackFraction] - Fraction of the ghost's contact velocity transferred.
 * @param {Number} [options.maxSlopeAngle] - Max standable slope in degrees (90+ disables the limit).
 * @param {Boolean} [options.visible=false] - Whether a consumer should treat the collider as drawable
 *   (this controller does no rendering itself — see `object.isVisible`).
 * @param {String} [options.color] - Cosmetic color tag, opaque to this class.
 * @param {Number} [options.skin] - Contact/sweep tolerance override (see FPSC.SKIN).
 */
var FPSCharacterController = function(world, options) {
    this.world = world;
    var o = options || {};

    var D = FPS_CONTROLLER_DEFAULTS;
    var dim = D.dimensions, mv = D.movement, jmp = D.jump, slp = D.slopes, sld = D.slide,
        gh = D.ghost, kb = D.knockback, net = D.netcode, vw = D.view, rnd = D.render, msc = D.misc,
        lad = D.ladder, man = D.mantle;

    // Base (pre-scale) values.
    this._baseWidth = o.width !== undefined ? o.width : dim.width;
    this._baseDepth = o.depth !== undefined ? o.depth : dim.depth;
    this._baseHeight = o.height !== undefined ? o.height : dim.height;
    this._baseMass = o.mass !== undefined ? o.mass : dim.mass;
    this._baseEyeHeight = o.eyeHeight !== undefined ? o.eyeHeight : this._baseHeight * dim.eyeHeightRatio;

    this._baseWalkSpeed = o.walkSpeed !== undefined ? o.walkSpeed : mv.walkSpeed;
    this._baseMoveSpeed = o.moveSpeed !== undefined ? o.moveSpeed : mv.moveSpeed;
    this._baseSprintSpeed = o.sprintSpeed !== undefined ? o.sprintSpeed : mv.sprintSpeed;
    this.crouchSpeedMult = o.crouchSpeedMult !== undefined ? o.crouchSpeedMult : mv.crouchSpeedMult;
    this._baseSprintDecay = o.sprintDecay !== undefined ? o.sprintDecay : mv.sprintDecay;
    this._baseGroundStopDecel = o.groundStopDecel !== undefined ? o.groundStopDecel : mv.groundStopDecel;
    this._baseJumpSpeed = o.jumpSpeed !== undefined ? o.jumpSpeed : jmp.jumpSpeed;
    this._baseStepHeight = o.stepHeight !== undefined ? o.stepHeight : jmp.stepHeight;
    this._baseStepDownDist = o.stepDownDist !== undefined ? o.stepDownDist : jmp.stepDownDist;
    // Contact/sweep tolerance. A per-instance override (not just FPSC.SKIN) lets a project tune this
    // for a specific character without touching the shared engine default.
    this._baseSkin = o.skin !== undefined ? o.skin : FPSCharacterController.FPSC.SKIN;

    // Jump-off-a-platform base-velocity behavior — see _updateVertical. Two independent axes, opposite
    // defaults: VERTICAL fling (jumping off a rising elevator flings you higher) defaults ON — it's the
    // established, expected platforming feel and existing tests (PL3) depend on it. HORIZONTAL carry
    // (jumping off a moving/rotating platform keeps its sideways speed) defaults OFF — carrying a fast
    // platform's horizontal speed into a jump (especially a spinning platform's tangential speed) reads
    // as an unwanted "fling" rather than a clean jump; a project that wants the classic
    // conveyor-belt-momentum feel can opt back in per-instance.
    this._jumpKeepsVerticalBaseVelocity = o.jumpKeepsVerticalBaseVelocity !== undefined ? o.jumpKeepsVerticalBaseVelocity !== false : true;
    this._jumpKeepsHorizontalBaseVelocity = o.jumpKeepsHorizontalBaseVelocity === true;
    // A jump is the player's WISH to leave the surface — that wish should only ever be HELPED by the
    // platform's current vertical motion, never fought. Default true (opt-out): a platform descending
    // at jump time contributes nothing negative to the launch, only a rising one still flings higher
    // (via jumpKeepsVerticalBaseVelocity above). Scoped to the jump moment only — normal ground-follow
    // on a descending platform when NOT jumping is unaffected, still correctly rides it down.
    this._jumpIgnoresDescendingBaseVelocity = o.jumpIgnoresDescendingBaseVelocity !== undefined ? o.jumpIgnoresDescendingBaseVelocity !== false : true;

    // Object interaction (push and be pushed) runs through the ghost body (see _buildGhost / _readGhostKnockback).
    this._receivePush = o.receivePush !== undefined ? o.receivePush !== false : kb.receivePush;
    // Speed-like (a velocity cap), so it must scale with character size the same way sprintSpeed
    // does — stored as a BASE here and scaled in _applyScale, not a fixed literal, so a 2x
    // character's (faster, harder-hitting) knockback is judged against a 2x cap, not the 1x default.
    this._baseReceiveMaxSpeed = o.receiveMaxSpeed !== undefined ? o.receiveMaxSpeed : kb.maxSpeed;
    this._receiveKnockbackFraction = o.receiveKnockbackFraction !== undefined ? o.receiveKnockbackFraction : kb.knockbackFraction;
    this._receiveSelfPush = o.receiveSelfPush !== undefined ? o.receiveSelfPush === true : kb.selfPush;
    // Ghost body's physics material — read once here so _buildGhost (called on every rebuild:
    // crouch, setScale, respawn) doesn't need its own access to FPS_CONTROLLER_DEFAULTS.
    this._ghostMaterial = o.ghostMaterial || gh.material;
    this._driveGhostDuringResim = o.driveGhostDuringResim !== undefined ? o.driveGhostDuringResim !== false : net.driveGhostDuringResim;
    this._hardsnapGhostOnReconcile = o.hardsnapGhostOnReconcile !== undefined ? o.hardsnapGhostOnReconcile !== false : net.hardsnapGhostOnReconcile;
    this._pushMassLimitOverride = o.pushMassLimit;
    this._pushMassBaseMult = gh.pushMassBaseMult;

    this.airControl = o.airControl !== undefined ? o.airControl : mv.airControl;
    this.friction = o.friction !== undefined ? o.friction : mv.friction;

    this.coyoteTime = o.coyoteTime !== undefined ? o.coyoteTime : jmp.coyoteTime;
    this.jumpBuffer = o.jumpBuffer !== undefined ? o.jumpBuffer : jmp.jumpBuffer;
    this._coyoteTimer = 0;
    this._jumpBufferTimer = 0;

    // Max standable slope, in degrees. Stored as the cosine (_minStandableNormalY) since that's
    // what the per-tick ground-normal check compares against. 90 (or more) disables the limit.
    this.maxSlopeAngle = o.maxSlopeAngle !== undefined ? o.maxSlopeAngle : slp.maxSlopeAngle;
    this._minStandableNormalY = Scalar.cos(Math.min(90, this.maxSlopeAngle) * Math.PI / 180);
    this.climbSteepSlopes = o.climbSteepSlopes !== undefined ? o.climbSteepSlopes === true : slp.climbSteepSlopes;

    // Slide (crouch-at-speed). slide* tuning values only take effect once sliding.
    this.slideEnabled = o.slideEnabled !== undefined ? o.slideEnabled !== false : sld.enabled;
    this.slideRequiresMoveInput = o.slideRequiresMoveInput !== undefined ? !!o.slideRequiresMoveInput : sld.requiresMoveInput;
    this.slideAllowLandingWithoutInput = o.slideAllowLandingWithoutInput !== undefined ? !!o.slideAllowLandingWithoutInput : sld.allowLandingWithoutInput;
    this._baseSlideMinSpeed = o.slideMinSpeed !== undefined ? o.slideMinSpeed : sld.minSpeed;
    this._baseSlideEndSpeed = o.slideEndSpeed !== undefined ? o.slideEndSpeed : sld.endSpeed;
    this._baseSlideFriction = o.slideFriction !== undefined ? o.slideFriction : sld.friction;
    this.slideBoost = o.slideBoost !== undefined ? o.slideBoost : sld.boost;
    this.slideControl = o.slideControl !== undefined ? o.slideControl : sld.control;
    this.slideSlopeAccel = o.slideSlopeAccel !== undefined ? o.slideSlopeAccel : sld.slopeAccel;
    this.slideSlopeMin = o.slideSlopeMin !== undefined ? o.slideSlopeMin : sld.slopeMin;
    this._baseSlideSlopeFriction = o.slideSlopeFriction !== undefined ? o.slideSlopeFriction : sld.slopeFriction;
    // Reversal brake rate, as a multiplier on slideSlopeFriction — how hard a deliberate reversal
    // (wish opposing current slide direction, see FPSC.SLIDE_REVERSAL_DOT) bleeds speed before the
    // ordinary carve blend picks the new heading back up.
    this.slideReversalBrakeMult = o.slideReversalBrakeMult !== undefined ? o.slideReversalBrakeMult : sld.reversalBrakeMult;
    // Authoritative movement state — see the "Movement state machine" comment above endStep. Starts
    // AIRBORNE; the first tick's endStep probe corrects it (e.g. to WALK if spawned on the ground).
    this._moveState = FPSCharacterController.FPSC.MOVE_AIRBORNE;
    this._slipJustEntered = false; // gates the SLIP branch's one-time velocity projection; set by endStep
    this._wantCrouch = false; // this tick's crouch intent, stashed by beginStep for endStep to read
    this._hasMoveInput = false; // this tick's movement input, stashed by beginStep for endStep to read
    this._prevCrouch = false;

    // Ladders (see _updateLadder). base* values scale with the character like every other speed.
    this._baseLadderClimbSpeed = o.ladderClimbSpeed !== undefined ? o.ladderClimbSpeed : lad.climbSpeed;
    this._baseLadderStrafeSpeed = o.ladderStrafeSpeed !== undefined ? o.ladderStrafeSpeed : lad.strafeSpeed;
    this._baseLadderMountReach = o.ladderMountReach !== undefined ? o.ladderMountReach : lad.mountReach;
    this._baseLadderDismountPushSpeed = o.ladderDismountPushSpeed !== undefined ? o.ladderDismountPushSpeed : lad.dismountPushSpeed;
    this._onLadder = false;
    this._ladderNormal = new Vector3(0, 0, 1); // points OUT of the ladder face, toward the character

    // Mantle (ledge grab + pull-up arc, see _updateMantle / Movement/Mantle.js).
    this._baseMantleHeight = o.mantleHeight !== undefined ? o.mantleHeight : man.height;
    this._baseMantleReach = o.mantleReach !== undefined ? o.mantleReach : man.reach;
    this._baseMantleSpeed = o.mantleSpeed !== undefined ? o.mantleSpeed : man.speed;
    this.mantleDuration = o.mantleDuration !== undefined ? o.mantleDuration : man.duration;
    this.mantleLiftFrac = o.mantleLiftFrac !== undefined ? o.mantleLiftFrac : man.liftFrac;
    this._mantleActive = false;
    this._mantleTimer = 0;
    // Arc anchors: body-center start (X/Y/Z), body-center Y once feet clear the ledge top, and the
    // XZ landing point past the ledge edge — all captured once at commit time (see _updateMantle's
    // detection block) so the arc interpolates position directly instead of driving velocity
    // through _collideAndSlide, which would treat the ledge face as a blocking wall.
    this._mantleStartX = 0;
    this._mantleStartY = 0;
    this._mantleStartZ = 0;
    this._mantleTopBodyY = 0;
    this._mantleLandX = 0;
    this._mantleLandZ = 0;

    // Moving platforms (see endStep's acquire + beginStep's apply). A body tagged isPlatform=true,
    // when it's what the ground probe is currently resting on, has its linear_velocity read into
    // this vector once per endStep. beginStep adds it into the horizontal move so collide-and-slide
    // carries the rider through real swept collision; it stays baked into gb.x/z afterward (position
    // integrates from gb on a LATER, separate world step, so subtracting it back out first would
    // discard the ride). _ownVelocityX/Z tracks the character's OWN horizontal velocity separately, so
    // endStep's groundStopDecel (and the sprint-decay branch) decay the character's momentum without
    // also decaying the platform's contribution. The vertical component is folded into a jump's
    // velocity ASSIGNMENT additively (not overwritten) in _updateVertical.
    this._baseVelocity = new Vector3(0, 0, 0);
    this._ownVelocityX = 0;
    this._ownVelocityZ = 0;

    var g = world.gravity || { y: -9.81 };
    this._gravityVec = new Vector3(0, g.y, 0);
    this._groundSuppress = 0;
    this._jumpRising = false; // see _updateVertical's jump branch + endStep's `suppressed`
    this._prevTopCandidateY = null; // last tick's highest ground candidate — see the slide-launch gate in endStep
    this._slideLaunched = false; // latched true the tick a slide apex launch fires; see endStep

    this._color = o.color || msc.color;
    this._visible = o.visible !== undefined ? o.visible === true : msc.visible;
    this._bodyName = o.bodyName || msc.bodyName;

    this.yaw = o.yaw !== undefined ? o.yaw : vw.yaw;
    this.pitch = o.pitch !== undefined ? o.pitch : vw.pitch;
    this.maxPitch = o.maxPitch !== undefined ? o.maxPitch : vw.maxPitch;

    // Live, render-only aim set per frame via aim(). Separate from yaw/pitch (the commanded,
    // networked, fixed-tick facing) so the view can update every frame without touching the
    // simulation. Falls back to yaw/pitch until aim() is called. See getLiveAimDirection().
    this._liveYaw = this.yaw;
    this._livePitch = this.pitch;
    this._liveAimSet = false;

    // Render interpolation: the body steps at the fixed tick but the screen draws at display
    // refresh. captureRenderState() stashes the last two fixed-tick eyes; renderEye(alpha) lerps
    // them for the draw. _renderSnapDist2 is the squared per-tick eye jump above which the
    // interpolation snaps instead of sliding (teleport/respawn).
    this._prevEye = null;
    this._currEye = null;
    // Base (scale-1) interp snap distance. The SQUARED, scale-adjusted value used at the compare site
    // is (re)derived in _applyScale — a scaled character legitimately moves the eye N× farther per tick,
    // so a fixed 1× threshold would read normal motion as a teleport and snap every tick (killing the
    // sub-tick smoothing → jitter at high scale).
    this._baseRenderSnapDist = o.renderSnapDist !== undefined ? o.renderSnapDist : rnd.snapDist;
    this._renderSnapDist2 = this._baseRenderSnapDist * this._baseRenderSnapDist;
    this._renderProxy = null;

    this.grounded = false;
    this.groundNormal = new Vector3(0, 1, 0);
    this.velocityY = 0;
    // Vertical eye displacement this controller applied via the ground-clamp/crouch/scale snaps
    // (not from velocity integration). Render-only; a camera consumes it to smooth those snaps.
    this._viewDisplacementY = 0;
    // True while the caller is resimulating already-run commands (see beginResim/endResim).
    // View-displacement is suppressed during resim so re-derived state doesn't double-count.
    this._resimulating = false;

    // Crouch is an instant collider-height swap. crouchRatio is the fraction of standing
    // height when crouched.
    this.crouchRatio = o.crouchRatio !== undefined ? o.crouchRatio : dim.crouchRatio;
    this.crouching = false;

    // Opaque consumer payload; the controller never reads inside it. Rides the same
    // command->state->snapshot path as crouch/scale.
    this.userData = null;

    this.scale = 1;
    var spawnOpt = o.position;
    var spawn = spawnOpt ? new Vector3(spawnOpt.x, spawnOpt.y, spawnOpt.z)
        : new Vector3(msc.spawn.x, msc.spawn.y, msc.spawn.z);
    this._applyScale(o.scale !== undefined ? o.scale : msc.scale);
    this._buildBody(spawn);
};

var proto = FPSCharacterController.prototype;

// Resolve scaled dimensions/speeds from the base values.
proto._applyScale = function(scale) {
    this.scale = scale;
    this.width = this._baseWidth * scale;
    this.depth = this._baseDepth * scale;
    // Standing dimensions, then the active height/eye reflect the crouch state.
    this.standHeight = this._baseHeight * scale;
    this.standEye = this._baseEyeHeight * scale;
    this.height = this.crouching ? this.standHeight * this.crouchRatio : this.standHeight;
    this.eyeHeight = this.crouching ? this.standEye * this.crouchRatio : this.standEye;
    this.mass = this._baseMass * scale * scale * scale; // volume scaling
    this.walkSpeed = this._baseWalkSpeed * scale;
    this.moveSpeed = this._baseMoveSpeed * scale;
    this.sprintSpeed = this._baseSprintSpeed * scale;
    this.sprintDecay = this._baseSprintDecay * scale; // excess-speed bleed rate (Infinity = instant)
    this.groundStopDecel = this._baseGroundStopDecel * scale; // idle ground stop rate (Infinity = instant hard-stop)
    this.slideMinSpeed = this._baseSlideMinSpeed * scale;
    this.slideEndSpeed = this._baseSlideEndSpeed * scale;
    this.slideFriction = this._baseSlideFriction * scale;
    this.slideSlopeFriction = this._baseSlideSlopeFriction * scale;
    this.jumpSpeed = this._baseJumpSpeed * Math.sqrt(scale); // jump height scales ~linearly
    this.stepHeight = this._baseStepHeight * scale;
    this.stepDownDist = this._baseStepDownDist * scale;
    this.ladderClimbSpeed = this._baseLadderClimbSpeed * scale;
    this.ladderStrafeSpeed = this._baseLadderStrafeSpeed * scale;
    this.ladderMountReach = this._baseLadderMountReach * scale;
    this.ladderDismountPushSpeed = this._baseLadderDismountPushSpeed * scale;
    this.mantleHeight = this._baseMantleHeight * scale;
    this.mantleReach = this._baseMantleReach * scale;
    this.mantleSpeed = this._baseMantleSpeed * scale;
    this._skin = this._baseSkin * scale; // contact tolerance
    this._groundTol = FPSCharacterController.FPSC.GROUND_TOL * scale; // how close feet must be to count as grounded
    // Terminal fall speed. Also keeps per-step fall distance < ground-probe reach so
    // the raycast ground clamp can't be tunneled through on big drops.
    this._maxFall = 22 * scale;
    // Render interp snap threshold scales with the body: a 4x character sprints ~4x faster, so its eye
    // legitimately jumps ~4x farther per tick. Without this, that normal motion trips the teleport-snap
    // and the sub-tick smoother snaps every tick instead of easing — the high-scale render jitter.
    var rs = (this._baseRenderSnapDist || 0.8) * scale;
    this._renderSnapDist2 = rs * rs;
    // Push-mass eligibility limit scales with the character, mass-like (volume, scale^3).
    this._pushMassLimit = this._pushMassLimitOverride !== undefined ?
        this._pushMassLimitOverride : this._baseMass * scale * scale * scale * this._pushMassBaseMult;
    this._receiveMaxSpeed = this._baseReceiveMaxSpeed * scale;
};

/**
 * Resize the whole character at runtime (rebuilds the collider, feet planted).
 * @method setScale
 * @param {Number} scale
 */
proto.setScale = function(scale) {
    var p = this.body.position;
    var eyeBefore = p.y + this.eyeHeight;
    var feetY = p.y - this.height / 2;
    this._applyScale(scale);
    this._buildBody(new Vector3(p.x, feetY + this.height / 2, p.z));
    if (!this._resimulating) { this._viewDisplacementY += this.body.position.y + this.eyeHeight - eyeBefore; } // eye jump from the resize
};

// Instantly enter/leave crouch by rebuilding the collider at the new height. Grounded: feet
// planted, top comes down. Airborne: top planted, feet rise up (crouch-jump clearance aid).
proto._setCrouch = function(want) {
    if (want === this.crouching) { return; }
    var p = this.body.position;
    var eyeBefore = p.y + this.eyeHeight;
    var feetY = p.y - this.height / 2;
    var headY = p.y + this.height / 2;
    this.crouching = want;
    this._applyScale(this.scale); // recompute height/eye for the new crouch state
    var newCenterY = this.grounded ? (feetY + this.height / 2) : (headY - this.height / 2);
    this._buildBody(new Vector3(p.x, newCenterY, p.z));
    if (!this._resimulating) { this._viewDisplacementY += this.body.position.y + this.eyeHeight - eyeBefore; } // eye jump from the crouch swap
};

/**
 * Add a velocity impulse and force the character airborne (explosions / knockback / rocket-jumping).
 * @method applyKnockback
 */
proto.applyKnockback = function(vx, vy, vz) {
    var gb = this.body.linear_velocity;
    gb.x += vx;
    gb.y += vy;
    gb.z += vz;
    this.grounded = false;
    this._moveState = FPSCharacterController.FPSC.MOVE_AIRBORNE;
    this._groundSuppress = 10;
    this.velocityY = gb.y;
};

// ---- Lifecycle ---------------------------------------------------------

/**
 * @method setPosition
 * @param {Vector3} pos
 */
proto.setPosition = function(pos) {
    this.body.position.set(pos.x, pos.y, pos.z);
    this.body.updateDerived();
    this.body.linear_velocity.set(0, 0, 0);
    this.grounded = false;
    this._moveState = FPSCharacterController.FPSC.MOVE_AIRBORNE;
    if (this._ghost) {
        var inset = this._ghostGroundInset || 0;
        this._ghost.position.set(pos.x, pos.y + inset / 2, pos.z);
        this._ghost.linear_velocity.set(0, 0, 0);
    }
};

/**
 * @method destroy
 */
proto.destroy = function() {
    this.world.removeRigidBody(this.body);
    this._destroyGhost();
};

ActionPhysics.FPSCharacterController = FPSCharacterController;


// ==== src/character/fps/Constants.js ====
// Internal statics for FPSCharacterController: algorithm constants (FPSC) and the private raycast
// helper. LOAD ORDER REQUIREMENT: this file must load AFTER FPSCharacterController.js (which defines
// `FPSCharacterController` as the constructor function) — these assignments attach static
// properties onto that function object, so the function must already exist. Nothing at module-load
// time in any other file reads FPSC/`_raycast` before first use (only inside function bodies invoked
// later, e.g. at `new FPSCharacterController(...)` time), so this ordering is safe. See
// gulpfile.js's buildOrder comment for the explicit ordering this depends on.

// Internal algorithm constants — the thresholds/epsilons/factors baked into the controller's collision,
// grounding, slope and ghost math. These are NOT caller-facing feel knobs (those live in
// FPS_CONTROLLER_DEFAULTS); they are implementation tolerances kept named here so nothing is a bare literal
// at a use site. Changing them changes solver behavior — treat as internals, not tuning.
FPSCharacterController.FPSC = {
    // Contact tolerances (meters, multiplied by the character scale where used).
    SKIN: 0.01,               // sweep/contact skin width
    GROUND_TOL: 0.1,          // how close the feet must be to a surface to count as grounded
    GHOST_GROUND_INSET: 0.25, // fraction of height the ghost's bottom is lifted above the feet

    // "Effectively zero" epsilons — vector/speed magnitudes below which we treat a quantity as null.
    EPS_LEN: 1e-4,            // general length/normal guard
    EPS_DIR: 1e-5,            // direction-normalization guard
    EPS_SPD: 1e-6,            // speed-normalization guard
    EPS_INPUT2: 1e-10,        // squared move-input threshold (has-input test)
    EPS_SPEED_MARGIN: 1e-3,   // speed must exceed a target by this to count as "above" it

    // Ground-normal.y classifiers (a surface normal's up-component; 1 = flat floor, 0 = vertical wall).
    NY_CEILING: -0.4,         // normal.y ABOVE this is not a ceiling (must face downward to be one)
    NY_STEEP_MIN: 0.3,        // steep-but-not-wall floor-like face lower bound
    NY_GROUNDISH: 0.5,        // normal.y at/above this is walkable-ish ground (skip as a wall/step)
    NY_FLOORLIKE: 0.1,        // normal.y above this tilts up (floor-like), below is a vertical wall
    N_DEGENERATE: 0.5,        // reject a contact normal whose length is below this (bad EPA result)
    TOE_BAND_FRAC: 0.6,       // a too-steep floor-like contact only blocks as a slope-toe within this
                              // fraction of body height above the feet; higher is an overhang (headroom
                              // gate's job), not a wall to clip horizontal velocity against

    // Slide reversal (see _updateSlide's onSlope steering). Below this dot product between wish and
    // current slide direction, wish counts as a deliberate reversal (brake) rather than a carve.
    SLIDE_REVERSAL_DOT: -0.5,

    // MOVEMENT STATE — one flat enum, mutually exclusive, decided ONCE per tick by endStep (the only
    // place with a fresh ground probe) and read everywhere else (beginStep dispatches on it verbatim;
    // nothing re-derives it from other flags). See the "Movement state machine" comment above endStep
    // for the full design and why it replaced the old grounded+sliding+wishSlide flag soup.
    //   LADDER   = mounted on a ladder; _updateLadder owns velocity fully.
    //   AIRBORNE = no ground contact; gravity + air control own velocity.
    //   WALK     = grounded, standable surface, not sliding: ordinary input-driven movement.
    //   SLIP     = grounded, too-steep surface, not sliding: gravity-fed slip, weak air-control.
    //   SLIDE    = grounded, crouch-at-speed slide: _updateSlide's surface-tracking model owns velocity.
    MOVE_LADDER: 'ladder',
    MOVE_AIRBORNE: 'airborne',
    MOVE_WALK: 'walk',
    MOVE_SLIP: 'slip',
    MOVE_SLIDE: 'slide',
    MOVE_MANTLE: 'mantle',

    // Mantle: a grounded (flat-footed) mantle tap is only allowed up to this fraction of standHeight
    // (roughly chest height) — anything taller needs a running jump first (see _updateMantle).
    MANTLE_CHEST_HEIGHT_FRAC: 0.77,

    // Knockback gating (see _readGhostKnockback).
    KB_CLOSING_MIN: 0.5,      // object must close on the character faster than this (units/s) to knock back
    KB_MIN: 0.05,             // ignore a computed knockback smaller than this

    // Ground-suppress frame counts — ticks the ground clamp is held off after an event.
    GROUND_SUPPRESS_KB: 5,    // after taking knockback
    GROUND_SUPPRESS_JUMP: 8,  // after jumping

    // Sweep sub-stepping + wall interaction.
    SUBSTEP_FRAC: 0.5,        // sub-step length as a fraction of the smallest half-extent
    NEAR_CENTER_FRAC: 0.4,    // "hit near my center" band as a fraction of width
    PUSH_INTO_MIN: 0.5,       // dot(vel, toHit) above this = actively moving into a contact

    // Wall clip / step-up / depenetration.
    KEEP_BLOCKED: 0.01,       // keep-fraction below this = a non-yielding wall (fully blocks / triggers step-up)
    NY_NEAR_VERTICAL: 0.2,    // |normal.y| below this = a near-vertical face (steppable candidate)
    // Depenetration back-probe step, as a fraction of the character's own half-width — independent of
    // skin (skin is a contact/tunneling tolerance, not a "how fast should a buried body recover" rate;
    // coupling the two meant shrinking skin for tunneling reasons silently crippled buried-recovery speed).
    BACKPROBE_WIDTH_FRAC: 0.1,
    // Climbable-slope look-ahead sample points, as multiples of the character's DEPTH past the footprint
    // edge (so the probe reaches the same RELATIVE forward zone at any scale — a fixed-meter reach would
    // under-reach a big character and over-reach a small one, breaking steep-slope walk off default scale).
    CLIMB_PROBE_DEPTH_MULTS: [0, 0.5, 1.0, 1.67],

    // Render.
    VIEW_DISP_SNAP: 0.01,     // pending view-displacement above which eye interpolation snaps (crouch/step)
};

/**
 * Cast a ray from start to end in the physics world, kept private since nothing outside the
 * CharacterController subsystem needs it. Returns the nearest hit not among `ignoreObjects`, or
 * null.
 *
 * Adapts World.rayIntersect's own result shape ({body, point, normal, distance, fraction}, single
 * hit or null - see Queries.js) to the {object, point, normal, t} shape every caller in this
 * subsystem already expects, so only this one function needs to know the difference.
 *
 * `ignoreObjects` (body `.name` values) is resolved to actual body REFERENCES and passed to
 * World.rayIntersect's own `ignore` parameter, so those bodies are excluded from candidates BEFORE
 * the query finds its nearest hit - not filtered after the fact. This matters here specifically: a
 * ground probe casts from just above the character's own body, which is almost always the nearest
 * thing directly below the ray origin. Filtering after the query (checking the single reported
 * body's name against the ignore list, returning null on a match) would report "no hit" on every
 * such probe instead of finding the real ground behind/below the character's own shape - this was
 * a real, verified bug (a dropped controller found the ground once, then immediately lost it again
 * the very next tick with zero movement in between, because its own body was the "nearest hit" the
 * post-hoc filter then discarded).
 *
 * @method _raycast
 * @private
 * @static
 * @param {World} world
 * @param {Vector3} start
 * @param {Vector3} end
 * @param {String[]} [ignoreObjects] - body `.name` values to skip
 * @return {Object|null} { object, point:Vector3, normal:Vector3, t:Number } or null
 */
FPSCharacterController._raycast = function(world, start, end, ignoreObjects) {
    var ignore = null;
    if (ignoreObjects && ignoreObjects.length) {
        ignore = [];
        var bodies = world.bodies;
        for (var i = 0; i < bodies.length; i++) {
            if (bodies[i].name && ignoreObjects.indexOf(bodies[i].name) !== -1) { ignore.push(bodies[i]); }
        }
    }
    var hit = world.rayIntersect(start, end, ignore);
    if (!hit) { return null; }
    return { object: hit.body, point: hit.point, normal: hit.normal, t: hit.distance };
};


// ==== src/character/fps/Body.js ====
// Character body lifecycle: creates/recreates the kinematic box collider the character controller
// drives (see _buildBody), and the shared material-application helper used by both the character
// body and its ghost (see Ghost.js).
var proto = FPSCharacterController.prototype;

/**
 * Apply this controller's material/behavior defaults + explicit overrides to a freshly created body.
 * Shared by the character's own body (Body.js) and its ghost (Ghost.js).
 *
 * @method _applyMaterial
 * @private
 * @static
 * @param {RigidBody} body
 * @param {Object} [opts]
 * @param {Number} [opts.friction=3.0]
 * @param {Number} [opts.restitution=0.33]
 * @param {Number} [opts.linearDamping=0.1]
 * @param {Number} [opts.angularDamping=0.9]
 * @param {Vector3} [opts.gravity] - if set, overrides the body's gravity via setGravity.
 */
FPSCharacterController._applyMaterial = function(body, opts) {
    opts = opts || {};
    body.friction = opts.friction !== undefined ? opts.friction : 3.0;
    body.restitution = opts.restitution !== undefined ? opts.restitution : 0.33;
    body.linear_damping = opts.linearDamping !== undefined ? opts.linearDamping : 0.1;
    body.angular_damping = opts.angularDamping !== undefined ? opts.angularDamping : 0.9;
    if (opts.gravity) { body.setGravity(opts.gravity.x, opts.gravity.y, opts.gravity.z); }
};

/**
 * (Re)create the box body at a position, preserving look + velocity where possible.
 * @method _buildBody
 * @private
 * @param {Vector3} position
 */
proto._buildBody = function(position) {
    var carriedVel = null;
    if (this.body) {
        var v = this.body.linear_velocity;
        carriedVel = { x: v.x, y: v.y, z: v.z };
        this.world.removeRigidBody(this.body);
    }
    this._destroyGhost();

    var shape = new BoxShape(this.width / 2, this.height / 2, this.depth / 2);
    this.body = new RigidBody(shape, this.mass);
    FPSCharacterController._applyMaterial(this.body, {});
    this.body.position.copy(position);
    this.body.updateDerived();	// `object` is the lightweight cosmetic handle a consumer (renderer) can use to decide whether/how
	// to draw the collider. This controller never renders anything itself.
	this.object = { body: this.body, isVisible: this._visible };
	// Stamp the controller's color (red by default) on the body. The bench's renderer turns any body
	// with NO `_color` into blue, so an un-tinted body (a freshly rebuilt crouch box, or a run that
	// steps without the harness's per-tick tint) reads as blue instead of the character red. The
	// harness tint may override this to green/orange while sliding/slipping, so we only guarantee the
	// base here.
	this.body._color = this._color;

    // Never tip; resting/slopes/walls handled by the solver (gravity + friction).
    this.body.angular_factor.set(0, 0, 0);
    this.body.friction = this.friction;
    this.body.restitution = 0;
    this.body.linear_damping = 0;
    this.body.angular_damping = 0;

    // Tag our physics body so raycasts can ignore ourselves. Also ignore the ghost's name so the
    // kinematic body's own probing raycasts never treat its own trailing ghost as a wall.
    this.body.name = this._bodyName;
    this._ignoreSelf = [this._bodyName, this._bodyName + "_ghost"];
    // Mark this as a kinematic character body so OTHER characters' receive-push pass skips it
    // (character-vs-character is already handled by collide-and-slide treating each other as walls;
    // the body-push coupling is only meant for free dynamic objects).
    this.body.isKinematicCharacter = true;

    // Exclude the character from ALL solver contacts: a mask of 0 matches no group, regardless of
    // this body's own collision_groups (RigidBody's default groups/mask is "collide with everything" -
    // the inverse of the "collide with nothing until opted in" convention this exclusion pattern was
    // originally written against, so the exclusion here is an explicit zero mask, not a specific
    // unused group bit). The body still integrates and is still raycast-queryable. Collision is done
    // entirely via raycasts (ground clamp + collide-and-slide), so the solver can never fight the
    // control loop.
    this.body.collision_mask = 0;

    if (carriedVel) { this.body.linear_velocity.set(carriedVel.x, carriedVel.y, carriedVel.z); }

    this.world.addRigidBody(this.body);
    this._buildGhost(position, carriedVel);
};


// ==== src/character/fps/Ghost.js ====
// Ghost body lifecycle: a solver-participating dynamic body that trails the kinematic character for
// object-contact purposes. The character's own body is excluded from solver contacts (collision_mask
// 1); the ghost is its stand-in for object contact. Control is one-way: character position -> ghost
// target. The ghost's position never writes back to the character; only contact-derived knockback
// flows back (_syncGhost / _readGhostKnockback), as a velocity nudge. See _syncGhost.
var proto = FPSCharacterController.prototype;
var FPSC = FPSCharacterController.FPSC;

/**
 * GHOST: a solver-participating dynamic body that trails the kinematic character. The character's own
 * body is excluded from solver contacts (collision_mask 1); the ghost is its stand-in for object
 * contact. Control is one-way: character position -> ghost target. The ghost's position never writes
 * back to the character; only contact-derived knockback flows back (_syncGhost), as a velocity nudge.
 *
 * @method _buildGhost
 * @private
 * @param {Vector3} position - the character body's current position.
 * @param {Object} [carriedVel] - {x,y,z} velocity to seed the ghost with (carried over a rebuild).
 */
proto._buildGhost = function(position, carriedVel) {
    // Ghost bottom is inset above the character's feet so it doesn't overlap a surface the character is
    // standing on (that's _probeGround's job). Top is unchanged, so head-height contact is unaffected.
    var groundInset = this.height * FPSC.GHOST_GROUND_INSET;
    var ghostHeight = this.height - groundInset;
    var ghostPos = new Vector3(position.x, position.y + groundInset / 2, position.z);
    var ghostShape = new BoxShape(this.width / 2, ghostHeight / 2, this.depth / 2);
    this._ghost = new RigidBody(ghostShape, this.mass);
    FPSCharacterController._applyMaterial(this._ghost, {
        friction: this._ghostMaterial.friction,
        restitution: this._ghostMaterial.restitution,
        linearDamping: this._ghostMaterial.linearDamping,
        angularDamping: this._ghostMaterial.angularDamping,
        gravity: new Vector3(0, 0, 0)
    });
    this._ghost.position.copy(ghostPos);
    this._ghost.updateDerived();
    this._ghostObject = { body: this._ghost, isVisible: false };
    this._ghostCommandedVel = null;
    this._ghost.name = this._bodyName + "_ghost";
    this._ghost.angular_factor.set(0, 0, 0);
    this._ghost.isKinematicCharacter = true;
    // Distinguishes this body from a real character body for OTHER controllers' sweeps: their own
    // kinematic body is never a wall (it has no mass to yield against), but this ghost IS a real
    // solver-participating mass and should block/get pushed like any other object.
    this._ghost.isCharacterGhost = true;
    this._ghostGroundInset = groundInset;
    if (carriedVel) { this._ghost.linear_velocity.set(carriedVel.x, carriedVel.y, carriedVel.z); }
    this.world.addRigidBody(this._ghost);
};

/**
 * Remove and clear the ghost body, if any (called before every rebuild + on destroy()).
 * @method _destroyGhost
 * @private
 */
proto._destroyGhost = function() {
    if (this._ghostObject) {
        this.world.removeRigidBody(this._ghost);
        this._ghostObject = null;
        this._ghost = null;
    }
};

/**
 * Drive the ghost toward the character each tick and read back contact-driven knockback. Called once
 * per endStep, after the character's position is settled.
 *
 * @method _syncGhost
 * @private
 * @param {Number} dt
 */
proto._syncGhost = function(dt) {
    if (!this._ghost) { return; }
    var p = this.body.position;
    var cv = this.body.linear_velocity;
    var gp = this._ghost.position;
    // Target where the character WILL BE at the end of this tick (p + v*dt), not where it is right
    // now — closing "the gap as of the start of the tick" is already stale by the time it's applied,
    // since the character moves by v*dt over that same tick. Without this the ghost permanently lags
    // by ~one tick's worth of the character's own motion, growing with speed, even at constant
    // velocity (no acceleration needed to produce it).
    var targetX = p.x + cv.x * dt;
    var targetY = p.y + cv.y * dt + (this._ghostGroundInset || 0) / 2;
    var targetZ = p.z + cv.z * dt;
    var dx = targetX - gp.x, dy = targetY - gp.y, dz = targetZ - gp.z;
    var gap = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var gv = this._ghost.linear_velocity;

    // A gap this large is a rebuild/respawn/teleport: beam the ghost to the character instead of chasing.
    var teleportDist = Math.max(this.width, this.height) * 2;
    if (gap > teleportDist) {
        this._ghost.position.set(p.x, p.y + (this._ghostGroundInset || 0) / 2, p.z);
        gv.set(0, 0, 0);
        this._ghostCommandedVel = { x: 0, y: 0, z: 0 };
        return;
    }

    // Knockback signal = (ghost's actual velocity) - (velocity the drive commanded last tick). This
    // runs during resim too: an authority that never resims applies knockback in its own live step, so
    // skipping it here while resimulating would reconcile the character's velocity to a value that
    // permanently disagrees with authority by the knockback amount. It only needs to be deterministic
    // run-to-run (it is — the read is a pure function of the current contact state).
    this._readGhostKnockback();

    // Drive the ghost directly at the velocity that closes the (predicted) gap this tick. No cap:
    // any cap below the gap-closing speed just reintroduces a residual gap on fast motion — the
    // predicted-target math above already keeps this bounded and small under normal conditions.
    gv.x = dx / dt; gv.y = dy / dt; gv.z = dz / dt;

    // Clip the ghost's horizontal velocity through the same swept collide-and-slide the character uses.
    var clip = this._sweptCollideAndSlide({
        position: new Vector3(gp.x, gp.y, gp.z),
        width: this.width, depth: this.depth, height: this.height - (this._ghostGroundInset || 0),
        skin: this._skin, mass: this.mass, stepHeight: 0,
        selfBody: this._ghost, otherSelfBody: this.body,
        climbSteepSlopes: false,
        vx: gv.x, vz: gv.z, dt: dt,
    });
    gv.x = clip.x; gv.z = clip.z;
    if (clip.depenX !== 0 || clip.depenZ !== 0) {
        this._ghost.position.set(gp.x + clip.depenX, gp.y, gp.z + clip.depenZ);
    }

    this._ghostCommandedVel = { x: gv.x, y: gv.y, z: gv.z }; // baseline for next tick's (actual - commanded) knockback read
};

/**
 * Knockback speed = mass ratio (objectMass/(objectMass+playerMass)) x the object's closing speed
 * onto the character, gated to only apply when the object is moving into the character above a small
 * momentum floor. Horizontal only; never moves position, only velocity.
 *
 * @method _readGhostKnockback
 * @private
 */
proto._readGhostKnockback = function() {
    if (!this._receivePush) { return; }
    var world = this.world;
    if (!world || !world.narrowphase) { return; }
    var ghostBody = this._ghost;
    var pb = this.body.linear_velocity;
    // var mP = this.mass; // only fed the disabled mass-ratio scale below

    var manifolds = world.narrowphase.manifolds.values();
    for (var manifold = manifolds.next(); !manifold.done; manifold = manifolds.next()) {
        var m = manifold.value;
        var other =
            m.bodyA === ghostBody ? m.bodyB :
            m.bodyB === ghostBody ? m.bodyA : null;
        // A player is a wall, not a pushable object — no knockback from another player's ghost.
        if (other && other.bodyType === RigidBody.DYNAMIC && other._mass > 0 && !other.isKinematicCharacter) {
            // var mB = other._mass; // only fed the disabled mass-ratio scale below
            var ov = other.linear_velocity;
            var nx = this._ghost.position.x - other.position.x;
            var nz = this._ghost.position.z - other.position.z;
            var nlen = Math.sqrt(nx * nx + nz * nz);
            if (nlen > FPSC.EPS_LEN) { nx /= nlen; nz /= nlen; } else { nx = 0; nz = 0; }
            // n points box->character. The knockback should trigger on how fast the BOX is coming at you
            // (ov.n), NOT the relative closing speed (ov-pb).n. Using the relative speed folds in YOUR
            // OWN approach velocity (-pb.n > 0 when you walk into the box), so pushing a box knocked you
            // backward every tick — you push, it shoves you back, you re-approach: a limit cycle that
            // renders as the box micro-oscillating toward/away from you at close range. Gating on the
            // box's own inbound speed means a box only knocks you when IT carries momentum at you
            // (someone else shoved it, an explosion) — your own push no longer bounces back. Opt-out via
            // receiveSelfPush to restore the old relative-speed behavior.
            var closing = this._receiveSelfPush ?
                (ov.x - pb.x) * nx + (ov.z - pb.z) * nz :   // legacy: relative closing (self-push included)
                ov.x * nx + ov.z * nz;                      // box's own inbound speed only
            if (closing > FPSC.KB_CLOSING_MIN) {
                // `closing` is the object's velocity AFTER the solver already resolved its collision
                // with the ghost — the mass exchange is already baked in. Scaling it again by the
                // mass ratio below double-counted the mass penalty, cutting knockback to a fraction
                // of what a free body of the character's mass actually keeps (~0.46 vs ~4 in K1).
                // var massRatio = mB / (mB + mP);
                // var kbv = massRatio * closing;
                var kbv = closing;
                if (kbv > this._receiveMaxSpeed) { kbv = this._receiveMaxSpeed; }
                kbv *= this._receiveKnockbackFraction;
                // Cap the RESULTING along-n speed, not just this tick's increment: clamping only kb
                // bounds each tick's contribution but not the running total, so sustained contact (a
                // heavy object pressed against the character for many ticks) adds another kb-worth of speed
                // every tick and blows straight past receiveMaxSpeed. Clamp what the character's velocity
                // ALONG n would become after this tick's push to receiveMaxSpeed instead — a fresh hit
                // (little/no existing along-n speed) still gets up to the full kb, but once already at
                // the cap from prior contact, further ticks add nothing more.
                var alongN = pb.x * nx + pb.z * nz;
                var room = this._receiveMaxSpeed - alongN;
                if (room > 0) { kbv = Math.min(kbv, room); } else { kbv = 0; }
                if (kbv > FPSC.KB_MIN) {
                    pb.x += nx * kbv;
                    pb.z += nz * kbv;
                    this.grounded = false;
                    // This runs mid-tick, inside beginStep's ghost sync — the movement-state dispatch
                    // for THIS tick already ran (it's earlier in beginStep), so this can't retroactively
                    // change what velocity model owned this tick's motion. It CAN and must fix what the
                    // NEXT tick sees: without this, next tick's dispatch would read the stale grounded
                    // sub-state (WALK) and immediately re-clamp the character back onto the ground via
                    // WALK's kinematic model, killing the knockback before it ever got airborne.
                    this._moveState = FPSC.MOVE_AIRBORNE;
                    if (this._groundSuppress < FPSC.GROUND_SUPPRESS_KB) { this._groundSuppress = FPSC.GROUND_SUPPRESS_KB; }
                }
            }
            break;
        }
    }
};


// ==== src/character/fps/Collision.js ====
// Kinematic wall/step collision: the character is excluded from the solver's own contact resolution
// (collision_mask 1), so this file is what actually stops the character at walls, lets it climb steps,
// and depenetrates it out of geometry it sank into. Shared by both the character body and its ghost
// via _sweptCollideAndSlide.
var proto = FPSCharacterController.prototype;
var FPSC = FPSCharacterController.FPSC;

/**
 * Kinematic collide-and-slide. The character is excluded from the solver, so we stop
 * ourselves at walls and slide along them here. For the current horizontal velocity
 * we cast a fan of rays (across the footprint width, at a few heights) in the move
 * direction; if a vertical wall is within the box's reach this step we remove the
 * into-wall velocity component and re-test, so corners stop on both walls. Floors and
 * ramps (normal.y >= 0.5) are ignored — those are handled by the ground clamp.
 *
 * @method _collideAndSlide
 * @private
 * @param {Number} vx - incoming horizontal velocity, x.
 * @param {Number} vz - incoming horizontal velocity, z.
 * @param {Number} dt
 * @return {Object} result
 * @return {Number} result.x - clipped horizontal velocity, x.
 * @return {Number} result.z - clipped horizontal velocity, z.
 */
proto._collideAndSlide = function(vx, vz, dt) {
    var res = this._sweptCollideAndSlide({
        position: this.body.position,
        width: this.width, depth: this.depth, height: this.height,
        skin: this._skin, mass: this.mass, stepHeight: this.stepHeight,
        selfBody: this.body, otherSelfBody: this._ghost || null,
        // A SLIDE is exempt from the too-steep-can't-move-up block (the slide IS the climb — momentum,
        // not input, is what carries it up). This must hold while AIRBORNE-sliding too: an airborne
        // slide sweeping into a steep face otherwise wall-clips to zero speed mid-air, which kills the
        // slide before it ever lands on the surface. _climbableSlopeAhead inside still tells real
        // slopes from vertical walls, so walls keep stopping a slide. this._moveState is already
        // MOVE_SLIDE on the true first-contact tick too — endStep decides movement state (including
        // slide entry) BEFORE this function runs later in the same beginStep, so there's no
        // "one tick behind" gap here to patch around.
        climbSteepSlopes: this.climbSteepSlopes || this._moveState === FPSC.MOVE_SLIDE,
        vx: vx, vz: vz, dt: dt,
    });
    // Depenetration is a horizontal position correction out of a wall, separate from the velocity move.
    if (res.depenX !== 0 || res.depenZ !== 0) {
        var bp = this.body.position;
        this.body.position.set(bp.x + res.depenX, bp.y, bp.z + res.depenZ);
        this.body.updateDerived();
    }
    return { x: res.x, z: res.z };
};

/**
 * Sweeps an inset box along a horizontal velocity and clips it against blocking contacts,
 * sub-stepped so long sweeps can't return a wrong-axis normal. Shared by the character body
 * and its ghost so both get identical wall/mass-yield behavior from one implementation.
 *
 * @method _sweptCollideAndSlide
 * @private
 * @param {Object} opts
 * @param {Vector3} opts.position - Sweep origin (box center).
 * @param {Number} opts.width - Box width (x), pre-inset.
 * @param {Number} opts.depth - Box depth (z), pre-inset.
 * @param {Number} opts.height - Box height (y), pre-inset.
 * @param {Number} opts.skin - Contact/sweep tolerance subtracted from each half-extent.
 * @param {Number} opts.mass - Sweeping body's mass, used for the push mass-yield ratio.
 * @param {Number} [opts.stepHeight=0] - Step-up height; 0 disables step-up entirely.
 * @param {RigidBody} opts.selfBody - Body to exclude from its own sweep hits.
 * @param {RigidBody} [opts.otherSelfBody] - A second body to exclude (e.g. the character
 *   excludes its ghost, and vice versa).
 * @param {Boolean} [opts.climbSteepSlopes=false] - Exempt too-steep floor-like faces that have a
 *   climbable slope ahead from the wall-block rule.
 * @param {Number} opts.vx - Incoming horizontal velocity, x.
 * @param {Number} opts.vz - Incoming horizontal velocity, z.
 * @param {Number} opts.dt - Tick duration in seconds.
 * @return {Object} result
 * @return {Number} result.x - Clipped horizontal velocity, x.
 * @return {Number} result.z - Clipped horizontal velocity, z.
 * @return {Number} result.depenX - Position correction out of a penetrated wall, x (0 if none).
 * @return {Number} result.depenZ - Position correction out of a penetrated wall, z (0 if none).
 */
proto._sweptCollideAndSlide = function(opts) {
    var vx = opts.vx, vz = opts.vz;
    var position = opts.position, width = opts.width, depth = opts.depth, height = opts.height,
        skin = opts.skin, mass = opts.mass, dt = opts.dt, selfBody = opts.selfBody, otherSelfBody = opts.otherSelfBody;
    var stepHeight = opts.stepHeight || 0;
    var climbSteepSlopes = !!opts.climbSteepSlopes;
    var world = this.world;
    if (!world || typeof world.shapeIntersect !== "function") { return { x: vx, z: vz, depenX: 0, depenZ: 0 }; }

    // Original move heading, before any clipping this tick — used by the climb-slope-ahead probe
    // so a mid-loop velocity clip doesn't collapse the probe direction.
    var moveLen0 = Math.sqrt(vx * vx + vz * vz);
    var mdx0 = moveLen0 > FPSC.EPS_DIR ? vx / moveLen0 : 0;
    var mdz0 = moveLen0 > FPSC.EPS_DIR ? vz / moveLen0 : 0;

    // Swept-box collide-and-slide: sweep an inset box along the move each tick and clip velocity
    // against the real contact plane.
    var p = position;
    var halfW = width / 2 - skin;
    var halfD = depth / 2 - skin;
    // Lift the swept box a small amount off the feet so it doesn't graze the floor slab's top
    // edge (which returns a degenerate near-vertical normal and fakes a wall), while staying low
    // enough to still catch a steep ramp's toe.
    var lift = skin * 2;
    var halfH = Math.max(0.05, height / 2 - lift / 2);
    var yOffset = lift / 2;
    // Cache the swept probe box per caller (different callers may have different dimensions).
    var cacheKey = selfBody === this.body ? "_sweepBox" : "_altSweepBox";
    if (!this[cacheKey] || this[cacheKey + "W"] !== halfW || this[cacheKey + "H"] !== halfH || this[cacheKey + "D"] !== halfD) {
        this[cacheKey] = new BoxShape(halfW, halfH, halfD);
        this[cacheKey + "W"] = halfW; this[cacheKey + "H"] = halfH; this[cacheKey + "D"] = halfD;
    }
    var boxShape = this[cacheKey];
    var minStandableNy = this._minStandableNormalY;

    // Sub-step so each swept chunk stays well under the smallest half-extent (a long sweep can
    // return a wrong-axis normal from EPA).
    var chunkLen = Math.min(halfW, halfD) * FPSC.SUBSTEP_FRAC;
    var full = Math.sqrt(vx * vx + vz * vz) * dt;
    var nSub = Math.max(1, Math.ceil(full / Math.max(chunkLen, FPSC.EPS_LEN)));
    var sdt = dt / nSub;

    // shapeIntersect's contact normal points FROM the HIT SURFACE TOWARD THE SWEEPING MOVER (the
    // reversed travel direction on a miss-then-touch sweep - see Queries._advance's own
    // lastGoodNx/_finishHit(-ux,-uy,-uz)), not from the mover toward the object. Everything below
    // (findBlock's `into` test, the vertical-wall clip direction, the depenetration back-probe) is
    // written assuming the OPPOSITE convention ("points into the wall") — negating here, once, at
    // the single place the raw query result enters this file, keeps that downstream math correct
    // without hunting down every sign use individually. This was a REAL, confirmed bug: with the
    // un-negated normal, `into = vx*n.x + vz*n.z` computed NEGATIVE while genuinely moving into a
    // wall (an approaching mover's velocity and the surface-outward normal point opposite ways by
    // definition), so `into <= 0` rejected every real block outright — two characters walked
    // straight through each other for 100+ units with the block silently never firing, at ANY
    // gap, not just the ghost-shadowing case fixed above. "Heading into this face" is v.n > 0
    // (post-negation); pushing out of penetration moves along -n (also post-negation).
    //
    // World.shapeIntersect reports only the SINGLE nearest body, unlike the source's multi-hit
    // query. A raw kinematic character body is never itself a wall (no mass to yield against — its
    // ghost is the real solver stand-in for it, see Body.js), so it must be excluded from candidates
    // at the QUERY level via `ignore`, not filtered after the fact: another controller's raw body
    // sits at nearly the same place as its own ghost, so it is almost always the geometrically
    // NEAREST hit and would permanently shadow the ghost behind it if only checked post-hoc - this
    // was a real, confirmed bug (two characters walked straight through each other for 100+ units;
    // the sweep found the other's raw kinematic body every time, discarded it as "not a wall," and
    // never found the ghost sitting right behind it, since World.shapeIntersect only ever reports
    // the SINGLE nearest hit). Every other kinematic-character body in the world (this body/ghost
    // are already excluded via selfBody/otherSelfBody) is ignored at the query itself, so the
    // nearest REAL hit - a wall, a pushable object, or another character's GHOST - is found
    // directly.
    //
    // Nearest valid blocking contact for a sweep, or null. { n, pen, keep }.
    var self_ = this;
    var worldBodies = world.bodies;
    var queryIgnore = otherSelfBody ? [selfBody, otherSelfBody] : [selfBody];
    for (var ki = 0; ki < worldBodies.length; ki++) {
        var kb = worldBodies[ki];
        if (kb.isKinematicCharacter && !kb.isCharacterGhost && kb !== selfBody && kb !== otherSelfBody) {
            queryIgnore.push(kb);
        }
    }
    function findBlock(start, end) {
        var localIgnore = queryIgnore.slice();
        for (var tries = 0; tries < 8; tries++) {
            var h = world.shapeIntersect(boxShape, start, end, null, localIgnore);
            if (!h) { return null; }
            var hn = h.normal;
            if (!hn || !isFinite(hn.x) || !isFinite(hn.y) || !isFinite(hn.z)) { return null; }
            var nlen = Math.sqrt(hn.x * hn.x + hn.y * hn.y + hn.z * hn.z);
            if (nlen < FPSC.N_DEGENERATE) { return null; }
            // Negate: see this function's own header comment for why the raw query result is flipped
            // here, once, before any of the "points into the wall" math below reads it.
            var n = { x: -hn.x, y: -hn.y, z: -hn.z };
            if (Math.abs(n.y) >= minStandableNy) { localIgnore.push(h.body); continue; }
            // Vertical wall: normal horizontal, points character->object; heading in is v.n > 0.
            // Too-steep floor-like face (0.1 < n.y < cutoff): normal tilts up-and-back, so heading
            // in is v.(n.x,n.z) < 0 — sign flipped below.
            var floorLike = n.y > FPSC.NY_FLOORLIKE;
            // A floor-like too-steep face is only a legitimate "slope ahead" block near the feet
            // (walking into a ramp's toe). The same face type contacted up near head height is an
            // OVERHANG (ramp underside above a wedged character), not a slope to stop forward
            // progress on — treating it as a wall-slide clip can zero velocity in every direction,
            // including retreat, trapping the character. Overhead clearance is the headroom gate's
            // job; skip it here so a sideways/backward escape isn't blocked by the same contact.
            if (floorLike && h.point && (h.point.y - (p.y - height / 2)) > height * FPSC.TOE_BAND_FRAC) { localIgnore.push(h.body); continue; }
            if (climbSteepSlopes && self_._climbableSlopeAhead(start, mdx0, mdz0)) { localIgnore.push(h.body); continue; }
            var overlapped = h.fraction === 0 && h.distance === 0;
            // vyDet included for the vertical-wall case only (detection): falling/rising past a
            // near-vertical face counts as heading into it. Floor-like faces keep the horizontal-only
            // test — their block is "slope ahead", owned by the clamp/steep path, not this.
            var into = floorLike ? -(vx * n.x + vz * n.z) : (vx * n.x + vz * n.z + vyDet * n.y);
            if (into <= 0 && !overlapped) { return null; }
            var keep = 0;
            var b = h.body;
            // Platforms never yield like a pushable object — they're scripted geometry. Another
            // player's ghost is a full body-block too — a player is a wall, not a pushable box.
            if (b && !b.isPlatform && !b.isCharacterGhost && b.bodyType === RigidBody.DYNAMIC && b._mass > 0 &&
                b._mass <= self_._pushMassLimit) {
                keep = mass / (mass + b._mass);
            }
            return { n: n, keep: keep, overlapped: overlapped };
        }
        return null;
    }

    // Contact test with no directional gate (unlike findBlock). Used by the recovery back-probe,
    // since after velocity is clipped the body is no longer "moving into" the wall.
    function contactAt(x, y, z) {
        var pt = new Vector3(x, y, z);
        var localIgnore = queryIgnore.slice();
        for (var tries = 0; tries < 8; tries++) {
            var h = world.shapeIntersect(boxShape, pt, pt, null, localIgnore);
            if (!h) { return false; }
            var n = h.normal;
            if (!n || !isFinite(n.x) || !isFinite(n.y) || !isFinite(n.z)) { return false; }
            if (Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z) < FPSC.N_DEGENERATE) { return false; }
            if (Math.abs(n.y) >= minStandableNy) { localIgnore.push(h.body); continue; } // walkable ground/ramp — not a wall
            return true;
        }
        return false;
    }

    var sy = p.y + yOffset;

    // CLIP velocity against walls the move would hit this tick, and DEPENETRATE out of any wall
    // sunk into (push along -n by overlap+skin so it rests just clear — the swept cast is
    // penetration-based, so without this a fast move ends up inside and sticks). Velocity-only for
    // the move; position correction only for depenetration. Sub-stepped for reliable normals.
    var cx = p.x, cz = p.z;
    var depenX = 0, depenZ = 0;
    // Vertical component of the move, for DETECTION ONLY — so the swept box sees a wall it's about to
    // bury into by falling/rising past it (e.g. dropping straight down a near-vertical ramp face).
    // vy never clips velocity or writes position here; the ground clamp still owns y. It only lets
    // findBlock's `into` test fire so the existing horizontal back-probe can push the box out.
    var vyDet = selfBody ? selfBody.linear_velocity.y : 0;
    for (var s = 0; s < nSub; s++) {
        for (var iter = 0; iter < 4; iter++) {
            var speed = Math.sqrt(vx * vx + vz * vz + vyDet * vyDet);
            if (speed < FPSC.EPS_DIR) { break; }
            var start = new Vector3(cx, sy, cz);
            var end = new Vector3(cx + vx * sdt, sy + vyDet * sdt, cz + vz * sdt);
            var blk = findBlock(start, end);
            if (!blk) { break; }
            // Step-up: before walling a near-vertical, non-yielding face, test if it's clear when
            // swept raised by stepHeight — if so it's steppable, let the move through.
            if (blk.keep < FPSC.KEEP_BLOCKED && Math.abs(blk.n.y) < FPSC.NY_NEAR_VERTICAL && stepHeight > 0) {
                var upStart = new Vector3(cx, sy + stepHeight, cz);
                var upEnd = new Vector3(cx + vx * sdt, sy + stepHeight, cz + vz * sdt);
                if (!findBlock(upStart, upEnd)) { break; }
            }
            var n = blk.n, keep = blk.keep;
            // Clip the into-face velocity using the horizontal blocking direction (never inject
            // vertical; the ground clamp owns y).
            var floorLike = n.y > FPSC.NY_FLOORLIKE;
            var bx = floorLike ? -n.x : n.x, bz = floorLike ? -n.z : n.z;
            var blen = Math.sqrt(bx * bx + bz * bz);
            if (blen < FPSC.EPS_SPD) { break; }
            bx /= blen; bz /= blen;
            var dot = vx * bx + vz * bz;
            if (dot > 0) {
                vx -= dot * bx * (1 - keep);
                vz -= dot * bz * (1 - keep);
            }
            // Depenetration is recovery-only: detect BURIED vs GRAZING with a back-probe (sweep one
            // fixed small step along -n; if still in contact there, nudge out by that step), rather
            // than trusting a reported penetration depth directly (this query never reports one -
            // see findBlock's own comment; contactAt below is the real, load-bearing check, not an
            // early-out guard). Vertical walls only; a floor-like too-steep toe is owned by the
            // clamp / steep-slope path.
            if (!floorLike && keep < FPSC.KEEP_BLOCKED && (blk.overlapped || dot > 0)) {
                var step = Math.min(width, depth) * FPSC.BACKPROBE_WIDTH_FRAC;
                if (contactAt(cx - n.x * step, sy, cz - n.z * step)) {
                    depenX -= n.x * step; depenZ -= n.z * step;
                    cx -= n.x * step; cz -= n.z * step;
                }
            }
            if (keep > FPSC.KEEP_BLOCKED) { break; }
        }
        cx += vx * sdt;
        cz += vz * sdt;
    }
    return { x: vx, z: vz, depenX: depenX, depenZ: depenZ };
};


// ==== src/character/fps/Probes.js ====
// Ground/ceiling/ladder raycast probes: the hand-written spatial queries beginStep/endStep read each
// tick to decide grounding, standable-slope classification, headroom, and ladder mounting. No probe
// here writes any sim state itself — each one just reports what's in the world.
var proto = FPSCharacterController.prototype;
var FPSC = FPSCharacterController.FPSC;
var raycast = FPSCharacterController._raycast;

/**
 * Multi-point ground probe (center + four edge midpoints). Returns ALL floor-like hits, highest
 * first — NOT collapsed to a single "best" here, because the caller needs to fall back to a
 * lower (but valid) hit when the highest one is rejected as too tall to step onto (e.g. one edge
 * ray grazing a box pushed against the footprint, while the other four rays are still squarely
 * over real floor). Collapsing to one hit here would throw the floor away before the caller ever
 * gets a chance to prefer it.
 * @method _probeGroundCandidates
 * @private
 * @param {Number} maxSnap - max downward reach (below the feet) to probe, before scale/skin margins.
 * @return {Object[]} floor-like raycast hits, sorted highest point.y first.
 */
proto._probeGroundCandidates = function(maxSnap) {
    var half = this.height / 2;
    var p = this.body.position;
    // Cast from the higher of this tick's start position and the current position, so a fast
    // descent that penetrated the floor this tick doesn't miss it.
    var topY = Math.max(this._prevY !== undefined ? this._prevY : p.y, p.y) + this._skin;
    var bottomY = p.y - (half + maxSnap + this._skin);
    var ix = this.width / 2 - this._skin;
    var iz = this.depth / 2 - this._skin;
    var offsets = [[0, 0], [ix, 0], [-ix, 0], [0, iz], [0, -iz]];

    var candidates = [];
    for (var i = 0; i < offsets.length; i++) {
        var ox = offsets[i][0];
        var oz = offsets[i][1];
        var start = new Vector3(p.x + ox, topY, p.z + oz);
        var end = new Vector3(p.x + ox, bottomY, p.z + oz);
        var hit = raycast(this.world, start, end, this._ignoreSelf);
        if (!hit || hit.normal.y < FPSC.NY_FLOORLIKE) { continue; }
        // Exclude a pushable object as ground only when walking INTO its side (pushing it), not
        // when it's roughly under our own center (standing on it).
        var gBody = hit.object;
        var gm = gBody && gBody._mass;
        var isPushable = gBody && gBody.bodyType === RigidBody.DYNAMIC && gm > 0 && gm <= this._pushMassLimit;
        if (isPushable) {
            var gv = this.body.linear_velocity;
            var toHitX = hit.point.x - p.x, toHitZ = hit.point.z - p.z;
            var towardLen = Math.sqrt(toHitX * toHitX + toHitZ * toHitZ);
            var movingIntoIt = towardLen > FPSC.EPS_LEN &&
                (gv.x * toHitX + gv.z * toHitZ) / towardLen > FPSC.PUSH_INTO_MIN;
            var nearCenter = towardLen < this.width * FPSC.NEAR_CENTER_FRAC;
            if (movingIntoIt && !nearCenter) { continue; }
        }
        candidates.push(hit);
    }
    candidates.sort(function(a, b) { return b.point.y - a.point.y; });
    return candidates;
};

/**
 * Multi-ray UP probe across the footprint. Returns the LOWEST ceiling (down-facing
 * surface) within `reachAboveFeet` of the feet, or null. Mirror of _probeGround; covers
 * sloped overhead geometry (e.g. a ramp underside) that forward rays can't see.
 *
 * @method _probeCeiling
 * @private
 * @param {Number} reachAboveFeet - how far above the feet to scan.
 * @return {Object|null} the lowest down-facing hit within reach, or null.
 */
proto._probeCeiling = function(reachAboveFeet) {
    var p = this.body.position;
    var feetY = p.y - this.height / 2;
    var startY = feetY + this._skin;
    var endY = feetY + reachAboveFeet + this._skin;
    var ix = this.width / 2 - this._skin;
    var iz = this.depth / 2 - this._skin;
    var offsets = [[0, 0], [ix, 0], [-ix, 0], [0, iz], [0, -iz]];
    var best = null;
    for (var i = 0; i < offsets.length; i++) {
        var ox = offsets[i][0];
        var oz = offsets[i][1];
        var hit = this._raycastSkipPlatforms(
            new Vector3(p.x + ox, startY, p.z + oz),
            new Vector3(p.x + ox, endY, p.z + oz)
        );
        if (!hit || hit.normal.y > FPSC.NY_CEILING) { continue; } // not a ceiling (must face downward)
        if (!best || hit.point.y < best.point.y) { best = hit; }
    }
    return best;
};

/**
 * Same contract as the private _raycast helper (excludes this body + its ghost, returns the
 * nearest remaining hit), but ALSO skips a hit body tagged isPlatform. A scripted moving platform is
 * deliberately excluded from the solver's own contact resolution (see _baseVelocity's constructor
 * comment / platform()'s collision_mask) so a rider is carried via scripted base-velocity, never a
 * real physical shove — but a raw raycast doesn't consult collision_mask at all, so without this a
 * fast-rising platform that catches back up to a character mid-jump gets misread as a solid ceiling
 * overhead by _ceilingSlide, capping the jump's vertical velocity and killing it a few ticks after
 * liftoff, even though no real contact manifold ever forms between the two bodies (the phantom
 * ceiling is a pure raycast/collision_mask mismatch, not a real collision). Used ONLY by
 * _probeCeiling — _probeGround intentionally still sees platforms (that's how riding one works at
 * all), and ordinary walls/ramps/props aren't tagged isPlatform so they're unaffected.
 *
 * Self+ghost exclusion goes through World.rayIntersect's own `ignore` parameter (bodies excluded
 * from candidates BEFORE the nearest-hit search runs), not post-hoc name filtering on the single
 * reported hit — a probe cast from the character's own body would otherwise almost always find
 * itself as the "nearest hit" and get discarded, reporting no ceiling even when a real one is
 * there. Platform exclusion still can't do the same (World.rayIntersect reports only the single
 * nearest body, so a platform hit is reported as "no ceiling" rather than passed over to a real
 * ceiling behind it) — narrower, left as a known gap.
 *
 * @method _raycastSkipPlatforms
 * @private
 * @param {Vector3} start
 * @param {Vector3} end
 * @return {Object|null} the nearest non-self, non-platform hit, or null.
 */
proto._raycastSkipPlatforms = function(start, end) {
    var ignore = this._ghost ? [this.body, this._ghost] : this.body;
    var hit = this.world.rayIntersect(start, end, ignore);
    if (!hit) { return null; }
    var b = hit.body;
    if (b && b.isPlatform) { return null; }
    return { object: b, point: hit.point, normal: hit.normal, t: hit.distance };
};

/**
 * Is there room to stand up? (No ceiling within standHeight of the feet.)
 * @method _canStand
 * @private
 * @return {Boolean}
 */
proto._canStand = function() {
    var feetY = this.body.position.y - this.height / 2;
    var ceil = this._probeCeiling(this.standHeight);
    return !ceil || ceil.point.y - feetY >= this.standHeight - this._skin;
};

/**
 * Single ray probe for a ladder ahead, along `dir` (horizontal, need not be unit length). Placed
 * halfway between the feet and stepHeight above them rather than the body center. Returns the raw
 * hit `{object, point, normal, t}` with the normal flipped to point OUT of the face (toward the
 * caller), or null.
 *
 * @method _findLadderAhead
 * @private
 * @param {Vector3} dir
 * @return {Object|null}
 */
proto._findLadderAhead = function(dir) {
    var p = this.body.position;
    var dlen = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
    if (dlen < FPSC.EPS_LEN) { return null; }
    var dx = dir.x / dlen, dz = dir.z / dlen;
    var reach = this.width / 2 + this.ladderMountReach;
    var feetY = p.y - this.height / 2;
    var probeY = feetY + this.stepHeight / 2;
    var hit = raycast(this.world,
        new Vector3(p.x, probeY, p.z),
        new Vector3(p.x + dx * reach, probeY, p.z + dz * reach),
        this._ignoreSelf);
    if (!hit || !hit.object || !hit.object.isLadder) { return null; }
    return hit;
};

/**
 * Is there a too-steep-but-climbable slope surface rising just ahead of the move? Used only when
 * climbSteepSlopes is on. Casts down-rays a short distance ahead and looks for an upward-tilted,
 * too-steep-to-stand hit that is still a real slope (not flat floor, not a vertical wall).
 * @method _climbableSlopeAhead
 * @private
 * @param {Vector3} start
 * @param {Number} dx - unit-ish horizontal direction x
 * @param {Number} dz - unit-ish horizontal direction z
 * @return {Boolean}
 */
proto._climbableSlopeAhead = function(start, dx, dz) {
    if (dx === 0 && dz === 0) { return false; }
    var feetY = this.body.position.y - this.height / 2;
    var base = this.depth / 2 + this._skin; // footprint edge (both scale with the character)
    for (var mi = 0; mi < FPSC.CLIMB_PROBE_DEPTH_MULTS.length; mi++) {
        var m = FPSC.CLIMB_PROBE_DEPTH_MULTS[mi];
        var ahead = base + m * this.depth; // reach past the footprint in units of depth (scale-invariant)
        var ax = start.x + dx * ahead;
        var az = start.z + dz * ahead;
        var hit = raycast(this.world,
            new Vector3(ax, feetY + this.stepHeight + this._skin, az),
            new Vector3(ax, feetY - this.stepHeight, az),
            this._ignoreSelf);
        if (hit && hit.normal.y > FPSC.NY_STEEP_MIN && hit.normal.y < this._minStandableNormalY) { return true; }
    }
    return false;
};

/**
 * Lowest ceiling clearance over the footprint centered at (cx,cz). Infinity if nothing overhead.
 * @method _ceilingClearanceAt
 * @private
 * @param {Number} cx
 * @param {Number} cz
 * @param {Number} feetY
 * @return {Number} clearance in units above feetY, or Infinity.
 */
proto._ceilingClearanceAt = function(cx, cz, feetY) {
    // Start above step-up height so a steppable obstacle (stair/low box) doesn't register as a
    // low ceiling; anything below feet+stepHeight is the ground clamp's job, not the gate's.
    var startY = feetY + this.stepHeight + this._skin;
    var endY = feetY + this.standHeight + this._skin;
    var ix = this.width / 2 - this._skin;
    var iz = this.depth / 2 - this._skin;
    var offsets = [[0, 0], [ix, 0], [-ix, 0], [0, iz], [0, -iz]];
    var lowest = Infinity;
    for (var i = 0; i < offsets.length; i++) {
        var ox = offsets[i][0];
        var oz = offsets[i][1];
        var hit = raycast(this.world,
            new Vector3(cx + ox, startY, cz + oz),
            new Vector3(cx + ox, endY, cz + oz),
            this._ignoreSelf);
        if (!hit || hit.normal.y > FPSC.NY_CEILING) { continue; } // not a ceiling (must face downward)
        // A dynamic/pushable object is never a "ceiling" — it's something the swept mover + push handle,
        // not the headroom gate. Without this, an object being actively shoved forward can wobble a few
        // degrees off-axis from contact torque, and its top face intermittently pokes above the
        // stepHeight cutoff below on some ticks but not others, flickering the character's forward
        // velocity to zero and back as the box jitters. Only STATIC geometry (mass===Infinity) counts
        // as an overhang.
        if (hit.object && hit.object.bodyType === RigidBody.DYNAMIC) { continue; }
        var clr = hit.point.y - feetY;
        // A "ceiling" clearance at or below step height is NOT an overhang — it's a low obstacle at
        // shin/waist level that the swept mover + push handle, not the headroom gate. Without this, a
        // low stepHeight drops the ray start (feetY+stepHeight) INTO a waist-high object ahead, and the
        // ray reports a bogus ~stepHeight-clearance "ceiling", so the gate walls the character in open
        // space in front of a pushable box (worse the lower stepHeight is). Only count genuine overhangs
        // — clearance meaningfully above the step line — as ceilings.
        if (clr <= this.stepHeight + this._skin) { continue; }
        if (clr < lowest) { lowest = clr; }
    }
    return lowest;
};

/**
 * The "too steep to stand on" rule — a floor whose normal tilts below the standable limit gives no
 * footing (MOVE_SLIP). climbSteepSlopes opts out.
 * @method _isSlipSurface
 * @private
 * @param {Object} normal - a surface normal (uses .y)
 * @return {Boolean}
 */
proto._isSlipSurface = function(normal) {
    return !this.climbSteepSlopes && normal.y < this._minStandableNormalY;
};


// ==== src/character/fps/View.js ====
// View/aim/render-interpolation surface, plus the small read-only state accessors a caller polls
// every frame (sliding, moveState, bodyId, raycastIgnore). None of this touches simulation state
// except look()/setLook()/aim(), which are the caller's own facing/aim writes.
var proto = FPSCharacterController.prototype;
var FPSC = FPSCharacterController.FPSC;

/**
 * True while a slide is active this tick. Reads the single authoritative _moveState field that
 * endStep sets — see the "Movement state machine" comment above endStep (Movement/Step.js).
 * @property sliding
 * @type {Boolean}
 * @readOnly
 */
Object.defineProperty(proto, 'sliding', { get: function() { return this._moveState === FPSC.MOVE_SLIDE; } });

/**
 * This tick's movement state: one of FPSC.MOVE_LADDER / MOVE_AIRBORNE / MOVE_WALK / MOVE_SLIP /
 * MOVE_SLIDE. Set exactly once per tick, by endStep, from a fresh ground probe — beginStep (which
 * runs BEFORE endStep, on the state endStep decided last tick) only ever READS this, never
 * re-derives it. See the "Movement state machine" comment above endStep for the full design.
 * @property moveState
 * @type {String}
 * @readOnly
 */
Object.defineProperty(proto, 'moveState', { get: function() { return this._moveState; } });

/**
 * This controller's physics-body name (the value raycasts exclude to avoid self-hits).
 * @property bodyId
 * @type {String}
 * @readOnly
 */
Object.defineProperty(proto, 'bodyId', { get: function() { return this._bodyName; } });

/**
 * The body-name list this controller's own probes ignore — pass to a game's own raycasts
 * (weapons, line-of-sight) so a shooter's cast doesn't hit itself.
 * @property raycastIgnore
 * @type {String[]}
 * @readOnly
 */
Object.defineProperty(proto, 'raycastIgnore', { get: function() { return this._ignoreSelf; } });

// ---- Look --------------------------------------------------------------

/**
 * @method look
 * @param {Number} deltaYaw
 * @param {Number} deltaPitch
 */
proto.look = function(deltaYaw, deltaPitch) {
    this.yaw += deltaYaw;
    this.pitch += deltaPitch;
    if (this.pitch > this.maxPitch) { this.pitch = this.maxPitch; }
    if (this.pitch < -this.maxPitch) { this.pitch = -this.maxPitch; }
};

/**
 * @method setLook
 * @param {Number} yaw
 * @param {Number} pitch
 */
proto.setLook = function(yaw, pitch) {
    this.yaw = yaw;
    this.pitch = pitch;
};

/**
 * Full 3D look direction (includes pitch).
 * @method getLookDirection
 * @return {Vector3}
 */
proto.getLookDirection = function() {
    var cp = Scalar.cos(this.pitch);
    return new Vector3(Scalar.sin(this.yaw) * cp, Scalar.sin(this.pitch), Scalar.cos(this.yaw) * cp);
};

/**
 * Set the LIVE, caller-owned aim — call once per render frame from your mouse-look. Render-only:
 * this NEVER enters the simulation (it doesn't touch yaw/pitch, the command, or movement), it just
 * keeps a viewmodel/camera glued to the present view instead of the 60Hz sim yaw — fixing the
 * between-tick "dangle" in every mode.
 *
 * @method aim
 * @param {Number} yaw
 * @param {Number} pitch
 */
proto.aim = function(yaw, pitch) {
    this._liveYaw = yaw;
    this._livePitch = pitch;
    this._liveAimSet = true;
};

/**
 * The live aim's full 3D direction (render-only; from aim()). Falls back to the sim look.
 * @method getLiveAimDirection
 * @return {Vector3}
 */
proto.getLiveAimDirection = function() {
    if (!this._liveAimSet) { return this.getLookDirection(); }
    var cp = Scalar.cos(this._livePitch);
    return new Vector3(Scalar.sin(this._liveYaw) * cp, Scalar.sin(this._livePitch), Scalar.cos(this._liveYaw) * cp);
};

/**
 * Horizontal forward for a given yaw (defaults to current facing).
 * @method getForwardHorizontal
 * @param {Number} [yaw]
 * @return {Vector3}
 */
proto.getForwardHorizontal = function(yaw) {
    if (yaw === undefined) { yaw = this.yaw; }
    return new Vector3(Scalar.sin(yaw), 0, Scalar.cos(yaw));
};

/**
 * Horizontal right for a given yaw (defaults to current facing). Negated to match a
 * left-handed view convention so DirRight strafes to the character's visual right.
 * @method getRightHorizontal
 * @param {Number} [yaw]
 * @return {Vector3}
 */
proto.getRightHorizontal = function(yaw) {
    if (yaw === undefined) { yaw = this.yaw; }
    return new Vector3(-Scalar.cos(yaw), 0, Scalar.sin(yaw));
};

/**
 * World-space eye position (camera goes here).
 * @method getEyePosition
 * @return {Vector3}
 */
proto.getEyePosition = function() {
    var p = this.body.position;
    return new Vector3(p.x, p.y + this.eyeHeight, p.z);
};

/**
 * Return the artificial vertical eye displacement accumulated since the last call (step/landing
 * snaps + crouch/scale swaps) and reset it. A camera folds this into a decaying offset so it
 * eases over those discontinuities. Call once per render frame. Render-only — does not affect sim.
 * @method consumeViewDisplacementY
 * @return {Number}
 */
proto.consumeViewDisplacementY = function() {
    var d = this._viewDisplacementY;
    this._viewDisplacementY = 0;
    return d;
};

/**
 * Peek at the pending vertical eye displacement WITHOUT consuming it. A render-side smoother
 * consumes (consumeViewDisplacementY); a caller that only wants to DETECT a discontinuity this
 * frame (e.g. to snap interpolation instead of sliding the eye) reads this and leaves the value
 * for the smoother. Read-only — never mutates sim or render state.
 * @method peekViewDisplacementY
 * @return {Number}
 */
proto.peekViewDisplacementY = function() {
    return this._viewDisplacementY;
};

/**
 * Stash this fixed tick's eye for sub-tick render interpolation. Call ONCE per REAL fixed step,
 * right after the step settles. A teleport-sized jump (respawn / kill-plane / hard resync) or an
 * artificial step/crouch eye snap snaps the interpolation — prev := curr — so the eye doesn't
 * smear across the discontinuity.
 *
 * @method captureRenderState
 */
proto.captureRenderState = function() {
    var e = this.getEyePosition();
    var snap = !this._currEye;
    if (this._currEye) {
        var dx = e.x - this._currEye.x, dy = e.y - this._currEye.y, dz = e.z - this._currEye.z;
        if (dx * dx + dy * dy + dz * dz > this._renderSnapDist2) { snap = true; } // teleport-sized
    }
    if (Math.abs(this.peekViewDisplacementY()) > FPSC.VIEW_DISP_SNAP) { snap = true; }
    this._prevEye = snap ? e : this._currEye;
    this._currEye = e;
};

/**
 * The render-only eye position: the last two captured fixed-tick eyes lerped by the sub-tick factor
 * `alpha` (0..1, the fraction into the current fixed step the renderer hands the draw call). Falls
 * back to the live physics eye until two ticks have been captured.
 *
 * @method renderEye
 * @param {Number} alpha
 * @return {Vector3}
 */
proto.renderEye = function(alpha) {
    if (!this._prevEye || !this._currEye) { return this.getEyePosition(); }
    var a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
    var ex = this._prevEye.x + (this._currEye.x - this._prevEye.x) * a;
    var ey = this._prevEye.y + (this._currEye.y - this._prevEye.y) * a;
    var ez = this._prevEye.z + (this._currEye.z - this._prevEye.z) * a;
    return new Vector3(ex, ey, ez);
};


// ==== src/character/fps/Netcode.js ====
// Entity interface (authoritative snapshots / reconciliation). beginStep/endStep (Movement/Step.js)
// are the sim; getState/setState complete the duck-typed entity contract
// {beginStep, endStep, getState, setState} an external framework can drive, and
// beginResim/endResim bracket a rollback-and-resim of already-run commands.
var proto = FPSCharacterController.prototype;
var FPSC = FPSCharacterController.FPSC;

/**
 * Reconciliation hooks (opt-in, called by the caller around a ROLLBACK-AND-RESIM of already-run
 * commands — distinct from a game "replay"). During resim the controller re-derives already-
 * perceived state, so its step/crouch snaps must NOT feed a render smoother (that double-counts
 * every step until the resim catches back up). Live ticks are unaffected.
 * @method beginResim
 */
proto.beginResim = function() { this._resimulating = true; };
/**
 * @method endResim
 */
proto.endResim = function() { this._resimulating = false; };

/**
 * Snapshot this controller's authoritative state for the network.
 * @method getState
 * @return {Object} state
 * @return {Number} state.x - body position x.
 * @return {Number} state.y - body position y.
 * @return {Number} state.z - body position z.
 * @return {Number} state.vx - body linear velocity x.
 * @return {Number} state.vy - body linear velocity y.
 * @return {Number} state.vz - body linear velocity z.
 * @return {Number} state.yaw - commanded facing yaw.
 * @return {Number} state.pitch - commanded facing pitch.
 * @return {Boolean} state.grounded
 * @return {Number} state.w - collider width.
 * @return {Number} state.h - collider height (reflects crouch).
 * @return {String} state.moveState - one of FPSC.MOVE_LADDER/MOVE_AIRBORNE/MOVE_WALK/MOVE_SLIP/MOVE_SLIDE;
 *   see the "Movement state machine" comment above endStep — serialized so resim re-adopts the exact
 *   state live prediction was in, not a re-derived guess.
 * @return {Boolean} state.sliding - plain boolean convenience view of moveState === MOVE_SLIDE, for
 *   snapshot consumers that only care about this one bit (e.g. a body model tilting while sliding).
 * @return {Number} state.gs - ground-suppress tick counter (see endStep's `suppressed`).
 * @return {Number} state.ct - coyote-time timer remaining.
 * @return {Number} state.jb - jump-buffer timer remaining.
 * @return {Number} state.gnx - ground normal x.
 * @return {Number} state.gny - ground normal y.
 * @return {Number} state.gnz - ground normal z.
 * @return {Boolean} state.climb - steep-slope walk allowance (can be granted/refused by an authority
 *   outside this controller; serialized so prediction + resim read the authoritative value).
 * @return {Boolean} state.onLadder - ladder mount state.
 * @return {Number} state.lnx - ladder face normal x (points OUT of the ladder face).
 * @return {Number} state.lnz - ladder face normal z.
 * @return {*} state.userData - opaque consumer payload, passed through unexamined.
 *
 * NB: the ghost (the body that pushes objects) is deliberately NOT serialized. It's a local
 * follow-the-character construct; setState re-derives it locally by snapping it to the
 * authoritative character. Serializing it added bandwidth for identical results.
 */
proto.getState = function() {
    var p = this.body.position;
    var v = this.body.linear_velocity;
    return {
        x: p.x, y: p.y, z: p.z,
        vx: v.x, vy: v.y, vz: v.z,
        yaw: this.yaw, pitch: this.pitch,
        grounded: this.grounded,
        w: this.width, h: this.height,
        moveState: this._moveState,
        sliding: this._moveState === FPSC.MOVE_SLIDE,
        gs: this._groundSuppress,
        ct: this._coyoteTimer,
        jb: this._jumpBufferTimer,
        gnx: this.groundNormal.x, gny: this.groundNormal.y, gnz: this.groundNormal.z,
        climb: this.climbSteepSlopes,
        onLadder: this._onLadder,
        lnx: this._ladderNormal.x, lnz: this._ladderNormal.z,
        mantleActive: this._mantleActive,
        mantleTimer: this._mantleTimer,
        mantleSX: this._mantleStartX, mantleSY: this._mantleStartY, mantleSZ: this._mantleStartZ,
        mantleTopY: this._mantleTopBodyY,
        mantleLX: this._mantleLandX, mantleLZ: this._mantleLandZ,
        userData: this.userData
    };
};

/**
 * Apply an authoritative state (from a snapshot). Sets position, velocity and grounded; does not
 * touch yaw/pitch. Used for reconciliation before replaying already-run commands.
 * @method setState
 * @param {Object} s - a snapshot as produced by getState.
 * @param {Number} s.x
 * @param {Number} s.y
 * @param {Number} s.z
 * @param {Number} s.vx
 * @param {Number} s.vy
 * @param {Number} s.vz
 * @param {Boolean} [s.grounded]
 * @param {Number} [s.h] - collider height; a mismatch vs the current height rebuilds the collider
 *   (and re-derives crouching) before position is adopted.
 * @param {String} [s.moveState]
 * @param {Number} [s.gs]
 * @param {Number} [s.ct]
 * @param {Number} [s.jb]
 * @param {Number} [s.gnx]
 * @param {Number} [s.gny]
 * @param {Number} [s.gnz]
 * @param {Boolean} [s.climb]
 * @param {Boolean} [s.onLadder]
 * @param {Number} [s.lnx]
 * @param {Number} [s.lnz]
 * @param {*} [s.userData]
 */
proto.setState = function(s) {
    // Rebuild the collider at the authoritative center/height before adopting position, so the
    // geometry matches the snapshot's before replay (a height mismatch would re-plant crouch from
    // the wrong baseline every snapshot).
    if (s.h !== undefined && Math.abs(s.h - this.height) > FPSC.EPS_SPEED_MARGIN) {
        this.crouching = s.h < this.standHeight - FPSC.EPS_SPEED_MARGIN;
        this.height = s.h;
        this.eyeHeight = this.crouching ? this.standEye * this.crouchRatio : this.standEye;
        this._buildBody(new Vector3(s.x, s.y, s.z));
    }
    this.body.position.set(s.x, s.y, s.z);
    this.body.updateDerived();
    var v = this.body.linear_velocity;
    v.x = s.vx;
    v.y = s.vy;
    v.z = s.vz;
    this.velocityY = s.vy;
    // _ownVelocityX/Z aren't snapshot fields — re-derive them from gb so they don't go stale (see
    // constructor comment).
    this._ownVelocityX = v.x - this._baseVelocity.x;
    this._ownVelocityZ = v.z - this._baseVelocity.z;
    if (s.grounded !== undefined) { this.grounded = s.grounded; }
    // Adopt the authoritative movement state directly — resim then starts from exactly the state
    // live prediction was in (WALK/SLIP/SLIDE/AIRBORNE/LADDER), not a locally re-derived guess.
    if (s.moveState !== undefined) { this._moveState = s.moveState; }
    if (s.gs !== undefined) { this._groundSuppress = s.gs; }
    if (s.ct !== undefined) { this._coyoteTimer = s.ct; }
    if (s.jb !== undefined) { this._jumpBufferTimer = s.jb; }
    if (s.gnx !== undefined) { this.groundNormal.set(s.gnx, s.gny, s.gnz); }
    // Adopt the authoritative steep-slope allowance. This is the ONLY place the live flag is written
    // from outside — a command only sets INTENT, an authority grants/refuses it, and the truth comes
    // back here. Read live each tick by the mover/grounding, so no rebuild is needed.
    if (s.climb !== undefined) { this.climbSteepSlopes = s.climb; }
    if (s.onLadder !== undefined) { this._onLadder = s.onLadder; }
    if (s.lnx !== undefined) { this._ladderNormal.set(s.lnx, 0, s.lnz); }
    if (s.mantleActive !== undefined) { this._mantleActive = s.mantleActive; }
    if (s.mantleTimer !== undefined) { this._mantleTimer = s.mantleTimer; }
    if (s.mantleSX !== undefined) {
        this._mantleStartX = s.mantleSX; this._mantleStartY = s.mantleSY; this._mantleStartZ = s.mantleSZ;
    }
    if (s.mantleTopY !== undefined) { this._mantleTopBodyY = s.mantleTopY; }
    if (s.mantleLX !== undefined) { this._mantleLandX = s.mantleLX; this._mantleLandZ = s.mantleLZ; }
    // Restore gravity if mantling — _updateMantle zeroes it on entry but setState re-adopts the
    // arc mid-flight without re-running the entry code.
    if (this._mantleActive) { this.body.setGravity(0, 0, 0); }
    else { this.body.setGravity(this._gravityVec.x, this._gravityVec.y, this._gravityVec.z); }
    // Re-baseline the ghost LOCALLY (not from the snapshot — the ghost isn't serialized). Snap it onto
    // the just-adopted authoritative character, moving at the character's velocity, so every resim starts
    // from the same consistent ghost state and re-pushes objects identically each time.
    // Opt-out (hardsnapGhostOnReconcile=false): leave the ghost drifted.
    if (this._ghost && this._hardsnapGhostOnReconcile) {
        var bp = this.body.position, pv = this.body.linear_velocity;
        this._ghost.position.set(bp.x, bp.y + (this._ghostGroundInset || 0) / 2, bp.z);
        this._ghost.linear_velocity.set(pv.x, pv.y, pv.z);
        this._ghostCommandedVel = { x: pv.x, y: pv.y, z: pv.z };
    }
    this._prevCrouch = this.crouching;
    if (s.userData !== undefined) { this.userData = s.userData; }
};


// ==== src/character/fps/Movement/Airborne.js ====
// Airborne assists: deflecting velocity off a ceiling on the way up (_ceilingSlide), and gating
// horizontal advance into an overhang too low to fit under (_headroomGate). Neither owns a movement
// state by itself — both act as filters on whatever velocity the active state produced this tick.
var proto = FPSCharacterController.prototype;
var FPSC = FPSCharacterController.FPSC;

/**
 * Deflect velocity along an overhead surface we're about to contact, instead of capping the
 * rise to zero — a hard cap leaves no velocity to escape and glues us to ceilings, flat AND
 * sloped. Projects out the into-surface component using the ceiling's own normal: v -= (v.n) n.
 * A flat underside (n straight down) zeroes only the vertical, so horizontal motion survives; a
 * sloped underside redirects the upward motion down-and-along the slope, sliding us out. Only
 * acts when actually rising toward a ceiling within this tick's reach.
 *
 * @method _ceilingSlide
 * @private
 * @param {Number} vx
 * @param {Number} vy
 * @param {Number} vz
 * @param {Number} dt
 * @return {Object} result
 * @return {Number} result.vx
 * @return {Number} result.vy
 * @return {Number} result.vz
 */
proto._ceilingSlide = function(vx, vy, vz, dt) {
    if (vy <= 0) { return { vx: vx, vy: vy, vz: vz }; } // not rising -> nothing overhead to resolve
    var reach = this.height + vy * dt + this._skin;
    var ceil = this._probeCeiling(reach);
    if (!ceil) { return { vx: vx, vy: vy, vz: vz }; }
    var gap = ceil.point.y - (this.body.position.y + this.height / 2);
    if (gap > vy * dt + this._skin) { return { vx: vx, vy: vy, vz: vz }; } // won't reach it this tick
    var n = ceil.normal; // down-facing (n.y < 0)
    var dot = vx * n.x + vy * n.y + vz * n.z;
    if (dot < 0) {
        // Heading into the surface: remove that component, leaving motion tangent to it.
        vx -= dot * n.x;
        vy -= dot * n.y;
        vz -= dot * n.z;
    }
    return { vx: vx, vy: vy, vz: vz };
};

/**
 * Treat insufficient headroom as a virtual wall: gate on ceiling clearance ahead (rather than
 * surface normal, which a near-horizontal ramp underside can't provide) and slide along the
 * horizontal gradient of increasing clearance.
 * @method _headroomGate
 * @private
 * @param {Number} vx
 * @param {Number} vz
 * @param {Number} dt
 * @return {Object} result
 * @return {Number} result.x - gated horizontal velocity, x.
 * @return {Number} result.z - gated horizontal velocity, z.
 */
proto._headroomGate = function(vx, vz, dt) {
    var speed = Math.sqrt(vx * vx + vz * vz);
    if (speed < FPSC.EPS_DIR) { return { x: vx, z: vz }; }

    if (this.climbSteepSlopes && this._climbableSlopeAhead(this.body.position, vx / speed, vz / speed)) {
        return { x: vx, z: vz };
    }

    var p = this.body.position;
    var feetY = p.y - this.height / 2;
    var need = this.height + this._skin;
    var halfDiag = Math.sqrt((this.width / 2) * (this.width / 2) + (this.depth / 2) * (this.depth / 2));

    // Check clearance centered at the CURRENT position, not a forward-projected point — _ceilingClearanceAt
    // already samples +-(width/2-skin) / +-(depth/2-skin) around its center argument, which is the box's own
    // full footprint including its leading edge. Projecting a "reach" forward on top of that double-counts.
    // The footprint offsets ARE the reach.
    if (this._ceilingClearanceAt(p.x, p.z, feetY) >= need) { return { x: vx, z: vz }; }

    var eps = halfDiag + this._skin;
    var cR = this._ceilingClearanceAt(p.x + eps, p.z, feetY);
    var cL = this._ceilingClearanceAt(p.x - eps, p.z, feetY);
    var cF = this._ceilingClearanceAt(p.x, p.z + eps, feetY);
    var cB = this._ceilingClearanceAt(p.x, p.z - eps, feetY);

    var cap = this.standHeight + this._skin;
    function fin(c) { return isFinite(c) ? c : cap; }
    var gx = fin(cR) - fin(cL);
    var gz = fin(cF) - fin(cB);
    var glen = Math.sqrt(gx * gx + gz * gz);
    if (glen < FPSC.EPS_DIR) {
        // Grounded: stop (forces a crouch). Airborne: let horizontal flow, ceiling slide owns vertical.
        return this.grounded ? { x: 0, z: 0 } : { x: vx, z: vz };
    }
    gx /= glen;
    gz /= glen;

    var into = vx * gx + vz * gz;
    if (into < 0) {
        vx -= into * gx;
        vz -= into * gz;
    }
    return { x: vx, z: vz };
};


// ==== src/character/fps/Movement/Vertical.js ====
// Vertical motion: jump + gravity/landing hook. Gravity/landing itself is left to the solver; only
// jump/jetpack thrust writes vertical velocity directly (see _updateVertical). Also the overridable
// gait-speed hook (_getMoveSpeed), kept here since jump/speed are the two "kit" hooks a subclass
// typically overrides together.
var proto = FPSCharacterController.prototype;
var FPSC = FPSCharacterController.FPSC;

// ---- Overridable kit hooks --------------------------------------------

/**
 * Gait selection: sprint > walk > run, scaled by crouch. Override to change gait rules without
 * touching ground/step/wall logic.
 * @method _getMoveSpeed
 * @protected
 * @param {Object} cmd
 * @return {Number} target horizontal speed for this tick.
 */
proto._getMoveSpeed = function(cmd) {
    // Gait priority: sprint > walk > run. Crouch scales the chosen gait.
    var gait = cmd.sprint ? this.sprintSpeed : cmd.walk ? this.walkSpeed : this.moveSpeed;
    return cmd.crouch ? gait * this.crouchSpeedMult : gait;
};

/**
 * Vertical hook. Base = grounded jump only (gravity/landing handled by the solver). A jump adds
 * platform base velocity's Y component additively, not an overwrite — jumping off a rising
 * platform flings the character higher than jumpSpeed alone would.
 * @method _updateVertical
 * @protected
 * @param {Object} cmd
 * @param {Number} dt
 */
proto._updateVertical = function(cmd, dt) {
    var canJump = this.grounded || this._coyoteTimer > 0;
    var wantJump = cmd.jumpPressed || this._jumpBufferTimer > 0;
    if (canJump && wantJump) {
        // VERTICAL: additive, not a bare overwrite — jumping off a platform that's currently rising
        // carries its vertical base velocity into the jump (a "fling"), on top of whatever base
        // velocity the character already had that tick. Gated by _jumpKeepsVerticalBaseVelocity
        // (default true — the established, expected platforming feel; PL3 depends on it).
        var vBase = this._jumpKeepsVerticalBaseVelocity ? this._baseVelocity.y : 0;
        // The player's jump is a WISH to leave the surface — that wish should only ever be helped by
        // the platform's current motion, never fought. A platform still RISING adds free height (the
        // fling above, working as intended); a platform DESCENDING must not subtract from the jump —
        // ignore negative vBase at the moment of jumping (default on; a project that wants a
        // descending platform to actively suppress a jump can opt out). This is deliberately scoped to
        // the JUMP MOMENT only, not standing/riding in general — normal ground-follow on a descending
        // platform (not jumping) is unaffected and still correctly rides it down; only the instant the
        // player presses jump does their intent take priority over the platform's own motion.
        if (this._jumpIgnoresDescendingBaseVelocity && vBase < 0) { vBase = 0; }
        this.body.linear_velocity.y = this.jumpSpeed + vBase;
        // HORIZONTAL: gated by _jumpKeepsHorizontalBaseVelocity (default FALSE — opposite default from
        // vertical). Applies to ANY platform's horizontal base velocity, linear or rotating alike —
        // left alone, a jump off a fast-moving/spinning platform launches the rider sideways at
        // whatever speed the platform was imparting, since nothing decays it once airborne. Needs BOTH
        // zeroed when opted out, not just one:
        //   - this.body.linear_velocity.x/z (= gb, a live alias set up earlier in beginStep): the
        //     AIRBORNE movement-state dispatch that runs right after this call reads gb.x/z DIRECTLY as
        //     its base velocity (`var cur = gb`) when there's no move input — zeroing only
        //     _baseVelocity below does nothing for that path, gb itself must be clean.
        //   - this._baseVelocity.x/z: also read a few lines later in the SAME beginStep call (the
        //     dispatch's own bvx/bvz, added into the swept move regardless of movement state) — leaving
        //     it non-zero re-adds the platform's speed right back even after gb is cleared above.
        if (!this._jumpKeepsHorizontalBaseVelocity) {
            this.body.linear_velocity.x = this._ownVelocityX;
            this.body.linear_velocity.z = this._ownVelocityZ;
            this._baseVelocity.x = 0;
            this._baseVelocity.z = 0;
        }
        this.grounded = false;
        // beginStep's movement-state dispatch runs right after this call, on the SAME tick — must
        // see AIRBORNE now, not whatever grounded sub-state was true a moment ago.
        this._moveState = FPSC.MOVE_AIRBORNE;
        this._groundSuppress = FPSC.GROUND_SUPPRESS_JUMP;
        // See endStep's `suppressed` — a FIXED tick count alone isn't enough here: it doesn't know
        // how far the character actually needs to climb to clear the surface they jumped off. A
        // still-rising surface underfoot (a platform still climbing, or a ramp whose OWN surface
        // keeps rising ahead of a character sprinting up it) can have gb.y still healthily positive
        // well past GROUND_SUPPRESS_JUMP's fixed window, and would otherwise get back in ground-clamp
        // snap range the instant the countdown lapses, re-catching the jump before it ever really
        // left. This flag extends suppression for as long as gb.y stays genuinely positive (checked
        // in endStep), on top of (not instead of) the fixed countdown — so a jump still can't
        // suppress forever if something keeps gb.y positive indefinitely (a runaway edge case), but a
        // normal jump's natural gravity decay is what ends it, not an arbitrary tick count picked for
        // a flat floor.
        this._jumpRising = true;
        this._coyoteTimer = 0;
        this._jumpBufferTimer = 0;
    } else if (cmd.jumpPressed) {
        this._jumpBufferTimer = this.jumpBuffer;
    }
};


// ==== src/character/fps/Movement/Step.js ====
// Movement state machine core: beginStep (pre-physics velocity + assists) and endStep (post-physics
// grounding + state decision) bracket a single physics world step. See the class doc on
// FPSCharacterController.js for the beginStep/world.step/endStep contract, and the "MOVEMENT STATE
// DECISION" comment inside endStep below for the full state-machine design.
var proto = FPSCharacterController.prototype;
var FPSC = FPSCharacterController.FPSC;

/**
 * PRE-physics: set this tick's horizontal velocity (slope/wall projected) + assists.
 *
 * Aim/sim separation: the movement basis comes from the COMMAND's yaw (`cmd.yaw`) — a per-tick
 * input — not from any persistent "live aim". The live aim belongs to the caller (a camera reads
 * it, never the sim), so replaying commands during reconciliation can't drag the view backward.
 * We record the commanded yaw/pitch as this entity's facing (for getState/avatars) only when the
 * command carries them; a caller that never sets yaw keeps driving facing via look() instead.
 *
 * Also applies platform base velocity into the horizontal move (see the constructor's
 * _baseVelocity comment) immediately before collide-and-slide, so a rider is carried through real
 * swept motion rather than a position teleport.
 *
 * @method beginStep
 * @param {Object} command - pure-data input command struct; any field may be absent
 * @param {Number} dt
 */
proto.beginStep = function(command, dt) {
    var cmd = command || {};

    if (this._jumpBufferTimer > 0) { this._jumpBufferTimer = Math.max(0, this._jumpBufferTimer - dt); }

    if (cmd.scale !== undefined && Math.abs(cmd.scale - this.scale) > FPSC.EPS_LEN) { this.setScale(cmd.scale); }
    // Steep-slope walk intent from the command. Applying it immediately lets local prediction climb
    // right away; if an authority later overrules it, setState corrects the flag from the snapshot.
    // Read live per-tick, so a plain assignment is enough.
    if (cmd.climb !== undefined) { this.climbSteepSlopes = !!cmd.climb; }
    var wantCrouch = !!cmd.crouch || (this.crouching && !this._canStand());
    if (wantCrouch !== this.crouching) { this._setCrouch(wantCrouch); }

    if (cmd.userData !== undefined) { this.userData = cmd.userData; }

    var gb = this.body.linear_velocity;

    this._prevY = this.body.position.y;

    var moveYaw = cmd.yaw !== undefined ? cmd.yaw : this.yaw;
    var movePitch = cmd.pitch !== undefined ? cmd.pitch : this.pitch;
    if (cmd.yaw !== undefined) { this.yaw = cmd.yaw; }
    if (cmd.pitch !== undefined) { this.pitch = cmd.pitch; }

    var fwd = this.getForwardHorizontal(moveYaw);
    var rgt = this.getRightHorizontal(moveYaw);
    var cmdF = cmd.forward || 0;
    var cmdR = cmd.right || 0;
    var dirX = fwd.x * cmdF + rgt.x * cmdR;
    var dirZ = fwd.z * cmdF + rgt.z * cmdR;
    var dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ);
    var hasInput = dirLen > FPSC.EPS_DIR;
    this._cmdIdle = !hasInput;
    var speed = this._getMoveSpeed(cmd);
    var wishX = 0;
    var wishZ = 0;
    if (hasInput) {
        wishX = (dirX / dirLen) * speed;
        wishZ = (dirZ / dirLen) * speed;
    }

    // Stashed for endStep (this same tick, after world.step) to use when it decides this tick's
    // movement state from the fresh ground probe — see the "MOVEMENT STATE DECISION" block there.
    this._wantCrouch = wantCrouch;
    this._hasMoveInput = hasInput;

    var onMantleThisTick = this._updateMantle(cmd, moveYaw, dt);

    // _updateLadder mounts/dismounts and, while mounted, owns velocity fully — checked first since
    // it can override every other state this tick (a ladder grab works even mid-air or mid-slide).
    var onLadderThisTick = !onMantleThisTick && this._updateLadder(cmd, moveYaw, movePitch, dt);

    var vx, vz;
    if (onLadderThisTick || onMantleThisTick) {
        // LADDER / MANTLE: the hook already wrote gb.x/y/z; velocity is fully its.
        vx = gb.x;
        vz = gb.z;
    } else {
        // A jump flips grounded→airborne HERE, before the dispatch below reads this._moveState —
        // _updateVertical updates this._moveState directly on a jump so the same-tick dispatch
        // correctly takes the AIRBORNE branch instead of the stale GROUNDED one.
        this._updateVertical(cmd, dt);

        // ================================================================================
        // MOVEMENT STATE DISPATCH — reads this._moveState, set authoritatively by LAST tick's
        // endStep (or by _updateVertical just above, on a jump this tick). Never re-derives the
        // state from other flags; each branch below is a fully self-contained velocity model for
        // that one state, duplicated rather than shared, so there is exactly one thing to read
        // (this._moveState) to know which branch is live and exactly one place per state that
        // decides its velocity. See the "Movement state machine" comment above endStep.
        // ================================================================================
        if (this._moveState === FPSC.MOVE_SLIDE && this.grounded) {
            // SLIDE, GROUNDED: crouch-at-speed, owns velocity via _updateSlide's surface-tracking
            // model. _updateSlide is a pure per-tick evolver here — it does NOT decide entry/exit
            // anymore (endStep already decided this tick IS a slide); it only advances the
            // slide's velocity one tick (slope accel, friction, steering) from gb, which endStep
            // already set to the correct tangential speed for this tick.
            var slideResult = this._updateSlide(cmd, wishX, wishZ, dt);
            vx = slideResult.vx;
            vz = slideResult.vz;
            gb.y = slideResult.vy;
        } else if (this._moveState === FPSC.MOVE_SLIDE && !this.grounded) {
            // SLIDE, AIRBORNE: a slide that left the ground (ramp lip, drop-off) — see endStep's
            // "genuinely airborne" branch for the condition that keeps this state through the
            // launch. Carried ballistically (gravity, no air-control degradation, no slope model —
            // there's no surface under the character to track) until it lands or slows below
            // slideEndSpeed, at which point endStep drops it to AIRBORNE.
            this.body.setGravity(this._gravityVec.x, this._gravityVec.y, this._gravityVec.z);
            if (gb.y < -this._maxFall) { gb.y = -this._maxFall; }
            vx = gb.x;
            vz = gb.z;
        } else if (this._moveState === FPSC.MOVE_SLIP) {
            // SLIP: too-steep surface, gravity-fed, weak air-control.
            this.body.setGravity(0, 0, 0);
            var n = this.groundNormal;
            var slopeMag = Math.sqrt(n.x * n.x + n.z * n.z);
            var dxu = slopeMag > FPSC.EPS_LEN ? n.x / slopeMag : 0;
            var dzu = slopeMag > FPSC.EPS_LEN ? n.z / slopeMag : 0;
            var g = -this._gravityVec.y;
            // Project the incoming 3D velocity onto the plane ONLY on the tick contact is new
            // (endStep left gb.y raw, non-zero, from the fall/toss, on that one tick — see the
            // "MOVEMENT STATE DECISION" comment in endStep). On every later slip tick, endStep
            // zeroes gb.y (the kinematic model owns vertical here, not the solver), so gb.x/gb.z
            // are ALREADY the correctly-accumulated tangential speed from the previous tick's
            // formula below — re-projecting again would read that zeroed gb.y as "no vertical
            // motion yet" and subtract a spurious correction, fighting the accumulation into a
            // false plateau instead of letting speed build tick over tick.
            var gbx = gb.x, gbz = gb.z;
            if (this._slipJustEntered) {
                var dot0 = gb.x * n.x + gb.y * n.y + gb.z * n.z;
                gbx = gb.x - dot0 * n.x;
                gbz = gb.z - dot0 * n.z;
                this._slipJustEntered = false;
            }
            vx = gbx + dxu * g * slopeMag * dt;
            vz = gbz + dzu * g * slopeMag * dt;
            if (hasInput) {
                var twx = wishX, twz = wishZ;
                var up = -(twx * dxu + twz * dzu);
                if (up > 0) { twx += dxu * up; twz += dzu * up; }
                vx += (twx - vx) * this.airControl;
                vz += (twz - vz) * this.airControl;
                var along2 = vx * dxu + vz * dzu;
                if (along2 < 0) { vx -= dxu * along2; vz -= dzu * along2; }
            }
            var alongOut = vx * dxu + vz * dzu;
            gb.y = -alongOut * slopeMag / Math.max(n.y, 0.1);
        } else if (this._moveState === FPSC.MOVE_WALK) {
            // WALK: ordinary input-driven ground movement, projected tangent to groundNormal.
            // KINEMATIC GROUND: gravity off; endStep clamps the feet to the surface. Fully
            // deterministic, doesn't rely on the solver to hold us on a slope (which jittered).
            this.body.setGravity(0, 0, 0);
            var n2 = this.groundNormal;
            var mx, mz;
            if (hasInput) {
                // When slowing while still moving, bleed excess speed at sprintDecay instead of
                // snapping to the lower target speed. _ownVelocityX/Z, not gb.x/z — gb may
                // already carry a platform's base velocity baked in (see the constructor
                // comment); reading it here would re-seed "current speed" with the platform's
                // own speed already added, which then gets base velocity added AGAIN below
                // every tick instead of decaying.
                var cvx = this._ownVelocityX;
                var cvz = this._ownVelocityZ;
                var curSp = Math.sqrt(cvx * cvx + cvz * cvz);
                var wishSp = Math.sqrt(wishX * wishX + wishZ * wishZ);
                if (curSp > wishSp + FPSC.EPS_LEN) {
                    var target = Math.max(wishSp, curSp - this.sprintDecay * dt);
                    var kf = curSp > FPSC.EPS_DIR ? target / curSp : 0;
                    mx = cvx * kf;
                    mz = cvz * kf;
                } else {
                    mx = wishX;
                    mz = wishZ;
                }
            } else {
                // Carry current ground velocity; endStep's groundStopDecel is the sole stop
                // authority. _ownVelocityX/Z, NOT gb.x/z — same reasoning as above.
                mx = this._ownVelocityX;
                mz = this._ownVelocityZ;
            }
            var dot = mx * n2.x + mz * n2.z;
            vx = mx - dot * n2.x;
            vz = mz - dot * n2.z;
            gb.y = -dot * n2.y;
        } else {
            // AIRBORNE: gravity + air control own velocity.
            this.body.setGravity(this._gravityVec.x, this._gravityVec.y, this._gravityVec.z);
            var cur = gb;
            if (cur.y < -this._maxFall) { gb.y = -this._maxFall; }
            var curSp2 = Math.sqrt(cur.x * cur.x + cur.z * cur.z);
            var wishSp2 = Math.sqrt(wishX * wishX + wishZ * wishZ);
            if (hasInput) {
                if (wishSp2 >= curSp2) {
                    vx = cur.x + (wishX - cur.x) * this.airControl;
                    vz = cur.z + (wishZ - cur.z) * this.airControl;
                } else {
                    // Steer heading toward wish at the same magnitude, without bleeding speed.
                    var wl = wishSp2 || 1;
                    var tx = (wishX / wl) * curSp2;
                    var tz = (wishZ / wl) * curSp2;
                    vx = cur.x + (tx - cur.x) * this.airControl;
                    vz = cur.z + (tz - cur.z) * this.airControl;
                }
            } else {
                vx = cur.x;
                vz = cur.z;
            }
        }
    }

    if (!onLadderThisTick && !onMantleThisTick) {
        var cs = this._ceilingSlide(vx, gb.y, vz, dt);
        vx = cs.vx;
        vz = cs.vz;
        gb.y = cs.vy;
    }

    // Headroom gate: stop us advancing into an overhang too low to fit under (a ramp
    // underside closing onto the floor). A near-horizontal overhang has almost no
    // horizontal surface normal, so collide-and-slide can't see it — we gate on
    // ceiling CLEARANCE instead. Runs before collide-and-slide so walls act on the
    // already-gated velocity.
    var gated = this._headroomGate(vx, vz, dt);

    // Platform base velocity: added in immediately before the swept move so a rider is carried
    // through the SAME collide-and-slide every other velocity goes through (real swept motion, not
    // a position teleport). Stays in gb.x/z afterward — see the constructor's comment for why.
    var bvx = (onLadderThisTick || onMantleThisTick) ? 0 : this._baseVelocity.x;
    var bvz = (onLadderThisTick || onMantleThisTick) ? 0 : this._baseVelocity.z;

    // Step-up/step-down are emergent: collide-and-slide ignores anything shorter than
    // stepHeight, and the ground clamp in endStep raises/lowers us onto it. _collideAndSlide reads
    // this._moveState itself (see its own comment) to exempt an active slide from the too-steep
    // wall rule.
    var slid = this._collideAndSlide(gated.x + bvx, gated.z + bvz, dt);
    gb.x = slid.x;
    gb.z = slid.z;
    this._ownVelocityX = slid.x - bvx;
    this._ownVelocityZ = slid.z - bvz;

    this._prevCrouch = !!cmd.crouch;
};

/**
 * POST-physics: decide grounded and clamp the feet to the ground surface. Also acquires this
 * tick's platform base velocity (see the constructor's _baseVelocity comment) from whatever
 * isPlatform-tagged body the ground probe lands on, read fresh every tick.
 * @method endStep
 * @param {Number} dt
 */
proto.endStep = function(dt) {
    var gb = this.body.linear_velocity;

    // While mounted on a ladder or mid-mantle arc, skip the ground clamp — it would otherwise
    // re-snap the character onto the floor every tick while being carried upward.
    if (this._onLadder || this._mantleActive) {
        this.velocityY = gb.y;
        if (!this._resimulating || this._driveGhostDuringResim) { this._syncGhost(dt); }
        return;
    }

    if (this._groundSuppress > 0) { this._groundSuppress--; }
    // Only suppress grounding while rising (just jumped/thrust); while falling the ground
    // catch must stay live or the body tunnels through the floor. _jumpRising extends this past the
    // fixed countdown for as long as the character is STILL genuinely ascending — see its own
    // comment at the jump site for why a flat tick count alone isn't enough (a still-rising surface
    // underfoot, platform or ramp, can re-enter snap range before the countdown's fixed window would
    // ever expect it to). Cleared the moment gb.y decays past the threshold, so this can't suppress
    // indefinitely — ordinary gravity decay is what ends it.
    if (this._jumpRising && gb.y <= 1) { this._jumpRising = false; }
    var suppressed = this._groundSuppress > 0 && gb.y > 1;

    var half = this.height / 2;
    var maxStick = this.grounded ? this.stepDownDist + this._skin : this._groundTol;

    // Walk candidates highest-first and take the first that ISN'T too tall to step onto (relative
    // to current feet, only while already grounded — see tooHighToStep below). Falling through to
    // a lower, valid candidate keeps grounding honest when a taller obstacle (e.g. a box shoved
    // against the footprint) is also in reach.
    var candidates = this._probeGroundCandidates(this.stepDownDist);
    // Slide launch off a ramp apex — only while SLIDING and rising (walking off the same edge just
    // follows the ground down). ANGLE-BLIND: a slide treats every slope identically regardless of
    // steepness, so this gate never asks "is this too steep" — only "is this still the surface I'm
    // riding." Two ways the true edge shows up in the probe, both handled here:
    //   1. The highest surface RECEDES: the ramp face we were climbing runs out ahead, so the highest
    //      remaining ramp hit drops vs last tick. Clamping to it would hug us down a one-tick dip.
    //   2. A MISMATCHED face (e.g. the ramp's own end-cap) becomes the highest candidate: taller than
    //      the ramp face but not the surface we're riding (normal meaningfully off groundNormal). It can
    //      mask signal #1 by sitting on top, so we test it independently — riding a ramp, the candidate
    //      still ON that same face keeps matching every tick and never trips this; only a genuinely
    //      different face (the real edge) does.
    var topCandidate = candidates.length > 0 ? candidates[0] : null;
    var topCandidateY = topCandidate ? topCandidate.point.y : null;
    var wasSliding = this._moveState === FPSC.MOVE_SLIDE;
    if (this.grounded && wasSliding && gb.y > FPSC.EPS_LEN && topCandidate !== null) {
        var receded = this._prevTopCandidateY !== null && topCandidateY < this._prevTopCandidateY - FPSC.EPS_LEN;
        var normalDot = topCandidate.normal.x * this.groundNormal.x +
            topCandidate.normal.y * this.groundNormal.y +
            topCandidate.normal.z * this.groundNormal.z;
        var mismatched = normalDot < this._minStandableNormalY;
        if (receded || mismatched) { candidates = []; this._slideLaunched = true; }
    }
    // A slide apex launch is latched, not a one-tick decision: the tick it fires, grounded flips false
    // immediately, so the gate above (which requires it true) can never re-arm to catch a second graze
    // later in the same arc. Without this latch, a low/shallow launch that skims just above the ramp's
    // tail gets ground-clamped straight back down the very next tick the probe happens to reach it — a
    // one-tick "dip" mid-arc. Sliding off an apex must NEVER re-hug the geometry, full stop, so once
    // latched we force every candidate away regardless of what the probe finds, for as long as the arc
    // is still rising. The latch clears once gb.y stops climbing (the arc has peaked and started to
    // fall) — from that point a real landing is legitimate and ground detection must resume normally.
    if (this._slideLaunched) {
        if (gb.y > FPSC.EPS_LEN) { candidates = []; }
        else { this._slideLaunched = false; }
    }
    this._prevTopCandidateY = topCandidateY;
    var probe = null, tooHighToStep = false;
    for (var ci = 0; ci < candidates.length; ci++) {
        var c = candidates[ci];
        var rise = (c.point.y + half) - this.body.position.y;
        // feet already inside this surface -> push out onto it, not a step-up to refuse
        var penetrating = (this.body.position.y - half) < c.point.y - this._skin;
        var tooHigh = this.grounded && !penetrating && rise > this.stepHeight + this._skin;
        if (!tooHigh) { probe = c; tooHighToStep = false; break; }
        if (!probe) { probe = c; tooHighToStep = true; } // keep the highest as a fallback reference
    }

    // feetGap > 0 = feet above ground; < 0 = penetrating (always clamp back out).
    var feetGap = probe ? this.body.position.y - half - probe.point.y : Infinity;

    if (!suppressed && probe && feetGap <= maxStick && !tooHighToStep) {
        var p = this.body.position;
        var clampedY = probe.point.y + half;
        if (!this._resimulating) { this._viewDisplacementY += clampedY - p.y; }
        this.body.position.set(p.x, clampedY, p.z);
        this.body.updateDerived();

        // Save the OUTGOING base velocity before overwriting it below — gb (about to be split into
        // own-vs-base components further down) was built by LAST tick's beginStep using THIS old
        // value, not the new one we're about to acquire. Splitting gb against the NEW value instead
        // manufactures a one-tick phantom "own velocity" spike whenever the platform's velocity
        // changes abruptly between ticks (a reversing elevator/shuttle, or a rotating platform
        // changing direction each tick): gb still reflects the old speed, so subtracting the new
        // speed leaves a large bogus residual that then has to visibly bleed off via the idle
        // ground-stop decay below. Using the OLD value here keeps the split correct for the
        // tick gb was actually built on; the NEW value (acquired below) still lands in
        // this._baseVelocity for beginStep to pick up fresh next tick, same as always.
        var outgoingBaseVelocityX = this._baseVelocity.x, outgoingBaseVelocityZ = this._baseVelocity.z;
        var standingOn = probe.object;
        if (standingOn && standingOn.isPlatform) {
            var pv = standingOn.linear_velocity;
            var bvx = pv.x, bvy = pv.y, bvz = pv.z;
            // Rotating platform: carry the character along the platform's own EXACT arc this tick,
            // Y-axis spin only (the only axis a standable platform can usefully spin on). Recomputed
            // fresh every tick from the CURRENT offset (not cached), so as the character walks
            // toward/away from the pivot the imparted speed tracks the true radius, and so it decays
            // to zero at the pivot itself.
            //
            // NOT a naive omega x r tangential velocity: that's only the arc's INSTANTANEOUS tangent,
            // and applying it as a straight line for a full tick always overshoots the true curve —
            // every tick's move ends up very slightly outside the circle, and next tick's tangent is
            // computed from that already-drifted position, so the error compounds tick over tick into
            // an outward spiral (visible at high spin rates as being "flung off the platform"). Fix:
            // compute the CHORD velocity instead — the constant velocity that carries the rider from
            // its current offset to the offset EXACTLY rotated by theta=omegaY*dt, i.e.
            // (rotated - current) / dt. This reproduces the platform's real circular motion exactly
            // regardless of angular speed, instead of approximating it.
            if (standingOn.isRotatingPlatform && standingOn.angular_velocity) {
                var omegaY = standingOn.angular_velocity.y;
                if (omegaY && dt > 0) {
                    var center = standingOn.position;
                    var rx = this.body.position.x - center.x;
                    var rz = this.body.position.z - center.z;
                    var theta = omegaY * dt;
                    var cosT = Scalar.cos(theta), sinT = Scalar.sin(theta);
                    // Matches the engine's own rotation convention (verified against RigidBody's quaternion
                    // integration directly, not assumed): for omegaY > 0, the rotated offset is
                    // (rx*cos+rz*sin, rz*cos-rx*sin) — the same sense that produced the correct
                    // (omegaY*rz, -omegaY*rx) instantaneous tangent this replaces.
                    var rxRot = rx * cosT + rz * sinT;
                    var rzRot = rz * cosT - rx * sinT;
                    bvx += (rxRot - rx) / dt;
                    bvz += (rzRot - rz) / dt;
                }
            }
            this._baseVelocity.set(bvx, bvy, bvz);
        } else {
            this._baseVelocity.set(0, 0, 0);
        }

        // ================================================================================
        // MOVEMENT STATE DECISION — the ONE place per tick this is decided, from the ONE real
        // ground probe this tick has. beginStep (next tick) only ever reads this._moveState; it
        // never re-derives sliding/slipping/walking from other flags.
        // ================================================================================
        var pn = probe.normal;
        var probeSlope = Math.sqrt(pn.x * pn.x + pn.z * pn.z);

        // Project the incoming 3D velocity onto the surface plane ONCE, here, on every grounding
        // tick — not just the first-contact tick. (v -= (v·n)n): removes the into-surface
        // component, keeps the along-surface (tangential) component. On a tick where the body was
        // already resting on this same surface last tick too, this is a no-op (gb is already
        // tangent), so it's safe to always run — no separate "first contact only" special case.
        var vdotn = gb.x * pn.x + gb.y * pn.y + gb.z * pn.z;
        var tangentX = gb.x - vdotn * pn.x;
        var tangentZ = gb.z - vdotn * pn.z;
        var horizTangentSpeed = Math.sqrt(tangentX * tangentX + tangentZ * tangentZ);

        // TRUE along-the-ground speed, for the slide entry/sustain SPEED test only (tangentX/Z above,
        // which DOES include platform velocity, is what actually gets written to gb). Platform
        // velocity is excluded from this speed reading — otherwise a fast rotating platform's own
        // tangential speed alone can exceed moveSpeed with zero player effort, launching an unwanted
        // slide on crouch while just riding. Reconstructs true 3D along-surface speed the same way a
        // slope converts fall speed to horizontal (divide the along-slope component by ny).
        var vdotnOwn = (gb.x - outgoingBaseVelocityX) * pn.x + gb.y * pn.y + (gb.z - outgoingBaseVelocityZ) * pn.z;
        var tangentOwnX = (gb.x - outgoingBaseVelocityX) - vdotnOwn * pn.x;
        var tangentOwnZ = (gb.z - outgoingBaseVelocityZ) - vdotnOwn * pn.z;
        var horizTangentOwnSpeed = Math.sqrt(tangentOwnX * tangentOwnX + tangentOwnZ * tangentOwnZ);

        var slopeMag0 = probeSlope;
        var ny0 = Math.max(pn.y, 0.1);
        var groundSp;
        if (slopeMag0 > FPSC.EPS_LEN) {
            var dxu0 = pn.x / slopeMag0, dzu0 = pn.z / slopeMag0;
            var alongH = tangentOwnX * dxu0 + tangentOwnZ * dzu0;
            var crossSq = Math.max(0, horizTangentOwnSpeed * horizTangentOwnSpeed - alongH * alongH);
            var surfFall = alongH / ny0;
            groundSp = Math.sqrt(surfFall * surfFall + crossSq);
        } else {
            groundSp = horizTangentOwnSpeed;
        }
        var tangentSpeed = groundSp;

        var isSlipSurface = this._isSlipSurface(pn);
        // Slide ENTRY/SUSTAIN uses the SAME rule regardless of whether this is the first contact
        // tick or the 500th tick of an already-active slide: crouch held, and (on a slope, ride
        // until crouch releases; on flat, need speed above slideEndSpeed to keep going / above
        // moveSpeed to start). This mirrors _updateSlide's old entry/sustain split, but evaluated
        // ONCE, with this tick's own fresh probe normal and true tangential speed — not the
        // previous tick's groundNormal, not a landing-only special case.
        var slopeSlideEligible = probeSlope >= this.slideSlopeMin;
        var hasMoveInputThisTick = this._hasMoveInput;
        var slideInputOk = !this.slideRequiresMoveInput || hasMoveInputThisTick ||
            (this.slideAllowLandingWithoutInput && !this.grounded);
        var slideSustainOk = slopeSlideEligible || tangentSpeed >= this.slideEndSpeed;
        var slideEntryOk = slideInputOk && tangentSpeed > this.moveSpeed + FPSC.EPS_SPEED_MARGIN;
        var wantsSlide = !!this._wantCrouch && (wasSliding ? slideSustainOk : slideEntryOk);

        if (wantsSlide) {
            this._moveState = FPSC.MOVE_SLIDE;
            var enteringSlide = !wasSliding;
            // slideBoost applied HERE, on the exact entry tick, directly to the velocity endStep is
            // about to commit — not inside _updateSlide (which only runs the FOLLOWING tick, in
            // beginStep). Applying it there would show the boost one tick later than the state
            // transition itself, which is observably wrong (a caller reading "just started
            // sliding" this tick would see un-boosted speed).
            var boostedX = tangentX, boostedZ = tangentZ;
            if (enteringSlide && this.slideBoost !== 1) {
                boostedX *= this.slideBoost;
                boostedZ *= this.slideBoost;
            }
            gb.x = boostedX;
            gb.z = boostedZ;
            // gb.y is left for _updateSlide's onSlope solve to derive from the tangential speed
            // above — writing a raw projected vertical here overshoots the surface-follow value
            // and skips the character off the ramp for a tick (a bounce).
            gb.y = 0;
        } else if (isSlipSurface) {
            // Entry edge: this tick starts a NEW slip iff last tick wasn't already one. beginStep's
            // SLIP branch only re-projects gb onto
            // groundNormal on that one entry tick (see its own comment) — every later tick, gb.y
            // is already 0 (set below) and gb.x/gb.z already hold the correctly-accumulated
            // tangential speed from beginStep's own per-tick formula, so re-projecting again would
            // corrupt that accumulation into a false plateau.
            var enteringSlip = this._moveState !== FPSC.MOVE_SLIP;
            this._slipJustEntered = enteringSlip;
            this._moveState = FPSC.MOVE_SLIP;
            // Keep the RAW incoming gb.x/gb.z/gb.y (NOT the tangential projection) on the entry
            // tick — beginStep's SLIP branch does its own plane projection from this.groundNormal
            // next tick, gated to _slipJustEntered, and needs gb.y to still be the real incoming
            // fall speed to project. From the SECOND slip tick on, gb.y is zeroed here as usual —
            // beginStep's per-tick formula derives its own vy from there on, and leaving a stale
            // gb.y would double-count it.
            if (!enteringSlip) { gb.y = 0; }
        } else {
            this._moveState = FPSC.MOVE_WALK;
            gb.x = tangentX;
            gb.z = tangentZ;
            gb.y = 0;
        }
        // Split against the OUTGOING (pre-acquire) base velocity, not the freshly-acquired one — see
        // the comment above outgoingBaseVelocityX/Z's declaration for why.
        this._ownVelocityX = gb.x - outgoingBaseVelocityX;
        this._ownVelocityZ = gb.z - outgoingBaseVelocityZ;

        // Idle ground-stop: WALK only. Bleeds horizontal speed toward zero at groundStopDecel.
        // Reads/writes _ownVelocityX/Z (the character's OWN component), NOT gb.x/z directly — gb
        // may already carry a platform's base velocity baked in, and decaying THAT would fight
        // the ride. The decayed own-component is added back onto base velocity so gb ends up
        // carrying: decayed own motion + full undecayed platform motion.
        if (this._cmdIdle && this._moveState === FPSC.MOVE_WALK) {
            var cvx = this._ownVelocityX || 0;
            var cvz = this._ownVelocityZ || 0;
            var sp = Math.sqrt(cvx * cvx + cvz * cvz);
            var target = Math.max(0, sp - this.groundStopDecel * dt);
            var kf = sp > FPSC.EPS_SPD ? target / sp : 0;
            this._ownVelocityX = cvx * kf;
            this._ownVelocityZ = cvz * kf;
            gb.x = this._ownVelocityX + this._baseVelocity.x;
            gb.z = this._ownVelocityZ + this._baseVelocity.z;
        }

        this.grounded = true;
        this.groundNormal.set(probe.normal.x, probe.normal.y, probe.normal.z);
    } else if (tooHighToStep) {
        // Refusing to climb something too tall (e.g. a box shoved into the footprint) must NOT be
        // treated as leaving the ground: the feet haven't moved, there's no gap, no fall — the
        // character is exactly where it was a moment ago, still resting on whatever it was resting
        // on. Staying grounded on rejection keeps the height-limit check
        // (this.grounded && rise > stepHeight) honest on the next tick too.
        gb.y = 0;
        // Movement state is UNCHANGED here on purpose: the character is exactly where it was,
        // still resting on whatever it was resting on, so whatever state that was is still true.
    } else {
        this.grounded = false;
        // A slide that leaves the ground (ramp lip, drop-off) stays MOVE_SLIDE through the airborne
        // arc — carried mostly ballistically rather than air-controlled — as long as horizontal
        // speed is still above slideEndSpeed (the same floor flat sliding itself uses to decide
        // "still going") and crouch is still held. beginStep's SLIDE branch has its own airborne vs.
        // grounded sub-cases for exactly this reason. Landing re-enters the ordinary MOVEMENT STATE
        // DECISION above on the fresh probe normal, so it naturally continues sliding (onto a ramp)
        // or drops to WALK/SLIP there — no separate landing special-case needed here.
        var wasSlideBeforeLoss = this._moveState === FPSC.MOVE_SLIDE;
        var stillFastEnough = Math.sqrt(gb.x * gb.x + gb.z * gb.z) >= this.slideEndSpeed;
        if (wasSlideBeforeLoss && this._wantCrouch && stillFastEnough) {
            this._moveState = FPSC.MOVE_SLIDE;
        } else {
            this._moveState = FPSC.MOVE_AIRBORNE;
        }
        // Genuinely airborne — no ground entity to inherit velocity from. A jump already captured
        // baseVelocity.y additively the tick it fired (_updateVertical); clearing here only stops
        // FUTURE ticks from reading a stale platform velocity while falling free.
        this._baseVelocity.set(0, 0, 0);
    }

    // Coyote window: refill while grounded, bleed down once airborne. No-op when coyoteTime=0.
    if (this.grounded) { this._coyoteTimer = this.coyoteTime; }
    else if (this._coyoteTimer > 0) { this._coyoteTimer = Math.max(0, this._coyoteTimer - dt); }

    this.velocityY = gb.y;

    // Drive the ghost every tick, INCLUDING during resim: the ghost is how the character pushes objects,
    // and object pushes must be reproduced when already-run commands get rolled back and resimulated
    // (otherwise a pushed object is predicted live but snaps back every snapshot — rubber-banding). The
    // ghost drive is deterministic given the character's state. What must NOT run during resim is the
    // knockback READBACK from the ghost into the character (see _syncGhost / _readGhostKnockback): feeding
    // a solver body's contact velocity back into the character mid-rollback is what injects non-determinism
    // into the reconciled character path. That readback is gated inside _syncGhost.
    // Opt-out (driveGhostDuringResim=false): freeze the ghost during resim (older behavior).
    if (!this._resimulating || this._driveGhostDuringResim) { this._syncGhost(dt); }
};


// ==== src/character/fps/Movement/Slide.js ====
// Crouch-at-speed slide: the per-tick velocity evolver for an active slide (slope acceleration,
// friction, steering). Entry/exit decisions themselves live in endStep's "MOVEMENT STATE DECISION"
// block (Movement/Step.js) — this file only advances an already-active slide by one tick.
var proto = FPSCharacterController.prototype;
var FPSC = FPSCharacterController.FPSC;

/**
 * Slide velocity EVOLVER — advances one tick of the slide's surface-tracking model (slope accel,
 * friction, steering). Pure: only called from beginStep's MOVE_SLIDE branch, which is only reached
 * when endStep has ALREADY decided this tick is a slide (see the "MOVEMENT STATE DECISION" block
 * in endStep) and has already written the correct starting tangential velocity into gb — including
 * the one-time entry boost (slideBoost), applied there rather than here so it lands on the exact
 * tick the state transition itself is observable, not one tick later. This function does not
 * decide whether to slide — it has no entry gate, no exit gate, no stored flag. It reads gb (this
 * tick's starting velocity, already tangent to groundNormal), advances it one tick, and returns
 * the result.
 *
 * @method _updateSlide
 * @private
 * @param {Object} cmd
 * @param {Number} wishX - desired horizontal velocity x from input (unsteered).
 * @param {Number} wishZ - desired horizontal velocity z from input (unsteered).
 * @param {Number} dt
 * @return {Object} result
 * @return {Number} result.vx - this tick's slide velocity, x.
 * @return {Number} result.vy - this tick's slide velocity, y (surface-follow component).
 * @return {Number} result.vz - this tick's slide velocity, z.
 */
proto._updateSlide = function(cmd, wishX, wishZ, dt) {
    // _ownVelocityX/Z, NOT gb.x/z — gb carries the platform's base velocity baked in (see the
    // constructor's _baseVelocity comment). Evolving the raw gb value would re-seed the slide's own
    // momentum with the platform's speed already added, which then compounds every tick instead of
    // properly decaying (the platform reads as if its own speed were the character's own build-up —
    // a "boost pad" while sliding on a moving platform).
    var vx = this._ownVelocityX;
    var vz = this._ownVelocityZ;
    var sp = Math.sqrt(vx * vx + vz * vz);

    var n = this.groundNormal;
    var slopeMag = Math.sqrt(n.x * n.x + n.z * n.z);
    var gy = this._gravityVec.y;
    var onSlope = slopeMag >= this.slideSlopeMin;
    // Downhill fall-line unit vector, used both by the slope-accel step below and by the reversal
    // brake's uphill test further down. Only meaningful when onSlope; 0 otherwise (unused there).
    var dx = onSlope ? n.x / slopeMag : 0;
    var dz = onSlope ? n.z / slopeMag : 0;

    if (onSlope) {
        // Gravity accelerates the fall-line (downhill) component; the cross-slope (sideways)
        // part bleeds lightly. Returned as full 3D so the grounded branch doesn't re-project it.
        var along = vx * dx + vz * dz;
        var crossX = vx - along * dx;
        var crossZ = vz - along * dz;
        // Along-slope gravitational accel is g*sin(theta) — slopeMag alone (sin of the tilt from
        // horizontal). An extra n.y (cos theta) factor here would be wrong: sin(theta)*cos(theta)
        // PEAKS at 45° and falls back off toward vertical, so a 55°+ face would decelerate barely
        // harder than a 20° one, and a near-vertical wall almost not at all — backwards from real
        // physics, where steeper always means more deceleration, up to g at 90°.
        along += -gy * slopeMag * this.slideSlopeAccel * dt;
        var cs = Math.sqrt(crossX * crossX + crossZ * crossZ);
        var cn = Math.max(0, cs - this.slideSlopeFriction * dt);
        var cf = cs > FPSC.EPS_DIR ? cn / cs : 0;
        crossX *= cf;
        crossZ *= cf;
        vx = along * dx + crossX;
        vz = along * dz + crossZ;
        sp = Math.sqrt(vx * vx + vz * vz);
    } else {
        var next = Math.max(0, sp - this.slideFriction * dt);
        var f = sp > FPSC.EPS_DIR ? next / sp : 0;
        vx *= f;
        vz *= f;
        sp = next;
    }

    // Rotate the slide heading toward input without adding speed (renormalize to sp).
    var wl = Math.sqrt(wishX * wishX + wishZ * wishZ);
    if (this.slideControl > 0 && wl > FPSC.EPS_DIR && sp > FPSC.EPS_DIR) {
        var wnx = wishX / wl, wnz = wishZ / wl;
        // Wish opposing current motion (e.g. holding backward mid-slide) is a deliberate reversal,
        // not a carve — the ordinary partial blend below would slowly rotate the heading through an
        // arc instead of braking straight back. Detect that case (wish nearly opposite current
        // velocity) and brake toward zero along the CURRENT heading instead of blending toward
        // wish; once speed has bled down, the same blend below is what picks the (now-reversed)
        // heading back up, so the reversal itself still ends up sliding in the wish direction — it
        // just brakes-then-goes instead of curving through it. Applies on flat ground too: without
        // this, flat sliding's own friction decay would bleed speed down to the slideEndSpeed exit
        // threshold WHILE the un-braked blend was arcing the heading toward wish, so a backward
        // hold curved through a U-turn on its way out instead of braking straight.
        var brakeRate = onSlope ? this.slideSlopeFriction * this.slideReversalBrakeMult
            : this.slideFriction * this.slideReversalBrakeMult;
        var vnx = vx / sp, vnz = vz / sp;
        var facing = wnx * vnx + wnz * vnz; // 1 = same direction, -1 = dead opposite
        // ANGLE-BLIND: on ANY slope, gravity always wins the fall-line — you can't carve a slide uphill
        // against it, only brake. A wish with any uphill component (against the downhill fall-line
        // dx/dz) must BRAKE toward a stop, not carve; otherwise the carve below redirects the blocked
        // uphill momentum into a cross-slope skid off the side. On flat there's no fall-line to fight,
        // so only a near-opposite wish counts as a reversal there (unchanged).
        var uphillOnSlope = onSlope && (wnx * dx + wnz * dz) < 0;
        if (uphillOnSlope || facing < FPSC.SLIDE_REVERSAL_DOT) {
            var braked = Math.max(0, sp - brakeRate * dt);
            var bf = sp > FPSC.EPS_DIR ? braked / sp : 0;
            vx *= bf;
            vz *= bf;
        } else {
            var tx = vx + (wnx * sp - vx) * this.slideControl;
            var tz = vz + (wnz * sp - vz) * this.slideControl;
            var tl = Math.sqrt(tx * tx + tz * tz) || 1;
            vx = (tx / tl) * sp;
            vz = (tz / tl) * sp;
        }
    }

    var vy = 0;
    if (onSlope) {
        var inv2 = 1 / slopeMag;
        var alongOut = vx * (n.x * inv2) + vz * (n.z * inv2);
        vy = -alongOut * slopeMag / Math.max(n.y, 0.1);
        // The velocity returned here is already tangent to the surface — including on a TOO-STEEP slope.
        // The too-steep-can't-move-up rules don't re-clip it: an active slide is exempt everywhere they
        // apply (see _collideAndSlide's climbSteepSlopes opt) — the slide IS the climb.
    }
    // Flat ground (!onSlope): groundNormal.y is ~1, so gb.y should stay ~0 — the caller (beginStep's
    // ground clamp path, same as WALK) doesn't need a nonzero vy to track a surface that's already
    // level. vy=0 here is that "no vertical correction needed" case, not a special flat-only shape.
    return { vx: vx, vy: vy, vz: vz };
};


// ==== src/character/fps/Movement/Ladder.js ====
// Ladder climbing: a fourth movement state alongside grounded/slip/airborne/slide, resolved once per
// beginStep before the main movement dispatch runs (see _updateLadder's call site in Step.js).
var proto = FPSCharacterController.prototype;
var FPSC = FPSCharacterController.FPSC;

/**
 * Ladder state transitions + climb velocity. A fourth movement state alongside grounded /
 * noTraction / airborne, resolved once per beginStep before that branch runs. The ladder body is
 * never excluded from collision — _collideAndSlide still runs afterward on whatever velocity this
 * writes, so ordinary contact resolution is what holds the character against the face tick over tick.
 *
 * Mount requires movement intent toward the ladder (wishdir), not mere proximity — probing along
 * the current input direction rather than scanning all directions means jumping away from a ladder
 * and holding the opposite key back toward it, or passing a ladder mid-air, can't remount it a
 * frame later while disconnected from it.
 *
 * Forward/back and strafe contributions to climb velocity are summed independently, without
 * normalizing the combined wish vector — holding both diagonally into the face climbs strictly
 * faster than either alone. Look pitch steers climb direction: the forward axis is the full
 * pitched look direction, not flattened, so holding forward while looking down descends.
 *
 * Jump dismounts with a purely horizontal shove away from the face — no vertical component.
 *
 * @method _updateLadder
 * @private
 * @param {Object} cmd
 * @param {Number} moveYaw
 * @param {Number} movePitch
 * @param {Number} dt
 * @return {Boolean} true if this tick's velocity is fully owned by the ladder branch
 */
proto._updateLadder = function(cmd, moveYaw, movePitch, dt) {
    var gb = this.body.linear_velocity;

    var hit;
    if (this._onLadder) {
        var probeDir = new Vector3(-this._ladderNormal.x, 0, -this._ladderNormal.z);
        hit = this._findLadderAhead(probeDir);
    } else {
        var fwdH = this.getForwardHorizontal(moveYaw);
        var rgtH = this.getRightHorizontal(moveYaw);
        var cmdF0 = cmd.forward || 0;
        var cmdR0 = cmd.right || 0;
        var wishdir = new Vector3(
            fwdH.x * cmdF0 + rgtH.x * cmdR0, 0, fwdH.z * cmdF0 + rgtH.z * cmdR0
        );
        hit = this._findLadderAhead(wishdir);
    }

    if (cmd.jumpPressed && this._onLadder) {
        var n0 = this._ladderNormal;
        gb.x = n0.x * this.ladderDismountPushSpeed;
        gb.z = n0.z * this.ladderDismountPushSpeed;
        gb.y = 0;
        this._onLadder = false;
        // While mounted the character's own box is genuinely embedded roughly width/2 INTO the
        // ladder (mounting at the ladder face means the box's near edge reaches past the face into
        // the ladder's own volume, by design - see this file's own header comment: "the ladder body
        // is never excluded from collision"). This same-tick dismount shove used to need a manual
        // position-based depenetration nudge here before _collideAndSlide ran, because the sweep's
        // exact-touch/embedded-start case (Queries._advance) fell back to the reversed TRAVEL
        // direction for its normal instead of real surface geometry, so a shove starting from
        // inside the ladder's own volume got swept-and-clipped right back to zero every time -
        // jump-dismount never actually moved the character, leaving it frozen at the mount point.
        // Fixed at the root in Queries._advance (the overlapping-sweep case now runs EPA on GJK's
        // own simplex for a real geometric normal, same as the narrowphase/overlap-test paths
        // already did) - verified directly (a position trace with the nudge removed shows the
        // dismount sweep clearing the ladder normally, L6 passes unmodified), so the nudge here was
        // removed rather than kept as a belt-and-braces duplicate of a fix that now lives upstream.
        // The push flings the character off the ladder into the air — next tick's beginStep
        // dispatch (before endStep gets a chance to re-probe) must see AIRBORNE, not whatever
        // ground state was true before this ladder mount.
        this._moveState = FPSC.MOVE_AIRBORNE;
        this.body.setGravity(this._gravityVec.x, this._gravityVec.y, this._gravityVec.z);
        return true;
    }

    if (!hit) {
        this._onLadder = false;
        this.body.setGravity(this._gravityVec.x, this._gravityVec.y, this._gravityVec.z);
        return false;
    }

    var hasMoveInput = (cmd.forward || 0) !== 0 || (cmd.right || 0) !== 0;
    if (!this._onLadder && !hasMoveInput) { return false; }

    this._onLadder = true;
    this.grounded = false;
    // Mounting owns movement now — any grounded state carried in from the tick before must not read
    // as still active while climbing (or linger stale after a later dismount): beginStep's dispatch
    // only reads this._moveState when NOT on a ladder, so nothing else would ever clear this.
    this._moveState = FPSC.MOVE_LADDER;
    this._ladderNormal.set(hit.normal.x, 0, hit.normal.z);
    var nl = Math.sqrt(this._ladderNormal.x * this._ladderNormal.x + this._ladderNormal.z * this._ladderNormal.z);
    if (nl > FPSC.EPS_LEN) { this._ladderNormal.x /= nl; this._ladderNormal.z /= nl; }

    this.body.setGravity(0, 0, 0);
    if (!hasMoveInput) { gb.x = 0; gb.y = 0; gb.z = 0; return true; }

    var cp = Scalar.cos(movePitch);
    var fwd = new Vector3(Scalar.sin(moveYaw) * cp, Scalar.sin(movePitch), Scalar.cos(moveYaw) * cp);
    var rgt = this.getRightHorizontal(moveYaw);
    var cmdF = cmd.forward || 0;
    var cmdR = cmd.right || 0;

    var velX = fwd.x * cmdF * this.ladderClimbSpeed + rgt.x * cmdR * this.ladderStrafeSpeed;
    var velY = fwd.y * cmdF * this.ladderClimbSpeed;
    var velZ = fwd.z * cmdF * this.ladderClimbSpeed + rgt.z * cmdR * this.ladderStrafeSpeed;

    var n = this._ladderNormal;
    var out = velX * n.x + velZ * n.z;
    gb.x = velX - out * n.x;
    gb.z = velZ - out * n.z;
    gb.y = velY - out;

    // Descent is blocked against solid ground here (rather than in endStep's ground clamp, which is
    // skipped while mounted so it doesn't re-snap the character onto the floor near the ladder's base
    // even while climbing up). Uses the same _probeGroundCandidates primitive endStep itself uses.
    //
    // The ladder body itself is excluded from candidates. While mounted, the character's own collider
    // sits embedded in (or flush against) the ladder volume it's climbing - a downward probe cast
    // from inside that volume can report the ladder's OWN top-facing surface as "ground" directly
    // below (GJK/EPA's exact-touch/embedded case has no unique normal - see GJK.js's "EXACT-TOUCHING
    // IS UNDECIDABLE" - and can report an arbitrary near point at the probe's own height). This was
    // a REAL, confirmed bug: looking down while climbing made the character "step up" onto its own
    // current position on the ladder every descent tick instead of climbing down, because the probe
    // found the ladder itself a few centimeters below and clamped onto it as if it were a floor -
    // climbing the ladder like stairs, straight off the top, regardless of look direction.
    if (gb.y < 0) {
        var half = this.height / 2;
        var reach2 = -gb.y * dt + this._skin;
        var descentCandidates = this._probeGroundCandidates(reach2);
        var ground = null;
        for (var gi = 0; gi < descentCandidates.length; gi++) {
            if (!descentCandidates[gi].object || !descentCandidates[gi].object.isLadder) { ground = descentCandidates[gi]; break; }
        }
        if (ground) {
            var feetGap = this.body.position.y - half - ground.point.y;
            if (feetGap <= reach2) {
                var clampedY = ground.point.y + half;
                if (!this._resimulating) { this._viewDisplacementY += clampedY - this.body.position.y; }
                this.body.position.set(this.body.position.x, clampedY, this.body.position.z);
                this.body.updateDerived();
                gb.y = 0;
                this.grounded = true;
                // Still LADDER for as long as _onLadder stays true this tick (movement is fully
                // owned above) — this only matters for the tick AFTER dismounting, so beginStep's
                // dispatch sees WALK rather than a stale pre-mount state.
                this._moveState = FPSC.MOVE_WALK;
                this.groundNormal.set(ground.normal.x, ground.normal.y, ground.normal.z);
            }
        }
    }
    return true;
};


// ==== src/character/fps/Movement/Mantle.js ====
// Mantle: two-phase kinematic arc (lift, then vault) onto a ledge too tall to step onto.
var proto = FPSCharacterController.prototype;
var FPSC = FPSCharacterController.FPSC;
var raycast = FPSCharacterController._raycast;

/**
 * Probe forward for a near-vertical face, then down from the hit for its top surface.
 * @method _probeLedgeAhead
 * @private
 * @param {Number} dx
 * @param {Number} dz
 * @return {Object|null} { faceNormal, topPoint, topNormal, probeDx, probeDz }
 */
proto._probeLedgeAhead = function(dx, dz) {
    var dlen = Math.sqrt(dx * dx + dz * dz);
    if (dlen < FPSC.EPS_LEN) { return null; }
    dx /= dlen; dz /= dlen;

    var p = this.body.position;
    var feetY = p.y - this.height / 2;
    var headY = p.y + this.height / 2;

    var reach = this.width / 2 + this.mantleReach;
    // Probe at several heights so a ledge is found whether level, jumped above, or low.
    var probeHeights = [feetY + this.mantleHeight, p.y, feetY + this.stepHeight];

    for (var hi = 0; hi < probeHeights.length; hi++) {
        var probeY = probeHeights[hi];
        var fwdHit = raycast(
            this.world,
            new Vector3(p.x, probeY, p.z),
            new Vector3(p.x + dx * reach, probeY, p.z + dz * reach),
            this._ignoreSelf
        );
        if (!fwdHit) { continue; }
        if (Math.abs(fwdHit.normal.y) > FPSC.NY_GROUNDISH) { continue; } // not a near-vertical face

        var topProbeX = fwdHit.point.x + dx * this._skin;
        var topProbeZ = fwdHit.point.z + dz * this._skin;
        var scanTop = feetY + this.mantleHeight + this._skin;
        var scanBot = feetY + this.stepHeight + this._skin;
        if (scanTop <= scanBot) { continue; }

        // World.rayIntersect reports only the single NEAREST body along the down-probe. Walk past any
        // surface that doesn't belong to the grabbed face's own object (e.g. a ceiling or disconnected
        // surface above it) by adding each mismatched hit to the query's own `ignore` list and
        // re-querying, restoring the "skip past it, find the real one" behavior a single-hit query
        // can't give for free. This was a REAL, confirmed bug: a ledge with a low ceiling directly
        // above it (a common "duck under this, mantle that" layout) made the down-probe find the
        // ceiling's OWN surface first, discard it as a mismatch, and give up outright — reporting no
        // ledge top at all instead of the real one just below, indistinguishable from "no ledge here."
        var downIgnore = this._ghost ? [this.body, this._ghost] : [this.body];
        var downHit = null;
        for (var dtries = 0; dtries < 4; dtries++) {
            var dh = this.world.rayIntersect(
                new Vector3(topProbeX, scanTop, topProbeZ),
                new Vector3(topProbeX, scanBot, topProbeZ),
                downIgnore
            );
            if (!dh) { break; }
            if (dh.body === fwdHit.object && dh.normal.y >= FPSC.NY_FLOORLIKE) {
                downHit = { point: dh.point, normal: dh.normal, object: dh.body };
                break;
            }
            downIgnore.push(dh.body);
        }
        if (!downHit) { continue; }

        return {
            faceNormal: fwdHit.normal,
            topPoint: downHit.point,
            topNormal: downHit.normal,
            probeDx: dx,
            probeDz: dz
        };
    }
    return null;
};

/**
 * Mantle state machine, mirrors _updateLadder's contract. Called once per beginStep before the
 * main dispatch; returns true while the arc owns the tick.
 * @method _updateMantle
 * @private
 * @param {Object} cmd
 * @param {Number} moveYaw
 * @param {Number} dt
 * @return {Boolean}
 */
proto._updateMantle = function(cmd, moveYaw, dt) {
    var gb = this.body.linear_velocity;
    var p = this.body.position;

    // Active arc: drives position directly (bypasses _collideAndSlide, which would otherwise
    // treat the grabbed face as a blocking wall).
    if (this._mantleActive) {
        this._mantleTimer += dt;
        var total = this.mantleDuration;
        var liftEnd = total * this.mantleLiftFrac;
        var frac = Math.min(1, this._mantleTimer / total);

        var newX, newY, newZ;
        if (this._mantleTimer <= liftEnd) {
            var liftFrac = Math.min(1, this._mantleTimer / Math.max(liftEnd, FPSC.EPS_LEN));
            newX = this._mantleStartX;
            newZ = this._mantleStartZ;
            newY = this._mantleStartY + (this._mantleTopBodyY - this._mantleStartY) * liftFrac;
        } else {
            var vaultFrac = Math.min(1, (this._mantleTimer - liftEnd) / Math.max(total - liftEnd, FPSC.EPS_LEN));
            newX = this._mantleStartX + (this._mantleLandX - this._mantleStartX) * vaultFrac;
            newZ = this._mantleStartZ + (this._mantleLandZ - this._mantleStartZ) * vaultFrac;
            newY = this._mantleTopBodyY;
        }

        gb.x = 0; gb.y = 0; gb.z = 0;
        this.body.position.set(newX, newY, newZ);
        this.body.updateDerived();

        var done = frac >= 1;
        if (done) {
            this._mantleActive = false;
            this._mantleTimer = 0;
            this._moveState = FPSC.MOVE_AIRBORNE;
            this.body.setGravity(this._gravityVec.x, this._gravityVec.y, this._gravityVec.z);
            gb.x = 0; gb.y = 0; gb.z = 0;
            return false; // release to normal dispatch this tick so endStep can land us
        }

        return true;
    }

    // Detection: only on an explicit tap.
    if (!cmd.mantle) { return false; }

    var fwd = this.getForwardHorizontal(moveYaw);
    var ledge = this._probeLedgeAhead(fwd.x, fwd.z);
    if (!ledge) { return false; }

    var feetY = p.y - this.height / 2;
    var rise = ledge.topPoint.y - feetY;

    if (rise <= this.stepHeight + this._skin) { return false; } // step-up handles it
    if (rise > this.mantleHeight) { return false; } // out of reach
    // Above chest height, a grounded tap is refused — must already be airborne to grab it.
    var chestHeight = this.standHeight * FPSC.MANTLE_CHEST_HEIGHT_FRAC;
    if (rise > chestHeight && this.grounded) { return false; }

    // Landing point: advance from the grab point past the face by the character's own depth,
    // stepping back toward the face if that overshoots a shallow ledge, until solid standable
    // ground is found.
    var dx = ledge.probeDx, dz = ledge.probeDz;
    var topBodyY = ledge.topPoint.y + this.height / 2;
    var desiredAdvance = this.depth;
    var landX = p.x, landZ = p.z, landFound = false;
    var steps = 4;
    for (var s = steps; s >= 1; s--) {
        var advance = desiredAdvance * (s / steps);
        var tryX = ledge.topPoint.x + dx * advance;
        var tryZ = ledge.topPoint.z + dz * advance;
        var landHit = raycast(
            this.world,
            new Vector3(tryX, topBodyY, tryZ),
            new Vector3(tryX, ledge.topPoint.y - this._skin - this.mantleHeight, tryZ),
            this._ignoreSelf
        );
        if (landHit && landHit.normal.y >= FPSC.NY_FLOORLIKE &&
            Math.abs(landHit.point.y - ledge.topPoint.y) < this.stepHeight + this._skin) {
            landX = tryX; landZ = tryZ; landFound = true;
            break;
        }
    }
    if (!landFound) { return false; }

    // The arc drives position directly, so nothing else checks headroom along the way — verify
    // both the grab point and the landing point can stand up.
    var clearanceAtGrab = this._ceilingClearanceAt(p.x, p.z, ledge.topPoint.y);
    if (clearanceAtGrab < this.standHeight - this._skin) { return false; }
    var clearanceAtLand = this._ceilingClearanceAt(landX, landZ, ledge.topPoint.y);
    if (clearanceAtLand < this.standHeight - this._skin) { return false; }

    this._mantleActive = true;
    this._mantleTimer = 0;
    this._mantleStartX = p.x;
    this._mantleStartY = p.y;
    this._mantleStartZ = p.z;
    this._mantleTopBodyY = topBodyY;
    this._mantleLandX = landX;
    this._mantleLandZ = landZ;

    this._moveState = FPSC.MOVE_MANTLE;
    this.grounded = false;
    this._groundSuppress = FPSC.GROUND_SUPPRESS_JUMP;
    this._jumpRising = true;
    this.body.setGravity(0, 0, 0);
    gb.x = 0; gb.y = 0; gb.z = 0;

    return true;
};


// ==== src/outro.js ====
    // Every math class came from the host, so exactly one set is live in the page.
    ActionPhysics.usingHostMath = !!(host.Vector3 && host.Quaternion && host.Matrix4 && host.Scalar);

    return ActionPhysics;
}));
