class DungeonBuilding extends ActionPhysicsObject3D {
    constructor(physicsWorld, worldMode, width = 10, height = 6, depth = 10, position) {
        const hw = width / 2;
        const hh = height / 2;
        const hd = depth / 2;

        // Create vertices for dungeon shape (keeping same visual geometry)
        const v = {
            ftl: new Vector3(-hw, hh, hd),
            ftr: new Vector3(hw, hh, hd),
            fbl: new Vector3(-hw, -hh, hd),
            fbr: new Vector3(hw, -hh, hd),
            btl: new Vector3(-hw, hh, -hd),
            btr: new Vector3(hw, hh, -hd),
            bbl: new Vector3(-hw, -hh, -hd),
            bbr: new Vector3(hw, -hh, -hd),
            atop: new Vector3(0, hh + 1, hd)
        };

        const triangles = [
            // Front face
            new Triangle(v.ftl, v.fbl, v.ftr, "#00FFFF"),
            new Triangle(v.fbl, v.fbr, v.ftr, "#00FFFF"),
            // Back face
            new Triangle(v.btr, v.bbl, v.btl, "#00FFFF"),
            new Triangle(v.btr, v.bbr, v.bbl, "#00FFFF"),
            // Right face
            new Triangle(v.ftr, v.fbr, v.btr, "#00FFFF"),
            new Triangle(v.fbr, v.bbr, v.btr, "#00FFFF"),
            // Left face
            new Triangle(v.btl, v.bbl, v.ftl, "#00FFFF"),
            new Triangle(v.ftl, v.bbl, v.fbl, "#00FFFF"),
            // Top face
            new Triangle(v.ftl, v.ftr, v.btr, "#00FFFF"),
            new Triangle(v.ftl, v.btr, v.btl, "#00FFFF"),
            // Bottom face
            new Triangle(v.fbl, v.bbl, v.fbr, "#00FFFF"),
            new Triangle(v.bbl, v.bbr, v.fbr, "#00FFFF")
        ];

        super(physicsWorld, triangles);

        // Physics setup
        const shape = new Goblin.BoxShape(width / 2, height / 2, depth / 2);
        this.body = new Goblin.RigidBody(shape, 0);
        this.body.position.set(position.x, position.y + hh, position.z);
        this.body.addListener(
            'contact',
            function( other_body, contact ) {
                // this body has come in `contact with` other_body and the details are provided by `contact`
                console.log("Dungeon");
                // Queue the mode switch for next frame
                requestAnimationFrame(() => {
                    worldMode.gameModeManager.switchMode('battle');
                });
            }
        );
        this.physicsWorld.addObject(this);
        this.updateVisual();
    }
}