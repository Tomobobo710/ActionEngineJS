# ActionNet Multiplayer Game Server

A generic, game-agnostic WebSocket server for real-time multiplayer games built with ActionNetServerUtils.

## Features

- **Generic Message Relay**: Server doesn't interpret game messages - it just routes them between clients in the same room
- **Room/Lobby System**: Create or join named rooms for multiplayer sessions
- **Host Management**: First player to join a room becomes the host; room closes if host leaves
- **Automatic Display Names**: Handles username collisions with unique display names (e.g., "Player", "Player (1)", "Player (2)")
- **Configurable Room Size**: Set maximum players per room or allow unlimited players
- **Connection Management**: Handles connects, disconnects, room joins/leaves, username changes
- **Ping/Pong Support**: Built-in heartbeat system for connection health monitoring

## Quick Start

The start scripts automatically install dependencies if needed!

### Start the Server

**Windows:**
```bash
start.bat
```

**Mac/Linux:**
```bash
chmod +x start.sh
./start.sh
```

**Or manually:**
```bash
node ActionNetServer.js
```

**Custom port and max players:**
```bash
node ActionNetServer.js 8000 4
```

## Default Configuration

- **Port**: 8000
- **WebSocket URL**: `ws://localhost:8000`
- **Max Players per Room**: Unlimited (-1)
- **Debug Mode**: Enabled

Edit the `CONFIG` object in `ActionNetServer.js` to change defaults:

```javascript
const CONFIG = {
    port: 8000,              // Server port
    debug: true,             // Enable debug logging
    maxPlayersPerRoom: -1    // -1 = unlimited, or set a number like 2, 4, 8, etc.
};
```

## How It Works

### Connection Flow

1. **Client connects** → Added to lobby
2. **Client sends `connect` message** → Server registers client with unique display name
3. **Client sends `joinRoom` message** → Client moves from lobby to room
   - First client to join becomes the **host**
   - Room is created automatically if it doesn't exist
4. **Client sends game messages** → Server relays to all other clients in the same room
5. **Client disconnects or leaves** → If they were the host, room closes and all players return to lobby

### Host System

- **First person to join a room becomes the host**
- Host status is tracked in client info (`isHost: true`)
- **When host leaves/disconnects**: Room is closed and all remaining players are returned to lobby
- Non-host players leaving doesn't affect the room

### Display Name Generation

- Clients provide a `username` when connecting
- If multiple clients use the same username, server generates unique **display names**:
  - First: `"Player"`
  - Second: `"Player (1)"`
  - Third: `"Player (2)"`
  - etc.
- Display names are what clients should show in UI
- Each client still has a unique `clientId` for internal tracking

## Message Types

The server handles these **system messages**:

### Client → Server

- `connect` - Register with server (provides username, clientId)
- `joinRoom` - Join or create a room (provides roomName)
- `leaveRoom` - Leave current room and return to lobby
- `changeUsername` - Change your username (generates new display name if needed)
- `ping` - Heartbeat (server auto-responds with `pong`)

### Server → Client

- `connectSuccess` - Connection confirmed
- `joinSuccess` - Room join confirmed
- `roomList` - List of available rooms
- `userList` - List of users in your current room
- `userJoined` - Someone joined your room
- `userLeft` - Someone left your room
- `hostLeft` - Host left, room is closing
- `system` - System notification message
- `error` - Error message (e.g., "Room is full")
- `pong` - Response to ping (includes sequence and timestamp)

### Game Messages

**All other message types are game-specific and relayed without interpretation.**

The server doesn't care about message content - it just broadcasts them to other clients in the same room.

Examples:
- `playerMove` - Your game's player movement
- `scoreUpdate` - Your game's scoring
- `gameStart` - Your game's start signal
- `chat` - Your game's chat system
- Anything else your game needs!

## Usage Example

### Your Game Client (JavaScript)

```javascript
const net = new ActionNetManager({
    url: 'ws://localhost:8000',
    autoConnect: false
});

// Connect with a username
await net.connectToServer({ username: 'Alice' });

// Join a room
await net.joinRoom('game-room-1');

// Send custom game messages
net.send({
    type: 'playerMove',
    x: 100,
    y: 200
});

// Receive game messages from other players
net.on('playerMove', (msg) => {
    otherPlayer.position.set(msg.x, msg.y);
});
```

