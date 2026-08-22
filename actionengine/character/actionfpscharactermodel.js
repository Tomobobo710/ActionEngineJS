// actionengine/character/actionfpscharactermodel.js
/**
 * ActionFPSCharacterModel - the engine's DEFAULT, swappable first-person-game character mesh.
 *
 * A humanoid built as an ActionModel3D (the engine's model abstraction, same one the weapon
 * viewmodels use). `color` is the per-player identity tint (team/FFA) — supplied by the game; the
 * MESH is engine mechanism.
 *
 * EVERYTHING HERE IS IN REFERENCE UNITS — the 0.6 × 1.8 × 0.6 reference collider, origin at the body
 * centre, feet at y=-0.9, head crown at y=+0.9. A dimension you read is the dimension in the world;
 * nothing is scaled on the way in. (The live collider may differ — a crouched or resized player — and
 * ActionFPSBodyModel scales the whole figure to fit at pose time. That is the ONLY scaling.)
 *
 * Proportions come from the 3D fighter's ExampleFighter (fighter3d-v5,
 * game/characters/examplefighter.js — the fighter that game actually instantiates), converted once
 * into the units above rather than carried around in the source figure's ~70-unit scale.
 *
 * Naming is JOINT-centric, as in the source: a part is named for the joint it hangs off. Note the
 * chain is finer than a typical rig — hip AND upperLeg AND knee AND lowerLeg AND foot — because the
 * ball joints (hip/knee/shoulder/elbow) are their own visible spheres between the limb capsules.
 *
 * MULTI-PART BY DESIGN. One named object PER BODY PART (see PARTS), never a merged blob:
 *   1. A real GLB drops in with its mesh nodes already split per part, so code that poses N named
 *      parts needs no change when the procedural mesh is swapped for an authored one.
 *   2. The per-bone HIT VOLUME layer (HITBOX_SKELETON_PLAN.md) binds volumes to these same names,
 *      so "did the ray hit the head" has one vocabulary shared by cosmetics and combat.
 *
 * GLB-swappable: a game drops in a real player model via setBuilder(fn) (fn(color) -> ActionModel3D).
 */
class ActionFPSCharacterModel {
    static _builder = null; // game override; default procedural build used when null

    /**
     * Part name -> HIT GROUP, the Source-style split: MANY boxes, FEW groups. Geometry stays precise
     * (one volume per part, so the gap between a player's legs is a real miss), while damage keys off
     * the coarse group, so "I hit the elbow ball, not the forearm" never matters — both are LEFTARM.
     * Any part absent here falls back to GENERIC.
     *
     * DERIVED FROM `BONES` — see the note there. There is one vocabulary, not four parallel lists.
     */
    static get HIT_GROUPS() {
        return ActionFPSCharacterModel._derive().groups;
    }

    /** Part name -> hit-volume PRIMITIVE. Derived from `BONES`; see the note there. */
    static get KINDS() {
        return ActionFPSCharacterModel._derive().kinds;
    }

    /** Every part that carries geometry, in build order. Derived from `BONES`. */
    static get PARTS() {
        return ActionFPSCharacterModel._derive().parts;
    }

    /** The bones a RIG keeps — real pivots. Limb-centre bones are geometry, not joints. */
    static get JOINT_NAMES() {
        return ActionFPSCharacterModel._derive().joints;
    }

    /**
     * Split `BONES` into the lookup tables the rest of the engine wants. Cached — `BONES` is static
     * data, and these are read per part per frame.
     */
    static _derive() {
        if (ActionFPSCharacterModel._derived) return ActionFPSCharacterModel._derived;
        const groups = {}, kinds = {}, parts = [], joints = [];
        for (const b of ActionFPSCharacterModel.BONES) {
            // A bone whose mesh is named differently (a pivot that shares a name with a mesh part)
            // annotates the PART name, which is what hit volumes and the loader key on.
            const part = b.part || b.name;
            if (b.group) groups[part] = b.group;
            if (b.kind) kinds[part] = b.kind;
            if (b.kind) parts.push(part); // a kind means it carries geometry
            if (b.joint) joints.push(b.name);
        }
        return (ActionFPSCharacterModel._derived = { groups, kinds, parts, joints });
    }

    /**
     * Per-group damage multipliers (game policy, mirroring Source's TraceAttack scaling). Deliberately
     * coarse — these are feel knobs, not physics.
     */
    static HIT_GROUP_DAMAGE = {
        HEAD: 4, NECK: 3, CHEST: 1, STOMACH: 1.25,
        LEFTARM: 0.5, RIGHTARM: 0.5, LEFTLEG: 0.5, RIGHTLEG: 0.5,
        GENERIC: 1
    };

