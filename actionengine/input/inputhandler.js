// actionengine/input/inputhandler.js
class ActionInputHandler {
    constructor(audio, canvases) {
        this.audio = audio;
        this.canvases = canvases; // Store all canvas references
        this.virtualControls = false;
        this.isPaused = false;

        // Create containers
        this.virtualControlsContainer = this.createVirtualControlsContainer();
        this.uiControlsContainer = document.getElementById("UIControlsContainer");

        this.actionMap = new Map([
            ["KeyW", ["DirUp"]],
            ["KeyS", ["DirDown"]],
            ["KeyA", ["DirLeft"]],
            ["KeyD", ["DirRight"]],
            ["Space", ["Action1"]], // face button left
            ["ShiftLeft", ["Action2"]], // face button down
            ["KeyE", ["Action3"]], // face button right
            ["KeyQ", ["Action4"]], // face button up
            ["KeyZ", ["Action5"]], // Left Bumper
            ["KeyX", ["Action6"]], // Right Bumper
            ["KeyC", ["Action7"]], // Back Button
            ["KeyF", ["Action8"]], // Start Button
            ["F9", ["ActionDebugToggle"]],
            ["F3", ["ActionDebugToggle"]],
            ["Tab", ["ActionDebugToggle"]],

            // Numpad keys
            ["Numpad0", ["Numpad0"]],
            ["Numpad1", ["Numpad1"]],
            ["Numpad2", ["Numpad2"]],
            ["Numpad3", ["Numpad3"]],
            ["Numpad4", ["Numpad4"]],
            ["Numpad5", ["Numpad5"]],
            ["Numpad6", ["Numpad6"]],
            ["Numpad7", ["Numpad7"]],
            ["Numpad8", ["Numpad8"]],
            ["Numpad9", ["Numpad9"]],
            ["NumpadDecimal", ["NumpadDecimal"]], // Numpad period/del
            ["NumpadEnter", ["NumpadEnter"]], // Numpad enter
            ["NumpadAdd", ["NumpadAdd"]], // Numpad plus
            ["NumpadSubtract", ["NumpadSubtract"]] // Numpad minus
        ]);

        // Extract all key codes the game uses from actionMap
        this.gameKeyCodes = new Set();
        for (const [keyCode, _] of this.actionMap) {
            this.gameKeyCodes.add(keyCode);
        }

        // Add additional browser keys we want to block
        const additionalBlockedKeys = ['F5'];
        additionalBlockedKeys.forEach(key => this.gameKeyCodes.add(key));

        this.state = {
            keys: new Map(),
            pointer: {
                x: 0,
                y: 0,
                movementX: 0,
                movementY: 0,
                isDown: false,              // Keep for backwards compatibility (left click)
                downTimestamp: null,        // Keep for backwards compatibility
                buttons: {                  // New structure for multi-button support
                    left: false,
                    right: false,
                    middle: false
                }
            },
            elements: {
                gui: new Map(),
                game: new Map(),
                debug: new Map()
            },
            uiButtons: new Map([
                ["soundToggle", { isPressed: false }],
                ["controlsToggle", { isPressed: false }],
                ["fullscreenToggle", { isPressed: false }],
                ["pauseButton", { isPressed: false }]
            ]),
            virtualControlsVisible: false
        };

        // Frame tracking for proper "just pressed" detection
        this.currentFramePressed = new Map(); // Keys pressed this frame
        this.previousFramePressed = new Map(); // Keys pressed last frame
        
        // Legacy pointer tracking (for backward compatibility)
        this.currentPointerDown = false;
        this.previousPointerDown = false;
        
        // New mouse button tracking
        this.currentMouseButtonsDown = {
            left: false,
            right: false,
            middle: false
        };
        this.previousMouseButtonsDown = {
            left: false,
            right: false,
            middle: false
        };
        
        // Elements frame tracking
        this.currentElementsPressed = {
            gui: new Map(),
            game: new Map(),
            debug: new Map()
        };
        this.previousElementsPressed = {
            gui: new Map(),
            game: new Map(), 
            debug: new Map()
        };
        this.currentElementsHovered = {
            gui: new Map(),
            game: new Map(),
            debug: new Map()
        };
        this.previousElementsHovered = {
            gui: new Map(),
            game: new Map(), 
            debug: new Map()
        };
        // UI button frame tracking
        this.currentUIButtonsPressed = new Map();
        this.previousUIButtonsPressed = new Map();

        // Block browser defaults for game keys
        window.addEventListener("keydown", (e) => {
            //console.log("Keydown captured:", e.code);
            
            // Update key state
            this.state.keys.set(e.code, true);
            
            // Prevent default browser behavior for any keys we care about
            if (this.actionMap.has(e.code) ||
                e.code === 'F5' ||
                (e.ctrlKey && (e.code === 'KeyS' || e.code === 'KeyP' || e.code === 'KeyR')) ||
                (e.altKey && e.code === 'ArrowLeft')) {
                //console.log("Preventing default for:", e.code);
                e.preventDefault();
            }
        }, false);

        window.addEventListener("keyup", (e) => {
            //console.log("Keyup captured:", e.code);
            
            // Update key state
            this.state.keys.set(e.code, false);
            
            // Prevent default browser behavior
            if (this.actionMap.has(e.code) ||
                e.code === 'F5') {
                //console.log("Preventing default for:", e.code);
                e.preventDefault();
            }
        }, false);
        
        // Only block context menu when we actually want to use right click
        // Comment this out if you want context menu functionality
        document.addEventListener('contextmenu', (e) => e.preventDefault());

        this.createUIControls();
        this.createVirtualControls();
        
        this.setupPointerListeners();
        this.setupVirtualButtons();
        this.setupUIButtons();

        // Make game canvas focusable
        if (this.canvases.gameCanvas) {
            this.canvases.gameCanvas.tabIndex = 1;
            this.canvases.gameCanvas.focus();
        }
    }

