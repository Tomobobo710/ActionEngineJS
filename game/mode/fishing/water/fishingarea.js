class FishingArea {
    constructor(width = 500, length = 500, depth = 50) {
        this.bounds = {
            width,
            length,
            depth
        };

        this.fish = new Map();
        this.lure = null; // Add reference to lure
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