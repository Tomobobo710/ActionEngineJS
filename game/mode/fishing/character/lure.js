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
        console.warn('Lure missing required components');
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

        // Check for water contact - with safety checks
        const ocean = this.fisher?.game?.ocean;
        if (ocean && typeof ocean.getWaterHeightAt === 'function') {
            const waterHeight = ocean.getWaterHeightAt(this.position.x, this.position.z);
            if (this.position.y <= waterHeight) {
                this.state = "inWater";
                const fishingArea = this.fisher?.game?.fishingArea;
                if (fishingArea && typeof fishingArea.setLure === 'function') {
                    fishingArea.setLure(this);
                }
            }
        }
    }

    // Handle hooked fish state
    if (this.state === "inWater" && this.hookedFish) {
        // Safety check - make sure fish exists AND is in water
        const ocean = this.fisher?.game?.ocean;
        if (ocean && typeof ocean.getWaterHeightAt === 'function') {
            const waterHeight = ocean.getWaterHeightAt(this.hookedFish.position.x, this.hookedFish.position.z);
            
            // If fish is above water, force it back down
            if (this.hookedFish.position.y > waterHeight) {
                this.hookedFish.position.y = waterHeight;
                if (this.hookedFish.body) {
                    this.hookedFish.body.position.y = waterHeight;
                }
            }
        

        this.handleFishFight(deltaTime);
    

            // Check for reeling in completion
            //const distanceToFisher = this.position.distanceTo(this.fisher.position);
           // if (distanceToFisher < 1) {
                //if (this.fisher.game) {
                    //this.hookedFish = null;
                  //  this.fishPullForce = new Vector3(0, 0, 0);
              //  }
           // }
        } else {
            // If fish is missing required properties, release it
            console.warn("Hooked fish missing required properties, releasing...");
            this.releaseHookedFish();
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
        // Get direction AWAY from fisher by subtracting fisher position FROM lure position
        const escapeDirection = this.position.subtract(this.fisher.position).normalize();
        
        const randomOffset = new Vector3(
            (Math.random() - 0.5) * 0.5,
            0,
            (Math.random() - 0.5) * 0.5
        );
        
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

    if (this.fisher) {
        const distanceToFisher = this.position.distanceTo(this.fisher.position);
        const tension = distanceToFisher / this.fisher.maxLineLength;
        this.fisher.lineTension = tension;

        if (distanceToFisher < 1) {
            this.fisher.onLureReachedFisher();
            return;
        }

        if (tension > this.lineTensionThreshold) {
            const escapingFish = this.hookedFish;
            this.hookedFish = null;
            this.state = "inactive";
            this.fishPullForce = new Vector3(0, 0, 0);
            this.fisher.state = "ready";
            this.fisher.lineTension = 0;
            this.fisher.isReeling = false;

            const fishAI = this.fisher?.game?.fishingArea?.fish.get(escapingFish);
            if (fishAI) {
                fishAI.isHooked = false;
                fishAI.changeBehavior('patrol');
            }
            
            FishAI.currentlyAttackingFish = null;
            this.fisher?.game?.fishingArea?.fish.forEach((ai) => {
                ai.hasLostInterest = false;
            });
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

    fishEscapes() {
    // Reset fish AI state
    const fishAI = this.fisher?.game?.fishingArea?.fish.get(this.hookedFish);
    if (fishAI) {
        fishAI.isHooked = false;
        fishAI.changeBehavior('patrol');
    }

    // Reset global fish states
    FishAI.currentlyAttackingFish = null;
    
    // Reset all fish interest
    if (this.fisher?.game?.fishingArea) {
        this.fisher.game.fishingArea.fish.forEach((ai) => {
            ai.hasLostInterest = false;
        });
    }
}
    
    releaseHookedFish() {
    if (this.hookedFish) {
        // Get the AI controller for the fish
        const fishAI = this.fisher?.game?.fishingArea?.fish.get(this.hookedFish);
        if (fishAI) {
            // Reset all fish states
            fishAI.isHooked = false;
            fishAI.hasLostInterest = false;
            fishAI.changeBehavior('patrol');
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