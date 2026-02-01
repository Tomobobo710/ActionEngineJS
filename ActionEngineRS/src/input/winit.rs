//! Winit-based input handling

use crate::{Action, GamepadAxis, GamepadButton, Input, Key, MouseButton, Pos2, Vec2};
use std::collections::HashSet;
use winit::event::{ElementState, MouseButton as WinitMouseButton};
use winit::keyboard::{KeyCode, PhysicalKey};

/// Input implementation using winit events
pub struct WinitInput {
    // Keyboard state
    keys_pressed: HashSet<Key>,
    keys_just_pressed: HashSet<Key>,
    keys_just_released: HashSet<Key>,

    // Modifier state
    shift_pressed: bool,
    shift_just_pressed: bool,
    shift_just_released: bool,

    // Mouse state
    mouse_pos: Pos2,
    mouse_delta: Vec2,
    mouse_buttons_pressed: [bool; 3],
    mouse_buttons_just_pressed: [bool; 3],
    mouse_buttons_just_released: [bool; 3],
    scroll_delta: Vec2,

    // Window size for coordinate conversion
    window_size: (u32, u32),
    game_size: (u32, u32),
}

impl WinitInput {
    pub fn new(game_width: u32, game_height: u32) -> Self {
        Self {
            keys_pressed: HashSet::new(),
            keys_just_pressed: HashSet::new(),
            keys_just_released: HashSet::new(),
            shift_pressed: false,
            shift_just_pressed: false,
            shift_just_released: false,
            mouse_pos: Pos2::ZERO,
            mouse_delta: Vec2::ZERO,
            mouse_buttons_pressed: [false; 3],
            mouse_buttons_just_pressed: [false; 3],
            mouse_buttons_just_released: [false; 3],
            scroll_delta: Vec2::ZERO,
            window_size: (game_width, game_height),
            game_size: (game_width, game_height),
        }
    }

    /// Call at the start of each frame to clear "just pressed/released" states
    pub fn begin_frame(&mut self) {
        self.keys_just_pressed.clear();
        self.keys_just_released.clear();
        self.shift_just_pressed = false;
        self.shift_just_released = false;
        self.mouse_buttons_just_pressed = [false; 3];
        self.mouse_buttons_just_released = [false; 3];
        self.mouse_delta = Vec2::ZERO;
        self.scroll_delta = Vec2::ZERO;
    }

    /// Update window size for coordinate conversion
    pub fn set_window_size(&mut self, width: u32, height: u32) {
        self.window_size = (width, height);
    }

    /// Handle a keyboard event
    pub fn handle_keyboard(&mut self, physical_key: PhysicalKey, state: ElementState) {
        // Handle shift modifier
        if let PhysicalKey::Code(code) = physical_key {
            if code == KeyCode::ShiftLeft || code == KeyCode::ShiftRight {
                let was_pressed = self.shift_pressed;
                self.shift_pressed = state == ElementState::Pressed;
                if self.shift_pressed && !was_pressed {
                    self.shift_just_pressed = true;
                } else if !self.shift_pressed && was_pressed {
                    self.shift_just_released = true;
                }
            }
        }

        // Handle regular keys
        if let Some(key) = keycode_to_key(physical_key) {
            match state {
                ElementState::Pressed => {
                    if !self.keys_pressed.contains(&key) {
                        self.keys_just_pressed.insert(key);
                    }
                    self.keys_pressed.insert(key);
                }
                ElementState::Released => {
                    if self.keys_pressed.contains(&key) {
                        self.keys_just_released.insert(key);
                    }
                    self.keys_pressed.remove(&key);
                }
            }
        }
    }

    /// Handle mouse movement
    pub fn handle_mouse_move(&mut self, x: f64, y: f64) {
        let new_pos = self.screen_to_game(x as f32, y as f32);
        self.mouse_delta.x += new_pos.x - self.mouse_pos.x;
        self.mouse_delta.y += new_pos.y - self.mouse_pos.y;
        self.mouse_pos = new_pos;
    }

