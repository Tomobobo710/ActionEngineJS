// actionengine/display/graphics/renderers/actionrenderer3D/objectrenderer3D.js
class ObjectRenderer3D {
    constructor(renderer, gl, programManager, lightManager) {
        this.renderer = renderer;
        this.gl = gl;
        this.programManager = programManager;
        this.lightManager = lightManager;

        // Store the index element type for later use
        this.indexType = this.gl.UNSIGNED_INT;

        // Create buffer for each renderable object - support textures for all objects
        this.buffers = {
            position: this.gl.createBuffer(),
            normal: this.gl.createBuffer(),
            color: this.gl.createBuffer(),
            alpha: this.gl.createBuffer(), // Add alpha buffer for transparency
            uv: this.gl.createBuffer(), // Add texture coordinate buffer
            textureIndex: this.gl.createBuffer(), // Add texture index buffer
            useTexture: this.gl.createBuffer(), // Add use texture flag buffer
            indices: this.gl.createBuffer()
        };

        // Cache for pre-computed uniform values
        this._uniformCache = {
            frame: -1, // Current frame number for cache validation
            shaderProgram: null, // Current shader program
            camera: null, // Current camera reference
            lightConfig: null, // Cached light configuration
            matrices: {
                // Cached matrices
                projection: Matrix4.create(),
                view: Matrix4.create(),
                model: Matrix4.create(),
                lightSpace: null
            }
        };

        // Simple statistics
        this.stats = {
            objectsTotal: 0,
            objectsCulled: 0,
            uniformSetCount: 0 // Track how many uniform sets we perform
        };

        // Transparency support - track opaque vs transparent triangles
        this.opaqueIndices = [];
        this.transparentTriangles = []; // Store triangle indices for transparent triangles
    }

    queue(object, camera, currentTime) {
        // Skip rendering if object is invalid
        if (!object) {
            console.warn("Attempted to render null or undefined object");
            return;
        }

        // Initialize the object renderer for the current frame if needed
        if (!this._frameInitialized) {
            // Reset stats
            this.stats.objectsTotal = 0;
            this.stats.objectsCulled = 0;
            this.stats.uniformSetCount = 0;

            // Track all objects in the current frame
            this._frameObjects = [];
            this._frameObjectMatrices = []; // Track model matrix for each object
            this._totalTriangles = 0;
            this._frameInitialized = true;
            this._currentFrameTime = performance.now();

            // Store camera for batch rendering
            this._camera = camera;

            // Create persistent texture cache
            if (!this._textureCache) {
                this._textureCache = new Map();
            }

            // Reset the frame counter for uniform cache
            this._frameCount = (this._frameCount || 0) + 1;
        }

        // Update statistics
        this.stats.objectsTotal++;

        // Ensure object's visual geometry is up-to-date with its physics state
        if (typeof object.updateVisual === "function") {
            object.updateVisual();
        }

        const triangles = object.triangles;

        // Validate triangles exist
        if (!triangles || triangles.length === 0) {
            return; // Skip silently, this is a common case
        }

        const triangleCount = triangles.length;

        // Add this object to our frame tracking
        this._frameObjects.push(object);
        this._frameObjectMatrices.push(
            object.getModelMatrix ? object.getModelMatrix() : Matrix4.identity(Matrix4.create())
        );
        this._totalTriangles += triangleCount;
    }

    render() {
        if (this._frameObjects && this._frameObjects.length > 0) {
            this.drawObjects(this._camera);
            this._frameInitialized = false;
            this._frameObjects = [];
            this._frameObjectMatrices = [];
            this._totalTriangles = 0;
        }
    }

