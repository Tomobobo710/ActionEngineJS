// game/mode/scene/townlayout.js

/**
 * TownLayout - Represents a JRPG-style town/outdoor scene
 * 
 * This class extends SceneLayout to manage the layout of a town, including ground, 
 * buildings, paths, and interactive elements. Each town has its own coordinate system 
 * and can connect to both the world map and to indoor scenes via building entrances.
 */
class TownLayout extends SceneLayout {
    constructor(physicsWorld, name, position = new Vector3(0, 0, 0), dimensions = {width: 200, height: 50, depth: 200}) {
        super(physicsWorld, position, dimensions);
        
        this.name = name;
        
        // Add town-specific colors to the base colors
        this.typeColors = {
            ...this.typeColors, // Inherit base colors
            "ground": "#7CFC00",         // Lawn Green
            "path": "#D2B48C",          // Tan
            "building": "#CD853F",      // Peru
            "building_roof": "#800000", // Maroon
            "water": "#00BFFF"          // Deep Sky Blue
        };
        
        // Camera settings for this town
        this.cameraSettings = {
            bounds: {
                minX: position.x - dimensions.width/2,
                maxX: position.x + dimensions.width/2,
                minZ: position.z - dimensions.depth/2,
                maxZ: position.z + dimensions.depth/2
            },
            height: 40,
            distance: 40,
            angle: 45
        };
        
        // Override object collections for town-specific tracking
        this.objects = {
            ground: null,
            paths: [],
            buildings: [],
            decorations: [],
            water: [],
            obstacles: [],
            boundaryWalls: [] // Invisible walls to prevent falling off the map
        };
        
        // Building connections to indoor scenes
        this.buildingConnections = {};
        
        // Reference to scene mode for callbacks
        this.sceneMode = null;
    }
    
    /**
     * Create the basic town structure
     */
    createLayout() {
        return this.createBasicTown();
    }
    
    /**
     * Create basic town structure with ground and central path
     */
    createBasicTown() {
        const {width, height, depth} = this.dimensions;
        const {x, y, z} = this.position;
        
        // Create ground plane
        this.objects.ground = this.createPhysicsBox(
            {width: width, height: 2, depth: depth},
            0,
            new Vector3(x, y - 1, z),
            this.typeColors["ground"]
        );
        
        this.addPhysicsObject(this.objects.ground, "ground", 'structural');
        
        // Create invisible boundary walls to prevent falling off the map
        this.createBoundaryWalls();
        
        // Create a central path
        this.addPath(
            new Vector3(x, y + 0.1, z),
            {width: width * 0.2, height: 0.2, depth: depth * 0.8}
        );
        
        // Add a world exit at the top of the map
        this.addWorldExit(
            new Vector3(x, y + 0.5, z - depth * 0.4),
            {width: width * 0.1, height: 10, depth: width * 0.05}
        );
        
        return this;
    }
    
    /**
     * Create invisible boundary walls around the town to prevent falling off the map
     */
    createBoundaryWalls() {
        const {width, height, depth} = this.dimensions;
        const {x, y, z} = this.position;
        
        // Wall height - taller than buildings by 3 units
        // Assuming max building height is around 20, make walls 25 high
        const wallHeight = 25;
        const wallThickness = 2;
        
        // Make walls mostly transparent so they're invisible but still solid
        const wallColor = "#FFFFFF10"; // Almost invisible white
        
        console.log(`Creating boundary walls for town ${this.name} - dimensions: ${width}x${depth}`);
        
        // North wall (negative Z)
        const northWall = this.createPhysicsBox(
            {width: width + wallThickness * 2, height: wallHeight, depth: wallThickness},
            0,
            new Vector3(x, y + wallHeight/2, z - depth/2 - wallThickness/2),
            wallColor
        );
        
        // South wall (positive Z)
        const southWall = this.createPhysicsBox(
            {width: width + wallThickness * 2, height: wallHeight, depth: wallThickness},
            0,
            new Vector3(x, y + wallHeight/2, z + depth/2 + wallThickness/2),
            wallColor
        );
        
        // West wall (negative X)
        const westWall = this.createPhysicsBox(
            {width: wallThickness, height: wallHeight, depth: depth},
            0,
            new Vector3(x - width/2 - wallThickness/2, y + wallHeight/2, z),
            wallColor
        );
        
        // East wall (positive X)
        const eastWall = this.createPhysicsBox(
            {width: wallThickness, height: wallHeight, depth: depth},
            0,
            new Vector3(x + width/2 + wallThickness/2, y + wallHeight/2, z),
            wallColor
        );
        
        // Add walls to physics world and track them
        this.addPhysicsObject(northWall, "boundary_wall", 'structural');
        this.addPhysicsObject(southWall, "boundary_wall", 'structural');
        this.addPhysicsObject(westWall, "boundary_wall", 'structural');
        this.addPhysicsObject(eastWall, "boundary_wall", 'structural');
        
        // Track boundary walls separately
        this.objects.boundaryWalls = [northWall, southWall, westWall, eastWall];
        
        console.log(`Created ${this.objects.boundaryWalls.length} boundary walls around town`);
    }
    
    /**
     * Add a path to the town
     */
    addPath(position, dimensions) {
        const path = this.createPhysicsBox(
            dimensions,
            0,
            position,
            this.typeColors["path"]
        );
        
        this.addPhysicsObject(path, "path", 'structural');
        this.objects.paths.push(path);
        
        return path;
    }
    
