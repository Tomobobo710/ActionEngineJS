// actionengine/math/physics/actionshape2d.js
/**
 * ActionShape2D — Base class for 2D collision shapes.
 * 
 * ShapeType enum:
 *   0 = CIRCLE
 *   1 = BOX (oriented bounding box)
 *
 * Every shape must be able to:
 *   - compute its AABB given a position and rotation
 *   - compute its mass properties (area → mass, moment of inertia)
 */

const ActionShapeType2D = {
    CIRCLE: 0,
    BOX: 1
};

class ActionShape2D {
    constructor(type) {
        this.type = type;
    }

    /**
     * Compute world-space AABB for this shape at given position/angle.
     * @param {Vector2} position
     * @param {number} angle
     * @returns {ActionAABB2D}
     */
    computeAABB(position, angle) {
        return new ActionAABB2D(position.x, position.y, position.x, position.y);
    }

    /**
     * Compute moment of inertia about the centroid for a given mass.
     * @param {number} mass
     * @returns {number}
     */
    computeInertia(mass) {
        return 0;
    }

    /**
     * Get the area of the shape (used for density → mass).
     * @returns {number}
     */
    computeArea() {
        return 0;
    }
}
