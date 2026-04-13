/******************************************************************************
 * ActionUI — root manager
 * Wires up all components to ActionEngine's input and canvas systems
 ******************************************************************************/

class ActionUI {
    /**
     * @param {Object} canvases  - ActionEngine canvases object
     * @param {Object} input     - ActionEngine input system
     * @param {ActionUITheme} theme    - optional theme instance
     */
    constructor(canvases, input, theme) {
        this.input    = input;
        this.theme    = theme || new ActionUITheme();

        // Canvas contexts keyed by layer
        this._ctxMap  = {
            gui:   canvases.guiCtx,
            debug: canvases.debugCtx,
            game:  canvases.gameCanvas.getContext('2d'),
        };

        this._components   = [];      // flat list of all registered components
        this._tooltip      = new ActionUITooltip({ visible: false });
        this._tooltip._ui  = this;
        this._osk          = new ActionUIOnScreenKeyboard({ target: null });
        this._osk._ui      = this;
        this._notifications = [];
        this._notifSlotY   = 20;
        this._focusedId    = null;

        // Keyboard/gamepad navigation focus
        this._kbFocus      = null;    // currently keyboard-focused component
        this._kbFocusVisible = false; // whether to draw focus ring
        
        // Enable/disable keyboard navigation
        this._enableKeyboardNavigation = true;

        // Track pointer state internally (ActionEngine drives us from outside)
        this._pointer     = { x: 0, y: 0, down: false };
        this._prevDown    = false;
        this._dropdownWasOpen = false;  // Track if dropdown was open during pointer down

        // Register a catch-all element for pointer tracking
        // This keeps the internal state aligned with ActionEngine's input pipeline
        this._inputElementId = '__actionui_root__';
        this.input.registerElement(this._inputElementId, {
            bounds: () => ({ x: 0, y: 0, width: 800, height: 600 })
        });

        // Context menus need global pointer-down to close
        this._activeContextMenus = [];

        // Listen to keyboard events for text input (capture phase to intercept before browser defaults)
        this._keyboardListener = window.addEventListener('keydown', (e) => {
            this._handleKeyboardInput(e);
        }, { capture: true });

        // Listen to wheel events for scrollable components
        this._wheelListener = window.addEventListener('wheel', (e) => {
            this._handleMouseWheel(e);
        }, { passive: false });
    }

    // Getter/setter for keyboard navigation
    get enableKeyboardNavigation() {
        return this._enableKeyboardNavigation;
    }

    set enableKeyboardNavigation(value) {
        this._enableKeyboardNavigation = value;
        // Clear focus when disabling keyboard navigation
        if (!value) {
            this._kbFocus = null;
            this._kbFocusVisible = false;
        } else {
            // Re-enable visibility when turning back on so ring shows on next navigation
            this._kbFocusVisible = true;
        }
    }

