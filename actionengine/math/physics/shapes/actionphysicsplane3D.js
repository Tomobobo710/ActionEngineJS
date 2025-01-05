class ActionPhysicsPlane3D extends ActionPhysicsObject3D {
    constructor(physicsWorld, orientation = 1, width = 100, length = 100, mass = 0, initialPosition = new Vector3(0, 0, 0)) {
        // Create visual mesh with triangles
        const segments = 10; // Can be adjusted based on needed detail
        const triangles = [];
        const getColor = (x, z) => ((Math.floor(x) + Math.floor(z)) % 2 === 0) ? "#FFFFFF" : "#CCCCCC";
        
        // Generate grid of vertices
        for (let x = 0; x < segments; x++) {
            for (let z = 0; z < segments; z++) {
                const x1 = (x / segments - 0.5) * width;
                const x2 = ((x + 1) / segments - 0.5) * width;
                const z1 = (z / segments - 0.5) * length;
                const z2 = ((z + 1) / segments - 0.5) * length;
                
                // Create vertices based on orientation
                let v1, v2, v3, v4;
                if (orientation === 0) { // YZ plane
                    v1 = new Vector3(0, x1, z1);
                    v2 = new Vector3(0, x2, z1);
                    v3 = new Vector3(0, x2, z2);
                    v4 = new Vector3(0, x1, z2);
                } else if (orientation === 1) { // XZ plane (ground plane)
                    v1 = new Vector3(x1, 0, z1);
                    v2 = new Vector3(x2, 0, z1);
                    v3 = new Vector3(x2, 0, z2);
                    v4 = new Vector3(x1, 0, z2);
                } else { // XY plane
                    v1 = new Vector3(x1, z1, 0);
                    v2 = new Vector3(x2, z1, 0);
                    v3 = new Vector3(x2, z2, 0);
                    v4 = new Vector3(x1, z2, 0);
                }
                
                triangles.push(new Triangle(v1, v2, v3, getColor(x, z)));
                triangles.push(new Triangle(v1, v3, v4, getColor(x, z)));
            }
        }
        
        super(physicsWorld, triangles);
        
        const shape = new Goblin.PlaneShape(orientation, width/2, length/2);
        this.body = new Goblin.RigidBody(shape, mass);
        this.body.position.set(
            initialPosition.x,
            initialPosition.y,
            initialPosition.z
        );
        
        this.storeOriginalData();
        this.physicsWorld.addObject(this);
        this.updateVisual();
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

// Create a ground plane (100x100 units)
const ground = new ActionPhysicsPlane3D(
    physicsWorld,    // physics world
    1,               // orientation (1 = XZ plane / ground plane)
    100,             // width
    100,             // length
    0,               // mass (0 = static)
    new Vector3(0, 0, 0)  // position
);

// Create a vertical wall (100x50 units)
const wall = new ActionPhysicsPlane3D(
    physicsWorld,
    0,               // YZ plane
    50,              // height
    100,             // length
    0,
    new Vector3(-50, 25, 0)
);
*/