// actionengine/character/FPSControllerConstants.js
//
// Every tunable default for ActionFPSController3D, in ONE place, grouped by subsystem. The controller reads
// each default from here (constructor: `o.walkSpeed ?? FPS_CONTROLLER_DEFAULTS.movement.walkSpeed`), so a
// caller can still override any single value per-instance via the options object — this is only the fallback.
//
// What is NOT here (on purpose):
//   - Algorithm-internal epsilons / thresholds inside the collision + slope math (1e-4 guards, normal.y
//     classifications, sub-step fractions). Those are implementation details, not feel knobs — naming them
//     here would bury the algorithm, not clarify it. They stay at their use site.
//   - ACTION_RENDER_SMOOTH (the dynamic-body render spring): it lives on ActionPhysicsObject3D because it is
//     engine-generic (any physics object, not FPS-specific), not a controller concern.
//
// Loaded as a plain <script> BEFORE actionfpscontroller3D.js (globals, no bundler). Also add to the headless
// suites' file list (controller_acceptance_test.js) ahead of the controller.

const FPS_CONTROLLER_DEFAULTS = {
    // ---- Collider dimensions + mass (pre-scale "base" values; _applyScale multiplies at runtime) ----
    dimensions: {
        width: 0.6,
        depth: 0.6,
        height: 1.8,
        mass: 10,
        eyeHeightRatio: 0.42, // eyeHeight default = height * this (overridable directly via o.eyeHeight)
        crouchRatio: 0.55,    // crouched collider height as a fraction of standing height
    },

    // ---- Ground movement. Three gaits: walk (held modifier) < move/run (default) < sprint. ----
    movement: {
        walkSpeed: 3.8,        // deliberate slow gait (held walk modifier)
        moveSpeed: 7,          // RUN speed — the no-modifier default
        sprintSpeed: 11.5,     // top gait
        crouchSpeedMult: 0.5,  // multiplies whichever gait is active while crouched (unitless)
        sprintDecay: 10,       // units/sec bleed of excess speed after releasing sprint (Infinity = instant)
        groundStopDecel: 80,   // units/sec decel when all move keys released (idle stop)
        airControl: 0.12,      // steering authority while airborne (0..1)
        friction: 0,           // body friction (0 keeps wall-slides clean; kinematic grounding holds slopes)
    },

    // ---- Jump + forgiveness windows ----
    jump: {
        jumpSpeed: 4.6,
        stepHeight: 0.4,       // max ledge height the mover steps up onto (base/1x; scales linearly with player scale)
        stepDownDist: 0.5,     // max drop the mover snaps down to keep grounded
        coyoteTime: 0.1,       // sec after leaving a ledge a jump still registers
        jumpBuffer: 0.12,      // sec before landing a jump press is remembered and fires on touchdown
    },

    // ---- Slopes ----
    slopes: {
        maxSlopeAngle: 45.57,  // max standable slope, degrees (>=90 disables the limit)
        climbSteepSlopes: false, // can the player ascend a too-steep slope by walking into it
    },

    // ---- Slide (crouch-at-speed) ----
    slide: {
        enabled: true,
        requiresMoveInput: false, // also require a movement key held (not crouch alone)
        minSpeed: 7.8,         // speed at/above which a crouch launches a slide
        endSpeed: 1,           // slide ends when speed bleeds below this
        friction: 6,           // flat-ground slide friction
        boost: 1.3,            // launch speed multiplier
        control: 0.14,         // steering authority while sliding (0..1)
        slopeAccel: 1.5,       // downhill acceleration factor while sliding
        slopeMin: 0.2,         // sin(angle) at/above which the slide is gravity-governed (Infinity disables)
        slopeFriction: 1.5,    // cross-slope friction while gravity-sliding
        coyoteFrames: 5,       // frames after dropping below slide speed a crouch still launches a slide
    },

    // ---- Ladders (see _updateLadder) ----
    // Source unit conversion used throughout this block: Source's player hull is 72 units tall (a fixed,
    // well-documented Source/Hammer dimension, not derived from this repo) for a ~1.83m human, so
    // 1 Source unit ~= 1.83/72 ~= 0.0254m. Every distance/speed below is Source's own literal converted
    // at that ratio — NOT independently tuned — so this controller's ladder feel matches Source's,
    // including its known imperfections (e.g. the mount trace sometimes missing a fast approach; Source
    // has that same miss, just proportionally rarer at its own scale — we keep the literal conversion
    // rather than inflating the reach to paper over it).
    ladder: {
        // climbSpeed/strafeSpeed are TUNED (2.0), not the literal Source conversion (Source's own
        // MAX_CLIMB_SPEED=200 u/s converts to ~5.08 m/s at the 0.0254 ratio below) — a deliberate feel
        // choice, kept separate from the mount-reach/dismount-speed values below which stay literal.
        climbSpeed: 2.5,        // vertical speed while climbing (pre-scale), tuned
        strafeSpeed: 2.5,       // lateral speed along the ladder's face while climbing (pre-scale), tuned
        // Source-style: forward/back and strafe contributions are summed WITHOUT normalizing the
        // combined wish vector, unlike ground movement. Holding forward+strafe into a ladder is
        // strictly faster than either alone — intentional, matching the original engine's feel.
        mountReach: 0.2,      // Source LadderDistance()=2.0 units * 0.0254 (pre-scale) — a literal
                                 // conversion, not tuned for reliability; Source misses mounts too.
        // Source: VectorScale(plane.normal, 270, velocity) on jump-off — a full ASSIGNMENT of a purely
        // horizontal vector (the ladder's plane normal has no vertical component), so dismount is a flat
        // shove straight out from the face with NO vertical kick, not an "outward + up" hop.
        dismountPushSpeed: 7.0, // Source jump-off literal 270 u/s * 0.0254 (pre-scale), rounded
    },

    // ---- Ghost: the solver body that trails the player and pushes props (see _syncGhost) ----
    // maxSpeed / maxDampSpeed default to sprintSpeed * this multiplier (kept as a ratio so they scale with
    // the character's speed tuning); override with an absolute units/sec value via options if desired.
    ghost: {
        maxSpeedSprintMult: 1.3,     // ghost chase-speed cap = sprintSpeed * this
        maxDampSpeedSprintMult: 1.3, // damping-term cap = sprintSpeed * this
        damping: 1.0,          // fraction of the ghost's velocity opposed each tick (0..1)
        stiffness: 0.9,        // 0..1 blend toward the gap-closing velocity each tick
        pushMassBaseMult: 35,  // props heavier than mass * this block like a wall; lighter yield proportionally
        // Physics material of the ghost body itself (not the chase behavior above). Zero friction/
        // restitution/linearDamping so the chase-drive velocity is never fought by the solver; high
        // angularDamping keeps contact torque from spinning it up while it shoves props.
        material: {
            friction: 0,
            restitution: 0,
            linearDamping: 0,
            angularDamping: 0.9,
        },
    },

    // ---- Knockback: how the player RECEIVES a push from a prop (see _readGhostKnockback) ----
    knockback: {
        receivePush: true,        // gate the whole knockback path
        maxSpeed: 16,             // cap on received knockback speed
        knockbackFraction: 1.0,   // scale received knockback
        selfPush: false,          // false = only a prop with its OWN inbound momentum knocks you (no self-push
                                  //         oscillation); true = legacy relative-closing gate (oscillates)
    },

    // ---- Netcode / prediction behavior for the ghost (both default ON; false reverts to older behavior) ----
    netcode: {
        driveGhostDuringResim: true,    // run the ghost drive during rollback resim (off = props rubber-band)
        hardsnapGhostOnReconcile: true, // snap ghost onto authority on setState (off = props oscillate)
    },

    // ---- View / aim ----
    view: {
        yaw: 0,
        pitch: 0,
        maxPitch: 1.5,         // clamp, radians
    },

    // ---- Render (sub-tick eye interpolation) ----
    render: {
        snapDist: 0.8,         // per-tick eye jump (units) above which the interp snaps instead of sliding
    },

    // ---- Misc identity defaults (not feel knobs, but kept here so nothing is scattered) ----
    misc: {
        color: "#cc4444",
        visible: false,        // the collider body is invisible by default (the model component draws the player)
        bodyName: "fpsControllerBody",
        scale: 1,              // 1 = no scaling
        spawn: { x: 0, y: 2, z: 0 }, // fallback spawn when no position is passed
    },
};

// Rendered-eye spring smoother (render-only; the sim eye is untouched). Irons the fixed-sim / high-refresh
// beat that makes the whole VIEW micro-lurch (and thus every object shimmer). STIFFNESS is high so the added
// view latency is negligible — we only smooth sub-tick unevenness. Lower = smoother but laggier view; higher
// = tighter. SNAP_DIST hard-snaps a real jump (teleport/respawn/step) so no latency is added there. Horizontal
// (X/Z) only — vertical eye motion (crouch/step/scale) is owned by the camera's view-displacement smoother.
const FPS_EYE_SMOOTH = {
    ENABLED: true,
    STIFFNESS: 2500,
    SNAP_DIST: 2.0,
};

// Expose as globals (plain-script environment). typeof guards keep it inert under a module bundler.
if (typeof window !== "undefined") {
    window.FPS_CONTROLLER_DEFAULTS = FPS_CONTROLLER_DEFAULTS;
    window.FPS_EYE_SMOOTH = FPS_EYE_SMOOTH;
}
