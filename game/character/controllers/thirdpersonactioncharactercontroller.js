class ThirdPersonActionCharacterController {
    constructor(character) {
        this.character = character;
        this.camera = character.camera;
        this.body = character.body;
        this.moveSpeed = 1;
        this.jumpForce = 1;
    }

    applyInput(input, deltaTime) {
        if (input.isKeyJustPressed("Numpad0")) {
            this.camera.isDetached = !this.camera.isDetached;
        }

        if (this.camera.isDetached) {
            this.camera.handleDetachedInput(input, deltaTime);
            return;
        }

        if (!this.body) return;

        const viewMatrix = this.camera.getViewMatrix();
        const moveDir = new Goblin.Vector3(0, 0, 0);
        
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

        // If we have movement, rotate to face movement direction
        if (moveDir.x !== 0 || moveDir.z !== 0) {
            const targetAngle = Math.atan2(moveDir.x, moveDir.z);
            
            // Calculate torque needed to rotate toward target angle
            const currentY = Math.atan2(this.body.transform[0], this.body.transform[2]);
            let angleDiff = targetAngle - currentY;
            
            // Normalize the angle difference
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            
            // Apply angular force using a torque vector on Y axis
            const torque = new Goblin.Vector3(0, angleDiff * 5, 0);
            this.body.applyForce(moveDir);
            this.body.applyForceAtLocalPoint(torque, new Goblin.Vector3(0, 1, 0));
        }

        if (input.isKeyPressed("Action1")) {
            const jumpVector = new Goblin.Vector3(0, this.jumpForce, 0);
            this.body.applyImpulse(jumpVector);
        }
    }

    updateCamera() {
        if (!this.camera.isDetached) {
            const cameraOffset = new Vector3(
                -Math.sin(this.character.rotation) * 20,
                10,
                -Math.cos(this.character.rotation) * 20
            );
            
            this.camera.position = this.character.position.add(cameraOffset);
            this.camera.target = this.character.position.add(new Vector3(0, this.character.height/2, 0));
        }
    }
}