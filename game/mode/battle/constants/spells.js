// game/mode/battle/constants/spells.js
const SPELLS = {
    fire: {
        name: "Fire",
        emoji: "🔥",
        mpCost: 4,
        power: 20,
        element: "fire",
         effect: "damage",
        targetType: TARGET_TYPES.SINGLE_ENEMY,
        animation: {
            color: "#ff4400",
            type: "explosion"
        },
        description: "Fire elemental damage (single)"
    },
    ice: {
        name: "Ice",
        emoji: "❄️",
        mpCost: 4,
        power: 18,
        element: "ice",
         effect: "damage",
        targetType: TARGET_TYPES.SINGLE_ENEMY,
        animation: {
            color: "#88ccff",
            type: "crystals"
        },
        description: "Ice elemental damage (single)"
    },
    bolt: {
        name: "Bolt",
        emoji: "⚡",
        mpCost: 5,
        power: 25,
        element: "lightning",
         effect: "damage",
        targetType: TARGET_TYPES.ALL_ENEMIES,
        animation: {
            color: "#ffff00",
            type: "bolt"
        },
        description: "Lightning elemental dmg (all)"
    },
    poison: {
        name: "Poison",
        emoji: "☠️",
        mpCost: 6,
        power: 12,
        element: "poison",
        effect: "status",
        targetType: TARGET_TYPES.SINGLE_ENEMY,
        animation: {
            color: "#88ff88",
            type: "mist"
        },
        statusEffects: [
            {
                type: "poison",
                duration: 5,
                chance: 0.85
            }
        ],
        description: "Poisons target to cause damage over time (single)"
    },
    silence: {
        name: "Silence",
        emoji: "🤐",
        mpCost: 8,
        power: 5,
        element: "none",
        effect: "status",
        targetType: TARGET_TYPES.SINGLE_ENEMY,
        animation: {
            color: "#33ccff",
            type: "mist"
        },
        statusEffects: [
            {
                type: "silence",
                duration: 4,
                chance: 0.85
            }
        ],
        description: "Silences target to prevent spellcasting (single)"
    },
    heal: {
        name: "Heal",
        emoji: "💚",
        mpCost: 8,
        power: 40,
        element: "holy",
        effect: "heal",
        targetType: TARGET_TYPES.SINGLE_ALLY,
        animation: {
            color: "#ffffff",
            type: "healing"
        },
        description: "Holy elemental healing (single)"
    },
    quake: {
        name: "Quake",
        emoji: "🌋",
        mpCost: 12,
        power: 35,
        element: "earth",
         effect: "damage",
        targetType: TARGET_TYPES.ALL_ENEMIES,
        animation: {
            color: "#884400",
            type: "explosion"
        },
        description: "Earth elemental damage (all)"
    },
    wind: {
        name: "Wind",
        emoji: "🌪️",
        mpCost: 7,
        power: 28,
        element: "air",
         effect: "damage",
        targetType: TARGET_TYPES.ALL_ENEMIES,
        animation: {
            color: "#88ff88",
            type: "mist"
        },
        description: "Air elemental damage (all)"
    },
    water: {
        name: "Water",
        emoji: "💧",
        mpCost: 6,
        power: 25,
        element: "water",
         effect: "damage",
        targetType: TARGET_TYPES.SINGLE_ENEMY,
        animation: {
            color: "#4488ff",
            type: "crystals"
        },
        description: "Water elemental dmg (single)"
    },
    holy: {
        name: "Holy",
        emoji: "✨",
        mpCost: 15,
        power: 45,
        element: "holy",
        effect: "heal",
        targetType: TARGET_TYPES.ALL_ALLIES,
        animation: {
            color: "#ffffff",
            type: "explosion"
        },
        description: "Holy elemental healing (all)" 
    },
    wither: {
        name: "Wither",
        emoji: "\ud83d\udda4", // Black heart emoji
        mpCost: 8,
        power: 10,
        element: "dark",
        effect: "status",
        targetType: TARGET_TYPES.SINGLE_ENEMY,
        animation: {
            color: "#333333",
            type: "mist"
        },
        statusEffects: [
            {
                type: "wither",
                duration: 5,
                chance: 0.8
            }
        ],
        description: "Withers target to cause stronger damage over time (single)"
    }
};