//actionengine/character/actionfpscontroller3D.js
/**
 * ActionFPSController3D - Engine-side, reusable first-person character controller.
 *
 * Built directly on Goblin physics (NOT Goblin.CharacterController). Uses a BOX collider
 * that is angular-locked so it can never tip. Grounding, slopes, walls and resting are
 * handled by the physics solver (gravity + friction) for smooth, stable contact — the
 * controller does NOT hard-teleport the body to the ground every frame (that fights the
 * solver and jitters). It only:
 *   - sets HORIZONTAL velocity from input each step (snappy, no momentum fighting),
 *   - projects that velocity along the ground plane (no sliding on slopes) and off walls
 *     (smooth move-and-slide, so we never ram the solver), and
 *   - applies targeted raycast assists for STEP-UP and STEP-DOWN, which the solver can't
 *     do with a box collider.
 * Vertical motion (gravity, landing) is left to the solver; only jump / jetpack thrust
 * write the vertical velocity directly.
 *
 * DESIGN SEAMS (for future host-authoritative netcode):
 *   The controller never reads input directly. Gameplay samples an input command and
 *   feeds it in, bracketing a single Goblin world step:
 *       const cmd = ActionFPSController3D.sampleCommand(input);
 *       controller.beginStep(cmd, dt);     // pre-physics: velocity + assists
 *       physicsWorld.fixed_update(dt);     // ONE world step (all bodies)
 *       controller.endStep(dt);            // post-physics: grounded + step-down
 *   The command struct is pure data, so a host can run remote players' commands through
 *   the exact same path.
 *
 * EXTENSIBILITY:
 *   Base = standard walking kit. Subclasses override _updateVertical (jump/gravity) and
 *   _getMoveSpeed without touching ground/step/wall logic. See ActionSoldierController3D
 *   and ActionJetpackController3D.
 *
 * Units: ActionEngine's Goblin world is ~10x scaled (gravity -98.1); defaults are in
 * those units (a ~1.8m human ≈ 18 units tall). Use `scale` to resize the whole character.
 */
class ActionFPSController3D {
    /**
     * @param {ActionPhysicsWorld3D} physicsWorld
     * @param {Object} options
     * @param {Vector3} options.position    - Spawn position (body center). Default (0,20,0).
     * @param {number}  options.scale       - Uniform size multiplier for the whole character. Default 1.
     * @param {number}  options.width       - Collider width (x) before scale. Default 6.
     * @param {number}  options.depth       - Collider depth (z) before scale. Default 6.
     * @param {number}  options.height      - Collider height (y) before scale. Default 18.
     * @param {number}  options.mass        - Body mass before scale. Default 10.
     * @param {number}  options.eyeHeight   - Eye offset above body CENTER before scale. Default height*0.42.
     * @param {number}  options.walkSpeed   - Held-walk gait speed before scale (slower than run). Default 38.
     * @param {number}  options.moveSpeed   - RUN speed (the default no-modifier gait) before scale. Default 70.
     * @param {number}  options.sprintSpeed - Sprint move speed before scale. Default 115.
     * @param {number}  options.crouchSpeedMult - Multiplier on the active gait while crouched (unitless). Default 0.5.
     * @param {number}  options.sprintDecay - Rate (units/sec) the sprint boost fades after releasing sprint while still moving. Default 100.
     * @param {number}  options.groundStopDecel- Deceleration (units/sec) when you release all move keys. High = crisp stop, 0 = frictionless drift. Default 100.
     * @param {number}  options.airControl  - 0..1 horizontal steering authority per step while airborne. Default 0.12.
     * @param {number}  options.jumpSpeed   - Jump velocity before scale. Default 46.
     * @param {number}  options.friction    - Body friction. Default 0 (kinematic grounding holds slopes; 0 keeps wall-slides clean).
     * @param {number}  options.stepHeight  - Max step-UP height before scale. Default 5.
     * @param {number}  options.stepDownDist- Max step-DOWN snap before scale. Default 5.
     * @param {number}  options.coyoteTime  - Seconds after leaving a ledge you can still jump. Default 0.1 (0 = off).
     * @param {number}  options.jumpBuffer  - Seconds before landing a jump press is remembered and fires on touchdown. Default 0.12 (0 = off).
     * @param {boolean} options.slideEnabled- Enable crouch-at-speed sliding. Default true (pass false to disable).
     * @param {boolean} options.slideRequiresMoveInput- Require a movement key held to slide (forbids no-key slides). Default false.
     * @param {number}  options.slideMinSpeed- Min along-ground speed (pre-scale) to start a slide. Default 78.
     * @param {number}  options.slideEndSpeed- Flat slide ends (you stop) below this speed (pre-scale). Default 10.
     * @param {number}  options.slideFriction- Speed bled per second on flat ground (pre-scale). Default 60.
     * @param {number}  options.slideBoost  - Launch speed multiplier at slide entry. Default 1.3.
     * @param {number}  options.slideControl- 0..1 carve authority while sliding (speed-preserving). Default 0.14.
     * @param {number}  options.slideSlopeAccel- Gravity-along-slope multiplier while sliding (downhill speeds up). Default 1.5.
     * @param {number}  options.slideSlopeMin - Min slope (sin of angle, 0..1) that SUSTAINS a slide at any speed via gravity. Default 0.2; Infinity disables.
     * @param {number}  options.slideSlopeFriction- Cross-slope bleed per second on a sustaining slope: carves the slide onto the fall line (pre-scale). Default 15.
     * @param {number}  options.slideCoyoteFrames- Frames after dropping below slide speed a crouch press still slides (release-then-crouch). Default 5.
     * @param {boolean} options.pushDynamics - If on, walking into a dynamic body shoves it (it still blocks). Default true (pass false to disable).
     * @param {number}  options.pushForce   - Body-push strength (prop gains pushForce*(1/mass)*dt per step). Default 1200.
     * @param {boolean} options.visible     - Render the collider mesh (false for local FP). Default false.
     * @param {string}  options.color       - Collider color when visible. Default "#cc4444".
     */
    constructor(physicsWorld, options = {}) {
        this.physicsWorld = physicsWorld;
        const o = options;

        // Base (pre-scale) values.
        this._baseWidth = o.width !== undefined ? o.width : 6;
        this._baseDepth = o.depth !== undefined ? o.depth : 6;
        this._baseHeight = o.height !== undefined ? o.height : 18;
        this._baseMass = o.mass !== undefined ? o.mass : 10;
        this._baseEyeHeight = o.eyeHeight !== undefined ? o.eyeHeight : this._baseHeight * 0.42;
        // Three ground gaits (slow→fast): walk (held modifier) < run (default) < sprint. `moveSpeed` is
        // the RUN speed — the no-modifier default; `walkSpeed` is the deliberate slow gait. Crouching
        // multiplies whichever gait is active by crouchSpeedMult, giving crouch-walk / crouch-run /
        // crouch-sprint without extra speed knobs. (Speeds scale with the character in _applyScale; the
        // crouch multiplier is unitless.)
        this._baseWalkSpeed = o.walkSpeed !== undefined ? o.walkSpeed : 38; // held-walk gait (slower than run)
        this._baseMoveSpeed = o.moveSpeed !== undefined ? o.moveSpeed : 70; // RUN — the default no-modifier gait
        this._baseSprintSpeed = o.sprintSpeed !== undefined ? o.sprintSpeed : 115;
        this.crouchSpeedMult = o.crouchSpeedMult !== undefined ? o.crouchSpeedMult : 0.5; // ×gait while crouched
        // Speed (units/sec) at which EXCESS ground speed above the current move target bleeds off —
        // i.e. how fast the sprint boost fades after you release sprint while still moving. Default
        // Infinity = instant (snap to walk speed, old behavior). A finite value lets sprint momentum
        // linger a few frames so you can crouch into a slide. Releasing ALL move keys still dead-stops
        // (idle clamp), and airborne momentum is untouched (the air branch preserves it).
        this._baseSprintDecay = o.sprintDecay !== undefined ? o.sprintDecay : 100;
        // Deceleration (units/sec) applied to horizontal speed when you release ALL move keys
        // (idle, not sliding). The instant-stop <-> drift knob — one rate spans the whole range:
        //   very high (~speed/dt, e.g. several thousand) = stops within a frame (crisp, no drift)
        //   moderate                                     = coasts a few frames -> sprint+jump carries into a slide
        //   0                                            = frictionless drift (no stopping force)
        // Frame-rate independent and clamped (never overshoots past zero). Default 100.
        this._baseGroundStopDecel = o.groundStopDecel !== undefined ? o.groundStopDecel : 100;
        this._baseJumpSpeed = o.jumpSpeed !== undefined ? o.jumpSpeed : 46;
        this._baseStepHeight = o.stepHeight !== undefined ? o.stepHeight : 5;
        this._baseStepDownDist = o.stepDownDist !== undefined ? o.stepDownDist : 5;

        // Body-push. When on, walking into a DYNAMIC body shoves it along our heading (it still
        // blocks us). Defaults ON to match the demo (pass pushDynamics:false to disable). `pushForce`
        // is the shove strength: the per-step velocity the prop can gain is
        // `pushForce * (1/propMass) * dt`, so heavier props resist.
        this._pushDynamics = o.pushDynamics !== false;
        this._pushForce = o.pushForce !== undefined ? o.pushForce : 1200;

        // The REVERSE coupling: a DYNAMIC body moving into us pushes US back (a rocket-flung crate,
        // a rolling barrel). Needed because the character body is excluded from solver contacts (we
        // do collision manually), so nothing else can transfer that momentum. Momentum-correct: a
        // light prop barely nudges us, a heavy/fast one shoves hard; `receiveRestitution` adds bounce
        // and `receiveMaxSpeed` caps how fast a single hit can fling us. Default ON.
        this._receivePush = o.receivePush !== false;
        this._receiveRestitution = o.receiveRestitution !== undefined ? o.receiveRestitution : 0.2;
        this._receiveMaxSpeed = o.receiveMaxSpeed !== undefined ? o.receiveMaxSpeed : 160;

        this.airControl = o.airControl !== undefined ? o.airControl : 0.12;
        // Grounding is kinematic (we clamp the feet to the ground), so the body doesn't
        // need friction to hold on slopes — and friction 0 keeps wall slides clean.
        this.friction = o.friction !== undefined ? o.friction : 0;

        // Jump-feel assists (default to the demo's dialed values; pass 0 for classic instant jump).
        //   coyoteTime: seconds after stepping off a ledge you can STILL jump (forgives a late press).
        //   jumpBuffer: a jump pressed up to this many seconds BEFORE landing fires on touchdown
        //              (forgives an early press). Both are time-based (decremented by dt), so they
        //              don't depend on the fixed-step rate. The kit's _updateVertical reads them.
        this.coyoteTime = o.coyoteTime !== undefined ? o.coyoteTime : 0.1;
        this.jumpBuffer = o.jumpBuffer !== undefined ? o.jumpBuffer : 0.12;
        this._coyoteTimer = 0; // counts down from coyoteTime after leaving the ground
        this._jumpBufferTimer = 0; // counts down from jumpBuffer after an unfulfilled jump press

        // Slide. `slideEnabled` is THE opt-in boundary (default off, so other games are unaffected).
        // Every slide* TUNING value below only takes effect once sliding, so each defaults to the
        // dialed demo values — a game that just sets `slideEnabled: true` inherits a good slide
        // without restating the whole list. Speed-like params scale with the character (_applyScale);
        // boost/control/slopeAccel are unitless. (The FPS demo restates all of these explicitly as
        // living docs; its game.js controllerTuning is the canonical reference and must match here.)
        this.slideEnabled = o.slideEnabled !== false;
        // Slide POLICY (decoupled from stop-feel): when true, a slide also requires a movement key
        // held — so you can't slide with crouch alone (e.g. no sprint→jump→crouch with no W). When
        // false (default) the slide is pure "crouch at speed", independent of movement keys. This is
        // the clean on/off for no-key slides; groundStopDecel stays purely about how stops FEEL and
        // never gates whether a slide happens. Gates both starting and sustaining a slide.
        this.slideRequiresMoveInput = !!o.slideRequiresMoveInput;
        this._baseSlideMinSpeed = o.slideMinSpeed !== undefined ? o.slideMinSpeed : 78; // min speed to START (just above walk 70, below sprint 115)
        this._baseSlideEndSpeed = o.slideEndSpeed !== undefined ? o.slideEndSpeed : 10; // flat slide ends (you stop) below this speed
        this._baseSlideFriction = o.slideFriction !== undefined ? o.slideFriction : 60; // flat-ground speed bled per second
        this.slideBoost = o.slideBoost !== undefined ? o.slideBoost : 1.3; // launch speed multiplier at entry
        this.slideControl = o.slideControl !== undefined ? o.slideControl : 0.14; // 0..1 carve authority while sliding (speed-preserving)
        this.slideSlopeAccel = o.slideSlopeAccel !== undefined ? o.slideSlopeAccel : 1.5; // gravity-along-slope multiplier (1 = real, >1 = juice)
        // Slope-sustained sliding. On ground at/above slideSlopeMin (sin of the slope angle, 0..1)
        // the slide is gravity-governed: it never ends on low speed, and friction bleeds only the
        // CROSS-slope component (slideSlopeFriction) so the slide carves onto the fall line and rides
        // straight down instead of conserving sideways momentum. Defaults on (only active while
        // sliding, which is already gated by slideEnabled). Set slideSlopeMin to Infinity to disable.
        this.slideSlopeMin = o.slideSlopeMin !== undefined ? o.slideSlopeMin : 0.2;
        this._baseSlideSlopeFriction = o.slideSlopeFriction !== undefined ? o.slideSlopeFriction : 15; // cross-slope bleed/sec
        // Slide coyote: physics frames after dropping below slide speed during which a crouch press
        // still launches a slide from the (now-spent) momentum. Lets you release the move key and
        // THEN press crouch and still slide. Frame-based (fixed step).
        this.slideCoyoteFrames = o.slideCoyoteFrames !== undefined ? o.slideCoyoteFrames : 5;
        this._slideCoyoteTimer = 0;
        this._slideCoyoteVX = 0;
        this._slideCoyoteVZ = 0;
        this._sliding = false;
        this._prevCrouch = false; // last tick's crouch, so slide entry is edge-triggered (one slide per press)
        this._groundedPrev = false; // last tick's grounded (for "just landed" -> slide on touchdown)
        this._justLanded = false;

        // World gravity vector (applied to the body only while airborne).
        const g = physicsWorld.world && physicsWorld.world.gravity ? physicsWorld.world.gravity : { y: -98.1 };
        this._gravityVec = new Vector3(0, g.y, 0);
        // Counts down after a jump to stop us instantly re-grounding while leaving the floor.
        this._groundSuppress = 0;

        this._color = o.color || "#cc4444";
        this._visible = o.visible === true;
        this._bodyName = o.bodyName || "fpsControllerBody";

        // Look state (owned by controller; driven by gameplay via look()/setLook()).
        this.yaw = o.yaw !== undefined ? o.yaw : 0;
        this.pitch = o.pitch !== undefined ? o.pitch : 0;
        this.maxPitch = o.maxPitch !== undefined ? o.maxPitch : 1.5;

        // Simulation state.
        this.grounded = false;
        this.groundNormal = new Vector3(0, 1, 0);
        this.velocityY = 0; // mirror of body vertical velocity (for HUD/debug)
        // View-displacement: the vertical EYE jump this controller applied ARTIFICIALLY (the
        // step/landing ground-clamp snap + crouch/scale collider swaps) — i.e. motion NOT produced
        // by velocity integration. A camera consumes this to smooth its own steps/crouches without
        // guessing (scale-correct by construction, and it never includes jumps/falls since those
        // move the body through velocity, not the clamp). Render-only; never networked or in getState.
        this._viewDisplacementY = 0;
        // Set true by the netcode while RESIMULATING un-acked commands during reconciliation (see
        // beginResim/endResim) — rollback-and-resim, NOT a game "replay". Resim re-derives already-
        // predicted state every snapshot, so its step/crouch snaps are NOT new perceived
        // discontinuities — accumulating them would flood the camera smoother (each physical step
        // re-counted every frame until acked). Suppress view-displacement during resim; only live
        // ticks feed the smoother.
        this._resimulating = false;

        // Crouch: an INSTANT collider-height swap (no easing — simplest, and exact across
        // the network). `crouching` + `scale` both ride in the command, so host and clients
        // stay in geometric parity. crouchRatio is the fraction of standing height when crouched.
        this.crouchRatio = o.crouchRatio !== undefined ? o.crouchRatio : 0.55;
        this.crouching = false;

        // Opaque consumer payload (additive/opt-in). The controller treats it as a black box — it
        // never reads inside. Whatever the game puts on `cmd.userData` rides the SAME
        // command→state→snapshot path as crouch/scale, so any game-owned per-player datum (equipped
        // weapon slot, stance, team tint, …) is networked + reconciled for free WITHOUT the engine
        // class learning game concepts. Default null; games that never set it are unaffected.
        this.userData = null;

        // Apply scale -> resolves width/height/.../speeds and builds the body.
        this.scale = 1;
        const spawn = o.position ? o.position.clone() : new Vector3(0, 20, 0);
        this._applyScale(o.scale !== undefined ? o.scale : 1);
        this._buildBody(spawn);
    }

