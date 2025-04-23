// actionengine/display/graphics/renderers/actionrenderer3D/objectrenderer3D.js
class ObjectRenderer3D {
    constructor(renderer, gl, programManager, lightingManager) {
        this.renderer = renderer;
        this.gl = gl;
        this.programManager = programManager;
        this.programRegistry = programManager.getProgramRegistry();
        this.lightingManager = lightingManager;
        
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
    }

    queue(object, camera, shaderSet, currentTime) {
        // Skip rendering if object is invalid
        if (!object) {
            console.warn('Attempted to render null or undefined object');
            return;
        }
        
        // Ensure object's visual geometry is up-to-date with its physics state
        if (typeof object.updateVisual === 'function') {
            object.updateVisual();
        }
        
        const triangles = object.triangles;
        
        // Validate triangles exist
        if (!triangles || triangles.length === 0) {
            console.warn('Object has no triangles to render', object);
            return;
        }
        
        const triangleCount = triangles.length;

        // Initialize the object renderer for the current frame if needed
        if (!this._frameInitialized) {
            // Track all objects in the current frame
            this._frameObjects = [];
            this._totalTriangles = 0;
            this._frameInitialized = true;
            this._currentFrameTime = performance.now();
            
            // Store camera and shader for batch rendering
            this._camera = camera;
            this._shaderSet = shaderSet;
            
            // Create persistent texture cache
            if (!this._textureCache) {
                this._textureCache = new Map();
            }
        }
        
        // Add this object to our frame tracking
        this._frameObjects.push(object);
        this._totalTriangles += triangleCount;
    }

    render() {
        if (this._frameObjects && this._frameObjects.length > 0) {
            this.drawObjects(this._camera, this._shaderSet);
            this._frameInitialized = false;
            this._frameObjects = [];
            this._totalTriangles = 0;
        }
    }
    
    drawObjects(camera, shaderSet) {
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
            for (let i = 0; i < triangleCount; i++) {
                const triangle = triangles[i];
                const baseIndex = (triangleOffset + i) * 9; // Offset by triangles of previous objects

                // Cache color conversion
                const color = triangle.color;
                if (color !== triangle.lastColor) {
                    triangle.cachedColor = {
                        r: parseInt(color.substr(1, 2), 16) / 255,
                        g: parseInt(color.substr(3, 2), 16) / 255,
                        b: parseInt(color.substr(5, 2), 16) / 255
                    };
                    triangle.lastColor = color;
                }
                const { r, g, b } = triangle.cachedColor;

                // Batch vertex operations
                for (let j = 0; j < 3; j++) {
                    const vertexOffset = baseIndex + j * 3;
                    const vertex = triangle.vertices[j];

                    // Position
                    positions[vertexOffset] = vertex.x;
                    positions[vertexOffset + 1] = vertex.y;
                    positions[vertexOffset + 2] = vertex.z;

                    // Normal
                    normals[vertexOffset] = triangle.normal.x;
                    normals[vertexOffset + 1] = triangle.normal.y;
                    normals[vertexOffset + 2] = triangle.normal.z;

                    // Color
                    colors[vertexOffset] = r;
                    colors[vertexOffset + 1] = g;
                    colors[vertexOffset + 2] = b;
                }
                
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
        const STATIC_DRAW = gl.STATIC_DRAW;
        
        // Update GL buffers with all object data
        const bufferUpdates = [
            { buffer: this.buffers.position, data: positions },
            { buffer: this.buffers.normal, data: normals },
            { buffer: this.buffers.color, data: colors }
        ];

        for (const { buffer, data } of bufferUpdates) {
            gl.bindBuffer(ARRAY_BUFFER, buffer);
            gl.bufferData(ARRAY_BUFFER, data, STATIC_DRAW);
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
            gl.bufferData(ARRAY_BUFFER, data, STATIC_DRAW);
        }
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, STATIC_DRAW);

        // Cache matrix operations
        const projection = Matrix4.perspective(
            this.cachedProjection || (this.cachedProjection = Matrix4.create()),
            camera.fov,
            Game.WIDTH / Game.HEIGHT,
            0.1,
            10000.0
        );

        const view = this.cachedView || (this.cachedView = Matrix4.create());
        Matrix4.lookAt(view, camera.position.toArray(), camera.target.toArray(), camera.up.toArray());

        const model = this.cachedModel || (this.cachedModel = Matrix4.create());

        // Setup shader and draw - use the standard object shader
        const program = shaderSet.standard;
        gl.useProgram(program.program);
        this.setupObjectShader(program.locations, projection, view, model, camera);

        // Draw all objects in one batch
        this.drawObject(program.locations, totalIndexCount);
        
        // Reset frame tracking for next frame
        this._frameInitialized = false;
        this._frameObjects = [];
        this._totalTriangles = 0;
    }