    /// Handle mouse button
    pub fn handle_mouse_button(&mut self, button: WinitMouseButton, state: ElementState) {
        let idx = match button {
            WinitMouseButton::Left => Some(0),
            WinitMouseButton::Middle => Some(1),
            WinitMouseButton::Right => Some(2),
            _ => None,
        };

        if let Some(idx) = idx {
            match state {
                ElementState::Pressed => {
                    if !self.mouse_buttons_pressed[idx] {
                        self.mouse_buttons_just_pressed[idx] = true;
                    }
                    self.mouse_buttons_pressed[idx] = true;
                }
                ElementState::Released => {
                    if self.mouse_buttons_pressed[idx] {
                        self.mouse_buttons_just_released[idx] = true;
                    }
                    self.mouse_buttons_pressed[idx] = false;
                }
            }
        }
    }

    /// Handle scroll wheel
    pub fn handle_scroll(&mut self, delta_x: f32, delta_y: f32) {
        self.scroll_delta.x += delta_x;
        self.scroll_delta.y += delta_y;
    }

    fn screen_to_game(&self, x: f32, y: f32) -> Pos2 {
        // Calculate the game viewport within the window (letterboxed)
        let window_aspect = self.window_size.0 as f32 / self.window_size.1 as f32;
        let game_aspect = self.game_size.0 as f32 / self.game_size.1 as f32;

        let (viewport_w, viewport_h, offset_x, offset_y) = if window_aspect > game_aspect {
            // Window is wider - letterbox on sides
            let h = self.window_size.1 as f32;
            let w = h * game_aspect;
            let offset = (self.window_size.0 as f32 - w) / 2.0;
            (w, h, offset, 0.0)
        } else {
            // Window is taller - letterbox on top/bottom
            let w = self.window_size.0 as f32;
            let h = w / game_aspect;
            let offset = (self.window_size.1 as f32 - h) / 2.0;
            (w, h, 0.0, offset)
        };

        Pos2::new(
            (x - offset_x) / viewport_w * self.game_size.0 as f32,
            (y - offset_y) / viewport_h * self.game_size.1 as f32,
        )
    }
}

impl Input for WinitInput {
    fn is_action_pressed(&self, action: Action) -> bool {
        match action {
            Action::DirUp => self.is_key_pressed(Key::W) || self.is_key_pressed(Key::Up),
            Action::DirDown => self.is_key_pressed(Key::S) || self.is_key_pressed(Key::Down),
            Action::DirLeft => self.is_key_pressed(Key::A) || self.is_key_pressed(Key::Left),
            Action::DirRight => self.is_key_pressed(Key::D) || self.is_key_pressed(Key::Right),
            Action::Action1 => self.is_key_pressed(Key::Space),
            Action::Action2 => self.shift_pressed,
            Action::Action3 => self.is_key_pressed(Key::E),
            Action::Action4 => self.is_key_pressed(Key::Q),
            Action::Action5 => self.is_key_pressed(Key::F),
            Action::Action6 => self.is_key_pressed(Key::R),
            Action::Action7 => self.is_key_pressed(Key::Num1),
            Action::Action8 => self.is_key_pressed(Key::Num2),
            Action::Action9 => self.is_key_pressed(Key::Num3),
            Action::Action10 => self.is_key_pressed(Key::Num4),
            Action::Start => self.is_key_pressed(Key::Enter),
            Action::Select => self.is_key_pressed(Key::Tab),
            Action::Pause => self.is_key_pressed(Key::Escape),
            Action::DebugToggle => self.is_key_pressed(Key::F9),
        }
    }