    /**
     * The HIT VOLUMES for one character, in reference-collider local space: one axis-aligned box per
     * body part, DERIVED from the built mesh rather than hand-authored, so the volumes can never drift
     * from the model (swap in a GLB and the volumes follow it).
     *
     * Boxes, not spheres/capsules, for the same reason Source uses OBBs: ray-vs-AABB is the only
     * intersection test the resolver needs (ActionBoxGeometry.rayAABB), and a round part's enclosing
     * box is close enough at this size. Slightly generous on the balls — which is why they're grouped
     * with the limb they sit on and never carry their own multiplier.
     *
     * Returns [{ part, group, cx, cy, cz, hx, hy, hz }] with the offset baked into the center, so a
     * consumer only has to scale, rotate by yaw and translate. Cached: the layout never changes.
     */
    static hitVolumes() {
        if (ActionFPSCharacterModel._volumes) return ActionFPSCharacterModel._volumes;
        const model = ActionFPSCharacterModel.build("#ffffff");
        const out = [];
        for (const o of model.objects) {
            if (!o.triangles || !o.triangles.length) continue;
            let lox = Infinity, loy = Infinity, loz = Infinity;
            let hix = -Infinity, hiy = -Infinity, hiz = -Infinity;
            for (const t of o.triangles) {
                for (const v of t.vertices) {
                    if (v.x < lox) lox = v.x;
                    if (v.y < loy) loy = v.y;
                    if (v.z < loz) loz = v.z;
                    if (v.x > hix) hix = v.x;
                    if (v.y > hiy) hiy = v.y;
                    if (v.z > hiz) hiz = v.z;
                }
            }
            const off = o.localOffset || new Vector3(0, 0, 0);
            // The AABB is kept as a cheap broadphase reject (and as the fallback for a mesh whose
            // parts carry no shape tag, e.g. an imported GLB); `shape` is the exact primitive the
            // narrowphase actually tests against.
            out.push({
                part: o.name,
                group: ActionFPSCharacterModel.HIT_GROUPS[o.name] || "GENERIC",
                cx: (lox + hix) / 2 + off.x,
                cy: (loy + hiy) / 2 + off.y,
                cz: (loz + hiz) / 2 + off.z,
                hx: (hix - lox) / 2,
                hy: (hiy - loy) / 2,
                hz: (hiz - loz) / 2,
                shape: o.hitShape || null
            });
        }
        ActionFPSCharacterModel._volumes = out;
        return out;
    }

    /**
     * AIM ARTICULATION — how the upper body follows the player's look pitch.
     *
     * This is a POSE INPUT, deliberately separate from animation (a pose SOURCE). It's derived from
     * `pitch`, which the sim already tracks, replicates and rewinds — so it costs nothing new on the
     * netcode side and works under lag compensation. In a real rig this is what an aim layer does on
     * top of a walk cycle; Source treats it the same way (a layered pose parameter over the base
     * sequence, not baked into it).
     *
     * TWO-STAGE: the spine takes part of the pitch, the neck takes more on top of it, so the head
     * pitches further than the chest — as a body actually does. Each entry names a BONE; the skeleton
     * carries the rotation to that bone's descendants, so there is no membership list to maintain.
     *
     * DECLARATIVE ON PURPOSE. Adding articulation should be a data edit here, not surgery in the
     * posing code — both the cosmetic model (ActionFPSBodyModel.setState) and the hit volumes
     * (ActionSimTargetProvider.rewound) read the same pose, which is why the mesh you see and the
     * boxes you shoot can't disagree.
     */
    static AIM_PIVOTS = [
        {
            bone: "spine",
            // Fraction of look pitch taken here; the rest passes up the chain. The shares need NOT sum
            // to 1 — their total is how much of the look angle the upper body expresses at all. Summing
            // to 1 makes the head exactly track the aim, which reads as a rubber neck on a rigid trunk;
            // leaning on the spine and stopping short spreads the motion across the torso.
            //
            // No `parts` list: rotating this bone moves its descendants (torso, chest, neck, head, both
            // arms) because the SKELETON encodes them. That's the whole reason the rig exists.
            share: 0.5
        },
        {
            bone: "neck",
            share: 0.3,
            // Squash-and-stretch, the thing animators put on a spine chain: the neck is at REST looking
            // straight ahead and extends toward BOTH extremes, because it's bending away from neutral
            // either way. So it tracks |pitch|, not pitch — symmetric, zero at flat.
            //
            // ABSOLUTE distance in reference units at full deflection, NOT a fraction of the bone —
            // it's the head's travel that was tuned by eye, and expressing it as a fraction silently
            // rescales it by the bone's length.
            stretch: 0.045
        }
    ];

