// game/debug/materialdebugpanel.js
class MaterialDebugPanel extends BaseDebugPanel {
    constructor(debugCanvas, game) {
        const options = {
            panelId: "material",
            toggleId: "materialDebugToggle",
            defaultTab: "texture",
            toggleText: "Material Debug",
            toggleX: 440,
            toggleY: 10,
            toggleWidth: 130,
            toggleHeight: 30,
            panelWidth: 500,
            panelHeight: 650,
            panelX: 20,
            panelY: 50,
            tabs: [
                { id: "texture", label: "Per-Texture" },
                { id: "global", label: "Global" },
                { id: "presets", label: "Presets" }
            ]
        };

        super(debugCanvas, game, options);

        this.renderer = game.renderer3D || game.renderer;
        this.textureManager = this.renderer?.textureManager;
        this.textureRegistry = typeof textureRegistry !== "undefined" ? textureRegistry : null;

        this.debugPanelVisible = false;
        this.selectedTexture = this.textureRegistry?.textureList?.[0] || "grass";

        this.initializeControls();

        // Only register tabs in constructor
        // Other UI elements will be registered/unregistered based on active tab
        this.registerTabs();
        
        // Initialize UI for the default tab
        this.registerTabSpecificUI(this.activeTab);
    }

    updateMaterialSystem() {
        // Update the lighting constants with new material values
        if (this.game.renderer3D?.lightManager?.constants) {
            const materialConfig = this.game.renderer3D.lightManager.constants.MATERIAL;

            // Get global values from registry
            const globalProps = this.textureRegistry.defaultMaterialProperties;

            // Update lighting constants
            materialConfig.ROUGHNESS.value = globalProps.roughness;
            materialConfig.METALLIC.value = globalProps.metallic;
            materialConfig.BASE_REFLECTIVITY.value = globalProps.baseReflectivity;
        }

        // Always force material properties texture to update
        if (this.textureManager) {
            // Force dirty flag to true to ensure update happens
            this.textureManager.materialPropertiesDirty = true;
            this.textureManager.updateMaterialPropertiesTexture();
        }
    }

