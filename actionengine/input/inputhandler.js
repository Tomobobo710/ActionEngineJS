//actionengine/input/inputhandler.js
class ActionInputHandler {
    constructor(audio, canvases) {
        this.audio = audio;
        this.canvases = canvases;
        this.virtualControls = false;
        this.isPaused = false;

        // Track which context we're in (update or fixed_update)
        this.currentContext = "update";

        // Create containers
        this.virtualControlsContainer = this.createVirtualControlsContainer();
        this.uiControlsContainer = document.getElementById("UIControlsContainer");

        // Setup action mappings
        this.setupActionMap();
        this.setupGamepadActionMap();

        // Gamepad state
        this.gamepads = new Map(); // Store gamepad states by index
        this.gamepadDeadzone = 0.15; // Default deadzone for analog sticks
        this.gamepadConnected = false;
        this.gamepadKeyboardMirroring = true; // Default: gamepad inputs map to keyboard actions

        // Raw state - continuously updated by events
        this.rawState = {
            keys: new Map(),

            // ADDITIVE — sub-frame press latches. rawState.keys is a LEVEL ("is it down right
            // now"), and both capture paths sample that level. So a key pressed AND released
            // between two captures never existed: keydown set true, keyup set false, and the
            // capture saw false. That is the engine's long-standing "laggy = dropped inputs"
            // behaviour — at 144fps the sample window is 6.9ms and a tap rarely fits inside it, but
            // at 30fps it is 33ms, and during a hitch it is hundreds of ms, so quick taps silently
            // vanish. Sampling a level can never recover an event that began and ended between
            // samples.
            //
            // These sets record that a press HAPPENED. keydown adds; each capture path ORs its own
            // latch into the snapshot it builds and then clears ONLY ITS OWN. Two independent
            // latches because there are two independent consumers (captureKeyState per render
            // frame, captureFixedKeyState per fixed step) — a single shared latch would let
            // whichever ran first consume the tap and starve the other.
            pressedSinceCapture: new Set(),      // consumed by captureKeyState()
            pressedSinceFixedCapture: new Set(), // consumed by captureFixedKeyState()

            // Same latch, same reasoning, for the non-keyboard inputs. Mouse buttons, registered
            // UI/GUI elements and gamepad buttons are ALL stored as levels too, so a click or a tap
            // that starts and ends between captures was dropped exactly like a key tap was. Keys
            // are latched at the keydown listener; these are latched in _latchEdges(), which is
            // called from both capture paths and detects a press by comparing raw state against
            // what was last seen (a press site can be reached from mouse, touch or pointer
            // handlers, so watching the STATE catches all of them instead of patching ~6 call
            // sites and hoping none were missed).
            mouseLatch: { update: { left: false, right: false, middle: false, pointer: false },
                          fixed:  { left: false, right: false, middle: false, pointer: false } },
            elementLatch: { update: { gui: new Set(), game: new Set(), debug: new Set() },
                            fixed:  { gui: new Set(), game: new Set(), debug: new Set() } },
            uiButtonLatch: { update: new Set(), fixed: new Set() },
            // Previous raw levels, used only to detect the rising edge inside _latchEdges().
            _prevRaw: { left: false, right: false, middle: false, pointer: false,
                        elements: { gui: new Set(), game: new Set(), debug: new Set() },
                        uiButtons: new Set(), gamepad: new Set() },
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
            // Scroll-wheel delta accumulated since the last consumeWheel() (reset on consume).
            // +y = scrolled DOWN, +x = scrolled RIGHT, in normalized pixels.
            wheel: { x: 0, y: 0 },
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
        // ADDITIVE: gamepads are poll-only, so sample them faster than the render frame or short
        // presses are never observed at all (see _startGamepadSampler).
        this._startGamepadSampler();
        this.setupGamepadListeners();

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

    setupGamepadActionMap() {
        // Standard gamepad button mapping (based on standard gamepad layout)
        // Button indices follow the W3C Gamepad API standard mapping
        this.gamepadActionMap = new Map([
            // Face buttons (Xbox layout: A=0, B=1, X=2, Y=3)
            [0, ["Action1"]], // A / Cross - Primary action
            [1, ["Action2"]], // B / Circle - Secondary action
            [2, ["Action3"]], // X / Square
            [3, ["Action4"]], // Y / Triangle

            // Shoulder buttons
            [4, ["Action5"]], // Left Bumper (LB)
            [5, ["Action6"]], // Right Bumper (RB)
            [6, ["Action7"]], // Left Trigger (LT) when pressed as button
            [7, ["Action8"]], // Right Trigger (RT) when pressed as button

            // Menu buttons
            [8, ["Action7"]], // Back/Select
            [9, ["Action8"]], // Start

            // Stick clicks
            [10, ["Action9"]], // Left stick click (L3)
            [11, ["Action10"]], // Right stick click (R3)

            // D-pad
            [12, ["DirUp"]],
            [13, ["DirDown"]],
            [14, ["DirLeft"]],
            [15, ["DirRight"]]
        ]);

        // Axis mapping for analog sticks
        // Standard gamepad axes: 0-1 = left stick (x, y), 2-3 = right stick (x, y)
        this.gamepadAxisMap = new Map([
            [0, { action: "AxisLeftX", inverted: false }],
            [1, { action: "AxisLeftY", inverted: false }],
            [2, { action: "AxisRightX", inverted: false }],
            [3, { action: "AxisRightY", inverted: false }]
        ]);
    }

    setupActionMap() {
        this.actionMap = new Map([
            ["KeyW", ["DirUp"]],
            ["KeyS", ["DirDown"]],
            ["KeyA", ["DirLeft"]],
            ["KeyD", ["DirRight"]],
            ["ArrowUp", ["DirUp"]],
            ["ArrowDown", ["DirDown"]],
            ["ArrowLeft", ["DirLeft"]],
            ["ArrowRight", ["DirRight"]],
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
            ["NumpadSubtract", ["NumpadSubtract"]], // Numpad minus

            // Hotbar number keys (1-9)
            ["Digit1", ["Hotbar1"]],
            ["Digit2", ["Hotbar2"]],
            ["Digit3", ["Hotbar3"]],
            ["Digit4", ["Hotbar4"]],
            ["Digit5", ["Hotbar5"]],
            ["Digit6", ["Hotbar6"]],
            ["Digit7", ["Hotbar7"]],
            ["Digit8", ["Hotbar8"]],
            ["Digit9", ["Hotbar9"]],
            ["Digit0", ["Hotbar0"]]
        ]);

        // Extract all key codes the game uses from actionMap
        this.gameKeyCodes = new Set();
        for (const [keyCode, _] of this.actionMap) {
            this.gameKeyCodes.add(keyCode);
        }

        // Add additional browser keys we want to block
        const additionalBlockedKeys = ["F5"];
        additionalBlockedKeys.forEach((key) => this.gameKeyCodes.add(key));
    }

    setupGamepadListeners() {
        // Listen for gamepad connection events
        window.addEventListener("gamepadconnected", (e) => {
            console.log(`[ActionInputHandler] Gamepad connected: ${e.gamepad.id} (index: ${e.gamepad.index})`);
            this.gamepadConnected = true;
            this.initializeGamepad(e.gamepad.index);
        });

        window.addEventListener("gamepaddisconnected", (e) => {
            console.log(`[ActionInputHandler] Gamepad disconnected: ${e.gamepad.id} (index: ${e.gamepad.index})`);
            this.gamepads.delete(e.gamepad.index);
            if (this.gamepads.size === 0) {
                this.gamepadConnected = false;
            }
        });
    }

    initializeGamepad(index) {
        this.gamepads.set(index, {
            buttons: new Map(),
            axes: new Map(),
            previousButtons: new Map(),
            previousAxes: new Map()
        });
    }

    pollGamepads() {
        // Get current gamepad states from browser
        const gamepads = navigator.getGamepads();

        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (!gamepad) continue;

            // Initialize if this is a new gamepad
            if (!this.gamepads.has(i)) {
                this.initializeGamepad(i);
            }

            const state = this.gamepads.get(i);

            // Store previous state
            state.previousButtons = new Map(state.buttons);
            state.previousAxes = new Map(state.axes);

            // Update button states AND inject into rawState.keys
            gamepad.buttons.forEach((button, index) => {
                state.buttons.set(index, {
                    pressed: button.pressed,
                    value: button.value
                });

                // Create a unique key for this gamepad button
                const gamepadKey = `Gamepad${i}_Button${index}`;

                // Update rawState.keys so it goes through snapshot system
                if (button.pressed) {
                    this.rawState.keys.set(gamepadKey, true);
                } else {
                    this.rawState.keys.delete(gamepadKey);
                }
            });

            // Update axis states with deadzone
            gamepad.axes.forEach((value, index) => {
                const processedValue = Math.abs(value) < this.gamepadDeadzone ? 0 : value;
                state.axes.set(index, processedValue);
            });

            // Map analog sticks to directional keys in rawState
            const leftStick = {
                x: state.axes.get(0) || 0,
                y: state.axes.get(1) || 0
            };

            const threshold = 0.5;
            const stickUpKey = `Gamepad${i}_StickUp`;
            const stickDownKey = `Gamepad${i}_StickDown`;
            const stickLeftKey = `Gamepad${i}_StickLeft`;
            const stickRightKey = `Gamepad${i}_StickRight`;

            // Update rawState based on stick position
            if (leftStick.y < -threshold) {
                this.rawState.keys.set(stickUpKey, true);
            } else {
                this.rawState.keys.delete(stickUpKey);
            }

            if (leftStick.y > threshold) {
                this.rawState.keys.set(stickDownKey, true);
            } else {
                this.rawState.keys.delete(stickDownKey);
            }

            if (leftStick.x < -threshold) {
                this.rawState.keys.set(stickLeftKey, true);
            } else {
                this.rawState.keys.delete(stickLeftKey);
            }

            if (leftStick.x > threshold) {
                this.rawState.keys.set(stickRightKey, true);
            } else {
                this.rawState.keys.delete(stickRightKey);
            }
        }
    }

    setupEventListeners() {
        // Keyboard event listeners
        window.addEventListener(
            "keydown",
            (e) => {
                // Update raw state immediately
                this.rawState.keys.set(e.code, true);

                // ADDITIVE: latch the press for BOTH capture paths so a tap that is released
                // before the next capture is still reported exactly once (see rawState comment).
                // The browser auto-repeats a held key; e.repeat guards against that re-latching a
                // press the consumer has already seen, which would make a held key look like a
                // stream of fresh presses.
                if (!e.repeat) {
                    this.rawState.pressedSinceCapture.add(e.code);
                    this.rawState.pressedSinceFixedCapture.add(e.code);
                }

                // Conditionally prevent default based on context
                if (this.shouldPreventDefault(e)) {
                    e.preventDefault();
                }
            },
            false
        );

        window.addEventListener(
            "keyup",
            (e) => {
                // Update raw state immediately
                this.rawState.keys.set(e.code, false);

                // Conditionally prevent default based on context
                if (this.shouldPreventDefault(e)) {
                    e.preventDefault();
                }
            },
            false
        );

        // Block context menu when we want to use right click
        document.addEventListener("contextmenu", (e) => e.preventDefault());
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
        return (
            this.actionMap.has(event.code) ||
            event.code === "F5" ||
            (event.ctrlKey && (event.code === "KeyS" || event.code === "KeyP" || event.code === "KeyR")) ||
            (event.altKey && event.code === "ArrowLeft")
        );
    }

    // Called by the engine at the start of each frame
    captureKeyState() {
        // Poll gamepads first
        this.pollGamepads();
        // ADDITIVE: detect sub-frame presses on mouse/elements/UI/gamepad before sampling levels.
        this._latchEdges();
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
        // ADDITIVE: fold in any press that happened AND ended since the last capture, so a
        // sub-frame tap appears in exactly one snapshot instead of being lost. Clear only this
        // path's latch — the fixed-update path owns its own and consumes it independently.
        for (const key of this.rawState.pressedSinceCapture) {
            this.currentSnapshot.keys.set(key, true);
        }
        this.rawState.pressedSinceCapture.clear();

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

        // ADDITIVE: fold in sub-frame presses (mouse / elements / UI buttons / gamepad) that began
        // and ended since the last capture, then clear ONLY this path's latches.
        const ml = this.rawState.mouseLatch.update;
        if (ml.left) this.currentSnapshot.mouseButtons.left = true;
        if (ml.right) this.currentSnapshot.mouseButtons.right = true;
        if (ml.middle) this.currentSnapshot.mouseButtons.middle = true;
        if (ml.pointer) this.currentSnapshot.pointer.isDown = true;
        ml.left = ml.right = ml.middle = ml.pointer = false;

        for (const layer of Object.keys(this.rawState.elementLatch.update)) {
            const set = this.rawState.elementLatch.update[layer];
            if (!set.size) continue;
            if (!this.currentSnapshot.elements[layer]) this.currentSnapshot.elements[layer] = new Map();
            for (const id of set) this.currentSnapshot.elements[layer].set(id, true);
            set.clear();
        }

        for (const id of this.rawState.uiButtonLatch.update) this.currentSnapshot.uiButtons.set(id, true);
        this.rawState.uiButtonLatch.update.clear();

    }

    // Called by the engine before fixed updates begin
    captureFixedKeyState() {
        // Poll gamepads for fixed update as well
        this.pollGamepads();
        // ADDITIVE: detect sub-frame presses on mouse/elements/UI/gamepad before sampling levels.
        this._latchEdges();
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
            this.previousFixedSnapshot.elementsHovered[layer] = new Map(
                this.currentFixedSnapshot.elementsHovered[layer]
            );
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
        // ADDITIVE: same sub-frame press latch as captureKeyState(), on this path's OWN set.
        // This one matters most: it is what a networked command sampler reads, so a tap dropped
        // here is a command that never reaches the server at all.
        for (const key of this.rawState.pressedSinceFixedCapture) {
            this.currentFixedSnapshot.keys.set(key, true);
        }
        this.rawState.pressedSinceFixedCapture.clear();

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

        // ADDITIVE: same sub-frame press fold as captureKeyState(), on this path's OWN latches.
        // This is the one a networked command sampler reads — a click dropped here never becomes
        // a command at all.
        const fml = this.rawState.mouseLatch.fixed;
        if (fml.left) this.currentFixedSnapshot.mouseButtons.left = true;
        if (fml.right) this.currentFixedSnapshot.mouseButtons.right = true;
        if (fml.middle) this.currentFixedSnapshot.mouseButtons.middle = true;
        if (fml.pointer) this.currentFixedSnapshot.pointer.isDown = true;
        fml.left = fml.right = fml.middle = fml.pointer = false;

        for (const layer of Object.keys(this.rawState.elementLatch.fixed)) {
            const set = this.rawState.elementLatch.fixed[layer];
            if (!set.size) continue;
            if (!this.currentFixedSnapshot.elements[layer]) this.currentFixedSnapshot.elements[layer] = new Map();
            for (const id of set) this.currentFixedSnapshot.elements[layer].set(id, true);
            set.clear();
        }

        for (const id of this.rawState.uiButtonLatch.fixed) this.currentFixedSnapshot.uiButtons.set(id, true);
        this.rawState.uiButtonLatch.fixed.clear();

    }

    // Helper method to get the right snapshots based on context
    /**
     * ADDITIVE — detect rising edges on the non-keyboard inputs and latch them for BOTH capture
     * paths. Called at the top of captureKeyState() and captureFixedKeyState().
     *
     * Why here instead of at the press handlers: mouse/touch/pointer each have their own listeners
     * that set the same raw levels (~6 sites), so watching the STATE catches every path without
     * patching each one. Keys are different — they have exactly one keydown listener, and latching
     * there lets us use `e.repeat` to ignore auto-repeat, which raw state cannot distinguish.
     *
     * The edge is detected ONCE (against _prevRaw) and written to BOTH the update and fixed
     * latches. Each capture path then consumes and clears only its own, so neither starves the
     * other — the same two-consumer split the keyboard latches use.
     */
    /**
     * ADDITIVE — latch a mouse-button press for both capture paths, at the moment it happens.
     * Called from every mousedown/pointerdown/touchstart site that sets a raw button level, so a
     * click that is released before the next capture is still reported exactly once.
     * @param {number} button 0 left, 1 middle, 2 right
     */
    /**
     * ADDITIVE — latch a registered element's press for both capture paths, at the moment it
     * happens. Same reasoning as _latchMouseDown: elements are set pressed by the mouse/touch/
     * pointer handlers, so a tap that is released before the next capture is invisible to any
     * state comparison done at capture time.
     */
    _latchElementDown(id, layer = "gui") {
        const u = this.rawState.elementLatch.update[layer], f = this.rawState.elementLatch.fixed[layer];
        if (u) u.add(id);
        if (f) f.add(id);
    }

    /** ADDITIVE — same latch for the built-in UI buttons (sound / controls / fullscreen / pause). */
    _latchUIButtonDown(id) {
        this.rawState.uiButtonLatch.update.add(id);
        this.rawState.uiButtonLatch.fixed.add(id);
    }

    _latchMouseDown(button) {
        const u = this.rawState.mouseLatch.update, f = this.rawState.mouseLatch.fixed;
        if (button === 0) { u.left = true; f.left = true; u.pointer = true; f.pointer = true; }
        else if (button === 1) { u.middle = true; f.middle = true; }
        else if (button === 2) { u.right = true; f.right = true; }
    }

    _latchEdges() {
        const raw = this.rawState;
        const prev = raw._prevRaw;

        // NOTE: mouse buttons are NOT latched here. State comparison at capture time can only see
        // a press that is STILL HELD when a capture runs — a click that goes down and up between
        // two captures reads false at both, so no edge is ever detected. That is precisely the case
        // we are trying to fix, so mouse presses are latched at the DOWN HANDLERS instead (via
        // _latchMouseDown), exactly like keydown does for keys. Elements/UI/gamepad below are
        // level-driven by design (an element stays pressed while held, the gamepad is polled), so
        // comparison is the right mechanism for them.

        // --- registered elements (gui / game / debug layers) ---
        for (const layer of Object.keys(raw.elements)) {
            const seen = new Set();
            raw.elements[layer].forEach((element, id) => {
                if (element && element.isPressed) {
                    seen.add(id);
                    if (!prev.elements[layer].has(id)) {
                        raw.elementLatch.update[layer].add(id);
                        raw.elementLatch.fixed[layer].add(id);
                    }
                }
            });
            prev.elements[layer] = seen;
        }

        // --- built-in UI buttons (sound / controls / fullscreen / pause) ---
        const seenUi = new Set();
        for (const [id, st] of raw.uiButtons.entries()) {
            if (st && st.isPressed) {
                seenUi.add(id);
                if (!prev.uiButtons.has(id)) { raw.uiButtonLatch.update.add(id); raw.uiButtonLatch.fixed.add(id); }
            }
        }
        prev.uiButtons = seenUi;

        // Gamepad edges are NOT detected here — see _startGamepadSampler(). Detecting them at
        // capture time would compare two states sampled at capture time, which cannot see a press
        // that began and ended in between: exactly the flaw that made this approach wrong for mouse
        // and UI elements.
    }

    /**
     * ADDITIVE — sample gamepads on a fast independent timer and latch button edges.
     *
     * The Gamepad API is poll-only: the browser fires no per-button events, so a press is only
     * observable if a poll happens while it is held. pollGamepads() used to be called ONLY from the
     * two capture functions, i.e. once per render frame — a 200ms window at 5fps. Any button
     * tapped inside that window was invisible, and no latch could recover it because nothing ever
     * recorded it.
     *
     * The window is our choice, not the browser's. Sampling on a ~4ms timer shrinks it by ~50x at
     * 5fps, so a normal human tap (~50-100ms) is always caught. Edges found here are latched and
     * drained by the capture paths exactly like keyboard and mouse presses.
     *
     * This is a genuine narrowing, not a guarantee: a press shorter than the sample interval is
     * still unobservable. That is a hard limit of a poll-only API, not something code can fix.
     */
    _startGamepadSampler(intervalMs = 4) {
        if (this._gamepadSampler) return;
        // Skip entirely where the API is absent (headless, older browsers) — nothing to sample.
        if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;
        this._gamepadSeen = new Set();
        this._gamepadSampler = setInterval(() => {
            let pads;
            try { pads = navigator.getGamepads(); } catch (e) { return; }
            if (!pads) return;
            const seen = new Set();
            for (let i = 0; i < pads.length; i++) {
                const pad = pads[i];
                if (!pad || !pad.buttons) continue;
                for (let b = 0; b < pad.buttons.length; b++) {
                    const btn = pad.buttons[b];
                    if (!btn || !btn.pressed) continue;
                    const key = `Gamepad${i}_Button${b}`;
                    seen.add(key);
                    if (!this._gamepadSeen.has(key)) {
                        // Rising edge — latch for both consumers, same as a keydown.
                        this.rawState.pressedSinceCapture.add(key);
                        this.rawState.pressedSinceFixedCapture.add(key);
                    }
                }
            }
            this._gamepadSeen = seen;
        }, intervalMs);
    }

    /** Stop the gamepad sampler (mirrors _startGamepadSampler; safe to call when never started). */
    _stopGamepadSampler() {
        if (this._gamepadSampler) { clearInterval(this._gamepadSampler); this._gamepadSampler = null; }
    }

    getSnapshots() {
        if (this.currentContext === "fixed_update") {
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
                this._latchUIButtonDown(id); // ADDITIVE: survive a sub-frame tap (see _latchEdges)
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
                this._latchMouseDown(0);
                // Maintain backward compatibility
                this.rawState.pointer.isDown = true;
                this.rawState.pointer.downTimestamp = performance.now();
            }
            if (button === 1) { this.rawState.pointer.buttons.middle = true; this._latchMouseDown(1); }
            if (button === 2) { this.rawState.pointer.buttons.right = true; this._latchMouseDown(2); }

            let handledByDebug = false;
            this.rawState.elements.debug.forEach((element, __id) => {
                if (element.isHovered) {
                    element.isPressed = true;
                    this._latchElementDown(__id, 'debug');
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
                this._latchMouseDown(0);
                this.rawState.pointer.isDown = true;
                this.rawState.pointer.downTimestamp = performance.now();

                let handledByDebug = false;
                this.rawState.elements.debug.forEach((element, __id) => {
                    if (this.isPointInBounds(pos.x, pos.y, element.bounds())) {
                        element.isPressed = true;
                        this._latchElementDown(__id, 'debug');
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
                this._latchMouseDown(0);
                // Maintain backward compatibility
                this.rawState.pointer.isDown = true;
                this.rawState.pointer.downTimestamp = performance.now();
            }
            if (button === 1) { this.rawState.pointer.buttons.middle = true; this._latchMouseDown(1); }
            if (button === 2) { this.rawState.pointer.buttons.right = true; this._latchMouseDown(2); }

            let handledByGui = false;
            this.rawState.elements.gui.forEach((element, __id) => {
                if (element.isHovered) {
                    element.isPressed = true;
                    this._latchElementDown(__id, 'gui');
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
                this._latchMouseDown(0);
                this.rawState.pointer.isDown = true;
                this.rawState.pointer.downTimestamp = performance.now();

                let handledByGui = false;
                this.rawState.elements.gui.forEach((element, __id) => {
                    if (this.isPointInBounds(pos.x, pos.y, element.bounds())) {
                        element.isPressed = true;
                        this._latchElementDown(__id, 'gui');
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
                this._latchMouseDown(0);
                // Maintain backward compatibility
                this.rawState.pointer.isDown = true;
                this.rawState.pointer.downTimestamp = performance.now();
            }
            if (button === 1) { this.rawState.pointer.buttons.middle = true; this._latchMouseDown(1); }
            if (button === 2) { this.rawState.pointer.buttons.right = true; this._latchMouseDown(2); }

            this.rawState.elements.game.forEach((element, __id) => {
                if (element.isHovered) {
                    element.isPressed = true;
                    this._latchElementDown(__id, 'game');
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
                this._latchMouseDown(0);
                this.rawState.pointer.isDown = true;
                this.rawState.pointer.downTimestamp = performance.now();

                this.rawState.elements.game.forEach((element, __id) => {
                    if (this.isPointInBounds(pos.x, pos.y, element.bounds())) {
                        element.isPressed = true;
                        this._latchElementDown(__id, 'game');
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

        // Scroll wheel: accumulate a normalized delta. The three canvases are stacked (debug on top),
        // so - exactly like the mouse listeners above - we attach to ALL of them, otherwise the
        // topmost layer swallows the wheel and the bottom canvas never sees it. preventDefault stops
        // the page from scrolling under the cursor. deltaMode is normalized to pixels.
        const onWheel = (e) => {
            e.preventDefault();
            const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
            this.rawState.wheel.x += e.deltaX * unit;
            this.rawState.wheel.y += e.deltaY * unit;
        };
        [this.canvases.gameCanvas, this.canvases.guiCanvas, this.canvases.debugCanvas].forEach((cv) => {
            if (cv) cv.addEventListener("wheel", onWheel, { passive: false });
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

    /**
     * Like getLockedPointerMovement(), but resets the accumulated delta to zero after
     * reading. Use this for mouse-look so the same delta isn't applied every frame when
     * the mouse is momentarily still (mousemove only fires on actual movement). Call
     * exactly once per frame. Returns {x:0,y:0} when pointer lock is not active.
     */
    consumeLockedPointerMovement() {
        if (!document.pointerLockElement) {
            return { x: 0, y: 0 };
        }
        const out = {
            x: this.rawState.pointer.movementX,
            y: this.rawState.pointer.movementY
        };
        this.rawState.pointer.movementX = 0;
        this.rawState.pointer.movementY = 0;
        return out;
    }

    /**
     * Peek the scroll-wheel delta accumulated since the last consumeWheel() WITHOUT resetting it.
     * { x, y } in normalized pixels; +y = scrolled DOWN, +x = scrolled RIGHT.
     */
    getWheelDelta() {
        return { x: this.rawState.wheel.x, y: this.rawState.wheel.y };
    }

    /**
     * Read AND reset the accumulated scroll-wheel delta. Call exactly once per frame so the same
     * scroll isn't applied twice. Returns { x:0, y:0 } when nothing scrolled this frame.
     * For a discrete "one notch" control, use Math.sign(consumeWheel().y).
     */
    consumeWheel() {
        const out = { x: this.rawState.wheel.x, y: this.rawState.wheel.y };
        this.rawState.wheel.x = 0;
        this.rawState.wheel.y = 0;
        return out;
    }

    /**
     * Like consumeWheel(), but returns whole integer NOTCHES (one notch ~= 100px) and KEEPS the
     * sub-notch remainder so slow/trackpad scrolling still accumulates. Great for stepping a value
     * up/down per detent: const s = consumeWheelSteps(); value += s.y;
     */
    consumeWheelSteps() {
        const NOTCH = 100;
        const sx = Math.trunc(this.rawState.wheel.x / NOTCH);
        const sy = Math.trunc(this.rawState.wheel.y / NOTCH);
        this.rawState.wheel.x -= sx * NOTCH;
        this.rawState.wheel.y -= sy * NOTCH;
        return { x: sx, y: sy };
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

    // Gamepad Methods - Direct per-gamepad access

    isGamepadButtonPressed(buttonIndex, gamepadIndex = 0) {
        const { current } = this.getSnapshots();

        // Check if this gamepad exists
        if (!this.gamepads.has(gamepadIndex)) return false;

        // Check snapshot for this specific gamepad button
        const gamepadKey = `Gamepad${gamepadIndex}_Button${buttonIndex}`;
        return current.keys.has(gamepadKey);
    }

    isGamepadButtonJustPressed(buttonIndex, gamepadIndex = 0) {
        const { current, previous } = this.getSnapshots();

        // Check if this gamepad exists
        if (!this.gamepads.has(gamepadIndex)) return false;

        // Check snapshot for just pressed on this specific gamepad
        const gamepadKey = `Gamepad${gamepadIndex}_Button${buttonIndex}`;
        const isCurrentlyPressed = current.keys.has(gamepadKey);
        const wasPreviouslyPressed = previous.keys.has(gamepadKey);

        return isCurrentlyPressed && !wasPreviouslyPressed;
    }

    getGamepadAxis(axisIndex, gamepadIndex = 0) {
        const gamepad = this.gamepads.get(gamepadIndex);
        if (!gamepad) return 0;

        return gamepad.axes.get(axisIndex) || 0;
    }

    getGamepadLeftStick(gamepadIndex = 0) {
        return {
            x: this.getGamepadAxis(0, gamepadIndex),
            y: this.getGamepadAxis(1, gamepadIndex)
        };
    }

    getGamepadRightStick(gamepadIndex = 0) {
        return {
            x: this.getGamepadAxis(2, gamepadIndex),
            y: this.getGamepadAxis(3, gamepadIndex)
        };
    }

    isGamepadConnected(gamepadIndex = 0) {
        return this.gamepads.has(gamepadIndex);
    }

    getConnectedGamepads() {
        return Array.from(this.gamepads.keys());
    }

    setGamepadDeadzone(deadzone) {
        this.gamepadDeadzone = Math.max(0, Math.min(1, deadzone));
    }

    setGamepadKeyboardMirroring(enabled) {
        this.gamepadKeyboardMirroring = enabled;
    }

    isGamepadKeyboardMirroringEnabled() {
        return this.gamepadKeyboardMirroring;
    }

    // Map gamepad button to custom action
    mapGamepadButton(buttonIndex, action) {
        if (!this.gamepadActionMap.has(buttonIndex)) {
            this.gamepadActionMap.set(buttonIndex, []);
        }
        const actions = this.gamepadActionMap.get(buttonIndex);
        if (!actions.includes(action)) {
            actions.push(action);
        }
    }

    // Remove gamepad button mapping
    unmapGamepadButton(buttonIndex, action) {
        if (!this.gamepadActionMap.has(buttonIndex)) return;

        const actions = this.gamepadActionMap.get(buttonIndex);
        const index = actions.indexOf(action);
        if (index !== -1) {
            actions.splice(index, 1);
            if (actions.length === 0) {
                this.gamepadActionMap.delete(buttonIndex);
            }
        }
    }

    // Key check methods (now includes gamepad support)
    isKeyPressed(action) {
        const { current } = this.getSnapshots();

        // Check keyboard
        for (const [key, actions] of this.actionMap) {
            if (actions.includes(action)) {
                if (current.keys.has(key)) return true;
            }
        }

        // Only check gamepad if mirroring is enabled
        if (!this.gamepadKeyboardMirroring) {
            return false;
        }

        // Check gamepad buttons via the snapshot system
        for (const [buttonIndex, actions] of this.gamepadActionMap) {
            if (actions.includes(action)) {
                // Check all connected gamepads
                for (const gamepadIndex of this.gamepads.keys()) {
                    const gamepadKey = `Gamepad${gamepadIndex}_Button${buttonIndex}`;
                    if (current.keys.has(gamepadKey)) {
                        return true;
                    }
                }
            }
        }

        // Check analog stick as directional input via snapshot system
        if (action === "DirUp" || action === "DirDown" || action === "DirLeft" || action === "DirRight") {
            for (const gamepadIndex of this.gamepads.keys()) {
                let stickKey;
                if (action === "DirUp") stickKey = `Gamepad${gamepadIndex}_StickUp`;
                if (action === "DirDown") stickKey = `Gamepad${gamepadIndex}_StickDown`;
                if (action === "DirLeft") stickKey = `Gamepad${gamepadIndex}_StickLeft`;
                if (action === "DirRight") stickKey = `Gamepad${gamepadIndex}_StickRight`;

                if (current.keys.has(stickKey)) {
                    return true;
                }
            }
        }

        return false;
    }

    isKeyJustPressed(action) {
        const { current, previous } = this.getSnapshots();

        // Check keyboard
        for (const [key, actions] of this.actionMap) {
            if (actions.includes(action)) {
                const isCurrentlyPressed = current.keys.has(key);
                const wasPreviouslyPressed = previous.keys.has(key);

                if (isCurrentlyPressed && !wasPreviouslyPressed) {
                    return true;
                }
            }
        }

        // Only check gamepad if mirroring is enabled
        if (!this.gamepadKeyboardMirroring) {
            return false;
        }

        // Check gamepad buttons via snapshot system
        for (const [buttonIndex, actions] of this.gamepadActionMap) {
            if (actions.includes(action)) {
                for (const gamepadIndex of this.gamepads.keys()) {
                    const gamepadKey = `Gamepad${gamepadIndex}_Button${buttonIndex}`;
                    const isCurrentlyPressed = current.keys.has(gamepadKey);
                    const wasPreviouslyPressed = previous.keys.has(gamepadKey);

                    if (isCurrentlyPressed && !wasPreviouslyPressed) {
                        return true;
                    }
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
            actionsList.forEach((action) => actions.add(action));
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
        if (typeof keyCodes === "string") keyCodes = [keyCodes];

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
