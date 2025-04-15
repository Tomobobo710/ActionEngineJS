// game/mode/battle/battlemode.js
class BattleMode {
    constructor(canvases, input, audio, gameMaster) {
        this.debugMode = false;
        this.uiElements = new Map();
        // We'll use the GUI canvas for everything
        this.canvas = canvases.guiCanvas;
        this.ctx = this.canvas.getContext("2d");
        this.input = input;
        this.audio = audio;
        this.gameMaster = gameMaster;
        // Initialize core systems
        this.state = "battle";
        this.sprites = {};
        this.backgrounds = {};
        this.loadSprites();

        this.defaultParty = DEFAULT_PARTY;
        this.enemyTemplates = ENEMY_TEMPLATES;

        this.persistentParty = this.gameMaster.persistentParty;
        
        // Update the sprites for the party members and maintain status effects
        this.persistentParty.forEach((char) => {
            char.sprite = this.sprites[char.type];
        });

        this.partyInventory = this.gameMaster.partyInventory;

        this.createSoundEffects();
        
        // Start initial battle
        this.startNewBattle();
        // Register UI elements
        this.registerUIElements();

        this.colors = gameMaster.persistentParty.colors; // prob want to move this out one day
    }
    createSoundEffects() {
        // Menus and UI
        this.audio.createComplexSound("menu_move", {
            frequencies: [880, 1100],
            types: ["square", "sine"],
            mix: [0.7, 0.3],
            duration: 0.05,
            envelope: {
                attack: 0.01,
                decay: 0.02,
                sustain: 0.3,
                release: 0.02
            }
        });

        this.audio.createComplexSound("menu_select", {
            frequencies: [440, 880, 1320],
            types: ["square", "sine", "triangle"],
            mix: [0.4, 0.3, 0.3],
            duration: 0.1,
            envelope: {
                attack: 0.01,
                decay: 0.05,
                sustain: 0.5,
                release: 0.04
            }
        });

        // Battle actions
        this.audio.createComplexSound("sword_hit", {
            frequencies: [220, 440, 880],
            types: ["square", "square", "triangle"],
            mix: [0.5, 0.3, 0.2],
            duration: 0.2,
            envelope: {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.4,
                release: 0.09
            }
        });

        this.audio.createComplexSound("magic_cast", {
            frequencies: [440, 587, 880, 1174],
            types: ["sine", "triangle", "sine", "triangle"],
            mix: [0.3, 0.3, 0.2, 0.2],
            duration: 0.5,
            envelope: {
                attack: 0.1,
                decay: 0.2,
                sustain: 0.4,
                release: 0.2
            }
        });

        this.audio.createSweepSound("heal", {
            startFreq: 440,
            endFreq: 880,
            type: "sine",
            duration: 0.3,
            envelope: {
                attack: 0.05,
                decay: 0.1,
                sustain: 0.6,
                release: 0.15
            }
        });

        this.audio.createComplexSound("victory", {
            frequencies: [440, 550, 660, 880],
            types: ["triangle", "sine", "triangle", "sine"],
            mix: [0.3, 0.3, 0.2, 0.2],
            duration: 1.0,
            envelope: {
                attack: 0.05,
                decay: 0.2,
                sustain: 0.5,
                release: 0.25
            }
        });
    }
    loadSprites() {
        // Load hero sprites
        ["warrior", "mage", "thief"].forEach((type) => {
            this.sprites[type] = Sprite.genHeroSprite(type);
        });

        ["slime", "bat", "goblin", "skeleton", "zombie", "ghoul", "rat", "redSlime", "wolf"].forEach((type) => {
            this.sprites[type] = Sprite.genEnemySprite(type);
        });

        // Load backgrounds
        ["cave"].forEach((type) => {
            this.backgrounds[type] = Sprite.genBackground(type);
        });
    }

