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

        // Create renderer
        this.renderer = new Renderer(this.gl);
        this.renderer.initGL();

        // Initialize manager classes
        this.sceneManager = new SceneManager();
        this.uiManager = new UIManager(this);
        this.physicsEngine = new PhysicsEngine(this);

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

        this.createBlocks();

        // Start game loop
        this.lastTime = performance.now();

        // Add cursor lock support
        this.cursorLocked = false;
        this.mouseDeltaX = 0;
        this.mouseDeltaY = 0;

        // Set up pointer lock event listeners
        document.addEventListener("keydown", (e) => {
            if (e.code === "KeyC") {
                this.toggleCursorLock();
            }
        });

        document.addEventListener("pointerlockchange", () => {
            this.handlePointerLockChange();
        });

        document.addEventListener("click", (e) => {
            if (e.target === this.canvas && !this.cursorLocked) {
                this.toggleCursorLock();
            }
        });

        document.addEventListener("mousemove", (e) => {
            if (this.cursorLocked) {
                this.mouseDeltaX = e.movementX || 0;
                this.mouseDeltaY = e.movementY || 0;
            } else {
                this.mouseDeltaX = 0;
                this.mouseDeltaY = 0;
            }
        });

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
        // Create shader programs
        this.renderer.addShaderProgram("basic", this.basicVertexShader(), this.basicFragmentShader());

        // Set up projection matrix
        this.projectionMatrix = window.Matrix4 ? window.Matrix4.create() : new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        window.Matrix4.perspective(
            this.projectionMatrix,
            (60 * Math.PI) / 180, // 60 degrees FOV
            this.canvas.width / this.canvas.height,
            0.1,
            1000.0
        );
    }

    toggleCursorLock(forceLock = undefined) {
        if (forceLock === true) {
            if (!this.cursorLocked) {
                this.canvas.requestPointerLock();
                console.log('🔒 Requesting pointer lock (forced)...');
            }
        } else if (forceLock === false) {
            if (this.cursorLocked) {
                document.exitPointerLock();
                console.log('🔓 Exiting pointer lock (forced)...');
            }
        } else {
            // Toggle behavior
            if (!this.cursorLocked) {
                this.canvas.requestPointerLock();
                console.log('🔒 Requesting pointer lock...');
            } else {
                document.exitPointerLock();
                console.log('🔓 Exiting pointer lock...');
            }
        }
    }

    // Enhanced mouse lock handling
    handlePointerLockChange() {
        const isLocked = document.pointerLockElement === this.canvas;
        this.cursorLocked = isLocked;

        if (isLocked) {
            console.log('✅ Pointer lock acquired');
            this.uiManager.addMessage("🔒 Mouse locked - ready to place blocks!");
        } else {
            console.log('❌ Pointer lock lost');
            this.uiManager.addMessage("🔓 Mouse unlocked - click canvas to continue");
        }
    }

    basicVertexShader() {
        return `
            attribute vec4 aVertexPosition;
            attribute vec3 aVertexNormal;
            attribute vec3 aVertexColor;

            uniform mat4 uModelMatrix;
            uniform mat4 uViewMatrix;
            uniform mat4 uProjectionMatrix;

            varying vec3 vNormal;
            varying vec3 vColor;

            void main() {
                gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * aVertexPosition;
                vNormal = mat3(uModelMatrix) * aVertexNormal;
                vColor = aVertexColor;
            }
        `;
    }

    basicFragmentShader() {
        return `
            precision mediump float;

            varying vec3 vNormal;
            varying vec3 vColor;

            uniform vec3 uLightDirection;

            void main() {
                vec3 normal = normalize(vNormal);
                float light = max(dot(normal, normalize(uLightDirection)), 0.0);
                vec3 ambient = vColor * 0.3;
                vec3 diffuse = vColor * light * 0.7;
                gl_FragColor = vec4(ambient + diffuse, 1.0);
            }
        `;
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
        this.player = new Player(this, this.level);

        // Initialize at starting position
        this.player.position = new Vector3(5, 1.8, 5);
        this.player.velocity = new Vector3(0, 0, 0);
    }

    createBlocks() {
        this.blocks = new Map();
        this.selectedBlockType = "cube";
        this.placementRange = 50;
        this.blockSize = 5;

        // Update physics engine with current block size
        this.physicsEngine.setBlockSize(this.blockSize);

        // Load saved data
        this.loadFromStorage();
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
        if (this.textEditor && this.textEditor.isOpen || !this.cursorLocked) {
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
                this.placeBlock();
            } else {
                // Show shape selector if no target
                this.uiManager.showShapeSelector = true;
                this.uiManager.addMessage("🔧 Select shape first (1-3)");
            }
        }

        // Block editor (right click)
        if (this.input.isRightMouseButtonJustPressed()) {
            this.openBlockEditor();
        }

        // Manual save with Action2
        if (this.input.isKeyJustPressed("Action2")) {
            this.saveToStorage();
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

        // Alternative block placement (for testing) - press B key
        if (this.input.isKeyJustPressed('b') && this.cursorLocked) {
            this.placeBlockAtCameraPosition();
        }

        // Delete block (for testing) - press Delete key
        if (this.input.isKeyJustPressed('Delete') && this.cursorLocked && this.hoveredBlock && !this.hoveredBlock.isFloor) {
            this.deleteBlock(this.hoveredBlock.id);
        }
    }

    deleteBlock(blockId) {
        const blockToDelete = this.blocks.get(blockId);
        if (blockToDelete) {
            if (blockToDelete.model) {
                this.sceneManager.remove(blockToDelete.model); // Remove from 3D scene
            }
            this.blocks.delete(blockId); // Remove from map
            this.saveToStorage(); // Save changes
            this.uiManager.addMessage(`🗑️ Block ${blockId} deleted.`);
            this.hoveredBlock = null; // Clear hovered block if it was deleted
            this.persistentHighlightPosition = null; // Clear highlight
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

        // Draw persistent highlight - always visible if we have a stored position
        if (this.persistentHighlightPosition) {
            this.drawHoveredBlockHighlight(this.renderer, viewMatrix, this.projectionMatrix);
        }

        // Draw all UI elements using UIManager
        this.uiManager.draw();
    }





    placeBlock() {
        if (!this.cursorLocked) {
            this.uiManager.addMessage("🔒 Click canvas to lock mouse first!");
            return;
        }

        if (!this.persistentHighlightPosition) {
            this.uiManager.addMessage("🎯 Point at a surface (wall/floor/ceiling)");
            return;
        }

        // Calculate placement position using PhysicsEngine
        const newPos = this.physicsEngine.calculatePlacementPosition(
            this.persistentHighlightPosition,
            this.hoveredFace,
            this.hoveredBlock
        );

        // Check if position is already occupied using PhysicsEngine
        if (this.physicsEngine.isPositionOccupied(newPos)) {
            this.uiManager.addMessage("❌ Position already occupied!");
            return;
        }

        // Create new block
        const block = new MemoryBlock(this.gl, newPos.clone(), this.selectedBlockType, this.blockSize, "");
        this.blocks.set(block.id, block);

        // Ensure block is visible in 3D scene using SceneManager
        if (block.model) {
            if (window.Vector3 && block.model.position.set) {
                block.model.position.set(newPos.x, newPos.y, newPos.z);
            } else {
                block.model.position.x = newPos.x;
                block.model.position.y = newPos.y;
                block.model.position.z = newPos.z;
            }
            this.sceneManager.add(block.model);
        } else {
            console.error('❌ Block model not created!');
        }

        this.audio.play("placeBlock");
        this.uiManager.addMessage(`✅ Block placed at (${Math.round(newPos.x)}, ${Math.round(newPos.y)}, ${Math.round(newPos.z)})`);

        this.saveToStorage();
    }

    // Alternative block placement method (fallback) - press B key
    placeBlockAtCameraPosition() {
        // Place block 5 units in front of camera
        const distance = 5;
        const cameraPos = this.player.position;
        const newPos = cameraPos ?
            (window.Vector3 ?
                new window.Vector3(
                    cameraPos.x + Math.sin(this.player.rotation.y) * distance,
                    cameraPos.y,
                    cameraPos.z - Math.cos(this.player.rotation.y) * distance
                ) : {
                    x: cameraPos.x + Math.sin(this.player.rotation.y) * distance,
                    y: cameraPos.y,
                    z: cameraPos.z - Math.cos(this.player.rotation.y) * distance
                }
            ) :
            (window.Vector3 ? new window.Vector3(0, 0, 0) : { x: 0, y: 0, z: 0 });

        // Round to grid
        newPos.x = Math.round(newPos.x);
        newPos.y = Math.round(newPos.y);
        newPos.z = Math.round(newPos.z);

        // Check if position is already occupied using PhysicsEngine
        if (this.physicsEngine.isPositionOccupied(newPos)) {
            this.uiManager.addMessage("❌ Position already occupied!");
            return;
        }

        // Create new block, passing this.gl and this.blockSize
        const block = new MemoryBlock(this.gl, newPos, this.selectedBlockType, this.blockSize, ""); // Pass an empty title
        this.blocks.set(block.id, block);

        // Ensure block is visible in 3D scene using SceneManager
        if (block.model) {
            block.model.setColor(0.0, 1.0, 0.0); // Bright green for high visibility
            if (window.Vector3 && block.model.position.set) {
                block.model.position.set(newPos.x, newPos.y, newPos.z);
            } else {
                block.model.position.x = newPos.x;
                block.model.position.y = newPos.y;
                block.model.position.z = newPos.z;
            }
            this.sceneManager.add(block.model);
        } else {
            console.error('❌ Block model not created for camera position placement!');
        }

        this.audio.play("placeBlock");
        this.uiManager.addMessage(`✅ Block placed at (${Math.round(newPos.x)}, ${Math.round(newPos.y)}, ${Math.round(newPos.z)})`);

        this.saveToStorage();
    }

    openBlockEditor() {
        if (!this.hoveredBlock || this.hoveredBlock.isFloor) {
            this.uiManager.addMessage("❌ Point at a block to edit notes!");
            return;
        }

        this.textEditor.open(this.hoveredBlock);
        this.audio.play("uiClick");
    }

    drawHoveredBlockHighlight(renderer, viewMatrix, projectionMatrix) {
        if (!this.persistentHighlightPosition) return;

        // Create model matrix for highlight position at exact hit location
        const modelMatrix = window.Matrix4 ? window.Matrix4.create() : new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        if (window.Matrix4) {
            window.Matrix4.translate(modelMatrix, modelMatrix, [
                this.persistentHighlightPosition.x,
                this.persistentHighlightPosition.y,
                this.persistentHighlightPosition.z
            ]);
        } else {
            // Fallback for when Matrix4 is not available
            modelMatrix[12] = this.persistentHighlightPosition.x;
            modelMatrix[13] = this.persistentHighlightPosition.y;
            modelMatrix[14] = this.persistentHighlightPosition.z;
        }

        // Scale up slightly for highlight effect
        if (window.Matrix4) {
            window.Matrix4.scale(modelMatrix, modelMatrix, [1.1, 1.1, 1.1]);
        } else {
            // Fallback scaling for when Matrix4 is not available
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    modelMatrix[i * 4 + j] *= 1.1;
                }
            }
        }

        // Create highlight geometry (wireframe cube)
        const builder = new WebGLGeometryBuilder(this.gl);
        builder.addBox(-2.5, -2.5, -2.5, 5, 5, 5, [1.0, 1.0, 0.0]); // Yellow highlight
        const highlightMesh = builder.build();

        // Draw with wireframe effect (we'll use the basic shader but with emissive color)
        renderer.drawMesh(highlightMesh, "basic", modelMatrix, viewMatrix, projectionMatrix, [1.0, 1.0, 1.0]);
    }

    async saveToStorage() {
        const data = {
            blocks: Array.from(this.blocks.values()).map(block => block.toJSON()),
            camera: {
                position: {
                    x: this.player.position.x,
                    y: this.player.position.y,
                    z: this.player.position.z
                },
                rotation: {
                    x: this.player.rotation.x,
                    y: this.player.rotation.y
                }
            },
            selectedBlockType: this.selectedBlockType,
            timestamp: Date.now()
        };

        // Save to backend
        if (this.backendAvailable && this.useBackend) {
            try {
                await MemoryPalaceAPI.bulkSaveBlocks(data.blocks);
                await MemoryPalaceAPI.saveCameraState(data.camera.position, data.camera.rotation);
                this.uiManager.addMessage("💾 Saved to server");
            } catch (error) {
                console.error('❌ Failed to save to backend:', error);
                this.uiManager.addMessage("⚠️ Server save failed");
                // Enforce SQLite only - no fallback saving
            }
        } else {
            console.error('❌ Backend not available or not in use. Data not saved.');
            this.uiManager.addMessage("⚠️ Backend not available. Data not saved.");
        }
    }

    async loadFromStorage() {
        let data = null;

        // Try loading from backend first
        if (this.backendAvailable && this.useBackend) {
            try {
                const response = await MemoryPalaceAPI.getAllBlocks();
                const cameraState = await MemoryPalaceAPI.getCameraState();

                data = {
                    blocks: response.blocks,
                    camera: cameraState
                };

                this.uiManager.addMessage("📥 Loaded from server");
            } catch (error) {
                console.error('❌ Failed to load from backend:', error);
                this.uiManager.addMessage("⚠️ Server load failed or no data found.");
                console.warn('⚠️ Server load failed or no data found.');
            }
        } else {
            this.uiManager.addMessage("⚠️ Backend not available or not in use. No data loaded.");
            console.warn('⚠️ Backend not available or not in use. No data loaded.');
        }

        if (!data) {
            console.log('ℹ️ No saved data found');
            return;
        }

        // Clear existing blocks using SceneManager
        this.blocks.forEach(block => {
            if (block.model) {
                this.sceneManager.remove(block.model);
            }
        });
        this.blocks.clear();

        // Load blocks
        if (data.blocks && Array.isArray(data.blocks)) {
            data.blocks.forEach(blockData => {
                // Ensure blockSize and title are passed when creating block from JSON
                const block = MemoryBlock.fromJSON(this.gl, blockData);
                
                // Set position on the model from fromJSON
                if (block.model) {
                    if (window.Vector3 && block.model.position.copy) {
                        block.model.position.copy(block.position);
                    } else {
                        block.model.position.x = block.position.x;
                        block.model.position.y = block.position.y;
                        block.model.position.z = block.position.z;
                    }
                }
                
                this.sceneManager.add(block.model); // Add to scene objects
                this.blocks.set(block.id, block);
            });

            // Update block ID counter
            const maxId = Math.max(
                0,
                ...Array.from(this.blocks.keys())
                    .map(id => parseInt(id.replace('block_', '')) || 0)
            );
            this.blockIdCounter = maxId + 1;

            console.log(`✅ Loaded ${this.blocks.size} blocks`);
        }

        // Load camera position
        if (data.camera) {
            if (data.camera.position) {
                if (window.Vector3 && this.player.position.set) {
                    this.player.position.set(
                        data.camera.position.x,
                        data.camera.position.y,
                        data.camera.position.z
                    );
                } else {
                    this.player.position.x = data.camera.position.x;
                    this.player.position.y = data.camera.position.y;
                    this.player.position.z = data.camera.position.z;
                }
            }
            if (data.camera.rotation) {
                if (window.Vector3 && this.player.rotation.set) {
                    this.player.rotation.set(
                        data.camera.rotation.x,
                        data.camera.rotation.y,
                        0
                    );
                } else {
                    this.player.rotation.x = data.camera.rotation.x;
                    this.player.rotation.y = data.camera.rotation.y;
                    this.player.rotation.z = 0;
                }
            }
            console.log('✅ Camera position restored');
        }

        // Load selected block type
        if (data.selectedBlockType) {
            this.selectedBlockType = data.selectedBlockType;
        } else {
            this.selectedBlockType = "cube"; // Default to cube if not saved
        }

        // Initialize auto-save system after game is fully loaded
        this.autoSaveInterval = 30000; // 30 seconds
        this.lastAutoSave = Date.now();
        this.autoSaveIntervalId = null;
    }





    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

}

export { Game };
