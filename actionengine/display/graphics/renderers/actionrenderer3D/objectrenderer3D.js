// actionengine/display/graphics/renderers/actionrenderer3D/objectrenderer3D.js
class ObjectRenderer3D {
    constructor(renderer, gl, programManager, lightManager) {
        this.renderer = renderer;
        this.gl = gl;
        this.programManager = programManager;
        this.lightManager = lightManager;

        this.indexType = this.gl.UNSIGNED_INT;

        // Cache for pre-computed uniform values
        this._uniformCache = {
            frame: -1,
            shaderProgram: null,
            camera: null,
            lightConfig: null,
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
        this._drawQueue.push({
            meshId: meshId,
            position: transform ? transform.position : { x: 0, y: 0, z: 0 },
            rotation: transform ? transform.rotation : { x: 0, y: 0, z: 0, w: 1 },
            scale: transform ? transform.scale || 1.0 : 1.0,
            alpha: object.alpha !== undefined ? object.alpha : 1.0,
            isStatic: object.isStatic
        });

        this.stats.objectsTotal++;
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
        const colors = new Float32Array(count * 9);
        const alphas = new Float32Array(count * 3);
        const uvs = new Float32Array(count * 6);
        const textureIndices = new Float32Array(count * 3);
        const useTextureFlags = new Float32Array(count * 3);

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

            const triNormal = triangle.normal;

            for (let v = 0; v < 3; v++) {
                const vert = triangle.vertices[v];
                const off = base + v * 3;
                positions[off] = vert.x;
                positions[off + 1] = vert.y;
                positions[off + 2] = vert.z;

                normals[off] = triNormal.x;
                normals[off + 1] = triNormal.y;
                normals[off + 2] = triNormal.z;

                colors[off] = r;
                colors[off + 1] = g;
                colors[off + 2] = b;

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
                } else if (triangle.texture) {
                    textureIndex = this.getTextureIndexForProceduralTexture(triangle.texture);
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
            }

            // Separate into opaque and transparent triangle indices
            if (triAlpha < 1.0) {
                transparentIndices.push(baseInd, baseInd + 1, baseInd + 2);
            } else {
                opaqueIndices.push(baseInd, baseInd + 1, baseInd + 2);
            }
        }

        const mesh = {
            buffers: {
                position: gl.createBuffer(),
                normal: gl.createBuffer(),
                color: gl.createBuffer(),
                alpha: gl.createBuffer(),
                uv: gl.createBuffer(),
                textureIndex: gl.createBuffer(),
                useTexture: gl.createBuffer(),
                indices: gl.createBuffer()
            },
            count: count * 3,
            hasTextures: meshHasTextures,
            opaqueIndices: opaqueIndices,
            transparentIndices: transparentIndices,
            opaqueCount: opaqueIndices.length,
            transparentCount: transparentIndices.length
        };

        const upload = (buf, data) => {
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, data, usage);
        };

        upload(mesh.buffers.position, positions);
        upload(mesh.buffers.normal, normals);
        upload(mesh.buffers.color, colors);
        upload(mesh.buffers.alpha, alphas);
        upload(mesh.buffers.uv, uvs);
        upload(mesh.buffers.textureIndex, textureIndices);
        upload(mesh.buffers.useTexture, useTextureFlags);

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

