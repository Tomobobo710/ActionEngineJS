/**
 * ActionNetManagerGUI - Bridge component for networking setup and lobby UI.
 *
 * Handles connection to server, login UI, and lobby UI using observer pattern to communicate with the main game.
 * Hands off control when user joins a room (game takes over).
 * Provides access to ActionNetManager for client info.
 * Games should provide their own title screen and integrate this component for multiplayer features.
 */
class ActionNetManagerGUI {
    static WIDTH = 800;
    static HEIGHT = 600;

    // Network configuration - matches Game.NETWORK_CONFIG
    static NETWORK_CONFIG = {
        hostname: window.location.hostname, // Auto-detect from current page
        protocol: window.location.protocol === 'https:' ? 'wss:' : 'ws:', // Auto-detect protocol
        autoConnect: false,
        reconnect: true,
        reconnectDelay: 1000,
        maxReconnectDelay: 10000,
        reconnectAttempts: 5,
        pingInterval: 30000,
        debug: true
    };

    // P2P Network configuration
    static P2P_NETWORK_CONFIG = {
        gameId: 'game-id-00000',
        debug: true
    };

    constructor(canvases, input, audio, configOrPort = 8000, networkConfig = null, syncConfig = null) {
        // Store Action Engine systems
        this.audio = audio;
        this.input = input;

        // Canvas references
        this.gameCanvas = canvases.gameCanvas;
        this.guiCanvas = canvases.guiCanvas;
        this.debugCanvas = canvases.debugCanvas;

        // Context references
        this.gameCtx = this.gameCanvas.getContext("2d");
        this.guiCtx = canvases.guiCtx;
        this.debugCtx = canvases.debugCtx;

        // Detect if configOrPort is a config object or a port number
        let mode = 'websocket';
        let port = 8000;
        let p2pConfig = null;

        if (typeof configOrPort === 'object' && configOrPort !== null) {
            // It's a config object
            mode = configOrPort.mode || 'websocket';
            port = configOrPort.port || 8000;
            p2pConfig = configOrPort.p2pConfig || null;
        } else if (typeof configOrPort === 'number') {
            // It's the old style (port number)
            port = configOrPort;
        }

        // Store mode for later use
        this.networkMode = mode;

        // Initialize networking based on mode
        if (mode === 'p2p') {
            const config = p2pConfig || { ...ActionNetManagerGUI.P2P_NETWORK_CONFIG };
            this.networkManager = new ActionNetManagerP2P(config);
        } else {
            // WebSocket mode (default)
            const config = networkConfig || { ...ActionNetManagerGUI.NETWORK_CONFIG };

            // Build URL from hostname, port, and protocol
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const hostname = window.location.hostname || 'localhost'; // Fallback to localhost for file:// protocol
            config.url = `${protocol}//${hostname}:${port}`;

            this.networkManager = new ActionNetManager(config);
        }

        // Setup ActionNet event listeners
        this.setupNetworkEvents();

        // Initialize SyncSystem for automatic state synchronization
        const defaultSyncConfig = {
            send: (msg) => {
                // Only send if connected and in room
                if (this.networkManager.isConnected() && this.networkManager.isInRoom()) {
                    this.networkManager.send(msg);
                }
            },
            broadcastInterval: 16,    // ~60fps
            staleThreshold: 200       // ~12 frames
        };

        this.syncSystem = new SyncSystem({
            ...defaultSyncConfig,
            ...syncConfig
        });

        // Custom message handlers (for one-shot actions like garbageSent)
        this.customMessageHandlers = new Map();

        // Setup message routing from ActionNetManager
        this.setupMessageRouting();

        // Event handlers for observer pattern
        this.handlers = new Map();

        // Application state - start with login (no title screen)
        this.currentState = "LOGIN"; // LOGIN, LOBBY
        this.username = "";
        this.availableRooms = [];
        this.selectedRoom = null;

        // Navigation state for keyboard/gamepad
        this.selectedIndex = 0; // For button navigation
        this.loginButtonCount = 2; // Connect, Back
        this.lobbyButtonCount = 3; // Create Room, Change Name, Back

        // Track scroll state for refresh optimization
        this.lastRoomCount = -1;
        this.lastScrollOffset = 0;

        // P2P connection spinner state
        this.isConnecting = false;
        this.spinnerFrame = 0;

        // Connection in progress flag to prevent multiple clicks
        this.connectionInProgress = false;

        // Create scrollable room list
        this.roomScroller = new ActionScrollableArea({
            listAreaX: 250,
            listAreaY: 380,
            listAreaWidth: 300,
            listAreaHeight: 200,
            itemHeight: 30,
            scrollBarX: 552,
            scrollBarY: 400,
            scrollBarTrackHeight: 160,
            scrollBarThumbStartY: 400,

            // Enable clipping for precise bounds control
            enableClipping: true,
            clipBounds: {
                x: 250,
                y: 380,
                width: 300,
                height: 200
            },

            // Let ActionScrollableArea handle input registration automatically with clipping
            generateItemId: (item, index) => `room_item_${index}`,

            // Custom styling for monochrome theme
            colors: {
                track: { normal: "rgba(0, 0, 0, 0.2)", hover: "rgba(0, 0, 0, 0.3)" },
                thumb: {
                    normal: "rgba(136, 136, 136, 0.3)",
                    hover: "rgba(136, 136, 136, 0.6)",
                    drag: "rgba(136, 136, 136, 0.8)"
                },
                thumbBorder: { normal: "rgba(136, 136, 136, 0.5)", drag: "#ffffff" },
                button: {
                    normal: "rgba(136, 136, 136, 0.1)",
                    hover: "rgba(136, 136, 136, 0.3)"
                },
                buttonText: {
                    normal: "rgba(136, 136, 136, 0.8)",
                    hover: "#ffffff"
                }
            },

            // Enable background drawing with monochrome styling
            drawBackground: true,
            backgroundColor: "rgba(26, 26, 26, 0.9)",
            borderColor: "rgba(136, 136, 136, 0.6)",
            borderWidth: 2,
            cornerRadius: 0,
            padding: 5
        }, this.input, this.guiCtx);

        // UI state for text input
        this.inputFocus = null; // 'username' or null
        this.textInputCursor = 0;
        this.textInputBlinkTime = 0;

        // Server status tracking
        this.serverStatus = 'UNKNOWN';
        this.serverStatusColor = '#ffff00';
        this.serverCheckInterval = null;

        // Error modal state
        this.errorModalVisible = false;
        this.errorModalTitle = '';
        this.errorModalMessage = '';

        // Join modal state
        this.joinModalVisible = false;
        this.joinModalStatus = '';  // 'contactingHost', 'offerSent', 'acceptedByHost', 'establishingConnection', 'connected'
        this.joinModalHostPeerId = null;

        // Spinner animation state
        this.spinnerRotation = 0;

        // Initialize UI elements
        this.initializeUIElements();

        // Register input elements
        this.registerUIElements();

        // console.log("[ActionNetManagerGUI] Initialization completed");
    }

