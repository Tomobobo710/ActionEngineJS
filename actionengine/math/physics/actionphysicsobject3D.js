import { RenderableObject } from '../../display/graphics/renderableobject.js';
import { Vector3 } from '../vector3.js';

class ActionPhysicsObject3D extends RenderableObject {
     constructor(physicsWorld, triangles, options = {}) {
        super();
        if (!physicsWorld) {
            console.error("[ActionPhysicsObject3D] Physics world is required. Stack trace:", new Error().stack);
            throw new Error("[ActionPhysicsObject3D] Physics world is required - check console for stack trace");
        }
        this.physicsWorld = physicsWorld;
        
        // Store the original triangles for later toggling
        this._originalTriangles = triangles.slice();
        
        // Set visibility property
        this.isVisible = options && options.isVisible !== undefined ? options.isVisible : true;
        
        // Initialize triangles based on visibility
        this.triangles = this.isVisible ? this._originalTriangles : [];
        
        this.originalNormals = [];
        this.originalVerts = [];
        this.position = window.Vector3 ? new window.Vector3(0, 0, 0) : { x: 0, y: 0, z: 0 };
        
        // Calculate bounding sphere for frustum culling
        this.calculateBoundingSphere();
        
        // We need to store normals and verts even for invisible objects
        // so when they become visible again we can update them correctly
        // Use _originalTriangles to ensure we always have the data
        this._originalTriangles.forEach((triangle) => {
            this.originalNormals.push(window.Vector3 ?
                new window.Vector3(
                    triangle.normal.x,
                    triangle.normal.y,
                    triangle.normal.z
                ) : {
                    x: triangle.normal.x,
                    y: triangle.normal.y,
                    z: triangle.normal.z
                }
            );

            triangle.vertices.forEach((vertex) => {
                this.originalVerts.push(window.Vector3 ?
                    new window.Vector3(
                        vertex.x,
                        vertex.y,
                        vertex.z
                    ) : {
                        x: vertex.x,
                        y: vertex.y,
                        z: vertex.z
                    }
                );
            });
        });
    }

    // Add a method to toggle visibility
    setVisibility(visible) {
        if (this.isVisible === visible) return; // No change needed
        
        this.isVisible = visible;
        
        // Update triangles based on visibility - this is the key part
        // When invisible, we set triangles to an empty array
        // When visible, we restore the original triangles
        this.triangles = visible ? this._originalTriangles : [];
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
        if (window.Vector3 && this.position.set) {
            this.position.set(posX, posY, posZ);
        } else {
            this.position.x = posX;
            this.position.y = posY;
            this.position.z = posZ;
        }

        // Cache current position and rotation for next comparison
        if (!this._lastPosition) {
            this._lastPosition = window.Vector3 ? new window.Vector3() : { x: 0, y: 0, z: 0 };
        }
        if (window.Vector3 && this._lastPosition.set) {
            this._lastPosition.set(posX, posY, posZ);
        } else {
            this._lastPosition.x = posX;
            this._lastPosition.y = posY;
            this._lastPosition.z = posZ;
        }
        
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
        return window.Vector3 ?
            new window.Vector3(v.x, v.y, v.z) :
            { x: v.x, y: v.y, z: v.z };
    }
    
    // Calculate the bounding sphere radius for frustum culling
    calculateBoundingSphere() {
        if (!this.triangles || this.triangles.length === 0) {
            // Default radius if no triangles
            this.boundingSphereRadius = 20;
            return;
        }
        
        // Find the maximum distance from center to any vertex
        let maxDistanceSquared = 0;
        
        for (const triangle of this.triangles) {
            for (const vertex of triangle.vertices) {
                // Simple distance from origin - assuming most objects are centered
                const distSquared = vertex.x * vertex.x + vertex.y * vertex.y + vertex.z * vertex.z;
                if (distSquared > maxDistanceSquared) {
                    maxDistanceSquared = distSquared;
                }
            }
        }
        
        // Set radius with a small buffer for safety
        this.boundingSphereRadius = Math.sqrt(maxDistanceSquared) * 1.1;
    }
}

// Make ActionPhysicsObject3D available globally for backward compatibility
if (typeof window !== 'undefined') {
    window.ActionPhysicsObject3D = ActionPhysicsObject3D;
}

export { ActionPhysicsObject3D };