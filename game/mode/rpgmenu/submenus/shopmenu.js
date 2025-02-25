class ShopMenu extends BaseFullScreenMenu {
    constructor(ctx, input, gameMaster) {
        super(ctx, input, gameMaster);
        this.selectedIndex = 0;
        this.mode = "buy";
        
        // Create main container
        this.createContainer("main", {
            x: 0,
            y: 0,
            width: Game.WIDTH,
            height: Game.HEIGHT
        });
        
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
                selected: this.mode === "buy" && index === this.selectedIndex,
                background: { width: 600, height: 30, visible: true },
                selectable: { onClick: () => this.selectBuyItem(index) }
            });
            
            this.input.registerElement(`buyItem_${index}`, {
                bounds: () => ({
                    x: 60,
                    y: 120 + index * 40 - 15,
                    width: 600,
                    height: 30
                })
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
                selected: this.mode === "sell" && index === this.selectedIndex,
                background: { width: 600, height: 30, visible: true },
                selectable: { onClick: () => this.selectSellItem(index) }
            });
            
            this.input.registerElement(`sellItem_${index}`, {
                bounds: () => ({
                    x: 60,
                    y: 120 + index * 40 - 15,
                    width: 600,
                    height: 30
                })
            });
        });
    }
    
    getBuyItems() {
        const shopItems = [];
        for (const id in ITEMS) {
            const item = ITEMS[id];
            if (item && item.price && item.price > 0) {
                shopItems.push({
                    item: item,
                    price: item.price
                });
            }
        }
        return shopItems;
    }
    
    getSellItems() {
        return this.gameMaster.partyInventory.getAvailableItems();
    }
    
    switchTab(mode) {
        if (this.mode === mode) return;
        
        this.mode = mode;
        this.selectedIndex = 0;
        
        // Update tab button states
        this.elements.get("buyButton").selected = (mode === "buy");
        this.elements.get("sellButton").selected = (mode === "sell");
        
        // Show/hide the appropriate container
        this.containers.get("buyItems").visible = (mode === "buy");
        this.containers.get("sellItems").visible = (mode === "sell");
        
        // Update selection states within the visible container
        this.updateSelectionStates();
    }
    
    selectBuyItem(index) {
        if (this.mode !== "buy") return;
        this.selectedIndex = index;
        this.updateSelectionStates();
    }
    
    selectSellItem(index) {
        if (this.mode !== "sell") return;
        this.selectedIndex = index;
        this.updateSelectionStates();
    }
    
    updateSelectionStates() {
        const prefix = this.mode === "buy" ? "buyItem_" : "sellItem_";
        const items = this.mode === "buy" ? this.getBuyItems() : this.getSellItems();
        
        for (let i = 0; i < items.length; i++) {
            const element = this.elements.get(`${prefix}${i}`);
            if (element) {
                element.selected = (i === this.selectedIndex);
            }
        }
    }
    
    handleTransaction() {
        if (this.mode === "buy") {
            const items = this.getBuyItems();
            if (items.length === 0 || this.selectedIndex >= items.length) return;
            
            const selectedItem = items[this.selectedIndex];
            const gold = this.gameMaster.persistentParty.gold || 0;
            
            if (gold >= selectedItem.price) {
                this.gameMaster.persistentParty.gold = gold - selectedItem.price;
                this.gameMaster.partyInventory.addItem(selectedItem.item.id);
                this.elements.get("gold").text = `Gold: ${this.gameMaster.persistentParty.gold}`;
                
                // Refresh the sell tab since we just bought something
                this.refreshSellTab();
            }
        } else {
            const items = this.getSellItems();
            if (items.length === 0 || this.selectedIndex >= items.length) return;
            
            const selectedItem = items[this.selectedIndex];
            const sellPrice = Math.floor(selectedItem.item.price / 2);
            
            this.gameMaster.partyInventory.removeItem(selectedItem.item.id);
            this.gameMaster.persistentParty.gold = (this.gameMaster.persistentParty.gold || 0) + sellPrice;
            this.elements.get("gold").text = `Gold: ${this.gameMaster.persistentParty.gold}`;
            
            // Refresh the sell tab
            this.refreshSellTab();
        }
    }
    
    refreshSellTab() {
        // Clear all sell tab elements
        const elementsToRemove = [];
        this.elements.forEach((element, key) => {
            if (key.startsWith("sellItem_") || key === "sellNoItems") {
                elementsToRemove.push(key);
            }
        });
        
        elementsToRemove.forEach(key => {
            this.elements.delete(key);
        });
        
        // Unregister input elements
        for (let i = 0; i < 30; i++) {
            this.input.removeElement(`sellItem_${i}`);
        }
        
        // Repopulate sell tab
        this.populateSellTab();
        
        // Reset selection if necessary
        if (this.mode === "sell") {
            this.selectedIndex = 0;
            this.updateSelectionStates();
        }
    }
    
    update() {
        // Check for back button
        if (this.input.isElementJustPressed("back_button")) {
            return "exit";
        }
        
        const items = this.mode === "buy" ? this.getBuyItems() : this.getSellItems();
        
        // Only handle navigation if we have items
        if (items.length > 0) {
            if (this.input.isKeyJustPressed("DirUp")) {
                if (this.selectedIndex > 0) {
                    this.selectedIndex--;
                    this.updateSelectionStates();
                }
            }
            
            if (this.input.isKeyJustPressed("DirDown")) {
                if (this.selectedIndex < items.length - 1) {
                    this.selectedIndex++;
                    this.updateSelectionStates();
                }
            }
        }
        
        // Tab switching
        if (this.input.isKeyJustPressed("DirLeft") || this.input.isKeyJustPressed("DirRight")) {
            this.switchTab(this.mode === "buy" ? "sell" : "buy");
        }
        
        // Handle transaction
        if (this.input.isKeyJustPressed("Action1")) {
            this.handleTransaction();
        }
        
        // Exit
        if (this.input.isKeyJustPressed("Action2")) {
            return "exit";
        }
        
        return super.update();
    }
    
    draw() {
        super.draw();
        
        // Draw prices for current tab items
        const items = this.mode === "buy" ? this.getBuyItems() : this.getSellItems();
        
        items.forEach((itemData, index) => {
            // Only draw if the container is visible
            if ((this.mode === "buy" && this.containers.get("buyItems").visible) ||
                (this.mode === "sell" && this.containers.get("sellItems").visible)) {
                
                this.ctx.font = "22px monospace";
                this.ctx.textAlign = "right";
                
                const isSelected = (index === this.selectedIndex);
                this.ctx.fillStyle = isSelected ? this.colors.selectedText : this.colors.normalText;
                
                const price = this.mode === "buy" ? 
                    itemData.price : 
                    Math.floor(itemData.item.price / 2);
                
                this.ctx.fillText(`${price} G`, 620, 120 + (index * 40));
            }
        });
        
        // Draw description for selected item
        if (items.length > 0 && this.selectedIndex < items.length) {
            const selectedItem = items[this.selectedIndex];
            const descY = 120 + items.length * 40 + 20;
            
            this.ctx.font = "18px monospace";
            this.ctx.fillStyle = this.colors.normalText;
            this.ctx.textAlign = "left";
            
            if (selectedItem.item.description) {
                this.ctx.fillText(selectedItem.item.description, 60, descY);
            }
            
            const price = this.mode === "buy" ? 
                selectedItem.price : 
                Math.floor(selectedItem.item.price / 2);
                
            const actionText = this.mode === "buy" ? 
                `Press Action to buy for ${price} G` : 
                `Press Action to sell for ${price} G`;
                
            this.ctx.fillText(actionText, 60, descY + 30);
        }
    }
    
    handleAction1() {
        this.handleTransaction();
        return null;
    }
    
    handleAction2() {
        return "exit";
    }
    
    cleanup() {
        super.cleanup();
        
        // Clean up all item elements
        for (let i = 0; i < 30; i++) {
            this.input.removeElement(`buyItem_${i}`);
            this.input.removeElement(`sellItem_${i}`);
        }
    }
}