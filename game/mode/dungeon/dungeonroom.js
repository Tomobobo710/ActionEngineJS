// game/mode/dungeon/dungeonroom.js
class DungeonRoom {
    constructor(physicsWorld, position = new Vector3(0, 0, 0), dimensions = {width: 40, height: 20, depth: 40}) {
        this.physicsWorld = physicsWorld;
        this.position = position;
        this.dimensions = this.standardizeDimensions(dimensions);
        
        // Type color mapping
        this.typeColors = {
            "floor": "#8B4513",    // Brown
            "ceiling": "#696969",  // Dim Gray
            "wall": "#A9A9A9",     // Dark Gray
            "door": "#8B0000",     // Dark Red
            "trigger": "#FFD700",  // Gold
            "world_portal": "#00FF0080" // Semi-transparent Green
        };
        
        this.objects = {
            floor: null,
            ceiling: null,
            walls: { north: [], south: [], east: [], west: [] },
            doors: {},
            portals: {},
            triggers: [],
            decorations: []
        };
        
        this.doorStates = {};
        this.portalStates = {};
        this.connections = {};
        this.wallThickness = 2;
    }
    
    standardizeDimensions(dimensions) {
        return {
            width: Math.round(dimensions.width / 2) * 2,
            height: Math.round(dimensions.height / 2) * 2,
            depth: Math.round(dimensions.depth / 2) * 2
        };
    }
    
    createBasicStructure() {
        const {width, height, depth} = this.dimensions;
        const {x, y, z} = this.position;
        const wallThickness = this.wallThickness;
        
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
        this.objects.floor.body.friction = 0.8; // Keep floor friction for character movement
        this.physicsWorld.addObject(this.objects.floor);
        
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
        
        this.createFullWall("north");
        this.createFullWall("south");
        this.createFullWall("east");
        this.createFullWall("west");
        
        return this;
    }
    
    createFullWall(direction) {
        const {width, height, depth} = this.dimensions;
        const {x, y, z} = this.position;
        const wallThickness = this.wallThickness;
        
        let wall;
        
        switch(direction) {
            case "north":
                wall = new ActionPhysicsBox3D(
                    this.physicsWorld,
                    width + wallThickness * 2,
                    height,
                    wallThickness,
                    0,
                    new Vector3(x, y + height/2, z + depth/2 + wallThickness/2),
                    this.typeColors["wall"]
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
                    this.typeColors["wall"]
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
                    this.typeColors["wall"]
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
                    this.typeColors["wall"]
                );
                break;
        }
        
        if (wall) {
            wall.objectType = "wall";
            this.physicsWorld.addObject(wall);
            this.objects.walls[direction].push(wall);
        }
        
        return wall;
    }
    
    createWallOpening(direction, openingWidth = 8, openingHeight = 16) {
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
                break;
            }
            case "south": {
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
                break;
            }
            case "east": {
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
                break;
            }
            case "west": {
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
    
    addDoor(direction, doorWidth = 8, doorHeight = 16) {
        const doorPosition = this.createWallOpening(direction, doorWidth, doorHeight);
        if (!doorPosition) return this;
        
        const wallThickness = this.wallThickness;
        
        let door;
        
        if (direction === "north" || direction === "south") {
            door = new ActionPhysicsBox3D(
                this.physicsWorld,
                doorWidth,
                doorHeight,
                wallThickness * 0.98,
                0,
                doorPosition,
                this.typeColors["door"]
            );
        } else {
            door = new ActionPhysicsBox3D(
                this.physicsWorld,
                wallThickness * 0.98,
                doorHeight,
                doorWidth,
                0,
                doorPosition,
                this.typeColors["door"]
            );
        }
        
        door.objectType = "door";
        this.objects.doors[direction] = door;
        this.doorStates[direction] = true; // Always closed
        
        this.physicsWorld.addObject(door);
        
        return this;
    }
    
    addWorldPortal(direction, portalWidth = 8, portalHeight = 16, destination = "world") {
        const portalPosition = this.createWallOpening(direction, portalWidth, portalHeight);
        if (!portalPosition) return this;
        
        const wallThickness = this.wallThickness;
        
        let portal;
        
        if (direction === "north" || direction === "south") {
            portal = new ActionPhysicsBox3D(
                this.physicsWorld,
                portalWidth,
                portalHeight,
                wallThickness / 2,
                0,
                portalPosition,
                this.typeColors["world_portal"]
            );
        } else {
            portal = new ActionPhysicsBox3D(
                this.physicsWorld,
                wallThickness / 2,
                portalHeight,
                portalWidth,
                0,
                portalPosition,
                this.typeColors["world_portal"]
            );
        }
        
        portal.objectType = "world_portal";
        portal.portalType = "world";
        portal.destination = destination;
        
        // Add contact listener for player collision
        portal.body.debugName = 'WorldPortal';
        portal.body.addListener(
            'contact',
            (other_body, contact) => {
                // Only respond to player contacts
                if (!other_body.debugName || !other_body.debugName.includes('Character')) return;
                
                console.log(`World Portal - Player contacted portal to ${destination}`);
                
                // Reference to world mode manager for mode switching
                if (this.worldMode && this.worldMode.gameModeManager) {
                    requestAnimationFrame(() => {
                        this.worldMode.gameModeManager.switchMode(destination);
                    });
                }
            }
        );
        
        this.objects.portals[direction] = portal;
        
        this.physicsWorld.addObject(portal);
        
        return portal;
    }
    
    addTrigger(position, dimensions = {width: 6, height: 10, depth: 6}, type = "pressure_plate") {
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
                
                // For pressure plates - open associated doors
                if (type === 'pressure_plate' && this.dungeonMode) {
                    // North door trigger in entrance room
                    if (trigger === this.dungeonMode.northDoorTrigger) {
                        this.dungeonMode.startSlowDoorOpen(this.dungeonMode.entranceRoom, "north");
                    }
                    // South door trigger in north room
                    else if (trigger === this.dungeonMode.southDoorTrigger) {
                        this.dungeonMode.startSlowDoorOpen(this.dungeonMode.entranceRoom, "south");
                    }
                }
            }
        );
        
