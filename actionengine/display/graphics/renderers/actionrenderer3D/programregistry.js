// actionengine/display/graphics/renderers/actionrenderer3D/programregistry.js
class ProgramRegistry {
    constructor(gl) {
        this.gl = gl;
        this.shaders = new Map();
        this.currentShaderIndex = 0;
    }

    createShaderProgram(vsSource, fsSource) {
        const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fsSource);

        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            const info = this.gl.getProgramInfoLog(program);
            throw new Error("Shader program failed to link: " + info);
        }

        // Clean up shaders after linking
        this.gl.deleteShader(vertexShader);
        this.gl.deleteShader(fragmentShader);

        return program;
    }

    compileShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const info = this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);
            throw new Error("Shader compile error: " + info);
        }

        return shader;
    }
    
    registerShaderSet(name, shaders) {
        const defaultSet = this.shaders.get("default");

        // Create new shader set using defaults for any missing shaders
        const newSet = {
            terrain: {
                program: shaders.terrain
                    ? this.createShaderProgram(shaders.terrain.vertex, shaders.terrain.fragment)
                    : defaultSet.terrain.program,
                locations: null // Will set after program creation
            },
            character: {
                program: shaders.character
                    ? this.createShaderProgram(shaders.character.vertex, shaders.character.fragment)
                    : defaultSet.character.program,
                locations: null
            },
            lines: {
                program: shaders.lines
                    ? this.createShaderProgram(shaders.lines.vertex, shaders.lines.fragment)
                    : defaultSet.lines.program,
                locations: null
            }
        };

        this.setupShaderLocations(newSet, shaders, defaultSet);
        this.shaders.set(name, newSet);
    }

    setupShaderLocations(newSet, shaders, defaultSet) {
        // Set up locations for pbr terrain shader
        if (shaders.terrain) {
            const pbrProgram = newSet.terrain.program;
            newSet.terrain.locations = {
                position: this.gl.getAttribLocation(pbrProgram, "aPosition"),
                normal: this.gl.getAttribLocation(pbrProgram, "aNormal"),
                color: this.gl.getAttribLocation(pbrProgram, "aColor"),
                projectionMatrix: this.gl.getUniformLocation(pbrProgram, "uProjectionMatrix"),
                viewMatrix: this.gl.getUniformLocation(pbrProgram, "uViewMatrix"),
                modelMatrix: this.gl.getUniformLocation(pbrProgram, "uModelMatrix"),
                lightPos: this.gl.getUniformLocation(pbrProgram, "uLightPos"),
                lightDir: this.gl.getUniformLocation(pbrProgram, "uLightDir"),
                lightIntensity: this.gl.getUniformLocation(pbrProgram, "uLightIntensity"),

                roughness: this.gl.getUniformLocation(pbrProgram, "uRoughness"),
                metallic: this.gl.getUniformLocation(pbrProgram, "uMetallic"),
                baseReflectivity: this.gl.getUniformLocation(pbrProgram, "uBaseReflectivity"),
                cameraPos: this.gl.getUniformLocation(pbrProgram, "uCameraPos"),
                // Texture-related locations
                textureArray: this.gl.getUniformLocation(pbrProgram, "uPBRTextureArray"),
                textureIndex: this.gl.getAttribLocation(pbrProgram, "aTextureIndex"),
                texCoord: this.gl.getAttribLocation(pbrProgram, "aTexCoord"),
                useTexture: this.gl.getAttribLocation(pbrProgram, "aUseTexture")
            };
        } else {
            newSet.terrain.locations = defaultSet.terrain.locations;
        }

        // Set up locations for character shader
        if (shaders.character) {
            newSet.character.locations = {
                position: this.gl.getAttribLocation(newSet.character.program, "aPosition"),
                normal: this.gl.getAttribLocation(newSet.character.program, "aNormal"),
                color: this.gl.getAttribLocation(newSet.character.program, "aColor"),
                projectionMatrix: this.gl.getUniformLocation(newSet.character.program, "uProjectionMatrix"),
                viewMatrix: this.gl.getUniformLocation(newSet.character.program, "uViewMatrix"),
                modelMatrix: this.gl.getUniformLocation(newSet.character.program, "uModelMatrix"),
                cameraPos: this.gl.getUniformLocation(newSet.character.program, "uCameraPos"),
                lightDir: this.gl.getUniformLocation(newSet.character.program, "uLightDir"),
                roughness: this.gl.getUniformLocation(newSet.character.program, "uRoughness"),
                metallic: this.gl.getUniformLocation(newSet.character.program, "uMetallic"),
                // Texture-related locations
                textureArray: this.gl.getUniformLocation(newSet.character.program, "uPBRTextureArray"),
                textureIndex: this.gl.getAttribLocation(newSet.character.program, "aTextureIndex"),
                texCoord: this.gl.getAttribLocation(newSet.character.program, "aTexCoord"),
                useTexture: this.gl.getAttribLocation(newSet.character.program, "aUseTexture")
            };
        } else {
            newSet.character.locations = defaultSet.character.locations;
        }

        // Set up locations for line shader
        if (shaders.lines) {
            newSet.lines.locations = {
                position: this.gl.getAttribLocation(newSet.lines.program, "aPosition"),
                projectionMatrix: this.gl.getUniformLocation(newSet.lines.program, "uProjectionMatrix"),
                viewMatrix: this.gl.getUniformLocation(newSet.lines.program, "uViewMatrix")
            };
        } else {
            newSet.lines.locations = defaultSet.lines.locations;
        }

        // Add time uniform location to shader locations if present
        this.setupTimeUniforms(newSet, shaders);
    }

    setupTimeUniforms(newSet, shaders) {
        if (shaders.terrain) {
            const timeLocation = this.gl.getUniformLocation(newSet.terrain.program, "uTime");
            if (timeLocation !== null) {
                newSet.terrain.locations.time = timeLocation;
            }
        }

        if (shaders.character) {
            const timeLocation = this.gl.getUniformLocation(newSet.character.program, "uTime");
            if (timeLocation !== null) {
                newSet.character.locations.time = timeLocation;
            }
        }

        if (shaders.lines) {
            const timeLocation = this.gl.getUniformLocation(newSet.lines.program, "uTime");
            if (timeLocation !== null) {
                newSet.lines.locations.time = timeLocation;
            }
        }
    }

    cycleShaders() {
        const shaderNames = Array.from(this.shaders.keys());
        this.currentShaderIndex = (this.currentShaderIndex + 1) % shaderNames.length;
        console.log(`[ProgramRegistry] Switched to shader set: ${shaderNames[this.currentShaderIndex]}`);
    }

    getCurrentShaderSet() {
        const shaderNames = Array.from(this.shaders.keys());
        return this.shaders.get(shaderNames[this.currentShaderIndex]);
    }
}