    /**
     * THE RIG — the same parts, as a parented hierarchy rather than a flat list.
     *
     * `spine` and `neckBase` are PIVOTS, not body parts: they carry no mesh, they exist because that's
     * where the body actually bends (the waist, and the base of the neck). The old AIM_PIVOTS had them
     * as bare `pivotY` numbers; here they're bones, so their descendants follow automatically.
     *
     * Positions are model-space in the reference collider — the same heights buildDefault places the
     * meshes at. ActionSkeleton converts them to parent-relative offsets.
     */
    /**
     * ONE VOCABULARY. This list is the whole body definition — names, hierarchy, rest positions, hit
     * groups, hit-volume primitives, and which bones a rig keeps. `HIT_GROUPS`, `KINDS`, `PARTS` and
     * `JOINT_NAMES` are all DERIVED from it (see `_derive`).
     *
     * They used to be four hand-maintained lists of the same 25 names, in two different files, and
     * adding a body part meant four edits that had to agree. Now it is one line.
     *
     * Per-entry fields:
     *   name    bone name — the contract with the .glb, and what the pose/skeleton key on
     *   parent  bone name or null
     *   x,y,z   REST position in model space (ActionSkeleton converts to parent-relative)
     *   part    mesh/volume name, when it differs from the bone name (only where a pivot took the name)
     *   kind    hit-volume primitive: sphere | capsule | cylinder | box. PRESENT = carries geometry.
     *   group   hit group for damage. Absent falls back to GENERIC.
     *   joint   true = a real pivot the exported rig keeps. Limb-CENTRE bones are geometry, not joints,
     *           and their meshes bind to the joint above them.
     */
    static BONES = [
        // ROOT is the pelvis: it never follows aim pitch, so the legs hanging off it stay planted.
        // `spine` is the waist PIVOT (no mesh of its own) and everything above the waist descends from it.
        { name: "pelvis", parent: null, x: 0, y: -0.045, z: 0, kind: "box", group: "STOMACH", joint: true },
        { name: "spine", parent: "pelvis", x: 0, y: 0.032, z: 0, joint: true }, // waist pivot
        { name: "torso", parent: "spine", x: 0, y: 0.160, z: 0, kind: "box", group: "STOMACH" },
        { name: "chest", parent: "torso", x: 0, y: 0.415, z: 0, kind: "box", group: "CHEST", joint: true },
        { name: "neck", parent: "chest", x: 0, y: 0.504, z: 0, joint: true }, // neck pivot = base of the neck
        // The neck MESH hangs off the neck pivot; `part` is what the volume and the loader call it.
        { name: "neckMesh", parent: "neck", x: 0, y: 0.543, z: 0, part: "neck", kind: "cylinder", group: "NECK" },
        { name: "head", parent: "neck", x: 0, y: 0.721, z: 0, kind: "sphere", group: "HEAD", joint: true },

        { name: "leftShoulder", parent: "chest", x: 0.204, y: 0.415, z: 0, kind: "sphere", group: "LEFTARM", joint: true },
        { name: "leftUpperArm", parent: "leftShoulder", x: 0.281, y: 0.364, z: 0, kind: "capsule", group: "LEFTARM" },
        { name: "leftElbow", parent: "leftUpperArm", x: 0.281, y: 0.236, z: 0, kind: "sphere", group: "LEFTARM", joint: true },
        { name: "leftForearm", parent: "leftElbow", x: 0.281, y: 0.109, z: 0, kind: "capsule", group: "LEFTARM" },
        { name: "leftHand", parent: "leftForearm", x: 0.281, y: -0.096, z: 0, kind: "sphere", group: "LEFTARM", joint: true },

        { name: "rightShoulder", parent: "chest", x: -0.204, y: 0.415, z: 0, kind: "sphere", group: "RIGHTARM", joint: true },
        { name: "rightUpperArm", parent: "rightShoulder", x: -0.281, y: 0.364, z: 0, kind: "capsule", group: "RIGHTARM" },
        { name: "rightElbow", parent: "rightUpperArm", x: -0.281, y: 0.236, z: 0, kind: "sphere", group: "RIGHTARM", joint: true },
        { name: "rightForearm", parent: "rightElbow", x: -0.281, y: 0.109, z: 0, kind: "capsule", group: "RIGHTARM" },
        { name: "rightHand", parent: "rightForearm", x: -0.281, y: -0.096, z: 0, kind: "sphere", group: "RIGHTARM", joint: true },

        // Legs hang off the PELVIS, below the waist pivot, so aim pitch never moves them.
        { name: "leftHip", parent: "pelvis", x: 0.128, y: -0.096, z: 0, kind: "sphere", group: "LEFTLEG", joint: true },
        { name: "leftUpperLeg", parent: "leftHip", x: 0.128, y: -0.300, z: 0, kind: "capsule", group: "LEFTLEG" },
        { name: "leftKnee", parent: "leftUpperLeg", x: 0.128, y: -0.504, z: 0, kind: "sphere", group: "LEFTLEG", joint: true },
        { name: "leftLowerLeg", parent: "leftKnee", x: 0.128, y: -0.683, z: 0, kind: "capsule", group: "LEFTLEG" },
        { name: "leftFoot", parent: "leftLowerLeg", x: 0.128, y: -0.862, z: 0.038, kind: "box", group: "LEFTLEG", joint: true },

        { name: "rightHip", parent: "pelvis", x: -0.128, y: -0.096, z: 0, kind: "sphere", group: "RIGHTLEG", joint: true },
        { name: "rightUpperLeg", parent: "rightHip", x: -0.128, y: -0.300, z: 0, kind: "capsule", group: "RIGHTLEG" },
        { name: "rightKnee", parent: "rightUpperLeg", x: -0.128, y: -0.504, z: 0, kind: "sphere", group: "RIGHTLEG", joint: true },
        { name: "rightLowerLeg", parent: "rightKnee", x: -0.128, y: -0.683, z: 0, kind: "capsule", group: "RIGHTLEG" },
        { name: "rightFoot", parent: "rightLowerLeg", x: -0.128, y: -0.862, z: 0.038, kind: "box", group: "RIGHTLEG", joint: true }
    ];

