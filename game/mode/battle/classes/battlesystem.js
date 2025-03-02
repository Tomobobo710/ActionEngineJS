// game/mode/battle/classes/battlesystem.js
class BattleSystem {
    constructor(party, enemyParty, audio, input, inventory) {
        this.party = party;
        this.enemies = enemyParty.map((data) => new Character(data));
        this.partyInventory = inventory;
        this.enemyInventory = new Inventory();
        this.audio = audio;
        this.input = input;
        this.state = "init";
        this.battleLog = new BattleLog();

        this.initializeState();
        this.inputManager = new BattleInputManager(this, this.input);
        this.createSoundEffects();
        this.setupInitialPositions();
        // Create enemy inventory with random items
        this.enemyInventory = new Inventory();
        this.initializeEnemyInventory();
        
        // Create the renderer
        this.renderer = new BattleRenderer(this);
    }

    initializeEnemyInventory() {
        // Random chance to have each item type
        Object.keys(ITEMS).forEach((itemId) => {
            if (Math.random() < 0.3) {
                // 30% chance for each item
                const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 of each
                this.enemyInventory.addItem(itemId, quantity);
            }
        });
    }

    initializeState() {
        this.activeChar = null;
        this.selectedTarget = null;
        this.currentMenu = "main";
        this.selectedAction = null;
        this.menuPosition = 0;
        this.subMenuPosition = 0;
        this.currentMessage = null;
        this.animations = [];
        this.transitionProgress = 0;
        this.isPaused = false;
        this.targetingMode = false;
        this.targetList = [];
        this.targetIndex = 0;
        this.pendingSpell = null;
        this.itemMenuPosition = 0;
        this.itemScrollOffset = 0;
        this.maxVisibleItems = 8;
        this.hoveredItem = null;
        this.pendingItem = null;
        this.currentTargetGroup = "enemies";
        this.defaultTargetGroup = "enemies";
        this.isSingleTarget = true;
        this.hoveredMenuOption = null;
        this.hoveredTarget = null;
        this.hoveredSpell = null;
        this.showCancelButton = false;
        this.spellScrollOffset = 0;
        this.maxVisibleSpells = 8;
        this.upArrowHovered = false;
        this.downArrowHovered = false;
        this.actionQueue = []; // Will hold {character, action, target} objects
        this.readyOrder = []; // track who filled their ATB in order
        this.isProcessingAction = false; // Flag to track if we're currently animating/processing an action
    }

    handleInput(input) {
        this.inputManager.handleInput(input);
    }
    
    // Add methods to handle party management
    addPartyMember(character, slot) {
        if (slot >= 0 && slot < 4) {
            this.party[slot] = character;
            character.pos = {
                x: 600,
                y: 150 + slot * 100
            };
            character.targetPos = { ...character.pos };
        }
    }

    removePartyMember(slot) {
        if (slot >= 0 && slot < 4) {
            this.party[slot] = null;
        }
    }
    
    startTargeting(targetType) {
        this.targetingMode = true;

        // Set defaults based on action type
        switch (targetType) {
            case TARGET_TYPES.SINGLE_ENEMY:
                this.defaultTargetGroup = "enemies";
                this.isSingleTarget = true;
                this.isGroupTarget = false;
                break;
            case TARGET_TYPES.ALL_ENEMIES:
                this.defaultTargetGroup = "enemies";
                this.isSingleTarget = false;
                this.isGroupTarget = true;
                break;
            case TARGET_TYPES.SINGLE_ALLY:
                this.defaultTargetGroup = "allies";
                this.isSingleTarget = true;
                this.isGroupTarget = false;
                break;
            case TARGET_TYPES.ALL_ALLIES:
                this.defaultTargetGroup = "allies";
                this.isSingleTarget = false;
                this.isGroupTarget = true;
                break;
        }

        // Initialize to default group but allow switching
        this.currentTargetGroup = this.defaultTargetGroup;
        this.updateTargetList();
    }

    updateTargetList() {
        const targets =
            this.currentTargetGroup === "enemies"
                ? this.enemies.filter((e) => e && !e.isDead)
                : this.party.filter((c) => c && !c.isDead);

        this.targetList = this.isGroupTarget ? [targets] : targets;
        this.targetIndex = 0;
    }

