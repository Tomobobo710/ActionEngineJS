// game/mode/rpgmenu/submenus/equipmentmenu.js
class EquipmentMenu extends BaseFullScreenMenu {
    constructor(ctx, input, gameMaster) {
        super(ctx, input, gameMaster);
        this.sprites = {};
        this.loadSprites();

        // Menu state
        this.state = "select_character"; // states: select_character, select_slot, select_equipment
        this.selectedCharIndex = 0;
        this.selectedSlotIndex = 0;
        this.selectedEquipmentIndex = 0;
        this.equipmentTypes = ["weapon", "armor", "helmet", "accessory"];
        this.equipmentTypeNames = ["Weapon", "Armor", "Helmet", "Accessory"];
        
        // Setup containers for different states
        this.createContainer("characterSelectContainer", {
            x: 0,
            y: 0,
            width: Game.WIDTH,
            height: Game.HEIGHT
        });
        
        this.createContainer("slotSelectContainer", {
            x: 0,
            y: 0,
            width: Game.WIDTH,
            height: Game.HEIGHT
        });
        
        this.createContainer("equipmentSelectContainer", {
            x: 0,
            y: 0,
            width: Game.WIDTH,
            height: Game.HEIGHT
        });
        
        // Set initial container visibility
        this.containers.get("characterSelectContainer").visible = true;
        this.containers.get("slotSelectContainer").visible = false;
        this.containers.get("equipmentSelectContainer").visible = false;
        
        // Reference to party data
        this.party = this.gameMaster.persistentParty;
        
        // Setup UI for initial state
        this.setupBasicUI();
        this.setupCharacterSelectUI();
        this.registerElements();
    }
    
    loadSprites() {
        ["warrior", "mage", "thief"].forEach((type) => {
            this.sprites[type] = Sprite.genHeroSprite(type);
        });
    }
    
    setupBasicUI() {
        // Common UI elements across all states
        
        // Title panel
        this.addElement("main", {
            name: "titlePanel",
            type: "panel",
            x: 40,
            y: 20,
            width: 720,
            height: 60,
            focusable: false,
            background: { visible: false },
            panel: { borderWidth: 2, drawBackground: true }
        });
        
        // Title text
        this.addElement("main", {
            name: "titleText",
            type: "textLabel",
            x: 50,
            y: 50,
            width: 400,
            height: 40,
            text: "Equipment",
            font: "32px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: false,
            background: { visible: false }
        });
        
        // Bottom info panel
        this.addElement("main", {
            name: "infoPanel",
            type: "panel",
            x: 40,
            y: 540,
            width: 720,
            height: 40,
            focusable: false,
            background: { visible: false },
            panel: { borderWidth: 2, drawBackground: true }
        });
        
        // Info text
        this.addElement("main", {
            name: "infoText",
            type: "textLabel",
            x: 50,
            y: 560,
            width: 700,
            height: 30,
            text: "Navigate with arrows. [A] to select. [B] to go back.",
            font: "18px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: false,
            background: { visible: false }
        });
    }
    
