class ConfigMenu extends BaseFullScreenMenu {
   constructor(ctx, input, gameMaster) {
       super(ctx, input, gameMaster);
       this.sprites = {};
       this.loadSprites();
       this.adjustingSlider = false;
       this.adjustingColor = false;

       // First create our panels to establish layout
       this.addElement("main", {
           name: "titlePanel",
           type: "panel",
           x: 40,
           y: 20,
           width: 320,
           height: 60,
           focusable: false,
           background: {
               visible: false
           },
           panel: {
               borderWidth: 2,
               drawBackground: true
           }
       });

       this.addElement("main", {
           name: "leftPanel", 
           type: "panel",
           x: 40,
           y: 100,
           width: 400,
           height: 410,
           focusable: false,
           background: {
               visible: false
           },
           panel: {
               borderWidth: 2,
               drawBackground: true
           }
       });

       this.addElement("main", {
           name: "rightPanel",
           type: "panel", 
           x: 460,
           y: 100,
           width: 300,
           height: 430,
           focusable: false,
           background: {
               visible: false
           },
           panel: {
               borderWidth: 2,
               drawBackground: true
           }
       });

       this.addElement("main", {
           name: "bottomPanel",
           type: "panel",
           x: 40,
           y: 540,
           width: 720,
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
           x: 50,
           y: 50,
           width: 400,
           height: 40,
           text: "Element Showcase",
           font: "32px monospace",
           textAlign: "left",
           textBaseline: "middle",
           focusable: false,
           background: {
               visible: false
           }
       });
       
       // Sliders section
       this.addElement("main", {
           name: "sliderLabel",
           type: "textLabel",
           x: 40,
           y: 120,
           width: 360,
           height: 30,
           text: "Sliders (One Fully Configured, One Minimal)",
           font: "15px monospace",
           textAlign: "left",
           textBaseline: "middle",
           focusable: false,
           background: {
               visible: false
           }
       });

       // Fully configured slider
       this.addElement("main", {
           name: "sliderFull",
           type: "slider",
           x: 60,
           y: 160,
           width: 360,
           height: 40,
           glowIntensity: 15,
           text: "Full Slider",
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
               height: 40,
               xOffset: 0,
               yOffset: 0,
               visible: true
           },
           slider: {
               trackX: 250,
               trackY: 160,
               knobY: 128,
               trackWidth: 150,
               trackHeight: 4,
               knobSize: 20,
               glowRadius: 15,
               roundness: 2,
               value: 0.7,
               active: false,
               interactionPadding: 20,
               onChange: (value) => console.log("Full slider:", value),
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

       // Minimal slider
       this.addElement("main", {
           name: "sliderMinimal",
           type: "slider",
           x: 60,
           y: 210,
           width: 360,
           height: 40,
           text: "Basic Slider",
           focusable: true,
           xOrder: 0,
           background: {
               width: 360,
               height: 40,
               visible: true
           },
           slider: {
               trackX: 250,
               trackY: 210,
               trackWidth: 150,
               trackHeight: 4,
               value: 0.3,
               onChange: (value) => console.log("Basic slider:", value)
           }
       });
       
       // Toggles section
       this.addElement("main", {
           name: "toggleLabel",
           type: "textLabel",
           x: 40,
           y: 250,
           width: 360,
           height: 40,
           text: "Toggles (One Fully Configured, One Minimal)",
           font: "15px monospace",
           textAlign: "left",
           textBaseline: "middle",
           focusable: false,
           background: {
               visible: false
           }
       });

       // Fully configured toggle
       this.addElement("main", {
           name: "toggleFull",
           type: "toggle",
           x: 60,
           y: 290,
           width: 360,
           height: 40,
           glowIntensity: 15,
           text: "Full Toggle",
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
               height: 40,
               xOffset: 0,
               yOffset: 0,
               visible: true
           },
           toggle: {
               x: 300,
               y: 290,
               width: 60,
               height: 30,
               knobSize: 24,
               glowRadius: 10,
               value: true,
               onChange: (value) => console.log("Full toggle:", value)
           }
       });

       // Minimal toggle
       this.addElement("main", {
           name: "toggleMinimal",
           type: "toggle",
           x: 60,
           y: 340,
           width: 360,
           height: 40,
           text: "Basic Toggle",
           focusable: true,
           xOrder: 0,
           background: {
               width: 360,
               height: 40,
               visible: true
           },
           toggle: {
               x: 300,
               y: 340,
               width: 60,
               height: 30,
               value: false,
               onChange: (value) => console.log("Basic toggle:", value)
           }
       });
       
       
       // Color picker section
       this.addElement("main", {
           name: "colorLabel",
           type: "textLabel",
           x: 40,
           y: 380,
           width: 360,
           height: 30,
           text: "Color Picker (Fully Configured)",
           font: "15px monospace",
           textAlign: "left",
           textBaseline: "middle",
           focusable: false,
           background: {
               visible: false
           }
       });

       // Fully configured color picker
       this.addElement("main", {
           name: "colorFull",
           type: "colorPicker",
           x: 60,
           y: 450,
           width: 360,
           height: 100,
           glowIntensity: 15,
           text: "Choose Color",
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
               height: 100,
               xOffset: 0,
               yOffset: 0,
               visible: true
           },
           colorPicker: {
               centerX: 280,
               centerY: 450,
               radius: 40,
               indicatorX: 280,
               indicatorY: 450,
               indicatorSize: 4,
               glowRadius: 10,
               indicatorStrokeWidth: 1,
               mode: "none",
               value: { hue: 180, saturation: 0.8, brightness: 0.5 },
               preview: {
                   x: 360,
                   y: 450,
                   size: 50
               },
               brightnessSlider: {
                   x: 340,
                   y: 450,
                   width: 4,
                   height: 50,
                   value: 0.5
               },
               onChange: (value) => console.log("Color picker:", value)
           }
       });

       // Right panel elements
       // Buttons section
       this.addElement("main", {
           name: "textButtonLabel",
           type: "textLabel",
           x: 460,
           y: 120,
           width: 360,
           height: 30,
           text: "Text Buttons (Full and Minimal)",
           font: "15px monospace",
           textAlign: "left",
           textBaseline: "middle",
           focusable: false,
           background: {
               visible: false
           }
       });

       // Fully configured text button
       this.addElement("main", {
           name: "textButtonFull",
           type: "textButton",
           x: 480,
           y: 160,
           width: 250,
           height: 40,
           glowIntensity: 15,
           text: "Full Text Button",
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
               width: 250,
               height: 40,
               xOffset: 0,
               yOffset: 0,
               visible: true
           },
           button: {
               pressed: false,
               onClick: () => console.log("Full button clicked!")
           }
       });

