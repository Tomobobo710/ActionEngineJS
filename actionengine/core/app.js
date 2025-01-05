// actionengine/core/app.js
class App {
    constructor() {
        this.threelayersystem = new CanvasManager();
        const canvases = this.threelayersystem.getCanvases();
        
        this.audio = new ActionAudioManager();
        this.input = new ActionInputHandler(this.audio, canvases);  // Pass canvases here
        
        this.game = new Game(canvases, this.input, this.audio);
    }
}

window.addEventListener('load', () => {
    window.game = new App();
});