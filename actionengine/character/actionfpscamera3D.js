//actionengine/character/actionfpscamera3D.js
/**
 * ActionFPSCamera - render-side camera rig for a character controller. Owns ONLY framing:
 * first-person, over-shoulder third-person ("modern"), or centered third-person ("classic"),
 * cycled at runtime. It deliberately does NOT own aim — the caller passes the live look direction
 * each frame, so aim stays client-owned (the netcode cornerstone) and the controller's reconciled
 * yaw never drags the view. Responsibilities:
 *   - smooth the controller's OWN vertical discontinuities (step/landing snaps, crouch/scale swaps)
 *     by consuming controller.consumeViewDisplacementY() into a decaying offset — no eye-delta
 *     guessing, and scale-correct because the controller reports real world-unit displacement;
 *   - in third-person, boom back along the aim and pull in off walls with a raycast.
 * Every distance scales with controller.scale, so it's correct at any character size. Render-only:
 * it touches nothing the simulation reads.
 *
 * Usage (once per render frame): rig.update(controller, lookDir, dt, camera);
 * Cycle on a keypress: rig.cycleMode(); the game reads rig.isFirstPerson to pick viewmodel vs body.
 */
class ActionFPSCamera {
    /**
     * @param {Object}  opts
     * @param {string[]} opts.modes        - Cycle order. Default ["first","modern","classic"].
     * @param {number}  opts.distance      - Classic third-person boom length (pre-scale). Default 4.
     * @param {number}  opts.modernDistance- Over-shoulder ("modern") boom length, closer in (pre-scale). Default 2.
     * @param {number}  opts.shoulder      - Over-shoulder lateral offset for "modern" (pre-scale). Default 0.5.
     * @param {number}  opts.heightOffset  - Classic-mode camera lift above the eye so it looks over the character (pre-scale). Default 0.5.
     * @param {number}  opts.collisionRadius- Padding kept off walls when the boom is blocked (pre-scale). Default 0.5.
     * @param {number}  opts.smoothDecay   - Step/crouch ease: offset *= smoothDecay^dt. Default 0.0001 (~120ms settle).
     */
    constructor(opts = {}) {
        const o = opts;
        this.modes = o.modes || ["first", "modern", "classic"];
        this.modeIndex = 0;
        this.distance = o.distance !== undefined ? o.distance : 4; // classic boom length
        this.modernDistance = o.modernDistance !== undefined ? o.modernDistance : 2; // over-shoulder boom (closer)
        this.shoulder = o.shoulder !== undefined ? o.shoulder : 0.5;
        this.heightOffset = o.heightOffset !== undefined ? o.heightOffset : 0.5;
        this.collisionRadius = o.collisionRadius !== undefined ? o.collisionRadius : 0.5;
        this.smoothDecay = o.smoothDecay !== undefined ? o.smoothDecay : 0.0001;
        this._offsetY = 0; // decaying vertical smoothing offset (world units)
    }

    get mode() {
        return this.modes[this.modeIndex];
    }
    get isFirstPerson() {
        return this.mode === "first";
    }
    cycleMode() {
        this.modeIndex = (this.modeIndex + 1) % this.modes.length;
        return this.mode;
    }
    setMode(name) {
        const i = this.modes.indexOf(name);
        if (i >= 0) this.modeIndex = i;
    }

    /** Place the camera for this frame. `lookDir` is the live 3D aim direction (caller-owned). */
    update(controller, lookDir, dt, camera) {
        const scale = controller.scale || 1;

        // Ease the controller's own step/crouch snaps: absorb the new displacement, then decay.
        this._offsetY -= controller.consumeViewDisplacementY();
        this._offsetY *= Math.pow(this.smoothDecay, dt);
        if (Math.abs(this._offsetY) < 0.001 * scale) this._offsetY = 0;

        const eye = controller.getEyePosition();
        const eyeY = eye.y + this._offsetY;
        const look = lookDir;

        if (this.isFirstPerson) {
            camera.position = new Vector3(eye.x, eyeY, eye.z);
            camera.target = camera.position.add(look);
            camera.isDetached = false;
            return;
        }

        // Third-person. Horizontal right from the aim (engine handedness: fwd=(sin,0,cos),
        // right=(-cos,0,sin)) for the over-shoulder offset.
        const fhl = Math.sqrt(look.x * look.x + look.z * look.z) || 1;
        const rightX = -look.z / fhl;
        const rightZ = look.x / fhl;

        let pivotX = eye.x;
        let pivotY = eyeY;
        let pivotZ = eye.z;
        if (this.mode === "modern") {
            // Over-shoulder: lateral offset, kept near eye level.
            pivotX += rightX * this.shoulder * scale;
            pivotZ += rightZ * this.shoulder * scale;
        } else {
            // Classic: lift the rig above the eye so we look OVER the character — the crosshair
            // (screen-center along aim) clears the head instead of sitting on it.
            pivotY += this.heightOffset * scale;
        }
        const pivot = new Vector3(pivotX, pivotY, pivotZ);

        // Boom straight back along the aim; pull in if a wall is closer than the boom length.
        let dist = (this.mode === "modern" ? this.modernDistance : this.distance) * scale;
        const want = new Vector3(pivot.x - look.x * dist, pivot.y - look.y * dist, pivot.z - look.z * dist);
        const hit = ActionRaycast3D.cast(pivot, want, controller.physicsWorld, controller.raycastIgnore);
        if (hit) dist = Math.min(dist, Math.max(0, hit.distance - this.collisionRadius * scale));

        camera.position = new Vector3(pivot.x - look.x * dist, pivot.y - look.y * dist, pivot.z - look.z * dist);
        camera.target = camera.position.add(look);
        camera.isDetached = false;
    }
}
