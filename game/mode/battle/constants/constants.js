// game/mode/battle/constants/constants.js
const TARGET_TYPES = {
    SINGLE_ALLY: "single_ally",
    ALL_ALLIES: "all_allies",
    SINGLE_ENEMY: "single_enemy",
    ALL_ENEMIES: "all_enemies"
};

const DEFAULT_PARTY = [
    {
        name: "Cecil",
        type: "warrior",
        level: 1,
        maxHp: 150,
        maxMp: 30,
        strength: 15,
        magic: 8,
        speed: 12,
        skills: ["Attack", "Defend"],
        spells: ["fire"]
    },
    {
        name: "Rosa",
        type: "mage",
        level: 1,
        maxHp: 90,
        maxMp: 80,
        strength: 6,
        magic: 18,
        speed: 10,
        skills: ["Attack"],
        spells: ["fire", "ice", "bolt", "poison", "silence", "heal", "quake", "wind", "water", "holy"]
    },
    {
        name: "Edge",
        type: "thief",
        level: 1,
        maxHp: 110,
        maxMp: 45,
        strength: 13,
        magic: 10,
        speed: 16,
        skills: ["Attack", "Steal"],
        spells: ["bolt", "poison", "silence"]
    }
];

const ENEMY_TEMPLATES = {
    slime: {
        type: "slime",
        maxHp: 30,
        maxMp: 20,
        strength: 8,
        magic: 5,
        speed: 12,
        spells: ["poison"]
    },
    bat: {
        type: "bat",
        maxHp: 45,
        maxMp: 35,
        strength: 12,
        magic: 8,
        speed: 14,
        spells: ["wind"]
    },
    goblin: {
        type: "goblin",
        maxHp: 65,
        maxMp: 25,
        strength: 14,
        magic: 6,
        speed: 16,
        spells: ["fire"]
    },
    zombie: {
        type: "zombie",
        maxHp: 70,
        maxMp: 20,
        strength: 15,
        magic: 5,
        speed: 8,  // Zombies are slow
        spells: ["poison"],  // Can cast poison
        resistances: ["poison"], // Resistant to poison
        weaknesses: ["holy", "fire"], // Weak to holy and fire
    },
    ghoul: {
        type: "ghoul",
        maxHp: 95,
        maxMp: 40,
        strength: 18,
        magic: 12,
        speed: 13,
        spells: ["poison", "ice"], // Can cast both poison and ice spells
        resistances: ["poison", "ice"],
        weaknesses: ["holy", "fire"],
    },
    wolf: {
        type: "wolf",
        maxHp: 120,
        maxMp: 0,
        strength: 22,
        magic: 0,
        speed: 18,    // Very fast
        spells: [],   // Pure physical attacker
        // Special ability could be implemented: "Howl" to boost attack power
    },
    redSlime: {
        type: "redSlime",
        maxHp: 20,
        maxMp: 10,
        strength: 12,  // Stronger than regular slimes
        magic: 4,
        speed: 14,     // Faster than regular slimes
        spells: ["fire"], // They can cast fire spells
        resistances: ["fire"], // Resistant to fire
    },
    rat: {
        type: "rat",
        maxHp: 25,
        maxMp: 0,
        strength: 6,
        magic: 0,
        speed: 15,  // Rats are very quick
        spells: [], // No spells - just physical attacks
    },
    skeleton: {
        type: "skeleton",
        maxHp: 80,
        maxMp: 30,
        strength: 16,
        magic: 7,
        speed: 11,
        spells: ["ice"], // You can adjust which spells it knows
    }
};

const STARTER_INVENTORY = [
    { item: "potion", quantity: 5 },
    { item: "megaPotion", quantity: 2 },
    { item: "poison", quantity: 3 },
    { item: "bomb", quantity: 2 },
    { item: "ether", quantity: 3 },
    { item: "smokeScreen", quantity: 2 },
    { item: "silenceScroll", quantity: 2 },
    { item: "antidote", quantity: 3 },
    { item: "megaEther", quantity: 2 },
    { item: "phoenix", quantity: 2 },
    { item: "remedy", quantity: 2 }
];