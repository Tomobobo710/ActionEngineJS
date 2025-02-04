class RPGMenuMode {
   constructor(canvases, input, audio, gameMaster) {
       this.canvas = canvases.guiCanvas;
       this.ctx = this.canvas.getContext("2d");
       this.input = input;
       this.audio = audio;
       this.gameMaster = gameMaster;

       // Initialize sprites
       this.sprites = {};
       this.loadSprites();

       // Menu options (right side)
       this.menuOptions = [
           {
               text: "Item",
               x: Game.WIDTH - 200,
               y: 50,
               width: 160,
               height: 40,
               color: "rgba(0, 0, 102, 0.95)",
               hovered: false,
               borderGlow: 0
           },
           {
               text: "Magic",
               x: Game.WIDTH - 200,
               y: 100,
               width: 160,
               height: 40,
               color: "rgba(0, 0, 102, 0.95)",
               hovered: false,
               borderGlow: 0
           },
           {
               text: "Status",
               x: Game.WIDTH - 200,
               y: 150,
               width: 160,
               height: 40,
               color: "rgba(0, 0, 102, 0.95)",
               hovered: false,
               borderGlow: 0
           },
           {
               text: "Configure",
               x: Game.WIDTH - 200,
               y: 200,
               width: 160,
               height: 40,
               color: "rgba(0, 0, 102, 0.95)",
               hovered: false,
               borderGlow: 0
           },
           {
               text: "Save",
               x: Game.WIDTH - 200,
               y: 250,
               width: 160,
               height: 40,
               color: "rgba(0, 0, 102, 0.95)",
               hovered: false,
               borderGlow: 0
           }
       ];

       // Register menu options as interactive elements
       this.menuOptions.forEach((option, index) => {
           this.input.registerElement(`menu_option_${index}`, {
               bounds: () => ({
                   x: option.x,
                   y: option.y,
                   width: option.width,
                   height: option.height
               })
           });
       });

       this.selectedIndex = 0;
   }

   loadSprites() {
       // Load hero sprites just like in BattleMode
       ["warrior", "mage", "thief"].forEach((type) => {
           this.sprites[type] = Sprite.genHeroSprite(type);
       });
   }

   update() {
       // Update hover states and selection
       this.menuOptions.forEach((option, index) => {
           const wasHovered = option.hovered;
           option.hovered = this.input.isElementHovered(`menu_option_${index}`) || this.selectedIndex === index;
           
           if (this.input.isElementHovered(`menu_option_${index}`)) {
               this.selectedIndex = index;
           }

           if (option.hovered) {
               option.borderGlow = Math.min(option.borderGlow + 0.2, 1);
           } else {
               option.borderGlow = Math.max(option.borderGlow - 0.2, 0);
           }
       });

       // Keyboard navigation
       if (this.input.isKeyJustPressed("DirUp")) {
           this.selectedIndex = Math.max(0, this.selectedIndex - 1);
       }
       if (this.input.isKeyJustPressed("DirDown")) {
           this.selectedIndex = Math.min(this.menuOptions.length - 1, this.selectedIndex + 1);
       }

       // Menu selection
       if (this.input.isKeyJustPressed("Action1")) {
           this.handleMenuSelection(this.selectedIndex);
       }

       // Check for menu option clicks
       for (let i = 0; i < this.menuOptions.length; i++) {
           if (this.input.isElementJustPressed(`menu_option_${i}`)) {
               this.handleMenuSelection(i);
           }
       }
   }

   handleMenuSelection(index) {
       switch(this.menuOptions[index].text) {
           case "Item":
               // Handle item menu
               break;
           case "Magic":
               // Handle magic menu
               break;
           case "Status":
               // Handle status menu
               break;
           case "Configure":
               // Handle config menu
               break;
           case "Save":
               // Handle save
               this.gameMaster.modeManager.switchMode('start');
               break;
       }
   }

   draw() {
       // Clear canvas
       this.ctx.clearRect(0, 0, Game.WIDTH, Game.HEIGHT);

       // Draw background
       this.ctx.fillStyle = "rgba(0, 0, 51, 0.95)";
       this.ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);

       // Draw character info panel (left side)
       this.drawCharacterPanel();

       // Draw menu options (right side)
       this.drawMenuOptions();

       // Draw time/gil panel (bottom right)
       this.drawInfoPanel();
   }

   drawCharacterPanel() {
       const party = this.gameMaster.persistentParty;
       
       party.forEach((char, index) => {
           const x = 50;
           const y = 50 + (index * 120);

           // Draw character portrait background
           this.ctx.fillStyle = "rgba(0, 0, 102, 0.8)";
           this.ctx.fillRect(x, y, 400, 100);

           // Draw character sprite
           this.ctx.drawImage(this.sprites[char.type], x + 10, y + 10);

           // Draw character info
           this.ctx.fillStyle = "#00ffff";
           this.ctx.font = "16px monospace";
           this.ctx.textAlign = "left";
           
           // Name and level
           this.ctx.fillText(`${char.name}`, x + 80, y + 25);
           this.ctx.fillText(`LV ${char.level}`, x + 80, y + 45);

           // HP bar
           this.drawStatBar(x + 80, y + 65, char.hp, char.maxHp, "#00ff00", "HP");
           
           // MP bar
           this.drawStatBar(x + 80, y + 85, char.mp, char.maxMp, "#0000ff", "MP");
       });
   }

   drawStatBar(x, y, current, max, color, label) {
       const width = 200;
       const height = 12;

       // Bar background
       this.ctx.fillStyle = "#333333";
       this.ctx.fillRect(x, y, width, height);

       // Current value bar
       this.ctx.fillStyle = color;
       const fillWidth = (current / max) * width;
       this.ctx.fillRect(x, y, fillWidth, height);

       // Bar text
       this.ctx.fillStyle = "#ffffff";
       this.ctx.font = "12px monospace";
       this.ctx.textAlign = "left";
       this.ctx.fillText(`${label} ${current}/${max}`, x + 5, y + 10);
   }

   drawMenuOptions() {
       this.menuOptions.forEach((option, index) => {
           this.ctx.save();

           // Glow effect when selected/hovered
           if (option.hovered) {
               this.ctx.shadowColor = "#00ffff";
               this.ctx.shadowBlur = 15;
           }

           // Draw option background
           this.ctx.fillStyle = option.hovered ? 
               "rgba(0, 51, 102, 0.95)" : 
               "rgba(0, 0, 102, 0.95)";
           this.ctx.fillRect(option.x, option.y, option.width, option.height);

           // Draw option text
           this.ctx.fillStyle = option.hovered ? "#00ffff" : "#ffffff";
           this.ctx.font = "20px monospace";
           this.ctx.textAlign = "left";
           this.ctx.textBaseline = "middle";
           this.ctx.fillText(
               option.text,
               option.x + 20,
               option.y + option.height/2
           );

           this.ctx.restore();
       });
   }

   drawInfoPanel() {
       const x = Game.WIDTH - 200;
       const y = Game.HEIGHT - 100;
       
       this.ctx.fillStyle = "rgba(0, 0, 102, 0.8)";
       this.ctx.fillRect(x, y, 180, 80);

       this.ctx.fillStyle = "#00ffff";
       this.ctx.font = "16px monospace";
       this.ctx.textAlign = "right";
       
       // Time could be tracked in GameMaster
       this.ctx.fillText(`Time: 00:00`, x + 160, y + 30);
       this.ctx.fillText(`Gil: 0`, x + 160, y + 60);
   }

   pause() {
       // Handle pause state
   }

   resume() {
       // Handle resume state
   }

   cleanup() {
       this.menuOptions.forEach((_, index) => {
           this.input.removeElement(`menu_option_${index}`);
       });
   }
}