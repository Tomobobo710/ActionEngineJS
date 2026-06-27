//actionengine/rendering/lighting/actionshadowfit.js

/**
 * ActionShadowFit - automatic directional-shadow frustum fitting.
 *
 * Replaces hand-tuned shadow-projection numbers with a frustum fit derived from the actual camera:
 * take the camera's view-frustum slice out to a shadow distance, bound it with a sphere, and size the
 * light's orthographic shadow box to that sphere in light space. Because the box follows the camera
 * and is only as large as what you can see, the shadow map's resolution is spent where it matters
 * instead of blanketing the whole world.
 *
 * Two robustness details that make this look stable rather than swimmy:
 *  - Bounding SPHERE (not AABB) of the frustum slice → the box size is constant as the camera rotates,
 *    so shadows don't shimmer when you turn.
 *  - Texel snapping → the box center moves in whole-shadow-texel steps, so shadow edges don't crawl
 *    when you walk.
 *
 * Output is expressed in the light's existing lookAt + ortho convention (see
 * ActionDirectionalShadowLight.updateLightSpaceMatrix), so the light consumes it without caring how
 * it was produced.
 */
class ActionShadowFit {
    /**
     * @param {ActionCamera} camera - source camera (uses position, target, up, fov)
     * @param {Vector3} lightDir - direction the light travels (from light toward scene)
     * @param {Object} opts
     *   @param {number} opts.distance - how far from the camera shadows are fit (the shadow range)
     *   @param {number} opts.near - camera near distance for the fit slice
     *   @param {number} opts.aspect - viewport aspect ratio (width / height)
     *   @param {number} opts.mapSize - shadow map resolution (for texel snapping)
     *   @param {number} opts.pullback - extra depth toward the light, so casters above the visible
     *                                   slice (e.g. a tall pillar) still cast into view
     * @returns {{left,right,bottom,top,near,far,eye:Vector3,up:Vector3}|null} fit spec, or null if
     *          the inputs are degenerate (caller falls back to static constants)
     */
    static fitDirectional(camera, lightDir, opts) {
        const basis = ActionShadowFit._cameraBasis(camera);
        if (!basis) return null;
        const L = lightDir.normalize();
        if (L.lengthSquared() < 1e-9) return null;

        const fit = ActionShadowFit._fitSlice(camera, basis, L, opts.near, opts.distance, opts);
        if (!fit) return null;

        // Publish the derived numbers so the live panel can show what the fit actually produced this
        // frame — this is what makes the auto math discussable instead of a black box. Single-fit mode
        // publishes one record; CSM mode (fitCascades) publishes an array.
        ActionShadowFit.lastFit = {
            radius: fit.radius,
            texel: fit.texel,
            far: fit.far,
            near: fit.near,
            pullback: fit.pullback,
            distance: opts.distance,
            mapSize: opts.mapSize,
            bias: fit.bias,
            slopeBias: fit.slopeBias,
            eyeDist: fit.radius + fit.pullback
        };
        ActionShadowFit.lastCascades = null;
        return fit;
    }

