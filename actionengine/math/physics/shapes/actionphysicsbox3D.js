import { ActionPhysicsObject3D } from '../actionphysicsobject3D.js';
import { Vector3 } from '../../vector3.js';
import { Triangle } from '../../geometry/triangle.js';

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
    constructor(physicsWorld, width = 10, height = 10, depth = 10, mass = 1, 
                initialPosition = new Vector3(0, 500, 0), color = "#228B22", options = {}) {
        // Create visual mesh with triangles
        const triangles = [];
        
        // Determine what colors to use
        let faceColors;
        
        if (typeof color === 'string') {
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
        
        // Helper to create face vertices
        const createFace = (v1, v2, v3, v4, faceIndex) => {
            triangles.push(new Triangle(v1, v2, v3, faceColors[faceIndex]));
            triangles.push(new Triangle(v1, v3, v4, faceColors[faceIndex]));
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

        // Create all six faces with their respective colors
        // Front face
        createFace(
            vertices.frontBottomLeft,
            vertices.frontBottomRight,
            vertices.frontTopRight,
            vertices.frontTopLeft,
            0 // Index for front face color
        );

        // Back face
        createFace(
            vertices.backBottomRight,
            vertices.backBottomLeft,
            vertices.backTopLeft,
            vertices.backTopRight,
            1 // Index for back face color
        );

        // Top face
        createFace(
            vertices.frontTopLeft,
            vertices.frontTopRight,
            vertices.backTopRight,
            vertices.backTopLeft,
            2 // Index for top face color
        );

        // Bottom face
        createFace(
            vertices.frontBottomRight,
            vertices.frontBottomLeft,
            vertices.backBottomLeft,
            vertices.backBottomRight,
            3 // Index for bottom face color
        );

        // Right face
        createFace(
            vertices.frontBottomRight,
            vertices.backBottomRight,
            vertices.backTopRight,
            vertices.frontTopRight,
            4 // Index for right face color
        );

        // Left face
        createFace(
            vertices.backBottomLeft,
            vertices.frontBottomLeft,
            vertices.frontTopLeft,
            vertices.backTopLeft,
            5 // Index for left face color
        );

        super(physicsWorld, triangles, options);

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

        this.storeOriginalData();
        
        // Set visibility flag
        this.isVisible = options.isVisible !== undefined ? options.isVisible : true;
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