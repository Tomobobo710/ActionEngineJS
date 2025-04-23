// game/character/characters/thirdpersonactioncharacter.js
class ThirdPersonActionCharacter extends ActionCharacter {
    constructor(terrain, camera, game) {
        super(camera, game);
        this.game = game;
        this.terrain = terrain;
        
        // Store a global reference for debugging
        window.gameCharacter = this;
        
        // Add these new properties
        this.movementTimer = 0;
        this.battleThreshold = this.generateNewBattleThreshold();
        this.isMoving = false;
        
        this.characterModel = GLBLoader.loadModel(foxModel);
        this.animator = new ModelAnimationController(this.characterModel);
        console.log("Available animations:", this.animator.getAnimationNames());
        
        // Use saved position if available, otherwise use default
        const savedState = game.gameModeManager.gameMaster.getPlayerState();
        if (savedState && savedState.position) {
            this.body.position.set(
                savedState.position.x,
                savedState.position.y,
                savedState.position.z
            );
        } else {
            this.body.position.set(0, 500, 0);
        }
        
        // Terrain info
        this.gridPosition = { x: 0, z: 0 };
        this.currentBiome = null;
        this.heightPercent = 0;
        this.terrainHeight = 0;
        this.updateTerrainInfo();
        
        this.debug = false;
    }

    generateNewBattleThreshold() {
    // Generate threshold between 20-30 seconds of movement
        return Math.random() * 20 + 2;
    }
    getTerrainHeightAtPosition(worldX, worldZ) {
        const scaledX = worldX * 2;
        const scaledZ = worldZ * 2;

        const x = Math.floor(scaledX / this.terrain.baseWorldScale + this.terrain.gridResolution / 2);
        const z = Math.floor(scaledZ / this.terrain.baseWorldScale + this.terrain.gridResolution / 2);

        if (x < 0 || x >= this.terrain.gridResolution || z < 0 || z >= this.terrain.gridResolution) {
            return 0;
        }

        return this.terrain.heightMap[z][x];
    }

    getHeightOnTriangle(triangle, x, z) {
        const [v1, v2, v3] = triangle.vertices;

        const denominator = (v2.z - v3.z) * (v1.x - v3.x) + (v3.x - v2.x) * (v1.z - v3.z);
        const a = ((v2.z - v3.z) * (x - v3.x) + (v3.x - v2.x) * (z - v3.z)) / denominator;
        const b = ((v3.z - v1.z) * (x - v3.x) + (v1.x - v3.x) * (z - v3.z)) / denominator;
        const c = 1 - a - b;

        return a * v1.y + b * v2.y + c * v3.y;
    }
    
    updateTerrainInfo() {
        this.gridPosition.x = Math.floor(
            this.basePosition.x / this.terrain.baseWorldScale + this.terrain.gridResolution / 2
        );
        this.gridPosition.z = Math.floor(
            this.basePosition.z / this.terrain.baseWorldScale + this.terrain.gridResolution / 2
        );

        this.terrainHeight = this.getTerrainHeightAtPosition(this.basePosition.x, this.basePosition.z);
        this.heightPercent = (this.basePosition.y / this.terrain.generator.getBaseWorldHeight()) * 100;

        for (const [biomeName, biomeData] of Object.entries(BIOME_TYPES)) {
            if (this.heightPercent >= biomeData.heightRange[0] && this.heightPercent <= biomeData.heightRange[1]) {
                this.currentBiome = biomeName;
                break;
            }
        }
    }

