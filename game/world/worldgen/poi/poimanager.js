class POIManager {
    constructor(terrain, physicsWorld, worldMode) {
        this.terrain = terrain;
        this.physicsWorld = physicsWorld;
        this.worldMode = worldMode;

        // Flags for enabling/disabling POI types
        this.enableTowns = true;
        this.enableDungeons = true;
        this.enableFishingSpots = true;
        this.enableForests = true;

        // Initialize all POI generators
        this.townGenerator = new TownPOIGenerator(terrain, physicsWorld);
        this.dungeonGenerator = new DungeonPOIGenerator(terrain, physicsWorld);
        this.fishingGenerator = new FishingPOIGenerator(terrain, physicsWorld);
        this.forestGenerator = new ForestPOIGenerator(terrain, physicsWorld);
    }

    generateAllPOIs() {
        if (this.enableTowns) this.generateTowns();
        if (this.enableDungeons) this.generateDungeons();
        if (this.enableFishingSpots) this.generateFishingSpots();
        if (this.enableForests) this.generateForests(); // Add forests generation
    }

    // Rest of methods stay the same
    generateTowns() {
        this.towns = [];
        const townLocations = this.townGenerator.findTownLocations(30);
        townLocations.forEach((triangle) => {
            const center = this.calculateTriangleCenter(triangle);
            const width = 6 + Math.random() * 4;
            const height = 10 + Math.random() * 6;
            const depth = 6 + Math.random() * 4;
            const town = new TownBuilding(this.physicsWorld, this.worldMode, width, height, depth, center);
            this.towns.push(town);
        });
    }

    generateDungeons() {
        this.dungeons = [];
        const dungeonLocations = this.dungeonGenerator.findDungeonLocations(15);
        dungeonLocations.forEach((triangle) => {
            const center = this.calculateTriangleCenter(triangle);
            const width = 8 + Math.random() * 4;
            const height = 6 + Math.random() * 3;
            const depth = 8 + Math.random() * 4;
            const dungeon = new DungeonBuilding(this.physicsWorld, this.worldMode, width, height, depth, center);
            this.dungeons.push(dungeon);
        });
    }

    generateFishingSpots() {
        this.fishingSpots = [];
        const fishingLocations = this.fishingGenerator.findFishingLocations(50);
        fishingLocations.forEach((triangle) => {
            const center = this.calculateTriangleCenter(triangle);
            const spot = new FishingSpotMarker(this.physicsWorld, this.worldMode, center);
            this.fishingSpots.push(spot);
        });
        // No need to log creation
    }
    generateForests() {
        this.forests = [];
        const forestLocations = this.forestGenerator.findForestLocations(20); // Generate 20 forests
        forestLocations.forEach((triangle) => {
            const center = this.calculateTriangleCenter(triangle);
            const width = 12 + Math.random() * 6; // Slightly larger for forests
            const height = 15 + Math.random() * 8; // Taller for trees
            const depth = 12 + Math.random() * 6; // Slightly larger for forests
            const scale = 0.8 + Math.random() * 0.4;
            const forest = new ForestBuilding(this.physicsWorld, this.worldMode, width, height, depth, center, scale);
            this.forests.push(forest);
        });
    }
    calculateTriangleCenter(triangle) {
        return new Vector3(
            (triangle.vertices[0].x + triangle.vertices[1].x + triangle.vertices[2].x) / 3,
            (triangle.vertices[0].y + triangle.vertices[1].y + triangle.vertices[2].y) / 3,
            (triangle.vertices[0].z + triangle.vertices[1].z + triangle.vertices[2].z) / 3
        );
    }

    cleanup() {
        // Only clean up enabled POI types
        if (this.enableTowns && this.towns) {
            this.towns.forEach((town) => {
                this.physicsWorld.removeObject(town);
            });
            this.towns = [];
        }

        if (this.enableDungeons && this.dungeons) {
            this.dungeons.forEach((dungeon) => {
                this.physicsWorld.removeObject(dungeon);
            });
            this.dungeons = [];
        }

        if (this.enableFishingSpots && this.fishingSpots) {
            this.fishingSpots.forEach((spot) => {
                this.physicsWorld.removeObject(spot);
            });
            this.fishingSpots = [];
        }

        if (this.enableForests && this.forests) {
            this.forests.forEach((forest) => {
                this.physicsWorld.removeObject(forest);
            });
            this.forests = [];
        }

        // Only null generators that are enabled
        if (this.enableTowns) this.townGenerator = null;
        if (this.enableDungeons) this.dungeonGenerator = null;
        if (this.enableFishingSpots) this.fishingGenerator = null;
        if (this.enableForests) this.forestGenerator = null;
    }
}