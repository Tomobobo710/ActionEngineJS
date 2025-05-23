// game/mode/scene/indoorscenemode.js

/**
 * DEPRECATED: IndoorSceneMode has been replaced by HouseScene
 * 
 * This file is kept for reference but is no longer used in the new architecture.
 * Indoor functionality is now handled by:
 * - HouseScene (extends BaseGameScene) for the scene logic
 * - RoomLayout (extends SceneLayout) for room construction
 * - SceneManager for coordination
 * 
 * The new system provides better separation of concerns and is more extensible.
 * 
 * @deprecated Use HouseScene instead
 */
class IndoorSceneMode {
    constructor(canvases, input, audio, gameModeManager) {
        this.canvases = canvases;
        this.input = input;
        this.audio = audio;
        this.gameModeManager = gameModeManager;
        this.isPaused = false;
        
        this.initializeMode();
        
        // Create a character
        this.character = new ActionFixedPerspectiveCharacter3D(this.camera, this);
        this.physicsWorld.objects.add(this.character);
        
        // Position character
        this.character.body.position.set(0, 5, 0);
        
        // Add character's rigid body to physics world
        this.physicsWorld.getWorld().addRigidBody(this.character.body);
        
        window.gameCharacter = this.character;
        
        // Initialize room data
        this.rooms = {};
        this.activeRoom = null;
        this.roomTransitions = [];
        
        // Store return information
        this.returnToInfo = null; // {mode, sceneName, position}
        
        // Fade transition
        this.fadeOpacity = 0;
        
        // Debug info tracking
        this.debugInfo = true;
        
        // Make scene mode globally accessible for debugging
        window.indoorSceneMode = this;
    }

    initializeMode() {
        this.gameCanvas3D = this.canvases.gameCanvas;
        this.gameCanvas3DCtx = this.gameCanvas3D.getContext("webgl2") || this.gameCanvas3D.getContext("webgl");
        this.guiCanvas = this.canvases.guiCanvas;
        this.guiCtx = this.guiCanvas.getContext("2d");
        this.debugCanvas = this.canvases.debugCanvas;

        this.renderer3D = new ActionRenderer3D(this.gameCanvas3D);
        this.physicsWorld = new ActionPhysicsWorld3D();
        this.camera = new ActionCamera();
        this.lastTime = performance.now();
        this.deltaTime = 0;
        
        // Set up fixed camera position for indoor scenes
        this.camera.position = new Vector3(0, 30, 60);
        this.camera.target = new Vector3(0, 10, 0);
        
        // Make sure the camera is not attached to the character
        this.camera.isDetached = true;
        
        // Disable directional light for indoors
        if (this.renderer3D && this.renderer3D.lightManager) {
            this.renderer3D.lightManager.setMainDirectionalLightEnabled(false);
        }
        
        // Add an omnidirectional light to the center of the scene
        if (this.renderer3D && this.renderer3D.lightManager) {
            // Create position in the middle of where the scene will be
            const lightPos = new Vector3(0, 15, 0);
            
            // Create warm light color for the scene
            const lightColor = new Vector3(1.0, 0.9, 0.7);
            
            // Create the point light with good intensity and radius
            this.pointLight = this.renderer3D.lightManager.createPointLight(
                lightPos,         // Position
                lightColor,       // Light color
                2.0,              // Intensity
                80.0,             // Radius
                true              // Cast shadows
            );
            
            console.log("[IndoorSceneMode] Created omnidirectional light in scene center");
        }
    }
    
