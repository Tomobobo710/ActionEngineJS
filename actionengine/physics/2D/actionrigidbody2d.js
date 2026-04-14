// actionengine/math/physics/actionrigidbody2D.js
/**
 * ActionRigidBody2D — A 2D rigid body with mass, inertia, linear/angular
 * velocity, force/torque accumulators, and damping.
 *
 * Body types (following Box2D conventions):
 *   'dynamic'    — fully simulated (mass > 0)
 *   'static'     — immovable (infinite mass)
 *   'kinematic'  — moved by code, not by forces (infinite mass, can have velocity)
 *
 * The shape defines the collider geometry.
 * Mass properties are computed from shape area × density, or set explicitly.
 */
class ActionRigidBody2D {
    static _nextId = 0;

    /**
     * @param {ActionShape2D} shape
     * @param {Object} options
     * @param {string}  options.type           - 'dynamic' | 'static' | 'kinematic' (default 'dynamic')
     * @param {number}  options.density        - kg per unit² (default 1). Ignored for static/kinematic.
     * @param {number}  options.restitution    - bounciness 0..1 (default 0.2)
     * @param {number}  options.friction       - coulomb friction coefficient (default 0.3)
     * @param {number}  options.linearDamping  - velocity damping per second (default 0.01)
     * @param {number}  options.angularDamping - angular velocity damping per second (default 0.01)
     * @param {number}  options.gravityScale   - multiplier on world gravity (default 1)
     * @param {boolean} options.fixedRotation  - lock rotation (default false)
     * @param {boolean} options.isBullet       - enable CCD for this body (default false)
     * @param {number}  options.x              - initial x position
     * @param {number}  options.y              - initial y position
     * @param {number}  options.angle          - initial angle in radians
     */
    constructor(shape, options = {}) {
        this.id = ActionRigidBody2D._nextId++;
        this.shape = shape;
        this.type = options.type || 'dynamic';

        // Transform
        this.position = new Vector2(options.x || 0, options.y || 0);
        this.angle = options.angle || 0;

        // Previous transform (for visual interpolation)
        this.prevPosition = new Vector2(options.x || 0, options.y || 0);
        this.prevAngle = options.angle || 0;

        // Velocity
        this.linearVelocity = new Vector2(0, 0);
        this.angularVelocity = 0;

        // Force / torque accumulators (cleared each step)
        this.force = new Vector2(0, 0);
        this.torque = 0;

        // Material
        this.restitution = options.restitution !== undefined ? options.restitution : PhysicsConstants2D.BODY_DEFAULT_RESTITION;
        this.friction = options.friction !== undefined ? options.friction : PhysicsConstants2D.BODY_DEFAULT_FRICTION;

        // Damping
        this.linearDamping = options.linearDamping !== undefined ? options.linearDamping : PhysicsConstants2D.BODY_DEFAULT_LINEAR_DAMPING;
        this.angularDamping = options.angularDamping !== undefined ? options.angularDamping : PhysicsConstants2D.BODY_DEFAULT_ANGULAR_DAMPING;

        // Gravity
        this.gravityScale = options.gravityScale !== undefined ? options.gravityScale : PhysicsConstants2D.BODY_DEFAULT_GRAVITY_SCALE;

        // Rotation lock
        this.fixedRotation = options.fixedRotation || false;

        // Sleep system — body goes to sleep when velocity is below threshold for long enough
        this.isAwake = true;
        this.sleepTimer = 0;
        this.sleepThresholdLinear = options.sleepThresholdLinear !== undefined ? options.sleepThresholdLinear : PhysicsConstants2D.BODY_DEFAULT_SLEEP_THRESHOLD_LINEAR;
        this.sleepThresholdAngular = options.sleepThresholdAngular !== undefined ? options.sleepThresholdAngular : PhysicsConstants2D.BODY_DEFAULT_SLEEP_THRESHOLD_ANGULAR;
        this.sleepTimeRequired = options.sleepTimeRequired !== undefined ? options.sleepTimeRequired : PhysicsConstants2D.BODY_DEFAULT_SLEEP_TIME_REQUIRED;

        // Collision filtering
        this.categoryBits = options.categoryBits || PhysicsConstants2D.BODY_DEFAULT_CATEGORY_BITS;
        this.maskBits = options.maskBits || PhysicsConstants2D.BODY_DEFAULT_MASK_BITS;

        // User data — attach whatever you want
        this.userData = options.userData || null;

        // Contact tracking - for deduplicating onContactStart
        this._currentContacts = new Set(); // Set of body IDs currently in contact
        this._lastFrameContacts = new Set(); // Set of body IDs in contact last frame

        // Compute mass properties
        if (this.type === 'dynamic') {
            const density = options.density !== undefined ? options.density : PhysicsConstants2D.BODY_DEFAULT_DENSITY;
            const area = shape.computeArea();
            this.mass = area * density;
            this.invMass = this.mass > 0 ? 1 / this.mass : 0;
            this.inertia = shape.computeInertia(this.mass);
            this.invInertia = (this.inertia > 0 && !this.fixedRotation) ? 1 / this.inertia : 0;
        } else {
            this.mass = 0;
            this.invMass = 0;
            this.inertia = 0;
            this.invInertia = 0;
        }

        // AABB cache
        this._aabb = new ActionAABB2D();
        this._aabbDirty = true;
    }

