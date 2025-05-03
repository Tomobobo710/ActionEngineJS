// game/mode/worldmode.js
class WorldMode {
    constructor(canvases, input, audio, gameModeManager) {
        this.canvases = canvases;
        this.input = input;
        this.audio = audio;
        this.gameModeManager = gameModeManager;
        
        this.isPaused = false;

        // Initialize the core world components first
        this.initializeMode();
        this.pendingBattleTransition = false;
        this.enableRandomBattles = false; // Default setting for random battles
        this.pendingMenuTransition = false; // Add this new flag

        // Create character after world initialization
        if (this.createCharacter) {
            // Create character once and add to physics world
            this.character = new ThirdPersonActionCharacter(this.terrain, this.camera, this);
            this.physicsWorld.objects.add(this.character);
            console.log("[WorldMode] Character created and added to physics world");
            
            // Get saved state
            const savedState = gameModeManager.gameMaster.getPlayerState();
            if (savedState && savedState.position) {
                // Position and rotation
                this.character.body.position.set(savedState.position.x, savedState.position.y, savedState.position.z);
                this.character.rotation = savedState.rotation;

                // Velocities
                if (savedState.linear_velocity) {
                    this.character.body.linear_velocity.set(
                        savedState.linear_velocity.x,
                        savedState.linear_velocity.y,
                        savedState.linear_velocity.z
                    );
                }

                if (savedState.angular_velocity) {
                    this.character.body.angular_velocity.set(
                        savedState.angular_velocity.x,
                        savedState.angular_velocity.y,
                        savedState.angular_velocity.z
                    );
                }

                // Other physics properties
                if (savedState.physics_properties) {
                    this.character.body.friction = savedState.physics_properties.friction;
                    this.character.body.restitution = savedState.physics_properties.restitution;
                    // Any other properties...
                }

                console.log("Restored complete physics state");
            }

            const savedTime = gameModeManager.gameMaster.getWorldTime();
            this.worldTime = { ...savedTime };

            // Time progression speed (minutes per real second)
            this.timeProgressionRate = 1; // Adjust this to change how fast time moves

            // Add a flag to track if rain is active
            this.rainCycleActive = false;

            // Time tracking for weather cycles
            this.lastWeatherCheck = 0;
        }
    }

    initializeMode() {
        this.gameCanvas3D = this.canvases.gameCanvas;
        this.gameCanvas3DCtx = this.gameCanvas3D.getContext("webgl2") || this.gameCanvas3D.getContext("webgl");

        this.gameCanvas2D = document.createElement("canvas");
        this.gameCanvas2D.width = 800;
        this.gameCanvas2D.height = 600;
        this.gameCanvas2D.style.zIndex = "1";
        document.body.appendChild(this.gameCanvas2D);
        this.gameCanvas2DCtx = this.gameCanvas2D.getContext("2d");

        this.guiCanvas = this.canvases.guiCanvas;
        this.guiCtx = this.guiCanvas.getContext("2d");

        this.debugCanvas = this.canvases.debugCanvas;

        this.renderer3D = new ActionRenderer3D(this.gameCanvas3D);
        this.renderer2D = new ActionRenderer2D(this.guiCanvas);

        
        this.shaderManager = new ShaderManager(this.renderer3D);
        // Register all available shaders with the renderer
        this.shaderManager.registerAllShaders(this.renderer3D);
        
        this.physicsWorld = new ActionPhysicsWorld3D(this.shaderManager);

        this.camera = new ActionCamera();
        
        this.weatherSystem = new WeatherSystem();
        this.seed = 420;

        this.generateWorld();
        
        // Character will be created in the constructor after initializeMode()
        this.character = null;
        this.createCharacter = true;

        this.lastTime = performance.now();
        this.deltaTime = 0;
        
        // Create debug panels
        this.debugPanel = new DebugGui(this.debugCanvas, this);
        
        this.showDebugPanel = false;
        this.use2DRenderer = false;

        console.log("[WorldMode] Initialization completed");
    }

