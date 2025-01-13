// game.js
class Game {
    static get WIDTH() {
        return 800;
    }

    static get HEIGHT() {
        return 600;
    }

    static physicsWorld = null;
    static renderer3D = null;
    static camera = null;

    constructor(canvases, input, audio) {
        this.pendingCanvases = canvases;
        this.pendingInput = input;
        this.pendingAudio = audio;
        this.physicsWorld = new ActionPhysicsWorld3D();
        this.isPaused = false;

        // Visibility change listener
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                this.pause();
            } else {
                this.resume();
            }
        });

        // Blur/focus listeners for additional safety
        window.addEventListener("blur", () => this.pause());
        window.addEventListener("focus", () => this.resume());

        this.initializeGame();
    }

    initializeGame() {
        Game.physicsWorld = this.physicsWorld;
        this.input = this.pendingInput;
        this.audio = this.pendingAudio;
        this.gameCanvas = this.pendingCanvases.gameCanvas;
        this.guiCanvas = this.pendingCanvases.guiCanvas;
        this.debugCanvas = this.pendingCanvases.debugCanvas;

        this.renderer3d = new ActionRenderer3D(this.gameCanvas);
        Game.renderer3D = this.renderer3d;
        this.renderer2d = new ActionRenderer2D(this.guiCanvas);

        this.weatherSystem = new WeatherSystem();
        this.shaderManager = new ShaderManager(this.renderer3d.gl);
        this.shaderManager.registerAllShaders(this.renderer3d);
        this.physicsWorld.setShaderManager(this.shaderManager);

        this.camera = new ActionCamera();

        this.seed = 420;

        this.generateWorld();

        // Create character
        this.character = null;
        this.createCharacter = true;
        if (this.createCharacter) {
            this.character = new ThirdPersonActionCharacter(this.terrain, this.camera, this);
            this.shaderManager.updateCharacterBuffers(this.character);
        }

        this.lastTime = performance.now();
        this.deltaTime = 0;
        this.debugPanel = new DebugPanel(this.debugCanvas, this);
        this.showDebugPanel = false;
        this.use2DRenderer = false;
        console.log("[Game] Game initialization completed, starting game loop...");

        this.loop();
    }

    generateWorld() {
        if (this.physicsWorld) {
            // First destroy any existing contacts
            let manifold = this.physicsWorld.world.narrowphase.contact_manifolds.first;
            while (manifold) {
                for (let i = 0; i < manifold.points.length; i++) {
                    manifold.points[i].destroy();
                }
                manifold = manifold.next_manifold;
            }
            this.physicsWorld.reset();
        }

        // Generate new terrain
        const baseConfig = {
            seed: this.seed
        };

        // Create visual for terrain
        this.terrain = new Terrain(baseConfig);
        this.shaderManager.updateTerrainBuffers(this.terrain);

        // Create terrain physics object
        const terrainBody = this.terrain.createPhysicsMesh();
        this.physicsWorld.addTerrainBody(terrainBody, 1, -1);

        if (this.poiManager) {
            this.poiManager.cleanup();
        }

        // Create and store POI manager reference
        this.poiManager = new POIManager(this.terrain, this.physicsWorld);
        this.poiManager.generateAllPOIs();

        // Set Character's terrain
        if (this.character) {
            this.character.terrain = this.terrain;
            this.shaderManager.updateCharacterBuffers(this.character);
        }

        this.sphere = null;
        this.createTestSphere();
    }

    pause() {
        this.isPaused = true;
        this.physicsWorld.pause();
        console.log("[Game] Paused");
    }

    resume() {
        this.isPaused = false;
        this.lastTime = performance.now();
        this.physicsWorld.resume();
        console.log("[Game] Resumed");
    }

    update() {
        const currentTime = performance.now();
        this.deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.25); // Cap at 250ms
        this.lastTime = currentTime;

        if (!this.isPaused) {
            this.physicsWorld.update(this.deltaTime);
            this.handleInput();
            this.weatherSystem.update(this.deltaTime, this.terrain);
        }
    }

    handleInput() {
        if (this.character) {
            this.character.applyInput(this.input, this.deltaTime);
            this.character.update(this.deltaTime);
        }

        if (this.input.isKeyJustPressed("Numpad5")) {
            this.renderer3d.programRegistry.cycleShaders();
        }

        if (this.input.isKeyJustPressed("Action3")) {
            this.showDebugPanel = !this.showDebugPanel;
        }

        if (this.input.isKeyJustPressed("Action4")) {
            this.seed = Math.floor(Math.random() * 10000);
            this.generateWorld();
        }
        if (this.input.isKeyJustPressed("Action2")) {
            this.use2DRenderer = !this.use2DRenderer;
        }
    }

    draw() {
        const guiCtx = this.guiCanvas.getContext("2d");
        if (guiCtx) {
            guiCtx.clearRect(0, 0, Game.WIDTH, Game.HEIGHT);
        }

        if (this.use2DRenderer) {
            const gl = this.gameCanvas.getContext("webgl2") || this.gameCanvas.getContext("webgl");
            if (gl) {
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            }

            this.renderer2d.render(
                this.terrain,
                this.camera,
                this.character,
                this.showDebugPanel,
                this.weatherSystem,
                this.physicsWorld.objects
            );
        } else {
            const ctx2d = this.gameCanvas.getContext("2d");
            if (ctx2d) {
                ctx2d.clearRect(0, 0, Game.WIDTH, Game.HEIGHT);
            }

            const bufferInfo = this.shaderManager.getBufferInfo();

            this.renderer3d.render({
                ...bufferInfo,
                camera: this.camera,
                character: this.character,
                renderableObjects: this.physicsWorld.objects, // Use the physics world's Set
                showDebugPanel: this.showDebugPanel,
                weatherSystem: this.weatherSystem
            });
        }

        if (this.showDebugPanel) {
            this.debugPanel.draw();
        } else {
            this.debugPanel.clear();
        }
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    createTestSphere() {
        if (this.sphere) {
            this.physicsWorld.removeObject(this.sphere);
            this.sphere = null;
        }

        this.sphere = new ActionPhysicsSphere3D(
            this.physicsWorld,
            5,
            1,
            new Vector3(Math.random() * 20 - 10, 500, Math.random() * 20 - 10)
        );

        // Add tracking info directly to the rigidbody
        this.sphere.body.debugName = `Sphere_${Date.now()}`;
        this.sphere.body.createdAt = Date.now();

        this.physicsWorld.addObject(this.sphere);
        //console.log(`Created sphere: ${this.sphere.body.debugName}`);
    }
}