    // Called by the engine at the start of each frame
    resetFrameState() {
        // Move current to previous for keys
        this.previousFramePressed = new Map(this.currentFramePressed);
        
        // Update current with the latest key state
        this.currentFramePressed = new Map();
        for (const [key, isPressed] of this.state.keys.entries()) {
            if (isPressed) {
                this.currentFramePressed.set(key, true);
            }
        }
        
        // Handle legacy pointer state (left click only)
        this.previousPointerDown = this.currentPointerDown;
        this.currentPointerDown = this.state.pointer.isDown;
        
        // Handle multi-button mouse state
        this.previousMouseButtonsDown.left = this.currentMouseButtonsDown.left;
        this.previousMouseButtonsDown.right = this.currentMouseButtonsDown.right;
        this.previousMouseButtonsDown.middle = this.currentMouseButtonsDown.middle;
        
        this.currentMouseButtonsDown.left = this.state.pointer.buttons.left;
        this.currentMouseButtonsDown.right = this.state.pointer.buttons.right;
        this.currentMouseButtonsDown.middle = this.state.pointer.buttons.middle;
        
        // Handle elements state
        for (const layer of Object.keys(this.state.elements)) {
            this.previousElementsPressed[layer] = new Map(this.currentElementsPressed[layer]);
            this.currentElementsPressed[layer] = new Map();
            
            this.state.elements[layer].forEach((element, id) => {
                if (element.isPressed) {
                    this.currentElementsPressed[layer].set(id, true);
                }
            });
        }
        // Handle elements hover state
        for (const layer of Object.keys(this.state.elements)) {
            // Existing pressed state tracking...

            // New hover state tracking
            this.previousElementsHovered[layer] = new Map(this.currentElementsHovered[layer]);
            this.currentElementsHovered[layer] = new Map();

            this.state.elements[layer].forEach((element, id) => {
                // Existing pressed check...

                // Add hover check
                if (element.isHovered) {
                    this.currentElementsHovered[layer].set(id, true);
                }
            });
        }
        // Handle UI buttons state
        this.previousUIButtonsPressed = new Map(this.currentUIButtonsPressed);
        this.currentUIButtonsPressed = new Map();
        
        for (const [id, buttonState] of this.state.uiButtons.entries()) {
            if (buttonState.isPressed) {
                this.currentUIButtonsPressed.set(id, true);
            }
        }
    }

    createVirtualControlsContainer() {
        const container = document.createElement("div");
        container.id = "virtualControls";
        container.classList.add("hidden");
        document.getElementById("appContainer").appendChild(container);
        return container;
    }

