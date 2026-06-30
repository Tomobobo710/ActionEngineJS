// game.js — Multiplayer FPS
//
// MAIN MENU -> Single Player (local, no net) or Multiplayer (ActionNetManagerGUI lobby).
// Single-player exists so we can iterate on the CHARACTER CONTROLLER instantly without the
// lobby/two-tab dance. Both modes reuse the same controller, arena, camera, viewmodel, HUD.
// Multiplayer netcode lives in FPSSession (fpsnet.js) on the ActionSim framework.
//
// Controls (in-game): C lock/unlock mouse · WASD · Mouse look · Space jump · Shift sprint · Left Alt walk ·
//   C crouch · Z shrink / X grow · F pickup · E toggle Soldier/Jetpack (single-player) · Q camera · Click fire.

// ============================================================================
// READING MAP — what transfers vs what's just FPS
// ============================================================================
// This is a reference, not a minimum. If you're cribbing it to build your OWN networked character
// game, here's the load-bearing SKELETON (the shape any such game re-derives) vs this game's FLAVOR
// (swap or drop it). Read accordingly — most of the line count is flavor.
//
//   ENGINE (actionengine/ — never game-side; reusable mechanism you don't write):
//     • ActionFPSController3D (+ weapon / combat / grabber / camera / body / input components) = the
//       character. `new ActionFPSController3D(world)` is a complete FPS character on its own.
//     • ActionSim* (server / client / transports) = the prediction + reconciliation netcode FRAMEWORK.
//
//   REUSABLE SKELETON (thin game-side glue — transfers in SHAPE to any networked character game):
//     • fpsnet.js / FPSSession — composes ActionSim: a predicted CLIENT world + an authoritative
//       SERVER world, transports (P2P + host loopback), wraps the controller as a sim entity, routes
//       remote snapshots to bodies, reconciles the local player. This shape is framework-dictated.
//     • FPSPlayerEntity (in fpscombat.js) — wraps the controller as that entity, DELEGATING health/grab
//       to the controller's own stores so there's one source of truth across single- and multiplayer.
//     • fpscontext.js — the play-mode seam (Offline = step directly / Networked = drive FPSSession) so
//       call sites never branch on mode. NOTE: HAVING two modes is a game choice, not engine-forced — a
//       different game might be online-only (no context at all) or model its modes differently.
//     • fpskits.js — a "kit" = subclass the controller and override ONE behavioral hook (jetpack = the
//       worked example). The engine owns the movement mechanism; a kit is just the flavor.
//
//   FPS-SPECIFIC FLAVOR (content / policy — replace wholesale for a different game):
//     • fpscombat.js (minus FPSPlayerEntity) — hitscan/rocket combat, the weapon roster, splash/
//       knockback, game modes, and the LAG-COMP resolver. Lag-comp only pays off for competitive twitch
//       hit-registration; a co-op or turn-based game drops it entirely.
//     • the grab config (this file, constructor) — gravity-gun prop pickup, the Half-Life-2 flavor.
//     • this file — arena, lighting, HUD, menu, lobby, nameplates, debug panels; plus the movement
//       tuning, the slide knobs (below), and the jetpack kit wiring. All of it this game's feel/content.
// ============================================================================

// ============================================================================
// SLIDE TUNING — all the slide knobs in one place. Tweak freely; live in both
// single-player and multiplayer (the slide is stateless, so they behave identically).
// ============================================================================
const FPS_SLIDE_TUNING = {
    slideEnabled: true,
    slideRequiresMoveInput: false, // false = crouch-at-speed slides even with no movement key (sprint→jump→crouch slides). true = must hold a move key to slide (forbids no-key slides). This is the on/off for no-key slides — independent of groundStopDecel, which only sets stop FEEL.
    // Slide triggers automatically whenever you're moving faster than normal move speed (i.e.
    // sprinting) and holding crouch — no separate min-speed knob.
    slideEndSpeed: 10, // slow-tail floor: a slide rides down to this before it stops (hysteresis)
    slideFriction: 60, // speed bled per second on FLAT ground (lower = longer slides)
    slideControl: 0.14, // carve authority while sliding (higher = sharper steering; speed is preserved either way)
    slideSlopeMin: 0.2, // ground steeper than ~11° (sin of angle) becomes a gravity-fed slope slide
    slideSlopeFriction: 15, // cross-slope bleed on a slope (0 = drift forever, high = on-rails to the fall line)
    slideSlopeAccel: 1.5 // downhill speed rush (1 = real gravity, >1 = extra juice)
};

class Game {
    static WIDTH = 1280;
    static HEIGHT = 720;
    // Fell-out-of-the-world kill plane. Arena floor top is y≈0 and players stand at y≈9, so
    // anything this low means they've tunneled out. Single source for both SP and MP (FPSSession
    // reads Game.KILL_Y). Game-side only — the engine controller knows nothing about it.
    static KILL_Y = -1000;

