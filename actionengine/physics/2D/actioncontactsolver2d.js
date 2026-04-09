// actionengine/math/physics/actioncontactsolver2d.js
/**
 * ActionContactSolver2D — Sequential impulse constraint solver.
 *
 * Implements the Box2D-style velocity constraint solver:
 *   1. Pre-step: compute Jacobian data, effective mass, bias
 *   2. Warm-start: apply accumulated impulses from previous frame
 *   3. Iterate: solve velocity constraints (normal + friction)
 *   4. Position correction: Baumgarte stabilization to resolve overlap
 *
 * This solver handles both normal impulses (non-penetration) and tangent
 * impulses (Coulomb friction) for each contact point.
 */
class ActionContactSolver2D {
    /**
     * @param {number} velocityIterations - solver iterations for velocity phase (default 8)
     */
    constructor(velocityIterations = PhysicsConstants2D.VELOCITY_ITERATIONS) {
        this.velocityIterations = velocityIterations;
    }

    /**
     * Pre-compute contact constraint data for all manifolds.
     * Called once per physics step, before iteration.
     *
     * @param {ActionManifold2D[]} manifolds
     * @param {number} dt
     */
    preSolve(manifolds, dt) {
        const invDt = dt > 0 ? 1 / dt : 0;

        for (let m = 0; m < manifolds.length; m++) {
            const manifold = manifolds[m];
            const bodyA = manifold.bodyA;
            const bodyB = manifold.bodyB;
            const normal = manifold.normal;
            // Tangent vector (perpendicular to normal)
            const tangentX = -normal.y;
            const tangentY = normal.x;

            for (let c = 0; c < manifold.contacts.length; c++) {
                const cp = manifold.contacts[c];

                // Vectors from body centers to contact point
                const rAx = cp.worldPoint.x - bodyA.position.x;
                const rAy = cp.worldPoint.y - bodyA.position.y;
                const rBx = cp.worldPoint.x - bodyB.position.x;
                const rBy = cp.worldPoint.y - bodyB.position.y;

                cp._rAx = rAx;
                cp._rAy = rAy;
                cp._rBx = rBx;
                cp._rBy = rBy;

                // ---- Normal effective mass ----
                // K_n = 1/mA + 1/mB + (rA × n)² / IA + (rB × n)² / IB
                const raCrossN = rAx * normal.y - rAy * normal.x;
                const rbCrossN = rBx * normal.y - rBy * normal.x;
                const normalMass = bodyA.invMass + bodyB.invMass +
                    raCrossN * raCrossN * bodyA.invInertia +
                    rbCrossN * rbCrossN * bodyB.invInertia;
                cp._normalMass = normalMass > 0 ? 1 / normalMass : 0;

                // ---- Tangent effective mass ----
                const raCrossT = rAx * tangentY - rAy * tangentX;
                const rbCrossT = rBx * tangentY - rBy * tangentX;
                const tangentMass = bodyA.invMass + bodyB.invMass +
                    raCrossT * raCrossT * bodyA.invInertia +
                    rbCrossT * rbCrossT * bodyB.invInertia;
                cp._tangentMass = tangentMass > 0 ? 1 / tangentMass : 0;

                // ---- Restitution bias ----
                // Relative velocity at contact along normal
                const vAx = bodyA.linearVelocity.x - bodyA.angularVelocity * rAy;
                const vAy = bodyA.linearVelocity.y + bodyA.angularVelocity * rAx;
                const vBx = bodyB.linearVelocity.x - bodyB.angularVelocity * rBy;
                const vBy = bodyB.linearVelocity.y + bodyB.angularVelocity * rBx;
                const relVelN = (vBx - vAx) * normal.x + (vBy - vAy) * normal.y;

                // Restitution velocity threshold — below this, treat as inelastic.
                // In pixel-space units a good threshold is roughly sqrt(2 * gravity * slop).
                // For gravity ~500 px/s², ~20 px/s kills micro-bounce jitter.
                cp._restitutionBias = 0;
                if (relVelN < -PhysicsConstants2D.RESTITUTION_VELOCITY_THRESHOLD) {
                    cp._restitutionBias = -manifold.restitution * relVelN;
                }

                // Cache tangent
                cp._tangentX = tangentX;
                cp._tangentY = tangentY;
            }
        }
    }

