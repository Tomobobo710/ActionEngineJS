//! Debug overlay for ActionEngine
//!
//! Only active in debug builds (cfg!(debug_assertions)).
//! Shows FPS statistics and other debug information.

use crate::{Color, Pos2, Rect, Renderer, Vec2};
use std::collections::VecDeque;

// Simple 3x5 pixel font for digits 0-9, slash, and period
// Each digit is encoded as 5 rows of 3 bits
const DIGIT_FONT: [[u8; 5]; 12] = [
    [0b111, 0b101, 0b101, 0b101, 0b111], // 0
    [0b010, 0b110, 0b010, 0b010, 0b111], // 1
    [0b111, 0b001, 0b111, 0b100, 0b111], // 2
    [0b111, 0b001, 0b111, 0b001, 0b111], // 3
    [0b101, 0b101, 0b111, 0b001, 0b001], // 4
    [0b111, 0b100, 0b111, 0b001, 0b111], // 5
    [0b111, 0b100, 0b111, 0b101, 0b111], // 6
    [0b111, 0b001, 0b001, 0b001, 0b001], // 7
    [0b111, 0b101, 0b111, 0b101, 0b111], // 8
    [0b111, 0b101, 0b111, 0b001, 0b111], // 9
    [0b000, 0b001, 0b010, 0b100, 0b000], // / (slash)
    [0b000, 0b000, 0b000, 0b000, 0b010], // . (period)
];

/// Draw a single digit at the given position with the given scale
fn draw_digit(renderer: &mut dyn Renderer, digit: usize, x: f32, y: f32, scale: f32, color: Color) {
    if digit >= DIGIT_FONT.len() {
        return;
    }
    let font = &DIGIT_FONT[digit];
    for (row, &bits) in font.iter().enumerate() {
        for col in 0..3 {
            if (bits >> (2 - col)) & 1 == 1 {
                renderer.fill_rect(
                    Rect::from_min_size(
                        Pos2::new(x + col as f32 * scale, y + row as f32 * scale),
                        Vec2::new(scale, scale),
                    ),
                    color,
                );
            }
        }
    }
}

/// Draw a number string (digits, /, .) at the given position
fn draw_number(renderer: &mut dyn Renderer, text: &str, x: f32, y: f32, scale: f32, color: Color) {
    let mut offset = 0.0;
    for ch in text.chars() {
        let digit_idx = match ch {
            '0'..='9' => (ch as usize) - ('0' as usize),
            '/' => 10,
            '.' => 11,
            ' ' => {
                offset += 2.0 * scale;
                continue;
            }
            _ => continue,
        };
        draw_digit(renderer, digit_idx, x + offset, y, scale, color);
        offset += 4.0 * scale; // 3 pixels wide + 1 pixel spacing
    }
}

/// Tracks FPS and other debug statistics
pub struct DebugStats {
    /// FPS history for calculating min/median/max
    fps_history: VecDeque<(f32, f32)>, // (timestamp, fps)
    /// Current time accumulator
    time: f32,
    /// Last time stats were updated
    last_update: f32,
    /// Cached stats (updated every second)
    pub fps_min: f32,
    pub fps_median: f32,
    pub fps_max: f32,
}

impl DebugStats {
    pub fn new() -> Self {
        Self {
            fps_history: VecDeque::with_capacity(4096),
            time: 0.0,
            last_update: -1.0,
            fps_min: 0.0,
            fps_median: 0.0,
            fps_max: 0.0,
        }
    }

    /// Update stats with the current frame's delta time
    pub fn update(&mut self, dt: f32) {
        self.time += dt;

        if dt > 0.0 {
            let current_fps = 1.0 / dt;
            self.fps_history.push_back((self.time, current_fps));

            // Remove samples older than 60 seconds
            while let Some(&(t, _)) = self.fps_history.front() {
                if self.time - t > 60.0 {
                    self.fps_history.pop_front();
                } else {
                    break;
                }
            }

            // Update stats every second
            if self.time - self.last_update >= 1.0 {
                self.last_update = self.time;

                if !self.fps_history.is_empty() {
                    let mut fps_values: Vec<f32> =
                        self.fps_history.iter().map(|(_, fps)| *fps).collect();
                    fps_values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

                    self.fps_min = fps_values[0];
                    self.fps_max = fps_values[fps_values.len() - 1];
                    self.fps_median = fps_values[fps_values.len() / 2];
                }
            }
        }
    }
}

impl Default for DebugStats {
    fn default() -> Self {
        Self::new()
    }
}

impl DebugStats {
    /// Draw the debug overlay in the top-right corner
    /// Shows: min/median/max FPS over the last 60 seconds
    pub fn draw_overlay(&self, renderer: &mut dyn Renderer) {
        let scale = 2.0;
        let padding = 8.0;

        // Format: "min/median/max"
        let text = format!(
            "{:.0}/{:.0}/{:.0}",
            self.fps_min, self.fps_median, self.fps_max
        );

        // Calculate width (each char is 3*scale wide + 1*scale spacing)
        let char_width = 4.0 * scale;
        let text_width = text.len() as f32 * char_width;
        let text_height = 5.0 * scale;

        // Position in top-right
        let x = renderer.width() - text_width - padding;
        let y = padding;

        // Background
        renderer.fill_rect(
            Rect::from_min_size(
                Pos2::new(x - 4.0, y - 4.0),
                Vec2::new(text_width + 8.0, text_height + 8.0),
            ),
            Color::rgba(0, 0, 0, 180),
        );

        // Determine color based on median FPS
        let color = if self.fps_median >= 55.0 {
            Color::rgb(100, 255, 100) // Green - good
        } else if self.fps_median >= 30.0 {
            Color::rgb(255, 220, 100) // Yellow - ok
        } else {
            Color::rgb(255, 100, 100) // Red - bad
        };

        draw_number(renderer, &text, x, y, scale, color);
    }
}
