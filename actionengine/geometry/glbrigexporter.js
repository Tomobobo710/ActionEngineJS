// actionengine/geometry/glbrigexporter.js
/**
 * GLBRigExporter — writes a RIGGED, SKINNED character to .glb.
 *
 * WHY THIS IS SEPARATE FROM GLBExporter
 * GLBExporter writes flat meshes: geometry, materials, textures, node transforms. It has no concept of
 * a skeleton, and its pipeline is threaded through texture registries and material grouping that a rig
 * export does not need. Rather than weave skinning through that, this is a self-contained writer for
 * one job — and being self-contained is the point, because this file is meant to be readable as THE
 * example of how a rigged export is assembled.
 *
 * WHAT IT PRODUCES
 * A GLB an artist opens in Blender and starts working in:
 *
 *   Armature (18 bones, `root` at the origin)
 *     visual/   — the character mesh, skinned
 *     hitbox/   — the hit-volume proxies, skinned to the SAME skeleton
 *
 * Both hierarchies share one skin. One animation clip moves both, which is the entire reason they live
 * in one file: authored motion cannot desync the thing you see from the thing you shoot.
 *
 * THE ONE RULE: every vertex is weighted 1.0 to a SINGLE bone.
 * That is not a simplification we are stuck with — it is load-bearing. A vertex set weighted wholly to
 * one bone is RIGID even though glTF expresses it as a skin, so at load time each hit proxy collapses
 * to `{bone, constant AABB}` and the server is back to `bone matrix x fixed box` — the analytic path
 * ActionHitResolver already runs, with no per-vertex work per rewound tick. Split a proxy's weights
 * across two bones and that collapse silently stops being valid. See HITBOX_SKELETON_PLAN.md §11.6.
 *
 * BIND POSE vs POSE
 * The skeleton is exported at REST (arms down, no aim pitch) because that is what a bind pose is for.
 * The character's actual in-game pose — the weapon hold — ships alongside as a one-frame animation
 * clip, so it is visible and editable in Blender instead of existing only as code in
 * ActionFPSCharacterModel.applyWeaponHold.
 *
 * UNITS: reference units throughout. The character stands 1.8 tall, crown at +0.9, feet at -0.9. No
 * scale factors anywhere — see HITBOX_SKELETON_PLAN.md §9.
 *
 * AXES — NOTHING IS CONVERTED, AND THAT IS DELIBERATE
 *
 *   Goblin / ActionEngine  forward +Z
 *   glTF                   forward -Z
 *   Blender                forward -Y
 *
 * Coordinates are written **straight through**. Engine (x, y, z) IS glTF (x, y, z). Import is the
 * identity too, so a round trip cannot drift: there is no sign to get backwards, in either direction.
 *
 * The cost is cosmetic and was accepted knowingly: because glTF forward is -Z and ours is +Z, the
 * character appears FACING AWAY in Blender's front view. It is not "wrong" — the file means exactly
 * what the engine means — it just looks backwards while authoring.
 *
 * An earlier version DID turn the model 180° (negating x and z) so it faced +Y in Blender. It bought
 * one thing, a nicer default view, and cost a whole class of bug: two hand-written conversions that had
 * to agree, and every mistake below.
 *
 *   - negating x ALONE  -> a MIRROR: the bone named `rightElbow` drove the model's LEFT arm
 *   - negating z ALONE  -> a MIRROR: eyes ended up on the BACK OF THE HEAD, limbs reversed
 *   - negating both     -> a real 180° rotation, correct, but now import must undo it exactly
 *
 * Negating ONE axis is a reflection; negating TWO is a rotation. Mixing them up is what produced the
 * failures above, and single-fact checks kept passing because a mirrored model looks plausible
 * part-by-part.
 *
 * DO NOT REINTRODUCE A CONVERSION HERE to make Blender's view nicer. Easy, verifiable import/export
 * was chosen over that. If facing ever needs changing, change it ONCE in a shared function used by
 * both directions — never as separate negations on each side.
 *
 * IF SOMETHING LOOKS WRONG: the game is correct — the character spawns looking +Z with the gun in
 * their right hand. Look at which way the EYES point (two dark boxes on the head's front face) before
 * touching anything, and do not re-derive facing from cross products.
 */
