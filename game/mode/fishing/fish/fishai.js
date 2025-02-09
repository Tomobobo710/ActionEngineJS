// Main AI controller class (renamed from FishMovementController)
class FishAI {
    // Add static property to track if any fish is attacking
    static currentlyAttackingFish = null;

    constructor(fish, bounds) {
        this.fish = fish;
        this.bounds = bounds;
        
        // Initialize behaviors
        this.behaviors = {
            patrol: new PatrolBehavior(fish, bounds),
            rest: new RestBehavior(fish, bounds),
            interest: new InterestBehavior(fish, bounds),
            attack: new AttackBehavior(fish, bounds),
            hooked: new HookedBehavior(fish, bounds)
        };
        this.canBeHooked = false;
        this.currentBehavior = this.behaviors.patrol;
        this.timeSinceLastBehaviorChange = 0;
        this.minTimeBetweenBehaviorChanges = 10;
        this.attackProbability = 0.5;
        this.hasLostInterest = false;
    }

   update(deltaTime, lure) {
       const activeLure = lure?.state === 'inWater' ? lure : null;
        
        if (this.isHooked) {
            this.currentBehavior.update(deltaTime);
            return;
        }

        // Update hooking window status
        if (this.currentBehavior === this.behaviors.attack) {
            this.canBeHooked = this.currentBehavior.hookingWindowActive && 
                              !this.currentBehavior.missed;
        } else {
            this.canBeHooked = false;
        }

        // Handle missed hook attempt
        if (this.currentBehavior === this.behaviors.attack && 
            this.currentBehavior.missed) {
            console.log("Fish missed - returning to patrol");
            this.hasLostInterest = true;
            this.changeBehavior('patrol');
            return;
        }
       if (lure) {
            // If another fish is attacking and this isn't the attacking fish
            if (FishAI.currentlyAttackingFish && FishAI.currentlyAttackingFish !== this.fish) {
                if (this.currentBehavior === this.behaviors.interest || 
                    this.currentBehavior === this.behaviors.attack) {
                    console.log("Another fish is attacking - this fish losing interest");
                    this.changeBehavior('patrol');
                }
                this.hasLostInterest = true;
                this.currentBehavior.update(deltaTime);
                return;
            }

        // Only proceed with lure interest logic if fish hasn't lost interest
        if (!this.hasLostInterest) {
            const distanceToLure = this.fish.position.distanceTo(lure.position);
            
            // Calculate interest probability based on distance
            const baseInterestRadius = 500;
            const interestFalloff = Math.max(0, 1 - (distanceToLure / baseInterestRadius));
            
            // Add some randomness to make interest more natural
            const randomFactor = Math.random() * 0.3; // 30% random variation
            
            // Fish is interested if it's within range and passes probability check
            if (distanceToLure < baseInterestRadius && interestFalloff > randomFactor) {
                    if (this.currentBehavior !== this.behaviors.interest && 
                        this.currentBehavior !== this.behaviors.attack) {
                        console.log("Fish becoming interested in lure");
                        this.changeBehavior('interest');
                    }
                
                // Attack probability now scales with how close the fish is
                const attackChance = this.attackProbability * interestFalloff * deltaTime;
                 if (Math.random() < attackChance && 
                        this.currentBehavior !== this.behaviors.attack) {
                        console.log("Fish deciding to attack!");
                        FishAI.currentlyAttackingFish = this.fish;
                        this.changeBehavior('attack', lure);
                    }
            }
        }
            
            // Check if attack is complete
            if (this.currentBehavior === this.behaviors.attack && this.behaviors.attack.attackComplete) {
                this.changeBehavior('patrol');
                // Don't reset currentlyAttackingFish here as we want other fish to stay uninterested
            }
        }

        // Update current behavior
        if (this.currentBehavior === this.behaviors.interest) {
            this.currentBehavior.update(deltaTime, lure);
        } else {
            this.currentBehavior.update(deltaTime);
        }
    }

    changeBehavior(newBehaviorName, lure = null) {
        this.currentBehavior.onExit();
        this.currentBehavior = this.behaviors[newBehaviorName];
        if (lure && newBehaviorName === 'attack') {
            this.currentBehavior.onEnter(lure);
        } else {
            this.currentBehavior.onEnter();
        }
        
        this.timeSinceLastBehaviorChange = 0;
    }
     tryHook(lure) {
        if (!this.canBeHooked) return false;

        // Set up hooked behavior
        this.behaviors.hooked.setLure(lure);
        this.changeBehavior('hooked');
        
        // Set the fish as the lure's hooked fish
        lure.hookedFish = this.fish;
        
        // Clear the attacking fish reference since hook was successful
        FishAI.currentlyAttackingFish = null;
        
        // Flag this fish as permanently hooked
        this.isHooked = true;
        return true;
    }
    // Reset interest (can be called when starting a new game or releasing a fish)
    static resetAllFishInterest() {
        FishAI.currentlyAttackingFish = null;
    }
}