    /**
     * CSM: split the camera frustum [near, distance] into N cascades and fit each independently.
     * Each cascade reuses the exact single-slice fit math (sphere bound, texel snap, auto pullback,
     * geometry-derived bias), so each gets its OWN correct bias from its OWN slice — nothing per-cascade
     * to hand-tune. Split positions use the practical PSSM scheme: blend uniform and logarithmic by lambda.
     * @param {ActionCamera} camera
     * @param {Vector3} lightDir
     * @param {Object} opts - same as fitDirectional, plus:
     *   @param {number} opts.count  - number of cascades (>=1)
     *   @param {number} opts.lambda - 0 = uniform splits, 1 = logarithmic
     * @returns {{cascades:Array, splits:Float32Array}|null} cascades[i] is a single-slice fit spec;
     *          splits is the cascade FAR view-distances (length count) used by the shader to pick a cascade.
     */
    static fitCascades(camera, lightDir, opts) {
        const basis = ActionShadowFit._cameraBasis(camera);
        if (!basis) return null;
        const L = lightDir.normalize();
        if (L.lengthSquared() < 1e-9) return null;

        const count = Math.max(1, Math.floor(opts.count || 1));
        const near = opts.near;
        const far = opts.distance;
        const lambda = opts.lambda !== undefined ? opts.lambda : 0.5;

        // Split distances: boundaries[0]=near ... boundaries[count]=far. Interior boundaries come from
        // either the manual SPLITS override (fractions of the range, Unity-style) or the LAMBDA auto-split
        // (uniform↔log blend). The last cascade always ends at `far`. Manual values are clamped monotonic
        // so a bad/unordered override can't produce an inverted or zero-width cascade.
        const boundaries = new Array(count + 1);
        boundaries[0] = near;
        boundaries[count] = far;
        const ratio = far / Math.max(near, 1e-4);
        const manual = opts.manualSplits && opts.splits;
        for (let i = 1; i < count; i++) {
            let b;
            if (manual && opts.splits[i - 1] !== undefined) {
                const frac = Math.min(Math.max(opts.splits[i - 1], 0), 1);
                b = near + (far - near) * frac;
            } else {
                const s = i / count;
                const uniform = near + (far - near) * s;
                const log = near * Math.pow(ratio, s);
                b = lambda * log + (1 - lambda) * uniform;
            }
            // keep strictly increasing (leave room for the remaining cascades)
            const minB = boundaries[i - 1] + 1e-3;
            boundaries[i] = Math.max(b, minB);
        }

        const cascades = [];
        const splits = new Float32Array(count);
        const lastRecords = [];
        for (let i = 0; i < count; i++) {
            const fit = ActionShadowFit._fitSlice(camera, basis, L, boundaries[i], boundaries[i + 1], opts);
            if (!fit) return null;
            cascades.push(fit);
            splits[i] = boundaries[i + 1]; // this cascade covers view-depths up to here
            lastRecords.push({
                index: i,
                splitNear: boundaries[i],
                splitFar: boundaries[i + 1],
                radius: fit.radius,
                texel: fit.texel,
                far: fit.far,
                bias: fit.bias,
                slopeBias: fit.slopeBias,
                pullback: fit.pullback,
                // Full frustum geometry for debug visualization
                eye: fit.eye, up: fit.up,
                left: fit.left, right: fit.right,
                bottom: fit.bottom, top: fit.top,
                near: fit.near
            });
        }

        ActionShadowFit.lastCascades = lastRecords;
        ActionShadowFit.lastFit = null;
        return { cascades: cascades, splits: splits };
    }

    /**
     * Camera basis (forward / right / up), guarded against a degenerate look vector.
     * @returns {{fwd:Vector3, right:Vector3, up:Vector3}|null}
     */
    static _cameraBasis(camera) {
        const fwdRaw = camera.target.sub(camera.position);
        if (fwdRaw.lengthSquared() < 1e-9) return null;
        const fwd = fwdRaw.normalize();
        let right = fwd.cross(camera.up);
        if (right.lengthSquared() < 1e-9) return null; // up parallel to forward
        right = right.normalize();
        const up = right.cross(fwd).normalize();
        return { fwd: fwd, right: right, up: up };
    }

