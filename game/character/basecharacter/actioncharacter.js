// game/character/basecharacter/actioncharacter.js
class ActionCharacter {
    constructor(terrain, camera) {
        this.camera = camera;
        this.terrain = terrain;

        this.basePosition = new Vector3(0, 0, 0); // Ground position
        this.position = new Vector3(0, 40, 0); // Center position
        this.facingDirection = new Vector3(0, 0, 1);
        this.rotation = 0;
        this.size = 4;
        this.height = 6;
        this.scale = 1; // og 0.575

        const loader = new GLBLoader();

        // From base64
        this.characterModel = loader.loadModel(suzaneModel);

        //this.characterModel = this.createDefaultCharacterModel();

        // Terrain info
        this.gridPosition = { x: 0, z: 0 };
        this.currentBiome = null;
        this.heightPercent = 0;
        this.terrainHeight = 0;
        this.updateTerrainInfo();
    }
    createDefaultCharacterModel() {
        const segments = 16; // Number of segments around the capsule
        const triangles = [];
        const radius = this.size / 2;
        const cylinderHeight = this.height - this.size; // Subtract diameter to account for hemispheres
        const halfCylinderHeight = cylinderHeight / 2;

        // Helper function to create vertex on hemisphere
        const createSphereVertex = (phi, theta, yOffset) => {
            return new Vector3(
                radius * Math.sin(phi) * Math.cos(theta),
                yOffset + radius * Math.cos(phi),
                radius * Math.sin(phi) * Math.sin(theta)
            );
        };

        // Create top hemisphere
        for (let lat = 0; lat <= segments / 2; lat++) {
            const phi = (lat / segments) * Math.PI;
            const nextPhi = ((lat + 1) / segments) * Math.PI;

            for (let lon = 0; lon < segments; lon++) {
                const theta = (lon / segments) * 2 * Math.PI;
                const nextTheta = ((lon + 1) / segments) * 2 * Math.PI;

                if (lat === 0) {
                    // Top cap triangle (this one was correct)
                    triangles.push(
                        new Triangle(
                            new Vector3(0, halfCylinderHeight + radius, 0),
                            createSphereVertex(Math.PI / segments, nextTheta, halfCylinderHeight),
                            createSphereVertex(Math.PI / segments, theta, halfCylinderHeight),
                            "#FFFF00"
                        )
                    );
                } else {
                    // Hemisphere body triangles (fixing winding order)
                    const v1 = createSphereVertex(phi, theta, halfCylinderHeight);
                    const v2 = createSphereVertex(nextPhi, theta, halfCylinderHeight);
                    const v3 = createSphereVertex(nextPhi, nextTheta, halfCylinderHeight);
                    const v4 = createSphereVertex(phi, nextTheta, halfCylinderHeight);
                    triangles.push(new Triangle(v1, v3, v2, "#FFFF00")); // Swapped v2 and v3
                    triangles.push(new Triangle(v1, v4, v3, "#FFFF00")); // Swapped v3 and v4
                }
            }
        }

        // Create cylinder body (fixing winding order)
        for (let lon = 0; lon < segments; lon++) {
            const theta = (lon / segments) * 2 * Math.PI;
            const nextTheta = ((lon + 1) / segments) * 2 * Math.PI;

            const topLeft = new Vector3(radius * Math.cos(theta), halfCylinderHeight, radius * Math.sin(theta));
            const topRight = new Vector3(
                radius * Math.cos(nextTheta),
                halfCylinderHeight,
                radius * Math.sin(nextTheta)
            );
            const bottomLeft = new Vector3(radius * Math.cos(theta), -halfCylinderHeight, radius * Math.sin(theta));
            const bottomRight = new Vector3(
                radius * Math.cos(nextTheta),
                -halfCylinderHeight,
                radius * Math.sin(nextTheta)
            );

            triangles.push(new Triangle(topLeft, topRight, bottomLeft, "#FF0000")); // Swapped bottomLeft and topRight
            triangles.push(new Triangle(bottomLeft, topRight, bottomRight, "#FF0000")); // Reordered vertices
        }

        // Create bottom hemisphere
        // Change the range to stop BEFORE the last segment
        for (let lat = segments / 2; lat < segments - 1; lat++) {
            // Changed <= to < and segments to segments-1
            const phi = (lat / segments) * Math.PI;
            const nextPhi = ((lat + 1) / segments) * Math.PI;

            for (let lon = 0; lon < segments; lon++) {
                const theta = (lon / segments) * 2 * Math.PI;
                const nextTheta = ((lon + 1) / segments) * 2 * Math.PI;

                if (lat === segments - 1) {
                    // Bottom cap triangle
                    triangles.push(
                        new Triangle(
                            new Vector3(0, -halfCylinderHeight - radius, 0),
                            createSphereVertex(Math.PI - Math.PI / segments, theta, -halfCylinderHeight),
                            createSphereVertex(Math.PI - Math.PI / segments, nextTheta, -halfCylinderHeight),
                            "#FF0000"
                        )
                    );
                } else {
                    // Hemisphere body triangles
                    const v1 = createSphereVertex(phi, theta, -halfCylinderHeight);
                    const v2 = createSphereVertex(nextPhi, theta, -halfCylinderHeight);
                    const v3 = createSphereVertex(nextPhi, nextTheta, -halfCylinderHeight);
                    const v4 = createSphereVertex(phi, nextTheta, -halfCylinderHeight);
                    triangles.push(new Triangle(v1, v3, v2, "#FF0000"));
                    triangles.push(new Triangle(v1, v4, v3, "#FF0000"));
                }
            }
        }

        // Then separately create just the bottom cap triangles once
        for (let lon = 0; lon < segments; lon++) {
            const theta = (lon / segments) * 2 * Math.PI;
            const nextTheta = ((lon + 1) / segments) * 2 * Math.PI;

            triangles.push(
                new Triangle(
                    new Vector3(0, -halfCylinderHeight - radius, 0),
                    createSphereVertex(Math.PI - Math.PI / segments, theta, -halfCylinderHeight),
                    createSphereVertex(Math.PI - Math.PI / segments, nextTheta, -halfCylinderHeight),
                    "#FF0000"
                )
            );
        }

        return triangles;
    }
    createDefaultBoxCharacterModel() {
        // Character model is made out of Triangles
        const halfSize = this.size / 2;
        const halfHeight = this.height / 2;
        const yOffset = 0; // I mean it works.. but why we gotta offset by 1? All my homies hate off by one errors
        // Define vertices
        const v = {
            ftl: new Vector3(-halfSize, halfHeight + yOffset, halfSize), // 0
            ftr: new Vector3(halfSize, halfHeight + yOffset, halfSize), // 1
            fbl: new Vector3(-halfSize, -halfHeight + yOffset, halfSize), // 2
            fbr: new Vector3(halfSize, -halfHeight + yOffset, halfSize), // 3
            btl: new Vector3(-halfSize, halfHeight + yOffset, -halfSize), // 4
            btr: new Vector3(halfSize, halfHeight + yOffset, -halfSize), // 5
            bbl: new Vector3(-halfSize, -halfHeight + yOffset, -halfSize), // 6
            bbr: new Vector3(halfSize, -halfHeight + yOffset, -halfSize) // 7
        };
        return [
            // Front face (yellow)
            new Triangle(v.ftl, v.fbl, v.ftr, "#FFFF00"),
            new Triangle(v.fbl, v.fbr, v.ftr, "#FFFF00"),
            // Back face
            new Triangle(v.btr, v.bbl, v.btl, "#FF0000"),
            new Triangle(v.btr, v.bbr, v.bbl, "#FF0000"),
            // Right face
            new Triangle(v.ftr, v.fbr, v.btr, "#FF0000"),
            new Triangle(v.fbr, v.bbr, v.btr, "#FF0000"),
            // Left face
            new Triangle(v.btl, v.bbl, v.ftl, "#FF0000"),
            new Triangle(v.ftl, v.bbl, v.fbl, "#FF0000"),
            // Top face
            new Triangle(v.ftl, v.ftr, v.btr, "#FF0000"),
            new Triangle(v.ftl, v.btr, v.btl, "#FF0000"),
            // Bottom face
            new Triangle(v.fbl, v.bbl, v.fbr, "#FF0000"),
            new Triangle(v.bbl, v.bbr, v.fbr, "#FF0000")
        ];
    }

