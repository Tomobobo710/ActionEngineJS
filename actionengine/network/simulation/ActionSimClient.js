// actionengine/network/simulation/ActionSimClient.js
//
// Client-side prediction + server reconciliation (every client, host included). Game-agnostic.
//
// Each tick: sample a UserCommand (game hook), predict it on the local entity in the
// CLIENT'S OWN world (injected `stepWorld`), buffer it, and send it to the server with a
// few backups for loss tolerance. On each snapshot: reconcile the local entity (snap to
// authoritative MOVEMENT state, then replay un-acked commands), and relay remote entities'
// states to the game (which owns the avatars). An adaptive clock keeps the server's input
// buffer near a target depth despite independent client/server clocks.
//
// Aim is client-owned and lives in the GAME (folded into each command's yaw/pitch); the
// framework never reads or reconciles it.
class ActionSimClient {
    /**
     * @param {Object} opts
     * @param {Object}   opts.transport      - broadcast(msg)/sendTo/on(type,fn)
     * @param {string}   opts.localId         - this client's own player id
     * @param {Object}   opts.localEntity     - {beginStep,endStep,getState,setState}
     * @param {Function} opts.stepWorld       - (dt) => advance THIS client's prediction world
     * @param {Function} opts.sampleCommand   - () => a serializable UserCommand (input + aim)
     * @param {Function} [opts.onRemoteState] - (id, state) => game applies state to its avatar
     * @param {string}   [opts.renderPolicy]  - 'latest' (direct apply) | 'interpolated'
     * @param {number}   [opts.interpDelayMs] - history delay for 'interpolated' (default 100)
     * @param {number}   [opts.targetBuffer]  - desired server-side buffer depth (default 5)
     * @param {number}   [opts.backups]       - commands resent per packet (default 5)
     */
    constructor(opts) {
        this.transport = opts.transport;
        this.localId = opts.localId;
        this.localEntity = opts.localEntity;
        this.stepWorld = opts.stepWorld;
        this.sampleCommand = opts.sampleCommand;
        this.onRemoteState = opts.onRemoteState || (() => {});
        // Called on reconcile with the LOCAL player's full authoritative state — for fields the
        // client doesn't predict (game-defined, e.g. server-owned status). Movement is still
        // applied via setState.
        this.onLocalState = opts.onLocalState || null;
        this.renderPolicy = opts.renderPolicy || "latest";
        this.interpDelayMs = opts.interpDelayMs || 100;
        // Per-remote snapshot-buffer options (which fields lerp / shortest-arc). Opt-in; the
        // buffer's own defaults (x,y,z + yaw) apply when omitted. Lets a game add fields like
        // pitch/width to the interpolation without the framework knowing the state shape.
        this.bufferOpts = opts.bufferOpts || {};
        this.targetBuffer = opts.targetBuffer || 5;
        this.backups = opts.backups || 5;

        // Dynamic runahead (opt-in). When set AND the transport reports RTT (transport.getRtt),
        // the target server-buffer depth tracks one-way latency each tick instead of staying fixed:
        // targetBuffer = clamp(round((rtt/2)/tickMs) + margin, min, max). A LAN client then runs a
        // shallow buffer (less input lag); a distant one deepens it (fewer starves). The adaptive
        // cadence already steers the real buffer toward targetBuffer — we just move the target.
        //   opts.runahead = { margin=2, min=2, max=16 }
        this.runahead = opts.runahead || null;
        this.rttMs = 0; // last RTT we sized the runahead from (exposed for HUD/diagnostics)

        // Desync thresholds. Normal reconciliation replays un-acked commands across a SMALL
        // error. When any of these trip, replaying is impossible or pointless, so the client
        // re-baselines to authority instead — one honest snap (see _reconcile/_resync).
        // Tunable by feel; defaults assume a 60Hz-floor client (we don't reconcile across a
        // chronically-slow client — those are out of scope by design).
        this.resyncGapMs = opts.resyncGapMs || 500; // real wall-time between ticks ⇒ a freeze (tab background, sleep, stall)
        this.resyncTickGap = opts.resyncTickGap || 64; // server tick leapt past our replay window
        this.resyncErrorDist = opts.resyncErrorDist || 60; // predicted-vs-authoritative position gap (a few player-widths)
        this._lastTickWall = 0; // performance.now() at the previous tick — measures real elapsed time
        this._freezeResync = false; // a freeze was detected; consume it on the next snapshot

        this.cmdSeq = 0;
        this.serverTick = 0; // latest server tick we've heard about (the "view time" for lag comp)
        this.pending = []; // unacked commands (for reconciliation replay)
        // cmd.seq -> {x,y,z} we PREDICTED right after applying that command. Lets reconciliation compare
        // authority-at-a-tick against our prediction-FOR-that-tick (true misprediction) instead of
        // predicted-present vs authority-past (which grows with velocity×latency and false-snaps fast movers).
        this._predictedAt = new Map();
        this.remotes = new Map(); // id -> ActionSimSnapshotBuffer

        // Client-simulated objects (e.g. physics props): entities the client predicts as REAL bodies
        // in its own world and rolls back to authority on each snapshot, then carries forward in the
        // SAME resim as the local player — so pushing one is predicted locally instead of waiting a
        // full round-trip. Game-agnostic: the game classifies snapshot entities with predictObject(s)
        // and builds the body on first sighting with createPredicted(id, s) (returning a {setState}
        // adapter). Inert (props stay plain interp-rendered remotes) unless predictObject is supplied.
        this.predicted = new Map(); // id -> { setState(state) }
        this.predictObject = opts.predictObject || null;
        this.createPredicted = opts.createPredicted || null;
        // Called when an object that WAS predicted should stop being predicted (predictObject flipped
        // to false — e.g. a prop another player just grabbed, which we now interpolate instead). The
        // game tears down the predicted body; the object then flows through onRemoteState (interp).
        this.releasePredicted = opts.releasePredicted || null;

        this._dt = 1 / 60;

        // Adaptive clock: produce ~1 command/tick, nudged to hold the server buffer at target.
        this._cadence = 1;
        this._cadenceAccum = 0;

        this.transport.on("snap", (msg) => this._onSnapshot(msg));
    }