    /**
     * Get the current world-space AABB (cached, rebuilt when dirty).
     * @returns {ActionAABB2D}
     */
    getAABB() {
        if (this._aabbDirty) {
            const computed = this.shape.computeAABB(this.position, this.angle);
            const skin = PhysicsConstants2D.SKIN_THICKNESS;
            this._aabb.minX = computed.minX - skin;
            this._aabb.minY = computed.minY - skin;
            this._aabb.maxX = computed.maxX + skin;
            this._aabb.maxY = computed.maxY + skin;
            this._aabbDirty = false;
        }
        return this._aabb;
    }

    /**
     * Mark the AABB as needing recomputation.
     */
    invalidateAABB() {
        this._aabbDirty = true;
    }

    // ---- Force / impulse API ----

    applyForce(forceX, forceY) {
        if (this.type !== 'dynamic') return;
        this.force.x += forceX;
        this.force.y += forceY;
        this.wake();
    }

    applyForceAtPoint(forceX, forceY, worldPointX, worldPointY) {
        if (this.type !== 'dynamic') return;
        this.force.x += forceX;
        this.force.y += forceY;
        const rx = worldPointX - this.position.x;
        const ry = worldPointY - this.position.y;
        this.torque += rx * forceY - ry * forceX;
        this.wake();
    }

    applyTorque(torque) {
        if (this.type !== 'dynamic') return;
        this.torque += torque;
        this.wake();
    }

    applyImpulse(impulseX, impulseY) {
        if (this.type !== 'dynamic') return;
        this.linearVelocity.x += impulseX * this.invMass;
        this.linearVelocity.y += impulseY * this.invMass;
        this.wake();
    }

    applyImpulseAtPoint(impulseX, impulseY, worldPointX, worldPointY) {
        if (this.type !== 'dynamic') return;
        this.linearVelocity.x += impulseX * this.invMass;
        this.linearVelocity.y += impulseY * this.invMass;
        const rx = worldPointX - this.position.x;
        const ry = worldPointY - this.position.y;
        this.angularVelocity += this.invInertia * (rx * impulseY - ry * impulseX);
        this.isAwake = true;
    }

    applyAngularImpulse(impulse) {
        if (this.type !== 'dynamic') return;
        this.angularVelocity += impulse * this.invInertia;
        this.isAwake = true;
    }

    // ---- Integration (called by the world) ----

    integrateForces(dt, gravityX, gravityY) {
        if (this.type !== 'dynamic') return;
        if (!this.isAwake) return;

        // Semi-implicit Euler: update velocity from forces + gravity
        this.linearVelocity.x += (this.force.x * this.invMass + gravityX * this.gravityScale) * dt;
        this.linearVelocity.y += (this.force.y * this.invMass + gravityY * this.gravityScale) * dt;
        this.angularVelocity += this.torque * this.invInertia * dt;

        // Apply damping: v *= 1 / (1 + dt * damping)  (stable for large dt)
        this.linearVelocity.x *= 1 / (1 + dt * this.linearDamping);
        this.linearVelocity.y *= 1 / (1 + dt * this.linearDamping);
        this.angularVelocity *= 1 / (1 + dt * this.angularDamping);
    }

    /**
     * Check if this body should go to sleep or wake up.
     * Called by the world after solving.
     */
    updateSleep(dt) {
        if (this.type !== 'dynamic') return;

        const speedSq = this.linearVelocity.lengthSquared();
        const angSpeed = Math.abs(this.angularVelocity);
        const linThreshSq = this.sleepThresholdLinear * this.sleepThresholdLinear;

        if (speedSq > linThreshSq || angSpeed > this.sleepThresholdAngular) {
            this.sleepTimer = 0;
            this.isAwake = true;
        } else {
            this.sleepTimer += dt;
            if (this.sleepTimer >= this.sleepTimeRequired) {
                this.isAwake = false;
                this.linearVelocity.set(0, 0);
                this.angularVelocity = 0;
            }
        }
    }

    /**
     * Wake this body up (called when a collision or force is applied).
     */
    wake() {
        this.isAwake = true;
        this.sleepTimer = 0;
    }

