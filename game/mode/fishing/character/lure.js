class Lure extends ActionPhysicsObject3D {
    constructor(physicsWorld, radius = 2) {
        const characterModel = GLBLoader.loadModel(lureModel);
        const triangles = characterModel.triangles;
        super(physicsWorld, triangles);
        //super(physicsWorld, radius, 0, new Vector3(0, 0, 0)); // mass 0
        this.fisher = null;
        this.state = "inactive"; // inactive, casting, inWater
        this.visible = false;

        // Our own physics properties
        this.lureVelocity = new Vector3(0, 0, 0);
        this.lureGravity = -15;
        this.maxLureVelocity = 300;

        this.bounds = {
            width: 500,
            length: 500,
            depth: 50
        };

        physicsWorld.addObject(this);

        const shape = new Goblin.BoxShape(radius, radius, radius);
        this.body = new Goblin.RigidBody(shape, 0); // 0 mass for static body

        this.animator = new ModelAnimationController(characterModel);
        this.animator.play(0, true);

        this.hookedFish = null;
        this.fishPullForce = new Vector3(0, 0, 0);
        this.lineTensionThreshold = 0.8; // When line might snap

        this.currentTension = 0;
        this.maxTension = 1.0;
        this.tensionIncreaseRate = 0.8; // How fast tension builds when fighting
        this.tensionDecreaseRate = 0.4; // How fast tension reduces when giving line
        this.breakingTension = 0.95; // Tension level where line breaks

        // Track the current fish movement direction
        this.lastFishDirection = new Vector3(0, 0, 0);
    }

    getHeightAt(x, z) {
    if (!this.triangles) return this.body.position.y;
    
    for (const triangle of this.triangles) {
        if (this.pointInTriangle(
            x, z,
            triangle.v1.x, triangle.v1.z,
            triangle.v2.x, triangle.v2.z,
            triangle.v3.x, triangle.v3.z
        )) {
            return this.barycentricInterpolation(x, z, triangle);
        }
    }
    return this.body.position.y;
}

pointInTriangle(px, pz, x1, z1, x2, z2, x3, z3) {
    let d1 = this.sign(px, pz, x1, z1, x2, z2);
    let d2 = this.sign(px, pz, x2, z2, x3, z3);
    let d3 = this.sign(px, pz, x3, z3, x1, z1);

    let hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    let hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

    return !(hasNeg && hasPos);
}

sign(px, pz, x1, z1, x2, z2) {
    return (px - x2) * (z1 - z2) - (x1 - x2) * (pz - z2);
}

barycentricInterpolation(px, pz, triangle) {
    let v1 = triangle.v1;
    let v2 = triangle.v2;
    let v3 = triangle.v3;
    
    let denom = ((v2.z - v3.z) * (v1.x - v3.x) + (v3.x - v2.x) * (v1.z - v3.z));
    let l1 = ((v2.z - v3.z) * (px - v3.x) + (v3.x - v2.x) * (pz - v3.z)) / denom;
    let l2 = ((v3.z - v1.z) * (px - v3.x) + (v1.x - v3.x) * (pz - v3.z)) / denom;
    let l3 = 1.0 - l1 - l2;

    return l1 * v1.y + l2 * v2.y + l3 * v3.y;
}

    
    setFisher(fisher) {
        this.fisher = fisher;
        this.reset();
    }

    startCast(startPos, castVelocity, castDirection) {
        this.state = "casting";
        this.position = startPos.clone();

        // Scale velocity but maintain direction
        if (castVelocity.length() > this.maxLureVelocity) {
            castVelocity = castVelocity.normalize().scale(this.maxLureVelocity);
        }

        // Additional upward boost based on cast power
        const castPower = castVelocity.length() / this.maxLureVelocity;
        const upwardBoost = 15 + castPower * 25; // More power = higher arc
        castVelocity.y += upwardBoost;

        this.lureVelocity = castVelocity;
        this.castDirection = castDirection.clone();
        this.visible = true;

        if (this.fisher?.game) {
            this.fisher.game.fishingArea.setLure(this);
        }
    }

    update(deltaTime) {
    // Initialize position if null
    if (!this.position) {
        this.position = new Vector3(0, 0, 0);
    }

    // Early return if no fisher or no physics body
    if (!this.fisher || !this.body) {
        console.warn("Lure missing required components");
        return;
    }

    if (this.state === "casting") {
        // Calculate new position before applying it
        const newX = this.position.x + this.lureVelocity.x * deltaTime;
        const newY = this.position.y + this.lureVelocity.y * deltaTime;
        const newZ = this.position.z + this.lureVelocity.z * deltaTime;

        // Check bounds before updating position
        const halfWidth = this.bounds.width / 2;
        const halfLength = this.bounds.length / 2;

        // Only update if within bounds
        if (newX >= -halfWidth && newX <= halfWidth && newZ >= -halfLength && newZ <= halfLength) {
            this.position.x = newX;
            this.position.z = newZ;
            this.body.position.x = this.position.x;
            this.body.position.z = this.position.z;
        } else {
            this.state = "inWater";
        }

        // Y position and gravity always update
        this.position.y = newY;
        this.body.position.y = this.position.y;
        this.lureVelocity.y += this.lureGravity * deltaTime;

        // Check for water contact
        const ocean = this.fisher?.game?.ocean;
        if (ocean && typeof ocean.getWaterHeightAt === "function") {
            const waterHeight = ocean.getWaterHeightAt(this.position.x, this.position.z);
            if (this.position.y <= waterHeight) {
                this.state = "inWater";
                const fishingArea = this.fisher?.game?.fishingArea;
                if (fishingArea && typeof fishingArea.setLure === "function") {
                    fishingArea.setLure(this);
                }
            }
        }
    } else if (this.state === "inWater") {
        const ocean = this.fisher?.game?.ocean;
        const floor = this.fisher?.game?.floor;
        
        if (ocean && floor) {
            const waterHeight = ocean.getWaterHeightAt(this.position.x, this.position.z);
            const floorHeight = floor.getHeightAt(this.position.x, this.position.z);
            
            if (!this.fisher.isReeling) {
                // Calculate distance to floor
                const distanceToFloor = this.position.y - floorHeight;
                
                // Adjust sink speed based on distance to floor (slower as we approach)
                const baseSinkSpeed = 20;
                const sinkSpeed = baseSinkSpeed * Math.min(1, distanceToFloor / 10);
                
                // Only sink if we're above the floor
                if (distanceToFloor > 1) {
                    this.position.y = Math.max(
                        floorHeight + 1, // Stay 1 unit above floor
                        this.position.y - sinkSpeed * deltaTime
                    );
                }
                
                this.body.position.y = this.position.y;
            } else {
                // Reeling behavior
                const reelDirection = this.fisher.position.subtract(this.position).normalize();
                const reelSpeed = this.fisher.reelSpeed * deltaTime;
                
                // Calculate new position after reeling
                const newPosition = this.position.add(reelDirection.scale(reelSpeed));
                
                // Ensure we don't go below floor while reeling
                const newFloorHeight = floor.getHeightAt(newPosition.x, newPosition.z);
                newPosition.y = Math.max(newPosition.y, newFloorHeight + 1);
                
                this.position = newPosition;
                this.body.position.copy(this.position);
            }
        }

        // Handle hooked fish behavior
        if (this.hookedFish) {
            const ocean = this.fisher?.game?.ocean;
            if (ocean && typeof ocean.getWaterHeightAt === "function") {
                const waterHeight = ocean.getWaterHeightAt(this.hookedFish.position.x, this.hookedFish.position.z);

                // If fish is above water, force it back down
                if (this.hookedFish.position.y > waterHeight) {
                    this.hookedFish.position.y = waterHeight;
                    if (this.hookedFish.body) {
                        this.hookedFish.body.position.y = waterHeight;
                    }
                }

                this.handleFishFight(deltaTime);
            } else {
                // If fish is missing required properties, release it
                console.warn("Hooked fish missing required properties, releasing...");
                this.releaseHookedFish();
            }
        }
    }
}

    handleFishFight(deltaTime) {
        // Safety checks
        if (!this.hookedFish || !this.fisher?.game?.ocean) {
            this.fishEscapes();
            return;
        }

        // Keep fish and lure in water
        const waterHeight = this.fisher.game.ocean.getWaterHeightAt(
            this.hookedFish.position.x,
            this.hookedFish.position.z
        );
        this.hookedFish.position.y = Math.min(this.hookedFish.position.y, waterHeight);

        // Fish changes direction occasionally
        if (Math.random() < 0.05) {
            // Get direction AWAY from fisher
            const escapeDirection = this.position.subtract(this.fisher.position).normalize();

            const randomOffset = new Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);

            const behaviorRoll = Math.random();
            if (behaviorRoll < 0.6) {
                this.fishPullForce = escapeDirection.add(randomOffset).normalize().scale(50);
            } else if (behaviorRoll < 0.8) {
                const sideDirection = new Vector3(-escapeDirection.z, 0, escapeDirection.x);
                this.fishPullForce = sideDirection.add(randomOffset).normalize().scale(40);
            } else {
                this.fishPullForce = new Vector3(0, 0, 0);
            }
        }

        // Get the current fish movement direction
        this.lastFishDirection = this.fishPullForce.normalize();

        // Get player's input direction
        const input = this.fisher.game.input;
        let playerDirection = new Vector3(0, 0, 0);

        if (input.isKeyPressed("DirLeft")) {
            playerDirection.x = -1;
        } else if (input.isKeyPressed("DirRight")) {
            playerDirection.x = 1;
        }
        if (input.isKeyPressed("DirUp")) {
            playerDirection.z = 1;
        } else if (input.isKeyPressed("DirDown")) {
            playerDirection.z = -1;
        }

        // Calculate tension based on player input vs fish direction
        if (playerDirection.length() > 0) {
            playerDirection = playerDirection.normalize();

            // Calculate dot product to determine if player is fighting or giving line
            const dotProduct = playerDirection.dot(this.lastFishDirection);

            if (dotProduct < -0.2) {
                // Player is fighting against fish
                this.currentTension = Math.min(
                    this.maxTension,
                    this.currentTension + this.tensionIncreaseRate * deltaTime
                );
            } else if (dotProduct > 0.2) {
                // Player is giving line
                this.currentTension = Math.max(0, this.currentTension - this.tensionDecreaseRate * deltaTime);
            }
        }

        // Apply final movement
        let finalForce = this.fishPullForce.clone();

        if (this.fisher.isReeling) {
            const reelDirection = this.fisher.position.subtract(this.position).normalize();
            const reelForce = reelDirection.scale(this.fisher.reelSpeed);
            finalForce = finalForce.add(reelForce);
        }

        // Apply movement
        const moveAmount = finalForce.scale(deltaTime);
        this.position = this.position.add(moveAmount);

        // Update physics body
        this.body.position.x = this.position.x;
        this.body.position.y = Math.min(this.position.y, waterHeight);
        this.body.position.z = this.position.z;

        // Check distance constraints
        if (this.fisher) {
            const distanceToFisher = this.position.distanceTo(this.fisher.position);

            // Add distance-based tension as a secondary factor
            if (distanceToFisher > this.fisher.maxLineLength * 0.8) {
                const distanceTension =
                    (distanceToFisher - this.fisher.maxLineLength * 0.8) / (this.fisher.maxLineLength * 0.2);
                this.currentTension = Math.max(this.currentTension, distanceTension);
            }

            // Update fisher's tension value
            this.fisher.lineTension = this.currentTension;

            // Check for being reeled in
            if (distanceToFisher < 1) {
                this.fisher.onLureReachedFisher();
                return;
            }

            // Check for line break
            if (this.currentTension >= this.breakingTension) {
                this.fishEscapes();
                this.reset(); // Full reset including tension
                this.state = "inactive";
                this.fisher.state = "ready";
                this.fisher.isReeling = false;
                return;
            }
        }
    }

    move(direction, speed) {
        // Store old position for physics interpolation if needed
        const oldPosition = this.position.clone();

        // Update position based on direction and speed
        this.position = this.position.add(direction.scale(speed));

        // Update physics body position
        if (this.body) {
            this.body.position.x = this.position.x;
            this.body.position.y = this.position.y;
            this.body.position.z = this.position.z;
        }

        // If in water, maintain y position at water level
        if (this.state === "inWater" && this.game && this.game.ocean) {
            const waterHeight = this.game.ocean.getWaterHeightAt(this.position.x, this.position.z);
            this.position.y = waterHeight;
            if (this.body) {
                this.body.position.y = waterHeight;
            }
        }

        // Update velocity for physics calculations if needed
        if (this.body) {
            const velocity = this.position.subtract(oldPosition);
            this.body.velocity = velocity;
        }

        // Emit any necessary events or update any attached components
        if (this.onPositionUpdated) {
            this.onPositionUpdated();
        }
    }

    resetTension() {
        this.currentTension = 0;
        this.fishPullForce = new Vector3(0, 0, 0);
        this.lastFishDirection = new Vector3(0, 0, 0);
        if (this.fisher) {
            this.fisher.lineTension = 0;
        }
    }

    fishEscapes() {
        // Reset fish AI state
        const fishAI = this.fisher?.game?.fishingArea?.fish.get(this.hookedFish);
        if (fishAI) {
            fishAI.isHooked = false;
            fishAI.changeBehavior("patrol");
        }

        // Reset global fish states
        FishAI.currentlyAttackingFish = null;

        // Reset all fish interest
        if (this.fisher?.game?.fishingArea) {
            this.fisher.game.fishingArea.fish.forEach((ai) => {
                ai.hasLostInterest = false;
            });
        }

        this.resetTension(); // Reset all tension values
        this.hookedFish = null;
    }

    releaseHookedFish() {
        if (this.hookedFish) {
            // Get the AI controller for the fish
            const fishAI = this.fisher?.game?.fishingArea?.fish.get(this.hookedFish);
            if (fishAI) {
                // Reset all fish states
                fishAI.isHooked = false;
                fishAI.hasLostInterest = false;
                fishAI.changeBehavior("patrol");
            }

            // Clear the hooked fish reference
            this.hookedFish = null;

            // Reset global attacking fish state
            FishAI.currentlyAttackingFish = null;

            // Reset interest for ALL fish
            this.fisher?.game?.fishingArea?.fish.forEach((ai) => {
                ai.hasLostInterest = false;
            });
        }
    }

    reset() {
        if (!this.fisher) return;

        // Release any hooked fish before resetting
        if (this.hookedFish) {
            this.releaseHookedFish();
        }

        this.resetTension(); // Reset all tension values
        this.state = "inactive";
        this.position = this.fisher.position.clone();
        this.visible = false;
        this.lureVelocity = new Vector3(0, 0, 0);

        this.body.position.x = this.position.x;
        this.body.position.y = this.position.y;
        this.body.position.z = this.position.z;

        if (this.fisher.game) {
            this.fisher.game.fishingArea.setLure(this);
        }
    }
}