/******************************************************************************
 * ActionUITextInput — single-line keyboard text entry
 ******************************************************************************/

class ActionUITextInput extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.isInteractive = props.isInteractive ?? true;
        this.value       = props.value       || '';
        this.placeholder = props.placeholder || 'Type here…';
        this.label       = props.label       || '';
        this.maxLength   = props.maxLength   || 120;
        this.password    = props.password    || false;
        this.height      = props.height      || 36;
        this._cursor     = this.value.length;
        this._anchor     = this.value.length;  // Selection anchor
        this._cursorT    = 0;   // blink timer
        this._focusT     = 0;
        this._scrollX    = 0;
        this._dragging   = false;
        this.onSubmit    = props.onSubmit    || null;
    }

    get _selectionStart() { return Math.min(this._cursor, this._anchor); }
    get _selectionEnd()   { return Math.max(this._cursor, this._anchor); }
    get _hasSelection()   { return this._cursor !== this._anchor; }
    get _selectedText()   { return this.value.slice(this._selectionStart, this._selectionEnd); }

    _onUpdate(dt) {
        if (this._focused) {
            this._cursorT = (this._cursorT + dt) % 1.1;
            this._focusT  = Math.min(1, this._focusT + dt / this.theme.animDurationNormal);
        } else {
            this._focusT = Math.max(0, this._focusT - dt / this.theme.animDurationNormal);
            // Clear selection when not focused
            if (this._hasSelection) {
                this._anchor = this._cursor;
            }
        }
    }

    _getMeasureContext() {
        if (!ActionUITextInput._measureCtx) {
            ActionUITextInput._measureCtx = document.createElement('canvas').getContext('2d');
        }
        return ActionUITextInput._measureCtx;
    }

    _getTextWidth(text, font) {
        const ctx = this._getMeasureContext();
        ctx.font = font;
        return ctx.measureText(text).width;
    }

    _getCursorX(cursorPos, font) {
        const disp = this.password ? this.value.replace(/./g,'•') : this.value;
        return this._getTextWidth(disp.slice(0, cursorPos), font);
    }

    _posFromX(px, font) {
        const t = this.theme;
        const padX = t.spacingMd;
        const innerX = px - (this.x + padX) + this._scrollX;
        const disp = this.password ? this.value.replace(/./g,'•') : this.value;
        
        let best = 0, bestDist = Infinity;
        for (let i = 0; i <= disp.length; i++) {
            const tw = this._getTextWidth(disp.slice(0, i), font);
            const dist = Math.abs(tw - innerX);
            if (dist < bestDist) { bestDist = dist; best = i; }
        }
        return best;
    }

    onPointerDown(px, py) {
        if (!this.enabled || !this.containsPoint(px, py)) return;
        const t    = this.theme;
        const font = t.font(t.fontSizeMd);
        
        this._cursor = this._posFromX(px, font);
        this._anchor = this._cursor;
        this._dragging = true;
        this._cursorT = 0;
    }

    onPointerMove(px, py) {
        if (!this._dragging || !this.enabled) return;
        const t    = this.theme;
        const font = t.font(t.fontSizeMd);
        
        this._cursor = this._posFromX(px, font);
        this._cursorT = 0;
    }

    onPointerUp(px, py) {
        this._dragging = false;
    }

    onChar(char) {
        if (!this._focused || !this.enabled) return;
        
        // If there's a selection, replace it
        if (this._hasSelection) {
            const start = this._selectionStart;
            const end = this._selectionEnd;
            const remaining = this.value.slice(0, start) + this.value.slice(end);
            // Check max length after insertion
            if (remaining.length + 1 > this.maxLength) return;
            this.value = remaining.slice(0, start) + char + remaining.slice(start);
            this._cursor = start + 1;
            this._anchor = this._cursor;
        } else {
            if (this.value.length >= this.maxLength) return;
            this.value = this.value.slice(0, this._cursor) + char + this.value.slice(this._cursor);
            this._cursor++;
            this._anchor = this._cursor;
        }
        this.onChange && this.onChange(this.value, this);
        this._scrollToCursor();
    }

    onKeyDown(key, ctrl = false) {
        if (!this._focused || !this.enabled) return;

        // Ctrl+Arrow: Word boundary navigation
        if (key === 'ArrowLeft' && ctrl) {
            this._cursor = this._prevWordBoundary();
            this._anchor = this._cursor;
            this._cursorT = 0;
            this._scrollToCursor();
            return;
        }
        if (key === 'ArrowRight' && ctrl) {
            this._cursor = this._nextWordBoundary();
            this._anchor = this._cursor;
            this._cursorT = 0;
            this._scrollToCursor();
            return;
        }

        // Home key (ArrowUp without ctrl)
        if (key === 'ArrowUp' && !ctrl) {
            this._cursor = 0;
            this._anchor = this._cursor;
            this._cursorT = 0;
            this._scrollToCursor();
            return;
        }

        // End key (ArrowDown without ctrl)
        if (key === 'ArrowDown' && !ctrl) {
            this._cursor = this.value.length;
            this._anchor = this._cursor;
            this._cursorT = 0;
            this._scrollToCursor();
            return;
        }

        // Left/Right: Move cursor (arrow keys, not DirLeft/Right)
        if (key === 'ArrowLeft') {
            if (this._hasSelection) {
                this._cursor = this._selectionStart;
                this._anchor = this._cursor;
            } else {
                this._cursor = Math.max(0, this._cursor - 1);
                this._anchor = this._cursor;
            }
            this._cursorT = 0;
            this._scrollToCursor();
            return;
        }
        if (key === 'ArrowRight') {
            if (this._hasSelection) {
                this._cursor = this._selectionEnd;
                this._anchor = this._cursor;
            } else {
                this._cursor = Math.min(this.value.length, this._cursor + 1);
                this._anchor = this._cursor;
            }
            this._cursorT = 0;
            this._scrollToCursor();
            return;
        }

        // Backspace
        if (key === 'Backspace') {
            if (this._hasSelection) {
                this._deleteSelection();
            } else if (this._cursor > 0) {
                this.value = this.value.slice(0, this._cursor-1) + this.value.slice(this._cursor);
                this._cursor--;
                this._anchor = this._cursor;
                this.onChange && this.onChange(this.value, this);
            }
            this._scrollToCursor();
            return;
        }

        // Delete
        if (key === 'Delete') {
            if (this._hasSelection) {
                this._deleteSelection();
            } else if (this._cursor < this.value.length) {
                this.value = this.value.slice(0, this._cursor) + this.value.slice(this._cursor+1);
                this.onChange && this.onChange(this.value, this);
            }
            this._scrollToCursor();
            return;
        }

        // Enter: Submit
        if (key === 'Action1') {
            this.onSubmit && this.onSubmit(this.value, this);
        }
    }

    _deleteSelection() {
        if (!this._hasSelection) return;
        const start = this._selectionStart;
        const end = this._selectionEnd;
        this.value = this.value.slice(0, start) + this.value.slice(end);
        this._cursor = start;
        this._anchor = start;
        this.onChange && this.onChange(this.value, this);
    }

    _prevWordBoundary() {
        const v = this.value;
        let pos = this._cursor - 1;
        // Skip whitespace backwards
        while (pos >= 0 && /\s/.test(v[pos])) pos--;
        // Skip word chars backwards
        while (pos >= 0 && !/\s/.test(v[pos])) pos--;
        return pos + 1;
    }

    _nextWordBoundary() {
        const v = this.value;
        let pos = this._cursor;
        // Skip whitespace forwards
        while (pos < v.length && /\s/.test(v[pos])) pos++;
        // Skip word chars forwards
        while (pos < v.length && !/\s/.test(v[pos])) pos++;
        return pos;
    }

    _scrollToCursor() {
        const t    = this.theme;
        const padX = t.spacingMd;
        const innerW = this.width - padX * 2;
        const font = t.font(t.fontSizeMd);
        
        const curX = this._getCursorX(this._cursor, font) - this._scrollX;
        
        if (curX < 0) this._scrollX = Math.max(0, this._scrollX + curX - 10);
        if (curX > innerW) this._scrollX += (curX - innerW) + 10;
    }

    draw(ctx) {
        if (!this.visible) return;
        const t    = this.theme;
        const padX = t.spacingMd;
        const r    = t.radiusMd;

        ctx.save();
        this._applyOpacity(ctx);

        // Label
        if (this.label) {
            ActionUIDrawUtils.text(ctx, this.label,
                this.x, this.y - 2,
                t.font(t.fontSizeSm, t.fontWeightMedium), t.colorTextMuted,
                'left', 'bottom'
            );
        }

        // Background
        ActionUIDrawUtils.fillRoundRect(ctx, this.x, this.y, this.width, this.height, r, t.colorSurface);

        // Focus border glow - use active color when OSK is open for this input
        const isOSKTarget = this._ui && this._ui._osk && this._ui._osk._showing && this._ui._osk.target === this;
        const focusColor = isOSKTarget ? t.colorKbFocusActive : t.colorBorderFocus;
        if (this._focusT > 0.01) {
            ActionUIDrawUtils.shadow(ctx, t.withAlpha(focusColor, this._focusT * 0.6), 8, 0, 0);
            ActionUIDrawUtils.strokeRoundRect(ctx, this.x, this.y, this.width, this.height, r,
                t.withAlpha(focusColor, this._focusT), 1.5
            );
            ActionUIDrawUtils.clearShadow(ctx);
        } else {
            ActionUIDrawUtils.strokeRoundRect(ctx, this.x, this.y, this.width, this.height, r, focusColor, 1.5);
        }

        // Clip inner
        ctx.save();
        ActionUIDrawUtils.roundRect(ctx, this.x + 1, this.y + 1, this.width - 2, this.height - 2, r - 1);
        ctx.clip();

        const disp = this.password ? this.value.replace(/./g,'•') : this.value;
        const tx0  = this.x + padX;
        const ty   = this.y + this.height / 2;
        const font = t.font(t.fontSizeMd);

        ctx.font         = font;
        ctx.textBaseline = 'middle';
        ctx.textAlign    = 'left';

        // Draw selection highlight
        if (this._focused && this._hasSelection) {
            const startX = this._getCursorX(this._selectionStart, font);
            const endX   = this._getCursorX(this._selectionEnd, font);
            ctx.fillStyle = t.withAlpha(t.colorBorderFocus, 0.3);
            ctx.fillRect(tx0 + startX - this._scrollX, this.y + 2, endX - startX, this.height - 4);
        }

        // Placeholder
        if (!disp) {
            ctx.fillStyle = t.colorTextMuted;
            ctx.fillText(this.placeholder, tx0, ty);
        } else {
            ctx.fillStyle = this.enabled ? t.colorText : t.colorDisabledText;
            ctx.fillText(disp, tx0 - this._scrollX, ty);
        }

        // Cursor (only when no selection)
        if (this._focused && !this._hasSelection && this._cursorT < 0.6) {
            const cw     = this._getCursorX(this._cursor, font);
            const cx     = tx0 + cw - this._scrollX;
            ActionUIDrawUtils.line(ctx, cx, this.y + 5, cx, this.y + this.height - 5, t.colorBorderFocus, 1.5);
        }

        ctx.restore();

        this._restoreOpacity(ctx);
        ctx.restore();
    }
}
