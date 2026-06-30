// actionengine/character/actionfpscharactermodel.js
/**
 * ActionFPSCharacterModel - the engine's DEFAULT, swappable first-person-game character mesh.
 *
 * A simple humanoid built as an ActionModel3D (the engine's model abstraction, same one the weapon
 * viewmodels use). Authored in the 6×18×6 reference collider (origin = body center; feet at y=-9,
 * head top near y=+9) so a game can scale it to any live collider size. `color` is the per-player
 * identity tint (team/FFA) — supplied by the game; the MESH is engine mechanism.
 *
 * GLB-swappable: a game drops in a real player model via setBuilder(fn) (fn(color) -> ActionModel3D),
 * later with skin/animations. Batteries included (this default), batteries removable (override it).
 */
class ActionFPSCharacterModel {
    static _builder = null; // game override; default procedural build used when null

    /** Override the character mesh builder (GLB / custom). `fn(color)` returns an ActionModel3D. */
    static setBuilder(fn) {
        ActionFPSCharacterModel._builder = fn;
        return ActionFPSCharacterModel;
    }

    /** Build a character model tinted with `color` (default procedural humanoid, or the override). */
    static build(color) {
        if (ActionFPSCharacterModel._builder) return ActionFPSCharacterModel._builder(color);
        return ActionFPSCharacterModel.buildDefault(color);
    }

    /** The engine's default procedural humanoid (one merged mesh node; no rig yet). */
    static buildDefault(color) {
        const tris = [];
        const LEG = "#1c1c22";
        // Authored to fill the full reference height: feet at y=-9, head top at y=+9 (total 18).
        ActionBoxGeometry.pushTris(tris, -1.2, -5.0, 0, 1.8, 8.0, 2.2, LEG); // left leg  (-9 .. -1)
        ActionBoxGeometry.pushTris(tris, 1.2, -5.0, 0, 1.8, 8.0, 2.2, LEG); // right leg
        ActionBoxGeometry.pushTris(tris, 0, 2.0, 0, 4.0, 6.0, 2.6, color); // torso     (-1 .. 5)
        ActionBoxGeometry.pushTris(tris, -2.5, 2.0, 0, 1.0, 5.6, 1.9, color); // left arm
        ActionBoxGeometry.pushTris(tris, 2.5, 2.0, 0, 1.0, 5.6, 1.9, color); // right arm
        ActionBoxGeometry.pushTris(tris, 0, 7.0, 0, 3.0, 4.0, 3.0, color); // head      (5 .. 9)
        // Black face plate, high on the head front (+z), back flush with the head front (z = 1.5).
        ActionBoxGeometry.pushTris(tris, 0, 7.4, 1.9, 2.0, 1.4, 0.8, "#000000");

        const model = new ActionModel3D();
        model.addObject("avatar", tris, 0, new Vector3(0, 0, 0), new Quaternion(0, 0, 0, 1), new Vector3(1, 1, 1));
        return model;
    }
}