class GLBRigExporter {

    // glTF component types
    static FLOAT = 5126;
    static UNSIGNED_SHORT = 5123;
    static UNSIGNED_INT = 5125;
    static UNSIGNED_BYTE = 5121;
    static ARRAY_BUFFER = 34962;
    static ELEMENT_ARRAY_BUFFER = 34963;

    /**
     * Smooth-by-angle cutoff, in radians (30°) — Blender's auto-smooth default.
     *
     * Faces meeting at LESS than this average their normals (a sphere's facets, a few degrees apart,
     * read as a curve); faces meeting at more stay sharp (a box's 90° corners stay corners). Override
     * per export with `opts.smoothAngle`.
     */
    static SMOOTH_ANGLE = Math.PI / 6;

    /**
     * Export a rigged character.
     *
     * @param {Object} rig      { bones:[{name,parent,x,y,z}], partBone:{part->bone} } — `bones` MUST be
     *                          ordered parent-before-child (glTF requires it for skins), and positions
     *                          are model-space rest, which is what ActionFPSCharacterModel.BONES holds.
     * @param {Object} layers   { visual: ActionModel3D, hitbox: ActionModel3D } — both keyed by the same
     *                          part names, so both bind through the same `partBone` map.
     * @param {Object} [opts]   { name, clips:[{name, pose:{bone->{rx,ry,rz,tx,ty,tz}}}] }
     * @returns {ArrayBuffer}   .glb bytes
     */
    static export(rig, layers, opts = {}) {
        const name = opts.name || "character";
        const bones = rig.bones;
        GLBRigExporter._validateRig(rig, layers);

        // ---- Skeleton ------------------------------------------------------------------------------
        // World rest -> parent-relative translation. The rest rig is translation-only (no rotations),
        // which is why the inverse bind matrices below are a plain negated translation.
        const index = {};
        bones.forEach((b, i) => (index[b.name] = i));
        const local = bones.map((b) => {
            const p = b.parent ? bones[index[b.parent]] : null;
            return p ? [b.x - p.x, b.y - p.y, b.z - p.z] : [b.x, b.y, b.z];
        });

        const buffers = []; // {data:ArrayBuffer, target?:number} in write order
        const gltf = {
            asset: { version: "2.0", generator: "ActionEngine GLBRigExporter" },
            scene: 0,
            scenes: [{ nodes: [] }],
            nodes: [],
            meshes: [],
            materials: [],
            skins: [],
            buffers: [],
            bufferViews: [],
            accessors: []
        };

        // Bone nodes first, so joint indices ARE node indices — one less mapping to get wrong.
        bones.forEach((b, i) => {
            const node = { name: b.name, translation: local[i] };
            const kids = [];
            bones.forEach((c, j) => {
                if (c.parent === b.name) kids.push(j);
            });
            if (kids.length) node.children = kids;
            gltf.nodes.push(node);
        });
        const rootBoneNodes = bones.map((b, i) => (b.parent ? -1 : i)).filter((i) => i >= 0);

        // ---- Geometry layers -----------------------------------------------------------------------
        //
        // The two layers are written DIFFERENTLY on purpose, because they are asked different questions.
        //
        //   visual  — ONE skinned mesh, triangles grouped by material. Part identity is deliberately
        //             dissolved: nobody asks where the forearm ends and the elbow begins on a character
        //             surface, the skin blends across joints, and that is what a character mesh IS.
        //
        //   hitbox  — ONE NODE PER PART, each keeping its name. Part identity is the whole product here:
        //             the server resolves a hit to "<playerId>:<part>" and maps that name through
        //             HIT_GROUPS, so a headshot is 4x because the volume is called `head`. Merge the
        //             parts and 25 tuned volumes collapse into one fused blob per BONE (a shoulder
        //             sphere welded to an upper-arm capsule), which matches neither.
        //
        // `opts.perPart` names the layers that keep per-part nodes.
        const perPart = new Set(opts.perPart || ["hitbox"]);
        const meshNodes = [];
        for (const layerName of Object.keys(layers)) {
            const model = layers[layerName];
            if (!model) continue;

            if (!perPart.has(layerName)) {
                const built = GLBRigExporter._buildSkinnedMesh(
                    model, rig.partBone, index, gltf, buffers, opts.smooth !== false,
                    opts.smoothAngle || GLBRigExporter.SMOOTH_ANGLE);
                gltf.meshes.push({ name: layerName, primitives: built.primitives });
                const nodeIndex = gltf.nodes.length;
                gltf.nodes.push({ name: layerName, mesh: gltf.meshes.length - 1, skin: 0 });
                meshNodes.push(nodeIndex);
                continue;
            }

            // One mesh + one node per part, gathered under a parent node named for the layer, so the
            // Blender outliner shows `hitbox` containing 25 named proxies.
            const kids = [];
            for (const o of model.objects) {
                if (!o.triangles || !o.triangles.length) continue;
                // Hit proxies stay FLAT-shaded: they are collision volumes you eyeball while authoring,
                // not a surface anyone lights. Faceted reads their true shape more honestly.
                const built = GLBRigExporter._buildSkinnedMesh(
                    { objects: [o] }, rig.partBone, index, gltf, buffers, false);
                gltf.meshes.push({ name: o.name, primitives: built.primitives });
                kids.push(gltf.nodes.length);
                gltf.nodes.push({ name: o.name, mesh: gltf.meshes.length - 1, skin: 0 });
            }
            const groupIndex = gltf.nodes.length;
            gltf.nodes.push({ name: layerName, children: kids });
            meshNodes.push(groupIndex);
        }

        // ---- Skin ----------------------------------------------------------------------------------
        // inverseBindMatrix = inverse of the bone's world rest transform. Translation-only rest means
        // that is just the negated world position, in glTF's COLUMN-MAJOR layout (translation in
        // elements 12,13,14).
        const ibm = new Float32Array(bones.length * 16);
        bones.forEach((b, i) => {
            const o = i * 16;
            ibm[o] = ibm[o + 5] = ibm[o + 10] = ibm[o + 15] = 1;
            ibm[o + 12] = -b.x;
            ibm[o + 13] = -b.y;
            ibm[o + 14] = -b.z;
        });
        const ibmAccessor = GLBRigExporter._push(gltf, buffers, ibm.buffer, {
            componentType: GLBRigExporter.FLOAT,
            count: bones.length,
            type: "MAT4"
        });
        gltf.skins.push({ name: name + "_skin", joints: bones.map((_, i) => i), inverseBindMatrices: ibmAccessor });

        // ---- Scenes ---------------------------------------------------------------------------------
        // Blender 4.5+ maps ONE glTF SCENE -> ONE BLENDER COLLECTION (importer option
        // `import_scene_as_collection`, on by default). That is the only mechanism there is: the Khronos
        // registry has no collection extension, and a childful mesh-less node imports as an Empty, not a
        // collection. So `visual` and `hitbox` become collections by becoming scenes — which is what
        // makes them independently toggleable while authoring.
        //
        // The armature root is listed in EVERY scene. A skin resolves joints by NODE INDEX, not by scene
        // membership, so this is legal and it keeps each collection self-contained rather than leaving
        // one mesh in a scene with no skeleton.
        //
        // On Blender <= 4.4 each glTF scene becomes a separate Blender SCENE instead, which is worse than
        // a single scene — set `opts.singleScene` to fall back to one combined scene there.
        if (opts.singleScene || meshNodes.length < 2) {
            gltf.scenes[0].nodes = rootBoneNodes.concat(meshNodes);
        } else {
            gltf.scenes = meshNodes.map((n) => ({
                name: gltf.nodes[n].name,
                nodes: rootBoneNodes.concat([n])
            }));
        }

        // ---- Clips ---------------------------------------------------------------------------------
        if (opts.clips && opts.clips.length) {
            gltf.animations = opts.clips.map((c) => GLBRigExporter._buildClip(c, index, gltf, buffers));
        }

        // ---- Pack ----------------------------------------------------------------------------------
        const bin = GLBRigExporter._packBuffers(gltf, buffers);
        gltf.buffers = [{ byteLength: bin.byteLength }];
        return GLBRigExporter._assemble(gltf, bin);
    }

