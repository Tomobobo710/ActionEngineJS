/******************************************************************************
 * ActionUIRadioGroup — mutually exclusive set of options
 ******************************************************************************/

class ActionUIRadioGroup extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.isInteractive = props.isInteractive ?? true;
        this.options    = props.options   || [];
        this.selected   = props.selected  ?? 0;
        this.direction  = props.direction || 'vertical';
        this.itemHeight = props.itemHeight || 28;
        this.itemWidth  = props.itemWidth  || null;
        this._dotTs     = this.options.map((_, i) => (i === this.selected ? 1 : 0));
        this._kbActive  = false;
    }

    _onUpdate(dt) {
        for (let i = 0; i < this._dotTs.length; i++) {
            const target = i === this.selected ? 1 : 0;
            if (this._dotTs[i] < target) {
                // Animate up: lerp toward 1
                this._dotTs[i] = Math.min(target, this._dotTs[i] + dt / this.theme.animDurationNormal);
            } else if (this._dotTs[i] > target) {
                // Animate down: linear decay
                this._dotTs[i] = Math.max(0, this._dotTs[i] - dt / this.theme.animDurationNormal);
            }
        }
    }

    onPointerUp(px, py) {
        if (!this.enabled) return;
        for (let i = 0; i < this.options.length; i++) {
            const { ix, iy } = this._itemPos(i);
            const iw = (this.itemWidth || this.width);
            if (px >= ix && px <= ix + iw && py >= iy && py <= iy + this.itemHeight) {
                this.selected = i;
                this.onChange && this.onChange(this.options[i].value, this);
                this.onClick  && this.onClick(this);
                break;
            }
        }
    }

    onKeyDown(key) {
        if (!this.enabled || !this._kbActive) return false;
        if (key === 'DirUp') {
            if (this.selected > 0) {
                this.selected--;
                this._dotTs = this.options.map((_, i) => (i === this.selected ? 1 : 0));
                this.onChange && this.onChange(this.options[this.selected].value, this);
                return true;
            }
            // At first option, let ActionUI move focus out
            return false;
        } else if (key === 'DirDown') {
            if (this.selected < this.options.length - 1) {
                this.selected++;
                this._dotTs = this.options.map((_, i) => (i === this.selected ? 1 : 0));
                this.onChange && this.onChange(this.options[this.selected].value, this);
                return true;
            }
            // At last option, let ActionUI move focus out
            return false;
        }
        return false;
    }

    _itemPos(i) {
        if (this.direction === 'horizontal') {
            const iw = this.itemWidth || Math.floor(this.width / this.options.length);
            return { ix: this.x + i * iw, iy: this.y };
        }
        return { ix: this.x, iy: this.y + i * this.itemHeight };
    }

    draw(ctx) {
        if (!this.visible) return;
        const t = this.theme;
        ctx.save();
        this._applyOpacity(ctx);

        const dotR = 9;
        this.options.forEach((opt, i) => {
            const { ix, iy } = this._itemPos(i);
            const cy  = iy + this.itemHeight / 2;
            const cx  = ix + dotR;

            // Outer ring
            const selCol = this._dotTs[i] > 0.01 ? t.colorPrimary : t.colorBorder;
            ActionUIDrawUtils.circle(ctx, cx, cy, dotR, null, selCol, 1.5);

            // Inner filled dot
            if (this._dotTs[i] > 0.01) {
                ActionUIDrawUtils.circle(ctx, cx, cy, dotR * 0.52 * this._dotTs[i],
                    t.colorPrimary
                );
            }

            // Label
            const col = this.enabled ? t.colorText : t.colorDisabledText;
            ActionUIDrawUtils.text(ctx, opt.label,
                cx + dotR + t.spacingSm, cy,
                t.font(t.fontSizeMd), col, 'left', 'middle'
            );
        });

        this._restoreOpacity(ctx);
        ctx.restore();
    }
}