    initializeControls() {
        // Texture selection buttons in a grid
        this.textureButtons = [];
        if (this.textureRegistry?.textureList) {
            this.textureRegistry.textureList.forEach((textureName, index) => {
                this.textureButtons.push({
                    id: `selectTexture_${textureName}`,
                    label: textureName.charAt(0).toUpperCase() + textureName.slice(1),
                    x: this.panelX + 10 + (index % 3) * 160,
                    y: this.panelY + 60 + Math.floor(index / 3) * 40,
                    width: 150,
                    height: 35,
                    color: "#334455",
                    data: { textureName },
                    selected: false
                });
            });
        }

        // Per-texture sliders
        this.textureSliders = {
            Roughness: {
                value: 0.5,
                min: 0,
                max: 1,
                step: 0.01,
                id: "textureRoughness",
                updateProperty: (value) => this.updateTextureProperty("roughness", value)
            },
            Metallic: {
                value: 0.0,
                min: 0,
                max: 1,
                step: 0.01,
                id: "textureMetallic",
                updateProperty: (value) => this.updateTextureProperty("metallic", value)
            },
            "Base Reflectivity": {
                value: 0.5,
                min: 0,
                max: 1,
                step: 0.01,
                id: "textureBaseReflectivity",
                updateProperty: (value) => this.updateTextureProperty("baseReflectivity", value)
            }
        };

        // Global sliders
        const defaultProps = this.textureRegistry?.defaultMaterialProperties || {
            roughness: 0.2,
            metallic: 0.1,
            baseReflectivity: 0.5
        };

        this.globalSliders = {
            "Global Roughness": {
                value: defaultProps.roughness,
                min: 0,
                max: 1,
                step: 0.01,
                id: "globalRoughness",
                updateProperty: (value) => this.updateGlobalProperty("roughness", value)
            },
            "Global Metallic": {
                value: defaultProps.metallic,
                min: 0,
                max: 1,
                step: 0.01,
                id: "globalMetallic",
                updateProperty: (value) => this.updateGlobalProperty("metallic", value)
            },
            "Global Base Reflectivity": {
                value: defaultProps.baseReflectivity,
                min: 0,
                max: 1,
                step: 0.01,
                id: "globalBaseReflectivity",
                updateProperty: (value) => this.updateGlobalProperty("baseReflectivity", value)
            }
        };

        // Preset buttons in a grid
        this.presetButtons = [
            { id: "presetMetal", label: "Metal", properties: { roughness: 0.1, metallic: 1.0, baseReflectivity: 0.5 } },
            {
                id: "presetPlastic",
                label: "Plastic",
                properties: { roughness: 0.4, metallic: 0.0, baseReflectivity: 0.5 }
            },
            {
                id: "presetGlass",
                label: "Glass",
                properties: { roughness: 0.05, metallic: 0.0, baseReflectivity: 0.9 }
            },
            { id: "presetWood", label: "Wood", properties: { roughness: 0.8, metallic: 0.0, baseReflectivity: 0.2 } },
            {
                id: "presetWater",
                label: "Water",
                properties: { roughness: 0.05, metallic: 0.0, baseReflectivity: 0.8 }
            },
            { id: "presetStone", label: "Stone", properties: { roughness: 0.7, metallic: 0.05, baseReflectivity: 0.3 } }
        ];

        this.presetButtons.forEach((button, index) => {
            button.x = this.panelX + 10 + (index % 3) * 160;
            button.y = this.panelY + 60 + Math.floor(index / 3) * 50;
            button.width = 150;
            button.height = 40;
            button.color = "#4455aa";
        });

        // Action buttons
        this.actionButtons = [
            {
                id: "applyPresetToSelected",
                label: "Apply to Selected",
                x: this.panelX + 50,
                y: this.panelY + 300,
                width: 180,
                height: 40,
                color: "#55aa55"
            },
            {
                id: "applyPresetToAll",
                label: "Apply to All",
                x: this.panelX + 250,
                y: this.panelY + 300,
                width: 180,
                height: 40,
                color: "#aa5555"
            },
            {
                id: "resetTexture",
                label: "Reset to Global",
                x: this.panelX + 150,
                y: this.panelY + 570,
                width: 200,
                height: 40,
                color: "#aa8855"
            }
        ];
    }

    registerTabs() {
        this.tabs.forEach((tab, index) => {
            this.game.input.registerElement(
                `material_tab_${tab.id}`,
                {
                    bounds: () => ({
                        x: this.panelX + index * (this.panelWidth / this.tabs.length),
                        y: this.panelY,
                        width: this.panelWidth / this.tabs.length,
                        height: 30
                    })
                },
                "debug"
            );
        });
    }
    // Method to unregister all tab-specific UI elements 
    unregisterAllTabUI() {
        // Unregister texture buttons
        this.textureButtons.forEach((button) => {
            this.game.input.removeElement(button.id, "debug");
        });

        // Unregister texture sliders
        Object.entries(this.textureSliders).forEach(([name, slider]) => {
            this.game.input.removeElement(slider.id, "debug");
        });

        // Unregister global sliders
        Object.entries(this.globalSliders).forEach(([name, slider]) => {
            this.game.input.removeElement(slider.id, "debug");
        });

        // Unregister preset buttons
        this.presetButtons.forEach((button) => {
            this.game.input.removeElement(button.id, "debug");
        });

        // Unregister action buttons
        this.actionButtons.forEach((button) => {
            this.game.input.removeElement(button.id, "debug");
        });
    }

    // Method to register only UI elements specific to the active tab
    registerTabSpecificUI(tabId) {
        switch (tabId) {
            case "texture":
                this.registerTextureButtons();
                this.registerTextureSliders();
                // Only register the reset button for texture tab
                const resetButton = this.actionButtons.find(btn => btn.id === "resetTexture");
                if (resetButton) {
                    this.game.input.registerElement(
                        resetButton.id,
                        {
                            bounds: () => ({
                                x: resetButton.x,
                                y: resetButton.y,
                                width: resetButton.width,
                                height: resetButton.height
                            })
                        },
                        "debug"
                    );
                }
                break;
            case "global":
                this.registerGlobalSliders();
                break;
            case "presets":
                this.registerPresetButtons();
                // Register apply buttons for preset tab
                this.actionButtons.forEach((button) => {
                    if (button.id !== "resetTexture") {
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
                    }
                });
                break;
        }
    }
    
