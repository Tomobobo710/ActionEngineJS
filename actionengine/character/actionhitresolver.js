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

/**
 * RING 1 — sim-agnostic geometric hit resolution. Target boxes are plain
 * {id, x, y, z, hx, hy, hz} and optionally `yaw` (radians about +Y), which makes the box ORIENTED
 * (an OBB) rather than axis-aligned. Everything else is unchanged, so a target without `yaw` behaves
 * exactly as before.
 */
class ActionHitResolver {
    /**
     * Ray vs one target box. When the target carries a `yaw`, the RAY is transformed into the box's
     * local space (rotate origin+direction by -yaw about the box centre) and tested against the snug
     * axis-aligned extents there — mathematically an oriented-box test, but it reuses
     * ActionBoxGeometry.rayAABB untouched and returns a distance that's valid in world space too,
     * since a rotation preserves length.
     *
     * The alternative — inflating the box's horizontal half-extents to max(hx,hz) so an AABB still
     * covers the part at any facing — is what this replaces: it made every non-square part (chest,
     * torso, pelvis, feet) up to several cm too fat in one axis.
     */
    static _rayBox(ox, oy, oz, dx, dy, dz, tg) {
        const shape = tg.shape;
        const yaw = tg.yaw;
        // Transform the ray into the volume's local space (rotate by -yaw about its centre), then test
        // the exact primitive there. Same structure Source uses: VectorITransform the ray into bone
        // space and intersect. A rotation preserves length, so the distance returned is valid in world
        // space unchanged.
        let lox = ox, loy = oy, loz = oz, ldx = dx, ldy = dy, ldz = dz;
        if (yaw) {
            const c = Math.cos(yaw);
            const s = Math.sin(yaw);
            const rx = ox - tg.x;
            const rz = oz - tg.z;
            lox = rx * c - rz * s + tg.x;
            loz = rx * s + rz * c + tg.z;
            ldx = dx * c - dz * s;
            ldz = dx * s + dz * c;
        }
        // Undo the bone's own rotation, so an articulated part is tested in its own frame — the same
        // nested "into local space" step, one level further in.
        //
        // A QUATERNION when the volume carries one, because a clip rotates a limb on THREE axes and two
        // Euler angles cannot express that. Sending only `pitch` meant a crouched thigh was placed
        // diagonally but tested as an upright box — so shots landed in empty space beside the leg while
        // the drawn limb was somewhere else. Standing hid it: the aim layer is pitch-only, so `pitch`
        // was the whole story there.
        if (tg.q) {
            // Conjugate = inverse for a unit quaternion: rotate the ray INTO the volume's frame.
            const q = tg.q;
            const rot = (px, py, pz) => {
                const tx = 2 * (-q.y * pz + q.z * py);
                const ty = 2 * (-q.z * px + q.x * pz);
                const tz = 2 * (-q.x * py + q.y * px);
                return [
                    px + q.w * tx + (-q.y) * tz - (-q.z) * ty,
                    py + q.w * ty + (-q.z) * tx - (-q.x) * tz,
                    pz + q.w * tz + (-q.x) * ty - (-q.y) * tx
                ];
            };
            const p = rot(lox - tg.x, loy - tg.y, loz - tg.z);
            lox = p[0] + tg.x; loy = p[1] + tg.y; loz = p[2] + tg.z;
            const d = rot(ldx, ldy, ldz);
            ldx = d[0]; ldy = d[1]; ldz = d[2];
        } else if (tg.pitch) {
            const c = Math.cos(tg.pitch);
            const s = Math.sin(tg.pitch);
            const ry = loy - tg.y;
            const rz2 = loz - tg.z;
            // INVERSE of the rotation articulate() applied ([c, s; -s, c]), i.e. [c, -s; s, c].
            loy = ry * c - rz2 * s + tg.y;
            loz = ry * s + rz2 * c + tg.z;
            const tdy = ldy;
            ldy = tdy * c - ldz * s;
            ldz = tdy * s + ldz * c;
        }
        if (shape) {
            if (shape.kind === "sphere") {
                return ActionHitResolver._raySphere(lox, loy, loz, ldx, ldy, ldz, tg.x, tg.y, tg.z, shape.r);
            }
            if (shape.kind === "capsule" || shape.kind === "cylinder") {
                // Y-axis segment through the volume centre; `half` is centre -> each segment end.
                return ActionHitResolver._rayCapsule(
                    lox, loy, loz, ldx, ldy, ldz, tg.x, tg.y, tg.z, shape.half, shape.r, shape.kind === "cylinder"
                );
            }
        }
        return ActionBoxGeometry.rayAABB(lox, loy, loz, ldx, ldy, ldz, tg.x, tg.y, tg.z, tg.hx, tg.hy, tg.hz);
    }

