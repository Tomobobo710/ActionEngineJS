// actionengine/display/graphics/lighting/lightmanager.js

/**
 * LightManager handles creation, management, and rendering of multiple light types
 * This class serves as a central registry for all lights in the scene
 */
class LightManager {
    /**
     * Constructor for the light manager
     * @param {WebGLRenderingContext} gl - The WebGL rendering context
     * @param {ProgramManager} programManager - Reference to the program manager for shader access
     */
    constructor(gl, programManager) {
        this.gl = gl;
        this.programManager = programManager;

        // Reference to lighting constants
        this.constants = lightingConstants;

        // Storage for different light types
        this.directionalLights = [];
        this.pointLights = [];
        this.spotLights = [];

        // Light data textures
        this.directionalLightDataTexture = null;
        this.pointLightDataTexture = null;
        this.spotLightDataTexture = null;

        // Flag to track if light data textures need updating
        this.lightDataDirty = true;

        // The main directional light (sun) is optional
        // It's not created by default, but can be created if needed
        this.mainDirectionalLightEnabled = true; // Flag to track whether directional light should be enabled
        if (this.mainDirectionalLightEnabled) {
            this.createMainDirectionalLight();
        }

        // Frame counter for updates
        this.frameCount = 0;

        // Cache for uniform locations keyed by WebGLProgram object.
        // Avoids repeated getUniformLocation() driver queries every frame.
        this._uniformLocationCache = new WeakMap();

        // Cached result of getLightConfig() — rebuilt only when lightDataDirty is set.
        // Avoids allocating a new plain-object tree on every frame from updateUniformCache().
        this._lightConfigCache = null;

        // Initialize the light data textures
        this.initializeLightDataTextures();
    }

    /**
     * Create the main directional light (sun) with default settings
     * @returns {ActionDirectionalShadowLight} - The created light or null if directional light is disabled
     */
    createMainDirectionalLight() {
        // If directional light is disabled, return null
        if (!this.mainDirectionalLightEnabled) {
            return null;
        }
        const mainLight = new ActionDirectionalShadowLight(this.gl, this.programManager);

        // Set initial properties from constants
        mainLight.setPosition(
            new Vector3(
                this.constants.LIGHT_POSITION.x,
                this.constants.LIGHT_POSITION.y,
                this.constants.LIGHT_POSITION.z
            )
        );

        mainLight.setDirection(
            new Vector3(
                this.constants.LIGHT_DIRECTION.x,
                this.constants.LIGHT_DIRECTION.y,
                this.constants.LIGHT_DIRECTION.z
            )
        );

        mainLight.setIntensity(this.constants.LIGHT_INTENSITY.value);

        // Add to the list of directional lights
        this.directionalLights.push(mainLight);

        return mainLight;
    }

    /**
     * Get the main directional light (sun)
     * @returns {ActionDirectionalShadowLight|null} - The main directional light or null if none exists
     */
    getMainDirectionalLight() {
        return this.directionalLights[0] || null;
    }

    /**
     * Enable or disable the main directional light
     * @param {boolean} enabled - Whether the directional light should be enabled
     */
    setMainDirectionalLightEnabled(enabled) {
        this.mainDirectionalLightEnabled = enabled;

        // When enabling the light, make sure the intensity in constants is non-zero
        if (enabled) {
            // Make sure the intensity in lighting constants is not 0
            if (this.constants.LIGHT_INTENSITY.value <= 0.001) {
                // Set to a reasonable default if it was zero
                this.constants.LIGHT_INTENSITY.value = 100.0;
            }

            // If no directional light exists, create one
            if (this.directionalLights.length === 0) {
                const light = this.createMainDirectionalLight();

                // Force update light from constants to make sure it has the right properties
                if (light) {
                    light.setIntensity(this.constants.LIGHT_INTENSITY.value);
                }
            }
            // If light already exists, make sure its properties match the constants
            else if (this.directionalLights.length > 0) {
                const light = this.directionalLights[0];
                if (light) {
                    light.setIntensity(this.constants.LIGHT_INTENSITY.value);
                }
            }
        }
        // If disabling and directional light exists, remove it
        else if (!enabled && this.directionalLights.length > 0) {
            // Store a reference to the light before removal
            const light = this.directionalLights[0];

            // Remove the light from the array first
            this.directionalLights.splice(0, 1);

            // Then dispose of its resources
            if (light) {
                light.dispose();
            }
        }
    }

