// game/mode/battle/classes/battlesystem.js
class BattleSystem {
    constructor(party, enemyParty, audio, input, inventory, gameMaster) {
        this.party = party;
        this.enemies = enemyParty.map((data) => new Character(data));
        this.partyInventory = inventory;
        this.enemyInventory = new Inventory();
        this.audio = audio;
        this.input = input;
        this.gameMaster = gameMaster;
        this.state = "init";
        this.battleLog = new BattleLog();

        this.initializeState();
        this.inputManager = new BattleInputManager(this, this.input);
        this.createSoundEffects();
        this.setupInitialPositions();
        // Create enemy inventory with random items
        this.enemyInventory = new Inventory();
        this.initializeEnemyInventory();
        this.resultsMenu = null;
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
        // Add these lines
        this.stateStartTime = null;
        this.readyForWorldTransition = false;
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
        // Changed logic: Include all enemies/allies but create a separate list of living ones for targeting
        const targetsAll = this.currentTargetGroup === "enemies" ? this.enemies : this.party;
        
        // Filter for living targets (only used for targeting selection)
        const targetsLiving = targetsAll.filter(target => target && !target.isDead);
        
        // For targeting, we still only want to target living enemies/characters
        this.targetList = this.isGroupTarget ? [targetsLiving] : targetsLiving;
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

    // For attacks
    executeAttack(attack) {
        if (!attack || !attack.character || !attack.target) return;

        this.isProcessingAction = true;
        this.animations.push(
            new AttackAnimation(attack.character, attack.target, this.enemies.includes(attack.character))
        );

        // Store the pending effect to apply after animation completes
        this.pendingEffect = () => {
            const damage = Math.floor(attack.character.stats.attack * 1.5);
            const actualDamage = Math.min(attack.target.hp, damage);

            // Start the HP animation
            attack.target.animatingHP = true;
            attack.target.targetHP = Math.max(0, attack.target.hp - actualDamage);
            attack.target.hpAnimStartTime = Date.now();

            const message = `${attack.character.name} attacks ${attack.target.name} for ${actualDamage} damage!`;
            this.battleLog.addMessage(message, "damage");
            this.showBattleMessage(message);

            this.audio.play("sword_hit");
            this.isProcessingAction = false;
        };
    }

    // For spells
    executeSpell(action) {
        if (!action || !action.spell || !action.character || !action.target) return;

        this.isProcessingAction = true;

        // Add animations first
        const isEnemy = this.enemies.includes(action.character);

        if (action.isGroupTarget) {
            const targets = Array.isArray(action.target) ? action.target : [action.target];
            
            // For group targets, only the first animation should show darkening
            // so we'll mark all subsequent ones as group animations
            let isFirstTarget = true;
            
            targets.forEach((target) => {
                if (!target.isDead) {
                    this.animations.push(
                        new SpellAnimation(action.spell.animation, target.pos, action.character, isEnemy, !isFirstTarget)
                    );
                    isFirstTarget = false;
                }
            });
        } else {
            this.animations.push(
                new SpellAnimation(action.spell.animation, action.target.pos, action.character, isEnemy)
            );
        }

        // Store the spell effect to apply after animations finish
        this.pendingEffect = () => {
            // MP cost for caster (animate MP decrease)
            action.character.animatingMP = true;
            action.character.targetMP = Math.max(0, action.character.mp - action.spell.mpCost);
            action.character.mpAnimStartTime = Date.now();

            // Then handle effect on targets
            let totalDamage = 0;
            let targetMessage;

            if (action.isGroupTarget) {
                const targets = Array.isArray(action.target) ? action.target : [action.target];
                targets.forEach((target) => {
                    if (!target.isDead) {
                        // Calculate damage but don't apply it directly
                        const damage = this.calculateSpellDamage(action.character, action.spell, target);
                        totalDamage += damage;

                        // Start HP animation for each target
                        target.animatingHP = true;
                        target.targetHP = Math.max(0, target.hp - damage);
                        target.hpAnimStartTime = Date.now();
                    }
                });
                targetMessage = "all enemies";
            } else {
                // Calculate damage but don't apply it directly
                const damage = this.calculateSpellDamage(action.character, action.spell, action.target);
                totalDamage = damage;

                // Start HP animation for target
                action.target.animatingHP = true;
                action.target.targetHP = Math.max(0, action.target.hp - damage);
                action.target.hpAnimStartTime = Date.now();

                targetMessage = action.target.name;
            }

            this.audio.play("magic_cast");
            const message = `${action.character.name} casts ${action.spell.name} on ${targetMessage} for ${totalDamage} damage!`;
            this.battleLog.addMessage(message, "damage");
            this.showBattleMessage(message);

            this.isProcessingAction = false;
        };
    }

    // For items
    executeItem(action) {
        if (!action || !action.item || !action.character || !action.target) return;

        this.isProcessingAction = true;

        // Add item use animation
        if (action.isGroupTarget) {
            const targets = Array.isArray(action.target) ? action.target : [action.target];
            targets.forEach((target) => {
                this.animations.push(new ItemAnimation(action.item.animation, target.pos, action.character));
            });
        } else {
            this.animations.push(new ItemAnimation(action.item.animation, action.target.pos, action.character));
        }

        // Store the item effect to apply after animation completes
        this.pendingEffect = () => {
            let targetMessage;
            let effectMessage = "";
            let totalHealing = 0;

            // Handle item effects based on type
            if (action.isGroupTarget) {
                const targets = Array.isArray(action.target) ? action.target : [action.target];
                targets.forEach((target) => {
                    // Handle different item types
                    if (action.item.name.toLowerCase().includes("potion")) {
                        const healAmount = this.calculateHealAmount(target, action.item);
                        totalHealing += healAmount;

                        // Animate HP increase
                        target.animatingHP = true;
                        target.targetHP = Math.min(target.maxHp, target.hp + healAmount);
                        target.hpAnimStartTime = Date.now();
                    } else if (action.item.name.toLowerCase().includes("ether")) {
                        const mpRestored = this.calculateMPRestored(target, action.item);

                        // Animate MP increase
                        target.animatingMP = true;
                        target.targetMP = Math.min(target.maxMp, target.mp + mpRestored);
                        target.mpAnimStartTime = Date.now();
                    } else if (action.item.name.toLowerCase().includes("bomb")) {
                        const damage = this.calculateItemDamage(target, action.item);

                        // Animate HP decrease
                        target.animatingHP = true;
                        target.targetHP = Math.max(0, target.hp - damage);
                        target.hpAnimStartTime = Date.now();
                    }
                });
                targetMessage = "all allies";
            } else {
                // Similar logic for single target
                if (action.item.name.toLowerCase().includes("potion")) {
                    const healAmount = this.calculateHealAmount(action.target, action.item);
                    totalHealing = healAmount;

                    // Animate HP increase
                    action.target.animatingHP = true;
                    action.target.targetHP = Math.min(action.target.maxHp, action.target.hp + healAmount);
                    action.target.hpAnimStartTime = Date.now();

                    effectMessage = ` restoring ${totalHealing} HP`;
                    this.audio.play("heal");
                } else if (action.item.name.toLowerCase().includes("ether")) {
                    const mpRestored = this.calculateMPRestored(action.target, action.item);

                    // Animate MP increase
                    action.target.animatingMP = true;
                    action.target.targetMP = Math.min(action.target.maxMp, action.target.mp + mpRestored);
                    action.target.mpAnimStartTime = Date.now();

                    effectMessage = ` restoring ${mpRestored} MP`;
                } else if (action.item.name.toLowerCase().includes("bomb")) {
                    const damage = this.calculateItemDamage(action.target, action.item);

                    // Animate HP decrease
                    action.target.animatingHP = true;
                    action.target.targetHP = Math.max(0, action.target.hp - damage);
                    action.target.hpAnimStartTime = Date.now();

                    effectMessage = ` dealing ${damage} damage`;
                }
                targetMessage = action.target.name;
            }

            const itemId = Object.keys(ITEMS).find((id) => ITEMS[id] === action.item);

            // Check if action is from an enemy or player character
            if (this.enemies.includes(action.character)) {
                // Enemy used an item - we already removed it when queueing the action
                // No need to remove from inventory again
            } else {
                // Player used an item
                this.partyInventory.removeItem(itemId);
            }

            const message = `${action.character.name} used ${action.item.name} on ${targetMessage}${effectMessage}!`;
            this.battleLog.addMessage(message, action.item.name.toLowerCase().includes("potion") ? "heal" : "damage");
            this.showBattleMessage(message);

            this.isProcessingAction = false;
        };
    }

    handleEnemyInput(enemy) {
        // Add check to make sure the enemy isn't dead
        if (enemy.isDead) {
            console.log(`${enemy.name} is dead and cannot take action`);
            enemy.isReady = false;
            enemy.atbCurrent = 0;
            return;
        }

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

        if (this.state === "post_results") {
            this.updateTransitions();
            return;
        }

        if (this.state === "results") {
            // Update the results menu
            if (this.resultsMenu) {
                const result = this.resultsMenu.update();

                if (result === "exit") {
                    console.log("Exit returned from menu..");
                    // Clean up
                    this.resultsMenu.cleanup();
                    this.resultsMenu = null;

                    // Set state back to victory and make sure readyForWorldTransition is true
                    this.state = "victory";
                    this.readyForWorldTransition = true;

                    // Reset transition progress to ensure animation plays
                    this.transitionProgress = 1;
                    return;
                }
            }
            return; // Skip the rest of the update method
        }

        // Handle victory and game over states
        if (this.state === "victory" || this.state === "gameover") {
            if (!this.stateStartTime) {
                this.stateStartTime = Date.now();
                // Play the victory sound when entering this state
                if (this.state === "victory") {
                    this.audio.play("victory");
                }
            }

            // Stay in this state for 3 seconds before allowing transition
            const stateDuration = 3000; // 3 seconds
            if (Date.now() - this.stateStartTime > stateDuration) {
                if (this.state === "victory") {
                    // After victory screen, show results
                    this.showResultsScreen();
                } else {
                    // Game over goes straight to world
                    this.readyForWorldTransition = true;
                }
            }

            // Only update transition after the delay
            if (this.readyForWorldTransition) {
                this.updateTransitions();
            }

            return; // Skip the rest of the update method
        }

        if (this.currentMenu === "magic" || this.currentMenu === "item" || this.targetingMode) {
            this.showCancelButton = true;
        } else {
            this.showCancelButton = false;
        }

        // First, handle animations and transitions
        this.handleAnimations();

        // Apply pending effects if animations are complete
        if (this.pendingEffect && this.animations.length === 0) {
            this.pendingEffect();
            this.pendingEffect = null;
        }

        // Check if any character has ongoing HP/MP animations
        const hasOngoingStatAnimations = [...this.party, ...this.enemies].some((char) => {
            return char && (char.animatingHP || char.animatingMP);
        });

        // Update HP/MP animations for all characters
        [...this.party, ...this.enemies].forEach((char) => {
            if (!char) return; // Skip empty slots

            // Handle HP animation
            if (char.animatingHP) {
                const elapsed = Date.now() - char.hpAnimStartTime;
                const duration = 750;

                if (elapsed >= duration) {
                    // Animation complete, apply the actual change
                    char.hp = char.targetHP;
                    char.animatingHP = false;

                    // Check if character died from this
                    if (char.hp <= 0) {
                        char.isDead = true;
                        this.battleLog.addMessage(`${char.name} was defeated!`, "system");
                    }
                } else {
                    // Animation in progress
                    const progress = elapsed / duration;
                    char.hpAnimProgress = this.easeOutCubic(progress); // Smoother animation
                }
            }

            // Handle MP animation
            if (char.animatingMP) {
                const elapsed = Date.now() - char.mpAnimStartTime;
                const duration = 750;

                if (elapsed >= duration) {
                    // Animation complete, apply the actual change
                    char.mp = char.targetMP;
                    char.animatingMP = false;
                } else {
                    // Animation in progress
                    const progress = elapsed / duration;
                    char.mpAnimProgress = this.easeOutCubic(progress); // Smoother animation
                }
            }
        });

        this.updateTransitions();

        // Check victory/defeat conditions
        if (this.checkBattleEnd()) return;

        // Update ATB gauges and track who becomes ready
        this.updateATBGauges();

        // Only process actions if we're not already processing one
        // and there are no active animations AND no ongoing stat animations
        if (!this.isProcessingAction && this.animations.length === 0 && !hasOngoingStatAnimations) {
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
    easeOutCubic(x) {
        return 1 - Math.pow(1 - x, 3);
    }
    calculateSpellDamage(caster, spell, target) {
        // Basic spell damage calculation
        const baseDamage = spell.power;
        const magicStat = caster.stats.magic || 10;
        const targetResist = target.stats.magicResist || 0;

        // Calculate actual damage
        let damage = baseDamage * (magicStat / 10);
        damage = Math.max(1, damage - targetResist);

        return Math.floor(damage);
    }

    calculateHealAmount(target, item) {
        // Basic healing calculation
        let healPower;

        if (item.name.toLowerCase().includes("potion")) {
            healPower = 50;
        } else if (item.name.toLowerCase().includes("hi-potion")) {
            healPower = 100;
        } else if (item.name.toLowerCase().includes("mega-potion")) {
            healPower = 200;
        } else {
            healPower = 30; // Default healing amount
        }

        return Math.floor(healPower);
    }

    calculateMPRestored(target, item) {
        // Basic MP restoration calculation
        let restorePower;

        if (item.name.toLowerCase().includes("ether")) {
            restorePower = 30;
        } else if (item.name.toLowerCase().includes("hi-ether")) {
            restorePower = 60;
        } else if (item.name.toLowerCase().includes("mega-ether")) {
            restorePower = 120;
        } else {
            restorePower = 15; // Default MP restoration
        }

        return Math.floor(restorePower);
    }

    calculateItemDamage(target, item) {
        // Basic item damage calculation
        let damagePower;

        if (item.name.toLowerCase().includes("bomb")) {
            damagePower = 50;
        } else if (item.name.toLowerCase().includes("mega-bomb")) {
            damagePower = 100;
        } else if (item.name.toLowerCase().includes("poison")) {
            damagePower = 25;
        } else {
            damagePower = 30; // Default damage
        }

        return Math.floor(damagePower);
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
            this.transitionProgress = 0; // Reset transition progress
            this.stateStartTime = null; // Reset state timing
            return true;
        } else if (this.enemies.every((enemy) => enemy.isDead)) {
            this.state = "victory";
            this.battleLog.addMessage("Victory!", "system");
            this.transitionProgress = 0; // Reset transition progress
            this.stateStartTime = null; // Reset state timing
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
            case "post_results": // Add this case
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

    showResultsScreen() {
        // Create battle results data
        const battleResults = {
            defeatedEnemies: this.enemies.filter((enemy) => enemy.isDead),
            enemyInventory: this.enemyInventory
        };

        // Create the results menu
        this.resultsMenu = new BattleResultsMenu(this.ctx, this.input, this.gameMaster, battleResults);

        // Change state
        this.state = "results";
        this.stateStartTime = null;
    }

    render(ctx) {
        // If showing results menu, only render that
        if (this.state === "results" && this.resultsMenu) {
            this.resultsMenu.draw();
            return;
        }

        // Otherwise use the renderer for normal battle rendering
        this.renderer.render(ctx);
    }
}