       // Minimal text button
       this.addElement("main", {
           name: "textButtonMinimal",
           type: "textButton",
           x: 480,
           y: 210,
           width: 250,
           height: 40,
           text: "Basic Text Button",
           focusable: true,
           xOrder: 1,
           background: {
               width: 250,
               height: 40,
               visible: true
           },
           button: {
               onClick: () => console.log("Basic button clicked!")
           }
       });
       
       // Image buttons label
       this.addElement("main", {
           name: "imageButtonLabel",
           type: "textLabel",
           x: 460,
           y: 250,
           width: 360,
           height: 30,
           text: "Image Buttons (Full and Minimal)",
           font: "15px monospace",
           textAlign: "left",
           textBaseline: "middle",
           focusable: false,
           background: {
               visible: false
           }
       });
       
       // Image buttons with sprites
       this.addElement("main", {
           name: "imageButtonFull",
           type: "imageButton",
           x: 480,
           y: 290,
           width: 32,
           height: 32,
           glowIntensity: 15,
           focusable: true,
           selected: false,
           visible: true,
           xOrder: 1,
           background: {
               width: 40,
               height: 40,
               xOffset: 0,
               yOffset: 0,
               visible: true
           },
           image: {
               sprite: this.sprites.warrior,
               smoothing: false
           },
           button: {
               pressed: false,
               onClick: () => console.log("Warrior clicked!")
           }
       });
       
