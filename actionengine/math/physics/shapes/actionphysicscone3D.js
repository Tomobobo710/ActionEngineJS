// actionengine/math/physics/actionphysicscone3D.js
import { ActionPhysicsObject3D } from '../actionphysicsobject3D.js';
import { Vector3 } from '../../vector3.js';
import { Triangle } from '../../geometry/triangle.js';

/**
 * ActionPhysicsCone3D - 3D Cone Physics Object with Single Color System
 * 
 * BREAKING CHANGE: Previously used two-color checkerboard pattern (color1, color2).
 * Now uses single color system for consistency with other shapes.
 * 
 * @param {ActionPhysicsWorld3D} physicsWorld - The physics world
 * @param {number} radius - Cone base radius (default: 2)
 * @param {number} height - Cone height (default: 10)
 * @param {number} mass - Physics mass (default: 1)
 * @param {Vector3} initialPosition - Starting position (default: 0,10,0)
 * @param {string} color - Hex color string like "#FF0000" (default: "#FFA500" orange)
 */
class ActionPhysicsCone3D extends ActionPhysicsObject3D {
    constructor(
        physicsWorld,
        radius = 2,
        height = 10,
        mass = 1,
        initialPosition = new Vector3(0, 10, 0),
        color = "#FFA500"
    ) {
        // Create visual mesh with triangles using single color system
        const triangles = [];
        
        // Segments for mesh detail
        const radialSegments = 12;
        const heightSegments = 6;
        
        // Use single color for all triangles (changed from checkerboard pattern)
        const coneColor = color;
        
        // Helper function to create vertices
        const createVertex = (theta, heightPercent, radiusPercent) => {
            const currentRadius = radius * (1 - heightPercent) * radiusPercent;
            return new Vector3(
                currentRadius * Math.cos(theta),
                height * (heightPercent - 0.5),  // Ranges from -half_height to half_height
                currentRadius * Math.sin(theta)
            );
        };
        
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
                    triangles.push(new Triangle(v1, tip, v2, coneColor));
                } else {
                    // Regular segment
                    const v1 = createVertex(theta, yBottom, 1);
                    const v2 = createVertex(thetaNext, yBottom, 1);
                    const v3 = createVertex(thetaNext, yTop, 1);
                    const v4 = createVertex(theta, yTop, 1);
                    
                    // Correct winding order for outward-facing normals
                    triangles.push(new Triangle(v1, v3, v2, coneColor));
                    triangles.push(new Triangle(v1, v4, v3, coneColor));
                }
            }
        }
        
        // 2. Create Base with correct winding order for downward-facing normal
        for (let x = 0; x < radialSegments; x++) {
            const theta = (x / radialSegments) * Math.PI * 2;
            const thetaNext = ((x + 1) % radialSegments) / radialSegments * Math.PI * 2;
            
            const v1 = createVertex(theta, 0, 1);
            const v2 = createVertex(thetaNext, 0, 1);
            
            triangles.push(new Triangle(v1, v2, base, coneColor));
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