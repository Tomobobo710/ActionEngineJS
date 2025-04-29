// game/debug/basedebugpanel.js
class BaseDebugPanel {
    constructor(debugCanvas, game, options = {}) {
        this.canvas = debugCanvas;
        this.ctx = debugCanvas.getContext("2d");
        this.game = game;
        
        // Panel state
        this.visible = false;
        this.activeTab = options.defaultTab || 'main';
        
        // UI settings
        this.panelWidth = options.panelWidth || 400;
        this.panelHeight = options.panelHeight || 500;
        this.panelX = options.panelX || 20;
        this.panelY = options.panelY || (this.canvas.height - this.panelHeight) / 2;
        
        // Tabs (can be overridden by child classes)
        this.tabs = options.tabs || [
            { id: 'main', label: 'Main' }
        ];
        
        // Configure toggle button
        this.toggleButton = {
            x: options.toggleX || (this.canvas.width - 150) / 2,
            y: options.toggleY || 10,
            width: options.toggleWidth || 150,
            height: options.toggleHeight || 30,
            text: options.toggleText || "Debug Panel",
            color: options.toggleColor || "#444444"
        };
        
        // Register toggle button with input system if toggleId is provided
        if (options.toggleId) {
            this.toggleId = options.toggleId;
            this.game.input.registerElement(
                this.toggleId,
                {
                    bounds: () => ({
                        x: this.toggleButton.x,
                        y: this.toggleButton.y,
                        width: this.toggleButton.width,
                        height: this.toggleButton.height
                    })
                },
                "debug"
            );
        }
        
        // Register the tab buttons
        this.tabs.forEach((tab, index) => {
            this.game.input.registerElement(
                `${options.panelId || 'debug'}_tab_${tab.id}`,
                {
                    bounds: () => ({
                        x: this.panelX + (index * (this.panelWidth / this.tabs.length)),
                        y: this.panelY,
                        width: this.panelWidth / this.tabs.length,
                        height: 30
                    })
                },
                "debug"
            );
        });
        
        // Configuration for number formatting
        this.roundingConfig = {
            defaultPrecision: 2,  // Default decimal places
            fpsPrecision: 1,      // FPS decimal places
            positionPrecision: 2, // Position decimal places
            anglePrecision: 4,    // Normal/angle decimal places
            timePrecision: 1      // Time/ms decimal places
        };
    }
    
    // Utility function to round a number to specified decimals
    roundTo(num, decimals = this.roundingConfig.defaultPrecision) {
        const multiplier = Math.pow(10, decimals);
        return Math.round(num * multiplier) / multiplier;
    }
    
    // Format a Vector3 to a string
    formatVector(vec) {
        if (!vec) return "0,0,0";
        return `${this.roundTo(vec.x || 0, this.roundingConfig.positionPrecision)},${this.roundTo(vec.y || 0, this.roundingConfig.positionPrecision)},${this.roundTo(vec.z || 0, this.roundingConfig.positionPrecision)}`;
    }
    
    // Helper color functions
    lightenColor(color) {
        const r = parseInt(color.substr(1, 2), 16);
        const g = parseInt(color.substr(3, 2), 16);
        const b = parseInt(color.substr(5, 2), 16);
        const factor = 1.3; // Lighten by 30%
        
        return `#${Math.min(255, Math.floor(r * factor)).toString(16).padStart(2, '0')}${Math.min(255, Math.floor(g * factor)).toString(16).padStart(2, '0')}${Math.min(255, Math.floor(b * factor)).toString(16).padStart(2, '0')}`;
    }
    
    darkenColor(color) {
        const r = parseInt(color.substr(1, 2), 16);
        const g = parseInt(color.substr(3, 2), 16);
        const b = parseInt(color.substr(5, 2), 16);
        const factor = 0.8;
        return `#${Math.floor(r * factor).toString(16).padStart(2, "0")}${Math.floor(g * factor).toString(16).padStart(2, "0")}${Math.floor(b * factor).toString(16).padStart(2, "0")}`;
    }
    
