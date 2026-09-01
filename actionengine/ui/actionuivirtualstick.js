/******************************************************************************
 * ActionUIVirtualStick — on-screen analog thumbstick
 *
 * Writes a 2D value into an InputHandler axis slot; read it with
 * input.getVector(slot), the same call a physical gamepad stick feeds.
 * Output: x right = +1, y down = +1, magnitude 0..1.
 ******************************************************************************/

class ActionUIVirtualStick extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.isInteractive = props.isInteractive ?? true;

        this.slot        = props.slot ?? 'leftAnalog';

        this.width       = props.width  ?? 140;
        this.height      = props.height ?? 140;
        // base is inset from the box so 'floating' has room to move it
        this.baseRadius  = props.baseRadius ?? Math.min(this.width, this.height) * 0.40;
        this.knobRadius  = props.knobRadius ?? this.baseRadius * 0.44;
        this.travel      = props.travel ?? (this.baseRadius - this.knobRadius);

        this.deadzone    = props.deadzone ?? 0.12;   // fraction of travel
        this.mode        = props.mode ?? 'fixed';    // 'fixed' | 'floating'
        this.hideWhenIdle = props.hideWhenIdle ?? false;
        this.onMove      = props.onMove ?? null;      // (x, y, mag, this)

        this._activeId   = null;          // 'mouse' | touch id | null
        this._pointerCaptured = false;
        this._touchCaptured   = false;
        this._cx = 0; this._cy = 0;       // base centre
        this._kx = 0; this._ky = 0;       // knob offset from centre
        this._out = { x: 0, y: 0, mag: 0 };
        this._pressT = 0;
    }

    _homeCenter() {
        return { x: this.x + this.width / 2, y: this.y + this.height / 2 };
    }

    _beginDrag(id, px, py) {
        if (!this.enabled) return;
        this._activeId = id;
        this._pointerCaptured = (id === 'mouse');
        this._touchCaptured   = (id !== 'mouse');

        if (this.mode === 'floating') {
            const r = this.baseRadius;
            this._cx = Math.max(this.x + r, Math.min(this.x + this.width  - r, px));
            this._cy = Math.max(this.y + r, Math.min(this.y + this.height - r, py));
        } else {
            const h = this._homeCenter();
            this._cx = h.x; this._cy = h.y;
        }
        this._drag(px, py);
    }

    _drag(px, py) {
        if (this._activeId === null) return;
        let dx = px - this._cx;
        let dy = py - this._cy;
        const dist = Math.hypot(dx, dy);
        if (dist > this.travel && dist > 0) {
            dx = dx / dist * this.travel;
            dy = dy / dist * this.travel;
        }
        this._kx = dx;
        this._ky = dy;

        let mag = Math.min(1, Math.hypot(dx, dy) / this.travel);
        if (mag < this.deadzone) {
            this._out.x = 0; this._out.y = 0; this._out.mag = 0;
        } else {
            const scaled = (mag - this.deadzone) / (1 - this.deadzone);
            const ang = Math.atan2(dy, dx);
            this._out.x = Math.cos(ang) * scaled;
            this._out.y = Math.sin(ang) * scaled;
            this._out.mag = scaled;
        }
    }

    _endDrag() {
        this._activeId = null;
        this._pointerCaptured = false;
        this._touchCaptured   = false;
        this._kx = 0; this._ky = 0;
        this._out.x = 0; this._out.y = 0; this._out.mag = 0;
    }

    onPointerDown(px, py) {
        if (this._activeId !== null) return;
        if (this.containsPoint(px, py)) this._beginDrag('mouse', px, py);
    }
    onPointerMove(px, py) { if (this._activeId === 'mouse') this._drag(px, py); }
    onPointerUp(px, py)   { if (this._activeId === 'mouse') this._endDrag(); }

    onTouchDown(id, px, py) {
        if (this._activeId !== null) return;
        if (this.containsPoint(px, py)) this._beginDrag(id, px, py);
    }
    onTouchMove(id, px, py) { if (this._activeId === id) this._drag(px, py); }
    onTouchUp(id, px, py)   { if (this._activeId === id) this._endDrag(); }

    _onUpdate(dt) {
        const input = this._ui && this._ui.input;

        if (this._activeId !== null) {
            // Driven by a finger here. setVirtualAxis is a per-frame accumulator —
            // write every frame it's held.
            if (input && input.setVirtualAxis) input.setVirtualAxis(this.slot, this._out.x, this._out.y);
            if (this.onMove) this.onMove(this._out.x, this._out.y, this._out.mag, this);
        } else if (input && input.getVector) {
            // Idle: reflect whatever else drives this slot (a physical gamepad stick).
            const v = input.getVector(this.slot);
            this._out = { x: v.x, y: v.y, mag: Math.hypot(v.x, v.y) };
            this._kx = v.x * this.travel;
            this._ky = v.y * this.travel;
        }

        const lit = this._activeId !== null || this._out.mag > 0.01;
        this._pressT = ActionUIDrawUtils.lerp(this._pressT, lit ? 1 : 0, dt / this.theme.animDurationFast);
    }

    getValue() {
        return { x: this._out.x, y: this._out.y, mag: this._out.mag };
    }

    draw(ctx) {
        if (!this.visible) return;
        const active = this._activeId !== null;
        if (this.hideWhenIdle && !active && this._pressT < 0.02) return;

        const t = this.theme;
        const c = (this.mode === 'floating' && active)
            ? { x: this._cx, y: this._cy }
            : this._homeCenter();

        ctx.save();
        this._applyOpacity(ctx);
        ctx.globalAlpha *= this.hideWhenIdle ? (0.35 + 0.65 * this._pressT) : (active ? 1 : 0.8);

        ActionUIDrawUtils.circle(ctx, c.x, c.y, this.baseRadius,
            t.withAlpha(t.colorSurfaceRaised, 0.55),
            t.withAlpha(t.colorBorder, 0.9), 2);

        ActionUIDrawUtils.circle(ctx, c.x, c.y, this.travel,
            null, t.withAlpha(t.colorBorder, 0.4), 1);

        const kr = this.knobRadius * (1 + this._pressT * 0.08);
        ActionUIDrawUtils.shadow(ctx, t.withAlpha(t.colorPrimary, 0.5), 10, 0, 2);
        ActionUIDrawUtils.circle(ctx, c.x + this._kx, c.y + this._ky, kr,
            t.colorPrimary, t.withAlpha('#ffffff', 0.6), 2);
        ActionUIDrawUtils.clearShadow(ctx);

        this._restoreOpacity(ctx);
        ctx.restore();
    }
}
