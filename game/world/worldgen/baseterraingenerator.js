// game/world/worldgen/baseterraingenerator.js
// Base class with core functionality
class BaseTerrainGenerator {
    constructor(config = {}) {
        // Core settings
        this.gridResolution = config.gridResolution || 128;
        this.seed = config.seed || Math.random() * 10000;

        // Height settings
        this.baseWorldHeight = config.baseWorldHeight || 400;
        this.waterLevel = 0; // Always 0 for water
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