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

    render(ctx) {
        // Draw enhanced targeting effects for enemies/allies
        if (this.hoveredTarget && !this.hoveredTarget.isDead) {
            const target = this.hoveredTarget;

            // Animated target highlight
            ctx.save();
            const time = Date.now() / 1000;
            const pulseSize = Math.sin(time * 4) * 2;

            // Outer glow
            ctx.strokeStyle = target.type === "enemy" ? "#ff8888" : "#88ff88";
            ctx.lineWidth = 2;
            ctx.shadowColor = target.type === "enemy" ? "#ff0000" : "#00ff00";
            ctx.shadowBlur = 15;

            // Animated selection ring
            ctx.beginPath();
            ctx.arc(target.pos.x, target.pos.y, (target.type === "enemy" ? 24 : 16) + pulseSize, 0, Math.PI * 2);
            ctx.stroke();

            // Info popup with enhanced styling
            ctx.fillStyle = "rgba(0, 0, 102, 0.95)";
            ctx.shadowColor = "#4444ff";
            ctx.shadowBlur = 10;
            ctx.fillRect(target.pos.x + 30, target.pos.y - 40, 160, 80);
            ctx.strokeStyle = "#ffffff";
            ctx.strokeRect(target.pos.x + 30, target.pos.y - 40, 160, 80);

            // Target info
            ctx.shadowBlur = 0;
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 14px monospace";
            ctx.textAlign = "left";
            ctx.fillText(target.name, target.pos.x + 40, target.pos.y - 20);

            // HP bar with gradient
            const hpWidth = 140;
            const hpHeight = 8;
            const hpX = target.pos.x + 40;
            const hpY = target.pos.y;

            // HP bar background
            ctx.fillStyle = "#333333";
            ctx.fillRect(hpX, hpY, hpWidth, hpHeight);

            // HP bar fill with gradient
            const hpPercent = target.hp / target.maxHp;
            const hpGradient = ctx.createLinearGradient(hpX, hpY, hpX + hpWidth * hpPercent, hpY);
            if (hpPercent > 0.6) {
                hpGradient.addColorStop(0, "#00ff00");
                hpGradient.addColorStop(1, "#88ff88");
            } else if (hpPercent > 0.3) {
                hpGradient.addColorStop(0, "#ffff00");
                hpGradient.addColorStop(1, "#ffff88");
            } else {
                hpGradient.addColorStop(0, "#ff0000");
                hpGradient.addColorStop(1, "#ff8888");
            }
            ctx.fillStyle = hpGradient;
            ctx.fillRect(hpX, hpY, hpWidth * hpPercent, hpHeight);

            // HP text
            ctx.fillStyle = "#ffffff";
            ctx.font = "12px monospace";
            ctx.fillText(`${target.hp}/${target.maxHp} HP`, hpX, hpY + 20);

            // Show status effects if any
            let statusY = target.pos.y + 30;
            Object.entries(target.status).forEach(([status, duration]) => {
                if (duration > 0) {
                    ctx.fillStyle = "#ffff00";
                    ctx.fillText(`${status.toUpperCase()}: ${duration}`, hpX, statusY);
                    statusY += 12;
                }
            });

            ctx.restore();
        }
        // Add active character indicator in battle area
        if (this.activeChar && !this.activeChar.isDead) {
            // Keep the existing glow effect
            const gradient = ctx.createRadialGradient(
                this.activeChar.pos.x,
                this.activeChar.pos.y,
                10,
                this.activeChar.pos.x,
                this.activeChar.pos.y,
                30
            );
            gradient.addColorStop(0, "rgba(255, 255, 0, 0.2)");
            gradient.addColorStop(1, "rgba(255, 255, 0, 0)");
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.activeChar.pos.x, this.activeChar.pos.y, 30, 0, Math.PI * 2);
            ctx.fill();

            // Add a bouncing white arrow to the left
            const bounce = Math.sin(Date.now() / 100) * 5;
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.moveTo(this.activeChar.pos.x - 50 + bounce, this.activeChar.pos.y);
            ctx.lineTo(this.activeChar.pos.x - 35 + bounce, this.activeChar.pos.y - 10);
            ctx.lineTo(this.activeChar.pos.x - 35 + bounce, this.activeChar.pos.y + 10);
            ctx.closePath();
            ctx.fill();
        }

        // Draw targeting cursor if in targeting mode
        if (this.targetingMode && this.targetList.length > 0) {
            if (this.isGroupTarget) {
                // Draw targeting cursor over entire group
                const targets = this.targetList[0]; // Get the group array
                const bounce = Math.sin(Date.now() / 100) * 5;

                // Draw an arrow over each target
                targets.forEach((target) => {
                    ctx.fillStyle = "#ffff00";
                    ctx.beginPath();
                    ctx.moveTo(target.pos.x, target.pos.y - 30 + bounce);
                    ctx.lineTo(target.pos.x + 10, target.pos.y - 40 + bounce);
                    ctx.lineTo(target.pos.x - 10, target.pos.y - 40 + bounce);
                    ctx.closePath();
                    ctx.fill();
                });

                // Also draw the group selection box
                let minX = Infinity,
                    minY = Infinity;
                let maxX = -Infinity,
                    maxY = -Infinity;
                targets.forEach((target) => {
                    minX = Math.min(minX, target.pos.x - 30);
                    minY = Math.min(minY, target.pos.y - 30);
                    maxX = Math.max(maxX, target.pos.x + 30);
                    maxY = Math.max(maxY, target.pos.y + 30);
                });

                ctx.strokeStyle = "#ffff00";
                ctx.lineWidth = 2;
                ctx.strokeRect(minX - 10 + bounce / 2, minY - 10 + bounce / 2, maxX - minX + 20, maxY - minY + 20);
            } else {
                // Single target cursor
                const target = this.targetList[this.targetIndex];
                if (target && !target.isDead) {
                    const bounce = Math.sin(Date.now() / 100) * 5;

                    ctx.fillStyle = "#ffff00";
                    ctx.beginPath();
                    // Keep the original Y position (-40) but arrange points to point downward
                    ctx.moveTo(target.pos.x, target.pos.y - 30 + bounce);
                    ctx.lineTo(target.pos.x + 10, target.pos.y - 40 + bounce);
                    ctx.lineTo(target.pos.x - 10, target.pos.y - 40 + bounce);
                    ctx.closePath();
                    ctx.fill();
                } else {
                    // If target is dead or undefined, end targeting mode
                    this.endTargeting();
                    this.currentMenu = "main";
                }
            }
        }

        // Draw enemies
        this.enemies.forEach((enemy) => {
            if (!enemy.isDead) {
                ctx.drawImage(enemy.sprite, enemy.pos.x - 24, enemy.pos.y - 24);

                // Constants for bar dimensions
                const barWidth = 48;
                const barHeight = 4;
                const barSpacing = 6;

                // HP bar
                ctx.fillStyle = "#333";
                ctx.fillRect(enemy.pos.x - barWidth / 2, enemy.pos.y + 30, barWidth, barHeight);

                ctx.fillStyle = "#f00";
                const hpWidth = (enemy.hp / enemy.maxHp) * barWidth;
                ctx.fillRect(enemy.pos.x - barWidth / 2, enemy.pos.y + 30, hpWidth, barHeight);

                // ATB gauge
                ctx.fillStyle = "#333";
                ctx.fillRect(enemy.pos.x - barWidth / 2, enemy.pos.y + 30 + barSpacing, barWidth, barHeight);

                ctx.fillStyle = enemy.isReady ? "#ff0" : "#fff";
                const atbWidth = (enemy.atbCurrent / enemy.atbMax) * barWidth;
                ctx.fillRect(enemy.pos.x - barWidth / 2, enemy.pos.y + 30 + barSpacing, atbWidth, barHeight);
            }
        });
        // Draw party members
        this.party.forEach((char) => {
            if (!char) return; // Skip empty slots
            if (!char.isDead) {
                ctx.drawImage(char.sprite, char.pos.x - 16, char.pos.y - 16);

                // Draw character HP/MP bars
                const barWidth = 64;
                const barHeight = 4;
                const barSpacing = 6;

                // HP bar
                ctx.fillStyle = "#333";
                ctx.fillRect(char.pos.x - barWidth / 2, char.pos.y + 30, barWidth, barHeight);

                ctx.fillStyle = "#0f0";
                const hpWidth = (char.hp / char.maxHp) * barWidth;
                ctx.fillRect(char.pos.x - barWidth / 2, char.pos.y + 30, hpWidth, barHeight);

                // MP bar
                ctx.fillStyle = "#333";
                ctx.fillRect(char.pos.x - barWidth / 2, char.pos.y + 30 + barSpacing, barWidth, barHeight);

                ctx.fillStyle = "#00f";
                const mpWidth = (char.mp / char.maxMp) * barWidth;
                ctx.fillRect(char.pos.x - barWidth / 2, char.pos.y + 30 + barSpacing, mpWidth, barHeight);

                // ATB gauge
                ctx.fillStyle = "#333";
                ctx.fillRect(char.pos.x - barWidth / 2, char.pos.y + 30 + barSpacing * 2, barWidth, barHeight);

                ctx.fillStyle = char.isReady ? "#ff0" : "#fff";
                const atbWidth = (char.atbCurrent / char.atbMax) * barWidth;
                ctx.fillRect(char.pos.x - barWidth / 2, char.pos.y + 30 + barSpacing * 2, atbWidth, barHeight);
            }
        });

        // Draw battle menu
        this.drawBattleMenu(ctx);

        // Draw active animations
        this.animations.forEach((anim) => anim.render(ctx));

        // Draw messages
        this.drawMessages(ctx);

        // Draw transition effects
        if (this.state === "init" || this.state === "victory" || this.state === "gameover") {
            this.drawTransition(ctx);
        }
    }

    drawBattleMenu(ctx) {
        // Draw cancel button if needed
        if (this.showCancelButton) {
            const isHovered = this.hoveredCancel;

            ctx.save();
            // Make background wider to cover all text
            ctx.fillStyle = isHovered ? "rgba(40, 40, 40, 0.8)" : "rgba(20, 20, 20, 0.6)";
            ctx.fillRect(2, Game.HEIGHT - 185, 200, 30); // Moved left 8px (from 10) and up 5px (from -180)

            if (isHovered) {
                ctx.shadowColor = "#ff4444";
                ctx.shadowBlur = 10;
            }

            // Separate the text properly
            ctx.textAlign = "left"; // Changed to left align

            // "CANCEL" text
            ctx.fillStyle = "#ff4444";
            ctx.fillText("CANCEL", 12, Game.HEIGHT - 164); // Moved left 8px (from 20) and up 5px

            ctx.fillStyle = "#ffffff";
            ctx.fillText("with Action2", 70, Game.HEIGHT - 164); // Moved left 8px (from 85) and up 5px

            ctx.restore();
        }
        // Draw menu background (keeping existing code)
        ctx.fillStyle = "rgba(0, 0, 102, 0.95)";
        ctx.fillRect(0, Game.HEIGHT - 150, Game.WIDTH, 150);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, Game.HEIGHT - 150, Game.WIDTH, 150);
        // Draw party status with improved layout
        this.party.forEach((char, i) => {
            const x = 475; // This puts it more towards the right side of the empty space
            const y = Game.HEIGHT - 140 + i * 45;
            const isActive = char === this.activeChar;

            // Draw highlight box for active character
            if (isActive) {
                ctx.fillStyle = "rgba(255, 255, 0, 0.2)";
                ctx.fillRect(x, y, 300, 40);
            }

            // Character name
            ctx.fillStyle = isActive ? "#ffff00" : "#fff";
            ctx.font = "16px monospace";
            ctx.textAlign = "left";
            ctx.fillText(char.name, x + 10, y + 20);

            // HP bar
            const hpBarWidth = 100;
            const hpPercent = char.hp / char.maxHp;
            ctx.fillStyle = "#333";
            ctx.fillRect(x + 100, y + 10, hpBarWidth, 8);
            ctx.fillStyle = hpPercent < 0.2 ? "#ff0000" : hpPercent < 0.5 ? "#ffff00" : "#00ff00";
            ctx.fillRect(x + 100, y + 10, hpBarWidth * hpPercent, 8);
            ctx.fillStyle = "#fff";
            ctx.fillText(`${char.hp}/${char.maxHp}`, x + 210, y + 20);

            // MP bar
            const mpBarWidth = 100;
            const mpPercent = char.mp / char.maxMp;
            ctx.fillStyle = "#333";
            ctx.fillRect(x + 100, y + 25, mpBarWidth, 8);
            ctx.fillStyle = "#4444ff";
            ctx.fillRect(x + 100, y + 25, mpBarWidth * mpPercent, 8);
            ctx.fillStyle = "#fff";
            ctx.fillText(`${char.mp}/${char.maxMp}`, x + 210, y + 35);

            // Draw status effects
            Object.entries(char.status).forEach(([status, duration], j) => {
                if (duration > 0) {
                    ctx.fillStyle = "#ff0";
                    ctx.fillText(status.toUpperCase(), x + 300 + j * 70, y + 25);
                }
            });
        });
        // Enhanced command menu
        const commands = ["Fight", "Magic", "Item", "Run"];
        commands.forEach((cmd, i) => {
            const isHovered = this.hoveredMenuOption === cmd.toLowerCase();

            // Enhanced background effect
            if (isHovered) {
                // Animated gradient effect
                const time = Date.now() / 1000;
                const gradient = ctx.createLinearGradient(
                    10,
                    Game.HEIGHT - 140 + i * 35,
                    110,
                    Game.HEIGHT - 110 + i * 35
                );
                gradient.addColorStop(0, `rgba(68, 68, 255, ${0.6 + Math.sin(time * 2) * 0.2})`);
                gradient.addColorStop(0.5, `rgba(68, 68, 255, ${0.8 + Math.sin(time * 2) * 0.2})`);
                gradient.addColorStop(1, `rgba(68, 68, 255, ${0.6 + Math.sin(time * 2) * 0.2})`);
                ctx.fillStyle = gradient;
            } else {
                ctx.fillStyle = i === this.menuPosition ? "#4444ff" : "transparent";
            }

            ctx.fillRect(10, Game.HEIGHT - 140 + i * 35, 100, 30);

            // Add glow effect when hovered
            if (isHovered) {
                ctx.save();
                ctx.shadowColor = "#8888ff";
                ctx.shadowBlur = 15;
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.strokeRect(10, Game.HEIGHT - 140 + i * 35, 100, 30);
                ctx.restore();
            } else {
                ctx.strokeStyle = "#ffffff";
                ctx.strokeRect(10, Game.HEIGHT - 140 + i * 35, 100, 30);
            }

            // Enhanced text rendering
            if (isHovered) {
                ctx.save();
                ctx.shadowColor = "#ffffff";
                ctx.shadowBlur = 10;
            }
            ctx.fillStyle = isHovered ? "#ffff88" : "#ffffff";
            ctx.font = isHovered ? "bold 16px monospace" : "16px monospace";
            ctx.textAlign = "left";
            ctx.fillText(cmd, 20, Game.HEIGHT - 120 + i * 35);
            if (isHovered) ctx.restore();
        });

        // Enhanced magic menu
        if (this.currentMenu === "magic") {
            const spells = this.activeChar.spells;
            const totalSpells = spells.length;
            const totalPages = Math.ceil(totalSpells / this.maxVisibleSpells);
            const currentPage = Math.floor(this.spellScrollOffset / this.maxVisibleSpells);
            const visibleSpells = Math.min(this.maxVisibleSpells, totalSpells);

            // Define layout constants
            const gap = 10;
            const baseX = 120;
            const columnWidth = 150;
            //const arrowX = baseX + (2 * (columnWidth + gap + 6));

            ///// THIS IS THE WHITE ARROWs VISUALs////////
            // Draw page navigation arrows
            // In drawBattleMenu() - apply the offset when drawing like other elements:
            if (totalSpells > this.maxVisibleSpells) {
                const arrowX = 455;
                const arrowSize = 15;

                // Up arrow
                if (currentPage > 0) {
                    ctx.fillStyle = this.upArrowHovered ? "#ffff88" : "#ffffff";
                    if (this.upArrowHovered) {
                        ctx.shadowColor = "#ffffff";
                        ctx.shadowBlur = 10;
                    }

                    ctx.beginPath();
                    ctx.moveTo(arrowX, Game.HEIGHT - 130); // Top point
                    ctx.lineTo(arrowX - arrowSize, Game.HEIGHT - 110); // Bottom left
                    ctx.lineTo(arrowX + arrowSize, Game.HEIGHT - 110); // Bottom right
                    ctx.closePath();
                    ctx.fill();
                    if (this.upArrowHovered) {
                        ctx.shadowBlur = 0;
                    }
                }

                // Page indicator centered between arrows
                ctx.fillStyle = "#ffffff";
                ctx.font = "14px monospace";
                ctx.textAlign = "center";
                ctx.fillText("Page", arrowX, Game.HEIGHT - 80);
                ctx.fillText(`${currentPage + 1}/${totalPages}`, arrowX, Game.HEIGHT - 57);

                // Down arrow
                if (currentPage < totalPages - 1) {
                    ctx.fillStyle = this.downArrowHovered ? "#ffff88" : "#ffffff";
                    if (this.downArrowHovered) {
                        ctx.shadowColor = "#ffffff";
                        ctx.shadowBlur = 10;
                    }

                    ctx.beginPath();
                    ctx.moveTo(arrowX, Game.HEIGHT - 15); // Bottom point
                    ctx.lineTo(arrowX - arrowSize, Game.HEIGHT - 35); // Top left
                    ctx.lineTo(arrowX + arrowSize, Game.HEIGHT - 35); // Top right
                    ctx.closePath();
                    ctx.fill();

                    if (this.downArrowHovered) {
                        ctx.shadowBlur = 0;
                    }
                }
            }

            // Draw visible spells - rewrite the entire spell drawing section
            for (let i = 0; i < visibleSpells; i++) {
                const spellIndex = i + this.spellScrollOffset;
                if (spellIndex >= totalSpells) break;

                const spellId = spells[spellIndex];
                const spell = SPELLS[spellId];
                const isHovered = this.hoveredSpell === spell;
                const isSelected = spellIndex === this.subMenuPosition;

                const spellCol = Math.floor(i / 4);
                const spellRow = i % 4;
                const spellX = baseX + spellCol * (columnWidth + gap);
                const spellY = Game.HEIGHT - 140 + spellRow * 35;

                // Draw background rectangle
                if (isHovered) {
                    const time = Date.now() / 1000;
                    const gradient = ctx.createLinearGradient(spellX, spellY, spellX + columnWidth, spellY + 30);
                    gradient.addColorStop(0, `rgba(68, 68, 255, ${0.6 + Math.sin(time * 2) * 0.2})`);
                    gradient.addColorStop(0.5, `rgba(68, 68, 255, ${0.8 + Math.sin(time * 2) * 0.2})`);
                    gradient.addColorStop(1, `rgba(68, 68, 255, ${0.6 + Math.sin(time * 2) * 0.2})`);
                    ctx.fillStyle = gradient;
                } else if (isSelected) {
                    ctx.fillStyle = "#4444ff";
                } else {
                    ctx.fillStyle = "transparent";
                }

                ctx.fillRect(spellX, spellY, columnWidth, 30);
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.strokeRect(spellX, spellY, columnWidth, 30);

                if (isHovered) {
                    ctx.save();
                    ctx.shadowColor = "#ffffff";
                    ctx.shadowBlur = 10;
                }

                ctx.fillStyle = isHovered ? "#ffff88" : "#ffffff";
                ctx.font = isHovered ? "bold 16px monospace" : "16px monospace";
                ctx.textAlign = "left";
                // The key fix is here - use spellX + 10 instead of just baseX + 10
                ctx.fillText(
                    `${spell.name} (${spell.mpCost} MP)`,
                    spellX + 10, // This ensures text aligns with its column
                    spellY + 20
                );

                if (isHovered) {
                    ctx.restore();
                }
            }
        }

        if (this.currentMenu === "item") {
            this.drawItemMenu(ctx);
        }
    }

    drawItemMenu(ctx) {
        const availableItems = this.partyInventory.getAvailableItems();
        const totalItems = availableItems.length;
        const totalPages = Math.ceil(totalItems / this.maxVisibleItems);
        const currentPage = Math.floor(this.itemScrollOffset / this.maxVisibleItems);
        const visibleItems = Math.min(this.maxVisibleItems, totalItems);

        // Define layout constants
        const gap = 10;
        const baseX = 120;
        const columnWidth = 150;

        // Draw visible items
        for (let i = 0; i < visibleItems; i++) {
            const itemIndex = i + this.itemScrollOffset;
            if (itemIndex >= totalItems) break;

            const itemData = availableItems[itemIndex];
            const isHovered = this.hoveredItem === itemData;
            const isSelected = itemIndex === this.subMenuPosition;

            const itemCol = Math.floor(i / 4);
            const itemRow = i % 4;
            const itemX = baseX + itemCol * (columnWidth + gap);
            const itemY = Game.HEIGHT - 140 + itemRow * 35;

            // Draw background rectangle
            if (isHovered) {
                const time = Date.now() / 1000;
                const gradient = ctx.createLinearGradient(itemX, itemY, itemX + columnWidth, itemY + 30);
                gradient.addColorStop(0, `rgba(68, 68, 255, ${0.6 + Math.sin(time * 2) * 0.2})`);
                gradient.addColorStop(0.5, `rgba(68, 68, 255, ${0.8 + Math.sin(time * 2) * 0.2})`);
                gradient.addColorStop(1, `rgba(68, 68, 255, ${0.6 + Math.sin(time * 2) * 0.2})`);
                ctx.fillStyle = gradient;
            } else if (isSelected) {
                ctx.fillStyle = "#4444ff";
            } else {
                ctx.fillStyle = "transparent";
            }

            ctx.fillRect(itemX, itemY, columnWidth, 30);
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.strokeRect(itemX, itemY, columnWidth, 30);

            if (isHovered) {
                ctx.save();
                ctx.shadowColor = "#ffffff";
                ctx.shadowBlur = 10;
            }

            ctx.fillStyle = isHovered ? "#ffff88" : "#ffffff";
            ctx.font = isHovered ? "bold 16px monospace" : "16px monospace";
            ctx.textAlign = "left";
            ctx.fillText(`${itemData.item.emoji} ${itemData.item.name} (${itemData.quantity})`, itemX + 10, itemY + 20);

            if (isHovered) {
                ctx.restore();
            }
        }

        // Draw page navigation arrows (reuse the same code from magic menu)
        if (totalItems > this.maxVisibleItems) {
            const arrowX = 455;
            const arrowSize = 15;

            // Up arrow
            if (currentPage > 0) {
                ctx.fillStyle = this.upArrowHovered ? "#ffff88" : "#ffffff";
                if (this.upArrowHovered) {
                    ctx.shadowColor = "#ffffff";
                    ctx.shadowBlur = 10;
                }

                ctx.beginPath();
                ctx.moveTo(arrowX, Game.HEIGHT - 130);
                ctx.lineTo(arrowX - arrowSize, Game.HEIGHT - 110);
                ctx.lineTo(arrowX + arrowSize, Game.HEIGHT - 110);
                ctx.closePath();
                ctx.fill();
                if (this.upArrowHovered) {
                    ctx.shadowBlur = 0;
                }
            }

            // Page indicator
            ctx.fillStyle = "#ffffff";
            ctx.font = "14px monospace";
            ctx.textAlign = "center";
            ctx.fillText("Page", arrowX, Game.HEIGHT - 80);
            ctx.fillText(`${currentPage + 1}/${totalPages}`, arrowX, Game.HEIGHT - 57);

            // Down arrow
            if (currentPage < totalPages - 1) {
                ctx.fillStyle = this.downArrowHovered ? "#ffff88" : "#ffffff";
                if (this.downArrowHovered) {
                    ctx.shadowColor = "#ffffff";
                    ctx.shadowBlur = 10;
                }

                ctx.beginPath();
                ctx.moveTo(arrowX, Game.HEIGHT - 15);
                ctx.lineTo(arrowX - arrowSize, Game.HEIGHT - 35);
                ctx.lineTo(arrowX + arrowSize, Game.HEIGHT - 35);
                ctx.closePath();
                ctx.fill();

                if (this.downArrowHovered) {
                    ctx.shadowBlur = 0;
                }
            }
        }
    }

    showBattleMessage(message) {
        this.currentMessage = {
            text: message,
            alpha: 1.0,
            startTime: Date.now()
        };
    }

    drawMessages(ctx) {
        if (this.currentMessage) {
            // Calculate how long the message has been showing
            const messageAge = Date.now() - this.currentMessage.startTime;

            // Start fading after 1 second
            if (messageAge > 1000) {
                this.currentMessage.alpha = Math.max(0, 1 - (messageAge - 1000) / 1000);
            }

            // Draw the message
            ctx.fillStyle = `rgba(255,255,255,${this.currentMessage.alpha})`;
            ctx.font = "20px monospace";
            ctx.textAlign = "center";
            ctx.fillText(this.currentMessage.text, Game.WIDTH / 2, 50);

            // Remove message when fully faded
            if (this.currentMessage.alpha <= 0) {
                this.currentMessage = null;
            }
        }
    }

    drawTransition(ctx) {
        ctx.fillStyle = `rgba(0,0,0,${this.transitionProgress})`;
        ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);

        if (this.state === "victory" || this.state === "gameover") {
            ctx.fillStyle = "#fff";
            ctx.font = "48px monospace";
            ctx.textAlign = "center";
            ctx.fillText(this.state.toUpperCase(), Game.WIDTH / 2, Game.HEIGHT / 2);
        }
    }
}