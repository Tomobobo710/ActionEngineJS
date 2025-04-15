// game/mode/battle/classes/character.js
class Character {
    constructor(data) {
        this.name = data.name;
        this.type = data.type;
        this.level = data.level || 1;
        this.maxHp = data.maxHp || 100;
        this.hp = data.hp || this.maxHp;
        this.maxMp = data.maxMp || 50;
        this.mp = data.mp || this.maxMp;
        this.strength = data.strength || 10;
        this.magic = data.magic || 10;
        this.speed = data.speed || 10;
        this.sprite = data.sprite;
        this.xp = data.xp || 0;
        this.nextLevelXp = this.calculateNextLevelXp();

        // ATB (Active Time Battle) properties
        this.atbMax = 100;
        this.atbCurrent = 0;
        this.isReady = false;

        this.animatingHP = false;
        this.animatingMP = false;
        this.targetHP = this.hp;
        this.targetMP = this.mp;
        this.hpAnimStartTime = 0;
        this.mpAnimStartTime = 0;
        this.hpAnimProgress = 0;
        this.mpAnimProgress = 0;

        // Menu state tracking
        this.menuState = {
            lastAction: null, // 'fight', 'magic', 'item', etc
            lastSpellIndex: 0, // For magic menu
            lastItemIndex: 0, // For item menu
            lastTarget: null, // Store target reference
            menuColumn: 0, // Current column in menus
            menuPosition: 0 // Current position in menus
        };

        // Status effects
        this.status = {
            poison: data.status?.poison || 0,
            blind: data.status?.blind || 0,
            silence: data.status?.silence || 0
        };
        
        // Status effect timers for world/menu mode
        this.statusTimers = {
            poison: 0,
            blind: 0,
            silence: 0
        };

        // Animation properties
        this.pos = { x: 0, y: 0 };
        this.targetPos = { x: 0, y: 0 };
        this.animating = false;
        this.animFrame = 0;

        // Battle state
        this.isDead = data.isDead || false;
        this.isDefending = false;
        this.currentTarget = null;

        // Skills/spells known
        this.skills = data.skills || ["Attack"];
        this.spells = data.spells || [];

        // Equipment & stats
        this.equipment = {
            weapon: null,
            armor: null,
            accessory: null
        };

        // Calculated stats
        this.stats = {
            attack: 0,
            defense: 0,
            magicAttack: 0,
            magicDefense: 0,
            accuracy: 0,
            evasion: 0
        };

        this.calculateStats();
    }

    calculateNextLevelXp() {
        // Common RPG formula: base + (level * modifier)
        const baseXp = 100;
        const modifier = 50;
        return baseXp + this.level * modifier;
    }

    gainXp(amount) {
        if (this.isDead) return { gained: 0, leveledUp: false, oldXp: this.xp, newXp: this.xp };

        const oldXp = this.xp;
        this.xp += amount;

        // Check for level up
        let leveledUp = false;

        // Only attempt to level up if we've reached the threshold
        if (this.xp >= this.nextLevelXp) {
            this.levelUp();
            leveledUp = true;

            // Log values for debugging
            console.log(`${this.name} leveled up to ${this.level}, XP: ${this.xp}/${this.nextLevelXp}`);
        }

        return {
            gained: amount,
            leveledUp: leveledUp,
            oldXp: oldXp,
            newXp: this.xp
        };
    }

    levelUp() {
        this.level++;

        // Increase stats (you can adjust these values)
        this.maxHp += Math.floor(this.maxHp * 0.1) + 10;
        this.maxMp += Math.floor(this.maxMp * 0.1) + 5;
        this.strength += 2 + Math.floor(Math.random() * 2);
        this.magic += 2 + Math.floor(Math.random() * 2);
        this.speed += 1 + Math.floor(Math.random() * 2);

        // Restore HP and MP on level up
        this.hp = this.maxHp;
        this.mp = this.maxMp;

        // Calculate new XP threshold
        this.nextLevelXp = this.calculateNextLevelXp();
    }

    getXpProgress() {
        if (this.level === 1) {
            // For level 1, start from 0
            return this.xp / this.nextLevelXp;
        } else {
            // For higher levels, calculate from previous level threshold
            const prevLevelXp = this.calculatePreviousLevelXp();
            return (this.xp - prevLevelXp) / (this.nextLevelXp - prevLevelXp);
        }
    }

    calculatePreviousLevelXp() {
        if (this.level === 1) return 0;
        const baseXp = 100;
        const modifier = 50;
        return baseXp + (this.level - 1) * modifier;
    }

