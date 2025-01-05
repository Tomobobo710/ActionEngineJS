// game/debug/debugpanel.js
class DebugPanel {
    constructor(debugCanvas, game) {
        this.canvas = debugCanvas;
        this.ctx = debugCanvas.getContext("2d");
        this.game = game;
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.currentFPS = 0;

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

        this.showLightingDebug = false;

        // Add lighting toggle button properties
        this.lightingToggleButton = {
            x: (this.canvas.width - 120) / 2, // Center horizontally
            y: 50, // Position below weather toggle
            width: 120,
            height: 30,
            text: "Lighting Debug",
            color: "#444444",
            hovered: false
        };
        // Register the lighting toggle button
        this.game.input.registerElement(
            "lightingDebugToggle",
            {
                bounds: () => ({
                    x: this.lightingToggleButton.x,
                    y: this.lightingToggleButton.y,
                    width: this.lightingToggleButton.width,
                    height: this.lightingToggleButton.height
                })
            },
            "debug"
        );

        // Add slider states
        this.lightingSliders = {
            "Position X": {
                value: 0,
                min: -5000,
                max: 5000,
                dragging: false,
                id: "lightingSliderPosX",
                path: ["POSITION", "x"]
            },
            "Position Y": {
                value: 10000,
                min: 0,
                max: 16384,
                dragging: false,
                id: "lightingSliderPosY",
                path: ["POSITION", "y"]
            },
            "Position Z": {
                value: 0,
                min: -5000,
                max: 5000,
                dragging: false,
                id: "lightingSliderPosZ",
                path: ["POSITION", "z"]
            },
            "Direction X": {
                value: 0.5,
                min: -1,
                max: 1,
                dragging: false,
                id: "lightingSliderDirX",
                path: ["DIRECTION", "x"]
            },
            "Direction Y": {
                value: 1.0,
                min: -1,
                max: 1,
                dragging: false,
                id: "lightingSliderDirY",
                path: ["DIRECTION", "y"]
            },
            "Direction Z": {
                value: 0.5,
                min: -1,
                max: 1,
                dragging: false,
                id: "lightingSliderDirZ",
                path: ["DIRECTION", "z"]
            },
            Intensity: {
                value: 50000,
                min: 0,
                max: 100000,
                dragging: false,
                id: "lightingSliderIntensity",
                path: ["INTENSITY"]
            },
            "Material Roughness": {
                value: 0.2,
                min: 0,
                max: 1,
                dragging: false,
                id: "lightingSliderRoughness",
                path: ["MATERIAL", "ROUGHNESS"]
            },
            "Material Metallic": {
                value: 0.1,
                min: 0,
                max: 1,
                dragging: false,
                id: "lightingSliderMetallic",
                path: ["MATERIAL", "METALLIC"]
            },
            "Base Reflectivity": {
                value: 0.5,
                min: 0,
                max: 1,
                dragging: false,
                id: "lightingSliderBaseReflectivity",
                path: ["MATERIAL", "BASE_REFLECTIVITY"]
            },
            "Shadow Frustum Size": {
                value: 1,
                min: 0.1,
                max: 10,
                dragging: false,
                id: "lightingSliderFrustumSize",
                path: ["SHADOW", "FRUSTUM_SIZE"]
            },
            "Shadow Bias": {
                value: 0.04,
                min: 0,
                max: 0.1,
                dragging: false,
                id: "lightingSliderBias",
                path: ["SHADOW", "BIAS"]
            },
            "Shadow Darkness": {
                value: 0.5,
                min: 0,
                max: 1,
                dragging: false,
                id: "lightingSliderDarkness",
                path: ["SHADOW", "DARKNESS"]
            }
        };
        Object.entries(this.lightingSliders).forEach(([name, slider]) => {
            this.game.input.registerElement(
                slider.id,
                {
                    bounds: () => ({
                        x: 150,
                        y: Object.keys(this.lightingSliders).indexOf(name) * 30 + 22,
                        width: 130,
                        height: 16
                    })
                },
                "debug"
            );
        });
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

    drawLightingToggleButton() {
        this.ctx.save();

        // Update hover state
        this.lightingToggleButton.hovered = this.game.input.isElementHovered("lightingDebugToggle", "debug");

        // Change base color based on active panel
        let baseColor = this.showLightingDebug ? "#00f038" : "#666666";
        let hoverColor = this.showLightingDebug ? "rgba(136, 136, 136, 0.75)" : "rgba(136, 136, 136, 0.75)";

        // Draw button background
        this.ctx.fillStyle = this.lightingToggleButton.hovered ? hoverColor : baseColor;
        this.ctx.fillRect(
            this.lightingToggleButton.x,
            this.lightingToggleButton.y,
            this.lightingToggleButton.width,
            this.lightingToggleButton.height
        );

        // Draw button text
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "14px monospace";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(
            this.lightingToggleButton.text,
            this.lightingToggleButton.x + this.lightingToggleButton.width / 2,
            this.lightingToggleButton.y + this.lightingToggleButton.height / 2
        );

        this.ctx.restore();
    }

    drawLightingPanel() {
        // Draw semi-transparent black background
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        this.ctx.fillRect(10, 10, 300, Object.keys(this.lightingSliders).length * 30 + 20);

        let y = 30;
        for (const [name, slider] of Object.entries(this.lightingSliders)) {
            // Handle dragging
            if (this.game.input.isElementPressed(slider.id, "debug")) {
                const pointerX = this.game.input.getPointerPosition().x;
                const percentage = Math.max(0, Math.min(1, (pointerX - 150) / 130));
                slider.value = slider.min + (slider.max - slider.min) * percentage;

                // Update LightingManager config through the renderer3D reference
                let config = this.game.renderer3d.lightingManager.getLightConfig();
                let target = config;
                for (let i = 0; i < slider.path.length - 1; i++) {
                    target = target[slider.path[i]];
                }
                target[slider.path[slider.path.length - 1]] = slider.value;

                // Force lighting update
                this.game.renderer3d.lightingManager.updateLightMatrix();
            }

            
            
            // Draw slider label
            this.ctx.fillStyle = "#ffffff";
            this.ctx.font = "12px monospace";
            this.ctx.textAlign = "left";
            this.ctx.fillText(name, 20, y);

            // Draw slider background
            this.ctx.fillStyle = "#444444";
            this.ctx.fillRect(150, y - 8, 130, 16);

            // Draw slider value
            const percentage = (slider.value - slider.min) / (slider.max - slider.min);
            this.ctx.fillStyle = "#00ff00";
            this.ctx.fillRect(150, y - 8, 130 * percentage, 16);

            // Draw value text
            this.ctx.fillStyle = "#ffffff";
            this.ctx.textAlign = "right";
            this.ctx.fillText(slider.value.toFixed(2), 290, y);

            y += 30;
        }
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
        return `${Math.round(vec.x || 0)},${Math.round(vec.y || 0)},${Math.round(vec.z || 0)}`;
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

    roundTo(num, decimals) {
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

        // Draw the lighting toggle button
        this.drawLightingToggleButton();

        // Check for button press
        if (this.game.input.isElementJustPressed("weatherDebugToggle", "debug")) {
            this.showWeatherDebug = !this.showWeatherDebug;
        }

        // Check for lighting button press
        if (this.game.input.isElementJustPressed("lightingDebugToggle", "debug")) {
            this.showLightingDebug = !this.showLightingDebug;
            this.showWeatherDebug = false; // Turn off weather debug when lighting is enabled
        }

        // Draw appropriate panel based on toggle state
        if (this.showWeatherDebug) {
            this.drawWeatherPanel();
        } else if (this.showLightingDebug) {
            this.drawLightingPanel();
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
                    `${this.roundTo(vector.x, 2)}, ${this.roundTo(vector.y, 2)}, ${this.roundTo(vector.z, 2)}`
                );
            };

            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // Always draw the toggle button
            this.drawWeatherToggleButton();

            // Only draw the regular debug panel if weather debug is not active
            if (!this.showWeatherDebug) {
                this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
                this.ctx.fillRect(startX - padding, 0, 220, 560);

                this.ctx.fillStyle = "#ffffff";
                this.ctx.font = "11px monospace";

                // Performance metrics
                this.ctx.fillStyle = "#00ff00";
                addLine("Performance", "");
                addLine("Use 2D Renderer", this.game.use2DRenderer ? "Enabled" : "Disabled");
                this.ctx.fillStyle = "#ffffff";
                addLine("FPS", this.roundTo(this.getFPS(), 1));
                addLine("Delta Time", this.roundTo(this.game.deltaTime * 1000, 1) + "ms");

                /*
                // Character info
                this.ctx.fillStyle = "#00ff00";
                addLine("Character", "");
                this.ctx.fillStyle = "#ffffff";

                // Position info
                addVector("World Pos", {
                    x: this.game.character.position.x,
                    y: this.game.character.position.y,
                    z: this.game.character.position.z
                });

                // Physics info
                const velocity = this.game.character.body.getLinearVelocity();
                addVector("Velocity", {
                    x: velocity.x(),
                    y: velocity.y(),
                    z: velocity.z()
                });

                // Calculate speed from velocity
                const speed = Math.sqrt(
                    velocity.x() * velocity.x() + velocity.y() * velocity.y() + velocity.z() * velocity.z()
                );
                addLine("Speed", this.roundTo(speed, 2));

                // Ground contact
                addLine("Ground Contact", this.game.character.controller.isOnGround() ? "Yes" : "No");

                // Character state
                addLine("Jump State", this.game.character.controller.isOnGround() ? "Grounded" : "Airborne");

                // Camera info
                this.ctx.fillStyle = "#00ff00";
                addLine("Camera Control", "");
                this.ctx.fillStyle = "#ffffff";
                addLine("Camera Mode", this.game.character.camera.isDetached ? "Detached" : "Following");
                addLine(
                    "Orbit Angle",
                    this.roundTo((this.game.character.controller.cameraAngle * 180) / Math.PI, 1) + "°"
                );
                addLine("Camera Distance", this.roundTo(this.game.character.controller.cameraDistance, 1));
                // Camera Details
                this.ctx.fillStyle = "#00ff00";
                addLine("Camera Details", "");
                this.ctx.fillStyle = "#ffffff";
                addLine(
                    "Orbit Angle",
                    this.roundTo((this.game.character.controller.cameraAngle * 180) / Math.PI, 1) + "°"
                );

                // Height info with percentage
                const terrainHeight = this.game.terrain.getHeightAt(
                    this.game.character.position.x,
                    this.game.character.position.z
                );
                const maxHeight = this.game.terrain.generator.getBaseWorldHeight();
                const heightPercent = Math.round((terrainHeight / maxHeight) * 100);
                addLine("Ground Height", `${this.roundTo(terrainHeight, 2)} (${this.roundTo(heightPercent, 1)}%)`);

                // Camera metrics
                this.ctx.fillStyle = "#00ff00";
                addLine("Camera", "");
                this.ctx.fillStyle = "#ffffff";
                addVector("Cam Pos", {
                    x: this.roundTo(this.game.camera.position.x, 2),
                    y: this.roundTo(this.game.camera.position.y, 2),
                    z: this.roundTo(this.game.camera.position.z, 2)
                });
                addVector("Cam Target", {
                    x: this.roundTo(this.game.camera.target.x, 2),
                    y: this.roundTo(this.game.camera.target.y, 2),
                    z: this.roundTo(this.game.camera.target.z, 2)
                });

                // Camera angles and distance
                const dx = this.game.camera.position.x - this.game.camera.target.x;
                const dy = this.game.camera.position.y - this.game.camera.target.y;
                const dz = this.game.camera.position.z - this.game.camera.target.z;
                const camDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                const camHeight = this.game.camera.position.y - this.game.character.position.y;
                addLine("Cam Distance", this.roundTo(camDist, 2));
                addLine("Cam Height", this.roundTo(camHeight, 2));

                // World metrics
                this.ctx.fillStyle = "#00ff00";
                addLine("World", "");
                this.ctx.fillStyle = "#ffffff";

                // Current terrain/biome
                const characterBase = this.game.character.position.y - this.game.character.size / 2;
                const heightPercentAtPlayer = (characterBase / maxHeight) * 100;
                addLine("Height %", Math.round(heightPercentAtPlayer));
*/
                // Triangle info
                this.ctx.fillStyle = "#00ff00";
                addLine("Current Triangle", "");
                this.ctx.fillStyle = "#ffffff";

                const triangle = this.game.character.getCurrentTriangle();
                if (triangle) {
                    addLine("Min Height", this.roundTo(triangle.minY, 2));
                    addLine("Max Height", this.roundTo(triangle.maxY, 2));
                    addLine("Avg Height", this.roundTo(triangle.avgY, 2));
                    addLine(
                        "Normal",
                        `${this.roundTo(triangle.normal.x, 4)}, ${this.roundTo(triangle.normal.y, 4)}, ${this.roundTo(triangle.normal.z, 4)}`
                    );
                    addLine("Vertex Indices", triangle.indices.join(", "));
                    addLine("Biome", triangle.biome);
                } else {
                    addLine("Triangle", "None found");
                }
            }
        }
    }
}