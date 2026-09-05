//actionengine/rendering/renderers/actionrenderer3D/objectrenderer3D.js
class ObjectRenderer3D {
    /**
     * Merge duplicate vertex records at buffer-build time so the GPU gets indexed geometry instead
     * of the one-vertex-per-triangle-corner expansion this renderer used to upload unconditionally.
     * See the big comment in registerStaticMesh().
     *
     * Measured on the FPS single-player scene: 95,148 -> 48,254 vertex records (1.97x), verified
     * pixel-equivalent against the unmerged path (the only diff was the live fps counter and
     * in-flight physics between captures).
     *
     * NOTE the 1.97x: earlier estimates of ~6x came from hashing position+normal+colour only. The
     * real key must include tangent, uv, alpha, texture/material indices and bone indices+weights —
     * everything the shader reads per vertex — and those splits cost most of the theoretical win.
     *
     * Set to false to fall back to the original unmerged upload. Toggle it BEFORE meshes are baked;
     * meshes are cached on first sight and only re-baked when their triangle array reference
     * changes.
     *
     * Affects registerStaticMesh() only. updateStaticMesh() (the geometry-swap path) does NOT merge:
     * it writes with bufferSubData into buffers sized by the original bake, so a merged mesh is
     * fully rebuilt there instead (see the guard at the top of that method).
     */
    static MERGE_VERTICES = true;

    constructor(renderer, gl, programManager, lightManager) {
        this.renderer = renderer;
        this.gl = gl;
        this.programManager = programManager;
        this.lightManager = lightManager;

        this.indexType = this.gl.UNSIGNED_INT;

        // UBO manager for animated objects
        this.uboManager = new UniformBufferManager(gl);

        // Cache for pre-computed uniform values
        this._uniformCache = {
            frame: -1,
            shaderProgram: null,
            camera: null,
            lightConfig: null,
            normalMapStrength: 1.0,
            matrices: {
                projection: Matrix4.create(),
                view: Matrix4.create(),
                model: Matrix4.create(),
                lightSpace: null
            }
        };

        this.stats = {
            objectsTotal: 0,
            objectsCulled: 0,
            uniformSetCount: 0
        };

        this._scratchVec3 = new Float32Array(3);
        this._scratchVec4 = new Float32Array(4);

        // Persistent geometry library (FAST PATH ONLY)
        this._meshLibrary = new Map();
        this._drawQueue = [];

        // Map triangle arrays to meshIds for automatic deduplication
        this._trianglesMap = new WeakMap(); // triangles array -> meshId
        this._meshIdCounter = 0;
        this._lastTriangles = new Map(); // meshId -> last triangle reference
    }

    /**
     * Get or assign a meshId based on triangle array reference
     * Automatically deduplicates identical triangle arrays
     * For objects with _stableMeshId (animated characters), uses that instead
     */
    getMeshIdForTriangles(triangles, stableMeshId = null) {
        if (!triangles) return null;

        // Use stable ID if provided (for animated objects like characters)
        if (stableMeshId) {
            return stableMeshId;
        }

        if (!this._trianglesMap.has(triangles)) {
            // First time seeing this triangle array, assign it a meshId
            const meshId = `mesh_${this._meshIdCounter++}`;
            this._trianglesMap.set(triangles, meshId);
            this._lastTriangles.set(meshId, triangles);
        }
        return this._trianglesMap.get(triangles);
    }

    queue(object, camera, currentTime) {
        if (!object) return;

        if (!this._frameInitialized) {
            this.stats.objectsTotal = 0;
            this.stats.objectsCulled = 0;
            this.stats.uniformSetCount = 0;

            this._drawQueue = [];
            this._frameInitialized = true;
            this._currentFrameTime = performance.now();
            this._camera = camera;

            if (!this._textureCache) this._textureCache = new Map();
            this._frameCount = (this._frameCount || 0) + 1;
        }

        const triangles = object.triangles;
        if (!triangles || triangles.length === 0) return;

        // Get meshId based on triangle array reference (automatic deduplication)
        // For animated objects, use their stable mesh ID instead
        const meshId = this.getMeshIdForTriangles(triangles, object._stableMeshId);
        if (!meshId) return;

        // AUTO-REGISTER: First time we see this meshId, bake it to GPU
        if (!this._meshLibrary.has(meshId)) {
            this.registerStaticMesh(meshId, triangles, object.isStatic);
        } else {
            // Check if triangle reference changed (handles geometry swaps like bomb detonation)
            const lastTriangles = this._lastTriangles.get(meshId);
            if (lastTriangles !== triangles) {
                this.updateStaticMesh(meshId, triangles);
                this._lastTriangles.set(meshId, triangles);
            }
        }

        const transform = object.transform;
        const queueEntry = {
            meshId: meshId,
            position: transform ? transform.position : { x: 0, y: 0, z: 0 },
            rotation: transform ? transform.rotation : { x: 0, y: 0, z: 0, w: 1 },
            scale: transform ? transform.scale || 1.0 : 1.0,
            alpha: object.alpha !== undefined ? object.alpha : 1.0,
            isStatic: object.isStatic,
            object: object // Store reference to object for bone matrix retrieval
        };

        this._drawQueue.push(queueEntry);

        this.stats.objectsTotal++;
    }

    /**
     * Register an object's mesh in the GPU library WITHOUT enqueueing it for the color pass. The
     * shadow pass looks meshes up by id (it assumes queue() already baked them), so a shadow-ONLY
     * caster — e.g. the first-person player body, which should cast/self-shadow but never be drawn
     * from inside our own head — must still get its mesh registered here. Mirrors the auto-register
     * half of queue() (mesh bake + geometry-swap refresh); skips the draw-queue push.
     */
    ensureMeshRegistered(object) {
        if (!object) return;
        const triangles = object.triangles;
        if (!triangles || triangles.length === 0) return;
        const meshId = this.getMeshIdForTriangles(triangles, object._stableMeshId);
        if (!meshId) return;
        if (!this._meshLibrary.has(meshId)) {
            this.registerStaticMesh(meshId, triangles, object.isStatic);
        } else {
            const lastTriangles = this._lastTriangles.get(meshId);
            if (lastTriangles !== triangles) {
                this.updateStaticMesh(meshId, triangles);
                this._lastTriangles.set(meshId, triangles);
            }
        }
    }

