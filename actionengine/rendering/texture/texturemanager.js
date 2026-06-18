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

        // Calculate optimal uniform texture size based on actual image dimensions and GPU limits
        const { width, height, effectiveCount } = this._calculateOptimalTextureSize(images, count, gl);

        // Always create/recreate the texture array (replaces previous model's textures)
        this.textureArray = gl.createTexture();
        this.textureArrayReady = false; // Mark as not ready until fully uploaded
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.textureArray);

        // Allocate storage for textures
        gl.texImage3D(
            gl.TEXTURE_2D_ARRAY,
            0, // mip level
            gl.RGBA, // internal format
            width,
            height,
            effectiveCount,
            0, // border
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null // data
        );

        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);

        // Upload each image as a layer (resize to match array dimensions if needed)
        const maxUpload = Math.min(count, effectiveCount);
        for (let i = 0; i < maxUpload; i++) {
            const img = images[i];
            if (!img) continue;

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

    /**
     * Probe the GPU to find the largest uniform texture size that the driver
     * accepts for a TEXTURE_2D_ARRAY with the given layer count.
     * Uses gl.getError() after texImage3D — the only spec-compliant way to
     * handle the unqueryable per-allocation limit enforced by ANGLE 148+.
     * @private
     */
    _calculateOptimalTextureSize(images, count, gl) {
        let maxDim = 0;
        let validCount = 0;
        for (const img of images) {
            if (img) {
                maxDim = Math.max(maxDim, img.width, img.height);
                validCount++;
            }
        }
        if (maxDim === 0) maxDim = 1024;
        if (validCount === 0) validCount = count;

        const gpuMaxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        const gpuMaxLayers = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS);
        const effectiveCount = Math.min(validCount, gpuMaxLayers);

        // Clear any pending GL errors before probing
        while (gl.getError() !== gl.NO_ERROR);

        let dim = Math.min(maxDim, gpuMaxSize);

        // Probe: try the allocation and halve on INVALID_OPERATION
        while (dim >= 1) {
            const probe = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D_ARRAY, probe);
            gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA, dim, dim, effectiveCount, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            const err = gl.getError();
            gl.deleteTexture(probe);

            if (err === gl.NO_ERROR) break;
            if (dim <= 16) { dim = 16; break; }
            dim >>= 1;
        }

        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);

        console.log(
            `[TextureManager] Array: ${effectiveCount} layers at ${dim}x${dim}` +
            ` (${(dim * dim * effectiveCount * 4 / (1024*1024)).toFixed(0)} MB)` +
            ` | actual max dim: ${maxDim}, GPU max size: ${gpuMaxSize}, max layers: ${gpuMaxLayers}`
        );

        return { width: dim, height: dim, effectiveCount };
    }
}