    createUIControls() {
        const controlsToggleContainer = document.createElement("div");
        controlsToggleContainer.id = "controlsToggleContainer";
        const controlsToggle = document.createElement("button");
        controlsToggle.id = "controlsToggle";
        controlsToggle.className = "ui-button";
        controlsToggle.setAttribute("aria-label", "Toggle Virtual Controls");
        controlsToggle.textContent = "🖐️";
        controlsToggleContainer.appendChild(controlsToggle);

        const soundToggleContainer = document.createElement("div");
        soundToggleContainer.id = "soundToggleContainer";
        const soundToggle = document.createElement("button");
        soundToggle.id = "soundToggle";
        soundToggle.className = "ui-button";
        soundToggle.setAttribute("aria-label", "Toggle Sound");
        soundToggle.textContent = "🔊";
        soundToggleContainer.appendChild(soundToggle);

        const fullscreenToggleContainer = document.createElement("div");
        fullscreenToggleContainer.id = "fullscreenToggleContainer";
        const fullscreenToggle = document.createElement("button");
        fullscreenToggle.id = "fullscreenToggle";
        fullscreenToggle.className = "ui-button";
        fullscreenToggle.setAttribute("aria-label", "Toggle Fullscreen");
        fullscreenToggle.textContent = "↔️";
        fullscreenToggleContainer.appendChild(fullscreenToggle);

        const pauseButtonContainer = document.createElement("div");
        pauseButtonContainer.id = "pauseButtonContainer";
        const pauseButton = document.createElement("button");
        pauseButton.id = "pauseButton";
        pauseButton.className = "ui-button";
        pauseButton.setAttribute("aria-label", "Pause");
        pauseButton.textContent = "⏸️";
        pauseButtonContainer.appendChild(pauseButton);

        this.uiControlsContainer.appendChild(controlsToggleContainer);
        this.uiControlsContainer.appendChild(soundToggleContainer);
        this.uiControlsContainer.appendChild(fullscreenToggleContainer);
        this.uiControlsContainer.appendChild(pauseButtonContainer);
    }

    createVirtualControls() {
        const buttons = [
            { id: "dpadUp", class: "dpad-button", key: "KeyW", text: "↑" },
            { id: "dpadDown", class: "dpad-button", key: "KeyS", text: "↓" },
            { id: "dpadLeft", class: "dpad-button", key: "KeyA", text: "←" },
            { id: "dpadRight", class: "dpad-button", key: "KeyD", text: "→" },
            { id: "button1", class: "action-button", key: "Space", text: "1" },
            { id: "button2", class: "action-button", key: "ShiftLeft", text: "2" },
            { id: "button3", class: "action-button", key: "KeyE", text: "3" },
            { id: "button4", class: "action-button", key: "KeyQ", text: "4" }
        ];

        buttons.forEach((btn) => {
            const container = document.createElement("div");
            container.id = `${btn.id}Container`;

            const button = document.createElement("button");
            button.id = btn.id;
            button.className = btn.class;
            button.dataset.key = btn.key;
            button.textContent = btn.text;

            container.appendChild(button);
            this.virtualControlsContainer.appendChild(container);
        });
    }

    setupUIButtons() {
        const buttons = {
            soundToggle: {
                element: document.getElementById("soundToggle"),
                upCallback: () => {
                    const enabled = this.audio.toggle();
                    document.getElementById("soundToggle").textContent = enabled ? "🔊" : "🔇";
                }
            },
            controlsToggle: {
                element: document.getElementById("controlsToggle"),
                upCallback: () => {
                    const enabled = this.toggleVirtualControls();
                    document.getElementById("controlsToggle").textContent = enabled ? "⬆️" : "🖐️";
                }
            },
            fullscreenToggle: {
                element: document.getElementById("fullscreenToggle"),
                upCallback: () => {
                    const willBeEnabled = !document.fullscreenElement;
                    if (willBeEnabled) {
                        document.documentElement.requestFullscreen();
                    } else {
                        document.exitFullscreen();
                    }
                }
            },
            pauseButton: {
                element: document.getElementById("pauseButton"),
                upCallback: () => {
                    const isPaused = this.togglePause();
                    document.getElementById("pauseButton").textContent = isPaused ? "▶️" : "⏸️";
                }
            }
        };

        Object.entries(buttons).forEach(([id, config]) => {
            const handleStart = (e) => {
                e.preventDefault();
                this.state.uiButtons.set(id, { isPressed: true });
            };

            const handleEnd = (e) => {
                e.preventDefault();
                this.state.uiButtons.set(id, { isPressed: false });
                config.upCallback();
            };

            config.element.addEventListener("touchstart", handleStart, { passive: false });
            config.element.addEventListener("touchend", handleEnd, { passive: false });
            config.element.addEventListener("mousedown", handleStart);
            config.element.addEventListener("mouseup", handleEnd);
        });
    }

