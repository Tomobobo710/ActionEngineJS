// actionengine/camera/cameracollisionhandler.js
import { ActionRaycast } from '../math/physics/actionraycast.js';

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
            
            // Calculate ray length
            const rayLength = Math.sqrt(
                Math.pow(desiredCameraPosition.x - eyePosition.x, 2) +
                Math.pow(desiredCameraPosition.y - eyePosition.y, 2) +
                Math.pow(desiredCameraPosition.z - eyePosition.z, 2)
            );
            
            // Don't perform collision check if camera is too close
            if (rayLength < cameraRadius * 2) {
                return desiredCameraPosition;
            }
            
            // Use our ActionRaycast utility to check for collisions
            const hit = ActionRaycast.cast(
                eyePosition,
                desiredCameraPosition,
                this.physicsWorld,
                {
                    ignoreObjects: ['Character'],
                    minDistance: 0.1
                }
            );
            
            // If we got a hit, adjust the camera position
            if (hit) {
                // Use the hit point and direction to calculate the new camera position
                // Place camera at adjusted distance (hit point minus radius)
                const adjustedDistance = Math.max(0, hit.distance - cameraRadius);
                
                // Calculate the point along the ray using the utility method
                return ActionRaycast.getPointOnRay(
                    eyePosition,
                    hit.rayDirection,
                    adjustedDistance
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

export { CameraCollisionHandler };