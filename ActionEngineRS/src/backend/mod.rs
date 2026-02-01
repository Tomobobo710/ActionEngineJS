//! Glow/OpenGL backend for ActionEngine
//!
//! This module provides a complete game runtime using:
//! - `winit` for windowing and input
//! - `glutin` for OpenGL context creation (native)
//! - `web-sys` for WebGL context creation (web)
//! - `glow` for OpenGL/WebGL rendering

mod input;
mod renderer;

#[cfg(not(target_arch = "wasm32"))]
mod runner_native;

#[cfg(target_arch = "wasm32")]
mod runner_web;

pub use input::WinitInput;
pub use renderer::GlowRenderer;

#[cfg(not(target_arch = "wasm32"))]
pub use runner_native::run;

#[cfg(target_arch = "wasm32")]
pub use runner_web::run;
