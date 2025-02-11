/**
* ConfigMenu serves as a comprehensive demo of the BaseFullScreenMenu system.
* It showcases all available UI elements and their interactions in a clean,
* well-organized layout.
*/
class ConfigMenu extends BaseFullScreenMenu {
   constructor(ctx, input, gameMaster) {
       super(ctx, input, gameMaster);

       // Load sprite assets used in the demo
       this.sprites = {};
       this.loadSprites();

       // Track special interaction states
       this.adjustingSlider = false;
       this.adjustingColor = false;

       // Layout constants
       this.MENU_MARGIN = 40;      // Outer margin around entire menu
       this.COLUMN_GAP = 20;       // Space between columns
       this.ELEMENT_SPACING = 50;  // Vertical space between elements
       
       // Calculate core layout dimensions
       this.contentWidth = Game.WIDTH - (this.MENU_MARGIN * 2);
       this.leftColWidth = Math.floor(this.contentWidth * 0.6);
       this.rightColWidth = this.contentWidth - this.leftColWidth - this.COLUMN_GAP;

       // Create the menu structure
       this.setupPanels();          // Visual container hierarchy
       this.setupBasicControls();   // Sliders and toggles section
       this.setupColorPicker();     // Color picker demonstration  
       this.setupButtons();         // Various button types
       this.setupPreviewSection();  // Right column with sprites/selection
       this.setupInfoSection();     // Bottom info area

       this.registerElements();
   }

   setupPanels() {
       // Header panel spans the full width
       this.addElement("main", {
           name: "headerPanel",
           type: "panel",
           x: this.MENU_MARGIN,
           y: this.MENU_MARGIN,
           width: this.contentWidth,
           height: 60,
           background: { visible: false },
           panel: { borderWidth: 2, drawBackground: true }
       });

       // Left column contains most interactive elements
       this.addElement("main", {
           name: "leftColumnPanel",
           type: "panel",
           x: this.MENU_MARGIN,
           y: this.MENU_MARGIN + 80,
           width: this.leftColWidth,
           height: 440,
           background: { visible: false },
           panel: { borderWidth: 2, drawBackground: true }
       });

       // Right column for preview and selection demo
       this.addElement("main", {
           name: "rightColumnPanel",
           type: "panel",
           x: this.MENU_MARGIN + this.leftColWidth + this.COLUMN_GAP,
           y: this.MENU_MARGIN + 80,
           width: this.rightColWidth,
           height: 440,
           background: { visible: false },
           panel: { borderWidth: 2, drawBackground: true }
       });

       // Info panel spans the bottom
       this.addElement("main", {
           name: "infoPanel",
           type: "panel",
           x: this.MENU_MARGIN,
           y: Game.HEIGHT - this.MENU_MARGIN - 60,
           width: this.contentWidth,
           height: 60,
           background: { visible: false },
           panel: { borderWidth: 2, drawBackground: true }
       });
   }
    