    /**
     * Fail loudly on a malformed rig rather than writing a subtly broken file. A GLB that loads but
     * poses wrong is far more expensive to diagnose than an exception here — no fallbacks.
     */
    static _validateRig(rig, layers) {
        const seen = new Set();
        for (const b of rig.bones) {
            if (seen.has(b.name)) throw new Error("GLBRigExporter: duplicate bone '" + b.name + "'");
            if (b.parent && !seen.has(b.parent)) {
                throw new Error("GLBRigExporter: bone '" + b.name + "' precedes its parent '" + b.parent +
                    "' — glTF skins require parent-before-child ordering");
            }
            seen.add(b.name);
        }
        for (const layerName of Object.keys(layers)) {
            const model = layers[layerName];
            if (!model) continue;
            for (const o of model.objects) {
                const bone = rig.partBone[o.name];
                if (!bone) throw new Error("GLBRigExporter: part '" + o.name + "' (" + layerName + ") has no bone binding");
                if (!seen.has(bone)) throw new Error("GLBRigExporter: part '" + o.name + "' binds to unknown bone '" + bone + "'");
            }
        }
    }

    /**
     * One layer -> one skinned mesh, split into a primitive per material colour.
     *
     * Vertices are written in MODEL space (part offset baked in) because the inverse bind matrix undoes
     * exactly that when the skin is applied — the standard glTF arrangement, and it means the mesh node
     * itself carries no transform.
     */
    static _buildSkinnedMesh(model, partBone, boneIndex, gltf, buffers, smooth = true,
        angle = GLBRigExporter.SMOOTH_ANGLE) {
        const byColor = new Map(); // color -> {pos:[], norm:[], joint:[], idx:[]}
        for (const o of model.objects) {
            if (!o.triangles || !o.triangles.length) continue;
            const j = boneIndex[partBone[o.name]];
            const off = o.localOffset || (o.transform && o.transform.position) || { x: 0, y: 0, z: 0 };
            for (const t of o.triangles) {
                const color = t.color || "#cccccc";
                let g = byColor.get(color);
                if (!g) byColor.set(color, (g = { pos: [], norm: [], joint: [], idx: [] }));
                // Coordinates go out UNCHANGED — no axis conversion anywhere (see AXES in the class
                // header). Vertex order is likewise untouched, so winding is whatever the engine
                // authored.
                for (let vi = 0; vi < t.vertices.length; vi++) {
                    const v = t.vertices[vi];
                    g.idx.push(g.pos.length / 3);
                    g.pos.push(v.x + off.x, v.y + off.y, v.z + off.z);
                    g.joint.push(j);
                    // AUTHORED normals win. The shape builders already compute correct smooth normals
                    // for the curved surfaces they generate — ActionPhysicsCapsule3D, Sphere3D and
                    // Cylinder3D all fill `vertexNormals` (and deliberately leave poles flat);
                    // ActionPhysicsBox3D leaves it null because a box wants flat shading. A geometric
                    // guess made here cannot beat the code that KNOWS the shape is a capsule, so only
                    // fall back to computing when nothing was authored.
                    //
                    // Written through unchanged, like the position. A normal is a direction, so the
                    // part offset is not applied to it.
                    const vn = t.vertexNormals && t.vertexNormals[vi];
                    g.norm.push(vn ? vn.x : null, vn ? vn.y : null, vn ? vn.z : null);
                }
            }
        }

        const primitives = [];
        for (const [color, g] of byColor) {
            const count = g.pos.length / 3;
            const pos = new Float32Array(g.pos);
            // JOINTS_0 is VEC4 — bone in slot 0, the rest unused. WEIGHTS_0 mirrors it with 1,0,0,0:
            // a single full-weight influence, which is what makes the proxy rigid (see the header).
            const joints = new Uint8Array(count * 4);
            const weights = new Float32Array(count * 4);
            for (let i = 0; i < count; i++) {
                joints[i * 4] = g.joint[i];
                weights[i * 4] = 1;
            }
            // Authored normals where the shape builder supplied them; computed for the vertices it did
            // not (a box, or a triangle assembled by hand).
            const computed = GLBRigExporter._vertexNormals(pos, smooth, angle);
            const normals = new Float32Array(count * 3);
            for (let i = 0; i < count * 3; i++) {
                normals[i] = g.norm[i] === null || g.norm[i] === undefined ? computed[i] : g.norm[i];
            }
            // THEN weld the SEAM. The shape builders average by vertex INDEX, so where a radial loop
            // closes back on itself the first and last column sit at the same position under different
            // indices and never get averaged — leaving a crease running the full length of every
            // capsule (measured: 15.5° split, one vertex per ring, top to bottom). Welding by POSITION
            // here closes it. Still angle-limited, so a box's corners are untouched.
            if (smooth) GLBRigExporter._weldSeams(pos, normals, angle);

            // MERGE DUPLICATE VERTICES. ActionEngine has no shared-vertex concept — a Triangle owns
            // three Vector3s outright — so a sphere arrives with every vertex repeated once per
            // touching face. Emitting that verbatim writes ~8x the data glTF needs and hands an artist
            // a mesh with no real topology (Blender would need a manual Merge by Distance before it
            // could be edited).
            //
            // Merge on position + NORMAL + joint: two vertices at the same point with DIFFERENT normals
            // are a genuine hard edge (a box corner) and must stay separate, or the merge would undo the
            // sharpness the smoothing pass just worked out.
            const merged = GLBRigExporter._mergeVertices(pos, normals, joints, weights, g.idx);

            const vcount = merged.pos.length / 3;
            const min = [Infinity, Infinity, Infinity];
            const max = [-Infinity, -Infinity, -Infinity];
            for (let i = 0; i < vcount; i++) {
                for (let k = 0; k < 3; k++) {
                    const c = merged.pos[i * 3 + k];
                    if (c < min[k]) min[k] = c;
                    if (c > max[k]) max[k] = c;
                }
            }
            // Indices outgrow 16 bits once a merged part is big enough; pick the width to match.
            const wide = vcount > 65535;
            const indexData = wide ? new Uint32Array(merged.idx) : new Uint16Array(merged.idx);

            const P = GLBRigExporter._push(gltf, buffers, merged.pos.buffer,
                { componentType: GLBRigExporter.FLOAT, count: vcount, type: "VEC3", min, max },
                GLBRigExporter.ARRAY_BUFFER);
            const N = GLBRigExporter._push(gltf, buffers, merged.normals.buffer,
                { componentType: GLBRigExporter.FLOAT, count: vcount, type: "VEC3" }, GLBRigExporter.ARRAY_BUFFER);
            const J = GLBRigExporter._push(gltf, buffers, merged.joints.buffer,
                { componentType: GLBRigExporter.UNSIGNED_BYTE, count: vcount, type: "VEC4" }, GLBRigExporter.ARRAY_BUFFER);
            const W = GLBRigExporter._push(gltf, buffers, merged.weights.buffer,
                { componentType: GLBRigExporter.FLOAT, count: vcount, type: "VEC4" }, GLBRigExporter.ARRAY_BUFFER);
            const I = GLBRigExporter._push(gltf, buffers, indexData.buffer,
                { componentType: wide ? GLBRigExporter.UNSIGNED_INT : GLBRigExporter.UNSIGNED_SHORT,
                    count: merged.idx.length, type: "SCALAR" },
                GLBRigExporter.ELEMENT_ARRAY_BUFFER);

            gltf.materials.push({
                name: "mat_" + color.replace("#", ""),
                pbrMetallicRoughness: {
                    baseColorFactor: GLBRigExporter._rgba(color),
                    metallicFactor: 0,
                    roughnessFactor: 0.85
                }
            });
            primitives.push({
                attributes: { POSITION: P, NORMAL: N, JOINTS_0: J, WEIGHTS_0: W },
                indices: I,
                material: gltf.materials.length - 1
            });
        }
        return { primitives };
    }

