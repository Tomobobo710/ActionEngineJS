/**
 * ActionNetPeer - Wrapper around DataConnection
 * 
 * Simple facade that wraps DataConnection and delegates all interface calls.
 * Exists for compatibility and to handle tracker signaling via signal() method.
 */

class ActionNetPeer {
    constructor(opts = {}) {
        this.opts = {
            initiator: opts.initiator || false,
            trickle: opts.trickle !== false,
            iceServers: opts.iceServers || [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ],
            ...opts
        };

        // Peer IDs for initiator determination
        this.localPeerId = opts.localPeerId || 'local';
        this.remotePeerId = opts.remotePeerId || 'remote';

        // Create internal DataConnection (the actual RTCPeerConnection)
        this.connection = new DataConnection({
            localPeerId: this.localPeerId,
            remotePeerId: this.remotePeerId,
            iceServers: this.opts.iceServers,
            initiator: opts.initiator
        });

        // Expose DataConnection's pc directly
        this.pc = this.connection.pc;
        this.dataChannel = this.connection.dataChannel;

        // State
        this.destroyed = false;
        this.connected = false;
        this.handlers = new Map();
        this.readyState = 'new';
        
        // Delegate DataConnection events
        this.connection.on('connect', () => {
            this.connected = true;
            this.readyState = 'connected';
            this.emit('connect');
        });

        this.connection.on('error', (err) => {
            this.emit('error', err);
        });

        this.connection.on('close', () => {
            this.connected = false;
            this.readyState = 'closed';
            this.emit('close');
        });

        this.connection.on('data', (data) => {
            this.emit('data', data);
        });

        this.connection.on('signal', (msg) => {
            // Relay DataConnection's signaling messages (offer/answer/ICE)
            this.emit('signal', msg);
        });
    }

    /**
     * Handle tracker offer/answer/ICE candidates
     */
    signal(data) {
        if (!this.connection) return;
        this.connection.signal(data);
    }

    /**
     * Send data through DataConnection
     */
    send(data) {
        if (!this.connection) return false;
        return this.connection.send(typeof data === 'string' ? JSON.parse(data) : data);
    }

    /**
     * Event handlers
     */
    on(event, handler) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, []);
        }
        this.handlers.get(event).push(handler);
    }

    once(event, handler) {
        const wrapper = (...args) => {
            handler(...args);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }

    off(event, handler) {
        if (!this.handlers.has(event)) return;
        const handlers = this.handlers.get(event);
        const index = handlers.indexOf(handler);
        if (index !== -1) {
            handlers.splice(index, 1);
        }
    }

    emit(event, ...args) {
        if (!this.handlers.has(event)) return;
        for (const handler of this.handlers.get(event)) {
            try {
                handler(...args);
            } catch (e) {
                console.error(`Error in ${event} handler:`, e);
            }
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.destroyed) return;
        
        this.destroyed = true;
        this.connected = false;
        
        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }
        
        this.pc = null;
        this.dataChannel = null;
        this.handlers.clear();
    }
}
