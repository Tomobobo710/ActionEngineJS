/******************************************************************************
 * ActionUINotification — transient toast
 ******************************************************************************/

class ActionUINotification extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.message    = props.message     || '';
        this.type       = props.type        || 'info';  // info|success|warning|danger
        this.duration   = props.duration    || null;    // null = use theme default
        this._life      = 0;
        this._maxLife   = this.duration ?? this.theme.notificationDuration;
        this._showT     = 0;
        this.width      = props.width       || null;
        this.height     = 52;
        this.zIndex     = 90;
        this._visible2  = true;
    }

    _onUpdate(dt) {
        if (!this._visible2) return;
        this._life += dt;
        const ratio = this._life / this._maxLife;
        const target = ratio < 0.85 ? 1 : 0;
        this._showT = ActionUIDrawUtils.lerp(this._showT, target, dt / this.theme.animDurationFast);
        if (ratio >= 1) { this._visible2 = false; this.visible = false; }
    }

    draw(ctx) {
        if (!this.visible || !this._visible2 || this._showT < 0.02) return;
        const t    = this.theme;
        const w    = this.width || t.notificationWidth;
        const h    = this.height;
        const r    = t.radiusMd;
        const a    = ActionUIDrawUtils.easeOut(this._showT);
        const offY = (1 - a) * 20;

        const typeColors = {
            info:    t.colorInfo,
            success: t.colorSuccess,
            warning: t.colorWarning,
            danger:  t.colorDanger,
        };
        const typeIcons = {
            info: 'info', success: 'check', warning: 'warning', danger: 'close'
        };
        const col = typeColors[this.type] || t.colorInfo;

        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(0, offY);

        ActionUIDrawUtils.shadow(ctx, t.colorShadow, 18, 0, 4);
        ActionUIDrawUtils.fillRoundRect(ctx, this.x, this.y, w, h, r, t.colorSurfaceOverlay);
        ActionUIDrawUtils.clearShadow(ctx);

        // Left accent bar
        ActionUIDrawUtils.fillRoundRect(ctx, this.x, this.y, 4, h, r, col);

        // Icon
        ActionUIIconRenderer.draw(ctx, typeIcons[this.type] || 'info',
            this.x + 14, this.y + (h - 18) / 2, 18, col
        );

        // Message
        ActionUIDrawUtils.text(ctx, this.message,
            this.x + 42, this.y + h / 2,
            t.font(t.fontSizeSm, t.fontWeightMedium), t.colorText, 'left', 'middle'
        );

        // Progress bar
        const prog = 1 - (this._life / this._maxLife);
        ActionUIDrawUtils.fillRoundRect(ctx, this.x + 4, this.y + h - 3, (w - 4) * prog, 3, 1,
            t.withAlpha(col, 0.6)
        );

        ActionUIDrawUtils.strokeRoundRect(ctx, this.x, this.y, w, h, r, t.withAlpha(col, 0.3), 1);

        ctx.restore();
    }
}
