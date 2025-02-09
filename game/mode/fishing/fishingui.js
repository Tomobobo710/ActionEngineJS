class FishingUI {
    constructor(guiCanvas, guiContext) {
        this.guiCanvas = guiCanvas;
        this.guiContext = guiContext;
    }

    draw(gameState) {
        // Clear the GUI canvas first
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
            this.drawHookedFishControls();
        }
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
        this.guiContext.fillText("Press 'K' to keep fish", this.guiCanvas.width - 10, 30);
        this.guiContext.fillText("Press 'R' to release fish", this.guiCanvas.width - 10, 50);
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