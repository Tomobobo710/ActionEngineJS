/******************************************************************************
 * ActionUIGamepadButton — momentary button that HOLDS an action
 *
 * Reports held digital state for as long as a finger is on it, via
 * input.setVirtualButton(action, held). Multi-touch aware, so several can be
 * held at once. Used by ActionUIGamepad for the face buttons and shoulders.
 ******************************************************************************/

class ActionUIGamepadButton extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.isInteractive = props.isInteractive ?? true;

        this.action  = props.action ?? null;
        this.label   = props.label ?? '';
        this.shape   = props.shape ?? "circle"; // "circle" | "round-rect"
        this.width   = props.width  ?? 64;
        this.height  = props.height ?? 64;
        this.accent  = props.accent ?? null;

        this.onChange = props.onChange ?? null; // (held, this)
        this.slideOff = props.slideOff ?? false;  // release when the finger leaves the bounds

        this._activeId = null;                  // 'mouse' | touch id | null
        this._pointerCaptured = false;
        this._touchCaptured   = false;
        this._pressT = 0;
    }

    get held() { return this._activeId !== null; }

    containsPoint(px, py) {
        if (this.shape !== 'circle') return super.containsPoint(px, py);
        const cx = this.x + this.width / 2, cy = this.y + this.height / 2;
        const r  = Math.min(this.width, this.height) / 2;
        return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
    }

    _begin(id) {
        if (!this.enabled) return;
        this._activeId = id;
        // capture so a slight drift off the button doesn't drop the hold
        this._pointerCaptured = (id === 'mouse');
        this._touchCaptured   = (id !== 'mouse');
        if (this.onChange) this.onChange(true, this);
    }
    _release() {
        if (this._activeId === null) return;
        this._activeId = null;
        this._pointerCaptured = false;
        this._touchCaptured   = false;
        if (this.onChange) this.onChange(false, this);
    }

    onPointerDown(px, py) { if (this._activeId === null && this.containsPoint(px, py)) this._begin('mouse'); }
    onPointerUp(px, py)   { if (this._activeId === 'mouse') this._release(); }
    onPointerMove(px, py) {
        if (this._activeId === 'mouse' && this.slideOff && !this.containsPoint(px, py)) this._release();
    }

    onTouchDown(id, px, py) { if (this._activeId === null && this.containsPoint(px, py)) this._begin(id); }
    onTouchUp(id, px, py)   { if (this._activeId === id) this._release(); }
    onTouchMove(id, px, py) {
        if (this._activeId === id && this.slideOff && !this.containsPoint(px, py)) this._release();
    }

    _onUpdate(dt) {
        const input = this._ui && this._ui.input;
        if (this.action && input && input.setVirtualButton) {
            input.setVirtualButton(this.action, this.held);
        }
        // Light up from ANY source (finger here, or a physical gamepad button).
        const lit = this.held ||
            (this.action && input && input.isKeyPressed && input.isKeyPressed(this.action));
        this._pressT = ActionUIDrawUtils.lerp(this._pressT, lit ? 1 : 0, dt / this.theme.animDurationFast);
    }

    draw(ctx) {
        if (!this.visible) return;
        const t   = this.theme;
        const col = this.accent ? (t.resolveColor(this.accent) || this.accent) : t.colorPrimary;
        const a   = 0.55 + this._pressT * 0.45;

        ctx.save();
        this._applyOpacity(ctx);

        if (this.shape === 'circle') {
            const cx = this.x + this.width / 2;
            const cy = this.y + this.height / 2;
            const r  = Math.min(this.width, this.height) / 2 * (1 + this._pressT * 0.06);
            ActionUIDrawUtils.circle(ctx, cx, cy, r, t.withAlpha(col, a * 0.5), t.withAlpha(col, a), 2);
            if (this.label) {
                ActionUIDrawUtils.text(ctx, this.label, cx, cy,
                    t.font(t.fontSizeMd, t.fontWeightBold), t.withAlpha('#ffffff', 0.9), 'center', 'middle');
            }
        } else {
            const r = t.radiusMd ?? 8;
            ActionUIDrawUtils.fillRoundRect(ctx, this.x, this.y, this.width, this.height, r, t.withAlpha(col, a * 0.5));
            ActionUIDrawUtils.strokeRoundRect(ctx, this.x, this.y, this.width, this.height, r, t.withAlpha(col, a), 2);
            if (this.label) {
                ActionUIDrawUtils.text(ctx, this.label, this.x + this.width / 2, this.y + this.height / 2,
                    t.font(t.fontSizeSm, t.fontWeightBold), t.withAlpha('#ffffff', 0.9), 'center', 'middle');
            }
        }

        this._restoreOpacity(ctx);
        ctx.restore();
    }
}