        this._meshLibrary.set(meshId, mesh);
    }

    /**
     * Update an existing mesh's vertex data (Dynamic Path)
     */
    updateStaticMesh(meshId, triangles) {
        const mesh = this._meshLibrary.get(meshId);
        if (!mesh) return;

        const gl = this.gl;
        const count = triangles.length;

        const positions = new Float32Array(count * 9);
        const normals = new Float32Array(count * 9);
        const colors = new Float32Array(count * 9);
        const alphas = new Float32Array(count * 3);
        const uvs = new Float32Array(count * 6);
        const textureIndices = new Float32Array(count * 3);
        const useTextureFlags = new Float32Array(count * 3);
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

                colors[off] = r;
                colors[off + 1] = g;
                colors[off + 2] = b;
                alphas[baseInd + v] = triAlpha;
            }

            const shouldUseTexture = (triangle.material && triangle.material.useTexture) || triangle.texture;
            let textureIndex = 0;
            if (shouldUseTexture) {
                if (triangle.material && triangle.material.useTexture && triangle.material.textureIndex >= 0) {
                    textureIndex = triangle.material.textureIndex;
                } else if (triangle.texture) {
                    textureIndex = this.getTextureIndexForProceduralTexture(triangle.texture);
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
            }

            // Separate into opaque and transparent triangle indices
            if (triAlpha < 1.0) {
                transparentIndices.push(baseInd, baseInd + 1, baseInd + 2);
            } else {
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
        update(mesh.buffers.color, colors);
        update(mesh.buffers.alpha, alphas);
        update(mesh.buffers.uv, uvs);
        update(mesh.buffers.textureIndex, textureIndices);
        update(mesh.buffers.useTexture, useTextureFlags);

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

        this.renderer.textureManager.updateMaterialPropertiesTexture();
        this._setFrameConstantUniforms(locs, prog, camera);

        // Draw all opaque triangles from all objects first
        this._drawEntryList(this._drawQueue, locs, camera);

        // Store all objects for transparent pass (we'll filter by mesh transparency)
        this._transparentQueue = this._drawQueue;
    }

    _drawEntryList(list, locs, camera) {
        const gl = this.gl;
        const ARRAY_BUFFER = gl.ARRAY_BUFFER;

        for (const entry of list) {
            const mesh = this._meshLibrary.get(entry.meshId);
            if (!mesh) continue;

            this.setupObjectShader(locs, camera, -1, entry.position, entry.rotation, entry.scale);

            gl.bindBuffer(ARRAY_BUFFER, mesh.buffers.position);
            gl.vertexAttribPointer(locs.position, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(locs.position);

            gl.bindBuffer(ARRAY_BUFFER, mesh.buffers.normal);
            gl.vertexAttribPointer(locs.normal, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(locs.normal);

            if (locs.color !== -1) {
                gl.bindBuffer(ARRAY_BUFFER, mesh.buffers.color);
                gl.vertexAttribPointer(locs.color, 3, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(locs.color);
            }
            if (locs.alpha !== -1) {
                gl.bindBuffer(ARRAY_BUFFER, mesh.buffers.alpha);
                gl.vertexAttribPointer(locs.alpha, 1, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(locs.alpha);
            }
            if (locs.texCoord !== -1) {
                gl.bindBuffer(ARRAY_BUFFER, mesh.buffers.uv);
                gl.vertexAttribPointer(locs.texCoord, 2, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(locs.texCoord);
            }
            if (locs.textureIndex !== -1) {
                gl.bindBuffer(ARRAY_BUFFER, mesh.buffers.textureIndex);
                gl.vertexAttribPointer(locs.textureIndex, 1, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(locs.textureIndex);
            }
            if (locs.useTexture !== -1) {
                gl.bindBuffer(ARRAY_BUFFER, mesh.buffers.useTexture);
                gl.vertexAttribPointer(locs.useTexture, 1, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(locs.useTexture);
            }

            // Draw only opaque triangles in this pass
            if (mesh.opaqueCount > 0) {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.buffers.indices);
                gl.drawElements(gl.TRIANGLES, mesh.opaqueCount, this.indexType, 0);
            }
        }
    }

    _drawTransparentList(list, locs, camera) {
        const gl = this.gl;
        const ARRAY_BUFFER = gl.ARRAY_BUFFER;

        for (const entry of list) {
            const mesh = this._meshLibrary.get(entry.meshId);
            if (!mesh || mesh.transparentCount === 0) continue;

            this.setupObjectShader(locs, camera, -1, entry.position, entry.rotation, entry.scale);

            gl.bindBuffer(ARRAY_BUFFER, mesh.buffers.position);
            gl.vertexAttribPointer(locs.position, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(locs.position);

            gl.bindBuffer(ARRAY_BUFFER, mesh.buffers.normal);
            gl.vertexAttribPointer(locs.normal, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(locs.normal);

            if (locs.color !== -1) {
                gl.bindBuffer(ARRAY_BUFFER, mesh.buffers.color);
                gl.vertexAttribPointer(locs.color, 3, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(locs.color);
            }
            if (locs.alpha !== -1) {
                gl.bindBuffer(ARRAY_BUFFER, mesh.buffers.alpha);
                gl.vertexAttribPointer(locs.alpha, 1, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(locs.alpha);
            }
            if (locs.texCoord !== -1) {
                gl.bindBuffer(ARRAY_BUFFER, mesh.buffers.uv);
                gl.vertexAttribPointer(locs.texCoord, 2, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(locs.texCoord);
            }
            if (locs.textureIndex !== -1) {
                gl.bindBuffer(ARRAY_BUFFER, mesh.buffers.textureIndex);
                gl.vertexAttribPointer(locs.textureIndex, 1, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(locs.textureIndex);
            }
            if (locs.useTexture !== -1) {
                gl.bindBuffer(ARRAY_BUFFER, mesh.buffers.useTexture);
                gl.vertexAttribPointer(locs.useTexture, 1, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(locs.useTexture);
            }

            // Draw transparent triangles starting after opaque indices
            const transparentOffset = mesh.opaqueCount * 4; // 4 bytes per uint32 index
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.buffers.indices);
            gl.drawElements(gl.TRIANGLES, mesh.transparentCount, this.indexType, transparentOffset);
        }
    }

    _finalizeFrame() {
        this._frameInitialized = false;
        this._drawQueue = [];
        this._transparentQueue = [];
    }

    updateUniformCache(camera) {
        const program = this.programManager.getObjectProgram();

        if (
            this._uniformCache.frame === this._frameCount &&
            this._uniformCache.shaderProgram === program &&
            this._uniformCache.camera === camera
        ) {
            return;
        }

        this._uniformCache.frame = this._frameCount;
        this._uniformCache.shaderProgram = program;
        this._uniformCache.camera = camera;

        Matrix4.perspective(this._uniformCache.matrices.projection, camera.fov, Game.WIDTH / Game.HEIGHT, 0.1, 10000.0);
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
        this._uniformCache.baseReflectivity = materialConfig.BASE_REFLECTIVITY.value;
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
        if (locations.pointShadowFarPlane !== -1 && locations.pointShadowFarPlane !== null) {
            gl.uniform1f(locations.pointShadowFarPlane, 500.0);
        }

        const config = this._uniformCache.lightConfig;
        const mainLightEnabled =
            this.lightManager.isMainDirectionalLightEnabled() && this.lightManager.getMainDirectionalLight() !== null;

        if (mainLightEnabled && locations.shadowsEnabled !== -1 && locations.shadowsEnabled !== null) {
            gl.uniform1i(locations.shadowsEnabled, 1);
        }
        if (locations.lightPos !== -1 && locations.lightPos !== null && mainLightEnabled && config && config.POSITION) {
            gl.uniform3fv(locations.lightPos, [config.POSITION.x, config.POSITION.y, config.POSITION.z]);
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

        if (locations.intensityFactor !== -1 && locations.intensityFactor !== null) {
            const currentVariant = this.programManager.getCurrentVariant();
            const factor =
                currentVariant === "default"
                    ? this.lightManager.constants.OBJECT_SHADER_DEFAULT_VARIANT_INTENSITY_FACTOR.value
                    : 1.0;
            gl.uniform1f(locations.intensityFactor, factor);
        }

        if (locations.roughness !== -1 && locations.roughness !== null)
            gl.uniform1f(locations.roughness, this._uniformCache.roughness);
        if (locations.metallic !== -1 && locations.metallic !== null)
            gl.uniform1f(locations.metallic, this._uniformCache.metallic);
        if (locations.baseReflectivity !== -1 && locations.baseReflectivity !== null)
            gl.uniform1f(locations.baseReflectivity, this._uniformCache.baseReflectivity);

        if (locations.usePerTextureMaterials !== -1 && locations.usePerTextureMaterials !== null) {
            const usePerTextureMaterials = this.renderer.textureManager?.usePerTextureMaterials || false;
            gl.uniform1i(locations.usePerTextureMaterials, usePerTextureMaterials ? 1 : 0);
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

        const texArray = this.renderer.textureManager.embeddedTextureArray || this.renderer.textureArray;
        if (texArray && locations.textureArray !== -1 && locations.textureArray !== null) {
            const isPBR = this.renderer.programManager.getCurrentVariant() === "pbr";
            this.renderer.glStateManager.bindTextureWithUniform(
                isPBR ? "textureArrayPBR" : "textureArray",
                texArray,
                "TEXTURE_2D_ARRAY",
                program,
                isPBR ? "uPBRTextureArray" : "uTextureArray"
            );
        }
    }

    setupObjectShader(
        locations,
        camera,
        unused_idx = -1,
        posOverride = null,
        rotOverride = null,
        scaleOverride = null
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
            gl.uniform1f(locations.modelScale, scale || 1.0);
        }

        this.stats.uniformSetCount++;
    }

    _setShadowUniforms() {
        const gl = this.gl;
        const locs = this.programManager.getShadowUniformLocations();
        const constants = this.lightManager.constants.SHADOW_FILTERING;

        if (locs.shadowSoftness !== null) gl.uniform1f(locs.shadowSoftness, constants.SOFTNESS.value);
        if (locs.pcfSize !== null) gl.uniform1i(locs.pcfSize, constants.PCF.SIZE.value);
        if (locs.pcfEnabled !== null) gl.uniform1i(locs.pcfEnabled, constants.PCF.ENABLED ? 1 : 0);
    }

    drawObject(locations, indexCount, offset = 0) {
        const gl = this.gl;
        gl.drawElements(gl.TRIANGLES, indexCount, this.indexType, offset);
    }

    getTextureIndexForProceduralTexture(proceduralTexture) {
        if (typeof textureRegistry === "undefined") return 0;
        if (!this._textureIndexCache) {
            this._textureIndexCache = new WeakMap();
            textureRegistry.textureList.forEach((name, index) => {
                const texture = textureRegistry.get(name);
                if (texture) this._textureIndexCache.set(texture, index);
            });
        }
        const index = this._textureIndexCache.get(proceduralTexture);
        if (index !== undefined) return index;

        const textureName = proceduralTexture.name;
        if (textureName) {
            const idx = textureRegistry.textureList.indexOf(textureName);
            if (idx !== -1) {
                this._textureIndexCache.set(proceduralTexture, idx);
                return idx;
            }
        }
        return 0;
    }

    drawTransparent(camera) {
        if (!this._transparentQueue || this._transparentQueue.length === 0) return;
        const gl = this.gl;
        const prog = this.programManager.getObjectProgram();
        const locs = this.programManager.getObjectLocations();
        gl.useProgram(prog);
        this._drawTransparentList(this._transparentQueue, locs, camera);
        this._finalizeFrame();
    }
}
