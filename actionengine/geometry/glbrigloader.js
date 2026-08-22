// actionengine/geometry/glbrigloader.js
/**
 * GLBRigLoader — turns a rigged .glb into the two things the character system runs on: a skeleton and
 * a set of hit volumes. The other half of GLBRigExporter.
 *
 * NO COORDINATE CONVERSION. Engine (x, y, z) IS glTF (x, y, z), in both directions — see the AXES note
 * in glbrigexporter.js. A bone authored at x = -0.281 comes back at x = -0.281. There is no sign to
 * get backwards here, which is deliberate: the pair of conversions this replaced cost an entire day
 * and produced a mirrored character three separate ways.
 *
 * WHAT IT READS
 *   skins[0].joints  -> bone hierarchy + rest positions -> ActionSkeleton
 *   node "hitbox"    -> one named child per part -> hit volumes
 *   animations       -> passed through as-is for a pose layer to sample
 *
 * WHAT STAYS IN CODE, deliberately (see HITBOX_SKELETON_PLAN.md §11.7)
 *   - the hit-volume KIND per part (sphere / capsule / box). A GLB stores a proxy as triangles; the
 *     name says which primitive it is, so nothing has to be inferred from geometry.
 *   - HIT_GROUPS and the damage multipliers. That is gameplay tuning, not geometry — nobody should
 *     open Blender to nerf headshots.
 *
 * WHY A PROXY'S AABB IS ENOUGH
 * Every hit proxy is weighted 1.0 to a SINGLE bone, so it is rigid: its extent in that bone's local
 * space never changes, whatever the animation does. That lets a hit volume collapse, once at load, to
 * `{bone, constant AABB}` — and the server stays on `bone matrix x fixed box`, the analytic path
 * ActionHitResolver already runs. Break the single-bone rule in the source file and this collapse is
 * silently wrong; `load()` throws rather than let that through.
 */
class GLBRigLoader {
    /**
     * @param {Object} gltf   parsed glTF JSON (the GLB's JSON chunk)
     * @param {Uint8Array|Buffer} bin  the GLB's BIN chunk
     * @param {Object} [opts] { kinds: {part -> "sphere"|"capsule"|"box"|"cylinder"}, groups: {part -> GROUP} }
     * @returns {{ skeleton, volumes, animations, bones, parts }}
     */
    static load(gltf, bin, opts = {}) {
        if (!gltf.skins || !gltf.skins.length) throw new Error("GLBRigLoader: file has no skin — not a rigged character");

        const read = GLBRigLoader._reader(gltf, bin);
        const bones = GLBRigLoader._bones(gltf);
        const volumes = GLBRigLoader._volumes(gltf, read, bones, opts);

        return {
            bones,
            skeleton: new ActionSkeleton(bones),
            volumes,
            parts: volumes.map((v) => v.part),
            animations: gltf.animations || [],
            // Kept so the VISIBLE mesh can be pulled out later (splitVisualByBone). The hit volumes are
            // finished data by this point; the visual layer still needs the raw buffers.
            gltf,
            bin,
            read
        };
    }

