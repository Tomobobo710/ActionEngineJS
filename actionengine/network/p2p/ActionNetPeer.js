/**
 * ActionNetPeer - WebRTC Peer Connection Wrapper
 * 
 * Provides a simple interface for creating and managing WebRTC peer connections.
 * Handles offer/answer exchange, ICE candidates, and data channels.
 */

class ActionNetPeer {
    constructor(opts = {}) {
        this.opts = {
            initiator: opts.initiator || false,
            trickle: opts.trickle !== false,  // Default true for trickling ICE
            iceServers: opts.iceServers || [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ],
            ...opts
        };

        this.pc = null;
        this.dataChannel = null;
        this.destroyed = false;
        this.connected = false;
        this.handlers = new Map();
        this.pendingIceCandidates = [];
        this.readyState = 'new'; // new, connecting, connected, closed
        
        this._init();
    }

    /**
     * Initialize RTCPeerConnection
     */
    _init() {
        try {
            this.pc = new RTCPeerConnection({
                iceServers: this.opts.iceServers
            });

            // ICE candidate handling
            this.pc.onicecandidate = (evt) => {
                if (evt.candidate) {
                    if (this.opts.trickle) {
                        // Emit each candidate as it arrives
                        this.emit('signal', evt.candidate);
                    } else {
                        // Queue for sending after complete
                        this.pendingIceCandidates.push(evt.candidate);
                    }
                } else {
                    // ICE gathering complete
                    if (!this.opts.trickle && this.pendingIceCandidates.length > 0) {
                        // All candidates ready, emit them
                        this.pendingIceCandidates = [];
                    }
                }
            };

            // Connection state changes
            this.pc.onconnectionstatechange = () => {
                this.readyState = this.pc.connectionState;
                if (this.pc.connectionState === 'failed') {
                    this.emit('error', new Error('Connection failed'));
                } else if (this.pc.connectionState === 'closed') {
                    this.emit('close');
                }
            };

            // ICE connection state (more reliable than connection state)
            this.pc.oniceconnectionstatechange = () => {
                console.log(`[Peer] ICE state change: ${this.pc.iceConnectionState}`);
                if (this.pc.iceConnectionState === 'connected' || 
                    this.pc.iceConnectionState === 'completed') {
                    if (!this.connected) {
                        console.log('[Peer] ICE connected, emitting connect event');
                        this.connected = true;
                        this.readyState = 'connected';
                        this.emit('connect');
                    }
                } else if (this.pc.iceConnectionState === 'failed') {
                    console.error('[Peer] ICE connection failed');
                    this.emit('error', new Error('ICE connection failed'));
                } else if (this.pc.iceConnectionState === 'disconnected' || 
                           this.pc.iceConnectionState === 'closed') {
                    console.log('[Peer] ICE disconnected/closed');
                    this.connected = false;
                    this.readyState = 'closed';
                }
            };

            // Handle remote data channel (for responder)
            this.pc.ondatachannel = (evt) => {
                this.dataChannel = evt.channel;
                this._setupDataChannel();
            };

            // Create default data channel for signaling
            // This is used by DataConnection layer to negotiate the secondary connection
            if (this.opts.initiator) {
                this.dataChannel = this.pc.createDataChannel('_signal', { ordered: true });
                this._setupDataChannel();
            }

            // If initiator, create offer
            if (this.opts.initiator) {
                this._createOffer();
            }
        } catch (error) {
            this.emit('error', error);
        }
    }

    /**
     * Create and emit offer
     */
    async _createOffer() {
        try {
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
                
                // Fallback timeout (some browsers don't emit final complete event)
                setTimeout(() => {
                    this.pc.removeEventListener('icegatheringstatechange', checkComplete);
                    resolve();
                }, 3000);
            });
            
            // Emit offer once with complete SDP including all ICE candidates
            this.emit('signal', { type: 'offer', sdp: this.pc.localDescription.sdp });
        } catch (error) {
            console.error('[Peer] Error creating offer:', error);
            this.emit('error', error);
        }
    }

    /**
     * Signal answer/candidate to remote peer
     */
    signal(data) {
        if (!this.pc) return;

        if (data.type === 'answer') {
            // Handle answer to our offer
            this.pc.setRemoteDescription({ type: 'answer', sdp: data.sdp })
                .catch((error) => {
                    this.emit('error', new Error(`Failed to set remote answer: ${error.message}`));
                });
        } else if (data.type === 'offer') {
            // Responder receives offer
            this._handleOffer(data);
        } else if (data.candidate) {
            // ICE candidate
            this.pc.addIceCandidate(new RTCIceCandidate(data.candidate))
                .catch((e) => {
                    // ICE errors are non-fatal (candidates arrive out of order)
                    console.debug('[Peer] ICE candidate error (non-fatal):', e.message);
                });
        }
    }

    /**
     * Handle incoming offer (responder side)
     */
    async _handleOffer(data) {
        try {
            // Set remote description first
            await this.pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
            
            // Create answer
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
                
                // Fallback timeout (some browsers don't emit final complete event)
                setTimeout(() => {
                    this.pc.removeEventListener('icegatheringstatechange', checkComplete);
                    resolve();
                }, 3000);
            });
            
            // Emit answer once with complete SDP including all ICE candidates
            this.emit('signal', { type: 'answer', sdp: this.pc.localDescription.sdp });
        } catch (error) {
            console.error('[Peer] Error handling offer:', error);
            this.emit('error', error);
        }
    }

    /**
     * Setup data channel handlers
     */
    _setupDataChannel() {
        if (!this.dataChannel) return;

        this.dataChannel.onopen = () => {
            // Data channel is open
        };

        this.dataChannel.onclose = () => {
            this.dataChannel = null;
        };

        this.dataChannel.onerror = (evt) => {
            this.emit('error', evt.error || new Error('Data channel error'));
        };

        this.dataChannel.onmessage = (evt) => {
            this.emit('data', evt.data);
        };
    }

    /**
     * Send data through data channel
     */
    send(data) {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            return false;
        }

        try {
            this.dataChannel.send(data);
            return true;
        } catch (error) {
            return false;
        }
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
        
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        
        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }
        
        this.handlers.clear();
    }

}
