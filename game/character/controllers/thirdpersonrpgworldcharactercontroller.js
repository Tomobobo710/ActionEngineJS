// game/character/controller/thirdpersonRPGWorldcharactercontroller.js
class ThirdPersonRPGWorldCharacterController {
    constructor(character) {
        this.character = character;
        this.speed = 100;
        this.isJumping = false;
        this.jumpSpeed = 80;

        // Add velocity and physics properties
        this.velocity = new Vector3(0, 0, 0);
        this.gravity = 100;
        this.groundContact = false;
        this.airControl = 0.3; // Multiplier for air movement
    }

    applyInput(input, deltaTime) {
        const frameSpeed = this.speed * (60 * deltaTime);
        const rotationSpeed = 0.05 * (60 * deltaTime);

        // Calculate movement direction
        let moveX = 0;
        let moveZ = 0;
        if (input.isKeyPressed("DirUp")) {
            moveX -= Math.sin(this.character.rotation);
            moveZ -= Math.cos(this.character.rotation);
        }
        if (input.isKeyPressed("DirDown")) {
            moveX += Math.sin(this.character.rotation);
            moveZ += Math.cos(this.character.rotation);
        }

        // Apply movement forces
        const controlMultiplier = this.groundContact ? 1 : this.airControl;
        if (moveX !== 0 || moveZ !== 0) {
            if (this.groundContact) {
                // On ground - add to velocity directly
                this.velocity.x += moveX * frameSpeed;
                this.velocity.z += moveZ * frameSpeed;
            } else {
                // In air - modify existing velocity
                this.velocity.x = this.velocity.x * (1 - this.airControl) + moveX * frameSpeed * this.airControl;
                this.velocity.z = this.velocity.z * (1 - this.airControl) + moveZ * frameSpeed * this.airControl;
            }
        }

        if (input.isKeyPressed("DirLeft")) {
            this.character.rotation += rotationSpeed;
        }
        if (input.isKeyPressed("DirRight")) {
            this.character.rotation -= rotationSpeed;
        }

        if (input.isKeyPressed("Action1") && this.groundContact) {
            this.velocity.y = this.jumpSpeed;
            this.groundContact = false;
        }
    }

    getHeightOnTriangle(triangle, x, z) {
        const [v1, v2, v3] = triangle.vertices;

        const denominator = (v2.z - v3.z) * (v1.x - v3.x) + (v3.x - v2.x) * (v1.z - v3.z);
        const a = ((v2.z - v3.z) * (x - v3.x) + (v3.x - v2.x) * (z - v3.z)) / denominator;
        const b = ((v3.z - v1.z) * (x - v3.x) + (v1.x - v3.x) * (z - v3.z)) / denominator;
        const c = 1 - a - b;

        return a * v1.y + b * v2.y + c * v3.y;
    }

    update(deltaTime) {
        // Apply gravity
        if (!this.groundContact) {
            this.velocity.y -= this.gravity * deltaTime;
        }

        // Apply friction when on ground
        if (this.groundContact) {
            this.velocity.x *= 0.5;
            this.velocity.z *= 0.5;
        }

        // Update position with velocity
        this.character.position.x += this.velocity.x * deltaTime;
        this.character.position.y += this.velocity.y * deltaTime;
        this.character.position.z += this.velocity.z * deltaTime;

        // Ground collision check
        const triangle = this.character.getCurrentTriangle();
        if (triangle) {
            const surfaceY = this.getHeightOnTriangle(triangle, this.character.position.x, this.character.position.z);

            const groundY = surfaceY + this.character.size / 2;
            if (this.character.position.y <= groundY) {
                this.character.position.y = groundY;
                this.velocity.y = 0;
                this.groundContact = true;
            } else {
                this.groundContact = false;
            }
        }

        this.character.basePosition = new Vector3(
            this.character.position.x,
            this.character.position.y - this.character.size / 2,
            this.character.position.z
        );

        this.character.updateTerrainInfo();
        this.updateCamera();
    }

    updateCamera() {
        const distance = 30;
        const height = 20;

        this.character.camera.position = new Vector3(
            this.character.basePosition.x + Math.sin(this.character.rotation) * distance,
            this.character.basePosition.y + height,
            this.character.basePosition.z + Math.cos(this.character.rotation) * distance
        );

        this.character.camera.target = new Vector3(
            this.character.basePosition.x,
            this.character.basePosition.y,
            this.character.basePosition.z
        );
    }
}