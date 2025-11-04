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

    constructor(canvases, input, audio, port = 8000, networkConfig = null, syncConfig = null) {
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

        // Initialize networking with custom config or default
        const config = networkConfig || { ...ActionNetManagerGUI.NETWORK_CONFIG };
        
        // Build URL from hostname, port, and protocol
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const hostname = window.location.hostname || 'localhost'; // Fallback to localhost for file:// protocol
        config.url = `${protocol}//${hostname}:${port}`;
        
        this.networkManager = new ActionNetManager(config);

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

        // Create scrollable room list
        this.roomScroller = new ActionScrollableArea({
            listAreaX: 250,
            listAreaY: 350,
            listAreaWidth: 300,
            listAreaHeight: 240,
            itemHeight: 30,
            scrollBarX: 560,
            scrollBarY: 370,
            scrollBarTrackHeight: 200,
            scrollBarThumbStartY: 370,

            // Enable clipping for precise bounds control
            enableClipping: true,
            clipBounds: {
                x: 250,
                y: 350,
                width: 300,
                height: 240
            },

            // Let ActionScrollableArea handle input registration automatically with clipping
            generateItemId: (item, index) => `room_item_${index}`,

            // Custom styling for chat theme
            colors: {
                track: { normal: "rgba(0, 0, 0, 0.2)", hover: "rgba(0, 0, 0, 0.3)" },
                thumb: {
                    normal: "rgba(0, 212, 255, 0.3)",
                    hover: "rgba(0, 212, 255, 0.6)",
                    drag: "rgba(0, 212, 255, 0.8)"
                },
                thumbBorder: { normal: "rgba(0, 212, 255, 0.5)", drag: "#00d4ff" }
            },

            // Enable background drawing with chat theme styling
            drawBackground: true,
            backgroundColor: "rgba(26, 26, 26, 0.9)",
            borderColor: "rgba(0, 212, 255, 0.6)",
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

        // Initialize UI elements
        this.initializeUIElements();

        // Register input elements
        this.registerUIElements();

        console.log("[ActionNetManagerGUI] Initialization completed");
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
            console.log("[ActionNetManagerGUI] Connected to server");
            this.serverStatus = 'ONLINE';
            this.serverStatusColor = '#00ff00';
        });

        this.networkManager.on("disconnected", () => {
            console.log("[ActionNetManagerGUI] Disconnected from server");
            this.emit('disconnected');
        });

        this.networkManager.on("reconnecting", ({ attempt, delay }) => {
            console.log(`[ActionNetManagerGUI] Reconnecting... attempt ${attempt}, waiting ${delay}ms`);
        });

        this.networkManager.on("error", (error) => {
            console.error("[ActionNetManagerGUI] Network error:", error);
        });

        this.networkManager.on("roomList", (rooms) => {
            this.availableRooms = rooms;
        });

        this.networkManager.on("joinedRoom", (roomName) => {
            console.log("[ActionNetManagerGUI] Joined room:", roomName);
            this.emit('joinedRoom', roomName);
        });

        this.networkManager.on("leftRoom", (roomName) => {
            console.log("[ActionNetManagerGUI] Left room:", roomName);
            
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
    }

    /**
     * Render login screen
     */
    renderLoginScreen() {
        this.guiCtx.font = '36px Arial';
        this.guiCtx.fillStyle = '#808080';
        this.guiCtx.textAlign = 'center';
        this.guiCtx.fillText('Login', ActionNetManagerGUI.WIDTH / 2, 150);

        // Draw connect button
        this.renderButton(this.connectButton, 'Connect', this.selectedIndex === 0);

        // Draw back button
        this.renderButton(this.backButton, 'Back', this.selectedIndex === 1);

        // Draw server status
        this.guiCtx.font = '14px Arial';
        this.guiCtx.fillStyle = this.serverStatusColor;
        this.guiCtx.fillText(`ActionNet server is: ${this.serverStatus}`, ActionNetManagerGUI.WIDTH / 2, 380);
    }

    /**
     * Render lobby screen
     */
    renderLobbyScreen() {
        this.guiCtx.font = '36px Arial';
        this.guiCtx.fillStyle = '#808080';
        this.guiCtx.textAlign = 'center';
        this.guiCtx.fillText('Lobby', ActionNetManagerGUI.WIDTH / 2, 40);

        this.guiCtx.font = '24px Arial';
        this.guiCtx.fillStyle = '#ffffff';
        this.guiCtx.fillText(`Welcome, ${this.username}!`, ActionNetManagerGUI.WIDTH / 2, 85);

        // Draw status
        this.guiCtx.font = '14px Arial';
        this.guiCtx.fillStyle = '#cccccc';
        this.guiCtx.fillText('Select a room or create a new one', ActionNetManagerGUI.WIDTH / 2, 120);

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
        // Highlight if selected via keyboard/gamepad or hovered via mouse
        const isHighlighted = isSelected || isHovered;
        this.guiCtx.fillStyle = isHighlighted ? '#555555' : '#333333';
        this.guiCtx.fillRect(button.x, button.y, button.width, button.height);
        this.guiCtx.strokeStyle = isSelected ? '#ffffff' : '#888888'; // White border for keyboard selection
        this.guiCtx.lineWidth = isSelected ? 3 : 2; // Thicker border for keyboard selection
        this.guiCtx.strokeRect(button.x, button.y, button.width, button.height);
        this.guiCtx.fillStyle = '#ffffff';
        this.guiCtx.font = 'bold 24px Arial';
        this.guiCtx.textAlign = 'center';
        this.guiCtx.textBaseline = 'middle';
        this.guiCtx.fillText(text.toUpperCase(), button.x + button.width / 2, button.y + button.height / 2);
    }

    /**
     * Render room list
     */
    renderRoomList() {
        const rooms = this.networkManager.getAvailableRooms();

        if (rooms.length === 0) {
            // Draw header and no rooms message
            this.guiCtx.font = '16px Arial';
            this.guiCtx.fillStyle = '#ffffff';
            this.guiCtx.textAlign = 'center';
            this.guiCtx.fillText('No rooms currently available.', ActionNetManagerGUI.WIDTH / 2, 390);
        } else if (this.roomScroller) {
            // Use the scroller for room list
            this.roomScroller.draw(rooms, (room, index, y) => {
                // Check if this specific room item is hovered or selected via keyboard/gamepad
                const isHovered = this.input.isElementHovered(`room_item_${index}`) || this.roomScroller.scrollThumb.hovered;
                const isSelected = this.selectedIndex === (this.lobbyButtonCount + index);
                const isHighlighted = isHovered || isSelected;

                // Draw room button background
                this.guiCtx.fillStyle = isHighlighted ? '#0099dd' : '#007acc';
                this.guiCtx.fillRect(250, y, 300, 30);

                // Draw room button border (green for keyboard selection, cyan for hover)
                this.guiCtx.strokeStyle = isSelected ? '#00ff00' : '#00d4ff';
                this.guiCtx.lineWidth = isSelected ? 3 : 1;
                this.guiCtx.strokeRect(250, y, 300, 30);

                // Draw room name
                this.guiCtx.fillStyle = '#ffffff';
                this.guiCtx.font = '16px Arial';
                this.guiCtx.textAlign = 'center';
                this.guiCtx.fillText(room, ActionNetManagerGUI.WIDTH / 2, y + 15);
            }, {
                renderHeader: () => {
                    this.guiCtx.font = '16px Arial';
                    this.guiCtx.fillStyle = '#00d4ff';
                    this.guiCtx.textAlign = 'center';
                    this.guiCtx.fillText('Available Rooms:', ActionNetManagerGUI.WIDTH / 2, 330);
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
        switch (this.currentState) {
            case "LOGIN":
                // Handle keyboard/gamepad navigation for LOGIN screen
                if (this.input.isKeyJustPressed('DirUp') ||
                    this.input.isGamepadButtonJustPressed(12, 0) || this.input.isGamepadButtonJustPressed(12, 1) ||
                    this.input.isGamepadButtonJustPressed(12, 2) || this.input.isGamepadButtonJustPressed(12, 3)) {
                    this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                }
                if (this.input.isKeyJustPressed('DirDown') ||
                    this.input.isGamepadButtonJustPressed(13, 0) || this.input.isGamepadButtonJustPressed(13, 1) ||
                    this.input.isGamepadButtonJustPressed(13, 2) || this.input.isGamepadButtonJustPressed(13, 3)) {
                    this.selectedIndex = Math.min(this.loginButtonCount - 1, this.selectedIndex + 1);
                }
                // Confirm with Action1 (Enter/A button)
                if (this.input.isKeyJustPressed('Action1') ||
                    this.input.isGamepadButtonJustPressed(0, 0) || this.input.isGamepadButtonJustPressed(0, 1) ||
                    this.input.isGamepadButtonJustPressed(0, 2) || this.input.isGamepadButtonJustPressed(0, 3)) {
                    this.emit('buttonPressed');
                    if (this.selectedIndex === 0) {
                        this.startConnection();
                    } else if (this.selectedIndex === 1) {
                        this.emit('back');
                    }
                }
                // Back with Action2 (Escape/B button)
                if (this.input.isKeyJustPressed('Action2') ||
                    this.input.isGamepadButtonJustPressed(1, 0) || this.input.isGamepadButtonJustPressed(1, 1) ||
                    this.input.isGamepadButtonJustPressed(1, 2) || this.input.isGamepadButtonJustPressed(1, 3)) {
                    this.emit('buttonPressed');
                    this.emit('back');
                }

                // Mouse input
                if (this.input.isElementJustPressed("connectButton")) {
                    this.emit('buttonPressed');
                    this.startConnection();
                } else if (this.input.isElementJustPressed("backButton")) {
                    this.emit('buttonPressed');
                    // Emit back event so game can return to title screen
                    this.emit('back');
                }
                // Update selection based on hover
                if (this.input.isElementHovered("connectButton")) {
                    this.selectedIndex = 0;
                } else if (this.input.isElementHovered("backButton")) {
                    this.selectedIndex = 1;
                }
                break;
            case "LOBBY":
                const availableRooms = this.networkManager.getAvailableRooms();
                const totalSelectableItems = this.lobbyButtonCount + availableRooms.length;

                // Handle keyboard/gamepad navigation for LOBBY screen
                if (this.input.isKeyJustPressed('DirUp') ||
                    this.input.isGamepadButtonJustPressed(12, 0) || this.input.isGamepadButtonJustPressed(12, 1) ||
                    this.input.isGamepadButtonJustPressed(12, 2) || this.input.isGamepadButtonJustPressed(12, 3)) {
                    this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                    this.scrollToSelectedItem();
                }
                if (this.input.isKeyJustPressed('DirDown') ||
                    this.input.isGamepadButtonJustPressed(13, 0) || this.input.isGamepadButtonJustPressed(13, 1) ||
                    this.input.isGamepadButtonJustPressed(13, 2) || this.input.isGamepadButtonJustPressed(13, 3)) {
                    this.selectedIndex = Math.min(totalSelectableItems - 1, this.selectedIndex + 1);
                    this.scrollToSelectedItem();
                }

                // Confirm with Action1 (Enter/A button)
                if (this.input.isKeyJustPressed('Action1') ||
                    this.input.isGamepadButtonJustPressed(0, 0) || this.input.isGamepadButtonJustPressed(0, 1) ||
                    this.input.isGamepadButtonJustPressed(0, 2) || this.input.isGamepadButtonJustPressed(0, 3)) {
                    this.emit('buttonPressed');
                    if (this.selectedIndex === 0) {
                        this.changeUsername();
                    } else if (this.selectedIndex === 1) {
                        this.createAndJoinRoom();
                    } else if (this.selectedIndex === 2) {
                        this.currentState = "LOGIN";
                        this.selectedIndex = 0; // Reset selection
                    } else {
                        // Room selection (index 3+)
                        const roomIndex = this.selectedIndex - this.lobbyButtonCount;
                        if (roomIndex >= 0 && roomIndex < availableRooms.length) {
                            console.log("✅ Room selected via keyboard/gamepad:", availableRooms[roomIndex]);
                            this.selectedRoom = availableRooms[roomIndex];
                            this.joinSelectedRoom();
                        }
                    }
                }

                // Back with Action2 (Escape/B button)
                if (this.input.isKeyJustPressed('Action2') ||
                    this.input.isGamepadButtonJustPressed(1, 0) || this.input.isGamepadButtonJustPressed(1, 1) ||
                    this.input.isGamepadButtonJustPressed(1, 2) || this.input.isGamepadButtonJustPressed(1, 3)) {
                    this.emit('buttonPressed');
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
                    this.emit('buttonPressed');
                    // Go back to login screen (stay connected)
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
                            this.selectedRoom = availableRooms[i];
                            this.joinSelectedRoom();
                            break;
                        }
                    }
                }

                // Update selection based on hover
                if (this.input.isElementHovered("changeNameButton")) {
                    this.selectedIndex = 0;
                } else if (this.input.isElementHovered("createRoomButton")) {
                    this.selectedIndex = 1;
                } else if (this.input.isElementHovered("backToLoginButton")) {
                    this.selectedIndex = 2;
                } else {
                    // Check room hover
                    for (let i = 0; i < availableRooms.length; i++) {
                        if (this.input.isElementHovered(`room_item_${i}`)) {
                            this.selectedIndex = this.lobbyButtonCount + i;
                            break;
                        }
                    }
                }
                break;
        }
    }

    /**
     * Start connection to server
     */
    async startConnection() {
        this.username = this.generateRandomUsername();
        this.currentState = "LOGIN";
        this.serverStatus = 'CONNECTING';
        this.serverStatusColor = '#ffff00';

        try {
            await this.networkManager.connectToServer({ username: this.username });
            // Update status immediately on success
            this.serverStatus = 'ONLINE';
            this.serverStatusColor = '#00ff00';
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
        }
    }

    /**
     * Join selected room
     */
    joinSelectedRoom() {
        if (!this.selectedRoom) return;

        this.networkManager.joinRoom(this.selectedRoom)
            .then(() => {
                // Event will be emitted by setupNetworkEvents
            })
            .catch((error) => {
                console.error("Failed to join room:", error);
            });
    }

    /**
     * Create and join room
     */
    createAndJoinRoom() {
        const roomName = `${this.username}'s room`;
        this.networkManager.joinRoom(roomName)
            .then(() => {
                // Event will be emitted
            })
            .catch((error) => {
                console.error("Failed to create room:", error);
            });
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
        }
    }

    /**
     * Generate random username
     */
    generateRandomUsername() {
        const adjectives = ['Big', 'Floppy', 'Little', 'Goofy', 'Wiggly'];
        const nouns = ['Farter', 'Butt', 'Booger', 'Nugget', 'Tooter'];
        const numbers = ['69', '420', '666', '1337', '123'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const number = numbers[Math.floor(Math.random() * numbers.length)];
        return `${adj}${noun}${number}`;
    }

    /**
     * Start server check
     */
    startServerCheck() {
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
        console.log(`[ActionNetManagerGUI] Registered custom handler: '${messageType}'`);
        return true;
    }

    /**
     * Remove a custom message handler
     * 
     * @param {String} messageType - Message type to unregister
     */
    unregisterMessageHandler(messageType) {
        if (this.customMessageHandlers.delete(messageType)) {
            console.log(`[ActionNetManagerGUI] Unregistered handler: '${messageType}'`);
            return true;
        }
        return false;
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
}