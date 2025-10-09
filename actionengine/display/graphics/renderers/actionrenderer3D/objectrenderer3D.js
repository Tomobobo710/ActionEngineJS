// actionengine/display/graphics/renderers/actionrenderer3D/objectrenderer3D.js
class ObjectRenderer3D {
    constructor(renderer, gl, programManager, lightManager) {
        this.renderer = renderer;
        this.gl = gl;
        this.programManager = programManager;
        this.lightManager = lightManager;
        
        // Check if WebGL2 is available for 32-bit indices
        this.isWebGL2 = this.gl instanceof WebGL2RenderingContext;
        
        // Store the index element type for later use
        this.indexType = this.isWebGL2 ? this.gl.UNSIGNED_INT : this.gl.UNSIGNED_SHORT;

        // Create buffer for each renderable object - support textures for all objects
        this.buffers = {
            position: this.gl.createBuffer(),
            normal: this.gl.createBuffer(),
            color: this.gl.createBuffer(),
            uv: this.gl.createBuffer(),              // Add texture coordinate buffer
            textureIndex: this.gl.createBuffer(),    // Add texture index buffer
            useTexture: this.gl.createBuffer(),      // Add use texture flag buffer
            indices: this.gl.createBuffer()
        };
        
        // Create view frustum for culling
        this.viewFrustum = new ViewFrustum();
        
        // Frustum culling is enabled by default
        this.enableFrustumCulling = false;
        
        // Add state tracking to avoid redundant texture bindings
        this._currentTextureUnit = -1;
        this._currentBoundTexture = null;
        this._currentBoundTextureType = null;
        
        // Cache for pre-computed uniform values
        this._uniformCache = {
            frame: -1,           // Current frame number for cache validation
            shaderProgram: null, // Current shader program
            camera: null,        // Current camera reference
            lightConfig: null,   // Cached light configuration
            matrices: {          // Cached matrices
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
            uniformSetCount: 0   // Track how many uniform sets we perform
        };
    }

    queue(object, camera, currentTime) {
        // Skip rendering if object is invalid
        if (!object) {
            console.warn('Attempted to render null or undefined object');
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
            this._totalTriangles = 0;
            this._frameInitialized = true;
            this._currentFrameTime = performance.now();
            
            // Store camera for batch rendering
            this._camera = camera;
            
            // Create persistent texture cache
            if (!this._textureCache) {
                this._textureCache = new Map();
            }
            
            // Update the view frustum with the current camera
            this.viewFrustum.updateFromCamera(camera);
            
            // Reset the frame counter for uniform cache
            this._frameCount = (this._frameCount || 0) + 1;
        }
        
        // Update statistics
        this.stats.objectsTotal++;
        
        // Perform frustum culling if enabled
        if (this.enableFrustumCulling) {
            if (!this.viewFrustum.isVisible(object)) {
                this.stats.objectsCulled++;
                return; // Skip this object as it's outside the frustum
            }
        }
        
        // Ensure object's visual geometry is up-to-date with its physics state
        if (typeof object.updateVisual === 'function') {
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
        this._totalTriangles += triangleCount;
    }

    render() {
        if (this._frameObjects && this._frameObjects.length > 0) {
            this.drawObjects(this._camera);
            this._frameInitialized = false;
            this._frameObjects = [];
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
        
        // WebGL1 can't handle more than 65535 indices (16-bit limit)
        if (exceeds16BitLimit && !this.isWebGL2) {
            console.warn(`This scene has ${this._totalTriangles} triangles which exceeds the WebGL1 index limit.`);
            console.warn('Using WebGL2 with Uint32 indices would greatly improve performance.');
        }
        
        // Allocate or resize buffers if needed
        if (!this.cachedArrays || this.cachedArrays.positions.length < totalVertexCount) {
            // Choose correct index array type based on WebGL version
            const IndexArrayType = this.isWebGL2 ? Uint32Array : Uint16Array;
            
            this.cachedArrays = {
                positions: new Float32Array(totalVertexCount),
                normals: new Float32Array(totalVertexCount),
                colors: new Float32Array(totalVertexCount),
                indices: new IndexArrayType(totalIndexCount)
            };
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

        const { positions, normals, colors, indices } = this.cachedArrays;
        
        // Track offset for placing objects in buffer
        let triangleOffset = 0;
        let indexOffset = 0;

        // Process all objects in the frame
        for (const object of this._frameObjects) {
            const triangles = object.triangles;
            const triangleCount = triangles.length;
            
            // Process geometry data for this object
            // Use local variables for faster access
            const tri = triangles;
            const normal = new Float32Array(3);
            let r, g, b;
            
            for (let i = 0; i < triangleCount; i++) {
                const triangle = tri[i];
                const baseIndex = (triangleOffset + i) * 9; // Offset by triangles of previous objects

                // Cache color conversion (only once per triangle)
                const color = triangle.color;
                if (color !== triangle.lastColor) {
                    // Use integer operations instead of substring for better performance
                    const hexColor = parseInt(color.slice(1), 16);
                    r = ((hexColor >> 16) & 255) / 255;
                    g = ((hexColor >> 8) & 255) / 255;
                    b = (hexColor & 255) / 255;
                    
                    // Cache the parsed color
                    triangle.cachedColor = { r, g, b };
                    triangle.lastColor = color;
                } else {
                    // Use cached color
                    r = triangle.cachedColor.r;
                    g = triangle.cachedColor.g;
                    b = triangle.cachedColor.b;
                }

                // Cache normal values once per triangle
                normal[0] = triangle.normal.x;
                normal[1] = triangle.normal.y;
                normal[2] = triangle.normal.z;
                
                // Process all vertices of this triangle in one batch
                // Unroll the loop for better performance
                // Vertex 0
                const v0 = triangle.vertices[0];
                const vo0 = baseIndex;
                positions[vo0] = v0.x;
                positions[vo0 + 1] = v0.y;
                positions[vo0 + 2] = v0.z;
                normals[vo0] = normal[0];
                normals[vo0 + 1] = normal[1];
                normals[vo0 + 2] = normal[2];
                colors[vo0] = r;
                colors[vo0 + 1] = g;
                colors[vo0 + 2] = b;
                
                // Vertex 1
                const v1 = triangle.vertices[1];
                const vo1 = baseIndex + 3;
                positions[vo1] = v1.x;
                positions[vo1 + 1] = v1.y;
                positions[vo1 + 2] = v1.z;
                normals[vo1] = normal[0];
                normals[vo1 + 1] = normal[1];
                normals[vo1 + 2] = normal[2];
                colors[vo1] = r;
                colors[vo1 + 1] = g;
                colors[vo1 + 2] = b;
                
                // Vertex 2
                const v2 = triangle.vertices[2];
                const vo2 = baseIndex + 6;
                positions[vo2] = v2.x;
                positions[vo2 + 1] = v2.y;
                positions[vo2 + 2] = v2.z;
                normals[vo2] = normal[0];
                normals[vo2 + 1] = normal[1];
                normals[vo2 + 2] = normal[2];
                colors[vo2] = r;
                colors[vo2 + 1] = g;
                colors[vo2 + 2] = b;
                
                // Set up indices with correct offsets for each object
                const indexBaseOffset = (triangleOffset + i) * 3;
                // Every vertex needs its own index in WebGL
                indices[indexBaseOffset] = (triangleOffset + i) * 3;
                indices[indexBaseOffset + 1] = (triangleOffset + i) * 3 + 1;
                indices[indexBaseOffset + 2] = (triangleOffset + i) * 3 + 2;

                // Check if this triangle has texture
                if (triangle.texture) {
                    // First texture encountered in this object or frame
                    this._hasTextures = true;
                    
                    const baseUVIndex = (triangleOffset + i) * 6;
                    const baseFlagIndex = (triangleOffset + i) * 3;
                    const { uvs, textureIndices, useTextureFlags } = this.textureArrays;
                    
                    // Handle UVs
                    if (triangle.uvs) {
                        for (let j = 0; j < 3; j++) {
                            const uv = triangle.uvs[j];
                            uvs[baseUVIndex + j * 2] = uv.u;
                            uvs[baseUVIndex + j * 2 + 1] = uv.v;
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
                    
                    // Set texture index - use cached value if possible
                    let textureIndex = this._textureCache.get(triangle.texture);
                    if (textureIndex === undefined) {
                        textureIndex = this.getTextureIndexForProceduralTexture(triangle.texture);
                        this._textureCache.set(triangle.texture, textureIndex);
                    }
                    
                    textureIndices[baseFlagIndex] = textureIndex;
                    textureIndices[baseFlagIndex + 1] = textureIndex;
                    textureIndices[baseFlagIndex + 2] = textureIndex;
                    
                    useTextureFlags[baseFlagIndex] = 1;
                    useTextureFlags[baseFlagIndex + 1] = 1;
                    useTextureFlags[baseFlagIndex + 2] = 1;
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
            { buffer: this.buffers.color, data: colors }
        ];

        for (const { buffer, data } of bufferUpdates) {
            gl.bindBuffer(ARRAY_BUFFER, buffer);
            gl.bufferData(ARRAY_BUFFER, data, DYNAMIC_DRAW);
        }

        // Always update texture buffers to ensure consistent behavior
        const { uvs, textureIndices, useTextureFlags } = this.textureArrays;
        const textureBufferUpdates = [
            { buffer: this.buffers.uv, data: uvs },
            { buffer: this.buffers.textureIndex, data: textureIndices },
            { buffer: this.buffers.useTexture, data: useTextureFlags }
        ];
            
        for (const { buffer, data } of textureBufferUpdates) {
            gl.bindBuffer(ARRAY_BUFFER, buffer);
            gl.bufferData(ARRAY_BUFFER, data, DYNAMIC_DRAW);
        }
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, DYNAMIC_DRAW);

        // PRE-COMPUTE ALL MATRICES AND UNIFORMS ONCE PER FRAME
        this.updateUniformCache(camera);

        // Setup shader and draw - use the object shader from program manager
        const program = this.programManager.getObjectProgram();
        const locations = this.programManager.getObjectLocations();
        gl.useProgram(program);
        this.setupObjectShader(locations, camera);

        // Draw all objects in one batch
        this.drawObject(locations, totalIndexCount);
        
        // Reset frame tracking for next frame
        this._frameInitialized = false;
        this._frameObjects = [];
        this._totalTriangles = 0;
    }
    
    // Pre-compute all uniform values once per frame
    updateUniformCache(camera) {
        // Get the current shader program from program manager
        const program = this.programManager.getObjectProgram();
        
        // Check if we already computed values for this frame
        if (this._uniformCache.frame === this._frameCount && 
            this._uniformCache.shaderProgram === program &&
            this._uniformCache.camera === camera) {
            return; // Cache is valid, no need to update
        }
        
        // Update cache validation
        this._uniformCache.frame = this._frameCount;
        this._uniformCache.shaderProgram = program;
        this._uniformCache.camera = camera;
        
        // Pre-compute projection matrix
        Matrix4.perspective(
            this._uniformCache.matrices.projection,
            camera.fov,
            Game.WIDTH / Game.HEIGHT,
            0.1,
            10000.0
        );

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

    setupObjectShader(locations, camera) {
        const gl = this.gl;
        
        // Use pre-computed values from the uniform cache
        gl.uniformMatrix4fv(locations.projectionMatrix, false, this._uniformCache.matrices.projection);
        gl.uniformMatrix4fv(locations.viewMatrix, false, this._uniformCache.matrices.view);
        gl.uniformMatrix4fv(locations.modelMatrix, false, this._uniformCache.matrices.model);

        // Set camera position if the shader uses it
        if (locations.cameraPos !== -1 && locations.cameraPos !== null) {
            gl.uniform3fv(locations.cameraPos, camera.position.toArray());
        }

        // Only set light uniforms if we actually have a directional light
        // Otherwise the shader will skip directional light calculations entirely
        const config = this._uniformCache.lightConfig;
        const mainLightEnabled = this.lightManager.isMainDirectionalLightEnabled() && this.lightManager.getMainDirectionalLight() !== null;
        
        // If directional light is enabled, make sure shadows are also enabled
        if (mainLightEnabled && locations.shadowsEnabled !== -1 && locations.shadowsEnabled !== null) {
            gl.uniform1i(locations.shadowsEnabled, 1); // 1 = true
        }
        
        // Only set light position if light is enabled - no sneaky default values
        if (locations.lightPos !== -1 && locations.lightPos !== null && mainLightEnabled && config && config.POSITION) {
            gl.uniform3fv(locations.lightPos, [config.POSITION.x, config.POSITION.y, config.POSITION.z]);
        }
        
        // Only set light direction if light is enabled - no sneaky default values  
        if (locations.lightDir !== -1 && locations.lightDir !== null && mainLightEnabled && this._uniformCache.lightDir) {
            gl.uniform3fv(locations.lightDir, this._uniformCache.lightDir.toArray());
        }
        
        // Only set intensity if light is enabled - no sneaky default values
        if (locations.lightIntensity !== -1 && locations.lightIntensity !== null && mainLightEnabled && config && config.INTENSITY !== undefined) {
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
                // Only change texture binding if needed (texture unit 2 for material properties)
                // Always bind the material properties texture to ensure it's up to date
                // This is needed to support real-time changes in the debug panel
                {
                    
                    // Use texture unit 2 for material properties
                    this.gl.activeTexture(this.gl.TEXTURE2);
                    this.gl.bindTexture(this.gl.TEXTURE_2D, materialPropertiesTexture);
                    this.gl.uniform1i(locations.materialPropertiesTexture, 2);
                    
                    // Update state tracking
                    this._currentTextureUnit = 2;
                    this._currentBoundTexture = materialPropertiesTexture;
                    this._currentBoundTextureType = this.gl.TEXTURE_2D;
                }
            }
        }
        
        // Set shadow map uniforms if they exist in the shader
        if (locations.shadowsEnabled !== -1 && locations.shadowsEnabled !== null) {
            // Set by renderer during shadow map binding
            const shadowsEnabled = this.renderer.shadowsEnabled ? 1 : 0;
            gl.uniform1i(locations.shadowsEnabled, shadowsEnabled);
        }
        
        // Set shadow bias if available
        if (locations.shadowBias !== -1 && locations.shadowBias !== null) {
            const shadowBias = this._uniformCache.shadowBias || 0.05;
            gl.uniform1f(locations.shadowBias, shadowBias);
        }
        
        // Only set light space matrix if directional light is actually enabled
        // We don't want to do sneaky calculations with default matrices
        if (locations.lightSpaceMatrix !== -1 && locations.lightSpaceMatrix !== null && 
            this._uniformCache.matrices.lightSpace && 
            this.lightManager.isMainDirectionalLightEnabled()) {
            
            // Apply the actual light space matrix from the light
            gl.uniformMatrix4fv(locations.lightSpaceMatrix, false, this._uniformCache.matrices.lightSpace);
        }
        
        // Track how many uniform sets we've performed
        this.stats.uniformSetCount++;
    }

    drawObject(locations, indexCount) {
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
        
        // TEXTURE BINDING STRATEGY:
        // Group 1: 2D textures (0-7)
        // Group 2: Cubemap textures (10-19)
        // Group 3: 2D array textures (20-29)
        
        // --- GROUP 1: 2D TEXTURES ---
        // Bind material properties (2D texture)
        if (locations.materialPropertiesTexture !== -1 && locations.materialPropertiesTexture !== null) {
            const materialPropertiesTexture = this.renderer?.textureManager?.materialPropertiesTexture;
            if (materialPropertiesTexture) {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, materialPropertiesTexture);
                gl.uniform1i(locations.materialPropertiesTexture, 0);
            }
        }
        
        // Bind light data textures (2D textures)
        if (locations.directionalLightData !== -1 && locations.directionalLightData !== null && 
            this.lightManager.directionalLightDataTexture) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.lightManager.directionalLightDataTexture);
            gl.uniform1i(locations.directionalLightData, 1);
        }
        
        if (locations.pointLightData !== -1 && locations.pointLightData !== null &&
            this.lightManager.pointLightDataTexture) {
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, this.lightManager.pointLightDataTexture);
            gl.uniform1i(locations.pointLightData, 2);
        }
        
        // Bind directional shadow map (2D texture)
        if (locations.shadowMap !== -1 && locations.shadowMap !== null) {
            const mainLight = this.lightManager.getMainDirectionalLight();
            if (mainLight && mainLight.getShadowsEnabled()) {
                const shadowMap = mainLight.shadowTexture;
                if (shadowMap) {
                    gl.activeTexture(gl.TEXTURE3);
                    gl.bindTexture(gl.TEXTURE_2D, shadowMap);
                    gl.uniform1i(locations.shadowMap, 3);
                }
            }
        }
        
        // --- GROUP 2: CUBEMAP TEXTURES (must be separate from 2D textures) ---
        // Bind shadow maps for multiple point lights
        // Each point light gets assigned a texture unit starting from 10
        
        // Define the mapping of point light index to shadow map properties
        const pointLightShadowMaps = [
            { locationName: 'pointShadowMap', textureUnit: 10, enabledName: 'pointShadowsEnabled' },
            { locationName: 'pointShadowMap1', textureUnit: 11, enabledName: 'pointShadowsEnabled1' },
            { locationName: 'pointShadowMap2', textureUnit: 12, enabledName: 'pointShadowsEnabled2' },
            { locationName: 'pointShadowMap3', textureUnit: 13, enabledName: 'pointShadowsEnabled3' }
        ];
        
        // Bind shadow maps for up to 4 point lights
        for (let i = 0; i < Math.min(this.lightManager.pointLights.length, pointLightShadowMaps.length); i++) {
            const pointLight = this.lightManager.pointLights[i];
            const shadowMapDef = pointLightShadowMaps[i];
            
            // Get uniform locations
            const shadowMapLoc = locations[shadowMapDef.locationName];
            const shadowEnabledLoc = locations[shadowMapDef.enabledName];
            
            // Skip if any required uniform doesn't exist
            if (shadowMapLoc === -1 || shadowMapLoc === null || shadowEnabledLoc === -1 || shadowEnabledLoc === null) {
                continue;
            }
            
            // Check if this light casts shadows
            if (pointLight && pointLight.getShadowsEnabled()) {
                const pointShadowMap = pointLight.shadowTexture;
                if (pointShadowMap) {
                    // Bind the shadow map
                    gl.activeTexture(gl.TEXTURE0 + shadowMapDef.textureUnit);
                    if (this.isWebGL2 && pointLight.isWebGL2) {
                        gl.bindTexture(gl.TEXTURE_CUBE_MAP, pointShadowMap);
                    } else {
                        gl.bindTexture(gl.TEXTURE_2D, pointShadowMap);
                    }
                    gl.uniform1i(shadowMapLoc, shadowMapDef.textureUnit);
                    
                    // Set that this light's shadows are enabled
                    gl.uniform1i(shadowEnabledLoc, 1); // 1 = true
                } else {
                    // No shadow map, disable shadows
                    gl.uniform1i(shadowEnabledLoc, 0); // 0 = false
                }
            } else {
                // Light doesn't cast shadows, disable them
                gl.uniform1i(shadowEnabledLoc, 0); // 0 = false
            }
        }
        
        // Disable shadows for any additional shadow map uniforms that exist
        for (let i = this.lightManager.pointLights.length; i < pointLightShadowMaps.length; i++) {
            const shadowMapDef = pointLightShadowMaps[i];
            const shadowEnabledLoc = locations[shadowMapDef.enabledName];
            
            if (shadowEnabledLoc !== -1 && shadowEnabledLoc !== null) {
                gl.uniform1i(shadowEnabledLoc, 0); // 0 = false
            }
        }
        
        // --- GROUP 3: TEXTURE ARRAYS ---
        // Bind texture array (2D array texture)
        if (locations.textureArray !== -1 && locations.textureArray !== null) {
            const textureArray = this.renderer?.textureArray;
            if (textureArray) {
                // Determine which shader variant to use
                if (!this._lastCheckedVariant || this._lastCheckedVariant !== this.programManager.getCurrentVariant()) {
                    this._lastCheckedVariant = this.programManager.getCurrentVariant();
                    this._currentShaderVariant = this._lastCheckedVariant === "pbr" ? "pbr" : "other";
                }
                
                // Use unit 20 for standard shader, 21 for PBR shader
                const targetUnit = this._currentShaderVariant === "pbr" ? 21 : 20;
                
                // Only change binding if needed
                if (this._currentTextureUnit !== targetUnit || 
                    this._currentBoundTexture !== textureArray || 
                    this._currentBoundTextureType !== gl.TEXTURE_2D_ARRAY) {
                    
                    gl.activeTexture(gl.TEXTURE0 + targetUnit);
                    gl.bindTexture(gl.TEXTURE_2D_ARRAY, textureArray);
                    gl.uniform1i(locations.textureArray, targetUnit);
                    
                    // Update state tracking
                    this._currentTextureUnit = targetUnit;
                    this._currentBoundTexture = textureArray;
                    this._currentBoundTextureType = gl.TEXTURE_2D_ARRAY;
                }
                
                // Always update material properties texture, no dirty flag check
                if (this.renderer?.textureManager) {
                    this.renderer.textureManager.updateMaterialPropertiesTexture();
                }
            }
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
        gl.drawElements(gl.TRIANGLES, indexCount, this.indexType, 0);
    }

    // Helper method to get texture index - works for any object with textures
    getTextureIndexForProceduralTexture(proceduralTexture) {
        // If textureRegistry doesn't exist or isn't accessible, return 0
        if (typeof textureRegistry === 'undefined') {
            console.warn('textureRegistry is not defined - textures will not work correctly');
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
}