    /**
     * Check if the main directional light is enabled
     * @returns {boolean} - Whether the directional light is enabled
     */
    isMainDirectionalLightEnabled() {
        return this.mainDirectionalLightEnabled;
    }

    /**
     * Create a new directional light
     * @param {Vector3} position - Initial position
     * @param {Vector3} direction - Initial direction
     * @param {Vector3} color - Light color (RGB, values 0-1)
     * @param {number} intensity - Light intensity
     * @param {boolean} castsShadows - Whether this light should cast shadows
     * @returns {ActionDirectionalShadowLight} - The created light
     */
    createDirectionalLight(position, direction, color, intensity, castsShadows = true) {
        const light = new ActionDirectionalShadowLight(this.gl, this.programManager);

        light.setPosition(position);
        light.setDirection(direction);

        if (color) {
            light.setColor(color);
        }

        light.setIntensity(intensity);
        light.setShadowsEnabled(castsShadows);

        this.directionalLights.push(light);
        this.lightDataDirty = true; // Mark light data as needing update
        this._lightConfigCache = null; // Invalidate config cache

        return light;
    }

    /**
     * Create a new omnidirectional point light
     * @param {Vector3} position - Initial position
     * @param {Vector3} color - Light color (RGB, values 0-1)
     * @param {number} intensity - Light intensity
     * @param {number} radius - Light radius (affects attenuation)
     * @param {boolean} castsShadows - Whether this light should cast shadows
     * @returns {ActionOmnidirectionalShadowLight} - The created light
     */
    createPointLight(position, color, intensity, radius = 100.0, castsShadows = false) {
        // Remove logging to reduce console spam

        const light = new ActionOmnidirectionalShadowLight(this.gl, this.programManager);

        light.setPosition(position);

        if (color) {
            light.setColor(color);
        }

        light.setIntensity(intensity);
        light.setRadius(radius);
        light.setShadowsEnabled(castsShadows);

        this.pointLights.push(light);
        this.lightDataDirty = true; // Mark light data as needing update
        this._lightConfigCache = null; // Invalidate config cache

        return light;
    }

    /**
     * Remove a light from the manager
     * @param {ActionLight} light - The light to remove
     * @returns {boolean} - True if the light was removed, false if not found
     */
    removeLight(light) {
        if (!light) return false;

        // Check each light type
        const directionalIndex = this.directionalLights.indexOf(light);
        if (directionalIndex !== -1) {
            // Allow removing the main light if it's the main directional light
            // and it matches the light parameter
            if (directionalIndex === 0) {
                // Only allow removal if we're explicitly disabling the main light
                if (!this.mainDirectionalLightEnabled) {
                    light.dispose();
                    this.directionalLights.splice(directionalIndex, 1);
                    this.lightDataDirty = true; // Mark light data as needing update
                    return true;
                } else {
                    console.warn(
                        "Cannot remove main directional light while it's enabled. Use setMainDirectionalLightEnabled(false) first."
                    );
                    return false;
                }
            }
            light.dispose();
            this.directionalLights.splice(directionalIndex, 1);
            this.lightDataDirty = true; // Mark light data as needing update
            return true;
        }

        const pointIndex = this.pointLights.indexOf(light);
        if (pointIndex !== -1) {
            light.dispose();
            this.pointLights.splice(pointIndex, 1);
            this.lightDataDirty = true; // Mark light data as needing update
            return true;
        }

        const spotIndex = this.spotLights.indexOf(light);
        if (spotIndex !== -1) {
            light.dispose();
            this.spotLights.splice(spotIndex, 1);
            this.lightDataDirty = true; // Mark light data as needing update
            return true;
        }

        return false;
    }

    /**
     * Update all lights
     * @returns {boolean} - Whether any lights changed this frame
     */
    update() {
        this.frameCount++;
        let changed = false;

        // Update directional lights
        for (const light of this.directionalLights) {
            const lightChanged = light.update();
            changed = changed || lightChanged;
        }

        // Update point lights
        for (const light of this.pointLights) {
            const lightChanged = light.update();
            changed = changed || lightChanged;
        }

        // Update spot lights (future)
        for (const light of this.spotLights) {
            const lightChanged = light.update();
            changed = changed || lightChanged;
        }

        // If any light has changed, mark light data as needing update
        if (changed) {
            this.lightDataDirty = true;
            this._lightConfigCache = null; // Invalidate config cache so position/intensity changes are picked up
        }

        return changed;
    }

