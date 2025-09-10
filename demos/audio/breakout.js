/**
 * ActionEngine Audio System Demo
 * 
 * Welcome to the ActionEngine Audio System demonstration! This breakout game serves as a
 * comprehensive showcase of ActionEngine's sophisticated audio synthesis capabilities.
 * 
 * ActionEngine simplifies game audio by providing multiple synthesis types, MIDI integration,
 * and powerful sound management - all without requiring external audio files. This demo shows
 * you how to use every audio feature ActionEngine provides.
 * 
 * ACTIONENGINE AUDIO SYNTHESIS TYPES:
 * ActionEngine provides four main synthesis methods for creating dynamic game audio:
 * 
 * 1. SWEEP SOUNDS - Frequency sweeps from start to end frequency
 * 
 * 2. COMPLEX SOUNDS - Multiple oscillators layered together
 * 
 * 3. FM SYNTHESIS - Frequency modulation for rich, dynamic timbres
 * 
 * 4. NOISE SYNTHESIS - Filtered noise for natural/percussive sounds
 * 
 * 5. MIDI INTEGRATION - High-quality sampled instruments
 * 
 * ACTIONENGINE AUDIO FEATURES:
 * - Automatic sound stacking prevention
 * - Individual volume control per sound
 * - Sound completion callbacks (onEnd)
 * - Flexible repeat and looping systems
 * - Real-time parameter control
 * - Master volume management
 */

/******* GAME CONFIGURATION CONSTANTS *******/
const BREAKOUT = {
    // ActionEngine requires these exact dimensions
    WIDTH: 800,
    HEIGHT: 600,
    
    // Game physics
    PHYSICS: {
        PADDLE_SPEED: 400,
        BALL_SPEED: 250,
        BALL_SPEED_INCREASE: 1.02,
        MAX_BALL_SPEED: 450,
        BOUNCE_RANDOMNESS: 0.1
    },
    
    // Visual configuration
    VISUAL: {
        PADDLE_WIDTH: 120,
        PADDLE_HEIGHT: 20,
        BALL_RADIUS: 8,
        BRICK_WIDTH: 70,
        BRICK_HEIGHT: 32,
        BRICK_PADDING: 4,
        PARTICLE_COUNT: 8,
        TRAIL_LENGTH: 6
    },
    
    // Three-layer color scheme with gradients
    COLORS: {
        GAME: {
            BACKGROUND: '#0f0f23',
            PADDLE: '#00d4ff',
            PADDLE_GLOW: '#0088cc',
            BALL: '#ffffff',
            BALL_TRAIL: '#66ddff',
            PARTICLE: '#ff6b35',
            
            // Brick colors for different audio frequencies
            BRICKS: {
                TOP: '#ff6b6b',      // High frequency - red
                UPPER: '#4ecdc4',    // Medium-high - teal  
                MIDDLE: '#45b7d1',   // Medium - blue
                LOWER: '#96ceb4',    // Medium-low - green
                BOTTOM: '#ffeaa7'    // Low frequency - yellow
            }
        },
        GUI: {
            TEXT: '#ffffff',
            PANEL_BG: 'rgba(15, 15, 35, 0.9)',
            BUTTON_IDLE: '#2d3748',
            BUTTON_HOVER: '#4a5568',
            BUTTON_ACTIVE: '#00d4ff',
            HUD_BG: 'rgba(0, 0, 0, 0.6)'
        },
        DEBUG: {
            BACKGROUND: 'rgba(0, 30, 0, 0.85)',
            TEXT: '#00ff41',
            HIGHLIGHT: '#ffff00',
            WARNING: '#ff6b6b'
        }
    },
    
    // Gameplay constants
    GAMEPLAY: {
        STARTING_LIVES: 3,
        BRICK_ROWS: 5,
        BRICK_COLS: 10,
        POINTS_PER_BRICK: 10,
        LEVEL_COMPLETE_BONUS: 1000,
        BALL_RESPAWN_TIME: 2.0
    },
    
    // Audio configuration - real ActionEngine features only
    AUDIO: {
        MASTER_VOLUME: 0.7,
        EFFECT_VOLUME: 0.8,
        MUSIC_VOLUME: 0.5,
        
        // Frequency ranges for different game elements
        FREQUENCIES: {
            PADDLE_HIT: { start: 220, end: 440 },
            WALL_BOUNCE: { start: 440, end: 880 },
            BRICK_BREAK: [262, 330, 392], // C major chord
            POWER_UP: [440, 554, 659, 880], // A major arpeggio
            BALL_LOST: { noise: 'brown', filter: 200 },
            VICTORY: [523, 659, 784, 1047] // C major scale up
        }
    },
    
    // UI layout for different layers
    UI: {
        HUD_MARGIN: 20,
        AUDIO_PANEL: { x: 520, y: 20, width: 260, height: 200 },
        DEBUG_PANEL: { x: 50, y: 80, width: 400, height: 420 },
        RESTART_BUTTON: { x: 300, y: 350, width: 200, height: 60 }
    }
};

/**
 * ActionEngine Game Class
 */
class Game {
    /******* ActionEngine Required Constants *******/
    static WIDTH = BREAKOUT.WIDTH;
    static HEIGHT = BREAKOUT.HEIGHT;
    
    /**
     * ActionEngine Game Constructor
     */
    constructor(canvases, input, audio) {
        /******* ActionEngine System References *******/
        this.input = input;
        this.audio = audio;
        
        /******* ActionEngine Three-Layer Canvas System *******/
        
        // Game layer: Your main content (2D context for this demo)
        this.gameCanvas = canvases.gameCanvas;
        this.gameCtx = this.gameCanvas.getContext('2d');
        this.guiCanvas = canvases.guiCanvas;
        this.guiCtx = canvases.guiCtx;
        this.debugCanvas = canvases.debugCanvas;
        this.debugCtx = canvases.debugCtx;
        
        /******* Game State *******/
        this.gameState = 'startScreen'; // 'startScreen' | 'playing' | 'gameOver' | 'victory' | 'ballLost'
        this.score = 0;
        this.lives = BREAKOUT.GAMEPLAY.STARTING_LIVES;
        this.level = 1;
        this.ballRespawnTimer = 0;
        this.frameCount = 0;
        this.lastTime = performance.now();
        
        /******* Debug State *******/
        this.debugOverlayVisible = false;
        
        /******* Audio State Tracking *******/
        // Track sound events for educational debug info
        this.soundHistory = [];
        this.maxSoundHistory = 10;
        
        /******* Game Objects *******/
        this.paddle = null;
        this.ball = null;
        this.bricks = [];
        this.particles = [];
        
        /******* Visual Effects *******/
        this.screenFlash = 0;
        this.audioVisualizer = {
            paddleGlow: 0,
            brickGlow: new Map(),
            ballGlow: 0
        };
        
        /******* Enhanced Graphics State *******/
        this.energyWaves = this.createEnergyWaves();
        this.animationTime = 0;

        this.levelTransition = { active: false, progress: 0 };
        
        /******* ActionEngine Audio System Setup *******/
        // This is the core focus of this demo - comprehensive audio integration
        this.setupComprehensiveAudioSystem();
        
        /******* Input Integration *******/
        this.setupInputSystem();
        
        /******* Initialize Game Content *******/
        // Game objects will be created when game starts
        
        console.log('ActionEngine Audio Demo Ready!');
        console.log('Demonstrating all synthesis types and enhanced 2D graphics');
    }
    
