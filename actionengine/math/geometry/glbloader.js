class GLBLoader {
    constructor() {
        this.nodes = [];
        this.meshes = [];
        this.skins = [];
        this.animations = [];
        this.triangles = [];
    }

    static loadModel(input) {
        if (typeof input === "string") {
            return GLBLoader.loadFromBase64(input);
        } else if (input instanceof ArrayBuffer) {
            return GLBLoader.loadFromArrayBuffer(input);
        } else {
            throw new Error("Unsupported input format. Please provide a base64 string or ArrayBuffer.");
        }
    }

    static loadFromBase64(base64String) {
        const binaryString = atob(base64String);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return GLBLoader.loadFromArrayBuffer(bytes.buffer);
    }

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
                    model.nodes[i].children = nodeData.children.map(childIndex => model.nodes[childIndex]);
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
            model.animations = gltf.animations.map(anim => new Animation(gltf, anim));
        }

        return model;
    }

    static parseGLB(arrayBuffer) {
        const dataView = new DataView(arrayBuffer);
        const magic = dataView.getUint32(0, true);
        if (magic !== 0x46546C67) {
            throw new Error('Invalid GLB file');
        }

        const jsonLength = dataView.getUint32(12, true);
        const jsonText = new TextDecoder().decode(
            new Uint8Array(arrayBuffer, 20, jsonLength)
        );
        const json = JSON.parse(jsonText);
        const binaryData = arrayBuffer.slice(20 + jsonLength + 8);

        return { gltf: json, binaryData };
    }

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
                    joints: primitive.attributes.JOINTS_0 ? 
                        GLBLoader.getAttributeData(primitive.attributes.JOINTS_0, gltf, binaryData) : null,
                    weights: primitive.attributes.WEIGHTS_0 ? 
                        GLBLoader.getAttributeData(primitive.attributes.WEIGHTS_0, gltf, binaryData) : null,
                    material: primitive.material !== undefined ? 
                        GLBLoader.getMaterialColor(gltf.materials[primitive.material]) : null
                };

                GLBLoader.addPrimitiveTriangles(model, primData);
                meshData.primitives.push(primData);
            }

            model.meshes.push(meshData);
        }
    }

    static getMaterialColor(material) {
        if (material?.pbrMetallicRoughness?.baseColorFactor) {
            const [r, g, b] = material.pbrMetallicRoughness.baseColorFactor;
            return `#${Math.floor(r * 255).toString(16).padStart(2, "0")}${Math.floor(g * 255).toString(16).padStart(2, "0")}${Math.floor(b * 255).toString(16).padStart(2, "0")}`;
        }
        return null;
    }

    static getAttributeData(accessorIndex, gltf, binaryData) {
    const accessor = gltf.accessors[accessorIndex];
    const bufferView = gltf.bufferViews[accessor.bufferView];
    const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
    const count = accessor.count;
    const components = {
        'SCALAR': 1,
        'VEC2': 2,
        'VEC3': 3,
        'VEC4': 4,
        'MAT4': 16
    }[accessor.type];

    // Choose array type based on component type
    let ArrayType = Float32Array;
    if (accessor.componentType === 5121) { // UNSIGNED_BYTE
        ArrayType = Uint8Array;
    } else if (accessor.componentType === 5123) { // UNSIGNED_SHORT
        ArrayType = Uint16Array;
    } else if (accessor.componentType === 5125) { // UNSIGNED_INT
        ArrayType = Uint32Array;
    }

    return new ArrayType(
        binaryData.slice(byteOffset, byteOffset + count * components * ArrayType.BYTES_PER_ELEMENT)
    );
}

    static getIndexData(accessorIndex, gltf, binaryData) {
        if (accessorIndex === undefined) return null;

        const accessor = gltf.accessors[accessorIndex];
        const bufferView = gltf.bufferViews[accessor.bufferView];
        const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);

        return accessor.componentType === 5125 ?
            new Uint32Array(binaryData, byteOffset, accessor.count) :
            new Uint16Array(binaryData, byteOffset, accessor.count);
    }

    static addPrimitiveTriangles(model, primitive) {
    const { positions, indices, joints, weights, material } = primitive;

    // First create all vertices
    const vertexData = [];
    for (let i = 0; i < positions.length / 3; i++) {
        vertexData.push({
            position: new Vector3(
                positions[i * 3],
                positions[i * 3 + 1], 
                positions[i * 3 + 2]
            ),
            jointIndices: joints ? [
                joints[i * 4],
                joints[i * 4 + 1],
                joints[i * 4 + 2],
                joints[i * 4 + 3]
            ] : null,
            weights: weights ? [
                weights[i * 4],
                weights[i * 4 + 1],
                weights[i * 4 + 2],
                weights[i * 4 + 3]
            ] : null
        });
    }

    // Then create triangles using indices
    for (let i = 0; i < indices.length; i += 3) {
        const vertices = [
            vertexData[indices[i]],
            vertexData[indices[i + 1]],
            vertexData[indices[i + 2]]
        ];

        const triangle = new Triangle(
            vertices[0].position,
            vertices[1].position,
            vertices[2].position,
            material || "#FF0000"
        );

        if (joints && weights) {
            triangle.jointData = vertices.map(v => v.jointIndices);
            triangle.weightData = vertices.map(v => v.weights);
        }

        model.triangles.push(triangle);
    }
}
}

