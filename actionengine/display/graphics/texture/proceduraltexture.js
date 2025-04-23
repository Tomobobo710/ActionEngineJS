// actionengine/display/graphics/texture/proceduraltexture.js
class ProceduralTexture {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
        this.widthMask = width - 1; // For power-of-2 textures, faster modulo
        this.heightMask = height - 1;
    }

    getPixel(x, y) {
        // Fast modulo for power-of-2 textures using bitwise AND
        const tx = x & this.widthMask;
        const ty = y & this.heightMask;
        const i = (ty * this.width + tx) * 4;
        return {
            r: this.data[i],
            g: this.data[i + 1],
            b: this.data[i + 2]
        };
    }

    generateCheckerboard() {
        const size = 4; // Make checkers a bit bigger
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const isEven = ((x >> 2) + (y >> 2)) & 1; // Simpler calculation using bitwise
                const i = (y * this.width + x) * 4;
                if (isEven) {
                    this.data[i] = 0; // Blue square
                    this.data[i + 1] = 0;
                    this.data[i + 2] = 255;
                } else {
                    this.data[i] = 255; // Purple square
                    this.data[i + 1] = 0;
                    this.data[i + 2] = 255;
                }
                this.data[i + 3] = 255;
            }
        }
    }

    generateGrass() {
        const baseColor = { r: 34, g: 139, b: 34 };
        // Pre-calculate a noise table for faster lookup
        const noiseTable = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            noiseTable[i] = Math.floor(Math.random() * 30);
        }
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const variation = noiseTable[(x * 7 + y * 13) & 255];
                const i = (y * this.width + x) * 4;
                this.data[i] = Math.min(255, baseColor.r + variation);
                this.data[i + 1] = Math.min(255, baseColor.g + variation);
                this.data[i + 2] = Math.min(255, baseColor.b + variation);
                this.data[i + 3] = 255;
            }
        }
    }

    generateWater() {
        const baseColor = { r: 0, g: 100, b: 255 }; // Keeping your bright blue base
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Just gentle noise for natural water look
                const noise = Math.random() * 15 - 7;

                const i = (y * this.width + x) * 4;
                this.data[i] = Math.min(255, baseColor.r + noise);
                this.data[i + 1] = Math.min(255, baseColor.g + noise);
                this.data[i + 2] = Math.min(255, baseColor.b + noise);
                this.data[i + 3] = 255;
            }
        }
    }

    generateDeepWater() {
        const baseColor = { r: 0, g: 21, b: 37 }; // Dark blue base
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Just subtle random variation
                const variation = Math.random() * 15 - 7;

                const i = (y * this.width + x) * 4;
                this.data[i] = Math.min(255, baseColor.r + variation);
                this.data[i + 1] = Math.min(255, baseColor.g + variation);
                this.data[i + 2] = Math.min(255, baseColor.b + variation);
                this.data[i + 3] = 255;
            }
        }
    }

    generateSand() {
        const baseColor = { r: 210, g: 185, b: 139 }; // Sandy beige
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Create grainy noise pattern
                const noise = Math.random() * 20 - 10;

                const i = (y * this.width + x) * 4;
                this.data[i] = Math.min(255, baseColor.r + noise);
                this.data[i + 1] = Math.min(255, baseColor.g + noise);
                this.data[i + 2] = Math.min(255, baseColor.b + noise);
                this.data[i + 3] = 255;
            }
        }
    }

    generateRock() {
        const baseColor = { r: 115, g: 109, b: 105 }; // Gray
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Just natural noise variation
                const noise = Math.random() * 35 - 17;

                const i = (y * this.width + x) * 4;
                this.data[i] = Math.min(255, baseColor.r + noise);
                this.data[i + 1] = Math.min(255, baseColor.g + noise);
                this.data[i + 2] = Math.min(255, baseColor.b + noise);
                this.data[i + 3] = 255;
            }
        }
    }

    generateHighlandGrass() {
        const baseColor = { r: 45, g: 89, b: 41 }; // Darker green
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Simple noise variation for natural look
                const noise = Math.random() * 35 - 17;

                const i = (y * this.width + x) * 4;
                this.data[i] = Math.min(255, baseColor.r + noise);
                this.data[i + 1] = Math.min(255, baseColor.g + noise);
                this.data[i + 2] = Math.min(255, baseColor.b + noise);
                this.data[i + 3] = 255;
            }
        }
    }

    generateTreeline() {
        const baseColor = { r: 116, g: 71, b: 0 }; // Brown base
        const grayColor = { r: 115, g: 109, b: 105 }; // Gray instead of green

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Smooth blend between brown and gray
                const blendFactor = Math.random();
                const noise = Math.random() * 20 - 10;

                const i = (y * this.width + x) * 4;
                this.data[i] = Math.min(255, baseColor.r * blendFactor + grayColor.r * (1 - blendFactor) + noise);
                this.data[i + 1] = Math.min(255, baseColor.g * blendFactor + grayColor.g * (1 - blendFactor) + noise);
                this.data[i + 2] = Math.min(255, baseColor.b * blendFactor + grayColor.b * (1 - blendFactor) + noise);
                this.data[i + 3] = 255;
            }
        }
    }

    generateDunes() {
        const baseColor = { r: 230, g: 185, b: 115 }; // More orange/reddish sand color
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Natural noise variation
                const noise = Math.random() * 25 - 12;

                const i = (y * this.width + x) * 4;
                this.data[i] = Math.min(255, baseColor.r + noise);
                this.data[i + 1] = Math.min(255, baseColor.g + noise);
                this.data[i + 2] = Math.min(255, baseColor.b + noise);
                this.data[i + 3] = 255;
            }
        }
    }

    generateSnow() {
        const baseColor = { r: 232, g: 232, b: 232 }; // Very light gray/white
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Just subtle noise variation
                const noise = Math.random() * 12 - 6;

                const i = (y * this.width + x) * 4;
                this.data[i] = Math.min(255, baseColor.r + noise);
                this.data[i + 1] = Math.min(255, baseColor.g + noise);
                this.data[i + 2] = Math.min(255, baseColor.b + noise);
                this.data[i + 3] = 255;
            }
        }
    }
}