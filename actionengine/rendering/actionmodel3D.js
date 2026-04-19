//actionengine/rendering/actionmodel3D.js
/**
 * ActionModel3D - Container for GLB models with object hierarchy preservation
 *
 * Structure:
 * - objects: RenderableObject[] - Each mesh node becomes a RenderableObject
 * - nodes: Node[] - Full GLTF node hierarchy (for export reconstruction)
 * - hierarchy info to support nested/flat structures
 * - textures and animation data
 *
 * Design: Preserves complete GLB structure in memory for lossless roundtrip export
 */
class ActionModel3D {
    constructor() {
        // Node hierarchy (from GLTF)
        this.nodes = []; // All nodes with full properties
        this.rootNodes = []; // Top-level node indices
        this.nodeMap = {}; // Look up nodes by name

        // Renderable objects (one per mesh node)
        this.objects = []; // RenderableObject[] - one for each mesh in the GLB
        this.objectToNodeIndex = {}; // Map object index to its node index (for hierarchy reconstruction)

        // Compound physics (single body for entire model)
        this.compoundPhysicsData = null; // { shape, body, debugVertices, debugIndices }
        this.compoundPhysicsObject = null; // RenderableObject wrapper for compound physics

        // Mesh and geometry data
        this.meshes = []; // Complete mesh data from GLB
        this.originalTriangles = []; // Initial triangle geometry (for reference)

        // Texture data
        this.textures = []; // Array of texture image data
        this.textureMetadata = []; // Array of texture metadata (name, mimeType)
        this._textureSet = null; // TextureSet instance (created automatically when textures load)
        this._textureSetLoading = false; // Flag to prevent multiple simultaneous loads

        // Animation and skeletal data
        this.animations = []; // Animation data from GLB
        this.skins = []; // Skeleton definitions
        this.jointToSkinIndex = {}; // Which skin each joint belongs to
        this.nodeToSkinIndex = {}; // Which skin each node uses
        this.inverseBindMatrices = {}; // Joint index -> its starting pose matrix

        // Per-vertex skinning data
        this.vertexJoints = []; // Which joints affect each vertex
        this.vertexWeights = []; // How much each joint affects each vertex

        // Cache for transformed objects (computed once, reused)
        this._transformedObjectsCache = null; // Array of RenderableObjects
        this._flattenedObjectCache = null; // Single flattened RenderableObject
    }

    /**
     * Add a renderable object for a mesh node
     * @param {string} name - Object name (from GLTF node)
     * @param {Triangle[]} triangles - Geometry for this object
     * @param {number} nodeIndex - Index of the Node this came from
     * @param {Vector3} translation - Local translation
     * @param {Quaternion} rotation - Local rotation
     * @param {Vector3} scale - Local scale
     * @param {Object} physicsData - Optional physics data { shape, body }
     * @returns {RenderableObject} The created renderable object
     */
    addObject(name, triangles, nodeIndex, translation, rotation, scale, physicsData = null) {
        const obj = new RenderableObject();
        obj.name = name;
        obj.triangles = triangles;
        obj.isStatic = true; // Mark as static for renderer optimization

        // Set transform from GLTF node data
        obj.transform.position = translation.clone();
        obj.transform.rotation = new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
        obj.transform.scale = scale.clone();

        // Attach physics data directly to the object if provided
        if (physicsData) {
            obj.shape = physicsData.shape;
            obj.body = physicsData.body;
            // Store the full physics data object for debug visualization
            obj.physicsData = physicsData;
            // Set the physics body position and rotation to match the object's world transform
            obj.body.position.set(translation.x, translation.y, translation.z);
            obj.body.rotation.x = rotation.x;
            obj.body.rotation.y = rotation.y;
            obj.body.rotation.z = rotation.z;
            obj.body.rotation.w = rotation.w;
        }



        const objIndex = this.objects.length;
        this.objects.push(obj);
        this.objectToNodeIndex[objIndex] = nodeIndex;

        return obj;
    }

