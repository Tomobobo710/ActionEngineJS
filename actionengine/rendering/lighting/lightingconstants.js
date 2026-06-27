//actionengine/rendering/lighting/lightingconstants.js

/**
 * LightingConstants provides centralized configuration for lighting and shadow settings.
 * These values can be modified at runtime through the debug panel.
 */
class LightingConstants {
    constructor() {
        this.LIGHT_DIRECTION = {
            x: 0.0,
            y: -1.0,
            z: -0.0,
            min: -1.0, // Direction component minimum
            max: 1.0, // Direction component maximum
            step: 0.1
        };

        // Light properties
        this.LIGHT_INTENSITY = {
            value: 2.5,
            min: 0,
            max: 100000
        };


        // Ambient and shadow intensity
        this.AMBIENT_INTENSITY = 0.35;
        this.SHADOW_DARKNESS = 0.75;

        // Hemisphere ambient tints (linear). Sky fills upward-facing surfaces, ground fills downward —
        // replaces the old flat-gray ambient so shadowed/indirect areas don't read dead-flat.
        this.AMBIENT_SKY_COLOR = { r: 0.55, g: 0.65, b: 0.85 }; // cool sky
        this.AMBIENT_GROUND_COLOR = { r: 0.35, g: 0.3, b: 0.25 }; // warm bounce
        // Linear-HDR output controls: exposure scales pre-tonemap, tonemap = ACES filmic + sRGB encode.
        this.EXPOSURE = { value: 1.0, min: 0.1, max: 4.0, step: 0.05 };
        this.TONEMAP = true;

        // Material properties
        this.MATERIAL = {
            ROUGHNESS: {
                value: 1.0,
                min: 0.0,
                max: 1.0
            },
            METALLIC: {
                value: 0.0,
                min: 0.0,
                max: 1.0
            },
            IOR: {
                value: 1.5,
                min: 1.0,
                max: 2.5
            },
            TRANSMISSION: {
                value: 0.0,
                min: 0.0,
                max: 1.0
            },
            VOLUME_THICKNESS: {
                value: 0.0,
                min: 0.0,
                max: 1.0
            },
            VOLUME_ATTENUATION_DISTANCE: {
                value: 1.0,
                min: 0.0,
                max: 10.0
            },
            VOLUME_COLOR: {
                r: 1.0,
                g: 1.0,
                b: 1.0
            },
            NORMAL_MAP_STRENGTH: {
                value: 1.0,
                min: 0.0,
                max: 2.0,
                step: 0.05
            }
        };

        // Shadow map settings
        this.SHADOW_MAP = {
            SIZE: {
                value: 4096, // Power of 2 for best performance
                options: [512, 1024, 2048, 4096, 8192, 16384],
                label: "Shadow Resolution"
            },
            SLOPE_CLAMP: {
                value: 6.5, // cap on tan(surface angle) so near-grazing surfaces don't blow the slope
                            // bias up toward infinity.
                min: 1.0,
                max: 16.0,
                step: 0.5
            }
        };

        // Shadow map settings
        this.POINT_LIGHT_SHADOW_MAP = {
            SIZE: {
                value: 2048, // Power of 2 for best performance
                options: [512, 1024, 2048, 4096, 8192, 16384],
                label: "Shadow Resolution"
            },
            BIAS: {
                value: 0.005, // Bias to prevent shadow acne - fine-tuned for testing
                min: -0.001, // Narrower range focused on useful values
                max: 0.1, // Maximum bias value for testing
                step: 0.0001 // Very small step for fine-grained control
            }
        };

        // Shadow projection settings
        this.SHADOW_PROJECTION = {
            AUTO_FIT: true, // Automatically fit shadow frustum to the camera view (see ActionShadowFit)
            AUTO_FIT_DISTANCE: {
                value: 250, // how far out from the camera shadows are fit (the shadow range)
                min: 20,
                max: 5000,
                step: 10
            },
            AUTO_PULLBACK: true, // derive pullback from actual caster bounds along the light axis
                                 // (see ActionShadowFit._autoPullback). When true, AUTO_FIT_PULLBACK
                                 // below is ignored — it's the manual override used only when false.
            AUTO_FIT_PULLBACK: {
                value: 200, // extra depth toward the light so tall off-screen casters still cast in
                min: 0,
                max: 5000,
                step: 10
            },
            DISTANCE_MULTIPLIER: {
                value: 100, // Multiplier for light target distance
                min: 10,
                max: 10000,
                step: 10
            }
        };

        // Auto-shadow fit tunables (consumed by ActionShadowFit via the renderer). Centralized HERE so
        // every auto-lighting knob lives in lightingConstants — nothing as a class static elsewhere.
        // The AutoShadowPanel reads/writes these directly (plain numbers, not {value} objects).
        this.AUTO_SHADOW = {
            DEPTH_SLACK_TEXELS: 6.0, // flat depth-bias slack (texels) — too little = acne, too much = float
            SLOPE_SLACK_TEXELS: 8.0, // slope-scaled bias slack (texels); negative pulls shadows onto tops/edges
            NORMAL_SLACK_TEXELS: -2.5, // normal-offset slack (texels) — kills acne without peter-panning
            TEXEL_SNAP: true, // snap box center to whole texels (anti edge-crawl when walking)
            RADIUS_QUANT: 16, // fit-radius quantization 1/N (anti resize-shimmer on zoom)
            PADDING: 0, // extra fit radius (world units) so frustum corners don't clip
            MAX_AUTO_PULLBACK: 5000, // clamp on auto-derived pullback (one stray tall caster can't blow depth range)

            // Cascaded Shadow Maps. When ENABLED, the single fitted box out to AUTO_FIT_DISTANCE is
            // replaced by COUNT cascades, each a tight fit over a sub-slice of [near, AUTO_FIT_DISTANCE].
            // Near cascades get a small slice at full map resolution (crisp contact shadows); far ones
            // cover the long tail. Each cascade auto-derives its OWN bias from its OWN slice radius/far
            // (the existing geometry-derived formula, run per-slice), so nothing new to tune per cascade.
            // MAX is a compile-time ceiling (shader sampler-array size); COUNT is the live 1..MAX choice.
            CSM: {
                ENABLED: false,
                MAX: 4, // compile-time cascade ceiling (objectshader MAX_CASCADES must match)
                // CSM's OWN overall range (far edge of the last cascade), DECOUPLED from the single-map
                // SHADOW_PROJECTION.AUTO_FIT_DISTANCE so the dev can keep the single-map distance small/
                // crisp while CSM reaches far. Much bigger ceiling — reaching far is the whole point of CSM.
                RANGE: { value: 500, min: 50, max: 5000, step: 25 },
                COUNT: { value: 3, min: 1, max: 4, step: 1 }, // live cascade count (clamped to MAX)
                LAMBDA: {
                    value: 0.5, // split blend: 0 = uniform splits (even world spacing, wastes near texels),
                    min: 0.0, //   1 = logarithmic (perspective-correct, near cascades tiny). 0.5 = practical PSSM.
                    max: 1.0,
                    step: 0.05
                },
                // Manual split override (Unity-style). When MANUAL_SPLITS is on, the interior cascade
                // boundaries come from SPLITS (fractions of CSM Range, where each cascade i ENDS) instead
                // of the LAMBDA auto-split. Only the first (COUNT-1) fractions are used; the last cascade
                // always ends at CSM Range. Off = LAMBDA drives (the auto default). This is the escape
                // hatch for "I know exactly where my detail clusters are" — same auto-with-override pattern
                // as Auto Pull → Pullback. Programmatic: csm: { splits: [0.1, 0.3, 0.6] } turns it on.
                MANUAL_SPLITS: false,
                SPLITS: [
                    { value: 0.1, min: 0.01, max: 0.99, step: 0.01 }, // cascade 0 ends here (fraction of range)
                    { value: 0.3, min: 0.01, max: 0.99, step: 0.01 }, // cascade 1 ends here
                    { value: 0.6, min: 0.01, max: 0.99, step: 0.01 } // cascade 2 ends here (used only at COUNT=4)
                ],
                BLEND_TEXELS: {
                    value: 8, // width of the dissolve band (in far-cascade texels) across a cascade boundary,
                    min: 0, //  so the resolution step between cascades doesn't show as a hard seam. 0 = hard switch.
                    max: 64,
                    step: 1
                }
            }
        };

        // Shadow filtering settings
        this.SHADOW_FILTERING = {
            ENABLED: false,
            PCF: {
                // Percentage Closer Filtering
                ENABLED: true,
                SIZE: {
                    value: 9, // Size of PCF kernel (3 = 3x3 sampling)
                    options: [1, 3, 5, 7, 9],
                    label: "PCF Kernel Size"
                }
            },
            SOFTNESS: {
                value: 0.2, // Shadow softness (0 = hard, 1 = very soft) — drives the PCSS light size
                min: 0.0,
                max: 1.0,
                step: 0.01
            },
            PCSS_MAX_TEXELS: {
                value: 24, // max penumbra width in texels at full softness; PCSS scales actual penumbra
                min: 1, //   between 1 and this by blocker distance (contact-hardening). Was hardcoded.
                max: 64,
                step: 1
            }
        };

        // Shadow quality presets
        this.SHADOW_QUALITY_PRESETS = [
            { name: "Low",    mapSize: 1024, pcfSize: 3 },
            { name: "Medium", mapSize: 2048, pcfSize: 5 },
            { name: "High",   mapSize: 4096, pcfSize: 7 },
            { name: "Ultra",  mapSize: 8192, pcfSize: 9 }
        ];

        // Debug settings
        this.DEBUG = {
            VISUALIZE_SHADOW_MAP: false,
            VISUALIZE_FRUSTUM: false,
            FORCE_SHADOW_MAP_TEST: false,
            DIRECTIONAL_LIGHT_ATTENUATION: false,
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
        this.SHADOW_FILTERING.PCF.SIZE.value = preset.pcfSize;

        console.log(`Applied shadow quality preset: ${preset.name}`);
    }

    // Export the full current state as an ActionLightingProfile-compatible options object.
    // The JSON produced here can be fed directly to new ActionLightingProfile(json).applyTo(lm).
    exportConfig() {
        const d = this.LIGHT_DIRECTION;
        const len = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z) || 1;
        const elevation = Math.asin(Math.max(-1, Math.min(1, -d.y / len))) * (180 / Math.PI);
        const azimuth = (Math.atan2(d.z / len, d.x / len) * (180 / Math.PI) + 360) % 360;
        const SP = this.SHADOW_PROJECTION;
        const SM = this.SHADOW_MAP;
        const SF = this.SHADOW_FILTERING;
        const AS = this.AUTO_SHADOW;
        const CSM = AS.CSM;
        return {
            sun: {
                elevation: Math.round(elevation * 10) / 10,
                azimuth:   Math.round(azimuth   * 10) / 10,
                intensity: this.LIGHT_INTENSITY.value
            },
            range:   SP.AUTO_FIT_DISTANCE.value,
            pullback: SP.AUTO_PULLBACK ? "auto" : SP.AUTO_FIT_PULLBACK.value,
            snap:    AS.TEXEL_SNAP,
            quant:   AS.RADIUS_QUANT,
            padding: AS.PADDING,
            map:     SM.SIZE.value,
            bias: {
                flat:       AS.DEPTH_SLACK_TEXELS,
                slope:      AS.SLOPE_SLACK_TEXELS,
                normal:     AS.NORMAL_SLACK_TEXELS,
                slopeClamp: SM.SLOPE_CLAMP.value
            },
            filter: {
                pcf:      SF.PCF.ENABLED,
                kernel:   SF.PCF.SIZE.value,
                softness: SF.SOFTNESS.value,
                darkness: this.SHADOW_DARKNESS,
                pcssMax:  SF.PCSS_MAX_TEXELS.value
            },
            csm: {
                enabled:      CSM.ENABLED,
                range:        CSM.RANGE.value,
                count:        CSM.COUNT.value,
                lambda:       CSM.LAMBDA.value,
                blend:        CSM.BLEND_TEXELS.value,
                manualSplits: CSM.MANUAL_SPLITS,
                ...(CSM.MANUAL_SPLITS ? { splits: CSM.SPLITS.map(s => s.value) } : {})
            },
            ambient: {
                intensity: this.AMBIENT_INTENSITY,
                sky:    [this.AMBIENT_SKY_COLOR.r,    this.AMBIENT_SKY_COLOR.g,    this.AMBIENT_SKY_COLOR.b],
                ground: [this.AMBIENT_GROUND_COLOR.r, this.AMBIENT_GROUND_COLOR.g, this.AMBIENT_GROUND_COLOR.b]
            },
            output: {
                exposure: this.EXPOSURE.value,
                tonemap:  this.TONEMAP
            }
        };
    }
}

// Create a global instance
const lightingConstants = new LightingConstants();
