//! Bullet Hell - A classic shoot 'em up game
//!
//! Controls:
//! - Arrow keys / WASD: Move
//! - Space: Shoot
//! - Shift: Focus mode (slower movement, faster fire rate, tighter hitbox)

use action_engine::{
    Action, AudioManager, Color, Font, Game, Input, Pos2, Rect, Renderer, Sound, Stroke,
    TextStyle, Vec2,
};

const PLAYER_SPEED: f32 = 280.0;
const PLAYER_FOCUS_SPEED: f32 = 120.0;
const PLAYER_RADIUS: f32 = 4.0;
const PLAYER_SHOOT_COOLDOWN: f32 = 0.24;
const PLAYER_FOCUS_SHOOT_COOLDOWN: f32 = 0.08;

const BULLET_SPEED: f32 = 600.0;
const BULLET_RADIUS: f32 = 4.0;

const ENEMY_BULLET_RADIUS: f32 = 5.0;

const SPAWN_MARGIN: f32 = 40.0;

// Game state
#[derive(Clone, Copy, PartialEq)]
enum GameState {
    Playing,
    GameOver,
    Paused,
}

// Player bullet
struct Bullet {
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
    alive: bool,
}

// Enemy bullet with more variety
struct EnemyBullet {
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
    radius: f32,
    color: Color,
    alive: bool,
    from_boss: bool,
}

// Enemy types with different behaviors
#[derive(Clone, Copy)]
enum EnemyType {
    Basic,      // Moves down, shoots occasionally
    Spinner,    // Rotates and shoots radial patterns
    Sweeper,    // Moves side to side, shoots aimed bullets
    Boss,       // Large enemy with complex patterns
}

struct Enemy {
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
    hp: i32,
    max_hp: i32,
    enemy_type: EnemyType,
    shoot_timer: f32,
    pattern_timer: f32,
    angle: f32,
    alive: bool,
}

// Explosion effect
struct Explosion {
    x: f32,
    y: f32,
    timer: f32,
    max_time: f32,
    color: Color,
}

// Star for background
struct Star {
    x: f32,
    y: f32,
    speed: f32,
    brightness: u8,
}

struct BulletHell {
    // Resources
    audio: Option<AudioManager>,
    shoot_sound: Sound,
    enemy_shoot_sound: Sound,
    explosion_sound: Sound,
    enemy_hit_sound: Sound,
    font: Font,
    font_bold: Font,

    // Game state
    state: GameState,
    score: u32,
    lives: i32,
    wave: u32,
    wave_timer: f32,
    invincibility_timer: f32,

    // Player
    player_x: f32,
    player_y: f32,
    shoot_cooldown: f32,
    focus_mode: bool,

    // Entities
    bullets: Vec<Bullet>,
    enemy_bullets: Vec<EnemyBullet>,
    enemies: Vec<Enemy>,
    explosions: Vec<Explosion>,
    stars: Vec<Star>,

    // Timing
    time: f32,
    spawn_timer: f32,
}

impl BulletHell {
    fn spawn_enemy(&mut self, enemy_type: EnemyType) {
        let x = SPAWN_MARGIN + rand_f32() * (800.0 - SPAWN_MARGIN * 2.0);

        let (hp, vy) = match enemy_type {
            EnemyType::Basic => (2, 60.0 + rand_f32() * 40.0),
            EnemyType::Spinner => (4, 30.0),
            EnemyType::Sweeper => (3, 40.0),
            EnemyType::Boss => (30, 20.0),
        };

        self.enemies.push(Enemy {
            x,
            y: -30.0,
            vx: 0.0,
            vy,
            hp,
            max_hp: hp,
            enemy_type,
            shoot_timer: rand_f32() * 0.5,
            pattern_timer: 0.0,
            angle: 0.0,
            alive: true,
        });
    }

