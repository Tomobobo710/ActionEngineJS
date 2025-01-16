class ActionPhysicsObject3D extends RenderableObject {
    constructor(physicsWorld, triangles) {
        super();
        if (!physicsWorld) {
            throw new Error("[ActionPhysicsObject3D] Physics world is required");
        }
        this.physicsWorld = physicsWorld;
        this.triangles = triangles;
        this.originalNormals = [];
        this.originalVerts = [];

        this.triangles.forEach((triangle) => {
            this.originalNormals.push(new Vector3(triangle.normal.x, triangle.normal.y, triangle.normal.z));

            triangle.vertices.forEach((vertex) => {
                this.originalVerts.push(new Vector3(vertex.x, vertex.y, vertex.z));
            });
        });
    }

    updateVisual() {
        if (!this.body) return;

        const pos = this.body.position;
        const rot = this.body.rotation;

        this.position = new Vector3(pos.x, pos.y, pos.z);

        this.triangles.forEach((triangle, triIndex) => {
            // Update normal
            const origNormal = this.originalNormals[triIndex];
            const rotatedNormal = this.rotateVector(origNormal, rot);
            triangle.normal = rotatedNormal;

            // Update vertices
            triangle.vertices.forEach((vertex, vertIndex) => {
                const origVert = this.originalVerts[triIndex * 3 + vertIndex];
                // Create a new vector relative to origin
                const relativeVert = new Goblin.Vector3(origVert.x, origVert.y, origVert.z);

                // Rotate relative to origin
                rot.transformVector3(relativeVert);

                // Add position
                vertex.x = relativeVert.x + this.position.x;
                vertex.y = relativeVert.y + this.position.y;
                vertex.z = relativeVert.z + this.position.z;
            });
        });
        this.physicsWorld.shaderManager?.updateRenderableBuffers(this);
    }

    rotateVector(vector, rotation) {
        // Create Goblin vector
        const v = new Goblin.Vector3(vector.x, vector.y, vector.z);
        // Apply rotation
        rotation.transformVector3(v);
        // Return as our Vector3
        return new Vector3(v.x, v.y, v.z);
    }
}