    drawObjects(camera) {
        // If we have no objects to render, just return
        if (!this._frameObjects || this._frameObjects.length === 0) {
            return;
        }

        // Calculate total vertex and index counts
        const totalVertexCount = this._totalTriangles * 9;
        const totalIndexCount = this._totalTriangles * 3;
        const totalUvCount = this._totalTriangles * 6;
        const totalFlagCount = this._totalTriangles * 3;

        // Check if we'd exceed the 16-bit index limit
        const exceeds16BitLimit = totalIndexCount > 65535;

        // WebGL2 supports 32-bit indices, so this limit no longer applies
        // Kept for reference: WebGL1 couldn't handle more than 65535 indices (16-bit limit)

        // Allocate or resize buffers if needed
        // OPTIMIZATION: Build indices once (they're always 0,1,2,3,4,5...)
        if (!this.cachedArrays || this.cachedArrays.positions.length < totalVertexCount) {
            // Choose correct index array type based on WebGL version
            const IndexArrayType = Uint32Array;

            this.cachedArrays = {
                positions: new Float32Array(totalVertexCount),
                normals: new Float32Array(totalVertexCount),
                colors: new Float32Array(totalVertexCount),
                alphas: new Float32Array(totalVertexCount / 3), // One alpha per vertex
                indices: new IndexArrayType(totalIndexCount)
            };

            // Build indices once (they're always sequential, never change)
            const indices = this.cachedArrays.indices;
            for (let i = 0; i < totalIndexCount; i++) {
                indices[i] = i;
            }
            this._lastBuiltIndexCount = totalIndexCount;
        } else if (totalIndexCount > this._lastBuiltIndexCount) {
            // Only fill new indices if buffer grew
            const indices = this.cachedArrays.indices;
            for (let i = this._lastBuiltIndexCount; i < totalIndexCount; i++) {
                indices[i] = i;
            }
            this._lastBuiltIndexCount = totalIndexCount;
        }

        // Initialize texture arrays if we need them
        if (!this.textureArrays || this.textureArrays.uvs.length < totalUvCount) {
            this.textureArrays = {
                uvs: new Float32Array(totalUvCount),
                textureIndices: new Float32Array(totalFlagCount),
                useTextureFlags: new Float32Array(totalFlagCount)
            };
            this.textureArrays.useTextureFlags.fill(0);
        }

        const { positions, normals, colors, alphas, indices } = this.cachedArrays;

        // OPTIMIZATION: Destructuring outside loops
        const { uvs, textureIndices, useTextureFlags } = this.textureArrays;
        let r, g, b;

        // Track offset for placing objects in buffer
        let triangleOffset = 0;
        let indexOffset = 0;

        // Process all objects in the frame
        for (const object of this._frameObjects) {
            const triangles = object.triangles;
            const triangleCount = triangles.length;

            // Use local variables for faster access
            const tri = triangles;

            for (let i = 0; i < triangleCount; i++) {
                const triangle = tri[i];
                const baseIndex = (triangleOffset + i) * 9; // Offset by triangles of previous objects
                const triangleGlobalIndex = triangleOffset + i;

                // Cache color conversion (only once per triangle)
                const color = triangle.color;
                let alpha = triangle.alpha !== undefined ? triangle.alpha : 1.0;
                if (color !== triangle.lastColor) {
                    // Use integer operations instead of substring for better performance
                    // OPTIMIZATION: Skip slice() by parsing directly with substring
                    const hexColor = parseInt(color.substring(1), 16);
                    r = ((hexColor >> 16) & 255) / 255;
                    g = ((hexColor >> 8) & 255) / 255;
                    b = (hexColor & 255) / 255;

                    // OPTIMIZATION: Cache parsed colors as direct values, not objects
                    triangle.cachedColorR = r;
                    triangle.cachedColorG = g;
                    triangle.cachedColorB = b;
                    triangle.lastColor = color;
                } else {
                    // Use cached color
                    r = triangle.cachedColorR;
                    g = triangle.cachedColorG;
                    b = triangle.cachedColorB;
                }

                // OPTIMIZATION: Direct normal access - no intermediate array
                const triNormal = triangle.normal;
                const nx = triNormal.x;
                const ny = triNormal.y;
                const nz = triNormal.z;

                // Process all vertices of this triangle in one batch
                // Unroll the loop for better performance
                // Vertex 0
                const v0 = triangle.vertices[0];
                const vo0 = baseIndex;
                const alphaIndex0 = (triangleOffset + i) * 3;
                positions[vo0] = v0.x;
                positions[vo0 + 1] = v0.y;
                positions[vo0 + 2] = v0.z;
                normals[vo0] = nx;
                normals[vo0 + 1] = ny;
                normals[vo0 + 2] = nz;
                colors[vo0] = r;
                colors[vo0 + 1] = g;
                colors[vo0 + 2] = b;
                alphas[alphaIndex0] = alpha;

                // Vertex 1
                const v1 = triangle.vertices[1];
                const vo1 = baseIndex + 3;
                const alphaIndex1 = alphaIndex0 + 1;
                positions[vo1] = v1.x;
                positions[vo1 + 1] = v1.y;
                positions[vo1 + 2] = v1.z;
                normals[vo1] = nx;
                normals[vo1 + 1] = ny;
                normals[vo1 + 2] = nz;
                colors[vo1] = r;
                colors[vo1 + 1] = g;
                colors[vo1 + 2] = b;
                alphas[alphaIndex1] = alpha;

                // Vertex 2
                const v2 = triangle.vertices[2];
                const vo2 = baseIndex + 6;
                const alphaIndex2 = alphaIndex0 + 2;
                positions[vo2] = v2.x;
                positions[vo2 + 1] = v2.y;
                positions[vo2 + 2] = v2.z;
                normals[vo2] = nx;
                normals[vo2 + 1] = ny;
                normals[vo2 + 2] = nz;
                colors[vo2] = r;
                colors[vo2 + 1] = g;
                colors[vo2 + 2] = b;
                alphas[alphaIndex2] = alpha;

                // OPTIMIZATION: Indices are pre-built during buffer allocation
                // No need to rebuild them every frame (they're always sequential)
                const indexBaseOffset = (triangleOffset + i) * 3;

                // Always populate texture arrays, even for non-textured triangles
                const baseUVIndex = (triangleOffset + i) * 6;
                const baseFlagIndex = (triangleOffset + i) * 3;

                // Check if this triangle has texture (either from material or legacy texture property)
                const shouldUseTexture = (triangle.material && triangle.material.useTexture) || triangle.texture;

                // Handle UVs
                let uvsToUse = triangle.uvs;
                if (triangle.material && triangle.material.texCoords && !uvsToUse) {
                    uvsToUse = triangle.material.texCoords;
                }

                if (uvsToUse) {
                    for (let j = 0; j < 3; j++) {
                        const uv = uvsToUse[j];
                        uvs[baseUVIndex + j * 2] = uv.u || uv.x || 0;
                        uvs[baseUVIndex + j * 2 + 1] = uv.v || uv.y || 0;
                    }
                } else {
                    // Default UVs
                    uvs[baseUVIndex] = 0;
                    uvs[baseUVIndex + 1] = 0;
                    uvs[baseUVIndex + 2] = 1;
                    uvs[baseUVIndex + 3] = 0;
                    uvs[baseUVIndex + 4] = 0.5;
                    uvs[baseUVIndex + 5] = 1;
                }

                // Determine texture index and useTexture flag
                let textureIndex = 0;
                let useTextureValue = 0;

                if (shouldUseTexture) {
                    this._hasTextures = true;
                    useTextureValue = 1;

                    if (triangle.material && triangle.material.useTexture && triangle.material.textureIndex >= 0) {
                        // Use embedded texture index from material
                        textureIndex = triangle.material.textureIndex;
                    } else if (triangle.texture) {
                        // Use legacy procedural texture lookup
                        let cachedIndex = this._textureCache.get(triangle.texture);
                        if (cachedIndex === undefined) {
                            cachedIndex = this.getTextureIndexForProceduralTexture(triangle.texture);
                            this._textureCache.set(triangle.texture, cachedIndex);
                        }
                        textureIndex = cachedIndex;
                    }
                }

                // OPTIMIZATION: Batch set texture data for all three vertices
                textureIndices[baseFlagIndex] = textureIndex;
                textureIndices[baseFlagIndex + 1] = textureIndex;
                textureIndices[baseFlagIndex + 2] = textureIndex;

                useTextureFlags[baseFlagIndex] = useTextureValue;
                useTextureFlags[baseFlagIndex + 1] = useTextureValue;
                useTextureFlags[baseFlagIndex + 2] = useTextureValue;

                // OPTIMIZATION: Track opaque vs transparent - reuse array objects to avoid allocations
                if (alpha < 1.0) {
                    // Reuse single temp object or index directly without creating new objects
                    this.transparentTriangles.push(triangleGlobalIndex);
                } else {
                    // OPTIMIZATION: Batch push indices instead of 3 separate calls
                    this.opaqueIndices.push(indexBaseOffset, indexBaseOffset + 1, indexBaseOffset + 2);
                }

                if (i === 0 && triangleOffset === 0) {
                    // First triangle of first object
                }
            }

            // Update triangle offset for next object
            triangleOffset += triangleCount;
        }

        // Cache GL context and commonly used values
        const gl = this.gl;
        const ARRAY_BUFFER = gl.ARRAY_BUFFER;
        // Use DYNAMIC_DRAW for buffers that change every frame
        const DYNAMIC_DRAW = gl.DYNAMIC_DRAW;

        // Update GL buffers with all object data
        const bufferUpdates = [
            { buffer: this.buffers.position, data: positions },
            { buffer: this.buffers.normal, data: normals },
            { buffer: this.buffers.color, data: colors },
            { buffer: this.buffers.alpha, data: alphas }
        ];

        for (const { buffer, data } of bufferUpdates) {
            gl.bindBuffer(ARRAY_BUFFER, buffer);
            gl.bufferData(ARRAY_BUFFER, data, DYNAMIC_DRAW);
        }

        // Always update texture buffers to ensure consistent behavior
        const textureBufferUpdates = [
            { buffer: this.buffers.uv, data: uvs },
            { buffer: this.buffers.textureIndex, data: textureIndices },
            { buffer: this.buffers.useTexture, data: useTextureFlags }
        ];

        for (const { buffer, data } of textureBufferUpdates) {
            gl.bindBuffer(ARRAY_BUFFER, buffer);
            gl.bufferData(ARRAY_BUFFER, data, DYNAMIC_DRAW);
        }

        // PRE-COMPUTE ALL MATRICES AND UNIFORMS ONCE PER FRAME
        this.updateUniformCache(camera);

        // Store total counts for rendering
        this._opaqueIndexCount = this.opaqueIndices.length;
        this._transparentIndexCount = this.transparentTriangles.length * 3;

        // Rebuild index buffer: opaque indices first, then transparent indices in sorted order
        const totalIndices = this._opaqueIndexCount + this._transparentIndexCount;
        const reorderedIndices = new Uint32Array(totalIndices);

        // Copy opaque indices first
        let indexPos = 0;
        for (let i = 0; i < this.opaqueIndices.length; i++) {
            reorderedIndices[indexPos++] = this.opaqueIndices[i];
        }

        // Copy transparent indices in sorted order
        for (let i = 0; i < this.transparentTriangles.length; i++) {
            const triangleIdx = this.transparentTriangles[i];
            const baseIndexOffset = triangleIdx * 3;

            reorderedIndices[indexPos++] = baseIndexOffset;
            reorderedIndices[indexPos++] = baseIndexOffset + 1;
            reorderedIndices[indexPos++] = baseIndexOffset + 2;
        }

        // Upload reordered index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, reorderedIndices, DYNAMIC_DRAW);

        // Setup shader and draw - use the object shader from program manager
        const program = this.programManager.getObjectProgram();
        const locations = this.programManager.getObjectLocations();
        gl.useProgram(program);

        // Draw each object with its own model matrix
        let triangleOffsetForObject = 0;
        for (let objIdx = 0; objIdx < this._frameObjects.length; objIdx++) {
            const modelMatrix = this._frameObjectMatrices[objIdx];
            const object = this._frameObjects[objIdx];
            const triangleCount = object.triangles.length;

            // Set up shader with this object's model matrix
            this.setupObjectShader(locations, camera, modelMatrix);

            // Draw this object's triangles
            // Offset is in bytes for UNSIGNED_INT indices (4 bytes per index)
            const indexCount = triangleCount * 3;
            const offsetBytes = triangleOffsetForObject * 3 * 4;
            this.drawObject(locations, indexCount, offsetBytes);

            triangleOffsetForObject += triangleCount;
        }
    }

