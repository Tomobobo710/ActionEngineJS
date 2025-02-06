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
        emoji: "⚗️",
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
    }
};