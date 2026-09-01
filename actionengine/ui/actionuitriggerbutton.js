/******************************************************************************
 * ActionUITriggerButton — on-screen analog trigger (L2 / R2)
 *
 * Vertical press strip: finger depth = value 0..1, written to a 1D InputHandler
 * axis slot (in .y). Read with input.getTrigger(slot); a physical trigger feeds
 * the same slot. If `action` is set, also holds it digitally past `threshold`.
 ******************************************************************************/

class ActionUITriggerButton extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.isInteractive = props.isInteractive ?? true;

        this.slot      = props.slot ?? 'leftTrigger';
        this.action    = props.action ?? null;       // null = pure analog
        this.threshold = props.threshold ?? 0.5;

        this.width     = props.width  ?? 56;
        this.height    = props.height ?? 96;
        this.label     = props.label ?? 'L2';

        this.deadzone  = props.deadzone ?? 0.05;
        this.orient    = props.orient ?? 'v';         // 'v' vertical | 'h' horizontal
        this.fillFrom  = props.fillFrom ?? (this.orient === 'h' ? 'left' : 'top');
        this.onChange  = props.onChange ?? null;

        this._activeId = null;            // 'mouse' | touch id | null
        this._pointerCaptured = false;
        this._touchCaptured   = false;
        this._value    = 0;
        this._pressT   = 0;
    }

    _valueFromPoint(px, py) {
        let f = this.orient === 'h' ? (px - this.x) / this.width : (py - this.y) / this.height;
        if (this.fillFrom === 'bottom' || this.fillFrom === 'right') f = 1 - f;
        f = Math.max(0, Math.min(1, f));
        if (f < this.deadzone) return 0;
        return (f - this.deadzone) / (1 - this.deadzone);
    }

    _begin(id, px, py) {
        if (!this.enabled) return;
        this._activeId = id;
        this._pointerCaptured = (id === 'mouse');
        this._touchCaptured   = (id !== 'mouse');
        this._set(this._valueFromPoint(px, py));
    }
    _move(px, py) {
        if (this._activeId === null) return;
        this._set(this._valueFromPoint(px, py));
    }
    _end() {
        this._activeId = null;
        this._pointerCaptured = false;
        this._touchCaptured   = false;
        this._set(0);
    }
    _set(v) {
        if (v === this._value) return;
        this._value = v;
        if (this.onChange) this.onChange(v, this);
    }

    onPointerDown(px, py) { if (this._activeId === null && this.containsPoint(px, py)) this._begin('mouse', px, py); }
    onPointerMove(px, py) { if (this._activeId === 'mouse') this._move(px, py); }
    onPointerUp(px, py)   { if (this._activeId === 'mouse') this._end(); }

    onTouchDown(id, px, py) { if (this._activeId === null && this.containsPoint(px, py)) this._begin(id, px, py); }
    onTouchMove(id, px, py) { if (this._activeId === id) this._move(px, py); }
    onTouchUp(id, px, py)   { if (this._activeId === id) this._end(); }

    _onUpdate(dt) {
        const input = this._ui && this._ui.input;

        if (this._activeId !== null) {
            // Driven by a finger here. per-frame accumulator — write every frame.
            if (input && input.setVirtualAxis) input.setVirtualAxis(this.slot, 0, this._value);
            if (this.action && input && input.setVirtualButton) {
                input.setVirtualButton(this.action, this._value >= this.threshold);
            }
        } else if (input && input.getTrigger) {
            // Idle: reflect a physical trigger on the same slot.
            this._value = input.getTrigger(this.slot);
        }

        const lit = this._activeId !== null || this._value > 0.01;
        this._pressT = ActionUIDrawUtils.lerp(this._pressT, lit ? 1 : 0, dt / this.theme.animDurationFast);
    }

    getValue() { return this._value; }

    draw(ctx) {
        if (!this.visible) return;
        const t = this.theme;
        const r = t.radiusMd ?? 8;

        ctx.save();
        this._applyOpacity(ctx);

        ActionUIDrawUtils.fillRoundRect(ctx, this.x, this.y, this.width, this.height, r,
            t.withAlpha(t.colorSurfaceRaised, 0.55));
        ActionUIDrawUtils.strokeRoundRect(ctx, this.x, this.y, this.width, this.height, r,
            t.withAlpha(t.colorBorder, 0.9), 2);

        if (this._value > 0) {
            const col = (this.action && this._value >= this.threshold) ? t.colorPrimary
                                                                       : t.withAlpha(t.colorPrimary, 0.65);
            let fx = this.x, fy = this.y, fw = this.width, fh = this.height;
            if (this.orient === 'h') {
                fw = this.width * this._value;
                if (this.fillFrom === 'right') fx = this.x + this.width - fw;
            } else {
                fh = this.height * this._value;
                if (this.fillFrom === 'bottom') fy = this.y + this.height - fh;
            }
            if (fw > 1 && fh > 1) ActionUIDrawUtils.fillRoundRect(ctx, fx, fy, fw, fh, r, col);
        }

        ActionUIDrawUtils.text(ctx, this.label,
            this.x + this.width / 2, this.y + this.height / 2,
            t.font(t.fontSizeSm, t.fontWeightBold),
            t.withAlpha('#ffffff', 0.85), 'center', 'middle');

        this._restoreOpacity(ctx);
        ctx.restore();
    }
}
