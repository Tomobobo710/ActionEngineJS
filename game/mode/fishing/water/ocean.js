class Ocean extends ActionPhysicsObject3D {
    constructor(physicsWorld, width = 100, length = 100, segments = 6, gridSize = 3) {
        const triangles = [];
        const spacing = width / segments;
        const offset = Math.floor(gridSize / 2);
        // Bottom layer
        for (let tileZ = -offset; tileZ < gridSize - offset; tileZ++) {
            for (let tileX = -offset; tileX < gridSize - offset; tileX++) {
                for (let z = 0; z < segments; z++) {
                    for (let x = 0; x < segments; x++) {
                        const x1 = x * spacing + tileX * width - width / 2;
                        const x2 = (x + 1) * spacing + tileX * width - width / 2;
                        const z1 = z * spacing + tileZ * length - length / 2;
                        const z2 = (z + 1) * spacing + tileZ * length - length / 2;
                        triangles.push(
                            new Triangle(
                                new Vector3(x1, 0, z1),
                                new Vector3(x1, 0, z2),
                                new Vector3(x2, 0, z1),
                                "#0645f4ff"
                            ),
                            new Triangle(
                                new Vector3(x2, 0, z2),
                                new Vector3(x2, 0, z1),
                                new Vector3(x1, 0, z2),
                                "#0645f4ff"
                            ),
                            new Triangle(
                                new Vector3(x1, 0, z1),
                                new Vector3(x2, 0, z1),
                                new Vector3(x1, 0, z2),
                                "#0645f4ff"
                            ),
                            new Triangle(
                                new Vector3(x2, 0, z2),
                                new Vector3(x1, 0, z2),
                                new Vector3(x2, 0, z1),
                                "#0645f4ff"
                            )
                        );
                    }
                }
            }
        }
        super(physicsWorld, triangles);
        this.time = 0;
        this.body = new Goblin.RigidBody(new Goblin.BoxShape(width / 2, 1, length / 2), 0);
        this.body.position.set(0, 50, 0);
        physicsWorld.addObject(this);
    }

    getWaterHeightAt(x, z) {
        let height = 0;
        const waves = [
            // Massive primary wave
            { 
                A: 4.0,          // Much larger amplitude
                w: 2.5,          
                phi: 1.0,
                Q: 0.3,
                dir: new Vector3(1, 0, 0.2).normalize()
            },
            // Large secondary wave
            { 
                A: 2.5,          // Increased amplitude
                w: 4.0,          
                phi: 0.5,
                Q: 0.2,
                dir: new Vector3(-0.6, 0, 0.8).normalize()
            },
            // Medium high-frequency wave
            { 
                A: 1.5,          // Increased amplitude
                w: 6.0,          
                phi: 1.5,
                Q: 0.1,
                dir: new Vector3(0.3, 0, -1).normalize()
            },
            // Smaller detail wave
            {
                A: 0.8,          // Increased amplitude
                w: 8.0,          
                phi: 2.0,
                Q: 0.15,
                dir: new Vector3(-0.4, 0, -0.9).normalize()
            }
        ];

        waves.forEach((wave) => {
            const dotProduct = wave.dir.x * x + wave.dir.z * z;
            const phase = wave.w * dotProduct - wave.phi * this.time;
            height += wave.A * Math.sin(phase);
        });
        
        return this.body.position.y + height;
    }
}