    /**
     * Warm start: apply accumulated impulses from the previous frame.
     * This dramatically improves solver convergence.
     *
     * @param {ActionManifold2D[]} manifolds
     */
    warmStart(manifolds) {
        for (let m = 0; m < manifolds.length; m++) {
            const manifold = manifolds[m];
            const bodyA = manifold.bodyA;
            const bodyB = manifold.bodyB;
            const normal = manifold.normal;

            for (let c = 0; c < manifold.contacts.length; c++) {
                const cp = manifold.contacts[c];

                const impulseX = normal.x * cp.normalImpulse + cp._tangentX * cp.tangentImpulse;
                const impulseY = normal.y * cp.normalImpulse + cp._tangentY * cp.tangentImpulse;

                bodyA.linearVelocity.x -= impulseX * bodyA.invMass;
                bodyA.linearVelocity.y -= impulseY * bodyA.invMass;
                bodyA.angularVelocity -= bodyA.invInertia *
                    (cp._rAx * impulseY - cp._rAy * impulseX);

                bodyB.linearVelocity.x += impulseX * bodyB.invMass;
                bodyB.linearVelocity.y += impulseY * bodyB.invMass;
                bodyB.angularVelocity += bodyB.invInertia *
                    (cp._rBx * impulseY - cp._rBy * impulseX);
            }
        }
    }

    /**
     * Solve velocity constraints (iterative).
     * @param {ActionManifold2D[]} manifolds
     */
    solveVelocity(manifolds) {
        for (let iter = 0; iter < this.velocityIterations; iter++) {
            for (let m = 0; m < manifolds.length; m++) {
                const manifold = manifolds[m];
                const bodyA = manifold.bodyA;
                const bodyB = manifold.bodyB;
                const normal = manifold.normal;

                for (let c = 0; c < manifold.contacts.length; c++) {
                    const cp = manifold.contacts[c];
                    const rAx = cp._rAx, rAy = cp._rAy;
                    const rBx = cp._rBx, rBy = cp._rBy;

                    // ---- Friction (tangent) constraint ----
                    {
                        const vAx = bodyA.linearVelocity.x - bodyA.angularVelocity * rAy;
                        const vAy = bodyA.linearVelocity.y + bodyA.angularVelocity * rAx;
                        const vBx = bodyB.linearVelocity.x - bodyB.angularVelocity * rBy;
                        const vBy = bodyB.linearVelocity.y + bodyB.angularVelocity * rBx;
                        const relVelT = (vBx - vAx) * cp._tangentX + (vBy - vAy) * cp._tangentY;

                        let lambda = -relVelT * cp._tangentMass;

                        // Coulomb friction clamp
                        const maxFriction = manifold.friction * cp.normalImpulse;
                        const oldImpulse = cp.tangentImpulse;
                        cp.tangentImpulse = MathUtils.clamp(oldImpulse + lambda, -maxFriction, maxFriction);
                        lambda = cp.tangentImpulse - oldImpulse;

                        const impulseX = cp._tangentX * lambda;
                        const impulseY = cp._tangentY * lambda;

                        bodyA.linearVelocity.x -= impulseX * bodyA.invMass;
                        bodyA.linearVelocity.y -= impulseY * bodyA.invMass;
                        bodyA.angularVelocity -= bodyA.invInertia * (rAx * impulseY - rAy * impulseX);

                        bodyB.linearVelocity.x += impulseX * bodyB.invMass;
                        bodyB.linearVelocity.y += impulseY * bodyB.invMass;
                        bodyB.angularVelocity += bodyB.invInertia * (rBx * impulseY - rBy * impulseX);
                    }

                    // ---- Normal constraint ----
                    {
                        const vAx = bodyA.linearVelocity.x - bodyA.angularVelocity * rAy;
                        const vAy = bodyA.linearVelocity.y + bodyA.angularVelocity * rAx;
                        const vBx = bodyB.linearVelocity.x - bodyB.angularVelocity * rBy;
                        const vBy = bodyB.linearVelocity.y + bodyB.angularVelocity * rBx;
                        const relVelN = (vBx - vAx) * normal.x + (vBy - vAy) * normal.y;

                        // Apply restitution bias to velocity constraint
                        let lambda = -(relVelN - cp._restitutionBias) * cp._normalMass;

                        // Accumulated impulse clamping (Box2D technique)
                        const oldImpulse = cp.normalImpulse;
                        cp.normalImpulse = Math.max(oldImpulse + lambda, 0);
                        lambda = cp.normalImpulse - oldImpulse;

                        const impulseX = normal.x * lambda;
                        const impulseY = normal.y * lambda;

                        bodyA.linearVelocity.x -= impulseX * bodyA.invMass;
                        bodyA.linearVelocity.y -= impulseY * bodyA.invMass;
                        bodyA.angularVelocity -= bodyA.invInertia * (rAx * impulseY - rAy * impulseX);

                        bodyB.linearVelocity.x += impulseX * bodyB.invMass;
                        bodyB.linearVelocity.y += impulseY * bodyB.invMass;
                        bodyB.angularVelocity += bodyB.invInertia * (rBx * impulseY - rBy * impulseX);
                    }
                }
            }
        }
    }

