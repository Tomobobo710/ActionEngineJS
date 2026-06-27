//actionengine/rendering/renderers/actionrenderer3D/glstatemanager.js

class GLStateManager {
    constructor(gl, lightManager, textureManager) {
        this.gl = gl;
        this.lightManager = lightManager;
        this.textureManager = textureManager;

        // Track current GL state to avoid redundant calls
        // Initialize to WebGL defaults (not what we'll set to, just the baseline)
        this._currentState = {
            program: null,
            blend: false, // WebGL default: disabled
            blendSrc: null, // Unknown until we set it
            blendDst: null, // Unknown until we set it
            depthTest: false, // WebGL default: disabled
            depthFunc: "LESS", // WebGL default
            depthMask: true, // WebGL default
            cullFace: false, // WebGL default: disabled
            frontFace: "CCW", // WebGL default
            activeTextureUnit: null,
            boundTextures: new Map() // unit -> { texture, type }
        };

        // Texture unit allocation - logical name to physical unit
        this._textureUnits = {
            materialProperties: 0,
            directionalLightData: 1,
            pointLightData: 2,
            directionalShadowMap: 3,
            pointShadowMap0: 10,
            pointShadowMap1: 11,
            pointShadowMap2: 12,
            pointShadowMap3: 13,
            directionalCascadeArray: 14, // CSM depth TEXTURE_2D_ARRAY (cascaded directional shadows)
            textureArray: 20,
            spriteTexture: 15
        };

        // State configurations for each renderer type
        this._stateConfigs = {
            object: {
                blend: true,
                blendFunc: { src: "SRC_ALPHA", dst: "ONE_MINUS_SRC_ALPHA" },
                depthTest: true,
                depthFunc: "LEQUAL",
                depthMask: true,
                cullFace: true,
                frontFace: "CCW",
                cullMode: "BACK"
            },
            water: {
                blend: true,
                blendFunc: { src: "SRC_ALPHA", dst: "ONE_MINUS_SRC_ALPHA" },
                depthTest: true,
                depthFunc: "LEQUAL",
                depthMask: true,
                cullFace: true,
                frontFace: "CCW",
                cullMode: "BACK"
            },
            sprite: {
                blend: true,
                blendFunc: { src: "SRC_ALPHA", dst: "ONE_MINUS_SRC_ALPHA" },
                depthTest: true,
                depthFunc: "LEQUAL",
                depthMask: true,
                cullFace: false
            },
            weather: {
                blend: true,
                blendFunc: { src: "SRC_ALPHA", dst: "ONE_MINUS_SRC_ALPHA" },
                depthTest: true,
                depthFunc: "LEQUAL",
                depthMask: true,
                cullFace: false
            },
            sun: {
                blend: true,
                blendFunc: { src: "SRC_ALPHA", dst: "ONE_MINUS_SRC_ALPHA" },
                depthTest: true,
                depthFunc: "LEQUAL",
                // depthMask MUST be true here. The sun is the last pass of a sun-lit scene; leaving
                // depth writes disabled means the NEXT scene's brand-new GLStateManager (which assumes
                // the WebGL default depthMask=true) desyncs from the actually-false shared GL context,
                // so its object pass silently skips re-enabling depth writes → broken depth on transition.
                depthMask: true,
                cullFace: false
            },
            debug: {
                blend: false,
                depthTest: true,
                depthFunc: "LEQUAL",
                depthMask: false,
                cullFace: false
            },
            shadowMapDebug: {
                blend: false,
                depthTest: false,
                depthMask: false,
                cullFace: false
            },
            shadow: {
                blend: false,
                depthTest: true,
                depthFunc: "LEQUAL",
                depthMask: true,
                cullFace: true,
                frontFace: "CCW",
                cullMode: "BACK"
            },
            transparent: {
                blend: true,
                blendFunc: { src: "SRC_ALPHA", dst: "ONE_MINUS_SRC_ALPHA" },
                depthTest: true,
                depthFunc: "LEQUAL",
                depthMask: true,
                cullFace: true,
                frontFace: "CCW",
                cullMode: "BACK"
            }
        };

        // Uniform location cache: WeakMap<WebGLProgram, Map<uniformName, WebGLUniformLocation|null>>
        // getUniformLocation() is a synchronous driver query that cannot be deferred or batched.
        // Caching eliminates all repeat calls after the first bind per program+name pair.
        // WeakMap ensures program entries are automatically cleaned up when programs are deleted.
        this._uniformLocationCache = new WeakMap();

        // Initialize GL state and viewport
        this._initializeGL();
    }

