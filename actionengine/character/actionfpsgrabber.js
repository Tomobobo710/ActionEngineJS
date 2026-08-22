// actionfpsgrabber.js — the per-character GRAB component (engine mechanism): gravity-gun pickup, carry,
// and throw of dynamic bodies. One rides on every ActionFPSController3D that has grab enabled. It reads
// its owner off the CONTROLLER and needs no wiring:
//   • aim/eye  — controller.getEyePosition() + controller.getLiveAimDirection(). The live aim is the
//                key: a LOCAL predicted grabber uses the client's present view, while a host's
//                server-side grabber (which never gets aim()) falls back to the reconciled SIM facing —
//                exactly the local-vs-authority split a netcode wants, for free, with no branching.
//   • world    — controller.physicsWorld (the prop the player grabs lives in the same world: spWorld
//                offline, the prediction world on the client, the authoritative world on the host).
//   • self     — controller.raycastIgnore (so the grab ray never hits the grabber's own body).
//
// The carry is VELOCITY-based (it sets the held body's velocity toward a hold point, not its position),
// so the solver stays in charge: the prop still collides with walls/players and keeps its momentum on
// release — that's the throw.
//
// Two things stay POLICY, not mechanism:
//   • What's grabbable — pass opts.canGrab(body) (default: any non-static body). A game with named
//     props passes e.g. (b)=>b.name.startsWith("prop").
//   • The MULTIPLAYER wiring — authority, snapshotting the held id, the grace reconcile — stays with the
//     game's session. This component just exposes the lifecycle (toggle / drive / reconcile / release)
//     and the held id; the host writes THROUGH it, exactly like the combat health store on the controller.

class ActionFPSGrabber {
    /**
     * @param {ActionFPSController3D} controller  the owning character (eye/aim/world/self)
     * @param {object} [opts]
     * @param {number}   [opts.grabRange=5]   raycast reach (pre-scale; ×controller.scale at use)
     * @param {number}   [opts.holdDist=2.4]  carry distance in front of the eye (pre-scale)
     * @param {number}   [opts.maxSpeed=26]   velocity cap on the carry pull (anti-overshoot)
     * @param {number}   [opts.graceTicks=30] ticks a fresh local grab/drop ignores contradicting authority
     * @param {function} [opts.canGrab]       (body)=>bool predicate; default: any non-static body
     * @param {object}   [opts.view]          { isFirstPerson:bool, cameraPosition:Vector3 } camera seam
     *                                        (same shape as ActionFPSWeapon.view); absent ⇒ first-person
     */
    constructor(controller, opts = {}) {
        this.controller = controller;
        this.held = null; // id (body name) of the carried prop, or null
        this._grace = 0; // reconcile-ignore countdown (see reconcile())
        this.grabRange = opts.grabRange !== undefined ? opts.grabRange : 5;
        this.holdDist = opts.holdDist !== undefined ? opts.holdDist : 2.4;
        this.maxSpeed = opts.maxSpeed !== undefined ? opts.maxSpeed : 26;
        this.graceTicks = opts.graceTicks !== undefined ? opts.graceTicks : 30;
        this._canGrab = opts.canGrab || ((body) => !!body && !body.isStatic);
        // Camera seam (view:bool controller option wires this — same shape as ActionFPSWeapon.view):
        // { isFirstPerson, cameraPosition }. Absent ⇒ first-person, ray starts at the eye.
        this.view = opts.view || null;
    }

    get _world() { return this.controller.physicsWorld; }
    get _scale() { return this.controller.scale || 1; }
    get _firstPerson() { return this.view ? this.view.isFirstPerson : true; }

    // Aim ray along the controller's LIVE aim direction (falls back to the sim look on a host-side
    // controller that never gets aim()), starting at the EYE in first person or the CAMERA in third
    // person — matching what the crosshair actually sits over (see ActionFPSWeapon.crosshairCast).
    // Third person without the camera seam would ray from the body's eye while the crosshair (and
    // every other aim-driven system: fire, muzzle) reads from the camera — the grab point drifting
    // off from where the player is actually looking.
    _ray() {
        const eye = this._firstPerson ? this.controller.getEyePosition() : this.view.cameraPosition;
        return { eye, dir: this.controller.getLiveAimDirection() };
    }

    // Find a body by name (= prop id) in our world. Cheap (a handful of props).
    _findBody(id) {
        const w = this._world;
        if (!w) return null;
        for (const o of w.objects) if (o && o.body && o.body.name === id) return o;
        return null;
    }

