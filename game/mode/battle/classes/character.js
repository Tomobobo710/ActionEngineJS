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

        // ATB (Active Time Battle) properties
        this.atbMax = 100;
        this.atbCurrent = 0;
        this.isReady = false;

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
        this.isDead = false;
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

    castSpell(spell, target) {
        if (this.mp < spell.mpCost) return false;
        if (this.status.silence > 0) return false;

        this.mp -= spell.mpCost;

        let damage = Math.floor((this.stats.magicAttack * spell.power) / 10);

        // Handle both single targets and arrays of targets
        const targets = Array.isArray(target) ? target : [target];
        let totalDamage = 0;

        targets.forEach((t) => {
            if (!t.isDead) {
                // Apply elemental weaknesses/resistances
                let finalDamage = damage;
                if (t.weaknesses && t.weaknesses.includes(spell.element)) {
                    finalDamage = Math.floor(finalDamage * 1.5);
                }
                if (t.resistances && t.resistances.includes(spell.element)) {
                    finalDamage = Math.floor(finalDamage * 0.5);
                }

                totalDamage += t.takeDamage(finalDamage, "magical");
            }
        });

        return totalDamage;
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
            }
        }
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
        this.status[status] = Math.max(this.status[status], duration);
    }

    updateStatus() {
        Object.keys(this.status).forEach((status) => {
            if (this.status[status] > 0) {
                this.status[status]--;

                // Status effects
                switch (status) {
                    case "poison":
                        this.takeDamage(Math.floor(this.maxHp / 16));
                        break;
                }
            }
        });
    }
}