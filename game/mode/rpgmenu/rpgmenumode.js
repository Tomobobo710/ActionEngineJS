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

        // Menu options (right side)
        this.menuLayout = {
            position: {
                right: 220, // Distance from right edge
                startY: 20, // Starting Y position
                spacing: 64.35 // Vertical space between options
            },
            button: {
                width: 200,
                height: 50,
                textPadding: 30, // Left padding for text
                fontSize: 24,
                normalColor: "rgba(0, 0, 102, 0.95)",
                hoverColor: "rgba(0, 51, 102, 0.95)",
                textColor: {
                    normal: "#ffffff",
                    hover: "#00ffff"
                },
                glow: {
                    color: "#00ffff",
                    blur: 15
                }
            }
        };

        // Define menu options using the layout config
        this.menuOptions = ["Item", "Magic", "Status", "Configure", "Save", "Equipment", "Formation", "Quest Log"].map(
            (text, index) => ({
                text,
                x: Game.WIDTH - this.menuLayout.position.right,
                y: this.menuLayout.position.startY + index * this.menuLayout.position.spacing,
                width: this.menuLayout.button.width,
                height: this.menuLayout.button.height,
                color: this.menuLayout.button.normalColor,
                hovered: false,
                borderGlow: 0
            })
        );

        // Define shared menu layout constants
        this.itemMenu = {
            x: 430,
            y: 20,
            width: 350,
            height: 500,
            headerHeight: 40,
            itemSpacing: 45,
            itemHeight: 40,
            itemPadding: 10,
            textOffset: 25,
            backButton: {
                width: 30,
                height: 30,
                rightOffset: 5,
                topOffset: 5,
                x: 0 // We'll calculate this in the registration
            }
        };

        this.characterPanel = {
            startX: 20,
            startY: 20,
            width: 400,
            height: 160,
            verticalGap: 10,
            portrait: {
                size: 100,
                margin: 15,
                borderWidth: 2,
                borderColor: "#00ffff"
            },
            stats: {
                x: 155, // Will be calculated as portraitX + portrait.size + 30
                width: 230,
                nameY: 35,
                levelOffset: 120,
                fontSize: 20,
                barHeight: 20,
                barSpacing: 45, // Distance between HP and MP bars
                firstBarY: 55,
                secondBarY: 100,
                textOffset: 15 // Space between bar and its label
            }
        };
        
        // Register menu options as interactive elements
        this.menuOptions.forEach((option, index) => {
            this.input.registerElement(`menu_option_${index}`, {
                bounds: () => ({
                    x: Game.WIDTH - this.menuLayout.position.right,
                    y: this.menuLayout.position.startY + index * this.menuLayout.position.spacing,
                    width: this.menuLayout.button.width,
                    height: this.menuLayout.button.height
                })
            });
        });
        this.descriptionPanel = {
            x: 20,          // Start from left side
            y: 540,         // Same Y as info panel
            width: 350,     // Leave room for info panel
            height: 40,     // Match info panel height
            fontSize: 20,
            textPadding: 10,
            color: "rgba(0, 0, 102, 0.8)"
        };
        this.magicMenu = {
    x: 430,
    y: 20,
    width: 350,
    height: 500,
    headerHeight: 40,
    spellSpacing: 45,
    spellHeight: 40,
    padding: 10,
    textOffset: 25,
    spellsPerPage: 8,
    currentPage: 0,
            backButton: {       // Add this!
        width: 30,
        height: 30,
        rightOffset: 5,
        topOffset: 5,
        x: 0  // We'll calculate this in registration
    },
    arrows: {
        width: 30,
        height: 30,
        padding: 10,
        color: {
            normal: "#ffffff",
            hover: "#00ffff"
        },
        symbols: {
            left: "◀",
            right: "▶"
        }
    },
    pageInfo: {
        y: 470, // Near bottom of menu
        font: "16px monospace",
        color: "#00ffff"
    }
};
        this.selectedIndex = 0;

        // Add submenu state tracking
        this.currentSubmenu = null; // 'item', 'magic', etc.
        this.submenuSelectedIndex = 0;

        // Track scrolling for items that overflow
        this.itemScrollOffset = 0;
        this.maxVisibleItems = 8;
        this.characterPanel.selectedCharIndex = -1; // No character selected by default
    this.characterPanel.selectionState = 'none'; // 'none', 'selecting_target'
    this.characterPanel.targetMode = 'single'; // 'single' or 'all'
    this.characterPanel.selectionState = 'none'; // 'none' or 'selecting_target'
    this.characterPanel.selectedCharIndex = -1;
    // Register character panels as interactive elements
    const party = this.gameMaster.persistentParty;
    party.forEach((_, index) => {
        this.input.registerElement(`character_panel_${index}`, {
            bounds: () => ({
                x: this.characterPanel.startX,
                y: this.characterPanel.startY + index * (this.characterPanel.height + this.characterPanel.verticalGap),
                width: this.characterPanel.width,
                height: this.characterPanel.height
            })
        });
    });
    }