    /**
     * Vertex normals.
     *
     * FLAT (`smooth` false): each triangle's own face normal, repeated on its three vertices. Exact,
     * and what a box wants — a cube with averaged normals looks like a bad balloon.
     *
     * SMOOTH (default): face normals AREA-WEIGHTED and averaged across every triangle meeting at a
     * position. The engine's spheres and capsules are tessellated curves, so without this they read as
     * faceted. Area weighting (rather than a plain mean) keeps a few slivers from dragging the normal
     * of a vertex surrounded by large faces — the cross product's magnitude IS twice the triangle area,
     * so simply not normalising before accumulating gives it for free.
     *
     * Welding is by POSITION, within one part only. Two parts that touch keep their own normals, so a
     * hand does not smooth into a forearm.
     */
    static _vertexNormals(pos, smooth = true, angle = GLBRigExporter.SMOOTH_ANGLE) {
        const n = new Float32Array(pos.length);
        const face = [];
        for (let i = 0; i < pos.length; i += 9) {
            const ax = pos[i + 3] - pos[i], ay = pos[i + 4] - pos[i + 1], az = pos[i + 5] - pos[i + 2];
            const bx = pos[i + 6] - pos[i], by = pos[i + 7] - pos[i + 1], bz = pos[i + 8] - pos[i + 2];
            // NOT normalised: |cross| == 2 * area, which is exactly the weight we want when averaging.
            face.push(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
        }

        if (!smooth) {
            for (let t = 0; t < face.length / 3; t++) {
                const len = Math.hypot(face[t * 3], face[t * 3 + 1], face[t * 3 + 2]) || 1;
                for (let k = 0; k < 3; k++) {
                    n[t * 9 + k * 3] = face[t * 3] / len;
                    n[t * 9 + k * 3 + 1] = face[t * 3 + 1] / len;
                    n[t * 9 + k * 3 + 2] = face[t * 3 + 2] / len;
                }
            }
            return n;
        }

        // SMOOTH BY ANGLE — the equivalent of Blender's auto-smooth, done at export so the file is
        // correct on its own instead of needing a manual fix-up after every import.
        //
        // A vertex averages only the incident faces whose normals are within `angle` of its OWN face.
        // A sphere's neighbouring facets differ by a few degrees, so they average and the curve reads
        // smooth. A box's faces meet at 90°, so nothing averages and the edges stay sharp. Averaging
        // everything unconditionally turns a cube into a soft blob, which is why this is not a plain
        // per-position mean.
        const cosLimit = Math.cos(angle);
        const count = pos.length / 3;
        const key = (i) =>
            Math.round(pos[i * 3] * 1e5) + "," + Math.round(pos[i * 3 + 1] * 1e5) + "," +
            Math.round(pos[i * 3 + 2] * 1e5);

        // Unit face normals, for the angle comparison (the raw ones stay area-weighted for averaging).
        const unit = [];
        for (let t = 0; t < face.length / 3; t++) {
            const len = Math.hypot(face[t * 3], face[t * 3 + 1], face[t * 3 + 2]) || 1;
            unit.push(face[t * 3] / len, face[t * 3 + 1] / len, face[t * 3 + 2] / len);
        }

        // position -> the triangles touching it
        const atPos = new Map();
        for (let v = 0; v < count; v++) {
            const k = key(v);
            let list = atPos.get(k);
            if (!list) atPos.set(k, (list = []));
            list.push((v / 3) | 0);
        }

        for (let v = 0; v < count; v++) {
            const own = (v / 3) | 0;
            let ax = 0, ay = 0, az = 0;
            for (const t of atPos.get(key(v))) {
                const d = unit[own * 3] * unit[t * 3] + unit[own * 3 + 1] * unit[t * 3 + 1] +
                    unit[own * 3 + 2] * unit[t * 3 + 2];
                if (d < cosLimit) continue; // too sharp — this face belongs to a different surface
                ax += face[t * 3];
                ay += face[t * 3 + 1];
                az += face[t * 3 + 2];
            }
            const len = Math.hypot(ax, ay, az) || 1;
            n[v * 3] = ax / len;
            n[v * 3 + 1] = ay / len;
            n[v * 3 + 2] = az / len;
        }
        return n;
    }

    /**
     * Collapse duplicate vertices and build an index buffer.
     *
     * Keyed on position + normal + joint, all quantised, so vertices only merge when they are the same
     * point on the same surface bound to the same bone. A box corner — same position, three different
     * normals — correctly stays as three vertices.
     *
     * Returns { pos, normals, joints, weights, idx }, all rebuilt.
     */
    static _mergeVertices(pos, normals, joints, weights, idx) {
        const q = (n) => Math.round(n * 1e5) + 0; // +0 collapses -0, which would key differently
        const map = new Map();
        const remap = new Int32Array(pos.length / 3);
        const P = [], N = [], J = [], W = [];

        for (let v = 0; v < pos.length / 3; v++) {
            const key =
                q(pos[v * 3]) + "," + q(pos[v * 3 + 1]) + "," + q(pos[v * 3 + 2]) + "|" +
                q(normals[v * 3]) + "," + q(normals[v * 3 + 1]) + "," + q(normals[v * 3 + 2]) + "|" +
                joints[v * 4];
            let at = map.get(key);
            if (at === undefined) {
                at = P.length / 3;
                map.set(key, at);
                P.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
                N.push(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]);
                J.push(joints[v * 4], joints[v * 4 + 1], joints[v * 4 + 2], joints[v * 4 + 3]);
                W.push(weights[v * 4], weights[v * 4 + 1], weights[v * 4 + 2], weights[v * 4 + 3]);
            }
            remap[v] = at;
        }

        return {
            pos: new Float32Array(P),
            normals: new Float32Array(N),
            joints: new Uint8Array(J),
            weights: new Float32Array(W),
            idx: idx.map((i) => remap[i])
        };
    }

