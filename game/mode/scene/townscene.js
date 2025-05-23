// game/mode/scene/townscene.js

/**
 * TownScene - A specialized scene for outdoor town environments
 * 
 * This scene type extends BaseGameScene to provide JRPG-style town gameplay:
 * - Top-down angled camera that follows the player with boundaries
 * - Town layouts with buildings, paths, and decorations
 * - Portals to enter buildings (transitions to HouseScene)
 * - World portal to return to the world map
 * - Outdoor directional lighting for daytime feel
 */
class TownScene extends BaseGameScene {
    constructor(canvases, input, audio, gameModeManager, townId = "default_town", spawnPosition = null, sceneManager = null) {
        super(canvases, input, audio, gameModeManager);
        
        // Town-specific properties
        this.townId = townId;
        this.townLayout = null;
        this.requestedSpawnPosition = spawnPosition;
        this.sceneManager = sceneManager; // Store SceneManager reference
        
        // Camera boundaries - will be set by town layout
        this.cameraBounds = {
            minX: -100,
            maxX: 100,
            minZ: -100,
            maxZ: 100
        };
        
        console.log(`TownScene: Created for town ${this.townId}`);
        
        // Now that properties are set up, do the actual scene initialization
        this.doLateInitialization();
    }
    
    /**
     * Perform initialization that requires all properties to be set up
     */
    doLateInitialization() {
        // Create the town layout
        this.createTownLayout();
        
        // Position character at spawn point
        this.positionCharacterAtSpawn();
    }
    
    /**
     * Enable random battles for town scenes
     */
    getRandomBattleSettings() {
        return true; // Towns have random encounters!
    }
    
    /**
     * Get scene type for battle return
     */
    getSceneType() {
        return 'town';
    }
    
    /**
     * Get scene ID for battle return
     */
    getSceneId() {
        return this.townId;
    }
    
    /**
     * Initialize town-specific components - called by BaseGameScene
     * Note: Town creation is deferred to doLateInitialization() to ensure properties are set
     */
    initializeSceneSpecifics() {
        console.log('TownScene: Initializing town scene specifics (early phase)');
        console.log(`TownScene: Random battles ${this.enableRandomBattles ? 'ENABLED' : 'DISABLED'}`);
        // Early initialization only - town setup happens in doLateInitialization()
    }
    
    /**
     * Set up camera for town scenes - high angle, following camera with boundaries
     */
    setupCamera() {
        // Town-style camera (higher angle, looking down)
        this.camera.position = new Vector3(0, 80, 100);
        this.camera.target = new Vector3(0, 0, 40);
        
        // Configure camera for top-down RPG style
        this.camera.fov = Math.PI * 0.3; // Narrower field of view
        this.camera.isDetached = true;
    }
    
    /**
     * Set up lighting for outdoor town scenes
     */
    setupLighting() {
        if (this.renderer3D && this.renderer3D.lightManager) {
            this.renderer3D.lightManager.setMainDirectionalLightEnabled(true);
            
            // Adjust directional light for sunny day
            const mainLight = this.renderer3D.lightManager.mainDirectionalLight;
            if (mainLight) {
                // Sun-like direction (noon-ish sun position)
                mainLight.setDirection(new Vector3(0.5, -1.0, 0.3).normalize());
                
                // Warm sunlight color
                mainLight.setColor(new Vector3(1.0, 0.98, 0.92));
                
                // Increase intensity for brighter outdoor lighting
                mainLight.setIntensity(1.2);
                
                console.log("TownScene: Configured directional light for outdoor scene");
            }
        }
    }
    
