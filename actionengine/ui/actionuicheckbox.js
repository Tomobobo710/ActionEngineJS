/******************************************************************************
 * ActionUICheckbox — boolean toggle
 ******************************************************************************/

class ActionUICheckbox extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.isInteractive = props.isInteractive ?? true;
        this.checked    = props.checked   ?? false;
        this.label      = props.label     || '';
        this.boxSize    = props.boxSize   || null;
        this._checkT    = this.checked ? 1 : 0;
        this._hoverT    = 0;
        this.height     = props.height    || 24;
        this.width      = props.width     || 200;
    }

    _onUpdate(dt) {
        const target = this.checked ? 1 : 0;
        this._checkT = ActionUIDrawUtils.lerp(this._checkT, target, dt / this.theme.animDurationNormal);
        // Time-based hover: instant on, linear decay over animDurationFast
        if (this._hovered) {
            this._hoverT = 1;
        } else {
            this._hoverT = Math.max(0, this._hoverT - dt / this.theme.animDurationFast);
        }
    }

    onPointerUp(px, py) {
        if (!this.enabled || !this.containsPoint(px, py)) return;
        this.checked = !this.checked;
        this.onChange && this.onChange(this.checked, this);
        this.onClick  && this.onClick(this);
    }

    draw(ctx) {
        if (!this.visible) return;
        const t   = this.theme;
        const sz  = this.boxSize || t.checkboxSize;
        const bx  = this.x;
        const by  = this.y + (this.height - sz) / 2;

        ctx.save();
        this._applyOpacity(ctx);

        // Box fill
        const fillA = this._checkT;
        const boxFill = this.enabled
            ? `rgba(${this._hexToRgb(t.colorPrimary)},${fillA})`
            : t.colorDisabled;
        ActionUIDrawUtils.fillRoundRect(ctx, bx, by, sz, sz, t.radiusSm,
            this._checkT > 0.01 ? boxFill : t.withAlpha(t.colorSurface, 1)
        );

        // Hover overlay
        if (this._hoverT > 0.01) {
            ActionUIDrawUtils.fillRoundRect(ctx, bx, by, sz, sz, t.radiusSm,
                `rgba(255,255,255,${this._hoverT * 0.12})`
            );
        }

        // Border
        const borderCol = this._hoverT > 0.01 ? t.colorBorderFocus : (this.checked ? t.colorPrimary : t.colorBorder);
        ActionUIDrawUtils.strokeRoundRect(ctx, bx, by, sz, sz, t.radiusSm, borderCol, 1.5);

        // Checkmark
        if (this._checkT > 0.05) {
            ctx.save();
            ctx.globalAlpha = this._checkT;
            ActionUIDrawUtils.checkmark(ctx, bx, by, sz, '#fff', 2);
            ctx.restore();
        }

        // Label
        if (this.label) {
            const lx = bx + sz + t.spacingSm;
            const ly = this.y + this.height / 2;
            const col = this.enabled ? t.colorText : t.colorDisabledText;
            ActionUIDrawUtils.text(ctx, this.label, lx, ly, t.font(t.fontSizeMd), col, 'left', 'middle');
        }

        this._restoreOpacity(ctx);
        ctx.restore();
    }

    _hexToRgb(hex) {
        const h = hex.replace('#','');
        const f = h.length===3 ? h.split('').map(c=>c+c).join('') : h;
        return `${parseInt(f.slice(0,2),16)},${parseInt(f.slice(2,4),16)},${parseInt(f.slice(4,6),16)}`;
    }
}
