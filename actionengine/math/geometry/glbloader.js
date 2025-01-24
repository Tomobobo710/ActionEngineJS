/**
 * GLBLoader handles loading and parsing of GLTF/GLB 3D model files.
 * Supports skeletal animations, mesh data, and materials.
 */
class GLBLoader {
    /**
     * Creates a new GLBLoader instance.
     * Initializes empty arrays for storing model data.
     */
    constructor() {
        this.nodes = [];
        this.meshes = [];
        this.skins = [];
        this.animations = [];
        this.triangles = [];
    }

    /**
     * Loads a 3D model from either base64 string or ArrayBuffer input.
     * @param {string|ArrayBuffer} input - The model data as either base64 string or ArrayBuffer
     * @returns {GLBLoader} A loader instance containing the parsed model
     * @throws {Error} If input format is not supported
     */
    static loadModel(input) {
        if (typeof input === "string") {
            return GLBLoader.loadFromBase64(input);
        } else if (input instanceof ArrayBuffer) {
            return GLBLoader.loadFromArrayBuffer(input);
        } else {
            throw new Error("Unsupported input format. Please provide a base64 string or ArrayBuffer.");
        }
    }

    /**
     * Loads a 3D model from a base64 encoded string.
     * @param {string} base64String - The model data encoded as base64
     * @returns {GLBLoader} A loader instance containing the parsed model
     * @private
     */
    static loadFromBase64(base64String) {
        const binaryString = atob(base64String);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return GLBLoader.loadFromArrayBuffer(bytes.buffer);
    }

    /**
     * Loads a 3D model from an ArrayBuffer containing GLB data.
     * Handles the complete loading process including node hierarchy,
     * skins, meshes, and animations.
     * @param {ArrayBuffer} arrayBuffer - The GLB file data
     * @returns {GLBLoader} A loader instance containing the parsed model
     * @private
     */
    static loadFromArrayBuffer(arrayBuffer) {
        const model = new GLBLoader();
        const { gltf, binaryData } = GLBLoader.parseGLB(arrayBuffer);
        gltf.binaryData = binaryData;

        // First create all nodes
        if (gltf.nodes) {
            model.nodes = gltf.nodes.map((node, i) => new Node(node, i));

            // Then hook up node hierarchy
            for (let i = 0; i < gltf.nodes.length; i++) {
                const nodeData = gltf.nodes[i];
                if (nodeData.children) {
                    // Convert child indices to actual node references
                    model.nodes[i].children = nodeData.children.map((childIndex) => model.nodes[childIndex]);
                }
            }
        }

        // Create skins after nodes exist
        if (gltf.skins) {
            model.skins = gltf.skins.map((skin, i) => new Skin(gltf, skin, i));

            // Hook up skin references in nodes
            for (const node of model.nodes) {
                if (node.skin !== null) {
                    node.skin = model.skins[node.skin];
                }
            }
        }

        // Load meshes with skin data
        GLBLoader.loadMeshes(model, gltf, binaryData);

        // Finally load animations after everything else is set up
        if (gltf.animations) {
            model.animations = gltf.animations.map((anim) => new Animation(gltf, anim));
        }

        return model;
    }

    /**
     * Parses a GLB format binary buffer into JSON and binary data chunks.
     * @param {ArrayBuffer} arrayBuffer - The GLB file data
     * @returns {{gltf: Object, binaryData: ArrayBuffer}} Parsed GLB containing JSON and binary chunks
     * @throws {Error} If GLB file format is invalid
     * @private
     */
    static parseGLB(arrayBuffer) {
        const dataView = new DataView(arrayBuffer);
        const magic = dataView.getUint32(0, true);
        if (magic !== 0x46546c67) {
            throw new Error("Invalid GLB file");
        }

        const jsonLength = dataView.getUint32(12, true);
        const jsonText = new TextDecoder().decode(new Uint8Array(arrayBuffer, 20, jsonLength));
        const json = JSON.parse(jsonText);
        const binaryData = arrayBuffer.slice(20 + jsonLength + 8);

        return { gltf: json, binaryData };
    }

