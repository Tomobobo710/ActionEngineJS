//actionengine/physics/actionphysicsobject3D.js

// ---- Render smoothing: spring-follow a dynamic body's drawn transform (render-only, opt-in) ----
// A dynamic body settling/sliding along a surface advances in small per-fixed-step increments; at a high
// render rate those steps read as a per-tick lurch (measured on a contact slide: mean 0.013, max 0.146 —
// up to ~11x the average on some steps). The physics is correct; only the DRAWN motion is lurchy. We don't
// touch the body; we draw a position that chases it via a critically-damped spring-damper, which integrates
// a smoothed velocity every render frame — so a lurchy step barely perturbs the drawn motion (glides, no
// per-tick kinks) while still converging to the body (no drift / rubber-band). Frame-rate correct (uses real
// dt), identical at 60/144/240Hz. Opt-in per object by calling smoothToBody(dt) each render frame; inert otherwise.
const ACTION_RENDER_SMOOTH = {
    ENABLED: true,
    STIFFNESS: 2500,   // spring constant (higher = tighter tracking / less lag; lower = smoother / more lag)
    SNAP_DIST: 3.0,   // gap (units) above which we hard-snap (teleport/large correction) instead of springing
};

class ActionPhysicsObject3D extends RenderableObject {
    constructor(triangles, options = {}) {
        super();
        if (options.isStatic !== undefined) this.isStatic = options.isStatic;

        // If we have an animator, we are likely not static
        this.isStatic = options.isStatic !== undefined ? options.isStatic : true;

        // Support for visual offset relative to physics body
        this.visualOffset = options.visualOffset || new Vector3(0, 0, 0);

        this._originalTriangles = triangles.slice();

        this.isVisible = options && options.isVisible !== undefined ? options.isVisible : true;

        this.triangles = this.isVisible ? this._originalTriangles : [];

        this.originalNormals = [];
        this.originalVerts = [];

        this.calculateBoundingSphere();

        this._originalTriangles.forEach((triangle) => {
            this.originalNormals.push(new Vector3(triangle.normal.x, triangle.normal.y, triangle.normal.z));

            triangle.vertices.forEach((vertex) => {
                this.originalVerts.push(new Vector3(vertex.x, vertex.y, vertex.z));
            });
        });
    }

    /**
     * Toggle visibility of this object
     */
    setVisibility(visible) {
        if (this.isVisible === visible) return;

        this.isVisible = visible;
        this.triangles = visible ? this._originalTriangles : [];
    }

    /**
     * Spring-smooth the drawn pose toward the true body via a critically-damped spring-damper. Call once per
     * RENDER frame with the real frame dt. The physics body is authoritative and untouched (collision exact);
     * this only moves transform.position/rotation. A lurchy per-fixed-step advance barely perturbs the
     * smoothed velocity, so the drawn object glides continuously with no per-tick kinks. Frame-rate
     * independent (uses dt). Writes the transform directly, so it is the sole render-placer for objects that
     * opt in — the draw loop must not also updateVisual() them the same frame.
     */
    smoothToBody(dt) {
        if (!ACTION_RENDER_SMOOTH.ENABLED || !this.body) return;
        const b = this.body.position;
        const d = Math.min(dt || 1 / 60, 1 / 30); // clamp a huge hitch so the spring can't overshoot wildly
        if (!this._sm) { this._sm = { x: b.x, y: b.y, z: b.z, vx: 0, vy: 0, vz: 0 }; }
        const s = this._sm;
        // Hard-snap on a teleport/large-correction-sized gap — don't spring across it.
        const gx = b.x - s.x, gy = b.y - s.y, gz = b.z - s.z;
        if (gx * gx + gy * gy + gz * gz > ACTION_RENDER_SMOOTH.SNAP_DIST * ACTION_RENDER_SMOOTH.SNAP_DIST) {
            s.x = b.x; s.y = b.y; s.z = b.z; s.vx = 0; s.vy = 0; s.vz = 0;
        } else {
            // Critically-damped spring toward the body, solved ANALYTICALLY.
            //
            // This used to integrate semi-implicitly (v += (k*g - c*v)*d; x += v*d). That is only
            // stable while k*d^2 is small, and with STIFFNESS 2500 the overshoot threshold
            // (d ~ 1/sqrt(k) = 0.02s) lands at 50fps: above it the drawn pose tracks the body, below
            // it the spring rings and diverges. Measured at 36fps: median 2.7 units of error, peaks
            // over 10 units, on bodies moving 2.3 m/s — objects drawn metres from where physics
            // actually had them, while the simulation itself was perfectly at rest. That is the
            // "physics goes haywire below 60fps" symptom; the physics was never wrong, the DRAWING
            // was. The old Math.min(dt, 1/30) clamp bounded d at 0.033s, which is still well inside
            // the unstable region, so it never actually prevented this.
            //
            // The closed form of x'' = -k*x - 2*sqrt(k)*x' is x(t) = (A + B*t) * exp(-w*t) with
            // w = sqrt(k). Evaluating it exactly costs one exp() and is unconditionally stable at
            // ANY dt — identical to the old behaviour at 144fps, still correct at 20fps.
            const w = Math.sqrt(ACTION_RENDER_SMOOTH.STIFFNESS); // natural frequency
            const e = Math.exp(-w * d);
            // Per axis: gap g is (current - target); velocity relaxes toward zero as the gap closes.
            const ax = (s.vx + w * gx) * d;
            const ay = (s.vy + w * gy) * d;
            const az = (s.vz + w * gz) * d;
            s.vx = (s.vx - ax * w) * e; s.vy = (s.vy - ay * w) * e; s.vz = (s.vz - az * w) * e;
            s.x = b.x - (gx + ax) * e;  s.y = b.y - (gy + ay) * e;  s.z = b.z - (gz + az) * e;
        }
        this.visualOffset.set(s.x - b.x, s.y - b.y, s.z - b.z); // keep offset consistent for other readers
        this.transform.position.set(s.x, s.y, s.z);
        this.transform.rotation = this.body.rotation; // rotation left raw (position is the visible axis)
        this.triangles = this.isVisible ? this._originalTriangles : [];
    }

