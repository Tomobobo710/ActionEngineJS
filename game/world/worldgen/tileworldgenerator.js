// game/world/worldgen/tileworldgenerator.js
class TileWorldGenerator extends NoiseBasedGenerator {
    constructor(config = {}) {
        super(config);

        // Tile-specific blob parameters
        this.BLOB_SCALE = 0.5;
        this.BLOB_OCTAVES = 1;
        this.BLOB_PERSISTENCE = 0.5;
        this.BLOB_THRESHOLD = 0.05;

        // Additional noise generator for blobs
        this.blobNoise = new NoiseGenerator(this.seed + 2);
    }

    generateHeight(nx, nz) {
        const blobValue = this.blobNoise.fractalNoise(
            nx * this.BLOB_SCALE,
            nz * this.BLOB_SCALE,
            this.BLOB_OCTAVES,
            this.BLOB_PERSISTENCE
        );
        const mask = (blobValue - this.BLOB_THRESHOLD) * 2;
        return this.calculateFinalHeight(nx, nz, mask);
    }
}