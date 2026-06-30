// fpskits.js — example/game-side controller KITS for the reference FPS.
//
// A "kit" is a subclass of the engine's ActionFPSController3D that overrides only the
// behavioral hooks (_updateVertical / _getMoveSpeed) — the engine owns all the ground/
// step/wall/slide mechanism. Kits are POLICY (a specific game's movement flavor), so they
// live here in the example, NOT in the engine. The default kit is just the base controller
// instantiated directly (no subclass needed) — see game.js / fpsnet.js factories.
//
// This file is the reference for "how to write a kit": subclass, override one hook, done.

/**
 * ActionJetpackController3D - a normal jumper that can thrust in mid-air. From the ground a jump
 * press is an ordinary jump (coyote/buffer inherited from the base controller). Once airborne,
 * HOLDING or PRESSING jump fires the jetpack thrust. A brief "just-jump" window (jetJumpWindow)
 * after the launch suppresses thrust so a tap — or the first instant of a hold — is a clean jump,
 * and only a sustained hold past the window boosts. A fresh mid-air press bypasses the window
 * (instant thrust). Only the vertical hook differs from the base.
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

        // Ground jump first, via the base controller (inherits coyote time + jump buffer). This clears
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