    setupPointerListeners() {
        // DEBUG LAYER
        this.canvases.debugCanvas.addEventListener("mousemove", (e) => {
            const pos = this.getCanvasPosition(e);
            this.state.pointer.x = pos.x;
            this.state.pointer.y = pos.y;
            this.state.pointer.movementX = e.movementX || 0;
            this.state.pointer.movementY = e.movementY || 0;

            let handledByDebug = false;
            this.state.elements.debug.forEach((element) => {
                const wasHovered = element.isHovered;
                element.isHovered = this.isPointInBounds(pos.x, pos.y, element.bounds());

                if (!wasHovered && element.isHovered) {
                    element.hoverTimestamp = performance.now();
                    handledByDebug = true;
                }
            });

            if (!handledByDebug) {
                const newEvent = new MouseEvent("mousemove", e);
                this.canvases.guiCanvas.dispatchEvent(newEvent);
            }
        });

        this.canvases.debugCanvas.addEventListener("mousedown", (e) => {
            const pos = this.getCanvasPosition(e);
            this.state.pointer.x = pos.x;
            this.state.pointer.y = pos.y;
            
            // Track the specific button pressed
            const button = e.button; // 0: left, 1: middle, 2: right
            
            // Update button-specific state
            if (button === 0) {
                this.state.pointer.buttons.left = true;
                // Maintain backward compatibility
                this.state.pointer.isDown = true;
                this.state.pointer.downTimestamp = performance.now();
            }
            if (button === 1) this.state.pointer.buttons.middle = true;
            if (button === 2) this.state.pointer.buttons.right = true;

            let handledByDebug = false;
            this.state.elements.debug.forEach((element) => {
                if (element.isHovered) {
                    element.isPressed = true;
                    handledByDebug = true;
                }
            });

            if (!handledByDebug) {
                const newEvent = new MouseEvent("mousedown", e);
                this.canvases.guiCanvas.dispatchEvent(newEvent);
            }
        });

        this.canvases.debugCanvas.addEventListener("mouseup", (e) => {
            const pos = this.getCanvasPosition(e);
            this.state.pointer.x = pos.x;
            this.state.pointer.y = pos.y;
            
            // Track the specific button released
            const button = e.button; // 0: left, 1: middle, 2: right
            
            // Update button-specific state
            if (button === 0) {
                this.state.pointer.buttons.left = false;
                // Maintain backward compatibility
                this.state.pointer.isDown = false;
                this.state.pointer.downTimestamp = null;
            }
            if (button === 1) this.state.pointer.buttons.middle = false;
            if (button === 2) this.state.pointer.buttons.right = false;

            let handledByDebug = false;
            this.state.elements.debug.forEach((element) => {
                if (element.isPressed) {
                    element.isPressed = false;
                    handledByDebug = true;
                }
            });

            if (!handledByDebug) {
                const newEvent = new MouseEvent("mouseup", e);
                this.canvases.guiCanvas.dispatchEvent(newEvent);
            }
        });

        this.canvases.debugCanvas.addEventListener(
            "touchstart",
            (e) => {
                e.preventDefault();
                const pos = this.getCanvasPosition(e.touches[0]);
                this.state.pointer.x = pos.x;
                this.state.pointer.y = pos.y;
                
                // For touch, always treat as left button
                this.state.pointer.buttons.left = true;
                this.state.pointer.isDown = true;
                this.state.pointer.downTimestamp = performance.now();

                let handledByDebug = false;
                this.state.elements.debug.forEach((element) => {
                    if (this.isPointInBounds(pos.x, pos.y, element.bounds())) {
                        element.isPressed = true;
                        handledByDebug = true;
                    }
                });

                if (!handledByDebug) {
                    const newEvent = new TouchEvent("touchstart", e);
                    this.canvases.guiCanvas.dispatchEvent(newEvent);
                }
            },
            { passive: false }
        );

        this.canvases.debugCanvas.addEventListener(
            "touchend",
            (e) => {
                e.preventDefault();
                
                // For touch, always treat as left button
                this.state.pointer.buttons.left = false;
                this.state.pointer.isDown = false;
                this.state.pointer.downTimestamp = null;

                let handledByDebug = false;
                this.state.elements.debug.forEach((element) => {
                    if (element.isPressed) {
                        element.isPressed = false;
                        handledByDebug = true;
                    }
                });

                if (!handledByDebug) {
                    const newEvent = new TouchEvent("touchend", e);
                    this.canvases.guiCanvas.dispatchEvent(newEvent);
                }
            },
            { passive: false }
        );

        this.canvases.debugCanvas.addEventListener(
            "touchmove",
            (e) => {
                e.preventDefault();
                const pos = this.getCanvasPosition(e.touches[0]);
                this.state.pointer.x = pos.x;
                this.state.pointer.y = pos.y;

                let handledByDebug = false;
                this.state.elements.debug.forEach((element) => {
                    const wasHovered = element.isHovered;
                    element.isHovered = this.isPointInBounds(pos.x, pos.y, element.bounds());

                    if (!wasHovered && element.isHovered) {
                        element.hoverTimestamp = performance.now();
                        handledByDebug = true;
                    }
                });

                if (!handledByDebug) {
                    const newEvent = new TouchEvent("touchmove", e);
                    this.canvases.guiCanvas.dispatchEvent(newEvent);
                }
            },
            { passive: false }
        );

        // GUI LAYER
        this.canvases.guiCanvas.addEventListener("mousemove", (e) => {
            const pos = this.getCanvasPosition(e);
            this.state.pointer.x = pos.x;
            this.state.pointer.y = pos.y;
            this.state.pointer.movementX = e.movementX || 0;
            this.state.pointer.movementY = e.movementY || 0;

            let handledByGui = false;
            this.state.elements.gui.forEach((element) => {
                const wasHovered = element.isHovered;
                element.isHovered = this.isPointInBounds(pos.x, pos.y, element.bounds());

                if (!wasHovered && element.isHovered) {
                    element.hoverTimestamp = performance.now();
                    handledByGui = true;
                }
            });

            if (!handledByGui) {
                const newEvent = new MouseEvent("mousemove", e);
                this.canvases.gameCanvas.dispatchEvent(newEvent);
            }
        });

        this.canvases.guiCanvas.addEventListener("mousedown", (e) => {
            const pos = this.getCanvasPosition(e);
            this.state.pointer.x = pos.x;
            this.state.pointer.y = pos.y;
            
            // Track the specific button pressed
            const button = e.button; // 0: left, 1: middle, 2: right
            
            // Update button-specific state
            if (button === 0) {
                this.state.pointer.buttons.left = true;
                // Maintain backward compatibility
                this.state.pointer.isDown = true;
                this.state.pointer.downTimestamp = performance.now();
            }
            if (button === 1) this.state.pointer.buttons.middle = true;
            if (button === 2) this.state.pointer.buttons.right = true;

            let handledByGui = false;
            this.state.elements.gui.forEach((element) => {
                if (element.isHovered) {
                    element.isPressed = true;
                    handledByGui = true;
                }
            });

            if (!handledByGui) {
                const newEvent = new MouseEvent("mousedown", e);
                this.canvases.gameCanvas.dispatchEvent(newEvent);
            }
        });

        this.canvases.guiCanvas.addEventListener("mouseup", (e) => {
            const pos = this.getCanvasPosition(e);
            this.state.pointer.x = pos.x;
            this.state.pointer.y = pos.y;
            
            // Track the specific button released
            const button = e.button; // 0: left, 1: middle, 2: right
            
            // Update button-specific state
            if (button === 0) {
                this.state.pointer.buttons.left = false;
                // Maintain backward compatibility
                this.state.pointer.isDown = false;
                this.state.pointer.downTimestamp = null;
            }
            if (button === 1) this.state.pointer.buttons.middle = false;
            if (button === 2) this.state.pointer.buttons.right = false;

            let handledByGui = false;
            this.state.elements.gui.forEach((element) => {
                if (element.isPressed) {
                    element.isPressed = false;
                    handledByGui = true;
                }
            });

            if (!handledByGui) {
                const newEvent = new MouseEvent("mouseup", e);
                this.canvases.gameCanvas.dispatchEvent(newEvent);
            }
        });

        this.canvases.guiCanvas.addEventListener(
            "touchstart",
            (e) => {
                e.preventDefault();
                const pos = this.getCanvasPosition(e.touches[0]);
                this.state.pointer.x = pos.x;
                this.state.pointer.y = pos.y;
                
                // For touch, always treat as left button
                this.state.pointer.buttons.left = true;
                this.state.pointer.isDown = true;
                this.state.pointer.downTimestamp = performance.now();

                let handledByGui = false;
                this.state.elements.gui.forEach((element) => {
                    if (this.isPointInBounds(pos.x, pos.y, element.bounds())) {
                        element.isPressed = true;
                        handledByGui = true;
                    }
                });

                if (!handledByGui) {
                    const newEvent = new TouchEvent("touchstart", e);
                    this.canvases.gameCanvas.dispatchEvent(newEvent);
                }
            },
            { passive: false }
        );

        this.canvases.guiCanvas.addEventListener(
            "touchend",
            (e) => {
                e.preventDefault();
                
                // For touch, always treat as left button
                this.state.pointer.buttons.left = false;
                this.state.pointer.isDown = false;
                this.state.pointer.downTimestamp = null;

                let handledByGui = false;
                this.state.elements.gui.forEach((element) => {
                    if (element.isPressed) {
                        element.isPressed = false;
                        handledByGui = true;
                    }
                });

                if (!handledByGui) {
                    const newEvent = new TouchEvent("touchend", e);
                    this.canvases.gameCanvas.dispatchEvent(newEvent);
                }
            },
            { passive: false }
        );

        this.canvases.guiCanvas.addEventListener(
            "touchmove",
            (e) => {
                e.preventDefault();
                const pos = this.getCanvasPosition(e.touches[0]);
                this.state.pointer.x = pos.x;
                this.state.pointer.y = pos.y;

                let handledByGui = false;
                this.state.elements.gui.forEach((element) => {
                    const wasHovered = element.isHovered;
                    element.isHovered = this.isPointInBounds(pos.x, pos.y, element.bounds());

                    if (!wasHovered && element.isHovered) {
                        element.hoverTimestamp = performance.now();
                        handledByGui = true;
                    }
                });

                if (!handledByGui) {
                    const newEvent = new TouchEvent("touchmove", e);
                    this.canvases.gameCanvas.dispatchEvent(newEvent);
                }
            },
            { passive: false }
        );

        // GAME LAYER
        this.canvases.gameCanvas.addEventListener("mousemove", (e) => {
            const pos = this.getCanvasPosition(e);
            this.state.pointer.x = pos.x;
            this.state.pointer.y = pos.y;
            this.state.pointer.movementX = e.movementX || 0;
            this.state.pointer.movementY = e.movementY || 0;

            this.state.elements.game.forEach((element) => {
                const wasHovered = element.isHovered;
                element.isHovered = this.isPointInBounds(pos.x, pos.y, element.bounds());

                if (!wasHovered && element.isHovered) {
                    element.hoverTimestamp = performance.now();
                }
            });
        });

        this.canvases.gameCanvas.addEventListener("mousedown", (e) => {
            const pos = this.getCanvasPosition(e);
            this.state.pointer.x = pos.x;
            this.state.pointer.y = pos.y;
            
            // Track the specific button pressed
            const button = e.button; // 0: left, 1: middle, 2: right
            
            // Update button-specific state
            if (button === 0) {
                this.state.pointer.buttons.left = true;
                // Maintain backward compatibility
                this.state.pointer.isDown = true;
                this.state.pointer.downTimestamp = performance.now();
            }
            if (button === 1) this.state.pointer.buttons.middle = true;
            if (button === 2) this.state.pointer.buttons.right = true;

            this.state.elements.game.forEach((element) => {
                if (element.isHovered) {
                    element.isPressed = true;
                }
            });
        });

        this.canvases.gameCanvas.addEventListener("mouseup", (e) => {
            const pos = this.getCanvasPosition(e);
            this.state.pointer.x = pos.x;
            this.state.pointer.y = pos.y;
            
            // Track the specific button released
            const button = e.button; // 0: left, 1: middle, 2: right
            
            // Update button-specific state
            if (button === 0) {
                this.state.pointer.buttons.left = false;
                // Maintain backward compatibility
                this.state.pointer.isDown = false;
                this.state.pointer.downTimestamp = null;
            }
            if (button === 1) this.state.pointer.buttons.middle = false;
            if (button === 2) this.state.pointer.buttons.right = false;

            this.state.elements.game.forEach((element) => {
                if (element.isPressed) {
                    element.isPressed = false;
                }
            });
        });

        this.canvases.gameCanvas.addEventListener(
            "touchstart",
            (e) => {
                e.preventDefault();
                const pos = this.getCanvasPosition(e.touches[0]);
                this.state.pointer.x = pos.x;
                this.state.pointer.y = pos.y;
                
                // For touch, always treat as left button
                this.state.pointer.buttons.left = true;
                this.state.pointer.isDown = true;
                this.state.pointer.downTimestamp = performance.now();

                this.state.elements.game.forEach((element) => {
                    if (this.isPointInBounds(pos.x, pos.y, element.bounds())) {
                        element.isPressed = true;
                    }
                });
            },
            { passive: false }
        );

        this.canvases.gameCanvas.addEventListener(
            "touchend",
            (e) => {
                e.preventDefault();
                
                // For touch, always treat as left button
                this.state.pointer.buttons.left = false;
                this.state.pointer.isDown = false;
                this.state.pointer.downTimestamp = null;

                this.state.elements.game.forEach((element) => {
                    if (element.isPressed) {
                        element.isPressed = false;
                    }
                });
            },
            { passive: false }
        );

        this.canvases.gameCanvas.addEventListener(
            "touchmove",
            (e) => {
                e.preventDefault();
                const pos = this.getCanvasPosition(e.touches[0]);
                this.state.pointer.x = pos.x;
                this.state.pointer.y = pos.y;

                this.state.elements.game.forEach((element) => {
                    const wasHovered = element.isHovered;
                    element.isHovered = this.isPointInBounds(pos.x, pos.y, element.bounds());

                    if (!wasHovered && element.isHovered) {
                        element.hoverTimestamp = performance.now();
                    }
                });
            },
            { passive: false }
        );
        
        document.addEventListener("mousemove", (e) => {
            if (document.pointerLockElement) {
                this.state.pointer.movementX = e.movementX;
                this.state.pointer.movementY = e.movementY;
            }
        });
    }

