//actionengine/rendering/actionsprite2d.js

/**
 * ActionSprite2D - A 2D sprite with image, position, rotation, scale, alpha, and z-order.
 *
 * Rendered by ActionRenderer2D on any canvas layer (game, gui, debug).
 */
class ActionSprite2D {
    constructor(options = {}) {
        if (!options.image) {
            throw new Error("ActionSprite2D: image is required (Image element, canvas, or URL string)");
        }

        this.image = options.image;

        // Position (in 800x600 coordinate space)
        this.x = options.x !== undefined ? options.x : 0;
        this.y = options.y !== undefined ? options.y : 0;

        // Size
        this.width = options.width !== undefined ? options.width : this._naturalWidth;
        this.height = options.height !== undefined ? options.height : this._naturalHeight;

        // Rotation in radians (counter-clockwise, around origin)
        this.rotation = options.rotation || 0;

        // Origin/anchor point as fraction of sprite size (0..1), center = 0.5
        this.originX = options.originX !== undefined ? options.originX : 0.5;
        this.originY = options.originY !== undefined ? options.originY : 0.5;

        // Flip
        this.flipX = options.flipX || false;
        this.flipY = options.flipY || false;

        // Alpha 0..1
        this.alpha = options.alpha !== undefined ? Math.max(0, Math.min(1, options.alpha)) : 1.0;

        // Tint color {r, g, b} each 0..255
        this.tint = options.tint || { r: 255, g: 255, b: 255 };

        // Z-order for sorting (higher = drawn on top)
        this.z = options.z !== undefined ? options.z : 0;
    }

    get _naturalWidth() {
        if (this.image instanceof HTMLImageElement || this.image instanceof HTMLCanvasElement) {
            return this.image.width;
        }
        return 64;
    }

    get _naturalHeight() {
        if (this.image instanceof HTMLImageElement || this.image instanceof HTMLCanvasElement) {
            return this.image.height;
        }
        return 64;
    }

    /**
     * Set the image source from a URL. Loads the image and rebuilds the sprite.
     * @param {string} url - Image URL
     */
    setImageFromURL(url) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        const self = this;
        img.onload = () => {
            self.image = img;
            self.width = self._naturalWidth;
            self.height = self._naturalHeight;
        };
        img.onerror = () => {
            console.error(`ActionSprite2D: Failed to load image from URL: ${url}`);
        };
        img.src = url;
    }

    /**
     * Set position
     */
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    /**
     * Set size
     */
    setSize(w, h) {
        this.width = w;
        this.height = h;
    }

    /**
     * Set scale (uniform)
     */
    setScale(s) {
        this.width = this._naturalWidth * s;
        this.height = this._naturalHeight * s;
    }

    /**
     * Set rotation in radians
     */
    setRotation(r) {
        this.rotation = r;
    }

    /**
     * Set alpha
     */
    setAlpha(a) {
        this.alpha = Math.max(0, Math.min(1, a));
    }

    /**
     * Set tint color
     */
    setTint(r, g, b) {
        this.tint = { r, g, b };
    }

    /**
     * Set z-order
     */
    setZ(z) {
        this.z = z;
    }

    /**
     * Set flip flags
     */
    setFlip(flipX, flipY) {
        this.flipX = flipX || false;
        this.flipY = flipY || false;
    }

    /**
     * Get the bounding box of the rotated sprite in world space
     */
    getBounds() {
        const hw = this.width / 2;
        const hh = this.height / 2;
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);

        const corners = [
            { x: -hw, y: -hh },
            { x: hw, y: -hh },
            { x: hw, y: hh },
            { x: -hw, y: hh }
        ];

        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        for (const c of corners) {
            const rx = c.x * cos - c.y * sin;
            const ry = c.x * sin + c.y * cos;
            const wx = this.x + rx;
            const wy = this.y + ry;
            if (wx < minX) minX = wx;
            if (wy < minY) minY = wy;
            if (wx > maxX) maxX = wx;
            if (wy > maxY) maxY = wy;
        }

        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
}
