//! Primitives Demo - showcases all rendering primitives
//! Circles, lines, rects, paths, transforms, gradients, images

use action_engine::{
    Action, Color, Game, Image, Input, LinearGradient, MouseButton, Pos2, Rect, Renderer, Stroke,
    Vec2,
};
use std::collections::VecDeque;

struct PrimitivesDemo {
    // Player (now a circle!)
    player_x: f32,
    player_y: f32,
    player_speed: f32,
    player_angle: f32,

    // Mouse trail (now circles connected by lines)
    mouse_trail: VecDeque<Pos2>,

    // Action button flash timers
    action_flash: [f32; 4],

    // Click indicator (now an expanding circle)
    click_pos: Option<Pos2>,
    click_timer: f32,

    // Stored input state for drawing
    dir_up: bool,
    dir_down: bool,
    dir_left: bool,
    dir_right: bool,
    mouse_left: bool,
    mouse_middle: bool,
    mouse_right: bool,

    // Animation timer for showcasing features
    time: f32,

    // Loaded images from assets
    image_png: Option<Image>,
    image_jpg: Option<Image>,
    image_webp: Option<Image>,

    // FPS tracking (minimum over last 5 seconds)
    fps_min: f32,
    fps_history: VecDeque<(f32, f32)>, // (timestamp, fps)
}

impl Game for PrimitivesDemo {
    const WIDTH: u32 = 800;
    const HEIGHT: u32 = 600;

    fn new() -> Self {
        // Load images from assets (embedded at compile time)
        let png_data = include_bytes!("../assets/rick-astley.png");
        let jpg_data = include_bytes!("../assets/rick-astley.jpg");
        let webp_data = include_bytes!("../assets/rick-astley.webp");

        let image_png = Image::from_png(png_data).ok();
        let image_jpg = Image::from_jpeg(jpg_data).ok();
        let image_webp = Image::from_webp(webp_data).ok();

        Self {
            player_x: 400.0,
            player_y: 300.0,
            player_speed: 200.0,
            player_angle: 0.0,
            mouse_trail: VecDeque::with_capacity(32),
            action_flash: [0.0; 4],
            click_pos: None,
            click_timer: 0.0,
            dir_up: false,
            dir_down: false,
            dir_left: false,
            dir_right: false,
            mouse_left: false,
            mouse_middle: false,
            mouse_right: false,
            time: 0.0,
            image_png,
            image_jpg,
            image_webp,
            fps_min: 60.0,
            fps_history: VecDeque::with_capacity(512),
        }
    }