    setupBasicControls() {
       // Starting position for controls section
       const startX = this.MENU_MARGIN + 30;
       const startY = this.MENU_MARGIN + 120;
       const controlWidth = this.leftColWidth - 60;

       // Slider with default styling and basic value display
       this.addElement("main", {
           name: "basicSlider",
           type: "slider",
           x: startX,
           y: startY,
           width: controlWidth,
           height: 40,
           text: "Basic Slider",
           xOrder: 0,
           background: { visible: true },
           slider: {
               trackX: startX + 200,
               trackY: startY,
               trackWidth: 150,
               value: 0.7,
               onChange: (value) => console.log("Basic Slider:", value)
           }
       });

       // Slider with custom value formatting
       this.addElement("main", {
           name: "percentSlider",
           type: "slider",
           x: startX,
           y: startY + this.ELEMENT_SPACING,
           width: controlWidth,
           height: 40,
           text: "Percentage",
           xOrder: 0,
           background: { visible: true },
           slider: {
               trackX: startX + 200,
               trackY: startY + this.ELEMENT_SPACING,
               trackWidth: 150,
               value: 0.5,
               onChange: (value) => console.log("Percentage:", Math.round(value * 100) + "%")
           }
       });

       // Basic toggle switch
       this.addElement("main", {
           name: "basicToggle",
           type: "toggle",
           x: startX,
           y: startY + this.ELEMENT_SPACING * 2,
           width: controlWidth,
           height: 40,
           text: "Basic Toggle",
           xOrder: 0,
           background: { visible: true },
           toggle: {
               x: startX + 200,
               y: startY + this.ELEMENT_SPACING * 2 - 15,
               value: true,
               onChange: (value) => console.log("Toggle:", value)
           }
       });

       // Toggle that controls visibility of another element
       this.addElement("main", {
           name: "linkedToggle",
           type: "toggle",
           x: startX,
           y: startY + this.ELEMENT_SPACING * 3,
           width: controlWidth,
           height: 40,
           text: "Show Extra",
           xOrder: 0,
           background: { visible: true },
           toggle: {
               x: startX + 200,
               y: startY + this.ELEMENT_SPACING * 3 - 15,
               value: false,
               onChange: (value) => {
                   // Demonstrate element interaction by controlling visibility
                   const extraSlider = this.elements.get("extraSlider");
                   if (extraSlider) extraSlider.visible = value;
               }
           }
       });

       // Hidden by default, controlled by linkedToggle
       this.addElement("main", {
           name: "extraSlider",
           type: "slider",
           x: startX,
           y: startY + this.ELEMENT_SPACING * 4,
           width: controlWidth,
           height: 40,
           text: "Extra Setting",
           visible: false,
           xOrder: 0,
           background: { visible: true },
           slider: {
               trackX: startX + 200,
               trackY: startY + this.ELEMENT_SPACING * 4,
               trackWidth: 150,
               value: 0.3,
               onChange: (value) => console.log("Extra:", value)
           }
       });
   }
setupColorPicker() {
       // Position the color picker below the basic controls
       const startX = this.MENU_MARGIN + 30;
       const startY = this.MENU_MARGIN + 320;
       const previewSize = 50;

       // Color picker with preview and brightness slider
       this.addElement("main", {
           name: "themePicker",
           type: "colorPicker",
           x: startX,
           y: startY,
           width: 300,
           height: 200,
           text: "Theme Color",
           xOrder: 0,
           background: { visible: true },
           colorPicker: {
               // Main color wheel configuration
               centerX: startX + 175,
               centerY: startY + 80,
               radius: 75,
               indicatorX: startX + 175,
               indicatorY: startY + 80,
               indicatorSize: 6,
               mode: "none",
               
               // Initial color value
               value: { 
                   hue: 180, 
                   saturation: 0.8, 
                   brightness: 0.5 
               },
               
               // Color preview box
               preview: {
                   x: startX + 275,
                   y: startY + 25,
                   size: previewSize
               },
               
               // Vertical brightness slider
               brightnessSlider: {
                   x: startX + 275 + previewSize + 20,
                   y: startY + 25,
                   width: 4,
                   height: 150,
                   value: 0.5
               },
               
               // Color change handler
               onChange: (value) => {
                   console.log("Color:", value);
                   // In a real app, this would update the theme color
               }
           }
       });
   }
    
  setupButtons() {
       // Position buttons at the bottom of the left column
       const startX = this.MENU_MARGIN + 30;
       const startY = this.MENU_MARGIN + 540;
       const buttonWidth = 200;
       const buttonHeight = 40;

       // Standard text button with hover and click states
       this.addElement("main", {
           name: "textButton",
           type: "textButton",
           x: startX,
           y: startY,
           width: buttonWidth,
           height: buttonHeight,
           text: "Text Button",
           xOrder: 0,
           background: { visible: true },
           button: {
               pressed: false,
               onClick: () => console.log("Text button clicked!")
           }
       });

       // Label to demonstrate non-interactive text
       this.addElement("main", {
           name: "demoLabel",
           type: "textLabel",
           x: startX + buttonWidth + 40,
           y: startY,
           width: buttonWidth,
           height: buttonHeight,
           text: "Static Label",
           background: { visible: false }
       });

       // Selectable option that maintains selection state
       this.addElement("main", {
           name: "selectOption",
           type: "selectable",
           x: startX,
           y: startY + buttonHeight + 20,
           width: buttonWidth,
           height: buttonHeight,
           text: "Selectable Option",
           xOrder: 0,
           background: { visible: true },
           selectable: {
               onClick: () => console.log("Option selected!")
           }
       });

       // Image button using sprite asset
       this.addElement("main", {
           name: "spriteButton",
           type: "imageButton",
           x: startX + buttonWidth + 40,
           y: startY + buttonHeight + 10,
           width: 64,
           height: 64,
           xOrder: 0,
           background: { visible: true },
           image: {
               sprite: this.sprites.warrior,
               smoothing: false
           },
           button: {
               pressed: false,
               onClick: () => console.log("Sprite button clicked!")
           }
       });
   }
    
