// game/world/worldgen/biometypes.js
// Global biome type definitions
const BIOME_TYPES = {
    OCEAN_DEEP: {
        heightRange: [-100, -1],
        base: "#0a1525",
        texture: 'deepwater'
    },
    OCEAN: {
        heightRange: [0, 0],
        base: "#1a3045",
        texture: 'water'
    },
    BEACH: {
        heightRange: [0, 1],
        base: "#d2b98b",
        texture: 'sand'
    },
    DUNES: {
        heightRange: [1, 2],
        base: "#ffe599",
        texture: 'dunes'
    },
    LOWLAND: {
        heightRange: [2, 15],
        base: "#407339",
        texture: 'grass'
    },
    HIGHLAND: {
        heightRange: [15, 40],
        base: "#2d5929",
        texture: 'highland'
    },
    TREELINE: {
        heightRange: [40, 50],
        base: "#744700",
        texture: 'treeline'
    },
    MOUNTAIN: {
        heightRange: [50, 90],
        base: "#736d69",
        texture: 'rock'
    },
    SNOW: {
        heightRange: [90, 100],
        base: "#e8e8e8",
        texture: 'snow'  // Snow stays untextured
    }
};