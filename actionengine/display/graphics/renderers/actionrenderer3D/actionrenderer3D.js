// actionengine/display/graphics/renderers/actionrenderer3D/actionrenderer3D.js
class ActionRenderer3D {
    constructor(canvas) {
        // Initialize canvas manager
        this.canvasManager = new CanvasManager3D(canvas);

        // Get GL context from canvas manager
        this.gl = this.canvasManager.getContext();

        // Initialize all managers and renderers
        this.programManager = new ProgramManager(this.gl, this.canvasManager.isWebGL2());
        
        // Use the new LightManager instead of separate lighting and shadow managers
        this.lightManager = new LightManager(this.gl, this.canvasManager.isWebGL2(), this.programManager);

        this.debugRenderer = new DebugRenderer3D(this.gl, this.programManager, this.lightManager);
        this.weatherRenderer = new WeatherRenderer3D(this.gl, this.programManager);
        this.sunRenderer = new SunRenderer3D(this.gl, this.programManager);
        // Create texture manager and texture array before other renderers
        this.textureManager = new TextureManager(this.gl);
        this.textureArray = this.textureManager.textureArray;
        
        this.objectRenderer = new ObjectRenderer3D(this, this.gl, this.programManager, this.lightManager);
        this.waterRenderer = new WaterRenderer3D(this.gl, this.programManager);
        
        // Time tracking
        this.startTime = performance.now();
        this.currentTime = 0;
        
        // Shadow settings
        this.shadowsEnabled = true; // Enable shadows by default
    }

    render(renderData) {
        const {
            camera,
            renderableObjects,
            showDebugPanel,
            weatherSystem
        } = renderData;
        
        // Initialize the shadow textures before first use
        if (!this._initializedShadows) {
            try {
                // Initialize shadows for all shader types
                this._initShadowsForAllShaders();
                this._initializedShadows = true;
            } catch (error) {
                console.error('Error initializing shadows:', error);
            }
        }
        
        // Update lights through the light manager
        const lightingChanged = this.lightManager.update();
        
        // If lighting changed, we need to reinitialize shadows to ensure textures are properly bound
        if (lightingChanged) {
            try {
                this._initShadowsForAllShaders();
            } catch (error) {
                console.error('Error reinitializing shadows after lighting change:', error);
            }
        }
        
        // No need to update shadow mapping separately - it's now handled by the light manager
        
        this.currentTime = (performance.now() - this.startTime) / 1000.0;

        // Cache current variant name
        if (!this._cachedVariant) {
            this._cachedVariant = this.programManager.getCurrentVariant();
            
            // Set clear color based on current variant
            if (this._cachedVariant === "virtualboy") {
                this.canvasManager.setClearColor(0.0, 0.0, 0.0, 1.0); // Black
            } else {
                this.canvasManager.setClearColor(0.529, 0.808, 0.922, 1.0); // Original blue
            }
        }
        
        // Check if shader variant changed
        const currentVariant = this.programManager.getCurrentVariant();
        if (currentVariant !== this._cachedVariant) {
            this._cachedVariant = currentVariant;
            
            // Update clear color if variant changed
            if (this._cachedVariant === "virtualboy") {
                this.canvasManager.setClearColor(0.0, 0.0, 0.0, 1.0); // Black
            } else {
                this.canvasManager.setClearColor(0.529, 0.808, 0.922, 1.0); // Original blue
            }
        }

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
            this.lightManager.renderShadowMaps(nonWaterObjects);
            
            // Ensure we're back to the default framebuffer after shadow rendering
            this.canvasManager.resetToDefaultFramebuffer();
        }
        