    /**
     * Register a mesh with the renderer for persistent GPU storage.
     */
    registerStaticMesh(meshId, triangles, isStatic = true) {
        if (this._meshLibrary.has(meshId)) return;

        const gl = this.gl;
        const count = triangles.length;
        const usage = isStatic ? gl.STATIC_DRAW : gl.DYNAMIC_DRAW;

        const positions = new Float32Array(count * 9);
        const normals = new Float32Array(count * 9);
        const tangents = new Float32Array(count * 9);
        const colors = new Float32Array(count * 9);
        const alphas = new Float32Array(count * 3);
        const uvs = new Float32Array(count * 6);
        const textureIndices = new Float32Array(count * 3);
        const useTextureFlags = new Float32Array(count * 3);
        const normalMapIndices = new Float32Array(count * 3);
        const metallicRoughnessMapIndices = new Float32Array(count * 3);
        const emissiveMapIndices = new Float32Array(count * 3);

        let meshHasTextures = false;
        const opaqueIndices = [];
        const transparentIndices = [];

        for (let i = 0; i < count; i++) {
            const triangle = triangles[i];
            const base = i * 9;
            const baseInd = i * 3;
            const baseUV = i * 6;

            const color = triangle.color || "#FFFFFF";
            const triAlpha = triangle.alpha !== undefined ? triangle.alpha : 1.0;
            const hexColor = parseInt(color.substring(1), 16);
            const r = ((hexColor >> 16) & 255) / 255;
            const g = ((hexColor >> 8) & 255) / 255;
            const b = (hexColor & 255) / 255;
            const perVertexColor = triangle.vertexColors; // optional [{r,g,b}]x3 override per corner

            for (let v = 0; v < 3; v++) {
                const vert = triangle.vertices[v];
                const off = base + v * 3;
                positions[off] = vert.x;
                positions[off + 1] = vert.y;
                positions[off + 2] = vert.z;

                // Upload smooth vertex normal (averaged across all triangles sharing this position)
                const vertexNormal =
                    triangle.vertexNormals && triangle.vertexNormals[v] ? triangle.vertexNormals[v] : triangle.normal;
                normals[off] = vertexNormal.x;
                normals[off + 1] = vertexNormal.y;
                normals[off + 2] = vertexNormal.z;

                // Store tangent if available (for normal mapping)
                if (triangle.tangents && triangle.tangents[v]) {
                    const tang = triangle.tangents[v];
                    tangents[off] = tang.x;
                    tangents[off + 1] = tang.y;
                    tangents[off + 2] = tang.z;
                } else {
                    // Default tangent if not available
                    tangents[off] = 1;
                    tangents[off + 1] = 0;
                    tangents[off + 2] = 0;
                }

                if (perVertexColor && perVertexColor[v]) {
                    colors[off] = perVertexColor[v].r;
                    colors[off + 1] = perVertexColor[v].g;
                    colors[off + 2] = perVertexColor[v].b;
                } else {
                    colors[off] = r;
                    colors[off + 1] = g;
                    colors[off + 2] = b;
                }

                alphas[baseInd + v] = triAlpha;
            }

            const shouldUseTexture = (triangle.material && triangle.material.useTexture) || triangle.texture;
            let textureIndex = 0;
            let useTextureValue = 0;

            if (shouldUseTexture) {
                meshHasTextures = true;
                useTextureValue = 1;
                if (triangle.material && triangle.material.useTexture && triangle.material.textureIndex >= 0) {
                    textureIndex = triangle.material.textureIndex;
                }
            }

            let uvsToUse = triangle.uvs || (triangle.material ? triangle.material.texCoords : null);
            if (uvsToUse) {
                for (let j = 0; j < 3; j++) {
                    uvs[baseUV + j * 2] = uvsToUse[j].u || uvsToUse[j].x || 0;
                    uvs[baseUV + j * 2 + 1] = uvsToUse[j].v || uvsToUse[j].y || 0;
                }
            } else {
                uvs[baseUV] = 0;
                uvs[baseUV + 1] = 0;
                uvs[baseUV + 2] = 1;
                uvs[baseUV + 3] = 0;
                uvs[baseUV + 4] = 0.5;
                uvs[baseUV + 5] = 1;
            }

            for (let j = 0; j < 3; j++) {
                textureIndices[baseInd + j] = textureIndex;
                useTextureFlags[baseInd + j] = useTextureValue;

                // Store material texture map indices
                normalMapIndices[baseInd + j] =
                    triangle.material && triangle.material.normalMapIndex >= 0 ? triangle.material.normalMapIndex : -1;
                metallicRoughnessMapIndices[baseInd + j] =
                    triangle.material && triangle.material.metallicRoughnessMapIndex >= 0
                        ? triangle.material.metallicRoughnessMapIndex
                        : -1;
                emissiveMapIndices[baseInd + j] =
                    triangle.material && triangle.material.emissiveMapIndex >= 0
                        ? triangle.material.emissiveMapIndex
                        : -1;
            }

            // Separate into opaque and transparent triangle indices
            // Treat alpha == 1.0 as opaque, all other values (including 0) as transparent
            // This ensures every triangle gets indexed (no orphaned geometry)
            if (triAlpha < 1.0) {
                transparentIndices.push(baseInd, baseInd + 1, baseInd + 2);
            } else {
                opaqueIndices.push(baseInd, baseInd + 1, baseInd + 2);
            }
        }

        // Extract bone data - ALL meshes need this (shader always expects it)
        const boneIndices = new Int32Array(count * 12); // 4 indices per vertex, 3 vertices per triangle
        const boneWeights = new Float32Array(count * 12); // 4 weights per vertex, 3 vertices per triangle
        // (bone arrays are filled by the loop below, then the optional merge pass compacts them)

        for (let i = 0; i < count; i++) {
            const triangle = triangles[i];
            const baseInd = i * 12;

            for (let v = 0; v < 3; v++) {
                const vertexOffset = v * 4;

                if (triangle.jointData && triangle.jointData[v]) {
                    // Skeletal mesh - use actual bone data
                    const joints = triangle.jointData[v];
                    const weights = triangle.weightData[v];

                    for (let j = 0; j < 4; j++) {
                        boneIndices[baseInd + vertexOffset + j] = joints[j] || 0;
                        boneWeights[baseInd + vertexOffset + j] = weights[j] || 0;
                    }
                } else {
                    // Non-skeletal mesh - zero weights skips skinning in shader
                    boneIndices[baseInd + vertexOffset] = 0;
                    boneIndices[baseInd + vertexOffset + 1] = 0;
                    boneIndices[baseInd + vertexOffset + 2] = 0;
                    boneIndices[baseInd + vertexOffset + 3] = 0;
                    boneWeights[baseInd + vertexOffset] = 0;
                    boneWeights[baseInd + vertexOffset + 1] = 0;
                    boneWeights[baseInd + vertexOffset + 2] = 0;
                    boneWeights[baseInd + vertexOffset + 3] = 0;
                }
            }
        }

        // ---------------------------------------------------------------------------------------
        // OPTIONAL VERTEX MERGE (ObjectRenderer3D.MERGE_VERTICES, default off).
        //
        // Everything above wrote ONE vertex record per triangle corner — 3 per triangle, nothing
        // shared, because Triangle owns its three Vector3s outright and has no index concept. On
        // smooth geometry that's ~5.5-6.2x more vertex records than there are distinct ones
        // (measured live: 97,260 -> 17,578 across a whole FPS frame).
        //
        // This pass leaves the attribute-filling loops above completely untouched and instead
        // COMPACTS their output: hash every corner on the full attribute tuple the shader reads,
        // keep the first occurrence, and rewrite the index buffer to point at it.
        //
        // Two invariants this must not break:
        //  1. The index buffer is also the OPAQUE/TRANSPARENT SORT. _drawTransparentList seeks with
        //     `transparentOffset = opaqueCount * 4`, so opaque indices must stay first and the
        //     counts must stay exact. Remapping indices in place preserves both (we rewrite what
        //     each index POINTS AT, never the order or the length of the index list).
        //  2. The merge key must include every per-vertex attribute, or two corners that differ in
        //     something the shader reads would collapse into one. Colour/alpha/texture/material
        //     indices are per-TRIANGLE here and replicated to corners, so they're part of the key —
        //     which is exactly why a two-tone sphere merges 3.09x instead of 6.18x.
        // ---------------------------------------------------------------------------------------
        let vertexCount = count * 3;
        let mergedFrom = 0;
        if (ObjectRenderer3D.MERGE_VERTICES && count > 0) {
            const n = count * 3;
            const remap = new Uint32Array(n); // old corner -> new vertex slot
            const seen = new Map();
            let next = 0;
            // Quantize floats so bit-noise doesn't defeat the hash. 1e-6 with a `+ 0` to collapse
            // -0 into 0 — the same trick ActionPhysicsSphere3D uses to weld the UV-sphere seam,
            // where sin(2*PI) = -2.4e-16 made the wrap column hash differently from the seam column.
            const q = (x) => Math.round(x * 1e6) / 1e6 + 0;
            for (let v = 0; v < n; v++) {
                const p3 = v * 3, p2 = v * 2, p4 = v * 4;
                const key =
                    q(positions[p3]) + "," + q(positions[p3 + 1]) + "," + q(positions[p3 + 2]) + "|" +
                    q(normals[p3]) + "," + q(normals[p3 + 1]) + "," + q(normals[p3 + 2]) + "|" +
                    q(tangents[p3]) + "," + q(tangents[p3 + 1]) + "," + q(tangents[p3 + 2]) + "|" +
                    q(colors[p3]) + "," + q(colors[p3 + 1]) + "," + q(colors[p3 + 2]) + "|" +
                    alphas[v] + "|" + q(uvs[p2]) + "," + q(uvs[p2 + 1]) + "|" +
                    textureIndices[v] + "," + useTextureFlags[v] + "," + normalMapIndices[v] + "," +
                    metallicRoughnessMapIndices[v] + "," + emissiveMapIndices[v] + "|" +
                    boneIndices[p4] + "," + boneIndices[p4 + 1] + "," + boneIndices[p4 + 2] + "," + boneIndices[p4 + 3] + "|" +
                    boneWeights[p4] + "," + boneWeights[p4 + 1] + "," + boneWeights[p4 + 2] + "," + boneWeights[p4 + 3];
                let slot = seen.get(key);
                if (slot === undefined) {
                    slot = next++;
                    seen.set(key, slot);
                    // Compact in place: slot <= v always, so this never overwrites unread data.
                    const d3 = slot * 3, d2 = slot * 2, d4 = slot * 4;
                    positions[d3] = positions[p3]; positions[d3 + 1] = positions[p3 + 1]; positions[d3 + 2] = positions[p3 + 2];
                    normals[d3] = normals[p3]; normals[d3 + 1] = normals[p3 + 1]; normals[d3 + 2] = normals[p3 + 2];
                    tangents[d3] = tangents[p3]; tangents[d3 + 1] = tangents[p3 + 1]; tangents[d3 + 2] = tangents[p3 + 2];
                    colors[d3] = colors[p3]; colors[d3 + 1] = colors[p3 + 1]; colors[d3 + 2] = colors[p3 + 2];
                    alphas[slot] = alphas[v];
                    uvs[d2] = uvs[p2]; uvs[d2 + 1] = uvs[p2 + 1];
                    textureIndices[slot] = textureIndices[v];
                    useTextureFlags[slot] = useTextureFlags[v];
                    normalMapIndices[slot] = normalMapIndices[v];
                    metallicRoughnessMapIndices[slot] = metallicRoughnessMapIndices[v];
                    emissiveMapIndices[slot] = emissiveMapIndices[v];
                    for (let j = 0; j < 4; j++) {
                        boneIndices[d4 + j] = boneIndices[p4 + j];
                        boneWeights[d4 + j] = boneWeights[p4 + j];
                    }
                }
                remap[v] = slot;
            }
            // Point the existing indices at their merged slots. Order and length are untouched, so
            // the opaque-then-transparent partition and both counts survive exactly.
            for (let i = 0; i < opaqueIndices.length; i++) opaqueIndices[i] = remap[opaqueIndices[i]];
            for (let i = 0; i < transparentIndices.length; i++) transparentIndices[i] = remap[transparentIndices[i]];
            mergedFrom = n;
            vertexCount = next;
        }
        // Views trimmed to the live vertex count (no-op when merging is off).
        const sub = (arr, per) => (vertexCount * per === arr.length ? arr : arr.subarray(0, vertexCount * per));

        const mesh = {
            buffers: {
                position: gl.createBuffer(),
                normal: gl.createBuffer(),
                tangent: gl.createBuffer(),
                color: gl.createBuffer(),
                alpha: gl.createBuffer(),
                uv: gl.createBuffer(),
                textureIndex: gl.createBuffer(),
                useTexture: gl.createBuffer(),
                normalMapIndex: gl.createBuffer(),
                metallicRoughnessMapIndex: gl.createBuffer(),
                emissiveMapIndex: gl.createBuffer(),
                boneIndices: gl.createBuffer(),
                boneWeights: gl.createBuffer(),
                indices: gl.createBuffer()
            },
            vaos: new Map(), // VAO per object shader program (keyed by WebGL program object)
            shadowVaos: new Map(), // VAO per shadow program (keyed by WebGL program object)
            // NOTE: `count` is the INDEX count (what the shadow pass hands to drawElements), which
            // is 3 per triangle whether or not vertices were merged — merging changes how many
            // vertex RECORDS exist, never how many indices are drawn.
            count: count * 3,
            vertexCount: vertexCount,
            mergedFrom: mergedFrom,
            hasTextures: meshHasTextures,
            opaqueIndices: opaqueIndices,
            transparentIndices: transparentIndices,
            opaqueCount: opaqueIndices.length,
            transparentCount: transparentIndices.length
        };

        // Upload all buffer data
        const upload = (buf, data) => {
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, data, usage);
        };