    setLocalId(id) {
        this.localId = id;
    }

    /** Advance one prediction tick. Call from action_fixed_update. */
    tick(dt) {
        // Detect a time discontinuity: the fixed loop was frozen far longer than a step (tab
        // backgrounded, machine slept, long stall). The engine clamps the catch-up so we don't
        // spiral, but we still must NOT predict across the gap — flag a re-baseline that the
        // next snapshot consumes. Fires on the FIRST of the catch-up ticks only; the rest run
        // normally. A hard wall-clock threshold (not a multiple of dt) so a merely-slow client
        // never trips it.
        const wall = performance.now();
        if (this._lastTickWall && wall - this._lastTickWall > this.resyncGapMs) this._freezeResync = true;
        this._lastTickWall = wall;

        this._dt = dt;
        this._updateRunahead(); // re-size the target buffer from current RTT (no-op unless opted in)
        this._cadenceAccum += this._cadence;
        // Normally exactly one command per tick; occasionally 0 or 2 to correct long-term
        // clock drift toward the target buffer depth.
        while (this._cadenceAccum >= 1) {
            this._cadenceAccum -= 1;
            this._produceCommand(dt);
        }
    }

    _produceCommand(dt) {
        const cmd = this.sampleCommand();
        cmd.seq = ++this.cmdSeq;
        this._applyCommand(cmd, dt); // predict locally
        this.pending.push(cmd);
        this._recordPredicted(cmd.seq); // remember where we predicted we'd be after this command
        if (this.pending.length > 256) {
            const dropped = this.pending.shift();
            if (dropped) this._predictedAt.delete(dropped.seq);
        }

        // Send newest + backups so a single lost packet self-heals.
        const start = Math.max(0, this.pending.length - this.backups);
        this.transport.broadcast({ type: "cmd", cmds: this.pending.slice(start) });
    }

    _applyCommand(cmd, dt) {
        this.localEntity.beginStep(cmd, dt);
        this.stepWorld(dt);
        this.localEntity.endStep(dt);
    }

    /** Re-size the target server-buffer depth from the transport's RTT (dynamic runahead). No-op
     *  unless opts.runahead was given and the transport reports getRtt(). Keeps the prediction lead
     *  matched to latency: just enough commands queued to cover the one-way trip, plus a margin. */
    _updateRunahead() {
        if (!this.runahead || !this.transport.getRtt) return;
        const rtt = this.transport.getRtt() || 0;
        this.rttMs = rtt;
        const tickMs = (this._dt || 1 / 60) * 1000;
        const oneWayTicks = rtt / 2 / tickMs; // commands must lead the server by ~one trip out
        const margin = this.runahead.margin !== undefined ? this.runahead.margin : 2;
        const lo = this.runahead.min !== undefined ? this.runahead.min : 2;
        const hi = this.runahead.max !== undefined ? this.runahead.max : 16;
        this.targetBuffer = Math.max(lo, Math.min(hi, Math.round(oneWayTicks) + margin));
    }

