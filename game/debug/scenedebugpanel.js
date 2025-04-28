// game/debug/scenedebugpanel.js
class SceneDebugPanel {
    constructor(debugCanvas, game) {
        this.canvas = debugCanvas;
        this.ctx = debugCanvas.getContext("2d");
        this.game = game;
        
        // Configuration for number formatting
        this.roundingConfig = {
            defaultPrecision: 2,  // Default decimal places
            fpsPrecision: 1,     // FPS decimal places
            positionPrecision: 2, // Position decimal places
            anglePrecision: 4,    // Normal/angle decimal places
            timePrecision: 1      // Time/ms decimal places
        };
    }
    
    roundTo(num, decimals = this.roundingConfig.defaultPrecision) {
        const multiplier = Math.pow(10, decimals);
        return Math.round(num * multiplier) / multiplier;
    }
    
    formatVector(vec) {
        return `${this.roundTo(vec.x || 0, this.roundingConfig.positionPrecision)},${this.roundTo(vec.y || 0, this.roundingConfig.positionPrecision)},${this.roundTo(vec.z || 0, this.roundingConfig.positionPrecision)}`;
    }
    
    draw() {
        const padding = 10;
        const lineHeight = 16;
        const startX = this.canvas.width - 200;
        let currentY = padding;
        
        // Background
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        this.ctx.fillRect(startX - padding, 0, 220, 560);
        
        // Save context state before drawing text
        this.ctx.save();
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "11px monospace";
        this.ctx.textAlign = "left";
        
        // Define helper functions
        const addLine = (label, value) => {
            if (value === undefined || value === null) {
                value = "N/A";
            }
            this.ctx.fillText(`${label}: ${value}`, startX, currentY);
            currentY += lineHeight;
        };
        
        const addVector = (label, vector) => {
            addLine(
                label,
                `${this.roundTo(vector.x, this.roundingConfig.positionPrecision)}, ${this.roundTo(vector.y, this.roundingConfig.positionPrecision)}, ${this.roundTo(vector.z, this.roundingConfig.positionPrecision)}`
            );
        };
        
        // Performance metrics
        this.ctx.fillStyle = "#00ff00";
        addLine("Use 2D Renderer", this.game.use2DRenderer ? "Enabled" : "Disabled");
        this.ctx.fillStyle = "#ffffff";
        addLine("FPS", this.roundTo(this.game.debugPanel ? this.game.debugPanel.getFPS() : 0, this.roundingConfig.fpsPrecision));
        addLine("Delta Time", this.roundTo(this.game.deltaTime * 1000, this.roundingConfig.timePrecision) + "ms");
        
        // Get the character's debug info
        const characterDebug = this.game.character.getDebugInfo();
        if (characterDebug) {
            this.ctx.fillStyle = "#00ff00";
            addLine("State", "");
            this.ctx.fillStyle = "#ffffff";
            addLine("Current State", characterDebug.state.current);
            if (characterDebug.state.lastTransition) {
                addLine("Last State", characterDebug.state.lastTransition.from || "None");
                const timeSinceTransition = Date.now() - characterDebug.state.lastTransition.time;
                addLine("Time In State", Math.round(timeSinceTransition) + "ms");
            }
            
            // Physics info section
            this.ctx.fillStyle = "#00ff00";
            addLine("Physics", "");
            this.ctx.fillStyle = "#ffffff";
            
            // Position
            addVector("Position", characterDebug.physics.position);
            addVector("Velocity", characterDebug.physics.velocity);
            
            // Movement info section
            this.ctx.fillStyle = "#ffffff";
            if (characterDebug.movement.input_direction) {
                addVector("Raw Input", characterDebug.movement.input_direction);
            }
            addVector("Raw Move", characterDebug.movement.raw_move);
            addVector("Projected Move", characterDebug.movement.projected_move);
            if (characterDebug.movement.applied_force) {
                addVector("Applied Force", characterDebug.movement.applied_force);
            }
            
            // Spring info section
            this.ctx.fillStyle = "#00ff00";
            addLine("Ground Spring", "");
            this.ctx.fillStyle = "#ffffff";
            addLine("Hit Distance", characterDebug.spring.hit_distance);
            addLine("Height Error", characterDebug.spring.height_error);
            addLine("Spring Force", characterDebug.spring.spring_force);
            
            // Contact info section
            this.ctx.fillStyle = "#00ff00";
            addLine("Contact", "");
            this.ctx.fillStyle = "#ffffff";
            addVector("Normal", characterDebug.contact.normal);
            
            // Safe check for hit data
            if (characterDebug.contact.hit && characterDebug.contact.hit.point) {
                addVector("Hit Point", characterDebug.contact.hit.point);
                if (characterDebug.contact.hit.normal) {
                    addVector("Hit Normal", characterDebug.contact.hit.normal);
                }
                if (
                    characterDebug.contact.hit.distance !== null &&
                    characterDebug.contact.hit.distance !== undefined
                ) {
                    addLine("Hit Distance", characterDebug.contact.hit.distance);
                }
            }
        }
        
        // Camera metrics
        this.ctx.fillStyle = "#00ff00";
        addLine("Camera", "");
        this.ctx.fillStyle = "#ffffff";
        addLine("Camera Mode", this.game.character.camera.isDetached ? "Detached" : "Following");
        
        // Height info with percentage
        const terrainHeight = this.game.terrain.getHeightAt(
            this.game.character.position.x,
            this.game.character.position.z
        );
        const maxHeight = this.game.terrain.generator.getBaseWorldHeight();
        const heightPercent = Math.round((terrainHeight / maxHeight) * 100);
        addLine("Ground Height", `${this.roundTo(terrainHeight, this.roundingConfig.positionPrecision)} (${this.roundTo(heightPercent, this.roundingConfig.fpsPrecision)}%)`);
        
        addVector("Cam Pos", {
            x: this.roundTo(this.game.camera.position.x, this.roundingConfig.positionPrecision),
            y: this.roundTo(this.game.camera.position.y, this.roundingConfig.positionPrecision),
            z: this.roundTo(this.game.camera.position.z, this.roundingConfig.positionPrecision)
        });
        
        addVector("Cam Target", {
            x: this.roundTo(this.game.camera.target.x, this.roundingConfig.positionPrecision),
            y: this.roundTo(this.game.camera.target.y, this.roundingConfig.positionPrecision),
            z: this.roundTo(this.game.camera.target.z, this.roundingConfig.positionPrecision)
        });
        
        // Camera angles and distance
        const dx = this.game.camera.position.x - this.game.camera.target.x;
        const dy = this.game.camera.position.y - this.game.camera.target.y;
        const dz = this.game.camera.position.z - this.game.camera.target.z;
        const camDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const camHeight = this.game.camera.position.y - this.game.character.position.y;
        
        addLine("Cam Distance", this.roundTo(camDist, this.roundingConfig.positionPrecision));
        addLine("Cam Height", this.roundTo(camHeight, this.roundingConfig.positionPrecision));
        addLine("Camera Mode", this.game.character.camera.isDetached ? "Detached" : "Following");
        
        // Triangle info
        this.ctx.fillStyle = "#00ff00";
        addLine("Current Triangle", "");
        this.ctx.fillStyle = "#ffffff";
        
        const triangle = this.game.character.getCurrentTriangle();
        if (triangle) {
            addLine("Min Height", this.roundTo(triangle.minY, this.roundingConfig.positionPrecision));
            addLine("Max Height", this.roundTo(triangle.maxY, this.roundingConfig.positionPrecision));
            addLine("Avg Height", this.roundTo(triangle.avgY, this.roundingConfig.positionPrecision));
            addLine(
                "Normal",
                `${this.roundTo(triangle.normal.x, this.roundingConfig.anglePrecision)}, ${this.roundTo(triangle.normal.y, this.roundingConfig.anglePrecision)}, ${this.roundTo(triangle.normal.z, this.roundingConfig.anglePrecision)}`
            );
            addLine("Vertex Indices", triangle.indices.join(", "));
            addLine("Biome", triangle.biome);
        } else {
            addLine("Triangle", "None found");
        }
        
        // Restore context state
        this.ctx.restore();
    }
}