//! Input handling abstractions for ActionEngine
//!
//! Provides backend-agnostic input types and traits. Backends implement
//! the `Input` trait to provide actual input state.

// Backend-specific implementations
#[cfg(feature = "glow-backend")]
pub mod winit;

use crate::{Pos2, Vec2};

/// Standard game actions that can be mapped to various input sources
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Action {
    // Directional
    DirUp,
    DirDown,
    DirLeft,
    DirRight,

    // Face buttons / primary actions
    Action1,
    Action2,
    Action3,
    Action4,

    // Secondary actions (shoulders, triggers)
    Action5,
    Action6,
    Action7,
    Action8,

    // Stick clicks
    Action9,
    Action10,

    // Menu / utility
    Start,
    Select,
    Pause,

    // Debug
    DebugToggle,
}

/// Mouse buttons
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum MouseButton {
    Left,
    Middle,
    Right,
}

/// Gamepad axes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum GamepadAxis {
    LeftStickX,
    LeftStickY,
    RightStickX,
    RightStickY,
    LeftTrigger,
    RightTrigger,
}

/// Gamepad buttons (standard layout)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum GamepadButton {
    South,  // A / Cross
    East,   // B / Circle
    West,   // X / Square
    North,  // Y / Triangle
    LeftBumper,
    RightBumper,
    LeftTrigger,
    RightTrigger,
    Select,
    Start,
    LeftStick,
    RightStick,
    DPadUp,
    DPadDown,
    DPadLeft,
    DPadRight,
}

/// Key codes for raw keyboard access
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Key {
    // Letters
    A, B, C, D, E, F, G, H, I, J, K, L, M,
    N, O, P, Q, R, S, T, U, V, W, X, Y, Z,

    // Numbers
    Num0, Num1, Num2, Num3, Num4, Num5, Num6, Num7, Num8, Num9,

    // Function keys
    F1, F2, F3, F4, F5, F6, F7, F8, F9, F10, F11, F12,

    // Arrow keys
    Up, Down, Left, Right,

    // Modifiers
    Shift, Ctrl, Alt, Super,

    // Common keys
    Space, Enter, Escape, Tab, Backspace, Delete, Insert,
    Home, End, PageUp, PageDown,

    // Punctuation
    Minus, Equals, LeftBracket, RightBracket, Backslash,
    Semicolon, Apostrophe, Grave, Comma, Period, Slash,
}

/// Abstract input trait - backends implement this
pub trait Input {
    // === Action-based input (recommended) ===

    /// Check if an action is currently pressed
    fn is_action_pressed(&self, action: Action) -> bool;

    /// Check if an action was just pressed this frame
    fn is_action_just_pressed(&self, action: Action) -> bool;

    /// Check if an action was just released this frame
    fn is_action_just_released(&self, action: Action) -> bool;

    // === Raw keyboard input ===

    /// Check if a specific key is currently pressed
    fn is_key_pressed(&self, key: Key) -> bool;

    /// Check if a specific key was just pressed this frame
    fn is_key_just_pressed(&self, key: Key) -> bool;

    /// Check if a specific key was just released this frame
    fn is_key_just_released(&self, key: Key) -> bool;

    // === Mouse input ===

    /// Get the current mouse/pointer position in game coordinates
    fn mouse_position(&self) -> Pos2;

    /// Get the mouse movement delta since last frame
    fn mouse_delta(&self) -> Vec2;

    /// Check if a mouse button is currently pressed
    fn is_mouse_button_pressed(&self, button: MouseButton) -> bool;

    /// Check if a mouse button was just pressed this frame
    fn is_mouse_button_just_pressed(&self, button: MouseButton) -> bool;

    /// Check if a mouse button was just released this frame
    fn is_mouse_button_just_released(&self, button: MouseButton) -> bool;

    /// Get the scroll wheel delta (x for horizontal, y for vertical)
    fn scroll_delta(&self) -> Vec2;

    // === Gamepad input ===

