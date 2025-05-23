// game/mode/scene/basegamescene.js

/**
 * BaseGameScene - Base class for all game scenes
 * 
 * This class handles all the common engine interface functionality that every scene needs:
 * - 3D rendering setup
 * - Physics world management
 * - Character creation and management
 * - Basic camera setup
 * - Input handling framework
 * - Transition systems
 * - Lifecycle methods (pause, resume, cleanup, etc.)
 * 
 * Specific scene types (TownScene, HouseScene, etc.) inherit from this and customize
 * the behavior for their specific needs.
 */
class BaseGameScene {
    constructor(canvases, input, audio, gameModeManager) {
        // Core engine interfaces
        this.canvases = canvases;
        this.input = input;
        this.audio = audio;
        this.gameModeManager = gameModeManager;
        
        // Scene state
        this.isPaused = false;
        this.isInitialized = false;
        
        // Core engine components
        this.gameCanvas3D = null;
        this.gameCanvas3DCtx = null;
        this.guiCanvas = null;
        this.guiCtx = null;
        this.debugCanvas = null;
        
        this.renderer3D = null;
        this.physicsWorld = null;
        this.camera = null;
        this.character = null;
        
        // Timing
        this.lastTime = performance.now();
        this.deltaTime = 0;
        this.frameCount = 0;
        
        // Transition system
        this.transitions = [];
        this.fadeOpacity = 0;
        
        // Debug info
        this.debugInfo = true;
        
        // Random battle system (similar to WorldMode)
        this.pendingBattleTransition = false;
        this.enableRandomBattles = this.getRandomBattleSettings(); // Scene-specific setting
        
        // Initialize the scene
        this.initializeEngineComponents();
        this.initializeSceneSpecifics();
        this.createCharacter();
        
        this.isInitialized = true;
    }
    
    /**
     * Initialize core engine components - same for all scenes
     */
    initializeEngineComponents() {
        // Set up canvases
        this.gameCanvas3D = this.canvases.gameCanvas;
        this.gameCanvas3DCtx = this.gameCanvas3D.getContext("webgl2") || this.gameCanvas3D.getContext("webgl");
        this.guiCanvas = this.canvases.guiCanvas;
        this.guiCtx = this.guiCanvas.getContext("2d");
        this.debugCanvas = this.canvases.debugCanvas;
        
        // Initialize core systems
        this.renderer3D = new ActionRenderer3D(this.gameCanvas3D);
        this.physicsWorld = new ActionPhysicsWorld3D();
        this.camera = new ActionCamera();
        
        // Set basic camera properties - subclasses can override
        this.setupCamera();
        
        // Set up lighting - subclasses can override
        this.setupLighting();
    }
    
    /**
     * Get random battle settings for this scene type
     * Subclasses should override this to enable/disable random battles
     */
    getRandomBattleSettings() {
        // Default: disable random battles (safe default)
        return false;
    }
    
    /**
     * Abstract method for scene-specific initialization
     * Subclasses should override this to set up their specific components
     */
    initializeSceneSpecifics() {
        // Default implementation - subclasses should override
        console.log('BaseGameScene: initializeSceneSpecifics() - should be overridden by subclass');
    }
    
    /**
     * Set up camera - can be overridden by subclasses
     */
    setupCamera() {
        // Default camera setup
        this.camera.position = new Vector3(0, 30, 60);
        this.camera.target = new Vector3(0, 0, 0);
        this.camera.fov = Math.PI * 0.4;
        this.camera.isDetached = true;
    }
    
    /**
     * Set up lighting - can be overridden by subclasses  
     */
    setupLighting() {
        // Default lighting setup - subclasses should customize
        if (this.renderer3D && this.renderer3D.lightManager) {
            this.renderer3D.lightManager.setMainDirectionalLightEnabled(true);
        }
    }
    
    /**
     * Create character - same for all scenes
     */
    createCharacter() {
        this.character = new ActionFixedPerspectiveCharacter3D(this.camera, this);
        this.physicsWorld.objects.add(this.character);
        
        // Default character position - subclasses can override
        this.character.body.position.set(0, 5, 0);
        
        // Add character's rigid body to physics world
        this.physicsWorld.getWorld().addRigidBody(this.character.body);
        
        // Make character globally accessible for debugging
        window.gameCharacter = this.character;
        
        console.log('BaseGameScene: Character created and added to physics world');
    }
    