    fn player_shoot(&mut self) {
        if self.shoot_cooldown <= 0.0 {
            // Main shot
            self.bullets.push(Bullet {
                x: self.player_x,
                y: self.player_y - 15.0,
                vx: 0.0,
                vy: -BULLET_SPEED,
                alive: true,
            });

            // Side shots - spread in normal mode, straight in focus mode
            if self.focus_mode {
                // Focus mode: 3 parallel shots (no spread, faster fire rate)
                self.bullets.push(Bullet {
                    x: self.player_x - 10.0,
                    y: self.player_y - 10.0,
                    vx: 0.0,
                    vy: -BULLET_SPEED,
                    alive: true,
                });
                self.bullets.push(Bullet {
                    x: self.player_x + 10.0,
                    y: self.player_y - 10.0,
                    vx: 0.0,
                    vy: -BULLET_SPEED,
                    alive: true,
                });
                self.shoot_cooldown = PLAYER_FOCUS_SHOOT_COOLDOWN;
            } else {
                // Normal mode: spread shots (slower fire rate)
                self.bullets.push(Bullet {
                    x: self.player_x - 10.0,
                    y: self.player_y - 10.0,
                    vx: -30.0,
                    vy: -BULLET_SPEED,
                    alive: true,
                });
                self.bullets.push(Bullet {
                    x: self.player_x + 10.0,
                    y: self.player_y - 10.0,
                    vx: 30.0,
                    vy: -BULLET_SPEED,
                    alive: true,
                });
                self.shoot_cooldown = PLAYER_SHOOT_COOLDOWN;
            }

            if let Some(audio) = &mut self.audio {
                audio.play(&self.shoot_sound, 0.15, false);
            }
        }
    }

    fn spawn_explosion(&mut self, x: f32, y: f32, color: Color, size: f32) {
        self.explosions.push(Explosion {
            x,
            y,
            timer: 0.0,
            max_time: size * 0.015,
            color,
        });
    }

    fn check_collision(x1: f32, y1: f32, r1: f32, x2: f32, y2: f32, r2: f32) -> bool {
        let dx = x2 - x1;
        let dy = y2 - y1;
        let dist_sq = dx * dx + dy * dy;
        let radii = r1 + r2;
        dist_sq < radii * radii
    }

    fn reset_game(&mut self) {
        self.state = GameState::Playing;
        self.score = 0;
        self.lives = 3;
        self.wave = 1;
        self.wave_timer = 0.0;
        self.player_x = 400.0;
        self.player_y = 500.0;
        self.invincibility_timer = 2.0;
        self.bullets.clear();
        self.enemy_bullets.clear();
        self.enemies.clear();
        self.explosions.clear();
        self.spawn_timer = 0.0;
    }

    fn player_hit(&mut self) {
        if self.invincibility_timer > 0.0 {
            return;
        }

        self.lives -= 1;
        self.invincibility_timer = 2.0;

        // Clear nearby bullets as a mercy
        for bullet in &mut self.enemy_bullets {
            let dx = bullet.x - self.player_x;
            let dy = bullet.y - self.player_y;
            if dx * dx + dy * dy < 10000.0 {
                bullet.alive = false;
            }
        }

        self.spawn_explosion(self.player_x, self.player_y, Color::CYAN, 30.0);

        if let Some(audio) = &mut self.audio {
            audio.play(&self.explosion_sound, 0.4, false);
        }

        if self.lives <= 0 {
            self.state = GameState::GameOver;
        }
    }
}

impl Game for BulletHell {
    const WIDTH: u32 = 800;
    const HEIGHT: u32 = 600;

    fn new() -> Self {
        // Load audio
        let audio = AudioManager::new().ok();
        let shoot_sound = Sound::from_wav(include_bytes!("../assets/laser7.wav"))
            .expect("Failed to load shoot sound");
        let enemy_shoot_sound = Sound::from_wav(include_bytes!("../assets/laser10.wav"))
            .expect("Failed to load enemy shoot sound");
        let explosion_sound = Sound::from_wav(include_bytes!("../assets/laser12.wav"))
            .expect("Failed to load explosion sound");
        let enemy_hit_sound = Sound::from_wav(include_bytes!("../assets/laser1.wav"))
            .expect("Failed to load hit sound");

        // Load fonts
        let font = Font::from_bytes(include_bytes!("../assets/Ubuntu-Regular.ttf"))
            .expect("Failed to load font");
        let font_bold = Font::from_bytes(include_bytes!("../assets/Ubuntu-Bold.ttf"))
            .expect("Failed to load bold font");

        // Generate starfield
        let mut stars = Vec::with_capacity(100);
        for _ in 0..100 {
            stars.push(Star {
                x: rand_f32() * 800.0,
                y: rand_f32() * 600.0,
                speed: 20.0 + rand_f32() * 80.0,
                brightness: 50 + (rand_f32() * 150.0) as u8,
            });
        }

        Self {
            audio,
            shoot_sound,
            enemy_shoot_sound,
            explosion_sound,
            enemy_hit_sound,
            font,
            font_bold,
            state: GameState::Playing,
            score: 0,
            lives: 3,
            wave: 1,
            wave_timer: 0.0,
            invincibility_timer: 2.0,
            player_x: 400.0,
            player_y: 500.0,
            shoot_cooldown: 0.0,
            focus_mode: false,
            bullets: Vec::with_capacity(100),
            enemy_bullets: Vec::with_capacity(500),
            enemies: Vec::with_capacity(20),
            explosions: Vec::with_capacity(50),
            stars,
            time: 0.0,
            spawn_timer: 0.0,
        }
    }

