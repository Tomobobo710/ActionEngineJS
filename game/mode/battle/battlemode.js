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

        // Create default party data
        this.defaultParty = [
            {
                name: "Cecil",
                type: "warrior",
                level: 10,
                maxHp: 150,
                maxMp: 30,
                strength: 15,
                magic: 8,
                speed: 12,
                skills: ["Attack", "Defend"],
                spells: ["fire"]
            },
            {
                name: "Rosa",
                type: "mage",
                level: 10,
                maxHp: 90,
                maxMp: 80,
                strength: 6,
                magic: 18,
                speed: 10,
                skills: ["Attack"],
                spells: ["fire", "ice", "lightning", "poison", "heal", "quake", "wind", "water", "holy"]
            },
            {
                name: "Edge",
                type: "thief",
                level: 10,
                maxHp: 110,
                maxMp: 45,
                strength: 13,
                magic: 10,
                speed: 16,
                skills: ["Attack", "Steal"],
                spells: ["lightning", "poison"]
            }
        ];

        this.enemyTemplates = {
            slime: {
                type: "slime",
                maxHp: 30,
                maxMp: 20,
                strength: 8,
                magic: 5,
                speed: 12,
                spells: ["poison"]
            },
            bat: {
                type: "bat",
                maxHp: 45,
                maxMp: 35,
                strength: 12,
                magic: 8,
                speed: 14,
                spells: ["wind"]
            },
            goblin: {
                type: "goblin",
                maxHp: 65,
                maxMp: 25,
                strength: 14,
                magic: 6,
                speed: 16,
                spells: ["fire"]
            }
        };

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
        this.persistentParty.inventory.addItem("potion", 5);
        this.persistentParty.inventory.addItem("megaPotion", 2);
        this.persistentParty.inventory.addItem("poison", 3);
        this.persistentParty.inventory.addItem("bomb", 2);

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
        // Cancel button - positioned above menu, with wider area
        const cancelBoundsFn = () => ({
            x: 2,  // 102 - 100 (old center - half width)
            y: Game.HEIGHT - 185, // old y - half height
            width: 200,
            height: 30
        });
        this.input.registerElement("cancel_button", { bounds: cancelBoundsFn });
        this.uiElements.set("cancel_button", cancelBoundsFn);

        // Main menu - centered coordinates
        const menuItems = ["Fight", "Magic", "Item", "Run"];
        menuItems.forEach((item, i) => {
            const boundsFn = () => ({
                x: 10,  // 60 - 50 (center - half width)
                y: Game.HEIGHT - 140 + i * 35, // removed the +15
                width: 100,
                height: 30
            });
            this.input.registerElement(`menu_${item.toLowerCase()}`, { bounds: boundsFn });
            this.uiElements.set(`menu_${item.toLowerCase()}`, boundsFn);  // This is essential!
        });

        // Submenu slots (for magic/items) - centered coordinates
        const menuItemHeight = 35;
        const menuStartY = Game.HEIGHT - 140;
        const maxMenuItems = Math.floor(140 / menuItemHeight);

        // First column registration
for (let i = 0; i < maxMenuItems; i++) {
    const boundsFn = () => ({
        x: 120, // 195 - 75 (old center - half width)
        y: menuStartY + i * menuItemHeight, // removed the +15 center offset
        width: 150,
        height: 30
    });
    this.input.registerElement(`submenu_slot_${i}`, { bounds: boundsFn });
    this.uiElements.set(`submenu_slot_${i}`, boundsFn);
}

// Second column registration
for (let i = 0; i < maxMenuItems; i++) {
    const boundsFn = () => ({
        x: 280, // 355 - 75 (old center - half width)
        y: menuStartY + i * menuItemHeight, // removed the +15 center offset
        width: 150,
        height: 30
    });
    this.input.registerElement(`submenu_slot_${i + maxMenuItems}`, { bounds: boundsFn });
    this.uiElements.set(`submenu_slot_${i + maxMenuItems}`, boundsFn);
}

        // Add scroll arrows to uiElements
        const arrowX = 455; // Consistent X position
        const arrowWidth = 30;
        const arrowHeight = 20;

        // Up arrow registration
const upArrowBoundsFn = () => ({
    x: 440, // 455 - 15 (old center - half width)
    y: Game.HEIGHT - 130, // old y - 10 (half height)
    width: arrowWidth,
    height: arrowHeight
});
this.input.registerElement("spell_scroll_up", { bounds: upArrowBoundsFn });
this.uiElements.set("spell_scroll_up", upArrowBoundsFn);

// Down arrow registration
const downArrowBoundsFn = () => ({
    x: 440, // 455 - 15 (old center - half width)
    y: Game.HEIGHT - 35, // old y - 10 (half height)
    width: arrowWidth,
    height: arrowHeight
});
this.input.registerElement("spell_scroll_down", { bounds: downArrowBoundsFn });
this.uiElements.set("spell_scroll_down", downArrowBoundsFn);

        // Enemy registration
for (let i = 0; i < 4; i++) {
    const boundsFn = () => ({
        x: 176, // 200 - 24 (old center - half width)
        y: 126 + i * 80, // 150 - 24 + i * 80 (old center - half height)
        width: 48,
        height: 48
    });
    this.input.registerElement(`enemy_${i}`, { bounds: boundsFn });
    this.uiElements.set(`enemy_${i}`, boundsFn);
}

// Party registration
for (let i = 0; i < 4; i++) {
    const boundsFn = () => ({
        x: 584, // 600 - 16 (old center - half width)
        y: 134 + i * 100, // 150 - 16 + i * 100 (old center - half height)
        width: 32,
        height: 32
    });
    this.input.registerElement(`char_${i}`, { bounds: boundsFn });
    this.uiElements.set(`char_${i}`, boundsFn);
}
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

            if (this.battle.state === "victory" && this.battle.transitionProgress >= 1) {
                setTimeout(() => {
                    this.persistentParty = this.battle.party;
                    this.startNewBattle();
                }, 1000);
            }
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
            // TODO: Add proper battle cleanup
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