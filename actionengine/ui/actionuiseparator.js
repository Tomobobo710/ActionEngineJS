/******************************************************************************
 * ActionUISeparator — horizontal or vertical rule
 ******************************************************************************/

class ActionUISeparator extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.direction = props.direction || 'horizontal';
        this.label     = props.label     || '';
        this.color     = props.color     || null;
    }

    draw(ctx) {
        if (!this.visible) return;
        const t    = this.theme;
        const col  = this.color || t.colorBorder;

        ctx.save();
        this._applyOpacity(ctx);

        if (this.direction === 'horizontal') {
            if (this.label) {
                const font = t.font(t.fontSizeXs, t.fontWeightMedium);
                const tw   = ActionUIDrawUtils.textMeasure(ctx, this.label, font).width + t.spacingSm * 2;
                const midX = this.x + this.width / 2;
                ActionUIDrawUtils.line(ctx, this.x, this.y, midX - tw/2 - 4, this.y, col, 1);
                ActionUIDrawUtils.line(ctx, midX + tw/2 + 4, this.y, this.x + this.width, this.y, col, 1);
                ActionUIDrawUtils.text(ctx, this.label, midX, this.y, font, t.colorTextMuted, 'center', 'middle');
            } else {
                ActionUIDrawUtils.line(ctx, this.x, this.y, this.x + this.width, this.y, col, 1);
            }
        } else {
            ActionUIDrawUtils.line(ctx, this.x, this.y, this.x, this.y + this.height, col, 1);
        }

        this._restoreOpacity(ctx);
        ctx.restore();
    }
}
