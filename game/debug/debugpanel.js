// game/debug/debugpanel.js
class DebugPanel {
    constructor(debugCanvas, game) {
        this.canvas = debugCanvas;
        this.ctx = debugCanvas.getContext("2d");
        this.game = game;
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.currentFPS = 0;
        
        // Add reference to check if the lighting panel is visible
        this.lightingPanelVisible = false;

        this.weatherButtons = [
            { id: "stopWeather", text: "Stop", color: "#ff4444" },
            { id: "rain", text: "Rain", color: "#4444ff" },
            { id: "heavyRain", text: "Heavy Rain", color: "#2222ff" },
            { id: "snow", text: "Snow", color: "#cccccc" },
            { id: "wind", text: "Wind", color: "#88ccff" },
            { id: "hurricane", text: "Hurricane", color: "#2244ff" },
            { id: "poison", text: "Poison", color: "#44ff44" },
            { id: "fire", text: "Fire", color: "#ff8844" }
        ];

        // Register all weather buttons with input system
        this.weatherButtons.forEach((button, index) => {
            this.game.input.registerElement(
                button.id,
                {
                    bounds: () => ({
                        x: 20,
                        y: index * 60 + 20,
                        width: 180,
                        height: 50
                    })
                },
                "debug"
            );
        });

        // Add weather debug toggle state
        this.showWeatherDebug = false;

        // Add toggle button properties
        this.weatherToggleButton = {
            x: (this.canvas.width - 120) / 2, // Center horizontally
            y: 10, // Top of screen with small padding
            width: 120,
            height: 30,
            text: "Weather Debug",
            color: "#444444",
            hovered: false
        };

        // Register the toggle button with input system
        this.game.input.registerElement(
            "weatherDebugToggle",
            {
                bounds: () => ({
                    x: this.weatherToggleButton.x,
                    y: this.weatherToggleButton.y,
                    width: this.weatherToggleButton.width,
                    height: this.weatherToggleButton.height
                })
            },
            "debug"
        );




    }

    // Add method to draw the toggle button
    drawWeatherToggleButton() {
        this.ctx.save();

        // Update hover state
        this.weatherToggleButton.hovered = this.game.input.isElementHovered("weatherDebugToggle", "debug");

        // Change base color based on active panel
        let baseColor = this.showWeatherDebug ? "#f00038" : "#666666"; // Cyan when weather panel active
        let hoverColor = this.showWeatherDebug ? "rgba(136, 136, 136, 0.75)" : "rgba(136, 136, 136, 0.75)"; // Lighter version when hovered

        // Draw button background
        this.ctx.fillStyle = this.weatherToggleButton.hovered ? hoverColor : baseColor;
        this.ctx.fillRect(
            this.weatherToggleButton.x,
            this.weatherToggleButton.y,
            this.weatherToggleButton.width,
            this.weatherToggleButton.height
        );

        // Draw button text
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "14px monospace";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(
            this.weatherToggleButton.text,
            this.weatherToggleButton.x + this.weatherToggleButton.width / 2,
            this.weatherToggleButton.y + this.weatherToggleButton.height / 2
        );

        this.ctx.restore();
    }

    drawWeatherPanel() {
        // Draw semi-transparent black background
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        this.ctx.fillRect(10, 10, 200, this.weatherButtons.length * 60 + 10);

        // Draw weather buttons
        this.weatherButtons.forEach((button, index) => {
            const y = index * 60 + 20;
            const isHovered = this.game.input.isElementHovered(button.id, "weather");
            const isPressed = this.game.input.isElementPressed(button.id, "weather");
            const isActive = this.game.weatherState?.current === button.id;

            // Draw button background
            let buttonColor = button.color;
            if (isPressed) buttonColor = this.darkenColor(button.color);
            else if (isHovered) buttonColor = this.lightenColor(button.color);
            this.ctx.fillStyle = buttonColor;

            this.ctx.beginPath();
            this.ctx.roundRect(20, y, 180, 50, 8);
            this.ctx.fill();

            if (isActive) {
                this.ctx.strokeStyle = "#ffffff";
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }

            // Draw button text
            this.ctx.fillStyle = "#ffffff";
            this.ctx.font = "20px Arial";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(button.text, 110, y + 25);

            // Handle button clicks
            if (this.game.input.isElementJustPressed(button.id, "debug")) {
                // Changed from "weather" to "debug"
                console.log(`[DebugPanel] Weather button clicked: ${button.id}`);
                if (this.game.weatherSystem) {
                    this.game.weatherSystem.current = button.id;
                }
            }
        });

        // Draw weather info panel
        this.drawWeatherInfo();
    }