    /**
     * Create the town layout
     */
    createTownLayout() {
        if (this.physicsWorld) {
            this.physicsWorld.reset();
        }
        
        // Create town layout
        this.townLayout = new TownLayout(
            this.physicsWorld,
            this.townId,
            new Vector3(0, 0, 0),
            {width: 200, height: 50, depth: 200}
        );
        
        // Set reference to this scene for callbacks
        this.townLayout.sceneMode = this;
        
        // Pass the SceneManager so portals can use proper scene transitions
        this.townLayout.sceneManager = this.sceneManager;
        
        if (!this.sceneManager) {
            console.warn('TownScene: No SceneManager available - building entrances will use fallback method');
        } else {
            console.log('TownScene: SceneManager available - building entrances will use proper scene transitions');
        }
        
        // Create the basic town structure
        this.townLayout.createBasicTown();
        
        // Set a proper default spawn position for the town (like the old code had)
        this.townLayout.spawnPosition = new Vector3(0, 5, 50);
        
        // Set camera boundaries from town layout
        this.cameraBounds = this.townLayout.cameraSettings.bounds;
        
        // Add demo buildings
        this.addDemoBuildings();
        
        console.log('TownScene: Town layout created');
    }
    
    /**
     * Add demo buildings to the town
     */
    addDemoBuildings() {
        // Add some buildings
        const house1 = this.townLayout.addBuilding(
            new Vector3(-30, 7, 20),
            {width: 20, height: 14, depth: 20},
            "house",
            "house1"
        );
        
        const house2 = this.townLayout.addBuilding(
            new Vector3(30, 7, 20),
            {width: 20, height: 14, depth: 20},
            "house",
            "house2"
        );
        
        const shop = this.townLayout.addBuilding(
            new Vector3(0, 10, -30),
            {width: 30, height: 20, depth: 25},
            "shop",
            "entry"
        );
        
        // Add entrances to buildings
        this.townLayout.addBuildingEntrance(
            house1.id,
            new Vector3(-30, 5, 30), // In front of the house
            {width: 8, height: 10, depth: 2}
        );
        
        this.townLayout.addBuildingEntrance(
            house2.id,
            new Vector3(30, 5, 30), // In front of the house
            {width: 8, height: 10, depth: 2}
        );
        
        this.townLayout.addBuildingEntrance(
            shop.id,
            new Vector3(0, 5, -17), // In front of the shop
            {width: 10, height: 10, depth: 2}
        );
        
        // Add some decorations
        this.townLayout.addDecoration(
            new Vector3(-50, 5, 0),
            {width: 10, height: 10, depth: 10},
            "decoration"
        );
        
        this.townLayout.addDecoration(
            new Vector3(50, 5, 0),
            {width: 10, height: 10, depth: 10},
            "decoration"
        );
        
        // Add a water feature
        this.townLayout.addWater(
            new Vector3(0, 0.5, 60),
            {width: 40, height: 1, depth: 20}
        );
    }
    
    /**
     * Position character at spawn point
     */
    positionCharacterAtSpawn() {
        // Use the same saved state system as WorldMode
        const savedState = this.gameModeManager.gameMaster.getPlayerState();
        
        if (savedState && savedState.position) {
            // Position and rotation from saved state (battle return)
            this.character.body.position.set(
                savedState.position.x,
                savedState.position.y,
                savedState.position.z
            );
            this.character.rotation = savedState.rotation;
            
            // Reset velocities
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
        } else {
            // No saved state - use spawn position logic
            let spawnPos;
            
            if (this.requestedSpawnPosition) {
                spawnPos = this.requestedSpawnPosition;
            } else if (this.townLayout && this.townLayout.spawnPosition) {
                spawnPos = this.townLayout.spawnPosition;
            } else {
                spawnPos = new Vector3(0, 5, 50); // Default spawn
            }
            
            this.positionCharacter(spawnPos);
        }
    }
    