        upload(mesh.buffers.position, sub(positions, 3));
        upload(mesh.buffers.normal, sub(normals, 3));
        upload(mesh.buffers.tangent, sub(tangents, 3));
        upload(mesh.buffers.color, sub(colors, 3));
        upload(mesh.buffers.alpha, sub(alphas, 1));
        upload(mesh.buffers.uv, sub(uvs, 2));
        upload(mesh.buffers.textureIndex, sub(textureIndices, 1));
        upload(mesh.buffers.useTexture, sub(useTextureFlags, 1));
        upload(mesh.buffers.normalMapIndex, sub(normalMapIndices, 1));
        upload(mesh.buffers.metallicRoughnessMapIndex, sub(metallicRoughnessMapIndices, 1));
        upload(mesh.buffers.emissiveMapIndex, sub(emissiveMapIndices, 1));
        upload(mesh.buffers.boneIndices, sub(boneIndices, 4));
        upload(mesh.buffers.boneWeights, sub(boneWeights, 4));

        // Build reordered index buffer: opaque indices first, then transparent
        const reorderedIndices = new Uint32Array(opaqueIndices.length + transparentIndices.length);
        let indexPos = 0;
        for (let i = 0; i < opaqueIndices.length; i++) {
            reorderedIndices[indexPos++] = opaqueIndices[i];
        }
        for (let i = 0; i < transparentIndices.length; i++) {
            reorderedIndices[indexPos++] = transparentIndices[i];
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.buffers.indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, reorderedIndices, gl.STATIC_DRAW);

