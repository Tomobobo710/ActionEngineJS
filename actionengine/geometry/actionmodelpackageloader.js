//actionengine/geometry/actionmodelpackageloader.js
/**
 * ActionModelPackageLoader - Reconstructs ActionModel3D from package data
 * Handles loading meshes, animations, textures from registry
 * Single shared logic for all ActionModelPackage instances
 *
 * LOADING MODEL - lazy, on demand:
 *   A generated ModelIndex.js does NOT load its meshes on page load. It only calls
 *   registerPackage(name, meshFileInfo, options, baseDir) to record a manifest (cheap - no
 *   fetches, no ActionModel3D built). The mesh/texture/animation sub-scripts are pulled in
 *   later, the first time something calls load(name) - e.g. the model viewer selecting that
 *   model. reconstruct() (which builds physics shapes via PhysicsBackend) therefore runs well
 *   after the Game constructor has chosen the physics backend, not during page load against
 *   whatever backend.js auto-resolved.
 */
class ActionModelPackageLoader {
    /**
     * name -> { meshFileInfo, options, baseDir }. Filled by registerPackage() at page load.
     * @type {Map<string, {meshFileInfo: Array, options: Object, baseDir: string}>}
     */
    static #manifests = new Map();

    /**
     * name -> in-flight Promise<ActionModel3D>. Dedupes concurrent load() calls for the same
     * package and is cleared once the load settles (success or failure).
     * @type {Map<string, Promise<Object>>}
     */
    static #loadPromises = new Map();

