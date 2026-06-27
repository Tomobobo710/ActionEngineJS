// actionengine/network/simulation/ActionSimInputBuffer.js
//
// Per-client jitter buffer on the SERVER. Each client streams tick-stamped UserCommands
// (with a few backups per packet for loss tolerance). The server consumes one command per
// server tick, in order. This buffer:
//   - dedups commands by `seq` (so re-sent backups don't double-apply),
//   - hands out the next unconsumed command (FIFO),
//   - reports how many commands are waiting (`health`) so the client can steer its send
//     cadence toward the target lead (adaptive buffer).
//
// `seq` is the client's monotonic command number. The server doesn't align it to its own
// tick number; it consumes FIFO and acks the last consumed `seq`. The adaptive clock keeps
// the queue near the target depth (e.g. 5) despite independent client/server clocks.
class ActionSimInputBuffer {
    /**
     * @param {Object} [opts]
     * @param {number} [opts.maxBuffer] - hard cap on queued commands. This is a JITTER buffer,
     *        not a recording: if the consumer (the server) stalls — e.g. a backgrounded host
     *        tab whose loop paused while WebRTC kept delivering — commands must NOT pile up and
     *        later replay as authoritative truth. On overflow the OLDEST are dropped and the ack
     *        advanced past them, so the client retires them too (no replay on either side). The
     *        cap is the optionality knob: ~1 = no buffering (latest-wins), moderate = a shallow
     *        jitter buffer, Infinity = keep everything (replays on purpose). Default 12 — well
     *        above the adaptive clock's target lead (~5) so normal play never trims live input.
     */
    constructor(opts = {}) {
        this.queue = []; // commands waiting to be consumed, ascending seq
        this.lastReceivedSeq = -1; // highest seq we've ever accepted (dedup of backups)
        this.lastConsumedSeq = -1; // last seq handed to the simulation (= ack)
        this.lastConsumed = null; // retained so the server can repeat-on-starve
        this.maxBuffer = opts.maxBuffer || 12;
    }

    /** Accept one command (ignores duplicates/older backups). */
    push(cmd) {
        if (!cmd || cmd.seq === undefined) return;
        if (cmd.seq <= this.lastReceivedSeq) return; // already seen (a backup) or stale
        this.lastReceivedSeq = cmd.seq;
        this.queue.push(cmd);
        // Bounded jitter buffer: a stalled consumer must not hoard a backlog that replays later.
        // Drop the oldest and advance the ack so the client retires them instead of replaying.
        while (this.queue.length > this.maxBuffer) {
            const dropped = this.queue.shift();
            this.lastConsumedSeq = dropped.seq;
        }
    }

    /** Accept a batch (an input packet carrying the newest command + backups). */
    pushBatch(cmds) {
        if (!cmds) return;
        for (let i = 0; i < cmds.length; i++) this.push(cmds[i]);
    }

    /**
     * Consume the next command for this server tick. Returns null if starved (caller
     * should repeat `lastConsumed`). Updates the ack (`lastConsumedSeq`).
     */
    consume() {
        if (this.queue.length === 0) return null;
        const cmd = this.queue.shift();
        this.lastConsumedSeq = cmd.seq;
        this.lastConsumed = cmd;
        return cmd;
    }

    /** Commands still waiting (drives the client's adaptive lead). */
    get health() {
        return this.queue.length;
    }
}