    /**
     * Update visual state from physics body. Syncs transform and triangle data. Static geometry and simple
     * dynamic bodies render at the raw body pose here; a body that opts into spring smoothing is drawn by
     * smoothToBody() (which writes the transform directly and is called before this in the frame).
     */
    updateVisual() {
        // If body exists, sync transform from it
        if (this.body) {
            const { x: posX, y: posY, z: posZ } = this.body.position;

            // Early exit if position/rotation haven't changed significantly
            if (this._lastPosition && this._lastRotation) {
                if (
                    Math.abs(this._lastPosition.x - posX) < 0.001 &&
                    Math.abs(this._lastPosition.y - posY) < 0.001 &&
                    Math.abs(this._lastPosition.z - posZ) < 0.001
                ) {
                    const lastQuat = this._lastRotation;
                    const curQuat = this.body.rotation;
                    const dot =
                        lastQuat.x * curQuat.x +
                        lastQuat.y * curQuat.y +
                        lastQuat.z * curQuat.z +
                        lastQuat.w * curQuat.w;

                    if (Math.abs(dot) > 0.9999) {
                        return;
                    }
                }
            }

            // Sync transform from physics body
            this.transform.position.set(
                posX + this.visualOffset.x,
                posY + this.visualOffset.y,
                posZ + this.visualOffset.z
            );
            this.transform.rotation = this.body.rotation;

            if (!this._lastPosition) this._lastPosition = new Vector3();
            this._lastPosition.set(posX, posY, posZ);

            if (!this._lastRotation) this._lastRotation = new PhysicsBackend.Quaternion();
            this._lastRotation.x = this.body.rotation.x;
            this._lastRotation.y = this.body.rotation.y;
            this._lastRotation.z = this.body.rotation.z;
            this._lastRotation.w = this.body.rotation.w;

            // Keep local-space triangles for 3D GPU renderer
            // Respect visibility flag - invisible objects should stay invisible
            this.triangles = this.isVisible ? this._originalTriangles : [];
        }

        // Support for animations
        if (this.animator && this.isVisible) {
            // Force non-static mode if we have an animator
            this.isStatic = false;

            // Update animation (using a rough deltaTime if not provided)
            this.animator.update();

            // Recalculate triangles from skinned model if possible
            // Most POIs/Characters that use GLBLoader will have this.characterModel
            if (this.characterModel && this.characterModel.triangles) {
                // If this is a character, we should probably call getCharacterModelTriangles
                if (this.getCharacterModelTriangles) {
                    this.triangles = this.getCharacterModelTriangles();
                } else {
                    // Simple baked update for static buildings with animations
                    this.triangles = this.characterModel.triangles;
                }
            }
        }
    }

    /**
     * Rotate a vector by a quaternion
     */
    rotateVector(vector, rotation) {
        const v = new PhysicsBackend.Vector3(vector.x, vector.y, vector.z);
        PhysicsBackend.rotateVectorInPlace(rotation, v);
        return new Vector3(v.x, v.y, v.z);
    }

    /**
     * Calculate bounding sphere for frustum culling
     */
    calculateBoundingSphere() {
        if (!this.triangles || this.triangles.length === 0) {
            this.boundingSphereRadius = 20;
            return;
        }

        let maxDistanceSquared = 0;

        for (const triangle of this.triangles) {
            for (const vertex of triangle.vertices) {
                const distSquared = vertex.x * vertex.x + vertex.y * vertex.y + vertex.z * vertex.z;
                if (distSquared > maxDistanceSquared) {
                    maxDistanceSquared = distSquared;
                }
            }
        }

        this.boundingSphereRadius = Math.sqrt(maxDistanceSquared) * 1.1;
    }
}
