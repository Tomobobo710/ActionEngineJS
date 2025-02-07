class ConfigMenu extends BaseFullScreenMenu {
    constructor(ctx, input, gameMaster) {
        super(ctx, input, gameMaster);

        // State tracking for sliders and color picker
        this.adjustingSlider = false;
        this.adjustingColor = false;

        // Add sliders
        this.addElement("main", {
            name: "slider1",
            type: "slider",
            text: "Slider 1",
            value: 0.5,
            x: 100,
            y: 100,
            width: 400,
            height: 40,
            focusable: true,
            highlight: {
                x: 80,
                y: 100,
                width: 310,
                height: 40,
                glow: 15
            },
            slider: {
                trackX: 270,
                trackY: 98,
                trackWidth: 150,
                trackHeight: 4,
                knobX: 345,
                knobY: 98,
                knobSize: 20,
                glowRadius: 15,
                roundness: 2
            },
            onChange: (value) => console.log("Slider 1:", value)
        });

        this.addElement("main", {
            name: "slider2",
            type: "slider",
            text: "Slider 2",
            value: 0.7,
            x: 100,
            y: 200,
            width: 200,
            height: 40,
            focusable: true,
            highlight: {
                x: 80,
                y: 200,
                width: 310,
                height: 40,
                glow: 15
            },
            slider: {
                trackX: 270,
                trackY: 198,
                trackWidth: 150,
                trackHeight: 4,
                knobX: 375,
                knobY: 198,
                knobSize: 20,
                glowRadius: 15,
                roundness: 2
            },
            onChange: (value) => console.log("Slider 2:", value)
        });

        // Add toggles
        this.addElement("main", {
            name: "toggle1",
            type: "toggle",
            text: "Toggle 1",
            value: true,
            x: 100,
            y: 300,
            width: 400,
            height: 40,
            focusable: true,
            highlight: {
                x: 80,
                y: 300,
                width: 200,
                height: 40,
                glow: 15
            },
            toggle: {
                x: 270,
                y: 285,
                width: 60,
                height: 30,
                knobX: 270,
                knobY: 285,
                knobSize: 24,
                glowRadius: 10
            },
            onChange: (value) => console.log("Toggle 1:", value)
        });

        this.addElement("main", {
            name: "toggle2",
            type: "toggle",
            text: "Toggle 2",
            value: false,
            x: 100,
            y: 400,
            width: 400,
            height: 40,
            focusable: true,
            highlight: {
                x: 80,
                y: 400,
                width: 200,
                height: 40,
                glow: 15
            },
            toggle: {
                x: 270,
                y: 385,
                width: 60,
                height: 30,
                knobX: 270,
                knobY: 385,
                knobSize: 24,
                glowRadius: 10
            },
            onChange: (value) => console.log("Toggle 2:", value)
        });

        this.addElement("main", {
            name: "color1",
            type: "colorPicker",
            text: "Color",
            value: { hue: 180, saturation: 0.8, brightness: 1 },
            x: 100,
            y: 500,
            width: 200,
            height: 200,
            focusable: true,
            label: {
                font: "24px monospace",
                padding: 10
            },
            highlight: {
                width: 300,
                height: 200,
                x: 80,
                y: 500,
                glow: 15
            },
            colorPicker: {
                centerX: 275,
                centerY: 485,
                radius: 75,
                indicatorX: 275,
                indicatorY: 485,
                indicatorSize: 6,
                glowRadius: 10,
                indicatorStrokeWidth: 1
            },
            onChange: (value) => console.log("Color:", value)
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
                case "right":
                    if (deltaX <= 0) return;
                    break;
                case "left":
                    if (deltaX >= 0) return;
                    break;
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

    handleAction1() {
        if (!this.currentFocus) return;
        const element = this.currentFocus;

        switch (element.type) {
            case "slider":
                this.adjustingSlider = true;
                break;
            case "toggle":
                element.value = !element.value;
                element.onChange(element.value);
                break;
            case "colorPicker":
                this.adjustingColor = true;
                break;
        }
    }

    handleAction2() {
        if (this.adjustingSlider) {
            this.adjustingSlider = false;
            return null;
        }
        if (this.adjustingColor) {
            this.adjustingColor = false;
            return null;
        }
        return "exit";
    }
}