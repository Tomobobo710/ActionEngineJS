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
            jump_force: 3,
            springDamper: 0.5,
            rideHeight: 4,
            upwardStrength: 10,
            downwardStrength: 10,
            forceSmoothing: 0.1,
            rayLength: 20,
            
            
        });
        this.cameraDistance = 40;
        this.cameraHeight = 10;
        
        // Get the body out of the controller
        this.body = this.controller.body;
        this.body.position.set(0, 500, 0);

        // Fine tune physics properties if needed
        this.body.linear_damping = 0.1;
        this.body.angular_damping = 1;
        this.body.friction = 0.5;
        this.body.restitution = 0.2;

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

        this.controller.move(moveDir, deltaTime);

        if (input.isKeyPressed("Action1")) {
            this.controller.jump();
        }

        if (input.isKeyJustPressed("ActionDebugToggle")) {
            console.log("Character Debug:", this.controller.getDebugInfo());
        }
    }

    update(deltaTime) {
        
        this.controller.update();
        
        if (this.body) {
            const pos = this.body.position;
            this.position.set(pos.x, pos.y, pos.z);
            this.basePosition.set(this.position.x, this.position.y - this.size / 2, this.position.z);

            const rot = this.body.rotation;
            this.rotation = Math.atan2(2 * (rot.w * rot.y + rot.x * rot.z), 1 - 2 * (rot.y * rot.y + rot.x * rot.x));

            this.updateFacingDirection();
            this.updateTerrainInfo();
        }

        // Handle camera
        if (!this.camera.isDetached) {
            const cameraOffset = new Vector3(-Math.sin(this.rotation) * this.cameraDistance, this.cameraHeight, -Math.cos(this.rotation) * this.cameraDistance);

            this.camera.position = this.position.add(cameraOffset);
            this.camera.target = this.position.add(new Vector3(0, this.height / 2, 0));
        }
    }
}