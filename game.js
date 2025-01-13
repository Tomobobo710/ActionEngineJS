// game.js
class Game {
    static get WIDTH() {
        return 800;
    }
    
    static get HEIGHT() {
        return 600;
    }
    
    constructor(canvases, input, audio) {
        this.canvases = canvases;
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
        this.input = this.pendingInput;
        this.audio = this.pendingAudio;
        
        this.gameCanvas3D = this.canvases.gameCanvas;
        this.gameCanvas3DCtx = this.gameCanvas3D.getContext("webgl2") || this.gameCanvas3D.getContext("webgl");
        
        this.gameCanvas2D = document.createElement("canvas");
        this.gameCanvas2D.width = Game.WIDTH;
        this.gameCanvas2D.height = Game.HEIGHT;
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

        // Create POI manager
        if (this.poiManager) {
            this.poiManager.cleanup();
        }
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
        // Clear the 2D game canvas
        if (this.gameCanvas2DCtx) {
            this.gameCanvas2DCtx.clearRect(0, 0, Game.WIDTH, Game.HEIGHT);
        }
        
        // Clear the 3D game canvas
        if (this.gameCanvas3DCtx) {
            this.gameCanvas3DCtx.clear(this.gameCanvas3DCtx.COLOR_BUFFER_BIT | this.gameCanvas3DCtx.DEPTH_BUFFER_BIT);
        }
        
        // Clear GUI canvas
        if (this.guiCtx) {
            this.guiCtx.clearRect(0, 0, Game.WIDTH, Game.HEIGHT);
        }
        
        // Render
        if (this.use2DRenderer) {
            // Render projected triangles in 2D context
            this.renderer2D.render(
                this.terrain,
                this.camera,
                this.character,
                this.showDebugPanel,
                this.weatherSystem,
                this.physicsWorld.objects
            );
        } else {
            // Render 3D in WebGL context
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
        
        // Render debug panel if enabled
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