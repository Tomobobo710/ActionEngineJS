class ConfigMenu extends BaseFullScreenMenu {
    constructor(ctx, input, gameMaster) {
        super(ctx, input, gameMaster);
        this.adjustingColor = false;

        // Title panel at top
        this.addElement("main", {
            name: "titlePanel",
            type: "panel",
            x: 40,
            y: 20,
            width: 720,
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
            x: 40,
            y: 100,
            width: 720,
            height: 440,
            focusable: false,
            background: {
                visible: false,
                width: 720,
                height: 440,
                xOffset: 0,
                yOffset: 0
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
            x: 50,
            y: 50,
            width: 400,
            height: 40,
            text: "Configuration",
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
            x: 60,
            y: 120,
            width: 360,
            height: 30,
            text: "Background Colors",
            font: "20px monospace",
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

        // Main BG Start Color Picker
const color1 = this.gameMaster.persistentParty.colors.mainBackground.start;
const matches1 = color1.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
const r1 = parseInt(matches1[1]);
const g1 = parseInt(matches1[2]);
const b1 = parseInt(matches1[3]);

// Convert RGB to HSV using the same algorithm as in your code
const max1 = Math.max(r1, g1, b1);
const min1 = Math.min(r1, g1, b1);
const delta1 = max1 - min1;
const brightness1 = max1 / 255;
const saturation1 = max1 === 0 ? 0 : delta1 / max1;

let hue1;
if (delta1 === 0) {
    hue1 = 0;
} else if (max1 === r1) {
    hue1 = ((g1 - b1) / delta1) % 6;
} else if (max1 === g1) {
    hue1 = (b1 - r1) / delta1 + 2;
} else {
    hue1 = (r1 - g1) / delta1 + 4;
}
hue1 = Math.round(hue1 * 60);
if (hue1 < 0) hue1 += 360;

// Calculate angle in radians
// Flip the angle to match the wheel orientation
const angleInRadians1 = (((360 - hue1) % 360) * Math.PI) / 180;

const centerX1 = 280;
const centerY1 = 180;
const radius1 = 30;
const indicatorX1 = centerX1 + Math.cos(angleInRadians1) * (saturation1 * radius1);
// Use negative sin to account for canvas Y-axis being flipped
const indicatorY1 = centerY1 - Math.sin(angleInRadians1) * (saturation1 * radius1);

        this.addElement("main", {
            name: "mainBgStart",
            type: "colorPicker",
            x: 60,
            y: 180,
            width: 360,
            height: 80,
            glowIntensity: 15,
            text: "Main BG Start",
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
                width: 360,
                height: 80,
                xOffset: 0,
                yOffset: 0,
                visible: true
            },
            colorPicker: {
                centerX: 280,
                centerY: 180,
                radius: 30,
                indicatorX: indicatorX1,
                indicatorY: indicatorY1,
                indicatorSize: 4,
                glowRadius: 10,
                indicatorStrokeWidth: 1,
                mode: "none",
                value: { hue: hue1, saturation: saturation1, brightness: brightness1 },
                preview: {
                    x: 340,
                    y: 180,
                    size: 40
                },
                brightnessSlider: {
                    x: 320,
                    y: 180,
                    width: 4,
                    height: 40,
                    value: brightness1
                },
                onChange: (value) => {
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
                    this.gameMaster.persistentParty.colors.mainBackground.start = rgba;

                    // Update preview with the actual RGBA color
                    return rgba;
                }
            }
        });

        // Main BG End Color Picker
        const color2 = this.gameMaster.persistentParty.colors.mainBackground.end;
        const matches2 = color2.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
        const r2 = parseInt(matches2[1]);
        const g2 = parseInt(matches2[2]);
        const b2 = parseInt(matches2[3]);

        // Convert RGB to HSV using the same algorithm
        const max2 = Math.max(r2, g2, b2);
        const min2 = Math.min(r2, g2, b2);
        const brightness2 = max2 / 255;
        const delta2 = max2 - min2;
        const saturation2 = max2 === 0 ? 0 : delta2 / max2;

        let hue2;
        if (delta2 === 0) {
            hue2 = 0;
        } else if (max2 === r2) {
            hue2 = ((g2 - b2) / delta2) % 6;
        } else if (max2 === g2) {
            hue2 = (b2 - r2) / delta2 + 2;
        } else {
            hue2 = (r2 - g2) / delta2 + 4;
        }
        hue2 = Math.round(hue2 * 60);
        if (hue2 < 0) hue2 += 360;

        // Calculate angle in radians
        // Flip the angle to match the wheel orientation
        const angleInRadians2 = (((360 - hue2) % 360) * Math.PI) / 180;

        const centerX2 = 280;
        const centerY2 = 270;
        const radius2 = 30;
        const indicatorX2 = centerX2 + Math.cos(angleInRadians2) * (saturation2 * radius2);
        // Use negative sin to account for canvas Y-axis being flipped
        const indicatorY2 = centerY2 - Math.sin(angleInRadians2) * (saturation2 * radius2);

        this.addElement("main", {
            name: "mainBgEnd",
            type: "colorPicker",
            x: 60,
            y: 270,
            width: 360,
            height: 80,
            glowIntensity: 15,
            text: "Main BG End",
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
                width: 360,
                height: 80,
                xOffset: 0,
                yOffset: 0,
                visible: true
            },
            colorPicker: {
                centerX: 280,
                centerY: 270,
                radius: 30,
                indicatorX: indicatorX2,
                indicatorY: indicatorY2,
                indicatorSize: 4,
                glowRadius: 10,
                indicatorStrokeWidth: 1,
                mode: "none",
                value: { hue: hue2, saturation: saturation2, brightness: brightness2 },
                preview: {
                    x: 340,
                    y: 270,
                    size: 40
                },
                brightnessSlider: {
                    x: 320,
                    y: 270,
                    width: 4,
                    height: 40,
                    value: brightness2
                },
                onChange: (value) => {
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

                    this.gameMaster.persistentParty.colors.mainBackground.end = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.97)`;
                }
            }
        });

        // Menu BG Start Color Picker
        const color3 = this.gameMaster.persistentParty.colors.menuBackground.start;
        const matches3 = color3.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
        const r3 = parseInt(matches3[1]);
        const g3 = parseInt(matches3[2]);
        const b3 = parseInt(matches3[3]);

        // Convert RGB to HSV
        const max3 = Math.max(r3, g3, b3);
        const min3 = Math.min(r3, g3, b3);
        const brightness3 = max3 / 255;
        const delta3 = max3 - min3;
        const saturation3 = max3 === 0 ? 0 : delta3 / max3;

        let hue3;
        if (delta3 === 0) {
            hue3 = 0;
        } else if (max3 === r3) {
            hue3 = ((g3 - b3) / delta3) % 6;
        } else if (max3 === g3) {
            hue3 = (b3 - r3) / delta3 + 2;
        } else {
            hue3 = (r3 - g3) / delta3 + 4;
        }
        hue3 = Math.round(hue3 * 60);
        if (hue3 < 0) hue3 += 360;

        // Calculate angle in radians - flip angle to match wheel orientation
        const angleInRadians3 = (((360 - hue3) % 360) * Math.PI) / 180;

        const centerX3 = 280;
        const centerY3 = 360;
        const radius3 = 30;
        const indicatorX3 = centerX3 + Math.cos(angleInRadians3) * (saturation3 * radius3);
        // Use negative sin for Y coordinate
        const indicatorY3 = centerY3 - Math.sin(angleInRadians3) * (saturation3 * radius3);

        this.addElement("main", {
            name: "menuBgStart",
            type: "colorPicker",
            x: 60,
            y: 360,
            width: 360,
            height: 80,
            glowIntensity: 15,
            text: "Menu BG Start",
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
                width: 360,
                height: 80,
                xOffset: 0,
                yOffset: 0,
                visible: true
            },
            colorPicker: {
                centerX: 280,
                centerY: 360,
                radius: 30,
                indicatorX: indicatorX3,
                indicatorY: indicatorY3,
                indicatorSize: 4,
                glowRadius: 10,
                indicatorStrokeWidth: 1,
                mode: "none",
                value: { hue: hue3, saturation: saturation3, brightness: brightness3 },
                preview: {
                    x: 340,
                    y: 360,
                    size: 40
                },
                brightnessSlider: {
                    x: 320,
                    y: 360,
                    width: 4,
                    height: 40,
                    value: brightness3
                },
                onChange: (value) => {
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

                    this.gameMaster.persistentParty.colors.menuBackground.start = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.97)`;
                }
            }
        });

        // Menu BG End Color Picker
        const color4 = this.gameMaster.persistentParty.colors.menuBackground.end;
        const matches4 = color4.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
        const r4 = parseInt(matches4[1]);
        const g4 = parseInt(matches4[2]);
        const b4 = parseInt(matches4[3]);

        // Convert RGB to HSV
        const max4 = Math.max(r4, g4, b4);
        const min4 = Math.min(r4, g4, b4);
        const brightness4 = max4 / 255;
        const delta4 = max4 - min4;
        const saturation4 = max4 === 0 ? 0 : delta4 / max4;

        let hue4;
        if (delta4 === 0) {
            hue4 = 0;
        } else if (max4 === r4) {
            hue4 = ((g4 - b4) / delta4) % 6;
        } else if (max4 === g4) {
            hue4 = (b4 - r4) / delta4 + 2;
        } else {
            hue4 = (r4 - g4) / delta4 + 4;
        }
        hue4 = Math.round(hue4 * 60);
        if (hue4 < 0) hue4 += 360;

        // Calculate angle in radians - flip angle to match wheel orientation
        const angleInRadians4 = (((360 - hue4) % 360) * Math.PI) / 180;

        const centerX4 = 280;
        const centerY4 = 450;
        const radius4 = 30;
        const indicatorX4 = centerX4 + Math.cos(angleInRadians4) * (saturation4 * radius4);
        // Use negative sin for Y coordinate
        const indicatorY4 = centerY4 - Math.sin(angleInRadians4) * (saturation4 * radius4);

        this.addElement("main", {
            name: "menuBgEnd",
            type: "colorPicker",
            x: 60,
            y: 450,
            width: 360,
            height: 80,
            glowIntensity: 15,
            text: "Menu BG End",
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
                width: 360,
                height: 80,
                xOffset: 0,
                yOffset: 0,
                visible: true
            },
            colorPicker: {
                centerX: 280,
                centerY: 450,
                radius: 30,
                indicatorX: indicatorX4,
                indicatorY: indicatorY4,
                indicatorSize: 4,
                glowRadius: 10,
                indicatorStrokeWidth: 1,
                mode: "none",
                value: { hue: hue4, saturation: saturation4, brightness: brightness4 },
                preview: {
                    x: 340,
                    y: 450,
                    size: 40
                },
                brightnessSlider: {
                    x: 320,
                    y: 450,
                    width: 4,
                    height: 40,
                    value: brightness4
                },
                onChange: (value) => {
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

                    this.gameMaster.persistentParty.colors.menuBackground.end = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.97)`;
                }
            }
        });

        this.registerElements();
    }

    update() {
        if (!this.adjustingColor) {
            if (this.input.isKeyJustPressed("DirUp")) {
                this.handleDirectionalInput("up");
            }
            if (this.input.isKeyJustPressed("DirDown")) {
                this.handleDirectionalInput("down");
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

        const currentY = current.y + current.height / 2;

        this.focusableElements.forEach((element) => {
            if (element === current) return;

            const elementY = element.y + element.height / 2;
            const deltaY = elementY - currentY;

            switch (direction) {
                case "up":
                    if (deltaY >= 0) return;
                    break;
                case "down":
                    if (deltaY <= 0) return;
                    break;
            }

            const distance = Math.abs(deltaY);

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