// actionfpsbodymodel.js — the per-character BODY component (engine mechanism). The third-person
// visual of a character: the swappable humanoid mesh (ActionFPSCharacterModel) plus the equipped
// weapon posed in its hand, driven entirely from a controller getState() snapshot. One rides on a
// controller when `model` is enabled; remotes/AI use the same class fed by their snapshot, so YOUR
// body and the bodies you see others wearing are one code path.
//
// Mesh is GLB-swappable via ActionFPSCharacterModel.setBuilder. Weapon geometry comes from the shared
// ActionFPSWeaponSystem (same mesh the first-person viewmodel uses). Pure view: nothing here is read
// by the simulation. Sliding tips the whole rig 90° (visual only) about the player's lateral axis.

class ActionFPSBodyModel {
    static SLIDE_TILT = -Math.PI / 2; // visual-only horizontal tip while sliding

    /**
     * A clip from the loaded character, by name — or null when the character has none.
     *
     * Everything that uses a clip must degrade gracefully without it: the procedural fallback character
     * carries no animations at all, and an artist's .glb may not have the one being asked for. Callers
     * check the result and keep their old behaviour when it is null (see the crouch squash in
     * `setState`), so a missing clip is a smaller character, never a broken one.
     *
     * Sampler instances are cached per clip: building one resolves every channel's target node to a
     * bone index, which is per-model work, not per-frame work.
     */
    static clip(name) {
        const cache = ActionFPSBodyModel._clips || (ActionFPSBodyModel._clips = {});
        if (name in cache) return cache[name];
        const rig = typeof ActionFPSCharacterModel !== "undefined" && ActionFPSCharacterModel.loadedRig;
        const raw = rig && rig.animations && rig.animations.find((a) => a.name === name);
        if (!raw || typeof ActionClipSampler === "undefined") return (cache[name] = null);
        return (cache[name] = new ActionClipSampler(raw, rig.gltf, ActionFPSCharacterModel.skeleton(), rig.read));
    }

    /**
     * @param {string} color   identity tint (team/FFA) for the body mesh
     * @param {number} [slots] weapon slots to pre-build poses for (default 2: gun + launcher)
     */
    constructor(color, slots = 2) {
        this.model = ActionFPSCharacterModel.build(color); // ActionModel3D (GLB-swappable)
        // EVERY mesh node in the model is a body part we pose (head, torso, limbs...). A procedural
        // build emits one object per part; a GLB emits one per mesh node — same shape either way, so
        // this loop is what makes the two interchangeable. Each part keeps its authored offset from the
        // body origin in `_local`, and setState() maps that offset through the body's transform.
        this.parts = this.model.objects.map((o) => {
            o.isStatic = false; // moves every frame — opt out of static-mesh caching
            // A procedural part carries `localOffset`; a GLB mesh node carries the same thing as its
            // node transform. Either way it's the part's rest position in body-local space.
            const l = o.localOffset || o.transform.position || new Vector3(0, 0, 0);
            // `name` drives the aim articulation lookup (ActionFPSCharacterModel.AIM_PIVOTS).
            return { obj: o, name: o.name, tris: o.triangles, local: new Vector3(l.x, l.y, l.z) };
        });
        // One node doubles as the body's representative object (bounding/visual queries that want "the
        // body" rather than a specific limb). Chosen BY NAME from the character definition rather than
        // by build order — `objects[0]` happened to be the pelvis, which is true until someone reorders
        // the build or a GLB arrives with its parts in a different sequence.
        const rootName = typeof ActionFPSCharacterModel !== "undefined" && ActionFPSCharacterModel.ROOT_PART;
        this.object = (rootName && this.model.objects.find((o) => o.name === rootName)) || this.model.objects[0];
        this._tris = this.object.triangles; // stash for hide/show on death
        // One weapon mesh per slot, built once; the active slot is posed each frame, others parked.
        this._weaponModel = new ActionModel3D();
        this._weapons = [];
        for (let slot = 0; slot < slots; slot++) {
            const g = ActionFPSWeaponSystem.buildWeaponMesh(slot);
            const o = this._weaponModel.addObject("bodyWeapon" + slot, g.tris, 0, new Vector3(0, 0, 0), new Quaternion(0, 0, 0, 1), new Vector3(1, 1, 1));
            o.isStatic = false;
            o._tris = g.tris;
            this._weapons.push(o);
        }
        this._activeWeapon = this._weapons[0];
    }

