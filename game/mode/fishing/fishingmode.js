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
        this.camera = new ActionCamera(new Vector3(0, 20, -60), new Vector3(0, 0, 0));
        this.shaderManager = new ShaderManager(this.renderer3d.gl);
        this.shaderManager.registerAllShaders(this.renderer3d);
        this.physicsWorld.setShaderManager(this.shaderManager);
        this.ocean = new Ocean(this.physicsWorld, 500, 500, 8, 1);
        this.fishingArea = new FishingArea();
        this.fisher = new Fisher(this, new Vector3(0, 50, 0));
        this.lure = new Lure(this.physicsWorld);
        this.fisher.attachLure(this.lure);
        this.hookingBarVisible = false;
        this.hookingProgress = 0;
        this.fishes = [];
        this.fishingArea.generateInitialFish(20, this.physicsWorld);
    }

    update(deltaTime) {
    // Reset hooking UI state at start of update
    this.hookingBarVisible = false;
    this.hookingProgress = 0;

    this.fisher.update(deltaTime, this.input);
    this.lure.update(deltaTime);
    this.updateCamera(deltaTime);

    // Update all fish animations - modified to work with Map
    this.fishingArea.fish.forEach((fishAI, fish) => {
        fish.update(deltaTime);
    });

    // Update fishing area (which updates fish movement)
    this.fishingArea.update(deltaTime);

    // Modified to work with Map
    this.fishingArea.fish.forEach((fishAI, fish) => {
        if (fishAI.currentBehavior === fishAI.behaviors.attack && fishAI.canBeHooked) {
            this.hookingBarVisible = true;
            this.hookingProgress = fishAI.currentBehavior.getHookingWindowProgress();
        }
    });

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

        switch (this.fisher.state) {
            case "ready":
                // Simple behind-the-player camera
                targetPos = this.fisher.position.add(
                    new Vector3(-Math.sin(this.fisher.aimAngle) * 15, 8, -Math.cos(this.fisher.aimAngle) * 15)
                );
                targetLookAt = this.fisher.position.add(
                    new Vector3(Math.sin(this.fisher.aimAngle), 0, Math.cos(this.fisher.aimAngle)).scale(20)
                );
                break;

            case "casting":
            case "fishing":
                // Follow the lure with an offset back and up
                targetPos = this.lure.position.add(new Vector3(-8, 6, -8));
                targetLookAt = this.lure.position;
                break;

            case "reeling":
                const distanceToFisher = this.lure.position.distanceTo(this.fisher.position);
                if (distanceToFisher < 15) {
                    // Transition back to behind-player view when close
                    targetPos = this.fisher.position.add(new Vector3(0, 8, -15));
                    targetLookAt = this.fisher.position;
                } else {
                    // Keep following lure while reeling
                    targetPos = this.lure.position.add(new Vector3(-8, 6, -8));
                    targetLookAt = this.lure.position;
                }
                break;
        }

        // Smooth camera movement
        this.camera.position = this.camera.position.lerp(targetPos, deltaTime * CAMERA_LERP_SPEED);
        this.camera.target = this.camera.target.lerp(targetLookAt, deltaTime * CAMERA_LERP_SPEED);
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

        // Draw UI elements
        const gameState = {
            hookingBarVisible: this.hookingBarVisible,
            hookingProgress: this.hookingProgress,
            isChargingCast: this.fisher.isChargingCast,
            castPowerPercentage: this.fisher.getCastPowerPercentage(),
            hasHookedFish: Boolean(this.fisher.lure?.hookedFish),
            lineTension: this.fisher.lineTension
        };

        this.ui.draw(gameState);
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