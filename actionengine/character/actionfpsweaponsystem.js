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
     * Default weapon mount rig (reference 6×18×6 collider; origin = body center). The SINGLE source
     * — a game mutates it via configureRig(); there is no separate copy. `hand` flips the side.
     */
    static RIG = {
        hand: "right", // "right" | "left"
        handX: 3.6, // lateral offset from center (ref units) — bigger = further outside the body
        handY: 1.0, // vertical offset from center (ref units)
        handZ: 1.2, // forward offset from center (ref units)
        weaponScale: 1.4 // weapon geometry scale relative to avatar scale
    };

    /** Animation/FX hook vocabulary the game emits as events occur (subscribe with on(sig, fn)). */
    static SIGNALS = ["equip", "draw", "holster", "fire", "reload", "empty", "impact", "explode"];

    static _models = {}; // slot -> builder override (GLB / custom); default builder used otherwise
    static _muzzleZ = {}; // slot -> cached barrel-tip z (the single muzzle source)
    static _listeners = {}; // signal -> [fn]

    /** Merge rig overrides into the single shared rig. */
    static configureRig(overrides) {
        Object.assign(ActionFPSWeaponSystem.RIG, overrides);
        return ActionFPSWeaponSystem;
    }

    /**
     * Override the model for a slot (GLB swap or custom geometry). `builder` returns
     * { tris, muzzleZ } in the +z-forward reference frame, same shape as the defaults.
     */
    static setWeaponModel(slot, builder) {
        ActionFPSWeaponSystem._models[slot] = builder;
        delete ActionFPSWeaponSystem._muzzleZ[slot]; // re-derive muzzle from the new model
        return ActionFPSWeaponSystem;
    }

    /** Build the mesh for a slot (default or overridden). Caches the model's muzzleZ. */
    static buildWeaponMesh(slot) {
        const builder = ActionFPSWeaponSystem._models[slot] || (() => ActionFPSWeaponSystem.buildDefaultWeaponMesh(slot));
        const g = builder(slot);
        ActionFPSWeaponSystem._muzzleZ[slot] = g.muzzleZ;
        return g;
    }

    /** Barrel-tip z for a slot WITHOUT rebuilding the mesh every call (the single muzzle source). */
    static muzzleZ(slot) {
        if (ActionFPSWeaponSystem._muzzleZ[slot] === undefined) ActionFPSWeaponSystem.buildWeaponMesh(slot);
        return ActionFPSWeaponSystem._muzzleZ[slot];
    }

    /** The engine's two default procedural weapons. Triangles + barrel-tip z, authored at +z forward. */
    static buildDefaultWeaponMesh(slot) {
        const tris = [];
        const box = (w, h, d, cx, cy, cz, color) => ActionBoxGeometry.pushTris(tris, cx, cy, cz, w, h, d, color);
        if (slot === 1) {
            box(1.0, 1.0, 3.4, 0, 0, 1.2, "#3a4a32"); // fat tube
            box(1.2, 1.2, 0.5, 0, 0, 2.9, "#26321f"); // muzzle ring
            box(1.2, 1.2, 0.5, 0, 0, -0.3, "#26321f"); // breech ring
            box(0.5, 1.0, 0.6, 0, -0.85, 0.4, "#2c3826"); // grip
            box(0.7, 0.3, 1.2, 0, 0.62, 0.8, "#4a5a40"); // sight rail
            return { tris, muzzleZ: 3.4 };
        }
        box(0.6, 0.6, 2.6, 0, 0, 1.0, "#2b2b2f");
        box(0.4, 0.4, 2.2, 0, 0.12, 2.0, "#1a1a1d");
        box(0.5, 1.1, 0.6, 0, -0.7, 0.2, "#3a3a40");
        box(0.55, 0.35, 0.9, 0, -0.45, 1.0, "#26262a");
        return { tris, muzzleZ: 3.1 };
    }

    /**
     * Canonical body-weapon pose for a player at (cx,cy,cz = body CENTER) facing yaw/pitch, at avatar
     * `scale`, holding `slot`. Returns the mount transform (render the gun on the body) AND the
     * world-space muzzle (tracers/rockets). Used by the local TP body, every remote avatar, and the
     * host's authoritative FX — so what others see always originates at the body, never at a camera.
     */
    static bodyWeaponPose(cx, cy, cz, yaw, pitch, scale, slot) {
        const rig = ActionFPSWeaponSystem.RIG;
        const wscale = rig.weaponScale * scale;
        // Horizontal right + 3D aim forward (matches the controller's lookDir convention). `side`
        // puts the gun on the player's right (-x at yaw 0, screen-right from behind) or left.
        const side = rig.hand === "left" ? 1 : -1;
        const lat = side * rig.handX;
        const rx = Math.cos(yaw),
            rz = -Math.sin(yaw);
        const cp = Math.cos(pitch);
        const fx = Math.sin(yaw) * cp,
            fy = Math.sin(pitch),
            fz = Math.cos(yaw) * cp;
        const mountX = cx + (rx * lat + fx * rig.handZ) * scale;
        const mountY = cy + rig.handY * scale + fy * rig.handZ * scale;
        const mountZ = cz + (rz * lat + fz * rig.handZ) * scale;
        const reach = ActionFPSWeaponSystem.muzzleZ(slot) * wscale; // barrel tip → muzzle (single source)
        return {
            mount: new Vector3(mountX, mountY, mountZ),
            rotation: Quaternion.fromEuler(0, -pitch, yaw),
            scale: wscale,
            muzzle: new Vector3(mountX + fx * reach, mountY + fy * reach, mountZ + fz * reach)
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
