// actionengine/display/gl/programmanager.js
class ProgramManager {
    constructor(gl, isWebGL2) {
        this.gl = gl;
        this.isWebGL2 = isWebGL2;
        
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

        // Shader instances
        this.objectShader = null;
        this.lineShader = null;

        // Debug visualization buffers
        this.debugQuadBuffer = null;
        this.debugBackgroundBuffer = null;
        
        // Attribute and uniform name mappings
        this.attributeNames = {
            position: 'aPosition',
            normal: 'aNormal',
            color: 'aColor',
            texCoord: 'aTexCoord',
            textureIndex: 'aTextureIndex',
            useTexture: 'aUseTexture'
        };
        
        this.uniformNames = {
            projectionMatrix: 'uProjectionMatrix',
            viewMatrix: 'uViewMatrix',
            modelMatrix: 'uModelMatrix',
            lightPos: 'uLightPos',
            lightDir: 'uLightDir',
            lightIntensity: 'uLightIntensity',
            roughness: 'uRoughness',
            metallic: 'uMetallic',
            baseReflectivity: 'uBaseReflectivity',
            cameraPos: 'uCameraPos',
            time: 'uTime',
            lightSpaceMatrix: 'uLightSpaceMatrix',
            shadowMap: 'uShadowMap',
            shadowsEnabled: 'uShadowsEnabled',
            intensityFactor: 'uIntensityFactor'
        };
        
        this.textureUniforms = {
            standard: this.isWebGL2 ? 'uTextureArray' : 'uTexture',
            pbr: 'uPBRTextureArray',
            shadowMap: 'uShadowMap',
            materialProps: 'uMaterialPropertiesTexture'
        };
        
        // Initialize all shaders
        this.initializeSpecialShaders();
        this.initializeObjectShader();
    }
    
    /**
     * Create a shader program 
     */
    createShaderProgram(vsSource, fsSource, shaderName = 'unknown') {
        try {
            // Try to compile the vertex shader
            const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vsSource, `${shaderName} vertex`);
            
            // Try to compile the fragment shader
            const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fsSource, `${shaderName} fragment`);
    
            const program = this.gl.createProgram();
            this.gl.attachShader(program, vertexShader);
            this.gl.attachShader(program, fragmentShader);
            this.gl.linkProgram(program);
    