    /**
     * Mesh part name -> bone. DERIVED from the `part` field on BONES, so a rename is one edit.
     * Only differs where a bone name is already taken by a pivot (the neck).
     */
    static get PART_BONE() {
        if (ActionFPSCharacterModel._partBone) return ActionFPSCharacterModel._partBone;
        const m = {};
        for (const b of ActionFPSCharacterModel.BONES) if (b.part) m[b.part] = b.name;
        return (ActionFPSCharacterModel._partBone = m);
    }

    /**
     * The part that represents "the body" for queries that want one object rather than a limb.
     * Named explicitly instead of relying on build order putting it first.
     */
    static ROOT_PART = "pelvis";

    /**
     * A bone's REST position in body-local space, by name (null if unknown). Read from the rig rather
     * than the mesh, so it costs nothing and works for pivot bones that carry no geometry.
     */
    static restOffset(bone) {
        const sk = ActionFPSCharacterModel.skeleton();
        const i = sk.boneIndex(ActionFPSCharacterModel.PART_BONE[bone] || bone);
        if (i < 0) return null;
        const rest = ActionFPSCharacterModel._restPose ||
            (ActionFPSCharacterModel._restPose = (() => { const p = sk.createPose(); p.update(); return p; })());
        return { x: rest.worldX[i], y: rest.worldY[i], z: rest.worldZ[i] };
    }

    /** The shared, immutable rig. Built once; every character poses it via its own ActionPose. */
    static skeleton() {
        if (!ActionFPSCharacterModel._skeleton) {
            ActionFPSCharacterModel._skeleton = new ActionSkeleton(ActionFPSCharacterModel.BONES);
        }
        return ActionFPSCharacterModel._skeleton;
    }

    /**
     * The character's pose at a given look pitch — THE ANIMATION STACK.
     *
     *   1. weapon hold  — static base pose (stands in for an authored clip)
     *   2. aim layer    — look pitch, additive on top
     *
     * Layers write into a pose buffer and `update()` composes the chain; adding a walk clip or an IK
     * pass later means adding a write in this list, not restructuring anything.
     *
     * Cached by quantised pitch: `articulate()` is called per part per frame (25×) and per volume per
     * tick, but the pose depends only on pitch, so one build serves them all.
     */
    static posedAt(pitch, opts) {
        const q = Math.round(pitch * 1024) / 1024; // ~0.06° buckets — finer than anything visible
        // `opts` is `{ hold, clip, time }`. A bare number is still accepted as the hold weight, which is
        // what the earlier signature took.
        const o = typeof opts === "number" ? { hold: opts } : (opts || {});
        const h = o.hold === undefined ? 1 : o.hold;
        // The cache key must name EVERY input, or two different poses collide in the one shared buffer.
        // Clip time is quantised the same way pitch is — a clip sampled 0.0001s apart is the same pose.
        const ct = o.clip ? Math.round((o.time || 0) * 1024) / 1024 : 0;
        const key = q + "|" + h + "|" + (o.clip ? o.clip.name : "-") + "|" + ct;
        if (ActionFPSCharacterModel._poseKey === key && ActionFPSCharacterModel._pose) {
            return ActionFPSCharacterModel._pose;
        }
        const sk = ActionFPSCharacterModel.skeleton();
        const pose = ActionFPSCharacterModel._pose || (ActionFPSCharacterModel._pose = sk.createPose());
        ActionFPSCharacterModel.buildPose(pose, q, o.clip ? { clip: o.clip, time: o.time || 0 } : null, h);
        ActionFPSCharacterModel._poseKey = key;
        return pose;
    }