    // Register sliders with input system - similar to LightingDebugPanel
    registerSliders(sliders, tabName) {
        // Clear any existing slider elements for this tab
        Object.entries(sliders).forEach(([name, slider]) => {
            this.game.input.removeElement(slider.id, "debug");
            if (slider.options) {
                this.game.input.removeElement(`${slider.id}_left`, "debug");
                this.game.input.removeElement(`${slider.id}_right`, "debug");
            }
        });
        
        // Register each slider with unique bounds
        Object.entries(sliders).forEach(([name, slider], index) => {
            // Register the slider track
            this.game.input.registerElement(
                slider.id,
                {
                    bounds: () => ({
                        x: this.panelX + 160,
                        y: this.panelY + 100 + (index * 40),
                        width: 180,
                        height: 20
                    })
                },
                "debug"
            );
            
            // For sliders with discrete options, register left/right buttons
            if (slider.options) {
                // Left button
                this.game.input.registerElement(
                    `${slider.id}_left`,
                    {
                        bounds: () => ({
                            x: this.panelX + 160 - 30,
                            y: this.panelY + 100 + (index * 40),
                            width: 20,
                            height: 20
                        })
                    },
                    "debug"
                );
                
                // Right button
                this.game.input.registerElement(
                    `${slider.id}_right`,
                    {
                        bounds: () => ({
                            x: this.panelX + 160 + 190,
                            y: this.panelY + 100 + (index * 40),
                            width: 20,
                            height: 20
                        })
                    },
                    "debug"
                );
            }
        });
    }
    
    // Register buttons with the input system
    registerButtons(buttons) {
        buttons.forEach((button) => {
            this.game.input.registerElement(
                button.id,
                {
                    bounds: () => ({
                        x: button.x,
                        y: button.y,
                        width: button.width,
                        height: button.height
                    })
                },
                "debug"
            );
        });
    }
    
    // Register toggle controls with the input system
    registerToggles(toggles) {
        toggles.forEach((toggle, index) => {
            this.game.input.registerElement(
                toggle.id,
                {
                    bounds: () => ({
                        x: this.panelX + 20,
                        y: this.panelY + 100 + (index * 30),
                        width: 20,
                        height: 20
                    })
                },
                "debug"
            );
        });
    }
    
    // Handle slider interactions
    handleOptionSliders(sliders) {
        if (!sliders) return;

        Object.entries(sliders).forEach(([name, slider]) => {
            // Handle discrete option sliders (with left/right buttons)
            if (slider.options) {
                // Left button (decrease)
                if (this.game.input.isElementJustPressed(`${slider.id}_left`, "debug")) {
                    slider.currentOption = Math.max(0, slider.currentOption - 1);
                    slider.value = slider.options[slider.currentOption];
                    if (slider.updateProperty) {
                        slider.updateProperty(slider.value);
                    }
                }
                
                // Right button (increase)
                if (this.game.input.isElementJustPressed(`${slider.id}_right`, "debug")) {
                    slider.currentOption = Math.min(slider.options.length - 1, slider.currentOption + 1);
                    slider.value = slider.options[slider.currentOption];
                    if (slider.updateProperty) {
                        slider.updateProperty(slider.value);
                    }
                }
            } 
            // Handle continuous sliders
            else {
                // Direct method similar to debugpanel.js
                if (this.game.input.isElementPressed(slider.id, "debug")) {
                    const pointerX = this.game.input.getPointerPosition().x;
                    const sliderStartX = this.panelX + 160;
                    const sliderWidth = 180;
                    
                    // Calculate normalized position (0-1)
                    const percentage = Math.max(0, Math.min(1, (pointerX - sliderStartX) / sliderWidth));
                    
                    // Calculate actual value based on min/max
                    let newValue = slider.min + (slider.max - slider.min) * percentage;
                    
                    // Apply step if defined
                    if (slider.step) {
                        newValue = Math.round(newValue / slider.step) * slider.step;
                    }
                    
                    // Update slider value
                    slider.value = newValue;
                    if (slider.updateProperty) {
                        slider.updateProperty(newValue);
                    }
                }
            }
        });
    }
    
