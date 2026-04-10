/******************************************************************************
 * ActionUIAvatarDisplay — circular icon with initials fallback
 ******************************************************************************/

class ActionUIAvatarDisplay extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.isInteractive = props.isInteractive ?? true;
        this.name       = props.name    || '?';
        this.color      = props.color   || null;
        this.size       = props.size    || 40;
        this.status     = props.status  || null;  // 'online'|'offline'|'away'|null
        this.width      = this.size;
        this.height     = this.size;
        this._hoverT    = 0;
    }

    _initials() {
        return this.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
    }

    _autoColor() {
        // Deterministic color from name
        let hash = 0;
        for (let c of this.name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffff;
        return `hsl(${hash % 360},55%,45%)`;
    }

    _onUpdate(dt) {
        const target = this._hovered ? 1 : 0;
        this._hoverT = ActionUIDrawUtils.lerp(this._hoverT, target, dt / this.theme.animDurationNormal);
    }

    onPointerUp(px, py) {
        if (this.containsPoint(px, py)) this.onClick && this.onClick(this);
    }

    draw(ctx) {
        if (!this.visible) return;
        const t   = this.theme;
        const cx  = this.x + this.size / 2;
        const cy  = this.y + this.size / 2;
        const r   = this.size / 2;
        const col = this.color || this._autoColor();
        const scale = 1 + this._hoverT * 0.07;

        ctx.save();
        this._applyOpacity(ctx);
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);

        ActionUIDrawUtils.shadow(ctx, t.withAlpha(col, 0.5), 10 + this._hoverT * 6, 0, 2);
        ActionUIDrawUtils.circle(ctx, cx, cy, r, col);
        ActionUIDrawUtils.clearShadow(ctx);

        // Ring
        ActionUIDrawUtils.circle(ctx, cx, cy, r, null,
            this._hoverT > 0.5 ? '#fff' : t.withAlpha('#fff', 0.2),
            this._hoverT > 0.5 ? 2 : 1
        );

        // Initials
        ActionUIDrawUtils.text(ctx, this._initials(), cx, cy,
            t.font(Math.floor(this.size * 0.34), t.fontWeightBold), '#fff', 'center', 'middle'
        );

        // Status dot
        if (this.status) {
            const statusColors = { online: t.colorSuccess, offline: t.colorTextMuted, away: t.colorWarning };
            const sc  = statusColors[this.status] || t.colorTextMuted;
            const dr  = r * 0.3;
            const dx  = cx + r * 0.7;
            const dy  = cy + r * 0.7;
            ActionUIDrawUtils.circle(ctx, dx, dy, dr, sc);
            ActionUIDrawUtils.circle(ctx, dx, dy, dr, null, t.colorSurface, 2);
        }

        this._restoreOpacity(ctx);
        ctx.restore();
    }
}
