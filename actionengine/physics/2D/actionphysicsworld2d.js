// actionengine/math/physics/actionphysicsworld2D.js
/**
 * ActionPhysicsWorld2D — The 2D physics world.
 *
 * Orchestrates the full simulation pipeline each step:
 *   1. Apply gravity and integrate forces → new velocities
 *   2. Broadphase: spatial hash generates candidate pairs
 *   3. Narrowphase: generate contact manifolds
 *   4. CCD: sweep bullet bodies, generate TOI manifolds
 *   5. Contact solver: pre-solve → warm start → velocity iterations
 *   6. Integrate velocities → new positions
 *   7. Position correction (Baumgarte)
 *   8. Clear force accumulators
 *
 * Follows ActionPhysicsWorld3D's API conventions: addObject/removeObject,
 * fixed_update(dt), pause/resume/reset.
 */
class ActionPhysicsWorld2D {
    /**
     * @param {Object} options
     * @param {number}  [options.gravityX]                    - horizontal gravity (default: PhysicsConstants2D.GRAVITY_X)
     * @param {number}  [options.gravityY]                    - vertical gravity (default: PhysicsConstants2D.GRAVITY_Y)
     * @param {number}  [options.velocityIterations]          - solver velocity iterations (default: PhysicsConstants2D.VELOCITY_ITERATIONS)
     * @param {number}  [options.positionIterations]          - solver position iterations (default: PhysicsConstants2D.POSITION_ITERATIONS)
     * @param {number}  [options.broadphaseCellSize]          - spatial hash cell size (default: PhysicsConstants2D.BROADPHASE_CELL_SIZE)
     * @param {boolean} [options.enableCCD]                   - enable continuous collision detection (default true)
     * @param {number}  [options.baumgarte]                   - position correction factor (default: PhysicsConstants2D.BAUMGARTE)
     * @param {number}  [options.slop]                        - penetration slop (default: PhysicsConstants2D.SLOP)
     * @param {number}  [options.maxPositionCorrection]       - max position correction (default: PhysicsConstants2D.MAX_POSITION_CORRECTION)
     * @param {number}  [options.restitutionVelocityThreshold]- restitution velocity threshold (default: PhysicsConstants2D.RESTITUTION_VELOCITY_THRESHOLD)
     * @param {number}  [options.skinThickness]               - shape skin thickness (default: PhysicsConstants2D.SKIN_THICKNESS)
     * @param {boolean} [options.speculativeContactsEnabled]  - enable speculative contacts (default: PhysicsConstants2D.SPECULATIVE_CONTACTS_ENABLED)
     * @param {number}  [options.speculativeContactMultiplier]- speculative contact multiplier (default: PhysicsConstants2D.SPECULATIVE_CONTACT_MULTIPLIER)
     * @param {number}  [options.speculativeContactMaxDistance]- max speculative distance (default: PhysicsConstants2D.SPECULATIVE_CONTACT_MAX_DISTANCE)
     */
    constructor(options = {}) {
        this.gravityX = options.gravityX !== undefined ? options.gravityX : PhysicsConstants2D.GRAVITY_X;
        this.gravityY = options.gravityY !== undefined ? options.gravityY : PhysicsConstants2D.GRAVITY_Y;

        this.bodies = [];
        this.isPaused = false;

        // Sub-systems
        this.broadphase = new ActionBroadPhase2D(
            options.broadphaseCellSize !== undefined ? options.broadphaseCellSize : PhysicsConstants2D.BROADPHASE_CELL_SIZE
        );
        this.solver = new ActionContactSolver2D(
            options.velocityIterations !== undefined ? options.velocityIterations : PhysicsConstants2D.VELOCITY_ITERATIONS
        );

        // Override constants if provided
        if (options.restitutionVelocityThreshold !== undefined) {
            PhysicsConstants2D.RESTITUTION_VELOCITY_THRESHOLD = options.restitutionVelocityThreshold;
        }
        if (options.positionSlop !== undefined) {
            PhysicsConstants2D.POSITION_SLOP = options.positionSlop;
        }
        if (options.positionCorrectionRate !== undefined) {
            PhysicsConstants2D.POSITION_CORRECTION_RATE = options.positionCorrectionRate;
        }
        if (options.skinThickness !== undefined) {
            PhysicsConstants2D.SKIN_THICKNESS = options.skinThickness;
        }
        if (options.speculativeContactsEnabled !== undefined) {
            PhysicsConstants2D.SPECULATIVE_CONTACTS_ENABLED = options.speculativeContactsEnabled;
        }
        if (options.speculativeContactMultiplier !== undefined) {
            PhysicsConstants2D.SPECULATIVE_CONTACT_MULTIPLIER = options.speculativeContactMultiplier;
        }
        if (options.speculativeContactMaxDistance !== undefined) {
            PhysicsConstants2D.SPECULATIVE_CONTACT_MAX_DISTANCE = options.speculativeContactMaxDistance;
        }

        // Contact persistence for warm starting
        this._manifoldCache = new Map(); // pairKey → ActionManifold2D

        // Listeners
        this._contactListeners = [];

        // Debug / stats
        this.stats = {
            bodyCount: 0,
            dynamicCount: 0,
            sleepingCount: 0,
            pairCount: 0,
            contactCount: 0
        };
    }

