// actionengine/display/graphics/renderers/actionrenderer3D/objectrenderer3D.js
class ObjectRenderer3D {
    constructor(renderer, gl, programManager, lightingManager) {
        this.renderer = renderer;
        this.gl = gl;
        this.programManager = programManager;
        this.programRegistry = programManager.getProgramRegistry();
        this.lightingManager = lightingManager;

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

    render(object, camera, shaderSet, currentTime) {
        // Skip rendering if object is invalid
        if (!object) {
            console.warn('Attempted to render null or undefined object');
            return;
        }
        
        // Fast path optimization - track if the object has any textures
        this._hasTextures = false;
        
        // Get triangles either directly or through getTriangles() method
        // Cache triangles if possible - big performance boost
        if (!object._cachedTriangles) {
            object._cachedTriangles = object.getTriangles ? object.getTriangles() : object.triangles;
            object._lastModified = performance.now();
        }
        const triangles = object._cachedTriangles;
        
        // Validate triangles exist
        if (!triangles || triangles.length === 0) {
            console.warn('Object has no triangles to render', object);
            return;
        }
        
        const triangleCount = triangles.length;
        const vertexCount = triangleCount * 9;

        // Preallocate core arrays once and reuse them if size hasn't changed
        if (!this.cachedArrays || this.cachedArrays.positions.length !== vertexCount) {
            this.cachedArrays = {
                positions: new Float32Array(vertexCount),
                normals: new Float32Array(vertexCount),
                colors: new Float32Array(vertexCount),
                indices: new Uint16Array(triangleCount * 3)
            };
            
            // Pre-allocate texture arrays with null initial value
            this.textureArrays = null;

            // Indices array can be initialized once since it's always sequential
            for (let i = 0; i < this.cachedArrays.indices.length; i++) {
                this.cachedArrays.indices[i] = i;
            }
            
            // Mark buffer data as dirty to force update
            this._buffersDirty = true;
        }

        const { positions, normals, colors, indices } = this.cachedArrays;
        
        // Cache texture arrays between frames - only recreate when necessary
        // Create persistent texture cache
        if (!this._textureCache) {
            this._textureCache = new Map();
        }

        // Performance optimization: Only update geometry data if the object has changed
        // or we haven't processed it before
        const needsUpdate = this._buffersDirty || !object._lastProcessed || object._lastModified > object._lastProcessed;
        
        if (needsUpdate) {
            // Process all triangles and update buffer data
            for (let i = 0; i < triangleCount; i++) {
                const triangle = triangles[i];
                const baseIndex = i * 9;

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
                
                // Check if this triangle has texture
                if (triangle.texture) {
                    // First texture encountered in this object - allocate texture arrays if needed
                    if (!this._hasTextures) {
                        this._hasTextures = true;
                        
                        // Only create these arrays if they don't exist or size changed
                        if (!this.textureArrays ||
                            this.textureArrays.uvs.length !== triangleCount * 6) {
                            this.textureArrays = {
                                uvs: new Float32Array(triangleCount * 6),
                                textureIndices: new Float32Array(triangleCount * 3),
                                useTextureFlags: new Float32Array(triangleCount * 3)
                            };
                            // Initialize all flags to zero
                            this.textureArrays.useTextureFlags.fill(0);
                        }
                    }
                    
                    const baseUVIndex = i * 6;
                    const baseFlagIndex = i * 3;
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
            
            // Mark object as processed
            object._lastProcessed = performance.now();
            
            // Buffer data needs to be updated
            this._buffersDirty = true;
        }
        
        // Cache GL context and commonly used values outside of the conditional
        const gl = this.gl;
        const ARRAY_BUFFER = gl.ARRAY_BUFFER;
        const STATIC_DRAW = gl.STATIC_DRAW;
        
        // Only update GL buffers if data has changed
        if (this._buffersDirty) {
            // Update core buffers
            const bufferUpdates = [
                { buffer: this.buffers.position, data: positions },
                { buffer: this.buffers.normal, data: normals },
                { buffer: this.buffers.color, data: colors }
            ];

            for (const { buffer, data } of bufferUpdates) {
                gl.bindBuffer(ARRAY_BUFFER, buffer);
                gl.bufferData(ARRAY_BUFFER, data, STATIC_DRAW);
            }
            
            // Only update texture buffers if textures were detected
            if (this._hasTextures && this.textureArrays) {
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
            }

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, STATIC_DRAW);
            
            // Buffer data is now up to date
            this._buffersDirty = false;
        }

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

        this.drawObject(program.locations, indices.length);
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

        // Only set up texture attributes if the object has textures
        if (this._hasTextures && this.textureArrays) {
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
        } else {
            // No textures - set default values
            if (locations.useTexture !== -1) {
                gl.disableVertexAttribArray(locations.useTexture);
                gl.vertexAttrib1f(locations.useTexture, 0.0);
            }

            if (locations.textureIndex !== -1) {
                gl.disableVertexAttribArray(locations.textureIndex);
                gl.vertexAttrib1f(locations.textureIndex, 0.0);
            }

            if (locations.texCoord !== -1) {
                gl.disableVertexAttribArray(locations.texCoord);
                gl.vertexAttrib2f(locations.texCoord, 0.0, 0.0);
            }
        }
        
        // Performance optimization: Cache shader information and texture binding
        if (!this._currentShaderType) {
            this._currentShaderType = "unknown";
        }
        
        // Bind texture array if the shader uses it
        if (locations.textureArray !== -1 && locations.textureArray !== null && this.renderer.textureArray) {
            // Determine which shader we're using - only do this check once per frame
            if (!this._lastCheckedShader || this._lastCheckedShader !== this.programRegistry.getCurrentShaderSet()) {
                const currentShaderSet = this.programRegistry.getCurrentShaderSet();
                this._lastCheckedShader = currentShaderSet;
                this._currentShaderType = this.programRegistry?.shaders.get("pbr") === currentShaderSet ? "pbr" : "other";
            }
            
            if (this._currentShaderType === "pbr") {
                // Use texture unit 1 for PBR shader
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.renderer.textureArray);
                gl.uniform1i(locations.textureArray, 1);
            } else {
                // Use texture unit 0 for other shaders
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.renderer.textureArray);
                gl.uniform1i(locations.textureArray, 0);
            }
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
    }

    // Helper method to get texture index - works for any object with textures
    getTextureIndexForProceduralTexture(proceduralTexture) {
        // Cache texture lookup results for better performance
        if (!this._textureIndexCache) {
            this._textureIndexCache = new Map();
            
            // Pre-populate cache with all known textures
            for (let i = 0; i < textureRegistry.textureList.length; i++) {
                const name = textureRegistry.textureList[i];
                const texture = textureRegistry.get(name);
                this._textureIndexCache.set(texture, i);
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