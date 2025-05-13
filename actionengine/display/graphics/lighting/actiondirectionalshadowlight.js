// actionengine/display/graphics/lighting/actiondirectionalshadowlight.js

/**
 * Directional light with shadow mapping capability
 * This light type simulates light coming from a distance in a specific direction,
 * like sunlight, with parallel light rays.
 */
class ActionDirectionalShadowLight extends ActionLight {
    /**
     * Constructor for a directional shadow light
     * @param {WebGLRenderingContext} gl - The WebGL rendering context
     * @param {boolean} isWebGL2 - Flag indicating if WebGL2 is available
     * @param {ProgramManager} programManager - Reference to the program manager for shader access
     */
    constructor(gl, isWebGL2, programManager) {
        super(gl, isWebGL2);
        
        this.programManager = programManager;
        this.programRegistry = programManager.getProgramRegistry();
        
        // Directional light specific properties
        this.direction = new Vector3(0, -1, 0);
        
        // Enable shadows by default for directional lights
        this.castsShadows = true;
        
        // Shadow map settings from constants
        this.shadowMapSize = this.constants.SHADOW_MAP.SIZE.value;
        this.shadowBias = this.constants.SHADOW_MAP.BIAS.value;
        
        // For tracking direction changes
        this._lastDirection = undefined;
        
        // Create matrices for shadow calculations
        this.lightProjectionMatrix = Matrix4.create();
        this.lightViewMatrix = Matrix4.create();
        this.lightSpaceMatrix = Matrix4.create();
        
        // Initialize shadow map resources and shader program
        if (this.castsShadows) {
            this.setupShadowMap();
            this.setupShadowShaderProgram();
            this.createReusableBuffers();
        }
    }
    
    /**
     * Set the light direction
     * @param {Vector3} direction - The new direction vector (will be normalized)
     */
    setDirection(direction) {
        // Use copy if it exists, otherwise fall back to direct assignment
        if (typeof this.direction.copy === 'function') {
            this.direction.copy(direction);
        } else {
            this.direction.x = direction.x;
            this.direction.y = direction.y;
            this.direction.z = direction.z;
        }
        this.direction.normalizeInPlace();
    }
    
    /**
     * Get the light direction
     * @returns {Vector3} - The current direction
     */
    getDirection() {
        return this.direction;
    }
    
    /**
     * Override the update method to check for direction changes
     * @returns {boolean} - Whether any properties changed this frame
     */
    update() {
        let changed = super.update();
        
        // Check if direction has changed
        if (this._lastDirection === undefined ||
            this._lastDirection.x !== this.direction.x ||
            this._lastDirection.y !== this.direction.y ||
            this._lastDirection.z !== this.direction.z) {
            
            // Cache current direction to detect changes
            this._lastDirection = {
                x: this.direction.x,
                y: this.direction.y,
                z: this.direction.z
            };
            
            changed = true;
        }
        
        // If any properties changed and shadows are enabled,
        // update the light space matrix
        if (changed && this.castsShadows) {
            this.updateLightSpaceMatrix();
        }
        
        return changed;
    }
    
    /**
     * Update properties from global lighting constants
     */
    syncWithConstants() {
        // Update position from constants
        this.position.x = this.constants.LIGHT_POSITION.x;
        this.position.y = this.constants.LIGHT_POSITION.y;
        this.position.z = this.constants.LIGHT_POSITION.z;
        
        // Update direction from constants
        this.direction.x = this.constants.LIGHT_DIRECTION.x;
        this.direction.y = this.constants.LIGHT_DIRECTION.y;
        this.direction.z = this.constants.LIGHT_DIRECTION.z;
        
        // Update intensity from constants
        this.intensity = this.constants.LIGHT_INTENSITY.value;
        
        // Check if shadow map size has changed
        if (this.shadowMapSize !== this.constants.SHADOW_MAP.SIZE.value) {
            this.shadowMapSize = this.constants.SHADOW_MAP.SIZE.value;
            if (this.castsShadows) {
                this.setupShadowMap(); // Recreate shadow map with new size
            }
        }
        
        // Update bias value
        this.shadowBias = this.constants.SHADOW_MAP.BIAS.value;
    }
    
