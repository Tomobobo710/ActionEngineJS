// actionengine/display/graphics/renderers/actionrenderer3D/debugrenderer3D.js
class DebugRenderer3D {
    constructor(gl, programManager, lightingManager, shadowManager) {
        this.gl = gl;
        this.programManager = programManager;
        this.lightingManager = lightingManager;
        this.shadowManager = shadowManager;
        
        // Reference to lighting constants
        this.constants = lightingConstants;

        // Create buffer for direction indicators
        this.directionBuffer = this.gl.createBuffer();
        
        // Line buffer for drawing
        this.directionBuffer = this.gl.createBuffer();
        
        // Enable shadow map debug labels
        this._shadowDebugLabels = true;
        
        // Track shadow map visualization state
        this._wasVisualizingShadowMap = false;
    }
    
    
    drawDebugLines(camera, character, currentTime) {
        // Clear previous data
        const shaderSet = this.programManager.getProgramRegistry().getCurrentShaderSet();
        
        // Draw character-related debug info if character exists
        if (character) {
            const currentTriangle = character.getCurrentTriangle();
            if (currentTriangle) {
                this.drawTriangleNormal(currentTriangle, camera, shaderSet.lines, currentTime);
            }
            this.drawDirectionIndicator(character, camera, shaderSet.lines, currentTime);
        }
        
        // Always try to draw light frustum - it will check for the DEBUG.VISUALIZE_FRUSTUM flag internally
        this.drawLightFrustum(camera, shaderSet.lines);
        
        // Draw shadow map visualization if enabled
        this.drawShadowMapDebug(camera);
    }

    drawTriangleNormal(triangle, camera, lineShader, currentTime) {
        // Calculate triangle center
        const v1 = triangle.vertices[0];
        const v2 = triangle.vertices[1];
        const v3 = triangle.vertices[2];
        const center = [(v1.x + v2.x + v3.x) / 3, (v1.y + v2.y + v3.y) / 3, (v1.z + v2.z + v3.z) / 3];

        // Create normal line
        const normalLength = 10;
        const end = [
            center[0] + triangle.normal.x * normalLength,
            center[1] + triangle.normal.y * normalLength,
            center[2] + triangle.normal.z * normalLength
        ];

        this.drawLine(center, end, camera, lineShader, currentTime);
    }

