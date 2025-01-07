class ThirdPersonActionCharacter extends ActionCharacter {
    constructor(terrain, camera, game) {
        super(terrain, camera);
        this.game = game;
        console.log("World:", game.physicsWorld.getWorld());
        console.log("Broadphase:", game.physicsWorld.broadphase);
        // Create controller with the right dimensions
        this.controller = new Goblin.CharacterController(game.physicsWorld.getWorld(), {
            width: this.size,
            height: this.height,
            depth: this.size,
            mass: 1,
            moveSpeed: 0.5,
            maxSpeed: 30,
            springDamper: 0.5,
            rideHeight: 4,
            upwardStrength: 10,
            downwardStrength: 10,
            forceSmoothing: 0.1,
            rayLength: 20
        });
        this.cameraDistance = 40;
        this.cameraHeight = 10;
        this.cameraRotationX = 0; // Vertical rotation
        this.cameraRotationY = 0; // Horizontal rotation
        this.lastPointerX = null;
        this.lastPointerY = null;
        this.firstPersonHeight = this.height * 0.5; 
        this.isFirstPerson = false;
        
        
        // Get the character body from the controller
        this.body = this.controller.body;
        this.body.position.set(0, 500, 0);
        
        // Fine tune physics properties if needed
        this.body.linear_damping = 0.1;
        this.body.angular_damping = 1;
        this.body.friction = 0.5;
        this.body.restitution = 0.2;
        
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

            // Only update camera when lastPointer values change
            if (this.lastPointerX !== movement.x || this.lastPointerY !== movement.y) {
                this.cameraRotationY -= movement.x * mouseSensitivity;

                // Invert Y movement in first person mode
                if (this.isFirstPerson) {
                    this.cameraRotationX += movement.y * mouseSensitivity; // Note the + instead of -
                } else {
                    this.cameraRotationX -= movement.y * mouseSensitivity; // Third person remains the same
                }

                // Update last positions
                this.lastPointerX = movement.x;
                this.lastPointerY = movement.y;
            }

            // Keep the existing clamp for vertical rotation
            this.cameraRotationX = Math.max(-1.57, Math.min(1.57, this.cameraRotationX));
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

        this.controller.move(moveDir, deltaTime);

        if (input.isKeyPressed("Action1")) {
            //this.controller.jump();
        }

        if (input.isKeyJustPressed("ActionDebugToggle")) {
            console.log("Character Debug:", this.controller.getDebugInfo());
        }
        
    }

    update(deltaTime) {

        if (this.body) {
            const pos = this.body.position;
            this.position.set(pos.x, pos.y, pos.z);
            this.basePosition.set(this.position.x, this.position.y - this.size / 2, this.position.z);

            // Use camera rotation for character facing
            this.rotation = this.cameraRotationY;
            this.updateFacingDirection();

            // Update camera position and target based on mode
            if (!this.camera.isDetached) {
                if (this.isFirstPerson) {
                    // First-person camera positioning
                    this.camera.position = this.position.add(new Vector3(0, this.firstPersonHeight, 0));
                    
                    // Calculate look target using rotation
                    const lookDir = new Vector3(
                        Math.sin(this.cameraRotationY) * Math.cos(this.cameraRotationX),
                        -Math.sin(this.cameraRotationX),
                        Math.cos(this.cameraRotationY) * Math.cos(this.cameraRotationX)
                    );
                    this.camera.target = this.camera.position.add(lookDir);
                } else {
                    // Existing third-person camera positioning
                    const cameraOffset = new Vector3(
                        Math.sin(this.cameraRotationY) * Math.cos(this.cameraRotationX) * this.cameraDistance,
                        -Math.sin(this.cameraRotationX) * this.cameraDistance + this.cameraHeight,
                        Math.cos(this.cameraRotationY) * Math.cos(this.cameraRotationX) * this.cameraDistance
                    );

                    this.camera.position = this.position.add(cameraOffset);
                    this.camera.target = this.position.add(new Vector3(0, this.height / 2, 0));
                }
            }

            this.updateTerrainInfo();
        }
    }

}