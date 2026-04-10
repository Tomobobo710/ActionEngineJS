/******************************************************************************
 * ActionUIToggleSwitch — iOS-style on/off
 ******************************************************************************/

class ActionUIToggleSwitch extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.isInteractive = props.isInteractive ?? true;
        this.checked       = props.checked       ?? false;
        this.label         = props.label         || '';
        this.color         = props.color         || 'primary';
        this.height        = props.height        || null;
        this.width         = props.width         || null;
        this.clickableLabel = props.clickableLabel ?? false;
        this._slideT       = this.checked ? 1 : 0;
        this._hoverT       = 0;
        this._labelW       = 0;
    }

    _measureLabel(ctx) {
        if (!this.label || !ctx) return 0;
        ctx.font = this.theme.font(this.theme.fontSizeMd);
        return ctx.measureText(this.label).width;
    }

    _totalWidth() {
        const tw = this.width || this.theme.toggleWidth;
        if (this.clickableLabel && this.label) {
            return tw + this.theme.spacingSm + this._labelW;
        }
        return tw;
    }

    containsPoint(px, py) {
        const totalW = this._totalWidth();
        return px >= this.x && px <= this.x + totalW &&
               py >= this.y && py <= this.y + (this.height || this.theme.toggleHeight);
    }

    getBounds() {
        const tw = this.width || this.theme.toggleWidth;
        const th = this.height || this.theme.toggleHeight;
        return { x: this.x, y: this.y, width: tw, height: th };
    }

    _onUpdate(dt) {
        const target = this.checked ? 1 : 0;
        this._slideT = ActionUIDrawUtils.lerp(this._slideT, target, dt / this.theme.animDurationNormal);
        const hoverTarget = this._hovered ? 1 : 0;
        this._hoverT = ActionUIDrawUtils.lerp(this._hoverT, hoverTarget, dt / this.theme.animDurationNormal);
    }

    onPointerDown(px, py) {
        if (!this.enabled || !this.containsPoint(px, py)) return;
        this._pressed = true;
    }

    onPointerUp(px, py) {
        if (!this.enabled || !this.containsPoint(px, py)) return;
        this.checked = !this.checked;
        this._pressed = false;
        this.onChange && this.onChange(this.checked, this);
        this.onClick  && this.onClick(this);
    }

    draw(ctx) {
        if (!this.visible) return;
        const t  = this.theme;
        const tw = this.width  || t.toggleWidth;
        const th = this.height || t.toggleHeight;
        const tx = this.x;
        const ty = this.y;
        const r  = th / 2;
        const col = t.resolveColor(this.color);

        ctx.save();
        this._applyOpacity(ctx);

        // Track
        const trackCol = this._slideT > 0.5 ? col : t.colorScrollTrack;
        ActionUIDrawUtils.fillRoundRect(ctx, tx, ty, tw, th, r, trackCol);

        // Hover overlay
        if (this._hoverT > 0.01) {
            ActionUIDrawUtils.fillRoundRect(ctx, tx, ty, tw, th, r,
                `rgba(255,255,255,${this._hoverT * 0.1})`
            );
        }

        ActionUIDrawUtils.strokeRoundRect(ctx, tx, ty, tw, th, r,
            this._slideT > 0.5 ? col : t.colorBorder, 1.5
        );

        // Thumb
        const thumbPad = 3;
        const thumbR   = (th - thumbPad * 2) / 2;
        const thumbX   = tx + thumbPad + thumbR + this._slideT * (tw - (thumbPad + thumbR) * 2);
        const thumbY   = ty + th / 2;

        ActionUIDrawUtils.shadow(ctx, t.colorShadow, 6, 0, 2);
        ActionUIDrawUtils.circle(ctx, thumbX, thumbY, thumbR, '#fff');
        ActionUIDrawUtils.clearShadow(ctx);

        // Label
        if (this.label) {
            const lx = tx + tw + t.spacingSm;
            this._labelW = ActionUIDrawUtils.textMeasure(ctx, this.label, t.font(t.fontSizeMd)).width;
            ActionUIDrawUtils.text(ctx, this.label,
                lx, ty + th / 2,
                t.font(t.fontSizeMd), t.colorText, 'left', 'middle'
            );
        }

        this._restoreOpacity(ctx);
        ctx.restore();
    }

    _hexToRgbComponents(hex) {
        const h = hex.replace('#','');
        const f = h.length===3 ? h.split('').map(c=>c+c).join('') : h;
        return `${parseInt(f.slice(0,2),16)},${parseInt(f.slice(2,4),16)},${parseInt(f.slice(4,6),16)}`;
    }
}
