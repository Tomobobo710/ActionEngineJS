// actionengine/math/physics/actionmanifold2D.js
/**
 * ActionContactPoint2D — A single contact point in a manifold.
 */
class ActionContactPoint2D {
    constructor() {
        this.localPointA = new Vector2(0, 0);  // contact in A's local space
        this.localPointB = new Vector2(0, 0);  // contact in B's local space
        this.worldPoint = new Vector2(0, 0);   // world-space contact
        this.penetration = 0;                   // overlap depth (positive = overlapping)
        this.normalImpulse = 0;                 // accumulated normal impulse (warm starting)
        this.tangentImpulse = 0;                // accumulated friction impulse (warm starting)
    }
}

/**
 * ActionManifold2D — Contact manifold between two bodies.
 * Contains up to 2 contact points (edge contacts for box-box).
 *
 * The normal always points from body A toward body B.
 */
class ActionManifold2D {
    constructor(bodyA, bodyB) {
        this.bodyA = bodyA;
        this.bodyB = bodyB;
        this.normal = new Vector2(0, 0);  // collision normal (A → B)
        this.contacts = [];                // ActionContactPoint2D[]
        this.friction = 0;
        this.restitution = 0;
    }

    /**
     * Initialize material mixing from the two bodies.
     * Box2D uses geometric mean for friction, max for restitution.
     */
    computeMaterialProperties() {
        this.friction = Math.sqrt(this.bodyA.friction * this.bodyB.friction);
        this.restitution = Math.max(this.bodyA.restitution, this.bodyB.restitution);
    }
}
