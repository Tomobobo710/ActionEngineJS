// actionengine/display/graphics/actionsprite3D.js

class ActionSprite3D extends RenderableObject {
    constructor(options = {}) {
        super();

        // Required options
        if (!options.base64Data) {
            throw new Error('ActionSprite3D: base64Data is required');
        }

        // Store sprite properties
        this.base64Data = options.base64Data;
        this.position = options.position || new Vector3(0, 0, 0);
        this.width = options.width || 1.0;
        this.height = options.height || 1.0;
        this.color = options.color || [1.0, 1.0, 1.0]; // RGB tint
        this.alpha = options.alpha !== undefined ? options.alpha : 1.0;
        this.blendMode = options.blendMode || 'normal'; // 'normal', 'additive', 'multiply'

        // Billboard mode - defaults to true for backward compatibility
        this.isBillboard = options.billboard !== undefined ? options.billboard : true;

        // Sprite orientation (for non-billboard mode)
        this.forward = options.forward || new Vector3(0, 0, 1); // Default facing positive Z
        this.up = options.up || new Vector3(0, 1, 0); // Default up is positive Y

        // Attachment properties
        this.attachedTo = null;
        this.localOffset = new Vector3(0, 0, 0);

        // WebGL resources
        this.texture = null;
        this.isTextureLoaded = false;

        // Create texture from base64 data
        this._createTextureFromBase64();
    }
    
    /**
     * Create WebGL texture from base64 image data
     * @private
     */
    _createTextureFromBase64() {
        // Check if base64 data is placeholder or invalid
        if (!this.base64Data || this.base64Data === "replace_this_base_64_string") {
            console.warn('ActionSprite3D: Using placeholder base64 data, creating default texture');
            this._createDefaultTexture();
            return;
        }
        
        // Create image element
        const image = new Image();
        
        image.onload = () => {
            // Will be set by the billboard renderer when GL context is available
            this._imageData = image;
            this.isTextureLoaded = true;
        };
        
        image.onerror = () => {
            console.error('ActionSprite3D: Failed to load image from base64 data, using fallback');
            this._createDefaultTexture();
        };
        
        // Set source as data URL
        image.src = `data:image/png;base64,${this.base64Data}`;
    }
    
    /**
     * Create a default texture when base64 data is missing or invalid
     * @private
     */
    _createDefaultTexture() {
        // Create a small default texture (4x4 orange gradient)
        const canvas = document.createElement('canvas');
        canvas.width = 4;
        canvas.height = 4;
        const ctx = canvas.getContext('2d');
        
        // Create a simple gradient
        const gradient = ctx.createLinearGradient(0, 0, 4, 4);
        gradient.addColorStop(0, '#ff6600'); // Orange
        gradient.addColorStop(1, '#ff3300'); // Red-orange
        
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
        
        // Upload the image data
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._imageData);
        
        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        // Unbind
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    
    /**
     * Attach this sprite to another object with a local offset
     * @param {Object} object - Object to attach to (must have position property)
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
     * @returns {Vector3} World position
     */
    getWorldPosition() {
        if (this.attachedTo && this.attachedTo.position) {
            // If attached to an object that has a transformVertex method (like Arwing),
            // use it to properly transform the local offset
            if (this.attachedTo.transformVertex) {
                // Transform the local offset using the ship's transformation
                const transformedOffset = this.attachedTo.transformVertex(this.localOffset);
                // The transformVertex already includes position, so return it directly
                return transformedOffset;
            } else {
                // Fallback to simple position + offset
                return this.attachedTo.position.add(this.localOffset);
            }
        }
        return this.position;
    }
    
    /**
     * Update sprite (called by rendering system)
     * @param {number} deltaTime - Time since last update
     */
    update(deltaTime) {
        // Override in subclasses for animation, etc.
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
    
    /**
     * Get model matrix (required by RenderableObject)
     * For billboards, this is just the position
     */
    getModelMatrix() {
        const matrix = Matrix4.create();
        const worldPos = this.getWorldPosition();
        Matrix4.translate(matrix, matrix, worldPos.toArray());
        return matrix;
    }
}