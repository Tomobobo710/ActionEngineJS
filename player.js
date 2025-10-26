// Player class for 3D WebGL movement
export class Player {
    constructor(game, level) {
        this.game = game;
        this.level = level;

        // Player physics properties
        this.position = window.Vector3 ? new window.Vector3(5, 1.8, 5) : { x: 5, y: 1.8, z: 5 }; // Eye height of 1.8 units
        this.velocity = window.Vector3 ? new window.Vector3(0, 0, 0) : { x: 0, y: 0, z: 0 };
        this.rotation = window.Vector3 ? new window.Vector3(0, 0, 0) : { x: 0, y: 0, z: 0 }; // x = pitch, y = yaw
        this.moveSpeed = 15.0; // 3x faster movement
        this.jumpForce = 8.0;
        this.gravity = 20.0;
        this.friction = 8.0;

        // Collision properties
        this.radius = 0.5; // Player radius
        this.standingHeight = 1.8;
        this.crouchHeight = 1.2;
        this.height = this.standingHeight;
        this.isCrouching = false;
        this.crouchAmount = 0;
        this.crouchSpeed = 8.0; // Movement speed when crouching
        this.grounded = false;
        this.stepHeight = 0.5;

        // Camera properties
        this.viewMatrix = window.Matrix4 ? window.Matrix4.create() : new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        this.lookSensitivity = 0.002;
        this.maxPitch = Math.PI / 2 - 0.1;

        // Movement state
        this.isSprinting = false;
        this.sprintSpeed = 10.0;
        this.sprintStaminaMax = 100;
        this.sprintStamina = this.sprintStaminaMax;
        this.staminaRecoveryRate = 30;
        this.staminaDepletionRate = 25;

        // Flying state
        this.isFlying = false;
        this.flyingVelocity = window.Vector3 ? new window.Vector3(0, 0, 0) : { x: 0, y: 0, z: 0 };
        this.lastSpaceTapTime = 0;
        this.doubleTapWindow = 0.3; // seconds

        // Footstep sound timer
        this.footstepTimer = 0;
        this.footstepInterval = 0.4;
    }

    update(input, deltaTime) {
        // Update look direction
        this.updateRotation(input, deltaTime);

        // Simple crouching logic
        const targetCrouch = input.isKeyPressed("Action9") ? 0.6 : 0;

        if (targetCrouch > this.crouchAmount) {
            this.crouchAmount = Math.min(targetCrouch, this.crouchAmount + 3.0 * deltaTime);
        } else if (targetCrouch < this.crouchAmount) {
            this.crouchAmount = Math.max(targetCrouch, this.crouchAmount - 3.0 * deltaTime);
        }

        // Update actual player height for collisions
        this.height = this.standingHeight - this.crouchAmount;
        this.isCrouching = this.crouchAmount > 0.1;

        // Can't sprint while crouching
        this.isSprinting = !this.isCrouching && input.isKeyPressed("Action2") && this.sprintStamina > 0;

        // Handle sprint stamina
        if (this.isSprinting) {
            this.sprintStamina = Math.max(0, this.sprintStamina - this.staminaDepletionRate * deltaTime);
        } else {
            this.sprintStamina = Math.min(this.sprintStaminaMax, this.sprintStamina + this.staminaRecoveryRate * deltaTime);
        }

        // Handle flying toggle (double-tap space)
        if (input.isKeyJustPressed("Action1")) { // Space mapped to Action1
            const currentTime = performance.now() / 1000;
            if (currentTime - this.lastSpaceTapTime < this.doubleTapWindow) {
                this.isFlying = !this.isFlying;
                this.flyingVelocity = window.Vector3 ? new window.Vector3(0, 0, 0) : { x: 0, y: 0, z: 0 };
            }
            this.lastSpaceTapTime = currentTime;
        }

        // Calculate movement direction from keyboard input
        const moveDir = this.calculateMoveDirection(input);

        // Apply movement to velocity with proper speed modifier
        let currentSpeed = this.moveSpeed;
        if (this.isCrouching) {
            currentSpeed = this.crouchSpeed;
        } else if (this.isSprinting) {
            currentSpeed = this.sprintSpeed;
        }

        this.velocity.x = moveDir.x * currentSpeed;
        this.velocity.z = moveDir.z * currentSpeed;

        // Flying vertical movement (only when flying is enabled)
        if (this.isFlying) {
            if (input.isKeyPressed("Action3")) { // E - Up
                this.velocity.y = this.moveSpeed;
            } else if (input.isKeyPressed("Action4")) { // Q - Down
                this.velocity.y = -this.moveSpeed;
            } else if (!input.isKeyPressed("Action3") && !input.isKeyPressed("Action4")) {
                // No vertical input - maintain current Y velocity but slow it down
                this.velocity.y *= 0.9;
            }
        } else {
            // Normal gravity and jumping when not flying
            if (!this.grounded) {
                this.velocity.y -= this.gravity * deltaTime;
            } else if (input.isKeyJustPressed("Action1") && !this.isCrouching) {
                this.velocity.y = this.jumpForce;
                this.grounded = false;
            }
        }

        // Update position with collision detection
        this.updatePosition(deltaTime);

        // Update footstep sounds
        const footstepInterval = this.isSprinting ? this.footstepInterval / 2 : this.isCrouching ? this.footstepInterval * 1.5 : this.footstepInterval;
        this.updateFootsteps(deltaTime, moveDir, footstepInterval);
    }

