// fpscontext.js — the play-mode seam (game-side).
//
// Two genuine modes, one interface. Call sites (weapons, HUD, the main loop) talk to a CONTEXT and
// never branch on game.mode again:
//   - OfflineContext   : no network, NO sim. Acts directly on spWorld/spController.
//   - NetworkedContext : host/guest. Wraps FPSSession (prediction world + ActionSim).
// The mode difference is concentrated HERE; everything downstream is uniform.

/** Single-player, no sim. The world IS the simulation — we step it directly each fixed tick. */
class OfflineContext {
    constructor(game) {
        this.game = game;
    }

    get isNetworked() { return false; }
    get isHost() { return false; }
    get world() { return this.game.spWorld; } // live getter: rebuilt on kit-swap / scale
    get localController() { return this.game.spController; }
    get localId() { return "sp"; }
    // Health/dead come from the controller's own combat component (the single store; same class MP
    // uses). SP self-drives it in fixedTick, so the kill plane + respawn run through the controller.
    get localDead() { return this.game.spController.combat.dead; }
    get localHealth() { return this.game.spController.combat.health; }
    get netClient() { return null; }

    renderObjects() { return Array.from(this.game.spWorld.objects); }
    playerCount() { return 1; }
    nameplates() { return []; }
    viewTick() { return undefined; } // no lag-comp offline
    roleLabel() { return "SINGLE"; }

    /** One fixed step: sample input, carry held prop, advance the world, ground the body, respawn. */
    fixedTick(dt) {
        const g = this.game;
        g.spController.beginStep(g.buildCommand(), dt);
        g.spController.grabber.drive(dt); // carry: pull held prop toward hand pre-step (controller owns it)
        g.spWorld.fixed_update(dt);
        g.spController.endStep(dt);
        g.spController.combat.update(dt); // self-drive: kill plane + respawn (the controller owns it)
    }

    update() {} // nothing to sample between fixed ticks offline

    /** Rebuild the local controller for a new kit (preserve position + weapon state). */
    setKit() {
        const g = this.game;
        const old = g.spController;
        const p = old.body.position;
        old.destroy();
        g.spController = g._makeSpController(new Vector3(p.x, p.y, p.z));
        g._carryWeaponState(old, g.spController);
    }

    destroy() {
        if (this.game.spController) this.game.spController.destroy();
    }
}

/** Multiplayer (host or guest). Delegates to FPSSession (client prediction + ActionSim). */
class NetworkedContext {
    constructor(game, session) {
        this.game = game;
        this.session = session;
    }

    get isNetworked() { return true; }
    get isHost() { return !!this.session.isHost; }
    get world() { return this.session.clientWorld; } // prediction world the local player acts on
    get localController() { return this.session.getLocalController(); }
    get localId() { return this.session.localId; }
    get localDead() { return this.session.localDead; }
    get localHealth() { return this.session.localHealth; }
    get netClient() { return this.session.client; }

    renderObjects() { return this.session.getRenderObjects(); }
    playerCount() { return this.session.playerCount(); }
    nameplates() { return this.session.getNameplates(); }
    viewTick() { return this.session.client.renderViewTick(); } // tick we're rendering (interp-delay aware)
    roleLabel() { return this.session.isHost ? "HOST" : "GUEST"; }

    fixedTick(dt) { this.session.fixedTick(dt); }
    update(dt) { this.session.update(dt); }

    /** Rebuild the local PREDICTED controller + ride the kit in the command (host rebuilds to match). */
    setKit(kit) {
        this.session.setLocalKit(kit === "jetpack" ? 1 : 0);
    }

    destroy() {
        this.session.destroy();
    }
}
