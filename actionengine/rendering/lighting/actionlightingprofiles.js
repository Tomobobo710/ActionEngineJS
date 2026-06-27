//actionengine/rendering/lighting/actionlightingprofiles.js

/**
 * ActionLightingProfile - a developer-constructed bundle of lighting/auto-shadow options.
 *
 * The engine ships the CLASS (the schema + the apply logic); the GAME constructs its own profiles.
 * The engine deliberately knows NOTHING about any specific game's scenes — there are no built-in
 * "fpsArena"/"rpgLarge" presets baked in here. A game owns its lighting:
 *
 *     const fpsLighting = new ActionLightingProfile({
 *         autoFit: true,
 *         sun: { direction: [-0.9, -1.0, -0.6], intensity: 2.5 },
 *         range: 250,
 *         bias: { flat: 13, slope: -2.5, normal: -2.5 },
 *         ambient: { sky: [0.55, 0.65, 0.85], ground: [0.35, 0.3, 0.25] },
 *         output: { exposure: 1.0, tonemap: true }
 *     });
 *
 *     renderer3D.applyLightingProfile(fpsLighting);   // or fpsLighting.applyTo(renderer3D);
 *
 * Semantics are PARTIAL/override: applying a profile writes ONLY the fields you set, on top of the
 * current lightingConstants (which already start at sane engine defaults). So a profile states only
 * what's special about a scene. applyTo() also re-syncs the sun, so the "light was created from
 * defaults before the profile ran" ordering gotcha is handled inside the engine, not by each game.
 *
 * Options schema (all optional):
 *   autoFit  : bool                            // auto shadow-fit on/off
 *   sun      : { direction:[x,y,z]             // OR elevation/azimuth (degrees)
 *                elevation, azimuth,
 *                intensity, position:[x,y,z] } // position = visual sun-disc location
 *   range    : number                          // auto-fit shadow distance
 *   pullback : 'auto' | number                 // 'auto' = derive from casters; number = manual
 *   snap, quant, padding, map                  // fit knobs
 *   bias     : { flat, slope, normal, slopeClamp }
 *   ambient  : { intensity, sky:[r,g,b], ground:[r,g,b] }
 *   output   : { exposure, tonemap:bool }
 *   filter   : { pcf:bool, kernel, softness, darkness, pcssMax }
 *   csm      : { enabled:bool, range, count, lambda, blend,
 *                splits:[f,f,...] }  // cascaded shadow maps; splits = Unity-style manual split
 *                                    // fractions of range (presence turns manual mode on)
 */
class ActionLightingProfile {
    /**
     * @param {Object} options - the profile options (see schema above). Stored verbatim; only the
     *                            fields present are applied.
     */
    constructor(options = {}) {
        this.options = options || {};
    }

