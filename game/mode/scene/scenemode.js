// game/mode/scene/scenemode.js

class SceneMode {
    constructor(canvases, input, audio, gameModeManager) {
        this.canvases = canvases;
        this.input = input;
        this.audio = audio;
        this.gameModeManager = gameModeManager;
        this.isPaused = false;

        this.initializeMode();
        
        // Create a character after scene initialization (similar to WorldMode)
        this.character = new ActionFixedPerspectiveCharacter3D(this.camera, this);
        this.physicsWorld.objects.add(this.character);
        
        // Position character higher in the scene
        this.character.body.position.set(0, 30, 0);
        
        // Explicitly add the character's rigid body to the physics world
        this.physicsWorld.getWorld().addRigidBody(this.character.body);
        
        window.gameCharacter = this.character;
        
        // Initialize the active scene
        this.scenes = {};
        this.activeScene = null;
        this.portalAnimations = [];
        
        // Create a demo scene
        this.generateDemoScene();
    }

    initializeMode() {
        this.gameCanvas3D = this.canvases.gameCanvas;
        this.gameCanvas3DCtx = this.gameCanvas3D.getContext("webgl2") || this.gameCanvas3D.getContext("webgl");
        this.guiCanvas = this.canvases.guiCanvas;
        this.guiCtx = this.guiCanvas.getContext("2d");
        this.debugCanvas = this.canvases.debugCanvas;

        this.renderer3D = new ActionRenderer3D(this.gameCanvas3D);
        this.shaderManager = new ShaderManager(this.renderer3D);
        this.shaderManager.registerAllShaders(this.renderer3D);
        this.physicsWorld = new ActionPhysicsWorld3D(this.shaderManager);
        this.camera = new ActionCamera();
        this.lastTime = performance.now();
        this.deltaTime = 0;
        
        // Set up fixed camera position
        this.camera.position = new Vector3(0, 30, 60);
        this.camera.target = new Vector3(0, 10, 0);
        
        // Make sure the camera is not attached to the character
        this.camera.isDetached = true;
    }

    generateDemoScene() {
        if (this.physicsWorld) {
            this.physicsWorld.reset();
            
            // Set better gravity for character control
            this.physicsWorld.getWorld().gravity.y = -12; // Slightly stronger gravity
        }

        // Create a new scene with ID "entry"
        this.scenes["entry"] = new SceneLayout(
            this.physicsWorld,
            new Vector3(0, 0, 0),
            {width: 60, height: 30, depth: 60}
        );
        
        // Set reference to scene mode for callbacks
        this.scenes["entry"].sceneMode = this;
        this.scenes["entry"].createBasicStructure();
        
        // Create a second scene
        this.scenes["second"] = new SceneLayout(
            this.physicsWorld,
            new Vector3(100, 0, 0), // Position it away from the first scene
            {width: 40, height: 20, depth: 40}
        );
        this.scenes["second"].sceneMode = this;
        this.scenes["second"].createBasicStructure();
        
        // Add portals between scenes
        this.scenes["entry"].addPortal(
            "east", 
            "second", 
            "west",
            new Vector3(0, 85, 0) // Camera position for second scene
        );
        
        this.scenes["second"].addPortal(
            "west", 
            "entry", 
            "east",
            new Vector3(0, 30, 60) // Camera position for entry scene
        );
        
        // Add a world portal to exit to the world map
        this.scenes["entry"].addWorldPortal("south");
        
        // Set the active scene
        this.activateScene("entry");
    }
    
    activateScene(sceneId) {
        if (!this.scenes[sceneId]) {
            console.error(`Scene ${sceneId} does not exist!`);
            return;
        }
        
        const scene = this.scenes[sceneId];
        this.activeScene = scene;
        
        // Position the camera
        if (scene.cameraPosition) {
            this.camera.position = scene.cameraPosition.clone();
            this.camera.target = scene.position.clone();
            this.camera.target.y += 10; // Look at the center of the scene
        }
        
        // Position the character if it's a new scene entry
        if (scene.entrancePosition) {
            this.character.body.position.set(
                scene.entrancePosition.x,
                scene.entrancePosition.y,
                scene.entrancePosition.z
            );
            
            // Reset velocity to prevent carrying momentum between scenes
            this.character.body.linear_velocity.set(0, 0, 0);
            this.character.body.angular_velocity.set(0, 0, 0);
        }
        
        // Debug physics objects in the scene
        const floorObject = scene.objects.floor;
        if (floorObject && floorObject.body) {
            console.log("Floor properties:", {
                position: [floorObject.body.position.x, floorObject.body.position.y, floorObject.body.position.z],
                dimensions: scene.dimensions,
                friction: floorObject.body.friction,
                mass: floorObject.body._mass
            });
        }
        
        console.log(`Activated scene: ${sceneId}`);
    }
    