    updateRotation(input, deltaTime) {
        if (this.game.inputManager.isCursorLocked()) {
            // Use movement data from pointer lock
            const sensitivity = this.lookSensitivity;
            const mouseDelta = this.game.inputManager.getMouseDelta();

            // Mouse look - natural FPS camera controls
            this.rotation.y += mouseDelta.x * sensitivity; // Left/right rotation (yaw)
            this.rotation.x += mouseDelta.y * sensitivity; // Up/down rotation (pitch) - positive when mouse moves down

            // NEW: Normalize Y rotation to prevent extreme values that break raycast
            this.rotation.y = ((this.rotation.y % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            if (this.rotation.y > Math.PI) this.rotation.y -= Math.PI * 2;

            // Clamp pitch to prevent flipping
            this.rotation.x = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.rotation.x));

            // Reset delta values after using them
            this.game.inputManager.resetMouseDelta();
        }
    }

    calculateMoveDirection(input) {
        // Create a movement vector in local space
        let dx = 0;
        let dz = 0;

        // Determine desired movement direction in LOCAL space
        if (input.isKeyPressed("DirUp")) dz -= 1;
        if (input.isKeyPressed("DirDown")) dz += 1;
        if (input.isKeyPressed("DirLeft")) dx -= 1;
        if (input.isKeyPressed("DirRight")) dx += 1;

        // Normalize diagonal movement
        const length = Math.sqrt(dx * dx + dz * dz);
        if (length > 0) {
            dx /= length;
            dz /= length;
        }

        // Convert local space movement to world space based on camera rotation
        const angle = this.rotation.y;
        const moveDir = window.Vector3 ?
            new window.Vector3(
                -dz * Math.sin(angle) + dx * Math.cos(angle),
                0,
                dz * Math.cos(angle) + dx * Math.sin(angle)
            ) : {
                x: -dz * Math.sin(angle) + dx * Math.cos(angle),
                y: 0,
                z: dz * Math.cos(angle) + dx * Math.sin(angle)
            };

        return moveDir;
    }

