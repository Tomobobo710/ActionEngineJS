// POIManager.js
class POIManager {
    constructor(terrain, physicsWorld) {
        this.terrain = terrain;
        this.physicsWorld = physicsWorld;
        
        // Initialize all POI generators
        this.townGenerator = new TownPOIGenerator(terrain, physicsWorld);
        this.dungeonGenerator = new DungeonPOIGenerator(terrain, physicsWorld);
        this.fishingGenerator = new FishingPOIGenerator(terrain, physicsWorld);
    }
    
    generateAllPOIs() {
        this.generateTowns();
        this.generateDungeons();
        this.generateFishingSpots();
    }

    generateTowns() {
        const townLocations = this.townGenerator.findTownLocations(30);
        townLocations.forEach((triangle) => {
            const center = this.calculateTriangleCenter(triangle);
            const width = 6 + Math.random() * 4;
            const height = 10 + Math.random() * 6;
            const depth = 6 + Math.random() * 4;
            new TownBuilding(this.physicsWorld, width, height, depth, center);
        });
    }
    
    generateDungeons() {
        const dungeonLocations = this.dungeonGenerator.findDungeonLocations(15);
        dungeonLocations.forEach((triangle) => {
            const center = this.calculateTriangleCenter(triangle);
            const width = 8 + Math.random() * 4;
            const height = 6 + Math.random() * 3;
            const depth = 8 + Math.random() * 4;

            new DungeonBuilding(this.physicsWorld, width, height, depth, center);
        });
    }

    generateFishingSpots() {
        const fishingLocations = this.fishingGenerator.findFishingLocations(50);
        this.fishingSpots = []; // Add array to track spots if needed
        
        fishingLocations.forEach((triangle) => {
            const center = this.calculateTriangleCenter(triangle);
            const spot = new FishingSpotManager(this.physicsWorld, center);
            this.fishingSpots.push(spot); // Optional: track spots for later cleanup
        });
    }
    
    calculateTriangleCenter(triangle) {
        return new Vector3(
            (triangle.vertices[0].x + triangle.vertices[1].x + triangle.vertices[2].x) / 3,
            (triangle.vertices[0].y + triangle.vertices[1].y + triangle.vertices[2].y) / 3,
            (triangle.vertices[0].z + triangle.vertices[1].z + triangle.vertices[2].z) / 3
        );
    }
}