    transitionToScene(sceneId, entranceDirection) {
        if (!this.scenes[sceneId]) {
            console.error(`Cannot transition to scene ${sceneId} - it doesn't exist!`);
            return;
        }
        
        const targetScene = this.scenes[sceneId];
        
        // Set the entrance position based on the entrance direction
        if (entranceDirection) {
            const oppositeDirection = {
                "north": "south",
                "south": "north",
                "east": "west",
                "west": "east"
            }[entranceDirection];
            
            // Position character at the appropriate entrance
            if (targetScene.entrances && targetScene.entrances[oppositeDirection]) {
                targetScene.entrancePosition = targetScene.entrances[oppositeDirection].clone();
                // Raise the Y position slightly to prevent floor clipping
                targetScene.entrancePosition.y += 3;
            }
            
            // Set camera position if specified by the portal
            if (this.activeScene && this.activeScene.portals && 
                this.activeScene.portals[entranceDirection] && 
                this.activeScene.portals[entranceDirection].cameraPosition) {
                targetScene.cameraPosition = this.activeScene.portals[entranceDirection].cameraPosition.clone();
            }
        }
        
        // Activate the new scene
        this.activateScene(sceneId);
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
    
    fixed_update(fixedDeltaTime) {
        if (this.isPaused) return;
        
        // Physics simulation belongs in fixed update
        this.physicsWorld.fixed_update(fixedDeltaTime);
        
        // Character physics-related updates
        if (this.character && typeof this.character.fixed_update === 'function') {
            this.character.fixed_update(fixedDeltaTime);
        }
    }
    
    update(deltaTime) {
        // Store deltaTime for components that need it
        this.deltaTime = deltaTime;

        if (!this.isPaused) {
            this.handleInput();
            
            // Update any portal animations
            this.updatePortalAnimations(this.deltaTime);
        }
    }

    handleInput() {
        if (this.character) {
            this.character.applyInput(this.input, this.deltaTime);
            // Visual updates only (physics now in fixed_update)
            this.character.update(this.deltaTime);
        }
        
        // Exit to world map
        if (this.input.isKeyJustPressed("Action5")) {
            this.gameModeManager.switchMode("world");
        }
    }

    updatePortalAnimations(deltaTime) {
        for (let i = this.portalAnimations.length - 1; i >= 0; i--) {
            const anim = this.portalAnimations[i];
            
            anim.progress += deltaTime / anim.duration;
            
            if (anim.progress >= 1.0) {
                // Animation complete
                this.portalAnimations.splice(i, 1);
                
                // Execute callback if provided
                if (anim.onComplete) {
                    anim.onComplete();
                }
            } else {
                // Update animation
                if (anim.onUpdate) {
                    anim.onUpdate(anim.progress);
                }
            }
        }
    }

    draw() {
        if (this.gameCanvas3DCtx) {
            this.gameCanvas3DCtx.clear(this.gameCanvas3DCtx.COLOR_BUFFER_BIT | this.gameCanvas3DCtx.DEPTH_BUFFER_BIT);
        }

        if (this.guiCtx) {
            this.guiCtx.clearRect(0, 0, 800, 600);
        }

        // Create render list - physics world objects plus character
        const renderObjects = [...Array.from(this.physicsWorld.objects)];
        
        // Add the character if it exists - it needs special handling
        if (this.character) {
            renderObjects.push(this.character);
        }
        
        this.renderer3D.render({
            camera: this.camera,
            renderableObjects: renderObjects,
            showDebugPanel: false
        });

        if (this.guiCtx) {
            this.drawSceneUI();
        }
    }

    drawSceneUI() {
        this.guiCtx.save();

        this.guiCtx.font = "20px Arial";
        this.guiCtx.fillStyle = "white";
        this.guiCtx.textAlign = "left";
        this.guiCtx.textBaseline = "top";

        this.guiCtx.fillText("Scene Mode", 10, 30);
        this.guiCtx.fillText("Press Action5 to exit", 10, 60);
        
        if (this.activeScene) {
            this.guiCtx.fillText(`Current scene: ${this.getCurrentSceneId()}`, 10, 90);
        }

        this.guiCtx.restore();
    }
    
    getCurrentSceneId() {
        for (const [id, scene] of Object.entries(this.scenes)) {
            if (scene === this.activeScene) {
                return id;
            }
        }
        return "unknown";
    }

    cleanup() {
        if (this.physicsWorld) {
            this.physicsWorld.reset();
            this.physicsWorld = null;
        }

        this.character = null;
        this.renderer3D = null;
        this.shaderManager = null;
        this.camera = null;
        this.scenes = {};
        this.activeScene = null;

        this.input.clearAllElements();

        this.gameCanvas3D = null;
        this.gameCanvas3DCtx = null;
        this.guiCanvas = null;
        this.guiCtx = null;
        this.debugCanvas = null;

        this.canvases = null;
        this.input = null;
        this.audio = null;
    }
}