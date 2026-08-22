// actionengine/character/actionskeleton.js
/**
 * ActionSkeleton / ActionPose — the bone hierarchy and the pose buffer.
 *
 * THE SPLIT THAT MATTERS:
 *   ActionSkeleton = the RIG. Immutable, shared by every character using this model: bone names,
 *                    parents, and rest (bind) offsets. One instance per model, ever.
 *   ActionPose     = one character's CURRENT pose. Per-bone local rotations and offsets, plus the
 *                    world transforms computed from them. One instance PER ENTITY.
 *
 * That split is the whole point. The GLB path mutates node TRS in place on the shared model
 * (glbloader's Animation.update writes straight into Node.translation/rotation), which is fine for
 * one character and corrupts immediately with N players on one rig. Keeping the rig immutable and the
 * pose per-entity is what makes N players — and server-side rewind, where several poses of the same
 * rig must be alive at once — possible at all.
 *
 * WHY A FLAT ARRAY, NOT AN OBJECT TREE: bones are stored topologically sorted (parents always before
 * children), so computing world transforms is one forward pass — no recursion, no allocation. At 60Hz
 * × N players × 25 bones that matters, and it's also what lets a pose be cheaply copied or cached.
 *
 * LAYERING: a pose is just a buffer things write into, which is what makes an animation stack
 * possible — a base clip writes local rotations, an additive aim layer adds to them, an IK pass reads
 * the resulting world transforms and writes corrections back. Nothing here knows about clips, time, or
 * IK; it is only the substrate they share.
 */

/** One bone: a name, a parent index, and a rest offset relative to that parent. */
class ActionBone {
    constructor(name, parentIndex, restX, restY, restZ) {
        this.name = name;
        this.parent = parentIndex; // -1 for a root; ALWAYS < this bone's own index
        this.restX = restX;
        this.restY = restY;
        this.restZ = restZ;
    }
}

class ActionSkeleton {
    /**
     * @param {Array} defs - [{ name, parent: <name|null>, x, y, z }] where x/y/z is the bone's rest
     *                       position in MODEL space (not parent-relative — this converts).
     */
    constructor(defs) {
        this.bones = [];
        this.index = {}; // name -> bone index

        const byName = {};
        for (const d of defs) byName[d.name] = d;
        // Topological sort: emit a bone only once its parent has been emitted, so the world pass can be
        // a single forward loop. Also catches cycles and dangling parents at build time rather than as
        // a mystery at runtime.
        const emitted = {};
        const visit = (d, stack) => {
            if (emitted[d.name]) return;
            if (stack[d.name]) throw new Error("ActionSkeleton: cycle at bone '" + d.name + "'");
            stack[d.name] = true;
            let parentIndex = -1;
            if (d.parent) {
                const p = byName[d.parent];
                if (!p) throw new Error("ActionSkeleton: bone '" + d.name + "' has unknown parent '" + d.parent + "'");
                visit(p, stack);
                parentIndex = this.index[d.parent];
            }
            stack[d.name] = false;
            const px = parentIndex >= 0 ? byName[d.parent].x : 0;
            const py = parentIndex >= 0 ? byName[d.parent].y : 0;
            const pz = parentIndex >= 0 ? byName[d.parent].z : 0;
            this.index[d.name] = this.bones.length;
            this.bones.push(new ActionBone(d.name, parentIndex, d.x - px, d.y - py, d.z - pz));
            emitted[d.name] = true;
        };
        for (const d of defs) visit(d, {});
    }

    get count() { return this.bones.length; }

    /** Bone index by name, or -1. */
    boneIndex(name) {
        const i = this.index[name];
        return i === undefined ? -1 : i;
    }

    /** A fresh pose for this skeleton, sitting at rest. */
    createPose() { return new ActionPose(this); }
}

/**
 * One character's pose. Layers write into `localPitch` and `offsetX/Y/Z`; `update()` composes the
 * chain into world transforms. Everything is a preallocated typed array — a pose is rebuilt every
 * tick per player, so it must not allocate.
 *
 * Rotation is pitch-only for now (the one axis anything currently drives). Yaw/roll channels exist so
 * a clip or IK pass can write them without changing this class's shape.
 */
