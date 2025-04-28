// actionengine/display/gl/programregistry.js
class ProgramRegistry {
    constructor(gl) {
        this.gl = gl;
        this.shaders = new Map();
        this.currentShaderIndex = 0;
        this.isWebGL2 = gl.getParameter(gl.VERSION).includes("WebGL 2.0");
    }

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
    
    registerShaderSet(name, shaders) {
        const defaultSet = this.shaders.get("default");

        // Create new shader set using defaults for any missing shaders
        const newSet = {
            standard: {
                program: shaders.standard
                    ? this.createShaderProgram(shaders.standard.vertex, shaders.standard.fragment, `${name}_standard`)
                    : defaultSet.standard.program,
                locations: null // Will set after program creation
            },
            // 'character' shader removed - characters now use 'standard' shader
            lines: {
                program: shaders.lines
                    ? this.createShaderProgram(shaders.lines.vertex, shaders.lines.fragment, `${name}_lines`)
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
                time: 'uTime',
                // Add shadow mapping uniforms
                lightSpaceMatrix: 'uLightSpaceMatrix',
                shadowMap: 'uShadowMap',
                shadowsEnabled: 'uShadowsEnabled'
            };
            
            this._textureUniforms = {
                standard: this.isWebGL2 ? 'uTextureArray' : 'uTexture',
                pbr: 'uPBRTextureArray',
                shadowMap: 'uShadowMap'  // Keep this as a separate texture type
            };
            
            // Pre-determined texture unit assignments to avoid conflicts
            this._textureUnits = {
                standard: 0,  // Texture array or standard texture uses unit 0
                pbr: 1,      // PBR textures use unit 1
                shadowMap: 7  // Shadow map uses unit 7 to avoid conflicts with all other textures
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
                
                // Shadow mapping uniforms
                lightSpaceMatrix: gl.getUniformLocation(program, unif.lightSpaceMatrix),
                shadowMap: gl.getUniformLocation(program, unif.shadowMap),
                shadowsEnabled: gl.getUniformLocation(program, unif.shadowsEnabled),
                
                // Texture uniform
                textureArray: gl.getUniformLocation(program, isPBR ? tex.pbr : tex.standard)
            };
            
            return locations;
        };

        // Set up locations for standard object shader
        if (shaders.standard) {
            const isPBR = name === 'pbr';
            newSet.standard.locations = getLocations(newSet.standard.program, isPBR);
        } else {
            newSet.standard.locations = defaultSet.standard.locations;
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
    
    /**
     * Get name of the current shader set
     * @returns {string} - The name of the current shader set
     */
    getCurrentShaderName() {
        const shaderNames = Array.from(this.shaders.keys());
        return shaderNames[this.currentShaderIndex];
    }
}