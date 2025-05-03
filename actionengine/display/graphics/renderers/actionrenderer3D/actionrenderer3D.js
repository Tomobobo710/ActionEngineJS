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
        
        // Add shadow manager
        this.shadowManager = new ShadowManager(this.gl, this.programManager, this.canvasManager.isWebGL2());
        
        this.debugRenderer = new DebugRenderer3D(this.gl, this.programManager, this.lightingManager, this.shadowManager);
        this.weatherRenderer = new WeatherRenderer3D(this.gl, this.programManager);
        this.sunRenderer = new SunRenderer3D(this.gl, this.programManager);
        // Create texture manager and texture array before other renderers
        this.textureManager = new TextureManager(this.gl);
        this.textureArray = this.textureManager.textureArray;
        
        this.objectRenderer = new ObjectRenderer3D(this, this.gl, this.programManager, this.lightingManager);
        // Get program registry reference
        this.programRegistry = this.programManager.getProgramRegistry();
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
        if (!this._initializedShadows && this.shadowManager) {
            try {
                // Initialize shadows for all shader types
                this._initShadowsForAllShaders();
                this._initializedShadows = true;
            } catch (error) {
                console.error('Error initializing shadows:', error);
            }
        }
        
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
        
        // SHADOW MAP PASS (only if shadows are enabled)
        if (this.shadowsEnabled && nonWaterObjects.length > 0) {
            // Update light space matrix based on current light position and direction
            const lightPos = this.lightingManager.lightPos;
            const lightDir = this.lightingManager.getLightDir();
            this.shadowManager.updateLightSpaceMatrix(lightPos, lightDir);
            
            // Begin shadow pass
            this.shadowManager.beginShadowPass();
            
            // Render objects to shadow map
            for (const object of nonWaterObjects) {
                // Only render objects that can cast shadows
                if (object.triangles?.length) {
                    this.shadowManager.renderObjectToShadowMap(object);
                }
            }
            
            // End shadow pass
            this.shadowManager.endShadowPass();
        }
        
        // MAIN RENDER PASS
        this.canvasManager.resetToDefaultFramebuffer();
        this.canvasManager.clear();

        // Collect all objects into batch first
        for (const object of nonWaterObjects) {
            this.objectRenderer.queue(object, camera, this._cachedShaderSet, this.currentTime);
        }
        
        // Prepare for main rendering with shadows
        if (this.shadowsEnabled) {
            try {
                // Get shadow texture unit from constants
                const SHADOW_MAP_TEXTURE_UNIT = this.lightingManager.getShadowTextureUnit();
                // WebGL guarantees at least 8 texture units (0-7)
                
                // Get the current shader set
                const shaderSet = this.programRegistry.getCurrentShaderSet();
                if (!shaderSet || !shaderSet.standard || !shaderSet.standard.program) {
                    console.warn('Cannot setup shadows: shader program not available');
                    return;
                }
                
                // Use the shader program
                this.gl.useProgram(shaderSet.standard.program);
                
                // Ensure the shadow map is on texture unit 7
                this.gl.activeTexture(this.gl.TEXTURE0 + SHADOW_MAP_TEXTURE_UNIT);
                this.gl.bindTexture(this.gl.TEXTURE_2D, this.shadowManager.shadowTexture);
                
                // Get shadow uniform locations directly from the program
                const uniformShadowMap = this.gl.getUniformLocation(shaderSet.standard.program, 'uShadowMap');
                const uniformLightSpaceMatrix = this.gl.getUniformLocation(shaderSet.standard.program, 'uLightSpaceMatrix');
                const uniformShadowsEnabled = this.gl.getUniformLocation(shaderSet.standard.program, 'uShadowsEnabled');
                const uniformShadowBias = this.gl.getUniformLocation(shaderSet.standard.program, 'uShadowBias');
                const uniformShadowMapSize = this.gl.getUniformLocation(shaderSet.standard.program, 'uShadowMapSize');
                const uniformShadowSoftness = this.gl.getUniformLocation(shaderSet.standard.program, 'uShadowSoftness');
                const uniformPCFSize = this.gl.getUniformLocation(shaderSet.standard.program, 'uPCFSize');
                const uniformPCFEnabled = this.gl.getUniformLocation(shaderSet.standard.program, 'uPCFEnabled');
                
                
                // Set shadow map texture unit
                if (uniformShadowMap !== null) {
                    this.gl.uniform1i(uniformShadowMap, SHADOW_MAP_TEXTURE_UNIT);
                } else {
                    // Some shaders might not have shadow support
                    console.warn(`Shadow map uniform not found in current shader: ${this.programRegistry.getCurrentShaderName()}`);
                }
                
                // Set light space matrix
                if (uniformLightSpaceMatrix !== null) {
                    this.gl.uniformMatrix4fv(
                        uniformLightSpaceMatrix,
                        false,
                        this.shadowManager.getLightSpaceMatrix()
                    );
                }
                
                // Set shadows enabled flag
                if (uniformShadowsEnabled !== null) {
                    this.gl.uniform1i(uniformShadowsEnabled, 1); // 1 = true
                }
                
                // Set shadow bias from constants
                if (uniformShadowBias !== null) {
                    this.gl.uniform1f(uniformShadowBias, this.shadowManager.shadowBias);
                    //console.log(`Set shadow bias uniform to ${this.shadowManager.shadowBias}`);
                }
                
                // Set shadow map size uniform
                if (uniformShadowMapSize !== null) {
                    this.gl.uniform1f(uniformShadowMapSize, this.shadowManager.shadowMapSize);
                    console.log(`Set shadow map size uniform to ${this.shadowManager.shadowMapSize}`);
                }
                
                // Set shadow softness uniform
                if (uniformShadowSoftness !== null) {
                    const softness = this.lightingManager.constants.SHADOW_FILTERING.SOFTNESS.value;
                    this.gl.uniform1f(uniformShadowSoftness, softness);
                    //console.log(`Set shadow softness uniform to ${softness}`);
                }
                
                // Set PCF size uniform
                if (uniformPCFSize !== null) {
                    const pcfSize = this.lightingManager.constants.SHADOW_FILTERING.PCF.SIZE.value;
                    this.gl.uniform1i(uniformPCFSize, pcfSize);
                    //console.log(`Set PCF size uniform to ${pcfSize}`);
                }
                
                // Set PCF enabled uniform
                if (uniformPCFEnabled !== null) {
                    const pcfEnabled = this.lightingManager.constants.SHADOW_FILTERING.PCF.ENABLED ? 1 : 0;
                    this.gl.uniform1i(uniformPCFEnabled, pcfEnabled);
                    //console.log(`Set PCF enabled uniform to ${pcfEnabled}`);
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

        // Draw the sun
        const lightPos = this.lightingManager.lightPos;
        const isVirtualBoyShader = (this._cachedShaderSet === this.programRegistry.shaders.get("virtualboy"));
        this.sunRenderer.render(camera, lightPos, isVirtualBoyShader);
        
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
     * Toggle shadows on or off
     */
    toggleShadows() {
        this.shadowsEnabled = !this.shadowsEnabled;
        console.log(`Shadows ${this.shadowsEnabled ? 'enabled' : 'disabled'}`);
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
        
        // Apply the quality preset through the lighting manager
        this.lightingManager.setShadowQuality(quality);
        
        // Sync shadow manager with the new constants
        this.shadowManager.syncWithConstants();
        
        const presetName = lightingConstants.SHADOW_QUALITY_PRESETS[quality].name;
        console.log(`Shadow quality set to ${presetName}`);
    }
    
    /**
     * Initialize shadow maps for all shader types
     * This ensures both default and PBR shaders can render shadows
     */
    _initShadowsForAllShaders() {
        // Constant for shadow texture unit
        const SHADOW_MAP_TEXTURE_UNIT = 7;
        
        // Pre-bind the shadow map texture to unit 7
        this.gl.activeTexture(this.gl.TEXTURE0 + SHADOW_MAP_TEXTURE_UNIT);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.shadowManager.shadowTexture);
        
        // Get all available shader sets
        const shaderTypes = ['default', 'pbr'];
        
        // Initialize shadows for each shader type
        for (const shaderType of shaderTypes) {
            const shaderSet = this.programRegistry.shaders.get(shaderType);
            
            if (shaderSet && shaderSet.standard && shaderSet.standard.program) {
                console.log(`Initializing shadows for shader type: ${shaderType}`);
                
                // Use this shader program
                this.gl.useProgram(shaderSet.standard.program);
                
                // Get shadow uniforms
                const shadowMapLoc = this.gl.getUniformLocation(shaderSet.standard.program, 'uShadowMap');
                const shadowEnabledLoc = this.gl.getUniformLocation(shaderSet.standard.program, 'uShadowsEnabled');
                const lightSpaceMatrixLoc = this.gl.getUniformLocation(shaderSet.standard.program, 'uLightSpaceMatrix');
                const shadowBiasLoc = this.gl.getUniformLocation(shaderSet.standard.program, 'uShadowBias');
                const shadowMapSizeLoc = this.gl.getUniformLocation(shaderSet.standard.program, 'uShadowMapSize');
                const shadowSoftnessLoc = this.gl.getUniformLocation(shaderSet.standard.program, 'uShadowSoftness');
                const pcfSizeLoc = this.gl.getUniformLocation(shaderSet.standard.program, 'uPCFSize');
                const pcfEnabledLoc = this.gl.getUniformLocation(shaderSet.standard.program, 'uPCFEnabled');
                
                // Set shadow map texture unit
                if (shadowMapLoc !== null) {
                    this.gl.uniform1i(shadowMapLoc, SHADOW_MAP_TEXTURE_UNIT);
                    console.log(`  - Set shadow map uniform for ${shaderType} to texture unit ${SHADOW_MAP_TEXTURE_UNIT}`);
                } else {
                    console.warn(`  - Shadow map uniform not found in ${shaderType} shader`);
                }
                
                // Set shadow enabled flag (on by default)
                if (shadowEnabledLoc !== null) {
                    this.gl.uniform1i(shadowEnabledLoc, 1);
                }
                
                // Set initial light space matrix if available
                if (lightSpaceMatrixLoc !== null && this.shadowManager) {
                    this.gl.uniformMatrix4fv(
                        lightSpaceMatrixLoc,
                        false,
                        this.shadowManager.getLightSpaceMatrix()
                    );
                }
                
                // Set shadow bias if available
                if (shadowBiasLoc !== null && this.shadowManager) {
                    this.gl.uniform1f(shadowBiasLoc, this.shadowManager.shadowBias);
                    console.log(`  - Set shadow bias uniform for ${shaderType} to ${this.shadowManager.shadowBias}`);
                }
                
                // Set shadow map size if available
                if (shadowMapSizeLoc !== null && this.shadowManager) {
                    this.gl.uniform1f(shadowMapSizeLoc, this.shadowManager.shadowMapSize);
                    console.log(`  - Set shadow map size uniform for ${shaderType} to ${this.shadowManager.shadowMapSize}`);
                }
                
                // Set shadow softness
                if (shadowSoftnessLoc !== null && this.lightingManager) {
                    const softness = this.lightingManager.constants.SHADOW_FILTERING.SOFTNESS.value;
                    this.gl.uniform1f(shadowSoftnessLoc, softness);
                    console.log(`  - Set shadow softness uniform for ${shaderType} to ${softness}`);
                }
                
                // Set PCF size
                if (pcfSizeLoc !== null && this.lightingManager) {
                    const pcfSize = this.lightingManager.constants.SHADOW_FILTERING.PCF.SIZE.value;
                    this.gl.uniform1i(pcfSizeLoc, pcfSize);
                    //console.log(`  - Set PCF size uniform for ${shaderType} to ${pcfSize}`);
                }
                
                // Set PCF enabled
                if (pcfEnabledLoc !== null && this.lightingManager) {
                    const pcfEnabled = this.lightingManager.constants.SHADOW_FILTERING.PCF.ENABLED ? 1 : 0;
                    this.gl.uniform1i(pcfEnabledLoc, pcfEnabled);
                    //console.log(`  - Set PCF enabled uniform for ${shaderType} to ${pcfEnabled}`);
                }
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
        
        // Make sure program registry exists and has shaders
        if (!this.programRegistry || !this.programRegistry.shaders) {
            console.warn('Program registry or shaders map not available for debugging');
            return;
        }
        
        // Check all registered shader programs
        try {
            this.programRegistry.shaders.forEach((shaderSet, name) => {
            const standardProgram = shaderSet.standard.program;
            console.log(`\nChecking shadow uniforms for shader '${name}':\n`);
            
            if (standardProgram) {
                // Check uniform locations directly
                const shadowMapLoc = gl.getUniformLocation(standardProgram, 'uShadowMap');
                const lightSpaceMatrixLoc = gl.getUniformLocation(standardProgram, 'uLightSpaceMatrix');
                const shadowsEnabledLoc = gl.getUniformLocation(standardProgram, 'uShadowsEnabled');
                const shadowBiasLoc = gl.getUniformLocation(standardProgram, 'uShadowBias');
                const shadowMapSizeLoc = gl.getUniformLocation(standardProgram, 'uShadowMapSize');
                const shadowSoftnessLoc = gl.getUniformLocation(standardProgram, 'uShadowSoftness');
                const pcfSizeLoc = gl.getUniformLocation(standardProgram, 'uPCFSize');
                const pcfEnabledLoc = gl.getUniformLocation(standardProgram, 'uPCFEnabled');
                
                console.log(`Direct check for shader '${name}':\n`);
                console.log('uShadowMap:', shadowMapLoc);
                console.log('uLightSpaceMatrix:', lightSpaceMatrixLoc);
                console.log('uShadowsEnabled:', shadowsEnabledLoc);
                console.log('uShadowBias:', shadowBiasLoc);
                console.log('uShadowMapSize:', shadowMapSizeLoc);
                console.log('uShadowSoftness:', shadowSoftnessLoc);
                console.log('uPCFSize:', pcfSizeLoc);
                console.log('uPCFEnabled:', pcfEnabledLoc);
                
                // Get active uniforms
                const numUniforms = gl.getProgramParameter(standardProgram, gl.ACTIVE_UNIFORMS);
                console.log(`\nActive uniforms for shader '${name}' (${numUniforms} total):\n`);
                
                for (let i = 0; i < numUniforms; i++) {
                    const uniformInfo = gl.getActiveUniform(standardProgram, i);
                    console.log(`${i}: ${uniformInfo.name} (${this.getGLTypeString(uniformInfo.type)})`);
                }
            } else {
                console.log(`No standard program found for shader '${name}'`);
            }
        });
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
        
        // Reset debug state when enabling shadow map visualization
        if (lightingConstants.DEBUG.VISUALIZE_SHADOW_MAP && this.shadowManager) {
            this.shadowManager.resetDebugState();
        }
        
        console.log(`Shadow map visualization ${lightingConstants.DEBUG.VISUALIZE_SHADOW_MAP ? 'enabled' : 'disabled'}`);
        return lightingConstants.DEBUG.VISUALIZE_SHADOW_MAP;
    }
}