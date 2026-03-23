//actionengine/rendering/texture/texturemanager.js
class TextureManager {
    constructor(gl) {
         this.gl = gl;

         // Store for model textures
         this.textures = []; // WebGL texture objects for model textures
         this.textureCount = 0; // Counter for tracking texture indices
     }

    /**
     * Loads textures from a GLB model into a 2D array texture.
     * @param {GLBLoader} model - The loaded GLB model containing texture data
     * @returns {number} Starting index for the textures in the global texture space
     */
    loadTextures(model) {
        if (!model.textures || model.textures.length === 0) {
            return -1;
        }

        // Check if these textures have already been loaded
        if (model._texturesLoaded) {
            return model._textureStartIndex;
        }

        const startIndex = 0; // Always load embedded textures starting at layer 0
        const gl = this.gl;
        const textureCount = model.textures.length;

        // Load all images first, then create array texture
        let loadedImages = [];
        let loadedCount = 0;

        for (let i = 0; i < textureCount; i++) {
            const textureData = model.textures[i];
            const metadata = model.textureMetadata[i];

            // Create a blob and object URL to load the image
            const blob = new Blob([textureData], { type: metadata.mimeType });
            const url = URL.createObjectURL(blob);

            const img = new Image();
            img.onload = () => {
                loadedImages[i] = img;
                loadedCount++;

                // Once all images are loaded, create the 2D array texture
                 if (loadedCount === textureCount) {
                     this.createTextureArray(loadedImages, startIndex, textureCount);
                 }

                // Clean up
                URL.revokeObjectURL(url);
            };

            img.onerror = () => {
                 console.error(`Failed to load texture: ${metadata.name}`);
                 URL.revokeObjectURL(url);
             };

            img.src = url;
        }

        // Mark this model as having had its textures loaded
        model._texturesLoaded = true;
        model._textureStartIndex = startIndex;

        return startIndex;
    }

    /**
     * Creates a 2D array texture from loaded texture images.
     * @private
     */
    createTextureArray(images, startIndex, count) {
        const gl = this.gl;

        // Use a fixed safe size for 3D array textures (1024 is safe for most WebGL2 implementations)
        const width = 1024;
        const height = 1024;

        // Always create/recreate the texture array (replaces previous model's textures)
        this.textureArray = gl.createTexture();
        this.textureArrayReady = false; // Mark as not ready until fully uploaded
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.textureArray);

        // Allocate storage for textures
        if (true) {
            gl.texImage3D(
                gl.TEXTURE_2D_ARRAY,
                0, // mip level
                gl.RGBA, // internal format
                width,
                height,
                count, // Exact count for this model's textures
                0, // border
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                null // data
            );
        }

        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);

        // Upload each image as a layer (resize to match array dimensions if needed)
        for (let i = 0; i < count; i++) {
            const img = images[i];

            // Create a canvas with the standardized size
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");

            // Draw image centered if smaller than canvas, or scaled if larger
            if (img.width === width && img.height === height) {
                ctx.drawImage(img, 0, 0);
            } else {
                // Scale image to fit the texture array dimensions
                ctx.drawImage(img, 0, 0, width, height);
            }

            gl.texSubImage3D(
                gl.TEXTURE_2D_ARRAY,
                0, // mip level
                0, // x offset
                0, // y offset
                i, // z offset (layer) - always start at 0 for this array
                width,
                height,
                1, // depth
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                canvas
            );
        }

        // Mark as ready after all textures are uploaded
        this.textureArrayReady = true;
    }
}
