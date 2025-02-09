class ConfigMenu extends BaseFullScreenMenu {
    constructor(ctx, input, gameMaster) {
        super(ctx, input, gameMaster);

        this.adjustingSlider = false;
        this.adjustingColor = false;

        // Add sliders
        this.addElement("main", {
            name: "slider1",
            type: "slider",
            text: "Slider 1",
            x: 100,
            y: 100,
            width: 340,
            height: 40,
            focusable: true,
            highlight: {
                width: 340,
                height: 40,
                xOffset: 0,
                yOffset: 0,
                glow: 15
            },
            slider: {
                trackX: 270,
                trackY: 100,
                trackWidth: 150,
                trackHeight: 4,
                knobX: 345,
                knobY: 100,
                knobSize: 20,
                glowRadius: 15,
                roundness: 2,
                value: 0.5,
                onChange: (value) => console.log("Slider 1:", value)
            }
        });

        this.addElement("main", {
            name: "slider2",
            type: "slider",
            text: "Slider 2",
            x: 100,
            y: 150,
            width: 340,
            height: 40,
            focusable: true,
            highlight: {
                width: 340,
                height: 40,
                glow: 15
            },
            slider: {
                trackX: 270,
                trackY: 150,
                trackWidth: 150,
                trackHeight: 4,
                knobX: 375,
                knobY: 150,
                knobSize: 20,
                glowRadius: 15,
                roundness: 2,
                value: 0.5,
                valueToText: (value) => {
                    if (value < 0.33) return "Low";
                    if (value < 0.66) return "Medium";
                    return "High";
                },
                onChange: (value) => console.log("Slider 2:", value)
            }
        });

        // Add toggles
        this.addElement("main", {
            name: "toggle1",
            type: "toggle",
            text: "Toggle 1",
            x: 100,
            y: 200,
            width: 240,
            height: 40,
            focusable: true,
            highlight: {
                width: 240,
                height: 40,
                glow: 15
            },
            toggle: {
                x: 270,
                y: 185, // could be like element's y - toggle's height / 2?
                width: 60,
                height: 30,
                knobSize: 24,
                glowRadius: 10,
                value: true,
                onChange: (value) => console.log("Toggle 1:", value)
            }
        });

        this.addElement("main", {
            name: "toggle2",
            type: "toggle",
            text: "Toggle 2",
            x: 100,
            y: 250,
            width: 240,
            height: 40,
            focusable: true,
            highlight: {
                width: 240,
                height: 40,
                glow: 15
            },
            toggle: {
                x: 270,
                y: 235,
                width: 60,
                height: 30,
                knobSize: 24,
                glowRadius: 10,
                value: false,
                onChange: (value) => console.log("Toggle 2:", value)
            }
        });

        this.addElement("main", {
            name: "color1",
            type: "colorPicker",
            text: "Color",
            x: 100,
            y: 400,
            width: 300,
            height: 200,
            focusable: true,
            label: {
                font: "24px monospace",
                padding: 10
            },
            highlight: {
                width: 340,
                height: 200,
                glow: 15
            },
            colorPicker: {
                centerX: 275,
                centerY: 400,
                radius: 75,
                indicatorX: 275,
                indicatorY: 400,
                indicatorSize: 6,
                glowRadius: 10,
                indicatorStrokeWidth: 1,
                value: { hue: 180, saturation: 0.8, brightness: 1 },
                preview: {
            x: 375, // Position to the right of the wheel
            y: 375, // Aligned roughly with wheel center
            size: 50  // Size of the preview square
        },
                onChange: (value) => console.log("Color:", value)
            }
        });

        this.registerElements();
    }

    // Rest of the class implementation remains the same
    update() {
        if (!this.adjustingSlider && !this.adjustingColor) {
            if (this.input.isKeyJustPressed("DirUp")) {
                this.handleDirectionalInput("up");
            }
            if (this.input.isKeyJustPressed("DirDown")) {
                this.handleDirectionalInput("down");
            }
            if (this.input.isKeyJustPressed("DirLeft")) {
                this.handleDirectionalInput("left");
            }
            if (this.input.isKeyJustPressed("DirRight")) {
                this.handleDirectionalInput("right");
            }
        }

        return super.update();
    }

    handleDirectionalInput(direction) {
    if (!this.focusableElements.length) return;

    if (!this.currentFocus) {
        this.currentFocus = this.focusableElements[0];
        this.currentFocus.selected = true;
        return;
    }

    const current = this.currentFocus;
    
    if (direction === "left" || direction === "right") {
        // Find elements with different xOrder
        const validElements = this.focusableElements.filter(element => {
            if (direction === "right") {
                return element.xOrder > current.xOrder;
            } else {
                return element.xOrder < current.xOrder;
            }
        });

        // If no valid elements, don't move
        if (validElements.length === 0) return;

        // Find closest valid element
        let nextElement = validElements[0];
        let bestDistance = Math.abs(nextElement.y - current.y);

        validElements.forEach(element => {
            const distance = Math.abs(element.y - current.y);
            if (distance < bestDistance) {
                bestDistance = distance;
                nextElement = element;
            }
        });

        if (nextElement) {
            this.currentFocus.selected = false;
            this.currentFocus = nextElement;
            this.currentFocus.selected = true;
        }
    } else {
        let nextElement = null;
        let bestDistance = Infinity;

        const currentX = current.x + current.width / 2;
        const currentY = current.y + current.height / 2;

        this.focusableElements.forEach((element) => {
            if (element === current) return;

            const elementX = element.x + element.width / 2;
            const elementY = element.y + element.height / 2;

            const deltaX = elementX - currentX;
            const deltaY = elementY - currentY;

            switch (direction) {
                case "up":
                    if (deltaY >= 0) return;
                    break;
                case "down":
                    if (deltaY <= 0) return;
                    break;
            }

            const distance = Math.abs(deltaX) + Math.abs(deltaY);

            if (distance < bestDistance) {
                bestDistance = distance;
                nextElement = element;
            }
        });

        if (nextElement) {
            this.currentFocus.selected = false;
            this.currentFocus = nextElement;
            this.currentFocus.selected = true;
        }
    }
}

    handleAction1() {
        if (!this.currentFocus) return;
        const element = this.currentFocus;

        switch (element.type) {
            case "slider":
                this.adjustingSlider = true;
                element.slider.active = true;
                break;
            case "toggle":
                element.toggle.value = !element.toggle.value;
                if (element.toggle.onChange) {
                    element.toggle.onChange(element.toggle.value);
                }
                break;
            case "colorPicker":
                this.adjustingColor = true;
                break;
        }
    }

    handleAction2() {
        if (this.currentFocus?.type === "slider" && this.currentFocus.slider.active) {
            this.adjustingSlider = false;
            this.currentFocus.slider.active = false;
            return null;
        }
        if (this.adjustingColor) {
            this.adjustingColor = false;
            return null;
        }
        return "exit";
    }
}