        // VAO will be built lazily per-program when first needed
        // (in _drawEntryList, keyed by shader program to support variant switching)

        this._meshLibrary.set(meshId, mesh);
    }

    /**
     * Build a VAO that captures all vertex attribute state for a mesh.
     * @param {Object} mesh - The mesh with its buffers
     * @param {Object} locs - Attribute location object from programManager
     * @returns {WebGLVertexArrayObject}
     */
    _buildVAO(mesh, locs) {
        const gl = this.gl;
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        // Bind all ARRAY_BUFFER attributes inside the VAO
        const bindAttr = (buf, loc, size, type, normalized) => {
            if (loc === -1 || loc === null || loc === undefined) return;
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            if (type === gl.INT) {
                gl.vertexAttribIPointer(loc, size, type, 0, 0);
            } else {
                gl.vertexAttribPointer(loc, size, type, normalized, 0, 0);
            }
            gl.enableVertexAttribArray(loc);
        };

        bindAttr(mesh.buffers.position, locs.position, 3, gl.FLOAT, false);
        bindAttr(mesh.buffers.normal, locs.normal, 3, gl.FLOAT, false);
        bindAttr(mesh.buffers.tangent, locs.tangent, 3, gl.FLOAT, false);
        bindAttr(mesh.buffers.color, locs.color, 3, gl.FLOAT, false);
        bindAttr(mesh.buffers.alpha, locs.alpha, 1, gl.FLOAT, false);
        bindAttr(mesh.buffers.uv, locs.texCoord, 2, gl.FLOAT, false);
        bindAttr(mesh.buffers.textureIndex, locs.textureIndex, 1, gl.FLOAT, false);
        bindAttr(mesh.buffers.useTexture, locs.useTexture, 1, gl.FLOAT, false);
        bindAttr(mesh.buffers.normalMapIndex, locs.normalMapIndex, 1, gl.FLOAT, false);
        bindAttr(mesh.buffers.metallicRoughnessMapIndex, locs.metallicRoughnessMapIndex, 1, gl.FLOAT, false);
        bindAttr(mesh.buffers.emissiveMapIndex, locs.emissiveMapIndex, 1, gl.FLOAT, false);
        bindAttr(mesh.buffers.boneIndices, locs.boneIndices, 4, gl.INT, false);
        bindAttr(mesh.buffers.boneWeights, locs.boneWeights, 4, gl.FLOAT, false);

        // Bind the index buffer inside the VAO so it's also captured
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.buffers.indices);

        gl.bindVertexArray(null);
        return vao;
    }

    /**
     * Build (or lazily rebuild) a shadow VAO for a given mesh + shadow program.
     * Shadow shaders only need position + boneIndices + boneWeights.
     * @param {Object} mesh
     * @param {Object} shadowLocs  - { position, boneIndices, boneWeights }
     * @param {WebGLProgram} program - shadow program (used as cache key)
     * @returns {WebGLVertexArrayObject}
     */
    buildShadowVAO(mesh, shadowLocs, program) {
        if (mesh.shadowVaos.has(program)) {
            return mesh.shadowVaos.get(program);
        }

        const gl = this.gl;
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        // Position (always needed)
        if (shadowLocs.position !== -1 && shadowLocs.position !== null) {
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.position);
            gl.vertexAttribPointer(shadowLocs.position, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(shadowLocs.position);
        }

        // Bone attributes (skeletal animation support)
        if (shadowLocs.boneIndices !== -1 && shadowLocs.boneIndices !== null && mesh.buffers.boneIndices) {
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.boneIndices);
            gl.vertexAttribIPointer(shadowLocs.boneIndices, 4, gl.INT, 0, 0);
            gl.enableVertexAttribArray(shadowLocs.boneIndices);
        }
        if (shadowLocs.boneWeights !== -1 && shadowLocs.boneWeights !== null && mesh.buffers.boneWeights) {
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.boneWeights);
            gl.vertexAttribPointer(shadowLocs.boneWeights, 4, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(shadowLocs.boneWeights);
        }

        // Index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.buffers.indices);

        gl.bindVertexArray(null);
        mesh.shadowVaos.set(program, vao);
        return vao;
    }

    /**
     * Update an existing mesh's vertex data (Dynamic Path)
     */
    updateStaticMesh(meshId, triangles) {
        const mesh = this._meshLibrary.get(meshId);
        if (!mesh) return;

        const gl = this.gl;
        const count = triangles.length;

        // A merged mesh, or any mesh whose triangle count changed, can't be updated in place via
        // bufferSubData (buffer is the wrong size / indices point at stale slots) — rebuild instead.
        if (mesh.mergedFrom || (mesh.count | 0) !== count * 3) {
            for (const b of Object.values(mesh.buffers)) gl.deleteBuffer(b);
            for (const v of mesh.vaos.values()) gl.deleteVertexArray(v);
            for (const v of mesh.shadowVaos.values()) gl.deleteVertexArray(v);
            this._meshLibrary.delete(meshId);
            this.registerStaticMesh(meshId, triangles, false);
            return;
        }

        const positions = new Float32Array(count * 9);
        const normals = new Float32Array(count * 9);
        const tangents = new Float32Array(count * 9);
        const colors = new Float32Array(count * 9);
        const alphas = new Float32Array(count * 3);
        const uvs = new Float32Array(count * 6);
        const textureIndices = new Float32Array(count * 3);
        const useTextureFlags = new Float32Array(count * 3);
        const normalMapIndices = new Float32Array(count * 3);
        const metallicRoughnessMapIndices = new Float32Array(count * 3);
        const emissiveMapIndices = new Float32Array(count * 3);
        const opaqueIndices = [];
        const transparentIndices = [];

        for (let i = 0; i < count; i++) {
            const triangle = triangles[i];
            const base = i * 9;
            const baseInd = i * 3;
            const baseUV = i * 6;

            const colorString = triangle.color || "#FFFFFF";
            const hexColor = parseInt(colorString.substring(1), 16);
            const r = ((hexColor >> 16) & 255) / 255;
            const g = ((hexColor >> 8) & 255) / 255;
            const b = (hexColor & 255) / 255;
            const perVertexColor = triangle.vertexColors; // see registerStaticMesh()

            const triNormal = triangle.normal;
            const triAlpha = triangle.alpha !== undefined ? triangle.alpha : 1.0;

            for (let v = 0; v < 3; v++) {
                const vert = triangle.vertices[v];
                const off = base + v * 3;
                positions[off] = vert.x;
                positions[off + 1] = vert.y;
                positions[off + 2] = vert.z;

                normals[off] = triNormal.x;
                normals[off + 1] = triNormal.y;
                normals[off + 2] = triNormal.z;

                // Store tangent if available (for normal mapping)
                if (triangle.tangents && triangle.tangents[v]) {
                    const tang = triangle.tangents[v];
                    tangents[off] = tang.x;
                    tangents[off + 1] = tang.y;
                    tangents[off + 2] = tang.z;
                } else {
                    // Default tangent if not available
                    tangents[off] = 1;
                    tangents[off + 1] = 0;
                    tangents[off + 2] = 0;
                }

                if (perVertexColor && perVertexColor[v]) {
                    colors[off] = perVertexColor[v].r;
                    colors[off + 1] = perVertexColor[v].g;
                    colors[off + 2] = perVertexColor[v].b;
                } else {
                    colors[off] = r;
                    colors[off + 1] = g;
                    colors[off + 2] = b;
                }
                alphas[baseInd + v] = triAlpha;
            }

            const shouldUseTexture = (triangle.material && triangle.material.useTexture) || triangle.texture;
            let textureIndex = 0;
            if (shouldUseTexture) {
                if (triangle.material && triangle.material.useTexture && triangle.material.textureIndex >= 0) {
                    textureIndex = triangle.material.textureIndex;
                }
            }

            let uvsToUse = triangle.uvs || (triangle.material ? triangle.material.texCoords : null);
            if (uvsToUse) {
                for (let j = 0; j < 3; j++) {
                    uvs[baseUV + j * 2] = uvsToUse[j].u || uvsToUse[j].x || 0;
                    uvs[baseUV + j * 2 + 1] = uvsToUse[j].v || uvsToUse[j].y || 0;
                }
            }

            for (let j = 0; j < 3; j++) {
                textureIndices[baseInd + j] = textureIndex;
                useTextureFlags[baseInd + j] = shouldUseTexture ? 1 : 0;

                // Store material texture map indices
                normalMapIndices[baseInd + j] =
                    triangle.material && triangle.material.normalMapIndex >= 0 ? triangle.material.normalMapIndex : -1;
                metallicRoughnessMapIndices[baseInd + j] =
                    triangle.material && triangle.material.metallicRoughnessMapIndex >= 0
                        ? triangle.material.metallicRoughnessMapIndex
                        : -1;
                emissiveMapIndices[baseInd + j] =
                    triangle.material && triangle.material.emissiveMapIndex >= 0
                        ? triangle.material.emissiveMapIndex
                        : -1;
            }

            // Separate into opaque and transparent triangle indices
            // Skip fully transparent triangles (alpha = 0) as they are invisible
            if (triAlpha < 1.0 && triAlpha > 0.0) {
                transparentIndices.push(baseInd, baseInd + 1, baseInd + 2);
            } else if (triAlpha > 0.0) {
                opaqueIndices.push(baseInd, baseInd + 1, baseInd + 2);
            }
        }

        // Update mesh transparency tracking
        mesh.opaqueIndices = opaqueIndices;
        mesh.transparentIndices = transparentIndices;
        mesh.opaqueCount = opaqueIndices.length;
        mesh.transparentCount = transparentIndices.length;

        const update = (buf, data) => {
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
        };

        update(mesh.buffers.position, positions);
        update(mesh.buffers.normal, normals);
        update(mesh.buffers.tangent, tangents);
        update(mesh.buffers.color, colors);
        update(mesh.buffers.alpha, alphas);
        update(mesh.buffers.uv, uvs);
        update(mesh.buffers.textureIndex, textureIndices);
        update(mesh.buffers.useTexture, useTextureFlags);
        update(mesh.buffers.normalMapIndex, normalMapIndices);
        update(mesh.buffers.metallicRoughnessMapIndex, metallicRoughnessMapIndices);
        update(mesh.buffers.emissiveMapIndex, emissiveMapIndices);

        // Rebuild reordered index buffer: opaque indices first, then transparent
        const reorderedIndices = new Uint32Array(opaqueIndices.length + transparentIndices.length);
        let indexPos = 0;
        for (let i = 0; i < opaqueIndices.length; i++) {
            reorderedIndices[indexPos++] = opaqueIndices[i];
        }
        for (let i = 0; i < transparentIndices.length; i++) {
            reorderedIndices[indexPos++] = transparentIndices[i];
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.buffers.indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, reorderedIndices, gl.DYNAMIC_DRAW);

        // Rebuild the main VAO now that buffer data has changed.
        // Any shadow VAOs are also stale — delete and clear them so they're
        // rebuilt on next use with the updated index buffer.
        if (mesh.vaos) {
            for (const v of mesh.vaos.values()) gl.deleteVertexArray(v);
            mesh.vaos.clear();
        }
        if (mesh.shadowVaos) {
            for (const v of mesh.shadowVaos.values()) gl.deleteVertexArray(v);
            mesh.shadowVaos.clear();
        }

        // Clear VAOs so they're rebuilt with updated data on next draw
        // (keyed by shader program to support variant switching)
        if (mesh.vaos) {
            for (const v of mesh.vaos.values()) this.gl.deleteVertexArray(v);
            mesh.vaos.clear();
        }
    }

    render() {
        if (this._drawQueue.length > 0) {
            this.drawObjects(this._camera);
        }
    }

    drawObjects(camera) {
        const gl = this.gl;
        const ARRAY_BUFFER = gl.ARRAY_BUFFER;

        this.updateUniformCache(camera);
        const prog = this.programManager.getObjectProgram();
        const locs = this.programManager.getObjectLocations();
        gl.useProgram(prog);

        this._setFrameConstantUniforms(locs, prog, camera);

        // Draw all opaque triangles from all objects first
        this._drawEntryList(this._drawQueue, locs, camera);

        // Store all objects for transparent pass (we'll filter by mesh transparency)
        this._transparentQueue = this._drawQueue;
    }

    _drawEntryList(list, locs, camera) {
        const gl = this.gl;
        const prog = this.programManager.getObjectProgram();

        // Group entries by meshId so each mesh's VAO is bound only once
        const entriesByMeshId = new Map();
        for (const entry of list) {
            if (!entriesByMeshId.has(entry.meshId)) {
                entriesByMeshId.set(entry.meshId, []);
            }
            entriesByMeshId.get(entry.meshId).push(entry);
        }

        for (const [meshId, entries] of entriesByMeshId) {
            const mesh = this._meshLibrary.get(meshId);
            if (!mesh) continue;

            if (entries.length === 0) continue;

            // Get or build VAO for this program variant
            let vao;
            if (mesh.vaos.has(prog)) {
                vao = mesh.vaos.get(prog);
            } else {
                vao = this._buildVAO(mesh, locs);
                mesh.vaos.set(prog, vao);
            }

            // ONE call instead of ~26 bindBuffer/vertexAttribPointer/
            // enableVertexAttribArray calls (13 attributes × 2 calls each)
            gl.bindVertexArray(vao);

            // Draw each instance with only per-object uniform updates
            for (const entry of entries) {
                this.setupObjectShader(locs, camera, -1, entry.position, entry.rotation, entry.scale, entry.object);

                if (mesh.opaqueCount > 0) {
                    gl.drawElements(gl.TRIANGLES, mesh.opaqueCount, this.indexType, 0);
                }
            }
        }

        gl.bindVertexArray(null);
    }

    _drawTransparentList(list, locs, camera) {
        const gl = this.gl;
        const prog = this.programManager.getObjectProgram();

        // Group entries by meshId so each mesh's VAO is bound only once
        const entriesByMeshId = new Map();
        for (const entry of list) {
            const mesh = this._meshLibrary.get(entry.meshId);
            if (!mesh || mesh.transparentCount === 0) continue;

            if (!entriesByMeshId.has(entry.meshId)) {
                entriesByMeshId.set(entry.meshId, []);
            }
            entriesByMeshId.get(entry.meshId).push(entry);
        }

        for (const [meshId, entries] of entriesByMeshId) {
            const mesh = this._meshLibrary.get(meshId);
            if (!mesh || mesh.transparentCount === 0) continue;

            // Get or build VAO for this program variant
            let vao;
            if (mesh.vaos.has(prog)) {
                vao = mesh.vaos.get(prog);
            } else {
                vao = this._buildVAO(mesh, locs);
                mesh.vaos.set(prog, vao);
            }

            // ONE call instead of ~26 bindBuffer/vertexAttribPointer/
            // enableVertexAttribArray calls
            gl.bindVertexArray(vao);

            for (const entry of entries) {
                this.setupObjectShader(locs, camera, -1, entry.position, entry.rotation, entry.scale, entry.object);

                // Transparent triangles are packed after opaque indices in the buffer
                const transparentOffset = mesh.opaqueCount * 4; // 4 bytes per uint32 index
                gl.drawElements(gl.TRIANGLES, mesh.transparentCount, this.indexType, transparentOffset);
            }
        }

        gl.bindVertexArray(null);
    }

    _finalizeFrame() {
        this._frameInitialized = false;
        this._drawQueue = [];
        this._transparentQueue = [];
    }

    updateUniformCache(camera) {
        const program = this.programManager.getObjectProgram();

        // ADDITIVE (FPS viewmodel): when a projection override is active we must always
        // rebuild the cache so the override is applied, never serve a cached projection.
        const usingProjectionOverride = !!this._projectionOverride;

        if (
            !usingProjectionOverride &&
            this._uniformCache.frame === this._frameCount &&
            this._uniformCache.shaderProgram === program &&
            this._uniformCache.camera === camera
        ) {
            return;
        }

        this._uniformCache.frame = this._frameCount;
        this._uniformCache.shaderProgram = program;
        this._uniformCache.camera = camera;

        if (usingProjectionOverride) {
            const src = this._projectionOverride;
            const dst = this._uniformCache.matrices.projection;
            for (let i = 0; i < 16; i++) dst[i] = src[i];
        } else {
            // near defaults to 0.1 (a sane absolute distance at player scale 1) but is NOT itself scale-
            // aware — a caller with a scaled-down character (see Game.action_draw) sets camera.near from
            // the live scale each frame, same idea as viewmodelOptions.near, so nearby geometry isn't
            // clipped away by a near plane sized for a full-scale player.
            Matrix4.perspective(this._uniformCache.matrices.projection, camera.fov, Game.WIDTH / Game.HEIGHT, camera.near || 0.1, 10000.0);
        }
        Matrix4.lookAt(
            this._uniformCache.matrices.view,
            camera.position.toArray(),
            camera.target.toArray(),
            camera.up.toArray()
        );
        Matrix4.identity(this._uniformCache.matrices.model);

        if (this.lightManager.isMainDirectionalLightEnabled() && this.lightManager.getMainDirectionalLight()) {
            this._uniformCache.lightConfig = this.lightManager.getLightConfig();
            this._uniformCache.lightDir = this.lightManager.getLightDir();
            this._uniformCache.matrices.lightSpace = this.lightManager.getLightSpaceMatrix();
        } else {
            this._uniformCache.lightConfig = null;
            this._uniformCache.lightDir = null;
            this._uniformCache.matrices.lightSpace = null;
        }

        const materialConfig = this.lightManager.constants.MATERIAL;
        this._uniformCache.roughness = materialConfig.ROUGHNESS.value;
        this._uniformCache.metallic = materialConfig.METALLIC.value;
        this._uniformCache.ior = materialConfig.IOR.value;
        this._uniformCache.transmission = materialConfig.TRANSMISSION.value;
    }

    _setFrameConstantUniforms(locations, program, camera) {
        const gl = this.gl;
        gl.uniformMatrix4fv(locations.projectionMatrix, false, this._uniformCache.matrices.projection);
        gl.uniformMatrix4fv(locations.viewMatrix, false, this._uniformCache.matrices.view);

        if (locations.cameraPos !== -1 && locations.cameraPos !== null) {
            gl.uniform3fv(locations.cameraPos, camera.position.toArray());
        }
        if (locations.farPlane !== -1 && locations.farPlane !== null) {
            gl.uniform1f(locations.farPlane, 10000.0);
        }
        // NOTE: uPointShadowFarPlane{0..3} is set PER-LIGHT by each ActionOmnidirectionalShadowLight
        // (= its radius, matching the far its cube map was rendered with). Do NOT hardcode it here —
        // a fixed 500 made the receiver disagree with the per-light cube depth and broke point shadows.

        const config = this._uniformCache.lightConfig;
        const mainLightEnabled =
            this.lightManager.isMainDirectionalLightEnabled() && this.lightManager.getMainDirectionalLight() !== null;

        if (locations.shadowsEnabled !== -1 && locations.shadowsEnabled !== null) {
            gl.uniform1i(locations.shadowsEnabled, mainLightEnabled && this.renderer.shadowsEnabled ? 1 : 0);
        }
        const dirLightEnabledLoc = gl.getUniformLocation(this.programManager.getObjectProgram(), "uDirectionalLightEnabled");
        if (dirLightEnabledLoc !== null) {
            gl.uniform1i(dirLightEnabledLoc, mainLightEnabled ? 1 : 0);
        }
        if (
            locations.lightDir !== -1 &&
            locations.lightDir !== null &&
            mainLightEnabled &&
            this._uniformCache.lightDir
        ) {
            gl.uniform3fv(locations.lightDir, this._uniformCache.lightDir.toArray());
        }
        if (
            locations.lightIntensity !== -1 &&
            locations.lightIntensity !== null &&
            mainLightEnabled &&
            config &&
            config.INTENSITY !== undefined
        ) {
            gl.uniform1f(locations.lightIntensity, config.INTENSITY);
        }
        if (
            locations.lightColor !== -1 &&
            locations.lightColor !== null &&
            mainLightEnabled &&
            config &&
            config.COLOR
        ) {
            gl.uniform3fv(locations.lightColor, [config.COLOR.x, config.COLOR.y, config.COLOR.z]);
        }

        if (locations.roughness !== -1 && locations.roughness !== null)
            gl.uniform1f(locations.roughness, this._uniformCache.roughness);
        if (locations.metallic !== -1 && locations.metallic !== null)
            gl.uniform1f(locations.metallic, this._uniformCache.metallic);
        if (locations.ior !== -1 && locations.ior !== null) gl.uniform1f(locations.ior, this._uniformCache.ior);
        if (locations.transmission !== -1 && locations.transmission !== null)
            gl.uniform1f(locations.transmission, this._uniformCache.transmission);
        if (locations.normalMapStrength !== -1 && locations.normalMapStrength !== null)
            gl.uniform1f(locations.normalMapStrength, lightingConstants.MATERIAL.NORMAL_MAP_STRENGTH.value);

        if (locations.directionalLightAttenuation !== -1 && locations.directionalLightAttenuation !== null) {
            gl.uniform1i(
                locations.directionalLightAttenuation,
                this.lightManager.constants.DEBUG.DIRECTIONAL_LIGHT_ATTENUATION ? 1 : 0
            );
        }

        if (locations.ambientIntensity !== -1 && locations.ambientIntensity !== null) {
            const ambientIntensity =
                this.lightManager.constants.AMBIENT_INTENSITY !== undefined
                    ? this.lightManager.constants.AMBIENT_INTENSITY
                    : 0.3;
            gl.uniform1f(locations.ambientIntensity, ambientIntensity);
        }

        // Hemisphere ambient tints + tonemap/exposure (new linear-HDR color pipeline)
        const C = this.lightManager.constants;
        if (locations.ambientSkyColor !== -1 && locations.ambientSkyColor !== null) {
            const s = C.AMBIENT_SKY_COLOR || { r: 0.55, g: 0.65, b: 0.85 };
            gl.uniform3f(locations.ambientSkyColor, s.r, s.g, s.b);
        }
        if (locations.ambientGroundColor !== -1 && locations.ambientGroundColor !== null) {
            const g2 = C.AMBIENT_GROUND_COLOR || { r: 0.35, g: 0.30, b: 0.25 };
            gl.uniform3f(locations.ambientGroundColor, g2.r, g2.g, g2.b);
        }
        if (locations.exposure !== -1 && locations.exposure !== null) {
            gl.uniform1f(locations.exposure, C.EXPOSURE !== undefined ? C.EXPOSURE.value : 1.0);
        }
        if (locations.tonemapEnabled !== -1 && locations.tonemapEnabled !== null) {
            gl.uniform1i(locations.tonemapEnabled, C.TONEMAP ? 1 : 0);
        }

        if (locations.shadowDarkness !== -1 && locations.shadowDarkness !== null) {
            const shadowDarkness =
                this.lightManager.constants.SHADOW_DARKNESS !== undefined
                    ? this.lightManager.constants.SHADOW_DARKNESS
                    : 0.8;
            gl.uniform1f(locations.shadowDarkness, shadowDarkness);
        }

        this._setShadowUniforms();

        const matTex = this.renderer.textureManager.materialPropertiesTexture;
        if (matTex && locations.materialPropertiesTexture !== -1 && locations.materialPropertiesTexture !== null) {
            this.renderer.glStateManager.bindTextureWithUniform(
                "materialProperties",
                matTex,
                "TEXTURE_2D",
                program,
                "uMaterialPropertiesTexture"
            );
        }

        if (
            this.lightManager.directionalLightDataTexture &&
            locations.directionalLightData !== -1 &&
            locations.directionalLightData !== null
        ) {
            this.renderer.glStateManager.bindTextureWithUniform(
                "directionalLightData",
                this.lightManager.directionalLightDataTexture,
                "TEXTURE_2D",
                program,
                "uDirectionalLightData"
            );
        }

        if (
            this.lightManager.pointLightDataTexture &&
            locations.pointLightData !== -1 &&
            locations.pointLightData !== null
        ) {
            this.renderer.glStateManager.bindTextureWithUniform(
                "pointLightData",
                this.lightManager.pointLightDataTexture,
                "TEXTURE_2D",
                program,
                "uPointLightData"
            );
        }

        const texArray = this.renderer.textureManager.textureArray || this.renderer.textureArray;
        if (texArray && locations.textureArray !== -1 && locations.textureArray !== null) {
            this.renderer.glStateManager.bindTextureWithUniform(
                "textureArray",
                texArray,
                "TEXTURE_2D_ARRAY",
                program,
                "uTextureArray"
            );
        }
    }

    setupObjectShader(
        locations,
        camera,
        unused_idx = -1,
        posOverride = null,
        rotOverride = null,
        scaleOverride = null,
        object = null
    ) {
        const gl = this.gl;
        const pos = posOverride;
        const rot = rotOverride;
        const scale = scaleOverride;

        if (locations.modelPos !== -1 && locations.modelPos !== null) {
            const v = this._scratchVec3;
            if (pos) {
                v[0] = pos.x;
                v[1] = pos.y;
                v[2] = pos.z;
            } else {
                v[0] = 0;
                v[1] = 0;
                v[2] = 0;
            }
            gl.uniform3fv(locations.modelPos, v);
        }
        if (locations.modelRotation !== -1 && locations.modelRotation !== null) {
            const v = this._scratchVec4;
            if (rot) {
                v[0] = rot.x;
                v[1] = rot.y;
                v[2] = rot.z;
                v[3] = rot.w;
            } else {
                v[0] = 0;
                v[1] = 0;
                v[2] = 0;
                v[3] = 1;
            }
            gl.uniform4fv(locations.modelRotation, v);
        }
        if (locations.modelScale !== -1 && locations.modelScale !== null) {
            const v = this._scratchVec3;
            if (scale) {
                v[0] = scale.x !== undefined ? scale.x : scale;
                v[1] = scale.y !== undefined ? scale.y : scale;
                v[2] = scale.z !== undefined ? scale.z : scale;
            } else {
                v[0] = 1;
                v[1] = 1;
                v[2] = 1;
            }
            gl.uniform3fv(locations.modelScale, v);
        }

        // Handle bone matrices for animated objects
        const currentProgram = gl.getParameter(gl.CURRENT_PROGRAM);

        // Use object's TextureSet if available
        const textureSet = object && object._textureSet ? object._textureSet : null;
        const locs = this.programManager.getObjectLocations();
        const program = currentProgram || this.programManager.getObjectProgram();

        // Bind material properties texture from TextureSet
        if (
            textureSet &&
            textureSet.materialPropertiesTexture &&
            locs.materialPropertiesTexture !== -1 &&
            locs.materialPropertiesTexture !== null
        ) {
            this.renderer.glStateManager.bindTextureWithUniform(
                "materialProperties",
                textureSet.materialPropertiesTexture,
                "TEXTURE_2D",
                program,
                "uMaterialPropertiesTexture"
            );
        }

        // Bind texture array from TextureSet
        if (textureSet && textureSet.textureArray && locs.textureArray !== -1 && locs.textureArray !== null) {
            this.renderer.glStateManager.bindTextureWithUniform(
                "textureArray",
                textureSet.textureArray,
                "TEXTURE_2D_ARRAY",
                program,
                "uTextureArray"
            );
        }

        if (object && typeof object.getBoneMatrices === "function") {
            const objectId = object._stableMeshId;

            // Create UBO for this animated object if it doesn't exist
            if (!this.uboManager.getUBOInfo(objectId)) {
                this.uboManager.createAnimatedObjectUBO(objectId);
            }

            // Update UBO with current bone matrices
            const boneMatrices = object.getBoneMatrices();
            this.uboManager.updateAnimatedObjectMatrices(objectId, this._flattenMatrices(boneMatrices));

            // Bind UBO to shader
            this.uboManager.bindAnimatedObjectUBO(objectId, currentProgram);
        } else {
            // Bind default UBO for non-animated objects
            this.uboManager.bindDefaultUBO(currentProgram);
        }

        this.stats.uniformSetCount++;
    }

    // Helper to flatten array of Matrix4 objects to flat Float32Array for GL upload
    _flattenMatrices(matrices) {
        const flat = new Float32Array(256 * 16); // 256 matrices * 16 floats per matrix
        for (let i = 0; i < Math.min(matrices.length, 256); i++) {
            const m = matrices[i];
            const offset = i * 16;
            if (m) {
                for (let j = 0; j < 16; j++) {
                    flat[offset + j] = m[j] || (j % 5 === 0 ? 1 : 0); // Identity if undefined
                }
            } else {
                // Identity matrix
                for (let j = 0; j < 16; j++) {
                    flat[offset + j] = j % 5 === 0 ? 1 : 0;
                }
            }
        }
        return flat;
    }

    _setShadowUniforms() {
        const gl = this.gl;
        const locs = this.programManager.getShadowUniformLocations();
        const constants = this.lightManager.constants;

        if (locs.shadowSoftness !== null) gl.uniform1f(locs.shadowSoftness, constants.SHADOW_FILTERING.SOFTNESS.value);
        if (locs.pcfSize !== null) gl.uniform1i(locs.pcfSize, constants.SHADOW_FILTERING.PCF.SIZE.value);
        if (locs.pcfEnabled !== null) gl.uniform1i(locs.pcfEnabled, constants.SHADOW_FILTERING.PCF.ENABLED ? 1 : 0);
        // NOTE: uShadowSlopeScaleBias (the slope bias BASE) is now uploaded per-frame by the
        // directional light's applyToShader from the fit (slope slack texels × texel/far), so it's
        // geometry-derived like the flat bias — not a static constant. Here we only push the clamp.
        if (locs.shadowSlopeClamp !== null)
            gl.uniform1f(locs.shadowSlopeClamp, constants.SHADOW_MAP.SLOPE_CLAMP.value);
        if (locs.shadowPcssMax !== null)
            gl.uniform1f(locs.shadowPcssMax, constants.SHADOW_FILTERING.PCSS_MAX_TEXELS.value);
    }

    drawObject(locations, indexCount, offset = 0) {
        const gl = this.gl;
        gl.drawElements(gl.TRIANGLES, indexCount, this.indexType, offset);
    }

    drawTransparent(camera) {
        if (!this._transparentQueue || this._transparentQueue.length === 0) return;
        const gl = this.gl;
        const prog = this.programManager.getObjectProgram();
        const locs = this.programManager.getObjectLocations();
        gl.useProgram(prog);
        this.updateUniformCache(camera);
        this._setFrameConstantUniforms(locs, prog, camera);
        this._drawTransparentList(this._transparentQueue, locs, camera);
        this._finalizeFrame();
    }

    /**
     * ADDITIVE (FPS viewmodel pass).
     *
     * Render a set of objects as a first-person "viewmodel" (e.g. a held weapon) in an
     * isolated pass AFTER the main scene. The depth buffer is cleared first so the
     * viewmodel always draws on top of the world (never clips into walls), and a
     * dedicated projection with a much closer near plane (and optional narrower FOV) is
     * used so geometry held right in front of the camera doesn't get near-clipped.
     *
     * This reuses the normal object shader/lighting path, so viewmodels are lit exactly
     * like world objects. It is only ever invoked when a caller opts in by passing
     * viewmodelObjects to ActionRenderer3D.render(); existing scenes are unaffected.
     *
     * @param {RenderableObject[]} objects - viewmodel objects (already positioned in world space)
     * @param {ActionCamera} camera
     * @param {Object} [options]
     * @param {number} [options.near=0.05] - near plane for the viewmodel projection
     * @param {number} [options.far=1000]  - far plane for the viewmodel projection
     * @param {number} [options.fov]       - override FOV (defaults to camera.fov)
     */
    renderViewmodels(objects, camera, options = {}) {
        if (!objects || objects.length === 0) return;
        const gl = this.gl;

        const near = options.near !== undefined ? options.near : 0.05;
        const far = options.far !== undefined ? options.far : 1000.0;
        const fov = options.fov !== undefined ? options.fov : camera.fov;

        // Start a clean, isolated queue for this pass (the main pass already finalized).
        this._frameInitialized = false;
        this._drawQueue = [];
        const t = this.renderer ? this.renderer.currentTime : 0;
        for (const obj of objects) this.queue(obj, camera, t);

        // Build the dedicated viewmodel projection and install it as an override.
        if (!this._viewmodelProjection) this._viewmodelProjection = Matrix4.create();
        Matrix4.perspective(this._viewmodelProjection, fov, Game.WIDTH / Game.HEIGHT, near, far);
        this._projectionOverride = this._viewmodelProjection;

        // Clear depth only: keep the rendered color scene, but let the viewmodel own a
        // fresh depth range so it composites on top of everything.
        gl.clear(gl.DEPTH_BUFFER_BIT);

        this.drawObjects(camera); // opaque viewmodel triangles
        this.drawTransparent(camera); // transparent + _finalizeFrame()

        this._projectionOverride = null;
    }
}
