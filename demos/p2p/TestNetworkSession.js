/**
 * TestNetworkSession - Simple game session orchestrator for testing
 *
 * Manages game lifecycle and state synchronization.
 * Used by test games to separate game logic from UI and transport.
 * 
 * Can operate in two modes:
 * - Standalone: creates its own SyncSystem (for HTML tests)
 * - With GUI: uses gui.syncSystem (for ActionEngine integration)
 */
class TestNetworkSession {
    constructor(networkManager, gui = null) {
        this.networkManager = networkManager;
        this.gui = gui;

        // Game state
        this.gameState = {
            score: 0,
            level: 1
        };

        this.remoteGameState = {};
        this.syncSystem = null;
        this.isRunning = false;

        // Event handlers
        this.listeners = new Map();

        this.log('Initialized TestNetworkSession');
    }

    /**
     * Register event handler
     */
    on(event, handler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(handler);
    }

    /**
     * Emit event
     */
    emit(event, ...args) {
        if (!this.listeners.has(event)) return;
        this.listeners.get(event).forEach(h => {
            try {
                h(...args);
            } catch (e) {
                this.log(`Error in ${event} handler: ${e.message}`, 'error');
            }
        });
    }

    /**
     * Logging
     */
    log(msg, level = 'info') {
        console.log(`[TestNetworkSession] ${msg}`);
    }

    /**
     * Start the game session (called when roomJoined fires)
     * 
     * @param {RTCDataChannel} dataChannel - The active data channel for this session (may be null for host initially)
     */
    start(dataChannel) {
        this.log('Starting game session');

        if (this.isRunning) {
            this.log('Session already running');
            return;
        }

        // Use GUI's SyncSystem if available (ActionEngine mode), otherwise create standalone
        if (this.gui && this.gui.syncSystem) {
            this.log('Using GUI SyncSystem (ActionEngine mode)');
            this.syncSystem = this.gui.syncSystem;
            
            // Only set up dataChannel if it's available (not host waiting for guests)
            if (dataChannel) {
                this.log('DataChannel available, setting up send pipeline');
                // Update the SyncSystem's send function with the active dataChannel
                this.syncSystem.setSendFunction((msg) => {
                    try {
                        dataChannel.send(JSON.stringify(msg));
                    } catch (e) {
                        this.log(`Send failed: ${e.message}`, 'error');
                    }
                });
                
                // Setup data channel message handler
                dataChannel.onmessage = (evt) => {
                    try {
                        const message = JSON.parse(evt.data);
                        if (message.type === 'syncUpdate') {
                            this.syncSystem.handleSyncUpdate(message);
                        }
                    } catch (e) {
                        this.log(`Failed to handle message: ${e.message}`, 'error');
                    }
                };
            } else {
                this.log('No dataChannel yet (host waiting for guests)');
            }
        } else {
            this.log('Creating standalone SyncSystem (HTML test mode)');
            // Create SyncSystem with the data channel
            this.syncSystem = new SyncSystem({
                send: (msg) => {
                    try {
                        dataChannel.send(JSON.stringify(msg));
                    } catch (e) {
                        this.log(`Send failed: ${e.message}`, 'error');
                    }
                },
                broadcastInterval: 100
            });

            // Setup data channel message handler (only needed in standalone mode)
            dataChannel.onmessage = (evt) => {
                try {
                    const message = JSON.parse(evt.data);
                    if (message.type === 'syncUpdate') {
                        this.syncSystem.handleSyncUpdate(message);
                    }
                } catch (e) {
                    this.log(`Failed to handle message: ${e.message}`, 'error');
                }
            };
            }

        // Register sync sources
        this.registerSyncSources();

        // Listen for remote updates
        this.syncSystem.on('remoteUpdated', () => {
            this.handleRemoteUpdated();
        });

        // Start syncing (fresh SyncSystem, should not be running yet)
        this.syncSystem.start();
        this.isRunning = true;

        this.emit('sessionStarted');
        this.log('Game session started');
    }

    /**
     * Register what we want to sync
     */
    registerSyncSources() {
        this.syncSystem.register('gameState', {
            getFields: () => ({
                score: this.gameState.score,
                level: this.gameState.level
            })
        });
    }

    /**
     * Handle remote state updates
     */
    handleRemoteUpdated() {
        const remoteGameState = this.syncSystem.getRemote('gameState');
        if (remoteGameState) {
            this.remoteGameState = remoteGameState;
            this.emit('remoteStateUpdated', this.remoteGameState);
        }
    }

    /**
     * Modify local game state
     */
    addScore(amount) {
        this.gameState.score += amount;
        if (this.syncSystem) {
            this.syncSystem.forceBroadcast();
        }
    }

    /**
     * Increment level
     */
    incrementLevel() {
        this.gameState.level += 1;
        if (this.syncSystem) {
            this.syncSystem.forceBroadcast();
        }
    }

    /**
     * Get current game state
     */
    getLocalState() {
        return { ...this.gameState };
    }

    /**
     * Get remote game state
     */
    getRemoteState() {
        return { ...this.remoteGameState };
    }

    /**
     * Update dataChannel when it becomes available (for hosts waiting on guests)
     * Call this when a guest connects and provides a dataChannel
     */
    updateDataChannel(dataChannel) {
        if (!dataChannel) {
            this.log('updateDataChannel called with null, ignoring');
            return;
        }

        this.log('Updating dataChannel for active session');

        if (!this.syncSystem) {
            this.log('No SyncSystem yet, cannot update dataChannel');
            return;
        }

        // Update the SyncSystem's send function with the dataChannel
        this.syncSystem.setSendFunction((msg) => {
            try {
                dataChannel.send(JSON.stringify(msg));
            } catch (e) {
                this.log(`Send failed: ${e.message}`, 'error');
            }
        });

        // Setup data channel message handler
        dataChannel.onmessage = (evt) => {
            try {
                const message = JSON.parse(evt.data);
                if (message.type === 'syncUpdate') {
                    this.syncSystem.handleSyncUpdate(message);
                }
            } catch (e) {
                this.log(`Failed to handle message: ${e.message}`, 'error');
            }
        };

        // Start syncing if not already running
        if (!this.syncSystem.isRunning) {
            this.syncSystem.start();
        }
    }

    /**
     * Stop the session
     */
    stop() {
        this.log('Stopping game session');

        if (this.syncSystem) {
            this.syncSystem.stop();
            // Only clear if we created it (standalone mode)
            // Don't null out GUI's SyncSystem - it persists
            if (!this.gui || !this.gui.syncSystem) {
                this.syncSystem = null;
            }
        }

        this.isRunning = false;
        this.emit('sessionStopped');
    }

    /**
     * Handle user left
     */
    handleUserLeft(user) {
        this.log(`User left: ${user.username}`);
        this.stop();
        this.emit('opponentLeft', user);
    }
}
