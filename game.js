/**
 * Memory Palace 3D - Method of Loci Environment (WebGL Version)
 *
 * A spatial memory system where users can:
 * - Fly through a large 3D space
 * - Place textured blocks
 * - Attach long-form notes to blocks
 * - Save/load their memory palace
 *
 * Refactored with OOP principles:
 * - Clean separation of concerns
 * - Modular manager classes
 * - Encapsulated functionality
 */
import { MemoryPalaceAPI } from './api.js';
import { SceneManager } from './sceneManager.js';
import { UIManager } from './uiManager.js';
import { PhysicsEngine } from './physicsEngine.js';
import { ActionInputHandler } from './actionengine/input/inputhandler.js';
import { ActionAudioManager } from './actionengine/sound/audiomanager.js';
import { MemoryBlock } from './memoryBlock.js';
import { WebGLUtils } from './webglUtils.js';
import { WebGLGeometryBuilder } from './webglGeometryBuilder.js';
import { Renderer } from './renderer.js';
import { TextEditor } from './textEditor.js';
import { Level } from './level.js';
import { Player } from './player.js';
import { ShaderManager } from './shaderManager.js';
import { BlockManager } from './blockManager.js';
import { InputManager } from './inputManager.js';

// Note: Vector3, Matrix4, ActionModel3D are loaded globally via script tags
// and will be available as global constructors



// Main Game class using WebGL
class Game {
    static WIDTH = 800;
    static HEIGHT = 600;

    constructor(canvases, input, audio, backendAvailable) { // Add backendAvailable parameter
        // Canvas setup
        this.canvas = canvases.gameCanvas;
        this.gl = this.canvas.getContext("webgl");
        this.guiCtx = canvases.guiCtx;
        this.debugCtx = canvases.debugCtx;

        // Bind methods for App loop
        this.action_pre_update = () => {};
        this.action_update = this.update.bind(this);
        this.action_post_update = () => {};
        this.action_fixed_update = () => {};
        this.action_pre_draw = () => {};
        this.action_post_draw = () => {};
        this.action_draw = this.draw.bind(this);

        if (!this.gl) {
            console.error("WebGL not supported");
            // Try WebGL2 if WebGL fails
            this.gl = this.canvas.getContext("webgl2");
            if (!this.gl) {
                console.error("WebGL2 also not supported");
                return;
            } else {
                console.log("✅ Using WebGL2 context");
            }
        } else {
            console.log("✅ Using WebGL context");
        }

        // Initialize core systems
        this.input = input;
        this.audio = audio;

        // Create managers
        this.shaderManager = new ShaderManager(this.gl);
        this.renderer = new Renderer(this.gl);
        this.renderer.initGL();

        // Initialize manager classes
        this.sceneManager = new SceneManager();
        this.uiManager = new UIManager(this);
        this.physicsEngine = new PhysicsEngine(this);
        this.blockManager = new BlockManager(this);

        // Game state
        this.state = {
            gameOver: false,
            score: 0,
            health: 100,
            ammo: 30,
            showDebug: false,
            paused: false
        };

        // Initialize game systems
        this.initWebGL();
        this.createSounds();
        this.buildLevel();
        this.setupPlayer();

        // Backend integration
        this.useBackend = true;
        this.backendAvailable = backendAvailable;

        // Initialize block manager to load saved data after backend is set up
        this.blockManager.initialize();

        // Start game loop
        this.lastTime = performance.now();

        // Create input manager
        this.inputManager = new InputManager(this);

        // Text editor
        this.textEditor = new TextEditor(this);
        this.capturingTextInput = false;
        
        // Auto-save system
        this.autoSaveInterval = 30000; // 30 seconds
        this.lastAutoSave = Date.now();
        this.autoSaveIntervalId = null;

        // this.loop(); // Disabled: App handles the game loop via action_draw
    }

    initWebGL() {
        // Create shader programs using ShaderManager
        this.renderer.addShaderProgram("basic",
            this.shaderManager.createBasicShaders().vertex,
            this.shaderManager.createBasicShaders().fragment);

        // Set up projection matrix using ShaderManager
        this.projectionMatrix = this.shaderManager.createProjectionMatrix(
            this.canvas.width,
            this.canvas.height
        );
    }



    createSounds() {
        // Block placement sound
        this.audio.createSweepSound("placeBlock", {
            startFreq: 400,
            endFreq: 600,
            type: "sine",
            duration: 0.1,
            envelope: {
                attack: 0.01,
                decay: 0.05,
                sustain: 0.5,
                release: 0.04
            }
        });

        // UI click sound
        this.audio.createSweepSound("uiClick", {
            startFreq: 800,
            endFreq: 1000,
            type: "sine",
            duration: 0.08,
            envelope: {
                attack: 0.01,
                decay: 0.03,
                sustain: 0.3,
                release: 0.04
            }
        });

        // Save sound
        this.audio.createComplexSound("save", {
            frequencies: [440, 550, 660],
            types: ["sine", "sine", "sine"],
            mix: [0.4, 0.3, 0.3],
            duration: 0.3,
            envelope: {
                attack: 0.05,
                decay: 0.1,
                sustain: 0.5,
                release: 0.15
            }
        });
    }

