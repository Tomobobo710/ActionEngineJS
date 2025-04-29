// game/debug/lightingdebugpanel.js
class LightingDebugPanel extends BaseDebugPanel {
    constructor(debugCanvas, game) {
        // Configure panel options
        const options = {
            panelId: 'lighting',
            toggleId: 'lightingToggleButton',
            defaultTab: 'light',
            toggleText: 'Lighting Settings',
            toggleX: 280, // Position to the left for better visibility
            toggleY: 10,
            toggleWidth: 150,
            toggleHeight: 30,
            panelWidth: 450,
            panelHeight: 500,
            panelX: 20, // Position on left side // Center horizontally
            panelY: 50,
            tabs: [
                { id: 'light', label: 'Light' },
                { id: 'shadow', label: 'Shadows' },
                { id: 'material', label: 'Material' },
                { id: 'debug', label: 'Debug' },
                { id: 'settings', label: 'Config' }
            ]
        };
        
        // Call parent constructor before accessing this
        super(debugCanvas, game, options);
        
        // Get reference to lighting constants - AFTER super() call
        this.constants = lightingConstants;
        
        // Initialize debug panel state if available
        if (this.game.debugPanel) {
            this.game.debugPanel.lightingPanelVisible = false;
        }
        
        // Reference to check if the main debug panel is visible
        this.debugPanelVisible = false;
        
        // Set up light sliders
        this.lightSliders = {
            "Position X": {
                value: this.constants.LIGHT_POSITION.x,
                min: this.constants.LIGHT_POSITION.min,
                max: this.constants.LIGHT_POSITION.max,
                id: "lightPosX",
                updateProperty: (value) => { this.constants.LIGHT_POSITION.x = value; }
            },
            "Position Y": {
                value: this.constants.LIGHT_POSITION.y,
                min: this.constants.LIGHT_POSITION.min,
                max: this.constants.LIGHT_POSITION.max,
                id: "lightPosY",
                updateProperty: (value) => { this.constants.LIGHT_POSITION.y = value; }
            },
            "Position Z": {
                value: this.constants.LIGHT_POSITION.z,
                min: this.constants.LIGHT_POSITION.min,
                max: this.constants.LIGHT_POSITION.max,
                id: "lightPosZ",
                updateProperty: (value) => { this.constants.LIGHT_POSITION.z = value; }
            },
            "Direction X": {
                value: this.constants.LIGHT_DIRECTION.x,
                min: this.constants.LIGHT_DIRECTION.min,
                max: this.constants.LIGHT_DIRECTION.max,
                id: "lightDirX",
                updateProperty: (value) => { this.constants.LIGHT_DIRECTION.x = value; }
            },
            "Direction Y": {
                value: this.constants.LIGHT_DIRECTION.y,
                min: this.constants.LIGHT_DIRECTION.min,
                max: this.constants.LIGHT_DIRECTION.max,
                id: "lightDirY",
                updateProperty: (value) => { this.constants.LIGHT_DIRECTION.y = value; }
            },
            "Direction Z": {
                value: this.constants.LIGHT_DIRECTION.z,
                min: this.constants.LIGHT_DIRECTION.min,
                max: this.constants.LIGHT_DIRECTION.max,
                id: "lightDirZ",
                updateProperty: (value) => { this.constants.LIGHT_DIRECTION.z = value; }
            },
            "Intensity": {
                value: this.constants.LIGHT_INTENSITY.value,
                min: this.constants.LIGHT_INTENSITY.min,
                max: this.constants.LIGHT_INTENSITY.max,
                id: "lightIntensity",
                updateProperty: (value) => { this.constants.LIGHT_INTENSITY.value = value; }
            }
        };
        
        // Set up shadow control sliders
        this.shadowSliders = {
            "Map Size": {
                value: this.constants.SHADOW_MAP.SIZE.value,
                options: this.constants.SHADOW_MAP.SIZE.options,
                currentOption: this.constants.SHADOW_MAP.SIZE.options.indexOf(this.constants.SHADOW_MAP.SIZE.value),
                id: "shadowMapSize",
                updateProperty: (value) => { this.constants.SHADOW_MAP.SIZE.value = value; }
            },
            "Bias": {
                value: this.constants.SHADOW_MAP.BIAS.value,
                min: this.constants.SHADOW_MAP.BIAS.min,
                max: this.constants.SHADOW_MAP.BIAS.max,
                step: this.constants.SHADOW_MAP.BIAS.step,
                id: "shadowBias",
                updateProperty: (value) => { this.constants.SHADOW_MAP.BIAS.value = value; }
            },
            "Left Bound": {
                value: this.constants.SHADOW_PROJECTION.LEFT.value,
                min: this.constants.SHADOW_PROJECTION.LEFT.min,
                max: this.constants.SHADOW_PROJECTION.LEFT.max,
                step: this.constants.SHADOW_PROJECTION.LEFT.step,
                id: "shadowLeft",
                updateProperty: (value) => { this.constants.SHADOW_PROJECTION.LEFT.value = value; }
            },
            "Right Bound": {
                value: this.constants.SHADOW_PROJECTION.RIGHT.value,
                min: this.constants.SHADOW_PROJECTION.RIGHT.min,
                max: this.constants.SHADOW_PROJECTION.RIGHT.max,
                step: this.constants.SHADOW_PROJECTION.RIGHT.step,
                id: "shadowRight",
                updateProperty: (value) => { this.constants.SHADOW_PROJECTION.RIGHT.value = value; }
            },
            "Bottom Bound": {
                value: this.constants.SHADOW_PROJECTION.BOTTOM.value,
                min: this.constants.SHADOW_PROJECTION.BOTTOM.min,
                max: this.constants.SHADOW_PROJECTION.BOTTOM.max,
                step: this.constants.SHADOW_PROJECTION.BOTTOM.step,
                id: "shadowBottom",
                updateProperty: (value) => { this.constants.SHADOW_PROJECTION.BOTTOM.value = value; }
            },
            "Top Bound": {
                value: this.constants.SHADOW_PROJECTION.TOP.value,
                min: this.constants.SHADOW_PROJECTION.TOP.min,
                max: this.constants.SHADOW_PROJECTION.TOP.max,
                step: this.constants.SHADOW_PROJECTION.TOP.step,
                id: "shadowTop",
                updateProperty: (value) => { this.constants.SHADOW_PROJECTION.TOP.value = value; }
            },
            "Near Plane": {
                value: this.constants.SHADOW_PROJECTION.NEAR.value,
                min: this.constants.SHADOW_PROJECTION.NEAR.min,
                max: this.constants.SHADOW_PROJECTION.NEAR.max,
                step: this.constants.SHADOW_PROJECTION.NEAR.step,
                id: "shadowNear",
                updateProperty: (value) => { this.constants.SHADOW_PROJECTION.NEAR.value = value; }
            },
            "Far Plane": {
                value: this.constants.SHADOW_PROJECTION.FAR.value,
                min: this.constants.SHADOW_PROJECTION.FAR.min,
                max: this.constants.SHADOW_PROJECTION.FAR.max,
                step: this.constants.SHADOW_PROJECTION.FAR.step,
                id: "shadowFar",
                updateProperty: (value) => { this.constants.SHADOW_PROJECTION.FAR.value = value; }
            },
            "Target Distance": {
                value: this.constants.SHADOW_PROJECTION.DISTANCE_MULTIPLIER.value,
                min: this.constants.SHADOW_PROJECTION.DISTANCE_MULTIPLIER.min,
                max: this.constants.SHADOW_PROJECTION.DISTANCE_MULTIPLIER.max,
                step: this.constants.SHADOW_PROJECTION.DISTANCE_MULTIPLIER.step,
                id: "shadowTargetDistance",
                updateProperty: (value) => { this.constants.SHADOW_PROJECTION.DISTANCE_MULTIPLIER.value = value; }
            },
            "Softness": {
                value: this.constants.SHADOW_FILTERING.SOFTNESS.value,
                min: this.constants.SHADOW_FILTERING.SOFTNESS.min,
                max: this.constants.SHADOW_FILTERING.SOFTNESS.max,
                step: this.constants.SHADOW_FILTERING.SOFTNESS.step,
                id: "shadowSoftness",
                updateProperty: (value) => { this.constants.SHADOW_FILTERING.SOFTNESS.value = value; }
            },
            "PCF Size": {
                value: this.constants.SHADOW_FILTERING.PCF.SIZE.value,
                options: this.constants.SHADOW_FILTERING.PCF.SIZE.options,
                currentOption: this.constants.SHADOW_FILTERING.PCF.SIZE.options.indexOf(this.constants.SHADOW_FILTERING.PCF.SIZE.value),
                id: "shadowPCFSize",
                updateProperty: (value) => { this.constants.SHADOW_FILTERING.PCF.SIZE.value = value; }
            }
        };
        
        // Material property sliders
        this.materialSliders = {
            "Roughness": {
                value: this.constants.MATERIAL.ROUGHNESS.value,
                min: this.constants.MATERIAL.ROUGHNESS.min,
                max: this.constants.MATERIAL.ROUGHNESS.max,
                id: "materialRoughness",
                updateProperty: (value) => { this.constants.MATERIAL.ROUGHNESS.value = value; }
            },
            "Metallic": {
                value: this.constants.MATERIAL.METALLIC.value,
                min: this.constants.MATERIAL.METALLIC.min,
                max: this.constants.MATERIAL.METALLIC.max,
                id: "materialMetallic",
                updateProperty: (value) => { this.constants.MATERIAL.METALLIC.value = value; }
            },
            "Base Reflectivity": {
                value: this.constants.MATERIAL.BASE_REFLECTIVITY.value,
                min: this.constants.MATERIAL.BASE_REFLECTIVITY.min,
                max: this.constants.MATERIAL.BASE_REFLECTIVITY.max,
                id: "materialBaseReflectivity",
                updateProperty: (value) => { this.constants.MATERIAL.BASE_REFLECTIVITY.value = value; }
            }
        };
        
        // Shadow quality presets
        this.shadowQualityPresets = this.constants.SHADOW_QUALITY_PRESETS.map((preset, index) => {
            return {
                id: `shadowQualityPreset${index}`,
                name: preset.name,
                index: index
            };
        });
        
        // Config buttons
        this.configButtons = [
            {
                id: "saveConfig",
                label: "Save Config",
                x: this.panelX + 50,
                y: this.panelY + 100,
                width: 140,
                height: 40,
                color: "#3355aa"
            },
            {
                id: "loadConfig",
                label: "Load Config",
                x: this.panelX + 210,
                y: this.panelY + 100,
                width: 140,
                height: 40,
                color: "#3355aa"
            },
            {
                id: "resetConfig",
                label: "Reset to Defaults",
                x: this.panelX + 50,
                y: this.panelY + 160,
                width: 300,
                height: 40,
                color: "#aa3355"
            }
        ];
        
        // Debug toggles
        this.debugToggles = [
            {
                id: "debugVisualizeShadowMap",
                label: "Show Shadow Map",
                checked: this.constants.DEBUG.VISUALIZE_SHADOW_MAP,
                updateProperty: (value) => { 
                    this.constants.DEBUG.VISUALIZE_SHADOW_MAP = value; 
                    
                    // Reset debug state when enabling shadow map visualization
                    if (value && this.game.renderer3D && this.game.renderer3D.shadowManager) {
                        this.game.renderer3D.shadowManager.resetDebugState();
                    }
                }
            },
            {
                id: "debugAnalyzeShadowMap",
                label: "Analyze Shadow Map",
                checked: false,
                updateProperty: (value) => { 
                    // This is a button, not a toggle
                    if (value && this.game.renderer3D && this.game.renderer3D.shadowManager) {
                        this.shadowMapAnalysisResults = this.game.renderer3D.shadowManager.debugAnalyzeShadowMap();
                        console.log('Shadow Map Analysis Results:', this.shadowMapAnalysisResults);
                    }
                    // Reset to unchecked after analysis
                    return false;
                }
            },
            {
                id: "debugVisualizeFrustum",
                label: "Show Light Frustum",
                checked: this.constants.DEBUG.VISUALIZE_FRUSTUM,
                updateProperty: (value) => { this.constants.DEBUG.VISUALIZE_FRUSTUM = value; }
            },
            {
                id: "shadowAutoFit",
                label: "Auto-fit Shadow Frustum",
                checked: this.constants.SHADOW_PROJECTION.AUTO_FIT,
                updateProperty: (value) => { this.constants.SHADOW_PROJECTION.AUTO_FIT = value; }
            },
            {
                id: "shadowFilteringEnabled",
                label: "Enable Shadow Filtering",
                checked: this.constants.SHADOW_FILTERING.ENABLED,
                updateProperty: (value) => { this.constants.SHADOW_FILTERING.ENABLED = value; }
            },
            {
                id: "shadowPCFEnabled",
                label: "Enable PCF Filtering",
                checked: this.constants.SHADOW_FILTERING.PCF.ENABLED,
                updateProperty: (value) => { this.constants.SHADOW_FILTERING.PCF.ENABLED = value; }
            },
            {
                id: "debugForceShadowMapTest",
                label: "Force Shadow Map Test Area",
                checked: false,
                updateProperty: (value) => { 
                    // Store this in a new property in the constants object
                    this.constants.DEBUG.FORCE_SHADOW_MAP_TEST = value; 
                }
            }
        ];
        
        // NOTE: We don't need to define toggleButton here as it's already set in BaseDebugPanel constructor
        // based on the options we provided (toggleX, toggleY, etc.)
        
        // Register toggle button with input system
        this.game.input.registerElement(
            "lightingToggleButton",
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
        
        // Register the tab buttons
        this.tabs.forEach((tab, index) => {
            this.game.input.registerElement(
                `lightingTab_${tab.id}`,
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
        
        // Register all sliders with input system
        this.registerSliders(this.lightSliders, "light");
        this.registerSliders(this.shadowSliders, "shadow");
        this.registerSliders(this.materialSliders, "material");
        
        // Register shadow quality preset buttons
        this.shadowQualityPresets.forEach((preset, index) => {
            this.game.input.registerElement(
                preset.id,
                {
                    bounds: () => ({
                        x: this.panelX + 120 + (index * 70),
                        y: this.panelY + 70,
                        width: 60,
                        height: 25
                    })
                },
                "debug"
            );
        });
        
        // Register debug toggles
        this.debugToggles.forEach((toggle, index) => {
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
        
        // Register config buttons
        this.configButtons.forEach((button) => {
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
        
        // Create file input element for loading configs
        this.createFileInputElement();
    }
    
    drawSettingsControls() {
        // Title
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Configuration Settings", this.panelX + this.panelWidth / 2, this.panelY + 50);
        
        // Description
        this.ctx.font = "14px Arial";
        this.ctx.fillText("Save, load, or reset lighting configuration", this.panelX + this.panelWidth / 2, this.panelY + 70);
        
        // Draw buttons using base class method
        this.drawButtons(this.configButtons);
        
        // Display note about file saving
        this.ctx.fillStyle = "#aaaaaa";
        this.ctx.font = "12px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Configuration files are saved as JSON", this.panelX + this.panelWidth / 2, this.panelY + 220);
        this.ctx.fillText("and can be edited manually if needed", this.panelX + this.panelWidth / 2, this.panelY + 240);
    }
    
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
    
    syncWithConstants() {
        // Update slider values from constants
        // Light tab
        this.lightSliders["Position X"].value = this.constants.LIGHT_POSITION.x;
        this.lightSliders["Position Y"].value = this.constants.LIGHT_POSITION.y;
        this.lightSliders["Position Z"].value = this.constants.LIGHT_POSITION.z;
        this.lightSliders["Direction X"].value = this.constants.LIGHT_DIRECTION.x;
        this.lightSliders["Direction Y"].value = this.constants.LIGHT_DIRECTION.y;
        this.lightSliders["Direction Z"].value = this.constants.LIGHT_DIRECTION.z;
        this.lightSliders["Intensity"].value = this.constants.LIGHT_INTENSITY.value;
        
        // Shadow tab
        this.shadowSliders["Map Size"].value = this.constants.SHADOW_MAP.SIZE.value;
        this.shadowSliders["Map Size"].currentOption = this.constants.SHADOW_MAP.SIZE.options.indexOf(this.constants.SHADOW_MAP.SIZE.value);
        this.shadowSliders["Bias"].value = this.constants.SHADOW_MAP.BIAS.value;
        this.shadowSliders["Left Bound"].value = this.constants.SHADOW_PROJECTION.LEFT.value;
        this.shadowSliders["Right Bound"].value = this.constants.SHADOW_PROJECTION.RIGHT.value;
        this.shadowSliders["Bottom Bound"].value = this.constants.SHADOW_PROJECTION.BOTTOM.value;
        this.shadowSliders["Top Bound"].value = this.constants.SHADOW_PROJECTION.TOP.value;
        this.shadowSliders["Near Plane"].value = this.constants.SHADOW_PROJECTION.NEAR.value;
        this.shadowSliders["Far Plane"].value = this.constants.SHADOW_PROJECTION.FAR.value;
        this.shadowSliders["Target Distance"].value = this.constants.SHADOW_PROJECTION.DISTANCE_MULTIPLIER.value;
        this.shadowSliders["Softness"].value = this.constants.SHADOW_FILTERING.SOFTNESS.value;
        this.shadowSliders["PCF Size"].value = this.constants.SHADOW_FILTERING.PCF.SIZE.value;
        this.shadowSliders["PCF Size"].currentOption = this.constants.SHADOW_FILTERING.PCF.SIZE.options.indexOf(this.constants.SHADOW_FILTERING.PCF.SIZE.value);
        
        // Material tab
        this.materialSliders["Roughness"].value = this.constants.MATERIAL.ROUGHNESS.value;
        this.materialSliders["Metallic"].value = this.constants.MATERIAL.METALLIC.value;
        this.materialSliders["Base Reflectivity"].value = this.constants.MATERIAL.BASE_REFLECTIVITY.value;
        
        // Debug toggles
        this.debugToggles.forEach(toggle => {
            if (toggle.id === "debugVisualizeShadowMap") toggle.checked = this.constants.DEBUG.VISUALIZE_SHADOW_MAP;
            if (toggle.id === "debugVisualizeFrustum") toggle.checked = this.constants.DEBUG.VISUALIZE_FRUSTUM;
            if (toggle.id === "shadowAutoFit") toggle.checked = this.constants.SHADOW_PROJECTION.AUTO_FIT;
            if (toggle.id === "shadowFilteringEnabled") toggle.checked = this.constants.SHADOW_FILTERING.ENABLED;
            if (toggle.id === "shadowPCFEnabled") toggle.checked = this.constants.SHADOW_FILTERING.PCF.ENABLED;
        });
    }
    
    createFileInputElement() {
        // Create a hidden file input element
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = '.json';
        this.fileInput.style.display = 'none';
        document.body.appendChild(this.fileInput);
        
        // Add event listener for file loading
        this.fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const config = JSON.parse(e.target.result);
                    this.constants.importConfig(config);
                    this.syncWithConstants();
                    console.log("Lighting configuration loaded successfully");
                } catch (error) {
                    console.error("Error loading lighting configuration:", error);
                }
            };
            reader.readAsText(file);
        });
    }
    
    saveConfigToFile() {
        const config = this.constants.exportConfig();
        const dataStr = JSON.stringify(config, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        
        const exportName = `lighting_config_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportName);
        linkElement.click();
        linkElement.remove();
        
        console.log("Lighting configuration saved to file");
    }
    
    loadConfigFromFile() {
        // Trigger file input click
        this.fileInput.click();
    }
    
    resetConfigToDefaults() {
        // Create a new instance of LightingConstants to get defaults
        const defaultConstants = new LightingConstants();
        // Import the default config
        this.constants.importConfig(defaultConstants.exportConfig());
        // Update UI to reflect changes
        this.syncWithConstants();
        console.log("Lighting configuration reset to defaults");
    }
    
    // Override from BaseDebugPanel
    onShow() {
        // Update the debug panel with our visibility state if available
        if (this.game.debugPanel) {
            this.game.debugPanel.lightingPanelVisible = true;
        }
        
        // Re-register sliders for active tab
        switch (this.activeTab) {
            case 'light': this.registerSliders(this.lightSliders, "light"); break;
            case 'shadow': this.registerSliders(this.shadowSliders, "shadow"); break;
            case 'material': this.registerSliders(this.materialSliders, "material"); break;
        }
    }
    
    // Override from BaseDebugPanel
    onHide() {
        // Update the debug panel with our visibility state if available
        if (this.game.debugPanel) {
            this.game.debugPanel.lightingPanelVisible = false;
        }
    }
    
    // Override from BaseDebugPanel
    onTabChange(tabId) {
        // Re-register sliders for new active tab
        switch (tabId) {
            case 'light': this.registerSliders(this.lightSliders, "light"); break;
            case 'shadow': this.registerSliders(this.shadowSliders, "shadow"); break;
            case 'material': this.registerSliders(this.materialSliders, "material"); break;
        }
    }
    
    // Override from BaseDebugPanel
    update() {
        // Update debug panel visibility state (we only show our button when the debug panel is open)
        this.debugPanelVisible = this.game.showDebugPanel || false;
        
        // If debug panel is closed, ensure our panel is also closed
        if (!this.debugPanelVisible && this.visible) {
            this.visible = false;
            
            // Update the debug panel with our visibility state if available
            if (this.game.debugPanel) {
                this.game.debugPanel.lightingPanelVisible = false;
            }
        }
        
        // Only process input if debug panel is visible
        if (this.debugPanelVisible) {
            // Call parent update which handles toggle button and tabs
            super.update();
        }
        
        // If panel isn't visible, no need to check other inputs
        if (!this.visible) return;
        
        // Handle shadow quality preset buttons
        if (this.activeTab === 'shadow') {
            this.shadowQualityPresets.forEach(preset => {
                if (this.game.input.isElementJustPressed(preset.id, "debug")) {
                    // Apply preset through constants directly
                    this.constants.applyShadowQualityPreset(preset.index);
                    // Update UI to reflect changes
                    this.syncWithConstants();
                }
            });
        }
        
        // Handle debug toggles
        if (this.activeTab === 'debug') {
            this.debugToggles.forEach(toggle => {
                if (this.game.input.isElementJustPressed(toggle.id, "debug")) {
                    toggle.checked = !toggle.checked;
                    toggle.updateProperty(toggle.checked);
                }
            });
        }
        
        // Handle config buttons
        if (this.activeTab === 'settings') {
            // Save config button
            if (this.game.input.isElementJustPressed("saveConfig", "debug")) {
                this.saveConfigToFile();
            }
            
            // Load config button
            if (this.game.input.isElementJustPressed("loadConfig", "debug")) {
                this.loadConfigFromFile();
            }
            
            // Reset config button
            if (this.game.input.isElementJustPressed("resetConfig", "debug")) {
                this.resetConfigToDefaults();
            }
        }

        // Handle option sliders based on current tab
        let sliders = null;
        switch (this.activeTab) {
            case 'light': sliders = this.lightSliders; break;
            case 'shadow': sliders = this.shadowSliders; break;
            case 'material': sliders = this.materialSliders; break;
            default: sliders = null;
        }
        
        if (sliders) {
            this.handleOptionSliders(sliders);
        }

        // Update game systems with any changes
        this.updateGameSystems();
    }

    // This method is now handled in the base class and referenced directly in updateContent
    
    updateGameSystems() {
        // Update lighting manager
        if (this.game.renderer3D && this.game.renderer3D.lightingManager) {
            this.game.renderer3D.lightingManager.syncWithConstants();
        }
        
        // Update shadow manager
        if (this.game.renderer3D && this.game.renderer3D.shadowManager) {
            this.game.renderer3D.shadowManager.syncWithConstants();
        }
    }
    
    // Override from BaseDebugPanel
    draw() {
        // Only draw if debug panel is visible
        if (!this.debugPanelVisible) return;
        
        // Call parent draw which handles background, tabs, etc.
        super.draw();
    }
    
    // Override from BaseDebugPanel
    drawContent() {
        // Draw content based on active tab
        switch (this.activeTab) {
            case 'light': this.drawLightControls(); break;
            case 'shadow': this.drawShadowControls(); break;
            case 'material': this.drawMaterialControls(); break;
            case 'debug': this.drawDebugControls(); break;
            case 'settings': this.drawSettingsControls(); break;
        }
    }
    
    // These methods are now in the base class and can be removed
    
    drawLightControls() {
        // Title
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Light Settings", this.panelX + this.panelWidth / 2, this.panelY + 50);
        
        // Draw sliders using base class method
        super.drawSliders(this.lightSliders);
    }
    
    drawShadowControls() {
        // Title
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Shadow Settings", this.panelX + this.panelWidth / 2, this.panelY + 50);
        
        // Draw quality preset buttons
        this.ctx.font = "14px Arial";
        this.ctx.textAlign = "left";
        this.ctx.fillText("Presets:", this.panelX + 40, this.panelY + 80);
        
        this.shadowQualityPresets.forEach((preset, index) => {
            const btnX = this.panelX + 120 + (index * 70);
            const btnY = this.panelY + 70;
            const isHovered = this.game.input.isElementHovered(preset.id, "debug");
            
            // Button background
            this.ctx.fillStyle = isHovered ? "#558855" : "#335533";
            this.ctx.fillRect(btnX, btnY, 60, 25);
            
            // Button text
            this.ctx.fillStyle = "#ffffff";
            this.ctx.textAlign = "center";
            this.ctx.fillText(preset.name, btnX + 30, btnY + 14);
        });
        
        // Draw sliders using base class method
        super.drawSliders(this.shadowSliders);
    }
    
    drawMaterialControls() {
        // Title
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Material Settings", this.panelX + this.panelWidth / 2, this.panelY + 50);
        
        // Draw sliders using base class method
        super.drawSliders(this.materialSliders);
    }
    
    drawDebugControls() {
        // Title
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Debug Settings", this.panelX + this.panelWidth / 2, this.panelY + 50);
        
        // Draw toggles using base class method
        this.drawToggles(this.debugToggles);
        
        // Display shadow map analysis results if available
        if (this.shadowMapAnalysisResults) {
            this.ctx.fillStyle = "#aaffaa";
            this.ctx.font = "12px Arial";
            this.ctx.textAlign = "left";
            
            const resultsY = this.panelY + 100 + (this.debugToggles.length * 30) + 20;
            
            this.ctx.fillText("Shadow Map Analysis Results:", this.panelX + 20, resultsY);
            
            if (this.shadowMapAnalysisResults.error) {
                this.ctx.fillStyle = "#ffaaaa";
                this.ctx.fillText(`Error: ${this.shadowMapAnalysisResults.error}`, this.panelX + 30, resultsY + 20);
            } else {
                let lineY = resultsY + 20;
                
                // Draw results for each sample position
                Object.entries(this.shadowMapAnalysisResults).forEach(([position, values]) => {
                    this.ctx.fillStyle = "#ccffcc";
                    this.ctx.fillText(`${position}: R=${values.r.toFixed(4)} G=${values.g.toFixed(4)} B=${values.b.toFixed(4)} A=${values.a.toFixed(4)}`, 
                        this.panelX + 30, lineY);
                    lineY += 15;
                });
                
                // Display analysis notes
                if (Object.values(this.shadowMapAnalysisResults).every(val => val.r === 1)) {
                    this.ctx.fillStyle = "#ffaaaa";
                    this.ctx.fillText("All shadow map values are 1.0 - No depth information is being written!", 
                        this.panelX + 30, lineY + 10);
                } else if (Object.values(this.shadowMapAnalysisResults).every(val => val.r === 0)) {
                    this.ctx.fillStyle = "#ffaaaa";
                    this.ctx.fillText("All shadow map values are 0.0 - Depth information may be incorrect!", 
                        this.panelX + 30, lineY + 10);
                } else {
                    this.ctx.fillStyle = "#aaffaa";
                    this.ctx.fillText("Shadow map contains varying depth values (This is good!)", 
                        this.panelX + 30, lineY + 10);
                }
            }
        }
    }
    
    // These methods are now in the base class and can be removed
}