    /// Check if a gamepad is connected
    fn is_gamepad_connected(&self, gamepad_id: usize) -> bool;

    /// Get the value of a gamepad axis (-1.0 to 1.0, with deadzone applied)
    fn gamepad_axis(&self, gamepad_id: usize, axis: GamepadAxis) -> f32;

    /// Check if a gamepad button is currently pressed
    fn is_gamepad_button_pressed(&self, gamepad_id: usize, button: GamepadButton) -> bool;

    /// Check if a gamepad button was just pressed this frame
    fn is_gamepad_button_just_pressed(&self, gamepad_id: usize, button: GamepadButton) -> bool;

    /// Check if a gamepad button was just released this frame
    fn is_gamepad_button_just_released(&self, gamepad_id: usize, button: GamepadButton) -> bool;

    /// Get left stick as a Vec2 (with deadzone applied)
    fn gamepad_left_stick(&self, gamepad_id: usize) -> Vec2 {
        Vec2::new(
            self.gamepad_axis(gamepad_id, GamepadAxis::LeftStickX),
            self.gamepad_axis(gamepad_id, GamepadAxis::LeftStickY),
        )
    }

    /// Get right stick as a Vec2 (with deadzone applied)
    fn gamepad_right_stick(&self, gamepad_id: usize) -> Vec2 {
        Vec2::new(
            self.gamepad_axis(gamepad_id, GamepadAxis::RightStickX),
            self.gamepad_axis(gamepad_id, GamepadAxis::RightStickY),
        )
    }

    // === Convenience methods ===

    /// Get directional input as a normalized Vec2 from actions
    fn direction(&self) -> Vec2 {
        let mut dir = Vec2::ZERO;
        if self.is_action_pressed(Action::DirUp) {
            dir.y -= 1.0;
        }
        if self.is_action_pressed(Action::DirDown) {
            dir.y += 1.0;
        }
        if self.is_action_pressed(Action::DirLeft) {
            dir.x -= 1.0;
        }
        if self.is_action_pressed(Action::DirRight) {
            dir.x += 1.0;
        }
        // Normalize diagonal movement
        let len_sq = dir.x * dir.x + dir.y * dir.y;
        if len_sq > 1.0 {
            let len = len_sq.sqrt();
            dir.x /= len;
            dir.y /= len;
        }
        dir
    }
}

/// A simple input implementation that stores no state (all inputs return false/zero)
/// Useful as a placeholder or for testing
#[derive(Debug, Default)]
pub struct NoInput;

impl Input for NoInput {
    fn is_action_pressed(&self, _action: Action) -> bool { false }
    fn is_action_just_pressed(&self, _action: Action) -> bool { false }
    fn is_action_just_released(&self, _action: Action) -> bool { false }

    fn is_key_pressed(&self, _key: Key) -> bool { false }
    fn is_key_just_pressed(&self, _key: Key) -> bool { false }
    fn is_key_just_released(&self, _key: Key) -> bool { false }

    fn mouse_position(&self) -> Pos2 { Pos2::ZERO }
    fn mouse_delta(&self) -> Vec2 { Vec2::ZERO }
    fn is_mouse_button_pressed(&self, _button: MouseButton) -> bool { false }
    fn is_mouse_button_just_pressed(&self, _button: MouseButton) -> bool { false }
    fn is_mouse_button_just_released(&self, _button: MouseButton) -> bool { false }
    fn scroll_delta(&self) -> Vec2 { Vec2::ZERO }

    fn is_gamepad_connected(&self, _gamepad_id: usize) -> bool { false }
    fn gamepad_axis(&self, _gamepad_id: usize, _axis: GamepadAxis) -> f32 { 0.0 }
    fn is_gamepad_button_pressed(&self, _gamepad_id: usize, _button: GamepadButton) -> bool { false }
    fn is_gamepad_button_just_pressed(&self, _gamepad_id: usize, _button: GamepadButton) -> bool { false }
    fn is_gamepad_button_just_released(&self, _gamepad_id: usize, _button: GamepadButton) -> bool { false }
}
