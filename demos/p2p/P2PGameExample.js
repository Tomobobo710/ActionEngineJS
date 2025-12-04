/**
 * P2PGameExample.js
 * 
 * A minimal ActionEngine game demonstrating P2P networking with ActionNetManagerGUI.
 * Two players can discover each other, join a room, and sync their game state (score/level).
 */

class Game {
    static WIDTH = 800;
    static HEIGHT = 600;

    constructor(canvases, input, audio) {
        // Store ActionEngine systems
        this.input = input;
        this.audio = audio;
        this.guiCtx = canvases.guiCtx;
        this.guiCanvas = canvases.guiCanvas;

        // Initialize ActionNetManagerGUI in P2P mode
        this.gui = new ActionNetManagerGUI(
            canvases,
            input,
            audio,
            { mode: 'p2p' }  // Use P2P mode with default gameId
        );

        // Game state
        this.inGame = false;  // Are we in a room?
        this.localScore = 0;
        this.localLevel = 1;
        this.remoteScore = 0;
        this.remoteLevel = 1;
        this.opponentUsername = '';

        // UI buttons for in-game
        this.addScoreBtn = { x: 150, y: 300, width: 150, height: 60, text: '+10 Score' };
        this.levelUpBtn = { x: 150, y: 400, width: 150, height: 60, text: '+1 Level' };
        this.leaveRoomBtn = { x: 150, y: 500, width: 150, height: 60, text: 'Leave Room' };

        // Session management (like Tetris NetworkSession)
        this.gameSession = null;

        // Setup networking event listeners
        this.setupNetworkingEvents();

        // Register UI elements with input system
        this.registerUIElements();

        console.log("[P2PGameExample] Initialization completed");
    }

    /**
     * Setup networking event listeners
     */
    setupNetworkingEvents() {
        const netManager = this.gui.getNetManager();

        // When hosting a room (host side)
        netManager.on('roomCreated', () => {
            console.log("[P2PGameExample] Room created, waiting for players");
            // Host waits for a joiner to connect
            // Don't enter game yet - wait for joinedRoom event
        });

        // When someone tries to join the room (host side)
        netManager.on('joinRequest', (req) => {
            console.log(`[P2PGameExample] Join request from ${req.username}`);
            req.accept(); // Auto-accept for now
        });

        // When user joins a room or someone joins your room, show the game UI
        this.gui.on('joinedRoom', (event) => {
            this.inGame = true;
            this.localScore = 0;
            this.localLevel = 1;
            this.remoteScore = 0;
            this.remoteLevel = 1;
            console.log("[P2PGameExample] Joined room event fired");

            // If session already exists, just update the dataChannel (host receiving guest)
            if (this.gameSession) {
                console.log("[P2PGameExample] Session exists, updating dataChannel");
                if (event.dataChannel) {
                    this.gameSession.updateDataChannel(event.dataChannel);
                }
                return;
            }

            // Create new session (first time joining)
            console.log("[P2PGameExample] Creating new game session");
            const netManager = this.gui.getNetManager();
            this.gameSession = new TestNetworkSession(netManager, this.gui);

            // Override registerSyncSources to sync this game's state (not session's internal state)
            this.gameSession.registerSyncSources = () => {
                this.gameSession.syncSystem.register('gameState', {
                    getFields: () => ({
                        score: this.localScore,
                        level: this.localLevel
                    })
                });
            };

            // Listen for remote state updates
            this.gameSession.on('remoteStateUpdated', (remoteState) => {
                if (remoteState) {
                    this.remoteScore = remoteState.score || 0;
                    this.remoteLevel = remoteState.level || 1;
                }
            });

            // Start the session with the data channel (may be null for host initially)
            const dataChannel = event.dataChannel;
            this.gameSession.start(dataChannel);
        });

        // When user leaves a room, show the lobby again
        this.gui.on('leftRoom', () => {
            this.inGame = false;
            if (this.gameSession) {
                this.gameSession.stop();
                this.gameSession = null;
            }
            console.log("[P2PGameExample] Left room");
        });
    }

    /**
     * Register UI elements with input system
     */
    registerUIElements() {
        this.input.registerElement('addScoreBtn', {
            bounds: () => this.addScoreBtn
        });

        this.input.registerElement('levelUpBtn', {
            bounds: () => this.levelUpBtn
        });

        this.input.registerElement('leaveRoomBtn', {
            bounds: () => this.leaveRoomBtn
        });
    }

    /**
     * Main update loop
     */
    action_update(deltaTime) {
        if (this.inGame) {
            // In-game: update game logic, not GUI
            this.handleGameInput();
        } else {
            // Lobby: update GUI for room selection
            this.gui.action_update(deltaTime);
        }
    }

