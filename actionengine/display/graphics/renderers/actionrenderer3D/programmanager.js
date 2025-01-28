// actionengine/display/graphics/renderers/actionrenderer3D/programregistry.js
class ProgramManager {
    constructor(gl, isWebGL2) {
        this.gl = gl;
        this.isWebGL2 = isWebGL2;
        this.programRegistry = new ProgramRegistry(this.gl);

        // Store shader programs
        this.particleProgram = null;
        this.debugShadowMapProgram = null;
        
        // Store locations for different shader programs
        this.particleLocations = {};
        this.debugShadowLocations = {};
        
        // Debug visualization buffers
        this.debugQuadBuffer = null;
        this.debugBackgroundBuffer = null;

        // Initialize everything
        this.initializeShaderPrograms();
        this.initializeDebugBuffers();
    }

    initializeShaderPrograms() {
        this.initializeParticleShader();
        this.initializeDebugShadowShader();
		this.initializeWaterShader();
        this.initializeDefaultShaders();
    }

    initializeParticleShader() {
        const particleShader = new ParticleShader();
        this.particleProgram = this.programRegistry.createShaderProgram(
            particleShader.getParticleVertexShader(this.isWebGL2),
            particleShader.getParticleFragmentShader(this.isWebGL2)
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
        waterShader.getWaterFragmentShader(this.isWebGL2)
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
    initializeDebugShadowShader() {
        const debugShadowMapShader = new DebugShadowMapShader();
        this.debugShadowMapProgram = this.programRegistry.createShaderProgram(
            debugShadowMapShader.getDebugShadowMapVertexShader(this.isWebGL2),
            debugShadowMapShader.getDebugShadowMapFragmentShader(this.isWebGL2)
        );
        
        this.debugShadowLocations = {
            position: this.gl.getAttribLocation(this.debugShadowMapProgram, "aPosition"),
            shadowMap: this.gl.getUniformLocation(this.debugShadowMapProgram, "uShadowMap")
        };
    }

    initializeDefaultShaders() {
        const defaultShader = new DefaultShader();
        const shadowShader = new ShadowShader();

        const defaultTerrainProgram = this.programRegistry.createShaderProgram(
            defaultShader.getTerrainVertexShader(),
            defaultShader.getTerrainFragmentShader()
        );

        const defaultCharacterProgram = this.programRegistry.createShaderProgram(
            defaultShader.getCharacterVertexShader(),
            defaultShader.getCharacterFragmentShader()
        );

        const defaultLineProgram = this.programRegistry.createShaderProgram(
            defaultShader.getLineVertexShader(),
            defaultShader.getLineFragmentShader()
        );

        const defaultShadowProgram = this.programRegistry.createShaderProgram(
            shadowShader.getShadowVertexShader(),
            shadowShader.getShadowFragmentShader()
        );

        // Add default shader set to registry
        this.programRegistry.shaders.set("default", {
            terrain: {
                program: defaultTerrainProgram,
                locations: {
                    position: this.gl.getAttribLocation(defaultTerrainProgram, "aPosition"),
                    normal: this.gl.getAttribLocation(defaultTerrainProgram, "aNormal"),
                    color: this.gl.getAttribLocation(defaultTerrainProgram, "aColor"),
                    projectionMatrix: this.gl.getUniformLocation(defaultTerrainProgram, "uProjectionMatrix"),
                    viewMatrix: this.gl.getUniformLocation(defaultTerrainProgram, "uViewMatrix"),
                    modelMatrix: this.gl.getUniformLocation(defaultTerrainProgram, "uModelMatrix"),
                    cameraPos: this.gl.getUniformLocation(defaultTerrainProgram, "uCameraPos"),
                    lightDir: this.gl.getUniformLocation(defaultTerrainProgram, "uLightDir")
                }
            },
            character: {
                program: defaultCharacterProgram,
                locations: {
                    position: this.gl.getAttribLocation(defaultCharacterProgram, "aPosition"),
                    normal: this.gl.getAttribLocation(defaultCharacterProgram, "aNormal"),
                    color: this.gl.getAttribLocation(defaultCharacterProgram, "aColor"),
                    projectionMatrix: this.gl.getUniformLocation(defaultCharacterProgram, "uProjectionMatrix"),
                    viewMatrix: this.gl.getUniformLocation(defaultCharacterProgram, "uViewMatrix"),
                    modelMatrix: this.gl.getUniformLocation(defaultCharacterProgram, "uModelMatrix")
                }
            },
            lines: {
                program: defaultLineProgram,
                locations: {
                    position: this.gl.getAttribLocation(defaultLineProgram, "aPosition"),
                    projectionMatrix: this.gl.getUniformLocation(defaultLineProgram, "uProjectionMatrix"),
                    viewMatrix: this.gl.getUniformLocation(defaultLineProgram, "uViewMatrix")
                }
            },
            shadow: {
                program: defaultShadowProgram,
                locations: {
                    position: this.gl.getAttribLocation(defaultShadowProgram, "aPosition"),
                    lightSpaceMatrix: this.gl.getUniformLocation(defaultShadowProgram, "uLightSpaceMatrix"),
                    modelMatrix: this.gl.getUniformLocation(defaultShadowProgram, "uModelMatrix")
                }
            }
        });
    }

    initializeDebugBuffers() {
        // Create debug quad buffer for shadow map visualization
        this.debugQuadBuffer = this.gl.createBuffer();
        const quadVertices = new Float32Array([
            -1.0, -1.0,  // bottom left
            -0.5, -1.0,  // bottom right
            -1.0, -0.5,  // top left
            -0.5, -0.5   // top right
        ]);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.debugQuadBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, quadVertices, this.gl.STATIC_DRAW);

        this.debugBackgroundBuffer = this.gl.createBuffer();
        const backgroundQuad = new Float32Array([
            -1.2, -1.2,  // noticeably larger
            1.2, -1.2,
            -1.2, 1.2,
            1.2, 1.2
        ]);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.debugBackgroundBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, backgroundQuad, this.gl.STATIC_DRAW);
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

    getDebugShadowProgram() {
        return this.debugShadowMapProgram;
    }

    getDebugShadowLocations() {
        return this.debugShadowLocations;
    }

    getDebugQuadBuffer() {
        return this.debugQuadBuffer;
    }

    getDebugBackgroundBuffer() {
        return this.debugBackgroundBuffer;
    }

    getProgramRegistry() {
        return this.programRegistry;
    }

    cycleShaders() {
        this.programRegistry.cycleShaders();
    }
}