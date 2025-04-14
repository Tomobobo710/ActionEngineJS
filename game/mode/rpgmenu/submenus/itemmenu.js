// game/mode/rpgmenu/submenus/itemmenu.js
class ItemMenu extends BaseSubmenu {
    constructor(ctx, input, gameMaster, characterPanel) {
        super(ctx, input, gameMaster, characterPanel);
        this.selectedIndex = 0;
    }

    registerElements() {
        const inventory = this.gameMaster.partyInventory;
        const items = inventory.getAvailableItems();
        const startIndex = this.pagination.currentPage * this.pagination.itemsPerPage;
        const pageItems = items.slice(startIndex, startIndex + this.pagination.itemsPerPage);

        // Clean up old elements first
        this.cleanup();

        // Register back button
        const backButtonX =
            this.layout.x + this.layout.width - this.layout.backButton.rightOffset - this.layout.backButton.width / 2;
        this.registerBackButton(() => ({
            x: backButtonX - this.layout.backButton.width / 2,
            y: this.layout.y + this.layout.backButton.topOffset,
            width: this.layout.backButton.width,
            height: this.layout.backButton.height
        }));

        // Register item elements
        pageItems.forEach((_, index) => {
            this.input.registerElement(`submenu_item_${index}`, {
                bounds: () => ({
                    x: this.layout.x + this.layout.itemPadding,
                    y: this.layout.y + this.layout.headerHeight + 20 + index * this.layout.itemSpacing,
                    width: this.layout.width - this.layout.itemPadding * 2,
                    height: this.layout.itemHeight
                })
            });
        });

        // Register pagination elements
        this.registerPaginationElements(this.layout, items.length);
    }