    executeTargetedAction(target) {
        this.hoveredTarget = null;

        // First check if this character already has a queued action
        const existingAction = this.actionQueue.find((action) => action.character === this.activeChar);

        if (existingAction) {
            const message = `${this.activeChar.name} already has an action queued!`;
            this.battleLog.addMessage(message, "damage");
            this.showBattleMessage(message);
            this.audio.play("menu_error");
            return;
        }

        let actionObject = {
            character: this.activeChar,
            target: target,
            isGroupTarget: this.isGroupTarget
        };

        if (this.selectedAction === "fight") {
            actionObject.type = "attack";
        } else if (this.pendingSpell) {
            actionObject.type = "spell";
            actionObject.spell = this.pendingSpell;
        } else if (this.selectedAction === "item" && this.pendingItem) {
            actionObject.type = "item";
            actionObject.item = this.pendingItem;
        }

        // Queue the action
        this.actionQueue.push(actionObject);

        // After queueing the action, remove the character from readyOrder
        this.readyOrder = this.readyOrder.filter((char) => char !== this.activeChar);

        // Reset character state after queueing
        this.activeChar.isReady = false;
        this.activeChar.atbCurrent = 0;

        // Reset UI state
        this.endTargeting();
        this.currentMenu = "main";
        this.selectedAction = null;
        this.pendingItem = null;
        this.pendingSpell = null;
        this.activeChar = null;
        this.audio.play("menu_select");
    }

    executeAttack(attack) {
        if (!attack || !attack.character || !attack.target) return;

        this.isProcessingAction = true;
        this.animations.push(new AttackAnimation(attack.character, attack.target));

        setTimeout(() => {
            const damage = Math.floor(attack.character.stats.attack * 1.5);
            const actualDamage = attack.target.takeDamage(damage);

            const message = `${attack.character.name} attacks ${attack.target.name} for ${actualDamage} damage!`;
            this.battleLog.addMessage(message, "damage");
            this.showBattleMessage(message);

            this.audio.play("sword_hit");
            this.isProcessingAction = false;
        }, 0);
    }

    executeSpell(action) {
        if (!action || !action.spell || !action.character || !action.target) return;

        let totalDamage = 0;
        let targetMessage;

        if (action.isGroupTarget) {
            const targets = Array.isArray(action.target) ? action.target : [action.target];
            targets.forEach((enemy) => {
                if (!enemy.isDead) {
                    const damage = action.character.castSpell(action.spell, enemy);
                    totalDamage += damage;
                    // Pass the caster to SpellAnimation
                    this.animations.push(new SpellAnimation(action.spell.animation, enemy.pos, action.character));
                }
            });
            targetMessage = "all enemies";
        } else {
            totalDamage = action.character.castSpell(action.spell, action.target);
            // Pass the caster to SpellAnimation
            this.animations.push(new SpellAnimation(action.spell.animation, action.target.pos, action.character));
            targetMessage = action.target.name;
        }

        this.audio.play("magic_cast");
        const message = `${action.character.name} casts ${action.spell.name} on ${targetMessage} for ${totalDamage} damage!`;
        this.battleLog.addMessage(message, "damage");
        this.showBattleMessage(message);
    }

    executeItem(action) {
        if (!action || !action.item || !action.character || !action.target) return;

        let targetMessage;
        let effectMessage = "";
        let totalHealing = 0;

        if (action.isGroupTarget) {
            action.target.forEach((t) => {
                const result = action.item.effect(t);
                if (action.item.name.toLowerCase().includes("potion")) {
                    totalHealing += result; // result will be healing amount
                }
            });
            targetMessage = "all allies";
        } else {
            const result = action.item.effect(action.target);
            if (action.item.name.toLowerCase().includes("potion")) {
                totalHealing = result; // result will be healing amount
            }
            targetMessage = action.target.name;
        }

        // Add healing amount to message for potions
        if (action.item.name.toLowerCase().includes("potion")) {
            effectMessage = ` restoring ${totalHealing} HP`;
        } else if (action.item.name.toLowerCase().includes("poison")) {
            effectMessage = " inflicting poison";
        } else if (action.item.name.toLowerCase().includes("bomb")) {
            effectMessage = " dealing damage";
        }

        const itemId = Object.keys(ITEMS).find((id) => ITEMS[id] === action.item);
        this.partyInventory.removeItem(itemId);

        const message = `${action.character.name} used ${action.item.name} on ${targetMessage}${effectMessage}!`;
        this.battleLog.addMessage(message, action.item.name.toLowerCase().includes("potion") ? "heal" : "damage");
        this.showBattleMessage(message);
    }

