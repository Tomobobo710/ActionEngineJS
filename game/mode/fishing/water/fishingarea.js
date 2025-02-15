class FishingArea {
    constructor(width = 500, length = 500, depth = 100) {
        this.bounds = {
            width,
            length,
            depth
        };
        this.fish = new Map();
        this.lure = null;
    }

    setPhysicsWorld(physicsWorld) {
        this.physicsWorld = physicsWorld;
    }

    generateInitialFish(count, physicsWorld) {
        const types = ["BASS", "TROUT", "SWORDFISH"];
        // Divide the fishing area into sectors
        const sectorsPerDimension = Math.ceil(Math.cbrt(count)); // Cubic root for 3D division
        const sectorWidth = this.bounds.width / sectorsPerDimension;
        const sectorDepth = this.bounds.depth / sectorsPerDimension;
        const sectorLength = this.bounds.length / sectorsPerDimension;

        // Create array of all possible sectors
        const sectors = [];
        for (let x = 0; x < sectorsPerDimension; x++) {
            for (let y = 0; y < sectorsPerDimension; y++) {
                for (let z = 0; z < sectorsPerDimension; z++) {
                    sectors.push({ x, y, z });
                }
            }
        }

        // Shuffle sectors array for random distribution
        for (let i = sectors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sectors[i], sectors[j]] = [sectors[j], sectors[i]];
        }

        // Generate fish in different sectors
        for (let i = 0; i < count; i++) {
            // Get sector for this fish
            const sector = sectors[i % sectors.length];
            // Calculate position within sector (with some randomization within the sector)
            const position = new Vector3(
                (sector.x + Math.random()) * sectorWidth - this.bounds.width / 2,
                (sector.y + Math.random()) * sectorDepth - this.bounds.depth / 2,
                (sector.z + Math.random()) * sectorLength - this.bounds.length / 2
            );
            const rotationAxis = ["x", "y", "z"][Math.floor(Math.random() * 3)];
            const randomType = types[Math.floor(Math.random() * types.length)];
            const fish = FishGenerator.generate(physicsWorld, randomType, position, rotationAxis);
            this.addFish(fish);
        }
    }
    
    addFish(fish) {
        // Create an AI controller for this fish
        const ai = new FishAI(fish, this.bounds);
        this.fish.set(fish, ai);
    }
    
    setLure(lure) {
        // Store reference but only allow interaction when in water
        this.lure = lure;
    }

    update(deltaTime) {
        // Only update fish AI if there's a lure in water
        const activeLure = this.lure?.state === "inWater" ? this.lure : null;
        for (const [fish, ai] of this.fish) {
            ai.update(deltaTime, activeLure);
        }
    }

    // Method to get floor triangles for rendering
    getFloorTriangles() {
        return this.floor.getTriangles();
    }

    // Method to check if a position is within bounds
    isInBounds(position) {
        return (
            Math.abs(position.x) <= this.bounds.width / 2 &&
            Math.abs(position.y) <= this.bounds.depth / 2 &&
            Math.abs(position.z) <= this.bounds.length / 2
        );
    }

    // Method to get the nearest valid position if out of bounds
    getValidPosition(position) {
        return new Vector3(
            Math.max(-this.bounds.width / 2, Math.min(this.bounds.width / 2, position.x)),
            Math.max(-this.bounds.depth / 2, Math.min(this.bounds.depth / 2, position.y)),
            Math.max(-this.bounds.length / 2, Math.min(this.bounds.length / 2, position.z))
        );
    }

    // Method to get random position within bounds
    getRandomPosition() {
        return new Vector3(
            (Math.random() - 0.5) * this.bounds.width,
            (Math.random() - 0.5) * this.bounds.depth,
            (Math.random() - 0.5) * this.bounds.length
        );
    }

    // Method to clean up resources
    cleanup() {
        this.fish.clear();
        this.lure = null;
        this.floor = null;
    }
}