class Node {
    constructor(nodeData, nodeID) {
        this.nodeID = nodeID;
        this.name = nodeData.name || `node_${nodeID}`;
        
        // Core node properties
        this.children = nodeData.children || [];  // Will hold node indices initially
        this.mesh = nodeData.mesh !== undefined ? nodeData.mesh : null;
        this.skin = nodeData.skin !== undefined ? nodeData.skin : null;

        // Transform components
        this.translation = new Vector3(
            nodeData.translation ? nodeData.translation[0] : 0,
            nodeData.translation ? nodeData.translation[1] : 0,
            nodeData.translation ? nodeData.translation[2] : 0
        );

        this.rotation = new Quaternion(
            nodeData.rotation ? nodeData.rotation[0] : 0,
            nodeData.rotation ? nodeData.rotation[1] : 0,
            nodeData.rotation ? nodeData.rotation[2] : 0,
            nodeData.rotation ? nodeData.rotation[3] : 1
        );

        this.scale = new Vector3(
            nodeData.scale ? nodeData.scale[0] : 1,
            nodeData.scale ? nodeData.scale[1] : 1,
            nodeData.scale ? nodeData.scale[2] : 1
        );

        // Final transform matrix
        this.matrix = Matrix4.create();
        this.updateMatrix();
    }
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
    updateMatrix() {
        // Create matrix from TRS components like the GitHub version
        const tempMatrix = Matrix4.create();
        Matrix4.fromRotationTranslation(tempMatrix, this.rotation, this.translation);
        Matrix4.scale(this.matrix, tempMatrix, this.scale.toArray());
    }

    // For traversing the node hierarchy
    traverse(parent, executeFunc) {
        executeFunc(this, parent);
        for (const childIndex of this.children) {
            nodes[childIndex].traverse(this, executeFunc);
        }
    }
}

class AnimationSampler {
    constructor(gltf, samplerData) {
        this.times = GLBLoader.getAttributeData(samplerData.input, gltf, gltf.binaryData);
        this.values = GLBLoader.getAttributeData(samplerData.output, gltf, gltf.binaryData);
        this.interpolation = samplerData.interpolation || 'LINEAR';
        
        this.currentIndex = 0;
        this.duration = this.times[this.times.length - 1];
        this.loopOffset = 0;
    }