    /**
     * Create a demo of multiple connected rooms
     */
    generateDemoRooms() {
        if (this.physicsWorld) {
            this.physicsWorld.reset();
            
            // Set better gravity for character control
            this.physicsWorld.getWorld().gravity.y = -12; // Slightly stronger gravity
        }

        // Create a new room with ID "entry"
        this.rooms["entry"] = new RoomLayout(
            this.physicsWorld,
            new Vector3(0, 0, 0),
            {width: 60, height: 30, depth: 60}
        );
        
        // Set reference to scene mode for callbacks
        this.rooms["entry"].indoorSceneMode = this;
        this.rooms["entry"].createBasicStructure();
        
        // Create a second room - "bedroom"
        this.rooms["bedroom"] = new RoomLayout(
            this.physicsWorld,
            new Vector3(100, 0, 0),
            {width: 40, height: 20, depth: 40}
        );
        this.rooms["bedroom"].indoorSceneMode = this;
        this.rooms["bedroom"].createBasicStructure();
        
        // Create a third room - "house1"
        this.rooms["house1"] = new RoomLayout(
            this.physicsWorld,
            new Vector3(-100, 0, 0),
            {width: 50, height: 25, depth: 50}
        );
        this.rooms["house1"].indoorSceneMode = this;
        this.rooms["house1"].createBasicStructure();
        
        // Create a shop room - "shop1"
        this.rooms["shop1"] = new RoomLayout(
            this.physicsWorld,
            new Vector3(0, 0, -100),
            {width: 70, height: 40, depth: 70}
        );
        this.rooms["shop1"].indoorSceneMode = this;
        this.rooms["shop1"].createBasicStructure();
        
        // Create a house2 room
        this.rooms["house2"] = new RoomLayout(
            this.physicsWorld,
            new Vector3(100, 0, -100),
            {width: 45, height: 22, depth: 45}
        );
        this.rooms["house2"].indoorSceneMode = this;
        this.rooms["house2"].createBasicStructure();
        
        // Add some furniture to make house2 more visible/interesting
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
        
        // Add an exit to the outdoor world - Default exit for demo rooms
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
        
        // Set the active room based on parameters or default to entry
        let roomToActivate = "entry";
        if (this.initialRoomId && this.rooms[this.initialRoomId]) {
            roomToActivate = this.initialRoomId;
        }
        
        // Activate the room
        this.activateRoom(roomToActivate);
        
        console.log(`[IndoorSceneMode] Demo rooms created, activated room: ${roomToActivate}`);
    }
    
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
            console.log(`[IndoorSceneMode] Moved omnidirectional light to room ${roomId}`);
        }
        
        // Position the camera immediately if no animation is in progress
        if (room.cameraPosition && !this.roomTransitions.some(anim => anim.type === 'camera_transition')) {
            this.camera.position = room.cameraPosition.clone();
            this.camera.target = room.position.clone();
            this.camera.target.y += 10; // Look at the center of the room
            console.log(`[IndoorSceneMode] Camera positioned at:`, this.camera.position);
        }
        
        // Position the character if it's a new room entry
        if (room.entrancePosition) {
            this.character.body.position.set(
                room.entrancePosition.x,
                room.entrancePosition.y,
                room.entrancePosition.z
            );
            
            // Reset velocity to prevent carrying momentum between rooms
            this.character.body.linear_velocity.set(0, 0, 0);
            this.character.body.angular_velocity.set(0, 0, 0);
            console.log(`[IndoorSceneMode] Character positioned at:`, room.entrancePosition);
        } else {
            // Default position if no entrance is defined
            this.character.body.position.set(
                room.position.x,
                room.position.y + 5, // Default height off the ground
                room.position.z
            );
            console.log(`[IndoorSceneMode] No entrance position, using default at:`, this.character.body.position);
        }
        
        console.log(`Activated room: ${roomId}`);
    }
    
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
                console.log("Camera transition complete!");
            }
        });
    }
    
    // Easing function for smooth animation
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
    
    /**
     * Start a fade transition for smooth scene changes
     */
    startFadeTransition(duration = 0.5, fadeOut = true, onComplete = null) {
        // Create a fade transition
        this.roomTransitions.push({
            type: 'fade_transition',
            progress: 0,
            duration: duration,
            fadeOut: fadeOut,
            opacity: fadeOut ? 0 : 1,
            onUpdate: (progress) => {
                // Update fade opacity
                if (fadeOut) {
                    this.fadeOpacity = progress;
                } else {
                    this.fadeOpacity = 1 - progress;
                }
            },
            onComplete: () => {
                console.log("Fade transition complete!");
                if (onComplete) onComplete();
            }
        });
    }
    
    update(deltaTime) {
        // Store deltaTime for components that need it
        this.deltaTime = deltaTime;

        if (!this.isPaused) {
            this.handleInput();
            
            // Update any room transitions
            this.updateRoomTransitions(this.deltaTime);
            
            // Debug camera positions
            if (this.debugInfo && this.frameCount % 60 === 0) {
                // Log camera position every 60 frames
                const roomId = this.getCurrentRoomId();
                console.log(`[IndoorSceneMode] Current room: ${roomId}`);
                console.log(`[IndoorSceneMode] Camera: `, this.camera.position);
                console.log(`[IndoorSceneMode] Target: `, this.camera.target);
            }
        }
        
        // Frame counter for debugging
        this.frameCount = (this.frameCount || 0) + 1;
    }
    
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
                
                // Debug info
                if (anim.type === 'camera_transition') {
                    console.log(`Camera transition complete. Camera at:`, this.camera.position);
                    console.log(`Camera looking at:`, this.camera.target);
                }
                if (anim.type === 'fade_transition') {
                    console.log(`Fade transition complete. Opacity:`, this.fadeOpacity);
                }
            } else {
                // Update animation
                if (anim.onUpdate) {
                    anim.onUpdate(anim.progress);
                }
            }
        }
    }
    
    fixed_update(fixedDeltaTime) {
        if (this.isPaused) return;
        
        // Physics simulation belongs in fixed update
        this.physicsWorld.fixed_update(fixedDeltaTime);
        
        // Character physics-related updates
        if (this.character && typeof this.character.fixed_update === 'function') {
            this.character.fixed_update(fixedDeltaTime);
        }
        
        // Check if character has moved to a new room
        if (this.character && this.activeRoom) {
            this.checkCharacterRoomPosition();
        }
    }
    
    // Check if player has moved to a different room without using a doorway
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
    
    drawSceneUI() {
        this.guiCtx.save();

        // Draw fade overlay if we're transitioning
        if (this.fadeOpacity > 0) {
            this.guiCtx.fillStyle = `rgba(0, 0, 0, ${this.fadeOpacity})`;
            this.guiCtx.fillRect(0, 0, this.guiCanvas.width, this.guiCanvas.height);
        }

        this.guiCtx.font = "20px Arial";
        this.guiCtx.fillStyle = "white";
        this.guiCtx.textAlign = "left";
        this.guiCtx.textBaseline = "top";

        this.guiCtx.fillText("Indoor Scene Mode", 10, 30);
        
        if (this.returnToInfo && this.returnToInfo.sceneName) {
            this.guiCtx.fillText(`Press Action5 to return to ${this.returnToInfo.sceneName}`, 10, 60);
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
                if (this.returnToInfo) {
                    this.guiCtx.fillText(`Will return to: ${this.returnToInfo.sceneName} at x:${Math.round(this.returnToInfo.position.x)}, z:${Math.round(this.returnToInfo.position.z)}`, 10, 195);
                }
            }
        }

        this.guiCtx.restore();
    }
    
    getCurrentRoomId() {
        for (const [id, room] of Object.entries(this.rooms)) {
            if (room === this.activeRoom) {
                return id;
            }
        }
        return "unknown";
    }
    
    handleInput() {
        if (this.character) {
            this.character.applyInput(this.input, this.deltaTime);
            // Visual updates only (physics now in fixed_update)
            this.character.update(this.deltaTime);
        }
        
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
            if (this.returnToInfo && this.returnToInfo.mode) {
                console.log(`Exiting to ${this.returnToInfo.mode} mode, scene: ${this.returnToInfo.sceneName}`);
                
                // Return to SceneMode with the town name we came from
                if (this.returnToInfo.mode === "scene" && this.returnToInfo.sceneName) {
                    const returnParams = {
                        returnFromIndoor: true,
                        returnToTown: this.returnToInfo.sceneName,
                        returnPosition: this.returnToInfo.position
                    };
                    this.gameModeManager.switchModeWithParams("scene", returnParams);
                } else {
                    // Default to world map
                    this.gameModeManager.switchMode("world");
                }
            } else {
                // Default to world map if no return info
                this.gameModeManager.switchMode("world");
            }
        });
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
    
    cleanup() {
        // Clean up the point light if it exists
        if (this.pointLight && this.renderer3D && this.renderer3D.lightManager) {
            console.log("[IndoorSceneMode] Removing point light");
            this.renderer3D.lightManager.removeLight(this.pointLight);
            this.pointLight = null;
        }
        
        if (this.physicsWorld) {
            this.physicsWorld.reset();
            this.physicsWorld = null;
        }

        this.character = null;
        this.renderer3D = null;
        this.camera = null;
        this.rooms = {};
        this.activeRoom = null;
        this.roomTransitions = [];
        this.fadeOpacity = 0;

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