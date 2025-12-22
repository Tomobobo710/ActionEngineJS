// actionengine/core/app.js

// Inject overlay CSS immediately when this script loads
(function() {
    const css = `:root {
  --primary: #00f0f0;
  --primary-dark: #00b0b0;
  --secondary: #ff4444;
  --background: #0a0a2a;
  --surface: #1a1a4a;
  --surface-light: #2a2a6a;
  --text: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.7);
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --transition-fast: 150ms;
  --transition-normal: 250ms;
  --transition-slow: 350ms;
  --cubic-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--background);
  color: var(--text);
  font-family: 'Orbitron', sans-serif;
}

#appContainer {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-start; 
  padding-top: calc(80px + var(--space-md));
  background: radial-gradient(circle at center, var(--surface) 0%, var(--background) 100%);
}

@media (orientation: landscape) {
  #appContainer {
    align-items: center;
    padding-top: 0;
  }
}

#gameCanvas, #guiCanvas, #debugCanvas {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: calc(80px + var(--space-xl));
}

@media (min-aspect-ratio: 4/3) {
    #gameCanvas, #guiCanvas, #debugCanvas {
        top: 50%;
        transform: translate(-50%, -50%);
    }
}

canvas {
  outline: none !important; 
}

.dpad-button {
    width: 60px;
    height: 60px;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    color: var(--text);
    font-size: 1.5rem;
    pointer-events: auto;
}

.action-button {
    width: 80px;
    height: 80px;
    background: rgba(255, 68, 68, 0.2);
    border: 2px solid rgba(255, 68, 68, 0.4);
    border-radius: 50%;
    color: var(--text);
    font-size: 2rem;
    pointer-events: auto;
}

#dpadUpContainer,
#dpadLeftContainer,
#dpadRightContainer,
#dpadDownContainer,
#button1Container,
#button2Container,
#button3Container,
#button4Container{
    position: absolute;
    z-index: 50;
    transition: all 0.3s ease;
}

@media (max-aspect-ratio: 3/4) {
    #dpadUpContainer {
        left: calc(25% - 30px);
        top: calc(60px + min(100vw, 100vh) + 10px);
    }
    #dpadLeftContainer {
        left: calc(25% - 90px);
        top: calc(60px + min(100vw, 100vh) + 80px);
    }
    #dpadRightContainer {
        left: calc(25% + 30px);
        top: calc(60px + min(100vw, 100vh) + 80px);
    }
    #dpadDownContainer {
        left: calc(25% - 30px);
        top: calc(60px + min(100vw, 100vh) + 150px);
    }

    #button1Container {
        right: calc(7% + 30px);
        top: calc(60px + min(100vw, 100vh) + 150px);
    }
    #button2Container {
        right: calc(7% + 90px);
        top: calc(60px + min(100vw, 100vh) + 80px);
    }
    #button3Container {
        right: calc(7% - 30px);
        top: calc(60px + min(100vw, 100vh) + 80px);
    }
    #button4Container {
        right: calc(7% + 30px);
        top: calc(60px + min(100vw, 100vh) + 10px);
    }
}

@media (min-aspect-ratio: 3/4) and (max-aspect-ratio: 4/3) {
    #dpadUpContainer {
        left: calc(var(--space-xl) + 60px);
        bottom: calc(var(--space-xl) + 140px);
    }
    #dpadLeftContainer {
        left: var(--space-xl);
        bottom: calc(var(--space-xl) + 70px);
    }
    #dpadRightContainer {
        left: calc(var(--space-xl) + 120px);
        bottom: calc(var(--space-xl) + 70px);
    }
    #dpadDownContainer {
        left: calc(var(--space-xl) + 60px);
        bottom: var(--space-xl);
    }

    #button1Container {
        right: calc(var(--space-xl) + 90px);
        bottom: var(--space-xl);
    }
    #button2Container {
        right: calc(var(--space-xl) + 150px);
        bottom: calc(var(--space-xl) + 70px);
    }
    #button3Container {
        right: calc(var(--space-xl) + 30px);
        bottom: calc(var(--space-xl) + 70px);
    }
    #button4Container {
        right: calc(var(--space-xl) + 90px);
        bottom: calc(var(--space-xl) + 140px);
    }
}

@media (min-aspect-ratio: 4/3) {
    #dpadUpContainer {
        left: calc(var(--space-xl) + 60px);
        bottom: calc(33vh + 70px);
    }
    #dpadLeftContainer {
        left: var(--space-xl);
        bottom: 33vh;
    }
    #dpadRightContainer {
        left: calc(var(--space-xl) + 120px);
        bottom: 33vh;
    }
    #dpadDownContainer {
        left: calc(var(--space-xl) + 60px);
        bottom: calc(33vh - 70px);
    }
    #button1Container {
        right: calc(var(--space-xl) + 90px);
        bottom: calc(33vh - 70px);
    }
    #button2Container {
        right: calc(var(--space-xl) + 150px);
        bottom: 33vh;
    }
    #button3Container {
        right: calc(var(--space-xl) + 30px);
        bottom: 33vh;
    }
    #button4Container {
        right: calc(var(--space-xl) + 90px);
        bottom: calc(33vh + 70px);
    }
}

#controlsToggleContainer,
#soundToggleContainer,
#fullscreenToggleContainer,
#pauseButtonContainer {
   position: absolute;
   top: var(--space-md);
   display: flex;
   z-index: 1000;
}

#controlsToggleContainer {
   left: 50%;
   transform: translateX(calc(-170px));
}

#soundToggleContainer {
   left: 50%;
   transform: translateX(calc(-80px));
}

#fullscreenToggleContainer {
   left: 50%;
   transform: translateX(10px);
}

#pauseButtonContainer {
   left: 50%;
   transform: translateX(100px);
}

@media (min-aspect-ratio: 4/3) {
   #controlsToggleContainer {
       left: var(--space-xl);
       transform: none;
   }

   #soundToggleContainer {
       left: calc(var(--space-xl) + 90px);
       transform: none;
   }

   #fullscreenToggleContainer {
       right: calc(var(--space-xl) + 90px);
       left: auto;
       transform: none;
   }

   #pauseButtonContainer {
       right: var(--space-xl);
       left: auto;
       transform: none;
   }
}

.ui-button {
  width: 80px;
  height: 80px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  color: var(--text);
  font-size: 1.2rem;
  cursor: pointer;
}

.hidden {
  display: none !important;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .menu-container {
      width: 90%;
      max-width: 400px;
      padding: var(--space-lg);
  }
  
  .dpad-button {
      width: 50px;
      height: 50px;
  }
  
  .action-button {
      width: 70px;
      height: 70px;
  }
}

@media (orientation: landscape) and (max-height: 600px) {
  #virtualControls {
      bottom: var(--space-md);
  }
  
  .dpad-button {
      width: 40px;
      height: 40px;
      font-size: 1.2rem;
  }
  
  .action-button {
      width: 60px;
      height: 60px;
      font-size: 1.5rem;
  }
}`;
    
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
})();

