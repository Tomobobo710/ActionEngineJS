// actionfpsweapon.js — the per-character WEAPON component (engine mechanism). One of these rides on
// every ActionFPSController3D that has weapons enabled; it owns the equipped slot, per-slot ammo,
// recoil, the first-person viewmodels, the cosmetic FX pools (tracers / rockets / explosions), and
// the world-coupled fire dispatch (hitscan ray + projectile sim). It reads everything it needs off
// its owning CONTROLLER — aim is the controller's look, the world is the controller's physics world,
// the shooter id is the controller's body — so a developer never wires it: `new ActionFPSController3D`
// builds and drives it.
//
// Two optional seams keep it sim-agnostic:
//   • view    — { isFirstPerson, cameraPosition } : where the crosshair ray starts and whether to
//               draw the held viewmodel vs. the gun on the third-person body. Absent ⇒ first-person.
//   • context — { isNetworked, enemyBoxes() } : the networked seam. Offline (absent/false) the
//               component resolves its own shots against the world and pushes props / rocket-jumps;
//               networked, damage is the host's job and this only plays predicted/cosmetic FX.
//
// The single weapon RIG, body-gun pose, weapon meshes, and muzzle-tip resolution are shared static
// mechanism (ActionFPSWeaponSystem). The roster CONTENT defaults to ActionFPSWeapon.DEFAULT_ROSTER
// (gun + rocket launcher) so the character is armed out of the box; a game passes its own roster to
// override. Nothing here knows about a specific game.

class ActionFPSWeapon {
    /**
     * @param {ActionFPSController3D} controller  the owning character (aim/world/shooter)
     * @param {object} [opts]
     * @param {Array}  [opts.roster]    weapon defs (slot-indexed); defaults to DEFAULT_ROSTER
     * @param {object} [opts.models]    { slot: mesh } GLB overrides (else procedural defaults)
     * @param {object} [opts.view]      { isFirstPerson:bool, cameraPosition:Vector3 } camera seam
     * @param {object} [opts.context]   { isNetworked:bool, enemyBoxes():[] } networked seam
     */
    constructor(controller, opts = {}) {
        this.controller = controller;
        this.weaponDefs = opts.roster || ActionFPSWeapon.DEFAULT_ROSTER;
        this.view = opts.view || null; // null ⇒ first-person, camera at the eye
        this.context = opts.context || null; // null ⇒ offline (resolve our own shots)
        // Aim source. Default ⇒ the controller's own look (correct standalone). A game that keeps a
        // LIVE client-owned aim (separate from the controller's reconciled sim yaw — the netcode
        // cornerstone) injects { yaw, pitch, direction() } so the viewmodel / muzzle / crosshair track
        // the present view, not the one-tick-old commanded facing.
        this.aimProvider = opts.aimProvider || null;

        // Apply any per-slot model overrides to the shared weapon system before building viewmodels.
        if (opts.models) for (const slot in opts.models) ActionFPSWeaponSystem.setWeaponModel(+slot, opts.models[slot]);

        this.weaponSlot = 0;
        this._weaponModels = []; // keep ActionModel3D wrappers alive
        this.viewmodels = this.weaponDefs.map((_, slot) => this._buildViewmodel(slot));
        this.viewmodel = this.viewmodels[this.weaponSlot];
        this.recoil = 0;
        this._fireCooldown = 0; // client-side fire-rate gate (fixed ticks); mirrors the host's fireCooldownTicks
        this.tracers = [];
        this.localRockets = []; // offline cosmetic rockets (networked rockets live host-side)
        this.explosions = []; // brief blast FX (both modes)
        // Per-slot ammo. magSize comes from the weapon def; a weapon without one never empties/reloads.
        this.ammo = this.weaponDefs.map((w) => (w.magSize != null ? w.magSize : Infinity));
    }

    // ---- Seam helpers (offline-safe defaults) ------------------------------
    get _firstPerson() { return this.view ? this.view.isFirstPerson : true; }
    get _cameraPos() { return this.view && this.view.cameraPosition ? this.view.cameraPosition : this.controller.getEyePosition(); }
    get _isNetworked() { return !!(this.context && this.context.isNetworked); }
    get _aimYaw() { return this.aimProvider ? this.aimProvider.yaw : this.controller.yaw; }
    get _aimPitch() { return this.aimProvider ? this.aimProvider.pitch : this.controller.pitch; }
    _lookDir() { return (this.aimProvider ? this.aimProvider.direction() : this.controller.getLookDirection()).normalize(); }

