//actionengine/debug/autoshadowpanel.js
/**
 * AutoShadowPanel - a live instrument for the whole directional-shadow pipeline.
 *
 * This is NOT a settings screen. It exists so the ~two dozen factors that feed a directional shadow
 * can each be scrubbed in isolation and DISCUSSED against what you see on screen, instead of guessing
 * from compressed screenshots. Every knob writes a real target (a lighting constant, an ActionShadowFit
 * static, or a shader uniform source), and every page shows the live DERIVED numbers the fit produced
 * this frame (radius, texel size, computed bias, far plane…) so the "auto" math is visible, not a box.
 *
 * The factors are grouped by pipeline stage into four tabs, each kept within ~560px tall:
 *   Light  - where the sun is and how bright (stage A)
 *   Fit    - the camera-frustum fit that sizes/places the shadow box (stage B)
 *   Bias   - the depth-comparison slack that fights acne vs peter-panning (stage D, bias family)
 *   Filter - PCF / softness / darkness / ambient (stage D, look family)
 *
 * Visibility is driven by the game (a key toggle), independent of the main debug panel. Everything is
 * modelled as a slider — continuous, or "discrete options" (which also serve as on/off toggles via an
 * ["Off","On"] option list) — so it all shares one layout grid and the base panel's drag/click input.
 */
class AutoShadowPanel extends BaseDebugPanel {
    constructor(canvas, game) {
        super(canvas, game, {
            panelId: "autoshadow",
            toggleId: "autoShadowToggle",
            defaultTab: "fit",
            toggleText: "Auto Shadow",
            toggleX: 570,
            toggleY: 10,
            toggleWidth: 150,
            toggleHeight: 30,
            panelWidth: 460,
            panelHeight: 560,
            // right-aligned so it doesn't sit on top of the (left-aligned) lighting panel
            panelX: Math.max(20, canvas.width - 480),
            panelY: 40,
            tabs: [
                { id: "light", label: "Light" },
                { id: "fit", label: "Fit" },
                { id: "csm", label: "CSM" },
                { id: "bias", label: "Bias" },
                { id: "filter", label: "Filter" },
                { id: "color", label: "Color" },
                { id: "debug", label: "Debug" }
            ]
        });

        this.activeTab = "fit";
        this._buildSliders();
        this._normalizeOptionIndices();
        this._registerActiveTab();
        this._initProfileIO();
    }

