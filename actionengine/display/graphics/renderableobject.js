// actionengine/display/graphics/renderableobject.js

/**
 * RenderableObject - Base class for all 3D renderable objects
 * Provides transform and visual state management
 */
class RenderableObject {
    constructor() {
        this.transform = new Transform();

        this.body = null;
        this.physicsWorld = null;

        this._visualDirty = true;
        this._lastPosition = null;
        this._lastRotation = null;
    }

    markVisualDirty() {
        this._visualDirty = true;
    }

    isVisualDirty() {
        return this._visualDirty;
    }

    /**
     * Update game logic
     * @param {number} deltaTime - Time since last update
     */
    update(deltaTime) {}

    /**
     * Update visual representation
     * Called after update(). Subclasses override to sync visual state.
     */
    updateVisual() {}
}
