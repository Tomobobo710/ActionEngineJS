class ActionPhysicsCompoundShape3D extends ActionPhysicsObject3D {
    constructor(physicsWorld, initialPosition = new Vector3(0, 500, 0), mass = 1) {
        // Start with an empty triangle list - we'll add them as child shapes are added
        super(physicsWorld, []);
        
        // Create the Goblin compound shape
        this.compoundShape = new Goblin.CompoundShape();
        this.body = new Goblin.RigidBody(this.compoundShape, mass);
        this.body.position.set(
            initialPosition.x, 
            initialPosition.y, 
            initialPosition.z
        );
        
        this.body.linear_damping = 0.01;
        this.body.angular_damping = 0.01;
        
        // Keep track of the child objects
        this.childObjects = [];
        
        // Store triangles from all children
        this.allTriangles = [];
    }
    
    // Add a child shape to the compound shape
    addChildShape(physicsObject, position, rotation = new Goblin.Quaternion()) {
        if (!physicsObject || !physicsObject.body || !physicsObject.body.shape) {
            console.error("[ActionPhysicsCompoundShape3D] Cannot add invalid physics object");
            return this;
        }
        
        // Store the shape with its position and rotation
        const childShape = physicsObject.body.shape;
        const childPosition = new Goblin.Vector3(position.x, position.y, position.z);
        
        // Add the shape to the compound shape
        this.compoundShape.addChildShape(childShape, childPosition, rotation);
        
        // Store the object and its transform information for visual updates
        this.childObjects.push({
            object: physicsObject,
            position: new Vector3(position.x, position.y, position.z),
            rotation: rotation
        });
        
        // Get the triangles from the child object and transform them
        const transformedTriangles = this.transformTriangles(
            physicsObject.triangles,
            position,
            rotation
        );
        
        // Add the transformed triangles to our collection
        this.allTriangles.push(...transformedTriangles);
        
        // Update our triangle list
        this.triangles = this.allTriangles.slice();
        
        // Update original data
        this.storeOriginalData();
        
        return this;
    }
    
    // Transform triangles from a child shape to the compound shape's space
    transformTriangles(triangles, position, rotation) {
        return triangles.map(triangle => {
            // Create new transformed vertices
            const transformedVertices = triangle.vertices.map(vertex => {
                // First create a Goblin vector for the vertex
                const goblinVec = new Goblin.Vector3(vertex.x, vertex.y, vertex.z);
                
                // Apply rotation
                rotation.transformVector3(goblinVec);
                
                // Apply translation
                goblinVec.x += position.x;
                goblinVec.y += position.y;
                goblinVec.z += position.z;
                
                // Convert back to Vector3
                return new Vector3(goblinVec.x, goblinVec.y, goblinVec.z);
            });
            
            // Create a new triangle with the transformed vertices
            return new Triangle(
                transformedVertices[0],
                transformedVertices[1],
                transformedVertices[2],
                triangle.color
            );
        });
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

// Create a compound shape at position (0, 20, 0) with mass 5
const compoundShape = new ActionPhysicsCompoundShape3D(
    physicsWorld,
    new Vector3(0, 20, 0),
    5
);

// Create a sphere (without adding it to the world)
const sphere = new ActionPhysicsSphere3D(
    physicsWorld,
    2,  // radius
    1   // mass (this won't matter for the compound)
);

// Create a box (without adding it to the world)
const box = new ActionPhysicsBox3D(
    physicsWorld,
    3, 3, 3,  // dimensions
    1         // mass (this won't matter for the compound)
);

// Add the sphere and box to the compound shape
compoundShape.addChildShape(sphere, new Vector3(0, 0, 0));
compoundShape.addChildShape(box, new Vector3(0, 5, 0));

// Add the compound shape to the physics world
physicsWorld.addObject(compoundShape);
*/