    /**
     * Add a building to the town
     */
    addBuilding(position, dimensions, buildingType = "house", indoorSceneName = null) {
        // Create building base
        const building = this.createPhysicsBox(
            dimensions,
            0,
            position,
            this.typeColors["building"]
        );
        
        building.buildingType = buildingType;
        this.addPhysicsObject(building, "building", 'structural');
        this.objects.buildings.push(building);
        
        // Create a pitched roof
        const roofHeight = dimensions.height * 0.5;
        const roofPosition = new Vector3(
            position.x,
            position.y + dimensions.height/2 + roofHeight/2,
            position.z
        );
        
        const roof = this.createPhysicsBox(
            {width: dimensions.width, height: roofHeight, depth: dimensions.depth},
            0,
            roofPosition,
            this.typeColors["building_roof"]
        );
        
        this.addPhysicsObject(roof, "building_roof", 'structural');
        building.roof = roof;
        
        // If this building connects to an indoor scene, store the connection
        if (indoorSceneName) {
            const buildingId = Date.now() + Math.floor(Math.random() * 1000);
            building.id = buildingId;
            this.buildingConnections[buildingId] = indoorSceneName;
        }
        
        return building;
    }
    
    /**
     * Add a building entrance portal using the new TriggerPortal system
     */
    addBuildingEntrance(buildingId, entrancePosition, dimensions = {width: 5, height: 5, depth: 2}) {
        if (!this.buildingConnections[buildingId]) {
            console.error(`Building ${buildingId} doesn't have an indoor scene connection!`);
            return null;
        }
        
        const targetIndoorScene = this.buildingConnections[buildingId];
        
        // Create proper scene transition portal data
        const targetScene = {
            type: 'house',
            sceneId: targetIndoorScene,
            returnInfo: {
                sceneConfig: {
                    type: 'town',
                    sceneId: this.name
                },
                position: entrancePosition.clone().add(new Vector3(0, 0, 5)) // Step back from door
            }
        };
        
        const portalData = {
            position: entrancePosition,
            dimensions: dimensions,
            portalType: 'scene_transition', // Use proper scene transition system!
            targetScene: targetScene,
            sceneManager: this.sceneManager, // Reference to SceneManager
            color: this.typeColors["building_entrance"],
            debugName: `BuildingEntrance_${buildingId}`
        };
        
        // Verify we have SceneManager
        if (!this.sceneManager) {
            console.warn(`Building entrance ${buildingId} created without SceneManager - falling back to custom callback`);
            portalData.portalType = 'custom';
            portalData.onActivate = (portalData) => {
                if (this.sceneMode) {
                    this.sceneMode.enterBuilding(targetIndoorScene, this.name);
                }
            };
        }
        
        const portal = this.addPortal(portalData);
        this.objects.buildingEntrances = this.objects.buildingEntrances || {};
        this.objects.buildingEntrances[buildingId] = portal;
        
        return portal;
    }
    
    /**
     * Add a world exit portal using the new TriggerPortal system
     */
    addWorldExit(position, dimensions = {width: 10, height: 2, depth: 5}) {
        const portal = this.addWorldExitPortal(
            position,
            dimensions,
            this.sceneMode ? this.sceneMode.gameModeManager : null,
            {
                debugName: 'WorldExit',
                onActivate: (portalData) => {
                    console.log('World Exit - Player is leaving town to world map');
                }
            }
        );
        
        this.objects.worldExit = portal;
        return portal;
    }
    
    /**
     * Add water feature
     */
    addWater(position, dimensions = {width: 20, height: 0.5, depth: 20}) {
        const water = this.createPhysicsBox(
            dimensions,
            0,
            position,
            this.typeColors["water"]
        );
        
        this.addPhysicsObject(water, "water", 'decorative');
        this.objects.water.push(water);
        
        return water;
    }
    
    /**
     * Override addDecoration to use town-specific object tracking
     */
    addDecoration(position, dimensions = {width: 4, height: 4, depth: 4}, type = "decoration") {
        const decoration = super.addDecoration(position, dimensions, type, {collidable: true});
        this.objects.decorations.push(decoration);
        return decoration;
    }
    
    /**
     * Override addObstacle to use town-specific object tracking
     */
    addObstacle(position, dimensions = {width: 5, height: 5, depth: 5}, color = null) {
        const obstacle = super.addObstacle(position, dimensions, color);
        this.objects.obstacles.push(obstacle);
        return obstacle;
    }
    
    /**
     * Set the scene mode reference for portal callbacks
     */
    setSceneMode(sceneMode) {
        this.sceneMode = sceneMode;
        
        // Update world exit portal to have the correct game mode manager
        if (this.objects.worldExit && sceneMode && sceneMode.gameModeManager) {
            this.objects.worldExit.portalData.gameModeManager = sceneMode.gameModeManager;
        }
    }
    
    /**
     * Get all physics objects for rendering
     */
    getAllPhysicsObjects() {
        const allObjects = [];
        
        // Add ground
        if (this.objects.ground) {
            allObjects.push(this.objects.ground);
        }
        
        // Add all object collections
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
    
    /**
     * Override cleanup to handle town-specific cleanup
     */
    cleanup() {
        // Clean up building connections
        this.buildingConnections = {};
        
        // Call parent cleanup
        super.cleanup();
        
        // Clear town-specific references
        this.sceneMode = null;
    }
}