    /**
     * The `visual` mesh, split into one part per bone.
     *
     * ActionFPSBodyModel poses one object PER BODY PART and looks parts up BY NAME (the aim
     * articulation in ActionFPSCharacterModel.AIM_PIVOTS is keyed on those names), but the visual layer
     * is exported as ONE merged skinned mesh — part identity is deliberately dissolved there, because a
     * character surface is continuous and nobody asks where the forearm ends.
     *
     * So identity is recovered from the SKIN: every vertex is weighted 1.0 to exactly one bone, and the
     * bone name IS the part name. That is the naming contract the whole pipeline rests on, and it means
     * this split needs no extra metadata in the file.
     *
     * Each part's triangles come back RELATIVE to that bone's rest position, matching what a procedural
     * part carries in `localOffset` — so ActionFPSBodyModel treats a GLB part and a procedural part
     * identically.
     *
     * Returns [{ name, origin:{x,y,z}, triangles:[{a,b,c,color,skin}] }].
     */
    static splitVisualByBone(rig) {
        const { gltf, read } = rig;
        const node = gltf.nodes.find((n) => n.name === "visual" && n.mesh !== undefined);
        if (!node) throw new Error("GLBRigLoader: no `visual` mesh node in the file");

        const joints = gltf.skins[0].joints;
        const boneRest = {};
        for (const b of rig.bones) boneRest[b.name] = b;

        const byBone = new Map();
        for (const prim of gltf.meshes[node.mesh].primitives) {
            const pos = read(prim.attributes.POSITION, 3);
            // NORMALS MATTER. The exporter writes smooth, seam-welded vertex normals; drop them and
            // Triangle falls back to a per-face normal, which renders every sphere and capsule faceted.
            const nrm = prim.attributes.NORMAL !== undefined ? read(prim.attributes.NORMAL, 3) : null;
            const jnt = read(prim.attributes.JOINTS_0, 4, true);
            const idx = read(prim.indices, 1, true);
            const mat = gltf.materials[prim.material];
            const color = GLBRigLoader._hex(mat && mat.pbrMetallicRoughness &&
                mat.pbrMetallicRoughness.baseColorFactor);
            // Parts that are NOT the body tint (skin, eyes) keep their authored colour; the body itself
            // is re-tinted per player, so it must not be baked in here.
            const skin = !!(mat && mat.name && mat.name !== GLBRigLoader.BODY_MATERIAL);

            for (let i = 0; i < idx.length; i += 3) {
                const bone = gltf.nodes[joints[jnt[idx[i] * 4]]].name;
                let list = byBone.get(bone);
                if (!list) byBone.set(bone, (list = []));
                const V = (k) => ({ x: pos[idx[i + k] * 3], y: pos[idx[i + k] * 3 + 1], z: pos[idx[i + k] * 3 + 2] });
                const N = (k) => nrm
                    ? { x: nrm[idx[i + k] * 3], y: nrm[idx[i + k] * 3 + 1], z: nrm[idx[i + k] * 3 + 2] }
                    : null;
                list.push({
                    a: V(0), b: V(1), c: V(2), color, skin,
                    // Per-vertex normals, in the same order as a/b/c. A direction, so rebasing the
                    // positions below must NOT touch these.
                    normals: nrm ? [N(0), N(1), N(2)] : null
                });
            }
        }

        const out = [];
        for (const [bone, tris] of byBone) {
            const rest = boneRest[bone] || { x: 0, y: 0, z: 0 };
            out.push({
                name: bone,
                origin: { x: rest.x, y: rest.y, z: rest.z },
                // Rebase to the bone: a part's triangles are stored relative to its own origin, exactly
                // as a procedural part is.
                triangles: tris.map((t) => ({
                    a: { x: t.a.x - rest.x, y: t.a.y - rest.y, z: t.a.z - rest.z },
                    b: { x: t.b.x - rest.x, y: t.b.y - rest.y, z: t.b.z - rest.z },
                    c: { x: t.c.x - rest.x, y: t.c.y - rest.y, z: t.c.z - rest.z },
                    color: t.color,
                    skin: t.skin,
                    normals: t.normals // untouched: a translation does not rotate a direction
                }))
            });
        }
        return out;
    }

    /** The material name carrying the per-player tint; everything else keeps its authored colour. */
    static BODY_MATERIAL = "mat_4a9ad0";

    /** [r,g,b,a] 0..1 -> "#rrggbb". */
    static _hex(f) {
        if (!f) return "#cccccc";
        const c = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
        return "#" + c(f[0]) + c(f[1]) + c(f[2]);
    }

