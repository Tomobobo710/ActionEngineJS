//! Glow/OpenGL backend for ActionEngine
//!
//! This module provides the game runtime using:
//! - `winit` for windowing
//! - `glutin` for OpenGL context creation (native)
//! - `web-sys` for WebGL context creation (web)
//! - `glow` for OpenGL/WebGL rendering

#[cfg(not(target_arch = "wasm32"))]
mod native;

#[cfg(target_arch = "wasm32")]
mod web;

#[cfg(not(target_arch = "wasm32"))]
pub use native::run;

#[cfg(target_arch = "wasm32")]
pub use web::run;
