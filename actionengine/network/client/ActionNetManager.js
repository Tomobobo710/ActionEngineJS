/**
 * ActionNetManager - Core networking API for ActionEngine
 * 
 * A headless, event-driven WebSocket client for multiplayer games and apps.
 * Provides room/lobby pattern out of the box, but flexible enough for custom protocols.
 * 
 * FEATURES:
 * - Event-driven API (on/off pattern)
 * - Room/Lobby management
 * - Connection state tracking
 * - Message queue handling
 * - Reconnection support with exponential backoff
 * - Ping/RTT tracking
 * 
 * USAGE:
 * ```javascript
 * const net = new ActionNetManager({
 *     url: 'ws://yourserver.com:3000',
 *     autoConnect: false
 * });
 * 
 * net.on('connected', () => console.log('Connected!'));
 * net.on('roomList', (rooms) => console.log('Available rooms:', rooms));
 * net.on('message', (msg) => console.log('Received:', msg));
 * 
 * net.connectToServer({ username: 'Player1' });
 * net.joinRoom('lobby-1');
 * net.send({ type: 'chat', text: 'Hello!' });
 * ```
 */
class ActionNetManager {
    constructor(config = {}) {
        // Configuration
        this.config = {
            url: config.url || 'ws://localhost:3000',
            autoConnect: config.autoConnect !== undefined ? config.autoConnect : false,
            reconnect: config.reconnect !== undefined ? config.reconnect : false,
            reconnectDelay: config.reconnectDelay || 1000,
            maxReconnectDelay: config.maxReconnectDelay || 30000,
            reconnectAttempts: config.reconnectAttempts || -1,  // -1 = infinite
            pingInterval: config.pingInterval || 30000,          // Ping every 30 seconds
            pongTimeout: config.pongTimeout || 5000,             // Expect pong within 5 seconds
            debug: config.debug || false
        };

        // Connection state
        this.socket = null;
        this.isConnectedFlag = false;
        this.isInRoomFlag = false;
        this.connectionFailedFlag = false;

        // Client info
        this.clientId = null;           // Unique identifier (auto-generated or custom)
        this.username = null;           // User-facing name
        this.clientData = {};            // Custom metadata developers can set
        this.currentRoomName = null;

        // Room/Lobby data
        this.availableRooms = [];
        this.connectedClients = [];      // Clients in current room

        // Event handlers
        this.handlers = new Map();

        // Message queue (for polling pattern)
        this.messageQueue = [];

        // Reconnection tracking
        this.reconnectAttempt = 0;
        this.reconnectTimer = null;
        this.manualDisconnect = false;

        // Connection abort
        this.connectionAbortController = null;

        // Ping/RTT tracking
        this.pingTimer = null;
        this.pongTimer = null;
        this.lastPingTime = 0;
        this.rtt = 0;
        this.pingSequence = 0;

        // Auto-connect if enabled
        if (this.config.autoConnect && this.config.url) {
            this.connectToServer();
        }
    }