    /**
     * Processes mesh data from the GLTF JSON and creates triangle geometry.
     * @param {GLBLoader} model - The loader instance to store processed mesh data
     * @param {Object} gltf - The parsed GLTF JSON data
     * @param {ArrayBuffer} binaryData - The binary buffer containing geometry data
     * @private
     */
    static loadMeshes(model, gltf, binaryData) {
        if (!gltf.meshes) return;

        for (const mesh of gltf.meshes) {
            const meshData = {
                name: mesh.name || `mesh_${model.meshes.length}`,
                primitives: []
            };

            for (const primitive of mesh.primitives) {
                const primData = {
                    positions: GLBLoader.getAttributeData(primitive.attributes.POSITION, gltf, binaryData),
                    indices: GLBLoader.getIndexData(primitive.indices, gltf, binaryData),
                    joints: primitive.attributes.JOINTS_0
                        ? GLBLoader.getAttributeData(primitive.attributes.JOINTS_0, gltf, binaryData)
                        : null,
                    weights: primitive.attributes.WEIGHTS_0
                        ? GLBLoader.getAttributeData(primitive.attributes.WEIGHTS_0, gltf, binaryData)
                        : null,
                    material:
                        primitive.material !== undefined
                            ? GLBLoader.getMaterialColor(gltf.materials[primitive.material])
                            : null
                };

                GLBLoader.addPrimitiveTriangles(model, primData);
                meshData.primitives.push(primData);
            }

            model.meshes.push(meshData);
        }
    }

    /**
     * Extracts color information from a GLTF material.
     * @param {Object} material - GLTF material data
     * @returns {string|null} Hex color string or null if no color defined
     * @private
     */
    static getMaterialColor(material) {
        if (material?.pbrMetallicRoughness?.baseColorFactor) {
            const [r, g, b] = material.pbrMetallicRoughness.baseColorFactor;
            return `#${Math.floor(r * 255)
                .toString(16)
                .padStart(2, "0")}${Math.floor(g * 255)
                .toString(16)
                .padStart(2, "0")}${Math.floor(b * 255)
                .toString(16)
                .padStart(2, "0")}`;
        }
        return null;
    }

    /**
     * Gets typed array data from a GLTF accessor.
     * Handles different component types and creates appropriate typed arrays.
     * @param {number} accessorIndex - Index of the accessor in GLTF accessors array
     * @param {Object} gltf - The parsed GLTF JSON data
     * @param {ArrayBuffer} binaryData - The binary buffer containing the actual data
     * @returns {TypedArray} Data as appropriate TypedArray (Float32Array, Uint16Array, etc)
     * @private
     */
    static getAttributeData(accessorIndex, gltf, binaryData) {
        const accessor = gltf.accessors[accessorIndex];
        const bufferView = gltf.bufferViews[accessor.bufferView];
        const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
        const count = accessor.count;
        const components = {
            SCALAR: 1,
            VEC2: 2,
            VEC3: 3,
            VEC4: 4,
            MAT4: 16
        }[accessor.type];

        // Choose array type based on component type
        let ArrayType = Float32Array;
        if (accessor.componentType === 5121) {
            // UNSIGNED_BYTE
            ArrayType = Uint8Array;
        } else if (accessor.componentType === 5123) {
            // UNSIGNED_SHORT
            ArrayType = Uint16Array;
        } else if (accessor.componentType === 5125) {
            // UNSIGNED_INT
            ArrayType = Uint32Array;
        }

        return new ArrayType(
            binaryData.slice(byteOffset, byteOffset + count * components * ArrayType.BYTES_PER_ELEMENT)
        );
    }

    /**
     * Gets index data from a GLTF accessor.
     * Creates appropriate typed array for vertex indices.
     * @param {number} accessorIndex - Index of the accessor in GLTF accessors array
     * @param {Object} gltf - The parsed GLTF JSON data
     * @param {ArrayBuffer} binaryData - The binary buffer containing the actual data
     * @returns {TypedArray|null} Index data as Uint32Array or Uint16Array, or null if no indices
     * @private
     */
    static getIndexData(accessorIndex, gltf, binaryData) {
        if (accessorIndex === undefined) return null;

        const accessor = gltf.accessors[accessorIndex];
        const bufferView = gltf.bufferViews[accessor.bufferView];
        const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);