    /******* COMPREHENSIVE ACTIONENGINE AUDIO DEMONSTRATION *******/
    
    /**
     * Complete ActionEngine Audio System Setup
     * 
     * This method demonstrates every audio synthesis type ActionEngine provides.
     * Unlike external audio files, ActionEngine generates all sounds programmatically,
     * giving you complete control over every parameter and ensuring small file sizes.
     * 
     * ActionEngine's audio system is built on the Web Audio API but abstracts away
     * all the complexity, providing simple methods for complex sound synthesis.
     */
    setupComprehensiveAudioSystem() {
        /******* 1. SWEEP SOUND SYNTHESIS *******/
        // ActionEngine's createSweepSound() creates frequency sweeps
        // Perfect for movement, UI feedback, and projectile sounds
        
        // Paddle hit - classic arcade sweep with triangle wave
        this.audio.createSweepSound('paddle_hit', {
            startFreq: BREAKOUT.AUDIO.FREQUENCIES.PADDLE_HIT.start,
            endFreq: BREAKOUT.AUDIO.FREQUENCIES.PADDLE_HIT.end,
            type: 'triangle', // Options: 'sine', 'square', 'sawtooth', 'triangle'
            duration: 0.2,
            envelope: {
                attack: 0.01,  // How quickly sound starts
                decay: 0.05,   // How quickly it drops from peak
                sustain: 0.3,  // Level to sustain at (0-1)
                release: 0.14  // How quickly it fades to silence
            }
        });
        
        // Wall bounce - higher pitched ping
        this.audio.createSweepSound('wall_bounce', {
            startFreq: BREAKOUT.AUDIO.FREQUENCIES.WALL_BOUNCE.start,
            endFreq: BREAKOUT.AUDIO.FREQUENCIES.WALL_BOUNCE.end,
            type: 'sine',
            duration: 0.15,
            envelope: {
                attack: 0.01,
                decay: 0.14,
                sustain: 0,
                release: 0
            }
        });
        
        // Ball launch - dramatic upward sweep
        this.audio.createSweepSound('ball_launch', {
            startFreq: 200,
            endFreq: 800,
            type: 'sawtooth',
            duration: 0.4,
            envelope: {
                attack: 0.02,
                decay: 0.1,
                sustain: 0.6,
                release: 0.28
            }
        });
        
        /******* 2. COMPLEX SOUND SYNTHESIS *******/
        // ActionEngine's createComplexSound() layers multiple oscillators
        // Perfect for rich, harmonic sounds and chord-like effects
        
        // Brick break - harmonic chord based on brick position
        this.audio.createComplexSound('brick_break', {
            frequencies: BREAKOUT.AUDIO.FREQUENCIES.BRICK_BREAK, // C major chord
            types: ['sine', 'triangle', 'sine'], // Different wave types per oscillator
            mix: [0.4, 0.4, 0.2], // Volume mix for each oscillator
            duration: 0.3,
            envelope: {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.2,
                release: 0.19
            }
        });
        
        // Power-up style sound with ascending harmonies
        this.audio.createComplexSound('level_complete', {
            frequencies: BREAKOUT.AUDIO.FREQUENCIES.POWER_UP,
            types: ['sine', 'triangle', 'sine', 'triangle'],
            mix: [0.3, 0.3, 0.2, 0.2],
            duration: 0.8,
            envelope: {
                attack: 0.05,
                decay: 0.2,
                sustain: 0.4,
                release: 0.55
            }
        });
        
        // Victory fanfare - ascending major scale
        this.audio.createComplexSound('victory', {
            frequencies: BREAKOUT.AUDIO.FREQUENCIES.VICTORY,
            types: ['sine', 'sine', 'sine', 'sine'],
            mix: [0.3, 0.25, 0.25, 0.2],
            duration: 1.2,
            envelope: {
                attack: 0.1,
                decay: 0.3,
                sustain: 0.5,
                release: 0.8
            }
        });
        
        /******* 3. FM SYNTHESIS *******/
        // ActionEngine's createFMSound() uses frequency modulation
        // Perfect for metallic, bell-like, and evolving sounds
        
        // Special brick sound - metallic FM bell
        this.audio.createFMSound('special_brick', {
            carrierFreq: 660,    // Base frequency
            modulatorFreq: 330,  // Modulating frequency (half of carrier)
            modulationIndex: 80, // How intense the modulation is
            type: 'sine',
            duration: 0.5,
            envelope: {
                attack: 0.02,
                decay: 0.15,
                sustain: 0.3,
                release: 0.33
            }
        });
        
        // Game over sound - deep, evolving FM
        this.audio.createFMSound('game_over', {
            carrierFreq: 110,
            modulatorFreq: 55,
            modulationIndex: 120,
            type: 'triangle',
            duration: 1.5,
            envelope: {
                attack: 0.1,
                decay: 0.4,
                sustain: 0.6,
                release: 1.0
            }
        });
        
        /******* 4. NOISE SYNTHESIS *******/
        // ActionEngine's createNoiseSound() generates filtered noise
        // Perfect for percussion, explosions, and natural textures
        
        // Ball lost - dramatic brown noise crash
        this.audio.createNoiseSound('ball_lost', {
            noiseType: 'brown', // Options: 'white', 'pink', 'brown'
            duration: 0.6,
            envelope: {
                attack: 0.01,
                decay: 0.2,
                sustain: 0.2,
                release: 0.39
            },
            filterOptions: {
                frequency: BREAKOUT.AUDIO.FREQUENCIES.BALL_LOST.filter,
                Q: 2,        // Filter resonance
                type: 'lowpass' // Filter type
            }
        });
        
        // Explosion particle effect
        this.audio.createNoiseSound('explosion', {
            noiseType: 'white',
            duration: 0.4,
            envelope: {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.1,
                release: 0.29
            },
            filterOptions: {
                frequency: 800,
                Q: 1.5,
                type: 'bandpass'
            }
        });
        
        /******* 5. MIDI INTEGRATION *******/
        // ActionEngine's createSound() with SonicPi scripting provides MIDI instruments
        // This gives you access to high-quality sampled instruments
        
        // Victory music with full MIDI orchestra
        this.audio.createSound('victory_music', {
            script: `
                use_bpm 120
                
                sample :trumpet, note: 72, amp: 0.5
                sample :strings, note: 60, amp: 0.3, duration: 3
                sleep 0.5
                sample :trumpet, note: 76, amp: 0.5
                sample :strings, note: 64, amp: 0.3, duration: 2.5
                sleep 0.5
                sample :trumpet, note: 79, amp: 0.6
                sample :timpani, note: 48, amp: 0.4
                sleep 0.5
                sample :trumpet, note: 84, amp: 0.7, duration: 2
                sample :strings, note: 67, amp: 0.4, duration: 2
            `,
            samples: {
                'trumpet': {
                    soundType: 'midi',
                    instrument: 'trumpet',
                    amp: 0.5
                },
                'strings': {
                    soundType: 'midi', 
                    instrument: 'string_ensemble_1',
                    amp: 0.3
                },
                'timpani': {
                    soundType: 'midi',
                    instrument: 'timpani',
                    amp: 0.4
                }
            }
        }, 'sonicpi');
        
        /******* ACTIONENGINE AUDIO MANAGEMENT FEATURES *******/
        
        // Set master volume - affects all sounds
        this.audio.setVolume(BREAKOUT.AUDIO.MASTER_VOLUME);
        
        console.log('ActionEngine Audio: All synthesis types configured');
        console.log('Available: Sweep, Complex, FM, Noise, and MIDI synthesis');
    }
    
