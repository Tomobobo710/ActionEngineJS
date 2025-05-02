// game/mode/shadowtest/shadowtestmode.js
class ShadowTestMode {
    constructor(canvases, input, audio, gameModeManager) {
        this.canvases = canvases;
        this.input = input;
        this.audio = audio;
        this.gameModeManager = gameModeManager;
        
        this.isPaused = false;

        // Initialize the shadow test mode components
        this.initializeMode();
    }

    initializeMode() {
        // Initialize 3D canvas
        this.gameCanvas3D = this.canvases.gameCanvas;
        this.gameCanvas3DCtx = this.gameCanvas3D.getContext("webgl2") || this.gameCanvas3D.getContext("webgl");

        // Debug and GUI canvases
        this.guiCanvas = this.canvases.guiCanvas;
        this.guiCtx = this.guiCanvas.getContext("2d");
        this.debugCanvas = this.canvases.debugCanvas;

        // Initialize 3D renderer
        this.renderer3D = new ActionRenderer3D(this.gameCanvas3D);
        
        // Initialize shader management
        this.shaderManager = new ShaderManager(this.renderer3D);
        this.shaderManager.registerAllShaders(this.renderer3D);
        
        // Initialize physics world
        this.physicsWorld = new ActionPhysicsWorld3D(this.shaderManager);

        // Setup camera
        this.camera = new ActionCamera();
        // Position the camera to view the test scene properly
        this.camera.position.set(0, 15, 30);
        this.camera.lookAt(new Vector3(0, 5, 0));
        
        // Create a simple test scene
        this.createTestScene();
        
        // Create debug UI
        this.debugPanel = new DebugGui(this.debugCanvas, this);
        this.lightingDebugPanel = new LightingDebugPanel(this.debugCanvas, this);
        this.showDebugPanel = true;

        // Setup time tracking
        this.lastTime = performance.now();
        this.deltaTime = 0;
        
        console.log("[ShadowTestMode] Initialization completed");
    }

    createTestScene() {
        // Create ground plane
        const groundSize = 50;
        const groundThickness = 2; // Make the ground thicker to prevent peter-panning
        this.ground = new ActionPhysicsBox3D(
            this.physicsWorld,
            groundSize, groundThickness, groundSize,
            0, // Static mass
            new Vector3(0, -groundThickness/2, 0)
        );
        this.ground.body.debugName = "ground";
        this.ground.color = [0.8, 0.8, 0.8]; // Light gray
        this.physicsWorld.addObject(this.ground);

        // Create a wall
        const wallHeight = 15;
        const wallWidth = 20;
        const wallDepth = 2;
        this.wall = new ActionPhysicsBox3D(
            this.physicsWorld,
            wallWidth, wallHeight, wallDepth,
            0, // Static mass
            new Vector3(0, wallHeight/2, -15)
        );
        this.wall.body.debugName = "wall";
        this.wall.color = [0.7, 0.5, 0.3]; // Brown
        this.physicsWorld.addObject(this.wall);

        // Create some test cubes
        for (let i = 0; i < 5; i++) {
            const size = 2 + Math.random() * 2;
            const cube = new ActionPhysicsBox3D(
                this.physicsWorld,
                size, size, size,
                1, // Dynamic mass
                new Vector3(-10 + i * 5, 10 + i * 3, -5 + i * 2)
            );
            cube.body.debugName = `cube_${i}`;
            cube.color = [0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6];
            this.physicsWorld.addObject(cube);
        }

        // Create a sphere
        this.sphere = new ActionPhysicsSphere3D(
            this.physicsWorld,
            3, // Radius
            1, // Dynamic mass
            new Vector3(8, 8, 0)
        );
        this.sphere.body.debugName = "sphere";
        this.sphere.color = [0.9, 0.2, 0.2]; // Red
        this.physicsWorld.addObject(this.sphere);

        // Initialize light rotation animation
        this.lightAngle = 0;
        this.lightRotationSpeed = 0.2; // Radians per second
        this.animateLight = true;
    }

