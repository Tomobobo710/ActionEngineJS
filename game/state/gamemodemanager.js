// game/state/gamemodemanager.js
class GameModeManager {
    constructor(gameMaster) {
        this.gameMaster = gameMaster;
        this.currentMode = null;
        this.activeMode = null;

        this.modes = ["world", "fishing", "battle"];
        this.currentModeIndex = 0;
    }

    switchMode(modeName) {
        // Clean up current mode if it exists
        if (this.activeMode) {
            const position = this.activeMode.character?.position;
            const rotation = this.activeMode.character?.rotation;

            if (position && rotation) {
                this.gameMaster.savePlayerState(position, rotation);
            }

            this.activeMode.cleanup();
            this.activeMode = null;
        }

        // Clear all canvases before switching
        const gl =
            this.gameMaster.canvases.gameCanvas.getContext("webgl2") ||
            this.gameMaster.canvases.gameCanvas.getContext("webgl");
        if (gl) {
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        }

        const guiCtx = this.gameMaster.canvases.guiCanvas.getContext("2d");
        if (guiCtx) {
            guiCtx.clearRect(0, 0, 800, 600);
        }

        const debugCtx = this.gameMaster.canvases.debugCanvas.getContext("2d");
        if (debugCtx) {
            debugCtx.clearRect(0, 0, 800, 600);
        }

        // Create new mode
        switch(modeName) {
            case 'world':
                this.activeMode = new WorldMode(
                    this.gameMaster.canvases,
                    this.gameMaster.input,
                    this.gameMaster.audio,
                    this
                );
                break;
            case 'fishing':
                this.activeMode = new FishingMode(
                    this.gameMaster.canvases,
                    this.gameMaster.input,
                    this.gameMaster.audio
                );
                break;
            case 'battle':
                this.activeMode = new BattleMode(
                    this.gameMaster.canvases,
                    this.gameMaster.input,
                    this.gameMaster.audio
                );
                break;
            default:
                console.error(`Unknown mode: ${modeName}`);
                return;
        }

        this.currentMode = modeName;
        console.log(`[GameModeManager] Switched to ${modeName} mode`);
    }

    cycleMode() {
        this.currentModeIndex = (this.currentModeIndex + 1) % this.modes.length;
        this.switchMode(this.modes[this.currentModeIndex]);
    }
    
    update(deltaTime) {
    if (this.activeMode) {
        this.activeMode.update(deltaTime);

        // Check if battle mode is finished
        if (this.currentMode === 'battle') {
            const battleMode = this.activeMode;
            if (battleMode.battle?.state === 'victory' && 
                battleMode.battle?.transitionProgress >= 1 && 
                !battleMode.battle.victoryHandled) {
                
                battleMode.battle.victoryHandled = true;
                setTimeout(() => {
                    this.switchMode('world');
                }, 1000);
            }
        }
        // Check for fishing mode exit
        else if (this.currentMode === 'fishing') {
            if (this.gameMaster.input.isKeyJustPressed('Action5')) {
                this.switchMode('world');
            }
        }
    }
}

    draw() {
        if (this.activeMode) {
            this.activeMode.draw();
        }
    }

    pause() {
        if (this.activeMode) {
            this.activeMode.pause();
        }
    }

    resume() {
        if (this.activeMode) {
            this.activeMode.resume();
        }
    }
}