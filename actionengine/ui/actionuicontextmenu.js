/******************************************************************************
 * ActionUIContextMenu — right-click popup
 ******************************************************************************/

class ActionUIContextMenu extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.items   = props.items  || [];  // [{ label, icon, value, disabled, separator }]
        this._showT  = 0;
        this._open   = false;
        this._hoverI = -1;
        this.width   = props.width || 180;
        this._itemH  = 32;
        this.zIndex  = 95;
        this.visible = false;
    }

    openAt(x, y) {
        const sw = this._ui ? this._ui._width  : 800;
        const sh = this._ui ? this._ui._height : 600;
        this.x       = Math.min(x, sw - this.width - 4);
        this.y       = Math.min(y, sh - this._totalHeight() - 4);
        this._open   = true;
        this.visible = true;
        this._hoverI = -1;
    }

    close() {
        this._open = false;
    }

    _totalHeight() {
        return this.items.reduce((s, item) => s + (item.separator ? 10 : this._itemH), 0) + 8;
    }

    _onUpdate(dt) {
        const target = this._open ? 1 : 0;
        this._showT  = ActionUIDrawUtils.lerp(this._showT, target, dt / this.theme.animDurationFast);
        if (!this._open && this._showT < 0.01) this.visible = false;
    }

    onPointerMove(px, py) {
        if (!this._open) return;
        let iy = this.y + 4;
        this._hoverI = -1;
        this.items.forEach((item, i) => {
            if (item.separator) { iy += 10; return; }
            if (px >= this.x && px <= this.x + this.width && py >= iy && py <= iy + this._itemH) {
                if (!item.disabled) this._hoverI = i;
            }
            iy += this._itemH;
        });
    }

    onPointerDown(px, py) {
        if (!this._open) return;
        let iy = this.y + 4;
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            if (item.separator) { iy += 10; continue; }
            if (!item.disabled && px >= this.x && px <= this.x + this.width &&
                py >= iy && py <= iy + this._itemH) {
                this.onChange && this.onChange(item.value, i, this);
                this.onClick  && this.onClick(item, this);
                this.close();
                return;
            }
            iy += this._itemH;
        }
        // Click outside
        if (px < this.x || px > this.x + this.width || py < this.y || py > this.y + this._totalHeight()) {
            this.close();
        }
    }

    draw(ctx) {
        if (!this.visible || this._showT < 0.02) return;
        const t   = this.theme;
        const a   = ActionUIDrawUtils.easeOut(this._showT);
        const h   = this._totalHeight() * a;
        const r   = t.radiusMd;

        ctx.save();
        ctx.globalAlpha = a;

        ActionUIDrawUtils.shadow(ctx, t.colorShadow, 24, 0, 6);
        ActionUIDrawUtils.fillRoundRect(ctx, this.x, this.y, this.width, h, r, t.colorSurfaceOverlay);
        ActionUIDrawUtils.clearShadow(ctx);
        ActionUIDrawUtils.strokeRoundRect(ctx, this.x, this.y, this.width, h, r, t.colorBorder, 1);

        ctx.save();
        ActionUIDrawUtils.roundRect(ctx, this.x, this.y, this.width, h, r);
        ctx.clip();

        let iy = this.y + 4;
        this.items.forEach((item, i) => {
            if (item.separator) {
                ActionUIDrawUtils.line(ctx, this.x + 8, iy + 5, this.x + this.width - 8, iy + 5, t.colorBorder, 1);
                iy += 10;
                return;
            }

            if (i === this._hoverI) {
                ActionUIDrawUtils.fillRoundRect(ctx, this.x + 2, iy, this.width - 4, this._itemH, t.radiusSm,
                    t.withAlpha(t.colorPrimary, 0.15)
                );
            }

            const col = item.disabled ? t.colorDisabledText : t.colorText;
            if (item.icon) {
                ActionUIIconRenderer.draw(ctx, item.icon, this.x + 10, iy + (this._itemH - 16) / 2, 16, col);
            }
            ActionUIDrawUtils.text(ctx, item.label,
                this.x + (item.icon ? 34 : 14), iy + this._itemH / 2,
                t.font(t.fontSizeSm), col, 'left', 'middle'
            );

            iy += this._itemH;
        });

        ctx.restore();
        ctx.restore();
    }
}
