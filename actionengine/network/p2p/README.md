# ActionNetP2P Library

A lightweight, zero-dependency WebRTC-based peer-to-peer networking library. Uses WebSocket trackers for peer discovery, built on BitTorrent infrastructure (infohash + tracker protocol).

<img width="3002" height="1757" alt="image" src="https://github.com/user-attachments/assets/886ed373-bb7a-482e-b74c-2d8759d6370e" />

## Architecture Overview

The library has three main layers:

1. **Tracker Layer** - Peer discovery via WebSocket tracker
2. **ActionNetPeer Layer** - WebRTC signaling connections between peers
3. **DataConnection Layer** - Application protocol through WebRTC data channels

## Library vs Application

**This library's responsibility:**
- Discover peers via tracker
- Establish WebRTC ActionNetPeer connections
- Emit `peer` event with connected ActionNetPeer instance
- Emit `connection` event with ready-to-use DataConnection instance

**Your application's responsibility:**
- Handle DataConnection connections
- Implement handshaking (validation/confirmation of peer identity)
- Send/receive application-specific messages
- Handle disconnects and reconnects

See `example.html` for a complete example of how to build on top of this library.

## Core Components

### ActionNetPeer (ActionNetPeer.js)

A WebRTC peer connection wrapper that provides a simple interface for creating and managing connections.

**Constructor:**
```javascript
const peer = new ActionNetPeer({
    initiator: true,                    // Whether this peer creates the offer
    trickle: false,                     // Wait for complete ICE before signaling (default: true)
    iceServers: [{ urls: 'stun:...' }]  // STUN/TURN servers
});
```

**Key Features:**
- Initiators create WebRTC offers automatically
- Responders handle incoming offers via `signal(data)`
- Waits for complete ICE gathering before emitting offers/answers (ensures complete SDP)
- Creates default data channel for signaling
- Full state tracking with connection state machine

**Events:**
- `signal` - Emit offer/answer with complete SDP (ready to send to remote peer)
- `connect` - WebRTC connection established
- `data` - Received data on data channel
- `close` - Connection closed
- `error` - Connection error

**Methods:**
- `signal(data)` - Handle remote offer/answer/ICE candidate
- `send(data)` - Send data on default data channel (returns boolean)
- `destroy()` - Clean up connection

### ActionNetTrackerClient (ActionNetTrackerClient.js)

Handles peer discovery through a WebSocket tracker server and manages ActionNetPeer lifecycle.

**Constructor:**
```javascript
const tracker = new ActionNetTrackerClient(
    ['wss://tracker.openwebtorrent.com/', 'wss://tracker.btorrent.xyz/'],  // URL or array of URLs
    infohash,                              // SHA-1 hash of application ID
    peerId,                                // Random peer identifier
    {
        numwant: 50,                       // Max peers to request
        announceInterval: 5000,            // Milliseconds between announces
        iceServers: [...]                  // Optional STUN/TURN servers
    }
);
```

**Flow:**
1. `tracker.connect()` opens WebSocket connection
2. Creates first ActionNetPeer and waits for ICE gathering to complete (ready state)
3. Emits `ready` event when first peer is prepared
4. Every 30 seconds: generates new WebRTC offers and announces them
5. Each offer has 50-second timeout to receive an answer
6. Tracker relays other peers' offers back via `peer-offer` event
7. When answers arrive, signals them to stored peers
8. Emits `peer` event when WebRTC connection succeeds
9. Tracks connected peer IDs to avoid duplicate connections

**Events:**
- `ready` - First peer ready, starts announcing with offers
- `peer` - Successfully connected to peer: `{ id: peerId, peer: ActionNetPeer instance, source: 'tracker' }`
- `connection` - DataConnection (application protocol layer) ready: DataConnection instance with `localPeerId` and `remotePeerId` exposed
- `peer-disconnected` - ActionNetPeer connection closed: `{ id: peerId }`
- `peer-failed` - ActionNetPeer connection failed: `{ id: peerId, error: Error }`
- `update` - Tracker sent stats: `{ complete: seeders, incomplete: leechers }`
- `error` - Connection or protocol error
- `close` - Disconnected from all trackers

**Methods:**
- `connect()` - Connect to tracker and start announcing
- `disconnect()` - Stop announcing and close connection
- `sendAnswer(offerId, peerId, answer)` - Send answer back to tracker for responder flow
- `on(event, handler)` - Register event listener

