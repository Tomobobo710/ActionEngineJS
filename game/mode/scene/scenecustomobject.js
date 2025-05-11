// game/mode/scene/scenecustomobject.js
class SceneCustomObject extends ActionPhysicsObject3D {
    constructor(physicsWorld, width = 10, height = 10, depth = 10, mass = 1, initialPosition = new Vector3(0, 0, 0), type = "wall") {
        // Create visual mesh with triangles
        const triangles = [];
        
        // Type-specific colors - expanded with scene-specific types
        const typeColors = {
            "floor": "#8B4513",          // Brown
            "ceiling": "#696969",        // Dim Gray
            "wall": "#A9A9A9",           // Dark Gray
            "portal": "#0000FF80",       // Semi-transparent Blue
            "world_portal": "#00FF0080", // Semi-transparent Green
            "trigger": "#FFD70080",      // Semi-transparent Gold
            "decoration": "#FF6347",     // Tomato
            "chest": "#CD853F",         // Peru
            "chair": "#DEB887",         // Burlywood
            "table": "#D2B48C"          // Tan
        };
        
        // Get the color for this object type
        const color = typeColors[type] || "#FFFFFF";
        
        // Helper to create face vertices
        const createFace = (v1, v2, v3, v4) => {
            triangles.push(new Triangle(v1, v2, v3, color));
            triangles.push(new Triangle(v1, v3, v4, color));
        };

        // Half dimensions for vertex creation
        const hw = width / 2;
        const hh = height / 2;
        const hd = depth / 2;

        // Create vertices for each face
        const vertices = {
            frontTopLeft:     new Vector3(-hw,  hh,  hd),
            frontTopRight:    new Vector3( hw,  hh,  hd),
            frontBottomRight: new Vector3( hw, -hh,  hd),
            frontBottomLeft:  new Vector3(-hw, -hh,  hd),
            backTopLeft:      new Vector3(-hw,  hh, -hd),
            backTopRight:     new Vector3( hw,  hh, -hd),
            backBottomRight:  new Vector3( hw, -hh, -hd),
            backBottomLeft:   new Vector3(-hw, -hh, -hd)
        };

        // Create all six faces with consistent color
        // Front face
        createFace(
            vertices.frontBottomLeft,
            vertices.frontBottomRight,
            vertices.frontTopRight,
            vertices.frontTopLeft
        );

        // Back face
        createFace(
            vertices.backBottomRight,
            vertices.backBottomLeft,
            vertices.backTopLeft,
            vertices.backTopRight
        );

        // Top face
        createFace(
            vertices.frontTopLeft,
            vertices.frontTopRight,
            vertices.backTopRight,
            vertices.backTopLeft
        );

        // Bottom face
        createFace(
            vertices.frontBottomRight,
            vertices.frontBottomLeft,
            vertices.backBottomLeft,
            vertices.backBottomRight
        );

        // Right face
        createFace(
            vertices.frontBottomRight,
            vertices.backBottomRight,
            vertices.backTopRight,
            vertices.frontTopRight
        );

        // Left face
        createFace(
            vertices.backBottomLeft,
            vertices.frontBottomLeft,
            vertices.frontTopLeft,
            vertices.backTopLeft
        );

        super(physicsWorld, triangles);

        // Create physics shape and body
        const shape = new Goblin.BoxShape(width/2, height/2, depth/2);
        this.body = new Goblin.RigidBody(shape, mass);
        this.body.position.set(
            initialPosition.x,
            initialPosition.y,
            initialPosition.z
        );

        this.body.linear_damping = 0.01;
        this.body.angular_damping = 0.01;
        
        // Floor needs good friction for character movement
        if (type === "floor") {
            this.body.friction = 0.8; // Keep just this physics property
        }
        
        // Store type for reference
        this.objectType = type;

        this.storeOriginalData();
        
        // Special handling for portals
        if (type === "portal" || type === "world_portal") {
            // For portals, allow passage but still detect collision
            this.body.addListener('preContact', (body, contact) => {
                // Allow character to pass through
                if (body.debugName && body.debugName.includes('Character')) {
                    contact.restitution = 0;
                    contact.friction = 0;
                    contact.disabled = true;
                }
            });
        }
    }

    storeOriginalData() {
        this.originalNormals = [];
        this.originalVerts = [];
        
        this.triangles.forEach((triangle) => {
            this.originalNormals.push(new Vector3(
                triangle.normal.x,
                triangle.normal.y,
                triangle.normal.z
            ));
            
            triangle.vertices.forEach((vertex) => {
                this.originalVerts.push(new Vector3(
                    vertex.x,
                    vertex.y,
                    vertex.z
                ));
            });
        });
    }
}