class ActionPose {
    constructor(skeleton) {
        this.skeleton = skeleton;
        const n = skeleton.count;
        this.localPitch = new Float32Array(n);
        this.localYaw = new Float32Array(n);
        this.localRoll = new Float32Array(n);
        // QUATERNION channel, alongside the Euler one.
        //
        // The Euler channels are additive and read well for hand-authored layers ("pitch the spine by
        // 0.5"), but they cannot represent an arbitrary rotation without gimbal loss — a clip bone
        // carrying a genuine 3-axis quaternion round-trips to Euler and back wrong. That is not
        // hypothetical: an authored crouch was the first clip to expose it, and it came out as a
        // standing figure with scattered limbs.
        //
        // So a bone has BOTH. `setQuat` writes an exact rotation (clips, IK); `rotate` keeps adding
        // Euler on top (aim layer, weapon hold). `update` multiplies the quaternion by the Euler part,
        // so the two compose instead of competing.
        this.localQX = new Float32Array(n);
        this.localQY = new Float32Array(n);
        this.localQZ = new Float32Array(n);
        this.localQW = new Float32Array(n);
        this.offsetX = new Float32Array(n);
        this.offsetY = new Float32Array(n);
        this.offsetZ = new Float32Array(n);
        // SCALE, per bone. An artist squashing a limb in Blender exports as bone scale, not as a
        // rotation — so without this channel that limb simply stays full length in game, which is
        // exactly what a hand-squashed crouch looked like.
        //
        // Scale affects the CHILD's placement (a half-length thigh puts the knee half as far down) and
        // the part's own geometry. It accumulates down the chain like rotation does.
        this.scaleX = new Float32Array(n);
        this.scaleY = new Float32Array(n);
        this.scaleZ = new Float32Array(n);
        this.worldScaleX = new Float32Array(n);
        this.worldScaleY = new Float32Array(n);
        this.worldScaleZ = new Float32Array(n);
        this.scaleX.fill(1); this.scaleY.fill(1); this.scaleZ.fill(1);
        this.worldScaleX.fill(1); this.worldScaleY.fill(1); this.worldScaleZ.fill(1);
        this.worldX = new Float32Array(n);
        this.worldY = new Float32Array(n);
        this.worldZ = new Float32Array(n);
        this.worldPitch = new Float32Array(n);
        this.worldYaw = new Float32Array(n);
        this.worldRoll = new Float32Array(n);
        // World-space rotation as a quaternion — what the mesh and hit volumes should read once they
        // need more than pitch.
        this.worldQX = new Float32Array(n);
        this.worldQY = new Float32Array(n);
        this.worldQZ = new Float32Array(n);
        this.worldQW = new Float32Array(n);
        this.localQW.fill(1);
        this.worldQW.fill(1);
    }

    /** Zero every layer contribution — call before rebuilding a pose from its layers. */
    reset() {
        this.localPitch.fill(0);
        this.localYaw.fill(0);
        this.localRoll.fill(0);
        this.localQX.fill(0);
        this.localQY.fill(0);
        this.localQZ.fill(0);
        this.localQW.fill(1); // identity, not zero — a zero quaternion is not a rotation
        this.offsetX.fill(0);
        this.offsetY.fill(0);
        this.offsetZ.fill(0);
        this.scaleX.fill(1); // 1, not 0 — an unscaled bone is unit scale
        this.scaleY.fill(1);
        this.scaleZ.fill(1);
    }

    /** Set a bone's local scale. Replaces, like `setQuat` — a clip states what the scale IS. */
    setScale(boneIndex, x, y, z) {
        if (boneIndex < 0) return;
        this.scaleX[boneIndex] = x;
        this.scaleY[boneIndex] = y;
        this.scaleZ[boneIndex] = z;
    }

    /**
     * Set a bone's local rotation EXACTLY, from a quaternion. Replaces rather than accumulates — a clip
     * states what the rotation IS, unlike a layer that nudges it.
     */
    setQuat(boneIndex, x, y, z, w) {
        if (boneIndex < 0) return;
        this.localQX[boneIndex] = x;
        this.localQY[boneIndex] = y;
        this.localQZ[boneIndex] = z;
        this.localQW[boneIndex] = w;
    }

    /** Add a local rotation to one bone (additive, so layers compose). No-op for an unknown bone. */
    rotate(boneIndex, pitch, yaw, roll) {
        if (boneIndex < 0) return;
        this.localPitch[boneIndex] += pitch || 0;
        this.localYaw[boneIndex] += yaw || 0;
        this.localRoll[boneIndex] += roll || 0;
    }

