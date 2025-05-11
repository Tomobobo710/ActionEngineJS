// game/mode/scene/scenelayout.js

class SceneLayout {
    constructor(physicsWorld, position = new Vector3(0, 0, 0), dimensions = {width: 60, height: 30, depth: 60}) {
        this.physicsWorld = physicsWorld;
        this.position = position;
        this.dimensions = dimensions;
        
        // Type color mapping
        this.typeColors = {
            "floor": "#8B4513",          // Brown
            "ceiling": "#696969",        // Dim Gray
            "wall": "#A9A9A9",           // Dark Gray
            "portal": "#0000FF80",       // Semi-transparent Blue
            "world_portal": "#00FF0080", // Semi-transparent Green
            "trigger": "#FFD70080",      // Semi-transparent Gold
            "decoration": "#FF6347",     // Tomato
            "chest": "#CD853F",          // Peru
            "chair": "#DEB887",          // Burlywood
            "table": "#D2B48C"           // Tan
        };
        
        // Entry point for characters coming into this scene
        this.entrancePosition = null;
        
        // Camera position for this scene
        this.cameraPosition = null;
        
        this.objects = {
            floor: null,
            ceiling: null,
            walls: { north: [], south: [], east: [], west: [] },
            portals: {},
            triggers: [],
            decorations: []
        };
        
        this.portalStates = {};
        this.connections = {};
        this.entrances = {};
        this.wallThickness = 2;
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
    
    // Create invisible walls for north/south (for collision but not blocking camera)
    this.createFullWall("north", true);
    //this.createFullWall("south", true);
    
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
        // Other cases remain the same...
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
    
    addPortal(direction, targetSceneId, entryDirection, cameraPosition = null, portalWidth = 12, portalHeight = 16) {
        const portalPosition = this.createWallOpening(direction, portalWidth, portalHeight);
        if (!portalPosition) return this;
        
        const wallThickness = this.wallThickness;
        
        let portal;
        
        if (direction === "north" || direction === "south") {
            portal = new ActionPhysicsBox3D(
                this.physicsWorld,
                portalWidth,
                portalHeight,
                wallThickness / 4,
                0,
                portalPosition,
                this.typeColors["portal"]
            );
        } else {
            portal = new ActionPhysicsBox3D(
                this.physicsWorld,
                wallThickness / 4,
                portalHeight,
                portalWidth,
                0,
                portalPosition,
                this.typeColors["portal"]
            );
        }
        
        portal.objectType = "portal";
        portal.targetSceneId = targetSceneId;
        portal.entryDirection = entryDirection;
        portal.cameraPosition = cameraPosition;
        
        // Add contact listener for player collision
        portal.body.debugName = `ScenePortal_${targetSceneId}`;
        
        // Allow character to pass through
        portal.body.addListener('preContact', (body, contact) => {
            if (body.debugName && body.debugName.includes('Character')) {
                contact.restitution = 0;
                contact.friction = 0;
                contact.disabled = true;
            }
        });
        
        portal.body.addListener(
            'contact',
            (other_body, contact) => {
                // Only respond to player contacts
                if (!other_body.debugName || !other_body.debugName.includes('Character')) return;
                
                console.log(`Scene Portal - Player contacted portal to scene ${targetSceneId}`);
                
                // Reference to scene mode for scene switching
                if (this.sceneMode) {
                    this.sceneMode.transitionToScene(targetSceneId, direction);
                }
            }
        );
        
        this.objects.portals[direction] = portal;
        this.physicsWorld.addObject(portal);
        
        return this;
    }
    
    addWorldPortal(direction, portalWidth = 12, portalHeight = 16) {
        const portalPosition = this.createWallOpening(direction, portalWidth, portalHeight);
        if (!portalPosition) return this;
        
        const wallThickness = this.wallThickness;
        
        let portal;
        
        if (direction === "north" || direction === "south") {
            portal = new ActionPhysicsBox3D(
                this.physicsWorld,
                portalWidth,
                portalHeight,
                wallThickness / 4,
                0,
                portalPosition,
                this.typeColors["world_portal"]
            );
        } else {
            portal = new ActionPhysicsBox3D(
                this.physicsWorld,
                wallThickness / 4,
                portalHeight,
                portalWidth,
                0,
                portalPosition,
                this.typeColors["world_portal"]
            );
        }
        
        portal.objectType = "world_portal";
        
        // Allow character to pass through
        portal.body.addListener('preContact', (body, contact) => {
            if (body.debugName && body.debugName.includes('Character')) {
                contact.restitution = 0;
                contact.friction = 0;
                contact.disabled = true;
            }
        });
        
        // Add contact listener for player collision
        portal.body.debugName = 'WorldPortal';
        portal.body.addListener(
            'contact',
            (other_body, contact) => {
                // Only respond to player contacts
                if (!other_body.debugName || !other_body.debugName.includes('Character')) return;
                
                console.log(`World Portal - Player contacted portal to world map`);
                
                // Reference to scene mode for mode switching
                if (this.sceneMode && this.sceneMode.gameModeManager) {
                    requestAnimationFrame(() => {
                        this.sceneMode.gameModeManager.switchMode("world");
                    });
                }
            }
        );
        
        this.objects.portals[direction] = portal;
        this.physicsWorld.addObject(portal);
        
        return portal;
    }
    
    addDecoration(position, dimensions = {width: 4, height: 4, depth: 4}, type = "decoration") {
        const decoration = new ActionPhysicsBox3D(
            this.physicsWorld,
            dimensions.width,
            dimensions.height,
            dimensions.depth,
            0,
            position,
            this.typeColors[type] || this.typeColors["decoration"]
        );
        
        decoration.objectType = type;
        this.physicsWorld.addObject(decoration);
        this.objects.decorations.push(decoration);
        
        return decoration;
    }
    
    addTrigger(position, dimensions = {width: 6, height: 10, depth: 6}, type = "trigger", callback = null) {
        const trigger = new ActionPhysicsBox3D(
            this.physicsWorld,
            dimensions.width,
            dimensions.height,
            dimensions.depth,
            0,
            position,
            this.typeColors["trigger"]
        );
        
        trigger.objectType = "trigger";
        trigger.type = type;
        trigger.isActive = false;
        trigger.id = Date.now() + Math.floor(Math.random() * 1000);
        
        // Add contact listener for player collision
        trigger.body.debugName = `Trigger_${type}_${trigger.id}`;
        trigger.body.addListener(
            'contact',
            (other_body, contact) => {
                // Only respond to player contacts
                if (!other_body.debugName || !other_body.debugName.includes('Character')) return;
                
                console.log(`Trigger ${trigger.id} - Player contacted trigger. Type: ${type}`);
                
                // Execute the callback if provided
                if (callback) {
                    callback(trigger, this);
                }
            }
        );
        
        this.physicsWorld.addObject(trigger);
        this.objects.triggers.push(trigger);
        
        return trigger;
    }
}