    // Draw sliders on the panel
    drawSliders(sliders) {
        Object.entries(sliders).forEach(([name, slider], index) => {
            const sliderY = this.panelY + 100 + (index * 40);
            
            // Draw label
            this.ctx.fillStyle = "#ffffff";
            this.ctx.font = "14px Arial";
            this.ctx.textAlign = "right";
            this.ctx.fillText(name, this.panelX + 150, sliderY + 10);
            
            // For sliders with discrete options
            if (slider.options) {
                // Draw left/right buttons
                this.drawOptionButtons(slider, sliderY);
                
                // Draw current value
                this.ctx.textAlign = "center";
                this.ctx.fillText(slider.value.toString(), this.panelX + 250, sliderY + 10);
            } 
            // For continuous sliders
            else {
                // Draw slider background track
                this.ctx.fillStyle = "#444444";
                this.ctx.fillRect(this.panelX + 160, sliderY, 180, 20);
                
                // Calculate position based on value
                const percentage = (slider.value - slider.min) / (slider.max - slider.min);
                
                // Draw slider value fill
                this.ctx.fillStyle = this.game.input.isElementPressed(slider.id, "debug") ? "#00ff00" : "#00aa00";
                this.ctx.fillRect(this.panelX + 160, sliderY, 180 * percentage, 20);
                
                // Draw slider handle
                this.ctx.fillStyle = "#ffffff";
                this.ctx.fillRect(this.panelX + 160 + (180 * percentage) - 2, sliderY - 2, 4, 24);
                
                // Draw value text
                this.ctx.textAlign = "right";
                const valueText = Number.isInteger(slider.value) ? slider.value.toString() : slider.value.toFixed(3);
                this.ctx.fillText(valueText, this.panelX + 380, sliderY + 10);
            }
        });
    }
    
    // Draw option buttons for discrete sliders
    drawOptionButtons(slider, sliderY) {
        // Draw left button
        const leftButtonX = this.panelX + 160 - 30;
        const isLeftHovered = this.game.input.isElementHovered(`${slider.id}_left`, "debug");
        this.ctx.fillStyle = isLeftHovered ? "#666666" : "#444444";
        this.ctx.fillRect(leftButtonX, sliderY, 20, 20);
        
        this.ctx.fillStyle = "#ffffff";
        this.ctx.textAlign = "center";
        this.ctx.fillText("<", leftButtonX + 10, sliderY + 10);
        
        // Draw right button
        const rightButtonX = this.panelX + 160 + 190;
        const isRightHovered = this.game.input.isElementHovered(`${slider.id}_right`, "debug");
        this.ctx.fillStyle = isRightHovered ? "#666666" : "#444444";
        this.ctx.fillRect(rightButtonX, sliderY, 20, 20);
        
        this.ctx.fillStyle = "#ffffff";
        this.ctx.textAlign = "center";
        this.ctx.fillText(">", rightButtonX + 10, sliderY + 10);
    }
    
    // Draw toggle controls
    drawToggles(toggles) {
        this.ctx.textAlign = "left";
        this.ctx.font = "14px Arial";
        
        toggles.forEach((toggle, index) => {
            const toggleX = this.panelX + 20;
            const toggleY = this.panelY + 100 + (index * 30);
            
            // Draw checkbox
            this.ctx.strokeStyle = "#ffffff";
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(toggleX, toggleY, 20, 20);
            
            // Draw check if enabled
            if (toggle.checked) {
                this.ctx.fillStyle = "#55ff55";
                this.ctx.fillRect(toggleX + 4, toggleY + 4, 12, 12);
            }
            
            // Draw label (increased spacing from 30 to 40 pixels to prevent overlap)
            this.ctx.fillStyle = "#ffffff";
            this.ctx.fillText(toggle.label, toggleX + 40, toggleY + 14);
        });
    }
    
    // Draw button controls
    drawButtons(buttons) {
        buttons.forEach(button => {
            const isHovered = this.game.input.isElementHovered(button.id, "debug");
            
            // Draw button background
            this.ctx.fillStyle = isHovered ? this.lightenColor(button.color) : button.color;
            this.ctx.fillRect(button.x, button.y, button.width, button.height);
            
            // Draw button border
            this.ctx.strokeStyle = "#ffffff";
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(button.x, button.y, button.width, button.height);
            
            // Draw button text
            this.ctx.fillStyle = "#ffffff";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(button.label, button.x + button.width / 2, button.y + button.height / 2);
        });
    }
    
