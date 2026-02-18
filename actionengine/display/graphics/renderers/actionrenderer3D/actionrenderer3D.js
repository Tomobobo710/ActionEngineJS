// actionengine/display/graphics/renderers/actionrenderer3D/actionrenderer3D.js
class ActionRenderer3D {
    constructor(canvas) {
        // Initialize canvas manager
        this.canvasManager = new CanvasManager3D(canvas);

        // Get GL context from canvas manager
        this.gl = this.canvasManager.getContext();

        // Initialize all managers and renderers
        this.programManager = new ProgramManager(this.gl);

        // Initialize LightManager
        this.lightManager = new LightManager(this.gl, this.programManager);

        // Initialize texture manager
        this.textureManager = new TextureManager(this.gl);
        this.textureArray = this.textureManager.textureArray;

        // Initialize GL state manager
        this.glStateManager = new GLStateManager(this.gl, this.lightManager, this.textureManager);

        // Initialize shadow renderer
        this.shadowRenderer = new ShadowRenderer3D(this.gl, this.lightManager, this.glStateManager);

        this.debugRenderer = new DebugRenderer3D(this.gl, this.programManager, this.lightManager, this.glStateManager);
        this.weatherRenderer = new WeatherRenderer3D(this.gl, this.programManager);
        this.sunRenderer = new SunRenderer3D(this.gl, this.programManager);

        this.objectRenderer = new ObjectRenderer3D(this, this.gl, this.programManager, this.lightManager);
        this.transparentRenderer = new TransparentObjectRenderer3D(this.objectRenderer);
        this.waterRenderer = new WaterRenderer3D(this.gl, this.programManager);
        this.spriteRenderer = new SpriteRenderer3D(this.gl, this.programManager, this.glStateManager);

        // Time tracking
        this.startTime = performance.now();
        this.currentTime = 0;

        // Shadow settings
        this.shadowsEnabled = true; // Enable shadows by default
    }