    /******* AUDIO-DRIVEN GAMEPLAY FEATURES *******/
    /**
     * Play sound with enhanced feedback
     * Demonstrates ActionEngine's callback system and automatic stacking prevention
     */
    playSound(soundName, options = {}) {
        // ActionEngine automatically prevents sound stacking - multiple calls to play
        // the same sound won't create overlapping instances
        
        const defaultOptions = {
            volume: BREAKOUT.AUDIO.EFFECT_VOLUME,
            onEnd: () => {
                this.logSoundEvent(`${soundName} completed`);
            }
        };
        
        const finalOptions = { ...defaultOptions, ...options };
        
        this.audio.play(soundName, finalOptions);
        this.logSoundEvent(`Playing: ${soundName}`);
        
        // Update visual feedback based on sound
        this.updateAudioVisualization(soundName);
    }
    
    /**
     * Log sound events for educational debug display
     */
    logSoundEvent(event) {
        const timestamp = new Date().toLocaleTimeString();
        this.soundHistory.unshift(`[${timestamp}] ${event}`);
        
        // Keep history manageable
        if (this.soundHistory.length > this.maxSoundHistory) {
            this.soundHistory.pop();
        }
    }
    
    /**
     * Update visual effects based on audio events
     * Creates audio-reactive graphics
     */
    updateAudioVisualization(soundName) {
        switch (soundName) {
            case 'paddle_hit':
                this.audioVisualizer.paddleGlow = 1.0;
                break;
            case 'brick_break':
            case 'special_brick':
                this.audioVisualizer.ballGlow = 0.8;
                break;
            case 'wall_bounce':
                this.audioVisualizer.ballGlow = 0.6;
                break;
        }
    }
    
    /******* INPUT SYSTEM SETUP *******/
    
    /**
     * Input setup including start screen button
     * This demo focuses on audio, so input is simpler than asteroids demo
     */
    setupInputSystem() {
        // Start button for initial screen
        this.startButton = {
            x: BREAKOUT.WIDTH / 2 - 120,
            y: BREAKOUT.HEIGHT / 2 + 50,
            width: 240,
            height: 60,
            hovered: false
        };
        
        // Register start button with input system
        this.input.registerElement('start_button', {
            bounds: () => ({
                x: this.startButton.x,
                y: this.startButton.y,
                width: this.startButton.width,
                height: this.startButton.height
            })
        });
        
        console.log('Input system ready - start screen and game controls');
    }
    
    /******* ACTIONENGINE FRAMEWORK HOOKS *******/
    
    /**
     * action_update() - ActionEngine Framework Hook
     */
    action_update() {
        // Calculate delta time for smooth movement
        const currentTime = performance.now();
        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.25);
        this.lastTime = currentTime;
        this.frameCount++;
        
        // Main update logic
        this.handleInput(deltaTime);
        this.updateGameObjects(deltaTime);
        this.updateTimers(deltaTime);
        
        if (this.gameState === 'playing') {
            this.checkCollisions();
            this.checkLevelComplete();
        }
        
