// actionengine/math/vector2.js
class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    // Static creation methods
    static create(x = 0, y = 0) {
        return new Vector2(x, y);
    }

    static fromAngle(angle) {
        return new Vector2(Math.cos(angle), Math.sin(angle));
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
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
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
        return Math.atan2(this.y, this.x);
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
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
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
        return Math.atan2(b.y - a.y, b.x - a.x);
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