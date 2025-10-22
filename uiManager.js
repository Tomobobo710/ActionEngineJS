/**
 * UIManager - Manages all 2D UI elements and overlays
 * Encapsulates UI rendering, state management, and user interactions
 */
class UIManager {
    constructor(game) {
        this.game = game;
        this.messages = [];
        this.maxMessages = 10;

        // UI state
        this.showShapeSelector = false;
        this.shapeSelectorPosition = { x: 350, y: 200 };
        this.availableShapes = ["cube", "cone", "sphere"];
        this.shapeNames = {
            cube: "Cube",
            cone: "Cone",
            sphere: "Sphere"
        };
    }

    /**
     * Add a message to the UI message queue
     * @param {string} msg - Message to display
     */
    addMessage(msg) {
        this.messages.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
        if (this.messages.length > this.maxMessages) {
            this.messages.pop();
        }
    }

    /**
     * Draw all UI elements
     */
    draw() {
        // Draw crosshair
        this.drawCrosshair();

        // Draw HUD
        this.drawHUD();

        // Draw shape selector if open
        if (this.showShapeSelector && this.game.cursorLocked) {
            this.drawShapeSelector();
        }

        // Draw text editor if open
        if (this.game.textEditor && this.game.textEditor.isOpen) {
            this.game.textEditor.draw(this.game.guiCtx);
        }

        // Draw click-to-start screen if game not started
        if (!this.game.cursorLocked && (!this.game.textEditor || !this.game.textEditor.isOpen)) {
            this.drawClickToStart();
        }

        // Draw debug info if enabled
        if (this.game.state && this.game.state.showDebug) {
            this.drawDebugInfo();
        }
    }

    /**
     * Draw the crosshair
     */
    drawCrosshair() {
        const ctx = this.game.guiCtx;

        if (this.game.cursorLocked && !this.game.textEditor.isOpen) {
            if (this.game.persistentHighlightPosition) {
                // Green crosshair when ready to place
                ctx.strokeStyle = "#00ff00";
                ctx.lineWidth = 3;
                ctx.shadowColor = "#00ff00";
                ctx.shadowBlur = 5;
            } else {
                // Yellow crosshair when locked but no target
                ctx.strokeStyle = "#ffff00";
                ctx.lineWidth = 2;
            }

            ctx.beginPath();
            ctx.moveTo(395, 300);
            ctx.lineTo(405, 300);
            ctx.moveTo(400, 295);
            ctx.lineTo(400, 305);
            ctx.stroke();

            // Reset shadow
            ctx.shadowBlur = 0;
        } else if (!this.game.cursorLocked && !this.game.textEditor.isOpen) {
            // White crosshair when unlocked and editor not open
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.moveTo(395, 300);
            ctx.lineTo(405, 300);
            ctx.moveTo(400, 295);
            ctx.lineTo(400, 305);
            ctx.stroke();
        }
    }

    /**
     * Draw the HUD (Heads-Up Display)
     */
    drawHUD() {
        const ctx = this.game.guiCtx;

        // HUD background panel
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(10, 10, 300, 120);

        ctx.strokeStyle = "#4a4a6e";
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, 300, 120);

        // HUD text
        ctx.fillStyle = "#ffffff";
        ctx.font = "16px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";

        const x = 20;
        let y = 20;
        const lineHeight = 22;

        ctx.fillText(`Position: (${Math.round(this.game.player.position.x)}, ${Math.round(this.game.player.position.y)}, ${Math.round(this.game.player.position.z)})`, x, y);
        y += lineHeight;

        ctx.fillText(`Blocks: ${this.game.blocks.size}`, x, y);
        y += lineHeight;

        ctx.fillStyle = "#00ff00";
        ctx.fillText(`Shape: ${this.shapeNames[this.game.selectedBlockType]}`, x, y);
        y += lineHeight;

        if (this.game.hoveredBlock) {
            ctx.fillStyle = "#ffff00";
            ctx.fillText(`Target: Block (${this.game.hoveredFace})`, x, y);

            if (!this.game.hoveredBlock.isFloor && this.game.hoveredBlock.text) {
                y += lineHeight;
                ctx.fillStyle = "#00ff00";
                ctx.fillText(`Has notes: ${this.game.hoveredBlock.text.length} chars`, x, y);
            }
            if (!this.game.hoveredBlock.isFloor && this.game.hoveredBlock.title) {
                y += lineHeight;
                ctx.fillStyle = "#00ffff";
                ctx.fillText(`Title: ${this.game.hoveredBlock.title}`, x, y);
            }
        }

