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
            const party = this.gameMaster.persistentParty;

            if (this.characterPanel.targetMode === "single") {
                // Handle mouse hover for targeting
                party.forEach((_, index) => {
                    if (this.input.isElementHovered(`character_panel_${index}`)) {
                        this.characterPanel.selectedCharIndex = index;
                    }
                });

                // Single target selection
                for (let index = 0; index < party.length; index++) {
                    if (this.input.isElementJustPressed(`character_panel_${index}`)) {
                        this.handleItemUse(items[this.selectedIndex], party[index]);
                        this.characterPanel.selectionState = "none";
                        this.characterPanel.selectedCharIndex = -1;
                        return;
                    }
                }

                if (this.input.isKeyJustPressed("Action1") && this.characterPanel.selectedCharIndex !== -1) {
                    this.handleItemUse(items[this.selectedIndex], party[this.characterPanel.selectedCharIndex]);
                    this.characterPanel.selectionState = "none";
                    this.characterPanel.selectedCharIndex = -1;
                    return;
                }
            } else {
                // All target handling
                if (
                    party.some((_, index) => this.input.isElementJustPressed(`character_panel_${index}`)) ||
                    this.input.isKeyJustPressed("Action1")
                ) {
                    this.handleItemUse(items[this.selectedIndex], party);
                    this.characterPanel.selectionState = "none";
                    this.characterPanel.selectedCharIndex = -1;
                    return;
                }
            }

            // Cancel target selection
            if (this.input.isKeyJustPressed("Action2")) {
                this.characterPanel.selectionState = "none";
                this.characterPanel.selectedCharIndex = -1;
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
            if (this.input.isElementJustPressed("arrow_left") && this.pagination.currentPage > 0) {
                this.pagination.currentPage--;
                this.registerElements();
                return;
            }
            if (
                this.input.isElementJustPressed("arrow_right") &&
                (this.pagination.currentPage + 1) * this.pagination.itemsPerPage < items.length
            ) {
                this.pagination.currentPage++;
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
                    this.characterPanel.selectionState = "selecting_target";
                    this.characterPanel.targetMode = selectedItem.item.targetType.startsWith("all_") ? "all" : "single";
                    this.characterPanel.selectedCharIndex = this.characterPanel.targetMode === "single" ? 0 : -1;
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
                this.characterPanel.selectedCharIndex = this.characterPanel.targetMode === "single" ? 0 : -1;
                return;
            }
        }
    }

    handleItemUse(itemData, target) {
        if (Array.isArray(target)) {
            // Handle all-target items
            target.forEach((char) => {
                console.log(`Using ${itemData.item.name} on ${char.name}`);
            });
        } else {
            // Handle single-target items
            console.log(`Using ${itemData.item.name} on ${target.name}`);
        }
        // Add actual item use logic here
    }

    draw() {
        const m = this.layout;

        // Draw window header
        this.ctx.fillStyle = "rgba(0, 0, 153, 0.95)";
        this.ctx.fillRect(m.x, m.y, m.width, m.headerHeight);

        // Draw main window background
        this.ctx.fillStyle = "rgba(0, 0, 102, 0.95)";
        this.ctx.fillRect(m.x, m.y + m.headerHeight, m.width, m.height - m.headerHeight);

        // Draw back button
        this.drawBackButton(
            m.x + m.width - m.backButton.rightOffset - m.backButton.width / 2,
            m.y + m.backButton.topOffset,
            m.backButton.width,
            m.backButton.height
        );

        // Draw "Items" title
        this.ctx.fillStyle = "#00ffff";
        this.ctx.font = "26px monospace";
        this.ctx.textAlign = "left";
        this.ctx.fillText("Items", m.x + 20, m.y + 28);

        const inventory = this.gameMaster.partyInventory;
        const items = inventory.getAvailableItems();
        const startIndex = this.pagination.currentPage * this.pagination.itemsPerPage;
        const pageItems = items.slice(startIndex, startIndex + this.pagination.itemsPerPage);

        pageItems.forEach((itemData, index) => {
            const actualIndex = startIndex + index;
            const y = this.layout.y + this.layout.headerHeight + 20 + index * this.layout.itemSpacing;

            // Selection highlight
            if (actualIndex === this.selectedIndex) {
                this.ctx.fillStyle = "rgba(0, 51, 102, 0.95)";
                this.ctx.fillRect(
                    this.layout.x + this.layout.itemPadding,
                    y - 2,
                    this.layout.width - this.layout.itemPadding * 2,
                    this.layout.itemHeight
                );
            }

            this.ctx.fillStyle = actualIndex === this.selectedIndex ? "#00ffff" : "#ffffff";
            this.ctx.font = "24px monospace";
            this.ctx.textAlign = "left";

            this.ctx.fillText(itemData.item.emoji, this.layout.x + 20, y + this.layout.textOffset);
            this.ctx.fillText(
                `${itemData.item.name} x${itemData.quantity}`,
                this.layout.x + 60,
                y + this.layout.textOffset
            );
        });

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