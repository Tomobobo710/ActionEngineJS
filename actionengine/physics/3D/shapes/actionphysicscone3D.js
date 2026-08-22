//actionengine/physics/shapes/actionphysicscone3D.js
/**
 * ActionPhysicsCone3D - 3D Cone Physics Object with Single Color System
 *
 * BREAKING CHANGE: Previously used two-color checkerboard pattern (color1, color2).
 * Now uses single color system for consistency with other shapes.
 *
 * @param {number} radius - Cone base radius (default: 0.2)
 * @param {number} height - Cone height (default: 1)
 * @param {number} mass - Physics mass (default: 1)
 * @param {Vector3} initialPosition - Starting position (default: 0,1,0)
 * @param {string} color - Hex color string like "#FF0000" (default: "#FFA500" orange)
 */
class ActionPhysicsCone3D extends ActionPhysicsObject3D {
    constructor(
        radius = 0.2,
        height = 1,
        mass = 1,
        initialPosition = new Vector3(0, 1, 0),
        color = "#FFA500",
        options = {}
    ) {
        // Create visual mesh with triangles using single color system
        const triangles = [];

        // Segments for mesh detail
        const radialSegments = 24;
        const heightSegments = 6;

        // Use single color for all triangles (changed from checkerboard pattern)
        const coneColor = color;

        // Helper function to create vertices
        const createVertex = (theta, heightPercent, radiusPercent) => {
            const currentRadius = radius * (1 - heightPercent) * radiusPercent;
            return new Vector3(
                currentRadius * Math.cos(theta),
                height * (heightPercent - 0.5), // Ranges from -half_height to half_height
                currentRadius * Math.sin(theta)
            );
        };

        // 1. Create Cone Body
        const tip = new Vector3(0, height / 2, 0);
        const base = new Vector3(0, -height / 2, 0);

        // Create cone sides
        for (let y = 0; y < heightSegments; y++) {
            const yBottom = y / heightSegments;
            const yTop = (y + 1) / heightSegments;

            for (let x = 0; x < radialSegments; x++) {
                const theta = (x / radialSegments) * Math.PI * 2;
                const thetaNext = (((x + 1) % radialSegments) / radialSegments) * Math.PI * 2;

                if (y === heightSegments - 1) {
                    // Top segment connects to tip
                    const v1 = createVertex(theta, yBottom, 1);
                    const v2 = createVertex(thetaNext, yBottom, 1);

                    // Correct winding order for outward-facing normal
                    triangles.push(new Triangle(v1, tip, v2, coneColor));
                } else {
                    // Regular segment
                    const v1 = createVertex(theta, yBottom, 1);
                    const v2 = createVertex(thetaNext, yBottom, 1);
                    const v3 = createVertex(thetaNext, yTop, 1);
                    const v4 = createVertex(theta, yTop, 1);

                    // Correct winding order for outward-facing normals
                    triangles.push(new Triangle(v1, v3, v2, coneColor));
                    triangles.push(new Triangle(v1, v4, v3, coneColor));
                }
            }
        }

        // 2. Create Base with correct winding order for downward-facing normal
        for (let x = 0; x < radialSegments; x++) {
            const theta = (x / radialSegments) * Math.PI * 2;
            const thetaNext = (((x + 1) % radialSegments) / radialSegments) * Math.PI * 2;

            const v1 = createVertex(theta, 0, 1);
            const v2 = createVertex(thetaNext, 0, 1);

            triangles.push(new Triangle(v1, v2, base, coneColor));
        }

        // Compute smooth vertex normals for cone sides
        // Keep the tip pointed and base flat
        ActionPhysicsCone3D._computeSmoothVertexNormalsForCone(triangles, heightSegments);

        super(triangles, options);

        // Create physics shape and body - Goblin expects half-height
        const shape = new Goblin.ConeShape(radius, height / 2);
        this.body = new ActionRigidBody3D(shape, mass, options);
        this.body.position = initialPosition;

        this.storeOriginalData();
    }

    static _computeSmoothVertexNormalsForCone(triangles, heightSegments) {
        // Round rather than toFixed, and add 0 to collapse -0 into 0. A revolved surface generates
        // its wrap column at theta=0 and theta=2*PI, and Math.sin(2*PI) is -2.449e-16 rather than 0 —
        // so the two columns differ only in float noise. toFixed(6) formatted those as "0.000000" and
        // "-0.000000": different STRINGS, so they never averaged and left a visible seam.
        const q = (n) => Math.round(n * 1e6) / 1e6 + 0;
        const positionKey = (v) => `${q(v.x)},${q(v.y)},${q(v.z)}`;
        
        // Classify triangles as either "side" or "base/tip"
        // Base triangles all share one center vertex (0, y, 0)
        const isSideTriangle = (triangle) => {
            const hasCenter = triangle.vertices.some(v => Math.abs(v.x) < 0.001 && Math.abs(v.z) < 0.001);
            // If all 3 vertices are at center or the triangle has a center vertex, it's base/tip
            return !hasCenter;
        };

        // Build map of positions to SIDE triangles only
        const positionMap = new Map();
        for (const triangle of triangles) {
            if (!isSideTriangle(triangle)) {
                continue; // Skip base/tip triangles
            }
            for (let v = 0; v < 3; v++) {
                const key = positionKey(triangle.vertices[v]);
                if (!positionMap.has(key)) {
                    positionMap.set(key, []);
                }
                positionMap.get(key).push({ triangle, vertexIndex: v });
            }
        }

        // Average normals from side triangles only
        for (const [key, vertexRefs] of positionMap) {
            if (vertexRefs.length < 2) {
                // Only one side triangle uses this vertex, no smoothing needed
                continue;
            }

            const avgNormal = new Vector3(0, 0, 0);
            for (const ref of vertexRefs) {
                avgNormal.x += ref.triangle.normal.x;
                avgNormal.y += ref.triangle.normal.y;
                avgNormal.z += ref.triangle.normal.z;
            }
            avgNormal.normalizeInPlace();

            // Store averaged normal
            for (const ref of vertexRefs) {
                if (!ref.triangle.vertexNormals) {
                    ref.triangle.vertexNormals = [];
                }
                ref.triangle.vertexNormals[ref.vertexIndex] = new Vector3(avgNormal.x, avgNormal.y, avgNormal.z);
            }
        }

        // Fill missing normals with face normals
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
