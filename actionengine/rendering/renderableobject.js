//actionengine/rendering/renderableobject.js

/**
 * RenderableObject - Base class for all 3D renderable objects
 * Provides transform and visual state management
 */
class RenderableObject {
    constructor() {
        this.name = "RenderableObject"; // Object name (for GLB import/export)
        this.transform = new Transform();

        this.body = null;
        this.physicsWorld = null;

        this._lastPosition = null;
        this._lastRotation = null;

        // Optimization properties
        this.isStatic = true; // Default to true; renderer will bake geometry on first frame

        // Internal Euler state for standard rotation handling (Radians)
        this._rotationX = 0;
        this._rotationY = 0;
        this._rotationZ = 0;
    }

    /**
     * Synchronize the underlying transform quaternion from the internal Euler state.
     * Order: Z -> X -> Y
     * @private
     */
    _syncTransformRotation() {
        this.transform.rotation.setFromEuler(this._rotationZ, this._rotationX, this._rotationY);
    }

    // Standard Euler Axis Proxies (Industry Standard)
    get rotationX() {
        return this._rotationX;
    }
    set rotationX(v) {
        this._rotationX = v;
        this._syncTransformRotation();
    }

    get rotationY() {
        return this._rotationY;
    }
    set rotationY(v) {
        this._rotationY = v;
        this._syncTransformRotation();
    }

    get rotationZ() {
        return this._rotationZ;
    }
    set rotationZ(v) {
        this._rotationZ = v;
        this._syncTransformRotation();
    }

    // Aliases for Flight/Camera logic (Optional but helpful)
    get pitch() {
        return this.rotationX;
    }
    set pitch(v) {
        this.rotationX = v;
    }
    get yaw() {
        return this.rotationY;
    }
    set yaw(v) {
        this.rotationY = v;
    }
    get roll() {
        return this.rotationZ;
    }
    set roll(v) {
        this.rotationZ = v;
    }

    // Convenience proxies for backward compatibility with older game scripts
    get position() {
        return this.transform.position;
    }
    set position(v) {
        if (v && typeof v.x === "number") this.transform.position.set(v.x, v.y, v.z);
        else this.transform.position = v;
    }

    /**
     * Rotation Property - The "Universal" Entry Point
     * Supports multiple industry standards:
     * 1. Simple Heading (Number) -> Sets rotationY (Yaw)
     * 2. Euler Angles (Object {x,y,z}) -> Sets all axes (Godot/Three.js Style)
     * 3. Quaternion (Object {x,y,z,w}) -> Direct orientation (Unity Style)
     */
    get rotation() {
        // Return rotationY as the default scalar value for legacy scripts
        return this.rotationY;
    }

    set rotation(v) {
        if (typeof v === "number") {
            // Legacy/RPG Style: Direct angle assignment affects the vertical axis
            this.rotationY = v;
        } else if (v && typeof v === "object") {
            if (v.w !== undefined) {
                // Unity Style: assigning a Quaternion
                this.transform.rotation = v;
            } else {
                // Godot/Three.js Style: assigning an Euler Vector
                if (v.x !== undefined) this._rotationX = v.x;
                if (v.y !== undefined) this._rotationY = v.y;
                if (v.z !== undefined) this._rotationZ = v.z;
                this._syncTransformRotation();
            }
        } else {
            // Truly invalid assignment
            throw new Error(
                `[RenderableObject] Invalid rotation assignment: ${v}. Expected Number, Euler Object, or Quaternion.`
            );
        }
    }

    get scale() {
        return this.transform.scale;
    }
    set scale(v) {
        if (typeof v === "number") {
            this.transform.scale.set(v, v, v);
        } else if (v && typeof v === "object") {
            // Support both Vector3 and plain {x, y, z} objects
            this.transform.scale.set(
                v.x !== undefined ? v.x : 1.0,
                v.y !== undefined ? v.y : 1.0,
                v.z !== undefined ? v.z : 1.0
            );
        }
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
