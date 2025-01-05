// game/world/worldgen/noisebasedgenerator.js
class NoiseBasedGenerator extends BaseTerrainGenerator {
    constructor(config = {}) {
        super(config);

        // Core terrain modification parameters
        this.terrainBreakupScale = config.terrainBreakupScale || 3.0;
        this.terrainBreakupIntensity = config.terrainBreakupIntensity || 0.5;
        this.transitionSharpness = config.transitionSharpness || 0.9;

        // Shared noise generators
        this.baseNoise = new NoiseGenerator(this.seed);
        this.detailNoise = new NoiseGenerator(this.seed + 1);

        // Truly shared constants for detail generation
        this.DETAIL_FREQUENCY = 2;
        this.DETAIL_OCTAVES = 5;
        this.DETAIL_PERSISTENCE = 0.7;
        this.DETAIL_SCALE = 0.075;
        this.BASE_OCTAVES = 6;
        this.BASE_PERSISTENCE = 0.5;
        this.EDGE_OCTAVES = 3;
        this.EDGE_PERSISTENCE = 0.5;
        this.MASK_POWER = 0.8;
    }

    // Shared utility methods
    smoothstep(x, min, max) {
        x = Math.max(0, Math.min(1, (x - min) / (max - min)));
        return x * x * (3 - 2 * x);
    }

    lerp(a, b, t) {
        return a + (b - a) * t;
    }

    // Helper for shared detail noise calculation
    calculateDetailNoise(x, z) {
        return (
            this.detailNoise.fractalNoise(
                x * this.DETAIL_FREQUENCY,
                z * this.DETAIL_FREQUENCY,
                this.DETAIL_OCTAVES,
                this.DETAIL_PERSISTENCE
            ) *
            (this.baseWorldHeight * this.DETAIL_SCALE * 5)
        );
    }

    calculateFinalHeight(nx, nz, mask) {
        // Edge noise
        const edgeNoise =
            this.detailNoise.fractalNoise(
                nx * this.terrainBreakupScale,
                nz * this.terrainBreakupScale,
                this.EDGE_OCTAVES,
                this.EDGE_PERSISTENCE
            ) * this.terrainBreakupIntensity;

        mask += edgeNoise;
        mask = this.smoothstep(mask, 0, this.transitionSharpness);

        if (mask <= 0) return 0;

        // Generate base height
        let heightPercent =
            this.baseNoise.fractalNoise(nx, nz, this.BASE_OCTAVES, this.BASE_PERSISTENCE) * this.baseWorldHeight;

        // Add valley reduction
        const valleyNoise = this.detailNoise.fractalNoise(nx * 2, nz * 2, 4, 0.5);
        heightPercent *= 1 - valleyNoise * 0.5; // This will reduce heights by up to 50% in places

        heightPercent += this.calculateDetailNoise(nx, nz);
        heightPercent *= Math.pow(mask, this.MASK_POWER);

        // Add detail variation
        heightPercent += this.calculateDetailNoise(nx, nz);

        // Apply mask
        heightPercent *= Math.pow(mask, this.MASK_POWER);

        return (heightPercent / 100) * this.getBaseWorldHeight();
    }
}