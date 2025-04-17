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

   setupCanvases(canvases) {
       

       // Setup 3D canvas
       this.canvases.gameCanvas.width = Game.WIDTH;
       this.canvases.gameCanvas.height = Game.HEIGHT;

       // Setup GUI canvas 
       this.canvases.guiCanvas.width = Game.WIDTH;
       this.canvases.guiCanvas.height = Game.HEIGHT;

       // Setup debug canvas
       this.canvases.debugCanvas.width = Game.WIDTH;
       this.canvases.debugCanvas.height = Game.HEIGHT;
   }
   
   loop() {
       this.gameMaster.update();
       this.gameMaster.draw();
       requestAnimationFrame(() => this.loop());
   }
}