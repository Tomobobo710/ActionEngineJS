//actionengine/rendering/actionsprite3D.js

/**
 * ActionSprite3D - 2D sprite rendered in 3D world space
 *
 * Extends RenderableObject to provide sprite-specific functionality:
 * - Texture loading from base64 data
 * - Billboard rendering (faces camera)
 * - Arbitrary orientation support
 * - Color tinting and transparency
 * - Object attachment (follow parent object)
 */
class ActionSprite3D extends RenderableObject {
    constructor(options = {}) {
        super();

        if (!options.base64Data) {
            throw new Error("ActionSprite3D: base64Data is required");
        }

        this.base64Data = options.base64Data;
        this.width = options.width || 1.0;
        this.color = options.color || [1.0, 1.0, 1.0];
        this.alpha = options.alpha !== undefined ? options.alpha : 1.0;
        this.blendMode = options.blendMode || "normal";

        this.isBillboard = options.billboard !== undefined ? options.billboard : true;

        this.forward = options.forward || new Vector3(0, 0, 1);
        this.up = options.up || new Vector3(0, 1, 0);

        this.attachedTo = null;
        this.localOffset = new Vector3(0, 0, 0);

        this.texture = null;
        this._imageData = null;
        this.isTextureLoaded = false;

        if (options.position) {
            this.transform.position = options.position;
        }
        if (options.height !== undefined) {
            this.height = options.height;
        } else {
            this.height = options.height || 1.0;
        }

        this._createTextureFromBase64();
    }

    /**
     * Create WebGL texture from base64 image data
     * @private
     */
    _createTextureFromBase64() {
        if (!this.base64Data || this.base64Data === "replace_this_base_64_string") {
            console.warn("ActionSprite3D: Using placeholder base64 data, creating default texture");
            this._createDefaultTexture();
            return;
        }

        const image = new Image();

        image.onload = () => {
            this._imageData = image;
            this.isTextureLoaded = true;
        };

        image.onerror = () => {
            console.error("ActionSprite3D: Failed to load image from base64 data, using fallback");
            this._createDefaultTexture();
        };

        image.src = `data:image/png;base64,${this.base64Data}`;
    }

    /**
     * Create a default texture when base64 data is missing or invalid
     * @private
     */
    _createDefaultTexture() {
        const canvas = document.createElement("canvas");
        canvas.width = 4;
        canvas.height = 4;
        const ctx = canvas.getContext("2d");

        const gradient = ctx.createLinearGradient(0, 0, 4, 4);
        gradient.addColorStop(0, "#ff6600");
        gradient.addColorStop(1, "#ff3300");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 4, 4);

        this._imageData = canvas;
        this.isTextureLoaded = true;
    }

    /**
     * Create the actual WebGL texture (called by renderer)
     * @param {WebGLRenderingContext} gl - WebGL context
     */
    createWebGLTexture(gl) {
        if (!this._imageData || this.texture) {
            return;
        }

        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._imageData);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    /**
     * Attach this sprite to another object with a local offset
     * @param {Object} object - Object to attach to
     * @param {Vector3} offset - Local offset from the object's position
     */
    attachTo(object, offset = new Vector3(0, 0, 0)) {
        this.attachedTo = object;
        this.localOffset = offset;
    }

    /**
     * Detach this sprite from any attached object
     */
    detach() {
        this.attachedTo = null;
        this.localOffset = new Vector3(0, 0, 0);
    }

    /**
     * Get the world position of this sprite
     * Takes into account attachment and custom transforms
     * Uses component-based transforms instead of matrix multiplication
     * @returns {Vector3} World position
     */
    getWorldPosition() {
        if (this.attachedTo && this.attachedTo.transform) {
            const parentTransform = this.attachedTo.transform;

            // Apply parent scale to local offset
            const scaledOffset = new Vector3(
                this.localOffset.x * parentTransform.scale.x,
                this.localOffset.y * parentTransform.scale.y,
                this.localOffset.z * parentTransform.scale.z
            );

            // Apply parent rotation to scaled offset using quaternion
            const q = parentTransform.rotation;
            const x = scaledOffset.x,
                y = scaledOffset.y,
                z = scaledOffset.z;
            const qx = q.x,
                qy = q.y,
                qz = q.z,
                qw = q.w;

            // Quaternion rotation formula: v' = q * v * q^-1
            // Simplified for efficiency (quaternion is already normalized)
            const ix = qw * x + qy * z - qz * y;
            const iy = qw * y + qz * x - qx * z;
            const iz = qw * z + qx * y - qy * x;
            const iw = -qx * x - qy * y - qz * z;

            const rotatedOffset = new Vector3(
                ix * qw + iw * -qx + iy * -qz - iz * -qy,
                iy * qw + iw * -qy + iz * -qx - ix * -qz,
                iz * qw + iw * -qz + ix * -qy - iy * -qx
            );

            // Add parent position
            return new Vector3(
                parentTransform.position.x + rotatedOffset.x,
                parentTransform.position.y + rotatedOffset.y,
                parentTransform.position.z + rotatedOffset.z
            );
        }
        return this.transform.position;
    }

    /**
     * Set the color tint of the sprite
     * @param {Array} color - RGB color array [r, g, b] with values 0-1
     */
    setColor(color) {
        this.color = color;
    }

    /**
     * Set the alpha transparency of the sprite
     * @param {number} alpha - Alpha value 0-1
     */
    setAlpha(alpha) {
        this.alpha = Math.max(0, Math.min(1, alpha));
    }

    /**
     * Set the size of the sprite
     * @param {number} width - Width in world units
     * @param {number} height - Height in world units
     */
    setSize(width, height) {
        this.width = width;
        this.height = height;
    }

    /**
     * Set the blend mode for rendering
     * @param {string} mode - 'normal', 'additive', or 'multiply'
     */
    setBlendMode(mode) {
        this.blendMode = mode;
    }

    /**
     * Set the orientation of the sprite (for non-billboard mode)
     * @param {Vector3} forward - Forward direction vector
     * @param {Vector3} up - Up direction vector
     */
    setOrientation(forward, up = new Vector3(0, 1, 0)) {
        this.forward = forward;
        this.up = up;
    }

    /**
     * Cleanup WebGL resources
     * @param {WebGLRenderingContext} gl - WebGL context
     */
    dispose(gl) {
        if (this.texture) {
            gl.deleteTexture(this.texture);
            this.texture = null;
        }
    }
}
