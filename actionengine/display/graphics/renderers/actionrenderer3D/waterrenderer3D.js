// game/display/gl/renderers/waterrenderer3D.js
class WaterRenderer3D {
    constructor(gl, programManager) {
        this.gl = gl;
    this.programManager = programManager; // Add this line
    this.waterProgram = programManager.getWaterProgram();
    this.waterLocations = programManager.getWaterLocations();
    this.waterBuffers = {
        position: gl.createBuffer(),
        normal: gl.createBuffer(),
        texCoord: gl.createBuffer(),
        indices: gl.createBuffer()
    };
    this.waterIndexCount = 0;
    this.initializeWaterMesh();
    }

    initializeWaterMesh() {
        // Create a simple water plane
        const vertices = new Float32Array([
            -100, 0, -100,  100, 0, -100,
            -100, 0,  100,  100, 0,  100
        ]);
        const normals = new Float32Array([
            0, 1, 0,  0, 1, 0,
            0, 1, 0,  0, 1, 0
        ]);
        const texCoords = new Float32Array([
            0, 0,  1, 0,
            0, 1,  1, 1
        ]);
        const indices = new Uint16Array([0, 1, 2, 2, 1, 3]);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.waterBuffers.position);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.waterBuffers.normal);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, normals, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.waterBuffers.texCoord);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.waterBuffers.indices);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW);

        this.waterIndexCount = indices.length;
    }

    render(camera, currentTime, ocean) {
   this.gl.useProgram(this.waterProgram);

   this.gl.enable(this.gl.DEPTH_TEST);
   this.gl.depthMask(false);
   this.gl.enable(this.gl.BLEND); 
   this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

   const projection = Matrix4.perspective(Matrix4.create(), camera.fov, Game.WIDTH / Game.HEIGHT, 0.1, 10000.0);
   const view = Matrix4.create();
   Matrix4.lookAt(view, camera.position.toArray(), camera.target.toArray(), camera.up.toArray());
   const model = Matrix4.create();

   this.updateBuffersWithOcean(ocean);

   this.gl.uniformMatrix4fv(this.waterLocations.projectionMatrix, false, projection);
   this.gl.uniformMatrix4fv(this.waterLocations.viewMatrix, false, view);
   this.gl.uniformMatrix4fv(this.waterLocations.modelMatrix, false, model);
   this.gl.uniform1f(this.waterLocations.time, currentTime);
   this.gl.uniform3fv(this.waterLocations.cameraPos, camera.position.toArray());
   this.gl.uniform3fv(this.waterLocations.lightDir, [0.5, -1.0, 0.5]);

   this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.waterBuffers.position);
   this.gl.vertexAttribPointer(this.waterLocations.position, 3, this.gl.FLOAT, false, 0, 0);
   this.gl.enableVertexAttribArray(this.waterLocations.position);

   this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.waterBuffers.normal);
   this.gl.vertexAttribPointer(this.waterLocations.normal, 3, this.gl.FLOAT, false, 0, 0);
   this.gl.enableVertexAttribArray(this.waterLocations.normal);

   this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.waterBuffers.texCoord);
   this.gl.vertexAttribPointer(this.waterLocations.texCoord, 2, this.gl.FLOAT, false, 0, 0);
   this.gl.enableVertexAttribArray(this.waterLocations.texCoord);

   this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.waterBuffers.indices);
   this.gl.drawElements(this.gl.TRIANGLES, this.waterIndexCount, this.gl.UNSIGNED_SHORT, 0);

   this.gl.depthMask(true);
   this.gl.disable(this.gl.BLEND);
        
    }
updateBuffersWithOcean(ocean) {
	//console.log("Ocean triangles:", ocean.triangles);
    //console.log("First triangle vertices:", ocean.triangles[0]?.vertices);
    const positions = new Float32Array(ocean.triangles.length * 9);
    const normals = new Float32Array(ocean.triangles.length * 9);
    const indices = new Uint16Array(ocean.triangles.length * 3);
    
    ocean.triangles.forEach((triangle, i) => {
        const baseIndex = i * 9;
        for (let j = 0; j < 3; j++) {
            positions[baseIndex + j*3] = triangle.vertices[j].x;
            positions[baseIndex + j*3 + 1] = triangle.vertices[j].y;
            positions[baseIndex + j*3 + 2] = triangle.vertices[j].z;
            
            normals[baseIndex + j*3] = triangle.normal.x;
            normals[baseIndex + j*3 + 1] = triangle.normal.y;
            normals[baseIndex + j*3 + 2] = triangle.normal.z;
            
            indices[i*3 + j] = i*3 + j;
        }
    });

    this.waterIndexCount = indices.length;
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.waterBuffers.position);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.DYNAMIC_DRAW);
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.waterBuffers.normal);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, normals, this.gl.DYNAMIC_DRAW);
    
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.waterBuffers.indices);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.DYNAMIC_DRAW);
}
}