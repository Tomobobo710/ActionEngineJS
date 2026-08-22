// actionengine/character/actionclipsampler.js
/**
 * ActionClipSampler — evaluate a glTF animation clip at an ARBITRARY time, into a caller-owned pose.
 *
 * WHY THIS EXISTS ALONGSIDE glbloader's Animation/AnimationSampler
 * Those drive a single character forward at wall-clock speed, and they are correct for that. They are
 * unusable for server-side rewind for two reasons:
 *
 *   1. `AnimationSampler.getValue(t)` keeps `currentIndex` between calls and scans FORWARD from it.
 *      Correct while time only advances; seeking backward to an arbitrary past tick makes the result
 *      depend on call history. Rewind needs a pure function of `t`.
 *   2. `Animation.update(t, nodes)` writes TRS onto the SHARED node array. One pose can exist at a
 *      time, so N players stomp each other, and "player 3 at tick 40" cannot coexist with "player 3
 *      now" — which is precisely what lag compensation needs.
 *
 * This is the pure version: binary search, no retained state, no wall clock, no allocation, and it
 * writes into an ActionPose the caller owns. Source does the same thing — it restores animation INPUTS
 * (cycle, sequence, layer weights) and re-derives bones rather than storing bone matrices. See
 * HITBOX_SKELETON_PLAN.md §8 and §12.
 *
 * The playback path in glbloader stays exactly as it is; nothing here replaces it.
 */
class ActionClipSampler {
    /**
     * Prepare a loaded glTF clip for sampling: resolve channel target nodes to BONE INDICES once, so
     * per-frame work is array reads rather than name lookups.
     *
     * Takes the RAW glTF animation (what GLBRigLoader passes straight through): a channel's `sampler`
     * is an index into `animation.samplers`, and a sampler's `input`/`output` are ACCESSOR indices, not
     * decoded arrays. `read` turns an accessor into a typed array — pass `rig.read`.
     *
     * @param {Object} clip      raw glTF animation { name, samplers, channels }
     * @param {Object} gltf      the parsed glTF (to resolve a channel's target node to a name)
     * @param {ActionSkeleton} skeleton
     * @param {Function} read    (accessorIndex, size) -> Float32Array — GLBRigLoader's reader
     */
    constructor(clip, gltf, skeleton, read) {
        this.name = clip.name;
        this.duration = 0;
        this.tracks = [];

        for (const ch of clip.channels) {
            const target = ch.target || ch;
            const node = gltf.nodes[target.node !== undefined ? target.node : ch.targetNode];
            const bone = skeleton.boneIndex(node.name);
            // A clip may target nodes this skeleton does not have (a mesh node, a bone from another
            // rig). Skipping is correct and expected — it is not an error worth throwing over.
            if (bone < 0) continue;

            const path = target.path || ch.targetPath;
            const stride = path === "rotation" ? 4 : 3;
            const s = clip.samplers[ch.sampler];
            const times = read(s.input, 1);
            const values = read(s.output, stride);

            // The node's BIND translation, straight from the file. A translation channel is absolute, so
            // this is what gets subtracted to recover a delta — see the note in `sample`. It has to come
            // from the .glb rather than from the skeleton, because the two hierarchies need not agree.
            const bind = node.translation || [0, 0, 0];
            this.tracks.push({ bone, path, times, values, stride, bind });
            const last = times[times.length - 1];
            if (last > this.duration) this.duration = last;
        }
    }

