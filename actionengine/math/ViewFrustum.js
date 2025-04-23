// actionengine/math/ViewFrustum.js
class ViewFrustum {
    constructor() {
        // Create the 6 frustum planes
        this.planes = [
            new Float32Array(4), // Left
            new Float32Array(4), // Right
            new Float32Array(4), // Bottom
            new Float32Array(4), // Top
            new Float32Array(4), // Near
            new Float32Array(4)  // Far
        ];
    }

    // Extract frustum planes from the combined projection-view matrix
    updateFromMatrix(projViewMatrix) {
        // Left plane
        this.planes[0][0] = projViewMatrix[3] + projViewMatrix[0];
        this.planes[0][1] = projViewMatrix[7] + projViewMatrix[4];
        this.planes[0][2] = projViewMatrix[11] + projViewMatrix[8];
        this.planes[0][3] = projViewMatrix[15] + projViewMatrix[12];

        // Right plane
        this.planes[1][0] = projViewMatrix[3] - projViewMatrix[0];
        this.planes[1][1] = projViewMatrix[7] - projViewMatrix[4];
        this.planes[1][2] = projViewMatrix[11] - projViewMatrix[8];
        this.planes[1][3] = projViewMatrix[15] - projViewMatrix[12];

        // Bottom plane
        this.planes[2][0] = projViewMatrix[3] + projViewMatrix[1];
        this.planes[2][1] = projViewMatrix[7] + projViewMatrix[5];
        this.planes[2][2] = projViewMatrix[11] + projViewMatrix[9];
        this.planes[2][3] = projViewMatrix[15] + projViewMatrix[13];

        // Top plane
        this.planes[3][0] = projViewMatrix[3] - projViewMatrix[1];
        this.planes[3][1] = projViewMatrix[7] - projViewMatrix[5];
        this.planes[3][2] = projViewMatrix[11] - projViewMatrix[9];
        this.planes[3][3] = projViewMatrix[15] - projViewMatrix[13];

        // Near plane
        this.planes[4][0] = projViewMatrix[3] + projViewMatrix[2];
        this.planes[4][1] = projViewMatrix[7] + projViewMatrix[6];
        this.planes[4][2] = projViewMatrix[11] + projViewMatrix[10];
        this.planes[4][3] = projViewMatrix[15] + projViewMatrix[14];

        // Far plane
        this.planes[5][0] = projViewMatrix[3] - projViewMatrix[2];
        this.planes[5][1] = projViewMatrix[7] - projViewMatrix[6];
        this.planes[5][2] = projViewMatrix[11] - projViewMatrix[10];
        this.planes[5][3] = projViewMatrix[15] - projViewMatrix[14];

        // Normalize the planes
        this.normalizePlanes();
    }

    // Normalize all the planes for more efficient checks
    normalizePlanes() {
        for (let i = 0; i < 6; i++) {
            const plane = this.planes[i];
            const length = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
            if (length !== 0) {
                plane[0] /= length;
                plane[1] /= length;
                plane[2] /= length;
                plane[3] /= length;
            }
        }
    }

    // Update the frustum using camera parameters
    updateFromCamera(camera) {
        const projMatrix = Matrix4.create();
        Matrix4.perspective(
            projMatrix,
            camera.fov,
            Game.WIDTH / Game.HEIGHT,
            0.1,
            camera.far || 10000.0
        );

        const viewMatrix = Matrix4.create();
        Matrix4.lookAt(
            viewMatrix,
            camera.position.toArray(),
            camera.target.toArray(),
            camera.up.toArray()
        );

        const projViewMatrix = Matrix4.create();
        Matrix4.multiply(projViewMatrix, projMatrix, viewMatrix);

        this.updateFromMatrix(projViewMatrix);
    }

    // Check if a sphere is inside or intersects the frustum
    containsSphere(center, radius) {
        for (let i = 0; i < 6; i++) {
            const plane = this.planes[i];
            const distance = plane[0] * center.x + plane[1] * center.y + plane[2] * center.z + plane[3];
            if (distance < -radius) {
                return false; // Completely outside
            }
        }
        return true; // Inside or intersecting
    }

    // Test if an object is visible based on its bounding volume
    isVisible(object) {
        // If the object has no position, we can't test it
        if (!object || !object.position) {
            return false;
        }

        // Check if the object has opted out of frustum culling
        if (object.excludeFromFrustumCulling === true) {
            return true;
        }

        // If the object has a bounding sphere radius, use that
        if (object.boundingSphereRadius !== undefined) {
            return this.containsSphere(object.position, object.boundingSphereRadius);
        }

        // If the object is terrain-like (large grid), use a larger radius
        if (object.gridResolution && object.baseWorldScale) {
            // For terrain, use a size proportional to its scale
            const terrainSize = object.baseWorldScale * object.gridResolution / 2;
            return this.containsSphere(object.position, terrainSize);
        }

        // Default to a larger radius than before to be more conservative
        const defaultRadius = object.radius || 20; // Default to 20 units instead of 5
        return this.containsSphere(object.position, defaultRadius);
    }
}
