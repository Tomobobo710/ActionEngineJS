//actionengine/physics/shapes/actionphysicscompoundshape3D.js
class ActionPhysicsCompoundShape3D extends ActionPhysicsObject3D {
    constructor(initialPosition = new Vector3(0, 5, 0), mass = 1, options = {}) {
        // Start with an empty triangle list - we'll add them as child shapes are added
        super([], options);

        // Create the Goblin compound shape
        this.compoundShape = new PhysicsBackend.CompoundShape();
        this.body = new ActionRigidBody3D(this.compoundShape, mass, options);
        this.body.position = initialPosition;

        // Keep track of the child objects
        this.childObjects = [];

        // Store triangles from all children
        this.allTriangles = [];
    }

    // Add a child shape to the compound shape
    addChildShape(physicsObject, position, rotation = new PhysicsBackend.Quaternion()) {
        if (!physicsObject || !physicsObject.body || !physicsObject.body.shape) {
            console.error("[ActionPhysicsCompoundShape3D] Cannot add invalid physics object");
            return this;
        }

        // Store the shape with its position and rotation
        const childShape = physicsObject.body.shape;
        const childPosition = new PhysicsBackend.Vector3(position.x, position.y, position.z);

        // Add the shape to the compound shape
        this.compoundShape.addChildShape(childShape, childPosition, rotation);

        // Store the object and its transform information for visual updates
        this.childObjects.push({
            object: physicsObject,
            position: new Vector3(position.x, position.y, position.z),
            rotation: rotation
        });

        // Get the triangles from the child object and transform them
        const transformedTriangles = this.transformTriangles(physicsObject.triangles, position, rotation);

        // Add the transformed triangles to our collection
        this.allTriangles.push(...transformedTriangles);

        // Update our triangle list. Also refresh _originalTriangles (the base class's per-frame
        // updateVisual() unconditionally resets this.triangles = this._originalTriangles, so leaving
        // it at its construction-time [] would wipe out every child shape's triangles on the next frame.
        this._originalTriangles = this.allTriangles.slice();
        this.triangles = this.isVisible ? this._originalTriangles : [];

        // Update original data
        this.storeOriginalData();

        // Recompute the body's inertia now that a child exists. The Goblin RigidBody was constructed
        // around an EMPTY CompoundShape (see constructor), so its inertia tensor was computed with zero
        // children — CompoundShape.getInertiaTensor did mass/0 over an empty loop and returned an all-zero
        // tensor, i.e. infinite rotational inertia. That silently locks the compound at its spawn
        // orientation (zero angular acceleration from any torque). Goblin's own examples avoid this by
        // building the shape FIRST and the body last; this wrapper builds body-first, so we must refresh
        // the tensor here after each child is added. Static (mass 0/Infinity) bodies don't rotate anyway.
        const body = this.body.goblinBody;
        const mass = this.body.mass;
        if (body && mass !== 0 && Number.isFinite(mass)) {
            body.inertiaTensor = this.compoundShape.getInertiaTensor(mass);
            body.inertiaTensor.invertInto(body.inverseInertiaTensor);
            if (body.updateDerived) body.updateDerived();
        }

        return this;
    }

    // Transform triangles from a child shape to the compound shape's space
    transformTriangles(triangles, position, rotation) {
        return triangles.map((triangle) => {
            // Create new transformed vertices
            const transformedVertices = triangle.vertices.map((vertex) => {
                // First create a Goblin vector for the vertex
                const goblinVec = new PhysicsBackend.Vector3(vertex.x, vertex.y, vertex.z);

                // Apply rotation
                PhysicsBackend.rotateVectorInPlace(rotation, goblinVec);

                // Apply translation
                goblinVec.x += position.x;
                goblinVec.y += position.y;
                goblinVec.z += position.z;

                // Convert back to Vector3
                return new Vector3(goblinVec.x, goblinVec.y, goblinVec.z);
            });

            // Create a new triangle with the transformed vertices
            return new Triangle(transformedVertices[0], transformedVertices[1], transformedVertices[2], triangle.color);
        });
    }

    storeOriginalData() {
        this.originalNormals = [];
        this.originalVerts = [];

        this.triangles.forEach((triangle) => {
            this.originalNormals.push(new Vector3(triangle.normal.x, triangle.normal.y, triangle.normal.z));

            triangle.vertices.forEach((vertex) => {
                this.originalVerts.push(new Vector3(vertex.x, vertex.y, vertex.z));
            });
        });
    }
}

/* Usage example:
const physicsWorld = new ActionPhysicsWorld3D();

// Create a compound shape at position (0, 20, 0) with mass 5
const compoundShape = new ActionPhysicsCompoundShape3D(
    new Vector3(0, 20, 0),
    5
);

// Create a sphere (without adding it to the world)
const sphere = new ActionPhysicsSphere3D(
    2,  // radius
    1   // mass (this won't matter for the compound)
);

// Create a box (without adding it to the world)
const box = new ActionPhysicsBox3D(
    3, 3, 3,  // dimensions
    1         // mass (this won't matter for the compound)
);

// Add the sphere and box to the compound shape
compoundShape.addChildShape(sphere, new Vector3(0, 0, 0));
compoundShape.addChildShape(box, new Vector3(0, 5, 0));

// Add the compound shape to the physics world
physicsWorld.addObject(compoundShape);
*/
