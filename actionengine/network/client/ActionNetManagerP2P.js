/**
 * ActionNetManagerP2P - P2P network manager using WebTorrent + WebRTC
 * 
 * Replaces the WebSocket relay server with peer discovery and direct connections.
 * 
 * ARCHITECTURE:
 * - DHT/WebTorrent: Discovery + room status broadcasting
 * - WebRTC: Direct peer connections for game data
 * - SyncSystem: Game state synchronization (unchanged)
 * 
 * USAGE:
 * ```javascript
 * const net = new ActionNetManagerP2P({ debug: true });
 * 
 * // Join a game (create or find)
 * net.joinGame('tetris-1v1');
 * 
 * // Listen for discovered rooms
 * net.on('roomsUpdated', (rooms) => {
 *   console.log('Available rooms:', rooms);
 * });
 * 
 * // Join a host's room
 * net.joinRoom(hostPeerId).then(() => {
 *   // Connected! Get the data channel
 *   const dataChannel = net.getDataChannel();
 * });
 * ```
 */
class ActionNetManagerP2P {
    constructor(config = {}) {
        this.config = {
            debug: config.debug || false,
            gameId: config.gameId || 'game-id-00000', // Game ID for DHT discovery
            broadcastInterval: config.broadcastInterval || 1000, // Send room status every 1s
            staleThreshold: config.staleThreshold || 5000, // Room stale after 5s
            maxPlayers: config.maxPlayers || 2, // Maximum players per room
            iceServers: config.iceServers || [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" }
            ]
        };

        // State
        this.currentGameId = null;
        this.peerId = null;
        this.username = "Anonymous";
        this.isHost = false;
        this.currentRoomPeerId = null;

        // WebTorrent
        this.client = null;
        this.torrent = null;

        // WebRTC
        this.peerConnections = new Map(); // peerId -> {pc, channel, wire, status}
        this.dataChannel = null; // Active game connection

        // Room tracking
        this.discoveredRooms = new Map(); // peerId -> room info
        this.roomStatusInterval = null;
        this.staleRoomCleanupInterval = null;
        this.connectedUsers = []; // {id, username, isHost} in current room
        this.userListVersion = 0; // For tracking updates

        // Event handlers
        this.handlers = new Map();

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
     * Join a game (start WebTorrent discovery)
     */
    async joinGame(gameId, username = 'Anonymous') {
        this.currentGameId = gameId;
        this.username = username;
        this.peerId = this.generatePeerId();

        this.log(`Joining game: ${gameId} as ${this.peerId}`);

        // Create WebTorrent client
        this.client = new WebTorrent();

        // Generate a stable magnet URI from the game ID
        const magnetUri = await this.gameidToMagnet(gameId);
        this.log(`Magnet URI: ${magnetUri}`);

        // Fetch and merge tracker lists
        const trackers = await this.fetchTrackerList();

        // Add torrent
        this.torrent = this.client.add(magnetUri, {
            announce: trackers
        });

        // Setup wire handler for peer discovery
        this.torrent.on('wire', (wire, addr) => {
            this.handleWire(wire);
        });

        // Start broadcasting room status
        this.startRoomBroadcast();

        // Emit connected event
        this.emit('connected');
    }

    /**
     * Initialize user list when room is created/joined
     */
    initializeUserList() {
        // Clear existing list
        this.connectedUsers = [];
        this.userListVersion = 0;

        // Add self
        this.addUser({
            id: this.peerId,
            username: this.username,
            isHost: this.isHost
        });
    }

    /**
     * Add user to connected list and emit event
     */
    addUser(user) {
        // Don't add duplicate
        if (this.connectedUsers.some(u => u.id === user.id)) {
            return;
        }

        this.connectedUsers.push(user);
        this.userListVersion++;
        this.log(`User joined: ${user.username} (${user.id})`);

        this.emit('userJoined', user);
        this.emit('userList', this.connectedUsers);

    }

    /**
     * Remove user from connected list and emit event
     */
    removeUser(userId) {
        const index = this.connectedUsers.findIndex(u => u.id === userId);
        if (index === -1) return;

        const user = this.connectedUsers[index];
        this.connectedUsers.splice(index, 1);
        this.userListVersion++;
        this.log(`User left: ${user.username} (${user.id})`);

        this.emit('userLeft', user);
        this.emit('userList', this.connectedUsers);

        // Host broadcasts updated list
        if (this.isHost) {
            this.broadcastUserList();
        }
    }

    /**
     * Remove discovered room (when we disconnect from it)
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
     * Broadcast user list to all peers in room
     */
    broadcastUserList() {
        for (const [peerId, peerData] of this.peerConnections) {
            if (peerData.status === 'connected') {
                this.sendSignalingMessage(peerId, {
                    type: 'userList',
                    users: this.connectedUsers,
                    version: this.userListVersion
                });
            }
        }
    }

    /**
     * Handle wire connection (peer discovered)
     */
    handleWire(wire) {
        const peerId = this.peerIdToString(wire.peerId);
        this.log(`Wire event - Discovered peer: ${peerId}`);

        // Don't connect to ourselves
        if (peerId === this.peerId) {
            this.log('Ignoring connection to self');
            return;
        }

        // Don't duplicate
        if (this.peerConnections.has(peerId)) {
            this.log(`Already have connection to ${peerId}`);
            return;
        }

        // Register extension and store
        wire.use(this.createSignalingExtension(peerId));

        this.peerConnections.set(peerId, {
            pc: null,
            channel: null,
            wire: wire,
            status: 'signaling'
        });

        this.log(`Registered extension for ${peerId}`);

        // Send handshake to establish baseline
        this.sendSignalingMessage(peerId, {
            type: 'handshake',
            peerId: this.peerId,
            gameId: this.currentGameId
        });

        // If we're a host, immediately send our room status to this new peer
        if (this.isHost) {
            this.sendHostStatus(peerId);
        }
    }

    /**
     * Create WebRTC signaling extension for a peer
     */
    createSignalingExtension(peerId) {
        const self = this;

        class SignalingExtension {
            constructor(wire) {
                this.wire = wire;
            }

            onHandshake() {
                self.log(`Handshake complete for ${peerId}`);
            }

            onExtendedHandshake() {
                self.log(`Extended handshake for ${peerId}`);
            }

            onMessage(buf) {
                try {
                    let messageStr;
                    if (typeof buf === 'string') {
                        messageStr = buf;
                    } else if (buf instanceof Uint8Array) {
                        const decoder = new TextDecoder();
                        messageStr = decoder.decode(buf);
                    } else {
                        messageStr = buf.toString();
                    }

                    // Strip netstring prefix if present
                    const colonIndex = messageStr.indexOf(':');
                    if (colonIndex > 0) {
                        const lengthStr = messageStr.substring(0, colonIndex);
                        if (/^\d+$/.test(lengthStr)) {
                            messageStr = messageStr.substring(colonIndex + 1);
                        }
                    }

                    const message = JSON.parse(messageStr);
                    self.handleSignalingMessage(peerId, message);
                } catch (e) {
                    self.log(`Error parsing message: ${e.message}`, 'error');
                }
            }

            send(data) {
                if (this.wire && this.wire.extended) {
                    try {
                        this.wire.extended('p2p_signal', data);
                    } catch (e) {
                        self.log(`Error sending: ${e.message}`, 'error');
                    }
                }
            }
        }

        SignalingExtension.prototype.name = 'p2p_signal';
        return SignalingExtension;
    }

    /**
     * Handle signaling message
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
            case 'offer':
                this.handleOffer(peerId, message);
                break;
            case 'answer':
                this.handleAnswer(peerId, message);
                break;
            case 'ice-candidate':
                this.handleIceCandidate(peerId, message);
                break;
            case 'joinRequest':
                this.handleJoinRequest(peerId, message);
                break;
            case 'userList':
                this.handleUserList(peerId, message);
                break;
            case 'joinAccepted':
                this.handleJoinAccepted(peerId, message);
                break;
            case 'joinRejected':
                this.handleJoinRejected(peerId, message);
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
    }

    /**
     * Handle room status broadcast
     */
    handleRoomStatus(peerId, message) {
        this.log(`Room status from ${peerId}: ${message.gameType}`);

        // Update discovered rooms
        this.discoveredRooms.set(peerId, {
            peerId: peerId,
            username: message.username,
            hosting: message.hosting,
            gameType: message.gameType,
            maxPlayers: message.maxPlayers,
            currentPlayers: message.currentPlayers,
            slots: message.slots,
            lastSeen: Date.now()
        });

        this.emit('roomList', Array.from(this.discoveredRooms.values()));
    }

    /**
     * Handle offer
     */
    async handleOffer(peerId, message) {
        this.log(`Offer from ${peerId}`);

        const peerData = this.peerConnections.get(peerId);
        if (!peerData) return;

        // Create RTCPeerConnection if needed
        if (!peerData.pc) {
            peerData.pc = new RTCPeerConnection({
                iceServers: this.config.iceServers
            });

            // Listen for data channel
            peerData.pc.ondatachannel = (evt) => {
                this.log(`Data channel received from ${peerId}`);
                peerData.channel = evt.channel;
                this.setupDataChannel(peerId, evt.channel);
            };

            peerData.pc.onicecandidate = (evt) => {
                if (evt.candidate) {
                    this.sendSignalingMessage(peerId, {
                        type: 'ice-candidate',
                        candidate: evt.candidate
                    });
                }
            };
        }

        // Set remote description and create answer
        await peerData.pc.setRemoteDescription({ type: 'offer', sdp: message.sdp });
        const answer = await peerData.pc.createAnswer();
        await peerData.pc.setLocalDescription(answer);

        // Send answer
        this.sendSignalingMessage(peerId, {
            type: 'answer',
            sdp: peerData.pc.localDescription.sdp
        });
    }

    /**
     * Handle answer
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
        } catch (e) {
            this.log(`Error adding ICE candidate: ${e.message}`, 'error');
        }
    }

    /**
     * Handle join request from another peer
     */
    handleJoinRequest(peerId, message) {
        this.log(`Join request from ${peerId}`);

        if (!this.isHost) {
            this.log('Not a host, ignoring join request');
            return;
        }

        // Check room capacity
        const connectedPeers = Array.from(this.peerConnections.values())
            .filter(p => p.status === 'connected')
            .length;
        
        const currentPlayers = connectedPeers + 1; // +1 for host
        
        if (currentPlayers >= this.config.maxPlayers) {
            this.log(`Room full (${currentPlayers}/${this.config.maxPlayers}), rejecting join from ${peerId}`);
            this.rejectJoin(peerId);
            return;
        }

        // Store username for later (when we accept)
        const peerData = this.peerConnections.get(peerId);
        if (peerData) {
            peerData.username = message.username;
        }

        // Game logic decides if we accept
        this.emit('joinRequest', {
            peerId: peerId,
            username: message.username,
            accept: () => this.acceptJoin(peerId),
            reject: () => this.rejectJoin(peerId)
        });
    }

    /**
     * Handle user list broadcast from host
     */
    handleUserList(peerId, message) {
        this.log(`User list from ${peerId}: ${message.users.length} users`);

        // Update internal list
        this.connectedUsers = message.users;
        this.userListVersion = message.version;

        // Emit event so game can update UI
        this.emit('userList', this.connectedUsers);
    }

    /**
     * Handle join acceptance from host
     */
    handleJoinAccepted(peerId, message) {
        this.log(`Join accepted from ${peerId}`);

        const peerData = this.peerConnections.get(peerId);
        if (peerData) {
            peerData.status = 'joining'; // Transition state
        }

        // Emit event so game knows join was approved
        this.emit('joinAccepted', {
            peerId: peerId
        });
    }

    /**
     * Handle join rejection from host
     */
    handleJoinRejected(peerId, message) {
        const reason = message.reason || 'Unknown';
        this.log(`Join rejected from ${peerId}: ${reason}`);

        const peerData = this.peerConnections.get(peerId);
        if (peerData) {
            peerData.status = 'rejected';
            // Close connection
            if (peerData.channel) peerData.channel.close();
            if (peerData.pc) peerData.pc.close();
        }

        // Emit event so game can show error to user
        this.emit('joinRejected', {
            peerId: peerId,
            reason: reason
        });
    }

    /**
     * Accept join request
     */
    acceptJoin(peerId) {
        this.log(`Accepting join from ${peerId}`);
        
        const peerData = this.peerConnections.get(peerId);
        if (peerData) {
            this.addUser({
                id: peerId,
                username: peerData.username || peerId,
                isHost: false
            });
        }
        
        // Emit userList to self so host also updates remote player username
        this.emit('userList', this.connectedUsers);
        
        this.sendSignalingMessage(peerId, {
            type: 'joinAccepted'
        });
    }

    /**
     * Reject join request
     */
    rejectJoin(peerId) {
        this.log(`Rejecting join from ${peerId}`);
        this.sendSignalingMessage(peerId, {
            type: 'joinRejected',
            reason: 'Room full'
        });
    }

    /**
     * Setup data channel (both sides)
     */
    setupDataChannel(peerId, channel) {
        const peerData = this.peerConnections.get(peerId);
        if (!peerData) return;

        peerData.channel = channel;

        channel.onopen = () => {
            this.log(`Data channel open with ${peerId}`);
            peerData.status = 'connected';

            // If this is our game connection (joiner perspective), emit
            if (peerId === this.currentRoomPeerId) {
                this.dataChannel = channel;
                this.emit('joinedRoom', {
                    peerId: peerId,
                    dataChannel: channel
                });
            }

            // If we're a host and this is our first joiner, set up game sync
            if (this.isHost && !this.dataChannel) {
                this.log(`Host: setting up game sync with first joiner ${peerId}`);
                this.dataChannel = channel;
                this.emit('joinedRoom', {
                    peerId: peerId,
                    dataChannel: channel
                });
            }

            // Host: broadcast user list now that this peer is connected
            if (this.isHost) {
                this.broadcastUserList();
            }
        };

        channel.onclose = () => {
            this.log(`Data channel closed with ${peerId}`);
            peerData.status = 'disconnected';

            // Remove peer from the user list
            this.removeUser(peerId);

            // Clean up WebRTC connection
            if (peerData.pc) {
                peerData.pc.close();
                peerData.pc = null;
            }

            // If this was our active game connection, clear it
            if (channel === this.dataChannel) {
                this.dataChannel = null;
                this.log(`Cleared active data channel`);
            }

            if (peerId === this.currentRoomPeerId) {
                this.log(`Emitting leftRoom for ${peerId}`);
                this.emit('leftRoom', this.currentRoomPeerId);
                
                // If we were a joiner in that room, remove it from discovered rooms
                if (!this.isHost) {
                    this.removeDiscoveredRoom(peerId);
                }
            }
        };

        channel.onerror = (evt) => {
            this.log(`Channel error with ${peerId}: ${evt.error}`, 'error');
        };
    }

    /**
     * Send host status (room info) to a specific peer
     */
    sendHostStatus(peerId) {
        if (!this.isHost) return;

        // Get current connected peers
        const connectedPeers = Array.from(this.peerConnections.values())
            .filter(p => p.status === 'connected')
            .length;

        this.log(`Sending host status to ${peerId}`);

        this.sendSignalingMessage(peerId, {
            type: 'roomStatus',
            peerId: this.peerId,
            username: this.username,
            hosting: true,
            gameType: this.currentGameId,
            maxPlayers: this.config.maxPlayers,
            currentPlayers: connectedPeers + 1, // +1 for self
            slots: []
        });
    }

    /**
     * Broadcast room status to all peers
     */
    startRoomBroadcast() {
        this.roomStatusInterval = setInterval(() => {
            if (this.isHost) {
                // Send to all known peers
                for (const peerId of this.peerConnections.keys()) {
                    this.sendHostStatus(peerId);
                }
            }
        }, this.config.broadcastInterval);

        // Also start stale room cleanup if not already running
        if (!this.staleRoomCleanupInterval) {
            this.staleRoomCleanupInterval = setInterval(() => {
                this.cleanupStaleRooms();
            }, 2000); // Check every 2 seconds
        }
    }

    /**
     * Clean up rooms that haven't been seen recently
     */
    cleanupStaleRooms() {
        const now = Date.now();
        const staleThreshold = 1000; // 3 seconds (rooms broadcast every ~1 second)
        let removed = 0;

        for (const [peerId, room] of this.discoveredRooms) {
            if (now - room.lastSeen > staleThreshold) {
                this.log(`Removing stale room from ${peerId}`);
                this.discoveredRooms.delete(peerId);
                removed++;
            }
        }

        if (removed > 0) {
            this.emit('roomList', Array.from(this.discoveredRooms.values()));
        }
    }

    /**
     * Broadcast signaling message to all peers
     */
    broadcastSignaling(message) {
        for (const [peerId, peerData] of this.peerConnections) {
            this.sendSignalingMessage(peerId, message);
        }
    }

    /**
     * Send signaling message to specific peer
     */
    sendSignalingMessage(peerId, message) {
        const peerData = this.peerConnections.get(peerId);
        if (!peerData || !peerData.wire) {
            this.log(`No wire for ${peerId}`);
            return;
        }

        try {
            const ext = peerData.wire.p2p_signal;
            if (!ext) {
                this.log(`Extension not ready for ${peerId}`);
                return;
            }
            ext.send(JSON.stringify(message));
        } catch (e) {
            this.log(`Error sending to ${peerId}: ${e.message}`, 'error');
        }
    }

    /**
     * Join a host's room
     */
    async joinRoom(hostPeerId) {
        this.log(`Joining room hosted by ${hostPeerId}`);

        const hostData = this.peerConnections.get(hostPeerId);
        if (!hostData) {
            throw new Error(`No connection to host ${hostPeerId}`);
        }

        this.currentRoomPeerId = hostPeerId;
        this.isHost = false;

        // Create WebRTC connection
        const pc = new RTCPeerConnection({
            iceServers: this.config.iceServers
        });

        hostData.pc = pc;

        // Create data channel
        const channel = pc.createDataChannel('game');
        hostData.channel = channel;

        // DON'T setupDataChannel yet - wait for host acceptance first
        // Just set up the channel event handlers manually

        channel.onopen = () => {
            this.log(`Data channel opened with ${hostPeerId}`);
            hostData.status = 'connected';
            this.dataChannel = channel;
            this.log(`Joiner: data channel now active with host`);
            this.emit('joinedRoom', {
                peerId: hostPeerId,
                dataChannel: channel
            });
        };

        channel.onclose = () => {
            this.log(`Data channel closed with ${hostPeerId}`);
            hostData.status = 'disconnected';
            if (channel === this.dataChannel) {
                this.dataChannel = null;
            }
            this.emit('leftRoom', hostPeerId);
        };

        channel.onerror = (evt) => {
            this.log(`Channel error with ${hostPeerId}: ${evt.error}`, 'error');
        };

        // Setup ICE and signaling
        pc.onicecandidate = (evt) => {
            if (evt.candidate) {
                this.sendSignalingMessage(hostPeerId, {
                    type: 'ice-candidate',
                    candidate: evt.candidate
                });
            }
        };

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Send join request + offer
        this.sendSignalingMessage(hostPeerId, {
            type: 'joinRequest',
            peerId: this.peerId,
            username: this.username
        });

        this.sendSignalingMessage(hostPeerId, {
            type: 'offer',
            sdp: pc.localDescription.sdp
        });

        // Wait for acceptance or rejection
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Join request timeout'));
            }, 10000);