    /**
     * Register an event handler for observer pattern
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
                console.error('[ActionNetManagerGUI] Error in event handler:', error);
            }
        });
    }

    /**
     * Setup message routing from ActionNetManager to SyncSystem and custom handlers
     */
    setupMessageRouting() {
        // Route ALL messages through our system
        this.networkManager.on('message', (message) => {
            // Automatic routing: syncUpdate → SyncSystem
            if (message.type === 'syncUpdate') {
                if (this.syncSystem) {
                    this.syncSystem.handleSyncUpdate(message);
                }
                return;
            }

            // Custom handler routing
            if (this.customMessageHandlers.has(message.type)) {
                const handler = this.customMessageHandlers.get(message.type);
                try {
                    handler(message);
                } catch (error) {
                    console.error(`[ActionNetManagerGUI] Error in custom handler '${message.type}':`, error);
                }
                return;
            }

            // If no handler found, emit as custom event for developer to catch
            this.emit(`message:${message.type}`, message);
        });
    }

    /**
     * Setup ActionNet event listeners
     */
    setupNetworkEvents() {
        // Connection events
        this.networkManager.on("connected", () => {
            // console.log("[ActionNetManagerGUI] Connected to server");
            this.serverStatus = 'ONLINE';
            this.serverStatusColor = '#00ff00';
        });

        this.networkManager.on("disconnected", () => {
            // console.log("[ActionNetManagerGUI] Disconnected from server");
            this.emit('disconnected');
        });

        this.networkManager.on("reconnecting", ({ attempt, delay }) => {
            // console.log(`[ActionNetManagerGUI] Reconnecting... attempt ${attempt}, waiting ${delay}ms`);
        });

        this.networkManager.on("error", (error) => {
            console.error("[ActionNetManagerGUI] Network error:", error);
        });

        this.networkManager.on("roomList", (rooms) => {
            this.availableRooms = rooms;
        });

        this.networkManager.on("joinedRoom", (roomName) => {
            // Don't emit immediately - let join modal finish if visible
            if (this.joinModalVisible) {
                // Modal will emit this after it closes
                return;
            }
            this.emit('joinedRoom', roomName);
        });

        this.networkManager.on("leftRoom", (roomName) => {
            // console.log("[ActionNetManagerGUI] Left room:", roomName);

            // Stop syncing and clear remote data when leaving room
            if (this.syncSystem) {
                this.syncSystem.stop();
                this.syncSystem.clearRemoteData();
            }

            this.emit('leftRoom', roomName);
        });

        this.networkManager.on("userList", (users) => {
            // Update connected users if needed
        });
    }

    /**
     * Initialize UI elements
     */
    initializeUIElements() {
        // Login screen elements
        this.connectButton = {
            x: 280,
            y: 220,
            width: 240,
            height: 60
        };

        this.backButton = {
            x: 280,
            y: 300,
            width: 240,
            height: 60
        };

        // Lobby screen elements
        this.createRoomButton = {
            x: 280,
            y: 220,
            width: 240,
            height: 60
        };

        this.changeNameButton = {
            x: 280,
            y: 140,
            width: 240,
            height: 60
        };

        this.backToLoginButton = {
            x: 280,
            y: 300,
            width: 240,
            height: 60
        };

        // Text input
        this.chatText = "";
        this.inputFocus = null;
    }

    /**
     * Register UI elements with input system
     */
    registerUIElements() {
        // Register connect button
        this.input.registerElement("connectButton", {
            bounds: () => ({
                x: this.connectButton.x,
                y: this.connectButton.y,
                width: this.connectButton.width,
                height: this.connectButton.height
            })
        });

        // Register back button
        this.input.registerElement("backButton", {
            bounds: () => ({
                x: this.backButton.x,
                y: this.backButton.y,
                width: this.backButton.width,
                height: this.backButton.height
            })
        });

        // Register create room button
        this.input.registerElement("createRoomButton", {
            bounds: () => ({
                x: this.createRoomButton.x,
                y: this.createRoomButton.y,
                width: this.createRoomButton.width,
                height: this.createRoomButton.height
            })
        });

        // Register change name button
        this.input.registerElement("changeNameButton", {
            bounds: () => ({
                x: this.changeNameButton.x,
                y: this.changeNameButton.y,
                width: this.changeNameButton.width,
                height: this.changeNameButton.height
            })
        });

        // Register back to login button
        this.input.registerElement("backToLoginButton", {
            bounds: () => ({
                x: this.backToLoginButton.x,
                y: this.backToLoginButton.y,
                width: this.backToLoginButton.width,
                height: this.backToLoginButton.height
            })
        });
    }

    /**
     * Main update method
     */
    action_update(deltaTime) {
        switch (this.currentState) {
            case "LOGIN":
                this.updateLogin();
                break;
            case "LOBBY":
                this.updateLobby();
                break;
        }

        // Update spinner rotation
        this.spinnerRotation = (this.spinnerRotation + 1) % 360; // Rotate 6 degrees per frame
        
        // Update spinner frame for P2P connection
        if (this.isConnecting) {
            this.spinnerFrame++;
        }

        // Update network manager
        this.networkManager.update();

        // Handle UI input
        this.handleUIInput();
    }

    /**
     * Main render method
     */
    action_draw() {
        switch (this.currentState) {
            case 'LOGIN':
                this.renderLoginScreen();
                break;
            case 'LOBBY':
                this.renderLobbyScreen();
                break;
        }

        // Render join modal on top if visible
        if (this.joinModalVisible) {
            this.renderJoinModal();
        }

        // Render error modal on top if visible
        if (this.errorModalVisible) {
            this.renderErrorModal();
        }
    }

    /**
     * Render login screen
     */
    renderLoginScreen() {
        this.renderLabel('ActionNet Login', ActionNetManagerGUI.WIDTH / 2, 150, '36px Arial', '#808080');

        // Draw connect button
        this.renderButton(this.connectButton, 'Connect', this.selectedIndex === 0);

        // Draw back button
        this.renderButton(this.backButton, 'Back', this.selectedIndex === 1);

        // Draw network status only for WebSocket mode (P2P uses DHT, not centralized server)
        if (this.networkMode !== 'p2p') {
            this.renderLabel(`Network connection: ${this.serverStatus}`, ActionNetManagerGUI.WIDTH / 2, 430, '14px Arial', this.serverStatusColor);
        }

        // Show spinner and "Connecting..." message for P2P mode
        if (this.networkMode === 'p2p' && this.isConnecting) {
            this.renderLabel('Connecting...', ActionNetManagerGUI.WIDTH / 2, 410);
            this.renderSpinner(ActionNetManagerGUI.WIDTH / 2, 450, 20, 3);
        }
    }

