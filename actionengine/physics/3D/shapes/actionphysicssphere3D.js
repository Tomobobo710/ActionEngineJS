//actionengine/physics/shapes/actionphysicssphere3D.js
/**
 * ActionPhysicsSphere3D - 3D Sphere Physics Object with Single Color System
 *
 * BREAKING CHANGE: Previously used black/white checkerboard pattern.
 * Now uses single color system for consistent developer experience.
 *
 * @param {number} radius - Sphere radius (default: 0.5)
 * @param {number} mass - Physics mass (default: 1)
 * @param {Vector3} initialPosition - Starting position (default: 0,5,0)
 * @param {string} color - Hex color string like "#FF0000" (default: "#FFFFFF" white)
 */
class ActionPhysicsSphere3D extends ActionPhysicsObject3D {
    constructor(radius = 0.5, mass = 1, initialPosition = new Vector3(0, 5, 0), color = "#FFFFFF", options = {}) {
        // Visual mesh creation with single color system
        const segments = 32;
        const triangles = [];

        // All triangles use the same color (changed from checkerboard pattern)
        const sphereColor = color;

        const createVertex = (phi, theta) =>
            new Vector3(
                radius * Math.sin(phi) * Math.cos(theta),
                radius * Math.cos(phi),
                radius * Math.sin(phi) * Math.sin(theta)
            );

        // Sphere segments generation
        for (let lat = 0; lat <= segments; lat++) {
            const phi = (lat / segments) * Math.PI;
            const nextPhi = ((lat + 1) / segments) * Math.PI;
            for (let lon = 0; lon < segments; lon++) {
                const theta = (lon / segments) * 2 * Math.PI;
                const nextTheta = ((lon + 1) / segments) * 2 * Math.PI;

                if (lat === 0) {
                    triangles.push(
                        new Triangle(
                            new Vector3(0, radius, 0),
                            createVertex(Math.PI / segments, nextTheta),
                            createVertex(Math.PI / segments, theta),
                            sphereColor
                        )
                    );
                } else if (lat === segments - 1) {
                    triangles.push(
                        new Triangle(
                            new Vector3(0, -radius, 0),
                            createVertex(Math.PI - Math.PI / segments, theta),
                            createVertex(Math.PI - Math.PI / segments, nextTheta),
                            sphereColor
                        )
                    );
                } else {
                    const v1 = createVertex(phi, theta);
                    const v2 = createVertex(nextPhi, theta);
                    const v3 = createVertex(nextPhi, nextTheta);
                    const v4 = createVertex(phi, nextTheta);
                    triangles.push(new Triangle(v1, v3, v2, sphereColor));
                    triangles.push(new Triangle(v1, v4, v3, sphereColor));
                }
            }
        }

        // Compute smooth vertex normals for the sphere before passing to parent
        ActionPhysicsSphere3D._computeSmoothVertexNormalsForSphere(triangles);

        super(triangles, options);

        const shape = new PhysicsBackend.SphereShape(radius);
        this.body = new ActionRigidBody3D(shape, mass, options);
        this.body.position = initialPosition;

        // Store original data for visual updates
        this.originalNormals = [];
        this.originalVerts = [];

        this.triangles.forEach((triangle) => {
            this.originalNormals.push(new Vector3(triangle.normal.x, triangle.normal.y, triangle.normal.z));

            triangle.vertices.forEach((vertex) => {
                this.originalVerts.push(new Vector3(vertex.x, vertex.y, vertex.z));
            });
        });
    }

    static _computeSmoothVertexNormalsForSphere(triangles) {
        // Round rather than toFixed, and add 0 to collapse -0 into 0.
        //
        // This is what closes the SEAM. A UV sphere's wrap column is generated at theta=0 and
        // theta=2*PI, and `Math.sin(2*PI)` is -2.449e-16 rather than 0 — so the two columns sit at
        // positions that differ only in float noise. `toFixed(6)` formatted those as "0.000000" and
        // "-0.000000": different STRINGS, so the columns hashed to different keys, never got averaged,
        // and every sphere in the engine rendered with a visible crease down one side.
        const q = (n) => Math.round(n * 1e6) / 1e6 + 0;
        const positionKey = (v) => `${q(v.x)},${q(v.y)},${q(v.z)}`;
        
        // Build map of positions to triangles that share them
        const positionMap = new Map();
        for (const triangle of triangles) {
            for (let v = 0; v < 3; v++) {
                const key = positionKey(triangle.vertices[v]);
                if (!positionMap.has(key)) {
                    positionMap.set(key, []);
                }
                positionMap.get(key).push({ triangle, vertexIndex: v });
            }
        }

        // Average normals at each shared vertex position
        for (const [key, vertexRefs] of positionMap) {
            const avgNormal = new Vector3(0, 0, 0);
            for (const ref of vertexRefs) {
                avgNormal.x += ref.triangle.normal.x;
                avgNormal.y += ref.triangle.normal.y;
                avgNormal.z += ref.triangle.normal.z;
            }
            avgNormal.normalizeInPlace();

            // Assign smoothed normal to each vertex
            for (const ref of vertexRefs) {
                if (!ref.triangle.vertexNormals) {
                    ref.triangle.vertexNormals = [];
                }
                ref.triangle.vertexNormals[ref.vertexIndex] = new Vector3(avgNormal.x, avgNormal.y, avgNormal.z);
            }
        }

        // Fill in any missing vertex normals
        for (const triangle of triangles) {
            if (!triangle.vertexNormals) {
                triangle.vertexNormals = [];
            }
            for (let v = 0; v < 3; v++) {
                if (!triangle.vertexNormals[v]) {
                    triangle.vertexNormals[v] = new Vector3(triangle.normal.x, triangle.normal.y, triangle.normal.z);
                }
            }
        }
    }
}
