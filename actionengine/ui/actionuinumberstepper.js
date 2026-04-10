/******************************************************************************
 * ActionUINumberStepper — integer value with +/- buttons
 ******************************************************************************/

class ActionUINumberStepper extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.isInteractive = props.isInteractive ?? true;
        this.value   = props.value   ?? 0;
        this.min     = props.min     ?? 0;
        this.max     = props.max     ?? 100;
        this.step    = props.step    ?? 1;
        this.label   = props.label   || '';
        this.height  = props.height  || 36;
        this.width   = props.width   || 140;
        this._btnW   = 36;
        this._kbActive = false;
        this._hoverBtn = null;  // 'dec' | 'inc' | null
        this._ripples  = [];    // ripple effects for mouse clicks
        this._kbPressBtn = null; // 'dec' | 'inc' | null (for keyboard press animation)
        this._kbPressT   = 0;   // keyboard press animation timer
    }

    _decBounds() { return { x: this.x, y: this.y, w: this._btnW, h: this.height }; }
    _incBounds() { return { x: this.x + this.width - this._btnW, y: this.y, w: this._btnW, h: this.height }; }

    onPointerDown(px, py) {
        if (!this.enabled) return;
        const dec = this._decBounds();
        const inc = this._incBounds();
        if (px >= dec.x && px <= dec.x+dec.w && py >= dec.y && py <= dec.y+dec.h) {
            // Add ripple at click position (relative to button)
            this._ripples.push({ btn: 'dec', x: px - dec.x, y: py - dec.y, t: 0 });
        }
        if (px >= inc.x && px <= inc.x+inc.w && py >= inc.y && py <= inc.y+inc.h) {
            this._ripples.push({ btn: 'inc', x: px - inc.x, y: py - inc.y, t: 0 });
        }
    }

    onPointerUp(px, py) {
        if (!this.enabled) return;
        const dec = this._decBounds();
        const inc = this._incBounds();
        if (px >= dec.x && px <= dec.x+dec.w && py >= dec.y && py <= dec.y+dec.h) {
            this.value = Math.max(this.min, this.value - this.step);
            this.onChange && this.onChange(this.value, this);
        }
        if (px >= inc.x && px <= inc.x+inc.w && py >= inc.y && py <= inc.y+inc.h) {
            this.value = Math.min(this.max, this.value + this.step);
            this.onChange && this.onChange(this.value, this);
        }
    }

    onPointerMove(px, py) {
        if (!this.enabled) {
            this._hoverBtn = null;
            return;
        }
        const dec = this._decBounds();
        const inc = this._incBounds();
        if (px >= dec.x && px <= dec.x+dec.w && py >= dec.y && py <= dec.y+dec.h) {
            this._hoverBtn = 'dec';
        } else if (px >= inc.x && px <= inc.x+inc.w && py >= inc.y && py <= inc.y+inc.h) {
            this._hoverBtn = 'inc';
        } else {
            this._hoverBtn = null;
        }
    }

    _onUpdate(dt) {
        // Keyboard press animation fade out
        if (this._kbPressT > 0) {
            this._kbPressT = Math.max(0, this._kbPressT - dt / 0.12);
            if (this._kbPressT <= 0) this._kbPressBtn = null;
        }
        // Ripple animations
        this._ripples = this._ripples.filter(r => r.t < 1);
        this._ripples.forEach(r => { r.t += dt / 0.45; r.t = Math.min(1, r.t); });
    }

    onKeyDown(key) {
        if (!this.enabled || !this._kbActive) return;
        if (key === 'DirLeft') {
            this._kbPressBtn = 'dec';
            this._kbPressT = 1;
            this.value = Math.max(this.min, this.value - this.step);
            this.onChange && this.onChange(this.value, this);
        } else if (key === 'DirRight') {
            this._kbPressBtn = 'inc';
            this._kbPressT = 1;
            this.value = Math.min(this.max, this.value + this.step);
            this.onChange && this.onChange(this.value, this);
        }
    }

    draw(ctx) {
        if (!this.visible) return;
        const t  = this.theme;
        const bw = this._btnW;
        const r  = t.radiusMd;

        ctx.save();
        this._applyOpacity(ctx);

        if (this.label) {
            ActionUIDrawUtils.text(ctx, this.label,
                this.x, this.y - 2,
                t.font(t.fontSizeSm), t.colorTextMuted, 'left', 'bottom'
            );
        }

        // Track background
        ActionUIDrawUtils.fillRoundRect(ctx, this.x, this.y, this.width, this.height, r, t.colorSurface);
        ActionUIDrawUtils.strokeRoundRect(ctx, this.x, this.y, this.width, this.height, r, t.colorBorder, 1);

        // Dec button
        this._drawStepperBtn(ctx, this.x, this.y, bw, this.height, r, 'minus', 'dec', this.value > this.min);

        // Inc button
        this._drawStepperBtn(ctx, this.x + this.width - bw, this.y, bw, this.height, r, 'plus', 'inc', this.value < this.max);

        // Value
        ActionUIDrawUtils.text(ctx, String(this.value),
            this.x + this.width / 2, this.y + this.height / 2,
            t.font(t.fontSizeMd, t.fontWeightMedium), t.colorText, 'center', 'middle'
        );

        this._restoreOpacity(ctx);
        ctx.restore();
    }

    /**
     * Draw a single stepper button with hover, ripple, and keyboard press states
     */
    _drawStepperBtn(ctx, bx, by, bw, bh, r, icon, btnId, isActive) {
        const t = this.theme;
        const isHovered = this._hoverBtn === btnId;
        const isKbPressed = this._kbPressBtn === btnId && this._kbPressT > 0;

        // Button background
        let bgColor = t.colorSurfaceRaised;
        if (isKbPressed) {
            bgColor = t.colorPrimaryActive;
        } else if (isHovered) {
            bgColor = t.withAlpha(t.colorPrimaryHover, 0.25);
        }

        // Scale down when keyboard pressed
        if (isKbPressed) {
            const scale = 0.92;
            const cx = bx + bw / 2;
            const cy = by + bh / 2;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(scale, scale);
            ctx.translate(-cx, -cy);
        }

        ActionUIDrawUtils.fillRoundRect(ctx, bx, by, bw, bh, r, bgColor);

        // Draw ripples for this button
        this._drawRipples(ctx, bx, by, bw, bh, r, btnId);

        // Icon color
        const iconColor = isActive ? (isKbPressed ? t.colorPrimaryText : t.colorText) : t.colorDisabledText;
        ActionUIIconRenderer.draw(ctx, icon, bx + (bw - 16) / 2, by + (bh - 16) / 2, 16, iconColor);

        if (isKbPressed) {
            ctx.restore();
        }
    }

    /**
     * Draw ripple effects for a button
     */
    _drawRipples(ctx, bx, by, bw, bh, r, btnId) {
        const btnRipples = this._ripples.filter(rip => rip.btn === btnId);
        if (!btnRipples.length) return;

        ctx.save();
        ActionUIDrawUtils.roundRect(ctx, bx, by, bw, bh, r);
        ctx.clip();

        for (const rip of btnRipples) {
            const maxR = Math.sqrt(bw * bw + bh * bh);
            const alpha = (1 - ActionUIDrawUtils.easeOut(rip.t)) * 0.22;
            ActionUIDrawUtils.circle(ctx,
                bx + rip.x, by + rip.y,
                maxR * ActionUIDrawUtils.easeOut(rip.t),
                `rgba(255,255,255,${alpha})`
            );
        }
        ctx.restore();
    }
}
