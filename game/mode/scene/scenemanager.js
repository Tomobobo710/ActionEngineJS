// game/mode/scene/scenemanager.js

/**
 * SceneManager - Coordinates and manages different scene types
 * 
 * This class acts as the orchestrator for all scene-based gameplay. Instead of being
 * a specific scene type, it manages transitions between different scene types like
 * TownScene, HouseScene, CaveScene, etc. It handles:
 * - Scene creation and destruction
 * - Scene transition management
 * - Portal data persistence
 * - Scene history tracking
 * - Return info management
 */
class SceneManager {
    constructor(canvases, input, audio, gameModeManager) {
        // Core engine interfaces
        this.canvases = canvases;
        this.input = input;
        this.audio = audio;
        this.gameModeManager = gameModeManager;
        
        // Scene management
        this.activeScene = null;
        this.sceneHistory = [];
        this.transitionQueue = [];
        
        // Scene type registry
        this.sceneTypes = {
            'town': TownScene,
            'house': HouseScene,
            // Future scene types can be added here:
            // 'cave': CaveScene,
            // 'dungeon': DungeonScene,
            // 'cutscene': CutsceneScene
        };
        
        // Default scene configuration
        this.defaultSceneConfig = {
            type: 'town',
            sceneId: 'default_town',
            spawnPosition: null
        };
        
        console.log('SceneManager: Initialized scene management system');
        
        // Initialize with default scene or provided parameters
        this.initializeWithParams();
    }
    
    /**
     * Initialize with parameters from GameModeManager
     */
    initializeWithParams() {
        // Check if we have specific scene parameters
        const params = this.gameModeManager.getModeParams('scene');
        
        try {
            if (params && params.returnFromIndoor) {
                // Returning from indoor scene
                this.handleReturnFromIndoor(params);
            } else if (params && params.sceneType) {
                // Specific scene type requested (could be from battle return)
                console.log('SceneManager: Creating scene from parameters:', params);
                console.log('SceneManager: params.spawnPosition details:', params.spawnPosition);
                console.log('SceneManager: params.spawnPosition type:', typeof params.spawnPosition);
                
                const sceneConfig = {
                    type: params.sceneType,
                    sceneId: params.sceneId || 'default',
                    spawnPosition: params.spawnPosition
                };
                
                console.log('SceneManager: About to call switchToScene with:', sceneConfig);
                this.switchToScene(sceneConfig);
            } else {
                // Default to town scene
                this.switchToScene(this.defaultSceneConfig);
            }
        } finally {
            // Clear the parameters after use to prevent memory leaks
            this.gameModeManager.switchModeParams = null;
        }
    }
    
    /**
     * Handle returning from indoor scene to outdoor scene
     */
    handleReturnFromIndoor(params) {
        console.log('SceneManager: Handling return from indoor scene', params);
        
        const sceneConfig = {
            type: 'town', // Assume returning to town for now
            sceneId: params.returnToTown || 'default_town',
            spawnPosition: params.returnPosition
        };
        
        this.switchToScene(sceneConfig);
    }
    
    /**
     * Switch to a different scene type
     */
    switchToScene(sceneConfig) {
        console.log('SceneManager: Switching to scene:', sceneConfig);
        
        // Validate scene type
        if (!this.sceneTypes[sceneConfig.type]) {
            console.error(`SceneManager: Unknown scene type: ${sceneConfig.type}`);
            return false;
        }
        
        // Clean up current scene
        if (this.activeScene) {
            console.log('SceneManager: Cleaning up current scene');
            this.activeScene.cleanup();
            this.activeScene = null;
        }
        
        // Create new scene
        const SceneClass = this.sceneTypes[sceneConfig.type];
        
        try {
            // Create scene with appropriate parameters based on type
            if (sceneConfig.type === 'town') {
                console.log('SceneManager: Creating TownScene with spawnPosition:', sceneConfig.spawnPosition);
                this.activeScene = new SceneClass(
                    this.canvases,
                    this.input,
                    this.audio,
                    this.gameModeManager,
                    sceneConfig.sceneId,
                    sceneConfig.spawnPosition,
                    this // Pass SceneManager reference directly
                );
            } else if (sceneConfig.type === 'house') {
                this.activeScene = new SceneClass(
                    this.canvases,
                    this.input,
                    this.audio,
                    this.gameModeManager,
                    sceneConfig.sceneId,
                    sceneConfig.returnInfo,
                    this // Pass SceneManager reference directly
                );
            } else {
                // Generic scene creation for future scene types
                this.activeScene = new SceneClass(
                    this.canvases,
                    this.input,
                    this.audio,
                    this.gameModeManager,
                    sceneConfig,
                    this // Pass SceneManager reference directly
                );
            }
            
            // Add to scene history
            this.sceneHistory.push({
                config: sceneConfig,
                timestamp: Date.now()
            });
            
            console.log(`SceneManager: Successfully created ${sceneConfig.type} scene: ${sceneConfig.sceneId}`);
            return true;
            
        } catch (error) {
            console.error('SceneManager: Failed to create scene:', error);
            
            // Fallback to default scene
            if (sceneConfig !== this.defaultSceneConfig) {
                console.log('SceneManager: Falling back to default scene');
                return this.switchToScene(this.defaultSceneConfig);
            }
            
            return false;
        }
    }
    
