// actionengine/display/graphics/renderers/actionrenderer3D/spriteRenderer3D.js

class SpriteRenderer3D {
    constructor(gl, programManager, isWebGL2 = false) {
        this.gl = gl;
        this.programManager = programManager;
        this.isWebGL2 = isWebGL2;
        
        // Sprite shader and program
        this.spriteShader = new SpriteShader();
        this.program = null;
        this.locations = {};
        
        // Quad geometry for billboards
        this.quadBuffer = null;
        this.indexBuffer = null;
        
        // Initialize
        this._initializeShader();
        this._createQuadGeometry();
    }
    
    /**
     * Initialize the billboard shader program
     * @private
     */
    _initializeShader() {
        
        try {
            this.program = this.programManager.createShaderProgram(
                this.spriteShader.getVertexShader(this.isWebGL2),
                this.spriteShader.getFragmentShader(this.isWebGL2),
                'sprite_shader'
            );
            
            // Get attribute and uniform locations
            this.locations = {
                // Attributes
                position: this.gl.getAttribLocation(this.program, 'aPosition'),
                texCoord: this.gl.getAttribLocation(this.program, 'aTexCoord'),
                
                // Uniforms
                projectionMatrix: this.gl.getUniformLocation(this.program, 'uProjectionMatrix'),
                viewMatrix: this.gl.getUniformLocation(this.program, 'uViewMatrix'),
                spritePosition: this.gl.getUniformLocation(this.program, 'uSpritePosition'),
                spriteSize: this.gl.getUniformLocation(this.program, 'uSpriteSize'),
                cameraPosition: this.gl.getUniformLocation(this.program, 'uCameraPosition'),
                cameraRight: this.gl.getUniformLocation(this.program, 'uCameraRight'),
                cameraUp: this.gl.getUniformLocation(this.program, 'uCameraUp'),
                isBillboard: this.gl.getUniformLocation(this.program, 'uIsBillboard'),
                spriteForward: this.gl.getUniformLocation(this.program, 'uSpriteForward'),
                spriteUp: this.gl.getUniformLocation(this.program, 'uSpriteUp'),
                texture: this.gl.getUniformLocation(this.program, 'uTexture'),
                color: this.gl.getUniformLocation(this.program, 'uColor'),
                alpha: this.gl.getUniformLocation(this.program, 'uAlpha')
            };
            
        } catch (error) {
            console.error('[SpriteRenderer3D] Failed to initialize shader:', error);
        }
    }
    
    /**
     * Create quad geometry for billboard rendering
     * @private
     */
    _createQuadGeometry() {
        const gl = this.gl;
        
        // Quad vertices (position + texture coordinates)
        // Using a centered quad from -0.5 to 0.5
        const vertices = new Float32Array([
            // Position (x, y, z)    Texture (u, v)
            -0.5, -0.5, 0.0,        0.0, 0.0,  // Bottom-left
             0.5, -0.5, 0.0,        1.0, 0.0,  // Bottom-right
             0.5,  0.5, 0.0,        1.0, 1.0,  // Top-right
            -0.5,  0.5, 0.0,        0.0, 1.0   // Top-left
        ]);
        
        // Quad indices
        const indices = new Uint16Array([
            0, 1, 2,  // First triangle
            0, 2, 3   // Second triangle
        ]);
        
        // Create vertex buffer
        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        
        // Create index buffer
        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
        
        // Unbind buffers
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }
    