    /**
     * Fit a single ortho shadow box to the camera frustum slice [sliceNear, sliceFar]. This is the core
     * shared by both fitDirectional (one call, whole range) and fitCascades (one call per cascade).
     * @param {ActionCamera} camera
     * @param {{fwd,right,up}} basis - from _cameraBasis
     * @param {Vector3} L - normalized light travel direction
     * @param {number} sliceNear
     * @param {number} sliceFar
     * @param {Object} opts - aspect, mapSize, snap, quant, padding, depthSlack, slopeSlack, autoPullback,
     *                        casters, pullback, maxPullback
     * @returns {Object|null} fit spec {left,right,bottom,top,near,far,eye,up,bias,slopeBias,texel,radius,pullback}
     */
    static _fitSlice(camera, basis, L, sliceNear, sliceFar, opts) {
        const aspect = opts.aspect;
        const mapSize = opts.mapSize;
        let pullback = opts.pullback;
        const fwd = basis.fwd;
        const right = basis.right;
        const up = basis.up;

        // --- 8 corners of the camera frustum slice [sliceNear, sliceFar] ---
        const tanV = Math.tan(camera.fov * 0.5);
        const nh = tanV * sliceNear;
        const nw = nh * aspect;
        const fh = tanV * sliceFar;
        const fw = fh * aspect;
        const nc = camera.position.add(fwd.scale(sliceNear));
        const fc = camera.position.add(fwd.scale(sliceFar));
        const corners = [
            nc.add(up.scale(nh)).add(right.scale(nw)),
            nc.add(up.scale(nh)).sub(right.scale(nw)),
            nc.sub(up.scale(nh)).add(right.scale(nw)),
            nc.sub(up.scale(nh)).sub(right.scale(nw)),
            fc.add(up.scale(fh)).add(right.scale(fw)),
            fc.add(up.scale(fh)).sub(right.scale(fw)),
            fc.sub(up.scale(fh)).add(right.scale(fw)),
            fc.sub(up.scale(fh)).sub(right.scale(fw))
        ];

        // --- bounding sphere of the slice (orientation-independent size → no rotate shimmer) ---
        let sx = 0;
        let sy = 0;
        let sz = 0;
        for (let i = 0; i < 8; i++) {
            sx += corners[i].x;
            sy += corners[i].y;
            sz += corners[i].z;
        }
        const center = new Vector3(sx / 8, sy / 8, sz / 8);
        let radius = 0;
        for (let i = 0; i < 8; i++) {
            const d = corners[i].sub(center).length();
            if (d > radius) radius = d;
        }
        // Quantize the radius so tiny per-frame wobble in the slice doesn't resize the box. The
        // quant level is a knob (from lightingConstants.AUTO_SHADOW): higher = finer steps (less
        // stable), lower = coarser (more stable).
        const quant = opts.quant > 0 ? opts.quant : 16;
        radius = Math.ceil(radius * quant) / quant;
        // Optional padding: grow the sphere a hair so frustum corners don't clip at the box edge.
        radius += opts.padding || 0;
        if (radius < 1e-4) return null;

        // --- light-space basis (forward = light direction; L is passed in, already normalized) ---
        const worldUp = Math.abs(L.y) > 0.99 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0);
        const lRight = worldUp.cross(L).normalize();
        const lUp = L.cross(lRight).normalize();

        // --- auto pullback: how far do real casters rise toward the light above the shadow box? ---
        // The box spans [center·L - radius, center·L + radius] along the light axis. A caster whose
        // nearest-to-light point sits ABOVE that near edge would be skipped unless we extend the box
        // toward the light by `pullback`. Derive it from actual caster AABBs so it's auto instead of a
        // hand-typed 200 — flat arenas need ~0, a scene full of towers grows it on its own.
        if (opts.autoPullback && opts.casters) {
            pullback = ActionShadowFit._autoPullback(opts.casters, L, center, radius, opts.maxPullback || 5000);
            // Cap pullback at 4x this cascade's own radius. A caster taller than that is far enough
            // above the slice that the next cascade will cover it — no need to stretch this box into
            // a needle. Without this, small near cascades get the same absolute pullback as far ones
            // and end up disproportionately elongated (5-unit radius, 200-unit pullback).
            pullback = Math.min(pullback, radius * 4);
        }

        // --- texel-snap the box center in light space (whole-texel steps → no edge crawl) ---
        // Snapping is a knob so its effect (kills edge-crawl when walking) can be toggled and seen.
        const texel = (radius * 2) / mapSize;
        let cx = center.dot(lRight);
        let cy = center.dot(lUp);
        const cz = center.dot(L);
        if (opts.snap !== false) {
            cx = Math.round(cx / texel) * texel;
            cy = Math.round(cy / texel) * texel;
        }
        const snappedCenter = lRight.scale(cx).add(lUp.scale(cy)).add(L.scale(cz));

