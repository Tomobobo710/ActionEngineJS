/******************************************************************************
 * ActionUIPanel — surface container
 ******************************************************************************/

class ActionUIPanel extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.title          = props.title       || null;
        this.fill           = props.fill        || null;    // override theme surface
        this.border         = props.border      ?? true;
        this.shadow         = props.shadow      ?? true;
        this.radius         = props.radius      ?? null;    // override theme
        this.padding        = props.padding     ?? null;
        this.children       = [];
        this._scrollY       = 0;
        this._scrollable    = props.scrollable  ?? false;
    }

    addChild(comp) {
        comp._ui = this._ui;
        comp._parent = this;
        this.children.push(comp);
        // Auto-register with ActionUI if panel is already registered
        if (this._ui && !this._ui._components.includes(comp)) {
            this._ui.add(comp);
        }
        return this;
    }

    removeChild(id) {
        this.children = this.children.filter(c => c.id !== id);
    }

    draw(ctx) {
        if (!this.visible) return;
        const t   = this.theme;
        const r   = this.radius ?? t.radiusMd;
        const fill= this.fill   ?? t.colorSurface;
        const pad = this.padding ?? t.panelPadding;

        ctx.save();
        this._applyOpacity(ctx);

        // Shadow
        if (this.shadow) {
            ActionUIDrawUtils.shadow(ctx, t.colorShadow, t.shadowBlur, 0, t.shadowOffsetY);
        }

        // Fill
        ActionUIDrawUtils.fillRoundRect(ctx, this.x, this.y, this.width, this.height, r, fill);
        ActionUIDrawUtils.clearShadow(ctx);

        // Shine
        this._drawSurfaceShine(ctx, this.x, this.y, this.width, this.height, r);

        // Border
        if (this.border) {
            ActionUIDrawUtils.strokeRoundRect(ctx, this.x, this.y, this.width, this.height, r, t.colorBorder, 1);
        }

        // Title bar
        if (this.title) {
            this._drawTitleBar(ctx, t, r, pad);
        }

        this._restoreOpacity(ctx);
        ctx.restore();
    }

    _drawTitleBar(ctx, t, r, pad) {
        const tbH = 36;
        const tby = this.y;
        // Title band gradient
        const gb = ctx.createLinearGradient(this.x, tby, this.x, tby + tbH);
        gb.addColorStop(0, t.colorSurfaceRaised);
        gb.addColorStop(1, t.withAlpha(t.colorSurfaceRaised, 0));
        ctx.save();
        ActionUIDrawUtils.roundRect(ctx, this.x, tby, this.width, tbH, r);
        ctx.clip();
        ctx.fillStyle = gb;
        ctx.fillRect(this.x, tby, this.width, tbH);
        ctx.restore();

        // Separator under title
        ActionUIDrawUtils.line(ctx,
            this.x + 1, tby + tbH,
            this.x + this.width - 1, tby + tbH,
            t.colorBorder, 1
        );

        // Title text
        ActionUIDrawUtils.text(ctx, this.title,
            this.x + pad, tby + tbH / 2,
            t.font(t.fontSizeMd, t.fontWeightBold),
            t.colorText, 'left', 'middle'
        );
    }
}
