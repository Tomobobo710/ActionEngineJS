import { WebGLGeometryBuilder } from './webglGeometryBuilder.js';

// Level class for 3D WebGL rendering
export class Level {
    constructor(gl, renderer) {
        this.gl = gl;
        this.renderer = renderer;
        this.collisionBoxes = [];
        this.halfRoomSize = 125; // Room half-size for consistent geometry

        // Create level geometry
        this.createGeometry();
    }

    createGeometry() {
        // Create geometry builder
        const builder = new WebGLGeometryBuilder(this.gl);

        // Create floor and ceiling - perfectly aligned with walls
        builder.addFloor(-this.halfRoomSize, 0, -this.halfRoomSize, 250, 250, [0.8, 0.8, 0.8]);
        builder.addFloor(-this.halfRoomSize, 125, -this.halfRoomSize, 250, 250, [0.6, 0.6, 0.8]); // Ceiling at height 125

        // Create walls - proper room dimensions without overlap

        // North wall (along X axis at Z = -halfRoomSize)
        builder.addWall(-this.halfRoomSize, 0, -this.halfRoomSize, this.halfRoomSize, 0, -this.halfRoomSize, 125, [0.6, 0.6, 0.8]);
        // South wall (along X axis at Z = halfRoomSize)
        builder.addWall(-this.halfRoomSize, 0, this.halfRoomSize, this.halfRoomSize, 0, this.halfRoomSize, 125, [0.6, 0.6, 0.8]);
        // East wall (along Z axis at X = halfRoomSize)
        builder.addWall(this.halfRoomSize, 0, -this.halfRoomSize, this.halfRoomSize, 0, this.halfRoomSize, 125, [0.6, 0.6, 0.8]);
        // West wall (along Z axis at X = -halfRoomSize)
        builder.addWall(-this.halfRoomSize, 0, -this.halfRoomSize, -this.halfRoomSize, 0, this.halfRoomSize, 125, [0.6, 0.6, 0.8]);

        // Generate collision boxes for the level
        this.generateCollisionGeometry();

        // Build the mesh
        this.mesh = builder.build();
    }

    generateCollisionGeometry() {
        this.collisionBoxes = [];

        // Add floor and ceiling - perfectly aligned with walls
        this.collisionBoxes.push({
            min: window.Vector3 ? new window.Vector3(-this.halfRoomSize, -0.1, -this.halfRoomSize) : { x: -this.halfRoomSize, y: -0.1, z: -this.halfRoomSize },
            max: window.Vector3 ? new window.Vector3(this.halfRoomSize, 0, this.halfRoomSize) : { x: this.halfRoomSize, y: 0, z: this.halfRoomSize },
            type: "floor"
        });
        this.collisionBoxes.push({
            min: window.Vector3 ? new window.Vector3(-this.halfRoomSize, 125, -this.halfRoomSize) : { x: -this.halfRoomSize, y: 125, z: -this.halfRoomSize },
            max: window.Vector3 ? new window.Vector3(this.halfRoomSize, 125.1, this.halfRoomSize) : { x: this.halfRoomSize, y: 125.1, z: this.halfRoomSize },
            type: "floor"
        });

        // Add walls (with proper thickness) - match visual wall positions
        const wallThickness = 3; // Slightly thicker for better collision

        // North wall collision (Z = -halfRoomSize)
        this.collisionBoxes.push({
            min: window.Vector3 ? new window.Vector3(-this.halfRoomSize, 0, -this.halfRoomSize - wallThickness) : { x: -this.halfRoomSize, y: 0, z: -this.halfRoomSize - wallThickness },
            max: window.Vector3 ? new window.Vector3(this.halfRoomSize, 125, -this.halfRoomSize) : { x: this.halfRoomSize, y: 125, z: -this.halfRoomSize },
            type: "wall"
        });
        // South wall collision (Z = halfRoomSize)
        this.collisionBoxes.push({
            min: window.Vector3 ? new window.Vector3(-this.halfRoomSize, 0, this.halfRoomSize) : { x: -this.halfRoomSize, y: 0, z: this.halfRoomSize },
            max: window.Vector3 ? new window.Vector3(this.halfRoomSize, 125, this.halfRoomSize + wallThickness) : { x: this.halfRoomSize, y: 125, z: this.halfRoomSize + wallThickness },
            type: "wall"
        });
        // East wall collision (X = halfRoomSize)
        this.collisionBoxes.push({
            min: window.Vector3 ? new window.Vector3(this.halfRoomSize, 0, -this.halfRoomSize) : { x: this.halfRoomSize, y: 0, z: -this.halfRoomSize },
            max: window.Vector3 ? new window.Vector3(this.halfRoomSize + wallThickness, 125, this.halfRoomSize) : { x: this.halfRoomSize + wallThickness, y: 125, z: this.halfRoomSize },
            type: "wall"
        });
        // West wall collision (X = -halfRoomSize)
        this.collisionBoxes.push({
            min: window.Vector3 ? new window.Vector3(-this.halfRoomSize - wallThickness, 0, -this.halfRoomSize) : { x: -this.halfRoomSize - wallThickness, y: 0, z: -this.halfRoomSize },
            max: window.Vector3 ? new window.Vector3(-this.halfRoomSize, 125, this.halfRoomSize) : { x: -this.halfRoomSize, y: 125, z: this.halfRoomSize },
            type: "wall"
        });
    }

    draw(renderer, viewMatrix, projectionMatrix) {
        // Create model matrix (identity for level)
        const modelMatrix = window.Matrix4 ? window.Matrix4.create() : new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

        // Draw the mesh with the renderer
        renderer.drawMesh(this.mesh, "basic", modelMatrix, viewMatrix, projectionMatrix);
    }
}