    /**
     * Render lobby screen
     */
    renderLobbyScreen() {
        // Render peer count in bottom right
        if (this.networkMode === 'p2p') {
            const connectedCount = this.networkManager.getConnectedPeerCount();
            const discoveredCount = this.networkManager.getDiscoveredPeerCount();
            const peerLabel = `Connected: ${connectedCount} | Online: ${discoveredCount}`;
            this.renderLabel(peerLabel, ActionNetManagerGUI.WIDTH - 10, ActionNetManagerGUI.HEIGHT - 10, '12px Arial', '#888888', 'right');
        }
        this.renderLabel('ActionNet Lobby', ActionNetManagerGUI.WIDTH / 2, 40, '36px Arial', '#808080');

        this.renderLabel(`Welcome, ${this.username}!`, ActionNetManagerGUI.WIDTH / 2, 85, '24px Arial', '#ffffff');

        // Draw status
        this.renderLabel('Select a room or create a new one', ActionNetManagerGUI.WIDTH / 2, 120, '14px Arial', '#cccccc');

        // Draw connection status
        // const isConnected = this.networkManager.isConnected();
        // const connectionStatus = isConnected ? '✅ CONNECTED TO SERVER' : '❌ NOT CONNECTED';
        // this.guiCtx.fillStyle = isConnected ? '#00ff00' : '#ff0000';
        // this.guiCtx.fillText(`Server: ${connectionStatus}`, ActionNetManagerGUI.WIDTH / 2, 80);

        // Draw change name button (index 0)
        this.renderButton(this.changeNameButton, 'Change Name', this.selectedIndex === 0);

        // Draw create room button (index 1)
        this.renderButton(this.createRoomButton, 'Create Room', this.selectedIndex === 1);

        // Draw back to login button (index 2)
        this.renderButton(this.backToLoginButton, 'Back', this.selectedIndex === 2);

        // Draw available rooms
        this.renderRoomList();
    }

    /**
     * Render button
     */
    renderButton(button, text, isSelected = false) {
        const isHovered = this.input.isElementHovered(button === this.connectButton ? 'connectButton' :
            button === this.backButton ? 'backButton' :
                button === this.createRoomButton ? 'createRoomButton' :
                    button === this.changeNameButton ? 'changeNameButton' :
                        'backToLoginButton');
        
        // Check if connect button is disabled (connection in progress)
        const isDisabled = button === this.connectButton && this.connectionInProgress;
        
        // Highlight if selected via keyboard/gamepad or hovered via mouse
        const isHighlighted = (isSelected || isHovered) && !isDisabled;
        this.guiCtx.fillStyle = isDisabled ? '#222222' : (isHighlighted ? '#555555' : '#333333');
        this.guiCtx.fillRect(button.x, button.y, button.width, button.height);
        this.guiCtx.strokeStyle = isDisabled ? '#444444' : (isSelected ? '#ffffff' : '#888888');
        this.guiCtx.lineWidth = isSelected ? 3 : 2;
        this.guiCtx.strokeRect(button.x, button.y, button.width, button.height);
        this.guiCtx.fillStyle = isDisabled ? '#666666' : '#ffffff';
        this.guiCtx.font = 'bold 24px Arial';
        this.guiCtx.textAlign = 'center';
        this.guiCtx.textBaseline = 'middle';
        this.guiCtx.fillText(text.toUpperCase(), button.x + button.width / 2, button.y + button.height / 2);
    }

    /**
     * Render spinner for P2P connection
     */
    renderSpinner(x, y, size = 30) {
        const radius = size / 2;
        const rotation = (this.spinnerFrame % 60) * (Math.PI * 2 / 60); // Full rotation every 60 frames

        this.guiCtx.save();
        this.guiCtx.translate(x, y);
        this.guiCtx.rotate(rotation);

        // Draw spinner arc
        this.guiCtx.strokeStyle = '#ffffff';
        this.guiCtx.lineWidth = 3;
        this.guiCtx.lineCap = 'round';
        this.guiCtx.beginPath();
        this.guiCtx.arc(0, 0, radius, 0, Math.PI * 1.5); // 3/4 circle
        this.guiCtx.stroke();

        this.guiCtx.restore();
    }

    /**
     * Render label with optional semi-transparent background
     */
    renderLabel(text, x, y, font = '16px Arial', textColor = '#ffffff', textAlign = 'center', textBaseline = 'middle', padding = 8, drawBackground = true) {
        // Save context state
        this.guiCtx.save();

        this.guiCtx.font = font;
        this.guiCtx.textAlign = textAlign;
        this.guiCtx.textBaseline = textBaseline;

        if (drawBackground) {
            const metrics = this.guiCtx.measureText(text);
            const textWidth = metrics.width;

            // Fallback-safe text height
            const textHeightRaw = (metrics.actualBoundingBoxAscent || 0) + (metrics.actualBoundingBoxDescent || 0);
            const textHeight = textHeightRaw || parseInt(font, 10) || 16;

            const bgWidth = textWidth + padding * 2;
            const bgHeight = textHeight + padding;
            const cornerRadius = 4; // Rounded corners

            let bgX, bgY;
            if (textAlign === 'center') {
                bgX = x - bgWidth / 2;
            } else if (textAlign === 'left') {
                bgX = x - padding;
            } else if (textAlign === 'right') {
                bgX = x - bgWidth + padding;
            }

            // With textBaseline = 'middle', y is the visual center of the glyphs.
            // Center the background on that, then nudge down 1px to correct the "too high" feel.
            bgY = y - bgHeight / 2 - 1;

            // Semi-transparent dark background with rounded corners
            this.guiCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.roundedRect(bgX, bgY, bgWidth, bgHeight, cornerRadius);
            this.guiCtx.fill();

            // Subtle grey border with rounded corners
            this.guiCtx.strokeStyle = 'rgba(136, 136, 136, 0.3)';
            this.guiCtx.lineWidth = 1;
            this.roundedRect(bgX, bgY, bgWidth, bgHeight, cornerRadius);
            this.guiCtx.stroke();
        }

        // Text
        this.guiCtx.fillStyle = textColor;
        this.guiCtx.fillText(text, x, y);

        // Restore context
        this.guiCtx.restore();
    }

    /**
     * Render text with dynamic font sizing to fit within maxWidth
     */
    renderWrappedText(text, x, y, maxWidth, font = '16px Arial', textColor = '#ffffff') {
        this.guiCtx.save();

        this.guiCtx.textAlign = 'center';
        this.guiCtx.textBaseline = 'middle';
        this.guiCtx.fillStyle = textColor;

        // Extract font size from font string (e.g., "20px Arial" -> 20)
        let fontSize = parseInt(font, 10) || 16;
        const fontFamily = font.split(' ').slice(1).join(' ') || 'Arial';

        // Reduce font size until text fits
        let textWidth = Infinity;
        while (textWidth > maxWidth && fontSize > 8) {
            this.guiCtx.font = `${fontSize}px ${fontFamily}`;
            const metrics = this.guiCtx.measureText(text);
            textWidth = metrics.width;

            if (textWidth > maxWidth) {
                fontSize--;
            }
        }

        // Draw the text at the calculated size
        this.guiCtx.fillText(text, x, y);

        this.guiCtx.restore();
    }