        this.physicsWorld.addObject(trigger);
        
        this.objects.triggers.push(trigger);
        return trigger;
    }
    
    openDoor(direction) {
        const door = this.objects.doors[direction];
        if (door && this.doorStates[direction] === true) {
            const {y} = this.position;
            const hiddenY = y + this.dimensions.height * 2;
            
            if (!door.originalPosition) {
                door.originalPosition = new Vector3(
                    door.body.position.x,
                    door.body.position.y,
                    door.body.position.z
                );
            }
            
            door.body.position.y = hiddenY;
            door.updateVisual();
            
            this.doorStates[direction] = false;
            
            if (this.audio && this.audio.playSoundEffect) {
                this.audio.playSoundEffect("doorOpen");
            }
            
            return true;
        }
        return false;
    }
    
    addDoorway(direction, doorwayWidth = 8, doorwayHeight = 16) {
        // First create a door
        this.addDoor(direction, doorwayWidth, doorwayHeight);
        
        // Then remove the door object
        if (this.objects.doors[direction]) {
            this.physicsWorld.removeObject(this.objects.doors[direction]);
            this.objects.doors[direction] = null;
            this.doorStates[direction] = null;
        }
        
        return this;
    }
        
    closeDoor(direction) {
        const door = this.objects.doors[direction];
        if (door && !this.doorStates[direction] && door.originalPosition) {
            door.body.position.y = door.originalPosition.y;
            door.updateVisual();
            
            this.doorStates[direction] = true;
            
            if (this.audio && this.audio.playSoundEffect) {
                this.audio.playSoundEffect("doorClose");
            }
            
            return true;
        }
        return false;
    }
    
    connectTo(otherRoom, direction, openingWidth = 8, openingHeight = 16) {
        this.connections[direction] = otherRoom;
        
        const oppositeDirection = {
            "north": "south", "south": "north", "east": "west", "west": "east"
        }[direction];
        
        otherRoom.connections[oppositeDirection] = this;
        
        if (this.wallThickness !== otherRoom.wallThickness) {
            otherRoom.wallThickness = this.wallThickness;
        }
        
        const wallThickness = this.wallThickness;
        
        const thisRoomMaxWidth = (direction === "north" || direction === "south") ? 
                               this.dimensions.width - wallThickness * 2 : 
                               this.dimensions.depth - wallThickness * 2;
                               
        const otherRoomMaxWidth = (oppositeDirection === "north" || oppositeDirection === "south") ? 
                               otherRoom.dimensions.width - wallThickness * 2 : 
                               otherRoom.dimensions.depth - wallThickness * 2;
        
        const finalOpeningWidth = Math.min(openingWidth, thisRoomMaxWidth, otherRoomMaxWidth);
        const finalOpeningHeight = Math.min(openingHeight, 
                                         this.dimensions.height - wallThickness,
                                         otherRoom.dimensions.height - wallThickness);
        
        this.addDoor(direction, finalOpeningWidth, finalOpeningHeight);
        otherRoom.addDoor(oppositeDirection, finalOpeningWidth, finalOpeningHeight);
        
        return this;
    }
    
    calculateConnectingRoomPosition(roomDimensions, direction) {
        const {width, height, depth} = this.dimensions;
        const {x, y, z} = this.position;
        const wallThickness = this.wallThickness;
        
        let connectingPosition = new Vector3(x, y, z);
        
        switch(direction) {
            case "north":
                connectingPosition.z = z + depth/2 + wallThickness*2 + roomDimensions.depth/2;
                break;
            case "south":
                connectingPosition.z = z - depth/2 - wallThickness*2 - roomDimensions.depth/2;
                break;
            case "east":
                connectingPosition.x = x + width/2 + wallThickness*2 + roomDimensions.width/2;
                break;
            case "west":
                connectingPosition.x = x - width/2 - wallThickness*2 - roomDimensions.width/2;
                break;
        }
        
        return connectingPosition;
    }
    
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
    
    addDecoration(position, dimensions = {width: 4, height: 4, depth: 4}, type = "pedestal") {
        const decoration = new ActionPhysicsBox3D(
            this.physicsWorld,
            dimensions.width,
            dimensions.height,
            dimensions.depth,
            0,
            position,
            this.typeColors[type] || "#A0522D" // Default to saddle brown if type not found
        );
        
        decoration.objectType = type;
        this.physicsWorld.addObject(decoration);
        this.objects.decorations.push(decoration);
        
        return decoration;
    }
}