    /**
     * Position character at specific location
     */
    positionCharacter(position) {
        if (this.character && position) {
            this.character.body.position.set(
                position.x,
                position.y,
                position.z
            );
            
            // Reset velocity to prevent carrying momentum
            this.character.body.linear_velocity.set(0, 0, 0);
            this.character.body.angular_velocity.set(0, 0, 0);
            
            console.log(`BaseGameScene: Character positioned at:`, position);
        }
    }
    
    /**
     * Update camera - can be overridden by subclasses for different camera behaviors
     */
    updateCamera(deltaTime) {
        // Default camera update - subclasses can override for different behaviors
        // (e.g., following camera vs fixed camera vs transition camera)
    }
    
    /**
     * Handle input - basic framework, subclasses can override for specific input handling
     */
    handleInput() {
        if (this.character) {
            this.character.applyInput(this.input, this.deltaTime);
            this.character.update(this.deltaTime);
        }
        
        // Call scene-specific input handling
        this.handleSceneSpecificInput();
    }
    
    /**
     * Abstract method for scene-specific input handling
     */
    handleSceneSpecificInput() {
        // Default implementation - subclasses should override
    }
    
    /**
     * Start a fade transition
     */
    startFadeTransition(duration = 0.5, fadeOut = true, onComplete = null) {
        this.transitions.push({
            type: 'fade_transition',
            progress: 0,
            duration: duration,
            fadeOut: fadeOut,
            onUpdate: (progress) => {
                if (fadeOut) {
                    this.fadeOpacity = progress;
                } else {
                    this.fadeOpacity = 1 - progress;
                }
            },
            onComplete: () => {
                console.log('BaseGameScene: Fade transition complete');
                if (onComplete) onComplete();
            }
        });
    }
    
    /**
     * Update all transitions
     */
    updateTransitions(deltaTime) {
        for (let i = this.transitions.length - 1; i >= 0; i--) {
            const transition = this.transitions[i];
            
            transition.progress += deltaTime / transition.duration;
            
            if (transition.progress >= 1.0) {
                // Transition complete
                this.transitions.splice(i, 1);
                
                if (transition.onComplete) {
                    transition.onComplete();
                }
            } else {
                // Update transition
                if (transition.onUpdate) {
                    transition.onUpdate(transition.progress);
                }
            }
        }
    }
    
    /**
     * Easing function for smooth animations
     */
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
    
    /**
     * Pause the scene
     */
    pause() {
        this.isPaused = true;
        if (this.physicsWorld) {
            this.physicsWorld.pause();
        }
    }
    
    /**
     * Resume the scene
     */
    resume() {
        this.isPaused = false;
        this.lastTime = performance.now();
        if (this.physicsWorld) {
            this.physicsWorld.resume();
        }
    }
    
    /**
     * Fixed update - physics and character physics updates
     */
    fixed_update(fixedDeltaTime) {
        if (this.isPaused) return;
        
        // Physics simulation
        if (this.physicsWorld) {
            this.physicsWorld.fixed_update(fixedDeltaTime);
        }
        
        // Character physics updates
        if (this.character && typeof this.character.fixed_update === 'function') {
            this.character.fixed_update(fixedDeltaTime);
        }
        
        // Call scene-specific fixed update
        this.sceneFixedUpdate(fixedDeltaTime);
    }
    
    /**
     * Abstract method for scene-specific fixed updates
     */
    sceneFixedUpdate(fixedDeltaTime) {
        // Default implementation - subclasses can override
    }
    
    /**
     * Update - main update loop
     */
    update(deltaTime) {
        this.deltaTime = deltaTime;
        
        if (!this.isPaused) {
            // Check for random battle transitions
            if (this.pendingBattleTransition && this.enableRandomBattles) {
                this.pendingBattleTransition = false;
                this.enterRandomBattle();
                return;
            } else if (this.pendingBattleTransition && !this.enableRandomBattles) {
                // Just clear the flag if battles are disabled
                this.pendingBattleTransition = false;
            }
            
            this.handleInput();
            this.updateCamera(deltaTime);
            this.updateTransitions(deltaTime);
            
            // Call scene-specific update
            this.sceneUpdate(deltaTime);
        }
        
        this.frameCount++;
    }
    
