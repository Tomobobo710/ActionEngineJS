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
        // Create texture array before other renderers
        this.textureManager = new TextureManager(this.gl);
        this.textureArray = this.textureManager.textureArray;
        
        this.objectRenderer = new ObjectRenderer3D(this, this.gl, this.programManager, this.lightingManager);
        // Get program registry reference
        this.programRegistry = this.programManager.getProgramRegistry();
        this.waterRenderer = new WaterRenderer3D(this.gl, this.programManager);
        // Time tracking
        this.startTime = performance.now();
        this.currentTime = 0;
    }

    render(renderData) {
        const {
            camera,
            renderableObjects,
            showDebugPanel,
            weatherSystem
        } = renderData;
        
        // Performance optimization: only update lighting every N frames
        if (!this._frameCounter) this._frameCounter = 0;
        this._frameCounter++;
        
        if (this._frameCounter % 5 === 0) { // Update every 5 frames
            this.lightingManager.update();
        }
        
        this.currentTime = (performance.now() - this.startTime) / 1000.0;

        // Cache shader set between frames
        if (!this._cachedShaderSet) {
            this._cachedShaderSet = this.programRegistry.getCurrentShaderSet();
            
            // Set clear color based on shader
            if (this._cachedShaderSet === this.programRegistry.shaders.get("virtualboy")) {
                this.canvasManager.setClearColor(0.0, 0.0, 0.0, 1.0); // Black
            } else {
                this.canvasManager.setClearColor(0.529, 0.808, 0.922, 1.0); // Original blue
            }
        }
        
        // Check if shader changed
        const currentShaderSet = this.programRegistry.getCurrentShaderSet();
        if (currentShaderSet !== this._cachedShaderSet) {
            this._cachedShaderSet = currentShaderSet;
            
            // Update clear color if shader changed
            if (this._cachedShaderSet === this.programRegistry.shaders.get("virtualboy")) {
                this.canvasManager.setClearColor(0.0, 0.0, 0.0, 1.0); // Black
            } else {
                this.canvasManager.setClearColor(0.529, 0.808, 0.922, 1.0); // Original blue
            }
        }

        // MAIN RENDER PASS
        this.canvasManager.resetToDefaultFramebuffer();
        this.canvasManager.clear();
        
        // Create empty array for water objects if they exist
        let waterObjects = [];
        let nonWaterObjects = [];
        
        // Fast pre-sorting of objects for better performance
        if (renderableObjects?.length) {
            for (const object of renderableObjects) {
                if (typeof Ocean !== 'undefined' && object instanceof Ocean) {
                    waterObjects.push(object);
                } else if (object) {
                    nonWaterObjects.push(object);
                }
            }
        }

        // Collect all objects into batch first
        for (const object of nonWaterObjects) {
            this.objectRenderer.render(object, camera, this._cachedShaderSet, this.currentTime);
        }
        
        // Then render everything in one batch
        this.objectRenderer.renderBatch();
        
        // Then render water objects last
        for (const object of waterObjects) {
            this.waterRenderer.render(camera, this.currentTime, object);
        }

        // Render weather if it exists
        if (weatherSystem) {
            this.weatherRenderer.render(weatherSystem, camera);
        }

        // Debug visualization if enabled
        if (showDebugPanel && camera) {
            // Find character in renderableObjects for debug visualization
            const character = renderableObjects?.find(obj => 
                obj.constructor.name === 'ThirdPersonActionCharacter' || 
                obj.constructor.name === 'ActionCharacter'
            );
            this.debugRenderer.drawDebugLines(camera, character, this.currentTime);
        }
    }
}