    // ---- Body management ----

    addBody(body) {
        this.bodies.push(body);
        this.stats.bodyCount = this.bodies.length;
        return body;
    }

    removeBody(body) {
        const idx = this.bodies.indexOf(body);
        if (idx !== -1) {
            this.bodies.splice(idx, 1);
            this.stats.bodyCount = this.bodies.length;
        }
    }

    /**
     * Convenience: create and add a body in one call.
     */
    createBody(shape, options = {}) {
        const body = new ActionRigidBody2D(shape, options);
        this.addBody(body);
        return body;
    }

    // ---- Contact listeners ----

    /**
     * Register a callback: fn(manifold) called for each active contact.
     */
    onContact(fn) {
        this._contactListeners.push(fn);
    }

    // ---- Simulation step ----

    /**
     * Step the physics world by dt seconds.
     * Mirrors ActionPhysicsWorld3D's fixed_update(dt) pattern.
     *
     * @param {number} dt - fixed timestep (e.g. 1/60)
     */
    fixed_update(dt) {
            if (this.isPaused || dt <= 0) return;

            const bodies = this.bodies;

            // 0. Update contact state tracking for onContactStart deduplication
            for (let i = 0; i < bodies.length; i++) {
                bodies[i]._updateContactState();
            }

            // 1. Integrate forces (gravity, external forces → velocity)
            for (let i = 0; i < bodies.length; i++) {
                bodies[i].integrateForces(dt, this.gravityX, this.gravityY);
            }

            // 2. Broadphase
            const pairs = this.broadphase.generatePairs(bodies, dt);
            this.stats.pairCount = pairs.length;

            // 3. Narrowphase — generate manifolds
            const manifolds = [];
            for (let i = 0; i < pairs.length; i++) {
                const pair = pairs[i];
                const a = pair.bodyA;
                const b = pair.bodyB;

                // Skip if both bodies are asleep
                if (!a.isAwake && !b.isAwake) continue;

                const manifold = ActionNarrowPhase2D.detect(a, b, dt);
                if (manifold && manifold.contacts.length > 0) {
                    // Only wake sleeping bodies if the OTHER body is moving fast enough
                    // to matter. Resting contacts (body on static floor) should NOT wake.
                    const key = this._pairKey(a, b);
                    const isNewContact = !this._manifoldCache.has(key);

                    if (isNewContact) {
                        // New collision — wake both
                        if (a.type === 'dynamic') a.wake();
                        if (b.type === 'dynamic') b.wake();
                    } else {
                        // Persistent contact — only wake if the awake body has significant velocity
                        if (!a.isAwake && b.isAwake) {
                            const speedB = b.linearVelocity.lengthSquared();
                            if (speedB > a.sleepThresholdLinear * a.sleepThresholdLinear * 4) {
                                a.wake();
                            }
                        }
                        if (!b.isAwake && a.isAwake) {
                            const speedA = a.linearVelocity.lengthSquared();
                            if (speedA > b.sleepThresholdLinear * b.sleepThresholdLinear * 4) {
                                b.wake();
                            }
                        }
                    }

                    // Try to carry over accumulated impulses from previous frame (warm starting)
                    this._warmStartFromCache(manifold);
                    manifolds.push(manifold);
                }
            }

            this.stats.contactCount = manifolds.reduce((sum, m) => sum + m.contacts.length, 0);

            // 4. Solve velocity constraints
            if (manifolds.length > 0) {
                this.solver.preSolve(manifolds, dt);
                this.solver.warmStart(manifolds);
                this.solver.solveVelocity(manifolds);
                
                // Invoke continuous onContact callbacks (fire every frame)
                for (let m = 0; m < manifolds.length; m++) {
                    const manifold = manifolds[m];
                    // Also register contacts for persistent manifolds
                    manifold.bodyA._addContact(manifold.bodyB.id);
                    manifold.bodyB._addContact(manifold.bodyA.id);
                    
                    if (manifold.bodyA._invokeContact) {
                        manifold.bodyA._invokeContact(manifold.bodyB, manifold.contacts, manifold);
                    }
                    if (manifold.bodyB._invokeContact) {
                        manifold.bodyB._invokeContact(manifold.bodyA, manifold.contacts, manifold);
                    }
                }
            }

            // 5. Integrate velocities → positions
            for (let i = 0; i < bodies.length; i++) {
                bodies[i].integrateVelocity(dt);
            }

            // 6. Position correction with FRESH collision detection
            // Re-run narrowphase to get current penetration depths after integration
            const postIntegrationManifolds = [];
            for (let i = 0; i < pairs.length; i++) {
                const pair = pairs[i];
                const a = pair.bodyA;
                const b = pair.bodyB;
                if (!a.isAwake && !b.isAwake) continue;
                
                const manifold = ActionNarrowPhase2D.detect(a, b, dt);
                if (manifold && manifold.contacts.length > 0) {
                    postIntegrationManifolds.push(manifold);
                }
            }

            // Now correct positions using FRESH penetration data
            for (let m = 0; m < postIntegrationManifolds.length; m++) {
                const manifold = postIntegrationManifolds[m];
                const bodyA = manifold.bodyA;
                const bodyB = manifold.bodyB;
                const normal = manifold.normal;

                if (bodyA.invMass === 0 && bodyB.invMass === 0) continue;

                for (let c = 0; c < manifold.contacts.length; c++) {
                    const cp = manifold.contacts[c];
                    
                    // Only correct if penetration exceeds slop threshold
                    const slop = PhysicsConstants2D.POSITION_SLOP;
                    if (cp.penetration <= slop) continue;

                    const totalInvMass = bodyA.invMass + bodyB.invMass;
                    if (totalInvMass === 0) continue;

                    // Correct only a fraction of excess penetration per frame
                    const rate = PhysicsConstants2D.POSITION_CORRECTION_RATE;
                    const correctionAmount = (cp.penetration - slop) * rate;
                    const correction = correctionAmount / totalInvMass;

                    bodyA.position.x -= normal.x * correction * bodyA.invMass;
                    bodyA.position.y -= normal.y * correction * bodyA.invMass;
                    
                    bodyB.position.x += normal.x * correction * bodyB.invMass;
                    bodyB.position.y += normal.y * correction * bodyB.invMass;

                    if (bodyA.invMass > 0) bodyA._aabbDirty = true;
                    if (bodyB.invMass > 0) bodyB._aabbDirty = true;
                }
            }

            // 7. Clear forces and update sleep state
            let sleepCount = 0;
            let dynCount = 0;
            for (let i = 0; i < bodies.length; i++) {
                bodies[i].clearForces();
                bodies[i].updateSleep(dt);
                if (bodies[i].type === 'dynamic') {
                    dynCount++;
                    if (!bodies[i].isAwake) sleepCount++;
                }
            }
            this.stats.dynamicCount = dynCount;
            this.stats.sleepingCount = sleepCount;

            // Update manifold cache for next frame's warm starting
            this._updateManifoldCache(manifolds);

            // Fire contact listeners
            for (let m = 0; m < manifolds.length; m++) {
                const manifold = manifolds[m];
                
                // World-level listeners (existing functionality)
                for (let l = 0; l < this._contactListeners.length; l++) {
                    this._contactListeners[l](manifold);
                }
                
                // Body-level listeners (new functionality)
                // Register contact for both bodies
                manifold.bodyA._addContact(manifold.bodyB.id);
                manifold.bodyB._addContact(manifold.bodyA.id);
                
                if (manifold.bodyA._invokeContactStart) {
                    manifold.bodyA._invokeContactStart(manifold.bodyB, manifold.contacts, manifold);
                }
                if (manifold.bodyB._invokeContactStart) {
                    manifold.bodyB._invokeContactStart(manifold.bodyA, manifold.contacts, manifold);
                }
            }
        }


