// actionengine/core/app.js
class App {
    constructor() {
        this.threelayersystem = new CanvasManager();
        const canvases = this.threelayersystem.getCanvases();
        
        this.audio = new ActionAudioManager();
        this.input = new ActionInputHandler(this.audio, canvases);  // Pass canvases here
        
        this.game = new Game(canvases, this.input, this.audio);
        
        // Start the game loop
        console.log("[App] Starting game loop...");
        this.loop();
    }
    
    loop() {
        // Engine-driven loop
        
        // Pre-update phase
        if (typeof this.game.action_pre_update === 'function') {
            this.game.action_pre_update();
        }
        
        // Update phase
        if (typeof this.game.action_update === 'function') {
            this.game.action_update();
        }
        
        // Post-update phase
        if (typeof this.game.action_post_update === 'function') {
            this.game.action_post_update();
        }
        
        // Pre-draw phase
        if (typeof this.game.action_pre_draw === 'function') {
            this.game.action_pre_draw();
        }
        
        // Draw phase
        if (typeof this.game.action_draw === 'function') {
            this.game.action_draw();
        }
        
        // Post-draw phase
        if (typeof this.game.action_post_draw === 'function') {
            this.game.action_post_draw();
        }
        
        // We'll implement input state updates later
        // Currently there's no input.update() method
        
        // Schedule the next frame
        requestAnimationFrame(() => this.loop());
    }
}

window.addEventListener('load', () => {
    window.game = new App();
});