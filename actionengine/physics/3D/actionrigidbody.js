//actionengine/physics/actionrigidbody.js

/**
 * ActionRigidBody - Engine-level physics body
 * 
 * Wraps Goblin.RigidBody and exposes a clean API.
 * Handles mass, forces, velocities, damping, and contact callbacks.
 */
class ActionRigidBody {
    /**
     * Create a rigid body from a shape or wrap an existing body
     * @param {Object} shapeOrBody - Physics shape (box, sphere, mesh) or existing body
     * @param {number} mass - Body mass (default: 1). Use Infinity for static. Ignored if wrapping existing body.
     */
    constructor(shapeOrBody, mass = 1) {
        if (!shapeOrBody) {
            throw new Error("[ActionRigidBody] Physics shape or body is required");
        }
        
        // Check if this is already a body (has _mass property) or a shape
        if (shapeOrBody._mass !== undefined) {
            // Wrapping existing body
            this._body = shapeOrBody;
        } else {
            // Creating new body from shape
            this._body = new Goblin.RigidBody(shapeOrBody, mass);
            this._body.linear_damping = 0.01;
            this._body.angular_damping = 0.01;
        }
    }
    
    /**
     * Get the underlying Goblin body
     */
    get goblinBody() {
        return this._body;
    }
    
    // === Mass & Static ===
    
    get mass() {
        return this._body._mass;
    }
    
    set mass(value) {
        if (value === Infinity) {
            this._body._mass = Infinity;
            this._body._mass_inverted = 0;
        } else {
            this._body._mass = value;
            this._body._mass_inverted = 1 / value;
            this._body.inertiaTensor = this._body.shape.getInertiaTensor(value);
        }
    }
    
    get isStatic() {
        return this._body._mass === Infinity;
    }
    
    set isStatic(value) {
        this.mass = value ? Infinity : 1;
    }
    
    // === Transform ===
    
    get position() {
        return this._body.position;
    }
    
    set position(value) {
        this._body.position.x = value.x;
        this._body.position.y = value.y;
        this._body.position.z = value.z;
        this._body.updateDerived();
    }
    
    get rotation() {
        return this._body.rotation;
    }
    
    set rotation(value) {
        this._body.rotation.x = value.x;
        this._body.rotation.y = value.y;
        this._body.rotation.z = value.z;
        this._body.rotation.w = value.w;
        this._body.updateDerived();
    }
    
    // === Velocity ===
    
    get linearVelocity() {
        return this._body.linear_velocity;
    }
    
    set linearVelocity(value) {
        this._body.linear_velocity.x = value.x;
        this._body.linear_velocity.y = value.y;
        this._body.linear_velocity.z = value.z;
    }
    
    get angularVelocity() {
        return this._body.angular_velocity;
    }
    
    set angularVelocity(value) {
        this._body.angular_velocity.x = value.x;
        this._body.angular_velocity.y = value.y;
        this._body.angular_velocity.z = value.z;
    }
    
    // === Damping ===
    
    get linearDamping() {
        return this._body.linear_damping;
    }
    
    set linearDamping(value) {
        this._body.linear_damping = value;
    }
    
    get angularDamping() {
        return this._body.angular_damping;
    }
    
    set angularDamping(value) {
        this._body.angular_damping = value;
    }
    
    // === Physics Material ===
    
    get friction() {
        return this._body.friction;
    }
    
    set friction(value) {
        this._body.friction = value;
    }
    
    get restitution() {
        return this._body.restitution;
    }
    
    set restitution(value) {
        this._body.restitution = value;
    }
    
    // === Forces ===
    
    /**
     * Get accumulated force (will be applied in next integration)
     * Access individual axes: accumulatedForce.x, .y, .z
     */
    get accumulatedForce() {
        return this._body.accumulated_force;
    }
    
    /**
     * Set accumulated force
     * @param {Vector3} value - Force vector to set
     */
    set accumulatedForce(value) {
        this._body.accumulated_force.x = value.x;
        this._body.accumulated_force.y = value.y;
        this._body.accumulated_force.z = value.z;
    }
    
    /**
     * Get accumulated torque (will be applied in next integration)
     * Access individual axes: accumulatedTorque.x, .y, .z
     */
    get accumulatedTorque() {
        return this._body.accumulated_torque;
    }
    
    /**
     * Set accumulated torque
     * @param {Vector3} value - Torque vector to set
     */
    set accumulatedTorque(value) {
        this._body.accumulated_torque.x = value.x;
        this._body.accumulated_torque.y = value.y;
        this._body.accumulated_torque.z = value.z;
    }
    
    /**
     * Apply a force at the body's center of mass
     * @param {Vector3} force - Force to apply
     */
    applyForce(force) {
        this._body.applyForce(force);
    }
    
    /**
     * Apply an impulse (instant velocity change)
     * @param {Vector3} impulse - Impulse to apply
     */
    applyImpulse(impulse) {
        this._body.applyImpulse(impulse);
    }
    
    /**
     * Apply force at a point in world space
     * @param {Vector3} force - Force to apply
     * @param {Vector3} worldPoint - World position where force originates
     */
    applyForceAtWorldPoint(force, worldPoint) {
        this._body.applyForceAtWorldPoint(force, worldPoint);
    }
    
