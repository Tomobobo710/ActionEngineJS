// actionengine/physics/actionraycast.js

/**
 * Utility class for performing raycasts in the ActionEngine world.
 * Provides a simplified wrapper around the Goblin Physics raycasting system.
 */
class ActionRaycast {
    /**
     * Cast a ray from start to end in the physics world
     * @param {Vector3|{x,y,z}} start - Starting point of the ray
     * @param {Vector3|{x,y,z}} end - End point of the ray
     * @param {ActionPhysicsWorld3D} physicsWorld - The physics world to cast in
     * @param {Object} options - Optional settings
     * @param {string[]} options.ignoreObjects - Array of object debugNames to ignore
     * @param {number} options.minDistance - Minimum distance threshold (ignore hits closer than this)
     * @returns {Object|null} Hit result or null if no hit
     */
    static cast(start, end, physicsWorld, options = {}) {
        const ignoreList = options.ignoreObjects || [];
        const minDistance = options.minDistance || 0;
        
        // Ensure start and end are correctly formatted
        const rayStart = {
            x: start.x,
            y: start.y,
            z: start.z
        };
        
        const rayEnd = {
            x: end.x,
            y: end.y,
            z: end.z
        };
        
        // Perform the raycast using Goblin physics
        const intersections = physicsWorld.getWorld().rayIntersect(rayStart, rayEnd);
        
        if (!intersections || intersections.length === 0) {
            return null;
        }
        
        // Filter and find the first valid intersection
        for (let i = 0; i < intersections.length; i++) {
            const hit = intersections[i];
            
            // Skip if hit is too close
            if (hit.t < minDistance) {
                continue;
            }
            
            // Skip if object is in ignore list
            if (hit.object && hit.object.debugName && 
                ignoreList.some(name => 
                    hit.object.debugName === name || 
                    hit.object.debugName.includes(name)
                )
            ) {
                continue;
            }
            
            // Return formatted hit result
            return {
                object: hit.object,
                point: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
                normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z },
                distance: hit.t,
                rayDirection: this._calculateDirection(rayStart, rayEnd)
            };
        }
        
        return null;
    }
    
    /**
     * Cast multiple rays from a single origin in different directions
     * @param {Vector3|{x,y,z}} origin - Origin point for all rays
     * @param {Array<Vector3|{x,y,z}>} directions - Array of direction vectors
     * @param {number} length - Length of each ray
     * @param {ActionPhysicsWorld3D} physicsWorld - The physics world to cast in
     * @param {Object} options - Optional settings (same as cast method)
     * @returns {Array} Array of hit results (null for each ray with no hit)
     */
    static multicast(origin, directions, length, physicsWorld, options = {}) {
        return directions.map(dir => {
            const end = {
                x: origin.x + dir.x * length,
                y: origin.y + dir.y * length,
                z: origin.z + dir.z * length
            };
            return this.cast(origin, end, physicsWorld, options);
        });
    }
    
    /**
     * Calculate normalized direction vector from start to end
     * @private
     */
    static _calculateDirection(start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const dz = end.z - start.z;
        const length = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        if (length < 0.0001) {
            return { x: 0, y: 0, z: 0 };
        }
        
        return {
            x: dx / length,
            y: dy / length,
            z: dz / length
        };
    }
    
    /**
     * Calculate a point along the ray at a specific distance
     * @param {Vector3|{x,y,z}} start - Starting point of the ray
     * @param {Vector3|{x,y,z}} direction - Normalized direction vector
     * @param {number} distance - Distance along the ray
     * @returns {Vector3} Point at the specified distance
     */
    static getPointOnRay(start, direction, distance) {
        return new Vector3(
            start.x + direction.x * distance,
            start.y + direction.y * distance,
            start.z + direction.z * distance
        );
    }
}