    // ---- Equipped slot + ammo ----------------------------------------------
    get activeDef() { return this.weaponDefs[this.weaponSlot]; }
    get activeAmmo() { return this.ammo[this.weaponSlot]; }
    get activeMag() { return this.weaponDefs[this.weaponSlot].magSize; }
    canFire() { return this.ammo[this.weaponSlot] > 0; }

    /** Empty trigger pull (no ammo) — emits the `empty` signal (the dry click). */
    fireEmpty() { ActionFPSWeaponSystem.emit("empty", { slot: this.weaponSlot }); }

    /** Refill the active weapon's magazine (no-op if full or unlimited). Emits `reload`. */
    reload() {
        const def = this.weaponDefs[this.weaponSlot];
        if (def.magSize == null || this.ammo[this.weaponSlot] >= def.magSize) return;
        this.ammo[this.weaponSlot] = def.magSize;
        ActionFPSWeaponSystem.emit("reload", { slot: this.weaponSlot });
    }

    selectWeapon(slot) {
        if (slot < 0 || slot >= this.weaponDefs.length || slot === this.weaponSlot) return;
        const prev = this.weaponSlot;
        ActionFPSWeaponSystem.emit("holster", { slot: prev, name: this.weaponDefs[prev].name });
        this.weaponSlot = slot;
        this.viewmodel = this.viewmodels[slot];
        ActionFPSWeaponSystem.emit("draw", { slot, name: this.weaponDefs[slot].name });
        ActionFPSWeaponSystem.emit("equip", { slot, name: this.weaponDefs[slot].name });
    }

    /** Per-frame: decay recoil + age the cosmetic FX (tracers/rockets/explosions). */
    update(dt) {
        this.recoil *= Math.pow(0.0001, dt);
        if (this.recoil < 0.001) this.recoil = 0;
        for (const t of this.tracers) t.life -= dt;
        this.tracers = this.tracers.filter((t) => t.life > 0);
        this._stepLocalRockets(dt);
        for (const e of this.explosions) e.life -= dt;
        this.explosions = this.explosions.filter((e) => e.life > 0);
    }

    // ---- Viewmodels --------------------------------------------------------

    // FP viewmodels reuse the SAME geometry as the weapon on the third-person/remote body
    // (ActionFPSWeaponSystem.buildWeaponMesh), so the gun you hold and the gun others see are one model.
    _buildViewmodel(slot) {
        const g = ActionFPSWeaponSystem.buildWeaponMesh(slot);
        const model = new ActionModel3D();
        model.addObject("weaponViewmodel" + slot, g.tris, 0, new Vector3(0, 0, 0), new Quaternion(0, 0, 0, 1), new Vector3(1, 1, 1));
        this._weaponModels.push(model);
        const obj = model.objects[0];
        obj._muzzleZ = g.muzzleZ;
        return obj;
    }

    updateViewmodel() {
        const eye = this._cameraPos;
        const fwd = this._lookDir();
        const worldUp = new Vector3(0, 1, 0);
        const right = worldUp.cross(fwd).normalize();
        const up = fwd.cross(right).normalize();
        const oz = 5.0 - this.recoil * 2.0;
        this.viewmodel.transform.position = eye.add(right.mult(-2.4)).add(up.mult(-2.2)).add(fwd.mult(oz));
        this.viewmodel.transform.rotation = Quaternion.fromEuler(0, -this._aimPitch, this._aimYaw);
        this.viewmodel.transform.scale = new Vector3(3, 3, 3);
    }

    // ---- Muzzle + aim ------------------------------------------------------

    /**
     * World-space muzzle the LOCAL shot FX emits from, matched to the camera:
     *   first-person → the held viewmodel's barrel tip; third-person → the gun on our own body.
     */
    activeMuzzle() {
        if (this._firstPerson) return this.muzzlePoint();
        const ctrl = this.controller;
        const p = ctrl.body.position;
        return ActionFPSWeaponSystem.bodyWeaponPose(p.x, p.y, p.z, this._aimYaw, this._aimPitch, ctrl.width / 6, this.weaponSlot).muzzle;
    }

    /** World-space muzzle tip of the active first-person viewmodel. */
    muzzlePoint() {
        const eye = this._cameraPos;
        const fwd = this._lookDir();
        const worldUp = new Vector3(0, 1, 0);
        const right = worldUp.cross(fwd).normalize();
        const up = fwd.cross(right).normalize();
        const oz = 5.0 - this.recoil * 2.0 + (this.viewmodel._muzzleZ || 3) * 3;
        return eye.add(right.mult(-2.4)).add(up.mult(-2.2)).add(fwd.mult(oz));
    }

