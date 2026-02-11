// actionengine/display/graphics/texture/texturemanager.js
class TextureManager {
    constructor(gl) {
        this.gl = gl;
        this.textureArray = this.createTextureArray();

        // Store for embedded model textures
        this.embeddedTextures = []; // WebGL texture objects for embedded model textures
        this.embeddedTextureCount = 0; // Counter for tracking embedded texture indices

        // Create material properties texture
        this.materialPropertiesTexture = this.createMaterialPropertiesTexture();

        // Flag to control per-texture material usage
        this.usePerTextureMaterials = true;

        // Add a flag to track if material properties need updating
        this.materialPropertiesDirty = true;

        // Store a hash of the last material properties to detect changes
        this._lastMaterialPropertiesHash = 0;
    }

    createTextureArray() {
        if (true) {
            return this.createWebGL2TextureArray();
        } else {
            return this.createWebGL1Texture();
        }
    }

    createWebGL2TextureArray() {
        console.log("[TextureManager] Creating WebGL2 texture array");
        const array = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, array);

        // All our procedural textures are 256x256
        this.gl.texImage3D(
            this.gl.TEXTURE_2D_ARRAY,
            0, // mip level
            this.gl.RGBA, // internal format
            256, // width
            256, // height
            textureRegistry.getTextureCount(), // number of layers
            0, // border
            this.gl.RGBA, // format
            this.gl.UNSIGNED_BYTE, // type
            null // data
        );

        // Load each texture as a layer
        textureRegistry.textureList.forEach((textureName, i) => {
            const proceduralTexture = textureRegistry.get(textureName);

            // Convert to RGBA format
            const rgbaData = new Uint8Array(proceduralTexture.width * proceduralTexture.height * 4);
            for (let j = 0; j < proceduralTexture.data.length; j += 4) {
                rgbaData[j] = proceduralTexture.data[j]; // R
                rgbaData[j + 1] = proceduralTexture.data[j + 1]; // G
                rgbaData[j + 2] = proceduralTexture.data[j + 2]; // B
                rgbaData[j + 3] = 255; // A
            }

            this.gl.texSubImage3D(
                this.gl.TEXTURE_2D_ARRAY,
                0, // mip level
                0, // x offset
                0, // y offset
                i, // z offset (layer)
                256, // width
                256, // height
                1, // depth
                this.gl.RGBA,
                this.gl.UNSIGNED_BYTE,
                rgbaData
            );
        });