    /**
     * Helper method to draw rounded rectangles
     */
    roundedRect(x, y, width, height, radius) {
        const ctx = this.guiCtx;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    /**
     * Render room list
     */
    renderRoomList() {
        const rooms = this.networkManager.getAvailableRooms();

        if (rooms.length === 0) {
            // Draw header and spinner animation
            this.renderLabel('Searching for rooms...', ActionNetManagerGUI.WIDTH / 2, 410);
            this.renderSpinner(ActionNetManagerGUI.WIDTH / 2, 450, 20, 3);
        } else if (this.roomScroller) {
            // Use the scroller for room list
            this.roomScroller.draw(rooms, (room, index, y) => {
                // Check if this specific room item is hovered or selected via keyboard/gamepad
                const isHovered = this.input.isElementHovered(`room_item_${index}`) || this.roomScroller.scrollThumb.hovered;
                const isSelected = this.selectedIndex === (this.lobbyButtonCount + index);
                const isHighlighted = isHovered || isSelected;

                // Draw room button background (matching GUI button style)
                this.guiCtx.fillStyle = isHighlighted ? '#555555' : '#333333';
                this.guiCtx.fillRect(260, y, 280, 30);

                // Draw room button border (matching GUI button style)
                this.guiCtx.strokeStyle = isSelected ? '#ffffff' : '#888888';
                this.guiCtx.lineWidth = isSelected ? 3 : 2;
                this.guiCtx.strokeRect(260, y, 280, 30);

                // Draw room name and player count
                this.guiCtx.fillStyle = '#ffffff';
                this.guiCtx.font = '16px Arial';
                this.guiCtx.textAlign = 'center';

                // New format with player counts
                const maxDisplay = room.maxPlayers === -1 ? '∞' : room.maxPlayers;
                // Support both WebSocket (room.name, room.playerCount) and P2P (room.username, room.currentPlayers) formats
                const roomName = room.name || room.username || 'Unknown Room';
                const playerCount = room.playerCount !== undefined ? room.playerCount : room.currentPlayers || 0;
                const displayText = `${roomName} (${playerCount}/${maxDisplay})`;

                this.guiCtx.fillText(displayText, ActionNetManagerGUI.WIDTH / 2, y + 15);
            }, {
                renderHeader: () => {
                    this.renderLabel('Available Rooms:', ActionNetManagerGUI.WIDTH / 2, 330);
                }
            });
        } else {
            this.guiCtx.fillStyle = '#ff0000';
            this.guiCtx.font = '20px Arial';
            this.guiCtx.textAlign = 'center';
            this.guiCtx.fillText('ERROR: roomScroller is null!', ActionNetManagerGUI.WIDTH / 2, ActionNetManagerGUI.HEIGHT / 2);
        }
    }



    /**
     * Update login
     */
    updateLogin() {
        if (!this.serverCheckInterval) {
            // Perform initial check immediately when entering LOGIN state
            (async () => {
                try {
                    const result = await this.networkManager.testServerConnection();
                    this.serverStatus = result.available ? 'ONLINE' : 'UNAVAILABLE';
                    this.serverStatusColor = result.available ? '#00ff00' : '#ff0000';
                } catch (error) {
                    this.serverStatus = 'UNAVAILABLE';
                    this.serverStatusColor = '#ff0000';
                }
            })();

            // Start periodic checks
            this.startServerCheck();
        }
    }

    /**
     * Update lobby
     */
    updateLobby() {
        // Update room list
        this.availableRooms = this.networkManager.getAvailableRooms();

        // Update scrollable room list
        if (this.roomScroller) {
            const currentCount = this.availableRooms.length;
            const currentScroll = this.roomScroller.scrollOffset;

            // Only refresh items when needed: initial, scroll change, or content change
            const needsRefresh = currentCount !== this.lastRoomCount ||
                currentScroll !== this.lastScrollOffset ||
                this.lastRoomCount === -1;

            if (needsRefresh) {
                // Use the library's refreshItems method to handle registration properly
                this.roomScroller.refreshItems(this.availableRooms, 'gui');

                // Update tracking
                this.lastRoomCount = currentCount;
                this.lastScrollOffset = currentScroll;
            }

            this.roomScroller.update(this.availableRooms.length, 0.016);
        }
    }

    /**
     * Handle UI input
     */
    handleUIInput() {
        // Handle join modal input first (blocks other input when visible)
        if (this.joinModalVisible) {
            this.handleJoinModalInput();
            return; // Modal blocks other input
        }

        // Handle error modal input (blocks other input when visible)
        if (this.errorModalVisible) {
            this.handleErrorModalInput();
            return; // Modal blocks other input
        }

        switch (this.currentState) {
            case "LOGIN":
                // Handle keyboard/gamepad navigation for LOGIN screen
                if (this.input.isKeyJustPressed('DirUp') ||
                    this.input.isGamepadButtonJustPressed(12, 0) || this.input.isGamepadButtonJustPressed(12, 1) ||
                    this.input.isGamepadButtonJustPressed(12, 2) || this.input.isGamepadButtonJustPressed(12, 3)) {
                    const old = this.selectedIndex;
                    const next = Math.max(0, old - 1);
                    if (next !== old) {
                        this.selectedIndex = next;
                        this.emit('selectionChanged', { oldIndex: old, newIndex: next });
                    }
                }
                if (this.input.isKeyJustPressed('DirDown') ||
                    this.input.isGamepadButtonJustPressed(13, 0) || this.input.isGamepadButtonJustPressed(13, 1) ||
                    this.input.isGamepadButtonJustPressed(13, 2) || this.input.isGamepadButtonJustPressed(13, 3)) {
                    const old = this.selectedIndex;
                    const next = Math.min(this.loginButtonCount - 1, old + 1);
                    if (next !== old) {
                        this.selectedIndex = next;
                        this.emit('selectionChanged', { oldIndex: old, newIndex: next });
                    }
                }
                // Confirm with Action1 (Enter/A button)
                if (this.input.isKeyJustPressed('Action1') ||
                    this.input.isGamepadButtonJustPressed(0, 0) || this.input.isGamepadButtonJustPressed(0, 1) ||
                    this.input.isGamepadButtonJustPressed(0, 2) || this.input.isGamepadButtonJustPressed(0, 3)) {

                    // Explicit handling:
                    // - Index 0: positive/forward action → emit buttonPressed (menu_confirm).
                    // - Index 1: back/cancel action → emit back only (menu_back handled by game), no confirm.
                    if (this.selectedIndex === 0) {
                        if (!this.connectionInProgress) {
                            this.emit('buttonPressed');
                            this.startConnection();
                        }
                    } else if (this.selectedIndex === 1) {
                        this.emit('back');
                    }
                }

                // Back with Action2 (Escape/B button)
                if (this.input.isKeyJustPressed('Action2') ||
                    this.input.isGamepadButtonJustPressed(1, 0) || this.input.isGamepadButtonJustPressed(1, 1) ||
                    this.input.isGamepadButtonJustPressed(1, 2) || this.input.isGamepadButtonJustPressed(1, 3)) {

                    // This is a pure back/cancel: no confirm sound.
                    // Disconnect if connected before going back
                    if (this.networkManager.isConnected()) {
                        this.networkManager.disconnect();
                    }
                    this.emit('back');
                }

                // Mouse input
                if (this.input.isElementJustPressed("connectButton")) {
                    if (!this.connectionInProgress) {
                        // Positive/forward: confirm sound via buttonPressed.
                        this.emit('buttonPressed');
                        this.startConnection();
                    }
                } else if (this.input.isElementJustPressed("backButton")) {
                    // Disconnect if connected before going back
                    if (this.networkManager.isConnected()) {
                        this.networkManager.disconnect();
                    }
                    // Emit back event so game can return to title screen
                    this.emit('back');
                }
                // Update selection based on hover
                if (this.input.isElementHovered("connectButton")) {
                    if (this.selectedIndex !== 0) {
                        const old = this.selectedIndex;
                        this.selectedIndex = 0;
                        this.emit('selectionChanged', { oldIndex: old, newIndex: 0 });
                    }
                } else if (this.input.isElementHovered("backButton")) {
                    if (this.selectedIndex !== 1) {
                        const old = this.selectedIndex;
                        this.selectedIndex = 1;
                        this.emit('selectionChanged', { oldIndex: old, newIndex: 1 });
                    }
                }
                break;
            case "LOBBY":
                const availableRooms = this.networkManager.getAvailableRooms();
                const totalSelectableItems = this.lobbyButtonCount + availableRooms.length;

                // Handle keyboard/gamepad navigation for LOBBY screen
                if (this.input.isKeyJustPressed('DirUp') ||
                    this.input.isGamepadButtonJustPressed(12, 0) || this.input.isGamepadButtonJustPressed(12, 1) ||
                    this.input.isGamepadButtonJustPressed(12, 2) || this.input.isGamepadButtonJustPressed(12, 3)) {
                    const old = this.selectedIndex;
                    const next = Math.max(0, old - 1);
                    if (next !== old) {
                        this.selectedIndex = next;
                        this.emit('selectionChanged', { oldIndex: old, newIndex: next });
                        this.scrollToSelectedItem();
                    }
                }
                if (this.input.isKeyJustPressed('DirDown') ||
                    this.input.isGamepadButtonJustPressed(13, 0) || this.input.isGamepadButtonJustPressed(13, 1) ||
                    this.input.isGamepadButtonJustPressed(13, 2) || this.input.isGamepadButtonJustPressed(13, 3)) {
                    const old = this.selectedIndex;
                    const next = Math.min(totalSelectableItems - 1, old + 1);
                    if (next !== old) {
                        this.selectedIndex = next;
                        this.emit('selectionChanged', { oldIndex: old, newIndex: next });
                        this.scrollToSelectedItem();
                    }
                }

                // Confirm with Action1 (Enter/A button)
                if (this.input.isKeyJustPressed('Action1') ||
                    this.input.isGamepadButtonJustPressed(0, 0) || this.input.isGamepadButtonJustPressed(0, 1) ||
                    this.input.isGamepadButtonJustPressed(0, 2) || this.input.isGamepadButtonJustPressed(0, 3)) {
                    if (this.selectedIndex === 0) {
                        this.emit('buttonPressed');
                        this.changeUsername();
                    } else if (this.selectedIndex === 1) {
                        this.emit('buttonPressed');
                        this.createAndJoinRoom();
                    } else if (this.selectedIndex === 2) {
                        this.emit('backToLogin');
                        this.currentState = "LOGIN";
                        this.selectedIndex = 0; // Reset selection
                    } else {
                        // Room selection (index 3+)
                        const roomIndex = this.selectedIndex - this.lobbyButtonCount;
                        if (roomIndex >= 0 && roomIndex < availableRooms.length) {
                            console.log("✅ Room selected via keyboard/gamepad:", availableRooms[roomIndex]);
                            this.emit('buttonPressed');
                            // Support both WebSocket (name) and P2P (peerId) formats
                            this.selectedRoom = availableRooms[roomIndex].peerId || availableRooms[roomIndex].name;
                            this.joinSelectedRoom();
                        }
                    }
                }

                // Back with Action2 (Escape/B button)
                if (this.input.isKeyJustPressed('Action2') ||
                    this.input.isGamepadButtonJustPressed(1, 0) || this.input.isGamepadButtonJustPressed(1, 1) ||
                    this.input.isGamepadButtonJustPressed(1, 2) || this.input.isGamepadButtonJustPressed(1, 3)) {
                    // Disconnect when going back from lobby
                    if (this.networkManager.isConnected()) {
                        this.networkManager.disconnect();
                    }
                    this.connectionInProgress = false; // Reset button state
                    this.emit('backToLogin');
                    this.currentState = "LOGIN";
                    this.selectedIndex = 0; // Reset selection
                }

                // Mouse input
                if (this.input.isElementJustPressed("createRoomButton")) {
                    this.emit('buttonPressed');
                    this.createAndJoinRoom();
                } else if (this.input.isElementJustPressed("changeNameButton")) {
                    this.emit('buttonPressed');
                    this.changeUsername();
                } else if (this.input.isElementJustPressed("backToLoginButton")) {
                    // Disconnect when going back from lobby
                    if (this.networkManager.isConnected()) {
                        this.networkManager.disconnect();
                    }
                    this.connectionInProgress = false; // Reset button state
                    this.emit('backToLogin');
                    this.currentState = "LOGIN";
                    this.selectedIndex = 0; // Reset selection
                } else {
                    // Handle scrollable room selection
                    // Check all possible room indices (up to reasonable limit)
                    for (let i = 0; i < Math.min(availableRooms.length, 20); i++) {
                        const elementId = `room_item_${i}`;
                        const isPressed = this.input.isElementJustPressed(elementId);

                        if (isPressed && availableRooms[i]) {
                            this.emit('buttonPressed');
                            console.log("✅ Room clicked:", availableRooms[i]);
                            // Support both WebSocket (name) and P2P (peerId) formats
                            this.selectedRoom = availableRooms[i].peerId || availableRooms[i].name;
                            this.joinSelectedRoom();
                            break;
                        }
                    }
                }

                // Update selection based on hover
                if (this.input.isElementHovered("changeNameButton")) {
                    if (this.selectedIndex !== 0) {
                        const old = this.selectedIndex;
                        this.selectedIndex = 0;
                        this.emit('selectionChanged', { oldIndex: old, newIndex: 0 });
                    }
                } else if (this.input.isElementHovered("createRoomButton")) {
                    if (this.selectedIndex !== 1) {
                        const old = this.selectedIndex;
                        this.selectedIndex = 1;
                        this.emit('selectionChanged', { oldIndex: old, newIndex: 1 });
                    }
                } else if (this.input.isElementHovered("backToLoginButton")) {
                    if (this.selectedIndex !== 2) {
                        const old = this.selectedIndex;
                        this.selectedIndex = 2;
                        this.emit('selectionChanged', { oldIndex: old, newIndex: 2 });
                    }
                } else {
                    // Check room hover
                    for (let i = 0; i < availableRooms.length; i++) {
                        if (this.input.isElementHovered(`room_item_${i}`)) {
                            const next = this.lobbyButtonCount + i;
                            if (this.selectedIndex !== next) {
                                const old = this.selectedIndex;
                                this.selectedIndex = next;
                                this.emit('selectionChanged', { oldIndex: old, newIndex: next });
                            }
                            break;
                        }
                    }
                }
                break;
        }
    }

    /**
     * Start connection to server or P2P network
     */
    async startConnection() {
        this.username = this.generateRandomUsername();
        this.currentState = "LOGIN";
        this.serverStatus = 'CONNECTING';
        this.serverStatusColor = '#ffff00';
        this.connectionInProgress = true; // Prevent multiple clicks

        // Show spinner for P2P mode
        if (this.networkMode === 'p2p') {
            this.isConnecting = true;
        }

        try {
            if (this.networkMode === 'p2p') {
                // P2P mode: join the game via DHT
                await this.networkManager.joinGame(this.networkManager.config.gameId, this.username);
            } else {
                // WebSocket mode: connect to server
                await this.networkManager.connectToServer({ username: this.username });
            }

            // Update status immediately on success
            this.serverStatus = 'ONLINE';
            this.serverStatusColor = '#00ff00';
            this.isConnecting = false; // Stop spinner
            this.connectionInProgress = false; // Connection complete, button is no longer greyed out
            // Clear server check interval since we're now connected
            if (this.serverCheckInterval) {
                clearInterval(this.serverCheckInterval);
                this.serverCheckInterval = null;
            }
            this.currentState = "LOBBY";
            this.selectedIndex = 0; // Reset selection when entering lobby
        } catch (error) {
            console.error("Failed to connect:", error);
            // Update status immediately on failure
            this.serverStatus = 'UNAVAILABLE';
            this.serverStatusColor = '#ff0000';
            this.isConnecting = false; // Stop spinner
            this.connectionInProgress = false; // Allow retry on failure
        }
    }

    /**
     * Join selected room
     */
    joinSelectedRoom() {
         if (!this.selectedRoom) return;

         // Check if room is full before attempting to join
         const availableRooms = this.networkManager.getAvailableRooms();
         const selectedRoomData = availableRooms.find(r => (r.peerId || r.name) === this.selectedRoom);
         
         if (selectedRoomData) {
             const maxDisplay = selectedRoomData.maxPlayers === -1 ? '∞' : selectedRoomData.maxPlayers;
             const currentPlayers = selectedRoomData.playerCount !== undefined ? selectedRoomData.playerCount : selectedRoomData.currentPlayers || 0;
             const isFull = selectedRoomData.maxPlayers > 0 && currentPlayers >= selectedRoomData.maxPlayers;
             
             if (isFull) {
                 this.showErrorModal("Room Full", `This room is full (${currentPlayers}/${maxDisplay}).`);
                 return;
             }
         }

         // P2P mode: do granular join with step-by-step messages
         if (this.networkMode === 'p2p') {
             this.performP2PJoin(this.selectedRoom);
         } else {
             // WebSocket mode: simple one-shot join
             this.networkManager.joinRoom(this.selectedRoom)
                 .then(() => {
                     // Event will be emitted by setupNetworkEvents
                 })
                 .catch((error) => {
                     console.error("Failed to join room:", error);
                     this.showErrorModal("Cannot Join Room", error.message || "Failed to join the selected room");
                 });
         }
     }

    /**
     * Perform P2P join with granular steps and modal progress
     */
    async performP2PJoin(hostPeerId) {
        try {
            this.joinModalVisible = true;
            this.joinModalHostPeerId = hostPeerId;
            
            // Step 1: Contacting host
            this.joinModalStatus = 'contactingHost';
            this.joinModalStatusSetTime = Date.now();
            await this.delay(500);
            await this.networkManager.initiateConnection(hostPeerId);
            
            // Step 2: Offer sent (start listening for acceptance immediately)
            this.joinModalStatus = 'offerSent';
            this.joinModalStatusSetTime = Date.now();
            
            await this.networkManager.sendOffer(hostPeerId);
            
            // Start waiting for acceptance, but ensure 500ms minimum display
            const acceptancePromise = this.networkManager.waitForAcceptance(hostPeerId);
            await this.delay(500);
            await acceptancePromise;
            
            // Step 3: Accepted by host (now that it actually accepted)
            this.joinModalStatus = 'acceptedByHost';
            this.joinModalStatusSetTime = Date.now();
            await this.delay(500);
            
            // Step 4: Establishing connection
            this.joinModalStatus = 'establishingConnection';
            this.joinModalStatusSetTime = Date.now();
            await this.delay(500);
            await this.networkManager.openGameChannel(hostPeerId);
            
            // Step 5: Connected
            this.joinModalStatus = 'connected';
            await this.delay(500);
            
            // Done - close modal and emit event
            this.joinModalVisible = false;
            this.emit('joinedRoom', hostPeerId);
        } catch (error) {
            this.joinModalVisible = false;
            console.error("P2P join failed:", error);
            
            // Clean up the connection attempt
            const peerData = this.networkManager.peerConnections.get(hostPeerId);
            if (peerData) {
                if (peerData.pc) {
                    peerData.pc.close();
                    peerData.pc = null;
                }
                if (peerData.channel) {
                    peerData.channel.close();
                    peerData.channel = null;
                }
            }
            
            this.showErrorModal("Cannot Join Room", error.message || "Failed to join the selected room");
        }
    }

    /**
     * Simple delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Create and join room
     */
    createAndJoinRoom() {
        // For P2P mode, create a room (become host)
        if (this.networkMode === 'p2p') {
            // P2P needs to call joinGame first to set up currentGameId
            // Use the default gameId from P2P config
            const gameId = this.networkManager.config.gameId || 'game-id-00000';
            this.networkManager.currentGameId = gameId;
            this.networkManager.createRoom();
            // console.log("[ActionNetManagerGUI] Created P2P room, waiting for players...");
        } else {
            // For WebSocket mode, join a room with a generated name
            const roomName = `${this.username}'s room`;
            this.networkManager.joinRoom(roomName)
                .then(() => {
                    // Event will be emitted
                })
                .catch((error) => {
                    console.error("Failed to create room:", error);
                    this.showErrorModal("Cannot Create Room", error.message || "Failed to create a new room");
                });
        }
    }

    /**
     * Change username
     */
    async changeUsername() {
        const newUsername = this.generateRandomUsername();
        try {
            await this.networkManager.setUsername(newUsername);
            this.username = newUsername;
        } catch (error) {
            console.error("Failed to change username:", error);
            this.showErrorModal("Cannot Change Name", error.message || "Failed to change username");
        }
    }

    /**
     * Generate random username
     */
    generateRandomUsername() {
        const adjectives = [
            'Big', 'Floppy', 'Little', 'Goofy', 'Wiggly',
            'Stinky', 'Chunky', 'Bouncy', 'Silly', 'Noisy',
            'Tiny', 'Cracked', 'Lit', 'Steamy', 'Epic',
            'Super', 'Mega', 'Giant', 'Double', 'Salty',
            'Farty', 'Smelly', 'Sneaky', 'Gassy', 'Crusty',
            'Soggy', 'Tooty', 'Ratchet', 'Nasty', 'Squeaky',
            'Skibidi', 'Rizzy', 'Saucy', 'Mid', 'Sussy', "Lil' "
        ];

        const nouns = [
            'Farter', 'Butt', 'PooPoo', 'Nugget', 'Tooter', 'Turd',
            'Poop', 'Squeaker', 'DooDoo', 'Pooter', 'Dumper', 'Keister',
            'Fart', 'Hiney', 'Pooper', 'Booty', 'Stinker', 'Skidmark',
            'Ahh', 'Buns', 'Cheeks', 'Tushy', 'Doody'
        ];

        const funNumbers = [
            '69', '420', '666', '1337', '123',
            '007', '101', '999', '321', '777',
            '67', '911', ''
        ];

        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const number = funNumbers[Math.floor(Math.random() * funNumbers.length)];
        return `${adj}${noun}${number}`;
    }

    /**
     * Start server check (WebSocket only)
     */
    startServerCheck() {
        // Skip server check for P2P mode (DHT connectivity is implicit)
        if (this.networkMode === 'p2p') {
            return;
        }

        this.serverCheckInterval = setInterval(async () => {
            // Only check if we're not connected (don't override connection status)
            if (!this.networkManager.isConnected()) {
                try {
                    const result = await this.networkManager.testServerConnection();
                    this.serverStatus = result.available ? 'ONLINE' : 'UNAVAILABLE';
                    this.serverStatusColor = result.available ? '#00ff00' : '#ff0000';
                } catch (error) {
                    this.serverStatus = 'UNAVAILABLE';
                    this.serverStatusColor = '#ff0000';
                }
            }
        }, 3000);
    }

    /**
     * Get ActionNetManager instance
     */
    getNetManager() {
        return this.networkManager;
    }

    /**
     * Hide the GUI (for when game takes over)
     */
    hide() {
        this.guiVisible = false;
    }

    /**
     * Show the GUI (for when returning from game)
     */
    show() {
        this.guiVisible = true;
    }

    /**
     * Register a custom message handler for one-shot actions
     * 
     * Use this for non-periodic game events like:
     * - garbageSent (Tetris attack)
     * - itemUsed (power-up activation)
     * - chatMessage (player communication)
     * 
     * For periodic state sync (position, score, etc), use syncSystem.register() instead.
     * 
     * @param {String} messageType - Message type to handle (e.g., 'garbageSent')
     * @param {Function} handler - Handler function (message) => {}
     * 
     * Example:
     * gui.registerMessageHandler('garbageSent', (msg) => {
     *     gameManager.addGarbage(msg.targetPlayer, msg.lines);
     * });
     */
    registerMessageHandler(messageType, handler) {
        if (!messageType || typeof messageType !== 'string') {
            console.error('[ActionNetManagerGUI] Invalid message type:', messageType);
            return false;
        }

        if (typeof handler !== 'function') {
            console.error('[ActionNetManagerGUI] Handler must be a function');
            return false;
        }

        this.customMessageHandlers.set(messageType, handler);
        // console.log(`[ActionNetManagerGUI] Registered custom handler: '${messageType}'`);
        return true;
    }

    /**
     * Remove a custom message handler
     * 
     * @param {String} messageType - Message type to unregister
     */
    unregisterMessageHandler(messageType) {
        if (this.customMessageHandlers.delete(messageType)) {
            // console.log(`[ActionNetManagerGUI] Unregistered handler: '${messageType}'`);
            return true;
        }
        return false;
    }

    /**
     * Activate SyncSystem for a room with proper peer connection context
     * Call this when joining a room to ensure SyncSystem is ready
     */
    activateSyncForRoom() {
        if (this.syncSystem && !this.syncSystem.isRunning) {
            console.log("[ActionNetManagerGUI] Activating SyncSystem for room");
            this.syncSystem.start();
        }
    }

    /**
     * Deactivate SyncSystem when leaving a room
     * Call this when leaving a room to clean up
     */
    deactivateSyncForRoom() {
        if (this.syncSystem && this.syncSystem.isRunning) {
            console.log("[ActionNetManagerGUI] Deactivating SyncSystem for room");
            this.syncSystem.stop();
            this.syncSystem.clearRemoteData();
        }
    }

    /**
     * Get current username
     */
    getUsername() {
        return this.username;
    }

    /**
     * Check if in room
     */
    isInRoom() {
        return this.networkManager.isInRoom();
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.networkManager.isConnected();
    }

    /**
     * Auto-scroll to keep selected item visible
     */
    scrollToSelectedItem() {
        // Only scroll if we're selecting a room (not a button)
        if (this.selectedIndex < this.lobbyButtonCount) {
            return; // Buttons don't need scrolling
        }

        if (!this.roomScroller) {
            return; // No scroller available
        }

        // Calculate which room is selected
        const roomIndex = this.selectedIndex - this.lobbyButtonCount;
        const availableRooms = this.networkManager.getAvailableRooms();

        if (roomIndex < 0 || roomIndex >= availableRooms.length) {
            return; // Invalid room index
        }

        // Calculate the Y position of this room item
        const itemHeight = this.roomScroller.listArea.itemHeight + this.roomScroller.listArea.padding;
        const itemY = roomIndex * itemHeight;

        // Calculate visible area bounds
        const scrollTop = this.roomScroller.scrollOffset;
        const scrollBottom = scrollTop + this.roomScroller.listArea.height;

        // Check if item is above visible area (scroll up)
        if (itemY < scrollTop) {
            this.roomScroller.scrollOffset = itemY;
        }
        // Check if item is below visible area (scroll down)
        else if (itemY + itemHeight > scrollBottom) {
            this.roomScroller.scrollOffset = itemY + itemHeight - this.roomScroller.listArea.height;
        }

        // Clamp scroll offset to valid range
        this.roomScroller.scrollOffset = Math.max(0, Math.min(this.roomScroller.maxScrollOffset, this.roomScroller.scrollOffset));
    }

    /**
     * Show error modal
     */
    showErrorModal(title, message) {
        this.errorModalVisible = true;
        this.errorModalTitle = title;
        this.errorModalMessage = message;
    }

    /**
     * Hide error modal
     */
    hideErrorModal() {
        this.errorModalVisible = false;
        this.errorModalTitle = '';
        this.errorModalMessage = '';
    }

    /**
     * Render error modal
     */
    renderErrorModal() {
        // Semi-transparent overlay
        this.guiCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.guiCtx.fillRect(0, 0, ActionNetManagerGUI.WIDTH, ActionNetManagerGUI.HEIGHT);

        // Modal dimensions
        const modalWidth = 400;
        const modalHeight = 200;
        const modalX = (ActionNetManagerGUI.WIDTH - modalWidth) / 2;
        const modalY = (ActionNetManagerGUI.HEIGHT - modalHeight) / 2;

        // Modal background (matching GUI button style)
        this.guiCtx.fillStyle = '#333333';
        this.guiCtx.fillRect(modalX, modalY, modalWidth, modalHeight);
        this.guiCtx.strokeStyle = '#888888';
        this.guiCtx.lineWidth = 2;
        this.guiCtx.strokeRect(modalX, modalY, modalWidth, modalHeight);

        // Title
        this.renderLabel(this.errorModalTitle, ActionNetManagerGUI.WIDTH / 2, modalY + 40, 'bold 32px Arial', '#ffffff', 'center', 'middle', 8, false);

        // Message (with text wrapping)
        this.renderWrappedText(this.errorModalMessage, ActionNetManagerGUI.WIDTH / 2, modalY + 90, 370, '20px Arial', '#cccccc');

        // Back button (centered)
        const buttonWidth = 120;
        const buttonHeight = 50;
        const buttonX = (ActionNetManagerGUI.WIDTH - buttonWidth) / 2;
        const buttonY = modalY + modalHeight - 70;

        // Check if back button is hovered or selected (for keyboard/gamepad navigation)
        const isHovered = this.input.isElementHovered('error_modal_back_button');
        const isSelected = true; // Always selected since it's the only button

        this.guiCtx.fillStyle = isHovered ? '#555555' : '#333333';
        this.guiCtx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
        this.guiCtx.strokeStyle = isSelected ? '#ffffff' : '#888888'; // White border for selection
        this.guiCtx.lineWidth = isSelected ? 3 : 2; // Thicker border for selection
        this.guiCtx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);

        // Button text
        this.guiCtx.fillStyle = '#ffffff';
        this.guiCtx.font = 'bold 20px Arial';
        this.guiCtx.textAlign = 'center';
        this.guiCtx.textBaseline = 'middle';
        this.guiCtx.fillText('BACK', buttonX + buttonWidth / 2, buttonY + buttonHeight / 2);
    }

