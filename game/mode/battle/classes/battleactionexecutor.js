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
        
        // Check for blindness - if blind, high chance to miss
        if (attack.character.status.blind > 0) {
            // 75% chance to miss when blind
            const attackResult = attack.character.attack(attack.target);
            
            if (!attackResult.success && attackResult.reason === "blind") {
                const message = `${attack.character.name} attacks but misses due to blindness!`;
                this.battle.battleLog.addMessage(message, "miss");
                this.battle.showBattleMessage(message);
                this.battle.audio.play("menu_error"); // Use error sound for miss
                
                // Add MISS floating text
                this.battle.damageNumbers.push({
                    x: attack.target.pos.x,
                    y: attack.target.pos.y,
                    amount: "MISS!",
                    type: "blind",
                    startTime: Date.now(),
                    duration: 1500
                });
                
                this.isProcessingAction = false;
                return;
            }
        }
        
        // If we're here, the attack should proceed with animation
        this.battle.animations.push(
            new AttackAnimation(attack.character, attack.target, this.battle.enemies.includes(attack.character))
        );

        // Store the pending effect to apply after animation completes
        this.pendingEffect = () => {
            const attackResult = attack.character.attack(attack.target);
            
            if (attackResult.success) {
                // Start the HP animation
                attack.target.animatingHP = true;
                attack.target.targetHP = Math.max(0, attack.target.hp - attackResult.damage);
                attack.target.hpAnimStartTime = Date.now();

                // Add floating damage number
                this.battle.damageNumbers.push({
                    x: attack.target.pos.x,
                    y: attack.target.pos.y,
                    amount: attackResult.damage,
                    type: "physical", // Red for physical damage
                    startTime: Date.now(),
                    duration: 1500
                });
                const message = `${attack.character.name} attacks ${attack.target.name} for ${attackResult.damage} damage! (Turn ${this.battle.turnCounter})`;
                this.battle.battleLog.addMessage(message, "damage");
                this.battle.showBattleMessage(message);
                this.battle.audio.play("sword_hit");
            } else {
                // If attack failed for some reason
                const message = `${attack.character.name}'s attack on ${attack.target.name} failed!`;
                this.battle.battleLog.addMessage(message, "miss");
                this.battle.showBattleMessage(message);
                this.battle.audio.play("menu_error");
            }
            
            this.isProcessingAction = false;
        };
    }

    // For spells
    executeSpell(action) {
        if (!action || !action.spell || !action.character || !action.target) return;

        // Check for silence status effect
        if (action.character.status.silence > 0) {
            // Show feedback when silenced
            const message = `${action.character.name} tried to cast ${action.spell.name} but is silenced!`;
            this.battle.battleLog.addMessage(message, "miss");
            this.battle.showBattleMessage(message);
            this.battle.audio.play("menu_error");
            
            // Add SILENCE floating text
            this.battle.damageNumbers.push({
                x: action.character.pos.x,
                y: action.character.pos.y,
                amount: "SILENCED!",
                type: "silence",
                startTime: Date.now(),
                duration: 1500
            });
            
            // Remove from ready queue
            if (this.battle.readyOrder.includes(action.character)) {
                this.battle.readyOrder.shift();
            }
            
            this.isProcessingAction = false;
            return;
        }
        
        // Check for MP cost
        if (action.character.mp < action.spell.mpCost) {
            const message = `${action.character.name} tried to cast ${action.spell.name} but doesn't have enough MP!`;
            this.battle.battleLog.addMessage(message, "miss");
            this.battle.showBattleMessage(message);
            this.battle.audio.play("menu_error");
            
            // Remove from ready queue
            if (this.battle.readyOrder.includes(action.character)) {
                this.battle.readyOrder.shift();
            }
            
            this.isProcessingAction = false;
            return;
        }

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
            // Cast the spell and get results
            let spellResult;
            
            if (action.isGroupTarget) {
                const targets = Array.isArray(action.target) ? action.target : [action.target];
                // For group targets, we need to handle each target separately
                let totalAmount = 0;
                let success = false;
                
                targets.forEach(target => {
                    if (!target.isDead) {
                        const result = action.character.castSpell(action.spell, target);
                        if (result.success) {
                            success = true;
                            totalAmount += result.effect;
                            
                            // Process effect based on spell type
                            this.handleSpellEffectVisualization(target, action.spell, result);
                        }
                    }
                });
                
                spellResult = { 
                    success: success,
                    effect: totalAmount, 
                    type: action.spell.effect
                };
                
            } else {
                // For single target
                spellResult = action.character.castSpell(action.spell, action.target);
                
                if (spellResult.success) {
                    // Process effect based on spell type
                    this.handleSpellEffectVisualization(action.target, action.spell, spellResult);
                }
            }
            
            // MP cost for caster (animate MP decrease)
            if (spellResult.success) {
                action.character.animatingMP = true;
                action.character.targetMP = Math.max(0, action.character.mp);
                action.character.mpAnimStartTime = Date.now();
                
                // Create appropriate message
                let message;
                let targetMessage = action.isGroupTarget ? 
                    (this.battle.currentTargetGroup === "allies" ? "all allies" : "all enemies") : 
                    action.target.name;
                
                // Add turn information to all messages
                const turnInfo = ` (Turn ${this.battle.turnCounter})`;
                
                if (action.spell.effect === "heal") {
                    this.battle.audio.play("heal");
                    message = `${action.character.name} casts ${action.spell.name} on ${targetMessage}, restoring ${spellResult.effect} HP!${turnInfo}`;
                    this.battle.battleLog.addMessage(message, "heal");
                } else if (action.spell.effect === "status") {
                    this.battle.audio.play("magic_cast");
                    message = `${action.character.name} casts ${action.spell.name} on ${targetMessage}!${turnInfo}`;
                    this.battle.battleLog.addMessage(message, "status");
                } else {
                    this.battle.audio.play("magic_cast");
                    message = `${action.character.name} casts ${action.spell.name} on ${targetMessage} for ${spellResult.effect} damage!${turnInfo}`;
                    this.battle.battleLog.addMessage(message, "damage");
                }            } else {
                // Spell failed
                let message;
                if (spellResult.reason === "silence") {
                    message = `${action.character.name} tried to cast ${action.spell.name} but is silenced!`;
                } else if (spellResult.reason === "mp") {
                    message = `${action.character.name} tried to cast ${action.spell.name} but doesn't have enough MP!`;
                } else {
                    message = `${action.character.name}'s spell ${action.spell.name} failed!`;
                }
                
                this.battle.battleLog.addMessage(message, "miss");
                this.battle.showBattleMessage(message);
                this.battle.audio.play("menu_error");
            }

            this.isProcessingAction = false;
        };
    }
    // Helper to handle spell effect visualization
    handleSpellEffectVisualization(target, spell, spellResult) {
        if (spell.effect === "heal") {
            // Healing effect
            const healAmount = spellResult.effect;
            
            // Start HP animation for healing
            target.animatingHP = true;
            target.targetHP = Math.min(target.maxHp, target.hp);
            target.hpAnimStartTime = Date.now();
            
            // Add heal number (green)
            this.battle.damageNumbers.push({
                x: target.pos.x,
                y: target.pos.y,
                amount: healAmount,
                type: "heal", // Green for healing
                startTime: Date.now(),
                duration: 1500
            });
        } else if (spell.effect === "status") {
            // Status effect applied - check if we have effects info
            if (spellResult.effectsApplied && spellResult.effectsApplied.length > 0) {
                // Show status effect notifications for each effect applied
                spellResult.effectsApplied.forEach((effect, index) => {
                    // Enhanced visual feedback for status effects
                    this.battle.damageNumbers.push({
                        x: target.pos.x,
                        y: target.pos.y - (index * 20), // Offset multiple effects
                        amount: effect.status.toUpperCase(),
                        type: effect.status,
                        startTime: Date.now() + (index * 200), // Stagger the timing
                        duration: 1500
                    });
                    
                    // Add the emoji indicator for the status type
                    let emoji = "";
                    switch(effect.status) {
                        case "poison": emoji = "☠️"; break;
                        case "blind": emoji = "👁️"; break;
                        case "silence": emoji = "🤐"; break;
                        default: emoji = "⚠️"; break;
                    }
                    
                    // Add a secondary visual effect
                    this.battle.damageNumbers.push({
                        x: target.pos.x + (Math.random() * 20 - 10),
                        y: target.pos.y - (index * 20) + (Math.random() * 10 - 5),
                        amount: emoji,
                        type: effect.status,
                        startTime: Date.now() + (index * 200) + 150, // Slight delay
                        duration: 1200
                    });
                    
                    // Log to battle text
                    this.battle.battleLog.addMessage(
                        `${target.name} is afflicted with ${effect.status.toUpperCase()}!`, 
                        "status"
                    );
                });
            } else {
                // Fallback for old behavior - just use the spell's defined status effects
                spell.statusEffects.forEach((effect, index) => {
                    // Enhanced visual feedback for status effects
                    this.battle.damageNumbers.push({
                        x: target.pos.x,
                        y: target.pos.y - (index * 20),
                        amount: effect.type.toUpperCase(),
                        type: effect.type,
                        startTime: Date.now() + (index * 200),
                        duration: 1500
                    });
                    
                    // Add the emoji indicator for the status type
                    let emoji = "";
                    switch(effect.type) {
                        case "poison": emoji = "☠️"; break;
                        case "blind": emoji = "👁️"; break;
                        case "silence": emoji = "🤐"; break;
                        default: emoji = "⚠️"; break;
                    }
                    
                    // Add a secondary visual effect
                    this.battle.damageNumbers.push({
                        x: target.pos.x + (Math.random() * 20 - 10),
                        y: target.pos.y - (index * 20) + (Math.random() * 10 - 5),
                        amount: emoji,
                        type: effect.type,
                        startTime: Date.now() + (index * 200) + 150, // Slight delay
                        duration: 1200
                    });
                });
            }
        } else {
            // Damage spell
            const damage = spellResult.effect;
            
            // Start HP animation for damage
            target.animatingHP = true;
            target.targetHP = Math.max(0, target.hp);
            target.hpAnimStartTime = Date.now();
            
            // Add damage number (yellow for magic)
            this.battle.damageNumbers.push({
                x: target.pos.x,
                y: target.pos.y,
                amount: damage,
                type: "magical", // Yellow for magic
                startTime: Date.now(),
                duration: 1500
            });
        }
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
                        
                        // Add heal number
                        this.battle.damageNumbers.push({
                            x: target.pos.x,
                            y: target.pos.y,
                            amount: healAmount,
                            type: "heal", // Green for healing
                            startTime: Date.now(),
                            duration: 1500
                        });
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
                        
                        // Add damage number
                        this.battle.damageNumbers.push({
                            x: target.pos.x,
                            y: target.pos.y,
                            amount: damage,
                            type: "physical", // Red for physical
                            startTime: Date.now(),
                            duration: 1500
                        });
                    }
                });
                targetMessage = "all allies";
            } else {
                // Single target items
                if (action.item.name.toLowerCase().includes("potion")) {
                    const healAmount = this.calculateHealAmount(action.target, action.item);
                    totalHealing = healAmount;

                    // Animate HP increase
                    action.target.animatingHP = true;
                    action.target.targetHP = Math.min(action.target.maxHp, action.target.hp + healAmount);
                    action.target.hpAnimStartTime = Date.now();
                    
                    // Add heal number
                    this.battle.damageNumbers.push({
                        x: action.target.pos.x,
                        y: action.target.pos.y,
                        amount: healAmount,
                        type: "heal", // Green for healing
                        startTime: Date.now(),
                        duration: 1500
                    });

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
                    
                    // Add damage number
                    this.battle.damageNumbers.push({
                        x: action.target.pos.x,
                        y: action.target.pos.y,
                        amount: damage,
                        type: "physical", // Red for physical
                        startTime: Date.now(),
                        duration: 1500
                    });

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
                } else if (action.item.name.toLowerCase().includes("poison")) {
                    // Apply poison status effect
                    action.target.addStatus("poison", 5);
                    effectMessage = " inflicting poison!";
                    
                    // Show effect with purple text
                    this.battle.damageNumbers.push({
                        x: action.target.pos.x,
                        y: action.target.pos.y,
                        amount: "POISON",
                        type: "poison", // Purple for poison
                        startTime: Date.now(),
                        duration: 1500
                    });
                } else if (action.item.name.toLowerCase().includes("smoke")) {
                    // Apply blind status effect
                    action.target.addStatus("blind", 3);
                    effectMessage = " causing blindness!";
                    
                    // Show effect
                    this.battle.damageNumbers.push({
                        x: action.target.pos.x,
                        y: action.target.pos.y,
                        amount: "BLIND",
                        type: "blind", // Gray for blind
                        startTime: Date.now(),
                        duration: 1500
                    });
                } else if (action.item.name.toLowerCase().includes("silence")) {
                    // Apply silence status effect
                    action.target.addStatus("silence", 4);
                    effectMessage = " silencing their magic!";
                    
                    // Show effect
                    this.battle.damageNumbers.push({
                        x: action.target.pos.x,
                        y: action.target.pos.y,
                        amount: "SILENCE",
                        type: "silence", // Light blue for silence
                        startTime: Date.now(),
                        duration: 1500
                    });
                } else if (action.item.name.toLowerCase().includes("antidote")) {
                    // Cure poison
                    const success = action.target.removeStatus("poison");
                    effectMessage = success ? " curing poison!" : " but it had no effect!";
                } else if (action.item.name.toLowerCase().includes("remedy")) {
                    // Cure all status effects
                    const success = action.target.removeAllStatus();
                    effectMessage = success ? " curing all status effects!" : " but it had no effect!";
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

            const message = `${action.character.name} used ${action.item.name} on ${targetMessage}${effectMessage}! (Turn ${this.battle.turnCounter})`;
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