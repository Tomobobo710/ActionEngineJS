// game/mode/battle/battlemode.js
class BattleMode {
    constructor(canvases, input, audio) {
    this.debugMode = false;
    this.uiElements = new Map();
    // We'll use the GUI canvas for everything
    this.canvas = canvases.guiCanvas;
    this.ctx = this.canvas.getContext("2d");
    this.input = input;
    this.audio = audio;

    // Initialize core systems
    this.state = "battle";
    this.sprites = {};
    this.backgrounds = {};
    this.loadSprites();

    this.defaultParty = DEFAULT_PARTY;
    this.enemyTemplates = ENEMY_TEMPLATES;
    this.partyInventory = new Inventory();

    // Create party with default inventory
    this.persistentParty = this.defaultParty.map((char) => ({
        ...char,
        sprite: this.sprites[char.type]
    }));

    Object.defineProperty(this.persistentParty, "inventory", {
        value: this.partyInventory,
        enumerable: false
    });

    // Add starter items
    STARTER_INVENTORY.forEach(({ item, quantity }) => {
        this.persistentParty.inventory.addItem(item, quantity);
    });

    // Start initial battle
    this.startNewBattle();
    // Register UI elements
    this.registerUIElements();
}

    loadSprites() {
        // Load hero sprites
        ["warrior", "mage", "thief"].forEach((type) => {
            this.sprites[type] = Sprite.genHeroSprite(type);
        });

        // Load enemy sprites
        ["slime", "bat", "goblin"].forEach((type) => {
            this.sprites[type] = Sprite.genEnemySprite(type);
        });

        // Load backgrounds
        ["cave"].forEach((type) => {
            this.backgrounds[type] = Sprite.genBackground(type);
        });
    }

    generateEnemyParty() {
        const count = Math.floor(Math.random() * 4) + 1;
        const enemies = [];
        const types = Object.keys(this.enemyTemplates);

        for (let i = 0; i < count; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const template = this.enemyTemplates[type];
            enemies.push({
                name: type.charAt(0).toUpperCase() + type.slice(1),
                ...template,
                sprite: this.sprites[type]
            });
        }

        return enemies;
    }

    startNewBattle() {
        // Add sprites to party data
        const party = this.defaultParty.map((char) => ({
            ...char,
            sprite: this.sprites[char.type]
        }));

        const enemies = this.generateEnemyParty();
        this.battle = new BattleSystem(this.persistentParty, enemies, this.audio, this.input, this.partyInventory);
    }

    registerUIElements() {
    // Helper function to register UI elements
    const registerBoundsGroup = (config) => {
        const { count, startX, startY, width, height, spacing, prefix, itemNames } = config;
        const createBoundsFunction = function(index) {
            return function() {
                return {
                    x: startX,
                    y: startY + index * spacing,
                    width: width,
                    height: height
                };
            };
        };

        for (let i = 0; i < count; i++) {
            const boundsFn = createBoundsFunction(i);
            // If itemNames is provided, use those for the IDs
            const elementId = itemNames ? 
                `${prefix}${itemNames[i].toLowerCase()}` : 
                `${prefix}${i}`;
            this.input.registerElement(elementId, { bounds: boundsFn });
            this.uiElements.set(elementId, boundsFn);
        }
    };

    // Register cancel button
    const createCancelBounds = function() {
        return function() {
            return {
                x: 2,
                y: Game.HEIGHT - 185,
                width: 200,
                height: 30
            };
        };
    };
    const cancelBoundsFn = createCancelBounds();
    this.input.registerElement("cancel_button", { bounds: cancelBoundsFn });
    this.uiElements.set("cancel_button", cancelBoundsFn);

    // Register main menu items
    const menuItems = ["Fight", "Magic", "Item", "Run"];
    registerBoundsGroup({
        count: menuItems.length,
        startX: 10,
        startY: Game.HEIGHT - 140,
        width: 100,
        height: 30,
        spacing: 35,
        prefix: "menu_",
        itemNames: menuItems  // Pass the menu item names
    });

    // Rest of the registration remains the same since they use numeric indices
    const maxMenuItems = Math.floor(140 / 35);
    registerBoundsGroup({
        count: maxMenuItems,
        startX: 120,
        startY: Game.HEIGHT - 140,
        width: 150,
        height: 30,
        spacing: 35,
        prefix: "submenu_slot_"
    });

    registerBoundsGroup({
        count: maxMenuItems,
        startX: 280,
        startY: Game.HEIGHT - 140,
        width: 150,
        height: 30,
        spacing: 35,
        prefix: `submenu_slot_${maxMenuItems}`
    });

    registerBoundsGroup({
        count: 4,
        startX: 176,
        startY: 126,
        width: 48,
        height: 48,
        spacing: 80,
        prefix: "enemy_"
    });

    registerBoundsGroup({
        count: 4,
        startX: 584,
        startY: 134,
        width: 32,
        height: 32,
        spacing: 100,
        prefix: "char_"
    });

    // Register scroll arrows
    const arrowWidth = 30;
    const arrowHeight = 20;
    const createArrowBounds = function(y) {
        return function() {
            return {
                x: 440,
                y: y,
                width: arrowWidth,
                height: arrowHeight
            };
        };
    };

    const arrowConfigs = [
        { id: "spell_scroll_up", y: Game.HEIGHT - 130 },
        { id: "spell_scroll_down", y: Game.HEIGHT - 35 }
    ];

    arrowConfigs.forEach(config => {
        const arrowBoundsFn = createArrowBounds(config.y);
        this.input.registerElement(config.id, { bounds: arrowBoundsFn });
        this.uiElements.set(config.id, arrowBoundsFn);
    });
}
    drawDebugHitboxes() {
        const ctx = this.ctx;

        this.uiElements.forEach((boundsFn, id) => {
            const bounds = boundsFn();

            // Different colors for different types of elements
            switch (true) {
                case id.startsWith("menu_"):
                    ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
                    break;
                case id.startsWith("char_"):
                    ctx.strokeStyle = "rgba(0, 255, 0, 0.8)";
                    break;
                case id.startsWith("enemy_"):
                    ctx.strokeStyle = "rgba(0, 0, 255, 0.8)";
                    break;
                case id.startsWith("submenu_"):
                    ctx.strokeStyle = "rgba(255, 255, 0, 0.8)";
                    break;
                default:
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
            }

            ctx.lineWidth = 2;

            ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

            ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            ctx.font = "12px monospace";
            ctx.textAlign = "left";
            ctx.fillText(
                `${id} (${bounds.x},${bounds.y},${bounds.width},${bounds.height})`,
                bounds.x - bounds.width / 2,
                bounds.y - bounds.height / 2 - 2
            );
        });
    }

