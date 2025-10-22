// actionengine/math/physics/actionphysicssphere3D.js
import { ActionPhysicsObject3D } from '../actionphysicsobject3D.js';
import { Vector3 } from '../../vector3.js';
import { Triangle } from '../../geometry/triangle.js';

/**
 * ActionPhysicsSphere3D - 3D Sphere Physics Object with Single Color System
 * 
 * BREAKING CHANGE: Previously used black/white checkerboard pattern.
 * Now uses single color system for consistent developer experience.
 * 
 * @param {ActionPhysicsWorld3D} physicsWorld - The physics world
 * @param {number} radius - Sphere radius (default: 5)
 * @param {number} mass - Physics mass (default: 1)
 * @param {Vector3} initialPosition - Starting position (default: 0,500,0)
 * @param {string} color - Hex color string like "#FF0000" (default: "#FFFFFF" white)
 */
class ActionPhysicsSphere3D extends ActionPhysicsObject3D {
    constructor(physicsWorld, radius = 5, mass = 1, initialPosition = new Vector3(0, 500, 0), color = "#FFFFFF") {
        // Visual mesh creation with single color system
        const segments = 8;
        const triangles = [];
        
        // All triangles use the same color (changed from checkerboard pattern)
        const sphereColor = color;
        
        const createVertex = (phi, theta) => new Vector3(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.cos(phi),
            radius * Math.sin(phi) * Math.sin(theta)
        );

        // Sphere segments generation
        for (let lat = 0; lat <= segments; lat++) {
            const phi = (lat / segments) * Math.PI;
            const nextPhi = ((lat + 1) / segments) * Math.PI;
            for (let lon = 0; lon < segments; lon++) {
                const theta = (lon / segments) * 2 * Math.PI;
                const nextTheta = ((lon + 1) / segments) * 2 * Math.PI;
                
                if (lat === 0) {
                    triangles.push(new Triangle(
                        new Vector3(0, radius, 0),
                        createVertex(Math.PI / segments, nextTheta),
                        createVertex(Math.PI / segments, theta),
                        sphereColor
                    ));
                } else if (lat === segments - 1) {
                    triangles.push(new Triangle(
                        new Vector3(0, -radius, 0),
                        createVertex(Math.PI - Math.PI / segments, theta),
                        createVertex(Math.PI - Math.PI / segments, nextTheta),
                        sphereColor
                    ));
                } else {
                    const v1 = createVertex(phi, theta);
                    const v2 = createVertex(nextPhi, theta);
                    const v3 = createVertex(nextPhi, nextTheta);
                    const v4 = createVertex(phi, nextTheta);
                    triangles.push(new Triangle(v1, v3, v2, sphereColor));
                    triangles.push(new Triangle(v1, v4, v3, sphereColor));
                }
            }
        }
        
        super(physicsWorld, triangles);

        const shape = new Goblin.SphereShape(radius);
        this.body = new Goblin.RigidBody(shape, mass);
        this.body.position.set(
            initialPosition.x,
            initialPosition.y,
            initialPosition.z
        );
        
        this.body.linear_damping = 0.01;
        this.body.angular_damping = 0.01;
        
        // Store original data for visual updates
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