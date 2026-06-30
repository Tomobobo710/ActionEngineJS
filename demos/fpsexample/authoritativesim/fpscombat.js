// fpscombat.js — FPS combat (game-side): server-authoritative hitscan with lag compensation,
// health, death/respawn, and a PLUGGABLE damage filter (game modes). It rides on the ActionSim
// framework's per-player state history (server.stateAt) for rewind. Combat is multiplayer-only
// (single-player has no enemy players); the hit logic lives in FPSSession (fpsnet.js).

/**
 * Wraps a player CONTROLLER as a sim entity that carries combat into its snapshot and freezes input
 * while dead. The HEALTH STORE is the controller's own ActionFPSCombat component (`controller.combat`)
 * — this wrapper DELEGATES health/dead/maxHealth to it, so there's one source of truth for a player's
 * combat state across single-player and multiplayer. The host's FPSCombat (the lag-comp resolver) and
 * the respawn scheduler write through these delegating accessors; `team`/`respawnAtTick`/`heldProp`
 * are host-side scheduling/policy and stay on the wrapper.
 */
class FPSPlayerEntity {
    constructor(controller, id, team) {
        this.controller = controller;
        this.id = id;
        this.team = team !== undefined ? team : null;
        this.respawnAtTick = 0; // host respawn scheduling (serverTick); not character state
    }
    // Combat state lives on controller.combat (the single sink). The host mutates these directly
    // (v.health -= dmg, v.dead = true, v.health = v.maxHealth on respawn) and they write through.
    get maxHealth() { return this.controller.combat.maxHealth; }
    get health() { return this.controller.combat.health; }
    set health(v) { this.controller.combat.health = v; }
    get dead() { return this.controller.combat.dead; }
    set dead(v) { this.controller.combat.dead = v; }
    // Held prop delegates to the controller's grabber (the single store, like health). The host writes
    // through it (serverToggle/drive) and the snapshot reads it; `v.heldProp = null` on death drops it.
    get heldProp() { return this.controller.grabber ? this.controller.grabber.held : null; }
    set heldProp(v) { if (this.controller.grabber) this.controller.grabber.held = v; }
    beginStep(cmd, dt) {
        // A dead player can't move or act — feed a zeroed command (the body still falls/rests).
        this.controller.beginStep(this.dead ? FPSPlayerEntity.DEAD_CMD : cmd, dt);
    }
    endStep(dt) {
        this.controller.endStep(dt);
    }
    getState() {
        const s = this.controller.getState();
        s.health = this.health;
        s.dead = this.dead;
        s.team = this.team;
        return s;
    }
    setState(s) {
        this.controller.setState(s);
    }
}
FPSPlayerEntity.DEAD_CMD = {
    forward: 0,
    right: 0,
    jumpPressed: false,
    jumpHeld: false,
    sprint: false,
    crouch: false
};

/**
 * Weapon registry (data-driven; game-side). The game keeps the equipped slot (`weaponSlot`) and
 * ships it through the controller's opaque `userData` payload; THIS table maps slot → behavior.
 * The controller itself knows nothing of weapons. `type` selects the fire path:
 *   - 'hitscan'  : authoritative lag-comp ray (instant). `damage` per hit.
 *   - 'projectile': spawns a replicated rocket (travels + explodes). Splash/knockback params.
 * `fireCooldownTicks` is the authoritative fire-rate (server-enforced). Add a weapon = add a
 * row (+ a viewmodel in game.js; projectiles reuse the rocket machinery).
 */
const FPS_WEAPONS = [
    { name: "Gun", type: "hitscan", damage: 25, fireCooldownTicks: 8, magSize: 12 },
    {
        name: "Rocket Launcher",
        type: "projectile",
        fireCooldownTicks: 18, // ~0.3s between rockets (≈3/s; many can be in flight at once)
        magSize: 4, // shots before a reload (R)
        speed: 380, // world units / second
        lifeTicks: 1800, // self-destruct after 30s of no contact (60Hz)
        directDamage: 50, // bonus for a direct body hit (on top of splash)
        splashDamage: 55, // HP at the blast center, linear falloff to 0 at splashRadius
        splashRadius: 70, // world units
        knockback: 130, // peak shove speed at center (rocket-jumping; applies to self too)
        upBias: 70 // extra upward shove at center (makes self/others pop up)
    }
];

