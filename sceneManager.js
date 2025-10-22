import { ActionModel3D } from './actionengine/display/graphics/actionmodel3D.js';

/**
 * SceneManager - Manages all 3D objects in the scene
 * Encapsulates scene object management, providing clean interface for adding/removing 3D models
 */
class SceneManager {
    constructor() {
        this.sceneObjects = new Set();
        this.objectCount = 0;
    }

    /**
     * Add a 3D object to the scene
     * @param {ActionModel3D} model - The 3D model to add
     * @returns {boolean} Success status
     */
    add(model) {
        if (model && model.geometry) {
            this.sceneObjects.add(model);
            this.objectCount = this.sceneObjects.size;
            console.log('✅ Added object to scene:', model);
            return true;
        } else {
            console.warn('⚠️ Attempted to add invalid object to scene:', model);
            return false;
        }
    }

    /**
     * Remove a 3D object from the scene
     * @param {ActionModel3D} model - The 3D model to remove
     * @returns {boolean} Success status
     */
    remove(model) {
        if (model) {
            const removed = this.sceneObjects.delete(model);
            if (removed) {
                this.objectCount = this.sceneObjects.size;
                console.log('✅ Removed object from scene:', model);
            }
            return removed;
        }
        return false;
    }

    /**
     * Remove object by ID
     * @param {string} id - Object ID to remove
     * @returns {boolean} Success status
     */
    removeById(id) {
        for (let obj of this.sceneObjects) {
            if (obj.id === id) {
                return this.remove(obj);
            }
        }
        return false;
    }

    /**
     * Get object by ID
     * @param {string} id - Object ID to find
     * @returns {ActionModel3D|null} Found object or null
     */
    getById(id) {
        for (let obj of this.sceneObjects) {
            if (obj.id === id) {
                return obj;
            }
        }
        return null;
    }

    /**
     * Clear all objects from scene
     */
    clear() {
        this.sceneObjects.clear();
        this.objectCount = 0;
        console.log('🧹 Cleared all objects from scene');
    }

    /**
     * Get all objects in scene
     * @returns {Set<ActionModel3D>} Set of all scene objects
     */
    getAllObjects() {
        return this.sceneObjects;
    }

    /**
     * Get count of objects in scene
     * @returns {number} Number of objects
     */
    getObjectCount() {
        return this.objectCount;
    }

    /**
     * Check if object exists in scene
     * @param {ActionModel3D} model - Object to check
     * @returns {boolean} Whether object exists
     */
    contains(model) {
        return this.sceneObjects.has(model);
    }

    /**
     * Draw all objects in the scene
     * @param {Renderer} renderer - Renderer instance
     * @param {Matrix4} viewMatrix - Camera view matrix
     * @param {Matrix4} projectionMatrix - Camera projection matrix
     */
    draw(renderer, viewMatrix, projectionMatrix) {
        this.sceneObjects.forEach((model) => {
            if (model && model.geometry) {
                try {
                    // Create model matrix for object position
                    const modelMatrix = window.Matrix4.create();
                    Matrix4.translate(modelMatrix, modelMatrix, [
                        model.position.x,
                        model.position.y,
                        model.position.z
                    ]);

                    // Draw the mesh using basic shader
                    renderer.drawMesh(model.geometry, "basic", modelMatrix, viewMatrix, projectionMatrix);
                } catch (error) {
                    console.error('❌ Error drawing scene object:', model, error);
                }
            } else {
                console.warn('⚠️ Scene object missing model or geometry:', model);
            }
        });
    }

    /**
     * Update all objects in the scene (for animations, physics, etc.)
     * @param {number} deltaTime - Time elapsed since last frame
     */
    update(deltaTime) {
        // Update logic for scene objects can be added here
        // For now, this is a placeholder for future animation/physics updates
        this.sceneObjects.forEach((model) => {
            // Example: Update model animations if they exist
            if (model.update && typeof model.update === 'function') {
                model.update(deltaTime);
            }
        });
    }
}

export { SceneManager };