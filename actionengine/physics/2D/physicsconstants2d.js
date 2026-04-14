// actionengine/math/physics/physicsconstants2D.js
/**
 * PhysicsConstants2D — Centralized tunable constants for the 2D physics engine.
 *
 * All values here can be tweaked to change the feel of the physics simulation.
 * Each constant includes a comment explaining what it controls and its typical range.
 */
class PhysicsConstants2D {
    // ========================================================================
    // World defaults
    // ========================================================================

    /** Default horizontal gravity (pixels/s²). */
    static GRAVITY_X = 0;

    /** Default vertical gravity (pixels/s²). 600 = downward in screen space. */
    static GRAVITY_Y = 500;

    /** Default spatial hash cell size for broadphase. Should be ~2× the largest object. */
    static BROADPHASE_CELL_SIZE = 64;

    /** Default solver velocity iterations. Higher = more accurate, more expensive. */
    static VELOCITY_ITERATIONS = 20;

    /** Default solver position iterations. Higher = more accurate overlap correction. */
    static POSITION_ITERATIONS = 4;

    // ========================================================================
    // Position correction
    // ========================================================================

    /** Penetration slop - allow this much overlap before correcting (pixels). */
    static POSITION_SLOP = 0.1;

    /** Position correction rate - fraction of excess penetration to correct per frame (0-1). */
    static POSITION_CORRECTION_RATE = 0.2;

    /** Relative velocity threshold below which restitution is ignored (pixels/s).
     *  Prevents micro-bounce jitter on resting contacts.
     *  Rule of thumb: sqrt(2 * gravity * slop) ≈ 20 for gravity ~500. */
    static RESTITUTION_VELOCITY_THRESHOLD = 20;

    // ========================================================================
    // Warm starting (contact cache)
    // ========================================================================

    /** Max squared distance (pixels²) for matching cached contacts during warm start. */
    static WARM_START_MATCH_DISTANCE = 4;

    /** Pair key multiplier for body ID hashing. Must be larger than max body count. */
    static PAIR_KEY_MULTIPLIER = 100000;

    // ========================================================================
    // Narrow phase (collision detection)
    // ========================================================================

    /** Epsilon for floating-point comparisons in collision detection. */
    static NARROW_PHASE_EPSILON = 1e-8;

    /** Shape skin thickness (pixels). Inflates collision shapes slightly so
     *  contacts fire before visual overlap occurs. Similar to Box2D's shape radius.
     *  Typical range: 0.1–1.0. Set to 0 for exact collision. */
    static SKIN_THICKNESS = 0;

    // ========================================================================
    // Speculative contacts (fast-moving object tunneling prevention)
    // ========================================================================

    /** Enable speculative contacts. Set to false to disable and use only discrete collision detection.
     *  When enabled, expands AABBs by velocity to catch fast-moving objects before tunneling. */
    static SPECULATIVE_CONTACTS_ENABLED = false;

    /** Speculative contact multiplier. Expands AABBs by velocity * dt * multiplier
     *  to catch fast-moving objects before tunneling. 1.0 = expand by full velocity,
     *  higher values = more conservative (catches faster objects but more false positives).
     *  Only used if SPECULATIVE_CONTACTS_ENABLED is true. */
    static SPECULATIVE_CONTACT_MULTIPLIER = 1.2;

    /** Maximum speculative distance (pixels). Caps how far ahead we predict collisions.
     *  Prevents extremely fast objects from generating contacts too early.
     *  Typical range: 10-50 pixels. Higher = catches faster objects but more "early" collisions.
     *  Only used if SPECULATIVE_CONTACTS_ENABLED is true. */
    static SPECULATIVE_CONTACT_MAX_DISTANCE = 80;

    // ========================================================================
    // Rigid body defaults
    // ========================================================================

    /** Default restitution (bounciness) for new bodies. Range: 0..1. */
    static BODY_DEFAULT_RESTITION = 0.2;

    /** Default friction coefficient for new bodies. Range: 0..1+. */
    static BODY_DEFAULT_FRICTION = 0.3;

    /** Default linear damping (per second). Higher = more drag. */
    static BODY_DEFAULT_LINEAR_DAMPING = 0.01;

    /** Default angular damping (per second). Higher = more rotational drag. */
    static BODY_DEFAULT_ANGULAR_DAMPING = 0.01;

    /** Default gravity scale (multiplier on world gravity). 0 = no gravity. */
    static BODY_DEFAULT_GRAVITY_SCALE = 1;

    /** Default sleep linear velocity threshold (pixels/s). */
    static BODY_DEFAULT_SLEEP_THRESHOLD_LINEAR = 100;

    /** Default sleep angular velocity threshold (rad/s). */
    static BODY_DEFAULT_SLEEP_THRESHOLD_ANGULAR = 0.5;

    /** Default time (seconds) below thresholds before body goes to sleep. */
    static BODY_DEFAULT_SLEEP_TIME_REQUIRED = 0.5;

    /** Default collision category bitmask. */
    static BODY_DEFAULT_CATEGORY_BITS = 0x0001;

    /** Default collision mask bitmask (0xFFFF = collide with everything). */
    static BODY_DEFAULT_MASK_BITS = 0xFFFF;

    /** Default density for dynamic bodies (kg per unit²). */
    static BODY_DEFAULT_DENSITY = 1;
}
