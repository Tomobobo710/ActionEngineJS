// WebGL geometry builder for creating 3D shapes
import { WebGLUtils } from './webglUtils.js';

class WebGLGeometryBuilder {
    constructor(gl) {
        this.gl = gl;
        this.vertices = [];
        this.normals = [];
        this.colors = [];
        this.indices = [];
    }

    // Static helper methods for basic primitive creation
    static createTriangle(indices, positions, a, b, c, forceFlip = false, doubleSided = false) {
        // Get vertex positions
        const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
        const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
        const cx = positions[c * 3], cy = positions[c * 3 + 1], cz = positions[c * 3 + 2];

        // Calculate face normal using cross product
        const ux = bx - ax, uy = by - ay, uz = bz - az;
        const vx = cx - ax, vy = cy - ay, vz = cz - az;
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;

        // Calculate centroid
        const centroidX = (ax + bx + cx) / 3;
        const centroidY = (ay + by + cy) / 3;
        const centroidZ = (az + bz + cz) / 3;

        // Determine if normal points away from origin (0,0,0)
        const dotProduct = nx * centroidX + ny * centroidY + nz * centroidZ;

        // STEP 1: First determine winding based on origin calculations
        let v1, v2, v3;
        if (dotProduct === 0 || dotProduct > 0) {
            v1 = a; v2 = b; v3 = c;
        } else {
            v1 = a; v2 = c; v3 = b;
        }

        // STEP 2: AFTER origin-based calculation, apply forceFlip if requested
        if (forceFlip) {
            // Swap v2 and v3 to flip the triangle
            const temp = v2; v2 = v3; v3 = temp;
        }

        // Add the triangle with final winding
        indices.push(v1, v2, v3);

        // If double-sided, add a second triangle with opposite winding
        if (doubleSided) {
            indices.push(v1, v3, v2);
        }
    }

    // Quad helper method
    static createQuad(indices, positions, a, b, c, d, forceFlip = false, doubleSided = false) {
        this.createTriangle(indices, positions, a, b, c, forceFlip, doubleSided);
        this.createTriangle(indices, positions, a, c, d, forceFlip, doubleSided);
    }

    // Instance methods for building geometry
    addBox(x, y, z, width, height, depth, color) {
        const baseIndex = this.vertices.length / 3;

        const halfWidth = width / 2;
        const halfHeight = height / 2;
        const halfDepth = depth / 2;

        // Calculate actual min/max coordinates for centering
        const minX = x - halfWidth;
        const maxX = x + halfWidth;
        const minY = y - halfHeight;
        const maxY = y + halfHeight;
        const minZ = z - halfDepth;
        const maxZ = z + halfDepth;

        // Eight corners of box (vertices stay the same)
        const vertices = [
            // Bottom face
            minX, minY, minZ,
            maxX, minY, minZ,
            maxX, minY, maxZ,
            minX, minY, maxZ,

            // Top face
            minX, maxY, minZ,
            maxX, maxY, minZ,
            maxX, maxY, maxZ,
            minX, maxY, maxZ
        ];

        // Add vertices
        for (const vertex of vertices) {
            this.vertices.push(vertex);
        }

        // Add normals
        // Bottom face normals
        for (let i = 0; i < 4; i++) {
            this.normals.push(0, -1, 0);
        }
        // Top face normals
        for (let i = 0; i < 4; i++) {
            this.normals.push(0, 1, 0);
        }

        // Add colors
        for (let i = 0; i < 8; i++) {
            this.colors.push(...color);
        }

        // Add indices for all six faces with consistent winding and make all faces double-sided
        // Bottom face
        WebGLGeometryBuilder.createQuad(this.indices, this.vertices, baseIndex, baseIndex + 1, baseIndex + 2, baseIndex + 3, true, true);
        // Top face
        WebGLGeometryBuilder.createQuad(this.indices, this.vertices, baseIndex + 4, baseIndex + 5, baseIndex + 6, baseIndex + 7, false, true);
        // Front face
        WebGLGeometryBuilder.createQuad(this.indices, this.vertices, baseIndex, baseIndex + 1, baseIndex + 5, baseIndex + 4, false, true);
        // Back face
        WebGLGeometryBuilder.createQuad(this.indices, this.vertices, baseIndex + 2, baseIndex + 3, baseIndex + 7, baseIndex + 6, false, true);
        // Left face
        WebGLGeometryBuilder.createQuad(this.indices, this.vertices, baseIndex, baseIndex + 3, baseIndex + 7, baseIndex + 4, false, true);
        // Right face
        WebGLGeometryBuilder.createQuad(this.indices, this.vertices, baseIndex + 1, baseIndex + 2, baseIndex + 6, baseIndex + 5, false, true);
    }

