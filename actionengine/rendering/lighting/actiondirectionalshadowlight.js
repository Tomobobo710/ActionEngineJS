//actionengine/rendering/lighting/actiondirectionalshadowlight.js

/**
 * Directional light with shadow mapping capability
 * This light type simulates light coming from a distance in a specific direction,
 * like sunlight, with parallel light rays.
 */
class ActionDirectionalShadowLight extends ActionLight {
    /**
     * Constructor for a directional shadow light
     * @param {WebGLRenderingContext} gl - The WebGL rendering context
     * @param {ProgramManager} programManager - Reference to the program manager for shader access
     * @param {ObjectRenderer3D} objectRenderer - Reference to object renderer for mesh library access
     */
    constructor(gl, programManager, objectRenderer = null) {
        super(gl);

        this.programManager = programManager;
        this.objectRenderer = objectRenderer;

        // Directional light specific properties
        this.direction = new Vector3(0, -1, 0);

        // Enable shadows by default for directional lights
        this.castsShadows = true;

        // Shadow map settings from constants
        this.shadowMapSize = this.constants.SHADOW_MAP.SIZE.value;
        this.shadowBias = 0;
        this.shadowSlopeBias = 0;
        this.shadowNormalOffset = 0;

        // For tracking direction changes
        this._lastDirection = undefined;

        // Create matrices for shadow calculations
        this.lightProjectionMatrix = Matrix4.create();
        this.lightViewMatrix = Matrix4.create();
        this.lightSpaceMatrix = Matrix4.create();

        // --- Cascaded Shadow Maps (CSM) state. Parallel to the single-map fields above; populated only
        // when CSM is enabled. Storage is ONE depth TEXTURE_2D_ARRAY of `maxCascades` layers (all the
        // same shadowMapSize) plus one FBO per layer. cascadeCount is the live 1..max count actually in
        // use this frame; the upper layers of the array just sit unused. ---
        this.csmEnabled = false;
        this.maxCascades = (this.constants.AUTO_SHADOW.CSM && this.constants.AUTO_SHADOW.CSM.MAX) || 4;
        this.cascadeCount = 0;
        this.cascadeArrayTexture = null; // TEXTURE_2D_ARRAY depth, created lazily on first CSM use
        this.cascadeFramebuffers = []; // one FBO per layer (framebufferTextureLayer)
        this._cascadeMapSize = 0; // size the array was last allocated at (for resize detection)
        this.cascadeMatrices = new Float32Array(16 * this.maxCascades); // packed light-space matrices
        this.cascadeSplits = new Float32Array(this.maxCascades); // far view-distance of each cascade
        this.cascadeBias = new Float32Array(this.maxCascades); // per-cascade flat bias (geometry-derived)
        this.cascadeSlopeBias = new Float32Array(this.maxCascades); // per-cascade slope bias base
        this.cascadeNormalOffset = new Float32Array(this.maxCascades); // per-cascade world normal offset
        this._tmpProj = Matrix4.create(); // scratch for per-cascade matrix build
        this._tmpView = Matrix4.create();

        // Initialize shadow map resources and shader program
        if (this.castsShadows) {
            this.setupShadowMap();
            this.setupShadowShaderProgram();
        }
    }

    /**
     * Set the light direction
     * @param {Vector3} direction - The new direction vector (will be normalized)
     */
    setDirection(direction) {
        // Use copy if it exists, otherwise fall back to direct assignment
        if (typeof this.direction.copy === "function") {
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
        if (
            this._lastDirection === undefined ||
            this._lastDirection.x !== this.direction.x ||
            this._lastDirection.y !== this.direction.y ||
            this._lastDirection.z !== this.direction.z
        ) {
            // Cache current direction to detect changes
            this._lastDirection = {
                x: this.direction.x,
                y: this.direction.y,
                z: this.direction.z
            };

            changed = true;
        }

        // Light space matrix is updated each frame by the renderer via updateLightSpaceMatrix(fit)

        return changed;
    }

    /**
     * Update properties from global lighting constants
     */
    syncWithConstants() {
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

        // Proper depth texture with full floating-point precision
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.DEPTH_COMPONENT32F, // Full 32-bit depth format
            this.shadowMapSize,
            this.shadowMapSize,
            0,
            gl.DEPTH_COMPONENT, // Depth format
            gl.FLOAT, // Full precision
            null
        );

        // Set up texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Attach depth texture to framebuffer
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.DEPTH_ATTACHMENT, // Attach depth texture to depth attachment point
            gl.TEXTURE_2D,
            this.shadowTexture,
            0
        );

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
        // OPTIMIZED: Create shared shadow geometry buffer for static triangles
        this.maxShadowTriangles = 500000; // Increased to 500k triangles to handle large scenes
        this.maxShadowVertices = this.maxShadowTriangles * 3;