class Floor extends ActionPhysicsObject3D {
    constructor(physicsWorld, width, length, segments = 32, baseHeight) {
        const triangles = [];
        const spacing = width / segments;
        
        // Helper function for 2D Perlin-like noise
        const generateNoise = (nx, nz, frequency) => {
            const x = nx * frequency;
            const z = nz * frequency;
            return (Math.sin(x) * Math.cos(z) + 
                   Math.sin(x * 0.5) * Math.cos(z * 0.5) +
                   Math.sin(x * 2) * Math.cos(z * 2)) / 3;
        };

        // Create height map using layered noise with more extreme variations
        const heightMap = [];
        for (let z = 0; z <= segments; z++) {
            heightMap[z] = [];
            for (let x = 0; x <= segments; x++) {
                const nx = x / segments;
                const nz = z / segments;
                
                // Increased amplitude for more dramatic terrain
                const largeScale = generateNoise(nx, nz, 3) * 80;  // Increased from 40
                const mediumScale = generateNoise(nx, nz, 8) * 40; // Increased from 20
                const smallScale = generateNoise(nx, nz, 15) * 20; // Increased from 10
                
                let height = baseHeight + largeScale + mediumScale + smallScale;
                
                // More frequent and deeper trenches
                if (Math.random() < 0.08) {  // Increased from 0.05
                    const trenchDepth = Math.random() * 60 + 40;  // Increased depth range
                    height -= trenchDepth;
                }
                
                // Occasional peaks
                if (Math.random() < 0.05) {
                    const peakHeight = Math.random() * 30 + 20;
                    height += peakHeight;
                }
                
                heightMap[z][x] = height;
            }
        }
        
        // Less smoothing to preserve more dramatic features
        const smoothHeightMap = (iterations = 1) => {  // Reduced iterations
            for (let iter = 0; iter < iterations; iter++) {
                const smoothed = Array(segments + 1).fill().map(() => new Array(segments + 1));
                
                for (let z = 0; z <= segments; z++) {
                    for (let x = 0; x <= segments; x++) {
                        let sum = 0;
                        let count = 0;
                        
                        // Sample neighboring points
                        for (let dz = -1; dz <= 1; dz++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                const nz = z + dz;
                                const nx = x + dx;
                                if (nz >= 0 && nz <= segments && nx >= 0 && nx <= segments) {
                                    sum += heightMap[nz][nx];
                                    count++;
                                }
                            }
                        }
                        smoothed[z][x] = sum / count;
                    }
                }
                
                // Update height map with smoothed values
                for (let z = 0; z <= segments; z++) {
                    for (let x = 0; x <= segments; x++) {
                        // Blend smoothed value with original to preserve some sharpness
                        heightMap[z][x] = (smoothed[z][x] * 0.7) + (heightMap[z][x] * 0.3);
                    }
                }
            }
        };
        
        smoothHeightMap();
        
        // Create triangles with more pronounced color variation
        for (let z = 0; z < segments; z++) {
            for (let x = 0; x < segments; x++) {
                const x1 = x * spacing - width / 2;
                const x2 = (x + 1) * spacing - width / 2;
                const z1 = z * spacing - length / 2;
                const z2 = (z + 1) * spacing - length / 2;
                
                const h1 = heightMap[z][x];
                const h2 = heightMap[z][x + 1];
                const h3 = heightMap[z + 1][x];
                const h4 = heightMap[z + 1][x + 1];
                
                // Enhanced color variation based on height
                const getColorForHeight = (height) => {
                    const depthDiff = Math.abs(baseHeight - height);
                    const r = Math.min(255, Math.floor(51 + depthDiff));
                    const g = Math.min(255, Math.floor(102 + depthDiff * 0.7));
                    const b = Math.min(255, Math.floor(153 + depthDiff * 0.5));
                    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                };
                
                const color1 = getColorForHeight((h1 + h2 + h3) / 3);
                const color2 = getColorForHeight((h2 + h3 + h4) / 3);
                
                triangles.push(
                    new Triangle(
                        new Vector3(x1, h1, z1),
                        new Vector3(x1, h3, z2),
                        new Vector3(x2, h2, z1),
                        color1
                    ),
                    new Triangle(
                        new Vector3(x2, h4, z2),
                        new Vector3(x2, h2, z1),
                        new Vector3(x1, h3, z2),
                        color2
                    )
                );
            }
        }
        