    /**
     * Finalize the frame after both opaque and transparent passes complete
     * @private
     */
    _finalizeFrame() {
        this._frameInitialized = false;
        this._frameObjects = [];
        this._frameObjectMatrices = [];
        this._totalTriangles = 0;
        this._resetTransparencyTracking();
    }

    // Pre-compute all uniform values once per frame
    updateUniformCache(camera) {
        // Get the current shader program from program manager
        const program = this.programManager.getObjectProgram();

        // Check if we already computed values for this frame
        if (
            this._uniformCache.frame === this._frameCount &&
            this._uniformCache.shaderProgram === program &&
            this._uniformCache.camera === camera
        ) {
            return; // Cache is valid, no need to update
        }

        // Update cache validation
        this._uniformCache.frame = this._frameCount;
        this._uniformCache.shaderProgram = program;
        this._uniformCache.camera = camera;

        // Pre-compute projection matrix
        Matrix4.perspective(this._uniformCache.matrices.projection, camera.fov, Game.WIDTH / Game.HEIGHT, 0.1, 10000.0);

        // Pre-compute view matrix
        Matrix4.lookAt(
            this._uniformCache.matrices.view,
            camera.position.toArray(),
            camera.target.toArray(),
            camera.up.toArray()
        );

        // Identity model matrix
        Matrix4.identity(this._uniformCache.matrices.model);

        // Only cache light configuration if directional light is actually enabled
        if (this.lightManager.isMainDirectionalLightEnabled() && this.lightManager.getMainDirectionalLight()) {
            // Get real light data from the light manager - no sneaky default values
            this._uniformCache.lightConfig = this.lightManager.getLightConfig();
            this._uniformCache.lightDir = this.lightManager.getLightDir();

            // Get the actual light space matrix from the light manager
            this._uniformCache.matrices.lightSpace = this.lightManager.getLightSpaceMatrix();
        } else {
            // If directional light is disabled, explicitly set these to null
            // to indicate there's no directional light present
            this._uniformCache.lightConfig = null;
            this._uniformCache.lightDir = null;
            this._uniformCache.matrices.lightSpace = null;
        }

        // Cache other commonly used values
        const materialConfig = this.lightManager.constants.MATERIAL;
        this._uniformCache.roughness = materialConfig.ROUGHNESS.value;
        this._uniformCache.metallic = materialConfig.METALLIC.value;
        this._uniformCache.baseReflectivity = materialConfig.BASE_REFLECTIVITY.value;

        // Save that we've updated the cache
        this._cacheUpdated = true;
    }