    /**
     * Record a package manifest. Called by a generated ModelIndex.js on page load. Does no work
     * beyond storing the manifest - the meshes load on the first load(modelName).
     * @param {string} modelName
     * @param {Array} meshFileInfo - [{path: "meshes/object_0.js", name: "object_0"}, ...]
     * @param {Object} [options] - {hasAnimations, hasTextures}
     * @param {string} [baseDir] - directory the ModelIndex.js lives in (mesh paths are relative to it)
     */
    static registerPackage(modelName, meshFileInfo, options = {}, baseDir = "") {
        if (typeof modelName !== "string" || !modelName.trim()) {
            throw new Error("ActionModelPackageLoader.registerPackage: modelName must be a non-empty string");
        }
        this.#manifests.set(modelName, {
            meshFileInfo: meshFileInfo || [],
            options: options || {},
            baseDir: baseDir || ""
        });
    }

    /**
     * Names of every registered package manifest (not necessarily loaded yet).
     * @returns {string[]}
     */
    static listPackageNames() {
        return Array.from(this.#manifests.keys());
    }

    /**
     * True if `name` is known - either a registered manifest or an already-reconstructed model.
     * @param {string} name
     * @returns {boolean}
     */
    static hasPackage(name) {
        return this.#manifests.has(name) || ModelRegistry.exists(name);
    }

    /**
     * Load a package on demand: chainload its mesh/texture/animation sub-scripts, then
     * reconstruct() the ActionModel3D and register it. Idempotent and concurrency-safe -
     * repeat calls (or overlapping calls) resolve to the same model without reloading.
     *
     * @param {string} modelName
     * @param {Function} [onProgress] - called with a fraction 0..1 as the package loads. Fires
     *   across the mesh-script fetches (the bulk of the wait) and once more after reconstruct().
     *   On a cache hit it is called once with 1. If two callers race, only the FIRST call's
     *   onProgress is driven (the second shares the in-flight promise); a racing caller that
     *   passed an onProgress gets it called once with 1 on resolve.
     * @returns {Promise<Object>} the reconstructed ActionModel3D
     */
    static async load(modelName, onProgress = null) {
        if (ModelRegistry.exists(modelName)) {
            if (onProgress) onProgress(1);
            return ModelRegistry.get(modelName);
        }
        if (this.#loadPromises.has(modelName)) {
            const p = this.#loadPromises.get(modelName);
            if (onProgress) p.then(() => onProgress(1), () => {});
            return p;
        }

        const manifest = this.#manifests.get(modelName);
        if (!manifest) {
            throw new Error(`ActionModelPackageLoader.load: no package registered as "${modelName}"`);
        }

        const promise = this.#loadManifest(modelName, manifest, onProgress);
        this.#loadPromises.set(modelName, promise);
        try {
            return await promise;
        } finally {
            this.#loadPromises.delete(modelName);
        }
    }

    /**
     * @private
     * @param {string} modelName
     * @param {{meshFileInfo: Array, options: Object, baseDir: string}} manifest
     * @param {Function} [onProgress]
     * @returns {Promise<Object>}
     */
    static async #loadManifest(modelName, manifest, onProgress) {
        const { meshFileInfo, options, baseDir } = manifest;
        const t0 = performance.now();

        // Progress budget: one unit per sub-script fetch, plus a lump for reconstruct(). The
        // fetches are serial and dominate wall time, so the bar crawls smoothly across them;
        // reconstruct() is a single synchronous call, so it shows as one jump near the end.
        const scriptUnits = meshFileInfo.length
            + (options.hasAnimations ? 1 : 0)
            + (options.hasTextures ? 1 : 0);
        const reconstructUnits = Math.max(1, Math.round(scriptUnits * 0.25));
        const totalUnits = scriptUnits + reconstructUnits;
        let doneUnits = 0;
        const report = () => { if (onProgress) onProgress(doneUnits / totalUnits); };

        report(); // 0

        // Chainload mesh sub-scripts (each registers its data into ModelRegistry via
        // registerModule), then optional animations/textures - same order the old generated
        // ModelIndex.js used.
        for (const info of meshFileInfo) {
            await this.#loadScript(baseDir + info.path);
            doneUnits++;
            report();
        }
        if (options.hasAnimations) {
            await this.#loadScript(baseDir + "animations.js");
            doneUnits++;
            report();
        }
        if (options.hasTextures) {
            await this.#loadScript(baseDir + "textures.js");
            doneUnits++;
            report();
        }

        const model = this.reconstruct(modelName, meshFileInfo, options);
        doneUnits += reconstructUnits;
        report(); // 1

        console.log(
            `ActionModelPackageLoader: lazy-loaded "${modelName}" in ${(performance.now() - t0).toFixed(0)}ms`
        );
        return model;
    }

    /**
     * Inject a <script> and resolve when it has loaded. Same manual-loader approach the old
     * generated bootstrap used; lives here now so ModelIndex.js can stay a pure manifest.
     * @private
     * @param {string} src
     * @returns {Promise<void>}
     */
    static #loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load: " + src));
            document.head.appendChild(script);
        });
    }

    /**
     * Reconstruct ActionModel3D from registered module data
     * @param {string} modelName - Model name to reconstruct and register
     * @param {Array} meshFileInfo - [{path: "meshes/object_0.js", name: "object_0"}, ...]
     * @param {Object} options - {hasAnimations, hasTextures}
     * @returns {ActionModel3D} Reconstructed model
     */
    static reconstruct(modelName, meshFileInfo, options = {}) {
        try {
            const hasAnimations = options.hasAnimations || false;
            const hasTextures = options.hasTextures || false;

            // Create ActionModel3D instance
            const model = new ActionModel3D();
            model.objects = [];

            // Get mesh modules from registry using provided names
            const meshes = [];
            meshFileInfo.forEach((info) => {
                const meshData = ModelRegistry.getModule(info.name);
                if (meshData) {
                    meshes.push(meshData);
                } else {
                    console.warn(`ActionModelPackageLoader: Mesh "${info.name}" not found in registry`);
                }
            });

            // Load mesh objects
            meshes.forEach((mesh, idx) => {
                if (!mesh) {
                    return;
                }
                
                const obj = new RenderableObject();
                obj.name = mesh.name;
                obj.triangles = mesh.triangles;

                // Apply materials, UV coordinates, normals, and tangents
                if (mesh.materials && mesh.triangleMaterials) {
                    mesh.triangles.forEach((tri, triIdx) => {
                        const matId = mesh.triangleMaterials[triIdx];
                        if (matId >= 0 && matId < mesh.materials.length) {
                            const matData = mesh.materials[matId];
                            const materialObj = {};
                            const otherProps = {};
                            
                            Object.entries(matData).forEach(([key, val]) => {
                                if (['useTexture', 'textureIndex', 'normalMapIndex', 'metallicRoughnessMapIndex', 'emissiveMapIndex'].includes(key)) {
                                    materialObj[key] = val;
                                } else {
                                    otherProps[key] = val;
                                }
                            });
                            
                            if (Object.keys(materialObj).length > 0) {
                                tri.material = materialObj;
                            }
                            Object.assign(tri, otherProps);
                        }
                        
                        if (mesh.uvs && mesh.uvs[triIdx]) {
                            tri.uvs = mesh.uvs[triIdx];
                        }
                        
                        if (mesh.vertexNormals && mesh.vertexNormals instanceof Float32Array) {
                            const offset = triIdx * 9;
                            tri.vertexNormals = [
                                new Vector3(mesh.vertexNormals[offset + 0], mesh.vertexNormals[offset + 1], mesh.vertexNormals[offset + 2]),
                                new Vector3(mesh.vertexNormals[offset + 3], mesh.vertexNormals[offset + 4], mesh.vertexNormals[offset + 5]),
                                new Vector3(mesh.vertexNormals[offset + 6], mesh.vertexNormals[offset + 7], mesh.vertexNormals[offset + 8])
                            ];
                        }
                        
                        if (mesh.tangents && mesh.tangents instanceof Float32Array) {
                            const offset = triIdx * 9;
                            tri.tangents = [
                                new Vector3(mesh.tangents[offset + 0], mesh.tangents[offset + 1], mesh.tangents[offset + 2]),
                                new Vector3(mesh.tangents[offset + 3], mesh.tangents[offset + 4], mesh.tangents[offset + 5]),
                                new Vector3(mesh.tangents[offset + 6], mesh.tangents[offset + 7], mesh.tangents[offset + 8])
                            ];
                        }
                        
                        if (mesh.jointData && mesh.jointDataTriangleIndices) {
                            const dataIdx = mesh.jointDataTriangleIndices.indexOf(triIdx);
                            if (dataIdx !== -1) {
                                const offset = dataIdx * 12;
                                tri.jointData = [
                                    [mesh.jointData[offset + 0], mesh.jointData[offset + 1], mesh.jointData[offset + 2], mesh.jointData[offset + 3]],
                                    [mesh.jointData[offset + 4], mesh.jointData[offset + 5], mesh.jointData[offset + 6], mesh.jointData[offset + 7]],
                                    [mesh.jointData[offset + 8], mesh.jointData[offset + 9], mesh.jointData[offset + 10], mesh.jointData[offset + 11]]
                                ];
                            }
                        }
                        
                        if (mesh.weightData && mesh.weightDataTriangleIndices) {
                            const dataIdx = mesh.weightDataTriangleIndices.indexOf(triIdx);
                            if (dataIdx !== -1) {
                                const offset = dataIdx * 12;
                                tri.weightData = [
                                    [mesh.weightData[offset + 0], mesh.weightData[offset + 1], mesh.weightData[offset + 2], mesh.weightData[offset + 3]],
                                    [mesh.weightData[offset + 4], mesh.weightData[offset + 5], mesh.weightData[offset + 6], mesh.weightData[offset + 7]],
                                    [mesh.weightData[offset + 8], mesh.weightData[offset + 9], mesh.weightData[offset + 10], mesh.weightData[offset + 11]]
                                ];
                            }
                        }
                    });
                }

                if (mesh.transform) {
                    obj.transform.position = new Vector3(
                        mesh.transform.position.x,
                        mesh.transform.position.y,
                        mesh.transform.position.z
                    );
                    obj.transform.rotation = new Quaternion(
                        mesh.transform.rotation.x,
                        mesh.transform.rotation.y,
                        mesh.transform.rotation.z,
                        mesh.transform.rotation.w
                    );
                    obj.transform.scale = new Vector3(
                        mesh.transform.scale.x,
                        mesh.transform.scale.y,
                        mesh.transform.scale.z
                    );
                }

                // Create physics for this mesh object
                if (mesh.triangles && mesh.triangles.length > 0) {
                    // Extract vertices from triangles (in local space)
                    const vertices = [];
                    const indices = [];
                    const vertexMap = new Map();
                    let vertexIndex = 0;

                    for (const tri of mesh.triangles) {
                        const triIndices = [];
                        for (const vertex of tri.vertices) {
                            const key = `${vertex.x},${vertex.y},${vertex.z}`;
                            if (!vertexMap.has(key)) {
                                vertices.push(vertex);
                                vertexMap.set(key, vertexIndex);
                                vertexIndex++;
                            }
                            triIndices.push(vertexMap.get(key));
                        }
                        indices.push(...triIndices);
                    }

                    // Transform vertices to world space to match GLBLoader behavior
                    const worldVertices = PhysicsShapeBuilder3D.transformVerticesToWorldSpace(
                        vertices.flatMap(v => [v.x, v.y, v.z]),
                        obj.transform.position,
                        obj.transform.rotation,
                        obj.transform.scale
                    );

                    // Create physics shape
                    const physicsData = PhysicsShapeBuilder3D.createMeshShape(worldVertices, indices, 0);
                    if (physicsData) {
                        physicsData.debugVertices = worldVertices;
                        physicsData.debugIndices = indices;
                        obj.shape = physicsData.shape;
                        obj.body = physicsData.body;
                        obj.physicsData = physicsData;
                        
                        // Set physics body position to world origin since vertices are already in world space
                        obj.body.position.set(0, 0, 0);
                        obj.body.rotation.set(0, 0, 0, 1);
                    }
                }

                model.objects.push(obj);
            });

            // Create compound physics from all mesh physics shapes
            const physicsShapes = [];
            const allDebugVertices = [];
            const allDebugIndices = [];
            let debugIndexOffset = 0;

            for (const obj of model.objects) {
                if (obj.physicsData && obj.physicsData.shape) {
                    physicsShapes.push(obj.physicsData.shape);
                    if (obj.physicsData.debugVertices) {
                        allDebugVertices.push(...obj.physicsData.debugVertices);
                        for (const idx of obj.physicsData.debugIndices) {
                            allDebugIndices.push(idx + debugIndexOffset);
                        }
                        debugIndexOffset += obj.physicsData.debugVertices.length;
                    }
                }
            }

            if (physicsShapes.length > 0) {
                model.compoundPhysicsData = PhysicsShapeBuilder3D.createCompoundPhysics(
                    physicsShapes,
                    allDebugVertices,
                    allDebugIndices
                );
            }

            // Load animations if present
            if (hasAnimations) {
                const animationData = ModelRegistry.getModule('animations');
                if (animationData && animationData.length > 0) {
                    model.animations = animationData.map(animData => {
                        const anim = {
                            name: animData.name,
                            duration: animData.duration,
                            samplers: animData.samplers.map(sampData => ({
                                times: new Float32Array(sampData.inputTimes),
                                values: new Float32Array(sampData.outputValues.flat()),
                                interpolation: sampData.interpolation,
                                duration: Math.max(...sampData.inputTimes),
                                currentIndex: 0,
                                loopOffset: 0
                            })),
                            channels: animData.channels.map(chanData => ({
                                sampler: animData.samplers[chanData.sampler],
                                targetNode: chanData.nodeIndex,
                                targetPath: chanData.path
                            }))
                        };
                        return anim;
                    });
                }
            }

            // Load textures if present
            if (hasTextures) {
                const textureData = ModelRegistry.getModule('textures');
                if (textureData && textureData.length > 0) {
                    const decodedTextures = [];
                    const decodedMetadata = [];

                    textureData.forEach((textureInfo, idx) => {
                        try {
                            const dataUrl = textureInfo.imageData;
                            const parts = dataUrl.split(',');
                            if (parts.length !== 2) {
                                console.warn(`Texture ${idx}: Invalid data URL format`);
                                return;
                            }
                            
                            const base64Str = parts[1];
                            const binaryString = atob(base64Str);
                            const bytes = new Uint8Array(binaryString.length);
                            for (let i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            
                            decodedTextures.push(bytes);
                            decodedMetadata.push({
                                name: textureInfo.name,
                                mimeType: textureInfo.mimeType
                            });
                        } catch (error) {
                            console.error(`Failed to decode texture ${idx}: ${error.message}`);
                        }
                    });

                    model.textures = decodedTextures;
                    model.textureMetadata = decodedMetadata;
                }
            }

            // Register with ModelRegistry
            ModelRegistry.register(modelName, model);
            console.log(`ActionModelPackageLoader: Loaded ${modelName} with ${model.objects.length} objects`);

            return model;
        } catch (error) {
            console.error(`ActionModelPackageLoader: Failed to reconstruct ${modelName}`, error);
            throw error;
        }
    }


}
