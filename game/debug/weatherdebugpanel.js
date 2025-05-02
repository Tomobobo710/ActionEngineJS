// game/debug/weatherdebugpanel.js
class WeatherDebugPanel extends BaseDebugPanel {
    constructor(debugCanvas, game) {
        // Configure panel options with tabs and consistent positioning
        const options = {
            panelId: 'weather',
            toggleId: 'weatherDebugToggle',
            defaultTab: 'controls',
            toggleText: 'Weather Debug',
            toggleX: 150, // Position next to Scene Debug button
            toggleY: 10,
            toggleWidth: 120,
            toggleHeight: 30,
            panelWidth: 450,
            panelHeight: 500,
            panelX: 20, // Position on left side // Center horizontally
            panelY: 50,
            tabs: [
                { id: 'controls', label: 'Controls' },
                { id: 'settings', label: 'Settings' },
                { id: 'info', label: 'Info' }
            ]
        };
        
        // Call parent constructor
        super(debugCanvas, game, options);
        
        // Weather button definitions - standard style and consistent positioning
        this.weatherButtons = [
            { 
                id: "stopWeather", 
                label: "Stop", 
                x: this.panelX + 125, 
                y: this.panelY + 100, 
                width: 200, 
                height: 40, 
                color: "#444444" 
            },
            { 
                id: "rain", 
                label: "Rain", 
                x: this.panelX + 125, 
                y: this.panelY + 150, 
                width: 200, 
                height: 40, 
                color: "#444444" 
            },
            { 
                id: "heavyRain", 
                label: "Heavy Rain", 
                x: this.panelX + 125, 
                y: this.panelY + 200, 
                width: 200, 
                height: 40, 
                color: "#444444" 
            },
            { 
                id: "snow", 
                label: "Snow", 
                x: this.panelX + 125, 
                y: this.panelY + 250, 
                width: 200, 
                height: 40, 
                color: "#444444" 
            },
            { 
                id: "wind", 
                label: "Wind", 
                x: this.panelX + 125, 
                y: this.panelY + 300, 
                width: 200, 
                height: 40, 
                color: "#444444" 
            },
            { 
                id: "hurricane", 
                label: "Hurricane", 
                x: this.panelX + 125, 
                y: this.panelY + 350, 
                width: 200, 
                height: 40, 
                color: "#444444" 
            },
            { 
                id: "poison", 
                label: "Poison", 
                x: this.panelX + 125, 
                y: this.panelY + 400, 
                width: 200, 
                height: 40, 
                color: "#444444" 
            },
            { 
                id: "fire", 
                label: "Fire", 
                x: this.panelX + 125, 
                y: this.panelY + 450, 
                width: 200, 
                height: 40, 
                color: "#444444" 
            }
        ];
        
        // Register weather buttons
        this.registerButtons(this.weatherButtons);
        
        // Create weather settings sliders with default values and null checks
        const hasWeatherSystem = !!this.game.weatherSystem;
        
        this.weatherSliders = {
            "Particle Count": {
                value: hasWeatherSystem && this.game.weatherSystem.maxParticles !== undefined ? 
                       this.game.weatherSystem.maxParticles : 1000,
                min: 100,
                max: 5000,
                step: 100,
                id: "weatherParticleCount",
                updateProperty: (value) => { 
                    if (this.game.weatherSystem) {
                        this.game.weatherSystem.maxParticles = value; 
                    }
                }
            },
            "Emission Rate": {
                value: hasWeatherSystem && this.game.weatherSystem.emissionRate !== undefined ? 
                       this.game.weatherSystem.emissionRate : 100,
                min: 10,
                max: 500,
                step: 10,
                id: "weatherEmissionRate",
                updateProperty: (value) => { 
                    if (this.game.weatherSystem) {
                        this.game.weatherSystem.emissionRate = value; 
                    }
                }
            },
            "Wind Power": {
                value: hasWeatherSystem && this.game.weatherSystem.windPower !== undefined ? 
                       this.game.weatherSystem.windPower : 1,
                min: 0,
                max: 10,
                step: 0.1,
                id: "weatherWindPower",
                updateProperty: (value) => { 
                    if (this.game.weatherSystem) {
                        this.game.weatherSystem.windPower = value; 
                    }
                }
            },
            "Gravity": {
                value: hasWeatherSystem && this.game.weatherSystem.gravity !== undefined ? 
                       this.game.weatherSystem.gravity : 9.8,
                min: 0,
                max: 20,
                step: 0.1,
                id: "weatherGravity",
                updateProperty: (value) => { 
                    if (this.game.weatherSystem) {
                        this.game.weatherSystem.gravity = value; 
                    }
                }
            }
        };
        
        // Register sliders
        this.registerSliders(this.weatherSliders, "main");
    }
    
