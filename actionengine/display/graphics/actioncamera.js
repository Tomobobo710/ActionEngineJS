// actionengine/display/graphics/actioncamera.js
class ActionCamera {
    constructor(position, target) {
        this.position = position || new Vector3(0, 10, -20);
        this.target = target || new Vector3();
        this.up = new Vector3(0, 1, 0);
        this.yaw = 0;
        this.pitch = Math.PI / 6;
        this.fov = Math.PI * 0.35;

        // Add new camera control properties
        this.movementSpeed = 40;
        this.pitchSpeed = Math.PI;
        this.isDetached = false;
    }

    handleDetachedInput(input, deltaTime) {
        const forward = this.target.sub(this.position).normalize();
        const right = new Vector3(forward.z, 0, -forward.x).normalize();
        const MAX_PITCH = (89.9 * Math.PI) / 180;
        const speedMultiplier = 8;
        const moveSpeed = this.movementSpeed * speedMultiplier * deltaTime;
        const rotateSpeed = Math.PI * deltaTime;
        const verticalSpeed = this.movementSpeed * speedMultiplier * deltaTime;

        // Vertical movement
        if (input.isKeyPressed("NumpadAdd")) {
            const upMove = new Vector3(0, verticalSpeed, 0);
            this.position = this.position.add(upMove);
            this.target = this.target.add(upMove);
        }
        if (input.isKeyPressed("NumpadEnter")) {
            const downMove = new Vector3(0, -verticalSpeed, 0);
            this.position = this.position.add(downMove);
            this.target = this.target.add(downMove);
        }

        // Forward/Backward & Strafe movement
        let moveDir = new Vector3(0, 0, 0);
        if (input.isKeyPressed("Numpad8")) moveDir = moveDir.add(forward);
        if (input.isKeyPressed("Numpad2")) moveDir = moveDir.add(forward.mult(-1));
        if (input.isKeyPressed("Numpad6")) moveDir = moveDir.add(right.mult(-1));
        if (input.isKeyPressed("Numpad4")) moveDir = moveDir.add(right);

        if (moveDir.length() > 0) {
            const movement = moveDir.normalize().mult(moveSpeed);
            this.position = this.position.add(movement);
            this.target = this.target.add(movement);
        }

        // Yaw rotation
        if (input.isKeyPressed("Numpad7") || input.isKeyPressed("Numpad9")) {
            const targetToCamera = this.position.sub(this.target);
            const rotationAngle = (input.isKeyPressed("Numpad7") ? 1 : -1) * rotateSpeed;
            const rotated = targetToCamera.rotateY(rotationAngle);
            this.position = this.target.add(rotated);
        }

        // Pitch control
        if (input.isKeyPressed("Numpad1") || input.isKeyPressed("Numpad3")) {
            const targetToCamera = this.position.sub(this.target);
            const distance = targetToCamera.length();
            const currentPitch = Math.asin(targetToCamera.y / distance);
            const pitchDelta = this.pitchSpeed * deltaTime * (input.isKeyPressed("Numpad1") ? 1 : -1);
            const newPitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, currentPitch + pitchDelta));
            
            const horizontalDistance = distance * Math.cos(newPitch);
            const verticalDistance = distance * Math.sin(newPitch);
            const horizontalDir = targetToCamera.horizontalNormalize();

            this.position = this.target.add(
                horizontalDir.mult(horizontalDistance).add(new Vector3(0, verticalDistance, 0))
            );
        }
    }

    getViewMatrix() {
        const forward = this.target.sub(this.position).normalize();
        const right = forward.cross(this.up).normalize();
        const up = right.cross(forward);

        return {
            forward,
            right,
            up,
            position: this.position
        };
    }
}