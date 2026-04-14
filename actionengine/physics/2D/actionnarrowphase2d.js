// actionengine/math/physics/actionnarrowphase2D.js
/**
 * ActionNarrowPhase2D — Narrow-phase collision detection.
 * 
 * Generates contact manifolds for:
 *   - Circle vs Circle
 *   - Circle vs Box (OBB)
 *   - Box vs Box (OBB via SAT)
 *
 * All normals point from bodyA toward bodyB.
 */
class ActionNarrowPhase2D {
    static EPSILON = PhysicsConstants2D.NARROW_PHASE_EPSILON;

    /**
     * Dispatch collision test based on shape types.
     * @param {ActionRigidBody2D} bodyA
     * @param {ActionRigidBody2D} bodyB
     * @param {number} dt - timestep for speculative distance
     * @returns {ActionManifold2D|null}
     */
    static detect(bodyA, bodyB, dt) {
        const typeA = bodyA.shape.type;
        const typeB = bodyB.shape.type;

        if (typeA === ActionShapeType2D.CIRCLE && typeB === ActionShapeType2D.CIRCLE) {
            return ActionNarrowPhase2D.circleVsCircle(bodyA, bodyB, dt);
        }
        if (typeA === ActionShapeType2D.CIRCLE && typeB === ActionShapeType2D.BOX) {
            return ActionNarrowPhase2D.circleVsBox(bodyA, bodyB, dt);
        }
        if (typeA === ActionShapeType2D.BOX && typeB === ActionShapeType2D.CIRCLE) {
            // Flip, then negate normal
            const m = ActionNarrowPhase2D.circleVsBox(bodyB, bodyA, dt);
            if (m) {
                m.bodyA = bodyA;
                m.bodyB = bodyB;
                m.normal.negate();
            }
            return m;
        }
        if (typeA === ActionShapeType2D.BOX && typeB === ActionShapeType2D.BOX) {
            return ActionNarrowPhase2D.boxVsBox(bodyA, bodyB, dt);
        }

        return null;
    }

    // ========================================================================
    // Circle vs Circle
    // ========================================================================
    static circleVsCircle(bodyA, bodyB, dt) {
        const dx = bodyB.position.x - bodyA.position.x;
        const dy = bodyB.position.y - bodyA.position.y;
        const distSq = dx * dx + dy * dy;
        
        // Compute speculative distance based on relative velocity
        let speculativeDistance = 0;
        if (PhysicsConstants2D.SPECULATIVE_CONTACTS_ENABLED) {
            const multiplier = PhysicsConstants2D.SPECULATIVE_CONTACT_MULTIPLIER;
            const maxDist = PhysicsConstants2D.SPECULATIVE_CONTACT_MAX_DISTANCE;
            const relVx = bodyB.linearVelocity.x - bodyA.linearVelocity.x;
            const relVy = bodyB.linearVelocity.y - bodyA.linearVelocity.y;
            const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy);
            speculativeDistance = Math.min(maxDist, relSpeed * dt * multiplier);
        }
        
        const skin = PhysicsConstants2D.SKIN_THICKNESS;
        const rSum = bodyA.shape.radius + bodyB.shape.radius + skin + speculativeDistance;

        if (distSq >= rSum * rSum) return null;

        const dist = Math.sqrt(distSq);
        const manifold = new ActionManifold2D(bodyA, bodyB);

        if (dist < ActionNarrowPhase2D.EPSILON) {
            // Overlapping centers — choose arbitrary normal
            manifold.normal.set(1, 0);
        } else {
            manifold.normal.set(dx / dist, dy / dist);
        }