    getLockedPointerMovement() {
        if (!document.pointerLockElement) {
            return { x: 0, y: 0 };
        }
        // Return the raw movement values
        return {
            x: this.state.pointer.movementX,
            y: this.state.pointer.movementY
        };
    }

    getCanvasPosition(e) {
        const canvas = document.getElementById("gameCanvas");
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    isPointInBounds(x, y, bounds) {
        // Use simple top-left based collision detection
        return x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
    }

    setupVirtualButtons() {
        const buttons = document.querySelectorAll(".dpad-button, .action-button");

        buttons.forEach((button) => {
            const key = button.dataset.key;

            const handleStart = (e) => {
                e.preventDefault();
                this.state.keys.set(key, true);
            };

            const handleEnd = (e) => {
                e.preventDefault();
                this.state.keys.set(key, false);
            };

            button.addEventListener("touchstart", handleStart, { passive: false });
            button.addEventListener("touchend", handleEnd, { passive: false });
            button.addEventListener("mousedown", handleStart);
            button.addEventListener("mouseup", handleEnd);
            button.addEventListener("mouseleave", handleEnd);
        });
    }

    registerElement(id, element, layer = "gui") {
        if (!this.state.elements[layer]) {
            console.warn(`[ActionInputHandler] Layer ${layer} doesn't exist, defaulting to gui`);
            layer = "gui";
        }

        this.state.elements[layer].set(id, {
            bounds: element.bounds,
            isHovered: false,
            hoverTimestamp: null, // Keep for compatibility
            isPressed: false,
            isActive: false,
            activeTimestamp: null
        });
    }

    isElementJustPressed(id, layer = "gui") {
        const isCurrentlyPressed = this.currentElementsPressed[layer].has(id);
        const wasPreviouslyPressed = this.previousElementsPressed[layer].has(id);
        
        // Element is pressed now but wasn't in the previous frame
        return isCurrentlyPressed && !wasPreviouslyPressed;
    }

    isElementPressed(id, layer = "gui") {
        const element = this.state.elements[layer]?.get(id);
        return element ? element.isPressed : false;
    }

    isElementJustHovered(id, layer = "gui", threshold = 16) {
        const element = this.state.elements[layer]?.get(id);
        if (element?.hoverTimestamp && performance.now() - element.hoverTimestamp < threshold) {
            element.hoverTimestamp = null;
            return true;
        }
        return false;
    }

    isElementHovered(id, layer = "gui") {
        const element = this.state.elements[layer]?.get(id);
        return element ? element.isHovered : false;
    }

    isElementActive(id, layer = "gui") {
        const element = this.state.elements[layer]?.get(id);
        return element ? element.isActive : false;
    }

    // Keep existing pointer methods for backward compatibility
    isPointerDown() {
        return this.state.pointer.isDown;
    }

    isPointerJustDown() {
        // Pointer is down now but wasn't in the previous frame
        return this.currentPointerDown && !this.previousPointerDown;
    }

    // New mouse button methods
    isLeftMouseButtonDown() {
        return this.state.pointer.buttons.left;
    }

    isRightMouseButtonDown() {
        return this.state.pointer.buttons.right;
    }

    isMiddleMouseButtonDown() {
        return this.state.pointer.buttons.middle;
    }

    isLeftMouseButtonJustPressed() {
        return this.currentMouseButtonsDown.left && !this.previousMouseButtonsDown.left;
    }

    isRightMouseButtonJustPressed() {
        return this.currentMouseButtonsDown.right && !this.previousMouseButtonsDown.right;
    }

    isMiddleMouseButtonJustPressed() {
        return this.currentMouseButtonsDown.middle && !this.previousMouseButtonsDown.middle;
    }

    // Generic method that takes a button parameter
    isMouseButtonDown(button) {
        // button: 0=left, 1=middle, 2=right
        if (button === 0) return this.state.pointer.buttons.left;
        if (button === 1) return this.state.pointer.buttons.middle;
        if (button === 2) return this.state.pointer.buttons.right;
        return false;
    }

    isMouseButtonJustPressed(button) {
        // button: 0=left, 1=middle, 2=right
        if (button === 0) return this.currentMouseButtonsDown.left && !this.previousMouseButtonsDown.left;
        if (button === 1) return this.currentMouseButtonsDown.middle && !this.previousMouseButtonsDown.middle;
        if (button === 2) return this.currentMouseButtonsDown.right && !this.previousMouseButtonsDown.right;
        return false;
    }

    isUIButtonPressed(buttonId) {
        const buttonState = this.state.uiButtons.get(buttonId);
        return buttonState ? buttonState.isPressed : false;
    }

    isUIButtonJustPressed(buttonId) {
        const isCurrentlyPressed = this.currentUIButtonsPressed.has(buttonId);
        const wasPreviouslyPressed = this.previousUIButtonsPressed.has(buttonId);
        
        // Button is pressed now but wasn't in the previous frame
        return isCurrentlyPressed && !wasPreviouslyPressed;
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }

    toggleVirtualControls() {
        this.state.virtualControlsVisible = !this.state.virtualControlsVisible;
        this.virtualControlsContainer.classList.toggle("hidden", !this.state.virtualControlsVisible);
        return this.state.virtualControlsVisible;
    }

    isKeyPressed(action) {
        for (const [key, actions] of this.actionMap) {
            if (actions.includes(action)) {
                return this.state.keys.get(key) || false;
            }
        }
        return false;
    }

    isKeyJustPressed(action) {
        for (const [key, actions] of this.actionMap) {
            if (actions.includes(action)) {
                // Check if key was just pressed this frame
                const isCurrentlyPressed = this.currentFramePressed.has(key);
                const wasPreviouslyPressed = this.previousFramePressed.has(key);
                
                // Key is pressed now but wasn't in the previous frame
                if (isCurrentlyPressed && !wasPreviouslyPressed) {
                    return true;
                }
            }
        }
        return false;
    }

    getPointerPosition() {
        return {
            x: this.state.pointer.x,
            y: this.state.pointer.y,
            movementX: this.state.pointer.movementX,
            movementY: this.state.pointer.movementY
        };
    }

    removeElement(id, layer = "gui") {
        if (!this.state.elements[layer]) {
            console.warn(`[ActionInputHandler] Layer ${layer} doesn't exist`);
            return false;
        }
        return this.state.elements[layer].delete(id);
    }

    clearLayerElements(layer = "gui") {
        if (!this.state.elements[layer]) {
            console.warn(`[ActionInputHandler] Layer ${layer} doesn't exist`);
            return false;
        }
        this.state.elements[layer].clear();
        return true;
    }

    clearAllElements() {
        Object.keys(this.state.elements).forEach((layer) => {
            this.state.elements[layer].clear();
        });
    }
}