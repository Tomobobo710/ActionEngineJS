/**
 * TextureSet - Encapsulates all textures and materials for a single model
 * Allows multiple models to have independent texture arrays in VRAM
 */
class TextureSet {
    constructor(gl) {
        this.gl = gl;
        
        // GPU resources
         this.textureArray = null;          // TEXTURE_2D_ARRAY containing all textures
         this.materialPropertiesTexture = null; // 1D texture storing PBR properties
        this.textureArrayReady = false;
        this.materialPropertiesReady = false;
        
        // CPU-side tracking
        this.textures = [];                // Array of loaded image data
        this.textureMetadata = [];         // Metadata for each texture
        this.materialProperties = new Map(); // Properties indexed by texture index
        
        // Dimensions
        this.textureWidth = 1024;
        this.textureHeight = 1024;
    }

    /**
     * Load textures from a GLB model
     * @param {Object} model - GLB model with texture data
     * @returns {Promise<void>}
     */
    async loadFromModel(model) {
         if (!model.textures || model.textures.length === 0) {
             console.warn("TextureSet: Model has no textures");
             return;
         }

        this.textures = [...model.textures];
        this.textureMetadata = [...model.textureMetadata];
        
        // Load images asynchronously
        const loadedImages = await this._loadImages();
        
        // Create GPU texture array
        await this._createTextureArray(loadedImages);
        
        // Create material properties texture
        this._createMaterialPropertiesTexture();
    }

    /**
     * Load images from texture data
     * @private
     */
    _loadImages() {
        return new Promise((resolve) => {
            const loadedImages = [];
            let loadedCount = 0;
            const totalCount = this.textures.length;

            this.textures.forEach((textureData, i) => {
                const metadata = this.textureMetadata[i];
                const blob = new Blob([textureData], { type: metadata.mimeType });
                const url = URL.createObjectURL(blob);

                const img = new Image();
                img.onload = () => {
                    loadedImages[i] = img;
                    loadedCount++;
                    if (loadedCount === totalCount) {
                        resolve(loadedImages);
                    }
                    URL.revokeObjectURL(url);
                };
                img.onerror = () => {
                    console.error(`Failed to load texture: ${metadata.name}`);
                    URL.revokeObjectURL(url);
                };
                img.src = url;
            });
        });
    }

    /**
     * Create the GPU texture array
     * @private
     */
    async _createTextureArray(images) {
        const gl = this.gl;
        const width = this.textureWidth;
        const height = this.textureHeight;
        const depth = images.length;

        // Create new texture array for this model
        this.textureArray = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.textureArray);

        // Allocate storage
        gl.texImage3D(
            gl.TEXTURE_2D_ARRAY,
            0,           // mip level
            gl.RGBA,     // internal format
            width,
            height,
            depth,       // Exact count for this model
            0,           // border
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null         // data
        );

        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);

        // Upload each image as a layer
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");

            if (img.width === width && img.height === height) {
                ctx.drawImage(img, 0, 0);
            } else {
                ctx.drawImage(img, 0, 0, width, height);
            }

            gl.texSubImage3D(
                gl.TEXTURE_2D_ARRAY,
                0,           // mip level
                0, 0, i,     // x, y, z offset
                width, height, 1, // dimensions
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                canvas
            );
        }

        this.textureArrayReady = true;
    }

    /**
     * Create material properties texture for this model's textures
     * @private
     */
    _createMaterialPropertiesTexture() {
        const gl = this.gl;
        const textureCount = this.textures.length;

        // Default PBR properties
        const defaults = {
            roughness: 0.8,
            metallic: 0.0,
            baseReflectivity: 0.1
        };

        // Build properties array
        const data = new Float32Array(textureCount * 4);
        for (let i = 0; i < textureCount; i++) {
            const props = this.materialProperties.get(i) || defaults;
            data[i * 4] = props.roughness;
            data[i * 4 + 1] = props.metallic;
            data[i * 4 + 2] = props.baseReflectivity;
            data[i * 4 + 3] = 0; // reserved
        }

        // Create 1D texture
        this.materialPropertiesTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.materialPropertiesTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA32F,
            textureCount,
            1,
            0,
            gl.RGBA,
            gl.FLOAT,
            data
        );

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);

        this.materialPropertiesReady = true;
    }

    /**
     * Get texture index by name (for material references)
     */
    getTextureIndex(textureName) {
        return this.textureMetadata.findIndex(m => m.name === textureName);
    }

    /**
     * Set material properties for a specific texture in this set
     */
    setMaterialProperties(textureIndex, props) {
        this.materialProperties.set(textureIndex, props);
        // Could regenerate material properties texture, but for now just store
    }

    /**
     * Clean up GPU resources
     */
    destroy() {
        const gl = this.gl;
        if (this.textureArray) gl.deleteTexture(this.textureArray);
        if (this.materialPropertiesTexture) gl.deleteTexture(this.materialPropertiesTexture);
        this.textureArray = null;
        this.materialPropertiesTexture = null;
    }
}