    // What the crosshair is over. The crosshair sits at screen center = the CAMERA's center ray, so in
    // third person we cast from the camera, not the eye. First person: camera == eye. {origin,dir,hit,point}.
    crosshairCast(world = this.controller.physicsWorld) {
        const ctrl = this.controller;
        const origin = this._firstPerson ? ctrl.getEyePosition() : this._cameraPos;
        const dir = this._lookDir();
        const end = origin.add(dir.mult(1000));
        const hit = ActionRaycast3D.cast(origin, end, world, ctrl.raycastIgnore);
        const point = hit ? new Vector3(hit.point.x, hit.point.y, hit.point.z) : end;
        return { origin, dir, hit, point };
    }

    // ---- Fire --------------------------------------------------------------

    /**
     * Client-side predicted-fire GATE. Call ONCE per fixed tick with the trigger intent (`wantFire`).
     * It decrements the rate-limit cooldown every call, then — when you want to fire AND the weapon is
     * ready (cooled down + has ammo) — restarts the cooldown and returns true (you then call fire()).
     * Returns false while still cooling, and on an empty mag emits the dry-click (`empty`) and returns
     * false. The cooldown mirrors the def's `fireCooldownTicks` (the same rate the host enforces), so a
     * networked client never predicts a shot the server will reject — the desync that let spammed
     * rockets launch without ever exploding. Does NOT fire or spend ammo itself (fire() owns that).
     */
    tryPredictFire(wantFire) {
        if (this._fireCooldown > 0) this._fireCooldown--;
        if (!wantFire) return false;
        if (this._fireCooldown > 0) return false; // still cooling
        if (!this.canFire()) { this.fireEmpty(); return false; } // empty mag → dry click
        this._fireCooldown = this.activeDef.fireCooldownTicks;
        return true;
    }

    // Predicted/local fire FX (networked: damage is authoritative on the host). Dispatches by type:
    //   hitscan    → muzzle-attached tracer to the impact (+ prop push offline);
    //   projectile → a rocket (offline: the real one; networked: a predicted cosmetic copy).
    fire() {
        const def = this.activeDef;
        this.ammo[this.weaponSlot]--; // gated by canFire() upstream; Infinity stays Infinity
        if (def.type === "projectile") this._fireProjectile(def);
        else this._fireHitscan();
        this.recoil = Math.min(1, this.recoil + (def.type === "projectile" ? 0.9 : 0.6));
        ActionFPSWeaponSystem.emit("fire", { slot: this.weaponSlot, type: def.type, ammo: this.ammo[this.weaponSlot] });
    }

    _fireHitscan() {
        const world = this.controller.physicsWorld;
        const cast = this.crosshairCast(world);
        let tracerEnd = cast.point;
        // Networked: clamp the cosmetic tracer to the nearest enemy box (the prediction world has no
        // enemy bodies, so a ray would pass through people). Cosmetic only.
        if (this._isNetworked && this.context.enemyBoxes) {
            const av = this._nearestBoxHit(cast.origin, cast.dir, cast.hit ? cast.hit.distance : 1000);
            if (av) tracerEnd = av;
        }
        const hit = cast.hit;
        const dir = cast.dir;
        this.tracers.push({ attach: true, to: tracerEnd, life: 0.06 });
        ActionFPSWeaponSystem.emit("impact", { x: tracerEnd.x, y: tracerEnd.y, z: tracerEnd.z, hit: !!hit });
        // Offline: shooting pushes dynamic props (local feedback).
        if (!this._isNetworked && hit && hit.body && !hit.body.isStatic) {
            hit.body.applyImpulse(new Vector3(dir.x * 60, dir.y * 60 + 8, dir.z * 60));
        }
    }

    // Spawn a locally-simulated rocket. Offline it's the real (only) rocket and explodes locally;
    // networked it's a PREDICTED rocket (instant launch feel) retired on the authoritative blast.
    _fireProjectile(def) {
        const target = this.crosshairCast(this.controller.physicsWorld).point;
        const muzzle = this.activeMuzzle();
        const dir = target.sub(muzzle).normalize();
        const spd = def.speed;
        this.localRockets.push({
            x: muzzle.x, y: muzzle.y, z: muzzle.z,
            vx: dir.x * spd, vy: dir.y * spd, vz: dir.z * spd,
            life: def.lifeTicks / 60, predicted: this._isNetworked, def
        });
    }

