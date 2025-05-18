// actionengine/display/graphics/lighting/actionomnidirectionalshadowlight.js

/**
 * Omnidirectional light with shadow mapping capability
 * This light type simulates light emitting in all directions from a point,
 * like a lightbulb or torch, with appropriate shadow casting.
 */
class ActionOmnidirectionalShadowLight extends ActionLight {
    /**
     * Constructor for an omnidirectional shadow light
     * @param {WebGLRenderingContext} gl - The WebGL rendering context
     * @param {boolean} isWebGL2 - Flag indicating if WebGL2 is available
     * @param {ProgramManager} programManager - Reference to the program manager for shader access
     */
    constructor(gl, isWebGL2, programManager) {
        super(gl, isWebGL2);
        
        this.programManager = programManager;
        
        // Point light specific properties
        this.radius = 100.0; // Light radius - affects attenuation
        
        // Enable shadows by default for omnidirectional lights
        this.castsShadows = true;
        
        // Shadow map settings from constants
        this.shadowMapSize = this.constants.POINT_LIGHT_SHADOW_MAP.SIZE.value;
        this.shadowBias = this.constants.POINT_LIGHT_SHADOW_MAP.BIAS.value;
        
        // Create matrices for shadow calculations (one per cubemap face)
        this.lightProjectionMatrix = Matrix4.create();
        this.lightViewMatrices = [];
        for (let i = 0; i < 6; i++) {
            this.lightViewMatrices.push(Matrix4.create());
        }
        this.lightSpaceMatrices = [];
        for (let i = 0; i < 6; i++) {
            this.lightSpaceMatrices.push(Matrix4.create());
        }
        
        // For tracking position changes
        this._lastPosition = undefined;
        
        // Initialize shadow map resources and shader program
        if (this.castsShadows) {
            this.setupShadowMap();
            this.setupShadowShaderProgram();
            this.createReusableBuffers();
        }
    }
    
    /**
     * Set the light radius (affects attenuation)
     * @param {number} radius - The new radius value
     */
    setRadius(radius) {
        this.radius = radius;
    }
    
    /**
     * Get the light radius
     * @returns {number} - The current radius
     */
    getRadius() {
        return this.radius;
    }
    
    /**
     * Override the update method to check for position changes
     * @returns {boolean} - Whether any properties changed this frame
     */
    update() {
        let changed = super.update();
        
        // If any properties changed and shadows are enabled,
        // update the light space matrices
        if (changed && this.castsShadows) {
            this.updateLightSpaceMatrices();
        }
        
        return changed;
    }
    
