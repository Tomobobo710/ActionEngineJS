// actionengine/display/graphics/lighting/lightingconstants.js

/**
 * LightingConstants provides centralized configuration for lighting and shadow settings.
 * These values can be modified at runtime through the debug panel.
 */
class LightingConstants {
    constructor() {
        // Light position and direction
        this.LIGHT_POSITION = {
            x: 0,
            y: 5000.0,
            z: 0,
            max: 50000,  // Maximum height/position
            min: -50000   // Minimum height/position
        };
        
        this.LIGHT_DIRECTION = {
            x: 0.0,
            y: -1.0,
            z: -0.0,
            min: -1.0,   // Direction component minimum
            max: 1.0,     // Direction component maximum
            step: 0.1
        };
        
        // Light properties
        this.LIGHT_INTENSITY = {
            value: 7500.0,
            min: 0,
            max: 100000
        };
        
        // Default shader intensity factor - controls how intensity affects non-PBR shaders
        this.DEFAULT_SHADER_INTENSITY_FACTOR = {
            value: 0.00001,  // Scale factor for default shader (smaller values = less dramatic effect)
            min: 0.000000000000001,
            max: 1.0,
            step: 0.00000000000001
        };
        
        // Material properties
        this.MATERIAL = {
            ROUGHNESS: {
                value: 0.2,
                min: 0.0,
                max: 1.0
            },
            METALLIC: {
                value: 0.1,
                min: 0.0,
                max: 1.0
            },
            BASE_REFLECTIVITY: {
                value: 0.5,
                min: 0.0,
                max: 1.0
            }
        };
        
        // Shadow map settings
        this.SHADOW_MAP = {
            SIZE: {
                value: 16384,   // Power of 2 for best performance
                options: [512, 1024, 2048, 4096, 8192, 16384],
                label: "Shadow Resolution"
            },
            BIAS: {
                value: 0.0732,   // Bias to prevent shadow acne - fine-tuned for testing
                min: -0.001,      // Narrower range focused on useful values
                max: 0.1,     // Maximum bias value for testing
                step: 0.0001    // Very small step for fine-grained control
            },
            TEXTURE_UNIT: 7   // WebGL texture unit used for shadow map
        };
        
        // Shadow projection settings - orthographic frustum for directional light
        this.SHADOW_PROJECTION = {
            LEFT: {
                value: -4096,
                min: -20000,
                max: 0,
                step: 10
            },
            RIGHT: {
                value: 4096,
                min: 0,
                max: 20000,
                step: 10
            },
            BOTTOM: {
                value: -4096,
                min: -20000,
                max: 0,
                step: 10
            },
            TOP: {
                value: 4096,
                min: 0,
                max: 20000,
                step: 10
            },
            NEAR: {
                value: 4300,
                min: 0.01,
                max: 50000,
                step: 1
            },
            FAR: {
                value: 5001,
                min: 0.1,
                max: 50000,
                step: 100
            },
            AUTO_FIT: false,  // Automatically fit shadow frustum to visible scene
            DISTANCE_MULTIPLIER: {
                value: 100,  // Multiplier for light target distance
                min: 10,
                max: 10000,
                step: 10
            }
        };
        
        // Shadow filtering settings
        this.SHADOW_FILTERING = {
            ENABLED: false,
            PCF: { // Percentage Closer Filtering
                ENABLED: true,
                SIZE: {
                    value: 9,  // Size of PCF kernel (3 = 3x3 sampling)
                    options: [1, 3, 5, 7, 9],
                    label: "PCF Kernel Size"
                }
            },
            SOFTNESS: {
                value: -0.7,  // Shadow softness (0 = hard, 1 = very soft)
                min: -60.0,
                max: 0.0,
                step: 0.01
            }
        };
        
        // Shadow quality presets
        this.SHADOW_QUALITY_PRESETS = [
            {
                name: "Low",
                mapSize: 1024,
                bias: 0.005,
                pcfSize: 3
            },
            {
                name: "Medium",
                mapSize: 2048,
                bias: 0.003,
                pcfSize: 5
            },
            {
                name: "High",
                mapSize: 4096,
                bias: 0.0015,
                pcfSize: 7
            },
            {
                name: "Ultra",
                mapSize: 8192,
                bias: 0.001,
                pcfSize: 9
            }
        ];
        
        // Debug settings
        this.DEBUG = {
            VISUALIZE_SHADOW_MAP: false,  // Display shadow map in corner
            VISUALIZE_FRUSTUM: true,      // Visualize shadow frustum
            FORCE_SHADOW_MAP_TEST: false, // Should never be used - was an unfinished AI concept
            LIGHT_VISUALIZATION_SIZE: {
                value: 20,
                min: 5,
                max: 100,
                step: 5
            }
        };
    }
    
    // Helper methods to apply quality presets
    applyShadowQualityPreset(presetIndex) {
        if (presetIndex < 0 || presetIndex >= this.SHADOW_QUALITY_PRESETS.length) {
            console.warn(`Invalid shadow quality preset index: ${presetIndex}`);
            return;
        }
        
        const preset = this.SHADOW_QUALITY_PRESETS[presetIndex];
        this.SHADOW_MAP.SIZE.value = preset.mapSize;
        this.SHADOW_MAP.BIAS.value = preset.bias;
        this.SHADOW_FILTERING.PCF.SIZE.value = preset.pcfSize;
        
        console.log(`Applied shadow quality preset: ${preset.name}`);
    }
    
    // Allow exporting full config for debugging/saving
    exportConfig() {
        return {
            lightPosition: { ...this.LIGHT_POSITION },
            lightDirection: { ...this.LIGHT_DIRECTION },
            lightIntensity: { ...this.LIGHT_INTENSITY },
            defaultShaderIntensityFactor: { ...this.DEFAULT_SHADER_INTENSITY_FACTOR },
            material: { ...this.MATERIAL },
            shadowMap: { ...this.SHADOW_MAP },
            shadowProjection: { ...this.SHADOW_PROJECTION },
            shadowFiltering: { ...this.SHADOW_FILTERING },
            shadowQualityPresets: [...this.SHADOW_QUALITY_PRESETS],
            debug: { ...this.DEBUG }
        };
    }
    
    // Import config (for loading saved settings)
    importConfig(config) {
        if (!config) return;
        
        // Helper function to safely copy properties
        const copyProps = (target, source) => {
            if (!source) return;
            Object.keys(target).forEach(key => {
                if (source[key] !== undefined) {
                    if (typeof target[key] === 'object' && !Array.isArray(target[key])) {
                        copyProps(target[key], source[key]);
                    } else {
                        target[key] = source[key];
                    }
                }
            });
        };
        
        copyProps(this.LIGHT_POSITION, config.lightPosition);
        copyProps(this.LIGHT_DIRECTION, config.lightDirection);
        copyProps(this.LIGHT_INTENSITY, config.lightIntensity);
        copyProps(this.DEFAULT_SHADER_INTENSITY_FACTOR, config.defaultShaderIntensityFactor);
        copyProps(this.MATERIAL, config.material);
        copyProps(this.SHADOW_MAP, config.shadowMap);
        copyProps(this.SHADOW_PROJECTION, config.shadowProjection);
        copyProps(this.SHADOW_FILTERING, config.shadowFiltering);
        copyProps(this.DEBUG, config.debug);
        
        console.log('Imported lighting configuration');
    }
}

// Create a global instance
const lightingConstants = new LightingConstants();
