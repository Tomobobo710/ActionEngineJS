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
    bindDefaultUBO(program) {
        const gl = this.gl;
        const blockIndex = gl.getUniformBlockIndex(program, "BoneMatrices");
        if (blockIndex === gl.INVALID_INDEX) {
            return;
        }

        gl.uniformBlockBinding(program, blockIndex, this.defaultUBO.bindingPoint);
        gl.bindBufferBase(gl.UNIFORM_BUFFER, this.defaultUBO.bindingPoint, this.defaultUBO.buffer);
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
        const blockIndex = gl.getUniformBlockIndex(program, "BoneMatrices");
        if (blockIndex === gl.INVALID_INDEX) {
            // Shader doesn't use bone matrices
            return;
        }

        // Connect shader uniform block to binding point
        gl.uniformBlockBinding(program, blockIndex, uboInfo.bindingPoint);
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