    /**
     * Add a local translation to one bone — the squash/stretch channel. Moves the bone away from its
     * parent, carrying its descendants, so it lengthens the gap the bone spans.
     *
     * Applied in the bone's OWN rotated frame (after this bone's rotation, before its children's), so
     * a stretch runs along the axis this bone points down — not along the parent's. That distinction
     * matters on a chain: stretching the neck should follow where the neck is pointing, not where the
     * spine below it is.
     */
    translate(boneIndex, x, y, z) {
        if (boneIndex < 0) return;
        this.offsetX[boneIndex] += x || 0;
        this.offsetY[boneIndex] += y || 0;
        this.offsetZ[boneIndex] += z || 0;
    }

    /**
     * Compose local transforms into world transforms — one forward pass, parents before children
     * (guaranteed by the skeleton's topological order). This is what a hierarchy buys: rotating one
     * bone moves everything below it with no membership list.
     */
    update() {
        const bones = this.skeleton.bones;
        for (let i = 0; i < bones.length; i++) {
            const b = bones[i];
            const p = b.parent;

            // LOCAL rotation = the exact quaternion (a clip) composed with the Euler layers stacked on
            // top (aim, weapon hold). Multiplying rather than choosing is what lets a clip and a layer
            // both drive one bone — the crouch bends the knee, the aim layer still pitches the spine.
            const q = ActionPose._eulerToQuat(this.localPitch[i], this.localYaw[i], this.localRoll[i]);
            const lq = ActionPose._qmul(
                this.localQX[i], this.localQY[i], this.localQZ[i], this.localQW[i],
                q.x, q.y, q.z, q.w, ActionPose._q1
            );

            // WORLD rotation accumulates down the chain by quaternion multiply. Euler addition (what
            // this used to do) is only correct when every rotation shares an axis; a real clip does not.
            if (p < 0) {
                this.worldQX[i] = lq.x; this.worldQY[i] = lq.y;
                this.worldQZ[i] = lq.z; this.worldQW[i] = lq.w;
            } else {
                const w = ActionPose._qmul(
                    this.worldQX[p], this.worldQY[p], this.worldQZ[p], this.worldQW[p],
                    lq.x, lq.y, lq.z, lq.w, ActionPose._q2
                );
                this.worldQX[i] = w.x; this.worldQY[i] = w.y;
                this.worldQZ[i] = w.z; this.worldQW[i] = w.w;
            }
            // Euler world channels stay populated: the mesh and the hit volumes still read `worldPitch`
            // to tip a limb, and the aim layer is pitch-only, so this remains exact for them.
            this.worldPitch[i] = (p >= 0 ? this.worldPitch[p] : 0) + this.localPitch[i];
            this.worldYaw[i] = (p >= 0 ? this.worldYaw[p] : 0) + this.localYaw[i];
            this.worldRoll[i] = (p >= 0 ? this.worldRoll[p] : 0) + this.localRoll[i];

            // Scale accumulates down the chain, same as rotation: a half-length thigh also halves how
            // far everything below it reaches.
            this.worldScaleX[i] = (p >= 0 ? this.worldScaleX[p] : 1) * this.scaleX[i];
            this.worldScaleY[i] = (p >= 0 ? this.worldScaleY[p] : 1) * this.scaleY[i];
            this.worldScaleZ[i] = (p >= 0 ? this.worldScaleZ[p] : 1) * this.scaleZ[i];

            if (p < 0) {
                this.worldX[i] = b.restX + this.offsetX[i];
                this.worldY[i] = b.restY + this.offsetY[i];
                this.worldZ[i] = b.restZ + this.offsetZ[i];
                continue;
            }
            // The bone's REST offset is SCALED by the parent's accumulated scale, then rotated by the
            // parent's accumulated rotation — that is what places the bone. Scaling before rotating is
            // what makes a squashed thigh actually pull the knee up rather than just squashing pixels.
            const r = ActionPose._qrot(
                this.worldQX[p], this.worldQY[p], this.worldQZ[p], this.worldQW[p],
                b.restX * this.worldScaleX[p],
                b.restY * this.worldScaleY[p],
                b.restZ * this.worldScaleZ[p],
                ActionPose._v1
            );
            // The STRETCH offset rotates by THIS bone's accumulated rotation instead, so it runs along
            // the axis this bone points down (see translate()).
            //
            const o = ActionPose._qrot(
                this.worldQX[i], this.worldQY[i], this.worldQZ[i], this.worldQW[i],
                this.offsetX[i], this.offsetY[i], this.offsetZ[i], ActionPose._v2
            );
            this.worldX[i] = this.worldX[p] + r.x + o.x;
            this.worldY[i] = this.worldY[p] + r.y + o.y;
            this.worldZ[i] = this.worldZ[p] + r.z + o.z;
        }
    }
}

