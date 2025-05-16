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
        
        // Create the main directional light (sun) by default
        // This maintains compatibility with existing code
        this.createMainDirectionalLight();
        
        // Frame counter for updates
        this.frameCount = 0;
    }
    
    /**
     * Create the main directional light (sun) with default settings
     * @returns {ActionDirectionalShadowLight} - The created light
     */
    createMainDirectionalLight() {
        const mainLight = new ActionDirectionalShadowLight(
            this.gl,
            this.isWebGL2,
            this.programManager
        );
        
        // Set initial properties from constants
        mainLight.setPosition(new Vector3(
            this.constants.LIGHT_POSITION.x,
            this.constants.LIGHT_POSITION.y,
            this.constants.LIGHT_POSITION.z
        ));
        
        mainLight.setDirection(new Vector3(
            this.constants.LIGHT_DIRECTION.x,
            this.constants.LIGHT_DIRECTION.y,
            this.constants.LIGHT_DIRECTION.z
        ));
        
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
     * Create a new directional light
     * @param {Vector3} position - Initial position
     * @param {Vector3} direction - Initial direction
     * @param {Vector3} color - Light color (RGB, values 0-1)
     * @param {number} intensity - Light intensity
     * @param {boolean} castsShadows - Whether this light should cast shadows
     * @returns {ActionDirectionalShadowLight} - The created light
     */
    createDirectionalLight(position, direction, color, intensity, castsShadows = true) {
        const light = new ActionDirectionalShadowLight(
            this.gl,
            this.isWebGL2,
            this.programManager
        );
        
        light.setPosition(position);
        light.setDirection(direction);
        
        if (color) {
            light.setColor(color);
        }
        
        light.setIntensity(intensity);
        light.setShadowsEnabled(castsShadows);
        
        this.directionalLights.push(light);
        
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
    createPointLight(position, color, intensity, radius = 100.0, castsShadows = true) {
        const light = new ActionOmnidirectionalShadowLight(
            this.gl,
            this.isWebGL2,
            this.programManager
        );
        
        light.setPosition(position);
        
        if (color) {
            light.setColor(color);
        }
        
        light.setIntensity(intensity);
        light.setRadius(radius);
        light.setShadowsEnabled(castsShadows);
        
        this.pointLights.push(light);
        
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
            // Don't remove the main light (index 0) to maintain compatibility
            if (directionalIndex === 0) {
                console.warn("Cannot remove main directional light");
                return false;
            }
            light.dispose();
            this.directionalLights.splice(directionalIndex, 1);
            return true;
        }
        
        const pointIndex = this.pointLights.indexOf(light);
        if (pointIndex !== -1) {
            light.dispose();
            this.pointLights.splice(pointIndex, 1);
            return true;
        }
        
        const spotIndex = this.spotLights.indexOf(light);
        if (spotIndex !== -1) {
            light.dispose();
            this.spotLights.splice(spotIndex, 1);
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
        
        // Render point light shadow maps
        for (const light of this.pointLights) {
            if (light.getShadowsEnabled()) {
                // For omnidirectional lights, we need to render the shadow map for each face (6 faces)
                for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
                    light.beginShadowPass(faceIndex);
                    
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
        
        // Apply directional light (for backward compatibility)
        const mainLight = this.getMainDirectionalLight();
        if (mainLight) {
            mainLight.applyToShader(program);
        }
        
        // Apply point light (if exists)
        if (this.pointLights.length > 0) {
            const pointLight = this.pointLights[0]; // Just use the first point light for now
            if (pointLight) {
                pointLight.applyToShader(program);
                
                // Set point light count uniform
                const pointLightCountLoc = gl.getUniformLocation(program, "uPointLightCount");
                if (pointLightCountLoc !== null) {
                    gl.uniform1i(pointLightCountLoc, this.pointLights.length);
                }
            }
        } else {
            // No point lights - set count to 0
            const pointLightCountLoc = gl.getUniformLocation(program, "uPointLightCount");
            if (pointLightCountLoc !== null) {
                gl.uniform1i(pointLightCountLoc, 0);
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
    }
}