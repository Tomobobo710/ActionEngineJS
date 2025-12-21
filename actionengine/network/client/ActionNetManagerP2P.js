/**
 * ActionNetManagerP2P - P2P network manager using ActionNetP2P library (dual WebRTC channels)
 * 
 * Two-phase connection model:
 * Phase 1 (Signaling): ActionNetPeer's data channel for handshakes, room status, WebRTC signaling (offer/answer/ICE)
 * Phase 2 (Game): Separate RTCPeerConnection for game data (created manually on acceptJoin/joinRoom)
 * 
 * ARCHITECTURE:
 * - ActionNetTrackerClient: Peer discovery
 * - ActionNetPeer: Signaling channel (built-in data channel)
 * - Manual RTCPeerConnection: Game data channel
 * - SyncSystem: Game state synchronization (via game data channel)
 * 
 * USAGE:
 * ```javascript
 * const net = new ActionNetManagerP2P({ debug: true });
 * 
 * // Join a game (create or find)
 * net.joinGame('tetris-1v1');
 * 
 * // Listen for discovered rooms
 * net.on('roomList', (rooms) => {
 *   console.log('Available rooms:', rooms);
 * });
 * 
 * // Join a host's room
 * net.joinRoom(hostPeerId).then(() => {
 *   // Connected! Game channel ready
 *   const dataChannel = net.getDataChannel();
 * });
 * ```
 */
class ActionNetManagerP2P {
    constructor(config = {}) {
        this.config = {
            debug: config.debug || false,
            gameId: config.gameId || 'game-id-00000',
            broadcastInterval: config.broadcastInterval || 1000,
            staleThreshold: config.staleThreshold || 1000,
            maxPlayers: config.maxPlayers || 2,
            iceServers: config.iceServers || [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" }
            ],
            numwant: config.numwant || 50,
            announceInterval: config.announceInterval || 5000,
            maxAnnounceInterval: config.maxAnnounceInterval || 120000,
            backoffMultiplier: config.backoffMultiplier || 1.1
        };

        // State
        this.currentGameId = null;
        this.peerId = null;
        this.username = "Anonymous";
        this.isHost = false;
        this.currentRoomPeerId = null;

        // ActionNetP2P
        this.tracker = null;
        this.infohash = null;

        // Peer connections: peerId -> { peer: ActionNetPeer, status, pc: RTCPeerConnection, channel: RTCDataChannel }
        this.peerConnections = new Map();
        
        // Game data channel (the one NetworkSession uses)
        this.dataChannel = null;

        // Room tracking
        this.discoveredRooms = new Map();
        this.roomStatusInterval = null;
        this.staleRoomCleanupInterval = null;
        this.connectedUsers = [];
        this.userListVersion = 0;

        // Event handlers
        this.handlers = new Map();

        // Connection abort
        this.connectionAbortController = null;

        this.log('Initialized ActionNetManagerP2P');
    }

