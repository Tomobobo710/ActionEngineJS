/******************************************************************************
 * ActionUIColorSwatch — static color tile with label
 ******************************************************************************/

class ActionUIColorSwatch extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.isInteractive = props.isInteractive ?? true;
        this.color   = props.color   || '#e94560';
        this.label   = props.label   || '';
        this.size    = props.size    || 40;
        this.width   = this.size;
        this.height  = this.size;
        this._hoverT = 0;
    }

    _onUpdate(dt) {
        const target = this._hovered ? 1 : 0;
        this._hoverT = ActionUIDrawUtils.lerp(this._hoverT, target, dt / this.theme.animDurationNormal);
    }

    onPointerUp(px, py) {
        if (this.containsPoint(px, py)) {
            this.onClick && this.onClick(this.color, this);
        }
    }

    draw(ctx) {
        if (!this.visible) return;
        const t = this.theme;
        const r = t.radiusSm;
        const scale = 1 + this._hoverT * 0.08;
        const cx = this.x + this.size / 2;
        const cy = this.y + this.size / 2;

        ctx.save();
        this._applyOpacity(ctx);
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);

        ActionUIDrawUtils.shadow(ctx, t.withAlpha(this.color, 0.5), 8 + this._hoverT * 8, 0, 2);
        ActionUIDrawUtils.fillRoundRect(ctx, this.x, this.y, this.size, this.size, r, this.color);
        ActionUIDrawUtils.clearShadow(ctx);
        ActionUIDrawUtils.strokeRoundRect(ctx, this.x, this.y, this.size, this.size, r,
            this._hoverT > 0.5 ? '#fff' : t.colorBorder,
            this._hoverT > 0.5 ? 2 : 1
        );

        if (this.label) {
            ActionUIDrawUtils.text(ctx, this.label,
                this.x + this.size / 2, this.y + this.size + 6,
                t.font(t.fontSizeXs), t.colorTextMuted, 'center', 'top'
            );
        }

        this._restoreOpacity(ctx);
        ctx.restore();
    }
}