/**
 * Server-side snapshot source for a flying rocket (wraps its authoritative physics body).
 * Replicated via the SAME `server.addObject` path as props, so it streams to clients as a
 * moving entity (type:'rocket') with no extra plumbing. `shooter` lets the client skip
 * self-rendering later and lets the explosion attribute the kill.
 */
class FPSRocketEntity {
    constructor(model, shooterId, vx, vy, vz) {
        this.model = model; // ActionModel3D — GLB-swappable, not in physics world
        this.shooterId = shooterId;
        this.vx = vx; this.vy = vy; this.vz = vz;
    }
    getState() {
        const p = this.model.objects[0].transform.position;
        return { type: "rocket", x: p.x, y: p.y, z: p.z, vx: this.vx, vy: this.vy, vz: this.vz, shooter: this.shooterId };
    }
}

/**
 * Damage-eligibility filter + team assignment. This is THE configurability seam: swap the
 * game's `gameMode` for any object exposing `canDamage(attackerId, victimId, ctx)` and
 * `assignTeam(id, joinIndex)`. `ctx.teamOf(id)` looks up a player's team. Base class = FFA.
 */
class FPSGameMode {
    constructor(opts = {}) {
        this.name = opts.name || "ffa";
    }
    /** FFA: everyone is their own side. */
    assignTeam(id, joinIndex) {
        return null;
    }
    /** Anyone may damage anyone but themselves. */
    canDamage(attackerId, victimId, ctx) {
        return attackerId !== victimId;
    }
}

/** Free-for-all (the default). Identical to the base; named for clarity. */
class FFAMode extends FPSGameMode {
    constructor() {
        super({ name: "ffa" });
    }
}

/** N-team deathmatch: same team can't damage each other (round-robin team assignment). */
class TeamMode extends FPSGameMode {
    constructor(numTeams = 2) {
        super({ name: "team" });
        this.numTeams = numTeams;
    }
    assignTeam(id, joinIndex) {
        return joinIndex % this.numTeams;
    }
    canDamage(attackerId, victimId, ctx) {
        if (attackerId === victimId) return false;
        return ctx.teamOf(attackerId) !== ctx.teamOf(victimId);
    }
}

/**
 * FPSCombat — the host-authoritative combat system, extracted out of FPSSession so the session
 * stays a thin composition root. Owns the authoritative fire dispatch (hitscan + rockets), lag-comp
 * hit resolution, splash/knockback, HP damage, the kill plane, and respawns. It BORROWS the
 * session-owned structures (serverWorld/serverPlayers/server/serverTransport/gameMode) by reference,
 * so behaviour is identical to when this lived on the session — mutations are shared. Only the host
 * constructs one (guests never run authoritative combat).
 *
 * This is still game-side: HP/respawn/eligibility are policy. The reusable mechanism (lag-comp
 * rewind, ray-box resolution) is a candidate to migrate behind an engine ring-2 adapter later.
 */
class FPSCombat {
    constructor(session) {
        this.session = session;
        // Borrowed — same object refs as the session; mutations stay shared.
        this.serverWorld = session.serverWorld;
        this.serverPlayers = session.serverPlayers;
        this.server = session.server;
        this.serverTransport = session.serverTransport;
        this.gameMode = session.gameMode;
        this.spawnFor = (i) => session.spawnFor(i);
        // Owned authoritative combat state.
        this.combat = { range: 1000, respawnTicks: 180, shotImpulse: 60 };
        this.weapons = FPS_WEAPONS; // data-driven weapon defs (indexed by the controller slot)
        this._lastFireTick = new Map(); // id -> serverTick of last shot (authoritative fire rate)
        this.rockets = new Map(); // id -> { ent, model, shooterId, prevPos, life } (host-authoritative)
        this._rocketSeq = 0;
        // Ring 2: the lag-comp target provider (the swappable sim seam). An offline/custom sim would
        // supply a different provider with the same rewound() shape; ring 1 + ring 3 don't change.
        this.targets = new ActionSimTargetProvider(session.server, session.serverPlayers);
    }

    /** Forget a player's fire-rate state on disconnect. */
    removePlayer(id) {
        this._lastFireTick.delete(id);
    }

    _aimDir(yaw, pitch) {
        const cp = Math.cos(pitch || 0);
        return new Vector3(Math.sin(yaw || 0) * cp, Math.sin(pitch || 0), Math.cos(yaw || 0) * cp);
    }

