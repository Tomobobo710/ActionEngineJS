// game/mode/battle/constants/equipment.js
const EQUIPMENT = {
    // Weapons
    bronzeSword: {
        id: "bronzeSword",
        name: "Bronze Sword",
        type: "weapon",
        emoji: "🗡️",
        stats: {
            atk: 5,
            def: 0,
            mag: 0,
            mdef: 0
        },
        description: "A basic sword made of bronze."
    },
    ironSword: {
        id: "ironSword",
        name: "Iron Sword",
        type: "weapon",
        emoji: "🗡️",
        stats: {
            atk: 10,
            def: 0,
            mag: 0,
            mdef: 0
        },
        description: "A sturdy sword forged from iron."
    },
    steelSword: {
        id: "steelSword",
        name: "Steel Sword",
        type: "weapon",
        emoji: "🗡️",
        stats: {
            atk: 15,
            def: 0,
            mag: 0,
            mdef: 0
        },
        description: "A high-quality sword made of steel."
    },
    woodenStaff: {
        id: "woodenStaff",
        name: "Wooden Staff",
        type: "weapon",
        emoji: "🦯",
        stats: {
            atk: 2,
            def: 0,
            mag: 5,
            mdef: 2
        },
        description: "A simple wooden staff for casting spells."
    },
    magicWand: {
        id: "magicWand",
        name: "Magic Wand",
        type: "weapon",
        emoji: "🔮",
        stats: {
            atk: 3,
            def: 0,
            mag: 12,
            mdef: 5
        },
        description: "A wand imbued with magical energy."
    },
    dagger: {
        id: "dagger",
        name: "Dagger",
        type: "weapon",
        emoji: "🔪",
        stats: {
            atk: 8,
            def: 0,
            mag: 0,
            mdef: 0
        },
        description: "A small, quick blade that's easy to conceal."
    },
    
    // Armor
    leatherArmor: {
        id: "leatherArmor",
        name: "Leather Armor",
        type: "armor",
        emoji: "🥋",
        stats: {
            atk: 0,
            def: 5,
            mag: 0,
            mdef: 2
        },
        description: "Basic armor made from tanned leather."
    },
    chainmail: {
        id: "chainmail",
        name: "Chainmail",
        type: "armor",
        emoji: "🧥",
        stats: {
            atk: 0,
            def: 10,
            mag: 0,
            mdef: 5
        },
        description: "Flexible armor made of small metal rings."
    },
    plateArmor: {
        id: "plateArmor",
        name: "Plate Armor",
        type: "armor",
        emoji: "🛡️",
        stats: {
            atk: 0,
            def: 15,
            mag: 0,
            mdef: 8
        },
        description: "Heavy armor formed from solid metal plates."
    },
    magicRobe: {
        id: "magicRobe",
        name: "Magic Robe",
        type: "armor",
        emoji: "👘",
        stats: {
            atk: 0,
            def: 4,
            mag: 5,
            mdef: 12
        },
        description: "A robe enchanted with protective spells."
    },
    shadowCloak: {
        id: "shadowCloak",
        name: "Shadow Cloak",
        type: "armor",
        emoji: "🧥",
        stats: {
            atk: 2,
            def: 7,
            mag: 0,
            mdef: 7
        },
        description: "A dark cloak that helps conceal the wearer."
    },
    
    // Helmets
    leatherCap: {
        id: "leatherCap",
        name: "Leather Cap",
        type: "helmet",
        emoji: "🧢",
        stats: {
            atk: 0,
            def: 2,
            mag: 0,
            mdef: 1
        },
        description: "A simple cap made of hardened leather."
    },
    ironHelm: {
        id: "ironHelm",
        name: "Iron Helm",
        type: "helmet",
        emoji: "⛑️",
        stats: {
            atk: 0,
            def: 5,
            mag: 0,
            mdef: 2
        },
        description: "A sturdy helmet forged from iron."
    },
    wizardHat: {
        id: "wizardHat",
        name: "Wizard Hat",
        type: "helmet",
        emoji: "🧙",
        stats: {
            atk: 0,
            def: 1,
            mag: 5,
            mdef: 5
        },
        description: "A pointed hat that enhances magical abilities."
    },
    steelHelm: {
        id: "steelHelm",
        name: "Steel Helm",
        type: "helmet",
        emoji: "🪖",
        stats: {
            atk: 0,
            def: 8,
            mag: 0,
            mdef: 3
        },
        description: "A high-quality helmet made of steel."
    },
    
    // Accessories
    powerRing: {
        id: "powerRing",
        name: "Power Ring",
        type: "accessory",
        emoji: "💍",
        stats: {
            atk: 5,
            def: 0,
            mag: 0,
            mdef: 0
        },
        description: "A ring that enhances physical strength."
    },
    magicPendant: {
        id: "magicPendant",
        name: "Magic Pendant",
        type: "accessory",
        emoji: "📿",
        stats: {
            atk: 0,
            def: 0,
            mag: 5,
            mdef: 0
        },
        description: "A pendant that enhances magical abilities."
    },
    guardianAmulet: {
        id: "guardianAmulet",
        name: "Guardian Amulet",
        type: "accessory",
        emoji: "🧿",
        stats: {
            atk: 0,
            def: 3,
            mag: 0,
            mdef: 3
        },
        description: "An amulet that protects the wearer from harm."
    },
    speedBoots: {
        id: "speedBoots",
        name: "Speed Boots",
        type: "accessory",
        emoji: "👢",
        stats: {
            atk: 0,
            def: 0,
            mag: 0,
            mdef: 0,
            speed: 5
        },
        description: "Boots that increase the wearer's speed."
    }
};