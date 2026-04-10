/******************************************************************************
 * ActionUIDropdown — select / combo box
 ******************************************************************************/

class ActionUIDropdown extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.isInteractive = props.isInteractive ?? true;
        this.options    = props.options   || [];
        this.selected   = props.selected  ?? 0;
        this.label      = props.label     || '';
        this.height     = props.height    || 36;
        this._open      = false;
        this._openT     = 0;
        this._itemH     = 34;
        this._hoverItem = -1;
        this._kbActive  = false;
        this._kbHighlight = -1;
        this.zIndex     = 100;  // draw above everything
    }

    _onUpdate(dt) {
        const target = this._open ? 1 : 0;
        this._openT  = ActionUIDrawUtils.lerp(this._openT, target, dt / this.theme.animDurationNormal);
        if (this._open && this._kbHighlight < 0) this._kbHighlight = this.selected;
    }

    _getListBounds() {
        const listH = this.options.length * this._itemH;
        return {
            x: this.x,
            y: this.y + this.height + 2,
            width: this.width,
            height: listH
        };
    }

    _isInList(px, py) {
        if (!this._open) return false;
        const lb = this._getListBounds();
        return px >= lb.x && px <= lb.x + lb.width && py >= lb.y && py <= lb.y + lb.height;
    }

    containsPoint(px, py) {
        if (!this.visible) return false;
        if (super.containsPoint(px, py)) return true;
        return this._isInList(px, py);
    }

    onPointerDown(px, py) {
        if (!this.enabled) return;
        // If open and click in list, select item
        if (this._open && this._isInList(px, py)) {
            const lb = this._getListBounds();
            const relY = py - lb.y;
            const idx = Math.floor(relY / this._itemH);
            if (idx >= 0 && idx < this.options.length) {
                this.selected = idx;
                this._kbHighlight = idx;
                this.onChange && this.onChange(this.options[idx].value, this);
            }
            this._open = false;
            this._kbHighlight = -1;
            return;
        }
        // If open and click outside, just close
        if (this._open) {
            this._open = false;
            this._kbHighlight = -1;
            return;
        }
        // If closed and click on dropdown, open it
        if (this.containsPoint(px, py)) {
            this._open = true;
            this._kbHighlight = this.selected;
        }
    }

    onPointerMove(px, py) {
        if (!this._open) return;
        if (this._isInList(px, py)) {
            const lb = this._getListBounds();
            const relY = py - lb.y;
            this._hoverItem = Math.floor(relY / this._itemH);
        } else {
            this._hoverItem = -1;
        }
    }

    onKeyDown(key) {
        if (!this.enabled) return;
        if (!this._kbActive) return;
        if (key === 'DirUp' || key === 'DirDown') {
            if (!this._open) { this._open = true; }
            if (this._kbHighlight < 0) this._kbHighlight = this.selected;
            if (key === 'DirUp' && this._kbHighlight > 0) this._kbHighlight--;
            else if (key === 'DirDown' && this._kbHighlight < this.options.length - 1) this._kbHighlight++;
        } else if (key === 'Action1') {
            if (!this._open) {
                this._open = true;
                this._kbHighlight = this.selected;
            } else if (this._kbHighlight >= 0) {
                this.selected = this._kbHighlight;
                this.onChange && this.onChange(this.options[this.selected].value, this);
                this._open = false;
                this._kbHighlight = -1;
                this._kbActive = false;
            }
        } else if (key === 'Action2') {
            this._open = false;
            this._kbHighlight = -1;
            this._kbActive = false;
        }
    }

    draw(ctx) {
        if (!this.visible) return;
        const t = this.theme;
        const r = t.radiusMd;

        ctx.save();
        this._applyOpacity(ctx);

        if (this.label) {
            ActionUIDrawUtils.text(ctx, this.label,
                this.x, this.y - 2,
                t.font(t.fontSizeSm), t.colorTextMuted, 'left', 'bottom'
            );
        }

        // Control background
        const borderCol = this._open ? t.colorBorderFocus : t.colorBorder;
        ActionUIDrawUtils.fillRoundRect(ctx, this.x, this.y, this.width, this.height, r, t.colorSurface);
        if (this._open) ActionUIDrawUtils.shadow(ctx, t.withAlpha(t.colorBorderFocus, 0.4), 8, 0, 0);
        ActionUIDrawUtils.strokeRoundRect(ctx, this.x, this.y, this.width, this.height, r, borderCol, 1.5);
        ActionUIDrawUtils.clearShadow(ctx);

        // Selected label
        const sel = this.options[this.selected];
        if (sel) {
            ActionUIDrawUtils.text(ctx, sel.label,
                this.x + t.spacingMd, this.y + this.height / 2,
                t.font(t.fontSizeMd), t.colorText, 'left', 'middle'
            );
        }

        // Arrow
        const arrowX = this.x + this.width - 28;
        const arrowY = this.y + (this.height - 14) / 2;
        const icon   = this._openT > 0.5 ? 'arrow_up' : 'arrow_down';
        ActionUIIconRenderer.draw(ctx, icon, arrowX, arrowY, 14, t.colorTextMuted);

        // Dropdown list
        if (this._openT > 0.02) {
            this._drawList(ctx, t, r);
        }

        this._restoreOpacity(ctx);
        ctx.restore();
    }

    _drawList(ctx, t, r) {
        const listY   = this.y + this.height + 2;
        const listH   = this.options.length * this._itemH;
        const visibleH = listH * ActionUIDrawUtils.easeOut(this._openT);

        ctx.save();
        ActionUIDrawUtils.shadow(ctx, t.colorShadow, 20, 0, 6);
        ActionUIDrawUtils.fillRoundRect(ctx, this.x, listY, this.width, visibleH, r, t.colorSurfaceOverlay);
        ActionUIDrawUtils.clearShadow(ctx);
        ActionUIDrawUtils.strokeRoundRect(ctx, this.x, listY, this.width, visibleH, r, t.colorBorder, 1);

        // Clip items to list bounds
        ctx.beginPath();
        ActionUIDrawUtils.roundRect(ctx, this.x, listY, this.width, visibleH, r);
        ctx.clip();

        for (let i = 0; i < this.options.length; i++) {
            const iy  = listY + i * this._itemH;
            const opt = this.options[i];

            if (i === this.selected) {
                ActionUIDrawUtils.fillRoundRect(ctx, this.x, iy, this.width, this._itemH, 0,
                    t.withAlpha(t.colorPrimary, 0.18)
                );
            } else if (i === this._hoverItem) {
                ActionUIDrawUtils.fillRoundRect(ctx, this.x, iy, this.width, this._itemH, 0,
                    t.withAlpha(t.colorText, 0.06)
                );
            }

            // Keyboard highlight
            if (this._kbActive && i === this._kbHighlight) {
                ActionUIDrawUtils.fillRoundRect(ctx, this.x, iy, this.width, this._itemH, 0,
                    t.withAlpha(t.colorKbFocusActive, 0.25)
                );
            }

            const col = i === this.selected ? t.colorPrimary : t.colorText;
            ActionUIDrawUtils.text(ctx, opt.label,
                this.x + t.spacingMd, iy + this._itemH / 2,
                t.font(t.fontSizeMd), col, 'left', 'middle'
            );
        }

        ctx.restore();
    }
}
