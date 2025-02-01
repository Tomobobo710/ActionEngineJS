class FishProfile {
    constructor(config) {
        this.name = config.name;
        this.classification = config.classification;

        // Colors - keeping all current color properties
        this.colors = {
            NOSE_COLOR: config.colors.NOSE_COLOR,
            SIDE_COLOR: config.colors.SIDE_COLOR,
            TOPBOTTOM_COLOR: config.colors.TOPBOTTOM_COLOR,
            ANAL_FIN_COLOR: config.colors.ANAL_FIN_COLOR,
            TAIL_SIDE_COLOR: config.colors.TAIL_SIDE_COLOR,
            TAIL_CONNECT_COLOR: config.colors.TAIL_CONNECT_COLOR,
            TAIL_FIN_COLOR: config.colors.TAIL_FIN_COLOR,
            DORSAL_FIN_COLOR: config.colors.DORSAL_FIN_COLOR,
            PECTORAL_FIN_COLOR: config.colors.PECTORAL_FIN_COLOR,
            PELVIC_FIN_COLOR: config.colors.PELVIC_FIN_COLOR,
            EYE_BASE_COLOR: config.colors.EYE_BASE_COLOR,
            EYE_DETAIL_COLOR: config.colors.EYE_DETAIL_COLOR
        };

        // Base scales with broader randomization ranges (±30%)
        this.scales = {
            LENGTH_SCALE: {
                base: config.scales.LENGTH_SCALE,
                min: 0.7,
                max: 1.3
            },
            WIDTH_SCALE: {
                base: config.scales.WIDTH_SCALE,
                min: 0.7,
                max: 1.3
            },
            HEIGHT_SCALE: {
                base: config.scales.HEIGHT_SCALE,
                min: 0.7,
                max: 1.3
            }
        };

        // Keep existing eye configuration
        this.eyes = {
            HEIGHT_FACTOR: config.eyes.HEIGHT_FACTOR,
            INWARD_FACTOR: config.eyes.INWARD_FACTOR,
            FORWARD_FACTOR: config.eyes.FORWARD_FACTOR,
            SIZE_FACTOR: config.eyes.SIZE_FACTOR
        };

        // Tail configuration with broader ranges (±25%)
        this.tail = {
            FIN_SHIFT_FACTOR: {
                base: config.tail.FIN_SHIFT_FACTOR,
                min: 0.75,
                max: 1.25
            },
            FIN_SCALE_FACTOR: {
                base: config.tail.FIN_SCALE_FACTOR,
                min: 0.75,
                max: 1.25
            },
            FIN_LENGTH_SCALE: {
                base: config.tail.FIN_LENGTH_SCALE,
                min: 0.75,
                max: 1.25
            }
        };

        // Anal fin configuration with broader ranges (±20%)
        this.analFin = {
            HEIGHT_FACTOR: {
                base: config.analFin.HEIGHT_FACTOR,
                min: 0.8,
                max: 1.2
            },
            FRONT_FACTOR: config.analFin.FRONT_FACTOR,
            BACK_FACTOR: config.analFin.BACK_FACTOR,
            ROOT_HEIGHT_FACTOR: config.analFin.ROOT_HEIGHT_FACTOR
        };

        // Dorsal fin configuration with broader ranges (±20%)
        this.dorsalFin = {
            HEIGHT_FACTOR: {
                base: config.dorsalFin.HEIGHT_FACTOR,
                min: 0.8,
                max: 1.2
            },
            FRONT_FACTOR: config.dorsalFin.FRONT_FACTOR,
            BACK_FACTOR: config.dorsalFin.BACK_FACTOR
        };

        // Pectoral fins configuration with broader ranges (±20%)
        this.pectoralFins = {
            EXTENSION_FACTOR: {
                base: config.pectoralFins.EXTENSION_FACTOR,
                min: 0.8,
                max: 1.2
            },
            DROP_FACTOR: config.pectoralFins.DROP_FACTOR,
            ROOT_FRONT_FACTOR: config.pectoralFins.ROOT_FRONT_FACTOR,
            ROOT_BACK_FACTOR: config.pectoralFins.ROOT_BACK_FACTOR
        };

        // Pelvic fins configuration with broader ranges (±20%)
        this.pelvicFins = {
            DROP_FACTOR: {
                base: config.pelvicFins.DROP_FACTOR,
                min: 0.8,
                max: 1.2
            },
            EXTENSION_FACTOR: {
                base: config.pelvicFins.EXTENSION_FACTOR,
                min: 0.8,
                max: 1.2
            },
            ROOT_HEIGHT_FACTOR: config.pelvicFins.ROOT_HEIGHT_FACTOR,
            FRONT_FACTOR: config.pelvicFins.FRONT_FACTOR,
            BACK_FACTOR: config.pelvicFins.BACK_FACTOR
        };

        // Overall size range - could be even broader if desired
        this.sizeRange = {
            min: config.sizeRange.min * 0.8, // 20% smaller possible
            max: config.sizeRange.max * 1.2 // 20% larger possible
        };
    }

    generateRandomizedConfig() {
        return {
            colors: { ...this.colors },
            scales: {
                LENGTH_SCALE: this.randomizeValue(this.scales.LENGTH_SCALE),
                WIDTH_SCALE: this.randomizeValue(this.scales.WIDTH_SCALE),
                HEIGHT_SCALE: this.randomizeValue(this.scales.HEIGHT_SCALE)
            },
            eyes: { ...this.eyes },
            tail: {
                FIN_SHIFT_FACTOR: this.randomizeValue(this.tail.FIN_SHIFT_FACTOR),
                FIN_SCALE_FACTOR: this.randomizeValue(this.tail.FIN_SCALE_FACTOR),
                FIN_LENGTH_SCALE: this.randomizeValue(this.tail.FIN_LENGTH_SCALE)
            },
            analFin: {
                HEIGHT_FACTOR: this.randomizeValue(this.analFin.HEIGHT_FACTOR),
                FRONT_FACTOR: this.analFin.FRONT_FACTOR,
                BACK_FACTOR: this.analFin.BACK_FACTOR,
                ROOT_HEIGHT_FACTOR: this.analFin.ROOT_HEIGHT_FACTOR
            },
            dorsalFin: {
                HEIGHT_FACTOR: this.randomizeValue(this.dorsalFin.HEIGHT_FACTOR),
                FRONT_FACTOR: this.dorsalFin.FRONT_FACTOR,
                BACK_FACTOR: this.dorsalFin.BACK_FACTOR
            },
            pectoralFins: {
                EXTENSION_FACTOR: this.randomizeValue(this.pectoralFins.EXTENSION_FACTOR),
                DROP_FACTOR: this.pectoralFins.DROP_FACTOR,
                ROOT_FRONT_FACTOR: this.pectoralFins.ROOT_FRONT_FACTOR,
                ROOT_BACK_FACTOR: this.pectoralFins.ROOT_BACK_FACTOR
            },
            pelvicFins: {
                DROP_FACTOR: this.randomizeValue(this.pelvicFins.DROP_FACTOR),
                EXTENSION_FACTOR: this.randomizeValue(this.pelvicFins.EXTENSION_FACTOR),
                ROOT_HEIGHT_FACTOR: this.pelvicFins.ROOT_HEIGHT_FACTOR,
                FRONT_FACTOR: this.pelvicFins.FRONT_FACTOR,
                BACK_FACTOR: this.pelvicFins.BACK_FACTOR
            },
            sizeRange: { ...this.sizeRange }
        };
    }

    randomizeValue(config) {
        if (config.base !== undefined && config.min !== undefined && config.max !== undefined) {
            const randomFactor = config.min + Math.random() * (config.max - config.min);
            return config.base * randomFactor;
        }
        return config; // Return as-is if not a randomizable configuration
    }
}