        // Display raycast hit coordinates if available
        if (this.game.persistentHighlightPosition) {
            y += lineHeight;
            ctx.fillStyle = "#00ffff";
            ctx.fillText(`🎯 Ready: (${Math.round(this.game.persistentHighlightPosition.x)}, ${Math.round(this.game.persistentHighlightPosition.y)}, ${Math.round(this.game.persistentHighlightPosition.z)})`, x, y);

            if (this.game.hoveredFace) {
                y += lineHeight;
                ctx.fillStyle = "#ffff00";
                ctx.fillText(`📍 Face: ${this.game.hoveredFace} - Click to place!`, x, y);
            }
        } else {
            // Show that raycast is running but no hits found
            y += lineHeight;
            ctx.fillStyle = "#ff00ff";
            ctx.fillText(`❌ Point at wall/floor/ceiling`, x, y);
        }

        // Show cursor lock status
        y += lineHeight;
        ctx.fillStyle = this.game.cursorLocked ? "#00ff00" : "#ff0000";
        ctx.fillText(`🔒 Mouse: ${this.game.cursorLocked ? 'Locked' : 'Unlocked (click canvas)'}`, x, y);

        // Controls reminder (bottom right)
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(490, 450, 300, 140);

        ctx.strokeStyle = "#4a4a6e";
        ctx.lineWidth = 2;
        ctx.strokeRect(490, 450, 300, 140);

        ctx.fillStyle = "#aaaaaa";
        ctx.font = "14px Arial";
        ctx.textAlign = "left";

