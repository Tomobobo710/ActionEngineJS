//actionengine/physics/shapes/actionphysicsbox3D.js
/**
 * ActionPhysicsBox3D - 3D Box Physics Object with Single Color System
 *
 * BREAKING CHANGE: Previously used rainbow faces by default.
 * Now uses single green color system for consistency with other shapes.
 *
 * @param {ActionPhysicsWorld3D} physicsWorld - The physics world
 * @param {number} width - Box width (default: 10)
 * @param {number} height - Box height (default: 10)
 * @param {number} depth - Box depth (default: 10)
 * @param {number} mass - Physics mass (default: 1)
 * @param {Vector3} initialPosition - Starting position (default: 0,500,0)
 * @param {string|Array} color - Single hex color "#228B22" or array of 6 colors for faces (default: "#228B22" green)
 */
class ActionPhysicsBox3D extends ActionPhysicsObject3D {
    constructor(
        physicsWorld,
        width = 10,
        height = 10,
        depth = 10,
        mass = 1,
        initialPosition = new Vector3(0, 500, 0),
        color = "#228B22",
        options = {}
    ) {
        // Create visual mesh with triangles
        const triangles = [];

        // Determine what colors to use
        let faceColors;

        if (typeof color === "string") {
            // Single color for all faces (including default green)
            faceColors = Array(6).fill(color);
        } else if (Array.isArray(color)) {
            // Array of colors provided - use them for corresponding faces
            faceColors = color.slice(0, 6);
            // Fill missing colors with first provided color or default green
            const fillColor = color[0] || "#228B22";
            while (faceColors.length < 6) {
                faceColors.push(fillColor);
            }
        } else {
            // Fallback to green for any other case
            faceColors = Array(6).fill("#228B22");
        }

        // Helper to create face with duplicate vertices (for hard edges)
        const createFace = (v1, v2, v3, v4, faceIndex) => {
            // Create new vertex instances for this face (don't share with adjacent faces)
            const vert1 = new Vector3(v1.x, v1.y, v1.z);
            const vert2 = new Vector3(v2.x, v2.y, v2.z);
            const vert3 = new Vector3(v3.x, v3.y, v3.z);
            const vert4 = new Vector3(v4.x, v4.y, v4.z);
            triangles.push(new Triangle(vert1, vert3, vert2, faceColors[faceIndex]));
            triangles.push(new Triangle(vert1, vert4, vert3, faceColors[faceIndex]));
        };

        // Half dimensions for vertex creation
        const hw = width / 2;
        const hh = height / 2;
        const hd = depth / 2;

        // Create all six faces with their respective colors
        // Each face gets its own duplicate vertices (24 total) so they don't share corners
        // This ensures hard edges between faces instead of smooth shading across boundaries
        
        // Front face (z = hd)
        createFace(
            new Vector3(hw, hh, hd),      // TR
            new Vector3(hw, -hh, hd),     // BR
            new Vector3(-hw, -hh, hd),    // BL
            new Vector3(-hw, hh, hd),     // TL
            0
        );

        // Back face (z = -hd)
        createFace(
            new Vector3(-hw, hh, -hd),    // TR
            new Vector3(-hw, -hh, -hd),   // BR
            new Vector3(hw, -hh, -hd),    // BL
            new Vector3(hw, hh, -hd),     // TL
            1
        );

        // Top face (y = hh)
        createFace(
            new Vector3(hw, hh, -hd),     // TR
            new Vector3(hw, hh, hd),      // BR
            new Vector3(-hw, hh, hd),     // BL
            new Vector3(-hw, hh, -hd),    // TL
            2
        );

        // Bottom face (y = -hh)
        createFace(
            new Vector3(hw, -hh, hd),     // TR
            new Vector3(hw, -hh, -hd),    // BR
            new Vector3(-hw, -hh, -hd),   // BL
            new Vector3(-hw, -hh, hd),    // TL
            3
        );

        // Right face (x = hw)
        createFace(
            new Vector3(hw, hh, -hd),     // TR
            new Vector3(hw, -hh, -hd),    // BR
            new Vector3(hw, -hh, hd),     // BL
            new Vector3(hw, hh, hd),      // TL
            4
        );

        // Left face (x = -hw)
        createFace(
            new Vector3(-hw, hh, hd),     // TR
            new Vector3(-hw, -hh, hd),    // BR
            new Vector3(-hw, -hh, -hd),   // BL
            new Vector3(-hw, hh, -hd),    // TL
            5
        );

        super(physicsWorld, triangles, options);

        // Create physics body from shape
        const shape = new Goblin.BoxShape(width / 2, height / 2, depth / 2);
        this.body = new ActionRigidBody(shape, mass);
        this.body.position = initialPosition;

        this.storeOriginalData();

        // Set visibility flag
        this.isVisible = options.isVisible !== undefined ? options.isVisible : true;
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
