/**
 * ActionEngine Input System Educational Demo
 * 
 * Welcome to the ActionEngine Input System demonstration! This asteroids game serves as a
 * comprehensive showcase of ActionEngine's sophisticated input handling capabilities.
 * 
 * ActionEngine simplifies game development by abstracting away input complexity while
 * providing powerful features like three-layer input priority, element registration,
 * and comprehensive mouse/keyboard support. This demo shows you how to use every
 * input feature ActionEngine provides.
 * 
 * THE THREE-LAYER INPUT SYSTEM:
 * ActionEngine uses a sophisticated three-layer input system that prevents UI conflicts:
 * 
 * DEBUG LAYER (Top Priority) -> GUI LAYER (Medium Priority) -> GAME LAYER (Low Priority)
 * 
 * When input events occur, they cascade through these layers. If an upper layer handles
 * the event (like clicking a debug button), lower layers won't receive it. This prevents
 * background elements from catching input meant for UI controls.
 */
 
/******* GAME CONFIGURATION CONSTANTS *******/
const ASTEROIDS = {
    // ActionEngine requires these exact dimensions
    WIDTH: 800,
    HEIGHT: 600,
    
    // Game physics
    PHYSICS: {
        SHIP_THRUST: 250,
        SHIP_MAX_SPEED: 300,
        SHIP_ROTATION_SPEED: 4.5,
        SHIP_FRICTION: 0.97,
        BULLET_SPEED: 400,
        BULLET_LIFETIME: 1.8,
        ASTEROID_MIN_SPEED: 20,
        ASTEROID_MAX_SPEED: 80
    },
    
    // Visual configuration
    VISUAL: {
        SHIP_SIZE: 10,
        BULLET_SIZE: 3,
        PARTICLE_COUNT: 12,
        TRAIL_LENGTH: 8,
        STARFIELD_DENSITY: 80,
        NUKE_RANGE: 150,
        
        // Screen effects
        NUKE_SHAKE_INTENSITY: 15,
        NUKE_SHAKE_DURATION: 1.0,
        SHIP_DEATH_SHAKE_INTENSITY: 8,
        SHIP_DEATH_SHAKE_DURATION: 0.6,
        EXPLOSION_PARTICLE_MULTIPLIER: 3
    },
    
    // Three-layer color scheme
    COLORS: {
        GAME: {
            BACKGROUND: '#000814',
            SHIP: '#00f5ff',
            SHIP_THRUST: '#ff6b35',
            BULLET: '#ffd60a', 
            ASTEROID: '#8d99ae',
            PARTICLE: '#ff7b00',
            TRAIL: '#00b4d8'
        },
        GUI: {
            TEXT: '#ffffff',
            PANEL_BG: 'rgba(8, 24, 40, 0.9)',
            BUTTON_IDLE: '#2a3d54',
            BUTTON_HOVER: '#3d5a80',
            BUTTON_ACTIVE: '#ee6c4d',
            BUTTON_DISABLED: '#1a1a1a'
        },
        DEBUG: {
            BACKGROUND: 'rgba(0, 20, 0, 0.85)',
            TEXT: '#00ff41',
            HIGHLIGHT: '#ffff00',
            WARNING: '#ff6b6b'
        }
    },
    
    // Gameplay constants
    GAMEPLAY: {
        STARTING_LIVES: 3,
        ASTEROID_COUNT: 6,
        POINTS_SMALL: 100,
        POINTS_MEDIUM: 50, 
        POINTS_LARGE: 20,
        NUKE_COST: 300,
        RESPAWN_TIME: 2.5
    },
    
    // UI layout for different layers
    UI: {
        HUD_MARGIN: 15,
        NUKE_BUTTON: { x: 650, y: 15, width: 130, height: 35 },
        WEAPON_PANEL: { x: 15, y: 450, width: 200, height: 120 },
        DEBUG_PANEL: { x: 450, y: 50, width: 330, height: 400 },
        DEBUG_RESET: { x: 600, y: 500, width: 120, height: 40 }
    }
};

/**
 * ActionEngine Game Class
 * 
 * This is the required ActionEngine Game class pattern. ActionEngine expects exactly
 * this class name and constructor signature. The framework will instantiate this
 * class and provide the three core systems: canvases, input, and audio.
 * 
 * ActionEngine handles all the complex setup - window management, canvas scaling,
 * input device detection, audio context creation, and more. You just implement
 * this class and ActionEngine takes care of everything else.
 */
class Game {
    /******* ActionEngine Required Constants *******/
	
	// ActionEngine uses a fixed coordinate system for reliable positioning
	// Your game should be designed for an 800x600 resolution
    // ActionEngine will handle proper canvas scaling across all devices
    static WIDTH = ASTEROIDS.WIDTH;
    static HEIGHT = ASTEROIDS.HEIGHT;
    
    /**
     * ActionEngine Game Constructor
     * 
     * ActionEngine requires this exact signature:
     * 
     * @param {Object} canvases - Three-layer canvas system
     *   - gameCanvas: Main content layer (you choose 2D or 3D context)
     *   - guiCanvas: UI overlay (always 2D)
     *   - debugCanvas: Development overlay (always 2D)
     *   - guiCtx: Pre-created 2D context for GUI layer
     *   - debugCtx: Pre-created 2D context for debug layer
     * 
     * @param {Object} input - ActionEngine's input management system
     *   Handles keyboard, mouse, touch, and element registration
     * 
     * @param {Object} audio - ActionEngine's audio synthesis system
     *   Provides multiple synthesis types and MIDI instrument support
     */
    constructor(canvases, input, audio) {
        /******* ActionEngine System References *******/
        // Store the systems ActionEngine provides
        this.input = input;
        this.audio = audio;
        
        /******* ActionEngine Three-Layer Canvas System *******/
        // ActionEngine provides three rendering layers with automatic scaling:
        
        // Game layer: Your main content (2D or 3D)
        this.gameCanvas = canvases.gameCanvas;
        this.gameCtx = this.gameCanvas.getContext('2d');
        
        // GUI layer: UI elements, always renders above game layer
        this.guiCanvas = canvases.guiCanvas;
        this.guiCtx = canvases.guiCtx; // ActionEngine provides this context
        
        // Debug layer: Development tools, renders above all
        this.debugCanvas = canvases.debugCanvas;
        this.debugCtx = canvases.debugCtx; // ActionEngine provides this context
        
        /******* Game State *******/
        this.gameState = 'startScreen'; // Start with intro screen
        this.score = 0;
        this.lives = ASTEROIDS.GAMEPLAY.STARTING_LIVES;
        this.level = 1;
        this.respawnTimer = 0;
        this.frameCount = 0;
        this.lastTime = performance.now();
        
        /******* Game Objects *******/
        this.ship = null;
        this.bullets = [];
        this.asteroids = [];
        this.particles = [];
        this.stars = [];
        
        /******* Visual Effects *******/
        this.screenFlash = 0; // Screen flash intensity (0-1)
        this.nukeCircle = { active: false, radius: 0, maxRadius: 0, x: 0, y: 0 };
        this.screenShake = { intensity: 0, duration: 0 };
        
        /******* ActionEngine Input System Setup *******/
        // This is where we demonstrate ActionEngine's comprehensive input capabilities
        this.setupActionEngineInputDemo();
        
        /******* Basic Audio Integration *******/
        this.setupAudio();
        
        /******* Initialize Game Content *******/
        this.createStarfield();
        // Ship and asteroids will be created when game starts
        
        console.log('ActionEngine Input Demo Ready!');
        console.log('Demonstrating three-layer input system and element registration');
    }
    
    /******* ACTIONENGINE INPUT SYSTEM DEMONSTRATION *******/
    
