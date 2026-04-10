/******************************************************************************
 * ActionUIGrid — auto-layout grid container
 ******************************************************************************/

class ActionUIGrid extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.columns    = props.columns  || 3;
        this.gap        = props.gap      || this.theme.spacingMd;
        this.children   = [];
        this.cellWidth  = 0;
        this.cellHeight = props.cellHeight || 60;
    }

    addChild(comp) {
        comp._ui = this._ui;
        this.children.push(comp);
        this._layout();
        return this;
    }

    _layout() {
        const cw = (this.width - (this.columns - 1) * this.gap) / this.columns;
        this.cellWidth = cw;
        this.children.forEach((child, i) => {
            const col = i % this.columns;
            const row = Math.floor(i / this.columns);
            child.x = this.x + col * (cw + this.gap);
            child.y = this.y + row * (this.cellHeight + this.gap);
            child.width  = cw;
            child.height = this.cellHeight;
        });
        const rows = Math.ceil(this.children.length / this.columns);
        this.height = rows * this.cellHeight + (rows - 1) * this.gap;
    }

    _onUpdate(dt) {
        this.children.forEach(c => { c._ui = this._ui; c.update(dt); });
    }

    onPointerDown(px, py) { this.children.forEach(c => c.onPointerDown(px, py)); }
    onPointerUp(px, py)   { this.children.forEach(c => c.onPointerUp(px, py)); }
    onPointerMove(px, py) {
        this.children.forEach(c => { c._hovered = c.containsPoint(px, py); c.onPointerMove(px, py); });
    }

    draw(ctx) {
        if (!this.visible) return;
        ctx.save();
        this._applyOpacity(ctx);
        this.children.forEach(c => c.draw(ctx));
        this._restoreOpacity(ctx);
        ctx.restore();
    }
}
