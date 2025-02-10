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

                // Handle slider
                if (element.type === "slider") {
                    const isInSliderBounds = this.input.isElementHovered(`menu_element_${element.name}_slider`);

                    // Handle click or drag while in bounds
                    if (
                        isInSliderBounds &&
                        (this.input.isElementJustPressed(`menu_element_${element.name}_slider`) ||
                            this.input.isPointerDown())
                    ) {
                        const mousePos = this.input.getPointerPosition();
                        const trackStart = container.x + element.slider.trackX;
                        const value = (mousePos.x - trackStart) / element.slider.trackWidth;
                        element.slider.value = Math.max(0, Math.min(1, value));
                        if (element.slider.onChange) {
                            element.slider.onChange(element.slider.value);
                        }
                    }
                }
                if (element.type === "toggle") {
                    // Calculate toggle button bounds (the actual switch area)
                    const toggleBounds = {
                        x: container.x + element.toggle.x,
                        y: container.y + element.toggle.y,
                        width: element.toggle.width,
                        height: element.toggle.height
                    };

                    // Check if click is within toggle bounds
                    if (this.input.isElementJustPressed(`menu_element_${element.name}`)) {
                        const mousePos = this.input.getPointerPosition();
                        if (this.input.isPointInBounds(mousePos.x, mousePos.y, toggleBounds)) {
                            element.toggle.value = !element.toggle.value;
                            if (element.toggle.onChange) {
                                element.toggle.onChange(element.toggle.value);
                            }
                        }
                    }
                }
                if (element.type === "colorPicker") {
                    // Get center and mouse positions
                    const centerX = container.x + element.colorPicker.centerX;
                    const centerY = container.y + element.colorPicker.centerY;
                    const mousePos = this.input.getPointerPosition();

                    // Calculate distance from center
                    const dx = mousePos.x - centerX;
                    const dy = mousePos.y - centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    // Check if click/drag is within wheel radius
                    if (distance <= element.colorPicker.radius) {
                        if (
                            this.input.isElementJustPressed(`menu_element_${element.name}`) ||
                            this.input.isPointerDown()
                        ) {
                            // Calculate hue (angle) and saturation (distance)
                            let angle = Math.atan2(dy, dx);
                            if (angle < 0) angle += Math.PI * 2;
                            const hue = (angle * 180) / Math.PI;
                            const saturation = Math.min(1, distance / element.colorPicker.radius);

                            // Update indicator position
                            element.colorPicker.indicatorX = centerX + dx;
                            element.colorPicker.indicatorY = centerY + dy;

                            // Update value and call onChange
                            element.colorPicker.value = {
                                hue,
                                saturation,
                                brightness: element.colorPicker.value?.brightness || 1 // Preserve existing brightness
                            };
                            if (element.colorPicker.onChange) {
                                element.colorPicker.onChange(element.colorPicker.value);
                            }
                        }
                    }
                    // Handle brightness slider
                    if (element.colorPicker.brightnessSlider) {
                        const sliderBounds = {
                            x: element.colorPicker.brightnessSlider.x - 6,
                            y: element.colorPicker.brightnessSlider.y,
                            width: 16,
                            height: element.colorPicker.brightnessSlider.height
                        };

                        const mousePos = this.input.getPointerPosition();
                        if (
                            this.input.isPointInBounds(mousePos.x, mousePos.y, sliderBounds) &&
                            this.input.isPointerDown()
                        ) {
                            // Calculate value based on vertical position (inverted)
                            const value = 1 - (mousePos.y - sliderBounds.y) / sliderBounds.height;
                            element.colorPicker.value.brightness = Math.max(0, Math.min(1, value));

                            if (element.colorPicker.onChange) {
                                element.colorPicker.onChange(element.colorPicker.value);
                            }
                        }
                    }
                }

                if (this.input.isElementHovered(`menu_element_${element.name}`)) {
                    foundHover = true;
                    // Update currentFocus and selection on hover
                    if (this.currentFocus !== element) {
                        if (this.currentFocus) {
                            // Clean up any ongoing interactions
                            if (this.currentFocus.type === "slider") {
                                this.currentFocus.slider.active = false;
                                this.adjustingSlider = false;
                            } else if (this.currentFocus.type === "colorPicker") {
                                this.currentFocus.colorPicker.mode = "none";
                                this.adjustingColor = false;
                            }

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
            name: config.name || "unnamed element", // optional identifier
            type: config.type, // element type (slider, toggle, color picker)
            x: config.x || 0, // anchor x
            y: config.y || 0, // anchor y
            width: config.width || 50, // hitbox width
            height: config.height || 50, // hitbox height
            text: config.text || "",
            textOffsetX: config.textOffsetX || 10,
            textOffsetY: config.textOffsetY || 0,
            font: config.fontSize || "24px monospace",
            textAlign: config.textAlign || "left",
            textBaseline: config.textBaseline || "middle",
            focusable: config.focusable || false, // whether this element's hitbox is "active"
            selected: config.selected || false, // if this is the currently focused element this will be set to true
            visible: config.visible || true, // toggles visibility of this element
            xOrder: config.xOrder || 0, // order of horizontal significance to directional input navigation

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
                          roundness: config.slider?.roundness || 2,
                          value: config.slider?.value || 0,
                          active: false,
                          interactionPadding: config.slider?.interactionPadding || 20, // how much space above/below track is clickable
                          onChange: config.slider?.onChange
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
                          knobSize: config.toggle?.knobSize || 24,
                          glowRadius: config.toggle?.glowRadius || 10,
                          value: config.toggle?.value || false,
                          onChange: config.toggle?.onChange
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
                          glowRadius: config.colorPicker?.glowRadius || 10,
                          mode: config.colorPicker?.mode || "none",
                          value: config.colorPicker?.value || false,
                          preview: config.colorPicker?.preview || null,
                          brightnessSlider: config.colorPicker?.brightnessSlider || null,
                          onChange: config.colorPicker?.onChange
                      }
                    : null
        };

        const container = this.containers.get(containerId);
        if (container) {
            container.elements.push(element);
            if (element.focusable) {
                this.focusableElements.push(element);
                // Add hitbox for slider track if this is a slider
                if (element.type === "slider") {
                    this.input.registerElement(`menu_element_${element.name}_slider`, {
                        bounds: () => ({
                            x: container.x + element.slider.trackX - element.slider.interactionPadding,
                            y: container.y + element.slider.trackY - element.slider.interactionPadding,
                            width: element.slider.trackWidth + element.slider.interactionPadding * 2,
                            height: element.slider.interactionPadding * 2
                        })
                    });
                }
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
        if (this.currentFocus && this.currentFocus.type === "slider" && this.currentFocus.slider.active) {
            if (this.input.isKeyPressed("DirLeft")) {
                this.currentFocus.slider.value = Math.max(0, this.currentFocus.slider.value - 0.01);
                if (this.currentFocus.slider.onChange) {
                    this.currentFocus.slider.onChange(this.currentFocus.slider.value);
                }
            }
            if (this.input.isKeyPressed("DirRight")) {
                this.currentFocus.slider.value = Math.min(1, this.currentFocus.slider.value + 0.01);
                if (this.currentFocus.slider.onChange) {
                    this.currentFocus.slider.onChange(this.currentFocus.slider.value);
                }
            }
        } else if (this.currentFocus && this.currentFocus.type === "colorPicker" && this.adjustingColor) {
    const config = this.currentFocus.colorPicker;
    
    if (config.mode === "wheel") {
        const speed = 2;
        let dx = 0;
        let dy = 0;

        if (this.input.isKeyPressed("DirLeft")) dx -= speed;
        if (this.input.isKeyPressed("DirRight")) dx += speed;
        if (this.input.isKeyPressed("DirUp")) dy -= speed;
        if (this.input.isKeyPressed("DirDown")) dy += speed;

        if (dx !== 0 || dy !== 0) {
            // Update indicator position
            const newX = config.indicatorX + dx;
            const newY = config.indicatorY + dy;

            // Calculate distance from center
            const centerX = config.centerX;
            const centerY = config.centerY;
            const distance = Math.sqrt(Math.pow(newX - centerX, 2) + Math.pow(newY - centerY, 2));

            // Only update if still within radius
            if (distance <= config.radius) {
                config.indicatorX = newX;
                config.indicatorY = newY;

                // Calculate new hue and saturation
                const angle = Math.atan2(newY - centerY, newX - centerX);
                let hue = (angle * 180) / Math.PI;
                if (hue < 0) hue += 360;
                const saturation = Math.min(1, distance / config.radius);

                config.value = { 
                    hue, 
                    saturation, 
                    brightness: config.value.brightness // Preserve existing brightness
                };
                if (config.onChange) {
                    config.onChange(config.value);
                }
            }
        }
    } 
    else if (config.mode === "brightness") {
        if (this.input.isKeyPressed("DirUp")) {
            config.value.brightness = Math.min(1, config.value.brightness + 0.01);
            if (config.onChange) {
                config.onChange(config.value);
            }
        }
        if (this.input.isKeyPressed("DirDown")) {
            config.value.brightness = Math.max(0, config.value.brightness - 0.01);
            if (config.onChange) {
                config.onChange(config.value);
            }
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

        // Draw all containers' elements
        this.containers.forEach((container) => {
            if (container.visible) {
                this.drawContainer(container);
            }
        });

        // Draw back button last
        const backButtonX = Game.WIDTH - 35;
        const backButtonY = 5;
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
        this.ctx.fillText(element.text, x + element.textOffsetX, y + element.textOffsetY);

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

        // Draw track (unchanged)
        this.ctx.fillStyle = this.colors.sliderTrack;
        this.ctx.beginPath();
        this.ctx.roundRect(config.trackX, config.trackY, config.trackWidth, config.trackHeight, config.roundness);
        this.ctx.fill();

        // Calculate knob position based on value
        const knobX = config.trackX + config.trackWidth * config.value;

        // Determine if knob is active
        const isMouseDragging =
            this.input.isElementHovered(`menu_element_${element.name}_slider`) && this.input.isPointerDown();
        const isActive = config.active || isMouseDragging;

        // Draw value box if active
        if (isActive) {
            const displayValue = config.valueToText ? config.valueToText(config.value) : config.value.toFixed(2);
            this.drawValueBox(knobX, config.trackY, displayValue);
        }

        // Draw knob (existing code with active/inactive states)
        if (isActive) {
            this.ctx.save();
            this.ctx.shadowColor = this.colors.sliderKnobGlow;
            this.ctx.shadowBlur = config.glowRadius;
        }

        this.ctx.fillStyle = isActive ? this.colors.sliderKnobActive : this.colors.sliderKnobInactive;
        this.ctx.beginPath();
        this.ctx.arc(knobX, config.trackY, config.knobSize / 2, 0, Math.PI * 2);
        this.ctx.fill();

        if (isActive) {
            this.ctx.restore();
        }
    }

    drawValueBox(x, y, value) {
        const padding = 8;
        const boxHeight = 30;
        const arrowHeight = 8;
        const arrowWidth = 12;
        const verticalOffset = 15;

        this.ctx.save();

        // Measure text for box width
        this.ctx.font = "16px monospace";
        const textWidth = this.ctx.measureText(value).width;
        const boxWidth = textWidth + padding * 2;

        // Calculate positions
        const boxY = y - boxHeight - arrowHeight - verticalOffset;

        // Draw background box with arrow
        this.ctx.fillStyle = this.colors.menuBackground.start;
        this.ctx.beginPath();

        // Main box
        this.ctx.roundRect(x - boxWidth / 2, boxY, boxWidth, boxHeight, 4);

        // Arrow
        this.ctx.moveTo(x - arrowWidth / 2, boxY + boxHeight);
        this.ctx.lineTo(x, boxY + boxHeight + arrowHeight);
        this.ctx.lineTo(x + arrowWidth / 2, boxY + boxHeight);

        this.ctx.fill();

        // Draw text in normalText color
        this.ctx.fillStyle = this.colors.normalText;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(value, x, boxY + boxHeight / 2);

        this.ctx.restore();
    }

    drawToggle(x, y, element) {
        const config = element.toggle;

        // Draw shadow
        this.ctx.save();
        this.ctx.shadowColor = config.value ? this.colors.toggleShadowOn : this.colors.toggleShadowOff;
        this.ctx.shadowBlur = config.glowRadius;

        // Draw toggle background
        this.ctx.fillStyle = config.value ? this.colors.toggleBGOn : this.colors.toggleBGOff;
        this.ctx.beginPath();
        this.ctx.roundRect(config.x, config.y, config.width, config.height, config.height / 2);
        this.ctx.fill();

        // Calculate knob position based on value
        const knobX = config.x + (config.value ? config.width - config.knobSize : 0);

        // Draw knob
        this.ctx.fillStyle = this.colors.toggleKnob;
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

        // Draw indicator with conditional glow
        if (config.value) {
        // Check for mouse interaction with wheel
        const isMouseOnWheel = this.input.isElementHovered(`menu_element_${element.name}`) && 
            this.input.isPointerDown();

        if (config.mode === "wheel" || isMouseOnWheel) {
            this.ctx.save();
            this.ctx.shadowColor = this.colors.colorPickerIndicator.glow;
            this.ctx.shadowBlur = config.glowRadius;
        }

        this.ctx.beginPath();
        this.ctx.arc(config.indicatorX, config.indicatorY, config.indicatorSize, 0, Math.PI * 2);
        this.ctx.fillStyle = this.colors.colorPickerIndicator.fill;
        this.ctx.fill();
        this.ctx.strokeStyle = this.colors.colorPickerIndicator.stroke;
        this.ctx.lineWidth = config.indicatorStrokeWidth;
        this.ctx.stroke();

        if (config.mode === "wheel" || isMouseOnWheel) {
            this.ctx.restore();
        }
    }

        // Draw preview
        if (config.preview && config.value) {
            const hslColor = `hsl(${config.value.hue}, ${config.value.saturation * 100}%, ${config.value.brightness * 100}%)`;
            this.ctx.fillStyle = hslColor;
            this.ctx.fillRect(config.preview.x, config.preview.y, config.preview.size, config.preview.size);
            this.ctx.strokeStyle = this.colors.colorPickerIndicator.stroke;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(config.preview.x, config.preview.y, config.preview.size, config.preview.size);
        }

        // Draw brightness slider with conditional active state
        if (config.brightnessSlider) {
        // Draw track
        this.ctx.fillStyle = "#333";
        this.ctx.fillRect(
            config.brightnessSlider.x,
            config.brightnessSlider.y,
            config.brightnessSlider.width,
            config.brightnessSlider.height
        );

        // Check for mouse interaction with brightness slider
        const sliderBounds = {
            x: config.brightnessSlider.x - 6,
            y: config.brightnessSlider.y,
            width: 16,
            height: config.brightnessSlider.height
        };
        const mousePos = this.input.getPointerPosition();
        const isMouseOnSlider = this.input.isPointInBounds(mousePos.x, mousePos.y, sliderBounds) && 
            this.input.isPointerDown();

        // Draw knob with conditional glow
        if (config.mode === "brightness" || isMouseOnSlider) {
            this.ctx.save();
            this.ctx.shadowColor = this.colors.sliderKnobGlow;
            this.ctx.shadowBlur = config.glowRadius;
        }

        this.ctx.fillStyle =
            (config.mode === "brightness" || isMouseOnSlider) ? 
            this.colors.sliderKnobActive : 
            this.colors.sliderKnobInactive;

        this.ctx.fillRect(
            config.brightnessSlider.x - 6,
            config.brightnessSlider.y + config.brightnessSlider.height * (1 - config.value.brightness) - 2,
            16,
            4
        );

        if (config.mode === "brightness" || isMouseOnSlider) {
            this.ctx.restore();
        }
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