    // Override onTabChange from BaseDebugPanel
    onTabChange(tabId) {
        // Call parent method first
        super.onTabChange(tabId);
        
        // Unregister all tab-specific UI elements
        this.unregisterAllTabUI();
        
        // Register UI elements for the new active tab
        this.registerTabSpecificUI(tabId);
    }
    
    // Override onShow from BaseDebugPanel
    onShow() {
        super.onShow();
        
        // Ensure UI elements for the active tab are registered
        this.registerTabSpecificUI(this.activeTab);
    }
    
    // Override onHide from BaseDebugPanel
    onHide() {
        super.onHide();
        
        // Clean up all tab-specific UI elements
        this.unregisterAllTabUI();
    }

    registerTextureButtons() {
        this.textureButtons.forEach((button) => {
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

    registerTextureSliders() {
        // Register texture sliders
        Object.entries(this.textureSliders).forEach(([name, slider], index) => {
            this.game.input.registerElement(
                slider.id,
                {
                    bounds: () => ({
                        x: this.panelX + 160,
                        y: this.panelY + 380 + index * 50,
                        width: 200,
                        height: 25
                    })
                },
                "debug"
            );
        });
    }
    
    registerGlobalSliders() {
        // Register global sliders
        Object.entries(this.globalSliders).forEach(([name, slider], index) => {
            this.game.input.registerElement(
                slider.id,
                {
                    bounds: () => ({
                        x: this.panelX + 160,
                        y: this.panelY + 100 + index * 50,
                        width: 200,
                        height: 25
                    })
                },
                "debug"
            );
        });
    }

    registerPresetButtons() {
        this.presetButtons.forEach((button) => {
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

    update() {
        this.debugPanelVisible = this.game.showDebugPanel || false;

        if (!this.debugPanelVisible && this.visible) {
            this.visible = false;
        }

        if (this.debugPanelVisible) {
            super.update();
        }

        if (!this.visible) return;

        // Handle tab clicks - CRITICAL: this must happen before the switch statement
        this.tabs.forEach((tab) => {
            if (this.game.input.isElementJustPressed(`material_tab_${tab.id}`, "debug")) {
                this.activeTab = tab.id;
                // Call onTabChange to properly handle UI switching
                this.onTabChange(tab.id);
            }
        });

        // Handle the UI based on active tab
        switch (this.activeTab) {
            case "texture":
                // Handle texture selection
                this.textureButtons.forEach((button) => {
                    if (this.game.input.isElementJustPressed(button.id, "debug")) {
                        this.selectedTexture = button.data.textureName;
                        this.updateTextureSliderValues();

                        // Update button states
                        this.textureButtons.forEach((btn) => {
                            btn.color = btn.data.textureName === this.selectedTexture ? "#55aa55" : "#334455";
                        });
                    }
                });

                // Handle texture sliders
                this.handleOptionSliders(this.textureSliders);

                // Reset button
                if (this.game.input.isElementJustPressed("resetTexture", "debug")) {
                    this.resetTextureToDefault();
                }
                break;

            case "global":
                // Handle global sliders
                this.handleOptionSliders(this.globalSliders);
                break;

            case "presets":
                let selectedPreset = null;

                // Handle preset selection
                this.presetButtons.forEach((button) => {
                    if (this.game.input.isElementJustPressed(button.id, "debug")) {
                        selectedPreset = button.properties;

                        // Update preset button colors
                        this.presetButtons.forEach((btn) => {
                            btn.color = btn.id === button.id ? "#aa55aa" : "#4455aa";
                        });
                    }
                });

                // Apply preset buttons
                if (selectedPreset) {
                    if (this.game.input.isElementJustPressed("applyPresetToSelected", "debug")) {
                        this.applyPresetToTexture(this.selectedTexture, selectedPreset);
                    }
                    if (this.game.input.isElementJustPressed("applyPresetToAll", "debug")) {
                        this.applyPresetToAll(selectedPreset);
                    }
                }
                break;
        }
    }

    draw() {
        if (!this.debugPanelVisible) return;
        super.draw();
    }

    drawContent() {
        switch (this.activeTab) {
            case "texture":
                this.drawTextureControls();
                break;
            case "global":
                this.drawGlobalControls();
                break;
            case "presets":
                this.drawPresetControls();
                break;
        }
    }

    drawTextureControls() {
        // Title
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Select Texture", this.panelX + this.panelWidth / 2, this.panelY + 45);

        // Draw texture buttons
        this.textureButtons.forEach((button) => {
            this.ctx.fillStyle = button.color;
            this.ctx.fillRect(button.x, button.y, button.width, button.height);

            this.ctx.fillStyle = "#ffffff";
            this.ctx.textAlign = "center";
            this.ctx.font = "12px Arial";
            this.ctx.fillText(button.label, button.x + button.width / 2, button.y + button.height / 2 + 4);
        });

        // Selected texture info
        this.ctx.fillStyle = "#00ff00";
        this.ctx.font = "14px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText(`Selected: ${this.selectedTexture}`, this.panelX + this.panelWidth / 2, this.panelY + 300);

        // Material sliders
        this.ctx.fillStyle = "#ffff00";
        this.ctx.font = "14px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Material Properties", this.panelX + this.panelWidth / 2, this.panelY + 350);

        Object.entries(this.textureSliders).forEach(([name, slider], index) => {
            const y = this.panelY + 380 + index * 50;

            // Label
            this.ctx.fillStyle = "#cccccc";
            this.ctx.textAlign = "left";
            this.ctx.fillText(name, this.panelX + 20, y + 15);

            // Slider track
            this.ctx.fillStyle = "#555555";
            this.ctx.fillRect(this.panelX + 160, y, 200, 25);

            // Slider handle
            const handleX = this.panelX + 160 + (slider.value / (slider.max - slider.min)) * 200;
            this.ctx.fillStyle = "#88aaff";
            this.ctx.fillRect(handleX - 5, y, 10, 25);

            // Value display
            this.ctx.fillStyle = "#ffffff";
            this.ctx.textAlign = "right";
            this.ctx.fillText(slider.value.toFixed(2), this.panelX + 380, y + 15);
        });

        // Reset button
        const resetBtn = this.actionButtons.find((btn) => btn.id === "resetTexture");
        this.ctx.fillStyle = resetBtn.color;
        this.ctx.fillRect(resetBtn.x, resetBtn.y, resetBtn.width, resetBtn.height);
        this.ctx.fillStyle = "#ffffff";
        this.ctx.textAlign = "center";
        this.ctx.font = "14px Arial";
        this.ctx.fillText(resetBtn.label, resetBtn.x + resetBtn.width / 2, resetBtn.y + resetBtn.height / 2 + 4);
    }

    drawGlobalControls() {
        // Title
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Global Material Defaults", this.panelX + this.panelWidth / 2, this.panelY + 50);

        Object.entries(this.globalSliders).forEach(([name, slider], index) => {
            const y = this.panelY + 100 + index * 50;

            // Label
            this.ctx.fillStyle = "#cccccc";
            this.ctx.textAlign = "left";
            this.ctx.fillText(name, this.panelX + 20, y + 15);

            // Slider track
            this.ctx.fillStyle = "#555555";
            this.ctx.fillRect(this.panelX + 160, y, 200, 25);

            // Slider handle
            const handleX = this.panelX + 160 + (slider.value / (slider.max - slider.min)) * 200;
            this.ctx.fillStyle = "#88aaff";
            this.ctx.fillRect(handleX - 5, y, 10, 25);

            // Value display
            this.ctx.fillStyle = "#ffffff";
            this.ctx.textAlign = "right";
            this.ctx.fillText(slider.value.toFixed(2), this.panelX + 380, y + 15);
        });
    }

    drawPresetControls() {
        // Title
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Material Presets", this.panelX + this.panelWidth / 2, this.panelY + 45);

        // Draw preset buttons
        this.presetButtons.forEach((button) => {
            this.ctx.fillStyle = button.color;
            this.ctx.fillRect(button.x, button.y, button.width, button.height);

            this.ctx.fillStyle = "#ffffff";
            this.ctx.textAlign = "center";
            this.ctx.font = "14px Arial";
            this.ctx.fillText(button.label, button.x + button.width / 2, button.y + button.height / 2 + 4);
        });

        // Selected texture info
        this.ctx.fillStyle = "#00ff00";
        this.ctx.font = "14px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText(
            `Selected Texture: ${this.selectedTexture}`,
            this.panelX + this.panelWidth / 2,
            this.panelY + 250
        );

        // Apply buttons
        this.actionButtons.forEach((btn) => {
            if (btn.id !== "resetTexture") {
                this.ctx.fillStyle = btn.color;
                this.ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
                this.ctx.fillStyle = "#ffffff";
                this.ctx.textAlign = "center";
                this.ctx.font = "14px Arial";
                this.ctx.fillText(btn.label, btn.x + btn.width / 2, btn.y + btn.height / 2 + 4);
            }
        });

        // Instructions
        this.ctx.fillStyle = "#aaaaaa";
        this.ctx.font = "12px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText(
            "1. Click a preset, 2. Click apply target",
            this.panelX + this.panelWidth / 2,
            this.panelY + 360
        );
    }

    // Update methods
    updateTextureProperty(property, value) {
        if (!this.selectedTexture || !this.textureRegistry) return;

        const props = {};
        props[property] = value;

        this.textureRegistry.setMaterialProperties(this.selectedTexture, props);

        if (this.textureManager) {
            this.textureManager.updateMaterialPropertiesTexture();
        }
        this.updateMaterialSystem();
    }

    updateGlobalProperty(property, value) {
        if (!this.textureRegistry) return;

        const props = {};
        props[property] = value;

        this.textureRegistry.setDefaultMaterialProperties(props);

        if (this.textureManager) {
            this.textureManager.updateMaterialPropertiesTexture();
        }
        this.updateMaterialSystem();
    }

    updateTextureSliderValues() {
        if (!this.selectedTexture || !this.textureRegistry) return;

        const props = this.textureRegistry.getMaterialProperties(this.selectedTexture);

        this.textureSliders["Roughness"].value = props.roughness;
        this.textureSliders["Metallic"].value = props.metallic;
        this.textureSliders["Base Reflectivity"].value = props.baseReflectivity;
    }

    resetTextureToDefault() {
        if (!this.selectedTexture || !this.textureRegistry) return;

        this.textureRegistry.setMaterialProperties(
            this.selectedTexture,
            this.textureRegistry.defaultMaterialProperties
        );

        this.updateTextureSliderValues();

        if (this.textureManager) {
            this.textureManager.updateMaterialPropertiesTexture();
        }
    }

    applyPresetToTexture(textureName, properties) {
        if (!textureName || !this.textureRegistry) return;

        this.textureRegistry.setMaterialProperties(textureName, properties);

        if (textureName === this.selectedTexture) {
            this.updateTextureSliderValues();
        }

        if (this.textureManager) {
            this.textureManager.updateMaterialPropertiesTexture();
        }
    }

    applyPresetToAll(properties) {
        if (!this.textureRegistry) return;

        this.textureRegistry.textureList.forEach((textureName) => {
            this.textureRegistry.setMaterialProperties(textureName, properties);
        });

        this.updateTextureSliderValues();

        if (this.textureManager) {
            this.textureManager.updateMaterialPropertiesTexture();
        }
    }

    getActiveSliders() {
        switch (this.activeTab) {
            case "texture":
                return this.textureSliders;
            case "global":
                return this.globalSliders;
            default:
                return {};
        }
    }
}