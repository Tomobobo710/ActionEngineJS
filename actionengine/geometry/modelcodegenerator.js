//actionengine/geometry/modelcodegenerator.js

/**
 * ModelCodeGenerator converts GLB models into ActionEngine Triangle-based code.
 * This outputs ActionEngine Model Format - clean Triangle[] code instead of base64.
 */
class ModelCodeGenerator {
    /**
     * Generate ActionEngine Triangle code from GLB file
     * @param {string} base64Data - GLB file as base64 string
     * @param {string} modelName - Name for the generated function
     * @param {Object} options - Generation options
     * @returns {string} Complete JavaScript code for the model
     */
    static generateFromGLB(base64Data, modelName = null, options = {}) {
        // Generate generic name if none provided
        if (!modelName) {
            const timestamp = Date.now().toString(36);
            modelName = `Model_${timestamp}`;
        }

        try {
            // Load GLB model using ActionEngine GLBLoader
            const glbModel = GLBLoader.loadModel(base64Data);

            // Generate Triangle-based code directly from GLB triangles
            return ModelCodeGenerator.generateTriangleCode(glbModel.triangles, modelName, options);
        } catch (error) {
            console.error("ActionEngine model code generation failed:", error);
            throw error;
        }
    }

    /**
     * Generate ActionEngine Triangle code from Triangle array
     * @param {Triangle[]} triangles - Array of Triangle objects
     * @param {string} modelName - Function name for the model
     * @param {Object} options - Code generation options
     * @returns {string} Complete JavaScript function code
     */
    static generateTriangleCode(triangles, modelName, options = {}) {
        const timestamp = new Date().toISOString();

        let code = `// Generated ActionEngine Model: ${modelName}\n`;
        code += `// Created: ${timestamp}\n`;
        code += `createTriangles() {\n`;
        code += `    return [\n`;

        triangles.forEach((triangle, i) => {
             const v1 = triangle.vertices[0];
             const v2 = triangle.vertices[1];
             const v3 = triangle.vertices[2];
             const color = triangle.color || "#808080";
             
             code += `        (() => {\n`;
             code += `            const tri = new Triangle(\n`;
             code += `                new Vector3(${v1.x.toFixed(6)}, ${v1.y.toFixed(6)}, ${v1.z.toFixed(6)}),\n`;
             code += `                new Vector3(${v2.x.toFixed(6)}, ${v2.y.toFixed(6)}, ${v2.z.toFixed(6)}),\n`;
             code += `                new Vector3(${v3.x.toFixed(6)}, ${v3.y.toFixed(6)}, ${v3.z.toFixed(6)}),\n`;
             code += `                "${color}"\n`;
             code += `            );\n`;
             
             // Serialize material/texture data if present
             if (triangle.material && triangle.material.textureIndex !== undefined) {
                 code += `            tri.material = { textureIndex: ${triangle.material.textureIndex} };\n`;
                 if (triangle.material.normalMapIndex !== undefined) {
                     code += `            tri.material.normalMapIndex = ${triangle.material.normalMapIndex};\n`;
                 }
             }
             
             // Serialize PBR material properties
             if (triangle.metallic !== undefined && triangle.metallic !== 0.0) {
                 code += `            tri.metallic = ${triangle.metallic.toFixed(6)};\n`;
             }
             if (triangle.roughness !== undefined && triangle.roughness !== 1.0) {
                 code += `            tri.roughness = ${triangle.roughness.toFixed(6)};\n`;
             }
             
             code += `            return tri;\n`;
             code += `        })()${i < triangles.length - 1 ? "," : ""}\n`;
         });

        code += `    ];\n`;
        code += `}\n`;

        return code;
    }

