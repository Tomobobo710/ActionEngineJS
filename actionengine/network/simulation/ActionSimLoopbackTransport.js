// actionengine/network/simulation/ActionSimLoopbackTransport.js
//
// In-process transport so the HOST's client talks to the host's server with zero latency
// through the EXACT same ActionSimClient code path a remote guest uses. A paired endpoint
// delivers messages synchronously to the other end, tagging the sender's id as fromPeerId.
//
// ActionSimCompositeTransport lets the server fan its broadcast/handlers across several
// transports at once (the P2P link to guests + the loopback to the host's own client).
class ActionSimLoopbackTransport {
    constructor(localId, remoteId) {
        this.localId = localId;
        this._remoteId = remoteId; // the id of the endpoint on the other side
        this._handlers = new Map();
        this._other = null;
    }

    /** Create a connected pair: [serverEnd, clientEnd]. */
    static pair(serverId, clientId) {
        const serverEnd = new ActionSimLoopbackTransport(serverId, clientId);
        const clientEnd = new ActionSimLoopbackTransport(clientId, serverId);
        serverEnd._other = clientEnd;
        clientEnd._other = serverEnd;
        return [serverEnd, clientEnd];
    }

    isHost() {
        return false;
    }

    _deliver(msg) {
        if (!msg || !msg.type) return;
        const fn = this._handlers.get(msg.type);
        if (fn) fn(msg, this._remoteId); // fromPeerId = whoever sent it (the other end)
    }

    broadcast(msg) {
        if (this._other) this._other._deliver(msg);
    }

    sendTo(peerId, msg) {
        // Only one peer on a loopback: deliver if it's addressed to that peer (or broadcast-ish).
        if (this._other && (peerId === undefined || peerId === this._other.localId)) this._other._deliver(msg);
    }

    on(type, fn) {
        this._handlers.set(type, fn);
    }

    /** In-process: the host's own client reaches its server with zero latency, so its runahead
     *  should collapse to the minimum. */
    getRtt() {
        return 0;
    }
}

class ActionSimCompositeTransport {
    constructor(transports) {
        this.transports = transports; // e.g. [p2pTransport, loopbackServerEnd]
    }

    get localId() {
        return this.transports.length ? this.transports[0].localId : null;
    }

    isHost() {
        return true;
    }

    broadcast(msg) {
        for (const t of this.transports) t.broadcast(msg);
    }

    sendTo(peerId, msg) {
        // Each transport routes to its own peer if it has it; others no-op.
        for (const t of this.transports) t.sendTo(peerId, msg);
    }

    on(type, fn) {
        for (const t of this.transports) t.on(type, fn);
    }
}
