// game/world/worldgen/noisegenerator.js
class NoiseGenerator {
    constructor(seed = Math.random() * 10000) {
        this.seed = seed;
        this.permutationTable = new Uint8Array(512);
        this.initPermutation();
    }

    initPermutation() {
        const permutation = new Uint8Array(256);
        for(let i = 0; i < 256; i++) permutation[i] = i;
        
        for(let i = 255; i > 0; i--) {
            const seedIndex = (this.seed * i) % 256;
            const j = Math.floor(seedIndex);
            [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
        }
        
        for(let i = 0; i < 512; i++) {
            this.permutationTable[i] = permutation[i & 255];
        }
    }

    noise2D(x, z) {
        const gridX = Math.floor(x) & 255;
        const gridZ = Math.floor(z) & 255;
        x -= Math.floor(x);
        z -= Math.floor(z);
        
        const smoothX = this.fade(x);
        const smoothZ = this.fade(z);
        
        const pointA = this.permutationTable[gridX] + gridZ;
        const pointB = this.permutationTable[gridX + 1] + gridZ;
        
        return this.lerp(
            this.lerp(this.grad(this.permutationTable[pointA], x, z), 
                     this.grad(this.permutationTable[pointB], x-1, z), smoothX),
            this.lerp(this.grad(this.permutationTable[pointA+1], x, z-1),
                     this.grad(this.permutationTable[pointB+1], x-1, z-1), smoothX), 
            smoothZ);
    }

    fractalNoise(x, z, octaves = 6, persistence = 0.5) {
        let value = 0;
        let amplitude = 1.0;
        let frequency = 1.0;
        let maxValue = 0;

        // Add a slight bias to increase heights
        const heightBias = 0.1;

        for(let i = 0; i < octaves; i++) {
            const noiseValue = this.noise2D(x * frequency, z * frequency);
            // Add non-linear transformation to create more peaks
            value += amplitude * (noiseValue * noiseValue) * (1 + heightBias);
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2.1; // Slightly higher frequency multiplier
        }

        return value / maxValue;
    }

    // Helper functions
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(a, b, t) { return a + t * (b - a); }
    grad(hash, x, z) {
        const hashValue = hash & 15;
        const gradientX = hashValue < 8 ? x : z;
        const gradientZ = hashValue < 4 ? z : hashValue == 12 || hashValue == 14 ? x : z;
        return ((hashValue & 1) === 0 ? gradientX : -gradientX) + 
               ((hashValue & 2) === 0 ? gradientZ : -gradientZ);
    }
}