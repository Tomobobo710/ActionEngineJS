/**
 * DataConnection - Game Data Layer
 * 
 * Establishes a WebRTC data channel on top of a Peer connection.
 * Peer connection must be established first ('connect' event).
 * DataConnection then creates a second peer connection with its own data channel
 * and exchanges offer/answer through Peer's data channel.
 * 
 * USAGE:
 * ```javascript
 * peer.on('connect', () => {
 *   const connection = new DataConnection(signalingPeer);
 *   connection.on('connect', () => {
 *     connection.send({ type: 'greeting', text: 'hello' });
 *   });
 * });
 * ```
 */

class DataConnection {
    constructor(signalingPeer, options = {}) {
        this.signalingPeer = signalingPeer;
        this.pc = null;
        this.dataChannel = null;
        this.handlers = new Map();
        
        // Store peer IDs
        this.localPeerId = options.localPeerId;
        this.remotePeerId = options.remotePeerId;
        
        // Determine initiator: highest peer ID initiates
        this.isInitiator = options.localPeerId > options.remotePeerId;
        
        this.connected = false;
        this.ready = false;
        
        this._setup();
    }

    /**
     * Setup DataConnection protocol
     */
    _setup() {
        // Create RTCPeerConnection for game data channel
        this.pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });

        // Listen for ICE candidates and send through signaling peer
        this.pc.onicecandidate = (evt) => {
            if (evt.candidate) {
                this.signalingPeer.send(JSON.stringify({
                    type: 'channel-ice-candidate',
                    candidate: evt.candidate
                }));
            }
        };

        // Listen for remote data channel
        this.pc.ondatachannel = (evt) => {
            this.dataChannel = evt.channel;
            this._setupDataChannel();
        };

        // Listen for messages from signaling peer
        const onData = (data) => {
            try {
                const message = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString());
                
                // Handle DataConnection signaling messages
                if (message.type && message.type.startsWith('channel-')) {
                    this._handleSignaling(message);
                } else if (this.connected) {
                    // Once connected, relay application data
                    this.emit('data', message);
                }
            } catch (e) {
                console.warn('[DataConnection] Failed to parse signaling message:', e.message);
            }
        };

        this.signalingPeer.on('data', onData);

        // Start negotiation once signaling peer's data channel is open
        const startNegotiation = () => {
            if (this.isInitiator) {
                this._createOffer();
            }
        };

        // Check if data channel is already open
        if (this.signalingPeer.dataChannel && this.signalingPeer.dataChannel.readyState === 'open') {
            startNegotiation();
        } else if (this.signalingPeer.dataChannel) {
            // Data channel exists but not open yet, wait for it
            this.signalingPeer.dataChannel.onopen = startNegotiation;
        } else {
            // Data channel doesn't exist yet (responder), wait for it to be created
            const originalOndatachannel = this.signalingPeer.pc.ondatachannel;
            this.signalingPeer.pc.ondatachannel = (evt) => {
                if (originalOndatachannel) originalOndatachannel(evt);
                evt.channel.onopen = startNegotiation;
            };
        }
    }

    /**
     * Create and send offer
     */
    async _createOffer() {
        try {
            // Create data channel
            const channel = this.pc.createDataChannel('game', { ordered: true });
            this.dataChannel = channel;
            this._setupDataChannel();

            // Create offer
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);

            // Send offer through signaling peer
            this.signalingPeer.send(JSON.stringify({
                type: 'channel-offer',
                sdp: this.pc.localDescription.sdp
            }));

            this.ready = true;
        } catch (e) {
            this.emit('error', e);
        }
    }

    /**
     * Handle signaling messages
     */
    async _handleSignaling(message) {
        try {
            if (message.type === 'channel-offer') {
                // Responder receives offer
                await this.pc.setRemoteDescription({ type: 'offer', sdp: message.sdp });
                const answer = await this.pc.createAnswer();
                await this.pc.setLocalDescription(answer);

                this.signalingPeer.send(JSON.stringify({
                    type: 'channel-answer',
                    sdp: this.pc.localDescription.sdp
                }));

                this.ready = true;
            } 
            else if (message.type === 'channel-answer') {
                // Initiator receives answer
                await this.pc.setRemoteDescription({ type: 'answer', sdp: message.sdp });
            } 
            else if (message.type === 'channel-ice-candidate') {
                // Add ICE candidate
                try {
                    await this.pc.addIceCandidate(new RTCIceCandidate(message.candidate));
                } catch (e) {
                    // ICE errors are non-fatal (candidates arrive out of order)
                    console.debug('[DataConnection] ICE candidate error (non-fatal):', e.message);
                }
            }
        } catch (e) {
            this.emit('error', e);
        }
    }

    /**
     * Setup data channel handlers
     */
    _setupDataChannel() {
        this.dataChannel.onopen = () => {
            this.connected = true;
            this.emit('connect');
        };

        this.dataChannel.onclose = () => {
            this.connected = false;
            this.emit('close');
        };

        this.dataChannel.onerror = (evt) => {
            this.emit('error', evt.error);
        };

        this.dataChannel.onmessage = (evt) => {
            try {
                const message = JSON.parse(evt.data);
                this.emit('data', message);
            } catch (e) {
                // Non-JSON messages are ignored
            }
        };
    }

    /**
     * Send a message through the data channel
     */
    send(message) {
        if (!this.connected || !this.dataChannel || this.dataChannel.readyState !== 'open') {
            return false;
        }

        try {
            this.dataChannel.send(JSON.stringify(message));
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Event handling
     */
    on(event, handler) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, []);
        }
        this.handlers.get(event).push(handler);
    }

    emit(event, ...args) {
        if (!this.handlers.has(event)) return;
        for (const handler of this.handlers.get(event)) {
            try {
                handler(...args);
            } catch (e) {
                // Silently fail
            }
        }
    }

    /**
     * Cleanup
     */
    close() {
        if (this.dataChannel) {
            this.dataChannel.close();
        }
        if (this.pc) {
            this.pc.close();
        }
        this.connected = false;
    }
}
