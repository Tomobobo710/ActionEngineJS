// game/world/worldgen/biometypes.js
// Global biome type definitions
const BIOME_TYPES = {
    OCEAN_DEEP: {
        heightRange: [0, 0],
        base: "#0a1525"
    },
    OCEAN: {
        heightRange: [0, 0],
        base: "#1a3045"
    },
    BEACH: {
        heightRange: [0, 0.1],
        base: "#d2b98b"
    },
    DUNES: {
        heightRange: [0.1, 2],
        base: "#ffe599"
    },
    LOWLAND: {
        heightRange: [2, 15],
        base: "#407339"
    },
    HIGHLAND: {
        heightRange: [15, 40],
        base: "#2d5929"
    },
    TREELINE: {
        heightRange: [40, 50],
        base: "#744700"
    },
    MOUNTAIN: {
        heightRange: [50, 90],
        base: "#736d69"
    },
    SNOW: {
        heightRange: [90, 100],
        base: "#e8e8e8"
    }
};