    /**
     * THE LAYER STACK, into a caller-owned pose buffer.
     *
     * Split out of `posedAt` so a pose can be built for a SPECIFIC entity rather than into the one
     * shared, pitch-keyed buffer. That sharing is safe only while pose is a pure function of pitch —
     * two players at the same pitch genuinely have the same pose. The moment a clip is in the stack it
     * stops being true: pose then depends on which clip, at what time, per player. Per-entity buffers
     * are also what lag compensation needs, since "player 3 at tick 40" has to coexist with "player 3
     * now" (HITBOX_SKELETON_PLAN.md §12.1).
     *
     * Order is the animation stack, and it is deliberate:
     *   1. base clip   — REPLACES (a walk cycle sets the pose)
     *   2. weapon hold — additive (stands in for an authored upper-body clip)
     *   3. aim layer   — additive, on top of whatever the clips produced
     *
     * @param {ActionPose} pose  buffer to fill; reset here, so the caller need not
     * @param {number} pitch     look pitch, radians
     * @param {Object} [anim]    { clip: ActionClipSampler, time, weight, mask } — omit for no clip
     */
    static buildPose(pose, pitch, anim, hold) {
        pose.reset();
        // A base clip REPLACES rather than adds: it is the pose, not a contribution to one. Layers
        // after it are additive and stack on top. See §12.2.
        if (anim && anim.clip) {
            anim.clip.sample(pose, anim.time || 0, {
                weight: anim.weight !== undefined ? anim.weight : 1,
                mask: anim.mask || null,
                replace: true
            });
        }
        ActionFPSCharacterModel.applyWeaponHold(pose, hold);
        ActionFPSCharacterModel.applyAimLayer(pose, pitch);
        pose.update();
        return pose;
    }

    /** A fresh per-entity pose buffer over the shared rig. ~900 bytes; one per character. */
    static createPose() {
        return ActionFPSCharacterModel.skeleton().createPose();
    }

    /**
     * A bone's transform out of a CALLER-OWNED pose — the per-entity counterpart to `articulate`,
     * which reads the shared pitch-keyed buffer.
     */
    static boneAt(pose, part) {
        const bone = ActionFPSCharacterModel.PART_BONE[part] || part;
        const idx = ActionFPSCharacterModel.skeleton().boneIndex(bone);
        if (idx < 0) return null;
        return {
            x: pose.worldX[idx],
            y: pose.worldY[idx],
            z: pose.worldZ[idx],
            pitch: pose.worldPitch[idx],
            // FULL rotation as a quaternion. `pitch` alone is only the whole story for the pitch-only
            // aim layer; a CLIP writes the quaternion channel and leaves `pitch` at zero, so anything
            // orienting geometry from `pitch` leaves limbs unrotated while their joints move — hands
            // detaching from forearms, knees separating. Read the quaternion.
            qx: pose.worldQX[idx],
            qy: pose.worldQY[idx],
            qz: pose.worldQZ[idx],
            qw: pose.worldQW[idx],
            // The bone SCALE, accumulated down the chain. A clip that squashes a limb moves the joints
            // closer together via this, but the geometry hanging off the bone only shrinks if whoever
            // draws it applies the scale too — otherwise a shortened thigh keeps a full-length capsule.
            sx: pose.worldScaleX[idx],
            sy: pose.worldScaleY[idx],
            sz: pose.worldScaleZ[idx]
        };
    }