    /**
     * Transition between scenes within the scene system (no mode change)
     */
    transitionToScene(targetSceneConfig, transitionType = 'fade') {
        console.log('SceneManager: Transitioning to scene:', targetSceneConfig);
        
        // For now, just switch directly
        // In the future, this could handle different transition types
        this.switchToScene(targetSceneConfig);
    }
    
    /**
     * Enter a building from a town scene
     */
    enterBuilding(buildingId, returnSceneConfig) {
        console.log(`SceneManager: Entering building ${buildingId}`);
        
        // Get current character position for return
        let returnPosition = null;
        if (this.activeScene && this.activeScene.character) {
            returnPosition = this.activeScene.character.position.clone();
        }
        
        // Create house scene config
        const houseConfig = {
            type: 'house',
            sceneId: buildingId,
            returnInfo: {
                mode: 'scene',
                sceneConfig: returnSceneConfig,
                position: returnPosition
            }
        };
        
        this.switchToScene(houseConfig);
    }
    
    /**
     * Exit from indoor scene back to outdoor scene
     */
    exitToOutdoorScene(returnInfo) {
        console.log('SceneManager: Exiting to outdoor scene:', returnInfo);
        
        if (returnInfo && returnInfo.sceneConfig) {
            // Restore spawn position from return info
            const sceneConfig = {
                ...returnInfo.sceneConfig,
                spawnPosition: returnInfo.position
            };
            
            this.switchToScene(sceneConfig);
        } else {
            // Fallback to default
            this.switchToScene(this.defaultSceneConfig);
        }
    }
    
    /**
     * Get the current scene type
     */
    getCurrentSceneType() {
        if (!this.activeScene) return null;
        
        // Determine scene type from active scene
        if (this.activeScene instanceof TownScene) return 'town';
        if (this.activeScene instanceof HouseScene) return 'house';
        
        return 'unknown';
    }
    
    /**
     * Get the current scene ID
     */
    getCurrentSceneId() {
        if (!this.activeScene) return null;
        
        return this.activeScene.townId || this.activeScene.initialRoomId || 'unknown';
    }
    
    /**
     * Pause the active scene
     */
    pause() {
        if (this.activeScene) {
            this.activeScene.pause();
        }
    }
    
    /**
     * Resume the active scene
     */
    resume() {
        if (this.activeScene) {
            this.activeScene.resume();
        }
    }
    
    /**
     * Update the active scene
     */
    update(deltaTime) {
        if (this.activeScene) {
            this.activeScene.update(deltaTime);
        }
    }
    
    /**
     * Fixed update for the active scene
     */
    fixed_update(fixedDeltaTime) {
        if (this.activeScene) {
            this.activeScene.fixed_update(fixedDeltaTime);
        }
    }
    
    /**
     * Draw the active scene
     */
    draw() {
        if (this.activeScene) {
            this.activeScene.draw();
        }
    }
    
    /**
     * Clean up the scene manager
     */
    cleanup() {
        console.log('SceneManager: Cleaning up scene manager');
        
        // Clean up active scene
        if (this.activeScene) {
            this.activeScene.cleanup();
            this.activeScene = null;
        }
        
        // Clear scene history
        this.sceneHistory = [];
        this.transitionQueue = [];
        
        // Clear references
        this.canvases = null;
        this.input = null;
        this.audio = null;
        this.gameModeManager = null;
    }
    
    /**
     * Get debug information about the scene manager
     */
    getDebugInfo() {
        return {
            currentSceneType: this.getCurrentSceneType(),
            currentSceneId: this.getCurrentSceneId(),
            sceneHistoryLength: this.sceneHistory.length,
            hasActiveScene: !!this.activeScene
        };
    }
}