    castSpell(spell, target) {
        if (this.mp < spell.mpCost) return { success: false, reason: "mp", effect: 0 };
        
        // Check for silence status effect
        if (this.status.silence > 0) {
            return { success: false, reason: "silence", effect: 0 };
        }

        this.mp -= spell.mpCost;

        // Handle different spell effects
        if (spell.effect === "heal") {
            // Healing spell 
            let power = Math.floor((this.stats.magicAttack * spell.power) / 10);
            const targets = Array.isArray(target) ? target : [target];
            let totalEffect = 0;

            targets.forEach((t) => {
                if (!t.isDead) {
                    totalEffect += t.heal(power);
                }
            });
            
            return { success: true, effect: totalEffect, type: "heal" };
        } 
        else if (spell.effect === "status") {
            // Status effect spell
            const targets = Array.isArray(target) ? target : [target];
            let success = false;
            let effectsApplied = [];
            
            targets.forEach((t) => {
                if (!t.isDead) {
                    // Apply all status effects defined in the spell
                    spell.statusEffects.forEach(effect => {
                        // Check if status effect application succeeds based on chance
                        if (Math.random() < effect.chance) {
                            const wasApplied = t.addStatus(effect.type, effect.duration);
                            success = true;
                            
                            if (wasApplied) {
                                effectsApplied.push({
                                    target: t,
                                    status: effect.type
                                });
                            }
                        }
                    });
                }
            });
            
            return { 
                success, 
                effect: 0, 
                type: "status",
                effectsApplied: effectsApplied 
            };
        }
        else {
            // Damage spell
            let power = Math.floor((this.stats.magicAttack * spell.power) / 10);
            const targets = Array.isArray(target) ? target : [target];
            let totalEffect = 0;

            targets.forEach((t) => {
                if (!t.isDead) {
                    let finalDamage = power;
                    if (t.weaknesses && t.weaknesses.includes(spell.element)) {
                        finalDamage = Math.floor(finalDamage * 1.5);
                    }
                    if (t.resistances && t.resistances.includes(spell.element)) {
                        finalDamage = Math.floor(finalDamage * 0.5);
                    }
                    totalEffect += t.takeDamage(finalDamage, "magical");
                }
            });

            return { success: true, effect: totalEffect, type: "damage" };
        }
    }

    calculateStats() {
        // Base stats
        this.stats.attack = this.strength;
        this.stats.defense = Math.floor(this.strength / 2);
        this.stats.magicAttack = this.magic;
        this.stats.magicDefense = Math.floor(this.magic / 2);
        this.stats.accuracy = 90 + Math.floor(this.speed / 2);
        this.stats.evasion = Math.floor(this.speed / 3);

        // Add equipment bonuses
        if (this.equipment.weapon) {
            this.stats.attack += this.equipment.weapon.attack || 0;
            this.stats.magicAttack += this.equipment.weapon.magicAttack || 0;
        }

        if (this.equipment.armor) {
            this.stats.defense += this.equipment.armor.defense || 0;
            this.stats.magicDefense += this.equipment.armor.magicDefense || 0;
        }

        if (this.equipment.accessory) {
            Object.keys(this.stats).forEach((stat) => {
                if (this.equipment.accessory[stat]) {
                    this.stats[stat] += this.equipment.accessory[stat];
                }
            });
        }
    }

    updateATB() {
        if (!this.isDead && !this.isReady) {
            // Divide speed by 30 instead of 10 to make it 3x slower
            this.atbCurrent += this.speed / 30;
            if (this.atbCurrent >= this.atbMax) {
                this.atbCurrent = this.atbMax;
                this.isReady = true;
                // Turn tracking happens in BattleSystem.updateATBGauges
            }
        }
    }    attack(target) {
        if (this.isDead || target.isDead) return { success: false, reason: "invalid", damage: 0 };
        
        // Check for blind status (75% chance to miss)
        if (this.status.blind > 0 && Math.random() < 0.75) {
            // Add "MISS" visual feedback
            if (target.pos) {
                // If we're in a battle context with target positions
                return { success: false, reason: "blind", damage: 0, effect: "miss" };
            } else {
                // If we're in a different context
                return { success: false, reason: "blind", damage: 0 };
            }
        }
        
        // Calculate damage
        let damage = Math.floor(this.stats.attack * 1.5);
        damage = Math.max(1, damage - target.stats.defense);
        
        // Apply damage
        const actualDamage = target.takeDamage(damage, "physical");
        return { success: true, damage: actualDamage };
    }

