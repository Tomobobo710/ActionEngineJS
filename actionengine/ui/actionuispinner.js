/******************************************************************************
 * ActionUISpinner — animated loading indicator
 ******************************************************************************/

class ActionUISpinner extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.color   = props.color   || 'primary';
        this.size    = props.size    || 32;
        this.speed   = props.speed   || 2.0;
        this.label   = props.label   || '';
        this.width   = this.size;
        this.height  = this.size;
        this._angle  = 0;
        this._arcT   = 0;
    }

    _onUpdate(dt) {
        this._angle += dt * this.speed * Math.PI * 2;
        this._arcT  += dt * this.speed * 0.8;
    }

    draw(ctx) {
        if (!this.visible) return;
        const t   = this.theme;
        const col = t.resolveColor(this.color);
        const cx  = this.x + this.size / 2;
        const cy  = this.y + this.size / 2;
        const r   = this.size / 2 - 3;
        const lw  = Math.max(2, this.size * 0.12);
        const arc = (0.25 + Math.sin(this._arcT) * 0.22) * Math.PI * 2;

        ctx.save();
        this._applyOpacity(ctx);

        // Track
        ctx.strokeStyle = t.colorScrollTrack;
        ctx.lineWidth   = lw;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // Arc
        ActionUIDrawUtils.shadow(ctx, t.withAlpha(col, 0.5), 8, 0, 0);
        ctx.strokeStyle = col;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, r, this._angle, this._angle + arc);
        ctx.stroke();
        ActionUIDrawUtils.clearShadow(ctx);

        if (this.label) {
            ActionUIDrawUtils.text(ctx, this.label,
                cx, this.y + this.size + 6,
                t.font(t.fontSizeXs), t.colorTextMuted, 'center', 'top'
            );
        }

        this._restoreOpacity(ctx);
        ctx.restore();
    }
}
