// actionfpscombat.js — the per-character COMBAT component (engine mechanism). Rides on an
// ActionFPSController3D when combat is enabled; it is the DAMAGE SINK + life cycle: health, death,
// the respawn timer, and the kill-plane / fell-out-of-world check. It does NOT decide who-hit-whom —
// that's resolution (offline: the weapon's own shots via ActionHitResolver; networked: the host).
// Whoever resolves a hit calls takeDamage() here; this component turns it into HP, death, respawn.
//
// Same component in both modes:
//   • Offline — it self-drives: update(dt) runs the respawn countdown and the kill-plane check, and
//     the owner's weapon/rocket-jump or a fall feeds takeDamage()/kill().
//   • Networked — the host owns the authority and pushes health/dead through setNetState(); the local
//     copy just reflects it for the HUD. The respawn timer/kill-plane self-drive is skipped (the host
//     decides). One flag, set by the play context, picks which.
//
// Policy hooks are optional callbacks (onDeath / onRespawn / spawnPoint), so a game layers its scoring,
// FX, and spawn selection without the engine learning what a "match" is.

class ActionFPSCombat {
    /**
     * @param {ActionFPSController3D} controller  the owning character (the body that lives/dies)
     * @param {object} [opts]
     * @param {number}   [opts.maxHealth=100]
     * @param {number}   [opts.respawnTime=3]   seconds dead before respawn (offline self-drive)
     * @param {number}   [opts.killPlaneY=-1000] respawn if the body falls below this Y (offline)
     * @param {Function} [opts.spawnPoint]       () => Vector3, where to respawn (else the spawn pos)
     * @param {Function} [opts.onDeath]          (attackerId) => void
     * @param {Function} [opts.onRespawn]        () => void
     * @param {boolean}  [opts.hostAuthoritative=false] networked: host owns HP; skip self-drive
     */
    constructor(controller, opts = {}) {
        this.controller = controller;
        this.maxHealth = opts.maxHealth != null ? opts.maxHealth : 100;
        this.respawnTime = opts.respawnTime != null ? opts.respawnTime : 3;
        this.killPlaneY = opts.killPlaneY != null ? opts.killPlaneY : -1000;
        this._spawnPoint = opts.spawnPoint || null;
        this._onDeath = opts.onDeath || null;
        this._onRespawn = opts.onRespawn || null;
        this.hostAuthoritative = !!opts.hostAuthoritative;

        this.health = this.maxHealth;
        this.dead = false;
        this._respawnTimer = 0; // seconds remaining while dead (offline self-drive)
        // Remember where we started so a no-spawnPoint respawn returns there.
        const p = controller.body.position;
        this._home = new Vector3(p.x, p.y, p.z);
    }

    get alive() { return !this.dead; }

    /**
     * Apply `amount` damage from `attackerId` (optional). Clamps at 0 and dies once there. Returns
     * { died, lethal, health } so a resolver can react (hit marker / kill credit). No-op while dead or
     * when the host owns authority (networked clients take HP only through setNetState).
     */
    takeDamage(amount, attackerId = null) {
        if (this.dead || this.hostAuthoritative || amount <= 0) return { died: false, lethal: false, health: this.health };
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this._die(attackerId);
            return { died: true, lethal: true, health: 0 };
        }
        return { died: false, lethal: false, health: this.health };
    }

    /** Heal up to maxHealth (no-op while dead / host-authoritative). */
    heal(amount) {
        if (this.dead || this.hostAuthoritative || amount <= 0) return;
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    /** Force death now (kill plane, scripted kill). */
    kill(attackerId = null) {
        if (this.dead || this.hostAuthoritative) return;
        this.health = 0;
        this._die(attackerId);
    }

    _die(attackerId) {
        this.dead = true;
        this._respawnTimer = this.respawnTime;
        if (this._onDeath) this._onDeath(attackerId);
    }

    /** Respawn now: full health, teleport to the spawn point, zero velocity. */
    respawn() {
        this.dead = false;
        this.health = this.maxHealth;
        this._respawnTimer = 0;
        const sp = this._spawnPoint ? this._spawnPoint() : this._home;
        if (sp && typeof this.controller.setPosition === "function") this.controller.setPosition(sp);
        if (this._onRespawn) this._onRespawn();
    }

    /**
     * Networked: adopt the host's authoritative health/dead. Local clients call this from the snapshot
     * so the HUD reflects authority without the local copy ever deciding damage itself.
     */
    setNetState(health, dead) {
        if (health !== undefined) this.health = health;
        if (dead !== undefined) this.dead = dead;
    }

    /**
     * Per-frame (offline self-drive only): run the respawn countdown and the kill-plane / fell-out
     * check. Host-authoritative copies skip this — the host owns the life cycle. dt in seconds.
     */
    update(dt) {
        if (this.hostAuthoritative) return;
        if (this.dead) {
            this._respawnTimer -= dt;
            if (this._respawnTimer <= 0) this.respawn();
            return;
        }
        if (this.controller.body.position.y < this.killPlaneY) this.kill(null);
    }
}