    drawDirectionIndicator(character, camera, lineShader, currentTime) {
        const center = character.position;
        const directionEnd = new Vector3(
            center.x + character.facingDirection.x * character.size * 2,
            center.y,
            center.z + character.facingDirection.z * character.size * 2
        );

        this.drawLine(center.toArray(), directionEnd.toArray(), camera, lineShader, currentTime);
    }
    /**
     * Draw the light frustum for visualization
     */
    drawLightFrustum(camera, lineShader) {
        if (!this.shadowManager || !this.lightingManager) return;
        
        // Check if frustum visualization is enabled in constants
        if (!this.constants.DEBUG.VISUALIZE_FRUSTUM && !this.constants.DEBUG.VISUALIZE_SHADOW_MAP) return;
        
        // If shadow map visualization is enabled but frustum visualization is disabled,
        // still allow the shadow map debugging code to run but don't draw the frustum lines
        const drawFrustumLines = this.constants.DEBUG.VISUALIZE_FRUSTUM;
        
        // Get light position and direction
        const lightPos = this.lightingManager.lightPos;
        const lightDir = this.lightingManager.getLightDir();
        
        // Get shadow projection parameters
        const projection = this.shadowManager.getShadowProjection ? 
                          this.shadowManager.getShadowProjection() : 
                          this.lightingManager.getShadowProjection();
                          
        const left = projection.left;
        const right = projection.right;
        const bottom = projection.bottom;
        const top = projection.top;
        const near = projection.near;
        const far = projection.far;
        
        // Calculate frustum corners in light space
        const corners = [
            // Near plane (4 corners)
            [left, bottom, -near],
            [right, bottom, -near],
            [right, top, -near],
            [left, top, -near],
            
            // Far plane (4 corners)
            [left, bottom, -far],
            [right, bottom, -far],
            [right, top, -far],
            [left, top, -far]
        ];
        
        // Create light view matrix
        const lightViewMatrix = Matrix4.create();
        const lightTarget = new Vector3(
            lightPos.x + lightDir.x * 100,
            lightPos.y + lightDir.y * 100,
            lightPos.z + lightDir.z * 100
        );
        
        Matrix4.lookAt(
            lightViewMatrix,
            lightPos.toArray(),
            lightTarget.toArray(),
            [0, 1, 0] // Up vector
        );
        
        // Invert the light view matrix to transform frustum from light space to world space
        const invLightViewMatrix = Matrix4.create();
        Matrix4.invert(invLightViewMatrix, lightViewMatrix);
        
        // Transform corners to world space
        const worldCorners = corners.map(corner => {
            const worldCorner = [0, 0, 0, 1];
            Matrix4.multiplyVector(worldCorner, invLightViewMatrix, [...corner, 1]);
            return [worldCorner[0], worldCorner[1], worldCorner[2]];
        });
        
        // Draw lines connecting the corners (frustum edges) if frustum visualization is enabled
        if (drawFrustumLines) {
            // Near plane
            this.drawLine(worldCorners[0], worldCorners[1], camera, lineShader, 0, [1.0, 1.0, 0.2]);
            this.drawLine(worldCorners[1], worldCorners[2], camera, lineShader, 0, [1.0, 1.0, 0.2]);
            this.drawLine(worldCorners[2], worldCorners[3], camera, lineShader, 0, [1.0, 1.0, 0.2]);
            this.drawLine(worldCorners[3], worldCorners[0], camera, lineShader, 0, [1.0, 1.0, 0.2]);
            
            // Far plane
            this.drawLine(worldCorners[4], worldCorners[5], camera, lineShader, 0, [1.0, 1.0, 0.2]);
            this.drawLine(worldCorners[5], worldCorners[6], camera, lineShader, 0, [1.0, 1.0, 0.2]);
            this.drawLine(worldCorners[6], worldCorners[7], camera, lineShader, 0, [1.0, 1.0, 0.2]);
            this.drawLine(worldCorners[7], worldCorners[4], camera, lineShader, 0, [1.0, 1.0, 0.2]);
            
            // Connecting edges
            this.drawLine(worldCorners[0], worldCorners[4], camera, lineShader, 0, [1.0, 1.0, 0.2]);
            this.drawLine(worldCorners[1], worldCorners[5], camera, lineShader, 0, [1.0, 1.0, 0.2]);
            this.drawLine(worldCorners[2], worldCorners[6], camera, lineShader, 0, [1.0, 1.0, 0.2]);
            this.drawLine(worldCorners[3], worldCorners[7], camera, lineShader, 0, [1.0, 1.0, 0.2]);
        }
        
        // Draw light position and direction
        const lightPosArray = [lightPos.x, lightPos.y, lightPos.z];
        const lightDirEnd = [
            lightPos.x + lightDir.x * 50,
            lightPos.y + lightDir.y * 50,
            lightPos.z + lightDir.z * 50
        ];
        
        // Always draw the light direction line, even if frustum lines are disabled
        this.drawLine(lightPosArray, lightDirEnd, camera, lineShader, 0, [1.0, 0.8, 0.2]);
    }

    drawLine(start, end, camera, lineShader, currentTime, color = [0.2, 0.2, 1.0]) {
        const lineVerts = new Float32Array([...start, ...end]);

        this.gl.useProgram(lineShader.program);

        // Set up matrices
        const projection = Matrix4.perspective(Matrix4.create(), camera.fov, Game.WIDTH / Game.HEIGHT, 0.1, 10000.0);
        const view = Matrix4.create();
        Matrix4.lookAt(view, camera.position.toArray(), camera.target.toArray(), camera.up.toArray());

        this.gl.uniformMatrix4fv(lineShader.locations.projectionMatrix, false, projection);
        this.gl.uniformMatrix4fv(lineShader.locations.viewMatrix, false, view);
        
        // Set the line color
        const colorLocation = this.gl.getUniformLocation(lineShader.program, "uColor");
        if (colorLocation) {
            this.gl.uniform3fv(colorLocation, color);
        }
        lineShader.locations.color = this.gl.getUniformLocation(lineShader.program, "uColor");
        // Buffer and draw the line
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.directionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, lineVerts, this.gl.STATIC_DRAW);
        
        this.gl.vertexAttribPointer(lineShader.locations.position, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(lineShader.locations.position);

        this.gl.drawArrays(this.gl.LINES, 0, 2);
    }


