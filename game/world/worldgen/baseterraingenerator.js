// game/world/worldgen/baseterraingenerator.js
// Base class with core functionality
class BaseTerrainGenerator {
    constructor(config = {}) {
        // Store config for debug panel
        this.config = config;
        
        // Initialize seeded RNG first
        const rng = new SeededRandom(config.seed || Math.floor(Math.random() * 10000));
        
        // Generate base parameters
        this.seed = config.seed ?? rng.next() * 10000;
        this.gridResolution = config.gridResolution ?? 128;
        this.baseWorldScale = config.baseWorldScale ?? 128;
        this.baseWorldHeight = config.baseWorldHeight ?? 400;
        
        // Generate other parameters with seeded randomness if not provided
        this.landmassSize = config.landmassSize ?? (0.8 + rng.next() * 0.1);
        this.transitionSharpness = config.transitionSharpness ?? (0.7 + rng.next() * 0.4);
        this.terrainBreakupScale = config.terrainBreakupScale ?? (1.0 + rng.next() * 4.0);
        this.terrainBreakupIntensity = config.terrainBreakupIntensity ?? (0.2 + rng.next() * 0.6);
        
        this.waterLevel = 0;
    }

    getBaseWorldHeight() {
        return this.baseWorldHeight;
    }

    generate() {
        const heightMap = [];

        for (let z = 0; z < this.gridResolution; z++) {
            heightMap[z] = [];
            for (let x = 0; x < this.gridResolution; x++) {
                const nx = x / this.gridResolution;
                const nz = z / this.gridResolution;

                const height = this.generateHeight(nx, nz);
                heightMap[z][x] = height <= this.waterLevel ? this.waterLevel : height;
            }
        }

        return heightMap;
    }

    generateHeight(x, z) {
        throw new Error("generateHeight must be implemented by derived class");
    }
}