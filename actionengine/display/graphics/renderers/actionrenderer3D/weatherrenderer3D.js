// actionengine/display/graphics/renderers/actionrenderer3D/weatherrenderer3D.js
class WeatherRenderer3D {
    constructor(gl, programManager) {
        this.gl = gl;
        this.programManager = programManager;

        // Get particle programs and locations
        this.particleProgram = this.programManager.getParticleProgram();
        this.particleLocations = this.programManager.getParticleLocations();

        // Create buffers for particles
        this.particleBuffers = {
            position: this.gl.createBuffer(),
            size: this.gl.createBuffer(),
            color: this.gl.createBuffer()
        };
    }

    render(weatherSystem, camera) {
        if (!weatherSystem || !weatherSystem.particleEmitter) {
            return;
        }

        const particles = weatherSystem.particleEmitter.getParticles();
        if (particles.length === 0) {
            return;
        }

        // Update particle buffers
        const positions = new Float32Array(particles.length * 3);
        const sizes = new Float32Array(particles.length);
        const colors = new Float32Array(particles.length * 4);

        particles.forEach((particle, i) => {
            positions[i * 3] = particle.position.x;
            positions[i * 3 + 1] = particle.position.y;
            positions[i * 3 + 2] = particle.position.z;

            sizes[i] = particle.size;

            // Assuming rain particles are bluish
            colors[i * 4] = 0.7;     // R
            colors[i * 4 + 1] = 0.7; // G
            colors[i * 4 + 2] = 1.0; // B
            colors[i * 4 + 3] = particle.alpha; // A
        });

        // Set up WebGL state for particle rendering
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        // Use particle shader
        this.gl.useProgram(this.particleProgram);

        // Set matrices
        const projection = Matrix4.perspective(Matrix4.create(), camera.fov, Game.WIDTH / Game.HEIGHT, 0.1, 10000.0);
        const view = Matrix4.create();
        Matrix4.lookAt(view, camera.position.toArray(), camera.target.toArray(), camera.up.toArray());

        this.gl.uniformMatrix4fv(this.particleLocations.projectionMatrix, false, projection);
        this.gl.uniformMatrix4fv(this.particleLocations.viewMatrix, false, view);

        // Update and bind position buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.particleBuffers.position);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.DYNAMIC_DRAW);
        this.gl.vertexAttribPointer(this.particleLocations.position, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.particleLocations.position);

        // Update and bind size buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.particleBuffers.size);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, sizes, this.gl.DYNAMIC_DRAW);
        this.gl.vertexAttribPointer(this.particleLocations.size, 1, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.particleLocations.size);

        // Update and bind color buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.particleBuffers.color);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, colors, this.gl.DYNAMIC_DRAW);
        this.gl.vertexAttribPointer(this.particleLocations.color, 4, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.particleLocations.color);

        // Draw particles
        this.gl.drawArrays(this.gl.POINTS, 0, particles.length);

        // Cleanup
        this.gl.disable(this.gl.BLEND);
    }
}