    /**
     * Handle error modal input
     */
    handleErrorModalInput() {
        // Register back button if not already registered
        if (!this.input.rawState.elements.gui.has('error_modal_back_button')) {
            const modalWidth = 400;
            const modalHeight = 200;
            const modalX = (ActionNetManagerGUI.WIDTH - modalWidth) / 2;
            const modalY = (ActionNetManagerGUI.HEIGHT - modalHeight) / 2;
            const buttonWidth = 120;
            const buttonHeight = 50;
            const buttonX = (ActionNetManagerGUI.WIDTH - buttonWidth) / 2;
            const buttonY = modalY + modalHeight - 70;

            this.input.registerElement('error_modal_back_button', {
                bounds: () => ({
                    x: buttonX,
                    y: buttonY,
                    width: buttonWidth,
                    height: buttonHeight
                })
            });
        }

        // Handle button press
        if (this.input.isElementJustPressed('error_modal_back_button')) {
            this.hideErrorModal();
            // Unregister the button
            this.input.removeElement('error_modal_back_button');
        }

        // Handle keyboard/gamepad input
        if (this.input.isKeyJustPressed('Action1') ||
            this.input.isGamepadButtonJustPressed(0, 0) || this.input.isGamepadButtonJustPressed(0, 1) ||
            this.input.isGamepadButtonJustPressed(0, 2) || this.input.isGamepadButtonJustPressed(0, 3)) {
            this.hideErrorModal();
            this.input.removeElement('error_modal_back_button');
        }

        // Handle escape/back button
        if (this.input.isKeyJustPressed('Action2') ||
            this.input.isKeyJustPressed('Escape') ||
            this.input.isGamepadButtonJustPressed(1, 0) || this.input.isGamepadButtonJustPressed(1, 1) ||
            this.input.isGamepadButtonJustPressed(1, 2) || this.input.isGamepadButtonJustPressed(1, 3)) {
            this.hideErrorModal();
            this.input.removeElement('error_modal_back_button');
        }
    }