    takeDamage(amount, type = "physical") {
        if (this.isDead) return 0;

        let defense = type === "physical" ? this.stats.defense : this.stats.magicDefense;
        if (this.isDefending) defense *= 2;

        let damage = Math.max(1, amount - defense);
        this.hp = Math.max(0, this.hp - damage);

        if (this.hp === 0) {
            this.isDead = true;
            this.isReady = false;
            
            // Remove all status effects when a character dies
            this.removeAllStatus();
        }

        return damage;
    }

    heal(amount) {
        if (this.isDead) return 0;

        const oldHp = this.hp;
        this.hp = Math.min(this.maxHp, this.hp + amount);
        return this.hp - oldHp; // Return actual amount healed
    }

    useMP(amount) {
        if (this.mp < amount) return false;
        this.mp -= amount;
        return true;
    }

    addStatus(status, duration) {
        // Only apply the status if it exists in our status object
        if (this.status.hasOwnProperty(status)) {
            // Apply status with specified duration, keeping the longer duration
            this.status[status] = Math.max(this.status[status], duration);
            
            // Reset the status timer when newly applied
            this.statusTimers[status] = 0;
            
            // Return true if status was newly applied or extended
            const wasApplied = this.status[status] > 0;
            
            // Log status application for debugging
            console.log(`${this.name} ${wasApplied ? 'is now' : 'is still'} affected by ${status} for ${this.status[status]} turns`);
            
            return wasApplied;
        }
        
        // Status type not recognized
        console.warn(`Attempted to apply unknown status: ${status}`);
        return false;
    }

    removeAllStatus() {
        Object.keys(this.status).forEach((statusEffect) => {
            this.status[statusEffect] = 0;
            this.statusTimers[statusEffect] = 0;
        });
        return true;
    }

    removeStatus(statusName) {
        if (this.status[statusName]) {
            this.status[statusName] = 0;
            this.statusTimers[statusName] = 0;
            return true;
        }
        return false;
    }

    revive(percentHp) {
        if (!this.isDead) return false;
        this.isDead = false;
        this.hp = Math.floor(this.maxHp * (percentHp / 100));
        return true;
    }

    // Update status effects for both battle and world/menu modes
    updateStatus(context = {}) {
        // In battle mode, update every turn using battle reference
        if (context && context.damageNumbers) {
            this.updateBattleStatus(context);
        } 
        // In world/menu mode, update based on time
        else {
            this.updateWorldStatus(context?.deltaTime || 0, context?.context);
        }
    }
    
    updateBattleStatus(battle) {
        // Skip status updates if character is dead
        if (this.isDead) return;
        
        Object.keys(this.status).forEach((status) => {
            if (this.status[status] > 0) {
                // Apply status effects
                switch (status) {
                    case "poison":
                        // Calculate poison damage as 1/16 of max HP
                        const poisonDamage = Math.floor(this.maxHp / 16);
                        this.takeDamage(poisonDamage);
                        
                        // Add a visible damage number for poison with enhanced visuals
                        if (battle) {
                            // Add turn information to the battle log message
                            const turnInfo = battle.turnCounter ? ` (Turn ${battle.turnCounter})` : '';
                            
                            battle.damageNumbers.push({
                                x: this.pos.x,
                                y: this.pos.y,
                                amount: poisonDamage,
                                type: "poison",
                                startTime: Date.now(),
                                duration: 1500
                            });
                            
                            // Create a secondary visual effect to enhance the poison impact
                            battle.damageNumbers.push({
                                x: this.pos.x + (Math.random() * 20 - 10),
                                y: this.pos.y + (Math.random() * 10 - 5),
                                amount: "☠️",
                                type: "poison",
                                startTime: Date.now() + 200, // Slight delay for sequential effect
                                duration: 1000
                            });
                            
                            // Also add message to battle log
                            if (battle.battleLog) {
                                battle.battleLog.addMessage(`${this.name} takes ${poisonDamage} poison damage!${turnInfo}`, "damage");
                            }
                        }
                        break;

                    // Visual indicators for blind/silence are shown when actions are attempted
                    case "blind":
                        // Show blind effect reminder
                        if (battle) {
                            battle.damageNumbers.push({
                                x: this.pos.x,
                                y: this.pos.y - 15,
                                amount: "BLIND",
                                type: "blind",
                                startTime: Date.now(),
                                duration: 1000
                            });
                        }
                        break;
                    case "silence":
                        // Show silence effect reminder
                        if (battle) {
                            battle.damageNumbers.push({
                                x: this.pos.x,
                                y: this.pos.y - 15,
                                amount: "SILENCE",
                                type: "silence",
                                startTime: Date.now(),
                                duration: 1000
                            });
                        }
                        break;
                }
                
                // Decrease status effect duration at the end of each turn
                this.status[status]--;
                
                // Show status expiring message if it just expired
                if (this.status[status] === 0 && battle) {
                    battle.damageNumbers.push({
                        x: this.pos.x,
                        y: this.pos.y - 30,
                        amount: `${status.toUpperCase()} EXPIRED`,
                        type: status,
                        startTime: Date.now(),
                        duration: 1500
                    });
                    
                    // Also add message to battle log with turn counter
                    if (battle.battleLog) {
                        const turnInfo = battle.turnCounter ? ` (Turn ${battle.turnCounter})` : '';
                        battle.battleLog.addMessage(`${this.name}'s ${status} has worn off!${turnInfo}`, "system");
                    }
                }
            }
        });
    }
        
