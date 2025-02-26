class ShopMenu extends BaseFullScreenMenu {
    constructor(ctx, input, gameMaster, shopData = null) {
        super(ctx, input, gameMaster);
        this.selectedIndex = 0;
        this.mode = "buy";

        // Use provided shop data or generate if null
        const generatedShop = shopData || ItemShopListGenerator.generate();
        this.shopItems = generatedShop.items;
        this.shopBuyPrices = generatedShop.buyPrices;

        // Create separate containers for buy and sell tabs
        this.createContainer("buyItems", {
            x: 0,
            y: 120,
            width: Game.WIDTH,
            height: Game.HEIGHT - 120
        });

        this.createContainer("sellItems", {
            x: 0,
            y: 120,
            width: Game.WIDTH,
            height: Game.HEIGHT - 120
        });

        // Set initial visibility
        this.containers.get("buyItems").visible = true;
        this.containers.get("sellItems").visible = false;

        // Setup UI
        this.setupUI();
        this.populateBuyTab();
        this.populateSellTab();

        this.registerElements();
    }

    setupUI() {
        // Add panel
        this.addElement("main", {
            name: "panel",
            type: "panel",
            x: 40,
            y: 20,
            width: 720,
            height: 560,
            focusable: false,
            panel: { borderWidth: 2, drawBackground: true },
            background: { visible: false }
        });

        // Add title
        this.addElement("main", {
            name: "title",
            type: "textLabel",
            x: 60,
            y: 40,
            width: 200,
            height: 40,
            text: "Item Shop",
            font: "32px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: false,
            background: { visible: false }
        });

        // Add gold
        this.addElement("main", {
            name: "gold",
            type: "textLabel",
            x: 500,
            y: 40,
            width: 200,
            height: 40,
            text: `Gold: ${this.gameMaster.persistentParty.gold || 0}`,
            font: "26px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: false,
            background: { visible: false }
        });

        // Add buy tab button
        this.addElement("main", {
            name: "buyButton",
            type: "textButton",
            x: 60,
            y: 80,
            width: 80,
            height: 30,
            text: "Buy",
            textOffsetX: 20,
            font: "22px monospace",
            focusable: true,
            selected: this.mode === "buy",
            background: { width: 80, height: 30, visible: true },
            button: { onClick: () => this.switchTab("buy") }
        });

        // Add sell tab button
        this.addElement("main", {
            name: "sellButton",
            type: "textButton",
            x: 150,
            y: 80,
            width: 80,
            height: 30,
            text: "Sell",
            textOffsetX: 20,
            font: "22px monospace",
            focusable: true,
            selected: this.mode === "sell",
            background: { width: 80, height: 30, visible: true },
            button: { onClick: () => this.switchTab("sell") }
        });
    }

    populateBuyTab() {
        const buyItems = this.getBuyItems();

        if (buyItems.length === 0) {
            this.addElement("buyItems", {
                name: "buyNoItems",
                type: "textLabel",
                x: 60,
                y: 0,
                width: 600,
                height: 30,
                text: "No items available to buy.",
                font: "22px monospace",
                textAlign: "left",
                textBaseline: "middle",
                focusable: false,
                background: { visible: false }
            });
            return;
        }

        buyItems.forEach((item, index) => {
            this.addElement("buyItems", {
                name: `buyItem_${index}`,
                type: "selectable",
                x: 60,
                y: index * 40,
                width: 600,
                height: 30,
                text: `${item.item.emoji} ${item.item.name}`,
                textOffsetX: 10,
                font: "22px monospace",
                focusable: true,
                selected: false,
                background: { width: 600, height: 30, visible: true },
                selectable: {
                    onClick: () => {
                        this.selectBuyItem(index);
                        this.handleTransaction();
                    }
                }
            });
        });
    }

    populateSellTab() {
        const sellItems = this.getSellItems();

        if (sellItems.length === 0) {
            this.addElement("sellItems", {
                name: "sellNoItems",
                type: "textLabel",
                x: 60,
                y: 0,
                width: 600,
                height: 30,
                text: "No items available to sell.",
                font: "22px monospace",
                textAlign: "left",
                textBaseline: "middle",
                focusable: false,
                background: { visible: false }
            });
            return;
        }

        sellItems.forEach((item, index) => {
            this.addElement("sellItems", {
                name: `sellItem_${index}`,
                type: "selectable",
                x: 60,
                y: index * 40,
                width: 600,
                height: 30,
                text: `${item.item.emoji} ${item.item.name}`,
                textOffsetX: 10,
                font: "22px monospace",
                focusable: true,
                selected: false,
                background: { width: 600, height: 30, visible: true },
                selectable: {
                    onClick: () => {
                        this.selectSellItem(index);
                        this.handleTransaction();
                    }
                }
            });
        });
    }

    getBuyItems() {
        if (!this.shopItems || this.shopItems.length === 0) {
            return [];
        }

        return this.shopItems
            .map((item) => {
                // If item is just an ID, look it up in ITEMS
                if (typeof item === "string") {
                    return {
                        item: ITEMS[item],
                        price: ITEMS[item].price || 0,
                        quantity: 1
                    };
                }
                // If item is an object with id and custom price
                else if (item.id && ITEMS[item.id]) {
                    return {
                        item: ITEMS[item.id],
                        price: item.price || ITEMS[item.id].price || 0,
                        quantity: item.quantity || 1
                    };
                }
                // If it's already a formatted shop item
                else if (item.item) {
                    return item;
                }

                return null;
            })
            .filter((item) => item !== null && item.price > 0 && item.quantity > 0);
    }

    getShopBuyPrice(itemName) {
        return this.shopBuyPrices[itemName] || 1;
    }

    getSellItems() {
    return this.gameMaster.partyInventory.getAvailableItems().map((inventoryEntry) => {
        // The ID in the inventory is the key to look up in shopBuyPrices
        const sellPrice = this.shopBuyPrices[inventoryEntry.id] || 1;
        
        return {
            ...inventoryEntry,
            sellPrice: sellPrice
        };
    });
}

    switchTab(mode) {
        if (this.mode === mode) return;

        this.mode = mode;
        this.selectedIndex = 0;

        // Update tab button states
        this.elements.get("buyButton").selected = mode === "buy";
        this.elements.get("sellButton").selected = mode === "sell";

        // Show/hide the appropriate container
        this.containers.get("buyItems").visible = mode === "buy";
        this.containers.get("sellItems").visible = mode === "sell";
    }

    selectBuyItem(index) {
        if (this.mode !== "buy") return;
        this.selectedIndex = index;
    }

    selectSellItem(index) {
        if (this.mode !== "sell") return;
        this.selectedIndex = index;
    }

    handleTransaction() {
        if (this.mode === "buy") {
            const items = this.getBuyItems();
            if (items.length === 0 || this.selectedIndex >= items.length) return;

            const selectedItem = items[this.selectedIndex];
            const gold = this.gameMaster.persistentParty.gold || 0;

            if (gold >= selectedItem.price && selectedItem.quantity > 0) {
                // Subtract gold and add item to inventory
                this.gameMaster.persistentParty.gold = gold - selectedItem.price;
                this.gameMaster.partyInventory.addItem(selectedItem.item.id);
                this.elements.get("gold").text = `Gold: ${this.gameMaster.persistentParty.gold}`;

                // Decrease quantity
                selectedItem.quantity--;

                // If item is sold out, refresh the buy tab
                if (selectedItem.quantity <= 0) {
                    this.shopItems = this.shopItems.filter((item) =>
                        typeof item === "string"
                            ? item !== selectedItem.item.id
                            : item.id
                              ? item.id !== selectedItem.item.id
                              : item !== selectedItem
                    );
                    this.refreshBuyTab();
                }

                // Refresh the sell tab since we just bought something
                this.refreshSellTab();
            }
        } else {
            const items = this.getSellItems();
            if (items.length === 0 || this.selectedIndex >= items.length) return;

            const selectedItem = items[this.selectedIndex];
            const sellPrice = selectedItem.sellPrice || 1; // Use our precalculated price

            // Add gold and remove item
            this.gameMaster.partyInventory.removeItem(selectedItem.item.id);
            this.gameMaster.persistentParty.gold = (this.gameMaster.persistentParty.gold || 0) + sellPrice;
            this.elements.get("gold").text = `Gold: ${this.gameMaster.persistentParty.gold}`;

            // Refresh the sell tab
            this.refreshSellTab();
        }
    }

    refreshBuyTab() {
        // Clean up existing elements
        this.elements.forEach((element, key) => {
            if (key.startsWith("buyItem_") || key === "buyNoItems") {
                this.elements.delete(key);
            }
        });

        // Repopulate
        this.populateBuyTab();
    }

    refreshSellTab() {
        // Clean up existing elements
        this.elements.forEach((element, key) => {
            if (key.startsWith("sellItem_") || key === "sellNoItems") {
                this.elements.delete(key);
            }
        });

        // Repopulate
        this.populateSellTab();
    }

    handleDirectionalInput(direction) {
        if (!this.currentFocus) {
            if (this.mode === "buy") {
                this.currentFocus = this.elements.get("buyButton");
            } else {
                this.currentFocus = this.elements.get("sellButton");
            }
            this.currentFocus.selected = true;
            return;
        }

        const current = this.currentFocus;

        if (direction === "left" || direction === "right") {
            // Switch tabs
            this.switchTab(this.mode === "buy" ? "sell" : "buy");

            // Update current focus
            if (this.mode === "buy") {
                current.selected = false;
                this.currentFocus = this.elements.get("buyButton");
                this.currentFocus.selected = true;
            } else {
                current.selected = false;
                this.currentFocus = this.elements.get("sellButton");
                this.currentFocus.selected = true;
            }
            return;
        }

        // Handle up/down navigation
        let validElements = [];
        const items = this.mode === "buy" ? this.getBuyItems() : this.getSellItems();

        // Determine valid next elements based on current position and direction
        if (current === this.elements.get("buyButton") || current === this.elements.get("sellButton")) {
            // If on tab buttons, can only go down to items
            if (direction === "down" && items.length > 0) {
                const prefix = this.mode === "buy" ? "buyItem_" : "sellItem_";
                validElements.push(this.elements.get(`${prefix}0`));
                this.selectedIndex = 0;
            }
        } else {
            // Figure out which item we're on
            let currentIndex = -1;
            const prefix = this.mode === "buy" ? "buyItem_" : "sellItem_";

            for (let i = 0; i < items.length; i++) {
                if (current === this.elements.get(`${prefix}${i}`)) {
                    currentIndex = i;
                    break;
                }
            }

            if (currentIndex === -1) return;

            if (direction === "up") {
                if (currentIndex > 0) {
                    validElements.push(this.elements.get(`${prefix}${currentIndex - 1}`));
                    this.selectedIndex = currentIndex - 1;
                } else {
                    // Go up to tab buttons
                    validElements.push(
                        this.mode === "buy" ? this.elements.get("buyButton") : this.elements.get("sellButton")
                    );
                }
            } else if (direction === "down") {
                if (currentIndex < items.length - 1) {
                    validElements.push(this.elements.get(`${prefix}${currentIndex + 1}`));
                    this.selectedIndex = currentIndex + 1;
                }
            }
        }

        // Apply the navigation change
        if (validElements.length > 0) {
            current.selected = false;
            this.currentFocus = validElements[0];
            this.currentFocus.selected = true;
        }
    }

    update() {
        // Handle keyboard navigation
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

        return super.update();
    }

    draw() {
        super.draw();

        // Draw prices for current tab items
        const items = this.mode === "buy" ? this.getBuyItems() : this.getSellItems();

        items.forEach((itemData, index) => {
            // Only draw if the container is visible
            if (
                (this.mode === "buy" && this.containers.get("buyItems").visible) ||
                (this.mode === "sell" && this.containers.get("sellItems").visible)
            ) {
                this.ctx.font = "22px monospace";
                this.ctx.textAlign = "right";

                const prefix = this.mode === "buy" ? "buyItem_" : "sellItem_";
                const element = this.elements.get(`${prefix}${index}`);
                const isSelected = element && element.selected;

                this.ctx.fillStyle = isSelected ? this.colors.selectedText : this.colors.normalText;

                // Use the right price based on mode
                const price = this.mode === "buy" ? itemData.price : itemData.sellPrice || 1; // Use our precalculated sell price

                this.ctx.fillText(`${price} G`, 620, 120 + index * 40);
            }
        });

        // Find the currently selected item index
        let selectedItemIndex = -1;
        if (this.currentFocus) {
            const prefix = this.mode === "buy" ? "buyItem_" : "sellItem_";
            for (let i = 0; i < items.length; i++) {
                if (this.currentFocus === this.elements.get(`${prefix}${i}`)) {
                    selectedItemIndex = i;
                    break;
                }
            }
        }

        // Draw description for the focused item
        if (items.length > 0 && selectedItemIndex >= 0 && selectedItemIndex < items.length) {
            const selectedItem = items[selectedItemIndex];
            const descY = 120 + items.length * 40 + 20;

            this.ctx.font = "18px monospace";
            this.ctx.fillStyle = this.colors.normalText;
            this.ctx.textAlign = "left";

            if (selectedItem.item.description) {
                this.ctx.fillText(selectedItem.item.description, 60, descY);
            }

            // Use the right price based on mode
            const price = this.mode === "buy" ? selectedItem.price : selectedItem.sellPrice || 1;

            const actionText =
                this.mode === "buy" ? `Press Action to buy for ${price} G` : `Press Action to sell for ${price} G`;

            this.ctx.fillText(actionText, 60, descY + 30);
        }
    }

    handleAction1() {
        if (!this.currentFocus) return null;

        // Handle button clicks
        if (this.currentFocus === this.elements.get("buyButton")) {
            this.switchTab("buy");
            return null;
        }
        if (this.currentFocus === this.elements.get("sellButton")) {
            this.switchTab("sell");
            return null;
        }

        // Handle item actions
        this.handleTransaction();
        return null;
    }

    handleAction2() {
        return "exit";
    }

    cleanup() {
        super.cleanup();
    }
}