    /**
     * Render the shadow map to a quad on screen for debugging
     * This is useful for visualizing the shadow depth map
     */
    drawShadowMapDebug(camera) {
        
        // Handle toggling visualization on/off
        if (!this.constants.DEBUG.VISUALIZE_SHADOW_MAP) {
            // If visualization was on but is now off, clean up
            if (this._wasVisualizingShadowMap) {
                this._wasVisualizingShadowMap = false;
            }
            return;
        }
        
        // Only render if we have a shadow manager
        if (!this.shadowManager) return;
        
        // Track that we're visualizing the shadow map
        this._wasVisualizingShadowMap = true;
        
        const gl = this.gl;
        
        // Create a program for rendering the depth texture if it doesn't exist
        if (!this._shadowDebugProgram) {
            // Vertex shader for rendering a simple quad
            const quadVS = `
                attribute vec2 aPosition;
                attribute vec2 aTexCoord;
                varying vec2 vTexCoord;
                
                void main() {
                    gl_Position = vec4(aPosition, 0.0, 1.0);
                    vTexCoord = aTexCoord;
                }
            `;
            
            // Fragment shader for rendering the depth texture
            const depthFS = `
                precision mediump float;
                varying vec2 vTexCoord;
                uniform sampler2D uShadowMap;
                uniform int uVisualizeMode;
                
                // Helper function to get a color based on depth value
                vec3 depthColor(float depth) {
                    // Create a heat map style visualization
                    if (depth < 0.1) return vec3(0.0, 0.0, 0.0); // Very close = black
                    if (depth < 0.25) return vec3(0.0, 0.0, depth * 4.0); // Near = blue
                    if (depth < 0.5) return vec3(0.0, depth * 2.0, 1.0 - depth * 2.0); // Mid-near = cyan to green
                    if (depth < 0.75) return vec3(depth * 2.0 - 0.5, 1.0 - (depth * 2.0 - 0.5), 0.0); // Mid-far = green to yellow
                    return vec3(1.0, 1.0 - (depth * 4.0 - 3.0), 0.0); // Far = yellow to red
                }
                
                void main() {
                    // First set a black background for areas outside the valid shadow map
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                    
                    // Get the shadow map depth value
                    float depth = texture2D(uShadowMap, vTexCoord).r;
                    
                    // Skip processing if depth is essentially zero (not part of the shadow map)
                    if (depth < 0.00001) {
                        return;
                    }
                    
                    // Different visualization modes
                    if (uVisualizeMode == 0) {
                        // Standard red visualization
                        // Apply contrast to make the visualization clearer
                        depth = clamp(depth * 1.5, 0.0, 1.0);
                        gl_FragColor = vec4(depth, depth * 0.5, depth * 0.2, 1.0);
                    } 
                    else if (uVisualizeMode == 1) {
                        // Heat map visualization
                        vec3 color = depthColor(depth);
                        gl_FragColor = vec4(color, 1.0);
                    }
                    else if (uVisualizeMode == 2) {
                        // Threshold visualization to show where depth > 0
                        float threshold = step(0.01, depth);
                        gl_FragColor = vec4(threshold, 0.0, 1.0 - threshold, 1.0);
                    }
                    else {
                        // If all else fails, grayscale
                        gl_FragColor = vec4(depth, depth, depth, 1.0);
                    }
                    
                    // Display frame around the quad
                    float border = 0.01;
                    if (vTexCoord.x < border || vTexCoord.x > 1.0 - border || 
                        vTexCoord.y < border || vTexCoord.y > 1.0 - border) {
                        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
                    }
                }
            `;
            
            // Create the program
            const programRegistry = this.programManager.getProgramRegistry();
            this._shadowDebugProgram = programRegistry.createShaderProgram(quadVS, depthFS, "shadow_debug");
            
            // Get attribute locations
            this._shadowDebugLocations = {
                position: gl.getAttribLocation(this._shadowDebugProgram, "aPosition"),
                texCoord: gl.getAttribLocation(this._shadowDebugProgram, "aTexCoord"),
                shadowMap: gl.getUniformLocation(this._shadowDebugProgram, "uShadowMap"),
                visualizeMode: gl.getUniformLocation(this._shadowDebugProgram, "uVisualizeMode")
            };
            
            // Default to visualization mode 0
            this._shadowVisualizationMode = 0;
            
            // Create buffers for quad
            this._quadPositionBuffer = gl.createBuffer();
            this._quadTexCoordBuffer = gl.createBuffer();
            
            // Create a square visualization quad adjusted for screen aspect ratio
            // Get the canvas dimensions to calculate aspect ratio
            const canvasWidth = gl.canvas.width;
            const canvasHeight = gl.canvas.height;
            const aspectRatio = canvasWidth / canvasHeight;
            
            // Size of the square as a percentage of screen height
            const quadSizeY = 0.3; // 30% of screen height
            // Adjust width based on aspect ratio to maintain square shape
            const quadSizeX = quadSizeY / aspectRatio;
            
            // Position in bottom right corner
            const quadX = 1.0 - quadSizeX * 2.0; // Right side 
            const quadY = -1.0 + quadSizeY * 0; // Bottom side
            
            console.log(`Creating shadow map visualization quad: ${quadSizeX}x${quadSizeY}, aspect ratio: ${aspectRatio}`);
            
            const quadPositions = new Float32Array([
                quadX, quadY,                   // Bottom-left
                quadX + quadSizeX * 2.0, quadY,  // Bottom-right
                quadX, quadY + quadSizeY * 2.0,  // Top-left
                quadX + quadSizeX * 2.0, quadY + quadSizeY * 2.0  // Top-right
            ]);
            
            const quadTexCoords = new Float32Array([
                0.0, 0.0,   // Bottom-left
                1.0, 0.0,   // Bottom-right
                0.0, 1.0,   // Top-left
                1.0, 1.0    // Top-right
            ]);
            
            // Upload quad data to buffers
            gl.bindBuffer(gl.ARRAY_BUFFER, this._quadPositionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, quadPositions, gl.STATIC_DRAW);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, this._quadTexCoordBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, quadTexCoords, gl.STATIC_DRAW);
        }
        
