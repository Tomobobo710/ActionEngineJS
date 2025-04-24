class DungeonBuilding extends ActionPhysicsObject3D {
    constructor(physicsWorld, worldMode, width = 10, height = 6, depth = 10, position) {
        const hw = width / 2;
        const hh = height / 2;
        const hd = depth / 2;

        // Create vertices for dungeon shape (keeping same visual geometry)
        const COLORS = {
            MAIN_STONE: "#847E87",      // Main archway stone
            DARK_STONE: "#4A474F",      // Shadowed areas
            ACCENT_STONE: "#6B6773",    // Decorative elements
            RUBBLE: "#5D5A63",         // Fallen stones
            FLOOR: "#3D3B41"           // Ground
        };
        
        const characterModel = GLBLoader.loadModel(dungeonModel);
        const triangles = characterModel.triangles;
        
        super(physicsWorld, triangles);
        
        this.animator = new ModelAnimationController(characterModel);
        this.animator.play(0, true);
        
        // Physics setup
        const shape = new Goblin.BoxShape(width / 2, height / 2, depth / 2);
        this.body = new Goblin.RigidBody(shape, 0);
        this.body.position.set(position.x, position.y + hh, position.z);
        
        // Simple flag for trap state
        this.trapSet = false;
        
        // Detection zone radius (larger than the dungeon itself)
        this.zoneRadius = Math.max(width, depth) * 2;
        
        // Store our position for distance checking
        this.position = position;
        
        // Store world mode for checking player position
        this.worldMode = worldMode;
        
        this.id = Date.now();

        // When player touches the dungeon
        this.body.addListener(
            'contact',
            (other_body, contact) => {
                // Only care about player contacts
                if (!other_body.debugName || !other_body.debugName.includes('Character')) return;
                
                console.log(`Dungeon ${this.id} - Player contacted POI. Trap set: ${this.trapSet}`);
                
                // Only trigger if player has previously left the zone (trap is set)
                if (this.trapSet) {
                    console.log(`Dungeon ${this.id} - TRIGGERING BATTLE! Trap was set.`);
                    requestAnimationFrame(() => {
                        worldMode.gameModeManager.switchMode('battle');
                    });
                    
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
                console.log(`Dungeon ${this.id} - Player detected inside zone on start.`);
            }
        }
        
        // If player is outside the zone, set the trap
        if (distanceToPlayer > this.zoneRadius) {
            // Only log when trap gets set (when player exits)
            if (this.playerDetectedInZone) {
                console.log(`Dungeon ${this.id} - TRAP SET! Player left zone.`);
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