class FishingSpotMarker extends ActionPhysicsObject3D {
    constructor(physicsWorld, worldMode, position) {
        const poleWidth = 0.3;
        const poleHeight = 4;
        const poleDepth = 0.3;
        const flagWidth = 2;
        const flagHeight = 1;
        const flagThickness = 0.1;
        const hw = poleWidth / 2;
        const hh = poleHeight / 2;
        const hd = poleDepth / 2;
        // Define vertices for the pole
        const p = {
            ftl: new Vector3(-hw, hh, hd),
            ftr: new Vector3(hw, hh, hd),
            fbl: new Vector3(-hw, -hh, hd),
            fbr: new Vector3(hw, -hh, hd),
            btl: new Vector3(-hw, hh, -hd),
            btr: new Vector3(hw, hh, -hd),
            bbl: new Vector3(-hw, -hh, -hd),
            bbr: new Vector3(hw, -hh, -hd)
        };

        // Define vertices for the flag (positioned at the top of the pole)
        const f = {
            ftl: new Vector3(hw, hh, hd),
            ftr: new Vector3(hw + flagWidth, hh, hd),
            fbl: new Vector3(hw, hh - flagHeight, hd),
            fbr: new Vector3(hw + flagWidth, hh - flagHeight, hd),
            btl: new Vector3(hw, hh, hd - flagThickness),
            btr: new Vector3(hw + flagWidth, hh, hd - flagThickness),
            bbl: new Vector3(hw, hh - flagHeight, hd - flagThickness),
            bbr: new Vector3(hw + flagWidth, hh - flagHeight, hd - flagThickness)
        };

        const triangles = [
            // Pole triangles
            // Front face
            new Triangle(p.ftl, p.fbl, p.ftr, "#8B4513"), // Brown color for pole
            new Triangle(p.fbl, p.fbr, p.ftr, "#8B4513"),
            // Back face
            new Triangle(p.btr, p.bbl, p.btl, "#8B4513"),
            new Triangle(p.btr, p.bbr, p.bbl, "#8B4513"),
            // Right face
            new Triangle(p.ftr, p.fbr, p.btr, "#8B4513"),
            new Triangle(p.fbr, p.bbr, p.btr, "#8B4513"),
            // Left face
            new Triangle(p.btl, p.bbl, p.ftl, "#8B4513"),
            new Triangle(p.ftl, p.bbl, p.fbl, "#8B4513"),

            // Flag triangles
            // Front face
            new Triangle(f.ftl, f.fbl, f.ftr, "#4169E1"), // Royal blue for flag
            new Triangle(f.fbl, f.fbr, f.ftr, "#4169E1"),
            // Back face
            new Triangle(f.btr, f.bbl, f.btl, "#4169E1"),
            new Triangle(f.btr, f.bbr, f.bbl, "#4169E1"),
            // Right face
            new Triangle(f.ftr, f.fbr, f.btr, "#4169E1"),
            new Triangle(f.fbr, f.bbr, f.btr, "#4169E1"),
            // Left face
            new Triangle(f.btl, f.bbl, f.ftl, "#4169E1"),
            new Triangle(f.ftl, f.bbl, f.fbl, "#4169E1"),
            // Top face
            new Triangle(f.ftl, f.ftr, f.btr, "#4169E1"),
            new Triangle(f.ftl, f.btr, f.btl, "#4169E1"),
            // Bottom face
            new Triangle(f.fbl, f.bbl, f.fbr, "#4169E1"),
            new Triangle(f.bbl, f.bbr, f.fbr, "#4169E1")
        ];

        super(physicsWorld, triangles);

        // Physics setup
        // Create Goblin compound shape
        const compoundShape = new Goblin.CompoundShape();

        const poleShape = new Goblin.BoxShape(poleWidth, poleHeight, poleDepth);
        const flagShape = new Goblin.BoxShape(flagWidth, flagHeight, flagThickness);

        // Add shapes at their relative positions using addChildShape
        compoundShape.addChildShape(poleShape, new Goblin.Vector3(0, 0, 0), new Goblin.Quaternion(0, 0, 0, 1));

        compoundShape.addChildShape(
            flagShape,
            new Goblin.Vector3(poleWidth / 2 + flagWidth / 2, poleHeight / 2 - flagHeight / 2, 0),
            new Goblin.Quaternion(0, 0, 0, 1)
        );

        this.body = new Goblin.RigidBody(compoundShape, 0);
        this.body.position.set(position.x, position.y + poleHeight / 2, position.z);
        this.body.addListener("contact", function (other_body, contact) {
            // this body has come in `contact with` other_body and the details are provided by `contact`
            console.log("FishingSpot");
            requestAnimationFrame(() => {
                    worldMode.gameModeManager.switchMode('fishing');
                });
        });
        this.physicsWorld.addObject(this); // Add self to world
    }
}