    /**
     * AIM LAYER — writes the look-pitch pose into `pose`. Additive, so it composes with whatever else
     * wrote before it (a base clip, later). This is what AIM_PIVOTS drove directly before; now each
     * entry names a BONE and the hierarchy handles propagation.
     */
    static applyAimLayer(pose, pitch) {
        if (!pitch) return;
        const sk = ActionFPSCharacterModel.skeleton();
        const bend = Math.abs(Math.sin(pitch)); // symmetric: rest at flat, peaks at both extremes
        for (const piv of ActionFPSCharacterModel.AIM_PIVOTS) {
            const bi = sk.boneIndex(piv.bone);
            if (bi < 0) continue;
            pose.rotate(bi, pitch * piv.share, 0, 0);
            if (!piv.stretch) continue;
            // Extend along THIS bone's own axis, carrying its descendants — the stretch. Driven by the
            // LOOK pitch, not this pivot's share of it, so the authored distance means what it says at
            // full deflection rather than being silently scaled down by `share`.
            pose.translate(bi, 0, piv.stretch * bend, 0);
        }
    }

    /**
     * WEAPON HOLD — a static pistol pose: right arm raised and bent so the hand sits in front of the
     * chest, left arm relaxed at the side.
     *
     * PLACEHOLDER, and deliberately so. A base pose like this belongs in an authored clip (the
     * animator poses the arms; see HITBOX_SKELETON_PLAN.md §7.2) — it is here only so the arms aren't
     * hanging limp while the weapon is attached to the hand. When the clip pipeline lands, this layer
     * is deleted and a "pistol idle" clip writes the same bones; the aim layer keeps stacking on top
     * either way, which is the point of layering.
     *
     * Angles are in radians and describe the RIGHT arm; the left is left at rest. Rotations are on the
     * ball joints (shoulder/elbow), which is where a real arm bends and which is why they're bones
     * rather than decorations.
     */
    static WEAPON_HOLD = {
        // Rotations ACCUMULATE down the chain, so the elbow's value is what it ADDS to the shoulder.
        // Bones hang straight down at rest, and +pitch swings a bone forward (+z).
        rightShoulder: { pitch: 0.79 }, // upper arm swings ~45° forward, out into the space ahead
        rightElbow: { pitch: 0.79 } // +45° more = 90° total, so the forearm levels out flat/horizontal
    };

    /**
     * Write the weapon-hold pose into `pose`. Additive like every other layer, so the aim layer's
     * spine rotation still carries the whole arm afterwards.
     */
    /**
     * @param {ActionPose} pose
     * @param {number} [weight=1]  0 drops the arm to its rest position.
     *
     * WHY A WEIGHT: the hold is authored in BODY-LOCAL space — "arm out in front of the chest". That
     * reads correctly while upright, but a slide tips the whole body 90°, and "in front of the chest"
     * becomes "straight up into the air". The arm then juts vertically out of a horizontal character
     * with the gun still faithfully mounted on the hand — the floating-hand bug.
     *
     * Dropping the weight during a slide keeps the arm with the body. A proper fix layers a slide pose
     * instead of merely disabling this one; this is the honest minimum until then.
     */
    static applyWeaponHold(pose, weight) {
        const w = weight === undefined ? 1 : weight;
        if (w === 0) return;
        const sk = ActionFPSCharacterModel.skeleton();
        for (const bone in ActionFPSCharacterModel.WEAPON_HOLD) {
            const r = ActionFPSCharacterModel.WEAPON_HOLD[bone];
            pose.rotate(sk.boneIndex(bone), (r.pitch || 0) * w, (r.yaw || 0) * w, (r.roll || 0) * w);
        }
    }

