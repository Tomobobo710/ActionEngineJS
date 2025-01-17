// game/character/basecharacter/actioncharacter.js
class ActionCharacter extends RenderableObject {
    constructor(terrain, camera) {
        super();
        this.camera = camera;
        this.terrain = terrain;

        this.basePosition = new Vector3(0, 0, 0); // Ground position
        this.position = new Vector3(0, 40, 0); // Center position
        this.facingDirection = new Vector3(0, 0, 1);
        this.rotation = 0;
        this.size = 4;
        this.height = 6;
        this.scale = 1;

        const loader = new GLBLoader();

        // From base64
        this.characterModel = loader.loadModel(foxModel);

        // capsule
        //this.characterModel = this.createDefaultCharacterModel();

        // Terrain info
        this.gridPosition = { x: 0, z: 0 };
        this.currentBiome = null;
        this.heightPercent = 0;
        this.terrainHeight = 0;
        this.updateTerrainInfo();
    }
    
    // Required interface methods
    applyInput(input, deltaTime) {
        throw new Error("Must be implemented by subclass");
    }

    update(deltaTime) {
        throw new Error("Must be implemented by subclass");
    }

    draw(ctx, camera) {
        throw new Error("Must be implemented by subclass");
    }

    

    

    getHeightOnTriangle(triangle, x, z) {
        const [v1, v2, v3] = triangle.vertices;

        const denominator = (v2.z - v3.z) * (v1.x - v3.x) + (v3.x - v2.x) * (v1.z - v3.z);
        const a = ((v2.z - v3.z) * (x - v3.x) + (v3.x - v2.x) * (z - v3.z)) / denominator;
        const b = ((v3.z - v1.z) * (x - v3.x) + (v1.x - v3.x) * (z - v3.z)) / denominator;
        const c = 1 - a - b;

        return a * v1.y + b * v2.y + c * v3.y;
    }

    /**
     * Returns the raw triangle geometry, primarily used by 2D software rendering
     */
    getModel() {
        return this.characterModel;
    }

    updateFacingDirection() {
        this.facingDirection = new Vector3(
            Math.sin(this.rotation), // X component
            0, // Y component (flat on xz plane)
            Math.cos(this.rotation) // Z component
        );
    }

    getTerrainHeightAtPosition(worldX, worldZ) {
        const scaledX = worldX * 2;
        const scaledZ = worldZ * 2;

        const x = Math.floor(scaledX / this.terrain.baseWorldScale + this.terrain.gridResolution / 2);
        const z = Math.floor(scaledZ / this.terrain.baseWorldScale + this.terrain.gridResolution / 2);

        if (x < 0 || x >= this.terrain.gridResolution || z < 0 || z >= this.terrain.gridResolution) {
            return 0;
        }

        return this.terrain.heightMap[z][x];
    }

    updateTerrainInfo() {
        this.gridPosition.x = Math.floor(
            this.basePosition.x / this.terrain.baseWorldScale + this.terrain.gridResolution / 2
        );
        this.gridPosition.z = Math.floor(
            this.basePosition.z / this.terrain.baseWorldScale + this.terrain.gridResolution / 2
        );

        this.terrainHeight = this.getTerrainHeightAtPosition(this.basePosition.x, this.basePosition.z);
        this.heightPercent = (this.basePosition.y / this.terrain.generator.getBaseWorldHeight()) * 100;

        for (const [biomeName, biomeData] of Object.entries(BIOME_TYPES)) {
            if (this.heightPercent >= biomeData.heightRange[0] && this.heightPercent <= biomeData.heightRange[1]) {
                this.currentBiome = biomeName;
                break;
            }
        }
    }

    

    getCurrentTriangle() {
        const triangles = this.terrain.triangles;
        // Direct triangle access
        for (const triangle of triangles) {
            const v1 = triangle.vertices[0];
            const v2 = triangle.vertices[1];
            const v3 = triangle.vertices[2];

            const p = this.position;
            const d1 = this.sign(p, v1, v2);
            const d2 = this.sign(p, v2, v3);
            const d3 = this.sign(p, v3, v1);

            const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
            const hasPos = d1 > 0 || d2 > 0 || d3 > 0;

            if (!(hasNeg && hasPos)) {
                const avgHeight = (v1.y + v2.y + v3.y) / 3;

                let biomeType = "SNOW";
                for (const [type, data] of Object.entries(BIOME_TYPES)) {
                    const heightPercent = (avgHeight / this.terrain.generator.getBaseWorldHeight()) * 100;
                    if (heightPercent >= data.heightRange[0] && heightPercent <= data.heightRange[1]) {
                        biomeType = type;
                        break;
                    }
                }

                return {
                    vertices: [v1, v2, v3],
                    indices: [0, 1, 2],
                    minY: Math.min(v1.y, v2.y, v3.y),
                    maxY: Math.max(v1.y, v2.y, v3.y),
                    avgY: avgHeight,
                    normal: triangle.normal,
                    biome: biomeType
                };
            }
        }
        return null;
    }

    sign(p, v1, v2) {
        return (p.x - v2.x) * (v1.z - v2.z) - (v1.x - v2.x) * (p.z - v2.z);
    }
}