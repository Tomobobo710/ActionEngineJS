//! ActionEngine - A platform-independent game engine inspired by ActionEngineJS
//!
//! This library provides backend-agnostic abstractions for game development.
//! Implement the `Game` trait and use a backend to run your game.
//!
//! # Features
//!
//! - `glow-backend`: Enables the built-in OpenGL backend using winit + glow.
//!   This provides the `run::<G>()` function for easy game startup.
//!
//! # Example
//!
//! ```ignore
//! use action_engine::{Game, Renderer, Color};
//!
//! struct MyGame;
//!
//! impl Game for MyGame {
//!     fn new() -> Self { MyGame }
//!     fn draw(&mut self, r: &mut dyn Renderer) {
//!         r.clear(Color::BLACK);
//!     }
//! }
//!
//! fn main() {
//!     action_engine::run::<MyGame>("My Game");
//! }
//! ```

mod input;

pub use input::*;

// Glow/OpenGL backend (optional)
#[cfg(feature = "glow-backend")]
mod backend;

#[cfg(feature = "glow-backend")]
pub use backend::{run, GlowRenderer, WinitInput};

/// A 2D position
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct Pos2 {
    pub x: f32,
    pub y: f32,
}

impl Pos2 {
    pub const ZERO: Self = Self { x: 0.0, y: 0.0 };

    pub const fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }
}

/// A 2D vector
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct Vec2 {
    pub x: f32,
    pub y: f32,
}

impl Vec2 {
    pub const ZERO: Self = Self { x: 0.0, y: 0.0 };

    pub const fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }
}

/// A rectangle defined by min and max corners
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct Rect {
    pub min: Pos2,
    pub max: Pos2,
}

impl Rect {
    pub const fn from_min_max(min: Pos2, max: Pos2) -> Self {
        Self { min, max }
    }

    pub fn from_min_size(min: Pos2, size: Vec2) -> Self {
        Self {
            min,
            max: Pos2::new(min.x + size.x, min.y + size.y),
        }
    }

    pub fn width(&self) -> f32 {
        self.max.x - self.min.x
    }

    pub fn height(&self) -> f32 {
        self.max.y - self.min.y
    }

    pub fn size(&self) -> Vec2 {
        Vec2::new(self.width(), self.height())
    }
}

/// An RGBA color
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

impl Color {
    pub const BLACK: Self = Self::rgb(0, 0, 0);
    pub const WHITE: Self = Self::rgb(255, 255, 255);
    pub const RED: Self = Self::rgb(255, 0, 0);
    pub const GREEN: Self = Self::rgb(0, 255, 0);
    pub const BLUE: Self = Self::rgb(0, 0, 255);
    pub const CYAN: Self = Self::rgb(0, 240, 240);

    pub const fn rgb(r: u8, g: u8, b: u8) -> Self {
        Self { r, g, b, a: 255 }
    }

    pub const fn rgba(r: u8, g: u8, b: u8, a: u8) -> Self {
        Self { r, g, b, a }
    }
}

/// Stroke style for outlines
#[derive(Debug, Clone, Copy)]
pub struct Stroke {
    pub width: f32,
    pub color: Color,
}

impl Stroke {
    pub const fn new(width: f32, color: Color) -> Self {
        Self { width, color }
    }
}

/// Abstract renderer trait - backends implement this
pub trait Renderer {
    /// Clear the canvas with a color
    fn clear(&mut self, color: Color);

    /// Draw a filled rectangle
    fn fill_rect(&mut self, rect: Rect, color: Color);

    /// Draw a rectangle outline
    fn stroke_rect(&mut self, rect: Rect, stroke: Stroke);

    /// Draw a filled circle
    fn fill_circle(&mut self, center: Pos2, radius: f32, color: Color);

    /// Draw a circle outline
    fn stroke_circle(&mut self, center: Pos2, radius: f32, stroke: Stroke);

    /// Draw a line between two points
    fn draw_line(&mut self, from: Pos2, to: Pos2, stroke: Stroke);

    // === Path API ===

    /// Begin a new path
    fn begin_path(&mut self);

    /// Move to a point (starts a new sub-path)
    fn move_to(&mut self, pos: Pos2);

    /// Add a line to the current path
    fn line_to(&mut self, pos: Pos2);

    /// Add an arc to the current path
    fn arc(&mut self, center: Pos2, radius: f32, start_angle: f32, end_angle: f32);

    /// Close the current path (connects back to start)
    fn close_path(&mut self);

    /// Fill the current path
    fn fill_path(&mut self, color: Color);

    /// Stroke the current path
    fn stroke_path(&mut self, stroke: Stroke);

    // === Transform API ===

    /// Save the current transform state
    fn save(&mut self);

    /// Restore the previous transform state
    fn restore(&mut self);

    /// Translate the coordinate system
    fn translate(&mut self, offset: Vec2);

    /// Rotate the coordinate system (radians)
    fn rotate(&mut self, angle: f32);

    /// Scale the coordinate system
    fn scale(&mut self, scale: Vec2);

