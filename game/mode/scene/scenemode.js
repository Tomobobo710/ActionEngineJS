// game/mode/scene/scenemode.js

/**
 * SceneMode - Scene coordination mode for the game
 * 
 * This mode acts as a coordinator for all scene-based gameplay. It manages
 * transitions between different scene types (TownScene, HouseScene, etc.) and
 * maintains the scene ecosystem. This is the mode that GameModeManager switches
 * to when entering "scene" mode.
 * 
 * The actual scene logic is now handled by individual scene classes that inherit
 * from BaseGameScene, and this mode orchestrates them via SceneManager.
 */
class SceneMode {
    constructor(canvases, input, audio, gameModeManager) {
        console.log('SceneMode: Initializing scene coordination mode');
        
        // Create the scene manager to handle all scene logic
        this.sceneManager = new SceneManager(canvases, input, audio, gameModeManager);
        
        console.log('SceneMode: Scene mode initialized with SceneManager');
    }
    
    /**
     * Pause all scenes
     */
    pause() {
        if (this.sceneManager) {
            this.sceneManager.pause();
        }
    }
    
    /**
     * Resume all scenes
     */
    resume() {
        if (this.sceneManager) {
            this.sceneManager.resume();
        }
    }
    
    /**
     * Update - delegates to scene manager
     */
    update(deltaTime) {
        if (this.sceneManager) {
            this.sceneManager.update(deltaTime);
        }
    }
    
    /**
     * Fixed update - delegates to scene manager
     */
    fixed_update(fixedDeltaTime) {
        if (this.sceneManager) {
            this.sceneManager.fixed_update(fixedDeltaTime);
        }
    }
    
    /**
     * Draw - delegates to scene manager
     */
    draw() {
        if (this.sceneManager) {
            this.sceneManager.draw();
        }
    }
    
    /**
     * Clean up - delegates to scene manager
     */
    cleanup() {
        console.log('SceneMode: Cleaning up scene mode');
        
        if (this.sceneManager) {
            this.sceneManager.cleanup();
            this.sceneManager = null;
        }
    }
    
    /**
     * Legacy method compatibility - enter building
     * Some existing code might still call this directly
     */
    enterBuilding(buildingId, returnSceneName) {
        if (this.sceneManager) {
            const returnConfig = {
                type: 'town',
                sceneId: returnSceneName || 'default_town'
            };
            this.sceneManager.enterBuilding(buildingId, returnConfig);
        }
    }
    
    /**
     * Legacy method compatibility - return from building
     */
    returnFromBuilding(townName, position) {
        if (this.sceneManager) {
            const returnConfig = {
                type: 'town',
                sceneId: townName,
                spawnPosition: position
            };
            this.sceneManager.switchToScene(returnConfig);
        }
    }
    
    /**
     * Get current scene information for debugging
     */
    getCurrentSceneInfo() {
        if (this.sceneManager) {
            return this.sceneManager.getDebugInfo();
        }
        return null;
    }
    
    /**
     * Get the current town ID (legacy compatibility)
     */
    getCurrentTownId() {
        if (this.sceneManager) {
            return this.sceneManager.getCurrentSceneId();
        }
        return "unknown";
    }
}