### The server automatically handles:
- Creating rooms on first join
- Assigning host to first joiner
- Relaying your `playerMove` message to other players in the room
- Cleaning up empty rooms
- Returning players to lobby when host leaves

## Testing with Multiple Clients

1. Start the server
2. Open multiple browser windows/tabs
3. Have each client connect and join the same room
4. Send messages from one client, see them arrive at others
5. Experiment with host leaving to see room closure behavior

## Architecture

### ActionNetServerUtils

The server uses `ActionNetServerUtils` for all the heavy lifting:

- **Client Tracking**: Maps WebSocket connections to client info
- **Room Management**: Tracks which clients are in which rooms
- **Lobby Management**: Tracks clients not in any room
- **Host Tracking**: Tracks which client is host of each room
- **Broadcasting**: Utilities for sending to specific clients, rooms, or everyone
- **Display Names**: Generates unique display names from usernames

### Message Flow

```
Client A              Server                Client B
   |                    |                      |
   |--playerMove------->|                      |
   |                    |----playerMove------->|
   |                    |                      |
   |<---playerMove------|<-----playerMove------|
   |                    |                      |
```

Server doesn't modify, validate, or interpret game messages - it's a pure relay.

## Logs

The server provides detailed logging:

```
Player Alice (1) connected to lobby
Player Alice (1) joined room: game-room-1
Created new game room: game-room-1
Player Bob connected to lobby
Player Bob joined room: game-room-1
Player Alice (1) left room: game-room-1
Host left room game-room-1 - closing room and removing all players
Deleted empty room: game-room-1
```

## Troubleshooting

### "EADDRINUSE" Error

Port 8000 is already in use. Either:
- Stop the other process using the port
- Start the server on a different port: `node ActionNetServer.js 8001`
- Update your game client URL to match: `url: 'ws://localhost:8001'`

### Clients Can't Connect

- Make sure the server is running
- Check that the client URL matches the server port
- Check firewall settings if playing over network
- Look for errors in server console

### Messages Don't Reach Other Clients

- Check server logs for errors
- Make sure both clients are in the same room
- Verify the client is calling `net.send()` correctly
- Check that the server is relaying (should see message type in logs if debug is on)

### Room Closes Unexpectedly

- The host probably left or disconnected
- Check server logs for "Host left room" messages
- Consider implementing host migration in your game if needed

## Production Deployment

For production use:

1. **Disable debug mode**: `CONFIG.debug = false`
2. **Use a process manager**: PM2, systemd, or similar to keep server running
3. **Set up SSL**: Use `wss://` instead of `ws://` for secure WebSocket
4. **Configure firewall**: Allow traffic on your chosen port
5. **Add rate limiting**: Protect against spam and DDoS
6. **Monitor logs**: Set up log rotation and monitoring
7. **Set resource limits**: Prevent memory leaks from affecting server

### Example with PM2

```bash
npm install -g pm2
pm2 start ActionNetServer.js --name "game-server"
pm2 logs game-server
pm2 stop game-server
```

## Extending the Server

The server is designed to be customized for your game's needs:

### Add Custom Message Validation

```javascript
function relayGameMessage(ws, message) {
    const client = utils.getClient(ws);
    if (!client || !client.roomName) return;
    
    // Add your validation here
    if (message.type === 'playerMove') {
        if (!message.x || !message.y) {
            utils.sendToClient(ws, {
                type: 'error',
                text: 'Invalid move data'
            });
            return;
        }
    }
    
    utils.broadcastToRoom(client.roomName, message, ws);
}
```

### Add Game State Management

```javascript
function initializeGameRoom(roomName) {
    gameRooms.set(roomName, {
        players: new Map(),
        startTime: Date.now(),
        gameStarted: false,
        customGameState: { /* your data */ }
    });
}
```

### Add Matchmaking

```javascript
function findAvailableRoom() {
    for (const [roomName, room] of gameRooms) {
        const size = utils.getRoomSize(roomName);
        if (size < maxPlayersPerRoom) {
            return roomName;
        }
    }
    return null; // Create new room
}
```