    setupCharacterSelectUI() {
        // First, clean up any existing elements in this container to prevent text overlap
        this.cleanupContainerElements("characterSelectContainer");
        
        // Character selection panel
        this.addElement("characterSelectContainer", {
            name: "characterPanel",
            type: "panel",
            x: 40,
            y: 100,
            width: 720,
            height: 420,
            focusable: false,
            background: { visible: false },
            panel: { borderWidth: 2, drawBackground: true }
        });
        
        // Instruction text
        this.addElement("characterSelectContainer", {
            name: "characterSelectInstruction",
            type: "textLabel",
            x: 400,
            y: 130,
            width: 400,
            height: 30,
            text: "Select a character to equip",
            font: "22px monospace",
            textAlign: "center",
            textBaseline: "middle",
            focusable: false,
            background: { visible: false }
        });
        
        // Add character portraits and names
        this.party.forEach((character, index) => {
            const yPos = 180 + index * 90;
            
            // Character portrait
            this.addElement("characterSelectContainer", {
                name: `charPortrait_${index}`,
                type: "imageButton",
                x: 100,
                y: yPos,
                width: 64,
                height: 64,
                focusable: true,
                selected: index === this.selectedCharIndex,
                xOrder: 0, // For keyboard navigation
                background: {
                    width: 80,
                    height: 80,
                    visible: true
                },
                image: {
                    sprite: this.sprites[character.type.toLowerCase()],
                    smoothing: false
                },
                button: {
                    onClick: () => this.selectCharacter(index)
                }
            });
            
            // Character name
            this.addElement("characterSelectContainer", {
                name: `charName_${index}`,
                type: "textLabel",
                x: 200,
                y: yPos + 32,
                width: 200,
                height: 30,
                text: character.name,
                font: "24px monospace",
                textAlign: "left",
                textBaseline: "middle",
                focusable: false,
                background: { visible: false }
            });
            
            // Basic stats display
            this.addElement("characterSelectContainer", {
                name: `charStats_${index}`,
                type: "textLabel",
                x: 400,
                y: yPos + 32,
                width: 300,
                height: 30,
                text: `ATK:${character.stats.atk} DEF:${character.stats.def} MAG:${character.stats.mag}`,
                font: "18px monospace",
                textAlign: "left",
                textBaseline: "middle",
                focusable: false,
                background: { visible: false }
            });
        });
    }
    
    setupSlotSelectUI() {
        const character = this.party[this.selectedCharIndex];
        
        // First, clean up any existing elements in this container to prevent text overlap
        this.cleanupContainerElements("slotSelectContainer");
        
        // Character info panel
        this.addElement("slotSelectContainer", {
            name: "slotCharacterPanel",
            type: "panel",
            x: 40,
            y: 100,
            width: 250,
            height: 420,
            focusable: false,
            background: { visible: false },
            panel: { borderWidth: 2, drawBackground: true }
        });
        
        // Equipment slots panel
        this.addElement("slotSelectContainer", {
            name: "equipmentSlotsPanel",
            type: "panel",
            x: 310,
            y: 100,
            width: 450,
            height: 420,
            focusable: false,
            background: { visible: false },
            panel: { borderWidth: 2, drawBackground: true }
        });
        
        // Character portrait
        this.addElement("slotSelectContainer", {
            name: "slotCharPortrait",
            type: "imageLabel",
            x: 70,
            y: 150,
            width: 64,
            height: 64,
            focusable: false,
            background: {
                width: 80,
                height: 80,
                visible: true
            },
            image: {
                sprite: this.sprites[character.type.toLowerCase()],
                smoothing: false
            }
        });
        
        // Character name
        this.addElement("slotSelectContainer", {
            name: "slotCharName",
            type: "textLabel",
            x: 165,
            y: 150,
            width: 200,
            height: 30,
            text: character.name,
            font: "22px monospace",
            textAlign: "center",
            textBaseline: "middle",
            focusable: false,
            background: { visible: false }
        });
        
        // Character stats display
        const stats = [
            { name: "ATK", value: character.stats.atk },
            { name: "DEF", value: character.stats.def },
            { name: "MAG", value: character.stats.mag },
            { name: "MDEF", value: character.stats.mdef }
        ];
        
        stats.forEach((stat, index) => {
            this.addElement("slotSelectContainer", {
                name: `slotCharStat_${index}`,
                type: "textLabel",
                x: 165,
                y: 200 + index * 40,
                width: 100,
                height: 30,
                text: `${stat.name}: ${stat.value}`,
                font: "20px monospace",
                textAlign: "center",
                textBaseline: "middle",
                focusable: false,
                background: { visible: false }
            });
        });
        
        // Instruction text
        this.addElement("slotSelectContainer", {
            name: "slotSelectInstruction",
            type: "textLabel",
            x: 535,
            y: 130,
            width: 400,
            height: 30,
            text: "Select equipment slot to change",
            font: "20px monospace",
            textAlign: "center",
            textBaseline: "middle",
            focusable: false,
            background: { visible: false }
        });
        
        // Add equipment slot buttons
        this.equipmentTypes.forEach((type, index) => {
            const yPos = 180 + index * 60;
            const equipped = character.equipment && character.equipment[type] ? character.equipment[type].name : "None";
            
            this.addElement("slotSelectContainer", {
                name: `equipSlot_${index}`,
                type: "selectable",
                x: 330,
                y: yPos,
                width: 410,
                height: 40,
                text: `${this.equipmentTypeNames[index]}: ${equipped}`,
                textOffsetX: 20,
                textOffsetY: 0,
                font: "22px monospace",
                textAlign: "left",
                textBaseline: "middle",
                focusable: true,
                selected: index === this.selectedSlotIndex,
                xOrder: 0,
                background: { visible: true },
                selectable: {
                    onClick: () => this.selectEquipmentSlot(index)
                }
            });
        });
    }
    
