// game/mode/scene/housescene.js

/**
 * HouseScene - A specialized scene for indoor environments with connected rooms
 * 
 * This scene type extends BaseGameScene to provide indoor gameplay:
 * - Fixed camera positions that transition smoothly between rooms
 * - Room layouts with walls, floors, and doorways
 * - Room-to-room navigation via doorway portals
 * - Exit portals to return to outdoor scenes
 * - Indoor point lighting for atmospheric feel
 */
class HouseScene extends BaseGameScene {
    constructor(canvases, input, audio, gameModeManager, initialRoomId = "entry", returnInfo = null, sceneManager = null) {
        super(canvases, input, audio, gameModeManager);
        
        // House-specific properties
        this.initialRoomId = initialRoomId;
        this.returnInfo = returnInfo; // {mode, sceneName, position}
        this.sceneManager = sceneManager; // Store SceneManager reference
        this.rooms = {};
        this.activeRoom = null;
        this.roomTransitions = [];
        
        // Lighting
        this.pointLight = null;
        
        console.log(`HouseScene: Created for initial room ${this.initialRoomId}`);
        
        // Now that properties are set up, do the actual scene initialization
        this.doLateInitialization();
    }
    
    /**
     * Perform initialization that requires all properties to be set up
     */
    doLateInitialization() {
        // Create room layouts
        this.createRoomLayouts();
        
        // Activate the initial room
        this.activateRoom(this.initialRoomId);
    }
    
    /**
     * Disable random battles for house scenes (indoor areas are safe)
     */
    getRandomBattleSettings() {
        return false; // Houses are safe zones - no random encounters
    }
    
    /**
     * Get scene type for battle return
     */
    getSceneType() {
        return 'house';
    }
    
    /**
     * Get scene ID for battle return
     */
    getSceneId() {
        return this.initialRoomId;
    }
    
    /**
     * Initialize house-specific components - called by BaseGameScene
     * Note: Room creation is deferred to doLateInitialization() to ensure properties are set
     */
    initializeSceneSpecifics() {
        console.log('HouseScene: Initializing house scene specifics (early phase)');
        console.log(`HouseScene: Random battles ${this.enableRandomBattles ? 'ENABLED' : 'DISABLED'}`);
        // Early initialization only - room setup happens in doLateInitialization()
    }
    
    /**
     * Set up camera for indoor scenes - fixed positions with smooth transitions
     */
    setupCamera() {
        // Default indoor camera setup
        this.camera.position = new Vector3(0, 30, 60);
        this.camera.target = new Vector3(0, 10, 0);
        this.camera.fov = Math.PI * 0.4;
        this.camera.isDetached = true;
    }
    
    /**
     * Set up lighting for indoor scenes - point lights instead of directional
     */
    setupLighting() {
        if (this.renderer3D && this.renderer3D.lightManager) {
            // Disable directional light for indoors
            this.renderer3D.lightManager.setMainDirectionalLightEnabled(false);
            
            // Create omnidirectional point light
            const lightPos = new Vector3(0, 15, 0);
            const lightColor = new Vector3(1.0, 0.9, 0.7); // Warm light
            
            this.pointLight = this.renderer3D.lightManager.createPointLight(
                lightPos,         // Position
                lightColor,       // Light color
                2.0,              // Intensity
                80.0,             // Radius
                true              // Cast shadows
            );
            
            console.log("HouseScene: Created omnidirectional light for indoor scene");
        }
    }
    
    /**
     * Create room layouts
     */
    createRoomLayouts() {
        if (this.physicsWorld) {
            this.physicsWorld.reset();
            
            // Set better gravity for character control
            this.physicsWorld.getWorld().gravity.y = -12;
        }
        
        // Create demo rooms
        this.createDemoRooms();
    }
    
