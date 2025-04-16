// game/mode/battle/entities/inventory.js
class Inventory {
    constructor() {
        // Store items as a Map with item IDs and quantities
        this.items = new Map();
    }

    addItem(itemId, quantity = 1) {
        console.log(`[Inventory] Attempting to add: ${itemId} (quantity: ${quantity})`);
        console.log(`[Inventory] Item exists in ITEMS?: ${!!ITEMS[itemId]}`);

        if (!ITEMS[itemId]) {
            console.warn(`[Inventory] REJECTED - Invalid item ID: "${itemId}" (type: ${typeof itemId})`);
            console.log(`[Inventory] Valid IDs are:`, Object.keys(ITEMS));
            return false;
        }

        const currentQuantity = this.items.get(itemId) || 0;
        this.items.set(itemId, currentQuantity + quantity);
        console.log(`[Inventory] SUCCESS - Added ${quantity} of ${itemId}, new total: ${currentQuantity + quantity}`);
        return true;
    }

    removeItem(itemId, quantity = 1) {
        const currentQuantity = this.items.get(itemId) || 0;
        if (currentQuantity < quantity) {
            console.warn(`Attempted to remove more ${itemId} than available`);
            return false;
        }

        const newQuantity = currentQuantity - quantity;
        if (newQuantity === 0) {
            this.items.delete(itemId);
        } else {
            this.items.set(itemId, newQuantity);
        }
        return true;
    }

    useItem(itemId, target) {
        if (!this.hasItem(itemId)) {
            console.warn(`Attempted to use unavailable item: ${itemId}`);
            return false;
        }

        const item = ITEMS[itemId];
        const result = item.effect(target);

        // Only remove the item if the effect was successful
        if (result) {
            this.removeItem(itemId);
            return true;
        }
        return false;
    }
    hasItem(itemId) {
        return (this.items.get(itemId) || 0) > 0;
    }

    getQuantity(itemId) {
        return this.items.get(itemId) || 0;
    }

    getAvailableItems() {
        // Returns array of {id, item, quantity} for all items with quantity > 0
        return Array.from(this.items.entries())
            .filter(([_, quantity]) => quantity > 0)
            .map(([id, quantity]) => ({
                id,
                item: ITEMS[id],
                quantity
            }));
    }
}