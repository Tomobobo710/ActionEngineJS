//actionengine/physics/shapes/actionphysicsmesh3D.js
class ActionPhysicsMesh3D extends ActionPhysicsObject3D {
    constructor(
        vertices, // Array of Vector3 positions
        indices, // Array of indices forming triangles (groups of 3)
        mass = 1, // Default to dynamic
        initialPosition = new Vector3(0, 0, 0),
        colors = null, // Optional array of colors for each triangle
        options = {}
    ) {
        // RECENTER around the vertex centroid before anything else.
        //
        // Goblin.RigidBody.position is the body's CENTER OF MASS / rotation pivot — but most authored
        // props (GeometryBuilder models, GLB imports) have their local origin at the base (y=0), for
        // placement convenience, not at their geometric center. Feeding those raw vertices straight
        // into MeshShape makes the physics body rotate around a point that isn't its true mass center.
        // That eccentricity introduces a small but persistent torque on every rotation step, which
        // manifests as a slow directional rock that eventually tips a resting body upright
        // ("tombstoning") — confirmed by isolated testing against stock, unmodified Goblin: an
        // off-center box tombstones every time, an identical but centroid-centered box never does.
        //
        // Fix: compute the centroid once, shift ALL vertices (both collision and render) by -centroid
        // so the body's local origin becomes its true center of mass, then place the body at
        // initialPosition + centroid so it still spawns in the same world location. Collision and
        // render geometry are shifted by the same amount, so they stay perfectly aligned through any
        // rotation — no runtime per-frame offset needed.
        let cx = 0, cy = 0, cz = 0;
        const n = vertices.length;
        for (let i = 0; i < n; i++) { cx += vertices[i].x; cy += vertices[i].y; cz += vertices[i].z; }
        if (n > 0) { cx /= n; cy /= n; cz /= n; }
        const centeredVertices = vertices.map((v) => new Vector3(v.x - cx, v.y - cy, v.z - cz));

        // Create triangles from vertices and indices
        const triangles = [];

        // Process indices in groups of 3 to form triangles
        for (let i = 0; i < indices.length; i += 3) {
            const v1 = centeredVertices[indices[i]].clone();
            const v2 = centeredVertices[indices[i + 1]].clone();
            const v3 = centeredVertices[indices[i + 2]].clone();

            // Determine color for this triangle
            let color = "#AAAAAA"; // Default gray
            if (colors && colors[Math.floor(i / 3)]) {
                color = colors[Math.floor(i / 3)];
            } else if (colors && colors.length === 1) {
                color = colors[0];
            }

            triangles.push(new Triangle(v1, v2, v3, color));
        }

        super(triangles, options);

        // Convert (centered) vertices to Goblin.Vector3 for the physics engine
        const goblinVertices = centeredVertices.map((v) => new PhysicsBackend.Vector3(v.x, v.y, v.z));

        // Create physics shape and body. The shape stays a TRUE concave MeshShape — collision is
        // unchanged and fully concave.
        const shape = new PhysicsBackend.MeshShape(goblinVertices, indices);
        this.body = new ActionRigidBody3D(shape, mass, options);
        this.body.position = new Vector3(initialPosition.x + cx, initialPosition.y + cy, initialPosition.z + cz);

        // INERTIA OVERRIDE for dynamic meshes (collision shape is untouched — still the concave mesh).
        //
        // Goblin's MeshShape derives its inertia tensor from a divergence-theorem volume integral that
        // assumes ONE closed, consistently-wound, non-self-overlapping solid. GeometryBuilder models are
        // vertex soups: several overlapping boxes plus flat / double-sided sheets merged into one buffer.
        // For that input the integral is not a valid rigid body and routinely returns a NEGATIVE moment
        // of inertia. A negative moment of inertia is physically impossible — contact torque accelerates
        // spin the WRONG way and the constraint solver lowers "energy" by spinning faster every contact,
        // so the body launches and spins without bound. (This is why dynamic GeometryBuilder props went
        // haywire after the world was rescaled: the rescale tipped already-marginal integrals negative.)
        //
        // Fix: keep the concave mesh for COLLISION, but compute the INERTIA from the mesh's actual
        // vertices treated as equal point masses about their centroid. This respects the true shape
        // (anisotropic — a tall prop resists tumbling more than spinning about its long axis), needs no
        // closed/consistent topology, and is guaranteed positive-definite. Static bodies (mass 0 /
        // Infinity) carry no inertia, so only dynamic bodies are adjusted.
        if (mass !== 0 && mass !== Infinity && isFinite(mass)) {
            this._applyPointCloudInertia(goblinVertices, mass);
        }

        this.storeOriginalData();
    }

    /**
     * Replace the body's inertia tensor with the inertia of the mesh's vertices treated as equal
     * point masses about their centroid. Robust for arbitrary/concave/soup geometry where Goblin's
     * closed-solid integral produces an invalid (often negative) tensor. Collision shape is unaffected.
     * @param {Array<Goblin.Vector3>} verts - the mesh vertices, in body-local space
     * @param {number} mass - total body mass
     * @private
     */
    _applyPointCloudInertia(verts, mass) {
        const n = verts.length;
        if (n === 0) return;

        // Centroid of the vertex set.
        let cx = 0, cy = 0, cz = 0;
        for (let i = 0; i < n; i++) { cx += verts[i].x; cy += verts[i].y; cz += verts[i].z; }
        cx /= n; cy /= n; cz /= n;

        // Inertia tensor of equal point masses about the centroid.
        const pm = mass / n;
        let Ixx = 0, Iyy = 0, Izz = 0, Ixy = 0, Ixz = 0, Iyz = 0;
        for (let i = 0; i < n; i++) {
            const x = verts[i].x - cx, y = verts[i].y - cy, z = verts[i].z - cz;
            Ixx += pm * (y * y + z * z);
            Iyy += pm * (x * x + z * z);
            Izz += pm * (x * x + y * y);
            Ixy -= pm * x * y;
            Ixz -= pm * x * z;
            Iyz -= pm * y * z;
        }

        const body = this.body._body;
        const I = body.inertiaTensor;
        I.e00 = Ixx; I.e01 = Ixy; I.e02 = Ixz;
        I.e10 = Ixy; I.e11 = Iyy; I.e12 = Iyz;
        I.e20 = Ixz; I.e21 = Iyz; I.e22 = Izz;
        I.invertInto(body.inverseInertiaTensor);
        // Refresh the world-frame inverse inertia so the change takes effect immediately.
        if (body.updateDerived) body.updateDerived();
    }

    storeOriginalData() {
        this.originalNormals = [];
        this.originalVerts = [];

        this.triangles.forEach((triangle) => {
            this.originalNormals.push(new Vector3(triangle.normal.x, triangle.normal.y, triangle.normal.z));

            triangle.vertices.forEach((vertex) => {
                this.originalVerts.push(new Vector3(vertex.x, vertex.y, vertex.z));
            });
        });
    }
}
