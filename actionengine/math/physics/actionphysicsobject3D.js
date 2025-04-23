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
        this.position = new Vector3(0, 0, 0);
        this.triangles.forEach((triangle) => {
            this.originalNormals.push(new Vector3(triangle.normal.x, triangle.normal.y, triangle.normal.z));

            triangle.vertices.forEach((vertex) => {
                this.originalVerts.push(new Vector3(vertex.x, vertex.y, vertex.z));
            });
        });
    }

    updateVisual() {
        if (!this.body) return;

        // Cache frequently accessed properties
        const pos = this.body.position;
        const rot = this.body.rotation;
        const { x: posX, y: posY, z: posZ } = pos;
        
        // Check if object has moved since last update
        if (!this._visualDirty && this._lastPosition && this._lastRotation) {
            // Check position
            if (Math.abs(this._lastPosition.x - posX) < 0.001 &&
                Math.abs(this._lastPosition.y - posY) < 0.001 &&
                Math.abs(this._lastPosition.z - posZ) < 0.001) {
                
                // Check rotation - using dot product as a quick comparison
                // If dot product is very close to 1, rotation hasn't changed significantly
                const lastQuat = this._lastRotation;
                const curQuat = rot;
                const dot = lastQuat.x * curQuat.x + lastQuat.y * curQuat.y + 
                           lastQuat.z * curQuat.z + lastQuat.w * curQuat.w;
                
                if (Math.abs(dot) > 0.9999) {
                    // Position and rotation haven't changed, skip update
                    return;
                }
            }
        }
        
        // Update position once
        this.position.set(posX, posY, posZ);
        
        // Cache current position and rotation for next comparison
        if (!this._lastPosition) this._lastPosition = new Vector3();
        this._lastPosition.set(posX, posY, posZ);
        
        if (!this._lastRotation) this._lastRotation = new Goblin.Quaternion();
        this._lastRotation.x = rot.x;
        this._lastRotation.y = rot.y;
        this._lastRotation.z = rot.z;
        this._lastRotation.w = rot.w;
        
        // Mark as clean since we're updating now
        this._visualDirty = false;

        // Preallocate reusable vector to avoid garbage collection
        const relativeVert = new Goblin.Vector3();

        // Use a for loop instead of forEach for better performance
        for (let i = 0; i < this.triangles.length; i++) {
            const triangle = this.triangles[i];

            // Update normal - can be done with direct rotation
            triangle.normal = this.rotateVector(this.originalNormals[i], rot);

            // Update vertices
            const baseIndex = i * 3;
            for (let j = 0; j < 3; j++) {
                const vertex = triangle.vertices[j];
                const origVert = this.originalVerts[baseIndex + j];

                // Reuse vector instead of creating new one
                relativeVert.set(origVert.x, origVert.y, origVert.z);

                // Rotate and translate in place
                rot.transformVector3(relativeVert);
                vertex.x = relativeVert.x + posX;
                vertex.y = relativeVert.y + posY;
                vertex.z = relativeVert.z + posZ;
            }
        }
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