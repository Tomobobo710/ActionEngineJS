/*class FishingSpotMarker extends ActionPhysicsObject3D {
    constructor(physicsWorld, position) {
        /*const poleWidth = 0.3;
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

        // Define vertices for the flag
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

        // Define triangles for both pole and flag
        const poleTriangles = [
            // Front face
            new Triangle(p.ftl, p.fbl, p.ftr, "#8B4513"),
            new Triangle(p.fbl, p.fbr, p.ftr, "#8B4513"),
            // Back face
            new Triangle(p.btr, p.bbl, p.btl, "#8B4513"),
            new Triangle(p.btr, p.bbr, p.bbl, "#8B4513"),
            // Right face
            new Triangle(p.ftr, p.fbr, p.btr, "#8B4513"),
            new Triangle(p.fbr, p.bbr, p.btr, "#8B4513"),
            // Left face
            new Triangle(p.btl, p.bbl, p.ftl, "#8B4513"),
            new Triangle(p.ftl, p.bbl, p.fbl, "#8B4513")
        ];

        const flagTriangles = [
            // Front face
            new Triangle(f.ftl, f.fbl, f.ftr, "#4169E1"),
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
        ];*/

/*
        // Combine all triangles for visual representation
        const allTriangles = [...poleTriangles, ...flagTriangles];
        super(physicsWorld, allTriangles);

        // Create separate physics shapes for pole and flag
        const poleShape = new Goblin.BoxShape(poleWidth, poleHeight, poleDepth);
        const flagShape = new Goblin.BoxShape(flagWidth, flagHeight, flagThickness);

        // Create pole rigid body (static)
        this.poleBody = new Goblin.RigidBody(poleShape, 0);
        this.poleBody.position.set(position.x, position.y + poleHeight/2, position.z);
        this.poleBody.restitution = 0.3;
        this.poleBody.friction = 0.5;

        // Create flag rigid body (dynamic)
        this.flagBody = new Goblin.RigidBody(flagShape, 0.5); // Lighter mass for better spinning
        this.flagBody.position.set(
            position.x + poleWidth/2 + flagWidth/2,
            position.y + poleHeight - flagHeight/2,
            position.z
        );
        this.flagBody.restitution = 0.3;
        this.flagBody.friction = 0.5;

        // Create hinge constraint
        const hingeAxis = new Goblin.Vector3(0, 1, 0);
        const hingePoint = new Goblin.Vector3(poleWidth/2, poleHeight/2, 0);
        
        this.hingeConstraint = new Goblin.HingeConstraint(
            this.poleBody,
            hingeAxis,
            hingePoint,
            this.flagBody,
            new Goblin.Vector3(-flagWidth/2, 0, 0)
        );

        // Add some damping to make movement more realistic
        this.hingeConstraint.erp = 0.1;

        // Add bodies and constraint to physics world
        this.physicsWorld.addConstraint(this.hingeConstraint);
        this.physicsWorld.addObject(this.poleBody);
        this.physicsWorld.addObject(this.flagBody);

        // Contact handling
        this.flagBody.addListener('contact', (other_body, contact) => {
            // Apply rotational impulse to make flag spin
            this.flagBody.angularVelocity.y += 3.0;
            console.log("FishingSpot Flag Hit!");
            this.spinFlag();
        });

        this.poleBody.addListener('contact', (other_body, contact) => {
            console.log("FishingSpot Pole Hit!");
            this.spinFlag();
        });

        this.updateVisual();
    }

    // Optional: Method to apply force to make flag spin
    spinFlag(force = 3.0) {
        this.flagBody.angularVelocity.y += force;
    }
}*/

class FishingSpotComponent extends ActionPhysicsObject3D {
    constructor(physicsWorld, triangles, shape, mass) {
        super(physicsWorld, triangles);
        this.body = new Goblin.RigidBody(shape, mass);
    }
}