    /**
     * Render billboard sprites
     * @param {Array} sprites - Array of ActionSprite3D objects
     * @param {Object} camera - Camera object
     * @param {Float32Array} projectionMatrix - Projection matrix
     * @param {Float32Array} viewMatrix - View matrix
     */
    render(sprites, camera, projectionMatrix, viewMatrix) {
        if (!sprites || sprites.length === 0 || !this.program) {
            return;
        }
        
        const gl = this.gl;
        
        // Use billboard shader program
        gl.useProgram(this.program);
        
        // Set up vertex attributes
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        
        // Position attribute (3 floats)
        gl.enableVertexAttribArray(this.locations.position);
        gl.vertexAttribPointer(this.locations.position, 3, gl.FLOAT, false, 5 * 4, 0);
        
        // Texture coordinate attribute (2 floats)
        gl.enableVertexAttribArray(this.locations.texCoord);
        gl.vertexAttribPointer(this.locations.texCoord, 2, gl.FLOAT, false, 5 * 4, 3 * 4);
        
        // Set common uniforms
        gl.uniformMatrix4fv(this.locations.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(this.locations.viewMatrix, false, viewMatrix);
        
        // Calculate camera vectors for billboarding
        const cameraVectors = this._calculateCameraVectors(camera);
        gl.uniform3fv(this.locations.cameraPosition, camera.position.toArray());
        gl.uniform3fv(this.locations.cameraRight, cameraVectors.right.toArray());
        gl.uniform3fv(this.locations.cameraUp, cameraVectors.up.toArray());
        
        // Enable blending for transparency
        gl.enable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        
        // Ensure depth function matches the main 3D renderer for consistent depth testing
        gl.depthFunc(gl.LEQUAL);
        
        gl.depthMask(false); // Don't write to depth buffer for billboards
        
        // Render each sprite
        for (const sprite of sprites) {
            if (!sprite.isTextureLoaded) {
                continue;
            }

            
            // Create WebGL texture if not already created
            if (!sprite.texture) {
                sprite.createWebGLTexture(gl);
            }
            
            if (!sprite.texture) {
                continue;
            }
            
            // Set blend mode
            this._setBlendMode(sprite.blendMode);
            
            // Bind texture
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, sprite.texture);
            gl.uniform1i(this.locations.texture, 0);
            
            // Set sprite-specific uniforms
            const worldPos = sprite.getWorldPosition();
            gl.uniform3fv(this.locations.spritePosition, worldPos.toArray());
            gl.uniform2fv(this.locations.spriteSize, [sprite.width, sprite.height]);
            gl.uniform1i(this.locations.isBillboard, sprite.isBillboard ? 1 : 0);
            if (!sprite.isBillboard) {
                gl.uniform3fv(this.locations.spriteForward, sprite.forward.toArray());
                gl.uniform3fv(this.locations.spriteUp, sprite.up.toArray());
            }
            gl.uniform3fv(this.locations.color, sprite.color);
            gl.uniform1f(this.locations.alpha, sprite.alpha);
            
            // Draw the quad
            gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        }
        
        // Restore depth writing
        gl.depthMask(true);
        
        // Restore normal blending
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        // Cleanup
        gl.disableVertexAttribArray(this.locations.position);
        gl.disableVertexAttribArray(this.locations.texCoord);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    
    /**
     * Calculate camera right and up vectors for billboarding
     * @param {Object} camera - Camera object
     * @returns {Object} Object containing right and up vectors
     * @private
     */
    _calculateCameraVectors(camera) {
        // Calculate view direction
        const forward = camera.target.sub(camera.position).normalize();
        
        // Calculate right vector (cross product of forward and world up)
        const worldUp = new Vector3(0, 1, 0);
        const right = forward.cross(worldUp).normalize();
        
        // Calculate up vector (cross product of right and forward)
        const up = right.cross(forward).normalize();
        
        return { right, up };
    }
    
    /**
     * Set OpenGL blend mode based on sprite blend mode
     * @param {string} blendMode - Blend mode ('normal', 'additive', 'multiply')
     * @private
     */
    _setBlendMode(blendMode) {
        const gl = this.gl;
        
        switch (blendMode) {
            case 'additive':
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
                break;
            case 'multiply':
                gl.blendFunc(gl.DST_COLOR, gl.ZERO);
                break;
            case 'normal':
            default:
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                break;
        }
    }
    
    /**
     * Cleanup WebGL resources
     */
    dispose() {
        const gl = this.gl;
        
        if (this.quadBuffer) {
            gl.deleteBuffer(this.quadBuffer);
            this.quadBuffer = null;
        }
        
        if (this.indexBuffer) {
            gl.deleteBuffer(this.indexBuffer);
            this.indexBuffer = null;
        }
        
        if (this.program) {
            gl.deleteProgram(this.program);
            this.program = null;
        }
    }
}