    /**
     * Sample at `t` seconds and write into `pose`.
     *
     * ADDITIVE by default, matching how ActionPose layers compose (`rotate`/`translate` both `+=`), so
     * a clip stacks with the aim layer and the weapon hold the same way they stack with each other.
     * Pass `replace: true` for a BASE clip, which must SET the pose rather than add to whatever a
     * previous layer left — see §12.2.
     *
     * `weight` scales the contribution, which is what makes cross-fades and partial layers possible.
     *
     * @param {ActionPose} pose
     * @param {number} t        seconds; wrapped into the clip's duration when `loop`
     * @param {Object} [opts]   { weight = 1, loop = true, replace = false, mask = null }
     */
    sample(pose, t, opts) {
        const weight = opts && opts.weight !== undefined ? opts.weight : 1;
        const loop = !opts || opts.loop !== false;
        const replace = !!(opts && opts.replace);
        const mask = (opts && opts.mask) || null;
        if (weight === 0) return;

        const time = loop && this.duration > 0
            ? t - Math.floor(t / this.duration) * this.duration // positive modulo: negative t is valid
            : Math.max(0, Math.min(t, this.duration));

        for (const track of this.tracks) {
            const b = track.bone;
            // A per-bone mask is what lets a reload move the arms and leave the legs alone (§12.2).
            const w = mask ? weight * (mask[b] !== undefined ? mask[b] : 1) : weight;
            if (w === 0) continue;

            const i = ActionClipSampler._seek(track.times, time);
            const t0 = track.times[i];
            const t1 = track.times[i + 1];
            const f = t1 > t0 ? (time - t0) / (t1 - t0) : 0;
            const a = i * track.stride;
            const c = a + track.stride;
            const v = track.values;

            if (track.path === "rotation") {
                // STRAIGHT TO THE QUATERNION CHANNEL — no Euler round trip.
                //
                // This used to convert to Euler, which cannot represent an arbitrary 3-axis rotation and
                // silently mangled anything that was not a single-axis pose. An authored crouch was the
                // first clip to prove it: it came into the game as a standing figure with scattered
                // limbs, because every hip and knee carried a genuine 3-axis quaternion.
                const q = ActionClipSampler._slerp(v, a, c, f);
                if (w >= 1) {
                    pose.setQuat(b, q.x, q.y, q.z, q.w);
                } else {
                    // Partial weight = slerp from identity, which is how a clip fades in or a masked
                    // layer applies at less than full strength.
                    const t = ActionClipSampler._nlerpIdentity(q, w);
                    pose.setQuat(b, t.x, t.y, t.z, t.w);
                }
                // NOTE: `replace` is not honoured for rotation — setQuat always replaces. Additive
                // quaternion blending between two clips is a real feature and it is NOT this; it needs
                // the blending layer in HITBOX_SKELETON_PLAN.md §12.2. The Euler channels remain
                // additive underneath, so the aim layer still stacks on top of a clip.
            } else if (track.path === "translation") {
                // A translation channel is ABSOLUTE in glTF (it replaces the node's rest translation),
                // but ActionPose.offset* is a DELTA from rest — so the bind translation comes off first,
                // or every clip would teleport the skeleton to model-space coordinates.
                //
                // The bind value is the one FROM THE FILE (`track.bind`), NOT the skeleton's `restX/Y/Z`.
                // Those two are not the same number: the skeleton is built from the character
                // definition, and its parent chain need not match the .glb's node hierarchy. Using the
                // skeleton's rest left a residue on every limb bone — measured at 38-48% STRETCH on
                // arms and legs, which read in-game as detached hands and one leg longer than the other.
                //
                // Blender keys translation on every bone even for a rotation-only pose, so for most
                // bones this correctly cancels to exactly zero.
                const dx = ActionClipSampler._lerp(v[a], v[c], f) - track.bind[0];
                const dy = ActionClipSampler._lerp(v[a + 1], v[c + 1], f) - track.bind[1];
                const dz = ActionClipSampler._lerp(v[a + 2], v[c + 2], f) - track.bind[2];
                if (replace) {
                    pose.offsetX[b] = dx * w;
                    pose.offsetY[b] = dy * w;
                    pose.offsetZ[b] = dz * w;
                } else {
                    pose.translate(b, dx * w, dy * w, dz * w);
                }
            } else if (track.path === "scale") {
                // SCALE. Squashing a limb in Blender exports as bone scale, not as rotation — dropping
                // this channel left a hand-squashed leg at full length in game while the rotated leg
                // looked fine, which is a confusing way for the bug to present.
                //
                // Weight blends toward 1 (no scale) rather than toward 0, since unit scale is the
                // identity here.
                const sx = ActionClipSampler._lerp(v[a], v[c], f);
                const sy = ActionClipSampler._lerp(v[a + 1], v[c + 1], f);
                const sz = ActionClipSampler._lerp(v[a + 2], v[c + 2], f);
                pose.setScale(b, 1 + (sx - 1) * w, 1 + (sy - 1) * w, 1 + (sz - 1) * w);
            }
            // NOTE: a scaled bone moves the MESH but not the cached hit-volume AABBs (§11.6), so a clip
            // that scales heavily will drift what you see from what you shoot. Fine for a crouch pose;
            // worth revisiting if scale ever becomes a per-frame animation channel.
        }
    }