    /**
     * The bone hierarchy, in MODEL space — which is what ActionSkeleton wants (it converts to
     * parent-relative itself). glTF node translations are parent-relative, so they accumulate down the
     * chain here.
     *
     * Bones are read through `skins[0].joints`, never by node name: hit proxies deliberately share
     * names with their bones (a `head` proxy on the `head` bone), so a name lookup over `nodes` returns
     * whichever came first. That mistake produced two false failures while this was being built.
     */
    static _bones(gltf) {
        const joints = gltf.skins[0].joints;
        const parentOf = {};
        gltf.nodes.forEach((n, i) => (n.children || []).forEach((c) => (parentOf[c] = i)));

        const world = (nodeIndex) => {
            let i = nodeIndex, x = 0, y = 0, z = 0;
            while (i !== undefined) {
                const t = gltf.nodes[i].translation || [0, 0, 0];
                x += t[0];
                y += t[1];
                z += t[2];
                i = parentOf[i];
            }
            return { x, y, z };
        };

        const isJoint = new Set(joints);
        return joints.map((nodeIndex) => {
            const p = parentOf[nodeIndex];
            const w = world(nodeIndex);
            return {
                name: gltf.nodes[nodeIndex].name,
                // A joint whose parent is not itself a joint is a root as far as the skeleton cares.
                parent: p !== undefined && isJoint.has(p) ? gltf.nodes[p].name : null,
                x: w.x,
                y: w.y,
                z: w.z
            };
        });
    }

    /**
     * Hit volumes from the named proxies under the `hitbox` node.
     *
     * Emits the same records `ActionFPSCharacterModel.hitVolumes()` produces — `{part, group, cx, cy,
     * cz, hx, hy, hz, shape}` — so ActionHitResolver consumes them unchanged and neither the resolver
     * nor the netcode knows or cares that the character came from a file.
     */
    static _volumes(gltf, read, bones, opts) {
        const group = opts.groups || (typeof ActionFPSCharacterModel !== "undefined"
            ? ActionFPSCharacterModel.HIT_GROUPS : {});
        const kinds = opts.kinds || GLBRigLoader.KINDS;

        // FIND PROXIES BY NAME, NOT BY PARENT.
        //
        // The exporter groups them under a `hitbox` node, but that grouping does NOT survive a Blender
        // round trip: Blender parents every skinned mesh to the armature, so the group comes back as an
        // empty with no children and the 25 proxies become its siblings. Both layouts are legitimate
        // glTF, and an authored-in-Blender character would never have the group at all.
        //
        // The NAME is the contract (§11.5), so that is what identifies a proxy: any mesh node whose
        // name is in the part table. `visual` is not in it, which is what keeps the visible mesh out.
        const wanted = new Set(Object.keys(kinds).length ? Object.keys(kinds) : Object.keys(group));
        const proxies = gltf.nodes
            .map((n, i) => ({ n, i }))
            .filter(({ n }) => n.mesh !== undefined && wanted.has(n.name));
        if (!proxies.length) {
            throw new Error("GLBRigLoader: no hit-volume meshes found. Expected mesh nodes named after " +
                "body parts (" + [...wanted].slice(0, 4).join(", ") + ", ...); the file has " +
                gltf.nodes.filter((n) => n.mesh !== undefined).map((n) => n.name).join(", "));
        }

        const joints = gltf.skins[0].joints;
        const out = [];
        for (const { i: childIndex } of proxies) {
            const node = gltf.nodes[childIndex];
            const mesh = gltf.meshes[node.mesh];

            let lox = Infinity, loy = Infinity, loz = Infinity;
            let hix = -Infinity, hiy = -Infinity, hiz = -Infinity;
            const bonesUsed = new Set();

            for (const prim of mesh.primitives) {
                const pos = read(prim.attributes.POSITION, 3);
                const jnt = read(prim.attributes.JOINTS_0, 4, true);
                for (let i = 0; i < pos.length / 3; i++) {
                    bonesUsed.add(jnt[i * 4]);
                    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
                    if (x < lox) lox = x;
                    if (y < loy) loy = y;
                    if (z < loz) loz = z;
                    if (x > hix) hix = x;
                    if (y > hiy) hiy = y;
                    if (z > hiz) hiz = z;
                }
            }

            // The rigid collapse is only valid for a single-bone proxy — see the class header. A proxy
            // weighted across two bones deforms, so a cached AABB would silently stop matching it.
            if (bonesUsed.size !== 1) {
                throw new Error("GLBRigLoader: hit proxy '" + node.name + "' is weighted to " +
                    bonesUsed.size + " bones. Every proxy must be weighted 1.0 to exactly ONE bone.");
            }

            const bone = gltf.nodes[joints[[...bonesUsed][0]]].name;
            const cx = (lox + hix) / 2, cy = (loy + hiy) / 2, cz = (loz + hiz) / 2;
            const hx = (hix - lox) / 2, hy = (hiy - loy) / 2, hz = (hiz - loz) / 2;

            out.push({
                part: node.name,
                bone,
                group: group[node.name] || "GENERIC",
                cx, cy, cz, hx, hy, hz,
                shape: GLBRigLoader._shape(kinds[node.name], hx, hy, hz)
            });
        }
        return out;
    }

