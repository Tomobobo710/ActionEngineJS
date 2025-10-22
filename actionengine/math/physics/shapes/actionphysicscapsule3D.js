// actionengine/math/physics/actionphysicscapsule3D.js
import { ActionPhysicsObject3D } from '../actionphysicsobject3D.js';
import { Vector3 } from '../../vector3.js';
import { Triangle } from '../../geometry/triangle.js';

/**
 * ActionPhysicsCapsule3D - 3D Capsule Physics Object with Single Color System
 * 
 * BREAKING CHANGE: Previously used two-color checkerboard pattern (color1, color2).
 * Now uses single color system for consistent developer experience.
 * 
 * IMPORTANT GEOMETRY CONSTRAINT:
 * Total height MUST be greater than 2 × radius!
 * 
 * Why? A capsule = cylinder + 2 hemisphere caps
 * - Cylinder height = total height - (2 × radius)
 * - If total height < 2 × radius, cylinder height becomes negative = impossible!
 * - This constraint is enforced by the Goblin physics library
 * 
 * @param {ActionPhysicsWorld3D} physicsWorld - The physics world
 * @param {number} radius - Capsule radius (default: 2)
 * @param {number} height - Total height including caps - MUST be > 2×radius (default: 10)
 * @param {number} mass - Physics mass (default: 1)
 * @param {Vector3} initialPosition - Starting position (default: 0,10,0)
 * @param {string} color - Hex color string like "#FF0000" (default: "#E94B3C" red)
 */
class ActionPhysicsCapsule3D extends ActionPhysicsObject3D {
    constructor(
        physicsWorld,
        radius = 2,
        height = 10,
        mass = 1,
        initialPosition = new Vector3(0, 10, 0),
        color = "#E94B3C"
    ) {
        // Create visual mesh with triangles using single color system
        const triangles = [];
        
        // Calculate the cylinder height (total height minus the two hemisphere caps)
        // This will be negative if height < 2*radius, causing physics library to throw error
        const cylinderHeight = height - 2 * radius;
        const halfCylinderHeight = cylinderHeight * 0.5;
        
        // Segments for mesh detail
        const radialSegments = 12;
        const heightSegments = 4;
        const capSegments = 6;
        
        // Use single color for all triangles (no more checkerboard)
        const capsuleColor = color;
        
        // Helper function to create cylinder and cap vertices
        const createVertex = (theta, y, radius) => {
            return new Vector3(
                radius * Math.cos(theta),
                y,
                radius * Math.sin(theta)
            );
        };
        
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
                triangles.push(new Triangle(v1, v3, v2, capsuleColor));
                triangles.push(new Triangle(v1, v4, v3, capsuleColor));
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
                    triangles.push(new Triangle(v1, topCenter, v2, capsuleColor));
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
                    triangles.push(new Triangle(v1, v3, v2, capsuleColor));
                    triangles.push(new Triangle(v1, v4, v3, capsuleColor));
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
                    triangles.push(new Triangle(v1, v2, bottomCenter, capsuleColor));
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
                    triangles.push(new Triangle(v1, v2, v3, capsuleColor));
                    triangles.push(new Triangle(v1, v3, v4, capsuleColor));
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