    /**
     * Average normals that sit at the SAME POSITION but differ, in place.
     *
     * Closes the seam left by index-based smoothing (see the call site). Angle-limited by the same
     * cutoff as `_vertexNormals`, so genuinely sharp meetings — a box corner, a capsule's cap-to-barrel
     * transition if it exceeds the threshold — stay sharp. Normals more than `angle` apart are left
     * alone rather than blended into mush.
     */
    static _weldSeams(pos, normals, angle) {
        const cosLimit = Math.cos(angle);
        const count = pos.length / 3;
        const atPos = new Map();
        for (let v = 0; v < count; v++) {
            const k = Math.round(pos[v * 3] * 1e5) + "," + Math.round(pos[v * 3 + 1] * 1e5) + "," +
                Math.round(pos[v * 3 + 2] * 1e5);
            let list = atPos.get(k);
            if (!list) atPos.set(k, (list = []));
            list.push(v);
        }
        // Read from a snapshot: averaging in place would let a vertex processed later see values already
        // rewritten by this pass, so the result would depend on iteration order.
        const src = normals.slice();
        for (const list of atPos.values()) {
            if (list.length < 2) continue;
            for (const v of list) {
                let ax = 0, ay = 0, az = 0;
                for (const w of list) {
                    const d = src[v * 3] * src[w * 3] + src[v * 3 + 1] * src[w * 3 + 1] +
                        src[v * 3 + 2] * src[w * 3 + 2];
                    if (d < cosLimit) continue;
                    ax += src[w * 3];
                    ay += src[w * 3 + 1];
                    az += src[w * 3 + 2];
                }
                const len = Math.hypot(ax, ay, az);
                if (len < 1e-9) continue;
                normals[v * 3] = ax / len;
                normals[v * 3 + 1] = ay / len;
                normals[v * 3 + 2] = az / len;
            }
        }
    }