    /**
     * Sync the main directional light with lighting constants
     * This maintains compatibility with the existing debug panel
     */
    syncWithConstants() {
        const mainLight = this.getMainDirectionalLight();
        if (mainLight) {
            mainLight.syncWithConstants();
        }
    }

    /**
     * Get light configuration for the main directional light.
     * Returns a cached object — only rebuilt when light data is marked dirty
     * (i.e. a light was added, removed, or had its properties changed).
     * This avoids creating a fresh plain-object tree on every frame from updateUniformCache().
     */
    getLightConfig() {
        const mainLight = this.getMainDirectionalLight();
        if (!mainLight) {
            this._lightConfigCache = null;
            return null;
        }

        // Return the cached config if it's still valid
        if (this._lightConfigCache !== null) {
            return this._lightConfigCache;
        }

        // Rebuild the cache
        this._lightConfigCache = {
            POSITION: {
                x: mainLight.position.x,
                y: mainLight.position.y,
                z: mainLight.position.z
            },
            DIRECTION: {
                x: mainLight.direction.x,
                y: mainLight.direction.y,
                z: mainLight.direction.z
            },
            INTENSITY: mainLight.intensity,
            MATERIAL: {
                ROUGHNESS: this.constants.MATERIAL.ROUGHNESS.value,
                METALLIC: this.constants.MATERIAL.METALLIC.value,
                BASE_REFLECTIVITY: this.constants.MATERIAL.BASE_REFLECTIVITY.value
            }
        };
        return this._lightConfigCache;
    }

    /**
     * Get the light space matrix from the main directional light
     * @returns {Float32Array|null} - The light space matrix or null if no directional light exists
     */
    getLightSpaceMatrix() {
        const mainLight = this.getMainDirectionalLight();
        return mainLight ? mainLight.getLightSpaceMatrix() : null;
    }

    /**
     * Get the direction vector from the main directional light
     * @returns {Vector3|null} - The direction vector or null if no directional light exists
     */
    getLightDir() {
        const mainLight = this.getMainDirectionalLight();
        return mainLight ? mainLight.getDirection() : null;
    }

    /**
     * Apply all lights to the given shader program
     * @param {WebGLProgram} program - The shader program to apply lights to
     * @param {GLStateManager} glStateManager - State manager for texture binding
     */
    /**
     * Query and cache all uniform locations for a given program (called once per program).
     * @private
     */
    _cacheUniformLocations(program) {
        const gl = this.gl;
        const locs = {
            // Light counts
            dirLightCount: gl.getUniformLocation(program, "uDirectionalLightCount"),
            pointLightCount: gl.getUniformLocation(program, "uPointLightCount"),
            spotLightCount: gl.getUniformLocation(program, "uSpotLightCount"),
            // Light texture sizes
            dirLightTextureSize: gl.getUniformLocation(program, "uDirectionalLightTextureSize"),
            pointLightTextureSize: gl.getUniformLocation(program, "uPointLightTextureSize"),
            // Shadow / directional
            shadowsEnabled: gl.getUniformLocation(program, "uShadowsEnabled"),
            shadowMap: gl.getUniformLocation(program, "uShadowMap"),
            lightSpaceMatrix: gl.getUniformLocation(program, "uLightSpaceMatrix"),
            // Point shadow maps (slots 0-3)
            pointShadowsEnabled0: gl.getUniformLocation(program, "uPointShadowsEnabled"),
            pointShadowMap0: gl.getUniformLocation(program, "uPointShadowMap"),
            pointShadowsEnabled1: gl.getUniformLocation(program, "uPointShadowsEnabled1"),
            pointShadowMap1: gl.getUniformLocation(program, "uPointShadowMap1"),
            pointShadowsEnabled2: gl.getUniformLocation(program, "uPointShadowsEnabled2"),
            pointShadowMap2: gl.getUniformLocation(program, "uPointShadowMap2"),
            pointShadowsEnabled3: gl.getUniformLocation(program, "uPointShadowsEnabled3"),
            pointShadowMap3: gl.getUniformLocation(program, "uPointShadowMap3")
        };
        this._uniformLocationCache.set(program, locs);
        return locs;
    }

    /**
     * Retrieve cached uniform locations for a program, building the cache if needed.
     * @private
     */
    _getUniformLocations(program) {
        return this._uniformLocationCache.get(program) || this._cacheUniformLocations(program);
    }

