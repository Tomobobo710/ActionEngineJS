class Fisher {
    constructor(game, position = new Vector3(0, 0, 0)) {
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
        this.model = new FishermanModel(game.physicsWorld, 10, position);
        this.model.fisher = this;
        this.minCastStrength = 20;
        this.maxCastStrength = 300;
        this.lureYOffset = 5;
        this.isReeling = false;
        this.lineLength = 0;
        this.maxLineLength = 200;
        this.lineTension = 0;
        this.reelSpeed = 30;
        //this.caughtStateTimer = 0;
    }

    attachLure(lure) {
        this.lure = lure;
        this.lure.setFisher(this);
        this.lure.state = "inactive";
    }

    update(deltaTime, input) {
        const waterHeight = this.game.ocean.getWaterHeightAt(this.position.x, this.position.z);
        
        if (this.model && this.model.body) {
            this.model.body.position.x = this.position.x;
            this.model.body.position.y = this.position.y;
            this.model.body.position.z = this.position.z;
        }

        if (this.state === "ready" && this.lure) {
            this.lure.position.x = this.position.x;
            this.lure.position.y = this.position.y + this.lureYOffset;
            this.lure.position.z = this.position.z;

            this.lure.body.position.x = this.position.x;
            this.lure.body.position.y = this.position.y + this.lureYOffset;
            this.lure.body.position.z = this.position.z;
        }

        switch (this.state) {
            case "ready":
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
                break;

            case "casting":
                if (this.lure.state === "inWater") {
                    this.state = "fishing";
                }
                break;

            case "fishing":
                this.handleLureMovement(input, deltaTime);
                
                if (input.isKeyPressed("Action1")) {
                    this.isReeling = true;
                    this.handleReeling(deltaTime);
                } else {
                    this.isReeling = false;
                }

                if (input.isKeyJustPressed("Action1")) {
                    this.tryHookFish();
                }
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

            case "caught":
    // Prevent movement while in caught state
    if (input.isKeyPressed("Action1")) {
        console.log("KEY PRESSED ACTION 1");
        const totalCaught = Object.values(this.game.catchBag).reduce((a, b) => a + b, 0);
        if (totalCaught < this.game.maxBagSize) {
            this.game.keepFish(this.lure.hookedFish);
            this.state = "ready";
            this.castPower = 0;
            this.lure.reset();
        }
    } else if (input.isKeyPressed("Action2")) {
        console.log("KEY PRESSED ACTION 2");
        this.game.releaseFish();
        this.state = "ready";
        this.castPower = 0;
        this.lure.reset();
    }
    break;
        }
    }


    tryHookFish() {
        if (this.state !== "fishing") return;
        
        console.log("Attempting to hook fish!");
        const fishingArea = this.game.fishingArea;

        for (const [fish, fishAI] of fishingArea.fish) {
            if (fishAI.tryHook(this.lure)) {
                console.log("Fish successfully hooked!");
                this.state = "fighting";
                break;
            }
        }
    }

    handleLureMovement(input, deltaTime) {
    const moveSpeed = 30 * deltaTime;
    
    // Calculate forward and right vectors based on fisher's aim angle
    const forward = new Vector3(
        Math.sin(this.aimAngle),
        0,
        Math.cos(this.aimAngle)
    ).normalize();
    
    // Right vector is perpendicular to forward
    const right = new Vector3(
        Math.cos(this.aimAngle),
        0,
        -Math.sin(this.aimAngle)
    ).normalize();

    if (input.isKeyPressed("DirUp")) {
        this.lure.move(forward, moveSpeed);
    }
    if (input.isKeyPressed("DirDown")) {
        this.lure.move(forward.scale(-1), moveSpeed);
    }
    if (input.isKeyPressed("DirLeft")) {
        this.lure.move(right, moveSpeed);
    }
    if (input.isKeyPressed("DirRight")) {
        this.lure.move(right.scale(-1), moveSpeed);
    }
}

    handleReeling(deltaTime) {
    if (!this.lure || !this.isReeling) return;

    const distanceToFisher = this.lure.position.distanceTo(this.position);

    // If lure is close enough
    if (distanceToFisher < 1) {
        if (this.lure.hookedFish) {
            // If we have a fish, transition to caught state
            this.state = "caught";
        } else {
            // If no fish, reset to ready state
            this.state = "ready";
            this.castPower = 0;
            this.lure.reset();
            this.game.fishingArea.setLure(this.lure);
        }
        return;
    }

        
        
    const reelAmount = this.reelSpeed * deltaTime;
    const reelDirection = this.position.subtract(this.lure.position).normalize();
    this.lure.position = this.lure.position.add(reelDirection.scale(reelAmount));
    
    // Update physics body position to match
    this.lure.body.position.x = this.lure.position.x;
    this.lure.body.position.y = this.lure.position.y;
    this.lure.body.position.z = this.lure.position.z;
    
    this.lineLength = distanceToFisher;
}

    onLureReachedFisher() {
    if (this.lure.hookedFish) {
        this.state = "caught";
        this.lure.state = "caught";  // Add this state to Lure
    } else {
        this.state = "ready";
        this.lure.reset();
    }
}
    keepFish() {
    if (this.lure.hookedFish) {
        this.game.catchBag[this.lure.hookedFish.type]++;
        this.lure.hookedFish = null;  // Now we clear it
        this.state = "ready";
        this.lure.reset();
    }
}

releaseFish() {
    if (this.lure.hookedFish) {
        this.lure.releaseHookedFish();  // This method already exists
        this.state = "ready";
        this.lure.reset();
    }
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
        this.lure.startCast(
            new Vector3(this.position.x, this.position.y + this.lureYOffset, this.position.z),
            castVelocity,
            this.castDirection
        );

        this.state = "casting";
        this.castPower = 0;
    }

    getCastPowerPercentage() {
        return (this.castPower / this.maxCastPower) * 100;
    }
}