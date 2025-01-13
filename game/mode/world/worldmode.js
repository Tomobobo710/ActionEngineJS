// game/mode/worldmode.js
class WorldMode {
    constructor(canvases, input, audio, gameModeManager) {
        this.canvases = canvases;
        this.input = input;
        this.audio = audio;
        this.gameModeManager = gameModeManager;
        this.physicsWorld = new ActionPhysicsWorld3D();
        this.isPaused = false;

        this.initializeMode();
    }

    initializeMode() {
        this.gameCanvas3D = this.canvases.gameCanvas;
        this.gameCanvas3DCtx = this.gameCanvas3D.getContext("webgl2") || this.gameCanvas3D.getContext("webgl");

        this.gameCanvas2D = document.createElement("canvas");
        this.gameCanvas2D.width = 800;
        this.gameCanvas2D.height = 600;
        this.gameCanvas2D.style.zIndex = "1";
        document.body.appendChild(this.gameCanvas2D);
        this.gameCanvas2DCtx = this.gameCanvas2D.getContext("2d");

        this.guiCanvas = this.canvases.guiCanvas;
        this.guiCtx = this.guiCanvas.getContext("2d");

        this.debugCanvas = this.canvases.debugCanvas;

        this.renderer3D = new ActionRenderer3D(this.gameCanvas3D);
        this.renderer2D = new ActionRenderer2D(this.guiCanvas);

        this.weatherSystem = new WeatherSystem();
        this.shaderManager = new ShaderManager(this.renderer3D.gl);
        this.shaderManager.registerAllShaders(this.renderer3D);
        this.physicsWorld.setShaderManager(this.shaderManager);

        this.camera = new ActionCamera();
        this.seed = 420;

        this.generateWorld();

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

        console.log("[WorldMode] Initialization completed");
    }

    generateWorld() {
        if (this.physicsWorld) {
            let manifold = this.physicsWorld.world.narrowphase.contact_manifolds.first;
            while (manifold) {
                for (let i = 0; i < manifold.points.length; i++) {
                    manifold.points[i].destroy();
                }
                manifold = manifold.next_manifold;
            }
            this.physicsWorld.reset();
        }

        const baseConfig = {
            seed: this.seed
        };

        this.terrain = new Terrain(baseConfig);
        this.shaderManager.updateTerrainBuffers(this.terrain);

        const terrainBody = this.terrain.createPhysicsMesh();
        this.physicsWorld.addTerrainBody(terrainBody, 1, -1);

        if (this.poiManager) {
            this.poiManager.cleanup();
        }
        this.poiManager = new POIManager(this.terrain, this.physicsWorld, this);
        this.poiManager.generateAllPOIs();

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
    }

    resume() {
        this.isPaused = false;
        this.lastTime = performance.now();
        this.physicsWorld.resume();
    }

    update() {
        const currentTime = performance.now();
        this.deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.25);
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
            this.renderer3D.programRegistry.cycleShaders();
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
        if (this.gameCanvas2DCtx) {
            this.gameCanvas2DCtx.clearRect(0, 0, 800, 600);
        }

        if (this.gameCanvas3DCtx) {
            this.gameCanvas3DCtx.clear(this.gameCanvas3DCtx.COLOR_BUFFER_BIT | this.gameCanvas3DCtx.DEPTH_BUFFER_BIT);
        }

        if (this.guiCtx) {
            this.guiCtx.clearRect(0, 0, 800, 600);
        }

        if (this.use2DRenderer) {
            this.renderer2D.render(
                this.terrain,
                this.camera,
                this.character,
                this.showDebugPanel,
                this.weatherSystem,
                this.physicsWorld.objects
            );
        } else {
            const bufferInfo = this.shaderManager.getBufferInfo();

            this.renderer3D.render({
                ...bufferInfo,
                camera: this.camera,
                character: this.character,
                renderableObjects: Array.from(this.physicsWorld.objects),
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

        this.sphere.body.debugName = `Sphere_${Date.now()}`;
        this.sphere.body.createdAt = Date.now();

        this.physicsWorld.addObject(this.sphere);
    }

    cleanup() {
        // Clean up physics
        if (this.physicsWorld) {
            this.physicsWorld.reset();
            this.physicsWorld = null;
        }

        // Clean up character
        if (this.character) {
            // Need to add proper cleanup to character class
            this.character = null;
        }

        // Clean up POI manager
        if (this.poiManager) {
            this.poiManager.cleanup();
            this.poiManager = null;
        }

        // Clean up terrain
        if (this.terrain) {
            // Need to add proper cleanup to terrain class
            this.terrain = null;
        }

        // Clean up physics objects
        if (this.sphere) {
            this.sphere = null;
        }

        // Clean up rendering
        if (this.renderer3D) {
            // Need to add proper cleanup to renderer
            this.renderer3D = null;
        }
        if (this.renderer2D) {
            // Need to add proper cleanup to renderer
            this.renderer2D = null;
        }

        // Clean up shader manager
        if (this.shaderManager) {
            // Need to add proper cleanup to shader manager
            this.shaderManager = null;
        }

        // Clean up weather system
        if (this.weatherSystem) {
            // Need to add proper cleanup
            this.weatherSystem = null;
        }

        // Clean up camera
        if (this.camera) {
            // Need to add proper cleanup
            this.camera = null;
        }

        // Clean up debug panel
        if (this.debugPanel) {
            // Need to add proper cleanup
            this.debugPanel = null;
        }

        // Remove 2D canvas
        if (this.gameCanvas2D) {
            document.body.removeChild(this.gameCanvas2D);
            this.gameCanvas2D = null;
        }

        // Clear canvas references
        this.gameCanvas3D = null;
        this.gameCanvas3DCtx = null;
        this.gameCanvas2DCtx = null;
        this.guiCanvas = null;
        this.guiCtx = null;
        this.debugCanvas = null;

        // Clear other references
        this.canvases = null;
        this.input = null;
        this.audio = null;
    }
}