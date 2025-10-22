// Vector3 and Matrix4 are loaded globally via script tags

/**
 * PhysicsEngine - Handles collision detection, raycasting, and physics calculations
 * Encapsulates all physics-related functionality for clean separation of concerns
 */
class PhysicsEngine {
    constructor(game) {
        this.game = game;
        this.blockSize = 5; // Default block size, can be updated from game
    }

    /**
     * Update block size from game settings
     * @param {number} size - New block size
     */
    setBlockSize(size) {
        this.blockSize = size;
    }

    /**
     * Perform raycast from camera to find block placement/selection targets
     * @returns {Object|null} Raycast result with position, face, and block info
     */
    raycastBlocks() {
        if (!this.game.cursorLocked) {
            this.game.persistentHighlightPosition = null;
            this.game.hoveredFace = null;
            this.game.hoveredBlock = null;
            return null;
        }

        const ray = this.getRayFromCamera();
        let closestDistance = Infinity;
        let closestHit = null;
        let closestFace = null;
        let closestBlock = null;

        // 1. Raycast against room geometry
        const roomHitResult = this.castRayIntoRoom(ray);
        if (roomHitResult) {
            closestDistance = roomHitResult.distance;
            closestHit = roomHitResult.position;
            closestFace = roomHitResult.face;
        }

        // 2. Raycast against placed blocks
        for (let [id, block] of this.game.blocks) {
            const blockHitResult = this.rayBoxIntersection(ray, block);
            if (blockHitResult && blockHitResult.distance < closestDistance) {
                closestDistance = blockHitResult.distance;
                closestHit = blockHitResult.hitPoint;
                closestFace = blockHitResult.face;
                closestBlock = block;
            }
        }

        if (closestHit) {
            this.game.persistentHighlightPosition = closestHit;
            this.game.hoveredFace = closestFace;
            this.game.hoveredBlock = closestBlock;
            return {
                position: closestHit,
                face: closestFace,
                block: closestBlock,
                distance: closestDistance
            };
        } else {
            this.game.persistentHighlightPosition = null;
            this.game.hoveredFace = null;
            this.game.hoveredBlock = null;
            return null;
        }
    }

    /**
     * Get ray from camera position and rotation
     * @returns {Object} Ray object with origin and direction
     */
    getRayFromCamera() {
        const lookDistance = 50;

        // Calculate forward direction based on camera rotation
        const forward = window.Vector3 ?
            new window.Vector3(
                Math.sin(this.game.player.rotation.y) * Math.cos(this.game.player.rotation.x) * lookDistance,
                -Math.sin(this.game.player.rotation.x) * lookDistance,
                -Math.cos(this.game.player.rotation.y) * Math.cos(this.game.player.rotation.x) * lookDistance
            ) : {
                x: Math.sin(this.game.player.rotation.y) * Math.cos(this.game.player.rotation.x) * lookDistance,
                y: -Math.sin(this.game.player.rotation.x) * lookDistance,
                z: -Math.cos(this.game.player.rotation.y) * Math.cos(this.game.player.rotation.x) * lookDistance
            };

        const normalized = forward.normalize();

        return {
            origin: this.game.player.position.clone(),
            direction: normalized
        };
    }

    /**
     * Ray vs box intersection test
     * @param {Object} ray - Ray object with origin and direction
     * @param {Object} block - Block object with position
     * @returns {Object|null} Intersection result or null if no hit
     */
    rayBoxIntersection(ray, block) {
        const size = this.blockSize;

        const min = window.Vector3 ?
            new window.Vector3(
                block.position.x - size / 2,
                block.position.y - size / 2,
                block.position.z - size / 2
            ) : {
                x: block.position.x - size / 2,
                y: block.position.y - size / 2,
                z: block.position.z - size / 2
            };

        const max = window.Vector3 ?
            new window.Vector3(
                block.position.x + size / 2,
                block.position.y + size / 2,
                block.position.z + size / 2
            ) : {
                x: block.position.x + size / 2,
                y: block.position.y + size / 2,
                z: block.position.z + size / 2
            };

        let tmin = (min.x - ray.origin.x) / ray.direction.x;
        let tmax = (max.x - ray.origin.x) / ray.direction.x;

        if (tmin > tmax) [tmin, tmax] = [tmax, tmin];

        let tymin = (min.y - ray.origin.y) / ray.direction.y;
        let tymax = (max.y - ray.origin.y) / ray.direction.y;

        if (tymin > tymax) [tymin, tymax] = [tymax, tymin];

        if ((tmin > tymax) || (tymin > tmax)) return null;

        if (tymin > tmin) tmin = tymin;
        if (tymax < tmax) tmax = tymax;

        let tzmin = (min.z - ray.origin.z) / ray.direction.z;
        let tzmax = (max.z - ray.origin.z) / ray.direction.z;

        if (tzmin > tzmax) [tzmin, tzmax] = [tzmax, tzmin];

        if ((tmin > tzmax) || (tzmin > tmax)) return null;

        if (tzmin > tmin) tmin = tzmin;
        if (tzmax < tmax) tmax = tzmax;

        if (tmin < 0) return null;

        // Calculate the exact hit point
        const hitPoint = window.Vector3 ?
            new window.Vector3(
                ray.origin.x + ray.direction.x * tmin,
                ray.origin.y + ray.direction.y * tmin,
                ray.origin.z + ray.direction.z * tmin
            ) : {
                x: ray.origin.x + ray.direction.x * tmin,
                y: ray.origin.y + ray.direction.y * tmin,
                z: ray.origin.z + ray.direction.z * tmin
            };

        // Determine which face was hit
        const epsilon = 0.01;
        let face = "top";

        if (Math.abs(hitPoint.x - min.x) < epsilon) face = "west";
        else if (Math.abs(hitPoint.x - max.x) < epsilon) face = "east";
        else if (Math.abs(hitPoint.y - min.y) < epsilon) face = "bottom";
        else if (Math.abs(hitPoint.y - max.y) < epsilon) face = "top";
        else if (Math.abs(hitPoint.z - min.z) < epsilon) face = "north";
        else if (Math.abs(hitPoint.z - max.z) < epsilon) face = "south";

        return { distance: tmin, face, hitPoint };
    }

