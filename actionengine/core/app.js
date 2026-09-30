//actionengine/core/app.js

// Inject the minimal layout CSS the three-layer canvas stack needs. The engine is
// canvas-based and ships no theming — this only positions #appContainer and the three
// overlapping canvases (CanvasManager reads the container's client size to scale them,
// and only sets z-index on the canvases inline).
(function () {
    const css = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

#appContainer {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: calc(80px + 1rem);
  background: radial-gradient(circle at center, #1a1a4a 0%, #0a0a2a 100%);
}

@media (orientation: landscape) {
  #appContainer {
    align-items: center;
    padding-top: 0;
  }
}

#gameCanvas, #guiCanvas, #debugCanvas {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: calc(80px + 2rem);
}

@media (min-aspect-ratio: 4/3) {
    #gameCanvas, #guiCanvas, #debugCanvas {
        top: 50%;
        transform: translate(-50%, -50%);
    }
}

canvas {
  outline: none !important;
}`;

    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
})();

class App {
    constructor(options = {}) {
        // Check if Game class specifies resolution (allows per-game configuration)
        const width = Game.WIDTH || 800;
        const height = Game.HEIGHT || 600;

        this.threelayersystem = new CanvasManager(width, height);
        const canvases = this.threelayersystem.getCanvases();
        this.audio = new ActionAudioManager();
        this.input = new ActionInputHandler(this.audio, canvases);
        this.game = new Game(canvases, this.input, this.audio);

        // Fixed timestep configuration
        this.fixedTimeStep = options.fixedTimeStep || 1 / 60; // Default 60Hz
        this.accumulatedTime = 0;

        // Spiral-of-death protection bounds WORK PER FRAME (a step count), not TIME.
        //
        // This used to clamp accumulatedTime to maxAccumulatedTime (0.2s), which SILENTLY DELETED
        // simulation time: on a 400ms hitch the loop ran 12 steps and threw the remaining ~250ms
        // away, so the world teleported forward without being simulated. Measured, that cost 37
        // missing steps and dropped the effective rate from 60Hz to 54Hz across three stalls.
        //
        // That is fatal for netcode: two clients hitching at different moments delete DIFFERENT
        // amounts of simulation and desync permanently, with nothing reporting that it happened.
        //
        // Now: run up to maxStepsPerFrame steps and KEEP the remainder, so a client catches up over
        // the following frames instead of losing world time. Only past a full second of debt do we
        // give up and shed — and that is recorded in stats, because a client that far behind should
        // resync from the server rather than quietly pretend it is in sync.
        this.maxStepsPerFrame = options.maxStepsPerFrame || 60; // 60 steps = 1s of catch-up at 60Hz

        // Retained for API compatibility; no longer used to clamp the accumulator.
        this.maxAccumulatedTime = options.maxAccumulatedTime || 0.2;

        // Observability: silent time loss is what made this bug invisible. Count it.
        this.timestepStats = { droppedTime: 0, shedEvents: 0, maxStepsInFrame: 0 };

        this.lastTime = null;

        // --- WebXR (additive, opt-in) ---
        // Set only when actionengine/xr/actionvr.js + actionxr.js are loaded AND the runtime reports
        // immersive-vr support. Until then everything below runs the ordinary flatscreen path.
        this.vr = null;

        // Start the game loop
        console.log("[App] Starting game loop...");
        this.loop();

        // Detect VR and, if available, add an "Enter VR" button. No-op on desktop/no-XR, so the
        // flatscreen path is completely unchanged.
        this._setupVR();
    }

    // Engine-driven loop (flatscreen). While an immersive session is presenting, the XR session owns
    // the frame pump (see _frameXR) and this RAF chain is intentionally suspended.
    loop(timestamp) {
        if (this.vr && this.vr.presenting) return; // XR session drives the frame pump instead

        const now = timestamp || performance.now();
        const alpha = this._update(now);

        // Pre-draw phase
        if (typeof this.game.action_pre_draw === "function") {
            this.game.action_pre_draw();
        }

        // Draw phase
        if (typeof this.game.action_draw === "function") {
            this.game.action_draw(alpha);
        }

        // Post-draw phase
        if (typeof this.game.action_post_draw === "function") {
            this.game.action_post_draw();
        }

        // Schedule the next frame
        requestAnimationFrame((timestamp) => this.loop(timestamp));
    }

    // Advance one frame of simulation (input + update phases) and return the render interpolation
    // factor (alpha). Shared verbatim by the flatscreen loop and the per-eye XR loop so both consume
    // simulation time identically — the only thing VR changes is the DRAW, never the update.
    _update(now) {
        // Calculate deltaTime (time since last frame in seconds)
        let deltaTime = this.lastTime ? (now - this.lastTime) / 1000 : 0;
        this.lastTime = now;

        // The TRUE elapsed time — this is what physics must consume, uncapped, or simulation time
        // goes missing (see the constructor note on maxStepsPerFrame).
        const elapsed = deltaTime;

        // Variable-timestep consumers (action_update / action_pre_update / action_draw) still get a
        // CAPPED delta: a 400ms hitch handed straight to render/animation code produces garbage
        // (huge camera jumps, animations skipping). Capping here is safe precisely because this
        // value never drives the fixed simulation.
        deltaTime = Math.min(deltaTime, 0.25);

        // Accumulate the REAL elapsed time. No clamp — the step-count bound in the fixed-update
        // loop below is what prevents the spiral of death, and it keeps the remainder instead of
        // discarding it.
        this.accumulatedTime += elapsed;

        // Capture input state for this frame (for regular updates)
        this.input.captureKeyState();
        this.input.setContext("update");

        // Pre-update phase (variable timestep, good for input handling)
        if (typeof this.game.action_pre_update === "function") {
            this.game.action_pre_update(deltaTime);
        }

        // Process fixed updates for physics and consistent game logic
        if (typeof this.game.action_fixed_update === "function") {
            // Check if we're going to do any physics updates this frame
            if (this.accumulatedTime >= this.fixedTimeStep) {
                this.input.setContext("fixed_update");

                // Run as many fixed updates as needed, BOUNDED BY STEP COUNT. Whatever is left over
                // stays in the accumulator and is consumed next frame, so no world time is lost.
                //
                // captureFixedKeyState() is called INSIDE the loop, once per step. It used to be
                // called once per FRAME, outside — which meant every step in a multi-step frame
                // compared the same unchanged current/previous snapshots, so isKeyJustPressed()
                // returned true on ALL of them. One F press then ran grabber.toggle() twice:
                // grab, one 23 u/s carry pull, then drop — in the same frame. The prop got kicked
                // and instantly released, which is the "I try to grab it and it flies away" bug.
                // Invisible at 144fps (0-1 steps/frame, edge consumed once) and constant at 30fps
                // (2 steps/frame). Advancing the snapshot per step makes an edge fire on exactly
                // one step regardless of framerate — for every isKeyJustPressed consumer, not just
                // pickup.
                let steps = 0;
                while (this.accumulatedTime >= this.fixedTimeStep && steps < this.maxStepsPerFrame) {
                    this.input.captureFixedKeyState();
                    this.game.action_fixed_update(this.fixedTimeStep);
                    this.accumulatedTime -= this.fixedTimeStep;
                    steps++;
                }

                if (steps > this.timestepStats.maxStepsInFrame) this.timestepStats.maxStepsInFrame = steps;

                // Hit the ceiling with time still owed: the client is >1s behind and cannot simulate
                // its way back without stalling further. Shed the debt, but RECORD it — this is a
                // desync in multiplayer, and it must be detectable rather than silent.
                if (steps >= this.maxStepsPerFrame && this.accumulatedTime >= this.fixedTimeStep) {
                    this.timestepStats.droppedTime += this.accumulatedTime;
                    this.timestepStats.shedEvents++;
                    this.accumulatedTime = 0;
                }

                // Reset context back to update after physics is done
                this.input.setContext("update");
            }
        }

        // Update phase (variable timestep, good for non-physics logic)
        if (typeof this.game.action_update === "function") {
            this.game.action_update(deltaTime);
        }

        // Post-update phase (variable timestep)
        if (typeof this.game.action_post_update === "function") {
            this.game.action_post_update(deltaTime);
        }

        // Interpolation factor for smooth rendering between fixed steps.
        return this.accumulatedTime / this.fixedTimeStep;
    }

    // ---- WebXR ----

    // Called once from the constructor. Wires up an "Enter VR" button when the engine's XR module is
    // loaded and the runtime supports immersive-vr. Everything here is guarded so a game that doesn't
    // ship the xr/ scripts, or a browser without WebXR, behaves exactly as before.
    _setupVR() {
        if (typeof ActionVR === "undefined" || typeof ActionXR === "undefined") return;
        if (!this.game || !this.game.renderer3D) return; // ActionVR drives the 3D renderer
        ActionXR.isSupported().then((ok) => {
            if (!ok) return;
            this.vr = new ActionVR(this);
            this._addVRButton();
        }).catch(() => { /* no XR — stay flatscreen */ });
    }

    _addVRButton() {
        if (document.getElementById("actionEnterVR")) return;
        const btn = document.createElement("button");
        btn.id = "actionEnterVR";
        btn.textContent = "Enter VR";
        btn.style.cssText =
            "position:fixed;left:12px;top:12px;z-index:99999;font:600 15px system-ui,sans-serif;" +
            "padding:9px 16px;border:0;border-radius:9px;background:#4D96FF;color:#fff;cursor:pointer;";
        btn.addEventListener("click", async () => {
            try {
                btn.disabled = true;
                await this.vr.enter();
                btn.style.display = "none";
            } catch (e) {
                console.error("[App] Failed to enter VR:", e);
                btn.disabled = false;
                btn.textContent = "VR failed — retry";
            }
        });
        document.body.appendChild(btn);
        this._vrButton = btn;
    }

    // Called by ActionVR at the start of each immersive session.
    _onVRStart() {
        // Drop the stale flatscreen timestamp so the first XR frame doesn't dump a huge delta into
        // the accumulator.
        this.lastTime = null;
    }

    // Called by ActionVR when the immersive session ends — resume the flatscreen loop.
    _onVREnd() {
        this.lastTime = null;
        if (this._vrButton) { this._vrButton.style.display = ""; this._vrButton.disabled = false; }
        requestAnimationFrame((timestamp) => this.loop(timestamp));
    }

    // Per-frame entry point for the immersive loop, invoked by ActionVR from the XRSession's own
    // requestAnimationFrame. Runs the SAME update phases as the flat loop, then delegates the draw to
    // the driver, which renders the scene once per eye.
    _frameXR(now, driver, pose, layer) {
        const alpha = this._update(now);
        driver.renderStereo(alpha, pose, layer);
    }
}

window.addEventListener("load", () => {
    window.game = new App();
});
