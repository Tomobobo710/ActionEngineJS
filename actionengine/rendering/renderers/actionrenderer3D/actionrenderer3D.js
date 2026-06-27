//actionengine/rendering/renderers/actionrenderer3D/actionrenderer3D.js
class ActionRenderer3D {
    constructor(canvas) {
        // Initialize canvas manager
        this.canvasManager = new CanvasManager3D(canvas);

        // Get GL context from canvas manager
        this.gl = this.canvasManager.getContext();

        // Initialize all managers and renderers
        this.programManager = new ProgramManager(this.gl);

        // Initialize object renderer first (needed for shadow mesh library)
        this.objectRenderer = new ObjectRenderer3D(this, this.gl, this.programManager, null); // Will set lightManager after

        // Initialize LightManager with object renderer reference for shadow optimization
        this.lightManager = new LightManager(this.gl, this.programManager, this.objectRenderer);

        // Initialize texture manager
        this.textureManager = new TextureManager(this.gl);
        this.textureArray = this.textureManager.textureArray;

        // Initialize GL state manager
        this.glStateManager = new GLStateManager(this.gl, this.lightManager, this.textureManager);

        // Initialize shadow renderer
        this.shadowRenderer = new ShadowRenderer3D(this.gl, this.lightManager, this.glStateManager);

        this.debugRenderer = new DebugRenderer3D(this.gl, this.programManager, this.lightManager, this.glStateManager);
        this.weatherRenderer = new WeatherRenderer3D(this.gl, this.programManager);
        this._sunSprite = this._createSunSprite();

        // ObjectRenderer3D already created above - just update the lightManager reference now
        this.objectRenderer.lightManager = this.lightManager;

        this.transparentRenderer = new TransparentObjectRenderer3D(this.objectRenderer);
        this.waterRenderer = new WaterRenderer3D(this.gl, this.programManager);
        this.spriteRenderer = new SpriteRenderer3D(this.gl, this.programManager, this.glStateManager);

        // Time tracking
        this.startTime = performance.now();
        this.currentTime = 0;

        // Shadow settings
        this.shadowsEnabled = true; // Enable shadows by default
    }