// Scratch objects — `update()` runs per bone per entity per tick and must not allocate.
ActionPose._q1 = { x: 0, y: 0, z: 0, w: 1 };
ActionPose._q2 = { x: 0, y: 0, z: 0, w: 1 };
ActionPose._qe = { x: 0, y: 0, z: 0, w: 1 };
ActionPose._q3 = { x: 0, y: 0, z: 0, w: 1 };
ActionPose._v1 = { x: 0, y: 0, z: 0 };
ActionPose._v2 = { x: 0, y: 0, z: 0 };

/** Quaternion product a*b, into `out`. */
ActionPose._qmul = function (ax, ay, az, aw, bx, by, bz, bw, out) {
    out.x = aw * bx + ax * bw + ay * bz - az * by;
    out.y = aw * by - ax * bz + ay * bw + az * bx;
    out.z = aw * bz + ax * by - ay * bx + az * bw;
    out.w = aw * bw - ax * bx - ay * by - az * bz;
    return out;
};

/**
 * Euler -> quaternion in the SAME order `_rot` applied: roll (Z), then pitch (X), then yaw (Y).
 * Keeping the order identical is what makes the aim layer and the weapon hold land exactly where they
 * did before the quaternion channel existed.
 */
ActionPose._eulerToQuat = function (pitch, yaw, roll) {
    const out = ActionPose._qe;
    if (!pitch && !yaw && !roll) {
        out.x = out.y = out.z = 0;
        out.w = 1;
        return out;
    }
    // PITCH IS NEGATED; yaw and roll are not. Measured against `_rot`, one axis at a time — this is not
    // a fudge factor. The pose's +pitch means "looking up", which swings a bone's children BACKWARD
    // (-z), the opposite of a right-handed rotation about +X. Yaw and roll already agree.
    pitch = -pitch;
    const cp = Math.cos(pitch * 0.5), sp = Math.sin(pitch * 0.5);
    const cy = Math.cos(yaw * 0.5), sy = Math.sin(yaw * 0.5);
    const cr = Math.cos(roll * 0.5), sr = Math.sin(roll * 0.5);
    // q = yaw * pitch * roll, so applying it runs right-to-left: roll first, then pitch, then yaw —
    // the same order `_rot` used. Built as two plain quaternion products rather than an expanded
    // closed form, because the expanded version is easy to get subtly wrong and impossible to read.
    const a = ActionPose._qmul(sp, 0, 0, cp, 0, 0, sr, cr, ActionPose._q3); // pitch * roll
    return ActionPose._qmul(0, sy, 0, cy, a.x, a.y, a.z, a.w, out); // yaw * (pitch * roll)
};

/** Rotate a vector by a quaternion, into `out`. */
ActionPose._qrot = function (qx, qy, qz, qw, x, y, z, out) {
    // t = 2 * (q.xyz x v);  v' = v + q.w * t + q.xyz x t
    const tx = 2 * (qy * z - qz * y);
    const ty = 2 * (qz * x - qx * z);
    const tz = 2 * (qx * y - qy * x);
    out.x = x + qw * tx + qy * tz - qz * ty;
    out.y = y + qw * ty + qz * tx - qx * tz;
    out.z = z + qw * tz + qx * ty - qy * tx;
    return out;
};

/**
 * Rotate (x,y,z) by roll (Z), then pitch (X), then yaw (Y). Writes into a shared scratch object and
 * returns it — `update()` runs per bone per entity per tick, so this must not allocate.
 *
 * Order matters and this one is chosen to match how a limb reads: roll lifts the arm away from the
 * body, pitch swings it forward/back, yaw turns it about the body's vertical.
 */
ActionPose._scratch = { x: 0, y: 0, z: 0 };
ActionPose._rot = function (x, y, z, pitch, yaw, roll) {
    const out = ActionPose._scratch;
    if (roll) {
        const c = Math.cos(roll), s = Math.sin(roll);
        const nx = x * c - y * s;
        y = x * s + y * c;
        x = nx;
    }
    if (pitch) {
        const c = Math.cos(pitch), s = Math.sin(pitch);
        const ny = y * c + z * s;
        z = -y * s + z * c;
        y = ny;
    }
    if (yaw) {
        const c = Math.cos(yaw), s = Math.sin(yaw);
        const nx = x * c + z * s;
        z = -x * s + z * c;
        x = nx;
    }
    out.x = x; out.y = y; out.z = z;
    return out;
};