    // ---- Manifold cache for warm starting ----

    _pairKey(a, b) {
        const lo = Math.min(a.id, b.id);
        const hi = Math.max(a.id, b.id);
        return lo * PhysicsConstants2D.PAIR_KEY_MULTIPLIER + hi;
    }

    _warmStartFromCache(manifold) {
        const key = this._pairKey(manifold.bodyA, manifold.bodyB);
        const cached = this._manifoldCache.get(key);
        if (!cached) return;

        // Transfer accumulated impulses to matching contacts
        for (let i = 0; i < manifold.contacts.length; i++) {
            const cp = manifold.contacts[i];
            // Find closest cached contact
            let bestDist = PhysicsConstants2D.WARM_START_MATCH_DISTANCE; // max squared distance threshold for match
            let bestCached = null;
            for (let j = 0; j < cached.contacts.length; j++) {
                const cc = cached.contacts[j];
                const dx = cp.worldPoint.x - cc.worldPoint.x;
                const dy = cp.worldPoint.y - cc.worldPoint.y;
                const d = dx * dx + dy * dy;
                if (d < bestDist) {
                    bestDist = d;
                    bestCached = cc;
                }
            }
            if (bestCached) {
                cp.normalImpulse = bestCached.normalImpulse;
                cp.tangentImpulse = bestCached.tangentImpulse;
            }
        }
    }

