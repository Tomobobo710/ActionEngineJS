// Base class for all fish behaviors
class FishBehavior {
    constructor(fish, bounds) {
        this.fish = fish;
        this.bounds = bounds;
    }
    
    update(deltaTime) {
        // To be implemented by specific behaviors
    }
    
    onEnter() {
        // Called when behavior becomes active
    }
    
    onExit() {
        // Called when behavior becomes inactive
    }
}

// Patrol behavior - based on original movement controller logic
class PatrolBehavior extends FishBehavior {
    constructor(fish, bounds) {
        super(fish, bounds);
        this.currentTarget = this.generateNewTarget();
        this.moveSpeed = 5;
        this.turnSpeed = 2;
        this.minDistanceToTarget = 2;
        
        this.currentVelocity = new Vector3(0, 0, 0);
        this.currentRotation = new Quaternion();
    }

    generateNewTarget() {
        return new Vector3(
            (Math.random() - 0.5) * this.bounds.width,
            (Math.random() - 0.5) * this.bounds.depth,
            (Math.random() - 0.5) * this.bounds.length
        );
    }

    update(deltaTime) {
        const distanceToTarget = this.fish.position.distanceTo(this.currentTarget);

        if (distanceToTarget < this.minDistanceToTarget) {
            this.currentTarget = this.generateNewTarget();
        }

        const direction = this.currentTarget.subtract(this.fish.position).normalize();
        const forward = new Vector3(1, 0, 0);
        
        const rotationAxis = forward.cross(direction).normalize();
        const angle = Math.acos(forward.dot(direction));
        
        const targetRotation = Quaternion.fromAxisAngle(rotationAxis, angle);
        this.currentRotation = this.currentRotation.slerp(targetRotation, this.turnSpeed * deltaTime);
        
        this.currentVelocity = direction.scale(this.moveSpeed);
        const movement = this.currentVelocity.scale(deltaTime);
        
        this.fish.body.position.x += movement.x;
        this.fish.body.position.y += movement.y;
        this.fish.body.position.z += movement.z;
        
        this.fish.body.rotation.set(
            this.currentRotation.x,
            this.currentRotation.y,
            this.currentRotation.z,
            this.currentRotation.w
        );
    }
}

// Rest behavior - new behavior where fish stays relatively still
class RestBehavior extends FishBehavior {
    constructor(fish, bounds) {
        super(fish, bounds);
        this.restPosition = null;
        this.smallMovementRange = 1.0; // Small movement while resting
        this.moveSpeed = 1; // Slower movement while resting
        this.currentRotation = new Quaternion();
    }

    onEnter() {
        // Remember current position as rest position
        this.restPosition = new Vector3(
            this.fish.body.position.x,
            this.fish.body.position.y,
            this.fish.body.position.z
        );
    }

    update(deltaTime) {
        // Small random movements around rest position
        const offset = new Vector3(
            (Math.random() - 0.5) * this.smallMovementRange,
            (Math.random() - 0.5) * this.smallMovementRange,
            (Math.random() - 0.5) * this.smallMovementRange
        );
        
        const targetPosition = this.restPosition.add(offset);
        const direction = targetPosition.subtract(this.fish.position).normalize();
        
        // Very gentle movement towards target
        const movement = direction.scale(this.moveSpeed * deltaTime);
        
        this.fish.body.position.x += movement.x;
        this.fish.body.position.y += movement.y;
        this.fish.body.position.z += movement.z;
    }
}

// New Interest behavior - fish looks at and follows lure from a distance
class InterestBehavior extends FishBehavior {
    constructor(fish, bounds) {
        super(fish, bounds);
        this.moveSpeed = 3;
        this.turnSpeed = 2;
        this.minDistanceToLure = 10; // Don't get too close while interested
        this.currentRotation = new Quaternion();
    }

    update(deltaTime, lure) {
        if (!lure) return;

        const direction = lure.position.subtract(this.fish.position).normalize();
        const forward = new Vector3(1, 0, 0);
        
        // Calculate rotation to face lure
        const rotationAxis = forward.cross(direction).normalize();
        const angle = Math.acos(forward.dot(direction));
        
        const targetRotation = Quaternion.fromAxisAngle(rotationAxis, angle);
        this.currentRotation = this.currentRotation.slerp(targetRotation, this.turnSpeed * deltaTime);
        
        // Move towards lure but maintain minimum distance
        const distanceToLure = this.fish.position.distanceTo(lure.position);
        if (distanceToLure > this.minDistanceToLure) {
            const movement = direction.scale(this.moveSpeed * deltaTime);
            
            this.fish.body.position.x += movement.x;
            this.fish.body.position.y += movement.y;
            this.fish.body.position.z += movement.z;
        }
        
        this.fish.body.rotation.set(
            this.currentRotation.x,
            this.currentRotation.y,
            this.currentRotation.z,
            this.currentRotation.w
        );
    }
}