    /**
     * Comprehensive ActionEngine Input Setup
     * 
     * This method demonstrates every input feature ActionEngine provides:
     * - Element registration with bounds functions
     * - Three-layer input targeting (gui/debug/game)
     * - Hover state management
     * - Active/inactive element states
     * - Mouse button differentiation
     * - Input priority and event cascading
     * 
     * ActionEngine handles all the complexity - you just register elements and
     * check their states. No manual hit testing or coordinate transformation needed.
     */
    setupActionEngineInputDemo() {
        /******* GUI LAYER ELEMENTS *******/
        // GUI layer is the default for UI elements
        
        // Nuke Button - Demonstrates conditional element availability and right-click
        this.nukeButton = {
            id: 'nuke_button',
            ...ASTEROIDS.UI.NUKE_BUTTON,
            enabled: false,
            hovered: false
        };
        
        // Register with ActionEngine's input system
        // When you don't specify a layer, elements go to GUI layer (default)
        this.input.registerElement(this.nukeButton.id, {
            bounds: () => ({
                x: this.nukeButton.x,
                y: this.nukeButton.y,
                width: this.nukeButton.width,
                height: this.nukeButton.height
            })
        });
        
        // Weapon Selection Panel - Demonstrates multiple related elements
        this.weaponButtons = [
            {
                id: 'weapon_basic',
                name: 'Basic',
                x: ASTEROIDS.UI.WEAPON_PANEL.x + 10,
                y: ASTEROIDS.UI.WEAPON_PANEL.y + 30,
                width: 80,
                height: 25,
                selected: true,
                fireRate: 0.3
            },
            {
                id: 'weapon_rapid',
                name: 'Rapid',
                x: ASTEROIDS.UI.WEAPON_PANEL.x + 100,
                y: ASTEROIDS.UI.WEAPON_PANEL.y + 30,
                width: 80,
                height: 25,
                selected: false,
                fireRate: 0.15
            },
            {
                id: 'weapon_spread',
                name: 'Spread',
                x: ASTEROIDS.UI.WEAPON_PANEL.x + 10,
                y: ASTEROIDS.UI.WEAPON_PANEL.y + 65,
                width: 80,
                height: 25,
                selected: false,
                fireRate: 0.4
            }
        ];
        
        // Register all weapon buttons
        this.weaponButtons.forEach(button => {
            this.input.registerElement(button.id, {
                bounds: () => ({
                    x: button.x,
                    y: button.y,
                    width: button.width,
                    height: button.height
                })
            });
        });
        
        /******* START SCREEN BUTTON *******/
        // Button for starting the game from intro screen
        this.startButton = {
            id: 'start_game',
            x: ASTEROIDS.WIDTH / 2 - 120,
            y: ASTEROIDS.HEIGHT / 2 + 50,
            width: 240,
            height: 60,
            hovered: false
        };
        
        this.input.registerElement(this.startButton.id, {
            bounds: () => ({
                x: this.startButton.x,
                y: this.startButton.y,
                width: this.startButton.width,
                height: this.startButton.height
            })
        });
        
        /******* GAME OVER RESET BUTTON *******/
        // Button for restarting when game is over
        this.gameOverResetButton = {
            id: 'game_over_reset',
            x: ASTEROIDS.WIDTH / 2 - 100,
            y: ASTEROIDS.HEIGHT / 2 + 80,
            width: 200,
            height: 50,
            hovered: false
        };
        
        this.input.registerElement(this.gameOverResetButton.id, {
            bounds: () => ({
                x: this.gameOverResetButton.x,
                y: this.gameOverResetButton.y,
                width: this.gameOverResetButton.width,
                height: this.gameOverResetButton.height
            })
        });
        
        /******* DEBUG LAYER ELEMENTS *******/
        // Debug layer has highest input priority - these elements are processed first
        
        // Debug reset button - following original demo.js pattern
        this.debugResetButton = {
            x: ASTEROIDS.UI.DEBUG_RESET.x,
            y: ASTEROIDS.UI.DEBUG_RESET.y,
            width: ASTEROIDS.UI.DEBUG_RESET.width,
            height: ASTEROIDS.UI.DEBUG_RESET.height,
            hovered: false
        };
        
        // Debug info toggle button
        this.debugInfoButton = {
            x: ASTEROIDS.UI.DEBUG_PANEL.x + 10,
            y: ASTEROIDS.UI.DEBUG_PANEL.y + 350,
            width: 100,
            height: 30,
            hovered: false
        };
        
        // Register debug elements using simple string IDs like original demo
        this.input.registerElement(
            "debugResetButton",
            {
                bounds: () => ({
                    x: this.debugResetButton.x,
                    y: this.debugResetButton.y,
                    width: this.debugResetButton.width,
                    height: this.debugResetButton.height
                })
            },
            "debug"
        );
        
        this.input.registerElement(
            "debugInfoButton",
            {
                bounds: () => ({
                    x: this.debugInfoButton.x,
                    y: this.debugInfoButton.y,
                    width: this.debugInfoButton.width,
                    height: this.debugInfoButton.height
                })
            },
            "debug"
        );
        
        /******* GAME LAYER ELEMENTS *******/
        // Game layer has lowest priority - processed last in the cascade
        // We'll register asteroids as interactive elements here
        this.asteroidElements = new Map(); // Use Map for better tracking
        this.nextAsteroidId = 0; // Unique ID counter
        
        /******* Input State Tracking *******/
        this.currentWeapon = this.weaponButtons[0];
        this.fireTimer = 0;
        this.debugInfoVisible = true;
        this.debugOverlayVisible = false; // Track debug overlay state
        
        console.log('ActionEngine Input: Elements registered across all three layers');
    }
    
    /**
     * Register Asteroid as Interactive Game Element
     * 
     * Demonstrates dynamic element registration during gameplay.
     * ActionEngine allows you to register and unregister elements at any time.
     * 
     * @param {Object} asteroid - The asteroid game object
     */
    registerAsteroidElement(asteroid) {
        // Generate unique ID to avoid conflicts
        const elementId = `asteroid_${this.nextAsteroidId++}`;
        asteroid.elementId = elementId; // Store ID on asteroid for cleanup
        
        // Register on GAME layer (lowest priority)
        this.input.registerElement(elementId, {
            bounds: () => ({
                x: asteroid.x - asteroid.radius,
                y: asteroid.y - asteroid.radius,
                width: asteroid.radius * 2,
                height: asteroid.radius * 2
            })
        }, 'game'); // Explicit game layer targeting
        
        // Track for cleanup
        this.asteroidElements.set(elementId, asteroid);
    }
    
    /**
     * Clean up destroyed asteroid elements
     * Properly unregister elements from ActionEngine's input system
     */
    unregisterAsteroidElement(asteroid) {
        if (asteroid.elementId && this.asteroidElements.has(asteroid.elementId)) {
            // Remove from our tracking
            this.asteroidElements.delete(asteroid.elementId);
            // Note: ActionEngine automatically handles element cleanup when objects are removed
            console.log(`Unregistered asteroid element: ${asteroid.elementId}`);
        }
    }
    
    /******* BASIC AUDIO INTEGRATION *******/
    