    /**
    * Render a rotating spinner wheel
    */
    renderSpinner(x, y, radius = 20, lineWidth = 3) {
        this.guiCtx.save();

        // Translate to center
        this.guiCtx.translate(x, y);
        this.guiCtx.rotate((this.spinnerRotation * Math.PI) / 180);

        // Draw spoke with trail/fade effect
        const trailLength = 40; // Number of trail segments
        const trailSpacing = 10; // Rotation degrees between trail segments

        for (let i = trailLength; i > 0; i--) {
            // Calculate opacity (fade as we go back in trail)
            const opacity = i / trailLength;
            const trailRotation = i * trailSpacing;

            // Save and rotate for this trail segment
            this.guiCtx.save();
            this.guiCtx.rotate((trailRotation * Math.PI) / 180);

            this.guiCtx.strokeStyle = `rgba(136, 136, 136, ${opacity * 0.8})`;
            this.guiCtx.lineWidth = lineWidth;
            this.guiCtx.lineCap = 'round';

            const x1 = 0;
            const y1 = -(radius / 3);
            const x2 = 0;
            const y2 = -radius;

            this.guiCtx.beginPath();
            this.guiCtx.moveTo(x1, y1);
            this.guiCtx.lineTo(x2, y2);
            this.guiCtx.stroke();

            this.guiCtx.restore();
        }

        // Draw outer circle
        this.guiCtx.strokeStyle = '#666666';
        this.guiCtx.beginPath();
        this.guiCtx.arc(0, 0, radius, 0, Math.PI * 2);
        this.guiCtx.stroke();

        this.guiCtx.restore();
    }