    updatePosition(deltaTime) {
        // Temp position for collision checking
        const newPosition = window.Vector3 ?
            new window.Vector3(
                this.position.x + this.velocity.x * deltaTime,
                this.position.y + this.velocity.y * deltaTime,
                this.position.z + this.velocity.z * deltaTime
            ) : {
                x: this.position.x + this.velocity.x * deltaTime,
                y: this.position.y + this.velocity.y * deltaTime,
                z: this.position.z + this.velocity.z * deltaTime
            };

        // Check collision with level
        const collision = this.checkCollision(newPosition);

        // Apply collision response
        if (collision.x) {
            newPosition.x = this.position.x;
            this.velocity.x = 0;
        }

        if (collision.y) {
            if (this.velocity.y < 0) {
                // Hit ground
                newPosition.y = collision.floorY;
                this.velocity.y = 0;
                this.grounded = true;
            } else {
                // Hit ceiling
                newPosition.y = this.position.y;
                this.velocity.y = 0;
            }
        } else {
            this.grounded = false;
        }

        if (collision.z) {
            newPosition.z = this.position.z;
            this.velocity.z = 0;
        }

        // Update position
        this.position = newPosition;
    }

    checkCollision(position) {
        const result = {
            x: false,
            y: false,
            z: false,
            floorY: 0
        };

        const playerMin = window.Vector3 ?
            new window.Vector3(
                position.x - this.radius,
                position.y - this.standingHeight,
                position.z - this.radius
            ) : {
                x: position.x - this.radius,
                y: position.y - this.standingHeight,
                z: position.z - this.radius
            };

        const playerMax = window.Vector3 ?
            new window.Vector3(
                position.x + this.radius,
                position.y - this.crouchAmount,
                position.z + this.radius
            ) : {
                x: position.x + this.radius,
                y: position.y - this.crouchAmount,
                z: position.z + this.radius
            };

        // Check against all level collision boxes
        for (const box of this.level.collisionBoxes) {
            if (
                playerMax.x > box.min.x &&
                playerMin.x < box.max.x &&
                playerMax.y > box.min.y &&
                playerMin.y < box.max.y &&
                playerMax.z > box.min.z &&
                playerMin.z < box.max.z
            ) {
                // Collision detected, determine the minimal penetration axis
                const penetrationX = Math.min(playerMax.x - box.min.x, box.max.x - playerMin.x);
                const penetrationY = Math.min(playerMax.y - box.min.y, box.max.y - playerMin.y);
                const penetrationZ = Math.min(playerMax.z - box.min.z, box.max.z - playerMin.z);

                // Resolve along minimal penetration axis
                if (penetrationX < penetrationY && penetrationX < penetrationZ) {
                    result.x = true;
                } else if (penetrationY < penetrationX && penetrationY < penetrationZ) {
                    result.y = true;

                    // Store floor height if colliding with top of box
                    if (playerMin.y < box.max.y && this.position.y >= box.max.y) {
                        result.floorY = box.max.y + this.standingHeight;
                    }
                } else {
                    result.z = true;
                }
            }
        }

        return result;
    }

    updateFootsteps(deltaTime, moveDir, interval) {
        // Only play footsteps when moving on the ground
        if (this.grounded && (moveDir.x !== 0 || moveDir.z !== 0)) {
            this.footstepTimer -= deltaTime;

            if (this.footstepTimer <= 0) {
                this.game.audio.play("footstep");
                this.footstepTimer = interval || this.footstepInterval;
            }
        }
    }

    getViewMatrix() {
        // Create view matrix
        if (window.Matrix4) {
            window.Matrix4.identity(this.viewMatrix);
            // Apply rotations
            window.Matrix4.rotateX(this.viewMatrix, this.viewMatrix, this.rotation.x);
            window.Matrix4.rotateY(this.viewMatrix, this.viewMatrix, this.rotation.y);
            // Apply position including crouch offset
            window.Matrix4.translate(this.viewMatrix, this.viewMatrix, [
                -this.position.x,
                -(this.position.y - this.crouchAmount),
                -this.position.z
            ]);
        }

        return this.viewMatrix;
    }
}