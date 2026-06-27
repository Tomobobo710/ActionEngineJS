// actionengine/network/simulation/ActionSimP2PTransport.js
//
// Transport adapter: the ActionSim framework talks to the network only through this thin
// interface, so it stays transport-agnostic (this wraps ActionNetManagerP2P; a WebSocket
// or loopback variant can implement the same shape).
//
// Interface every transport provides:
//   localId              -> this client's stable id
//   isHost()             -> are we the authoritative host?
//   broadcast(msg)       -> send to all peers
//   sendTo(peerId, msg)  -> send to one peer
//   on(type, fn)         -> register a handler fn(msg, fromPeerId) for msg.type
//
// Messages are plain JSON-able objects with a `type` field. Incoming messages are tagged
// by the manager with `fromPeerId`.
class ActionSimP2PTransport {
    constructor(netManager) {
        this.nm = netManager;
        this._handlers = new Map(); // type -> fn(msg, fromPeerId)

        // ActionNetManagerP2P emits "message" for every custom (non-syncUpdate) message,
        // with fromPeerId attached. Dispatch by type to our handlers. Stored so destroy() can
        // unsubscribe (leaving a room must not leave a stale session bound to the net manager).
        this._onMessage = (msg) => {
            if (!msg || !msg.type) return;
            const fn = this._handlers.get(msg.type);
            if (fn) fn(msg, msg.fromPeerId);
        };
        this.nm.on("message", this._onMessage);
    }

    /** Unsubscribe from the net manager. Call when tearing down a session. */
    destroy() {
        if (this._onMessage && this.nm.off) this.nm.off("message", this._onMessage);
        this._handlers.clear();
    }

    get localId() {
        return this.nm.peerId;
    }

    isHost() {
        return this.nm.isCurrentUserHost();
    }

    broadcast(msg) {
        this.nm.send(msg);
    }

    sendTo(peerId, msg) {
        // Never send to ourselves over P2P — there's no data channel to self, so it just fails
        // and (on a host, which is also a player) spams "channel not open" every tick. When the
        // host is server+client, its own copy is delivered via the paired loopback transport.
        if (peerId === this.nm.peerId) return;
        this.nm.send(msg, peerId);
    }

    on(type, fn) {
        this._handlers.set(type, fn);
    }

    /** Round-trip time to the host in ms (0 if unmeasured). Lets the sim size its prediction
     *  runahead from real latency without knowing anything about the underlying network. */
    getRtt() {
        return this.nm && this.nm.getRTT ? this.nm.getRTT() : 0;
    }
}
