// game/mode/scene/triggerportal.js

/**
 * TriggerPortal - A universal portal system for scene transitions
 * 
 * This class encapsulates all the logic for creating transition portals between scenes,
 * rooms, or back to world map. It handles physics setup, collision detection, and 
 * transition callbacks in a consistent way.
 */
class TriggerPortal {
    constructor(physicsWorld, portalData) {
        this.physicsWorld = physicsWorld;
        this.portalData = portalData;
        this.physicsObject = null;
        this.isActive = true;
        
        // Validate required portal data
        this.validatePortalData();
        
        // Create the physics representation
        this.createPhysicsObject();
        
        // Set up collision handling
        this.setupCollisionHandling();
    }
    
    /**
     * Validate that portal data has all required fields
     */
    validatePortalData() {
        const required = ['position', 'dimensions', 'portalType'];
        for (const field of required) {
            if (!this.portalData[field]) {
                throw new Error(`TriggerPortal requires ${field} in portalData`);
            }
        }
        
        // Set defaults for optional fields
        this.portalData.color = this.portalData.color || this.getDefaultColor();
        this.portalData.debugName = this.portalData.debugName || `Portal_${this.portalData.portalType}`;
    }
    
    /**
     * Get default color based on portal type
     */
    getDefaultColor() {
        const colorMap = {
            'scene_transition': '#0000FF80',  // Semi-transparent Blue
            'room_transition': '#0000FF80',   // Semi-transparent Blue  
            'world_exit': '#00FF0080',        // Semi-transparent Green
            'scene_exit': '#00FF0080',        // Semi-transparent Green
            'custom': '#FFD70080'             // Semi-transparent Gold
        };
        
        return colorMap[this.portalData.portalType] || colorMap['custom'];
    }
    
    /**
     * Create the physics object for this portal
     */
    createPhysicsObject() {
        const {position, dimensions} = this.portalData;
        
        this.physicsObject = new ActionPhysicsBox3D(
            this.physicsWorld,
            dimensions.width,
            dimensions.height, 
            dimensions.depth,
            0, // mass = 0 for triggers
            position,
            this.portalData.color
        );
        
        // Set object properties
        this.physicsObject.objectType = this.portalData.portalType;
        this.physicsObject.portalData = this.portalData;
        
        // Store reference to this portal instance
        this.physicsObject.triggerPortal = this;
        
        // Add to physics world
        this.physicsWorld.addObject(this.physicsObject);
    }
    
    /**
     * Set up collision handling for character detection
     */
    setupCollisionHandling() {
        const body = this.physicsObject.body;
        body.debugName = this.portalData.debugName;
        
        // Make this a trigger - character passes through
        body.addListener('preContact', (otherBody, contact) => {
            if (otherBody.debugName && otherBody.debugName.includes('Character')) {
                contact.restitution = 0;
                contact.friction = 0;
                contact.disabled = true; // Allow character to pass through
            }
        });
        
        // Handle portal activation
        body.addListener('contact', (otherBody, contact) => {
            // Only respond to character contacts
            if (!otherBody.debugName || !otherBody.debugName.includes('Character')) return;
            
            this.onCharacterContact();
        });
    }
    
    /**
     * Handle character contact with this portal
     */
    onCharacterContact() {
        if (!this.isActive) return;
        
        console.log(`Portal activated: ${this.portalData.portalType}`, this.portalData);
        
        // Execute the portal's callback
        if (this.portalData.onActivate) {
            this.portalData.onActivate(this.portalData);
        }
        
        // Call specific handler based on portal type
        switch(this.portalData.portalType) {
            case 'scene_transition':
                this.handleSceneTransition();
                break;
            case 'room_transition':
                this.handleRoomTransition();
                break;
            case 'world_exit':
                this.handleWorldExit();
                break;
            case 'scene_exit':
                this.handleSceneExit();
                break;
            case 'custom':
                // Custom portals handle everything in onActivate callback
                break;
        }
    }
    
