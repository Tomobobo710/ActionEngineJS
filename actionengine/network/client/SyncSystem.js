/**
 * SyncSystem - Generic client-to-client state synchronization
 * 
 * A transport-agnostic, event-driven synchronization primitive for multiplayer games.
 * 
 * DESIGN PRINCIPLES:
 * - Generic: Works with any data, any transport, any game
 * - Registry-based: Register multiple sync sources by ID
 * - Event-driven: Emit events instead of tight coupling
 * - Self-healing: Periodic broadcasts mean dropped messages don't matter
 * - Observable: Track liveness and staleness of remote data
 * 
 * USAGE EXAMPLE:
 * ```javascript
 * // Create sync system with transport function
 * const sync = new SyncSystem({
 *   send: (msg) => networkManager.send(msg),
 *   broadcastInterval: 16,    // 60fps
 *   staleThreshold: 200        // 12 frames
 * });
 * 
 * // Register sync sources
 * sync.register('match', {
 *   getFields: () => ({
 *     state: matchStateMachine.getState(),
 *     ready: isReady
 *   })
 * });
 * 
 * sync.register('player', {
 *   getFields: () => ({
 *     score: player.score,
 *     level: player.level,
 *     alive: !player.gameOver
 *   })
 * });
 * 
 * // Listen for remote updates
 * sync.on('remoteUpdated', (allRemoteData) => {
 *   console.log('Remote data changed:', allRemoteData);
 *   checkGameConditions();
 * });
 * 
 * sync.on('remoteStale', () => {
 *   console.warn('Remote client stopped responding');
 * });
 * 
 * // Start syncing
 * sync.start();
 * 
 * // Query remote data
 * const remoteMatch = sync.getRemote('match');
 * if (remoteMatch && remoteMatch.ready) {
 *   startGame();
 * }
 * 
 * // Stop syncing
 * sync.stop();
 * ```
 */
class SyncSystem {
    constructor(options = {}) {
        // Transport function (how to send messages)
        this.sendFunction = options.send || null;
        
        // Configuration
        this.broadcastInterval = options.broadcastInterval || 16; // 16ms = ~60fps
        this.staleThreshold = options.staleThreshold || 200; // 200ms = ~12 frames
        
        // Registry of sync sources
        this.syncSources = new Map(); // id -> source object with getFields()
        
        // Local data (what we broadcast)
        this.localData = {};
        
        // Remote data (what we receive)
        this.remoteData = {};
        this.lastRemoteUpdate = 0;
        this.wasStale = false;
        
        // Event listeners
        this.listeners = new Map();
        
        // Broadcast timer
        this.broadcastTimer = null;
        this.isRunning = false;
        
        console.log('[SyncSystem] Initialized', {
            broadcastInterval: this.broadcastInterval,
            staleThreshold: this.staleThreshold
        });
    }
    
    /**
     * Register a sync source
     * 
     * @param {String} id - Unique identifier for this sync source
     * @param {Object} source - Object with getFields() method that returns data to sync
     * 
     * Example:
     * sync.register('player', {
     *   getFields: () => ({ score: player.score, level: player.level })
     * });
     */
    register(id, source) {
        if (!source || typeof source.getFields !== 'function') {
            console.error(`[SyncSystem] Source '${id}' must have a getFields() method`);
            return false;
        }
        
        this.syncSources.set(id, source);
        console.log(`[SyncSystem] Registered sync source: '${id}'`);
        
        // Immediately update local data for this source
        this._updateLocalDataForSource(id);
        
        return true;
    }
    
    /**
     * Unregister a sync source
     * 
     * @param {String} id - ID of source to remove
     */
    unregister(id) {
        if (this.syncSources.delete(id)) {
            delete this.localData[id];
            console.log(`[SyncSystem] Unregistered sync source: '${id}'`);
            return true;
        }
        return false;
    }
    
    /**
     * Register an event listener
     * 
     * Available events:
     * - 'remoteUpdated': (remoteData) => {} - Remote data received
     * - 'remoteStale': () => {} - Remote stopped sending updates
     * - 'remoteFresh': () => {} - Remote resumed sending after being stale
     * - 'broadcast': (localData) => {} - We broadcasted data
     * 
     * @param {String} event - Event name
     * @param {Function} handler - Event handler
     */
    on(event, handler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(handler);
    }
    
    /**
     * Remove an event listener
     * 
     * @param {String} event - Event name
     * @param {Function} handler - Event handler to remove
     */
    off(event, handler) {
        if (!this.listeners.has(event)) return;
        const handlers = this.listeners.get(event);
        const index = handlers.indexOf(handler);
        if (index > -1) {
            handlers.splice(index, 1);
        }
    }
    
    /**
     * Emit an event to all registered handlers
     * @private
     */
    _emit(event, ...args) {
        if (!this.listeners.has(event)) return;
        const handlers = this.listeners.get(event);
        handlers.forEach(handler => {
            try {
                handler(...args);
            } catch (error) {
                console.error(`[SyncSystem] Error in '${event}' handler:`, error);
            }
        });
    }
    
