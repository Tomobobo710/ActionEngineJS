// game/state/gamemaster.js
class GameMaster {
   constructor(canvases, input, audio) {
       this.canvases = canvases;
       this.input = input;
       this.audio = audio;

       this.modeManager = new GameModeManager(this);

       // Persistent game state
       this.playerState = {
           position: new Vector3(0, 500, 0),
           rotation: 0
       };

       // Start with world mode
       this.modeManager.switchMode('battle');

       // Set up visibility handlers
       document.addEventListener("visibilitychange", () => {
           if (document.hidden) {
               this.pause();
           } else {
               this.resume();
           }
       });
       
       window.addEventListener("blur", () => this.pause());
       window.addEventListener("focus", () => this.resume());

       this.lastTime = performance.now();
       this.deltaTime = 0;
   }

   update() {
    const currentTime = performance.now();
    this.deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.25);
    this.lastTime = currentTime;

    // Check for mode switch input
    if (this.input.isKeyJustPressed("ActionDebugToggle")) {
        this.modeManager.cycleMode();
    }

    this.modeManager.update(this.deltaTime);
}

   draw() {
       this.modeManager.draw();
   }

   pause() {
       this.modeManager.pause();
   }

   resume() {
       this.lastTime = performance.now();
       this.modeManager.resume();
   }

   savePlayerState(position, rotation) {
       this.playerState.position = position;
       this.playerState.rotation = rotation;
   }

   getPlayerState() {
       return this.playerState;
   }
}