    /**
     * Index of the keyframe at or before `t`. BINARY SEARCH — no retained cursor, so the result depends
     * only on `t`. That is the whole point: rewind seeks backward to arbitrary ticks.
     */
    static _seek(times, t) {
        let lo = 0, hi = times.length - 1;
        if (t <= times[0]) return 0;
        if (t >= times[hi]) return hi - 1 < 0 ? 0 : hi - 1;
        while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (times[mid] <= t) lo = mid; else hi = mid;
        }
        return lo;
    }

    static _lerp(a, b, f) { return a + (b - a) * f; }

    /** Shortest-arc slerp between two quaternions in a flat array. Writes into a shared scratch. */
    static _slerp(v, a, c, f) {
        let ax = v[a], ay = v[a + 1], az = v[a + 2], aw = v[a + 3];
        const bx = v[c], by = v[c + 1], bz = v[c + 2], bw = v[c + 3];
        let dot = ax * bx + ay * by + az * bz + aw * bw;
        // Negate one end when the dot is negative, or the interpolation takes the long way round.
        if (dot < 0) { dot = -dot; ax = -ax; ay = -ay; az = -az; aw = -aw; }
        let s0, s1;
        if (dot > 0.9995) { // nearly parallel — lerp, since slerp goes numerically unstable here
            s0 = 1 - f;
            s1 = f;
        } else {
            const theta = Math.acos(dot);
            const sin = Math.sin(theta);
            s0 = Math.sin((1 - f) * theta) / sin;
            s1 = Math.sin(f * theta) / sin;
        }
        const q = ActionClipSampler._q;
        q.x = ax * s0 + bx * s1;
        q.y = ay * s0 + by * s1;
        q.z = az * s0 + bz * s1;
        q.w = aw * s0 + bw * s1;
        return q;
    }

    /**
     * Quaternion -> the pose's roll(Z) -> pitch(X) -> yaw(Y) convention, matching ActionPose._rot.
     * Writes into a shared scratch — this runs per bone per entity per tick and must not allocate.
     *
     * PITCH IS NEGATED, and that is not a fudge. ActionPose's +pitch swings a bone's children BACKWARD
     * (-z) — see the note in ActionPose.update — so a weapon hold that reaches FORWARD is authored as
     * +0.79 in WEAPON_HOLD but exported as a rotation of -0.79 about +X (see export-rig.js). Reading it
     * back has to undo that, or the arm points out the character's back.
     *
     * Verified rather than assumed: sampling the exported `weaponHold` clip must land the right hand in
     * the same place as the code-authored pose. verify-clip-sampler.js checks exactly that, and caught
     * this sign when it was missing.
     */
    static _toEuler(q) {
        const { x, y, z, w } = q;
        const e = ActionClipSampler._e;
        // pitch (X), clamped: |sin| > 1 by float error at the poles would make asin NaN.
        const sp = 2 * (w * x - y * z);
        e.pitch = -Math.asin(Math.max(-1, Math.min(1, sp)));
        if (Math.abs(sp) > 0.99999) {
            // Gimbal lock: yaw and roll are no longer independent, so fold both into yaw.
            e.yaw = 2 * Math.atan2(y, w);
            e.roll = 0;
        } else {
            e.yaw = Math.atan2(2 * (w * y + x * z), 1 - 2 * (x * x + y * y));
            e.roll = Math.atan2(2 * (w * z + x * y), 1 - 2 * (x * x + z * z));
        }
        return e;
    }

    /**
     * Scale a rotation by `w`: interpolate from identity toward `q`, normalised. Weight 0 leaves the
     * bone at rest, weight 1 applies the clip fully — which is how a clip fades in, or how a masked
     * layer applies at partial strength.
     */
    static _nlerpIdentity(q, w) {
        const out = ActionClipSampler._qw;
        // Take the short way round — a quaternion and its negation are the same rotation.
        const s = q.w < 0 ? -1 : 1;
        out.x = s * q.x * w;
        out.y = s * q.y * w;
        out.z = s * q.z * w;
        out.w = (1 - w) + s * q.w * w;
        const len = Math.hypot(out.x, out.y, out.z, out.w) || 1;
        out.x /= len; out.y /= len; out.z /= len; out.w /= len;
        return out;
    }

    static _q = { x: 0, y: 0, z: 0, w: 1 };
    static _qw = { x: 0, y: 0, z: 0, w: 1 };
    static _e = { pitch: 0, yaw: 0, roll: 0 };
}

if (typeof module !== "undefined" && module.exports) module.exports = ActionClipSampler;