    /**
     * Raycast against room geometry (walls, floor, ceiling)
     * @param {Object} ray - Ray object with origin and direction
     * @returns {Object|null} Hit result or null if no intersection
     */
    castRayIntoRoom(ray) {
        const roomSize = 125; // half room size
        const maxDistance = 100;
        let closestDistance = Infinity;
        let closestHit = null;
        let closestFace = "";

        // Test floor (Y = 0)
        const floorHit = this.rayPlaneIntersection(ray, { y: 0 }, "floor");
        if (floorHit && floorHit.distance < closestDistance && floorHit.distance <= maxDistance &&
            Math.abs(floorHit.position.x) <= roomSize + 10 && Math.abs(floorHit.position.z) <= roomSize + 10) {
            closestDistance = floorHit.distance;
            closestHit = floorHit;
            closestFace = "floor";
        }

        // Test ceiling (Y = 125)
        const ceilingHit = this.rayPlaneIntersection(ray, { y: 125 }, "ceiling");
        if (ceilingHit && ceilingHit.distance < closestDistance && ceilingHit.distance <= maxDistance &&
            Math.abs(ceilingHit.position.x) <= roomSize + 10 && Math.abs(ceilingHit.position.z) <= roomSize + 10) {
            closestDistance = ceilingHit.distance;
            closestHit = ceilingHit;
            closestFace = "ceiling";
        }

        // Test north wall (Z = -125)
        const northHit = this.rayPlaneIntersection(ray, { z: -roomSize }, "north");
        if (northHit && northHit.distance < closestDistance && northHit.distance <= maxDistance &&
            Math.abs(northHit.position.x) <= roomSize + 10 && northHit.position.y >= -5 && northHit.position.y <= 130) {
            closestDistance = northHit.distance;
            closestHit = northHit;
            closestFace = "north";
        }

        // Test south wall (Z = 125)
        const southHit = this.rayPlaneIntersection(ray, { z: roomSize }, "south");
        if (southHit && southHit.distance < closestDistance && southHit.distance <= maxDistance &&
            Math.abs(southHit.position.x) <= roomSize + 10 && southHit.position.y >= -5 && southHit.position.y <= 130) {
            closestDistance = southHit.distance;
            closestHit = southHit;
            closestFace = "south";
        }

        // Test east wall (X = 125)
        const eastHit = this.rayPlaneIntersection(ray, { x: roomSize }, "east");
        if (eastHit && eastHit.distance < closestDistance && eastHit.distance <= maxDistance &&
            Math.abs(eastHit.position.z) <= roomSize + 10 && eastHit.position.y >= -5 && eastHit.position.y <= 130) {
            closestDistance = eastHit.distance;
            closestHit = eastHit;
            closestFace = "east";
        }

        // Test west wall (X = -125)
        const westHit = this.rayPlaneIntersection(ray, { x: -roomSize }, "west");
        if (westHit && westHit.distance < closestDistance && westHit.distance <= maxDistance &&
            Math.abs(westHit.position.z) <= roomSize + 10 && westHit.position.y >= -5 && westHit.position.y <= 130) {
            closestDistance = westHit.distance;
            closestHit = westHit;
            closestFace = "west";
        }

        return closestHit ? { position: closestHit.position, face: closestFace, distance: closestHit.distance } : null;
    }

