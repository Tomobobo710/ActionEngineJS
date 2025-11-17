/**
 * ActionNetServerUtils - Server-side utilities for ActionNet
 * 
 * Provides common patterns for multiplayer servers:
 * - Client tracking
 * - Room/Lobby management
 * - Broadcasting utilities
 * - Connection lifecycle helpers
 * 
 * This is NOT a framework - just utilities to make common patterns easier.
 * Developers can use all, some, or none of these helpers.
 * 
 * USAGE:
 * ```javascript
 * const WebSocket = require('ws');
 * const ActionNetServerUtils = require('./ActionNetServerUtils');
 *
 * const wss = new WebSocket.Server({ port: 3001 });
 * const utils = new ActionNetServerUtils(wss);
 *
 * wss.on('connection', (ws) => {
 *     ws.on('message', (data) => {
 *         const msg = JSON.parse(data.toString());
 *
 *         if (msg.type === 'connect') {
 *             utils.registerClient(ws, msg);
 *         }
 *         if (msg.type === 'joinRoom') {
 *             utils.addToRoom(ws, msg.roomName);
 *             utils.broadcastToRoom(msg.roomName, {type: 'userJoined', username: msg.username});
 *         }
 *     });
 * });
 * ```
 */
class ActionNetServerUtils {
    constructor(wss) {
        this.wss = wss;
        
        // Client tracking
        this.clients = new Map();           // ws -> client info
        
        // Room management
        this.rooms = new Map();              // roomName -> Set of ws clients
        this.roomHosts = new Map();          // roomName -> ws (host client)
        this.lobby = new Set();              // Clients not in any room
    }

    /**
     * Generate a unique display name for a client
     * Checks against all existing display names globally
     *
     * @param {String} username - The requested username
     * @param {String} excludeId - Client ID to exclude from check (for updates)
     * @returns {String} - Unique display name
     */
    generateUniqueDisplayName(username, excludeId = null) {
        const allDisplayNames = Array.from(this.clients.values())
            .filter(client => client.id !== excludeId)
            .map(client => client.displayName);
        const countMap = {};
        
        // Count existing instances of this username (for display name generation)
        const allUsernames = Array.from(this.clients.values())
            .filter(client => client.id !== excludeId)
            .map(client => client.username);
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
     * Register a client connection
     *
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} data - Client data (username, clientId, etc.)
     */
    registerClient(ws, data) {
        // Extract client identity
        const clientId = data.clientId || data.id || `client_${Date.now()}`;
        const username = data.username || data.name || clientId;
        
        // Generate unique display name
        const displayName = this.generateUniqueDisplayName(username);
        
        // Store client info including display name
        this.clients.set(ws, {
            id: clientId,
            username: username,        // Original username
            displayName: displayName,  // Unique display name
            roomName: null,
            joinTime: Date.now(),
            metadata: data
        });

        // Add to lobby
        this.lobby.add(ws);

        return true;
    }

    /**
     * Add client to a room
     * 
     * @param {WebSocket} ws - WebSocket connection
     * @param {String} roomName - Room to join
     * @returns {Boolean} - Success
     */
    addToRoom(ws, roomName) {
        const client = this.clients.get(ws);
        if (!client) {
            console.warn('Attempted to add unregistered client to room');
            return false;
        }

        // Remove from lobby
        this.lobby.delete(ws);

        // Remove from previous room if exists
        if (client.roomName) {
            this.removeFromRoom(ws);
        }

        // Create room if doesn't exist
        if (!this.rooms.has(roomName)) {
            this.rooms.set(roomName, new Set());
            // First person to join becomes the host
            this.roomHosts.set(roomName, ws);
        }

        // Add to room
        this.rooms.get(roomName).add(ws);
        client.roomName = roomName;

        return true;
    }

    /**
     * Remove client from their current room
     * 
     * @param {WebSocket} ws - WebSocket connection
     * @param {Boolean} returnToLobby - Whether to put client back in lobby
     * @returns {String|null} - Room they were removed from
     */
    removeFromRoom(ws, returnToLobby = false) {
        const client = this.clients.get(ws);
        if (!client || !client.roomName) {
            return null;
        }

        const roomName = client.roomName;
        const room = this.rooms.get(roomName);

        if (room) {
            room.delete(ws);
            
            // Delete empty rooms
            if (room.size === 0) {
                this.rooms.delete(roomName);
                this.roomHosts.delete(roomName);
            }
        }

        client.roomName = null;

        // Put back in lobby if requested
        if (returnToLobby) {
            this.lobby.add(ws);
        }

        return roomName;
    }

    /**
     * Handle client disconnect
     * 
     * @param {WebSocket} ws - WebSocket connection
     * @returns {Object|null} - Client info that was removed
     */
    handleDisconnect(ws) {
        const client = this.clients.get(ws);
        if (!client) {
            return null;
        }

        // Remove from room
        const roomName = this.removeFromRoom(ws);

        // Remove from lobby
        this.lobby.delete(ws);

        // Remove client tracking
        this.clients.delete(ws);

        return { ...client, roomName };
    }