    _handleKeyboardInput(e) {
        // If keyboard navigation is disabled, don't handle
        if (!this.enableKeyboardNavigation) return;
        
        // Ignore physical keyboard input when on-screen keyboard is showing
        if (this._osk && this._osk._showing) return;

        // If no component is focused, don't handle
        if (!this._focusedId) return;

        const focused = this._components.find(c => c.id === this._focusedId);
        if (!focused) return;

        const ctrl = e.ctrlKey || e.metaKey; // metaKey for Mac Cmd key

        // Ctrl+C: Copy
        if (e.key.toLowerCase() === 'c' && ctrl) {
            if (focused._hasSelection !== undefined && focused._hasSelection) {
                navigator.clipboard.writeText(focused._selectedText).catch(() => {});
                e.preventDefault();
            }
            return;
        }

        // Ctrl+X: Cut
        if (e.key.toLowerCase() === 'x' && ctrl) {
            if (focused._hasSelection !== undefined && focused._hasSelection) {
                navigator.clipboard.writeText(focused._selectedText).catch(() => {});
                focused._deleteSelection && focused._deleteSelection();
                e.preventDefault();
            }
            return;
        }

        // Ctrl+V: Paste
        if (e.key.toLowerCase() === 'v' && ctrl) {
            if (typeof focused.onChar === 'function') {
                navigator.clipboard.readText().then(text => {
                    if (!text) return;
                    for (const ch of text) {
                        focused.onChar(ch);
                    }
                }).catch(() => {});
            }
            e.preventDefault();
            return;
        }

        // Ctrl+A: Select All
        if (e.key.toLowerCase() === 'a' && ctrl) {
            if (focused._anchor !== undefined) {
                focused._anchor = 0;
                focused._cursor = focused.value.length;
                focused._cursorT = 0;
            }
            e.preventDefault();
            return;
        }

        // Printable characters go to onChar
        if (e.key.length === 1 && !ctrl) {
            focused.onChar(e.key);
            e.preventDefault();
            return;
        }

        // Special keys go to onKeyDown
        // Arrow keys are passed directly for text navigation (not mapped to DirLeft/Right)
        // to avoid conflict with A/D typing
        const keyMap = {
            'Backspace': 'Backspace',
            'Delete': 'Delete',
            'Enter': 'Enter',
            'Escape': 'Action2'
        };
        
        // Handle arrow keys directly for text inputs
        if (e.key === 'ArrowLeft') {
            focused.onKeyDown('ArrowLeft', ctrl);
            e.preventDefault();
            return;
        }
        if (e.key === 'ArrowRight') {
            focused.onKeyDown('ArrowRight', ctrl);
            e.preventDefault();
            return;
        }
        if (e.key === 'ArrowUp') {
            focused.onKeyDown('ArrowUp', ctrl);
            e.preventDefault();
            return;
        }
        if (e.key === 'ArrowDown') {
            focused.onKeyDown('ArrowDown', ctrl);
            e.preventDefault();
            return;
        }
        
        if (keyMap[e.key]) {
            focused.onKeyDown(keyMap[e.key]);
            e.preventDefault();
        }
    }

    _handleMouseWheel(e) {
        // Find the component under the pointer that can handle mouse wheel
        const pointerPos = this.input.getPointerPosition();
        
        // Iterate components in reverse order (top-to-bottom) to find the topmost hittable component
        for (let i = this._components.length - 1; i >= 0; i--) {
            const comp = this._components[i];
            if (!comp.visible) continue;
            if (!comp.containsPoint(pointerPos.x, pointerPos.y)) continue;
            
            // Check if component has a wheel handler
            if (typeof comp.onMouseWheel === 'function') {
                e.preventDefault();
                // Pass normalized wheel delta (positive = up, negative = down)
                comp.onMouseWheel(e.deltaY > 0 ? -1 : 1);
                return;
            }
        }
    }

    // ── Component registration ──────────────────────────────────────────────

    /**
     * Add one or more components to ActionUI's managed list.
     * Components are drawn and updated automatically.
     */
    add(...comps) {
        for (const comp of comps) {
            comp._ui = this;
            // Register with ActionEngine input for hover detection
            this.input.registerElement(comp.id, {
                bounds: () => comp.visible ? comp.getBounds() : { x:-9999, y:-9999, width:0, height:0 }
            }, comp.layer);
            this._components.push(comp);

            // If it has children (panels/grids), register those too
            if (comp.children) {
                comp.children.forEach(child => this.add(child));
            }
        }
        return this;
    }

    /**
     * Remove a component by id
     */
    remove(id) {
        this._components = this._components.filter(c => c.id !== id);
    }

    /**
     * Find a component by id
     */
    get(id) {
        return this._components.find(c => c.id === id) || null;
    }

    // ── Notification API ────────────────────────────────────────────────────

