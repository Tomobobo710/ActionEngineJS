// game/world/worldgen/terrain.js
class Terrain {
    constructor(config = {}) {
        // Store config for debug panel
        this.config = config;

        // Core parameters
        this.gridResolution = config.gridResolution || 128;
        this.baseWorldScale = config.baseWorldScale || 128;

        // Generate terrain data
        if (config.generator === "tiled") {
            this.generator = new TileWorldGenerator(config);
        } else {
            this.generator = new IslandGenerator(config);
        }
        this.heightMap = this.generator.generate();

        // Generate geometry
        this.generateGeometry();
    }

    generateGeometry() {
        this.vertices = [];
        this.triangles = [];
        this.normals = [];
        this.colors = [];

        const gridSize = 64; // This gives us 64x64 squares
        const vertexCount = gridSize + 1; // 65x65 verticesd

        // Generate vertices in a 65x65 grid
        for (let z = 0; z < vertexCount; z++) {
            for (let x = 0; x < vertexCount; x++) {
                // Scale the world coordinates to match our desired size
                const worldX = (x - gridSize / 2) * this.baseWorldScale;
                const worldZ = (z - gridSize / 2) * this.baseWorldScale;

                // Map our 0-64 coordinates to 0-127 for heightmap sampling
                const heightX = Math.min(
                    this.gridResolution - 1,
                    Math.floor((x * (this.gridResolution - 1)) / gridSize)
                );
                const heightZ = Math.min(
                    this.gridResolution - 1,
                    Math.floor((z * (this.gridResolution - 1)) / gridSize)
                );
                const height = this.heightMap[heightZ][heightX];

                // Store vertex - Create a new Vector3 instance and store it
                const vertexIndex = z * vertexCount + x;
                // Create a proper Vector3 instance
                this.vertices[vertexIndex] = new Vector3(worldX, height, worldZ);
                this.colors[vertexIndex] = this.getColorForHeight(height);
            }
        }

        // Generate faces (triangles) for each square in the 64x64 grid
        for (let z = 0; z < gridSize; z++) {
            for (let x = 0; x < gridSize; x++) {
                const topLeft = z * vertexCount + x;
                const topRight = topLeft + 1;
                const bottomLeft = (z + 1) * vertexCount + x;
                const bottomRight = bottomLeft + 1;

                this.triangles.push(
                    new Triangle(this.vertices[topLeft], this.vertices[bottomLeft], this.vertices[topRight])
                );
                this.triangles.push(
                    new Triangle(this.vertices[topRight], this.vertices[bottomLeft], this.vertices[bottomRight])
                );
            }
        }
    }

    findNearbyTriangles(x, z) {
        // Convert world coordinates to grid coordinates
        const gridX = Math.floor((x / this.baseWorldScale + this.gridResolution / 2) * (64 / this.gridResolution));
        const gridZ = Math.floor((z / this.baseWorldScale + this.gridResolution / 2) * (64 / this.gridResolution));

        const nearbyTriangles = [];

        // Each grid cell has 2 triangles
        // Check current cell and adjacent cells
        for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
                const checkX = gridX + dx;
                const checkZ = gridZ + dz;

                // Skip if out of bounds
                if (checkX < 0 || checkX >= 64 || checkZ < 0 || checkZ >= 64) continue;

                // Calculate triangle indices for this cell
                // Each cell (x,z) contains triangles at:
                // - Top triangle: (z * 128 + x * 2)
                // - Bottom triangle: (z * 128 + x * 2 + 1)
                const baseIndex = checkZ * 128 + checkX * 2;

                nearbyTriangles.push(this.triangles[baseIndex]); // Top triangle
                nearbyTriangles.push(this.triangles[baseIndex + 1]); // Bottom triangle
            }
        }

        return nearbyTriangles;
    }

    getColorForHeight(height) {
        // Handle extremes first
        if (height <= 0) return BIOME_TYPES.OCEAN.base;
        if (height >= 400) return BIOME_TYPES.SNOW.base;

        // Convert actual height to percentage for biome mapping
        const heightPercent = (height / this.generator.getBaseWorldHeight()) * 100;

        // Find matching biome
        for (const biome of Object.values(BIOME_TYPES)) {
            if (heightPercent >= biome.heightRange[0] && heightPercent <= biome.heightRange[1]) {
                return biome.base;
            }
        }
        return BIOME_TYPES.OCEAN.base; // Default fallback
    }

    // Debug info for the panel
    getDebugInfo() {
        return {
            size: this.gridResolution,
            baseWorldScale: this.baseWorldScale,
            vertexCount: this.vertices.length,
            faceCount: this.faces.length,
            maxHeight: Math.max(...this.vertices.map((v) => v.y)),
            minHeight: Math.min(...this.vertices.map((v) => v.y)),
            ...this.config // Include all generation parameters
        };
    }

    // Helper method for height sampling (used by debug panel)
    getHeightAt(x, z) {
        const mapX = Math.floor(x / this.baseWorldScale + this.gridResolution / 2);
        const mapZ = Math.floor(z / this.baseWorldScale + this.gridResolution / 2);

        if (mapX < 0 || mapX >= this.gridResolution || mapZ < 0 || mapZ >= this.gridResolution) {
            return 0; // Return water level for out of bounds
        }

        return this.heightMap[mapZ][mapX];
    }

    createPhysicsMesh() {
        // Create flat arrays just like demo
        const vertices = [];
        const indices = [];

        // Add all vertices to flat array first
        this.vertices.forEach((vertex) => {
            vertices.push(vertex.x, vertex.y, vertex.z);
        });

        // Create Goblin vertices array similar to demo
        const goblinVertices = vertices
            .map((_, index) => {
                if (index % 3 === 0) {
                    return new Goblin.Vector3(vertices[index], vertices[index + 1], vertices[index + 2]);
                }
            })
            .filter(Boolean);

        // Keep your original triangle indices handling
        for (const triangle of this.triangles) {
            for (let i = 0; i < 3; i++) {
                const vertex = triangle.vertices[i];
                const index = this.vertices.findIndex((v) => v.x === vertex.x && v.y === vertex.y && v.z === vertex.z);
                indices.push(index);
            }
        }
        
        const terrainShape = new Goblin.MeshShape(goblinVertices, indices);
    const terrainBody = new Goblin.RigidBody(terrainShape, 0);
    
    // Add debug tracking
    terrainBody.debugName = `TerrainBody_${Date.now()}`;
    terrainBody.createdAt = Date.now();

        return terrainBody;
    }
}