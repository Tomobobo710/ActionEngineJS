class FishingArea {
    constructor(width = 500, length = 500, depth = 100) {
        this.bounds = {
            width,
            length,
            depth
        };
        this.fish = new Map();
        this.lure = null;
    }

    generateInitialFish(count, physicsWorld) {
        const types = ["BASS", "TROUT", "SWORDFISH"];

        // Divide the fishing area into sectors
        const sectorsPerDimension = Math.ceil(Math.cbrt(count)); // Cubic root for 3D division
        const sectorWidth = this.bounds.width / sectorsPerDimension;
        const sectorDepth = this.bounds.depth / sectorsPerDimension;
        const sectorLength = this.bounds.length / sectorsPerDimension;

        // Create array of all possible sectors
        const sectors = [];
        for (let x = 0; x < sectorsPerDimension; x++) {
            for (let y = 0; y < sectorsPerDimension; y++) {
                for (let z = 0; z < sectorsPerDimension; z++) {
                    sectors.push({ x, y, z });
                }
            }
        }

        // Shuffle sectors array for random distribution
        for (let i = sectors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sectors[i], sectors[j]] = [sectors[j], sectors[i]];
        }

        // Generate fish in different sectors
        for (let i = 0; i < count; i++) {
            // Get sector for this fish
            const sector = sectors[i % sectors.length];

            // Calculate position within sector (with some randomization within the sector)
            const position = new Vector3(
                (sector.x + Math.random()) * sectorWidth - this.bounds.width / 2,
                (sector.y + Math.random()) * sectorDepth - this.bounds.depth / 2,
                (sector.z + Math.random()) * sectorLength - this.bounds.length / 2
            );

            const rotationAxis = ["x", "y", "z"][Math.floor(Math.random() * 3)];
            const randomType = types[Math.floor(Math.random() * types.length)];

            const fish = FishGenerator.generate(physicsWorld, randomType, position, rotationAxis);

            this.addFish(fish);
        }
    }
    
    addFish(fish) {
        // Create an AI controller for this fish
        const ai = new FishAI(fish, this.bounds);
        this.fish.set(fish, ai);
    }
    
    setLure(lure) {
        // Store reference but only allow interaction when in water
        this.lure = lure;
    }

    update(deltaTime) {
        // Only update fish AI if there's a lure in water
        const activeLure = this.lure?.state === "inWater" ? this.lure : null;
        for (const [fish, ai] of this.fish) {
            ai.update(deltaTime, activeLure);
        }
    }
}