    /**
     * Show a toast notification.
     * @param {string} message
     * @param {string} type  info|success|warning|danger
     * @param {number} duration  seconds (optional)
     */
    notify(message, type = 'info', duration) {
        const t     = this.theme;
        const w     = t.notificationWidth;
        const margin = 12;
        const x      = 800 - w - margin;
        // Stack from bottom upward
        const slotIdx = this._notifications.length;
        const y       = this._notifSlotY + slotIdx * 64;

        const notif = new ActionUINotification({
            message, type, duration,
            x, y,
            width: w,
            layer: 'gui',
        });
        notif._ui = this;
        this._notifications.push(notif);
        return notif;
    }

    // ── Modal API ───────────────────────────────────────────────────────────

    /**
     * Open a modal dialog and return it.
     */
    openModal(props) {
        const modal = new ActionUIModal(props);
        modal._ui   = this;
        this._components.push(modal);
        modal.open();
        return modal;
    }

    // ── Context menu API ────────────────────────────────────────────────────

    showContextMenu(menu, x, y) {
        menu._ui = this;
        if (!this._components.includes(menu)) this._components.push(menu);
        menu.openAt(x, y);
        this._activeContextMenus.push(menu);
    }

    // ── Core update — call from action_update ───────────────────────────────

    /**
     * Call this every frame from your Game's action_update().
     * @param {number} dt  delta time in seconds
     */
    update(dt) {
        const ptr   = this.input.getPointerPosition();
        const down  = this.input.isPointerDown ? this.input.isPointerDown() : this.input.isLeftMouseButtonDown();
        const justD = this.input.isPointerJustDown ? this.input.isPointerJustDown() : this.input.isLeftMouseButtonJustPressed();
        const justU = !down && this._prevDown;

        this._pointer.x    = ptr.x;
        this._pointer.y    = ptr.y;
        this._pointer.down = down;

        // Sort by zIndex for correct pick order
        const sorted = [...this._components].sort((a, b) => b.zIndex - a.zIndex);

        // Clear hover state on all components first
        for (const comp of sorted) {
            if (comp.visible) comp._hovered = false;
        }

        // Hover detection using ActionEngine's element system
        for (const comp of sorted) {
            if (!comp._isEffectivelyVisible() || !comp.enabled) continue;
            const hov = this.input.isElementHovered(comp.id, comp.layer);
            comp._hovered = hov;
            if (hov && comp.tooltip) {
                this._tooltip.text = comp.tooltip;
                this._tooltip.showAt(ptr.x, ptr.y);
            }
        }

        // Clear keyboard focus ring only when hovering over an explicitly interactive component
        const interactiveHovered = sorted.some(c => c._hovered && c.isInteractive === true);
        if (interactiveHovered && this._kbFocusVisible) {
            this._kbFocusVisible = false;
            if (this._kbFocus && this._kbFocus._kbActive) {
                this._kbFocus._kbActive = false;
            }
        }

        // If no component is hovered, hide tooltip
        if (!sorted.some(c => c._hovered && c.tooltip)) this._tooltip.hideTooltip();

        // On-screen keyboard intercepts pointer events when showing
        if (this._osk && this._osk._showing) {
            if (justD) this._osk.onPointerDown(ptr.x, ptr.y);
            this._osk.onPointerMove(ptr.x, ptr.y);
        }

        // Pointer down events
        if (justD) {
            this._dropdownWasOpen = false;
            // If a dropdown is open, it intercepts all pointer events (prevents click-through)
            for (const comp of this._components) {
                if (comp instanceof ActionUIDropdown && comp._open) {
                    this._dropdownWasOpen = true;
                    comp.onPointerDown(ptr.x, ptr.y);
                    return;
                }
            }
            this._handlePointerDown(ptr.x, ptr.y, sorted);
        }

        // Pointer up events
        if (justU) {
            // If dropdown was open during pointer down, consume the up event too
            if (this._dropdownWasOpen) {
                this._dropdownWasOpen = false;
                return;
            }
            this._handlePointerUp(ptr.x, ptr.y, sorted);
        }

        // Pointer move
        this._handlePointerMove(ptr.x, ptr.y);

        // Keyboard input for focused component
        this._handleKeyboard();

        // Update all components (respect parent visibility)
        for (const comp of this._components) {
            if (comp._isEffectivelyVisible()) comp.update(dt);
        }

        // Update on-screen keyboard (not in component list)
        if (this._osk && this._osk._showing) {
            this._osk.update(dt);
        }

        // Update tooltip
        this._tooltip.update(dt);

        // Update notifications (and remove expired)
        this._notifications = this._notifications.filter(n => n.visible);
        for (const n of this._notifications) n.update(dt);

        this._prevDown = down;
    }