class FishingSpotManager {
    constructor(physicsWorld, position) {
        this.physicsWorld = physicsWorld;

        // Create geometries
        const { poleTriangles, flagTriangles, poleShape, flagShape } = this.createGeometries();

        // Create pole component (static)
        this.pole = new FishingSpotComponent(
            physicsWorld,
            poleTriangles,
            poleShape,
            0 // Static mass
        );
        this.pole.body.position.set(position.x, position.y + this.poleHeight / 2, position.z);

        // Create flag component (dynamic)
        this.flag = new FishingSpotComponent(
            physicsWorld,
            flagTriangles,
            flagShape,
            0.5 // Dynamic mass
        );
        this.flag.body.position.set(
            position.x + this.poleWidth / 2 + this.flagWidth / 2,
            position.y + this.poleHeight - this.flagHeight / 2,
            position.z
        );

        // Create and add hinge constraint
        this.hingeConstraint = new Goblin.HingeConstraint(
            this.pole.body,
            new Goblin.Vector3(0, 1, 0), // hingeAxis
            new Goblin.Vector3(this.poleWidth / 2, this.poleHeight / 2, 0), // hingePoint
            this.flag.body,
            new Goblin.Vector3(-this.flagWidth / 2, 0, 0) // connectionPoint
        );

        this.physicsWorld.addConstraint(this.hingeConstraint);
        this.physicsWorld.addObject(this.pole);
        this.physicsWorld.addObject(this.flag);
        // Set up contact listeners
        this.setupContactListeners();
    }

    createGeometries() {
        // Define dimensions
        this.poleWidth = 0.3;
        this.poleHeight = 4;
        this.poleDepth = 0.3;
        this.flagWidth = 2;
        this.flagHeight = 1;
        this.flagThickness = 0.1;

        const hw = this.poleWidth / 2;
        const hh = this.poleHeight / 2;
        const hd = this.poleDepth / 2;

        // Define pole vertices
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

        // Define flag vertices
        const f = {
            ftl: new Vector3(0, hh, hd),
            ftr: new Vector3(this.flagWidth, hh, hd),
            fbl: new Vector3(0, hh - this.flagHeight, hd),
            fbr: new Vector3(this.flagWidth, hh - this.flagHeight, hd),
            btl: new Vector3(0, hh, hd - this.flagThickness),
            btr: new Vector3(this.flagWidth, hh, hd - this.flagThickness),
            bbl: new Vector3(0, hh - this.flagHeight, hd - this.flagThickness),
            bbr: new Vector3(this.flagWidth, hh - this.flagHeight, hd - this.flagThickness)
        };

        // Create pole triangles
        const poleTriangles = [
            // Front face
            new Triangle(p.ftl, p.fbl, p.ftr, "#8B4513"),
            new Triangle(p.fbl, p.fbr, p.ftr, "#8B4513"),
            // Back face
            new Triangle(p.btr, p.bbl, p.btl, "#8B4513"),
            new Triangle(p.btr, p.bbr, p.bbl, "#8B4513"),
            // Right face
            new Triangle(p.ftr, p.fbr, p.btr, "#8B4513"),
            new Triangle(p.fbr, p.bbr, p.btr, "#8B4513"),
            // Left face
            new Triangle(p.btl, p.bbl, p.ftl, "#8B4513"),
            new Triangle(p.ftl, p.bbl, p.fbl, "#8B4513")
        ];

        // Create flag triangles
        const flagTriangles = [
            // Front face
            new Triangle(f.ftl, f.fbl, f.ftr, "#4169E1"),
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

        // Create physics shapes
        const poleShape = new Goblin.BoxShape(this.poleWidth, this.poleHeight, this.poleDepth);
        const flagShape = new Goblin.BoxShape(this.flagWidth, this.flagHeight, this.flagThickness);

        return {
            poleTriangles,
            flagTriangles,
            poleShape,
            flagShape
        };
    }

    setupContactListeners() {
        this.flag.body.addListener("contact", (other_body, contact) => {
            console.log("Flag Hit!");
        });

        this.pole.body.addListener("contact", (other_body, contact) => {
            console.log("Pole Hit!");
        });
    }

    remove() {
        // Clean up method
        this.physicsWorld.removeConstraint(this.hingeConstraint);
        this.physicsWorld.removeObject(this.pole.body);
        this.physicsWorld.removeObject(this.flag.body);
    }

    spinFlag(force = 3.0) {
        this.flag.body.angularVelocity.y += force;
    }
}