            if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
                const info = this.gl.getProgramInfoLog(program);
                console.error(`==== SHADER LINK ERROR FOR '${shaderName}' ====`);
                console.error(info);
                console.error('==== VERTEX SHADER SOURCE ====');
                console.error(vsSource);
                console.error('==== FRAGMENT SHADER SOURCE ====');
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
     * Compile a shader
     */
    compileShader(type, source, shaderLabel = 'unknown') {
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
            const sourceLines = source.split('\n');
            console.error('==== SHADER SOURCE ====');
            sourceLines.forEach((line, index) => {
                console.error(`${index + 1}: ${line}`);
            });
            
            // Analyze error message for line numbers
            let lineNumber = -1;
            const lineMatch = info.match(/\d+:(\d+)/);
            if (lineMatch && lineMatch[1]) {
                lineNumber = parseInt(lineMatch[1]);
                if (lineNumber > 0 && lineNumber <= sourceLines.length) {
                    console.error('==== PROBLEMATIC LINE ====');
                    console.error(`${lineNumber}: ${sourceLines[lineNumber - 1]}`);
                    
                    // Show context (lines before and after)
                    console.error('==== CONTEXT ====');
                    const startLine = Math.max(0, lineNumber - 3);
                    const endLine = Math.min(sourceLines.length, lineNumber + 2);
                    for (let i = startLine; i < endLine; i++) {
                        const prefix = i === lineNumber - 1 ? '> ' : '  ';
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
     * @param {string} variant - The variant to use ('default', 'pbr', 'virtualboy')
     */
    setObjectShaderVariant(variant) {
        if (!this.objectShader) {
            console.warn("[ProgramManager] Object shader not initialized");
            return;
        }
        
        try {
            // Remember current variant
            this.currentVariant = variant;
            
            // Update the object shader variant
            this.objectShader.setVariant(variant);
            
            // Compile shader program with the current variant
            const program = this.createShaderProgram(
                this.objectShader.getVertexShader(this.isWebGL2),
                this.objectShader.getFragmentShader(this.isWebGL2),
                `object_shader_${variant}`
            );
            
            // Get locations for uniforms and attributes
            const isPBR = variant === 'pbr';
            const locations = this.getStandardShaderLocations(program, isPBR);
            
            // Update stored program and locations
            this.objectProgram = program;
            this.objectLocations = locations;
            
            console.log(`[ProgramManager] Object shader variant changed to: ${variant}`);
            
            // Update line shader to match
            this.handleVariantChange(variant);
            
            return variant;
        } catch (e) {
            console.error(`[ProgramManager] Error setting object shader variant: ${e.message}`);
            return this.currentVariant; // Return previous variant on error
        }
    }
    
    /**
     * Cycle to the next shader variant
     * @param {function} callback - Optional callback for when variant changes
     * @returns {string} - Name of the new shader variant
     */
    cycleVariants(callback) {
        const variants = ["default", "pbr", "virtualboy"];
        const currentIndex = variants.indexOf(this.currentVariant);
        const nextIndex = (currentIndex + 1) % variants.length;
        const newVariant = variants[nextIndex];
        
        // Set the new variant
        this.setObjectShaderVariant(newVariant);
        
        // Call the callback if provided
        if (callback && typeof callback === 'function') {
            callback(newVariant);
        }
        
        return newVariant;
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

    initializeParticleShader() {
        const particleShader = new ParticleShader();
        this.particleProgram = this.createShaderProgram(
            particleShader.getParticleVertexShader(this.isWebGL2),
            particleShader.getParticleFragmentShader(this.isWebGL2),
            'particle_shader'
        );

        this.particleLocations = {
            position: this.gl.getAttribLocation(this.particleProgram, "aPosition"),
            size: this.gl.getAttribLocation(this.particleProgram, "aSize"),
            color: this.gl.getAttribLocation(this.particleProgram, "aColor"),
            projectionMatrix: this.gl.getUniformLocation(this.particleProgram, "uProjectionMatrix"),
            viewMatrix: this.gl.getUniformLocation(this.particleProgram, "uViewMatrix")
        };
    }

    initializeWaterShader() {
        const waterShader = new WaterShader();
        this.waterProgram = this.createShaderProgram(
            waterShader.getWaterVertexShader(this.isWebGL2),
            waterShader.getWaterFragmentShader(this.isWebGL2),
            'water_shader'
        );

        // Add null checks
        if (!this.waterProgram) {
            console.error("Failed to create water program");
            return;
        }

        this.waterLocations = {
            position: this.gl.getAttribLocation(this.waterProgram, "aPosition"),
            normal: this.gl.getAttribLocation(this.waterProgram, "aNormal"),
            texCoord: this.gl.getAttribLocation(this.waterProgram, "aTexCoord"),
            projectionMatrix: this.gl.getUniformLocation(this.waterProgram, "uProjectionMatrix"),
            viewMatrix: this.gl.getUniformLocation(this.waterProgram, "uViewMatrix"),
            modelMatrix: this.gl.getUniformLocation(this.waterProgram, "uModelMatrix"),
            time: this.gl.getUniformLocation(this.waterProgram, "uTime"),
            cameraPos: this.gl.getUniformLocation(this.waterProgram, "uCameraPos"),
            lightDir: this.gl.getUniformLocation(this.waterProgram, "uLightDir")
        };
    }
    
    initializeLineShader() {
        // Create a new LineShader instance
        this.lineShader = new LineShader();
        
        // Create shader program for the default line shader
        const lineProgram = this.createShaderProgram(
            this.lineShader.getVertexShader(this.isWebGL2),
            this.lineShader.getFragmentShader(this.isWebGL2),
            'line_shader'
        );
        
        // Get and store shader locations
        this.lineLocations = {
            position: this.gl.getAttribLocation(lineProgram, "aPosition"),
            projectionMatrix: this.gl.getUniformLocation(lineProgram, "uProjectionMatrix"),
            viewMatrix: this.gl.getUniformLocation(lineProgram, "uViewMatrix"),
            color: this.gl.getUniformLocation(lineProgram, "uColor"),
            time: this.gl.getUniformLocation(lineProgram, "uTime")
        };
        
        // Store the program for later use
        this.lineProgram = lineProgram;
        
        console.log("[ProgramManager] Line shader initialized");
    }
    
    /**
     * Get locations for a standard shader
     * @param {WebGLProgram} program - The WebGL program
     * @param {boolean} isPBR - Whether this is a PBR shader
     * @returns {Object} - Object containing all shader locations
     */
    getStandardShaderLocations(program, isPBR = false) {
        const gl = this.gl;
        const attr = this.attributeNames;
        const unif = this.uniformNames;
        const tex = this.textureUniforms;
        
        // Get all attribute and uniform locations
        return {
            // Attributes
            position: gl.getAttribLocation(program, attr.position),
            normal: gl.getAttribLocation(program, attr.normal),
            color: gl.getAttribLocation(program, attr.color),
            texCoord: gl.getAttribLocation(program, attr.texCoord),
            textureIndex: gl.getAttribLocation(program, attr.textureIndex),
            useTexture: gl.getAttribLocation(program, attr.useTexture),
            
            // Uniforms
            projectionMatrix: gl.getUniformLocation(program, unif.projectionMatrix),
            viewMatrix: gl.getUniformLocation(program, unif.viewMatrix),
            modelMatrix: gl.getUniformLocation(program, unif.modelMatrix),
            lightPos: gl.getUniformLocation(program, unif.lightPos),
            lightDir: gl.getUniformLocation(program, unif.lightDir),
            lightIntensity: gl.getUniformLocation(program, unif.lightIntensity),
            roughness: gl.getUniformLocation(program, unif.roughness),
            metallic: gl.getUniformLocation(program, unif.metallic),
            baseReflectivity: gl.getUniformLocation(program, unif.baseReflectivity),
            usePerTextureMaterials: gl.getUniformLocation(program, 'uUsePerTextureMaterials'),
            materialPropertiesTexture: gl.getUniformLocation(program, tex.materialProps),
            cameraPos: gl.getUniformLocation(program, unif.cameraPos),
            time: gl.getUniformLocation(program, unif.time),
            intensityFactor: gl.getUniformLocation(program, unif.intensityFactor),
            
            // Shadow mapping uniforms
            lightSpaceMatrix: gl.getUniformLocation(program, unif.lightSpaceMatrix),
            shadowMap: gl.getUniformLocation(program, unif.shadowMap),
            shadowsEnabled: gl.getUniformLocation(program, unif.shadowsEnabled),
            
            // Texture uniform
            textureArray: gl.getUniformLocation(program, isPBR ? tex.pbr : tex.standard)
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
        
        // Update the line shader variant
        this.lineShader.setVariant(variant);
        
        // Reinitialize the line shader program
        const newLineProgram = this.createShaderProgram(
            this.lineShader.getVertexShader(this.isWebGL2),
            this.lineShader.getFragmentShader(this.isWebGL2),
            `line_shader_${variant}`
        );
        
        // Update the program and locations
        this.lineProgram = newLineProgram;
        this.lineLocations = {
            position: this.gl.getAttribLocation(newLineProgram, "aPosition"),
            projectionMatrix: this.gl.getUniformLocation(newLineProgram, "uProjectionMatrix"),
            viewMatrix: this.gl.getUniformLocation(newLineProgram, "uViewMatrix"),
            color: this.gl.getUniformLocation(newLineProgram, "uColor"),
            time: this.gl.getUniformLocation(newLineProgram, "uTime")
        };
        
        console.log(`[ProgramManager] Line shader variant changed to: ${variant}`);
    }
    
    /**
     * Update shaders when variant changes
     * @param {string} variant - The name of the new variant
     */
    handleVariantChange(variant) {
        if (variant === "virtualboy") {
            this.setLineShaderVariant("virtualboy");
        } else {
            this.setLineShaderVariant("default");
        }
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
}