    _handlePointerDown(px, py, sorted) {
        // Context menus intercept first
        for (const menu of [...this._activeContextMenus].reverse()) {
            if (menu.visible && menu._open) {
                menu.onPointerDown(px, py);
                if (!menu._open) this._activeContextMenus.splice(this._activeContextMenus.indexOf(menu), 1);
                return;
            }
        }

        // Find topmost component that accepts this pointer
        let handled = false;
        let clickedTextInput = false;
        for (const comp of sorted) {
            if (!comp._isEffectivelyVisible() || !comp.enabled) continue;
            if (comp.containsPoint(px, py)) {
                comp.onPointerDown(px, py);
                // Focus management
                if (comp instanceof ActionUITextInput) {
                    if (this._focusedId && this._focusedId !== comp.id) {
                        const prev = this._components.find(c => c.id === this._focusedId);
                        if (prev) prev.onBlur();
                    }
                    comp.onFocus();
                    this._focusedId = comp.id;
                    clickedTextInput = true;
                }
                handled = true;
                // Only break on opaque widgets (modals, dropdowns, context menus)
                if (comp instanceof ActionUIModal || comp instanceof ActionUIDropdown) break;
            }
        }

        // If clicked on empty space (not on a text input), blur the current text input
        if (!clickedTextInput && this._focusedId) {
            const focused = this._components.find(c => c.id === this._focusedId);
            if (focused instanceof ActionUITextInput) {
                focused.onBlur();
                this._focusedId = null;
            }
        }

        // Right click — try context menu on component with contextMenu prop
        if (this.input.isRightMouseButtonJustPressed && this.input.isRightMouseButtonJustPressed()) {
            for (const comp of sorted) {
                if (!comp.visible) continue;
                if (comp.containsPoint(px, py) && comp._contextMenu) {
                    this.showContextMenu(comp._contextMenu, px, py);
                    break;
                }
            }
        }
    }

    _handlePointerUp(px, py, sorted) {
        for (const comp of sorted) {
            if (!comp._isEffectivelyVisible()) continue;
            comp.onPointerUp(px, py);
        }
    }

    _handlePointerMove(px, py) {
        for (const comp of this._components) {
            if (!comp._isEffectivelyVisible()) continue;
            comp.onPointerMove(px, py);
        }
    }