    update() {
        // Check for back button first
        if (this.input.isElementJustPressed("back_button")) {
            this.characterPanel.selectionState = "none";
            this.characterPanel.selectedCharIndex = -1;
            return "exit";
        }

        // Handle targeting state
        if (this.characterPanel.selectionState === "selecting_target") {
            const inventory = this.gameMaster.partyInventory;
            const items = inventory.getAvailableItems();
            const selectedItem = items[this.selectedIndex];
            const party = this.gameMaster.persistentParty;
            
            // Special handling for Phoenix item to target only dead characters
            const isPhoenixItem = selectedItem && selectedItem.item.name === "Phoenix";

            if (this.characterPanel.targetMode === "single") {
                // Handle mouse hover for targeting
                party.forEach((char, index) => {
                    // For Phoenix, only hover over dead characters; for other items, only hover over living characters
                    if ((isPhoenixItem && !char.isDead) || (!isPhoenixItem && char.isDead)) {
                        return;
                    }
                    
                    if (this.input.isElementHovered(`character_panel_${index}`)) {
                        this.characterPanel.selectedCharIndex = index;
                    }
                });

                // Single target selection
                for (let index = 0; index < party.length; index++) {
                    // Skip invalid targets based on item type
                    if ((isPhoenixItem && !party[index].isDead) || (!isPhoenixItem && party[index].isDead)) {
                        continue;
                    }
                    
                    if (this.input.isElementJustPressed(`character_panel_${index}`)) {
                        this.handleItemUse(items[this.selectedIndex], party[index]);
                        this.characterPanel.selectionState = "none";
                        this.characterPanel.selectedCharIndex = -1;
                        this.characterPanel.isPhoenixTargeting = false; // Reset Phoenix targeting
                        return;
                    }
                }

                if (this.input.isKeyJustPressed("Action1") && this.characterPanel.selectedCharIndex !== -1) {
                    // Check if the target is valid based on item type
                    const targetChar = party[this.characterPanel.selectedCharIndex];
                    if ((isPhoenixItem && targetChar.isDead) || (!isPhoenixItem && !targetChar.isDead)) {
                        this.handleItemUse(items[this.selectedIndex], targetChar);
                        this.characterPanel.selectionState = "none";
                        this.characterPanel.selectedCharIndex = -1;
                        this.characterPanel.isPhoenixTargeting = false; // Reset Phoenix targeting
                    }
                    return;
                }
            } else {
                // All target handling
                if (
                    party.some((char, index) => {
                        // Filter click validation based on item type
                        if ((isPhoenixItem && !char.isDead) || (!isPhoenixItem && char.isDead)) {
                            return false;
                        }
                        return this.input.isElementJustPressed(`character_panel_${index}`);
                    }) ||
                    this.input.isKeyJustPressed("Action1")
                ) {
                    // Filter party members based on item type
                    const validTargets = isPhoenixItem ? 
                        party.filter(char => char.isDead) : 
                        party.filter(char => !char.isDead);
                        
                    this.handleItemUse(items[this.selectedIndex], validTargets);
                    this.characterPanel.selectionState = "none";
                    this.characterPanel.selectedCharIndex = -1;
                    this.characterPanel.isPhoenixTargeting = false; // Reset Phoenix targeting
                    return;
                }
            }

            // Cancel target selection
            if (this.input.isKeyJustPressed("Action2")) {
                this.characterPanel.selectionState = "none";
                this.characterPanel.selectedCharIndex = -1;
                this.characterPanel.isPhoenixTargeting = false; // Reset Phoenix targeting
                return;
            }

            return; // Return early if in targeting state
        }

        // Regular menu navigation
        if (this.input.isKeyJustPressed("Action2")) {
            return "exit";
        }

        const inventory = this.gameMaster.partyInventory;
        const items = inventory.getAvailableItems();
        const startIndex = this.pagination.currentPage * this.pagination.itemsPerPage;
        const pageItems = items.slice(startIndex, startIndex + this.pagination.itemsPerPage);

        // Handle pagination
        if (items.length > this.pagination.itemsPerPage) {
            if (
                (this.input.isElementJustPressed("arrow_left") || this.input.isKeyJustPressed("DirLeft")) &&
                this.pagination.currentPage > 0
            ) {
                this.pagination.currentPage--;
                this.selectedIndex = this.pagination.currentPage * this.pagination.itemsPerPage;
                this.registerElements();
                return;
            }
            if (
                (this.input.isElementJustPressed("arrow_right") || this.input.isKeyJustPressed("DirRight")) &&
                (this.pagination.currentPage + 1) * this.pagination.itemsPerPage < items.length
            ) {
                this.pagination.currentPage++;
                this.selectedIndex = this.pagination.currentPage * this.pagination.itemsPerPage;
                this.registerElements();
                return;
            }
        }

        // Handle item selection clicks first
        for (let i = 0; i < pageItems.length; i++) {
            const actualIndex = startIndex + i;
            if (this.input.isElementJustPressed(`submenu_item_${i}`)) {
                const selectedItem = items[actualIndex];
                if (selectedItem) {
                    this.selectedIndex = actualIndex;
                    this.characterPanel.selectionState = "selecting_target";
                    this.characterPanel.targetMode = selectedItem.item.targetType.startsWith("all_") ? "all" : "single";
                    
                    // Set Phoenix targeting mode if using Phoenix item
                    const isPhoenixItem = selectedItem.item.name === "Phoenix";
                    this.characterPanel.isPhoenixTargeting = isPhoenixItem;
                    
                    // Set initial target based on item type
                    if (this.characterPanel.targetMode === "single") {
                        // Special handling for Phoenix item (target dead characters)
                        if (isPhoenixItem) {
                            // Find first dead character
                            const firstDeadIndex = this.gameMaster.persistentParty.findIndex(char => char.isDead);
                            this.characterPanel.selectedCharIndex = firstDeadIndex >= 0 ? firstDeadIndex : 0;
                        } else {
                            // For regular items, find first living character
                            const firstLivingIndex = this.gameMaster.persistentParty.findIndex(char => !char.isDead);
                            this.characterPanel.selectedCharIndex = firstLivingIndex >= 0 ? firstLivingIndex : 0;
                        }
                    } else {
                        this.characterPanel.selectedCharIndex = -1;
                    }
                    return;
                }
            }
        }

        // Handle hovering over items
        for (let i = 0; i < pageItems.length; i++) {
            const actualIndex = startIndex + i;
            if (this.input.isElementHovered(`submenu_item_${i}`)) {
                this.selectedIndex = actualIndex;
            }
        }

        // Keyboard navigation
        if (this.input.isKeyJustPressed("DirUp")) {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            // Check if we need to change page
            if (this.selectedIndex < startIndex) {
                if (this.pagination.currentPage > 0) {
                    this.pagination.currentPage--;
                    this.registerElements();
                }
            }
            return;
        }

        if (this.input.isKeyJustPressed("DirDown")) {
            this.selectedIndex = Math.min(items.length - 1, this.selectedIndex + 1);
            // Check if we need to change page
            if (this.selectedIndex >= startIndex + this.pagination.itemsPerPage) {
                if ((this.pagination.currentPage + 1) * this.pagination.itemsPerPage < items.length) {
                    this.pagination.currentPage++;
                    this.registerElements();
                }
            }
            return;
        }

        if (this.input.isKeyJustPressed("Action1")) {
            const selectedItem = items[this.selectedIndex];
            if (selectedItem) {
                this.characterPanel.selectionState = "selecting_target";
                this.characterPanel.targetMode = selectedItem.item.targetType.startsWith("all_") ? "all" : "single";
                
                // Set Phoenix targeting mode if using Phoenix item
                const isPhoenixItem = selectedItem.item.name === "Phoenix";
                this.characterPanel.isPhoenixTargeting = isPhoenixItem;
                
                // Set initial target based on item type
                if (this.characterPanel.targetMode === "single") {
                    // Special handling for Phoenix item (target dead characters)
                    if (isPhoenixItem) {
                        // Find first dead character
                        const firstDeadIndex = this.gameMaster.persistentParty.findIndex(char => char.isDead);
                        this.characterPanel.selectedCharIndex = firstDeadIndex >= 0 ? firstDeadIndex : 0;
                    } else {
                        // For regular items, find first living character
                        const firstLivingIndex = this.gameMaster.persistentParty.findIndex(char => !char.isDead);
                        this.characterPanel.selectedCharIndex = firstLivingIndex >= 0 ? firstLivingIndex : 0;
                    }
                } else {
                    this.characterPanel.selectedCharIndex = -1;
                }
                return;
            }
        }
    }