    fn is_action_just_pressed(&self, action: Action) -> bool {
        match action {
            Action::DirUp => self.is_key_just_pressed(Key::W) || self.is_key_just_pressed(Key::Up),
            Action::DirDown => {
                self.is_key_just_pressed(Key::S) || self.is_key_just_pressed(Key::Down)
            }
            Action::DirLeft => {
                self.is_key_just_pressed(Key::A) || self.is_key_just_pressed(Key::Left)
            }
            Action::DirRight => {
                self.is_key_just_pressed(Key::D) || self.is_key_just_pressed(Key::Right)
            }
            Action::Action1 => self.is_key_just_pressed(Key::Space),
            Action::Action2 => self.shift_just_pressed,
            Action::Action3 => self.is_key_just_pressed(Key::E),
            Action::Action4 => self.is_key_just_pressed(Key::Q),
            Action::Action5 => self.is_key_just_pressed(Key::F),
            Action::Action6 => self.is_key_just_pressed(Key::R),
            Action::Action7 => self.is_key_just_pressed(Key::Num1),
            Action::Action8 => self.is_key_just_pressed(Key::Num2),
            Action::Action9 => self.is_key_just_pressed(Key::Num3),
            Action::Action10 => self.is_key_just_pressed(Key::Num4),
            Action::Start => self.is_key_just_pressed(Key::Enter),
            Action::Select => self.is_key_just_pressed(Key::Tab),
            Action::Pause => self.is_key_just_pressed(Key::Escape),
            Action::DebugToggle => self.is_key_just_pressed(Key::F9),
        }
    }

    fn is_action_just_released(&self, action: Action) -> bool {
        match action {
            Action::DirUp => {
                self.is_key_just_released(Key::W) || self.is_key_just_released(Key::Up)
            }
            Action::DirDown => {
                self.is_key_just_released(Key::S) || self.is_key_just_released(Key::Down)
            }
            Action::DirLeft => {
                self.is_key_just_released(Key::A) || self.is_key_just_released(Key::Left)
            }
            Action::DirRight => {
                self.is_key_just_released(Key::D) || self.is_key_just_released(Key::Right)
            }
            Action::Action1 => self.is_key_just_released(Key::Space),
            Action::Action2 => self.shift_just_released,
            Action::Action3 => self.is_key_just_released(Key::E),
            Action::Action4 => self.is_key_just_released(Key::Q),
            Action::Action5 => self.is_key_just_released(Key::F),
            Action::Action6 => self.is_key_just_released(Key::R),
            Action::Action7 => self.is_key_just_released(Key::Num1),
            Action::Action8 => self.is_key_just_released(Key::Num2),
            Action::Action9 => self.is_key_just_released(Key::Num3),
            Action::Action10 => self.is_key_just_released(Key::Num4),
            Action::Start => self.is_key_just_released(Key::Enter),
            Action::Select => self.is_key_just_released(Key::Tab),
            Action::Pause => self.is_key_just_released(Key::Escape),
            Action::DebugToggle => self.is_key_just_released(Key::F9),
        }
    }

    fn is_key_pressed(&self, key: Key) -> bool {
        self.keys_pressed.contains(&key)
    }

    fn is_key_just_pressed(&self, key: Key) -> bool {
        self.keys_just_pressed.contains(&key)
    }

    fn is_key_just_released(&self, key: Key) -> bool {
        self.keys_just_released.contains(&key)
    }

    fn mouse_position(&self) -> Pos2 {
        self.mouse_pos
    }

    fn mouse_delta(&self) -> Vec2 {
        self.mouse_delta
    }

    fn is_mouse_button_pressed(&self, button: MouseButton) -> bool {
        self.mouse_buttons_pressed[button_index(button)]
    }

    fn is_mouse_button_just_pressed(&self, button: MouseButton) -> bool {
        self.mouse_buttons_just_pressed[button_index(button)]
    }

    fn is_mouse_button_just_released(&self, button: MouseButton) -> bool {
        self.mouse_buttons_just_released[button_index(button)]
    }

    fn scroll_delta(&self) -> Vec2 {
        self.scroll_delta
    }

    // Gamepad not implemented yet
    fn is_gamepad_connected(&self, _gamepad_id: usize) -> bool {
        false
    }

    fn gamepad_axis(&self, _gamepad_id: usize, _axis: GamepadAxis) -> f32 {
        0.0
    }

    fn is_gamepad_button_pressed(&self, _gamepad_id: usize, _button: GamepadButton) -> bool {
        false
    }

    fn is_gamepad_button_just_pressed(&self, _gamepad_id: usize, _button: GamepadButton) -> bool {
        false
    }

