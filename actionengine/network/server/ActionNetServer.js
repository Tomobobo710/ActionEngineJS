/**
 * Multiplayer Game Server
 *
 * A dedicated server for multiplayer games using ActionNetServerUtils.
 * Handles connection/room management and generically relays game messages.
 *
 * Usage: node tetrisserver.js [port] [maxPlayersPerRoom]
 * Example: node tetrisserver.js 8000 4
 */

const WebSocket = require("ws");
const http = require("http");
const path = require("path");
const ActionNetServerUtils = require("./ActionNetServerUtils");

// ========================================
// CONFIGURATION
// ========================================
const CONFIG = {
    port: 8000, // Default server port
    debug: true, // Enable debug logging
    maxPlayersPerRoom: -1 // Maximum players allowed per room (-1 = no limit)
};
// ========================================

// Allow command line override if needed
const port = process.argv[2] || CONFIG.port;
const maxPlayersPerRoom = process.argv[3] || CONFIG.maxPlayersPerRoom;

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Create ActionNet server utilities
const utils = new ActionNetServerUtils(wss);

// Game state management
const gameRooms = new Map(); // roomName -> game state

console.log(`Starting Multiplayer Game server on port ${port}...`);
console.log(`Max players per room: ${maxPlayersPerRoom === -1 ? 'No limit' : maxPlayersPerRoom}`);

wss.on("connection", (ws, req) => {
    console.log("New player connected from:", req.socket.remoteAddress);

    // Send current room list immediately when client connects
    const roomList = utils.getRoomListWithCounts(maxPlayersPerRoom);
    if (roomList.length > 0) {
        utils.sendToClient(ws, {
            type: "roomList",
            rooms: roomList
        });
        console.log(`Sent current room list to new player:`, roomList);
    }

    ws.on("message", (data) => {
        try {
            const message = JSON.parse(data.toString());
            if (message.type === "connect") {
                const displayName = utils.generateUniqueDisplayName(message.username);
                console.log("Received connect message:", { ...message, displayName });
            } else if (CONFIG.debug && message.type !== "pieceUpdate") {
                // Don't spam logs with pieceUpdate messages
                console.log("Received message:", message.type, message.playerNumber || "");
            }

            switch (message.type) {
                case "connect":
                    handleConnect(ws, message);
                    break;

                case "joinRoom":
                    handleJoinRoom(ws, message);
                    break;

                case "leaveRoom":
                    handleLeaveRoom(ws, message);
                    break;

                case "changeUsername":
                    handleChangeUsername(ws, message);
                    break;

                case "ping":
                    // Auto-respond to pings
                    utils.sendToClient(ws, {
                        type: "pong",
                        sequence: message.sequence,
                        timestamp: message.timestamp
                    });
                    break;

                default:
                    // All other messages are game messages - relay to room
                    relayGameMessage(ws, message);
                    break;
            }
        } catch (error) {
            console.error("Error parsing message:", error);
        }
    });

    ws.on("close", () => {
        console.log("Player disconnected");
        handleDisconnect(ws);
    });

    ws.on("error", (error) => {
        console.error("WebSocket error:", error);
    });
});

/**
 * Handle player connection
 */
function handleConnect(ws, message) {
    const success = utils.registerClient(ws, message);

    if (!success) {
        // Client was rejected (duplicate username)
        return;
    }

    const client = utils.getClient(ws);
    console.log(`Player ${client.displayName} connected to lobby`);

    // Send dedicated success message for reliable detection
    utils.sendToClient(ws, {
        type: "connectSuccess"
    });

    // Send room list
    utils.sendToClient(ws, {
        type: "roomList",
        rooms: utils.getRoomListWithCounts(maxPlayersPerRoom)
    });

    // Broadcast updated room list to all clients
    utils.broadcastToAll({
        type: "roomList",
        rooms: utils.getRoomListWithCounts(maxPlayersPerRoom)
    });
}

/**
 * Handle room join request
 */