    fn update(&mut self, dt: f32, input: &dyn Input) {
        // Advance animation time
        self.time += dt;

        // Track minimum FPS over the last 5 seconds
        if dt > 0.0 {
            let current_fps = 1.0 / dt;
            self.fps_history.push_back((self.time, current_fps));

            // Remove samples older than 5 seconds
            while let Some(&(t, _)) = self.fps_history.front() {
                if self.time - t > 5.0 {
                    self.fps_history.pop_front();
                } else {
                    break;
                }
            }

            // Find minimum FPS in the window
            self.fps_min = self.fps_history
                .iter()
                .map(|(_, fps)| *fps)
                .fold(f32::INFINITY, f32::min);
        }

        // Move player with directional input
        let dir = input.direction();
        self.player_x += dir.x * self.player_speed * dt;
        self.player_y += dir.y * self.player_speed * dt;

        // Update player angle based on movement direction
        if dir.x != 0.0 || dir.y != 0.0 {
            self.player_angle = dir.y.atan2(dir.x);
        }

        // Clamp to screen
        self.player_x = self.player_x.clamp(25.0, Self::WIDTH as f32 - 25.0);
        self.player_y = self.player_y.clamp(25.0, Self::HEIGHT as f32 - 25.0);

        // Track mouse trail
        let mouse_pos = input.mouse_position();
        if self.mouse_trail.is_empty()
            || (self.mouse_trail.back().unwrap().x - mouse_pos.x).abs() > 8.0
            || (self.mouse_trail.back().unwrap().y - mouse_pos.y).abs() > 8.0
        {
            self.mouse_trail.push_back(mouse_pos);
            while self.mouse_trail.len() > 30 {
                self.mouse_trail.pop_front();
            }
        }

        // Flash on action button press
        if input.is_action_just_pressed(Action::Action1) {
            self.action_flash[0] = 1.0;
        }
        if input.is_action_just_pressed(Action::Action2) {
            self.action_flash[1] = 1.0;
        }
        if input.is_action_just_pressed(Action::Action3) {
            self.action_flash[2] = 1.0;
        }
        if input.is_action_just_pressed(Action::Action4) {
            self.action_flash[3] = 1.0;
        }

        // Decay flash timers
        for flash in &mut self.action_flash {
            *flash = (*flash - dt * 3.0).max(0.0);
        }

        // Track clicks
        if input.is_mouse_button_just_pressed(MouseButton::Left) {
            self.click_pos = Some(mouse_pos);
            self.click_timer = 1.0;
        }
        self.click_timer = (self.click_timer - dt * 2.0).max(0.0);
        if self.click_timer <= 0.0 {
            self.click_pos = None;
        }

        // Store input state for drawing
        self.dir_up = input.is_action_pressed(Action::DirUp);
        self.dir_down = input.is_action_pressed(Action::DirDown);
        self.dir_left = input.is_action_pressed(Action::DirLeft);
        self.dir_right = input.is_action_pressed(Action::DirRight);
        self.mouse_left = input.is_mouse_button_pressed(MouseButton::Left);
        self.mouse_middle = input.is_mouse_button_pressed(MouseButton::Middle);
        self.mouse_right = input.is_mouse_button_pressed(MouseButton::Right);
    }