    /**
     * Start periodic broadcasting
     */
    start() {
        if (this.isRunning) {
            console.warn('[SyncSystem] Already running');
            return;
        }
        
        if (!this.sendFunction) {
            console.error('[SyncSystem] Cannot start - no send function provided');
            return;
        }
        
        console.log('[SyncSystem] Starting periodic broadcast...');
        this.isRunning = true;
        
        // Broadcast immediately
        this._broadcast();
        
        // Then broadcast periodically
        this.broadcastTimer = setInterval(() => {
            this._broadcast();
        }, this.broadcastInterval);
    }
    
    /**
     * Stop periodic broadcasting
     */
    stop() {
        if (!this.isRunning) {
            return;
        }
        
        console.log('[SyncSystem] Stopping broadcast');
        this.isRunning = false;
        
        if (this.broadcastTimer) {
            clearInterval(this.broadcastTimer);
            this.broadcastTimer = null;
        }
    }
    
    /**
     * Update local data for a specific source
     * @private
     */
    _updateLocalDataForSource(id) {
        const source = this.syncSources.get(id);
        if (!source) return;
        
        try {
            this.localData[id] = source.getFields();
        } catch (error) {
            console.error(`[SyncSystem] Error getting fields from source '${id}':`, error);
            this.localData[id] = null;
        }
    }
    
    /**
     * Update local data from all registered sources
     * @private
     */
    _updateAllLocalData() {
        for (const id of this.syncSources.keys()) {
            this._updateLocalDataForSource(id);
        }
    }
    
    /**
     * Broadcast current data to remote clients
     * @private
     */
    _broadcast() {
        // Update local data from all sources
        this._updateAllLocalData();
        
        // Send sync update message
        const message = {
            type: 'syncUpdate',
            data: this.localData,
            timestamp: Date.now()
        };
        
        this.sendFunction(message);
        
        // Emit broadcast event
        this._emit('broadcast', this.localData);
    }
    
    /**
     * Handle incoming sync update from remote client
     * 
     * @param {Object} message - Sync update message with data field
     */
    handleSyncUpdate(message) {
        if (!message || !message.data) {
            console.warn('[SyncSystem] Received syncUpdate without data');
            return;
        }
        
        const now = Date.now();
        const wasStale = this.isRemoteStale();
        
        // Store remote data
        this.remoteData = message.data;
        this.lastRemoteUpdate = now;
        
        // Emit updated event
        this._emit('remoteUpdated', this.remoteData);
        
        // Check staleness transition
        if (wasStale && !this.isRemoteStale()) {
            // Remote was stale but is now fresh
            this._emit('remoteFresh');
        }
    }
    
    /**
     * Get remote data for a specific source
     * 
     * @param {String} id - Source ID
     * @returns {Object|null} - Remote data for that source, or null if not available
     */
    getRemote(id) {
        return this.remoteData[id] || null;
    }
    
    /**
     * Get specific field from remote data
     * 
     * @param {String} sourceId - Source ID
     * @param {String} field - Field name
     * @returns {*} - Field value or null
     */
    getRemoteField(sourceId, field) {
        const sourceData = this.getRemote(sourceId);
        return sourceData ? sourceData[field] : null;
    }
    
    /**
     * Get all remote data
     * 
     * @returns {Object} - All remote data from all sources
     */
    getAllRemote() {
        return { ...this.remoteData };
    }
    
    /**
     * Check if remote client data is stale (hasn't updated recently)
     * 
     * @returns {Boolean} - True if data is stale or never received
     */
    isRemoteStale() {
        if (this.lastRemoteUpdate === 0) {
            return true; // Never received data
        }
        
        const timeSinceUpdate = Date.now() - this.lastRemoteUpdate;
        const isStale = timeSinceUpdate > this.staleThreshold;
        
        // Emit stale event on transition
        if (isStale && !this.wasStale) {
            this.wasStale = true;
            this._emit('remoteStale');
        } else if (!isStale) {
            this.wasStale = false;
        }
        
        return isStale;
    }
    
    /**
     * Get time since last remote update in milliseconds
     * 
     * @returns {Number} - Milliseconds since last update (Infinity if never received)
     */
    getTimeSinceLastUpdate() {
        if (this.lastRemoteUpdate === 0) {
            return Infinity;
        }
        return Date.now() - this.lastRemoteUpdate;
    }
    
    /**
     * Check if remote client has sent at least one update
     * 
     * @returns {Boolean} - True if we've received data
     */
    hasRemoteData() {
        return this.lastRemoteUpdate > 0;
    }
    
    /**
     * Force an immediate broadcast (outside normal interval)
     */
    forceBroadcast() {
        if (this.isRunning) {
            this._broadcast();
        }
    }
    
    /**
     * Clear remote data (useful when remote client disconnects)
     */
    clearRemoteData() {
        this.remoteData = {};
        this.lastRemoteUpdate = 0;
        this.wasStale = false;
        console.log('[SyncSystem] Remote data cleared');
    }
    
    /**
     * Get list of registered source IDs
     * 
     * @returns {Array<String>} - Array of source IDs
     */
    getRegisteredSources() {
        return Array.from(this.syncSources.keys());
    }
}
