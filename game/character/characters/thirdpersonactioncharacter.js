class ThirdPersonActionCharacter extends ActionCharacter {
    constructor(terrain, camera, game) {
        super(terrain, camera);
        this.game = game;
        this.debugInfo = null;
        // Create controller
        this.controller = new Goblin.CharacterController(game.physicsWorld.getWorld(), {
            width: this.size,
            height: this.height,
            depth: this.size,
            mass: 1,
            jumpForce: 60,
            moveSpeed: 50,
            maxSpeed: 50,
            springDamper: 1,
            springStrength: 10,
            rideHeight: 4,
            forceSmoothing: 0.1,
            rayLength: 6
        });

        this.firstPersonHeight = this.height * 0.5;
        this.isFirstPerson = false;

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
        
        // Get the character body from the controller
        this.body = this.controller.body;
        this.body.position.set(0, 500, 0);

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
        game.physicsWorld.getWorld().addRigidBody(this.body);

        this.debug = true;
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
                //console.log(`Mouse Movement: x=${movement.x}, y=${movement.y}`);

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

        // Get input direction relative to camera
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

        // Normalize the movement vector if moving diagonally
        if (moveDir.lengthSquared() > 0) {
            moveDir.normalize();
        }
        if (input.isKeyJustPressed("Action1")) {
            this.controller.wishJump(); // not implemented
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

            // Check if we're below 0
            if (pos.y < 0) {
                // Get current triangle
                const currentTriangle = this.getCurrentTriangle();
                if (currentTriangle) {
                    // Set position 10 units above exact height on triangle
                    const heightOnTriangle = this.getHeightOnTriangle(currentTriangle, pos.x, pos.z);
                    pos.y = heightOnTriangle + 10;

                    // Reset velocities
                    this.body.linear_velocity.set(0, 0, 0);
                    this.body.angular_velocity.set(0, 0, 0);

                    // Force state to falling
                    this.controller.changeState("falling");
                }
            }

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

    getDebugInfo() {
        return this.debugInfo;
    }
}