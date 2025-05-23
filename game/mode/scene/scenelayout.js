// game/mode/scene/scenelayout.js

/**
 * SceneLayout - Base class for all scene layouts
 * 
 * This base class provides common functionality for creating physics objects,
 * managing portals, and handling object collections that are shared between
 * TownLayout, RoomLayout, and other layout types.
 */
class SceneLayout {
    constructor(physicsWorld, position = new Vector3(0, 0, 0), dimensions = {width: 100, height: 30, depth: 100}) {
        this.physicsWorld = physicsWorld;
        this.position = position;
        this.dimensions = dimensions;
        
        // Common type color mapping - can be extended by subclasses
        this.typeColors = {
            // Structural elements
            "ground": "#7CFC00",         // Lawn Green
            "floor": "#8B4513",          // Brown
            "ceiling": "#696969",        // Dim Gray
            "wall": "#A9A9A9",           // Dark Gray
            "path": "#D2B48C",          // Tan
            
            // Buildings and structures
            "building": "#CD853F",      // Peru
            "building_roof": "#800000", // Maroon
            
            // Portals and triggers
            "building_entrance": "#0000FF80", // Semi-transparent Blue
            "doorway": "#0000FF80",       // Semi-transparent Blue
            "exit_door": "#00FF0080",     // Semi-transparent Green
            "world_exit": "#00FF0080",    // Semi-transparent Green
            "trigger": "#FFD70080",       // Semi-transparent Gold
            
            // Decorative elements
            "decoration": "#FF6347",     // Tomato
            "obstacle": "#A9A9A9",       // Dark Gray
            "water": "#00BFFF",          // Deep Sky Blue
            
            // Furniture
            "chest": "#CD853F",          // Peru
            "chair": "#DEB887",          // Burlywood
            "table": "#D2B48C"           // Tan
        };
        
        // Portal management
        this.portals = [];
        
        // Object tracking
        this.objects = this.initializeObjectCollections();
        
        // Layout-specific properties that subclasses can override
        this.spawnPosition = new Vector3(position.x, position.y + 2, position.z);
    }
    
    /**
     * Initialize object collections - can be overridden by subclasses
     */
    initializeObjectCollections() {
        return {
            structural: [], // floors, walls, ceilings
            decorative: [], // decorations, furniture
            interactive: [] // portals, triggers
        };
    }
    
    /**
     * Create a standard physics box with common properties
     */
    createPhysicsBox(dimensions, mass, position, color, options = {}) {
        const box = new ActionPhysicsBox3D(
            this.physicsWorld,
            dimensions.width,
            dimensions.height,
            dimensions.depth,
            mass,
            position,
            color,
            options
        );
        
        return box;
    }
    
    /**
     * Add a physics object to the world with common setup
     */
    addPhysicsObject(physicsObject, objectType, collection = 'structural') {
        physicsObject.objectType = objectType;
        this.physicsWorld.addObject(physicsObject);
        
        if (this.objects[collection]) {
            this.objects[collection].push(physicsObject);
        }
        
        return physicsObject;
    }
    
    /**
     * Create a decorative object (non-collidable)
     */
    addDecoration(position, dimensions = {width: 4, height: 4, depth: 4}, type = "decoration", options = {}) {
        const color = this.typeColors[type] || this.typeColors["decoration"];
        const decoration = this.createPhysicsBox(dimensions, 0, position, color, options);
        
        // Set collision properties if specified
        if (options.collidable) {
            decoration.body.collision_groups = 2;
        }
        
        return this.addPhysicsObject(decoration, type, 'decorative');
    }
    
    /**
     * Create an obstacle (collidable decoration)
     */
    addObstacle(position, dimensions = {width: 5, height: 5, depth: 5}, color = null) {
        const obstacleColor = color || this.typeColors["obstacle"];
        const obstacle = this.createPhysicsBox(dimensions, 0, position, obstacleColor);
        obstacle.body.collision_groups = 2; // Make it collidable
        
        return this.addPhysicsObject(obstacle, "obstacle", 'structural');
    }
    