       // Minimal image button
       this.addElement("main", {
           name: "imageButtonMinimal",
           type: "imageButton",
           x: 580,
           y: 290,
           width: 32,
           height: 32,
           focusable: true,
           xOrder: 1,
           background: {
               width: 40,
               height: 40,
               visible: true
           },
           image: {
               sprite: this.sprites.thief,
               smoothing: false
           },
           button: {
               onClick: () => console.log("Thief clicked!")
           }
       });

       // Selectable section
       this.addElement("main", {
           name: "selectableLabel",
           type: "textLabel",
           x: 460,
           y: 330,
           width: 360,
           height: 30,
           text: "Selectables (Full and Minimal)",
           font: "15px monospace",
           textAlign: "left",
           textBaseline: "middle",
           focusable: false,
           background: {
               visible: false
           }
       });

       // Fully configured selectable
       this.addElement("main", {
           name: "selectableFull",
           type: "selectable",
           x: 480,
           y: 370,
           width: 250,
           height: 40,
           glowIntensity: 15,
           text: "Full Selectable",
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
               width: 250,
               height: 40,
               xOffset: 0,
               yOffset: 0,
               visible: true
           },
           selectable: {
               onClick: () => console.log("Full selectable clicked!")
           }
       });

       // Minimal selectable
       this.addElement("main", {
           name: "selectableMinimal",
           type: "selectable",
           x: 480,
           y: 420,
           width: 250,
           height: 40,
           text: "Basic Selectable",
           focusable: true,
           xOrder: 1,
           background: {
               width: 250,
               height: 40,
               visible: true
           },
           selectable: {
               onClick: () => console.log("Basic selectable clicked!")
           }
       });

       // Image labels section
       this.addElement("main", {
           name: "imageLabelTitle",
           type: "textLabel",
           x: 460,
           y: 460,
           width: 360,
           height: 30,
           text: "Image Labels (Full and Minimal)",
           font: "15px monospace",
           textAlign: "left",
           textBaseline: "middle",
           focusable: false,
           background: {
               visible: false
           }
       });
       
       // Fully configured image label
       this.addElement("main", {
           name: "imageLabelFull",
           type: "imageLabel",
           x: 480,
           y: 500,
           width: 32,
           height: 32,
           glowIntensity: 15,
           text: "",
           textOffsetX: 10,
           textOffsetY: 0,
           font: "24px monospace",
           textAlign: "left",
           textBaseline: "middle",
           focusable: false,
           selected: false,
           visible: true,
           xOrder: 0,
           background: {
               width: 40,
               height: 40,
               xOffset: 0,
               yOffset: 0,
               visible: true
           },
           image: {
               sprite: this.sprites.mage,
               smoothing: false
           }
       });

       // Minimal image label
       this.addElement("main", {
           name: "imageLabelMinimal",
           type: "imageLabel",
           x: 580,
           y: 500,
           width: 32,
           height: 32,
           focusable: false,
           background: {
               visible: false
           },
           image: {
               sprite: this.sprites.warrior,
               smoothing: false
           }
       });

       // Bottom info text
       this.addElement("main", {
           name: "infoText",
           type: "textLabel",
           x: 50,
           y: 560,
           width: 500,
           height: 30,
           text: "Use DirKeys to navigate, Action1 to interact, Action2 to cancel/exit",
           font: "18px monospace",
           textAlign: "left",
           textBaseline: "middle",
           focusable: false,
           background: {
               visible: false
           }
       });

       this.registerElements();
   }

   loadSprites() {
       ["warrior", "mage", "thief"].forEach((type) => {
           this.sprites[type] = Sprite.genHeroSprite(type);
       });
   }

   // Rest of the class methods remain unchanged
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
           case "imageButton":
               element.button.pressed = true;
               if (element.button.onClick) {
                   element.button.onClick();
               }
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