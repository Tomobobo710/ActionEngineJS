class Fisher {
    constructor(game, position = new Vector3(0, 10, -50)) {
        this.game = game;
        this.position = position;
        this.lure = null;
        this.state = "ready";
        this.castDirection = new Vector3(1, -0.5, 0).normalize();
        this.aimAngle = 0;
        this.aimElevation = -0.5;
        this.castPower = 0;
        this.maxCastPower = 10;
        this.castPowerRate = 3;
        this.isChargingCast = false;

        // Create the visual model and set reference
        this.model = new FishermanModel(game.physicsWorld, 10, position);
        this.model.fisher = this;

        this.floatOffset = 30;
        this.floatLerpFactor = 0.1;

        this.minCastStrength = 20;
        this.maxCastStrength = 300;

        this.isReeling = false;
        this.lineLength = 0; // Current line length
        this.maxLineLength = 200; // Maximum line length
        this.lineTension = 0; // 0-1, where 1 is about to snap
        this.reelSpeed = 30; // Base reel-in speed
    }

    attachLure(lure) {
        this.lure = lure;
        this.lure.setFisher(this);
        this.lure.state = "inactive";
    }

    update(deltaTime, input) {
        const waterHeight = this.game.ocean.getWaterHeightAt(this.position.x, this.position.z);

        const targetY = waterHeight + this.floatOffset;
        this.position.y += (targetY - this.position.y) * this.floatLerpFactor;

        if (this.model && this.model.body) {
            this.model.body.position.x = this.position.x;
            this.model.body.position.y = this.position.y;
            this.model.body.position.z = this.position.z;
        }

        // Keep lure with fisher when not cast
        if (this.state === "ready" && this.lure) {
            this.lure.position.x = this.position.x;
            this.lure.position.y = this.position.y;
            this.lure.position.z = this.position.z;

            // Update lure's body position as well
            this.lure.body.position.x = this.position.x;
            this.lure.body.position.y = this.position.y;
            this.lure.body.position.z = this.position.z;
        }

        if (this.state === "ready") {
            if (input.isKeyPressed("DirLeft")) {
                this.aimAngle += 1.5 * deltaTime;
            }
            if (input.isKeyPressed("DirRight")) {
                this.aimAngle -= 1.5 * deltaTime;
            }

            if (input.isKeyPressed("DirUp")) {
                this.aimElevation = Math.min(this.aimElevation + deltaTime, -0.1);
            }
            if (input.isKeyPressed("DirDown")) {
                this.aimElevation = Math.max(this.aimElevation - deltaTime, -0.8);
            }

            this.castDirection = new Vector3(
                Math.sin(this.aimAngle),
                Math.sin(this.aimElevation),
                Math.cos(this.aimAngle)
            ).normalize();

            if (input.isKeyPressed("Action2")) {
                this.isChargingCast = true;
                this.castPower = Math.min(this.maxCastPower, this.castPower + this.castPowerRate * deltaTime);
            } else if (this.isChargingCast) {
                this.isChargingCast = false;
                this.cast();
            }
        }

        switch (this.state) {
            case "casting":
                if (this.lure.state === "inWater") {
                    this.state = "fishing";
                }
                break;

            case "fishing":
                const moveSpeed = 30 * deltaTime;
                if (input.isKeyPressed("DirUp")) {
                    this.lure.move("forward", moveSpeed);
                }
                if (input.isKeyPressed("DirDown")) {
                    this.lure.move("backward", moveSpeed);
                }
                if (input.isKeyPressed("DirRight")) {
                    this.lure.move("left", moveSpeed);
                }
                if (input.isKeyPressed("DirLeft")) {
                    this.lure.move("right", moveSpeed);
                }

                if (input.isKeyPressed("Action1")) {
                    this.isReeling = true;
                    this.handleReeling(deltaTime);
                } else {
                    this.isReeling = false;
                }

                // Handle hooking input
                if (input.isKeyJustPressed("Action1")) {
                    this.tryHookFish();
                }

                // Allow lure movement during fishing
                this.handleLureMovement(input, deltaTime);
                break;

            case "reeling":
                const distanceToFisher = this.lure.position.distanceTo(this.position);
                if (distanceToFisher < 1) {
                    this.state = "ready";
                    this.castPower = 0;
                    this.lure.reset();
                    this.game.fishingArea.setLure(this.lure);
                } else {
                    const direction = this.position.subtract(this.lure.position).normalize();
                    this.lure.position = this.lure.position.add(direction.scale(50 * deltaTime));
                }
                break;
        }

        if (this.model) {
            this.model.update(deltaTime);
        }
    }

    tryHookFish() {
        console.log("Attempting to hook fish!");
        const fishes = this.game.fishes;
        const fishingArea = this.game.fishingArea;
        
        for (const fish of fishes) {
            const fishAI = fishingArea.fish.get(fish);
            if (fishAI.tryHook(this.lure)) {
                console.log("Fish successfully hooked!");
                break;
            }
        }
    }

    handleLureMovement(input, deltaTime) {
        const moveSpeed = 30 * deltaTime;

        if (input.isKeyPressed("DirUp")) {
            this.lure.move("forward", moveSpeed);
        }
        if (input.isKeyPressed("DirDown")) {
            this.lure.move("backward", moveSpeed);
        }
        if (input.isKeyPressed("DirRight")) {
            this.lure.move("left", moveSpeed);
        }
        if (input.isKeyPressed("DirLeft")) {
            this.lure.move("right", moveSpeed);
        }
    }

    handleReeling(deltaTime) {
        if (!this.lure || !this.isReeling) return;

        const distanceToFisher = this.lure.position.distanceTo(this.position);

        // If lure is close enough, reset to ready state
        if (distanceToFisher < 1) {
            this.state = "ready";
            this.castPower = 0;
            this.lure.reset();
            this.game.fishingArea.setLure(this.lure);
            return;
        }

        const reelAmount = this.reelSpeed * deltaTime;
        const reelDirection = this.position.subtract(this.lure.position).normalize();
        this.lure.position = this.lure.position.add(reelDirection.scale(reelAmount));
        this.lineLength = distanceToFisher;
    }

    cast() {
        if (this.state !== "ready" || !this.lure) return;

        // Exponential scaling for more dramatic power difference
        const powerPercentage = Math.pow(this.castPower / this.maxCastPower, 1.5);
        const castStrength = this.minCastStrength + (this.maxCastStrength - this.minCastStrength) * powerPercentage;

        // Add upward angle to cast direction
        const upwardAngle = 0.5;
        const castDirectionWithArc = new Vector3(
            this.castDirection.x,
            this.castDirection.y + upwardAngle,
            this.castDirection.z
        ).normalize();

        const castVelocity = castDirectionWithArc.scale(castStrength);

        this.lure.visible = true;
        this.lure.startCast(this.position, castVelocity, this.castDirection);

        this.state = "casting";
        this.castPower = 0;
    }

    getCastPowerPercentage() {
        return (this.castPower / this.maxCastPower) * 100;
    }
}