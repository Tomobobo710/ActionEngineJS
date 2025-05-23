// game/state/gamemodemanager.js
class GameModeManager {
    constructor(gameMaster) {
        this.gameMaster = gameMaster;
        this.currentMode = null;
        this.activeMode = null;

        this.modes = ["start", "battle", "world", "fishing", "rpgmenu", "dungeon", "scene"];
        this.currentModeIndex = 0;
    }

    /**
     * Switch to a different game mode
     * @param {string} modeName - The name of the mode to switch to
     * @param {object} params - Optional parameters to pass to the new mode
     */
    switchModeWithParams(modeName, params = null) {
        this.switchModeParams = params;
        this.switchMode(modeName);
    }
    
    /**
     * Switch to a different game mode
     * @param {string} modeName - The name of the mode to switch to
     */
    switchMode(modeName) {
        // Clean up current mode if it exists
        if (this.activeMode) {
            // Make sure we're getting the actual position/rotation from the character
            if (this.activeMode.character) {
                const position = new Vector3(
                    this.activeMode.character.position.x,
                    this.activeMode.character.position.y,
                    this.activeMode.character.position.z
                );
                const rotation = this.activeMode.character.rotation;

                // Debug log to verify values
                console.log("Saving position:", position, "rotation:", rotation);
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
        switch (modeName) {
            // NOTE: "indoor" mode has been consolidated into "scene" mode
            // All indoor scenes are now handled by SceneManager within scene mode
            case "scene":
                this.activeMode = new SceneMode(
                    this.gameMaster.canvases,
                    this.gameMaster.input,
                    this.gameMaster.audio,
                    this
                );
                
                // Scene parameters are now handled by SceneManager internally
                console.log("Scene mode initialized with params:", this.switchModeParams);
                break;
            case "dungeon":
                this.activeMode = new DungeonMode(
                    this.gameMaster.canvases,
                    this.gameMaster.input,
                    this.gameMaster.audio,
                    this
                );
                break;
            case "start":
                this.activeMode = new StartScreenMode(
                    this.gameMaster.canvases,
                    this.gameMaster.input,
                    this.gameMaster.audio,
                    this // Pass the GameModeManager instance
                );
                break;
            case "rpgmenu":
                this.activeMode = new RPGMenuMode(
                    this.gameMaster.canvases,
                    this.gameMaster.input,
                    this.gameMaster.audio,
                    this.gameMaster
                );
                break;
            case "world":
                this.activeMode = new WorldMode(
                    this.gameMaster.canvases,
                    this.gameMaster.input,
                    this.gameMaster.audio,
                    this
                );
                break;
            case "fishing":
                this.activeMode = new FishingMode(
                    this.gameMaster.canvases,
                    this.gameMaster.input,
                    this.gameMaster.audio
                );
                break;
            case "battle":
                this.activeMode = new BattleMode(
                    this.gameMaster.canvases,
                    this.gameMaster.input,
                    this.gameMaster.audio,
                    this.gameMaster
                );
                break;
            default:
                console.error(`Unknown mode: ${modeName}`);
                return;
        }

        this.currentMode = modeName;
        console.log(`[GameModeManager] Switched to ${modeName} mode`);
        
        // Keep params available for the newly created mode to access
        // Don't clear them immediately - let the mode decide when to clear them
        
        return this.activeMode; // Return the created mode for reference
    }

    cycleMode() {
        this.currentModeIndex = (this.currentModeIndex + 1) % this.modes.length;
        this.switchMode(this.modes[this.currentModeIndex]);
    }

    fixed_update(fixedDeltaTime) {
        if (this.activeMode && typeof this.activeMode.fixed_update === "function") {
            this.activeMode.fixed_update(fixedDeltaTime);
        }
    }
    
    update(deltaTime) {
        if (this.activeMode) {
            this.activeMode.update(deltaTime);
            // Check if battle mode is finished
            if (this.currentMode === "battle") {
                const battleMode = this.activeMode;
                if (
                    battleMode.battle?.state === "victory" &&
                    battleMode.battle?.transitionProgress >= 1 &&
                    !battleMode.battle.victoryHandled
                ) {
                    battleMode.battle.victoryHandled = true;

                    // Return to the mode we came from (stored in returnInfo)
                    if (this.returnInfo && this.returnInfo.mode === 'scene') {
                        console.log('GameModeManager: Returning to scene after battle victory:', this.returnInfo);
                        console.log('GameModeManager: returnInfo.position details:', this.returnInfo.position);
                        
                        const sceneParams = {
                            sceneType: this.returnInfo.sceneType,
                            sceneId: this.returnInfo.sceneId,
                            spawnPosition: this.returnInfo.position
                        };
                        
                        console.log('GameModeManager: About to call switchModeWithParams with:', sceneParams);
                        
                        // Return to scene mode with the stored scene info
                        this.switchModeWithParams('scene', sceneParams);
                        
                        // Clear return info after use
                        this.returnInfo = null;
                    } else {
                        // Default fallback to world mode
                        console.log('GameModeManager: No scene return info, defaulting to world mode');
                        this.switchMode("world");
                    }
                }
            }
            // Check for fishing mode exit
            else if (this.currentMode === "fishing") {
                if (this.gameMaster.input.isKeyJustPressed("Action5")) {
                    this.switchMode("world");
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
    
    /**
     * Get mode parameters - used by modes to access initialization parameters
     */
    getModeParams(modeName) {
        // Return current switch mode params if they match the requested mode
        if (this.currentMode === modeName) {
            return this.switchModeParams;
        }
        return null;
    }
}