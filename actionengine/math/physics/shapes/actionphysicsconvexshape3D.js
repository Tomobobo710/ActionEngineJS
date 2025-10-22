import { ActionPhysicsObject3D } from '../actionphysicsobject3D.js';
import { Vector3 } from '../../vector3.js';
import { Triangle } from '../../geometry/triangle.js';

class ActionPhysicsConvexShape3D extends ActionPhysicsObject3D {
    constructor(physicsWorld, vertices, mass = 1, initialPosition = new Vector3(0, 500, 0), colors = []) {
        // Convert input vertices to Goblin.Vector3 for physics
        const goblinVertices = vertices.map(v => new Goblin.Vector3(v.x, v.y, v.z));
        
        // Create the Goblin physics shape first, so we can access its faces
        const goblinShape = new Goblin.ConvexShape(goblinVertices);
        
        // Default colors if none provided
        const defaultColors = [
            "#FF5733", // Coral
            "#F9A826", // Orange
            "#6A0572", // Purple
            "#4D89E5", // Blue
            "#2E8B57"  // SeaGreen
        ];
        
        // Create triangles based on the actual faces of the convex hull
        const triangles = [];
        
        // Each face in the Goblin shape is a triangular face of the convex hull
        goblinShape.faces.forEach((face, index) => {
            // Get the vertices of this face
            const v1 = new Vector3(face.a.point.x, face.a.point.y, face.a.point.z);
            const v2 = new Vector3(face.b.point.x, face.b.point.y, face.b.point.z);
            const v3 = new Vector3(face.c.point.x, face.c.point.y, face.c.point.z);
            
            // Choose a color for this face
            const color = colors[index % colors.length] || defaultColors[index % defaultColors.length];
            
            // Create a triangle with the vertices of this face
            triangles.push(new Triangle(v1, v2, v3, color));
        });
        
        // Pass triangles to parent constructor
        super(physicsWorld, triangles);

        // Create the rigid body
        this.body = new Goblin.RigidBody(goblinShape, mass);
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