class App {
    constructor(options = {}) {
        this.threelayersystem = new CanvasManager();
        const canvases = this.threelayersystem.getCanvases();
        this.audio = new ActionAudioManager();
        this.input = new ActionInputHandler(this.audio, canvases);
        this.game = new Game(canvases, this.input, this.audio);
        
        // Fixed timestep configuration
        this.fixedTimeStep = options.fixedTimeStep || 1/60; // Default 60Hz
        this.maxAccumulatedTime = options.maxAccumulatedTime || 0.2; // Prevent spiral of death
        this.accumulatedTime = 0;
        
        this.lastTime = null;
        // Start the game loop
        console.log("[App] Starting game loop...");
        this.loop();
    }
    
    // Engine-driven loop
    loop(timestamp) {
        // Calculate deltaTime (time since last frame in seconds)
        const now = timestamp || performance.now();
        let deltaTime = this.lastTime ? (now - this.lastTime) / 1000 : 0;
        this.lastTime = now;
        
        // Cap deltaTime to prevent spiral of death on slow frames
        deltaTime = Math.min(deltaTime, 0.25);
        
        // Accumulate time for fixed updates
        this.accumulatedTime += deltaTime;
        this.accumulatedTime = Math.min(this.accumulatedTime, this.maxAccumulatedTime);
        
        // Capture input state for this frame (for regular updates)
        this.input.captureKeyState();
        this.input.setContext('update');
        
        // Pre-update phase (variable timestep, good for input handling)
        if (typeof this.game.action_pre_update === "function") {
            this.game.action_pre_update(deltaTime);
        }
        
        // Process fixed updates for physics and consistent game logic
        if (typeof this.game.action_fixed_update === "function") {
            // Check if we're going to do any physics updates this frame
            if (this.accumulatedTime >= this.fixedTimeStep) {
                // Capture fixed state ONCE before the physics loop starts
                this.input.captureFixedKeyState();
                this.input.setContext('fixed_update');
                
                // Run as many fixed updates as needed based on accumulated time
                while (this.accumulatedTime >= this.fixedTimeStep) {
                    this.game.action_fixed_update(this.fixedTimeStep);
                    this.accumulatedTime -= this.fixedTimeStep;
                }
                
                // Reset context back to update after physics is done
                this.input.setContext('update');
            }
        }
        
        // Update phase (variable timestep, good for non-physics logic)
        if (typeof this.game.action_update === "function") {
            this.game.action_update(deltaTime);
        }
        
        // Post-update phase (variable timestep)
        if (typeof this.game.action_post_update === "function") {
            this.game.action_post_update(deltaTime);
        }
        
        // Pre-draw phase
        if (typeof this.game.action_pre_draw === "function") {
            this.game.action_pre_draw();
        }
        
        // Draw phase
        if (typeof this.game.action_draw === "function") {
            // Pass an interpolation factor for smooth rendering between fixed steps
            const alpha = this.accumulatedTime / this.fixedTimeStep;
            this.game.action_draw(alpha);
        }
        
        // Post-draw phase
        if (typeof this.game.action_post_draw === "function") {
            this.game.action_post_draw();
        }
        
        // Schedule the next frame
        requestAnimationFrame((timestamp) => this.loop(timestamp));
    }
}

window.addEventListener("load", () => {
    window.game = new App();
});