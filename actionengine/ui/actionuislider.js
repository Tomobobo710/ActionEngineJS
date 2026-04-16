/******************************************************************************
 * ActionUISlider — continuous value scrubber
 ******************************************************************************/

class ActionUISlider extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.isInteractive = props.isInteractive ?? true;
        this.min        = props.min    ?? 0;
        this.max        = props.max    ?? 100;
        this.value      = props.value  ?? 50;
        this.step       = props.step   ?? 0;
        this.label      = props.label  || '';
        this.showValue  = props.showValue ?? true;
        this.color      = props.color  || null;
        this.height     = props.height || 36;
        this._dragging  = false;
        this._hoverT    = 0;
        this._kbActive  = false;
    }

    _onUpdate(dt) {
        const target = (this._hovered || this._dragging) ? 1 : 0;
        this._hoverT = ActionUIDrawUtils.lerp(this._hoverT, target, dt / this.theme.animDurationNormal);
    }

    onPointerDown(px, py) {
        if (!this.enabled) return;
        if (this.containsPoint(px, py)) {
            this._dragging = true;
            this._updateFromPointer(px);
        }
    }

    onPointerUp(px, py) {
        this._dragging = false;
    }

    onPointerMove(px, py) {
        if (this._dragging) this._updateFromPointer(px);
    }

    onKeyDown(key) {
        if (!this.enabled) return;
        if (key === 'DirLeft' || key === 'DirDown') {
            this.value = Math.max(this.min, this.value - (this.step || (this.max - this.min) / 20));
            this.onChange && this.onChange(this.value, this);
        } else if (key === 'DirRight' || key === 'DirUp') {
            this.value = Math.min(this.max, this.value + (this.step || (this.max - this.min) / 20));
            this.onChange && this.onChange(this.value, this);
        }
    }

    _updateFromPointer(px) {
         const t   = this.theme;
         const th  = t.sliderThumbSize;
         
         // Match layout from draw()
         const hasLabel = !!this.label;
         const labelH = hasLabel ? 18 : 0;
         const sliderY = this.y + (hasLabel ? labelH + 4 : 0);
         const sliderH = this.height - labelH - (hasLabel ? 4 : 0);
         
         // Value label width
         const disp = Number.isInteger(this.value) ? this.value : this.value.toFixed(1);
         const dispStr = String(disp);
         const valueW = dispStr.length * 7 + 4;
         const valuePad = 12;
         
         const tx0 = this.x + th / 2;
         const tx1 = this.x + this.width - valueW - valuePad;
         const pct = Math.max(0, Math.min(1, (px - tx0) / (tx1 - tx0)));
         let val   = this.min + pct * (this.max - this.min);
         if (this.step > 0) val = Math.round(val / this.step) * this.step;
         val = Math.max(this.min, Math.min(this.max, val));
         if (val !== this.value) {
             this.value = val;
             this.onChange && this.onChange(this.value, this);
         }
     }

    draw(ctx) {
         if (!this.visible) return;
         const t      = this.theme;
         const th     = t.sliderThumbSize;
         const trH    = t.sliderTrackHeight;
         
         // Layout: if label exists, use two-line layout for pixel-perfect spacing
         const hasLabel = !!this.label;
         const labelH = hasLabel ? 18 : 0;     // label line height
         const sliderY = this.y + (hasLabel ? labelH + 4 : 0); // 4px gap after label
         const sliderH = this.height - labelH - (hasLabel ? 4 : 0);
         const midY   = sliderY + sliderH / 2;
         
         // Value label width (measured approximation)
         const disp = Number.isInteger(this.value) ? this.value : this.value.toFixed(1);
         const dispStr = String(disp);
         const valueW = dispStr.length * 7 + 4; // rough measurement: ~7px per digit + padding
         
         // Track bounds with space reserved for value label
         const valuePad = 12; // padding between track and value label
         const tx0    = this.x + th / 2;
         const tx1    = this.x + this.width - valueW - valuePad;
         const pct    = (this.value - this.min) / (this.max - this.min);
         const fillX  = tx0 + pct * (tx1 - tx0);
         const col    = this.color ? t.resolveColor(this.color) : t.colorPrimary;
         const thumbR = (th / 2) * (1 + this._hoverT * 0.15);

         ctx.save();
         this._applyOpacity(ctx);

         // Title label (top line)
         if (this.label) {
             ActionUIDrawUtils.text(ctx, this.label,
                 this.x, this.y + 2,
                 t.font(t.fontSizeSm, t.fontWeightMedium),
                 t.colorTextMuted, 'left', 'top'
             );
         }

         // Track background
         ActionUIDrawUtils.fillRoundRect(ctx, tx0, midY - trH/2, tx1 - tx0, trH, trH/2, t.colorScrollTrack);

         // Track fill
         if (pct > 0) {
             const fillGrad = ctx.createLinearGradient(tx0, midY, fillX, midY);
             fillGrad.addColorStop(0, t.withAlpha(col, 0.7));
             fillGrad.addColorStop(1, col);
             ActionUIDrawUtils.fillRoundRect(ctx, tx0, midY - trH/2, fillX - tx0, trH, trH/2, fillGrad);
         }

         // Tick marks (if step)
         if (this.step > 0) {
             const steps = Math.floor((this.max - this.min) / this.step);
             for (let i = 1; i < steps; i++) {
                 const tx = tx0 + (i / steps) * (tx1 - tx0);
                 ActionUIDrawUtils.line(ctx, tx, midY - trH, tx, midY + trH, t.withAlpha(t.colorBorder, 0.5), 1);
             }
         }

         // Thumb
         ActionUIDrawUtils.shadow(ctx, t.withAlpha(col, 0.5), 8 + this._hoverT * 6, 0, 1);
         ActionUIDrawUtils.circle(ctx, fillX, midY, thumbR, col, t.colorSurface, 2);
         ActionUIDrawUtils.clearShadow(ctx);

         // Value label (right side, reserved space)
         if (this.showValue) {
             ActionUIDrawUtils.text(ctx, dispStr,
                 this.x + this.width, midY,
                 t.font(t.fontSizeSm, t.fontWeightMedium),
                 t.colorTextMuted, 'right', 'middle'
             );
         }

         this._restoreOpacity(ctx);
         ctx.restore();
     }
}