    _createSunSprite() {
        const size = 64;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        g.addColorStop(0.0, "rgba(255, 255, 220, 1.0)");
        g.addColorStop(0.3, "rgba(255, 230, 100, 0.9)");
        g.addColorStop(0.7, "rgba(255, 160, 30, 0.4)");
        g.addColorStop(1.0, "rgba(255, 120, 0, 0.0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        const base64 = canvas.toDataURL("image/png").split(",")[1];
        return new ActionSprite3D({
            base64Data: base64,
            width: 80,
            height: 80,
            billboard: true,
            position: new Vector3(0, 500, 0)
        });
    }

    /**
     * Apply a lighting/auto-shadow profile to this renderer and re-sync the sun. The engine ships the
     * mechanism; the GAME owns its profiles (no built-in scene presets). Accepts an ActionLightingProfile
     * instance or a plain options object.
     *   renderer3D.applyLightingProfile(new ActionLightingProfile({ ... }));
     *   renderer3D.applyLightingProfile({ autoFit:true, range:250, ... }); // convenience: wrapped for you
     * @param {ActionLightingProfile|Object} profile
     * @returns {boolean} true if applied
     */
    applyLightingProfile(profile) {
        if (typeof ActionLightingProfile === "undefined") {
            console.warn("[ActionRenderer3D] ActionLightingProfile not loaded — cannot apply lighting profile.");
            return false;
        }
        const p = profile instanceof ActionLightingProfile ? profile : new ActionLightingProfile(profile);
        return p.applyTo(this);
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

        // Auto-fit the directional shadow frustum to the camera (opt-in via SHADOW_PROJECTION.AUTO_FIT).
        // lightManager.update() already built a light-space matrix from the static constants; when
        // auto-fit is on we recompute it from the camera frustum and overwrite that result.
        if (lightingConstants.SHADOW_PROJECTION.AUTO_FIT && camera && this.lightManager.isMainDirectionalLightEnabled()) {
            const mainLight = this.lightManager.getMainDirectionalLight();
            if (mainLight && mainLight.castsShadows && typeof ActionShadowFit !== "undefined") {
                const csm = lightingConstants.AUTO_SHADOW.CSM;
                const fitOpts = {
                    distance: lightingConstants.SHADOW_PROJECTION.AUTO_FIT_DISTANCE.value,
                    near: camera.near || 1, // start the fit slice at the camera's actual near plane
                    aspect: (this.gl.canvas.width / this.gl.canvas.height) || (Game.WIDTH / Game.HEIGHT), // live canvas, not static constants
                    mapSize: mainLight.shadowMapSize,
                    pullback: lightingConstants.SHADOW_PROJECTION.AUTO_FIT_PULLBACK.value,
                    autoPullback: lightingConstants.SHADOW_PROJECTION.AUTO_PULLBACK,
                    casters: renderableObjects,
                    // auto-shadow fit knobs (single source: lightingConstants.AUTO_SHADOW)
                    depthSlack: lightingConstants.AUTO_SHADOW.DEPTH_SLACK_TEXELS,
                    slopeSlack: lightingConstants.AUTO_SHADOW.SLOPE_SLACK_TEXELS,
                    snap: lightingConstants.AUTO_SHADOW.TEXEL_SNAP,
                    quant: lightingConstants.AUTO_SHADOW.RADIUS_QUANT,
                    padding: lightingConstants.AUTO_SHADOW.PADDING,
                    maxPullback: lightingConstants.AUTO_SHADOW.MAX_AUTO_PULLBACK
                };

                if (csm && csm.ENABLED) {
                    // CSM path: split [near, distance] into cascades, fit each. The light builds a
                    // matrix + per-cascade bias for every slice; the shader picks one by view depth.
                    // CSM has its OWN range (decoupled from the single-map AUTO_FIT_DISTANCE); fall back
                    // to the single-map distance only if it isn't set.
                    if (csm.RANGE) fitOpts.distance = csm.RANGE.value;
                    fitOpts.count = Math.min(csm.COUNT.value, csm.MAX);
                    fitOpts.lambda = csm.LAMBDA.value;
                    // Manual split override (Unity-style): fractions of the range where each cascade ends.
                    fitOpts.manualSplits = csm.MANUAL_SPLITS;
                    if (csm.SPLITS) fitOpts.splits = csm.SPLITS.map((s) => s.value);
                    const result = ActionShadowFit.fitCascades(camera, mainLight.getDirection(), fitOpts);
                    if (result) {
                        mainLight.csmEnabled = true;
                        mainLight.updateCascades(result);
                    } else {
                        mainLight.csmEnabled = false; // degenerate fit — don't render with stale cascades
                    }
                } else {
                    // Single-map path (CSM off): one fitted box, as before.
                    mainLight.csmEnabled = false;
                    const fit = ActionShadowFit.fitDirectional(camera, mainLight.getDirection(), fitOpts);
                    if (fit) {
                        mainLight.updateLightSpaceMatrix(fit);
                        mainLight.shadowBias = fit.bias; // flat bias auto-scaled to the fitted depth range
                        mainLight.shadowSlopeBias = fit.slopeBias; // slope bias base, same currency
                        mainLight.shadowNormalOffset = fit.texel * lightingConstants.AUTO_SHADOW.NORMAL_SLACK_TEXELS; // world normal-offset
                    }
                }
            }
        }

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

        // SHADOW-ONLY CASTERS (opt-in). Objects that should cast into the shadow maps but NOT be
        // drawn in the color pass — e.g. the first-person player model: we want it to self-shadow the
        // arms/weapon and drop a ground shadow exactly like the third-person body does, without
        // rendering the body from inside our own head. They're appended to the shadow caster list
        // only; their triangles are refreshed here since they skip the color-pass queue that
        // normally does it.
        const shadowCasters = renderData.shadowCasters && renderData.shadowCasters.length ? renderData.shadowCasters : null;
        if (shadowCasters) {
            // Register each caster's mesh in the GPU library so the shadow pass (which looks meshes up
            // by id) can find it — WITHOUT queuing it for the color pass, so it never draws.
            for (const o of shadowCasters) this.objectRenderer.ensureMeshRegistered(o);
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
        if (this.shadowsEnabled && (nonWaterObjects.length > 0 || shadowCasters)) {
            // Render all objects to shadow maps for all lights
            // ShadowRenderer3D handles GL state setup internally. Shadow-only casters ride along here
            // (cast) but were never queued for color (not drawn).
            this.shadowRenderer.render(shadowCasters ? nonWaterObjects.concat(shadowCasters) : nonWaterObjects);

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
        try {
            const program = this.programManager.getObjectProgram();
            if (program) {
                this.gl.useProgram(program);
                this.lightManager.applyLightsToShader(program, this.glStateManager);
            }
        } catch (error) {
            console.error("Error setting up lights:", error);
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

        // Caller-supplied debug segments (e.g. physics AABB wireframes). Drawn with the line shader,
        // independent of the shadow debug panel so a game can toggle it on its own key.
        if (camera && renderData.debugLines && renderData.debugLines.length) {
            this.glStateManager.setupState("debug");
            this.debugRenderer.drawSegments(renderData.debugLines, camera, this.currentTime);
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
        if (this.lightManager.isMainDirectionalLightEnabled() && this._sunSprite) {
            const d = lightingConstants.LIGHT_DIRECTION;
            const len = Math.sqrt(d.x*d.x + d.y*d.y + d.z*d.z) || 1;
            // Direction-only: place sun at fixed distance from origin (no camera offset) so it
            // never clips and has no parallax. View matrix strips translation to match.
            const SUN_DIST = 500;
            this._sunSprite.transform.position = new Vector3(
                (-d.x / len) * SUN_DIST,
                (-d.y / len) * SUN_DIST,
                (-d.z / len) * SUN_DIST
            );
            this._sunSprite.color = this._cachedVariant === "virtualboy" ? [1, 0, 0] : [1.0, 0.95, 0.6];

            const sunProj = Matrix4.create();
            Matrix4.perspective(sunProj, camera.fov, Game.WIDTH / Game.HEIGHT, 0.1, 1000.0);
            const camTarget = camera.target.toArray();
            const camPos = camera.position.toArray();
            const sunView = Matrix4.create();
            Matrix4.lookAt(sunView, [0, 0, 0], [
                camTarget[0] - camPos[0],
                camTarget[1] - camPos[1],
                camTarget[2] - camPos[2]
            ], camera.up.toArray());

            this.glStateManager.setupState("sun");
            this.spriteRenderer.render([this._sunSprite], camera, sunProj, sunView);
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

        // FPS VIEWMODEL PASS (ADDITIVE / OPT-IN).
        // Only runs when a caller passes renderData.viewmodelObjects. Draws those objects
        // on top of the scene with a cleared depth buffer and a closer near plane so a
        // held weapon never clips into world geometry. Scenes that don't pass viewmodel
        // objects are completely unaffected.
        if (camera && renderData.viewmodelObjects && renderData.viewmodelObjects.length > 0) {
            this.glStateManager.setupState("object");
            this.objectRenderer.renderViewmodels(renderData.viewmodelObjects, camera, renderData.viewmodelOptions || {});
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