    // Resolve scaled dimensions/speeds from the base values.
    _applyScale(scale) {
        this.scale = scale;
        this.width = this._baseWidth * scale;
        this.depth = this._baseDepth * scale;
        // Standing dimensions, then the active height/eye reflect the crouch state.
        this.standHeight = this._baseHeight * scale;
        this.standEye = this._baseEyeHeight * scale;
        this.height = this.crouching ? this.standHeight * this.crouchRatio : this.standHeight;
        this.eyeHeight = this.crouching ? this.standEye * this.crouchRatio : this.standEye;
        this.mass = this._baseMass * scale * scale * scale; // volume scaling
        this.walkSpeed = this._baseWalkSpeed * scale;
        this.moveSpeed = this._baseMoveSpeed * scale;
        this.sprintSpeed = this._baseSprintSpeed * scale;
        this.sprintDecay = this._baseSprintDecay * scale; // excess-speed bleed rate (Infinity = instant)
        this.groundStopDecel = this._baseGroundStopDecel * scale; // idle ground stop rate (Infinity = instant hard-stop)
        this.slideMinSpeed = this._baseSlideMinSpeed * scale;
        this.slideEndSpeed = this._baseSlideEndSpeed * scale;
        this.slideFriction = this._baseSlideFriction * scale;
        this.slideSlopeFriction = this._baseSlideSlopeFriction * scale;
        this.jumpSpeed = this._baseJumpSpeed * Math.sqrt(scale); // jump height scales ~linearly
        this.stepHeight = this._baseStepHeight * scale;
        this.stepDownDist = this._baseStepDownDist * scale;
        this._skin = 0.5 * scale; // contact tolerance
        this._groundTol = 1.0 * scale; // how close feet must be to count as grounded
        // Terminal fall speed. Also keeps per-step fall distance < ground-probe reach so
        // the raycast ground clamp can't be tunneled through on big drops.
        this._maxFall = 220 * scale;
    }