    _updateManifoldCache(manifolds) {
        // Fire onContactEnd for any manifolds that existed last frame but don't exist this frame
        const newKeys = new Set();
        for (let i = 0; i < manifolds.length; i++) {
            const key = this._pairKey(manifolds[i].bodyA, manifolds[i].bodyB);
            newKeys.add(key);
        }
        
        for (const [key, oldManifold] of this._manifoldCache) {
            if (!newKeys.has(key)) {
                // This contact ended
                if (oldManifold.bodyA._invokeContactEnd) {
                    oldManifold.bodyA._invokeContactEnd(oldManifold.bodyB);
                }
                if (oldManifold.bodyB._invokeContactEnd) {
                    oldManifold.bodyB._invokeContactEnd(oldManifold.bodyA);
                }
            }
        }
        
        this._manifoldCache.clear();
        for (let i = 0; i < manifolds.length; i++) {
            const m = manifolds[i];
            const key = this._pairKey(m.bodyA, m.bodyB);
            this._manifoldCache.set(key, m);
        }
    }

    // ---- Queries ----

    /**
     * Point query: find all bodies whose shape contains the given point.
     * @param {number} x
     * @param {number} y
     * @returns {ActionRigidBody2D[]}
     */
    queryPoint(x, y) {
        const results = [];
        for (let i = 0; i < this.bodies.length; i++) {
            const body = this.bodies[i];
            if (!body.getAABB().contains(x, y)) continue;
            if (this._pointInShape(body, x, y)) {
                results.push(body);
            }
        }
        return results;
    }

    /**
     * AABB query: find all bodies whose AABB overlaps the given region.
     */
    queryAABB(minX, minY, maxX, maxY) {
        const region = new ActionAABB2D(minX, minY, maxX, maxY);
        const results = [];
        for (let i = 0; i < this.bodies.length; i++) {
            if (this.bodies[i].getAABB().overlaps(region)) {
                results.push(this.bodies[i]);
            }
        }
        return results;
    }

    /**
     * Raycast: find the first body hit by a ray.
     * @param {number} originX
     * @param {number} originY
     * @param {number} dirX      - direction (does not need to be normalized)
     * @param {number} dirY
     * @param {number} maxDist   - maximum ray length
     * @returns {{ body, point, normal, fraction }|null}
     */
    raycast(originX, originY, dirX, dirY, maxDist) {
        const len = Math.sqrt(dirX * dirX + dirY * dirY);
        if (len === 0) return null;
        const ndx = dirX / len;
        const ndy = dirY / len;

        let closest = null;
        let closestFraction = maxDist;

        for (let i = 0; i < this.bodies.length; i++) {
            const body = this.bodies[i];
            const hit = this._raycastBody(body, originX, originY, ndx, ndy, closestFraction);
            if (hit && hit.fraction < closestFraction) {
                closestFraction = hit.fraction;
                closest = hit;
                closest.body = body;
            }
        }

        return closest;
    }

