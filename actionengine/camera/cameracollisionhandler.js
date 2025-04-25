// actionengine/camera/cameracollisionhandler.js

class CameraCollisionHandler {
    constructor(physicsWorld) {
        this.physicsWorld = physicsWorld;
    }

    /**
     * Adjust camera position to prevent clipping through objects
     * @param {Vector3} characterPosition - The position of the character
     * @param {Vector3} desiredCameraPosition - The desired camera position (without collision)
     * @param {number} cameraRadius - Radius of the camera's collision sphere
     * @returns {Vector3} The corrected camera position
     */
    adjustCameraPosition(characterPosition, desiredCameraPosition, cameraRadius = 1.0) {
        try {
            // Get eye level position (higher than feet position)
            const eyePosition = {
                x: characterPosition.x,
                y: characterPosition.y + 3.0, // Add approximate eye height
                z: characterPosition.z
            };
            
            const ray_end = {
                x: desiredCameraPosition.x,
                y: desiredCameraPosition.y,
                z: desiredCameraPosition.z
            };
            
            // Calculate ray length
            const rayLength = Math.sqrt(
                Math.pow(ray_end.x - eyePosition.x, 2) +
                Math.pow(ray_end.y - eyePosition.y, 2) +
                Math.pow(ray_end.z - eyePosition.z, 2)
            );
            
            // Don't perform collision check if camera is too close
            if (rayLength < cameraRadius * 2) {
                return desiredCameraPosition;
            }
            
            // Get all intersections from character to desired camera position
            const intersections = this.physicsWorld.getWorld().rayIntersect(eyePosition, ray_end);
            
            // If there's an intersection, adjust the camera position
            if (intersections && intersections.length > 0) {
                // Find first intersection that isn't with the character
                let validIntersection = null;
                for (let i = 0; i < intersections.length; i++) {
                    const intersection = intersections[i];
                    // Skip character's own body and very close intersections (likely false positives)
                    if (!intersection.object || 
                        intersection.object.debugName === 'Character' || 
                        intersection.object.debugName?.includes('Character') ||
                        intersection.t < 0.1) {
                        continue;
                    }
                    validIntersection = intersection;
                    break;
                }
                
                // No valid intersections found
                if (!validIntersection) {
                    return desiredCameraPosition;
                }
                
                // Calculate direction vector from eye position to camera
                const rayVector = new Vector3(
                    desiredCameraPosition.x - eyePosition.x,
                    desiredCameraPosition.y - eyePosition.y,
                    desiredCameraPosition.z - eyePosition.z
                );
                const direction = rayVector.normalize();
                
                // Place camera at adjusted distance (intersection point minus radius)
                const distance = Math.max(0, validIntersection.t - cameraRadius);
                return new Vector3(
                    eyePosition.x + direction.x * distance,
                    eyePosition.y + direction.y * distance,
                    eyePosition.z + direction.z * distance
                );
            }
            
            // No intersection, return original position
            return desiredCameraPosition;
        } catch (error) {
            console.error("Error in camera collision detection:", error);
            return desiredCameraPosition;
        }
    }
}