    /**
     * Render join modal with connection status
     */
    renderJoinModal() {
        // Semi-transparent overlay
        this.guiCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.guiCtx.fillRect(0, 0, ActionNetManagerGUI.WIDTH, ActionNetManagerGUI.HEIGHT);

        // Modal dimensions
        const modalWidth = 400;
        const modalHeight = 250;
        const modalX = (ActionNetManagerGUI.WIDTH - modalWidth) / 2;
        const modalY = (ActionNetManagerGUI.HEIGHT - modalHeight) / 2;

        // Modal background
        this.guiCtx.fillStyle = '#333333';
        this.guiCtx.fillRect(modalX, modalY, modalWidth, modalHeight);
        this.guiCtx.strokeStyle = '#888888';
        this.guiCtx.lineWidth = 2;
        this.guiCtx.strokeRect(modalX, modalY, modalWidth, modalHeight);

        // Title
        this.renderLabel('Joining Game', ActionNetManagerGUI.WIDTH / 2, modalY + 40, 'bold 32px Arial', '#ffffff', 'center', 'middle', 8, false);

        // Status messages
        const statuses = {
            'contactingHost': 'Contacting host...',
            'offerSent': 'Waiting for host...',
            'acceptedByHost': 'Host accepted',
            'establishingConnection': 'Establishing connection...',
            'connected': 'Connected!'
        };

        const statusMessage = statuses[this.joinModalStatus] || 'Connecting...';
        
        // Centered message with spinner below
        this.renderLabel(statusMessage, ActionNetManagerGUI.WIDTH / 2, modalY + 100, '22px Arial', '#ffffff', 'center', 'middle', 8, false);
        this.renderSpinner(ActionNetManagerGUI.WIDTH / 2, modalY + 145, 15, 2);

        // Cancel button
        const buttonWidth = 120;
        const buttonHeight = 40;
        const buttonX = (ActionNetManagerGUI.WIDTH - buttonWidth) / 2;
        const buttonY = modalY + modalHeight - 60;

        const isHovered = this.input.isElementHovered('join_modal_cancel_button');

        this.guiCtx.fillStyle = isHovered ? '#555555' : '#333333';
        this.guiCtx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
        this.guiCtx.strokeStyle = '#888888';
        this.guiCtx.lineWidth = 2;
        this.guiCtx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);

        this.guiCtx.fillStyle = '#ffffff';
        this.guiCtx.font = 'bold 16px Arial';
        this.guiCtx.textAlign = 'center';
        this.guiCtx.textBaseline = 'middle';
        this.guiCtx.fillText('CANCEL', buttonX + buttonWidth / 2, buttonY + buttonHeight / 2);

        // Register cancel button
        if (!this.input.rawState.elements.gui.has('join_modal_cancel_button')) {
            this.input.registerElement('join_modal_cancel_button', {
                bounds: () => ({
                    x: buttonX,
                    y: buttonY,
                    width: buttonWidth,
                    height: buttonHeight
                })
            });
        }
    }

    /**
     * Handle join modal input
     */
    handleJoinModalInput() {
        if (this.input.isElementJustPressed('join_modal_cancel_button') ||
            this.input.isKeyJustPressed('Escape')) {
            this.joinModalVisible = false;
            this.input.removeElement('join_modal_cancel_button');
            // TODO: abort the join attempt
        }
    }
}