        return accessor.componentType === 5125
            ? new Uint32Array(binaryData, byteOffset, accessor.count)
            : new Uint16Array(binaryData, byteOffset, accessor.count);
    }

    /**
     * Processes primitive data into triangles with vertex attributes.
     * Creates triangle geometry with positions, joint weights, and material data.
     * @param {GLBLoader} model - The loader instance to store processed triangles
     * @param {Object} primitive - Primitive data containing positions, indices, joints, weights
     * @private
     */
    static addPrimitiveTriangles(model, primitive) {
        const { positions, indices, joints, weights, material } = primitive;

        // First create all vertices
        const vertexData = [];
        for (let i = 0; i < positions.length / 3; i++) {
            vertexData.push({
                position: new Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]),
                jointIndices: joints ? [joints[i * 4], joints[i * 4 + 1], joints[i * 4 + 2], joints[i * 4 + 3]] : null,
                weights: weights ? [weights[i * 4], weights[i * 4 + 1], weights[i * 4 + 2], weights[i * 4 + 3]] : null
            });
        }

        // Then create triangles using indices
        for (let i = 0; i < indices.length; i += 3) {
            const vertices = [vertexData[indices[i]], vertexData[indices[i + 1]], vertexData[indices[i + 2]]];

            const triangle = new Triangle(
                vertices[0].position,
                vertices[1].position,
                vertices[2].position,
                material || "#FF0000"
            );

            if (joints && weights) {
                triangle.jointData = vertices.map((v) => v.jointIndices);
                triangle.weightData = vertices.map((v) => v.weights);
            }

            model.triangles.push(triangle);
        }
    }
}

/**
 * Represents a node in the GLTF scene graph hierarchy.
 * Handles transformations, mesh references, and skeletal data.
 */
class Node {
    /**
     * Creates a new Node from GLTF node data.
     * @param {Object} nodeData - The GLTF node data
     * @param {number} nodeID - Unique identifier for this node
     * @param {string} [nodeData.name] - Optional name for the node
     * @param {number[]} [nodeData.children] - Array of child node indices
     * @param {number} [nodeData.mesh] - Index of associated mesh
     * @param {number} [nodeData.skin] - Index of associated skin
     * @param {number[]} [nodeData.translation] - Translation [x,y,z]
     * @param {number[]} [nodeData.rotation] - Rotation quaternion [x,y,z,w]
     * @param {number[]} [nodeData.scale] - Scale [x,y,z]
     */
    constructor(nodeData, nodeID) {
        this.nodeID = nodeID;
        this.name = nodeData.name || `node_${nodeID}`;

        // Core node properties
        /** @type {Node[]} Array of child nodes */
        this.children = nodeData.children || [];
        /** @type {number|null} Index of associated mesh */
        this.mesh = nodeData.mesh !== undefined ? nodeData.mesh : null;
        /** @type {number|null} Index of associated skin */
        this.skin = nodeData.skin !== undefined ? nodeData.skin : null;

        // Transform components
        /** @type {Vector3} Node's position in local space */
        this.translation = new Vector3(
            nodeData.translation ? nodeData.translation[0] : 0,
            nodeData.translation ? nodeData.translation[1] : 0,
            nodeData.translation ? nodeData.translation[2] : 0
        );

        /** @type {Quaternion} Node's rotation in local space */
        this.rotation = new Quaternion(
            nodeData.rotation ? nodeData.rotation[0] : 0,
            nodeData.rotation ? nodeData.rotation[1] : 0,
            nodeData.rotation ? nodeData.rotation[2] : 0,
            nodeData.rotation ? nodeData.rotation[3] : 1
        );

        /** @type {Vector3} Node's scale in local space */
        this.scale = new Vector3(
            nodeData.scale ? nodeData.scale[0] : 1,
            nodeData.scale ? nodeData.scale[1] : 1,
            nodeData.scale ? nodeData.scale[2] : 1
        );

        /** @type {Float32Array} Node's transformation matrix */
        this.matrix = Matrix4.create();
        this.updateMatrix();
    }