    fn draw(&mut self, renderer: &mut dyn Renderer) {
        renderer.clear(Color::rgb(30, 30, 40));

        // Draw mouse trail - lines connecting circles
        for i in 1..self.mouse_trail.len() {
            let alpha = (i as f32 / self.mouse_trail.len() as f32 * 200.0) as u8;
            renderer.draw_line(
                self.mouse_trail[i - 1],
                self.mouse_trail[i],
                Stroke::new(2.0, Color::rgba(100, 150, 255, alpha)),
            );
        }

        // Draw mouse trail circles
        for (i, pos) in self.mouse_trail.iter().enumerate() {
            let alpha = (i as f32 / self.mouse_trail.len() as f32 * 255.0) as u8;
            let radius = 2.0 + (i as f32 / self.mouse_trail.len() as f32) * 4.0;
            renderer.fill_circle(*pos, radius, Color::rgba(100, 150, 255, alpha));
        }

        // Draw click indicator (expanding circle)
        if let Some(pos) = self.click_pos {
            let radius = 15.0 + (1.0 - self.click_timer) * 25.0;
            let alpha = (self.click_timer * 255.0) as u8;
            renderer.stroke_circle(pos, radius, Stroke::new(3.0, Color::rgba(255, 255, 0, alpha)));
        }

        // Draw player as a circle with direction indicator line
        renderer.fill_circle(
            Pos2::new(self.player_x, self.player_y),
            20.0,
            Color::CYAN,
        );
        renderer.stroke_circle(
            Pos2::new(self.player_x, self.player_y),
            20.0,
            Stroke::new(2.0, Color::WHITE),
        );

        // Direction indicator line from center
        let dir_len = 15.0;
        let dir_end = Pos2::new(
            self.player_x + self.player_angle.cos() * dir_len,
            self.player_y + self.player_angle.sin() * dir_len,
        );
        renderer.draw_line(
            Pos2::new(self.player_x, self.player_y),
            dir_end,
            Stroke::new(3.0, Color::WHITE),
        );

        // Draw action button indicators (circles instead of rectangles)
        let button_colors = [
            Color::RED,
            Color::GREEN,
            Color::BLUE,
            Color::rgb(255, 165, 0),
        ];

        for (i, color) in button_colors.iter().enumerate() {
            let x = 180.0 + i as f32 * 120.0;
            let y = 560.0;
            let flash = self.action_flash[i];

            // Background circle
            renderer.fill_circle(Pos2::new(x, y), 20.0, Color::rgb(60, 60, 70));

            // Flash overlay
            if flash > 0.0 {
                let alpha = (flash * 200.0) as u8;
                renderer.fill_circle(
                    Pos2::new(x, y),
                    20.0,
                    Color::rgba(color.r, color.g, color.b, alpha),
                );
            }

            // Border circle
            renderer.stroke_circle(Pos2::new(x, y), 20.0, Stroke::new(2.0, *color));
        }

        // Direction indicator (d-pad style with lines)
        let dir_x = 730.0;
        let dir_y = 80.0;
        let off = Color::rgb(80, 80, 80);
        let on = Color::rgb(100, 200, 100);

        // Center circle
        renderer.stroke_circle(Pos2::new(dir_x, dir_y), 35.0, Stroke::new(1.0, Color::WHITE));

        // Direction lines
        let line_len = 25.0;
        // Up
        renderer.draw_line(
            Pos2::new(dir_x, dir_y),
            Pos2::new(dir_x, dir_y - line_len),
            Stroke::new(4.0, if self.dir_up { on } else { off }),
        );
        // Down
        renderer.draw_line(
            Pos2::new(dir_x, dir_y),
            Pos2::new(dir_x, dir_y + line_len),
            Stroke::new(4.0, if self.dir_down { on } else { off }),
        );
        // Left
        renderer.draw_line(
            Pos2::new(dir_x, dir_y),
            Pos2::new(dir_x - line_len, dir_y),
            Stroke::new(4.0, if self.dir_left { on } else { off }),
        );
        // Right
        renderer.draw_line(
            Pos2::new(dir_x, dir_y),
            Pos2::new(dir_x + line_len, dir_y),
            Stroke::new(4.0, if self.dir_right { on } else { off }),
        );

        // Mouse button indicators (circles)
        let mb_x = 70.0;
        let mb_y = 70.0;
        let mouse_on = Color::rgb(255, 200, 100);

        // Left mouse
        renderer.fill_circle(
            Pos2::new(mb_x, mb_y),
            15.0,
            if self.mouse_left { mouse_on } else { off },
        );
        renderer.stroke_circle(Pos2::new(mb_x, mb_y), 15.0, Stroke::new(1.0, Color::WHITE));

        // Middle mouse
        renderer.fill_circle(
            Pos2::new(mb_x + 35.0, mb_y),
            10.0,
            if self.mouse_middle { mouse_on } else { off },
        );
        renderer.stroke_circle(Pos2::new(mb_x + 35.0, mb_y), 10.0, Stroke::new(1.0, Color::WHITE));

        // Right mouse
        renderer.fill_circle(
            Pos2::new(mb_x + 70.0, mb_y),
            15.0,
            if self.mouse_right { mouse_on } else { off },
        );
        renderer.stroke_circle(Pos2::new(mb_x + 70.0, mb_y), 15.0, Stroke::new(1.0, Color::WHITE));

        // === GRADIENT SHOWCASE ===
        // Top-left: horizontal gradient
        renderer.fill_rect_gradient(
            Rect::from_min_size(Pos2::new(20.0, 150.0), Vec2::new(120.0, 40.0)),
            &LinearGradient {
                start: Pos2::new(0.0, 0.5),
                end: Pos2::new(1.0, 0.5),
                start_color: Color::RED,
                end_color: Color::BLUE,
            },
        );

        // Below: vertical gradient
        renderer.fill_rect_gradient(
            Rect::from_min_size(Pos2::new(20.0, 200.0), Vec2::new(120.0, 40.0)),
            &LinearGradient {
                start: Pos2::new(0.5, 0.0),
                end: Pos2::new(0.5, 1.0),
                start_color: Color::GREEN,
                end_color: Color::rgb(255, 165, 0), // Orange
            },
        );

        // Below: diagonal gradient
        renderer.fill_rect_gradient(
            Rect::from_min_size(Pos2::new(20.0, 250.0), Vec2::new(120.0, 40.0)),
            &LinearGradient {
                start: Pos2::new(0.0, 0.0),
                end: Pos2::new(1.0, 1.0),
                start_color: Color::CYAN,
                end_color: Color::rgb(255, 0, 255), // Magenta
            },
        );

        // === PATH SHOWCASE ===
        // Draw a star using path API
        let star_cx = 200.0;
        let star_cy = 220.0;
        let star_outer = 35.0;
        let star_inner = 15.0;

        renderer.begin_path();
        for i in 0..10 {
            let angle = (i as f32 / 10.0) * std::f32::consts::TAU - std::f32::consts::FRAC_PI_2;
            let r = if i % 2 == 0 { star_outer } else { star_inner };
            let x = star_cx + angle.cos() * r;
            let y = star_cy + angle.sin() * r;
            if i == 0 {
                renderer.move_to(Pos2::new(x, y));
            } else {
                renderer.line_to(Pos2::new(x, y));
            }
        }
        renderer.close_path();
        renderer.fill_path(Color::rgb(255, 215, 0)); // Gold
        renderer.stroke_path(Stroke::new(2.0, Color::rgb(180, 130, 0)));

        // Draw a pie slice using arc
        let pie_cx = 300.0;
        let pie_cy = 220.0;
        let animated_angle = self.time * 2.0;

        renderer.begin_path();
        renderer.move_to(Pos2::new(pie_cx, pie_cy));
        renderer.arc(
            Pos2::new(pie_cx, pie_cy),
            30.0,
            animated_angle,
            animated_angle + std::f32::consts::FRAC_PI_2,
        );
        renderer.close_path();
        renderer.fill_path(Color::rgba(255, 100, 100, 200));

        // === TRANSFORM SHOWCASE ===
        // Draw a rotating rectangle using transforms
        let tx = 400.0;
        let ty = 180.0;

        renderer.save();
        renderer.translate(Vec2::new(tx, ty));
        renderer.rotate(self.time);
        // Draw rectangle centered at origin
        renderer.fill_rect(
            Rect::from_min_size(Pos2::new(-25.0, -15.0), Vec2::new(50.0, 30.0)),
            Color::rgb(150, 100, 200),
        );
        renderer.stroke_rect(
            Rect::from_min_size(Pos2::new(-25.0, -15.0), Vec2::new(50.0, 30.0)),
            Stroke::new(2.0, Color::WHITE),
        );
        renderer.restore();

        // Draw a scaling circle using transforms
        let scale_factor = 0.7 + 0.3 * (self.time * 3.0).sin();
        renderer.save();
        renderer.translate(Vec2::new(500.0, 180.0));
        renderer.scale(Vec2::new(scale_factor, scale_factor));
        renderer.fill_circle(Pos2::new(0.0, 0.0), 25.0, Color::rgb(100, 200, 150));
        renderer.stroke_circle(Pos2::new(0.0, 0.0), 25.0, Stroke::new(2.0, Color::WHITE));
        renderer.restore();

        // === IMAGE SHOWCASE ===
        // Draw loaded images side by side (scaled to 80x80)
        let img_size = Vec2::new(80.0, 80.0);
        let img_y = 350.0;

        // PNG
        if let Some(img) = &self.image_png {
            renderer.draw_image_rect(img, Rect::from_min_size(Pos2::new(20.0, img_y), img_size));
        }

        // JPG
        if let Some(img) = &self.image_jpg {
            renderer.draw_image_rect(img, Rect::from_min_size(Pos2::new(110.0, img_y), img_size));
        }

        // WebP
        if let Some(img) = &self.image_webp {
            renderer.draw_image_rect(img, Rect::from_min_size(Pos2::new(200.0, img_y), img_size));
        }

        // === COMBINED: Nested transforms with path ===
        renderer.save();
        renderer.translate(Vec2::new(550.0, 280.0));
        renderer.rotate(self.time * 0.5);
        renderer.scale(Vec2::new(0.8 + 0.2 * (self.time * 2.0).sin(), 0.8));

        // Draw a triangle using path
        renderer.begin_path();
        renderer.move_to(Pos2::new(0.0, -30.0));
        renderer.line_to(Pos2::new(26.0, 15.0));
        renderer.line_to(Pos2::new(-26.0, 15.0));
        renderer.close_path();
        renderer.fill_path(Color::rgba(255, 200, 100, 200));
        renderer.stroke_path(Stroke::new(2.0, Color::WHITE));

        renderer.restore();

        // Crosshair at center of screen
        let cx = Self::WIDTH as f32 / 2.0;
        let cy = Self::HEIGHT as f32 / 2.0;
        renderer.draw_line(
            Pos2::new(cx - 20.0, cy),
            Pos2::new(cx + 20.0, cy),
            Stroke::new(1.0, Color::rgba(255, 255, 255, 50)),
        );
        renderer.draw_line(
            Pos2::new(cx, cy - 20.0),
            Pos2::new(cx, cy + 20.0),
            Stroke::new(1.0, Color::rgba(255, 255, 255, 50)),
        );

        // === FPS COUNTER (top-right, 50% opacity, shows 5-second low) ===
        let fps_str = format!("{:.0}", self.fps_min);
        let digit_w = 12.0;
        let digit_h = 20.0;
        let digit_gap = 3.0;
        let total_w = fps_str.len() as f32 * (digit_w + digit_gap);
        let fps_x = Self::WIDTH as f32 - total_w - 10.0;
        let fps_y = 10.0;
        let fps_color = Color::rgba(255, 255, 255, 128); // 50% opacity

        for (i, ch) in fps_str.chars().enumerate() {
            let x = fps_x + i as f32 * (digit_w + digit_gap);
            draw_7seg_digit(renderer, x, fps_y, digit_w, digit_h, ch, fps_color);
        }
    }
}