    /**
     * Create demo rooms
     */
    createDemoRooms() {
        // Create entry room
        this.rooms["entry"] = new RoomLayout(
            this.physicsWorld,
            new Vector3(0, 0, 0),
            {width: 60, height: 30, depth: 60}
        );
        this.rooms["entry"].indoorSceneMode = this;
        this.rooms["entry"].createBasicStructure();
        
        // Create bedroom
        this.rooms["bedroom"] = new RoomLayout(
            this.physicsWorld,
            new Vector3(100, 0, 0),
            {width: 40, height: 20, depth: 40}
        );
        this.rooms["bedroom"].indoorSceneMode = this;
        this.rooms["bedroom"].createBasicStructure();
        
        // Create house1 room
        this.rooms["house1"] = new RoomLayout(
            this.physicsWorld,
            new Vector3(-100, 0, 0),
            {width: 50, height: 25, depth: 50}
        );
        this.rooms["house1"].indoorSceneMode = this;
        this.rooms["house1"].createBasicStructure();
        
        // Create shop room
        this.rooms["shop1"] = new RoomLayout(
            this.physicsWorld,
            new Vector3(0, 0, -100),
            {width: 70, height: 40, depth: 70}
        );
        this.rooms["shop1"].indoorSceneMode = this;
        this.rooms["shop1"].createBasicStructure();
        
        // Create house2 room
        this.rooms["house2"] = new RoomLayout(
            this.physicsWorld,
            new Vector3(100, 0, -100),
            {width: 45, height: 22, depth: 45}
        );
        this.rooms["house2"].indoorSceneMode = this;
        this.rooms["house2"].createBasicStructure();
        
        // Add some furniture to house2
        this.rooms["house2"].addFurniture(
            "table", 
            new Vector3(100, 5, -100),
            {width: 10, height: 5, depth: 10}
        );
        
        this.rooms["house2"].addFurniture(
            "chair", 
            new Vector3(90, 5, -100),
            {width: 5, height: 8, depth: 5}
        );
        
        this.rooms["house2"].addFurniture(
            "chest", 
            new Vector3(100, 5, -90),
            {width: 8, height: 6, depth: 10}
        );
        
        // Add doorways between rooms
        this.rooms["entry"].addDoorway(
            "east", 
            "bedroom", 
            "west",
            new Vector3(100, 30, 60)
        );
        
        this.rooms["bedroom"].addDoorway(
            "west", 
            "entry", 
            "east",
            new Vector3(0, 30, 60)
        );
        
        // Add exit doors
        this.rooms["entry"].addExitDoor("south");
        this.rooms["house1"].addExitDoor("south");
        this.rooms["house2"].addExitDoor("south");
        this.rooms["shop1"].addExitDoor("south");
        
        // Initialize room camera positions
        this.rooms["entry"].cameraPosition = new Vector3(0, 30, 60);
        this.rooms["bedroom"].cameraPosition = new Vector3(100, 30, 60);
        this.rooms["house1"].cameraPosition = new Vector3(-100, 30, 60);
        this.rooms["shop1"].cameraPosition = new Vector3(0, 40, -40);
        this.rooms["house2"].cameraPosition = new Vector3(100, 30, -60);
        
        console.log('HouseScene: Demo rooms created');
    }
    
    /**
     * Activate a specific room
     */
    activateRoom(roomId) {
        if (!this.rooms[roomId]) {
            console.error(`Room ${roomId} does not exist!`);
            return;
        }
        
        const room = this.rooms[roomId];
        this.activeRoom = room;
        
        // Move the omnidirectional light to the center of the new room
        if (this.pointLight && room.position) {
            const newLightPos = room.position.clone();
            newLightPos.y += 15; // Position light at mid-height of the room
            this.pointLight.setPosition(newLightPos);
            console.log(`HouseScene: Moved omnidirectional light to room ${roomId}`);
        }
        
        // Position the camera immediately if no animation is in progress
        if (room.cameraPosition && !this.roomTransitions.some(anim => anim.type === 'camera_transition')) {
            this.camera.position = room.cameraPosition.clone();
            this.camera.target = room.position.clone();
            this.camera.target.y += 10; // Look at the center of the room
            console.log(`HouseScene: Camera positioned at:`, this.camera.position);
        }
        
        // Position the character if it's a new room entry
        if (room.entrancePosition) {
            this.positionCharacter(room.entrancePosition);
            console.log(`HouseScene: Character positioned at:`, room.entrancePosition);
        } else {
            // Default position if no entrance is defined
            const defaultPos = new Vector3(
                room.position.x,
                room.position.y + 5,
                room.position.z
            );
            this.positionCharacter(defaultPos);
            console.log(`HouseScene: No entrance position, using default at:`, defaultPos);
        }
        
        console.log(`HouseScene: Activated room: ${roomId}`);
    }
    
    /**
     * Transition to a different room
     */
    transitionToRoom(roomId, entranceDirection) {
        if (!this.rooms[roomId]) {
            console.error(`Cannot transition to room ${roomId} - it doesn't exist!`);
            return;
        }
        
        const targetRoom = this.rooms[roomId];
        
        // Set the entrance position based on the entrance direction
        if (entranceDirection) {
            const oppositeDirection = {
                "north": "south",
                "south": "north",
                "east": "west",
                "west": "east"
            }[entranceDirection];
            
            // Position character at the appropriate entrance
            if (targetRoom.entrances && targetRoom.entrances[oppositeDirection]) {
                targetRoom.entrancePosition = targetRoom.entrances[oppositeDirection].clone();
                // Raise the Y position slightly to prevent floor clipping
                targetRoom.entrancePosition.y += 3;
            }
            
            // Set camera position if specified by the doorway
            if (this.activeRoom && this.activeRoom.doorways && 
                this.activeRoom.doorways[entranceDirection] && 
                this.activeRoom.doorways[entranceDirection].cameraPosition) {
                targetRoom.cameraPosition = this.activeRoom.doorways[entranceDirection].cameraPosition.clone();
            }
        }
        
        // Start camera transition animation
        this.startCameraTransition(targetRoom);
        
        // Activate the new room
        this.activateRoom(roomId);
    }
    