    /**
     * A clip as glTF animation channels. Single-keyframe clips are written with TWO identical keys at
     * t=0 and t=1/30 — a one-key sampler is legal but several tools (Blender included) treat a
     * zero-length action as empty, and a pose you cannot see defeats the purpose of exporting it.
     */
    static _buildClip(clip, boneIndex, gltf, buffers) {
        const times = GLBRigExporter._push(gltf, buffers, new Float32Array([0, 1 / 30]).buffer,
            { componentType: GLBRigExporter.FLOAT, count: 2, type: "SCALAR", min: [0], max: [1 / 30] });

        const samplers = [];
        const channels = [];
        for (const [bone, p] of Object.entries(clip.pose)) {
            const node = boneIndex[bone];
            if (node === undefined) throw new Error("GLBRigExporter: clip '" + clip.name + "' targets unknown bone '" + bone + "'");
            if (p.rx || p.ry || p.rz) {
                const q = GLBRigExporter._quat(p.rx || 0, p.ry || 0, p.rz || 0);
                const out = GLBRigExporter._push(gltf, buffers, new Float32Array([...q, ...q]).buffer,
                    { componentType: GLBRigExporter.FLOAT, count: 2, type: "VEC4" });
                samplers.push({ input: times, output: out, interpolation: "LINEAR" });
                channels.push({ sampler: samplers.length - 1, target: { node, path: "rotation" } });
            }
            if (p.tx || p.ty || p.tz) {
                // Additive on the bone's REST translation — a glTF translation channel is absolute.
                const b = gltf.nodes[node].translation;
                const t = [b[0] + (p.tx || 0), b[1] + (p.ty || 0), b[2] + (p.tz || 0)];
                const out = GLBRigExporter._push(gltf, buffers, new Float32Array([...t, ...t]).buffer,
                    { componentType: GLBRigExporter.FLOAT, count: 2, type: "VEC3" });
                samplers.push({ input: times, output: out, interpolation: "LINEAR" });
                channels.push({ sampler: samplers.length - 1, target: { node, path: "translation" } });
            }
        }
        return { name: clip.name, samplers, channels };
    }

