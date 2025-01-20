class ActionModel3D {
    constructor() {
        // Node structure
        this.nodes = [];  // All nodes with full properties 
        this.rootNodes = [];  // Top-level node indices
        this.meshNodes = [];  // Nodes with meshes
        this.jointNodes = []; // Nodes used as bones
        this.skinNodes = [];  // Nodes using skins
        this.nodeMap = {};    // Look up nodes by name

        // Mesh data
        this.meshes = [];     // Complete mesh data for each mesh
        this.originalTriangles = [];  // Initial triangle geometry
        this.triangles = [];  // Current triangle geometry
        
        // Original skin definitions 
        this.skins = [];      // Complete skin definitions from GLB

        // Bone/joint relationships
        this.jointToSkinIndex = {};    // Which skin each joint belongs to
        this.nodeToSkinIndex = {};     // Which skin each node uses
        this.inverseBindMatrices = {}; // Joint index -> its starting pose matrix
        
        // Per-vertex skinning data
        this.vertexJoints = [];  // Which joints affect each vertex
        this.vertexWeights = []; // How much each joint affects each vertex

        // Animation data
        this.animations = {};    // All animation data
        
        this.vertexToTriangleMap = {}; // Maps vertex positions to array of triangle indices that use that vertex
        this.nodeToVertexMap = {}; // Maps node indices to Set of vertex positions influenced by that node based on skinning data
    }
    
    createBoxModel(size, height) {
        // Character model is made out of Triangles
        const halfSize = size / 2;
        const halfHeight = height / 2;
        const yOffset = 0;
        // Define vertices
        const v = {
            ftl: new Vector3(-halfSize, halfHeight + yOffset, halfSize),
            ftr: new Vector3(halfSize, halfHeight + yOffset, halfSize),
            fbl: new Vector3(-halfSize, -halfHeight + yOffset, halfSize),
            fbr: new Vector3(halfSize, -halfHeight + yOffset, halfSize),
            btl: new Vector3(-halfSize, halfHeight + yOffset, -halfSize),
            btr: new Vector3(halfSize, halfHeight + yOffset, -halfSize),
            bbl: new Vector3(-halfSize, -halfHeight + yOffset, -halfSize),
            bbr: new Vector3(halfSize, -halfHeight + yOffset, -halfSize)
        };
        return [
            // Front face (yellow)
            new Triangle(v.ftl, v.fbl, v.ftr, "#FFFF00"),
            new Triangle(v.fbl, v.fbr, v.ftr, "#FFFF00"),
            // Back face
            new Triangle(v.btr, v.bbl, v.btl, "#FF0000"),
            new Triangle(v.btr, v.bbr, v.bbl, "#FF0000"),
            // Right face
            new Triangle(v.ftr, v.fbr, v.btr, "#FF0000"),
            new Triangle(v.fbr, v.bbr, v.btr, "#FF0000"),
            // Left face
            new Triangle(v.btl, v.bbl, v.ftl, "#FF0000"),
            new Triangle(v.ftl, v.bbl, v.fbl, "#FF0000"),
            // Top face
            new Triangle(v.ftl, v.ftr, v.btr, "#FF0000"),
            new Triangle(v.ftl, v.btr, v.btl, "#FF0000"),
            // Bottom face
            new Triangle(v.fbl, v.bbl, v.fbr, "#FF0000"),
            new Triangle(v.bbl, v.bbr, v.fbr, "#FF0000")
        ];
    }

    createCapsuleModel(size, height) {
        const segments = 16; // Number of segments around the capsule
        const triangles = [];
        const radius = size / 2;
        const cylinderHeight = height - size; // Subtract diameter to account for hemispheres
        const halfCylinderHeight = cylinderHeight / 2;

        // Helper function to create vertex on hemisphere
        const createSphereVertex = (phi, theta, yOffset) => {
            return new Vector3(
                radius * Math.sin(phi) * Math.cos(theta),
                yOffset + radius * Math.cos(phi),
                radius * Math.sin(phi) * Math.sin(theta)
            );
        };

        // Create top hemisphere
        for (let lat = 0; lat <= segments / 2; lat++) {
            const phi = (lat / segments) * Math.PI;
            const nextPhi = ((lat + 1) / segments) * Math.PI;

            for (let lon = 0; lon < segments; lon++) {
                const theta = (lon / segments) * 2 * Math.PI;
                const nextTheta = ((lon + 1) / segments) * 2 * Math.PI;

                if (lat === 0) {
                    // Top cap triangle (this one was correct)
                    triangles.push(
                        new Triangle(
                            new Vector3(0, halfCylinderHeight + radius, 0),
                            createSphereVertex(Math.PI / segments, nextTheta, halfCylinderHeight),
                            createSphereVertex(Math.PI / segments, theta, halfCylinderHeight),
                            "#FFFF00"
                        )
                    );
                } else {
                    // Hemisphere body triangles (fixing winding order)
                    const v1 = createSphereVertex(phi, theta, halfCylinderHeight);
                    const v2 = createSphereVertex(nextPhi, theta, halfCylinderHeight);
                    const v3 = createSphereVertex(nextPhi, nextTheta, halfCylinderHeight);
                    const v4 = createSphereVertex(phi, nextTheta, halfCylinderHeight);
                    triangles.push(new Triangle(v1, v3, v2, "#FFFF00"));
                    triangles.push(new Triangle(v1, v4, v3, "#FFFF00"));
                }
            }
        }

        // Create cylinder body
        for (let lon = 0; lon < segments; lon++) {
            const theta = (lon / segments) * 2 * Math.PI;
            const nextTheta = ((lon + 1) / segments) * 2 * Math.PI;

            const topLeft = new Vector3(radius * Math.cos(theta), halfCylinderHeight, radius * Math.sin(theta));
            const topRight = new Vector3(
                radius * Math.cos(nextTheta),
                halfCylinderHeight,
                radius * Math.sin(nextTheta)
            );
            const bottomLeft = new Vector3(radius * Math.cos(theta), -halfCylinderHeight, radius * Math.sin(theta));
            const bottomRight = new Vector3(
                radius * Math.cos(nextTheta),
                -halfCylinderHeight,
                radius * Math.sin(nextTheta)
            );

            triangles.push(new Triangle(topLeft, topRight, bottomLeft, "#FF0000"));
            triangles.push(new Triangle(bottomLeft, topRight, bottomRight, "#FF0000"));
        }

        // Create bottom hemisphere
        // Stop BEFORE the last segment
        for (let lat = segments / 2; lat < segments - 1; lat++) {
            const phi = (lat / segments) * Math.PI;
            const nextPhi = ((lat + 1) / segments) * Math.PI;

            for (let lon = 0; lon < segments; lon++) {
                const theta = (lon / segments) * 2 * Math.PI;
                const nextTheta = ((lon + 1) / segments) * 2 * Math.PI;

                if (lat === segments - 1) {
                    // Bottom cap triangle
                    triangles.push(
                        new Triangle(
                            new Vector3(0, -halfCylinderHeight - radius, 0),
                            createSphereVertex(Math.PI - Math.PI / segments, theta, -halfCylinderHeight),
                            createSphereVertex(Math.PI - Math.PI / segments, nextTheta, -halfCylinderHeight),
                            "#FF0000"
                        )
                    );
                } else {
                    // Hemisphere body triangles
                    const v1 = createSphereVertex(phi, theta, -halfCylinderHeight);
                    const v2 = createSphereVertex(nextPhi, theta, -halfCylinderHeight);
                    const v3 = createSphereVertex(nextPhi, nextTheta, -halfCylinderHeight);
                    const v4 = createSphereVertex(phi, nextTheta, -halfCylinderHeight);
                    triangles.push(new Triangle(v1, v3, v2, "#FF0000"));
                    triangles.push(new Triangle(v1, v4, v3, "#FF0000"));
                }
            }
        }

        // Separately create just the bottom cap triangles once
        for (let lon = 0; lon < segments; lon++) {
            const theta = (lon / segments) * 2 * Math.PI;
            const nextTheta = ((lon + 1) / segments) * 2 * Math.PI;

            triangles.push(
                new Triangle(
                    new Vector3(0, -halfCylinderHeight - radius, 0),
                    createSphereVertex(Math.PI - Math.PI / segments, theta, -halfCylinderHeight),
                    createSphereVertex(Math.PI - Math.PI / segments, nextTheta, -halfCylinderHeight),
                    "#FF0000"
                )
            );
        }

        return triangles;
    }
}