    /**
     * Ray vs sphere. `dir` need not be unit; the returned distance is in units of |dir|, matching
     * rayAABB's convention. Returns the near entry distance, or null when the forward ray misses.
     */
    static _raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
        const mx = ox - cx;
        const my = oy - cy;
        const mz = oz - cz;
        const a = dx * dx + dy * dy + dz * dz;
        if (a < 1e-12) return null;
        const b = mx * dx + my * dy + mz * dz;
        const c = mx * mx + my * my + mz * mz - r * r;
        // Ray starts outside and points away — early out.
        if (c > 0 && b > 0) return null;
        const disc = b * b - a * c;
        if (disc < 0) return null;
        const t = (-b - Math.sqrt(disc)) / a;
        return t < 0 ? 0 : t; // inside the sphere ⇒ contact at the origin
    }

    /**
     * Ray vs a Y-axis capsule centred at (cx,cy,cz): a cylinder of half-length `half` with a
     * hemisphere of radius `r` on each end (total height = 2*half + 2*r). When `flatCaps` is true the
     * ends are flat discs instead (a cylinder), which is what the neck uses.
     *
     * Solves the infinite-cylinder quadratic in the XZ plane, then either clamps to the caps
     * (cylinder) or defers to the end spheres (capsule).
     */
    static _rayCapsule(ox, oy, oz, dx, dy, dz, cx, cy, cz, half, r, flatCaps) {
        const mx = ox - cx;
        const mz = oz - cz;
        const yTop = cy + half;
        const yBot = cy - half;
        const a = dx * dx + dz * dz;
        const b = mx * dx + mz * dz;
        const c = mx * mx + mz * mz - r * r;

        let best = null;
        const consider = (t) => {
            if (t === null || t < 0) return;
            if (best === null || t < best) best = t;
        };

        if (a > 1e-12) {
            const disc = b * b - a * c;
            if (disc >= 0) {
                const sq = Math.sqrt(disc);
                for (const t of [(-b - sq) / a, (-b + sq) / a]) {
                    if (t < 0) continue;
                    const y = oy + dy * t;
                    if (y >= yBot && y <= yTop) consider(t);
                    break; // near root first; if it's off the ends the caps below handle it
                }
            }
        } else if (c <= 0) {
            // Ray is parallel to the axis and inside the cylinder's radius — only the caps can hit.
            if (dy > 1e-12) consider((yBot - oy) / dy);
            else if (dy < -1e-12) consider((yTop - oy) / dy);
        }

        if (flatCaps) {
            // Flat end discs.
            if (Math.abs(dy) > 1e-12) {
                for (const yPlane of [yTop, yBot]) {
                    const t = (yPlane - oy) / dy;
                    if (t < 0) continue;
                    const px = ox + dx * t - cx;
                    const pz = oz + dz * t - cz;
                    if (px * px + pz * pz <= r * r) consider(t);
                }
            }
        } else {
            // Hemisphere caps: the two end spheres.
            consider(ActionHitResolver._raySphere(ox, oy, oz, dx, dy, dz, cx, yTop, cz, r));
            consider(ActionHitResolver._raySphere(ox, oy, oz, dx, dy, dz, cx, yBot, cz, r));
        }

        // Starting inside counts as an immediate contact, matching the box test's behaviour.
        if (best === null) {
            const dyc = oy > yTop ? oy - yTop : oy < yBot ? yBot - oy : 0;
            if (c <= 0 && dyc === 0) return 0;
        }
        return best;
    }

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
            const t = ActionHitResolver._rayBox(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, tg);
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
            const t = ActionHitResolver._rayBox(a.x, a.y, a.z, ux, uy, uz, tg);
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

    /**
     * Split a target id back into { playerId, part }. Per-body-part targets are keyed "<playerId>:<part>"
     * (see ActionSimTargetProvider.rewound); an id with no part (a whole-player box) yields part null.
     * Player ids never contain ':' — they're peer ids — so the last ':' is an unambiguous separator.
     */
    static splitHitId(hitId) {
        if (hitId === null || hitId === undefined) return { playerId: null, part: null };
        const i = String(hitId).lastIndexOf(":");
        if (i < 0) return { playerId: hitId, part: null };
        return { playerId: hitId.slice(0, i), part: hitId.slice(i + 1) };
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
     * (e.g. a projectile's half-width).
     *
     * PER-BODY-PART: each player contributes one box per hit volume (head, chest, limbs, ...) rather
     * than a single body-sized box, so a shot resolves to WHICH PART was hit. Ids are "<playerId>:<part>"
     * — ring 1 keys purely by id, so it needs no changes; ring 3 splits the part back off to look up a
     * damage multiplier (see ActionHitResolver.splitHitId).
     *
     * The volumes are authored in the reference collider's local space, so each is scaled to the
     * player's live collider (the rewound w/h vs. the reference), rotated by the rewound yaw, and
     * translated onto the rewound position — all state the server already records per tick, which is
     * what makes this work under lag compensation with no animation/skeleton involved.
     */
    rewound(tick, excludeId, pad = 0) {
        const out = [];
        const vols = ActionSimTargetProvider.volumes();
        for (const [id, e] of this.players) {
            if (id === excludeId || e.dead) continue;
            const past = this.server.stateAt(id, tick);
            if (!past) continue;
            const w = past.w || e.controller.width;
            const h = past.h || e.controller.height;
            if (!vols || !vols.length) {
                // No volume set available — fall back to one collider-sized box for the whole player.
                out.push({ id, x: past.x, y: past.y, z: past.z, hx: w / 2 + pad, hy: h / 2 + pad, hz: w / 2 + pad });
                continue;
            }
            // Reference collider the volumes were authored in (see ActionFPSCharacterModel).
            const sx = w / ActionSimTargetProvider.REF_W;
            // VERTICAL SCALE MUST MATCH WHAT THE MESH USES, or the volumes drift from the character.
            //
            // The body model drops the collider squash whenever a POSE is doing the work — a crouch
            // clip already lowers the hips and bends the knees, so squashing on top would apply it
            // twice. The volumes have to follow the same rule: applying `h/1.8` to an already-crouched
            // pose halved it again, leaving the leg boxes floating above the drawn leg. Shots passed
            // straight through the visible limb.
            const poseDriven = !!past.sliding || !!ActionSimTargetProvider._crouchClip(past, sx, h);
            const sy = poseDriven ? sx : h / ActionSimTargetProvider.REF_H;
            const yaw = past.yaw || 0;
            const cos = Math.cos(yaw);
            const sin = Math.sin(yaw);
            // Aim articulation: the upper body follows the rewound look pitch (two-stage, spine then
            // neck). `pitch` is already part of the per-tick state history, so this is lag-compensated
            // exactly like position and yaw are — no skeleton, no animation. Same table the visible
            // mesh uses (ActionFPSBodyModel.setState), so the boxes track what the player sees.
            const pitch = past.pitch || 0;
            // THE SAME POSE THE MESH USES, crouch clip included.
            //
            // Without this the visible character folds into a crouch while the hit volumes stay
            // standing — you would be shooting a phantom upright player. `h` is already in the rewound
            // snapshot, so crouch is derived from it exactly as ActionFPSBodyModel does, and it is
            // lag-compensated for free.
            const poseOpts = ActionSimTargetProvider.poseFor(past, sx, h);
            for (let i = 0; i < vols.length; i++) {
                const v = vols[i];
                const art = ActionSimTargetProvider.articulate(v.part, v.cx, v.cy, v.cz, pitch, poseOpts);
                // Bone scale, exactly as the mesh applies it. The hit volume and the visible limb are
                // the SAME THING — a clip that squashes a limb must squash its volume identically, or
                // you are shooting at something you cannot see.
                const bsx = art.sx === undefined ? 1 : art.sx;
                const bsy = art.sy === undefined ? 1 : art.sy;
                const bsz = art.sz === undefined ? 1 : art.sz;
                const lx = art.x * sx;
                const ly = art.y * sy;
                const lz = art.z * sx;
                // Yaw rotation about +Y, matching the body model's own posing convention.
                const rx = lx * cos + lz * sin;
                const rz = -lx * sin + lz * cos;
                // Snug half-extents plus the facing: ring 1 treats a target carrying `yaw` as an
                // ORIENTED box, so the volume turns with the player instead of being inflated to a
                // square that covers every facing.
                // Scale the exact primitive too, so a capsule limb stays a capsule at any player
                // scale/crouch. Radius follows the horizontal scale, length the vertical one.
                let shape = v.shape;
                if (shape) {
                    shape = shape.kind === "sphere"
                        ? { kind: "sphere", r: shape.r * sx * bsx + pad }
                        : { kind: shape.kind, r: shape.r * sx * bsx + pad, half: shape.half * sy * bsy };
                }
                out.push({
                    id: id + ":" + v.part,
                    x: past.x + rx,
                    y: past.y + ly,
                    z: past.z + rz,
                    hx: v.hx * sx * bsx + pad,
                    hy: v.hy * sy * bsy + pad,
                    hz: v.hz * sx * bsz + pad,
                    shape,
                    yaw,
                    // Pitch this volume accumulated from the aim chain (0 for anything below the waist),
                    // so a pitched limb TIPS rather than sliding while staying upright.
                    pitch: art.pitch,
                    // The bone's FULL rotation, when a clip is driving it. `pitch` alone cannot express
                    // a 3-axis rotation, so a crouched limb was placed diagonally and then tested as an
                    // upright box — hits registered in the empty space beside the leg. Omitted when the
                    // rotation is identity so the cheaper pitch path stays in use for the aim layer.
                    q: (art.qx || art.qy || art.qz) && Math.abs(art.qw - 1) > 1e-6
                        ? { x: art.qx, y: art.qy, z: art.qz, w: art.qw }
                        : null
                });
            }
        }
        return out;
    }

    /** Reference collider the hit volumes are authored in (matches ActionFPSCharacterModel). */
    static REF_W = 0.6;
    static REF_H = 1.8;

    /** The character's hit-volume set (engine default unless a game overrides it). */
    static volumes() {
        if (ActionSimTargetProvider._volumes) return ActionSimTargetProvider._volumes;
        if (typeof ActionFPSCharacterModel !== "undefined") return ActionFPSCharacterModel.hitVolumes();
        return null;
    }

    /** Supply a custom volume set (same shape as ActionFPSCharacterModel.hitVolumes()). */
    static setVolumes(v) {
        ActionSimTargetProvider._volumes = v;
        return ActionSimTargetProvider;
    }

    /**
     * Aim articulation for one volume, delegated to the character model so the hit volumes and the
     * visible mesh share one definition. Inert (identity) when no character model is present — a game
     * supplying its own volumes via setVolumes() gets rigid volumes unless it also supplies this.
     */
    static articulate(part, x, y, z, pitch, opts) {
        if (typeof ActionFPSCharacterModel !== "undefined" && ActionFPSCharacterModel.articulate) {
            return ActionFPSCharacterModel.articulate(part, x, y, z, pitch, opts);
        }
        return { x, y, z, pitch: 0 };
    }

    /**
     * The pose description for a rewound player — the SAME one ActionFPSBodyModel builds for the mesh.
     *
     * Both sides must derive it identically or the volumes stop matching the character. Crouch comes
     * from the collider height in the snapshot, which is already rewound, so nothing new is networked
     * and nothing new has to be stored per tick.
     *
     * Kept here rather than duplicated in the body model because the two MUST agree; if this ever
     * grows a second input (a walk cycle's clip + time), it grows in one place.
     */
    static poseFor(past, sx, h) {
        const clip = ActionSimTargetProvider._crouchClip(past, sx, h);
        // Hold weight matches the body model: a clip carries its own arm pose, so the code hold would
        // apply twice; a slide would otherwise leave the arm pointing out of a horizontal body.
        return { hold: past.sliding || clip ? 0 : 1, clip: clip || null, time: 0 };
    }

    /**
     * The crouch clip for a rewound player, or null.
     *
     * Crouch is DERIVED from the collider height in the snapshot — already rewound, so nothing extra is
     * networked or stored per tick. Factored out because two call sites need it and they must not
     * disagree: one picks the pose, the other decides whether to apply the collider's vertical squash.
     * Answer differently in those two places and the volumes get squashed twice while the mesh does not.
     */
    static _crouchClip(past, sx, h) {
        if (past.sliding) return null;
        if (h >= ActionSimTargetProvider.REF_H * sx * 0.99) return null;
        return typeof ActionFPSBodyModel !== "undefined" ? ActionFPSBodyModel.clip("crouch") : null;
    }
}