    /**
     * Updates the node's world matrix by combining local transform with parent's world transform.
     * Recursively updates all child nodes.
     * @param {Float32Array|null} parentWorldMatrix - Parent node's world transform matrix
     */
    updateWorldMatrix(parentWorldMatrix = null) {
        // First update local matrix
        const tempMatrix = Matrix4.create();
        Matrix4.fromRotationTranslation(tempMatrix, this.rotation, this.translation);
        Matrix4.scale(this.matrix, tempMatrix, this.scale.toArray());

        // If we have a parent, multiply by parent's world matrix
        if (parentWorldMatrix) {
            Matrix4.multiply(this.matrix, parentWorldMatrix, this.matrix);
        }

        // Update all children
        for (const child of this.children) {
            child.updateWorldMatrix(this.matrix);
        }
    }

    /**
     * Updates the node's local transformation matrix from TRS components.
     */
    updateMatrix() {
        // Create matrix from TRS components
        const tempMatrix = Matrix4.create();
        Matrix4.fromRotationTranslation(tempMatrix, this.rotation, this.translation);
        Matrix4.scale(this.matrix, tempMatrix, this.scale.toArray());
    }

    /**
     * Traverses the node hierarchy starting from this node.
     * @param {Node|null} parent - Parent node for hierarchy traversal
     * @param {Function} executeFunc - Function to execute on each node
     */
    traverse(parent, executeFunc) {
        executeFunc(this, parent);
        for (const childIndex of this.children) {
            nodes[childIndex].traverse(this, executeFunc);
        }
    }
}

/**
 * Handles interpolation of keyframe data for animations.
 * Supports linear interpolation for translations/scales and spherical interpolation for rotations.
 */
class AnimationSampler {
    /**
     * Creates a new AnimationSampler from GLTF sampler data.
     * @param {Object} gltf - The complete GLTF data object
     * @param {Object} samplerData - The GLTF animation sampler data
     * @param {number} samplerData.input - Accessor index for keyframe times
     * @param {number} samplerData.output - Accessor index for keyframe values
     * @param {string} [samplerData.interpolation='LINEAR'] - Interpolation method
     */
    constructor(gltf, samplerData) {
        /** @type {Float32Array} Array of keyframe timestamps */
        this.times = GLBLoader.getAttributeData(samplerData.input, gltf, gltf.binaryData);

        /** @type {Float32Array} Array of keyframe values (translations, rotations, or scales) */
        this.values = GLBLoader.getAttributeData(samplerData.output, gltf, gltf.binaryData);

        /** @type {string} Interpolation method ('LINEAR' by default) */
        this.interpolation = samplerData.interpolation || "LINEAR";

        /** @type {number} Current keyframe index for playback */
        this.currentIndex = 0;

        /** @type {number} Total duration of this animation track in seconds */
        this.duration = this.times[this.times.length - 1];

        /** @type {number} Time offset for handling animation loops */
        this.loopOffset = 0;
    }

    /**
     * Gets the interpolated value at the specified time.
     * Handles looping and different types of transform data.
     * @param {number} t - Current time in seconds
     * @returns {Vector3|Quaternion} Interpolated value (Vector3 for translation/scale, Quaternion for rotation)
     */
    getValue(t) {
        // Wrap time to animation duration
        t = t % this.duration;

        // Reset for new loop if needed
        if (t < this.times[this.currentIndex]) {
            this.currentIndex = 0;
            this.loopOffset = 0;
        }

        // Find appropriate keyframe pair
        while (this.currentIndex < this.times.length - 1 && t >= this.times[this.currentIndex + 1]) {
            this.currentIndex++;
        }

        // Loop back if we hit the end
        if (this.currentIndex >= this.times.length - 1) {
            this.currentIndex = 0;
        }

        // Calculate interpolation parameters
        const t0 = this.times[this.currentIndex];
        const t1 = this.times[this.currentIndex + 1];
        const progress = (t - t0) / (t1 - t0);

        // Get value indices based on component count
        const i0 = (this.currentIndex * this.values.length) / this.times.length;
        const i1 = i0 + this.values.length / this.times.length;

        // Handle different transform types
        if (this.values.length / this.times.length === 3) {
            // Translation or scale (Vector3)
            return new Vector3(
                this.lerp(this.values[i0], this.values[i1], progress),
                this.lerp(this.values[i0 + 1], this.values[i1 + 1], progress),
                this.lerp(this.values[i0 + 2], this.values[i1 + 2], progress)
            );
        } else {
            // Rotation (Quaternion)
            const start = new Quaternion(
                this.values[i0],
                this.values[i0 + 1],
                this.values[i0 + 2],
                this.values[i0 + 3]
            );
            const end = new Quaternion(this.values[i1], this.values[i1 + 1], this.values[i1 + 2], this.values[i1 + 3]);
            return start.slerp(end, progress);
        }
    }