    /**
     * Handle game input
     */
    handleGameInput() {
        // Add score button
        if (this.input.isElementJustPressed('addScoreBtn')) {
            this.localScore += 10;
            console.log(`[P2PGameExample] Score increased to ${this.localScore}`);
            // Force broadcast the update
            if (this.gameSession && this.gameSession.syncSystem) {
                this.gameSession.syncSystem.forceBroadcast();
            }
        }

        // Level up button
        if (this.input.isElementJustPressed('levelUpBtn')) {
            this.localLevel += 1;
            console.log(`[P2PGameExample] Level increased to ${this.localLevel}`);
            // Force broadcast the update
            if (this.gameSession && this.gameSession.syncSystem) {
                this.gameSession.syncSystem.forceBroadcast();
            }
        }

        // Leave room button
        if (this.input.isElementJustPressed('leaveRoomBtn')) {
            this.leaveRoom();
        }
    }

    /**
     * Leave the current room
     */
    leaveRoom() {
        const netManager = this.gui.getNetManager();
        if (netManager.isInRoom()) {
            netManager.leaveRoom();
            console.log("[P2PGameExample] Leaving room");
        }
    }

    /**
     * Main render loop
     */
    action_draw() {
        // Clear canvas
        this.guiCtx.fillStyle = '#1a1a1a';
        this.guiCtx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);

        if (this.inGame) {
            // In-game: draw game UI only
            this.drawGameScreen();
        } else {
            // Lobby: draw GUI for room selection
            this.gui.action_draw();
        }
    }

    /**
     * Draw lobby screen (handled by ActionNetManagerGUI)
     */
    drawLobbyScreen() {
        // GUI renders the lobby, we don't need to draw anything here
    }

    /**
     * Draw game screen with score display and buttons
     */
    drawGameScreen() {
        // Draw title
        this.guiCtx.fillStyle = '#ffffff';
        this.guiCtx.font = 'bold 36px Arial';
        this.guiCtx.textAlign = 'center';
        this.guiCtx.fillText('P2P Game', Game.WIDTH / 2, 50);

        // Draw local player section (left side)
        this.drawPlayerSection(
            100,
            120,
            this.gui.getUsername() || 'You',
            this.localScore,
            this.localLevel,
            '#00ff00'
        );

        // Draw opponent section (right side)
        this.drawPlayerSection(
            500,
            120,
            'Opponent',
            this.remoteScore,
            this.remoteLevel,
            '#ff6b6b'
        );

        // Draw game buttons
        this.drawButton(this.addScoreBtn, '#2196F3');
        this.drawButton(this.levelUpBtn, '#4CAF50');
        this.drawButton(this.leaveRoomBtn, '#ff6b6b');
    }

    /**
     * Draw a player section with score and level
     */
    drawPlayerSection(x, y, username, score, level, color) {
        // Box background
        this.guiCtx.fillStyle = 'rgba(50, 50, 50, 0.8)';
        this.guiCtx.fillRect(x - 100, y, 200, 250);
        this.guiCtx.strokeStyle = color;
        this.guiCtx.lineWidth = 2;
        this.guiCtx.strokeRect(x - 100, y, 200, 250);

        // Username
        this.guiCtx.fillStyle = color;
        this.guiCtx.font = 'bold 18px Arial';
        this.guiCtx.textAlign = 'center';
        this.guiCtx.fillText(username, x, y + 40);

        // Score label and value
        this.guiCtx.fillStyle = '#ffffff';
        this.guiCtx.font = '14px Arial';
        this.guiCtx.fillText('Score:', x, y + 100);
        this.guiCtx.font = 'bold 28px Arial';
        this.guiCtx.fillStyle = color;
        this.guiCtx.fillText(score, x, y + 140);

        // Level label and value
        this.guiCtx.fillStyle = '#ffffff';
        this.guiCtx.font = '14px Arial';
        this.guiCtx.fillText('Level:', x, y + 180);
        this.guiCtx.font = 'bold 28px Arial';
        this.guiCtx.fillStyle = color;
        this.guiCtx.fillText(level, x, y + 220);
    }

    /**
     * Draw a button
     */
    drawButton(button, color) {
        const isHovered = this.input.isElementHovered(
            button === this.addScoreBtn ? 'addScoreBtn' :
            button === this.levelUpBtn ? 'levelUpBtn' : 'leaveRoomBtn'
        );

        // Button background
        this.guiCtx.fillStyle = isHovered ? 'rgba(255, 255, 255, 0.2)' : color;
        this.guiCtx.fillRect(button.x, button.y, button.width, button.height);

        // Button border
        this.guiCtx.strokeStyle = isHovered ? '#ffffff' : color;
        this.guiCtx.lineWidth = isHovered ? 3 : 2;
        this.guiCtx.strokeRect(button.x, button.y, button.width, button.height);

        // Button text
        this.guiCtx.fillStyle = '#ffffff';
        this.guiCtx.font = 'bold 16px Arial';
        this.guiCtx.textAlign = 'center';
        this.guiCtx.textBaseline = 'middle';
        this.guiCtx.fillText(
            button.text,
            button.x + button.width / 2,
            button.y + button.height / 2
        );
    }
}