    setupObjectShader(locations, projection, view, model, camera) {
        this.gl.uniformMatrix4fv(locations.projectionMatrix, false, projection);
        this.gl.uniformMatrix4fv(locations.viewMatrix, false, view);
        this.gl.uniformMatrix4fv(locations.modelMatrix, false, model);

        // Set camera position if the shader uses it
        if (locations.cameraPos !== -1 && locations.cameraPos !== null) {
            this.gl.uniform3fv(locations.cameraPos, camera.position.toArray());
        }

        const config = this.lightingManager.getLightConfig();
        if (locations.lightPos !== -1 && locations.lightPos !== null) {
            this.gl.uniform3fv(locations.lightPos, [config.POSITION.x, config.POSITION.y, config.POSITION.z]);
        }
        if (locations.lightDir !== -1 && locations.lightDir !== null) {
            this.gl.uniform3fv(locations.lightDir, this.lightingManager.getLightDir().toArray());
        }
        if (locations.lightIntensity !== -1 && locations.lightIntensity !== null) {
            this.gl.uniform1f(locations.lightIntensity, config.INTENSITY);
        }

        // Set PBR material properties if they are defined in the shader
        if (locations.roughness !== -1 && locations.roughness !== null) {
            this.gl.uniform1f(locations.roughness, config.MATERIAL.ROUGHNESS);
        }
        if (locations.metallic !== -1 && locations.metallic !== null) {
            this.gl.uniform1f(locations.metallic, config.MATERIAL.METALLIC);
        }
        if (locations.baseReflectivity !== -1 && locations.baseReflectivity !== null) {
            this.gl.uniform1f(locations.baseReflectivity, config.MATERIAL.BASE_REFLECTIVITY);
        }
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
        if (!this._currentShaderType) {
            this._currentShaderType = "unknown";
        }
        
        // Bind texture array if the shader uses it
        if (locations.textureArray !== -1 && locations.textureArray !== null) {
            // Get texture array from renderer
            const textureArray = this.renderer?.textureArray;
            
            if (textureArray) {
                // Determine which shader we're using - only do this check once per frame
                if (!this._lastCheckedShader || this._lastCheckedShader !== this.programRegistry.getCurrentShaderSet()) {
                    const currentShaderSet = this.programRegistry.getCurrentShaderSet();
                    this._lastCheckedShader = currentShaderSet;
                    this._currentShaderType = this.programRegistry?.shaders.get("pbr") === currentShaderSet ? "pbr" : "other";
                }
                
                if (this._currentShaderType === "pbr") {
                    // Use texture unit 1 for PBR shader
                    gl.activeTexture(gl.TEXTURE1);
                    gl.bindTexture(gl.TEXTURE_2D_ARRAY, textureArray);
                    gl.uniform1i(locations.textureArray, 1);
                } else {
                    // Use texture unit 0 for other shaders
                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_2D_ARRAY, textureArray);
                    gl.uniform1i(locations.textureArray, 0);
                }
            } else {
                console.warn('Texture array is not available but textures are required by shader');
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
        
        // Cache texture lookup results for better performance
        if (!this._textureIndexCache) {
            this._textureIndexCache = new Map();
            
            // Pre-populate cache with all known textures
            for (let i = 0; i < textureRegistry.textureList.length; i++) {
                const name = textureRegistry.textureList[i];
                const texture = textureRegistry.get(name);
                if (texture) {
                    this._textureIndexCache.set(texture, i);
                }
            }
        }
        
        // Get from cache
        const indexFromCache = this._textureIndexCache.get(proceduralTexture);
        if (indexFromCache !== undefined) {
            return indexFromCache;
        }
        
        // Fallback to search if not in cache
        for (let i = 0; i < textureRegistry.textureList.length; i++) {
            const name = textureRegistry.textureList[i];
            if (textureRegistry.get(name) === proceduralTexture) {
                // Update cache
                this._textureIndexCache.set(proceduralTexture, i);
                return i;
            }
        }
        
        return 0; // Default to first texture if not found
    }
}