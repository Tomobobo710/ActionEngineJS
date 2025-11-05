// game.js
class Game {
    static get WIDTH() {
        return 800;
    }

    static get HEIGHT() {
        return 600;
    }

    constructor(canvases, input, audio) {
        console.log("[Game] Initialization completed");
    }

    action_draw() {
        // Render
    }

    action_fixed_update(deltaTime) {
        // Optional fixed timestep update
    }

    action_update(deltaTime) {
        // Regular update schedule
    }
}