    setupObjectShader(locations, camera, modelMatrix = null) {
        const gl = this.gl;

        // Use pre-computed values from the uniform cache
        gl.uniformMatrix4fv(locations.projectionMatrix, false, this._uniformCache.matrices.projection);
        gl.uniformMatrix4fv(locations.viewMatrix, false, this._uniformCache.matrices.view);
        gl.uniformMatrix4fv(locations.modelMatrix, false, modelMatrix || this._uniformCache.matrices.model);

        // Set camera position if the shader uses it
        if (locations.cameraPos !== -1 && locations.cameraPos !== null) {
            gl.uniform3fv(locations.cameraPos, camera.position.toArray());
        }

        // Set far plane for logarithmic depth (assuming 10000 as before)
        if (locations.farPlane !== -1 && locations.farPlane !== null) {
            gl.uniform1f(locations.farPlane, 10000.0);
        }

        // Set far plane for point shadow depth comparison (500.0 matches shadow map rendering)
        if (locations.pointShadowFarPlane !== -1 && locations.pointShadowFarPlane !== null) {
            gl.uniform1f(locations.pointShadowFarPlane, 500.0);
        }

        // Only set light uniforms if we actually have a directional light
        // Otherwise the shader will skip directional light calculations entirely
        const config = this._uniformCache.lightConfig;
        const mainLightEnabled =
            this.lightManager.isMainDirectionalLightEnabled() && this.lightManager.getMainDirectionalLight() !== null;

        // If directional light is enabled, make sure shadows are also enabled
        if (mainLightEnabled && locations.shadowsEnabled !== -1 && locations.shadowsEnabled !== null) {
            gl.uniform1i(locations.shadowsEnabled, 1); // 1 = true
        }

        // Only set light position if light is enabled - no sneaky default values
        if (locations.lightPos !== -1 && locations.lightPos !== null && mainLightEnabled && config && config.POSITION) {
            gl.uniform3fv(locations.lightPos, [config.POSITION.x, config.POSITION.y, config.POSITION.z]);
        }

        // Only set light direction if light is enabled - no sneaky default values
        if (
            locations.lightDir !== -1 &&
            locations.lightDir !== null &&
            mainLightEnabled &&
            this._uniformCache.lightDir
        ) {
            gl.uniform3fv(locations.lightDir, this._uniformCache.lightDir.toArray());
        }

        // Only set intensity if light is enabled - no sneaky default values
        if (
            locations.lightIntensity !== -1 &&
            locations.lightIntensity !== null &&
            mainLightEnabled &&
            config &&
            config.INTENSITY !== undefined
        ) {
            gl.uniform1f(locations.lightIntensity, config.INTENSITY);
        }

        // Set intensity factor for default shader
        if (locations.intensityFactor !== -1 && locations.intensityFactor !== null) {
            // Get the current shader name
            const currentVariant = this.programManager.getCurrentVariant();

            // Only apply the factor to the default shader
            if (currentVariant === "default") {
                const factor = this.lightManager.constants.OBJECT_SHADER_DEFAULT_VARIANT_INTENSITY_FACTOR.value;
                gl.uniform1f(locations.intensityFactor, factor);
            } else {
                // For non-default shaders, use 1.0 (no scaling)
                gl.uniform1f(locations.intensityFactor, 1.0);
            }
        }

        // Set PBR material properties if they are defined in the shader
        if (locations.roughness !== -1 && locations.roughness !== null) {
            gl.uniform1f(locations.roughness, this._uniformCache.roughness);
        }
        if (locations.metallic !== -1 && locations.metallic !== null) {
            gl.uniform1f(locations.metallic, this._uniformCache.metallic);
        }
        if (locations.baseReflectivity !== -1 && locations.baseReflectivity !== null) {
            gl.uniform1f(locations.baseReflectivity, this._uniformCache.baseReflectivity);
        }

        // Set per-texture material properties uniform
        if (locations.usePerTextureMaterials !== -1 && locations.usePerTextureMaterials !== null) {
            // Get material settings from texture manager
            const usePerTextureMaterials = this.renderer.textureManager?.usePerTextureMaterials || false;
            gl.uniform1i(locations.usePerTextureMaterials, usePerTextureMaterials ? 1 : 0);
        }

        // Bind material properties texture if available
        if (locations.materialPropertiesTexture !== -1 && locations.materialPropertiesTexture !== null) {
            const materialPropertiesTexture = this.renderer.textureManager?.materialPropertiesTexture;
            if (materialPropertiesTexture) {
                // Bind material properties texture via GLStateManager
                // Always bind to ensure it's up to date (supports real-time debug panel changes)
                this.renderer.glStateManager.bindTextureWithUniform(
                    "materialProperties",
                    materialPropertiesTexture,
                    "TEXTURE_2D",
                    this.gl.getParameter(this.gl.CURRENT_PROGRAM),
                    "uMaterialPropertiesTexture"
                );
            }
        }

        // Set shadow-related uniforms (moved here from ActionRenderer3D to avoid redundant program switching)
        this._setShadowUniforms();

        // Track how many uniform sets we've performed
        this.stats.uniformSetCount++;
    }