    addCone(x, y, z, radius, height, segments, color) {
        const baseIndex = this.vertices.length / 3;
        const halfHeight = height / 2;

        // Add apex vertex
        this.vertices.push(x, y + halfHeight, z);
        this.normals.push(0, 1, 0); // Pointing up
        this.colors.push(...color);

        // Add base vertices and normals
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const vx = x + radius * Math.cos(angle);
            const vz = z + radius * Math.sin(angle);
            this.vertices.push(vx, y - halfHeight, vz);
            this.normals.push(0, -1, 0); // Pointing down for base
            this.colors.push(...color);
        }

        // Add indices for cone sides
        for (let i = 0; i < segments; i++) {
            const p1 = baseIndex; // Apex
            const p2 = baseIndex + 1 + i;
            const p3 = baseIndex + 1 + ((i + 1) % segments);
            WebGLGeometryBuilder.createTriangle(this.indices, this.vertices, p1, p2, p3, false, true);
        }

        // Add indices for base
        for (let i = 0; i < segments - 2; i++) {
            const p1 = baseIndex + 1;
            const p2 = baseIndex + 1 + i + 1;
            const p3 = baseIndex + 1 + i + 2;
            WebGLGeometryBuilder.createTriangle(this.indices, this.vertices, p1, p3, p2, false, true); // Flipped for correct winding
        }
    }

    addSphere(x, y, z, radius, segments, rings, color) {
        const baseIndex = this.vertices.length / 3;

        for (let i = 0; i <= rings; i++) {
            const latAngle = (i * Math.PI) / rings;
            const sinLat = Math.sin(latAngle);
            const cosLat = Math.cos(latAngle);

            for (let j = 0; j <= segments; j++) {
                const lonAngle = (j * 2 * Math.PI) / segments;
                const sinLon = Math.sin(lonAngle);
                const cosLon = Math.cos(lonAngle);

                const vx = x + radius * cosLon * sinLat;
                const vy = y + radius * cosLat;
                const vz = z + radius * sinLon * sinLat;

                this.vertices.push(vx, vy, vz);
                const normal = window.Vector3 ?
                    new window.Vector3(vx - x, vy - y, vz - z).normalize() :
                    { x: vx - x, y: vy - y, z: vz - z };
                this.normals.push(normal.x, normal.y, normal.z);
                this.colors.push(...color);

                if (i < rings && j < segments) {
                    const p1 = baseIndex + i * (segments + 1) + j;
                    const p2 = baseIndex + i * (segments + 1) + j + 1;
                    const p3 = baseIndex + (i + 1) * (segments + 1) + j;
                    const p4 = baseIndex + (i + 1) * (segments + 1) + j + 1;

                    WebGLGeometryBuilder.createQuad(this.indices, this.vertices, p1, p2, p4, p3, false, true);
                }
            }
        }
    }

    addFloor(x, y, z, width, depth, color) {
        const baseIndex = this.vertices.length / 3;

        // Add vertices for the floor
        this.vertices.push(
            x, y, z, // Bottom-left
            x + width, y, z, // Bottom-right
            x + width, y, z + depth, // Top-right
            x, y, z + depth // Top-left
        );

        // Add normals (all pointing up)
        for (let i = 0; i < 4; i++) {
            this.normals.push(0, 1, 0);
        }

        // Add colors
        for (let i = 0; i < 4; i++) {
            this.colors.push(...color);
        }

        // Add indices for the quad
        WebGLGeometryBuilder.createQuad(this.indices, this.vertices, baseIndex, baseIndex + 1, baseIndex + 2, baseIndex + 3, true);
    }

    addWall(x1, y1, z1, x2, y2, z2, height, color) {
        const baseIndex = this.vertices.length / 3;

        // Calculate wall direction and normal
        const dirX = x2 - x1;
        const dirZ = z2 - z1;
        const length = Math.sqrt(dirX * dirX + dirZ * dirZ);
        const normalX = dirZ / length;
        const normalZ = -dirX / length;

        // Add vertices
        this.vertices.push(
            x1, y1, z1, // Bottom-left
            x2, y2, z2, // Bottom-right
            x2, y2 + height, z2, // Top-right
            x1, y1 + height, z1 // Top-left
        );

        // Add normals and colors
        for (let i = 0; i < 4; i++) {
            this.normals.push(normalX, 0, normalZ);
            this.colors.push(...color);
        }

        // Add indices (double-sided)
        WebGLGeometryBuilder.createQuad(this.indices, this.vertices, baseIndex, baseIndex + 1, baseIndex + 2, baseIndex + 3, false, true);
    }

    // Method to build and return mesh data
    build() {
        return {
            vertices: this.vertices,
            normals: this.normals,
            colors: this.colors,
            indices: this.indices,
            vertexBuffer: WebGLUtils.createBuffer(this.gl, this.vertices),
            normalBuffer: WebGLUtils.createBuffer(this.gl, this.normals),
            colorBuffer: WebGLUtils.createBuffer(this.gl, this.colors),
            indexBuffer: WebGLUtils.createIndexBuffer(this.gl, this.indices),
            indexCount: this.indices.length
        };
    }

    // Method to clear all data
    clear() {
        this.vertices = [];
        this.normals = [];
        this.colors = [];
        this.indices = [];
    }
}

export { WebGLGeometryBuilder };