    /**
     * Apply this profile to a renderer (or a light manager) and re-sync the sun.
     * @param {Object} target - an ActionRenderer3D (has .lightManager) or a LightManager (has .constants)
     * @returns {boolean} true once applied
     */
    applyTo(target) {
        if (!target) return false;
        const lightManager = target.lightManager || target; // accept a renderer or a light manager
        const C = lightManager && lightManager.constants;
        if (!C) {
            console.warn("[ActionLightingProfile] No lightingConstants reachable from target.");
            return false;
        }
        const p = this.options;

        // --- sun direction / angle / intensity / disc position ---
        if (p.sun) {
            if (p.sun.direction) {
                C.LIGHT_DIRECTION.x = p.sun.direction[0];
                C.LIGHT_DIRECTION.y = p.sun.direction[1];
                C.LIGHT_DIRECTION.z = p.sun.direction[2];
            } else if (p.sun.elevation !== undefined || p.sun.azimuth !== undefined) {
                const cur = ActionLightingProfile._currentAngles(C);
                const el = (p.sun.elevation !== undefined ? p.sun.elevation : cur.elevation) * (Math.PI / 180);
                const az = (p.sun.azimuth !== undefined ? p.sun.azimuth : cur.azimuth) * (Math.PI / 180);
                const horiz = Math.cos(el);
                C.LIGHT_DIRECTION.x = horiz * Math.cos(az);
                C.LIGHT_DIRECTION.y = -Math.sin(el);
                C.LIGHT_DIRECTION.z = horiz * Math.sin(az);
            }
            if (p.sun.intensity !== undefined) C.LIGHT_INTENSITY.value = p.sun.intensity;
            if (p.sun.enabled !== undefined && typeof lightManager.setMainDirectionalLightEnabled === "function")
                lightManager.setMainDirectionalLightEnabled(p.sun.enabled);
        }

        // --- auto-fit + range + pullback ---
        if (p.autoFit !== undefined) C.SHADOW_PROJECTION.AUTO_FIT = p.autoFit;
        if (p.range !== undefined) C.SHADOW_PROJECTION.AUTO_FIT_DISTANCE.value = p.range;
        if (p.pullback !== undefined) {
            if (p.pullback === "auto") {
                C.SHADOW_PROJECTION.AUTO_PULLBACK = true;
            } else {
                C.SHADOW_PROJECTION.AUTO_PULLBACK = false;
                C.SHADOW_PROJECTION.AUTO_FIT_PULLBACK.value = p.pullback;
            }
        }

        // --- fit knobs (AUTO_SHADOW) + map size ---
        if (p.snap !== undefined) C.AUTO_SHADOW.TEXEL_SNAP = p.snap;
        if (p.quant !== undefined) C.AUTO_SHADOW.RADIUS_QUANT = p.quant;
        if (p.padding !== undefined) C.AUTO_SHADOW.PADDING = p.padding;
        if (p.map !== undefined) C.SHADOW_MAP.SIZE.value = p.map;

        // --- bias slacks ---
        if (p.bias) {
            if (p.bias.flat !== undefined) C.AUTO_SHADOW.DEPTH_SLACK_TEXELS = p.bias.flat;
            if (p.bias.slope !== undefined) C.AUTO_SHADOW.SLOPE_SLACK_TEXELS = p.bias.slope;
            if (p.bias.normal !== undefined) C.AUTO_SHADOW.NORMAL_SLACK_TEXELS = p.bias.normal;
            if (p.bias.slopeClamp !== undefined) C.SHADOW_MAP.SLOPE_CLAMP.value = p.bias.slopeClamp;
        }

        // --- ambient (hemisphere) ---
        if (p.ambient) {
            if (p.ambient.intensity !== undefined) C.AMBIENT_INTENSITY = p.ambient.intensity;
            if (p.ambient.sky) C.AMBIENT_SKY_COLOR = { r: p.ambient.sky[0], g: p.ambient.sky[1], b: p.ambient.sky[2] };
            if (p.ambient.ground)
                C.AMBIENT_GROUND_COLOR = { r: p.ambient.ground[0], g: p.ambient.ground[1], b: p.ambient.ground[2] };
        }

        // --- output (exposure / tonemap) ---
        if (p.output) {
            if (p.output.exposure !== undefined) C.EXPOSURE.value = p.output.exposure;
            if (p.output.tonemap !== undefined) C.TONEMAP = p.output.tonemap;
        }

        // --- cascaded shadow maps ---
        if (p.csm) {
            const CSM = C.AUTO_SHADOW.CSM;
            if (p.csm.enabled !== undefined) CSM.ENABLED = p.csm.enabled;
            if (p.csm.range !== undefined) CSM.RANGE.value = p.csm.range;
            if (p.csm.count !== undefined) CSM.COUNT.value = Math.min(p.csm.count, CSM.MAX);
            if (p.csm.lambda !== undefined) CSM.LAMBDA.value = p.csm.lambda;
            if (p.csm.blend !== undefined) CSM.BLEND_TEXELS.value = p.csm.blend;
            // Passing an explicit splits array switches on Unity-style manual splits (fractions of range).
            if (Array.isArray(p.csm.splits)) {
                CSM.MANUAL_SPLITS = true;
                for (let i = 0; i < CSM.SPLITS.length; i++) {
                    if (p.csm.splits[i] !== undefined) CSM.SPLITS[i].value = p.csm.splits[i];
                }
            } else if (p.csm.manualSplits !== undefined) {
                CSM.MANUAL_SPLITS = p.csm.manualSplits;
            }
        }

        // --- filtering / look ---
        if (p.filter) {
            if (p.filter.pcf !== undefined) C.SHADOW_FILTERING.PCF.ENABLED = p.filter.pcf;
            if (p.filter.kernel !== undefined) C.SHADOW_FILTERING.PCF.SIZE.value = p.filter.kernel;
            if (p.filter.softness !== undefined) C.SHADOW_FILTERING.SOFTNESS.value = p.filter.softness;
            if (p.filter.darkness !== undefined) C.SHADOW_DARKNESS = p.filter.darkness;
            if (p.filter.pcssMax !== undefined) C.SHADOW_FILTERING.PCSS_MAX_TEXELS.value = p.filter.pcssMax;
        }

        // --- shadows on/off ---
        if (p.shadows !== undefined) {
            const renderer = target.lightManager ? target : null;
            if (renderer && renderer.shadowsEnabled !== undefined) {
                renderer.shadowsEnabled = p.shadows;
            }
        }

        // --- re-sync the sun (handles create-then-sync ordering) ---
        const sun = typeof lightManager.getMainDirectionalLight === "function" ? lightManager.getMainDirectionalLight() : null;
        if (sun && typeof sun.syncWithConstants === "function") {
            sun.syncWithConstants();
        } else if (typeof lightManager.createMainDirectionalLight === "function") {
            lightManager.createMainDirectionalLight();
        }
        return true;
    }

    // Current sun elevation/azimuth (degrees) from the direction vector — used when a profile sets
    // only one of the two angles.
    static _currentAngles(C) {
        const d = C.LIGHT_DIRECTION;
        const len = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z) || 1;
        const elevation = Math.asin(Math.max(-1, Math.min(1, -d.y / len))) * (180 / Math.PI);
        const azimuth = (Math.atan2(d.z, d.x) * (180 / Math.PI) + 360) % 360;
        return { elevation, azimuth };
    }
}
