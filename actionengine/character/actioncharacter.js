//actionengine/character/actioncharacter.js
// game/character/basecharacter/actioncharacter.js

class ActionCharacter extends RenderableObject {
    constructor(camera, game, position) {
        super();

        this.game = game;
        this.camera = camera;

        // Character is dynamic (animated vertices)
        this.isStatic = false;

        // Stable mesh ID for animated characters to reuse GPU buffers across frames
        this._stableMeshId = `character_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        this.height = 6;
        this.scale = 1;

        this.isFirstPerson = false;
        this.firstPersonHeight = this.height * 0.5;

        this.basePosition = new Vector3(0, 0, 0); // Ground position
        this.position = new Vector3(0, 40, 0); // Center position

        this.facingDirection = new Vector3(0, 0, 1);
        this.rotation = 0;

        this.debugInfo = null;

        // Camera properties
        this.cameraDistance = 40;
        this.cameraHeight = 10;
        this.cameraPitch = 0;
        this.cameraYaw = 0;

        // Store pointer position for camera movment
        this.lastPointerX = null;
        this.lastPointerY = null;
        this.swipeStartX = null;
        this.swipeStartY = null;

        // Create controller
        this.controller = new Goblin.CharacterController(this.game.physicsWorld.getWorld());

        // Character follows camera orientation by default
        this.followCameraRotation = true;

        // Wrap the controller's backend body in the engine's physics wrapper so this character
        // touches physics through the SAME contract as everything else (ActionRigidBody3D) — no
        // raw Goblin body on the public surface. (The Goblin.CharacterController itself still
        // drives motion; this hides the body, the part that was leaking the backend.)
        this.body = new ActionRigidBody3D(this.controller.body);

        if (position) {
            this.body.position = new Vector3(position.x, position.y, position.z);
        } else {
            this.body.position = new Vector3(0, 500, 0);
        }

        this.body.name = `CharacterBody_${Date.now()}`;

        // Fine tune physics properties if needed
        this.body.linearDamping = 0.01;
        this.body.angularDamping = 0;
        this.body.friction = 0;
        this.body.restitution = 0.2;
        const worldGravity = game.physicsWorld.getWorld().gravity;
        const gravityMultiplier = 1;
        this.body.setGravity(new Vector3(
            worldGravity.x * gravityMultiplier,
            worldGravity.y * gravityMultiplier,
            worldGravity.z * gravityMultiplier
        ));
        this.characterVisualYOffset = 0.75;
        // Add character body to physics world (the world's add takes the backend body).
        this.game.physicsWorld.getWorld().addRigidBody(this.body.goblinBody);

        // Initial visual update to populate triangles
        this.updateVisual();
    }

    applyInput(input, deltaTime) {
        if (input.isKeyJustPressed("Numpad0")) {
            this.camera.isDetached = !this.camera.isDetached;
        }
        if (this.camera.isDetached) {
            this.camera.handleDetachedInput(input, deltaTime);
            return;
        }

        if (input.isKeyJustPressed("Action6")) {
            this.isFirstPerson = !this.isFirstPerson;
        }

        // Handle pointer lock with Action7 (C key)
        if (input.isKeyJustPressed("Action7")) {
            if (document.pointerLockElement) {
                document.exitPointerLock();
            } else {
                document.body.requestPointerLock();
            }
        }

        // Update camera rotation based on pointer movement when locked
        if (document.pointerLockElement) {
            const mouseSensitivity = 0.01;
            const movement = input.getLockedPointerMovement();

            if (this.lastPointerX !== movement.x || this.lastPointerY !== movement.y) {
                this.cameraYaw -= movement.x * mouseSensitivity;

                if (this.isFirstPerson) {
                    this.cameraPitch += movement.y * mouseSensitivity;
                } else {
                    this.cameraPitch -= movement.y * mouseSensitivity;
                }

                this.lastPointerX = movement.x;
                this.lastPointerY = movement.y;
            }

            this.cameraPitch = Math.max(-1.57, Math.min(1.57, this.cameraPitch));
        }

        // Handle swipe camera control
        if (!document.pointerLockElement) {
            const pointerPos = input.getPointerPosition();

            // Start tracking swipe
            if (input.isPointerJustDown()) {
                this.swipeStartX = pointerPos.x;
                this.swipeStartY = pointerPos.y;
            }

            // Update camera during swipe
            if (input.isPointerDown() && this.swipeStartX !== null) {
                const deltaX = pointerPos.x - this.swipeStartX;
                const deltaY = pointerPos.y - this.swipeStartY;

                const swipeSensitivity = 0.005;
                this.cameraYaw -= deltaX * swipeSensitivity;

                if (this.isFirstPerson) {
                    this.cameraPitch += deltaY * swipeSensitivity;
                } else {
                    this.cameraPitch -= deltaY * swipeSensitivity;
                }

                this.cameraPitch = Math.max(-1.57, Math.min(1.57, this.cameraPitch));

                // Update start position for next frame
                this.swipeStartX = pointerPos.x;
                this.swipeStartY = pointerPos.y;
            } else {
                // Reset swipe tracking when pointer is released
                this.swipeStartX = null;
                this.swipeStartY = null;
            }
        }

        // Get input direction relative to camera
        const viewMatrix = this.camera.getViewMatrix();
        const moveDir = new Goblin.Vector3();

        // Track if we're moving this frame
        let isMovingThisFrame = false;

        // Get input direction relative to camera
        if (input.isKeyPressed("DirUp")) {
            moveDir.x += viewMatrix.forward.x;
            moveDir.z += viewMatrix.forward.z;
            isMovingThisFrame = true;
        }
        if (input.isKeyPressed("DirDown")) {
            moveDir.x -= viewMatrix.forward.x;
            moveDir.z -= viewMatrix.forward.z;
            isMovingThisFrame = true;
        }
        if (input.isKeyPressed("DirRight")) {
            moveDir.x += viewMatrix.right.x;
            moveDir.z += viewMatrix.right.z;
            isMovingThisFrame = true;
        }
        if (input.isKeyPressed("DirLeft")) {
            moveDir.x -= viewMatrix.right.x;
            moveDir.z -= viewMatrix.right.z;
            isMovingThisFrame = true;
        }

        // Normalize the movement vector if moving diagonally
        if (moveDir.lengthSquared() > 0) {
            moveDir.normalize();
        }

        if (input.isKeyJustPressed("Action1")) {
            this.controller.wishJump();
        }
        this.controller.handleInput(moveDir);

        if (input.isKeyJustPressed("ActionDebugToggle")) {
            console.log("Character Debug:", this.controller.getDebugInfo());
        }
    }

    update(deltaTime) {
        // Physics is now handled in fixed_update, only do non-physics updates here
    }

    fixed_update(fixedDeltaTime) {
        // Physics and character controller updates should be handled in fixed timestep
        this.controller.update(fixedDeltaTime);
        if (this.body) {
            const pos = this.body.position;

            this.position.set(pos.x, pos.y, pos.z);
            this.basePosition.set(this.position.x, this.position.y - this.height / 2, this.position.z);

            // Sync with RenderableObject transform for the GPU renderer
            this.transform.position.set(pos.x, pos.y, pos.z);

            if (this.followCameraRotation) {
                // Use yaw for character facing
                this.rotation = this.cameraYaw + Math.PI;
                this.transform.rotationY = this.rotation; // Sync rotation too
            } else {
                // Otherwise just sync the current rotation to the transform
                this.transform.rotationY = this.rotation;
            }

            this.updateFacingDirection();

            if (!this.camera.isDetached) {
                // Initialize camera collision handler if needed
                if (!this.cameraCollisionHandler && this.game && this.game.physicsWorld) {
                    this.cameraCollisionHandler = new CameraCollisionHandler(this.game.physicsWorld);
                }

                if (this.isFirstPerson) {
                    this.camera.position = this.position.add(new Vector3(0, this.firstPersonHeight, 0));

                    const lookDir = new Vector3(
                        Math.sin(this.cameraYaw + Math.PI) * Math.cos(this.cameraPitch),
                        -Math.sin(this.cameraPitch),
                        Math.cos(this.cameraYaw + Math.PI) * Math.cos(this.cameraPitch)
                    );
                    this.camera.target = this.camera.position.add(lookDir);
                } else {
                    const cameraOffset = new Vector3(
                        Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance,
                        -Math.sin(this.cameraPitch) * this.cameraDistance + this.cameraHeight,
                        Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance
                    );

                    // Calculate desired camera position without collision
                    const desiredCameraPosition = this.position.add(cameraOffset);

                    // Apply camera collision if handler exists
                    if (this.cameraCollisionHandler) {
                        // Adjust camera position for collisions - no smoothing
                        this.camera.position = this.cameraCollisionHandler.adjustCameraPosition(
                            this.position,
                            desiredCameraPosition,
                            1.6 // Camera collision radius
                        );
                    } else {
                        // Fall back to original behavior if no collision handler
                        this.camera.position = desiredCameraPosition;
                    }

                    this.camera.target = this.position.add(new Vector3(0, this.height / 2, 0));
                }
            }
        }

        // Store debug info
        if (this.controller) {
            this.debugInfo = this.controller.getDebugInfo();
        }
    }

    // Standard method for renderable objects
    updateVisual() {
        // For GPU skeletal animation, we use the bind-pose geometry
        // Animation is done in the vertex shader with bone matrices
        if (!this._bindPoseTriangles && this.characterModel) {
            // Cache bind-pose triangles on first call
            this._bindPoseTriangles = this.getBindPoseTriangles();
        }
        this.triangles = this._bindPoseTriangles || [];
        this.updateModelMatrix();
    }

    updateModelMatrix() {
        // Calculate the model matrix based on position and facing direction
        const angle = Math.atan2(this.facingDirection.x, this.facingDirection.z);
        this.modelMatrix = Matrix4.create();

        // Apply rotation around character's local origin first
        Matrix4.rotateY(this.modelMatrix, this.modelMatrix, angle);

        // Then translate to world position
        Matrix4.translate(this.modelMatrix, this.modelMatrix, [this.position.x, this.position.y, this.position.z]);
    }

    // Get bind-pose triangles (geometry in T-pose without animation)
    // These are uploaded to GPU once and reused for all animation frames
    getBindPoseTriangles() {
        if (!this.characterModel) return [];

        const transformedTriangles = [];
        const modelTransform = Matrix4.create();
        Matrix4.translate(modelTransform, modelTransform, [0, this.characterVisualYOffset, 0]);

        // Use raw vertex positions without skinning (bind-pose)
        for (const triangle of this.characterModel.getAllTrianglesLocal()) {
            const transformedVerts = [];
            for (let i = 0; i < triangle.vertices.length; i++) {
                transformedVerts.push(Vector3.transformMat4(triangle.vertices[i], modelTransform));
            }

            const newTriangle = new Triangle(
                transformedVerts[0],
                transformedVerts[1],
                transformedVerts[2],
                triangle.color
            );
            // CRITICAL: Copy bone weight data so GPU shader can apply skinning
            newTriangle.jointData = triangle.jointData;
            newTriangle.weightData = triangle.weightData;

            transformedTriangles.push(newTriangle);
        }

        return transformedTriangles;
    }

    // Get current bone matrices for GPU animation
    // Called by renderer each frame to upload to shader uniform
    getBoneMatrices() {
        const skin = this.characterModel.skins[0];
        skin.update(this.characterModel.nodes);

        // Return joint matrices (pad with identity for unused bones)
        const matrices = [];
        for (let i = 0; i < skin.jointMatrices.length; i++) {
            matrices.push(skin.jointMatrices[i]);
        }
        // Pad remaining slots with identity matrices
        for (let i = matrices.length; i < 256; i++) {
            matrices.push(Matrix4.identity(Matrix4.create()));
        }

        return matrices;
    }

    // Original method - mainly used by 2d renderer
    getCharacterModelTriangles() {
        if (!this.characterModel) return [];

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

        Matrix4.translate(modelTransform, modelTransform, [0, this.characterVisualYOffset, 0]);

        const transformedTriangles = [];
        const skin = this.characterModel.skins[0];

        // Process each triangle in the model
        for (const triangle of this.characterModel.getAllTrianglesLocal()) {
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
