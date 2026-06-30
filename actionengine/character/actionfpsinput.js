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