    constructor(canvases, input, audio) {
        this.input = input;
        this.audio = audio;
        this.canvases = canvases;
        this.gameCanvas = canvases.gameCanvas;
        this.gl = this.gameCanvas.getContext("webgl2") || this.gameCanvas.getContext("webgl");
        this.guiCanvas = canvases.guiCanvas;
        this.guiCtx = canvases.guiCtx;
        this.debugCanvas = canvases.debugCanvas;
        this.debugCtx = canvases.debugCtx;

        this.renderer3D = new ActionRenderer3D(this.gameCanvas);
        this.camera = new ActionCamera();
        this.camera.fov = Math.PI * 0.42;
        this._applyFpsLighting(); // builds this game's ActionLightingProfile + applies it (re-syncs the sun)
        try { window.__game = this; } catch (e) {} // TEMP: debug handle for the preview tool

        // Client-owned LIVE AIM (mouse-driven). Camera reads this; the sim never does.
        this.aimYaw = 0;
        this.aimPitch = 0;
        this.maxPitch = 1.5;
        this.lookSensitivity = 0.0022;

        // Camera framing config (passed to the controller, which OWNS its first-person camera rig —
        // see ActionFPSCamera). The rig handles FP/third-person framing, step/crouch smoothing (via the
        // controller's view-displacement) and wall pull-in — all scale-correct. Aim stays game-owned
        // (we pass lookDir each frame). Q (Action4) cycles modes. `this.fpsCamera` is a getter onto the
        // local controller's rig (see `get fpsCamera()`), so the camera comes WITH the character.
        this.cameraConfig = {
            modes: ["first", "modern", "classic"], // first-person → over-shoulder → centered
            distance: 40, // classic boom length (pre-scale)
            modernDistance: 20, // over-shoulder boom length, closer in (pre-scale)
            shoulder: 5, // over-shoulder lateral offset in "modern" (pre-scale)
            heightOffset: 5, // classic-mode camera lift above the eye (look over the character; pre-scale)
            collisionRadius: 5 // padding kept off walls when the boom is blocked (pre-scale)
        };
        this._localAvatar = null; // our own body mesh, rendered only in third-person (built on demand)

        // Controller tuning — the FULL ActionFPSController3D knob set, listed explicitly so this
        // demo doubles as the engine's usage doc. Shared by single-player AND multiplayer (and
        // every kit) so movement feel is identical everywhere. Values are the engine defaults
        // except where noted (coyote / jump-buffer / pushDynamics, which the FPS opts into).
        this.controllerTuning = {
            // Collider (pre-scale)
            width: 6,
            depth: 6,
            height: 18,
            mass: 10,
            eyeHeight: 18 * 0.42, // eye offset above body center
            // Ground movement — three gaits: walk (hold Left Alt) < run (default) < sprint (Shift). Crouch
            // multiplies the active gait by crouchSpeedMult (crouch-walk/run/sprint).
            walkSpeed: 38,
            moveSpeed: 70, // RUN (default no-modifier gait)
            sprintSpeed: 115,
            crouchSpeedMult: 0.5,
            sprintDecay: 100, // how fast the sprint boost bleeds after releasing SPRINT while still moving (units/sec; ~6 frames to shed 115→70).
            groundStopDecel: 800, // deceleration when you release ALL move keys (units/sec). Purely stop FEEL: high = crisp stop, low = slidey coast, 0 = frictionless drift. Does NOT gate sliding — use slideRequiresMoveInput for that. (800 ≈ a weighty ~5-frame stop from walk.)
            friction: 0, // kinematic grounding holds slopes; 0 keeps wall-slides clean
            // Air
            airControl: 0.12, // 0..1 horizontal steering authority per step while airborne
            // Jump + steps
            jumpSpeed: 46,
            stepHeight: 5, // max step-UP height
            stepDownDist: 5, // max step-DOWN snap
            coyoteTime: 0.1, // jump forgiven just after leaving a ledge (0 = off)
            jumpBuffer: 0.12, // jump forgiven just before landing (0 = off)
            // Slide — all knobs live in FPS_SLIDE_TUNING at the top of this file.
            ...FPS_SLIDE_TUNING,
            // Look + crouch
            maxPitch: 1.5, // vertical look clamp (radians)
            crouchRatio: 0.55, // crouched height as a fraction of standing
            // Prop pushing
            pushDynamics: true,
            pushForce: 1200
        };
        // Jetpack-kit extras (ActionJetpackController3D), shown explicitly too.
        this.jetpackTuning = {
            thrust: 220, // upward accel while thrusting (must exceed gravity)
            maxRiseSpeed: 80, // climb-rate clamp
            maxFuel: 2.5, // seconds of continuous thrust
            fuelRegen: 1.5 // fuel-seconds regained per second on the ground
        };

        // Weapon system: the equipped slot, FP viewmodels, recoil, muzzle/aim, fire dispatch, and the
        // cosmetic tracer/rocket/explosion FX now live on the CONTROLLER as its ActionFPSWeapon
        // component (engine mechanism) — `this.weapons` is just a getter onto the local controller's
        // weapon (see `get weapons()`), so every call site reads the one the character owns. The game
        // supplies only policy: the rig (third-person/remote weapon mount) and the roster CONTENT
        // (FPS_WEAPONS), passed to the controller at construction. The active slot rides the command on
        // `c.userData.weapon`, round-tripped by the controller (networked + reconciled).
        ActionFPSWeaponSystem.configureRig({ hand: "right", handX: 3.6, handY: 1.0, handZ: 1.2, weaponScale: 1.4 });
        // Weapon-system signals: the engine weapon system EMITS gameplay events; the game drives
        // presentation (audio + HUD) off them, decoupled from the fire/equip logic. A future GLB's
        // animation clips bind to these same names. Subscribed once (the emitters are static).
        ActionFPSWeaponSystem.on("equip", (e) => this.addMessage("Weapon: " + e.name));
        ActionFPSWeaponSystem.on("draw", () => this.audio.play("draw", { volume: 0.3 }));
        ActionFPSWeaponSystem.on("holster", () => this.audio.play("holster", { volume: 0.25 }));
        ActionFPSWeaponSystem.on("fire", () => this.audio.play("shoot", { volume: 0.4 }));
        ActionFPSWeaponSystem.on("reload", () => this.audio.play("reload", { volume: 0.4 }));
        ActionFPSWeaponSystem.on("empty", () => this.audio.play("empty", { volume: 0.35 }));
        ActionFPSWeaponSystem.on("impact", () => this.audio.play("impact", { volume: 0.25 }));
        ActionFPSWeaponSystem.on("explode", () => this.audio.play("shoot", { volume: 0.5 }));
        this._reloadDown = false; // R-key rising-edge tracker for reload
        this._messages = [];

        this.state = "MENU"; // 'MENU' | 'LOBBY' | 'GAME'
        this.session = null; // multiplayer
        this.fpsContext = null; // FPSContext — the play-mode seam (OfflineContext | NetworkedContext)
        this.spWorld = null; // single-player world
        this.spController = null;
        this.kit = "soldier"; // active controller kit (soldier|jetpack) — used in BOTH modes
        this.playerScale = 1; // live character scale (Z/X) — rides in the command, so it's networked
        // Pickup (F): the gravity-gun grab/carry/throw now lives on the CONTROLLER's ActionFPSGrabber
        // component (engine mechanism) — the held id, the raycast/hold/pull math, and the grace-reconcile
        // all moved there. The game supplies only POLICY via this config: what's grabbable (our props are
        // named "prop0".."propN", so we grab only those — never players) and the tuning (pre-scale
        // ranges; graceTicks = how long a fresh local grab/drop ignores contradicting host authority).
        // Passed to every local/server controller at construction (like cameraConfig), so SP, the MP
        // client's predicted body, and the host's authoritative bodies all share one grabber config.
        this.grabConfig = {
            grabRange: 50,
            holdDist: 24,
            maxSpeed: 260,
            graceTicks: 30,
            canGrab: (body) => (body.name || "").startsWith("prop")
        };
        this.gui = null;

        this.modal = null; // { title, message, buttons:[{label, action, rect}] } — quit / host-left

        this._setupMenu();
        this._setupModalButtons();

        // Click-to-play / click-to-fire (a click is a valid user gesture for pointer lock,
        // and the pointer-lock element gets the events, not the canvases). Esc releases
        // (browser default). Frees C for crouch.
        this._fireRequested = false; // set on click, consumed by buildCommand (fixed tick)
        document.addEventListener("mousedown", (e) => {
            if (this.modal) return; // a modal owns the cursor — don't lock/fire underneath it
            // The auto-shadow debug panel (8) owns the cursor while open — don't lock or fire.
            if (this.autoShadowPanel && this.autoShadowPanel.visible) return;
            if (this.state !== "GAME" || e.button !== 0) return;
            if (!document.pointerLockElement) document.body.requestPointerLock();
            else this._fireRequested = true;
        });

        // Combat HUD feedback (countdown timers decremented per frame in action_update). SP health/dead
        // now live on the controller's combat component (see OfflineContext.localHealth/localDead).
        this._hitMarkerLife = 0; // crosshair hit confirm
        this._hitWasKill = false;
        this.hideHUD = false; // 7 toggles all 2D HUD incl. crosshair (for clean screenshots)
        this.hideViewModel = false; // 6 toggles the first-person weapon viewmodel
        this.showAABB = false; // 5 toggles physics AABB wireframes (collision debug)
        this._damageFlashLife = 0; // red vignette when we take damage

        this.createSounds();
        console.log("[FPS] Boot — main menu.");
    }

    _setupMenu() {
        const bw = 260,
            bh = 56;
        const cx = (Game.WIDTH - bw) / 2;
        this.menuButtons = [
            { id: "spBtn", x: cx, y: 250, width: bw, height: bh, text: "SINGLE PLAYER" },
            { id: "mpBtn", x: cx, y: 330, width: bw, height: bh, text: "MULTIPLAYER" }
        ];
        for (const b of this.menuButtons) {
            this.input.registerElement(b.id, {
                bounds: () => ({ x: b.x, y: b.y, width: b.width, height: b.height })
            });
        }
    }

    // =====================================================================
    // Modal dialogs (quit confirm / host-left) — game-side, drawn over GAME or LOBBY
    // =====================================================================

    _setupModalButtons() {
        // Two reusable button slots; their bounds resolve from the active modal's layout.
        for (let i = 0; i < 2; i++) {
            this.input.registerElement("modalBtn" + i, {
                bounds: () => {
                    const b = this.modal && this.modal.buttons[i];
                    return b && b.rect ? b.rect : { x: -1000, y: -1000, width: 0, height: 0 };
                }
            });
        }
    }

    openModal(title, message, buttons) {
        const W = Game.WIDTH;
        const H = Game.HEIGHT;
        const bw = 170;
        const bh = 50;
        const gap = 24;
        const totalW = buttons.length * bw + (buttons.length - 1) * gap;
        const x0 = (W - totalW) / 2;
        const y = H / 2 + 40;
        buttons.forEach((b, i) => (b.rect = { x: x0 + i * (bw + gap), y, width: bw, height: bh }));
        this.modal = { title, message, buttons };
        this._fireRequested = false;
        if (document.pointerLockElement) document.exitPointerLock(); // free the cursor for clicks
    }

    closeModal() {
        this.modal = null;
    }

    _updateModal() {
        for (let i = 0; i < this.modal.buttons.length; i++) {
            if (this.input.isElementJustPressed("modalBtn" + i)) {
                this.modal.buttons[i].action();
                return;
            }
        }
    }