    _handleKeyboard() {
        // If keyboard navigation is disabled, only handle on-screen keyboard and modals/text inputs
        const kbNavDisabled = !this.enableKeyboardNavigation;
        
        // If the on-screen keyboard is showing, pass keys to it
        if (this._osk && this._osk._showing) {
            const keys = ['DirLeft', 'DirRight', 'DirUp', 'DirDown', 'Action1', 'Action2'];
            for (const k of keys) {
                if (this.input.isKeyJustPressed(k)) this._osk.onKeyDown(k);
            }
            return;
        }

        // If a modal is showing, pass keys to it
        const modal = this._components.find(c => c instanceof ActionUIModal && c._showing);
        if (modal) {
            const keys = ['DirLeft', 'DirRight', 'DirUp', 'DirDown', 'Action1', 'Action2'];
            for (const k of keys) {
                if (this.input.isKeyJustPressed(k)) modal.onKeyDown(k);
            }
            return;
        }

        // If text input is focused, pass keys to it
        const textFocused = this._focusedId
            ? this._components.find(c => c.id === this._focusedId)
            : null;
        if (textFocused instanceof ActionUITextInput) {
            const keys = ['DirLeft', 'DirRight', 'DirUp', 'DirDown', 'Action1', 'Action2', 'Backspace', 'Delete'];
            for (const k of keys) {
                if (this.input.isKeyJustPressed(k)) textFocused.onKeyDown(k);
            }
            return;
        }

        // Skip keyboard navigation if disabled
        if (kbNavDisabled) return;

        // Keyboard navigation
        const isKbActive = this._kbFocus && this._kbFocus._kbActive;
        const isDropdown = this._kbFocus instanceof ActionUIDropdown;
        const isRadioGroup = this._kbFocus instanceof ActionUIRadioGroup;
        const isScrollPanel = this._kbFocus instanceof ActionUIScrollPanel;

        if (this.input.isKeyJustPressed('DirUp')) {
            if (isDropdown && isKbActive && this._kbFocus.onKeyDown) this._kbFocus.onKeyDown('DirUp');
            else if (isScrollPanel && this._kbFocus.onKeyDown) {
                if (!this._kbFocus.onKeyDown('DirUp')) this._moveKbFocus('up');
            }
            else if (isKbActive && this._kbFocus.onKeyDown) this._kbFocus.onKeyDown('DirUp');
            else if (isRadioGroup && this._kbFocus.onKeyDown) {
                if (!this._kbFocus.onKeyDown('DirUp')) this._moveKbFocus('up');
            }
            else this._moveKbFocus('up');
        }
        if (this.input.isKeyJustPressed('DirDown')) {
            if (isDropdown && isKbActive && this._kbFocus.onKeyDown) this._kbFocus.onKeyDown('DirDown');
            else if (isScrollPanel && this._kbFocus.onKeyDown) {
                if (!this._kbFocus.onKeyDown('DirDown')) this._moveKbFocus('down');
            }
            else if (isKbActive && this._kbFocus.onKeyDown) this._kbFocus.onKeyDown('DirDown');
            else if (isRadioGroup && this._kbFocus.onKeyDown) {
                if (!this._kbFocus.onKeyDown('DirDown')) this._moveKbFocus('down');
            }
            else this._moveKbFocus('down');
        }
        if (this.input.isKeyJustPressed('DirLeft')) {
            if (isScrollPanel && this._kbFocus.onKeyDown) {
                if (!this._kbFocus.onKeyDown('DirLeft')) this._moveKbFocus('left');
            }
            else if (isKbActive && this._kbFocus.onKeyDown) this._kbFocus.onKeyDown('DirLeft');
            else this._moveKbFocus('left');
        }
        if (this.input.isKeyJustPressed('DirRight')) {
            if (isScrollPanel && this._kbFocus.onKeyDown) {
                if (!this._kbFocus.onKeyDown('DirRight')) this._moveKbFocus('right');
            }
            else if (isKbActive && this._kbFocus.onKeyDown) this._kbFocus.onKeyDown('DirRight');
            else this._moveKbFocus('right');
        }
        if (this.input.isKeyJustPressed('Action1')) {
            if (isDropdown) {
                if (isKbActive && this._kbFocus.onKeyDown) this._kbFocus.onKeyDown('Action1');
                else this._activateKbFocus();
            } else if (isScrollPanel && this._kbFocus.onKeyDown) {
                this._kbFocus.onKeyDown('Action1');
            } else if (this._kbFocus instanceof ActionUITextInput) {
                // Text input focused via keyboard navigation - open OSK
                this._openOnScreenKeyboard(this._kbFocus);
            } else {
                this._activateKbFocus();
            }
        }
        if (this.input.isKeyJustPressed('Action2')) {
            if (isDropdown) {
                if (isKbActive && this._kbFocus.onKeyDown) this._kbFocus.onKeyDown('Action2');
                else this._cancelKbFocus();
            } else if (isScrollPanel && this._kbFocus.onKeyDown) {
                this._kbFocus.onKeyDown('Action2');
            } else {
                this._cancelKbFocus();
            }
        }
    }

