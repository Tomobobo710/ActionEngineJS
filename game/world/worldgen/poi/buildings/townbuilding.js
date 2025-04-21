class TownBuilding extends ActionPhysicsObject3D {
    constructor(physicsWorld, worldMode, width = 8, height = 12, depth = 8, position) {
        const hw = width / 2;
        const hh = height / 2;
        const hd = depth / 2;
/*
        // Create vertices same as before...
        const v = {
            ftl: new Vector3(-hw, hh, hd),
            ftr: new Vector3(hw, hh, hd),
            fbl: new Vector3(-hw, -hh, hd),
            fbr: new Vector3(hw, -hh, hd),
            btl: new Vector3(-hw, hh, -hd),
            btr: new Vector3(hw, hh, -hd),
            bbl: new Vector3(-hw, -hh, -hd),
            bbr: new Vector3(hw, -hh, -hd)
        };

        const triangles = [
            // Front face
            new Triangle(v.ftl, v.fbl, v.ftr, "#B026FF"),
            new Triangle(v.fbl, v.fbr, v.ftr, "#B026FF"),
            // Back face
            new Triangle(v.btr, v.bbl, v.btl, "#B026FF"),
            new Triangle(v.btr, v.bbr, v.bbl, "#B026FF"),
            // Right face
            new Triangle(v.ftr, v.fbr, v.btr, "#B026FF"),
            new Triangle(v.fbr, v.bbr, v.btr, "#B026FF"),
            // Left face
            new Triangle(v.btl, v.bbl, v.ftl, "#B026FF"),
            new Triangle(v.ftl, v.bbl, v.fbl, "#B026FF"),
            // Top face
            new Triangle(v.ftl, v.ftr, v.btr, "#B026FF"),
            new Triangle(v.ftl, v.btr, v.btl, "#B026FF"),
            // Bottom face
            new Triangle(v.fbl, v.bbl, v.fbr, "#B026FF"),
            new Triangle(v.bbl, v.bbr, v.fbr, "#B026FF")
        ];
*/
       const characterModel = GLBLoader.loadModel(townModel);
        
        const triangles = characterModel.triangles;
        
        super(physicsWorld, triangles);
        
        this.animator = new ModelAnimationController(characterModel);
        this.animator.play(0, true);

        // Physics setup
        const shape = new Goblin.BoxShape(width / 2 , height / 2 , depth / 2);
        this.body = new Goblin.RigidBody(shape, 0); // mass 0 = static
        this.body.position.set(position.x, position.y + hh, position.z);
        this.body.addListener(
            'contact',
            function( other_body, contact ) {
                // this body has come in `contact with` other_body and the details are provided by `contact`
                console.log("TOWN");
            }
        );
        this.physicsWorld.addObject(this); // Add self to world
    }
}