    /**
     * Simple audio setup - this demo focuses on input, not audio
     * See the breakout demo for comprehensive audio system coverage
     */
    setupAudio() {
        this.audio.createSweepSound('shoot', {
            startFreq: 800, endFreq: 400, type: 'square', duration: 0.1,
            envelope: { attack: 0.01, decay: 0.09, sustain: 0, release: 0 }
        });
        
        this.audio.createComplexSound('explode', {
            frequencies: [150, 300, 450], types: ['sawtooth', 'triangle', 'sine'],
            mix: [0.5, 0.3, 0.2], duration: 0.4,
            envelope: { attack: 0.01, decay: 0.15, sustain: 0.2, release: 0.24 }
        });
        
        this.audio.createSweepSound('thrust', {
            startFreq: 120, endFreq: 180, type: 'triangle', duration: 0.1,
            envelope: { attack: 0.02, decay: 0.08, sustain: 0, release: 0 }
        });
        
        this.audio.createSweepSound('nuke', {
            startFreq: 60, endFreq: 400, type: 'sawtooth', duration: 1.0,
            envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.65 }
        });
    }
    
    /******* ACTIONENGINE FRAMEWORK HOOKS *******/
    
    /**
     * action_update() - ActionEngine Framework Hook
     * 
     * ActionEngine calls this method automatically each frame. You don't need to
     * set up a game loop or manage timing - ActionEngine handles all of that.
     * This is where you put your main game logic that runs every frame.
     * 
     * ActionEngine ensures this runs at a consistent rate and provides you with
     * a clean, predictable update cycle.
     */
    action_update() {
        // Calculate delta time for smooth movement
        const currentTime = performance.now();
        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.25);
        this.lastTime = currentTime;
        this.frameCount++;
        
        // Main update logic
        this.handleAllInputTypes(deltaTime);
        this.updateGameObjects(deltaTime);
        this.updateTimers(deltaTime);
        
        if (this.gameState === 'playing') {
            this.checkCollisions();
            this.checkLevelComplete();
        }
        
        this.updateEffects(deltaTime);
    }
    
    /**
     * action_draw() - ActionEngine Framework Hook
     * 
     * ActionEngine calls this method automatically each frame after action_update().
     * This is where you render to the three canvas layers ActionEngine provides.
     * 
     * ActionEngine handles canvas scaling, device pixel ratios, and ensures your
     * fixed 800x600 coordinate system works on any screen size.
     */
    action_draw() {
        // Render across ActionEngine's three-layer system
        this.drawGameLayer();
        this.drawGUILayer();
        this.drawDebugLayer();
    }
    
    /******* COMPREHENSIVE INPUT DEMONSTRATION *******/
    
    /**
     * Complete ActionEngine Input API Demonstration
     * 
     * This method showcases every input method ActionEngine provides:
     * - Continuous and edge-triggered keyboard input
     * - All mouse button variations (left, right, middle)
     * - Pointer position tracking
     * - Element interaction across all three layers
     * - Input priority and cascading
     */
    handleAllInputTypes(deltaTime) {
        /******* CONTINUOUS KEYBOARD INPUT *******/
        // ActionEngine's isKeyPressed() checks if a key is currently held down
        if (this.ship && this.gameState === 'playing') {
            if (this.input.isKeyPressed('DirLeft')) {
                this.ship.angle -= ASTEROIDS.PHYSICS.SHIP_ROTATION_SPEED * deltaTime;
            }
            if (this.input.isKeyPressed('DirRight')) {
                this.ship.angle += ASTEROIDS.PHYSICS.SHIP_ROTATION_SPEED * deltaTime;
            }
            
            // Ship thrust with physics
            this.ship.thrust = this.input.isKeyPressed('DirUp');
            if (this.ship.thrust) {
                const thrustX = Math.cos(this.ship.angle - Math.PI / 2) * ASTEROIDS.PHYSICS.SHIP_THRUST * deltaTime;
                const thrustY = Math.sin(this.ship.angle - Math.PI / 2) * ASTEROIDS.PHYSICS.SHIP_THRUST * deltaTime;
                
                this.ship.vx += thrustX;
                this.ship.vy += thrustY;
                
                // Limit max speed
                const speed = Math.sqrt(this.ship.vx * this.ship.vx + this.ship.vy * this.ship.vy);
                if (speed > ASTEROIDS.PHYSICS.SHIP_MAX_SPEED) {
                    this.ship.vx = (this.ship.vx / speed) * ASTEROIDS.PHYSICS.SHIP_MAX_SPEED;
                    this.ship.vy = (this.ship.vy / speed) * ASTEROIDS.PHYSICS.SHIP_MAX_SPEED;
                }
                
                this.audio.play('thrust', { volume: 0.01 });
            }
        }
        
        /******* EDGE-TRIGGERED KEYBOARD INPUT *******/
        // ActionEngine's isKeyJustPressed() detects the moment a key is pressed
        
        if (this.input.isKeyJustPressed('Action1')) {
            if (this.gameState === 'startScreen') {
                // Start game when Action1 pressed on start screen
                this.startGame();
            } else if (this.gameState === 'gameOver') {
                // Reset game when Action1 pressed during game over
                this.resetGame();
            } else if (this.ship && this.gameState === 'playing') {
                // Fire weapon during normal gameplay
                this.fireWeapon();
            }
        }
        
        /******* CONTINUOUS FIRING FOR RAPID WEAPON *******/
        // Allow rapid fire when Action1 is held down and rapid weapon is selected
        if (this.input.isKeyPressed('Action1') && this.ship && this.gameState === 'playing') {
            if (this.currentWeapon.name === 'Rapid' && this.fireTimer <= 0) {
                this.fireWeapon();
            }
        }
        
        // Demonstrate all Action keys
        if (this.input.isKeyJustPressed('Action2')) {
            console.log('Action2 pressed - cycling weapon');
            this.cycleWeapon();
        }
        
        if (this.input.isKeyJustPressed('Action3')) {
            console.log('Action3 pressed - spawn extra asteroid for testing');
            if (this.asteroids.length < 15) {
                const asteroid = this.createAsteroid('medium');
                this.asteroids.push(asteroid);
                this.registerAsteroidElement(asteroid, this.asteroids.length - 1);
            }
        }
        
        if (this.input.isKeyJustPressed('Action4')) {
            console.log('Action4 pressed - clear all bullets');
            this.bullets = [];
        }
        
        /******* COMPREHENSIVE MOUSE INPUT DEMONSTRATION *******/
        // ActionEngine provides detailed mouse button detection
        
        // Legacy pointer method (for compatibility)
        if (this.input.isPointerJustDown()) {
            console.log('Pointer down (legacy method)');
        }
        
        // Modern mouse button differentiation
        if (this.input.isLeftMouseButtonJustPressed()) {
            console.log('Left mouse button pressed');
            // Mouse click does not fire - only clicks on registered elements
        }
        
        if (this.input.isRightMouseButtonJustPressed()) {
            console.log('Right mouse button pressed');
            // Right-click activates nuke
            this.tryActivateNuke();
        }
        
        if (this.input.isMiddleMouseButtonJustPressed()) {
            console.log('Middle mouse button pressed');
            this.cycleWeapon();
        }
        
        // Generic button checking (0=left, 1=middle, 2=right)
        if (this.input.isMouseButtonJustPressed(0)) {
            console.log('Generic left button check');
        }
        
        // Continuous mouse states
        if (this.input.isLeftMouseButtonDown() && this.frameCount % 60 === 0) {
            console.log('Left button held (logged every second)');
        }
        
        /******* POINTER POSITION TRACKING *******/
        // ActionEngine provides precise coordinates in your game's coordinate space
        const pointer = this.input.getPointerPosition();
        
        // Mouse aiming (hold Action2 to aim toward pointer)
        if (this.input.isKeyPressed('Action2') && this.ship && this.gameState === 'playing') {
            const dx = pointer.x - this.ship.x;
            const dy = pointer.y - this.ship.y;
            const targetAngle = Math.atan2(dy, dx) + Math.PI / 2;
            
            let angleDiff = targetAngle - this.ship.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            this.ship.angle += angleDiff * 3 * deltaTime;
        }
        
        /******* THREE-LAYER INPUT PROCESSING *******/
        // ActionEngine processes input in layer priority order:
        // Debug (highest) -> GUI (medium) -> Game (lowest)
        
        this.handleDebugLayerInput();
        this.handleGUILayerInput();
        this.handleGameLayerInput();
        
        /******* SPECIAL ACTIONENGINE KEYS *******/
        // ActionEngine provides special system keys
        if (this.input.isKeyJustPressed('ActionDebugToggle')) {
            this.debugOverlayVisible = !this.debugOverlayVisible;
            
            // No need to set active state - elements work when registered
            
            console.log(`Debug overlay ${this.debugOverlayVisible ? 'shown' : 'hidden'} (F9)`);
        }
    }
    
    drawDebugControls() {
        // Reset button - following original demo.js drawing pattern
        this.debugCtx.fillStyle = this.debugResetButton.hovered ? '#ff6666' : '#ff4444';
        this.debugCtx.fillRect(this.debugResetButton.x, this.debugResetButton.y, this.debugResetButton.width, this.debugResetButton.height);
        
        this.debugCtx.strokeStyle = '#ffffff';
        this.debugCtx.lineWidth = 2;
        this.debugCtx.strokeRect(this.debugResetButton.x, this.debugResetButton.y, this.debugResetButton.width, this.debugResetButton.height);
        
        this.debugCtx.fillStyle = '#ffffff';
        this.debugCtx.font = '14px Arial';
        this.debugCtx.textAlign = 'center';
        this.debugCtx.fillText('RESET GAME', this.debugResetButton.x + this.debugResetButton.width / 2, this.debugResetButton.y + this.debugResetButton.height / 2 + 5);
        
        // Info toggle button
        this.debugCtx.fillStyle = this.debugInfoButton.hovered ? '#44aa44' : '#44ff44';
        this.debugCtx.fillRect(this.debugInfoButton.x, this.debugInfoButton.y, this.debugInfoButton.width, this.debugInfoButton.height);
        
        this.debugCtx.strokeStyle = '#ffffff';
        this.debugCtx.strokeRect(this.debugInfoButton.x, this.debugInfoButton.y, this.debugInfoButton.width, this.debugInfoButton.height);
        
        this.debugCtx.fillStyle = '#000000';
        this.debugCtx.font = '12px Arial';
        this.debugCtx.fillText(this.debugInfoVisible ? 'Hide Info' : 'Show Info', this.debugInfoButton.x + this.debugInfoButton.width / 2, this.debugInfoButton.y + this.debugInfoButton.height / 2 + 3);
    }
    
    /**
     * Check if pointer is over any UI element
     * Prevents firing when clicking on buttons
     */
    isClickingUI() {
        return (
            this.input.isElementHovered(this.nukeButton.id) ||
            this.weaponButtons.some(btn => this.input.isElementHovered(btn.id))
        );
    }
    
    /**
     * Debug Layer Input (Highest Priority)
     * 
     * ActionEngine processes debug layer input first. When the debug overlay
     * is visible (ActionDebugToggle key), these elements get input priority over everything else.
     */
    handleDebugLayerInput() {
        // Set debug element active states based on overlay visibility
        // Only allow interaction when debug overlay is shown
        this.input.setElementActive('debugResetButton', 'debug', this.debugOverlayVisible);
        this.input.setElementActive('debugInfoButton', 'debug', this.debugOverlayVisible);
        
        // Only process debug input when overlay is visible
        if (!this.debugOverlayVisible) return;
        
        // Handle debug reset button - using original demo.js pattern
        this.debugResetButton.hovered = this.input.isElementHovered("debugResetButton", "debug");
        
        if (this.input.isElementJustPressed("debugResetButton", "debug")) {
            this.resetGame();
        }
        
        // Handle debug info toggle
        this.debugInfoButton.hovered = this.input.isElementHovered("debugInfoButton", "debug");
        
        if (this.input.isElementJustPressed("debugInfoButton", "debug")) {
            this.debugInfoVisible = !this.debugInfoVisible;
        }
    }
    
    /**
     * GUI Layer Input (Medium Priority)
     * 
     * ActionEngine processes GUI layer input after debug layer but before game layer.
     * This is where most UI elements live.
     */
    handleGUILayerInput() {
        // Update nuke button state
        this.nukeButton.enabled = this.score >= ASTEROIDS.GAMEPLAY.NUKE_COST;
        this.nukeButton.hovered = this.input.isElementHovered(this.nukeButton.id);
        
        // ActionEngine's element active/inactive system
        this.input.setElementActive(this.nukeButton.id, 'gui', this.nukeButton.enabled);
        
        // Nuke button click handling
        if (this.input.isElementJustPressed(this.nukeButton.id)) {
            this.tryActivateNuke();
        }
        
        // Weapon selection buttons (only when playing)
        if (this.gameState === 'playing') {
            this.weaponButtons.forEach(button => {
                button.hovered = this.input.isElementHovered(button.id);
                
                if (this.input.isElementJustPressed(button.id)) {
                    // Deselect all weapons
                    this.weaponButtons.forEach(btn => btn.selected = false);
                    // Select this weapon
                    button.selected = true;
                    this.currentWeapon = button;
                    console.log(`Weapon changed to ${button.name}`);
                }
            });
        }
        
        // Start screen button
        if (this.gameState === 'startScreen') {
            this.startButton.hovered = this.input.isElementHovered(this.startButton.id);
            
            if (this.input.isElementJustPressed(this.startButton.id)) {
                this.startGame();
            }
        }
        
        // Game over reset button
        if (this.gameState === 'gameOver') {
            this.gameOverResetButton.hovered = this.input.isElementHovered(this.gameOverResetButton.id);
            
            if (this.input.isElementJustPressed(this.gameOverResetButton.id)) {
                this.resetGame();
            }
        }
    }
    
    /**
     * Game Layer Input (Lowest Priority)
     * 
     * ActionEngine processes game layer input last. These elements only receive
     * input if no higher priority layer handled it.
     */
    handleGameLayerInput() {
        // Check asteroid clicks using new Map-based system
        for (const [elementId, asteroid] of this.asteroidElements) {
            if (this.input.isElementJustPressed(elementId, 'game')) {
                console.log(`Asteroid ${elementId} clicked!`);
                this.destroyAsteroid(asteroid);
                break; // Only handle one click per frame
            }
        }
    }
    
    /**
     * Try to activate nuke (right-click only)
     */
    tryActivateNuke() {
        if (!this.nukeButton.enabled || !this.ship) return;
        
        this.score -= ASTEROIDS.GAMEPLAY.NUKE_COST;
        
        // Store ship position for nuke center
        const nukeX = this.ship.x;
        const nukeY = this.ship.y;
        
        // Destroy all asteroids within range
        const toDestroy = [];
        this.asteroids.forEach(asteroid => {
            const dx = asteroid.x - nukeX;
            const dy = asteroid.y - nukeY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= ASTEROIDS.VISUAL.NUKE_RANGE) {
                toDestroy.push(asteroid);
            }
        });
        
        toDestroy.forEach(asteroid => this.destroyAsteroid(asteroid));
        
        // NUKE VISUAL EFFECTS
        this.screenFlash = 1.0;
        
        // Expanding nuke circle animation
        this.nukeCircle = {
            active: true,
            radius: 0,
            maxRadius: ASTEROIDS.VISUAL.NUKE_RANGE,
            x: nukeX,
            y: nukeY
        };
        
        // Powerful screen shake
        this.screenShake = { 
            intensity: ASTEROIDS.VISUAL.NUKE_SHAKE_INTENSITY, 
            duration: ASTEROIDS.VISUAL.NUKE_SHAKE_DURATION 
        };
        
        this.audio.play('nuke');
        console.log(`Nuke destroyed ${toDestroy.length} asteroids`);
    }
    
    /**
     * Create spectacular ship explosion effect
     */
    createShipExplosion(x, y) {
        // Create lots of particles for dramatic ship explosion
        const particleCount = ASTEROIDS.VISUAL.PARTICLE_COUNT * ASTEROIDS.VISUAL.EXPLOSION_PARTICLE_MULTIPLIER;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = Math.random() * 200 + 100; // Faster than asteroid particles
            const size = Math.random() * 4 + 2;
            
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: Math.random() * 1.5 + 1.0,
                maxLife: 2.5,
                size: size,
                color: Math.random() > 0.5 ? ASTEROIDS.COLORS.GAME.SHIP_THRUST : ASTEROIDS.COLORS.GAME.PARTICLE
            });
        }
    }
    
    /******* GAME LOGIC *******/
    
    createStarfield() {
        this.stars = [];
        for (let i = 0; i < ASTEROIDS.VISUAL.STARFIELD_DENSITY; i++) {
            this.stars.push({
                x: Math.random() * ASTEROIDS.WIDTH,
                y: Math.random() * ASTEROIDS.HEIGHT,
                brightness: Math.random() * 0.8 + 0.2,
                twinkle: Math.random() * Math.PI * 2
            });
        }
    }
    
    spawnShip() {
        this.ship = {
            x: ASTEROIDS.WIDTH / 2,
            y: ASTEROIDS.HEIGHT / 2,
            vx: 0,
            vy: 0,
            angle: 0,
            thrust: false,
            trail: []
        };
    }
    
    createAsteroidField() {
        this.asteroids = [];
        this.asteroidElements.clear(); // Clear the Map
        
        for (let i = 0; i < ASTEROIDS.GAMEPLAY.ASTEROID_COUNT; i++) {
            const asteroid = this.createAsteroid('large');
            this.asteroids.push(asteroid);
            this.registerAsteroidElement(asteroid); // No index needed
        }
    }
    
    createAsteroid(size, x, y) {
        const sizes = { large: 30, medium: 20, small: 12 };
        
        const asteroid = {
            x: x ?? Math.random() * ASTEROIDS.WIDTH,
            y: y ?? Math.random() * ASTEROIDS.HEIGHT,
            vx: (Math.random() - 0.5) * ASTEROIDS.PHYSICS.ASTEROID_MAX_SPEED,
            vy: (Math.random() - 0.5) * ASTEROIDS.PHYSICS.ASTEROID_MAX_SPEED,
            angle: 0,
            rotation: (Math.random() - 0.5) * 3,
            size: size,
            radius: sizes[size],
            points: { large: 20, medium: 50, small: 100 }[size]
        };
        
        // Avoid spawning on ship
        if (this.ship) {
            const dx = asteroid.x - this.ship.x;
            const dy = asteroid.y - this.ship.y;
            if (Math.sqrt(dx * dx + dy * dy) < 80) {
                asteroid.x = Math.random() * ASTEROIDS.WIDTH;
                asteroid.y = Math.random() * ASTEROIDS.HEIGHT;
            }
        }
        
        return asteroid;
    }
    
    fireWeapon() {
        if (this.fireTimer > 0) return;
        
        this.fireTimer = this.currentWeapon.fireRate;
        
        if (this.currentWeapon.name === 'Spread') {
            // Fire three bullets in a spread
            for (let i = -1; i <= 1; i++) {
                const angle = this.ship.angle + i * 0.3;
                this.createBullet(angle);
            }
        } else {
            this.createBullet(this.ship.angle);
        }
        
        this.audio.play('shoot');
    }
    
    createBullet(angle) {
        this.bullets.push({
            x: this.ship.x + Math.cos(angle - Math.PI / 2) * ASTEROIDS.VISUAL.SHIP_SIZE,
            y: this.ship.y + Math.sin(angle - Math.PI / 2) * ASTEROIDS.VISUAL.SHIP_SIZE,
            vx: Math.cos(angle - Math.PI / 2) * ASTEROIDS.PHYSICS.BULLET_SPEED,
            vy: Math.sin(angle - Math.PI / 2) * ASTEROIDS.PHYSICS.BULLET_SPEED,
            life: ASTEROIDS.PHYSICS.BULLET_LIFETIME
        });
    }
    
    cycleWeapon() {
        const currentIndex = this.weaponButtons.indexOf(this.currentWeapon);
        const nextIndex = (currentIndex + 1) % this.weaponButtons.length;
        
        this.weaponButtons.forEach(btn => btn.selected = false);
        this.weaponButtons[nextIndex].selected = true;
        this.currentWeapon = this.weaponButtons[nextIndex];
    }
    
    destroyAsteroid(asteroid) {
        const index = this.asteroids.indexOf(asteroid);
        if (index === -1) return;
        
        // Clean up element BEFORE removing asteroid from array
        this.unregisterAsteroidElement(asteroid);
        
        // Remove from asteroid array
        this.asteroids.splice(index, 1);
        this.score += asteroid.points;
        
        // Create explosion particles
        for (let i = 0; i < ASTEROIDS.VISUAL.PARTICLE_COUNT; i++) {
            const angle = (Math.PI * 2 * i) / ASTEROIDS.VISUAL.PARTICLE_COUNT;
            this.particles.push({
                x: asteroid.x,
                y: asteroid.y,
                vx: Math.cos(angle) * 100,
                vy: Math.sin(angle) * 100,
                life: 1.0,
                maxLife: 1.0
            });
        }
        
        // Split large/medium asteroids
        if (asteroid.size === 'large') {
            for (let i = 0; i < 2; i++) {
                const newAsteroid = this.createAsteroid('medium', asteroid.x, asteroid.y);
                this.asteroids.push(newAsteroid);
                this.registerAsteroidElement(newAsteroid); // No index needed
            }
        } else if (asteroid.size === 'medium') {
            for (let i = 0; i < 2; i++) {
                const newAsteroid = this.createAsteroid('small', asteroid.x, asteroid.y);
                this.asteroids.push(newAsteroid);
                this.registerAsteroidElement(newAsteroid); // No index needed
            }
        }
        
        this.audio.play('explode');
    }
    
    updateGameObjects(deltaTime) {
        // Update ship (only if it exists)
        if (this.ship) {
            this.ship.x += this.ship.vx * deltaTime;
            this.ship.y += this.ship.vy * deltaTime;
            
            // Apply friction
            this.ship.vx *= ASTEROIDS.PHYSICS.SHIP_FRICTION;
            this.ship.vy *= ASTEROIDS.PHYSICS.SHIP_FRICTION;
            
            // Wrap around screen
            this.ship.x = (this.ship.x + ASTEROIDS.WIDTH) % ASTEROIDS.WIDTH;
            this.ship.y = (this.ship.y + ASTEROIDS.HEIGHT) % ASTEROIDS.HEIGHT;
            
            // Update trail
            this.ship.trail.push({ x: this.ship.x, y: this.ship.y });
            if (this.ship.trail.length > ASTEROIDS.VISUAL.TRAIL_LENGTH) {
                this.ship.trail.shift();
            }
        }
        
        // Update bullets (with ship existence check to prevent crash)
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.x += bullet.vx * deltaTime;
            bullet.y += bullet.vy * deltaTime;
            bullet.life -= deltaTime;
            
            // Wrap around screen
            bullet.x = (bullet.x + ASTEROIDS.WIDTH) % ASTEROIDS.WIDTH;
            bullet.y = (bullet.y + ASTEROIDS.HEIGHT) % ASTEROIDS.HEIGHT;
            
            if (bullet.life <= 0) {
                this.bullets.splice(i, 1);
            }
        }
        
        // Update asteroids
        this.asteroids.forEach(asteroid => {
            asteroid.x += asteroid.vx * deltaTime;
            asteroid.y += asteroid.vy * deltaTime;
            asteroid.angle += asteroid.rotation * deltaTime;
            
            // Wrap around screen
            asteroid.x = (asteroid.x + ASTEROIDS.WIDTH) % ASTEROIDS.WIDTH;
            asteroid.y = (asteroid.y + ASTEROIDS.HEIGHT) % ASTEROIDS.HEIGHT;
        });
    }
    
    updateTimers(deltaTime) {
        this.fireTimer = Math.max(0, this.fireTimer - deltaTime);
        this.respawnTimer = Math.max(0, this.respawnTimer - deltaTime);
        
        // Respawn ship if needed
        if (this.respawnTimer === 0 && !this.ship && this.lives > 0 && this.gameState === 'playing') {
            this.spawnShip();
        }
    }
    
    updateEffects(deltaTime) {
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.x += particle.vx * deltaTime;
            particle.y += particle.vy * deltaTime;
            particle.life -= deltaTime;
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
        
        // Update screen flash effect
        if (this.screenFlash > 0) {
            this.screenFlash -= deltaTime * 2; // Fade out quickly
            if (this.screenFlash < 0) this.screenFlash = 0;
        }
        
        // Update nuke circle expansion
        if (this.nukeCircle.active) {
            this.nukeCircle.radius += deltaTime * 300; // Expand quickly
            if (this.nukeCircle.radius >= this.nukeCircle.maxRadius) {
                this.nukeCircle.active = false;
            }
        }
        
        // Update screen shake
        if (this.screenShake.duration > 0) {
            this.screenShake.duration -= deltaTime;
            if (this.screenShake.duration <= 0) {
                this.screenShake.intensity = 0;
            }
        }
        
        // Update star twinkle
        this.stars.forEach(star => {
            star.twinkle += deltaTime * 2;
        });
    }
    
    checkCollisions() {
        if (!this.ship) return;
        
        // Bullet-asteroid collisions
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            for (let j = this.asteroids.length - 1; j >= 0; j--) {
                const asteroid = this.asteroids[j];
                
                const dx = bullet.x - asteroid.x;
                const dy = bullet.y - asteroid.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < asteroid.radius) {
                    this.bullets.splice(i, 1);
                    this.destroyAsteroid(asteroid);
                    break;
                }
            }
        }
        
        // Ship-asteroid collisions (only if ship exists)
        if (this.ship) {
            for (let i = 0; i < this.asteroids.length; i++) {
                const asteroid = this.asteroids[i];
                const dx = this.ship.x - asteroid.x;
                const dy = this.ship.y - asteroid.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < asteroid.radius + ASTEROIDS.VISUAL.SHIP_SIZE) {
                    this.destroyShip();
                    break; // Exit loop immediately after ship destruction
                }
            }
        }
    }
    
    destroyShip() {
        // Store ship position for explosion
        const shipX = this.ship.x;
        const shipY = this.ship.y;
        
        this.ship = null;
        this.lives--;
        this.respawnTimer = ASTEROIDS.GAMEPLAY.RESPAWN_TIME;
        
        // Create dramatic ship explosion
        this.createShipExplosion(shipX, shipY);
        
        // Screen shake effect
        this.screenShake = { 
            intensity: ASTEROIDS.VISUAL.SHIP_DEATH_SHAKE_INTENSITY, 
            duration: ASTEROIDS.VISUAL.SHIP_DEATH_SHAKE_DURATION 
        };
        
        // Brief screen flash
        this.screenFlash = 0.4;
        
        if (this.lives <= 0) {
            this.gameState = 'gameOver';
        }
        
        this.audio.play('explode');
    }
    
    checkLevelComplete() {
        if (this.asteroids.length === 0) {
            this.level++;
            this.createAsteroidField();
        }
    }
    
    startGame() {
        // Transition from start screen to gameplay
        this.gameState = 'playing';
        this.score = 0;
        this.lives = ASTEROIDS.GAMEPLAY.STARTING_LIVES;
        this.level = 1;
        this.spawnShip();
        this.createAsteroidField();
        this.bullets = [];
        this.particles = [];
        console.log('Game started!');
    }
    
    resetGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.lives = ASTEROIDS.GAMEPLAY.STARTING_LIVES;
        this.level = 1;
        this.spawnShip();
        this.createAsteroidField();
        this.bullets = [];
        this.particles = [];
    }
    
    /******* ACTIONENGINE THREE-LAYER RENDERING *******/
    
    /**
     * Game Layer Rendering
     * 
     * This is your main content layer. ActionEngine automatically scales this
     * to fit any screen while maintaining the 800x600 coordinate system.
     */
    drawGameLayer() {
        // Clear with space background
        this.gameCtx.fillStyle = ASTEROIDS.COLORS.GAME.BACKGROUND;
        this.gameCtx.fillRect(0, 0, ASTEROIDS.WIDTH, ASTEROIDS.HEIGHT);
        
        // Apply screen shake effect
        this.gameCtx.save();
        if (this.screenShake.intensity > 0) {
            const shakeX = (Math.random() - 0.5) * this.screenShake.intensity;
            const shakeY = (Math.random() - 0.5) * this.screenShake.intensity;
            this.gameCtx.translate(shakeX, shakeY);
        }
        
        this.drawStarfield();
        
        // Only draw game objects when not on start screen
        if (this.gameState !== 'startScreen') {
            this.drawGameObjects();
        }
        
        this.drawParticles();
        
        // Draw nuke expanding circle effect
        if (this.nukeCircle.active) {
            this.drawNukeCircle();
        }
        
        this.gameCtx.restore();
        
        // Draw screen flash effect (over everything)
        if (this.screenFlash > 0) {
            this.gameCtx.fillStyle = `rgba(255, 255, 255, ${this.screenFlash})`;
            this.gameCtx.fillRect(0, 0, ASTEROIDS.WIDTH, ASTEROIDS.HEIGHT);
        }
    }
    
    drawStarfield() {
        this.stars.forEach(star => {
            const brightness = star.brightness * (0.8 + 0.2 * Math.sin(star.twinkle));
            this.gameCtx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
            this.gameCtx.fillRect(star.x, star.y, 1, 1);
        });
    }
    
    drawGameObjects() {
        // Draw ship trail
        if (this.ship && this.ship.trail.length > 1) {
            this.gameCtx.strokeStyle = ASTEROIDS.COLORS.GAME.TRAIL;
            this.gameCtx.lineWidth = 2;
            this.gameCtx.globalAlpha = 0.5;
            
            this.gameCtx.beginPath();
            this.gameCtx.moveTo(this.ship.trail[0].x, this.ship.trail[0].y);
            for (let i = 1; i < this.ship.trail.length; i++) {
                this.gameCtx.lineTo(this.ship.trail[i].x, this.ship.trail[i].y);
            }
            this.gameCtx.stroke();
            this.gameCtx.globalAlpha = 1;
        }
        
        // Draw ship
        if (this.ship) {
            this.drawShip();
        }
        
        // Draw bullets
        this.gameCtx.fillStyle = ASTEROIDS.COLORS.GAME.BULLET;
        this.bullets.forEach(bullet => {
            this.gameCtx.beginPath();
            this.gameCtx.arc(bullet.x, bullet.y, ASTEROIDS.VISUAL.BULLET_SIZE, 0, Math.PI * 2);
            this.gameCtx.fill();
        });
        
        // Draw asteroids
        this.asteroids.forEach(asteroid => {
            this.drawAsteroid(asteroid);
        });
    }
    
    drawShip() {
        this.gameCtx.save();
        this.gameCtx.translate(this.ship.x, this.ship.y);
        this.gameCtx.rotate(this.ship.angle);
        
        // Ship body
        this.gameCtx.strokeStyle = ASTEROIDS.COLORS.GAME.SHIP;
        this.gameCtx.lineWidth = 2;
        this.gameCtx.beginPath();
        this.gameCtx.moveTo(0, -ASTEROIDS.VISUAL.SHIP_SIZE);
        this.gameCtx.lineTo(-ASTEROIDS.VISUAL.SHIP_SIZE * 0.7, ASTEROIDS.VISUAL.SHIP_SIZE);
        this.gameCtx.lineTo(0, ASTEROIDS.VISUAL.SHIP_SIZE * 0.7);
        this.gameCtx.lineTo(ASTEROIDS.VISUAL.SHIP_SIZE * 0.7, ASTEROIDS.VISUAL.SHIP_SIZE);
        this.gameCtx.closePath();
        this.gameCtx.stroke();
        
        // Thrust flame
        if (this.ship.thrust) {
            this.gameCtx.strokeStyle = ASTEROIDS.COLORS.GAME.SHIP_THRUST;
            this.gameCtx.beginPath();
            this.gameCtx.moveTo(-ASTEROIDS.VISUAL.SHIP_SIZE * 0.3, ASTEROIDS.VISUAL.SHIP_SIZE);
            this.gameCtx.lineTo(0, ASTEROIDS.VISUAL.SHIP_SIZE * 1.5);
            this.gameCtx.lineTo(ASTEROIDS.VISUAL.SHIP_SIZE * 0.3, ASTEROIDS.VISUAL.SHIP_SIZE);
            this.gameCtx.stroke();
        }
        
        this.gameCtx.restore();
    }
    
    drawAsteroid(asteroid) {
        this.gameCtx.save();
        this.gameCtx.translate(asteroid.x, asteroid.y);
        this.gameCtx.rotate(asteroid.angle);
        
        this.gameCtx.strokeStyle = ASTEROIDS.COLORS.GAME.ASTEROID;
        this.gameCtx.lineWidth = 2;
        this.gameCtx.beginPath();
        
        const points = 8;
        for (let i = 0; i < points; i++) {
            const angle = (Math.PI * 2 * i) / points;
            const radius = asteroid.radius * (0.8 + Math.sin(i * 1.3) * 0.2);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            if (i === 0) {
                this.gameCtx.moveTo(x, y);
            } else {
                this.gameCtx.lineTo(x, y);
            }
        }
        
        this.gameCtx.closePath();
        this.gameCtx.stroke();
        this.gameCtx.restore();
    }
    
    drawParticles() {
        this.particles.forEach(particle => {
            const alpha = particle.life / particle.maxLife;
            this.gameCtx.globalAlpha = alpha;
            
            // Use particle color if available, otherwise default
            this.gameCtx.fillStyle = particle.color || ASTEROIDS.COLORS.GAME.PARTICLE;
            this.gameCtx.beginPath();
            const size = particle.size || 2;
            this.gameCtx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
            this.gameCtx.fill();
        });
        this.gameCtx.globalAlpha = 1;
    }
    
    /**
     * Draw expanding nuke circle effect
     */
    drawNukeCircle() {
        const progress = this.nukeCircle.radius / this.nukeCircle.maxRadius;
        const alpha = 1 - progress; // Fade out as it expands
        
        this.gameCtx.save();
        this.gameCtx.globalAlpha = alpha * 0.8;
        
        // Outer bright circle
        this.gameCtx.strokeStyle = ASTEROIDS.COLORS.GAME.SHIP_THRUST;
        this.gameCtx.lineWidth = 6;
        this.gameCtx.beginPath();
        this.gameCtx.arc(this.nukeCircle.x, this.nukeCircle.y, this.nukeCircle.radius, 0, Math.PI * 2);
        this.gameCtx.stroke();
        
        // Inner energy circle
        this.gameCtx.globalAlpha = alpha * 0.3;
        this.gameCtx.fillStyle = ASTEROIDS.COLORS.GAME.SHIP_THRUST;
        this.gameCtx.beginPath();
        this.gameCtx.arc(this.nukeCircle.x, this.nukeCircle.y, this.nukeCircle.radius * 0.7, 0, Math.PI * 2);
        this.gameCtx.fill();
        
        this.gameCtx.restore();
    }
    
    /**
     * GUI Layer Rendering
     * 
     * ActionEngine's GUI layer renders above the game layer and is always 2D.
     * This layer is perfect for UI elements, HUD, menus, and overlays.
     */
    drawGUILayer() {
        this.guiCtx.clearRect(0, 0, ASTEROIDS.WIDTH, ASTEROIDS.HEIGHT);
        
        if (this.gameState === 'startScreen') {
            this.drawStartScreen();
        } else {
            this.drawHUD();
            this.drawWeaponPanel();
            this.drawNukeButton();
            
            if (this.gameState === 'gameOver') {
                this.drawGameOver();
            }
        }
    }
    
    drawHUD() {
        this.guiCtx.fillStyle = ASTEROIDS.COLORS.GUI.TEXT;
        this.guiCtx.font = '20px Arial';
        this.guiCtx.textAlign = 'left';
        
        this.guiCtx.fillText(`Score: ${this.score}`, ASTEROIDS.UI.HUD_MARGIN, 30);
        this.guiCtx.fillText(`Lives: ${this.lives}`, ASTEROIDS.UI.HUD_MARGIN, 55);
        this.guiCtx.fillText(`Level: ${this.level}`, ASTEROIDS.UI.HUD_MARGIN, 80);
    }
    
    drawWeaponPanel() {
        const panel = ASTEROIDS.UI.WEAPON_PANEL;
        
        // Panel background
        this.guiCtx.fillStyle = ASTEROIDS.COLORS.GUI.PANEL_BG;
        this.guiCtx.fillRect(panel.x, panel.y, panel.width, panel.height);
        
        // Title
        this.guiCtx.fillStyle = ASTEROIDS.COLORS.GUI.TEXT;
        this.guiCtx.font = '16px Arial';
        this.guiCtx.textAlign = 'left';
        this.guiCtx.fillText('Weapons', panel.x + 10, panel.y + 20);
        
        // Weapon buttons
        this.weaponButtons.forEach(button => {
            let bgColor;
            if (button.selected) {
                bgColor = ASTEROIDS.COLORS.GUI.BUTTON_ACTIVE;
            } else if (button.hovered) {
                bgColor = ASTEROIDS.COLORS.GUI.BUTTON_HOVER;
            } else {
                bgColor = ASTEROIDS.COLORS.GUI.BUTTON_IDLE;
            }
            
            this.guiCtx.fillStyle = bgColor;
            this.guiCtx.fillRect(button.x, button.y, button.width, button.height);
            
            this.guiCtx.strokeStyle = ASTEROIDS.COLORS.GUI.TEXT;
            this.guiCtx.lineWidth = 1;
            this.guiCtx.strokeRect(button.x, button.y, button.width, button.height);
            
            this.guiCtx.fillStyle = ASTEROIDS.COLORS.GUI.TEXT;
            this.guiCtx.font = '12px Arial';
            this.guiCtx.textAlign = 'center';
            this.guiCtx.fillText(button.name, button.x + button.width / 2, button.y + button.height / 2 + 3);
        });
    }
    
    drawNukeButton() {
        const button = this.nukeButton;
        
        let bgColor, textColor;
        if (button.enabled) {
            bgColor = button.hovered ? ASTEROIDS.COLORS.GUI.BUTTON_HOVER : ASTEROIDS.COLORS.GUI.BUTTON_ACTIVE;
            textColor = ASTEROIDS.COLORS.GUI.TEXT;
        } else {
            bgColor = ASTEROIDS.COLORS.GUI.BUTTON_DISABLED;
            textColor = '#666666';
        }
        
        this.guiCtx.fillStyle = bgColor;
        this.guiCtx.fillRect(button.x, button.y, button.width, button.height);
        
        this.guiCtx.strokeStyle = textColor;
        this.guiCtx.lineWidth = 2;
        this.guiCtx.strokeRect(button.x, button.y, button.width, button.height);
        
        this.guiCtx.fillStyle = textColor;
        this.guiCtx.font = 'bold 14px Arial';
        this.guiCtx.textAlign = 'center';
        this.guiCtx.fillText('NUKE', button.x + button.width / 2, button.y + button.height / 2 - 3);
        this.guiCtx.font = '10px Arial';
        this.guiCtx.fillText('(Right Click)', button.x + button.width / 2, button.y + button.height / 2 + 12);
        this.guiCtx.fillText(`${ASTEROIDS.GAMEPLAY.NUKE_COST} pts`, button.x + button.width / 2, button.y + button.height / 2 + 29);
    }
    
    drawInstructions() {
        this.guiCtx.fillStyle = '#888888';
        this.guiCtx.font = '14px Arial';
        this.guiCtx.textAlign = 'center';
        
        const instructions = [
            'Arrow Keys: Move • Action1: Fire • Action2: Mouse Aim',
            'Left Click: Fire • Right Click: Nuke • Middle Click: Cycle Weapon',
            'Click asteroids to destroy • F9: Debug overlay'
        ];
        
        instructions.forEach((instruction, i) => {
            this.guiCtx.fillText(instruction, ASTEROIDS.WIDTH / 2, ASTEROIDS.HEIGHT - 60 + i * 18);
        });
    }
    
    /**
     * Draw start screen with title and start button
     */
    drawStartScreen() {
        // Clear everything
        this.guiCtx.clearRect(0, 0, ASTEROIDS.WIDTH, ASTEROIDS.HEIGHT);
        
        // Title
        this.guiCtx.save();
        this.guiCtx.fillStyle = ASTEROIDS.COLORS.GUI.TEXT;
        this.guiCtx.font = 'bold 64px Arial';
        this.guiCtx.textAlign = 'center';
        this.guiCtx.textBaseline = 'middle';
        
        // Main title with shadow effect
        this.guiCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.guiCtx.fillText('ASTEROIDS', ASTEROIDS.WIDTH / 2 + 3, ASTEROIDS.HEIGHT / 2 - 47);
        
        this.guiCtx.fillStyle = ASTEROIDS.COLORS.GAME.SHIP;
        this.guiCtx.fillText('ASTEROIDS', ASTEROIDS.WIDTH / 2, ASTEROIDS.HEIGHT / 2 - 50);
        
        // Subtitle
        this.guiCtx.fillStyle = ASTEROIDS.COLORS.GUI.TEXT;
        this.guiCtx.font = '20px Arial';
        this.guiCtx.fillText('ActionEngine Input System Demo', ASTEROIDS.WIDTH / 2, ASTEROIDS.HEIGHT / 2 - 10);
        
        this.guiCtx.restore();
        
        // Draw start button
        const button = this.startButton;
        
        // Button background with hover effect
        this.guiCtx.fillStyle = button.hovered ? ASTEROIDS.COLORS.GUI.BUTTON_HOVER : ASTEROIDS.COLORS.GUI.BUTTON_ACTIVE;
        this.guiCtx.fillRect(button.x, button.y, button.width, button.height);
        
        // Button border
        this.guiCtx.strokeStyle = ASTEROIDS.COLORS.GUI.TEXT;
        this.guiCtx.lineWidth = 3;
        this.guiCtx.strokeRect(button.x, button.y, button.width, button.height);
        
        // Button text
        this.guiCtx.fillStyle = ASTEROIDS.COLORS.GUI.TEXT;
        this.guiCtx.font = 'bold 24px Arial';
        this.guiCtx.textAlign = 'center';
        this.guiCtx.fillText('START GAME', button.x + button.width / 2, button.y + button.height / 2 + 8);
        
        // Instructions
        this.guiCtx.fillStyle = '#888888';
        this.guiCtx.font = '16px Arial';
        this.guiCtx.fillText('Click button or press Action1 to start', ASTEROIDS.WIDTH / 2, button.y + button.height + 40);
        
        // Demo info at top
        this.guiCtx.font = '16px Arial';
        this.guiCtx.fillStyle = '#aaaaaa';
        this.guiCtx.fillText('Comprehensive demonstration of ActionEngine\'s three-layer input system', ASTEROIDS.WIDTH / 2, 80);
        this.guiCtx.fillText('Featuring element registration, mouse buttons, and layer priority', ASTEROIDS.WIDTH / 2, 100);
        
        // Game instructions
        this.guiCtx.font = '14px Arial';
        this.guiCtx.fillStyle = '#888888';
        const instructions = [
            'Arrow Keys: Move • Action1: Fire • Action2: Mouse Aim',
            'Left Click: Fire • Right Click: Nuke • Middle Click: Cycle Weapon',
            'Click asteroids to destroy • ActionDebugToggle: Debug overlay'
        ];
        
        instructions.forEach((instruction, i) => {
            this.guiCtx.fillText(instruction, ASTEROIDS.WIDTH / 2, ASTEROIDS.HEIGHT - 80 + i * 18);
        });
    }
    
    drawGameOver() {
        this.guiCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.guiCtx.fillRect(0, 0, ASTEROIDS.WIDTH, ASTEROIDS.HEIGHT);
        
        this.guiCtx.fillStyle = '#ff4444';
        this.guiCtx.font = 'bold 48px Arial';
        this.guiCtx.textAlign = 'center';
        this.guiCtx.fillText('GAME OVER', ASTEROIDS.WIDTH / 2, ASTEROIDS.HEIGHT / 2 - 50);
        
        this.guiCtx.fillStyle = ASTEROIDS.COLORS.GUI.TEXT;
        this.guiCtx.font = '24px Arial';
        this.guiCtx.fillText(`Final Score: ${this.score}`, ASTEROIDS.WIDTH / 2, ASTEROIDS.HEIGHT / 2);
        this.guiCtx.fillText(`Level Reached: ${this.level}`, ASTEROIDS.WIDTH / 2, ASTEROIDS.HEIGHT / 2 + 30);
        
        // Draw reset button
        const button = this.gameOverResetButton;
        
        // Button background with hover effect
        this.guiCtx.fillStyle = button.hovered ? ASTEROIDS.COLORS.GUI.BUTTON_HOVER : ASTEROIDS.COLORS.GUI.BUTTON_ACTIVE;
        this.guiCtx.fillRect(button.x, button.y, button.width, button.height);
        
        // Button border
        this.guiCtx.strokeStyle = ASTEROIDS.COLORS.GUI.TEXT;
        this.guiCtx.lineWidth = 3;
        this.guiCtx.strokeRect(button.x, button.y, button.width, button.height);
        
        // Button text
        this.guiCtx.fillStyle = ASTEROIDS.COLORS.GUI.TEXT;
        this.guiCtx.font = 'bold 20px Arial';
        this.guiCtx.fillText('RESTART GAME', button.x + button.width / 2, button.y + button.height / 2 + 7);
        
        // Instructions
        this.guiCtx.font = '16px Arial';
        this.guiCtx.fillStyle = '#888888';
        this.guiCtx.fillText('Click button or press Action1 to restart', ASTEROIDS.WIDTH / 2, ASTEROIDS.HEIGHT / 2 + 150);
    }
    
    /**
     * Debug Layer Rendering
     * 
     * ActionEngine's debug layer renders above all other layers.
     */
    drawDebugLayer() {
        // Always clear the debug canvas first
        this.debugCtx.clearRect(0, 0, ASTEROIDS.WIDTH, ASTEROIDS.HEIGHT);
        
        // Only draw content when debug overlay is visible
        if (!this.debugOverlayVisible) return;
        
        this.debugCtx.clearRect(0, 0, ASTEROIDS.WIDTH, ASTEROIDS.HEIGHT);
        
        // Debug panel background
        const panel = ASTEROIDS.UI.DEBUG_PANEL;
        this.debugCtx.fillStyle = ASTEROIDS.COLORS.DEBUG.BACKGROUND;
        this.debugCtx.fillRect(panel.x, panel.y, panel.width, panel.height);
        
        // Debug info
        if (this.debugInfoVisible) {
            this.debugCtx.fillStyle = ASTEROIDS.COLORS.DEBUG.TEXT;
            this.debugCtx.font = '14px monospace';
            this.debugCtx.textAlign = 'left';
            
            const debugInfo = [
                'ActionEngine Input System Debug',
                '',
                'THREE-LAYER INPUT PRIORITY:',
                '1. Debug Layer (this panel)',
                '2. GUI Layer (buttons, HUD)',
                '3. Game Layer (asteroids)',
                '',
                'REGISTERED ELEMENTS:',
                `- Nuke button: ${this.nukeButton.enabled ? 'enabled' : 'disabled'}`,
                `- Weapon buttons: ${this.weaponButtons.length}`,
                `- Asteroid elements: ${this.asteroidElements.length}`,
                '',
                'INPUT STATE:',
                `- Current weapon: ${this.currentWeapon.name}`,
                `- Fire timer: ${this.fireTimer.toFixed(2)}`,
                `- Bullets active: ${this.bullets.length}`,
                '',
                'GAME STATE:',
                `- Ship: ${this.ship ? 'Active' : 'Destroyed'}`,
                `- Asteroids: ${this.asteroids.length}`,
                `- Particles: ${this.particles.length}`,
                `- Frame: ${this.frameCount}`
            ];
            
            debugInfo.forEach((line, i) => {
                this.debugCtx.fillText(line, panel.x + 10, panel.y + 25 + i * 16);
            });
        }
        
        // Debug controls
        this.drawDebugControls();
    }
}