    getValue(t) {
        // Handle looping
        t = t % this.duration;
        if (t < this.times[this.currentIndex]) {
            // Reset for new loop
            this.currentIndex = 0;
            this.loopOffset = 0;
        }

        // Find current keyframe
        while (this.currentIndex < this.times.length - 1 && 
               t >= this.times[this.currentIndex + 1]) {
            this.currentIndex++;
        }

        // Loop back to start if needed
        if (this.currentIndex >= this.times.length - 1) {
            this.currentIndex = 0;
        }

        // Get keyframe data
        const t0 = this.times[this.currentIndex];
        const t1 = this.times[this.currentIndex + 1];
        const progress = (t - t0) / (t1 - t0);

        const i0 = this.currentIndex * this.values.length / this.times.length;
        const i1 = i0 + this.values.length / this.times.length;

        // Handle different types of transform data
        if (this.values.length / this.times.length === 3) {  // translation or scale
            return new Vector3(
                this.lerp(this.values[i0], this.values[i1], progress),
                this.lerp(this.values[i0 + 1], this.values[i1 + 1], progress),
                this.lerp(this.values[i0 + 2], this.values[i1 + 2], progress)
            );
        } else {  // rotation (quaternion)
            const start = new Quaternion(
                this.values[i0], this.values[i0 + 1],
                this.values[i0 + 2], this.values[i0 + 3]
            );
            const end = new Quaternion(
                this.values[i1], this.values[i1 + 1],
                this.values[i1 + 2], this.values[i1 + 3]
            );
            return start.slerp(end, progress);
        }
    }

    lerp(a, b, t) {
        return a + (b - a) * t;
    }
}
class Animation {
    constructor(gltf, animData) {
        this.name = animData.name || 'unnamed';
        
        // Create samplers for each animation component
        this.samplers = animData.samplers.map(s => new AnimationSampler(gltf, s));
        
        // Connect samplers to target nodes and properties
        this.channels = animData.channels.map(c => ({
            sampler: this.samplers[c.sampler],
            targetNode: c.target.node,
            targetPath: c.target.path
        }));

        // Track total animation duration
        this.duration = Math.max(...this.samplers.map(s => s.duration));
    }

    update(t, nodes) {
        for (const channel of this.channels) {
            const value = channel.sampler.getValue(t);
            const node = nodes[channel.targetNode];

            switch(channel.targetPath) {
                case 'translation':
                    node.translation = value;
                    break;
                case 'rotation':
                    node.rotation = value;
                    break;
                case 'scale':
                    node.scale = value;
                    break;
            }
        }

        // After updating all nodes, update world matrices starting from root nodes
        for (const node of nodes) {
            // Only update from root nodes (nodes with no parents)
            if (node.children.length > 0 && !nodes.some(n => n.children.includes(node))) {
                node.updateWorldMatrix();
            }
        }
    }
}

class Skin {
    constructor(gltf, skinData, skinID) {
        this.skinID = skinID;
        this.joints = skinData.joints;  // Array of node indices that are joints
        
        // Get inverse bind matrices
        if (skinData.inverseBindMatrices !== undefined) {
            const data = GLBLoader.getAttributeData(
                skinData.inverseBindMatrices, 
                gltf, 
                gltf.binaryData
            );
            
            this.inverseBindMatrices = [];
            for (let i = 0; i < data.length; i += 16) {
                const matrix = Matrix4.create();
                for (let j = 0; j < 16; j++) {
                    matrix[j] = data[i + j];
                }
                this.inverseBindMatrices.push(matrix);
            }
        } else {
            // If no inverse bind matrices provided, use identity matrices
            this.inverseBindMatrices = this.joints.map(() => Matrix4.create());
        }

        // Create joint matrices for runtime transform updates
        this.jointMatrices = new Array(this.joints.length);
        for (let i = 0; i < this.jointMatrices.length; i++) {
            this.jointMatrices[i] = Matrix4.create();
        }
    }

    update(nodes) {
        // Calculate final transform for each joint
        for (let i = 0; i < this.joints.length; i++) {
            const joint = nodes[this.joints[i]];
            const invBind = this.inverseBindMatrices[i];
            const jointMatrix = this.jointMatrices[i];
            
            // Final joint transform = joint.matrix * inverseBindMatrix
            Matrix4.multiply(jointMatrix, joint.matrix, invBind);
        }
    }
}