// actionengine/display/graphics/texture/texturemanager.js
class TextureManager {
    constructor(gl) {
        this.gl = gl;
        this.textureArray = this.createTextureArray();
    }

    createTextureArray() {
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
}