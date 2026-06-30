/**
 * example.js — the smallest FPS on the Action Engine.
 *
 * The engine boots ONE class: `Game`. The App framework (app.js) constructs it with the canvases +
 * input + audio systems and calls action_fixed_update / action_update / action_draw each frame — same
 * contract demo.js and the full game.js follow. Everything here is the boilerplate any game writes
 * (renderer, camera, a light, a floor); the ONE line that makes it an FPS is the controller:
 *
 *     this.player = new ActionFPSController3D(this.world);
 *
 * That single object IS the character — movement, the weapon system (gun + rocket launcher, ammo,
 * reload), combat (health/death/respawn), a third-person body, and the camera rig — batteries-included.
 *
 * Controls: click to lock the mouse · WASD move · Space jump · Shift sprint · C crouch · mouse look ·
 * click fire · 1/2 switch weapon · R reload · Q cycle camera (third-person ↔ first-person).
 */
class Game {
    static WIDTH = 1280;
    static HEIGHT = 720;

    constructor(canvases, input, audio) {
        this.input = input;
        this.audio = audio;
        this.gameCanvas = canvases.gameCanvas;

        // Standard 3D boot: renderer, camera, a sun so we can see.
        this.renderer3D = new ActionRenderer3D(this.gameCanvas);
        this.camera = new ActionCamera();
        this.camera.fov = Math.PI * 0.42;
        this.renderer3D.applyLightingProfile(new ActionLightingProfile({
            autoFit: true,
            sun: { direction: [-0.9, -1.0, -0.6], intensity: 2.6 },
            range: 320,
            ambient: 0.55
        }));

        // A world: a floor + a few blocks to look at and shoot.
        this.world = new ActionPhysicsWorld3D();
        this.world.addObject(new ActionPhysicsBox3D(600, 8, 600, 0, new Vector3(0, -4, 0), "#3a4750", { isVisible: true }));
        for (const [x, z, c] of [[70, 10, "#7a6a52"], [-70, 50, "#586a78"], [0, 110, "#6a7a52"], [40, -70, "#805050"]]) {
            this.world.addObject(new ActionPhysicsBox3D(24, 44, 24, 0, new Vector3(x, 22, z), c, { isVisible: true }));
        }

        // ── THE ONE-LINER: a complete FPS character ───────────────────────────────────────────
        // Default to first-person (the held viewmodel), same as game.js. Press Q to cycle out to the
        // over-shoulder / classic third-person views (where you see the full character it ships with).
        this.player = new ActionFPSController3D(this.world, {
            position: new Vector3(0, 30, -80),
            view: { modes: ["first", "modern", "classic"], distance: 40, modernDistance: 22, shoulder: 6, heightOffset: 5, collisionRadius: 5 }
        });

        // Live aim (client-owned, mouse-driven) + a couple of input edges.
        this.aimYaw = 0;
        this.aimPitch = 0;
        this.lookSensitivity = 0.0022;
        this.maxPitch = 1.5;
        this._reloadDown = false;
        this._fireWanted = false;

        // (We feed the live aim to the character with ONE call — player.aim(yaw,pitch) in action_update.
        // The controller routes it to the viewmodel, camera, and body itself, so the gun never lags the
        // view. No per-seam wiring to remember.)

        // Pointer lock on click; while locked, a click fires.
        this.gameCanvas.addEventListener("mousedown", () => {
            if (document.pointerLockElement !== this.gameCanvas) this.gameCanvas.requestPointerLock();
            else this._fireWanted = true;
        });

        console.log("[example] One-liner FPS character is live. Click the canvas to lock the mouse.");
    }

    // Full 3D look direction from the live aim.
    lookDir() {
        const cp = Math.cos(this.aimPitch);
        return new Vector3(Math.sin(this.aimYaw) * cp, Math.sin(this.aimPitch), Math.cos(this.aimYaw) * cp);
    }

    // Variable-rate: mouse look + action keys + cosmetic/respawn tick.
    action_update(deltaTime) {
        const dt = Math.min(deltaTime || 1 / 60, 0.05);
        this._frameDt = dt;

        const m = this.input.consumeLockedPointerMovement();
        if (m.x || m.y) {
            this.aimYaw += -m.x * this.lookSensitivity;
            this.aimPitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.aimPitch + -m.y * this.lookSensitivity));
        }
        // Hand the live aim to the character — ONE call. The controller routes it to the viewmodel,
        // camera, and third-person body, so none of them lag the view between physics ticks.
        this.player.aim(this.aimYaw, this.aimPitch);

        if (this.input.isKeyJustPressed("Hotbar1")) this.player.selectWeapon(0); // 1 → gun
        if (this.input.isKeyJustPressed("Hotbar2")) this.player.selectWeapon(1); // 2 → rocket launcher
        if (this.input.isKeyJustPressed("Action4")) this.player.view.cycleMode(); // Q → cycle camera
        const rDown = this.input.isRawKeyPressed("KeyR"); // R → reload (rising edge)
        if (rDown && !this._reloadDown) this.player.reload();
        this._reloadDown = rDown;

        this.player.update(dt); // recoil decay, FX aging, respawn countdown / kill-plane
    }

    // Fixed-rate: build the command, fire (rate-limited), step the controller + world.
    action_fixed_update(fixedDeltaTime) {
        const cmd = this.player.sampleCommand(this.input); // the controller's own keybind→command sampler
        cmd.yaw = this.aimYaw;
        cmd.pitch = this.aimPitch;
        this.player.setLook(this.aimYaw, this.aimPitch);

        // The weapon owns the fire-rate gate: tryPredictFire returns whether a shot is allowed this tick
        // (cooled down + has ammo; dry-clicks an empty mag). Fire it through the controller if so.
        if (this.player.weapon.tryPredictFire(this._fireWanted)) this.player.tryFire();
        this._fireWanted = false;

        this.player.beginStep(cmd, fixedDeltaTime);
        this.world.fixed_update(fixedDeltaTime);
        this.player.endStep(fixedDeltaTime);

        // Stash the eye for sub-tick render interpolation (the controller owns the lerp + teleport-snap).
        this.player.captureRenderState();
    }

    // Draw: the controller frames its own camera and poses its own body, both riding the sub-tick factor
    // `alpha` so the view + body stay smooth between 60Hz physics ticks. Render the world, the character
    // + FX, and (in first person) the viewmodel.
    action_draw(alpha) {
        // ONE call each: the controller interpolates the eye internally (no proxy to hand-build, no
        // teleport-snap to remember). Pass alpha; it uses the live aim we set with aim().
        this.player.updateCamera(this.camera, alpha, this._frameDt || 1 / 60);
        const firstPerson = this.player.view.isFirstPerson;
        if (firstPerson && !this.player.dead) this.player.weapon.updateViewmodel();

        const scene = Array.from(this.world.objects).concat(this.player.getRenderObjects(alpha));
        this.renderer3D.render({
            renderableObjects: scene,
            camera: this.camera,
            viewmodelObjects: firstPerson && !this.player.dead ? [this.player.viewmodel] : [],
            viewmodelOptions: { near: 0.5, far: 600, fov: this.camera.fov * 0.85 }
        });
    }
}
