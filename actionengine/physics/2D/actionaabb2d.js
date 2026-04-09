// actionengine/math/physics/actionaabb2d.js
/**
 * ActionAABB2D - Axis-Aligned Bounding Box for 2D broadphase
 * Lightweight rect used for spatial queries and overlap tests.
 */
class ActionAABB2D {
    constructor(minX = 0, minY = 0, maxX = 0, maxY = 0) {
        this.minX = minX;
        this.minY = minY;
        this.maxX = maxX;
        this.maxY = maxY;
    }

    get width() {
        return this.maxX - this.minX;
    }

    get height() {
        return this.maxY - this.minY;
    }

    get centerX() {
        return (this.minX + this.maxX) * 0.5;
    }

    get centerY() {
        return (this.minY + this.maxY) * 0.5;
    }

    set(minX, minY, maxX, maxY) {
        this.minX = minX;
        this.minY = minY;
        this.maxX = maxX;
        this.maxY = maxY;
        return this;
    }

    copy(other) {
        this.minX = other.minX;
        this.minY = other.minY;
        this.maxX = other.maxX;
        this.maxY = other.maxY;
        return this;
    }

    clone() {
        return new ActionAABB2D(this.minX, this.minY, this.maxX, this.maxY);
    }

    expand(margin) {
        this.minX -= margin;
        this.minY -= margin;
        this.maxX += margin;
        this.maxY += margin;
        return this;
    }

    expandToClone(margin) {
        return new ActionAABB2D(
            this.minX - margin,
            this.minY - margin,
            this.maxX + margin,
            this.maxY + margin
        );
    }

    merge(other) {
        this.minX = Math.min(this.minX, other.minX);
        this.minY = Math.min(this.minY, other.minY);
        this.maxX = Math.max(this.maxX, other.maxX);
        this.maxY = Math.max(this.maxY, other.maxY);
        return this;
    }

    overlaps(other) {
        return this.maxX >= other.minX && this.minX <= other.maxX &&
               this.maxY >= other.minY && this.minY <= other.maxY;
    }

    contains(px, py) {
        return px >= this.minX && px <= this.maxX &&
               py >= this.minY && py <= this.maxY;
    }

    perimeter() {
        return 2 * (this.width + this.height);
    }

    area() {
        return this.width * this.height;
    }

    /**
     * Swept AABB: merge this box at start with its displaced version.
     * Used for CCD broadphase — builds a bounding region covering the full motion.
     */
    static swept(aabb, dx, dy) {
        return new ActionAABB2D(
            Math.min(aabb.minX, aabb.minX + dx),
            Math.min(aabb.minY, aabb.minY + dy),
            Math.max(aabb.maxX, aabb.maxX + dx),
            Math.max(aabb.maxY, aabb.maxY + dy)
        );
    }
}
