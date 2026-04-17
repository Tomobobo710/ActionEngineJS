/******************************************************************************
 * ActionUIButton — primary interactive widget
 * ActionUIIconButton — square button with a drawn icon only
 ******************************************************************************/

class ActionUIButton extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.isInteractive = props.isInteractive ?? true;
        this.text       = props.text        || 'Button';
        this.variant    = props.variant     || 'primary';
        this.fontSize   = props.fontSize    || null;
        this.radius     = props.radius      || null;
        this.icon       = props.icon        || null;
        this._hoverT    = 0;
        this._pressT    = 0;
        this._ripples   = [];
    }

    _onUpdate(dt) {
        const target = this._hovered ? 1 : 0;
        this._hoverT = ActionUIDrawUtils.lerp(this._hoverT, target, dt / this.theme.animDurationNormal);
        this._pressT = ActionUIDrawUtils.lerp(this._pressT, 0, dt / this.theme.animDurationFast);
        this._ripples = this._ripples.filter(r => r.t < 1);
        this._ripples.forEach(r => { r.t += dt / 0.45; r.t = Math.min(1, r.t); });
    }

    onPointerDown(px, py) {
        if (!this.enabled) return;
        this._pressed = true;
        this._pressT  = 1;
        this._ripples.push({ x: px - this.x, y: py - this.y, t: 0 });
    }

    onPointerUp(px, py) {
        if (!this.enabled) return;
        if (this._pressed && this.containsPoint(px, py)) {
            this.onClick && this.onClick(this);
        }
        this._pressed = false;
    }

    draw(ctx) {
        if (!this.visible) return;
        const t   = this.theme;
        const r   = this.radius ?? t.radiusMd;
        const fs  = this.fontSize || t.fontSizeMd;

        ctx.save();
        this._applyOpacity(ctx);

        const { bg, fg, border } = this._resolveColors(t);

        // Press scale transform
        const scale = 1 - this._pressT * 0.025;
        const cx    = this.x + this.width  / 2;
        const cy    = this.y + this.height / 2;
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);

        // Shadow
        const shadowAlpha = 0.3 + this._hoverT * 0.2;
        ActionUIDrawUtils.shadow(ctx, t.withAlpha(bg, shadowAlpha), 12 + this._hoverT * 6, 0, 2 + this._hoverT * 2);

        // Background gradient
        const grad = t.linearGradientV(ctx, this.x, this.y, this.height,
            this._liftColor(bg, 0.12),
            this._liftColor(bg, -0.06)
        );
        ActionUIDrawUtils.fillRoundRect(ctx, this.x, this.y, this.width, this.height, r, grad);
        ActionUIDrawUtils.clearShadow(ctx);

        // Hover overlay
        if (this._hoverT > 0.01) {
            ActionUIDrawUtils.fillRoundRect(ctx, this.x, this.y, this.width, this.height, r,
                `rgba(255,255,255,${this._hoverT * 0.08})`
            );
        }

        // Ripple
        this._drawRipples(ctx, r, fg);

        // Shine
        this._drawSurfaceShine(ctx, this.x, this.y, this.width, this.height, r);

        // Border
        if (border) {
            ActionUIDrawUtils.strokeRoundRect(ctx, this.x, this.y, this.width, this.height, r, border, 1.5);
        }

        // Disabled overlay
        if (!this.enabled) {
            ActionUIDrawUtils.fillRoundRect(ctx, this.x, this.y, this.width, this.height, r, 'rgba(0,0,0,0.40)');
        }

        // Text + icon
        this._drawContent(ctx, t, fg, fs);

        this._restoreOpacity(ctx);
        ctx.restore();
    }

    _drawRipples(ctx, r, fg) {
        if (!this._ripples.length) return;
        ctx.save();
        ActionUIDrawUtils.roundRect(ctx, this.x, this.y, this.width, this.height, r);
        ctx.clip();
        for (const rip of this._ripples) {
            const maxR  = Math.sqrt(this.width * this.width + this.height * this.height);
            const alpha = (1 - ActionUIDrawUtils.easeOut(rip.t)) * 0.22;
            ActionUIDrawUtils.circle(ctx,
                this.x + rip.x, this.y + rip.y,
                maxR * ActionUIDrawUtils.easeOut(rip.t),
                `rgba(255,255,255,${alpha})`
            );
        }
        ctx.restore();
    }

    _drawContent(ctx, t, fg, fs) {
        const font   = t.font(fs, t.fontWeightMedium);
        const iconW  = this.icon ? fs + 4 : 0;
        ctx.font = font;
        const totalW = ctx.measureText(this.text).width + iconW + (this.icon ? 6 : 0);
        const startX = this.x + (this.width - totalW) / 2;
        const midY   = this.y + this.height / 2;

        if (this.icon) {
            ActionUIIconRenderer.draw(ctx, this.icon, startX, midY - (fs + 4) / 2, fs + 4, fg);
            ActionUIDrawUtils.text(ctx, this.text, startX + iconW + 6, midY, font, fg, 'left', 'middle');
        } else {
            ActionUIDrawUtils.text(ctx, this.text, this.x + this.width / 2, midY, font, fg, 'center', 'middle');
        }
    }

    _resolveColors(t) {
         const v = this.variant;
         if (!this.enabled) return {
             bg:     t.colorDisabled,
             fg:     t.colorDisabledText,
             border: null
         };
         const map = {
             primary:   { bg: t.colorPrimary,   fg: t.colorPrimaryText, border: null },
             secondary: { bg: t.colorSecondary,  fg: t.colorText,        border: null },
             ghost:     { bg: t.colorGhostBg, fg: t.colorText, border: t.colorGhostBorder },
             danger:    { bg: t.colorDanger,     fg: '#fff',             border: null },
             success:   { bg: t.colorSuccess,    fg: '#fff',             border: null },
             accent:    { bg: t.colorAccent,     fg: t.colorTextInverse, border: null },
         };
         return map[v] || map.primary;
     }

    _liftColor(hex, amount) {
         // Handle hex colors
         if (hex.startsWith('#')) {
             const h = hex.slice(1);
             const full = h.length === 3 ? h.split('').map(c => c+c).join('') : h;
             const r = Math.min(255, Math.max(0, parseInt(full.slice(0,2),16) + Math.round(amount * 255)));
             const g = Math.min(255, Math.max(0, parseInt(full.slice(2,4),16) + Math.round(amount * 255)));
             const b = Math.min(255, Math.max(0, parseInt(full.slice(4,6),16) + Math.round(amount * 255)));
             return `rgb(${r},${g},${b})`;
         }
         // Handle rgba colors
         if (hex.startsWith('rgba(')) {
             const match = hex.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
             if (match) {
                 const r = Math.min(255, Math.max(0, parseInt(match[1]) + Math.round(amount * 255)));
                 const g = Math.min(255, Math.max(0, parseInt(match[2]) + Math.round(amount * 255)));
                 const b = Math.min(255, Math.max(0, parseInt(match[3]) + Math.round(amount * 255)));
                 const a = match[4];
                 return `rgba(${r}, ${g}, ${b}, ${a})`;
             }
         }
         // For other formats, return as-is
         return hex;
     }
}


// ─────────────────────────────────────────────────────────────────────────────
// ActionUIIconButton — square button with a drawn icon only
// ─────────────────────────────────────────────────────────────────────────────
class ActionUIIconButton extends ActionUIButton {
    constructor(props = {}) {
        super({ ...props, text: '' });
        this.iconKey    = props.icon || 'close';
        this.iconSize   = props.iconSize || 18;
        this.width      = props.width  || 36;
        this.height     = props.height || 36;
    }

    _drawContent(ctx, t, fg, fs) {
        const s  = this.iconSize;
        const ix = this.x + (this.width  - s) / 2;
        const iy = this.y + (this.height - s) / 2;
        ActionUIIconRenderer.draw(ctx, this.iconKey, ix, iy, s, fg);
    }
}