    _pointInShape(body, x, y) {
        if (body.shape.type === ActionShapeType2D.CIRCLE) {
            const dx = x - body.position.x;
            const dy = y - body.position.y;
            return dx * dx + dy * dy <= body.shape.radius * body.shape.radius;
        }
        if (body.shape.type === ActionShapeType2D.BOX) {
            // Transform to local space
            const cos = Math.cos(-body.angle);
            const sin = Math.sin(-body.angle);
            const dx = x - body.position.x;
            const dy = y - body.position.y;
            const lx = dx * cos - dy * sin;
            const ly = dx * sin + dy * cos;
            return Math.abs(lx) <= body.shape.halfWidth &&
                   Math.abs(ly) <= body.shape.halfHeight;
        }
        return false;
    }

    _raycastBody(body, ox, oy, dx, dy, maxDist) {
        if (body.shape.type === ActionShapeType2D.CIRCLE) {
            return this._raycastCircle(body, ox, oy, dx, dy, maxDist);
        }
        if (body.shape.type === ActionShapeType2D.BOX) {
            return this._raycastBox(body, ox, oy, dx, dy, maxDist);
        }
        return null;
    }

    _raycastCircle(body, ox, oy, dx, dy, maxDist) {
        const cx = body.position.x, cy = body.position.y;
        const r = body.shape.radius;
        const ex = ox - cx, ey = oy - cy;
        const a = dx * dx + dy * dy;
        const b = 2 * (ex * dx + ey * dy);
        const c = ex * ex + ey * ey - r * r;
        const disc = b * b - 4 * a * c;
        if (disc < 0) return null;
        const sqrtDisc = Math.sqrt(disc);
        let t = (-b - sqrtDisc) / (2 * a);
        if (t < 0) t = (-b + sqrtDisc) / (2 * a);
        if (t < 0 || t > maxDist) return null;
        const px = ox + dx * t;
        const py = oy + dy * t;
        const nLen = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
        return {
            fraction: t,
            point: new Vector2(px, py),
            normal: new Vector2((px - cx) / nLen, (py - cy) / nLen)
        };
    }

    _raycastBox(body, ox, oy, dx, dy, maxDist) {
        // Transform ray to box local space
        const cos = Math.cos(-body.angle);
        const sin = Math.sin(-body.angle);
        const lox = (ox - body.position.x) * cos - (oy - body.position.y) * sin;
        const loy = (ox - body.position.x) * sin + (oy - body.position.y) * cos;
        const ldx = dx * cos - dy * sin;
        const ldy = dx * sin + dy * cos;

        const hw = body.shape.halfWidth;
        const hh = body.shape.halfHeight;

        let tmin = -Infinity, tmax = Infinity;
        let normalX = 0, normalY = 0;

        // X slab
        if (Math.abs(ldx) < 1e-10) {
            if (lox < -hw || lox > hw) return null;
        } else {
            let t1 = (-hw - lox) / ldx;
            let t2 = (hw - lox) / ldx;
            let nx = -1;
            if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; nx = 1; }
            if (t1 > tmin) { tmin = t1; normalX = nx; normalY = 0; }
            if (t2 < tmax) tmax = t2;
            if (tmin > tmax) return null;
        }

        // Y slab
        if (Math.abs(ldy) < 1e-10) {
            if (loy < -hh || loy > hh) return null;
        } else {
            let t1 = (-hh - loy) / ldy;
            let t2 = (hh - loy) / ldy;
            let ny = -1;
            if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; ny = 1; }
            if (t1 > tmin) { tmin = t1; normalX = 0; normalY = ny; }
            if (t2 < tmax) tmax = t2;
            if (tmin > tmax) return null;
        }

        if (tmin < 0 || tmin > maxDist) return null;

        // Transform hit back to world space
        const cosB = Math.cos(body.angle);
        const sinB = Math.sin(body.angle);
        const hitX = ox + dx * tmin;
        const hitY = oy + dy * tmin;
        const wnx = normalX * cosB - normalY * sinB;
        const wny = normalX * sinB + normalY * cosB;

        return {
            fraction: tmin,
            point: new Vector2(hitX, hitY),
            normal: new Vector2(wnx, wny)
        };
    }

    // ---- Control ----

    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
    }

    reset() {
        this.bodies = [];
        this._manifoldCache.clear();
        this.stats.bodyCount = 0;
        this.stats.pairCount = 0;
        this.stats.contactCount = 0;
        this.stats.ccdCount = 0;
    }

    setGravity(x, y) {
        this.gravityX = x;
        this.gravityY = y;
    }
}