    render(renderData) {
        const { camera, renderableObjects, showDebugPanel, weatherSystem } = renderData;

        // Initialize the shadow textures before first use
        if (!this._initializedShadows) {
            try {
                // Initialize shadows for all shader types
                this._initShadowsForAllShaders();
                this._initializedShadows = true;
            } catch (error) {
                console.error("Error initializing shadows:", error);
            }
        }

        // Update lights through the light manager
        const lightingChanged = this.lightManager.update();

        // If lighting changed, we need to reinitialize shadows to ensure textures are properly bound
        if (lightingChanged) {
            try {
                this._initShadowsForAllShaders();
            } catch (error) {
                console.error("Error reinitializing shadows after lighting change:", error);
            }
        }

        // No need to update shadow mapping separately - it's now handled by the light manager

        this.currentTime = (performance.now() - this.startTime) / 1000.0;

        // Set clear color from render data or use defaults
        if (renderData.clearColor) {
            this.glStateManager.setClearColor(
                renderData.clearColor.r,
                renderData.clearColor.g,
                renderData.clearColor.b,
                renderData.clearColor.a
            );
        } else {
            // Cache current variant name
            if (!this._cachedVariant) {
                this._cachedVariant = this.programManager.getCurrentVariant();

                // Set clear color based on current variant
                if (this._cachedVariant === "virtualboy") {
                    this.glStateManager.setClearColor(0.0, 0.0, 0.0, 1.0); // Black
                } else {
                    this.glStateManager.setClearColor(0.529, 0.808, 0.922, 1.0); // Original blue
                }
            }

            // Check if shader variant changed
            const currentVariant = this.programManager.getCurrentVariant();
            if (currentVariant !== this._cachedVariant) {
                this._cachedVariant = currentVariant;

                // Update clear color if variant changed
                if (this._cachedVariant === "virtualboy") {
                    this.glStateManager.setClearColor(0.0, 0.0, 0.0, 1.0); // Black
                } else {
                    this.glStateManager.setClearColor(0.529, 0.808, 0.922, 1.0); // Original blue
                }
            }
        }

        // Create empty arrays for different object types
        let waterObjects = [];
        let spriteObjects = [];
        let nonWaterObjects = [];

        // Fast pre-sorting of objects for better performance
        if (renderableObjects?.length) {
            for (const object of renderableObjects) {
                if (typeof Ocean !== "undefined" && object instanceof Ocean) {
                    waterObjects.push(object);
                } else if (object && object.constructor.name === "ActionSprite3D") {
                    // All ActionSprite3D objects go to sprite renderer (billboard and non-billboard)
                    spriteObjects.push(object);
                } else if (object) {
                    nonWaterObjects.push(object);
                }
            }
        }

        // MAIN RENDER PASS
        this.canvasManager.resetToDefaultFramebuffer();
        this.canvasManager.clear();

        // Collect all objects into batch first
        // This will call updateVisual() on each object, ensuring triangles are up-to-date
        for (const object of nonWaterObjects) {
            this.objectRenderer.queue(object, camera, this.currentTime);
        }

        // SHADOW MAP PASS (only if shadows are enabled)
        // Now that objects have been queued and their triangles updated,
        // we can render accurate shadows
        if (this.shadowsEnabled && nonWaterObjects.length > 0) {
            // Render all objects to shadow maps for all lights
            // ShadowRenderer3D handles GL state setup internally
            this.shadowRenderer.render(nonWaterObjects);

            // Ensure we're back to the default framebuffer after shadow rendering
            this.canvasManager.resetToDefaultFramebuffer();

            // Restore the main scene clear color (shadow rendering may have changed it)
            if (renderData.clearColor) {
                this.glStateManager.setClearColor(
                    renderData.clearColor.r,
                    renderData.clearColor.g,
                    renderData.clearColor.b,
                    renderData.clearColor.a
                );
            } else {
                // Use the variant-based default
                if (this._cachedVariant === "virtualboy") {
                    this.glStateManager.setClearColor(0.0, 0.0, 0.0, 1.0); // Black
                } else {
                    this.glStateManager.setClearColor(0.529, 0.808, 0.922, 1.0); // Original blue
                }
            }
        }

        // Prepare for main rendering with shadows
        // Note: Shadow uniform values are now set in ObjectRenderer3D.setupObjectShader()
        // This eliminates redundant getUniformLocation() calls
        if (this.shadowsEnabled) {
            try {
                const program = this.programManager.getObjectProgram();
                if (!program) {
                    console.warn("Cannot setup shadows: shader program not available");
                    return;
                }

                // IMPORTANT: Program must be bound before applying lights
                // applyLightsToShader() calls getUniformLocation() which requires active program
                this.gl.useProgram(program);

                // Apply all lights' uniforms and shadow textures to the shader
                this.lightManager.applyLightsToShader(program, this.glStateManager);
            } catch (error) {
                console.error("Error setting up shadows:", error);
            }
        }

        // Render objects (shadow uniform values now set internally in ObjectRenderer3D)
        this.glStateManager.setupState("object");
        this.objectRenderer.render();

        // Debug visualization if enabled (render before transparent pass)
        if (showDebugPanel && camera) {
            this.glStateManager.setupState("debug");
            const character = renderableObjects?.find(
                (obj) =>
                    obj.constructor.name === "ThirdPersonActionCharacter" || obj.constructor.name === "ActionCharacter"
            );
            this.debugRenderer.drawDebugLines(camera, character, this.currentTime);
        }

        // Render transparent objects (after debug lines)
        this.glStateManager.setupState("transparent");
        this.transparentRenderer.render(camera);

        // Render water objects
        if (waterObjects.length > 0) {
            this.glStateManager.setupState("water");
            for (const object of waterObjects) {
                this.waterRenderer.render(camera, this.currentTime, object);
            }
        }

        // Render weather if it exists
        if (weatherSystem) {
            this.glStateManager.setupState("weather");
            this.weatherRenderer.render(weatherSystem, camera);
        }

        // Draw the sun (only if directional light is enabled)
        if (this.lightManager.isMainDirectionalLightEnabled()) {
            this.glStateManager.setupState("sun");
            const mainLight = this.lightManager.getMainDirectionalLight();
            const lightPos = mainLight ? mainLight.getPosition() : new Vector3(0, 5000, 0);
            const isVirtualBoyMode = this._cachedVariant === "virtualboy";
            this.sunRenderer.render(camera, lightPos, isVirtualBoyMode);
        }

        // Render sprites (ActionSprite3D objects - both billboard and non-billboard)
        if (spriteObjects.length > 0) {
            this.glStateManager.setupState("sprite");
            // Get matrices for sprite rendering
            const projectionMatrix = Matrix4.create();
            const viewMatrix = Matrix4.create();

            // Create projection matrix using same parameters as ObjectRenderer3D for consistent depth values
            const aspectRatio = Game.WIDTH / Game.HEIGHT;
            Matrix4.perspective(
                projectionMatrix,
                camera.fov,
                aspectRatio,
                0.1, // Same near plane as ObjectRenderer3D
                10000.0 // Same far plane as ObjectRenderer3D
            );

            // Create view matrix
            Matrix4.lookAt(viewMatrix, camera.position.toArray(), camera.target.toArray(), camera.up.toArray());

            // Render sprites
            this.spriteRenderer.render(spriteObjects, camera, projectionMatrix, viewMatrix);
        }

        // Shadow map visualization (render last so it's always on top)
        if (lightingConstants.DEBUG.VISUALIZE_SHADOW_MAP && camera) {
            this.glStateManager.setupState("shadowMapDebug");
            this.debugRenderer.drawShadowMapDebug(camera);
        }
    }