    /**
     * Ray vs plane intersection test
     * @param {Object} ray - Ray object with origin and direction
     * @param {Object} plane - Plane definition (point on plane)
     * @param {string} faceName - Name of the face for identification
     * @returns {Object|null} Intersection result or null if no hit
     */
    rayPlaneIntersection(ray, plane, faceName) {
        // Plane defined by a point on the plane and normal vector
        let normal, point;

        if (plane.y !== undefined) {
            // Horizontal plane (floor/ceiling)
            normal = window.Vector3 ? new window.Vector3(0, plane.y > 0 ? 1 : -1, 0) : { x: 0, y: plane.y > 0 ? 1 : -1, z: 0 };
            point = window.Vector3 ? new window.Vector3(0, plane.y, 0) : { x: 0, y: plane.y, z: 0 };
        } else if (plane.x !== undefined) {
            // Vertical plane (east/west walls)
            normal = window.Vector3 ? new window.Vector3(plane.x > 0 ? 1 : -1, 0, 0) : { x: plane.x > 0 ? 1 : -1, y: 0, z: 0 };
            point = window.Vector3 ? new window.Vector3(plane.x, 0, 0) : { x: plane.x, y: 0, z: 0 };
        } else if (plane.z !== undefined) {
            // Vertical plane (north/south walls)
            normal = window.Vector3 ? new window.Vector3(0, 0, plane.z > 0 ? 1 : -1) : { x: 0, y: 0, z: plane.z > 0 ? 1 : -1 };
            point = window.Vector3 ? new window.Vector3(0, 0, plane.z) : { x: 0, y: 0, z: plane.z };
        }

        // Ray-plane intersection formula
        const denom = ray.direction.dot(normal);

        // If ray is parallel to plane, no intersection
        if (Math.abs(denom) < 0.0001) {
            return null;
        }

        const t = point.sub(ray.origin).dot(normal) / denom;

        // If intersection is behind ray origin, ignore
        if (t < 0) {
            return null;
        }

        // Calculate hit position
        const hitPosition = window.Vector3 ?
            new window.Vector3(
                ray.origin.x + ray.direction.x * t,
                ray.origin.y + ray.direction.y * t,
                ray.origin.z + ray.direction.z * t
            ) : {
                x: ray.origin.x + ray.direction.x * t,
                y: ray.origin.y + ray.direction.y * t,
                z: ray.origin.z + ray.direction.z * t
            };

        return {
            position: hitPosition,
            distance: t,
            face: faceName
        };
    }

    /**
     * Calculate block placement position based on raycast hit
     * @param {Vector3} hitPosition - Position where ray hit
     * @param {string} face - Face that was hit
     * @param {Object} hitBlock - Block that was hit (if any)
     * @returns {Vector3} Calculated placement position
     */
    calculatePlacementPosition(hitPosition, face, hitBlock) {
        const offset = this.blockSize;
        let newPos = hitPosition.clone();

        // Determine the final position based on the hovered face and whether it's a block or the room
        if (hitBlock) {
            // Hit an existing block
            switch (face) {
                case "top": newPos.y = hitBlock.position.y + offset; break;
                case "bottom": newPos.y = hitBlock.position.y - offset; break;
                case "north": newPos.z = hitBlock.position.z - offset; break;
                case "south": newPos.z = hitBlock.position.z + offset; break;
                case "east": newPos.x = hitBlock.position.x + offset; break;
                case "west": newPos.x = hitBlock.position.x - offset; break;
            }
        } else {
            // Hit room geometry (floor, wall, ceiling)
            switch (face) {
                case "floor": newPos.y = offset / 2; break;
                case "ceiling": newPos.y = 125 - offset / 2; break;
                case "north": newPos.z = -125 - offset / 2; break; // Updated to use 125 as room size
                case "south": newPos.z = 125 + offset / 2; break;
                case "east": newPos.x = 125 + offset / 2; break;
                case "west": newPos.x = -125 - offset / 2; break;
            }
        }

        // Round to grid for X and Z, but keep Y precise
        newPos.x = Math.round(newPos.x);
        newPos.z = Math.round(newPos.z);

        return newPos;
    }

    /**
     * Check if a position is already occupied by a block
     * @param {Vector3} position - Position to check
     * @param {number} minDistance - Minimum distance to consider occupied
     * @returns {boolean} True if position is occupied
     */
    isPositionOccupied(position, minDistance = null) {
        if (minDistance === null) {
            minDistance = this.blockSize * 0.5;
        }

        for (let [id, block] of this.game.blocks) {
            if (block.position.distanceTo(position) < minDistance) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get all blocks within a certain radius of a position
     * @param {Vector3} position - Center position
     * @param {number} radius - Search radius
     * @returns {Array} Array of blocks within radius
     */
    getBlocksInRadius(position, radius) {
        const blocksInRadius = [];
        for (let [id, block] of this.game.blocks) {
            if (block.position.distanceTo(position) <= radius) {
                blocksInRadius.push(block);
            }
        }
        return blocksInRadius;
    }

    /**
     * Calculate distance between two positions
     * @param {Vector3} pos1 - First position
     * @param {Vector3} pos2 - Second position
     * @returns {number} Distance between positions
     */
    distance(pos1, pos2) {
        return pos1.distanceTo(pos2);
    }

    /**
     * Check if point is inside a bounding box
     * @param {Vector3} point - Point to test
     * @param {Vector3} boxMin - Minimum corner of box
     * @param {Vector3} boxMax - Maximum corner of box
     * @returns {boolean} True if point is inside box
     */
    pointInBox(point, boxMin, boxMax) {
        return point.x >= boxMin.x && point.x <= boxMax.x &&
               point.y >= boxMin.y && point.y <= boxMax.y &&
               point.z >= boxMin.z && point.z <= boxMax.z;
    }
}

export { PhysicsEngine };