    generateWorld() {
        // Store character position and properties before reset if it exists
        let characterState = null;
        if (this.character && this.character.body) {
            characterState = {
                position: new Vector3(this.character.body.position.x, this.character.body.position.y, this.character.body.position.z),
                rotation: this.character.rotation,
                linear_velocity: new Vector3(this.character.body.linear_velocity.x, this.character.body.linear_velocity.y, this.character.body.linear_velocity.z),
                angular_velocity: new Vector3(this.character.body.angular_velocity.x, this.character.body.angular_velocity.y, this.character.body.angular_velocity.z)
            };
            // Temporarily remove character from physics world to prevent it from being deleted
            this.physicsWorld.removeObject(this.character);
            console.log("[WorldMode] Character temporarily removed from physics world");
        }
        
        // Reset physics world
        if (this.physicsWorld) {
            let manifold = this.physicsWorld.world.narrowphase.contact_manifolds.first;
            while (manifold) {
                for (let i = 0; i < manifold.points.length; i++) {
                    manifold.points[i].destroy();
                }
                manifold = manifold.next_manifold;
            }
            this.physicsWorld.reset();
        }

        const baseConfig = {
            seed: this.seed
        };

        this.terrain = new Terrain(baseConfig);
        this.physicsWorld.addObject(this.terrain);

        if (this.poiManager) {
            this.poiManager.cleanup();
        }
        this.poiManager = new POIManager(this.terrain, this.physicsWorld, this);
        this.poiManager.generateAllPOIs();

        if (this.character) {
            // Update the character's terrain reference to the new terrain
            this.character.terrain = this.terrain;
            
            // Re-add the character to the physics world
            this.physicsWorld.addObject(this.character);
            
            // Restore saved state if we have one
            if (characterState) {
                this.character.body.position.set(characterState.position.x, characterState.position.y, characterState.position.z);
                this.character.rotation = characterState.rotation;
                this.character.body.linear_velocity.set(characterState.linear_velocity.x, characterState.linear_velocity.y, characterState.linear_velocity.z);
                this.character.body.angular_velocity.set(characterState.angular_velocity.x, characterState.angular_velocity.y, characterState.angular_velocity.z);
                this.character.updateFacingDirection();
                
                // Force the character to be visible
                this.character.markVisualDirty();
                if (this.character.updateVisual) {
                    this.character.updateVisual();
                }
            }
            
            console.log("[WorldMode] Character reconnected to physics world after regeneration");
        }

        this.sphere = null;
        this.createTestSphere();
    }

    pause() {
        this.isPaused = true;
        this.physicsWorld.pause();
    }

    resume() {
        this.isPaused = false;
        this.lastTime = performance.now();
        this.physicsWorld.resume();
    }
    update() {
        const currentTime = performance.now();
        this.deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.25);
        this.lastTime = currentTime;