    /**
     * Start camera transition animation
     */
    startCameraTransition(targetRoom) {
        // Get the current camera position/target and the new room's desired position
        const startPosition = this.camera.position.clone();
        const startTarget = this.camera.target.clone();
        
        // Calculate target camera position
        const endPosition = targetRoom.cameraPosition ? 
                          targetRoom.cameraPosition.clone() : 
                          new Vector3(targetRoom.position.x, targetRoom.position.y + 30, targetRoom.position.z + 60);
                          
        const endTarget = new Vector3(targetRoom.position.x, targetRoom.position.y + 10, targetRoom.position.z);
        
        // Create a camera animation
        this.roomTransitions.push({
            type: 'camera_transition',
            progress: 0,
            duration: 0.5, // Half second transition
            startPosition: startPosition,
            endPosition: endPosition,
            startTarget: startTarget,
            endTarget: endTarget,
            onUpdate: (progress) => {
                // Smoothly interpolate the camera position and target
                const t = this.easeInOutQuad(progress);
                
                // Update camera position - linear interpolation
                this.camera.position.x = startPosition.x + (endPosition.x - startPosition.x) * t;
                this.camera.position.y = startPosition.y + (endPosition.y - startPosition.y) * t;
                this.camera.position.z = startPosition.z + (endPosition.z - startPosition.z) * t;
                
                // Update camera target - linear interpolation
                this.camera.target.x = startTarget.x + (endTarget.x - startTarget.x) * t;
                this.camera.target.y = startTarget.y + (endTarget.y - startTarget.y) * t;
                this.camera.target.z = startTarget.z + (endTarget.z - startTarget.z) * t;
            },
            onComplete: () => {
                console.log("HouseScene: Camera transition complete!");
            }
        });
    }
    
    /**
     * Update camera - handles room transitions
     */
    updateCamera(deltaTime) {
        // Update any room transitions
        this.updateRoomTransitions(deltaTime);
    }
    
