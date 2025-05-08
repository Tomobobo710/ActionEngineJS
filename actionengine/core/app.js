// actionengine/core/app.js
class App {
    constructor() {
        this.threelayersystem = new CanvasManager();
        const canvases = this.threelayersystem.getCanvases();

        this.audio = new ActionAudioManager();
        this.input = new ActionInputHandler(this.audio, canvases);

        this.game = new Game(canvases, this.input, this.audio);
        this.lastTime = null;
        // Start the game loop
        console.log("[App] Starting game loop...");
        this.loop();
    }

    // Engine-driven loop
    loop(timestamp) {
        // Calculate deltaTime (time since last frame in seconds)
        const now = timestamp || performance.now();
        const deltaTime = this.lastTime ? (now - this.lastTime) / 1000 : 0;
        this.lastTime = now;
        this.input.resetFrameState();
        // Pre-update phase
        if (typeof this.game.action_pre_update === "function") {
            this.game.action_pre_update();
        }

        // Update phase
        if (typeof this.game.action_update === "function") {
            this.game.action_update(deltaTime);
        }

        // Post-update phase
        if (typeof this.game.action_post_update === "function") {
            this.game.action_post_update();
        }

        // Pre-draw phase
        if (typeof this.game.action_pre_draw === "function") {
            this.game.action_pre_draw();
        }

        // Draw phase
        if (typeof this.game.action_draw === "function") {
            this.game.action_draw();
        }

        // Post-draw phase
        if (typeof this.game.action_post_draw === "function") {
            this.game.action_post_draw();
        }

        // Schedule the next frame
        requestAnimationFrame((timestamp) => this.loop(timestamp));
    }
}

window.addEventListener("load", () => {
    window.game = new App();
});