    toggleDebug() {
        this.debugMode = !this.debugMode;
    }

    update(deltaTime) {
        if (this.input.isKeyJustPressed("Action3")) {
            this.toggleDebug();
        }
        this.battle.update(this.input);
        if (!this.battle.isPaused) {
            this.battle.handleInput(this.input);            
        }
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, 800, 600);

        // Draw current background
        this.ctx.drawImage(this.backgrounds.cave, 0, 0);

        // Draw battle scene
        this.battle.render(this.ctx);

        // Draw pause overlay if paused
        if (this.battle.isPaused) {
            this.ctx.fillStyle = "rgba(0,0,0,0.5)";
            this.ctx.fillRect(0, 0, 800, 600);

            this.ctx.fillStyle = "#fff";
            this.ctx.font = "48px monospace";
            this.ctx.textAlign = "center";
            this.ctx.fillText("PAUSED", 400, 300);
        }

        if (this.debugMode) {
            this.drawDebugHitboxes();

            this.ctx.fillStyle = "rgba(0, 0, 102, 0.95)";
            this.ctx.fillRect(10, 10, 500, 120);
            this.ctx.strokeStyle = "#ffffff";
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(10, 10, 500, 120);

            this.ctx.font = "14px monospace";
            this.ctx.textAlign = "left";

            this.battle.battleLog.messages.forEach((msg, i) => {
                switch (msg.type) {
                    case "damage":
                        this.ctx.fillStyle = "#ff8888";
                        break;
                    case "heal":
                        this.ctx.fillStyle = "#88ff88";
                        break;
                    case "critical":
                        this.ctx.fillStyle = "#ffff88";
                        break;
                    default:
                        this.ctx.fillStyle = "#ffffff";
                }

                this.ctx.fillText(msg.text, 20, 35 + i * 20);
            });
        }
    }

    pause() {
        if (this.battle) {
            this.battle.isPaused = true;
        }
    }

    resume() {
        if (this.battle) {
            this.battle.isPaused = false;
        }
    }

    cleanup() {
        // Clear battle system
        if (this.battle) {
            if (this.battle.state === "victory") {
                this.persistentParty = this.battle.party;
            }
            this.battle = null;
        }

        // Clear UI elements
        this.uiElements.clear();

        // Clear sprites and backgrounds
        this.sprites = {};
        this.backgrounds = {};

        // Clear canvas
        if (this.ctx) {
            this.ctx.clearRect(0, 0, 800, 600);
        }

        this.input.clearAllElements();

        // Clear references
        this.canvas = null;
        this.ctx = null;
        this.input = null;
        this.audio = null;
        this.persistentParty = null;
        this.partyInventory = null;
    }
}