    /**
     * Register an event handler
     * 
     * Available events:
     * - 'connected': () => {} - Connected to server
     * - 'disconnected': () => {} - Disconnected from server
     * - 'error': (error) => {} - Connection/socket error
     * - 'message': (msg) => {} - Any message received
     * - 'roomList': (rooms) => {} - Available rooms updated
     * - 'userList': (users) => {} - Users in room updated
     * - 'joinedRoom': (roomName) => {} - Successfully joined room
     * - 'leftRoom': (roomName) => {} - Left room
     * - Custom events based on message.type
     */
    on(event, handler) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, []);
        }
        this.handlers.get(event).push(handler);
    }

    /**
     * Remove an event handler
     */
    off(event, handler) {
        if (!this.handlers.has(event)) return;
        const handlers = this.handlers.get(event);
        const index = handlers.indexOf(handler);
        if (index > -1) {
            handlers.splice(index, 1);
        }
    }

    /**
     * Emit an event to all registered handlers
     */
    emit(event, ...args) {
        if (!this.handlers.has(event)) return;
        const handlers = this.handlers.get(event);
        handlers.forEach(handler => {
            try {
                handler(...args);
            } catch (error) {
                if (this.config.debug) {
                    console.error('[ActionNetManager] Error in event handler:', error);
                }
            }
        });
    }

    /**
     * Connect to server
     * 
     * @param {Object} data - Client data (e.g., {username: 'Player1'})
     * @returns {Promise} - Resolves when connected
     */
    connectToServer(data = {}) {
        return new Promise((resolve, reject) => {
            try {
                if (this.config.debug) {
                    // console.log('[ActionNetManager] Connecting to:', this.config.url);
                }

                // Create abort controller for this connection attempt
                this.connectionAbortController = new AbortController();
                const signal = this.connectionAbortController.signal;

                // Check if already aborted
                if (signal.aborted) {
                    reject(new Error('Connection cancelled'));
                    return;
                }

                // Listen for abort signal
                signal.addEventListener('abort', () => {
                    reject(new Error('Connection cancelled'));
                });

                // Store client data
                this.clientData = data;

                // Set clientId (unique identifier)
                this.clientId = data.clientId || data.id || `client_${Date.now()}`;

                // Set username (user-facing name for UI)
                this.username = data.username || data.name || this.clientId;

                // Create WebSocket connection
                this.socket = new WebSocket(this.config.url);

                // Connection timeout
                const timeout = setTimeout(() => {
                    this.socket.close();
                    reject(new Error('Connection timeout'));
                }, 5000);

                // Connection opened
                this.socket.onopen = () => {
                    if (this.config.debug) {
                        // console.log('[ActionNetManager] WebSocket connected, waiting for server response');
                    }

                    // Send connect message with clientId and username
                    this.send({
                        type: 'connect',
                        clientId: this.clientId,       // Unique identifier
                        username: this.username,       // User-facing name
                        ...this.clientData             // Any additional metadata
                    });

                    // Wait for server confirmation
                    const messageHandler = (msg) => {
                        if (msg.type === 'connectSuccess') {
                            clearTimeout(timeout);
                            this.isConnectedFlag = true;
                            this.connectionFailedFlag = false;
                            this.reconnectAttempt = 0;  // Reset reconnect attempts on success

                            if (this.config.debug) {
                                // console.log('[ActionNetManager] Server connection confirmed');
                            }

                            // Start ping/pong if enabled
                            this.startPing();

                            this.emit('connected');
                            this.off('message', messageHandler);
                            this.connectionAbortController = null; // Clear abort controller
                            resolve();
                        } else if (msg.type === 'error') {
                            clearTimeout(timeout);
                            this.off('message', messageHandler);
                            this.connectionAbortController = null; // Clear abort controller
                            reject(new Error(msg.text));
                        }
                    };

                    this.on('message', messageHandler);
                };

                // Message received
                this.socket.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleMessage(message);
                    } catch (error) {
                        if (this.config.debug) {
                            console.error('[ActionNetManager] Failed to parse message:', error);
                        }
                    }
                };

                // Connection closed
                this.socket.onclose = () => {
                    if (this.config.debug) {
                        // console.log('[ActionNetManager] Disconnected from server');
                    }
                    
                    this.isConnectedFlag = false;
                    this.connectedClients = [];
                    this.rtt = 0;  // Reset RTT
                    this.stopPing();
                    this.emit('disconnected');

                    // Auto-reconnect if enabled and not manually disconnected
                    if (this.config.reconnect && !this.manualDisconnect) {
                        this.scheduleReconnect();
                    }
                };

                // Connection error
                this.socket.onerror = (error) => {
                    clearTimeout(timeout);
                    if (this.config.debug) {
                        console.error('[ActionNetManager] Connection error:', error);
                    }
                    this.connectionFailedFlag = true;
                    this.emit('error', error);
                    this.connectionAbortController = null; // Clear abort controller
                    reject(error);
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Join a room
     * 
     * @param {String} roomName - Name of room to join
     * @returns {Promise} - Resolves when joined
     */
    joinRoom(roomName) {
        if (!this.isConnectedFlag) {
            return Promise.reject(new Error('Not connected to server'));
        }

        return new Promise((resolve, reject) => {
            // Send join request with clientId and username
            this.send({
                type: 'joinRoom',
                roomName: roomName,
                clientId: this.clientId,       // Unique identifier
                username: this.username        // User-facing name
            });

            // Wait for confirmation
            const timeout = setTimeout(() => {
                this.off('message', successHandler);
                this.off('message', errorHandler);
                reject(new Error('Join room timeout'));
            }, 5000);

            // Listen for success
            const successHandler = (msg) => {
                if (msg.type === 'joinSuccess') {
                    clearTimeout(timeout);
                    this.currentRoomName = roomName;
                    this.isInRoomFlag = true;
                    this.emit('joinedRoom', roomName);
                    this.off('message', successHandler);
                    this.off('message', errorHandler);
                    resolve(roomName);
                }
            };

            const errorHandler = (msg) => {
                if (msg.type === 'error') {
                    clearTimeout(timeout);
                    this.off('message', successHandler);
                    this.off('message', errorHandler);
                    reject(new Error(msg.text || 'Failed to join room'));
                }
            };

            this.on('message', successHandler);
            this.on('message', errorHandler);
        });
    }

    /**
     * Leave current room
     */
    leaveRoom() {
        if (!this.isInRoomFlag || !this.currentRoomName) {
            if (this.config.debug) {
                // console.log('[ActionNetManager] Not in a room');
            }
            return;
        }

        this.send({
            type: 'leaveRoom',
            clientId: this.clientId,
            username: this.username
        });

        const oldRoom = this.currentRoomName;
        this.currentRoomName = null;
        this.isInRoomFlag = false;
        this.connectedClients = [];
        this.emit('leftRoom', oldRoom);
    }

    /**
     * Send a message to the server
     * 
     * @param {Object} message - Message object to send
     */
    send(message) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            if (this.config.debug) {
                console.error('[ActionNetManager] Cannot send: not connected');
            }
            return false;
        }

        try {
            this.socket.send(JSON.stringify(message));
            return true;
        } catch (error) {
            if (this.config.debug) {
                console.error('[ActionNetManager] Send error:', error);
            }
            return false;
        }
    }

    /**
     * Start ping timer
     */
    startPing() {
        if (this.config.pingInterval <= 0) return;

        this.stopPing();  // Clear any existing timers

        this.pingTimer = setInterval(() => {
            if (!this.isConnectedFlag) {
                this.stopPing();
                return;
            }

            // Send ping
            this.pingSequence++;
            this.lastPingTime = Date.now();
            
            this.send({
                type: 'ping',
                sequence: this.pingSequence,
                timestamp: this.lastPingTime
            });

            // Set pong timeout
            this.pongTimer = setTimeout(() => {
                if (this.config.debug) {
                    console.warn('[ActionNetManager] Pong timeout - connection may be dead');
                }
                this.emit('timeout');
                
                // Reconnect if timeout occurs
                if (this.config.reconnect) {
                    this.socket.close();
                }
            }, this.config.pongTimeout);

        }, this.config.pingInterval);
    }

    /**
     * Stop ping timer
     */
    stopPing() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
        if (this.pongTimer) {
            clearTimeout(this.pongTimer);
            this.pongTimer = null;
        }
    }

    /**
     * Schedule reconnect with exponential backoff
     */
    scheduleReconnect() {
        // Check if we've exceeded max attempts
        if (this.config.reconnectAttempts !== -1 && 
            this.reconnectAttempt >= this.config.reconnectAttempts) {
            if (this.config.debug) {
                // console.log('[ActionNetManager] Max reconnect attempts reached');
            }
            this.emit('reconnectFailed');
            return;
        }

        this.reconnectAttempt++;

        // Exponential backoff: delay * 2^attempt, capped at maxReconnectDelay
        const delay = Math.min(
            this.config.reconnectDelay * Math.pow(2, this.reconnectAttempt - 1),
            this.config.maxReconnectDelay
        );

        if (this.config.debug) {
            // console.log(`[ActionNetManager] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);
        }

        this.emit('reconnecting', { attempt: this.reconnectAttempt, delay });

        this.reconnectTimer = setTimeout(() => {
            this.connectToServer(this.clientData).catch(error => {
                if (this.config.debug) {
                    console.error('[ActionNetManager] Reconnect failed:', error);
                }
            });
        }, delay);
    }

    /**
     * Handle incoming messages
     */
    handleMessage(message) {
        // Add to message queue for polling pattern
        this.messageQueue.push(message);

        // Emit generic message event
        this.emit('message', message);

        // Handle specific message types
        switch (message.type) {
            case 'pong':
                // Handle pong response
                if (this.pongTimer) {
                    clearTimeout(this.pongTimer);
                    this.pongTimer = null;
                }
                
                // Calculate RTT
                if (message.sequence === this.pingSequence) {
                    this.rtt = Date.now() - this.lastPingTime;
                    this.emit('rtt', this.rtt);
                }
                break;

            case 'ping':
                // Auto-respond to server pings
                this.send({
                    type: 'pong',
                    sequence: message.sequence,
                    timestamp: message.timestamp
                });
                break;

            case 'roomList':
                this.availableRooms = message.rooms || [];
                this.emit('roomList', this.availableRooms);
                break;

            case 'userList':
                this.connectedClients = message.users || [];
                this.emit('userList', this.connectedClients);
                break;

            case 'userJoined':
                if (!this.connectedClients.some(c => c.id === message.id)) {
                    this.connectedClients.push(message);
                }
                this.emit('userJoined', message);
                break;

            case 'userLeft':
                this.connectedClients = this.connectedClients.filter(
                    c => c.id !== message.id
                );
                this.emit('userLeft', message);
                break;

            case 'hostLeft':
                this.emit('hostLeft', message);
                break;

            case 'chat':
                this.emit('chat', message);
                break;

            case 'system':
                this.emit('system', message);
                break;

            case 'error':
                this.emit('error', new Error(message.text || 'Server error'));
                break;

            default:
                // Emit custom event based on message type
                this.emit(message.type, message);
                break;
        }
    }

    /**
     * Get new messages from queue and clear it
     * (Useful for polling pattern instead of events)
     */
    getNewMessages() {
        const messages = [...this.messageQueue];
        this.messageQueue = [];
        return messages;
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        this.manualDisconnect = true;  // Flag to prevent auto-reconnect
        
        // Abort pending connection attempt
        if (this.connectionAbortController) {
            this.connectionAbortController.abort();
            this.connectionAbortController = null;
        }
        
        // Clear reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // Stop ping
        this.stopPing();

        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }

        this.isConnectedFlag = false;
        this.isInRoomFlag = false;
        this.connectionFailedFlag = false;
        this.currentRoomName = null;
        this.connectedClients = [];
        this.availableRooms = [];
        this.messageQueue = [];
        this.rtt = 0;  // Reset RTT
        this.reconnectAttempt = 0;
    }

    /**
     * Get available rooms
     */
    getAvailableRooms() {
        return [...this.availableRooms];
    }

    /**
     * Get connected users in current room
     */
    getConnectedUsers() {
        return [...this.connectedClients];
    }

    /**
     * Get username
     */
    getUsername() {
        return this.username;
    }

    /**
     * Check if connected to server
     */
    isConnected() {
        return this.isConnectedFlag;
    }

    /**
     * Check if in a room
     */
    isInRoom() {
        return this.isInRoomFlag;
    }

    /**
     * Check if connection failed
     */
    connectionFailed() {
        return this.connectionFailedFlag;
    }

    /**
     * Get current room name
     */
    getCurrentRoomName() {
        return this.currentRoomName;
    }

    /**
     * Get client ID (unique identifier)
     */
    getClientId() {
        return this.clientId;
    }

    /**
     * Set username (sends change request to server)
     *
     * @param {String} name - New username
     * @returns {Promise} - Resolves when username change is confirmed
     */
    setUsername(name) {
        if (!this.isConnectedFlag) {
            return Promise.reject(new Error('Not connected to server'));
        }

        // Validate new username locally
        if (!name || name.trim() === '' || name.length < 2) {
            return Promise.reject(new Error('Username must be at least 2 characters long'));
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
            return Promise.reject(new Error('Username can only contain letters, numbers, underscores, and hyphens'));
        }

        return new Promise((resolve, reject) => {
            // Send username change request
            this.send({
                type: 'changeUsername',
                username: name
            });

            // Wait for confirmation
            const timeout = setTimeout(() => {
                this.off('message', successHandler);
                this.off('message', errorHandler);
                reject(new Error('Username change timeout'));
            }, 5000);

            // Listen for success
            const successHandler = (msg) => {
                if (msg.type === 'usernameChangeSuccess') {
                    clearTimeout(timeout);
                    // Update local username
                    this.username = msg.newUsername;
                    this.emit('usernameChanged', {
                        oldUsername: msg.oldUsername,
                        newUsername: msg.newUsername,
                        displayName: msg.displayName
                    });
                    this.off('message', successHandler);
                    this.off('message', errorHandler);
                    resolve({
                        oldUsername: msg.oldUsername,
                        newUsername: msg.newUsername,
                        displayName: msg.displayName
                    });
                }
            };

            const errorHandler = (msg) => {
                if (msg.type === 'error') {
                    clearTimeout(timeout);
                    this.off('message', successHandler);
                    this.off('message', errorHandler);
                    reject(new Error(msg.text || 'Username change failed'));
                }
            };

            this.on('message', successHandler);
            this.on('message', errorHandler);
        });
    }


    /**
     * Get current RTT in milliseconds
     */
    getRTT() {
        return this.rtt;
    }

    /**
     * Get current reconnect attempt count
     */
    getReconnectAttempts() {
        return this.reconnectAttempt;
    }

    /**
     * Get the host of the current room
     * @returns {Object|null} - Host client info or null if not in room or no host found
     */
    getHost() {
        if (!this.isInRoomFlag) {
            return null;
        }
        
        const host = this.connectedClients.find(client => client.isHost === true);
        return host || null;
    }

    /**
     * Check if the current user is the host of their room
     * @returns {Boolean}
     */
    isCurrentUserHost() {
        if (!this.isInRoomFlag) {
            return false;
        }
        
        const host = this.getHost();
        return host && host.id === this.clientId;
    }

    /**
     * Test server availability without full connection
     * @returns {Promise<{available: boolean, error?: string}>}
     */
    testServerConnection() {
        return new Promise((resolve) => {
            const testSocket = new WebSocket(this.config.url);

            const timeout = setTimeout(() => {
                testSocket.close();
                resolve({ available: false, error: 'Connection timeout' });
            }, 1000); // 1 second timeout

            testSocket.onopen = () => {
                clearTimeout(timeout);
                testSocket.close();
                resolve({ available: true });
            };

            testSocket.onerror = (error) => {
                clearTimeout(timeout);
                testSocket.close();
                resolve({ available: false, error: 'Connection failed' });
            };
        });
    }

    /**
     * Update loop (optional - for compatibility with ActionEngine game loop)
     */
    update(deltaTime) {
        // Handle connection state updates
        if (this.socket && this.socket.readyState === WebSocket.CLOSED && this.isConnectedFlag) {
            this.isConnectedFlag = false;
            this.connectedClients = [];
        }
    }
}
