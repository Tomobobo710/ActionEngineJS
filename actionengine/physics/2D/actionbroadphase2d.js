// actionengine/math/physics/actionbroadphase2d.js
/**
 * ActionBroadPhase2D — Spatial hash broadphase for 2D collision culling.
 *
 * Maps bodies into a uniform grid. Only pairs sharing a cell get
 * passed to the narrow phase. O(n) insert, O(1) cell lookup.
 *
 * Cell size should be roughly 2× the radius of the largest object
 * for best performance. Auto-tuning could be added later.
 */
class ActionBroadPhase2D {
    /**
     * @param {number} cellSize - uniform grid cell size (default 64)
     */
    constructor(cellSize = PhysicsConstants2D.BROADPHASE_CELL_SIZE) {
        this.cellSize = cellSize;
        this.invCellSize = 1 / cellSize;
        this._grid = new Map();     // hash → body[]
        this._pairSet = new Set();  // deduplicated pair keys
    }

    /**
     * Clear the grid. Called at the start of each broadphase pass.
     */
    clear() {
        this._grid.clear();
        this._pairSet.clear();
    }

    /**
     * Hash a cell coordinate pair into a single integer key.
     * Uses a large prime to reduce collisions.
     */
    _hash(cx, cy) {
        // Szudzik pairing (works for negative ints too)
        const a = cx >= 0 ? 2 * cx : -2 * cx - 1;
        const b = cy >= 0 ? 2 * cy : -2 * cy - 1;
        return a >= b ? a * a + a + b : a + b * b;
    }

    /**
     * Insert a body into all grid cells its AABB overlaps.
     * @param {ActionRigidBody2D} body
     * @param {number} dt - timestep for speculative expansion
     */
    _insertBody(body, dt) {
        const aabb = body.getAABB();
        
        // Speculative contact: expand AABB by velocity * dt
        let minX = aabb.minX;
        let minY = aabb.minY;
        let maxX = aabb.maxX;
        let maxY = aabb.maxY;
        
        if (PhysicsConstants2D.SPECULATIVE_CONTACTS_ENABLED && body.type === 'dynamic') {
            const multiplier = PhysicsConstants2D.SPECULATIVE_CONTACT_MULTIPLIER;
            const maxDist = PhysicsConstants2D.SPECULATIVE_CONTACT_MAX_DISTANCE;
            
            const vx = body.linearVelocity.x * dt * multiplier;
            const vy = body.linearVelocity.y * dt * multiplier;
            
            // Clamp expansion to max distance
            const clampedVx = Math.max(-maxDist, Math.min(maxDist, vx));
            const clampedVy = Math.max(-maxDist, Math.min(maxDist, vy));
            
            minX += Math.min(0, clampedVx);
            maxX += Math.max(0, clampedVx);
            minY += Math.min(0, clampedVy);
            maxY += Math.max(0, clampedVy);
        }
        
        const x0 = Math.floor(minX * this.invCellSize);
        const y0 = Math.floor(minY * this.invCellSize);
        const x1 = Math.floor(maxX * this.invCellSize);
        const y1 = Math.floor(maxY * this.invCellSize);

        for (let cx = x0; cx <= x1; cx++) {
            for (let cy = y0; cy <= y1; cy++) {
                const key = this._hash(cx, cy);
                let cell = this._grid.get(key);
                if (!cell) {
                    cell = [];
                    this._grid.set(key, cell);
                }
                cell.push(body);
            }
        }
    }

    /**
     * Generate candidate collision pairs from the grid.
     * @param {ActionRigidBody2D[]} bodies
     * @param {number} dt - timestep for speculative expansion
     * @returns {{ bodyA: ActionRigidBody2D, bodyB: ActionRigidBody2D }[]}
     */
    generatePairs(bodies, dt) {
        this.clear();

        for (let i = 0; i < bodies.length; i++) {
            this._insertBody(bodies[i], dt);
        }

        const pairs = [];

        for (const cell of this._grid.values()) {
            for (let i = 0; i < cell.length; i++) {
                for (let j = i + 1; j < cell.length; j++) {
                    const a = cell[i];
                    const b = cell[j];

                    // Skip static-static pairs
                    if (a.type !== 'dynamic' && b.type !== 'dynamic') continue;

                    // Collision filter
                    if ((a.categoryBits & b.maskBits) === 0 ||
                        (b.categoryBits & a.maskBits) === 0) continue;

                    // Deduplicate: use sorted id pair
                    const lo = Math.min(a.id, b.id);
                    const hi = Math.max(a.id, b.id);
                    const pairKey = lo * PhysicsConstants2D.PAIR_KEY_MULTIPLIER + hi;
                    if (this._pairSet.has(pairKey)) continue;
                    this._pairSet.add(pairKey);

                    // AABB overlap check with speculative expansion
                    if (this._speculativeAABBOverlap(a, b, dt)) {
                        pairs.push({ bodyA: a, bodyB: b });
                    }
                }
            }
        }

        return pairs;
    }

    /**
     * Check if two bodies' AABBs overlap, accounting for speculative expansion.
     */
    _speculativeAABBOverlap(a, b, dt) {
        const aabbA = a.getAABB();
        const aabbB = b.getAABB();
        
        let aMinX = aabbA.minX, aMaxX = aabbA.maxX;
        let aMinY = aabbA.minY, aMaxY = aabbA.maxY;
        let bMinX = aabbB.minX, bMaxX = aabbB.maxX;
        let bMinY = aabbB.minY, bMaxY = aabbB.maxY;
        
        if (PhysicsConstants2D.SPECULATIVE_CONTACTS_ENABLED) {
            const multiplier = PhysicsConstants2D.SPECULATIVE_CONTACT_MULTIPLIER;
            const maxDist = PhysicsConstants2D.SPECULATIVE_CONTACT_MAX_DISTANCE;
            
            if (a.type === 'dynamic') {
                const vx = a.linearVelocity.x * dt * multiplier;
                const vy = a.linearVelocity.y * dt * multiplier;
                const clampedVx = Math.max(-maxDist, Math.min(maxDist, vx));
                const clampedVy = Math.max(-maxDist, Math.min(maxDist, vy));
                aMinX += Math.min(0, clampedVx);
                aMaxX += Math.max(0, clampedVx);
                aMinY += Math.min(0, clampedVy);
                aMaxY += Math.max(0, clampedVy);
            }
            if (b.type === 'dynamic') {
                const vx = b.linearVelocity.x * dt * multiplier;
                const vy = b.linearVelocity.y * dt * multiplier;
                const clampedVx = Math.max(-maxDist, Math.min(maxDist, vx));
                const clampedVy = Math.max(-maxDist, Math.min(maxDist, vy));
                bMinX += Math.min(0, clampedVx);
                bMaxX += Math.max(0, clampedVx);
                bMinY += Math.min(0, clampedVy);
                bMaxY += Math.max(0, clampedVy);
            }
        }
        
        return !(aMaxX < bMinX || aMinX > bMaxX || aMaxY < bMinY || aMinY > bMaxY);
    }
}
