// game/world/worldgen/worldgenerator.js
class WorldGenerator {
    constructor(config = {}) {
        // Store original config for regeneration
        this.config = {
            seed: config.seed || Math.floor(Math.random() * 10000),
            gridResolution: config.gridResolution || 128,
            baseWorldHeight: config.baseWorldHeight || 400,
            baseWorldScale: config.baseWorldScale || 128,
            landmassSize: config.landmassSize || 0.8 + Math.random() * 0.1,
            transitionSharpness: config.transitionSharpness || 0.7 + Math.random() * 0.4,
            terrainBreakupScale: config.terrainBreakupScale || 1.0 + Math.random() * 4.0,
            terrainBreakupIntensity: config.terrainBreakupIntensity || 0.2 + Math.random() * 0.6,
            generator: config.generator || (Math.random() < 0.5 ? "island" : "tiled")
        };

        // Create terrain with stored config
        this.terrain = new Terrain(this.config);
    }

    // Main interface for getting terrain data
    getTerrain() {
        return this.terrain;
    }

    // Get triangle at specific world coordinates
    getTriangleAt(x, z) {
        // Convert world coordinates to grid coordinates
        const gridX = Math.floor(x / this.config.baseWorldScale + this.config.gridResolution / 2);
        const gridZ = Math.floor(z / this.config.baseWorldScale + this.config.gridResolution / 2);

        if (gridX < 0 || gridX >= this.config.gridResolution || gridZ < 0 || gridZ >= this.config.gridResolution) {
            return null;
        }

        // Find triangle containing point
        for (let i = 0; i < this.terrain.faces.length; i++) {
            const face = this.terrain.faces[i];
            const vertices = face.map((idx) => this.terrain.vertices[idx]);

            // Point in triangle test using barycentric coordinates
            if (this.pointInTriangle(x, z, vertices)) {
                return {
                    indices: face,
                    vertices: vertices,
                    normal: this.terrain.normals[face[0]],
                    minY: Math.min(...vertices.map((v) => v.y)),
                    maxY: Math.max(...vertices.map((v) => v.y)),
                    avgY: vertices.reduce((sum, v) => sum + v.y, 0) / 3,
                    biome: this.getBiomeForHeight(vertices[0].y)
                };
            }
        }
        return null;
    }

    // Helper for triangle intersection
    pointInTriangle(x, z, vertices) {
        const [v1, v2, v3] = vertices;

        const d1 = this.sign(x, z, v1.x, v1.z, v2.x, v2.z);
        const d2 = this.sign(x, z, v2.x, v2.z, v3.x, v3.z);
        const d3 = this.sign(x, z, v3.x, v3.z, v1.x, v1.z);

        const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
        const hasPos = d1 > 0 || d2 > 0 || d3 > 0;

        return !(hasNeg && hasPos);
    }

    sign(x1, y1, x2, y2, x3, y3) {
        return (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
    }

    getBiomeForHeight(height) {
        const heightPercent = (height / this.config.baseWorldHeight) * 100;
        for (const [biome, data] of Object.entries(BIOME_TYPES)) {
            if (heightPercent >= data.heightRange[0] && heightPercent <= data.heightRange[1]) {
                return biome;
            }
        }
        return "OCEAN";
    }

    // Regenerate world with new random seed
    regenerate() {
        this.config.seed = Math.floor(Math.random() * 10000);
        this.terrain = new Terrain(this.config);
        return this.terrain;
    }
}