    // (Re)create the box body at a position, preserving look + velocity where possible.
    _buildBody(position) {
        let carriedVel = null;
        if (this.object) {
            const v = this.body.linearVelocity;
            carriedVel = { x: v.x, y: v.y, z: v.z };
            this.physicsWorld.removeObject(this.object);
        }

        this.object = new ActionPhysicsBox3D(this.width, this.height, this.depth, this.mass, position, this._color, {
            isVisible: this._visible
        });
        this.body = this.object.body; // ActionRigidBody3D

        // Never tip; resting/slopes/walls handled by the solver (gravity + friction).
        this.body.angularFactor = new Vector3(0, 0, 0);
        this.body.friction = this.friction;
        this.body.restitution = 0;
        this.body.linearDamping = 0;
        this.body.angularDamping = 0;

        // Tag our physics body so raycasts can ignore ourselves (identity via the wrapper, never
        // the backend body).
        this.body.name = this._bodyName;
        this._ignoreSelf = { ignoreObjects: [this._bodyName] };
        // Mark this as a kinematic character body so OTHER characters' receive-push pass skips it
        // (player-vs-player is already handled by collide-and-slide treating each other as walls;
        // the body-push coupling is only meant for free dynamic props).
        this.body.goblinBody.isKinematicCharacter = true;

        // KINEMATIC CHARACTER: exclude the player from ALL solver contacts. Goblin's
        // canBodiesCollide treats mask bit 1 as "only collide with bodies sharing a
        // matching group"; world geometry is in the default group 0, so this body
        // collides with nothing in the solver. The body still integrates (so velocity
        // moves it) and is still raycast-queryable. We do 100% of collision ourselves via
        // raycasts (ground clamp + collide-and-slide), so the solver can never fight our
        // control — which was the root cause of the ramp/wall/turn jitter.
        this.body.collisionMask = 1;

        if (carriedVel) this.body.linearVelocity = new Vector3(carriedVel.x, carriedVel.y, carriedVel.z);

        this.physicsWorld.addObject(this.object);
    }

    /** Resize the whole character at runtime (rebuilds the collider, feet planted). */
    setScale(scale) {
        const p = this.body.position;
        const eyeBefore = p.y + this.eyeHeight;
        const feetY = p.y - this.height / 2;
        this._applyScale(scale);
        this._buildBody(new Vector3(p.x, feetY + this.height / 2, p.z));
        if (!this._resimulating) this._viewDisplacementY += this.body.position.y + this.eyeHeight - eyeBefore; // eye jump from the resize
    }

    /** Instantly enter/leave crouch by rebuilding the collider at the new height, feet planted. */
    _setCrouch(want) {
        if (want === this.crouching) return;
        const p = this.body.position;
        const eyeBefore = p.y + this.eyeHeight;
        const feetY = p.y - this.height / 2;
        this.crouching = want;
        this._applyScale(this.scale); // recompute height/eye for the new crouch state
        this._buildBody(new Vector3(p.x, feetY + this.height / 2, p.z));
        if (!this._resimulating) this._viewDisplacementY += this.body.position.y + this.eyeHeight - eyeBefore; // eye jump from the crouch swap
    }

    /**
     * Multi-ray UP probe across the footprint. Returns the LOWEST ceiling (down-facing
     * surface) within `reachAboveFeet` of the feet, or null. Mirror of _probeGround; covers
     * sloped overhead geometry (e.g. a ramp underside) that forward rays can't see.
     */
    _probeCeiling(reachAboveFeet) {
        const p = this.body.position;
        const feetY = p.y - this.height / 2;
        const startY = feetY + this._skin;
        const endY = feetY + reachAboveFeet + this._skin;
        const ix = this.width / 2 - this._skin;
        const iz = this.depth / 2 - this._skin;
        const offsets = [
            [0, 0],
            [ix, 0],
            [-ix, 0],
            [0, iz],
            [0, -iz]
        ];
        let best = null;
        for (let i = 0; i < offsets.length; i++) {
            const ox = offsets[i][0];
            const oz = offsets[i][1];
            const hit = ActionRaycast3D.cast(
                new Vector3(p.x + ox, startY, p.z + oz),
                new Vector3(p.x + ox, endY, p.z + oz),
                this.physicsWorld,
                this._ignoreSelf
            );
            if (!hit || hit.normal.y > -0.4) continue; // not a ceiling (must face downward)
            if (!best || hit.point.y < best.point.y) best = hit;
        }
        return best;
    }

    /**
     * Deflect velocity along an overhead surface we're about to contact, instead of capping the
     * rise to zero (the old "head-bonk", which left us with no velocity to escape and so glued us
     * to ceilings — flat AND sloped). Projects out the into-surface component using the ceiling's
     * own normal: v -= (v·n) n. A flat underside (n straight down) zeroes only the vertical, so
     * horizontal motion survives; a sloped underside redirects the upward motion down-and-along the
     * slope, sliding us out. Tangent velocity has no component along n, so there's no penetration to
     * clamp. Only acts when actually rising toward a ceiling within this tick's reach.
     */
    _ceilingSlide(vx, vy, vz, dt) {
        if (vy <= 0) return { vx, vy, vz }; // not rising -> nothing overhead to resolve
        const reach = this.height + vy * dt + this._skin;
        const ceil = this._probeCeiling(reach);
        if (!ceil) return { vx, vy, vz };
        const gap = ceil.point.y - (this.body.position.y + this.height / 2);
        if (gap > vy * dt + this._skin) return { vx, vy, vz }; // won't reach it this tick
        const n = ceil.normal; // down-facing (n.y < 0)
        const dot = vx * n.x + vy * n.y + vz * n.z;
        if (dot < 0) {
            // Heading into the surface: remove that component, leaving motion tangent to it.
            vx -= dot * n.x;
            vy -= dot * n.y;
            vz -= dot * n.z;
        }
        return { vx, vy, vz };
    }

    /** Is there room to stand up? (No ceiling within standHeight of the feet.) */
    _canStand() {
        const feetY = this.body.position.y - this.height / 2;
        const ceil = this._probeCeiling(this.standHeight);
        return !ceil || ceil.point.y - feetY >= this.standHeight - this._skin;
    }

    // ---- Input command -----------------------------------------------------

    /**
     * Build a movement command from the engine input system. Pure data; serializable.
     * @returns {{forward:number, right:number, jumpPressed:boolean, jumpHeld:boolean, sprint:boolean, walk:boolean, crouch:boolean}}
     */
    static sampleCommand(input) {
        let forward = 0;
        let right = 0;
        if (input.isKeyPressed("DirUp")) forward += 1;
        if (input.isKeyPressed("DirDown")) forward -= 1;
        if (input.isKeyPressed("DirRight")) right += 1;
        if (input.isKeyPressed("DirLeft")) right -= 1;
        return {
            forward,
            right,
            jumpPressed: input.isKeyJustPressed("Action1"),
            jumpHeld: input.isKeyPressed("Action1"),
            sprint: input.isKeyPressed("Action2"), // Shift
            walk: input.isKeyPressed("Action6"), // X — held slow-walk gait (overrides run; sprint still wins)
            crouch: input.isKeyPressed("Action7") // C maps to Action7 in the default keybinds
        };
    }

    // ---- Look --------------------------------------------------------------

    look(deltaYaw, deltaPitch) {
        this.yaw += deltaYaw;
        this.pitch += deltaPitch;
        if (this.pitch > this.maxPitch) this.pitch = this.maxPitch;
        if (this.pitch < -this.maxPitch) this.pitch = -this.maxPitch;
    }

    setLook(yaw, pitch) {
        this.yaw = yaw;
        this.pitch = pitch;
    }

    /** Full 3D look direction (includes pitch). */
    getLookDirection() {
        const cp = Math.cos(this.pitch);
        return new Vector3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    }

    /** Horizontal forward for a given yaw (defaults to current facing). */
    getForwardHorizontal(yaw = this.yaw) {
        return new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    }

    /** Horizontal right for a given yaw (defaults to current facing). Negated to match
     *  this engine's left-handed view so DirRight strafes to the player's visual right. */
    getRightHorizontal(yaw = this.yaw) {
        return new Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    }

    /** World-space eye position (camera goes here). */
    getEyePosition() {
        const p = this.body.position;
        return new Vector3(p.x, p.y + this.eyeHeight, p.z);
    }

    /**
     * Return the artificial vertical eye displacement accumulated since the last call (step/landing
     * snaps + crouch/scale swaps) and reset it. A camera folds this into a decaying offset so it
     * eases over those discontinuities. Call once per render frame. Render-only — does not affect sim.
     */
    consumeViewDisplacementY() {
        const d = this._viewDisplacementY;
        this._viewDisplacementY = 0;
        return d;
    }

    /**
     * Peek at the pending vertical eye displacement WITHOUT consuming it. A render-side smoother
     * consumes (consumeViewDisplacementY); a caller that only wants to DETECT a discontinuity this
     * frame (e.g. to snap interpolation instead of sliding the eye) reads this and leaves the value
     * for the smoother. Read-only — never mutates sim or render state.
     */
    peekViewDisplacementY() {
        return this._viewDisplacementY;
    }

    /** True while a slide is active this tick (stateless predicate; see _updateSlide). Read-only. */
    get sliding() {
        return this._sliding;
    }

    /** This controller's physics-body id (the name raycasts exclude to avoid self-hits). */
    get bodyId() {
        return this._bodyName;
    }

    /**
     * Raycast options that exclude THIS controller's own body — pass straight to ActionRaycast3D
     * so a game's own casts (weapons, line-of-sight) don't hit the shooter. The controller already
     * uses this internally for its ground/wall probes; exposing it keeps games off the backend body.
     */
    get raycastIgnore() {
        return this._ignoreSelf;
    }

    /**
     * Netcode reconciliation hooks (opt-in, called by ActionSimClient around the un-acked-command
     * RESIMULATION — rollback-and-resim, distinct from a game "replay"). During resim the controller
     * re-derives already-perceived state, so its step/crouch snaps must NOT feed the camera smoother
     * (that double-counts every step until the command acks — the cause of jittery third/first-person
     * step smoothing in MP). Live ticks are unaffected.
     */
    beginResim() {
        this._resimulating = true;
    }
    endResim() {
        this._resimulating = false;
    }

    applyToCamera(camera) {
        const eye = this.getEyePosition();
        camera.position = eye;
        camera.target = eye.add(this.getLookDirection());
        camera.isDetached = false;
    }

    // ---- Simulation (bracketed around one physics world step) --------------