    /** Euler XYZ -> quaternion [x,y,z,w], matching the engine's pitch/yaw/roll order. */
    static _quat(rx, ry, rz) {
        const cx = Math.cos(rx / 2), sx = Math.sin(rx / 2);
        const cy = Math.cos(ry / 2), sy = Math.sin(ry / 2);
        const cz = Math.cos(rz / 2), sz = Math.sin(rz / 2);
        return [
            sx * cy * cz - cx * sy * sz,
            cx * sy * cz + sx * cy * sz,
            cx * cy * sz - sx * sy * cz,
            cx * cy * cz + sx * sy * sz
        ];
    }

    /** "#rrggbb" -> [r,g,b,a] in 0..1. */
    static _rgba(hex) {
        const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
        if (!m) return [0.8, 0.8, 0.8, 1];
        const n = parseInt(m[1], 16);
        return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
    }

    /** Queue an ArrayBuffer, emit its bufferView + accessor, return the accessor index. */
    static _push(gltf, buffers, data, accessor, target) {
        buffers.push({ data, target });
        gltf.accessors.push(Object.assign({ bufferView: buffers.length - 1 }, accessor));
        return gltf.accessors.length - 1;
    }

    /** Concatenate queued buffers 4-byte aligned, filling in bufferView offsets as it goes. */
    static _packBuffers(gltf, buffers) {
        let total = 0;
        const offsets = buffers.map((b) => {
            const at = total;
            total += b.data.byteLength;
            total += (4 - (total % 4)) % 4; // glTF requires 4-byte aligned bufferViews
            return at;
        });
        const out = new Uint8Array(total);
        buffers.forEach((b, i) => {
            out.set(new Uint8Array(b.data), offsets[i]);
            const view = { buffer: 0, byteOffset: offsets[i], byteLength: b.data.byteLength };
            if (b.target) view.target = b.target;
            gltf.bufferViews.push(view);
        });
        return out.buffer;
    }