    /**
     * Register event handler
     */
    on(event, handler) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, []);
        }
        this.handlers.get(event).push(handler);
    }

    /**
     * Unregister event handler
     */
    off(event, handler) {
        if (!this.handlers.has(event)) return;
        const handlers = this.handlers.get(event);
        const index = handlers.indexOf(handler);
        if (index !== -1) {
            handlers.splice(index, 1);
        }
    }

    /**
     * Emit event
     */
    emit(event, ...args) {
        if (!this.handlers.has(event)) return;
        this.handlers.get(event).forEach(h => {
            try {
                h(...args);
            } catch (e) {
                this.log(`Error in ${event} handler: ${e.message}`, 'error');
            }
        });
    }

    /**
     * Logging utility
     */
    log(msg, level = 'info') {
        if (this.config.debug) {
            console.log(`[ActionNetManagerP2P] ${msg}`);
        }
    }

    /**
     * Join a game (start peer discovery)
     */
    async joinGame(gameId, username = 'Anonymous') {
        // Create abort controller for this connection attempt
        this.connectionAbortController = new AbortController();
        const signal = this.connectionAbortController.signal;

        // Check if already aborted
        if (signal.aborted) {
            throw new Error('Connection cancelled');
        }

        // Listen for abort signal
        signal.addEventListener('abort', () => {
            // Will be caught by startConnection's catch block
        });

        try {
            this.currentGameId = gameId;
            this.username = username;
            this.peerId = this.generatePeerId();

            this.log(`Joining game: ${gameId} as ${this.peerId}`);

            // Generate infohash from game ID
            this.infohash = await this.gameidToHash(gameId);
            this.log(`Game ID hash (infohash): ${this.infohash}`);

            // Check abort signal
            if (signal.aborted) throw new Error('Connection cancelled');

            // Fetch tracker list
            const trackerUrls = await this.fetchTrackerList();
            this.log(`Using ${trackerUrls.length} trackers for discovery`);

        // Create tracker client
        this.tracker = new ActionNetTrackerClient(trackerUrls, this.infohash, this.peerId, {
            debug: this.config.debug,
            numwant: this.config.numwant,
            announceInterval: this.config.announceInterval,
            maxAnnounceInterval: this.config.maxAnnounceInterval,
            backoffMultiplier: this.config.backoffMultiplier,
            iceServers: this.config.iceServers
        });

        // Handle DataConnection (ActionNetPeer signaling + negotiated RTCPeerConnection)
        this.tracker.on('connection', (connection) => {
            const peerId = connection.remotePeerId;
            this.log(`DataConnection established with peer: ${peerId}`);

            // Store connection
            if (!this.peerConnections.has(peerId)) {
                this.peerConnections.set(peerId, {
                    connection: connection,
                    status: 'signaling',
                    pc: null,
                    channel: null
                });

                // Listen for signaling messages through DataConnection
                connection.on('data', (data) => {
                    try {
                        let message;
                        if (typeof data === 'object') {
                            message = data;
                        } else if (typeof data === 'string') {
                            message = JSON.parse(data);
                        } else {
                            message = JSON.parse(data.toString());
                        }
                        this.handleSignalingMessage(peerId, message);
                    } catch (e) {
                        this.log(`Error parsing signaling message: ${e.message}`, 'error');
                    }
                });

                // Send initial handshake through DataConnection
                connection.send({
                    type: 'handshake',
                    peerId: this.peerId,
                    gameId: this.currentGameId,
                    username: this.username
                });

                // If we're a host, broadcast room status
                if (this.isHost) {
                    connection.send({
                        type: 'roomStatus',
                        peerId: this.peerId,
                        username: this.username,
                        hosting: true,
                        gameType: this.currentGameId,
                        maxPlayers: this.config.maxPlayers,
                        currentPlayers: this.connectedUsers.length,
                        slots: this.config.maxPlayers - this.connectedUsers.length
                    });
                }
            }
        });

        // Handle tracker ready
        this.tracker.on('ready', () => {
            this.log('Tracker ready, discovering peers...');
        });

        // Handle tracker updates
        this.tracker.on('update', (data) => {
            this.log(`Tracker: ${data.complete} seeders, ${data.incomplete} leechers`);
        });

        // Handle peer connection failure
        this.tracker.on('peer-failed', (data) => {
            const peerId = data.id;
            this.log(`Peer connection failed: ${peerId}`, 'error');
            const peerData = this.peerConnections.get(peerId);
            if (peerData) {
                peerData.status = 'failed';
            }
        });

        // Handle peer disconnection (refresh, browser close, etc.)
        this.tracker.on('peer-disconnected', (data) => {
            const peerId = data.id;
            this.log(`Peer disconnected: ${peerId}`);
            
            const peerData = this.peerConnections.get(peerId);
            if (peerData) {
                if (peerData.channel) {
                    peerData.channel.close();
                }
                if (peerData.pc) {
                    peerData.pc.close();
                }
                this.peerConnections.delete(peerId);
            }

            // Clean up discovered room
            this.removeDiscoveredRoom(peerId);

            // If this was the active game connection, handle disconnect
            if (this.currentRoomPeerId === peerId) {
                this.dataChannel = null;
                this.emit('leftRoom', peerId);
                
                // Guest: host disconnected
                if (!this.isHost) {
                    this.emit('hostLeft', { peerId: peerId });
                } else {
                    // Host: guest disconnected - remove from user list
                    this.removeUser(peerId);
                    this.emit('guestLeft', { peerId: peerId });
                }
            } else if (this.isHost && this.isInRoom()) {
                // Host in a room: a guest (not current connection) disconnected
                this.removeUser(peerId);
                this.emit('guestLeft', { peerId: peerId });
            }
        });

        // Handle tracker errors
        this.tracker.on('error', (err) => {
            this.log(`Tracker error: ${err.message}`, 'error');
        });

        // Connect to tracker
        try {
            await this.tracker.connect();
            this.log('Connected to tracker');
        } catch (error) {
            this.log(`Failed to connect to tracker: ${error.message}`, 'error');
            throw error;
        }

        // Start broadcasting room status
        this.startRoomBroadcast();

            // Check abort signal
            if (signal.aborted) throw new Error('Connection cancelled');

            // Start stale room cleanup
            this.startStaleRoomCleanup();

            // Emit connected event
            this.emit('connected');
            this.connectionAbortController = null; // Clear abort controller
        } catch (error) {
            // Check if it was a cancellation
            if (signal.aborted || error.message === 'Connection cancelled') {
                this.connectionAbortController = null;
                throw error;
            }
            throw error;
        }
    }

    /**
     * Handle signaling messages from peer (through ActionNetPeer's data channel)
     */
    handleSignalingMessage(peerId, message) {
        const peerData = this.peerConnections.get(peerId);
        if (!peerData) {
            this.log(`No peer data for ${peerId}`);
            return;
        }

        this.log(`Signaling message from ${peerId}: ${message.type}`);

        switch (message.type) {
            case 'handshake':
                this.handleHandshake(peerId, message);
                break;
            case 'roomStatus':
                this.handleRoomStatus(peerId, message);
                break;
            case 'joinRequest':
                this.handleJoinRequest(peerId, message);
                break;
            case 'offer':
                this.handleOffer(peerId, message);
                break;
            case 'answer':
                this.handleAnswer(peerId, message);
                break;
            case 'ice-candidate':
                this.handleIceCandidate(peerId, message);
                break;
            case 'userList':
                this.handleUserList(peerId, message);
                break;
            case 'joinAccepted':
                this.log(`Received joinAccepted from ${peerId}`);
                this.emit('joinAccepted', message);
                break;
            case 'joinRejected':
                this.log(`Received joinRejected from ${peerId}`);
                this.emit('joinRejected', message);
                break;
            case 'hostLeft':
                this.log(`Host left: ${peerId}`);
                if (this.currentRoomPeerId === peerId) {
                    this.dataChannel = null;
                    this.removeUser(peerId);
                    this.emit('hostLeft', { peerId: peerId });
                }
                break;
            case 'guestLeft':
                this.log(`Guest left: ${peerId}`);
                if (this.isHost) {
                    this.removeUser(peerId);
                    // Clean up peer connection for potential rejoin
                    const peerData = this.peerConnections.get(peerId);
                    if (peerData) {
                        if (peerData.channel) peerData.channel.close();
                        if (peerData.pc) peerData.pc.close();
                        // Reset state but keep peer connection for signaling
                        peerData.pc = null;
                        peerData.channel = null;
                        peerData.status = 'signaling';
                        peerData._joinRequested = false;
                        peerData._joinAccepted = false;
                        peerData._joinUsername = null;
                    }
                    this.emit('guestLeft', { peerId: peerId });
                }
                break;
            default:
                this.log(`Unknown signaling message: ${message.type}`);
        }
    }

    /**
     * Handle handshake
     */
    handleHandshake(peerId, message) {
        this.log(`Handshake from ${peerId}`);

        // Validate game ID matches
        if (message.gameId !== this.currentGameId) {
            this.log(`Handshake validation failed: peer on different game`, 'error');
            return;
        }

        // If we're hosting, send room status back
        if (this.isHost) {
            const peerData = this.peerConnections.get(peerId);
            if (peerData && peerData.connection) {
                peerData.connection.send({
                    type: 'roomStatus',
                    peerId: this.peerId,
                    username: this.username,
                    hosting: true,
                    gameType: this.currentGameId,
                    maxPlayers: this.config.maxPlayers,
                    currentPlayers: this.connectedUsers.length,
                    slots: this.config.maxPlayers - this.connectedUsers.length
                });
            }
        }

        this.emit('peerHandshook', {
            peerId: peerId,
            username: message.username
        });
    }

    /**
     * Handle room status message
     */
    handleRoomStatus(peerId, message) {
        this.log(`Room status from ${peerId}: ${message.currentPlayers}/${message.maxPlayers} players`);

        const roomInfo = {
            peerId: message.peerId,
            username: message.username,
            hosting: message.hosting,
            gameType: message.gameType,
            maxPlayers: message.maxPlayers,
            currentPlayers: message.currentPlayers,
            slots: message.slots,
            lastSeen: Date.now()
        };

        this.discoveredRooms.set(peerId, roomInfo);
        this.emit('roomList', Array.from(this.discoveredRooms.values()));
    }

    /**
     * Handle join request
     */
    handleJoinRequest(peerId, message) {
         this.log(`Join request from ${peerId}: ${message.username}`);

         if (!this.isHost) {
             this.log(`Not hosting, rejecting join request`, 'error');
             return;
         }

         const peerData = this.peerConnections.get(peerId);

         // Check if room is full BEFORE storing join state
         if (this.connectedUsers.length >= this.config.maxPlayers) {
             if (peerData && peerData.connection) {
                 peerData.connection.send({
                     type: 'joinRejected',
                     peerId: this.peerId,
                     reason: 'Room is full'
                 });
             }
             // Clean up join state to prevent further processing
             if (peerData) {
                 peerData._joinRequested = false;
                 peerData._joinAccepted = false;
                 peerData._joinUsername = null;
             }
             this.emit('joinRejected', {
                 peerId: peerId,
                 reason: 'Room is full'
             });
             return;
         }

         // Store join request info for acceptJoin
         if (peerData) {
             peerData._joinUsername = message.username;
             peerData._joinRequested = true;  // Mark that join was requested
         }

         // Emit join request event for application logging/hooks
         this.emit('joinRequest', {
             peerId: peerId,
             username: message.username
         });
         // Note: actual acceptance happens in handleOffer when WebRTC is ready
     }

    /**
     * Accept a join request (host side)
     * Sends acceptance message - RTCPeerConnection created in handleOffer
     * NOTE: User is NOT added to connectedUsers yet - they're added when data channel opens
     */
    acceptJoin(peerId) {
         this.log(`Accepting join from ${peerId}`);

         const peerData = this.peerConnections.get(peerId);
         if (!peerData) {
             throw new Error(`No peer connection for ${peerId}`);
         }

         // Check if room is full before accepting
         if (this.connectedUsers.length >= this.config.maxPlayers) {
             this.log(`Cannot accept join from ${peerId}: room is full`, 'error');
             peerData.connection.send({
                 type: 'joinRejected',
                 peerId: this.peerId,
                 reason: 'Room is full'
             });
             return;
         }

         // Send joinAccepted through signaling channel
         // RTCPeerConnection will be created in handleOffer when offer arrives
         // User will be added to connectedUsers only when data channel opens
         peerData.connection.send({
             type: 'joinAccepted',
             peerId: this.peerId,
             users: this.connectedUsers
         });
     }

    /**
     * Handle WebRTC offer (responder side - host receiving offer from joiner)
     * 
     * Waits for ICE gathering to complete before sending answer.
     */
    async handleOffer(peerId, message) {
        this.log(`Offer from ${peerId}`);

        const peerData = this.peerConnections.get(peerId);
        if (!peerData) return;

        // If this peer requested to join, auto-accept now that we have the offer
        if (peerData._joinRequested && !peerData._joinAccepted) {
            peerData._joinAccepted = true;
            this.acceptJoin(peerId);
        }

        // Create RTCPeerConnection if needed
        if (!peerData.pc) {
            peerData.pc = new RTCPeerConnection({
                iceServers: this.config.iceServers
            });

            peerData.pc.onicecandidate = (evt) => {
                if (evt.candidate) {
                    this.sendSignalingMessage(peerId, {
                        type: 'ice-candidate',
                        candidate: evt.candidate
                    });
                }
            };

            peerData.pc.ondatachannel = (evt) => {
                this.log(`Game data channel received from ${peerId}`);
                peerData.channel = evt.channel;
                this.setupGameDataChannel(peerId, evt.channel);
            };
        }

        try {
            // Set remote description and create answer
            await peerData.pc.setRemoteDescription({ type: 'offer', sdp: message.sdp });
            const answer = await peerData.pc.createAnswer();
            await peerData.pc.setLocalDescription(answer);

            // Wait for ICE gathering to complete before sending answer
            const pc = peerData.pc;
            if (pc.iceGatheringState === 'complete') {
                this.log(`ICE gathering complete, sending answer`);
            } else {
                this.log(`Waiting for ICE gathering to complete...`);
                await new Promise((resolveGather) => {
                    const gatherTimeoutHandle = setTimeout(() => {
                        pc.removeEventListener('icegatheringstatechange', onGatherStateChange);
                        this.log(`ICE gathering timeout - sending answer with partial candidates`);
                        resolveGather();
                    }, 3000);

                    const onGatherStateChange = () => {
                        this.log(`ICE gathering state: ${pc.iceGatheringState}`);
                        if (pc.iceGatheringState === 'complete') {
                            clearTimeout(gatherTimeoutHandle);
                            pc.removeEventListener('icegatheringstatechange', onGatherStateChange);
                            this.log(`ICE gathering complete`);
                            resolveGather();
                        }
                    };

                    pc.addEventListener('icegatheringstatechange', onGatherStateChange);
                });
            }

            // Send answer through signaling channel with complete SDP
            this.sendSignalingMessage(peerId, {
                type: 'answer',
                sdp: peerData.pc.localDescription.sdp
            });
        } catch (error) {
            this.log(`Error handling offer from ${peerId}: ${error.message}`, 'error');
        }
    }

    /**
     * Handle WebRTC answer (initiator side - joiner receiving answer from host)
     */
    async handleAnswer(peerId, message) {
        this.log(`Answer from ${peerId}`);

        const peerData = this.peerConnections.get(peerId);
        if (!peerData || !peerData.pc) return;

        await peerData.pc.setRemoteDescription({ type: 'answer', sdp: message.sdp });
    }

    /**
     * Handle ICE candidate
     */
    async handleIceCandidate(peerId, message) {
        const peerData = this.peerConnections.get(peerId);
        if (!peerData || !peerData.pc) return;

        try {
            await peerData.pc.addIceCandidate(new RTCIceCandidate(message.candidate));
        } catch (error) {
            this.log(`ICE candidate error (non-fatal): ${error.message}`, 'error');
        }
    }

    /**
     * Send signaling message through DataConnection
     */
    sendSignalingMessage(peerId, message) {
        const peerData = this.peerConnections.get(peerId);
        if (!peerData || !peerData.connection) {
            this.log(`Cannot send signaling message: no connection for ${peerId}`, 'error');
            return;
        }

        try {
            this.log(`Sending signaling message to ${peerId}: ${message.type}`);
            peerData.connection.send(message);
        } catch (e) {
            this.log(`Error sending signaling message to ${peerId}: ${e.message}`, 'error');
        }
    }

    /**
     * Setup game data channel handlers
     */
    setupGameDataChannel(peerId, channel) {
        const peerData = this.peerConnections.get(peerId);
        if (!peerData) return;

        channel.onopen = () => {
            this.log(`Game data channel opened with ${peerId}`);
            peerData.status = 'gameConnected';
            
            // Host: Add user to connected users NOW that we have a real connection
            if (this.isHost) {
                // Only add if join was accepted (not rejected)
                if (peerData._joinAccepted && !this.connectedUsers.some(u => u.id === peerId)) {
                    this.addUser({
                        id: peerId,
                        username: peerData._joinUsername || 'Player',
                        isHost: false
                    });
                }
            }
            
            // If this is our game connection (joiner), emit
            if (peerId === this.currentRoomPeerId) {
                this.dataChannel = channel;
                this.emit('joinedRoom', {
                    peerId: peerId,
                    dataChannel: channel
                });
            }
            
            // If host and this is first joiner, set up game sync
            if (this.isHost && !this.dataChannel) {
                this.log(`Host: setting up game sync with first joiner ${peerId}`);
                this.dataChannel = channel;
                this.emit('joinedRoom', {
                    peerId: peerId,
                    dataChannel: channel
                });
            }
            
            // Host: broadcast user list now that peer is connected
            if (this.isHost) {
                this.broadcastUserList();
            }
        };

        channel.onclose = () => {
            this.log(`Game data channel closed with ${peerId}`);
            peerData.status = 'disconnected';
            
            // Only handle if this is the active channel (prevents stale closes from rejoin)
            const isActiveChannel = (channel === this.dataChannel);
            
            if (isActiveChannel) {
                this.dataChannel = null;
                
                // Remove user from list (handles refresh/disconnect)
                this.removeUser(peerId);
                
                // Notify about disconnect
                if (!this.isHost) {
                    // Guest: host disconnected
                    this.emit('hostLeft', { peerId: peerId });
                } else {
                    // Host: guest disconnected
                    this.emit('guestLeft', { peerId: peerId });
                }
            }
            
            // Host: Clean up pending join flags so they can retry
            if (this.isHost) {
                peerData._joinRequested = false;
                peerData._joinAccepted = false;
                peerData._joinUsername = null;
            }
        };

        channel.onerror = (evt) => {
            this.log(`Game data channel error with ${peerId}`, 'error');
        };

        // Note: onmessage is set up by NetworkSession to handle sync messages
        // Don't set it here as it would overwrite NetworkSession's handler
    }

    /**
     * Generate unique display name (matching server-side behavior)
     */
    generateUniqueDisplayName(username, excludeId = null) {
        const allDisplayNames = this.connectedUsers
            .filter(u => u.id !== excludeId)
            .map(u => u.displayName);
        
        const countMap = {};
        
        // Count existing instances of this username (for display name generation)
        const allUsernames = this.connectedUsers
            .filter(u => u.id !== excludeId)
            .map(u => u.username);
        allUsernames.forEach(name => {
            countMap[name] = (countMap[name] || 0) + 1;
        });
        
        const existingCount = countMap[username] || 0;
        let displayName = existingCount === 0 ? username : `${username} (${existingCount})`;
        
        // Ensure the generated display name is unique
        let counter = existingCount;
        while (allDisplayNames.includes(displayName)) {
            counter++;
            displayName = `${username} (${counter})`;
        }
        
        return displayName;
    }

    /**
     * Initialize user list
     */
    initializeUserList() {
        this.connectedUsers = [];
        this.userListVersion = 0;

        this.addUser({
            id: this.peerId,
            username: this.username,
            isHost: this.isHost
        });
    }

    /**
     * Add user to connected list
     */
    addUser(user) {
        if (this.connectedUsers.some(u => u.id === user.id)) {
            return;
        }

        // Generate unique display name if not provided
        if (!user.displayName) {
            user.displayName = this.generateUniqueDisplayName(user.username, user.id);
        }

        this.connectedUsers.push(user);
        this.userListVersion++;
        this.log(`User joined: ${user.displayName} (${user.id})`);

        this.emit('userJoined', user);
        this.emit('userList', this.connectedUsers);
    }

    /**
     * Remove user from connected list
     */
    removeUser(userId) {
        const index = this.connectedUsers.findIndex(u => u.id === userId);
        if (index === -1) return;

        const user = this.connectedUsers[index];
        this.connectedUsers.splice(index, 1);
        this.userListVersion++;
        this.log(`User left: ${user.displayName} (${user.id})`);

        this.emit('userLeft', user);
        this.emit('userList', this.connectedUsers);

        if (this.isHost) {
            this.broadcastUserList();
        }
    }

    /**
     * Remove discovered room
     */
    removeDiscoveredRoom(peerId) {
        if (this.discoveredRooms.has(peerId)) {
            this.discoveredRooms.delete(peerId);
            this.log(`Removed discovered room from ${peerId}`);
            this.emit('roomList', Array.from(this.discoveredRooms.values()));
        }
    }

    /**
     * Get connected users
     */
    getConnectedUsers() {
        return [...this.connectedUsers];
    }

    /**
     * Broadcast user list to all peers
     */
    broadcastUserList() {
        for (const [peerId, peerData] of this.peerConnections) {
            if (peerData.status === 'gameConnected' && peerData.channel && peerData.channel.readyState === 'open') {
                peerData.channel.send(JSON.stringify({
                    type: 'userList',
                    users: this.connectedUsers,
                    version: this.userListVersion
                }));
            }
        }
    }

    /**
     * Handle user list message
     */
    handleUserList(peerId, message) {
        this.log(`User list from ${peerId}: ${message.users.length} users`);
        this.connectedUsers = message.users;
        this.userListVersion = message.version;
        this.emit('userList', this.connectedUsers);
    }

    /**
     * Step 1: Initiate connection setup (create RTCPeerConnection, data channel, etc)
     */
    async initiateConnection(hostPeerId) {
        this.log(`Initiating connection to ${hostPeerId}`);
        
        const peerData = this.peerConnections.get(hostPeerId);
        if (!peerData) {
            throw new Error(`No connection to host ${hostPeerId}`);
        }

        this.currentRoomPeerId = hostPeerId;
        this.isHost = false;
        this.initializeUserList();

        // Create RTCPeerConnection for game data
        const pc = new RTCPeerConnection({
            iceServers: this.config.iceServers
        });

        peerData.pc = pc;

        pc.onicecandidate = (evt) => {
            if (evt.candidate) {
                this.sendSignalingMessage(hostPeerId, {
                    type: 'ice-candidate',
                    candidate: evt.candidate
                });
            }
        };

        pc.onicegatheringstatechange = () => {
            this.log(`ICE gathering state with ${hostPeerId}: ${pc.iceGatheringState}`);
        };

        pc.onconnectionstatechange = () => {
            this.log(`Connection state with ${hostPeerId}: ${pc.connectionState}`);
        };

        // Send join request through signaling channel
        peerData.connection.send({
            type: 'joinRequest',
            peerId: this.peerId,
            username: this.username
        });
    }

    /**
     * Step 2: Create and send WebRTC offer (with complete ICE gathering)
     * 
     * Waits for ICE gathering to complete before sending offer.
     * This ensures the SDP includes the best available candidate addresses,
     * which is crucial for constrained networks (mobile on LTE, CGNAT, etc).
     */
    async sendOffer(hostPeerId, timeout = 10000) {
        this.log(`Sending offer to ${hostPeerId}`);
        
        const peerData = this.peerConnections.get(hostPeerId);
        if (!peerData || !peerData.pc) {
            throw new Error(`Connection not initialized for ${hostPeerId}`);
        }

        return new Promise(async (resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                reject(new Error('Offer creation timeout'));
            }, timeout);

            try {
                const pc = peerData.pc;

                // Create data channel NOW, before creating offer
                if (!peerData.channel) {
                    const channel = pc.createDataChannel('game', { ordered: true });
                    peerData.channel = channel;
                    this.setupGameDataChannel(hostPeerId, channel);
                    this.log(`Created data channel for ${hostPeerId}`);
                }

                // Create offer
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                // Wait for ICE gathering to complete before sending
                // This gives us all available candidate addresses upfront
                if (pc.iceGatheringState === 'complete') {
                    // Already complete
                    this.log(`ICE gathering complete, sending offer`);
                } else {
                    // Wait for completion
                    this.log(`Waiting for ICE gathering to complete...`);
                    await new Promise((resolveGather, rejectGather) => {
                        const gatherTimeoutHandle = setTimeout(() => {
                            pc.removeEventListener('icegatheringstatechange', onGatherStateChange);
                            // Fallback: send after timeout even if not complete (like ActionNetPeer does)
                            this.log(`ICE gathering timeout - sending offer with partial candidates`);
                            resolveGather();
                        }, 3000);

                        const onGatherStateChange = () => {
                            this.log(`ICE gathering state: ${pc.iceGatheringState}`);
                            if (pc.iceGatheringState === 'complete') {
                                clearTimeout(gatherTimeoutHandle);
                                pc.removeEventListener('icegatheringstatechange', onGatherStateChange);
                                this.log(`ICE gathering complete`);
                                resolveGather();
                            }
                        };

                        pc.addEventListener('icegatheringstatechange', onGatherStateChange);
                    });
                }

                // Now send the offer with complete (or best-effort) SDP
                this.sendSignalingMessage(hostPeerId, {
                    type: 'offer',
                    sdp: pc.localDescription.sdp
                });

                clearTimeout(timeoutHandle);
                resolve();
            } catch (error) {
                clearTimeout(timeoutHandle);
                reject(error);
            }
        });
    }

    /**
     * Step 3: Wait for host to accept the join request
     */
    async waitForAcceptance(hostPeerId, timeout = 10000) {
        this.log(`Waiting for host ${hostPeerId} to accept`);

        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                this.off('joinAccepted', onJoinAccepted);
                this.off('joinRejected', onJoinRejected);
                reject(new Error('Join request timeout'));
            }, timeout);

            const onJoinAccepted = (data) => {
                if (data.peerId === hostPeerId) {
                    clearTimeout(timeoutHandle);
                    this.off('joinAccepted', onJoinAccepted);
                    this.off('joinRejected', onJoinRejected);
                    this.log(`Join accepted by host`);
                    
                    // Update connected users from host
                    this.connectedUsers = data.users || [];
                    
                    // Guest: make sure we're in the user list (host adds us when channel opens, but we need to know now)
                    if (!this.connectedUsers.some(u => u.id === this.peerId)) {
                        this.connectedUsers.push({
                            id: this.peerId,
                            username: this.username,
                            isHost: false,
                            displayName: this.username
                        });
                    }
                    
                    resolve(data);
                }
            };

            const onJoinRejected = (data) => {
                if (data.peerId === hostPeerId) {
                    clearTimeout(timeoutHandle);
                    this.off('joinAccepted', onJoinAccepted);
                    this.off('joinRejected', onJoinRejected);
                    reject(new Error(data.reason || 'Join request rejected'));
                }
            };

            this.on('joinAccepted', onJoinAccepted);
            this.on('joinRejected', onJoinRejected);
        });
    }

    /**
     * Step 4: Wait for game data channel to actually open
     */
    async openGameChannel(hostPeerId, timeout = 15000) {
        this.log(`Waiting for game channel with ${hostPeerId}`);
        
        const peerData = this.peerConnections.get(hostPeerId);
        if (!peerData || !peerData.pc || !peerData.channel) {
            throw new Error(`Channel not initialized for ${hostPeerId}`);
        }

        const pc = peerData.pc;
        const channel = peerData.channel;

        // Wait for data channel to open (ignore peer connection state, like DataConnection does)
        const channelReady = new Promise((resolve, reject) => {
            if (channel.readyState === 'open') {
                resolve();
                return;
            }

            const timeoutHandle = setTimeout(() => {
                channel.removeEventListener('open', onChannelOpen);
                channel.removeEventListener('error', onChannelError);
                reject(new Error(`Data channel timeout (state: ${channel.readyState})`));
            }, timeout);

            const onChannelOpen = () => {
                clearTimeout(timeoutHandle);
                channel.removeEventListener('open', onChannelOpen);
                channel.removeEventListener('error', onChannelError);
                resolve();
            };

            const onChannelError = (evt) => {
                clearTimeout(timeoutHandle);
                channel.removeEventListener('open', onChannelOpen);
                channel.removeEventListener('error', onChannelError);
                reject(new Error(`Data channel error: ${evt.error?.message || 'unknown'}`));
            };

            channel.addEventListener('open', onChannelOpen);
            channel.addEventListener('error', onChannelError);
        });

        // Wait for data channel to open
        await channelReady;
    }

    /**
     * Join a host's room (convenience method - calls all steps in sequence)
     */
    async joinRoom(hostPeerId) {
        this.log(`Joining room hosted by ${hostPeerId}`);
        this.emit('joinStarted', { hostPeerId });

        try {
            await this.initiateConnection(hostPeerId);
            await this.sendOffer(hostPeerId);
            this.emit('offerSent', { hostPeerId });
            
            await this.waitForAcceptance(hostPeerId);
            this.emit('acceptedByHost', { hostPeerId });
            this.emit('channelOpening', { hostPeerId });
            
            await this.openGameChannel(hostPeerId);
            this.emit('channelConnected', { hostPeerId });
            
            this.emit('joinedRoom', {
                peerId: hostPeerId,
                dataChannel: this.peerConnections.get(hostPeerId).channel
            });
        } catch (error) {
            this.emit('joinFailed', { hostPeerId, reason: error.message });
            throw error;
        }
    }

    /**
     * Create a room (become host)
     */
    createRoom() {
        this.log('Creating room');
        this.isHost = true;
        this.currentRoomPeerId = this.peerId;
        this.initializeUserList();

        if (!this.roomStatusInterval) {
            this.startRoomBroadcast();
        }

        this.emit('roomCreated');
        // Host immediately joins their own room
        this.emit('joinedRoom', {
            peerId: this.peerId,
            dataChannel: null  // Host doesn't have a data channel with themselves
        });
    }

    /**
     * Start room status broadcast
     * Only hosts broadcast their status
     */
    startRoomBroadcast() {
        if (this.roomStatusInterval) return;

        this.roomStatusInterval = setInterval(() => {
            if (this.isHost && this.tracker) {
                for (const [peerId, peerData] of this.peerConnections) {
                    if (peerData.connection) {
                        peerData.connection.send({
                            type: 'roomStatus',
                            peerId: this.peerId,
                            username: this.username,
                            hosting: true,
                            gameType: this.currentGameId,
                            maxPlayers: this.config.maxPlayers,
                            currentPlayers: this.connectedUsers.length,
                            slots: this.config.maxPlayers - this.connectedUsers.length
                        });
                    }
                }
            }
        }, this.config.broadcastInterval);
    }

    /**
     * Start stale room cleanup
     */
    startStaleRoomCleanup() {
        if (this.staleRoomCleanupInterval) return;

        this.staleRoomCleanupInterval = setInterval(() => {
            const now = Date.now();
            const stale = [];

            for (const [peerId, roomInfo] of this.discoveredRooms) {
                if (now - roomInfo.lastSeen > this.config.staleThreshold) {
                    stale.push(peerId);
                }
            }

            stale.forEach(peerId => {
                this.removeDiscoveredRoom(peerId);
            });
        }, this.config.staleThreshold);
    }

    /**
     * Get active game data channel
     */
    getDataChannel() {
        return this.dataChannel;
    }

    /**
     * Get discovered rooms
     */
    getAvailableRooms() {
        return Array.from(this.discoveredRooms.values());
    }

    /**
     * Helper: generate random peer ID
     */
    generatePeerId() {
        return 'peer_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Helper: convert game ID to hash (infohash)
     */
    async gameidToHash(gameId) {
        const encoder = new TextEncoder();
        const data = encoder.encode(gameId);
        const hashBuffer = await crypto.subtle.digest('SHA-1', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Fetch tracker list
     */
    async fetchTrackerList() {
        const hardcoded = [
            'wss://tracker.openwebtorrent.com/',
            'wss://tracker.btorrent.xyz/',
            'wss://tracker.fastcast.nz/',
            'wss://tracker.files.fm:7073/announce',
            'wss://tracker.sloppyta.co/',
            'wss://tracker.webtorrent.dev/',
            'wss://tracker.novage.com.ua/',
            'wss://tracker.magnetoo.io/',
            'wss://tracker.ghostchu-services.top:443/announce',
            'ws://tracker.ghostchu-services.top:80/announce',
            'ws://tracker.files.fm:7072/announce'
        ];

        const sources = [
            'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_all_ws.txt',
            'https://cdn.jsdelivr.net/gh/ngosang/trackerslist@master/trackers_all_ws.txt',
            'https://ngosang.github.io/trackerslist/trackers_all_ws.txt'
        ];

        const allFetched = [];

        for (const source of sources) {
            try {
                const response = await fetch(source, { timeout: 5000 });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const text = await response.text();
                const fetched = text
                    .split('\n')
                    .map(t => t.trim())
                    .filter(t => t && (t.startsWith('wss://') || t.startsWith('ws://')));

                allFetched.push(...fetched);
                this.log(`Fetched ${fetched.length} trackers from ${source}`);
            } catch (e) {
                this.log(`Failed to fetch from ${source}: ${e.message}`, 'error');
            }
        }

        const merged = [...new Set([...hardcoded, ...allFetched])];
        const newTrackers = merged.length - hardcoded.length;

        this.log(`Tracker list: ${hardcoded.length} hardcoded + ${newTrackers} fetched = ${merged.length} total`);
        return merged;
    }

    /**
     * Leave the current room
     */
    leaveRoom() {
        if (!this.currentRoomPeerId) {
            this.log('Not in a room');
            return;
        }

        const leftRoomId = this.currentRoomPeerId;
        this.log(`Leaving room ${leftRoomId}`);

        if (this.isHost) {
            // Host: notify all guests that host is leaving, then close connections
             this.log('Host leaving - notifying guests');
             for (const [peerId, peerData] of this.peerConnections) {
                 // Send disconnect notification through signaling channel if available
                 if (peerData.connection) {
                     try {
                         peerData.connection.send({
                             type: 'hostLeft',
                             peerId: this.peerId
                         });
                     } catch (e) {
                         this.log(`Could not notify guest ${peerId}: ${e.message}`, 'error');
                     }
                 }
                
                if (peerData.channel) {
                    // Clear handlers before closing
                    peerData.channel.onopen = null;
                    peerData.channel.onclose = null;
                    peerData.channel.onerror = null;
                    peerData.channel.onmessage = null;
                    peerData.channel.close();
                }
                if (peerData.pc) {
                    peerData.pc.onicecandidate = null;
                    peerData.pc.ondatachannel = null;
                    peerData.pc.close();
                    peerData.pc = null;
                }
                peerData.channel = null;
                peerData.status = 'signaling';
                // Clear join state flags
                peerData._joinRequested = false;
                peerData._joinAccepted = false;
                peerData._joinUsername = null;
            }
            this.isHost = false;
            if (this.roomStatusInterval) {
                clearInterval(this.roomStatusInterval);
                this.roomStatusInterval = null;
            }
        } else {
            // Guest: notify host, then close game connection
            const peerData = this.peerConnections.get(leftRoomId);
            if (peerData) {
                // Send disconnect notification
                if (peerData.connection) {
                    try {
                        peerData.connection.send({
                            type: 'guestLeft',
                            peerId: this.peerId
                        });
                    } catch (e) {
                        this.log(`Could not notify host: ${e.message}`, 'error');
                    }
                }
                
                if (peerData.channel) {
                    // Clear handlers before closing
                    peerData.channel.onopen = null;
                    peerData.channel.onclose = null;
                    peerData.channel.onerror = null;
                    peerData.channel.onmessage = null;
                    peerData.channel.close();
                }
                if (peerData.pc) {
                    peerData.pc.onicecandidate = null;
                    peerData.pc.ondatachannel = null;
                    peerData.pc.close();
                    peerData.pc = null;
                }
                peerData.channel = null;
                peerData.status = 'signaling';
                // Clear join state flags
                peerData._joinRequested = false;
                peerData._joinAccepted = false;
                peerData._joinUsername = null;
            }
        }

        this.dataChannel = null;
        this.currentRoomPeerId = null;
        this.connectedUsers = [];

        this.emit('leftRoom', leftRoomId);
    }

    /**
     * Disconnect from tracker
     */
    async disconnect() {
        this.log('Disconnecting');

        // Abort pending connection attempt
        if (this.connectionAbortController) {
            this.connectionAbortController.abort();
            this.connectionAbortController = null;
        }

        if (this.roomStatusInterval) {
            clearInterval(this.roomStatusInterval);
            this.roomStatusInterval = null;
        }

        if (this.staleRoomCleanupInterval) {
            clearInterval(this.staleRoomCleanupInterval);
            this.staleRoomCleanupInterval = null;
        }

        // Close all peer connections
        for (const peerData of this.peerConnections.values()) {
            if (peerData.channel) {
                peerData.channel.close();
            }
            if (peerData.pc) {
                peerData.pc.close();
            }
        }

        this.peerConnections.clear();
        this.discoveredRooms.clear();
        this.connectedUsers = [];

        if (this.tracker) {
            this.tracker.disconnect();
            this.tracker = null;
        }

        this.dataChannel = null;
        this.currentRoomPeerId = null;

        this.emit('disconnected');
    }

    /**
     * Update method (for GUI compatibility)
     */
    update(deltaTime) {
        // P2P doesn't need active polling
    }

    /**
     * Check if connected to P2P network
     */
    isConnected() {
        return this.tracker !== null;
    }

    /**
     * Check if in a room
     */
    isInRoom() {
        return this.currentRoomPeerId !== null;
    }

    /**
     * Check if current user is host
     */
    isCurrentUserHost() {
        return this.isHost;
    }

    /**
     * Set username
     */
    setUsername(name) {
        if (!name || name.trim() === '' || name.length < 2) {
            return Promise.reject(new Error('Username must be at least 2 characters long'));
        }

        if (!/^[a-zA-Z0-9_'-]+$/.test(name)) {
            return Promise.reject(new Error('Username can only contain letters, numbers, underscores, hyphens, and apostrophes'));
        }

        const oldUsername = this.username;
        const oldDisplayName = this.connectedUsers.find(u => u.id === this.peerId)?.displayName;
        
        this.username = name;

        if (this.isInRoom()) {
            const selfIndex = this.connectedUsers.findIndex(u => u.id === this.peerId);
            if (selfIndex !== -1) {
                this.connectedUsers[selfIndex].username = name;
                // Regenerate display name with new username
                this.connectedUsers[selfIndex].displayName = this.generateUniqueDisplayName(name, this.peerId);
            }
            this.broadcastUserList();
        }

        const newDisplayName = this.connectedUsers.find(u => u.id === this.peerId)?.displayName || name;

        this.emit('usernameChanged', {
            oldUsername: oldUsername,
            newUsername: name,
            displayName: newDisplayName
        });

        return Promise.resolve({
            oldUsername: oldUsername,
            newUsername: name,
            displayName: newDisplayName
        });
    }

    /**
     * Get connected peer count (peers we've established connections to)
     */
    getConnectedPeerCount() {
        return this.peerConnections.size;
    }

    /**
     * Get discovered peer count (total peers on tracker/DHT network)
     */
    getDiscoveredPeerCount() {
        return this.tracker ? this.tracker.getDiscoveredPeerCount() : 0;
    }

    /**
     * Send message through game data channel
     */
    send(message) {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            return false;
        }

        try {
            this.dataChannel.send(JSON.stringify(message));
            return true;
        } catch (error) {
            this.log(`Error sending message: ${error.message}`, 'error');
            return false;
        }
    }
}