    // === Image API ===

    /// Draw an image at the given position
    fn draw_image(&mut self, image: &Image, pos: Pos2);

    /// Draw an image scaled to fit a rectangle
    fn draw_image_rect(&mut self, image: &Image, rect: Rect);

    // === Gradient API ===

    /// Fill a rectangle with a linear gradient
    fn fill_rect_gradient(&mut self, rect: Rect, gradient: &LinearGradient);

    // === Text API ===

    /// Draw text at the given position
    fn draw_text(&mut self, text: &str, pos: Pos2, style: &TextStyle);

    /// Measure text dimensions without drawing
    fn measure_text(&self, text: &str, style: &TextStyle) -> Vec2;

    /// Get the canvas width in game coordinates
    fn width(&self) -> f32;

    /// Get the canvas height in game coordinates
    fn height(&self) -> f32;
}

/// An image that can be drawn
pub struct Image {
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) data: Vec<u8>, // RGBA pixels
}

impl Image {
    /// Create an image from RGBA pixel data
    pub fn from_rgba(width: u32, height: u32, data: Vec<u8>) -> Self {
        assert_eq!(data.len(), (width * height * 4) as usize);
        Self { width, height, data }
    }

    /// Get image width
    pub fn width(&self) -> u32 {
        self.width
    }

    /// Get image height
    pub fn height(&self) -> u32 {
        self.height
    }

    /// Load a PNG image from bytes (requires `png` feature)
    #[cfg(feature = "png")]
    pub fn from_png(data: &[u8]) -> Result<Self, String> {
        use std::io::Cursor;
        let decoder = png::Decoder::new(Cursor::new(data));
        let mut reader = decoder.read_info().map_err(|e| e.to_string())?;
        let mut buf = vec![0; reader.output_buffer_size().ok_or("Cannot determine PNG buffer size")?];
        let info = reader.next_frame(&mut buf).map_err(|e| e.to_string())?;

        // Convert to RGBA if needed
        let rgba = match info.color_type {
            png::ColorType::Rgba => buf[..info.buffer_size()].to_vec(),
            png::ColorType::Rgb => {
                let rgb = &buf[..info.buffer_size()];
                let mut rgba = Vec::with_capacity(info.width as usize * info.height as usize * 4);
                for chunk in rgb.chunks(3) {
                    rgba.extend_from_slice(chunk);
                    rgba.push(255);
                }
                rgba
            }
            png::ColorType::GrayscaleAlpha => {
                let ga = &buf[..info.buffer_size()];
                let mut rgba = Vec::with_capacity(info.width as usize * info.height as usize * 4);
                for chunk in ga.chunks(2) {
                    rgba.push(chunk[0]);
                    rgba.push(chunk[0]);
                    rgba.push(chunk[0]);
                    rgba.push(chunk[1]);
                }
                rgba
            }
            png::ColorType::Grayscale => {
                let g = &buf[..info.buffer_size()];
                let mut rgba = Vec::with_capacity(info.width as usize * info.height as usize * 4);
                for &v in g {
                    rgba.push(v);
                    rgba.push(v);
                    rgba.push(v);
                    rgba.push(255);
                }
                rgba
            }
            png::ColorType::Indexed => {
                return Err("Indexed PNG not supported".to_string());
            }
        };

        Ok(Self {
            width: info.width,
            height: info.height,
            data: rgba,
        })
    }

    /// Load a JPEG image from bytes (requires `jpeg-decoder` feature)
    #[cfg(feature = "jpeg-decoder")]
    pub fn from_jpeg(data: &[u8]) -> Result<Self, String> {
        let mut decoder = jpeg_decoder::Decoder::new(data);
        let pixels = decoder.decode().map_err(|e| e.to_string())?;
        let info = decoder.info().ok_or("Failed to get JPEG info")?;

        // Convert to RGBA
        let rgba = match info.pixel_format {
            jpeg_decoder::PixelFormat::RGB24 => {
                let mut rgba = Vec::with_capacity(info.width as usize * info.height as usize * 4);
                for chunk in pixels.chunks(3) {
                    rgba.extend_from_slice(chunk);
                    rgba.push(255);
                }
                rgba
            }
            jpeg_decoder::PixelFormat::L8 => {
                let mut rgba = Vec::with_capacity(info.width as usize * info.height as usize * 4);
                for &v in &pixels {
                    rgba.push(v);
                    rgba.push(v);
                    rgba.push(v);
                    rgba.push(255);
                }
                rgba
            }
            _ => return Err("Unsupported JPEG pixel format".to_string()),
        };

        Ok(Self {
            width: info.width as u32,
            height: info.height as u32,
            data: rgba,
        })
    }