    _getInteractiveComponents() {
        return this._components.filter(c => c.isInteractive && c._isEffectivelyVisible() && c.enabled);
    }

    _moveKbFocus(direction) {
        const interactive = this._getInteractiveComponents();
        if (interactive.length === 0) return;

        // Show focus ring on first navigation
        this._kbFocusVisible = true;

        if (!this._kbFocus || !interactive.includes(this._kbFocus)) {
            // Start with first interactive component
            this._setKbFocus(interactive[0]);
            return;
        }

        // Find nearest component in the given direction using edge-to-edge distance
        const current = this._kbFocus.getBounds();

        let best = null;
        let bestScore = Infinity;

        for (const comp of interactive) {
            if (comp === this._kbFocus) continue;
            const b = comp.getBounds();

            let inDirection = false;
            let primaryDist = 0;
            let perpOverlap = 0;

            if (direction === 'up') {
                // Target must be above current component
                inDirection = b.y + b.height < current.y - 2;
                if (!inDirection) continue;
                // Edge-to-edge distance: from current top to target bottom
                primaryDist = current.y - (b.y + b.height);
                // Perpendicular overlap on X axis
                const overlapStart = Math.max(current.x, b.x);
                const overlapEnd = Math.min(current.x + current.width, b.x + b.width);
                perpOverlap = Math.max(0, overlapEnd - overlapStart);
            } else if (direction === 'down') {
                // Target must be below current component
                inDirection = b.y > current.y + current.height + 2;
                if (!inDirection) continue;
                // Edge-to-edge distance: from current bottom to target top
                primaryDist = b.y - (current.y + current.height);
                // Perpendicular overlap on X axis
                const overlapStart = Math.max(current.x, b.x);
                const overlapEnd = Math.min(current.x + current.width, b.x + b.width);
                perpOverlap = Math.max(0, overlapEnd - overlapStart);
            } else if (direction === 'left') {
                // Target must be to the left of current component
                inDirection = b.x + b.width < current.x - 2;
                if (!inDirection) continue;
                // Edge-to-edge distance: from current left to target right
                primaryDist = current.x - (b.x + b.width);
                // Perpendicular overlap on Y axis
                const overlapStart = Math.max(current.y, b.y);
                const overlapEnd = Math.min(current.y + current.height, b.y + b.height);
                perpOverlap = Math.max(0, overlapEnd - overlapStart);
            } else if (direction === 'right') {
                // Target must be to the right of current component
                inDirection = b.x > current.x + current.width + 2;
                if (!inDirection) continue;
                // Edge-to-edge distance: from current right to target left
                primaryDist = b.x - (current.x + current.width);
                // Perpendicular overlap on Y axis
                const overlapStart = Math.max(current.y, b.y);
                const overlapEnd = Math.min(current.y + current.height, b.y + b.height);
                perpOverlap = Math.max(0, overlapEnd - overlapStart);
            }

            // Score: primary distance + penalty for lack of perpendicular overlap
            // If fully overlapping, no penalty. If no overlap, add the gap as penalty.
            const perpSize = direction === 'up' || direction === 'down'
                ? Math.min(current.width, b.width)
                : Math.min(current.height, b.height);
            const perpGap = Math.max(0, perpSize - perpOverlap);
            const score = primaryDist + perpGap * 0.5;

            if (score < bestScore) {
                bestScore = score;
                best = comp;
            }
        }

        if (best) this._setKbFocus(best);
    }

    _setKbFocus(comp) {
        // Deactivate previous component
        if (this._kbFocus && this._kbFocus._kbActive) {
            this._kbFocus._kbActive = false;
        }
        this._kbFocus = comp;
    }