    _initProfileIO() {
        // Hidden file input for loading profiles
        this._fileInput = document.createElement("input");
        this._fileInput.type = "file";
        this._fileInput.accept = ".json";
        this._fileInput.style.display = "none";
        document.body.appendChild(this._fileInput);
        this._fileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const profile = JSON.parse(ev.target.result);
                    const lm = this.game?.renderer3D?.lightManager;
                    new ActionLightingProfile(profile).applyTo(lm || this.game?.renderer3D);
                    this._syncFromLive();
                    console.log("[AutoShadowPanel] Profile loaded:", file.name);
                } catch (err) {
                    console.error("[AutoShadowPanel] Failed to load profile:", err);
                }
            };
            reader.readAsText(file);
            // Reset so re-loading the same file triggers change again
            this._fileInput.value = "";
        });

        // Button definitions (registered/unregistered with the debug tab)
        this._profileButtons = [
            { id: "aspSave",  label: "Save Profile",   color: "#335577" },
            { id: "aspLoad",  label: "Load Profile",   color: "#335577" },
            { id: "aspReset", label: "Reset Defaults",  color: "#773333" }
        ];
    }

    // --- convenience accessors -------------------------------------------------

    _sun() {
        const lm = this.game && this.game.renderer3D && this.game.renderer3D.lightManager;
        return lm ? lm.getMainDirectionalLight() : null;
    }

    // Push a constant change into the live light. syncWithConstants copies direction/intensity/map-size
    // BEFORE its AUTO_FIT early-return, so those all take effect even with auto-fit on.
    _syncSun() {
        const sun = this._sun();
        if (sun && typeof sun.syncWithConstants === "function") sun.syncWithConstants();
    }

    // Convert the light's current direction vector into elevation/azimuth degrees for slider init.
    _currentAngles() {
        const d = lightingConstants.LIGHT_DIRECTION;
        const len = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z) || 1;
        const y = d.y / len;
        const elevation = Math.asin(Math.max(-1, Math.min(1, -y))) * (180 / Math.PI); // above horizon
        const azimuth = (Math.atan2(d.z, d.x) * (180 / Math.PI) + 360) % 360;
        return { elevation, azimuth };
    }

    // Write elevation/azimuth (deg) back into LIGHT_DIRECTION and update the live light.
    _setAngles(elevation, azimuth) {
        const e = elevation * (Math.PI / 180);
        const a = azimuth * (Math.PI / 180);
        const horiz = Math.cos(e);
        lightingConstants.LIGHT_DIRECTION.x = horiz * Math.cos(a);
        lightingConstants.LIGHT_DIRECTION.y = -Math.sin(e);
        lightingConstants.LIGHT_DIRECTION.z = horiz * Math.sin(a);
        this._syncSun();
    }

    // --- knob definitions ------------------------------------------------------

    _buildSliders() {
        const SP = lightingConstants.SHADOW_PROJECTION;
        const SM = lightingConstants.SHADOW_MAP;
        const SF = lightingConstants.SHADOW_FILTERING;
        const AS = lightingConstants.AUTO_SHADOW;
        const AMB_S = lightingConstants.AMBIENT_SKY_COLOR;
        const AMB_G = lightingConstants.AMBIENT_GROUND_COLOR;
        const ang = this._currentAngles();
        const self = this;

        this.tabSliders = {
            // --- LIGHT: where the sun is and how bright (stage A) ---
            light: {
                // Sun height above the horizon. Low = long raking shadows; 90 = straight down (noon).
                "Elevation°": {
                    value: Math.round(ang.elevation), min: -90, max: 90, step: 1, id: "asElev",
                    updateProperty: (v) => self._setAngles(v, self._angAz())
                },
                // Sun compass direction — rotates which way shadows point.
                "Azimuth°": {
                    value: Math.round(ang.azimuth), min: 0, max: 360, step: 5, id: "asAzim",
                    updateProperty: (v) => self._setAngles(self._angEl(), v)
                },
                // Directional (sun) light brightness.
                "Intensity": {
                    value: lightingConstants.LIGHT_INTENSITY.value, min: 0, max: 10, step: 0.1, id: "asIntensity",
                    updateProperty: (v) => { lightingConstants.LIGHT_INTENSITY.value = v; self._syncSun(); }
                },
            },
            // --- FIT: how the box that holds the shadow map is sized & placed (stage B) ---
            fit: {
                // How far from the camera shadows are fit. Smaller = crisper (smaller texels) but shorter.
                "Shadow Range": {
                    value: SP.AUTO_FIT_DISTANCE.value, min: 40, max: 600, step: 5, id: "asRange",
                    updateProperty: (v) => { SP.AUTO_FIT_DISTANCE.value = v; }
                },
                // On = derive pullback from real caster bounds (auto). Off = use the manual Pullback slider.
                "Auto Pull": {
                    value: SP.AUTO_PULLBACK ? "On" : "Off", options: ["Off", "On"], id: "asAutoPull",
                    updateProperty: (v) => { SP.AUTO_PULLBACK = v === "On"; }
                },
                // Manual depth toward the light to catch tall/off-screen casters (used only when Auto Pull is Off).
                "Pullback": {
                    value: SP.AUTO_FIT_PULLBACK.value, min: 0, max: 600, step: 10, id: "asPullback",
                    updateProperty: (v) => { SP.AUTO_FIT_PULLBACK.value = v; }
                },
                // Grows the shadow box so frustum corners don't clip at the edge. 0 = tightest/crispest;
                // raise if shadows get cut off at the screen edges.
                "Fit Padding": {
                    value: AS.PADDING, min: 0, max: 20, step: 0.5, id: "asPadding",
                    updateProperty: (v) => { AS.PADDING = v; }
                },
                // Rounds the fit radius to 1/N steps. Coarser (lower N) = box resizes less = no shimmer on
                // zoom; higher N = more responsive but jitterier.
                "Quant": {
                    value: AS.RADIUS_QUANT, options: [4, 8, 16, 32, 64], id: "asQuant",
                    updateProperty: (v) => { AS.RADIUS_QUANT = v; }
                },
                // Texel-snaps the box center so it moves in whole-texel jumps — stops shadow edges from
                // crawling/swimming as you walk. Off lets you SEE the crawl it prevents.
                "Snap": {
                    value: AS.TEXEL_SNAP ? "On" : "Off", options: ["Off", "On"], id: "asSnap",
                    updateProperty: (v) => { AS.TEXEL_SNAP = v === "On"; }
                },
                // Shadow map resolution. Higher = sharper shadows, more VRAM/fill cost.
                "Map": {
                    value: SM.SIZE.value, options: [512, 1024, 2048, 4096, 8192, 16384], id: "asMapSize",
                    updateProperty: (v) => { SM.SIZE.value = v; self._syncSun(); }
                }
            },
            // --- CSM: cascaded shadow maps — crisp near AND long range without one Shadow Range compromise.
            // CSM has its OWN range here (decoupled from the Fit tab's single-map Shadow Range). ---
            csm: {
                // On = split [near, CSM Range] into N tight cascades; Off = the Fit tab's single fitted box
                // (cheaper, fine for small/flat scenes). All knobs below only matter when this is On.
                "CSM": {
                    value: AS.CSM.ENABLED ? "On" : "Off", options: ["Off", "On"], id: "asCSM",
                    updateProperty: (v) => { AS.CSM.ENABLED = v === "On"; }
                },
                // CSM's OWN overall range (far edge of the last cascade). Independent of the single-map
                // Shadow Range — push this far (up to 5000) since reaching distance is the point of CSM.
                "CSM Range": {
                    value: AS.CSM.RANGE.value, min: AS.CSM.RANGE.min, max: AS.CSM.RANGE.max, step: AS.CSM.RANGE.step, id: "asCsmRange",
                    updateProperty: (v) => { AS.CSM.RANGE.value = v; }
                },
                // How many cascades (each is a full shadow re-render of the casters, so 4 is the ceiling).
                // More = better resolution distribution across depth, higher cost.
                "Cascades": {
                    value: AS.CSM.COUNT.value, min: AS.CSM.COUNT.min, max: AS.CSM.COUNT.max, step: 1, id: "asCascades",
                    updateProperty: (v) => { AS.CSM.COUNT.value = Math.min(Math.round(v), AS.CSM.MAX); }
                },
                // Split distribution (AUTO): 0 = uniform (even world spacing, wastes near texels), 1 =
                // logarithmic (near cascades tiny). 0.5 = practical PSSM. Ignored when Manual is On.
                "Split λ": {
                    value: AS.CSM.LAMBDA.value, min: AS.CSM.LAMBDA.min, max: AS.CSM.LAMBDA.max, step: AS.CSM.LAMBDA.step, id: "asLambda",
                    updateProperty: (v) => { AS.CSM.LAMBDA.value = v; }
                },
                // On = place the cascade boundaries yourself with the Split sliders below (fractions of CSM
                // Range, Unity-style); Off = λ auto-splits. The escape hatch for hand-placing detail.
                "Manual": {
                    value: AS.CSM.MANUAL_SPLITS ? "On" : "Off", options: ["Off", "On"], id: "asManualSplits",
                    updateProperty: (v) => { AS.CSM.MANUAL_SPLITS = v === "On"; }
                },
                // Where each cascade boundary sits as a fraction of CSM Range (Manual must be On).
                // "C0|C1" = where cascade 0 ends / cascade 1 begins. Active when Cascades > 1.
                // "C1|C2" = cascade 1/2 boundary.               Active when Cascades > 2.
                // "C2|C3" = cascade 2/3 boundary (red box start). Active ONLY when Cascades = 4.
                // The last cascade always ends at CSM Range — its far face never moves.
                "C0|C1": {
                    value: AS.CSM.SPLITS[0].value, min: AS.CSM.SPLITS[0].min, max: AS.CSM.SPLITS[0].max, step: AS.CSM.SPLITS[0].step, id: "asSplit1",
                    updateProperty: (v) => { AS.CSM.SPLITS[0].value = v; }
                },
                "C1|C2": {
                    value: AS.CSM.SPLITS[1].value, min: AS.CSM.SPLITS[1].min, max: AS.CSM.SPLITS[1].max, step: AS.CSM.SPLITS[1].step, id: "asSplit2",
                    updateProperty: (v) => { AS.CSM.SPLITS[1].value = v; }
                },
                "C2|C3": {
                    value: AS.CSM.SPLITS[2].value, min: AS.CSM.SPLITS[2].min, max: AS.CSM.SPLITS[2].max, step: AS.CSM.SPLITS[2].step, id: "asSplit3",
                    updateProperty: (v) => { AS.CSM.SPLITS[2].value = v; }
                },
                // Width of the dissolve band across a cascade boundary (in texels) so the resolution step
                // doesn't show as a hard line. 0 = hard switch.
                "Blend": {
                    value: AS.CSM.BLEND_TEXELS.value, min: AS.CSM.BLEND_TEXELS.min, max: AS.CSM.BLEND_TEXELS.max, step: 1, id: "asBlend",
                    updateProperty: (v) => { AS.CSM.BLEND_TEXELS.value = v; }
                }
            },
            // --- BIAS: the depth/normal slack that fights acne vs peter-panning (stage D) ---
            bias: {
                // Depth bias on FLAT surfaces. Too little = self-shadow acne; too much = the shadow floats
                // off its caster (peter-panning). The baseline acne knob.
                "Flat Slack": {
                    value: AS.DEPTH_SLACK_TEXELS, min: -32, max: 64, step: 0.5, id: "asFlatSlack",
                    updateProperty: (v) => { AS.DEPTH_SLACK_TEXELS = v; }
                },
                // Extra depth bias scaled by surface tilt (tan of the angle to the light) — handles acne on
                // sloped/curved geometry. Negative SUBTRACTS, pulling shadows back onto tops/edges.
                "Slope Slack": {
                    value: AS.SLOPE_SLACK_TEXELS, min: -32, max: 32, step: 0.5, id: "asSlopeSlack",
                    updateProperty: (v) => { AS.SLOPE_SLACK_TEXELS = v; }
                },
                // Caps the tan(angle) factor so near-grazing (edge-on) surfaces don't blow the slope bias up
                // toward infinity.
                "Slope Clamp": {
                    value: SM.SLOPE_CLAMP.value, min: 0, max: 64, step: 0.5, id: "asSlopeClamp",
                    updateProperty: (v) => { SM.SLOPE_CLAMP.value = v; }
                },
                // Offsets the shadow sample ALONG THE SURFACE NORMAL (not toward the light) — kills acne
                // without peter-panning, a different lever than the two depth slacks.
                "Normal Slack": {
                    value: AS.NORMAL_SLACK_TEXELS, min: -32, max: 32, step: 0.5, id: "asNormalSlack",
                    updateProperty: (v) => { AS.NORMAL_SLACK_TEXELS = v; }
                }
            },
            // --- FILTER: edge softening and how dark/ambient the shadow reads (stage D, look) ---
            filter: {
                // Percentage-closer filtering on/off — soft, antialiased shadow edges vs hard/aliased.
                "PCF": {
                    value: SF.PCF.ENABLED ? "On" : "Off", options: ["Off", "On"], id: "asPcfEnabled",
                    updateProperty: (v) => { SF.PCF.ENABLED = v === "On"; }
                },
                // PCF sample-grid size (NxN). Higher = softer, smoother edges, but more texture samples (cost).
                "Kernel": {
                    value: SF.PCF.SIZE.value, options: [1, 3, 5, 7, 9], id: "asPcfSize",
                    updateProperty: (v) => { SF.PCF.SIZE.value = v; }
                },
                // Spreads the PCF samples wider. Higher = softer/blurrier shadow edge (penumbra width).
                "Softness": {
                    value: SF.SOFTNESS.value, min: 0, max: 1, step: 0.01, id: "asSoftness",
                    updateProperty: (v) => { SF.SOFTNESS.value = v; }
                },
                // How dark shadowed areas get. 1 = fully black, 0 = shadow invisible.
                "Shadow Darkness": {
                    value: lightingConstants.SHADOW_DARKNESS, min: 0, max: 1, step: 0.01, id: "asDarkness",
                    updateProperty: (v) => { lightingConstants.SHADOW_DARKNESS = v; }
                },
                // Hemisphere ambient (sky/ground) intensity — indirect fill, NOT occluded by shadow.
                "Ambient": {
                    value: lightingConstants.AMBIENT_INTENSITY, min: 0, max: 1, step: 0.01, id: "asAmbient",
                    updateProperty: (v) => { lightingConstants.AMBIENT_INTENSITY = v; }
                },
                // PCSS max penumbra: how wide (in texels) a fully-soft shadow edge can get. The blocker
                // search scales the actual penumbra between 1 and this by distance (contact-hardening).
                "PCSS Max": {
                    value: SF.PCSS_MAX_TEXELS.value, min: 1, max: 64, step: 1, id: "asPcssMax",
                    updateProperty: (v) => { SF.PCSS_MAX_TEXELS.value = v; }
                }
            },
            // --- DEBUG: toggles for live rendering diagnostics ---
            debug: {
                "Dir. Light": {
                    value: "On", options: ["Off", "On"], id: "asDbgDirLight",
                    updateProperty: (v) => {
                        const lm = this.game?.renderer3D?.lightManager;
                        if (lm) lm.setMainDirectionalLightEnabled(v === "On");
                    }
                },
                "Shadows": {
                    value: "On", options: ["Off", "On"], id: "asDbgShadows",
                    updateProperty: (v) => {
                        const r = this.game?.renderer3D;
                        if (r && r.shadowsEnabled !== (v === "On")) r.toggleShadows();
                    }
                },
                "Shadow Map": {
                    value: lightingConstants.DEBUG.VISUALIZE_SHADOW_MAP ? "On" : "Off", options: ["Off", "On"], id: "asDbgShadowMap",
                    updateProperty: (v) => { lightingConstants.DEBUG.VISUALIZE_SHADOW_MAP = v === "On"; }
                },
                "Frustum": {
                    value: lightingConstants.DEBUG.VISUALIZE_FRUSTUM ? "On" : "Off", options: ["Off", "On"], id: "asDbgFrustum",
                    updateProperty: (v) => { lightingConstants.DEBUG.VISUALIZE_FRUSTUM = v === "On"; }
                }
            },
            // --- COLOR: the linear/HDR output pipeline + hemisphere ambient tints (shader rework) ---
            color: {
                // Hemisphere ambient SKY tint (lights upward-facing surfaces). Linear 0..1 per channel.
                "Sky R": { value: AMB_S.r, min: 0, max: 1, step: 0.01, id: "asSkyR", updateProperty: (v) => { AMB_S.r = v; } },
                "Sky G": { value: AMB_S.g, min: 0, max: 1, step: 0.01, id: "asSkyG", updateProperty: (v) => { AMB_S.g = v; } },
                "Sky B": { value: AMB_S.b, min: 0, max: 1, step: 0.01, id: "asSkyB", updateProperty: (v) => { AMB_S.b = v; } },
                // Hemisphere ambient GROUND tint (lights downward-facing surfaces — the bounce color).
                "Ground R": { value: AMB_G.r, min: 0, max: 1, step: 0.01, id: "asGndR", updateProperty: (v) => { AMB_G.r = v; } },
                "Ground G": { value: AMB_G.g, min: 0, max: 1, step: 0.01, id: "asGndG", updateProperty: (v) => { AMB_G.g = v; } },
                "Ground B": { value: AMB_G.b, min: 0, max: 1, step: 0.01, id: "asGndB", updateProperty: (v) => { AMB_G.b = v; } },
                // Pre-tonemap exposure — scales scene brightness into the filmic curve.
                "Exposure": {
                    value: lightingConstants.EXPOSURE.value, min: 0.1, max: 4, step: 0.05, id: "asExposure",
                    updateProperty: (v) => { lightingConstants.EXPOSURE.value = v; }
                },
                // ACES filmic tonemap on/off — smooth highlight rolloff vs raw clip.
                "Tonemap": {
                    value: lightingConstants.TONEMAP ? "On" : "Off", options: ["Off", "On"], id: "asTonemap",
                    updateProperty: (v) => { lightingConstants.TONEMAP = v === "On"; }
                }
            }
        };
    }

    // The elevation/azimuth knobs each need the OTHER's current value when writing the vector.
    _angEl() { return this.tabSliders.light["Elevation°"].value; }
    _angAz() { return this.tabSliders.light["Azimuth°"].value; }

    // Discrete-option sliders track a currentOption index; seed it from the live value.
    _normalizeOptionIndices() {
        Object.values(this.tabSliders).forEach((set) => {
            Object.values(set).forEach((slider) => {
                if (slider.options) {
                    let idx = slider.options.indexOf(slider.value);
                    if (idx < 0) idx = 0;
                    slider.currentOption = idx;
                    slider.value = slider.options[idx];
                }
            });
        });
    }

    getActiveSliders() {
        return this.tabSliders[this.activeTab];
    }

    // --- tab / hit-area management --------------------------------------------

    _unregisterAllSliders() {
        Object.values(this.tabSliders).forEach((set) => {
            Object.values(set).forEach((slider) => {
                this.game.input.removeElement(slider.id, "debug");
                this.game.input.removeElement(`${slider.id}_left`, "debug");
                this.game.input.removeElement(`${slider.id}_right`, "debug");
                this.game.input.removeElement(`${slider.id}_edit`, "debug");
            });
        });
        this.clearEditButtons();
    }

    _registerActiveTab() {
        this._unregisterAllSliders();
        // Unregister profile buttons (they only live on the debug tab)
        this._profileButtons?.forEach(b => this.game.input.removeElement(b.id, "debug"));

        const set = this.getActiveSliders();
        this.registerSliders(set, this.activeTab, 92);
        this.registerEditButtons(set);

        if (this.activeTab === "debug") {
            const n = Object.keys(set).length;
            this._profileButtons.forEach((btn, i) => {
                this.game.input.registerElement(btn.id, {
                    bounds: () => ({
                        x: this.panelX + 20,
                        y: this.panelY + 92 + n * 40 + 16 + i * 36,
                        width: this.panelWidth - 40,
                        height: 28
                    })
                }, "debug");
            });
        }
    }

    show() {
        this._syncFromLive();
        this._registerActiveTab();
    }

    // Re-read every knob's underlying live value (reloads / other panels may have moved them).
    _syncFromLive() {
        const SP = lightingConstants.SHADOW_PROJECTION;
        const SM = lightingConstants.SHADOW_MAP;
        const SF = lightingConstants.SHADOW_FILTERING;
        const AS = lightingConstants.AUTO_SHADOW;
        const ang = this._currentAngles();
        const L = this.tabSliders.light;
        L["Elevation°"].value = Math.round(ang.elevation);
        L["Azimuth°"].value = Math.round(ang.azimuth);
        L["Intensity"].value = lightingConstants.LIGHT_INTENSITY.value;

        const F = this.tabSliders.fit;
        F["Shadow Range"].value = SP.AUTO_FIT_DISTANCE.value;
        F["Auto Pull"].value = SP.AUTO_PULLBACK ? "On" : "Off";
        F["Pullback"].value = SP.AUTO_FIT_PULLBACK.value;
        F["Fit Padding"].value = AS.PADDING;
        F["Quant"].value = AS.RADIUS_QUANT;
        F["Snap"].value = AS.TEXEL_SNAP ? "On" : "Off";
        F["Map"].value = SM.SIZE.value;
        const C = this.tabSliders.csm;
        C["CSM"].value = AS.CSM.ENABLED ? "On" : "Off";
        C["CSM Range"].value = AS.CSM.RANGE.value;
        C["Cascades"].value = AS.CSM.COUNT.value;
        C["Split λ"].value = AS.CSM.LAMBDA.value;
        C["Manual"].value = AS.CSM.MANUAL_SPLITS ? "On" : "Off";
        C["Blend"].value = AS.CSM.BLEND_TEXELS.value;
        // Split sliders: in manual mode show the override values; in auto mode show what λ actually
        // produced this frame (splitFar / range) so you can see the auto split, then flip to Manual and
        // tweak from there. Falls back to the stored override values if no cascades have been fit yet.
        const range = AS.CSM.RANGE.value || 1;
        const cas = (typeof ActionShadowFit !== "undefined" && ActionShadowFit.lastCascades) || null;
        const splitKeys = ["C0|C1", "C1|C2", "C2|C3"];
        for (let i = 0; i < 3; i++) {
            const key = splitKeys[i];
            if (!AS.CSM.MANUAL_SPLITS && cas && cas[i] && i < cas.length - 1) {
                C[key].value = Math.round((cas[i].splitFar / range) * 100) / 100;
            } else {
                C[key].value = AS.CSM.SPLITS[i].value;
            }
        }
        const B = this.tabSliders.bias;
        B["Flat Slack"].value = AS.DEPTH_SLACK_TEXELS;
        B["Slope Slack"].value = AS.SLOPE_SLACK_TEXELS;
        B["Slope Clamp"].value = SM.SLOPE_CLAMP.value;
        B["Normal Slack"].value = AS.NORMAL_SLACK_TEXELS;
        const FI = this.tabSliders.filter;
        FI["PCF"].value = SF.PCF.ENABLED ? "On" : "Off";
        FI["Kernel"].value = SF.PCF.SIZE.value;
        FI["Softness"].value = SF.SOFTNESS.value;
        FI["Shadow Darkness"].value = lightingConstants.SHADOW_DARKNESS;
        FI["Ambient"].value = lightingConstants.AMBIENT_INTENSITY;
        FI["PCSS Max"].value = SF.PCSS_MAX_TEXELS.value;
        const DB = this.tabSliders.debug;
        const lm = this.game?.renderer3D?.lightManager;
        DB["Dir. Light"].value = (lm && lm.isMainDirectionalLightEnabled()) ? "On" : "Off";
        DB["Shadows"].value = this.game?.renderer3D?.shadowsEnabled ? "On" : "Off";
        DB["Shadow Map"].value = lightingConstants.DEBUG.VISUALIZE_SHADOW_MAP ? "On" : "Off";
        DB["Frustum"].value = lightingConstants.DEBUG.VISUALIZE_FRUSTUM ? "On" : "Off";
        const CO = this.tabSliders.color;
        const sky = lightingConstants.AMBIENT_SKY_COLOR;
        const gnd = lightingConstants.AMBIENT_GROUND_COLOR;
        CO["Sky R"].value = sky.r; CO["Sky G"].value = sky.g; CO["Sky B"].value = sky.b;
        CO["Ground R"].value = gnd.r; CO["Ground G"].value = gnd.g; CO["Ground B"].value = gnd.b;
        CO["Exposure"].value = lightingConstants.EXPOSURE.value;
        CO["Tonemap"].value = lightingConstants.TONEMAP ? "On" : "Off";
        this._normalizeOptionIndices();
    }

    // --- per-frame update ------------------------------------------------------

    update() {
        if (!this.visible) return;

        // Tab clicks (the constructor registered `autoshadow_tab_<id>` hit areas).
        this.tabs.forEach((tab) => {
            if (this.game.input.isElementJustPressed(`autoshadow_tab_${tab.id}`, "debug")) {
                if (this.activeTab !== tab.id) {
                    this.activeTab = tab.id;
                    this._registerActiveTab();
                }
            }
        });

        this.handleOptionSliders(this.getActiveSliders());

        if (this.activeTab === "debug") {
            if (this.game.input.isElementJustPressed("aspSave", "debug")) {
                const json = JSON.stringify(lightingConstants.exportConfig(), null, 2);
                const a = document.createElement("a");
                a.href = "data:application/json;charset=utf-8," + encodeURIComponent(json);
                a.download = `lighting_profile_${Date.now()}.json`;
                a.click();
                a.remove();
            }
            if (this.game.input.isElementJustPressed("aspLoad", "debug")) {
                this._fileInput.click();
            }
            if (this.game.input.isElementJustPressed("aspReset", "debug")) {
                const lm = this.game?.renderer3D?.lightManager;
                new ActionLightingProfile(new LightingConstants().exportConfig())
                    .applyTo(lm || this.game?.renderer3D);
                this._syncFromLive();
            }
        }
    }

    // --- draw ------------------------------------------------------------------

    draw() {
        if (this.toggleId) this.drawToggleButton();
        if (!this.visible) return;

        this.ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        this.ctx.fillRect(this.panelX, this.panelY, this.panelWidth, this.panelHeight);

        this._drawTabs();

        // Title + per-tab hint
        this.ctx.fillStyle = "#9fe8ff";
        this.ctx.font = "15px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Auto Shadow Instrument", this.panelX + this.panelWidth / 2, this.panelY + 52);

        this.ctx.fillStyle = "#888";
        this.ctx.font = "11px Arial";
        this.ctx.fillText(this._hintForTab(), this.panelX + this.panelWidth / 2, this.panelY + 70);

        // Sliders start a little lower to clear the tab row + title.
        this.drawSliders(this.getActiveSliders(), 92);

        if (this.activeTab === "debug") {
            this._drawProfileButtons();
        } else {
            this._drawReadouts();
        }
    }

    _drawProfileButtons() {
        const n = Object.keys(this.getActiveSliders()).length;
        this._profileButtons.forEach((btn, i) => {
            const bx = this.panelX + 20;
            const by = this.panelY + 92 + n * 40 + 16 + i * 36;
            const bw = this.panelWidth - 40;
            const bh = 28;
            const hovered = this.game.input.isElementHovered(btn.id, "debug");
            this.ctx.fillStyle = hovered ? "#557799" : btn.color;
            this.ctx.fillRect(bx, by, bw, bh);
            this.ctx.fillStyle = "#ffffff";
            this.ctx.font = "13px Arial";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(btn.label, bx + bw / 2, by + bh / 2);
            this.ctx.textBaseline = "alphabetic";
        });
    }

    _drawTabs() {
        const n = this.tabs.length;
        const tabW = this.panelWidth / n;
        this.tabs.forEach((tab, i) => {
            const tabX = this.panelX + i * tabW;
            const isActive = this.activeTab === tab.id;
            const isHovered = this.game.input.isElementHovered(`autoshadow_tab_${tab.id}`, "debug");
            this.ctx.fillStyle = isActive ? "#559955" : isHovered ? "#557755" : "#3a3a3a";
            this.ctx.fillRect(tabX, this.panelY, tabW, 28);
            this.ctx.fillStyle = "#ffffff";
            this.ctx.font = "13px Arial";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(tab.label, tabX + tabW / 2, this.panelY + 14);
            this.ctx.textBaseline = "alphabetic";
        });
    }

    _hintForTab() {
        switch (this.activeTab) {
            case "light": return "Drag the sun. Elevation/azimuth set the shadow angle.";
            case "fit": return "How the box that holds the shadow map is sized & placed.";
            case "csm": return "Cascaded shadow maps: crisp near AND far. Own range, decoupled from Fit.";
            case "bias": return "Depth slack: too little = acne, too much = float (peter-pan).";
            case "filter": return "Edge softening (PCF/PCSS) and how dark the shadow reads.";
            case "color": return "Linear/HDR output: hemisphere ambient tints, exposure, tonemap.";
            case "debug": return "Live rendering toggles — light, shadows, visualizers.";
            default: return "";
        }
    }

    // Live derived numbers from the last fit — this is what makes the auto math discussable.
    _drawReadouts() {
        const n = Object.keys(this.getActiveSliders()).length;
        const y0 = this.panelY + 92 + n * 40 + 14;

        this.ctx.textAlign = "left";
        this.ctx.font = "12px Arial";
        this.ctx.fillStyle = "#7fd6a0";
        this.ctx.fillText("─ live fit (computed this frame) ─", this.panelX + 16, y0);

        const fmt = (v, d = 3) => (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(d));
        this.ctx.font = "12px monospace";
        this.ctx.fillStyle = "#cccccc";

        // CSM mode: one line per cascade (split far, sphere radius, world texel, flat bias).
        const cas = ActionShadowFit.lastCascades;
        if (cas && cas.length) {
            this.ctx.fillText(`CSM · ${cas.length} cascades`, this.panelX + 16, y0 + 20);
            cas.forEach((c, i) => {
                const ln = `c${i}  far ${fmt(c.splitFar, 0)}  r ${fmt(c.radius, 1)}  texel ${fmt(c.texel, 4)}  bias ${c.bias.toExponential(1)}`;
                this.ctx.fillText(ln, this.panelX + 16, y0 + 38 + i * 18);
            });
            return;
        }

        const f = ActionShadowFit.lastFit;
        if (!f) {
            this.ctx.fillText("(no fit yet — auto-fit off or no camera)", this.panelX + 16, y0 + 20);
            return;
        }
        const lines = [
            `radius   ${fmt(f.radius, 2)}      range  ${fmt(f.distance, 0)}`,
            `texel    ${fmt(f.texel, 4)}     map    ${f.mapSize}`,
            `far      ${fmt(f.far, 1)}      pull   ${fmt(f.pullback, 0)}`,
            `flatBias ${f.bias.toExponential(2)}  slopeBias ${(f.slopeBias != null ? f.slopeBias.toExponential(2) : "n/a")}`
        ];
        lines.forEach((ln, i) => {
            this.ctx.fillText(ln, this.panelX + 16, y0 + 20 + i * 18);
        });
    }
}