    /**
     * Create a RenderableObject wrapper for compound physics data
     * @returns {RenderableObject|null} RenderableObject with compound physics attached, or null if no compound data
     */
    getCompoundPhysicsObject() {
        if (!this.compoundPhysicsData) {
            return null;
        }

        // Create wrapper only once
        if (!this.compoundPhysicsObject) {
            const wrapper = new RenderableObject();
            wrapper.name = "CompoundEnvironment";
            wrapper.body = this.compoundPhysicsData.body;
            wrapper.shape = this.compoundPhysicsData.shape;
            wrapper.physicsData = this.compoundPhysicsData;
            this.compoundPhysicsObject = wrapper;
        }

        return this.compoundPhysicsObject;
    }

    /**
     * Step 1: Iterate all objects and their triangles
     * @returns {Array} Array of {object, triangles} pairs
     */
    getAllObjectTrianglePairs() {
        const pairs = [];
        for (const obj of this.objects) {
            pairs.push({
                object: obj,
                triangles: obj.triangles,
                transform: obj.transform
            });
        }
        return pairs;
    }

    /**
     * Step 2: Transform vertices from local space to world space
     * @private
     */
    _transformTriangle(triangle, transform) {
        const v1 = this._transformVertex(triangle.vertices[0], transform);
        const v2 = this._transformVertex(triangle.vertices[1], transform);
        const v3 = this._transformVertex(triangle.vertices[2], transform);
        return { v1, v2, v3 };
    }

    /**
     * Step 3: Copy all triangle properties
     * @private
     */
    _copyTriangleProperties(fromTriangle, toTriangle) {
        toTriangle.alpha = fromTriangle.alpha;
        toTriangle.metallic = fromTriangle.metallic;
        toTriangle.roughness = fromTriangle.roughness;
        toTriangle.emissive = fromTriangle.emissive;
        toTriangle.material = fromTriangle.material;
        toTriangle.uvs = fromTriangle.uvs;
        toTriangle.texture = fromTriangle.texture;
        toTriangle.tangents = fromTriangle.tangents;
        toTriangle.vertexNormals = fromTriangle.vertexNormals;
        toTriangle.jointData = fromTriangle.jointData;
        toTriangle.weightData = fromTriangle.weightData;
    }

    /**
     * Transform triangles for a single object (keeping them in that object)
     * @private
     * @param {RenderableObject} object - Object to transform
     * @returns {Triangle[]} New triangle array with vertices transformed
     */
    _transformObjectTriangles(object) {
        const transformedTriangles = [];

        for (const tri of object.triangles) {
            // Step 2: Transform vertices
            const { v1, v2, v3 } = this._transformTriangle(tri, object.transform);

            // Create new triangle with transformed vertices
            const transformedTri = new Triangle(v1, v2, v3, tri.color);

            // Step 3: Copy all properties
            this._copyTriangleProperties(tri, transformedTri);

            transformedTriangles.push(transformedTri);
        }

        return transformedTriangles;
    }

    /**
     * Get all objects with their triangles transformed
     * Always returns array of RenderableObjects (individual or flattened to one)
     * Computed once and cached for performance
     * @param {boolean} flatten - If true, returns array with single combined object. If false, returns array of individual objects. Default: false
     * @returns {RenderableObject[]} Array of RenderableObjects (one or more depending on flatten)
     */
    /**
     * Load and attach TextureSet for this model's textures to all RenderableObjects
     * @private
     */
    async _loadAndAttachTextureSet(gl) {
        if (!this.textures || this.textures.length === 0) {
            return null;
        }

        // Create TextureSet if not already done
        if (!this._textureSet) {
            this._textureSet = new TextureSet(gl);
            await this._textureSet.loadFromModel(this);

            // Attach to all existing renderable objects
            if (this._transformedObjectsCache) {
                for (const obj of this._transformedObjectsCache) {
                    obj._textureSet = this._textureSet;
                }
            }
            if (this._flattenedObjectCache) {
                for (const obj of this._flattenedObjectCache) {
                    obj._textureSet = this._textureSet;
                }
            }
        }

        return this._textureSet;
    }

