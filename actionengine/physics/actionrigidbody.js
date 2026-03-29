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
