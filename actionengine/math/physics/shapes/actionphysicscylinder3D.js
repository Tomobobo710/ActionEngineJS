// actionengine/math/physics/actionphysicscylinder3D.js
import { ActionPhysicsObject3D } from '../actionphysicsobject3D.js';
import { Vector3 } from '../../vector3.js';
import { Triangle } from '../../geometry/triangle.js';

class ActionPhysicsCylinder3D extends ActionPhysicsObject3D {
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
        const heightSegments = 4;
        
        // Helper function to create cylinder vertices
        const createVertex = (theta, y, radius) => {
            return new Vector3(
                radius * Math.cos(theta),
                y,
                radius * Math.sin(theta)
            );
        };
        
        // Helper to alternate colors for triangle checkerboard pattern
        const getColor = (x, y) => ((x + y) % 2 === 0) ? color1 : color2;
        
        const halfHeight = height / 2;
        
        // 1. Create Cylinder Body
        for (let y = 0; y < heightSegments; y++) {
            const yBottom = -halfHeight + (y / heightSegments) * height;
            const yTop = -halfHeight + ((y + 1) / heightSegments) * height;
            
            for (let x = 0; x < radialSegments; x++) {
                const theta = (x / radialSegments) * Math.PI * 2;
                const thetaNext = ((x + 1) % radialSegments) / radialSegments * Math.PI * 2;
                
                // Create four vertices for this quad segment
                const v1 = createVertex(theta, yBottom, radius);
                const v2 = createVertex(thetaNext, yBottom, radius);
                const v3 = createVertex(thetaNext, yTop, radius);
                const v4 = createVertex(theta, yTop, radius);
                
                // Create two triangles with outward-facing normals
                triangles.push(new Triangle(v1, v3, v2, getColor(x, y)));
                triangles.push(new Triangle(v1, v4, v3, getColor(x, y)));
            }
        }
        
        // 2. Create Top Cap
        const topCenter = new Vector3(0, halfHeight, 0);
        for (let x = 0; x < radialSegments; x++) {
            const theta = (x / radialSegments) * Math.PI * 2;
            const thetaNext = ((x + 1) % radialSegments) / radialSegments * Math.PI * 2;
            
            const v1 = createVertex(theta, halfHeight, radius);
            const v2 = createVertex(thetaNext, halfHeight, radius);
            
            // Create triangle with upward-facing normal
            triangles.push(new Triangle(v1, topCenter, v2, getColor(x, heightSegments)));
        }
        
        // 3. Create Bottom Cap
        const bottomCenter = new Vector3(0, -halfHeight, 0);
        for (let x = 0; x < radialSegments; x++) {
            const theta = (x / radialSegments) * Math.PI * 2;
            const thetaNext = ((x + 1) % radialSegments) / radialSegments * Math.PI * 2;
            
            const v1 = createVertex(theta, -halfHeight, radius);
            const v2 = createVertex(thetaNext, -halfHeight, radius);
            
            // Create triangle with downward-facing normal
            triangles.push(new Triangle(v1, v2, bottomCenter, getColor(x, heightSegments + 1)));
        }
        
        super(physicsWorld, triangles);
        
        // Create physics shape and body
        const shape = new Goblin.CylinderShape(radius, halfHeight);
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

export { ActionPhysicsCylinder3D };