    /**
     * Send message to a specific client
     * 
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} message - Message to send
     */
    sendToClient(ws, message) {
        if (ws.readyState === ws.constructor.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    /**
     * Broadcast message to all clients in a room
     * 
     * @param {String} roomName - Room to broadcast to
     * @param {Object} message - Message to send
     * @param {WebSocket} excludeWs - Client to exclude (optional)
     */
    broadcastToRoom(roomName, message, excludeWs = null) {
        const room = this.rooms.get(roomName);
        if (!room) {
            return;
        }

        const messageStr = JSON.stringify(message);
        room.forEach(client => {
            if (client !== excludeWs && client.readyState === client.constructor.OPEN) {
                client.send(messageStr);
            }
        });
    }

    /**
     * Broadcast message to all connected clients
     * 
     * @param {Object} message - Message to send
     * @param {WebSocket} excludeWs - Client to exclude (optional)
     */
    broadcastToAll(message, excludeWs = null) {
        const messageStr = JSON.stringify(message);
        this.wss.clients.forEach(client => {
            if (client !== excludeWs && client.readyState === client.constructor.OPEN) {
                client.send(messageStr);
            }
        });
    }

    /**
     * Broadcast message to all clients in lobby
     * 
     * @param {Object} message - Message to send
     * @param {WebSocket} excludeWs - Client to exclude (optional)
     */
    broadcastToLobby(message, excludeWs = null) {
        const messageStr = JSON.stringify(message);
        this.lobby.forEach(client => {
            if (client !== excludeWs && client.readyState === client.constructor.OPEN) {
                client.send(messageStr);
            }
        });
    }

    /**
     * Get list of all room names
     *
     * @returns {Array<String>}
     */
    getRoomList() {
        return Array.from(this.rooms.keys());
    }

    /**
     * Get list of all rooms with player counts
     *
     * @param {Number} maxPlayersPerRoom - Maximum players allowed per room (-1 = no limit)
     * @returns {Array<Object>} - Array of room objects with {name, playerCount, maxPlayers}
     */
    getRoomListWithCounts(maxPlayersPerRoom = -1) {
        return Array.from(this.rooms.keys()).map(roomName => {
            const playerCount = this.getRoomSize(roomName);
            return {
                name: roomName,
                playerCount: playerCount,
                maxPlayers: maxPlayersPerRoom
            };
        });
    }

    /**
     * Get list of client details in a room (including displayName)
     *
     * @param {String} roomName - Room name
     * @returns {Array<Object>}
     */
    getClientsInRoom(roomName) {
        const room = this.rooms.get(roomName);
        if (!room) {
            return [];
        }

        const hostWs = this.roomHosts.get(roomName);

        return Array.from(room).map(ws => {
            const client = this.clients.get(ws);
            return client ? {
                id: client.id,
                username: client.username,
                displayName: client.displayName,
                joinTime: client.joinTime,
                isHost: ws === hostWs
            } : null;
        }).filter(client => client !== null);
    }

    /**
     * Get full client info for all clients in a room
     *
     * @param {String} roomName - Room name
     * @returns {Array<Object>}
     */
    getClientDetailsInRoom(roomName) {
        const room = this.rooms.get(roomName);
        if (!room) {
            return [];
        }

        return Array.from(room).map(ws => {
            const client = this.clients.get(ws);
            return client ? {
                id: client.id,
                username: client.username,
                joinTime: client.joinTime
            } : null;
        }).filter(client => client !== null);
    }

    /**
     * Get client info for a WebSocket connection
     * 
     * @param {WebSocket} ws - WebSocket connection
     * @returns {Object|null}
     */
    getClient(ws) {
        return this.clients.get(ws) || null;
    }

    /**
     * Get room info (name, client count, client IDs)
     * 
     * @param {String} roomName - Room name
     * @returns {Object|null}
     */
    getRoomInfo(roomName) {
        const room = this.rooms.get(roomName);
        if (!room) {
            return null;
        }

        return {
            name: roomName,
            clientCount: room.size,
            clients: this.getClientsInRoom(roomName)
        };
    }

    /**
     * Check if room exists
     * 
     * @param {String} roomName - Room name
     * @returns {Boolean}
     */
    roomExists(roomName) {
        return this.rooms.has(roomName);
    }

    /**
     * Get number of clients in a room
     * 
     * @param {String} roomName - Room name
     * @returns {Number}
     */
    getRoomSize(roomName) {
        const room = this.rooms.get(roomName);
        return room ? room.size : 0;
    }

    /**
     * Get total number of connected clients
     * 
     * @returns {Number}
     */
    getTotalClients() {
        return this.clients.size;
    }

    /**
     * Get number of clients in lobby
     * 
     * @returns {Number}
     */
    getLobbySize() {
        return this.lobby.size;
    }

    /**
     * Get the host (creator) of a room
     * 
     * @param {String} roomName - Room name
     * @returns {Object|null} - Host client info or null if room doesn't exist
     */
    getHostOfRoom(roomName) {
        const hostWs = this.roomHosts.get(roomName);
        if (!hostWs) {
            return null;
        }
        
        const client = this.clients.get(hostWs);
        if (!client) {
            return null;
        }
        
        return {
            id: client.id,
            username: client.username,
            displayName: client.displayName,
            isHost: true
        };
    }

    /**
     * Check if a client is the host of their room
     * 
     * @param {WebSocket} ws - WebSocket connection
     * @returns {Boolean}
     */
    isHost(ws) {
        const client = this.clients.get(ws);
        if (!client || !client.roomName) {
            return false;
        }
        
        const hostWs = this.roomHosts.get(client.roomName);
        return hostWs === ws;
    }
}

// CommonJS export for Node.js
module.exports = ActionNetServerUtils;