// New Attack behavior - fish rapidly moves to lure's position
class AttackBehavior extends FishBehavior {
    constructor(fish, bounds) {
        super(fish, bounds);
        this.moveSpeed = 20;
        this.turnSpeed = 5;
        this.lure = null;
        this.currentRotation = new Quaternion();
        this.attackComplete = false;
        
        this.hookingWindowDuration = 3000;
        this.hookingWindowStart = null;
        this.hookingWindowActive = false;
        this.missed = false;
    }

    update(deltaTime) {
        if (this.missed || this.attackComplete || !this.lure) return;

        // Get the CURRENT lure position each update
        const currentTargetPosition = this.lure.position;
        const distanceToTarget = this.fish.position.distanceTo(currentTargetPosition);
        
        if (distanceToTarget < 1 && !this.hookingWindowActive) {
            console.log("Fish reached target! Starting hooking window!");
            this.hookingWindowActive = true;
            this.hookingWindowStart = performance.now();
        }

        if (this.hookingWindowActive) {
            const timeElapsed = performance.now() - this.hookingWindowStart;
            if (timeElapsed > this.hookingWindowDuration) {
                console.log("Hooking window expired!");
                this.missed = true;
                return;
            }
        }

        // Always move toward current lure position unless in hooking window
        if (!this.hookingWindowActive) {
            // Calculate direction to CURRENT lure position
            const direction = currentTargetPosition.subtract(this.fish.position).normalize();
            const forward = new Vector3(1, 0, 0);
            
            const rotationAxis = forward.cross(direction).normalize();
            const angle = Math.acos(forward.dot(direction));
            
            const targetRotation = Quaternion.fromAxisAngle(rotationAxis, angle);
            this.currentRotation = this.currentRotation.slerp(targetRotation, this.turnSpeed * deltaTime);
            
            const movement = direction.scale(this.moveSpeed * deltaTime);
            
            this.fish.body.position.x += movement.x;
            this.fish.body.position.y += movement.y;
            this.fish.body.position.z += movement.z;
            
            this.fish.body.rotation.set(
                this.currentRotation.x,
                this.currentRotation.y,
                this.currentRotation.z,
                this.currentRotation.w
            );
        }
    }

    onEnter(lure) {
        console.log("Fish entering ATTACK mode!");
        this.lure = lure;  // Store lure reference
    }

   

    getHookingWindowProgress() {
        if (!this.hookingWindowActive) return 0;
        
        const timeElapsed = performance.now() - this.hookingWindowStart;
        return Math.min(1, timeElapsed / this.hookingWindowDuration);
    }

}
class HookedBehavior extends FishBehavior {
    constructor(fish, bounds) {
        super(fish, bounds);
        this.lure = null;
        
        // Add some slight offset so the fish isn't exactly on the lure
        this.offset = {
            x: (Math.random() - 0.5) * 2,
            y: (Math.random() - 0.5) * 2,
            z: (Math.random() - 0.5) * 2
        };
    }

    setLure(lure) {
        this.lure = lure;
    }

    update(deltaTime) {
        if (!this.lure) return;
        
        // Only update the fish position to follow the lure
        // Don't modify the lure's position at all
        const targetX = this.lure.body.position.x + this.offset.x;
        const targetY = this.lure.body.position.y + this.offset.y;
        const targetZ = this.lure.body.position.z + this.offset.z;

        // Smoothly move fish to target position
        const lerpFactor = 10 * deltaTime; // Adjust this value to control follow speed
        
        this.fish.body.position.x += (targetX - this.fish.body.position.x) * lerpFactor;
        this.fish.body.position.y += (targetY - this.fish.body.position.y) * lerpFactor;
        this.fish.body.position.z += (targetZ - this.fish.body.position.z) * lerpFactor;

        // Copy lure's rotation for the fish
        this.fish.body.rotation.x = this.lure.body.rotation.x;
        this.fish.body.rotation.y = this.lure.body.rotation.y;
        this.fish.body.rotation.z = this.lure.body.rotation.z;
        this.fish.body.rotation.w = this.lure.body.rotation.w;
    }
}