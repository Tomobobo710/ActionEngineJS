import { WebGLGeometryBuilder } from './webglGeometryBuilder.js';
import { MemoryBlock } from './memoryBlock.js';
import { MemoryPalaceAPI } from '../api.js';

// Block Manager for handling block placement, deletion, and interactions
export class BlockManager {
    constructor(game) {
        this.game = game;
        this.blocks = new Map();
        this.selectedBlockType = "cube";
        this.placementRange = 50;
        this.blockSize = 5;
        this.blockIdCounter = 0;
    }

    initialize() {
        // Update physics engine with current block size
        this.game.physicsEngine.setBlockSize(this.blockSize);
        // Load saved data
        this.loadFromStorage();
    }

    placeBlock() {
        if (!this.game.inputManager.isCursorLocked()) {
            this.game.uiManager.addMessage("🔒 Click canvas to lock mouse first!");
            return;
        }

        if (!this.game.persistentHighlightPosition) {
            this.game.uiManager.addMessage("🎯 Point at a surface (wall/floor/ceiling)");
            return;
        }

        // Calculate placement position using PhysicsEngine
        const newPos = this.game.physicsEngine.calculatePlacementPosition(
            this.game.persistentHighlightPosition,
            this.game.hoveredFace,
            this.game.hoveredBlock
        );

        // Check if position is already occupied using PhysicsEngine
        if (this.game.physicsEngine.isPositionOccupied(newPos)) {
            this.game.uiManager.addMessage("❌ Position already occupied!");
            return;
        }

        // Create new block
        const block = new MemoryBlock(this.game.gl, newPos.clone(), this.selectedBlockType, this.blockSize, "");
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
            this.game.sceneManager.add(block.model);
        } else {
            console.error('❌ Block model not created!');
        }

        this.game.audio.play("placeBlock");
        this.game.uiManager.addMessage(`✅ Block placed at (${Math.round(newPos.x)}, ${Math.round(newPos.y)}, ${Math.round(newPos.z)})`);