    /**
     * Create a portal using the TriggerPortal system
     */
    addPortal(portalData) {
        const portal = new TriggerPortal(this.physicsWorld, portalData);
        this.portals.push(portal);
        
        // Also track in objects for consistency
        if (this.objects.interactive) {
            this.objects.interactive.push(portal);
        }
        
        return portal;
    }
    
    /**
     * Create a scene transition portal
     */
    addSceneTransitionPortal(position, dimensions, targetScene, sceneManager, options = {}) {
        const portalData = TriggerPortal.createSceneTransitionData(
            position, dimensions, targetScene, sceneManager, options
        );
        return this.addPortal(portalData);
    }
    
    /**
     * Create a world exit portal
     */
    addWorldExitPortal(position, dimensions, gameModeManager, options = {}) {
        const portalData = TriggerPortal.createWorldExitData(
            position, dimensions, gameModeManager, options
        );
        return this.addPortal(portalData);
    }
    
    /**
     * Create a scene exit portal
     */
    addSceneExitPortal(position, dimensions, sceneMode, options = {}) {
        const portalData = TriggerPortal.createSceneExitData(
            position, dimensions, sceneMode, options
        );
        return this.addPortal(portalData);
    }
    
    /**
     * Create a room transition portal (for indoor scenes)
     */
    addRoomTransitionPortal(position, dimensions, targetRoomId, entryDirection, sceneMode, options = {}) {
        const portalData = TriggerPortal.createRoomTransitionData(
            position, dimensions, targetRoomId, entryDirection, sceneMode, options
        );
        return this.addPortal(portalData);
    }
    
    /**
     * Create a custom portal with callback
     */
    addCustomPortal(position, dimensions, onActivate, options = {}) {
        const portalData = TriggerPortal.createCustomData(
            position, dimensions, onActivate, options
        );
        return this.addPortal(portalData);
    }
    
    /**
     * Set the spawn position for characters entering this layout
     */
    setSpawnPosition(position) {
        this.spawnPosition = position;
    }
    
    /**
     * Get the spawn position for characters entering this layout
     */
    getSpawnPosition() {
        return this.spawnPosition;
    }
    
    /**
     * Check if a point is within the layout boundaries
     */
    containsPoint(point) {
        const halfWidth = this.dimensions.width / 2;
        const halfDepth = this.dimensions.depth / 2;
        
        return (
            point.x >= this.position.x - halfWidth &&
            point.x <= this.position.x + halfWidth &&
            point.z >= this.position.z - halfDepth &&
            point.z <= this.position.z + halfDepth
        );
    }
    
    /**
     * Get the bounds of this layout
     */
    getBounds() {
        const halfWidth = this.dimensions.width / 2;
        const halfDepth = this.dimensions.depth / 2;
        
        return {
            minX: this.position.x - halfWidth,
            maxX: this.position.x + halfWidth,
            minZ: this.position.z - halfDepth,
            maxZ: this.position.z + halfDepth
        };
    }
    
    /**
     * Clean up all objects in this layout
     */
    cleanup() {
        // Clean up portals
        for (const portal of this.portals) {
            portal.destroy();
        }
        this.portals = [];
        
        // Clean up physics objects
        for (const collection of Object.values(this.objects)) {
            if (Array.isArray(collection)) {
                for (const obj of collection) {
                    if (obj && this.physicsWorld) {
                        this.physicsWorld.removeObject(obj);
                    }
                }
                collection.length = 0;
            }
        }
    }
    
    /**
     * Abstract method that subclasses should implement to create their specific layout
     */
    createLayout() {
        throw new Error('SceneLayout.createLayout() must be implemented by subclasses');
    }
    
    /**
     * Get all physics objects in this layout for rendering
     */
    getAllPhysicsObjects() {
        const allObjects = [];
        
        for (const collection of Object.values(this.objects)) {
            if (Array.isArray(collection)) {
                allObjects.push(...collection);
            }
        }
        
        // Add portal physics objects
        for (const portal of this.portals) {
            if (portal.physicsObject) {
                allObjects.push(portal.physicsObject);
            }
        }
        
        return allObjects;
    }
}
