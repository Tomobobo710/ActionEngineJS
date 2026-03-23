//actionengine/rendering/texture/textureset.js
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
        
        // Extract material properties from model triangles (GLB extension data)
        if (model.triangles && model.triangles.length > 0) {
            this._extractMaterialPropertiesFromTriangles(model.triangles, model.textureMetadata);
        }
        
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

             if (totalCount === 0) {
                 resolve(loadedImages);
                 return;
             }

             this.textures.forEach((textureData, i) => {
                 const metadata = this.textureMetadata[i];
                 
                 if (!metadata) {
                     console.warn(`TextureSet: Missing metadata for texture ${i}`);
                     loadedCount++;
                     if (loadedCount === totalCount) {
                         resolve(loadedImages);
                     }
                     return;
                 }
                 
                 try {
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
                         console.error(`Failed to load texture: ${metadata.name} (index ${i})`);
                         loadedCount++;
                         if (loadedCount === totalCount) {
                             resolve(loadedImages);
                         }
                         URL.revokeObjectURL(url);
                     };
                     img.src = url;
                 } catch (error) {
                     console.error(`Error creating blob for texture ${i}:`, error);
                     loadedCount++;
                     if (loadedCount === totalCount) {
                         resolve(loadedImages);
                     }
                 }
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

        // Default PBR + transmission + volume properties
        const defaults = {
            roughness: 0.8,
            metallic: 0.0,
            ior: 1.5,
            transmission: 0.0,
            volume: {
                thicknessFactor: 0.0,
                attenuationDistance: 1.0,
                attenuationColor: [1, 1, 1]
            }
        };

        // Build properties array - 12 values per texture (3 RGBA32F samples)
        // First RGBA: roughness, metallic, ior, transmission
        // Second RGBA: volumeThickness, volumeAttenuationDistance, volumeColor.r, volumeColor.g
        // Third RGBA: volumeColor.b, reserved, reserved, reserved
        const data = new Float32Array(textureCount * 12);
        for (let i = 0; i < textureCount; i++) {
            const textureName = this.textureMetadata[i]?.name || `texture_${i}`;
            const props = this.materialProperties.get(textureName) || defaults;
            const volume = props.volume || defaults.volume;
            // First sample (RGBA)
            data[i * 12 + 0] = props.roughness;
            data[i * 12 + 1] = props.metallic;
            data[i * 12 + 2] = props.ior;
            data[i * 12 + 3] = props.transmission ?? 0.0;
            // Second sample (RGBA)
            data[i * 12 + 4] = volume.thicknessFactor ?? 0.0;
            data[i * 12 + 5] = volume.attenuationDistance ?? 1.0;
            data[i * 12 + 6] = volume.attenuationColor?.[0] ?? 1.0;
            data[i * 12 + 7] = volume.attenuationColor?.[1] ?? 1.0;
            // Third sample (RGBA)
            data[i * 12 + 8] = volume.attenuationColor?.[2] ?? 1.0;
            data[i * 12 + 9] = 0; // reserved
            data[i * 12 + 10] = 0; // reserved
            data[i * 12 + 11] = 0; // reserved
        }

        // Create 1D texture using tripled width to store 12 channels per texture
        // Format: (textureCount * 3, 1) with RGBA32F
        this.materialPropertiesTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.materialPropertiesTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA32F,
            textureCount * 3,  // Triple width to store 12 channels per texture
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
     * Extract material properties from model triangles (GLB KHR extensions)
     * @private
     */
    _extractMaterialPropertiesFromTriangles(triangles, textureMetadata) {
        // Collect material properties by texture index from all triangles
        const propertiesByIndex = new Map();

        triangles.forEach(triangle => {
            // Find which texture this triangle uses
            let textureIndex = -1;
            if (triangle.material && triangle.material.textureIndex !== undefined) {
                textureIndex = triangle.material.textureIndex;
            }

            if (textureIndex >= 0 && textureIndex < textureMetadata.length) {
                const textureName = textureMetadata[textureIndex]?.name;
                if (!textureName) return;

                // Use the first triangle's properties for this texture
                if (!propertiesByIndex.has(textureName)) {
                    const props = {
                        roughness: triangle.roughness ?? 0.8,
                        metallic: triangle.metallic ?? 0.0,
                        ior: triangle.ior ?? 1.5,
                        transmission: triangle.transmission ?? 0.0
                    };

                    // Add volume properties if present
                    if (triangle.volume) {
                        props.volume = { ...triangle.volume };
                    }
                    if (triangle.sheen) {
                        props.sheen = { ...triangle.sheen };
                    }
                    if (triangle.clearcoat) {
                        props.clearcoat = { ...triangle.clearcoat };
                    }
                    if (triangle.anisotropy) {
                        props.anisotropy = { ...triangle.anisotropy };
                    }
                    if (triangle.dispersion !== undefined) {
                        props.dispersion = triangle.dispersion;
                    }
                    if (triangle.iridescence) {
                        props.iridescence = { ...triangle.iridescence };
                    }

                    propertiesByIndex.set(textureName, props);
                }
            }
        });

        // Store extracted properties
        propertiesByIndex.forEach((props, textureName) => {
            this.materialProperties.set(textureName, props);
        });
    }

    /**
     * Set material properties for a specific texture in this set
     */
    setMaterialProperties(textureIndex, props) {
        this.materialProperties.set(textureIndex, props);
        // Could regenerate material properties texture, but for now just store
    }

    /**
     * Update the material properties texture on the GPU with current CPU-side values
     * Call this after modifying materialProperties via setMaterialProperties
     */
    updateMaterialPropertiesTexture() {
        if (!this.materialPropertiesReady || !this.materialPropertiesTexture) return;

        const gl = this.gl;
        const textureCount = this.textures.length;

        // Default PBR + transmission + volume properties
        const defaults = {
            roughness: 0.8,
            metallic: 0.0,
            ior: 1.5,
            transmission: 0.0,
            volume: {
                thicknessFactor: 0.0,
                attenuationDistance: 1.0,
                attenuationColor: [1, 1, 1]
            }
        };

        // Rebuild properties array with current materialProperties
        // 12 values per texture (3 RGBA32F samples)
        const data = new Float32Array(textureCount * 12);
        for (let i = 0; i < textureCount; i++) {
            const textureName = this.textureMetadata[i]?.name || `texture_${i}`;
            const props = this.materialProperties.get(textureName) || defaults;
            const volume = props.volume || defaults.volume;
            // First sample (RGBA)
            data[i * 12 + 0] = props.roughness;
            data[i * 12 + 1] = props.metallic;
            data[i * 12 + 2] = props.ior;
            data[i * 12 + 3] = props.transmission ?? 0.0;
            // Second sample (RGBA)
            data[i * 12 + 4] = volume.thicknessFactor ?? 0.0;
            data[i * 12 + 5] = volume.attenuationDistance ?? 1.0;
            data[i * 12 + 6] = volume.attenuationColor?.[0] ?? 1.0;
            data[i * 12 + 7] = volume.attenuationColor?.[1] ?? 1.0;
            // Third sample (RGBA)
            data[i * 12 + 8] = volume.attenuationColor?.[2] ?? 1.0;
            data[i * 12 + 9] = 0; // reserved
            data[i * 12 + 10] = 0; // reserved
            data[i * 12 + 11] = 0; // reserved
        }

        // Update texture data on GPU
        gl.bindTexture(gl.TEXTURE_2D, this.materialPropertiesTexture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0, 0,
            textureCount * 3,
            1,
            gl.RGBA,
            gl.FLOAT,
            data
        );
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