        this.saveToStorage();
    }

    // Alternative block placement method (fallback) - press B key
    placeBlockAtCameraPosition() {
        // Place block 5 units in front of camera
        const distance = 5;
        const cameraPos = this.game.player.position;
        const newPos = cameraPos ?
            (window.Vector3 ?
                new window.Vector3(
                    cameraPos.x + Math.sin(this.game.player.rotation.y) * distance,
                    cameraPos.y,
                    cameraPos.z - Math.cos(this.game.player.rotation.y) * distance
                ) : {
                    x: cameraPos.x + Math.sin(this.game.player.rotation.y) * distance,
                    y: cameraPos.y,
                    z: cameraPos.z - Math.cos(this.game.player.rotation.y) * distance
                }
            ) :
            (window.Vector3 ? new window.Vector3(0, 0, 0) : { x: 0, y: 0, z: 0 });

        // Round to grid
        newPos.x = Math.round(newPos.x);
        newPos.y = Math.round(newPos.y);
        newPos.z = Math.round(newPos.z);

        // Check if position is already occupied using PhysicsEngine
        if (this.game.physicsEngine.isPositionOccupied(newPos)) {
            this.game.uiManager.addMessage("❌ Position already occupied!");
            return;
        }

        // Create new block, passing this.gl and this.blockSize
        const block = new MemoryBlock(this.game.gl, newPos, this.selectedBlockType, this.blockSize, ""); // Pass an empty title
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
            this.game.sceneManager.add(block.model);
        } else {
            console.error('❌ Block model not created for camera position placement!');
        }

        this.game.audio.play("placeBlock");
        this.game.uiManager.addMessage(`✅ Block placed at (${Math.round(newPos.x)}, ${Math.round(newPos.y)}, ${Math.round(newPos.z)})`);

        this.saveToStorage();
    }

    deleteBlock(blockId) {
        const blockToDelete = this.blocks.get(blockId);
        if (blockToDelete) {
            if (blockToDelete.model) {
                this.game.sceneManager.remove(blockToDelete.model); // Remove from 3D scene
            }
            this.blocks.delete(blockId); // Remove from map
            this.saveToStorage(); // Save changes
            this.game.uiManager.addMessage(`🗑️ Block ${blockId} deleted.`);
            this.game.hoveredBlock = null; // Clear hovered block if it was deleted
            this.game.persistentHighlightPosition = null; // Clear highlight
        }
    }

    openBlockEditor() {
        if (!this.game.hoveredBlock || this.game.hoveredBlock.isFloor) {
            this.game.uiManager.addMessage("❌ Point at a block to edit notes!");
            return;
        }

        this.game.textEditor.open(this.game.hoveredBlock);
        this.game.audio.play("uiClick");
    }

    // Method to check if cursor is locked
    isCursorLocked() {
        return this.game.inputManager.isCursorLocked();
    }

    getBlockById(id) {
        return this.blocks.get(id);
    }

    getAllBlocks() {
        return Array.from(this.blocks.values());
    }

    setBlockType(type) {
        this.selectedBlockType = type;
    }

    getBlockType() {
        return this.selectedBlockType;
    }

    getBlockCount() {
        return this.blocks.size;
    }

    clearAllBlocks() {
        this.blocks.forEach(block => {
            if (block.model) {
                this.game.sceneManager.remove(block.model);
            }
        });
        this.blocks.clear();
    }

    async saveToStorage() {
        const data = {
            blocks: Array.from(this.blocks.values()).map(block => block.toJSON()),
            camera: {
                position: {
                    x: this.game.player.position.x,
                    y: this.game.player.position.y,
                    z: this.game.player.position.z
                },
                rotation: {
                    x: this.game.player.rotation.x,
                    y: this.game.player.rotation.y
                }
            },
            selectedBlockType: this.selectedBlockType,
            timestamp: Date.now()
        };

        // Save to backend
        if (this.game.backendAvailable && this.game.useBackend) {
            try {
                await MemoryPalaceAPI.bulkSaveBlocks(data.blocks);
                await MemoryPalaceAPI.saveCameraState(data.camera.position, data.camera.rotation);
                this.game.uiManager.addMessage("💾 Saved to server");
            } catch (error) {
                console.error('❌ Failed to save to backend:', error);
                this.game.uiManager.addMessage("⚠️ Server save failed");
                // Enforce SQLite only - no fallback saving
            }
        } else {
            console.error('❌ Backend not available or not in use. Data not saved.');
            this.game.uiManager.addMessage("⚠️ Backend not available. Data not saved.");
        }
    }

    async loadFromStorage() {
        let data = null;

        // Try loading from backend first
        if (this.game.backendAvailable && this.game.useBackend) {
            try {
                const response = await MemoryPalaceAPI.getAllBlocks();
                const cameraState = await MemoryPalaceAPI.getCameraState();

                data = {
                    blocks: response.blocks,
                    camera: cameraState
                };

                this.game.uiManager.addMessage("📥 Loaded from server");
            } catch (error) {
                console.error('❌ Failed to load from backend:', error);
                this.game.uiManager.addMessage("⚠️ Server load failed or no data found.");
                console.warn('⚠️ Server load failed or no data found.');
            }
        } else {
            this.game.uiManager.addMessage("⚠️ Backend not available or not in use. No data loaded.");
            console.warn('⚠️ Backend not available or not in use. No data loaded.');
        }

        if (!data) {
            console.log('ℹ️ No saved data found');
            return;
        }

        // Clear existing blocks using SceneManager
        this.clearAllBlocks();

        // Load blocks
        if (data.blocks && Array.isArray(data.blocks)) {
            data.blocks.forEach(blockData => {
                // Ensure blockSize and title are passed when creating block from JSON
                const block = MemoryBlock.fromJSON(this.game.gl, blockData);

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

                this.game.sceneManager.add(block.model); // Add to scene objects
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
                if (window.Vector3 && this.game.player.position.set) {
                    this.game.player.position.set(
                        data.camera.position.x,
                        data.camera.position.y,
                        data.camera.position.z
                    );
                } else {
                    this.game.player.position.x = data.camera.position.x;
                    this.game.player.position.y = data.camera.position.y;
                    this.game.player.position.z = data.camera.position.z;
                }
            }
            if (data.camera.rotation) {
                if (window.Vector3 && this.game.player.rotation.set) {
                    this.game.player.rotation.set(
                        data.camera.rotation.x,
                        data.camera.rotation.y,
                        0
                    );
                } else {
                    this.game.player.rotation.x = data.camera.rotation.x;
                    this.game.player.rotation.y = data.camera.rotation.y;
                    this.game.player.rotation.z = 0;
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
        this.game.autoSaveInterval = 30000; // 30 seconds
        this.game.lastAutoSave = Date.now();
        this.game.autoSaveIntervalId = null;
    }

    drawHoveredBlockHighlight(renderer, viewMatrix, projectionMatrix) {
        if (!this.game.persistentHighlightPosition) return;

        // Create model matrix for highlight position at exact hit location
        const modelMatrix = window.Matrix4 ? window.Matrix4.create() : new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        if (window.Matrix4) {
            window.Matrix4.translate(modelMatrix, modelMatrix, [
                this.game.persistentHighlightPosition.x,
                this.game.persistentHighlightPosition.y,
                this.game.persistentHighlightPosition.z
            ]);
        } else {
            // Fallback for when Matrix4 is not available
            modelMatrix[12] = this.game.persistentHighlightPosition.x;
            modelMatrix[13] = this.game.persistentHighlightPosition.y;
            modelMatrix[14] = this.game.persistentHighlightPosition.z;
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
        const builder = new WebGLGeometryBuilder(this.game.gl);
        builder.addBox(-2.5, -2.5, -2.5, 5, 5, 5, [1.0, 1.0, 0.0]); // Yellow highlight
        const highlightMesh = builder.build();

        // Draw with wireframe effect (we'll use the basic shader but with emissive color)
        renderer.drawMesh(highlightMesh, "basic", modelMatrix, viewMatrix, projectionMatrix, [1.0, 1.0, 1.0]);
    }
}