    // Raycast for a grabbable body in front of us; returns its id (body name) or null.
    raycast() {
        const world = this._world;
        if (!world) return null;
        const { eye, dir } = this._ray();
        const range = this.grabRange * this._scale;
        const end = new Vector3(eye.x + dir.x * range, eye.y + dir.y * range, eye.z + dir.z * range);
        const hit = ActionRaycast3D.cast(eye, end, world, this.controller.raycastIgnore);
        if (!hit || !hit.body || hit.body.isStatic) return null;
        if (!this._canGrab(hit.body)) return null;
        return hit.body.name || null;
    }

    // World point the held body is pulled toward: `holdDist` out along the CROSSHAIR ray (same origin
    // as _ray()/raycast(), so the prop sits exactly on the reticle, not just somewhere in the aim
    // direction — the camera is offset both back AND sideways/up from the eye in third person
    // (ActionFPSCamera's shoulder/heightOffset), so re-deriving the hold point from the eye instead of
    // the camera's own ray leaves it off to the side of the crosshair). The distance is measured from
    // the PLAYER, not the ray origin: we add back how far the origin already sits from the eye along
    // this same ray, so third person (camera pulled back) doesn't hold the prop closer to the body than
    // first person does. Distance blends sqrt(scale) and scale — gentle at small scale, room to grow at
    // large — normalized so 1× == holdDist.
    _holdPoint() {
        const { eye: origin, dir } = this._ray();
        const playerEye = this.controller.getEyePosition();
        // Signed distance from the ray origin to the player's eye, projected onto the aim direction —
        // 0 in first person (origin == eye), positive in third person (origin sits behind the player).
        const originSetback = (playerEye.x - origin.x) * dir.x + (playerEye.y - origin.y) * dir.y + (playerEye.z - origin.z) * dir.z;
        const s = this._scale;
        const d = originSetback + this.holdDist * (Math.sqrt(s) + s) * 0.5;
        return new Vector3(origin.x + dir.x * d, origin.y + dir.y * d, origin.z + dir.z * d);
    }

    // Velocity-pull a body toward a world point (the carry). Velocity (not position) keeps the solver in
    // charge: the body still collides and keeps momentum on release (the throw). Spin is damped so it
    // settles in hand.
    _pull(box, hold, dt) {
        if (!box || !box.body) return;
        const b = box.body;
        const p = b.position;
        let vx = (hold.x - p.x) / dt, vy = (hold.y - p.y) / dt, vz = (hold.z - p.z) / dt;
        const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
        if (sp > this.maxSpeed) { const k = this.maxSpeed / sp; vx *= k; vy *= k; vz *= k; }
        b.linearVelocity = new Vector3(vx, vy, vz);
        const av = b.angularVelocity;
        b.angularVelocity = new Vector3(av.x * 0.8, av.y * 0.8, av.z * 0.8);
    }

    /**
     * One-shot grab/drop on a trigger edge. Drop = stop carrying (momentum stays → throw). Grab =
     * raycast for a grabbable body in front. Either way it arms the grace window so a stale authority
     * snapshot can't immediately undo the action. Returns the new held id (or null).
     */
    toggle() {
        if (this.held) { this.held = null; this._grace = this.graceTicks; return null; }
        const id = this.raycast();
        if (id) { this.held = id; this._grace = this.graceTicks; }
        return this.held;
    }

    /** Per-tick carry: pull the held body toward the hold point. Call BEFORE the world step so the
     *  solver moves it this tick. Drops the hold if the body has vanished. No-op when not holding. */
    drive(dt) {
        if (!this.held) return;
        const box = this._findBody(this.held);
        if (!box) { this.held = null; return; }
        this._pull(box, this._holdPoint(), dt);
    }

    /**
     * Reconcile to authority (client only): adopt the authoritative held id UNLESS we're inside the
     * grace window just after a local grab/drop (so an in-flight snapshot from before the host saw our
     * trigger can't undo a fresh action). Call once per authoritative local-state update.
     */
    reconcile(authoritativeHeldId) {
        if (this._grace > 0) { this._grace--; return; }
        this.held = authoritativeHeldId || null;
    }

    /** Drop with no grace (authority is dropping us, e.g. on death — not a local action). */
    release() { this.held = null; this._grace = 0; }
}
