// actionengine/display/graphics/lighting/lightmanager.js

/**
 * LightManager handles creation, management, and rendering of multiple light types
 * This class serves as a central registry for all lights in the scene
 */
class LightManager {
    /**
     * Constructor for the light manager
     * @param {WebGLRenderingContext} gl - The WebGL rendering context
     * @param {boolean} isWebGL2 - Flag indicating if WebGL2 is available
     * @param {ProgramManager} programManager - Reference to the program manager for shader access
     */
    constructor(gl, isWebGL2, programManager) {
        this.gl = gl;
        this.isWebGL2 = isWebGL2;
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
        const mainLight = new ActionDirectionalShadowLight(this.gl, this.isWebGL2, this.programManager);

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
        const light = new ActionDirectionalShadowLight(this.gl, this.isWebGL2, this.programManager);

        light.setPosition(position);
        light.setDirection(direction);

        if (color) {
            light.setColor(color);
        }

        light.setIntensity(intensity);
        light.setShadowsEnabled(castsShadows);

        this.directionalLights.push(light);
        this.lightDataDirty = true;  // Mark light data as needing update

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
        
        const light = new ActionOmnidirectionalShadowLight(this.gl, this.isWebGL2, this.programManager);

        light.setPosition(position);

        if (color) {
            light.setColor(color);
        }

        light.setIntensity(intensity);
        light.setRadius(radius);
        light.setShadowsEnabled(castsShadows);

        this.pointLights.push(light);
        this.lightDataDirty = true;  // Mark light data as needing update

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
                    this.lightDataDirty = true;  // Mark light data as needing update
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
            this.lightDataDirty = true;  // Mark light data as needing update
            return true;
        }

        const pointIndex = this.pointLights.indexOf(light);
        if (pointIndex !== -1) {
            light.dispose();
            this.pointLights.splice(pointIndex, 1);
            this.lightDataDirty = true;  // Mark light data as needing update
            return true;
        }