/// Draw a 7-segment style digit
fn draw_7seg_digit(
    renderer: &mut dyn Renderer,
    x: f32,
    y: f32,
    w: f32,
    h: f32,
    digit: char,
    color: Color,
) {
    let stroke = Stroke::new(2.0, color);
    let half_h = h / 2.0;

    // Segment map: [top, top-right, bottom-right, bottom, bottom-left, top-left, middle]
    let segments: [bool; 7] = match digit {
        '0' => [true, true, true, true, true, true, false],
        '1' => [false, true, true, false, false, false, false],
        '2' => [true, true, false, true, true, false, true],
        '3' => [true, true, true, true, false, false, true],
        '4' => [false, true, true, false, false, true, true],
        '5' => [true, false, true, true, false, true, true],
        '6' => [true, false, true, true, true, true, true],
        '7' => [true, true, true, false, false, false, false],
        '8' => [true, true, true, true, true, true, true],
        '9' => [true, true, true, true, false, true, true],
        _ => [false; 7],
    };

    // Top
    if segments[0] {
        renderer.draw_line(Pos2::new(x, y), Pos2::new(x + w, y), stroke);
    }
    // Top-right
    if segments[1] {
        renderer.draw_line(Pos2::new(x + w, y), Pos2::new(x + w, y + half_h), stroke);
    }
    // Bottom-right
    if segments[2] {
        renderer.draw_line(Pos2::new(x + w, y + half_h), Pos2::new(x + w, y + h), stroke);
    }
    // Bottom
    if segments[3] {
        renderer.draw_line(Pos2::new(x, y + h), Pos2::new(x + w, y + h), stroke);
    }
    // Bottom-left
    if segments[4] {
        renderer.draw_line(Pos2::new(x, y + half_h), Pos2::new(x, y + h), stroke);
    }
    // Top-left
    if segments[5] {
        renderer.draw_line(Pos2::new(x, y), Pos2::new(x, y + half_h), stroke);
    }
    // Middle
    if segments[6] {
        renderer.draw_line(Pos2::new(x, y + half_h), Pos2::new(x + w, y + half_h), stroke);
    }
}

fn main() {
    action_engine::run::<PrimitivesDemo>("Primitives Demo - ActionEngineRS");
}
