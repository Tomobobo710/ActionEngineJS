// actionengine/display/graphics/renderers/actionrenderer3D/programregistry.js
class ProgramManager {
    constructor(gl, isWebGL2) {
        this.gl = gl;
        this.isWebGL2 = isWebGL2;
        this.programRegistry = new ProgramRegistry(this.gl);

        // Store shader programs
        this.particleProgram = null;

        // Store locations for different shader programs
        this.particleLocations = {};

        // Debug visualization buffers
        this.debugQuadBuffer = null;
        this.debugBackgroundBuffer = null;

        // Initialize shaders
        this.initializeShaderPrograms();
    }

    initializeShaderPrograms() {
        this.initializeParticleShader();
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

    initializeDefaultShaders() {
        const defaultShader = new DefaultShader();

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

        // Add default shader set to registry
        this.programRegistry.shaders.set("default", {
            terrain: {
                program: defaultTerrainProgram,
                locations: {
                    // Existing locations
                    position: this.gl.getAttribLocation(defaultTerrainProgram, "aPosition"),
                    normal: this.gl.getAttribLocation(defaultTerrainProgram, "aNormal"),
                    color: this.gl.getAttribLocation(defaultTerrainProgram, "aColor"),
                    projectionMatrix: this.gl.getUniformLocation(defaultTerrainProgram, "uProjectionMatrix"),
                    viewMatrix: this.gl.getUniformLocation(defaultTerrainProgram, "uViewMatrix"),
                    modelMatrix: this.gl.getUniformLocation(defaultTerrainProgram, "uModelMatrix"),
                    cameraPos: this.gl.getUniformLocation(defaultTerrainProgram, "uCameraPos"),
                    lightDir: this.gl.getUniformLocation(defaultTerrainProgram, "uLightDir"),

                    // Modified texture handling
                    textureArray: this.gl.getUniformLocation(defaultTerrainProgram, "uTextureArray"),
                    textureIndex: this.gl.getAttribLocation(defaultTerrainProgram, "aTextureIndex"),
                    texCoord: this.gl.getAttribLocation(defaultTerrainProgram, "aTexCoord"),
                    useTexture: this.gl.getAttribLocation(defaultTerrainProgram, "aUseTexture")
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
        });
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

    getProgramRegistry() {
        return this.programRegistry;
    }

    cycleShaders() {
        this.programRegistry.cycleShaders();
    }
}