function handleJoinRoom(ws, message) {
    const client = utils.getClient(ws);
    if (!client) {
        console.warn("Join request from unregistered client");
        return;
    }

    const roomName = message.roomName;

    // Validate room name
    if (!roomName || roomName.trim() === "") {
        utils.sendToClient(ws, {
            type: "error",
            text: "Invalid room name. Room name cannot be empty."
        });
        return;
    }

    // Check if room is full (if limit is set)
    if (maxPlayersPerRoom !== -1 && utils.roomExists(roomName)) {
        const roomClients = utils.getClientsInRoom(roomName);
        if (roomClients.length >= maxPlayersPerRoom) {
            utils.sendToClient(ws, {
                type: "error",
                text: "Room is full."
            });
            return;
        }
    }

    // Add client to room
    const wasNewRoom = !utils.roomExists(roomName);
    utils.addToRoom(ws, roomName);

    // Initialize game state for the room if it's new
    if (wasNewRoom) {
        initializeGameRoom(roomName);
        console.log(`Created new game room: ${roomName}`);

        // Broadcast updated room list to all clients
        utils.broadcastToAll({
            type: "roomList",
            rooms: utils.getRoomListWithCounts(maxPlayersPerRoom)
        });
    }

    console.log(`Player ${client.displayName} joined room: ${roomName}`);

    // Broadcast join message to the room
    const joinMessage = wasNewRoom
        ? `${client.displayName} created and joined room "${roomName}"`
        : `${client.displayName} joined room "${roomName}"`;
    utils.broadcastToRoom(roomName, {
        type: "system",
        text: joinMessage,
        roomName: roomName,
        timestamp: Date.now()
    });

    // Broadcast updated room list to all clients (for real-time player count updates)
    utils.broadcastToAll({
        type: "roomList",
        rooms: utils.getRoomListWithCounts(maxPlayersPerRoom)
    });

    // Send dedicated success message for reliable detection
    utils.sendToClient(ws, {
        type: "joinSuccess",
        roomName: roomName
    });

    // Send user list for this room
    utils.sendToClient(ws, {
        type: "userList",
        users: utils.getClientsInRoom(roomName),
        roomName: roomName
    });

    // Broadcast updated user list to room
    utils.broadcastToRoom(roomName, {
        type: "userList",
        users: utils.getClientsInRoom(roomName),
        roomName: roomName
    });
}

/**
 * Handle leave room request
 */
function handleLeaveRoom(ws, message) {
    const client = utils.getClient(ws);
    if (!client) return;

    // Check if this player is the host BEFORE removing them
    const wasHost = utils.isHost(ws);

    const oldRoom = utils.removeFromRoom(ws, true); // true = return to lobby

    if (oldRoom) {
        console.log(`Player ${client.displayName} left room: ${oldRoom}`);

        // Notify user
        utils.sendToClient(ws, {
            type: "system",
            text: `Left Tetris battle "${oldRoom}". You are now in the lobby.`
        });

        // Send updated room list
        utils.sendToClient(ws, {
            type: "roomList",
            rooms: utils.getRoomListWithCounts(maxPlayersPerRoom)
        });

        // If host left, close the room entirely
        if (wasHost && utils.roomExists(oldRoom)) {
            console.log(`Host left room ${oldRoom} - closing room and removing all players`);
            
            // Notify remaining players that host left
            utils.broadcastToRoom(oldRoom, {
                type: "hostLeft",
                id: client.id,
                displayName: client.displayName,
                roomName: oldRoom,
                timestamp: Date.now()
            });
            
            // Get all clients still in the room
            const remainingClients = Array.from(utils.rooms.get(oldRoom) || []);
            
            // Remove all clients from the room and put them back in lobby
            remainingClients.forEach(clientWs => {
                utils.removeFromRoom(clientWs, true); // true = return to lobby
                
                // Notify each client they were removed
                utils.sendToClient(clientWs, {
                    type: "system",
                    text: `Room "${oldRoom}" closed because host left.`
                });
                
                // Send updated room list
                utils.sendToClient(clientWs, {
                    type: "roomList",
                    rooms: utils.getRoomListWithCounts(maxPlayersPerRoom)
                });
            });
            
            // Delete the room
            gameRooms.delete(oldRoom);
            
            // Broadcast updated room list to everyone
            utils.broadcastToAll({
                type: "roomList",
                rooms: utils.getRoomListWithCounts(maxPlayersPerRoom)
            });
        } else if (!utils.roomExists(oldRoom)) {
            // Room became empty naturally
            console.log(`Deleted empty room: ${oldRoom}`);
            gameRooms.delete(oldRoom);

            // Broadcast updated room list
            utils.broadcastToAll({
                type: "roomList",
                rooms: utils.getRoomListWithCounts(maxPlayersPerRoom)
            });
        } else {
            // Non-host left, room continues
            // Broadcast user left to remaining clients in room
            utils.broadcastToRoom(oldRoom, {
                type: "userLeft",
                id: client.id,
                displayName: client.displayName,
                roomName: oldRoom,
                timestamp: Date.now()
            });

            // Send updated user list to room
            utils.broadcastToRoom(oldRoom, {
                type: "userList",
                users: utils.getClientsInRoom(oldRoom),
                roomName: oldRoom
            });

            // Broadcast updated room list to all clients (for real-time player count updates)
            utils.broadcastToAll({
                type: "roomList",
                rooms: utils.getRoomListWithCounts(maxPlayersPerRoom)
            });
        }
    }
}