    buildLevel() {
        // Create level geometry
        this.level = new Level(this.gl, this.renderer);
    }

    setupPlayer() {
        // Create player using the extracted Player class
        this.player = new Player(this, this.level);
    }


    update() {
        // Calculate delta time
        const currentTime = performance.now();
        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap at 100ms
        this.lastTime = currentTime;
        this.deltaTime = deltaTime;

        // Handle text editor input first (captures input when open)
        if (this.textEditor) {
            this.textEditor.handleInput();
            this.textEditor.update(deltaTime);
        }

        // Don't handle game input if editor is open or cursor is not locked
        if (this.textEditor && this.textEditor.isOpen || !this.inputManager.isCursorLocked()) {
            // If editor is open, ensure raycast is cleared
            if (this.textEditor && this.textEditor.isOpen) {
                this.persistentHighlightPosition = null;
                this.hoveredFace = null;
                this.hoveredBlock = null;
            }
            return;
        }

        // Update player
        this.player.update(this.input, deltaTime);

        // Update UI manager
        this.uiManager.handleInput();

        // Physics/raycast for block interaction
        this.physicsEngine.raycastBlocks();

        // Block placement (left click)
        if (this.input.isLeftMouseButtonJustPressed()) {
            if (this.persistentHighlightPosition) {
                this.blockManager.placeBlock();
            } else {
                // Show shape selector if no target
                this.uiManager.showShapeSelector = true;
                this.uiManager.addMessage("🔧 Select shape first (1-3)");
            }
        }

        // Block editor (right click)
        if (this.input.isRightMouseButtonJustPressed()) {
            this.blockManager.openBlockEditor();
        }

        // Manual save with Action2
        if (this.input.isKeyJustPressed("Action2")) {
            this.blockManager.saveToStorage();
            this.uiManager.addMessage("Progress saved!");
        }

        // Toggle debug with F9
        if (this.input.isKeyJustPressed("ActionDebugToggle")) {
            this.state.showDebug = !this.state.showDebug;
        }

        // Handle export/import keyboard shortcuts
        if (this.input.isKeyPressed('Control') && this.input.isKeyJustPressed('e')) {
            this.exportData();
        }
        if (this.input.isKeyPressed('Control') && this.input.isKeyJustPressed('i')) {
            this.importData();
        }
        // Handle load keyboard shortcut
        if (this.input.isKeyPressed('Control') && this.input.isKeyJustPressed('l')) {
            this.blockManager.loadFromStorage();
            this.uiManager.addMessage("Progress loaded!");
        }

        // Alternative block placement (for testing) - press B key
        if (this.input.isKeyJustPressed('b') && this.inputManager.isCursorLocked()) {
            this.blockManager.placeBlockAtCameraPosition();
        }

        // Delete block (for testing) - press Delete key
        if (this.input.isKeyJustPressed('Delete') && this.inputManager.isCursorLocked() && this.hoveredBlock && !this.hoveredBlock.isFloor) {
            this.blockManager.deleteBlock(this.hoveredBlock.id);
        }
    }


    draw() {
        // Clear the WebGL canvas
        this.renderer.clear();

        // Clear the 2D GUI canvas to remove persistent overlays
        this.guiCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Clear the debug canvas
        this.debugCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Get view matrix from player camera
        const viewMatrix = this.player.getViewMatrix();

        // Draw level
        this.level.draw(this.renderer, viewMatrix, this.projectionMatrix);

        // Draw all scene objects using SceneManager
        this.sceneManager.draw(this.renderer, viewMatrix, this.projectionMatrix);

        // Draw persistent highlight using BlockManager
        this.blockManager.drawHoveredBlockHighlight(this.renderer, viewMatrix, this.projectionMatrix);

        // Draw all blocks from BlockManager
        this.blockManager.getAllBlocks().forEach(block => {
            if (block.model) {
                const modelMatrix = window.Matrix4 ? window.Matrix4.create() : new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
                if (window.Matrix4) {
                    window.Matrix4.translate(modelMatrix, modelMatrix, [block.position.x, block.position.y, block.position.z]);
                } else {
                    modelMatrix[12] = block.position.x;
                    modelMatrix[13] = block.position.y;
                    modelMatrix[14] = block.position.z;
                }
                this.renderer.drawMesh(block.model.geometry, "basic", modelMatrix, viewMatrix, this.projectionMatrix);
            }
        });

        // Draw all UI elements using UIManager
        this.uiManager.draw();
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

}

export { Game };
