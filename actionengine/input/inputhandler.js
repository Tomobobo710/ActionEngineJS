class ActionInputHandler {
    constructor(audio, canvases) {
        this.audio = audio;
        this.canvases = canvases;
        this.virtualControls = false;
        this.isPaused = false;

        // Track which context we're in (update or fixed_update)
        this.currentContext = 'update';

        // Create containers
        this.virtualControlsContainer = this.createVirtualControlsContainer();
        this.uiControlsContainer = document.getElementById("UIControlsContainer");

        // Setup action mappings
        this.setupActionMap();
        
        // Raw state - continuously updated by events
        this.rawState = {
            keys: new Map(),
            pointer: {
                x: 0,
                y: 0,
                movementX: 0,
                movementY: 0,
                isDown: false,
                downTimestamp: null,
                buttons: {
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
        
        // Frame snapshots - updated at frame boundaries
        this.currentSnapshot = {
            keys: new Map(),
            mouseButtons: {
                left: false,
                right: false,
                middle: false
            },
            pointer: {
                isDown: false
            },
            elements: {
                gui: new Map(),
                game: new Map(),
                debug: new Map()
            },
            elementsHovered: {
                gui: new Map(),
                game: new Map(),
                debug: new Map()
            },
            uiButtons: new Map()
        };
        
        this.previousSnapshot = {
            keys: new Map(),
            mouseButtons: {
                left: false,
                right: false,
                middle: false
            },
            pointer: {
                isDown: false
            },
            elements: {
                gui: new Map(),
                game: new Map(),
                debug: new Map()
            },
            elementsHovered: {
                gui: new Map(),
                game: new Map(),
                debug: new Map()
            },
            uiButtons: new Map()
        };
        
        // Fixed snapshots - updated at fixed timesteps
        this.currentFixedSnapshot = {
            keys: new Map(),
            mouseButtons: {
                left: false,
                right: false,
                middle: false
            },
            pointer: {
                isDown: false
            },
            elements: {
                gui: new Map(),
                game: new Map(),
                debug: new Map()
            },
            elementsHovered: {
                gui: new Map(),
                game: new Map(),
                debug: new Map()
            },
            uiButtons: new Map()
        };
        
        this.previousFixedSnapshot = {
            keys: new Map(),
            mouseButtons: {
                left: false,
                right: false,
                middle: false
            },
            pointer: {
                isDown: false
            },
            elements: {
                gui: new Map(),
                game: new Map(),
                debug: new Map()
            },
            elementsHovered: {
                gui: new Map(),
                game: new Map(),
                debug: new Map()
            },
            uiButtons: new Map()
        };

        // Setup keyboard event listeners
        this.setupEventListeners();
        
        // Setup UI elements
        this.createUIControls();
        this.createVirtualControls();
        
        // Setup input listeners
        this.setupPointerListeners();
        this.setupVirtualButtons();
        this.setupUIButtons();

        // Make game canvas focusable
        if (this.canvases.gameCanvas) {
            this.canvases.gameCanvas.tabIndex = 1;
            this.canvases.gameCanvas.focus();
        }
    }

    // Set the current execution context (update or fixed_update)
    setContext(context) {
        this.currentContext = context;
    }

    setupActionMap() {
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
    }

    setupEventListeners() {
        // Keyboard event listeners
        window.addEventListener("keydown", (e) => {
            // Update raw state immediately
            this.rawState.keys.set(e.code, true);
            
            // Conditionally prevent default based on context
            if (this.shouldPreventDefault(e)) {
                e.preventDefault();
            }
        }, false);

        window.addEventListener("keyup", (e) => {
            // Update raw state immediately
            this.rawState.keys.set(e.code, false);
            
            // Conditionally prevent default based on context
            if (this.shouldPreventDefault(e)) {
                e.preventDefault();
            }
        }, false);
        
        // Block context menu when we want to use right click
        document.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    shouldPreventDefault(event) {
        // If ANY standard text input is focused, don't capture ANYTHING
        const textInputFocused = document.activeElement?.matches(
            'input[type="text"], input[type="password"], input[type="search"], input[type="email"], input[type="url"], textarea, [contenteditable="true"]'
        );
        
        if (textInputFocused) {
            return false; // Let ALL keys through to text input
        }
        
        // Otherwise, prevent default for game keys and special browser keys
        return this.actionMap.has(event.code) ||
               event.code === 'F5' ||
               (event.ctrlKey && (event.code === 'KeyS' || event.code === 'KeyP' || event.code === 'KeyR')) ||
               (event.altKey && event.code === 'ArrowLeft');
    }

    // Called by the engine at the start of each frame
    captureKeyState() {
        // Save current as previous - properly preserving Map objects
        // Create deep copies of each component
        
        // Copy key maps
        this.previousSnapshot.keys = new Map(this.currentSnapshot.keys);
        
        // Copy mouse button state
        this.previousSnapshot.mouseButtons.left = this.currentSnapshot.mouseButtons.left;
        this.previousSnapshot.mouseButtons.right = this.currentSnapshot.mouseButtons.right;
        this.previousSnapshot.mouseButtons.middle = this.currentSnapshot.mouseButtons.middle;
        
        // Copy pointer state
        this.previousSnapshot.pointer.isDown = this.currentSnapshot.pointer.isDown;
        
        // Copy element maps
        for (const layer of Object.keys(this.currentSnapshot.elements)) {
            this.previousSnapshot.elements[layer] = new Map(this.currentSnapshot.elements[layer]);
            this.previousSnapshot.elementsHovered[layer] = new Map(this.currentSnapshot.elementsHovered[layer]);
        }
        
        // Copy UI button map
        this.previousSnapshot.uiButtons = new Map(this.currentSnapshot.uiButtons);
        
        // Capture current raw key state
        this.currentSnapshot.keys = new Map();
        for (const [key, isPressed] of this.rawState.keys.entries()) {
            if (isPressed) {
                this.currentSnapshot.keys.set(key, true);
            }
        }
        
        // Capture current mouse state
        this.currentSnapshot.pointer.isDown = this.rawState.pointer.isDown;
        this.currentSnapshot.mouseButtons.left = this.rawState.pointer.buttons.left;
        this.currentSnapshot.mouseButtons.right = this.rawState.pointer.buttons.right;
        this.currentSnapshot.mouseButtons.middle = this.rawState.pointer.buttons.middle;
        
        // Capture elements state
        for (const layer of Object.keys(this.rawState.elements)) {
            // Pressed state
            this.currentSnapshot.elements[layer] = new Map();
            this.rawState.elements[layer].forEach((element, id) => {
                if (element.isPressed) {
                    this.currentSnapshot.elements[layer].set(id, true);
                }
            });
            
            // Hover state
            this.currentSnapshot.elementsHovered[layer] = new Map();
            this.rawState.elements[layer].forEach((element, id) => {
                if (element.isHovered) {
                    this.currentSnapshot.elementsHovered[layer].set(id, true);
                }
            });
        }
        
        // Capture UI button state
        this.currentSnapshot.uiButtons = new Map();
        for (const [id, buttonState] of this.rawState.uiButtons.entries()) {
            if (buttonState.isPressed) {
                this.currentSnapshot.uiButtons.set(id, true);
            }
        }
    }

    // Called by the engine before fixed updates begin
    captureFixedKeyState() {
        // Save current fixed state as previous fixed state - properly preserving Map objects
        
        // Copy key maps
        this.previousFixedSnapshot.keys = new Map(this.currentFixedSnapshot.keys);
        
        // Copy mouse button state
        this.previousFixedSnapshot.mouseButtons.left = this.currentFixedSnapshot.mouseButtons.left;
        this.previousFixedSnapshot.mouseButtons.right = this.currentFixedSnapshot.mouseButtons.right;
        this.previousFixedSnapshot.mouseButtons.middle = this.currentFixedSnapshot.mouseButtons.middle;
        
        // Copy pointer state
        this.previousFixedSnapshot.pointer.isDown = this.currentFixedSnapshot.pointer.isDown;
        
        // Copy element maps
        for (const layer of Object.keys(this.currentFixedSnapshot.elements)) {
            this.previousFixedSnapshot.elements[layer] = new Map(this.currentFixedSnapshot.elements[layer]);
            this.previousFixedSnapshot.elementsHovered[layer] = new Map(this.currentFixedSnapshot.elementsHovered[layer]);
        }
        
        // Copy UI button map
        this.previousFixedSnapshot.uiButtons = new Map(this.currentFixedSnapshot.uiButtons);
        
        // Capture current raw key state at this fixed frame
        this.currentFixedSnapshot.keys = new Map();
        for (const [key, isPressed] of this.rawState.keys.entries()) {
            if (isPressed) {
                this.currentFixedSnapshot.keys.set(key, true);
            }
        }
        
        // Capture current mouse state at this fixed frame
        this.currentFixedSnapshot.pointer.isDown = this.rawState.pointer.isDown;
        this.currentFixedSnapshot.mouseButtons.left = this.rawState.pointer.buttons.left;
        this.currentFixedSnapshot.mouseButtons.right = this.rawState.pointer.buttons.right;
        this.currentFixedSnapshot.mouseButtons.middle = this.rawState.pointer.buttons.middle;
        
        // Capture elements state at this fixed frame
        for (const layer of Object.keys(this.rawState.elements)) {
            // Pressed state
            this.currentFixedSnapshot.elements[layer] = new Map();
            this.rawState.elements[layer].forEach((element, id) => {
                if (element.isPressed) {
                    this.currentFixedSnapshot.elements[layer].set(id, true);
                }
            });
            
            // Hover state
            this.currentFixedSnapshot.elementsHovered[layer] = new Map();
            this.rawState.elements[layer].forEach((element, id) => {
                if (element.isHovered) {
                    this.currentFixedSnapshot.elementsHovered[layer].set(id, true);
                }
            });
        }
        
        // Capture UI button state at this fixed frame
        this.currentFixedSnapshot.uiButtons = new Map();
        for (const [id, buttonState] of this.rawState.uiButtons.entries()) {
            if (buttonState.isPressed) {
                this.currentFixedSnapshot.uiButtons.set(id, true);
            }
        }
    }

    // Helper method to get the right snapshots based on context
    getSnapshots() {
        if (this.currentContext === 'fixed_update') {
            return {
                current: this.currentFixedSnapshot,
                previous: this.previousFixedSnapshot
            };
        } else {
            return {
                current: this.currentSnapshot,
                previous: this.previousSnapshot
            };
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
                this.rawState.uiButtons.set(id, { isPressed: true });
            };

            const handleEnd = (e) => {
                e.preventDefault();
                this.rawState.uiButtons.set(id, { isPressed: false });
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
            this.rawState.pointer.x = pos.x;
            this.rawState.pointer.y = pos.y;
            this.rawState.pointer.movementX = e.movementX || 0;
            this.rawState.pointer.movementY = e.movementY || 0;

            let handledByDebug = false;
            this.rawState.elements.debug.forEach((element) => {
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
            this.rawState.pointer.x = pos.x;
            this.rawState.pointer.y = pos.y;
            
            // Track the specific button pressed
            const button = e.button; // 0: left, 1: middle, 2: right
            
            // Update button-specific state
            if (button === 0) {
                this.rawState.pointer.buttons.left = true;
                // Maintain backward compatibility
                this.rawState.pointer.isDown = true;
                this.rawState.pointer.downTimestamp = performance.now();
            }
            if (button === 1) this.rawState.pointer.buttons.middle = true;
            if (button === 2) this.rawState.pointer.buttons.right = true;

            let handledByDebug = false;
            this.rawState.elements.debug.forEach((element) => {
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
            this.rawState.pointer.x = pos.x;
            this.rawState.pointer.y = pos.y;
            
            // Track the specific button released
            const button = e.button; // 0: left, 1: middle, 2: right
            
            // Update button-specific state
            if (button === 0) {
                this.rawState.pointer.buttons.left = false;
                // Maintain backward compatibility
                this.rawState.pointer.isDown = false;
                this.rawState.pointer.downTimestamp = null;
            }
            if (button === 1) this.rawState.pointer.buttons.middle = false;
            if (button === 2) this.rawState.pointer.buttons.right = false;

            let handledByDebug = false;
            this.rawState.elements.debug.forEach((element) => {
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
                this.rawState.pointer.x = pos.x;
                this.rawState.pointer.y = pos.y;
                
                // For touch, always treat as left button
                this.rawState.pointer.buttons.left = true;
                this.rawState.pointer.isDown = true;
                this.rawState.pointer.downTimestamp = performance.now();

                let handledByDebug = false;
                this.rawState.elements.debug.forEach((element) => {
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
                this.rawState.pointer.buttons.left = false;
                this.rawState.pointer.isDown = false;
                this.rawState.pointer.downTimestamp = null;

                let handledByDebug = false;
                this.rawState.elements.debug.forEach((element) => {
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
                this.rawState.pointer.x = pos.x;
                this.rawState.pointer.y = pos.y;

                let handledByDebug = false;
                this.rawState.elements.debug.forEach((element) => {
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
            this.rawState.pointer.x = pos.x;
            this.rawState.pointer.y = pos.y;
            this.rawState.pointer.movementX = e.movementX || 0;
            this.rawState.pointer.movementY = e.movementY || 0;

            let handledByGui = false;
            this.rawState.elements.gui.forEach((element) => {
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
            this.rawState.pointer.x = pos.x;
            this.rawState.pointer.y = pos.y;
            
            // Track the specific button pressed
            const button = e.button; // 0: left, 1: middle, 2: right
            
            // Update button-specific state
            if (button === 0) {
                this.rawState.pointer.buttons.left = true;
                // Maintain backward compatibility
                this.rawState.pointer.isDown = true;
                this.rawState.pointer.downTimestamp = performance.now();
            }
            if (button === 1) this.rawState.pointer.buttons.middle = true;
            if (button === 2) this.rawState.pointer.buttons.right = true;

            let handledByGui = false;
            this.rawState.elements.gui.forEach((element) => {
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
            this.rawState.pointer.x = pos.x;
            this.rawState.pointer.y = pos.y;
            
            // Track the specific button released
            const button = e.button; // 0: left, 1: middle, 2: right
            
            // Update button-specific state
            if (button === 0) {
                this.rawState.pointer.buttons.left = false;
                // Maintain backward compatibility
                this.rawState.pointer.isDown = false;
                this.rawState.pointer.downTimestamp = null;
            }
            if (button === 1) this.rawState.pointer.buttons.middle = false;
            if (button === 2) this.rawState.pointer.buttons.right = false;

            let handledByGui = false;
            this.rawState.elements.gui.forEach((element) => {
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
                this.rawState.pointer.x = pos.x;
                this.rawState.pointer.y = pos.y;
                
                // For touch, always treat as left button
                this.rawState.pointer.buttons.left = true;
                this.rawState.pointer.isDown = true;
                this.rawState.pointer.downTimestamp = performance.now();

                let handledByGui = false;
                this.rawState.elements.gui.forEach((element) => {
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
                this.rawState.pointer.buttons.left = false;
                this.rawState.pointer.isDown = false;
                this.rawState.pointer.downTimestamp = null;

                let handledByGui = false;
                this.rawState.elements.gui.forEach((element) => {
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
                this.rawState.pointer.x = pos.x;
                this.rawState.pointer.y = pos.y;

                let handledByGui = false;
                this.rawState.elements.gui.forEach((element) => {
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
            this.rawState.pointer.x = pos.x;
            this.rawState.pointer.y = pos.y;
            this.rawState.pointer.movementX = e.movementX || 0;
            this.rawState.pointer.movementY = e.movementY || 0;

            this.rawState.elements.game.forEach((element) => {
                const wasHovered = element.isHovered;
                element.isHovered = this.isPointInBounds(pos.x, pos.y, element.bounds());

                if (!wasHovered && element.isHovered) {
                    element.hoverTimestamp = performance.now();
                }
            });
        });

        this.canvases.gameCanvas.addEventListener("mousedown", (e) => {
            const pos = this.getCanvasPosition(e);
            this.rawState.pointer.x = pos.x;
            this.rawState.pointer.y = pos.y;
            
            // Track the specific button pressed
            const button = e.button; // 0: left, 1: middle, 2: right
            
            // Update button-specific state
            if (button === 0) {
                this.rawState.pointer.buttons.left = true;
                // Maintain backward compatibility
                this.rawState.pointer.isDown = true;
                this.rawState.pointer.downTimestamp = performance.now();
            }
            if (button === 1) this.rawState.pointer.buttons.middle = true;
            if (button === 2) this.rawState.pointer.buttons.right = true;

            this.rawState.elements.game.forEach((element) => {
                if (element.isHovered) {
                    element.isPressed = true;
                }
            });
        });

        this.canvases.gameCanvas.addEventListener("mouseup", (e) => {
            const pos = this.getCanvasPosition(e);
            this.rawState.pointer.x = pos.x;
            this.rawState.pointer.y = pos.y;
            
            // Track the specific button released
            const button = e.button; // 0: left, 1: middle, 2: right
            
            // Update button-specific state
            if (button === 0) {
                this.rawState.pointer.buttons.left = false;
                // Maintain backward compatibility
                this.rawState.pointer.isDown = false;
                this.rawState.pointer.downTimestamp = null;
            }
            if (button === 1) this.rawState.pointer.buttons.middle = false;
            if (button === 2) this.rawState.pointer.buttons.right = false;

            this.rawState.elements.game.forEach((element) => {
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
                this.rawState.pointer.x = pos.x;
                this.rawState.pointer.y = pos.y;
                
                // For touch, always treat as left button
                this.rawState.pointer.buttons.left = true;
                this.rawState.pointer.isDown = true;
                this.rawState.pointer.downTimestamp = performance.now();

                this.rawState.elements.game.forEach((element) => {
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
                this.rawState.pointer.buttons.left = false;
                this.rawState.pointer.isDown = false;
                this.rawState.pointer.downTimestamp = null;

                this.rawState.elements.game.forEach((element) => {
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
                this.rawState.pointer.x = pos.x;
                this.rawState.pointer.y = pos.y;

                this.rawState.elements.game.forEach((element) => {
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
                this.rawState.pointer.movementX = e.movementX;
                this.rawState.pointer.movementY = e.movementY;
            }
        });
    }

    getLockedPointerMovement() {
        if (!document.pointerLockElement) {
            return { x: 0, y: 0 };
        }
        // Return the raw movement values
        return {
            x: this.rawState.pointer.movementX,
            y: this.rawState.pointer.movementY
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
                this.rawState.keys.set(key, true);
            };

            const handleEnd = (e) => {
                e.preventDefault();
                this.rawState.keys.set(key, false);
            };

            button.addEventListener("touchstart", handleStart, { passive: false });
            button.addEventListener("touchend", handleEnd, { passive: false });
            button.addEventListener("mousedown", handleStart);
            button.addEventListener("mouseup", handleEnd);
            button.addEventListener("mouseleave", handleEnd);
        });
    }

    registerElement(id, element, layer = "gui") {
        if (!this.rawState.elements[layer]) {
            console.warn(`[ActionInputHandler] Layer ${layer} doesn't exist, defaulting to gui`);
            layer = "gui";
        }

        this.rawState.elements[layer].set(id, {
            bounds: element.bounds,
            isHovered: false,
            hoverTimestamp: null, // Keep for compatibility
            isPressed: false,
            isActive: false,
            activeTimestamp: null
        });
    }

    // CONTEXT-AWARE API METHODS FOR GAME CODE
    
    setElementActive(id, layer, isActive) {
        const element = this.rawState.elements[layer]?.get(id);
        if (element) {
            element.isActive = isActive;
        }
    }
    
    isElementJustPressed(id, layer = "gui") {
        const { current, previous } = this.getSnapshots();
        
        const isCurrentlyPressed = current.elements[layer]?.has(id);
        const wasPreviouslyPressed = previous.elements[layer]?.has(id);
        
        // Element is pressed now but wasn't in the previous frame/fixed frame step
        return isCurrentlyPressed && !wasPreviouslyPressed;
    }

    isElementPressed(id, layer = "gui") {
        const { current } = this.getSnapshots();
        return current.elements[layer]?.has(id) || false;
    }

    isElementJustHovered(id, layer = "gui") {
        const { current, previous } = this.getSnapshots();
        
        const isCurrentlyHovered = current.elementsHovered[layer]?.has(id);
        const wasPreviouslyHovered = previous.elementsHovered[layer]?.has(id);
        
        // Element is hovered now but wasn't in the previous frame/fixed frame step
        return isCurrentlyHovered && !wasPreviouslyHovered;
    }

    isElementHovered(id, layer = "gui") {
        const { current } = this.getSnapshots();
        return current.elementsHovered[layer]?.has(id) || false;
    }

    isElementActive(id, layer = "gui") {
        const element = this.rawState.elements[layer]?.get(id);
        return element ? element.isActive : false;
    }

    // Legacy pointer methods for backward compatibility
    isPointerDown() {
        const { current } = this.getSnapshots();
        return current.pointer.isDown;
    }

    isPointerJustDown() {
        const { current, previous } = this.getSnapshots();
        // Pointer is down now but wasn't in the previous frame/fixed frame step
        return current.pointer.isDown && !previous.pointer.isDown;
    }

    // Mouse button methods
    isLeftMouseButtonDown() {
        const { current } = this.getSnapshots();
        return current.mouseButtons.left;
    }

    isRightMouseButtonDown() {
        const { current } = this.getSnapshots();
        return current.mouseButtons.right;
    }

    isMiddleMouseButtonDown() {
        const { current } = this.getSnapshots();
        return current.mouseButtons.middle;
    }

    isLeftMouseButtonJustPressed() {
        const { current, previous } = this.getSnapshots();
        return current.mouseButtons.left && !previous.mouseButtons.left;
    }

    isRightMouseButtonJustPressed() {
        const { current, previous } = this.getSnapshots();
        return current.mouseButtons.right && !previous.mouseButtons.right;
    }

    isMiddleMouseButtonJustPressed() {
        const { current, previous } = this.getSnapshots();
        return current.mouseButtons.middle && !previous.mouseButtons.middle;
    }

    // Generic mouse button method
    isMouseButtonDown(button) {
        const { current } = this.getSnapshots();
        // button: 0=left, 1=middle, 2=right
        if (button === 0) return current.mouseButtons.left;
        if (button === 1) return current.mouseButtons.middle;
        if (button === 2) return current.mouseButtons.right;
        return false;
    }

    isMouseButtonJustPressed(button) {
        const { current, previous } = this.getSnapshots();
        // button: 0=left, 1=middle, 2=right
        if (button === 0) return current.mouseButtons.left && !previous.mouseButtons.left;
        if (button === 1) return current.mouseButtons.middle && !previous.mouseButtons.middle;
        if (button === 2) return current.mouseButtons.right && !previous.mouseButtons.right;
        return false;
    }

    // UI Button methods
    isUIButtonPressed(buttonId) {
        const { current } = this.getSnapshots();
        return current.uiButtons.has(buttonId);
    }

    isUIButtonJustPressed(buttonId) {
        const { current, previous } = this.getSnapshots();
        
        const isCurrentlyPressed = current.uiButtons.has(buttonId);
        const wasPreviouslyPressed = previous.uiButtons.has(buttonId);
        
        // Button is pressed now but wasn't in the previous frame/fixed frame step
        return isCurrentlyPressed && !wasPreviouslyPressed;
    }

    // Game state toggle methods
    togglePause() {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }

    toggleVirtualControls() {
        this.rawState.virtualControlsVisible = !this.rawState.virtualControlsVisible;
        this.virtualControlsContainer.classList.toggle("hidden", !this.rawState.virtualControlsVisible);
        return this.rawState.virtualControlsVisible;
    }

    // Key check methods
    isKeyPressed(action) {
        const { current } = this.getSnapshots();
        
        for (const [key, actions] of this.actionMap) {
            if (actions.includes(action)) {
                return current.keys.has(key);
            }
        }
        return false;
    }

    isKeyJustPressed(action) {
        const { current, previous } = this.getSnapshots();
        
        for (const [key, actions] of this.actionMap) {
            if (actions.includes(action)) {
                // Check if key was just pressed this frame/fixed frame step
                const isCurrentlyPressed = current.keys.has(key);
                const wasPreviouslyPressed = previous.keys.has(key);
                
                // Key is pressed now but wasn't in the previous frame/fixed frame step
                if (isCurrentlyPressed && !wasPreviouslyPressed) {
                    return true;
                }
            }
        }
        return false;
    }

    getPointerPosition() {
        return {
            x: this.rawState.pointer.x,
            y: this.rawState.pointer.y,
            movementX: this.rawState.pointer.movementX,
            movementY: this.rawState.pointer.movementY
        };
    }

    removeElement(id, layer = "gui") {
        if (!this.rawState.elements[layer]) {
            console.warn(`[ActionInputHandler] Layer ${layer} doesn't exist`);
            return false;
        }
        return this.rawState.elements[layer].delete(id);
    }

    clearLayerElements(layer = "gui") {
        if (!this.rawState.elements[layer]) {
            console.warn(`[ActionInputHandler] Layer ${layer} doesn't exist`);
            return false;
        }
        this.rawState.elements[layer].clear();
        return true;
    }

    clearAllElements() {
        Object.keys(this.rawState.elements).forEach((layer) => {
            this.rawState.elements[layer].clear();
        });
    }

    // Method to get all registered actions
    getRegisteredActions() {
        const actions = new Set();
        for (const [_, actionsList] of this.actionMap) {
            actionsList.forEach(action => actions.add(action));
        }
        return Array.from(actions);
    }

    // Raw key access methods
    isRawKeyPressed(keyCode) {
        const { current } = this.getSnapshots();
        return current.keys.has(keyCode);
    }

    isRawKeyJustPressed(keyCode) {
        const { current, previous } = this.getSnapshots();
        
        const isCurrentlyPressed = current.keys.has(keyCode);
        const wasPreviouslyPressed = previous.keys.has(keyCode);
        
        // Key is pressed now but wasn't in the previous frame/fixed frame step
        return isCurrentlyPressed && !wasPreviouslyPressed;
    }

    // Dynamic action registration
    registerAction(actionName, keyCodes) {
        // Allow developers to register new actions dynamically
        if (typeof keyCodes === 'string') keyCodes = [keyCodes];
        
        for (const keyCode of keyCodes) {
            if (!this.actionMap.has(keyCode)) {
                this.actionMap.set(keyCode, []);
            }
            this.actionMap.get(keyCode).push(actionName);
            this.gameKeyCodes.add(keyCode); // Add to blocked keys
        }
    }

    unregisterAction(actionName) {
        // Remove an action from all key mappings
        for (const [keyCode, actions] of this.actionMap) {
            const index = actions.indexOf(actionName);
            if (index !== -1) {
                actions.splice(index, 1);
                if (actions.length === 0) {
                    this.actionMap.delete(keyCode);
                    this.gameKeyCodes.delete(keyCode);
                }
            }
        }
    }
}