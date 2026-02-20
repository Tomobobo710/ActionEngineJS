// actionengine/math/physics/actionphysicsobject3D.js
class ActionPhysicsObject3D extends RenderableObject {
    constructor(physicsWorld, triangles, options = {}) {
        super();
        if (options.meshId) this.meshId = options.meshId;
        if (options.isStatic !== undefined) this.isStatic = options.isStatic;
        if (!physicsWorld) {
            console.error("[ActionPhysicsObject3D] Physics world is required. Stack trace:", new Error().stack);
            throw new Error("[ActionPhysicsObject3D] Physics world is required - check console for stack trace");
        }
        this.physicsWorld = physicsWorld;

        // If we have an animator, we are likely not static
        this.isStatic = options.isStatic !== undefined ? options.isStatic : true;

        // Support for visual offset relative to physics body
        this.visualOffset = options.visualOffset || new Vector3(0, 0, 0);

        this._originalTriangles = triangles.slice();

        this.isVisible = options && options.isVisible !== undefined ? options.isVisible : true;

        this.triangles = this.isVisible ? this._originalTriangles : [];

        this.originalNormals = [];
        this.originalVerts = [];

        this.calculateBoundingSphere();

        this._originalTriangles.forEach((triangle) => {
            this.originalNormals.push(new Vector3(triangle.normal.x, triangle.normal.y, triangle.normal.z));

            triangle.vertices.forEach((vertex) => {
                this.originalVerts.push(new Vector3(vertex.x, vertex.y, vertex.z));
            });
        });
    }

    /**
     * Toggle visibility of this object
     */
    setVisibility(visible) {
        if (this.isVisible === visible) return;

        this.isVisible = visible;
        this.triangles = visible ? this._originalTriangles : [];
    }

    /**
     * Update visual state from physics body
     * Syncs transform and updates triangle data if needed
     */
    updateVisual() {
        // If body exists, sync transform from it
        if (this.body) {
            const { x: posX, y: posY, z: posZ } = this.body.position;

            // Early exit if position/rotation haven't changed significantly
            if (this._lastPosition && this._lastRotation) {
                if (
                    Math.abs(this._lastPosition.x - posX) < 0.001 &&
                    Math.abs(this._lastPosition.y - posY) < 0.001 &&
                    Math.abs(this._lastPosition.z - posZ) < 0.001
                ) {
                    const lastQuat = this._lastRotation;
                    const curQuat = this.body.rotation;
                    const dot =
                        lastQuat.x * curQuat.x +
                        lastQuat.y * curQuat.y +
                        lastQuat.z * curQuat.z +
                        lastQuat.w * curQuat.w;

                    if (Math.abs(dot) > 0.9999) {
                        return;
                    }
                }
            }

            // Sync transform from physics body
            this.transform.position.set(
                posX + this.visualOffset.x,
                posY + this.visualOffset.y,
                posZ + this.visualOffset.z
            );
            this.transform.rotation = this.body.rotation;

            if (!this._lastPosition) this._lastPosition = new Vector3();
            this._lastPosition.set(posX, posY, posZ);

            if (!this._lastRotation) this._lastRotation = new Goblin.Quaternion();
            this._lastRotation.x = this.body.rotation.x;
            this._lastRotation.y = this.body.rotation.y;
            this._lastRotation.z = this.body.rotation.z;
            this._lastRotation.w = this.body.rotation.w;

            // Keep local-space triangles for 3D GPU renderer
            // Respect visibility flag - invisible objects should stay invisible
            this.triangles = this.isVisible ? this._originalTriangles : [];
        }

        // Support for animations
        if (this.animator && this.isVisible) {
            // Force non-static mode if we have an animator
            this.isStatic = false;

            // Update animation (using a rough deltaTime if not provided)
            this.animator.update();

            // Recalculate triangles from skinned model if possible
            // Most POIs/Characters that use GLBLoader will have this.characterModel
            if (this.characterModel && this.characterModel.triangles) {
                // If this is a character, we should probably call getCharacterModelTriangles
                if (this.getCharacterModelTriangles) {
                    this.triangles = this.getCharacterModelTriangles();
                } else {
                    // Simple baked update for static buildings with animations
                    this.triangles = this.characterModel.triangles;
                }
            }
        }
    }

    /**
     * Rotate a vector by a quaternion
     */
    rotateVector(vector, rotation) {
        const v = new Goblin.Vector3(vector.x, vector.y, vector.z);
        rotation.transformVector3(v);
        return new Vector3(v.x, v.y, v.z);
    }

    /**
     * Calculate bounding sphere for frustum culling
     */
    calculateBoundingSphere() {
        if (!this.triangles || this.triangles.length === 0) {
            this.boundingSphereRadius = 20;
            return;
        }

        let maxDistanceSquared = 0;

        for (const triangle of this.triangles) {
            for (const vertex of triangle.vertices) {
                const distSquared = vertex.x * vertex.x + vertex.y * vertex.y + vertex.z * vertex.z;
                if (distSquared > maxDistanceSquared) {
                    maxDistanceSquared = distSquared;
                }
            }
        }

        this.boundingSphereRadius = Math.sqrt(maxDistanceSquared) * 1.1;
    }
}
