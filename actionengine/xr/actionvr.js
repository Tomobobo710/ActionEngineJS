// actionengine/xr/actionvr.js
//
// ActionVR — generic, engine-level VR driver for any App/Game built on ActionEngine.
//
// It turns the standard flatscreen game into a room-scale VR experience with ZERO game code:
//   - head-tracked STEREO rendering (the whole 3D scene, once per eye);
//   - smooth LOCOMOTION on the left stick (glides the tracking-space origin, relative to head gaze);
//   - SNAP TURN on the right stick;
//   - controller BUTTONS forwarded to the engine's virtual-input actions (Action1..Action10), so a
//     game's existing keyboard/gamepad handlers fire from the Touch controllers too.
//
// It is additive: nothing here runs unless enter() is called. core/app.js constructs one of these
// only when the runtime supports immersive-vr, and the flatscreen path is otherwise untouched.
//
// It generalises the arcade's game/vr.js: instead of coupling locomotion to a specific character
// controller, ActionVR owns the tracking-space origin itself, so "walk around" works in any scene.
//
// Controller map (Quest Touch, xr-standard gamepad):
//   Left stick .... move (forward/strafe, relative to where you're looking)
//   Right stick X . snap turn ±snapDegrees
//   Buttons are forwarded per `buttonMap` (trigger=0, grip=1, A/X=4, B/Y=5).
class ActionVR {
    /**
     * @param {App} app  the engine App (gives us the game, its renderer3D, camera and input)
     * @param {object} [opts]
     */
    constructor(app, opts = {}) {
        this.app = app;
        this.game = app.game;

        // ActionVR assumes the standard 3D renderer stack (same objects the arcade/spike drive).
        this.renderer3D = this.game.renderer3D;
        this.gl = this.renderer3D.gl;
        this.canvasManager = this.renderer3D.canvasManager;   // XR-aware (xrFramebuffer / suppressClear)
        this.objectRenderer = this.renderer3D.objectRenderer; // holds _viewOverride / _projectionOverride
        this.input = this.game.input;
        this.camera = this.game.camera;

        this.xr = new ActionXR(this.gl, this.canvasManager);
        this.presenting = false;

        // --- Locomotion / turn config ---
        this.eyeHeight = opts.eyeHeight != null ? opts.eyeHeight : 1.6; // metres (local-floor origin)
        this.moveSpeed = opts.moveSpeed != null ? opts.moveSpeed : 2.5; // metres / second
        this.SNAP = ((opts.snapDegrees != null ? opts.snapDegrees : 30) * Math.PI) / 180;
        this.deadzone = opts.deadzone != null ? opts.deadzone : 0.2;

        // Tracking-space origin: where the player's feet stand, plus an accumulated yaw from snap turns.
        // Start standing on the floor beneath wherever the flat camera was aimed from.
        const p = this.camera && this.camera.position ? this.camera.position : new Vector3(0, this.eyeHeight, 0);
        this.feet = [p.x, 0, p.z];
        this.turnYaw = 0;
        this._snapArmed = true;

        // Button index -> engine action. Same actions the arcade/demo already read from keyboard/gamepad.
        // Touch xr-standard: 0 trigger, 1 grip, 3 stick-click, 4 A/X, 5 B/Y.
        this.buttonMap = opts.buttonMap || {
            right: { 0: "Action1", 1: "Action2", 4: "Action3", 5: "Action4" },
            left:  { 0: "Action5", 1: "Action6", 4: "Action8", 5: "Action10" }
        };
        // Flat set of every action we might forward, so _onEnd can release them all cleanly.
        this._allActions = [];
        for (const hand of ["left", "right"]) {
            for (const idx in this.buttonMap[hand]) this._allActions.push(this.buttonMap[hand][idx]);
        }

        // Scratch matrices (avoid per-frame allocation).
        this._origin = Matrix4.create();
        this._worldEye = Matrix4.create();
        this._view = Matrix4.create();

        this._pose = null;
        this._layer = null;
        this._lastTime = null;

        // Renderer flags we suspend while presenting (restored on exit).
        this._savedShadows = null;
        this._savedSun = undefined;
    }

    static isSupported() { return ActionXR.isSupported(); }

    async enter() {
        if (this.presenting) return;

        // Per-eye stereo can't run the shadow pass (it rebinds framebuffer + viewport, fighting the
        // eye loop) or the sun sprite (it builds its own non-XR matrices → ghosts in stereo). Suspend
        // both for the session and restore them on exit.
        this._savedShadows = this.renderer3D.shadowsEnabled;
        this.renderer3D.shadowsEnabled = false;
        this._savedSun = this.renderer3D._sunSprite;
        this.renderer3D._sunSprite = null;

        this._lastTime = null;
        if (this.app._onVRStart) this.app._onVRStart();

        await this.xr.start(
            (time, frame, pose, layer) => this._onFrame(time, frame, pose, layer),
            { onEnd: () => this._onEnd() }
        );
        this.presenting = true;
    }

    async exit() { if (this.xr.session) await this.xr.end(); }

    _onEnd() {
        this.presenting = false;

        // Release everything we injected so the flatscreen game doesn't see phantom held buttons.
        for (const a of this._allActions) this.input.setVirtualButton(a, false);
        for (const d of ["DirUp", "DirDown", "DirLeft", "DirRight"]) this.input.setVirtualButton(d, false);

        // Restore renderer flags.
        if (this._savedShadows != null) this.renderer3D.shadowsEnabled = this._savedShadows;
        if (this._savedSun !== undefined) this.renderer3D._sunSprite = this._savedSun;
        this._savedShadows = null;
        this._savedSun = undefined;

        this._pose = null;
        this._layer = null;
        if (this.app._onVREnd) this.app._onVREnd();
    }