    // Get a snapshot of this character's current state for persistence
    getState() {
        return {
            name: this.name,
            type: this.type,
            level: this.level,
            hp: this.hp,
            maxHp: this.maxHp,
            mp: this.mp,
            maxMp: this.maxMp,
            strength: this.strength,
            magic: this.magic,
            speed: this.speed,
            xp: this.xp,
            nextLevelXp: this.nextLevelXp,
            skills: [...this.skills],
            spells: [...this.spells],
            status: { ...this.status },
            statusTimers: { ...this.statusTimers },
            isDead: this.isDead,
            // Include any equipment or other relevant data
            equipment: this.equipment ? JSON.parse(JSON.stringify(this.equipment)) : null
        };
    }
    
    // Apply a state snapshot to this character for persistence
    applyState(state) {
        if (!state) return;
        
        // Apply core stats
        this.hp = state.hp;
        this.mp = state.mp;
        this.isDead = state.isDead || false;
        
        // Copy status effects
        if (state.status) {
            Object.keys(this.status).forEach(statusType => {
                // Make sure we initialize all known status types
                this.status[statusType] = 0;
            });
            
            // Then apply any active status effects from the saved state
            Object.keys(state.status).forEach(statusType => {
                this.status[statusType] = state.status[statusType];
            });
        }
        
        // Copy status timers
        if (state.statusTimers) {
            Object.keys(this.statusTimers).forEach(statusType => {
                // Make sure we initialize all known timer types
                this.statusTimers[statusType] = 0;
            });
            
            // Then apply any active timers from the saved state
            Object.keys(state.statusTimers).forEach(statusType => {
                this.statusTimers[statusType] = state.statusTimers[statusType];
            });
        }
        
        // Apply equipment if present
        if (state.equipment) {
            this.equipment = JSON.parse(JSON.stringify(state.equipment));
            this.calculateStats(); // Recalculate stats with equipment
        }
    }

    // Modified updateWorldStatus method that connects with the World mode visualization
    updateWorldStatus(deltaTime, worldContext) {
        if (this.isDead) return;
        
        Object.keys(this.status).forEach((status) => {
            if (this.status[status] > 0) {
                // Update timers for non-battle status effects
                this.statusTimers[status] += deltaTime;
                
                // Every 3 seconds in world mode for poison
                if (status === "poison" && this.statusTimers[status] >= 3) {
                    this.statusTimers[status] = 0; // Reset timer
                    
                    // Apply poison damage (1/16 of max HP)
                    const poisonDamage = Math.floor(this.maxHp / 16);
                    this.hp = Math.max(1, this.hp - poisonDamage); // Never kill in world mode, just leave at 1 HP
                    
                    // Show damage number in world mode if possible
                    if (worldContext && typeof worldContext.showDamageNumber === 'function') {
                        worldContext.showDamageNumber(this, poisonDamage, "poison");
                    } else {
                        console.log(`${this.name} takes ${poisonDamage} poison damage in world mode`);
                    }
                }
                
                // If a status effect has been active for too long in world/menu mode,
                // decrease the duration (1 per 6 seconds)
                if (this.statusTimers[status] >= 6) {
                    this.statusTimers[status] = 0;
                    this.status[status]--;
                    
                    // Show status effect expiring in world mode if possible
                    if (this.status[status] === 0) {
                        if (worldContext && typeof worldContext.showDamageNumber === 'function') {
                            worldContext.showDamageNumber(this, `${status.toUpperCase()} EXPIRED`, status);
                        } else {
                            console.log(`${this.name}'s ${status} has worn off in world mode`);
                        }
                    }
                }
            }
        });
    }
}