class Lure extends ActionPhysicsSphere3D {
    constructor(physicsWorld, radius = 2) {
        super(physicsWorld, radius, 0, new Vector3(0,0,0)); // mass 0
        this.fisher = null;
        this.state = 'inactive'; // inactive, casting, inWater
        this.visible = false;
        
        // Our own physics properties
        this.lureVelocity = new Vector3(0, 0, 0);
        this.lureGravity = -9.8;
        this.maxLureVelocity = 15;
        
        this.bounds = {
            width: 500,
            length: 500,
            depth: 50
        };
		physicsWorld.addObject(this);
    }
setFisher(fisher) {
        this.fisher = fisher;
        this.reset();
    }
    startCast(startPos, castVelocity, castDirection) {
        this.state = 'casting';
        this.position = startPos.clone();
        
        if (castVelocity.length() > this.maxLureVelocity) {
            castVelocity = castVelocity.normalize().scale(this.maxLureVelocity);
        }
        this.lureVelocity = castVelocity;
        this.castDirection = castDirection.clone();
        this.visible = true;
        
        if (this.fisher?.game) {
            this.fisher.game.fishingArea.setLure(this);
        }
    }

    update(deltaTime) {
        if (this.state === 'casting') {
            // Calculate new position before applying it
            const newX = this.position.x + this.lureVelocity.x * deltaTime;
            const newY = this.position.y + this.lureVelocity.y * deltaTime;
            const newZ = this.position.z + this.lureVelocity.z * deltaTime;
            
            // Check bounds before updating position
            const halfWidth = this.bounds.width / 2;
            const halfLength = this.bounds.length / 2;
            
            // Only update if within bounds
            if (newX >= -halfWidth && newX <= halfWidth &&
                newZ >= -halfLength && newZ <= halfLength) {
                this.position.x = newX;
                this.position.z = newZ;
            } else {
                // Hit boundary, enter water
                this.state = 'inWater';
            }
            
            // Y position and gravity always update
            this.position.y = newY;
            this.lureVelocity.y += this.lureGravity * deltaTime;
            
            // Update physics body
            this.body.position.x = this.position.x;
            this.body.position.y = this.position.y;
            this.body.position.z = this.position.z;

            // Check for water contact
            if (this.fisher?.game) {
                const waterHeight = this.fisher.game.ocean.getWaterHeightAt(
                    this.position.x, 
                    this.position.z
                );
                
                if (this.position.y <= waterHeight) {
                    this.state = 'inWater';
                    this.fisher.game.fishingArea.setLure(this);
                }
            }
        }
        
        this.updateVisual();
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
        if (this.state !== 'inWater') return;
        
        switch(direction) {
            case 'forward':
                this.position.z += amount;
                break;
            case 'backward':
                this.position.z -= amount;
                break;
            case 'left':
                this.position.x -= amount;
                break;
            case 'right':
                this.position.x += amount;
                break;
        }
        
        if (this.fisher?.game) {
            this.fisher.game.fishingArea.setLure(this);
        }
    }

    reset() {
    if (!this.fisher) return;
    this.state = 'inactive';
    this.position = this.fisher.position.clone();
    this.visible = false;
    this.lureVelocity = new Vector3(0, 0, 0);
    
    // Update physics body position too
    this.body.position.x = this.position.x;
    this.body.position.y = this.position.y;
    this.body.position.z = this.position.z;
    
    if (this.fisher.game) {
        this.fisher.game.fishingArea.setLure(this);
    }
}
}