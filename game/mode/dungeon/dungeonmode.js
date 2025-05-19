// game/mode/dungeon/dungeonmode.js

class DungeonMode {
    constructor(canvases, input, audio, gameModeManager) {
        this.canvases = canvases;
        this.input = input;
        this.audio = audio;
        this.gameModeManager = gameModeManager;
        this.isPaused = false;

        this.initializeMode();
        
        this.character = new ActionCharacter3D(this.camera, this);
        this.physicsWorld.objects.add(this.character.characterModel);
        
        this.character.body.position.set(0, 24, 0); // Higher position for larger room
        window.gameCharacter = this.character;
        
        // Set character debugName for contact detection
        if (this.character.characterModel && this.character.characterModel.body) {
            this.character.characterModel.body.debugName = 'Character';
        }
        if (this.character.body) {
            this.character.body.debugName = 'Character';
        }
        
        this.terrain = null;
        this.doorAnimations = [];
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
        
        this.generateDungeon();
        this.setupPointLight();
        this.setupGreenPointLight(); // Add a second point light (green) in the south room
        this.setupBlueLight(); // Add a third point light (blue) in the north room
    }
    
    /**
     * Set up an omnidirectional point light in the entrance room
     */
    setupPointLight() {
        // Create a point light in the center of the entrance room (if we have access to the light manager)
        if (this.renderer3D && this.renderer3D.lightManager) {
            // Position the light in the middle of the entrance room
            const lightPos = new Vector3(
                this.entranceRoom.position.x,
                this.entranceRoom.position.y + this.entranceRoom.dimensions.height / 2,  // Position at half height
                this.entranceRoom.position.z
            );
            
            // Create color for the light
            const lightColor = new Vector3(1.0, 0.9, 1.0);
            
            // Create the point light
            this.pointLight = this.renderer3D.lightManager.createPointLight(
                lightPos,         // Position
                lightColor,       // Light color
                1.0,              // Intensity - increase for better visibility with directional light
                500.0,            // Radius
                true              // Cast shadows
            );
            
            console.log("[DungeonMode] Created omnidirectional shadow light in entrance room");
            console.log(`[DungeonMode] Light manager now has ${this.renderer3D.lightManager.pointLights.length} point lights`);
        }
    }
    
    /**
     * Set up a green omnidirectional point light in the south room
     */
    setupGreenPointLight() {
        // Make sure south room and light manager exist
        if (!this.southRoom || !this.renderer3D || !this.renderer3D.lightManager) {
            console.warn("[DungeonMode] Cannot create green light - south room or light manager not available");
            return;
        }
            
        // Position the light in the middle of the south room
        const lightPos = new Vector3(
            this.southRoom.position.x,
            this.southRoom.position.y + this.southRoom.dimensions.height / 2,  // Position at half height
            this.southRoom.position.z
        );
        
        // Create a green color for the light
        const lightColor = new Vector3(0.2, 1.0, 0.3);
        
        // Create the point light
        this.greenPointLight = this.renderer3D.lightManager.createPointLight(
            lightPos,         // Position
            lightColor,       // Light color
            1.0,              // Intensity - slightly brighter than the first light
            400.0,            // Radius - slightly smaller than the first light
            true              // Cast shadows
        );
        
        console.log("[DungeonMode] Created green omnidirectional shadow light in south room");
        console.log(`[DungeonMode] Light manager now has ${this.renderer3D.lightManager.pointLights.length} point lights`);
    }
    
    /**
     * Set up a blue omnidirectional point light in the north room
     */
    setupBlueLight() {
        // Make sure north room and light manager exist
        if (!this.northRoom || !this.renderer3D || !this.renderer3D.lightManager) {
            console.warn("[DungeonMode] Cannot create blue light - north room or light manager not available");
            return;
        }
            
        // Position the light in the middle of the north room
        const lightPos = new Vector3(
            this.northRoom.position.x,
            this.northRoom.position.y + this.northRoom.dimensions.height / 2,  // Position at half height
            this.northRoom.position.z
        );
        
        // Create a blue color for the light
        const lightColor = new Vector3(0.2, 0.4, 1.0);
        
        // Create the point light
        this.bluePointLight = this.renderer3D.lightManager.createPointLight(
            lightPos,         // Position
            lightColor,       // Light color
            1.0,              // Intensity
            350.0,            // Radius
            true             // Don't cast shadows (to test non-shadow light)
        );
        
        console.log("[DungeonMode] Created blue omnidirectional light in north room");
        console.log(`[DungeonMode] Light manager now has ${this.renderer3D.lightManager.pointLights.length} point lights`);
    }

