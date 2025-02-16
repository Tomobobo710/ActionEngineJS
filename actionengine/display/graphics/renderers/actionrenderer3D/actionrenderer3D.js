// actionengine/display/graphics/renderers/actionrenderer3D/actionrenderer3D.js
class ActionRenderer3D {
    constructor(canvas) {
        // Initialize canvas manager
        this.canvasManager = new CanvasManager3D(canvas);

        // Get GL context from canvas manager
        this.gl = this.canvasManager.getContext();

        // Initialize all managers and renderers
        this.programManager = new ProgramManager(this.gl, this.canvasManager.isWebGL2());
        this.lightingManager = new LightingManager(this.gl, this.canvasManager.isWebGL2());
        this.debugRenderer = new DebugRenderer3D(this.gl, this.programManager, this.lightingManager);
        this.weatherRenderer = new WeatherRenderer3D(this.gl, this.programManager);
        this.terrainRenderer = new TerrainRenderer3D(this, this.gl, this.programManager, this.lightingManager);
        this.characterRenderer = new CharacterRenderer3D(this.gl, this.programManager, this.lightingManager);
        this.objectRenderer = new ObjectRenderer3D(this, this.gl, this.programManager, this.lightingManager);
        // Get program registry reference
        this.programRegistry = this.programManager.getProgramRegistry();
        this.waterRenderer = new WaterRenderer3D(this.gl, this.programManager);
        this.textureManager = new TextureManager(this.gl);
        // Time tracking
        this.startTime = performance.now();
        this.currentTime = 0;
    }

    render(renderData) {
        const {
            terrainBuffers,
            terrainIndexCount,
            characterBuffers,
            characterIndexCount,
            renderableBuffers,
            renderableIndexCount,
            camera,
            character,
            renderableObjects,
            showDebugPanel,
            weatherSystem
        } = renderData;

        // Update lighting and time
        this.lightingManager.update();
        this.currentTime = (performance.now() - this.startTime) / 1000.0;

        // Get current shader set
        const shaderSet = this.programRegistry.getCurrentShaderSet();

        if (shaderSet === this.programRegistry.shaders.get("virtualboy")) {
            this.canvasManager.setClearColor(0.0, 0.0, 0.0, 1.0); // Black
        } else {
            this.canvasManager.setClearColor(0.529, 0.808, 0.922, 1.0); // Original blue
        }

        // SHADOW PASS
        if (shaderSet === this.programRegistry.shaders.get("pbr")) {
            this.canvasManager.bindFramebuffer(this.lightingManager.getShadowFramebuffer());
            this.canvasManager.setViewport(
                this.lightingManager.getShadowMapSize(),
                this.lightingManager.getShadowMapSize()
            );
            this.canvasManager.clear();

            this.gl.useProgram(shaderSet.shadow.program);

            // Render terrain shadows if terrain exists
            if (terrainBuffers && terrainIndexCount) {
                this.terrainRenderer.renderShadowPass(terrainBuffers, terrainIndexCount, shaderSet);
            }

            // Render character shadows if character exists
            if (character && characterBuffers && characterIndexCount) {
                this.characterRenderer.renderShadowPass(character, characterBuffers, characterIndexCount, shaderSet);
            }

            // Render renderable object shadows if they exist
            if (renderableObjects?.length && renderableBuffers && renderableIndexCount) {
                for (const object of renderableObjects) {
                    if (object) {
                        this.objectRenderer.renderShadowPass(
                            object,
                            renderableBuffers,
                            renderableIndexCount,
                            shaderSet
                        );
                    }
                }
            }
        }

        // MAIN RENDER PASS
        this.canvasManager.resetToDefaultFramebuffer();
        this.canvasManager.clear();

        // Render terrain if it exists
        if (terrainBuffers && terrainIndexCount) {
            this.terrainRenderer.render(terrainBuffers, terrainIndexCount, camera, shaderSet, this.currentTime);
        }

        // Render character if it exists
        if (character && characterBuffers && characterIndexCount) {
            this.characterRenderer.render(
                character,
                characterBuffers,
                characterIndexCount,
                camera,
                shaderSet,
                this.currentTime
            );
        }

        // Render objects if they exist
        // First render all non-water objects
if (renderableObjects?.length) {
    for (const object of renderableObjects) {
        if (!(object instanceof Ocean) && object) {
            this.objectRenderer.render(object, renderData.camera, shaderSet, this.currentTime);
        }
    }
}

// Then render water objects last
if (renderableObjects?.length) {
    for (const object of renderableObjects) {
        if (object instanceof Ocean) {
            this.waterRenderer.render(renderData.camera, this.currentTime, object);
        }
    }
}

        // Render weather if it exists
        if (weatherSystem) {
            this.weatherRenderer.render(weatherSystem, camera);
        }

        // Debug visualization if enabled
        if (showDebugPanel) {
            if (camera) {
                this.debugRenderer.drawDebugLines(camera, character, this.currentTime);
            }
            this.debugRenderer.drawDebugShadowMap();
        }
    }
}

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