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
            x: 102, // Moved left 8px (from 110)
            y: Game.HEIGHT - 170, // Moved up 5px (from -165)
            width: 200,
            height: 30
        });
        this.input.registerElement("cancel_button", { bounds: cancelBoundsFn });
        this.uiElements.set("cancel_button", cancelBoundsFn);

        // Main menu - centered coordinates
        const menuItems = ["Fight", "Magic", "Item", "Run"];
        menuItems.forEach((item, i) => {
            const boundsFn = () => ({
                x: 60, // 10 + 100/2 (left + width/2)
                y: Game.HEIGHT - 140 + i * 35 + 15, // y + height/2
                width: 100,
                height: 30
            });
            this.input.registerElement(`menu_${item.toLowerCase()}`, { bounds: boundsFn });
            this.uiElements.set(`menu_${item.toLowerCase()}`, boundsFn);
        });

        // Submenu slots (for magic/items) - centered coordinates
        const menuItemHeight = 35;
        const menuStartY = Game.HEIGHT - 140;
        const maxMenuItems = Math.floor(140 / menuItemHeight);

        for (let i = 0; i < maxMenuItems; i++) {
            const boundsFn = () => ({
                x: 195, // 120 + 150/2 (left + width/2)
                y: menuStartY + i * menuItemHeight + 15, // y + height/2
                width: 150,
                height: 30
            });
            this.input.registerElement(`submenu_slot_${i}`, { bounds: boundsFn });
            this.uiElements.set(`submenu_slot_${i}`, boundsFn);
        }

        // Second column of spell slots
        for (let i = 0; i < maxMenuItems; i++) {
            const boundsFn = () => ({
                x: 355, // Update this to match the visual spacing from drawBattleMenu
                y: menuStartY + i * menuItemHeight + 15,
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

        // Up arrow - centered coordinates
        const upArrowBoundsFn = () => ({
            x: arrowX, // Center point
            y: Game.HEIGHT - 120, // Centered at top of menu
            width: arrowWidth,
            height: arrowHeight
        });
        this.input.registerElement("spell_scroll_up", { bounds: upArrowBoundsFn });
        this.uiElements.set("spell_scroll_up", upArrowBoundsFn);

        // Down arrow - centered coordinates
        const downArrowBoundsFn = () => ({
            x: arrowX, // Center point
            y: Game.HEIGHT - 25, // Centered near bottom of menu
            width: arrowWidth,
            height: arrowHeight
        });
        this.input.registerElement("spell_scroll_down", { bounds: downArrowBoundsFn });
        this.uiElements.set("spell_scroll_down", downArrowBoundsFn);

        // Enemies - all possible positions (typically up to 4)
        for (let i = 0; i < 4; i++) {
            const boundsFn = () => ({
                x: 200, // Base enemy X position
                y: 150 + i * 80, // Spread vertically like in setupInitialPositions
                width: 48,
                height: 48
            });
            this.input.registerElement(`enemy_${i}`, { bounds: boundsFn });
            this.uiElements.set(`enemy_${i}`, boundsFn);
        }

        // Party members - all possible positions
        for (let i = 0; i < 4; i++) {
            const boundsFn = () => ({
                x: 600, // Base party X position
                y: 150 + i * 100, // Spread vertically like in setupInitialPositions
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
            // Offset the drawing position by half width/height
            ctx.strokeRect(bounds.x - bounds.width / 2, bounds.y - bounds.height / 2, bounds.width, bounds.height);

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

        // Clear references
        this.canvas = null;
        this.ctx = null;
        this.input = null;
        this.audio = null;
        this.persistentParty = null;
        this.partyInventory = null;
    }
}