    applyLightsToShader(program, glStateManager) {
        const gl = this.gl;

        // Make sure light data textures are up-to-date
        this.updateLightDataTextures();

        // Retrieve all cached uniform locations for this program (zero driver queries)
        const locs = this._getUniformLocations(program);

        // -- Set Light Counts --
        if (locs.dirLightCount !== null) gl.uniform1i(locs.dirLightCount, this.directionalLights.length);
        if (locs.pointLightCount !== null) gl.uniform1i(locs.pointLightCount, this.pointLights.length);
        if (locs.spotLightCount !== null) gl.uniform1i(locs.spotLightCount, this.spotLights.length);

        // -- Set Texture Sizes --
        const pixelsPerLight = 3; // Each light takes 3 pixels in the texture
        if (locs.dirLightTextureSize !== null) {
            const textureWidth = Math.max(1, this.directionalLights.length * pixelsPerLight);
            gl.uniform2f(locs.dirLightTextureSize, textureWidth, 1);
        }
        if (locs.pointLightTextureSize !== null) {
            const textureWidth = Math.max(1, this.pointLights.length * pixelsPerLight);
            gl.uniform2f(locs.pointLightTextureSize, textureWidth, 1);
        }

        // -- Apply Legacy Light Uniforms for Backward Compatibility --
        const mainLight = this.getMainDirectionalLight();
        if (mainLight) {
            mainLight.applyToShader(program, 0);
        } else {
            if (locs.shadowsEnabled !== null) {
                gl.uniform1i(locs.shadowsEnabled, 0);
            }
        }

        // Apply point light uniforms (up to 4)
        for (let i = 0; i < Math.min(this.pointLights.length, 4); i++) {
            const light = this.pointLights[i];
            if (light) {
                light.applyToShader(program, i);
            }
        }

        // Bind shadow textures
        if (glStateManager) {
            this._bindShadowTextures(program, glStateManager, locs);
        }
    }

    /**
     * Bind shadow textures to shader program
     * @private
     */
    _bindShadowTextures(program, glStateManager, locs) {
        const gl = this.gl;

        // locs is already resolved by the caller — no getUniformLocation calls needed here.
        if (!locs) {
            locs = this._getUniformLocations(program);
        }

        // Bind directional light shadow map
        const mainLight = this.getMainDirectionalLight();
        if (mainLight && mainLight.shadowTexture && locs.shadowMap !== null) {
            glStateManager.bindTextureWithUniform(
                "directionalShadowMap",
                mainLight.shadowTexture,
                "TEXTURE_2D",
                program,
                "uShadowMap"
            );

            // Bind light space matrix using cached location
            if (locs.lightSpaceMatrix !== null) {
                const lightSpaceMatrix = mainLight.getLightSpaceMatrix();
                if (lightSpaceMatrix) {
                    gl.uniformMatrix4fv(locs.lightSpaceMatrix, false, lightSpaceMatrix);
                }
            }
        }

        // Point shadow map slots — use pre-resolved cached locations
        const pointShadowDefs = [
            {
                logicalName: "pointShadowMap0",
                uniformName: "uPointShadowMap",
                enabledLoc: locs.pointShadowsEnabled0,
                mapLoc: locs.pointShadowMap0
            },
            {
                logicalName: "pointShadowMap1",
                uniformName: "uPointShadowMap1",
                enabledLoc: locs.pointShadowsEnabled1,
                mapLoc: locs.pointShadowMap1
            },
            {
                logicalName: "pointShadowMap2",
                uniformName: "uPointShadowMap2",
                enabledLoc: locs.pointShadowsEnabled2,
                mapLoc: locs.pointShadowMap2
            },
            {
                logicalName: "pointShadowMap3",
                uniformName: "uPointShadowMap3",
                enabledLoc: locs.pointShadowsEnabled3,
                mapLoc: locs.pointShadowMap3
            }
        ];

        for (let i = 0; i < Math.min(this.pointLights.length, pointShadowDefs.length); i++) {
            const pointLight = this.pointLights[i];
            const def = pointShadowDefs[i];

            if (pointLight && pointLight.shadowTexture && def.enabledLoc !== null) {
                glStateManager.bindTextureWithUniform(
                    def.logicalName,
                    pointLight.shadowTexture,
                    "TEXTURE_CUBE_MAP",
                    program,
                    def.uniformName
                );
                gl.uniform1i(def.enabledLoc, 1);
            } else if (def.enabledLoc !== null) {
                gl.uniform1i(def.enabledLoc, 0);
            }
        }

        // Disable shadow slots beyond the active point light count
        for (let i = this.pointLights.length; i < pointShadowDefs.length; i++) {
            const def = pointShadowDefs[i];
            if (def.enabledLoc !== null) {
                gl.uniform1i(def.enabledLoc, 0);
            }
        }
    }

