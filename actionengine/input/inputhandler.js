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
			["F9", ["ActionDebugToggle"]], // Add this line

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


        this.state = {
            keys: new Map(),
            keyPressTimestamps: new Map(),
            pointer: {
                x: 0,
                y: 0,
                movementX: 0,
                movementY: 0,
                isDown: false,
                downTimestamp: null
            },
            elements: {
                gui: new Map(),
                game: new Map(),
                debug: new Map()
            },
            uiButtons: new Map([
                ["soundToggle", { isPressed: false, pressTimestamp: null }],
                ["controlsToggle", { isPressed: false, pressTimestamp: null }],
                ["fullscreenToggle", { isPressed: false, pressTimestamp: null }],
                ["pauseButton", { isPressed: false, pressTimestamp: null }]
            ])
        };

        this.createUIControls();
        this.createVirtualControls();

        this.setupKeyboardListeners();
        this.setupPointerListeners();
        this.setupVirtualButtons();
        this.setupUIButtons();

        // default mute
        //const audioEnabled = this.audio.toggle();
        //document.getElementById('soundToggle').textContent = audioEnabled ? '🔊' : '🔇';
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
                this.state.uiButtons.set(id, {
                    isPressed: true,
                    pressTimestamp: performance.now()
                });
            };

            const handleEnd = (e) => {
                e.preventDefault();
                this.state.uiButtons.set(id, {
                    isPressed: false,
                    pressTimestamp: null
                });
                config.upCallback();
            };

            const handleLeave = (e) => {
                e.preventDefault();
                this.state.uiButtons.set(id, {
                    isPressed: false,
                    pressTimestamp: null
                });
            };

            config.element.addEventListener("touchstart", handleStart, { passive: false });
            config.element.addEventListener("touchend", handleEnd, { passive: false });
            config.element.addEventListener("mousedown", handleStart);
            config.element.addEventListener("mouseup", handleEnd);
            //config.element.addEventListener('mouseleave', handleLeave);  // Now uses separate handler
        });
    }

    setupKeyboardListeners() {
        window.addEventListener("keydown", (e) => {
            if (!this.state.keys.get(e.code)) {
                this.state.keyPressTimestamps.set(e.code, performance.now());
            }
            this.state.keys.set(e.code, true);
        });

        window.addEventListener("keyup", (e) => {
            this.state.keys.set(e.code, false);
            this.state.keyPressTimestamps.delete(e.code);
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
            this.state.pointer.isDown = true;
            this.state.pointer.downTimestamp = performance.now();

            let handledByDebug = false;
            this.state.elements.debug.forEach((element) => {
                if (element.isHovered) {
                    element.isPressed = true;
                    element.pressTimestamp = performance.now();
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
                const newEvent = new MouseEvent("mouseup", e);
                this.canvases.guiCanvas.dispatchEvent(newEvent);
            }
        });

        this.canvases.debugCanvas.addEventListener("touchstart", (e) => {
            e.preventDefault();
            const pos = this.getCanvasPosition(e.touches[0]);
            this.state.pointer.x = pos.x;
            this.state.pointer.y = pos.y;
            this.state.pointer.isDown = true;
            this.state.pointer.downTimestamp = performance.now();

            let handledByDebug = false;
            this.state.elements.debug.forEach((element) => {
                if (this.isPointInBounds(pos.x, pos.y, element.bounds())) {
                    element.isPressed = true;
                    element.pressTimestamp = performance.now();
                    handledByDebug = true;
                }
            });

            if (!handledByDebug) {
                const newEvent = new TouchEvent("touchstart", e);
                this.canvases.guiCanvas.dispatchEvent(newEvent);
            }
        }, { passive: false });

        this.canvases.debugCanvas.addEventListener("touchend", (e) => {
            e.preventDefault();
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
        }, { passive: false });

        this.canvases.debugCanvas.addEventListener("touchmove", (e) => {
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
        }, { passive: false });

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
            this.state.pointer.isDown = true;
            this.state.pointer.downTimestamp = performance.now();

            let handledByGui = false;
            this.state.elements.gui.forEach((element) => {
                if (element.isHovered) {
                    element.isPressed = true;
                    element.pressTimestamp = performance.now();
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
                const newEvent = new MouseEvent("mouseup", e);
                this.canvases.gameCanvas.dispatchEvent(newEvent);
            }
        });

        this.canvases.guiCanvas.addEventListener("touchstart", (e) => {
            e.preventDefault();
            const pos = this.getCanvasPosition(e.touches[0]);
            this.state.pointer.x = pos.x;
            this.state.pointer.y = pos.y;
            this.state.pointer.isDown = true;
            this.state.pointer.downTimestamp = performance.now();

            let handledByGui = false;
            this.state.elements.gui.forEach((element) => {
                if (this.isPointInBounds(pos.x, pos.y, element.bounds())) {
                    element.isPressed = true;
                    element.pressTimestamp = performance.now();
                    handledByGui = true;
                }
            });

            if (!handledByGui) {
                const newEvent = new TouchEvent("touchstart", e);
                this.canvases.gameCanvas.dispatchEvent(newEvent);
            }
        }, { passive: false });

        this.canvases.guiCanvas.addEventListener("touchend", (e) => {
            e.preventDefault();
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
        }, { passive: false });

        this.canvases.guiCanvas.addEventListener("touchmove", (e) => {
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
        }, { passive: false });

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
            this.state.pointer.isDown = true;
            this.state.pointer.downTimestamp = performance.now();

            this.state.elements.game.forEach((element) => {
                if (element.isHovered) {
                    element.isPressed = true;
                    element.pressTimestamp = performance.now();
                }
            });
        });

        this.canvases.gameCanvas.addEventListener("mouseup", (e) => {
            const pos = this.getCanvasPosition(e);
            this.state.pointer.x = pos.x;
            this.state.pointer.y = pos.y;
            this.state.pointer.isDown = false;
            this.state.pointer.downTimestamp = null;

            this.state.elements.game.forEach((element) => {
                if (element.isPressed) {
                    element.isPressed = false;
                }
            });
        });

        this.canvases.gameCanvas.addEventListener("touchstart", (e) => {
            e.preventDefault();
            const pos = this.getCanvasPosition(e.touches[0]);
            this.state.pointer.x = pos.x;
            this.state.pointer.y = pos.y;
            this.state.pointer.isDown = true;
            this.state.pointer.downTimestamp = performance.now();

            this.state.elements.game.forEach((element) => {
                if (this.isPointInBounds(pos.x, pos.y, element.bounds())) {
                    element.isPressed = true;
                    element.pressTimestamp = performance.now();
                }
            });
        }, { passive: false });

        this.canvases.gameCanvas.addEventListener("touchend", (e) => {
            e.preventDefault();
            this.state.pointer.isDown = false;
            this.state.pointer.downTimestamp = null;

            this.state.elements.game.forEach((element) => {
                if (element.isPressed) {
                    element.isPressed = false;
                }
            });
        }, { passive: false });

        this.canvases.gameCanvas.addEventListener("touchmove", (e) => {
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
        }, { passive: false });
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
                if (!this.state.keys.get(key)) {
                    this.state.keyPressTimestamps.set(key, performance.now());
                }
                this.state.keys.set(key, true);
            };

            const handleEnd = (e) => {
                e.preventDefault();
                this.state.keys.set(key, false);
                this.state.keyPressTimestamps.delete(key);
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
            hoverTimestamp: null,
            isPressed: false,
            pressTimestamp: null,
            isActive: false,
            activeTimestamp: null
        });
    }

    isElementJustPressed(id, layer = "gui", threshold = 16) {
        const element = this.state.elements[layer]?.get(id);
        if (element?.pressTimestamp && performance.now() - element.pressTimestamp < threshold) {
            element.pressTimestamp = null;
            return true;
        }
        return false;
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

    isPointerJustDown(threshold = 16) {
        const timestamp = this.state.pointer.downTimestamp;
        if (timestamp && performance.now() - timestamp < threshold) {
            this.state.pointer.downTimestamp = null;
            return true;
        }
        return false;
    }

    isUIButtonPressed(buttonId) {
        const buttonState = this.state.uiButtons.get(buttonId);
        return buttonState ? buttonState.isPressed : false;
    }

    isUIButtonJustPressed(buttonId, threshold = 16) {
        const buttonState = this.state.uiButtons.get(buttonId);
        if (buttonState?.pressTimestamp && performance.now() - buttonState.pressTimestamp < threshold) {
            this.state.uiButtons.set(buttonId, {
                ...buttonState,
                pressTimestamp: null
            });
            return true;
        }
        return false;
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

    isKeyJustPressed(action, threshold = 16) {
        for (const [key, actions] of this.actionMap) {
            if (actions.includes(action)) {
                const timestamp = this.state.keyPressTimestamps.get(key);
                if (timestamp && performance.now() - timestamp < threshold) {
                    this.state.keyPressTimestamps.delete(key);
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

    isPointerDown() {
        return this.state.pointer.isDown;
    }
}