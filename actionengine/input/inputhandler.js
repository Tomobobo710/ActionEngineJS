//actionengine/input/inputhandler.js
class ActionInputHandler {
    constructor(audio, canvases) {
        this.audio = audio;
        this.canvases = canvases;

        // Track which context we're in (update or fixed_update)
        this.currentContext = "update";

        // Setup action mappings
        this.setupActionMap();
        this.setupGamepadActionMap();

        // Gamepad state
        this.gamepads = new Map(); // Store gamepad states by index
        this.gamepadDeadzone = 0.15; // Default deadzone for analog sticks
        this.gamepadConnected = false;
        this.gamepadKeyboardMirroring = true; // Default: gamepad inputs map to keyboard actions

        // Analog axis layer. A physical stick and an on-screen ActionUIVirtualStick
        // write the same named slot; getVector(slot) / getAxis(slot) read it without
        // knowing the source. Sources on one slot are summed, then deadzone'd and
        // clamped once in _mergeAxes. Slots are captured into the snapshots like keys,
        // so a value is stable across a fixed step (quantizeAxis before netcode use).
        this.gamepadStickSlots = new Map([
            [0, "leftAnalog"],   // left stick, axes 0,1
            [1, "rightAnalog"]   // right stick, axes 2,3
        ]);
        // 1D trigger slots: button.value 0..1 lands in the slot's .y, no deadzone.
        this.gamepadTriggerSlots = new Map([
            [6, "leftTrigger"],   // L2
            [7, "rightTrigger"]   // R2
        ]);
        // When true, a physical trigger past the threshold also fires Action11/Action12
        // (the analog slot is populated either way). ActionUIGamepad toggles this.
        this.digitalTriggerButtons = true;
        this.triggerButtonThreshold = 0.5;
        this.gamepadTriggerDigitalActions = new Map([[6, "Action11"], [7, "Action12"]]);

        // setVirtualAxis writes here (per-frame, drained each capture); setVirtualButton
        // writes _virtualButtonsHeld (a level).
        this._virtualAxisInput = new Map();
        this._virtualButtonsHeld = new Set();

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
            // Previous raw levels, used only to detect the rising edge inside _latchEdges().
            _prevRaw: { left: false, right: false, middle: false, pointer: false,
                        elements: { gui: new Set(), game: new Set(), debug: new Set() },
                        gamepad: new Set() },
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
            axes: new Map(),        // slot -> {x,y}, rebuilt each capture by _mergeAxes
            touches: new Map(),     // Touch.identifier -> {id,x,y,startX,startY,layer,downTimestamp}
        };
        // true while rawState.pointer is driven by a touch (not a real mouse button)
        this._pointerOwnedByTouch = false;

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
            axes: new Map(),
            touches: new Map()
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
            axes: new Map(),
            touches: new Map()
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
            axes: new Map(),
            touches: new Map()
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
            axes: new Map(),
            touches: new Map()
        };

        // Setup keyboard event listeners
        this.setupEventListeners();

        // Setup input listeners
        this.setupPointerListeners();
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
            [0, ["Action1"]], // A / Cross
            [1, ["Action2"]], // B / Circle
            [2, ["Action3"]], // X / Square
            [3, ["Action4"]], // Y / Triangle

            [4, ["Action5"]], // L1
            [5, ["Action6"]], // R1
            // buttons 6,7 (L2/R2) are analog triggers — see gamepadTriggerSlots
            [8, ["Action7"]], // Select
            [9, ["Action8"]], // Start
            [10, ["Action9"]],  // L3
            [11, ["Action10"]], // R3

            // D-pad
            [12, ["DirUp"]],
            [13, ["DirDown"]],
            [14, ["DirLeft"]],
            [15, ["DirRight"]]
        ]);
        // Sticks and triggers -> the axis layer (getVector / getTrigger), not this map.
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
            ["Space", ["Action1"]], // A / face button down
            ["ShiftLeft", ["Action2"]], // B / face button right
            ["KeyE", ["Action3"]], // X / face button left
            ["KeyQ", ["Action4"]], // Y / face button up
            ["KeyZ", ["Action5"]], // L1 (Left Bumper)
            ["KeyX", ["Action6"]], // R1 (Right Bumper)
            ["KeyC", ["Action7"]], // Select / Back
            ["KeyF", ["Action8"]], // Start
            ["KeyR", ["Action9"]],  // L3
            ["KeyT", ["Action10"]], // R3
            ["KeyV", ["Action11"]], // L2 (digital)
            ["KeyB", ["Action12"]], // R2 (digital)
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

            // raw axes — deadzone is applied radially per stick in _mergeAxes
            gamepad.axes.forEach((value, index) => {
                state.axes.set(index, value);
            });

            // digitalTriggerButtons: past-threshold L2/R2 sets a synthetic key that
            // isKeyPressed() maps to Action11/Action12. The analog slot is fed in
            // _mergeAxes regardless.
            for (const [btnIdx, actionName] of this.gamepadTriggerDigitalActions) {
                const b = gamepad.buttons[btnIdx];
                const key = btnIdx === 6 ? `Gamepad${i}_TriggerL` : `Gamepad${i}_TriggerR`;
                const on = this.digitalTriggerButtons && b && b.value >= this.triggerButtonThreshold;
                if (on) this.rawState.keys.set(key, true);
                else    this.rawState.keys.delete(key);
            }
        }
    }

    // Rebuild rawState.axes from gamepad sticks + gamepad triggers + drained virtual
    // input. Called at the top of both capture paths so a value is stable across a
    // fixed step. Sources on one slot are summed, then: 2D stick slots get a radial
    // deadzone + unit clamp; 1D trigger slots get clamped to 0..1.
    _mergeAxes() {
        const merged = new Map();
        const triggerSlots = new Set(this.gamepadTriggerSlots.values());

        for (const state of this.gamepads.values()) {
            for (const [stickIndex, slot] of this.gamepadStickSlots) {
                const x = state.axes.get(stickIndex * 2)     || 0;
                const y = state.axes.get(stickIndex * 2 + 1) || 0;
                if (x === 0 && y === 0) continue;
                const cur = merged.get(slot) || { x: 0, y: 0 };
                cur.x += x; cur.y += y;
                merged.set(slot, cur);
            }
            for (const [btnIndex, slot] of this.gamepadTriggerSlots) {
                const b = state.buttons.get(btnIndex);
                const v = b ? b.value : 0;
                if (v === 0) continue;
                const cur = merged.get(slot) || { x: 0, y: 0 };
                cur.y += v;
                merged.set(slot, cur);
            }
        }

        for (const [slot, v] of this._virtualAxisInput) {
            const cur = merged.get(slot) || { x: 0, y: 0 };
            cur.x += v.x; cur.y += v.y;
            merged.set(slot, cur);
        }
        this._virtualAxisInput.clear();

        const dz = this.gamepadDeadzone;
        for (const [slot, v] of merged) {
            if (triggerSlots.has(slot)) {
                merged.set(slot, { x: 0, y: Math.max(0, Math.min(1, v.y)) });
                continue;
            }
            let mag = Math.hypot(v.x, v.y);
            if (mag < dz) { merged.set(slot, { x: 0, y: 0 }); continue; }
            if (mag > 1) { v.x /= mag; v.y /= mag; }
            merged.set(slot, { x: v.x, y: v.y });
        }

        this.rawState.axes = merged;
    }

    // Reflect the held virtual-button set into rawState.keys as "Virtual_<action>"
    // so isKeyPressed / isKeyJustPressed pick it up through the snapshot path.
    _syncVirtualButtons() {
        for (const k of this.rawState.keys.keys()) {
            if (k.startsWith("Virtual_")) this.rawState.keys.delete(k);
        }
        for (const action of this._virtualButtonsHeld) {
            this.rawState.keys.set(`Virtual_${action}`, true);
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
        this._mergeAxes();
        this._syncVirtualButtons();
        // Save current as previous - properly preserving Map objects
        // Create deep copies of each component

        // Copy key maps
        this.previousSnapshot.keys = new Map(this.currentSnapshot.keys);
        this.previousSnapshot.axes = new Map(this.currentSnapshot.axes);
        this.previousSnapshot.touches = new Map(this.currentSnapshot.touches);

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

        // axes + touches — fresh copies so a later _mergeAxes / touch event can't mutate them
        this.currentSnapshot.axes = new Map();
        for (const [slot, v] of this.rawState.axes) {
            this.currentSnapshot.axes.set(slot, { x: v.x, y: v.y });
        }
        this.currentSnapshot.touches = new Map();
        for (const [id, t] of this.rawState.touches) {
            this.currentSnapshot.touches.set(id, {
                id: t.id, x: t.x, y: t.y, startX: t.startX, startY: t.startY, layer: t.layer
            });
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

        // ADDITIVE: fold in sub-frame presses (mouse / elements / gamepad) that began
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

    }

    // Called by the engine before fixed updates begin
    captureFixedKeyState() {
        // Poll gamepads for fixed update as well
        this.pollGamepads();
        // ADDITIVE: detect sub-frame presses on mouse/elements/UI/gamepad before sampling levels.
        this._latchEdges();
        this._mergeAxes();
        this._syncVirtualButtons();
        // Save current fixed state as previous fixed state - properly preserving Map objects

        // Copy key maps
        this.previousFixedSnapshot.keys = new Map(this.currentFixedSnapshot.keys);
        this.previousFixedSnapshot.axes = new Map(this.currentFixedSnapshot.axes);
        this.previousFixedSnapshot.touches = new Map(this.currentFixedSnapshot.touches);

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

        this.currentFixedSnapshot.axes = new Map();
        for (const [slot, v] of this.rawState.axes) {
            this.currentFixedSnapshot.axes.set(slot, { x: v.x, y: v.y });
        }
        this.currentFixedSnapshot.touches = new Map();
        for (const [id, t] of this.rawState.touches) {
            this.currentFixedSnapshot.touches.set(id, {
                id: t.id, x: t.x, y: t.y, startX: t.startX, startY: t.startY, layer: t.layer
            });
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
        // don't keep a headless process alive for this; no-op in browsers
        if (this._gamepadSampler && typeof this._gamepadSampler.unref === "function") {
            this._gamepadSampler.unref();
        }
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

    setupPointerListeners() {
        // Canvases stack debug > gui > game; an event unconsumed by one layer is
        // re-dispatched to the next down (`fallthrough`), null for the bottom.
        this._setupCanvasPointer("debug", this.canvases.guiCanvas);
        this._setupCanvasPointer("gui",   this.canvases.gameCanvas);
        this._setupCanvasPointer("game",  null);

        document.addEventListener("mousemove", (e) => {
            if (document.pointerLockElement) {
                this.rawState.pointer.movementX = e.movementX;
                this.rawState.pointer.movementY = e.movementY;
            }
        });

        // Wheel on all three canvases (top layer would otherwise swallow it), delta
        // normalized to pixels.
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

    // Mouse + multi-touch listeners for one canvas layer.
    _setupCanvasPointer(layer, fallthrough) {
        const canvas   = this.canvases[`${layer}Canvas`];
        const elements = this.rawState.elements[layer];

        // re-dispatch to the layer below when this one didn't consume the event
        const passDown = (e, Ctor, type) => {
            if (fallthrough) fallthrough.dispatchEvent(new Ctor(type, e));
        };

        // -- Mouse -------------------------------------------------------------
        canvas.addEventListener("mousemove", (e) => {
            const pos = this.getCanvasPosition(e);
            this.rawState.pointer.x = pos.x;
            this.rawState.pointer.y = pos.y;
            this.rawState.pointer.movementX = e.movementX || 0;
            this.rawState.pointer.movementY = e.movementY || 0;

            let hit = false;
            elements.forEach((element) => {
                const wasHovered = element.isHovered;
                element.isHovered = this.isPointInBounds(pos.x, pos.y, element.bounds());
                if (!wasHovered && element.isHovered) {
                    element.hoverTimestamp = performance.now();
                    hit = true;
                }
            });
            if (!hit) passDown(e, MouseEvent, "mousemove");
        });

        canvas.addEventListener("mousedown", (e) => {
            const pos = this.getCanvasPosition(e);
            this.rawState.pointer.x = pos.x;
            this.rawState.pointer.y = pos.y;

            const button = e.button; // 0 left, 1 middle, 2 right
            if (button === 0) {
                this.rawState.pointer.buttons.left = true;
                this._latchMouseDown(0);
                this.rawState.pointer.isDown = true;
                this.rawState.pointer.downTimestamp = performance.now();
            }
            if (button === 1) { this.rawState.pointer.buttons.middle = true; this._latchMouseDown(1); }
            if (button === 2) { this.rawState.pointer.buttons.right  = true; this._latchMouseDown(2); }

            let hit = false;
            elements.forEach((element, id) => {
                if (element.isHovered) {
                    element.isPressed = true;
                    this._latchElementDown(id, layer);
                    hit = true;
                }
            });
            if (!hit) passDown(e, MouseEvent, "mousedown");
        });

        canvas.addEventListener("mouseup", (e) => {
            const pos = this.getCanvasPosition(e);
            this.rawState.pointer.x = pos.x;
            this.rawState.pointer.y = pos.y;

            const button = e.button;
            if (button === 0) {
                this.rawState.pointer.buttons.left = false;
                this.rawState.pointer.isDown = false;
                this.rawState.pointer.downTimestamp = null;
            }
            if (button === 1) this.rawState.pointer.buttons.middle = false;
            if (button === 2) this.rawState.pointer.buttons.right  = false;

            let hit = false;
            elements.forEach((element) => {
                if (element.isPressed) { element.isPressed = false; hit = true; }
            });
            if (!hit) passDown(e, MouseEvent, "mouseup");
        });

        // -- Touch --------------------------------------------------------------
        // Every Touch is tracked by identifier in rawState.touches; the oldest also
        // mirrors into rawState.pointer (_syncPrimaryTouch) for single-pointer code.
        // Extra touches are only visible via getTouches().
        canvas.addEventListener("touchstart", (e) => {
            e.preventDefault();
            for (const touch of e.changedTouches) {
                const pos = this.getCanvasPosition(touch);
                this.rawState.touches.set(touch.identifier, {
                    id: touch.identifier,
                    x: pos.x, y: pos.y,
                    startX: pos.x, startY: pos.y,
                    layer,
                    downTimestamp: performance.now()
                });
            }
            this._syncPrimaryTouch();

            const p = this._primaryTouch();
            if (!p) return;
            let hit = false;
            elements.forEach((element, id) => {
                if (this.isPointInBounds(p.x, p.y, element.bounds())) {
                    element.isPressed = true;
                    this._latchElementDown(id, layer);
                    hit = true;
                }
            });
            if (!hit) passDown(e, TouchEvent, "touchstart");
        }, { passive: false });

        canvas.addEventListener("touchmove", (e) => {
            e.preventDefault();
            for (const touch of e.changedTouches) {
                const rec = this.rawState.touches.get(touch.identifier);
                if (!rec) continue;
                const pos = this.getCanvasPosition(touch);
                rec.x = pos.x; rec.y = pos.y;
            }
            this._syncPrimaryTouch();

            const p = this._primaryTouch();
            if (!p) return;
            let hit = false;
            elements.forEach((element) => {
                const wasHovered = element.isHovered;
                element.isHovered = this.isPointInBounds(p.x, p.y, element.bounds());
                if (!wasHovered && element.isHovered) {
                    element.hoverTimestamp = performance.now();
                    hit = true;
                }
            });
            if (!hit) passDown(e, TouchEvent, "touchmove");
        }, { passive: false });

        const onTouchEnd = (e) => {
            e.preventDefault();
            for (const touch of e.changedTouches) {
                this.rawState.touches.delete(touch.identifier);
            }
            this._syncPrimaryTouch();

            let hit = false;
            elements.forEach((element) => {
                if (element.isPressed) { element.isPressed = false; hit = true; }
            });
            if (!hit) passDown(e, TouchEvent, "touchend");
        };
        canvas.addEventListener("touchend", onTouchEnd, { passive: false });
        canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });
    }

    /** The oldest still-active touch (lowest downTimestamp), or null. Drives the
     *  single-pointer back-compat mirror. */
    // Oldest still-active touch, or null.
    _primaryTouch() {
        let best = null;
        for (const rec of this.rawState.touches.values()) {
            if (!best || rec.downTimestamp < best.downTimestamp) best = rec;
        }
        return best;
    }

    // Mirror the primary touch into rawState.pointer so single-pointer consumers work.
    // Only auto-releases what a touch owns — a held mouse button is left alone.
    _syncPrimaryTouch() {
        const p = this._primaryTouch();
        if (p) {
            this.rawState.pointer.x = p.x;
            this.rawState.pointer.y = p.y;
            if (!this.rawState.pointer.isDown) {
                this.rawState.pointer.buttons.left = true;
                this.rawState.pointer.isDown = true;
                this.rawState.pointer.downTimestamp = p.downTimestamp;
                this._latchMouseDown(0);
                this._pointerOwnedByTouch = true;
            }
        } else if (this._pointerOwnedByTouch) {
            this.rawState.pointer.buttons.left = false;
            this.rawState.pointer.isDown = false;
            this.rawState.pointer.downTimestamp = null;
            this._pointerOwnedByTouch = false;
        }
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

    // ── Analog axis layer — public API ─────────────────────────────────────────

    // Contribute to an axis slot for this frame (drained each capture, so call it
    // every frame the input is active). Sources on one slot are summed + clamped.
    setVirtualAxis(slot, x, y) {
        this._virtualAxisInput.set(slot, { x: x || 0, y: y || 0 });
    }

    // Held state of an on-screen button bound to an action. A level: true on press,
    // false on release. isKeyPressed / isKeyJustPressed then report it like a key.
    setVirtualButton(action, isDown) {
        if (isDown) this._virtualButtonsHeld.add(action);
        else        this._virtualButtonsHeld.delete(action);
    }

    // One component of an axis slot, context-aware. Unknown/idle -> 0.
    getAxis(slot, axis = "x") {
        const { current } = this.getSnapshots();
        const v = current.axes.get(slot);
        return v ? (v[axis] || 0) : 0;
    }

    // An axis slot as a fresh {x,y}, context-aware. Unknown/idle -> {x:0,y:0}.
    getVector(slot) {
        const { current } = this.getSnapshots();
        const v = current.axes.get(slot);
        return v ? { x: v.x, y: v.y } : { x: 0, y: 0 };
    }

    // A 1D trigger slot as 0..1 (stored in .y). Defaults: "leftTrigger", "rightTrigger".
    getTrigger(slot) {
        return this.getAxis(slot, "y");
    }

    // Remap a gamepad stick (0 left, 1 right) to an axis slot; null to unmap.
    setGamepadStickSlot(stickIndex, slot) {
        if (slot == null) this.gamepadStickSlots.delete(stickIndex);
        else this.gamepadStickSlots.set(stickIndex, slot);
    }

    // Remap a gamepad trigger (6 = L2, 7 = R2) to a 1D slot; null to unmap.
    setGamepadTriggerSlot(btnIndex, slot) {
        if (slot == null) this.gamepadTriggerSlots.delete(btnIndex);
        else this.gamepadTriggerSlots.set(btnIndex, slot);
    }

    // Toggle the Action11/Action12 fallback for past-threshold physical triggers.
    setDigitalTriggers(enabled) {
        this.digitalTriggerButtons = !!enabled;
    }

    // Snap to a 1/127 grid. Quantize before putting an axis in a netcode command
    // AND before predicting with it, or client/server prediction desyncs.
    static quantizeAxis(v) {
        return Math.max(-1, Math.min(1, Math.round(v * 127) / 127));
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

        if (current.keys.has(`Virtual_${action}`)) return true;  // on-screen button held

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

        // digital trigger fallback (see digitalTriggerButtons)
        if (action === "Action11" || action === "Action12") {
            const tKey = action === "Action11" ? "_TriggerL" : "_TriggerR";
            for (const gp of this.gamepads.keys()) {
                if (current.keys.has(`Gamepad${gp}${tKey}`)) return true;
            }
        }

        // Sticks feed getVector(), not DirUp/etc. Triggers feed getTrigger().
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

        {   // on-screen button edge
            const vk = `Virtual_${action}`;
            if (current.keys.has(vk) && !previous.keys.has(vk)) return true;
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

        // digital trigger fallback edge
        if (action === "Action11" || action === "Action12") {
            const tKey = action === "Action11" ? "_TriggerL" : "_TriggerR";
            for (const gp of this.gamepads.keys()) {
                const k = `Gamepad${gp}${tKey}`;
                if (current.keys.has(k) && !previous.keys.has(k)) return true;
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

    // Active touch points this frame, context-aware. Each { id, x, y, startX, startY,
    // layer }; `id` is stable for the life of one touch. The oldest also drives
    // isPointerDown() / getPointerPosition().
    getTouches() {
        const { current } = this.getSnapshots();
        return Array.from(current.touches.values());
    }

    getTouchCount() {
        return this.getSnapshots().current.touches.size;
    }

    getTouch(id) {
        return this.getSnapshots().current.touches.get(id) || null;
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