    // Retire the predicted rocket nearest an authoritative blast at (x,y,z). Match by NEAREST position,
    // not FIFO: rockets explode out of fire order, so removing "the oldest" retires the wrong one.
    onSelfRocketExploded(x, y, z) {
        let best = -1, bestD = Infinity;
        for (let i = 0; i < this.localRockets.length; i++) {
            const r = this.localRockets[i];
            if (!r.predicted) continue;
            if (x === undefined) { best = i; break; }
            const dx = r.x - x, dy = r.y - y, dz = r.z - z;
            const d = dx * dx + dy * dy + dz * dz;
            if (d < bestD) { bestD = d; best = i; }
        }
        if (best !== -1) this.localRockets.splice(best, 1);
    }

    /** Nearest enemy box the ray enters within maxDist (networked cosmetic tracer clamp). */
    _nearestBoxHit(eye, dir, maxDist) {
        let best = null;
        for (const b of this.context.enemyBoxes()) {
            const t = ActionBoxGeometry.rayAABB(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, b.x, b.y, b.z, b.hx, b.hy, b.hz);
            if (t === null || t > maxDist) continue;
            if (!best || t < best.t) best = { t };
        }
        return best ? eye.add(dir.mult(best.t)) : null;
    }

    /** Draw a remote shooter's tracer (origin→end fixed in world; not muzzle-attached). */
    addRemoteTracer(ox, oy, oz, ex, ey, ez) {
        this.tracers.push({ from: new Vector3(ox, oy, oz), to: new Vector3(ex, ey, ez), life: 0.06 });
    }

    /** Spawn a brief expanding blast FX at a world point (both modes). Emits `explode`. */
    spawnExplosion(x, y, z) {
        this.explosions.push({ x, y, z, life: 0.35, max: 0.35 });
        ActionFPSWeaponSystem.emit("explode", { x, y, z });
    }

    // Advance local rockets and detonate on impact / lifetime. Offline rockets explode locally (FX +
    // prop push + rocket-jump). Networked rockets are predicted-cosmetic: kept until the host's blast
    // retires them (onSelfRocketExploded), so the vanish and the explosion land on the same frame.
    _stepLocalRockets(dt) {
        if (!this.localRockets.length) return;
        const world = this.controller.physicsWorld;
        const selfName = this.controller.bodyId;
        const survivors = [];
        for (const r of this.localRockets) {
            const ax = r.x, ay = r.y, az = r.z;
            r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt;
            r.life -= dt;
            if (!r.predicted) {
                const hit = ActionRaycast3D.cast(new Vector3(ax, ay, az), new Vector3(r.x, r.y, r.z), world, {
                    ignoreObjects: [selfName, "playerghost_"]
                });
                if (hit || r.life <= 0) {
                    const px = hit ? hit.point.x : r.x;
                    const py = hit ? hit.point.y : r.y;
                    const pz = hit ? hit.point.z : r.z;
                    this._explodeLocal(px, py, pz, r.def);
                } else survivors.push(r);
            } else if (r.life > 0) survivors.push(r);
        }
        this.localRockets = survivors;
    }

    /** Offline blast: push nearby dynamic props + ROCKET-JUMP the owner + spawn the FX. */
    _explodeLocal(x, y, z, def) {
        this.spawnExplosion(x, y, z);
        for (const obj of this.controller.physicsWorld.objects) {
            if (!obj || !obj.body || obj.body.isStatic) continue;
            const bp = obj.body.position;
            const ox = bp.x - x, oy = bp.y - y, oz = bp.z - z;
            const d = Math.hypot(ox, oy, oz);
            if (d > def.splashRadius || d < 1e-3) continue;
            const f = (1 - d / def.splashRadius) * 90;
            obj.body.applyImpulse(new Vector3((ox / d) * f, (oy / d) * f + 20, (oz / d) * f));
        }
        // Rocket-jump the owner via applyKnockback (velocity-integrated; a physics impulse is ignored).
        const ctrl = this.controller;
        if (ctrl && typeof ctrl.applyKnockback === "function") {
            const p = ctrl.body.position;
            const cy = p.y + ctrl.height * 0.25;
            let ox = p.x - x, oy = cy - y, oz = p.z - z;
            const d = Math.hypot(ox, oy, oz);
            if (d <= def.splashRadius) {
                const fall = 1 - d / def.splashRadius;
                if (d < 1e-3) { ox = 0; oy = 1; oz = 0; } else { ox /= d; oy /= d; oz /= d; }
                const push = def.knockback * fall;
                ctrl.applyKnockback(ox * push, oy * push + def.upBias * fall, oz * push);
            }
        }
    }

