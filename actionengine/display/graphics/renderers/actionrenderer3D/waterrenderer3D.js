class WaterRenderer3D {
    constructor(gl, programManager) {
        this.gl = gl;
        this.programManager = programManager;
        this.waterProgram = programManager.getWaterProgram();
        this.waterLocations = programManager.getWaterLocations();
        this.waterBuffers = {
            position: gl.createBuffer(),
            normal: gl.createBuffer(),
            texCoord: gl.createBuffer(),
            indices: gl.createBuffer()
        };
        this.waterIndexCount = 0;
        
        // Add configuration options for water appearance
        this.waterConfig = {
    waveHeight: 2.0,  // Increased from 0.5 to 2.0 to match shader
    waveSpeed: 1.0,
    transparency: 0.8,
    reflectivity: 0.6,
    waterColor: [0.0, 0.48, 0.71],
    waveDensity: 2.0
};
        
        this.initializeWaterMesh();
    }

    initializeWaterMesh() {
        // Create a more detailed water mesh grid
        const gridSize = 32; // Increase detail level
        const size = 100;
        const vertices = [];
        const normals = [];
        const texCoords = [];
        const indices = [];
        
        // Generate grid mesh
        for (let z = 0; z <= gridSize; z++) {
            for (let x = 0; x <= gridSize; x++) {
                const xPos = (x / gridSize * 2 - 1) * size;
                const zPos = (z / gridSize * 2 - 1) * size;
                
                vertices.push(xPos, 0, zPos);
                normals.push(0, 1, 0);
                texCoords.push(x / gridSize, z / gridSize);
            }
        }
        
        // Generate indices for triangle strips
        for (let z = 0; z < gridSize; z++) {
            for (let x = 0; x < gridSize; x++) {
                const topLeft = z * (gridSize + 1) + x;
                const topRight = topLeft + 1;
                const bottomLeft = (z + 1) * (gridSize + 1) + x;
                const bottomRight = bottomLeft + 1;
                
                indices.push(topLeft, bottomLeft, topRight);
                indices.push(topRight, bottomLeft, bottomRight);
            }
        }

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.waterBuffers.position);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.waterBuffers.normal);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(normals), this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.waterBuffers.texCoord);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(texCoords), this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.waterBuffers.indices);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), this.gl.STATIC_DRAW);

        this.waterIndexCount = indices.length;
    }

    render(camera, currentTime, ocean) {
        this.gl.useProgram(this.waterProgram);

        // Enhanced depth and blending setup
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthMask(false); // Changed to false for better transparency handling
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        const projection = Matrix4.perspective(Matrix4.create(), camera.fov, Game.WIDTH / Game.HEIGHT, 0.1, 10000.0);
        const view = Matrix4.create();
        Matrix4.lookAt(view, camera.position.toArray(), camera.target.toArray(), camera.up.toArray());
        const model = Matrix4.create();

        // Update water simulation
        this.updateBuffersWithOcean(ocean);

        // Set uniforms
        this.gl.uniformMatrix4fv(this.waterLocations.projectionMatrix, false, projection);
        this.gl.uniformMatrix4fv(this.waterLocations.viewMatrix, false, view);
        this.gl.uniformMatrix4fv(this.waterLocations.modelMatrix, false, model);
        this.gl.uniform1f(this.waterLocations.time, currentTime * this.waterConfig.waveSpeed);
        this.gl.uniform3fv(this.waterLocations.cameraPos, camera.position.toArray());
        this.gl.uniform3fv(this.waterLocations.lightDir, [0.5, -1.0, 0.5]);
        
        // Add new water configuration uniforms
        this.gl.uniform1f(this.waterLocations.waveHeight, this.waterConfig.waveHeight);
        this.gl.uniform1f(this.waterLocations.transparency, this.waterConfig.transparency);
        this.gl.uniform1f(this.waterLocations.reflectivity, this.waterConfig.reflectivity);
        this.gl.uniform3fv(this.waterLocations.waterColor, this.waterConfig.waterColor);
        this.gl.uniform1f(this.waterLocations.waveDensity, this.waterConfig.waveDensity);

        // Set up attributes
        this.setupAttributes();
        
        // Draw water
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.waterBuffers.indices);
        this.gl.drawElements(this.gl.TRIANGLES, this.waterIndexCount, this.gl.UNSIGNED_SHORT, 0);

        // Cleanup
        this.gl.depthMask(true);
        this.gl.disable(this.gl.BLEND);
    }

    setupAttributes() {
        // Helper method to set up vertex attributes
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.waterBuffers.position);
        this.gl.vertexAttribPointer(this.waterLocations.position, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.waterLocations.position);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.waterBuffers.normal);
        this.gl.vertexAttribPointer(this.waterLocations.normal, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.waterLocations.normal);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.waterBuffers.texCoord);
        this.gl.vertexAttribPointer(this.waterLocations.texCoord, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.waterLocations.texCoord);
    }

    updateBuffersWithOcean(ocean) {
        if (!ocean.triangles?.length) return;
        
        const positions = new Float32Array(ocean.triangles.length * 9);
        const normals = new Float32Array(ocean.triangles.length * 9);
        const indices = new Uint16Array(ocean.triangles.length * 3);
        
        ocean.triangles.forEach((triangle, i) => {
            const baseIndex = i * 9;
            for (let j = 0; j < 3; j++) {
                // Add subtle wave movement
                const offset = Math.sin(Date.now() * 0.001 + triangle.vertices[j].x * 0.1) * this.waterConfig.waveHeight;
                
                positions[baseIndex + j*3] = triangle.vertices[j].x;
                positions[baseIndex + j*3 + 1] = triangle.vertices[j].y + offset + ocean.body.position.y;
                positions[baseIndex + j*3 + 2] = triangle.vertices[j].z;
                
                normals[baseIndex + j*3] = triangle.normal.x;
                normals[baseIndex + j*3 + 1] = triangle.normal.y;
                normals[baseIndex + j*3 + 2] = triangle.normal.z;
                
                indices[i*3 + j] = i*3 + j;
            }
        });

        this.waterIndexCount = indices.length;
        
        // Use DYNAMIC_DRAW for constantly updating buffers
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.waterBuffers.position);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.DYNAMIC_DRAW);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.waterBuffers.normal);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, normals, this.gl.DYNAMIC_DRAW);
        
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.waterBuffers.indices);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.DYNAMIC_DRAW);
    }
}