        y = 460;
        ctx.fillText("WASD: Move", 500, y); y += 20;
        ctx.fillText("Mouse: Look", 500, y); y += 20;
        ctx.fillText("Double-Space: Toggle Flying", 500, y); y += 20;
        ctx.fillText("E/Q: Up/Down (when flying)", 500, y); y += 20;
        ctx.fillText("C: Toggle Mouse Lock", 500, y); y += 20;
        ctx.fillText("Left Click: Place Block", 500, y); y += 20;
        ctx.fillText("Right Click: Edit Notes", 500, y); y += 20;
        ctx.fillText("Delete Key: Delete Hovered Block", 500, y); y += 20;
        ctx.fillText("B: Place Block (Camera)", 500, y); y += 20;
        ctx.fillText("Action2: Manual Save", 500, y); y += 20;
        ctx.fillText("F9: Toggle Debug", 500, y);
        y += 20;
        ctx.fillText("Z: Select Shape", 500, y);
    }

    /**
     * Draw the click-to-start screen
     */
    drawClickToStart() {
        const ctx = this.game.guiCtx;

        // Semi-transparent overlay
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(0, 0, 800, 600);

        // Title
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 48px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Memory Palace 3D", 400, 200);

        // Subtitle
        ctx.font = "24px Arial";
        ctx.fillStyle = "#aaaaaa";
        ctx.fillText("Method of Loci Environment", 400, 250);

        // Instructions
        ctx.font = "20px Arial";
        ctx.fillStyle = "#ffffff";
        ctx.fillText("Click to lock mouse and begin", 400, 350);

        // Feature list
        ctx.font = "16px Arial";
        ctx.fillStyle = "#888888";
        ctx.textAlign = "left";

        const features = [
            "• Navigate a large 3D space",
            "• Place blocks to create structures",
            "• Attach detailed notes to any block",
            "• Auto-save to browser storage",
            "• Build your personal memory palace"
        ];

        let y = 420;
        features.forEach(feature => {
            ctx.fillText(feature, 250, y);
            y += 25;
        });
    }

    /**
     * Draw the shape selector interface
     */
    drawShapeSelector() {
        const ctx = this.game.guiCtx;
        const selectorWidth = 400;
        const selectorHeight = 200;
        const x = this.shapeSelectorPosition.x;
        const y = this.shapeSelectorPosition.y;

        // Semi-transparent backdrop
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(x - 20, y - 20, selectorWidth + 40, selectorHeight + 40);

        // Selector window background
        ctx.fillStyle = "#2a2a3e";
        ctx.fillRect(x, y, selectorWidth, selectorHeight);

        // Border
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, selectorWidth, selectorHeight);

        // Title
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Select Block Shape", x + selectorWidth / 2, y + 30);

        // Shape options
        ctx.font = "16px Arial";
        ctx.textAlign = "left";

        for (let i = 0; i < this.availableShapes.length; i++) {
            const shapeKey = this.availableShapes[i];
            const shapeName = this.shapeNames[shapeKey];
            const optionY = y + 60 + (i * 35);
            const isSelected = this.game.selectedBlockType === shapeKey;

            // Highlight selected shape
            if (isSelected) {
                ctx.fillStyle = "#00ffff";
                ctx.fillRect(x + 20, optionY - 5, selectorWidth - 40, 30);
            }

            // Shape name
            ctx.fillStyle = isSelected ? "#000000" : "#ffffff";
            ctx.fillText(`${i + 1}. ${shapeName}`, x + 30, optionY + 15);

            // Shape preview (simple icons)
            ctx.fillStyle = "#888888";
            switch (shapeKey) {
                case "cube":
                    ctx.fillRect(x + selectorWidth - 60, optionY, 20, 20);
                    break;
                case "cone":
                    ctx.beginPath();
                    ctx.moveTo(x + selectorWidth - 50, optionY + 20);
                    ctx.lineTo(x + selectorWidth - 60, optionY);
                    ctx.lineTo(x + selectorWidth - 40, optionY);
                    ctx.closePath();
                    ctx.fill();
                    break;
                case "sphere":
                    ctx.beginPath();
                    ctx.arc(x + selectorWidth - 50, optionY + 10, 10, 0, Math.PI * 2);
                    ctx.fill();
                    break;
            }
        }

        // Instructions
        ctx.fillStyle = "#aaaaaa";
        ctx.font = "14px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Press 1-3 to select shape, Z to close", x + selectorWidth / 2, y + selectorHeight - 20);
    }

    /**
     * Draw debug information overlay
     */
    drawDebugInfo() {
        this.game.debugCtx.clearRect(0, 0, 800, 600);

        this.game.debugCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
        this.game.debugCtx.fillRect(0, 0, 200, 120);

        this.game.debugCtx.fillStyle = "#fff";
        this.game.debugCtx.font = "12px monospace";
        this.game.debugCtx.textAlign = "left";

        const pos = this.game.player.position;
        const rot = this.game.player.rotation;

        this.game.debugCtx.fillText(`FPS: ${Math.round(1 / this.game.deltaTime || 60)}`, 10, 20);
        this.game.debugCtx.fillText(`Position: ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`, 10, 40);
        this.game.debugCtx.fillText(
            `Rotation: ${((rot.x * 180) / Math.PI).toFixed(1)}°, ${((rot.y * 180) / Math.PI).toFixed(1)}°`,
            10,
            60
        );
        this.game.debugCtx.fillText(
            `Blocks: ${this.game.blocks.size}`,
            10,
            80
        );

        // Display raycast hit coordinates in debug panel too
        if (this.game.persistentHighlightPosition) {
            this.game.debugCtx.fillText(
                `Raycast Hit: ${this.game.persistentHighlightPosition.x.toFixed(2)}, ${this.game.persistentHighlightPosition.y.toFixed(2)}, ${this.game.persistentHighlightPosition.z.toFixed(2)}`,
                10,
                100
            );
        }
    }

    /**
     * Handle UI input (button clicks, etc.)
     */
    handleInput() {
        // Handle shape selection (Z key)
        if (this.game.input.isKeyJustPressed('ActionShapeSelect') && this.game.cursorLocked) {
            this.showShapeSelector = !this.showShapeSelector;
            if (this.showShapeSelector) {
                this.addMessage("🔧 Shape selector opened");
            } else {
                this.addMessage("🔧 Shape selector closed");
            }
        }

        // Shape selection with number keys
        if (this.showShapeSelector && this.game.cursorLocked) {
            for (let i = 0; i < this.availableShapes.length; i++) {
                if (this.game.input.isKeyJustPressed(String(i + 1))) {
                    this.game.selectedBlockType = this.availableShapes[i];
                    this.showShapeSelector = false;
                    this.addMessage(`✅ Selected: ${this.shapeNames[this.game.selectedBlockType]}`);
                }
            }
        }
    }

    /**
     * Update UI state
     * @param {number} deltaTime - Time since last frame
     */
    update(deltaTime) {
        // Update any animated UI elements here if needed
        // Currently no animations, but placeholder for future use
    }

    /**
     * Get the currently selected block type
     * @returns {string} Selected block type
     */
    getSelectedBlockType() {
        return this.game.selectedBlockType;
    }

    /**
     * Set the selected block type
     * @param {string} type - Block type to select
     */
    setSelectedBlockType(type) {
        if (this.availableShapes.includes(type)) {
            this.game.selectedBlockType = type;
        }
    }
}

export { UIManager };