/**
 * Handle player disconnect
 */
function handleDisconnect(ws) {
    // Check if this player was the host BEFORE disconnecting
    const wasHost = utils.isHost(ws);
    const client = utils.getClient(ws);
    const roomName = client ? client.roomName : null;

    const clientInfo = utils.handleDisconnect(ws);

    if (clientInfo) {
        const { id, displayName } = clientInfo;
        const disconnectRoomName = clientInfo.roomName;

        if (disconnectRoomName) {
            console.log(`Player ${displayName} disconnected from room: ${disconnectRoomName}`);

            // If host disconnected, close the room entirely
            if (wasHost && utils.roomExists(disconnectRoomName)) {
                console.log(`Host disconnected from room ${disconnectRoomName} - closing room and removing all players`);
                
                // Notify remaining players that host left
                utils.broadcastToRoom(disconnectRoomName, {
                    type: "hostLeft",
                    id: id,
                    displayName: displayName,
                    roomName: disconnectRoomName,
                    timestamp: Date.now()
                });
                
                // Get all clients still in the room
                const remainingClients = Array.from(utils.rooms.get(disconnectRoomName) || []);
                
                // Remove all clients from the room and put them back in lobby
                remainingClients.forEach(clientWs => {
                    utils.removeFromRoom(clientWs, true); // true = return to lobby
                    
                    // Notify each client they were removed
                    utils.sendToClient(clientWs, {
                        type: "system",
                        text: `Room "${disconnectRoomName}" closed because host disconnected.`
                    });
                    
                    // Send updated room list
                    utils.sendToClient(clientWs, {
                        type: "roomList",
                        rooms: utils.getRoomListWithCounts(maxPlayersPerRoom)
                    });
                });
                
                // Delete the room
                gameRooms.delete(disconnectRoomName);
                
                // Broadcast updated room list to everyone
                utils.broadcastToAll({
                    type: "roomList",
                    rooms: utils.getRoomListWithCounts(maxPlayersPerRoom)
                });
            } else if (!utils.roomExists(disconnectRoomName)) {
                // Room became empty naturally
                console.log(`Deleted empty room: ${disconnectRoomName}`);
                gameRooms.delete(disconnectRoomName);

                // Broadcast updated room list
                utils.broadcastToAll({
                    type: "roomList",
                    rooms: utils.getRoomListWithCounts(maxPlayersPerRoom)
                });
            } else {
                // Non-host disconnected, room continues
                // Broadcast user left to room
                utils.broadcastToRoom(disconnectRoomName, {
                    type: "userLeft",
                    id: id,
                    displayName: displayName,
                    roomName: disconnectRoomName,
                    timestamp: Date.now()
                });

                // Send updated user list
                utils.broadcastToRoom(disconnectRoomName, {
                    type: "userList",
                    users: utils.getClientsInRoom(disconnectRoomName),
                    roomName: disconnectRoomName
                });
            }
        } else {
            console.log(`Player ${displayName} disconnected from lobby`);
        }
    }
}

