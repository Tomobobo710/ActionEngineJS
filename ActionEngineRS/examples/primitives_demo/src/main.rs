//! Primitives Demo - showcases all rendering primitives
//! Circles, lines, rects, paths, transforms, gradients, images, text, audio

use action_engine::{
    AudioManager, Color, Font, Game, Image, Input, LinearGradient, MouseButton, Pos2, Rect,
    Renderer, Sound, SoundHandle, Stroke, TextStyle, Vec2, Action,
};
use std::collections::VecDeque;

struct PrimitivesDemo {
    // Audio
    audio: Option<AudioManager>,
    laser_sounds: Vec<Sound>,

    // Music
    music_tracks: Vec<Sound>,
    music_names: Vec<&'static str>,
    current_track: usize,
    music_handle: Option<SoundHandle>,

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

    // Loaded fonts
    font_regular: Font,
    font_bold: Font,
}

// Radio UI constants
const RADIO_X: f32 = 730.0;
const RADIO_Y: f32 = 560.0;
const RADIO_RADIUS: f32 = 25.0;

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

        // Load fonts from assets (embedded at compile time)
        let font_regular_data = include_bytes!("../assets/Ubuntu-Regular.ttf");
        let font_bold_data = include_bytes!("../assets/Ubuntu-Bold.ttf");

        let font_regular =
            Font::from_bytes(font_regular_data).expect("Failed to load Ubuntu-Regular.ttf");
        let font_bold =
            Font::from_bytes(font_bold_data).expect("Failed to load Ubuntu-Bold.ttf");

        // Initialize audio (may fail gracefully)
        let audio = match AudioManager::new() {
            Ok(am) => Some(am),
            Err(e) => {
                eprintln!("Warning: Failed to initialize audio: {}", e);
                None
            }
        };

        // Load laser sound effects
        let laser_sounds = vec![
            Sound::from_wav(include_bytes!("../assets/laser1.wav")).expect("Failed to load laser1"),
            Sound::from_wav(include_bytes!("../assets/laser2.wav")).expect("Failed to load laser2"),
            Sound::from_wav(include_bytes!("../assets/laser3.wav")).expect("Failed to load laser3"),
            Sound::from_wav(include_bytes!("../assets/laser5.wav")).expect("Failed to load laser5"),
        ];

        // Load music tracks (works on all platforms - native and WASM)
        let music_tracks = vec![
            Sound::from_mp3(include_bytes!("../assets/music_1.mp3")).expect("Failed to load music_1.mp3"),
            Sound::from_ogg(include_bytes!("../assets/music_2.ogg")).expect("Failed to load music_2.ogg"),
        ];
        let music_names = vec!["Track 1 (MP3)", "Track 2 (OGG)"];

        Self {
            audio,
            laser_sounds,
            music_tracks,
            music_names,
            current_track: 0,
            music_handle: None,
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
            font_regular,
            font_bold,
        }
    }

    fn update(&mut self, dt: f32, input: &dyn Input) {
        // Advance animation time
        self.time += dt;

        // Auto-start music on first frame (only if we have tracks)
        if self.music_handle.is_none() && !self.music_tracks.is_empty() {
            if let Some(audio) = &mut self.audio {
                self.music_handle = Some(audio.play(&self.music_tracks[self.current_track], 0.3, true));
            }
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

        // Flash on action button press and play laser sounds
        if input.is_action_just_pressed(Action::Action1) {
            self.action_flash[0] = 1.0;
            if let Some(audio) = &mut self.audio {
                audio.play(&self.laser_sounds[0], 0.5, false);
            }
        }
        if input.is_action_just_pressed(Action::Action2) {
            self.action_flash[1] = 1.0;
            if let Some(audio) = &mut self.audio {
                audio.play(&self.laser_sounds[1], 0.5, false);
            }
        }
        if input.is_action_just_pressed(Action::Action3) {
            self.action_flash[2] = 1.0;
            if let Some(audio) = &mut self.audio {
                audio.play(&self.laser_sounds[2], 0.5, false);
            }
        }
        if input.is_action_just_pressed(Action::Action4) {
            self.action_flash[3] = 1.0;
            if let Some(audio) = &mut self.audio {
                audio.play(&self.laser_sounds[3], 0.5, false);
            }
        }

        // Decay flash timers
        for flash in &mut self.action_flash {
            *flash = (*flash - dt * 3.0).max(0.0);
        }

        // Check for click on radio to change track (only if we have tracks)
        if input.is_mouse_button_just_pressed(MouseButton::Left) {
            let dx = mouse_pos.x - RADIO_X;
            let dy = mouse_pos.y - RADIO_Y;
            if !self.music_tracks.is_empty() && dx * dx + dy * dy <= RADIO_RADIUS * RADIO_RADIUS {
                // Clicked on radio - stop current music and play next track
                if let Some(handle) = &self.music_handle {
                    handle.stop();
                }
                self.current_track = (self.current_track + 1) % self.music_tracks.len();
                if let Some(audio) = &mut self.audio {
                    self.music_handle =
                        Some(audio.play(&self.music_tracks[self.current_track], 0.3, true));
                }
            } else {
                // Normal click indicator
                self.click_pos = Some(mouse_pos);
                self.click_timer = 1.0;
            }
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
        renderer.stroke_circle(
            Pos2::new(mb_x + 35.0, mb_y),
            10.0,
            Stroke::new(1.0, Color::WHITE),
        );

        // Right mouse
        renderer.fill_circle(
            Pos2::new(mb_x + 70.0, mb_y),
            15.0,
            if self.mouse_right { mouse_on } else { off },
        );
        renderer.stroke_circle(
            Pos2::new(mb_x + 70.0, mb_y),
            15.0,
            Stroke::new(1.0, Color::WHITE),
        );

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

        // === RADIO UI (bottom right) ===
        // Only show if we have music tracks
        if !self.music_tracks.is_empty() {
            // Background circle
            renderer.fill_circle(Pos2::new(RADIO_X, RADIO_Y), RADIO_RADIUS, Color::rgb(50, 50, 60));

            // Animated music waves
            let wave_phase = self.time * 4.0;
            for i in 0..3 {
                let wave_offset = i as f32 * 0.5;
                let wave_height = 5.0 + 3.0 * (wave_phase + wave_offset).sin().abs();
                let x_offset = (i as f32 - 1.0) * 8.0;
                renderer.fill_rect(
                    Rect::from_min_size(
                        Pos2::new(RADIO_X + x_offset - 2.0, RADIO_Y - wave_height),
                        Vec2::new(4.0, wave_height * 2.0),
                    ),
                    Color::rgb(100, 200, 255),
                );
            }

            // Border
            renderer.stroke_circle(
                Pos2::new(RADIO_X, RADIO_Y),
                RADIO_RADIUS,
                Stroke::new(2.0, Color::rgb(100, 200, 255)),
            );

            // Track name label
            let track_style = TextStyle::new(&self.font_regular, 10.0, Color::rgba(180, 180, 180, 200));
            let track_name = self.music_names[self.current_track];
            let track_w = renderer.measure_text(track_name, &track_style).x;
            renderer.draw_text(
                track_name,
                Pos2::new(RADIO_X - track_w / 2.0, RADIO_Y - RADIO_RADIUS - 15.0),
                &track_style,
            );

            // "Click to change" hint
            let hint_style = TextStyle::new(&self.font_regular, 8.0, Color::rgba(120, 120, 120, 180));
            renderer.draw_text("click to change", Pos2::new(RADIO_X - 35.0, RADIO_Y + RADIO_RADIUS + 5.0), &hint_style);
        }

        // === TEXT SHOWCASE ===
        // Title
        let title_style = TextStyle::new(&self.font_bold, 24.0, Color::CYAN);
        renderer.draw_text("ActionEngineRS", Pos2::new(300.0, 560.0), &title_style);

        // Subtitle with regular font
        let subtitle_style =
            TextStyle::new(&self.font_regular, 14.0, Color::rgba(200, 200, 200, 200));
        renderer.draw_text("Primitives Demo", Pos2::new(300.0, 585.0), &subtitle_style);

        // Labels for showcases
        let label_style =
            TextStyle::new(&self.font_regular, 12.0, Color::rgba(180, 180, 180, 200));
        renderer.draw_text("Gradients", Pos2::new(20.0, 135.0), &label_style);
        renderer.draw_text("Paths", Pos2::new(165.0, 135.0), &label_style);
        renderer.draw_text("Transforms", Pos2::new(360.0, 135.0), &label_style);
        renderer.draw_text("Images", Pos2::new(20.0, 335.0), &label_style);

        // Action button labels
        let key_style = TextStyle::new(&self.font_bold, 12.0, Color::WHITE);
        renderer.draw_text("J", Pos2::new(175.0, 553.0), &key_style);
        renderer.draw_text("K", Pos2::new(295.0, 553.0), &key_style);
        renderer.draw_text("L", Pos2::new(415.0, 553.0), &key_style);
        renderer.draw_text(";", Pos2::new(537.0, 553.0), &key_style);
    }
}

fn main() {
    action_engine::run::<PrimitivesDemo>("Primitives Demo - ActionEngineRS");
}