    /**
     * Handle random battle encounter
     */
    enterRandomBattle() {
        // Save player state using the same system as WorldMode
        if (this.character) {
            const position = new Vector3(
                this.character.position.x,
                this.character.position.y,
                this.character.position.z
            );
            const rotation = this.character.rotation;
            this.gameModeManager.gameMaster.savePlayerState(position, rotation);
        }
        
        // Store scene info for returning after battle
        const returnInfo = {
            mode: 'scene',
            sceneType: this.getSceneType(),
            sceneId: this.getSceneId()
        };
        
        this.gameModeManager.returnInfo = returnInfo;
        
        // Switch to battle mode
        this.gameModeManager.switchMode('battle');
    }
    
    /**
     * Get the scene type for this scene (must be overridden by subclasses)
     */
    getSceneType() {
        // Default implementation - subclasses should override
        return 'unknown';
    }
    
    /**
     * Get the scene ID for this scene (must be overridden by subclasses)
     */
    getSceneId() {
        // Default implementation - subclasses should override
        return 'unknown';
    }
    
    /**
     * Abstract method for scene-specific updates
     */
    sceneUpdate(deltaTime) {
        // Default implementation - subclasses can override
    }
    
    /**
     * Draw - main render loop
     */
    draw() {
        // Clear canvases
        if (this.gameCanvas3DCtx) {
            this.gameCanvas3DCtx.clear(this.gameCanvas3DCtx.COLOR_BUFFER_BIT | this.gameCanvas3DCtx.DEPTH_BUFFER_BIT);
        }
        
        if (this.guiCtx) {
            this.guiCtx.clearRect(0, 0, this.guiCanvas.width, this.guiCanvas.height);
        }
        
        // Create render list
        const renderObjects = this.getRenderObjects();
        
        // Render 3D scene
        if (this.renderer3D) {
            this.renderer3D.render({
                camera: this.camera,
                renderableObjects: renderObjects
            });
        }
        
        // Draw GUI
        if (this.guiCtx) {
            this.drawGUI();
        }
    }
    
    /**
     * Get all objects that should be rendered
     */
    getRenderObjects() {
        const renderObjects = [];
        
        // Add physics world objects
        if (this.physicsWorld) {
            renderObjects.push(...Array.from(this.physicsWorld.objects));
        }
        
        // Add character
        if (this.character) {
            renderObjects.push(this.character);
        }
        
        return renderObjects;
    }
    
    /**
     * Draw GUI - framework method, subclasses should implement drawSceneGUI
     */
    drawGUI() {
        this.guiCtx.save();
        
        // Draw fade overlay if transitioning
        if (this.fadeOpacity > 0) {
            this.guiCtx.fillStyle = `rgba(0, 0, 0, ${this.fadeOpacity})`;
            this.guiCtx.fillRect(0, 0, this.guiCanvas.width, this.guiCanvas.height);
        }
        
        // Call scene-specific GUI drawing
        this.drawSceneGUI();
        
        this.guiCtx.restore();
    }
    
    /**
     * Abstract method for scene-specific GUI drawing
     */
    drawSceneGUI() {
        // Default implementation - subclasses should override
        this.guiCtx.font = "20px Arial";
        this.guiCtx.fillStyle = "white";
        this.guiCtx.textAlign = "left";
        this.guiCtx.textBaseline = "top";
        this.guiCtx.fillText("Base Game Scene", 10, 30);
    }
    
    /**
     * Clean up all resources
     */
    cleanup() {
        console.log('BaseGameScene: Cleaning up...');
        
        // Clean up physics world
        if (this.physicsWorld) {
            this.physicsWorld.reset();
            this.physicsWorld = null;
        }
        
        // Clear references
        this.character = null;
        this.renderer3D = null;
        this.camera = null;
        this.transitions = [];
        this.fadeOpacity = 0;
        
        // Clear input
        if (this.input) {
            this.input.clearAllElements();
        }
        
        // Clear canvas references
        this.gameCanvas3D = null;
        this.gameCanvas3DCtx = null;
        this.guiCanvas = null;
        this.guiCtx = null;
        this.debugCanvas = null;
        
        // Clear engine interfaces
        this.canvases = null;
        this.input = null;
        this.audio = null;
        
        // Call scene-specific cleanup
        this.sceneCleanup();
    }
    
    /**
     * Abstract method for scene-specific cleanup
     */
    sceneCleanup() {
        // Default implementation - subclasses can override
    }
}
