//actionengine/gl/uniformbuffermanager.js

/**
 * Manages Uniform Buffer Objects (UBOs) for animated objects.
 * Each animated object gets its own UBO to store bone matrices,
 * preventing conflicts when multiple objects are animated.
 */
class UniformBufferManager {
    constructor(gl) {
        this.gl = gl;
        this.ubos = new Map(); // Map of objectId -> UBO info
        this.nextBindingPoint = 0; // Counter for unique binding points
        this.defaultUBO = null; // Default UBO for non-skeletal objects
        this._blocks = new Map(); // program -> { index, point }: cached "BoneMatrices" block index and current binding point
        this._defaultBound = false; // is the default UBO currently bound at its binding point
        this.initDefaultUBO();
    }

    /**
     * Initialize a default UBO filled with identity matrices.
     * Used when rendering non-skeletal objects that don't need animation.
     */
    initDefaultUBO() {
        const gl = this.gl;

        // Create default buffer (256 mat4s = 4096 floats = 16384 bytes)
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.UNIFORM_BUFFER, buffer);
        gl.bufferData(gl.UNIFORM_BUFFER, 256 * 16 * 4, gl.STATIC_DRAW);

        // Fill with identity matrices
        const identityMatrices = new Float32Array(256 * 16);
        for (let i = 0; i < 256; i++) {
            const offset = i * 16;
            identityMatrices[offset] = 1;
            identityMatrices[offset + 5] = 1;
            identityMatrices[offset + 10] = 1;
            identityMatrices[offset + 15] = 1;
        }
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, identityMatrices);

        const bindingPoint = this.nextBindingPoint++;
        gl.bindBufferBase(gl.UNIFORM_BUFFER, bindingPoint, buffer);

        this.defaultUBO = {
            buffer: buffer,
            bindingPoint: bindingPoint
        };

        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    }

    /**
     * Bind the default UBO for non-skeletal objects.
     * @param {WebGLProgram} program - The shader program
     */
    // The "BoneMatrices" block index of a program never changes, and the binding point it is wired to only changes when an
    // animated object asks for a different one. Both used to be looked up / re-set on EVERY draw (a getUniformBlockIndex,
    // uniformBlockBinding and bindBufferBase per object - the dominant per-draw cost with hundreds of objects). They are
    // now remembered per program and only re-issued when they actually change.
    _block(program) {
        let info = this._blocks.get(program);
        if (!info) {
            info = { index: this.gl.getUniformBlockIndex(program, "BoneMatrices"), point: -1 };
            this._blocks.set(program, info);
        }
        return info;
    }

    bindDefaultUBO(program) {
        const gl = this.gl;
        const info = this._block(program);
        if (info.index === gl.INVALID_INDEX) {
            return;
        }

        if (info.point !== this.defaultUBO.bindingPoint) {
            gl.uniformBlockBinding(program, info.index, this.defaultUBO.bindingPoint);
            info.point = this.defaultUBO.bindingPoint;
        }
        if (!this._defaultBound) {
            gl.bindBufferBase(gl.UNIFORM_BUFFER, this.defaultUBO.bindingPoint, this.defaultUBO.buffer);
            this._defaultBound = true;
        }
    }

    /**
     * Create a UBO for an animated object.
     * @param {string} objectId - Unique identifier for the animated object
     * @returns {WebGLBuffer} The created UBO
     */
    createAnimatedObjectUBO(objectId) {
        const gl = this.gl;

        // Create buffer (256 mat4s = 4096 floats = 16384 bytes)
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.UNIFORM_BUFFER, buffer);
        gl.bufferData(gl.UNIFORM_BUFFER, 256 * 16 * 4, gl.DYNAMIC_DRAW);

        // Initialize with identity matrices
        const identityMatrices = new Float32Array(256 * 16);
        for (let i = 0; i < 256; i++) {
            const offset = i * 16;
            identityMatrices[offset] = 1;
            identityMatrices[offset + 5] = 1;
            identityMatrices[offset + 10] = 1;
            identityMatrices[offset + 15] = 1;
        }
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, identityMatrices);

        // Assign unique binding point for this object
        const bindingPoint = this.nextBindingPoint++;

        // Bind to binding point
        gl.bindBufferBase(gl.UNIFORM_BUFFER, bindingPoint, buffer);

        // Store UBO info
        this.ubos.set(objectId, {
            buffer: buffer,
            bindingPoint: bindingPoint,
            lastUpdateTime: -1
        });

        gl.bindBuffer(gl.UNIFORM_BUFFER, null);

        return buffer;
    }

    /**
     * Update bone matrices for an animated object.
     * @param {string} objectId - Unique identifier for the animated object
     * @param {Float32Array} matrices - Flattened array of bone matrices
     */
    updateAnimatedObjectMatrices(objectId, matrices) {
        const uboInfo = this.ubos.get(objectId);
        if (!uboInfo) {
            console.warn(`UBO not found for animated object: ${objectId}`);
            return;
        }

        const gl = this.gl;
        gl.bindBuffer(gl.UNIFORM_BUFFER, uboInfo.buffer);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, matrices);
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    }

    /**
     * Bind a UBO for rendering.
     * @param {string} objectId - Unique identifier for the animated object
     * @param {WebGLProgram} program - The shader program to bind the UBO to
     */
    bindAnimatedObjectUBO(objectId, program) {
        const uboInfo = this.ubos.get(objectId);
        if (!uboInfo) {
            console.warn(`UBO not found for animated object: ${objectId}`);
            return;
        }

        const gl = this.gl;
        const info = this._block(program);
        if (info.index === gl.INVALID_INDEX) {
            // Shader doesn't use bone matrices
            return;
        }

        // Connect shader uniform block to binding point
        if (info.point !== uboInfo.bindingPoint) {
            gl.uniformBlockBinding(program, info.index, uboInfo.bindingPoint);
            info.point = uboInfo.bindingPoint;
        }
    }

    /**
     * Remove a UBO when an animated object is destroyed.
     * @param {string} objectId - Unique identifier for the animated object
     */
    deleteAnimatedObjectUBO(objectId) {
        const uboInfo = this.ubos.get(objectId);
        if (uboInfo) {
            this.gl.deleteBuffer(uboInfo.buffer);
            this.ubos.delete(objectId);
        }
    }

    /**
     * Get UBO info for an animated object.
     * @param {string} objectId - Unique identifier for the animated object
     * @returns {Object|null} UBO info or null if not found
     */
    getUBOInfo(objectId) {
        return this.ubos.get(objectId) || null;
    }
}