**Peer Lifecycle:**
- Library manages all ActionNetPeer creation, connection, and cleanup
- When ActionNetPeer connects: marked as connected, emits `peer` event
- When ActionNetPeer disconnects: removed from tracking, emits `peer-disconnected`
- When ActionNetPeer errors: removed from tracking, emits `peer-failed`
- Developer should listen for these events and clean up their DataConnection instances

### DataConnection (DataConnection.js)

Application protocol layer that creates a second WebRTC connection for application data.

**Purpose:**
Uses a connected ActionNetPeer instance as a signaling channel to establish a second WebRTC peer connection. This provides clean separation between peer discovery (ActionNetPeer) and application communication (DataConnection).

**Constructor:**
```javascript
const connection = new DataConnection(signalingPeer, {
    localPeerId: 'peer_xyz',   // This peer's ID
    remotePeerId: 'peer_abc'   // Connected peer's ID
});
```

**Negotiation Flow:**
1. Waits for signaling ActionNetPeer's data channel to actually be open (ready state)
2. ActionNetPeer with lexicographically higher ID acts as initiator (avoids race conditions)
3. If initiator: creates data channel, generates WebRTC offer, sends via signaling peer
4. If responder: receives offer, generates answer, sends via signaling peer
5. Both sides send ICE candidates through signaling peer
6. When application data channel opens, emits `connect` event

