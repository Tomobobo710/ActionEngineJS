// actionengine/math/physics/actionphysicscone3D.js
class ActionPhysicsCone3D extends ActionPhysicsObject3D {
    constructor(
        physicsWorld,
        radius = 2,
        height = 10,
        mass = 1,
        initialPosition = new Vector3(0, 10, 0),
        color1 = "#FF0000",
        color2 = "#0000FF"
    ) {
        // Create visual mesh with triangles
        const triangles = [];
        
        // Segments for mesh detail
        const radialSegments = 12;
        const heightSegments = 6;
        
        // Helper function to create vertices
        const createVertex = (theta, heightPercent, radiusPercent) => {
            const currentRadius = radius * (1 - heightPercent) * radiusPercent;
            return new Vector3(
                currentRadius * Math.cos(theta),
                height * (heightPercent - 0.5),  // Ranges from -half_height to half_height
                currentRadius * Math.sin(theta)
            );
        };
        
        // Helper to alternate colors for triangle checkerboard pattern
        const getColor = (x, y) => ((x + y) % 2 === 0) ? color1 : color2;
        
        // 1. Create Cone Body
        const tip = new Vector3(0, height/2, 0);
        const base = new Vector3(0, -height/2, 0);
        
        // Create cone sides
        for (let y = 0; y < heightSegments; y++) {
            const yBottom = y / heightSegments;
            const yTop = (y + 1) / heightSegments;
            
            for (let x = 0; x < radialSegments; x++) {
                const theta = (x / radialSegments) * Math.PI * 2;
                const thetaNext = ((x + 1) % radialSegments) / radialSegments * Math.PI * 2;
                
                if (y === heightSegments - 1) {
                    // Top segment connects to tip
                    const v1 = createVertex(theta, yBottom, 1);
                    const v2 = createVertex(thetaNext, yBottom, 1);
                    
                    // Correct winding order for outward-facing normal
                    triangles.push(new Triangle(v1, tip, v2, getColor(x, y)));
                } else {
                    // Regular segment
                    const v1 = createVertex(theta, yBottom, 1);
                    const v2 = createVertex(thetaNext, yBottom, 1);
                    const v3 = createVertex(thetaNext, yTop, 1);
                    const v4 = createVertex(theta, yTop, 1);
                    
                    // Correct winding order for outward-facing normals
                    triangles.push(new Triangle(v1, v3, v2, getColor(x, y)));
                    triangles.push(new Triangle(v1, v4, v3, getColor(x, y)));
                }
            }
        }
        
        // 2. Create Base with correct winding order for downward-facing normal
        for (let x = 0; x < radialSegments; x++) {
            const theta = (x / radialSegments) * Math.PI * 2;
            const thetaNext = ((x + 1) % radialSegments) / radialSegments * Math.PI * 2;
            
            const v1 = createVertex(theta, 0, 1);
            const v2 = createVertex(thetaNext, 0, 1);
            
            triangles.push(new Triangle(v1, v2, base, getColor(x, heightSegments)));
        }
        
        super(physicsWorld, triangles);
        
        // Create physics shape and body - Goblin expects half-height
        const shape = new Goblin.ConeShape(radius, height/2);
        this.body = new Goblin.RigidBody(shape, mass);
        this.body.position.set(
            initialPosition.x,
            initialPosition.y,
            initialPosition.z
        );
        
        this.body.linear_damping = 0.01;
        this.body.angular_damping = 0.01;
        
        this.storeOriginalData();
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