    /**
     * Apply the aim articulation to ONE part's rest offset, in body-local space (before the body's
     * own yaw/scale/position). Returns { x, y, z, pitch } — the articulated offset plus the total
     * pitch that part ended up with, which a caller uses to orient the part itself.
     *
     * Pitch rotates about the body-local X axis (the lateral axis). SIGN: the engine's convention is
     * +pitch = looking UP (ActionFPSWeaponSystem.bodyWeaponPose builds its aim direction as
     * `fy = sin(pitch)`), so looking up must lean the chest BACK — the head travels backwards (-z) and
     * down, the way a body actually does. Chained: the neck's rotation is applied on top of the
     * spine's already-rotated offset, which is what makes it two-stage rather than two independent
     * rotations.
     *
     * THE SINGLE SOURCE both the visible mesh and the hit volumes use — call it from either and they
     * cannot disagree.
     */
    static articulate(part, lx, ly, lz, pitch, opts) {
        // No early-out on pitch 0: the pose stack also carries the static weapon hold, which applies at
        // every pitch including neutral.
        const bone = ActionFPSCharacterModel.PART_BONE[part] || part;
        const idx = ActionFPSCharacterModel.skeleton().boneIndex(bone);
        if (idx < 0) return { x: lx, y: ly, z: lz, pitch: 0 };
        const pose = ActionFPSCharacterModel.posedAt(pitch, opts);
        return {
            x: pose.worldX[idx],
            y: pose.worldY[idx],
            z: pose.worldZ[idx],
            pitch: pose.worldPitch[idx],
            // FULL rotation as a quaternion. `pitch` alone is only the whole story for the pitch-only
            // aim layer; a CLIP writes the quaternion channel and leaves `pitch` at zero, so anything
            // orienting geometry from `pitch` leaves limbs unrotated while their joints move — hands
            // detaching from forearms, knees separating. Read the quaternion.
            qx: pose.worldQX[idx],
            qy: pose.worldQY[idx],
            qz: pose.worldQZ[idx],
            qw: pose.worldQW[idx],
            // The bone SCALE, accumulated down the chain. A clip that squashes a limb moves the joints
            // closer together via this, but the geometry hanging off the bone only shrinks if whoever
            // draws it applies the scale too — otherwise a shortened thigh keeps a full-length capsule.
            sx: pose.worldScaleX[idx],
            sy: pose.worldScaleY[idx],
            sz: pose.worldScaleZ[idx]
        };
    }

    /** Override the character mesh builder (GLB / custom). `fn(color)` returns an ActionModel3D. */
    static setBuilder(fn) {
        ActionFPSCharacterModel._volumes = null; // a new mesh means new volumes
        ActionFPSCharacterModel._poseKey = null;
        ActionFPSCharacterModel._builder = fn;
        return ActionFPSCharacterModel;
    }

    /** Build a character model tinted with `color` (default procedural humanoid, or the override). */
    static build(color) {
        if (ActionFPSCharacterModel._builder) return ActionFPSCharacterModel._builder(color);
        return ActionFPSCharacterModel.buildDefault(color);
    }

