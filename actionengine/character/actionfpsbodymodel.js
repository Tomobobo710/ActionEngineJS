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
     * @param {string} color   identity tint (team/FFA) for the body mesh
     * @param {number} [slots] weapon slots to pre-build poses for (default 2: gun + launcher)
     */
    constructor(color, slots = 2) {
        this.model = ActionFPSCharacterModel.build(color); // ActionModel3D (GLB-swappable)
        this.object = this.model.objects[0]; // the mesh node positioned + rendered each frame
        this.object.name = "fpsBody";
        this.object.isStatic = false; // moves every frame — opt out of static-mesh caching
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
        this.object.triangles = s.dead ? [] : this._tris; // dead players vanish until respawn
        const yaw = s.yaw || 0;
        const yawQ = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), yaw);
        const slideTilt = s.sliding
            ? Quaternion.fromAxisAngle(new Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), ActionFPSBodyModel.SLIDE_TILT)
            : null;
        this.object.transform.position = new Vector3(s.x, s.y, s.z);
        this.object.transform.rotation = slideTilt ? Quaternion.multiply(slideTilt, yawQ) : yawQ;
        // Reflect collider size (scale + crouch); mesh is authored at 6×18×6.
        const sx = (s.w || 6) / 6;
        const sy = (s.h || 18) / 18;
        this.object.transform.scale = new Vector3(sx, sy, sx);
        // Pose the equipped weapon (hidden while dead). Slot rides the snapshot's userData (so it's
        // networked + reconciled with the rest of the body) — same source for local, remote, and host.
        const slot = (((s.userData && s.userData.weapon) | 0)) % this._weapons.length;
        for (const w of this._weapons) w.triangles = [];
        this._activeWeapon = this._weapons[slot] || this._weapons[0];
        if (!s.dead) {
            const pose = ActionFPSWeaponSystem.bodyWeaponPose(s.x, s.y, s.z, yaw, s.pitch || 0, sx, slot);
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

    /** Body mesh + posed weapon (both move every frame). Callers render all returned objects. */
    getRenderObjects() {
        return [this.object, this._activeWeapon];
    }
}
