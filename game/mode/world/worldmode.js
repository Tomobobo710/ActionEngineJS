// game/mode/worldmode.js
class WorldMode {
    constructor(canvases, input, audio, gameModeManager) {
        this.canvases = canvases;
        this.input = input;
        this.audio = audio;
        this.gameModeManager = gameModeManager;
        this.physicsWorld = new ActionPhysicsWorld3D();
        this.isPaused = false;

        this.initializeMode();
        this.pendingBattleTransition = false;
        this.pendingMenuTransition = false;  // Add this new flag
        
        if (this.createCharacter) {
            this.character = new ThirdPersonActionCharacter(this.terrain, this.camera, this);

            // Get saved state
const savedState = gameModeManager.gameMaster.getPlayerState();
if (savedState && savedState.position) {
    // Position and rotation
    this.character.body.position.set(
        savedState.position.x,
        savedState.position.y,
        savedState.position.z
    );
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

            this.shaderManager.updateCharacterBuffers(this.character);
        
        
        const savedTime = gameModeManager.gameMaster.getWorldTime();
        this.worldTime = { ...savedTime };
        
        // Time progression speed (minutes per real second)
        this.timeProgressionRate = 1; // Adjust this to change how fast time moves
    
        // Add a flag to track if rain is active
        this.rainCycleActive = false;

        // Time tracking for weather cycles
        this.lastWeatherCheck = 0;    
            
        }
        
        // Status effect timer for world mode
        this.statusEffectTimer = 0;
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

        this.weatherSystem = new WeatherSystem();
        this.shaderManager = new ShaderManager(this.renderer3D.gl);
        this.shaderManager.registerAllShaders(this.renderer3D);
        this.physicsWorld.setShaderManager(this.shaderManager);

        this.camera = new ActionCamera();
        this.seed = 420;

        this.generateWorld();

        this.character = null;
        this.createCharacter = true;
        if (this.createCharacter) {
            this.character = new ThirdPersonActionCharacter(this.terrain, this.camera, this);
            this.shaderManager.updateCharacterBuffers(this.character);
        }

        this.lastTime = performance.now();
        this.deltaTime = 0;
        this.debugPanel = new DebugPanel(this.debugCanvas, this);
        this.showDebugPanel = false;
        this.use2DRenderer = false;

        console.log("[WorldMode] Initialization completed");
    }

    generateWorld() {
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
        this.shaderManager.updateTerrainBuffers(this.terrain);

        const terrainBody = this.terrain.createPhysicsMesh();
        this.physicsWorld.addTerrainBody(terrainBody, 1, -1);

        if (this.poiManager) {
            this.poiManager.cleanup();
        }
        this.poiManager = new POIManager(this.terrain, this.physicsWorld, this);
        this.poiManager.generateAllPOIs();

        if (this.character) {
            this.character.terrain = this.terrain;
            this.shaderManager.updateCharacterBuffers(this.character);
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
            
            // Update status effects for all party members in world mode
            this.updatePartyStatusEffects(this.deltaTime);
            
            if (!this.use2DRenderer) {
                this.shaderManager.updateCharacterBuffers(this.character);
            }
            
            this.physicsWorld.update(this.deltaTime);
            this.handleInput();
            this.weatherSystem.update(this.deltaTime, this.terrain);

            if (this.character && this.weatherSystem) {
                this.weatherSystem.updatePosition(this.character.position);
            }
            
            // Check for pending transitions after all updates are complete
            if (this.pendingBattleTransition) {
                this.pendingBattleTransition = false;
                this.gameModeManager.switchMode('battle');
                return;
            }

            if (this.pendingMenuTransition) {
                this.pendingMenuTransition = false;
                this.gameModeManager.switchMode('rpgmenu');
                return;
            }
        }
    }
    
    // Update status effects for all party members in world mode
    updatePartyStatusEffects(deltaTime) {
        if (!this.gameModeManager || !this.gameModeManager.gameMaster) return;
        
        const party = this.gameModeManager.gameMaster.persistentParty;
        if (!party) return;
        
        // Update status effects for each party member
        party.forEach(character => {
            if (character) {
                // Pass the world mode instance as context for damage number display
                character.updateStatus({ deltaTime, context: this });
            }
        });
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
    const totalMinutes = (this.worldTime.hours * 60) + currentMinutes;
    
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

        if (this.input.isKeyJustPressed("Action3")) {
            this.showDebugPanel = !this.showDebugPanel;
        }

        if (this.input.isKeyJustPressed("Action4")) {
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
                this.terrain,
                this.camera,
                this.character,
                this.showDebugPanel,
                this.weatherSystem,
                this.physicsWorld.objects
            );
        } else {
            const bufferInfo = this.shaderManager.getBufferInfo();

            this.renderer3D.render({
                ...bufferInfo,
                camera: this.camera,
                character: this.character,
                renderableObjects: Array.from(this.physicsWorld.objects),
                showDebugPanel: this.showDebugPanel,
                weatherSystem: this.weatherSystem
            });
        }

        if (this.showDebugPanel) {
            this.debugPanel.draw();
        } else {
            this.debugPanel.clear();
        }
    
        // Draw time, status effects, and floating damage numbers on UI
        if (this.guiCtx) {
            this.drawWorldUI();
        }
    }
    
