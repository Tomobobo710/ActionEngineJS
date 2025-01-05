// game/world/worldgen/islandgenerator.js
class IslandGenerator extends NoiseBasedGenerator {
    constructor(config = {}) {
        super(config);

        // Island-specific parameters
        this.landmassSize = config.landmassSize || 0.75;
    }

    generateHeight(x, z) {
        // Convert back to original coordinate space for island shape
        const nx = x * 2 - 1;
        const nz = z * 2 - 1;

        // Base island shape using radial distance
        const dist = Math.sqrt(nx * nx + nz * nz);
        let mask = 1 - dist / this.landmassSize;

        return this.calculateFinalHeight(nx, nz, mask);
    }
}