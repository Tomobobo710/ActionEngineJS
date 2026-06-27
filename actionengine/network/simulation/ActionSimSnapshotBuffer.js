// actionengine/network/simulation/ActionSimSnapshotBuffer.js
//
// Per-remote-entity state history on the CLIENT (the analog of SyncSystem's remoteData,
// but time-stamped so the render policy is swappable). The framework owns this generic
// buffering; the GAME owns what a remote looks like and applies sampled state to its avatar.
//
// Two render policies sample the same history:
//   latest()                -> newest received state (DIRECT APPLY: live, simplest)
//   interpolated(delayMs)   -> state ~delayMs in the past, lerped between two samples
//                              (the Quake/Source default; smooth under jitter/loss)
//
// `state` is an opaque object owned by the game (e.g. {x,y,z,yaw,...}); this buffer only
// touches the numeric fields it's told to interpolate (default: x,y,z and angle yaw).
class ActionSimSnapshotBuffer {
    constructor(opts = {}) {
        this.history = []; // [{ t, state }] ascending t (receive time, ms)
        this.maxAgeMs = opts.maxAgeMs || 1000;
        this.lerpKeys = opts.lerpKeys || ["x", "y", "z"]; // linearly interpolated fields
        this.angleKeys = opts.angleKeys || ["yaw"]; // shortest-arc interpolated fields
        // A sample carrying a truthy `cutKey` is an authoritative TELEPORT (respawn, kill-plane,
        // any host setState) — interpolation must NOT slide across it, or the entity is seen gliding
        // from its old spot to the new one. Defaults to the framework's `resync` flag (emitted by
        // ActionSimServer.markResync). Set to null to disable.
        this.cutKey = opts.cutKey !== undefined ? opts.cutKey : "resync";
    }

    /** Record a newly received authoritative state at time `t` (performance.now()). */
    push(t, state) {
        this.history.push({ t, state });
        while (this.history.length > 2 && t - this.history[0].t > this.maxAgeMs) this.history.shift();
    }

    /** Newest received state (direct-apply policy). */
    latest() {
        return this.history.length ? this.history[this.history.length - 1].state : null;
    }

    /** State `delayMs` in the past, interpolated between the two bracketing samples. */
    interpolated(renderTime) {
        const h = this.history;
        if (h.length === 0) return null;
        if (h.length === 1 || renderTime <= h[0].t) return h[0].state;
        const last = h[h.length - 1];
        if (renderTime >= last.t) return last.state;
        for (let i = 0; i < h.length - 1; i++) {
            const a = h[i];
            const b = h[i + 1];
            if (renderTime >= a.t && renderTime <= b.t) {
                // Don't interpolate INTO a teleport: hold the pre-teleport sample until render-time
                // reaches the teleport sample, then the next bracket [b,c] snaps us onto it. No glide.
                if (this.cutKey && b.state[this.cutKey]) return a.state;
                const f = (renderTime - a.t) / (b.t - a.t || 1);
                return this._blend(a.state, b.state, f);
            }
        }
        return last.state;
    }

    _blend(a, b, f) {
        const out = { ...b }; // carry non-numeric fields from the newer sample
        for (const k of this.lerpKeys) {
            if (typeof a[k] === "number" && typeof b[k] === "number") out[k] = a[k] + (b[k] - a[k]) * f;
        }
        for (const k of this.angleKeys) {
            if (typeof a[k] === "number" && typeof b[k] === "number") {
                let d = (b[k] - a[k]) % (Math.PI * 2);
                if (d > Math.PI) d -= Math.PI * 2;
                if (d < -Math.PI) d += Math.PI * 2;
                out[k] = a[k] + d * f;
            }
        }
        return out;
    }
}
