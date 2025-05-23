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
        
        // Random battle system (same as ThirdPersonActionCharacter)
        this.movementTimer = 0;
        this.battleThreshold = this.generateNewBattleThreshold();
        this.isMoving = false;
    }
    
    /**
     * Generate a new random battle threshold (same as ThirdPersonActionCharacter)
     */
    generateNewBattleThreshold() {
        // Generate threshold between 2-22 seconds of movement
        return Math.random() * 20 + 2;
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
            isMovingThisFrame = true;
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
        
        // Random battle encounter logic (same as ThirdPersonActionCharacter)
        this.isMoving = isMovingThisFrame;
        if (isMovingThisFrame) {
            this.movementTimer += deltaTime;
            // Check if we've hit the time threshold for random encounter
            if (this.movementTimer >= this.battleThreshold) {
                // Reset timer and generate new threshold
                this.movementTimer = 0;
                this.battleThreshold = this.generateNewBattleThreshold();
                // Set pending battle transition only if random battles are enabled
                if (this.game.enableRandomBattles !== false) {
                    console.log('ActionFixedPerspectiveCharacter3D: Random encounter triggered!');
                    this.game.pendingBattleTransition = true;
                }
            }
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
            const justTouchedGround =
                !this.wasGroundedLastFrame && this.animator.currentAnimation?.name !== "toucheground";

            if (justTouchedGround) {
                this.animator.play("toucheground", false);
            } else if (isReallyMoving) {
                this.animator.play("run", true);
            } else if (this.animator.currentAnimation?.name !== "toucheground") {
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
}