    /** Pose the body + held weapon from a controller getState() snapshot. */
    setState(s) {
        const yaw = s.yaw || 0;
        const yawQ = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), yaw);
        const slideTilt = s.sliding
            ? Quaternion.fromAxisAngle(new Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), ActionFPSBodyModel.SLIDE_TILT)
            : null;
        const rot = slideTilt ? Quaternion.multiply(slideTilt, yawQ) : yawQ;
        // Reflect collider size (scale + crouch); mesh is authored at 0.6×1.8×0.6.
        const sx = s.w / 0.6;
        // CROUCHING is derived from the collider rather than sent: `h` shrinks to `crouchRatio` of
        // standing, so a short collider IS a crouch. Works for remotes with no new networked state.
        // A slide is a crouch too by that test, hence the explicit exclusion.
        const crouching = !s.sliding && s.h < 1.8 * sx * 0.99;
        const crouchClip = crouching && ActionFPSBodyModel.clip("crouch");
        // NO VERTICAL SQUASH when a POSE is doing the work, in either state:
        //  - sliding: the rig is tipped 90°, so the collider's "height" now measures the character's
        //    DEPTH (chest to back). Squashing on top flattens an already-horizontal body into a pancake.
        //  - crouching WITH a crouch clip: the clip bends the knees and drops the hips, which is what
        //    makes the character shorter. Squashing as well would double the effect.
        // Crouching WITHOUT a clip keeps the old squash, so a character with no authored crouch still
        // visibly ducks.
        const sy = s.sliding || crouchClip ? sx : s.h / 1.8;
        const scale = new Vector3(sx, sy, sx);
        const pos = new Vector3(s.x, s.y, s.z);
        // Pose every part: its rest offset is in body-local space, so scale it, rotate it by the body's
        // facing, and hang it off the body position. Rotation/scale are shared, so the figure stays
        // rigid — which is correct until the skeleton lands, at which point this is the loop that
        // starts feeding each part its own bone matrix instead of the shared body pose.
        // Aim articulation: the upper body follows look pitch (two-stage, spine then neck) BEFORE the
        // body's own yaw/scale/position are applied. Same table the hit volumes use
        // (ActionFPSCharacterModel.articulate), so what you see is what you shoot.
        const pitch = s.pitch || 0;
        // Hold weight 0 whenever a CLIP is driving the pose, not just while sliding.
        //
        // An authored clip already contains whatever arm pose the artist put in it — the crouch action
        // was made starting from the weapon hold, so the shoulder rotation is baked in. Adding the code
        // hold on top applies it twice and flings the arm out.
        //
        // The real answer is per-bone layer masks (§12.2): a clip owns the bones it keys, layers own the
        // rest. Until that exists, a clip wins outright.
        const hold = s.sliding || crouchClip ? 0 : 1;
        // ONE pose description, shared by the body parts AND the weapon mount below, so the gun cannot
        // end up on a hand that was posed differently.
        const poseOpts = { hold, clip: crouchClip || null, time: 0 };
        for (const p of this.parts) {
            p.obj.triangles = s.dead ? [] : p.tris; // dead players vanish until respawn
            const l = p.local;
            // Hold weight 0 while sliding: the hold is authored body-local ("arm out in front"), and a
            // slide tips the body 90°, which turns that into "arm straight up". See applyWeaponHold.
            const a = ActionFPSCharacterModel.articulate(p.name, l.x, l.y, l.z, pitch, poseOpts);
            const off = rot.transformVector(new Vector3(a.x * sx, a.y * sy, a.z * sx));
            p.obj.transform.position = new Vector3(pos.x + off.x, pos.y + off.y, pos.z + off.z);
            // Parts that pitched also TURN by the pitch they accumulated, so a limb tips with the body
            // instead of sliding while staying upright. Negated to match the rotation `articulate`
            // applied to the offset (+pitch = looking up = leaning back), same convention the weapon
            // pose uses (`Quaternion.fromEuler(0, -pitch, yaw)`).
            // ORIENT FROM THE BONE'S FULL ROTATION, not just its pitch.
            //
            // This used to build the rotation from `a.pitch` alone, which was complete while the only
            // thing rotating bones was the pitch-only aim layer. A CLIP writes the quaternion channel
            // and leaves `pitch` at zero — so the bones moved and the geometry hanging off them did not
            // rotate at all: hands detached from forearms, knees separated, limbs stayed axis-aligned
            // inside a folded pose.
            //
            // The pose's quaternion is in BODY-LOCAL space, so the body's own rot is applied on top.
            p.obj.transform.rotation = Quaternion.multiply(
                rot, new Quaternion(a.qx, a.qy, a.qz, a.qw));
            // Body scale (collider) TIMES the bone's own scale from the clip. Without the second term
            // a squashed limb moves its joints closer together while the geometry between them stays
            // full length — the leg looks the right shape at the ends and too long in the middle.
            p.obj.transform.scale = (a.sx !== undefined && (a.sx !== 1 || a.sy !== 1 || a.sz !== 1))
                ? new Vector3(sx * a.sx, sy * a.sy, sx * a.sz)
                : scale;
        }
        // Pose the equipped weapon (hidden while dead). Slot rides the snapshot's userData (so it's
        // networked + reconciled with the rest of the body) — same source for local, remote, and host.
        const slot = (((s.userData && s.userData.weapon) | 0)) % this._weapons.length;
        for (const w of this._weapons) w.triangles = [];
        this._activeWeapon = this._weapons[slot] || this._weapons[0];
        if (!s.dead) {
            // `sy` as well as `sx`: crouching squashes the collider vertically, so the hand the parts
            // above were posed with sits lower. Passing only `sx` left the gun floating ~13cm above it.
            const pose = ActionFPSWeaponSystem.bodyWeaponPose(s.x, s.y, s.z, yaw, s.pitch || 0, sx, slot, sy, poseOpts);
            this._activeWeapon.triangles = this._activeWeapon._tris;
            if (slideTilt) {
                // Position follows the tilted body; rotation keeps the aim direction so the gun points
                // where the player looks rather than inheriting the body's tilt.
                const m = pose.mount;
                const off = new Vector3(m.x - s.x, m.y - s.y, m.z - s.z);
                const rot = slideTilt.transformVector(off);
                this._activeWeapon.transform.position = new Vector3(s.x + rot.x, s.y + rot.y, s.z + rot.z);
                this._activeWeapon.transform.rotation = pose.rotation;
            } else {
                this._activeWeapon.transform.position = pose.mount;
                this._activeWeapon.transform.rotation = pose.rotation;
            }
            this._activeWeapon.transform.scale = new Vector3(pose.scale, pose.scale, pose.scale);
        }
    }

    /** Every body part + the posed weapon (all move every frame). Callers render all returned objects. */
    getRenderObjects() {
        const out = [];
        for (const p of this.parts) out.push(p.obj);
        out.push(this._activeWeapon);
        return out;
    }
}
