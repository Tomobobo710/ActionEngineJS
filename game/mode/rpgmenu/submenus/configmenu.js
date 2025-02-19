class ConfigMenu extends BaseFullScreenMenu {
    constructor(ctx, input, gameMaster) {
        super(ctx, input, gameMaster);
        this.adjustingColor = false;

        // Title panel at top
        this.addElement("main", {
            name: "titlePanel",
            type: "panel",
            x: 20,
            y: 20,
            width: 370,
            height: 60,
            focusable: false,
            background: {
                visible: false,
                width: 720,
                height: 60,
                xOffset: 0,
                yOffset: 0
            },
            panel: {
                borderWidth: 2,
                drawBackground: true
            }
        });

        // Content panel
        this.addElement("main", {
            name: "contentPanel",
            type: "panel",
            x: 20,
            y: 100,
            width: 380,
            height: 420,
            focusable: false,
            background: {
                visible: false,
                width: 720,
                height: 420,
                xOffset: 0,
                yOffset: 0
            },
            panel: {
                borderWidth: 2,
                drawBackground: true
            }
        });

        // Content panel 2
        this.addElement("main", {
            name: "contentPanel2",
            type: "panel",
            x: 420,
            y: 100,
            width: 360,
            height: 420,
            focusable: false,
            background: {
                visible: false,
                width: 720,
                height: 420,
                xOffset: 0,
                yOffset: 0
            },
            panel: {
                borderWidth: 2,
                drawBackground: true
            }
        });

        this.addElement("main", {
            name: "bottomPanel",
            type: "panel",
            x: 20,
            y: 540,
            width: 480,
            height: 40,
            focusable: false,
            background: {
                visible: false
            },
            panel: {
                borderWidth: 2,
                drawBackground: true
            }
        });

        // Title text
        this.addElement("main", {
            name: "titleText",
            type: "textLabel",
            x: 30,
            y: 50,
            width: 400,
            height: 40,
            text: "Color Configuration",
            font: "32px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: false,
            background: {
                visible: false,
                width: 400,
                height: 40,
                xOffset: 0,
                yOffset: 0
            }
        });

        // Background Colors Label
        this.addElement("main", {
            name: "bgColorsLabel",
            type: "textLabel",
            x: 20,
            y: 112,
            width: 360,
            height: 30,
            text: "Background Colors",
            font: "15px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: false,
            background: {
                visible: false,
                width: 360,
                height: 30,
                xOffset: 0,
                yOffset: 0
            }
        });

        // Utility functions for conversions
        const rgbToHsv = (rgba) => {
            const matches = rgba.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
            const r = parseInt(matches[1]);
            const g = parseInt(matches[2]);
            const b = parseInt(matches[3]);

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const delta = max - min;
            const brightness = max / 255;
            const saturation = max === 0 ? 0 : delta / max;

            let hue;
            if (delta === 0) {
                hue = 0;
            } else if (max === r) {
                hue = ((g - b) / delta) % 6;
            } else if (max === g) {
                hue = (b - r) / delta + 2;
            } else {
                hue = (r - g) / delta + 4;
            }
            hue = Math.round(hue * 60);
            if (hue < 0) hue += 360;

            return { hue, saturation, brightness };
        };

        const calculateIndicatorPosition = (hsv, centerX, centerY, radius) => {
            const angleInRadians = (((360 - hsv.hue) % 360) * Math.PI) / 180;
            return {
                x: centerX + Math.cos(angleInRadians) * (hsv.saturation * radius),
                y: centerY - Math.sin(angleInRadians) * (hsv.saturation * radius)
            };
        };

        const createOnChangeHandler = (colorPath) => {
            return (value) => {
                const h = value.hue;
                const s = value.saturation;
                const v = value.brightness;

                const max = v * 255;
                const delta = s * max;
                const min = max - delta;

                let r, g, b;

                if (h < 60) {
                    r = max;
                    g = (h * delta) / 60 + min;
                    b = min;
                } else if (h < 120) {
                    r = ((120 - h) * delta) / 60 + min;
                    g = max;
                    b = min;
                } else if (h < 180) {
                    r = min;
                    g = max;
                    b = ((h - 120) * delta) / 60 + min;
                } else if (h < 240) {
                    r = min;
                    g = ((240 - h) * delta) / 60 + min;
                    b = max;
                } else if (h < 300) {
                    r = ((h - 240) * delta) / 60 + min;
                    g = min;
                    b = max;
                } else {
                    r = max;
                    g = min;
                    b = ((360 - h) * delta) / 60 + min;
                }

                const rgba = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.97)`;

                // Set the color at the specified path
                const [obj, prop] = colorPath;
                if (prop) {
                    this.gameMaster.persistentParty.colors[obj][prop] = rgba;
                } else {
                    this.gameMaster.persistentParty.colors[obj] = rgba;
                }

                return rgba;
            };
        };

        // Main BG Start Color Picker - keeping all original positioning
        const color1 = this.gameMaster.persistentParty.colors.mainBackground.start;
        const hsv1 = rgbToHsv(color1);
        const centerX1 = 260;
        const centerY1 = 160;
        const radius1 = 30;
        const indicatorPos1 = calculateIndicatorPosition(hsv1, centerX1, centerY1, radius1);

        this.addElement("main", {
            name: "mainBgStart",
            type: "colorPicker",
            x: 40,
            y: 160,
            width: 340,
            height: 70,
            glowIntensity: 15,
            text: "Main BG 1",
            textOffsetX: 10,
            textOffsetY: 0,
            font: "24px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: true,
            selected: false,
            visible: true,
            xOrder: 0,
            background: {
                width: 340,
                height: 70,
                xOffset: 0,
                yOffset: 0,
                visible: true
            },
            colorPicker: {
                centerX: 260,
                centerY: 160,
                radius: 30,
                indicatorX: indicatorPos1.x,
                indicatorY: indicatorPos1.y,
                indicatorSize: 4,
                glowRadius: 10,
                indicatorStrokeWidth: 1,
                mode: "none",
                value: hsv1,
                preview: {
                    x: 330,
                    y: 160,
                    size: 40
                },
                brightnessSlider: {
                    x: 308,
                    y: 160,
                    width: 4,
                    height: 40,
                    value: hsv1.brightness
                },
                onChange: createOnChangeHandler(["mainBackground", "start"])
            }
        });

        // Main BG End Color Picker
        const color2 = this.gameMaster.persistentParty.colors.mainBackground.end;
        const hsv2 = rgbToHsv(color2);
        const centerX2 = 260;
        const centerY2 = 240;
        const radius2 = 30;
        const indicatorPos2 = calculateIndicatorPosition(hsv2, centerX2, centerY2, radius2);

        this.addElement("main", {
            name: "mainBgEnd",
            type: "colorPicker",
            x: 40,
            y: 240,
            width: 340,
            height: 70,
            glowIntensity: 15,
            text: "Main BG 2",
            textOffsetX: 10,
            textOffsetY: 0,
            font: "24px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: true,
            selected: false,
            visible: true,
            xOrder: 0,
            background: {
                width: 340,
                height: 70,
                xOffset: 0,
                yOffset: 0,
                visible: true
            },
            colorPicker: {
                centerX: 260,
                centerY: 240,
                radius: 30,
                indicatorX: indicatorPos2.x,
                indicatorY: indicatorPos2.y,
                indicatorSize: 4,
                glowRadius: 10,
                indicatorStrokeWidth: 1,
                mode: "none",
                value: hsv2,
                preview: {
                    x: 330,
                    y: 240,
                    size: 40
                },
                brightnessSlider: {
                    x: 308,
                    y: 240,
                    width: 4,
                    height: 40,
                    value: hsv2.brightness
                },
                onChange: createOnChangeHandler(["mainBackground", "end"])
            }
        });

        // Menu BG Start Color Picker
        const color3 = this.gameMaster.persistentParty.colors.menuBackground.start;
        const hsv3 = rgbToHsv(color3);
        const centerX3 = 260;
        const centerY3 = 320;
        const radius3 = 30;
        const indicatorPos3 = calculateIndicatorPosition(hsv3, centerX3, centerY3, radius3);

        this.addElement("main", {
            name: "menuBgStart",
            type: "colorPicker",
            x: 40,
            y: 320,
            width: 340,
            height: 70,
            glowIntensity: 15,
            text: "Menu BG 1",
            textOffsetX: 10,
            textOffsetY: 0,
            font: "24px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: true,
            selected: false,
            visible: true,
            xOrder: 0,
            background: {
                width: 340,
                height: 70,
                xOffset: 0,
                yOffset: 0,
                visible: true
            },
            colorPicker: {
                centerX: 260,
                centerY: 320,
                radius: 30,
                indicatorX: indicatorPos3.x,
                indicatorY: indicatorPos3.y,
                indicatorSize: 4,
                glowRadius: 10,
                indicatorStrokeWidth: 1,
                mode: "none",
                value: hsv3,
                preview: {
                    x: 330,
                    y: 320,
                    size: 40
                },
                brightnessSlider: {
                    x: 308,
                    y: 320,
                    width: 4,
                    height: 40,
                    value: hsv3.brightness
                },
                onChange: createOnChangeHandler(["menuBackground", "start"])
            }
        });

        // Menu BG End Color Picker
        const color4 = this.gameMaster.persistentParty.colors.menuBackground.end;
        const hsv4 = rgbToHsv(color4);
        const centerX4 = 260;
        const centerY4 = 400;
        const radius4 = 30;
        const indicatorPos4 = calculateIndicatorPosition(hsv4, centerX4, centerY4, radius4);

        this.addElement("main", {
            name: "menuBgEnd",
            type: "colorPicker",
            x: 40,
            y: 400,
            width: 340,
            height: 70,
            glowIntensity: 15,
            text: "Menu BG 2",
            textOffsetX: 10,
            textOffsetY: 0,
            font: "24px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: true,
            selected: false,
            visible: true,
            xOrder: 0,
            background: {
                width: 340,
                height: 70,
                xOffset: 0,
                yOffset: 0,
                visible: true
            },
            colorPicker: {
                centerX: 260,
                centerY: 400,
                radius: 30,
                indicatorX: indicatorPos4.x,
                indicatorY: indicatorPos4.y,
                indicatorSize: 4,
                glowRadius: 10,
                indicatorStrokeWidth: 1,
                mode: "none",
                value: hsv4,
                preview: {
                    x: 330,
                    y: 400,
                    size: 40
                },
                brightnessSlider: {
                    x: 308,
                    y: 400,
                    width: 4,
                    height: 40,
                    value: hsv4.brightness
                },
                onChange: createOnChangeHandler(["menuBackground", "end"])
            }
        });
        // GlowColor Color Picker
        // Convert current hex glowColor to rgba
        const glowColorRgba = "rgba(96, 165, 250, 0.97)"; // Converted from #60A5FA
        this.gameMaster.persistentParty.colors.glowColor = glowColorRgba; // Update to rgba format

        const hsv5 = rgbToHsv(glowColorRgba);
        const centerX5 = 260;
        const centerY5 = 480;
        const radius5 = 30;
        const indicatorPos5 = calculateIndicatorPosition(hsv5, centerX5, centerY5, radius5);

        this.addElement("main", {
            name: "glowColor",
            type: "colorPicker",
            x: 40,
            y: 480,
            width: 340,
            height: 70,
            glowIntensity: 15,
            text: "Glow Color",
            textOffsetX: 10,
            textOffsetY: 0,
            font: "24px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: true,
            selected: false,
            visible: true,
            xOrder: 0,
            background: {
                width: 340,
                height: 70,
                xOffset: 0,
                yOffset: 0,
                visible: true
            },
            colorPicker: {
                centerX: 260,
                centerY: 480,
                radius: 30,
                indicatorX: indicatorPos5.x,
                indicatorY: indicatorPos5.y,
                indicatorSize: 4,
                glowRadius: 10,
                indicatorStrokeWidth: 1,
                mode: "none",
                value: hsv5,
                preview: {
                    x: 330,
                    y: 480,
                    size: 40
                },
                brightnessSlider: {
                    x: 308,
                    y: 480,
                    width: 4,
                    height: 40,
                    value: hsv5.brightness
                },
                onChange: createOnChangeHandler(["glowColor", null])
            }
        });

        // More Colors Label for right panel
        this.addElement("main", {
            name: "moreColorsLabel",
            type: "textLabel",
            x: 420,
            y: 112,
            width: 360,
            height: 30,
            text: "More Colors",
            font: "15px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: false,
            background: {
                visible: false,
                width: 360,
                height: 30,
                xOffset: 0,
                yOffset: 0
            }
        });

        // NormalText Color Picker
        const color6 = this.gameMaster.persistentParty.colors.normalText;
        const hsv6 = rgbToHsv(color6);
        const centerX6 = 640;
        const centerY6 = 160;
        const radius6 = 30;
        const indicatorPos6 = calculateIndicatorPosition(hsv6, centerX6, centerY6, radius6);

        this.addElement("main", {
            name: "normalText",
            type: "colorPicker",
            x: 440,
            y: 160,
            width: 320,
            height: 70,
            glowIntensity: 15,
            text: "Normal Text",
            textOffsetX: 10,
            textOffsetY: 0,
            font: "24px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: true,
            selected: false,
            visible: true,
            xOrder: 1,
            background: {
                width: 320,
                height: 70,
                xOffset: 0,
                yOffset: 0,
                visible: true
            },
            colorPicker: {
                centerX: 640,
                centerY: 160,
                radius: 30,
                indicatorX: indicatorPos6.x,
                indicatorY: indicatorPos6.y,
                indicatorSize: 4,
                glowRadius: 10,
                indicatorStrokeWidth: 1,
                mode: "none",
                value: hsv6,
                preview: {
                    x: 710,
                    y: 160,
                    size: 40
                },
                brightnessSlider: {
                    x: 688,
                    y: 160,
                    width: 4,
                    height: 40,
                    value: hsv6.brightness
                },
                onChange: createOnChangeHandler(["normalText", null])
            }
        });

        // SelectedText Color Picker
        const color7 = this.gameMaster.persistentParty.colors.selectedText;
        const hsv7 = rgbToHsv(color7);
        const centerX7 = 640;
        const centerY7 = 240;
        const radius7 = 30;
        const indicatorPos7 = calculateIndicatorPosition(hsv7, centerX7, centerY7, radius7);

        this.addElement("main", {
            name: "selectedText",
            type: "colorPicker",
            x: 440,
            y: 240,
            width: 320,
            height: 70,
            glowIntensity: 15,
            text: "Sel. Text",
            textOffsetX: 10,
            textOffsetY: 0,
            font: "24px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: true,
            selected: false,
            visible: true,
            xOrder: 1,
            background: {
                width: 320,
                height: 70,
                xOffset: 0,
                yOffset: 0,
                visible: true
            },
            colorPicker: {
                centerX: 640,
                centerY: 240,
                radius: 30,
                indicatorX: indicatorPos7.x,
                indicatorY: indicatorPos7.y,
                indicatorSize: 4,
                glowRadius: 10,
                indicatorStrokeWidth: 1,
                mode: "none",
                value: hsv7,
                preview: {
                    x: 710,
                    y: 240,
                    size: 40
                },
                brightnessSlider: {
                    x: 688,
                    y: 240,
                    width: 4,
                    height: 40,
                    value: hsv7.brightness
                },
                onChange: createOnChangeHandler(["selectedText", null])
            }
        });

        // SelectedBackground Start Color Picker
        const color8 = this.gameMaster.persistentParty.colors.selectedBackground.start;
        const hsv8 = rgbToHsv(color8);
        const centerX8 = 640;
        const centerY8 = 320;
        const radius8 = 30;
        const indicatorPos8 = calculateIndicatorPosition(hsv8, centerX8, centerY8, radius8);

        this.addElement("main", {
            name: "selectedBgStart",
            type: "colorPicker",
            x: 440,
            y: 320,
            width: 320,
            height: 70,
            glowIntensity: 15,
            text: "Sel. BG 1",
            textOffsetX: 10,
            textOffsetY: 0,
            font: "24px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: true,
            selected: false,
            visible: true,
            xOrder: 1,
            background: {
                width: 320,
                height: 70,
                xOffset: 0,
                yOffset: 0,
                visible: true
            },
            colorPicker: {
                centerX: 640,
                centerY: 320,
                radius: 30,
                indicatorX: indicatorPos8.x,
                indicatorY: indicatorPos8.y,
                indicatorSize: 4,
                glowRadius: 10,
                indicatorStrokeWidth: 1,
                mode: "none",
                value: hsv8,
                preview: {
                    x: 710,
                    y: 320,
                    size: 40
                },
                brightnessSlider: {
                    x: 688,
                    y: 320,
                    width: 4,
                    height: 40,
                    value: hsv8.brightness
                },
                onChange: createOnChangeHandler(["selectedBackground", "start"])
            }
        });

        // SelectedBackground End Color Picker
        const color9 = this.gameMaster.persistentParty.colors.selectedBackground.end;
        const hsv9 = rgbToHsv(color9);
        const centerX9 = 640;
        const centerY9 = 400;
        const radius9 = 30;
        const indicatorPos9 = calculateIndicatorPosition(hsv9, centerX9, centerY9, radius9);

        this.addElement("main", {
            name: "selectedBgEnd",
            type: "colorPicker",
            x: 440,
            y: 400,
            width: 320,
            height: 70,
            glowIntensity: 15,
            text: "Sel. BG 2",
            textOffsetX: 10,
            textOffsetY: 0,
            font: "24px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: true,
            selected: false,
            visible: true,
            xOrder: 1,
            background: {
                width: 320,
                height: 70,
                xOffset: 0,
                yOffset: 0,
                visible: true
            },
            colorPicker: {
                centerX: 640,
                centerY: 400,
                radius: 30,
                indicatorX: indicatorPos9.x,
                indicatorY: indicatorPos9.y,
                indicatorSize: 4,
                glowRadius: 10,
                indicatorStrokeWidth: 1,
                mode: "none",
                value: hsv9,
                preview: {
                    x: 710,
                    y: 400,
                    size: 40
                },
                brightnessSlider: {
                    x: 688,
                    y: 400,
                    width: 4,
                    height: 40,
                    value: hsv9.brightness
                },
                onChange: createOnChangeHandler(["selectedBackground", "end"])
            }
        });

        // PanelBorder Light Color Picker
        const color10 = this.gameMaster.persistentParty.colors.panelBorder.light;
        const hsv10 = rgbToHsv(color10);
        const centerX10 = 640;
        const centerY10 = 480;
        const radius10 = 30;
        const indicatorPos10 = calculateIndicatorPosition(hsv10, centerX10, centerY10, radius10);

        this.addElement("main", {
            name: "panelBorderLight",
            type: "colorPicker",
            x: 440,
            y: 480,
            width: 320,
            height: 70,
            glowIntensity: 15,
            text: "Panel Border",
            textOffsetX: 10,
            textOffsetY: 0,
            font: "24px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: true,
            selected: false,
            visible: true,
            xOrder: 1,
            background: {
                width: 320,
                height: 70,
                xOffset: 0,
                yOffset: 0,
                visible: true
            },
            colorPicker: {
                centerX: 640,
                centerY: 480,
                radius: 30,
                indicatorX: indicatorPos10.x,
                indicatorY: indicatorPos10.y,
                indicatorSize: 4,
                glowRadius: 10,
                indicatorStrokeWidth: 1,
                mode: "none",
                value: hsv10,
                preview: {
                    x: 710,
                    y: 480,
                    size: 40
                },
                brightnessSlider: {
                    x: 688,
                    y: 480,
                    width: 4,
                    height: 40,
                    value: hsv10.brightness
                },
                onChange: createOnChangeHandler(["panelBorder", "light"])
            }
        });

        this.addElement("main", {
            name: "resetColorsButton",
            type: "textButton",
            x: 520,
            y: 560, // positioning in bottom right
            width: 200,
            height: 40,
            text: "Reset All Colors",
            textOffsetX: 20,
            textOffsetY: 0,
            font: "25px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: true,
            selected: false,
            xOrder: 1,
            background: {
                width: 260,
                height: 40,
                xOffset: 0,
                yOffset: 0,
                visible: true
            },
            button: {
                onClick: () => this.resetAllColors()
            }
        });

        this.registerElements();
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

        if (validElements.length === 0) return;

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
    
    
    resetAllColors() {
        // Update each color individually to maintain references
        const defaults = JSON.parse(JSON.stringify(DEFAULT_COLORS));

        // Update each color individually
        Object.keys(defaults).forEach((key) => {
            if (typeof defaults[key] === "object") {
                Object.keys(defaults[key]).forEach((subKey) => {
                    this.gameMaster.persistentParty.colors[key][subKey] = defaults[key][subKey];
                });
            } else {
                this.gameMaster.persistentParty.colors[key] = defaults[key];
            }
        });

        // Now update all the visual elements
        const colorPickers = Array.from(this.elements.values()).filter((element) => element.type === "colorPicker");

        colorPickers.forEach((picker) => {
            // Get the current color from game state
            let color;
            switch (picker.name) {
                case "mainBgStart":
                    color = this.gameMaster.persistentParty.colors.mainBackground.start;
                    break;
                case "mainBgEnd":
                    color = this.gameMaster.persistentParty.colors.mainBackground.end;
                    break;
                case "menuBgStart":
                    color = this.gameMaster.persistentParty.colors.menuBackground.start;
                    break;
                case "menuBgEnd":
                    color = this.gameMaster.persistentParty.colors.menuBackground.end;
                    break;
                case "glowColor":
                    color = this.gameMaster.persistentParty.colors.glowColor;
                    break;
                case "normalText":
                    color = this.gameMaster.persistentParty.colors.normalText;
                    break;
                case "selectedText":
                    color = this.gameMaster.persistentParty.colors.selectedText;
                    break;
                case "selectedBgStart":
                    color = this.gameMaster.persistentParty.colors.selectedBackground.start;
                    break;
                case "selectedBgEnd":
                    color = this.gameMaster.persistentParty.colors.selectedBackground.end;
                    break;
                case "panelBorderLight":
                    color = this.gameMaster.persistentParty.colors.panelBorder.light;
                    break;
            }

            // Update the color picker's HSV value
            const hsv = this.rgbToHsv(color);
            picker.colorPicker.value = hsv;

            // Update brightness slider value
            if (picker.colorPicker.brightnessSlider) {
                picker.colorPicker.brightnessSlider.value = hsv.brightness;
            }

            // Update the visual indicator position
            const indicatorPos = this.calculateIndicatorPosition(
                hsv,
                picker.colorPicker.centerX,
                picker.colorPicker.centerY,
                picker.colorPicker.radius
            );
            picker.colorPicker.indicatorX = indicatorPos.x;
            picker.colorPicker.indicatorY = indicatorPos.y;
        });
    }

    // Make the utility functions available as methods
    rgbToHsv(rgba) {
        const matches = rgba.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
        const r = parseInt(matches[1]);
        const g = parseInt(matches[2]);
        const b = parseInt(matches[3]);

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        const brightness = max / 255;
        const saturation = max === 0 ? 0 : delta / max;

        let hue;
        if (delta === 0) {
            hue = 0;
        } else if (max === r) {
            hue = ((g - b) / delta) % 6;
        } else if (max === g) {
            hue = (b - r) / delta + 2;
        } else {
            hue = (r - g) / delta + 4;
        }
        hue = Math.round(hue * 60);
        if (hue < 0) hue += 360;

        return { hue, saturation, brightness };
    }

    calculateIndicatorPosition(hsv, centerX, centerY, radius) {
        const angleInRadians = (((360 - hsv.hue) % 360) * Math.PI) / 180;
        return {
            x: centerX + Math.cos(angleInRadians) * (hsv.saturation * radius),
            y: centerY - Math.sin(angleInRadians) * (hsv.saturation * radius)
        };
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
    
    handleAction1() {
        if (!this.currentFocus) return;
        const element = this.currentFocus;

        if (element.type === "colorPicker") {
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
        }
    }

    handleAction2() {
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