    _onSnapshot(msg) {
        if (!msg || !msg.entities) return;

        // Server tick leapt past our replay window (a packet-loss burst, or snapshots that
        // queued during a freeze and burst-delivered on resume): re-baseline rather than
        // replay a gap we can't cover.
        let tickJump = false;
        if (msg.serverTick !== undefined) {
            if (this.serverTick && msg.serverTick - this.serverTick > this.resyncTickGap) tickJump = true;
            this.serverTick = msg.serverTick;
        }
        const forceResync = this._freezeResync || tickJump;
        this._freezeResync = false;

        // Adaptive: steer command cadence toward holding the server buffer at target.
        if (msg.bufferHealth !== undefined) {
            const err = this.targetBuffer - msg.bufferHealth; // >0 starving -> speed up
            this._cadence = Math.max(0.85, Math.min(1.15, 1 + err * 0.02));
        }

        const now = performance.now();
        // Split the snapshot: our own entity (reconciled), client-simulated objects (rolled back +
        // resimmed with us), and everyone else (interp-buffered for render). Predicted objects are
        // lazily created on first sighting via the game's factory.
        let localState = null;
        const predStates = this.predictObject ? [] : null;
        for (const e of msg.entities) {
            if (e.id === this.localId) {
                localState = e;
            } else if (this.predictObject && this.predictObject(e)) {
                // Should be predicted. Create it if new; if it was being interpolated (ownership just
                // returned to us / went free), stop interpolating and hand it to prediction.
                if (this.predicted.has(e.id)) {
                    predStates.push(e);
                } else if (this.createPredicted) {
                    this.remotes.delete(e.id);
                    const ent = this.createPredicted(e.id, e);
                    if (ent) {
                        this.predicted.set(e.id, ent);
                        predStates.push(e);
                    }
                }
            } else {
                // Should be interpolated. If it WAS predicted (e.g. a prop another player just
                // grabbed), tear down the predicted body and fall through to the interp buffer.
                if (this.predicted.has(e.id)) {
                    this.predicted.delete(e.id);
                    if (this.releasePredicted) this.releasePredicted(e.id);
                }
                let buf = this.remotes.get(e.id);
                if (!buf) {
                    buf = new ActionSimSnapshotBuffer(this.bufferOpts);
                    this.remotes.set(e.id, buf);
                }
                buf.push(now, e);
            }
        }
        if (localState) {
            this._reconcile(localState, msg.ack, forceResync, predStates);
        } else if (predStates && predStates.length) {
            // No local entity in this snapshot (rare) — still correct predicted objects to authority.
            this._applyPredicted(predStates);
        }
    }

    _reconcile(authState, ack, forceResync, predStates) {
        // Decide reconcile vs. re-baseline. A desync is anything where replaying un-acked commands is
        // impossible or pointless: a freeze/tick-jump (forceResync), a server-flagged teleport
        // (authState.resync — respawn, kill-plane, any host-side reposition), or a genuine misprediction
        // too large to replay across. The misprediction is measured AT THE ACKED TICK — authority@ack vs
        // what we predicted FOR ack — NOT predicted-present vs authority-past. The latter conflates real
        // error with velocity×latency, so it false-snaps fast/big/distant movers on high-latency links.
        const drift = this._driftAt(ack, authState); // null when unmeasurable (no ack / no record)
        const desync = forceResync || authState.resync === true || (drift !== null && drift > this.resyncErrorDist);
        if (desync) {
            this._resync(authState, predStates);
            return;
        }
        // Normal reconcile: snap to authoritative MOVEMENT state (setState ignores aim — client
        // owns it), surface non-predicted game fields, drop acked commands, replay the rest to
        // reach the predicted present.
        this.localEntity.setState(authState);
        if (this.onLocalState) this.onLocalState(authState);
        // Roll client-simulated objects back to this snapshot's authority BEFORE the resim, so the
        // replayed commands below carry both the player AND the props forward together (the local
        // push is reproduced; props nobody touched just coast back to where they were).
        this._applyPredicted(predStates);
        if (ack !== undefined) {
            this.pending = this.pending.filter((c) => c.seq > ack);
            // Acked predictions are spent; only seq > ack still matter (re-recorded in the resim below).
            for (const seq of this._predictedAt.keys()) if (seq <= ack) this._predictedAt.delete(seq);
        }
        // Resimulate un-acked commands to reach the predicted present (rollback-and-resim — NOT a
        // game "replay"). Bracket with begin/endResim (opt-in, duck-typed) so entities can tell live
        // prediction from resim — e.g. suppress render-only view-displacement that would otherwise be
        // re-counted every snapshot. Re-record each prediction off the new authoritative baseline so the
        // next snapshot's at-tick comparison is against current predictions, not stale ones.
        if (this.localEntity.beginResim) this.localEntity.beginResim();
        for (const c of this.pending) {
            this._applyCommand(c, this._dt);
            this._recordPredicted(c.seq);
        }
        if (this.localEntity.endResim) this.localEntity.endResim();
    }