    getTransformedObjects(flatten = false, gl = null) {
        // Auto-load TextureSet if we have a GL context and textures but no TextureSet yet
        // This makes texture loading completely transparent (lazy-loaded on first access)
        if (gl && this.textures.length > 0 && !this._textureSet && !this._textureSetLoading) {
            this._textureSetLoading = true;
            this._loadAndAttachTextureSet(gl).catch((e) => console.error("Failed to auto-load TextureSet:", e));
        }

        // Return appropriate cached version
        if (flatten) {
            if (this._flattenedObjectCache) {
                return this._flattenedObjectCache;
            }
        } else {
            if (this._transformedObjectsCache) {
                return this._transformedObjectsCache;
            }
        }

        // Build individual transformed objects if not cached
        if (!this._transformedObjectsCache) {
            const transformedObjects = [];

            for (const obj of this.objects) {
                const transformedObj = new RenderableObject();
                transformedObj.name = obj.name;
                transformedObj.isStatic = obj.isStatic;

                // Transform this object's triangles (done once)
                transformedObj.triangles = this._transformObjectTriangles(obj);

                // Identity transform (triangles already in world space)
                transformedObj.transform.position = new Vector3(0, 0, 0);
                transformedObj.transform.rotation = new Quaternion(0, 0, 0, 1);
                transformedObj.transform.scale = new Vector3(1, 1, 1);
                transformedObjects.push(transformedObj);
            }

            this._transformedObjectsCache = transformedObjects;
        }

        // Return flattened or individual based on parameter
        if (flatten) {
            const flattenedObj = new RenderableObject();
            flattenedObj.name = "flattened";
            flattenedObj.isStatic = true;

            const allTriangles = [];
            for (const obj of this._transformedObjectsCache) {
                allTriangles.push(...obj.triangles);
            }

            flattenedObj.triangles = allTriangles;
            flattenedObj.transform.position = new Vector3(0, 0, 0);
            flattenedObj.transform.rotation = new Quaternion(0, 0, 0, 1);
            flattenedObj.transform.scale = new Vector3(1, 1, 1);

            this._flattenedObjectCache = [flattenedObj]; // Return as array with one element
            return this._flattenedObjectCache;
        }

        return this._transformedObjectsCache;
    }

    /**
     * Get all triangles flattened WITHOUT transforms (local space)
     * Used for characters and objects that manage their own transforms
     * @returns {Triangle[]} All triangles from all objects in local space
     */
    getAllTrianglesLocal() {
        const allTriangles = [];
        for (const obj of this.objects) {
            allTriangles.push(...obj.triangles);
        }
        return allTriangles;
    }

    /**
     * Get all triangles flattened with transforms applied
     * Creates transformed copies so each instance appears in the correct position
     * @returns {Triangle[]} All triangles from all objects with transforms applied
     */
    getAllTriangles() {
        const allTriangles = [];
        const pairs = this.getAllObjectTrianglePairs();

        for (const { object, triangles, transform } of pairs) {
            for (const tri of triangles) {
                // Step 2: Transform vertices
                const { v1, v2, v3 } = this._transformTriangle(tri, transform);

                // Create new triangle with transformed vertices
                const transformedTri = new Triangle(v1, v2, v3, tri.color);

                // Step 3: Copy all properties
                this._copyTriangleProperties(tri, transformedTri);

                allTriangles.push(transformedTri);
            }
        }
        return allTriangles;
    }

    /**
     * Transform a vertex by an object's transform
     * @private
     */
    _transformVertex(vertex, transform) {
        // Apply scale
        let x = vertex.x * transform.scale.x;
        let y = vertex.y * transform.scale.y;
        let z = vertex.z * transform.scale.z;

        // Apply rotation (quaternion)
        const quat = transform.rotation;
        const ix = quat.w * x + quat.y * z - quat.z * y;
        const iy = quat.w * y + quat.z * x - quat.x * z;
        const iz = quat.w * z + quat.x * y - quat.y * x;
        const iw = -quat.x * x - quat.y * y - quat.z * z;

        x = ix * quat.w + iw * -quat.x + iy * -quat.z - iz * -quat.y;
        y = iy * quat.w + iw * -quat.y + iz * -quat.x - ix * -quat.z;
        z = iz * quat.w + iw * -quat.z + ix * -quat.y - iy * -quat.x;

        // Apply translation
        return new Vector3(x + transform.position.x, y + transform.position.y, z + transform.position.z);
    }
}
