/******************************************************************************
 * ActionUILabel — static text
 ******************************************************************************/

class ActionUILabel extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.text       = props.text        || '';
        this.fontSize   = props.fontSize    || null;
        this.fontWeight = props.fontWeight  || null;
        this.color      = props.color       || null;
        this.align      = props.align       || 'left';
        this.mono       = props.mono        || false;
        this.wrap       = props.wrap        || false;
        this.lineHeight = props.lineHeight  || 1.5;
        this.ellipsis   = props.ellipsis    || false;
        this.uppercase  = props.uppercase   || false;
        this.shadow     = props.shadow      || false;
    }

    draw(ctx) {
        if (!this.visible) return;
        const t    = this.theme;
        const fs   = this.fontSize   || t.fontSizeMd;
        const fw   = this.fontWeight || t.fontWeightNormal;
        const col  = this.color      || t.colorText;
        const font = this.mono ? t.fontMono(fs, fw) : t.font(fs, fw);
        let   str  = this.text;
        if (this.uppercase) str = str.toUpperCase();

        ctx.save();
        this._applyOpacity(ctx);

        if (this.shadow) {
            ActionUIDrawUtils.shadow(ctx, t.colorShadow, 6, 0, 2);
        }

        if (this.wrap) {
            const lh = fs * this.lineHeight;
            ActionUIDrawUtils.textWrapped(ctx, str, this.x, this.y, this.width, lh, font, col);
        } else {
            let drawStr = str;
            if (this.ellipsis) {
                ctx.font = font;
                while (drawStr.length > 0 && ctx.measureText(drawStr + '…').width > this.width) {
                    drawStr = drawStr.slice(0, -1);
                }
                if (drawStr !== str) drawStr += '…';
            }
            const ax = this.align === 'center' ? this.x + this.width / 2
                     : this.align === 'right'  ? this.x + this.width
                     : this.x;
            ActionUIDrawUtils.text(ctx, drawStr, ax, this.y + this.height / 2, font, col, this.align, 'middle');
        }

        ActionUIDrawUtils.clearShadow(ctx);
        this._restoreOpacity(ctx);
        ctx.restore();
    }
}