    /**
     * Apply force at a point in local space
     * @param {Vector3} force - Force to apply
     * @param {Vector3} localPoint - Local position where force originates
     */
    applyForceAtLocalPoint(force, localPoint) {
        this._body.applyForceAtLocalPoint(force, localPoint);
    }
    
    // === Utility ===
    
    /**
     * Get custom gravity for this body (null if using world gravity)
     * @returns {Vector3|null}
     */
    get gravity() {
        return this._body.gravity;
    }
    
    /**
     * Set custom gravity for this body (overrides world gravity)
     * @param {Vector3} gravity - Custom gravity vector
     */
    setGravity(gravity) {
        this._body.setGravity(gravity.x, gravity.y, gravity.z);
    }
    
    /**
     * Check if this body is sleeping (optimization)
     * @returns {boolean}
     */
    isSleeping() {
        return this._body.linear_velocity.length() < 0.01 && 
               this._body.angular_velocity.length() < 0.01;
    }
    
    // === Collision & Layers ===
    
    /**
     * Get bitmask of collision groups this body belongs to
     */
    get collisionGroups() {
        return this._body.collision_groups;
    }
    
    /**
     * Set bitmask of collision groups this body belongs to
     */
    set collisionGroups(value) {
        this._body.collision_groups = value;
    }
    
    /**
     * Get collision mask (which groups to collide with)
     */
    get collisionMask() {
        return this._body.collision_mask;
    }
    
    /**
     * Set collision mask (which groups to collide with)
     */
    set collisionMask(value) {
        this._body.collision_mask = value;
    }
    
    // === Per-Axis Control ===
    
    /**
     * Get per-axis linear movement multiplier (Vector3)
     */
    get linearFactor() {
        return this._body.linear_factor;
    }
    
    /**
     * Set per-axis linear movement multiplier (Vector3)
     */
    set linearFactor(value) {
        this._body.linear_factor.x = value.x;
        this._body.linear_factor.y = value.y;
        this._body.linear_factor.z = value.z;
    }
    
    /**
     * Get per-axis angular movement multiplier (Vector3)
     */
    get angularFactor() {
        return this._body.angular_factor;
    }
    
    /**
     * Set per-axis angular movement multiplier (Vector3)
     */
    set angularFactor(value) {
        this._body.angular_factor.x = value.x;
        this._body.angular_factor.y = value.y;
        this._body.angular_factor.z = value.z;
    }
    
    // === Body Data ===
    
    /**
     * Get the physics shape
     */
    get shape() {
        return this._body.shape;
    }
    
    /**
     * Get the unique Goblin ID for this body
     */
    get id() {
        return this._body.id;
    }
    
    /**
     * Get the axis-aligned bounding box
     */
    get aabb() {
        return this._body.aabb;
    }
    
    /**
     * Get current acceleration
     */
    get acceleration() {
        return this._body.acceleration;
    }
    
    /**
     * Get the physics world this body belongs to
     */
    get world() {
        return this._body.world;
    }
    
    // === Velocity Queries ===
    
    /**
     * Get velocity at a specific point in local space
     * @param {Vector3} point - Point in local coordinates
     * @param {Vector3} out - Output vector for velocity
     * @returns {Vector3} The output vector
     */
    getVelocityInLocalPoint(point, out) {
        return this._body.getVelocityInLocalPoint(point, out);
    }
    
    // === Physics Queries ===
    
    /**
     * Find the point on this body that is most extreme in a given direction
     * @param {Vector3} direction - Direction to search
     * @param {Vector3} supportPoint - Output vector to store result
     */
    findSupportPoint(direction, supportPoint) {
        return this._body.findSupportPoint(direction, supportPoint);
    }
    
    /**
     * Check if a ray segment intersects this body
     * @param {Vector3} rayStart - Start point of ray segment
     * @param {Vector3} rayEnd - End point of ray segment
     * @param {Array} intersectionList - Array to append intersection results to
     */
    rayIntersect(rayStart, rayEnd, intersectionList) {
        return this._body.rayIntersect(rayStart, rayEnd, intersectionList);
    }
    
    // === Contact Callbacks ===
    
    /**
     * Register callback for when this body starts touching another
     * @param {Function} callback - Called with (otherBody, contact)
     */
    onContact(callback) {
        this._body.addListener('contact', callback);
    }
    
    /**
     * Register callback for when this body stops touching another
     * @param {Function} callback - Called with (otherBody)
     */
    onContactEnd(callback) {
        this._body.addListener('endContact', callback);
    }
    
    /**
     * Internal: Invoke collision callbacks
     * Called by physics world during collision detection
     * @private
     */
    _invokeCollisionEnter(otherBody, contact) {
        if (typeof this.onCollisionEnter === 'function') {
            this.onCollisionEnter(otherBody, contact);
        }
    }
    
    _invokeCollisionStay(otherBody, contact) {
        if (typeof this.onCollisionStay === 'function') {
            this.onCollisionStay(otherBody, contact);
        }
    }
    
    _invokeCollisionExit(otherBody) {
        if (typeof this.onCollisionExit === 'function') {
            this.onCollisionExit(otherBody);
        }
    }
}
