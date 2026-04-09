// actionengine/math/physics/actioncircleshape2d.js
/**
 * ActionCircleShape2D — Circle collider.
 * Defined by a radius. Centroid is always at (0,0) in local space.
 */
class ActionCircleShape2D extends ActionShape2D {
    /**
     * @param {number} radius
     */
    constructor(radius) {
        super(ActionShapeType2D.CIRCLE);
        this.radius = radius;
    }

    computeAABB(position, angle) {
        return new ActionAABB2D(
            position.x - this.radius,
            position.y - this.radius,
            position.x + this.radius,
            position.y + this.radius
        );
    }

    computeInertia(mass) {
        // I = (1/2) m r²
        return 0.5 * mass * this.radius * this.radius;
    }

    computeArea() {
        return Math.PI * this.radius * this.radius;
    }
}