    /**
     * Set up shadow map framebuffer and texture
     */
    setupShadowMap() {
        const gl = this.gl;

        // Delete any existing shadow framebuffer and texture
        if (this.shadowFramebuffer) {
            gl.deleteFramebuffer(this.shadowFramebuffer);
        }
        if (this.shadowTexture) {
            gl.deleteTexture(this.shadowTexture);
        }

        // Create and bind the framebuffer
        this.shadowFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);

        // Create the shadow texture
        this.shadowTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.shadowTexture);

        // Simple color texture - no depth texture!
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA, // Color format, not depth!
            this.shadowMapSize,
            this.shadowMapSize,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE, // Regular 8-bit colors
            null
        );

        // Set up texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Attach color texture to framebuffer
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0, // COLOR not DEPTH
            gl.TEXTURE_2D,
            this.shadowTexture,
            0
        );

        // Create and attach a renderbuffer for depth (we're not reading this)
        const depthBuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.shadowMapSize, this.shadowMapSize);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

        // Check framebuffer is complete
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            console.error(`Shadow framebuffer is incomplete: ${status}`);
        }

        // Unbind the framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    /**
     * Create reusable buffers for shadow rendering
     */
    createReusableBuffers() {
        // Create persistent buffers instead of per-object temporary ones
        this.shadowBuffers = {
            position: this.gl.createBuffer(),
            index: this.gl.createBuffer()
        };
    }
    
    /**
     * Set up shadow shader program and get all necessary locations
     */
    setupShadowShaderProgram() {
        try {
            const shadowShader = new ShadowShader();

            // Create shadow map program
            this.shadowProgram = this.programRegistry.createShaderProgram(
                shadowShader.getShadowVertexShader(this.isWebGL2),
                shadowShader.getShadowFragmentShader(this.isWebGL2),
                "shadow_depth_pass"
            );

            // Get attribute and uniform locations
            this.shadowLocations = {
                position: this.gl.getAttribLocation(this.shadowProgram, "aPosition"),
                lightSpaceMatrix: this.gl.getUniformLocation(this.shadowProgram, "uLightSpaceMatrix"),
                modelMatrix: this.gl.getUniformLocation(this.shadowProgram, "uModelMatrix"),
                debugShadowMap: this.gl.getUniformLocation(this.shadowProgram, "uDebugShadowMap"),
                forceShadowMapTest: this.gl.getUniformLocation(this.shadowProgram, "uForceShadowMapTest"),
                shadowMapSize: this.gl.getUniformLocation(this.shadowProgram, "uShadowMapSize")
            };
        } catch (error) {
            console.error("Error setting up shadow shader program:", error);
        }
    }
    
    /**
     * Updates light space matrices based on light position and direction
     * This creates the view and projection matrices needed for shadow mapping
     * @param {Object} sceneBounds - Optional scene bounding box (min, max vectors) for automatic fitting
     */
    updateLightSpaceMatrix(sceneBounds) {
        // Default scene bounds if not provided
        if (!sceneBounds) {
            sceneBounds = {
                min: new Vector3(
                    this.constants.SHADOW_PROJECTION.LEFT.value,
                    this.constants.SHADOW_PROJECTION.BOTTOM.value,
                    this.constants.SHADOW_PROJECTION.NEAR.value
                ),
                max: new Vector3(
                    this.constants.SHADOW_PROJECTION.RIGHT.value,
                    this.constants.SHADOW_PROJECTION.TOP.value,
                    this.constants.SHADOW_PROJECTION.FAR.value
                )
            };
        }

        // Automatically fit shadow frustum to scene if enabled
        if (this.constants.SHADOW_PROJECTION.AUTO_FIT) {
            // Auto-fit logic would go here
            // For now, we'll use the constants directly
        }

        // For directional light, use orthographic projection
        const left = this.constants.SHADOW_PROJECTION.LEFT.value;
        const right = this.constants.SHADOW_PROJECTION.RIGHT.value;
        const bottom = this.constants.SHADOW_PROJECTION.BOTTOM.value;
        const top = this.constants.SHADOW_PROJECTION.TOP.value;
        const near = this.constants.SHADOW_PROJECTION.NEAR.value;
        const far = this.constants.SHADOW_PROJECTION.FAR.value;

        // Create light projection matrix (orthographic for directional light)
        Matrix4.ortho(this.lightProjectionMatrix, left, right, bottom, top, near, far);

        // Create light view matrix - looking from light position toward center
        const lightTarget = new Vector3(0, 0, 0);
        
        // Use a fixed distance value
        const fixedDistance = 100.0;

        // Calculate target position based on light direction
        lightTarget.x = this.position.x + this.direction.x * fixedDistance;
        lightTarget.y = this.position.y + this.direction.y * fixedDistance;
        lightTarget.z = this.position.z + this.direction.z * fixedDistance;

        // Choose an appropriate up vector that avoids collinearity with light direction
        let upVector = [0, 1, 0]; // Default up vector
        
        // Check if light direction is too closely aligned with the default up vector
        if (Math.abs(this.direction.y) > 0.99) {
            // If pointing almost straight up/down, use Z axis as up vector instead
            upVector = [0, 0, 1];
        }
        
        Matrix4.lookAt(
            this.lightViewMatrix,
            this.position.toArray(),
            lightTarget.toArray(),
            upVector
        );

        // Combine into light space matrix
        Matrix4.multiply(this.lightSpaceMatrix, this.lightProjectionMatrix, this.lightViewMatrix);
    }
    
    /**
     * Begin shadow map rendering pass
     */
    beginShadowPass() {
        const gl = this.gl;

        // Save current viewport
        this._savedViewport = gl.getParameter(gl.VIEWPORT);

        // Bind shadow framebuffer and set viewport to shadow map size
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
        gl.viewport(0, 0, this.shadowMapSize, this.shadowMapSize);
        
        // Check for debug force test mode
        if (this.constants.DEBUG.FORCE_SHADOW_MAP_TEST) {
            // Use a color framebuffer instead for debug visualization
            if (!this._debugColorFramebuffer) {
                this._debugColorFramebuffer = gl.createFramebuffer();
                this._debugColorTexture = gl.createTexture();

                gl.bindTexture(gl.TEXTURE_2D, this._debugColorTexture);
                gl.texImage2D(
                    gl.TEXTURE_2D,
                    0,
                    gl.RGBA,
                    this.shadowMapSize,
                    this.shadowMapSize,
                    0,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    null
                );
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

                gl.bindFramebuffer(gl.FRAMEBUFFER, this._debugColorFramebuffer);
                gl.framebufferTexture2D(
                    gl.FRAMEBUFFER,
                    gl.COLOR_ATTACHMENT0,
                    gl.TEXTURE_2D,
                    this._debugColorTexture,
                    0
                );
            }

            // Use this framebuffer instead
            gl.bindFramebuffer(gl.FRAMEBUFFER, this._debugColorFramebuffer);
            gl.clearColor(1.0, 0.0, 0.0, 1.0); // Bright red
            gl.clear(gl.COLOR_BUFFER_BIT);

            // Save this texture for visualization
            this._lastDebugTexture = this._debugColorTexture;

            // Skip shadow rendering in debug mode
            return;
        }
        
        // Always clear both color and depth buffers regardless of WebGL version
        gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black (far depth)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Use shadow mapping program
        gl.useProgram(this.shadowProgram);

        // Set light space matrix uniform
        gl.uniformMatrix4fv(this.shadowLocations.lightSpaceMatrix, false, this.lightSpaceMatrix);

        // Set debug shadow map uniform if available
        if (this.shadowLocations.debugShadowMap !== null) {
            const debugMode = this.constants.DEBUG.VISUALIZE_SHADOW_MAP ? 1 : 0;
            gl.uniform1i(this.shadowLocations.debugShadowMap, debugMode);
        }

        // Set force shadow map test uniform if available
        if (this.shadowLocations.forceShadowMapTest !== null) {
            const forceTest = this.constants.DEBUG.FORCE_SHADOW_MAP_TEST ? 1 : 0;
            gl.uniform1i(this.shadowLocations.forceShadowMapTest, forceTest);
        }

        // Set shadow map size uniform
        if (this.shadowLocations.shadowMapSize !== null) {
            gl.uniform1f(this.shadowLocations.shadowMapSize, this.shadowMapSize);
        }
    }
    
    /**
     * End shadow map rendering pass and restore previous state
     */
    endShadowPass() {
        const gl = this.gl;

        // Unbind shadow framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // Restore viewport
        gl.viewport(this._savedViewport[0], this._savedViewport[1], this._savedViewport[2], this._savedViewport[3]);
    }
    
    /**
     * Render a single object to the shadow map
     * @param {Object} object - The object to render
     */
    renderObjectToShadowMap(object) {
        const gl = this.gl;
        const triangles = object.triangles;

        // Skip if object has no triangles
        if (!triangles || triangles.length === 0) {
            return;
        }

        // Set model matrix for this object
        // For debugging, add an identity matrix to ensure proper transformation
        const modelMatrix = Matrix4.create();
        // If the object has a transformation matrix, we should use it
        // For now using identity matrix to debug the basic case
        gl.uniformMatrix4fv(this.shadowLocations.modelMatrix, false, modelMatrix);

        // Calculate total vertices and indices
        const totalVertices = triangles.length * 3;
        
        // Only allocate new arrays if needed or if size has changed
        if (!this._positionsArray || this._positionsArray.length < totalVertices * 3) {
            this._positionsArray = new Float32Array(totalVertices * 3);
        }
        if (!this._indicesArray || this._indicesArray.length < totalVertices) {
            this._indicesArray = new Uint16Array(totalVertices);
        }

        // Fill position and index arrays
        for (let i = 0; i < triangles.length; i++) {
            const triangle = triangles[i];

            // Process vertices
            for (let j = 0; j < 3; j++) {
                const vertex = triangle.vertices[j];
                const baseIndex = (i * 3 + j) * 3;

                this._positionsArray[baseIndex] = vertex.x;
                this._positionsArray[baseIndex + 1] = vertex.y;
                this._positionsArray[baseIndex + 2] = vertex.z;

                // Set up indices
                this._indicesArray[i * 3 + j] = i * 3 + j;
            }
        }

        // Bind and upload position data to our reusable buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.shadowBuffers.position);
        gl.bufferData(gl.ARRAY_BUFFER, this._positionsArray, gl.DYNAMIC_DRAW);

        // Set up position attribute
        gl.vertexAttribPointer(this.shadowLocations.position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.shadowLocations.position);

        // Bind and upload index data to our reusable buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.shadowBuffers.index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._indicesArray, gl.DYNAMIC_DRAW);

        // Draw object
        gl.drawElements(gl.TRIANGLES, totalVertices, gl.UNSIGNED_SHORT, 0);
    }
    
    /**
     * Bind shadow map texture to a texture unit for use in main rendering pass
     * @param {number} textureUnit - Texture unit to bind to (e.g., gl.TEXTURE0)
     * @returns {number} - The texture unit index (0, 1, etc.)
     */
    bindShadowMapTexture(textureUnit) {
        const gl = this.gl;

        try {
            // Completely unbind ALL textures from this unit before binding the shadow map
            gl.activeTexture(textureUnit);

            // Unbind all possible texture types from this unit
            gl.bindTexture(gl.TEXTURE_2D, null);
            if (this.isWebGL2) {
                gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
                gl.bindTexture(gl.TEXTURE_3D, null);
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
            } else {
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
            }

            // Now bind our shadow map texture to a completely clean unit
            gl.bindTexture(gl.TEXTURE_2D, this.shadowTexture);

            const unitIndex = textureUnit - gl.TEXTURE0;
            return unitIndex;
        } catch (error) {
            console.error("Error binding shadow texture:", error);
            return 0;
        }
    }
    
    /**
     * Get the light space matrix for passing to shaders
     * @returns {Float32Array} - The light space transformation matrix
     */
    getLightSpaceMatrix() {
        return this.lightSpaceMatrix;
    }
    
    /**
     * Apply this light's uniforms to a shader program
     * @param {WebGLProgram} program - The shader program
     * @param {number} index - Index of this light in an array of lights (for future multi-light support)
     */
    applyToShader(program, index = 0) {
        const gl = this.gl;
        
        // Get light uniform locations
        // For now we just use the standard uniforms, but in the future we'd use arrays
        // like uDirectionalLights[index].direction, etc.
        
        // Use uLightDir to match what's actually in the shaders
        const lightDirLoc = gl.getUniformLocation(program, "uLightDir");
        // Use uLightPos to match what's actually in the shaders
        const lightPosLoc = gl.getUniformLocation(program, "uLightPos");
        const lightIntensityLoc = gl.getUniformLocation(program, "uLightIntensity");
        const shadowMapLoc = gl.getUniformLocation(program, "uShadowMap");
        const lightSpaceMatrixLoc = gl.getUniformLocation(program, "uLightSpaceMatrix");
        const shadowsEnabledLoc = gl.getUniformLocation(program, "uShadowsEnabled");
        const shadowBiasLoc = gl.getUniformLocation(program, "uShadowBias");
        
        // Set light direction
        if (lightDirLoc !== null) {
            gl.uniform3f(lightDirLoc, this.direction.x, this.direction.y, this.direction.z);
        }
        
        // Set light position
        if (lightPosLoc !== null) {
            gl.uniform3f(lightPosLoc, this.position.x, this.position.y, this.position.z);
        }
        
        // Set light intensity
        if (lightIntensityLoc !== null) {
            gl.uniform1f(lightIntensityLoc, this.intensity);
        }
        
        // Apply shadow mapping uniforms if shadows are enabled
        if (this.castsShadows) {
            // Set shadow map texture unit
            if (shadowMapLoc !== null) {
                // Use the specified texture unit from lighting constants
                gl.uniform1i(shadowMapLoc, this.constants.SHADOW_MAP.TEXTURE_UNIT);
            }
            
            // Set light space matrix
            if (lightSpaceMatrixLoc !== null) {
                gl.uniformMatrix4fv(lightSpaceMatrixLoc, false, this.lightSpaceMatrix);
            }
            
            // Set shadows enabled flag
            if (shadowsEnabledLoc !== null) {
                gl.uniform1i(shadowsEnabledLoc, 1); // 1 = true
            }
            
            // Set shadow bias
            if (shadowBiasLoc !== null) {
                gl.uniform1f(shadowBiasLoc, this.shadowBias);
            }
        } else if (shadowsEnabledLoc !== null) {
            // Shadows are disabled for this light
            gl.uniform1i(shadowsEnabledLoc, 0); // 0 = false
        }
    }
    
    /**
     * Apply shadow quality preset
     * @param {number} presetIndex - Index of the preset to apply
     */
    setQualityPreset(presetIndex) {
        const presets = this.constants.SHADOW_QUALITY_PRESETS;
        if (presetIndex < 0 || presetIndex >= presets.length) {
            console.warn(`Invalid shadow quality preset index: ${presetIndex}`);
            return;
        }

        const preset = presets[presetIndex];
        this.shadowMapSize = preset.mapSize;
        this.shadowBias = preset.bias;

        // Recreate shadow map with new settings
        if (this.castsShadows) {
            this.setupShadowMap();
        }

        console.log(`Applied shadow quality preset: ${preset.name}`);
    }
    
    /**
     * Cleanup resources used by this light
     */
    dispose() {
        const gl = this.gl;
        
        // Clean up shadow map resources
        if (this.shadowFramebuffer) {
            gl.deleteFramebuffer(this.shadowFramebuffer);
            this.shadowFramebuffer = null;
        }
        
        if (this.shadowTexture) {
            gl.deleteTexture(this.shadowTexture);
            this.shadowTexture = null;
        }
        
        if (this._debugColorFramebuffer) {
            gl.deleteFramebuffer(this._debugColorFramebuffer);
            this._debugColorFramebuffer = null;
        }
        
        if (this._debugColorTexture) {
            gl.deleteTexture(this._debugColorTexture);
            this._debugColorTexture = null;
        }
        
        // Clean up buffers
        if (this.shadowBuffers) {
            if (this.shadowBuffers.position) {
                gl.deleteBuffer(this.shadowBuffers.position);
            }
            if (this.shadowBuffers.index) {
                gl.deleteBuffer(this.shadowBuffers.index);
            }
            this.shadowBuffers = null;
        }
    }
}