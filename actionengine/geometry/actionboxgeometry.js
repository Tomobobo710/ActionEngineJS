// actionengine/geometry/actionboxgeometry.js
/**
 * ActionBoxGeometry - axis-aligned box primitives shared by any game: build box meshes and
 * test a ray against a box. Game-agnostic mechanism (procedural avatars, weapon/FX meshes,
 * cheap hitbox raycasts all want these), so it lives in the engine rather than in game code.
 */
class ActionBoxGeometry {
    /**
     * Push the 12 outward-facing triangles of an axis-aligned box (center cx,cy,cz; size w,h,d)
     * into `tris`. Single winding convention so every procedural box mesh stays consistent.
     */
    static pushTris(tris, cx, cy, cz, w, h, d, color) {
        const hw = w / 2,
            hh = h / 2,
            hd = d / 2;
        const p = (x, y, z) => new Vector3(cx + x, cy + y, cz + z);
        const face = (a, b, c, e) => {
            tris.push(new Triangle(a, c, b, color));
            tris.push(new Triangle(a, e, c, color));
        };
        face(p(hw, hh, hd), p(hw, -hh, hd), p(-hw, -hh, hd), p(-hw, hh, hd)); // +z
        face(p(-hw, hh, -hd), p(-hw, -hh, -hd), p(hw, -hh, -hd), p(hw, hh, -hd)); // -z
        face(p(hw, hh, -hd), p(hw, hh, hd), p(-hw, hh, hd), p(-hw, hh, -hd)); // +y
        face(p(hw, -hh, hd), p(hw, -hh, -hd), p(-hw, -hh, -hd), p(-hw, -hh, hd)); // -y
        face(p(hw, hh, -hd), p(hw, -hh, -hd), p(hw, -hh, hd), p(hw, hh, hd)); // +x
        face(p(-hw, hh, hd), p(-hw, -hh, hd), p(-hw, -hh, -hd), p(-hw, hh, -hd)); // -x
    }

    /** Build a single-box RenderableObject in local space (centered at origin). For FX/props. */
    static build(w, h, d, color) {
        const tris = [];
        ActionBoxGeometry.pushTris(tris, 0, 0, 0, w, h, d, color);
        const obj = new RenderableObject();
        obj.triangles = tris;
        obj.isStatic = false;
        return obj;
    }

    /**
     * Ray vs axis-aligned box (slab method). Origin (ox,oy,oz), dir (dx,dy,dz) need not be unit;
     * box centered at (cx,cy,cz) with half-extents (hx,hy,hz). Returns the entry distance along
     * the ray, or null if the forward ray doesn't intersect.
     */
    static rayAABB(ox, oy, oz, dx, dy, dz, cx, cy, cz, hx, hy, hz) {
        const o = [ox, oy, oz];
        const d = [dx, dy, dz];
        const lo = [cx - hx, cy - hy, cz - hz];
        const hi = [cx + hx, cy + hy, cz + hz];
        let tmin = 0;
        let tmax = Infinity;
        for (let i = 0; i < 3; i++) {
            if (Math.abs(d[i]) < 1e-9) {
                if (o[i] < lo[i] || o[i] > hi[i]) return null; // parallel and outside the slab
            } else {
                let t1 = (lo[i] - o[i]) / d[i];
                let t2 = (hi[i] - o[i]) / d[i];
                if (t1 > t2) {
                    const tmp = t1;
                    t1 = t2;
                    t2 = tmp;
                }
                if (t1 > tmin) tmin = t1;
                if (t2 < tmax) tmax = t2;
                if (tmin > tmax) return null;
            }
        }
        return tmin >= 0 ? tmin : tmax >= 0 ? 0 : null;
    }
}
