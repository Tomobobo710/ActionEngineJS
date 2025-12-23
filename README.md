# Action Engine JS

A comprehensive JavaScript game framework that abstracts away the complexity of game development boilerplate, letting you focus on building your game.

## Overview

Action Engine simplifies game creation by handling all the tedious infrastructure—input systems, audio, rendering, physics, and multi-layer canvas management—so you can focus on game logic.

### Core Features

- **Multi-Layer Canvas System**: Separate game, UI, and debug rendering layers
- **Built-in Input System**: Keyboard, mouse, and touch input handling
- **Advanced Audio Engine**: MIDI instruments, FM synthesis, noise generation, reverb, echo, and more
- **3D Physics & Rendering**: WebGL-based 3D rendering with rigid body physics
- **Math Utilities**: Vector2, Vector3, and Matrix4 classes
- **Procedural Geometry**: GeometryBuilder for creating complex 3D objects with automatic triangle winding
- **Character System**: Ready-to-use character controller with animation states
- **P2P Networking**: Peer-to-peer multiplayer support with signaling

## Quick Start

### Installation

**Option 1: CDN (instant, no build step)**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Game</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: #0a0a2a;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div id="appContainer">
    <div id="UIControlsContainer"></div>
  </div>
  
  <script src="https://unpkg.com/action-engine-js@latest/dist/action-engine.min.js"></script>
  <script src="game.js"></script>
</body>
</html>
```

**Option 2: npm (for bundlers)**
```bash
npm install action-engine-js
```

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Game</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: #0a0a2a;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div id="appContainer">
    <div id="UIControlsContainer"></div>
  </div>
  
  <script src="node_modules/action-engine-js/dist/action-engine.min.js"></script>
  <script src="game.js"></script>
</body>
</html>
```

### Create a Game Class

```javascript
class Game {
  static get WIDTH() { return 800; }
  static get HEIGHT() { return 600; }

  constructor(canvases, input, audio) {
    this.gameCanvas = canvases.gameCanvas;
    this.guiCtx = canvases.guiCtx;
    this.debugCtx = canvases.debugCtx;
    this.input = input;
    this.audio = audio;
  }

  action_update(deltaTime) {
    // Update game logic
  }

  action_draw() {
    // Render your game
  }
}
```

### Canvas Layers

Action Engine provides three canvas layers:

| Layer | Type | Purpose |
|-------|------|---------|
| **gameCanvas** | 2D or WebGL | Main game world (3D physics demo uses WebGL) |
| **guiCanvas** | 2D | UI overlays (menus, HUD, buttons) |
| **debugCanvas** | 2D | Debug visualization (toggle with F9) |

All canvases use a fixed 800×600 coordinate system with automatic scaling.

## Core Systems

### Input System

```javascript
// Keyboard
this.input.isKeyPressed("DirUp")      // Arrow keys
this.input.isKeyPressed("Action1")    // Space bar
this.input.isKeyPressed("F9")         // Toggle debug

// Mouse
this.input.getMouseX()
this.input.getMouseY()

// Element detection
this.input.isElementHovered("debugButton", "debug")
```

### Audio System

#### MIDI Instruments

```javascript
this.audio.createMIDISound("kick", {
  instrument: "acoustic_bass_drum",
  note: 36,
  duration: 0.5,
  velocity: 100
});
```

#### FM Synthesis

```javascript
this.audio.createFMSound("synthPad", {
  carrierFreq: 440,
  modulatorFreq: 220,
  modulationIndex: 50,
  duration: 1.0,
  envelope: { attack: 0.2, decay: 0.3, sustain: 0.6, release: 0.5 }
});
```

#### Noise & Effects

```javascript
this.audio.createNoiseSound("wind", {
  noiseType: "pink",
  duration: 2.0,
  filterOptions: { frequency: 800, type: "lowpass" }
});
```

### 3D Physics & Rendering

#### Setting Up

```javascript
this.renderer3D = new ActionRenderer3D(this.gameCanvas);
this.physicsWorld = new ActionPhysicsWorld3D();
this.camera = new ActionCamera();
```

#### Creating Physics Objects

```javascript
// Box
const box = this.createBox(5, 5, 5, 1, new Vector3(0, 15, 0), "#FF6B6B");

// Sphere
const sphere = this.createSphere(3, 1, new Vector3(8, 20, 0));

// Capsule (height must be > 2 × radius)
const capsule = this.createCapsule(1.5, 8, 1, new Vector3(-8, 18, 0));

// Cone
const cone = this.createCone(2, 10, 1, new Vector3(0, 15, 0));
```

**Colors**: Pass hex strings like `"#FF6B6B"` or `null` for defaults (box: green, sphere: white, capsule: red, cone: orange).

### Procedural Geometry with GeometryBuilder

GeometryBuilder automatically handles triangle winding orientation, making complex 3D objects easy to create:

```javascript
const builder = new GeometryBuilder();
const vertices = [];
const normals = [];
const colors = [];
const indices = [];

// Set reference point at geometry center for automatic winding
builder.setReferencePoint({ x: 0, y: 1, z: 0 });

// Add vertices
vertices.push(0, 0, 0, 1, 1, 1, -1, 1, 0); // x,y,z for each vertex

// Create triangles
builder.createTriangle(indices, vertices, 0, 1, 2);
builder.createQuad(indices, vertices, 0, 1, 3, 2);

// Convert to physics object
const mesh = builder.createPhysicsObject(
  this.physicsWorld, 
  vertices, 
  normals, 
  colors, 
  indices, 
  mass, 
  position
);
```

