// game/debug/weatherdebugpanel.js
class WeatherDebugPanel {
    constructor(debugCanvas, game) {
        this.canvas = debugCanvas;
        this.ctx = debugCanvas.getContext("2d");
        this.game = game;
        
        // Weather button definitions
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
        if (!vec) return "0,0,0";
        return `${vec.x || 0},${vec.y || 0},${vec.z || 0}`;
    }
    
    draw() {
        // Draw semi-transparent black background
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        this.ctx.fillRect(10, 10, 200, this.weatherButtons.length * 60 + 10);

        // Draw weather buttons
        this.weatherButtons.forEach((button, index) => {
            const y = index * 60 + 20;
            const isHovered = this.game.input.isElementHovered(button.id, "weather");
            const isPressed = this.game.input.isElementPressed(button.id, "weather");
            const isActive = this.game.weatherSystem?.current === button.id;

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
                console.log(`[WeatherDebugPanel] Weather button clicked: ${button.id}`);
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
            [`Camera: ${this.formatVector(this.game.camera?.position)}`],
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
}