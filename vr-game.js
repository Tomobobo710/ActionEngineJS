// vr-game.js — ActionEngine VR Phase 0 spike
//
// Goal: prove the engine can render its real WebGL2 scene in stereo into a Quest 3 and be
// looked around with head tracking. It deliberately does NOT use core/app.js (whose loop is
// hardwired to requestAnimationFrame) — instead it drives the engine directly so the same
// scene can run either on the flatscreen (preview) or through ActionXR (immersive).
//
// Scope limits for Phase 0 (each is called out where it happens):
//   - shadows off  (the shadow pass rebinds framebuffer + viewport, which fights the per-eye loop)
//   - sun sprite off (it builds its own non-XR matrices → would ghost/double in stereo)
//   - no controllers yet (that's Phase 1)

// The engine reads Game.WIDTH/Game.HEIGHT all over (viewport init, flatscreen projection aspect).
// In VR the per-eye projection override bypasses this; it only governs the flat preview.
window.Game = class Game {
    static get WIDTH() { return 1280; }
    static get HEIGHT() { return 720; }
};

class VRSpike {
    constructor(canvas) {
        this.canvas = canvas;
        this.canvas.width = Game.WIDTH;
        this.canvas.height = Game.HEIGHT;

        this.renderer3D = new ActionRenderer3D(canvas);
        this.gl = this.renderer3D.gl;
        this.canvasManager = this.renderer3D.canvasManager;   // CanvasManager3D (XR-aware after our edits)
        this.objectRenderer = this.renderer3D.objectRenderer; // holds _projectionOverride / _viewOverride

        // Phase 0 simplifications (see header)
        this.renderer3D.shadowsEnabled = false;
        this.renderer3D._sunSprite = null;

        this.physicsWorld = new ActionPhysicsWorld3D();
        this.camera = new ActionCamera();
        // Flat-preview camera: standing back, looking at the pile. Ignored while presenting in VR.
        this.camera.position = new Vector3(0, 1.4, -2.2);
        this.camera.target = new Vector3(0, 0.8, 0);

        this._buildScene();

        this.xr = new ActionXR(this.gl, this.canvasManager);

        // Fixed-timestep physics accumulator shared by both loops.
        this.fixedStep = 1 / 60;
        this.accumulator = 0;
        this.lastTime = null;

        this._flatRAF = null;
        this._flatTick = this._flatTick.bind(this);
        this._onXRFrame = this._onXRFrame.bind(this);
    }

    _buildScene() {
        // Reference space is local-floor: y=0 is the physical floor, +y up, meters.
        // Static floor (mass 0). Center it just below 0 so its top surface sits at y≈0.
        this._box(4, 0.2, 4, 0, new Vector3(0, -0.1, 0), "#2e5f8a");

        // A little pile of dynamic objects to fall/settle in front of the player.
        const colors = ["#FF6B6B", "#FFD166", "#06D6A0", "#4D96FF", "#C77DFF"];
        let i = 0;
        for (let y = 0; y < 4; y++) {
            for (let x = -1; x <= 1; x++) {
                const c = colors[i++ % colors.length];
                const px = x * 0.35 + (y % 2 ? 0.12 : -0.12);
                const py = 1.0 + y * 0.45;
                if ((x + y) % 2 === 0) {
                    this._box(0.28, 0.28, 0.28, 1, new Vector3(px, py, 0), c);
                } else {
                    this._sphere(0.16, 1, new Vector3(px, py, 0), c);
                }
            }
        }
    }

    _box(w, h, d, mass, pos, color) {
        const o = new ActionPhysicsBox3D(w, h, d, mass, pos, color);
        this.physicsWorld.addObject(o);
        return o;
    }

    _sphere(r, mass, pos, color) {
        const o = new ActionPhysicsSphere3D(r, mass, pos, color);
        this.physicsWorld.addObject(o);
        return o;
    }

    _step(dt) {
        // Clamp to avoid a spiral of death on tab-restore; step physics at a fixed rate.
        this.accumulator += Math.min(dt, 0.25);
        let steps = 0;
        while (this.accumulator >= this.fixedStep && steps < 8) {
            this.physicsWorld.fixed_update(this.fixedStep);
            this.accumulator -= this.fixedStep;
            steps++;
        }
    }

