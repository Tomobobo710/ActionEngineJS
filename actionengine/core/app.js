import { Game } from '../../game.js'; // Import Game class

// actionengine/core/app.js
class App {
    constructor(options = {}) {
        this.threelayersystem = new CanvasManager();
        const canvases = this.threelayersystem.getCanvases();
        this.audio = new ActionAudioManager();
        this.input = new ActionInputHandler(this.audio, canvases);
        this.game = new Game(canvases, this.input, this.audio);
        
        // Fixed timestep configuration
        this.fixedTimeStep = options.fixedTimeStep || 1/60; // Default 60Hz
        this.maxAccumulatedTime = options.maxAccumulatedTime || 0.2; // Prevent spiral of death
        this.accumulatedTime = 0;
        
        this.lastTime = null;
        // Start the game loop
        console.log("[App] Starting game loop...");
        this.loop();
    }
    
    // Engine-driven loop
    loop(timestamp) {
        // Calculate deltaTime (time since last frame in seconds)
        const now = timestamp || performance.now();
        let deltaTime = this.lastTime ? (now - this.lastTime) / 1000 : 0;
        this.lastTime = now;
        
        // Cap deltaTime to prevent spiral of death on slow frames
        deltaTime = Math.min(deltaTime, 0.25);
        
        // Accumulate time for fixed updates
        this.accumulatedTime += deltaTime;
        this.accumulatedTime = Math.min(this.accumulatedTime, this.maxAccumulatedTime);
        
        // Capture input state for this frame (for regular updates)
        this.input.captureKeyState();
        this.input.setContext('update');
        
        // Pre-update phase (variable timestep, good for input handling)
        if (typeof this.game.action_pre_update === "function") {
            this.game.action_pre_update(deltaTime);
        }
        
        // Process fixed updates for physics and consistent game logic
        if (typeof this.game.action_fixed_update === "function") {
            // Check if we're going to do any physics updates this frame
            if (this.accumulatedTime >= this.fixedTimeStep) {
                // Capture fixed state ONCE before the physics loop starts
                this.input.captureFixedKeyState();
                this.input.setContext('fixed_update');
                
                // Run as many fixed updates as needed based on accumulated time
                while (this.accumulatedTime >= this.fixedTimeStep) {
                    this.game.action_fixed_update(this.fixedTimeStep);
                    this.accumulatedTime -= this.fixedTimeStep;
                }
                
                // Reset context back to update after physics is done
                this.input.setContext('update');
            }
        }
        
        // Update phase (variable timestep, good for non-physics logic)
        if (typeof this.game.action_update === "function") {
            this.game.action_update(deltaTime);
        }
        
        // Post-update phase (variable timestep)
        if (typeof this.game.action_post_update === "function") {
            this.game.action_post_update(deltaTime);
        }
        
        // Pre-draw phase
        if (typeof this.game.action_pre_draw === "function") {
            this.game.action_pre_draw();
        }
        
        // Draw phase
        if (typeof this.game.action_draw === "function") {
            // Pass an interpolation factor for smooth rendering between fixed steps
            const alpha = this.accumulatedTime / this.fixedTimeStep;
            this.game.action_draw(alpha);
        }
        
        // Post-draw phase
        if (typeof this.game.action_post_draw === "function") {
            this.game.action_post_draw();
        }
        
        // Schedule the next frame
        requestAnimationFrame((timestamp) => this.loop(timestamp));
    }
}

export { App }; // Export App class

window.addEventListener("load", () => {
    window.game = new App();
});