class ItemShopListGenerator {
    static generate() {
        // Generate a random list of items with prices and quantities
        const allItems = Object.keys(ITEMS);
        const shopItems = [];

        // Pick some random items (between 3-7)
        const itemCount = Math.floor(Math.random() * 5) + 3;

        for (let i = 0; i < itemCount; i++) {
            if (allItems.length === 0) break;

            // Get a random item ID
            const randomIndex = Math.floor(Math.random() * allItems.length);
            const itemId = allItems.splice(randomIndex, 1)[0];

            // Generate a price if needed
            const basePrice = Math.floor(Math.random() * 100) + 50;
            
            // Add to shop with random quantity
            shopItems.push({
                item: ITEMS[itemId],
                price: basePrice,
                quantity: Math.floor(Math.random() * 10) + 1
            });
        }

        // Generate shop buy prices (what shop will pay for items)
        const shopBuyPrices = {};
        
        // For each possible item in the game
        for (const itemId in ITEMS) {
            // Generate a base price for this item (even if not in shop)
            const basePrice = Math.floor(Math.random() * 100) + 50;
            
            // Generate buy price (what shop pays player)
            // Default to 40-60% of the base price
            const buyPercentage = 0.4 + (Math.random() * 0.2);
            shopBuyPrices[itemId] = Math.max(1, Math.floor(basePrice * buyPercentage));
        }

        return {
            items: shopItems,
            buyPrices: shopBuyPrices
        };
    }
}