        if (!this.isPaused) {
            // Update world time
            this.updateWorldTime(this.deltaTime);

            // Character buffers no longer need special updates - treated like any other object

            
            this.handleInput();
            this.physicsWorld.update(this.deltaTime);
            this.weatherSystem.update(this.deltaTime, this.terrain);

            if (this.character && this.weatherSystem) {
                this.weatherSystem.updatePosition(this.character.position);
            }
            
            // Check if any POIs need to set their traps
            if (this.character && this.poiManager) {
                // Check dungeons
                if (this.poiManager.dungeons) {
                    this.poiManager.dungeons.forEach(dungeon => {
                        if (dungeon.checkPlayerDistance) {
                            dungeon.checkPlayerDistance();
                        }
                    });
                }
                
                // Check towns
                if (this.poiManager.towns) {
                    this.poiManager.towns.forEach(town => {
                        if (town.checkPlayerDistance) {
                            town.checkPlayerDistance();
                        }
                    });
                }
                
                // Check fishing spots - this might need to be accessed differently
                // since I'm not sure if they're tracked in a fishingSpots array
                if (this.poiManager.fishingSpots) {
                    this.poiManager.fishingSpots.forEach(spot => {
                        if (spot.checkPlayerDistance) {
                            spot.checkPlayerDistance();
                        }
                    });
                }
            }

            // Check for pending transitions after all updates are complete
            if (this.pendingBattleTransition && this.enableRandomBattles) {
                this.pendingBattleTransition = false;
                this.gameModeManager.switchMode("battle");
                return;
            } else if (this.pendingBattleTransition && !this.enableRandomBattles) {
                // Just clear the flag and don't trigger the battle if battles are disabled
                this.pendingBattleTransition = false;
            }

            if (this.pendingMenuTransition) {
                this.pendingMenuTransition = false;
                this.gameModeManager.switchMode("rpgmenu");
                return;
            }
        }
    }

    updateWorldTime(deltaTime) {
        // Calculate minutes to add based on delta time and progression rate
        const minutesToAdd = deltaTime * this.timeProgressionRate;

        // Store previous minutes for comparison
        const previousMinutes = Math.floor(this.worldTime.minutes);

        // Add minutes
        this.worldTime.minutes += minutesToAdd;

        // Handle minute overflow
        while (this.worldTime.minutes >= 60) {
            this.worldTime.minutes -= 60;
            this.worldTime.hours += 1;

            // Handle hour overflow
            if (this.worldTime.hours >= 24) {
                this.worldTime.hours = 0;
            }
        }

        // Check if we should toggle rain based on 30-minute intervals
        const currentMinutes = Math.floor(this.worldTime.minutes);
        const totalMinutes = this.worldTime.hours * 60 + currentMinutes;

        // Check if we've crossed a 30-minute boundary
        if (Math.floor(totalMinutes / 30) !== Math.floor(this.lastWeatherCheck / 30)) {
            this.lastWeatherCheck = totalMinutes;

            if (!this.rainCycleActive) {
                // Start rain
                if (this.weatherSystem) {
                    this.weatherSystem.current = "rain";
                    this.rainCycleActive = true;
                    console.log("[WorldMode] Starting rain cycle");
                }
            } else {
                // Stop rain
                if (this.weatherSystem) {
                    this.weatherSystem.current = "stopWeather";
                    this.rainCycleActive = false;
                    console.log("[WorldMode] Stopping rain cycle");
                }
            }
        }
    }

    handleInput() {
        if (this.character) {
            this.character.applyInput(this.input, this.deltaTime);
            this.character.update(this.deltaTime);
        }

        if (this.input.isKeyJustPressed("Numpad5")) {
            this.renderer3D.programRegistry.cycleShaders();
        }

        if (this.input.isKeyJustPressed("Action4")) {
            this.showDebugPanel = !this.showDebugPanel;
        }

        if (this.input.isKeyJustPressed("Action3")) {
            console.log("[WorldMode] Generating new world...");
            this.seed = Math.floor(Math.random() * 10000);
            this.generateWorld();
        }
        
        if (this.input.isKeyJustPressed("Action2")) {
            this.use2DRenderer = !this.use2DRenderer;
        }
    }

    draw() {
        if (this.gameCanvas2DCtx) {
            this.gameCanvas2DCtx.clearRect(0, 0, 800, 600);
        }

        if (this.gameCanvas3DCtx) {
            this.gameCanvas3DCtx.clear(this.gameCanvas3DCtx.COLOR_BUFFER_BIT | this.gameCanvas3DCtx.DEPTH_BUFFER_BIT);
        }

        if (this.guiCtx) {
            this.guiCtx.clearRect(0, 0, 800, 600);
        }

        if (this.use2DRenderer) {
            this.renderer2D.render(
                this.camera,
                this.physicsWorld.objects,
                this.showDebugPanel,
                this.character                
            );
        } else {
            this.renderer3D.render({
                camera: this.camera,
                renderableObjects: [...Array.from(this.physicsWorld.objects)],
                showDebugPanel: this.showDebugPanel,
                weatherSystem: this.weatherSystem
            });
        }

        // Update and draw debug panels
        if (this.showDebugPanel) {
            // Update debug gui panels
            this.debugPanel.update();
            this.debugPanel.draw();
        } else {
            this.debugPanel.clear();
        }

        // Draw gui
        if (this.guiCtx) {
            this.drawWorldUI();
        }
    }

    // Draw time and status effects
    drawWorldUI() {
        this.guiCtx.save();

        this.guiCtx.font = "20px Arial";
        this.guiCtx.fillStyle = "white";
        this.guiCtx.textAlign = "left";
        this.guiCtx.textBaseline = "top";

        // Draw time in top left
        this.guiCtx.fillText(this.getTimeString(), 10, 30);

        this.guiCtx.restore();
    }

    getTimeString() {
        const hours = Math.floor(this.worldTime.hours);
        const minutes = Math.floor(this.worldTime.minutes);
        const period = hours >= 12 ? "PM" : "AM";
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
    }

    createTestSphere() {
        if (this.sphere) {
            this.physicsWorld.removeObject(this.sphere);
            this.sphere = null;
        }

        this.sphere = new ActionPhysicsSphere3D(
            this.physicsWorld,
            5,
            1,
            new Vector3(Math.random() * 20 - 10, 500, Math.random() * 20 - 10)
        );
        
        this.sphere.body.debugName = `Sphere_${Date.now()}`;
        this.sphere.body.createdAt = Date.now();

        this.physicsWorld.addObject(this.sphere);
    }

    cleanup() {
        // Save world time before cleanup
        if (this.gameModeManager?.gameMaster) {
            this.gameModeManager.gameMaster.setWorldTime(this.worldTime.hours, this.worldTime.minutes);
        }
        // Clean up physics
        if (this.physicsWorld) {
            this.physicsWorld.reset();
            this.physicsWorld = null;
        }

        // Clean up character
        if (this.character) {
            // Need to add proper cleanup to character class
            this.character = null;
        }

        // Clean up POI manager
        if (this.poiManager) {
            this.poiManager.cleanup();
            this.poiManager = null;
        }

        // Clean up terrain
        if (this.terrain) {
            // Need to add proper cleanup to terrain class
            this.terrain = null;
        }

        // Clean up physics objects
        if (this.sphere) {
            this.sphere = null;
        }

        // Clean up rendering
        if (this.renderer3D) {
            // Need to add proper cleanup to renderer
            this.renderer3D = null;
        }
        if (this.renderer2D) {
            // Need to add proper cleanup to renderer
            this.renderer2D = null;
        }

        // Clean up shader manager
        if (this.shaderManager) {
            // Need to add proper cleanup to shader manager
            this.shaderManager = null;
        }

        // Clean up weather system
        if (this.weatherSystem) {
            // Need to add proper cleanup
            this.weatherSystem = null;
        }

        // Clean up camera
        if (this.camera) {
            // Need to add proper cleanup
            this.camera = null;
        }

        // Clean up debug panels
        if (this.debugPanel) {
            // Need to add proper cleanup
            this.debugPanel = null;
        }
        
        // Clean up lighting debug panel
        if (this.lightingDebugPanel) {
            // Need to add proper cleanup
            this.lightingDebugPanel = null;
        }
        
        // Remove 2D canvas
        if (this.gameCanvas2D) {
            document.body.removeChild(this.gameCanvas2D);
            this.gameCanvas2D = null;
        }

        this.input.clearAllElements();

        // Clear canvas references
        this.gameCanvas3D = null;
        this.gameCanvas3DCtx = null;
        this.gameCanvas2DCtx = null;
        this.guiCanvas = null;
        this.guiCtx = null;
        this.debugCanvas = null;

        // Clear other references
        this.canvases = null;
        this.input = null;
        this.audio = null;
    }
}