// game/mode/rpgmenu/rpgmenumode.js
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

        this.menuLayout = {
            position: {
                right: 270,
                startY: 20,
                itemSpacing: 15, // Clear gap between buttons
                buttonHeight: 50 // Height of each button
            },
            button: {
                width: 250,
                height: 50,
                textPadding: 30,
                fontSize: 24
            }
        };

        // Define menu options with new spacing calculation
        this.menuOptions = ["Item", "Magic", "Equipment", "Status", "Formation", "Configure", "Shop", "Save"].map(
            (text, index) => ({
                text,
                x: Game.WIDTH - this.menuLayout.position.right,
                y:
                    this.menuLayout.position.startY +
                    index * (this.menuLayout.position.buttonHeight + this.menuLayout.position.itemSpacing),
                width: this.menuLayout.button.width,
                height: this.menuLayout.button.height,
                hovered: false,
                borderGlow: 0
            })
        );
        
        this.colors = gameMaster.persistentParty.colors;
        
        // Create character panel
        this.characterPanel = new CharacterPanel(
            this.ctx,
            this.input,
            this.gameMaster.persistentParty,
            this.sprites,
            this
        );

        // Initialize state
        this.selectedIndex = 0;
        this.activeSubmenu = null;
        this.pendingMenuActivation = false;

        // Register menu elements
        this.registerMenuElements();
    }

    createGradient(x, y, width, height, colorStart, colorEnd) {
        const gradient = this.ctx.createLinearGradient(x, y, x + width, y + height);
        gradient.addColorStop(0, colorStart);
        gradient.addColorStop(1, colorEnd);
        return gradient;
    }

    loadSprites() {
        ["warrior", "mage", "thief"].forEach((type) => {
            this.sprites[type] = Sprite.genHeroSprite(type);
        });
    }

    registerMenuElements() {
        this.menuOptions.forEach((option, index) => {
            this.input.registerElement(`menu_option_${index}`, {
                bounds: () => ({
                    x: Game.WIDTH - this.menuLayout.position.right,
                    y:
                        this.menuLayout.position.startY +
                        index * (this.menuLayout.position.buttonHeight + this.menuLayout.position.itemSpacing),
                    width: this.menuLayout.button.width,
                    height: this.menuLayout.button.height
                })
            });
        });
    }

    update() {
        this.characterPanel.update();

        // Handle pending menu activation first
        if (this.pendingMenuActivation) {
            this.activateMainMenu();
            this.pendingMenuActivation = false;
            return; // Skip rest of update to prevent any input this frame
        }

        if (this.activeSubmenu) {
            const result = this.activeSubmenu.update();
            if (result === "exit") {
                this.exitSubmenu();
            }
            return;
        }

        // Main menu navigation
        this.menuOptions.forEach((option, index) => {
            if (this.input.isElementHovered(`menu_option_${index}`)) {
                this.selectedIndex = index;
            }

            option.hovered = this.input.isElementHovered(`menu_option_${index}`) || this.selectedIndex === index;

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

        // Add the new Action2 check here
        if (this.input.isKeyJustPressed("Action2")) {
            this.gameMaster.modeManager.switchMode("world");
            return;
        }
        
        if (
            this.input.isKeyJustPressed("Action1") ||
            this.input.isElementJustPressed(`menu_option_${this.selectedIndex}`)
        ) {
            this.handleMenuSelection(this.selectedIndex);
        }
    }

    handleMenuSelection(index) {
        const menuItem = this.menuOptions[index].text;

        switch (menuItem) {
            case "Item":
                this.activeSubmenu = new ItemMenu(this.ctx, this.input, this.gameMaster, this.characterPanel);
                break;
            case "Magic":
                this.activeSubmenu = new MagicMenu(this.ctx, this.input, this.gameMaster, this.characterPanel);
                break;
            case "Save":
                this.activeSubmenu = new SaveGameMenu(this.ctx, this.input, this.gameMaster, "save");
                this.deactivateMainMenu();
                break;
            case "Shop":
                this.activeSubmenu = new ShopMenu(this.ctx, this.input, this.gameMaster);
                this.deactivateMainMenu();
                break;
            case "Configure":
                this.activeSubmenu = new ConfigMenu(this.ctx, this.input, this.gameMaster);
                this.deactivateMainMenu();
                break;
            case "Equipment":
                this.activeSubmenu = new DemoMenu(this.ctx, this.input, this.gameMaster);
                this.deactivateMainMenu();
                break;
            case "Formation":
                break;                
        }

        if (this.activeSubmenu) {
            this.deactivateMainMenu();
            this.activeSubmenu.registerElements();
        }
    }

    exitSubmenu() {
        if (this.activeSubmenu) {
            this.activeSubmenu.cleanup();
            this.activeSubmenu = null;
            this.pendingMenuActivation = true;
            this.characterPanel.selectionState = "none";
            this.characterPanel.selectedCharIndex = -1;
            this.activateMainMenu();
        }
    }

    deactivateMainMenu() {
        this.menuOptions.forEach((_, index) => {
            this.input.state.elements.gui.get(`menu_option_${index}`).isActive = false;
        });
    }

    activateMainMenu() {
        this.menuOptions.forEach((_, index) => {
            this.input.state.elements.gui.get(`menu_option_${index}`).isActive = true;
        });
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, Game.WIDTH, Game.HEIGHT);

        // If we have an active fullscreen submenu, only draw that
        if (this.activeSubmenu instanceof BaseFullScreenMenu) {
            this.activeSubmenu.draw();
            return;
        }

        // Otherwise draw everything as normal
        this.ctx.fillStyle = this.createGradient(
            0,
            0,
            Game.WIDTH,
            Game.HEIGHT,
            this.colors.mainBackground.start,
            this.colors.mainBackground.end
        );
        this.ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);

        this.characterPanel.draw();

        if (this.activeSubmenu) {
            this.activeSubmenu.draw();
        } else {
            this.drawMenuOptions();
        }

        this.drawInfoPanel();
    }

    drawMenuOptions() {
        const l = this.menuLayout;

        this.menuOptions.forEach((option) => {
            this.ctx.save();

            if (option.hovered) {
                this.ctx.shadowColor = this.colors.glowColor;
                this.ctx.shadowBlur = this.colors.glowBlur;
            }

            // Create gradient for button background
            const gradientColors = option.hovered ? this.colors.buttonHover : this.colors.buttonNormal;
            this.ctx.fillStyle = this.createGradient(
                option.x,
                option.y,
                option.width,
                option.height,
                gradientColors.start,
                gradientColors.end
            );
            this.ctx.fillRect(option.x, option.y, option.width, option.height);

            this.ctx.fillStyle = option.hovered ? this.colors.buttonTextHover : this.colors.buttonTextNormal;
            this.ctx.font = `${l.button.fontSize}px monospace`;
            this.ctx.textAlign = "left";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(option.text, option.x + l.button.textPadding, option.y + option.height / 2);

            this.ctx.restore();
        });
    }

    drawInfoPanel() {
        const x = 460;
        const y = 540;
        const width = 320;
        const height = 40;

        // Info panel background with gradient
        this.ctx.fillStyle = this.createGradient(
            x,
            y,
            width,
            height,
            this.colors.menuBackground.start,
            this.colors.menuBackground.end
        );
        this.ctx.fillRect(x, y, width, height);

        this.ctx.fillStyle = this.colors.normalText;
        this.ctx.font = "20px monospace";

        this.ctx.textAlign = "left";
        this.ctx.fillText(`Time: 00:00`, x + 20, y + 25);

        this.ctx.textAlign = "right";
        this.ctx.fillText(`Gil: 0`, x + width - 20, y + 25);
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
        if (this.activeSubmenu) {
            this.activeSubmenu.cleanup();
        }
        this.characterPanel.cleanup();
    }
}