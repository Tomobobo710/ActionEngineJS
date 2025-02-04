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

        // Add submenu state tracking
        this.currentSubmenu = null; // 'item', 'magic', etc.
        this.submenuSelectedIndex = 0;

        // Track scrolling for items that overflow
        this.itemScrollOffset = 0;
        this.maxVisibleItems = 8;
        
        
    }

    loadSprites() {
        // Load hero sprites just like in BattleMode
        ["warrior", "mage", "thief"].forEach((type) => {
            this.sprites[type] = Sprite.genHeroSprite(type);
        });
    }

    update() {
        if (this.currentSubmenu === "item") {
            // Only handle submenu updates if we're in a submenu
            this.updateItemMenu();
        } else {
            // Only handle main menu updates if we're not in a submenu
            this.updateMainMenu();
        }
    }

    updateMainMenu() {
    if (this.isClosingSubmenu) {
        this.isClosingSubmenu = false;
        return;
    }

    // Update hover states and selection
    this.menuOptions.forEach((option, index) => {
        // Mouse hover should update selection
        if (this.input.isElementHovered(`menu_option_${index}`)) {
            this.selectedIndex = index;
        }
        
        // Set hover based on either mouse or keyboard selection
        option.hovered = this.input.isElementHovered(`menu_option_${index}`) || this.selectedIndex === index;
        
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

    // Selection (works for both mouse clicks and keyboard)
    if (this.input.isKeyJustPressed("Action1") || this.input.isElementJustPressed(`menu_option_${this.selectedIndex}`)) {
        this.handleMenuSelection(this.selectedIndex);
    }
}
    updateItemMenu() {
    // Check back button or Action2 for closing submenu
    if (this.input.isElementJustPressed("item_back_button") || this.input.isKeyJustPressed("Action2")) {
        this.isClosingSubmenu = true;
        this.exitSubmenu();
        return;
    }

    const inventory = this.gameMaster.partyInventory;
    const items = inventory.getAvailableItems();

    // Update hover states and handle mouse clicks
    for (let i = 0; i < Math.min(this.maxVisibleItems, items.length); i++) {
        const index = i + this.itemScrollOffset;
        if (this.input.isElementHovered(`submenu_item_${index}`)) {
            this.submenuSelectedIndex = index;
        }
        
        // Add mouse click handling
        if (this.input.isElementJustPressed(`submenu_item_${index}`)) {
            const selectedItem = items[index];
            if (selectedItem) {
                console.log(`Selected item: ${selectedItem.item.name}`);
                // Handle item usage here
            }
        }
    }

    // Keyboard navigation
    if (this.input.isKeyJustPressed("DirUp")) {
        this.submenuSelectedIndex = Math.max(0, this.submenuSelectedIndex - 1);
        if (this.submenuSelectedIndex < this.itemScrollOffset) {
            this.itemScrollOffset = this.submenuSelectedIndex;
        }
    }
    if (this.input.isKeyJustPressed("DirDown")) {
        this.submenuSelectedIndex = Math.min(items.length - 1, this.submenuSelectedIndex + 1);
        if (this.submenuSelectedIndex >= this.itemScrollOffset + this.maxVisibleItems) {
            this.itemScrollOffset = this.submenuSelectedIndex - this.maxVisibleItems + 1;
        }
    }

    // Keyboard selection
    if (this.input.isKeyJustPressed("Action1")) {
        const selectedItem = items[this.submenuSelectedIndex];
        if (selectedItem) {
            console.log(`Selected item: ${selectedItem.item.name}`);
            // Handle item usage here
        }
    }
}

    exitSubmenu() {
    // Clean up submenu elements first
    const inventory = this.gameMaster.partyInventory;
    const items = inventory.getAvailableItems();
    items.forEach((_, index) => {
        this.input.removeElement(`submenu_item_${index}`);
    });
    this.input.removeElement("item_back_button");
    this.backButtonRegistered = false;

    // Reset submenu state
    this.currentSubmenu = null;
    this.submenuSelectedIndex = 0;
    this.itemScrollOffset = 0;

    this.menuOptions.forEach((_, index) => {
            this.input.state.elements.gui.get(`menu_option_${index}`).isActive = true;
        });
}
    handleMenuSelection(index) {
        switch (this.menuOptions[index].text) {
            case "Item":
            this.currentSubmenu = "item";
            this.submenuSelectedIndex = 0;
            this.itemScrollOffset = 0;
            // Immediately deactivate all main menu elements
            this.menuOptions.forEach((_, i) => {
                this.input.state.elements.gui.get(`menu_option_${i}`).isActive = false;
            });
            // Register item submenu elements after deactivating main menu
            this.registerItemElements();
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
                this.gameMaster.modeManager.switchMode("start");
                break;
        }
    }
    registerItemElements() {
        const inventory = this.gameMaster.partyInventory;
        const items = inventory.getAvailableItems();

        const menuX = 455; // Match our drawing position
        const menuY = 50;

        items.forEach((item, index) => {
            this.input.registerElement(`submenu_item_${index}`, {
                bounds: () => ({
                    x: menuX + 10,
                    y: menuY + 60 + index * 40,
                    width: 320,
                    height: 35
                })
            });
        });
    }
    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, Game.WIDTH, Game.HEIGHT);

        // Draw background
        this.ctx.fillStyle = "rgba(0, 0, 51, 0.95)";
        this.ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);

        if (this.currentSubmenu === "item") {
            // Draw character info
            this.drawCharacterPanel();
            // Draw item menu on top
            this.drawItemMenu();
        } else {
            // In main menu, draw normal order
            this.drawCharacterPanel();
            this.drawMenuOptions();
        }

        // Always draw info panel last
        this.drawInfoPanel();
    }
    drawItemMenu() {
        // Draw item menu background
        const menuX = 455;
        const menuY = 50;
        const menuWidth = 340;
        const menuHeight = 400;

        this.ctx.fillStyle = "rgba(0, 0, 102, 0.95)";
        this.ctx.fillRect(menuX, menuY, menuWidth, menuHeight);

        // Register back button
        if (!this.backButtonRegistered) {
            this.input.registerElement("item_back_button", {
                bounds: () => ({
                    x: menuX + menuWidth - 50,
                    y: menuY + 10,
                    width: 40,
                    height: 30
                })
            });
            this.backButtonRegistered = true;
        }

        // Draw back button
        this.ctx.fillStyle = this.input.isElementHovered("item_back_button") ? "#00ffff" : "#ffffff";
        this.ctx.font = "16px monospace";
        this.ctx.textAlign = "center";
        this.ctx.fillText("❌", menuX + menuWidth - 30, menuY + 30);

        // Draw "Items" title
        this.ctx.fillStyle = "#00ffff";
        this.ctx.font = "20px monospace";
        this.ctx.textAlign = "left";
        this.ctx.fillText("Items", menuX + 20, menuY + 30);

        const inventory = this.gameMaster.partyInventory;
        const items = inventory.getAvailableItems();

        const visibleItems = items.slice(this.itemScrollOffset, this.itemScrollOffset + this.maxVisibleItems);

        visibleItems.forEach((itemData, index) => {
            const actualIndex = index + this.itemScrollOffset;
            const y = menuY + 60 + index * 40;

            if (actualIndex === this.submenuSelectedIndex) {
                this.ctx.fillStyle = "rgba(0, 51, 102, 0.95)";
                this.ctx.fillRect(menuX + 10, y - 5, menuWidth - 20, 35);
            }

            this.ctx.fillStyle = actualIndex === this.submenuSelectedIndex ? "#00ffff" : "#ffffff";
            this.ctx.font = "16px monospace";
            this.ctx.textAlign = "left";

            // Draw emoji first
            this.ctx.fillText(itemData.item.emoji, menuX + 20, y + 15);

            // Then draw item name and quantity with some spacing after emoji
            this.ctx.fillText(
                `${itemData.item.name} x${itemData.quantity}`,
                menuX + 50, // Moved right to make room for emoji
                y + 15
            );
        });

        // Scroll indicators
        if (this.itemScrollOffset > 0) {
            this.ctx.fillStyle = "#00ffff";
            this.ctx.fillText("▲", menuX + menuWidth - 40, menuY + 30);
        }
        if (this.itemScrollOffset + this.maxVisibleItems < items.length) {
            this.ctx.fillStyle = "#00ffff";
            this.ctx.fillText("▼", menuX + menuWidth - 40, menuY + menuHeight - 20);
        }
    }
    drawCharacterPanel() {
    const party = this.gameMaster.persistentParty;
    const panelHeight = 160; // Increased from 120
    const panelWidth = 380;

    party.forEach((char, index) => {
        const x = 50;
        const y = 50 + index * (panelHeight + 10); // Added 10px gap between panels
        const portraitSize = 100; // Slightly larger portrait
        const portraitX = x + 15;
        const portraitY = y + (panelHeight - portraitSize) / 2; // Center vertically

        // Panel background
        this.ctx.fillStyle = "rgba(0, 0, 102, 0.8)";
        this.ctx.fillRect(x, y, panelWidth, panelHeight);

        // Portrait border
        this.ctx.strokeStyle = "#00ffff";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(portraitX - 2, portraitY - 2, portraitSize + 4, portraitSize + 4);

        // Character sprite
        this.ctx.drawImage(
            this.sprites[char.type],
            0, 0, 32, 32,
            portraitX, portraitY, portraitSize, portraitSize
        );

        // Stats section
        const statsX = portraitX + portraitSize + 30;
        const statsWidth = 220;

        // Name and Level
        this.ctx.fillStyle = "#00ffff";
        this.ctx.font = "20px monospace";
        this.ctx.textAlign = "left";
        this.ctx.fillText(`${char.name}`, statsX, y + 35);
        this.ctx.fillText(`LV ${char.level}`, statsX + 120, y + 35);

        // HP Bar and text
        const barY = y + 55;
        this.drawEnhancedStatBar(statsX, barY, char.hp, char.maxHp, "#00ff00", "HP", statsWidth);
        
        // MP Bar and text
        const mpBarY = y + 100;
        this.drawEnhancedStatBar(statsX, mpBarY, char.mp, char.maxMp, "#0000ff", "MP", statsWidth);
    });
}

