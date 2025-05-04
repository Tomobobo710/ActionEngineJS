class ForestBuilding extends ActionPhysicsObject3D {
    constructor(physicsWorld, worldMode, width = 15, height = 18, depth = 15, position, scale = 1.0) {
        const hw = width / 2;
        const hh = height / 2;
        const hd = depth / 2;

        const characterModel = GLBLoader.loadModel(tree1Model);
        const triangles = characterModel.triangles;
        
        // Initialize with triangles
        super(physicsWorld, triangles);
        
        // Apply visual offset and scale to original vertices
        const visualOffset = new Vector3(0, -10, 0); // Adjust this value as needed
        
        // Calculate center point of the model for scaling around center
        let centerX = 0, centerY = 0, centerZ = 0;
        for (let i = 0; i < this.originalVerts.length; i++) {
            centerX += this.originalVerts[i].x;
            centerY += this.originalVerts[i].y;
            centerZ += this.originalVerts[i].z;
        }
        centerX /= this.originalVerts.length;
        centerY /= this.originalVerts.length;
        centerZ /= this.originalVerts.length;
        
        // Apply scale and offset to all original vertices
        for (let i = 0; i < this.originalVerts.length; i++) {
            // Scale around center point
            this.originalVerts[i].x = centerX + (this.originalVerts[i].x - centerX) * scale;
            this.originalVerts[i].y = centerY + (this.originalVerts[i].y - centerY) * scale;
            this.originalVerts[i].z = centerZ + (this.originalVerts[i].z - centerZ) * scale;
            
            // Apply offset after scaling
            this.originalVerts[i].x += visualOffset.x;
            this.originalVerts[i].y += visualOffset.y;
            this.originalVerts[i].z += visualOffset.z;
        }
        
        this.animator = new ModelAnimationController(characterModel);
        this.animator.play(0, true);
        
        // Physics setup - unchanged by visual scale
        const shape = new Goblin.BoxShape(width / 2, height / 2, depth / 2);
        this.body = new Goblin.RigidBody(shape, 0); // mass 0 = static
        this.body.position.set(position.x, position.y + hh, position.z);
        
        // Simple flag for trap state
        this.trapSet = false;
        
        // Detection zone radius (larger than the forest itself)
        this.zoneRadius = Math.max(width, depth) * 2;
        
        // Store our position for distance checking
        this.position = position;
        
        // Store world mode for checking player position
        this.worldMode = worldMode;
        
        this.id = Date.now();

        // When player touches the forest
        this.body.addListener(
            'contact',
            (other_body, contact) => {
                // Only care about player contacts
                if (!other_body.debugName || !other_body.debugName.includes('Character')) return;
                
                console.log(`Forest ${this.id} - Player contacted POI. Trap set: ${this.trapSet}`);
                
                // Only trigger if player has previously left the zone (trap is set)
                if (this.trapSet) {
                    console.log(`Forest ${this.id} - TRIGGERING FOREST INTERACTION! Trap was set.`);
                    // Here you would add actual forest interaction code
                    
                    // Reset trap after triggering
                    this.trapSet = false;
                }
            }
        );
        
        // Force an initial visual update
        this._visualDirty = true;
        this.updateVisual();
        
        // Add to the physics world
        this.physicsWorld.addObject(this);
    }
    
    // Call this from WorldMode's update loop
    checkPlayerDistance() {
        // Skip if trap is already set
        if (this.trapSet) return;
        
        // Check player position if it exists
        if (!this.worldMode.character) return;
        
        const playerPos = this.worldMode.character.position;
        const dx = playerPos.x - this.position.x;
        const dz = playerPos.z - this.position.z;
        const distanceToPlayer = Math.sqrt(dx*dx + dz*dz);
        
        // Initialize a flag to track if we've detected the player inside the zone
        if (this.playerDetectedInZone === undefined) {
            this.playerDetectedInZone = distanceToPlayer < this.zoneRadius;
            
            // Only log if player is inside the zone when first checked
            if (this.playerDetectedInZone) {
                console.log(`Forest ${this.id} - Player detected inside zone on start.`);
            }
        }
        
        // If player is outside the zone, set the trap
        if (distanceToPlayer > this.zoneRadius) {
            // Only log when trap gets set (when player exits)
            if (this.playerDetectedInZone) {
                console.log(`Forest ${this.id} - TRAP SET! Player left zone.`);
                this.trapSet = true;
                this.playerDetectedInZone = false;
            } else {
                // Player already outside zone but first time detecting it
                this.playerDetectedInZone = false;
                this.trapSet = true;
            }
        } else {
            // Player is inside zone
            this.playerDetectedInZone = true;
        }
    }
}