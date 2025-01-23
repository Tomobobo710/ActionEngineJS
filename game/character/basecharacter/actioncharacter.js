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

        this.characterModel = GLBLoader.loadModel(foxModel);
        this.animator = new ModelAnimationController(this.characterModel);
        console.log("Available animations:", this.animator.getAnimationNames());

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
     * Gets the transformed triangles for rendering the character model.
     * Since animation updates happen separately through ModelAnimationController,
     * this method only handles vertex transformations and skinning.
     *
     * @returns {Triangle[]} Array of transformed triangles ready for rendering
     */
    getCharacterModelTriangles() {
        function transformVertexWithSkin(vertex, vertexIndex, triangle, skin) {
            if (!triangle.jointData || !triangle.weightData) {
                return vertex;
            }

            const finalPosition = new Vector3(0, 0, 0);
            const joints = triangle.jointData[vertexIndex];
            const weights = triangle.weightData[vertexIndex];
            let totalWeight = 0;

            for (let i = 0; i < 4; i++) {
                const weight = weights[i];
                if (weight > 0) {
                    totalWeight += weight;
                    const jointMatrix = skin.jointMatrices[joints[i]];
                    if (jointMatrix) {
                        const transformed = Vector3.transformMat4(vertex, jointMatrix);
                        finalPosition.x += transformed.x * weight;
                        finalPosition.y += transformed.y * weight;
                        finalPosition.z += transformed.z * weight;
                    }
                }
            }

            if (totalWeight > 0 && Math.abs(totalWeight - 1.0) > 0.001) {
                finalPosition.x /= totalWeight;
                finalPosition.y /= totalWeight;
                finalPosition.z /= totalWeight;
            }

            return finalPosition;
        }

        function applyTransform(vertex, transform) {
            return Vector3.transformMat4(vertex, transform);
        }

        // Calculate model orientation transform based on facing direction
        const angle = Math.atan2(this.facingDirection.x, this.facingDirection.z);
        const modelTransform = Matrix4.create();
        Matrix4.rotateY(modelTransform, modelTransform, angle);

        const transformedTriangles = [];
        const skin = this.characterModel.skins[0];

        // Process each triangle in the model
        for (const triangle of this.characterModel.triangles) {
            // Apply skinning to each vertex
            const skinnedVertices = [];
            for (let i = 0; i < triangle.vertices.length; i++) {
                skinnedVertices.push(transformVertexWithSkin(triangle.vertices[i], i, triangle, skin));
            }

            // Apply model transform to skinned vertices
            const transformedVerts = [];
            for (let i = 0; i < skinnedVertices.length; i++) {
                transformedVerts.push(applyTransform(skinnedVertices[i], modelTransform));
            }

            // Create final transformed triangle
            transformedTriangles.push(
                new Triangle(transformedVerts[0], transformedVerts[1], transformedVerts[2], triangle.color)
            );
        }

        return transformedTriangles;
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
            const d1 = MathUtils.sign(p, v1, v2);
            const d2 = MathUtils.sign(p, v2, v3);
            const d3 = MathUtils.sign(p, v3, v1);

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
}