    /**
     * Toggle directional light on or off
     * @param {boolean} [enabled] - If provided, explicitly sets directional light on/off
     * @returns {boolean} - Current state of directional light
     */
    toggleDirectionalLight(enabled) {
        // If enabled parameter is provided, use it, otherwise toggle
        if (enabled !== undefined) {
            this.lightManager.setMainDirectionalLightEnabled(enabled);
        } else {
            const currentState = this.lightManager.isMainDirectionalLightEnabled();
            this.lightManager.setMainDirectionalLightEnabled(!currentState);
        }

        // The state may have changed, so ensure shader is updated
        const program = this.programManager.getObjectProgram();
        if (program) {
            // Get current directional light state
            const isEnabled = this.lightManager.isMainDirectionalLightEnabled();
            const hasLight = this.lightManager.getMainDirectionalLight() !== null;

            // Use the shader program
            this.gl.useProgram(program);

            // Set shadows enabled flag based on light status
            const shadowsEnabledLoc = this.gl.getUniformLocation(program, "uShadowsEnabled");
            if (shadowsEnabledLoc !== null) {
                this.gl.uniform1i(shadowsEnabledLoc, isEnabled && hasLight ? 1 : 0);
            }

            // If directional light was just enabled, initialize all shadow-related uniforms
            if (isEnabled && hasLight) {
                this._initShadowsForAllShaders();
            }
        }

        // Return the new state
        return this.lightManager.isMainDirectionalLightEnabled();
    }

    /**
     * Toggle shadows on or off
     */
    toggleShadows() {
        this.shadowsEnabled = !this.shadowsEnabled;
        console.log(`Shadows ${this.shadowsEnabled ? "enabled" : "disabled"}`);

        // Update the current shader program with the new shadow state
        const program = this.programManager.getObjectProgram();
        const variant = this.programManager.getCurrentVariant();

        if (program) {
            // Use the shader program
            this.gl.useProgram(program);

            // Set shadows enabled flag based on current state
            const shadowEnabledLoc = this.gl.getUniformLocation(program, "uShadowsEnabled");
            if (shadowEnabledLoc !== null) {
                this.gl.uniform1i(shadowEnabledLoc, this.shadowsEnabled ? 1 : 0);
                console.log(`Set uShadowsEnabled=${this.shadowsEnabled ? 1 : 0} for ${variant} shader variant`);
            }
        }

        // If re-enabling shadows, make sure the settings are properly reinitialized
        if (this.shadowsEnabled) {
            this._initShadowsForAllShaders();
        }

        return this.shadowsEnabled;
    }

    /**
     * Set shadow quality using presets from constants
     * @param {number} quality - Shadow quality preset index (0-3: low, medium, high, ultra)
     */
    setShadowQuality(quality) {
        const maxPreset = lightingConstants.SHADOW_QUALITY_PRESETS.length - 1;
        if (quality < 0 || quality > maxPreset) {
            console.warn(`Shadow quality must be between 0 and ${maxPreset}`);
            return;
        }

        // Apply the quality preset through the light manager
        this.lightManager.setShadowQuality(quality);

        const presetName = lightingConstants.SHADOW_QUALITY_PRESETS[quality].name;
        console.log(`Shadow quality set to ${presetName}`);
    }

    /**
     * Initialize shadow maps for all shader types
     * This ensures both default and PBR shaders can render shadows
     */
    _initShadowsForAllShaders() {
        const mainLight = this.lightManager.getMainDirectionalLight();
        const pointLight = this.lightManager.pointLights.length > 0 ? this.lightManager.pointLights[0] : null;

        if (mainLight) {
            if (!mainLight.shadowTexture) {
                mainLight.setupShadowMap();
            }
        }

        if (pointLight) {
            if (!pointLight.shadowTexture) {
                pointLight.setupShadowMap();
            }
        }
    }

