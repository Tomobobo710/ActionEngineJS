// game/mode/scene/roomlayout.js

/**
 * RoomLayout - Represents a single room in an indoor environment
 * 
 * This class extends SceneLayout to manage the physical layout of a room, including 
 * walls, floors, doorways, and furniture. It handles the creation of the physical 
 * representation of the room and interactions with other rooms through doorways.
 */
class RoomLayout extends SceneLayout {
    constructor(physicsWorld, position = new Vector3(0, 0, 0), dimensions = {width: 60, height: 30, depth: 60}) {
        super(physicsWorld, position, dimensions);
        
        // Room-specific properties
        this.entrancePosition = null;
        this.cameraPosition = null;
        this.wallThickness = 2;
        
        // Room-specific object structure (extends base objects)
        this.roomObjects = {
            floor: null,
            ceiling: null,
            walls: { north: [], south: [], east: [], west: [] },
            doorways: {},
            furniture: []
        };
        
        // Legacy properties for compatibility
        this.doorwayStates = {};
        this.connections = {};
        this.entrances = {};
        }
    /**
     * Override createLayout to call the room-specific creation method
     */
    createLayout() {
        this.createBasicStructure();
    }
    
    /**
     * Override SceneLayout's object collections for room-specific structure
     */
    initializeObjectCollections() {
        return {
            structural: [], // walls, floor, ceiling
            decorative: [], // decorations, furniture  
            interactive: [], // portals, triggers, doorways
            
            // Room-specific collections that existing code expects
            floor: null,
            ceiling: null,
            walls: { north: [], south: [], east: [], west: [] },
            doorways: {},
            triggers: [],
            furniture: [],
            decorations: []
        };
    }
    
    createBasicStructure() {
        const {width, height, depth} = this.dimensions;
        const {x, y, z} = this.position;
        const wallThickness = this.wallThickness;
        
        // Create floor
        this.objects.floor = new ActionPhysicsBox3D(
            this.physicsWorld,
            width + wallThickness * 2,
            wallThickness,
            depth + wallThickness * 2,
            0,
            new Vector3(x, y - wallThickness/2, z),
            this.typeColors["floor"]
        );
        this.objects.floor.objectType = "floor";
        this.objects.floor.body.friction = 0.8;
        this.physicsWorld.addObject(this.objects.floor);
        
        // Create ceiling
        this.objects.ceiling = new ActionPhysicsBox3D(
            this.physicsWorld,
            width + wallThickness * 2,
            wallThickness,
            depth + wallThickness * 2,
            0,
            new Vector3(x, y + height + wallThickness/2, z),
            this.typeColors["ceiling"]
        );
        this.objects.ceiling.objectType = "ceiling";
        this.physicsWorld.addObject(this.objects.ceiling);
        
        // Create visible walls
        this.createFullWall("east");
        this.createFullWall("west");
        this.createFullWall("north", true); // north wall is invisible but provides collision
        this.createFullWall("south");
        
        return this;
    }

    createFullWall(direction, invisible = false) {
        const {width, height, depth} = this.dimensions;
        const {x, y, z} = this.position;
        const wallThickness = this.wallThickness;
        
        let wall;
        let options = { isVisible: !invisible };
        
        switch(direction) {
            case "north":
                wall = new ActionPhysicsBox3D(
                    this.physicsWorld,
                    width + wallThickness * 2,
                    height,
                    wallThickness,
                    0,
                    new Vector3(x, y + height/2, z + depth/2 + wallThickness/2),
                    this.typeColors["wall"],
                    options
                );
                break;
            case "south":
                wall = new ActionPhysicsBox3D(
                    this.physicsWorld,
                    width + wallThickness * 2,
                    height,
                    wallThickness,
                    0,
                    new Vector3(x, y + height/2, z - depth/2 - wallThickness/2),
                    this.typeColors["wall"],
                    options
                );
                break;
            case "east":
                wall = new ActionPhysicsBox3D(
                    this.physicsWorld,
                    wallThickness,
                    height,
                    depth,
                    0,
                    new Vector3(x + width/2 + wallThickness/2, y + height/2, z),
                    this.typeColors["wall"],
                    options
                );
                break;
            case "west":
                wall = new ActionPhysicsBox3D(
                    this.physicsWorld,
                    wallThickness,
                    height,
                    depth,
                    0,
                    new Vector3(x - width/2 - wallThickness/2, y + height/2, z),
                    this.typeColors["wall"],
                    options
                );
                break;
        }
        
        if (wall) {
            wall.objectType = "wall";
            wall.isInvisible = invisible; // Store for reference
            this.physicsWorld.addObject(wall);
            this.objects.walls[direction].push(wall);
        }
        
        return wall;
    }
    
