//actionengine/gl/programmanager.js
class ProgramManager {
    constructor(gl) {
        this.gl = gl;

        // Current active variant
        this.currentVariant = "default";

        // Store shader programs
        this.objectProgram = null;
        this.objectLocations = {};
        this.particleProgram = null;
        this.waterProgram = null;
        this.lineProgram = null;

        // Store locations for different shader programs
        this.particleLocations = {};
        this.waterLocations = {};
        this.lineLocations = {};

        // Cache shadow-related uniform locations for all shaders
        this.shadowUniformLocations = {
            shadowSoftness: null,
            shadowSlopeScaleBias: null,
            shadowSlopeClamp: null,
            shadowPcssMax: null,
            pcfSize: null,
            pcfEnabled: null
        };

        // Shader instances
        this.objectShader = null;
        this.lineShader = null;

        // Debug visualization buffers
        this.debugQuadBuffer = null;
        this.debugBackgroundBuffer = null;

        // Attribute and uniform name mappings
        this.attributeNames = {
            position: "aPosition",
            normal: "aNormal",
            tangent: "aTangent",
            color: "aColor",
            alpha: "aAlpha",
            texCoord: "aTexCoord",
            textureIndex: "aTextureIndex",
            useTexture: "aUseTexture",
            normalMapIndex: "aNormalMapIndex",
            metallicRoughnessMapIndex: "aMetallicRoughnessMapIndex",
            emissiveMapIndex: "aEmissiveMapIndex",
            boneIndices: "aBoneIndices",
            boneWeights: "aBoneWeights"
        };

        this.uniformNames = {
            projectionMatrix: "uProjectionMatrix",
            viewMatrix: "uViewMatrix",
            modelPos: "uModelPos",
            modelRotation: "uModelRotation",
            modelScale: "uModelScale",
            lightDir: "uLightDir",
            lightIntensity: "uLightIntensity",
            pointLightIntensity: "uPointLightIntensity",
            roughness: "uRoughness",
            metallic: "uMetallic",
            ior: "uIOR",
            cameraPos: "uCameraPos",
            time: "uTime",
            lightSpaceMatrix: "uLightSpaceMatrix",
            shadowMap: "uShadowMap",
            shadowsEnabled: "uShadowsEnabled",
            farPlane: "uFarPlane",
            boneMatrices: "uBoneMatrices"
        };

        this.textureUniforms = {
            textureArray: "uTextureArray",
            shadowMap: "uShadowMap",
            materialProps: "uMaterialPropertiesTexture"
        };

        // Initialize all shaders
        this.initializeSpecialShaders();
        this.initializeObjectShader();
    }

    /**
     * Create a shader program
     */
    createShaderProgram(vsSource, fsSource, shaderName = "unknown") {
        try {
            // Try to compile the vertex shader
            const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vsSource, `${shaderName} vertex`);

            // Try to compile the fragment shader
            const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fsSource, `${shaderName} fragment`);

            const program = this.gl.createProgram();
            this.gl.attachShader(program, vertexShader);
            this.gl.attachShader(program, fragmentShader);
            this.gl.linkProgram(program);

            // After successful linking:
            if (program) {
                // Set explicit texture sampler bindings to prevent location conflicts
                this.assignExplicitSamplerBindings(program);
            }

