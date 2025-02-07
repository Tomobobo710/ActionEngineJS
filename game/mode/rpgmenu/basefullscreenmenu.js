class BaseFullScreenMenu {
    constructor(ctx, input, gameMaster) {
        this.ctx = ctx;
        this.input = input;
        this.gameMaster = gameMaster;

        this.containers = new Map();
        this.elements = new Map();
        this.focusableElements = [];
        this.currentFocus = null;

        // Back button
        this.backButtonRegistered = false;
        this.backButtonSize = 30;

        this.createGradient = this.gameMaster.modeManager.activeMode.createGradient.bind(
            this.gameMaster.modeManager.activeMode
        );
        this.colors = this.gameMaster.modeManager.activeMode.colors;

        // Create the main container by default
        this.createContainer("main", {
            x: 0,
            y: 0,
            width: Game.WIDTH,
            height: Game.HEIGHT
        });
    }

    registerBackButton(bounds) {
        if (!this.backButtonRegistered) {
            const backButtonX = Game.WIDTH - 35;
            const backButtonY = 5;
            this.input.registerElement("back_button", {
                bounds: () => ({
                    x: backButtonX,
                    y: backButtonY,
                    width: this.backButtonSize,
                    height: this.backButtonSize
                })
            });
            this.backButtonRegistered = true;
        }
    }

    createContainer(id, config) {
        const container = {
            id,
            x: config.x,
            y: config.y,
            width: config.width,
            height: config.height,
            elements: [],
            visible: true
        };

        this.containers.set(id, container);
        return container;
    }

    handleMouseInput() {
        // Back button check
        if (this.input.isElementJustPressed("back_button")) {
            return "exit";
        }

        // Reset hover states
        let foundHover = false;
        this.containers.forEach((container) => {
            if (!container.visible) return;

            container.elements.forEach((element) => {
                if (!element.visible || !element.focusable) return;

                if (this.input.isElementHovered(`menu_element_${element.name}`)) {
                    foundHover = true;
                    // Update currentFocus and selection on hover
                    if (this.currentFocus !== element) {
                        if (this.currentFocus) {
                            this.currentFocus.selected = false;
                        }
                        this.currentFocus = element;
                        element.selected = true;
                    }

                    // Handle click
                    if (this.input.isElementJustPressed(`menu_element_${element.name}`)) {
                        if (element.onChange) {
                            element.onChange(element.value);
                        }
                    }
                }
            });
        });

        // If we're not hovering any element, keep the current selection
        if (!foundHover && this.currentFocus) {
            this.currentFocus.selected = true;
        }
    }

    addElement(containerId, config) {
        const element = {
            // Base properties
            name: config.name,
            type: config.type,
            x: config.x || 0,
            y: config.y || 0,
            width: config.width || 50,
            height: config.height || 50,
            text: config.text || "",
            value: config.value,
            focusable: config.focusable || false,
            selected: false,
            visible: true,
            onChange: config.onChange,

            // Highlight config
            highlight: {
                width: config.highlight?.width || config.width + 10,
                height: config.highlight?.height || 30,
                xOffset: config.highlight?.xOffset || 0,
                yOffset: config.highlight?.yOffset || 0,
                glow: config.highlight?.glow || 15
            },

            // Slider config
            slider:
                config.type === "slider"
                    ? {
                          trackX: config.slider?.trackX || 0,
                          trackY: config.slider?.trackY || 0,
                          trackWidth: config.slider?.trackWidth || 200,
                          trackHeight: config.slider?.trackHeight || 4,
                          knobX: config.slider?.knobX || 0,
                          knobY: config.slider?.knobY || 0,
                          knobSize: config.slider?.knobSize || 20,
                          glowRadius: config.slider?.glowRadius || 15,
                          roundness: config.slider?.roundness || 2
                      }
                    : null,

            // Toggle config
            toggle:
                config.type === "toggle"
                    ? {
                          x: config.toggle?.x || 0,
                          y: config.toggle?.y || 0,
                          width: config.toggle?.width || 60,
                          height: config.toggle?.height || 30,
                          knobX: config.toggle?.knobX || 0,
                          knobY: config.toggle?.knobY || 0,
                          knobSize: config.toggle?.knobSize || 24,
                          glowRadius: config.toggle?.glowRadius || 10
                      }
                    : null,

            // Color picker config
            colorPicker:
                config.type === "colorPicker"
                    ? {
                          centerX: config.colorPicker?.centerX || 0,
                          centerY: config.colorPicker?.centerY || 0,
                          radius: config.colorPicker?.radius || 75,
                          indicatorX: config.colorPicker?.indicatorX || 0,
                          indicatorY: config.colorPicker?.indicatorY || 0,
                          indicatorSize: config.colorPicker?.indicatorSize || 6,
                          indicatorStrokeWidth: config.colorPicker?.indicatorStrokeWidth || 1,
                          glowRadius: config.colorPicker?.glowRadius || 10
                      }
                    : null
        };

        const container = this.containers.get(containerId);
        if (container) {
            container.elements.push(element);
            if (element.focusable) {
                this.focusableElements.push(element);

                // Register hitbox to exactly match where we draw
                this.input.registerElement(`menu_element_${element.name}`, {
                    bounds: () => ({
                        x: container.x + element.x - 5,
                        y: container.y + element.y - element.height / 2,
                        width: element.width + 10,
                        height: element.height
                    })
                });
            }
        }

        this.elements.set(element.name, element);
        return element;
    }

    update() {
        // Keep slider adjustment in base class since it's common functionality
        if (this.currentFocus && this.currentFocus.type === "slider") {
            if (this.input.isKeyPressed("DirLeft")) {
                this.currentFocus.value = Math.max(0, this.currentFocus.value - 0.01);
                if (this.currentFocus.onChange) {
                    this.currentFocus.onChange(this.currentFocus.value);
                }
            }
            if (this.input.isKeyPressed("DirRight")) {
                this.currentFocus.value = Math.min(1, this.currentFocus.value + 0.01);
                if (this.currentFocus.onChange) {
                    this.currentFocus.onChange(this.currentFocus.value);
                }
            }
        }

        // Handle mouse input first, since we want to check for back button
        const mouseResult = this.handleMouseInput();
        if (mouseResult === "exit") {
            return "exit";
        }

        // Handle action inputs
        if (this.input.isKeyJustPressed("Action1")) {
            return this.handleAction1();
        }
        if (this.input.isKeyJustPressed("Action2")) {
            return this.handleAction2();
        }
    }

    handleAction1() {
        // Empty in base class
        return null;
    }

    handleAction2() {
        // Empty in base class
        return null;
    }

    draw() {
        // Fill the entire screen with the main background first
        this.ctx.fillStyle = this.createGradient(
            0,
            0,
            Game.WIDTH,
            Game.HEIGHT,
            this.colors.mainBackground.start,
            this.colors.mainBackground.end
        );
        this.ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);

        // Then draw all containers
        this.containers.forEach((container) => {
            if (container.visible) {
                this.drawContainer(container);
            }
        });
        // Draw back button last
        const backButtonX = Game.WIDTH - 35; // 5px from right edge
        const backButtonY = 5; // 5px from top
        this.drawBackButton(backButtonX, backButtonY, this.backButtonSize);
    }

    drawBackButton(x, y, size) {
        this.ctx.fillStyle = this.input.isElementHovered("back_button")
            ? this.colors.buttonTextHover
            : this.colors.buttonTextNormal;
        this.ctx.font = "24px monospace";
        this.ctx.textAlign = "center";
        this.ctx.fillText("❌", x + size / 2, y + 20);
    }

    drawContainer(container) {
        // Draw container background with gradient
        this.ctx.fillStyle = this.createGradient(
            container.x,
            container.y,
            container.width,
            container.height,
            this.colors.menuBackground.start,
            this.colors.menuBackground.end
        );
        this.ctx.fillRect(container.x, container.y, container.width, container.height);

        // Draw container elements
        container.elements.forEach((element) => {
            if (element.visible) {
                this.drawElement(container, element);
            }
        });
    }

    drawElement(container, element) {
        const x = container.x + element.x;
        const y = container.y + element.y;

        // Set text properties
        this.ctx.fillStyle = element.selected ? this.colors.selectedText : this.colors.normalText;
        this.ctx.font = "24px monospace"; // Hardcoded font size
        this.ctx.textAlign = "left";
        this.ctx.textBaseline = "middle";

        // Draw selection highlight
        if (element.selected) {
            this.drawSelectionHighlight(x, y, element);
        }

        // Draw the element's text
        this.ctx.fillText(element.text, x, y);

        // Draw the appropriate control based on type
        switch (element.type) {
            case "slider":
                this.drawSlider(x, y, element);
                break;
            case "toggle":
                this.drawToggle(x, y, element);
                break;
            case "colorPicker":
                this.drawColorPicker(x, y, element);
                break;
        }
    }

    drawSelectionHighlight(x, y, element) {
        this.ctx.save();
        this.ctx.shadowColor = this.colors.glowColor;
        this.ctx.shadowBlur = this.colors.glowBlur;

        const highlightX = x + element.highlight.xOffset;
        const highlightY = y + element.highlight.yOffset;

        this.ctx.fillStyle = this.createGradient(
            highlightX,
            highlightY - element.highlight.height / 2,
            element.highlight.width,
            element.highlight.height,
            this.colors.selectedBackground.start,
            this.colors.selectedBackground.end
        );
        this.ctx.fillRect(
            highlightX,
            highlightY - element.highlight.height / 2,
            element.highlight.width,
            element.highlight.height
        );
        this.ctx.restore();
    }

    drawSlider(x, y, element) {
        const config = element.slider;

        // Track
        const trackGradient = this.createGradient(
            config.trackX,
            config.trackY,
            config.trackWidth,
            config.trackHeight,
            this.colors.sliderTrack.start,
            this.colors.sliderTrack.end
        );

        this.ctx.fillStyle = trackGradient;
        this.ctx.beginPath();
        this.ctx.roundRect(config.trackX, config.trackY, config.trackWidth, config.trackHeight, config.roundness);
        this.ctx.fill();

        // Calculate knob position based on value
        const knobX = config.trackX + config.trackWidth * element.value;

        // Knob
        this.ctx.save();
        this.ctx.shadowColor = this.colors.sliderKnobGlow;
        this.ctx.shadowBlur = config.glowRadius;

        const knobGradient = this.ctx.createRadialGradient(
            knobX,
            config.trackY,
            0,
            knobX,
            config.trackY,
            config.knobSize / 2
        );
        knobGradient.addColorStop(0, this.colors.sliderKnob.start);
        knobGradient.addColorStop(1, this.colors.sliderKnob.end);

        this.ctx.fillStyle = knobGradient;
        this.ctx.beginPath();
        this.ctx.arc(knobX, config.trackY, config.knobSize / 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }

    drawToggle(x, y, element) {
        const config = element.toggle;

        // Draw background
        this.ctx.save();
        this.ctx.shadowColor = element.value ? this.colors.toggleGlow.on : this.colors.toggleGlow.off;
        this.ctx.shadowBlur = config.glowRadius;

        const bgGradient = this.createGradient(
            config.x,
            config.y,
            config.width,
            config.height,
            element.value ? this.colors.toggleOn.start : this.colors.toggleOff.start,
            element.value ? this.colors.toggleOn.end : this.colors.toggleOff.end
        );

        this.ctx.fillStyle = bgGradient;
        this.ctx.beginPath();
        this.ctx.roundRect(config.x, config.y, config.width, config.height, config.height / 2);
        this.ctx.fill();

        // Calculate knob position based on value
        const knobX = config.x + (element.value ? config.width - config.knobSize : 0);

        // Draw knob
        const knobGradient = this.createGradient(
            knobX,
            config.y,
            config.knobSize,
            config.knobSize,
            this.colors.toggleKnob.start,
            this.colors.toggleKnob.end
        );

        this.ctx.fillStyle = knobGradient;
        this.ctx.beginPath();
        this.ctx.arc(knobX + config.knobSize / 2, config.y + config.height / 2, config.knobSize / 2, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();
    }

    drawColorPicker(x, y, element) {
        const config = element.colorPicker;

        // Draw wheel
        const gradient = this.ctx.createConicGradient(0, config.centerX, config.centerY);
        for (let i = 0; i <= 1; i += 1 / 360) {
            gradient.addColorStop(i, `hsl(${i * 360}, 100%, 50%)`);
        }

        this.ctx.beginPath();
        this.ctx.arc(config.centerX, config.centerY, config.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        // Draw indicator
        if (element.value) {
            this.ctx.save();
            this.ctx.shadowColor = this.colors.colorPickerIndicator.glow;
            this.ctx.shadowBlur = config.glowRadius;

            this.ctx.beginPath();
            this.ctx.arc(config.indicatorX, config.indicatorY, config.indicatorSize, 0, Math.PI * 2);
            this.ctx.fillStyle = this.colors.colorPickerIndicator.fill;
            this.ctx.fill();
            this.ctx.strokeStyle = this.colors.colorPickerIndicator.stroke;
            this.ctx.lineWidth = config.indicatorStrokeWidth;
            this.ctx.stroke();
            this.ctx.restore();
        }
    }

    registerElements() {
        this.registerBackButton();
    }

    cleanup() {
        if (this.backButtonRegistered) {
            this.input.removeElement("back_button");
            this.backButtonRegistered = false;
        }
        this.elements.forEach((element) => {
            if (element.focusable) {
                this.input.removeElement(`menu_element_${element.name}`);
            }
        });
    }
}