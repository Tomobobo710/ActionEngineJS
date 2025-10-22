// actionengine/display/graphics/lighting/actionomnidirectionalshadowlight.js
import { ActionLight } from './actionlight.js';
import { Vector3 } from '../../math/vector3.js';
import { Matrix4 } from '../../math/matrix4.js';
import { ProgramManager } from '../../display/gl/programmanager.js';
import { ShadowShader } from '../../display/gl/shaders/shadowshader.js';
import { lightingConstants } from './lightingconstants.js';

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
        
        // Object geometry tracking (shared across all cubemap faces)
        this.objectGeometry = new Map(); // object -> {vertexOffset, indexOffset, indexCount, originalTriangles}
        
        console.log(`[ActionOmnidirectionalShadowLight] Initialized static shadow geometry system for ${this.maxShadowTriangles} triangles`);
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
            console.warn(`[OmnidirectionalShadowLight] Not enough space in static shadow buffer for object with ${triangleCount} triangles. Using fallback rendering.`);
            
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
        
        console.log(`[OmnidirectionalShadowLight] Initialized shadow geometry for object: ${triangleCount} triangles at offset ${geometryInfo.indexOffset}`);
        
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
        gl.bufferData(gl.ARRAY_BUFFER, geometry.positions.subarray(0, geometry.currentVertexOffset * 3), gl.STATIC_DRAW);
        
        // Upload index data
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.shadowBuffers.index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices.subarray(0, geometry.currentIndexOffset), gl.STATIC_DRAW);
        
        this._geometryBufferDirty = false;
        console.log(`[OmnidirectionalShadowLight] Uploaded static shadow geometry: ${geometry.currentVertexOffset} vertices, ${geometry.currentIndexOffset} indices`);
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
        
        // Reset static geometry binding flag for this shadow pass
        this._staticGeometryBound = false;

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
     * Render a single object to the shadow map for a specific face
     * @param {Object} object - Single object to render
     */
    renderObjectToShadowMap(object) {
        const gl = this.gl;
        const triangles = object.triangles;

        // Skip if object has no triangles
        if (!triangles || triangles.length === 0) {
            return;
        }

        // Use identity model matrix since triangles are already in world space
        const modelMatrix = Matrix4.create();
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

        // Use buffer orphaning to avoid stalls
        gl.bindBuffer(gl.ARRAY_BUFFER, this.shadowBuffers.position);
        gl.bufferData(gl.ARRAY_BUFFER, this._positionsArray.byteLength, gl.DYNAMIC_DRAW);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._positionsArray.subarray(0, totalVertices * 3));

        // Set up position attribute
        gl.vertexAttribPointer(this.shadowLocations.position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.shadowLocations.position);

        // Upload index data
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.shadowBuffers.index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._indicesArray.byteLength, gl.DYNAMIC_DRAW);
        gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, this._indicesArray.subarray(0, totalVertices));

        // Draw object
        gl.drawElements(gl.TRIANGLES, totalVertices, gl.UNSIGNED_SHORT, 0);
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
            //console.log(`[PointLight:${index}] Shadows enabled, shadowsEnabledLoc: ${shadowsEnabledLoc}, shadowMapLoc: ${shadowMapLoc}`);
            
            // Set shadows enabled flag
            if (shadowsEnabledLoc !== null) {
                gl.uniform1i(shadowsEnabledLoc, 1); // 1 = true
                //console.log(`[PointLight:${index}] Set ${shadowsEnabledUniform} to true`);
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
            //console.log(`[PointLight:${index}] Shadows disabled, set ${shadowsEnabledUniform} to false`);
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