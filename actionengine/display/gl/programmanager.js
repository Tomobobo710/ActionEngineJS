// actionengine/display/gl/programmanager.js
class ProgramManager {
    constructor(gl, isWebGL2) {
        this.gl = gl;
        this.isWebGL2 = isWebGL2;
        this.programRegistry = new ProgramRegistry(this.gl, this);

        // Store shader programs
        this.particleProgram = null;
        this.waterProgram = null;
        this.lineProgram = null;

        // Store locations for different shader programs
        this.particleLocations = {};
        this.waterLocations = {};
        this.lineLocations = {};

        // Line shader instance
        this.lineShader = null;

        // Debug visualization buffers
        this.debugQuadBuffer = null;
        this.debugBackgroundBuffer = null;

        // Initialize shaders
        this.initializeShaderPrograms();
        this.registerAllShaderSets();
    }

    initializeShaderPrograms() {
        this.initializeParticleShader();
        this.initializeWaterShader();
        this.initializeDefaultShaderSet();
        this.initializeLineShader();
    }

    initializeParticleShader() {
        const particleShader = new ParticleShader();
        this.particleProgram = this.programRegistry.createShaderProgram(
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
        this.waterProgram = this.programRegistry.createShaderProgram(
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

        console.log("Water locations:", this.waterLocations); // Debug
    }

    initializeDefaultShaderSet() {
        const defaultShaderSet = new DefaultShaderSet();

        const defaultStandardProgram = this.programRegistry.createShaderProgram(
            defaultShaderSet.getStandardVertexShader(this.isWebGL2),
            defaultShaderSet.getStandardFragmentShader(this.isWebGL2),
            'default_standard'
        );

        // Add default shader set to registry
        this.programRegistry.shaderSets.set("default", {
            standard: {
                program: defaultStandardProgram,
                locations: {
                    // Attributes
                    position: this.gl.getAttribLocation(defaultStandardProgram, "aPosition"),
                    normal: this.gl.getAttribLocation(defaultStandardProgram, "aNormal"),
                    color: this.gl.getAttribLocation(defaultStandardProgram, "aColor"),
                    texCoord: this.gl.getAttribLocation(defaultStandardProgram, "aTexCoord"),
                    textureIndex: this.gl.getAttribLocation(defaultStandardProgram, "aTextureIndex"),
                    useTexture: this.gl.getAttribLocation(defaultStandardProgram, "aUseTexture"),
                    
                    // Uniforms
                    projectionMatrix: this.gl.getUniformLocation(defaultStandardProgram, "uProjectionMatrix"),
                    viewMatrix: this.gl.getUniformLocation(defaultStandardProgram, "uViewMatrix"),
                    modelMatrix: this.gl.getUniformLocation(defaultStandardProgram, "uModelMatrix"),
                    cameraPos: this.gl.getUniformLocation(defaultStandardProgram, "uCameraPos"),
                    lightDir: this.gl.getUniformLocation(defaultStandardProgram, "uLightDir"),
                    lightPos: this.gl.getUniformLocation(defaultStandardProgram, "uLightPos"),
                    lightIntensity: this.gl.getUniformLocation(defaultStandardProgram, "uLightIntensity"),
                    intensityFactor: this.gl.getUniformLocation(defaultStandardProgram, "uIntensityFactor"),
                    time: this.gl.getUniformLocation(defaultStandardProgram, "uTime"),
                    
                    // Shadow mapping
                    lightSpaceMatrix: this.gl.getUniformLocation(defaultStandardProgram, "uLightSpaceMatrix"),
                    shadowMap: this.gl.getUniformLocation(defaultStandardProgram, "uShadowMap"),
                    shadowsEnabled: this.gl.getUniformLocation(defaultStandardProgram, "uShadowsEnabled"),
                    
                    // Textures
                    textureArray: this.gl.getUniformLocation(defaultStandardProgram, "uTextureArray")
                }
            }
        });
        
        console.log("[ProgramManager] Default shader set initialized");
    }
    
    /**
     * Register all additional shader sets
     */
    registerAllShaderSets() {
        console.log(`[ProgramManager] Registering all shader sets, WebGL2: ${this.isWebGL2}`);
        
        // Register PBR shader set
        this.registerShaderSet("pbr", new PBRShaderSet());
        
        // Register VirtualBoy shader set
        this.registerShaderSet("virtualboy", new VirtualBoyShaderSet());
        
        console.log("[ProgramManager] All shader sets registered");
    }
    
    /**
     * Register a shader set with the program registry
     * @param {string} name - Name of the shader set
     * @param {Object} shaderSetInstance - Instance of a shader set
     */
    registerShaderSet(name, shaderSetInstance) {
        console.log(`[ProgramManager] Registering shader set: ${name}`);
        
        try {
            // Get shader sources
            let standardVertex = null;
            let standardFragment = null;
            
            try {
                if (shaderSetInstance.getStandardVertexShader) {
                    standardVertex = shaderSetInstance.getStandardVertexShader(this.isWebGL2);
                }
            } catch (e) {
                console.error(`[ProgramManager] Error getting standard vertex shader for '${name}': ${e.message}`);
            }
            
            try {
                if (shaderSetInstance.getStandardFragmentShader) {
                    standardFragment = shaderSetInstance.getStandardFragmentShader(this.isWebGL2);
                }
            } catch (e) {
                console.error(`[ProgramManager] Error getting standard fragment shader for '${name}': ${e.message}`);
            }
            
            // Create shader set object
            const shaderSet = {
                standard: {
                    vertex: standardVertex,
                    fragment: standardFragment
                }
            };
            
            // Register with program registry
            this.programRegistry.registerShaderSet(name, shaderSet);
            console.log(`[ProgramManager] Successfully registered shader set: ${name}`);
        } catch (e) {
            console.error(`[ProgramManager] Error registering shader set '${name}': ${e.message}`);
        }
    }

    /**
     * Initialize the dedicated line shader
     */
    initializeLineShader() {
        // Create a new LineShader instance
        this.lineShader = new LineShader();
        
        // Create shader program for the default line shader
        const lineProgram = this.programRegistry.createShaderProgram(
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
        const newLineProgram = this.programRegistry.createShaderProgram(
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

    getProgramRegistry() {
        return this.programRegistry;
    }
}