    /**
     * Authoritative fire dispatch for one player's command (host only). Lag-compensated: every
     * other player is rewound to the shooter's `viewTick` (what they saw) before the hit test, and
     * the ray is occluded by world/props. Damage is gated by the pluggable gameMode filter.
     */
    onFire(id, cmd, server) {
        if (!cmd.fire) return;
        const shooter = this.serverPlayers.get(id);
        if (!shooter || shooter.dead) return;

        const slot = (cmd.userData && cmd.userData.weapon) | 0; // equipped slot from the opaque payload
        const weapon = this.weapons[slot % this.weapons.length] || this.weapons[0];

        // Authoritative, PER-WEAPON fire-rate. The client already rate-limits to
        // fireCooldownTicks; we allow a few ticks of slack here so clock/cadence jitter can't
        // falsely reject a shot the client legitimately fired (which would drop a rocket).
        const now = server.serverTick;
        const gate = Math.max(1, weapon.fireCooldownTicks - 4);
        if (now - (this._lastFireTick.get(id) || -9999) < gate) return;
        this._lastFireTick.set(id, now);

        const ctrl = shooter.controller;
        // Fire along the exact ray the CLIENT aimed with (the crosshair line): in 3rd person that's
        // the camera's center ray (origin = camera, NOT the eye), in FP the eye ray. Using the
        // client's ray makes authoritative damage land under their crosshair and match the predicted
        // tracer at every depth. Falls back to eye + yaw/pitch for older commands. (Aim is already
        // client-owned/trusted in this design, so trusting the ray origin is consistent.)
        const dir =
            cmd.aimX !== undefined
                ? new Vector3(cmd.aimX, cmd.aimY, cmd.aimZ).normalize()
                : this._aimDir(cmd.yaw, cmd.pitch).normalize();
        const origin =
            cmd.aimOX !== undefined ? new Vector3(cmd.aimOX, cmd.aimOY, cmd.aimOZ) : ctrl.getEyePosition();
        // Authoritative muzzle = the gun on the shooter's BODY (never their camera). Remote tracers
        // and rockets originate here so everyone sees the shot leave the weapon.
        const bp = ctrl.body.position;
        const muzzle = ActionFPSWeaponSystem.bodyWeaponPose(bp.x, bp.y, bp.z, cmd.yaw || 0, cmd.pitch || 0, ctrl.width / 6, slot).muzzle;

        if (weapon.type === "projectile") {
            // How far behind real-time the shooter was rendering when they fired (interp delay +
            // their latency, in ticks). The rocket carries it so every flight tick rewinds victims
            // by the SAME amount — reproducing what the shooter saw for the whole trajectory.
            const viewDelay = cmd.viewTick !== undefined ? Math.max(0, now - cmd.viewTick) : 0;
            this._spawnRocket(id, origin, dir, muzzle, weapon, viewDelay);
            return;
        }
        this._hitscan(id, cmd, origin, dir, muzzle, weapon, now);
    }

    /** Authoritative lag-comp hitscan (weapon.type === 'hitscan'). Broadcasts fx_shot every shot.
     *  Geometry is engine ring-1 (ActionHitResolver) over ring-2 rewound targets; this method is
     *  ring-3 policy: eligibility (canDamage), the damage sink (_applyDamage), and the FX broadcast. */
    _hitscan(id, cmd, origin, dir, muzzle, weapon, now) {
        // Ring 2: rewind every other player to the shooter's view tick (occlusion ignores player
        // bodies — players are hit via these rewound boxes, not their live positions).
        const viewTick = cmd.viewTick !== undefined ? cmd.viewTick : now;
        const targets = this.targets.rewound(viewTick, id);
        // Ring 1: nearest of (world occlusion, rewound boxes) along the client's crosshair ray.
        const { endDist, hitId, worldHit } = ActionHitResolver.hitscan(
            origin, dir, this.combat.range, this.serverWorld, targets, { ignoreObjects: ["srv_"] }
        );

        const ctx = { teamOf: (pid) => (this.serverPlayers.get(pid) || {}).team };
        let victim = null;
        let killed = false;
        if (hitId !== null) {
            // A player box was hit first; the tracer stops at them either way (endDist reflects it),
            // but damage applies only when the mode allows.
            if (this.gameMode.canDamage(id, hitId, ctx)) {
                victim = hitId;
                killed = this._applyDamage(hitId, weapon.damage, now);
            }
        } else if (worldHit && worldHit.body && !worldHit.body.isStatic) {
            // No player in the way — the nearest solid is a dynamic prop: shove it (authoritative;
            // replicates to every client via snapshots, so MP matches single-player).
            const j = this.combat.shotImpulse;
            worldHit.body.applyImpulse(new Vector3(dir.x * j, dir.y * j + 8, dir.z * j));
        }

        // One fx_shot per shot (even a miss) so every client draws the tracer to the real
        // endpoint; victim/killed drive the shooter's hit marker and the victim's damage flash.
        this.serverTransport.broadcast({
            type: "fx_shot",
            shooter: id,
            ox: muzzle.x,
            oy: muzzle.y,
            oz: muzzle.z,
            ex: origin.x + dir.x * endDist,
            ey: origin.y + dir.y * endDist,
            ez: origin.z + dir.z * endDist,
            victim,
            killed
        });
    }

