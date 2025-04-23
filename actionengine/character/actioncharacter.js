// game/character/basecharacter/actioncharacter.js
class ActionCharacter extends RenderableObject {
    constructor(camera, game) {
        super();

        this.game = game;
        this.camera = camera;
        
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
        // Get the character body from the controller
        this.body = this.controller.body;
        this.body.position.set(0, 500, 0);

        // Add debug tracking
        this.body.debugName = `CharacterBody_${Date.now()}`;
        this.body.createdAt = Date.now();

        // Get the character body from the controller
        this.body = this.controller.body;
        
        // Fine tune physics properties if needed
        this.body.linear_damping = 0.01;
        this.body.angular_damping = 0;
        this.body.friction = 0;
        this.body.restitution = 0.2;
        const worldGravity = game.physicsWorld.getWorld().gravity;
        const gravityMultiplier = 1;
        this.body.setGravity(
            worldGravity.x * gravityMultiplier,
            worldGravity.y * gravityMultiplier,
            worldGravity.z * gravityMultiplier
        );
        
        // Add character body to physics world
        this.game.physicsWorld.getWorld().addRigidBody(this.body);
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
        this.controller.update(deltaTime);
        if (this.body) {
            const pos = this.body.position;

            this.position.set(pos.x, pos.y, pos.z);
            this.basePosition.set(this.position.x, this.position.y - this.size / 2, this.position.z);

            // Use yaw for character facing
            this.rotation = this.cameraYaw + Math.PI;

            this.updateFacingDirection();

            if (!this.camera.isDetached) {
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

                    this.camera.position = this.position.add(cameraOffset);
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
        this.triangles = this.getCharacterModelTriangles();
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

    
    // Original method - mainly used by 2d renderer
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
        // Uncomment and use this line to position the character at the correct world position
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

    updateFacingDirection() {
        this.facingDirection = new Vector3(
            Math.sin(this.rotation), // X component
            0, // Y component (flat on xz plane)
            Math.cos(this.rotation) // Z component
        );
    }
}