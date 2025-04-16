// actionengine/math/physics/actionphysicscapsule3D.js
class ActionPhysicsCapsule3D extends ActionPhysicsObject3D {
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
        
        // Calculate the cylinder height (total height minus the two hemisphere caps)
        const cylinderHeight = height - 2 * radius;
        const halfCylinderHeight = cylinderHeight * 0.5;
        
        // Segments for mesh detail
        const radialSegments = 12;
        const heightSegments = 4;
        const capSegments = 6;
        
        // Helper function to create cylinder and cap vertices
        const createVertex = (theta, y, radius) => {
            return new Vector3(
                radius * Math.cos(theta),
                y,
                radius * Math.sin(theta)
            );
        };
        
        // Helper to alternate colors for triangle checkerboard pattern
        const getColor = (x, y) => ((x + y) % 2 === 0) ? color1 : color2;
        
        // 1. Create Cylinder Body - FIXED WINDING ORDER
        for (let y = 0; y < heightSegments; y++) {
            const yBottom = -halfCylinderHeight + (y / heightSegments) * cylinderHeight;
            const yTop = -halfCylinderHeight + ((y + 1) / heightSegments) * cylinderHeight;
            
            for (let x = 0; x < radialSegments; x++) {
                const theta = (x / radialSegments) * Math.PI * 2;
                const thetaNext = ((x + 1) % radialSegments) / radialSegments * Math.PI * 2;
                
                // Create four vertices for this quad segment
                const v1 = createVertex(theta, yBottom, radius);
                const v2 = createVertex(thetaNext, yBottom, radius);
                const v3 = createVertex(thetaNext, yTop, radius);
                const v4 = createVertex(theta, yTop, radius);
                
                // FIXED: Reversed winding order for outward-facing normals
                triangles.push(new Triangle(v1, v3, v2, getColor(x, y)));
                triangles.push(new Triangle(v1, v4, v3, getColor(x, y)));
            }
        }
        
        // 2. Create Top Hemisphere Cap - FIXED WINDING ORDER
        const topCenter = new Vector3(0, halfCylinderHeight + radius, 0);
        for (let y = 0; y < capSegments; y++) {
            const phi = (y / capSegments) * (Math.PI / 2);
            const phiNext = ((y + 1) / capSegments) * (Math.PI / 2);
            
            const radiusAtPhi = radius * Math.cos(phi);
            const radiusAtPhiNext = radius * Math.cos(phiNext);
            
            const yAtPhi = halfCylinderHeight + radius * Math.sin(phi);
            const yAtPhiNext = halfCylinderHeight + radius * Math.sin(phiNext);
            
            if (y === capSegments - 1) {
                // Special case for the top pole
                for (let x = 0; x < radialSegments; x++) {
                    const theta = (x / radialSegments) * Math.PI * 2;
                    const thetaNext = ((x + 1) % radialSegments) / radialSegments * Math.PI * 2;
                    
                    const v1 = createVertex(theta, yAtPhi, radiusAtPhi);
                    const v2 = createVertex(thetaNext, yAtPhi, radiusAtPhi);
                    
                    // FIXED: Reversed winding order for top pole triangles
                    triangles.push(new Triangle(v1, topCenter, v2, getColor(x, y + heightSegments)));
                }
            } else {
                for (let x = 0; x < radialSegments; x++) {
                    const theta = (x / radialSegments) * Math.PI * 2;
                    const thetaNext = ((x + 1) % radialSegments) / radialSegments * Math.PI * 2;
                    
                    // Create four vertices for this quad segment
                    const v1 = createVertex(theta, yAtPhi, radiusAtPhi);
                    const v2 = createVertex(thetaNext, yAtPhi, radiusAtPhi);
                    const v3 = createVertex(thetaNext, yAtPhiNext, radiusAtPhiNext);
                    const v4 = createVertex(theta, yAtPhiNext, radiusAtPhiNext);
                    
                    // FIXED: Reversed winding order for top hemisphere
                    triangles.push(new Triangle(v1, v3, v2, getColor(x, y + heightSegments)));
                    triangles.push(new Triangle(v1, v4, v3, getColor(x, y + heightSegments)));
                }
            }
        }
        
        // 3. Create Bottom Hemisphere Cap - FIXED WINDING ORDER
        const bottomCenter = new Vector3(0, -halfCylinderHeight - radius, 0);
        for (let y = 0; y < capSegments; y++) {
            const phi = (y / capSegments) * (Math.PI / 2);
            const phiNext = ((y + 1) / capSegments) * (Math.PI / 2);
            
            const radiusAtPhi = radius * Math.cos(phi);
            const radiusAtPhiNext = radius * Math.cos(phiNext);
            
            const yAtPhi = -halfCylinderHeight - radius * Math.sin(phi);
            const yAtPhiNext = -halfCylinderHeight - radius * Math.sin(phiNext);
            
            if (y === capSegments - 1) {
                // Special case for the bottom pole
                for (let x = 0; x < radialSegments; x++) {
                    const theta = (x / radialSegments) * Math.PI * 2;
                    const thetaNext = ((x + 1) % radialSegments) / radialSegments * Math.PI * 2;
                    
                    const v1 = createVertex(theta, yAtPhi, radiusAtPhi);
                    const v2 = createVertex(thetaNext, yAtPhi, radiusAtPhi);
                    
                    // FIXED: Correct winding order for bottom pole
                    triangles.push(new Triangle(v1, v2, bottomCenter, getColor(x, y)));
                }
            } else {
                for (let x = 0; x < radialSegments; x++) {
                    const theta = (x / radialSegments) * Math.PI * 2;
                    const thetaNext = ((x + 1) % radialSegments) / radialSegments * Math.PI * 2;
                    
                    // Create four vertices for this quad segment
                    const v1 = createVertex(theta, yAtPhi, radiusAtPhi);
                    const v2 = createVertex(thetaNext, yAtPhi, radiusAtPhi);
                    const v3 = createVertex(thetaNext, yAtPhiNext, radiusAtPhiNext);
                    const v4 = createVertex(theta, yAtPhiNext, radiusAtPhiNext);
                    
                    // FIXED: Correct winding order for bottom hemisphere
                    triangles.push(new Triangle(v1, v2, v3, getColor(x, y)));
                    triangles.push(new Triangle(v1, v3, v4, getColor(x, y)));
                }
            }
        }
        
        // Rest of constructor remains the same
        super(physicsWorld, triangles);
        
        const shape = new Goblin.CapsuleShape(radius, height);
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