    /**
     * Set shadow-related uniforms using cached locations
     * Called from setupObjectShader to consolidate all uniform setup in one place
     * @private
     */
    _setShadowUniforms() {
        const gl = this.gl;
        const shadowLocations = this.programManager.getShadowUniformLocations();

        // Get shadow settings from light manager
        const softness = this.lightManager.constants.SHADOW_FILTERING.SOFTNESS.value;
        const pcfSize = this.lightManager.constants.SHADOW_FILTERING.PCF.SIZE.value;
        const pcfEnabled = this.lightManager.constants.SHADOW_FILTERING.PCF.ENABLED ? 1 : 0;

        // Set shadow softness uniform
        if (shadowLocations.shadowSoftness !== null) {
            gl.uniform1f(shadowLocations.shadowSoftness, softness);
        }

        // Set PCF size uniform
        if (shadowLocations.pcfSize !== null) {
            gl.uniform1i(shadowLocations.pcfSize, pcfSize);
        }

        // Set PCF enabled uniform
        if (shadowLocations.pcfEnabled !== null) {
            gl.uniform1i(shadowLocations.pcfEnabled, pcfEnabled);
        }
    }

    drawObject(locations, indexCount, offset = 0) {
        // Cache commonly used values
        const gl = this.gl;
        const ARRAY_BUFFER = gl.ARRAY_BUFFER;

        // Position attribute
        gl.bindBuffer(ARRAY_BUFFER, this.buffers.position);
        gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(locations.position);

        // Normal attribute
        gl.bindBuffer(ARRAY_BUFFER, this.buffers.normal);
        gl.vertexAttribPointer(locations.normal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(locations.normal);

        // Color attribute
        if (locations.color !== -1) {
            gl.bindBuffer(ARRAY_BUFFER, this.buffers.color);
            gl.vertexAttribPointer(locations.color, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(locations.color);
        }

        // Alpha attribute
        if (locations.alpha !== -1) {
            gl.bindBuffer(ARRAY_BUFFER, this.buffers.alpha);
            gl.vertexAttribPointer(locations.alpha, 1, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(locations.alpha);
        }

        // Always set up texture attributes for consistent behavior
        // Set up texture coordinates
        if (locations.texCoord !== -1) {
            gl.bindBuffer(ARRAY_BUFFER, this.buffers.uv);
            gl.vertexAttribPointer(locations.texCoord, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(locations.texCoord);
        }

        // Set up texture index
        if (locations.textureIndex !== -1) {
            gl.bindBuffer(ARRAY_BUFFER, this.buffers.textureIndex);
            gl.vertexAttribPointer(locations.textureIndex, 1, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(locations.textureIndex);
        }

        // Set up use texture flag
        if (locations.useTexture !== -1) {
            gl.bindBuffer(ARRAY_BUFFER, this.buffers.useTexture);
            gl.vertexAttribPointer(locations.useTexture, 1, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(locations.useTexture);
        }

        // Performance optimization: Cache shader information and texture binding
        if (!this._currentShaderVariant) {
            this._currentShaderVariant = "unknown";
        }

        // Get the current program for texture binding
        const currentProgram = this.programManager.getObjectProgram();
        if (!currentProgram) {
            return;
        }

        // Use GLStateManager to bind all textures
        const materialPropertiesTexture = this.renderer.textureManager.materialPropertiesTexture;
        if (
            materialPropertiesTexture &&
            locations.materialPropertiesTexture !== -1 &&
            locations.materialPropertiesTexture !== null
        ) {
            this.renderer.glStateManager.bindTextureWithUniform(
                "materialProperties",
                materialPropertiesTexture,
                "TEXTURE_2D",
                currentProgram,
                "uMaterialPropertiesTexture"
            );
        }

        if (
            this.lightManager.directionalLightDataTexture &&
            locations.directionalLightData !== -1 &&
            locations.directionalLightData !== null
        ) {
            this.renderer.glStateManager.bindTextureWithUniform(
                "directionalLightData",
                this.lightManager.directionalLightDataTexture,
                "TEXTURE_2D",
                currentProgram,
                "uDirectionalLightData"
            );
        }

        if (
            this.lightManager.pointLightDataTexture &&
            locations.pointLightData !== -1 &&
            locations.pointLightData !== null
        ) {
            this.renderer.glStateManager.bindTextureWithUniform(
                "pointLightData",
                this.lightManager.pointLightDataTexture,
                "TEXTURE_2D",
                currentProgram,
                "uPointLightData"
            );
        }

        // Texture array
        const embeddedTextureArray = this.renderer.textureManager.embeddedTextureArray;
        const proceduralTextureArray = this.renderer.textureArray;
        const textureArrayToBind = embeddedTextureArray || proceduralTextureArray;

        if (textureArrayToBind && locations.textureArray !== -1 && locations.textureArray !== null) {
            // Check variant to determine which texture array uniform to use
            const currentVariant = this.renderer.programManager.getCurrentVariant();
            const isPBRVariant = currentVariant === "pbr";
            const textureArrayUnit = isPBRVariant ? "textureArrayPBR" : "textureArray";
            const uniformName = isPBRVariant ? "uPBRTextureArray" : "uTextureArray";
            this.renderer.glStateManager.bindTextureWithUniform(
                textureArrayUnit,
                textureArrayToBind,
                "TEXTURE_2D_ARRAY",
                currentProgram,
                uniformName
            );
        }

        this.renderer.textureManager.updateMaterialPropertiesTexture();

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
        gl.drawElements(gl.TRIANGLES, indexCount, this.indexType, offset);
    }

    // Helper method to get texture index - works for any object with textures
    getTextureIndexForProceduralTexture(proceduralTexture) {
        // If textureRegistry doesn't exist or isn't accessible, return 0
        if (typeof textureRegistry === "undefined") {
            console.warn("textureRegistry is not defined - textures will not work correctly");
            return 0;
        }

        // Initialize the texture cache once if needed
        if (!this._textureIndexCache) {
            this._textureIndexCache = new WeakMap();

            // Pre-populate cache with texture information - only need to do this once since textures don't change
            textureRegistry.textureList.forEach((name, index) => {
                const texture = textureRegistry.get(name);
                if (texture) {
                    this._textureIndexCache.set(texture, index);
                }
            });

            // Set lastCacheUpdate to infinity to prevent unnecessary refreshes
            this._lastCacheUpdate = Infinity;
        }

        // Get from cache with O(1) lookup
        const indexFromCache = this._textureIndexCache.get(proceduralTexture);
        if (indexFromCache !== undefined) {
            return indexFromCache;
        }

        // If texture wasn't in cache, this is a texture we haven't seen before
        // Instead of refreshing the whole cache, just add this one texture
        const textureName = proceduralTexture.name;
        if (textureName) {
            const textureIndex = textureRegistry.textureList.indexOf(textureName);
            if (textureIndex !== -1) {
                // Add to cache for future lookups
                this._textureIndexCache.set(proceduralTexture, textureIndex);
                return textureIndex;
            }
        }

        return 0; // Default to first texture if not found
    }

    /**
     * Render transparent objects in back-to-front sorted order
     * Called from TransparentObjectRenderer3D after opaque pass
     * Index buffer is already built with transparent indices starting at offset opaqueIndexCount
     * @private
     */
    drawTransparent(camera) {
        if (this.transparentTriangles.length === 0) {
            return;
        }

        const gl = this.gl;
        const program = this.programManager.getObjectProgram();
        const locations = this.programManager.getObjectLocations();

        gl.useProgram(program);
        this.setupObjectShader(locations, camera);

        // Set up vertex attributes and draw
        this.drawObject(locations, this._transparentIndexCount, this._opaqueIndexCount * 4);

        // Finalize frame after both opaque and transparent passes
        this._finalizeFrame();
    }

    /**
     * Reset transparency tracking for next frame
     * @private
     */
    _resetTransparencyTracking() {
        this.opaqueIndices = [];
        this.transparentTriangles = [];
        this._opaqueIndexCount = 0;
        this._transparentIndexCount = 0;
    }
}