    /**
     * PRE-physics: set this tick's horizontal velocity (slope/wall projected) + assists.
     *
     * Aim/sim separation (netcode cornerstone): the movement basis comes from the
     * COMMAND's yaw (`cmd.yaw`) — a per-tick input — not from any persistent "live aim".
     * The live aim is owned by the client (camera reads it, never the sim), so replaying
     * commands during reconciliation can't drag the view backward. We record the commanded
     * yaw/pitch as this entity's facing (for getState/avatars) only when the command
     * carries them; single-player passes no yaw and keeps driving facing via look().
     */
    beginStep(command, dt) {
        // The command is opaque game data; any field may be absent (the sim sends {} before a
        // player's first packet). Read movement axes defensively so a missing field is treated
        // as zero rather than producing NaN velocity. Booleans/optionals are guarded at use.
        const cmd = command || {};

        // "Just landed" edge (grounded now, airborne last tick) — captured before the vertical
        // hook can clear grounded. Lets a slide START on touchdown when crouch is held through a
        // jump (jump-into-slide), not just on a fresh crouch press.
        this._justLanded = this.grounded && !this._groundedPrev;
        this._groundedPrev = this.grounded;

        // Age the jump buffer (set when a jump was pressed mid-air). Decrement before the vertical
        // hook so a press recorded THIS tick still survives to the next. No-op when jumpBuffer=0.
        if (this._jumpBufferTimer > 0) this._jumpBufferTimer = Math.max(0, this._jumpBufferTimer - dt);

        // Apply networked collider changes (scale + crouch) FIRST — they rebuild the body,
        // so they must run before we cache the goblin body reference. Both ride in the
        // command, so the host and every client stay in geometric parity. Crouch is MANUAL
        // (the command's crouch flag); overhangs are handled by the headroom gate, not by
        // auto-ducking. We only refuse to UN-crouch when there's no room to stand, so
        // releasing crouch under a low ceiling won't pop the head through it.
        if (cmd.scale !== undefined && Math.abs(cmd.scale - this.scale) > 1e-4) this.setScale(cmd.scale);
        const wantCrouch = !!cmd.crouch || (this.crouching && !this._canStand());
        if (wantCrouch !== this.crouching) this._setCrouch(wantCrouch);

        // Opaque consumer payload — networked + reconciled, never inspected. Pure bookkeeping.
        if (cmd.userData !== undefined) this.userData = cmd.userData;

        const gb = this.body.linearVelocity; // live backend vector (mutating .x/.y/.z writes through)

        // Remember where we are before the world integrates this tick — the ground probe
        // starts its rays from here so a fast descent can't tunnel past the floor.
        this._prevY = this.body.position.y;

        // Facing used for this tick's movement comes from the command when present.
        const moveYaw = cmd.yaw !== undefined ? cmd.yaw : this.yaw;
        if (cmd.yaw !== undefined) this.yaw = cmd.yaw; // record commanded facing (for getState/avatar)
        if (cmd.pitch !== undefined) this.pitch = cmd.pitch;

        // Desired horizontal velocity in world space (yaw-relative).
        const fwd = this.getForwardHorizontal(moveYaw);
        const rgt = this.getRightHorizontal(moveYaw);
        const cmdF = cmd.forward || 0;
        const cmdR = cmd.right || 0;
        let dirX = fwd.x * cmdF + rgt.x * cmdR;
        let dirZ = fwd.z * cmdF + rgt.z * cmdR;
        const dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ);
        const hasInput = dirLen > 1e-5;
        this._cmdIdle = !hasInput;
        const speed = this._getMoveSpeed(cmd);
        let wishX = 0;
        let wishZ = 0;
        if (hasInput) {
            wishX = (dirX / dirLen) * speed;
            wishZ = (dirZ / dirLen) * speed;
        }

        // Vertical hook (jump / jetpack). May clear `grounded`.
        this._updateVertical(cmd, dt);

        // Compute this step's velocity.
        let vx;
        let vz;
        if (this.grounded) {
            // KINEMATIC GROUND: gravity off; we drive velocity ALONG the ground plane and
            // clamp the feet to the surface in endStep. This is fully deterministic and
            // doesn't rely on the solver to hold us on a slope (which is what jittered).
            //   projected = wish - (wish . n) n   -> motion tangent to the surface.
            this.body.setGravity(new Vector3(0, 0, 0));
            const n = this.groundNormal;
            // SLIDE (opt-in): crouch at speed. Returns null when not sliding; a flat slide returns
            // {mx,mz} (horizontal momentum, projected onto the plane like a walk); a SLOPE slide
            // returns {full:true, vx,vy,vz} — the full 3D surface velocity it owns directly. The
            // slope case must NOT be re-projected to horizontal: that projection multiplies the
            // surviving horizontal speed by n.y² every tick (the velocity leak that made slope
            // slides crawl), so gravity could never build speed. Full 3D bypasses it.
            const slide = this._updateSlide(cmd, wishX, wishZ, dt);
            if (slide && slide.full) {
                vx = slide.vx;
                vz = slide.vz;
                gb.y = slide.vy; // descent kept smooth; horizontal carries (accumulates)
            } else {
                let mx;
                let mz;
                if (slide) {
                    mx = slide.mx; // move.y is 0
                    mz = slide.mz;
                } else if (hasInput) {
                    // Snappy when speeding up or turning. But when SLOWING while still moving (you
                    // released sprint), don't snap to the lower speed — bleed the EXCESS at sprintDecay
                    // so the sprint boost lingers ~a few frames, long enough to crouch into a slide.
                    // Releasing ALL move keys is the !hasInput branch → dead stop via the idle clamp.
                    const cvx = gb.x;
                    const cvz = gb.z;
                    const curSp = Math.sqrt(cvx * cvx + cvz * cvz);
                    const wishSp = Math.sqrt(wishX * wishX + wishZ * wishZ);
                    if (curSp > wishSp + 1e-4) {
                        const target = Math.max(wishSp, curSp - this.sprintDecay * dt);
                        const k = curSp > 1e-5 ? target / curSp : 0;
                        mx = cvx * k; // keep current heading, just shed the excess speed
                        mz = cvz * k;
                    } else {
                        mx = wishX;
                        mz = wishZ;
                    }
                } else {
                    // No input: CARRY the current ground velocity (don't zero it here). endStep's
                    // groundStopDecel is the SOLE ground-stop authority, so the stop rate is one
                    // consistent knob whether you're landing or already standing — and the velocity
                    // the slide predicate reads next tick is exactly the landing momentum minus a
                    // well-defined number of decel frames (not hard-zeroed behind its back).
                    mx = gb.x;
                    mz = gb.z;
                }
                const dot = mx * n.x + mz * n.z;
                vx = mx - dot * n.x;
                vz = mz - dot * n.z;
                gb.y = -dot * n.y; // follow the slope vertically while moving
            }
        } else {
            // AIRBORNE: real gravity; steer toward wish but keep momentum with no input.
            this._sliding = false; // a slide can't continue off the ground (momentum is retained below)
            this.body.setGravity(this._gravityVec);
            const cur = gb;
            if (cur.y < -this._maxFall) gb.y = -this._maxFall; // terminal velocity
            if (hasInput) {
                const curSp = Math.sqrt(cur.x * cur.x + cur.z * cur.z);
                const wishSp = Math.sqrt(wishX * wishX + wishZ * wishZ);
                if (wishSp >= curSp) {
                    // Building speed or steering up to wish: accelerate toward it (normal air control).
                    vx = cur.x + (wishX - cur.x) * this.airControl;
                    vz = cur.z + (wishZ - cur.z) * this.airControl;
                } else {
                    // Slowing the input (e.g. releasing sprint mid-air to reach for crouch): DON'T bleed
                    // the speed — only steer the heading toward wish at the same magnitude. This carries
                    // sprint momentum through the jump so you land fast enough to slide.
                    const wl = wishSp || 1;
                    const tx = (wishX / wl) * curSp;
                    const tz = (wishZ / wl) * curSp;
                    vx = cur.x + (tx - cur.x) * this.airControl;
                    vz = cur.z + (tz - cur.z) * this.airControl;
                }
            } else {
                vx = cur.x;
                vz = cur.z;
            }
        }

        // Ceiling slide: if this tick's motion would carry our head into overhead geometry, deflect
        // the velocity ALONG that surface (remove the component heading INTO it) instead of merely
        // capping the rise. Flat ceiling -> vertical zeroed, horizontal preserved (glide along, fall
        // when thrust stops). Sloped underside -> upward motion is redirected down-and-along the
        // slope (slide off). This is the same projection walls/ground use, so a ceiling stops us
        // without sticking — no pin, no hang on flat or sloped undersides.
        {
            const cs = this._ceilingSlide(vx, gb.y, vz, dt);
            vx = cs.vx;
            vz = cs.vz;
            gb.y = cs.vy;
        }

        // Headroom gate: stop us advancing into an overhang too low to fit under (a ramp
        // underside closing onto the floor). A near-horizontal overhang has almost no
        // horizontal surface normal, so collide-and-slide can't see it — we gate on
        // ceiling CLEARANCE instead. Runs before collide-and-slide so walls act on the
        // already-gated velocity.
        const gated = this._headroomGate(vx, vz, dt);

        // Kinematic collide-and-slide against walls (the solver no longer does this for us).
        // Step-up/step-down are emergent: collide-and-slide ignores anything shorter than
        // stepHeight, and the ground clamp in endStep raises/lowers us onto it.
        const slid = this._collideAndSlide(gated.x, gated.z, dt);
        gb.x = slid.x;
        gb.z = slid.z;

        // Two-way coupling: let dynamic bodies moving INTO us push us back (reverse of the shove
        // above). Runs after our own movement is resolved so it adds to this tick's velocity.
        this._receiveBodyPushes(dt);