**Signal Messages (sent through signaling peer's data channel):**
- `{ type: 'channel-offer', sdp: '...' }` - WebRTC offer
- `{ type: 'channel-answer', sdp: '...' }` - WebRTC answer
- `{ type: 'channel-ice-candidate', candidate: {...} }` - ICE candidate

**Application Messages (sent through DataConnection's data channel):**

DataConnection automatically serializes/deserializes JSON. Send objects, receive parsed objects:

```javascript
// Send (automatically JSON.stringify'd)
connection.send({
    type: 'greeting',
    message: 'Hello from peer',
    timestamp: Date.now()
});

// Receive (automatically JSON.parse'd)
connection.on('data', (message) => {
    console.log(message.type);  // 'greeting'
    console.log(message.message);  // 'Hello from peer'
});
```

**Handshake Pattern (Recommended):**

Peers should exchange handshakes immediately upon connection to validate compatibility and ensure you're only communicating with peers running compatible versions of your application. Peers that fail validation should be rejected:

```javascript
connection.on('connect', () => {
    // Send handshake for confirmation
    connection.send({
        type: 'handshake',
        peerId: localPeerId,
        version: '1.0',
        metadata: { /* your app-specific data */ }
    });
});

connection.on('data', (message) => {
    if (message.type === 'handshake') {
        // Validate: is peer compatible with our application?
        if (message.version !== '1.0') {
            // Reject this peer, close connection
            connection.close();
            return;
        }
        // Confirm: peer is valid, proceed with communication
        registerConfirmedPeer(message.peerId, message.metadata);
    } else {
        // Handle other application messages
    }
});
```

**Events:**
- `connect` - Application data channel established
- `data` - Received message on application data channel (already parsed JSON)
- `close` - Data channel closed
- `error` - Connection error

**Methods:**
- `send(message)` - Send JSON object through application data channel (auto-stringified, returns boolean)
- `close()` - Clean up and close connection
- `on(event, handler)` - Register event listener

## Message Protocol

### Tracker Announce (JSON via WebSocket)

**Client announces to tracker:**
```javascript
{
    action: "announce",
    info_hash: "sha1_of_application_id",
    peer_id: "peer_xyz",
    port: 6881,
    numwant: 50,
    offers: [
        {
            offer_id: "random_20_byte_hex",
            offer: { type: "offer", sdp: "..." }
        }
    ]
}
```

**Tracker responds with stats:**
```javascript
{
    action: "announce",
    interval: 120,
    complete: 0,
    incomplete: 2
}
```

**Tracker relays peer offer:**
```javascript
{
    action: "announce",
    offer_id: "...",
    peer_id: "peer_abc",
    offer: { type: "offer", sdp: "..." }
}
```

**Tracker relays peer answer:**
```javascript
{
    action: "announce",
    offer_id: "...",
    peer_id: "peer_abc",
    answer: { type: "answer", sdp: "..." }
}
```

## Usage Example

```javascript
// Create tracker client with multiple trackers for redundancy
const tracker = new ActionNetTrackerClient(
    ['wss://tracker.openwebtorrent.com/', 'wss://tracker.btorrent.xyz/'],
    infohash,
    peerId,
    { numwant: 50 }
);

// Tracker is ready (first peer prepared, will start announcing)
tracker.on('ready', () => {
    console.log('Tracker ready, discovering peers...');
});

// DataConnection created and ready (TrackerClient creates it automatically)
tracker.on('connection', (connection) => {
    const peerId = connection.remotePeerId;
    
    connection.on('connect', () => {
        // Send handshake to confirm peer
        connection.send({ 
            type: 'handshake', 
            peerId: myPeerId, 
            version: '1.0'
        });
    });
    
    connection.on('data', (message) => {
        console.log('Received from', peerId, ':', message);
        if (message.type === 'handshake') {
            // Validate and confirm peer
        } else {
            // Handle application messages
        }
    });
    
    connection.on('close', () => {
        console.log('DataConnection closed with peer:', peerId);
    });
    
    connection.on('error', (err) => {
        console.error('DataConnection error with peer:', peerId, err);
    });
});

// Peer disconnected or failed
tracker.on('peer-disconnected', (data) => {
    console.log('Peer disconnected:', data.id);
    // Clean up any DataConnection associated with this peer
});

tracker.on('peer-failed', (data) => {
    console.log('Peer connection failed:', data.id, data.error.message);
    // Clean up any DataConnection associated with this peer
});

// Connect to tracker (TrackerClient handles all peer offer/answer negotiation internally)
await tracker.connect();
```

## Connection Lifecycle

```
Initiator (Tab A)                    Tracker                    Responder (Tab B)
     |                                  |                             |
     | 1. Connect to tracker            |                             |
     |--announce (with offers)--------> |                             |
     |                                  |--announce-----------------> |
     |                                  | 2. Relay offer to peers     |
     |                                  | 3. Create responder Peer    |
     |                                  | 4. Handle offer             |
     |                                  | 5. Generate answer          |
     |                                  |  <------------------answer--|
     | 6. Receive answer                |                             |
     | 7. Signal answer to Peer         |                             |
     |                                  |                             |
     |===== Peer WebRTC Connected ======|                             |
     |                                  |                             |
     | 8. Create DataConnection         |                             |
     | <---------------- DataConnection negotiation ----------------> |
     |                                  |                             |
     |====== DataConnection Ready ======|                             |
     |                                  |                             |
     | 9. Send application message      |                             |
     |--application-data-message------> |                             |
     |                                  | 10. Receive message         |
```

## Connection Model

The library uses a **two-phase connection** to separate peer discovery from application communication:

1. **Discovery Phase (ActionNetPeer)**: 
   - TrackerClient announces offers to tracker
   - Tracker relays offers to other peers
   - Peers exchange answer through tracker
   - Result: One RTCPeerConnection per peer (used for signaling only)

2. **Application Phase (DataConnection)**:
   - DataConnection creates a second RTCPeerConnection on top of the first
   - Offer/answer negotiated through the signaling ActionNetPeer's data channel
   - Result: Isolated application data channel completely separate from signaling
   - No need to layer additional protocols—DataConnection handles everything

**Why two phases?** It provides clean separation: signaling is automatic and transparent, application data is isolated and can be replaced/upgraded independently.

## Key Design Decisions

**Two-Phase Connection:**
- Phase 1 (ActionNetPeer): WebRTC signaling for peer discovery, handled by tracker
- Phase 2 (DataConnection): WebRTC data channel for application messages, negotiated through signaling peer

**Deterministic Peer Selection:**
- DataConnection initiator always selected based on peer ID comparison (lexicographically highest initiates)
- Guarantees both sides agree on who initiates, preventing simultaneous offers

**Complete ICE Gathering:**
- ActionNetPeer waits for ICE gathering to complete before emitting offer/answer
- Ensures SDP includes all ICE candidates
- Prevents trickle ICE complexity at tracker level

**Message Ordering:**
- Both ActionNetPeer and DataConnection data channels created with `ordered: true`
- Guarantees in-order message delivery

**Zero Dependencies:**
- Custom ActionNetPeer implementation using native WebRTC APIs
- No external libraries required
- Works in any modern browser

## Configuration

**TrackerClient Options:**
- `port` - Local port number (default: 6881)
- `numwant` - Maximum peers to request from tracker (default: 50)
- `announceInterval` - Time between periodic announces in milliseconds (default: 30000)
- `iceServers` - Array of STUN/TURN server configurations

**ActionNetPeer Options:**
- `initiator` - Whether this peer creates the offer (default: false)
- `trickle` - Use trickle ICE (default: true)
- `iceServers` - Array of STUN/TURN server configurations

**ActionNetTrackerClient:**
- `debug` - Enable logging for debugging (default: false)
- `numwant` - Maximum peers to request from tracker (default: 50)
- `announceInterval` - Initial time between announces in milliseconds (default: 5000)
- `maxAnnounceInterval` - Maximum interval cap in milliseconds (default: 120000)
- `backoffMultiplier` - Multiply interval by this after each announce (default: 1.1)
- `iceServers` - Array of STUN/TURN server configurations

**Announce Backoff Strategy:**

After each announce, the interval is multiplied by `backoffMultiplier` until reaching `maxAnnounceInterval`. With default settings (`announceInterval: 5000`, `backoffMultiplier: 1.1`, `maxAnnounceInterval: 120000`):

- 5s → 5.5s → 6s → 6.6s → 7.3s → 8s → 8.8s → 9.7s → 10.7s → 11.7s → 12.9s → 14.2s → 15.6s → 17.2s → 18.9s → 20.8s → 22.9s → 25.2s → 27.7s → 30.5s ... → 120s (capped after ~36 announces)

Higher multipliers (e.g., 1.5) reach the cap faster: 5s → 7.5s → 11s → 17s → 26s → 39s → 59s → 88s → 120s (capped).

**DataConnection:**
- No configuration; automatically uses STUN servers for ICE

**Infohash Generation:**

The infohash is derived from the application ID using a cryptographic hash. The example uses SHA-1, but SHA-256 or any consistent hash works. **Important:** All peers must use the same hash function to generate the same infohash for discovery.

```javascript
// SHA-1 (example.html approach)
const hashBuffer = await crypto.subtle.digest('SHA-1', applicationIdBytes);
```

## NAT Traversal: STUN and TURN

WebRTC uses ICE (Interactive Connectivity Establishment) to find the best network path between peers. This requires STUN and optionally TURN servers.

**STUN (Session Traversal Utilities for NAT):**
- Helps peers discover their public IP address
- Works for most NAT configurations (90%+ of cases)
- Free, no auth required
- Default: Multiple Google STUN servers for redundancy

**TURN (Traversal Using Relays around NAT):**
- Relays traffic when peers can't reach each other directly
- Needed for restrictive firewalls, double NAT, mobile networks
- Requires credentials and infrastructure (paid or self-hosted)
- Only use if STUN fails

**Default Configuration (STUN only):**
```javascript
iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
]
```

**Production Configuration (STUN + TURN):**
```javascript
iceServers: [
    // STUN servers (free)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    
    // TURN server (your infrastructure or paid service)
    { 
        urls: 'turn:your-turn-server.com',
        username: 'user',
        credential: 'password'
    }
]
```

**Passing Custom ICE Servers:**
```javascript
const tracker = new ActionNetTrackerClient(trackerUrls, infohash, peerId, {
    iceServers: [
        { urls: 'stun:your-stun.example.com:3478' },
        { urls: 'turn:your-turn.example.com:3478', username: 'user', credential: 'pass' }
    ]
});
```

## Testing

Open `example.html` in two browser tabs with the same application ID (or create a test app):

1. Both peers connect to tracker
2. First peer announces an offer
3. Second peer receives offer, creates responder Peer connection
4. First peer receives answer, completes WebRTC signaling connection
5. Both create DataConnection connections automatically for application data
6. Peers exchange handshakes to confirm each other
7. Exchange application messages through DataConnection data channels

Watch the stats and confirmed peers list update as connections establish.

## Limitations

**Current Limitations:**
1. Requires public WebSocket tracker (no DHT fallback)
2. Peer connections not persisted across disconnects (rejoin requires new TrackerClient)
3. No connection pooling (single Peer per remote peer)
4. No message fragmentation for large payloads