        // Create shared static geometry buffer
        this.staticShadowGeometry = {
            positions: new Float32Array(this.maxShadowVertices * 3),
            indices: new Uint16Array(this.maxShadowVertices),
            currentVertexOffset: 0,
            currentIndexOffset: 0
        };

        // Create GL buffers for static geometry
        this.shadowBuffers = {
            position: this.gl.createBuffer(),
            index: this.gl.createBuffer()
        };

        // Object geometry tracking
        this.objectGeometry = new Map(); // object -> {vertexOffset, indexOffset, indexCount, originalTriangles}

        console.log(
            `[ActionDirectionalShadowLight] Initialized static shadow geometry system for ${this.maxShadowTriangles} triangles`
        );
    }
    /**
     * Initialize static shadow geometry for an object (called once per object)
     * This uploads the object's original triangles to the shared static geometry buffer
     * @param {Object} object - The object to initialize
     */
    initializeObjectShadowGeometry(object) {
        // Skip if already initialized or no triangles
        if (this.objectGeometry.has(object) || !object.triangles || object.triangles.length === 0) {
            return;
        }

        // Use original triangles if available (for transform via model matrix)
        // Otherwise fall back to current triangles
        let sourceTriangles;
        if (object._originalTriangles && object._originalTriangles.length > 0) {
            sourceTriangles = object._originalTriangles; // Use untransformed triangles for physics objects
        } else if (object.characterModel && object.characterModel.triangles) {
            sourceTriangles = object.characterModel.triangles; // Use character model triangles
        } else {
            sourceTriangles = object.triangles; // Fallback to current triangles
        }

        const triangleCount = sourceTriangles.length;
        const vertexCount = triangleCount * 3;

        // Check if we have space in the static buffer
        if (this.staticShadowGeometry.currentVertexOffset + vertexCount > this.maxShadowVertices) {
            console.warn(
                `[DirectionalShadowLight] Not enough space in static shadow buffer for object with ${triangleCount} triangles. Using fallback rendering.`
            );

            // Mark this object to use fallback rendering (old method)
            this.objectGeometry.set(object, { useFallback: true });
            return;
        }

        const gl = this.gl;
        const geometry = this.staticShadowGeometry;

        // Store geometry info for this object
        const geometryInfo = {
            vertexOffset: geometry.currentVertexOffset,
            indexOffset: geometry.currentIndexOffset,
            indexCount: vertexCount,
            triangleCount: triangleCount,
            needsModelMatrix: true // Flag indicating this object needs model matrix transforms
        };

        // Fill geometry arrays with original triangle data
        for (let i = 0; i < triangleCount; i++) {
            const triangle = sourceTriangles[i];

            for (let j = 0; j < 3; j++) {
                const vertex = triangle.vertices[j];
                const vertexIndex = (geometry.currentVertexOffset + i * 3 + j) * 3;

                // Store original vertex positions (before any transformations)
                geometry.positions[vertexIndex] = vertex.x;
                geometry.positions[vertexIndex + 1] = vertex.y;
                geometry.positions[vertexIndex + 2] = vertex.z;

                // Set up indices
                geometry.indices[geometry.currentIndexOffset + i * 3 + j] = geometry.currentVertexOffset + i * 3 + j;
            }
        }

        // Update offsets for next object
        geometry.currentVertexOffset += vertexCount;
        geometry.currentIndexOffset += vertexCount;

        // Store geometry info
        this.objectGeometry.set(object, geometryInfo);

        console.log(
            `[DirectionalShadowLight] Initialized shadow geometry for object: ${triangleCount} triangles at offset ${geometryInfo.indexOffset}`
        );

        // Mark that we need to upload the updated geometry buffer
        this._geometryBufferDirty = true;
    }

    /**
     * Upload the static geometry buffer to GPU (called when geometry changes)
     */
    uploadStaticGeometry() {
        if (!this._geometryBufferDirty) {
            return;
        }

        const gl = this.gl;
        const geometry = this.staticShadowGeometry;

        // Upload position data
        gl.bindBuffer(gl.ARRAY_BUFFER, this.shadowBuffers.position);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            geometry.positions.subarray(0, geometry.currentVertexOffset * 3),
            gl.STATIC_DRAW
        );

        // Upload index data
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.shadowBuffers.index);
        gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            geometry.indices.subarray(0, geometry.currentIndexOffset),
            gl.STATIC_DRAW
        );

        this._geometryBufferDirty = false;
        console.log(
            `[DirectionalShadowLight] Uploaded static shadow geometry: ${geometry.currentVertexOffset} vertices, ${geometry.currentIndexOffset} indices`
        );
    }

    /**
     * Set up shadow shader program and get all necessary locations
     */
    setupShadowShaderProgram() {
        try {
            const shadowShader = new ShadowShader();

            // Create shadow map program using directional-specific shaders
            this.shadowProgram = this.programManager.createShaderProgram(
                shadowShader.getDirectionalShadowVertexShader(),
                shadowShader.getDirectionalShadowFragmentShader(),
                "directional_shadow_pass" // Use distinct name to avoid conflicts
            );

            // Get attribute and uniform locations
            this.shadowLocations = {
                position: this.gl.getAttribLocation(this.shadowProgram, "aPosition"),
                boneIndices: this.gl.getAttribLocation(this.shadowProgram, "aBoneIndices"),
                boneWeights: this.gl.getAttribLocation(this.shadowProgram, "aBoneWeights"),
                lightSpaceMatrix: this.gl.getUniformLocation(this.shadowProgram, "uLightSpaceMatrix"),
                modelPos: this.gl.getUniformLocation(this.shadowProgram, "uModelPos"),
                modelRotation: this.gl.getUniformLocation(this.shadowProgram, "uModelRotation"),
                modelScale: this.gl.getUniformLocation(this.shadowProgram, "uModelScale"),
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
    updateLightSpaceMatrix(fit) {
        // Two paths:
        //  - fit provided (from ActionShadowFit, when SHADOW_PROJECTION.AUTO_FIT is on): use the
        //    fitted ortho box + camera-tracking eye. `fit.eye` is the shadow camera position; it is
        //    deliberately NOT written back to this.position, which stays the visual sun location.
        //  - no fit: the original behaviour — static SHADOW_PROJECTION constants, eye at this.position.
        let left, right, bottom, top, near, far, eyeArr, upVector;

        // Remember the fit (or lack of one) so the frustum visualizer can draw the box actually in use.
        this._lastFit = fit || null;

        left = fit.left;
        right = fit.right;
        bottom = fit.bottom;
        top = fit.top;
        near = fit.near;
        far = fit.far;
        eyeArr = fit.eye.toArray();
        upVector = fit.up.toArray();

        // Create light projection matrix (orthographic for directional light)
        Matrix4.ortho(this.lightProjectionMatrix, left, right, bottom, top, near, far);

        // Light view: look from the eye along the light direction (target a fixed step ahead)
        const target = [
            eyeArr[0] + this.direction.x * 100.0,
            eyeArr[1] + this.direction.y * 100.0,
            eyeArr[2] + this.direction.z * 100.0
        ];

        Matrix4.lookAt(this.lightViewMatrix, eyeArr, target, upVector);

        // Combine into light space matrix
        Matrix4.multiply(this.lightSpaceMatrix, this.lightProjectionMatrix, this.lightViewMatrix);
    }

    /**
     * Allocate (or reallocate) the cascade depth texture array + per-layer framebuffers. Called lazily
     * the first time CSM is used and whenever the shadow map size changes. One DEPTH_COMPONENT32F
     * TEXTURE_2D_ARRAY of `maxCascades` layers, plus one FBO per layer via framebufferTextureLayer.
     */
    setupCascadeMap() {
        const gl = this.gl;
        const size = this.shadowMapSize;
        if (this.cascadeArrayTexture && this._cascadeMapSize === size) {
            return; // already allocated at the right size
        }

        // Tear down any previous allocation
        if (this.cascadeFramebuffers.length) {
            for (const fb of this.cascadeFramebuffers) gl.deleteFramebuffer(fb);
            this.cascadeFramebuffers.length = 0;
        }
        if (this.cascadeArrayTexture) {
            gl.deleteTexture(this.cascadeArrayTexture);
            this.cascadeArrayTexture = null;
        }

        // Depth texture array — one layer per cascade, all the same resolution (a texture array
        // requires uniform layer dimensions, which is why every cascade shares one map size).
        this.cascadeArrayTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.cascadeArrayTexture);
        gl.texImage3D(
            gl.TEXTURE_2D_ARRAY,
            0,
            gl.DEPTH_COMPONENT32F,
            size,
            size,
            this.maxCascades,
            0,
            gl.DEPTH_COMPONENT,
            gl.FLOAT,
            null
        );
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // One framebuffer per layer so each cascade pass renders into its own slice.
        for (let i = 0; i < this.maxCascades; i++) {
            const fb = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, this.cascadeArrayTexture, 0, i);
            const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
            if (status !== gl.FRAMEBUFFER_COMPLETE) {
                console.error(`[ActionDirectionalShadowLight] Cascade framebuffer ${i} incomplete: ${status}`);
            }
            this.cascadeFramebuffers.push(fb);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this._cascadeMapSize = size;
    }

    /**
     * Build a light-space matrix (ortho projection × lookAt) from a single ActionShadowFit slice spec
     * into `outMat` (may be a Float32Array subarray view into cascadeMatrices).
     * @param {Object} fit - a fit spec from ActionShadowFit (left/right/bottom/top/near/far/eye/up)
     * @param {Float32Array} outMat - 16-float destination
     */
    _buildLightSpaceMatrix(fit, outMat) {
        Matrix4.ortho(this._tmpProj, fit.left, fit.right, fit.bottom, fit.top, fit.near, fit.far);
        const eye = fit.eye.toArray();
        const target = [
            eye[0] + this.direction.x * 100.0,
            eye[1] + this.direction.y * 100.0,
            eye[2] + this.direction.z * 100.0
        ];
        Matrix4.lookAt(this._tmpView, eye, target, fit.up.toArray());
        Matrix4.multiply(outMat, this._tmpProj, this._tmpView);
    }

    /**
     * Consume a fitCascades() result: build each cascade's light-space matrix and stash the per-cascade
     * split distance + geometry-derived biases (each cascade auto-derives its own from its own slice).
     * @param {{cascades:Array, splits:Float32Array}} fitResult
     */
    updateCascades(fitResult) {
        if (!fitResult || !fitResult.cascades || fitResult.cascades.length === 0) return;
        this.setupCascadeMap();

        const cascades = fitResult.cascades;
        const count = Math.min(cascades.length, this.maxCascades);
        this.cascadeCount = count;
        const normalSlack = this.constants.AUTO_SHADOW.NORMAL_SLACK_TEXELS;

        for (let i = 0; i < count; i++) {
            const fit = cascades[i];
            this._buildLightSpaceMatrix(fit, this.cascadeMatrices.subarray(i * 16, i * 16 + 16));
            this.cascadeSplits[i] = fitResult.splits[i];
            this.cascadeBias[i] = fit.bias;
            this.cascadeSlopeBias[i] = fit.slopeBias;
            this.cascadeNormalOffset[i] = fit.texel * normalSlack;
        }
        // Park unused upper slots at a huge split so the shader's "first cascade whose split > depth"
        // selection never lands on a stale cascade.
        for (let i = count; i < this.maxCascades; i++) {
            this.cascadeSplits[i] = 1e20;
        }
        this._lastFit = null; // CSM owns the frustum; clear the single-map visualizer record
    }

    /**
     * Begin a single cascade's shadow pass: bind that layer's framebuffer and upload its light-space
     * matrix to the shadow program. Mirrors beginShadowPass() but for one cascade of the array.
     * @param {number} cascadeIndex
     */
    beginCascadePass(cascadeIndex) {
        const gl = this.gl;
        this._savedViewport = gl.getParameter(gl.VIEWPORT);
        this._staticGeometryBound = false;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.cascadeFramebuffers[cascadeIndex]);
        gl.viewport(0, 0, this.shadowMapSize, this.shadowMapSize);
        gl.clear(gl.DEPTH_BUFFER_BIT); // depth-only array — no color attachment to clear

        gl.useProgram(this.shadowProgram);
        gl.uniformMatrix4fv(
            this.shadowLocations.lightSpaceMatrix,
            false,
            this.cascadeMatrices.subarray(cascadeIndex * 16, cascadeIndex * 16 + 16)
        );
        if (this.shadowLocations.shadowMapSize !== null) {
            gl.uniform1f(this.shadowLocations.shadowMapSize, this.shadowMapSize);
        }
    }

    /**
     * @returns {number} number of cascades active this frame (0 if CSM not in use)
     */
    getCascadeCount() {
        return this.csmEnabled ? this.cascadeCount : 0;
    }

    /**
     * Begin shadow map rendering pass
     */
    beginShadowPass() {
        const gl = this.gl;

        // Save current viewport
        this._savedViewport = gl.getParameter(gl.VIEWPORT);

        // Reset static geometry binding flag for this shadow pass
        this._staticGeometryBound = false;

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
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black (far depth)
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

        // Restore viewport if it was saved
        if (this._savedViewport) {
            gl.viewport(this._savedViewport[0], this._savedViewport[1], this._savedViewport[2], this._savedViewport[3]);
        } else {
            // Fallback to default viewport
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        }
    }

    /**
     * Render a single object to the shadow map
     * @param {Object} object - The object to render
     */
    /**

    
    /**
     * Helper method to fill batched shadow data
     * @param {Array} validObjects - Array of valid objects with metadata
     */
    fillBatchedShadowData(validObjects) {
        let vertexOffset = 0;

        for (const { object, triangleCount } of validObjects) {
            const triangles = object.triangles;

            for (let i = 0; i < triangles.length; i++) {
                const triangle = triangles[i];

                for (let j = 0; j < 3; j++) {
                    const vertex = triangle.vertices[j];
                    const baseIndex = (vertexOffset + i * 3 + j) * 3;

                    this.persistentShadowArrays.positions[baseIndex] = vertex.x;
                    this.persistentShadowArrays.positions[baseIndex + 1] = vertex.y;
                    this.persistentShadowArrays.positions[baseIndex + 2] = vertex.z;

                    this.persistentShadowArrays.indices[vertexOffset + i * 3 + j] = vertexOffset + i * 3 + j;
                }
            }

            vertexOffset += triangleCount * 3;
        }
    }

    /**
     * Render a single object to the shadow map
     * @param {Object} object - Single object to render
     */
    renderObjectToShadowMap(object) {
        const gl = this.gl;
        const triangles = object.triangles;

        // Skip if object has no triangles
        if (!triangles || triangles.length === 0) {
            return;
        }

        // Send GPU-side matrix construction uniforms
        // Extract transform components from object
        const transform = object.transform;
        if (transform) {
            // Send position as vec3 uniform
            if (this.shadowLocations.modelPos !== -1 && this.shadowLocations.modelPos !== null) {
                gl.uniform3fv(this.shadowLocations.modelPos, [
                    transform.position.x,
                    transform.position.y,
                    transform.position.z
                ]);
            }
            // Send rotation as vec4 uniform (quaternion)
            if (this.shadowLocations.modelRotation !== -1 && this.shadowLocations.modelRotation !== null) {
                gl.uniform4fv(this.shadowLocations.modelRotation, [
                    transform.rotation.x,
                    transform.rotation.y,
                    transform.rotation.z,
                    transform.rotation.w
                ]);
            }
            // Send scale as vec3 uniform
            if (this.shadowLocations.modelScale !== -1 && this.shadowLocations.modelScale !== null) {
                const s = transform.scale;
                if (s && typeof s === "object") {
                    this.gl.uniform3f(this.shadowLocations.modelScale, s.x, s.y, s.z);
                } else {
                    const val = s || 1.0;
                    this.gl.uniform3f(this.shadowLocations.modelScale, val, val, val);
                }
            }
        } else {
            // Fallback defaults
            if (this.shadowLocations.modelPos !== -1 && this.shadowLocations.modelPos !== null) {
                gl.uniform3fv(this.shadowLocations.modelPos, [0, 0, 0]);
            }
            if (this.shadowLocations.modelRotation !== -1 && this.shadowLocations.modelRotation !== null) {
                gl.uniform4fv(this.shadowLocations.modelRotation, [0, 0, 0, 1]);
            }
            if (this.shadowLocations.modelScale !== -1 && this.shadowLocations.modelScale !== null) {
                gl.uniform3f(this.shadowLocations.modelScale, 1.0, 1.0, 1.0);
            }
        }

        // Get mesh from ObjectRenderer3D library (guaranteed to exist from queue pass)
        const meshId = this.objectRenderer.getMeshIdForTriangles(triangles, object._stableMeshId);
        const mesh = this.objectRenderer._meshLibrary.get(meshId);

        if (!mesh) {
            console.warn("Shadow render: mesh not found in library for object", object);
            return;
        }

        // Use the VAO cache to bind all shadow attributes in one call.
        // buildShadowVAO() creates the VAO on first access and caches it on
        // the mesh, keyed by the shadow program object so different lights
        // with different programs each get their own cached VAO.
        const shadowVAO = this.objectRenderer.buildShadowVAO(
            mesh,
            this.shadowLocations,
            this.shadowProgram
        );
        gl.bindVertexArray(shadowVAO);

        // Bind bone matrix UBO if object has animations
        if (object && typeof object.getBoneMatrices === "function" && this.objectRenderer?.uboManager) {
            const objectId = object._stableMeshId;
            if (!this.objectRenderer.uboManager.getUBOInfo(objectId)) {
                this.objectRenderer.uboManager.createAnimatedObjectUBO(objectId);
            }
            const boneMatrices = object.getBoneMatrices();
            this.objectRenderer.uboManager.updateAnimatedObjectMatrices(
                objectId,
                this.objectRenderer._flattenMatrices(boneMatrices)
            );
            this.objectRenderer.uboManager.bindAnimatedObjectUBO(
                objectId,
                this.gl.getParameter(this.gl.CURRENT_PROGRAM)
            );
        }

        // Draw — index buffer is already bound inside the VAO
        gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
        gl.bindVertexArray(null);
    }
    /**
     * Get the model matrix for an object based on its current physics state
     * @param {Object} object - The object to get matrix for
     * @returns {Float32Array} - The model matrix
     */
    getObjectModelMatrix(object) {
        const modelMatrix = Matrix4.create();

        // For physics objects, use the body's current position and rotation
        if (object.body) {
            const pos = object.body.position;
            const rot = object.body.rotation;

            // Apply translation
            Matrix4.translate(modelMatrix, modelMatrix, [pos.x, pos.y, pos.z]);

            // Apply rotation from physics body quaternion
            const rotationMatrix = Matrix4.create();
            Matrix4.fromQuat(rotationMatrix, [rot.x, rot.y, rot.z, rot.w]);
            Matrix4.multiply(modelMatrix, modelMatrix, rotationMatrix);
        }
        // For objects with manual position/rotation
        else if (object.position) {
            Matrix4.translate(modelMatrix, modelMatrix, [object.position.x, object.position.y, object.position.z]);

            if (object.rotation !== undefined) {
                Matrix4.rotateY(modelMatrix, modelMatrix, object.rotation);
            }
        }

        return modelMatrix;
    }
    /**
     * Fallback rendering method for objects that don't fit in static buffer
     * Uses the original dynamic triangle upload approach
     * @param {Object} object - The object to render
     */
    renderObjectToShadowMapFallback(object) {
        const gl = this.gl;
        const triangles = object.triangles;

        // Skip if object has no triangles
        if (!triangles || triangles.length === 0) {
            return;
        }

        // Set model matrix for this object (identity since triangles are already transformed)
        const modelMatrix = Matrix4.create();
        gl.uniformMatrix4fv(this.shadowLocations.modelMatrix, false, modelMatrix);

        // Calculate total vertices and indices
        const totalVertices = triangles.length * 3;

        // Only allocate new arrays if needed or if size has changed
        if (!this._fallbackPositionsArray || this._fallbackPositionsArray.length < totalVertices * 3) {
            this._fallbackPositionsArray = new Float32Array(totalVertices * 3);
        }
        if (!this._fallbackIndicesArray || this._fallbackIndicesArray.length < totalVertices) {
            this._fallbackIndicesArray = new Uint16Array(totalVertices);
        }

        // Fill position and index arrays
        for (let i = 0; i < triangles.length; i++) {
            const triangle = triangles[i];

            // Process vertices
            for (let j = 0; j < 3; j++) {
                const vertex = triangle.vertices[j];
                const baseIndex = (i * 3 + j) * 3;

                this._fallbackPositionsArray[baseIndex] = vertex.x;
                this._fallbackPositionsArray[baseIndex + 1] = vertex.y;
                this._fallbackPositionsArray[baseIndex + 2] = vertex.z;

                // Set up indices
                this._fallbackIndicesArray[i * 3 + j] = i * 3 + j;
            }
        }

        // Create temporary buffers for fallback rendering
        if (!this._fallbackBuffers) {
            this._fallbackBuffers = {
                position: gl.createBuffer(),
                index: gl.createBuffer()
            };
        }

        // Bind and upload position data to fallback buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this._fallbackBuffers.position);
        gl.bufferData(gl.ARRAY_BUFFER, this._fallbackPositionsArray, gl.DYNAMIC_DRAW);

        // Set up position attribute
        gl.vertexAttribPointer(this.shadowLocations.position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.shadowLocations.position);

        // Bind and upload index data to fallback buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._fallbackBuffers.index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._fallbackIndicesArray, gl.DYNAMIC_DRAW);

        // Draw object using fallback method
        gl.drawElements(gl.TRIANGLES, totalVertices, gl.UNSIGNED_SHORT, 0);

        // Reset static geometry binding flag since we used different buffers
        this._staticGeometryBound = false;
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

        const lightDirLoc = gl.getUniformLocation(program, "uLightDir");
        const lightIntensityLoc = gl.getUniformLocation(program, "uLightIntensity");
        const shadowMapLoc = gl.getUniformLocation(program, "uShadowMap");
        const lightSpaceMatrixLoc = gl.getUniformLocation(program, "uLightSpaceMatrix");
        const shadowsEnabledLoc = gl.getUniformLocation(program, "uShadowsEnabled");
        const shadowBiasLoc = gl.getUniformLocation(program, "uShadowBias");
        const shadowSlopeBiasLoc = gl.getUniformLocation(program, "uShadowSlopeScaleBias");
        const shadowNormalOffsetLoc = gl.getUniformLocation(program, "uShadowNormalOffset");
        // CSM uniforms
        const csmEnabledLoc = gl.getUniformLocation(program, "uCSMEnabled");
        const cascadeCountLoc = gl.getUniformLocation(program, "uCascadeCount");
        const cascadeSplitsLoc = gl.getUniformLocation(program, "uCascadeSplits");
        const cascadeMatricesLoc = gl.getUniformLocation(program, "uCascadeMatrices");
        const cascadeBiasLoc = gl.getUniformLocation(program, "uCascadeBias");
        const cascadeSlopeBiasLoc = gl.getUniformLocation(program, "uCascadeSlopeBias");
        const cascadeNormalOffsetLoc = gl.getUniformLocation(program, "uCascadeNormalOffset");
        const cascadeBlendLoc = gl.getUniformLocation(program, "uCascadeBlendTexels");
        const shadowMapSizeLoc = gl.getUniformLocation(program, "uShadowMapSize");

        // Set light direction
        if (lightDirLoc !== null) {
            gl.uniform3f(lightDirLoc, this.direction.x, this.direction.y, this.direction.z);
        }

        // CSM toggle + per-cascade arrays. When CSM is on, the object shader transforms the fragment
        // into each cascade's light space itself (it picks the cascade by view depth), so it needs the
        // full matrix/split/bias arrays here. When off, this just writes uCSMEnabled=0 and the single-map
        // uniforms below drive shadowing.
        const csmActive = this.csmEnabled && this.cascadeCount > 0;
        if (csmEnabledLoc !== null) gl.uniform1i(csmEnabledLoc, csmActive ? 1 : 0);
        if (csmActive) {
            if (cascadeCountLoc !== null) gl.uniform1i(cascadeCountLoc, this.cascadeCount);
            if (cascadeSplitsLoc !== null) gl.uniform1fv(cascadeSplitsLoc, this.cascadeSplits);
            if (cascadeMatricesLoc !== null) gl.uniformMatrix4fv(cascadeMatricesLoc, false, this.cascadeMatrices);
            if (cascadeBiasLoc !== null) gl.uniform1fv(cascadeBiasLoc, this.cascadeBias);
            if (cascadeSlopeBiasLoc !== null) gl.uniform1fv(cascadeSlopeBiasLoc, this.cascadeSlopeBias);
            if (cascadeNormalOffsetLoc !== null) gl.uniform1fv(cascadeNormalOffsetLoc, this.cascadeNormalOffset);
            if (cascadeBlendLoc !== null) {
                const blend = this.constants.AUTO_SHADOW.CSM.BLEND_TEXELS.value;
                gl.uniform1f(cascadeBlendLoc, blend);
            }
            // The blend-band width (objectshader shadowCSM) is uCascadeBlendTexels / uShadowMapSize —
            // without this upload uShadowMapSize is 0, the shader clamps it to 1, and the band balloons
            // to blendTexels * cascadeRange (i.e. the whole cascade), smearing the seam across the
            // entire slice instead of a thin strip at the split.
            if (shadowMapSizeLoc !== null) gl.uniform1f(shadowMapSizeLoc, this.shadowMapSize);
        }

        // Set light intensity
        if (lightIntensityLoc !== null) {
            gl.uniform1f(lightIntensityLoc, this.intensity);
        }

        // Apply shadow mapping uniforms if shadows are enabled
        if (this.castsShadows) {
            // Set light space matrix
            if (lightSpaceMatrixLoc !== null) {
                gl.uniformMatrix4fv(lightSpaceMatrixLoc, false, this.lightSpaceMatrix);
            }

            // Set shadows enabled flag
            if (shadowsEnabledLoc !== null) {
                gl.uniform1i(shadowsEnabledLoc, 1); // 1 = true
            }

            // Set shadow bias (flat) and the slope bias base — both geometry-derived from the fit
            if (shadowBiasLoc !== null) {
                gl.uniform1f(shadowBiasLoc, this.shadowBias);
            }
            if (shadowSlopeBiasLoc !== null) {
                gl.uniform1f(shadowSlopeBiasLoc, this.shadowSlopeBias);
            }
            if (shadowNormalOffsetLoc !== null) {
                gl.uniform1f(shadowNormalOffsetLoc, this.shadowNormalOffset);
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
