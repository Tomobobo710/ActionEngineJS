//actionengine/physics/physicsshapebuilder3D.js
/**
 * PhysicsShapeBuilder3D - Utility for creating Goblin physics shapes and bodies from mesh geometry
 * 
 * Converts vertex arrays and triangle indices into Goblin.MeshShape objects
 * with corresponding RigidBody wrappers for use in physics simulations.
 */
class PhysicsShapeBuilder3D {
    /**
     * Create a Goblin mesh shape from vertex positions and triangle indices
     * @param {Vector3[]} vertices - Array of Vector3 positions (in local space)
     * @param {number[]} indices - Array of triangle indices (triplets pointing into vertices array)
     * @param {number} mass - Mass for the RigidBody. Use 0 for static objects. Default: 0
     * @returns {Object} { shape: Goblin.MeshShape, body: Goblin.RigidBody }
     */
    static createMeshShape(vertices, indices, mass = 0) {
        if (!vertices || vertices.length === 0) {
            console.warn("[PhysicsShapeBuilder3D] No vertices provided");
            return null;
        }

        if (!indices || indices.length === 0) {
            console.warn("[PhysicsShapeBuilder3D] No indices provided");
            return null;
        }

        // Convert Vector3 array to flat array of coordinates [x, y, z, x, y, z, ...]
        const flatVertices = [];
        for (const vertex of vertices) {
            flatVertices.push(vertex.x, vertex.y, vertex.z);
        }

        // Convert flat array to Goblin.Vector3 objects
        const goblinVertices = [];
        for (let i = 0; i < flatVertices.length; i += 3) {
            goblinVertices.push(
                new Goblin.Vector3(flatVertices[i], flatVertices[i + 1], flatVertices[i + 2])
            );
        }

        // Create the Goblin mesh shape
        const shape = new Goblin.MeshShape(goblinVertices, indices);

        // Create the rigid body
        const body = new Goblin.RigidBody(shape, mass);

        // Set reasonable damping values
        body.linear_damping = 0.01;
        body.angular_damping = 0.01;

        return {
            shape: shape,
            body: body
        };
    }

    /**
     * Create a simple box shape
     * @param {number} width - Width of the box
     * @param {number} height - Height of the box
     * @param {number} depth - Depth of the box
     * @param {number} mass - Mass for the RigidBody. Use 0 for static objects. Default: 0
     * @returns {Object} { shape: Goblin.BoxShape, body: Goblin.RigidBody }
     */
    static createBoxShape(width, height, depth, mass = 0) {
        const shape = new Goblin.BoxShape(width / 2, height / 2, depth / 2);
        const body = new Goblin.RigidBody(shape, mass);

        body.linear_damping = 0.01;
        body.angular_damping = 0.01;

        return {
            shape: shape,
            body: body
        };
    }

    /**
     * Create a sphere shape
     * @param {number} radius - Radius of the sphere
     * @param {number} mass - Mass for the RigidBody. Use 0 for static objects. Default: 0
     * @returns {Object} { shape: Goblin.SphereShape, body: Goblin.RigidBody }
     */
    static createSphereShape(radius, mass = 0) {
        const shape = new Goblin.SphereShape(radius);
        const body = new Goblin.RigidBody(shape, mass);

        body.linear_damping = 0.01;
        body.angular_damping = 0.01;

        return {
            shape: shape,
            body: body
        };
    }

    /**
     * Transform vertices to world space
     * @param {Array<number>} positions - Local vertex positions (flat array of x,y,z values)
     * @param {Vector3} translation - World translation
     * @param {Quaternion} rotation - World rotation
     * @param {Vector3} scale - World scale
     * @returns {Array<Vector3>} Vertices transformed to world space
     */
    static transformVerticesToWorldSpace(positions, translation, rotation, scale) {
        const worldVertices = [];

        for (let i = 0; i < positions.length; i += 3) {
            // Local vertex
            const localVertex = new Vector3(positions[i], positions[i + 1], positions[i + 2]);

            // Apply scale
            localVertex.x *= scale.x;
            localVertex.y *= scale.y;
            localVertex.z *= scale.z;

            // Apply rotation
            const rotatedVertex = rotation.transformVector(localVertex);

            // Apply translation
            const worldVertex = new Vector3(
                rotatedVertex.x + translation.x,
                rotatedVertex.y + translation.y,
                rotatedVertex.z + translation.z
            );

            worldVertices.push(worldVertex);
        }

        return worldVertices;
    }

    /**
     * Create a compound physics shape from multiple physics shapes
     * @param {Array<Object>} physicsShapes - Array of physics shape objects
     * @param {Array<Vector3>} allDebugVertices - Accumulated debug vertices
     * @param {Array<number>} allDebugIndices - Accumulated debug indices
     * @returns {Object|null} Compound physics data with shape and body, or null if no shapes
     */
    static createCompoundPhysics(physicsShapes, allDebugVertices, allDebugIndices) {
        if (!physicsShapes || physicsShapes.length === 0) {
            return null;
        }

        try {
            const compoundShape = new Goblin.CompoundShape();
            const zeroPos = new Goblin.Vector3(0, 0, 0);
            const identityRot = new Goblin.Quaternion(0, 0, 0, 1);

            for (let i = 0; i < physicsShapes.length; i++) {
                compoundShape.addChildShape(physicsShapes[i], zeroPos, identityRot);
            }

            const compoundBody = new Goblin.RigidBody(compoundShape, 0); // mass=0 for static
            compoundBody.position.set(0, 0, 0);
            compoundBody.linear_damping = 0.01;
            compoundBody.angular_damping = 0.01;

            return {
                shape: compoundShape,
                body: compoundBody,
                debugVertices: allDebugVertices || [],
                debugIndices: allDebugIndices || [],
                centerX: 0,
                centerY: 0,
                centerZ: 0
            };
        } catch (error) {
            console.warn(`[PhysicsShapeBuilder3D] Failed to create compound physics:`, error);
            return null;
        }
    }
}