        const spotIndex = this.spotLights.indexOf(light);
        if (spotIndex !== -1) {
            light.dispose();
            this.spotLights.splice(spotIndex, 1);
            this.lightDataDirty = true;  // Mark light data as needing update
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

        // Only update every few frames for performance
        if (this.frameCount % 5 !== 0) {
            return false;
        }

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
     * Get light configuration for the main directional light
     * This maintains compatibility with existing code
     */
    getLightConfig() {
        const mainLight = this.getMainDirectionalLight();
        if (!mainLight) return null;

        return {
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
     * Render shadow maps for all shadow-casting lights
     * @param {Array} objects - Array of objects to render to shadow maps
     */
    renderShadowMaps(objects) {
        // Render directional light shadow maps
        for (const light of this.directionalLights) {
            if (light.getShadowsEnabled()) {
                light.beginShadowPass();

                // Render objects to shadow map
                for (const object of objects) {
                    if (object && object.triangles && object.triangles.length > 0) {
                        light.renderObjectToShadowMap(object);
                    }
                }

                light.endShadowPass();
            }
        }

        // Render point light shadow maps - Important: create separate shadow maps for each light
        for (let lightIndex = 0; lightIndex < this.pointLights.length; lightIndex++) {
            const light = this.pointLights[lightIndex];
            if (light.getShadowsEnabled()) {
                // For omnidirectional lights, we need to render the shadow map for each face (6 faces)
                for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
                    // Use light index as an identifier to ensure unique shadow maps per light
                    light.beginShadowPass(faceIndex, lightIndex);

                    // Render objects to shadow map for this face
                    for (const object of objects) {
                        if (object && object.triangles && object.triangles.length > 0) {
                            light.renderObjectToShadowMap(object);
                        }
                    }

                    light.endShadowPass();
                }
            }
        }

        // Render spot light shadow maps (future)
        // ...
    }

    /**
     * Apply all lights to the given shader program
     * @param {WebGLProgram} program - The shader program to apply lights to
     */
    applyLightsToShader(program) {
        const gl = this.gl;
        
        // Make sure light data textures are up-to-date
        this.updateLightDataTextures();
        
        // -- Set Light Counts --
        // Set directional light count
        const dirLightCountLoc = gl.getUniformLocation(program, "uDirectionalLightCount");
        if (dirLightCountLoc !== null) {
            gl.uniform1i(dirLightCountLoc, this.directionalLights.length);
        }
        
        // Set point light count
        const pointLightCountLoc = gl.getUniformLocation(program, "uPointLightCount");
        if (pointLightCountLoc !== null) {
            gl.uniform1i(pointLightCountLoc, this.pointLights.length);
        }
        
        // Set spot light count
        const spotLightCountLoc = gl.getUniformLocation(program, "uSpotLightCount");
        if (spotLightCountLoc !== null) {
            gl.uniform1i(spotLightCountLoc, this.spotLights.length);
        }
        
        // -- Set Texture Sizes --
        const dirLightTextureSizeLoc = gl.getUniformLocation(program, "uDirectionalLightTextureSize");
        if (dirLightTextureSizeLoc !== null) {
            const pixelsPerLight = 3; // Each light takes 3 pixels in the texture
            const textureWidth = Math.max(1, this.directionalLights.length * pixelsPerLight);
            gl.uniform2f(dirLightTextureSizeLoc, textureWidth, 1);
        }
        
        const pointLightTextureSizeLoc = gl.getUniformLocation(program, "uPointLightTextureSize");
        if (pointLightTextureSizeLoc !== null) {
            const pixelsPerLight = 3; // Each light takes 3 pixels in the texture
            const textureWidth = Math.max(1, this.pointLights.length * pixelsPerLight);
            gl.uniform2f(pointLightTextureSizeLoc, textureWidth, 1);
        }
        
        // -- Textures are bound by ObjectRenderer3D --
        // The actual texture binding happens in ObjectRenderer3D.drawObject
        // to avoid sampler conflicts and ensure proper WebGL texture units
        
        // -- Apply Legacy Light Uniforms for Backward Compatibility --
        // Main directional light shadow
        const mainLight = this.getMainDirectionalLight();
        if (mainLight) {
            // Still call applyToShader for uniforms that aren't in textures yet
            mainLight.applyToShader(program, 0);
        }
        else {
            // Make sure shader knows there's no main directional light
            const shadowsEnabledLoc = gl.getUniformLocation(program, "uShadowsEnabled");
            if (shadowsEnabledLoc !== null) {
                gl.uniform1i(shadowsEnabledLoc, 0); // 0 = false
            }
        }
        
        // Apply shadow maps for point lights (up to 4 with shadow mapping)
        // This sets the light-specific uniforms in the shader
        for (let i = 0; i < Math.min(this.pointLights.length, 4); i++) {
            const light = this.pointLights[i];
            if (light) {
                // Remove logging to reduce console spam
                light.applyToShader(program, i);
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
            // Try different approaches based on WebGL version and capabilities
            if (this.isWebGL2) {
                // Try high precision internal formats for WebGL2 first
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
                        // Last resort for WebGL2 - try standard RGBA format
                        console.warn('[LightManager] High precision formats not supported, falling back to standard RGBA with gl.FLOAT');
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, data);
                        return true;
                    }
                }
            } else {
                // For WebGL1, we need OES_texture_float extension
                const ext = gl.getExtension('OES_texture_float');
                if (ext) {
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, data);
                    // No logging to reduce console spam
                    return true;
                } else {
                    // If float textures aren't supported, fall back to UNSIGNED_BYTE
                    console.warn('[LightManager] Float textures not supported, falling back to UNSIGNED_BYTE');
                    
                    // If data was provided, convert it to UNSIGNED_BYTE
                    if (data) {
                        const byteData = new Uint8Array(data.length);
                        for (let i = 0; i < data.length; i++) {
                            // Scale float values (typically 0-1) to byte range (0-255)
                            byteData[i] = Math.min(255, Math.max(0, Math.floor(data[i] * 255)));
                        }
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, byteData);
                    } else {
                        // Just create an empty texture
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
                    }
                    return false;
                }
            }
        } catch (err) {
            // Final fallback if everything else fails
            console.error('[LightManager] Error creating float texture:', err, 'Using UNSIGNED_BYTE fallback');
            
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
                console.error('[LightManager] Critical error creating texture:', e);
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