        // Save WebGL state before rendering
        const previousProgram = gl.getParameter(gl.CURRENT_PROGRAM);
        
        // Use the debug shader program
        gl.useProgram(this._shadowDebugProgram);
        
        // Unbind any existing texture first to clear state
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, null);
        
        // Now bind the shadow map texture
        gl.bindTexture(gl.TEXTURE_2D, this.shadowManager.shadowTexture);
        gl.uniform1i(this._shadowDebugLocations.shadowMap, 0);
        
        // Set visualization mode
        if (this._shadowDebugLocations.visualizeMode !== null) {
            gl.uniform1i(this._shadowDebugLocations.visualizeMode, this._shadowVisualizationMode);
        }
        
        // Cycle visualization mode when shadow map visualization is enabled
        // This gives us multiple ways to view the shadow map
        if (!this._lastVisualizationTime || performance.now() - this._lastVisualizationTime > 2000) { // Every 2 seconds
            this._shadowVisualizationMode = (this._shadowVisualizationMode + 1) % 3; // Cycle through 3 modes
            this._lastVisualizationTime = performance.now();
            console.log(`Shadow map visualization mode: ${this._shadowVisualizationMode}`);
        }
        
        // Draw the quad
        gl.bindBuffer(gl.ARRAY_BUFFER, this._quadPositionBuffer);
        gl.vertexAttribPointer(this._shadowDebugLocations.position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this._shadowDebugLocations.position);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this._quadTexCoordBuffer);
        gl.vertexAttribPointer(this._shadowDebugLocations.texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this._shadowDebugLocations.texCoord);
        
        // Disable depth testing so the quad is always visible
        const depthTestEnabled = gl.isEnabled(gl.DEPTH_TEST);
        if (depthTestEnabled) {
            gl.disable(gl.DEPTH_TEST);
        }
        
        // Draw the quad
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        
        // Restore WebGL state
        if (depthTestEnabled) {
            gl.enable(gl.DEPTH_TEST);
        }
        
        // Draw information text next to the shadow map visualization
        if (this._shadowDebugLabels) {
            // If we have a canvas 2D context available, draw text
            if (!this._canvas2d) {
                // Try to get the canvas element and create a 2D context
                const canvas = this.gl.canvas;
                if (canvas && canvas.getContext) {
                    this._canvas2d = canvas.getContext('2d');
                }
            }
            
            if (this._canvas2d) {
                const ctx = this._canvas2d;
                const canvas = this.gl.canvas;
                const width = canvas.width;
                const height = canvas.height;
                
                // Size of the shadow map display
                const quadSize = 0.3; // Same as defined for the quad
                const displayWidth = width * quadSize;
                const displayHeight = height * quadSize;
                
                // Position (bottom right of screen)
                const displayX = width - displayWidth - 10;
                const displayY = height - displayHeight - 10;
                
                // Draw visualization mode info
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(displayX, displayY - 25, displayWidth, 25);
                
                ctx.fillStyle = 'white';
                ctx.font = '12px Arial';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                
                let modeText = '';
                switch(this._shadowVisualizationMode) {
                    case 0: modeText = 'Mode: Standard (Red)'; break;
                    case 1: modeText = 'Mode: Heat Map'; break;
                    case 2: modeText = 'Mode: Threshold'; break;
                    default: modeText = 'Mode: Unknown';
                }
                
                ctx.fillText(`Shadow Map - ${modeText}`, displayX + 5, displayY - 12);
            }
        }
        
        // Restore previous program
        gl.useProgram(previousProgram);
    }
}