        // --- eye sits behind the sphere along -L; near grabs casters between light and slice ---
        const eye = snappedCenter.sub(L.scale(radius + pullback));
        const far = 2 * radius + pullback;
        const depthSlack = opts.depthSlack !== undefined ? opts.depthSlack : 8;
        const slopeSlack = opts.slopeSlack !== undefined ? opts.slopeSlack : 4;
        const bias = (depthSlack * (2 * radius / mapSize)) / far;
        // Slope bias BASE — identical formula, just with the slope slack count. The shader multiplies
        // it by clamped tan(surface angle). Two symmetric slack terms (flat + slope), same currency.
        const slopeBias = (slopeSlack * (2 * radius / mapSize)) / far;

        return {
            left: -radius,
            right: radius,
            bottom: -radius,
            top: radius,
            near: 0.1,
            far: far,
            eye: eye,
            up: lUp,
            // Depth-comparison bias, derived from geometry instead of hand-tuned. The shadow map is
            // 32-bit float, so precision isn't the limit — acne comes from LATERAL texel quantization:
            // the map holds one depth per texel of world-footprint (2*radius/mapSize), and a receiver's
            // depth varies across that footprint. Bias must cover that variation, expressed in the
            // shader's normalized [0,1] depth (so divided by the depth range). Every term comes from
            // the fit, so the SAME slack texel count (lightingConstants.AUTO_SHADOW.DEPTH_SLACK_TEXELS)
            // holds at any distance or map size — that's what makes it auto, not per-scene. (The surface
            // ANGLE is handled separately by the shader's slope-scaled bias term.)
            bias: bias,
            slopeBias: slopeBias,
            texel: texel, // world-space shadow texel size, for normal-offset bias
            radius: radius, // sphere radius of this slice — used for per-cascade readout / normal offset
            pullback: pullback // depth extension toward the light for this slice
        };
    }

    /**
     * Derive the shadow-box pullback from real caster geometry: the largest distance any caster's
     * nearest-to-light point sits ABOVE the box's near edge along the light axis. Uses each object's
     * world AABB (Goblin body.aabb) when available, else its transform position with a default radius.
     * Returns world units, clamped to a sane band. O(casters), runs each frame — casters move.
     * @param {Array} casters - renderable/shadow-casting objects
     * @param {Vector3} L - normalized light travel direction (from light toward scene)
     * @param {Vector3} center - shadow box center (camera frustum slice center)
     * @param {number} radius - shadow box radius
     * @returns {number} pullback in world units
     */
    static _autoPullback(casters, L, center, radius, maxPullback) {
        const projNearEdge = center.dot(L) - radius; // box near edge (toward light) along L
        let maxNeeded = 0;
        for (let i = 0; i < casters.length; i++) {
            const obj = casters[i];
            if (!obj) continue;
            const aabb = obj.body && obj.body.aabb;
            let projTop; // smallest dot(corner, L) over the object = its nearest-to-light extent
            if (aabb && aabb.min && aabb.max) {
                projTop =
                    (L.x < 0 ? aabb.max.x : aabb.min.x) * L.x +
                    (L.y < 0 ? aabb.max.y : aabb.min.y) * L.y +
                    (L.z < 0 ? aabb.max.z : aabb.min.z) * L.z;
            } else {
                const t = obj.transform && obj.transform.position;
                const p = t || (obj.body && obj.body.position) || obj.position;
                if (!p) continue;
                projTop = p.x * L.x + p.y * L.y + p.z * L.z - 10; // default ~10u half-extent toward light
            }
            const needed = projNearEdge - projTop; // >0 means this caster rises above the box
            if (needed > maxNeeded) maxNeeded = needed;
        }
        // small margin so a caster exactly at the edge still renders; clamp out runaway values
        const pb = maxNeeded + 2;
        return Math.max(1, Math.min(pb, maxPullback || 5000));
    }
}

// All auto-shadow tunables (slack texels, snap, quant, padding, max-pullback) now live in ONE place:
// lightingConstants.AUTO_SHADOW. The renderer reads them and threads them into fitDirectional via opts,
// so ActionShadowFit stays a pure function and there are no config statics scattered on this class.

// Last computed fit values, published each frame for the live debug panel. In single-fit mode
// `lastFit` is one record and `lastCascades` is null; in CSM mode it's reversed (lastCascades is an
// array of per-cascade records, lastFit is null).
ActionShadowFit.lastFit = null;
ActionShadowFit.lastCascades = null;