    fn update(&mut self, dt: f32, input: &dyn Input) {
        self.time += dt;

        // Handle game over / pause input
        if self.state == GameState::GameOver {
            if input.is_action_just_pressed(Action::Action1) {
                self.reset_game();
            }
            return;
        }

        // Update stars (always)
        for star in &mut self.stars {
            star.y += star.speed * dt;
            if star.y > 600.0 {
                star.y = 0.0;
                star.x = rand_f32() * 800.0;
            }
        }

        // Update explosions (always)
        for explosion in &mut self.explosions {
            explosion.timer += dt;
        }
        self.explosions.retain(|e| e.timer < e.max_time);

        if self.state == GameState::Paused {
            return;
        }

        // Player movement
        self.focus_mode = input.is_action_pressed(Action::Action2);
        let speed = if self.focus_mode { PLAYER_FOCUS_SPEED } else { PLAYER_SPEED };

        let dir = input.direction();
        self.player_x += dir.x * speed * dt;
        self.player_y += dir.y * speed * dt;

        // Clamp player to screen
        self.player_x = self.player_x.clamp(20.0, 780.0);
        self.player_y = self.player_y.clamp(20.0, 580.0);

        // Shooting
        self.shoot_cooldown -= dt;
        if input.is_action_pressed(Action::Action1) {
            self.player_shoot();
        }

        // Update invincibility
        self.invincibility_timer -= dt;

        // Update player bullets
        for bullet in &mut self.bullets {
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;
            if bullet.y < -10.0 || bullet.x < -10.0 || bullet.x > 810.0 {
                bullet.alive = false;
            }
        }
        self.bullets.retain(|b| b.alive);

        // Update enemy bullets
        for bullet in &mut self.enemy_bullets {
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;
            if bullet.y > 620.0 || bullet.y < -20.0 || bullet.x < -20.0 || bullet.x > 820.0 {
                bullet.alive = false;
            }
        }
        self.enemy_bullets.retain(|b| b.alive);

        // Update enemies
        let player_x = self.player_x;
        let player_y = self.player_y;

        for enemy in &mut self.enemies {
            enemy.x += enemy.vx * dt;
            enemy.y += enemy.vy * dt;
            enemy.shoot_timer -= dt;
            enemy.pattern_timer += dt;
            enemy.angle += dt * 2.0;

            match enemy.enemy_type {
                EnemyType::Basic => {
                    if enemy.y > 620.0 {
                        enemy.alive = false;
                    }
                }
                EnemyType::Spinner => {
                    // Stop at y=100 and spin
                    if enemy.y >= 100.0 {
                        enemy.vy = 0.0;
                        enemy.y = 100.0;
                    }
                    // Leave after a while
                    if enemy.pattern_timer > 8.0 {
                        enemy.vy = -80.0;
                    }
                    if enemy.y < -50.0 {
                        enemy.alive = false;
                    }
                }
                EnemyType::Sweeper => {
                    // Move side to side
                    if enemy.y >= 80.0 {
                        enemy.vy = 0.0;
                        enemy.y = 80.0;
                        enemy.vx = 100.0 * (enemy.pattern_timer * 0.5).sin();
                    }
                    enemy.x = enemy.x.clamp(50.0, 750.0);
                    if enemy.pattern_timer > 10.0 {
                        enemy.vy = -60.0;
                    }
                    if enemy.y < -50.0 {
                        enemy.alive = false;
                    }
                }
                EnemyType::Boss => {
                    // Stop at y=120
                    if enemy.y >= 120.0 {
                        enemy.vy = 0.0;
                        enemy.y = 120.0;
                        // Slow side movement
                        enemy.vx = 50.0 * (enemy.pattern_timer * 0.3).sin();
                    }
                    enemy.x = enemy.x.clamp(100.0, 700.0);
                }
            }
        }

        // Enemy shooting (separate loop to avoid borrow issues)
        let mut new_bullets = Vec::new();
        let mut play_enemy_sound = false;

        for enemy in &self.enemies {
            if !enemy.alive || enemy.y < 0.0 {
                continue;
            }

            let should_shoot = enemy.shoot_timer <= 0.0;

            if should_shoot {
                play_enemy_sound = true;

                match enemy.enemy_type {
                    EnemyType::Basic => {
                        // Simple aimed shot
                        let dx = player_x - enemy.x;
                        let dy = player_y - enemy.y;
                        let dist = (dx * dx + dy * dy).sqrt().max(1.0);
                        new_bullets.push(EnemyBullet {
                            x: enemy.x,
                            y: enemy.y,
                            vx: dx / dist * 150.0,
                            vy: dy / dist * 150.0,
                            radius: ENEMY_BULLET_RADIUS,
                            color: Color::rgb(255, 100, 100),
                            alive: true,
                            from_boss: false,
                        });
                    }
                    EnemyType::Spinner => {
                        // Radial burst
                        let count = 8;
                        for i in 0..count {
                            let angle = enemy.angle + (i as f32 / count as f32) * std::f32::consts::TAU;
                            new_bullets.push(EnemyBullet {
                                x: enemy.x,
                                y: enemy.y,
                                vx: angle.cos() * 120.0,
                                vy: angle.sin() * 120.0,
                                radius: ENEMY_BULLET_RADIUS,
                                color: Color::rgb(255, 200, 50),
                                alive: true,
                                from_boss: false,
                            });
                        }
                    }
                    EnemyType::Sweeper => {
                        // Triple aimed shot
                        let dx = player_x - enemy.x;
                        let dy = player_y - enemy.y;
                        let base_angle = dy.atan2(dx);
                        for offset in [-0.2, 0.0, 0.2] {
                            let angle = base_angle + offset;
                            new_bullets.push(EnemyBullet {
                                x: enemy.x,
                                y: enemy.y,
                                vx: angle.cos() * 180.0,
                                vy: angle.sin() * 180.0,
                                radius: ENEMY_BULLET_RADIUS,
                                color: Color::rgb(100, 255, 100),
                                alive: true,
                                from_boss: false,
                            });
                        }
                    }
                    EnemyType::Boss => {
                        // Complex pattern based on pattern_timer
                        let pattern = ((enemy.pattern_timer * 0.5) as i32) % 3;
                        match pattern {
                            0 => {
                                // Radial burst
                                let count = 16;
                                for i in 0..count {
                                    let angle = enemy.angle + (i as f32 / count as f32) * std::f32::consts::TAU;
                                    new_bullets.push(EnemyBullet {
                                        x: enemy.x,
                                        y: enemy.y,
                                        vx: angle.cos() * 100.0,
                                        vy: angle.sin() * 100.0,
                                        radius: ENEMY_BULLET_RADIUS + 2.0,
                                        color: Color::rgb(255, 50, 255),
                                        alive: true,
                                        from_boss: true,
                                    });
                                }
                            }
                            1 => {
                                // Aimed spreads
                                let dx = player_x - enemy.x;
                                let dy = player_y - enemy.y;
                                let base_angle = dy.atan2(dx);
                                for offset in [-0.4, -0.2, 0.0, 0.2, 0.4] {
                                    let angle = base_angle + offset;
                                    new_bullets.push(EnemyBullet {
                                        x: enemy.x,
                                        y: enemy.y,
                                        vx: angle.cos() * 160.0,
                                        vy: angle.sin() * 160.0,
                                        radius: ENEMY_BULLET_RADIUS,
                                        color: Color::rgb(255, 100, 50),
                                        alive: true,
                                        from_boss: true,
                                    });
                                }
                            }
                            _ => {
                                // Side streams
                                for side in [-1.0, 1.0] {
                                    new_bullets.push(EnemyBullet {
                                        x: enemy.x + side * 40.0,
                                        y: enemy.y + 20.0,
                                        vx: side * 30.0,
                                        vy: 200.0,
                                        radius: ENEMY_BULLET_RADIUS,
                                        color: Color::rgb(50, 200, 255),
                                        alive: true,
                                        from_boss: true,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        // Reset shoot timers
        for enemy in &mut self.enemies {
            if enemy.shoot_timer <= 0.0 {
                enemy.shoot_timer = match enemy.enemy_type {
                    EnemyType::Basic => 1.5 + rand_f32() * 1.0,
                    EnemyType::Spinner => 0.3,
                    EnemyType::Sweeper => 0.8,
                    EnemyType::Boss => 0.2,
                };
            }
        }

        self.enemy_bullets.extend(new_bullets);

        if play_enemy_sound {
            if let Some(audio) = &mut self.audio {
                audio.play(&self.enemy_shoot_sound, 0.08, false);
            }
        }

        // Collision: player bullets vs enemies
        // Collect explosion events and score changes to avoid borrow issues
        let mut explosions_to_spawn: Vec<(f32, f32, f32)> = Vec::new();
        let mut score_to_add: u32 = 0;
        let mut lives_to_add: i32 = 0;
        let mut play_explosion = false;
        let mut play_hit = false;

        for bullet in &mut self.bullets {
            for enemy in &mut self.enemies {
                if !bullet.alive || !enemy.alive {
                    continue;
                }

                let enemy_radius = match enemy.enemy_type {
                    EnemyType::Boss => 40.0,
                    _ => 20.0,
                };

                if Self::check_collision(bullet.x, bullet.y, BULLET_RADIUS, enemy.x, enemy.y, enemy_radius) {
                    bullet.alive = false;
                    enemy.hp -= 1;

                    if enemy.hp <= 0 {
                        enemy.alive = false;
                        let points = match enemy.enemy_type {
                            EnemyType::Basic => 100,
                            EnemyType::Spinner => 250,
                            EnemyType::Sweeper => 200,
                            EnemyType::Boss => 2000,
                        };
                        score_to_add += points;

                        // Killing Spinner or Sweeper regenerates 1 life
                        if matches!(enemy.enemy_type, EnemyType::Spinner | EnemyType::Sweeper) {
                            lives_to_add += 1;
                        }

                        let size = match enemy.enemy_type {
                            EnemyType::Boss => 60.0,
                            _ => 25.0,
                        };
                        explosions_to_spawn.push((enemy.x, enemy.y, size));
                        play_explosion = true;
                    } else {
                        play_hit = true;
                    }
                }
            }
        }
        self.enemies.retain(|e| e.alive);

        // Apply deferred effects
        self.score += score_to_add;
        self.lives += lives_to_add;
        for (x, y, size) in explosions_to_spawn {
            self.spawn_explosion(x, y, Color::rgb(255, 200, 100), size);
        }
        if play_explosion {
            if let Some(audio) = &mut self.audio {
                audio.play(&self.explosion_sound, 0.3, false);
            }
        }
        if play_hit {
            if let Some(audio) = &mut self.audio {
                audio.play(&self.enemy_hit_sound, 0.1, false);
            }
        }

        // Collision: enemy bullets vs player
        let mut player_was_hit = false;
        let mut score_penalty: u32 = 0;
        for bullet in &mut self.enemy_bullets {
            if Self::check_collision(bullet.x, bullet.y, bullet.radius, self.player_x, self.player_y, PLAYER_RADIUS) {
                bullet.alive = false;
                if bullet.from_boss {
                    // Boss bullets don't damage but remove 100 score
                    score_penalty += 100;
                } else {
                    player_was_hit = true;
                }
            }
        }
        self.score = self.score.saturating_sub(score_penalty);

        // Collision: enemies vs player
        for enemy in &self.enemies {
            let enemy_radius = match enemy.enemy_type {
                EnemyType::Boss => 40.0,
                _ => 20.0,
            };
            if Self::check_collision(enemy.x, enemy.y, enemy_radius, self.player_x, self.player_y, PLAYER_RADIUS) {
                player_was_hit = true;
            }
        }

        if player_was_hit {
            self.player_hit();
        }

        // Wave/spawning logic
        self.wave_timer += dt;
        self.spawn_timer -= dt;

        if self.spawn_timer <= 0.0 {
            // Spawn enemies based on wave
            let enemy_type = if self.wave_timer > 30.0 && self.enemies.iter().all(|e| !matches!(e.enemy_type, EnemyType::Boss)) {
                // Spawn boss every 30 seconds
                self.wave_timer = 0.0;
                self.wave += 1;
                EnemyType::Boss
            } else {
                // Random enemy type based on wave
                let roll = rand_f32();
                if self.wave >= 3 && roll < 0.15 {
                    EnemyType::Sweeper
                } else if self.wave >= 2 && roll < 0.3 {
                    EnemyType::Spinner
                } else {
                    EnemyType::Basic
                }
            };

            self.spawn_enemy(enemy_type);

            // Spawn rate increases with wave
            self.spawn_timer = (2.0 - (self.wave as f32 * 0.1)).max(0.5) + rand_f32() * 1.0;
        }
    }

    fn draw(&mut self, r: &mut dyn Renderer) {
        // Background
        r.clear(Color::rgb(10, 10, 20));

        // Draw stars
        for star in &self.stars {
            r.fill_circle(
                Pos2::new(star.x, star.y),
                1.0 + (star.brightness as f32 / 255.0),
                Color::rgba(star.brightness, star.brightness, star.brightness, star.brightness),
            );
        }

        // Draw explosions
        for explosion in &self.explosions {
            let progress = explosion.timer / explosion.max_time;
            let radius = explosion.max_time * 100.0 * progress;
            let alpha = ((1.0 - progress) * 255.0) as u8;
            r.stroke_circle(
                Pos2::new(explosion.x, explosion.y),
                radius,
                Stroke::new(3.0, Color::rgba(explosion.color.r, explosion.color.g, explosion.color.b, alpha)),
            );
            r.stroke_circle(
                Pos2::new(explosion.x, explosion.y),
                radius * 0.6,
                Stroke::new(2.0, Color::rgba(255, 255, 255, alpha / 2)),
            );
        }

        // Draw enemies
        for enemy in &self.enemies {
            let (radius, color) = match enemy.enemy_type {
                EnemyType::Basic => (18.0, Color::rgb(200, 80, 80)),
                EnemyType::Spinner => (22.0, Color::rgb(200, 180, 50)),
                EnemyType::Sweeper => (20.0, Color::rgb(80, 200, 80)),
                EnemyType::Boss => (45.0, Color::rgb(200, 50, 200)),
            };

            // Enemy body
            r.fill_circle(Pos2::new(enemy.x, enemy.y), radius, color);
            r.stroke_circle(Pos2::new(enemy.x, enemy.y), radius, Stroke::new(2.0, Color::WHITE));

            // Health bar for boss
            if matches!(enemy.enemy_type, EnemyType::Boss) {
                let bar_width = 80.0;
                let hp_ratio = enemy.hp as f32 / enemy.max_hp as f32;
                r.fill_rect(
                    Rect::from_min_size(Pos2::new(enemy.x - bar_width / 2.0, enemy.y - 60.0), Vec2::new(bar_width, 8.0)),
                    Color::rgb(60, 60, 60),
                );
                r.fill_rect(
                    Rect::from_min_size(Pos2::new(enemy.x - bar_width / 2.0, enemy.y - 60.0), Vec2::new(bar_width * hp_ratio, 8.0)),
                    Color::rgb(255, 50, 50),
                );
            }
        }

        // Draw enemy bullets
        for bullet in &self.enemy_bullets {
            r.fill_circle(Pos2::new(bullet.x, bullet.y), bullet.radius, bullet.color);
            r.fill_circle(
                Pos2::new(bullet.x, bullet.y),
                bullet.radius * 0.5,
                Color::WHITE,
            );
        }

        // Draw player bullets
        for bullet in &self.bullets {
            r.fill_rect(
                Rect::from_min_size(
                    Pos2::new(bullet.x - 2.0, bullet.y - 8.0),
                    Vec2::new(4.0, 16.0),
                ),
                Color::CYAN,
            );
        }

        // Draw player
        let player_alpha = if self.invincibility_timer > 0.0 {
            ((self.time * 20.0).sin() * 0.5 + 0.5) * 255.0
        } else {
            255.0
        } as u8;

        // Ship body (triangle using path)
        r.begin_path();
        r.move_to(Pos2::new(self.player_x, self.player_y - 15.0));
        r.line_to(Pos2::new(self.player_x - 12.0, self.player_y + 12.0));
        r.line_to(Pos2::new(self.player_x + 12.0, self.player_y + 12.0));
        r.close_path();
        r.fill_path(Color::rgba(100, 200, 255, player_alpha));
        r.stroke_path(Stroke::new(2.0, Color::rgba(255, 255, 255, player_alpha)));

        // Hitbox indicator (always visible in focus mode)
        if self.focus_mode {
            r.fill_circle(
                Pos2::new(self.player_x, self.player_y),
                PLAYER_RADIUS,
                Color::rgba(255, 255, 255, 200),
            );
            r.stroke_circle(
                Pos2::new(self.player_x, self.player_y),
                PLAYER_RADIUS + 3.0,
                Stroke::new(1.0, Color::rgba(255, 255, 255, 100)),
            );
        }

        // UI
        let score_style = TextStyle::new(&self.font_bold, 24.0, Color::WHITE);
        r.draw_text(&format!("SCORE: {}", self.score), Pos2::new(20.0, 20.0), &score_style);

        let wave_style = TextStyle::new(&self.font, 18.0, Color::rgba(200, 200, 200, 200));
        r.draw_text(&format!("WAVE {}", self.wave), Pos2::new(20.0, 50.0), &wave_style);

        // Lives
        let lives_style = TextStyle::new(&self.font, 16.0, Color::WHITE);
        r.draw_text("LIVES:", Pos2::new(680.0, 20.0), &lives_style);
        for i in 0..self.lives {
            r.fill_circle(
                Pos2::new(740.0 + i as f32 * 18.0, 27.0),
                6.0,
                Color::CYAN,
            );
        }

        // Controls hint
        let hint_style = TextStyle::new(&self.font, 12.0, Color::rgba(150, 150, 150, 180));
        r.draw_text("WASD/Arrows: Move | Space: Shoot | Shift: Focus", Pos2::new(20.0, 580.0), &hint_style);

        // Game over screen
        if self.state == GameState::GameOver {
            // Darken background
            r.fill_rect(
                Rect::from_min_size(Pos2::new(0.0, 0.0), Vec2::new(800.0, 600.0)),
                Color::rgba(0, 0, 0, 180),
            );

            let gameover_style = TextStyle::new(&self.font_bold, 48.0, Color::RED);
            let text = "GAME OVER";
            let text_w = r.measure_text(text, &gameover_style).x;
            r.draw_text(text, Pos2::new(400.0 - text_w / 2.0, 250.0), &gameover_style);

            let final_score_style = TextStyle::new(&self.font, 24.0, Color::WHITE);
            let score_text = format!("Final Score: {}", self.score);
            let score_w = r.measure_text(&score_text, &final_score_style).x;
            r.draw_text(&score_text, Pos2::new(400.0 - score_w / 2.0, 320.0), &final_score_style);

            let restart_style = TextStyle::new(&self.font, 18.0, Color::rgba(200, 200, 200, ((self.time * 3.0).sin() * 0.3 + 0.7) as u8 * 255));
            let restart_text = "Press Space to restart";
            let restart_w = r.measure_text(restart_text, &restart_style).x;
            r.draw_text(restart_text, Pos2::new(400.0 - restart_w / 2.0, 380.0), &restart_style);
        }
    }
}

// Simple pseudo-random number generator (no external deps)
static mut RAND_STATE: u32 = 12345;

fn rand_f32() -> f32 {
    unsafe {
        RAND_STATE = RAND_STATE.wrapping_mul(1103515245).wrapping_add(12345);
        (RAND_STATE >> 16) as f32 / 65535.0
    }
}

fn main() {
    action_engine::run::<BulletHell>("Bullet Hell - ActionEngineRS");
}
