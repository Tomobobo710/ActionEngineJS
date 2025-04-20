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
            standard: {
                program: shaders.standard
                    ? this.createShaderProgram(shaders.standard.vertex, shaders.standard.fragment)
                    : defaultSet.standard.program,
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
        // Cache GL context
        const gl = this.gl;
        
        // Cache attribute and uniform name strings
        if (!this._attributeNames) {
            this._attributeNames = {
                position: 'aPosition',
                normal: 'aNormal',
                color: 'aColor',
                texCoord: 'aTexCoord',
                textureIndex: 'aTextureIndex',
                useTexture: 'aUseTexture'
            };
            
            this._uniformNames = {
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
                time: 'uTime'
            };
            
            this._textureUniforms = {
                standard: 'uTextureArray',
                pbr: 'uPBRTextureArray'
            };
        }
        
        // Helper function to efficiently get shader locations
        const getLocations = (program, isPBR = false) => {
            const attr = this._attributeNames;
            const unif = this._uniformNames;
            const tex = this._textureUniforms;
            
            // Get all attribute and uniform locations at once
            const locations = {
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
                cameraPos: gl.getUniformLocation(program, unif.cameraPos),
                time: gl.getUniformLocation(program, unif.time),
                
                // Texture uniform
                textureArray: gl.getUniformLocation(program, isPBR ? tex.pbr : tex.standard)
            };
            
            return locations;
        };

        // Set up locations for standard object shader
        if (shaders.standard) {
            const isPBR = shaders.name === 'pbr';
            newSet.standard.locations = getLocations(newSet.standard.program, isPBR);
        } else {
            newSet.standard.locations = defaultSet.standard.locations;
        }

        // Set up locations for character shader
        if (shaders.character) {
            const isPBR = shaders.name === 'pbr';
            newSet.character.locations = getLocations(newSet.character.program, isPBR);
        } else {
            newSet.character.locations = defaultSet.character.locations;
        }

        // Set up locations for line shader (simpler, no textures)
        if (shaders.lines) {
            newSet.lines.locations = {
                position: gl.getAttribLocation(newSet.lines.program, this._attributeNames.position),
                projectionMatrix: gl.getUniformLocation(newSet.lines.program, this._uniformNames.projectionMatrix),
                viewMatrix: gl.getUniformLocation(newSet.lines.program, this._uniformNames.viewMatrix),
                time: gl.getUniformLocation(newSet.lines.program, this._uniformNames.time)
            };
        } else {
            newSet.lines.locations = defaultSet.lines.locations;
        }
    }

    setupTimeUniforms(newSet, shaders) {
        if (shaders.standard) {
            const timeLocation = this.gl.getUniformLocation(newSet.standard.program, "uTime");
            if (timeLocation !== null) {
                newSet.standard.locations.time = timeLocation;
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