    /** Spawn a host-authoritative rocket. Pure swept-raycast projectile — no physics body, so
     *  players can never step on it. The model is ActionModel3D (GLB-swappable) and is added
     *  directly to the host's render list; remote clients render via snapshots (rocketViews). */
    _spawnRocket(shooterId, aimOrigin, dir, muzzle, weapon, viewDelay = 0) {
        const spd = weapon.speed;
        const range = this.combat.range;
        const aimEnd = new Vector3(
            aimOrigin.x + dir.x * range,
            aimOrigin.y + dir.y * range,
            aimOrigin.z + dir.z * range
        );
        const aimHit = ActionRaycast3D.cast(aimOrigin, aimEnd, this.serverWorld, { ignoreObjects: ["srv_"] });
        const target = aimHit ? new Vector3(aimHit.point.x, aimHit.point.y, aimHit.point.z) : aimEnd;
        const fdir = target.sub(muzzle).normalize();
        const vx = fdir.x * spd, vy = fdir.y * spd, vz = fdir.z * spd;

        // Small rocket projectile geometry — MUST match the client's snapshot-driven rocketViews
        // (ActionBoxGeometry.build(2,2,6,"#ffcf6a") in _updateRocketView) so the host and guests see the same
        // flying rocket. Was ActionFPSWeaponSystem.buildWeaponMesh(1) (the launcher mesh), which made every remote
        // rocket render as a rocket launcher in the host's view. Swap for a GLB later.
        const g = ActionBoxGeometry.build(2, 2, 6, "#ffcf6a");
        const model = new ActionModel3D();
        model.addObject("rocket", g.triangles, 0, new Vector3(muzzle.x, muzzle.y, muzzle.z), Quaternion.fromDirection(vx, vy, vz), new Vector3(1, 1, 1));
        model.objects[0].isStatic = false;

        const id = "rkt" + this._rocketSeq++;
        const ent = new FPSRocketEntity(model, shooterId, vx, vy, vz);
        this.server.addObject(id, ent);
        this.rockets.set(id, { ent, model, shooterId, prevPos: new Vector3(muzzle.x, muzzle.y, muzzle.z), life: weapon.lifeTicks, weapon, viewDelay });
    }

    /** Advance flying rockets one tick: sweep the segment just traversed for impact, then explode.
     *  The swept hit test is engine ring-1 (ActionHitResolver.sweep) over ring-2 rewound targets
     *  (per-rocket rewind by the shooter's render delay); the detonation effects (_explode) are ring-3. */
    _updateRockets(dt) {
        for (const [id, r] of this.rockets) {
            const { vx, vy, vz } = r.ent;
            const a = r.prevPos;
            const b = new Vector3(a.x + vx * dt, a.y + vy * dt, a.z + vz * dt);
            r.model.objects[0].transform.position = b;

            // Ring 2: rewind victims by the shooter's render delay (present − viewDelay), padded by the
            // rocket's half-width; skip the shooter (no self direct-hit — splash still applies below).
            const targets = this.targets.rewound(this.server.serverTick - r.viewDelay, r.shooterId, 1);
            // Ring 1: first contact of the swept segment with (world occlusion, rewound boxes).
            const { impact } = ActionHitResolver.sweep(a, b, this.serverWorld, targets, { ignoreObjects: ["srv_"] });

            if (impact) {
                this._explode(id, r, { x: impact.x, y: impact.y, z: impact.z, directHitId: impact.hitId });
                continue;
            }

            r.prevPos = b;
            if (--r.life <= 0) this._explode(id, r, { x: b.x, y: b.y, z: b.z, directHitId: null });
        }
    }