    /**
     * Export Triangle code as downloadable file
     * @param {Triangle[]} triangles - Array of Triangle objects
     * @param {string} modelName - Name for the model
     */
    static exportTriangleCode(triangles, modelName) {
        const code = ModelCodeGenerator.generateTriangleCode(triangles, modelName);

        // Download the file
        const blob = new Blob([code], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${modelName}.js`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Export GLB model as ActionEngine Triangle code
     * @param {string} base64Data - GLB file as base64 string
     * @param {string} modelName - Name for the model
     */
    static exportGLBAsCode(base64Data, modelName) {
        const glbModel = GLBLoader.loadModel(base64Data);
        ModelCodeGenerator.exportTriangleCode(glbModel.triangles, modelName);
    }

    // ============================================
    // PHASE 1: ActionModelPackage Export Methods
    // ============================================

    /**
     * Generate complete ActionModelPackage structure
     * @param {ActionModel3D|Triangle[]} modelData - ActionModel3D or Triangle array
     * @param {string} modelName - Name for the package (folder + registry key)
     * @param {string} version - Package version (default "1.0")
     * @returns {{files: Array, folderName: string}}
     *   files: [{path: "ModelIndex.js", code: "..."}, ...]
     *   folderName: "ModelName_v1.0"
     */
    static async generateActionModelPackage(modelData, modelName, version = "1.0", options = {}) {
        const onProgress = options.onProgress || (() => {});
        
        // Determine if ActionModel3D or just Triangle[]
        const isActionModel = modelData instanceof ActionModel3D;
        
        // Generate all files
        const files = [];
        
        // 1. Mesh files
        const meshFiles = await this.generateMeshFiles(modelData, options);
        files.push(...meshFiles);
        
        // 2. Materials (if ActionModel3D)
        if (isActionModel && modelData.objects && modelData.objects.length > 0) {
            files.push({
                path: "materials.js",
                code: this.generateMaterialsFile(modelData)
            });
        }
        
        // 3. Animations (if present)
        if (isActionModel && modelData.animations && modelData.animations.length > 0) {
            files.push({
                path: "animations.js",
                code: this.generateAnimationsFile(modelData)
            });
        }
        
        // 4. Textures (if present)
        if (isActionModel && modelData.textures && modelData.textures.length > 0) {
            files.push({
                path: "textures.js",
                code: this.generateTexturesFile(modelData)
            });
        }
        
        // 5. Metadata
        files.push({
            path: "metadata.json",
            code: this.generateMetadata(version)
        });
        
        // 6. ModelIndex (must be last, knows what files exist)
        files.push({
            path: "ModelIndex.js",
            code: this.generateModelIndex(
                modelName,
                meshFiles.map(f => ({ path: f.path, name: f.registryName })),
                isActionModel && modelData.animations && modelData.animations.length > 0,
                isActionModel && modelData.textures && modelData.textures.length > 0
            )
        });
        
        const folderName = `${modelName}_v${version}`;
        return { files, folderName };
    }

    /**
     * Generate mesh .js files
     * @param {ActionModel3D|Triangle[]} modelData
     * @returns {Promise<Array>} [{path: "meshes/body.js", code: "..."}, ...]
     */
    static async generateMeshFiles(modelData, options = {}) {
        const files = [];
        const onProgress = options.onProgress || (() => {});
        
        if (modelData instanceof ActionModel3D) {
            // Per-object: one file per RenderableObject
            for (let idx = 0; idx < modelData.objects.length; idx++) {
                const obj = modelData.objects[idx];
                const filename = obj.name || `object_${idx}`;
                const code = await this.generateSingleMeshFile(
                    filename,
                    obj.triangles,
                    obj.transform,
                    options
                );
                onProgress({ phase: 'meshfile', processed: idx + 1, total: modelData.objects.length });
                files.push({
                    path: `meshes/${filename}.js`,
                    registryName: filename,
                    code: code
                });
            }
        } else if (Array.isArray(modelData)) {
            // Single Triangle[] - one file for all
            const code = await this.generateSingleMeshFile(
                "mesh-data",
                modelData,
                null, // no transform
                options
            );
            onProgress({ phase: 'meshfile', processed: 1, total: 1 });
            files.push({
                path: "meshes/mesh-data.js",
                registryName: "mesh-data",
                code: code
            });
        }
        
        return files;
    }

    /**
     * Hash a material object to a number for deduplication
     * Avoids creating JSON strings - uses primitive values directly
     * @param {Object} mat - Material object
     * @returns {string} Hash as base36 string
     */
    static hashMaterial(mat) {
        let hash = 5381;
        for (const [key, val] of Object.entries(mat)) {
            // Hash key
            for (let i = 0; i < key.length; i++) {
                hash = ((hash << 5) - hash) + key.charCodeAt(i) | 0;
            }
            // Hash value directly without stringify
            if (typeof val === 'number') {
                hash = ((hash << 5) - hash) + (val * 1000 | 0) | 0;
            } else if (typeof val === 'string') {
                for (let i = 0; i < val.length; i++) {
                    hash = ((hash << 5) - hash) + val.charCodeAt(i) | 0;
                }
            } else if (Array.isArray(val)) {
                for (let i = 0; i < val.length; i++) {
                    hash = ((hash << 5) - hash) + (typeof val[i] === 'number' ? (val[i] * 1000 | 0) : 0) | 0;
                }
            } else if (typeof val === 'object' && val !== null) {
                // For complex objects, hash their keys
                for (const k of Object.keys(val)) {
                    for (let i = 0; i < k.length; i++) {
                        hash = ((hash << 5) - hash) + k.charCodeAt(i) | 0;
                    }
                }
            }
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Generate single mesh .js file
     * @param {string} objectName
     * @param {Triangle[]} triangles
     * @param {Transform} transform - or null
     * @returns {Promise<string>} JavaScript code
     */
    static async generateSingleMeshFile(objectName, triangles, transform, options = {}) {
        const batchSize = options.batchSize || 50000;  // Larger batches = fewer yields
        const yieldInterval = options.yieldInterval || 10000;  // Yield every 10k triangles (still responsive, much faster)
        const onProgress = options.onProgress || (() => {});
        
        const code = []; // Use array instead of string
        code.push(`// Mesh: ${objectName}\n`);
        code.push(`// Generated: ${new Date().toISOString()}\n\n`);
        
        // Deduplicate materials in batches
        const materialMap = new Map(); // key -> materialId
        const materials = [];
        const triangleMaterials = []; // materialId for each triangle
        
        // Process dedup in ONE pass without unnecessary yields
        for (let j = 0; j < triangles.length; j++) {
            const triangle = triangles[j];
            const matObj = {};
            if (triangle.material) {
                if (triangle.material.useTexture !== undefined) matObj.useTexture = triangle.material.useTexture;
                if (triangle.material.textureIndex !== undefined) matObj.textureIndex = triangle.material.textureIndex;
                if (triangle.material.normalMapIndex !== undefined) matObj.normalMapIndex = triangle.material.normalMapIndex;
                if (triangle.material.metallicRoughnessMapIndex !== undefined) matObj.metallicRoughnessMapIndex = triangle.material.metallicRoughnessMapIndex;
                if (triangle.material.emissiveMapIndex !== undefined) matObj.emissiveMapIndex = triangle.material.emissiveMapIndex;
            }
            if (triangle.alpha !== undefined && triangle.alpha !== 1.0) matObj.alpha = triangle.alpha;
            if (triangle.metallic !== undefined && triangle.metallic !== 0.0) matObj.metallic = triangle.metallic;
            if (triangle.roughness !== undefined && triangle.roughness !== 1.0) matObj.roughness = triangle.roughness;
            if (triangle.emissive !== undefined && triangle.emissive.some(v => v !== 0)) matObj.emissive = triangle.emissive;
            if (triangle.transmission !== undefined && triangle.transmission !== 0.0) matObj.transmission = triangle.transmission;
            if (triangle.ior !== undefined && triangle.ior !== 1.5) matObj.ior = triangle.ior;
            if (triangle.volume && (triangle.volume.thicknessFactor !== 0 || triangle.volume.attenuationDistance !== 1.0 || triangle.volume.attenuationColor.some(v => v !== 1))) matObj.volume = triangle.volume;
            if (triangle.sheen && (triangle.sheen.colorFactor.some(v => v !== 0) || triangle.sheen.roughnessFactor !== 0)) matObj.sheen = triangle.sheen;
            if (triangle.clearcoat && (triangle.clearcoat.factor !== 0 || triangle.clearcoat.roughnessFactor !== 0)) matObj.clearcoat = triangle.clearcoat;
            if (triangle.anisotropy && (triangle.anisotropy.strength !== 0 || triangle.anisotropy.rotation !== 0)) matObj.anisotropy = triangle.anisotropy;
            if (triangle.dispersion !== undefined && triangle.dispersion !== 0.0) matObj.dispersion = triangle.dispersion;
            if (triangle.iridescence && (triangle.iridescence.factor !== 0 || triangle.iridescence.thickness !== 0)) matObj.iridescence = triangle.iridescence;
            
            const key = this.hashMaterial(matObj);
            let matId = materialMap.get(key);
            if (matId === undefined) {
                matId = materials.length;
                materialMap.set(key, matId);
                materials.push(matObj);
            }
            triangleMaterials.push(matId);
            
            // Yield control occasionally during dedup
            if (j > 0 && j % yieldInterval === 0) {
                onProgress({ phase: 'dedup', processed: j, total: triangles.length });
                await new Promise(r => setTimeout(r, 0));
            }
        }
        
        code.push(`(function() {\n`);
        code.push(`    const meshData = {\n`);
        code.push(`    name: "${objectName}",\n`);
        code.push(`    triangles: [\n`);
        
        // Process triangle output - yield every 1000 triangles
        for (let j = 0; j < triangles.length; j++) {
            const triangle = triangles[j];
            const v1 = triangle.vertices[0];
            const v2 = triangle.vertices[1];
            const v3 = triangle.vertices[2];
            const color = triangle.color || "#808080";
            
            code.push(`        new Triangle(\n`);
            code.push(`            new Vector3(${v1.x.toFixed(6)}, ${v1.y.toFixed(6)}, ${v1.z.toFixed(6)}),\n`);
            code.push(`            new Vector3(${v2.x.toFixed(6)}, ${v2.y.toFixed(6)}, ${v2.z.toFixed(6)}),\n`);
            code.push(`            new Vector3(${v3.x.toFixed(6)}, ${v3.y.toFixed(6)}, ${v3.z.toFixed(6)}),\n`);
            code.push(`            "${color}"\n`);
            code.push(`        )${j < triangles.length - 1 ? "," : ""}\n`);
            
            // Yield control occasionally
            if (j > 0 && j % yieldInterval === 0) {
                onProgress({ phase: 'triangles', processed: j, total: triangles.length });
                await new Promise(r => setTimeout(r, 0));
            }
        }
        
        code.push(`    ],\n`);
         
         // Add materials array
         code.push(`    materials: [\n`);
         for (let idx = 0; idx < materials.length; idx++) {
             const mat = materials[idx];
             const matProps = [];
             Object.entries(mat).forEach(([key, val]) => {
                 if (typeof val === 'string') {
                     matProps.push(`${key}: "${val}"`);
                 } else if (Array.isArray(val)) {
                     matProps.push(`${key}: [${val.map(v => v.toFixed(6)).join(', ')}]`);
                 } else if (typeof val === 'number') {
                     matProps.push(`${key}: ${val.toFixed(6)}`);
                 } else {
                     matProps.push(`${key}: ${val}`);
                 }
             });
             code.push(`        { ${matProps.join(', ')} }${idx < materials.length - 1 ? "," : ""}\n`);
         }
         code.push(`    ],\n`);
         
         // Add triangle material indices
         code.push(`    triangleMaterials: [${triangleMaterials.join(', ')}],\n`);
         
         code.push(`    uvs: [\n`);
          
         // Process UVs - yield every 1000 triangles
         for (let j = 0; j < triangles.length; j++) {
             const triangle = triangles[j];
             if (triangle.uvs) {
                 code.push(`        [\n`);
                 triangle.uvs.forEach((uv, k) => {
                     code.push(`            { u: ${uv.u.toFixed(6)}, v: ${uv.v.toFixed(6)} }${k < triangle.uvs.length - 1 ? "," : ""}\n`);
                 });
                 code.push(`        ]${j < triangles.length - 1 ? "," : ""}\n`);
             } else {
                 code.push(`        null${j < triangles.length - 1 ? "," : ""}\n`);
             }
             
             // Yield control occasionally
             if (j > 0 && j % yieldInterval === 0) {
                 onProgress({ phase: 'uvs', processed: j, total: triangles.length });
                 await new Promise(r => setTimeout(r, 0));
             }
         }
          
         code.push(`    ],\n`);
         
         // Add vertex normals as typed array (only if any triangle has them)
          const hasVertexNormals = triangles.some(t => t.vertexNormals && t.vertexNormals.length === 3);
          if (hasVertexNormals) {
              code.push(`    vertexNormals: new Float32Array([`);
              let normalsStr = '';
              for (let j = 0; j < triangles.length; j++) {
                  const triangle = triangles[j];
                  if (triangle.vertexNormals && triangle.vertexNormals.length === 3) {
                      triangle.vertexNormals.forEach((normal) => {
                          if (normalsStr) normalsStr += ', ';
                          normalsStr += normal.x.toFixed(6) + ', ' + normal.y.toFixed(6) + ', ' + normal.z.toFixed(6);
                      });
                  } else {
                      if (normalsStr) normalsStr += ', ';
                      normalsStr += '0, 0, 0, 0, 0, 0, 0, 0, 0';
                  }
                  
                  // Yield control occasionally
                  if (j > 0 && j % yieldInterval === 0) {
                      onProgress({ phase: 'normals', processed: j, total: triangles.length });
                      await new Promise(r => setTimeout(r, 0));
                  }
              }
              code.push(normalsStr + `]),\n`);
          }
          
          // Add tangent vectors as typed array (only if any triangle has them)
          const hasTangents = triangles.some(t => t.tangents && t.tangents.length === 3);
          if (hasTangents) {
              code.push(`    tangents: new Float32Array([`);
              let tangentsStr = '';
              for (let j = 0; j < triangles.length; j++) {
                  const triangle = triangles[j];
                  if (triangle.tangents && triangle.tangents.length === 3) {
                      triangle.tangents.forEach((tangent) => {
                          if (tangentsStr) tangentsStr += ', ';
                          tangentsStr += tangent.x.toFixed(6) + ', ' + tangent.y.toFixed(6) + ', ' + tangent.z.toFixed(6);
                      });
                  } else {
                      if (tangentsStr) tangentsStr += ', ';
                      tangentsStr += '0, 0, 0, 0, 0, 0, 0, 0, 0';
                  }
                  
                  // Yield control occasionally
                  if (j > 0 && j % yieldInterval === 0) {
                      onProgress({ phase: 'tangents', processed: j, total: triangles.length });
                      await new Promise(r => setTimeout(r, 0));
                  }
              }
              code.push(tangentsStr + `]),\n`);
          }
         
         // Add skeletal animation data as sparse arrays (only store triangles that have it)
         const hasJointData = triangles.some(t => t.jointData && t.jointData.length === 3);
         if (hasJointData) {
             let jointStr = '';
             let indicesStr = '';
             for (let j = 0; j < triangles.length; j++) {
                 const triangle = triangles[j];
                 if (triangle.jointData && triangle.jointData.length === 3) {
                     if (indicesStr) indicesStr += ', ';
                     indicesStr += j;
                     triangle.jointData.forEach((ji) => {
                         if (jointStr) jointStr += ', ';
                         jointStr += ji[0] + ', ' + ji[1] + ', ' + ji[2] + ', ' + ji[3];
                     });
                 }
                 
                 // Yield control occasionally
                 if (j > 0 && j % yieldInterval === 0) {
                     onProgress({ phase: 'joints', processed: j, total: triangles.length });
                     await new Promise(r => setTimeout(r, 0));
                 }
             }
             code.push(`    jointData: new Uint32Array([` + jointStr + `]),\n`);
             code.push(`    jointDataTriangleIndices: new Uint32Array([` + indicesStr + `]),\n`);
         }
         
         // Add weight data as sparse array (only store triangles that have it)
         const hasWeightData = triangles.some(t => t.weightData && t.weightData.length === 3);
         if (hasWeightData) {
             let weightStr = '';
             let weightIndicesStr = '';
             for (let j = 0; j < triangles.length; j++) {
                 const triangle = triangles[j];
                 if (triangle.weightData && triangle.weightData.length === 3) {
                     if (weightIndicesStr) weightIndicesStr += ', ';
                     weightIndicesStr += j;
                     triangle.weightData.forEach((w) => {
                         if (weightStr) weightStr += ', ';
                         weightStr += w[0].toFixed(6) + ', ' + w[1].toFixed(6) + ', ' + w[2].toFixed(6) + ', ' + w[3].toFixed(6);
                     });
                 }
                 
                 // Yield control occasionally
                 if (j > 0 && j % yieldInterval === 0) {
                     onProgress({ phase: 'weights', processed: j, total: triangles.length });
                     await new Promise(r => setTimeout(r, 0));
                 }
             }
             code.push(`    weightData: new Float32Array([` + weightStr + `]),\n`);
             code.push(`    weightDataTriangleIndices: new Uint32Array([` + weightIndicesStr + `]),\n`);
         }
         
         // Add transform if present
         if (transform) {
            code.push(`    transform: {\n`);
            code.push(`        position: { x: ${transform.position.x.toFixed(6)}, y: ${transform.position.y.toFixed(6)}, z: ${transform.position.z.toFixed(6)} },\n`);
            code.push(`        rotation: { x: ${transform.rotation.x.toFixed(6)}, y: ${transform.rotation.y.toFixed(6)}, z: ${transform.rotation.z.toFixed(6)}, w: ${transform.rotation.w.toFixed(6)} },\n`);
            code.push(`        scale: { x: ${transform.scale.x.toFixed(6)}, y: ${transform.scale.y.toFixed(6)}, z: ${transform.scale.z.toFixed(6)} }\n`);
            code.push(`    }\n`);
         }
         
         code.push(`};\n`);
         code.push(`\n`);
         code.push(`    ModelRegistry.registerModule('${objectName}', meshData);\n`);
         code.push(`})();\n`);
         
         return code.join('');
    }

    /**
     * Generate materials.js
     * For now, this is a placeholder
     * Materials are stored per-triangle in the future
     * @param {ActionModel3D} model
     * @returns {string} JavaScript code
     */
    static generateMaterialsFile(model) {
        let code = `// Material data\n`;
        code += `// Generated: ${new Date().toISOString()}\n\n`;
        code += `const materialData = [];\n`;
        code += `\n`;
        code += `ModelRegistry.registerModule('materials', materialData);\n`;
        return code;
    }

    /**
     * Generate animations.js
     * Serialize Animation objects to plain data
     * Complete serialization of all animation channels and samplers
     * @param {ActionModel3D} model
     * @returns {string} JavaScript code
     */
    static generateAnimationsFile(model) {
        let code = `// Animation data - Complete animation tracks for skeletal/keyframe animations\n`;
        code += `// Generated: ${new Date().toISOString()}\n\n`;
        code += `(function() {\n`;
        code += `    const animationData = [\n`;
        
        model.animations.forEach((anim, animIdx) => {
            code += `    {\n`;
            code += `        name: "${anim.name || `animation_${animIdx}`}",\n`;
            code += `        duration: ${anim.duration || 1.0},\n`;
            code += `        channels: [\n`;
            
            // Serialize channels - map sampler object references to indices
            const channels = anim.channels || [];
            channels.forEach((channel, chIdx) => {
                // Extract channel target information
                // channel structure: { sampler: AnimationSampler, targetNode: number, targetPath: string }
                const nodeIndex = channel.targetNode !== undefined ? channel.targetNode : 0;
                const pathStr = channel.targetPath || "translation";
                
                // Find sampler index by reference
                let samplerIndex = 0;
                if (channel.sampler && anim.samplers) {
                    samplerIndex = anim.samplers.indexOf(channel.sampler);
                    if (samplerIndex === -1) samplerIndex = 0;
                }
                
                code += `            {\n`;
                code += `                nodeIndex: ${nodeIndex},\n`;
                code += `                path: "${pathStr}",\n`;
                code += `                sampler: ${samplerIndex}\n`;
                code += `            }${chIdx < (channels.length - 1) ? "," : ""}\n`;
            });
            
            code += `        ],\n`;
            code += `        samplers: [\n`;
            
            // Serialize samplers - convert Float32Array to regular arrays
            const samplers = anim.samplers || [];
            samplers.forEach((sampler, sampIdx) => {
                // sampler structure: { times: Float32Array, values: Float32Array, interpolation: string, duration: number }
                let inputTimesStr = "";
                let outputValuesStr = "";
                let interpolation = "LINEAR";
                
                if (sampler) {
                    // Convert times array to string
                    if (sampler.times) {
                        const timesArray = Array.from(sampler.times);
                        inputTimesStr = timesArray.map(t => parseFloat(t.toFixed(6))).join(", ");
                    }
                    
                    // Convert values array to grouped output values
                    if (sampler.values) {
                        const valuesArray = Array.from(sampler.values);
                        // Determine how many values per keyframe (3 for translation/scale, 4 for rotation)
                        const numKeyframes = sampler.times ? sampler.times.length : 1;
                        const valuesPerKeyframe = Math.floor(valuesArray.length / numKeyframes);
                        
                        const outputGroups = [];
                        for (let i = 0; i < numKeyframes; i++) {
                            const startIdx = i * valuesPerKeyframe;
                            const endIdx = startIdx + valuesPerKeyframe;
                            const group = valuesArray.slice(startIdx, endIdx)
                                .map(v => parseFloat(v.toFixed(6)));
                            outputGroups.push(`[${group.join(", ")}]`);
                        }
                        outputValuesStr = outputGroups.join(", ");
                    }
                    
                    // Get interpolation method
                    if (sampler.interpolation) {
                        interpolation = sampler.interpolation;
                    }
                }
                
                code += `            {\n`;
                code += `                inputTimes: [${inputTimesStr}],\n`;
                code += `                outputValues: [${outputValuesStr}],\n`;
                code += `                interpolation: "${interpolation}"\n`;
                code += `            }${sampIdx < (samplers.length - 1) ? "," : ""}\n`;
            });
            
            code += `        ]\n`;
            code += `    }${animIdx < model.animations.length - 1 ? "," : ""}\n`;
        });
        
        code += `];\n`;
        code += `\n`;
        code += `ModelRegistry.registerModule('animations', animationData);\n`;
        code += `})();\n`;
        return code;
    }

    /**
     * Generate textures.js
     * Convert binary texture data to base64 data URLs
     * Handles both binary (Uint8Array/ArrayBuffer) and string (base64) formats
     * @param {ActionModel3D} model
     * @returns {string} JavaScript code
     */
    static generateTexturesFile(model) {
        let code = `// Texture data - Base64 encoded image data URLs\n`;
        code += `// Generated: ${new Date().toISOString()}\n`;
        code += `// To decode: const base64 = dataUrl.split(',')[1]; const bytes = new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));\n\n`;
        code += `(function() {\n`;
        code += `    const textureData = [\n`;
        
        model.textures.forEach((textureData, idx) => {
            const metadata = model.textureMetadata?.[idx] || {};
            const mimeType = metadata.mimeType || "image/png";
            const name = metadata.name || `texture_${idx}`;
            
            // Convert various texture formats to base64
            let base64 = "";
            
            if (textureData instanceof Uint8Array) {
                // Binary Uint8Array - convert to base64
                // Use String.fromCharCode in chunks to avoid call stack overflow for large arrays
                const chunkSize = 65536;
                let binaryString = "";
                for (let i = 0; i < textureData.length; i += chunkSize) {
                    const chunk = textureData.slice(i, i + chunkSize);
                    binaryString += String.fromCharCode.apply(null, Array.from(chunk));
                }
                base64 = btoa(binaryString);
            } else if (textureData instanceof ArrayBuffer) {
                // ArrayBuffer - convert to Uint8Array first, then to base64
                const uint8Array = new Uint8Array(textureData);
                const chunkSize = 65536;
                let binaryString = "";
                for (let i = 0; i < uint8Array.length; i += chunkSize) {
                    const chunk = uint8Array.slice(i, i + chunkSize);
                    binaryString += String.fromCharCode.apply(null, Array.from(chunk));
                }
                base64 = btoa(binaryString);
            } else if (typeof textureData === 'string') {
                // Already base64 string
                base64 = textureData;
            } else {
                // Unknown format - try to convert to JSON
                console.warn(`generateTexturesFile: Unexpected texture data type at index ${idx}`);
                base64 = btoa(JSON.stringify(textureData));
            }
            
            // Create data URL for immediate use in browser
            const dataUrl = `data:${mimeType};base64,${base64}`;
            
            code += `    {\n`;
            code += `        name: "${name}",\n`;
            code += `        mimeType: "${mimeType}",\n`;
            code += `        imageData: "${dataUrl}"\n`;
            code += `    }${idx < model.textures.length - 1 ? "," : ""}\n`;
        });
        
        code += `];\n`;
        code += `\n`;
        code += `ModelRegistry.registerModule('textures', textureData);\n`;
        code += `})();\n`;
        return code;
    }

    /**
     * Generate ModelIndex.js (bootstrap file)
     * @param {string} modelName
     * @param {string[]} meshFilePaths - relative paths like "meshes/body.js"
     * @param {boolean} hasAnimations
     * @param {boolean} hasTextures
     * @returns {string} JavaScript code
     */
    static generateModelIndex(modelName, meshFileInfo, hasAnimations, hasTextures) {
        let code = `// ActionModelPackage Bootstrap\n`;
        code += `// Model: ${modelName}\n`;
        code += `// Generated: ${new Date().toISOString()}\n\n`;
        code += `(async function() {\n`;
        code += `    // Get current script directory for relative loading\n`;
        code += `    const scriptUrl = document.currentScript ? document.currentScript.src : '';\n`;
        code += `    const scriptDir = scriptUrl.substring(0, scriptUrl.lastIndexOf('/') + 1);\n`;
        code += `\n`;
        code += `    // Load script helper\n`;
        code += `    function loadScript(path) {\n`;
        code += `        return new Promise((resolve, reject) => {\n`;
        code += `            const script = document.createElement('script');\n`;
        code += `            script.src = scriptDir + path;\n`;
        code += `            script.onload = resolve;\n`;
        code += `            script.onerror = () => reject(new Error('Failed to load: ' + script.src));\n`;
        code += `            document.head.appendChild(script);\n`;
        code += `        });\n`;
        code += `    }\n`;
        code += `    \n`;
        code += `    try {\n`;
        code += `        // Chainload all mesh files\n`;
        meshFileInfo.forEach((info) => {
            code += `        await loadScript('${info.path}');\n`;
        });
        
        if (hasAnimations) {
            code += `        await loadScript('animations.js');\n`;
        }
        
        if (hasTextures) {
            code += `        await loadScript('textures.js');\n`;
        }
        
        code += `        \n`;
        code += `        // Reconstruct ActionModel3D using ActionModelPackageLoader\n`;
         
         const meshFileInfoJSON = JSON.stringify(meshFileInfo, null, 4);
        
        code += `        const meshFileInfo = ${meshFileInfoJSON};\n`;
        code += `        ActionModelPackageLoader.reconstruct("${modelName}", meshFileInfo, {\n`;
        code += `            hasAnimations: ${hasAnimations},\n`;
        code += `            hasTextures: ${hasTextures}\n`;
        code += `        });\n`;
        code += `    } catch (error) {\n`;
        code += `        console.error('Failed to load ActionModelPackage: ${modelName}', error);\n`;
        code += `        throw error;\n`;
        code += `    }\n`;
        code += `})();\n`;
        
        return code;
    }

    /**
     * Generate metadata.json
     * Includes version information for compatibility checking
     * @param {string} version - Package version (e.g., "1.0")
     * @returns {string} JSON string with metadata
     */
    static generateMetadata(version) {
        const metadata = {
            // Package version for user tracking
            version: version,
            
            // ActionModelPackage format version (increment when format changes)
            packageFormatVersion: "1.0",
            
            // ActionEngine version this was generated with
            actionEngineVersion: "2.0",
            
            // Generation timestamp
            generated: new Date().toISOString(),
            
            // Compatibility notes for future versions
            compatibility: {
                minPackageFormatVersion: "1.0",
                maxPackageFormatVersion: "1.0",
                minActionEngineVersion: "2.0"
            },
            
            // Format documentation
            notes: {
                animations: "Animation data serialized with channels and samplers, compatible with Animation class",
                textures: "Texture data encoded as base64 data URLs, decoded to Uint8Array on load",
                meshes: "Mesh data stored as Triangle arrays with transform metadata",
                models: "Complete ActionModel3D structure including nodes, skins, and hierarchy"
            }
        };
        return JSON.stringify(metadata, null, 2);
    }

    /**
     * Create ZIP from files and trigger download
     * @param {Array} files - [{path, code}, ...]
     * @param {string} folderName - output folder name inside ZIP
     * @returns {Promise<void>}
     */
    static async createZipFromFiles(files, folderName) {
        const zip = new ActionZip();
        
        // Add all files with folder prefix
        files.forEach(file => {
            const fullPath = `${folderName}/${file.path}`;
            zip.addFile(fullPath, file.code);
        });
        
        // Download
        zip.download(`${folderName}.zip`);
    }

    /**
     * Export ActionModel3D or Triangle[] as ActionModelPackage ZIP
     * @param {ActionModel3D|Triangle[]} modelData
     * @param {string} modelName
     * @param {string} version
     * @returns {Promise<void>}
     */
    static async exportActionModelAsZip(modelData, modelName, version = "1.0", options = {}) {
        try {
            console.log(`Exporting ActionModelPackage: ${modelName} v${version}...`);
            const { files, folderName } = await this.generateActionModelPackage(
                modelData,
                modelName,
                version,
                options
            );
            await this.createZipFromFiles(files, folderName);
            console.log(`ActionModelPackage exported: ${folderName}.zip`);
        } catch (error) {
            console.error("ActionModelPackage export failed:", error);
            throw error;
        }
    }
}
