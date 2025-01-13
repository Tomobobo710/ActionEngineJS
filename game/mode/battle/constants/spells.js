// game/mode/battle/constants/spells.js
const SPELLS = {
    fire: {
        name: "Fire",
        mpCost: 4,
        power: 20,
        element: "fire",
        targetType: TARGET_TYPES.SINGLE_ENEMY, // Changed from 'single'
        animation: {
            color: "#ff4400",
            type: "explosion"
        }
    },
    ice: {
        name: "Ice",
        mpCost: 4,
        power: 18,
        element: "ice",
        targetType: TARGET_TYPES.SINGLE_ENEMY, // Changed from 'single'
        animation: {
            color: "#88ccff",
            type: "crystals"
        }
    },
    lightning: {
        name: "Lightning",
        mpCost: 5,
        power: 25,
        element: "lightning",
        targetType: TARGET_TYPES.ALL_ENEMIES,
        animation: {
            color: "#ffff00",
            type: "bolt"
        }
    },
    poison: {
        name: "Poison",
        mpCost: 6,
        power: 12,
        element: "poison",
        targetType: TARGET_TYPES.SINGLE_ENEMY, // Changed from 'single'
        animation: {
            color: "#88ff88",
            type: "mist"
        }
    },
    // New spells
    heal: {
        name: "Heal",
        mpCost: 8,
        power: 40,
        element: "holy",
        targetType: TARGET_TYPES.SINGLE_ALLY,
        animation: {
            color: "#ffffff",
            type: "healing"
        }
    },
    quake: {
        name: "Quake",
        mpCost: 12,
        power: 35,
        element: "earth",
        targetType: TARGET_TYPES.ALL_ENEMIES,
        animation: {
            color: "#884400",
            type: "explosion"
        }
    },
    wind: {
        name: "Wind",
        mpCost: 7,
        power: 28,
        element: "air",
        targetType: TARGET_TYPES.ALL_ENEMIES,
        animation: {
            color: "#88ff88",
            type: "mist"
        }
    },
    water: {
        name: "Water",
        mpCost: 6,
        power: 25,
        element: "water",
        targetType: TARGET_TYPES.SINGLE_ENEMY,
        animation: {
            color: "#4488ff",
            type: "crystals"
        }
    },
    holy: {
        name: "Holy",
        mpCost: 15,
        power: 45,
        element: "holy",
        targetType: TARGET_TYPES.SINGLE_ENEMY,
        animation: {
            color: "#ffffff",
            type: "explosion"
        }
    }
};