    handleEnemyInput(enemy) {
        const livingPartyMembers = this.party.filter((member) => !member.isDead);
        const livingEnemies = this.enemies.filter((e) => !e.isDead);

        if (livingPartyMembers.length === 0) return;

        const actions = [];

        // Basic attack
        actions.push({
            type: "attack",
            weight: 50,
            target: () => livingPartyMembers[Math.floor(Math.random() * livingPartyMembers.length)],
            isGroupTarget: false
        });

        // Consider spells
        if (enemy.spells && enemy.mp > 0) {
            enemy.spells.forEach((spellId) => {
                const spell = SPELLS[spellId];
                if (enemy.mp >= spell.mpCost) {
                    const isGroup =
                        spell.targetType === TARGET_TYPES.ALL_ENEMIES || spell.targetType === TARGET_TYPES.ALL_ALLIES;

                    // Reverse the targeting for enemy spells
                    let targets;
                    switch (spell.targetType) {
                        case TARGET_TYPES.SINGLE_ENEMY:
                        case TARGET_TYPES.ALL_ENEMIES:
                            targets = livingPartyMembers;
                            break;
                        case TARGET_TYPES.SINGLE_ALLY:
                        case TARGET_TYPES.ALL_ALLIES:
                            targets = livingEnemies;
                            break;
                    }

                    actions.push({
                        type: "spell",
                        spell: spell,
                        weight: 30,
                        target: () => (isGroup ? targets : targets[Math.floor(Math.random() * targets.length)]),
                        isGroupTarget: isGroup
                    });
                }
            });
        }

        // Consider items
        const availableItems = this.enemyInventory.getAvailableItems();
        availableItems.forEach(({ id, item }) => {
            const isGroup = item.targetType === TARGET_TYPES.ALL_ENEMIES || item.targetType === TARGET_TYPES.ALL_ALLIES;

            // Reverse the targeting for enemy items
            let targets;
            switch (item.targetType) {
                case TARGET_TYPES.SINGLE_ENEMY:
                case TARGET_TYPES.ALL_ENEMIES:
                    targets = livingPartyMembers;
                    break;
                case TARGET_TYPES.SINGLE_ALLY:
                case TARGET_TYPES.ALL_ALLIES:
                    targets = livingEnemies;
                    break;
            }

            // Healing items logic
            if (item.targetType === TARGET_TYPES.SINGLE_ALLY && enemy.hp < enemy.maxHp * 0.3) {
                actions.push({
                    type: "item",
                    item: item,
                    itemId: id,
                    weight: 80,
                    target: () => enemy,
                    isGroupTarget: false
                });
            }
            // Offensive items logic
            else if (item.targetType === TARGET_TYPES.ALL_ENEMIES && livingPartyMembers.length > 1) {
                actions.push({
                    type: "item",
                    item: item,
                    itemId: id,
                    weight: 60,
                    target: () => targets,
                    isGroupTarget: isGroup
                });
            }
        });

        // Select and queue action
        if (actions.length > 0) {
            const totalWeight = actions.reduce((sum, action) => sum + action.weight, 0);
            let random = Math.random() * totalWeight;
            let selectedAction = actions[0];

            for (const action of actions) {
                random -= action.weight;
                if (random <= 0) {
                    selectedAction = action;
                    break;
                }
            }

            const actionObject = {
                character: enemy,
                type: selectedAction.type,
                target: selectedAction.target(),
                isGroupTarget: selectedAction.isGroupTarget
            };

            if (selectedAction.spell) {
                actionObject.spell = selectedAction.spell;
            }
            if (selectedAction.item) {
                actionObject.item = selectedAction.item;
                this.enemyInventory.removeItem(selectedAction.itemId);
            }

            this.actionQueue.push(actionObject);
        }

        enemy.isReady = false;
        enemy.atbCurrent = 0;
    }

    handleSpellSelection(selectedSpell) {
        if (this.activeChar.mp >= selectedSpell.mpCost) {
            this.pendingSpell = selectedSpell;
            this.startTargeting(selectedSpell.targetType);
            this.audio.play("menu_select");
        } else {
            this.showBattleMessage("Not enough MP!");
            this.audio.play("menu_error");
        }
    }

    endTargeting() {
        this.targetingMode = false;
        this.targetList = [];
        this.targetIndex = 0;
        this.pendingSpell = null;
        this.selectedAction = null;
    }