        // Track crouch for next tick's edge-triggered slide entry.
        this._prevCrouch = !!cmd.crouch;
    }

    /**
     * POST-physics: decide grounded and CLAMP the feet to the ground surface.
     *
     * Grounding is kinematic: if floor-like ground is found within reach, we set the
     * body so its feet rest exactly on the closest contact point and zero vertical
     * velocity. While already grounded we reach a full step-down (stick to stairs/slopes
     * descending); while airborne we only ground once the feet actually touch (so we
     * don't get yanked down while falling from a height). A short post-jump timer
     * (`_groundSuppress`) prevents instantly re-grounding the moment we jump — this
     * replaces a velocity threshold, which slope contact noise would falsely trip.
     */
    endStep(dt) {
        const gb = this.body.linearVelocity; // live backend vector (mutating .x/.y/.z writes through)
        if (this._groundSuppress > 0) this._groundSuppress--;
        // Only suppress grounding while we're actually RISING (just jumped/thrust). While
        // falling, the ground catch MUST stay live or we tunnel through the floor — this is
        // the main jetpack fall-through (it re-armed the timer every thrust tick).
        const suppressed = this._groundSuppress > 0 && gb.y > 1;

        const half = this.height / 2;
        const probe = this._probeGround(this.stepDownDist);
        const maxStick = this.grounded ? this.stepDownDist + this._skin : this._groundTol;

        // feetGap > 0 = feet above the ground; < 0 = penetrating (always clamp back out).
        const feetGap = probe ? this.body.position.y - half - probe.point.y : Infinity;

        if (!suppressed && probe && feetGap <= maxStick) {
            const p = this.body.position;
            const clampedY = probe.point.y + half;
            if (!this._resimulating) this._viewDisplacementY += clampedY - p.y; // the step/landing snap (eye rides the body 1:1)
            this.body.position = new Vector3(p.x, clampedY, p.z);
            gb.y = 0;
            if (this._cmdIdle && !this._sliding) {
                // No move key (and NOT sliding): bleed horizontal speed toward zero at
                // groundStopDecel (units/sec). This is the SOLE ground-stop authority — beginStep
                // carries idle velocity instead of zeroing it, so this rate governs every grounded
                // idle frame identically, landing or standing. A high rate stops within a frame
                // (crisp); a low rate coasts (drift). The slide gate falls straight out of it: the
                // momentum surviving each frame is exactly sp - groundStopDecel*dt, so a sprint+jump
                // slides iff that still exceeds moveSpeed the tick the predicate reads it.
                const cvx = gb.x;
                const cvz = gb.z;
                const sp = Math.sqrt(cvx * cvx + cvz * cvz);
                // Don't bleed momentum a slide is about to claim. If crouch is held, sliding is on and
                // doesn't require a move key, and we're above walk speed, this is the landing frame of
                // a slide — leave velocity untouched so next tick's predicate reads the TRUE landing
                // momentum. This is what fully decouples the slide gate from groundStopDecel: without
                // it, this one frame nibbles sp before the predicate sees it (the 2700-ish artifact).
                const slideImminent =
                    this.slideEnabled &&
                    !this.slideRequiresMoveInput &&
                    this._prevCrouch &&
                    sp > this.moveSpeed + 1e-3;
                if (!slideImminent) {
                    const target = Math.max(0, sp - this.groundStopDecel * dt);
                    const k = sp > 1e-6 ? target / sp : 0;
                    gb.x = cvx * k;
                    gb.z = cvz * k;
                }
            }
            this.grounded = true;
            this.groundNormal.set(probe.normal.x, probe.normal.y, probe.normal.z);
        } else {
            this.grounded = false;
        }

        // Coyote window: refill while grounded, bleed down once airborne. No-op when coyoteTime=0.
        if (this.grounded) this._coyoteTimer = this.coyoteTime;
        else if (this._coyoteTimer > 0) this._coyoteTimer = Math.max(0, this._coyoteTimer - dt);

        this.velocityY = gb.y;
    }

    // ---- Overridable kit hooks --------------------------------------------

    _getMoveSpeed(cmd) {
        // Gait priority: sprint > walk > run (sprint wins if both modifiers are held). Crouch scales the
        // chosen gait, so crouch-sprint (e.g. 0.5×115=57.5) stays below run (70) — it's a movement gait,
        // NOT a slide (slides trigger only ABOVE run speed; see _slideVelocity), so the two never fight.
        const gait = cmd.sprint ? this.sprintSpeed : cmd.walk ? this.walkSpeed : this.moveSpeed;
        return cmd.crouch ? gait * this.crouchSpeedMult : gait;
    }

    /**
     * Slide model (opt-in via slideEnabled). STATELESS: you are sliding iff crouching + grounded +
     * moving at slide speed — recomputed every tick from inputs and the body's own velocity, with no
     * stored slide flag, entry edge, or coyote buffer. This is deliberate: a slide's only "memory"
     * was exactly what client reconciliation kept desyncing (the slide flickered and froze in MP).
     * With nothing to restore, SP and MP behave identically. While sliding, momentum is preserved
     * (low effective friction on flat, gravity accel on slopes) and steered weakly (slideControl).
     * Trigger: moving faster than normal move speed (i.e. sprinting). slideEndSpeed is the slow-tail
     * hysteresis floor a slide rides down to before it stops.
     * @returns {{mx:number, mz:number}|null} slide velocity this tick, or null when not sliding.
     */
    _updateSlide(cmd, wishX, wishZ, dt) {
        if (!this.slideEnabled) {
            this._sliding = false;
            return null;
        }
        const gb = this.body.linearVelocity; // live backend vector (mutating .x/.y/.z writes through)
        let vx = gb.x;
        let vz = gb.z;
        const vyActual = gb.y;
        const horizSp = Math.sqrt(vx * vx + vz * vz);
        let sp = horizSp;

        // Ground orientation, computed UP FRONT so the entry speed test can measure true along-the-
        // ground speed. While grounded the kinematic clamp has zeroed the real vertical velocity, so
        // a slope deflates the horizontal reading below the truth: sprinting straight DOWN the 29°
        // hill reads ~88 horizontally though you're actually moving ~101 along the surface — below
        // slideMinSpeed, so the slide was refused. Reconstruct the surface speed (undo the slope's
        // cos(θ) on the fall-line component). On flat/airborne we just fold in the real vertical.
        const n = this.groundNormal;
        const slopeMag = Math.sqrt(n.x * n.x + n.z * n.z); // sin(slope angle); 0 on flat
        const ny = Math.max(n.y, 0.1);
        const gy = this._gravityVec.y; // negative (downward)
        const onSlope = slopeMag >= this.slideSlopeMin;
        let groundSp;
        if (slopeMag > 1e-4) {
            const alongH = (vx * n.x + vz * n.z) / slopeMag; // horizontal fall-line speed (signed)
            const crossSq = Math.max(0, horizSp * horizSp - alongH * alongH);
            const surfFall = alongH / ny; // true fall-line speed along the incline
            groundSp = Math.sqrt(surfFall * surfFall + crossSq);
        } else {
            groundSp = Math.sqrt(horizSp * horizSp + vyActual * vyActual);
        }

        // STATELESS slide: recomputed every tick straight from inputs + velocity, so there is NO
        // hidden state for reconciliation to desync — SP and MP are identical by construction.
        // You slide iff crouching, grounded, and moving fast. The fast regime (>= slideMinSpeed) is
        // fully memoryless and bulletproof: even if a reconcile snaps the flag, the recompute below
        // restores it before anything reads it — so the live prediction never falls out and freezes.
        // The previous value is reused ONLY as hysteresis for the slow tail (slideEndSpeed) so a
        // slide rides down to a near-stop instead of cutting off at the entry threshold; a desync in
        // that low-speed band is imperceptible. No edge, no coyote, no entry boost — all gone.
        // Sustain clause differs by ground: on a SLOPE the slide is gravity-fed and must never end
        // on low speed (it re-accelerates downhill), so being on the slope sustains it at any speed;
        // on FLAT the slide is spent momentum and rides the slow-tail floor (slideEndSpeed) to a stop.
        // slideEndSpeed is therefore a flat-ground concept only — it must not leak onto slopes.
        const sustained = this._sliding && (onSlope || groundSp >= this.slideEndSpeed);
        // POLICY gate (slideRequiresMoveInput): off by default, so the slide is pure crouch-at-speed
        // and a no-key sprint→jump→crouch slides. Set true to demand a movement key — the clean way
        // to forbid no-key slides, independent of groundStopDecel (which only governs stop FEEL).
        const inputOk = !this.slideRequiresMoveInput || (wishX * wishX + wishZ * wishZ) > 1e-10;
        this._sliding =
            !!cmd.crouch &&
            this.grounded &&
            inputOk &&
            (groundSp > this.moveSpeed + 1e-3 || sustained);
        if (!this._sliding) return null;

        // Slope vs flat (n / slopeMag / gy / onSlope computed up front). At/above slideSlopeMin the
        // ground "sustains" the slide — gravity governs it and it never ends on low speed; below it
        // the slide is spent momentum that bleeds to a stop.
        if (onSlope) {
            // --- SLOPE SLIDE: a body free to slide on an inclined plane. Gravity accelerates the
            // fall-line (downhill) component every tick and it ACCUMULATES — that's the speed rush.
            // We bleed only the cross-slope (sideways) part lightly so a stray entry eases toward
            // the fall line without feeling on-rails. Returned as full 3D so the grounded branch
            // doesn't re-project it (the projection is the velocity leak that made slopes crawl).
            const inv = 1 / slopeMag;
            const dx = n.x * inv; // fall-line unit (horizontal), points downhill
            const dz = n.z * inv;
            let along = vx * dx + vz * dz; // downhill speed (signed; <0 = heading uphill)
            let crossX = vx - along * dx;
            let crossZ = vz - along * dz;
            along += -gy * n.y * slopeMag * this.slideSlopeAccel * dt; // horizontal accel of g·sin(θ) down the incline
            const cs = Math.sqrt(crossX * crossX + crossZ * crossZ);
            const cn = Math.max(0, cs - this.slideSlopeFriction * dt);
            const cf = cs > 1e-5 ? cn / cs : 0;
            crossX *= cf;
            crossZ *= cf;
            vx = along * dx + crossX;
            vz = along * dz + crossZ;
            sp = Math.sqrt(vx * vx + vz * vz);
        } else {
            // --- FLAT SLIDE: spent momentum, bled off (the predicate above ends it when slow). ---
            const next = Math.max(0, sp - this.slideFriction * dt);
            const f = sp > 1e-5 ? next / sp : 0;
            vx *= f;
            vz *= f;
            sp = next;
        }

        // Carve: rotate the slide heading toward input WITHOUT adding speed (renormalize to sp), so
        // steering redirects momentum (and on a slope, redirects where gravity then feeds you). This
        // is the "fun" lever — slideControl is how hard you can carve. Speed is preserved either way.
        const wl = Math.sqrt(wishX * wishX + wishZ * wishZ);
        if (this.slideControl > 0 && wl > 1e-5 && sp > 1e-5) {
            const tx = vx + ((wishX / wl) * sp - vx) * this.slideControl;
            const tz = vz + ((wishZ / wl) * sp - vz) * this.slideControl;
            const tl = Math.sqrt(tx * tx + tz * tz) || 1;
            vx = (tx / tl) * sp;
            vz = (tz / tl) * sp;
        }

        if (onSlope) {
            // Set the descent so the fall-line part of our (carved) horizontal velocity rides the
            // surface smoothly: vy = -horizontalFallLineSpeed * tan(θ). Cross-slope motion is along
            // the contour (no descent). Full 3D so the grounded branch writes it straight through;
            // endStep then re-zeros vy and clamps the feet, but the HORIZONTAL speed carries over —
            // which is exactly what lets gravity build it up tick after tick.
            const inv = 1 / slopeMag;
            const alongOut = vx * (n.x * inv) + vz * (n.z * inv);
            const vy = -alongOut * slopeMag / Math.max(n.y, 0.1);
            return { full: true, vx, vy, vz };
        }
        return { mx: vx, mz: vz };
    }

    /**
     * Vertical hook. Base = grounded jump only (gravity/landing handled by the solver).
     * Subclasses override for alternate kits.
     */
    _updateVertical(cmd, dt) {
        // Coyote time widens "grounded" briefly after a ledge; jump buffer lets an early press
        // wait for touchdown. With both assists at 0 this reduces exactly to "grounded && pressed".
        const canJump = this.grounded || this._coyoteTimer > 0;
        const wantJump = cmd.jumpPressed || this._jumpBufferTimer > 0;
        if (canJump && wantJump) {
            this.body.linearVelocity.y = this.jumpSpeed;
            this.grounded = false;
            this._groundSuppress = 8; // ~0.13s: leave the floor before we can re-ground
            this._coyoteTimer = 0;
            this._jumpBufferTimer = 0;
        } else if (cmd.jumpPressed) {
            // Pressed but couldn't jump (airborne, past coyote): remember it for jumpBuffer seconds.
            this._jumpBufferTimer = this.jumpBuffer;
        }
    }

    // ---- Internal helpers --------------------------------------------------

    /**
     * Multi-point ground probe. Casts several down-rays across the box footprint (center
     * + the four edge midpoints) and returns the CLOSEST floor-like hit.
     *
     * Why multiple rays: an axis-aligned box resting on a slope touches the surface at its
     * downhill edge, not under its center. A single center ray reads the feet as floating
     * above the ground on any incline and wrongly reports "airborne". The downhill edge ray
     * reports true contact, so we stay grounded on slopes.
     */
    _probeGround(maxSnap) {
        const half = this.height / 2;
        const p = this.body.position;
        // ANTI-TUNNEL: start the rays from the HIGHER of this tick's start position and the
        // current position. A fast descent can push the center below the floor's top surface
        // in one tick; a ray starting at the (now-penetrated) center would miss the floor and
        // we'd fall through. Starting from where we were keeps the ray above the floor.
        const topY = Math.max(this._prevY !== undefined ? this._prevY : p.y, p.y) + this._skin;
        const bottomY = p.y - (half + maxSnap + this._skin);
        const ix = this.width / 2 - this._skin;
        const iz = this.depth / 2 - this._skin;
        const offsets = [
            [0, 0],
            [ix, 0],
            [-ix, 0],
            [0, iz],
            [0, -iz]
        ];

        let best = null;
        for (let i = 0; i < offsets.length; i++) {
            const ox = offsets[i][0];
            const oz = offsets[i][1];
            const start = new Vector3(p.x + ox, topY, p.z + oz);
            const end = new Vector3(p.x + ox, bottomY, p.z + oz);
            const hit = ActionRaycast3D.cast(start, end, this.physicsWorld, this._ignoreSelf);
            if (!hit || hit.normal.y < 0.5) continue; // miss or too steep to be ground
            // Pick the HIGHEST ground point under the footprint (where the feet rest; on a
            // slope that's the uphill edge).
            if (!best || hit.point.y > best.point.y) best = hit;
        }
        return best;
    }

    /**
     * Kinematic collide-and-slide. The player is excluded from the solver, so we stop
     * ourselves at walls and slide along them here. For the current horizontal velocity
     * we cast a fan of rays (across the footprint width, at a few heights) in the move
     * direction; if a vertical wall is within the box's reach this step we remove the
     * into-wall velocity component and re-test, so corners stop on both walls. Floors and
     * ramps (normal.y >= 0.5) are ignored — those are handled by the ground clamp.
     */
    _collideAndSlide(vx, vz, dt) {
        const p = this.body.position;
        const halfDiag = Math.sqrt((this.width / 2) * (this.width / 2) + (this.depth / 2) * (this.depth / 2));
        const half = this.height / 2;
        // Sample heights. The LOWEST ray sits at stepHeight above the feet (not at the
        // feet) so anything shorter than a step is NOT treated as a wall — we walk into it
        // and the ground clamp lifts us onto it (that's how step-UP happens). Obstacles
        // taller than stepHeight are hit by these rays and block as real walls.
        const heights = [p.y - half + this.stepHeight + this._skin, p.y, p.y + half - this._skin];

        // Dynamic bodies we've already shoved this call (one impulse per body per step,
        // regardless of how many rays in the fan hit it). Null unless body-push is enabled.
        const shoved = this._pushDynamics ? new Set() : null;

        for (let iter = 0; iter < 3; iter++) {
            const speed = Math.sqrt(vx * vx + vz * vz);
            if (speed < 1e-5) break;
            const dx = vx / speed;
            const dz = vz / speed;
            const perpX = -dz;
            const perpZ = dx;
            const reach = halfDiag + this._skin + speed * dt;
            // For pushing, cast FARTHER than we block. Pushing perpendicular we stop dead right
            // at the block boundary, so the box only grazes the ray intermittently and the shove
            // can't out-pace floor friction (the "dead zone"). Detecting the box a bit past the
            // block range keeps it in range every tick (continuous shove) without changing where
            // we actually stop. Only hits within `reach` block; dynamic hits out to `castLen` shove.
            const castLen = this._pushDynamics ? reach + halfDiag : reach;

            // Find the nearest blocking wall across the ray fan.
            let nearest = null;
            const lateral = [-(this.width / 2 - this._skin), 0, this.width / 2 - this._skin];
            for (let li = 0; li < lateral.length; li++) {
                const lx = perpX * lateral[li];
                const lz = perpZ * lateral[li];
                for (let hi = 0; hi < heights.length; hi++) {
                    const sx = p.x + lx;
                    const sy = heights[hi];
                    const sz = p.z + lz;
                    const hit = ActionRaycast3D.cast(
                        new Vector3(sx, sy, sz),
                        new Vector3(sx + dx * castLen, sy, sz + dz * castLen),
                        this.physicsWorld,
                        this._ignoreSelf
                    );
                    if (!hit || hit.normal.y >= 0.5) continue; // miss, or it's a floor/ramp
                    // Body-push (opt-in): a DYNAMIC body gets shoved along our heading. Static
                    // geometry and client ghosts have infinite mass, so we skip them. Use the hit's
                    // engine wrapper (hit.body) — never the raw backend body.
                    if (shoved && hit.body && !hit.body.isStatic) {
                        this._shoveBody(hit.body, dx, dz, speed, dt, shoved);
                    }
                    // ...but it only BLOCKS us (counts as a wall) within the real block reach.
                    if (hit.distance <= reach && (!nearest || hit.distance < nearest.distance)) {
                        nearest = hit;
                    }
                }
            }

            if (!nearest) break; // nothing blocking
            const n = nearest.normal;
            const dot = vx * n.x + vz * n.z;
            if (dot >= 0) break; // already moving away from the wall
            vx -= dot * n.x; // remove the into-wall component (slide along the wall)
            vz -= dot * n.z;
        }
        return { x: vx, z: vz };
    }

    /**
     * Shove a dynamic body along our heading (body-push, opt-in via `pushDynamics`). We bring
     * the body UP TO our speed into it, never beyond, so it moves at our walking pace and
     * stops when we stop — and we cap the per-step change by an acceleration that scales with
     * the body's inverse mass, so heavy props resist (the player, still blocked by the body as
     * a wall, advances only as fast as the prop yields). `body` is an ActionRigidBody3D wrapper
     * (the raycast hit's `.body`); mass is finite here (the caller filtered out static/ghost geometry).
     */
    _shoveBody(body, dx, dz, speed, dt, shovedSet) {
        if (shovedSet.has(body)) return; // one impulse per body per step (keyed by wrapper identity)
        shovedSet.add(body);
        const bv = body.linearVelocity;
        const along = bv.x * dx + bv.z * dz; // body's current speed along our push dir
        if (along >= speed) return; // already moving away at least as fast as we push
        let dv = speed - along;
        const maxDv = this._pushForce * body.inverseMass * dt; // accel cap; heavier -> smaller
        if (dv > maxDv) dv = maxDv;
        body.applyImpulse(new Vector3(dx * dv, 0, dz * dv));
    }

    /**
     * Receive pass (two-way coupling, opt-in via `receivePush`). Our body is excluded from solver
     * contacts, so a dynamic prop moving toward a stationary/strafing player would tunnel straight
     * through without the solver ever pushing us. Here we do that push ourselves: scan dynamic
     * bodies, find any overlapping our box and CLOSING on us, and resolve a momentum-correct 1D
     * collision along the contact axis — we get knocked, the prop is reflected back out (the solver
     * won't, since we're not in it, so without this it'd keep shoving every tick). Resting and
     * receding contacts are ignored (closing <= 0), as is anything we're already outrunning.
     */
    _receiveBodyPushes(dt) {
        if (!this._receivePush) return;
        const world = this.physicsWorld.getWorld && this.physicsWorld.getWorld();
        const bodies = world && world.rigid_bodies;
        if (!bodies || !bodies.length) return;

        const p = this.body.position;
        const hw = this.width / 2;
        const hh = this.height / 2;
        const hd = this.depth / 2;
        const pv = this.body.linearVelocity;
        const mP = this.mass;
        const self = this.body.goblinBody;

        for (let i = 0; i < bodies.length; i++) {
            const backend = bodies[i];
            if (backend === self || backend.isKinematicCharacter) continue; // skip self + other characters
            const body = ActionRigidBody3D.wrap(backend);
            if (!body || body.isStatic || !(body.mass > 0) || !isFinite(body.inverseMass)) continue;

            const ab = body.aabb;
            if (!ab) continue;
            const bcx = (ab.min.x + ab.max.x) * 0.5;
            const bcy = (ab.min.y + ab.max.y) * 0.5;
            const bcz = (ab.min.z + ab.max.z) * 0.5;

            // AABB overlap test (player box vs prop AABB). A non-positive value on any axis = a gap.
            const ox = hw + (ab.max.x - ab.min.x) * 0.5 - Math.abs(p.x - bcx);
            if (ox <= 0) continue;
            const oy = hh + (ab.max.y - ab.min.y) * 0.5 - Math.abs(p.y - bcy);
            if (oy <= 0) continue;
            const oz = hd + (ab.max.z - ab.min.z) * 0.5 - Math.abs(p.z - bcz);
            if (oz <= 0) continue;

            // Contact normal = axis of LEAST penetration, pointing from the prop toward us (the way
            // we get pushed). Axis-aligned, which suits the never-tipping box collider.
            let nx = 0;
            let ny = 0;
            let nz = 0;
            if (ox <= oy && ox <= oz) nx = p.x < bcx ? -1 : 1;
            else if (oy <= oz) ny = p.y < bcy ? -1 : 1;
            else nz = p.z < bcz ? -1 : 1;

            const bv = body.linearVelocity;
            // Closing speed along n: the prop's approach minus our own motion that way. <= 0 means
            // resting, receding, or we're already moving away faster than it pushes — nothing to do.
            const closing = (bv.x - pv.x) * nx + (bv.y - pv.y) * ny + (bv.z - pv.z) * nz;
            if (closing <= 0) continue;

            // Momentum-correct 1D exchange. Reduced mass: a light prop transfers little, a heavy one
            // a lot. Restitution adds a touch of bounce. Cap the velocity a single hit gives us.
            const mB = body.mass;
            const reduced = (mP * mB) / (mP + mB);
            let J = (1 + this._receiveRestitution) * reduced * closing;
            let dvp = J / mP;
            if (dvp > this._receiveMaxSpeed) {
                J *= this._receiveMaxSpeed / dvp;
                dvp = this._receiveMaxSpeed;
            }

            // Apply to us directly (not applyKnockback — that forces a long airborne window meant for
            // rocket-jumps). A short ground-suppress lets the bump actually carry a few ticks (the
            // grounded branch would otherwise overwrite horizontal velocity with input) before we
            // re-ground; an upward hit naturally arcs us up via the airborne branch.
            pv.x += nx * dvp;
            pv.y += ny * dvp;
            pv.z += nz * dvp;
            this.grounded = false;
            if (this._groundSuppress < 5) this._groundSuppress = 5;
            this.velocityY = pv.y;

            // Reflect the prop back out — the solver can't (we're not a contact body), so without
            // this it would keep penetrating and shoving us forever. Impulse I gives dv = I/mB, so
            // I = -J*n sheds exactly the velocity we took (plus restitution).
            body.applyImpulse(new Vector3(-J * nx, -J * ny, -J * nz));
        }
    }

    /**
     * Lowest ceiling CLEARANCE (down-facing surface height above the feet) over the
     * footprint centered at (cx,cz). Returns Infinity if there's nothing overhead within
     * a standing height. Mirror of _probeCeiling but at an arbitrary center, returning a
     * scalar gap — the headroom gate samples it at several points to find the way out.
     */
    _ceilingClearanceAt(cx, cz, feetY) {
        // Start the probe ABOVE step-up height. An obstacle the player can simply step onto (a
        // stair/box whose bottom sits on the floor) must NOT register as a low "ceiling" — its
        // floor-coincident underside otherwise reads as overhead geometry and the headroom gate
        // kills forward motion, blocking step-up onto the first stair / low box. Anything below
        // feet+stepHeight is handled by the ground clamp (step-up), not the gate.
        const startY = feetY + this.stepHeight + this._skin;
        const endY = feetY + this.standHeight + this._skin;
        const ix = this.width / 2 - this._skin;
        const iz = this.depth / 2 - this._skin;
        const offsets = [
            [0, 0],
            [ix, 0],
            [-ix, 0],
            [0, iz],
            [0, -iz]
        ];
        let lowest = Infinity;
        for (let i = 0; i < offsets.length; i++) {
            const ox = offsets[i][0];
            const oz = offsets[i][1];
            const hit = ActionRaycast3D.cast(
                new Vector3(cx + ox, startY, cz + oz),
                new Vector3(cx + ox, endY, cz + oz),
                this.physicsWorld,
                this._ignoreSelf
            );
            if (!hit || hit.normal.y > -0.4) continue; // not a ceiling (must face downward)
            const clr = hit.point.y - feetY;
            if (clr < lowest) lowest = clr;
        }
        return lowest;
    }

    /**
     * Treat insufficient headroom as a virtual wall. A ramp underside is a near-horizontal
     * surface: collide-and-slide can't block it (no horizontal normal to push against) and
     * depenetration can't tell it from the floor (near-vertical normal). So instead of using
     * the surface normal at all, we gate on ceiling CLEARANCE: if this tick's move would
     * carry us to a spot where the ceiling is lower than we are (even crouched), remove the
     * velocity component heading into the lower-clearance direction. The "wall normal" is the
     * horizontal gradient of clearance (points toward more room), so we slide along the
     * iso-clearance contour exactly like sliding along a wall. All raycasts: cheap and
     * deterministic, and it never fights the ground clamp the way end-of-step depenetration did.
     */
    _headroomGate(vx, vz, dt) {
        const speed = Math.sqrt(vx * vx + vz * vz);
        if (speed < 1e-5) return { x: vx, z: vz };

        const p = this.body.position;
        const feetY = p.y - this.height / 2;
        const need = this.height + this._skin; // clearance required to fit at a spot
        const halfDiag = Math.sqrt((this.width / 2) * (this.width / 2) + (this.depth / 2) * (this.depth / 2));

        // Where this tick's velocity is taking us (a little past, so we react before embedding).
        const dx = vx / speed;
        const dz = vz / speed;
        const reach = halfDiag + this._skin + speed * dt;
        const destX = p.x + dx * reach;
        const destZ = p.z + dz * reach;

        // Enough room ahead -> nothing to do (auto-crouch already shrank us if needed).
        if (this._ceilingClearanceAt(destX, destZ, feetY) >= need) return { x: vx, z: vz };

        // Wedge ahead. Estimate the horizontal direction of INCREASING clearance (the way
        // out) by finite differences around our footprint, and slide along it.
        const eps = halfDiag + this._skin;
        const cR = this._ceilingClearanceAt(p.x + eps, p.z, feetY);
        const cL = this._ceilingClearanceAt(p.x - eps, p.z, feetY);
        const cF = this._ceilingClearanceAt(p.x, p.z + eps, feetY);
        const cB = this._ceilingClearanceAt(p.x, p.z - eps, feetY);

        // Infinity differences cancel to NaN; treat any open side as "lots of room" so the
        // gradient still points outward. Clamp to a finite ceiling-probe range.
        const cap = this.standHeight + this._skin;
        const fin = (c) => (isFinite(c) ? c : cap);
        let gx = fin(cR) - fin(cL);
        let gz = fin(cF) - fin(cB);
        const glen = Math.sqrt(gx * gx + gz * gz);
        if (glen < 1e-5) {
            // Uniformly low all around (or degenerate) -> no horizontal way out. GROUNDED: stop, so
            // you can't walk a standing-height tunnel that's too short (forces a crouch). AIRBORNE:
            // do NOT freeze — the ceiling slide already blocks vertical, so let horizontal flow and
            // you glide along/out from under it instead of sticking to the underside.
            return this.grounded ? { x: 0, z: 0 } : { x: vx, z: vz };
        }
        gx /= glen;
        gz /= glen;

        const into = vx * gx + vz * gz; // < 0 means heading toward LESS headroom
        if (into < 0) {
            vx -= into * gx; // remove the into-wedge component (slide along the contour)
            vz -= into * gz;
        }
        return { x: vx, z: vz };
    }

    // ---- ActionSim entity interface (host-authoritative snapshots / reconciliation) ----
    // beginStep/endStep are above; getState/setState complete the duck-typed entity contract
    // {beginStep, endStep, getState, setState} the ActionSim framework drives.

    /** Snapshot this controller's authoritative state for the network. */
    getState() {
        const p = this.body.position;
        const v = this.body.linearVelocity;
        return {
            x: p.x,
            y: p.y,
            z: p.z,
            vx: v.x,
            vy: v.y,
            vz: v.z,
            yaw: this.yaw,
            pitch: this.pitch,
            grounded: this.grounded,
            w: this.width, // collider size so remote avatars reflect scale/crouch
            h: this.height,
            sliding: this._sliding, // render hint: a sliding player's avatar lies horizontal (visual only)
            // Jump/air TRANSITION timers. These persist across ticks and decide takeoff (don't
            // re-ground the instant we leave the floor), coyote-jump, and jump-buffering. The resim
            // of an airborne phase MUST start from these or it re-grounds / re-times the jump
            // differently than the live prediction did — the jump-into-slide jitter (a ground slide
            // never sets them, so it reconciles cleanly; SP never resims, so it's smooth).
            gs: this._groundSuppress,
            ct: this._coyoteTimer,
            jb: this._jumpBufferTimer,
            gnx: this.groundNormal.x, // last ground normal — read in the grounded branch before endStep recomputes it
            gny: this.groundNormal.y,
            gnz: this.groundNormal.z,
            userData: this.userData // opaque consumer payload, round-tripped verbatim
        };
    }

    /**
     * Apply an authoritative state (from a host snapshot) to this controller. Sets
     * position, velocity and grounded; does NOT touch yaw/pitch (the owning client keeps
     * authority over its own aim). Used for client-side reconciliation before replaying
     * un-acked inputs.
     */
    setState(s) {
        // Match the authoritative COLLIDER HEIGHT before adopting the position. Crouch (and scale)
        // re-center the body feet-planted, so if our predicted height disagrees with the server's,
        // the resim that follows re-plants the crouch from the wrong baseline and the body drifts
        // ~half the height delta every snapshot — the mid-air-crouch jitter (MP-only; SP never
        // reconciles). Rebuild the collider at the authoritative CENTER with the authoritative
        // height so the geometry is identical to the server's before replay. No-op in steady state
        // (s.h === height), so this only fires across a crouch/scale transition. Render-only view
        // displacement is untouched (no eye-jump injected).
        if (s.h !== undefined && Math.abs(s.h - this.height) > 1e-3) {
            this.crouching = s.h < this.standHeight - 1e-3;
            this.height = s.h;
            this.eyeHeight = this.crouching ? this.standEye * this.crouchRatio : this.standEye;
            this._buildBody(new Vector3(s.x, s.y, s.z));
        }
        this.body.position = new Vector3(s.x, s.y, s.z);
        const v = this.body.linearVelocity;
        v.x = s.vx;
        v.y = s.vy;
        v.z = s.vz;
        this.velocityY = s.vy;
        if (s.grounded !== undefined) {
            this.grounded = s.grounded;
            // Seed the landing edge to the authoritative grounded so the resim doesn't see a phantom
            // grounded transition at the reconcile seam (left at the live-present value, `_justLanded`
            // could mis-fire). The real touchdown is re-detected by the replayed physics.
            this._groundedPrev = s.grounded;
        }
        // Restore the authoritative SLIDE state. Without this, a reconcile whose acked tick predates
        // the server's slide leaves `_sliding` stuck true, so the resim *continues* the slide on the
        // un-boosted velocity and skips the entry boost — the jump-into-slide stalls for a few frames
        // until snapshots catch up. Restoring it lets the resim re-run slide ENTRY (with its boost).
        // Seed the crouch edge too so entry isn't spuriously re-triggered/suppressed at the seam.
        // _sliding is now stateless (recomputed every beginStep from inputs+velocity), so it needs no
        // restore — the next step derives it before anything reads it.
        // Restore the jump/air transition timers + last ground normal so the resim reproduces the
        // takeoff and the airborne arc exactly — the jump-into-slide fix. No-op for a ground slide.
        if (s.gs !== undefined) this._groundSuppress = s.gs;
        if (s.ct !== undefined) this._coyoteTimer = s.ct;
        if (s.jb !== undefined) this._jumpBufferTimer = s.jb;
        if (s.gnx !== undefined) this.groundNormal.set(s.gnx, s.gny, s.gnz);
        this._prevCrouch = this.crouching;
        if (s.userData !== undefined) this.userData = s.userData;
    }

    /**
     * Add a velocity impulse and force the character airborne (additive/opt-in capability —
     * for explosions / knockback / rocket-jumping). Bypasses the per-tick input velocity by
     * writing directly to the body and clearing `grounded` so the kinematic ground clamp
     * doesn't immediately pin the launch back down. Momentum is then preserved while airborne
     * (beginStep keeps velocity with no input), so a mostly-vertical shove arcs the player up.
     */
    applyKnockback(vx, vy, vz) {
        const gb = this.body.linearVelocity; // live backend vector (mutating .x/.y/.z writes through)
        gb.x += vx;
        gb.y += vy;
        gb.z += vz;
        this.grounded = false;
        this._groundSuppress = 10; // leave the ground before the clamp can re-pin us
        this.velocityY = gb.y;
    }

    // ---- Lifecycle ---------------------------------------------------------

    setPosition(pos) {
        this.body.position = pos.clone ? pos.clone() : new Vector3(pos.x, pos.y, pos.z);
        this.body.linearVelocity.x = 0;
        this.body.linearVelocity.y = 0;
        this.body.linearVelocity.z = 0;
        this.grounded = false;
    }

    destroy() {
        this.physicsWorld.removeObject(this.object);
    }
}