    /// Load a WebP image from bytes (requires `image-webp` feature)
    #[cfg(feature = "image-webp")]
    pub fn from_webp(data: &[u8]) -> Result<Self, String> {
        use std::io::Cursor;
        let mut decoder = image_webp::WebPDecoder::new(Cursor::new(data)).map_err(|e| e.to_string())?;
        let (width, height) = decoder.dimensions();
        let has_alpha = decoder.has_alpha();

        let mut pixels = vec![0u8; decoder.output_buffer_size().ok_or("Cannot determine WebP buffer size")?];
        decoder.read_image(&mut pixels).map_err(|e| e.to_string())?;

        // Convert to RGBA if needed
        let rgba = if has_alpha {
            pixels
        } else {
            let mut rgba = Vec::with_capacity(width as usize * height as usize * 4);
            for chunk in pixels.chunks(3) {
                rgba.extend_from_slice(chunk);
                rgba.push(255);
            }
            rgba
        };

        Ok(Self {
            width,
            height,
            data: rgba,
        })
    }

    /// Load an AVIF image from bytes (requires `avif-decode` feature)
    #[cfg(feature = "avif-decode")]
    pub fn from_avif(data: &[u8]) -> Result<Self, String> {
        let decoded = avif_decode::decode(data).map_err(|e| e.to_string())?;
        let width = decoded.width() as u32;
        let height = decoded.height() as u32;

        // Convert to RGBA
        let rgba: Vec<u8> = decoded
            .to_vec()
            .into_iter()
            .flat_map(|pixel| [pixel.r, pixel.g, pixel.b, pixel.a])
            .collect();

        Ok(Self {
            width,
            height,
            data: rgba,
        })
    }
}

/// A linear gradient
#[derive(Debug, Clone)]
pub struct LinearGradient {
    pub start: Pos2,
    pub end: Pos2,
    pub start_color: Color,
    pub end_color: Color,
}

impl LinearGradient {
    pub fn new(start: Pos2, end: Pos2, start_color: Color, end_color: Color) -> Self {
        Self { start, end, start_color, end_color }
    }

    /// Create a vertical gradient (top to bottom)
    pub fn vertical(top_color: Color, bottom_color: Color) -> Self {
        Self {
            start: Pos2::ZERO,
            end: Pos2::new(0.0, 1.0),
            start_color: top_color,
            end_color: bottom_color,
        }
    }

    /// Create a horizontal gradient (left to right)
    pub fn horizontal(left_color: Color, right_color: Color) -> Self {
        Self {
            start: Pos2::ZERO,
            end: Pos2::new(1.0, 0.0),
            start_color: left_color,
            end_color: right_color,
        }
    }
}

/// Text styling options
#[derive(Debug, Clone)]
pub struct TextStyle {
    pub size: f32,
    pub color: Color,
}

impl Default for TextStyle {
    fn default() -> Self {
        Self {
            size: 16.0,
            color: Color::WHITE,
        }
    }
}

impl TextStyle {
    pub fn new(size: f32, color: Color) -> Self {
        Self { size, color }
    }
}

/// The main trait that games must implement
pub trait Game: Sized {
    /// Logical width of the game canvas
    const WIDTH: u32 = 800;

    /// Logical height of the game canvas
    const HEIGHT: u32 = 600;

    /// Create a new game instance
    fn new() -> Self;

    /// Called every frame with variable delta time (good for non-physics logic)
    fn update(&mut self, _dt: f32, _input: &dyn Input) {}

    /// Called with fixed timestep (good for physics, default 60Hz)
    fn fixed_update(&mut self, _dt: f32, _input: &dyn Input) {}

    /// Called every frame to render the game
    fn draw(&mut self, renderer: &mut dyn Renderer);
}

/// Game loop configuration
#[derive(Debug, Clone)]
pub struct GameConfig {
    pub title: String,
    pub width: u32,
    pub height: u32,
    pub fixed_timestep: f32,
}

impl Default for GameConfig {
    fn default() -> Self {
        Self {
            title: "ActionEngine Game".to_string(),
            width: 800,
            height: 600,
            fixed_timestep: 1.0 / 60.0,
        }
    }
}

/// Game loop state management - backends use this to run the game loop
pub struct GameLoop<G: Game> {
    pub game: G,
    pub accumulated_time: f32,
    pub fixed_timestep: f32,
}

impl<G: Game> GameLoop<G> {
    pub fn new(fixed_timestep: f32) -> Self {
        Self {
            game: G::new(),
            accumulated_time: 0.0,
            fixed_timestep,
        }
    }

    /// Call this each frame with the delta time and input. Handles fixed timestep accumulation.
    pub fn update(&mut self, dt: f32, input: &dyn Input) {
        // Cap delta time to prevent spiral of death
        let dt = dt.min(0.25);

        // Accumulate time for fixed updates
        self.accumulated_time += dt;
        self.accumulated_time = self.accumulated_time.min(0.2);

        // Run fixed updates
        while self.accumulated_time >= self.fixed_timestep {
            self.game.fixed_update(self.fixed_timestep, input);
            self.accumulated_time -= self.fixed_timestep;
        }

        // Run variable update
        self.game.update(dt, input);
    }

    /// Call this each frame to render
    pub fn draw(&mut self, renderer: &mut dyn Renderer) {
        self.game.draw(renderer);
    }
}