    _initializeGL() {
        // Set up viewport
        this.gl.viewport(0, 0, Game.WIDTH, Game.HEIGHT);

        // Set clear color (default light blue)
        this._setClearColor(0.529, 0.808, 0.922, 1.0);

        // Set initial capability states to WebGL defaults
        // DEPTH_TEST: disabled by default
        this.gl.disable(this.gl.DEPTH_TEST);
        this._currentState.depthTest = false;

        // BLEND: disabled by default
        this.gl.disable(this.gl.BLEND);
        this._currentState.blend = false;

        // CULL_FACE: disabled by default
        this.gl.disable(this.gl.CULL_FACE);
        this._currentState.cullFace = false;

        // DEPTH WRITE MASK: force it to match our assumed cache. The WebGL context is SHARED across
        // renderer instances (one per scene), so a previous scene may have left depthMask=false. Our
        // cache assumes the WebGL default (true); if we don't force GL to agree here, the first
        // setupState() that wants depthMask:true sees cache===true and skips the gl call, leaving the
        // context stuck with depth writes OFF → broken depth. Forcing it makes cache and GL consistent.
        this.gl.depthMask(true);
        this._currentState.depthMask = true;
    }

    setClearColor(r, g, b, a = 1.0) {
        this._setClearColor(r, g, b, a);
    }

    _setClearColor(r, g, b, a = 1.0) {
        this.gl.clearColor(r, g, b, a);
    }

    setupState(rendererType) {
        if (!this._stateConfigs[rendererType]) {
            console.warn(`GLStateManager: Unknown renderer type '${rendererType}'`);
            return;
        }

        const config = this._stateConfigs[rendererType];

        this._setCapability("blend", config.blend);

        if (config.blendFunc) {
            this._setBlendFunc(config.blendFunc.src, config.blendFunc.dst);
        }

        this._setCapability("depthTest", config.depthTest);

        if (config.depthFunc) {
            this._setDepthFunc(config.depthFunc);
        }

        if (config.depthMask !== undefined) {
            this._setDepthMask(config.depthMask);
        }

        this._setCapability("cullFace", config.cullFace);

        if (config.cullFace && config.cullMode) {
            this._setCullMode(config.cullMode);
        }

        if (config.frontFace) {
            this._setFrontFace(config.frontFace);
        }
    }

    bindTextureWithUniform(logicalName, texture, textureType, program, uniformName) {
        if (!texture || !program) {
            return;
        }

        const unit = this._textureUnits[logicalName];
        if (unit === undefined) {
            console.warn(`GLStateManager: Unknown texture unit '${logicalName}'`);
            return;
        }

        const glTextureType = this.gl[textureType];

        // Always ensure correct texture unit is active and bind texture
        this.gl.activeTexture(this.gl.TEXTURE0 + unit);
        this.gl.bindTexture(glTextureType, texture);
        this._currentState.activeTextureUnit = unit;
        this._currentState.boundTextures.set(unit, { texture, type: textureType });

        // Retrieve cached location, or look it up once and store it.
        // Avoids a synchronous driver round-trip on every texture bind per frame.
        let programUniforms = this._uniformLocationCache.get(program);
        if (!programUniforms) {
            programUniforms = new Map();
            this._uniformLocationCache.set(program, programUniforms);
        }
        let uniformLoc = programUniforms.get(uniformName);
        if (uniformLoc === undefined) {
            uniformLoc = this.gl.getUniformLocation(program, uniformName);
            programUniforms.set(uniformName, uniformLoc);
        }
        if (uniformLoc !== null) {
            this.gl.uniform1i(uniformLoc, unit);
        } else {
            console.warn(`GLStateManager: Uniform '${uniformName}' not found in program for texture '${logicalName}'`);
        }
    }

    getTextureUnit(logicalName) {
        return this._textureUnits[logicalName];
    }

    // Private helper methods
    _setCapability(capability, enabled) {
        // Map capability names to WebGL constants
        const capabilityMap = {
            blend: "BLEND",
            depthTest: "DEPTH_TEST",
            cullFace: "CULL_FACE"
        };

        const glCapabilityName = capabilityMap[capability];
        const glCapability = this.gl[glCapabilityName];

        if (this._currentState[capability] !== enabled) {
            if (enabled) {
                this.gl.enable(glCapability);
            } else {
                this.gl.disable(glCapability);
            }
            this._currentState[capability] = enabled;
        }
    }

    setBlendFunc(src, dst) {
        // Public API for changing blend function
        // Only set blendFunc if it's different from current state
        if (this._currentState.blendSrc !== src || this._currentState.blendDst !== dst) {
            const glSrc = this.gl[src];
            const glDst = this.gl[dst];

            this.gl.blendFunc(glSrc, glDst);
            this._currentState.blendSrc = src;
            this._currentState.blendDst = dst;
        }
    }

    _setBlendFunc(src, dst) {
        // Private alias for backwards compatibility
        this.setBlendFunc(src, dst);
    }

    _setDepthFunc(func) {
        const glFunc = this.gl[func];

        if (this._currentState.depthFunc !== func) {
            this.gl.depthFunc(glFunc);
            this._currentState.depthFunc = func;
        }
    }

    _setDepthMask(enabled) {
        if (this._currentState.depthMask !== enabled) {
            this.gl.depthMask(enabled);
            this._currentState.depthMask = enabled;
        }
    }

    _setCullMode(mode) {
        const glMode = this.gl[mode];
        this.gl.cullFace(glMode);
    }

    _setFrontFace(winding) {
        const glWinding = this.gl[winding];
        this.gl.frontFace(glWinding);
    }
}