            // Handle rejection
            const onReject = (msg) => {
                if (msg.peerId === hostPeerId && msg.type === 'joinRejected') {
                    clearTimeout(timeout);
                    this.networkManager?.off('message', onReject);
                    this.networkManager?.off('message', onAccept);
                    reject(new Error(msg.reason || 'Join request rejected'));
                }
            };

            // Handle acceptance
            const onAccept = (msg) => {
                if (msg.peerId === hostPeerId && msg.type === 'joinAccepted') {
                    clearTimeout(timeout);
                    this.networkManager?.off('message', onReject);
                    this.networkManager?.off('message', onAccept);
                    this.log(`Join accepted by host`);
                    // Data channel will emit 'open' event when ready
                    // Resolve when channel opens
                    const onChannelOpen = () => {
                        channel.removeEventListener('open', onChannelOpen);
                        resolve();
                    };
                    
                    if (channel.readyState === 'open') {
                        resolve();
                    } else {
                        channel.addEventListener('open', onChannelOpen);
                    }
                }
            };

            // Listen on ActionNetManagerP2P events, not network manager
            this.on('joinRejected', (data) => {
                if (data.peerId === hostPeerId) {
                    clearTimeout(timeout);
                    reject(new Error(data.reason || 'Join request rejected'));
                }
            });

