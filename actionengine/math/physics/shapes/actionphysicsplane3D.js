class ActionPhysicsPlane3D extends ActionPhysicsObject3D {
    constructor(
    physicsWorld, 
    orientation = 1, 
    width = 100, 
    length = 100, 
    mass = 0, 
    initialPosition = new Vector3(0, 0, 0),
    normalDirection = 1,  // 1 = up/positive, -1 = down/negative
    doubleSided = true    // Whether to create back-facing triangles
) {
    // Create visual mesh with triangles
    const segments = 10; // Can be adjusted based on needed detail
    const triangles = [];
    const getColor = (x, z) => ((Math.floor(x) + Math.floor(z)) % 2 === 0) ? "#FFFFFF" : "#CCCCCC";
    const getBackColor = (x, z) => ((Math.floor(x) + Math.floor(z)) % 2 === 0) ? "#DDDDDD" : "#999999";
    
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
            
            // Front-facing triangles (based on normalDirection)
            if (normalDirection > 0) {
                triangles.push(new Triangle(v1, v3, v2, getColor(x, z))); 
                triangles.push(new Triangle(v1, v4, v3, getColor(x, z)));
            } else {
                triangles.push(new Triangle(v1, v2, v3, getColor(x, z)));
                triangles.push(new Triangle(v1, v3, v4, getColor(x, z)));
            }
            
            // Back-facing triangles (if doubleSided is true)
            if (doubleSided) {
                if (normalDirection > 0) {
                    triangles.push(new Triangle(v1, v2, v3, getBackColor(x, z)));
                    triangles.push(new Triangle(v1, v3, v4, getBackColor(x, z)));
                } else {
                    triangles.push(new Triangle(v1, v3, v2, getBackColor(x, z)));
                    triangles.push(new Triangle(v1, v4, v3, getBackColor(x, z)));
                }
            }
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