class TownBuilding extends ActionPhysicsObject3D {
    constructor(physicsWorld, worldMode, width = 8, height = 12, depth = 8, position) {
        const hw = width / 2;
        const hh = height / 2;
        const hd = depth / 2;

        const characterModel = GLBLoader.loadModel(townModel);
        
        const triangles = characterModel.triangles;
        
        super(physicsWorld, triangles);
        
        this.animator = new ModelAnimationController(characterModel);
        this.animator.play(0, true);

        // Physics setup
        const shape = new Goblin.BoxShape(width / 2, height / 2, depth / 2);
        this.body = new Goblin.RigidBody(shape, 0); // mass 0 = static
        this.body.position.set(position.x, position.y + hh, position.z);
        
        // Simple flag for trap state
        this.trapSet = false;
        
        // Detection zone radius (larger than the town itself)
        this.zoneRadius = Math.max(width, depth) * 2;
        
        // Store our position for distance checking
        this.position = position;
        
        // Store world mode for checking player position
        this.worldMode = worldMode;
        
        this.id = Date.now();

        // When player touches the town
        this.body.addListener(
            'contact',
            (other_body, contact) => {
                // Only care about player contacts
                if (!other_body.debugName || !other_body.debugName.includes('Character')) return;
                
                console.log(`Town ${this.id} - Player contacted POI. Trap set: ${this.trapSet}`);
                
                // Only trigger if player has previously left the zone (trap is set)
                if (this.trapSet) {
                    console.log(`Town ${this.id} - TRIGGERING TOWN INTERACTION! Trap was set.`);
                    // Here you would add actual town interaction code
                    
                    // Reset trap after triggering
                    this.trapSet = false;
                }
            }
        );
        
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
                console.log(`Town ${this.id} - Player detected inside zone on start.`);
            }
        }
        
        // If player is outside the zone, set the trap
        if (distanceToPlayer > this.zoneRadius) {
            // Only log when trap gets set (when player exits)
            if (this.playerDetectedInZone) {
                console.log(`Town ${this.id} - TRAP SET! Player left zone.`);
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