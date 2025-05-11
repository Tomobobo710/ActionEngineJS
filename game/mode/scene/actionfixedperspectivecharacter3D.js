// game/mode/scene/actionfixedperspectivecharacter3D.js

class ActionFixedPerspectiveCharacter3D extends ActionCharacter {
    constructor(camera, game) {
        super(camera, game);
        this.game = game;
        
        // Store a global reference for debugging
        window.gameCharacter = this;
        
        // Load the character model directly - same approach as world mode
        this.characterModel = GLBLoader.loadModel(foxModel);
        this.animator = new ModelAnimationController(this.characterModel);
        console.log("Available animations:", this.animator.getAnimationNames());
        
        // Animation state tracking
        this.wasGroundedLastFrame = false;
        this.lastMoveDirection = new Vector3(0, 0, 1);
    }
    
    applyInput(input, deltaTime) {
        // Skip if camera is not available
        if (!this.camera) return;
        
        // Calculate movement direction based on camera orientation
        const moveDir = new Goblin.Vector3();
        
        // Get input direction relative to camera
        const viewMatrix = this.camera.getViewMatrix();
        
        // Get camera forward and right vectors from the view matrix
        const cameraForward = this.camera.getViewMatrix().forward;
        const cameraRight = this.camera.getViewMatrix().right;
        
        // Project camera forward vector onto XZ plane and normalize
        const forwardVec = new Vector3(cameraForward.x, 0, cameraForward.z);
        forwardVec.normalize();
        
        // Project camera right vector onto XZ plane and normalize
        const rightVec = new Vector3(cameraRight.x, 0, cameraRight.z);
        rightVec.normalize();
        
        // Track if we're moving this frame
        let isMovingThisFrame = false;
        
        

    
    // Calculate movement direction relative to camera
    if (input.isKeyPressed("DirUp")) {
        moveDir.x += viewMatrix.forward.x;
        moveDir.z += viewMatrix.forward.z;
    }
    if (input.isKeyPressed("DirDown")) {
        moveDir.x -= viewMatrix.forward.x;
        moveDir.z -= viewMatrix.forward.z;
    }
    if (input.isKeyPressed("DirRight")) {
        moveDir.x += viewMatrix.right.x;
        moveDir.z += viewMatrix.right.z;
    }
    if (input.isKeyPressed("DirLeft")) {
        moveDir.x -= viewMatrix.right.x;
        moveDir.z -= viewMatrix.right.z;
    }
    
    // If we're moving this frame, store the direction
    if (moveDir.lengthSquared() > 0) {
        moveDir.normalize();
        this.lastMoveDirection.set(moveDir.x, 0, moveDir.z);
        this.hasMovedOnce = true;
    }

        // Normalize the movement vector if moving diagonally
        if (moveDir.lengthSquared() > 0) {
            moveDir.normalize();
            
            // Set facing direction based on movement
            this.facingDirection = new Vector3(moveDir.x, 0, moveDir.z);
            this.rotation = Math.atan2(moveDir.x, moveDir.z);
        }

        // Handle jump
        if (input.isKeyJustPressed("Action1")) {
            this.controller.wishJump();
        }
        
        // Apply movement to the character controller
        this.controller.handleInput(moveDir);
        
        // Debug toggle
        if (input.isKeyJustPressed("ActionDebugToggle")) {
            console.log("Character Debug:", this.controller.getDebugInfo());
        }
    }
    // Override the updateFacingDirection method
updateFacingDirection() {
    if (this.hasMovedOnce) {
        // Use last movement direction instead of rotation-based facing
        this.facingDirection = this.lastMoveDirection;
    } else {
        // If character hasn't moved yet, use the base implementation
        super.updateFacingDirection();
    }
}
    updateAnimationState() {
        if (!this.animator) return;
        
        const debugInfo = this.controller.getDebugInfo();
        const state = debugInfo.state.current;
        const velocity = debugInfo.physics.velocity;
        const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
        const isReallyMoving = horizontalSpeed > 0.5;

        // Prevent interrupting non-looping animations
        if (this.animator.isPlaying && !this.animator.isLooping) {
            return;
        }

        // Ground state handling
        if (state === "grounded") {
            // Check for ground touch transition
            const justTouchedGround = !this.wasGroundedLastFrame && 
                this.animator.currentAnimation?.name !== "toucheground";

            if (justTouchedGround) {
                this.animator.play("toucheground", false);
            } 
            else if (isReallyMoving) {
                this.animator.play("run", true);
            } 
            else if (this.animator.currentAnimation?.name !== "toucheground") {
                this.animator.play("idle", true);
            }

            this.wasGroundedLastFrame = true;
        } 
        // Jumping state
        else if (state === "jumping") {
            this.animator.play("jump", false);
            this.wasGroundedLastFrame = false;
        } 
        // Falling state
        else if (state === "falling") {
            this.animator.play("fall", true);
            this.wasGroundedLastFrame = false;
        }
    }
    
    fixed_update(fixedDeltaTime) {
        // Call parent's fixed_update for physics
        super.fixed_update(fixedDeltaTime);
        
        // Update animations based on state changes (visual update)
        this.updateAnimationState();

        if (this.animator) {
            this.animator.update();
        }
    }
    
    update(deltaTime) {
        super.update(deltaTime);
        
        // Save this physics data for other methods
        this.debugInfo = this.controller.getDebugInfo();
    }
    
    // Required by the rendering system
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
        // Position the character at the correct world position
        Matrix4.translate(modelTransform, modelTransform, [this.position.x, this.position.y, this.position.z]);
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
    
    
}