    /**
     * Solve position constraints (non-linear Gauss-Seidel).
     * This directly corrects body positions to resolve penetration.
     * Called AFTER velocity integration.
     *
     * @param {ActionManifold2D[]} manifolds
     * @param {number} positionIterations - number of iterations (default 3)
     * @returns {boolean} - true if all contacts are within tolerance
     */
    solvePosition(manifolds, positionIterations = 3) {
        const maxCorrection = PhysicsConstants2D.MAX_POSITION_CORRECTION || 20;
        const slop = this.slop;
        let minSeparation = 0;
        let debugOnce = true;

        for (let iter = 0; iter < positionIterations; iter++) {
            minSeparation = 0;

            for (let m = 0; m < manifolds.length; m++) {
                const manifold = manifolds[m];
                const bodyA = manifold.bodyA;
                const bodyB = manifold.bodyB;
                const normal = manifold.normal;

                // Skip if both bodies are static/kinematic
                if (bodyA.invMass === 0 && bodyB.invMass === 0) continue;

                for (let c = 0; c < manifold.contacts.length; c++) {
                    const cp = manifold.contacts[c];

                    // Recompute contact vectors from current positions
                    const rAx = cp.worldPoint.x - bodyA.position.x;
                    const rAy = cp.worldPoint.y - bodyA.position.y;
                    const rBx = cp.worldPoint.x - bodyB.position.x;
                    const rBy = cp.worldPoint.y - bodyB.position.y;

                    // Use penetration depth from manifold (negative of separation)
                    // Positive penetration = overlapping, negative = separated
                    const separation = -cp.penetration;
                    minSeparation = Math.min(minSeparation, separation);

                    if (debugOnce && iter === 0 && m === 0 && c === 0) {
                        console.log(`[solvePosition] penetration=${cp.penetration.toFixed(2)} sep=${separation.toFixed(2)}`);
                        console.log(`  normal=(${normal.x.toFixed(2)},${normal.y.toFixed(2)}) slop=${slop}`);
                        debugOnce = false;
                    }

                    // Position correction: C = min(0, separation + slop)
                    // If separation is -10 (10 units penetration) and slop is 1:
                    // C = min(0, -10 + 1) = min(0, -9) = -9 (need to correct 9 units)
                    const C = Math.min(0, separation + slop);
                    
                    // Clamp correction amount
                    const correction = MathUtils.clamp(0.8 * C, -maxCorrection, 0);

                    // Effective mass for position correction
                    const raCrossN = rAx * normal.y - rAy * normal.x;
                    const rbCrossN = rBx * normal.y - rBy * normal.x;
                    const K = bodyA.invMass + bodyB.invMass +
                        raCrossN * raCrossN * bodyA.invInertia +
                        rbCrossN * rbCrossN * bodyB.invInertia;

                    if (K <= 0) continue;

                    // Position impulse (no accumulation, no warm start)
                    const impulse = -correction / K;

                    // Apply position correction
                    const Px = normal.x * impulse;
                    const Py = normal.y * impulse;

                    bodyA.position.x -= Px * bodyA.invMass;
                    bodyA.position.y -= Py * bodyA.invMass;
                    bodyA.angle -= bodyA.invInertia * (rAx * Py - rAy * Px);

                    bodyB.position.x += Px * bodyB.invMass;
                    bodyB.position.y += Py * bodyB.invMass;
                    bodyB.angle += bodyB.invInertia * (rBx * Py - rBy * Px);

                    // Mark AABBs as dirty after position change
                    if (bodyA.invMass > 0) bodyA._aabbDirty = true;
                    if (bodyB.invMass > 0) bodyB._aabbDirty = true;
                }
            }

            // Early exit if all contacts are within tolerance
            if (minSeparation >= -1.5 * Math.abs(slop)) {
                return true;
            }
        }

        return minSeparation >= -3 * Math.abs(slop);
    }

}
