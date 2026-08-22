// actionengine/character/actionfpsweaponsystem.js
/**
 * ActionFPSWeaponSystem - engine-side weapon PRESENTATION mechanism, sibling to the controller.
 *
 * This is the reusable, game-agnostic core: the default weapon models (GLB-swappable), the mount
 * RIG + body-gun pose, single-source muzzle resolution, and the animation/FX SIGNAL vocabulary.
 * It owns no policy — weapon damage numbers, the roster, fire-rate, and the FX/fire orchestration
 * that needs a world live in the game (for now; they fold in once the play-context seam exists).
 *
 * SINGLE SOURCE OF TRUTH: the barrel-tip z ("muzzleZ") comes from the weapon MODEL, so the
 * first-person viewmodel, the third-person/remote body gun, and the host's authoritative muzzle
 * all agree by construction — no more duplicated 3.1/3.4 constants, no game/engine rig mirror.
 *
 * BATTERIES INCLUDED, REMOVABLE: ships two default procedural weapons (0 = gun, 1 = launcher) and a
 * default rig. A game overrides a model (setWeaponModel — drop in a GLB) or the rig (configureRig)
 * without touching this file.
 *
 * SIGNALS: a fixed event vocabulary the game/animation layer subscribes to (on/emit), so logic and
 * presentation stay decoupled and a swapped-in GLB's clips can bind to the same names.
 */
class ActionFPSWeaponSystem {
    /**
     * Weapon mount rig. The SINGLE source — a game mutates it via configureRig(); there is no separate
     * copy.
     *
     * The mount POSITION comes from the character's hand bone (see bodyWeaponPose), so the weapon
     * follows whatever pose the character is in. The two offsets below are the ADJUSTMENT on top of
     * that — the knobs for "the grip doesn't sit quite right in the hand" or "the held gun is too low
     * on screen" — and both are zero by default, so nothing is silently nudged.
     *
     * Offsets are in weapon-local space: +x right, +y up, +z along the barrel.
     */
    static RIG = {
        hand: "right", // "right" | "left" — humanoid shorthand for the mount bone
        handBone: null, // name the mount bone outright; overrides `hand`. Non-humanoids set this.
        weaponScale: 1.4, // weapon geometry scale relative to avatar scale
        // Third-person / world weapon: offset from the hand bone.
        handOffset: { x: 0, y: 0, z: 0 },
        // First-person viewmodel: offset from its camera-relative rest position.
        viewOffset: { x: 0, y: 0, z: 0 }
    };

    /** Animation/FX hook vocabulary the game emits as events occur (subscribe with on(sig, fn)). */
    static SIGNALS = ["equip", "draw", "holster", "fire", "reload", "empty", "impact", "explode"];

    static _models = {}; // slot -> builder override (GLB / custom); default builder used otherwise
    static _muzzle = {}; // slot -> cached barrel-tip offset {x,y,z} (the single muzzle source)
    static _listeners = {}; // signal -> [fn]

    /** Merge rig overrides into the single shared rig. */
    static configureRig(overrides) {
        Object.assign(ActionFPSWeaponSystem.RIG, overrides);
        return ActionFPSWeaponSystem;
    }

    /**
     * Override the model for a slot (GLB swap or custom geometry). `builder` returns
     * { tris, muzzle:{x,y,z} } in the +z-forward reference frame, same shape as the defaults.
     */
    static setWeaponModel(slot, builder) {
        ActionFPSWeaponSystem._models[slot] = builder;
        delete ActionFPSWeaponSystem._muzzle[slot]; // re-derive muzzle from the new model
        return ActionFPSWeaponSystem;
    }

    /** Build the mesh for a slot (default or overridden). Caches the model's muzzle offset. */
    static buildWeaponMesh(slot) {
        const builder = ActionFPSWeaponSystem._models[slot] || (() => ActionFPSWeaponSystem.buildDefaultWeaponMesh(slot));
        const g = builder(slot);
        ActionFPSWeaponSystem._muzzle[slot] = g.muzzle;
        return g;
    }

    /**
     * Barrel-tip offset for a slot, in weapon-local space, WITHOUT rebuilding the mesh every call —
     * the single muzzle source.
     *
     * A full {x,y,z}, not just a z-distance: the weapon's origin is its GRIP, so the barrel tip sits
     * both forward AND above it. Assuming y=0 would fire from the bottom of the grip.
     */
    static muzzleOffset(slot) {
        if (ActionFPSWeaponSystem._muzzle[slot] === undefined) ActionFPSWeaponSystem.buildWeaponMesh(slot);
        return ActionFPSWeaponSystem._muzzle[slot];
    }