    updateLightPosition(deltaTime) {
        if (!this.animateLight) return;
        
        // Update light angle
        this.lightAngle += this.lightRotationSpeed * deltaTime;
        
        // Calculate new light position based on angle
        const radius = 20;
        const height = 15;
        
        // Update light position and direction in lighting constants
        lightingConstants.LIGHT_POSITION.x = Math.cos(this.lightAngle) * radius;
        lightingConstants.LIGHT_POSITION.y = height;
        lightingConstants.LIGHT_POSITION.z = Math.sin(this.lightAngle) * radius;
        
        // Update light direction to point at center of scene
        const lightPos = new Vector3(
            lightingConstants.LIGHT_POSITION.x,
            lightingConstants.LIGHT_POSITION.y,
            lightingConstants.LIGHT_POSITION.z
        );
        const targetPos = new Vector3(0, 0, 0);
        const direction = new Vector3();
        direction.subtract(lightPos, targetPos);
        direction.normalize();
        
        lightingConstants.LIGHT_DIRECTION.x = direction.x;
        lightingConstants.LIGHT_DIRECTION.y = direction.y;
        lightingConstants.LIGHT_DIRECTION.z = direction.z;
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
            this.handleInput();
            this.physicsWorld.update(this.deltaTime);
            this.updateLightPosition(this.deltaTime);
        }
    }

    handleInput() {
        // Toggle debug panel
        if (this.input.isKeyJustPressed("Action4")) {
            this.showDebugPanel = !this.showDebugPanel;
        }
        
        // Toggle light animation
        if (this.input.isKeyJustPressed("Action2")) {
            this.animateLight = !this.animateLight;
            console.log(`Light animation ${this.animateLight ? 'enabled' : 'disabled'}`);
        }
        
        // Reset the test scene
        if (this.input.isKeyJustPressed("Action3")) {
            console.log("[ShadowTestMode] Resetting test scene...");
            this.resetTestScene();
        }
        
        // Camera controls
        if (this.input.isKeyPressed("ArrowUp")) {
            this.camera.position.z -= 10 * this.deltaTime;
        }
        if (this.input.isKeyPressed("ArrowDown")) {
            this.camera.position.z += 10 * this.deltaTime;
        }
        if (this.input.isKeyPressed("ArrowLeft")) {
            this.camera.position.x -= 10 * this.deltaTime;
        }
        if (this.input.isKeyPressed("ArrowRight")) {
            this.camera.position.x += 10 * this.deltaTime;
        }
        if (this.input.isKeyPressed("KeyQ")) {
            this.camera.position.y += 10 * this.deltaTime;
        }
        if (this.input.isKeyPressed("KeyE")) {
            this.camera.position.y -= 10 * this.deltaTime;
        }
        
        // Apply look at center if any camera movement happened
        if (this.input.isKeyPressed("ArrowUp") || 
            this.input.isKeyPressed("ArrowDown") ||
            this.input.isKeyPressed("ArrowLeft") ||
            this.input.isKeyPressed("ArrowRight") ||
            this.input.isKeyPressed("KeyQ") ||
            this.input.isKeyPressed("KeyE")) {
            this.camera.lookAt(new Vector3(0, 5, 0));
        }
    }

    resetTestScene() {
        // Remove all dynamic objects
        const objectsToRemove = [];
        this.physicsWorld.objects.forEach(obj => {
            if (obj.body && obj.body.mass > 0) {
                objectsToRemove.push(obj);
            }
        });
        
        objectsToRemove.forEach(obj => {
            this.physicsWorld.removeObject(obj);
        });
        
        // Recreate test objects
        for (let i = 0; i < 5; i++) {
            const size = 2 + Math.random() * 2;
            const cube = new ActionPhysicsBox3D(
                this.physicsWorld,
                size, size, size,
                1, // Dynamic mass
                new Vector3(-10 + i * 5, 10 + i * 3, -5 + i * 2)
            );
            cube.body.debugName = `cube_${i}`;
            cube.color = [0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6];
            this.physicsWorld.addObject(cube);
        }

        // Create a new sphere
        this.sphere = new ActionPhysicsSphere3D(
            this.physicsWorld,
            3, // Radius
            1, // Dynamic mass
            new Vector3(8, 8, 0)
        );
        this.sphere.body.debugName = "sphere";
        this.sphere.color = [0.9, 0.2, 0.2]; // Red
        this.physicsWorld.addObject(this.sphere);
    }

    draw() {
        // Clear canvases
        if (this.gameCanvas3DCtx) {
            this.gameCanvas3DCtx.clear(this.gameCanvas3DCtx.COLOR_BUFFER_BIT | this.gameCanvas3DCtx.DEPTH_BUFFER_BIT);
        }

        if (this.guiCtx) {
            this.guiCtx.clearRect(0, 0, 800, 600);
        }

        // Render 3D scene
        this.renderer3D.render({
            camera: this.camera,
            renderableObjects: [...Array.from(this.physicsWorld.objects)],
            showDebugPanel: this.showDebugPanel
        });

        // Update and draw debug panels
        if (this.showDebugPanel) {
            this.debugPanel.update();
            this.debugPanel.draw();
            this.lightingDebugPanel.update();
            this.lightingDebugPanel.draw();
        } else {
            this.debugPanel.clear();
            this.lightingDebugPanel.clear();
        }

        // Draw GUI
        this.drawUI();
    }

    drawUI() {
        this.guiCtx.save();
        
        this.guiCtx.font = "16px Arial";
        this.guiCtx.fillStyle = "white";
        this.guiCtx.textAlign = "left";
        this.guiCtx.textBaseline = "top";

        // Draw title
        this.guiCtx.font = "24px Arial";
        this.guiCtx.fillText("Shadow Testing Mode", 10, 10);
        
        // Draw controls help
        this.guiCtx.font = "16px Arial";
        this.guiCtx.fillText("Controls:", 10, 50);
        this.guiCtx.fillText("Arrow Keys: Move Camera", 10, 75);
        this.guiCtx.fillText("Q/E: Move Camera Up/Down", 10, 100);
        this.guiCtx.fillText("Action2: Toggle Light Animation", 10, 125);
        this.guiCtx.fillText("Action3: Reset Test Scene", 10, 150);
        this.guiCtx.fillText("Action4: Toggle Debug Panel", 10, 175);
        
        // Draw light info
        const lightPosX = Math.round(lightingConstants.LIGHT_POSITION.x * 100) / 100;
        const lightPosY = Math.round(lightingConstants.LIGHT_POSITION.y * 100) / 100;
        const lightPosZ = Math.round(lightingConstants.LIGHT_POSITION.z * 100) / 100;
        
        this.guiCtx.fillText(`Light Position: (${lightPosX}, ${lightPosY}, ${lightPosZ})`, 10, 225);
        this.guiCtx.fillText(`Light Animation: ${this.animateLight ? 'ON' : 'OFF'}`, 10, 250);

        this.guiCtx.restore();
    }

    cleanup() {
        // Clean up physics
        if (this.physicsWorld) {
            this.physicsWorld.reset();
            this.physicsWorld = null;
        }

        // Clean up debug panels
        if (this.debugPanel) {
            this.debugPanel = null;
        }
        
        if (this.lightingDebugPanel) {
            this.lightingDebugPanel = null;
        }

        // Clean up rendering
        if (this.renderer3D) {
            this.renderer3D = null;
        }

        // Clean up shader manager
        if (this.shaderManager) {
            this.shaderManager = null;
        }

        // Clean up camera
        if (this.camera) {
            this.camera = null;
        }

        this.input.clearAllElements();

        // Clear canvas references
        this.gameCanvas3D = null;
        this.gameCanvas3DCtx = null;
        this.guiCanvas = null;
        this.guiCtx = null;
        this.debugCanvas = null;

        // Clear other references
        this.canvases = null;
        this.input = null;
        this.audio = null;
        
        console.log("[ShadowTestMode] Cleanup completed");
    }
}