    createWallOpening(direction, openingWidth = 12, openingHeight = 16) {
        const {width, height, depth} = this.dimensions;
        const {x, y, z} = this.position;
        const wallThickness = this.wallThickness;
        
        const maxWidth = (direction === "north" || direction === "south") ? 
                         width - wallThickness * 2 : depth - wallThickness * 2;
        openingWidth = Math.min(openingWidth, maxWidth);
        openingHeight = Math.min(openingHeight, height - wallThickness);
        
        if (this.objects.walls[direction].length > 0) {
            for (const wall of this.objects.walls[direction]) {
                this.physicsWorld.removeObject(wall);
            }
            this.objects.walls[direction] = [];
        }
        
        let openingPosition;
        let leftWall, rightWall, header;
        
        switch(direction) {
            case "north": {
                const sideWallWidth = (width + wallThickness * 2 - openingWidth) / 2;
                
                leftWall = new ActionPhysicsBox3D(
                    this.physicsWorld,
                    sideWallWidth,
                    height,
                    wallThickness,
                    0,
                    new Vector3(x - openingWidth/2 - sideWallWidth/2, y + height/2, z + depth/2 + wallThickness/2),
                    this.typeColors["wall"]
                );
                
                rightWall = new ActionPhysicsBox3D(
                    this.physicsWorld,
                    sideWallWidth,
                    height,
                    wallThickness,
                    0,
                    new Vector3(x + openingWidth/2 + sideWallWidth/2, y + height/2, z + depth/2 + wallThickness/2),
                    this.typeColors["wall"]
                );
                
                header = new ActionPhysicsBox3D(
                    this.physicsWorld,
                    openingWidth,
                    height - openingHeight,
                    wallThickness,
                    0,
                    new Vector3(x, y + openingHeight + (height - openingHeight)/2, z + depth/2 + wallThickness/2),
                    this.typeColors["wall"]
                );
                
                openingPosition = new Vector3(x, y + openingHeight/2, z + depth/2 + wallThickness/2);
                this.entrances[direction] = new Vector3(x, y + 1, z + depth/2 - 5);
                break;
            }
            case "south": {
                // Similar pattern for south direction
                const sideWallWidth = (width + wallThickness * 2 - openingWidth) / 2;
                
                leftWall = new ActionPhysicsBox3D(
                    this.physicsWorld,
                    sideWallWidth,
                    height,
                    wallThickness,
                    0,
                    new Vector3(x + openingWidth/2 + sideWallWidth/2, y + height/2, z - depth/2 - wallThickness/2),
                    this.typeColors["wall"]
                );
                
                rightWall = new ActionPhysicsBox3D(
                    this.physicsWorld,
                    sideWallWidth,
                    height,
                    wallThickness,
                    0,
                    new Vector3(x - openingWidth/2 - sideWallWidth/2, y + height/2, z - depth/2 - wallThickness/2),
                    this.typeColors["wall"]
                );
                
                header = new ActionPhysicsBox3D(
                    this.physicsWorld,
                    openingWidth,
                    height - openingHeight,
                    wallThickness,
                    0,
                    new Vector3(x, y + openingHeight + (height - openingHeight)/2, z - depth/2 - wallThickness/2),
                    this.typeColors["wall"]
                );
                
                openingPosition = new Vector3(x, y + openingHeight/2, z - depth/2 - wallThickness/2);
                this.entrances[direction] = new Vector3(x, y + 1, z - depth/2 + 5);
                break;
            }
            case "east": {
                // East opening
                const sideWallDepth = (depth - openingWidth) / 2;
                
                leftWall = new ActionPhysicsBox3D(
                    this.physicsWorld,
                    wallThickness,
                    height,
                    sideWallDepth,
                    0,
                    new Vector3(x + width/2 + wallThickness/2, y + height/2, z + openingWidth/2 + sideWallDepth/2),
                    this.typeColors["wall"]
                );
                
                rightWall = new ActionPhysicsBox3D(
                    this.physicsWorld,
                    wallThickness,
                    height,
                    sideWallDepth,
                    0,
                    new Vector3(x + width/2 + wallThickness/2, y + height/2, z - openingWidth/2 - sideWallDepth/2),
                    this.typeColors["wall"]
                );
                
                header = new ActionPhysicsBox3D(
                    this.physicsWorld,
                    wallThickness,
                    height - openingHeight,
                    openingWidth,
                    0,
                    new Vector3(x + width/2 + wallThickness/2, y + openingHeight + (height - openingHeight)/2, z),
                    this.typeColors["wall"]
                );
                
                openingPosition = new Vector3(x + width/2 + wallThickness/2, y + openingHeight/2, z);
                this.entrances[direction] = new Vector3(x + width/2 - 5, y + 1, z);
                break;
            }
            case "west": {
                // West opening
                const sideWallDepth = (depth - openingWidth) / 2;
                
                leftWall = new ActionPhysicsBox3D(
                    this.physicsWorld,
                    wallThickness,
                    height,
                    sideWallDepth,
                    0,
                    new Vector3(x - width/2 - wallThickness/2, y + height/2, z - openingWidth/2 - sideWallDepth/2),
                    this.typeColors["wall"]
                );
                
                rightWall = new ActionPhysicsBox3D(
                    this.physicsWorld,
                    wallThickness,
                    height,
                    sideWallDepth,
                    0,
                    new Vector3(x - width/2 - wallThickness/2, y + height/2, z + openingWidth/2 + sideWallDepth/2),
                    this.typeColors["wall"]
                );
                
                header = new ActionPhysicsBox3D(
                    this.physicsWorld,
                    wallThickness,
                    height - openingHeight,
                    openingWidth,
                    0,
                    new Vector3(x - width/2 - wallThickness/2, y + openingHeight + (height - openingHeight)/2, z),
                    this.typeColors["wall"]
                );
                
                openingPosition = new Vector3(x - width/2 - wallThickness/2, y + openingHeight/2, z);
                this.entrances[direction] = new Vector3(x - width/2 + 5, y + 1, z);
                break;
            }
            default:
                console.error(`Invalid direction: ${direction}`);
                return null;
        }
        
        leftWall.objectType = "wall";
        rightWall.objectType = "wall";
        header.objectType = "wall";
        
        this.physicsWorld.addObject(leftWall);
        this.physicsWorld.addObject(rightWall);
        this.physicsWorld.addObject(header);
        this.objects.walls[direction].push(leftWall, rightWall, header);
        
        return openingPosition;
    }
    
