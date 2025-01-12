class ActionPhysicsBox3D extends ActionPhysicsObject3D {
    constructor(physicsWorld, width = 10, height = 10, depth = 10, mass = 1, initialPosition = new Vector3(0, 500, 0)) {
        // Create visual mesh with triangles
        const triangles = [];
        
        // Helper to create face vertices
        const createFace = (v1, v2, v3, v4, color) => {
            triangles.push(new Triangle(v1, v2, v3, color));
            triangles.push(new Triangle(v1, v3, v4, color));
        };

        // Half dimensions for vertex creation
        const hw = width / 2;
        const hh = height / 2;
        const hd = depth / 2;

        // Create vertices for each face
        const vertices = {
            frontTopLeft:     new Vector3(-hw,  hh,  hd),
            frontTopRight:    new Vector3( hw,  hh,  hd),
            frontBottomRight: new Vector3( hw, -hh,  hd),
            frontBottomLeft:  new Vector3(-hw, -hh,  hd),
            backTopLeft:      new Vector3(-hw,  hh, -hd),
            backTopRight:     new Vector3( hw,  hh, -hd),
            backBottomRight:  new Vector3( hw, -hh, -hd),
            backBottomLeft:   new Vector3(-hw, -hh, -hd)
        };

        // Create the six faces with alternating colors
        // Front face
        createFace(
            vertices.frontBottomLeft,
            vertices.frontBottomRight,
            vertices.frontTopRight,
            vertices.frontTopLeft,
            "#FF0000"
        );

        // Back face
        createFace(
            vertices.backBottomRight,
            vertices.backBottomLeft,
            vertices.backTopLeft,
            vertices.backTopRight,
            "#00FF00"
        );

        // Top face
        createFace(
            vertices.frontTopLeft,
            vertices.frontTopRight,
            vertices.backTopRight,
            vertices.backTopLeft,
            "#0000FF"
        );

        // Bottom face
        createFace(
            vertices.frontBottomRight,
            vertices.frontBottomLeft,
            vertices.backBottomLeft,
            vertices.backBottomRight,
            "#FFFF00"
        );

        // Right face
        createFace(
            vertices.frontBottomRight,
            vertices.backBottomRight,
            vertices.backTopRight,
            vertices.frontTopRight,
            "#FF00FF"
        );

        // Left face
        createFace(
            vertices.backBottomLeft,
            vertices.frontBottomLeft,
            vertices.frontTopLeft,
            vertices.backTopLeft,
            "#00FFFF"
        );

        super(physicsWorld, triangles);

        // Create physics shape and body
        const shape = new Goblin.BoxShape(width/2, height/2, depth/2);
        this.body = new Goblin.RigidBody(shape, mass);
        this.body.position.set(
            initialPosition.x,
            initialPosition.y,
            initialPosition.z
        );

        this.body.linear_damping = 0.01;
        this.body.angular_damping = 0.01;

        this.storeOriginalData();
        //this.physicsWorld.addObject(this);
        //this.updateVisual();
    }

    storeOriginalData() {
        this.originalNormals = [];
        this.originalVerts = [];
        
        this.triangles.forEach((triangle) => {
            this.originalNormals.push(new Vector3(
                triangle.normal.x,
                triangle.normal.y,
                triangle.normal.z
            ));
            
            triangle.vertices.forEach((vertex) => {
                this.originalVerts.push(new Vector3(
                    vertex.x,
                    vertex.y,
                    vertex.z
                ));
            });
        });
    }
}

/* Usage example:
const physicsWorld = new ActionPhysicsWorld3D();

// Create a simple box
const box = new ActionPhysicsBox3D(
    physicsWorld,    // physics world
    10,              // width
    10,              // height
    10,              // depth
    1,               // mass
    new Vector3(0, 500, 0)  // initial position
);

// Create a heavy elongated box
const pillar = new ActionPhysicsBox3D(
    physicsWorld,
    5,               // width
    20,              // height
    5,               // depth
    10,              // mass
    new Vector3(0, 10, 0)
);
*/