    // ---- FX render objects (rebuilt each frame) ----------------------------

    /** Build render objects for live rockets + active explosions. */
    buildEffectObjects() {
        const out = [];
        for (const r of this.localRockets) {
            const o = ActionBoxGeometry.build(2, 2, 6, "#ffcf6a", false);
            o.transform.position = new Vector3(r.x, r.y, r.z);
            o.transform.rotation = Quaternion.fromDirection(r.vx, r.vy, r.vz);
            out.push(o);
        }
        for (const e of this.explosions) {
            const t = 1 - e.life / e.max;
            const size = 6 + t * 40;
            const o = ActionBoxGeometry.build(size, size, size, t < 0.5 ? "#fff2a0" : "#ff7a2a", false);
            o.transform.position = new Vector3(e.x, e.y, e.z);
            out.push(o);
        }
        return out;
    }

    // Build one RenderableObject holding all live tracers as thin 3D beams. Pure geometry through the
    // normal render path. Single-sided, outward winding (12 tris/beam). Rebuilt each frame.
    buildTracerObject() {
        if (!this.tracers.length) return null;
        const r = 0.04, color = "#ffe07a";
        const tris = [];
        const quad = (p, q, s, t, ox, oy, oz) => {
            const nx = (q.y - p.y) * (s.z - p.z) - (q.z - p.z) * (s.y - p.y);
            const ny = (q.z - p.z) * (s.x - p.x) - (q.x - p.x) * (s.z - p.z);
            const nz = (q.x - p.x) * (s.y - p.y) - (q.y - p.y) * (s.x - p.x);
            if (nx * ox + ny * oy + nz * oz >= 0) {
                tris.push(new Triangle(p, q, s, color));
                tris.push(new Triangle(p, s, t, color));
            } else {
                tris.push(new Triangle(p, s, q, color));
                tris.push(new Triangle(p, t, s, color));
            }
        };
        const muzzle = this.tracers.some((t) => t.attach) ? this.activeMuzzle() : null;
        for (const tr of this.tracers) {
            const a = tr.attach ? muzzle : tr.from;
            const b = tr.to;
            let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
            const dl = Math.hypot(dx, dy, dz);
            if (dl < 1e-4) continue;
            dx /= dl; dy /= dl; dz /= dl;
            let ux, uy, uz;
            if (Math.abs(dy) < 0.99) { ux = dz; uy = 0; uz = -dx; } else { ux = 1; uy = 0; uz = 0; }
            const ul = Math.hypot(ux, uy, uz);
            ux = (ux / ul) * r; uy = (uy / ul) * r; uz = (uz / ul) * r;
            const vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux;
            const offs = [[ux, uy, uz], [vx, vy, vz], [-ux, -uy, -uz], [-vx, -vy, -vz]];
            const mk = (p, o) => new Vector3(p.x + o[0], p.y + o[1], p.z + o[2]);
            const A = offs.map((o) => mk(a, o));
            const B = offs.map((o) => mk(b, o));
            for (let i = 0; i < 4; i++) {
                const j = (i + 1) % 4;
                quad(A[i], A[j], B[j], B[i], offs[i][0] + offs[j][0], offs[i][1] + offs[j][1], offs[i][2] + offs[j][2]);
            }
            quad(A[0], A[1], A[2], A[3], -dx, -dy, -dz);
            quad(B[0], B[1], B[2], B[3], dx, dy, dz);
        }
        if (!tris.length) return null;
        const obj = new RenderableObject();
        obj.triangles = tris;
        obj.isStatic = false;
        obj.name = "tracers";
        return obj;
    }
}

// Default roster — the character is armed out of the box. A game overrides via `weapons: [...]`.
// (Mirrors the FPS demo's FPS_WEAPONS; kept here so the engine needs no game file to be playable.)
ActionFPSWeapon.DEFAULT_ROSTER = [
    { name: "Gun", type: "hitscan", damage: 25, fireCooldownTicks: 8, magSize: 12 },
    {
        name: "Rocket Launcher",
        type: "projectile",
        fireCooldownTicks: 18,
        magSize: 4,
        speed: 380,
        lifeTicks: 1800,
        directDamage: 50,
        splashDamage: 55,
        splashRadius: 70,
        knockback: 130,
        upBias: 70
    }
];
