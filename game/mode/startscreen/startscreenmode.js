class StartScreenMode {
    constructor(canvases, input, audio, gameModeManager) {
        this.debugMode = true; // Enable debug mode
        this.canvas = canvases.guiCanvas;
        this.ctx = this.canvas.getContext("2d");
        this.input = input;
        this.audio = audio;
        this.gameModeManager = gameModeManager;
        this.activeMenu = null;

        // Regular menu options
        this.menuOptions = [
            {
                text: "NEW GAME",
                x: 100,
                y: Game.HEIGHT / 2 - 50,
                width: 300,
                height: 40,
                color: "rgba(0, 180, 255, 0.8)",
                hovered: false,
                borderGlow: 0
            },
            {
                text: "CONTINUE?",
                x: 100,
                y: Game.HEIGHT / 2 + 20,
                width: 300,
                height: 40,
                color: "rgba(0, 180, 255, 0.3)",
                hovered: false,
                borderGlow: 0
            }
        ];

        // Debug mode menu options
        if (this.debugMode) {
            this.gameModeManager.modes.forEach((mode, index) => {
                this.menuOptions.push({
                    text: mode.toUpperCase(),
                    x: Game.WIDTH - 400,
                    y: 50 + index * 60,
                    width: 300,
                    height: 40,
                    color: "rgba(255, 100, 100, 0.3)",
                    hovered: false,
                    borderGlow: 0
                });
            });
        }

        // Register all menu options as interactive elements
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
    
    pause() {
        // Add any pause logic here if needed
    }

    resume() {
        // Add any resume logic here if needed
    }
    
    update() {
        // If we have an active menu, update that instead
        if (this.activeMenu) {
            const result = this.activeMenu.update();
            if (result === "exit") {
                this.activeMenu.cleanup();
                this.activeMenu = null;
            }
            return;
        }

        // Regular update logic
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

        if (this.input.isKeyJustPressed("DirUp")) {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        }
        if (this.input.isKeyJustPressed("DirDown")) {
            this.selectedIndex = Math.min(this.menuOptions.length - 1, this.selectedIndex + 1);
        }

        // Handle selection for all menu options including debug
        for (let i = 0; i < this.menuOptions.length; i++) {
            if (
                this.input.isElementJustPressed(`menu_option_${i}`) ||
                (this.input.isKeyJustPressed("Action1") && this.selectedIndex === i)
            ) {
                if (i === 0) {
                    this.gameModeManager.switchMode("world");
                } else if (i === 1) {
                    // CONTINUE button - always show the load menu regardless of saves
                    this.activeMenu = new SaveGameMenu(
                        this.ctx, 
                        this.input, 
                        this.gameModeManager.gameMaster, 
                        "load"
                    );
                    this.activeMenu.registerElements();
                } else if (this.debugMode) {
                    // Debug mode buttons - direct mode switching
                    this.gameModeManager.switchMode(this.gameModeManager.modes[i - 2]);
                }
            }
        }
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, Game.WIDTH, Game.HEIGHT);
        
        // If we have an active menu, draw that instead
        if (this.activeMenu) {
            this.activeMenu.draw();
            return;
        }

        // Draw menu options with FF7R-style effects
        this.menuOptions.forEach((option, index) => {
            this.ctx.save();

            // Glow effect when hovered/selected
            if (option.hovered || index === this.selectedIndex) {
                this.ctx.shadowColor = option.color;
                this.ctx.shadowBlur = 15;
                option.color = "rgba(0, 180, 255, 0.8)"; // Brighter when selected
            } else {
                option.color = "rgba(0, 180, 255, 0.3)"; // Dimmer when not selected
            }

            // Button background
            this.ctx.fillStyle = option.color;
            this.ctx.strokeStyle =
                option.hovered || index === this.selectedIndex
                    ? "rgba(255, 255, 255, 0.8)"
                    : "rgba(255, 255, 255, 0.4)";
            this.ctx.lineWidth = 2;

            // Draw button
            this.ctx.beginPath();
            this.ctx.moveTo(option.x, option.y);
            this.ctx.lineTo(option.x + option.width - 20, option.y);
            this.ctx.lineTo(option.x + option.width, option.y + option.height);
            this.ctx.lineTo(option.x + 20, option.y + option.height);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();

            // Text
            this.ctx.fillStyle = "#ffffff";
            this.ctx.font = "24px Arial";
            this.ctx.textAlign = "left";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(option.text, option.x + 20, option.y + option.height / 2);

            this.ctx.restore();
        });
    }

    cleanup() {
        // Clean up any active menu
        if (this.activeMenu) {
            this.activeMenu.cleanup();
            this.activeMenu = null;
        }
        
        // Clean up menu options
        this.menuOptions.forEach((_, index) => {
            this.input.removeElement(`menu_option_${index}`);
        });
    }
}