    generateDungeon() {
        if (this.physicsWorld) {
            this.physicsWorld.reset();
        }

        this.rooms = [];
        
        // Create rooms with 4x larger dimensions
        this.entranceRoom = new DungeonRoom(
            this.physicsWorld, 
            new Vector3(0, 0, 0), 
            {width: 160, height: 80, depth: 160} // 4x original size
        );
        // Set reference to dungeonMode for callbacks
        this.entranceRoom.dungeonMode = this;
        this.entranceRoom.worldMode = this;
        this.entranceRoom.createBasicStructure();
        
        const northRoomDimensions = {width: 80, height: 80, depth: 80}; // 4x original size
        const northRoomPosition = this.entranceRoom.calculateConnectingRoomPosition(
            northRoomDimensions, 
            "north"
        );
        
        this.northRoom = new DungeonRoom(
            this.physicsWorld, 
            northRoomPosition,
            northRoomDimensions
        );
        // Set reference to dungeonMode for callbacks
        this.northRoom.dungeonMode = this;
        this.northRoom.worldMode = this;
        this.northRoom.createBasicStructure();
        
        const southRoomDimensions = {width: 80, height: 80, depth: 80}; // 4x original size
        const southRoomPosition = this.entranceRoom.calculateConnectingRoomPosition(
            southRoomDimensions, 
            "south"
        );
        
        this.southRoom = new DungeonRoom(
            this.physicsWorld,
            southRoomPosition,
            southRoomDimensions
        );
        // Set reference to dungeonMode for callbacks
        this.southRoom.dungeonMode = this;
        this.southRoom.worldMode = this;
        this.southRoom.createBasicStructure();
        
        // Connect rooms
        this.entranceRoom.connectTo(this.northRoom, "north", 8, 16);
        this.entranceRoom.connectTo(this.southRoom, "south", 8, 16);
        
        // Make sure the connecting doors are properly configured
        this.entranceRoom.doorStates["north"] = true; // Closed door
        this.northRoom.doorStates["south"] = false; // Open doorway
        
        // Remove the door object from the north room to make it a doorway
        if (this.northRoom.objects.doors["south"]) {
            this.physicsWorld.removeObject(this.northRoom.objects.doors["south"]);
            this.northRoom.objects.doors["south"] = null;
        }
        
        // South connection: closed door in entrance room, open doorway in south room
        this.entranceRoom.doorStates["south"] = true; // Closed door
        this.southRoom.doorStates["north"] = false; // Open doorway
        
        // Remove the door object from the south room to make it a doorway
        if (this.southRoom.objects.doors["north"]) {
            this.physicsWorld.removeObject(this.southRoom.objects.doors["north"]);
            this.southRoom.objects.doors["north"] = null;
        }
        
        this.worldPortal = this.southRoom.addWorldPortal("south");
        
        // Position triggers for the larger rooms
        this.northDoorTrigger = this.entranceRoom.addTrigger(
            new Vector3(
                this.entranceRoom.position.x + 40, // Scaled offset (1/4 of room width)
                this.entranceRoom.position.y + 5, // Positioned at half the trigger height
                this.entranceRoom.position.z
            ),
            {width: 6, height: 10, depth: 6}, // Taller to ensure contact with character
            "pressure_plate"
        );
        
        this.southDoorTrigger = this.northRoom.addTrigger(
            new Vector3(
                this.northRoom.position.x, // Centered in room
                this.northRoom.position.y + 5, // Positioned at half the trigger height
                this.northRoom.position.z // Centered in room (not offset)
            ),
            {width: 6, height: 10, depth: 6}, // Taller to ensure contact with character
            "pressure_plate"
        );
        
        this.rooms.push(this.entranceRoom, this.northRoom, this.southRoom);
    }

    checkTriggers() {
        // This method is now empty as we're using contact-based detection instead of distance-based
        // All trigger logic is handled by the contact listeners on the objects themselves
    }