    setupPreviewSection() {
       // Right column layout for character preview demo
       const startX = this.MENU_MARGIN + this.leftColWidth + this.COLUMN_GAP + 30;
       const startY = this.MENU_MARGIN + 120;
       const previewWidth = this.rightColWidth - 60;

       // Header for the preview section
       this.addElement("main", {
           name: "previewHeader",
           type: "textLabel",
           x: startX,
           y: startY,
           width: previewWidth,
           height: 40,
           text: "Character Preview",
           font: "28px monospace",
           background: { visible: false }
       });

       // Demonstrate selectable items with sprites
       const characters = [
           { name: "Warrior", sprite: this.sprites.warrior },
           { name: "Mage", sprite: this.sprites.mage },
           { name: "Thief", sprite: this.sprites.thief }
       ];

       characters.forEach((char, index) => {
           // Character name label
           this.addElement("main", {
               name: `${char.name}Label`,
               type: "textLabel",
               x: startX,
               y: startY + 80 + (index * 100),
               width: 100,
               height: 40,
               text: char.name,
               background: { visible: false }
           });

           // Character sprite display
           this.addElement("main", {
               name: `${char.name}Sprite`,
               type: "imageLabel",
               x: startX + 120,
               y: startY + 70 + (index * 100),
               width: 64,
               height: 64,
               image: {
                   sprite: char.sprite,
                   smoothing: false
               },
               background: { visible: false }
           });

           // Selectable button for character
           this.addElement("main", {
               name: `${char.name}Select`,
               type: "selectable",
               x: startX + 200,
               y: startY + 80 + (index * 100),
               width: 100,
               height: 40,
               text: "Select",
               xOrder: 1,
               background: { visible: true },
               selectable: {
                   onClick: () => console.log(`${char.name} selected!`)
               }
           });
       });
   }
    
    setupInfoSection() {
       // Info panel at the bottom
       const startX = this.MENU_MARGIN + 20;
       const startY = Game.HEIGHT - this.MENU_MARGIN - 45;

       // Demonstration of a simple text label for info/help text
       this.addElement("main", {
           name: "infoText",
           type: "textLabel",
           x: startX,
           y: startY,
           width: this.contentWidth - 40,
           height: 30,
           text: "Use arrow keys to navigate, Space to select, Esc to exit",
           font: "20px monospace",
           background: { visible: false }
       });
   }

   loadSprites() {
       // Load character sprites for the preview section
       ["warrior", "mage", "thief"].forEach((type) => {
           this.sprites[type] = Sprite.genHeroSprite(type);
       });
   }

   update() {
       // Handle directional input when not adjusting controls
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

       // Initialize focus if none exists
       if (!this.currentFocus) {
           this.currentFocus = this.focusableElements[0];
           this.currentFocus.selected = true;
           return;
       }

       const current = this.currentFocus;

       // Handle left/right column navigation
       if (direction === "left" || direction === "right") {
           const validElements = this.focusableElements.filter((element) => {
               if (direction === "right") {
                   return element.xOrder > current.xOrder;
               } else {
                   return element.xOrder < current.xOrder;
               }
           });

           if (!validElements.length) return;

           // Find closest element in the target column
           let nextElement = validElements[0];
           let bestDistance = Math.abs(nextElement.y - current.y);

           validElements.forEach((element) => {
               const distance = Math.abs(element.y - current.y);
               if (distance < bestDistance) {
                   bestDistance = distance;
                   nextElement = element;
               }
           });

           this.updateFocus(nextElement);
       } else {
           // Handle up/down navigation
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

               if ((direction === "up" && deltaY >= 0) || 
                   (direction === "down" && deltaY <= 0)) return;

               const distance = Math.abs(deltaX) + Math.abs(deltaY);
               if (distance < bestDistance) {
                   bestDistance = distance;
                   nextElement = element;
               }
           });

