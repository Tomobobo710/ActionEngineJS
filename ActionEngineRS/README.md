# ActionEngineRS

A Rust port of ActionEngineJS - a platform-independent game engine for 2D games.

## Features

- **Cross-platform**: Runs on desktop (Linux, Windows, macOS) and web (WebAssembly)
- **Backend-agnostic**: Core types and traits work without any backend
- **glow-backend**: Built-in OpenGL/WebGL renderer using winit + glow
- **Batched rendering**: Efficient draw call batching for high performance
- **Input handling**: Keyboard and mouse support

## Porting Progress

### Implemented

- [x] **Core Game Trait** - `update()`, `fixed_update()`, `draw()` lifecycle
- [x] **Game Loop** - Fixed timestep (60Hz) with variable timestep support
- [x] **2D Renderer** - Shapes, paths, transforms, images, gradients
- [x] **Basic Math** - `Pos2`, `Vec2`, `Rect`, `Color`
- [x] **Input (Keyboard/Mouse)** - Key states, mouse position, buttons
- [x] **Image Loading** - PNG, JPEG, WebP (feature-gated)
- [x] **Native Runner** - Winit + Glutin + Glow
- [x] **Web Runner** - WebAssembly + WebGL

### Not Yet Implemented

#### High Priority
- [x] **Text Rendering** - Font loading and text drawing (uses `fontdue`)
- [x] **Audio System** - WAV, MP3, OGG on all platforms (PulseAudio/cpal/WebAudio + pure Rust decoders)

#### Medium Priority (2D)
- [ ] **Sprite Batching** - Texture atlas support for efficient sprite rendering
- [ ] **Procedural Textures** - Runtime texture generation (noise, patterns)

#### Medium Priority (Foundations for 3D)
- [ ] **Vector3** - 3D vectors with object pooling
- [ ] **Matrix4** - 4×4 transformation matrices
- [ ] **Quaternion** - 3D rotations, slerp interpolation
- [ ] **Camera System** - View/projection matrices, frustum culling

#### Low Priority
- [ ] **Physics System** - Collision detection and response
- [ ] **Networking** - WebSocket client, P2P via WebRTC
- [ ] **Character System** - State machine, physics integration
- [x] **Debug Overlay** - FPS stats (min/median/max), debug builds only

#### Deferred (Not Ready in JS Version)
- [ ] **3D Rendering Pipeline** - Waiting for ActionEngineJS 3D stabilization
- [ ] **Lighting System** - Directional, point, spot lights with shadows
- [ ] **3D Model Loading** - GLB/GLTF support, skeletal animation
- [ ] **Water/Weather Effects** - Procedural water, particle systems

#### Out of Scope (No Test Hardware)
- [ ] **Gamepad Input** - Controller support
- [ ] **Touch Input** - Multi-touch, virtual controls

## Image Format Support

Image loading is optional and enabled via feature flags:

| Feature | Crate | Format | Notes |
|---------|-------|--------|-------|
| `png` | `png` | PNG | Pure Rust |
| `jpeg-decoder` | `jpeg-decoder` | JPEG | Pure Rust |
| `image-webp` | `image-webp` | WebP | Pure Rust |

## Image Performance Notes

**Important**: The current renderer creates a new GPU texture for each `draw_image()` call and destroys it immediately after. This is simple but inefficient for:

- Drawing the same image multiple times per frame
- Large images (especially on WebGL where `texImage2D` is slow)

### Recommendations for optimal performance:

1. **Use power-of-two dimensions** (e.g., 64x64, 128x128, 256x256) - GPUs handle these more efficiently
2. **Keep images small** - scale down large images before loading
3. **Minimize image draw calls** - the more images drawn per frame, the more GPU texture uploads
4. **Consider texture atlases** for games with many small sprites (not yet implemented)

Future versions may add texture caching to improve image rendering performance.

## Quick Start

```rust
use action_engine::{Game, Renderer, Color};

struct MyGame;

impl Game for MyGame {
    const WIDTH: u32 = 800;
    const HEIGHT: u32 = 600;

    fn new() -> Self { MyGame }

    fn draw(&mut self, r: &mut dyn Renderer) {
        r.clear(Color::BLACK);
    }
}

fn main() {
    action_engine::run::<MyGame>("My Game");
}
```

## Building

```bash
# Desktop
cargo run -p your_game

# Web (requires trunk: cargo install trunk)
cd examples/your_game
trunk serve
```

## Examples

- `input_demo` - Keyboard and mouse input showcase
- `primitives_demo` - Rendering primitives (shapes, images, gradients, transforms)
- `bullet_hell` - Classic shoot 'em up game (demonstrates gameplay, collision, audio)