    /**
     * The narrowphase primitive for a part, from its declared KIND plus the AABB measured off the mesh.
     *
     * The kind is never guessed from geometry — the part table declares it, and the file supplies only
     * dimensions and placement. A radius comes from the AABB's smaller horizontal half-extent so a
     * slightly non-square proxy still yields a sane capsule rather than one that bulges past the mesh.
     */
    static _shape(kind, hx, hy, hz) {
        if (!kind || kind === "box") return null; // null => the resolver uses the AABB directly
        const r = Math.min(hx, hz);
        if (kind === "sphere") return { kind: "sphere", r: (hx + hy + hz) / 3 };
        if (kind === "capsule") return { kind: "capsule", r, half: Math.max(0, hy - r) };
        if (kind === "cylinder") return { kind: "cylinder", r, half: hy };
        throw new Error("GLBRigLoader: unknown hit-volume kind '" + kind + "'");
    }

    /**
     * Accessor -> a plain array of numbers. Handles the component types this exporter writes; anything
     * else throws rather than silently misreading a buffer.
     */
    static _reader(gltf, bin) {
        const base = bin.byteOffset || 0;
        const buf = bin.buffer || bin;
        return (accessorIndex, size, asInt) => {
            const acc = gltf.accessors[accessorIndex];
            const view = gltf.bufferViews[acc.bufferView];
            const off = base + (view.byteOffset || 0) + (acc.byteOffset || 0);
            const n = acc.count * size;
            if (asInt) {
                if (acc.componentType === 5121) return new Uint8Array(buf, off, n);
                if (acc.componentType === 5123) return new Uint16Array(buf, off, n);
                if (acc.componentType === 5125) return new Uint32Array(buf, off, n);
                throw new Error("GLBRigLoader: unexpected integer component type " + acc.componentType);
            }
            if (acc.componentType !== 5126) {
                throw new Error("GLBRigLoader: expected FLOAT, got component type " + acc.componentType);
            }
            return new Float32Array(buf, off, n);
        };
    }

    /** Parse a .glb ArrayBuffer into { gltf, bin }, then load it. */
    static loadGLB(arrayBuffer, opts) {
        const view = new DataView(arrayBuffer);
        if (view.getUint32(0, true) !== 0x46546c67) throw new Error("GLBRigLoader: not a .glb (bad magic)");
        const jsonLen = view.getUint32(12, true);
        const json = new TextDecoder().decode(new Uint8Array(arrayBuffer, 20, jsonLen));
        const binLen = view.getUint32(20 + jsonLen, true);
        const bin = new Uint8Array(arrayBuffer, 20 + jsonLen + 8, binLen);
        return GLBRigLoader.load(JSON.parse(json), bin, opts);
    }

    /**
     * Default part -> primitive kind. Read from the CHARACTER DEFINITION rather than duplicated here:
     * this table has to agree with the mesh exactly, and a second hand-maintained copy is precisely how
     * that agreement rots.
     *
     * A game shipping its own character passes `opts.kinds` (and `opts.groups`) instead, which is the
     * seam that keeps this loader generic — nothing else in the file knows what a head is.
     */
    static get KINDS() {
        return typeof ActionFPSCharacterModel !== "undefined" ? ActionFPSCharacterModel.KINDS : {};
    }
}

if (typeof module !== "undefined" && module.exports) module.exports = GLBRigLoader;
