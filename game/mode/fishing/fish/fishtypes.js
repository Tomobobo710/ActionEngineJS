const FISH_TYPES = {
    BASS: new FishProfile({
        name: "Bass",
        classification: "predator",
        colors: {
            NOSE_COLOR: "#ff0066",
            SIDE_COLOR: "#8b0000",
            TOPBOTTOM_COLOR: "#4a0000",
            ANAL_FIN_COLOR: "#ff4d94",
            TAIL_SIDE_COLOR: "#ff1a1a",
            TAIL_CONNECT_COLOR: "#cc0000",
            TAIL_FIN_COLOR: "#ff6666",
            DORSAL_FIN_COLOR: "#ff3333",
            PECTORAL_FIN_COLOR: "#ff9999",
            PELVIC_FIN_COLOR: "#ff4d4d",
            EYE_BASE_COLOR: "#ffcccc",
            EYE_DETAIL_COLOR: "#660000"
        },
        scales: {
            LENGTH_SCALE: 5.5,
            WIDTH_SCALE: 0.9,
            HEIGHT_SCALE: 0.6
        },
        eyes: {
            HEIGHT_FACTOR: 0.15,
            INWARD_FACTOR: 0.23,
            FORWARD_FACTOR: 0.34,
            SIZE_FACTOR: 0.2
        },
        tail: {
            FIN_SHIFT_FACTOR: -0.1,
            FIN_SCALE_FACTOR: 2.2,
            FIN_LENGTH_SCALE: 0.2
        },
        analFin: {
            HEIGHT_FACTOR: 1.5,
            FRONT_FACTOR: -0.225,
            BACK_FACTOR: -0.375,
            ROOT_HEIGHT_FACTOR: 1.0
        },
        dorsalFin: {
            HEIGHT_FACTOR: 2.2,
            FRONT_FACTOR: 0.25,
            BACK_FACTOR: -0.25
        },
        pectoralFins: {
            EXTENSION_FACTOR: 1.5,
            DROP_FACTOR: 0.5,
            ROOT_FRONT_FACTOR: 0.25,
            ROOT_BACK_FACTOR: 0
        },
        pelvicFins: {
            DROP_FACTOR: 1.5,
            EXTENSION_FACTOR: 1.0,
            ROOT_HEIGHT_FACTOR: 0.8,
            FRONT_FACTOR: 0,
            BACK_FACTOR: -0.25
        },
        sizeRange: {
            min: 1.5,
            max: 2.5
        }
    }),

    TROUT: new FishProfile({
        name: "Trout",
        classification: "game_fish",
        colors: {
            NOSE_COLOR: "#00ffaa",
            SIDE_COLOR: "#006622",
            TOPBOTTOM_COLOR: "#004d1a",
            ANAL_FIN_COLOR: "#00ff88",
            TAIL_SIDE_COLOR: "#00cc44",
            TAIL_CONNECT_COLOR: "#008833",
            TAIL_FIN_COLOR: "#66ffb3",
            DORSAL_FIN_COLOR: "#00e64d",
            PECTORAL_FIN_COLOR: "#33ff77",
            PELVIC_FIN_COLOR: "#00cc55",
            EYE_BASE_COLOR: "#e6fff2",
            EYE_DETAIL_COLOR: "#004d00"
        },
        scales: {
            LENGTH_SCALE: 5.5,
            WIDTH_SCALE: 0.7,
            HEIGHT_SCALE: 0.45
        },
        eyes: {
            HEIGHT_FACTOR: 0.15,
            INWARD_FACTOR: 0.23,
            FORWARD_FACTOR: 0.34,
            SIZE_FACTOR: 0.2
        },
        tail: {
            FIN_SHIFT_FACTOR: -0.08,
            FIN_SCALE_FACTOR: 1.8,
            FIN_LENGTH_SCALE: 0.2
        },
        analFin: {
            HEIGHT_FACTOR: 1.3,
            FRONT_FACTOR: -0.225,
            BACK_FACTOR: -0.375,
            ROOT_HEIGHT_FACTOR: 0.9
        },
        dorsalFin: {
            HEIGHT_FACTOR: 1.8,
            FRONT_FACTOR: 0.2,
            BACK_FACTOR: -0.3
        },
        pectoralFins: {
            EXTENSION_FACTOR: 1.3,
            DROP_FACTOR: 0.4,
            ROOT_FRONT_FACTOR: 0.25,
            ROOT_BACK_FACTOR: 0
        },
        pelvicFins: {
            DROP_FACTOR: 1.3,
            EXTENSION_FACTOR: 0.9,
            ROOT_HEIGHT_FACTOR: 0.8,
            FRONT_FACTOR: 0,
            BACK_FACTOR: -0.25
        },
        sizeRange: {
            min: 1.0,
            max: 2.0
        }
    }),

    SWORDFISH: new FishProfile({
        name: "Swordfish",
        classification: "pelagic_predator",
        colors: {
            NOSE_COLOR: "#1a1aff",
            SIDE_COLOR: "#000099",
            TOPBOTTOM_COLOR: "#00004d",
            ANAL_FIN_COLOR: "#4d4dff",
            TAIL_SIDE_COLOR: "#0000ff",
            TAIL_CONNECT_COLOR: "#0000cc",
            TAIL_FIN_COLOR: "#8080ff",
            DORSAL_FIN_COLOR: "#3333ff",
            PECTORAL_FIN_COLOR: "#6666ff",
            PELVIC_FIN_COLOR: "#3333cc",
            EYE_BASE_COLOR: "#ccd9ff",
            EYE_DETAIL_COLOR: "#000066"
        },
        scales: {
            LENGTH_SCALE: 7,
            WIDTH_SCALE: 0.5,
            HEIGHT_SCALE: 0.4
        },
        eyes: {
            HEIGHT_FACTOR: 0.15,
            INWARD_FACTOR: 0.23,
            FORWARD_FACTOR: 0.34,
            SIZE_FACTOR: 0.2
        },
        tail: {
            FIN_SHIFT_FACTOR: -0.05,
            FIN_SCALE_FACTOR: 2.5,
            FIN_LENGTH_SCALE: 0.2
        },
        analFin: {
            HEIGHT_FACTOR: 1.2,
            FRONT_FACTOR: -0.225,
            BACK_FACTOR: -0.375,
            ROOT_HEIGHT_FACTOR: 0.8
        },
        dorsalFin: {
            HEIGHT_FACTOR: 2.5,
            FRONT_FACTOR: 0.15,
            BACK_FACTOR: -0.4
        },
        pectoralFins: {
            EXTENSION_FACTOR: 1.2,
            DROP_FACTOR: 0.3,
            ROOT_FRONT_FACTOR: 0.25,
            ROOT_BACK_FACTOR: 0
        },
        pelvicFins: {
            DROP_FACTOR: 1.2,
            EXTENSION_FACTOR: 0.8,
            ROOT_HEIGHT_FACTOR: 0.7,
            FRONT_FACTOR: 0,
            BACK_FACTOR: -0.25
        },
        sizeRange: {
            min: 3.0,
            max: 4.5
        }
    })
};