    /**
     * Handle transition to a different scene type
     */
    handleSceneTransition() {
        const {targetScene, sceneManager} = this.portalData;
        
        if (sceneManager && targetScene) {
            console.log(`Transitioning to scene: ${targetScene.sceneType} - ${targetScene.sceneId}`);
            sceneManager.switchToScene(targetScene);
        } else {
            console.error('Scene transition portal missing sceneManager or targetScene data');
        }
    }
    
    /**
     * Handle transition between rooms in the same scene
     */
    handleRoomTransition() {
        const {targetRoomId, entryDirection, sceneMode} = this.portalData;
        
        if (sceneMode && targetRoomId) {
            console.log(`Transitioning to room: ${targetRoomId}`);
            sceneMode.transitionToRoom(targetRoomId, entryDirection);
        } else {
            console.error('Room transition portal missing sceneMode or targetRoomId');
        }
    }
    
    /**
     * Handle exit to world map
     */
    handleWorldExit() {
        const {gameModeManager} = this.portalData;
        
        if (gameModeManager) {
            console.log('Exiting to world map');
            // Use requestAnimationFrame to avoid physics update conflicts
            requestAnimationFrame(() => {
                gameModeManager.switchMode("world");
            });
        } else {
            console.error('World exit portal missing gameModeManager');
        }
    }
    
    /**
     * Handle exit to the previous scene
     */
    handleSceneExit() {
        const {sceneMode} = this.portalData;
        
        if (sceneMode && sceneMode.exitToReturnScene) {
            console.log('Exiting to return scene');
            sceneMode.exitToReturnScene();
        } else {
            console.error('Scene exit portal missing sceneMode or exitToReturnScene method');
        }
    }
    
    /**
     * Activate this portal
     */
    activate() {
        this.isActive = true;
    }
    
    /**
     * Deactivate this portal
     */
    deactivate() {
        this.isActive = false;
    }
    
    /**
     * Remove this portal from the physics world
     */
    destroy() {
        if (this.physicsObject) {
            this.physicsWorld.removeObject(this.physicsObject);
            this.physicsObject = null;
        }
    }
    
    /**
     * Create portal data for scene transitions
     */
    static createSceneTransitionData(position, dimensions, targetScene, sceneManager, options = {}) {
        return {
            position: position,
            dimensions: dimensions,
            portalType: 'scene_transition',
            targetScene: targetScene,
            sceneManager: sceneManager,
            color: options.color,
            debugName: options.debugName || `ScenePortal_${targetScene.sceneId}`,
            onActivate: options.onActivate
        };
    }
    
    /**
     * Create portal data for room transitions
     */
    static createRoomTransitionData(position, dimensions, targetRoomId, entryDirection, sceneMode, options = {}) {
        return {
            position: position,
            dimensions: dimensions,
            portalType: 'room_transition',
            targetRoomId: targetRoomId,
            entryDirection: entryDirection,
            sceneMode: sceneMode,
            color: options.color,
            debugName: options.debugName || `RoomPortal_${targetRoomId}`,
            onActivate: options.onActivate
        };
    }
    
    /**
     * Create portal data for world map exits
     */
    static createWorldExitData(position, dimensions, gameModeManager, options = {}) {
        return {
            position: position,
            dimensions: dimensions,
            portalType: 'world_exit',
            gameModeManager: gameModeManager,
            color: options.color,
            debugName: options.debugName || 'WorldExit',
            onActivate: options.onActivate
        };
    }
    
    /**
     * Create portal data for scene exits
     */
    static createSceneExitData(position, dimensions, sceneMode, options = {}) {
        return {
            position: position,
            dimensions: dimensions,
            portalType: 'scene_exit',
            sceneMode: sceneMode,
            color: options.color,
            debugName: options.debugName || 'SceneExit',
            onActivate: options.onActivate
        };
    }
    
    /**
     * Create portal data for custom portals
     */
    static createCustomData(position, dimensions, onActivate, options = {}) {
        return {
            position: position,
            dimensions: dimensions,
            portalType: 'custom',
            onActivate: onActivate,
            color: options.color,
            debugName: options.debugName || 'CustomPortal'
        };
    }
}