    drawModal() {
        if (!this.modal) return;
        const ctx = this.guiCtx;
        const W = Game.WIDTH;
        const H = Game.HEIGHT;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, W, H);
        const pw = 480;
        const ph = 200;
        const px = (W - pw) / 2;
        const py = (H - ph) / 2;
        ctx.fillStyle = "#11161c";
        ctx.strokeStyle = "#9fe8ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, 10);
        ctx.fill();
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#9fe8ff";
        ctx.font = "bold 28px Orbitron, sans-serif";
        ctx.fillText(this.modal.title, W / 2, py + 46);
        ctx.fillStyle = "#cfeaff";
        ctx.font = "16px Arial";
        ctx.fillText(this.modal.message, W / 2, py + 90);
        this.modal.buttons.forEach((b, i) => {
            const r = b.rect;
            const hover = this.input.isElementHovered("modalBtn" + i);
            ctx.fillStyle = hover ? "#1b6b86" : "#123";
            ctx.strokeStyle = "#9fe8ff";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(r.x, r.y, r.width, r.height, 8);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#eaffff";
            ctx.font = "18px Orbitron, sans-serif";
            ctx.fillText(b.label, r.x + r.width / 2, r.y + r.height / 2);
        });
    }

    // ---- quit / disconnect flows ----

    openQuitModal() {
        const msg = this.fpsContext.isNetworked ? "Leave the match and return to the lobby?" : "Return to main menu?";
        this.openModal("Quit", msg, [
            { label: "Yes", action: () => this._performQuit() },
            { label: "No", action: () => this.closeModal() }
        ]);
    }

    _performQuit() {
        this.closeModal();
        if (this.fpsContext.isNetworked) this._leaveToLobby();
        else this._goToMenu(); // host: guests get hostLeft; guest: host gets guestLeft
    }

    _goToMenu() {
        if (this.spController) this.spController.destroy();
        this.spController = null;
        this.spWorld = null;
        this.fpsContext = null;        this.state = "MENU";
    }

    // Leave the current room and return to the GUI lobby (room list), staying connected.
    _leaveToLobby() {
        this._teardownSession();
        const nm = this.gui.getNetManager();
        if (nm && nm.leaveRoom) nm.leaveRoom();
        this.gui.currentState = "LOBBY";
        this.gui.selectedIndex = 0;        this.state = "LOBBY";
    }

    _teardownSession() {
        if (this.session) {
            this.session.destroy();
            this.session = null;
        }
        this.fpsContext = null;
    }

    // Guest only: the host closed the room / dropped. Return to the lobby with a notice modal.
    _onHostLeft() {
        if (!this.fpsContext || !this.fpsContext.isNetworked) {
            this.addMessage("Host left the game");
            return;
        }
        this._teardownSession();
        const nm = this.gui.getNetManager();
        if (nm && nm.leaveRoom) nm.leaveRoom(); // local cleanup (host already gone)
        this.gui.currentState = "LOBBY";
        this.gui.selectedIndex = 0;        this.state = "LOBBY";
        this.openModal("Host left", "The host closed the room.", [
            { label: "Return to lobby", action: () => this.closeModal() }
        ]);
    }

    // =====================================================================
    // Mode entry
    // =====================================================================

    enterSinglePlayer() {
        this.state = "GAME";
        this.spWorld = new ActionPhysicsWorld3D();
        this.buildArena(this.spWorld);
        this.spawnProps(this.spWorld);
        this.buildOmniTestRooms(this.spWorld);
        this._spawnSpController();
        this.fpsContext = new OfflineContext(this); // no network, no sim
        this.addMessage("Single player — C to lock mouse, E swaps kit.");
    }

    _makeSpController(spawn) {
        const opts = {
            ...this.controllerTuning, // demonstrate the full controller config (single source of truth)
            position: spawn,
            scale: this.playerScale,
            visible: false, // first-person: don't render our own collider
            color: "#cc4444", // collider color (only shown when visible:true)
            bodyName: "spLocal",
            // The character comes WITH its weapon system, camera rig, AND combat (the health/death/
            // respawn store) — the game supplies the roster, camera framing, and combat tuning (policy).
            // SP self-drives combat (kill-plane + respawn) via the component; respawnTime 0 keeps the
            // fell-out-of-world reset instant like before. It still renders its own body avatar.
            weapons: FPS_WEAPONS,
            view: this.cameraConfig,
            combat: {
                maxHealth: 100,
                respawnTime: 0, // instant respawn on fall (SP has no damage source — preserves old feel)
                killPlaneY: Game.KILL_Y,
                spawnPoint: () => new Vector3(0, 24, -60),
                onDeath: () => this.addMessage("You fell out of the world.")
            },
            grab: this.grabConfig, // gravity-gun pickup (props only) — the controller owns the mechanism
            model: false,
            input: false
        };
        const ctrl = this.kit === "jetpack"
            ? new ActionJetpackController3D(this.spWorld, { ...opts, ...this.jetpackTuning })
            : new ActionFPSController3D(this.spWorld, opts); // default kit = the base controller, instantiated directly
        this._wireLocalWeapon(ctrl); // inject the networked enemy-box seam (tracer clamp); aim/camera self-wire
        return ctrl;
    }

    _spawnSpController() {
        this.spController = this._makeSpController(new Vector3(0, 24, -60));
    }

    // Swap soldier/jetpack in BOTH modes. SP rebuilds its local controller directly; MP rebuilds
    // the local PREDICTED controller and rides the kit in the command (c.kit) so the host rebuilds
    // its authoritative copy too — keeping prediction and the server in the same kit.
    toggleKit() {
        this.kit = this.kit === "soldier" ? "jetpack" : "soldier";
        this.fpsContext.setKit(this.kit); // offline rebuilds the local controller; networked rides it in the command
        this.addMessage("Kit: " + this.kit);
    }

    // Lighting for THIS game's arena. The profile is owned by the game (the engine ships only the
    // ActionLightingProfile class — it knows nothing about "fpsArena"). One call bundles the whole
    // auto-lighting scenario — raking afternoon sun, AUTO_FIT, range/pullback, bias slacks, hemisphere
    // ambient, exposure/tonemap, PCF/PCSS — and re-syncs the sun (ordering gotcha handled in-engine).
    _applyFpsLighting() {
        this.renderer3D.applyLightingProfile(
            new ActionLightingProfile({
                autoFit: true,
                // raking afternoon sun (~43° off vertical) so shadows stretch and read clearly
                sun: { direction: [-0.9, -1.0, -0.6], intensity: 2.5 },
                range: 250, // covers this arena
                pullback: "auto", // derive from caster bounds
                snap: true,
                quant: 16,
                padding: 0,
                map: 4096,
                bias: { flat: 6, slope: 8, normal: -2.5, slopeClamp: 6.5 },
                ambient: { intensity: 0.35, sky: [0.55, 0.65, 0.85], ground: [0.35, 0.3, 0.25] },
                output: { exposure: 1.0, tonemap: true },
                filter: { pcf: true, kernel: 9, softness: 0.2, darkness: 0.75, pcssMax: 24 }
            })
        );
    }

    // 8 toggles the AutoShadowPanel — live controls for the auto directional-shadow knobs (bias in
    // texels, shadow range, pullback, map size). Built lazily; frees the cursor so the sliders are
    // draggable.
    toggleAutoShadowPanel() {
        if (!this.autoShadowPanel) {
            this.autoShadowPanel = new AutoShadowPanel(this.debugCanvas, this);
        }
        const on = !this.autoShadowPanel.visible;
        this.autoShadowPanel.visible = on;
        if (on) {
            this.autoShadowPanel.show();
            if (document.pointerLockElement) document.exitPointerLock();
        } else if (this.debugCtx) {
            this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
        }
    }

    // Scale rides in the command (buildCommand), so the controller applies it on both the
    // client and the host — single-player and multiplayer use the identical path.
    adjustScale(delta) {
        this.playerScale = Math.max(0.25, Math.min(4, Math.round((this.playerScale + delta) * 100) / 100));
        this.addMessage("Scale: " + this.playerScale.toFixed(2));
    }

    // ===== Pickup (F) — gravity-gun grab/carry/throw ==========================================
    // The mechanic now lives on the CONTROLLER's ActionFPSGrabber component (engine mechanism): the grab
    // DECISION (toggle on the F edge), the per-tick CARRY (velocity-pull toward a hold point, run pre-step
    // in each world's stepWorld), and the grace-reconcile all moved there. The game keeps only POLICY:
    // the grabConfig (what's grabbable + tuning, set in the constructor and passed to every controller),
    // and the MP WIRING below — the host re-decides the grab and streams the held id back; the client
    // predicts its own and reconciles. SP just toggles + drives its controller's grabber.

    enterMultiplayer() {
        // Up the room capacity (default is 2). Spread the engine's default P2P config so we only
        // override maxPlayers (keeps tracker/ICE settings intact).
        const p2pConfig = { ...ActionNetManagerGUI.P2P_NETWORK_CONFIG, maxPlayers: 24 };
        this.gui = new ActionNetManagerGUI(this.canvases, this.input, this.audio, { mode: "p2p", p2pConfig });
        this._wireNetworkEvents();
        this.state = "LOBBY";
    }

    _wireNetworkEvents() {
        const nm = this.gui.getNetManager();
        nm.on("roomCreated", () => {
            if (this.state !== "GAME") this.enterGameMP(true);
        });
        this.gui.on("joinedRoom", () => {
            if (!nm.isCurrentUserHost() && this.state !== "GAME") this.enterGameMP(false);
        });
        nm.on("joinRequest", (req) => {
            const pid = req && (req.peerId || req.id);
            if (req && typeof req.accept === "function") req.accept();
            else if (pid) nm.acceptJoin(pid);
        });
        nm.on("hostLeft", () => this._onHostLeft());
        // Back button on the login/lobby screen → return to our main menu. The GUI disconnects
        // itself before emitting "back", so we just tear down the lobby and reset to MENU.
        this.gui.on("back", () => this.returnToMenu());
    }

    returnToMenu() {
        if (this.state === "GAME") return; // back only applies from the pre-game lobby
        this._teardownSession();
        this.gui = null;        this.state = "MENU";
    }

    enterGameMP(isHost) {
        this.state = "GAME";
        this.isHost = isHost;
        this.session = new FPSSession(this, this.gui, isHost);
        this.fpsContext = new NetworkedContext(this, this.session); // host/guest, ActionSim
        this.addMessage((isHost ? "Hosting" : "Joined"));
    }

    // Active local player controller (works for both modes).
    getPlayer() {
        return this.fpsContext.localController;
    }

    // The local player's weapon = the CONTROLLER's weapon component. One getter so every call site
    // (buildCommand, HUD, fpsnet FX routing) reads the weapon the character actually owns instead of a
    // parallel game-side instance. Null before a match starts (no controller yet).
    get weapons() {
        const p = this.getPlayer && this.fpsContext ? this.getPlayer() : null;
        return p ? p.weapon : null;
    }

    // The camera rig = the local controller's OWN ActionFPSCamera (built from this.cameraConfig). One
    // getter so the camera comes with the character; null before a match starts (no controller yet).
    get fpsCamera() {
        const p = this.getPlayer && this.fpsContext ? this.getPlayer() : null;
        return p ? p.view : null;
    }

    // Carry the equipped slot + ammo across a controller REBUILD (kit swap). The weapon now lives on
    // the controller, which is destroyed/recreated on a kit change, so without this a swap would reset
    // you to the gun with a full mag — the old game-side FPSWeapons survived the swap, so match that.
    _carryWeaponState(oldCtrl, newCtrl) {
        const a = oldCtrl && oldCtrl.weapon;
        const b = newCtrl && newCtrl.weapon;
        if (!a || !b) return;
        b.weaponSlot = a.weaponSlot;
        b.viewmodel = b.viewmodels[a.weaponSlot] || b.viewmodels[0];
        b.ammo = a.ammo.slice();
        if (newCtrl.userData) newCtrl.userData.weapon = b.weaponSlot;
    }

    // Inject the game's policy seam into a freshly-built LOCAL controller's weapon: the networked enemy
    // boxes for the cosmetic tracer clamp. The LIVE aim is now fed via controller.aim() each frame
    // (the controller routes it to the weapon/camera/body itself), and weapon.view is auto-wired by the
    // controller to its own camera rig — so neither is wired here. Called once per local controller build.
    _wireLocalWeapon(ctrl) {
        if (!ctrl || !ctrl.weapon) return;
        const game = this;
        ctrl.weapon.context = {
            get isNetworked() { return game.fpsContext ? game.fpsContext.isNetworked : false; },
            enemyBoxes() {
                const out = [];
                const mgr = game.session && game.session.avatarMgr;
                if (!mgr) return out;
                for (const [, a] of mgr.all) {
                    const o = a.object;
                    if (!o || !o.triangles.length) continue; // dead avatars have no mesh
                    const p = o.transform.position;
                    const s = o.transform.scale;
                    out.push({ x: p.x, y: p.y, z: p.z, hx: 3 * (s ? s.x : 1), hy: 9 * (s ? s.y : 1), hz: 3 * (s ? s.x : 1) });
                }
                return out;
            }
        };
    }

    getRenderObjects() {
        return this.fpsContext.renderObjects();
    }

    // Build line segments for every physics body's AABB in the world the LOCAL player collides
    // against (SP world, or the client prediction world in MP — the one our raycasts hit). Static
    // geometry is drawn blue, dynamic bodies (props, players) green, so the collision space we
    // debugged for #6/#7 is visible. Returns an array of {start,end,color} for the line shader.
    _buildAABBLines() {
        const world = this.fpsContext && this.fpsContext.world;
        const gw = world && world.getWorld && world.getWorld();
        const bodies = gw && gw.rigid_bodies;
        if (!bodies || !bodies.length) return null;
        const segs = [];
        const STATIC = [0.3, 0.45, 1.0];
        const DYNAMIC = [0.3, 1.0, 0.45];
        for (const b of bodies) {
            const ab = b.aabb;
            if (!ab || !ab.min || !ab.max) continue;
            this._pushBoxEdges(segs, ab.min, ab.max, b._mass === Infinity ? STATIC : DYNAMIC);
        }
        return segs;
    }

    // Push the 12 edges of an axis-aligned box [min,max] as line segments.
    _pushBoxEdges(segs, min, max, color) {
        const c = [
            [min.x, min.y, min.z], [max.x, min.y, min.z], [max.x, min.y, max.z], [min.x, min.y, max.z], // bottom
            [min.x, max.y, min.z], [max.x, max.y, min.z], [max.x, max.y, max.z], [min.x, max.y, max.z]  // top
        ];
        const E = [
            [0, 1], [1, 2], [2, 3], [3, 0], // bottom loop
            [4, 5], [5, 6], [6, 7], [7, 4], // top loop
            [0, 4], [1, 5], [2, 6], [3, 7]  // verticals
        ];
        for (const [a, d] of E) segs.push({ start: c[a], end: c[d], color });
    }

    // Our own body, shown only in third-person (in first-person it'd be in the camera). Driven by our
    // controller's state via the engine body component (ActionFPSBodyModel) — the SAME class remotes
    // use — so it reflects our position/yaw/scale/crouch and poses the equipped weapon. Built lazily;
    // the id (local peer in MP, "sp" solo) just seeds the identity color.
    _updateLocalAvatar(alpha) {
        const ctrl = this.getPlayer();
        if (!ctrl) return null;
        if (!this._localAvatar) {
            this._localAvatar = new ActionFPSBodyModel(fpsColorFor(this.fpsContext.localId));
        }
        // Pose our own third-person body at the SAME interpolated position as the camera, so the
        // body and view never disagree between physics ticks. Eye = body + eyeHeight, so subtract
        // eyeHeight to get the interpolated body origin getState() otherwise reports.
        const st = ctrl.getState();
        const re = ctrl.renderEye(alpha); // controller-owned sub-tick eye (same one the camera rides)
        if (re) {
            st.x = re.x;
            st.y = re.y - ctrl.eyeHeight;
            st.z = re.z;
        }
        this._localAvatar.setState(st);
        return this._localAvatar.getRenderObjects(); // body + posed weapon
    }

    // =====================================================================
    // World
    // =====================================================================

    buildArena(world) {
        const FLOOR = "#3a4750";
        const WALL = "#586a78";
        const STEP = "#7a6a52";
        const RAMP = "#6a7a52";
        const add = (w, h, d, pos, color) => {
            const o = new ActionPhysicsBox3D(w, h, d, 0, pos, color);
            world.addObject(o);
            return o;
        };

        add(500, 4, 500, new Vector3(0, -2, 0), FLOOR);
        const R = 250,
            T = 6,
            H = 40;
        add(2 * R, H, T, new Vector3(0, H / 2, R), WALL);
        add(2 * R, H, T, new Vector3(0, H / 2, -R), WALL);
        add(T, H, 2 * R, new Vector3(R, H / 2, 0), WALL);
        add(T, H, 2 * R, new Vector3(-R, H / 2, 0), WALL);

        const stepRise = 4;
        const stepDepth = 10;
        for (let i = 0; i < 6; i++) {
            const h = stepRise * (i + 1);
            add(40, h, stepDepth, new Vector3(60, h / 2, -20 + i * stepDepth), STEP);
        }
        add(40, stepRise * 6, 40, new Vector3(60, (stepRise * 6) / 2, 60), STEP);

        const ramp = add(40, 3, 70, new Vector3(-60, 10, 0), RAMP);
        ramp.body.rotation = Quaternion.fromAxisAngle(new Vector3(1, 0, 0), -0.32);

        // A long, steeper hill out on the +x side — a proper slope to slide down (the short ramp
        // above barely shows the slide's slope acceleration). Low end (-z) meets the floor; walk
        // up to the high end, then sprint + crouch to slide down its full length.
        const hill = add(40, 4, 100, new Vector3(150, 26, 30), RAMP);
        hill.body.rotation = Quaternion.fromAxisAngle(new Vector3(1, 0, 0), -0.5);

        add(16, 5, 16, new Vector3(-20, 2.5, 40), STEP);
        add(16, 9, 16, new Vector3(10, 4.5, 50), STEP);
        add(14, 16, 14, new Vector3(40, 8, -50), WALL);
        add(12, 60, 12, new Vector3(0, 30, 0), WALL);
    }

    // THE arena prop layout — the single source of truth for what props exist and where, used by BOTH
    // single-player (spawnProps, below) and the MP host (fpsnet _spawnProps), so the two modes show the
    // EXACT same world. 2 of every spawnable primitive (box/sphere/capsule/cone/cylinder). The `shape`
    // tag rides the layout → snapshot → client ghost so MP replicates the real shapes, not just boxes.
    // (The whole arena is slated to become one ActionModel3D later.)
    fpsPropLayout() {
        // One distinct color per prop (10 props, 10 colors) — the two copies of a shape don't match.
        const colors = [
            "#e94b3c", "#f0a500", "#3cba54", "#4285f4", "#b06af0",
            "#ff6fae", "#00c2c7", "#a3d900", "#ff8c42", "#7c5cff"
        ];
        const kinds = [
            { shape: "box", w: 8, h: 8, d: 8 },
            { shape: "sphere", r: 4 },
            { shape: "capsule", r: 3, h: 8 },
            { shape: "cone", r: 4, h: 8 },
            { shape: "cylinder", r: 4, h: 8 }
        ];
        const out = [];
        for (let copy = 0; copy < 2; copy++) {
            for (let s = 0; s < kinds.length; s++) {
                out.push({ ...kinds[s], x: -50 + s * 25, y: 14, z: -90 + copy * 22, mass: 2, color: colors[out.length] });
            }
        }
        return out;
    }

    // Build one prop body from a spec (a layout entry OR a replicated snapshot — both carry shape+dims).
    // THE single prop-construction path: SP builds dynamic bodies, the MP host builds dynamic bodies +
    // wraps them for replication, and the MP client rebuilds them as DYNAMIC predicted bodies (same
    // mass, from the snapshot) so pushes are predicted locally. Material is baked in so every copy is
    // identical. `mass` overrides the spec's mass when provided (e.g. a static stand-in).
    buildProp(s, mass) {
        const m = mass !== undefined ? mass : s.mass || 0;
        const pos = new Vector3(s.x, s.y, s.z);
        let obj;
        switch (s.shape) {
            case "sphere":
                obj = new ActionPhysicsSphere3D(s.r, m, pos, s.color);
                break;
            case "capsule":
                obj = new ActionPhysicsCapsule3D(s.r, s.h, m, pos, s.color);
                break;
            case "cone":
                obj = new ActionPhysicsCone3D(s.r, s.h, m, pos, s.color);
                break;
            case "cylinder":
                obj = new ActionPhysicsCylinder3D(s.r, s.h, m, pos, s.color);
                break;
            default:
                obj = new ActionPhysicsBox3D(s.w, s.h, s.d, m, pos, s.color);
        }
        obj.body.friction = 0.6;
        obj.body.restitution = 0.1;
        return obj;
    }

    spawnProps(world) {
        // Name each prop "prop0".."propN" — the same id scheme MP uses — so the pickup raycast can
        // identify a grabbable prop by body name (and SP/MP share one pickup code path).
        const specs = this.fpsPropLayout();
        for (let i = 0; i < specs.length; i++) {
            const box = this.buildProp(specs[i]);
            box.body.name = "prop" + i;
            world.addObject(box);
        }
    }

    // Four roofed corner rooms, each a different omni-shadow benchmark. The ROOF is the point: it
    // blocks the directional sun so the interior is lit ONLY by that room's point light, making the
    // cubemap shadows unmistakable (outdoors the bright sun washes them out). Each room leaves a
    // doorway facing the arena center so you can walk in. Lights are deliberately modest (intensity
    // ~1, radius sized to the room) — the earlier test lights were way too bright in the open.
    buildOmniTestRooms(world) {
        const WALL = "#4a5560";
        const PILLAR = "#8a8f96";
        const add = (w, h, d, pos, color, rot) => {
            const o = new ActionPhysicsBox3D(w, h, d, 0, pos, color);
            if (rot) o.body.rotation = rot;
            world.addObject(o);
            return o;
        };

        // Build a roofed box room centered at (cx,cz) with a doorway gap on the wall facing the arena
        // center. half = interior half-extent, H = wall height, T = wall/roof thickness.
        const room = (cx, cz, half, H, T) => {
            const innerX = cx < 0 ? cx + half : cx - half; // wall nearest arena center (gets the door)
            const backX = cx < 0 ? cx - half : cx + half;
            const doorHalf = 13;
            add(2 * half, T, 2 * half, new Vector3(cx, H + T / 2, cz), WALL); // roof
            add(T, H, 2 * half, new Vector3(backX, H / 2, cz), WALL); // back X wall
            add(2 * half, H, T, new Vector3(cx, H / 2, cz - half), WALL); // -Z wall
            add(2 * half, H, T, new Vector3(cx, H / 2, cz + half), WALL); // +Z wall
            // front (inner) X wall split around a central doorway
            const segLen = half - doorHalf;
            add(T, H, segLen, new Vector3(innerX, H / 2, cz - doorHalf - segLen / 2), WALL);
            add(T, H, segLen, new Vector3(innerX, H / 2, cz + doorHalf + segLen / 2), WALL);
        };

        // Geometry is built into whatever world is passed (SP world, MP client world, MP server
        // world), but the omni LIGHTS are global render-side objects — create them exactly once,
        // regardless of how many worlds get the geometry, so SP and MP show the same scene.
        const lm = this.renderer3D && this.renderer3D.lightManager;
        // Spawn the omni lights only when none exist yet — self-correcting, so building the geometry
        // into multiple worlds (SP, MP client, MP server) never duplicates lights, and re-entering a
        // scene that cleared them respawns correctly.
        const spawnLights = !!(lm && lm.pointLights && lm.pointLights.length === 0);
        const light = (pos, color, intensity, radius) => {
            if (spawnLights && lm && typeof lm.createPointLight === "function") {
                lm.createPointLight(pos, color, intensity, radius, true);
            }
        };

        const half = 44,
            H = 42,
            T = 4;

        // --- Room 1 (-x,-z): 4 pillars around a CENTERED omni. The canonical test — a clean radial
        // shadow star on the floor and up all four walls. ---
        {
            const cx = -175,
                cz = -175;
            room(cx, cz, half, H, T);
            const off = 20;
            add(7, H, 7, new Vector3(cx - off, H / 2, cz - off), PILLAR);
            add(7, H, 7, new Vector3(cx + off, H / 2, cz - off), PILLAR);
            add(7, H, 7, new Vector3(cx - off, H / 2, cz + off), PILLAR);
            add(7, H, 7, new Vector3(cx + off, H / 2, cz + off), PILLAR);
            light(new Vector3(cx, 22, cz), new Vector3(1.0, 0.9, 0.75), 1.1, 80); // warm-white, center
        }

        // --- Room 2 (+x,-z): a single tall caster with the omni OFFSET to a corner → one long, clean
        // directional shadow thrown across the floor and up the far wall (the easiest to eyeball). ---
        {
            const cx = 175,
                cz = -175;
            room(cx, cz, half, H, T);
            add(10, 34, 10, new Vector3(cx, 17, cz), PILLAR); // central box caster
            light(new Vector3(cx - 28, 30, cz - 28), new Vector3(0.6, 0.75, 1.0), 1.2, 95); // cool, high corner
        }

        // --- Room 3 (-x,+z): a "picket" row of thin tall slabs with the omni at one end → a fan of
        // parallel shadows that spread with distance (shows penumbra/precision falloff). ---
        {
            const cx = -175,
                cz = 175;
            room(cx, cz, half, H, T);
            for (let i = 0; i < 5; i++) {
                add(3, 30, 12, new Vector3(cx - 24 + i * 12, 15, cz), PILLAR);
            }
            light(new Vector3(cx, 24, cz - 30), new Vector3(0.9, 1.0, 0.85), 1.1, 90); // end of the row
        }

        // --- Room 4 (+x,+z): a raised horizontal beam on two short posts, omni BELOW it → casts the
        // beam's shadow UP onto the ceiling and the posts' shadows DOWN on the floor (over/under). ---
        {
            const cx = 175,
                cz = 175;
            room(cx, cz, half, H, T);
            add(6, 16, 6, new Vector3(cx - 16, 8, cz), PILLAR); // post
            add(6, 16, 6, new Vector3(cx + 16, 8, cz), PILLAR); // post
            add(44, 5, 8, new Vector3(cx, 18, cz), PILLAR); // beam across the posts
            light(new Vector3(cx, 9, cz - 24), new Vector3(1.0, 0.7, 0.7), 1.1, 85); // low, warm
        }
    }

    // =====================================================================
    // Command + aim
    // =====================================================================

    buildCommand() {
        const c = this.getPlayer().sampleCommand(this.input); // controller's default sampler (keybind→command); we override a couple below
        // Walk = hold Left Alt, checked RAW (no action slot — we're out of them). Goes through the
        // same input snapshot as everything else (the fixed snapshot during fixed_update, so it stays
        // deterministic for the netcode command), it just isn't routed via actionMap. Overrides the
        // controller's default Action6/X walk binding, since X is now grow.
        c.walk = this.input.isRawKeyPressed("AltLeft");
        c.pickup = this.input.isKeyJustPressed("Action8"); // F edge → grab/drop intent (networked)
        c.yaw = this.aimYaw;
        c.pitch = this.aimPitch;
        c.scale = this.playerScale; // networked so host applies the same collider size
        c.userData = { weapon: this.weapons.weaponSlot }; // opaque payload the controller round-trips (host fires this slot, remotes render it)
        c.kit = this.kit === "jetpack" ? 1 : 0; // networked kit so the host rebuilds the same controller

        // Fire intent, consumed once per fixed tick (set by the click handler). The weapon owns the
        // client-side RATE-LIMIT now (tryPredictFire): it mirrors the host's fireCooldownTicks so the
        // client never predicts a shot the server will reject (the bug that let spammed rockets launch
        // without ever exploding) and dry-clicks an empty mag. Returns whether a shot is allowed.
        let wantFire = this.weapons.tryPredictFire(this._fireRequested);
        this._fireRequested = false;

        // While a modal (quit/host-left) is open, stand still — don't move or fire underneath it.
        if (this.modal) {
            c.forward = 0;
            c.right = 0;
            c.jumpPressed = false;
            c.jumpHeld = false;
            c.sprint = false;
            c.walk = false;
            c.crouch = false;
            c.pickup = false;
        }

        if (this.fpsContext.isNetworked) {
            if (this.fpsContext.localDead) {
                // Predict the death-freeze so we don't mispredict against the frozen server body.
                c.forward = 0;
                c.right = 0;
                c.jumpPressed = false;
                c.jumpHeld = false;
                c.sprint = false;
                c.walk = false;
                c.crouch = false;
                c.pickup = false;
                this.getPlayer().grabber.release(); // drop whatever we were carrying when we die
            }
            c.fire = wantFire && !this.fpsContext.localDead;
            c.viewTick = this.fpsContext.viewTick(); // lag-comp: the tick we're RENDERING (interp-delay aware)
            if (c.fire) {
                // Send the FULL aim ray WE used — the crosshair line. In 3rd person that's the
                // camera's center ray (origin = camera, not the eye); in FP it's the eye ray. The
                // host fires this exact ray for lag-comp, so authoritative damage lands under our
                // crosshair and matches the predicted tracer at every depth (enemy or wall). Without
                // it the host would use raw yaw/pitch (eye-forward) and 3rd-person shots hit off-aim.
                const cast = this.weapons.crosshairCast(this.fpsContext.world);
                c.aimOX = cast.origin.x;
                c.aimOY = cast.origin.y;
                c.aimOZ = cast.origin.z;
                c.aimX = cast.dir.x;
                c.aimY = cast.dir.y;
                c.aimZ = cast.dir.z;
                this.weapons.fire(); // predicted tracer/recoil/sound; damage is authoritative
            }
        } else if (wantFire) {
            this.weapons.fire(); // single-player: local tracer + prop push
        }
        // Grab/drop on the F edge (one-shot) — the controller's grabber decides. In MP this is the LOCAL
        // optimistic prediction; the host re-decides authoritatively and we reconcile in
        // FPSSession._onLocalState. Zeroed above while dead/modal, so it can't fire there.
        if (c.pickup) this.getPlayer().grabber.toggle();
        return c;
    }

    // Authoritative combat feedback (driven by the host via FPSSession).
    onHitConfirmed(killed) {
        this._hitMarkerLife = killed ? 0.5 : 0.18;
        this._hitWasKill = killed;
    }
    onTookDamage() {
        this._damageFlashLife = 0.35;
    }

    createSounds() {
        const sweep = (name, o) => this.audio.createSweepSound(name, o);
        sweep("shoot", { startFreq: 320, endFreq: 90, type: "square", duration: 0.12, envelope: { attack: 0.001, decay: 0.06, sustain: 0.2, release: 0.05 } });
        sweep("draw", { startFreq: 200, endFreq: 440, type: "triangle", duration: 0.09, envelope: { attack: 0.001, decay: 0.05, sustain: 0.2, release: 0.04 } });
        sweep("holster", { startFreq: 440, endFreq: 160, type: "triangle", duration: 0.09, envelope: { attack: 0.001, decay: 0.05, sustain: 0.2, release: 0.04 } });
        sweep("reload", { startFreq: 150, endFreq: 320, type: "sawtooth", duration: 0.22, envelope: { attack: 0.002, decay: 0.1, sustain: 0.3, release: 0.08 } });
        sweep("empty", { startFreq: 1300, endFreq: 900, type: "square", duration: 0.04, envelope: { attack: 0.001, decay: 0.02, sustain: 0.1, release: 0.02 } });
        sweep("impact", { startFreq: 180, endFreq: 60, type: "square", duration: 0.06, envelope: { attack: 0.001, decay: 0.04, sustain: 0.15, release: 0.03 } });
    }

    addMessage(msg) {
        this._messages.unshift(msg);
        if (this._messages.length > 5) this._messages.pop();
        console.log("[FPS] " + msg);
    }

    // =====================================================================
    // Engine hooks
    // =====================================================================

    action_update(deltaTime) {
        const dt = Math.min(deltaTime || 1 / 60, 0.05);
        this._frameDt = dt; // stashed for the camera, which is now placed in action_draw (needs alpha)

        // A modal owns input. Handle its buttons, but keep MP networking + the camera alive
        // underneath so we stay connected and the world doesn't freeze behind the dialog.
        if (this.modal) {
            this._updateModal(); // may close/replace the modal or change state
            if (this.modal) {
                if (this.gui) this.gui.getNetManager().update();
                if (this.state === "GAME") {
                    this.fpsContext.update(dt); // networked: sample remotes; offline: no-op
                    // Camera is placed in action_draw (interpolated); nothing to do here.
                }
            }
            return; // this frame belongs to the modal; resume normally next frame
        }

        if (this.state === "MENU") {
            if (this.input.isElementJustPressed("spBtn")) this.enterSinglePlayer();
            else if (this.input.isElementJustPressed("mpBtn")) this.enterMultiplayer();
            return;
        }

        if (this.state === "LOBBY") {
            this.gui.getNetManager().update();
            this.gui.action_update(dt);
            return;
        }

        // GAME (sp or mp)
        if (this.gui) this.gui.getNetManager().update();

        const m = this.input.consumeLockedPointerMovement();
        if (m.x !== 0 || m.y !== 0) {
            this.aimYaw += -m.x * this.lookSensitivity;
            this.aimPitch += -m.y * this.lookSensitivity;
            if (this.aimPitch > this.maxPitch) this.aimPitch = this.maxPitch;
            if (this.aimPitch < -this.maxPitch) this.aimPitch = -this.maxPitch;
        }
        // Hand the live aim to the controller (render-only; routes to the viewmodel + camera + body).
        // Replaces the old per-seam weapon.aimProvider wiring — same value, one owner.
        const lp = this.getPlayer();
        if (lp) lp.aim(this.aimYaw, this.aimPitch);

        if (this.input.isKeyJustPressed("Action3")) this.toggleKit(); // E swaps kit (both modes)
        // Scale: shrink Z (−) / grow X (+). Walk moved off X to Left Alt (a RAW key check in
        // buildCommand — see there), which freed X for grow and freed F for pickup below.
        if (this.input.isKeyJustPressed("Action5")) this.adjustScale(-0.25); // Z → shrink
        if (this.input.isKeyJustPressed("Action6")) this.adjustScale(0.25); // X → grow
        // F (pickup) is sampled into the command at the fixed tick (buildCommand), not here, so it's
        // networked + deterministic like fire — not a render-rate one-shot.
        if (this.input.isKeyJustPressed("Hotbar1")) this.weapons.selectWeapon(0); // 1 → gun
        if (this.input.isKeyJustPressed("Hotbar2")) this.weapons.selectWeapon(1); // 2 → rocket launcher
        const rDown = this.input.isRawKeyPressed("KeyR"); // R → reload (raw key; we're out of action slots)
        if (rDown && !this._reloadDown) this.weapons.reload();
        this._reloadDown = rDown;
        if (this.input.isKeyJustPressed("Hotbar0")) this.openQuitModal(); // 0 → quit dialog
        if (this.input.isKeyJustPressed("Action4")) this.fpsCamera.cycleMode(); // Q → cycle camera (FP / over-shoulder / classic)
        if (this.input.isKeyJustPressed("Hotbar8")) this.toggleAutoShadowPanel(); // 8 → auto shadow panel
        if (this.input.isKeyJustPressed("Hotbar7")) this.hideHUD = !this.hideHUD; // 7 → hide all HUD + crosshair
        if (this.input.isKeyJustPressed("Hotbar6")) this.hideViewModel = !this.hideViewModel; // 6 → hide weapon viewmodel
        if (this.input.isKeyJustPressed("Hotbar5")) this.showAABB = !this.showAABB; // 5 → physics AABB wireframes
        // Fire is sampled into the command at the fixed tick (buildCommand), not here.

        if (this.autoShadowPanel) this.autoShadowPanel.update(); // auto-shadow sliders

        this.weapons.update(dt); // recoil decay + age tracers/rockets/explosions
        if (this._hitMarkerLife > 0) this._hitMarkerLife -= dt;
        if (this._damageFlashLife > 0) this._damageFlashLife -= dt;

        this.fpsContext.update(dt); // networked: sample remotes; offline: no-op

        // Camera is placed in action_draw now, so it can ride the fixed→render interpolation
        // factor (alpha) and stay smooth on high-refresh displays between 60Hz physics ticks.
    }

    action_fixed_update(fixedDeltaTime) {
        if (this.state !== "GAME") return;
        this.fpsContext.fixedTick(fixedDeltaTime); // OfflineContext steps spWorld; NetworkedContext drives the session
        // Stash the local eye for the controller's sub-tick render interpolation. Called here — once per
        // REAL fixed tick, after fixedTick resolves prediction + reconciliation — NOT inside the
        // controller's endStep (which also runs during MP resim). Render-only; the sim is untouched.
        const lp = this.getPlayer();
        if (lp) lp.captureRenderState();
    }


    action_draw(alpha) {
        if (this.state === "MENU") {
            this.drawMenu();
            return;
        }
        if (this.state === "LOBBY") {
            if (this.gl) {
                this.gl.clearColor(0.04, 0.04, 0.09, 1);
                this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
            }
            // The lobby GUI draws onto the 2D overlay but doesn't clear it — wipe the menu's
            // leftover pixels each frame or they bleed through behind the lobby.
            this.guiCtx.clearRect(0, 0, this.guiCanvas.width, this.guiCanvas.height);
            if (this.debugCtx) this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
            this.gui.action_draw();
            this.drawModal(); // host-left notice can sit over the lobby
            return;
        }

        // First-person: render the held viewmodel. Third-person: hide it and show our own body
        // (with its weapon posed on it, same model as remotes see) instead.
        // While dead: suppress both so the player doesn't see their own corpse or gun.
        const dead = this.fpsContext.localDead;
        const firstPerson = this.fpsCamera.isFirstPerson;
        // Place the camera here (not in action_update) so it rides the sub-tick interpolation factor
        // (alpha): the controller lerps the eye between the last two physics positions internally — one
        // call, no hand-built proxy — smooth at any refresh rate. It frames along the live aim we set
        // with aim(). The viewmodel update below stays gated on the NETWORK dead flag (localDead), which
        // the controller's own combat (off here) doesn't know.
        this.getPlayer().updateCamera(this.camera, alpha, this._frameDt || 1 / 60);
        if (firstPerson && !dead) this.weapons.updateViewmodel();
        const renderObjects = this.getRenderObjects();
        // Our own body+weapon. Third person: draw it (and it casts, as always). First person: don't
        // draw it (we'd see it from inside our head), but still feed it to the shadow pass as a
        // CAST-ONLY object — so the arms/weapon self-shadow and we drop a real ground shadow, exactly
        // like the third-person body, with no special viewmodel shadow map needed.
        let shadowCasters = null;
        if (!dead) {
            const body = this._updateLocalAvatar(alpha);
            if (body) {
                if (firstPerson) shadowCasters = body;
                else for (const o of body) renderObjects.push(o);
            }
        }
        const tracer = this.weapons.buildTracerObject();
        if (tracer) renderObjects.push(tracer);
        for (const fx of this.weapons.buildEffectObjects()) renderObjects.push(fx);
        for (const plate of this._collectNameplates()) renderObjects.push(plate); // world-space name billboards
        this.renderer3D.render({
            renderableObjects: renderObjects,
            camera: this.camera,
            viewmodelObjects: firstPerson && !dead && !this.hideViewModel ? [this.weapons.viewmodel] : [],
            viewmodelOptions: { near: 0.5, far: 600, fov: this.camera.fov * 0.85 },
            debugLines: this.showAABB ? this._buildAABBLines() : null, // 5 → physics AABB wireframes
            shadowCasters // FP: our body+weapon casts (self-shadow + ground shadow) without being drawn
        });
        this.drawHUD();
        // The auto-shadow debug panel (8) draws on the 2D debug layer. Clear it once per frame so live
        // slider drags don't ghost, then draw it while open.
        if (this.debugCtx && this.autoShadowPanel && this.autoShadowPanel.visible) {
            this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
            this.autoShadowPanel.draw();
        }
        this.drawModal(); // quit confirm sits over the game
    }

    // =====================================================================
    // 2D screens
    // =====================================================================

    drawMenu() {
        if (this.gl) {
            this.gl.clearColor(0.04, 0.04, 0.09, 1);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        }
        const ctx = this.guiCtx;
        ctx.clearRect(0, 0, Game.WIDTH, Game.HEIGHT);
        ctx.fillStyle = "#9fe8ff";
        ctx.font = "bold 44px Orbitron, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("ACTION FPS", Game.WIDTH / 2, 150);

        for (const b of this.menuButtons) {
            const hover = this.input.isElementHovered(b.id);
            ctx.fillStyle = hover ? "#1b6b86" : "#123";
            ctx.strokeStyle = "#9fe8ff";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(b.x, b.y, b.width, b.height, 8);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#eaffff";
            ctx.font = "20px Orbitron, sans-serif";
            ctx.fillText(b.text, b.x + b.width / 2, b.y + b.height / 2);
        }
    }

    // Nameplates as world-space billboards (ActionSprite3D). The sprite pass depth-tests against
    // the world, so names are naturally occluded by walls/geometry — the reason this beats a 2D
    // overlay. One sprite per player, cached; the text texture is rebuilt only when the name
    // changes. Returns the sprites to drop into the render list (MP only; empty otherwise).
    _collectNameplates() {
        const out = [];
        for (const pl of this.fpsContext.nameplates()) {
            const sprite = this._nameplateSpriteFor(pl.id, pl.name);
            sprite.transform.position = new Vector3(pl.x, pl.y, pl.z);
            // Scale the plate to the player's scale (1.0 = the authored size). Keep the texture aspect
            // by scaling width and height by the same factor — no stretch.
            const sc = pl.scale || 1;
            sprite.height = sprite._baseHeight * sc;
            sprite.width = sprite._baseWidth * sc;
            out.push(sprite);
        }
        return out;
    }

    // Get (or build) the cached billboard sprite for a player. The name is rendered to an offscreen
    // canvas at high resolution and handed to ActionSprite3D as a PNG, so the text stays crisp; the
    // world height is fixed (it shrinks with distance like any 3D object).
    _nameplateSpriteFor(id, name) {
        if (!this._nameplateSprites) this._nameplateSprites = new Map();
        const cached = this._nameplateSprites.get(id);
        if (cached && cached.name === name) return cached.sprite;

        const FONT = "bold 72px Orbitron, sans-serif";
        const padX = 28;
        const padY = 16;
        const c = document.createElement("canvas");
        let ctx = c.getContext("2d");
        ctx.font = FONT;
        const tw = Math.ceil(ctx.measureText(name).width);
        c.width = tw + padX * 2;
        c.height = 72 + padY * 2;
        // Resizing the canvas resets the context — re-acquire and re-set the font.
        ctx = c.getContext("2d");
        // The sprite samples the texture vertically flipped (GL v=0 is the bottom, but a canvas
        // uploads with its top row first), so an untransformed texture renders upside-down. Pre-flip
        // the canvas vertically to cancel it. Horizontal is already correct — don't touch it, or the
        // text comes out mirrored.
        ctx.translate(0, c.height);
        ctx.scale(1, -1);
        ctx.font = FONT;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(name, c.width / 2, c.height / 2 + 2);

        const worldH = 3.5; // sprite height in world units (above-head plate)
        const sprite = new ActionSprite3D({
            base64Data: c.toDataURL("image/png").split(",")[1],
            height: worldH,
            width: worldH * (c.width / c.height), // keep texture aspect so text isn't stretched
            billboard: true,
            blendMode: "normal"
        });
        // Stash the scale-1.0 size so _collectNameplates can scale the cached sprite per-frame to the
        // player's scale without rebuilding the texture (it's good at 1.0; just multiply from there).
        sprite._baseHeight = sprite.height;
        sprite._baseWidth = sprite.width;
        this._nameplateSprites.set(id, { sprite, name });
        return sprite;
    }

    drawHUD() {
        const ctx = this.guiCtx;
        const W = Game.WIDTH;
        const H = Game.HEIGHT;
        ctx.clearRect(0, 0, W, H);

        // 7 hides the entire 2D HUD (crosshair, health, readouts, messages) for clean screenshots.
        // We still clear above so the last HUD frame doesn't linger.
        if (this.hideHUD) return;

        // Damage vignette (we took a hit) or solid red while dead.
        const isDead = this.fpsContext.localDead;
        if (isDead) {
            ctx.fillStyle = "rgba(180,10,10,0.55)";
            ctx.fillRect(0, 0, W, H);
        } else if (this._damageFlashLife > 0) {
            ctx.fillStyle = `rgba(200,20,20,${0.45 * (this._damageFlashLife / 0.35)})`;
            ctx.fillRect(0, 0, W, H);
        }

        const cx = W / 2,
            cy = H / 2;
        const gap = 5 + this.weapons.recoil * 8;
        const len = 9;
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - gap - len, cy);
        ctx.lineTo(cx - gap, cy);
        ctx.moveTo(cx + gap, cy);
        ctx.lineTo(cx + gap + len, cy);
        ctx.moveTo(cx, cy - gap - len);
        ctx.lineTo(cx, cy - gap);
        ctx.moveTo(cx, cy + gap);
        ctx.lineTo(cx, cy + gap + len);
        ctx.stroke();

        // Hit marker (we hit someone) — an X over the crosshair, red on a kill.
        if (this._hitMarkerLife > 0) {
            const m = 10;
            ctx.strokeStyle = this._hitWasKill ? "rgba(255,80,80,0.95)" : "rgba(255,255,255,0.95)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx - m, cy - m);
            ctx.lineTo(cx - m / 2, cy - m / 2);
            ctx.moveTo(cx + m, cy - m);
            ctx.lineTo(cx + m / 2, cy - m / 2);
            ctx.moveTo(cx - m, cy + m);
            ctx.lineTo(cx - m / 2, cy + m / 2);
            ctx.moveTo(cx + m, cy + m);
            ctx.lineTo(cx + m / 2, cy + m / 2);
            ctx.stroke();
        }

        // Health readout (both modes — SP health just never drops, for HUD parity).
        const hp = Math.max(0, Math.round(this.fpsContext.localHealth));
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.font = "bold 26px Orbitron, monospace";
        ctx.fillStyle = hp > 30 ? "#9fe8ff" : "#ff6b6b";
        ctx.fillText(hp + " HP", 16, H - 28);
        // Ammo counter (current / mag), next to HP — finite-magazine weapons only.
        const mag = this.weapons.activeMag;
        if (mag != null) {
            const ammo = this.weapons.activeAmmo;
            ctx.fillStyle = ammo > 0 ? "#ffe23d" : "#ff6b6b";
            ctx.fillText(ammo + " / " + mag, 150, H - 28);
        }
        // Death/respawn only happens in MP combat.
        if (this.fpsContext.localDead) {
            ctx.textAlign = "center";
            ctx.fillStyle = "rgba(255,255,255,0.9)";
            ctx.font = "bold 34px Orbitron, sans-serif";
            ctx.fillText("RESPAWNING…", cx, cy - 60);
        }

        ctx.font = "13px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const c = this.getPlayer();
        const speed = Math.hypot(c.body.linearVelocity.x, c.body.linearVelocity.z);
        const role = this.fpsContext.roleLabel();
        const label = role + " (" + this.kit + ")";
        const extra = this.fpsContext.isNetworked ? "  players: " + this.fpsContext.playerCount() : "";
        // Controller readout: pull state straight off the live ActionFPSController3D so this doubles
        // as a window into how the controller is behaving (slide state, the speed thresholds that
        // gate it, slope read, and the decoupled feel/policy knobs).
        const n = c.groundNormal;
        const slopeMag = Math.hypot(n.x, n.z); // sin(slope angle); 0 on flat
        const onSlope = slopeMag >= c.slideSlopeMin;
        const slopeDeg = slopeMag > 1e-3 ? (Math.asin(Math.min(1, slopeMag)) * 180 / Math.PI).toFixed(0) + "°" : "flat";
        const slideKind = c.sliding ? (onSlope ? "slope" : "flat") : "-";
        const fin = (v) => (v === Infinity ? "∞" : v.toFixed(0)); // knobs may be Infinity
        const lines = [
            `${label}${extra}  scale: ${this.playerScale.toFixed(2)}  cam: ${this.fpsCamera.mode} (Q)`,
            `grounded: ${c.grounded ? "yes" : "no"}  crouch: ${c.crouching ? "yes" : "no"}  sliding: ${c.sliding ? "yes" : "no"} (${slideKind})`,
            `h-spd: ${speed.toFixed(1)}  walk: ${c.walkSpeed.toFixed(0)}  run: ${c.moveSpeed.toFixed(0)}  sprint: ${c.sprintSpeed.toFixed(0)}  ${speed > c.moveSpeed + 1e-3 ? ">run" : "<=run"}  vY: ${c.velocityY.toFixed(1)}`,
            `slope: ${slopeDeg}  n.y: ${n.y.toFixed(2)}  (slopeMin ${c.slideSlopeMin.toFixed(2)})`,
            `stopDecel: ${fin(c.groundStopDecel)}  sprintDecay: ${fin(c.sprintDecay)}  reqMoveToSlide: ${c.slideRequiresMoveInput ? "yes" : "no"}`,
            `pos: ${c.body.position.x.toFixed(0)}, ${c.body.position.y.toFixed(0)}, ${c.body.position.z.toFixed(0)}`
        ];
        // MP netcode readout: measured round-trip (P2P ping/pong), the one-way "ping" it implies, and
        // the dynamic runahead it drives (target server-buffer depth, in frames/ticks). Host reads
        // ~0ms / floor frames (its own client reaches its server over a zero-latency loopback).
        if (this.fpsContext.isNetworked) {
            const cl = this.fpsContext.netClient;
            const rtt = Math.round(cl.rttMs || 0);
            lines.push(`net: rtt ${rtt}ms  ping ${Math.round(rtt / 2)}ms  runahead ${cl.targetBuffer}f`);
        }
        // Yellow with a black halo so it stays readable over sky or ground.
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.lineWidth = 3;
        ctx.fillStyle = "#ffe23d";
        lines.forEach((t, i) => {
            ctx.strokeText(t, 12, 12 + i * 16);
            ctx.fillText(t, 12, 12 + i * 16);
        });

        // FPS counter in green, directly under the yellow controller readout. Exponentially smoothed
        // from frame-to-frame wall time so it reads steady instead of jittering every frame.
        const nowMs = performance.now();
        if (this._fpsLastT !== undefined) {
            const dtMs = nowMs - this._fpsLastT;
            if (dtMs > 0) {
                const inst = 1000 / dtMs;
                this._fps = this._fps ? this._fps * 0.9 + inst * 0.1 : inst;
            }
        }
        this._fpsLastT = nowMs;
        const fpsText = `fps: ${(this._fps || 0).toFixed(0)}`;
        const fpsY = 12 + lines.length * 16;
        ctx.fillStyle = "#3cff6a";
        ctx.strokeText(fpsText, 12, fpsY);
        ctx.fillText(fpsText, 12, fpsY);

        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.textAlign = "right";
        ctx.fillText(
            document.pointerLockElement
                ? "Space jump · Shift sprint · X walk · C crouch · Z/F scale · 1/2 weapon · E kit · Q camera · 0 quit · Esc release"
                : "CLICK TO PLAY",
            W - 12,
            H - 22
        );

        if (this._messages.length) {
            ctx.textAlign = "left";
            ctx.textBaseline = "alphabetic";
            ctx.font = "13px monospace";
            ctx.fillStyle = "rgba(255,255,180,0.8)";
            // Both modes now show the HP readout bottom-left, so lift the log above it.
            const logBottom = H - 52;
            this._messages.forEach((msg, i) => ctx.fillText(msg, 12, logBottom - i * 15));
        }
    }
}