           if (nextElement) {
               this.updateFocus(nextElement);
           }
       }
   }

   updateFocus(newElement) {
       this.currentFocus.selected = false;
       this.currentFocus = newElement;
       this.currentFocus.selected = true;
   }

   handleAction1() {
       if (!this.currentFocus) return;
       const element = this.currentFocus;

       switch (element.type) {
           case "selectable":
               element.selectable.onClick?.();
               break;
               
           case "textButton":
           case "imageButton":
               element.button.pressed = true;
               element.button.onClick?.();
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
               element.toggle.onChange?.(element.toggle.value);
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
       // Handle canceling slider adjustment
       if (this.currentFocus?.type === "slider" && this.currentFocus.slider.active) {
           this.adjustingSlider = false;
           this.currentFocus.slider.active = false;
           return null;
       }

       // Handle canceling color picker
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
    

/*
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
            x: 100, // must define
            y: 100, // must define
            width: 340, // must define (hitbox for mouse click)
            height: 40, // must define (hitbox for mouse click)
            glowIntensity: 15, // default is ok

            // Text properties
            text: "Slider 1", // prob should define
            textOffsetX: 10, // default is ok
            textOffsetY: 0, // default is ok
            font: "24px monospace", // default is "24px monospace"
            textAlign: "left", // default is ok
            textBaseline: "middle", // default is ok

            // State properties
            focusable: true, // default is ok
            selected: false, // default is ok
            visible: true, // default is ok
            xOrder: 0, // prob should define

            // Background
            background: {
                width: 340, // must define
                height: 40, // must define
                xOffset: 0, // default is ok
                yOffset: 0, // default is ok
                visible: true // prob should define
            },

            // Slider-specific properties
            slider: {
                trackX: 270, // prob should define
                trackY: 100, // prob should define
                trackWidth: 150, // prob should define
                trackHeight: 4, // prob should define
                knobX: 345, // prob should define
                knobY: 100, // prob should define
                knobSize: 20, // default is ok
                glowRadius: 15, // default is ok
                roundness: 2, // default is ok
                value: 0.5, // prob should define
                active: false, // default is ok
                interactionPadding: 20, // default is ok
                onChange: (value) => console.log("Slider 1:", value), // must define
                valueBox: {
                    font: "16px monospace", // default is "16px monospace"
                    padding: 8, // default is ok
                    height: 30, // default is ok
                    arrow: {
                        height: 8, // default is ok
                        width: 12 // default is ok
                    },
                    verticalOffset: 15, // default is ok
                    cornerRadius: 4 // default is ok
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
            glowIntensity: 15,

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

            // Background
            background: {
                width: 340,
                height: 40,
                xOffset: 0,
                yOffset: 0,
                visible: true
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
            glowIntensity: 15,

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

            // Background
            background: {
                width: 240,
                height: 40,
                xOffset: 0,
                yOffset: 0,
                visible: true
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
            glowIntensity: 15,

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

            // Background
            background: {
                width: 240,
                height: 40,
                xOffset: 0,
                yOffset: 0,
                visible: true
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
            glowIntensity: 15,

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

            // Background
            background: {
                width: 340,
                height: 200,
                xOffset: 0,
                yOffset: 0,
                visible: true
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
            glowIntensity: 15,

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

            // Background
            background: {
                width: 200,
                height: 40,
                xOffset: 0,
                yOffset: 0,
                visible: true
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
            glowIntensity: 15,

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
            xOrder: 0,

            // Background
            background: {
                width: 240,
                height: 40,
                xOffset: 0,
                yOffset: 0,
                visible: false
            }
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
            glowIntensity: 15,

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

            // Background
            background: {
                width: 74,
                height: 74,
                xOffset: 0,
                yOffset: 0,
                visible: true
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
            glowIntensity: 15,

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

            // Background
            background: {
                width: 74,
                height: 74,
                xOffset: 0,
                yOffset: 0,
                visible: false
            },

            // Image-specific properties
            image: {
                sprite: this.sprites.mage,
                smoothing: false
            }
        });

        this.addElement("main", {
            name: "selectable1",
            type: "selectable",
            x: 500,
            y: 100,
            width: 200,
            height: 40,
            glowIntensity: 15,
            text: "Selectable 1",
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
                width: 200,
                height: 40,
                xOffset: 0,
                yOffset: 0,
                visible: true
            },
            selectable: {
                onClick: () => console.log("Selected selectable 1!")
            }
        });
        // Title panel - should span the top where text would be
this.addElement("main", {
    name: "titlePanel",
    type: "panel",
    x: 80,             // Give some margin from left edge
    y: 20,             // Small margin from top
    width: 700,        // Wide enough to span both columns
    height: 60,        // Tall enough for header text
    background: {
        visible: false
    },
    panel: {
        borderWidth: 2,
        drawBackground: true
    }
});

// Left column - contains sliders, toggles, color picker
this.addElement("main", {
    name: "leftColumnPanel",
    type: "panel",
    x: 80,             // Same left alignment as title
    y: 90,             // Just below title panel
    width: 400,        // Wide enough for sliders and their labels
    height: 440,       // Tall enough for all controls
    background: {
        visible: false
    },
    panel: {
        borderWidth: 2,
        drawBackground: true
    }
});

// Right column - contains selectable and character sprites
this.addElement("main", {
    name: "rightColumnPanel",
    type: "panel",
    x: 490,            // Some margin from left column
    y: 90,             // Aligned with left column
    width: 280,        // Wide enough for selectable and sprites
    height: 440,       // Same height as left for symmetry
    background: {
        visible: false
    },
    panel: {
        borderWidth: 2,
        drawBackground: true
    }
});

// Bottom info panel - spans bottom area
this.addElement("main", {
    name: "infoPanel",
    type: "panel",
    x: 80,             // Same left alignment
    y: 540,            // Below main columns
    width: 700,        // Same width as title panel
    height: 60,        // Enough for text
    background: {
        visible: false
    },
    panel: {
        borderWidth: 2,
        drawBackground: true
    }
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
            case "selectable":
                if (element.selectable.onClick) {
                    element.selectable.onClick();
                }
                break;
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
*/