    handleItemUse(itemData, target) {
        const item = itemData.item;
        
        // Check if we have the item
        if (itemData.quantity <= 0) {
            console.log("No items remaining!");
            return false;
        }

        let success = false;
        if (Array.isArray(target)) {
            // Handle all-target items
            target.forEach((char) => {
                if (item.effect) {
                    success = item.effect(char);
                    console.log(`Using ${item.name} on ${char.name}`);
                }
            });
        } else {
            // Handle single-target items
            if (item.effect) {
                success = item.effect(target);
                console.log(`Using ${item.name} on ${target.name}`);
            }
        }

        // If the item was used successfully, decrease the quantity
        if (success) {
            itemData.quantity--;
            // Remove the item if quantity reaches 0
            if (itemData.quantity <= 0) {
                const inventory = this.gameMaster.partyInventory;
                inventory.removeItem(item.id);
            }
            return true;
        }

        return false;
    }

    draw() {
        const m = this.layout;
        const colors = this.gameMaster.modeManager.activeMode.colors;

        // Draw window header with gradient
        this.ctx.fillStyle = this.createGradient(
            m.x,
            m.y,
            m.width,
            m.headerHeight,
            colors.headerBackground.start,
            colors.headerBackground.end
        );
        this.ctx.fillRect(m.x, m.y, m.width, m.headerHeight);

        // Draw main window background with gradient
        this.ctx.fillStyle = this.createGradient(
            m.x,
            m.y + m.headerHeight,
            m.width,
            m.height - m.headerHeight,
            colors.menuBackground.start,
            colors.menuBackground.end
        );
        this.ctx.fillRect(m.x, m.y + m.headerHeight, m.width, m.height - m.headerHeight);

        // Draw back button
        this.drawBackButton(
            m.x + m.width - m.backButton.rightOffset - m.backButton.width / 2,
            m.y + m.backButton.topOffset,
            m.backButton.width,
            m.backButton.height
        );

        // Draw "Items" title
        this.ctx.fillStyle = colors.headerText;
        this.ctx.font = "26px monospace";
        this.ctx.textAlign = "left";
        this.ctx.fillText("Items", m.x + 20, m.y + 28);

        // Draw state-specific content
        if (this.characterPanel.selectionState === "selecting_target") {
            this.ctx.fillStyle = colors.normalText;
            this.ctx.font = "24px monospace";
            this.ctx.textAlign = "center";
            this.ctx.fillText("Select Target", m.x + m.width / 2, m.y + 100);

            // Draw description panel for the selected item
            const inventory = this.gameMaster.partyInventory;
            const items = inventory.getAvailableItems();
            const selectedItem = items[this.selectedIndex];
            
            // Add special message for targeting based on item type
            if (selectedItem) {
                // Draw description
                this.drawDescriptionPanel(selectedItem.item.description);
                
                // Add special targeting message
                this.ctx.font = "18px monospace";
                this.ctx.fillStyle = "#ff4444";
                
                if (selectedItem.item.name === "Phoenix") {
                    this.ctx.fillStyle = "#ffcc00"; // Gold color for Phoenix
                    this.ctx.fillText("(Can only target dead characters)", m.x + m.width / 2, m.y + 130);
                } else {
                    this.ctx.fillText("(Can only target living characters)", m.x + m.width / 2, m.y + 130);
                }
            }
            return;
        }

        const inventory = this.gameMaster.partyInventory;
        const items = inventory.getAvailableItems();
        const startIndex = this.pagination.currentPage * this.pagination.itemsPerPage;
        const pageItems = items.slice(startIndex, startIndex + this.pagination.itemsPerPage);

        pageItems.forEach((itemData, index) => {
            const actualIndex = startIndex + index;
            const y = this.layout.y + this.layout.headerHeight + 20 + index * this.layout.itemSpacing;

            this.ctx.save();

            // Special highlighting for Phoenix items (gold glow)
            const isPhoenixItem = itemData.item.name === "Phoenix";

            // Selection highlight with glow and gradient
            if (actualIndex === this.selectedIndex) {
                // Add glow effect
                this.ctx.shadowColor = isPhoenixItem ? "#ffcc00" : colors.glowColor;
                this.ctx.shadowBlur = colors.glowBlur;

                // Background for selected item with gradient
                this.ctx.fillStyle = this.createGradient(
                    this.layout.x + this.layout.itemPadding,
                    y - 2,
                    this.layout.width - this.layout.itemPadding * 2,
                    this.layout.itemHeight,
                    isPhoenixItem ? "rgba(255, 204, 0, 0.3)" : colors.selectedBackground.start,
                    isPhoenixItem ? "rgba(255, 204, 0, 0.5)" : colors.selectedBackground.end
                );
                this.ctx.fillRect(
                    this.layout.x + this.layout.itemPadding,
                    y - 2,
                    this.layout.width - this.layout.itemPadding * 2,
                    this.layout.itemHeight
                );
            }

            // Text color - normalText by default, selectedText when selected
            if (isPhoenixItem) {
                // Phoenix items get gold color
                this.ctx.fillStyle = actualIndex === this.selectedIndex ? "#ffcc00" : "#ddaa00";
            } else {
                this.ctx.fillStyle = actualIndex === this.selectedIndex ? colors.selectedText : colors.normalText;
            }
            this.ctx.font = "24px monospace";

            // Draw item emoji and name (left aligned)
            this.ctx.textAlign = "left";
            this.ctx.fillText(itemData.item.emoji, this.layout.x + 20, y + this.layout.textOffset);
            this.ctx.fillText(itemData.item.name, this.layout.x + 60, y + this.layout.textOffset);

            // Draw quantity (right aligned)
            this.ctx.textAlign = "right";
            this.ctx.fillText(
                `x${itemData.quantity}`,
                this.layout.x + this.layout.width - 20,
                y + this.layout.textOffset
            );

            this.ctx.restore();
        });

        // Draw pagination if needed
        if (items.length > this.pagination.itemsPerPage) {
            this.drawPagination(items.length, this.layout);
        }

        // Draw description panel last
        const selectedItem = items[this.selectedIndex];
        if (selectedItem) {
            this.drawDescriptionPanel(selectedItem.item.description);
        } else {
            this.drawDescriptionPanel("");
        }
    }

    cleanup() {
        super.cleanup();
        const inventory = this.gameMaster.partyInventory;
        const items = inventory.getAvailableItems();
        items.forEach((_, index) => {
            this.input.removeElement(`submenu_item_${index}`);
        });
    }
}