**Key Point**: Set `setReferencePoint()` to the actual center of your geometry for correct automatic winding.

### Character System

Spawn a playable character with built-in state management:

```javascript
const player = this.spawnCharacter(new Vector3(0, 10, 0));
```

Character has predefined states (idle, walking, jumping, falling) and handles input automatically. Access debug info:

```javascript
console.log(player.debugInfo.state.current);      // Current state
console.log(player.debugInfo.physics.position);   // Position vector
console.log(player.debugInfo.physics.velocity);   // Velocity vector
```

### Math Classes

```javascript
// Vector2
const v = Vector2.create(10, 20);
const normalized = Vector2.normalize(v);
const distance = Vector2.distance(v1, v2);

// Vector3
const pos = new Vector3(1, 2, 3);
const dir = Vector3.normalize(pos);

// Matrix4
const transform = new Matrix4();
transform.translate(x, y, z);
transform.rotateX(angle);
```

## Directory Structure

```
ActionEngineJS/
├── actionengine/           # Core engine code
│   ├── 3rdparty/          # Third-party libraries
│   ├── camera/            # Camera system
│   ├── character/         # Character controller & animations
│   ├── core/              # Main application loop
│   ├── debug/             # Debug utilities
│   ├── display/           # Rendering systems (2D/3D)
│   ├── input/             # Input handler
│   ├── math/              # Vector, Matrix utilities
│   ├── network/           # Networking (client, server, P2P)
│   └── sound/             # Audio engine
├── demos/                 # Example games
│   ├── audio/            # Audio synthesis demo (Breakout game)
│   ├── input/            # Input handling demo (Asteroids game)
│   └── p2p/              # P2P networking example
├── docs/                 # Documentation
├── demo.js               # Main demo game
├── game.js               # Minimal game template
├── index.html            # Entry point
└── demo.html             # Demo entry point
```

## Networking

### P2P (Peer-to-Peer)

Connect games directly without a server:

```javascript
const peer = new ActionNetPeer(peerId, trackerUrl);
peer.connect(otherPeerId);
peer.on("data", (data) => {
  console.log("Received:", data);
});
peer.send(data);
```

### Server-Based

Host a central server for client connections:

```javascript
const server = new ActionNetServer(port);
server.on("client-connect", (client) => {
  client.send({ type: "welcome" });
});
```

## Common Patterns

### Drawing to GUI Layer

```javascript
action_draw() {
  // Draw game world
  this.renderer3D.render({
    renderableObjects: Array.from(this.physicsWorld.objects),
    camera: this.camera
  });

  // Draw UI on GUI layer
  this.guiCtx.fillStyle = "#fff";
  this.guiCtx.font = "20px Arial";
  this.guiCtx.fillText("Score: 100", 10, 30);
}
```

### Debug Overlay with F9

```javascript
if (this.showDebug) {
  this.drawDebugLayer();
}

// Toggle with F9 key (handled by input system)
```

### Handling Input

```javascript
action_update(deltaTime) {
  if (this.input.isKeyPressed("DirUp")) {
    // Move up
  }
  
  if (this.input.isKeyJustPressed("Action1")) {
    this.player.jump();
  }
}
```

### Playing Sounds

```javascript
this.audio.playSound("kick", {
  volume: 0.8,
  repeat: false,
  onComplete: () => {
    console.log("Sound finished");
  }
});
```

## Tips & Gotchas

1. **Fixed Canvas Size**: Always use `Game.WIDTH` and `Game.HEIGHT` (800×600) for positioning—scaling is automatic
2. **Capsule Height**: Ensure capsule `height > 2 × radius` or physics will error
3. **Reference Points in GeometryBuilder**: Set the reference point to your geometry's actual center for correct winding
4. **Color Handling**: Pass `null` to use shape defaults, or use hex strings like `"#FF6B6B"`
5. **Audio Envelopes**: Use subtle attack/release times (0.01s+) for smooth audio
6. **Debug Layer Performance**: Toggle debug mode sparingly in production; it adds overhead

## Files to Start With

- **game.js** - Minimal template for your own game
- **demo.js** - Full-featured demo showcasing all systems
- **actionengine/core/app.js** - Main application loop
- **actionengine/character/** - Character controller implementation
- **actionengine/display/** - 3D rendering and geometry builders

## What's Included

- ✅ Fully-featured game loop with fixed/regular updates
- ✅ Multi-layer canvas rendering
- ✅ Comprehensive input handling
- ✅ Advanced audio with synthesis and effects
- ✅ 3D physics and WebGL rendering
- ✅ Procedural geometry builder
- ✅ Character controller with states
- ✅ P2P and server networking
- ✅ Math utilities (vectors, matrices)
- ✅ Debug visualization tools

## Development

To build the minified bundle locally:

```bash
npm install
npm run build
```

This generates `dist/action-engine.min.js` from all source files in dependency order.

---

**Ready to build?** Start with the HTML template above, create your `game.js`, and you're good to go!
