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
        
        // Add state for panel visibility
        this.showSceneDebug = true;
        this.showWeatherDebug = false;
        
        // Initialize debug panels
        this.initializeDebugPanels();
        
        // Set up toggle buttons
        this.initializeToggleButtons();
    }
    
    // Initialize all debug panel instances
    initializeDebugPanels() {
        // Create SceneDebugPanel instance
        this.sceneDebugPanel = new SceneDebugPanel(this.canvas, this.game);
        
        // Create WeatherDebugPanel instance
        this.weatherDebugPanel = new WeatherDebugPanel(this.canvas, this.game);
    }
    
    // Initialize toggle buttons
    initializeToggleButtons() {
        // Add Scene Debug toggle button
        this.sceneToggleButton = {
            x: (this.canvas.width - 120) / 2 - 140, // Place to left of weather button
            y: 10, // Top of screen with small padding
            width: 120,
            height: 30,
            text: "Scene Debug",
            color: "#444444",
            hovered: false
        };
        
        // Register the scene toggle button with input system
        this.game.input.registerElement(
            "sceneDebugToggle",
            {
                bounds: () => ({
                    x: this.sceneToggleButton.x,
                    y: this.sceneToggleButton.y,
                    width: this.sceneToggleButton.width,
                    height: this.sceneToggleButton.height
                })
            },
            "debug"
        );
        
        // Add Weather Debug toggle button properties
        this.weatherToggleButton = {
            x: (this.canvas.width - 120) / 2, // Center horizontally
            y: 10, // Top of screen with small padding
            width: 120,
            height: 30,
            text: "Weather Debug",
            color: "#444444",
            hovered: false
        };

        // Register the weather toggle button with input system
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
    
    // Draw the scene toggle button
    drawSceneToggleButton() {
        this.ctx.save();

        // Update hover state
        this.sceneToggleButton.hovered = this.game.input.isElementHovered("sceneDebugToggle", "debug");

        // Change base color based on active panel
        let baseColor = this.showSceneDebug ? "#008cf0" : "#666666"; // Blue when scene panel active
        let hoverColor = this.showSceneDebug ? "rgba(136, 136, 136, 0.75)" : "rgba(136, 136, 136, 0.75)"; // Lighter version when hovered

        // Draw button background
        this.ctx.fillStyle = this.sceneToggleButton.hovered ? hoverColor : baseColor;
        this.ctx.fillRect(
            this.sceneToggleButton.x,
            this.sceneToggleButton.y,
            this.sceneToggleButton.width,
            this.sceneToggleButton.height
        );

        // Draw button text
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "14px monospace";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(
            this.sceneToggleButton.text,
            this.sceneToggleButton.x + this.sceneToggleButton.width / 2,
            this.sceneToggleButton.y + this.sceneToggleButton.height / 2
        );

        this.ctx.restore();
    }

    // Draw the weather toggle button
    drawWeatherToggleButton() {
        this.ctx.save();

        // Update hover state
        this.weatherToggleButton.hovered = this.game.input.isElementHovered("weatherDebugToggle", "debug");

        // Change base color based on active panel
        let baseColor = this.showWeatherDebug ? "#f00038" : "#666666"; // Red when weather panel active
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

    // Clear the canvas
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Calculate and return the frames per second
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
    
    // Utility function to round a number to specified decimals
    roundTo(num, decimals = this.roundingConfig.defaultPrecision) {
        const multiplier = Math.pow(10, decimals);
        return Math.round(num * multiplier) / multiplier;
    }

    // Main draw function
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Always draw the toggle buttons
        this.drawSceneToggleButton();
        this.drawWeatherToggleButton();

        // Check for button presses
        if (this.game.input.isElementJustPressed("sceneDebugToggle", "debug")) {
            this.showSceneDebug = !this.showSceneDebug;
        }
        
        if (this.game.input.isElementJustPressed("weatherDebugToggle", "debug")) {
            this.showWeatherDebug = !this.showWeatherDebug;
        }
        
        // Check if lighting panel is visible
        this.lightingPanelVisible = this.game.lightingDebugPanel && this.game.lightingDebugPanel.visible;

        // Draw appropriate panel based on toggle states
        if (this.showWeatherDebug) {
            // Use the WeatherDebugPanel to draw weather information
            if (this.weatherDebugPanel) {
                this.weatherDebugPanel.draw();
            }
            // Don't draw scene debug if weather debug is active
            return;
        }
        
        // Only draw the scene debug panel if it's enabled and lighting panel is not visible
        if (this.showSceneDebug && !this.lightingPanelVisible) {
            // Use the SceneDebugPanel to draw scene information
            if (this.sceneDebugPanel) {
                this.sceneDebugPanel.draw();
            }
        }
    }
}