    /**
     * The engine's two default procedural weapons: triangles + the barrel-tip offset.
     *
     * ORIGIN CONVENTION: a weapon's origin is its GRIP — the point the hand closes around, at
     * (0, 0, 0), with the barrel running out along +z (and +y up). That's what lets `bodyWeaponPose`
     * mount a weapon by simply placing its origin at the hand bone, with no per-weapon offset to
     * maintain, and it's how an artist would author a weapon for an attachment point anyway. A GLB
     * dropped in later should follow the same rule.
     *
     * `muzzle` is a full {x,y,z} in that same space, NOT just a z-distance: the barrel tip sits both
     * forward of the grip AND above it, so a bare z would fire from the bottom of the grip.
     *
     * Everything is in reference units — the character these are held by stands 1.8 tall.
     */
    static buildDefaultWeaponMesh(slot) {
        const tris = [];
        const box = (w, h, d, cx, cy, cz, color) => ActionBoxGeometry.pushTris(tris, cx, cy, cz, w, h, d, color);
        // The GRIP is centred on the origin (the hand closes around it) and everything else sits ON TOP
        // of it — the body/barrel start at the grip's top edge rather than sinking into it.
        if (slot === 1) {
            box(0.10, 0.10, 0.34, 0, 0.110, 0.08, "#3a4a32"); // fat tube
            box(0.12, 0.12, 0.05, 0, 0.110, 0.25, "#26321f"); // muzzle ring
            box(0.12, 0.12, 0.05, 0, 0.110, -0.07, "#26321f"); // breech ring
            box(0.05, 0.10, 0.06, 0, 0, 0, "#2c3826"); // grip — centred on the origin
            box(0.07, 0.03, 0.12, 0, 0.172, 0.04, "#4a5a40"); // sight rail
            // Barrel tip, in the same weapon-local space: up at the tube's height, not down at the grip.
            return { tris, muzzle: { x: 0, y: 0.110, z: 0.30 } };
        }
        box(0.06, 0.06, 0.17, 0, 0.118, 0.02, "#2b2b2f"); // body/breech
        box(0.04, 0.04, 0.14, 0, 0.130, 0.15, "#1a1a1d"); // barrel
        box(0.05, 0.11, 0.06, 0, 0, 0, "#3a3a40"); // grip — centred on the origin
        box(0.055, 0.035, 0.09, 0, 0.073, 0.01, "#26262a"); // trigger guard
        return { tris, muzzle: { x: 0, y: 0.130, z: 0.22 } };
    }

    /**
     * The hand bone's position in BODY-LOCAL space at a given look pitch.
     *
     * Routed through ActionFPSCharacterModel.articulate — the same call the visible mesh and the hit
     * volumes use — so the gun, the hand you see, and the boxes you shoot can't disagree. Throws on an
     * unknown bone rather than falling back to a guessed offset: a weapon silently mounting somewhere
     * other than the hand is exactly the kind of failure that hides until it's confusing.
     */
    /**
     * Which BONE the weapon mounts on.
     *
     * `RIG.handBone` names it outright — set that and this file needs to know nothing about body plans.
     * `RIG.hand` ("right"/"left") is the humanoid shorthand, kept because it reads better for the
     * common case and it is what games already configure.
     */
    static handBone() {
        const rig = ActionFPSWeaponSystem.RIG;
        if (rig.handBone) return rig.handBone;
        return rig.hand === "left" ? "leftHand" : "rightHand";
    }

    static _handLocal(boneName, pitch, poseOpts) {
        const rest = ActionFPSCharacterModel.restOffset(boneName);
        if (!rest) throw new Error("ActionFPSWeaponSystem: no bone '" + boneName + "' to mount the weapon on");
        //  must match whatever the BODY used, or the gun mounts on a hand that is somewhere else.
        return ActionFPSCharacterModel.articulate(boneName, rest.x, rest.y, rest.z, pitch, poseOpts);
    }