drawEnhancedStatBar(x, y, current, max, color, label, width) {
    const height = 20;

    // Bar background with slight gradient
    const bgGradient = this.ctx.createLinearGradient(x, y, x, y + height);
    bgGradient.addColorStop(0, '#222222');
    bgGradient.addColorStop(1, '#333333');
    this.ctx.fillStyle = bgGradient;
    this.ctx.fillRect(x, y, width, height);

    // Current value bar with gradient
    const fillWidth = (current / max) * width;
    const valueGradient = this.ctx.createLinearGradient(x, y, x, y + height);
    valueGradient.addColorStop(0, color);
    valueGradient.addColorStop(1, this.adjustColor(color, -20));
    this.ctx.fillStyle = valueGradient;
    this.ctx.fillRect(x, y, fillWidth, height);

    // Bar border
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, width, height);

    // Text below bar
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "14px monospace";
    this.ctx.textAlign = "left";
    this.ctx.fillText(`${label}: ${current}/${max}`, x, y + height + 15);
}

// Helper function to darken/lighten colors for gradients
adjustColor(color, amount) {
    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);
    const r = Math.max(0, Math.min(255, ((num >> 16) & 0xFF) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0xFF) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
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
            this.ctx.fillStyle = option.hovered ? "rgba(0, 51, 102, 0.95)" : "rgba(0, 0, 102, 0.95)";
            this.ctx.fillRect(option.x, option.y, option.width, option.height);

            // Draw option text
            this.ctx.fillStyle = option.hovered ? "#00ffff" : "#ffffff";
            this.ctx.font = "20px monospace";
            this.ctx.textAlign = "left";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(option.text, option.x + 20, option.y + option.height / 2);

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
        this.input.removeElement("item_back_button");
    }
}