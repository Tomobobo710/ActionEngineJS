// actionengine/math/geometry/geometrybuilder.js
// Smart triangle winding system that automatically determines correct triangle orientation
// using configurable reference points

class GeometryBuilder {
    constructor(referencePoint = {x: 0, y: 0, z: 0}) {
        this.referencePoint = referencePoint;
    }

    /**
     * Set the reference point used for winding calculations
     * @param {Object} point - Reference point {x, y, z}
     */
    setReferencePoint(point) {
        this.referencePoint = point;
    }

    /**
     * Triangle creation that uses vertex positions to determine correct winding
     * AND then allows an additional forced flip afterwards if requested
     * If doubleSided is set true then we make an additional triangle and point the normal in the opposite direction
     */
    createTriangle(indices, positions, a, b, c, forceFlip = false, doubleSided = false) {
        // Get vertex positions
        const ax = positions[a * 3],
            ay = positions[a * 3 + 1],
            az = positions[a * 3 + 2];
        const bx = positions[b * 3],
            by = positions[b * 3 + 1],
            bz = positions[b * 3 + 2];
        const cx = positions[c * 3],
            cy = positions[c * 3 + 1],
            cz = positions[c * 3 + 2];

        // Calculate face normal using cross product
        const ux = bx - ax,
            uy = by - ay,
            uz = bz - az;
        const vx = cx - ax,
            vy = cy - ay,
            vz = cz - az;
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;

        // Calculate centroid
        const centroidX = (ax + bx + cx) / 3;
        const centroidY = (ay + by + cy) / 3;
        const centroidZ = (az + bz + cz) / 3;

        // Vector from reference point to centroid 
        const toCentroidX = centroidX - this.referencePoint.x;
        const toCentroidY = centroidY - this.referencePoint.y;
        const toCentroidZ = centroidZ - this.referencePoint.z;

        // Determine if normal points away from reference point
        const dotProduct = nx * toCentroidX + ny * toCentroidY + nz * toCentroidZ;

        // Add epsilon tolerance to handle ambiguous cases
        const epsilon = 1;
        let finalDotProduct = dotProduct;

        if (Math.abs(dotProduct) < epsilon) {
            // Too close to tell - nudge in the direction it was already leaning
            finalDotProduct = dotProduct >= 0 ? epsilon : -epsilon;
        }

        // STEP 1: First determine winding based on reference point calculations
        let v1, v2, v3;
        if (finalDotProduct >= 0) {
            v1 = a;
            v2 = b;
            v3 = c;
        } else {
            v1 = a;
            v2 = c;
            v3 = b;
        }

        // STEP 2: AFTER reference-based calculation, apply forceFlip if requested
        if (forceFlip) {
            // Swap v2 and v3 to flip the triangle
            const temp = v2;
            v2 = v3;
            v3 = temp;
        }

        // Add the triangle with final winding
        indices.push(v1, v2, v3);

        // If double-sided, add a second triangle with opposite winding
        if (doubleSided) {
            indices.push(v1, v3, v2);
        }
    }

    /**
     * Quad helper method
     */
    createQuad(indices, positions, a, b, c, d, forceFlip = false, doubleSided = false) {
        this.createTriangle(indices, positions, a, b, c, forceFlip, doubleSided);
        this.createTriangle(indices, positions, a, c, d, forceFlip, doubleSided);
    }

    /**
     * Convert GeometryBuilder output to ActionEngine physics object
     * This bridges the gap between GeometryBuilder and ActionEngine's physics system
     * @param {Object} physicsWorld - ActionEngine physics world to add object to
     * @param {Array} vertices - Flat vertex array [x,y,z, x,y,z, ...]
     * @param {Array} normals - Vertex normals (currently unused but kept for future)
     * @param {Array} colors - Vertex colors [r,g,b, r,g,b, ...] 
     * @param {Array} indices - Triangle indices [i1,i2,i3, ...]
     * @param {number} mass - Physics mass (0 = static)
     * @param {Vector3} position - World position
     * @returns {ActionPhysicsMesh3D} - Ready-to-use physics object
     */
    createPhysicsObject(physicsWorld, vertices, normals, colors, indices, mass, position) {
        // Convert flat vertex array to Vector3 array
        const vector3Vertices = [];
        for (let i = 0; i < vertices.length; i += 3) {
            vector3Vertices.push(new Vector3(vertices[i], vertices[i+1], vertices[i+2]));
        }
        
        // Convert colors to hex strings for triangles
        const triangleColors = [];
        for (let i = 0; i < indices.length; i += 3) {
            // Use first vertex color for the triangle
            const vertexIndex = indices[i];
            const r = Math.round(colors[vertexIndex * 3] * 255);
            const g = Math.round(colors[vertexIndex * 3 + 1] * 255);
            const b = Math.round(colors[vertexIndex * 3 + 2] * 255);
            const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            triangleColors.push(color);
        }
        
        // Use ActionEngine's proper mesh physics class
        const physicsObject = new ActionPhysicsMesh3D(
            physicsWorld,
            vector3Vertices,
            indices,
            mass,
            position,
            triangleColors
        );
        
        // Add to physics world
        physicsWorld.addObject(physicsObject);
        return physicsObject;
    }

    // Static methods for backward compatibility with existing code that uses GeometryBuilder.createTriangle()
    static createTriangle(indices, positions, a, b, c, forceFlip = false, doubleSided = false) {
        const builder = new GeometryBuilder();
        return builder.createTriangle(indices, positions, a, b, c, forceFlip, doubleSided);
    }

    static createQuad(indices, positions, a, b, c, d, forceFlip = false, doubleSided = false) {
        const builder = new GeometryBuilder();
        return builder.createQuad(indices, positions, a, b, c, d, forceFlip, doubleSided);
    }
}