        this.updateVisualEffects(deltaTime);
    }
    
    /**
     * action_draw() - ActionEngine Framework Hook
     */
    action_draw() {
        // Render across ActionEngine's three-layer system
        this.drawGameLayer();
        this.drawGUILayer();
        this.drawDebugLayer();
    }
    
    /******* INPUT HANDLING *******/
    
    handleInput(deltaTime) {
        // Handle debug toggle (works in all game states)
        if (this.input.isKeyJustPressed('ActionDebugToggle')) {
            this.debugOverlayVisible = !this.debugOverlayVisible;
            this.logSoundEvent(`Debug overlay ${this.debugOverlayVisible ? 'shown' : 'hidden'}`);
        }
        
        // Route input based on game state
        if (this.gameState === 'startScreen') {
            this.handleStartScreenInput();
        } else if (this.gameState === 'playing') {
            this.handleGameplayInput(deltaTime);
        } else if (this.gameState === 'gameOver' || this.gameState === 'victory') {
            this.handleGameOverInput();
        }
    }
    
    handleStartScreenInput() {
        // Check start button
        this.startButton.hovered = this.input.isElementHovered('start_button');
        
        if (this.input.isElementJustPressed('start_button') || this.input.isKeyJustPressed('Action1')) {
            this.startGame();
        }
    }
    
    handleGameplayInput(deltaTime) {
        // Only handle input if game objects exist
        if (!this.ball || !this.paddle) return;
        
        // Simple paddle control
        let paddleInput = 0;
        if (this.input.isKeyPressed('DirLeft')) paddleInput -= 1;
        if (this.input.isKeyPressed('DirRight')) paddleInput += 1;
        
        this.paddle.vx = paddleInput * BREAKOUT.PHYSICS.PADDLE_SPEED;
        this.paddle.x += this.paddle.vx * deltaTime;
        
        // Clamp paddle to screen
        this.paddle.x = Math.max(0, Math.min(BREAKOUT.WIDTH - this.paddle.width, this.paddle.x));
        
        // Ball launch
        if (this.ball.stuck && this.input.isKeyJustPressed('Action1')) {
            this.launchBall();
        }
        
        // Game state controls
        if (this.input.isKeyJustPressed('Action2')) {
            // Demonstrate volume control
            const currentVolume = this.audio.getVolume ? this.audio.getVolume() : BREAKOUT.AUDIO.MASTER_VOLUME;
            const newVolume = currentVolume > 0.5 ? 0.3 : 0.8;
            this.audio.setVolume(newVolume);
            this.logSoundEvent(`Volume changed to ${Math.round(newVolume * 100)}%`);
        }
        
        if (this.input.isKeyJustPressed('Action3')) {
            // Demonstrate stopping all sounds
            this.audio.stopAllSounds();
            this.logSoundEvent('All sounds stopped');
        }
    }
    
    handleGameOverInput() {
        if (this.input.isKeyJustPressed('Action1')) {
            this.resetGame();
        }
    }
    
    launchBall() {
        this.ball.stuck = false;
        this.ball.vx = BREAKOUT.PHYSICS.BALL_SPEED * (Math.random() - 0.5) * 1.5;
        this.ball.vy = -BREAKOUT.PHYSICS.BALL_SPEED;
        
        // Demonstrate sound with callback
        this.playSound('ball_launch', {
            onEnd: () => {
                console.log('Ball launch sound completed - ball is in play!');
            }
        });
    }
    
    /******* GRAPHICS UTILITIES *******/
    
    /**
     * Create animated energy wave background
     */
    createEnergyWaves() {
        const waves = [];
        
        // Create flowing energy streams
        for (let i = 0; i < 8; i++) {
            waves.push({
                x: Math.random() * BREAKOUT.WIDTH,
                y: -50,
                amplitude: Math.random() * 30 + 20,
                frequency: Math.random() * 0.02 + 0.01,
                speed: Math.random() * 40 + 20,
                phase: Math.random() * Math.PI * 2,
                width: Math.random() * 3 + 2,
                color: `hsl(${180 + Math.random() * 60}, 70%, ${30 + Math.random() * 20}%)`,
                opacity: Math.random() * 0.4 + 0.1
            });
        }
        
        // Add some geometric elements
        for (let i = 0; i < 12; i++) {
            waves.push({
                type: 'circle',
                x: Math.random() * BREAKOUT.WIDTH,
                y: Math.random() * BREAKOUT.HEIGHT,
                radius: Math.random() * 20 + 5,
                speed: Math.random() * 15 + 5,
                opacity: Math.random() * 0.1 + 0.05,
                rotation: 0,
                rotationSpeed: (Math.random() - 0.5) * 2,
                pulsePhase: Math.random() * Math.PI * 2,
                color: `hsl(${200 + Math.random() * 40}, 60%, 40%)`
            });
        }
        
        return waves;
    }
    
    /**
     * Draw rounded rectangle utility
     */
    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, radius);
    }
    
    /**
     * Create enhanced brick particles with rotation and color
     */
    createEnhancedBrickParticles(brick) {
        const particleCount = BREAKOUT.VISUAL.PARTICLE_COUNT + 4; // More particles
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
            const speed = Math.random() * 200 + 100;
            const size = Math.random() * 4 + 2;
            
            this.particles.push({
                x: brick.x + brick.width / 2,
                y: brick.y + brick.height / 2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 50, // Upward bias
                life: Math.random() * 0.8 + 0.6,
                maxLife: 1.4,
                color: brick.color,
                size: size,
                rotation: 0,
                rotationSpeed: (Math.random() - 0.5) * 10
            });
        }
    }
    

    
    /******* GAME LOGIC *******/
    
    createPaddle() {
        this.paddle = {
            x: BREAKOUT.WIDTH / 2 - BREAKOUT.VISUAL.PADDLE_WIDTH / 2,
            y: BREAKOUT.HEIGHT - 60,
            width: BREAKOUT.VISUAL.PADDLE_WIDTH,
            height: BREAKOUT.VISUAL.PADDLE_HEIGHT,
            vx: 0
        };
    }
    
    createBall() {
        this.ball = {
            x: BREAKOUT.WIDTH / 2,
            y: BREAKOUT.HEIGHT / 2,
            vx: 0,
            vy: 0,
            trail: [],
            stuck: true  // Ball starts stuck to paddle
        };
    }
    
    createBrickField() {
        this.bricks = [];
        const colors = Object.values(BREAKOUT.COLORS.GAME.BRICKS);
        
        // Calculate centered brick field positioning
        const totalBrickWidth = (BREAKOUT.GAMEPLAY.BRICK_COLS * BREAKOUT.VISUAL.BRICK_WIDTH) + 
                               ((BREAKOUT.GAMEPLAY.BRICK_COLS - 1) * BREAKOUT.VISUAL.BRICK_PADDING);
        const startX = (BREAKOUT.WIDTH - totalBrickWidth) / 2;
        
        for (let row = 0; row < BREAKOUT.GAMEPLAY.BRICK_ROWS; row++) {
            for (let col = 0; col < BREAKOUT.GAMEPLAY.BRICK_COLS; col++) {
                this.bricks.push({
                    x: startX + col * (BREAKOUT.VISUAL.BRICK_WIDTH + BREAKOUT.VISUAL.BRICK_PADDING),
                    y: row * (BREAKOUT.VISUAL.BRICK_HEIGHT + BREAKOUT.VISUAL.BRICK_PADDING) + 80,
                    width: BREAKOUT.VISUAL.BRICK_WIDTH,
                    height: BREAKOUT.VISUAL.BRICK_HEIGHT,
                    color: colors[row % colors.length],
                    row: row,
                    destroyed: false
                });
            }
        }
    }
    
    updateGameObjects(deltaTime) {
        // Only update if game objects exist
        if (!this.ball || !this.paddle) return;
        
        // Update ball
        if (!this.ball.stuck) {
            this.ball.x += this.ball.vx * deltaTime;
            this.ball.y += this.ball.vy * deltaTime;
            
            // Update ball trail
            this.ball.trail.push({ x: this.ball.x, y: this.ball.y });
            if (this.ball.trail.length > BREAKOUT.VISUAL.TRAIL_LENGTH) {
                this.ball.trail.shift();
            }
        } else {
            // Ball follows paddle when stuck
            this.ball.x = this.paddle.x + this.paddle.width / 2;
            this.ball.y = this.paddle.y - BREAKOUT.VISUAL.BALL_RADIUS * 2;
        }
    }
    
    updateTimers(deltaTime) {
        this.ballRespawnTimer = Math.max(0, this.ballRespawnTimer - deltaTime);
        
        // Respawn ball if needed
        if (this.ballRespawnTimer === 0 && this.gameState === 'ballLost') {
            this.respawnBall();
        }
    }
    
    updateVisualEffects(deltaTime) {
        this.animationTime += deltaTime;
        
        // Update enhanced particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.x += particle.vx * deltaTime;
            particle.y += particle.vy * deltaTime;
            particle.vx *= 0.98; // Air resistance
            particle.vy += 200 * deltaTime; // Gravity
            particle.life -= deltaTime;
            particle.rotation += particle.rotationSpeed * deltaTime;
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
        
        // Update animated energy waves
        this.energyWaves.forEach(wave => {
            if (wave.type === 'circle') {
                // Floating geometric elements
                wave.y -= wave.speed * deltaTime;
                wave.rotation += wave.rotationSpeed * deltaTime;
                wave.pulsePhase += deltaTime * 3;
                
                if (wave.y < -wave.radius * 2) {
                    wave.y = BREAKOUT.HEIGHT + wave.radius * 2;
                    wave.x = Math.random() * BREAKOUT.WIDTH;
                }
            } else {
                // Flowing energy streams
                wave.y += wave.speed * deltaTime;
                wave.phase += deltaTime * 2;
                
                if (wave.y > BREAKOUT.HEIGHT + 50) {
                    wave.y = -50;
                    wave.x = Math.random() * BREAKOUT.WIDTH;
                }
            }
        });
        

        
        // Update screen flash
        if (this.screenFlash > 0) {
            this.screenFlash -= deltaTime * 3;
            if (this.screenFlash < 0) this.screenFlash = 0;
        }
        
        // Update audio visualization glows
        this.audioVisualizer.paddleGlow *= 0.95;
        this.audioVisualizer.ballGlow *= 0.95;
        
        // Update level transition
        if (this.levelTransition.active) {
            this.levelTransition.progress += deltaTime * 2;
            if (this.levelTransition.progress >= 1) {
                this.levelTransition.active = false;
                this.levelTransition.progress = 0;
            }
        }
    }
    
    /******* COLLISION DETECTION WITH AUDIO *******/
    
    checkCollisions() {
        if (!this.ball || !this.paddle || this.ball.stuck) return;
        
        // Ball-paddle collision
        if (this.checkBallPaddleCollision()) {
            this.handlePaddleHit();
        }
        
        // Ball-brick collisions
        this.checkBallBrickCollisions();
        
        // Ball-wall collisions
        this.checkBallWallCollisions();
        
        // Ball lost
        if (this.ball.y > BREAKOUT.HEIGHT + 50) {
            this.handleBallLost();
        }
    }
    
    checkBallPaddleCollision() {
        return this.ball.x + BREAKOUT.VISUAL.BALL_RADIUS > this.paddle.x &&
               this.ball.x - BREAKOUT.VISUAL.BALL_RADIUS < this.paddle.x + this.paddle.width &&
               this.ball.y + BREAKOUT.VISUAL.BALL_RADIUS > this.paddle.y &&
               this.ball.y - BREAKOUT.VISUAL.BALL_RADIUS < this.paddle.y + this.paddle.height &&
               this.ball.vy > 0;
    }
    
    handlePaddleHit() {
        // Calculate hit position for angle variation
        const hitPos = (this.ball.x - this.paddle.x) / this.paddle.width;
        const angle = (hitPos - 0.5) * Math.PI / 3; // Max 60 degree angle
        
        const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
        this.ball.vx = Math.sin(angle) * speed;
        this.ball.vy = -Math.abs(Math.cos(angle) * speed);
        
        // Play paddle hit sound
        this.playSound('paddle_hit');
    }
    
    checkBallBrickCollisions() {
        for (let i = this.bricks.length - 1; i >= 0; i--) {
            const brick = this.bricks[i];
            if (brick.destroyed) continue;
            
            if (this.ball.x + BREAKOUT.VISUAL.BALL_RADIUS > brick.x &&
                this.ball.x - BREAKOUT.VISUAL.BALL_RADIUS < brick.x + brick.width &&
                this.ball.y + BREAKOUT.VISUAL.BALL_RADIUS > brick.y &&
                this.ball.y - BREAKOUT.VISUAL.BALL_RADIUS < brick.y + brick.height) {
                
                this.handleBrickHit(brick, i);
                break;
            }
        }
    }
    
    handleBrickHit(brick, index) {
        brick.destroyed = true;
        this.score += BREAKOUT.GAMEPLAY.POINTS_PER_BRICK;
        
        // Reverse ball direction
        this.ball.vy *= -1;
        
        // Add some randomness to prevent infinite loops
        this.ball.vx += (Math.random() - 0.5) * BREAKOUT.PHYSICS.BOUNCE_RANDOMNESS;
        
        // Play appropriate sound based on brick type
        if (brick.row === 0) {
            // Top row gets special FM sound
            this.playSound('special_brick');
        } else {
            // Regular brick break sound
            this.playSound('brick_break');
        }
        
        // Create enhanced particles
        this.createEnhancedBrickParticles(brick);
        
        // Slightly increase ball speed
        const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
        if (speed < BREAKOUT.PHYSICS.MAX_BALL_SPEED) {
            this.ball.vx *= BREAKOUT.PHYSICS.BALL_SPEED_INCREASE;
            this.ball.vy *= BREAKOUT.PHYSICS.BALL_SPEED_INCREASE;
        }
    }
    
    checkBallWallCollisions() {
        // Left/right walls
        if (this.ball.x <= BREAKOUT.VISUAL.BALL_RADIUS || 
            this.ball.x >= BREAKOUT.WIDTH - BREAKOUT.VISUAL.BALL_RADIUS) {
            this.ball.vx *= -1;
            this.ball.x = Math.max(BREAKOUT.VISUAL.BALL_RADIUS, 
                          Math.min(BREAKOUT.WIDTH - BREAKOUT.VISUAL.BALL_RADIUS, this.ball.x));
            
            this.playSound('wall_bounce');
        }
        
        // Top wall
        if (this.ball.y <= BREAKOUT.VISUAL.BALL_RADIUS) {
            this.ball.vy *= -1;
            this.ball.y = BREAKOUT.VISUAL.BALL_RADIUS;
            
            this.playSound('wall_bounce');
        }
    }
    
    handleBallLost() {
        this.lives--;
        this.gameState = 'ballLost';
        this.ballRespawnTimer = BREAKOUT.GAMEPLAY.BALL_RESPAWN_TIME;
        
        // Play dramatic ball lost sound
        this.playSound('ball_lost', {
            onEnd: () => {
                if (this.lives <= 0) {
                    this.gameState = 'gameOver';
                    this.handleGameOver();
                }
            }
        });
        
        this.screenFlash = 0.4;
    }
    
    handleGameOver() {
        // Play game over sound
        this.playSound('game_over');
    }
    
    respawnBall() {
        if (!this.paddle) return;
        
        this.ball.x = this.paddle.x + this.paddle.width / 2;
        this.ball.y = this.paddle.y - BREAKOUT.VISUAL.BALL_RADIUS * 2;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.ball.stuck = true;
        this.ball.trail = [];
        this.gameState = 'playing';
    }
    
    checkLevelComplete() {
        const remainingBricks = this.bricks.filter(brick => !brick.destroyed).length;
        
        if (remainingBricks === 0) {
            this.handleLevelComplete();
        }
    }
    
    handleLevelComplete() {
        this.score += BREAKOUT.GAMEPLAY.LEVEL_COMPLETE_BONUS;
        this.level++;
        this.gameState = 'victory';
        
        // Play victory sounds
        this.playSound('level_complete');
        
        setTimeout(() => {
            this.playSound('victory_music');
        }, 500);
    }
    
    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.lives = BREAKOUT.GAMEPLAY.STARTING_LIVES;
        this.level = 1;
        
        // Create game objects
        this.createPaddle();
        this.createBall();
        this.createBrickField();
        this.particles = [];
        this.screenFlash = 0;
        
        this.logSoundEvent('Game started!');
    }
    
    resetGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.lives = BREAKOUT.GAMEPLAY.STARTING_LIVES;
        this.level = 1;
        
        this.createBrickField();
        this.respawnBall();
        this.particles = [];
        this.screenFlash = 0;
        
        this.logSoundEvent('Game reset!');
    }
    
    /******* VISUAL EFFECTS *******/

    /******* ACTIONENGINE THREE-LAYER RENDERING *******/
    
    /**
     * Game Layer Rendering
     * 
     * This layer showcases filled graphics and visual effects,
     * different from the wireframe style used in the asteroids demo.
     */
    drawGameLayer() {
        // Clear with gradient background
        this.drawGradientBackground();
        
        // Only draw game objects when not on start screen
        if (this.gameState !== 'startScreen') {
            this.drawGameObjects();
        }
        
        this.drawParticles();
        
        // Screen flash effect (over everything)
        if (this.screenFlash > 0) {
            this.gameCtx.fillStyle = `rgba(255, 255, 255, ${this.screenFlash})`;
            this.gameCtx.fillRect(0, 0, BREAKOUT.WIDTH, BREAKOUT.HEIGHT);
        }
    }
    
    drawGradientBackground() {
        // Enhanced animated background
        const gradient = this.gameCtx.createRadialGradient(
            BREAKOUT.WIDTH / 2, BREAKOUT.HEIGHT / 2, 0,
            BREAKOUT.WIDTH / 2, BREAKOUT.HEIGHT / 2, BREAKOUT.WIDTH
        );
        
        // Animated color shifts
        const pulse = Math.sin(this.animationTime * 0.5) * 0.1;
        const r1 = Math.floor(15 + pulse * 10);
        const g1 = Math.floor(15 + pulse * 10);
        const b1 = Math.floor(35 + pulse * 20);
        
        gradient.addColorStop(0, `rgb(${r1}, ${g1}, ${b1})`);
        gradient.addColorStop(0.7, BREAKOUT.COLORS.GAME.BACKGROUND);
        gradient.addColorStop(1, '#0a0a20');
        
        this.gameCtx.fillStyle = gradient;
        this.gameCtx.fillRect(0, 0, BREAKOUT.WIDTH, BREAKOUT.HEIGHT);
        
        // Draw animated energy waves
        this.drawEnergyWaves();
    }
    
    /**
     * Draw animated energy waves and geometric elements
     */
    drawEnergyWaves() {
        this.gameCtx.save();
        
        this.energyWaves.forEach(wave => {
            if (wave.type === 'circle') {
                // Floating geometric elements
                const pulse = Math.sin(wave.pulsePhase) * 0.3 + 0.7;
                this.gameCtx.globalAlpha = wave.opacity * pulse;
                
                this.gameCtx.save();
                this.gameCtx.translate(wave.x, wave.y);
                this.gameCtx.rotate(wave.rotation);
                
                // Create gradient for depth
                const gradient = this.gameCtx.createRadialGradient(0, 0, 0, 0, 0, wave.radius * pulse);
                gradient.addColorStop(0, wave.color);
                gradient.addColorStop(0.7, wave.color.replace('40%)', '20%)'));
                gradient.addColorStop(1, 'transparent');
                
                this.gameCtx.fillStyle = gradient;
                this.gameCtx.beginPath();
                this.gameCtx.arc(0, 0, wave.radius * pulse, 0, Math.PI * 2);
                this.gameCtx.fill();
                
                // Add inner ring
                this.gameCtx.strokeStyle = wave.color;
                this.gameCtx.lineWidth = 1;
                this.gameCtx.beginPath();
                this.gameCtx.arc(0, 0, wave.radius * pulse * 0.6, 0, Math.PI * 2);
                this.gameCtx.stroke();
                
                this.gameCtx.restore();
            } else {
                // Flowing energy streams
                this.gameCtx.globalAlpha = wave.opacity;
                this.gameCtx.strokeStyle = wave.color;
                this.gameCtx.lineWidth = wave.width;
                this.gameCtx.lineCap = 'round';
                
                // Create flowing sine wave
                this.gameCtx.beginPath();
                let started = false;
                
                for (let x = 0; x <= BREAKOUT.WIDTH; x += 5) {
                    const waveY = wave.y + Math.sin(x * wave.frequency + wave.phase) * wave.amplitude;
                    
                    if (waveY >= -10 && waveY <= BREAKOUT.HEIGHT + 10) {
                        if (!started) {
                            this.gameCtx.moveTo(wave.x + x - BREAKOUT.WIDTH/2, waveY);
                            started = true;
                        } else {
                            this.gameCtx.lineTo(wave.x + x - BREAKOUT.WIDTH/2, waveY);
                        }
                    }
                }
                
                this.gameCtx.stroke();
                
                // Add glow effect
                this.gameCtx.shadowColor = wave.color;
                this.gameCtx.shadowBlur = 10;
                this.gameCtx.stroke();
                this.gameCtx.shadowBlur = 0;
            }
        });
        
        this.gameCtx.restore();
    }
    
    drawGameObjects() {
        // Only draw if game objects exist
        if (!this.ball || !this.paddle) return;
        
        // Draw ball trail
        if (this.ball.trail.length > 1) {
            this.gameCtx.strokeStyle = BREAKOUT.COLORS.GAME.BALL_TRAIL;
            this.gameCtx.lineWidth = 3;
            this.gameCtx.globalAlpha = 0.6;
            
            this.gameCtx.beginPath();
            this.gameCtx.moveTo(this.ball.trail[0].x, this.ball.trail[0].y);
            for (let i = 1; i < this.ball.trail.length; i++) {
                this.gameCtx.lineTo(this.ball.trail[i].x, this.ball.trail[i].y);
            }
            this.gameCtx.stroke();
            this.gameCtx.globalAlpha = 1;
        }
        
        // Draw paddle
        this.drawPaddle();
        
        // Draw ball
        this.drawBall();
        
        // Draw bricks
        this.bricks.forEach(brick => {
            if (!brick.destroyed) {
                this.drawBrick(brick);
            }
        });
    }
    
    drawPaddle() {
        this.gameCtx.save();
        
        const paddle = this.paddle;
        const radius = paddle.height / 2;
        
        // Audio-reactive glow
        if (this.audioVisualizer.paddleGlow > 0.1) {
            this.gameCtx.shadowColor = BREAKOUT.COLORS.GAME.PADDLE_GLOW;
            this.gameCtx.shadowBlur = this.audioVisualizer.paddleGlow * 25;
        }
        
        // 3D-style paddle with multiple gradients
        // Base shadow
        this.gameCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.drawRoundedRect(this.gameCtx, paddle.x + 2, paddle.y + 2, paddle.width, paddle.height, radius);
        this.gameCtx.fill();
        
        // Main body gradient (top to bottom)
        const mainGradient = this.gameCtx.createLinearGradient(
            paddle.x, paddle.y,
            paddle.x, paddle.y + paddle.height
        );
        mainGradient.addColorStop(0, '#00f0ff');
        mainGradient.addColorStop(0.3, BREAKOUT.COLORS.GAME.PADDLE);
        mainGradient.addColorStop(0.7, BREAKOUT.COLORS.GAME.PADDLE_GLOW);
        mainGradient.addColorStop(1, '#006699');
        
        this.gameCtx.fillStyle = mainGradient;
        this.drawRoundedRect(this.gameCtx, paddle.x, paddle.y, paddle.width, paddle.height, radius);
        this.gameCtx.fill();
        
        // Top highlight
        const highlightGradient = this.gameCtx.createLinearGradient(
            paddle.x, paddle.y,
            paddle.x, paddle.y + paddle.height * 0.4
        );
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        this.gameCtx.fillStyle = highlightGradient;
        this.drawRoundedRect(this.gameCtx, paddle.x, paddle.y, paddle.width, paddle.height * 0.4, radius);
        this.gameCtx.fill();
        
        // Border
        this.gameCtx.strokeStyle = '#003366';
        this.gameCtx.lineWidth = 1;
        this.drawRoundedRect(this.gameCtx, paddle.x, paddle.y, paddle.width, paddle.height, radius);
        this.gameCtx.stroke();
        
        this.gameCtx.restore();
    }
    
    drawBall() {
        this.gameCtx.save();
        
        // Audio-reactive glow
        if (this.audioVisualizer.ballGlow > 0.1) {
            this.gameCtx.shadowColor = BREAKOUT.COLORS.GAME.BALL;
            this.gameCtx.shadowBlur = this.audioVisualizer.ballGlow * 20;
        }
        
        // 3D sphere effect with radial gradient
        const ballGradient = this.gameCtx.createRadialGradient(
            this.ball.x - 2, this.ball.y - 2, 1,
            this.ball.x, this.ball.y, BREAKOUT.VISUAL.BALL_RADIUS
        );
        ballGradient.addColorStop(0, '#ffffff');
        ballGradient.addColorStop(0.3, '#f0f0f0');
        ballGradient.addColorStop(0.7, BREAKOUT.COLORS.GAME.BALL);
        ballGradient.addColorStop(1, '#cccccc');
        
        this.gameCtx.fillStyle = ballGradient;
        this.gameCtx.beginPath();
        this.gameCtx.arc(this.ball.x, this.ball.y, BREAKOUT.VISUAL.BALL_RADIUS, 0, Math.PI * 2);
        this.gameCtx.fill();
        
        // Highlight
        const highlightGradient = this.gameCtx.createRadialGradient(
            this.ball.x - 3, this.ball.y - 3, 0,
            this.ball.x - 3, this.ball.y - 3, 4
        );
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        this.gameCtx.fillStyle = highlightGradient;
        this.gameCtx.beginPath();
        this.gameCtx.arc(this.ball.x - 3, this.ball.y - 3, 4, 0, Math.PI * 2);
        this.gameCtx.fill();
        
        this.gameCtx.restore();
    }
    
    drawBrick(brick) {
        this.gameCtx.save();
        
        const radius = 4;
        
        // Drop shadow
        this.gameCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.drawRoundedRect(this.gameCtx, brick.x + 1, brick.y + 1, brick.width, brick.height, radius);
        this.gameCtx.fill();
        
        // Main brick gradient (3D effect)
        const gradient = this.gameCtx.createLinearGradient(
            brick.x, brick.y,
            brick.x, brick.y + brick.height
        );
        
        const baseColor = brick.color;
        const lightColor = this.lightenColor(baseColor, 0.3);
        const darkColor = this.darkenColor(baseColor, 0.2);
        
        gradient.addColorStop(0, lightColor);
        gradient.addColorStop(0.4, baseColor);
        gradient.addColorStop(1, darkColor);
        
        this.gameCtx.fillStyle = gradient;
        this.drawRoundedRect(this.gameCtx, brick.x, brick.y, brick.width, brick.height, radius);
        this.gameCtx.fill();
        
        // Top highlight
        const highlightGradient = this.gameCtx.createLinearGradient(
            brick.x, brick.y,
            brick.x, brick.y + brick.height * 0.3
        );
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        this.gameCtx.fillStyle = highlightGradient;
        this.drawRoundedRect(this.gameCtx, brick.x, brick.y, brick.width, brick.height * 0.3, radius);
        this.gameCtx.fill();
        
        // Border
        this.gameCtx.strokeStyle = this.darkenColor(baseColor, 0.4);
        this.gameCtx.lineWidth = 1;
        this.drawRoundedRect(this.gameCtx, brick.x, brick.y, brick.width, brick.height, radius);
        this.gameCtx.stroke();
        
        this.gameCtx.restore();
    }
    
    drawParticles() {
        this.gameCtx.save();
        
        this.particles.forEach(particle => {
            const alpha = particle.life / particle.maxLife;
            this.gameCtx.globalAlpha = alpha;
            
            this.gameCtx.save();
            this.gameCtx.translate(particle.x, particle.y);
            this.gameCtx.rotate(particle.rotation);
            
            // Gradient for each particle
            const particleGradient = this.gameCtx.createRadialGradient(
                0, 0, 0,
                0, 0, particle.size
            );
            particleGradient.addColorStop(0, particle.color || BREAKOUT.COLORS.GAME.PARTICLE);
            particleGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            this.gameCtx.fillStyle = particleGradient;
            this.gameCtx.fillRect(-particle.size, -particle.size, particle.size * 2, particle.size * 2);
            
            this.gameCtx.restore();
        });
        
        this.gameCtx.restore();
    }
    
    /**
     * GUI Layer Rendering
     * 
     * ActionEngine's GUI layer for UI elements and overlays.
     */
    drawGUILayer() {
        this.guiCtx.clearRect(0, 0, BREAKOUT.WIDTH, BREAKOUT.HEIGHT);
        
        if (this.gameState === 'startScreen') {
            this.drawStartScreen();
        } else {
            this.drawHUD();
            
            if (this.gameState === 'gameOver') {
                this.drawGameOver();
            } else if (this.gameState === 'victory') {
                this.drawVictory();
            } else if (this.gameState === 'ballLost') {
                this.drawBallLostMessage();
            }
        }
    }
    
    drawHUD() {
        // HUD background
        this.guiCtx.fillStyle = BREAKOUT.COLORS.GUI.HUD_BG;
        this.guiCtx.fillRect(0, 0, BREAKOUT.WIDTH, 50);
        
        // Game stats
        this.guiCtx.fillStyle = BREAKOUT.COLORS.GUI.TEXT;
        this.guiCtx.font = '20px Arial';
        this.guiCtx.textAlign = 'left';
        
        this.guiCtx.fillText(`Score: ${this.score}`, BREAKOUT.UI.HUD_MARGIN, 25);
        this.guiCtx.fillText(`Lives: ${this.lives}`, BREAKOUT.UI.HUD_MARGIN, 45);
        
        this.guiCtx.textAlign = 'right';
        this.guiCtx.fillText(`Level: ${this.level}`, BREAKOUT.WIDTH - BREAKOUT.UI.HUD_MARGIN, 25);
    }
    
    drawStartScreen() {
        // Title
        this.guiCtx.fillStyle = BREAKOUT.COLORS.GUI.TEXT;
        this.guiCtx.font = 'bold 48px Arial';
        this.guiCtx.textAlign = 'center';
        this.guiCtx.fillText('BREAKOUT', BREAKOUT.WIDTH / 2, BREAKOUT.HEIGHT / 2 - 80);
        
        // Subtitle
        this.guiCtx.font = '20px Arial';
        this.guiCtx.fillStyle = '#aaaaaa';
        this.guiCtx.fillText('ActionEngine Audio System Demo', BREAKOUT.WIDTH / 2, BREAKOUT.HEIGHT / 2 - 10);
        
        // Enhanced start button
        const button = this.startButton;
        this.drawEnhancedButton(this.guiCtx, button, 'START GAME');
        
        // Instructions
        this.guiCtx.fillStyle = '#888888';
        this.guiCtx.font = '16px Arial';
        this.guiCtx.fillText('Click button or press Action1 to start', BREAKOUT.WIDTH / 2, button.y + button.height + 40);
        
        // Game instructions
        this.guiCtx.font = '14px Arial';
        const instructions = [
            'Arrow Keys: Move Paddle • Action1: Launch Ball • Action2: Volume',
            'Action3: Stop All Sounds • ActionDebugToggle: Debug Audio Info'
        ];
        
        instructions.forEach((instruction, i) => {
            this.guiCtx.fillText(instruction, BREAKOUT.WIDTH / 2, BREAKOUT.HEIGHT - 80 + i * 18);
        });
    }
    
    drawGameOver() {
        // Overlay
        this.guiCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.guiCtx.fillRect(0, 0, BREAKOUT.WIDTH, BREAKOUT.HEIGHT);
        
        // Game over text
        this.guiCtx.fillStyle = '#ff4444';
        this.guiCtx.font = 'bold 48px Arial';
        this.guiCtx.textAlign = 'center';
        this.guiCtx.fillText('GAME OVER', BREAKOUT.WIDTH / 2, BREAKOUT.HEIGHT / 2 - 50);
        
        // Stats
        this.guiCtx.fillStyle = BREAKOUT.COLORS.GUI.TEXT;
        this.guiCtx.font = '24px Arial';
        this.guiCtx.fillText(`Final Score: ${this.score}`, BREAKOUT.WIDTH / 2, BREAKOUT.HEIGHT / 2);
        this.guiCtx.fillText(`Level Reached: ${this.level}`, BREAKOUT.WIDTH / 2, BREAKOUT.HEIGHT / 2 + 30);
        
        // Restart instruction
        this.guiCtx.font = '18px Arial';
        this.guiCtx.fillStyle = '#888888';
        this.guiCtx.fillText('Press Action1 to restart', BREAKOUT.WIDTH / 2, BREAKOUT.HEIGHT / 2 + 80);
    }
    
    drawVictory() {
        // Victory overlay
        this.guiCtx.fillStyle = 'rgba(0, 50, 0, 0.8)';
        this.guiCtx.fillRect(0, 0, BREAKOUT.WIDTH, BREAKOUT.HEIGHT);
        
        // Victory text
        this.guiCtx.fillStyle = '#44ff44';
        this.guiCtx.font = 'bold 48px Arial';
        this.guiCtx.textAlign = 'center';
        this.guiCtx.fillText('LEVEL COMPLETE!', BREAKOUT.WIDTH / 2, BREAKOUT.HEIGHT / 2 - 50);
        
        // Stats
        this.guiCtx.fillStyle = BREAKOUT.COLORS.GUI.TEXT;
        this.guiCtx.font = '24px Arial';
        this.guiCtx.fillText(`Score: ${this.score}`, BREAKOUT.WIDTH / 2, BREAKOUT.HEIGHT / 2);
        this.guiCtx.fillText(`Level ${this.level} Complete!`, BREAKOUT.WIDTH / 2, BREAKOUT.HEIGHT / 2 + 30);
        
        // Continue instruction
        this.guiCtx.font = '18px Arial';
        this.guiCtx.fillStyle = '#888888';
        this.guiCtx.fillText('Press Action1 to continue', BREAKOUT.WIDTH / 2, BREAKOUT.HEIGHT / 2 + 80);
    }
    
    drawBallLostMessage() {
        this.guiCtx.fillStyle = 'rgba(100, 0, 0, 0.7)';
        this.guiCtx.fillRect(0, BREAKOUT.HEIGHT / 2 - 40, BREAKOUT.WIDTH, 80);
        
        this.guiCtx.fillStyle = '#ff6666';
        this.guiCtx.font = 'bold 32px Arial';
        this.guiCtx.textAlign = 'center';
        this.guiCtx.fillText('BALL LOST!', BREAKOUT.WIDTH / 2, BREAKOUT.HEIGHT / 2 - 10);
        
        this.guiCtx.fillStyle = BREAKOUT.COLORS.GUI.TEXT;
        this.guiCtx.font = '18px Arial';
        this.guiCtx.fillText(`${this.lives} lives remaining`, BREAKOUT.WIDTH / 2, BREAKOUT.HEIGHT / 2 + 15);
    }
    
    /**
     * Debug Layer Rendering
     * 
     * ActionEngine's debug layer for development information.
     * This demo focuses on audio system debugging.
     */
    drawDebugLayer() {
        // Always clear first
        this.debugCtx.clearRect(0, 0, BREAKOUT.WIDTH, BREAKOUT.HEIGHT);
        
        // Only draw when debug overlay is visible (toggled with ActionDebugToggle)
        if (!this.debugOverlayVisible) return;
        
        const panel = BREAKOUT.UI.DEBUG_PANEL;
        
        // Debug panel background
        this.debugCtx.fillStyle = BREAKOUT.COLORS.DEBUG.BACKGROUND;
        this.debugCtx.fillRect(panel.x, panel.y, panel.width, panel.height);
        
        // Debug info
        this.debugCtx.fillStyle = BREAKOUT.COLORS.DEBUG.TEXT;
        this.debugCtx.font = '14px monospace';
        this.debugCtx.textAlign = 'left';
        
        const debugInfo = [
            'ActionEngine Audio System Debug',
            '',
            'SYNTHESIS TYPES IN USE:',
            '• Sweep: Frequency sweeps (paddle, walls)',
            '• Complex: Multi-oscillator (bricks, victory)',
            '• FM: Frequency modulation (special effects)',
            '• Noise: Filtered noise (explosions, impacts)',
            '• MIDI: Sampled instruments (music)',
            '',
            'AUDIO FEATURES:',
            '• Automatic sound stacking prevention',
            '• Individual volume control per sound',
            '• Sound completion callbacks',
            '',
            'RECENT SOUND EVENTS:'
        ];
        
        debugInfo.forEach((line, i) => {
            this.debugCtx.fillText(line, panel.x + 10, panel.y + 25 + i * 16);
        });
        
        // Recent sound history
        this.soundHistory.forEach((event, i) => {
            if (i < 8) { // Limit display
                this.debugCtx.fillStyle = i === 0 ? BREAKOUT.COLORS.DEBUG.HIGHLIGHT : BREAKOUT.COLORS.DEBUG.TEXT;
                this.debugCtx.fillText(event, panel.x + 10, panel.y + 25 + (debugInfo.length + i) * 16);
            }
        });
    }
    
    /******* UTILITY FUNCTIONS *******/
    
    /**
     * Enhanced button drawing with 3D effect
     */
    drawEnhancedButton(ctx, button, text) {
        ctx.save();
        
        const radius = 8;
        const depth = 4;
        
        // Button shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.drawRoundedRect(ctx, button.x + depth, button.y + depth, button.width, button.height, radius);
        ctx.fill();
        
        // Button gradient
        const gradient = ctx.createLinearGradient(
            button.x, button.y,
            button.x, button.y + button.height
        );
        
        if (button.hovered) {
            gradient.addColorStop(0, '#00f0ff');
            gradient.addColorStop(0.5, BREAKOUT.COLORS.GUI.BUTTON_HOVER);
            gradient.addColorStop(1, '#0088cc');
        } else {
            gradient.addColorStop(0, '#00d4ff');
            gradient.addColorStop(0.5, BREAKOUT.COLORS.GUI.BUTTON_ACTIVE);
            gradient.addColorStop(1, '#0099cc');
        }
        
        ctx.fillStyle = gradient;
        this.drawRoundedRect(ctx, button.x, button.y, button.width, button.height, radius);
        ctx.fill();
        
        // Button highlight
        const highlightGradient = ctx.createLinearGradient(
            button.x, button.y,
            button.x, button.y + button.height * 0.5
        );
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = highlightGradient;
        this.drawRoundedRect(ctx, button.x, button.y, button.width, button.height * 0.5, radius);
        ctx.fill();
        
        // Button border
        ctx.strokeStyle = '#003366';
        ctx.lineWidth = 2;
        this.drawRoundedRect(ctx, button.x, button.y, button.width, button.height, radius);
        ctx.stroke();
        
        // Button text with shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(text, button.x + button.width / 2 + 1, button.y + button.height / 2 + 9);
        
        ctx.fillStyle = BREAKOUT.COLORS.GUI.TEXT;
        ctx.fillText(text, button.x + button.width / 2, button.y + button.height / 2 + 8);
        
        ctx.restore();
    }
    
    /**
     * Utility function to darken colors for visual effects
     */
    darkenColor(color, factor) {
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * (1 - factor));
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * (1 - factor));
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * (1 - factor));
        
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
    }
    
    /**
     * Utility function to lighten colors for visual effects
     */
    lightenColor(color, factor) {
        const hex = color.replace('#', '');
        const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + (255 - parseInt(hex.substr(0, 2), 16)) * factor);
        const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + (255 - parseInt(hex.substr(2, 2), 16)) * factor);
        const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + (255 - parseInt(hex.substr(4, 2), 16)) * factor);
        
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
    }
}