    /**
     * Update room transitions
     */
    updateRoomTransitions(deltaTime) {
        for (let i = this.roomTransitions.length - 1; i >= 0; i--) {
            const anim = this.roomTransitions[i];
            
            anim.progress += deltaTime / anim.duration;
            
            if (anim.progress >= 1.0) {
                // Animation complete
                this.roomTransitions.splice(i, 1);
                
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
    
    /**
     * Handle house-specific input
     */
    handleSceneSpecificInput() {
        // Exit to previous scene or world map
        if (this.input.isKeyJustPressed("Action5")) {
            this.exitToReturnScene();
        }
    }
    
    /**
     * Exit to the scene we came from, or to world map if no return info
     */
    exitToReturnScene() {
        // Start a fade transition
        this.startFadeTransition(0.5, true, () => {
            // Get the scene manager from the parent mode
            const sceneManager = this.gameModeManager.activeMode?.sceneManager;
            if (!sceneManager) {
                console.error('HouseScene: No SceneManager available for exit transition');
                this.gameModeManager.switchMode("world");
                return;
            }
            
            if (this.returnInfo && this.returnInfo.sceneConfig) {
                console.log(`HouseScene: Exiting to scene:`, this.returnInfo.sceneConfig);
                
                // Use SceneManager to return to the outdoor scene
                sceneManager.exitToOutdoorScene(this.returnInfo);
            } else {
                // Default to world map if no return info
                console.log('HouseScene: No return info, exiting to world map');
                this.gameModeManager.switchMode("world");
            }
        });
    }
    
    /**
     * Check if character has moved to a different room
     */
    sceneFixedUpdate(fixedDeltaTime) {
        // Check if character has moved to a new room
        if (this.character && this.activeRoom) {
            this.checkCharacterRoomPosition();
        }
    }
    
    /**
     * Check if player has moved to a different room without using a doorway
     */
    checkCharacterRoomPosition() {
        const characterPos = this.character.position;
        const currentRoomId = this.getCurrentRoomId();
        
        // Check if character is in the active room's boundaries
        let isInActiveRoom = false;
        
        if (this.activeRoom) {
            const room = this.activeRoom;
            const halfWidth = room.dimensions.width / 2;
            const halfDepth = room.dimensions.depth / 2;
            
            // Calculate room bounds
            const minX = room.position.x - halfWidth;
            const maxX = room.position.x + halfWidth;
            const minZ = room.position.z - halfDepth;
            const maxZ = room.position.z + halfDepth;
            
            // Check if character is within bounds
            isInActiveRoom = (
                characterPos.x >= minX && characterPos.x <= maxX &&
                characterPos.z >= minZ && characterPos.z <= maxZ
            );
        }
        
        // If character is not in active room, find which room they're in
        if (!isInActiveRoom) {
            for (const [roomId, room] of Object.entries(this.rooms)) {
                if (roomId === currentRoomId) continue; // Skip current room
                
                const halfWidth = room.dimensions.width / 2;
                const halfDepth = room.dimensions.depth / 2;
                
                // Calculate room bounds
                const minX = room.position.x - halfWidth;
                const maxX = room.position.x + halfWidth;
                const minZ = room.position.z - halfDepth;
                const maxZ = room.position.z + halfDepth;
                
                // Check if character is within this room's bounds
                const isInRoom = (
                    characterPos.x >= minX && characterPos.x <= maxX &&
                    characterPos.z >= minZ && characterPos.z <= maxZ
                );
                
                if (isInRoom) {
                    console.log(`Character has moved to room ${roomId} without using a doorway`);
                    this.transitionToRoom(roomId, null);
                    break;
                }
            }
        }
    }
    
    /**
     * Get current room ID
     */
    getCurrentRoomId() {
        for (const [id, room] of Object.entries(this.rooms)) {
            if (room === this.activeRoom) {
                return id;
            }
        }
        return "unknown";
    }
    
    /**
     * Get objects to render - includes room layout objects
     */
    getRenderObjects() {
        const renderObjects = super.getRenderObjects();
        
        // Add room layout objects
        for (const room of Object.values(this.rooms)) {
            if (room && room.getAllPhysicsObjects) {
                renderObjects.push(...room.getAllPhysicsObjects());
            }
        }
        
        return renderObjects;
    }
    
    /**
     * Draw house-specific GUI
     */
    drawSceneGUI() {
        this.guiCtx.font = "20px Arial";
        this.guiCtx.fillStyle = "white";
        this.guiCtx.textAlign = "left";
        this.guiCtx.textBaseline = "top";

        this.guiCtx.fillText("Indoor Scene Mode", 10, 30);
        
        if (this.returnInfo && this.returnInfo.sceneName) {
            this.guiCtx.fillText(`Press Action5 to return to ${this.returnInfo.sceneName}`, 10, 60);
        } else {
            this.guiCtx.fillText("Press Action5 to exit", 10, 60);
        }
        
        if (this.activeRoom) {
            const roomId = this.getCurrentRoomId();
            this.guiCtx.fillText(`Current room: ${roomId}`, 10, 90);
            
            // Display camera info for debugging
            if (this.debugInfo) {
                this.guiCtx.font = "16px Arial";
                this.guiCtx.fillText(`Camera: x:${Math.round(this.camera.position.x)}, y:${Math.round(this.camera.position.y)}, z:${Math.round(this.camera.position.z)}`, 10, 120);
                this.guiCtx.fillText(`Room: ${roomId} at x:${Math.round(this.activeRoom.position.x)}, y:${Math.round(this.activeRoom.position.y)}, z:${Math.round(this.activeRoom.position.z)}`, 10, 145);
                
                if (this.roomTransitions.length > 0) {
                    this.guiCtx.fillStyle = "yellow";
                    this.guiCtx.fillText(`Camera transition in progress: ${Math.round(this.roomTransitions[0].progress * 100)}%`, 10, 170);
                }
                
                // Show return info if available
                if (this.returnInfo) {
                    this.guiCtx.fillText(`Will return to: ${this.returnInfo.sceneName} at x:${Math.round(this.returnInfo.position.x)}, z:${Math.round(this.returnInfo.position.z)}`, 10, 195);
                }
            }
        }
    }
    
    /**
     * Clean up house-specific resources
     */
    sceneCleanup() {
        console.log('HouseScene: Cleaning up house scene');
        
        // Clean up the point light if it exists
        if (this.pointLight && this.renderer3D && this.renderer3D.lightManager) {
            console.log("HouseScene: Removing point light");
            this.renderer3D.lightManager.removeLight(this.pointLight);
            this.pointLight = null;
        }
        
        // Clean up rooms
        for (const room of Object.values(this.rooms)) {
            if (room && room.cleanup) {
                room.cleanup();
            }
        }
        
        this.rooms = {};
        this.activeRoom = null;
        this.roomTransitions = [];
        this.returnInfo = null;
    }
}
