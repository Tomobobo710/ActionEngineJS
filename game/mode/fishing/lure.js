class Lure extends ActionPhysicsSphere3D {
    constructor(physicsWorld, radius = 2) {
        super(physicsWorld, radius, 0, new Vector3(0, 0, 0)); // mass 0
        this.fisher = null;
        this.state = "inactive"; // inactive, casting, inWater
        this.visible = false;

        // Our own physics properties
        this.lureVelocity = new Vector3(0, 0, 0);
        this.lureGravity = -9.81;
        this.maxLureVelocity = 300;

        this.bounds = {
            width: 500,
            length: 500,
            depth: 50
        };
        physicsWorld.addObject(this);

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

        // Add additional upward boost based on cast power
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
        if (!this.position) {
            this.position = new Vector3(0, 0, 0);
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
            } else {
                // Hit boundary, enter water
                this.state = "inWater";
            }

            // Y position and gravity always update
            this.position.y = newY;
            this.lureVelocity.y += this.lureGravity * deltaTime;

            // Update physics body
            if (this.body) {
                this.body.position.x = this.position.x;
                this.body.position.y = this.position.y;
                this.body.position.z = this.position.z;
            }

            // Check for water contact
            if (this.fisher?.game?.ocean) {
                const waterHeight = this.fisher.game.ocean.getWaterHeightAt(this.position.x, this.position.z);

                if (this.position.y <= waterHeight) {
                    this.state = "inWater";
                    if (this.fisher.game.fishingArea) {
                        this.fisher.game.fishingArea.setLure(this);
                    }
                }
            }
        }

        // Handle hooked fish state
        if (this.state === "inWater" && this.hookedFish) {
            // Verify fish has required properties before handling fight
            if (this.hookedFish.position && this.position && this.fisher) {
                this.handleFishFight(deltaTime);

                // Add small offset so fish isn't exactly on lure
                const offsetX = (Math.random() - 0.5) * 2;
                const offsetY = (Math.random() - 0.5) * 2;
                const offsetZ = (Math.random() - 0.5) * 2;

                this.hookedFish.position.x = this.position.x + offsetX;
                this.hookedFish.position.y = this.position.y + offsetY;
                this.hookedFish.position.z = this.position.z + offsetZ;

                // Update fish's physics body position with null check
                if (this.hookedFish.body) {
                    this.hookedFish.body.position.x = this.hookedFish.position.x;
                    this.hookedFish.body.position.y = this.hookedFish.position.y;
                    this.hookedFish.body.position.z = this.hookedFish.position.z;
                }

                // Check for reeling in completion
                const distanceToFisher = this.position.distanceTo(this.fisher.position);
                if (distanceToFisher < 1) {
                    if (this.fisher.game) {
                        const fishId = this.fisher.game.handleFishCaught(this.hookedFish);
                        this.hookedFish = null;
                        this.fishPullForce = new Vector3(0, 0, 0);
                        this.fisher.game.showCaughtFishUI(fishId);
                    }
                }
            } else {
                // If fish is missing required properties, release it
                console.warn("Hooked fish missing required properties, releasing...");
                this.releaseHookedFish();
            }
        }

        // Only call updateVisual if we have a valid position
        if (this.position) {
            this.updateVisual();
        }
    }

    handleFishFight(deltaTime) {
        // Fish regularly changes direction to fight
        if (Math.random() < 0.05) {
            // 5% chance each frame to change direction
            const angle = Math.random() * Math.PI * 2;
            this.fishPullForce = new Vector3(Math.cos(angle), 0, Math.sin(angle)).scale(50); // Pull strength
        }

        // Apply fish pull force to lure position
        const pullAmount = this.fishPullForce.scale(deltaTime);
        this.position = this.position.add(pullAmount);

        // Calculate line tension based on distance and angle
        if (this.fisher) {
            const distanceToFisher = this.position.distanceTo(this.fisher.position);
            const tension = distanceToFisher / this.fisher.maxLineLength;
            this.fisher.lineTension = tension;

            // If tension is too high, fish might escape
            if (tension > this.lineTensionThreshold && Math.random() < 0.1) {
                this.fishEscapes();
            }
        }
    }
    updateVisual() {
        if (!this.body) return;

        // Update vertices based on current position without resetting it
        this.triangles.forEach((triangle, triIndex) => {
            triangle.vertices.forEach((vertex, vertIndex) => {
                const origVert = this.originalVerts[triIndex * 3 + vertIndex];

                vertex.x = origVert.x + this.position.x;
                vertex.y = origVert.y + this.position.y;
                vertex.z = origVert.z + this.position.z;
            });
        });
    }
    move(direction, amount) {
        if (this.state !== "inWater") return;

        // Calculate movement based on direction
        let moveVector = new Vector3(0, 0, 0);
        switch (direction) {
            case "forward":
                moveVector.z = amount;
                break;
            case "backward":
                moveVector.z = -amount;
                break;
            case "left":
                moveVector.x = -amount;
                break;
            case "right":
                moveVector.x = amount;
                break;
        }

        // If fish is hooked, movement affects tension
        if (this.hookedFish) {
            const towardsFish = this.hookedFish.position.subtract(this.position).normalize();
            const movementAngle = Math.abs(moveVector.dot(towardsFish));

            // Moving against fish direction increases tension
            if (movementAngle < 0.3) {
                // Sharp angle
                this.fisher.lineTension += 0.1;
            } else if (movementAngle > 0.7) {
                // Following fish
                this.fisher.lineTension -= 0.05;
            }
        }

        this.position = this.position.add(moveVector);
    }

    fishEscapes() {
        this.hookedFish = null;
        this.fishPullForce = new Vector3(0, 0, 0);
        this.state = "inWater";
        // Trigger any escape animations/effects
    }
    releaseHookedFish() {
        if (this.hookedFish) {
            // Reset the fish's AI state
            const fishAI = this.fisher.game.fishingArea.fish.get(this.hookedFish);
            if (fishAI) {
                fishAI.isHooked = false;
                fishAI.changeBehavior("patrol");
            }
            this.hookedFish = null;
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