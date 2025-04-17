// game.js
class Game {
   static get WIDTH() {
       return 800;
   }
   
   static get HEIGHT() {
       return 600;
   }
   
   constructor(canvases, input, audio) {
       // Create canvas contexts
       this.canvases = canvases;
       
       // Create game master
       this.gameMaster = new GameMaster(this.canvases, input, audio);
       
       console.log("[Game] Initialization completed, starting game loop...");
       this.loop();
   }
   
   loop() {
       this.gameMaster.update();
       this.gameMaster.draw();
       requestAnimationFrame(() => this.loop());
   }
}