    /**
     * Set up shadow map framebuffer and texture
     * Creates a cubemap texture for omnidirectional shadows
     * @param {number} lightIndex - Index of the light (for multiple lights)
     */
    setupShadowMap(lightIndex = 0) {
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

        // For WebGL2, use a depth cubemap
        if (this.isWebGL2) {
            // Create the shadow cubemap texture
            this.shadowTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.shadowTexture);
            
            // Initialize each face of the cubemap
            const faces = [
                gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
                gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
                gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
            ];
            
            for (const face of faces) {
                // Use RGBA format for compatibility with both WebGL1 and WebGL2
                gl.texImage2D(
                    face,
                    0,
                    gl.RGBA,
                    this.shadowMapSize,
                    this.shadowMapSize,
                    0,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    null
                );
            }
            
            // Set up texture parameters
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
            
            // Create and attach a renderbuffer for depth (we're not reading this)
            this.depthBuffer = gl.createRenderbuffer();
            gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer);
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.shadowMapSize, this.shadowMapSize);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depthBuffer);
        } 
        else {
            // WebGL1 doesn't support cubemap rendering, so we'll use 6 separate textures
            this.shadowTextures = [];
            this.shadowFramebuffers = [];
            this.depthBuffers = [];
            
            // Create 6 separate framebuffers and textures (one for each face)
            for (let i = 0; i < 6; i++) {
                const fbo = gl.createFramebuffer();
                gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
                
                const texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, texture);
                
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
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
                
                // Create and attach a renderbuffer for depth
                const depthBuffer = gl.createRenderbuffer();
                gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
                gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.shadowMapSize, this.shadowMapSize);
                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);
                
                this.shadowTextures.push(texture);
                this.shadowFramebuffers.push(fbo);
                this.depthBuffers.push(depthBuffer);
            }
        }

        // Store the light index for later use
        this.lightIndex = lightIndex;

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

            // Create shadow map program with a distinct program name
            this.shadowProgram = this.programManager.createShaderProgram(
                shadowShader.getOmniShadowVertexShader(this.isWebGL2),
                shadowShader.getOmniShadowFragmentShader(this.isWebGL2),
                "omnidirectional_shadow_pass" // Distinct name from directional shadows
            );

            // Get attribute and uniform locations
            this.shadowLocations = {
                position: this.gl.getAttribLocation(this.shadowProgram, "aPosition"),
                lightSpaceMatrix: this.gl.getUniformLocation(this.shadowProgram, "uLightSpaceMatrix"),
                modelMatrix: this.gl.getUniformLocation(this.shadowProgram, "uModelMatrix"),
                lightPos: this.gl.getUniformLocation(this.shadowProgram, "uLightPos"),
                farPlane: this.gl.getUniformLocation(this.shadowProgram, "uFarPlane"),
                debugShadowMap: this.gl.getUniformLocation(this.shadowProgram, "uDebugShadowMap"),
                forceShadowMapTest: this.gl.getUniformLocation(this.shadowProgram, "uForceShadowMapTest"),
                shadowMapSize: this.gl.getUniformLocation(this.shadowProgram, "uShadowMapSize")
            };
        } catch (error) {
            console.error("Error setting up shadow shader program:", error);
        }
    }
    
    /**
     * Updates light space matrices for all cubemap faces based on light position
     * This creates the view and projection matrices needed for shadow mapping
     */
    updateLightSpaceMatrices() {
        // For point light, use perspective projection with 90-degree FOV for each cube face
        const aspect = 1.0; // Always 1.0 for cubemap faces
        const near = 0.1;
        const far = 500.0; // Should be large enough for your scene

        // Create light projection matrix (perspective for point light)
        Matrix4.perspective(
            this.lightProjectionMatrix,
            Math.PI / 2.0, // 90 degrees in radians
            aspect,
            near,
            far
        );

        // Define the 6 view directions for cubemap faces
        const directions = [
            { target: [ 1,  0,  0], up: [0, -1,  0] }, // +X
            { target: [-1,  0,  0], up: [0, -1,  0] }, // -X
            { target: [ 0,  1,  0], up: [0,  0,  1] }, // +Y
            { target: [ 0, -1,  0], up: [0,  0, -1] }, // -Y
            { target: [ 0,  0,  1], up: [0, -1,  0] }, // +Z
            { target: [ 0,  0, -1], up: [0, -1,  0] }  // -Z
        ];

        // Create view matrices for each direction
        for (let i = 0; i < 6; i++) {
            const target = [
                this.position.x + directions[i].target[0],
                this.position.y + directions[i].target[1],
                this.position.z + directions[i].target[2]
            ];

            Matrix4.lookAt(
                this.lightViewMatrices[i],
                this.position.toArray(),
                target,
                directions[i].up
            );

            // Combine into light space matrix
            Matrix4.multiply(
                this.lightSpaceMatrices[i],
                this.lightProjectionMatrix,
                this.lightViewMatrices[i]
            );
        }
    }
    
    /**
     * Begin shadow map rendering pass for a specific face
     * @param {number} faceIndex - Index of the cube face to render (0-5)
     * @param {number} lightIndex - Index of the light (for multiple lights)
     */
    beginShadowPass(faceIndex, lightIndex = 0) {
        const gl = this.gl;

        // Save current viewport
        if (!this._savedViewport) {
            this._savedViewport = gl.getParameter(gl.VIEWPORT);
        }

        // Create shadow maps on demand if they don't exist for this light
        if (!this.shadowFramebuffer && !this.shadowTexture) {
            this.setupShadowMap(lightIndex);
        }

        if (this.isWebGL2) {
            // Bind shadow framebuffer
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
            
            // Set the appropriate cubemap face as the color attachment
            const faces = [
                gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
                gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
                gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
            ];
            
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.COLOR_ATTACHMENT0,
                faces[faceIndex],
                this.shadowTexture,
                0
            );
        } else {
            // In WebGL1, use the corresponding framebuffer for this face
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffers[faceIndex]);
        }
        
        gl.viewport(0, 0, this.shadowMapSize, this.shadowMapSize);

        // Clear the framebuffer
        gl.clearColor(1.0, 1.0, 1.0, 1.0); // White (far depth)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Use shadow mapping program
        gl.useProgram(this.shadowProgram);

        // Set light space matrix uniform for this face
        gl.uniformMatrix4fv(this.shadowLocations.lightSpaceMatrix, false, this.lightSpaceMatrices[faceIndex]);
        
        // Set light position uniform
        gl.uniform3f(this.shadowLocations.lightPos, this.position.x, this.position.y, this.position.z);
        
        // Set far plane uniform
        gl.uniform1f(this.shadowLocations.farPlane, 500.0);

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
        if (this._savedViewport) {
            gl.viewport(this._savedViewport[0], this._savedViewport[1], this._savedViewport[2], this._savedViewport[3]);
        }
    }
    
    /**
     * Render a single object to the shadow map for a specific face
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
     * Get the light space matrix for a specific face
     * @param {number} faceIndex - Index of the face (0-5)
     * @returns {Float32Array} - The light space transformation matrix
     */
    getLightSpaceMatrix(faceIndex = 0) {
        return this.lightSpaceMatrices[Math.min(faceIndex, 5)];
    }
    
    /**
     * Apply this light's uniforms to a shader program
     * @param {WebGLProgram} program - The shader program
     * @param {number} index - Index of this light in an array of lights (for future multi-light support)
     */
    applyToShader(program, index = 0) {
        const gl = this.gl;
        
        // Use indexed uniform names for lights beyond the first one
        const indexSuffix = index > 0 ? index.toString() : '';
        
        // Select the right uniform names based on index
        let posUniform, intensityUniform, radiusUniform, shadowMapUniform, shadowsEnabledUniform;
        
        if (index === 0) {
            // First light uses legacy names (no suffix)
            posUniform = "uPointLightPos";
            intensityUniform = "uPointLightIntensity";
            radiusUniform = "uLightRadius"; // Different name for first light!
            shadowMapUniform = "uPointShadowMap";
            shadowsEnabledUniform = "uPointShadowsEnabled";
        } else {
            // Additional lights use indexed names
            posUniform = `uPointLightPos${indexSuffix}`;
            intensityUniform = `uPointLightIntensity${indexSuffix}`;
            radiusUniform = `uPointLightRadius${indexSuffix}`;
            shadowMapUniform = `uPointShadowMap${indexSuffix}`;
            shadowsEnabledUniform = `uPointShadowsEnabled${indexSuffix}`;
        }
        
        // Get uniform locations
        const lightPosLoc = gl.getUniformLocation(program, posUniform);
        const lightIntensityLoc = gl.getUniformLocation(program, intensityUniform);
        const lightRadiusLoc = gl.getUniformLocation(program, radiusUniform);
        const shadowMapLoc = gl.getUniformLocation(program, shadowMapUniform);
        const shadowsEnabledLoc = gl.getUniformLocation(program, shadowsEnabledUniform);
        const shadowBiasLoc = gl.getUniformLocation(program, "uShadowBias");
        const farPlaneLoc = gl.getUniformLocation(program, "uFarPlane");
        
        // Detailed logs commented out to reduce console noise
        /*
        // Keep minimal logs for light setup
        if (index === 0) {
            console.log(`[PointLight:${index}] Setting up primary light`); 
        } else {
            console.log(`[PointLight:${index}] Setting up additional light`);
        }
        
        console.log(`[PointLight:${index}] Setting up with: ${posUniform}, ${intensityUniform}, ${radiusUniform}`);
        console.log(`Light position: (${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}, ${this.position.z.toFixed(2)})`);
        console.log(`Light intensity: ${this.intensity.toFixed(2)}, Light radius: ${this.radius.toFixed(2)}, Shadows: ${this.castsShadows}`);
        */

        
        // Set light position
        if (lightPosLoc !== null) {
            gl.uniform3f(lightPosLoc, this.position.x, this.position.y, this.position.z);
        }
        
        // Set light intensity
        if (lightIntensityLoc !== null) {
            gl.uniform1f(lightIntensityLoc, this.intensity);
        }
        
        // Set light radius
        if (lightRadiusLoc !== null) {
            gl.uniform1f(lightRadiusLoc, this.radius);
        }
        
        // Apply shadow mapping uniforms if shadows are enabled
        if (this.castsShadows) {
            
            // Set shadows enabled flag
            if (shadowsEnabledLoc !== null) {
                gl.uniform1i(shadowsEnabledLoc, 1); // 1 = true
            }
            
            // Set shadow bias
            if (shadowBiasLoc !== null) {
                gl.uniform1f(shadowBiasLoc, this.shadowBias);
            }
            
            // Set far plane
            if (farPlaneLoc !== null) {
                gl.uniform1f(farPlaneLoc, 500.0);
            }
        } else if (shadowsEnabledLoc !== null) {
            // Shadows are disabled for this light
            gl.uniform1i(shadowsEnabledLoc, 0); // 0 = false
        }
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
        
        if (this.isWebGL2) {
            if (this.depthBuffer) {
                gl.deleteRenderbuffer(this.depthBuffer);
                this.depthBuffer = null;
            }
        } else {
            // Clean up WebGL1 resources (multiple framebuffers and textures)
            if (this.shadowFramebuffers) {
                for (const fbo of this.shadowFramebuffers) {
                    gl.deleteFramebuffer(fbo);
                }
                this.shadowFramebuffers = null;
            }
            
            if (this.shadowTextures) {
                for (const texture of this.shadowTextures) {
                    gl.deleteTexture(texture);
                }
                this.shadowTextures = null;
            }
            
            if (this.depthBuffers) {
                for (const depthBuffer of this.depthBuffers) {
                    gl.deleteRenderbuffer(depthBuffer);
                }
                this.depthBuffers = null;
            }
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