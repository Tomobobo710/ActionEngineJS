//actionengine/rendering/renderers/actionrenderer3D/waterrenderer3D.js
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
            waveHeight: 2.0,
            waveSpeed: 1.0,
            transparency: 0.8,
            reflectivity: 0.6,
            waterColor: [0.0, 0.48, 0.71],
            waveDensity: 2.0
        };

        // Pre-allocated buffers for ocean geometry (avoid per-frame allocation)
        // Max 100k triangles = 300k vertices
        this.maxOceanVertices = 300000;
        this._oceanPositionsBuffer = new Float32Array(this.maxOceanVertices * 3);
        this._oceanNormalsBuffer = new Float32Array(this.maxOceanVertices * 3);
        this._oceanTexCoordsBuffer = new Float32Array(this.maxOceanVertices * 2);
        this._oceanIndicesBuffer = new Uint16Array(this.maxOceanVertices);

        // Track ocean mesh registration
        this._oceanMeshRegistered = false;
        this._lastOceanTriangleCount = 0;

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
                const xPos = ((x / gridSize) * 2 - 1) * size;
                const zPos = ((z / gridSize) * 2 - 1) * size;

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

        const projection = Matrix4.perspective(Matrix4.create(), camera.fov, Game.WIDTH / Game.HEIGHT, 0.1, 10000.0);
        const view = Matrix4.create();
        Matrix4.lookAt(view, camera.position.toArray(), camera.target.toArray(), camera.up.toArray());
        const model = Matrix4.create();

        // Update water simulation
        this.updateBuffersWithOcean(ocean);

        // Set uniforms
        this.gl.uniformMatrix4fv(this.waterLocations.projectionMatrix, false, projection);
        this.gl.uniformMatrix4fv(this.waterLocations.viewMatrix, false, view);

        // Send GPU-side matrix construction uniforms (water is typically at identity/origin)
        if (this.waterLocations.modelPos !== -1 && this.waterLocations.modelPos !== null) {
            this.gl.uniform3fv(this.waterLocations.modelPos, [0, 0, 0]);
        }
        if (this.waterLocations.modelRotation !== -1 && this.waterLocations.modelRotation !== null) {
            this.gl.uniform4fv(this.waterLocations.modelRotation, [0, 0, 0, 1]);
        }
        if (this.waterLocations.modelScale !== -1 && this.waterLocations.modelScale !== null) {
            this.gl.uniform1f(this.waterLocations.modelScale, 1.0);
        }

        this.gl.uniform1f(this.waterLocations.time, currentTime * this.waterConfig.waveSpeed);
        this.gl.uniform3fv(this.waterLocations.cameraPos, camera.position.toArray());
        this.gl.uniform3fv(this.waterLocations.lightDir, [0.5, -1.0, 0.5]);

        // Set far plane for logarithmic depth
        const farPlaneLoc = this.gl.getUniformLocation(this.waterProgram, "uFarPlane");
        if (farPlaneLoc !== -1 && farPlaneLoc !== null) {
            this.gl.uniform1f(farPlaneLoc, 10000.0);
        }

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

        const triangleCount = ocean.triangles.length;
        const vertexCount = triangleCount * 3;

        // Only rebuild if triangle count changed
        if (this._lastOceanTriangleCount !== triangleCount) {
            let posOffset = 0;
            let normOffset = 0;
            let texOffset = 0;
            let indOffset = 0;

            // Fill buffers with ocean geometry (normals and positions are base, not wave-affected)
            for (let i = 0; i < triangleCount; i++) {
                const triangle = ocean.triangles[i];

                for (let j = 0; j < 3; j++) {
                    const vert = triangle.vertices[j];

                    // Position (base - waves applied in shader)
                    this._oceanPositionsBuffer[posOffset++] = vert.x;
                    this._oceanPositionsBuffer[posOffset++] = vert.y + ocean.body.position.y;
                    this._oceanPositionsBuffer[posOffset++] = vert.z;

                    // Normal (static per triangle)
                    this._oceanNormalsBuffer[normOffset++] = triangle.normal.x;
                    this._oceanNormalsBuffer[normOffset++] = triangle.normal.y;
                    this._oceanNormalsBuffer[normOffset++] = triangle.normal.z;

                    // Tex coords (defaulted)
                    this._oceanTexCoordsBuffer[texOffset++] = j === 1 ? 1.0 : j === 2 ? 0.5 : 0.0;
                    this._oceanTexCoordsBuffer[texOffset++] = j === 2 ? 1.0 : 0.0;

                    // Index
                    this._oceanIndicesBuffer[indOffset++] = indOffset - 1;
                }
            }

            this.waterIndexCount = vertexCount;
            this._lastOceanTriangleCount = triangleCount;

            // Upload buffers once (STATIC_DRAW since geometry is fixed)
            const gl = this.gl;

            gl.bindBuffer(gl.ARRAY_BUFFER, this.waterBuffers.position);
            gl.bufferData(gl.ARRAY_BUFFER, this._oceanPositionsBuffer.subarray(0, vertexCount * 3), gl.STATIC_DRAW);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.waterBuffers.normal);
            gl.bufferData(gl.ARRAY_BUFFER, this._oceanNormalsBuffer.subarray(0, vertexCount * 3), gl.STATIC_DRAW);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.waterBuffers.texCoord);
            gl.bufferData(gl.ARRAY_BUFFER, this._oceanTexCoordsBuffer.subarray(0, vertexCount * 2), gl.STATIC_DRAW);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.waterBuffers.indices);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._oceanIndicesBuffer.subarray(0, vertexCount), gl.STATIC_DRAW);
        }
    }
}