    /**
     * Detonate rocket `id` at `center`: direct + splash HP damage (gated by gameMode), splash
     * KNOCKBACK to every player in radius INCLUDING the shooter (rocket-jumping — no self HP
     * damage, because canDamage(self,self) is false), a shove on nearby props, and an
     * fx_explosion broadcast so clients drop the rocket view and play the blast.
     */
    _explode(id, r, impact) {
        const w = r.weapon;
        const ctx = { teamOf: (pid) => (this.serverPlayers.get(pid) || {}).team };
        const now = this.server.serverTick;
        const hurt = [];
        const killed = [];

        for (const [vid, victim] of this.serverPlayers) {
            if (victim.dead) continue;
            const c = victim.controller;
            const p = c.body.position;
            const cy = p.y + c.height * 0.25; // aim the blast vector at mid-body, not the feet
            let ox = p.x - impact.x;
            let oy = cy - impact.y;
            let oz = p.z - impact.z;
            const d = Math.hypot(ox, oy, oz);
            if (d > w.splashRadius) continue;
            const fall = 1 - d / w.splashRadius; // 1 at center → 0 at the rim

            // KNOCKBACK (everyone, including the shooter — this is the rocket jump).
            if (d < 1e-3) {
                ox = 0;
                oy = 1;
                oz = 0;
            } else {
                ox /= d;
                oy /= d;
                oz /= d;
            }
            const push = w.knockback * fall;
            c.applyKnockback(ox * push, oy * push + w.upBias * fall, oz * push);

            // HP DAMAGE (only when the mode allows — excludes self and teammates).
            if (this.gameMode.canDamage(r.shooterId, vid, ctx)) {
                let dmg = w.splashDamage * fall;
                if (vid === impact.directHitId) dmg += w.directDamage;
                const wasKilled = this._applyDamage(vid, dmg, now);
                hurt.push(vid);
                if (wasKilled) killed.push(vid);
            }
        }

        // Shove nearby dynamic props for juice (authoritative; replicates via snapshots).
        // world.objects holds ActionPhysicsBox3D wrappers; mass/name/impulse are on the body.
        for (const obj of this.serverWorld.objects) {
            if (!obj || !obj.body || obj.body.isStatic) continue; // static geometry
            const nm = obj.body.name || "";
            if (nm.indexOf("srv_") === 0) continue; // skip player bodies
            const bp = obj.body.position;
            let ox = bp.x - impact.x;
            let oy = bp.y - impact.y;
            let oz = bp.z - impact.z;
            const d = Math.hypot(ox, oy, oz);
            if (d > w.splashRadius || d < 1e-3) continue;
            const f = (1 - d / w.splashRadius) * 90;
            obj.body.applyImpulse(new Vector3((ox / d) * f, (oy / d) * f + 20, (oz / d) * f));
        }

        // Despawn the authoritative rocket (snapshot list) and tell clients. No world body to remove
        // — the rocket was never added to serverWorld (see _spawnRocket).
        this.server.removeObject(id);
        this.rockets.delete(id);
        this.serverTransport.broadcast({
            type: "fx_explosion",
            id,
            x: impact.x,
            y: impact.y,
            z: impact.z,
            shooter: r.shooterId,
            hurt,
            killed
        });
    }

    /** Apply damage to a player; returns true if this killed them. */
    _applyDamage(victimId, dmg, nowTick) {
        const v = this.serverPlayers.get(victimId);
        if (!v || v.dead) return false;
        v.health -= dmg;
        if (v.health <= 0) {
            v.health = 0;
            v.dead = true;
            v.heldProp = null; // drop whatever they were carrying on death
            v.respawnAtTick = nowTick + this.combat.respawnTicks;
            return true;
        }
        return false;
    }

    /** Kill any living player who fell below the world kill plane (host-authoritative). */
    _checkKillPlane() {
        const now = this.server.serverTick;
        for (const [id, v] of this.serverPlayers) {
            if (v.dead) continue;
            if (v.controller.body.position.y < Game.KILL_Y) this._applyDamage(id, 1e9, now);
        }
    }

    /** Respawn dead players whose timer has elapsed (host only). */
    _updateRespawns() {
        const now = this.server.serverTick;
        let i = 0;
        for (const [id, v] of this.serverPlayers) {
            if (v.dead && now >= v.respawnAtTick) {
                const spawn = this.spawnFor(i);
                v.controller.setState({ x: spawn.x, y: spawn.y, z: spawn.z, vx: 0, vy: 0, vz: 0, grounded: false });
                v.health = v.maxHealth;
                v.dead = false;
                // Authoritative teleport — tell the owning client to snap, not reconcile across it.
                this.server.markResync(id);
            }
            i++;
        }
    }
}