/**
 * ActionSoldierController3D - standard grounded shooter kit (walk + sprint + jump).
 */
class ActionSoldierController3D extends ActionFPSController3D {
    constructor(physicsWorld, options = {}) {
        super(physicsWorld, options);
    }
}

/**
 * ActionJetpackController3D - a normal jumper that can thrust in mid-air. From the ground a jump
 * press is an ordinary jump (coyote/buffer inherited from the base kit). Once airborne, HOLDING or
 * PRESSING jump fires the jetpack thrust. A brief "just-jump" window (jetJumpWindow) after the
 * launch suppresses thrust so a tap — or the first instant of a hold — is a clean jump, and only a
 * sustained hold past the window boosts. A fresh mid-air press bypasses the window (instant thrust).
 * Only the vertical hook differs from the base kit.
 */
class ActionJetpackController3D extends ActionFPSController3D {
    constructor(physicsWorld, options = {}) {
        super(physicsWorld, options);
        const o = options;
        this.thrust = o.thrust !== undefined ? o.thrust : 220; // upward accel while thrusting (must exceed gravity)
        this.maxRiseSpeed = o.maxRiseSpeed !== undefined ? o.maxRiseSpeed : 80;
        this.maxFuel = o.maxFuel !== undefined ? o.maxFuel : 2.5;
        this.fuel = this.maxFuel;
        this.fuelRegen = o.fuelRegen !== undefined ? o.fuelRegen : 1.5;
        // Seconds after a ground jump during which a still-held jump stays "just a jump" and does
        // NOT thrust. Lets you tap for a plain jump, or hold for jump-then-boost. A fresh mid-air
        // press skips this window. Default 0.18; set 0 for hold-from-ground = instant thrust.
        this.jetJumpWindow = o.jetJumpWindow !== undefined ? o.jetJumpWindow : 0.18;
        this._jetLockout = 0; // counts down the just-jump window
        this._prevJumpHeld = false; // last tick's jumpHeld (for thrust-on-press while held mid-air)
    }