    // ActionXR frame callback. Reads controllers (which injects input + updates locomotion/turn), then
    // hands the frame to the App to run the normal update phases and the per-eye draw.
    _onFrame(time, frame, pose, layer) {
        if (!pose) return; // tracking not ready this frame
        const dt = this._lastTime == null ? 0 : Math.min((time - this._lastTime) / 1000, 0.1);
        this._lastTime = time;

        this._readControllers(frame, pose, dt);
        this.app._frameXR(time, this, pose, layer);
    }

    _readControllers(frame, pose, dt) {
        const input = this.input;
        const refSpace = this.xr.refSpace;
        const sources = this.xr.session ? this.xr.session.inputSources : [];

        let mvx = 0, mvy = 0, turnX = 0;

        for (const src of sources) {
            const hand = src.handedness === "left" ? "left" : "right";
            const g = src.gamepad;
            if (!g) continue;

            const ax = g.axes || [];
            // xr-standard puts the thumbstick on axes 2/3; fall back to 0/1 for touchpad-only devices.
            const sx = ax.length > 2 ? ax[2] : (ax[0] || 0);
            const sy = ax.length > 3 ? ax[3] : (ax[1] || 0);
            const pressed = (i) => !!(g.buttons[i] && g.buttons[i].pressed);

            if (hand === "left") { mvx += sx; mvy += -sy; } // stick up (negative sy) → forward
            else { turnX += sx; }

            const map = this.buttonMap[hand] || {};
            for (const idx in map) input.setVirtualButton(map[idx], pressed(+idx));
        }

        // --- Smooth locomotion: glide the feet origin along the head's world heading ---
        if (Math.hypot(mvx, mvy) > this.deadzone && dt > 0) {
            // Head forward in tracking-local space (-Z column of the eye→local matrix), flattened.
            const hp = pose.transform.matrix;
            let lfx = -hp[8], lfz = -hp[10];
            const ll = Math.hypot(lfx, lfz) || 1; lfx /= ll; lfz /= ll;

            // The origin rotates local space by turnYaw (Ry), so rotate the head forward the same way
            // to get the WORLD heading we actually move along.
            const c = Math.cos(this.turnYaw), s = Math.sin(this.turnYaw);
            const wfx = c * lfx + s * lfz;
            const wfz = -s * lfx + c * lfz;
            // World right = cross(forward, up) with up = +Y  →  (-fz, 0, fx).
            const wrx = -wfz, wrz = wfx;

            const step = this.moveSpeed * dt;
            this.feet[0] += (wfx * mvy + wrx * mvx) * step;
            this.feet[2] += (wfz * mvy + wrz * mvx) * step;
        }

        // --- Snap turn (edge-triggered so one flick = one increment) ---
        if (this._snapArmed && Math.abs(turnX) > 0.7) {
            this.turnYaw -= Math.sign(turnX) * this.SNAP;
            this._snapArmed = false;
        } else if (Math.abs(turnX) < 0.3) {
            this._snapArmed = true;
        }
    }

    // Draw the whole scene once per eye. Called by App._frameXR AFTER the update phases have run, so
    // simulation state is already advanced for this frame — we only change the view/projection.
    renderStereo(alpha, pose, layer) {
        pose = pose || this._pose;
        layer = layer || this._layer;
        if (!pose) return;

        const gl = this.gl;
        const cam = this.camera;
        const obj = this.objectRenderer;
        const cm = this.canvasManager;

        // worldFromLocal = T(feet) · Ry(turnYaw)
        Matrix4.identity(this._origin);
        Matrix4.translate(this._origin, this._origin, this.feet);
        Matrix4.rotateY(this._origin, this._origin, this.turnYaw);

        // Draw phases straddle the eye loop: pre/post fire once per frame, the actual draw once per eye.
        if (typeof this.game.action_pre_draw === "function") this.game.action_pre_draw();

        // The XR framebuffer was already bound + cleared once for both eyes by ActionXR; tell the
        // engine's render() not to clear again between eyes.
        cm.suppressClear = true;
        for (const view of pose.views) {
            const vp = layer.getViewport(view);
            gl.viewport(vp.x, vp.y, vp.width, vp.height);

            // worldEye = origin · (eye→local);  view = its inverse (world→eye).
            Matrix4.multiply(this._worldEye, this._origin, view.transform.matrix);
            Matrix4.invert(this._view, this._worldEye);
            obj._viewOverride = this._view;                  // world → eye (verbatim)
            obj._projectionOverride = view.projectionMatrix; // asymmetric per-eye frustum

            // Keep camera.position/target/up consistent with this eye — the object shader reads
            // camera.position for specular, and any lookAt-based helper stays sane.
            cam.position = new Vector3(this._worldEye[12], this._worldEye[13], this._worldEye[14]);
            cam.target = new Vector3(
                cam.position.x - this._worldEye[8],
                cam.position.y - this._worldEye[9],
                cam.position.z - this._worldEye[10]
            );
            cam.up = new Vector3(this._worldEye[4], this._worldEye[5], this._worldEye[6]);

            if (typeof this.game.action_draw === "function") this.game.action_draw(alpha);
        }

        // Clear the overrides so nothing else (a later flat frame, another sub-renderer) is affected.
        obj._viewOverride = null;
        obj._projectionOverride = null;
        cm.suppressClear = false;

        if (typeof this.game.action_post_draw === "function") this.game.action_post_draw();
    }
}

if (typeof window !== "undefined") window.ActionVR = ActionVR;
