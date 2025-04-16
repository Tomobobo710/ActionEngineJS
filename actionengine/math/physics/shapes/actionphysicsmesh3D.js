// actionengine/math/physics/actionphysicsmesh3D.js
class ActionPhysicsMesh3D extends ActionPhysicsObject3D {
    constructor(
        physicsWorld,
        vertices,  // Array of Vector3 positions
        indices,   // Array of indices forming triangles (groups of 3)
        mass = 0,  // Default to static (0 = immovable)
        initialPosition = new Vector3(0, 0, 0),
        colors = null  // Optional array of colors for each triangle
    ) {
        // Create triangles from vertices and indices
        const triangles = [];
        
        // Process indices in groups of 3 to form triangles
        for (let i = 0; i < indices.length; i += 3) {
            const v1 = vertices[indices[i]].clone();
            const v2 = vertices[indices[i+1]].clone();
            const v3 = vertices[indices[i+2]].clone();
            
            // Determine color for this triangle
            let color = "#AAAAAA";  // Default gray
            if (colors && colors[Math.floor(i/3)]) {
                color = colors[Math.floor(i/3)];
            } else if (colors && colors.length === 1) {
                color = colors[0];
            }
            
            triangles.push(new Triangle(v1, v2, v3, color));
        }
        
        super(physicsWorld, triangles);
        
        // Convert vertices to Goblin.Vector3 for the physics engine
        const goblinVertices = vertices.map(v => new Goblin.Vector3(v.x, v.y, v.z));
        
        // Create physics shape and body
        const shape = new Goblin.MeshShape(goblinVertices, indices);
        this.body = new Goblin.RigidBody(shape, mass);
        this.body.position.set(
            initialPosition.x,
            initialPosition.y,
            initialPosition.z
        );
        
        // Set damping properties if it's not static
        if (mass > 0) {
            this.body.linear_damping = 0.01;
            this.body.angular_damping = 0.01;
        }
        
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