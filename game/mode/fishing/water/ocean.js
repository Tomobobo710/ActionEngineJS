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
                                new Vector3(x1, 50, z1),
                                new Vector3(x1, 50, z2),
                                new Vector3(x2, 50, z1),
                                "#0645f4ff"
                            ),
                            new Triangle(
                                new Vector3(x2, 50, z2),
                                new Vector3(x2, 50, z1),
                                new Vector3(x1, 50, z2),
                                "#0645f4ff"
                            ),
                            new Triangle(
                                new Vector3(x1, 50, z1),
                                new Vector3(x2, 50, z1),
                                new Vector3(x1, 50, z2),
                                "#0645f4ff"
                            ),
                            new Triangle(
                                new Vector3(x2, 50, z2),
                                new Vector3(x1, 50, z2),
                                new Vector3(x2, 50, z1),
                                "#0645f4ff"
                            )
                        );
                    }
                }
            }
        }
        super(physicsWorld, triangles);

        this.shader = "water"; // Set shader to use the volumetric water shader
        this.time = 0;
        this.updateInterval = 1 / 30;


        this.body = new Goblin.RigidBody(new Goblin.BoxShape(width / 2, 1, length / 2), 0);
        this.body.position.set(0, 50, 0);
        physicsWorld.addObject(this);
    }

    getWaterHeightAt(x, z) {
        let height = 0;
        const waves = [
            { A: 0.5, w: 1.0, phi: 1.0, Q: 0.3, dir: new Vector3(1, 0, 0.2).normalize() },
            { A: 0.3, w: 2.0, phi: 0.5, Q: 0.2, dir: new Vector3(0.8, 0, 0.3).normalize() },
            { A: 0.2, w: 3.0, phi: 1.5, Q: 0.1, dir: new Vector3(0.3, 0, 1).normalize() }
        ];

        waves.forEach((wave) => {
            const dotProduct = wave.dir.x * x + wave.dir.z * z;
            const phase = wave.w * dotProduct - wave.phi * this.time;
            height += wave.A * Math.sin(phase);
        });

        return this.body.position.y + height; // Add base ocean height
    }
}