        const cp = new ActionContactPoint2D();
        cp.penetration = rSum - dist;
        // Contact point is on the surface of A, along the normal
        cp.worldPoint.set(
            bodyA.position.x + manifold.normal.x * bodyA.shape.radius,
            bodyA.position.y + manifold.normal.y * bodyA.shape.radius
        );
        manifold.contacts.push(cp);
        manifold.computeMaterialProperties();
        return manifold;
    }

    // ========================================================================
    // Circle vs OBB
    // ========================================================================
    static circleVsBox(circleBody, boxBody, dt) {
        const shape = boxBody.shape;
        const cos = Math.cos(-boxBody.angle);
        const sin = Math.sin(-boxBody.angle);

        // Transform circle center into box local space
        const dx = circleBody.position.x - boxBody.position.x;
        const dy = circleBody.position.y - boxBody.position.y;
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        // Clamp to box extents to find closest point
        const closestX = MathUtils.clamp(localX, -shape.halfWidth, shape.halfWidth);
        const closestY = MathUtils.clamp(localY, -shape.halfHeight, shape.halfHeight);

        const diffX = localX - closestX;
        const diffY = localY - closestY;
        const distSq = diffX * diffX + diffY * diffY;
        const radius = circleBody.shape.radius;

        // Compute speculative distance based on relative velocity
        let speculativeDistance = 0;
        if (PhysicsConstants2D.SPECULATIVE_CONTACTS_ENABLED) {
            const multiplier = PhysicsConstants2D.SPECULATIVE_CONTACT_MULTIPLIER;
            const maxDist = PhysicsConstants2D.SPECULATIVE_CONTACT_MAX_DISTANCE;
            const relVx = circleBody.linearVelocity.x - boxBody.linearVelocity.x;
            const relVy = circleBody.linearVelocity.y - boxBody.linearVelocity.y;
            const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy);
            speculativeDistance = Math.min(maxDist, relSpeed * dt * multiplier);
        }

        const skin = PhysicsConstants2D.SKIN_THICKNESS;
        const effectiveRadius = radius + skin + speculativeDistance;
        if (distSq > effectiveRadius * effectiveRadius && distSq > ActionNarrowPhase2D.EPSILON) {
            // Circle center is outside the box and farther than radius
            return null;
        }

        const manifold = new ActionManifold2D(circleBody, boxBody);
        let normalLocalX, normalLocalY, penetration;

        if (distSq < ActionNarrowPhase2D.EPSILON) {
            // Circle center is INSIDE the box — find shortest axis to push out
            const overlapX = shape.halfWidth - Math.abs(localX);
            const overlapY = shape.halfHeight - Math.abs(localY);

            if (overlapX < overlapY) {
                normalLocalX = localX < 0 ? -1 : 1;
                normalLocalY = 0;
                penetration = overlapX + radius;
            } else {
                normalLocalX = 0;
                normalLocalY = localY < 0 ? -1 : 1;
                penetration = overlapY + radius;
            }
        } else {
            const dist = Math.sqrt(distSq);
            normalLocalX = diffX / dist;
            normalLocalY = diffY / dist;
            penetration = effectiveRadius - dist;
        }

        // Rotate normal back to world space
        const cosBack = Math.cos(boxBody.angle);
        const sinBack = Math.sin(boxBody.angle);
        // Normal points from circle toward box, but convention is A→B.
        // A = circle, B = box, so normal should point circle→box = toward box.
        // Actually the normal above points from box closest point toward circle center.
        // We want A→B = circle→box, so negate.
        const wnx = -(normalLocalX * cosBack - normalLocalY * sinBack);
        const wny = -(normalLocalX * sinBack + normalLocalY * cosBack);

        manifold.normal.set(wnx, wny);

        const cp = new ActionContactPoint2D();
        cp.penetration = penetration;
        // World-space contact: on the circle surface toward the box
        cp.worldPoint.set(
            circleBody.position.x + wnx * radius,
            circleBody.position.y + wny * radius
        );
        manifold.contacts.push(cp);
        manifold.computeMaterialProperties();
        return manifold;
    }

    // ========================================================================
    // Box vs Box (OBB via SAT + Sutherland-Hodgman contact clipping)
    //
    // Proper Box2D-style: track which shape owns the separating axis so we
    // assign reference face from the CORRECT shape and incident face from
    // the OTHER. This is critical for stable edge-edge contacts.
    // ========================================================================
    static boxVsBox(bodyA, bodyB, dt) {
        const shapeA = bodyA.shape;
        const shapeB = bodyB.shape;
        
        // Compute speculative distance based on relative velocity
        let speculativeDistance = 0;
        if (PhysicsConstants2D.SPECULATIVE_CONTACTS_ENABLED) {
            const multiplier = PhysicsConstants2D.SPECULATIVE_CONTACT_MULTIPLIER;
            const maxDist = PhysicsConstants2D.SPECULATIVE_CONTACT_MAX_DISTANCE;
            const relVx = bodyB.linearVelocity.x - bodyA.linearVelocity.x;
            const relVy = bodyB.linearVelocity.y - bodyA.linearVelocity.y;
            const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy);
            speculativeDistance = Math.min(maxDist, relSpeed * dt * multiplier);
        }
        
        const skin = PhysicsConstants2D.SKIN_THICKNESS + speculativeDistance;

        const vertsA = shapeA.getWorldVertices(bodyA.position, bodyA.angle);
        const vertsB = shapeB.getWorldVertices(bodyB.position, bodyB.angle);

        const axesA = shapeA.getAxes(bodyA.angle);
        const axesB = shapeB.getAxes(bodyB.angle);

        // SAT: test all 4 axes, track which shape owns the best (min penetration) axis
        let minOverlap = Infinity;
        let bestAxis = null;
        let bestAxisOwner = 0;   // 0 = from A's axes, 1 = from B's axes
        let bestAxisIndex = 0;   // which axis (0 or 1) within that shape

        // Test A's two axes
        for (let i = 0; i < 2; i++) {
            const axis = axesA[i];
            const projA = ActionNarrowPhase2D._projectVertices(vertsA, axis);
            const projB = ActionNarrowPhase2D._projectVertices(vertsB, axis);
            const overlap = ActionNarrowPhase2D._overlapAmount(projA, projB) + skin;
            if (overlap <= 0) return null;
            if (overlap < minOverlap) {
                minOverlap = overlap;
                bestAxis = axis;
                bestAxisOwner = 0;
                bestAxisIndex = i;
            }
        }

        // Test B's two axes
        for (let i = 0; i < 2; i++) {
            const axis = axesB[i];
            const projA = ActionNarrowPhase2D._projectVertices(vertsA, axis);
            const projB = ActionNarrowPhase2D._projectVertices(vertsB, axis);
            const overlap = ActionNarrowPhase2D._overlapAmount(projA, projB) + skin;
            if (overlap <= 0) return null;
            if (overlap < minOverlap) {
                minOverlap = overlap;
                bestAxis = axis;
                bestAxisOwner = 1;
                bestAxisIndex = i;
            }
        }

        if (!bestAxis) return null;

        // Ensure normal points from A → B
        const dCx = bodyB.position.x - bodyA.position.x;
        const dCy = bodyB.position.y - bodyA.position.y;
        const dot = bestAxis.x * dCx + bestAxis.y * dCy;
        const nx = dot < 0 ? -bestAxis.x : bestAxis.x;
        const ny = dot < 0 ? -bestAxis.y : bestAxis.y;

        const manifold = new ActionManifold2D(bodyA, bodyB);
        manifold.normal.set(nx, ny);

        // --- Reference/Incident face assignment (Box2D-style) ---
        // Reference face: from the shape that OWNS the separating axis
        // Incident face: from the OTHER shape — the face most anti-aligned with normal
        let refVerts, incVerts;
        let refNx = nx, refNy = ny;

        if (bestAxisOwner === 0) {
            // A owns the axis → reference face on A, incident on B
            refVerts = vertsA;
            incVerts = vertsB;
        } else {
            // B owns the axis → reference face on B, incident on A
            // Flip normal for face selection (reference face normal points outward on B)
            refVerts = vertsB;
            incVerts = vertsA;
            refNx = -nx;
            refNy = -ny;
        }

        // Find reference edge: the edge on refVerts whose outward normal
        // is most aligned with refN
        const refEdge = ActionNarrowPhase2D._findFaceByNormal(refVerts, refNx, refNy);

        // Find incident edge: the edge on incVerts whose outward normal
        // is most ANTI-aligned with the collision normal (faces the reference face)
        const incEdge = ActionNarrowPhase2D._findFaceByNormal(incVerts, -refNx, -refNy);

        // --- Sutherland-Hodgman clipping ---
        // Clip incident edge against the two side planes of the reference edge
        const edgeDx = refEdge.v2x - refEdge.v1x;
        const edgeDy = refEdge.v2y - refEdge.v1y;
        const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);
        if (edgeLen < ActionNarrowPhase2D.EPSILON) {
            ActionNarrowPhase2D._addFallbackContact(manifold, vertsA, vertsB, minOverlap);
            manifold.computeMaterialProperties();
            return manifold;
        }
        const edx = edgeDx / edgeLen;
        const edy = edgeDy / edgeLen;

        // Side plane 1: along edge direction, anchored at v1
        const side1Offset = edx * refEdge.v1x + edy * refEdge.v1y;
        let clipped = ActionNarrowPhase2D._clipSegment(
            incEdge.v1x, incEdge.v1y, incEdge.v2x, incEdge.v2y,
            -edx, -edy, -side1Offset
        );
        if (clipped.length < 4) {
            ActionNarrowPhase2D._addFallbackContact(manifold, vertsA, vertsB, minOverlap);
            manifold.computeMaterialProperties();
            return manifold;
        }

        // Side plane 2: opposite direction, anchored at v2
        const side2Offset = edx * refEdge.v2x + edy * refEdge.v2y;
        clipped = ActionNarrowPhase2D._clipSegment(
            clipped[0], clipped[1], clipped[2], clipped[3],
            edx, edy, side2Offset
        );
        if (clipped.length < 4) {
            ActionNarrowPhase2D._addFallbackContact(manifold, vertsA, vertsB, minOverlap);
            manifold.computeMaterialProperties();
            return manifold;
        }

        // Reference face plane: keep only points behind (or on) the reference face
        // The reference face outward normal is refNx, refNy
        const refFaceOffset = refNx * refEdge.v1x + refNy * refEdge.v1y;

        for (let i = 0; i < clipped.length; i += 2) {
            const px = clipped[i];
            const py = clipped[i + 1];
            const sep = refNx * px + refNy * py - refFaceOffset;
            if (sep <= ActionNarrowPhase2D.EPSILON) {
                const cp = new ActionContactPoint2D();
                cp.penetration = -sep;
                cp.worldPoint.set(px, py);
                manifold.contacts.push(cp);
            }
        }

        if (manifold.contacts.length === 0) {
            ActionNarrowPhase2D._addFallbackContact(manifold, vertsA, vertsB, minOverlap);
        }

        manifold.computeMaterialProperties();
        return manifold;
    }

    // ---- SAT helpers ----

    static _projectVertices(verts, axis) {
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < verts.length; i++) {
            const proj = verts[i].x * axis.x + verts[i].y * axis.y;
            if (proj < min) min = proj;
            if (proj > max) max = proj;
        }
        return { min, max };
    }

    static _overlapAmount(a, b) {
        return Math.min(a.max - b.min, b.max - a.min);
    }

    // ---- Edge/face helpers ----

    /**
     * Find the edge on a polygon whose outward normal best aligns with (nx, ny).
     * Returns the edge as {v1x, v1y, v2x, v2y}.
     *
     * For a CCW polygon, edge i→i+1 has outward normal = perpCW(edge).
     * For our boxes (vertices wound CCW), we compute each edge normal and
     * pick the one with the largest dot product against (nx, ny).
     */
    static _findFaceByNormal(verts, nx, ny) {
        let bestDot = -Infinity;
        let bestI = 0;
        const n = verts.length;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            // Edge vector
            const ex = verts[j].x - verts[i].x;
            const ey = verts[j].y - verts[i].y;
            // Outward normal (perpendicular CW for CCW winding)
            const onx = ey;
            const ony = -ex;
            // Don't need to normalize for comparison — just dot
            const d = onx * nx + ony * ny;
            if (d > bestDot) {
                bestDot = d;
                bestI = i;
            }
        }

        const j = (bestI + 1) % n;
        return {
            v1x: verts[bestI].x, v1y: verts[bestI].y,
            v2x: verts[j].x, v2y: verts[j].y
        };
    }

    /**
     * Clip segment (p1x,p1y)→(p2x,p2y) against half-plane dot(n, p) <= offset.
     * Returns flat array [x1, y1, x2, y2] of clipped segment, or fewer elements.
     */
    static _clipSegment(p1x, p1y, p2x, p2y, nx, ny, offset) {
        const d1 = nx * p1x + ny * p1y - offset;
        const d2 = nx * p2x + ny * p2y - offset;
        const out = [];

        if (d1 <= 0) { out.push(p1x, p1y); }
        if (d2 <= 0) { out.push(p2x, p2y); }

        // If they're on opposite sides, compute intersection
        if (d1 * d2 < 0) {
            const t = d1 / (d1 - d2);
            out.push(p1x + t * (p2x - p1x), p1y + t * (p2y - p1y));
        }

        return out;
    }

    /**
     * Fallback: single contact at the average of all vertices.
     */
    static _addFallbackContact(manifold, vertsA, vertsB, penetration) {
        let cx = 0, cy = 0;
        for (let i = 0; i < vertsA.length; i++) {
            cx += vertsA[i].x;
            cy += vertsA[i].y;
        }
        for (let i = 0; i < vertsB.length; i++) {
            cx += vertsB[i].x;
            cy += vertsB[i].y;
        }
        const total = vertsA.length + vertsB.length;
        cx /= total;
        cy /= total;

        const cp = new ActionContactPoint2D();
        cp.penetration = penetration;
        cp.worldPoint.set(cx, cy);
        manifold.contacts.push(cp);
    }
}
