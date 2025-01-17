// actionengine/math/mathutils.js
class MathUtils {
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    static lerp(start, end, t) {
        return start + (end - start) * t;
    }

    static sign(p, v1, v2) {
        return (p.x - v2.x) * (v1.z - v2.z) - (v1.x - v2.x) * (p.z - v2.z);
    }
}

class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }
    
    next() {
        this.seed = (this.seed * 16807) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }
}