// actionengine/character/actionfpsinput.js
/**
 * ActionFPSInput - the engine's DEFAULT command sampler for ActionFPSController3D.
 *
 * This is a convenience, not a requirement. ActionFPSController3D never reads input — it
 * consumes a pure-data command struct. This class is one ready-made way to PRODUCE that
 * struct from the engine input system, shipped so a game can stand up a working character
 * with zero config. It is deliberately OFF the controller class: keybinds are policy, the
 * controller is mechanism, and the two shouldn't share a file.
 *
 * Three tiers of developer effort:
 *   1. Zero config:   const cmd = ActionFPSInput.sample(input);
 *   2. Rebind (data): const cmd = ActionFPSInput.sample(input, { sprint: "Action3" });
 *   3. Total control: build the {forward,right,jumpPressed,...} struct yourself and never
 *                     touch this class.
 *
 * sampleLook(input, dt) gives the right-stick camera delta on the same terms — a
 * convenience, the game still owns aim accumulation.
 *
 * Bindings are DATA (DEFAULT_BINDINGS) so rebinding one action is a merge, not a rewrite.
 */
class ActionFPSInput {
    /**
     * Build a movement command from the engine input system. Pure data; serializable.
     * @param {Object} input     - the engine input system (isKeyPressed / isKeyJustPressed)
     * @param {Object} [bindings] - partial override of DEFAULT_BINDINGS (merged, not replaced)
     * @returns {{forward:number, right:number, jumpPressed:boolean, jumpHeld:boolean, sprint:boolean, walk:boolean, crouch:boolean}}
     */
    static sample(input, bindings) {
        const b = bindings ? { ...ActionFPSInput.DEFAULT_BINDINGS, ...bindings } : ActionFPSInput.DEFAULT_BINDINGS;
        let forward = 0;
        let right = 0;
        if (input.isKeyPressed(b.forward)) forward += 1;
        if (input.isKeyPressed(b.back)) forward -= 1;
        if (input.isKeyPressed(b.right)) right += 1;
        if (input.isKeyPressed(b.left)) right -= 1;
        // Left analog stick — additive, kept UN-clamped so the controller can read its
        // magnitude for walk-vs-run. y up = forward. (Deadzone is applied in the axis layer.)
        if (input.getVector) {
            const mv = input.getVector("leftAnalog");
            forward += -mv.y;
            right += mv.x;
        }
        return {
            forward,
            right,
            jumpPressed: input.isKeyJustPressed(b.jump),
            jumpHeld: input.isKeyPressed(b.jump),
            sprint: input.isKeyPressed(b.sprint), // Shift
            walk: input.isKeyPressed(b.walk), // held slow-walk gait (overrides run; sprint still wins)
            crouch: input.isKeyPressed(b.crouch)
        };
    }

    /**
     * Right-stick camera-look delta for this frame. The game still OWNS the aim: it
     * accumulates yaw and clamps pitch itself, then calls controller.aim(yaw, pitch).
     * Mouse-look is separate (it's a clean one-liner and its policy — sensitivity,
     * invert, pointer-lock — is game-specific).
     *
     * @param {Object} input  - engine input system
     * @param {number} dt     - frame delta in seconds
     * @param {Object} [opts]
     *   speed   {number}  rad/sec at full deflection (default 3.2)
     *   slot    {string}  axis slot to read (default "rightAnalog")
     *   invertY {boolean} flip the pitch axis (default false)
     * @returns {{yaw:number, pitch:number}} per-frame deltas (add to your aim; pitch may need clamping)
     */
    static sampleLook(input, dt, opts) {
        if (!input.getVector) return { yaw: 0, pitch: 0 };
        const speed = opts && opts.speed !== undefined ? opts.speed : 3.2;
        const slot = (opts && opts.slot) || "rightAnalog";
        const v = input.getVector(slot);
        if (v.x === 0 && v.y === 0) return { yaw: 0, pitch: 0 };
        const s = speed * dt;
        return {
            yaw: -v.x * s,
            pitch: (opts && opts.invertY ? 1 : -1) * v.y * s
        };
    }
}

// Default action-slot bindings. A game overrides any subset via the `bindings` arg to sample(),
// or ignores this class entirely and builds the command struct itself.
ActionFPSInput.DEFAULT_BINDINGS = {
    forward: "DirUp",
    back: "DirDown",
    left: "DirLeft",
    right: "DirRight",
    jump: "Action1",
    sprint: "Action2", // Shift
    walk: "Action6", // X — held slow-walk gait
    crouch: "Action7" // C
};