    setupEquipmentSelectUI() {
        const character = this.party[this.selectedCharIndex];
        const equipType = this.equipmentTypes[this.selectedSlotIndex];
        const typeName = this.equipmentTypeNames[this.selectedSlotIndex];
        
        // First, clean up any existing elements in this container to prevent text overlap
        this.cleanupContainerElements("equipmentSelectContainer");
        
        // Equipment selection panel
        this.addElement("equipmentSelectContainer", {
            name: "equipSelectPanel",
            type: "panel",
            x: 40,
            y: 100,
            width: 450,
            height: 420,
            focusable: false,
            background: { visible: false },
            panel: { borderWidth: 2, drawBackground: true }
        });
        
        // Stats comparison panel
        this.addElement("equipmentSelectContainer", {
            name: "statsComparisonPanel",
            type: "panel",
            x: 510,
            y: 100,
            width: 250,
            height: 420,
            focusable: false,
            background: { visible: false },
            panel: { borderWidth: 2, drawBackground: true }
        });
        
        // Instruction text
        this.addElement("equipmentSelectContainer", {
            name: "equipSelectInstruction",
            type: "textLabel",
            x: 265,
            y: 130,
            width: 400,
            height: 30,
            text: `Select ${typeName.toLowerCase()} to equip`,
            font: "20px monospace",
            textAlign: "center",
            textBaseline: "middle",
            focusable: false,
            background: { visible: false }
        });
        
        // Get available equipment of selected type
        const availableEquipment = this.getAvailableEquipment(equipType);
        
        // Add "Remove Equipment" option at the top
        this.addElement("equipmentSelectContainer", {
            name: "removeEquipmentOption",
            type: "selectable",
            x: 60,
            y: 180,
            width: 410,
            height: 40,
            text: "[Remove current equipment]",
            textOffsetX: 20,
            textOffsetY: 0,
            font: "22px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: true,
            selected: this.selectedEquipmentIndex === 0,
            xOrder: 0,
            background: { visible: true },
            selectable: {
                onClick: () => this.equipItem(null)
            }
        });
        
        // Add equipment items
        availableEquipment.forEach((item, index) => {
            const yPos = 230 + index * 50;
            const actualIndex = index + 1; // +1 because of the remove option
            
            // If item is equipped by another character, mark it
            let itemText = item.emoji ? `${item.emoji} ${item.name}` : item.name;
            if (item._equippedBy) {
                itemText += ` (${item._equippedBy})`;
            }
            
            this.addElement("equipmentSelectContainer", {
                name: `equipItem_${index}`,
                type: "selectable",
                x: 60,
                y: yPos,
                width: 410,
                height: 40,
                text: itemText,
                textOffsetX: 20,
                textOffsetY: 0,
                font: "22px monospace",
                textAlign: "left",
                textBaseline: "middle",
                focusable: true,
                selected: this.selectedEquipmentIndex === actualIndex,
                xOrder: 0,
                background: { visible: true },
                selectable: {
                    onClick: () => this.equipItem(item)
                }
            });
        });
        
        // Add stats comparison section
        this.addElement("equipmentSelectContainer", {
            name: "comparisonTitle",
            type: "textLabel",
            x: 635,
            y: 130,
            width: 200,
            height: 30,
            text: "Stats Comparison",
            font: "20px monospace",
            textAlign: "center",
            textBaseline: "middle",
            focusable: false,
            background: { visible: false }
        });
        
        // Character name
        this.addElement("equipmentSelectContainer", {
            name: "comparisonCharName",
            type: "textLabel",
            x: 635,
            y: 170,
            width: 200,
            height: 30,
            text: character.name,
            font: "18px monospace",
            textAlign: "center",
            textBaseline: "middle",
            focusable: false,
            background: { visible: false }
        });
        
        // Current stats
        this.addElement("equipmentSelectContainer", {
            name: "currentStatsLabel",
            type: "textLabel",
            x: 550,
            y: 220,
            width: 200,
            height: 30,
            text: "Current",
            font: "18px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: false,
            background: { visible: false }
        });
        
        // New stats heading (updated when selecting items)
        this.addElement("equipmentSelectContainer", {
            name: "newStatsLabel",
            type: "textLabel",
            x: 670,
            y: 220,
            width: 200,
            height: 30,
            text: "New",
            font: "18px monospace",
            textAlign: "left",
            textBaseline: "middle",
            focusable: false,
            background: { visible: false }
        });
        
        // Get current character stats
        const currentStats = {
            atk: character.stats.atk,
            def: character.stats.def,
            mag: character.stats.mag,
            mdef: character.stats.mdef
        };
        
        // Calculate potential new stats with currently selected equipment
        const newStats = this.calculateNewStats(character, equipType, 
            availableEquipment[this.selectedEquipmentIndex - 1] || null);
        
        // Display stats for comparison
        const statNames = ["ATK", "DEF", "MAG", "MDEF"];
        const statKeys = ["atk", "def", "mag", "mdef"];
        
        statNames.forEach((statName, index) => {
            const key = statKeys[index];
            const currentValue = currentStats[key];
            const newValue = newStats[key];
            const yPos = 260 + index * 40;
            
            // Stat name
            this.addElement("equipmentSelectContainer", {
                name: `statName_${index}`,
                type: "textLabel",
                x: 550,
                y: yPos,
                width: 80,
                height: 30,
                text: statName,
                font: "18px monospace",
                textAlign: "left",
                textBaseline: "middle",
                focusable: false,
                background: { visible: false }
            });
            
            // Current value
            this.addElement("equipmentSelectContainer", {
                name: `currentValue_${index}`,
                type: "textLabel",
                x: 600,
                y: yPos,
                width: 60,
                height: 30,
                text: `${currentValue}`,
                font: "18px monospace",
                textAlign: "center",
                textBaseline: "middle",
                focusable: false,
                background: { visible: false }
            });
            
            // New value (with color indicating change)
            const change = newValue - currentValue;
            let textColor = this.colors.normalText;
            if (change > 0) textColor = "#00ff00"; // Green for increase
            if (change < 0) textColor = "#ff0000"; // Red for decrease
            
            this.addElement("equipmentSelectContainer", {
                name: `newValue_${index}`,
                type: "textLabel",
                x: 680,
                y: yPos,
                width: 80,
                height: 30,
                text: change === 0 ? `${newValue}` : change > 0 ? `${newValue} (+${change})` : `${newValue} (${change})`,
                font: "18px monospace",
                textAlign: "left",
                textBaseline: "middle",
                focusable: false,
                background: { visible: false },
                color: textColor
            });
        });
    }
    