    /**
     * Linear interpolation between two values.
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} Interpolated value
     * @private
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    }
}

/**
 * Represents an animation in the GLTF model.
 * Handles playback of keyframe animations affecting node transforms.
 */
class Animation {
    /**
     * Creates a new Animation from GLTF animation data.
     * @param {Object} gltf - The complete GLTF data object
     * @param {Object} animData - The GLTF animation data
     * @param {string} [animData.name] - Optional name for the animation
     * @param {Object[]} animData.samplers - Array of animation sampler data
     * @param {Object[]} animData.channels - Array of animation channel data
     * @param {Object} animData.channels[].target - Target information for the channel
     * @param {number} animData.channels[].target.node - Index of target node
     * @param {string} animData.channels[].target.path - Property to animate ('translation', 'rotation', or 'scale')
     * @param {number} animData.channels[].sampler - Index of sampler to use
     */
    constructor(gltf, animData) {
        /** @type {string} Name of the animation */
        this.name = animData.name || "unnamed";

        /**
         * @type {AnimationSampler[]} Array of samplers that handle interpolation
         * Each sampler manages keyframe data for a specific transform component
         */
        this.samplers = animData.samplers.map((s) => new AnimationSampler(gltf, s));

        /**
         * @type {Object[]} Array of channels that connect samplers to nodes
         * Each channel maps a sampler to a specific node's transform property
         */
        this.channels = animData.channels.map((c) => ({
            sampler: this.samplers[c.sampler],
            targetNode: c.target.node,
            targetPath: c.target.path
        }));

        /** @type {number} Total duration of the animation in seconds */
        this.duration = Math.max(...this.samplers.map((s) => s.duration));
    }

    /**
     * Updates the animation state at the given time.
     * Applies interpolated transform values to nodes and updates the node hierarchy.
     * @param {number} t - Current time in seconds
     * @param {Node[]} nodes - Array of all nodes in the model
     */
    update(t, nodes) {
        // Update each animation channel
        for (const channel of this.channels) {
            // Get interpolated value from sampler
            const value = channel.sampler.getValue(t);
            const node = nodes[channel.targetNode];

            // Apply value to appropriate transform component
            switch (channel.targetPath) {
                case "translation":
                    node.translation = value;
                    break;
                case "rotation":
                    node.rotation = value;
                    break;
                case "scale":
                    node.scale = value;
                    break;
            }
        }

        // Update world matrices starting from root nodes
        for (const node of nodes) {
            // Only process root nodes (nodes with no parents)
            if (node.children.length > 0 && !nodes.some((n) => n.children.includes(node))) {
                node.updateWorldMatrix();
            }
        }
    }
}

/**
 * Represents a skin (skeleton) in the GLTF model.
 * Handles skeletal animation data and joint transformations.
 */
class Skin {
    /**
     * Creates a new Skin from GLTF skin data.
     * @param {Object} gltf - The complete GLTF data object
     * @param {Object} skinData - The GLTF skin data
     * @param {number[]} skinData.joints - Array of node indices representing joints
     * @param {number} [skinData.inverseBindMatrices] - Accessor index for inverse bind matrices
     * @param {number} skinID - Unique identifier for this skin
     */
    constructor(gltf, skinData, skinID) {
        /** @type {number} Unique identifier for this skin */
        this.skinID = skinID;

        /** @type {number[]} Array of node indices representing joints in the skeleton */
        this.joints = skinData.joints;

        /**
         * @type {Float32Array[]} Array of inverse bind matrices for each joint
         * These transform vertices from model space to joint space
         */
        if (skinData.inverseBindMatrices !== undefined) {
            const data = GLBLoader.getAttributeData(skinData.inverseBindMatrices, gltf, gltf.binaryData);
            this.inverseBindMatrices = [];
            // Each matrix is 16 floats (4x4)
            for (let i = 0; i < data.length; i += 16) {
                const matrix = Matrix4.create();
                for (let j = 0; j < 16; j++) {
                    matrix[j] = data[i + j];
                }
                this.inverseBindMatrices.push(matrix);
            }
        } else {
            // Default to identity matrices if none provided
            this.inverseBindMatrices = this.joints.map(() => Matrix4.create());
        }

        /**
         * @type {Float32Array[]} Array of joint matrices for runtime transform updates
         * These store the final transforms used for vertex skinning
         */
        this.jointMatrices = new Array(this.joints.length);
        for (let i = 0; i < this.jointMatrices.length; i++) {
            this.jointMatrices[i] = Matrix4.create();
        }
    }

