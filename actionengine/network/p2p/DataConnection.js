/**
 * DataConnection - App Data Layer
 * 
 * Standalone RTCPeerConnection for app data negotiation.
 * Receives offer/answer/ICE candidates via signal() method.
 * Emits 'data' events when data channel receives messages.
 * 
 * USAGE:
 * ```javascript
 * const connection = new DataConnection({
 *   localPeerId: 'peer1',
 *   remotePeerId: 'peer2'
 * });
 * 
 * // Handle tracker messages
 * connection.signal(offerFromTracker);
 * connection.signal(answerFromTracker);
 * connection.signal(iceCandidate);
 * 
 * connection.on('connect', () => {
 *   connection.send({ type: 'greeting' });
 * });
 * ```
 */

class DataConnection {
    constructor(options = {}) {
        this.pc = null;
        this.dataChannel = null;
        this.handlers = new Map();
        
        // Store peer IDs
        this.localPeerId = options.localPeerId;
        this.remotePeerId = options.remotePeerId;
        
        // Store ICE servers
        this.iceServers = options.iceServers || [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ];
        
        // Determine initiator: either explicitly set or by peer ID comparison
        if (options.initiator !== undefined) {
            this.isInitiator = options.initiator;
        } else {
            this.isInitiator = options.localPeerId > options.remotePeerId;
        }
        
        this.connected = false;
        this.ready = false;
        
        this._setup();
    }

    /**
     * Setup DataConnection with standalone RTCPeerConnection
     */
    _setup() {
        // Create RTCPeerConnection for app data channel
        this.pc = new RTCPeerConnection({
            iceServers: this.iceServers
        });

        // Listen for ICE candidates
        this.pc.onicecandidate = (evt) => {
            if (evt.candidate) {
                // Emit ICE candidate so caller can relay it
                this.emit('signal', {
                    type: 'ice-candidate',
                    candidate: evt.candidate
                });
            }
        };

        // Listen for remote data channel
        this.pc.ondatachannel = (evt) => {
            this.dataChannel = evt.channel;
            this._setupDataChannel();
        };

        // If initiator, create offer
        if (this.isInitiator) {
            this._createOffer();
        }
    }

    /**
     * Create and send offer
     */
    async _createOffer() {
        try {
            // Create data channel
            const channel = this.pc.createDataChannel('app', { ordered: true });
            this.dataChannel = channel;
            this._setupDataChannel();

            // Create offer
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);

            // Wait for ICE gathering to complete
            await new Promise((resolve) => {
                if (this.pc.iceGatheringState === 'complete') {
                    resolve();
                    return;
                }
                
                const checkComplete = () => {
                    if (this.pc.iceGatheringState === 'complete') {
                        this.pc.removeEventListener('icegatheringstatechange', checkComplete);
                        resolve();
                    }
                };
                
                this.pc.addEventListener('icegatheringstatechange', checkComplete);
                
                // Fallback timeout
                setTimeout(() => {
                    this.pc.removeEventListener('icegatheringstatechange', checkComplete);
                    resolve();
                }, 3000);
            });

            // Emit offer
            this.emit('signal', {
                type: 'offer',
                sdp: this.pc.localDescription.sdp
            });

            this.ready = true;
        } catch (e) {
            this.emit('error', e);
        }
    }

    /**
     * Handle incoming offer/answer/ICE from caller
     */
    signal(data) {
        if (!this.pc) return;

        if (data.type === 'offer') {
            // Responder receives offer
            this._handleOffer(data);
        } else if (data.type === 'answer') {
            // Initiator receives answer
            this.pc.setRemoteDescription({ type: 'answer', sdp: data.sdp })
                .catch((error) => {
                    this.emit('error', new Error(`Failed to set remote answer: ${error.message}`));
                });
        } else if (data.candidate) {
            // ICE candidate
            this.pc.addIceCandidate(new RTCIceCandidate(data.candidate))
                .catch((e) => {
                    console.debug('[DataConnection] ICE candidate error (non-fatal):', e.message);
                });
        }
    }

    /**
     * Handle incoming offer (responder side)
     */
    async _handleOffer(data) {
        try {
            await this.pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
            
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            
            // Wait for ICE gathering to complete
            await new Promise((resolve) => {
                if (this.pc.iceGatheringState === 'complete') {
                    resolve();
                    return;
                }
                
                const checkComplete = () => {
                    if (this.pc.iceGatheringState === 'complete') {
                        this.pc.removeEventListener('icegatheringstatechange', checkComplete);
                        resolve();
                    }
                };
                
                this.pc.addEventListener('icegatheringstatechange', checkComplete);
                
                // Fallback timeout
                setTimeout(() => {
                    this.pc.removeEventListener('icegatheringstatechange', checkComplete);
                    resolve();
                }, 3000);
            });
            
            // Emit answer
            this.emit('signal', {
                type: 'answer',
                sdp: this.pc.localDescription.sdp
            });

            this.ready = true;
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
                console.error(`[DataConnection] Error in ${event} handler:`, e);
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