    drawWeatherInfo() {
        const startX = this.canvas.width - 250;
        const startY = 10;
        const padding = 10;

        // Background
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        this.ctx.fillRect(startX - padding, startY, 240, 150);

        // Text settings
        this.ctx.font = "14px monospace";
        this.ctx.fillStyle = "#ffffff";
        this.ctx.textAlign = "left";

        // Get weather params from weather system
        const weatherParams = this.game.weatherSystem?.getWeatherParams() || {
            type: "N/A",
            activeParticles: 0,
            maxParticles: 0,
            emissionRate: 0
        };

        // Info lines
        const info = [
            [`Camera: ${this.formatVector(this.game.camera?.position || { x: 0, y: 300, z: -800 })}`],
            [`Rotation: ${this.game.camera?.rotation || "undefined"}°`],
            [`Weather: ${weatherParams.type}`],
            [`Active Particles: ${weatherParams.activeParticles}`],
            [`Max Particles: ${weatherParams.maxParticles}`],
            [`Emission Rate: ${weatherParams.emissionRate}/sec`]
        ];

        info.forEach((line, index) => {
            this.ctx.fillText(line, startX, startY + 20 + index * 20);
        });
    }





    // Helper color functions
    lightenColor(color) {
        const r = parseInt(color.substr(1, 2), 16);
        const g = parseInt(color.substr(3, 2), 16);
        const b = parseInt(color.substr(5, 2), 16);
        const factor = 1.2;
        return `#${Math.min(255, Math.floor(r * factor))
            .toString(16)
            .padStart(2, "0")}${Math.min(255, Math.floor(g * factor))
            .toString(16)
            .padStart(2, "0")}${Math.min(255, Math.floor(b * factor))
            .toString(16)
            .padStart(2, "0")}`;
    }

    darkenColor(color) {
        const r = parseInt(color.substr(1, 2), 16);
        const g = parseInt(color.substr(3, 2), 16);
        const b = parseInt(color.substr(5, 2), 16);
        const factor = 0.8;
        return `#${Math.floor(r * factor)
            .toString(16)
            .padStart(2, "0")}${Math.floor(g * factor)
            .toString(16)
            .padStart(2, "0")}${Math.floor(b * factor)
            .toString(16)
            .padStart(2, "0")}`;
    }

    formatVector(vec) {
        return `${this.roundTo(vec.x || 0, this.roundingConfig.positionPrecision)},${this.roundTo(vec.y || 0, this.roundingConfig.positionPrecision)},${this.roundTo(vec.z || 0, this.roundingConfig.positionPrecision)}`;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    getFPS() {
        const now = performance.now();
        const delta = now - this.lastFrameTime;
        this.frameCount++;

        if (delta >= 1000) {
            this.currentFPS = (this.frameCount * 1000) / delta;
            this.frameCount = 0;
            this.lastFrameTime = now;
        }

        return this.currentFPS;
    }

    // Configuration for number formatting
    roundingConfig = {
        defaultPrecision: 2,  // Default decimal places
        fpsPrecision: 1,     // FPS decimal places
        positionPrecision: 2, // Position decimal places
        anglePrecision: 4,    // Normal/angle decimal places
        timePrecision: 1      // Time/ms decimal places
    };
    
    roundTo(num, decimals = this.roundingConfig.defaultPrecision) {
        const multiplier = Math.pow(10, decimals);
        return Math.round(num * multiplier) / multiplier;
    }

    draw() {
        const padding = 10;
        const lineHeight = 16;
        const startX = this.canvas.width - 200;
        let currentY = padding;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Always draw the toggle button
        this.drawWeatherToggleButton();

        // Check for button press
        if (this.game.input.isElementJustPressed("weatherDebugToggle", "debug")) {
            this.showWeatherDebug = !this.showWeatherDebug;
        }
        
        // Check if lighting panel is visible
        this.lightingPanelVisible = this.game.lightingDebugPanel && this.game.lightingDebugPanel.visible;

        // Draw appropriate panel based on toggle state
        if (this.showWeatherDebug) {
            this.drawWeatherPanel();
        
        } else {
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

            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // Always draw the toggle button
            this.drawWeatherToggleButton();

            // Only draw the regular debug panel if weather debug and lighting panel are not active
            if (!this.showWeatherDebug && !this.lightingPanelVisible) {
                this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
                this.ctx.fillRect(startX - padding, 0, 220, 560);

                // Save context state before drawing text to ensure proper state management
                this.ctx.save();
                this.ctx.fillStyle = "#ffffff";
                this.ctx.font = "11px monospace";
                this.ctx.textAlign = "left";

                // Performance metrics
                this.ctx.fillStyle = "#00ff00";
                addLine("Use 2D Renderer", this.game.use2DRenderer ? "Enabled" : "Disabled");
                this.ctx.fillStyle = "#ffffff";
                addLine("FPS", this.roundTo(this.getFPS(), this.roundingConfig.fpsPrecision));
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
                // Current terrain/biome
                const characterBase = this.game.character.position.y - this.game.character.size / 2;
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
    }
}