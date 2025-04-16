// game/mode/battle/entities/equipmentinventory.js
class EquipmentInventory {
    constructor() {
        // Store equipment as an array of items
        // Each item should be a unique object with its own properties
        this.equipment = [];
    }

    addItem(item) {
        if (!item || !item.type) {
            console.warn("Cannot add invalid equipment item");
            return false;
        }

        // Clone the item to ensure each item is unique
        const itemCopy = JSON.parse(JSON.stringify(item));
        
        // Add a unique identifier if it doesn't have one
        if (!itemCopy.uniqueId) {
            itemCopy.uniqueId = Date.now() + Math.random().toString(36).substr(2, 9);
        }
        
        this.equipment.push(itemCopy);
        return true;
    }

    removeItem(item) {
        if (!item) return false;
        
        let index = -1;
        
        // Find by uniqueId if available, otherwise use name and type
        if (item.uniqueId) {
            index = this.equipment.findIndex(eq => eq.uniqueId === item.uniqueId);
        } else {
            index = this.equipment.findIndex(eq => 
                eq.id === item.id || (eq.name === item.name && eq.type === item.type));
        }
        
        if (index === -1) {
            console.warn(`Equipment ${item.name} not found in inventory`);
            return false;
        }
        
        this.equipment.splice(index, 1);
        return true;
    }

    getItemsByType(type) {
        return this.equipment.filter(item => item.type === type);
    }

    getAllItems() {
        return [...this.equipment];
    }

    // Find an item by its unique ID
    getItemById(uniqueId) {
        return this.equipment.find(item => item.uniqueId === uniqueId);
    }
}