    _activateKbFocus() {
        if (!this._kbFocus) return;
        this._kbFocusVisible = true;

        // Checkboxes and toggles just toggle, don't enter active mode
        if (this._kbFocus instanceof ActionUICheckbox || this._kbFocus instanceof ActionUIToggleSwitch) {
            const b = this._kbFocus.getBounds();
            const cx = b.x + b.width / 2;
            const cy = b.y + b.height / 2;
            this._kbFocus.onPointerUp(cx, cy);
            return;
        }

        // Text inputs: open on-screen keyboard for gamepad users
        if (this._kbFocus instanceof ActionUITextInput) {
            this._openOnScreenKeyboard(this._kbFocus);
            return;
        }

        // If component is already in active mode, Action1 does nothing
        if (this._kbFocus._kbActive) return;

        // If component supports active mode, enter it
        if (this._kbFocus._kbActive !== undefined) {
            this._kbFocus._kbActive = true;
            return;
        }

        // Otherwise simulate pointer click
        const b = this._kbFocus.getBounds();
        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;
        this._kbFocus.onPointerDown(cx, cy);
        this._kbFocus.onPointerUp(cx, cy);
    }

    _cancelKbFocus() {
        // If the on-screen keyboard is showing, close it
        if (this._osk && this._osk._showing) {
            this._osk.close();
            return;
        }

        // If a component is in active mode, deactivate it
        if (this._kbFocus && this._kbFocus._kbActive) {
            this._kbFocus._kbActive = false;
            return;
        }
        // Close modals, dropdowns, context menus
        for (const menu of [...this._activeContextMenus].reverse()) {
            if (menu.visible && menu._open) { menu.close(); return; }
        }
        for (const comp of this._components) {
            if (comp instanceof ActionUIModal && comp._showing) { comp.close(); return; }
            if (comp instanceof ActionUIDropdown && comp._open) { comp._open = false; return; }
        }
    }

    _drawKbFocusRing(ctx) {
        if (!this._kbFocusVisible || !this._kbFocus || !this._kbFocus._isEffectivelyVisible()) return;
        const t = this.theme;

        // For scroll panels, draw the ring on the focused child with scroll-adjusted position
        // Always use normal focus color (scroll panels are always "active" but not in the same sense as dropdowns)
        if (this._kbFocus instanceof ActionUIScrollPanel) {
            const focusedBounds = this._kbFocus.getKbFocusedChildBounds();
            if (focusedBounds) {
                const pad = 3;
                ActionUIDrawUtils.strokeRoundRect(ctx, focusedBounds.x - pad, focusedBounds.y - pad,
                    focusedBounds.width + pad * 2, focusedBounds.height + pad * 2,
                    t.radiusSm, t.colorBorderFocus, 2);
                return;
            }
        }

        const b = this._kbFocus.getBounds();
        const pad = 3;
        const color = this._kbFocus._kbActive ? t.colorKbFocusActive : t.colorBorderFocus;
        ActionUIDrawUtils.strokeRoundRect(ctx, b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2,
            t.radiusSm, color, 2);
    }

    /**
     * Forward raw character input to the focused text input.
     * The Game class should call this when it receives character events.
     */
    sendChar(char) {
        const focused = this._focusedId
            ? this._components.find(c => c.id === this._focusedId)
            : null;
        if (focused instanceof ActionUITextInput) focused.onChar(char);
    }

    /**
     * Open the on-screen keyboard for a text input.
     * Used by gamepad users to type text.
     */
    _openOnScreenKeyboard(textInput) {
        // Set focus on the text input so onChar/onKeyDown will work
        if (this._focusedId && this._focusedId !== textInput.id) {
            const prev = this._components.find(c => c.id === this._focusedId);
            if (prev) prev.onBlur();
        }
        textInput._focused = true;
        this._focusedId = textInput.id;

        this._osk.target = textInput;
        this._osk.open();
    }

    /**
     * Check if the on-screen keyboard is currently showing
     */
    isOnScreenKeyboardShowing() {
        return this._osk && this._osk._showing;
    }

    // ── Draw — call from action_draw ─────────────────────────────────────────