    integrateVelocity(dt) {
        if (this.type === 'static') return;
        if (!this.isAwake) return;

        // Save previous state for interpolation
        this.prevPosition.copy(this.position);
        this.prevAngle = this.angle;

        this.position.x += this.linearVelocity.x * dt;
        this.position.y += this.linearVelocity.y * dt;
        this.angle += this.angularVelocity * dt;
        this._aabbDirty = true;
    }

    /**
     * Get interpolated position/angle for visual rendering between physics steps.
     * @param {number} alpha - interpolation factor (0 = previous state, 1 = current state)
     * @returns {{ x: number, y: number, angle: number }}
     */
    getInterpolatedState(alpha) {
        return {
            x: this.prevPosition.x + (this.position.x - this.prevPosition.x) * alpha,
            y: this.prevPosition.y + (this.position.y - this.prevPosition.y) * alpha,
            angle: this.prevAngle + (this.angle - this.prevAngle) * alpha
        };
    }

    clearForces() {
        this.force.x = 0;
        this.force.y = 0;
        this.torque = 0;
    }

    // ---- Utility ----

    setPosition(x, y) {
        this.position.x = x;
        this.position.y = y;
        this._aabbDirty = true;
    }

    setAngle(angle) {
        this.angle = angle;
        this._aabbDirty = true;
    }

    setLinearVelocity(vx, vy) {
        this.linearVelocity.x = vx;
        this.linearVelocity.y = vy;
    }

    setAngularVelocity(av) {
        this.angularVelocity = av;
    }

    getSpeed() {
        return this.linearVelocity.length();
    }

    /**
     * Get the velocity of a world point on the body (includes angular contribution).
     */
    getPointVelocity(worldX, worldY) {
        const rx = worldX - this.position.x;
        const ry = worldY - this.position.y;
        return new Vector2(
            this.linearVelocity.x - this.angularVelocity * ry,
            this.linearVelocity.y + this.angularVelocity * rx
        );
    }
    
    // ---- Contact Callbacks (Body-level collision detection) ----
    
    /**
     * Register a callback for when this body starts touching another
     * Fires every frame while in contact
     * @param {Function} callback - Called with (otherBody, contactPoints, manifold)
     */
    onContact(callback) {
        if (!this._contactListeners) {
            this._contactListeners = [];
        }
        this._contactListeners.push(callback);
    }
    
    /**
     * Register a callback that fires ONCE when contact begins
     * @param {Function} callback - Called with (otherBody, contactPoints, manifold)
     */
    onContactStart(callback) {
        if (!this._contactStartListeners) {
            this._contactStartListeners = [];
        }
        this._contactStartListeners.push(callback);
    }
    
    /**
     * Register a callback for when this body stops touching another
     * @param {Function} callback - Called with (otherBody)
     */
    onContactEnd(callback) {
        if (!this._contactEndListeners) {
            this._contactEndListeners = [];
        }
        this._contactEndListeners.push(callback);
    }
    
    /**
     * Internal: Invoke contact callbacks for this body (fires every frame in contact)
     * Called by physics world during collision detection
     * @private
     */
    _invokeContact(otherBody, contactPoints, manifold) {
        if (this._contactListeners) {
            for (let i = 0; i < this._contactListeners.length; i++) {
                this._contactListeners[i](otherBody, contactPoints, manifold);
            }
        }
    }
    
    /**
     * Internal: Invoke contact start callbacks (fires once per contact pair)
     * Called by physics world when contact first begins
     * @private
     */
    _invokeContactStart(otherBody, contactPoints, manifold) {
        // Only fire if this is a NEW contact (not in contact last frame)
        if (!this._lastFrameContacts.has(otherBody.id)) {
            if (this._contactStartListeners) {
                for (let i = 0; i < this._contactStartListeners.length; i++) {
                    this._contactStartListeners[i](otherBody, contactPoints, manifold);
                }
            }
        }
    }
    
    /**
     * Internal: Update contact state for deduplication
     * Called at the start of each physics frame
     * @private
     */
    _updateContactState() {
        this._lastFrameContacts = new Set(this._currentContacts);
        this._currentContacts.clear();
    }
    
    /**
     * Internal: Register a contact with another body
     * @private
     */
    _addContact(otherBodyId) {
        this._currentContacts.add(otherBodyId);
    }
    
    /**
     * Internal: Invoke contact end callbacks for this body
     * Called by physics world when contact ends
     * @private
     */
    _invokeContactEnd(otherBody) {
        if (this._contactEndListeners) {
            for (let i = 0; i < this._contactEndListeners.length; i++) {
                this._contactEndListeners[i](otherBody);
            }
        }
    }
}
