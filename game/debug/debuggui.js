// game/debug/debuggui.js
class DebugGui {
    constructor(debugCanvas, game) {
        this.canvas = debugCanvas;
        this.ctx = debugCanvas.getContext("2d");
        this.game = game;
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.currentFPS = 0;
        
        // Panel visibility state tracking
        this.panels = {};
        
        // Initialize debug panels
        this.initializeDebugPanels();
    }
    
    // Initialize all debug panel instances
    initializeDebugPanels() {
        // Create SceneDebugPanel instance
        this.sceneDebugPanel = new SceneDebugPanel(this.canvas, this.game);
        this.panels.scene = {
            instance: this.sceneDebugPanel,
            toggleId: 'sceneDebugToggle'
        };
        
        // Create WeatherDebugPanel instance
        this.weatherDebugPanel = new WeatherDebugPanel(this.canvas, this.game);
        this.panels.weather = {
            instance: this.weatherDebugPanel,
            toggleId: 'weatherDebugToggle'
        };
        
        // Create LightingDebugPanel instance (if not already created by the game)
        if (!this.game.lightingDebugPanel) {
            this.game.lightingDebugPanel = new LightingDebugPanel(this.canvas, this.game);
        }
        this.panels.lighting = {
            instance: this.game.lightingDebugPanel,
            toggleId: 'lightingToggleButton'
        };
    }
    
    // Clear the canvas
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Calculate and return the frames per second
    getFPS() {
        const now = performance.now();
        const delta = now - this.lastFrameTime;
        this.frameCount++;

        if (delta >= 1000) {
            this.currentFPS = (this.frameCount * 1000) / delta;
            this.frameCount = 0;
            this.lastFrameTime = now;
        }

        return this.currentFPS;
    }
    
    // Update all panels
    update() {
        // Update each panel
        Object.values(this.panels).forEach(panel => {
            if (panel.instance && typeof panel.instance.update === 'function') {
                panel.instance.update();
            }
        });
        
        // Check for panel visibility conflicts and resolve them
        this.resolvePanelVisibilityConflicts();
    }
    
    // Resolve visibility conflicts between panels
    resolvePanelVisibilityConflicts() {
        // Count visible panels
        let visiblePanels = [];
        Object.entries(this.panels).forEach(([key, panel]) => {
            if (panel.instance && panel.instance.visible) {
                visiblePanels.push({
                    key: key,
                    panel: panel.instance
                });
            }
        });
        
        // If more than one panel is visible, hide all but the last one activated
        if (visiblePanels.length > 1) {
            // Sort by most recently activated (assuming panels store timestamp when shown)
            visiblePanels.sort((a, b) => {
                const aTime = a.panel.lastActivatedTime || 0;
                const bTime = b.panel.lastActivatedTime || 0;
                return aTime - bTime;
            });
            
            // Keep the most recently activated panel (last in the array) visible
            const keepVisible = visiblePanels[visiblePanels.length - 1].key;
            
            // Hide all other panels
            visiblePanels.slice(0, -1).forEach(panelInfo => {
                if (panelInfo.panel && typeof panelInfo.panel.onHide === 'function') {
                    panelInfo.panel.visible = false;
                    panelInfo.panel.onHide();
                    console.log(`[DebugGui] Hiding ${panelInfo.key} panel due to visibility conflict with ${keepVisible}`);
                }
            });
        }
    }

    // Main draw function
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw each panel
        Object.values(this.panels).forEach(panel => {
            if (panel.instance && typeof panel.instance.draw === 'function') {
                panel.instance.draw();
            }
        });
    }
}