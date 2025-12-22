/**
 * ActionNetTrackerClient - WebSocket Tracker for Peer Discovery
 * 
 * Implements WebSocket tracker protocol for peer discovery via WebRTC offers/answers.
 * Periodically announces with offers to discover peers, manages peer lifecycle.
 */

class ActionNetTrackerClient {
    constructor(trackerUrls, infohash, peerId, options = {}) {
        // Accept either a single URL or array of URLs
        this.trackerUrls = Array.isArray(trackerUrls) ? trackerUrls : [trackerUrls];
        this.infohash = infohash;
        this.peerId = peerId;
        this.options = {
            debug: options.debug || false,
            numwant: options.numwant || 50,
            announceInterval: options.announceInterval || 5000,
            maxAnnounceInterval: options.maxAnnounceInterval || 120000,
            backoffMultiplier: options.backoffMultiplier || 1.1,
            ...options
        };

        this.trackers = new Map(); // trackerUrl -> { ws, announceInterval, currentInterval, announceCount }
        this.discoveredPeerIds = new Set();
        this.handlers = new Map();
        this.messageCount = 0;
        this.outgoingPeers = new Map(); // Track SimplePeer instances we created: offerId -> peer
        this.pendingOffers = new Set(); // offerId of offers waiting for answers
        this.connectedPeerIds = new Set(); // peerId of peers we've successfully connected to
        this.discoveredCount = 0; // Total peers from tracker (seeders + leechers)
        this.announceCount = 0; // Track total announces for backoff
    }

