class ConfigMenu extends BaseFullScreenMenu {
    constructor(ctx, input, gameMaster) {
        super(ctx, input, gameMaster);
        this.sprites = {};
        this.loadSprites();
        this.adjustingSlider = false;
        this.adjustingColor = false;

        this.addElement("main", {
            // Base identification
            name: "slider1",
            type: "slider",

            // Position and size
            x: 100,
            y: 100,
            width: 340,
            height: 40,

            // Text properties
            text: "Slider 1",
            textOffsetX: 10,
            textOffsetY: 0,
            font: "24px monospace",
            textAlign: "left",
            textBaseline: "middle",

            // State properties
            focusable: true,
            selected: false,
            visible: true,
            xOrder: 0,

            // Visual enhancement
            highlight: {
                width: 340,
                height: 40,
                xOffset: 0,
                yOffset: 0,
                glow: 15
            },

            // Slider-specific properties
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
                active: false,
                interactionPadding: 20,
                onChange: (value) => console.log("Slider 1:", value),
                valueBox: {
                    font: "16px monospace",
                    padding: 8,
                    height: 30,
                    arrow: {
                        height: 8,
                        width: 12
                    },
                    verticalOffset: 15,
                    cornerRadius: 4
                }
            }
        });

        // Fully explicit slider2:
        this.addElement("main", {
            // Base identification
            name: "slider2",
            type: "slider",

            // Position and size
            x: 100,
            y: 150,
            width: 340,
            height: 40,

            // Text properties
            text: "Slider 2",
            textOffsetX: 10,
            textOffsetY: 0,
            font: "24px monospace",
            textAlign: "left",
            textBaseline: "middle",

            // State properties
            focusable: true,
            selected: false,
            visible: true,
            xOrder: 0,

            // Visual enhancement
            highlight: {
                width: 340,
                height: 40,
                xOffset: 0,
                yOffset: 0,
                glow: 15
            },

            // Slider-specific properties
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
                active: false,
                interactionPadding: 20,
                onChange: (value) => console.log("Slider 2:", value),
                valueBox: {
                    font: "16px monospace",
                    padding: 8,
                    height: 30,
                    arrow: {
                        height: 8,
                        width: 12
                    },
                    verticalOffset: 15,
                    cornerRadius: 4
                }
            }
        });

        // Fully explicit toggle1:
        this.addElement("main", {
            // Base identification
            name: "toggle1",
            type: "toggle",

            // Position and size
            x: 100,
            y: 200,
            width: 240,
            height: 40,

            // Text properties
            text: "Toggle 1",
            textOffsetX: 10,
            textOffsetY: 0,
            font: "24px monospace",
            textAlign: "left",
            textBaseline: "middle",

            // State properties
            focusable: true,
            selected: false,
            visible: true,
            xOrder: 0,

            // Visual enhancement
            highlight: {
                width: 240,
                height: 40,
                xOffset: 0,
                yOffset: 0,
                glow: 15
            },

            // Toggle-specific properties
            toggle: {
                x: 270,
                y: 185,
                width: 60,
                height: 30,
                knobSize: 24,
                glowRadius: 10,
                value: true,
                onChange: (value) => console.log("Toggle 1:", value)
            }
        });

        // Fully explicit toggle2:
        this.addElement("main", {
            // Base identification
            name: "toggle2",
            type: "toggle",

            // Position and size
            x: 100,
            y: 250,
            width: 240,
            height: 40,

            // Text properties
            text: "Toggle 2",
            textOffsetX: 10,
            textOffsetY: 0,
            font: "24px monospace",
            textAlign: "left",
            textBaseline: "middle",

            // State properties
            focusable: true,
            selected: false,
            visible: true,
            xOrder: 0,

            // Visual enhancement
            highlight: {
                width: 240,
                height: 40,
                xOffset: 0,
                yOffset: 0,
                glow: 15
            },

            // Toggle-specific properties
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

        // Fully explicit color1:
        this.addElement("main", {
            // Base identification
            name: "color1",
            type: "colorPicker",

            // Position and size
            x: 100,
            y: 380,
            width: 300,
            height: 200,

            // Text properties
            text: "Color",
            textOffsetX: 10,
            textOffsetY: 0,
            font: "24px monospace",
            textAlign: "left",
            textBaseline: "middle",

            // State properties
            focusable: true,
            selected: false,
            visible: true,
            xOrder: 0,

            // Visual enhancement
            highlight: {
                width: 340,
                height: 200,
                xOffset: 0,
                yOffset: 0,
                glow: 15
            },

            // ColorPicker-specific properties
            colorPicker: {
                centerX: 275,
                centerY: 380,
                radius: 75,
                indicatorX: 275,
                indicatorY: 400,
                indicatorSize: 6,
                glowRadius: 10,
                indicatorStrokeWidth: 1,
                mode: "none",
                value: { hue: 180, saturation: 0.8, brightness: 0.5 },
                preview: {
                    x: 375,
                    y: 325,
                    size: 50
                },
                brightnessSlider: {
                    x: 395,
                    y: 405,
                    width: 4,
                    height: 50,
                    value: 0.5
                },
                onChange: (value) => console.log("Color:", value)
            }
        });

        // Fully explicit button1:
        this.addElement("main", {
            // Base identification
            name: "button1",
            type: "textButton",

            // Position and size
            x: 100,
            y: 520,
            width: 200,
            height: 40,

            // Text properties
            text: "Click Me",
            textOffsetX: 10,
            textOffsetY: 0,
            font: "24px monospace",
            textAlign: "left",
            textBaseline: "middle",

            // State properties
            focusable: true,
            selected: false,
            visible: true,
            xOrder: 0,

            // Visual enhancement
            highlight: {
                width: 200,
                height: 40,
                xOffset: 0,
                yOffset: 0,
                glow: 15
            },

            // Button-specific properties
            button: {
                pressed: false,
                onClick: () => console.log("Button clicked!")
            }
        });

        // Fully explicit label1:
        this.addElement("main", {
            // Base identification
            name: "label1",
            type: "textLabel",

            // Position and size
            x: 100,
            y: 570,
            width: 200,
            height: 40,

            // Text properties
            text: "Some Label Text",
            textOffsetX: 10,
            textOffsetY: 0,
            font: "24px monospace",
            textAlign: "left",
            textBaseline: "middle",

            // State properties
            focusable: false,
            selected: false,
            visible: true,
            xOrder: 0

            // Note: textLabels don't have highlight or type-specific properties
        });

        // Fully explicit imageButton1:
        this.addElement("main", {
            // Base identification
            name: "imageButton1",
            type: "imageButton",

            // Position and size
            x: 600,
            y: 300,
            width: 64,
            height: 64,

            // Text properties (even though not used)
            text: "",
            textOffsetX: 10,
            textOffsetY: 0,
            font: "24px monospace",
            textAlign: "left",
            textBaseline: "middle",

            // State properties
            focusable: true,
            selected: false,
            visible: true,
            xOrder: 1,

            // Visual enhancement
            highlight: {
                width: 74,
                height: 74,
                xOffset: 0,
                yOffset: 0,
                glow: 15
            },

            // Image-specific properties
            image: {
                sprite: this.sprites.warrior,
                smoothing: false
            },

            // Button-specific properties
            button: {
                pressed: false,
                onClick: () => console.log("Warrior clicked!")
            }
        });

        // Fully explicit imageLabel1:
        this.addElement("main", {
            // Base identification
            name: "imageLabel1",
            type: "imageLabel",

            // Position and size
            x: 600,
            y: 400,
            width: 64,
            height: 64,

            // Text properties (even though not used)
            text: "",
            textOffsetX: 10,
            textOffsetY: 0,
            font: "24px monospace",
            textAlign: "left",
            textBaseline: "middle",

            // State properties
            focusable: false,
            selected: false,
            visible: true,
            xOrder: 0,

            // Image-specific properties
            image: {
                sprite: this.sprites.mage,
                smoothing: false
            }

            // Note: imageLables don't have highlight properties
        });

        this.registerElements();
    }

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

    loadSprites() {
        ["warrior", "mage", "thief"].forEach((type) => {
            this.sprites[type] = Sprite.genHeroSprite(type);
            console.log(`Loaded sprite ${type}:`, this.sprites[type]);
        });
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
            const validElements = this.focusableElements.filter((element) => {
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

            validElements.forEach((element) => {
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
            case "textButton":
                element.button.pressed = true;
                if (element.button.onClick) {
                    element.button.onClick();
                }
                // Reset pressed state after a short delay
                setTimeout(() => {
                    element.button.pressed = false;
                }, 100);
                break;
            case "imageButton":
                element.button.pressed = true;
                if (element.button.onClick) {
                    element.button.onClick();
                }
                // Reset pressed state after a short delay
                setTimeout(() => {
                    element.button.pressed = false;
                }, 100);
                break;
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
                switch (element.colorPicker.mode) {
                    case "none":
                        element.colorPicker.mode = "wheel";
                        this.adjustingColor = true;
                        break;
                    case "wheel":
                        element.colorPicker.mode = "brightness";
                        break;
                    case "brightness":
                        element.colorPicker.mode = "none";
                        this.adjustingColor = false;
                        break;
                }
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
            const element = this.currentFocus;
            switch (element.colorPicker.mode) {
                case "brightness":
                    element.colorPicker.mode = "wheel";
                    break;
                case "wheel":
                    element.colorPicker.mode = "none";
                    this.adjustingColor = false;
                    break;
            }
            return null;
        }
        return "exit";
    }
}