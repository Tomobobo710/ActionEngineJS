class ThirdPersonActionCharacter extends ActionCharacter {
    constructor(terrain, camera, game) {
        super(camera);
        this.game = game;
        this.terrain = terrain;
        
        // Add these new properties
        this.movementTimer = 0;
        this.battleThreshold = this.generateNewBattleThreshold();
        this.isMoving = false;
        
        this.debugInfo = null;
        // Create controller
        this.controller = new Goblin.CharacterController(game.physicsWorld.getWorld());

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

        // Add debug tracking
        this.body.debugName = `CharacterBody_${Date.now()}`;
        this.body.createdAt = Date.now();

         // Get the character body from the controller
        this.body = this.controller.body;

        // Use saved position if available, otherwise use default
        const savedState = game.gameModeManager.gameMaster.getPlayerState();
        if (savedState && savedState.position) {
            this.body.position.set(
                savedState.position.x,
                savedState.position.y,
                savedState.position.z
            );
        } else {
            this.body.position.set(0, 500, 0);
        }
        
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
        
        // Terrain info
        this.gridPosition = { x: 0, z: 0 };
        this.currentBiome = null;
        this.heightPercent = 0;
        this.terrainHeight = 0;
        this.updateTerrainInfo();

        this.debug = false;
    }

    generateNewBattleThreshold() {
    // Generate threshold between 20-30 seconds of movement
        return Math.random() * 20 + 2;
    }
    getTerrainHeightAtPosition(worldX, worldZ) {
        const scaledX = worldX * 2;
        const scaledZ = worldZ * 2;

        const x = Math.floor(scaledX / this.terrain.baseWorldScale + this.terrain.gridResolution / 2);
        const z = Math.floor(scaledZ / this.terrain.baseWorldScale + this.terrain.gridResolution / 2);

        if (x < 0 || x >= this.terrain.gridResolution || z < 0 || z >= this.terrain.gridResolution) {
            return 0;
        }

        return this.terrain.heightMap[z][x];
    }

    getHeightOnTriangle(triangle, x, z) {
        const [v1, v2, v3] = triangle.vertices;

        const denominator = (v2.z - v3.z) * (v1.x - v3.x) + (v3.x - v2.x) * (v1.z - v3.z);
        const a = ((v2.z - v3.z) * (x - v3.x) + (v3.x - v2.x) * (z - v3.z)) / denominator;
        const b = ((v3.z - v1.z) * (x - v3.x) + (v1.x - v3.x) * (z - v3.z)) / denominator;
        const c = 1 - a - b;

        return a * v1.y + b * v2.y + c * v3.y;
    }

    /**
     * Gets the transformed triangles for rendering the character model.
     * Since animation updates happen separately through ModelAnimationController,
     * this method only handles vertex transformations and skinning.
     *
     * @returns {Triangle[]} Array of transformed triangles ready for rendering
     */
    
    updateTerrainInfo() {
        this.gridPosition.x = Math.floor(
            this.basePosition.x / this.terrain.baseWorldScale + this.terrain.gridResolution / 2
        );
        this.gridPosition.z = Math.floor(
            this.basePosition.z / this.terrain.baseWorldScale + this.terrain.gridResolution / 2
        );

        this.terrainHeight = this.getTerrainHeightAtPosition(this.basePosition.x, this.basePosition.z);
        this.heightPercent = (this.basePosition.y / this.terrain.generator.getBaseWorldHeight()) * 100;

        for (const [biomeName, biomeData] of Object.entries(BIOME_TYPES)) {
            if (this.heightPercent >= biomeData.heightRange[0] && this.heightPercent <= biomeData.heightRange[1]) {
                this.currentBiome = biomeName;
                break;
            }
        }
    }

    getCurrentTriangle() {
        const triangles = this.terrain.triangles;
        // Direct triangle access
        for (const triangle of triangles) {
            const v1 = triangle.vertices[0];
            const v2 = triangle.vertices[1];
            const v3 = triangle.vertices[2];

            const p = this.position;
            const d1 = MathUtils.sign(p, v1, v2);
            const d2 = MathUtils.sign(p, v2, v3);
            const d3 = MathUtils.sign(p, v3, v1);

            const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
            const hasPos = d1 > 0 || d2 > 0 || d3 > 0;

            if (!(hasNeg && hasPos)) {
                const avgHeight = (v1.y + v2.y + v3.y) / 3;

                let biomeType = "SNOW";
                for (const [type, data] of Object.entries(BIOME_TYPES)) {
                    const heightPercent = (avgHeight / this.terrain.generator.getBaseWorldHeight()) * 100;
                    if (heightPercent >= data.heightRange[0] && heightPercent <= data.heightRange[1]) {
                        biomeType = type;
                        break;
                    }
                }

                return {
                    vertices: [v1, v2, v3],
                    indices: [0, 1, 2],
                    minY: Math.min(v1.y, v2.y, v3.y),
                    maxY: Math.max(v1.y, v2.y, v3.y),
                    avgY: avgHeight,
                    normal: triangle.normal,
                    biome: biomeType
                };
            }
        }
        return null;
    }
    
    applyInput(input, deltaTime) {
        if (input.isKeyJustPressed("Numpad0")) {
            this.camera.isDetached = !this.camera.isDetached;
        }
        if (this.camera.isDetached) {
            this.camera.handleDetachedInput(input, deltaTime);
            return;
        }

       if (input.isKeyJustPressed("Action8")) {
            this.game.pendingMenuTransition = true;  // Set flag instead of switching directly
        }
        
        if (input.isKeyJustPressed("Action5")) {
            this.animator.play("attack", false); // animation test
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

        // Increment timer based on movement and grounded state
        if (isMovingThisFrame && this.debugInfo?.state?.current === "grounded") {
            this.movementTimer += deltaTime;

            // Check if we've hit the time threshold
            if (this.movementTimer >= this.battleThreshold) {
                // Reset timer and generate new threshold
                this.movementTimer = 0;
                this.battleThreshold = this.generateNewBattleThreshold();

                // Set pending battle transition
                this.game.pendingBattleTransition = true;
            }
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

            // Update animations based on state changes
            this.updateAnimationState();

            if (this.animator) {
                this.animator.update();
            }

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
    
    updateAnimationState() {
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
        if (this.debug) {
            // Optional debug logging
            console.log("Animation Update:", {
                state, 
                horizontalSpeed, 
                isReallyMoving, 
                currentAnim: this.animator.currentAnimation?.name
            });
        }
    }
    
    getBattleSystemDebugInfo() {
        return {
            movementTimer: this.movementTimer.toFixed(2),
            battleThreshold: this.battleThreshold.toFixed(2),
            timeRemaining: (this.battleThreshold - this.movementTimer).toFixed(2),
            isGrounded: this.debugInfo?.state?.current === "grounded"
        };
    }
    
    getDebugInfo() {
        return this.debugInfo;
    }
}