    startSlowDoorOpen(room, direction) {
        const door = room.objects.doors[direction];
        if (!door || !room.doorStates[direction]) return;
        
        if (!door.originalPosition) {
            door.originalPosition = new Vector3(
                door.body.position.x,
                door.body.position.y,
                door.body.position.z
            );
        }
        
        room.doorStates[direction] = "opening";
        
        const targetY = room.position.y + room.dimensions.height * 2;
        
        this.doorAnimations.push({
            door: door,
            room: room,
            direction: direction,
            startY: door.body.position.y,
            targetY: targetY,
            progress: 0,
            duration: 2.0,
            
            started: () => {
                if (this.audio && this.audio.playSoundEffect) {
                    this.audio.playSoundEffect("doorOpen");
                }
            }
        });
        
        this.doorAnimations[this.doorAnimations.length - 1].started();
    }
    
    updateDoorAnimations(deltaTime) {
        for (let i = this.doorAnimations.length - 1; i >= 0; i--) {
            const anim = this.doorAnimations[i];
            
            anim.progress += deltaTime / anim.duration;
            
            if (anim.progress >= 1.0) {
                anim.door.body.position.y = anim.targetY;
                anim.door.updateVisual();
                
                anim.room.doorStates[anim.direction] = false;
                
                this.doorAnimations.splice(i, 1);
            } else {
                const newY = anim.startY + (anim.targetY - anim.startY) * anim.progress;
                anim.door.body.position.y = newY;
                anim.door.updateVisual();
            }
        }
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
            
            // Ensure character has debugName for contact detection
            if (this.character && this.character.characterModel && this.character.characterModel.body) {
                if (!this.character.characterModel.body.debugName) {
                    this.character.characterModel.body.debugName = 'Character';
                }
            }
            
            // Non-physics updates only (physics now in fixed_update)
            this.updateDoorAnimations(this.deltaTime);
            // No need to call checkTriggers() anymore - using contact detection
        }
    }

    handleInput() {
        if (this.character) {
            this.character.applyInput(this.input, this.deltaTime);
            // Visual updates only (physics now in fixed_update)
            // We'll still call update for compatibility with non-physics aspects
            this.character.update(this.deltaTime);
        }
        
        // Switch shader variants with Numpad5 (same as world mode)
        if (this.input.isKeyJustPressed("Numpad5") && this.renderer3D) {
            const newVariant = this.renderer3D.programManager.cycleVariants();
            console.log(`[DungeonMode] Switched shader variant to: ${newVariant}`);
        }
        
        if (this.input.isKeyJustPressed("Action5")) {
            this.gameModeManager.switchMode("world");
        }
    }

    draw() {
        if (this.gameCanvas3DCtx) {
            this.gameCanvas3DCtx.clear(this.gameCanvas3DCtx.COLOR_BUFFER_BIT | this.gameCanvas3DCtx.DEPTH_BUFFER_BIT);
        }

        if (this.guiCtx) {
            this.guiCtx.clearRect(0, 0, 800, 600);
        }

        this.renderer3D.render({
            camera: this.camera,
            renderableObjects: [...Array.from(this.physicsWorld.objects)],
            showDebugPanel: false
        });

        if (this.guiCtx) {
            this.drawDungeonUI();
        }
    }

    drawDungeonUI() {
        this.guiCtx.save();

        this.guiCtx.font = "20px Arial";
        this.guiCtx.fillStyle = "white";
        this.guiCtx.textAlign = "left";
        this.guiCtx.textBaseline = "top";

        this.guiCtx.fillText("Dungeon Mode", 10, 30);
        this.guiCtx.fillText("Press Action5 to exit", 10, 60);

        this.guiCtx.restore();
    }

    cleanup() {
        // Clean up the point lights if they exist
        if (this.renderer3D && this.renderer3D.lightManager) {
            if (this.pointLight) {
                console.log("[DungeonMode] Removing entrance room point light");
                this.renderer3D.lightManager.removeLight(this.pointLight);
                this.pointLight = null;
            }
            
            if (this.greenPointLight) {
                console.log("[DungeonMode] Removing green point light");
                this.renderer3D.lightManager.removeLight(this.greenPointLight);
                this.greenPointLight = null;
            }
            
            if (this.bluePointLight) {
                console.log("[DungeonMode] Removing blue point light");
                this.renderer3D.lightManager.removeLight(this.bluePointLight);
                this.bluePointLight = null;
            }
            
            // Log the remaining point lights after cleanup
            console.log(`[DungeonMode] After cleanup, light manager has ${this.renderer3D.lightManager.pointLights.length} point lights`);
        }
        
        if (this.physicsWorld) {
            this.physicsWorld.reset();
            this.physicsWorld = null;
        }

        this.character = null;
        this.renderer3D = null;
        this.camera = null;

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