/******************************************************************************
 * ActionUIBadge — numeric dot indicator
 ******************************************************************************/

class ActionUIBadge extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.count   = props.count   ?? 0;
        this.color   = props.color   || 'danger';
        this.maxCount = props.maxCount ?? 99;
        this.size    = props.size    || 20;
        this.width   = this.size;
        this.height  = this.size;
        this._scaleT = 0;
        this._prevCount = this.count;
    }

    _onUpdate(dt) {
        if (this.count !== this._prevCount) { this._scaleT = 1; this._prevCount = this.count; }
        this._scaleT = Math.max(0, this._scaleT - dt / 0.25);
    }

    draw(ctx) {
        if (!this.visible || this.count <= 0) return;
        const t   = this.theme;
        const col = t.resolveColor(this.color);
        const r   = this.size / 2;
        const cx  = this.x + r;
        const cy  = this.y + r;
        const pop = 1 + this._scaleT * 0.3;

        ctx.save();
        this._applyOpacity(ctx);
        ctx.translate(cx, cy);
        ctx.scale(pop, pop);
        ctx.translate(-cx, -cy);

        ActionUIDrawUtils.shadow(ctx, t.colorShadow, 6, 0, 2);
        ActionUIDrawUtils.circle(ctx, cx, cy, r, col);
        ActionUIDrawUtils.clearShadow(ctx);

        const label = this.count > this.maxCount ? `${this.maxCount}+` : String(this.count);
        ActionUIDrawUtils.text(ctx, label, cx, cy,
            t.font(t.fontSizeXs, t.fontWeightBold), '#fff', 'center', 'middle'
        );

        this._restoreOpacity(ctx);
        ctx.restore();
    }
}