    getAvailableEquipment(type) {
        // Get equipment only from inventory - don't show items equipped by other characters
        const inventoryItems = this.gameMaster.equipmentInventory.getItemsByType(type);
        
        // Return only inventory items
        return inventoryItems;
    }
    
    calculateNewStats(character, equipType, newEquipment) {
        // Create a copy of the character to simulate equipment change
        const charCopy = JSON.parse(JSON.stringify(character));
        
        // Create a copy of the current equipment setup
        if (!charCopy.equipment) {
            charCopy.equipment = {};
        }
        
        // Remove current equipment of this type
        charCopy.equipment[equipType] = null;
        
        // Add new equipment if provided
        if (newEquipment) {
            charCopy.equipment[equipType] = newEquipment;
        }
        
        // Calculate base stats
        const newStats = {
            atk: charCopy.strength,
            def: Math.floor(charCopy.strength / 2),
            mag: charCopy.magic,
            mdef: Math.floor(charCopy.magic / 2)
        };
        
        // Add equipment bonuses
        if (charCopy.equipment) {
            // Process each equipment type
            ['weapon', 'armor', 'helmet', 'accessory'].forEach(slotType => {
                const equip = charCopy.equipment[slotType];
                if (equip && equip.stats) {
                    // Add each stat bonus from the equipment
                    Object.keys(equip.stats).forEach(statName => {
                        if (newStats[statName] !== undefined) {
                            newStats[statName] += equip.stats[statName];
                        }
                    });
                }
            });
        }
        
        return newStats;
    }
    
