// actionengine/display/graphics/renderers/actionrenderer3D/shadowmanager.js
class ShadowManager {
    constructor(gl, programManager, isWebGL2) {
        this.gl = gl;
        this.programManager = programManager;
        this.isWebGL2 = isWebGL2;
        this.programRegistry = programManager.getProgramRegistry();

        // Use lighting constants for shadow settings
        this.constants = lightingConstants;

        // Shadow map settings from constants
        this.shadowMapSize = this.constants.SHADOW_MAP.SIZE.value;
        this.shadowBias = this.constants.SHADOW_MAP.BIAS.value;

        // Create matrices for shadow calculations
        this.lightProjectionMatrix = Matrix4.create();
        this.lightViewMatrix = Matrix4.create();
        this.lightSpaceMatrix = Matrix4.create();

        // Initialize shadow map resources
        this.setupShadowMap();

        // Create shadow shader program
        this.setupShadowShaderProgram();
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
     * Set up shadow shader program and get all necessary locations
     */
    setupShadowShaderProgram() {
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

        console.log("Shadow shader program initialized:", this.shadowProgram);
        console.log("Shadow locations:", this.shadowLocations);
    }

    /**
     * Updates light space matrices based on light position and scene bounds
     * Light Direction Convention: In this engine, the light direction vector indicates where
     * light is coming FROM, not going TO. However, in the shader lighting calculations,
     * we negate this direction to get the vector pointing toward the light source.
     *
     * @param {Vector3} lightPos - Light position
     * @param {Vector3} lightDir - Light direction vector (points FROM light source)
     * @param {Object} sceneBounds - Scene bounding box (min, max vectors)
     */
    updateLightSpaceMatrix(lightPos, lightDir, sceneBounds) {
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
        if (lightDir) {
            // Use the distance multiplier from constants
            const distanceMult = this.constants.SHADOW_PROJECTION.DISTANCE_MULTIPLIER.value;

            // If light direction is provided, use it to calculate target position
            lightTarget.x = lightPos.x + lightDir.x * distanceMult;
            lightTarget.y = lightPos.y + lightDir.y * distanceMult;
            lightTarget.z = lightPos.z + lightDir.z * distanceMult;
        }

        // Choose an appropriate up vector that avoids collinearity with light direction
        let upVector = [0, 1, 0]; // Default up vector
        
        // Check if light direction is too closely aligned with the default up vector
        // This avoids numerical issues when the light is pointing straight up or down
        if (Math.abs(lightDir.y) > 0.99) {
            // If pointing almost straight up/down, use Z axis as up vector instead
            upVector = [0, 0, 1];
        }
        
        Matrix4.lookAt(
            this.lightViewMatrix,
            lightPos.toArray(),
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
        if (this.constants.DEBUG.FORCE_SHADOW_MAP_TEST) {
            // Use a color framebuffer instead
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

            // Skip shadow rendering
            return;
        }
        // Always clear both color and depth buffers regardless of WebGL version
        // This is critical to prevent old shadow data from persisting
        gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black (far depth)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Use shadow mapping program
        gl.useProgram(this.shadowProgram);

        // Set light space matrix uniform
        gl.uniformMatrix4fv(this.shadowLocations.lightSpaceMatrix, false, this.lightSpaceMatrix);

        // Set debug shadow map uniform if available
        if (this.shadowLocations.debugShadowMap !== null) {
            const debugMode = lightingConstants.DEBUG.VISUALIZE_SHADOW_MAP ? 1 : 0;
            gl.uniform1i(this.shadowLocations.debugShadowMap, debugMode);
        }

        // Set force shadow map test uniform if available
        if (this.shadowLocations.forceShadowMapTest !== null) {
            const forceTest = lightingConstants.DEBUG.FORCE_SHADOW_MAP_TEST ? 1 : 0;
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

        // Create buffers for position data
        const positionBuffer = gl.createBuffer();
        const indexBuffer = gl.createBuffer();

        // Calculate total vertices and indices
        const totalVertices = triangles.length * 3;
        const positions = new Float32Array(totalVertices * 3);
        const indices = new Uint16Array(totalVertices);

        // For debugging, track the min/max values of vertices
        const minBounds = { x: Infinity, y: Infinity, z: Infinity };
        const maxBounds = { x: -Infinity, y: -Infinity, z: -Infinity };

        // Fill position and index arrays
        for (let i = 0; i < triangles.length; i++) {
            const triangle = triangles[i];

            // Process vertices
            for (let j = 0; j < 3; j++) {
                const vertex = triangle.vertices[j];
                const baseIndex = (i * 3 + j) * 3;

                positions[baseIndex] = vertex.x;
                positions[baseIndex + 1] = vertex.y;
                positions[baseIndex + 2] = vertex.z;

                // Update min/max bounds
                minBounds.x = Math.min(minBounds.x, vertex.x);
                minBounds.y = Math.min(minBounds.y, vertex.y);
                minBounds.z = Math.min(minBounds.z, vertex.z);

                maxBounds.x = Math.max(maxBounds.x, vertex.x);
                maxBounds.y = Math.max(maxBounds.y, vertex.y);
                maxBounds.z = Math.max(maxBounds.z, vertex.z);

                // Set up indices
                indices[i * 3 + j] = i * 3 + j;
            }
        }

        // Debug output for object bounds
        if (lightingConstants.DEBUG.VISUALIZE_SHADOW_MAP && !this._boundsLogged) {
            console.log(`Object bounds in shadow map:`, {
                min: minBounds,
                max: maxBounds,
                triangles: triangles.length
            });

            // Also log light space matrix for debugging
            console.log(`Light space matrix:`, {
                matrix: Array.from(this.lightSpaceMatrix),
                shadowProjection: {
                    left: lightingConstants.SHADOW_PROJECTION.LEFT.value,
                    right: lightingConstants.SHADOW_PROJECTION.RIGHT.value,
                    bottom: lightingConstants.SHADOW_PROJECTION.BOTTOM.value,
                    top: lightingConstants.SHADOW_PROJECTION.TOP.value,
                    near: lightingConstants.SHADOW_PROJECTION.NEAR.value,
                    far: lightingConstants.SHADOW_PROJECTION.FAR.value
                }
            });

            this._boundsLogged = true;
        }

        // Bind and upload position data
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        // Set up position attribute
        gl.vertexAttribPointer(this.shadowLocations.position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.shadowLocations.position);

        // Bind and upload index data
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        // Draw object
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

        // Clean up temporary buffers
        gl.deleteBuffer(positionBuffer);
        gl.deleteBuffer(indexBuffer);
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
            console.log(`Shadow map bound to texture unit ${unitIndex}`);

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
     * Get shadow projection parameters
     * @returns {Object} Shadow projection bounds
     */
    getShadowProjection() {
        return {
            left: this.constants.SHADOW_PROJECTION.LEFT.value,
            right: this.constants.SHADOW_PROJECTION.RIGHT.value,
            bottom: this.constants.SHADOW_PROJECTION.BOTTOM.value,
            top: this.constants.SHADOW_PROJECTION.TOP.value,
            near: this.constants.SHADOW_PROJECTION.NEAR.value,
            far: this.constants.SHADOW_PROJECTION.FAR.value
        };
    }

    /**
     * Sync shadow settings with constants
     * Call this when shadow settings are changed through debug panel
     */
    syncWithConstants() {
        // Check if shadow map size has changed
        if (this.shadowMapSize !== this.constants.SHADOW_MAP.SIZE.value) {
            this.shadowMapSize = this.constants.SHADOW_MAP.SIZE.value;
            this.setupShadowMap(); // Recreate shadow map with new size
        }

        // Update bias value
        this.shadowBias = this.constants.SHADOW_MAP.BIAS.value;
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
        this.setupShadowMap();

        console.log(`Applied shadow quality preset: ${preset.name}`);
    }

    /**
     * Debug function to analyze the contents of the shadow map
     * This helps understand what values are actually in the depth texture
     */
    debugAnalyzeShadowMap() {
        const gl = this.gl;

        // We need WebGL2 to read pixels from a depth texture directly
        if (!this.isWebGL2) {
            console.warn("Shadow map analysis is only supported in WebGL2");
            return {
                error: "WebGL2 required for shadow map analysis"
            };
        }

        try {
            // Create a framebuffer to read from the shadow texture
            const tempFramebuffer = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, tempFramebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTexture, 0);

            // Check if framebuffer is complete
            const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
            if (status !== gl.FRAMEBUFFER_COMPLETE) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.deleteFramebuffer(tempFramebuffer);
                console.error(`Cannot read shadow map, framebuffer status: ${status}`);
                return {
                    error: "Framebuffer incomplete"
                };
            }

            // Read a sample of pixels (center and corners)
            const pixelSize = 4; // RGBA format (4 bytes per pixel)
            const pixelData = new Float32Array(pixelSize);

            // Sample positions to check
            const samplePositions = [
                { x: this.shadowMapSize / 2, y: this.shadowMapSize / 2, name: "center" },
                { x: 10, y: 10, name: "top-left" },
                { x: this.shadowMapSize - 10, y: 10, name: "top-right" },
                { x: 10, y: this.shadowMapSize - 10, name: "bottom-left" },
                { x: this.shadowMapSize - 10, y: this.shadowMapSize - 10, name: "bottom-right" }
            ];

            const results = {};

            // Sample pixels at different positions
            samplePositions.forEach((pos) => {
                gl.readPixels(pos.x, pos.y, 1, 1, gl.RGBA, gl.FLOAT, pixelData);

                results[pos.name] = {
                    r: pixelData[0],
                    g: pixelData[1],
                    b: pixelData[2],
                    a: pixelData[3]
                };
            });

            // Cleanup
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.deleteFramebuffer(tempFramebuffer);

            console.log("Shadow map analysis:", results);
            return results;
        } catch (error) {
            console.error("Error analyzing shadow map:", error);
            return {
                error: error.message || "Unknown error"
            };
        }
    }

    /**
     * Reset the debug state to enable new debug logging
     */
    resetDebugState() {
        this._boundsLogged = false;
    }
}