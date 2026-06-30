// actionengine/character/actionhitresolver.js
/**
 * Combat hit resolution — the engine, REUSABLE half of authoritative combat, split into two rings:
 *
 *   RING 1 — ActionHitResolver (SIM-AGNOSTIC): given a ray/segment, the world (for occlusion), and
 *            a list of target boxes (PLAIN DATA), find what was hit. It knows nothing about ActionSim,
 *            HP, teams, or how the target boxes were produced. Pure geometry.
 *
 *   RING 2 — ActionSimTargetProvider (ACTIONSIM ADAPTER): produces the target boxes for ring 1 by
 *            rewinding players through the ActionSim server's per-tick history (lag compensation).
 *            This is the swappable seam: a game running its OWN sim (or no sim at all — offline)
 *            supplies a different provider with the same `rewound()` shape, and ring 1 is unchanged.
 *
 * RING 3 (the game's FPSCombat) owns policy: which weapon, eligibility (canDamage), HP/death
 * (the damage sink), and the FX broadcast. It asks ring 2 for targets, hands them to ring 1, then
 * turns ring 1's geometric result into damage. The engine never learns what "health" is.
 */

/** RING 1 — sim-agnostic geometric hit resolution. Target boxes are plain {id,x,y,z,hx,hy,hz}. */
class ActionHitResolver {
    /**
     * Hitscan: nearest of (world occlusion, target boxes) along a ray from `origin` in unit `dir`,
     * out to `range`. `targets` are already rewound by the caller (ring 2). `raycastOpts` is passed
     * straight to ActionRaycast3D (e.g. ignore player bodies). Returns:
     *   { endDist, hitId|null, worldHit } — endDist is the authoritative beam length for the tracer.
     */
    static hitscan(origin, dir, range, world, targets, raycastOpts) {
        const end = new Vector3(origin.x + dir.x * range, origin.y + dir.y * range, origin.z + dir.z * range);
        const worldHit = ActionRaycast3D.cast(origin, end, world, raycastOpts);
        const maxDist = worldHit ? worldHit.distance : range;
        let best = null;
        for (let i = 0; i < targets.length; i++) {
            const tg = targets[i];
            const t = ActionBoxGeometry.rayAABB(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, tg.x, tg.y, tg.z, tg.hx, tg.hy, tg.hz);
            if (t === null || t > maxDist) continue;
            if (!best || t < best.t) best = { id: tg.id, t };
        }
        return { endDist: best ? best.t : maxDist, hitId: best ? best.id : null, worldHit };
    }

    /**
     * Swept segment [a,b] (a moving projectile this tick) vs (world occlusion, target boxes). Returns
     * { impact } where impact = { x, y, z, hitId|null } at the FIRST contact, or { impact: null } if the
     * segment hits nothing. A target closer than the world hit wins (direct hit); ties to the world go
     * to the world. `targets` already rewound by the caller (ring 2).
     */
    static sweep(a, b, world, targets, raycastOpts) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const segLen = Math.hypot(dx, dy, dz);
        if (segLen <= 1e-4) return { impact: null };
        const ux = dx / segLen;
        const uy = dy / segLen;
        const uz = dz / segLen;
        const worldHit = ActionRaycast3D.cast(a, b, world, raycastOpts);
        let bestDist = worldHit ? worldHit.distance : Infinity;
        let hitId = null;
        for (let i = 0; i < targets.length; i++) {
            const tg = targets[i];
            const t = ActionBoxGeometry.rayAABB(a.x, a.y, a.z, ux, uy, uz, tg.x, tg.y, tg.z, tg.hx, tg.hy, tg.hz);
            if (t === null || t > segLen || t > bestDist) continue;
            bestDist = t;
            hitId = tg.id;
        }
        if (worldHit && bestDist === worldHit.distance && hitId === null) {
            return { impact: { x: worldHit.point.x, y: worldHit.point.y, z: worldHit.point.z, hitId: null } };
        }
        if (hitId !== null) {
            return { impact: { x: a.x + ux * bestDist, y: a.y + uy * bestDist, z: a.z + uz * bestDist, hitId } };
        }
        return { impact: null };
    }
}

/**
 * RING 2 — ActionSim lag-compensation adapter. Rewinds players through the ActionSim server's
 * per-tick state history and hands ring 1 plain target boxes. The ONLY ActionSim-aware piece of
 * combat resolution; swap it (or supply an equivalent `rewound`) to run on a different sim / offline.
 *
 * @param {ActionSimServer} server  - exposes stateAt(id, tick)
 * @param {Map}             players - id -> entity { dead, controller:{width,height} }
 */
class ActionSimTargetProvider {
    constructor(server, players) {
        this.server = server;
        this.players = players;
    }

    /**
     * Target boxes at `tick`, excluding `excludeId` (the shooter) and the dead. `pad` widens each box
     * (e.g. a projectile's half-width). Box half-extents come from the rewound snapshot's collider
     * size (w/h), falling back to the live controller dims.
     */
    rewound(tick, excludeId, pad = 0) {
        const out = [];
        for (const [id, e] of this.players) {
            if (id === excludeId || e.dead) continue;
            const past = this.server.stateAt(id, tick);
            if (!past) continue;
            const hx = (past.w || e.controller.width) / 2 + pad;
            const hy = (past.h || e.controller.height) / 2 + pad;
            out.push({ id, x: past.x, y: past.y, z: past.z, hx, hy, hz: hx });
        }
        return out;
    }
}
