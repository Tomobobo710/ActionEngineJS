class FishingMode {
    constructor(canvases, input, audio) {
        this.canvas = canvases.gameCanvas;
        this.guiCanvas = canvases.guiCanvas;
        this.debugCanvas = canvases.debugCanvas;
        this.input = input;
        this.physicsWorld = new ActionPhysicsWorld3D();
        this.renderer3d = new ActionRenderer3D(this.canvas);
        this.guiContext = this.guiCanvas.getContext("2d");
        this.ui = new FishingUI(this.guiCanvas, this.guiContext);
    const initialCameraPos = new Vector3(0, 20, -60);
    const initialCameraTarget = new Vector3(0, 0, 0);
        this.camera = new ActionCamera(initialCameraPos, initialCameraTarget);
        this.shaderManager = new ShaderManager(this.renderer3d.gl);
        this.shaderManager.registerAllShaders(this.renderer3d);
        this.physicsWorld.setShaderManager(this.shaderManager);
        this.ocean = new Ocean(this.physicsWorld, 500, 500, 8, 1);
        this.fishingArea = new FishingArea();
        this.fisher = new Fisher(this, new Vector3(0, 50, 0));
        this.lure = new Lure(this.physicsWorld);
        this.lure.setFisher(this.fisher);  // Make sure this line is here
        this.fisher.attachLure(this.lure);
        this.hookingBarVisible = false;
        this.hookingProgress = 0;
        this.fishes = [];
        this.fishingArea.generateInitialFish(20, this.physicsWorld);
    
            this.catchBag = {
            BASS: 0,
            TROUT: 0,
            SWORDFISH: 0   
        };   
        this.maxBagSize = 20; // Or whatever limit you want
    }

   update(deltaTime) {
    // Reset hooking UI state at start of update
    this.hookingBarVisible = false;
    this.hookingProgress = 0;

    this.fisher.update(deltaTime, this.input);
    this.lure.update(deltaTime);
    this.updateCamera(deltaTime);

    // Update all fish animations
    this.fishingArea.fish.forEach((fishAI, fish) => {
        fish.update(deltaTime);
    });

    // Update fishing area (which updates fish movement)
    this.fishingArea.update(deltaTime);

    // Handle caught fish decisions
    if (this.lure.hookedFish) {
            if (this.input.isKeyPressed("Action3")) {
                console.log("KEY PRESSED ACTION 3");
                const totalCaught = Object.values(this.catchBag).reduce((a, b) => a + b, 0);
                if (totalCaught < this.maxBagSize) {
                    this.keepFish(this.lure.hookedFish);
                    this.fisher.state = "ready";
                    this.ui.catchMenu.visible = false;
                } else {
                    // Could add a "bag full" message here
                    console.log("Catch bag is full!");
                }
            } else if (this.input.isKeyPressed("Action4")) {
                console.log("KEY PRESSED ACTION 4");
                this.fisher.state = "ready";
                this.releaseFish();
                this.ui.catchMenu.visible = false;
            }
        }
    

    // Handle reeling with spacebar
    if (this.input.isKeyPressed("Space")) {
        if (this.lure.state === "inWater") {
            const distanceToFisher = this.lure.position.distanceTo(this.fisher.position);
            if (distanceToFisher < 1) {
                this.state = "ready";
                this.castPower = 0;
                this.lure.reset();
                this.game.fishingArea.setLure(this.lure);
            } else {
                const direction = this.fisher.position.subtract(this.lure.position).normalize();
                this.lure.position = this.lure.position.add(direction.scale(50 * deltaTime));
            }
        }
    }

    for (const [fish, fishAI] of this.fishingArea.fish) {
        if (fishAI.currentBehavior === fishAI.behaviors.attack && fishAI.canBeHooked) {
            this.hookingBarVisible = true;
            this.hookingProgress = fishAI.currentBehavior.getHookingWindowProgress();
        }
    }

    this.physicsWorld.update(deltaTime);

    if (this.input.isKeyJustPressed("Numpad0")) {
        this.camera.isDetached = !this.camera.isDetached;
    }
    if (this.camera.isDetached) {
        this.camera.handleDetachedInput(this.input, deltaTime);
        return;
    }
}
    

    updateCamera(deltaTime) {
    if (this.camera.isDetached) return;

    const CAMERA_LERP_SPEED = 3;
    let targetPos, targetLookAt;

    // Default camera positions in case state handling fails
    targetPos = this.fisher.position.add(new Vector3(0, 8, -15));
    targetLookAt = this.fisher.position;

    switch (this.fisher.state) {
        case "ready":
            targetPos = this.fisher.position.add(
                new Vector3(-Math.sin(this.fisher.aimAngle) * 15, 8, -Math.cos(this.fisher.aimAngle) * 15)
            );
            targetLookAt = this.fisher.position.add(
                new Vector3(Math.sin(this.fisher.aimAngle), 0, Math.cos(this.fisher.aimAngle)).scale(20)
            );
            break;

        case "casting":
        case "fishing":
    if (this.lure && this.lure.position) {
        // Calculate direction from fisher to lure
        const castDirection = this.lure.position.subtract(this.fisher.position).normalize();
        
        // Use this direction to position camera behind lure
        targetPos = this.lure.position.subtract(castDirection.scale(12)).add(new Vector3(0, 6, 0));
        targetLookAt = this.lure.position;
    }
    break;

        case "reeling":
            if (this.lure && this.lure.position) {
                const distanceToFisher = this.lure.position.distanceTo(this.fisher.position);
                if (distanceToFisher < 15) {
                    targetPos = this.fisher.position.add(new Vector3(0, 8, -15));
                    targetLookAt = this.fisher.position;
                } else {
                    targetPos = this.lure.position.add(new Vector3(-8, 6, -8));
                    targetLookAt = this.lure.position;
                }
            }
            break;

        case "fighting":
            if (this.lure && this.lure.position) {
                targetPos = this.lure.position.add(new Vector3(-12, 8, -12));
                targetLookAt = this.lure.position;
            }
            break;
    }

    // Ensure we have valid vectors before lerping
    if (targetPos && targetLookAt) {
        this.camera.position = this.camera.position.lerp(targetPos, deltaTime * CAMERA_LERP_SPEED);
        this.camera.target = this.camera.target.lerp(targetLookAt, deltaTime * CAMERA_LERP_SPEED);
    }
}

    pause() {
        this.physicsWorld.pause();
    }

    resume() {
        this.physicsWorld.resume();
    }

    draw() {
    // Draw 3D scene
    const bufferInfo = this.shaderManager.getBufferInfo();
    this.renderer3d.render({
        renderableBuffers: bufferInfo.renderableBuffers,
        renderableIndexCount: bufferInfo.renderableIndexCount,
        camera: this.camera,
        renderableObjects: Array.from(this.physicsWorld.objects)
    });

    const distanceToFisher = this.lure?.position.distanceTo(this.fisher.position) || Infinity;
    const isLureAtFisher = distanceToFisher < 1;

    const gameState = {
        hookingBarVisible: this.hookingBarVisible,
        hookingProgress: this.hookingProgress,
        isChargingCast: this.fisher.isChargingCast,
        castPowerPercentage: this.fisher.getCastPowerPercentage(),
        hasHookedFish: Boolean(this.lure?.hookedFish),
        hookedFish: this.lure?.hookedFish,
        lineTension: this.fisher.lineTension,
        catchBag: this.catchBag,
        fisherState: this.fisher.state,
        isLureAtFisher: isLureAtFisher  // Add this new state
    };

    this.ui.draw(gameState);
}

    keepFish(fish) {
    // Get fish type and increment bag count
    const fishType = fish.type; // Assuming fish has a type property
    this.catchBag[fishType]++;
    
    // Remove fish from game
    this.physicsWorld.removeObject(fish);
    this.fishingArea.fish.delete(fish);
    
    // Reset lure state
    this.lure.hookedFish = null;
    this.lure.reset();
    
    // Optional: Log catch
    console.log(`Caught ${fishType}! Bag: `, this.catchBag);
}

releaseFish() {
    if (this.lure.hookedFish) {
        this.lure.releaseHookedFish();
        this.lure.reset();
    }
}
    
    // When switching "game modes" cleanup() will be called to destroy this mode
    cleanup() {
        if (this.physicsWorld) {
            this.physicsWorld.reset();
            this.physicsWorld = null;
        }

        if (this.renderer3d && this.renderer3d.gl) {
            const gl = this.renderer3d.gl;

            // Clean up all WebGL resources
            if (this.renderer3d.program) {
                gl.deleteProgram(this.renderer3d.program);
            }
            if (this.renderer3d.vertexBuffer) {
                gl.deleteBuffer(this.renderer3d.vertexBuffer);
            }
            if (this.renderer3d.indexBuffer) {
                gl.deleteBuffer(this.renderer3d.indexBuffer);
            }

            this.renderer3d = null;
        }

        if (this.shaderManager) {
            this.shaderManager = null;
        }

        if (this.depthFramebuffer && this.renderer3d && this.renderer3d.gl) {
            const gl = this.renderer3d.gl;
            gl.deleteFramebuffer(this.depthFramebuffer);
            gl.deleteTexture(this.depthTexture);
            this.depthFramebuffer = null;
            this.depthTexture = null;
        }

        this.fishes = [];
        this.camera = null;
        this.fisher = null;
        this.lure = null;
        this.fishingArea = null;
        this.ocean = null;

        // Clear canvases
        if (this.guiContext) {
            this.guiContext.clearRect(0, 0, 800, 600);
        }

        if (this.ui) {
            this.ui = null;
        }

        this.input.clearAllElements();

        // Clear references
        this.canvas = null;
        this.guiCanvas = null;
        this.debugCanvas = null;
        this.guiContext = null;
        this.input = null;
    }
}