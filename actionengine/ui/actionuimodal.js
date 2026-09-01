/******************************************************************************
 * ActionUIModal — blocking overlay dialog
 ******************************************************************************/

class ActionUIModal extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.isInteractive = true;
        this.title      = props.title       || 'Dialog';
        this.message    = props.message     || '';
        this.buttons    = props.buttons     || [{ label:'OK', value:'ok', variant:'primary' }];
        this.width      = props.width       || 380;
        this.height     = props.height      || 200;
        this._showT     = 0;
        this._showing   = false;
        this.onClose    = props.onClose     || null;
        this.zIndex     = 1000;  // Always on top
        this._kbFocus   = 0;  // keyboard focus index

        // provisional; _layout() re-centers against the real surface once _ui is set
        this.x = (800 - this.width)  / 2;
        this.y = (600 - this.height) / 2;

        this._btns = this.buttons.map((b, i) => new ActionUIButton({
            text:    b.label,
            variant: b.variant || 'ghost',
            width:   100,
            height:  34,
            onClick: () => {
                this.close();
                this.onClose && this.onClose(b.value, this);
            }
        }));
        this._layout();
    }

    // Center the card + button row on the drawing surface (800x600 until _ui is set).
    _layout() {
        const sw = this._ui ? this._ui._width  : 800;
        const sh = this._ui ? this._ui._height : 600;
        this.x = (sw - this.width)  / 2;
        this.y = (sh - this.height) / 2;

        const bw = 100, gap = 10;
        const totalW = this._btns.length * bw + (this._btns.length - 1) * gap;
        this._btns.forEach((btn, i) => {
            btn.x = this.x + (this.width - totalW) / 2 + i * (bw + gap);
            btn.y = this.y + this.height - 50;
        });
    }

    open() {
        this._showing = true;
        this.visible  = true;
        this._kbFocus = 0;
        this._btns.forEach(b => { if (this._ui) b._ui = this._ui; });
        this._layout();
    }

    close() {
        this._showing = false;
    }

    _onUpdate(dt) {
        const target = this._showing ? 1 : 0;
        this._showT  = ActionUIDrawUtils.lerp(this._showT, target, dt / this.theme.animDurationNormal);
        if (!this._showing && this._showT < 0.01) this.visible = false;
        this._btns.forEach(b => b.update(dt));
    }

    onKeyDown(key) {
        if (!this._showing) return;
        if (key === 'DirLeft' && this._kbFocus > 0) {
            this._kbFocus--;
        } else if (key === 'DirRight' && this._kbFocus < this._btns.length - 1) {
            this._kbFocus++;
        } else if (key === 'Action1') {
            // Click focused button
            const btn = this._btns[this._kbFocus];
            if (btn) {
                const b = btn.getBounds();
                btn.onPointerDown(b.x + b.width/2, b.y + b.height/2);
                btn.onPointerUp(b.x + b.width/2, b.y + b.height/2);
            }
        } else if (key === 'Action2') {
            // Cancel - close modal
            this.close();
        }
    }

    onPointerDown(px, py) {
        if (!this._showing) return;
        this._btns.forEach(b => {
            if (b.containsPoint(px, py)) {
                b.onPointerDown(px, py);
            }
        });
    }

    onPointerUp(px, py) {
        if (!this._showing) return;
        this._btns.forEach(b => {
            if (b.containsPoint(px, py)) {
                b.onPointerUp(px, py);
            }
        });
    }

    onPointerMove(px, py) {
        if (!this._showing) return;
        this._btns.forEach(b => { b._hovered = b.containsPoint(px, py); });
    }

    draw(ctx) {
        if (!this.visible || this._showT < 0.01) return;
        const t   = this.theme;
        const a   = ActionUIDrawUtils.easeOut(this._showT);
        const scl = 0.88 + a * 0.12;
        const cx  = this.x + this.width  / 2;
        const cy  = this.y + this.height / 2;

        ctx.save();

        ctx.fillStyle = t.withAlpha(t.modalOverlayColor, a * 0.85);
        ctx.fillRect(0, 0, this._ui ? this._ui._width : 800, this._ui ? this._ui._height : 600);

        // Card scale in
        ctx.translate(cx, cy);
        ctx.scale(scl, scl);
        ctx.translate(-cx, -cy);
        ctx.globalAlpha = a;

        // Card
        ActionUIDrawUtils.shadow(ctx, t.colorShadow, 40, 0, 12);
        ActionUIDrawUtils.fillRoundRect(ctx, this.x, this.y, this.width, this.height, t.radiusLg, t.colorSurfaceOverlay);
        ActionUIDrawUtils.clearShadow(ctx);
        ActionUIDrawUtils.strokeRoundRect(ctx, this.x, this.y, this.width, this.height, t.radiusLg, t.colorBorder, 1);

        // Title bar
        const tbH = 44;
        ctx.save();
        ActionUIDrawUtils.roundRect(ctx, this.x, this.y, this.width, tbH, t.radiusLg);
        ctx.clip();
        ActionUIDrawUtils.fillRoundRect(ctx, this.x, this.y, this.width, tbH, 0, t.colorSurfaceRaised);
        ctx.restore();

        ActionUIDrawUtils.line(ctx, this.x, this.y+tbH, this.x+this.width, this.y+tbH, t.colorBorder, 1);

        ActionUIDrawUtils.text(ctx, this.title,
            this.x + t.spacingLg, this.y + tbH / 2,
            t.font(t.fontSizeMd, t.fontWeightBold), t.colorText, 'left', 'middle'
        );

        // Message
        if (this.message) {
            ActionUIDrawUtils.textWrapped(ctx, this.message,
                this.x + t.spacingLg,
                this.y + tbH + t.spacingLg,
                this.width - t.spacingLg * 2,
                t.fontSizeMd * 1.6,
                t.font(t.fontSizeMd), t.colorTextMuted
            );
        }

        // Buttons with keyboard focus ring
        this._btns.forEach((b, i) => b.draw(ctx));
        if (this._showing && this._btns.length > 0) {
            const focusedBtn = this._btns[this._kbFocus];
            if (focusedBtn) {
                const fb = focusedBtn.getBounds();
                ActionUIDrawUtils.strokeRoundRect(ctx, fb.x - 2, fb.y - 2, fb.width + 4, fb.height + 4,
                    t.radiusMd + 1, t.colorKbFocusActive, 2);
            }
        }

        ctx.restore();
    }
}