    generateEnemyParty() {
        // Calculate average level of the party members
        const partyMembers = this.persistentParty.filter((char) => char);
        const avgPartyLevel = partyMembers.reduce((sum, char) => sum + char.level, 0) / partyMembers.length;

        // Determine number of enemies (1-4)
        const count = Math.floor(Math.random() * 4) + 1;
        const enemies = [];
        const types = Object.keys(this.enemyTemplates);

        for (let i = 0; i < count; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const template = this.enemyTemplates[type];

            // Add level with slight variation from party average
            // Random variation between -2 and +2 levels
            const levelVariation = Math.floor(Math.random() * 5) - 2;
            const enemyLevel = Math.max(1, Math.floor(avgPartyLevel + levelVariation));

            // Scale stats based on level difference from the template
            // Assuming templates are balanced for level 1
            const levelMultiplier = 1 + (enemyLevel - 1) * 0.1; // 10% increase per level

            enemies.push({
                name: type.charAt(0).toUpperCase() + type.slice(1),
                level: enemyLevel,
                ...template,
                // Scale core stats based on level
                maxHp: Math.floor(template.maxHp * levelMultiplier),
                maxMp: Math.floor(template.maxMp * levelMultiplier),
                strength: Math.floor(template.strength * levelMultiplier),
                magic: Math.floor(template.magic * levelMultiplier),
                speed: Math.floor(template.speed * levelMultiplier),
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
        this.battle = new BattleSystem(
            this.persistentParty,
            enemies,
            this.audio,
            this.input,
            this.partyInventory,
            this.gameMaster
        );
    }

    registerUIElements() {
        // Helper function that creates a bounds function with fixed parameters
        const createBoundsFn = (x, y, width, height) => {
            return function () {
                return { x, y, width, height };
            };
        };

        // Register cancel button
        const cancelBoundsFn = createBoundsFn(2, Game.HEIGHT - 185, 200, 30);
        this.input.registerElement("cancel_button", { bounds: cancelBoundsFn });
        this.uiElements.set("cancel_button", cancelBoundsFn);

        // Register main menu items
        const menuItems = ["Fight", "Magic", "Item", "Run"];
        for (let i = 0; i < menuItems.length; i++) {
            const x = 10;
            const y = Game.HEIGHT - 140 + i * 35;
            const width = 100;
            const height = 30;

            const boundsFn = createBoundsFn(x, y, width, height);
            const elementId = `menu_${menuItems[i].toLowerCase()}`;

            this.input.registerElement(elementId, { bounds: boundsFn });
            this.uiElements.set(elementId, boundsFn);
        }

        const maxMenuItems = Math.floor(140 / 35);

        // First column of submenu slots
        for (let i = 0; i < maxMenuItems; i++) {
            const x = 120;
            const y = Game.HEIGHT - 140 + i * 35;
            const width = 150;
            const height = 30;

            const boundsFn = createBoundsFn(x, y, width, height);
            const elementId = `submenu_slot_${i}`;

            this.input.registerElement(elementId, { bounds: boundsFn });
            this.uiElements.set(elementId, boundsFn);
        }

        // Second column of submenu slots
        for (let i = 0; i < maxMenuItems; i++) {
            const slotIndex = i + maxMenuItems;
            const x = 280;
            const y = Game.HEIGHT - 140 + i * 35;
            const width = 150;
            const height = 30;

            const boundsFn = createBoundsFn(x, y, width, height);
            const elementId = `submenu_slot_${slotIndex}`;

            this.input.registerElement(elementId, { bounds: boundsFn });
            this.uiElements.set(elementId, boundsFn);
        }

        // Enemy slots
        for (let i = 0; i < 4; i++) {
            const x = 176;
            const y = 126 + i * 80;
            const width = 48;
            const height = 48;

            const boundsFn = createBoundsFn(x, y, width, height);
            const elementId = `enemy_${i}`;

            this.input.registerElement(elementId, { bounds: boundsFn });
            this.uiElements.set(elementId, boundsFn);
        }

        // Character slots
        for (let i = 0; i < 4; i++) {
            const x = 584;
            const y = 134 + i * 100;
            const width = 32;
            const height = 32;

            const boundsFn = createBoundsFn(x, y, width, height);
            const elementId = `char_${i}`;

            this.input.registerElement(elementId, { bounds: boundsFn });
            this.uiElements.set(elementId, boundsFn);
        }

        // Register scroll arrows
        const arrowWidth = 30;
        const arrowHeight = 20;

        const upArrowBoundsFn = createBoundsFn(440, Game.HEIGHT - 130, arrowWidth, arrowHeight);
        this.input.registerElement("page_scroll_up", { bounds: upArrowBoundsFn });
        this.uiElements.set("page_scroll_up", upArrowBoundsFn);

        const downArrowBoundsFn = createBoundsFn(440, Game.HEIGHT - 35, arrowWidth, arrowHeight);
        this.input.registerElement("page_scroll_down", { bounds: downArrowBoundsFn });
        this.uiElements.set("page_scroll_down", downArrowBoundsFn);
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
            this.ctx.fillRect(0, 0, 800, 450); // Only darken the battle area (600-150 = 450)

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
        // Preserve all character data including status effects
        if (this.battle) {
            if (this.battle.state === "victory") {
                // Reset ATB values before saving
                this.battle.party.forEach((char) => {
                    if (char) {
                        char.atbCurrent = 0;
                        char.isReady = false;
                        
                        // Ensure we're transferring status effects back to persistent party
                        const persistentChar = this.persistentParty.find(p => p.name === char.name);
                        if (persistentChar) {
                            // Copy status effects with enhanced logging
                            console.log(`Transferring status effects from battle back to persistent character: ${char.name}`);
                            
                            // Copy all status effects
                            Object.keys(char.status).forEach(statusType => {
                                const oldValue = persistentChar.status[statusType];
                                persistentChar.status[statusType] = char.status[statusType];
                                
                                // Log any status changes
                                if (oldValue !== persistentChar.status[statusType]) {
                                    console.log(`  - ${statusType}: ${oldValue} => ${persistentChar.status[statusType]}`);
                                }
                            });
                        }
                    }
                });
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