    // Update method, called each frame
    updateContent() {
        // Handle tab-specific updates
        switch (this.activeTab) {
            case 'controls':
                // Handle weather buttons
                this.weatherButtons.forEach(button => {
                    if (this.game.input.isElementJustPressed(button.id, "debug")) {
                        console.log(`[WeatherDebugPanel] Weather button clicked: ${button.id}`);
                        if (this.game.weatherSystem) {
                            this.game.weatherSystem.current = button.id;
                            
                            // Highlight the active weather button
                            this.weatherButtons.forEach(btn => {
                                if (btn.id === button.id) {
                                    btn.color = "#00aa00"; // Green for active
                                } else {
                                    btn.color = "#444444"; // Default for inactive
                                }
                            });
                        }
                    }
                });
                break;
                
            case 'settings':
                // Handle weather parameter sliders
                this.handleOptionSliders(this.weatherSliders);
                break;
                
            case 'info':
                // Just display info, no interaction needed
                break;
        }
    }
    
    // Draw method for the debug panel content
    drawContent() {
        // Draw content based on active tab
        switch (this.activeTab) {
            case 'controls':
                this.drawWeatherControls();
                break;
            case 'settings':
                this.drawWeatherSettings();
                break;
            case 'info':
                this.drawWeatherInfo();
                break;
        }
    }
    
    // Draw the weather controls tab content
    drawWeatherControls() {
        // Title
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Weather Control", this.panelX + this.panelWidth / 2, this.panelY + 50);
        
        // Draw all weather type buttons
        this.drawButtons(this.weatherButtons);
    }
    
    // Draw the weather settings tab content
    drawWeatherSettings() {
        // Title
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Weather Parameters", this.panelX + this.panelWidth / 2, this.panelY + 50);
        
        // Draw weather sliders
        super.drawSliders(this.weatherSliders);
    }
    
    // Draw weather status information
    drawWeatherInfo() {
        // Title
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Weather Status", this.panelX + this.panelWidth / 2, this.panelY + 50);
        
        // Get weather params from weather system
        let weatherParams;
        if (this.game.weatherSystem && typeof this.game.weatherSystem.getWeatherParams === 'function') {
            try {
                weatherParams = this.game.weatherSystem.getWeatherParams();
            } catch (error) {
                weatherParams = null;
            }
        }
        
        // Default values if weatherParams is not available
        weatherParams = weatherParams || {
            type: "N/A",
            activeParticles: 0,
            maxParticles: 0,
            emissionRate: 0
        };
        
        // Info panel position
        const infoX = this.panelX + 40;
        const infoY = this.panelY + 80;
        const lineHeight = 30;
        
        // Format camera info safely
        const cameraPos = this.game.camera ? this.formatVector(this.game.camera.position) : "N/A";
        const cameraRot = this.game.camera && this.game.camera.rotation !== undefined ? 
                          `${this.game.camera.rotation}°` : "N/A";
        
        // Section headings and data
        this.ctx.textAlign = "left";
        let currentY = infoY;
        
        // Weather status section
        this.ctx.fillStyle = "#00ff00";
        this.ctx.font = "14px Arial";
        this.ctx.fillText("Weather Parameters", infoX, currentY);
        currentY += 25;
        
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "12px Arial";
        this.ctx.fillText(`Weather Type: ${weatherParams.type}`, infoX, currentY); currentY += lineHeight;
        this.ctx.fillText(`Active Particles: ${weatherParams.activeParticles}`, infoX, currentY); currentY += lineHeight;
        this.ctx.fillText(`Max Particles: ${weatherParams.maxParticles}`, infoX, currentY); currentY += lineHeight;
        this.ctx.fillText(`Emission Rate: ${weatherParams.emissionRate}/sec`, infoX, currentY); currentY += lineHeight;
        
        // Camera info section
        currentY += 10;
        this.ctx.fillStyle = "#00ff00";
        this.ctx.font = "14px Arial";
        this.ctx.fillText("Camera Info", infoX, currentY);
        currentY += 25;
        
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "12px Arial";
        this.ctx.fillText(`Camera Position: ${cameraPos}`, infoX, currentY); currentY += lineHeight;
        this.ctx.fillText(`Camera Rotation: ${cameraRot}`, infoX, currentY); currentY += lineHeight;
    }

    // Override from BaseDebugPanel - Return the active sliders based on current tab
    getActiveSliders() {
        if (this.activeTab === 'settings') {
            return this.weatherSliders;
        }
        return {};
    }
  }
  