    /**
     * Canonical body-weapon pose for a player at (cx,cy,cz = body CENTER) facing yaw/pitch, at avatar
     * `scale`, holding `slot`. Returns the mount transform (render the gun on the body) AND the
     * world-space muzzle (tracers/rockets). Used by the local TP body, every remote avatar, and the
     * host's authoritative FX — so what others see always originates at the body, never at a camera.
     */
    static bodyWeaponPose(cx, cy, cz, yaw, pitch, scale, slot, scaleY, poseOpts) {
        const rig = ActionFPSWeaponSystem.RIG;
        const wscale = rig.weaponScale * scale;
        // VERTICAL scale is separate, because crouching changes the collider's HEIGHT and not its
        // width. The body squashes each part by `s.h / 1.8` while the weapon was scaling everything by
        // `s.w / 0.6` — so a crouched player's gun floated 13cm above their hand, and since the muzzle
        // derives from the mount, the SERVER's authoritative firing point was 13cm too high too.
        // Defaults to `scale` so an omitted argument behaves exactly as before.
        const vscale = scaleY === undefined ? scale : scaleY;
        // 3D aim forward, matching the controller's lookDir convention.
        const cp = Math.cos(pitch);
        const fx = Math.sin(yaw) * cp,
            fy = Math.sin(pitch),
            fz = Math.cos(yaw) * cp;

        // WHERE THE GUN SITS: the character's hand.
        //
        // The hand is a real bone whose body-local position is a pure function of `pitch` (the weapon
        // hold + aim layers — see ActionFPSCharacterModel.articulate). Pitch is already in the snapshot
        // and already rewound, so the host and every client derive the SAME mount with no new networked
        // state — which matters because this function also feeds the authoritative muzzle used for hit
        // resolution (fpscombat) and FX, not just the visible gun.
        // The mount BONE comes from the rig config, not from a literal here: `hand: "right"` is a
        // convenience that maps onto the humanoid's bone names, but a character whose weapon hangs off
        // something else entirely sets `handBone` directly and this file stays generic.
        const local = ActionFPSWeaponSystem._handLocal(ActionFPSWeaponSystem.handBone(), pitch, poseOpts);
        // Body-local -> world: rotate the offset by the body's yaw, then hang it off the body centre.
        const cy_ = Math.cos(yaw), sy_ = Math.sin(yaw);
        let mountX = cx + (local.x * cy_ + local.z * sy_) * scale;
        let mountY = cy + local.y * vscale; // vertical scale: tracks a crouched body's hand
        let mountZ = cz + (-local.x * sy_ + local.z * cy_) * scale;

        // WEAPON-LOCAL AXES (+x right, +y up, +z along the barrel), so anything expressed in weapon
        // space stays put relative to the gun as the character turns and aims.
        const rx = Math.cos(yaw), rz = -Math.sin(yaw); // right (horizontal, perpendicular to aim)
        // up = forward x right — taken as a real cross product so the basis is orthonormal. Writing it
        // out by hand is easy to get subtly wrong, and a non-unit `up` makes the weapon stretch as it
        // pitches (the muzzle drifts off the barrel).
        const ux = fy * rz, uy = fz * rx - fx * rz, uz = -fy * rx;
        const toWorld = (o, s) => ({
            x: (rx * o.x + ux * o.y + fx * o.z) * s,
            y: (uy * o.y + fy * o.z) * s,
            z: (rz * o.x + uz * o.y + fz * o.z) * s
        });

        // Tuning offset for the mount. Zero by default — moves the whole weapon, muzzle included,
        // since the muzzle is derived from the mount below.
        const ho = rig.handOffset;
        if (ho && (ho.x || ho.y || ho.z)) {
            const d = toWorld(ho, scale);
            mountX += d.x;
            mountY += d.y;
            mountZ += d.z;
        }

        // Barrel tip: a full weapon-local offset from the grip (forward AND up), scaled by the weapon's
        // own scale. The single muzzle source — tracers, rockets and the host's hit resolution all
        // start here, so it has to sit on the drawn barrel rather than at the grip.
        const m = toWorld(ActionFPSWeaponSystem.muzzleOffset(slot), wscale);
        return {
            mount: new Vector3(mountX, mountY, mountZ),
            rotation: Quaternion.fromEuler(0, -pitch, yaw),
            scale: wscale,
            muzzle: new Vector3(mountX + m.x, mountY + m.y, mountZ + m.z)
        };
    }

    // ---- Signals (animation/FX hooks) --------------------------------------
    static on(signal, fn) {
        (ActionFPSWeaponSystem._listeners[signal] || (ActionFPSWeaponSystem._listeners[signal] = [])).push(fn);
        return ActionFPSWeaponSystem;
    }
    static off(signal, fn) {
        const ls = ActionFPSWeaponSystem._listeners[signal];
        if (ls) {
            const i = ls.indexOf(fn);
            if (i !== -1) ls.splice(i, 1);
        }
        return ActionFPSWeaponSystem;
    }
    static emit(signal, data) {
        const ls = ActionFPSWeaponSystem._listeners[signal];
        if (ls) for (let i = 0; i < ls.length; i++) ls[i](data);
    }
}
