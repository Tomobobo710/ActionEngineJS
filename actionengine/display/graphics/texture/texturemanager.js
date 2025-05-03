// actionengine/display/graphics/texture/texturemanager.js
class TextureManager {
    constructor(gl) {
        this.gl = gl;
        this.isWebGL2 = gl.getParameter(gl.VERSION).includes("WebGL 2.0");
        this.textureArray = this.createTextureArray();
        
        // Create material properties texture
        this.materialPropertiesTexture = this.createMaterialPropertiesTexture();
        
        // Flag to control per-texture material usage
        this.usePerTextureMaterials = true;
    }

    createTextureArray() {
        if (this.isWebGL2) {
            return this.createWebGL2TextureArray();
        } else {
            return this.createWebGL1Texture();
        }
    }

    createWebGL2TextureArray() {
        console.log('[TextureManager] Creating WebGL2 texture array');
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
        console.log('[TextureManager] Creating WebGL1 basic texture (no array support)');
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
        console.log('[TextureManager] Creating material properties texture');
        
        // Create a texture for material properties
        // Each texel contains [roughness, metallic, baseReflectivity, reserved]
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        // Get material properties data from texture registry
        const textureCount = textureRegistry.getTextureCount();
        const data = textureRegistry.getMaterialPropertiesArray();
        
        // Create and set texture data based on WebGL version
        if (this.isWebGL2) {
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
            const ext = gl.getExtension('OES_texture_float');
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
                console.warn('[TextureManager] Float textures not supported by this device. Falling back to global material properties.');
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
        
        // Update the texture with current material properties
        const textureCount = textureRegistry.getTextureCount();
        const data = textureRegistry.getMaterialPropertiesArray();
        
        // Bind and update the texture
        gl.bindTexture(gl.TEXTURE_2D, this.materialPropertiesTexture);
        
        if (this.isWebGL2) {
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
    }
    
    // Toggle per-texture material usage
    togglePerTextureMaterials(enabled) {
        this.usePerTextureMaterials = enabled;
        
        // If enabling and we don't have a material texture, create one
        if (enabled && !this.materialPropertiesTexture) {
            this.materialPropertiesTexture = this.createMaterialPropertiesTexture();
        }
    }
}