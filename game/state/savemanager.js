// game/state/savemanager.js
class SaveManager {
    constructor() {
        this.savePrefix = "ActionEngineJS_Save_";
        this.maxSlots = 10;
    }

    // Get all save files
    getSaves() {
        const saves = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.savePrefix)) {
                try {
                    const saveData = JSON.parse(localStorage.getItem(key));
                    const saveId = key.replace(this.savePrefix, "");
                    const slotNumber = saveId.replace("slot_", "");
                    
                    saves.push({
                        id: saveId,
                        slotNumber: parseInt(slotNumber),
                        name: `Slot ${slotNumber}`,
                        date: new Date(saveData.timestamp),
                        data: saveData
                    });
                } catch (e) {
                    console.error(`Error parsing save ${key}:`, e);
                }
            }
        }
        
        // Sort by slot number
        saves.sort((a, b) => a.slotNumber - b.slotNumber);
        return saves;
    }

    // Create a new save
    saveGame(gameMaster, slotId) {
        const saveKey = this.savePrefix + slotId;
        const slotNumber = slotId.replace("slot_", "");
        
        // Prepare save data
        const saveData = {
            name: `Slot ${slotNumber}`,
            timestamp: Date.now(),
            // Player data
            playerState: this.serializePlayerState(gameMaster.playerState),
            // Party data - we need to handle Character objects
            party: this.serializeParty(gameMaster.persistentParty),
            // Inventory - convert Map to array
            inventory: this.serializeInventory(gameMaster.partyInventory),
            // Time data
            worldTime: gameMaster.worldTime,
            // UI Colors
            colors: gameMaster.persistentParty.colors
        };
        
        // Save to localStorage
        try {
            localStorage.setItem(saveKey, JSON.stringify(saveData));
            console.log(`Game saved to slot ${slotNumber}`);
            return { success: true, saveId: slotId };
        } catch (e) {
            console.error("Failed to save game:", e);
            return { success: false, error: e.message };
        }
    }

    // Load a save
    loadGame(gameMaster, slotId) {
        const saveKey = this.savePrefix + slotId;
        
        try {
            const saveData = JSON.parse(localStorage.getItem(saveKey));
            if (!saveData) {
                console.error(`Save ${slotId} not found`);
                return { success: false, error: "Save not found" };
            }
            
            // Update game state
            
            // 1. Player state
            gameMaster.playerState = this.deserializePlayerState(saveData.playerState);
            
            // 2. Party data
            this.deserializeParty(saveData.party, gameMaster.persistentParty);
            
            // 3. Inventory
            this.deserializeInventory(saveData.inventory, gameMaster.partyInventory);
            
            // 4. World time
            gameMaster.worldTime = saveData.worldTime;
            
            // 5. UI colors
            if (saveData.colors) {
                gameMaster.persistentParty.colors = saveData.colors;
            }
            
            console.log(`Game loaded from slot ${slotId.replace("slot_", "")}`);
            return { success: true };
        } catch (e) {
            console.error(`Failed to load save ${slotId}:`, e);
            return { success: false, error: e.message };
        }
    }

    // Delete a save
    deleteSave(slotId) {
        const saveKey = this.savePrefix + slotId;
        try {
            localStorage.removeItem(saveKey);
            console.log(`Save deleted from slot ${slotId.replace("slot_", "")}`);
            return { success: true };
        } catch (e) {
            console.error(`Failed to delete save ${slotId}:`, e);
            return { success: false, error: e.message };
        }
    }
    
    // Serialization helpers
    serializePlayerState(playerState) {
        return {
            position: this.serializeVector3(playerState.position),
            rotation: playerState.rotation,
            linear_velocity: this.serializeVector3(playerState.linear_velocity),
            angular_velocity: this.serializeVector3(playerState.angular_velocity),
            physics_properties: playerState.physics_properties
        };
    }
    
    deserializePlayerState(playerStateData) {
        return {
            position: this.deserializeVector3(playerStateData.position),
            rotation: playerStateData.rotation,
            linear_velocity: this.deserializeVector3(playerStateData.linear_velocity),
            angular_velocity: this.deserializeVector3(playerStateData.angular_velocity),
            physics_properties: playerStateData.physics_properties
        };
    }
    
    serializeVector3(vector) {
        if (!vector) return null;
        return { x: vector.x, y: vector.y, z: vector.z };
    }
    
    deserializeVector3(vectorData) {
        if (!vectorData) return new Vector3(0, 0, 0);
        return new Vector3(vectorData.x, vectorData.y, vectorData.z);
    }
    
    serializeParty(party) {
        // Extract only the necessary character data for saving
        const serializedParty = party.map(char => ({
            name: char.name,
            type: char.type,
            level: char.level,
            maxHp: char.maxHp,
            hp: char.hp,
            maxMp: char.maxMp,
            mp: char.mp,
            strength: char.strength,
            magic: char.magic,
            speed: char.speed,
            xp: char.xp,
            nextLevelXp: char.nextLevelXp,
            skills: char.skills,
            spells: char.spells,
            status: char.status,
            isDead: char.isDead,
            equipment: char.equipment
        }));
        
        // Add gold as a property to the serialized array
        serializedParty.gold = party.gold;
        
        return serializedParty;
    }
    
    deserializeParty(partyData, existingParty) {
        // Process all character data
        for (let i = 0; i < Math.min(partyData.length, existingParty.length); i++) {
            const charData = partyData[i];
            const character = existingParty[i];
            
            // Update character properties
            character.name = charData.name;
            character.type = charData.type;
            character.level = charData.level;
            character.maxHp = charData.maxHp;
            character.hp = charData.hp;
            character.maxMp = charData.maxMp;
            character.mp = charData.mp;
            character.strength = charData.strength;
            character.magic = charData.magic;
            character.speed = charData.speed;
            character.xp = charData.xp;
            character.nextLevelXp = charData.nextLevelXp;
            character.skills = charData.skills;
            character.spells = charData.spells;
            character.status = charData.status;
            character.isDead = charData.isDead;
            character.equipment = charData.equipment;
            
            // Recalculate derived stats
            character.calculateStats();
        }
        
        // Restore gold
        existingParty.gold = partyData.gold;
    }
    
    serializeInventory(inventory) {
        // Convert Map to array of [key, value] pairs
        return Array.from(inventory.items.entries());
    }
    
    deserializeInventory(inventoryData, existingInventory) {
        // Clear existing inventory
        existingInventory.items.clear();
        
        // Restore inventory items
        inventoryData.forEach(([itemId, quantity]) => {
            existingInventory.items.set(itemId, quantity);
        });
    }
}