    selectCharacter(index) {
        this.selectedCharIndex = index;
        this.switchToState("select_slot");
    }
    
    selectEquipmentSlot(index) {
        this.selectedSlotIndex = index;
        this.selectedEquipmentIndex = 0; // Reset equipment selection to first item (remove)
        this.switchToState("select_equipment");
    }
    
    equipItem(item) {
        const character = this.party[this.selectedCharIndex];
        const equipType = this.equipmentTypes[this.selectedSlotIndex];
        
        // Unequip current item if any
        if (character.equipment && character.equipment[equipType]) {
            const currentItem = character.equipment[equipType];
            this.gameMaster.equipmentInventory.addItem(currentItem);
        }
        
        // Equip the new item if provided (null means remove only)
        if (item) {
            if (!character.equipment) {
                character.equipment = {};
            }
            
            character.equipment[equipType] = item;
            this.gameMaster.equipmentInventory.removeItem(item);
        } else {
            if (character.equipment) {
                character.equipment[equipType] = null;
            }
        }
        
        // Recalculate character stats
        character.calculateStats();
        
        // Go back to slot selection
        this.switchToState("select_slot");
    }
    
    switchToState(newState) {
        // Hide all containers first
        this.containers.get("characterSelectContainer").visible = false;
        this.containers.get("slotSelectContainer").visible = false;
        this.containers.get("equipmentSelectContainer").visible = false;
        
        // Update state and show appropriate container
        this.state = newState;
        
        // Reset current focus
        this.currentFocus = null;
        
        if (newState === "select_character") {
            // Clear any leftovers from other states and re-create
            this.cleanupContainerElements("characterSelectContainer");
            this.setupCharacterSelectUI();
            this.containers.get("characterSelectContainer").visible = true;
        } 
        else if (newState === "select_slot") {
            // Clear any leftovers from other states and re-create
            this.cleanupContainerElements("slotSelectContainer");
            this.setupSlotSelectUI();
            this.containers.get("slotSelectContainer").visible = true;
        }
        else if (newState === "select_equipment") {
            // Clear any leftovers from other states and re-create
            this.cleanupContainerElements("equipmentSelectContainer");
            this.setupEquipmentSelectUI();
            this.containers.get("equipmentSelectContainer").visible = true;
        }
        
        // Initialize focus for the new state
        this.initializeFocus();
        
        // Re-register all elements in case they were cleared
        this.registerElements();
    }
    
