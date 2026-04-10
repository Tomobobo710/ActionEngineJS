/******************************************************************************
 * ActionUIProgressBar — read-only value indicator
 ******************************************************************************/

class ActionUIProgressBar extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.value      = props.value    ?? 0;       // 0..1
        this.color      = props.color    || 'primary';
        this.label      = props.label    || '';
        this.showPct    = props.showPct  ?? false;
        this.animated   = props.animated ?? true;
        this.striped    = props.striped  ?? false;
        this.height     = props.height   || 14;
        this._displayV  = this.value;
        this._stripeOff = 0;
    }

    _onUpdate(dt) {
        if (this.animated) {
            this._displayV = ActionUIDrawUtils.lerp(this._displayV, this.value, dt / 0.4);
        } else {
            this._displayV = this.value;
        }
        this._stripeOff = (this._stripeOff + dt * 40) % 24;
    }

    draw(ctx) {
        if (!this.visible) return;
        const t   = this.theme;
        const r   = this.height / 2;
        const col = t.resolveColor(this.color);

        ctx.save();
        this._applyOpacity(ctx);

        // Label
        if (this.label) {
            ActionUIDrawUtils.text(ctx, this.label,
                this.x, this.y - 2,
                t.font(t.fontSizeSm), t.colorTextMuted, 'left', 'bottom'
            );
        }

        // Track
        ActionUIDrawUtils.fillRoundRect(ctx, this.x, this.y, this.width, this.height, r, t.colorScrollTrack);

        // Fill
        const fillW = this._displayV * this.width;
        if (fillW > 0) {
            ctx.save();
            ActionUIDrawUtils.roundRect(ctx, this.x, this.y, fillW, this.height, r);
            ctx.clip();

            const grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
            grad.addColorStop(0, t.withAlpha(col, 0.95));
            grad.addColorStop(1, col);
            ctx.fillStyle = grad;
            ctx.fillRect(this.x, this.y, fillW, this.height);

            // Striped overlay
            if (this.striped) {
                ctx.globalAlpha = 0.15;
                ctx.fillStyle   = '#fff';
                for (let sx = this.x - 24 + this._stripeOff; sx < this.x + fillW + 24; sx += 24) {
                    ctx.beginPath();
                    ctx.moveTo(sx,       this.y);
                    ctx.lineTo(sx + 12,  this.y);
                    ctx.lineTo(sx + 6,   this.y + this.height);
                    ctx.lineTo(sx - 6,   this.y + this.height);
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
            }

            // Shine
            const shine = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height * 0.6);
            shine.addColorStop(0, 'rgba(255,255,255,0.20)');
            shine.addColorStop(1, 'rgba(255,255,255,0.00)');
            ctx.fillStyle = shine;
            ctx.fillRect(this.x, this.y, fillW, this.height * 0.6);

            ctx.restore();
        }

        // Percent label
        if (this.showPct) {
            const pct = Math.round(this._displayV * 100) + '%';
            ActionUIDrawUtils.text(ctx, pct,
                this.x + this.width / 2,
                this.y + this.height / 2,
                t.font(t.fontSizeXs, t.fontWeightBold),
                '#fff', 'center', 'middle'
            );
        }

        this._restoreOpacity(ctx);
        ctx.restore();
    }
}
