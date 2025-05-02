// actionengine/display/graphics/renderers/actionrenderer3D/lightingmanager.js
class LightingManager {
    constructor(gl, isWebGL2) {
        this.gl = gl;
        this.isWebGL2 = isWebGL2;
        
        // Matrix for debug panel compatibility
        this.lightView = Matrix4.create();
        this.lightSpaceMatrix = Matrix4.create();
        this.lightProjection = Matrix4.create();

        // Use the global lighting constants for configuration
        this.constants = lightingConstants;
        
        // Initialize current configuration based on constants
        this.currentLightConfig = {
            POSITION: {
                x: this.constants.LIGHT_POSITION.x,
                y: this.constants.LIGHT_POSITION.y,
                z: this.constants.LIGHT_POSITION.z
            },
            DIRECTION: {
                x: this.constants.LIGHT_DIRECTION.x,
                y: this.constants.LIGHT_DIRECTION.y,
                z: this.constants.LIGHT_DIRECTION.z
            },
            INTENSITY: this.constants.LIGHT_INTENSITY.value,
            MATERIAL: {
                ROUGHNESS: this.constants.MATERIAL.ROUGHNESS.value,
                METALLIC: this.constants.MATERIAL.METALLIC.value,
                BASE_REFLECTIVITY: this.constants.MATERIAL.BASE_REFLECTIVITY.value
            },
        };

        // Create light position vector
        this.lightPos = new Vector3(
            this.currentLightConfig.POSITION.x,
            this.currentLightConfig.POSITION.y,
            this.currentLightConfig.POSITION.z
        );
        
        // Frame counter for light updates
        this.frameCount = 0;
        
        console.log("LightingManager initialized with constants");
    }

    getLightConfig() {
        return this.currentLightConfig;
    }

    // For debug panel
    updateLightMatrix() {
        // Just update the light position from config
        this.lightPos.x = this.currentLightConfig.POSITION.x;
        this.lightPos.y = this.currentLightConfig.POSITION.y;
        this.lightPos.z = this.currentLightConfig.POSITION.z;
    }

    getLightSpaceMatrix() {
        return this.lightSpaceMatrix;
    }

    getLightDir() {
        // Create direction vector
        const dir = new Vector3(
            this.currentLightConfig.DIRECTION.x,
            this.currentLightConfig.DIRECTION.y,
            this.currentLightConfig.DIRECTION.z
        );
        
        // Safety check: ensure the direction is not zero
        if (Math.abs(dir.x) < 0.0001 && Math.abs(dir.y) < 0.0001 && Math.abs(dir.z) < 0.0001) {
            console.warn('Light direction vector is near zero, defaulting to (0,-1,-0.0001)');
            return new Vector3(0, -1, -0.0001).normalize();
        }
        
        // Normalize the direction vector
        return dir.normalize();
    }

    // Sync lighting configuration with constants
    // Can be called when constants are modified through debug panel
    syncWithConstants() {
        this.currentLightConfig.POSITION.x = this.constants.LIGHT_POSITION.x;
        this.currentLightConfig.POSITION.y = this.constants.LIGHT_POSITION.y;
        this.currentLightConfig.POSITION.z = this.constants.LIGHT_POSITION.z;
        
        this.currentLightConfig.DIRECTION.x = this.constants.LIGHT_DIRECTION.x;
        this.currentLightConfig.DIRECTION.y = this.constants.LIGHT_DIRECTION.y;
        this.currentLightConfig.DIRECTION.z = this.constants.LIGHT_DIRECTION.z;
        
        this.currentLightConfig.INTENSITY = this.constants.LIGHT_INTENSITY.value;
        
        this.currentLightConfig.MATERIAL.ROUGHNESS = this.constants.MATERIAL.ROUGHNESS.value;
        this.currentLightConfig.MATERIAL.METALLIC = this.constants.MATERIAL.METALLIC.value;
        this.currentLightConfig.MATERIAL.BASE_REFLECTIVITY = this.constants.MATERIAL.BASE_REFLECTIVITY.value;
        
        // Update light position
        this.updateLightMatrix();
    }
    
    // Apply a shadow quality preset
    setShadowQuality(presetIndex) {
        this.constants.applyShadowQualityPreset(presetIndex);
    }
    
    // Get shadow map size from constants
    getShadowMapSize() {
        return this.constants.SHADOW_MAP.SIZE.value;
    }
    
    // Get shadow bias from constants
    getShadowBias() {
        return this.constants.SHADOW_MAP.BIAS.value;
    }
    
    // Get shadow texture unit from constants
    getShadowTextureUnit() {
        return this.constants.SHADOW_MAP.TEXTURE_UNIT;
    }
    
    // Get shadow projection parameters
    getShadowProjection() {
        return {
            left: this.constants.SHADOW_PROJECTION.LEFT.value,
            right: this.constants.SHADOW_PROJECTION.RIGHT.value,
            bottom: this.constants.SHADOW_PROJECTION.BOTTOM.value,
            top: this.constants.SHADOW_PROJECTION.TOP.value,
            near: this.constants.SHADOW_PROJECTION.NEAR.value,
            far: this.constants.SHADOW_PROJECTION.FAR.value
        };
    }

    update() {
        this.frameCount++;
        let changed = false;
        
        // Check if light position or direction has changed
        if (this._lastPosition === undefined || 
            this._lastPosition.x !== this.currentLightConfig.POSITION.x ||
            this._lastPosition.y !== this.currentLightConfig.POSITION.y ||
            this._lastPosition.z !== this.currentLightConfig.POSITION.z ||
            this._lastDirection === undefined ||
            this._lastDirection.x !== this.currentLightConfig.DIRECTION.x ||
            this._lastDirection.y !== this.currentLightConfig.DIRECTION.y ||
            this._lastDirection.z !== this.currentLightConfig.DIRECTION.z) {
            
            // Update light position
            this.updateLightMatrix();
            
            // Cache current values to detect changes
            this._lastPosition = {
                x: this.currentLightConfig.POSITION.x,
                y: this.currentLightConfig.POSITION.y,
                z: this.currentLightConfig.POSITION.z
            };
            
            this._lastDirection = {
                x: this.currentLightConfig.DIRECTION.x,
                y: this.currentLightConfig.DIRECTION.y,
                z: this.currentLightConfig.DIRECTION.z
            };
            
            changed = true; // Light changed
        }
        
        // Track intensity for debugging purposes only
        if (this._lastIntensity === undefined ||
            Math.abs(this._lastIntensity - this.currentLightConfig.INTENSITY) > 1000) {
            
            this._lastIntensity = this.currentLightConfig.INTENSITY;
            changed = true; // Light changed
        }
        
        return changed;
    }
    
    // Debug helper to visualize light position and direction
    drawLightDebug(renderer) {
        if (!renderer || !this.constants.DEBUG.VISUALIZE_FRUSTUM) return;
        
        // Draw light position marker
        const lightSize = this.constants.DEBUG.LIGHT_VISUALIZATION_SIZE.value;
        
        // Draw line representing light direction
        const dirEndPoint = new Vector3(
            this.lightPos.x + this.currentLightConfig.DIRECTION.x * lightSize * 2,
            this.lightPos.y + this.currentLightConfig.DIRECTION.y * lightSize * 2,
            this.lightPos.z + this.currentLightConfig.DIRECTION.z * lightSize * 2
        );
        
        // TODO: Implement actual line drawing logic for debug visualization
    }
}