    /**
     * Debug shadow uniform locations in all shaders
     */
    debugShadowUniforms() {
        // Make sure GL context exists
        if (!this.gl) {
            console.warn("GL context not available for shadow uniform debugging");
            return;
        }
        const gl = this.gl;

        // Get current object shader program
        const program = this.programManager.getObjectProgram();
        const variant = this.programManager.getCurrentVariant();

        if (!program) {
            console.warn("Object shader program not available for debugging");
            return;
        }

        // Check current shader program
        try {
            console.log(`\nChecking shadow uniforms for current shader variant '${variant}':\n`);

            if (program) {
                // Check uniform locations directly
                const shadowMapLoc = gl.getUniformLocation(program, "uShadowMap");
                const lightSpaceMatrixLoc = gl.getUniformLocation(program, "uLightSpaceMatrix");
                const shadowsEnabledLoc = gl.getUniformLocation(program, "uShadowsEnabled");
                const shadowBiasLoc = gl.getUniformLocation(program, "uShadowBias");
                const shadowMapSizeLoc = gl.getUniformLocation(program, "uShadowMapSize");
                const shadowSoftnessLoc = gl.getUniformLocation(program, "uShadowSoftness");
                const pcfSizeLoc = gl.getUniformLocation(program, "uPCFSize");
                const pcfEnabledLoc = gl.getUniformLocation(program, "uPCFEnabled");

                console.log(`Direct check for shader variant '${variant}':\n`);
                console.log("uShadowMap:", shadowMapLoc);
                console.log("uLightSpaceMatrix:", lightSpaceMatrixLoc);
                console.log("uShadowsEnabled:", shadowsEnabledLoc);
                console.log("uShadowBias:", shadowBiasLoc);
                console.log("uShadowMapSize:", shadowMapSizeLoc);
                console.log("uShadowSoftness:", shadowSoftnessLoc);
                console.log("uPCFSize:", pcfSizeLoc);
                console.log("uPCFEnabled:", pcfEnabledLoc);

                // Get active uniforms
                const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
                console.log(`\nActive uniforms for shader variant '${variant}' (${numUniforms} total):\n`);

                for (let i = 0; i < numUniforms; i++) {
                    const uniformInfo = gl.getActiveUniform(program, i);
                    console.log(`${i}: ${uniformInfo.name} (${this.getGLTypeString(uniformInfo.type)})`);
                }
            } else {
                console.log(`Program not available for shader variant '${variant}'`);
            }
        } catch (error) {
            console.error("Error in shadow uniform debugging:", error);
        }
    }

    /**
     * Helper to convert WebGL type enum to string
     */
    getGLTypeString(type) {
        const gl = this.gl;
        const types = {
            [gl.FLOAT]: "FLOAT",
            [gl.FLOAT_VEC2]: "FLOAT_VEC2",
            [gl.FLOAT_VEC3]: "FLOAT_VEC3",
            [gl.FLOAT_VEC4]: "FLOAT_VEC4",
            [gl.INT]: "INT",
            [gl.INT_VEC2]: "INT_VEC2",
            [gl.INT_VEC3]: "INT_VEC3",
            [gl.INT_VEC4]: "INT_VEC4",
            [gl.BOOL]: "BOOL",
            [gl.BOOL_VEC2]: "BOOL_VEC2",
            [gl.BOOL_VEC3]: "BOOL_VEC3",
            [gl.BOOL_VEC4]: "BOOL_VEC4",
            [gl.FLOAT_MAT2]: "FLOAT_MAT2",
            [gl.FLOAT_MAT3]: "FLOAT_MAT3",
            [gl.FLOAT_MAT4]: "FLOAT_MAT4",
            [gl.SAMPLER_2D]: "SAMPLER_2D",
            [gl.SAMPLER_CUBE]: "SAMPLER_CUBE"
        };

        return types[type] || `UNKNOWN_TYPE(${type})`;
    }

    /**
     * Toggle shadow map visualization
     * @param {boolean} [enable] - If provided, explicitly sets visualization on/off
     * @returns {boolean} The new state of shadow map visualization
     */
    toggleShadowMapVisualization(enable) {
        // If enable parameter is provided, use it, otherwise toggle
        if (enable !== undefined) {
            lightingConstants.DEBUG.VISUALIZE_SHADOW_MAP = enable;
        } else {
            lightingConstants.DEBUG.VISUALIZE_SHADOW_MAP = !lightingConstants.DEBUG.VISUALIZE_SHADOW_MAP;
        }

        // When shadow map visualization is enabled, also enable frustum visualization for clarity
        if (lightingConstants.DEBUG.VISUALIZE_SHADOW_MAP) {
            lightingConstants.DEBUG.VISUALIZE_FRUSTUM = true;
        }

        // Reset debug state when enabling shadow map visualization
        if (lightingConstants.DEBUG.VISUALIZE_SHADOW_MAP && this.lightManager) {
            const mainLight = this.lightManager.getMainDirectionalLight();
            if (mainLight) {
                // Reset debug state if needed
            }
        }

        console.log(
            `Shadow map visualization ${lightingConstants.DEBUG.VISUALIZE_SHADOW_MAP ? "enabled" : "disabled"}`
        );
        return lightingConstants.DEBUG.VISUALIZE_SHADOW_MAP;
    }
}