    fn is_gamepad_button_just_released(&self, _gamepad_id: usize, _button: GamepadButton) -> bool {
        false
    }
}

fn button_index(button: MouseButton) -> usize {
    match button {
        MouseButton::Left => 0,
        MouseButton::Middle => 1,
        MouseButton::Right => 2,
    }
}

fn keycode_to_key(physical_key: PhysicalKey) -> Option<Key> {
    match physical_key {
        PhysicalKey::Code(code) => match code {
            KeyCode::KeyA => Some(Key::A),
            KeyCode::KeyB => Some(Key::B),
            KeyCode::KeyC => Some(Key::C),
            KeyCode::KeyD => Some(Key::D),
            KeyCode::KeyE => Some(Key::E),
            KeyCode::KeyF => Some(Key::F),
            KeyCode::KeyG => Some(Key::G),
            KeyCode::KeyH => Some(Key::H),
            KeyCode::KeyI => Some(Key::I),
            KeyCode::KeyJ => Some(Key::J),
            KeyCode::KeyK => Some(Key::K),
            KeyCode::KeyL => Some(Key::L),
            KeyCode::KeyM => Some(Key::M),
            KeyCode::KeyN => Some(Key::N),
            KeyCode::KeyO => Some(Key::O),
            KeyCode::KeyP => Some(Key::P),
            KeyCode::KeyQ => Some(Key::Q),
            KeyCode::KeyR => Some(Key::R),
            KeyCode::KeyS => Some(Key::S),
            KeyCode::KeyT => Some(Key::T),
            KeyCode::KeyU => Some(Key::U),
            KeyCode::KeyV => Some(Key::V),
            KeyCode::KeyW => Some(Key::W),
            KeyCode::KeyX => Some(Key::X),
            KeyCode::KeyY => Some(Key::Y),
            KeyCode::KeyZ => Some(Key::Z),
            KeyCode::Digit0 => Some(Key::Num0),
            KeyCode::Digit1 => Some(Key::Num1),
            KeyCode::Digit2 => Some(Key::Num2),
            KeyCode::Digit3 => Some(Key::Num3),
            KeyCode::Digit4 => Some(Key::Num4),
            KeyCode::Digit5 => Some(Key::Num5),
            KeyCode::Digit6 => Some(Key::Num6),
            KeyCode::Digit7 => Some(Key::Num7),
            KeyCode::Digit8 => Some(Key::Num8),
            KeyCode::Digit9 => Some(Key::Num9),
            KeyCode::ArrowUp => Some(Key::Up),
            KeyCode::ArrowDown => Some(Key::Down),
            KeyCode::ArrowLeft => Some(Key::Left),
            KeyCode::ArrowRight => Some(Key::Right),
            KeyCode::Space => Some(Key::Space),
            KeyCode::Enter => Some(Key::Enter),
            KeyCode::Escape => Some(Key::Escape),
            KeyCode::Tab => Some(Key::Tab),
            KeyCode::Backspace => Some(Key::Backspace),
            KeyCode::Delete => Some(Key::Delete),
            KeyCode::Insert => Some(Key::Insert),
            KeyCode::Home => Some(Key::Home),
            KeyCode::End => Some(Key::End),
            KeyCode::PageUp => Some(Key::PageUp),
            KeyCode::PageDown => Some(Key::PageDown),
            KeyCode::F1 => Some(Key::F1),
            KeyCode::F2 => Some(Key::F2),
            KeyCode::F3 => Some(Key::F3),
            KeyCode::F4 => Some(Key::F4),
            KeyCode::F5 => Some(Key::F5),
            KeyCode::F6 => Some(Key::F6),
            KeyCode::F7 => Some(Key::F7),
            KeyCode::F8 => Some(Key::F8),
            KeyCode::F9 => Some(Key::F9),
            KeyCode::F10 => Some(Key::F10),
            KeyCode::F11 => Some(Key::F11),
            KeyCode::F12 => Some(Key::F12),
            _ => None,
        },
        PhysicalKey::Unidentified(_) => None,
    }
}