    /**
     * Draw all components onto their respective canvases.
     * Call from your Game's action_draw().
     * @param {string} layer  'gui' | 'debug' | 'game' | 'all'
     */
    draw(layer = 'all') {
        const layers = layer === 'all' ? ['game', 'gui', 'debug'] : [layer];

        for (const l of layers) {
            const ctx = this._ctxMap[l];
            if (!ctx) continue;

            // Sort by zIndex
            const comps = this._components
                .filter(c => c.visible && (c.layer === l || l === 'all'))
                .sort((a, b) => a.zIndex - b.zIndex);

            for (const comp of comps) {
                if (comp._isEffectivelyVisible()) comp.draw(ctx);
            }

            // Notifications always draw on gui
            if (l === 'gui') {
                this._notifications.forEach(n => n.draw(ctx));
                // Context menus (draw last so they're on top)
                this._activeContextMenus.forEach(m => m.draw(ctx));
            }

            // Tooltip drawn last (topmost)
            if (l === 'gui') {
                this._tooltip.draw(ctx);
            }
            
            // Keyboard focus ring drawn on the layer of the focused component
            if (this._kbFocus && this._kbFocus.layer === l) {
                this._drawKbFocusRing(ctx);
            }
            
            // On-screen keyboard drawn last (above everything) on the layer of its target
            if (this._osk && this._osk._showing && this._osk.target && this._osk.target._isEffectivelyVisible() && this._osk.target.layer === l) {
                this._osk.draw(ctx);
            }
        }
    }

    // ── Convenience factory methods ──────────────────────────────────────────

    makeButton(props)        { const c = new ActionUIButton(props);        this.add(c); return c; }
    makeLabel(props)         { const c = new ActionUILabel(props);         this.add(c); return c; }
    makePanel(props)         { const c = new ActionUIPanel(props);         this.add(c); return c; }
    makeSlider(props)        { const c = new ActionUISlider(props);        this.add(c); return c; }
    makeProgressBar(props)   { const c = new ActionUIProgressBar(props);   this.add(c); return c; }
    makeCheckbox(props)      { const c = new ActionUICheckbox(props);      this.add(c); return c; }
    makeRadioGroup(props)    { const c = new ActionUIRadioGroup(props);    this.add(c); return c; }
    makeTextInput(props)     { const c = new ActionUITextInput(props);     this.add(c); return c; }
    makeToggle(props)        { const c = new ActionUIToggleSwitch(props);  this.add(c); return c; }
    makeStepper(props)       { const c = new ActionUINumberStepper(props); this.add(c); return c; }
    makeDropdown(props)      { const c = new ActionUIDropdown(props);      this.add(c); return c; }
    makeTabBar(props)        { const c = new ActionUITabBar(props);        this.add(c); return c; }
    makeSeparator(props)     { const c = new ActionUISeparator(props);     this.add(c); return c; }
    makeBadge(props)         { const c = new ActionUIBadge(props);         this.add(c); return c; }
    makeSpinner(props)       { const c = new ActionUISpinner(props);       this.add(c); return c; }
    makeToggleSwitch(props)  { const c = new ActionUIToggleSwitch(props);  this.add(c); return c; }
    makeAvatar(props)        { const c = new ActionUIAvatarDisplay(props); this.add(c); return c; }
    makeColorSwatch(props)   { const c = new ActionUIColorSwatch(props);   this.add(c); return c; }
    makeContextMenu(props)   { const c = new ActionUIContextMenu(props);   return c; }
    makeIconButton(props)    { const c = new ActionUIIconButton(props);    this.add(c); return c; }
    makeScrollPanel(props)   { const c = new ActionUIScrollPanel(props);   this.add(c); return c; }
    makeGrid(props)          { const c = new ActionUIGrid(props);          this.add(c); return c; }
    makeOnScreenKeyboard(props) { const c = new ActionUIOnScreenKeyboard(props); return c; }
}