    getHeightOnTriangle(triangle, x, z) {
        const [v1, v2, v3] = triangle.vertices;

        const denominator = (v2.z - v3.z) * (v1.x - v3.x) + (v3.x - v2.x) * (v1.z - v3.z);
        const a = ((v2.z - v3.z) * (x - v3.x) + (v3.x - v2.x) * (z - v3.z)) / denominator;
        const b = ((v3.z - v1.z) * (x - v3.x) + (v1.x - v3.x) * (z - v3.z)) / denominator;
        const c = 1 - a - b;

        return a * v1.y + b * v2.y + c * v3.y;
    }

    getModelMatrix() {
        const matrix = Matrix4.create();
        const rotationMatrix = Matrix4.create();

        // Apply initial vertical offset
        Matrix4.translate(matrix, matrix, [0, this.height / 8, 0]);

        // Apply position
        Matrix4.translate(matrix, matrix, this.position.toArray());

        // Apply full rotation from physics body if it exists
        if (this.body) {
            Matrix4.fromQuat(rotationMatrix, this.body.rotation);
            Matrix4.multiply(matrix, matrix, rotationMatrix);
        } else {
            // Fall back to simple Y rotation if no physics body
            Matrix4.rotateY(matrix, matrix, this.rotation);
        }

        // Apply scale
        Matrix4.scale(matrix, matrix, [this.scale, this.scale, this.scale]);

        return matrix;
    }

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

    // Required interface methods that must be implemented
    applyInput(input, deltaTime) {
        throw new Error("Must be implemented by subclass");
    }

    update(deltaTime) {
        throw new Error("Must be implemented by subclass");
    }

    draw(ctx, camera) {
        throw new Error("Must be implemented by subclass");
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
                    indices: [0, 1, 2], // Modified since we no longer have face indices
                    minY: Math.min(v1.y, v2.y, v3.y),
                    maxY: Math.max(v1.y, v2.y, v3.y),
                    avgY: avgHeight,
                    normal: triangle.normal, // Using triangle's calculated normal
                    biome: biomeType
                };
            }
        }
        return null;
    }

    sign(p, v1, v2) {
        return (p.x - v2.x) * (v1.z - v2.z) - (v1.x - v2.x) * (p.z - v2.z);
    }

    getCurrentAndNearbyTriangles() {
        // Get world position
        const x = this.position.x;
        const z = this.position.z;

        return this.terrain.findNearbyTriangles(x, z);
    }

    getCenterPosition() {
        return this.position;
    }
}