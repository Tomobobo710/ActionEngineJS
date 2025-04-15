// game/mode/battle/classes/battleactionexecutor.js
class BattleActionExecutor {
    constructor(battleSystem) {
        this.battle = battleSystem;
        this.pendingEffect = null;
        this.isProcessingAction = false;
    }

    // For attacks
    executeAttack(attack) {
        if (!attack || !attack.character || !attack.target) return;

        this.isProcessingAction = true;
        this.battle.animations.push(
            new AttackAnimation(attack.character, attack.target, this.battle.enemies.includes(attack.character))
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
            this.battle.battleLog.addMessage(message, "damage");
            this.battle.showBattleMessage(message);

            this.battle.audio.play("sword_hit");
            this.isProcessingAction = false;
        };
    }

    // For spells
    executeSpell(action) {
        if (!action || !action.spell || !action.character || !action.target) return;

        this.isProcessingAction = true;

        // Add animations first
        const isEnemy = this.battle.enemies.includes(action.character);

        if (action.isGroupTarget) {
            const targets = Array.isArray(action.target) ? action.target : [action.target];
            
            // For group targets, only the first animation should show darkening
            // so we'll mark all subsequent ones as group animations
            let isFirstTarget = true;
            
            targets.forEach((target) => {
                if (!target.isDead) {
                    this.battle.animations.push(
                        new SpellAnimation(action.spell.animation, target.pos, action.character, isEnemy, !isFirstTarget)
                    );
                    isFirstTarget = false;
                }
            });
        } else {
            this.battle.animations.push(
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
            let totalAmount = 0;
            let targetMessage;
            let effectType;

            // Check if this is a healing spell or damage spell
            const isHealingSpell = action.spell.effect === "heal";
            
            if (action.isGroupTarget) {
                const targets = Array.isArray(action.target) ? action.target : [action.target];
                targets.forEach((target) => {
                    if (!target.isDead) {
                        // Process differently based on spell effect type
                        if (isHealingSpell) {
                            // For healing spells
                            const healAmount = this.calculateSpellDamage(action.character, action.spell, target);
                            totalAmount += healAmount;

                            // Start HP animation for healing
                            target.animatingHP = true;
                            target.targetHP = Math.min(target.maxHp, target.hp + healAmount);
                            target.hpAnimStartTime = Date.now();
                        } else {
                            // For damage spells (original behavior)
                            const damage = this.calculateSpellDamage(action.character, action.spell, target);
                            totalAmount += damage;

                            // Start HP animation for damage
                            target.animatingHP = true;
                            target.targetHP = Math.max(0, target.hp - damage);
                            target.hpAnimStartTime = Date.now();
                        }
                    }
                });
                
                // Target message based on who's being targeted
                targetMessage = this.battle.currentTargetGroup === "allies" ? "all allies" : "all enemies";
            } else {
                // Handle single target
                if (isHealingSpell) {
                    // For healing spells
                    const healAmount = this.calculateSpellDamage(action.character, action.spell, action.target);
                    totalAmount = healAmount;

                    // Start HP animation for healing
                    action.target.animatingHP = true;
                    action.target.targetHP = Math.min(action.target.maxHp, action.target.hp + healAmount);
                    action.target.hpAnimStartTime = Date.now();
                } else {
                    // For damage spells (original behavior)
                    const damage = this.calculateSpellDamage(action.character, action.spell, action.target);
                    totalAmount = damage;

                    // Start HP animation for damage
                    action.target.animatingHP = true;
                    action.target.targetHP = Math.max(0, action.target.hp - damage);
                    action.target.hpAnimStartTime = Date.now();
                }

                targetMessage = action.target.name;
            }

            // Play appropriate sound and create message
            if (isHealingSpell) {
                this.battle.audio.play("heal");
                const message = `${action.character.name} casts ${action.spell.name} on ${targetMessage}, restoring ${totalAmount} HP!`;
                this.battle.battleLog.addMessage(message, "heal");
                this.battle.showBattleMessage(message);
            } else {
                this.battle.audio.play("magic_cast");
                const message = `${action.character.name} casts ${action.spell.name} on ${targetMessage} for ${totalAmount} damage!`;
                this.battle.battleLog.addMessage(message, "damage");
                this.battle.showBattleMessage(message);
            }

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
                this.battle.animations.push(new ItemAnimation(action.item.animation, target.pos, action.character));
            });
        } else {
            this.battle.animations.push(new ItemAnimation(action.item.animation, action.target.pos, action.character));
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
                    this.battle.audio.play("heal");
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
                } else if (action.item.name.toLowerCase().includes("phoenix")) {
                    // Special handling for phoenix
                    const success = action.target.revive(50); // Revive with 50% HP
                    if (success) {
                        effectMessage = " bringing them back to life!";
                        this.battle.audio.play("heal");
                    } else {
                        effectMessage = " but it had no effect!";
                    }
                }
                targetMessage = action.target.name;
            }

            const itemId = Object.keys(ITEMS).find((id) => ITEMS[id] === action.item);

            // Check if action is from an enemy or player character
            if (this.battle.enemies.includes(action.character)) {
                // Enemy used an item - we already removed it when queueing the action
                // No need to remove from inventory again
            } else {
                // Player used an item
                this.battle.partyInventory.removeItem(itemId);
            }

            const message = `${action.character.name} used ${action.item.name} on ${targetMessage}${effectMessage}!`;
            this.battle.battleLog.addMessage(message, action.item.name.toLowerCase().includes("potion") ? "heal" : "damage");
            this.battle.showBattleMessage(message);

            this.isProcessingAction = false;
        };
    }

    // Helper calculation methods
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

    // Animation handling
    handleAnimations() {
        // Update and filter battle animations
        this.battle.animations = this.battle.animations.filter((anim) => {
            anim.update();
            return !anim.finished;
        });
    }

    // Process the next action in the queue
    processNextAction() {
        const nextAction = this.battle.actionQueue[0];
        this.isProcessingAction = true;

        // Verify the character and target are still valid before executing action
        if (nextAction.character.isDead) {
            // Skip actions for dead characters
            this.battle.actionQueue.shift();
            this.isProcessingAction = false;
            return;
        }

        // For single target actions, check if the target is dead (unless using Phoenix)
        if (!nextAction.isGroupTarget && 
            nextAction.target.isDead && 
            !(nextAction.type === "item" && nextAction.item && nextAction.item.name === "Phoenix")) {
            // Skip actions with dead targets (except for Phoenix item)
            const message = `${nextAction.character.name}'s action failed - target is no longer valid!`;
            this.battle.battleLog.addMessage(message, "system");
            this.battle.showBattleMessage(message);
            this.battle.actionQueue.shift();
            this.isProcessingAction = false;
            return;
        }

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

        this.battle.actionQueue.shift();
    }

    // Getters
    isCurrentlyProcessing() {
        return this.isProcessingAction;
    }

    getPendingEffect() {
        return this.pendingEffect;
    }

    clearPendingEffect() {
        this.pendingEffect = null;
    }
}