    attemptRun() {
        if (Math.random() < 0.5) {
            this.battleLog.addMessage("Got away safely!", "system");
            this.state = "victory";
        } else {
            this.battleLog.addMessage("Couldn't escape!", "system");
            this.showBattleMessage("Couldn't escape!");
        }
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

    setupInitialPositions() {
        this.party.forEach((char, i) => {
            char.pos.x = 600;
            char.pos.y = 150 + i * 100;
            char.targetPos = { ...char.pos };
        });

        this.enemies.forEach((enemy, i) => {
            enemy.pos.x = 200;
            enemy.pos.y = 150 + i * 80;
            enemy.targetPos = { ...enemy.pos };
        });
    }

    update() {
        if (this.isPaused) return;

        if (this.currentMenu === "magic" || this.currentMenu === "item" || this.targetingMode) {
            this.showCancelButton = true;
        } else {
            this.showCancelButton = false;
        }

        // First, handle animations and transitions
        this.handleAnimations();
        this.updateTransitions();

        // Check victory/defeat conditions
        if (this.checkBattleEnd()) return;

        // Update ATB gauges and track who becomes ready
        this.updateATBGauges();

        // Only process actions if we're not already processing one
        // and there are no active animations
        if (!this.isProcessingAction && this.animations.length === 0) {
            // If we have queued actions, process the next one
            if (this.actionQueue.length > 0) {
                this.processNextAction();
            }
            // Otherwise, if we have ready characters and no active character
            else if (!this.activeChar && this.readyOrder.length > 0) {
                const nextCharacter = this.readyOrder[0];

                if (nextCharacter.isEnemy) {
                    // Only handle enemy input if no actions are queued at all
                    if (this.actionQueue.length === 0) {
                        this.handleEnemyInput(nextCharacter);
                        this.readyOrder.shift();
                    }
                } else {
                    // Reset pagination whenever a new character becomes active
                    this.spellScrollOffset = 0;
                    this.itemScrollOffset = 0;
                    this.subMenuPosition = 0;

                    this.activeChar = nextCharacter;
                }
            }
        }
    }

    processNextAction() {
        const nextAction = this.actionQueue[0];
        this.isProcessingAction = true;

        switch (nextAction.type) {
            case "attack":
                this.executeAttack(nextAction);
                break;
            case "spell":
                this.executeSpell(nextAction);
                break;
            case "item":
                this.executeItem(nextAction);
                break;
        }

        this.actionQueue.shift();
        this.isProcessingAction = false;
    }

    handleAnimations() {
        // Handle character position animations
        [...this.party, ...this.enemies].forEach((char) => {
            if (char.animating) {
                char.pos.x += (char.targetPos.x - char.pos.x) * 0.2;
                char.pos.y += (char.targetPos.y - char.pos.y) * 0.2;

                if (Math.abs(char.pos.x - char.targetPos.x) < 0.1 && Math.abs(char.pos.y - char.targetPos.y) < 0.1) {
                    char.pos = { ...char.targetPos };
                    char.animating = false;
                }
            }
        });

        // Update and filter battle animations
        this.animations = this.animations.filter((anim) => {
            anim.update();
            return !anim.finished;
        });
    }

    updateATBGauges() {
        [...this.party, ...this.enemies].forEach((char) => {
            const wasReady = char.isReady;
            char.updateATB();
            char.updateStatus();

            if (!wasReady && char.isReady) {
                const hasQueuedAction = this.actionQueue.some((action) => action.character === char);
                const alreadyInReadyOrder = this.readyOrder.includes(char);

                if (!hasQueuedAction && !alreadyInReadyOrder) {
                    char.isEnemy = this.enemies.includes(char);
                    this.readyOrder.push(char);
                }
            }
        });
    }

    checkBattleEnd() {
        if (this.party.every((char) => char.isDead)) {
            this.state = "gameover";
            this.battleLog.addMessage("Game Over!", "system");
            return true;
        } else if (this.enemies.every((enemy) => enemy.isDead)) {
            this.state = "victory";
            this.battleLog.addMessage("Victory!", "system");
            return true;
        }
        return false;
    }

    updateTransitions() {
        switch (this.state) {
            case "init":
                if (this.transitionProgress < 1) {
                    this.transitionProgress += 0.02;
                } else {
                    this.state = "battle";
                }
                break;

            case "victory":
            case "gameover":
                if (this.transitionProgress < 1) {
                    this.transitionProgress += 0.01;
                }
                break;
        }
    }

    showBattleMessage(message) {
        this.currentMessage = {
            text: message,
            alpha: 1.0,
            startTime: Date.now()
        };
    }

    render(ctx) {
        // Use the renderer to handle all rendering
        this.renderer.render(ctx);
    }
}