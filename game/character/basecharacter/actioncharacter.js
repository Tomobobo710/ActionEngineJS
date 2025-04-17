// game/character/basecharacter/actioncharacter.js
class ActionCharacter extends RenderableObject {
    constructor(camera) {
        super();

        this.camera = camera;
        

        this.basePosition = new Vector3(0, 0, 0); // Ground position
        this.position = new Vector3(0, 40, 0); // Center position
        this.facingDirection = new Vector3(0, 0, 1);
        this.rotation = 0;

        this.height = 6;
        this.scale = 1;

        this.characterModel = GLBLoader.loadModel(foxModel);
        this.animator = new ModelAnimationController(this.characterModel);
        console.log("Available animations:", this.animator.getAnimationNames());

        
    }

    // Required interface methods
    applyInput(input, deltaTime) {
        throw new Error("Must be implemented by subclass");
    }

    update(deltaTime) {
        throw new Error("Must be implemented by subclass");
    }

    draw(ctx, camera) {
        throw new Error("Must be implemented by subclass");
    }

    
    getCharacterModelTriangles() {
        function transformVertexWithSkin(vertex, vertexIndex, triangle, skin) {
            if (!triangle.jointData || !triangle.weightData) {
                return vertex;
            }

            const finalPosition = new Vector3(0, 0, 0);
            const joints = triangle.jointData[vertexIndex];
            const weights = triangle.weightData[vertexIndex];
            let totalWeight = 0;

            for (let i = 0; i < 4; i++) {
                const weight = weights[i];
                if (weight > 0) {
                    totalWeight += weight;
                    const jointMatrix = skin.jointMatrices[joints[i]];
                    if (jointMatrix) {
                        const transformed = Vector3.transformMat4(vertex, jointMatrix);
                        finalPosition.x += transformed.x * weight;
                        finalPosition.y += transformed.y * weight;
                        finalPosition.z += transformed.z * weight;
                    }
                }
            }

            if (totalWeight > 0 && Math.abs(totalWeight - 1.0) > 0.001) {
                finalPosition.x /= totalWeight;
                finalPosition.y /= totalWeight;
                finalPosition.z /= totalWeight;
            }

            return finalPosition;
        }

        function applyTransform(vertex, transform) {
            return Vector3.transformMat4(vertex, transform);
        }

        // Calculate model orientation transform based on facing direction
        const angle = Math.atan2(this.facingDirection.x, this.facingDirection.z);
        const modelTransform = Matrix4.create();
        Matrix4.rotateY(modelTransform, modelTransform, angle);

        const transformedTriangles = [];
        const skin = this.characterModel.skins[0];

        // Process each triangle in the model
        for (const triangle of this.characterModel.triangles) {
            // Apply skinning to each vertex
            const skinnedVertices = [];
            for (let i = 0; i < triangle.vertices.length; i++) {
                skinnedVertices.push(transformVertexWithSkin(triangle.vertices[i], i, triangle, skin));
            }

            // Apply model transform to skinned vertices
            const transformedVerts = [];
            for (let i = 0; i < skinnedVertices.length; i++) {
                transformedVerts.push(applyTransform(skinnedVertices[i], modelTransform));
            }

            // Create final transformed triangle
            transformedTriangles.push(
                new Triangle(transformedVerts[0], transformedVerts[1], transformedVerts[2], triangle.color)
            );
        }

        return transformedTriangles;
    }

    updateFacingDirection() {
        this.facingDirection = new Vector3(
            Math.sin(this.rotation), // X component
            0, // Y component (flat on xz plane)
            Math.cos(this.rotation) // Z component
        );
    }
}