    // ---- Flatscreen preview loop (runs until the user enters VR) ----
    startFlat() {
        if (this._flatRAF) return;
        this.lastTime = null;
        this._flatRAF = requestAnimationFrame(this._flatTick);
    }

    stopFlat() {
        if (this._flatRAF) cancelAnimationFrame(this._flatRAF);
        this._flatRAF = null;
    }

    _flatTick(t) {
        const dt = this.lastTime == null ? 0 : (t - this.lastTime) / 1000;
        this.lastTime = t;
        this._step(dt);

        this.gl.viewport(0, 0, Game.WIDTH, Game.HEIGHT);
        this.renderer3D.render({
            renderableObjects: Array.from(this.physicsWorld.objects),
            camera: this.camera
        });
        this._flatRAF = requestAnimationFrame(this._flatTick);
    }

    // ---- VR ----
    async enterVR() {
        this.stopFlat();
        this.lastTime = null;
        await this.xr.start(this._onXRFrame, { onEnd: () => this.startFlat() });
    }

    _onXRFrame(time, frame, pose, layer /*, session */) {
        const dt = this.lastTime == null ? 0 : (time - this.lastTime) / 1000;
        this.lastTime = time;
        this._step(dt);

        const objects = Array.from(this.physicsWorld.objects);
        const gl = this.gl;

        // The stereo framebuffer was already bound + cleared once by ActionXR. Tell the engine's
        // render() not to clear again between eyes; we restore this immediately after.
        this.canvasManager.suppressClear = true;

        for (const view of pose.views) {
            const vp = layer.getViewport(view);
            gl.viewport(vp.x, vp.y, vp.width, vp.height);

            // Feed this eye's exact matrices straight through. WebXR matrices are column-major
            // Float32Arrays — the same layout Matrix4 / gl.uniformMatrix4fv expect.
            this.objectRenderer._projectionOverride = view.projectionMatrix;      // asymmetric per-eye frustum
            this.objectRenderer._viewOverride = view.transform.inverse.matrix;    // world → eye

            // Also update camera.position (used by the object shader for specular/cameraPos) and a
            // matching target/up, so any lookAt-based helper stays roughly consistent with the eye.
            const m = view.transform.matrix; // eye → world
            this.camera.position = new Vector3(m[12], m[13], m[14]);
            this.camera.target = new Vector3(m[12] - m[8], m[13] - m[9], m[14] - m[10]); // pos + forward(-Z)
            this.camera.up = new Vector3(m[4], m[5], m[6]);

            this.renderer3D.render({ renderableObjects: objects, camera: this.camera });
        }

        // Clear the overrides so the flat preview (and anything else) is unaffected.
        this.objectRenderer._projectionOverride = null;
        this.objectRenderer._viewOverride = null;
        this.canvasManager.suppressClear = false;
    }
}

// ---- Bootstrap / UI ----
window.addEventListener("load", async () => {
    const canvas = document.getElementById("gameCanvas");
    const spike = new VRSpike(canvas);
    window.vrSpike = spike; // handy for console poking
    spike.startFlat();

    const btn = document.getElementById("enterVR");
    const status = document.getElementById("status");

    const supported = await ActionXR.isSupported();
    if (!supported) {
        btn.disabled = true;
        btn.textContent = "VR not available";
        status.textContent =
            "immersive-vr not supported here. Open this page in the Quest 3 browser over HTTPS " +
            "or via `adb reverse` to http://localhost (see VR_SPIKE.md). The flat preview below still runs.";
        return;
    }

    status.textContent = "VR ready. Put on the headset and press Enter VR.";
    btn.addEventListener("click", async () => {
        try {
            await spike.enterVR();
            status.textContent = "Presenting… (remove headset menu / squeeze to exit)";
        } catch (e) {
            status.textContent = "Failed to enter VR: " + e.message;
            console.error(e);
            spike.startFlat();
        }
    });
});