        super(physicsWorld, triangles);
        
        this.body = new Goblin.RigidBody(new Goblin.BoxShape(width / 2, 1, length / 2), 0);
        this.body.position.set(0, baseHeight, 0);
        physicsWorld.addObject(this);
    }

    getHeightAt(x, z) {
    // Guard against missing triangles
    if (!this.triangles || !Array.isArray(this.triangles) || this.triangles.length === 0) {
        return this.body.position.y;
    }

    // Find valid triangles (those with all vertices)
    const validTriangles = this.triangles.filter(triangle => 
        triangle && triangle.v1 && triangle.v2 && triangle.v3 &&
        typeof triangle.v1.x === 'number' && typeof triangle.v1.z === 'number' &&
        typeof triangle.v2.x === 'number' && typeof triangle.v2.z === 'number' &&
        typeof triangle.v3.x === 'number' && typeof triangle.v3.z === 'number'
    );

    if (validTriangles.length === 0) {
        return this.body.position.y;
    }

    // Try to find containing triangle
    for (const triangle of validTriangles) {
        try {
            if (this.pointInTriangle(
                x, z,
                triangle.v1.x, triangle.v1.z,
                triangle.v2.x, triangle.v2.z,
                triangle.v3.x, triangle.v3.z
            )) {
                return this.barycentricInterpolation(x, z, triangle);
            }
        } catch (e) {
            continue; // Skip any problematic triangles
        }
    }

    return this.body.position.y;
}

    pointInTriangle(px, pz, x1, z1, x2, z2, x3, z3) {
        let d1 = this.sign(px, pz, x1, z1, x2, z2);
        let d2 = this.sign(px, pz, x2, z2, x3, z3);
        let d3 = this.sign(px, pz, x3, z3, x1, z1);

        let hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
        let hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

        return !(hasNeg && hasPos);
    }

    sign(px, pz, x1, z1, x2, z2) {
        return (px - x2) * (z1 - z2) - (x1 - x2) * (pz - z2);
    }

    barycentricInterpolation(px, pz, triangle) {
        let v1 = triangle.v1;
        let v2 = triangle.v2;
        let v3 = triangle.v3;
        
        let denom = ((v2.z - v3.z) * (v1.x - v3.x) + (v3.x - v2.x) * (v1.z - v3.z));
        let l1 = ((v2.z - v3.z) * (px - v3.x) + (v3.x - v2.x) * (pz - v3.z)) / denom;
        let l2 = ((v3.z - v1.z) * (px - v3.x) + (v1.x - v3.x) * (pz - v3.z)) / denom;
        let l3 = 1.0 - l1 - l2;

        return l1 * v1.y + l2 * v2.y + l3 * v3.y;
    }

    generateFloorMesh() {
        const cellWidth = this.width / this.divisions;
        const cellLength = this.length / this.divisions;
        
        const startX = -this.width / 2;
        const startZ = -this.length / 2;

        for (let i = 0; i < this.divisions; i++) {
            for (let j = 0; j < this.divisions; j++) {
                const x1 = startX + i * cellWidth;
                const x2 = startX + (i + 1) * cellWidth;
                const z1 = startZ + j * cellLength;
                const z2 = startZ + (j + 1) * cellLength;

                const v1 = new Vector3(x1, this.height, z1);
                const v2 = new Vector3(x2, this.height, z1);
                const v3 = new Vector3(x2, this.height, z2);
                const v4 = new Vector3(x1, this.height, z2);

                const floorTriangle1 = new Triangle(v1, v2, v3, "#336699");
                const floorTriangle2 = new Triangle(v1, v3, v4, "#336699");

                this.physicsWorld.addObject(floorTriangle1);
                this.physicsWorld.addObject(floorTriangle2);
            }
        }
    }
}