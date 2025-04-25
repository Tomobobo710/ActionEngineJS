// game.js
class Game {
   static get WIDTH() {
       return 800;
   }
   
   static get HEIGHT() {
       return 600;
   }
   
   constructor(canvases, input, audio) {
       // Create game master
       this.gameMaster = new GameMaster(canvases, input, audio);
       
       console.log("[Game] Initialization completed");
   }
   
   action_update(dt) {
       this.gameMaster.update();
   }
   
   action_draw() {
       this.gameMaster.draw();
   }
}