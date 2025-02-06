// game/mode/battle/classes/items.js
const ITEMS = {
    potion: {
        name: "Potion",
        emoji: "🧪",
        targetType: TARGET_TYPES.SINGLE_ALLY,
        effect: (target) => {
            const healAmount = 50;
            const actualHeal = target.heal(healAmount);
            return actualHeal;
        },
        description: "Restores 50 HP (single)"
    },
    megaPotion: {
        name: "M Potion",
        emoji: "✨",
        targetType: TARGET_TYPES.ALL_ALLIES,
        effect: (target) => {
            const healAmount = 100;
            const actualHeal = target.heal(healAmount);
            return actualHeal;
        },
        description: "Restores 100 HP (all)"
    },
    poison: {
        name: "Poison",
        emoji: "☠️",
        targetType: TARGET_TYPES.SINGLE_ENEMY,
        effect: (target) => {
            if (target.isDead) return false;
            target.addStatus("poison", 5);
            return true;
        },
        description: "Poison damage (single)"
    },
    bomb: {
        name: "Bomb",
        emoji: "💣",
        targetType: TARGET_TYPES.ALL_ENEMIES,
        effect: (target) => {
            if (target.isDead) return false;
            const damage = 30;
            const actualDamage = target.takeDamage(damage, "physical");
            return actualDamage > 0; // Return true only if damage was dealt
        },
        description: "Deals 30 damage (all)"
    },
    ether: {
        name: "Ether",
        emoji: "⭐",
        targetType: TARGET_TYPES.SINGLE_ALLY,
        effect: (target) => {
            const mpRestore = 30;
            target.mp = Math.min(target.maxMp, target.mp + mpRestore);
            return true;
        },
        description: "Restores 30 MP (single)"
    },
    smokeScreen: {
        name: "Smoke",
        emoji: "💨",
        targetType: TARGET_TYPES.ALL_ENEMIES,
        effect: (target) => {
            if (target.isDead) return false;
            target.addStatus("blind", 3);
            return true;
        },
        description: "Blinds enemies (all)"
    },
    antidote: {
        name: "Antidote",
        emoji: "💊",
        targetType: TARGET_TYPES.SINGLE_ALLY,
        effect: (target) => {
            return target.removeStatus("poison");
        },
        description: "Cures poison (single)"
    },
    megaEther: {
        name: "M Ether",
        emoji: "🌟",
        targetType: TARGET_TYPES.ALL_ALLIES,
        effect: (target) => {
            const mpRestore = 50;
            target.mp = Math.min(target.maxMp, target.mp + mpRestore);
            return true;
        },
        description: "Restores 50 MP (all)"
    },
    phoenix: {
        name: "Phoenix",
        emoji: "🦅",
        targetType: TARGET_TYPES.SINGLE_ALLY,
        effect: (target) => {
            if (!target.isDead) return false;
            target.revive(50); // Revive with 50% HP
            return true;
        },
        description: "Revives ally (single)"
    },
    remedy: {
        name: "Remedy",
        emoji: "🌿",
        targetType: TARGET_TYPES.SINGLE_ALLY,
        effect: (target) => {
            return target.removeAllStatus();
        },
        description: "Removes all status (single)"
    }
};