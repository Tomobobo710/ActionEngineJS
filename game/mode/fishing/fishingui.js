class FishingUI {
    constructor(guiCanvas, guiContext) {
        this.guiCanvas = guiCanvas;
        this.guiContext = guiContext;
        this.catchMenu = {
            visible: false,
            position: { x: guiCanvas.width / 2 - 150, y: guiCanvas.height / 2 - 100 },
            width: 300,
            height: 200
        };
    }

    draw(gameState) {
    this.guiContext.clearRect(0, 0, this.guiCanvas.width, this.guiCanvas.height);
    
    this.drawInstructions();
    this.drawCatchBag(gameState.catchBag);
    
    if (gameState.hookingBarVisible) {
        this.drawHookingBar(gameState.hookingProgress);
    }
    if (gameState.isChargingCast) {
        this.drawCastingPowerMeter(gameState.castPowerPercentage);
    }
    if (gameState.hasHookedFish) {
        this.drawLineTensionMeter(gameState.lineTension);
        // Only show catch menu when in caught state AND lure is close to fisher
        if (gameState.fisherState === "caught" && gameState.isLureAtFisher) {
            this.drawCatchMenu(gameState.hookedFish);
        }
    }
}

    drawCatchMenu(fish) {
        const menu = this.catchMenu;
        const ctx = this.guiContext;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(menu.position.x, menu.position.y, menu.width, menu.height);

        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.strokeRect(menu.position.x, menu.position.y, menu.width, menu.height);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('You caught a fish!', 
            menu.position.x + menu.width/2, 
            menu.position.y + 50);

        ctx.font = '20px Arial';
        ctx.fillText(`Type: ${fish?.type || 'Fish'}`, 
            menu.position.x + menu.width/2, 
            menu.position.y + 90);

        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(menu.position.x + 40, menu.position.y + 120, 100, 40);
        
        ctx.fillStyle = '#f44336';
        ctx.fillRect(menu.position.x + menu.width - 140, menu.position.y + 120, 100, 40);

        ctx.fillStyle = '#fff';
        ctx.font = '18px Arial';
        ctx.fillText('Release', 
            menu.position.x + 90, 
            menu.position.y + 145);
        ctx.fillText('Keep', 
            menu.position.x + menu.width - 90, 
            menu.position.y + 145);
    }



    drawInstructions() {
        this.guiContext.fillStyle = "#fff";
        this.guiContext.font = "16px Arial";
        this.guiContext.textAlign = "left";
        this.guiContext.fillText("Hold SHIFT to charge cast", 10, 30);
        this.guiContext.fillText("Release SHIFT to cast", 10, 50);
        this.guiContext.fillText("WASD to move lure", 10, 70);
        this.guiContext.fillText("SPACE to reel in", 10, 90);
    }

    drawHookedFishControls() {
        this.guiContext.fillStyle = "#fff";
        this.guiContext.font = "16px Arial";
        this.guiContext.textAlign = "right";
        this.guiContext.fillText("Press 'action1' to Keep fish", this.guiCanvas.width - 10, 30);
        this.guiContext.fillText("Press 'action2' to release fish", this.guiCanvas.width - 10, 50);
    }

    drawCatchBag(catchBag) {
        if (!catchBag) return;

        this.guiContext.fillStyle = "#fff";
        this.guiContext.font = "16px Arial";
        this.guiContext.textAlign = "right";
        
        let y = 90;
        this.guiContext.fillText("Catch Bag:", this.guiCanvas.width - 10, y);
        y += 25;

        for (const [fishType, count] of Object.entries(catchBag)) {
            this.guiContext.fillText(`${fishType}: ${count}`, this.guiCanvas.width - 10, y);
            y += 20;
        }
    }

    drawLineTensionMeter(tension) {
        const barWidth = 200;
        const barHeight = 20;
        const x = 10;
        const y = this.guiCanvas.height - 150;

        // Background
        this.guiContext.fillStyle = "#333";
        this.guiContext.fillRect(x, y, barWidth, barHeight);

        // Tension level
        let color;
        if (tension < 0.5) color = "#0f0";
        else if (tension < 0.8) color = "#ff0";
        else color = "#f00";

        this.guiContext.fillStyle = color;
        this.guiContext.fillRect(x, y, barWidth * tension, barHeight);

        // Label
        this.guiContext.fillStyle = "#fff";
        this.guiContext.font = "16px Arial";
        this.guiContext.textAlign = "left";
        this.guiContext.fillText("Line Tension", x, y - 5);
    }

    drawCastingPowerMeter(percentage) {
        const barWidth = 200;
        const barHeight = 20;
        const x = (this.guiCanvas.width - barWidth) / 2;
        const y = this.guiCanvas.height - 100;

        this.guiContext.fillStyle = "#333";
        this.guiContext.fillRect(x, y, barWidth, barHeight);

        this.guiContext.fillStyle = "#0f0";
        this.guiContext.fillRect(x, y, barWidth * (percentage / 100), barHeight);

        this.guiContext.fillStyle = "#fff";
        this.guiContext.font = "16px Arial";
        this.guiContext.textAlign = "center";
        this.guiContext.fillText("Casting Power", x + barWidth / 2, y - 10);
    }

    drawHookingBar(progress) {
        const barWidth = 200;
        const barHeight = 20;
        const x = (this.guiCanvas.width - barWidth) / 2;
        const y = this.guiCanvas.height - 50;

        // Draw background
        this.guiContext.fillStyle = "rgba(0, 0, 0, 0.5)";
        this.guiContext.fillRect(x - 2, y - 2, barWidth + 4, barHeight + 4);

        // Draw progress bar background
        this.guiContext.fillStyle = "#333";
        this.guiContext.fillRect(x, y, barWidth, barHeight);

        // Draw progress (filling from right to left)
        this.guiContext.fillStyle = "#0f0";
        const progressWidth = barWidth * (1 - progress);
        this.guiContext.fillRect(x, y, progressWidth, barHeight);

        // Draw "HOOK!" text
        this.guiContext.fillStyle = "#fff";
        this.guiContext.font = "16px Arial";
        this.guiContext.textAlign = "center";
        this.guiContext.fillText("HOOK!", x + barWidth / 2, y - 10);
    }
}