    /** GLB container: 12-byte header + JSON chunk + BIN chunk, each 4-byte aligned. */
    static _assemble(gltf, bin) {
        const json = new TextEncoder().encode(JSON.stringify(gltf));
        const jsonPad = (4 - (json.length % 4)) % 4;
        const binPad = (4 - (bin.byteLength % 4)) % 4;
        const total = 12 + 8 + json.length + jsonPad + 8 + bin.byteLength + binPad;

        const glb = new ArrayBuffer(total);
        const view = new DataView(glb);
        const bytes = new Uint8Array(glb);
        let o = 0;

        view.setUint32(o, 0x46546c67, true); // 'glTF'
        view.setUint32(o + 4, 2, true);
        view.setUint32(o + 8, total, true);
        o += 12;

        view.setUint32(o, json.length + jsonPad, true);
        view.setUint32(o + 4, 0x4e4f534a, true); // 'JSON'
        o += 8;
        bytes.set(json, o);
        o += json.length;
        for (let i = 0; i < jsonPad; i++) bytes[o++] = 0x20; // space-padded per spec

        view.setUint32(o, bin.byteLength + binPad, true);
        view.setUint32(o + 4, 0x004e4942, true); // 'BIN\0'
        o += 8;
        bytes.set(new Uint8Array(bin), o);
        // trailing binPad bytes stay zero, which is what the spec asks for

        return glb;
    }
}

if (typeof module !== "undefined" && module.exports) module.exports = GLBRigExporter;