            this.on('joinAccepted', (data) => {
                if (data.peerId === hostPeerId) {
                    clearTimeout(timeout);
                    this.log(`Join accepted by host`);
                    const onChannelOpen = () => {
                        channel.removeEventListener('open', onChannelOpen);
                        resolve();
                    };
                    
                    if (channel.readyState === 'open') {
                        resolve();
                    } else {
                        channel.addEventListener('open', onChannelOpen);
                    }
                }
            });
        });
    }

    /**
     * Create a room (become host)
     */
    createRoom() {
        this.log('Creating room');
        this.isHost = true;
        this.currentRoomPeerId = this.peerId; // Host's room is themselves
        this.initializeUserList(); // Initialize with just host
        
        // Start/restart room broadcast (may need to restart if we left before)
        if (!this.roomStatusInterval) {
            this.startRoomBroadcast();
        }
        
        this.emit('roomCreated');
        // Host is considered "joined" to their own room
        this.emit('joinedRoom', { peerId: this.peerId, dataChannel: this.dataChannel });
    }

    /**
     * Get active data channel
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
     * Helper: convert peer ID to string
     */
    peerIdToString(peerId) {
        if (typeof peerId === 'string') return peerId;
        if (peerId.toString) return peerId.toString('hex');
        return String(peerId);
    }

    /**
     * Helper: generate random peer ID
     */
    generatePeerId() {
        return 'peer_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Helper: convert game ID to magnet URI
     */
    async gameidToMagnet(gameId) {
        const encoder = new TextEncoder();
        const data = encoder.encode(gameId);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return `magnet:?xt=urn:btih:${hashHex.substring(0, 40)}`;
    }

    /**
     * Fetch and merge tracker lists from multiple sources
     * Hardcoded trackers are prioritized, fetched trackers are merged in (deduped)
     * Falls back to hardcoded list if all fetches fail
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

        // Try to fetch from multiple sources
        const sources = [
            'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_all_ws.txt',
            'https://cdn.jsdelivr.net/gh/ngosang/trackerslist@master/trackers_all_ws.txt',
            'https://ngosang.github.io/trackerslist/trackers_all_ws.txt'
        ];

        const allFetched = [];

        for (const source of sources) {
            try {
                const response = await fetch(source, {
                    timeout: 5000 // 5 second timeout per source
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

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

        // Merge all sources: dedupe with Set, hardcoded first (so they're prioritized)
        const merged = [...new Set([...hardcoded, ...allFetched])];
        const newTrackers = merged.length - hardcoded.length;

        this.log(`Tracker list: ${hardcoded.length} hardcoded + ${newTrackers} fetched = ${merged.length} total`);
        return merged.length > hardcoded.length ? merged : hardcoded;
    }

    /**
     * Leave the current room
     */
    leaveRoom() {
        if (!this.currentRoomPeerId) {
            this.log('Not in a room');
            return;
        }

        this.log(`Leaving room ${this.currentRoomPeerId}`);

        // If we're a host, close all guest connections
        if (this.isHost) {
            this.log('Host leaving - closing all guest connections');
            for (const [peerId, peerData] of this.peerConnections) {
                if (peerData.channel && peerData.channel.readyState === 'open') {
                    this.log(`Closing data channel with guest ${peerId}`);
                    peerData.channel.close();
                }
            }
            
            this.isHost = false;
            if (this.roomStatusInterval) {
                clearInterval(this.roomStatusInterval);
                this.roomStatusInterval = null;
            }
        } else {
            // We're a guest, close the data channel but keep peer connection for rejoining
            const peerData = this.peerConnections.get(this.currentRoomPeerId);
            if (peerData) {
                if (peerData.channel) {
                    peerData.channel.close();
                    peerData.channel = null;
                }
                // Don't close the WebRTC connection yet - we may rejoin
                // Just mark it as disconnected
                peerData.status = 'disconnected';
            }
        }

        this.dataChannel = null;
        this.currentRoomPeerId = null;
        this.connectedUsers = [];

        // Emit leftRoom event
        this.emit('leftRoom', this.currentRoomPeerId);
    }

    /**
     * Cleanup and disconnect
     */
    async disconnect() {
        this.log('Disconnecting');

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
            if (peerData.channel) peerData.channel.close();
            if (peerData.pc) peerData.pc.close();
        }

        this.peerConnections.clear();
        this.discoveredRooms.clear();
        this.connectedUsers = [];

        if (this.client) {
            this.client.destroy();
        }

        this.dataChannel = null;
        this.currentRoomPeerId = null;

        // Emit disconnected event
        this.emit('disconnected');
    }

    /**
     * Update method (required by ActionNetManagerGUI)
     * For P2P, no periodic updates needed since DHT handles discovery
     */
    update(deltaTime) {
        // P2P doesn't need active polling like WebSocket does
    }

    /**
     * Check if connected to DHT/P2P network
     */
    isConnected() {
        return this.client !== null;
    }

    /**
     * Check if in a room (hosting or joined)
     */
    isInRoom() {
        return this.currentRoomPeerId !== null;
    }

    /**
     * Check if current user is the host
     */
    isCurrentUserHost() {
        return this.isHost;
    }

    /**
     * Set username (P2P: local update + broadcast to peers)
     * 
     * @param {String} name - New username
     * @returns {Promise} - Resolves when username is updated
     */
    setUsername(name) {
        // Validate new username locally
        if (!name || name.trim() === '' || name.length < 2) {
            return Promise.reject(new Error('Username must be at least 2 characters long'));
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
            return Promise.reject(new Error('Username can only contain letters, numbers, underscores, and hyphens'));
        }

        // For P2P, just update local username immediately (no server confirmation needed)
        const oldUsername = this.username;
        this.username = name;

        // Broadcast updated user list to all connected peers if in a room
        if (this.isInRoom()) {
            // Update our entry in connectedUsers
            const selfIndex = this.connectedUsers.findIndex(u => u.id === this.peerId);
            if (selfIndex !== -1) {
                this.connectedUsers[selfIndex].username = name;
            }

            // Broadcast to all peers
            this.broadcastUserList();
        }

        // Emit event for UI updates
        this.emit('usernameChanged', {
            oldUsername: oldUsername,
            newUsername: name,
            displayName: name
        });

        return Promise.resolve({
            oldUsername: oldUsername,
            newUsername: name,
            displayName: name
        });
    }

    /**
     * Send a message to the connected peer via data channel
     */
    send(message) {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            if (this.config.debug) {
                console.error('[ActionNetManagerP2P] Cannot send: data channel not open');
            }
            return false;
        }

        try {
            this.dataChannel.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error('[ActionNetManagerP2P] Error sending message:', error);
            return false;
        }
    }
    }
