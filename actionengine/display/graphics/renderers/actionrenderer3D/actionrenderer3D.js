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
        if (renderableObjects?.length && renderableBuffers && renderableIndexCount) {
            for (const object of renderableObjects) {
                if (object) {
                    this.objectRenderer.render(object, camera, shaderSet, this.currentTime);
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