/**
 * Handle username change request
 */
function handleChangeUsername(ws, message) {
    const client = utils.getClient(ws);
    if (!client) {
        console.log("Username change from unknown client");
        return;
    }

    const newUsername = message.username;

    // Validate new username
    if (!newUsername || newUsername.trim() === "" || newUsername.length < 2) {
        utils.sendToClient(ws, {
            type: "error",
            text: "Username must be at least 2 characters long"
        });
        return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(newUsername)) {
        utils.sendToClient(ws, {
            type: "error",
            text: "Username can only contain letters, numbers, underscores, and hyphens"
        });
        return;
    }

    // Check if new username is already taken by another client
    const existingClient = Array.from(utils.clients.values()).find(
        (c) => c.username === newUsername && c.id !== client.id
    );
    if (existingClient) {
        utils.sendToClient(ws, {
            type: "error",
            text: "Username is already taken"
        });
        return;
    }

    console.log(`Player ${client.displayName} changing username from ${client.username} to ${newUsername}`);

    // Update client info
    const oldUsername = client.username;
    const oldDisplayName = client.displayName;

    // Generate display name for the new username (exclude self from check)
    const newDisplayName = utils.generateUniqueDisplayName(newUsername, client.id);
    client.username = newUsername;
    client.displayName = newDisplayName;

    console.log(`Player ${oldDisplayName} is now ${newDisplayName}`);

    // Send success confirmation
    utils.sendToClient(ws, {
        type: "usernameChangeSuccess",
        oldUsername: oldUsername,
        newUsername: newUsername,
        displayName: client.displayName
    });

    // Broadcast updated user list to current room
    if (client.roomName) {
        utils.broadcastToRoom(client.roomName, {
            type: "userList",
            users: utils.getClientsInRoom(client.roomName),
            roomName: client.roomName
        });

        // Broadcast username change notification
        utils.broadcastToRoom(client.roomName, {
            type: "system",
            text: `${oldDisplayName} changed their name to ${client.displayName}`,
            roomName: client.roomName,
            timestamp: Date.now()
        });
    }
}

/**
 * Relay game message to other players in the room
 * Server doesn't care about message content - just routes it
 */
function relayGameMessage(ws, message) {
    const client = utils.getClient(ws);
    if (!client || !client.roomName) {
        return;
    }

    // Simply broadcast the entire message to room, excluding sender
    utils.broadcastToRoom(client.roomName, message, ws);
}

/**
 * Initialize game state for a new room
 */
function initializeGameRoom(roomName) {
    gameRooms.set(roomName, {
        players: new Map(),
        startTime: Date.now(),
        gameStarted: false
    });

    console.log(`Initialized game state for room: ${roomName}`);
}

/**
 * Clean up game state for a room
 */
function cleanupGameRoom(roomName) {
    gameRooms.delete(roomName);
    console.log(`Cleaned up game state for room: ${roomName}`);
}

// Start the server
server.listen(port, () => {
    console.log(`Multiplayer Game server running on port ${port}`);
    console.log(`WebSocket endpoint: ws://localhost:${port}`);
    console.log("Press Ctrl+C to stop the server");
});

// Graceful shutdown
process.on("SIGINT", () => {
    console.log("\nShutting down Game server...");
    wss.clients.forEach((client) => {
        client.close();
    });
    server.close(() => {
        console.log("Game server stopped");
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
});
