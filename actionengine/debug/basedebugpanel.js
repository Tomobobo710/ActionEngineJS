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
        
        // Initialize Map to store input field registrations
        this.inputFields = new Map();
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
        
        // Check for edit button clicks
        this.inputFields.forEach((info, editBtnId) => {
            if (this.game.input.isElementJustPressed(editBtnId, "debug")) {
                console.log(`Edit button clicked for ${info.name}`);
                this.showInputDialog(info.name, info.slider);
                return; // Exit early if we found a clicked button
            }
        });

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
    
    // Initialize input dialog if needed
    initializeInputDialog() {
        if (!this.inputDialog) {
            this.createInputDialog();
        }
    }
    
    // Draw sliders on the panel
    drawSliders(sliders) {
        // Make sure input dialog is created
        this.initializeInputDialog();
        
        // Register edit buttons if they haven't been registered yet
        if (Object.keys(sliders).length > 0 && this.inputFields.size === 0) {
            this.registerEditButtons(sliders);
        }
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
                
                // Calculate position based on value (clamped for display purposes)
                let displayPercentage = 0;
                if (slider.min !== undefined && slider.max !== undefined) {
                    // Clamp the display percentage between 0 and 1
                    displayPercentage = Math.max(0, Math.min(1, (slider.value - slider.min) / (slider.max - slider.min)));
                }
                
                // Draw slider value fill
                if (slider.outOfRange) {
                    // Use a special color for out-of-range values
                    this.ctx.fillStyle = (slider.value < slider.min) ? "#aa5500" : "#aa0055";
                } else {
                    this.ctx.fillStyle = this.game.input.isElementPressed(slider.id, "debug") ? "#00ff00" : "#00aa00";
                }
                this.ctx.fillRect(this.panelX + 160, sliderY, 180 * displayPercentage, 20);
                
                // Draw slider handle
                this.ctx.fillStyle = slider.outOfRange ? "#ffaa00" : "#ffffff";
                this.ctx.fillRect(this.panelX + 160 + (180 * displayPercentage) - 2, sliderY - 2, 4, 24);
                
                // Draw value text
                this.ctx.textAlign = "right";
                const valueText = Number.isInteger(slider.value) ? slider.value.toString() : slider.value.toFixed(6);
                
                // Use different text color for out-of-range values
                if (slider.outOfRange) {
                    this.ctx.fillStyle = "#ffaa00";
                    // Add indicator for out-of-range values
                    if (slider.value < slider.min) {
                        this.ctx.fillText(`${valueText} (< min)`, this.panelX + 380, sliderY + 10);
                    } else {
                        this.ctx.fillText(`${valueText} (> max)`, this.panelX + 380, sliderY + 10);
                    }
                } else {
                    this.ctx.fillStyle = "#ffffff";
                    this.ctx.fillText(valueText, this.panelX + 380, sliderY + 10);
                }
                
                // Draw "Edit" button for precise value input
                const hoverId = `${slider.id}_edit`;
                const btnInfo = this.inputFields.get(hoverId);
                
                if (btnInfo) {
                    const btnX = btnInfo.x;
                    const btnY = btnInfo.y;
                    const btnWidth = btnInfo.width;
                    const btnHeight = btnInfo.height;
                    
                    // Check if mouse is hovering over the edit button
                    const isHovered = this.game.input.isElementHovered(hoverId, "debug");
                    
                    // Draw edit button
                    this.ctx.fillStyle = isHovered ? "#5555ff" : "#3333aa";
                    this.ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
                    this.ctx.strokeStyle = "#ffffff";
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);
                    
                    // Draw edit button text
                    this.ctx.fillStyle = "#ffffff";
                    this.ctx.textAlign = "center";
                    this.ctx.textBaseline = "middle";
                    this.ctx.fillText("Edit", btnX + btnWidth/2, btnY + btnHeight/2);
                    this.ctx.textBaseline = "alphabetic";
                }
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
    
    // Show an input dialog for precise value editing
    showInputDialog(sliderName, slider) {
        console.log(`Showing input dialog for ${sliderName}, current value: ${slider.value}`);
        // Create modal dialog elements if they don't exist
        if (!this.inputDialog) {
            this.createInputDialog();
        }
        
        // Set dialog title and current value
        this.dialogTitle.textContent = `Edit ${sliderName}`;
        this.dialogInput.value = slider.value.toString();
        this.currentSlider = slider;
        
        // Show the dialog
        this.inputDialogOverlay.style.display = 'block';
        this.inputDialog.style.display = 'block';
        
        // Focus the input field
        setTimeout(() => {
            this.dialogInput.focus();
            this.dialogInput.select();
        }, 10);
    }
    
    // Create the input dialog DOM elements
    createInputDialog() {
        // Create overlay for modal effect
        this.inputDialogOverlay = document.createElement('div');
        this.inputDialogOverlay.style.position = 'fixed';
        this.inputDialogOverlay.style.top = '0';
        this.inputDialogOverlay.style.left = '0';
        this.inputDialogOverlay.style.width = '100%';
        this.inputDialogOverlay.style.height = '100%';
        this.inputDialogOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.inputDialogOverlay.style.zIndex = '999';
        this.inputDialogOverlay.style.display = 'none';
        
        // Create dialog container
        this.inputDialog = document.createElement('div');
        this.inputDialog.style.position = 'fixed';
        this.inputDialog.style.top = '50%';
        this.inputDialog.style.left = '50%';
        this.inputDialog.style.transform = 'translate(-50%, -50%)';
        this.inputDialog.style.backgroundColor = '#333';
        this.inputDialog.style.border = '2px solid #555';
        this.inputDialog.style.borderRadius = '5px';
        this.inputDialog.style.padding = '15px';
        this.inputDialog.style.zIndex = '1000';
        this.inputDialog.style.minWidth = '250px';
        this.inputDialog.style.color = '#fff';
        this.inputDialog.style.display = 'none';
        
        // Create dialog title
        this.dialogTitle = document.createElement('div');
        this.dialogTitle.style.fontSize = '16px';
        this.dialogTitle.style.fontWeight = 'bold';
        this.dialogTitle.style.marginBottom = '10px';
        this.dialogTitle.textContent = 'Edit Value';
        
        // Create input field
        this.dialogInput = document.createElement('input');
        this.dialogInput.type = 'text';
        this.dialogInput.style.width = '100%';
        this.dialogInput.style.padding = '5px';
        this.dialogInput.style.marginBottom = '15px';
        this.dialogInput.style.backgroundColor = '#222288';
        this.dialogInput.style.color = '#fff';
        this.dialogInput.style.border = '1px solid #555';
        this.dialogInput.style.borderRadius = '3px';
        
        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-between';
        
        // Create OK button
        this.dialogOkButton = document.createElement('button');
        this.dialogOkButton.textContent = 'OK';
        this.dialogOkButton.style.padding = '5px 15px';
        this.dialogOkButton.style.backgroundColor = '#00aa00';
        this.dialogOkButton.style.color = '#fff';
        this.dialogOkButton.style.border = 'none';
        this.dialogOkButton.style.borderRadius = '3px';
        this.dialogOkButton.style.cursor = 'pointer';
        
        // Create Cancel button
        this.dialogCancelButton = document.createElement('button');
        this.dialogCancelButton.textContent = 'Cancel';
        this.dialogCancelButton.style.padding = '5px 15px';
        this.dialogCancelButton.style.backgroundColor = '#aa0000';
        this.dialogCancelButton.style.color = '#fff';
        this.dialogCancelButton.style.border = 'none';
        this.dialogCancelButton.style.borderRadius = '3px';
        this.dialogCancelButton.style.cursor = 'pointer';
        
        // Add buttons to container
        buttonContainer.appendChild(this.dialogOkButton);
        buttonContainer.appendChild(this.dialogCancelButton);
        
        // Add elements to dialog
        this.inputDialog.appendChild(this.dialogTitle);
        this.inputDialog.appendChild(this.dialogInput);
        this.inputDialog.appendChild(buttonContainer);
        
        // Add dialog to document
        document.body.appendChild(this.inputDialogOverlay);
        document.body.appendChild(this.inputDialog);
        
        // Add event listeners
        const self = this;
        
        // OK button confirms input
        this.dialogOkButton.addEventListener('click', function() {
            self.confirmInputDialog();
        });
        
        // Cancel button closes dialog without changes
        this.dialogCancelButton.addEventListener('click', function() {
            self.closeInputDialog();
        });
        
        // Enter key confirms input
        this.dialogInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                self.confirmInputDialog();
                e.preventDefault();
            } else if (e.key === 'Escape') {
                self.closeInputDialog();
                e.preventDefault();
            }
        });
        
        // Allow clicks on the overlay to close the dialog
        this.inputDialogOverlay.addEventListener('click', function(e) {
            self.closeInputDialog();
        });
        
        // But prevent clicks on the dialog from bubbling to the overlay
        this.inputDialog.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
    
    // Confirm the input and update the slider value
    confirmInputDialog() {
        if (!this.currentSlider) return;
        
        try {
            const numValue = parseFloat(this.dialogInput.value);
            if (!isNaN(numValue)) {
                // Don't clamp values - allow any input value to be used
                let finalValue = numValue;
                
                // Flag if the value is outside the slider's normal range
                if (this.currentSlider.min !== undefined && this.currentSlider.max !== undefined) {
                    if (numValue < this.currentSlider.min || numValue > this.currentSlider.max) {
                        // Mark the slider as having an out-of-range value
                        this.currentSlider.outOfRange = true;
                    } else {
                        // Reset the flag if value is back in range
                        this.currentSlider.outOfRange = false;
                    }
                }
                
                // Update slider value (no clamping)
                this.currentSlider.value = finalValue;
                if (this.currentSlider.updateProperty) {
                    this.currentSlider.updateProperty(finalValue);
                }
            }
        } catch (e) {
            console.error("Error parsing number input:", e);
        }
        
        this.closeInputDialog();
    }
    
    // Close the input dialog without saving changes
    closeInputDialog() {
        if (this.inputDialog) {
            this.inputDialog.style.display = 'none';
        }
        if (this.inputDialogOverlay) {
            this.inputDialogOverlay.style.display = 'none';
        }
        this.currentSlider = null;
    }
    
    // Handle tab or panel visibility changes
    onHide() {
        // Close input dialog if open
        this.closeInputDialog();
        
        // Clear edit buttons when panel is hidden
        this.clearEditButtons();
    }
    
    onTabChange(tabId) {
        // Close input dialog if open
        this.closeInputDialog();
        
        // Re-register edit buttons for the new tab
        const sliders = this.getActiveSliders();
        if (sliders && Object.keys(sliders).length > 0) {
            this.registerEditButtons(sliders);
        }
    }


    
    // Register edit buttons for sliders
    registerEditButtons(sliders) {
        // First, clear any existing edit buttons
        this.clearEditButtons();
        
        Object.entries(sliders).forEach(([name, slider], index) => {
            if (!slider.options) { // Only for numeric sliders
                const sliderY = this.panelY + 100 + (index * 40);
                const btnX = this.panelX + 400;
                const btnY = sliderY - 2;
                const btnWidth = 45; // Wider button
                const btnHeight = 26; // Taller button
                
                const hoverId = `${slider.id}_edit`;
                
                // Register the edit button with input system
                this.game.input.registerElement(
                    hoverId,
                    {
                        bounds: () => ({
                            x: btnX - 2, // Add a bit more hit area
                            y: btnY - 2, // Add a bit more hit area
                            width: btnWidth + 4, // Add a bit more hit area
                            height: btnHeight + 4 // Add a bit more hit area
                        })
                    },
                    "debug"
                );
                
                this.inputFields.set(hoverId, { 
                    slider: slider, 
                    name: name,
                    x: btnX,
                    y: btnY,
                    width: btnWidth,
                    height: btnHeight
                });
            }
        });
    }


    
    // Clear all registered edit buttons
    clearEditButtons() {
        // Remove all buttons from the input system
        this.inputFields.forEach((info, id) => {
            this.game.input.removeElement(id, "debug");
        });
        
        // Clear the inputFields map
        this.inputFields.clear();
    }
}