    /**
     * Update camera to follow character with boundaries
     */
    updateCamera(deltaTime) {
        if (!this.character) return;
        
        const characterPos = this.character.position;
        
        // Calculate desired camera position relative to character
        const cameraOffset = new Vector3(0, 80, 100);
        const desiredCameraPos = new Vector3(
            characterPos.x + cameraOffset.x,
            cameraOffset.y,
            characterPos.z + cameraOffset.z
        );
        
        // Apply camera boundaries
        const boundedCameraPos = new Vector3(
            Math.max(this.cameraBounds.minX + cameraOffset.x, 
                    Math.min(this.cameraBounds.maxX + cameraOffset.x, desiredCameraPos.x)),
            desiredCameraPos.y,
            Math.max(this.cameraBounds.minZ + cameraOffset.z, 
                    Math.min(this.cameraBounds.maxZ + cameraOffset.z, desiredCameraPos.z))
        );
        
        // Smoothly move camera
        const lerpFactor = 5.0 * deltaTime;
        this.camera.position.x = this.camera.position.x + (boundedCameraPos.x - this.camera.position.x) * lerpFactor;
        this.camera.position.z = this.camera.position.z + (boundedCameraPos.z - this.camera.position.z) * lerpFactor;
        
        // Update camera target to follow character
        this.camera.target.x = characterPos.x;
        this.camera.target.z = characterPos.z;
    }
    
    /**
     * Handle town-specific input
     */
    handleSceneSpecificInput() {
        // Exit to world map
        if (this.input.isKeyJustPressed("Action5")) {
            this.exitToWorldMap();
        }
    }
    
    /**
     * Exit to world map
     */
    exitToWorldMap() {
        console.log('TownScene: Exiting to world map');
        this.startFadeTransition(0.5, true, () => {
            this.gameModeManager.switchMode("world");
        });
    }
    
    /**
     * Enter a building - this method is now legacy since portals handle it directly
     * Keeping for compatibility but transitions should go through SceneManager
     */
    enterBuilding(indoorSceneName, returnSceneName) {
        console.log(`TownScene: Legacy enterBuilding called - transitions should use SceneManager directly`);
        
        // Get the scene manager from the parent mode
        const sceneManager = this.gameModeManager.activeMode?.sceneManager;
        if (!sceneManager) {
            console.error('TownScene: No SceneManager available for building transition');
            return;
        }
        
        // Store the current character position for when we exit
        const returnPosition = this.character.position.clone();
        
        // Create return configuration
        const returnConfig = {
            type: 'town',
            sceneId: returnSceneName,
            spawnPosition: returnPosition
        };
        
        // Use SceneManager to enter the building
        sceneManager.enterBuilding(indoorSceneName, returnConfig);
    }
    
    /**
     * Get objects to render - includes town layout objects
     */
    getRenderObjects() {
        const renderObjects = super.getRenderObjects();
        
        // Add town layout objects
        if (this.townLayout) {
            renderObjects.push(...this.townLayout.getAllPhysicsObjects());
        }
        
        return renderObjects;
    }
    
    /**
     * Draw town-specific GUI
     */
    drawSceneGUI() {
        this.guiCtx.font = "20px Arial";
        this.guiCtx.fillStyle = "white";
        this.guiCtx.textAlign = "left";
        this.guiCtx.textBaseline = "top";

        this.guiCtx.fillText("Town Scene", 10, 30);
        this.guiCtx.fillText("Press Action5 to exit to World", 10, 60);
        this.guiCtx.fillText(`Current town: ${this.townId}`, 10, 90);
        
        // Display debug info
        if (this.debugInfo && this.character) {
            this.guiCtx.font = "16px Arial";
            this.guiCtx.fillText(`Camera: x:${Math.round(this.camera.position.x)}, y:${Math.round(this.camera.position.y)}, z:${Math.round(this.camera.position.z)}`, 10, 120);
            this.guiCtx.fillText(`Character: x:${Math.round(this.character.position.x)}, y:${Math.round(this.character.position.y)}, z:${Math.round(this.character.position.z)}`, 10, 145);
            
            if (this.transitions.length > 0) {
                this.guiCtx.fillStyle = "yellow";
                this.guiCtx.fillText(`Transition in progress: ${Math.round(this.transitions[0].progress * 100)}%`, 10, 170);
            }
        }
    }
    
    /**
     * Clean up town-specific resources
     */
    sceneCleanup() {
        console.log('TownScene: Cleaning up town scene');
        
        if (this.townLayout) {
            this.townLayout.cleanup();
            this.townLayout = null;
        }
        
        this.townId = null;
        this.cameraBounds = null;
    }
}
