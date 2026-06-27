// actionengine/network/simulation/ActionSimServer.js
//
// Authoritative simulation server (host only). Game-agnostic: it drives a registry of
// duck-typed entities {beginStep(cmd,dt), endStep(dt), getState()} around ONE shared world
// step (the injected `stepWorld`), consuming one input command per player per tick from a
// per-player jitter buffer, and emits per-client snapshots with the ack + buffer health
// that client prediction needs.
//
// Composition: the GAME constructs this, injects `transport` + `stepWorld`, and registers
// the entities it created via addPlayer/removePlayer. The server never special-cases the
// host — the host's own player is just another client whose commands arrive over a loopback
// transport.
class ActionSimServer {
    /**
     * @param {Object} opts
     * @param {Object} opts.transport - broadcast(msg)/sendTo(id,msg)/on(type,fn)
     * @param {Function} opts.stepWorld - (dt) => advance the authoritative world one step
     * @param {Function} [opts.onCommand] - (id, cmd, server) => react to a consumed command,
     *        called AFTER the world step + history record (so the actor's position and the
     *        rewind history are current). Game-side authoritative reactions to a command live
     *        here (e.g. an authoritative hit test against the rewindable history).
     * @param {number} [opts.historyTicks] - per-player authoritative state history kept for
     *        lag-compensated rewind (default 64 ≈ 1s at 60Hz).
     */
    constructor(opts) {
        this.transport = opts.transport;
        this.stepWorld = opts.stepWorld;
        this.onCommand = opts.onCommand || null;
        this.historyTicks = opts.historyTicks || 64;
        // Per-player input jitter-buffer cap (see ActionSimInputBuffer). Bounds how much queued
        // input a stalled consumer can hoard before the oldest is dropped — prevents a paused
        // host from later replaying a backlog as authoritative truth. Infinity = keep everything.
        this.maxBuffer = opts.maxBuffer || 12;

        // Optional input recorder ("replay"). OFF by default (0) so it costs nothing and other
        // games are unaffected. When >0, the server keeps a capped ring of the last N ticks'
        // CONSUMED commands per player — the exact input that drove the sim each tick (tapped
        // post-jitter-buffer, so it's faithful and unaffected by the buffer trim). The framework
        // just records the tape; deterministic playback (and props, which aren't command-driven)
        // is the game's concern. Read with getReplay(); reset with clearReplay().
        this.replayTicks = opts.replayTicks || 0;
        this.replay = []; // [{ tick, commands: {id: cmd} }] ascending tick, capped to replayTicks
        this.serverTick = 0;
        this.players = new Map(); // id -> { entity, input, lastCmd, history:[{tick,state}] }
        this.objects = new Map(); // id -> entity (snapshot-only: free bodies like props)

        this.transport.on("cmd", (msg, fromId) => this._onCommand(msg, fromId));
    }

    /** Register a COMMAND-DRIVEN entity (a player) — gets an input buffer + beginStep/endStep. */
    addPlayer(id, entity) {
        if (this.players.has(id)) return;
        this.players.set(id, { entity, input: new ActionSimInputBuffer({ maxBuffer: this.maxBuffer }), lastCmd: null, history: [] });
    }

    removePlayer(id) {
        this.players.delete(id);
    }

    /**
     * Register a FREE entity (e.g. a physics prop) — replicated in snapshots but not
     * command-driven. It must be in the authoritative world so `stepWorld` advances it;
     * the server only needs its `getState()`.
     */
    addObject(id, entity) {
        this.objects.set(id, entity);
    }

    removeObject(id) {
        this.objects.delete(id);
    }

    hasPlayer(id) {
        return this.players.has(id);
    }

    /**
     * Flag that player `id` was teleported/repositioned authoritatively this tick (respawn,
     * kill-plane, any host-side setState). The next snapshot carries `resync:true` on that
     * player's state, so the owning client re-baselines (snaps) instead of trying to reconcile
     * across the discontinuity. One-shot: cleared after the next snapshot is sent.
     */
    markResync(id) {
        const p = this.players.get(id);
        if (p) p._resync = true;
    }

    getEntity(id) {
        const p = this.players.get(id);
        return p ? p.entity : null;
    }

    _onCommand(msg, fromId) {
        const p = this.players.get(fromId);
        if (!p || !msg) return;
        p.input.pushBatch(msg.cmds); // input packet = newest command + a few backups
    }

