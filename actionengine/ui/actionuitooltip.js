/******************************************************************************
 * ActionUITooltip — hover-triggered floating hint
 ******************************************************************************/

class ActionUITooltip extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.text    = props.text    || '';
        this._showT  = 0;
        this._delay  = props.delay   ?? 0.5;
        this._timer  = 0;
        this._active = false;
        this._tx     = 0;
        this._ty     = 0;
    }

    showAt(x, y) {
        this._tx     = x;
        this._ty     = y;
        this._active = true;
        this.visible = true;
    }

    hideTooltip() {
        this._active = false;
        this._timer  = 0;
        this.visible = false;
    }

    _onUpdate(dt) {
        if (this._active) {
            this._timer += dt;
        } else {
            this._timer = 0;
        }
        const target = (this._active && this._timer >= this._delay) ? 1 : 0;
        this._showT  = ActionUIDrawUtils.lerp(this._showT, target, dt / this.theme.animDurationFast);
    }

    draw(ctx) {
        if (!this.visible || this._showT < 0.02) return;
        const t     = this.theme;
        const padX  = t.spacingMd;
        const padY  = t.spacingSm;
        const font  = t.font(t.fontSizeSm);
        const tw    = Math.min(ActionUIDrawUtils.textMeasure(ctx, this.text, font).width + padX * 2, t.tooltipMaxWidth);
        const th    = t.fontSizeSm * 1.4 + padY * 2;
        const tx    = Math.max(4, Math.min(800 - tw - 4, this._tx - tw / 2));
        const ty    = this._ty - th - 8;
        const r     = t.radiusSm;

        ctx.save();
        ctx.globalAlpha = ActionUIDrawUtils.easeOut(this._showT);

        ActionUIDrawUtils.shadow(ctx, t.colorShadow, 12, 0, 3);
        ActionUIDrawUtils.fillRoundRect(ctx, tx, ty, tw, th, r, t.colorSurfaceRaised);
        ActionUIDrawUtils.clearShadow(ctx);
        ActionUIDrawUtils.strokeRoundRect(ctx, tx, ty, tw, th, r, t.colorBorder, 1);

        // Arrow
        ctx.fillStyle = t.colorSurfaceRaised;
        ctx.beginPath();
        ctx.moveTo(this._tx - 5, ty + th);
        ctx.lineTo(this._tx + 5, ty + th);
        ctx.lineTo(this._tx, ty + th + 6);
        ctx.closePath();
        ctx.fill();

        ActionUIDrawUtils.text(ctx, this.text,
            tx + padX, ty + th / 2, font, t.colorText, 'left', 'middle'
        );

        ctx.restore();
    }
}
