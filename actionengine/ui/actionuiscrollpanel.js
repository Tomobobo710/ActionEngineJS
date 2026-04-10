/******************************************************************************
 * ActionUIScrollPanel — thin wrapper around ActionUIScrollableArea
 * Lets the scroller handle clipping, input, scroll mechanics, and drawing
 ******************************************************************************/

class ActionUIScrollPanel extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.children = [];
        this._itemHeight = props.itemHeight || 30;
        this._padding = props.padding || 4;
        this._scrollbarWidth = 20;
        this._scroller = null;
        this._needsRebuild = true;

        // Key navigation state - always active for keyboard navigation
        this._kbActive = true;
        this._kbFocusIndex = 0;

        // Make this component interactive (can receive keyboard focus)
        this.isInteractive = true;
    }

    addChild(comp) {
        comp._ui = this._ui;
        comp._parent = this;
        this.children.push(comp);
        this._needsRebuild = true;
        return this;
    }

    removeChild(id) {
        this.children = this.children.filter(c => c.id !== id);
        this._needsRebuild = true;
    }

    _buildScroller() {
        if (!this._ui) return;
        const { x, y, width, height } = this.getBounds();

        this._scroller = new ActionUIScrollableArea({
            listAreaX: x,
            listAreaY: y,
            listAreaWidth: width - this._scrollbarWidth,
            listAreaHeight: height,
            itemHeight: this._itemHeight,
            padding: this._padding,
            scrollBarX: x + width - this._scrollbarWidth,
            scrollBarY: y + 10,
            scrollBarTrackHeight: height - 20,
            scrollBarThumbStartY: y + 10,
            enableClipping: true,
            clipBounds: { x, y, width: width - this._scrollbarWidth, height },
            backgroundColor: this.theme.colorSurface,
            borderColor: this.theme.colorBorder,
            borderWidth: 1,
            cornerRadius: this.theme.radiusMd,
            generateItemId: (item, index) => `scrollpanel_${this.id}_item_${index}`,
            colors: {
                track: {
                    normal: this.theme.withAlpha(this.theme.colorScrollTrack, 0.5),
                    hover: this.theme.withAlpha(this.theme.colorScrollTrack, 0.8)
                },
                thumb: {
                    normal: this.theme.withAlpha(this.theme.colorScrollThumb, 0.6),
                    hover: this.theme.withAlpha(this.theme.colorScrollThumb, 0.9),
                    drag: this.theme.colorScrollThumb
                },
                button: {
                    normal: this.theme.withAlpha(this.theme.colorPrimary, 0.1),
                    hover: this.theme.withAlpha(this.theme.colorPrimary, 0.3)
                },
                buttonText: {
                    normal: this.theme.withAlpha(this.theme.colorPrimary, 0.8),
                    hover: this.theme.colorPrimary
                },
                thumbBorder: {
                    normal: this.theme.withAlpha(this.theme.colorPrimary, 0.5),
                    drag: this.theme.colorPrimary
                }
            }
        }, this._ui.input, this._ui._ctxMap.gui || this._ui._ctxMap.debug);

        this._needsRebuild = false;
    }

    _onUpdate(dt) {
        if (this._needsRebuild) this._buildScroller();
        if (this._scroller) {
            // Always set _lastItems before update() so handleInput can access it
            this._scroller._lastItems = this.children;
            this._scroller.update(this.children.length, dt);
            this._scroller.updateItemInputs(this.children);
        }
        this.children.forEach(c => {
            c._ui = this._ui;
            c.update(dt);
        });
    }

    /**
     * Handle keyboard navigation for the scroll panel
     * Always active - DirUp/DirDown navigates between children
     * DirLeft/DirRight does spatial navigation prioritizing same-Y components
     * Returns true if the key was handled, false if it should bubble up
     */
    onKeyDown(key) {
        if (!this.enabled || this.children.length === 0) return false;

        if (key === 'DirUp') {
            if (this._kbFocusIndex > 0) {
                this._kbFocusIndex--;
                if (this._scroller) {
                    this._scroller.scrollItemIntoView(this._kbFocusIndex);
                }
                return true;
            }
            // At top, let ActionUI move focus out
            return false;
        } else if (key === 'DirDown') {
            if (this._kbFocusIndex < this.children.length - 1) {
                this._kbFocusIndex++;
                if (this._scroller) {
                    this._scroller.scrollItemIntoView(this._kbFocusIndex);
                }
                return true;
            }
            // At bottom, let ActionUI move focus out
            return false;
        } else if (key === 'DirLeft' || key === 'DirRight') {
            // Spatial navigation: find nearest component in that direction
            // Prioritize components at the same Y level (within 30px)
            if (this._parent && this._parent._ui) {
                const allComponents = this._parent._ui._getInteractiveComponents();
                const direction = key === 'DirLeft' ? -1 : 1;
                let best = null;
                let bestScore = Infinity;
                const myBounds = this.getBounds();
                const myCx = myBounds.x + myBounds.width / 2;
                const myCy = myBounds.y + myBounds.height / 2;

                for (const comp of allComponents) {
                    if (comp === this) continue;
                    const b = comp.getBounds();
                    const bx = b.x + b.width / 2;
                    const by = b.y + b.height / 2;

                    const xDiff = bx - myCx;
                    const yDiff = Math.abs(by - myCy);

                    // Check if it's in the right direction
                    const inDirection = (direction > 0 && xDiff > 10) || (direction < 0 && xDiff < -10);
                    if (!inDirection) continue;

                    // Score: heavily penalize Y difference, then X difference
                    // Components within 30px Y get a big bonus
                    const yBonus = yDiff < 30 ? 0 : yDiff * 2;
                    const score = Math.abs(xDiff) + yBonus;

                    if (score < bestScore) {
                        bestScore = score;
                        best = comp;
                    }
                }

                if (best) {
                    this._parent._ui._setKbFocus(best);
                    return true;
                }
            }
            // No component found, let ActionUI handle it
            return false;
        } else if (key === 'Action1') {
            // Activate the focused child - simulate a click
            const child = this.children[this._kbFocusIndex];
            if (child && child.enabled) {
                if (child.onClick) {
                    child.onClick(child);
                } else if (child.onPointerDown && child.onPointerUp) {
                    const cx = child.x + child.width / 2;
                    const cy = child.y + child.height / 2;
                    child.onPointerDown(cx, cy);
                    child.onPointerUp(cx, cy);
                }
            }
            return true;
        } else if (key === 'Action2') {
            // Exit the panel - move focus to next component
            return false;
        }
        return false;
    }

    /**
     * Get the currently focused child for visual feedback
     */
    getKbFocusedChild() {
        if (this._kbFocusIndex >= 0 && this._kbFocusIndex < this.children.length) {
            return this.children[this._kbFocusIndex];
        }
        return null;
    }

    /**
     * Get the bounds of the focused child, adjusted for scroll offset and panel position
     * Returns null if no child is focused or scroller doesn't exist
     */
    getKbFocusedChildBounds() {
        const child = this.getKbFocusedChild();
        if (!child || !this._scroller) return null;

        const scrollOffset = this._scroller.scrollOffset;
        const itemHeight = this._scroller.listArea.itemHeight;
        const padding = this._scroller.listArea.padding;
        const listAreaY = this._scroller.listArea.y;

        // Calculate the scrolled Y position
        const scrolledY = listAreaY + padding + this._kbFocusIndex * (itemHeight + padding) - scrollOffset;

        return {
            x: this.x + child.x,
            y: scrolledY,
            width: child.width,
            height: child.height
        };
    }

    onPointerDown(px, py) {
        if (!this.enabled || !this._isEffectivelyVisible()) return;
        // Forward to children with scroll-adjusted positions
        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];
            if (!child._isEffectivelyVisible() || !child.enabled) continue;
            const drawY = this._getChildDrawY(i);
            const cx = this.x + child.x;
            const cy = drawY;
            if (px >= cx && px <= cx + child.width && py >= cy && py <= cy + child.height) {
                child._hovered = true;
                // Temporarily set child to screen coords so ripple calculation works
                const origX = child.x;
                const origY = child.y;
                child.x = cx;
                child.y = cy;
                child.onPointerDown(px, py);
                child.x = origX;
                child.y = origY;
            }
        }
    }

    onPointerUp(px, py) {
        if (!this.enabled || !this._isEffectivelyVisible()) return;
        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];
            if (!child._isEffectivelyVisible() || !child.enabled) continue;
            const drawY = this._getChildDrawY(i);
            const cx = this.x + child.x;
            const cy = drawY;
            if (px >= cx && px <= cx + child.width && py >= cy && py <= cy + child.height) {
                const origX = child.x;
                const origY = child.y;
                child.x = cx;
                child.y = cy;
                child.onPointerUp(px, py);
                child.x = origX;
                child.y = origY;
            }
        }
    }

    onPointerMove(px, py) {
        if (!this.enabled || !this._isEffectivelyVisible()) return;
        // Clear hover state on all children first
        for (const child of this.children) {
            child._hovered = false;
        }
        // Set hover on child under pointer
        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];
            if (!child._isEffectivelyVisible() || !child.enabled) continue;
            const drawY = this._getChildDrawY(i);
            const cx = this.x + child.x;
            const cy = drawY;
            if (px >= cx && px <= cx + child.width && py >= cy && py <= cy + child.height) {
                child._hovered = true;
                const origX = child.x;
                const origY = child.y;
                child.x = cx;
                child.y = cy;
                child.onPointerMove(px, py);
                child.x = origX;
                child.y = origY;
                break;
            }
        }
    }

    _getChildDrawY(index) {
        if (!this._scroller) return this.y + this.children[index].y;
        return this._scroller.getItemDrawY(index);
    }

    draw(ctx) {
        if (!this.visible) return;
        if (this._needsRebuild) this._buildScroller();
        if (!this._scroller) return;

        const panelX = this.x;

        // Let the scroller handle everything: clipping, background, scrollbar, items
        this._scroller.draw(this.children, (child, index, y) => {
            const origX = child.x;
            const origY = child.y;
            child.x = panelX + origX;
            child.y = y;
            child.draw(ctx);
            child.x = origX;
            child.y = origY;
        });
    }

    scroll(delta) {
        if (this._scroller) this._scroller.handleMouseWheel(delta);
    }
}