    handleDirectionalInput(direction) {
        // Initialize focus if null
        if (!this.currentFocus) {
            this.initializeFocus();
            return;
        }
        
        if (this.state === "select_character") {
            if (direction === "up" && this.selectedCharIndex > 0) {
                if (this.currentFocus) this.currentFocus.selected = false;
                this.selectedCharIndex--;
                const portraitElement = this.elements.get(`charPortrait_${this.selectedCharIndex}`);
                if (portraitElement) {
                    this.currentFocus = portraitElement;
                    this.currentFocus.selected = true;
                }
            }
            else if (direction === "down" && this.selectedCharIndex < this.party.length - 1) {
                if (this.currentFocus) this.currentFocus.selected = false;
                this.selectedCharIndex++;
                const portraitElement = this.elements.get(`charPortrait_${this.selectedCharIndex}`);
                if (portraitElement) {
                    this.currentFocus = portraitElement;
                    this.currentFocus.selected = true;
                }
            }
        }
        else if (this.state === "select_slot") {
            if (direction === "up" && this.selectedSlotIndex > 0) {
                if (this.currentFocus) this.currentFocus.selected = false;
                this.selectedSlotIndex--;
                const slotElement = this.elements.get(`equipSlot_${this.selectedSlotIndex}`);
                if (slotElement) {
                    this.currentFocus = slotElement;
                    this.currentFocus.selected = true;
                }
            }
            else if (direction === "down" && this.selectedSlotIndex < this.equipmentTypes.length - 1) {
                if (this.currentFocus) this.currentFocus.selected = false;
                this.selectedSlotIndex++;
                const slotElement = this.elements.get(`equipSlot_${this.selectedSlotIndex}`);
                if (slotElement) {
                    this.currentFocus = slotElement;
                    this.currentFocus.selected = true;
                }
            }
        }
        else if (this.state === "select_equipment") {
            const equipType = this.equipmentTypes[this.selectedSlotIndex];
            const availableEquipment = this.getAvailableEquipment(equipType);
            const maxIndex = availableEquipment.length; // +1 for remove option
            
            if (direction === "up" && this.selectedEquipmentIndex > 0) {
                if (this.currentFocus) this.currentFocus.selected = false;
                this.selectedEquipmentIndex--;
                
                // Handle focus for remove option or equipment items
                if (this.selectedEquipmentIndex === 0) {
                    const removeElement = this.elements.get("removeEquipmentOption");
                    if (removeElement) {
                        this.currentFocus = removeElement;
                        this.currentFocus.selected = true;
                    }
                } else {
                    const itemElement = this.elements.get(`equipItem_${this.selectedEquipmentIndex - 1}`);
                    if (itemElement) {
                        this.currentFocus = itemElement;
                        this.currentFocus.selected = true;
                    }
                }
                
                // Update stats comparison
                this.setupEquipmentSelectUI();
            }
            else if (direction === "down" && this.selectedEquipmentIndex < maxIndex) {
                if (this.currentFocus) this.currentFocus.selected = false;
                this.selectedEquipmentIndex++;
                
                if (this.selectedEquipmentIndex <= maxIndex) {
                    const elementName = this.selectedEquipmentIndex === 0 ? 
                        "removeEquipmentOption" : `equipItem_${this.selectedEquipmentIndex - 1}`;
                    const element = this.elements.get(elementName);
                    if (element) {
                        this.currentFocus = element;
                        this.currentFocus.selected = true;
                    }
                }
                
                // Update stats comparison
                this.setupEquipmentSelectUI();
            }
        }
    }
    
    handleAction1() {
        // Handle confirm button
        if (this.currentFocus) {
            if (this.currentFocus.type === "imageButton" && this.currentFocus.button.onClick) {
                this.currentFocus.button.onClick();
                return;
            }
            else if (this.currentFocus.type === "selectable" && this.currentFocus.selectable.onClick) {
                this.currentFocus.selectable.onClick();
                return;
            }
        }
        
        // If no specific element is focused, use the current state and selections
        if (this.state === "select_character") {
            this.selectCharacter(this.selectedCharIndex);
        }
        else if (this.state === "select_slot") {
            this.selectEquipmentSlot(this.selectedSlotIndex);
        }
    }
    