        // Set texture parameters
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);

        return array;
    }

    createWebGL1Texture() {
        console.log("[TextureManager] Creating WebGL1 basic texture (no array support)");
        // For WebGL1, just use the first texture in the registry
        const array = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, array);

        // Get the first texture (grass)
        const proceduralTexture = textureRegistry.get(textureRegistry.textureList[0]);

        // Convert to RGBA format
        const rgbaData = new Uint8Array(proceduralTexture.width * proceduralTexture.height * 4);
        for (let j = 0; j < proceduralTexture.data.length; j += 4) {
            rgbaData[j] = proceduralTexture.data[j]; // R
            rgbaData[j + 1] = proceduralTexture.data[j + 1]; // G
            rgbaData[j + 2] = proceduralTexture.data[j + 2]; // B
            rgbaData[j + 3] = 255; // A
        }

        this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0, // mip level
            this.gl.RGBA, // internal format
            256, // width
            256, // height
            0, // border
            this.gl.RGBA, // format
            this.gl.UNSIGNED_BYTE, // type
            rgbaData // data
        );

        // Set texture parameters
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);

        return array;
    }

    // Create a texture to store material properties for each texture
    createMaterialPropertiesTexture() {
        const gl = this.gl;
        console.log("[TextureManager] Creating material properties texture");

        // Create a texture for material properties
        // Each texel contains [roughness, metallic, baseReflectivity, reserved]
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Get material properties data from texture registry
        const textureCount = textureRegistry.getTextureCount();
        const data = textureRegistry.getMaterialPropertiesArray();

        // Create and set texture data based on WebGL version
        if (true) {
            gl.texImage2D(
                gl.TEXTURE_2D,
                0, // mip level
                gl.RGBA32F, // internal format - use float format for WebGL2
                textureCount, // width (one texel per texture)
                1, // height
                0, // border
                gl.RGBA, // format
                gl.FLOAT, // type
                data // data
            );
        } else {
            // WebGL 1.0 fallback - try to use OES_texture_float extension
            const ext = gl.getExtension("OES_texture_float");
            if (ext) {
                gl.texImage2D(
                    gl.TEXTURE_2D,
                    0, // mip level
                    gl.RGBA, // internal format
                    textureCount, // width (one texel per texture)
                    1, // height
                    0, // border
                    gl.RGBA, // format
                    gl.FLOAT, // type
                    data // data
                );
            } else {
                console.warn(
                    "[TextureManager] Float textures not supported by this device. Falling back to global material properties."
                );
                this.usePerTextureMaterials = false;
                return null;
            }
        }

        // Set texture parameters - we need NEAREST filter for exact sampling
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        return texture;
    }

    // Update the material properties texture with current values from the registry
    updateMaterialPropertiesTexture() {
        if (!this.materialPropertiesTexture || !this.usePerTextureMaterials) {
            return;
        }

        const gl = this.gl;

        // Get the current material properties data
        const textureCount = textureRegistry.getTextureCount();
        const data = textureRegistry.getMaterialPropertiesArray();

        // IMPORTANT: Save WebGL state before modifying
        const previousTexture = gl.getParameter(gl.TEXTURE_BINDING_2D);
        const previousActiveTexture = gl.getParameter(gl.ACTIVE_TEXTURE);

        // Bind and update the texture
        gl.bindTexture(gl.TEXTURE_2D, this.materialPropertiesTexture);

        if (true) {
            gl.texSubImage2D(
                gl.TEXTURE_2D,
                0, // mip level
                0, // x offset
                0, // y offset
                textureCount, // width
                1, // height
                gl.RGBA, // format
                gl.FLOAT, // type
                data // data
            );
        } else {
            // For WebGL1, we need to re-specify the entire texture
            gl.texImage2D(
                gl.TEXTURE_2D,
                0, // mip level
                gl.RGBA, // internal format
                textureCount, // width
                1, // height
                0, // border
                gl.RGBA, // format
                gl.FLOAT, // type
                data // data
            );
        }

        // IMPORTANT: Restore WebGL state when done
        gl.activeTexture(previousActiveTexture);
        gl.bindTexture(gl.TEXTURE_2D, previousTexture);
    }

    // Toggle per-texture material usage
    togglePerTextureMaterials(enabled) {
        this.usePerTextureMaterials = enabled;

        // If enabling and we don't have a material texture, create one
        if (enabled && !this.materialPropertiesTexture) {
            this.materialPropertiesTexture = this.createMaterialPropertiesTexture();
        }
    }

    /**
     * Loads embedded textures from a GLB model into a 2D array texture.
     * @param {GLBLoader} model - The loaded GLB model containing texture data
     * @returns {number} Starting index for the embedded textures in the global texture space
     */
    loadEmbeddedTextures(model) {
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
                    this.createEmbeddedTextureArray(loadedImages, startIndex, textureCount);
                }

                // Clean up
                URL.revokeObjectURL(url);
            };

            img.onerror = () => {
                console.error(`Failed to load embedded texture: ${metadata.name}`);
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
     * Creates a 2D array texture from loaded embedded texture images.
     * @private
     */
    createEmbeddedTextureArray(images, startIndex, count) {
        const gl = this.gl;

        // Use a fixed safe size for 3D array textures (1024 is safe for most WebGL2 implementations)
        const width = 1024;
        const height = 1024;

        // Always create/recreate the embedded texture array (replaces previous model's textures)
        this.embeddedTextureArray = gl.createTexture();
        this.embeddedTextureArrayReady = false; // Mark as not ready until fully uploaded
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.embeddedTextureArray);

        // Allocate storage for embedded textures
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
        this.embeddedTextureArrayReady = true;
    }
}