    // NEW: Draw time and status effects
    drawWorldUI() {
        this.guiCtx.save();
        
        // Set ALL the text settings we actually need, don't assume anything
        this.guiCtx.font = '20px Arial';
        this.guiCtx.fillStyle = 'white';
        this.guiCtx.textAlign = 'left';
        this.guiCtx.textBaseline = 'top';
        
        // Draw time in top left
        this.guiCtx.fillText(this.getTimeString(), 10, 30);
        
        // Draw status effects for all party members if any are active
        if (this.gameModeManager && this.gameModeManager.gameMaster) {
            const party = this.gameModeManager.gameMaster.persistentParty;
            if (party) {
                let hasActiveStatus = false;
                
                // First check if any party member has active status effects
                party.forEach(character => {
                    if (!character) return;
                    Object.values(character.status).forEach(duration => {
                        if (duration > 0) hasActiveStatus = true;
                    });
                });
                
                // If at least one party member has a status effect, show the status panel
                if (hasActiveStatus) {
                    // Draw status effect panel
                    this.guiCtx.fillStyle = 'rgba(0, 0, 50, 0.7)';
                    this.guiCtx.fillRect(5, 60, 200, 30 * party.length);
                    this.guiCtx.strokeStyle = '#ffffff';
                    this.guiCtx.lineWidth = 1;
                    this.guiCtx.strokeRect(5, 60, 200, 30 * party.length);
                    
                    // Draw each character's status
                    let yOffset = 65;
                    party.forEach(character => {
                        if (!character) return;
                        
                        // Character name
                        this.guiCtx.fillStyle = '#ffffff';
                        this.guiCtx.font = '14px Arial';
                        this.guiCtx.fillText(character.name + ':', 10, yOffset);
                        
                        // Status effect icons
                        let xOffset = 80;
                        Object.entries(character.status).forEach(([status, duration]) => {
                            if (duration > 0) {
                                // Use different colors for different status types
                                let statusColor;
                                switch (status) {
                                    case "poison":
                                        statusColor = "#9933ff"; // Purple for poison
                                        break;
                                    case "blind":
                                        statusColor = "#888888"; // Gray for blind
                                        break;
                                    case "silence":
                                        statusColor = "#33ccff"; // Light blue for silence
                                        break;
                                    default:
                                        statusColor = "#ffff00"; // Yellow for default
                                }
                                
                                // Draw status icon
                                this.guiCtx.fillStyle = statusColor;
                                this.guiCtx.fillText(`${status}:${duration}`, xOffset, yOffset);
                                xOffset += 50; // Space between status icons
                            }
                        });
                        
                        yOffset += 25;
                    });
                }
            }
        }
        
        this.guiCtx.restore();
    }

    getTimeString() {
        const hours = Math.floor(this.worldTime.hours);
        const minutes = Math.floor(this.worldTime.minutes);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
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
            this.gameModeManager.gameMaster.setWorldTime(
                this.worldTime.hours,
                this.worldTime.minutes
            );
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

        // Clean up debug panel
        if (this.debugPanel) {
            // Need to add proper cleanup
            this.debugPanel = null;
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


    // Add a method to show temporary damage numbers for world effects (like poison damage)
    showDamageNumber(character, amount, type) {
        // Only create damage numbers if we have gui context
        if (!this.guiCtx) return;
        
        // Add a damage number at a random position near the player character
        const x = 400 + (Math.random() * 40 - 20);
        const y = 300 + (Math.random() * 40 - 20);
        
        // Track the damage number with its own animation
        if (!this.damageNumbers) {
            this.damageNumbers = [];
        }
        
        this.damageNumbers.push({
            x,
            y,
            amount,
            type,
            startTime: Date.now(),
            duration: 2000,
            character: character.name
        });
    }
    
    // Update damage numbers animation in world mode
    updateDamageNumbers() {
        if (!this.damageNumbers) return;
        
        // Remove expired damage numbers
        this.damageNumbers = this.damageNumbers.filter(number => {
            const elapsed = Date.now() - number.startTime;
            return elapsed < number.duration;
        });
    }
    
    // Render damage numbers in world mode
    renderDamageNumbers() {
        if (!this.damageNumbers || !this.guiCtx) return;
        
        this.guiCtx.save();
        
        // Render active damage numbers
        this.damageNumbers.forEach(number => {
            const elapsed = Date.now() - number.startTime;
            const progress = elapsed / number.duration;
            
            // Float upward and fade out
            const offsetY = -50 * progress;
            const alpha = 1 - progress;
            
            // Different colors for different types
            let color;
            switch (number.type) {
                case "physical":
                    color = "#ff3333"; // Red for physical damage
                    break;
                case "magical":
                    color = "#ffff00"; // Yellow for magic damage
                    break;
                case "poison":
                    color = "#9933ff"; // Purple for poison
                    break;
                case "heal":
                    color = "#33ff33"; // Green for healing
                    break;
                case "blind":
                    color = "#888888"; // Gray for blind
                    break;
                case "silence":
                    color = "#33ccff"; // Light blue for silence
                    break;
                default:
                    color = "#ffffff"; // White for unknown
            }
            
            this.guiCtx.globalAlpha = alpha;
            this.guiCtx.fillStyle = color;
            this.guiCtx.strokeStyle = "#000000";
            this.guiCtx.lineWidth = 2;
            this.guiCtx.font = "bold 20px Arial";
            this.guiCtx.textAlign = "center";
            this.guiCtx.textBaseline = "middle";
            
            // Draw text with outline for better visibility
            this.guiCtx.strokeText(number.amount, number.x, number.y + offsetY);
            this.guiCtx.fillText(number.amount, number.x, number.y + offsetY);
            
            // Add character name below for context
            this.guiCtx.font = "12px Arial";
            this.guiCtx.fillText(number.character, number.x, number.y + offsetY + 20);
        });
        
        this.guiCtx.restore();
    }
}