    handleAction2() {
        // Handle back button
        if (this.state === "select_slot") {
            this.switchToState("select_character");
            return null;
        }
        else if (this.state === "select_equipment") {
            this.switchToState("select_slot");
            return null;
        }
        else {
            return "exit";
        }
    }
    
    update() {
        // Check if we need to initialize focus
        if (!this.currentFocus) {
            this.initializeFocus();
        }
        
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
        
        // Handle confirm/cancel buttons
        if (this.input.isKeyJustPressed("Action1")) {
            this.handleAction1();
            return null;
        }
        if (this.input.isKeyJustPressed("Action2")) {
            return this.handleAction2();
        }
        
        // Let parent class handle mouse interactions
        return super.update();
    }
    
    draw() {
        // Clear the entire canvas first to avoid any text overlay issues
        this.ctx.clearRect(0, 0, Game.WIDTH, Game.HEIGHT);
        
        // Draw the equipment menu using base class drawing
        super.draw();
        
        // Custom drawing logic if needed
        if (this.state === "select_equipment") {
            // Draw additional equipment info
            const equipType = this.equipmentTypes[this.selectedSlotIndex];
            const availableEquipment = this.getAvailableEquipment(equipType);
            const selectedEquipment = this.selectedEquipmentIndex === 0 ? 
                null : availableEquipment[this.selectedEquipmentIndex - 1];
            
            if (selectedEquipment) {
                // Draw equipment description
                this.ctx.fillStyle = this.colors.normalText;
                this.ctx.font = "16px monospace";
                this.ctx.textAlign = "center";
                this.ctx.fillText(
                    selectedEquipment.description || "",
                    265, // center of equipment panel
                    500  // bottom of panel
                );
            }
        }
    }
    
    registerElements() {
        // Register all elements with input handler
        super.registerElements();
        
        // Initialize focus after registering elements
        this.initializeFocus();
    }
    
    initializeFocus() {
        // Set initial focus based on current state
        if (this.state === "select_character") {
            const portraitElement = this.elements.get(`charPortrait_${this.selectedCharIndex}`);
            if (portraitElement) {
                this.currentFocus = portraitElement;
                this.currentFocus.selected = true;
            }
        }
        else if (this.state === "select_slot") {
            const slotElement = this.elements.get(`equipSlot_${this.selectedSlotIndex}`);
            if (slotElement) {
                this.currentFocus = slotElement;
                this.currentFocus.selected = true;
            }
        }
        else if (this.state === "select_equipment") {
            if (this.selectedEquipmentIndex === 0) {
                const removeElement = this.elements.get("removeEquipmentOption");
                if (removeElement) {
                    this.currentFocus = removeElement;
                    this.currentFocus.selected = true;
                }
            } else {
                const itemElement = this.elements.get(`equipItem_${this.selectedEquipmentIndex - 1}`);
                if (itemElement) {
                    this.currentFocus = itemElement;
                    this.currentFocus.selected = true;
                }
            }
        }
    }
    
    cleanupContainerElements(containerName) {
        // Get the container
        const container = this.containers.get(containerName);
        if (!container) return;
        
        // Get all elements in this container
        const elementsToRemove = [];
        
        // First collect all elements that belong to this container
        this.elements.forEach((element, name) => {
            if (container.elements.includes(element)) {
                elementsToRemove.push(name);
                
                // Remove from input handler if focusable
                if (element.focusable) {
                    this.input.removeElement(`menu_element_${name}`);
                }
                
                // If it's a slider, also remove slider track
                if (element.type === "slider") {
                    this.input.removeElement(`menu_element_${name}_slider`);
                }
            }
        });
        
        // Then remove them from the elements map
        elementsToRemove.forEach(name => {
            this.elements.delete(name);
        });
        
        // Clear the container's elements array
        container.elements = [];
    }
    
    cleanup() {
        // Clean up all registered elements
        super.cleanup();
    }
}