    /**
     * Re-baseline to authority: adopt the authoritative state wholesale, discard ALL pending
     * prediction, and DON'T replay. This is the snap — honest and intentional. Used whenever
     * the gap to authority is too large or discontinuous to reconcile across (freeze, tick
     * jump, server teleport, large drift). No render smoothing: a snap is a snap.
     */
    _resync(authState, predStates) {
        this.localEntity.setState(authState);
        if (this.onLocalState) this.onLocalState(authState);
        this._applyPredicted(predStates); // adopt authoritative prop state too (no resim to carry it forward)
        this.pending = [];
        this._predictedAt.clear(); // discarded all prediction — its recorded positions are meaningless now
    }

    /** Roll each client-simulated object back to its authoritative snapshot state. Called at the
     *  reconcile/resync baseline so the resim (or the snap) starts props from authority. */
    _applyPredicted(predStates) {
        if (!predStates) return;
        for (const s of predStates) {
            const ent = this.predicted.get(s.id);
            if (ent && ent.setState) ent.setState(s);
        }
    }

    /** Register/forget a client-simulated object (the game usually does this via createPredicted). */
    addPredicted(id, entity) {
        this.predicted.set(id, entity);
    }
    removePredicted(id) {
        this.predicted.delete(id);
    }

    /** Record the position we predicted right after command `seq`, keyed by seq, so reconciliation can
     *  later compare it against authority at that same tick. Positional only — no game knowledge. */
    _recordPredicted(seq) {
        const s = this.localEntity.getState();
        if (s && s.x !== undefined) this._predictedAt.set(seq, { x: s.x, y: s.y || 0, z: s.z || 0 });
    }

    /** Misprediction at the acked tick: distance between authority@ack and the position we predicted
     *  FOR ack. Returns null when unmeasurable (no ack, or no prediction recorded for it) — the caller
     *  then skips the distance gate and relies on the explicit resync signals only. */
    _driftAt(ack, authState) {
        if (ack === undefined || !authState || authState.x === undefined) return null;
        const p = this._predictedAt.get(ack);
        if (!p) return null;
        const dx = p.x - authState.x;
        const dy = p.y - (authState.y || 0);
        const dz = p.z - (authState.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /** Push current remote states to the game (call once per render frame). */
    sampleRemotes() {
        const renderTime = performance.now() - this.interpDelayMs;
        for (const [id, buf] of this.remotes) {
            const s = this.renderPolicy === "interpolated" ? buf.interpolated(renderTime) : buf.latest();
            if (s) this.onRemoteState(id, s);
        }
    }

    /**
     * Invoke cb(id, latestState) for each known remote's most recent authoritative state.
     * For games that maintain COLLIDABLE GHOSTS of remote entities (props, other players) in
     * their prediction world: call this each fixed tick BEFORE tick() to reposition those
     * ghosts, so the local prediction collides against current authoritative positions. This
     * is the always-latest state (no interp delay) — prediction wants the freshest truth,
     * unlike render (sampleRemotes), which may interpolate.
     */
    eachRemoteLatest(cb) {
        for (const [id, buf] of this.remotes) {
            const s = buf.latest();
            if (s) cb(id, s);
        }
    }

    /**
     * The server tick the client is CURRENTLY RENDERING — what lag-comp must rewind to so an
     * authoritative hit test reproduces what the shooter saw. With the 'latest' policy that's the
     * newest tick; with 'interpolated' we render `interpDelayMs` in the past, so back the tick off
     * by that delay. Keeps hit registration matched to the screen instead of to the freshest packet.
     */
    renderViewTick() {
        if (this.renderPolicy !== "interpolated") return this.serverTick;
        const ticks = Math.round(this.interpDelayMs / 1000 / (this._dt || 1 / 60));
        return Math.max(0, this.serverTick - ticks);
    }

    removeRemote(id) {
        this.remotes.delete(id);
    }

    getRemoteIds() {
        return Array.from(this.remotes.keys());
    }
}