    /** Advance the authoritative sim one tick. Call from action_fixed_update. */
    tick(dt) {
        // 1) One command per player (repeat last on starve), feed beginStep. Remember the
        //    command consumed this tick for the post-step onCommand reactions.
        for (const [, p] of this.players) {
            let cmd = p.input.consume();
            if (!cmd) cmd = p.lastCmd; // starved: re-apply the most recent command
            else p.lastCmd = cmd;
            p._cmd = cmd;
            p.entity.beginStep(cmd || ActionSimServer.ZERO_CMD, dt);
        }

        // 2) ONE authoritative world step for everyone.
        this.stepWorld(dt);

        // 3) endStep all.
        for (const [, p] of this.players) p.entity.endStep(dt);

        this.serverTick++;

        // 4) Record authoritative state history (lag-compensated rewind: stateAt).
        for (const [, p] of this.players) {
            p.history.push({ tick: this.serverTick, state: p.entity.getState() });
            while (p.history.length > this.historyTicks) p.history.shift();
        }

        // 4.5) Optional replay recording: capture the command that actually drove each player
        //      this tick (p._cmd — consumed, or repeated-on-starve). Off unless replayTicks > 0.
        if (this.replayTicks > 0) {
            const commands = {};
            for (const [id, p] of this.players) commands[id] = p._cmd || null;
            this.replay.push({ tick: this.serverTick, commands });
            while (this.replay.length > this.replayTicks) this.replay.shift();
        }

        // 5) Per-command server-side reactions (game-defined). After the step + history so the
        //    actor's position and the rewind window are current this tick.
        if (this.onCommand) {
            for (const [id, p] of this.players) {
                if (p._cmd) this.onCommand(id, p._cmd, this);
            }
        }

        // 6) Per-client snapshot (same entity list; per-client ack + buffer health).
        this._sendSnapshots();
    }

    /**
     * Authoritative state of player `id` at a (possibly fractional) past server tick, lerped
     * between the two bracketing history samples. This is the rewind used for lag-compensated
     * hit detection — pass the shooter's `viewTick` to reconstruct what they saw. Returns the
     * latest/oldest clamped state if `tick` is outside the kept window, or null if unknown.
     */
    stateAt(id, tick) {
        const p = this.players.get(id);
        if (!p || p.history.length === 0) return null;
        const h = p.history;
        if (tick <= h[0].tick) return h[0].state;
        if (tick >= h[h.length - 1].tick) return h[h.length - 1].state;
        for (let i = 0; i < h.length - 1; i++) {
            const a = h[i];
            const b = h[i + 1];
            if (tick >= a.tick && tick <= b.tick) {
                const f = (tick - a.tick) / (b.tick - a.tick || 1);
                return ActionSimServer._lerpState(a.state, b.state, f);
            }
        }
        return h[h.length - 1].state;
    }

    /**
     * The recorded input tape (empty unless `replayTicks > 0`). Returns a shallow snapshot:
     * `{ fromTick, toTick, frames:[{tick, commands:{id:cmd}}] }`. Commands are referenced, not
     * deep-copied — treat them as read-only. Feed `frames` back through a deterministic sim to
     * reconstruct player motion.
     */
    getReplay() {
        return {
            fromTick: this.replay.length ? this.replay[0].tick : 0,
            toTick: this.replay.length ? this.replay[this.replay.length - 1].tick : 0,
            frames: this.replay.slice()
        };
    }

    /** Discard the recorded tape (e.g. on round start). */
    clearReplay() {
        this.replay.length = 0;
    }

    static _lerpState(a, b, f) {
        const out = { ...b }; // carry non-numeric / newer fields
        for (const k in a) {
            if (typeof a[k] === "number" && typeof b[k] === "number") out[k] = a[k] + (b[k] - a[k]) * f;
        }
        return out;
    }

    _sendSnapshots() {
        const entities = [];
        for (const [id, p] of this.players) {
            const s = p.entity.getState();
            s.id = id;
            // One-shot teleport flag: only the owning client reads its own state's resync; other
            // clients see it on a remote entity and harmlessly ignore the field.
            if (p._resync) {
                s.resync = true;
                p._resync = false;
            }
            entities.push(s);
        }
        for (const [id, entity] of this.objects) {
            const s = entity.getState();
            s.id = id;
            entities.push(s);
        }
        for (const [id, p] of this.players) {
            this.transport.sendTo(id, {
                type: "snap",
                serverTick: this.serverTick,
                ack: p.input.lastConsumedSeq,
                bufferHealth: p.input.health,
                entities
            });
        }
    }
}

// Empty default for a player who hasn't sent a command yet. The sim is game-agnostic — it never
// reads command fields (it passes the object straight to the entity's beginStep), so the "do
// nothing" command is simply an empty object. Entities must treat missing fields as zero/false.
ActionSimServer.ZERO_CMD = {};
