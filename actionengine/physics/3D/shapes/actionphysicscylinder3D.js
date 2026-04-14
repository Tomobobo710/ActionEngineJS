//actionengine/physics/shapes/actionphysicscylinder3D.js
/**
 * ActionPhysicsCylinder3D - 3D Cylinder Physics Object with Single Color System
 *
 * BREAKING CHANGE: Previously used two-color checkerboard pattern (color1, color2).
 * Now uses single color system for consistency with other shapes.
 *
 * @param {number} radius - Cylinder radius (default: 2)
 * @param {number} height - Cylinder height (default: 10)
 * @param {number} mass - Physics mass (default: 1)
 * @param {Vector3} initialPosition - Starting position (default: 0,10,0)
 * @param {string} color - Hex color string like "#FF0000" (default: "#FF0000" red)
 */
class ActionPhysicsCylinder3D extends ActionPhysicsObject3D {
    constructor(
        radius = 2,
        height = 10,
        mass = 1,
        initialPosition = new Vector3(0, 10, 0),
        color = "#FF0000"
    ) {
        // Create visual mesh with triangles using single color system
        const triangles = [];

        // Segments for mesh detail
        const radialSegments = 24;
        const heightSegments = 4;

        // Helper function to create cylinder vertices
        const createVertex = (theta, y, radius) => {
            return new Vector3(radius * Math.cos(theta), y, radius * Math.sin(theta));
        };

        // Use single color for all triangles
        const cylinderColor = color;

        const halfHeight = height / 2;

        // 1. Create Cylinder Body
        for (let y = 0; y < heightSegments; y++) {
            const yBottom = -halfHeight + (y / heightSegments) * height;
            const yTop = -halfHeight + ((y + 1) / heightSegments) * height;

            for (let x = 0; x < radialSegments; x++) {
                const theta = (x / radialSegments) * Math.PI * 2;
                const thetaNext = (((x + 1) % radialSegments) / radialSegments) * Math.PI * 2;

                // Create four vertices for this quad segment
                const v1 = createVertex(theta, yBottom, radius);
                const v2 = createVertex(thetaNext, yBottom, radius);
                const v3 = createVertex(thetaNext, yTop, radius);
                const v4 = createVertex(theta, yTop, radius);

                // Create two triangles with outward-facing normals
                triangles.push(new Triangle(v1, v3, v2, cylinderColor));
                triangles.push(new Triangle(v1, v4, v3, cylinderColor));
            }
        }

        // 2. Create Top Cap
        const topCenter = new Vector3(0, halfHeight, 0);
        for (let x = 0; x < radialSegments; x++) {
            const theta = (x / radialSegments) * Math.PI * 2;
            const thetaNext = (((x + 1) % radialSegments) / radialSegments) * Math.PI * 2;

            const v1 = createVertex(theta, halfHeight, radius);
            const v2 = createVertex(thetaNext, halfHeight, radius);

            // Create triangle with upward-facing normal
            triangles.push(new Triangle(v1, topCenter, v2, cylinderColor));
        }

        // 3. Create Bottom Cap
        const bottomCenter = new Vector3(0, -halfHeight, 0);
        for (let x = 0; x < radialSegments; x++) {
            const theta = (x / radialSegments) * Math.PI * 2;
            const thetaNext = (((x + 1) % radialSegments) / radialSegments) * Math.PI * 2;

            const v1 = createVertex(theta, -halfHeight, radius);
            const v2 = createVertex(thetaNext, -halfHeight, radius);

            // Create triangle with downward-facing normal
            triangles.push(new Triangle(v1, v2, bottomCenter, cylinderColor));
        }

        // Compute smooth vertex normals for cylinder sides
        // Keep the flat caps hard-edged
        ActionPhysicsCylinder3D._computeSmoothVertexNormalsForCylinder(triangles, radialSegments, halfHeight);

        super(triangles);

        // Create physics shape and body
        const shape = new Goblin.CylinderShape(radius, halfHeight);
        this.body = new ActionRigidBody3D(shape, mass);
        this.body.position = initialPosition;

        this.storeOriginalData();
    }

    static _computeSmoothVertexNormalsForCylinder(triangles, radialSegments, halfHeight) {
        const positionKey = (v) => `${v.x.toFixed(6)},${v.y.toFixed(6)},${v.z.toFixed(6)}`;
        
        // Classify triangles as either "side" or "cap"
        // Cap triangles all share one center vertex (0, ±halfHeight, 0)
        const isSideTriangle = (triangle) => {
            const hasCenter = triangle.vertices.some(v => Math.abs(v.x) < 0.001 && Math.abs(v.z) < 0.001);
            // If the triangle has a center vertex, it's a cap
            return !hasCenter;
        };

        // Build map of positions to SIDE triangles only
        const positionMap = new Map();
        for (const triangle of triangles) {
            if (!isSideTriangle(triangle)) {
                continue; // Skip cap triangles
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