drawDescriptionPanel() {
    const d = this.descriptionPanel;
    
    // Draw panel background
    this.ctx.fillStyle = d.color;
    this.ctx.fillRect(d.x, d.y, d.width, d.height);

    // If we're in the item menu and have an item selected, show its description
    if (this.currentSubmenu === "item") {
        const inventory = this.gameMaster.partyInventory;
        const items = inventory.getAvailableItems();
        const selectedItem = items[this.submenuSelectedIndex];
        
        if (selectedItem) {
            this.ctx.fillStyle = "#ffffff";
            this.ctx.font = `${d.fontSize}px monospace`;
            this.ctx.textAlign = "left";
            this.ctx.textBaseline = "middle";
            
            // Draw description text vertically centered
            this.ctx.fillText(
                selectedItem.item.description,
                d.x + d.textPadding,
                d.y + (d.height / 2)
            );
        }
    }
}
    loadSprites() {
        // Load hero sprites just like in BattleMode
        ["warrior", "mage", "thief"].forEach((type) => {
            this.sprites[type] = Sprite.genHeroSprite(type);
        });
    }

   update() {
    if (this.currentSubmenu === "item") {
        this.updateItemMenu();
    } else if (this.currentSubmenu === "magic") {
        this.updateMagicMenu();
    } else {
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
        if (
            this.input.isKeyJustPressed("Action1") ||
            this.input.isElementJustPressed(`menu_option_${this.selectedIndex}`)
        ) {
            this.handleMenuSelection(this.selectedIndex);
        }
    }
    updateItemMenu() {
   // Check if back button is clicked - this should ALWAYS cancel any targeting and close menus
   if (this.input.isElementJustPressed("item_back_button")) {
       this.characterPanel.selectionState = 'none';
       this.characterPanel.selectedCharIndex = -1;
       this.isClosingSubmenu = true;
       this.exitSubmenu();
       return;
   }

   const inventory = this.gameMaster.partyInventory;
   const items = inventory.getAvailableItems();
   const p = this.characterPanel;

   if (p.selectionState === 'selecting_target') {
       // Handle target selection
       const party = this.gameMaster.persistentParty;
       
       if (p.targetMode === 'single') {
           // Single target handling
           party.forEach((_, index) => {
               if (this.input.isElementHovered(`character_panel_${index}`)) {
                   p.selectedCharIndex = index;
                   
                   if (this.input.isElementJustPressed(`character_panel_${index}`)) {
                       this.handleItemUse(items[this.submenuSelectedIndex], party[index]);
                       p.selectionState = 'none';
                       p.selectedCharIndex = -1;
                   }
               }
           });

           // Handle keyboard navigation for single target
           if (this.input.isKeyJustPressed("DirUp")) {
               p.selectedCharIndex = Math.max(0, p.selectedCharIndex - 1);
           }
           if (this.input.isKeyJustPressed("DirDown")) {
               p.selectedCharIndex = Math.min(party.length - 1, p.selectedCharIndex + 1);
           }
           
           if (this.input.isKeyJustPressed("Action1") && p.selectedCharIndex !== -1) {
               this.handleItemUse(items[this.submenuSelectedIndex], party[p.selectedCharIndex]);
               p.selectionState = 'none';
               p.selectedCharIndex = -1;
           }
       } else {
    // All target handling - any click on any character or Action1 uses the item
    if (party.some((_, index) => this.input.isElementJustPressed(`character_panel_${index}`)) ||
        this.input.isKeyJustPressed("Action1")) {
        // Pass the entire party array for all-target items
        this.handleItemUse(items[this.submenuSelectedIndex], party);
        p.selectionState = 'none';
        p.selectedCharIndex = -1;
    }
}

       // Cancel target selection with Action2
       if (this.input.isKeyJustPressed("Action2")) {
           p.selectionState = 'none';
           p.selectedCharIndex = -1;
           return;
       }
       
       return; // Skip regular item menu updates while selecting target
   }

   // Regular Action2 for closing submenu (only when not targeting)
   if (this.input.isKeyJustPressed("Action2")) {
       this.isClosingSubmenu = true;
       this.exitSubmenu();
       return;
   }

   const handleItemSelection = (selectedItem) => {
    if (selectedItem) {
        p.selectionState = 'selecting_target';
        // Check for "all_" prefix instead of "ALL"
        p.targetMode = selectedItem.item.targetType.startsWith('all_') ? 'all' : 'single';
        p.selectedCharIndex = p.targetMode === 'single' ? 0 : -1;
    }
};

   // Update hover states and handle mouse clicks
   for (let i = 0; i < Math.min(this.maxVisibleItems, items.length); i++) {
       const index = i + this.itemScrollOffset;
       if (this.input.isElementHovered(`submenu_item_${index}`)) {
           this.submenuSelectedIndex = index;
       }

       // Add mouse click handling
       if (this.input.isElementJustPressed(`submenu_item_${index}`)) {
           handleItemSelection(items[index]);
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
       handleItemSelection(items[this.submenuSelectedIndex]);
   }
}
updateMagicMenu() {
    // Always check back button first
    if (this.input.isElementJustPressed("magic_back_button")) {
        this.characterPanel.selectionState = 'none';
        this.characterPanel.selectedCharIndex = -1;
        this.isClosingSubmenu = true;
        this.exitMagicSubmenu();
        return;
    }

    // Different states need different updates
    if (this.characterPanel.selectionState === 'selecting_hero') {
        // Handle hero selection
        const party = this.gameMaster.persistentParty;
        
        party.forEach((_, index) => {
            if (this.input.isElementHovered(`character_panel_${index}`)) {
                this.characterPanel.selectedCharIndex = index;
                
                if (this.input.isElementJustPressed(`character_panel_${index}`)) {
                    this.characterPanel.selectionState = 'selected_hero';
                    // Re-register elements to show spells for selected hero
                    this.registerMagicElements();
                }
            }
        });

        // Keyboard navigation for hero selection
        if (this.input.isKeyJustPressed("DirUp")) {
            this.characterPanel.selectedCharIndex = Math.max(0, this.characterPanel.selectedCharIndex - 1);
        }
        if (this.input.isKeyJustPressed("DirDown")) {
            this.characterPanel.selectedCharIndex = Math.min(party.length - 1, this.characterPanel.selectedCharIndex + 1);
        }
        
        if (this.input.isKeyJustPressed("Action1")) {
            this.characterPanel.selectionState = 'selected_hero';
            this.registerMagicElements();
        }

    } else if (this.characterPanel.selectionState === 'selected_hero') {
        const selectedChar = this.gameMaster.persistentParty[this.characterPanel.selectedCharIndex];
        const spells = selectedChar.spells;
        const startIndex = this.magicMenu.currentPage * this.magicMenu.spellsPerPage;
        const pageSpells = spells.slice(startIndex, startIndex + this.magicMenu.spellsPerPage);

        // Handle spell selection
        pageSpells.forEach((_, index) => {
            if (this.input.isElementHovered(`magic_spell_${index}`)) {
                this.submenuSelectedIndex = startIndex + index;
                
                if (this.input.isElementJustPressed(`magic_spell_${index}`)) {
                    const selectedSpell = spells[this.submenuSelectedIndex];
                    this.characterPanel.selectionState = 'selecting_target';
                    this.characterPanel.targetMode = selectedSpell.targetType.startsWith('all_') ? 'all' : 'single';
                    this.characterPanel.selectedCharIndex = this.characterPanel.targetMode === 'single' ? 0 : -1;
                }
            }
        });

        // Handle page navigation
        if (spells.length > this.magicMenu.spellsPerPage) {
            if (this.input.isElementJustPressed("magic_arrow_left") && this.magicMenu.currentPage > 0) {
                this.magicMenu.currentPage--;
                this.registerMagicElements(); // Re-register for new page
            }
            if (this.input.isElementJustPressed("magic_arrow_right") && 
                (this.magicMenu.currentPage + 1) * this.magicMenu.spellsPerPage < spells.length) {
                this.magicMenu.currentPage++;
                this.registerMagicElements(); // Re-register for new page
            }
        }

        // Keyboard navigation
        if (this.input.isKeyJustPressed("DirUp")) {
            this.submenuSelectedIndex = Math.max(startIndex, this.submenuSelectedIndex - 1);
        }
        if (this.input.isKeyJustPressed("DirDown")) {
            this.submenuSelectedIndex = Math.min(startIndex + pageSpells.length - 1, this.submenuSelectedIndex + 1);
        }
        if (this.input.isKeyJustPressed("DirLeft") && this.magicMenu.currentPage > 0) {
            this.magicMenu.currentPage--;
            this.registerMagicElements();
        }
        if (this.input.isKeyJustPressed("DirRight") && 
            (this.magicMenu.currentPage + 1) * this.magicMenu.spellsPerPage < spells.length) {
            this.magicMenu.currentPage++;
            this.registerMagicElements();
        }

        if (this.input.isKeyJustPressed("Action1")) {
            const selectedSpell = spells[this.submenuSelectedIndex];
            this.characterPanel.selectionState = 'selecting_target';
            this.characterPanel.targetMode = selectedSpell.targetType.startsWith('all_') ? 'all' : 'single';
            this.characterPanel.selectedCharIndex = this.characterPanel.targetMode === 'single' ? 0 : -1;
        }

    } else if (this.characterPanel.selectionState === 'selecting_target') {
        const selectedChar = this.gameMaster.persistentParty[this.characterPanel.selectedCharIndex];
        const selectedSpell = selectedChar.spells[this.submenuSelectedIndex];
        const party = this.gameMaster.persistentParty;

        if (this.characterPanel.targetMode === 'single') {
            // Single target handling
            party.forEach((_, index) => {
                if (this.input.isElementHovered(`character_panel_${index}`)) {
                    this.characterPanel.selectedCharIndex = index;
                    
                    if (this.input.isElementJustPressed(`character_panel_${index}`)) {
                        this.handleSpellUse(selectedChar, selectedSpell, party[index]);
                        this.characterPanel.selectionState = 'selected_hero';
                    }
                }
            });

            // Keyboard navigation for target
            if (this.input.isKeyJustPressed("DirUp")) {
                this.characterPanel.selectedCharIndex = Math.max(0, this.characterPanel.selectedCharIndex - 1);
            }
            if (this.input.isKeyJustPressed("DirDown")) {
                this.characterPanel.selectedCharIndex = Math.min(party.length - 1, this.characterPanel.selectedCharIndex - 1);
            }
            
            if (this.input.isKeyJustPressed("Action1")) {
                this.handleSpellUse(selectedChar, selectedSpell, party[this.characterPanel.selectedCharIndex]);
                this.characterPanel.selectionState = 'selected_hero';
            }
        } else {
            // All target handling
            if (party.some((_, index) => this.input.isElementJustPressed(`character_panel_${index}`)) ||
                this.input.isKeyJustPressed("Action1")) {
                this.handleSpellUse(selectedChar, selectedSpell, party);
                this.characterPanel.selectionState = 'selected_hero';
            }
        }

        // Cancel target selection
        if (this.input.isKeyJustPressed("Action2")) {
            this.characterPanel.selectionState = 'selected_hero';
            return;
        }
    }

    // Action2 for going back through menu states
    if (this.input.isKeyJustPressed("Action2")) {
        if (this.characterPanel.selectionState === 'selected_hero') {
            this.characterPanel.selectionState = 'selecting_hero';
        } else if (this.characterPanel.selectionState === 'selecting_hero') {
            this.isClosingSubmenu = true;
            this.exitMagicSubmenu();
        }
    }
}
    
    handleSpellUse(caster, spell, target) {
    console.log(`${caster.name} casting ${spell.name} on ${Array.isArray(target) ? 'all allies' : target.name}`);
    
    // Check MP cost
    if (caster.mp < spell.mpCost) {
        console.log("Not enough MP!");
        return false;
    }

    // Use the character's castSpell method
    let result = caster.castSpell(spell, target);

    // Save last used spell position in menu state
    caster.menuState.lastSpellIndex = this.submenuSelectedIndex;
    
    return result;
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
    
    registerMagicElements() {
    const m = this.magicMenu;

    // Calculate back button position
    m.backButton.x = m.x + m.width - 35; // Center point

    // Always register back button for magic menu
    if (!this.backButtonRegistered) {
        this.input.registerElement("magic_back_button", {
            bounds: () => ({
                x: m.backButton.x - (m.backButton.width / 2),
                y: m.y + m.backButton.topOffset,
                width: m.backButton.width,
                height: m.backButton.height
            })
        });
        this.backButtonRegistered = true;
    }

    // Only register spell slots and arrows if we have a selected hero
    if (this.characterPanel.selectionState === 'selected_hero') {
        const selectedChar = this.gameMaster.persistentParty[this.characterPanel.selectedCharIndex];
        const spells = selectedChar.spells;

        // Register spell slots for current page
        const startIndex = this.magicMenu.currentPage * m.spellsPerPage;
        const pageSpells = spells.slice(startIndex, startIndex + m.spellsPerPage);

        pageSpells.forEach((_, index) => {
            this.input.registerElement(`magic_spell_${index}`, {
                bounds: () => ({
                    x: m.x + m.padding,
                    y: m.y + m.headerHeight + 20 + index * m.spellSpacing,
                    width: m.width - (m.padding * 2),
                    height: m.spellHeight
                })
            });
        });

        // If we have multiple pages, register arrow buttons
        if (spells.length > m.spellsPerPage) {
            // Left arrow (if not on first page)
            if (this.magicMenu.currentPage > 0) {
                this.input.registerElement("magic_arrow_left", {
                    bounds: () => ({
                        x: m.x + m.padding,
                        y: m.y + m.height - 50,
                        width: m.arrows.width,
                        height: m.arrows.height
                    })
                });
            }

            // Right arrow (if not on last page)
            if ((this.magicMenu.currentPage + 1) * m.spellsPerPage < spells.length) {
                this.input.registerElement("magic_arrow_right", {
                    bounds: () => ({
                        x: m.x + m.width - m.arrows.width - m.padding,
                        y: m.y + m.height - 50,
                        width: m.arrows.width,
                        height: m.arrows.height
                    })
                });
            }
        }
    }
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
    this.currentSubmenu = "magic";
    this.submenuSelectedIndex = 0;
    // Immediately deactivate all main menu elements
    this.menuOptions.forEach((_, i) => {
        this.input.state.elements.gui.get(`menu_option_${i}`).isActive = false;
    });
    // THEN set magic-specific state
    this.magicMenu.currentPage = 0;
    this.characterPanel.selectionState = 'selecting_hero';
    this.characterPanel.selectedCharIndex = 0;
    this.registerMagicElements();
    break;
            case "Status":
                // Handle status menu
                console.log("Status menu selected");
                break;
            case "Configure":
                // Handle config menu
                console.log("Configure menu selected");
                break;
            case "Save":
                // Handle save
                this.gameMaster.modeManager.switchMode("start");
                break;
            case "Equipment":
                // Add handling for equipment menu
                console.log("Equipment menu selected");
                break;
            case "Formation":
                // Add handling for formation menu
                console.log("Formation menu selected");
                break;
            case "Quest Log":
                // Add handling for quest log
                console.log("Quest log selected");
                break;
        }
    }
    registerItemElements() {
        const inventory = this.gameMaster.partyInventory;
        const items = inventory.getAvailableItems();
        const m = this.itemMenu;

        items.forEach((item, index) => {
            this.input.registerElement(`submenu_item_${index}`, {
                bounds: () => ({
                    x: m.x + m.itemPadding,
                    y: m.y + m.headerHeight + 20 + index * m.itemSpacing,
                    width: m.width - m.itemPadding * 2,
                    height: m.itemHeight
                })
            });
        });

        // Calculate the actual X position for the back button
        m.backButton.x = m.x + m.width - m.backButton.rightOffset - m.backButton.width / 2; // Center point

        if (!this.backButtonRegistered) {
            this.input.registerElement("item_back_button", {
                bounds: () => ({
                    x: m.backButton.x - m.backButton.width / 2, // Left edge of clickable area
                    y: m.y + m.backButton.topOffset,
                    width: m.backButton.width,
                    height: m.backButton.height
                })
            });
            this.backButtonRegistered = true;
        }
    }
    draw() {
    // Clear canvas and draw background
    this.ctx.clearRect(0, 0, Game.WIDTH, Game.HEIGHT);
    this.ctx.fillStyle = "rgba(0, 0, 51, 0.95)";
    this.ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);

    if (this.currentSubmenu === "item") {
        this.drawCharacterPanel();
        this.drawItemMenu();
    } else if (this.currentSubmenu === "magic") {
        this.drawCharacterPanel();
        this.drawMagicMenu();
    } else {
        this.drawCharacterPanel();
        this.drawMenuOptions();
    }

    // Always draw info panel last
    this.drawInfoPanel();
}
    drawItemMenu() {
        const m = this.itemMenu; // shorthand reference

        // Draw window header
        this.ctx.fillStyle = "rgba(0, 0, 153, 0.95)";
        this.ctx.fillRect(m.x, m.y, m.width, m.headerHeight);

        // Draw main window background
        this.ctx.fillStyle = "rgba(0, 0, 102, 0.95)";
        this.ctx.fillRect(m.x, m.y + m.headerHeight, m.width, m.height - m.headerHeight);

        // Draw back button (X)
        this.ctx.fillStyle = this.input.isElementHovered("item_back_button") ? "#00ffff" : "#ffffff";
        this.ctx.font = "24px monospace";
        this.ctx.textAlign = "center";
        this.ctx.fillText("❌", m.backButton.x, m.y + m.backButton.topOffset + 20);

        // Draw "Items" title in header
        this.ctx.fillStyle = "#00ffff";
        this.ctx.font = "26px monospace";
        this.ctx.textAlign = "left";
        this.ctx.fillText("Items", m.x + 20, m.y + 28);

        const inventory = this.gameMaster.partyInventory;
        const items = inventory.getAvailableItems();
        const visibleItems = items.slice(this.itemScrollOffset, this.itemScrollOffset + this.maxVisibleItems);

        visibleItems.forEach((itemData, index) => {
            const actualIndex = index + this.itemScrollOffset;
            const y = m.y + m.headerHeight + 20 + index * m.itemSpacing;

            // Selection highlight
            if (actualIndex === this.submenuSelectedIndex) {
                this.ctx.fillStyle = "rgba(0, 51, 102, 0.95)";
                this.ctx.fillRect(m.x + m.itemPadding, y - 2, m.width - m.itemPadding * 2, m.itemHeight);
            }

            this.ctx.fillStyle = actualIndex === this.submenuSelectedIndex ? "#00ffff" : "#ffffff";
            this.ctx.font = "24px monospace";
            this.ctx.textAlign = "left";

            // Draw emoji and text
            this.ctx.fillText(itemData.item.emoji, m.x + 20, y + m.textOffset);
            this.ctx.fillText(`${itemData.item.name} x${itemData.quantity}`, m.x + 60, y + m.textOffset);
        });

        // Scroll indicators
        if (this.itemScrollOffset > 0) {
            this.ctx.fillStyle = "#00ffff";
            this.ctx.font = "24px monospace";
            this.ctx.fillText("▲", m.x + m.width - 40, m.y + m.headerHeight + 30);
        }
        if (this.itemScrollOffset + this.maxVisibleItems < items.length) {
            this.ctx.fillStyle = "#00ffff";
            this.ctx.font = "24px monospace";
            this.ctx.fillText("▼", m.x + m.width - 40, m.y + m.height - 20);
        }
    }
    drawMagicMenu() {
    const m = this.magicMenu;

    // Draw window header
    this.ctx.fillStyle = "rgba(0, 0, 153, 0.95)";
    this.ctx.fillRect(m.x, m.y, m.width, m.headerHeight);

    // Draw main window background
    this.ctx.fillStyle = "rgba(0, 0, 102, 0.95)";
    this.ctx.fillRect(m.x, m.y + m.headerHeight, m.width, m.height - m.headerHeight);

    // Draw back button (X)
    this.ctx.fillStyle = this.input.isElementHovered("magic_back_button") ? "#00ffff" : "#ffffff";
    this.ctx.font = "24px monospace";
    this.ctx.textAlign = "center";
    this.ctx.fillText("❌", m.backButton.x, m.y + m.backButton.topOffset + 20);

    // Draw "Magic" title in header
    this.ctx.fillStyle = "#00ffff";
    this.ctx.font = "26px monospace";
    this.ctx.textAlign = "left";
    this.ctx.fillText("Magic", m.x + 20, m.y + 28);

    // If we're selecting hero, show prompt
    if (this.characterPanel.selectionState === 'selecting_hero') {
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "24px monospace";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Select Hero", m.x + (m.width / 2), m.y + 100);
        return;
    }

    // Draw spell list if hero is selected
    if (this.characterPanel.selectionState === 'selected_hero' || 
        this.characterPanel.selectionState === 'selecting_target') {
        const selectedChar = this.gameMaster.persistentParty[this.characterPanel.selectedCharIndex];
        const spells = selectedChar.spells;
        
        // Get spells for current page
        const startIndex = m.currentPage * m.spellsPerPage;
        const pageSpells = spells.slice(startIndex, startIndex + m.spellsPerPage);

        // Draw spells
        pageSpells.forEach((spell, index) => {
            const actualIndex = startIndex + index;
            const y = m.y + m.headerHeight + 20 + index * m.spellSpacing;

            // Selection highlight
            if (actualIndex === this.submenuSelectedIndex) {
                this.ctx.fillStyle = "rgba(0, 51, 102, 0.95)";
                this.ctx.fillRect(m.x + m.padding, y - 2, m.width - (m.padding * 2), m.spellHeight);
            }

            // Draw spell info
            this.ctx.fillStyle = actualIndex === this.submenuSelectedIndex ? "#00ffff" : "#ffffff";
            this.ctx.font = "24px monospace";
            this.ctx.textAlign = "left";
            this.ctx.fillText(spell.name, m.x + 20, y + m.textOffset);
            
            // Draw MP cost
            this.ctx.textAlign = "right";
            this.ctx.fillText(`${spell.mpCost} MP`, m.x + m.width - 20, y + m.textOffset);
        });

        // Draw page navigation if needed
        if (spells.length > m.spellsPerPage) {
            // Draw page info
            this.ctx.fillStyle = m.pageInfo.color;
            this.ctx.font = m.pageInfo.font;
            this.ctx.textAlign = "center";
            this.ctx.fillText(
                `Page ${m.currentPage + 1}/${Math.ceil(spells.length / m.spellsPerPage)}`,
                m.x + (m.width / 2),
                m.y + m.height - 20
            );

            // Draw arrows
            if (m.currentPage > 0) {
                this.ctx.fillStyle = this.input.isElementHovered("magic_arrow_left") ? 
                    m.arrows.color.hover : m.arrows.color.normal;
                this.ctx.fillText(m.arrows.symbols.left, 
                    m.x + m.arrows.padding + (m.arrows.width / 2),
                    m.y + m.height - 20
                );
            }

            if ((m.currentPage + 1) * m.spellsPerPage < spells.length) {
                this.ctx.fillStyle = this.input.isElementHovered("magic_arrow_right") ? 
                    m.arrows.color.hover : m.arrows.color.normal;
                this.ctx.fillText(m.arrows.symbols.right, 
                    m.x + m.width - m.arrows.padding - (m.arrows.width / 2),
                    m.y + m.height - 20
                );
            }
        }
    }
}
    exitMagicSubmenu() {
    // Clean up spell elements
    const selectedChar = this.gameMaster.persistentParty[this.characterPanel.selectedCharIndex];
    if (selectedChar) {
        const spells = selectedChar.spells;
        const startIndex = this.magicMenu.currentPage * this.magicMenu.spellsPerPage;
        const pageSpells = spells.slice(startIndex, startIndex + this.magicMenu.spellsPerPage);
        
        pageSpells.forEach((_, index) => {
            this.input.removeElement(`magic_spell_${index}`);
        });
    }

    // Clean up arrows
    this.input.removeElement("magic_arrow_left");
    this.input.removeElement("magic_arrow_right");

    // Clean up back button
    this.input.removeElement("magic_back_button");
    this.backButtonRegistered = false;

    // Reset state
    this.currentSubmenu = null;
    this.submenuSelectedIndex = 0;
    this.magicMenu.currentPage = 0;
    this.characterPanel.selectionState = 'none';
    this.characterPanel.selectedCharIndex = -1;

    // Reactivate main menu elements
    this.menuOptions.forEach((_, index) => {
        this.input.state.elements.gui.get(`menu_option_${index}`).isActive = true;
    });
}
    
    drawCharacterPanel() {
    const party = this.gameMaster.persistentParty;
    const p = this.characterPanel;

    party.forEach((char, index) => {
        const x = p.startX;
        const y = p.startY + index * (p.height + p.verticalGap);
        
        // Draw selection outline if this character is selected or if all are targeted
        if ((index === p.selectedCharIndex || p.targetMode === 'all') && 
            p.selectionState === 'selecting_target') {
            this.ctx.strokeStyle = "#00ffff";
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(x - 4, y - 4, p.width + 8, p.height + 8);
        }
            const portraitX = x + p.portrait.margin;
            const portraitY = y + (p.height - p.portrait.size) / 2;

            // Panel background
            this.ctx.fillStyle = "rgba(0, 0, 102, 0.8)";
            this.ctx.fillRect(x, y, p.width, p.height);

            // Portrait border
            this.ctx.strokeStyle = p.portrait.borderColor;
            this.ctx.lineWidth = p.portrait.borderWidth;
            this.ctx.strokeRect(
                portraitX - p.portrait.borderWidth,
                portraitY - p.portrait.borderWidth,
                p.portrait.size + p.portrait.borderWidth * 2,
                p.portrait.size + p.portrait.borderWidth * 2
            );

            // Character sprite
            this.ctx.drawImage(
                this.sprites[char.type],
                0,
                0,
                32,
                32,
                portraitX,
                portraitY,
                p.portrait.size,
                p.portrait.size
            );

            // Stats section
            const statsX = portraitX + p.portrait.size + 30;

            // Name and Level
            this.ctx.fillStyle = "#00ffff";
            this.ctx.font = `${p.stats.fontSize}px monospace`;
            this.ctx.textAlign = "left";
            this.ctx.fillText(`${char.name}`, statsX, y + p.stats.nameY);
            this.ctx.fillText(`LV ${char.level}`, statsX + p.stats.levelOffset, y + p.stats.nameY);

            // HP Bar
            this.drawStatBar(statsX, y + p.stats.firstBarY, char.hp, char.maxHp, "#00ff00", "HP", p.stats.width);

            // MP Bar
            this.drawStatBar(statsX, y + p.stats.secondBarY, char.mp, char.maxMp, "#0000ff", "MP", p.stats.width);
        });
    }

    drawStatBar(x, y, current, max, color, label, width) {
        const height = 20;

        // Bar background with slight gradient
        const bgGradient = this.ctx.createLinearGradient(x, y, x, y + height);
        bgGradient.addColorStop(0, "#222222");
        bgGradient.addColorStop(1, "#333333");
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
        this.ctx.strokeStyle = "#ffffff";
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
        const hex = color.replace("#", "");
        const num = parseInt(hex, 16);
        const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount));
        const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
        const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
    }

    drawMenuOptions() {
        const l = this.menuLayout; // shorthand reference

        this.menuOptions.forEach((option, index) => {
            this.ctx.save();

            // Glow effect when selected/hovered
            if (option.hovered) {
                this.ctx.shadowColor = l.button.glow.color;
                this.ctx.shadowBlur = l.button.glow.blur;
            }

            // Draw option background
            this.ctx.fillStyle = option.hovered ? l.button.hoverColor : l.button.normalColor;
            this.ctx.fillRect(option.x, option.y, option.width, option.height);

            // Draw option text
            this.ctx.fillStyle = option.hovered ? l.button.textColor.hover : l.button.textColor.normal;
            this.ctx.font = `${l.button.fontSize}px monospace`;
            this.ctx.textAlign = "left";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(option.text, option.x + l.button.textPadding, option.y + option.height / 2);

            this.ctx.restore();
        });
    }

    drawInfoPanel() {
        const x = 380;
        const y = 540;
        const width = 400;
        const height = 40;

        this.ctx.fillStyle = "rgba(0, 0, 102, 0.8)";
        this.ctx.fillRect(x, y, width, height);

        this.ctx.fillStyle = "#00ffff";
        this.ctx.font = "16px monospace";

        // Draw Time on left side
        this.ctx.textAlign = "left";
        this.ctx.fillText(`Time: 00:00`, x + 20, y + 25);

        // Draw Gil on right side
        this.ctx.textAlign = "right";
        this.ctx.fillText(`Gil: 0`, x + width - 20, y + 25);
    }

    pause() {
        // Handle pause state
    }

    resume() {
        // Handle resume state
    }
    handleItemUse(itemData, target) {
    if (Array.isArray(target)) {
        // Handle all-target items
        target.forEach(char => {
            console.log(`Using ${itemData.item.name} on ${char.name}`);
        });
    } else {
        // Handle single-target items
        console.log(`Using SINGLE ${itemData.item.name} on ${target.name}`);
    }
    // Add actual item use logic here
}
    cleanup() {
        this.menuOptions.forEach((_, index) => {
            this.input.removeElement(`menu_option_${index}`);
        });
        this.input.removeElement("item_back_button");
        const party = this.gameMaster.persistentParty;
    party.forEach((_, index) => {
        this.input.removeElement(`character_panel_${index}`);
    });
    }
}