    // Draw the toggle button to show/hide the panel
    drawToggleButton() {
        if (!this.toggleId) return;
        
        const isHovered = this.game.input.isElementHovered(this.toggleId, "debug");
        const baseColor = this.visible ? "#00aa00" : "#666666";
        const hoverColor = this.visible ? "#00cc00" : "#888888";
        
        // Draw button background
        this.ctx.fillStyle = isHovered ? hoverColor : baseColor;
        this.ctx.fillRect(
            this.toggleButton.x,
            this.toggleButton.y,
            this.toggleButton.width,
            this.toggleButton.height
        );
        
        // Draw button text
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "14px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(
            this.toggleButton.text,
            this.toggleButton.x + this.toggleButton.width / 2,
            this.toggleButton.y + this.toggleButton.height / 2
        );
    }
    
    // Draw the tabs at the top of the panel
    drawTabs() {
        this.tabs.forEach((tab, index) => {
            const tabX = this.panelX + (index * (this.panelWidth / this.tabs.length));
            const tabWidth = this.panelWidth / this.tabs.length;
            const isActive = this.activeTab === tab.id;
            
            // For Scene panel we need to use "scene" as the prefix
            let panelPrefix;
            if (this.toggleId === 'sceneDebugToggle') {
                panelPrefix = 'scene';
            } else if (this.toggleId === 'weatherDebugToggle') {
                panelPrefix = 'weather';
            } else if (this.toggleId === 'lightingToggleButton') {
                panelPrefix = 'lighting';
            } else {
                panelPrefix = this.toggleId ? this.toggleId.split('Toggle')[0] : 'debug';
            }
            
            const tabElementId = `${panelPrefix}_tab_${tab.id}`;
            const isHovered = this.game.input.isElementHovered(tabElementId, "debug");
            
            // Tab background
            this.ctx.fillStyle = isActive ? "#559955" : (isHovered ? "#557755" : "#444444");
            this.ctx.fillRect(tabX, this.panelY, tabWidth, 30);
            
            // Tab label
            this.ctx.fillStyle = "#ffffff";
            this.ctx.font = "14px Arial";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(tab.label, tabX + tabWidth / 2, this.panelY + 15);
        });
    }
    
    // Update method to handle input and panel state
    update() {
        // Check toggle button state if it exists
        if (this.toggleId && this.game.input.isElementJustPressed(this.toggleId, "debug")) {
            this.visible = !this.visible;
            
            // If panel is becoming visible, additional initialization can be done here
            if (this.visible) {
                this.lastActivatedTime = Date.now();
                this.onShow();
            } else {
                this.onHide();
            }
        }
        
        // If panel isn't visible, no need to check other inputs
        if (!this.visible) return;
        
        // Check tab selection
        this.tabs.forEach(tab => {
            // For Scene panel we need to use "scene" as the prefix
            let panelPrefix;
            if (this.toggleId === 'sceneDebugToggle') {
                panelPrefix = 'scene';
            } else if (this.toggleId === 'weatherDebugToggle') {
                panelPrefix = 'weather';
            } else if (this.toggleId === 'lightingToggleButton') {
                panelPrefix = 'lighting';
            } else {
                panelPrefix = this.toggleId ? this.toggleId.split('Toggle')[0] : 'debug';
            }
            
            const tabElementId = `${panelPrefix}_tab_${tab.id}`;
            
            if (this.game.input.isElementJustPressed(tabElementId, "debug")) {
                this.activeTab = tab.id;
                this.onTabChange(tab.id);
            }
        });
        
        // Child classes should implement their specific update logic
        this.updateContent();
    }
    
    // Override these methods in child classes
    onShow() {
        // Called when panel becomes visible
        this.lastActivatedTime = Date.now();
    }
    
    onHide() {
        // Called when panel becomes hidden
    }
    
    onTabChange(tabId) {
        // Called when tab changes
    }
    
    updateContent() {
        // Update panel content, handle input, etc.
    }
    
    // Main draw method
    draw() {
        // Draw toggle button if we have one
        if (this.toggleId) {
            this.drawToggleButton();
        }
        
        // If panel isn't visible, don't draw it
        if (!this.visible) return;
        
        // Draw panel background
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        this.ctx.fillRect(this.panelX, this.panelY, this.panelWidth, this.panelHeight);
        
        // Draw tabs if we have multiple
        if (this.tabs.length > 1) {
            this.drawTabs();
        }
        
        // Child classes should implement their specific draw logic in drawContent
        this.drawContent();
    }
    
    // Override this method in child classes
    drawContent() {
        // Draw panel content based on active tab
    }
}