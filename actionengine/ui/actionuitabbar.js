/******************************************************************************
 * ActionUITabBar — horizontal tab switcher
 ******************************************************************************/

class ActionUITabBar extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.isInteractive = props.isInteractive ?? true;
        this.tabs       = props.tabs    || [];   // [{ label, id }]
        this.selected   = props.selected ?? 0;
        this.height     = props.height  || this.theme.tabHeight;
        this._indicX    = 0;
        this._indicW    = 0;
        this._ready     = false;
        this._kbActive  = false;  // keyboard active mode
    }

    _onUpdate(dt) {
        const tw = this.width / this.tabs.length;
        const tx = this.x + this.selected * tw;
        if (!this._ready) {
            this._indicX = tx;
            this._indicW = tw;
            this._ready  = true;
        } else {
            this._indicX = ActionUIDrawUtils.lerp(this._indicX, tx, dt / this.theme.animDurationNormal);
            this._indicW = ActionUIDrawUtils.lerp(this._indicW, tw, dt / this.theme.animDurationNormal);
        }
    }

    onPointerUp(px, py) {
        if (!this.enabled || !this.containsPoint(px, py)) return;
        const tw = this.width / this.tabs.length;
        const i  = Math.floor((px - this.x) / tw);
        if (i >= 0 && i < this.tabs.length) {
            this.selected = i;
            this.onChange && this.onChange(this.tabs[i].id, i, this);
            this.onClick  && this.onClick(this);
        }
    }

    onKeyDown(key) {
        if (!this.enabled) return;
        if (key === 'DirLeft' && this.selected > 0) {
            this.selected--;
            this.onChange && this.onChange(this.tabs[this.selected].id, this.selected, this);
        } else if (key === 'DirRight' && this.selected < this.tabs.length - 1) {
            this.selected++;
            this.onChange && this.onChange(this.tabs[this.selected].id, this.selected, this);
        }
    }

    draw(ctx) {
        if (!this.visible) return;
        const t  = this.theme;
        const tw = this.width / this.tabs.length;
        const r  = t.radiusSm;

        ctx.save();
        this._applyOpacity(ctx);

        // Background
        ActionUIDrawUtils.fillRoundRect(ctx, this.x, this.y, this.width, this.height, r, t.colorSurface);
        ActionUIDrawUtils.strokeRoundRect(ctx, this.x, this.y, this.width, this.height, r, t.colorBorder, 1);

        // Animated indicator
        const indH = 3;
        ActionUIDrawUtils.fillRoundRect(ctx,
            this._indicX + 4, this.y + this.height - indH - 2,
            this._indicW - 8, indH, indH / 2, t.colorPrimary
        );

        // Tab labels
        this.tabs.forEach((tab, i) => {
            const tx0 = this.x + i * tw;
            const sel = i === this.selected;
            const col = sel ? t.colorPrimary : t.colorTextMuted;
            const fw  = sel ? t.fontWeightBold : t.fontWeightNormal;
            ActionUIDrawUtils.text(ctx, tab.label,
                tx0 + tw / 2, this.y + this.height / 2,
                t.font(t.fontSizeMd, fw), col, 'center', 'middle'
            );
        });

        this._restoreOpacity(ctx);
        ctx.restore();
    }
}