    getCurrentTriangle() {
        const triangles = this.terrain.triangles;
        // Direct triangle access
        for (const triangle of triangles) {
            const v1 = triangle.vertices[0];
            const v2 = triangle.vertices[1];
            const v3 = triangle.vertices[2];

            const p = this.position;
            const d1 = MathUtils.sign(p, v1, v2);
            const d2 = MathUtils.sign(p, v2, v3);
            const d3 = MathUtils.sign(p, v3, v1);

            const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
            const hasPos = d1 > 0 || d2 > 0 || d3 > 0;

            if (!(hasNeg && hasPos)) {
                const avgHeight = (v1.y + v2.y + v3.y) / 3;

                let biomeType = "SNOW";
                for (const [type, data] of Object.entries(BIOME_TYPES)) {
                    const heightPercent = (avgHeight / this.terrain.generator.getBaseWorldHeight()) * 100;
                    if (heightPercent >= data.heightRange[0] && heightPercent <= data.heightRange[1]) {
                        biomeType = type;
                        break;
                    }
                }

                return {
                    vertices: [v1, v2, v3],
                    indices: [0, 1, 2],
                    minY: Math.min(v1.y, v2.y, v3.y),
                    maxY: Math.max(v1.y, v2.y, v3.y),
                    avgY: avgHeight,
                    normal: triangle.normal,
                    biome: biomeType
                };
            }
        }
        return null;
    }
    
    applyInput(input, deltaTime){
        super.applyInput(input, deltaTime);
        if (input.isKeyJustPressed("Action8")) {
            this.game.pendingMenuTransition = true;  // Set flag instead of switching directly
        }
        
        if (input.isKeyJustPressed("Action5")) {
            this.animator.play("attack", false); // animation test
        }
    }

    
    
    update(deltaTime){
        super.update(deltaTime);
        
        // Get the character's physics state from the debug info
        const state = this.debugInfo.state.current;
        const velocity = this.debugInfo.physics.velocity;
        
        // Check if the character is moving on the ground
        // Using a small threshold to filter out physics jitters
        const isMoving = state === "grounded" && 
                       (Math.abs(velocity.x) > 0.01 || Math.abs(velocity.z) > 0.01);
        
        // Increment timer based on movement and grounded state
        if (isMoving) {
            this.movementTimer += deltaTime;
            // Check if we've hit the time threshold
            if (this.movementTimer >= this.battleThreshold) {
                // Reset timer and generate new threshold
                this.movementTimer = 0;
                this.battleThreshold = this.generateNewBattleThreshold();
                // Set pending battle transition
                this.game.pendingBattleTransition = true;
            }
        }
        
        const pos = this.body.position;

        // Check if we're below 0
        if (pos.y < 0) {
            // Get current triangle
            const currentTriangle = this.getCurrentTriangle();
            if (currentTriangle) {
                // Set position 10 units above exact height on triangle
                const heightOnTriangle = this.getHeightOnTriangle(currentTriangle, pos.x, pos.z);
                pos.y = heightOnTriangle + 10;

                // Reset velocities
                this.body.linear_velocity.set(0, 0, 0);
                this.body.angular_velocity.set(0, 0, 0);

                // Force state to falling
                this.controller.changeState("falling");
            }
        }
        
        // Update animations based on state changes
        this.updateAnimationState();

        if (this.animator) {
            this.animator.update();
        }
    }
    
    updateAnimationState() {
        const debugInfo = this.controller.getDebugInfo();
        const state = debugInfo.state.current;
        const velocity = debugInfo.physics.velocity;
        const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
        const isReallyMoving = horizontalSpeed > 0.5;

        // Prevent interrupting non-looping animations
        if (this.animator.isPlaying && !this.animator.isLooping) {
            return;
        }

        // Ground state handling
        if (state === "grounded") {
            // Check for ground touch transition
            const justTouchedGround = !this.wasGroundedLastFrame && 
                this.animator.currentAnimation?.name !== "toucheground";

            if (justTouchedGround) {
                this.animator.play("toucheground", false);
            } 
            else if (isReallyMoving) {
                this.animator.play("run", true);
            } 
            else if (this.animator.currentAnimation?.name !== "toucheground") {
                this.animator.play("idle", true);
            }

            this.wasGroundedLastFrame = true;
        } 
        // Jumping state
        else if (state === "jumping") {
            this.animator.play("jump", false);
            this.wasGroundedLastFrame = false;
        } 
        // Falling state
        else if (state === "falling") {
            this.animator.play("fall", true);
            this.wasGroundedLastFrame = false;
        }
        if (this.debug) {
            // Optional debug logging
            console.log("Animation Update:", {
                state, 
                horizontalSpeed, 
                isReallyMoving, 
                currentAnim: this.animator.currentAnimation?.name
            });
        }
    }
    
    getDebugInfo() {
        return this.debugInfo;
    }
}