            if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
                const info = this.gl.getProgramInfoLog(program);
                console.error(`==== SHADER LINK ERROR FOR '${shaderName}' ====`);
                console.error(info);
                console.error("==== VERTEX SHADER SOURCE ====");
                console.error(vsSource);
                console.error("==== FRAGMENT SHADER SOURCE ====");
                console.error(fsSource);
                throw new Error(`Shader program '${shaderName}' failed to link: ${info}`);
            }

            // Clean up shaders after linking
            this.gl.deleteShader(vertexShader);
            this.gl.deleteShader(fragmentShader);

            return program;
        } catch (error) {
            console.error(`Error creating shader program '${shaderName}': ${error.message}`);
            throw error;
        }
    }

    /**
     * Assigns explicit texture units to sampler uniforms to prevent WebGL sampler location conflicts.
     *
     * BACKGROUND: WebGL has a critical requirement where different sampler types
     * (sampler2D, samplerCube, sampler2DArray) cannot share the same texture unit
     * if they're used in the same shader program during a draw call. If not handled
     * properly, it causes the error:
     * "GL_INVALID_OPERATION: Two textures of different types use the same sampler location"
     *
     * WHY THIS HAPPENS: When WebGL compiles a shader program, it assigns internal memory
     * locations to samplers. Sometimes the compiler optimizes by sharing locations, which
     * can cause conflicts between DIFFERENT sampler TYPES.......
     *
     * KEY POINTS:
     * - This only becomes an issue when mixing different sampler types
     * - You MUST call this after program linking - calling earlier has no effect
     * - Only texture samplers need this explicit assignment, not regular uniforms
     * - The texture units used (0, 1, etc.) aren't as important as using different ones
     *   for different sampler types, but it's advised to use the same units, and unit 0
     *   will be selected when webgl handles automatic texture unit assignment
     * - This hurt brain a lot
     *
     * @param {WebGLProgram} program - The linked shader program
     */
    assignExplicitSamplerBindings(program) {
        this.gl.useProgram(program);

        // WEBGL SAMPLER CONFLICT RESOLUTION:
        // 1. Group samplers by type (2D, Cube, Array)
        // 2. Assign consecutive units within each type group
        // 3. Ensure large gaps between different sampler types

        // Define dedicated texture units for each sampler type
        const samplerUniforms = [
            // GROUP 1: 2D TEXTURES (units 0-7)
            // Regular 2D textures - TEXTURE_2D type
            { name: "uMaterialPropertiesTexture", unit: 0 }, // Material properties
            { name: "uDirectionalLightData", unit: 1 }, // Directional light data
            { name: "uPointLightData", unit: 2 }, // Point light data
            { name: "uShadowMap", unit: 3 }, // Directional shadow map

            // GROUP 2: CUBEMAP TEXTURES (units 10-19) - Large gap to prevent conflicts
            // Cubemap texture samplers - TEXTURE_CUBE_MAP type
            { name: "uPointShadowMap", unit: 10 }, // First point shadow map
            { name: "uPointShadowMap1", unit: 11 }, // Second point shadow map
            { name: "uPointShadowMap2", unit: 12 }, // Third point shadow map
            { name: "uPointShadowMap3", unit: 13 }, // Fourth point shadow map

            // GROUP 3: TEXTURE ARRAYS (units 20-29) - Large gap to prevent conflicts
            // Texture array sampler - TEXTURE_2D_ARRAY type
            { name: "uTextureArray", unit: 20 } // Consolidated texture array for all shaders
        ];

        // Assign each sampler to its dedicated texture unit
        // This forces WebGL to use separate internal locations for different sampler types
        for (const { name, unit } of samplerUniforms) {
            const loc = this.gl.getUniformLocation(program, name);
            if (loc !== null) {
                this.gl.uniform1i(loc, unit);
            }
        }
    }

    /**
     * Compile a shader
     */
    compileShader(type, source, shaderLabel = "unknown") {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const info = this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);

            // Print detailed error information
            console.error(`==== SHADER COMPILE ERROR FOR '${shaderLabel}' ====`);
            console.error(info);

            // Print the source code with line numbers
            const sourceLines = source.split("\n");
            console.error("==== SHADER SOURCE ====");
            sourceLines.forEach((line, index) => {
                console.error(`${index + 1}: ${line}`);
            });

            // Analyze error message for line numbers
            let lineNumber = -1;
            const lineMatch = info.match(/\d+:(\d+)/);
            if (lineMatch && lineMatch[1]) {
                lineNumber = parseInt(lineMatch[1]);
                if (lineNumber > 0 && lineNumber <= sourceLines.length) {
                    console.error("==== PROBLEMATIC LINE ====");
                    console.error(`${lineNumber}: ${sourceLines[lineNumber - 1]}`);

                    // Show context (lines before and after)
                    console.error("==== CONTEXT ====");
                    const startLine = Math.max(0, lineNumber - 3);
                    const endLine = Math.min(sourceLines.length, lineNumber + 2);
                    for (let i = startLine; i < endLine; i++) {
                        const prefix = i === lineNumber - 1 ? "> " : "  ";
                        console.error(`${prefix}${i + 1}: ${sourceLines[i]}`);
                    }
                }
            }

            throw new Error(`Shader compile error in '${shaderLabel}': ${info}`);
        }

        return shader;
    }

    /**
     * Initialize the object shader
     */
    initializeObjectShader() {
        console.log("[ProgramManager] Initializing object shader");

        try {
            // Create a new ObjectShader instance
            this.objectShader = new ObjectShader();

            // Set initial variant
            this.setObjectShaderVariant("default");

            console.log("[ProgramManager] Object shader initialized successfully");
        } catch (e) {
            console.error(`[ProgramManager] Error initializing object shader: ${e.message}`);
        }
    }

    /**
     * Set the current object shader variant and recompile
     * @param {string} variant - The variant to use ('default', 'virtualboy')
     */
    setObjectShaderVariant(variant) {
        if (!this.objectShader) {
            console.warn("[ProgramManager] Object shader not initialized");
            return;
        }

        try {
            // Compiled-program cache, keyed by variant name: a variant is compiled once and reused
            // on every later swap back to it (compiling is expensive - unaffordable to redo per
            // swap, especially if a game ever swaps variants more than once per session/frame).
            if (!this._objectProgramCache) this._objectProgramCache = new Map();

            let cached = this._objectProgramCache.get(variant);
            if (!cached) {
                // Update the object shader variant (also validates the name, falling back to
                // "default" and logging a warning if unregistered - getVertexShader/getFragmentShader
                // below then read whatever setVariant actually landed on).
                this.objectShader.setVariant(variant);
                const resolvedVariant = this.objectShader.getCurrentVariant();

                const program = this.createShaderProgram(
                    this.objectShader.getVertexShader(),
                    this.objectShader.getFragmentShader(),
                    `object_shader_${resolvedVariant}`
                );
                cached = { program, locations: this.getStandardShaderLocations(program), variant: resolvedVariant };
                this._objectProgramCache.set(resolvedVariant, cached);
                if (resolvedVariant !== variant) this._objectProgramCache.set(variant, cached); // cache the miss too
            } else {
                this.objectShader.currentVariant = cached.variant; // keep ObjectShader's own state in sync, no recompile
            }

            this.currentVariant = cached.variant;
            this.objectProgram = cached.program;
            this.objectLocations = cached.locations;

            // Cache shadow uniform locations for this shader variant
            this._cacheShadowUniformLocations(cached.program);

            console.log(`[ProgramManager] Object shader variant changed to: ${cached.variant}`);

            // Object and line shader variants are independent - switching one never implicitly
            // switches the other. A game that wants them to match (e.g. a "virtualboy" look across
            // both) calls setLineShaderVariant itself alongside this call.
            return cached.variant;
        } catch (e) {
            console.error(`[ProgramManager] Error setting object shader variant: ${e.message}`);
            return this.currentVariant; // Return previous variant on error
        }
    }

    /**
     * Get the current shader variant
     * @returns {string} - Current variant name
     */
    getCurrentVariant() {
        return this.currentVariant;
    }

    /**
     * Get the current object shader program
     * @returns {WebGLProgram} - WebGL program for the current object shader
     */
    getObjectProgram() {
        return this.objectProgram;
    }

    /**
     * Get locations for the current object shader
     * @returns {Object} - Locations for attributes and uniforms
     */
    getObjectLocations() {
        return this.objectLocations;
    }

    /**
     * Initialize special-case shaders (particles, water, line)
     */
    initializeSpecialShaders() {
        this.initializeParticleShader();
        this.initializeWaterShader();
        this.initializeLineShader();
    }

    /**
     * Set the current directional-shadow-pass shader variant. Compiled once per variant and shared
     * across every ActionDirectionalShadowLight (they previously each compiled their own copy of
     * the same default shader) - call getShadowDirectionalProgram()/getShadowDirectionalLocations()
     * to use the active one.
     * @param {string} variant - A name registered via ShaderRegistry.for('shadow-directional')
     */
    setShadowDirectionalVariant(variant) {
        if (!this._shadowDirectionalCache) this._shadowDirectionalCache = new Map();

        let cached = this._shadowDirectionalCache.get(variant);
        if (!cached) {
            const registered = ShaderRegistry.for('shadow-directional').has(variant) ? variant : 'default';
            if (registered !== variant) console.warn(`[ProgramManager] Unknown shadow-directional variant: ${variant}, using default`);
            const entry = ShaderRegistry.for('shadow-directional').get(registered);
            const shadowShader = new ShadowShader();

            const program = this.createShaderProgram(
                entry.getVertexShader.call(shadowShader),
                entry.getFragmentShader.call(shadowShader),
                `directional_shadow_pass_${registered}`
            );
            const locations = {
                position: this.gl.getAttribLocation(program, "aPosition"),
                boneIndices: this.gl.getAttribLocation(program, "aBoneIndices"),
                boneWeights: this.gl.getAttribLocation(program, "aBoneWeights"),
                lightSpaceMatrix: this.gl.getUniformLocation(program, "uLightSpaceMatrix"),
                modelPos: this.gl.getUniformLocation(program, "uModelPos"),
                modelRotation: this.gl.getUniformLocation(program, "uModelRotation"),
                modelScale: this.gl.getUniformLocation(program, "uModelScale"),
                debugShadowMap: this.gl.getUniformLocation(program, "uDebugShadowMap"),
                forceShadowMapTest: this.gl.getUniformLocation(program, "uForceShadowMapTest"),
                shadowMapSize: this.gl.getUniformLocation(program, "uShadowMapSize")
            };
            cached = { program, locations, variant: registered };
            this._shadowDirectionalCache.set(registered, cached);
            if (registered !== variant) this._shadowDirectionalCache.set(variant, cached);
        }

        this._shadowDirectionalCurrent = cached;
        return cached.variant;
    }

    getShadowDirectionalProgram() {
        if (!this._shadowDirectionalCurrent) this.setShadowDirectionalVariant('default');
        return this._shadowDirectionalCurrent.program;
    }

    getShadowDirectionalLocations() {
        if (!this._shadowDirectionalCurrent) this.setShadowDirectionalVariant('default');
        return this._shadowDirectionalCurrent.locations;
    }

    /**
     * Set the current omnidirectional (point-light/cubemap) shadow-pass shader variant. Compiled
     * once per variant and shared across every ActionOmnidirectionalShadowLight.
     * @param {string} variant - A name registered via ShaderRegistry.for('shadow-omni')
     */
    setShadowOmniVariant(variant) {
        if (!this._shadowOmniCache) this._shadowOmniCache = new Map();

        let cached = this._shadowOmniCache.get(variant);
        if (!cached) {
            const registered = ShaderRegistry.for('shadow-omni').has(variant) ? variant : 'default';
            if (registered !== variant) console.warn(`[ProgramManager] Unknown shadow-omni variant: ${variant}, using default`);
            const entry = ShaderRegistry.for('shadow-omni').get(registered);
            const shadowShader = new ShadowShader();

            const program = this.createShaderProgram(
                entry.getVertexShader.call(shadowShader),
                entry.getFragmentShader.call(shadowShader),
                `omni_shadow_pass_${registered}`
            );
            const locations = {
                position: this.gl.getAttribLocation(program, "aPosition"),
                boneIndices: this.gl.getAttribLocation(program, "aBoneIndices"),
                boneWeights: this.gl.getAttribLocation(program, "aBoneWeights"),
                lightSpaceMatrix: this.gl.getUniformLocation(program, "uLightSpaceMatrix"),
                modelPos: this.gl.getUniformLocation(program, "uModelPos"),
                modelRotation: this.gl.getUniformLocation(program, "uModelRotation"),
                modelScale: this.gl.getUniformLocation(program, "uModelScale"),
                lightPos: this.gl.getUniformLocation(program, "uLightPos"),
                farPlane: this.gl.getUniformLocation(program, "uFarPlane"),
                debugShadowMap: this.gl.getUniformLocation(program, "uDebugShadowMap"),
                forceShadowMapTest: this.gl.getUniformLocation(program, "uForceShadowMapTest"),
                shadowMapSize: this.gl.getUniformLocation(program, "uShadowMapSize")
            };
            cached = { program, locations, variant: registered };
            this._shadowOmniCache.set(registered, cached);
            if (registered !== variant) this._shadowOmniCache.set(variant, cached);
        }

        this._shadowOmniCurrent = cached;
        return cached.variant;
    }

    getShadowOmniProgram() {
        if (!this._shadowOmniCurrent) this.setShadowOmniVariant('default');
        return this._shadowOmniCurrent.program;
    }

    getShadowOmniLocations() {
        if (!this._shadowOmniCurrent) this.setShadowOmniVariant('default');
        return this._shadowOmniCurrent.locations;
    }

    initializeParticleShader() {
        this.particleShader = new ParticleShader();
        // Compile+cache the default variant through the same path setParticleShaderVariant uses,
        // so there's exactly one place that ever builds a particle shader program.
        this.setParticleShaderVariant("default");
    }

    /**
     * Set the current particle shader variant
     * @param {string} variant - The shader variant to use
     */
    setParticleShaderVariant(variant) {
        if (!this.particleShader) {
            console.warn("[ProgramManager] Particle shader not initialized");
            return;
        }

        if (!this._particleProgramCache) this._particleProgramCache = new Map();

        let cached = this._particleProgramCache.get(variant);
        if (!cached) {
            this.particleShader.setVariant(variant);
            const resolvedVariant = this.particleShader.getCurrentVariant();

            const program = this.createShaderProgram(
                this.particleShader.getVertexShader(),
                this.particleShader.getFragmentShader(),
                `particle_shader_${resolvedVariant}`
            );
            const locations = {
                position: this.gl.getAttribLocation(program, "aPosition"),
                size: this.gl.getAttribLocation(program, "aSize"),
                color: this.gl.getAttribLocation(program, "aColor"),
                projectionMatrix: this.gl.getUniformLocation(program, "uProjectionMatrix"),
                viewMatrix: this.gl.getUniformLocation(program, "uViewMatrix"),
                farPlane: this.gl.getUniformLocation(program, "uFarPlane")
            };
            cached = { program, locations, variant: resolvedVariant };
            this._particleProgramCache.set(resolvedVariant, cached);
            if (resolvedVariant !== variant) this._particleProgramCache.set(variant, cached);
        } else {
            this.particleShader.currentVariant = cached.variant;
        }

        this.particleProgram = cached.program;
        this.particleLocations = cached.locations;
    }

    initializeWaterShader() {
        this.waterShader = new WaterShader();
        // Compile+cache the default variant through the same path setWaterShaderVariant uses, so
        // there's exactly one place that ever builds a water shader program.
        this.setWaterShaderVariant("default");
    }

    /**
     * Set the current water shader variant
     * @param {string} variant - The shader variant to use
     */
    setWaterShaderVariant(variant) {
        if (!this.waterShader) {
            console.warn("[ProgramManager] Water shader not initialized");
            return;
        }

        if (!this._waterProgramCache) this._waterProgramCache = new Map();

        let cached = this._waterProgramCache.get(variant);
        if (!cached) {
            this.waterShader.setVariant(variant);
            const resolvedVariant = this.waterShader.getCurrentVariant();

            const program = this.createShaderProgram(
                this.waterShader.getVertexShader(),
                this.waterShader.getFragmentShader(),
                `water_shader_${resolvedVariant}`
            );
            if (!program) {
                console.error("Failed to create water program");
                return;
            }
            const locations = {
                position: this.gl.getAttribLocation(program, "aPosition"),
                normal: this.gl.getAttribLocation(program, "aNormal"),
                texCoord: this.gl.getAttribLocation(program, "aTexCoord"),
                projectionMatrix: this.gl.getUniformLocation(program, "uProjectionMatrix"),
                viewMatrix: this.gl.getUniformLocation(program, "uViewMatrix"),
                modelPos: this.gl.getUniformLocation(program, "uModelPos"),
                modelRotation: this.gl.getUniformLocation(program, "uModelRotation"),
                modelScale: this.gl.getUniformLocation(program, "uModelScale"),
                time: this.gl.getUniformLocation(program, "uTime"),
                cameraPos: this.gl.getUniformLocation(program, "uCameraPos"),
                lightDir: this.gl.getUniformLocation(program, "uLightDir")
            };
            cached = { program, locations, variant: resolvedVariant };
            this._waterProgramCache.set(resolvedVariant, cached);
            if (resolvedVariant !== variant) this._waterProgramCache.set(variant, cached);
        } else {
            this.waterShader.currentVariant = cached.variant;
        }

        this.waterProgram = cached.program;
        this.waterLocations = cached.locations;
    }

    initializeLineShader() {
        // Create a new LineShader instance
        this.lineShader = new LineShader();

        // Compile+cache the default variant through the same path setLineShaderVariant uses, so
        // there's exactly one place that ever builds a line shader program.
        this.setLineShaderVariant("default");

        console.log("[ProgramManager] Line shader initialized");
    }

    /**
     * Get locations for a standard shader
     * @param {WebGLProgram} program - The WebGL program
     * @returns {Object} - Object containing all shader locations
     */
    getStandardShaderLocations(program) {
        const gl = this.gl;
        const attr = this.attributeNames;
        const unif = this.uniformNames;
        const tex = this.textureUniforms;

        // Get all attribute and uniform locations
        return {
            // Attributes
            position: gl.getAttribLocation(program, attr.position),
            normal: gl.getAttribLocation(program, attr.normal),
            tangent: gl.getAttribLocation(program, attr.tangent),
            color: gl.getAttribLocation(program, attr.color),
            alpha: gl.getAttribLocation(program, attr.alpha),
            texCoord: gl.getAttribLocation(program, attr.texCoord),
            textureIndex: gl.getAttribLocation(program, attr.textureIndex),
            useTexture: gl.getAttribLocation(program, attr.useTexture),
            normalMapIndex: gl.getAttribLocation(program, attr.normalMapIndex),
            metallicRoughnessMapIndex: gl.getAttribLocation(program, attr.metallicRoughnessMapIndex),
            emissiveMapIndex: gl.getAttribLocation(program, attr.emissiveMapIndex),
            boneIndices: gl.getAttribLocation(program, attr.boneIndices),
            boneWeights: gl.getAttribLocation(program, attr.boneWeights),

            // Uniforms
            projectionMatrix: gl.getUniformLocation(program, unif.projectionMatrix),
            viewMatrix: gl.getUniformLocation(program, unif.viewMatrix),
            modelPos: gl.getUniformLocation(program, unif.modelPos),
            modelRotation: gl.getUniformLocation(program, unif.modelRotation),
            modelScale: gl.getUniformLocation(program, unif.modelScale),
            lightPos: gl.getUniformLocation(program, unif.lightPos),
            lightDir: gl.getUniformLocation(program, unif.lightDir),
            lightIntensity: gl.getUniformLocation(program, unif.lightIntensity),
            lightColor: gl.getUniformLocation(program, "uLightColor"),
            pointLightIntensity: gl.getUniformLocation(program, unif.pointLightIntensity),
            roughness: gl.getUniformLocation(program, unif.roughness),
            metallic: gl.getUniformLocation(program, unif.metallic),
            ior: gl.getUniformLocation(program, unif.ior),
            normalMapStrength: gl.getUniformLocation(program, "uNormalMapStrength"),
            materialPropertiesTexture: gl.getUniformLocation(program, tex.materialProps),
            cameraPos: gl.getUniformLocation(program, unif.cameraPos),
            time: gl.getUniformLocation(program, unif.time),
            directionalLightAttenuation: gl.getUniformLocation(program, "uDirectionalLightAttenuation"),
            ambientIntensity: gl.getUniformLocation(program, "uAmbientIntensity"),
            ambientSkyColor: gl.getUniformLocation(program, "uAmbientSkyColor"),
            ambientGroundColor: gl.getUniformLocation(program, "uAmbientGroundColor"),
            exposure: gl.getUniformLocation(program, "uExposure"),
            tonemapEnabled: gl.getUniformLocation(program, "uTonemapEnabled"),
            shadowDarkness: gl.getUniformLocation(program, "uShadowDarkness"),

            // Shadow mapping uniforms
            lightSpaceMatrix: gl.getUniformLocation(program, unif.lightSpaceMatrix),
            shadowMap: gl.getUniformLocation(program, unif.shadowMap),
            shadowsEnabled: gl.getUniformLocation(program, unif.shadowsEnabled),

            // Light counts
            directionalLightCount: gl.getUniformLocation(program, "uDirectionalLightCount"),
            pointLightCount: gl.getUniformLocation(program, "uPointLightCount"),
            spotLightCount: gl.getUniformLocation(program, "uSpotLightCount"),

            // Light data textures
            directionalLightData: gl.getUniformLocation(program, "uDirectionalLightData"),
            directionalLightTextureSize: gl.getUniformLocation(program, "uDirectionalLightTextureSize"),
            pointLightData: gl.getUniformLocation(program, "uPointLightData"),
            pointLightTextureSize: gl.getUniformLocation(program, "uPointLightTextureSize"),

            farPlane: gl.getUniformLocation(program, "uFarPlane"),
            pointShadowFarPlane: gl.getUniformLocation(program, "uPointShadowFarPlane"),

            // Legacy light uniforms
            pointLightPos: gl.getUniformLocation(program, "uPointLightPos"),
            pointLightColor: gl.getUniformLocation(program, "uPointLightColor"),
            pointLightRadius: gl.getUniformLocation(program, "uLightRadius"),
            pointShadowsEnabled: gl.getUniformLocation(program, "uPointShadowsEnabled"),
            pointShadowMap: gl.getUniformLocation(program, "uPointShadowMap"),

            // Additional point light uniforms (2-4)
            pointLightPos1: gl.getUniformLocation(program, "uPointLightPos1"),
            pointLightColor1: gl.getUniformLocation(program, "uPointLightColor1"),
            pointLightRadius1: gl.getUniformLocation(program, "uPointLightRadius1"),
            pointShadowsEnabled1: gl.getUniformLocation(program, "uPointShadowsEnabled1"),
            pointShadowMap1: gl.getUniformLocation(program, "uPointShadowMap1"),
            pointLightIntensity1: gl.getUniformLocation(program, "uPointLightIntensity1"),

            // Third point light uniforms
            pointShadowsEnabled2: gl.getUniformLocation(program, "uPointShadowsEnabled2"),
            pointShadowMap2: gl.getUniformLocation(program, "uPointShadowMap2"),

            // Fourth point light uniforms
            pointShadowsEnabled3: gl.getUniformLocation(program, "uPointShadowsEnabled3"),
            pointShadowMap3: gl.getUniformLocation(program, "uPointShadowMap3"),

            // Texture uniform
            textureArray: gl.getUniformLocation(program, tex.textureArray)
        };
    }

    /**
     * Set the current line shader variant
     * @param {string} variant - The shader variant to use ('default', 'virtualboy', etc.)
     */
    setLineShaderVariant(variant) {
        if (!this.lineShader) {
            console.warn("[ProgramManager] Line shader not initialized");
            return;
        }

        // Compiled-program cache, keyed by variant name - same reasoning as
        // setObjectShaderVariant's cache: compiling is too expensive to redo on every swap.
        if (!this._lineProgramCache) this._lineProgramCache = new Map();

        let cached = this._lineProgramCache.get(variant);
        if (!cached) {
            this.lineShader.setVariant(variant);
            const resolvedVariant = this.lineShader.getCurrentVariant();

            const program = this.createShaderProgram(
                this.lineShader.getVertexShader(),
                this.lineShader.getFragmentShader(),
                `line_shader_${resolvedVariant}`
            );
            const locations = {
                position: this.gl.getAttribLocation(program, "aPosition"),
                projectionMatrix: this.gl.getUniformLocation(program, "uProjectionMatrix"),
                viewMatrix: this.gl.getUniformLocation(program, "uViewMatrix"),
                color: this.gl.getUniformLocation(program, "uColor"),
                time: this.gl.getUniformLocation(program, "uTime")
            };
            cached = { program, locations, variant: resolvedVariant };
            this._lineProgramCache.set(resolvedVariant, cached);
            if (resolvedVariant !== variant) this._lineProgramCache.set(variant, cached); // cache the miss too
        } else {
            this.lineShader.currentVariant = cached.variant; // keep LineShader's own state in sync, no recompile
        }

        this.lineProgram = cached.program;
        this.lineLocations = cached.locations;

        console.log(`[ProgramManager] Line shader variant changed to: ${cached.variant}`);
    }

    // Accessor methods
    getParticleProgram() {
        return this.particleProgram;
    }

    getParticleLocations() {
        return this.particleLocations;
    }

    getWaterProgram() {
        return this.waterProgram;
    }

    getWaterLocations() {
        return this.waterLocations;
    }

    getLineProgram() {
        return this.lineProgram;
    }

    getLineLocations() {
        return this.lineLocations;
    }

    /**
     * Cache shadow-related uniform locations for the current shader program
     * Called during shader compilation to avoid repeated getUniformLocation calls
     * @private
     */
    _cacheShadowUniformLocations(program) {
        this.shadowUniformLocations.shadowSoftness = this.gl.getUniformLocation(program, "uShadowSoftness");
        this.shadowUniformLocations.shadowSlopeScaleBias = this.gl.getUniformLocation(program, "uShadowSlopeScaleBias");
        this.shadowUniformLocations.shadowSlopeClamp = this.gl.getUniformLocation(program, "uShadowSlopeClamp");
        this.shadowUniformLocations.shadowPcssMax = this.gl.getUniformLocation(program, "uShadowPcssMax");
        this.shadowUniformLocations.pcfSize = this.gl.getUniformLocation(program, "uPCFSize");
        this.shadowUniformLocations.pcfEnabled = this.gl.getUniformLocation(program, "uPCFEnabled");
    }

    /**
     * Get cached shadow uniform locations
     * @returns {Object} Object with shadowSoftness, pcfSize, pcfEnabled locations
     */
    getShadowUniformLocations() {
        return this.shadowUniformLocations;
    }
}