    /**
     * The engine's default procedural humanoid. Every number below is in REFERENCE UNITS (see the
     * class docs): the figure stands 1.8 tall, feet at y=-0.9, crown at y=+0.9, and the collider it
     * fills is 0.6 wide. Edit a dimension here and that is exactly what changes in the world.
     *
     * DIMENSION CONVENTIONS for the local builders:
     *   box(w, h, d)       — bounding size
     *   sphere(r)          — radius
     *   capsule(r, cylH)   — radius + the CYLINDER SECTION height (total height = cylH + 2r)
     *   cylinder(r, h)     — radius + total height
     *
     * The `add(name, obj, x, y, z)` position is the part's CENTRE, in the same units.
     */
    static buildDefault(color) {
        // ExampleFighter colors every part differently (it's a rig-readability model). Here the body
        // takes the player's identity tint and the accents stay fixed, so players read as players.
        const BODY = color;
        const JOINT = ActionFPSCharacterModel._shade(color, 0.72); // ball joints, a touch darker
        const SKIN = "#f2cc99";
        const DARK = "#2a2a32";

        const model = new ActionModel3D();
        const V = (x, yy, z) => new Vector3(x, yy, z);

        // Cosmetic only: these shape classes generate their own visual geometry, and nothing here is
        // ever added to a physics world — the renderer just draws the triangles they carry, so the
        // shape object IS the body part.
        //
        // Each builder tags the object with the TRUE primitive it is. The hit volumes read that tag so
        // a capsule limb stays a capsule and a joint stays a sphere — boxing them would put the box's
        // corners outside the actual limb, which is exactly the slop CS:GO removed when it gave
        // mstudiobbox_t a flCapsuleRadius (see HITBOX_SKELETON_PLAN.md §6).
        const tag = (obj, shape) => {
            obj.hitShape = shape;
            return obj;
        };
        const box = (w, h, d, c) =>
            tag(new ActionPhysicsBox3D(w, h, d, 0, V(0, 0, 0), c),
                { kind: "box", hx: w / 2, hy: h / 2, hz: d / 2 });
        const sphere = (r, c) =>
            tag(new ActionPhysicsSphere3D(r, 0, V(0, 0, 0), c), { kind: "sphere", r });
        // `cylH` is the CYLINDER SECTION height, excluding the hemisphere caps — that's the natural way
        // to describe a limb, and it's what the hit volume wants (`half` = centre to each segment end,
        // the same thing CS:GO stores as bbmin/bbmax when flCapsuleRadius > 0). ActionPhysicsCapsule3D
        // and Goblin want the TOTAL height instead, and Goblin enforces total > 2*radius, so the caps
        // are added back here.
        const capsule = (r, cylH, c) =>
            tag(new ActionPhysicsCapsule3D(r, cylH + 2 * r, 0, V(0, 0, 0), c),
                { kind: "capsule", r, half: cylH / 2 });
        const cylinder = (r, h, c) =>
            tag(new ActionPhysicsCylinder3D(r, h, 0, V(0, 0, 0), c),
                { kind: "cylinder", r, half: h / 2 });

        /** Register a shape as a named body part at a rest position in body-local space. */
        const add = (name, obj, x, worldY, z = 0) => {
            obj.name = name;
            obj.isStatic = false; // moves every frame — opt out of static-mesh caching
            // ActionFPSBodyModel maps this through the body pose; a GLB mesh node carries the same
            // thing as its node transform.
            obj.localOffset = V(x, worldY, z);
            model.objects.push(obj);
        };

        /**
         * Merge a decorative primitive into an already-added part, at an offset within that part.
         * Cosmetic only — it becomes part of the host's triangles, so it does NOT become its own hit
         * volume (and doesn't disturb the host's, which comes from the tagged `hitShape`, not the
         * triangle extents).
         */
        const decorate = (host, obj, dx, dy, dz) => {
            for (const t of obj.triangles) {
                const v = t.vertices;
                host.triangles.push(
                    new Triangle(
                        V(v[0].x + dx, v[0].y + dy, v[0].z + dz),
                        V(v[1].x + dx, v[1].y + dy, v[1].z + dz),
                        V(v[2].x + dx, v[2].y + dy, v[2].z + dz),
                        t.color
                    )
                );
            }
        };

        // ---- Spine ------------------------------------------------------------------------------
        add("pelvis", box(0.306, 0.153, 0.204, BODY), 0, -0.045);
        add("torso", box(0.306, 0.255, 0.204, BODY), 0, 0.160);
        add("chest", box(0.357, 0.255, 0.230, BODY), 0, 0.415);
        add("neck", cylinder(0.077, 0.128, SKIN), 0, 0.543);

        // Head, with eyes on the +Z face. Forward is +Z in this engine (a look direction is
        // `(sin(yaw)*cp, sin(pitch), cos(yaw)*cp)`, so yaw 0 faces +Z) — the eyes make that visible,
        // which matters because a bare sphere is front/back symmetric and hides facing bugs.
        const head = sphere(0.179, SKIN);
        add("head", head, 0, 0.721);
        for (const side of [-1, 1]) {
            decorate(head, box(0.056, 0.056, 0.031, DARK), 0.066 * side, 0.031, 0.158);
        }

        // ---- Arms -------------------------------------------------------------------------------
        for (const side of [-1, 1]) {
            // Character faces +Z with +Y up, so their own RIGHT side is -X (right = forward x up).
            const S = side < 0 ? "right" : "left";
            add(S + "Shoulder", sphere(0.102, JOINT), 0.204 * side, 0.415);
            add(S + "UpperArm", capsule(0.089, 0.128, BODY), 0.281 * side, 0.364);
            add(S + "Elbow", sphere(0.077, JOINT), 0.281 * side, 0.236);
            add(S + "Forearm", capsule(0.077, 0.128, BODY), 0.281 * side, 0.109);
            add(S + "Hand", sphere(0.089, SKIN), 0.281 * side, -0.096);
        }

        // ---- Legs -------------------------------------------------------------------------------
        for (const side of [-1, 1]) {
            // Character faces +Z with +Y up, so their own RIGHT side is -X (right = forward x up).
            const S = side < 0 ? "right" : "left";
            const x = 0.128 * side;
            add(S + "Hip", sphere(0.102, JOINT), x, -0.096);
            add(S + "UpperLeg", capsule(0.115, 0.204, BODY), x, -0.300);
            add(S + "Knee", sphere(0.102, JOINT), x, -0.504);
            add(S + "LowerLeg", capsule(0.102, 0.153, BODY), x, -0.683);
            add(S + "Foot", box(0.128, 0.077, 0.204, DARK), x, -0.862, 0.038);
        }

        return model;
    }

    /** Multiply a #rrggbb toward black by `k` (0..1). Keeps joint tint related to the team color. */
    static _shade(hex, k) {
        const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
        if (!m) return hex;
        const n = parseInt(m[1], 16);
        const c = (shift) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 0xff) * k)));
        const to = (x) => x.toString(16).padStart(2, "0");
        return `#${to(c(16))}${to(c(8))}${to(c(0))}`;
    }
}
