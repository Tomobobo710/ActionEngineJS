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
        level: 10,
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
        level: 10,
        maxHp: 90,
        maxMp: 80,
        strength: 6,
        magic: 18,
        speed: 10,
        skills: ["Attack"],
        spells: ["fire", "ice", "bolt", "poison", "heal", "quake", "wind", "water", "holy"]
    },
    {
        name: "Edge",
        type: "thief",
        level: 10,
        maxHp: 110,
        maxMp: 45,
        strength: 13,
        magic: 10,
        speed: 16,
        skills: ["Attack", "Steal"],
        spells: ["bolt", "poison"]
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
    }
};

const STARTER_INVENTORY = [
    { item: "potion", quantity: 5 },
    { item: "megaPotion", quantity: 2 },
    { item: "poison", quantity: 3 },
    { item: "bomb", quantity: 2 },
    { item: "ether", quantity: 3 },
    { item: "smokeScreen", quantity: 2 },
    { item: "antidote", quantity: 3 },
    { item: "megaEther", quantity: 2 },
    { item: "phoenix", quantity: 2 },
    { item: "remedy", quantity: 2 }
];