    /**
     * Updates joint matrices based on current node transforms.
     * Combines joint world matrices with inverse bind matrices to get final vertex transforms.
     * @param {Node[]} nodes - Array of all nodes in the model
     */
    update(nodes) {
        for (let i = 0; i < this.joints.length; i++) {
            const joint = nodes[this.joints[i]];
            const invBind = this.inverseBindMatrices[i];
            const jointMatrix = this.jointMatrices[i];

            // Final transform = joint's world transform * inverse bind matrix
            Matrix4.multiply(jointMatrix, joint.matrix, invBind);
        }
    }
}

class ModelAnimationController {
    constructor(model) {
        this.model = model;
        this.currentAnimation = null;
        this.currentTime = 0;
        this.isPlaying = false;
        this.isLooping = true;
        this.startTime = 0;

        // Create animation name map
        this.animationMap = new Map();
        this.model.animations.forEach((anim, index) => {
            if (anim.name) {
                this.animationMap.set(anim.name.toLowerCase(), index);
            }
        });
    }

    play(animation, shouldLoop = true) {
    let animationIndex;
    if (typeof animation === "string") {
        animationIndex = this.animationMap.get(animation.toLowerCase());
        if (animationIndex === undefined) {
            console.warn(`Animation "${animation}" not found`);
            return;
        }
    } else if (typeof animation === "number") {
        if (animation >= 0 && animation < this.model.animations.length) {
            animationIndex = animation;
        } else {
            console.warn(`Animation index ${animation} out of range`);
            return;
        }
    }

    // If the same animation is already playing, just update loop status
    if (this.currentAnimation === this.model.animations[animationIndex]) {
        this.isLooping = shouldLoop;
        return;
    }

    this.currentAnimation = this.model.animations[animationIndex];
    this.isPlaying = true;
    this.isLooping = shouldLoop;
    this.startTime = performance.now() / 1000;
    this.currentTime = 0;
}

    getAnimationNames() {
        return Array.from(this.animationMap.keys());
    }

    pause() {
        this.isPlaying = false;
    }

    resume() {
        if (this.currentAnimation) {
            this.isPlaying = true;
            this.startTime = performance.now() / 1000 - this.currentTime;
        }
    }

    stop() {
        this.isPlaying = false;
        this.currentTime = 0;
    }

    update() {
        if (!this.isPlaying || !this.currentAnimation) return;

        this.currentTime = performance.now() / 1000 - this.startTime;

        if (this.currentTime > this.currentAnimation.duration) {
            if (this.isLooping) {
                this.startTime = performance.now() / 1000;
                this.currentTime = 0;
            } else {
                this.isPlaying = false;
                return;
            }
        }

        this.currentAnimation.update(this.currentTime, this.model.nodes);
        if (this.model.skins.length > 0) {
            this.model.skins[0].update(this.model.nodes);
        }
    }
}