        // Prepare for main rendering with shadows
        if (this.shadowsEnabled) {
            try {
                // Get the current shader program
                const program = this.programManager.getObjectProgram();
                if (!program) {
                    console.warn('Cannot setup shadows: shader program not available');
                    return;
                }
                
                // Use the shader program
                this.gl.useProgram(program);
                
                // Apply all lights to the shader with texture binding persistence
                // First, make sure we re-bind the shadow textures to their units
                const SHADOW_MAP_TEXTURE_UNIT = 4;
                const POINT_SHADOW_TEXTURE_UNIT = 3;
                
                // Get main directional light and point light
                const mainLight = this.lightManager.getMainDirectionalLight();
                const pointLight = this.lightManager.pointLights.length > 0 ? this.lightManager.pointLights[0] : null;
                
                // Ensure directional shadow map is bound
                if (mainLight && mainLight.shadowTexture) {
                    this.gl.activeTexture(this.gl.TEXTURE0 + SHADOW_MAP_TEXTURE_UNIT);
                    this.gl.bindTexture(this.gl.TEXTURE_2D, mainLight.shadowTexture);
                }
                
                // Ensure point light shadow map is bound
                if (pointLight && pointLight.shadowTexture) {
                    this.gl.activeTexture(this.gl.TEXTURE0 + POINT_SHADOW_TEXTURE_UNIT);
                    if (this.canvasManager.isWebGL2()) {
                        this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, pointLight.shadowTexture);
                    } else if (pointLight.shadowTextures && pointLight.shadowTextures.length > 0) {
                        this.gl.bindTexture(this.gl.TEXTURE_2D, pointLight.shadowTextures[0]);
                    }
                }
                
                // Now apply all lights' uniforms to the shader
                this.lightManager.applyLightsToShader(program);
                
                // Get shadow-specific uniform locations
                const uniformShadowSoftness = this.gl.getUniformLocation(program, 'uShadowSoftness');
                const uniformPCFSize = this.gl.getUniformLocation(program, 'uPCFSize');
                const uniformPCFEnabled = this.gl.getUniformLocation(program, 'uPCFEnabled');
                
                // Set shadow softness uniform
                if (uniformShadowSoftness !== null) {
                    const softness = this.lightManager.constants.SHADOW_FILTERING.SOFTNESS.value;
                    this.gl.uniform1f(uniformShadowSoftness, softness);
                }
                
                // Set PCF size uniform
                if (uniformPCFSize !== null) {
                    const pcfSize = this.lightManager.constants.SHADOW_FILTERING.PCF.SIZE.value;
                    this.gl.uniform1i(uniformPCFSize, pcfSize);
                }
                
                // Set PCF enabled uniform
                if (uniformPCFEnabled !== null) {
                    const pcfEnabled = this.lightManager.constants.SHADOW_FILTERING.PCF.ENABLED ? 1 : 0;
                    this.gl.uniform1i(uniformPCFEnabled, pcfEnabled);
                }
            } catch (error) {
                console.error('Error setting up shadows:', error);
            }
        }
        
        // Then render everything in one batch
        this.objectRenderer.render();
        
        // Then render water objects last
        for (const object of waterObjects) {
            this.waterRenderer.render(camera, this.currentTime, object);
        }

        // Render weather if it exists
        if (weatherSystem) {
            this.weatherRenderer.render(weatherSystem, camera);
        }

        // Draw the sun (only if directional light is enabled)
        if (this.lightManager.isMainDirectionalLightEnabled()) {
            const mainLight = this.lightManager.getMainDirectionalLight();
            const lightPos = mainLight ? mainLight.getPosition() : new Vector3(0, 5000, 0);
            const isVirtualBoyMode = (this._cachedVariant === "virtualboy");
            this.sunRenderer.render(camera, lightPos, isVirtualBoyMode);
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
            const shadowsEnabledLoc = this.gl.getUniformLocation(program, 'uShadowsEnabled');
            if (shadowsEnabledLoc !== null) {
                this.gl.uniform1i(shadowsEnabledLoc, (isEnabled && hasLight) ? 1 : 0);
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
        console.log(`Shadows ${this.shadowsEnabled ? 'enabled' : 'disabled'}`);
        
        // Update the current shader program with the new shadow state
        const program = this.programManager.getObjectProgram();
        const variant = this.programManager.getCurrentVariant();
        
        if (program) {
            // Use the shader program
            this.gl.useProgram(program);
            
            // Set shadows enabled flag based on current state
            const shadowEnabledLoc = this.gl.getUniformLocation(program, 'uShadowsEnabled');
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
        console.log("_initShadowsForAllShaders called");
        // Constant for shadow texture unit
        const SHADOW_MAP_TEXTURE_UNIT = 4;
        const POINT_SHADOW_TEXTURE_UNIT = 3; // Point shadows use texture unit 3
        
        // Get main directional light
        const mainLight = this.lightManager.getMainDirectionalLight();
        
        // Always check for point lights regardless of directional light existence
        const pointLight = this.lightManager.pointLights.length > 0 ? this.lightManager.pointLights[0] : null;
        
        // Only proceed with directional light stuff if it exists
        if (mainLight) {
            // Verify that the light and its texture are properly initialized
            if (!mainLight.shadowTexture) {
                console.log("Reinitializing shadow map for directional light");
                mainLight.setupShadowMap();
            }
            
            // Pre-bind the directional shadow map texture to unit 4
            this.gl.activeTexture(this.gl.TEXTURE0 + SHADOW_MAP_TEXTURE_UNIT);
            // Force unbind texture first to ensure complete refresh  
            this.gl.bindTexture(this.gl.TEXTURE_2D, null);
            // Now bind the shadow texture - this ensures proper rebinding when toggling
            this.gl.bindTexture(this.gl.TEXTURE_2D, mainLight.shadowTexture);
            console.log("Bound directional light shadow texture to unit 4");
        }
        
        // Now set up point light shadow if available
        if (pointLight) {
            // Verify the point light texture is present
            if (!pointLight.shadowTexture) {
                console.log("Initializing shadow map for point light");
                pointLight.setupShadowMap();
            }
            
            // Pre-bind the point light shadow cubemap texture to unit 3
            this.gl.activeTexture(this.gl.TEXTURE0 + POINT_SHADOW_TEXTURE_UNIT);
            
            // Force unbind to ensure complete refresh
            if (this.isWebGL2) {
                this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, null);
                // For WebGL2, bind as CUBE_MAP
                this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, pointLight.shadowTexture);
                console.log("Bound point light shadow cubemap texture to unit 3");
            } else {
                // For WebGL1, we have individual textures
                this.gl.bindTexture(this.gl.TEXTURE_2D, null);
                if (pointLight.shadowTextures && pointLight.shadowTextures.length > 0) {
                    this.gl.bindTexture(this.gl.TEXTURE_2D, pointLight.shadowTextures[0]);
                    console.log("Bound point light shadow texture (face 0) to unit 3 (WebGL1)");
                }
            }
        }
        
        // Previous code already bound the point light texture if available
        
        // For now, we just need to initialize the current shader variant
        const currentProgram = this.programManager.getObjectProgram();
        
        // Initialize shadows for current program
        if (currentProgram) {
            // Use this shader program
            this.gl.useProgram(currentProgram);
            
            // === DIRECTIONAL LIGHT UNIFORMS ===
            if (mainLight) {
                // Get shadow uniforms for directional light
                const shadowMapLoc = this.gl.getUniformLocation(currentProgram, 'uShadowMap');
                const shadowEnabledLoc = this.gl.getUniformLocation(currentProgram, 'uShadowsEnabled');
                const lightSpaceMatrixLoc = this.gl.getUniformLocation(currentProgram, 'uLightSpaceMatrix');
                
                // Set shadow map texture uniform
                if (shadowMapLoc !== null) {
                    this.gl.uniform1i(shadowMapLoc, SHADOW_MAP_TEXTURE_UNIT);
                    console.log("Set uShadowMap to texture unit", SHADOW_MAP_TEXTURE_UNIT);
                }
                
                // Set shadow enabled flag
                if (shadowEnabledLoc !== null) {
                    this.gl.uniform1i(shadowEnabledLoc, 1);
                    console.log("Set uShadowsEnabled to 1");
                }
                
                // Set initial light space matrix if available
                if (lightSpaceMatrixLoc !== null) {
                    const lightSpaceMatrix = this.lightManager.getLightSpaceMatrix();
                    if (lightSpaceMatrix) {
                        this.gl.uniformMatrix4fv(lightSpaceMatrixLoc, false, lightSpaceMatrix);
                    }
                }
            } else {
                // If no directional light, explicitly disable shadows
                const shadowEnabledLoc = this.gl.getUniformLocation(currentProgram, 'uShadowsEnabled');
                if (shadowEnabledLoc !== null) {
                    this.gl.uniform1i(shadowEnabledLoc, 0);
                    console.log("Set uShadowsEnabled to 0 - no directional light");
                }
            }
            
            // === POINT LIGHT UNIFORMS ===
            if (pointLight) {
                // Get point light shadow uniforms
                const pointShadowMapLoc = this.gl.getUniformLocation(currentProgram, 'uPointShadowMap');
                const pointShadowsEnabledLoc = this.gl.getUniformLocation(currentProgram, 'uPointShadowsEnabled');
                const pointLightCountLoc = this.gl.getUniformLocation(currentProgram, 'uPointLightCount');
                const farPlaneLoc = this.gl.getUniformLocation(currentProgram, 'uFarPlane');
                
                // Set point light count
                if (pointLightCountLoc !== null) {
                    this.gl.uniform1i(pointLightCountLoc, 1); // We have one point light
                    console.log("Set uPointLightCount to 1");
                }
                
                // Set point shadow map texture uniform
                if (pointShadowMapLoc !== null) {
                    this.gl.uniform1i(pointShadowMapLoc, POINT_SHADOW_TEXTURE_UNIT);
                    console.log("Set uPointShadowMap to texture unit", POINT_SHADOW_TEXTURE_UNIT);
                }
                
                // Set point shadows enabled flag
                if (pointShadowsEnabledLoc !== null) {
                    this.gl.uniform1i(pointShadowsEnabledLoc, 1); // Enable point light shadows
                    console.log("Set uPointShadowsEnabled to 1");
                }
                
                // Set far plane for point light shadow mapping
                if (farPlaneLoc !== null) {
                    this.gl.uniform1f(farPlaneLoc, 500.0); // Match the value in pointLight.applyToShader
                    console.log("Set uFarPlane to 500.0");
                }
            } else {
                // No point light, set count to 0
                const pointLightCountLoc = this.gl.getUniformLocation(currentProgram, 'uPointLightCount');
                if (pointLightCountLoc !== null) {
                    this.gl.uniform1i(pointLightCountLoc, 0);
                    console.log("Set uPointLightCount to 0 - no point light");
                }
            }
            
            // === COMMON SHADOW PARAMETERS ===
            // These apply to both directional and point lights
            const shadowBiasLoc = this.gl.getUniformLocation(currentProgram, 'uShadowBias');
            const shadowMapSizeLoc = this.gl.getUniformLocation(currentProgram, 'uShadowMapSize');
            const shadowSoftnessLoc = this.gl.getUniformLocation(currentProgram, 'uShadowSoftness');
            const pcfSizeLoc = this.gl.getUniformLocation(currentProgram, 'uPCFSize');
            const pcfEnabledLoc = this.gl.getUniformLocation(currentProgram, 'uPCFEnabled');
            
            // Set shadow bias
            if (shadowBiasLoc !== null) {
                this.gl.uniform1f(shadowBiasLoc, this.lightManager.getShadowBias());
            }
            
            // Set shadow map size
            if (shadowMapSizeLoc !== null) {
                this.gl.uniform1f(shadowMapSizeLoc, this.lightManager.getShadowMapSize());
            }
            
            // Set shadow softness
            if (shadowSoftnessLoc !== null) {
                const softness = this.lightManager.constants.SHADOW_FILTERING.SOFTNESS.value;
                this.gl.uniform1f(shadowSoftnessLoc, softness);
            }
            
            // Set PCF size
            if (pcfSizeLoc !== null) {
                const pcfSize = this.lightManager.constants.SHADOW_FILTERING.PCF.SIZE.value;
                this.gl.uniform1i(pcfSizeLoc, pcfSize);
            }
            
            // Set PCF enabled
            if (pcfEnabledLoc !== null) {
                const pcfEnabled = this.lightManager.constants.SHADOW_FILTERING.PCF.ENABLED ? 1 : 0;
                this.gl.uniform1i(pcfEnabledLoc, pcfEnabled);
            }
        }
    }
    
    
    /**
     * Debug shadow uniform locations in all shaders
     */
    debugShadowUniforms() {
        // Make sure GL context exists
        if (!this.gl) {
            console.warn('GL context not available for shadow uniform debugging');
            return;
        }
        const gl = this.gl;
        
        // Get current object shader program
        const program = this.programManager.getObjectProgram();
        const variant = this.programManager.getCurrentVariant();
        
        if (!program) {
            console.warn('Object shader program not available for debugging');
            return;
        }
        
        // Check current shader program
        try {
            console.log(`\nChecking shadow uniforms for current shader variant '${variant}':\n`);
            
            if (program) {
                // Check uniform locations directly
                const shadowMapLoc = gl.getUniformLocation(program, 'uShadowMap');
                const lightSpaceMatrixLoc = gl.getUniformLocation(program, 'uLightSpaceMatrix');
                const shadowsEnabledLoc = gl.getUniformLocation(program, 'uShadowsEnabled');
                const shadowBiasLoc = gl.getUniformLocation(program, 'uShadowBias');
                const shadowMapSizeLoc = gl.getUniformLocation(program, 'uShadowMapSize');
                const shadowSoftnessLoc = gl.getUniformLocation(program, 'uShadowSoftness');
                const pcfSizeLoc = gl.getUniformLocation(program, 'uPCFSize');
                const pcfEnabledLoc = gl.getUniformLocation(program, 'uPCFEnabled');
                
                console.log(`Direct check for shader variant '${variant}':\n`);
                console.log('uShadowMap:', shadowMapLoc);
                console.log('uLightSpaceMatrix:', lightSpaceMatrixLoc);
                console.log('uShadowsEnabled:', shadowsEnabledLoc);
                console.log('uShadowBias:', shadowBiasLoc);
                console.log('uShadowMapSize:', shadowMapSizeLoc);
                console.log('uShadowSoftness:', shadowSoftnessLoc);
                console.log('uPCFSize:', pcfSizeLoc);
                console.log('uPCFEnabled:', pcfEnabledLoc);
                
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
            console.error('Error in shadow uniform debugging:', error);
        }
    }
    
    /**
     * Helper to convert WebGL type enum to string
     */
    getGLTypeString(type) {
        const gl = this.gl;
        const types = {
            [gl.FLOAT]: 'FLOAT',
            [gl.FLOAT_VEC2]: 'FLOAT_VEC2',
            [gl.FLOAT_VEC3]: 'FLOAT_VEC3',
            [gl.FLOAT_VEC4]: 'FLOAT_VEC4',
            [gl.INT]: 'INT',
            [gl.INT_VEC2]: 'INT_VEC2',
            [gl.INT_VEC3]: 'INT_VEC3',
            [gl.INT_VEC4]: 'INT_VEC4',
            [gl.BOOL]: 'BOOL',
            [gl.BOOL_VEC2]: 'BOOL_VEC2',
            [gl.BOOL_VEC3]: 'BOOL_VEC3',
            [gl.BOOL_VEC4]: 'BOOL_VEC4',
            [gl.FLOAT_MAT2]: 'FLOAT_MAT2',
            [gl.FLOAT_MAT3]: 'FLOAT_MAT3',
            [gl.FLOAT_MAT4]: 'FLOAT_MAT4',
            [gl.SAMPLER_2D]: 'SAMPLER_2D',
            [gl.SAMPLER_CUBE]: 'SAMPLER_CUBE'
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
        
        console.log(`Shadow map visualization ${lightingConstants.DEBUG.VISUALIZE_SHADOW_MAP ? 'enabled' : 'disabled'}`);
        return lightingConstants.DEBUG.VISUALIZE_SHADOW_MAP;
    }
}