    /**
     * Apply shadow quality preset to all shadow-casting lights
     * @param {number} presetIndex - Index of the preset to apply
     */
    setShadowQuality(presetIndex) {
        // Apply to all directional lights
        for (const light of this.directionalLights) {
            if (light.getShadowsEnabled()) {
                light.setQualityPreset(presetIndex);
            }
        }

        // Apply to all point lights
        for (const light of this.pointLights) {
            if (light.getShadowsEnabled()) {
                light.setQualityPreset(presetIndex);
            }
        }
    }

    /**
     * Get shadow map size from the main directional light
     * @returns {number} - The shadow map size
     */
    getShadowMapSize() {
        const mainLight = this.getMainDirectionalLight();
        return mainLight ? mainLight.shadowMapSize : this.constants.SHADOW_MAP.SIZE.value;
    }

    /**
     * Get shadow bias from the main directional light
     * @returns {number} - The shadow bias
     */
    getShadowBias() {
        const mainLight = this.getMainDirectionalLight();
        return mainLight ? mainLight.shadowBias : this.constants.SHADOW_MAP.BIAS.value;
    }

    /**
     * Cleanup and dispose of all lights
     */
    /**
     * Initialize light data textures for all light types
     */
    initializeLightDataTextures() {
        const gl = this.gl;

        // Create a texture for directional light data
        this.directionalLightDataTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.directionalLightDataTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Create initial empty texture data (will be updated later)
        this.createEmptyFloatTexture(this.directionalLightDataTexture, 1, 1);

        // Create a texture for point light data
        this.pointLightDataTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.pointLightDataTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Create initial empty texture data (will be updated later)
        this.createEmptyFloatTexture(this.pointLightDataTexture, 1, 1);

        // Unbind texture
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    /**
     * Helper method to create an empty float texture with fallbacks for various WebGL implementations
     * @param {WebGLTexture} texture - The texture object to initialize
     * @param {number} width - Width of the texture
     * @param {number} height - Height of the texture
     * @param {Float32Array} data - Optional data to fill the texture with
     * @returns {boolean} - Whether the texture was created successfully
     */
    createEmptyFloatTexture(texture, width, height, data = null) {
        const gl = this.gl;

        try {
            // WebGL2 uses high precision internal formats
            try {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
                // No logging to reduce console spam
                return true;
            } catch (e) {
                // If RGBA32F fails, try RGBA16F
                try {
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.FLOAT, data);
                    // No logging to reduce console spam
                    return true;
                } catch (e2) {
                    // Last resort - try standard RGBA format
                    console.warn(
                        "[LightManager] High precision formats not supported, falling back to standard RGBA with gl.FLOAT"
                    );
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, data);
                    return true;
                }
            }
        } catch (err) {
            // Final fallback if everything else fails
            console.error("[LightManager] Error creating float texture:", err, "Using UNSIGNED_BYTE fallback");

            // Convert to UNSIGNED_BYTE as last resort
            try {
                if (data) {
                    const byteData = new Uint8Array(data.length);
                    for (let i = 0; i < data.length; i++) {
                        byteData[i] = Math.min(255, Math.max(0, Math.floor(data[i] * 255)));
                    }
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, byteData);
                } else {
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
                }
                return false;
            } catch (e) {
                console.error("[LightManager] Critical error creating texture:", e);
                return false;
            }
        }
    }

    /**
     * Update the directional light data texture
     */
    updateDirectionalLightDataTexture() {
        const gl = this.gl;

        // Skip if there are no directional lights
        if (this.directionalLights.length === 0) {
            return;
        }

        // Each light needs multiple pixels for all its data
        // Position: RGBA (xyz, enabled)
        // Direction: RGBA (xyz, shadowEnabled)
        // Color+Intensity: RGBA (rgb, intensity)
        // We'll use 3 horizontal pixels per light

        const pixelsPerLight = 3;
        const textureWidth = Math.max(1, this.directionalLights.length * pixelsPerLight);
        const textureHeight = 1; // Just one row needed

        // Create a Float32Array to hold all light data
        const data = new Float32Array(textureWidth * textureHeight * 4); // 4 components per pixel (RGBA)

        // Fill the data array with light properties
        for (let i = 0; i < this.directionalLights.length; i++) {
            const light = this.directionalLights[i];
            const baseIndex = i * pixelsPerLight * 4; // Each pixel has 4 components (RGBA)

            // First pixel: Position (xyz) + enabled flag
            data[baseIndex] = light.position.x;
            data[baseIndex + 1] = light.position.y;
            data[baseIndex + 2] = light.position.z;
            data[baseIndex + 3] = 1.0; // Enabled

            // Second pixel: Direction (xyz) + shadow enabled flag
            data[baseIndex + 4] = light.direction.x;
            data[baseIndex + 5] = light.direction.y;
            data[baseIndex + 6] = light.direction.z;
            data[baseIndex + 7] = light.getShadowsEnabled() ? 1.0 : 0.0;

            // Third pixel: Color (rgb) + intensity
            const color = light.getColor();
            data[baseIndex + 8] = color.x;
            data[baseIndex + 9] = color.y;
            data[baseIndex + 10] = color.z;
            data[baseIndex + 11] = light.intensity;
        }

        // Upload data to the texture
        gl.bindTexture(gl.TEXTURE_2D, this.directionalLightDataTexture);
        this.createEmptyFloatTexture(this.directionalLightDataTexture, textureWidth, textureHeight, data);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    /**
     * Update the point light data texture
     */
    updatePointLightDataTexture() {
        const gl = this.gl;

        // Skip if there are no point lights
        if (this.pointLights.length === 0) {
            return;
        }

        // Each light needs multiple pixels for all its data
        // Position: RGBA (xyz, enabled)
        // Color+Intensity: RGBA (rgb, intensity)
        // Radius+Shadow: RGBA (radius, shadowEnabled, 0, 0)
        // We'll use 3 horizontal pixels per light

        const pixelsPerLight = 3;
        const textureWidth = Math.max(1, this.pointLights.length * pixelsPerLight);
        const textureHeight = 1; // Just one row needed

        // Create a Float32Array to hold all light data
        const data = new Float32Array(textureWidth * textureHeight * 4); // 4 components per pixel (RGBA)

        // Fill the data array with light properties
        for (let i = 0; i < this.pointLights.length; i++) {
            const light = this.pointLights[i];
            const baseIndex = i * pixelsPerLight * 4; // Each pixel has 4 components (RGBA)

            // First pixel: Position (xyz) + enabled flag
            data[baseIndex] = light.position.x;
            data[baseIndex + 1] = light.position.y;
            data[baseIndex + 2] = light.position.z;
            data[baseIndex + 3] = 1.0; // Enabled

            // Second pixel: Color (rgb) + intensity
            const color = light.getColor();
            data[baseIndex + 4] = color.x;
            data[baseIndex + 5] = color.y;
            data[baseIndex + 6] = color.z;
            data[baseIndex + 7] = light.intensity;

            // Third pixel: Radius + shadow enabled flag + padding
            data[baseIndex + 8] = light.radius;
            data[baseIndex + 9] = light.getShadowsEnabled() ? 1.0 : 0.0;
            data[baseIndex + 10] = 0.0; // Padding
            data[baseIndex + 11] = 0.0; // Padding
        }

        // Upload data to the texture
        gl.bindTexture(gl.TEXTURE_2D, this.pointLightDataTexture);
        this.createEmptyFloatTexture(this.pointLightDataTexture, textureWidth, textureHeight, data);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    /**
     * Update all light data textures if needed
     */
    updateLightDataTextures() {
        if (this.lightDataDirty) {
            this.updateDirectionalLightDataTexture();
            this.updatePointLightDataTexture();
            this.lightDataDirty = false;
        }
    }

    dispose() {
        // Clean up all lights
        for (const light of this.directionalLights) {
            light.dispose();
        }
        this.directionalLights = [];

        for (const light of this.pointLights) {
            light.dispose();
        }
        this.pointLights = [];

        for (const light of this.spotLights) {
            light.dispose();
        }
        this.spotLights = [];

        // Clean up light data textures
        const gl = this.gl;
        if (this.directionalLightDataTexture) {
            gl.deleteTexture(this.directionalLightDataTexture);
            this.directionalLightDataTexture = null;
        }
        if (this.pointLightDataTexture) {
            gl.deleteTexture(this.pointLightDataTexture);
            this.pointLightDataTexture = null;
        }
    }
}
