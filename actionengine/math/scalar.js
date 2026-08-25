//actionengine/math/scalar.js
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
