class FishGenerator {
    static generate(physicsWorld, type, position, rotationAxis = "y") {
        // Get base configuration for fish type
        let profile = FISH_TYPES[type];
        if (!profile) {
            console.warn(`Unknown fish type: ${type}, using BASS`);
            profile = FISH_TYPES.BASS;
        }

        // Get a randomized configuration from the profile
        const config = profile.generateRandomizedConfig();
        
        // Generate random size within type's range
        const size = this.randomRange(config.sizeRange.min, config.sizeRange.max);

        // Create the fish with the generated configuration
        return new Fish(physicsWorld, size, position, config, rotationAxis);
    }

    static randomRange(min, max) {
        return Math.random() * (max - min) + min;
    }
}