    /**
     * Connect to all trackers and start announcing
     * Continues even if some trackers fail to connect
     */
    async connect() {
        const results = await Promise.allSettled(
            this.trackerUrls.map(url => this._connectToTracker(url))
        );
        
        // Log any failed trackers but don't throw
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                this.log(`Tracker connection failed: ${this.trackerUrls[index]} - ${result.reason.message}`, 'warn');
            }
        });
        
        // Check if at least one tracker connected
        if (this.trackers.size === 0) {
            throw new Error('Failed to connect to any trackers');
        }
    }

    /**
     * Connect to a single tracker
     */
    async _connectToTracker(trackerUrl) {
        return new Promise((resolve, reject) => {
            try {
                const ws = new WebSocket(trackerUrl);
                ws.binaryType = 'arraybuffer';

                ws.onopen = async () => {
                    this.log(`Connected to tracker: ${trackerUrl}`);
                    try {
                        // Wait for first peer to be ready before announcing
                        await this._prepareFirstPeer();
                        this.log('First peer ready, starting announces');
                        this.startAnnouncing();
                        this.emit('ready');
                    } catch (error) {
                        this.log(`Error preparing first peer: ${error.message}`, 'error');
                        reject(error);
                        return;
                    }
                    resolve();
                };

                ws.onmessage = (evt) => {
                    this.messageCount++;
                    this.handleTrackerMessage(evt.data);
                };

                ws.onerror = (error) => {
                    const errorMsg = error?.message || String(error);
                    this.log(`Tracker error from ${trackerUrl}: ${errorMsg}`, 'error');
                    this.emit('error', new Error(errorMsg));
                };

                ws.onclose = () => {
                    this.log(`Disconnected from tracker: ${trackerUrl}`);
                    this.trackers.delete(trackerUrl);
                    if (this.trackers.size === 0) {
                        this.emit('close');
                        this.stop();
                    }
                };

                // Store tracker connection
                this.trackers.set(trackerUrl, { ws, announceInterval: null, currentInterval: this.options.announceInterval, announceCount: 0 });

                // Timeout for connection
                setTimeout(() => {
                    if (ws.readyState !== WebSocket.OPEN) {
                        reject(new Error(`Tracker connection timeout: ${trackerUrl}`));
                    }
                }, 5000);
            } catch (error) {
                this.log(`Failed to connect to ${trackerUrl}: ${error.message}`, 'error');
                reject(error);
            }
        });
    }

    /**
     * Prepare first peer and wait for ICE to be ready
     */
    async _prepareFirstPeer() {
        return new Promise((resolve, reject) => {
            const offerId = this.generateOfferId();
            const peer = new ActionNetPeer({
                initiator: true,
                trickle: false,
                iceServers: this.options.iceServers || [
                    { urls: 'stun:stun.l.google.com:19302' }
                ]
            });

            let resolved = false;

            peer.on('signal', (data) => {
                if (!resolved && data.type === 'offer') {
                    resolved = true;
                    // Store for later use
                    this.outgoingPeers.set(offerId, peer);
                    
                    // Set timeout for this peer
                    const timeout = setTimeout(() => {
                        if (this.outgoingPeers.has(offerId)) {
                            this.outgoingPeers.delete(offerId);
                            if (!peer.destroyed) peer.destroy();
                        }
                    }, 50 * 1000);
                    
                    peer._offerTimeout = timeout;
                    resolve();
                }
            });

            peer.on('error', (err) => {
                if (!resolved) {
                    resolved = true;
                    if (!peer.destroyed) peer.destroy();
                    reject(err);
                }
            });

            // Timeout if peer takes too long
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    if (!peer.destroyed) peer.destroy();
                    reject(new Error('First peer ICE gathering timeout'));
                }
            }, 10000);
        });
    }

    /**
     * Generate SDP offer using custom Peer class and store the peer
     * Returns { offer, offerId, peer }
     */
    async generateOffer(offerId) {
        return new Promise((resolve) => {
            const peer = new ActionNetPeer({
                initiator: true,
                trickle: false,
                localPeerId: this.peerId,
                remotePeerId: 'tracker',
                iceServers: this.options.iceServers || [
                    { urls: 'stun:stun.l.google.com:19302' }
                ]
            });

            let offerGenerated = false;

            peer.on('signal', (data) => {
                if (!offerGenerated && data.type === 'offer') {
                    offerGenerated = true;
                    // Store the peer for later use when answer arrives
                    this.outgoingPeers.set(offerId, peer);
                    this.pendingOffers.add(offerId); // Mark as pending
                    
                    // Set a timeout to clean up if answer never comes (2 announce cycles)
                    const timeout = setTimeout(() => {
                        if (this.outgoingPeers.has(offerId)) {
                            this.outgoingPeers.delete(offerId);
                            this.pendingOffers.delete(offerId);
                            if (!peer.destroyed) peer.destroy();
                        }
                    }, this.options.announceInterval * 2);

                    // Attach timeout to peer so we can clear it later
                    peer._offerTimeout = timeout;

                    resolve({ offer: data, offerId, peer });
                }
            });

            peer.on('error', (err) => {
                console.warn('Error generating offer:', err);
                if (!peer.destroyed) peer.destroy();
                if (this.outgoingPeers.has(offerId)) {
                    this.outgoingPeers.delete(offerId);
                }
                resolve(null);
            });
        });
    }

    /**
     * Start periodic announcements with offers
     */
    startAnnouncing() {
        // Announce immediately with offers (first peer is ready)
        this.announceWithOffers();

        // Then announce with offers at specified interval with backoff to all trackers
        for (const [trackerUrl, trackerData] of this.trackers) {
            if (trackerData.announceInterval) clearInterval(trackerData.announceInterval);
            
            const scheduleNextAnnounce = () => {
                trackerData.announceInterval = setTimeout(() => {
                    if (trackerData.ws && trackerData.ws.readyState === WebSocket.OPEN) {
                        trackerData.announceCount++;
                        this.announceWithOffers(trackerData.ws);
                        
                        // Increase interval by backoff multiplier, cap at maxAnnounceInterval
                        trackerData.currentInterval = Math.min(
                            trackerData.currentInterval * this.options.backoffMultiplier,
                            this.options.maxAnnounceInterval
                        );
                        
                        // Schedule next announce with new interval
                        scheduleNextAnnounce();
                    }
                }, trackerData.currentInterval);
            };
            
            scheduleNextAnnounce();
        }
    }

    /**
     * Generate offers and announce to all trackers
     */
    async announceWithOffers(targetWs = null) {
        try {
            // Don't generate new offers if we have pending unanswered ones
            if (this.pendingOffers.size > 0) {
                this.announce([], targetWs); // Just announce without new offers
                return;
            }
            
            // Generate 1 offer
            const offerId = this.generateOfferId();
            const result = await this.generateOffer(offerId);
            
            const offers = result && result.offer ? [{
                offer_id: offerId,
                offer: result.offer
            }] : [];

            this.announce(offers, targetWs);
        } catch (error) {
            this.log(`Error generating offer: ${error.message}`, 'error');
            this.announce([], targetWs); // Announce without offers
        }
    }

    /**
     * Generate random offer ID (20 bytes hex)
     */
    generateOfferId() {
        const bytes = new Uint8Array(20);
        crypto.getRandomValues(bytes);
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Send announce request to tracker(s) with offers
     */
    announce(offers = [], targetWs = null) {
        // Build announce message
        const request = {
            action: 'announce',
            info_hash: this.infohash,
            peer_id: this.peerId,
            numwant: this.options.numwant
        };

        // Add offers if we have them
        if (offers.length > 0) {
            request.offers = offers;
        }

        const msgStr = JSON.stringify(request);
        console.log('[TrackerClient] Announcing:', msgStr);
        this.log(`Announcing with ${offers.length} offers`);

        // Send to specific tracker or all
        if (targetWs) {
            if (targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(msgStr);
            }
        } else {
            // Announce to all connected trackers
            for (const [, trackerData] of this.trackers) {
                if (trackerData.ws && trackerData.ws.readyState === WebSocket.OPEN) {
                    trackerData.ws.send(msgStr);
                }
            }
        }
    }

    /**
     * Handle tracker response (JSON format)
     */
    handleTrackerMessage(data) {
        try {
            let message;

            if (data instanceof ArrayBuffer) {
                const str = new TextDecoder().decode(data);
                message = JSON.parse(str);
            } else {
                const str = typeof data === 'string' ? data : new TextDecoder().decode(data);
                message = JSON.parse(str);
            }

            console.log(`[TrackerClient] MESSAGE #${this.messageCount}:`, message);

            // Check for peer offer/answer FIRST before general announce response
            // (tracker sends all of these with action: 'announce')
            if (message.offer && message.peer_id) {
                // Tracker is relaying a peer's offer
                this.handlePeerOffer(message);
            } else if (message.answer && message.peer_id) {
                // Peer is answering our offer
                this.handlePeerAnswer(message);
            } else if (message['failure reason']) {
                // Tracker sent a failure response
                this.log(`Tracker failure: ${message['failure reason']}`, 'warn');
                console.log('[TrackerClient] Tracker failure:', message['failure reason']);
            } else if (message.action === 'announce') {
                // Regular announce response (with stats)
                this.handleAnnounceResponse(message);
            } else if (message.action === 'scrape') {
                // Scrape response
                this.emit('scrape', message);
            } else {
                console.log('[TrackerClient] Unknown message type:', Object.keys(message).join(', '));
            }
        } catch (error) {
            this.log(`Failed to parse tracker message: ${error.message}`, 'error');
            console.error('[TrackerClient] Raw data:', data);
        }
    }

    /**
     * Handle announce response (ACK from tracker with stats)
     */
    handleAnnounceResponse(response) {
        console.log('[TrackerClient] Announce response:', response);

        const complete = response.complete || 0;
        const incomplete = response.incomplete || 0;
        this.discoveredCount = complete + incomplete;
        
        this.log(`Tracker stats: ${complete} seeders, ${incomplete} leechers (${this.discoveredCount} total)`);

        this.emit('update', {
            complete: complete,
            incomplete: incomplete
        });
    }

    /**
     * Handle offer from another peer (tracker is relaying their offer)
     */
    handlePeerOffer(message) {
        const peerId = message.peer_id;
        const offerId = message.offer_id;
        const offer = message.offer;

        console.log('[TrackerClient] Received offer from peer:', peerId);

        // Skip if we already have a connection to this peer
        if (this.connectedPeerIds.has(peerId)) {
            console.log('[TrackerClient] Already connected to peer:', peerId, '- ignoring offer');
            return;
        }

        // Create responder Peer to handle this offer
        const peer = new ActionNetPeer({
            initiator: false,
            trickle: false,
            localPeerId: this.peerId,
            remotePeerId: peerId,
            iceServers: this.options.iceServers || [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        });

        // Store peer so we can send answer back
        this.outgoingPeers.set(offerId, {
            peer: peer,
            peerId: peerId,
            offerId: offerId
        });

        // Listen for answer signal
        peer.on('signal', (data) => {
            if (data.type === 'answer') {
                console.log('[TrackerClient] Sending answer to peer:', peerId);
                this.sendAnswer(offerId, peerId, data);
            }
        });

        // Emit peer's internal DataConnection when tracker signaling is complete
        peer.once('connect', () => {
            this.connectedPeerIds.add(peerId);
            
            // Emit peer event
            this.emit('peer', {
                id: peerId,
                peer: peer,
                source: 'tracker'
            });
            
            // ActionNetPeer has an internal DataConnection
            // Emit that connection directly (no extra wrapper needed)
            this.emit('connection', peer.connection);
        });

        peer.on('error', (err) => {
            console.warn('[TrackerClient] Responder peer error:', err.message);
            this.outgoingPeers.delete(offerId);
            this.connectedPeerIds.delete(peerId);
            this.emit('peer-failed', {
                id: peerId,
                error: err
            });
        });

        peer.on('close', () => {
            this.outgoingPeers.delete(offerId);
            this.connectedPeerIds.delete(peerId);
            this.emit('peer-disconnected', {
                id: peerId
            });
        });

        // Signal the offer
        peer.signal(offer);
    }

    /**
     * Handle answer from peer (responding to our offer)
     */
    handlePeerAnswer(message) {
        const peerId = message.peer_id;
        const offerId = message.offer_id;
        const answer = message.answer;

        console.log('[TrackerClient] Received answer from peer:', peerId);

        // Check if we have the SimplePeer for this offer
        const peer = this.outgoingPeers.get(offerId);
        if (peer && !peer.destroyed) {
            // Mark offer as answered (no longer pending)
            this.pendingOffers.delete(offerId);
            
            // Now we know the real remote peer ID, update the connection
            if (peer.connection) {
                peer.connection.remotePeerId = peerId;
            }
            
            // Signal the answer to the peer
            peer.signal(answer);

            // Clear the timeout since we got a response
            if (peer._offerTimeout) {
                clearTimeout(peer._offerTimeout);
                peer._offerTimeout = null;
            }

            // Emit peer's internal DataConnection when tracker signaling is complete
             peer.once('connect', () => {
                 // Mark this peer ID as connected
                 this.connectedPeerIds.add(peerId);
                 
                 // Emit peer event
                 this.emit('peer', {
                     id: peerId,
                     peer: peer,
                     source: 'tracker'
                 });
                 
                 // ActionNetPeer has an internal DataConnection
                 // Emit that connection directly (no extra wrapper needed)
                 this.emit('connection', peer.connection);
             });

            peer.on('error', (err) => {
                console.warn('[TrackerClient] Peer error:', err.message);
                this.outgoingPeers.delete(offerId);
                this.connectedPeerIds.delete(peerId);
                this.emit('peer-failed', {
                    id: peerId,
                    error: err
                });
            });

            peer.on('close', () => {
                this.outgoingPeers.delete(offerId);
                this.connectedPeerIds.delete(peerId);
                this.emit('peer-disconnected', {
                    id: peerId
                });
            });
        } else {
            console.warn('[TrackerClient] Got answer for unknown offer:', offerId);
        }
    }

    /**
     * Send answer back to tracker(s) (responding to a peer's offer)
     */
    sendAnswer(offerId, peerId, answer) {
        const response = {
            action: 'announce',
            info_hash: this.infohash,
            peer_id: this.peerId,
            to_peer_id: peerId,
            offer_id: offerId,
            answer: answer
        };

        const msgStr = JSON.stringify(response);
        console.log('[TrackerClient] Sending answer:', msgStr);
        
        // Send to all connected trackers
        for (const [, trackerData] of this.trackers) {
            if (trackerData.ws && trackerData.ws.readyState === WebSocket.OPEN) {
                trackerData.ws.send(msgStr);
            }
        }
    }

    /**
     * Stop announcing to all trackers
     */
    stop() {
        for (const [, trackerData] of this.trackers) {
            if (trackerData.announceInterval) {
                clearInterval(trackerData.announceInterval);
                trackerData.announceInterval = null;
            }
        }
    }

    /**
     * Disconnect from all trackers
     */
    disconnect() {
        this.stop();
        for (const [, trackerData] of this.trackers) {
            if (trackerData.ws) {
                trackerData.ws.close();
            }
        }
        this.trackers.clear();
    }

    /**
     * Get discovered peer count (seeders + leechers from tracker)
     */
    getDiscoveredPeerCount() {
        return this.discoveredCount;
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

    emit(event, ...args) {
        if (!this.handlers.has(event)) return;
        for (const handler of this.handlers.get(event)) {
            try {
                handler(...args);
            } catch (e) {
                this.log(`Error in ${event} handler: ${e.message}`, 'error');
            }
        }
    }

    /**
     * Logging
     */
    log(msg, level = 'info') {
        if (!this.options.debug) return;
        console.log(`[TrackerClient] ${msg}`);
    }
}