    _updateVertical(cmd, dt) {
        const gb = this.body.linearVelocity; // live backend vector (mutating .x/.y/.z writes through)

        // Ground jump first, via the base kit (inherits coyote time + jump buffer). This clears
        // `grounded` on the tick we leave the floor; we detect that edge to arm the just-jump window.
        const wasGrounded = this.grounded;
        super._updateVertical(cmd, dt);
        if (wasGrounded && !this.grounded) this._jetLockout = this.jetJumpWindow;
        if (this._jetLockout > 0) this._jetLockout -= dt;

        const jumpPressed = cmd.jumpPressed || (cmd.jumpHeld && !this._prevJumpHeld);
        this._prevJumpHeld = !!cmd.jumpHeld;

        if (this.grounded) {
            this.fuel = Math.min(this.maxFuel, this.fuel + this.fuelRegen * dt);
            return;
        }

        // Airborne: a fresh press cancels the just-jump window so thrust fires immediately; a hold
        // waits out the window. Either way thrust needs fuel.
        if (jumpPressed) this._jetLockout = 0;
        if (cmd.jumpHeld && this._jetLockout <= 0 && this.fuel > 0) {
            this.fuel = Math.max(0, this.fuel - dt);
            // Suppress re-grounding so the kinematic clamp can't pin us back to the floor while
            // lifting off. Gravity (airborne) still applies: net rise = (thrust - gravity)·dt.
            this._groundSuppress = 3;
            gb.y += this.thrust * dt;
            if (gb.y > this.maxRiseSpeed) gb.y = this.maxRiseSpeed;
        }
    }
}

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
     * @param {number}  opts.distance      - Classic third-person boom length (pre-scale). Default 40.
     * @param {number}  opts.modernDistance- Over-shoulder ("modern") boom length, closer in (pre-scale). Default 20.
     * @param {number}  opts.shoulder      - Over-shoulder lateral offset for "modern" (pre-scale). Default 5.
     * @param {number}  opts.heightOffset  - Classic-mode camera lift above the eye so it looks over the character (pre-scale). Default 5.
     * @param {number}  opts.collisionRadius- Padding kept off walls when the boom is blocked (pre-scale). Default 5.
     * @param {number}  opts.smoothDecay   - Step/crouch ease: offset *= smoothDecay^dt. Default 0.0001 (~120ms settle).
     */
    constructor(opts = {}) {
        const o = opts;
        this.modes = o.modes || ["first", "modern", "classic"];
        this.modeIndex = 0;
        this.distance = o.distance !== undefined ? o.distance : 40; // classic boom length
        this.modernDistance = o.modernDistance !== undefined ? o.modernDistance : 20; // over-shoulder boom (closer)
        this.shoulder = o.shoulder !== undefined ? o.shoulder : 5;
        this.heightOffset = o.heightOffset !== undefined ? o.heightOffset : 5;
        this.collisionRadius = o.collisionRadius !== undefined ? o.collisionRadius : 5;
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
        if (Math.abs(this._offsetY) < 0.01 * scale) this._offsetY = 0;

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