    /**
     * Add a doorway between rooms - now uses TriggerPortal system
     */
    addDoorway(direction, targetRoomId, entryDirection, cameraPosition = null, doorwayWidth = 12, doorwayHeight = 16) {
        const doorwayPosition = this.createWallOpening(direction, doorwayWidth, doorwayHeight);
        if (!doorwayPosition) return this;
        
        // Determine doorway dimensions based on direction
        const wallThickness = this.wallThickness;
        let dimensions;
        if (direction === "north" || direction === "south") {
            dimensions = {width: doorwayWidth, height: doorwayHeight, depth: wallThickness / 4};
        } else {
            dimensions = {width: wallThickness / 4, height: doorwayHeight, depth: doorwayWidth};
        }
        
        // Create room transition portal using TriggerPortal system
        const portal = this.addRoomTransitionPortal(
            doorwayPosition, 
            dimensions, 
            targetRoomId, 
            entryDirection, 
            this.indoorSceneMode, // sceneMode parameter
            {
                debugName: `RoomDoorway_${targetRoomId}`,
                cameraPosition: cameraPosition
            }
        );
        
        // Store in legacy doorways structure for compatibility
        this.roomObjects.doorways[direction] = portal;
        
        return this;
    }
    
    /**
     * Add an exit door to leave the indoor scene - now uses TriggerPortal system
     */
    addExitDoor(direction, doorwayWidth = 12, doorwayHeight = 16) {
        const doorwayPosition = this.createWallOpening(direction, doorwayWidth, doorwayHeight);
        if (!doorwayPosition) return this;
        
        // Determine doorway dimensions based on direction
        const wallThickness = this.wallThickness;
        let dimensions;
        if (direction === "north" || direction === "south") {
            dimensions = {width: doorwayWidth, height: doorwayHeight, depth: wallThickness / 4};
        } else {
            dimensions = {width: wallThickness / 4, height: doorwayHeight, depth: doorwayWidth};
        }
        
        // Create scene exit portal using TriggerPortal system
        const portal = this.addSceneExitPortal(
            doorwayPosition, 
            dimensions, 
            this.indoorSceneMode, // sceneMode parameter
            {
                debugName: 'ExitDoor'
            }
        );
        
        // Store in legacy doorways structure for compatibility  
        this.roomObjects.doorways[direction] = portal;
        
        return portal;
    }
    
    /**
     * Add furniture to the room - uses SceneLayout framework
     */
    addFurniture(type, position, dimensions = {width: 4, height: 4, depth: 4}) {
        const furniture = super.addDecoration(position, dimensions, type, {collidable: false});
        
        // Track in room-specific structure for compatibility
        this.roomObjects.furniture.push(furniture);
        
        return furniture;
    }
    
    /**
     * Add decoration - overrides SceneLayout to track in room structure
     */
    addDecoration(position, dimensions = {width: 4, height: 4, depth: 4}, type = "decoration") {
        return super.addDecoration(position, dimensions, type);
    }
    
    /**
     * Add a trigger - now uses TriggerPortal system
     */
    addTrigger(position, dimensions = {width: 6, height: 10, depth: 6}, type = "trigger", callback = null) {
        // Create a custom portal with the callback
        const portal = this.addCustomPortal(position, dimensions, callback, {
            debugName: `RoomTrigger_${type}_${Date.now()}`
        });
        
        return portal;
    }
}