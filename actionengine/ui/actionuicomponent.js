/******************************************************************************
 * ActionUIComponent — abstract base class for all UI components
 ******************************************************************************/

class ActionUIComponent {
    constructor(props = {}) {
        this.id        = props.id   || ActionUIComponent._nextId();
        this.x         = props.x    ?? 0;
        this.y         = props.y    ?? 0;
        this.width     = props.width  ?? 100;
        this.height    = props.height ?? 32;
        this.visible   = props.visible  ?? true;
        this.enabled   = props.enabled  ?? true;
        this.tooltip   = props.tooltip  || null;
        this.zIndex    = props.zIndex   ?? 0;
        this.layer     = props.layer    || 'gui';   // 'gui' | 'debug' | 'game'
        this.opacity   = props.opacity  ?? 1;
        this.tag       = props.tag      || null;    // arbitrary user data
        this.isInteractive = props.isInteractive ?? false;  // can receive keyboard focus

        // Parent-child relationship
        this._parent   = null;    // parent component (for visibility cascading)

        // Managed by ActionUI
        this._ui       = null;    // back-ref to ActionUI instance
        this._hovered  = false;
        this._pressed  = false;
        this._focused  = false;
        this._dirty    = true;
        this._animTime = 0;       // seconds since last state change

        // Callbacks
        this.onClick       = props.onClick       || null;
        this.onHoverEnter  = props.onHoverEnter  || null;
        this.onHoverLeave  = props.onHoverLeave  || null;
        this.onChange      = props.onChange      || null;
    }

    static _idCounter = 0;
    static _nextId() { return `ui_${++ActionUIComponent._idCounter}`; }

    get theme() { return this._ui ? this._ui.theme : new ActionUITheme(); }

    getBounds() {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }

    containsPoint(px, py) {
        return px >= this.x && px <= this.x + this.width &&
               py >= this.y && py <= this.y + this.height;
    }

    setPosition(x, y)     { this.x = x; this.y = y; }
    setSize(w, h)         { this.width = w; this.height = h; }
    show()                { this.visible = true; }
    hide()                { this.visible = false; }
    enable()              { this.enabled = true; }
    disable()             { this.enabled = false; }

    // Called each frame by ActionUI
    update(dt) {
        this._animTime += dt;
        this._onUpdate(dt);
    }

    // Subclasses override
    _onUpdate(dt)           {}
    draw(ctx)               { if (!this.visible) return; }
    onPointerDown(px, py)   {}
    onPointerUp(px, py)     {}
    onPointerMove(px, py)   {}
    onKeyDown(key)          {}
    onKeyUp(key)            {}
    onChar(char)            {}
    onFocus()               { this._focused = true; }
    onBlur()                { this._focused = false; }

    // Check if this component or any ancestor is invisible
    _isEffectivelyVisible() {
        if (!this.visible) return false;
        if (this._parent) return this._parent._isEffectivelyVisible();
        return true;
    }

    _applyOpacity(ctx) {
        ctx.globalAlpha = this.opacity;
    }

    _restoreOpacity(ctx) {
        ctx.globalAlpha = 1;
    }

    // Draw an inset highlight shine — subtle top edge gradient
    _drawSurfaceShine(ctx, x, y, w, h, r) {
        const t = this.theme;
        const shine = ctx.createLinearGradient(x, y, x, y + h * 0.55);
        shine.addColorStop(0,   'rgba(255,255,255,0.10)');
        shine.addColorStop(0.5, 'rgba(255,255,255,0.03)');
        shine.addColorStop(1,   'rgba(255,255,255,0.00)');
        ActionUIDrawUtils.fillRoundRect(ctx, x, y, w, h, r, shine);
    }
}
