/******************************************************************************
 * ActionUIGamepad — full on-screen controller layout
 *
 * Two analog sticks, a D-pad, ABXY, Select/Start, L1/R1, L2/R2, L3/R3.
 *
 *   ui.makeGamepad();                       // everything, full-screen
 *   ui.makeGamepad({ controls: {
 *     rightStick: false,                    // omit
 *     start: { action: 'Action8', label: 'MENU' },   // rebind / relabel
 *     a: { dx: 10, dy: -8 },                // nudge (design-space px)
 *   }});
 *
 * The parts write the standard slots/actions, so input.getVector('leftAnalog'),
 * input.getTrigger('rightTrigger'), input.isKeyPressed('Action1') all work the
 * same as a physical gamepad.
 *
 * LAYOUT: every control is placed in a fixed DESIGN_W x DESIGN_H space with
 * absolute pixel offsets from a corner/edge anchor. Nothing is positioned
 * relative to another control. At draw time the whole layout is uniformly
 * scaled to fit the component and centered — so it keeps a controller shape at
 * any panel size, with empty margin when the panel isn't the same aspect.
 *
 * A control entry:
 *   anchor  'tl' | 'tr' | 'bl' | 'br' | 'bc'   which corner/edge x,y hang off
 *   x, y    px from that anchor (right/down positive; for 'tr'/'br' x is inset
 *           from the right edge, for 'b*' y is inset from the bottom)
 *   w, h    box size in px            (round-rect / trigger / stick touch box)
 *   r       radius in px              (circle buttons, stick visible base)
 *   plus: action / slot / label / accent / orient / shape / mode
 ******************************************************************************/

class ActionUIGamepad extends ActionUIComponent {
    static DESIGN_W = 1000;
    static DESIGN_H = 600;

    static DEFAULT_LAYOUT = {
        // ── left side ──────────────────────────────────────────────────────
        l2:         { anchor: 'tl', x: 60,  y: 15,  w: 90,  h: 110, slot: 'leftTrigger',  action: 'Action11', label: 'L2', orient: 'v', fillFrom: 'bottom' },
        l1:         { anchor: 'tl', x: 30,  y: 135, w: 150, h: 46,  action: 'Action5',  label: 'L1', shape: 'round-rect' },
        dpad:       { anchor: 'tl', x: 105, y: 300, w: 180 },
        leftStick:  { anchor: 'bl', x: 165, y: 95, r: 82,  slot: 'leftAnalog' },
        l3:         { anchor: 'bl', x: 340, y: 55,  r: 32,  action: 'Action9',  label: 'L3' },

        // ── right side (mirrored) ─────────────────────────────────────────
        r2:         { anchor: 'tr', x: 60,  y: 15,  w: 90,  h: 110, slot: 'rightTrigger', action: 'Action12', label: 'R2', orient: 'v', fillFrom: 'bottom' },
        r1:         { anchor: 'tr', x: 30,  y: 135, w: 150, h: 46,  action: 'Action6',  label: 'R1', shape: 'round-rect' },
        // ABXY: straight diamond centred on R1's x (tr-x 105), ±62 between buttons
        y:          { anchor: 'tr', x: 105, y: 238, r: 36,  action: 'Action4', label: 'Y', accent: 'warning' },
        x:          { anchor: 'tr', x: 167, y: 300, r: 36,  action: 'Action3', label: 'X', accent: 'info'    },
        b:          { anchor: 'tr', x: 43,  y: 300, r: 36,  action: 'Action2', label: 'B', accent: 'danger'  },
        a:          { anchor: 'tr', x: 105, y: 362, r: 36,  action: 'Action1', label: 'A', accent: 'success' },
        rightStick: { anchor: 'br', x: 165, y: 95, r: 82,  slot: 'rightAnalog' },
        r3:         { anchor: 'br', x: 340, y: 55,  r: 32,  action: 'Action10', label: 'R3' },

        // ── center ────────────────────────────────────────────────────────
        select:     { anchor: 'bc', x: -105, y: 90, w: 90,  h: 68,  action: 'Action7', label: 'SEL',   shape: 'round-rect' },
        start:      { anchor: 'bc', x: 15,   y: 90, w: 90,  h: 68,  action: 'Action8', label: 'START', shape: 'round-rect' },
    };

    constructor(props = {}) {
        super(props);
        this.isInteractive = props.isInteractive ?? true;
        this.width  = props.width  ?? (this._ui ? this._ui._width  : 800);
        this.height = props.height ?? (this._ui ? this._ui._height : 600);

        // true -> L2/R2 are analog strips; false -> momentary buttons on Action11/12.
        this.analogTriggers = props.analogTriggers ?? false;

        this._configOverrides = props.controls ?? {};
        this.children = [];
        this._built = false;
    }

    // Called by the makeGamepad factory once this._ui is set.
    _build() {
        if (this._built) return;
        this._built = true;

        if (this._ui && this._ui.input.setDigitalTriggers) {
            this._ui.input.setDigitalTriggers(!this.analogTriggers);
        }

        // Uniform fit of the design space into the component, centered.
        const DW = ActionUIGamepad.DESIGN_W, DH = ActionUIGamepad.DESIGN_H;
        this._scale = Math.min(this.width / DW, this.height / DH);
        this._offX = this.x + (this.width  - DW * this._scale) / 2;
        this._offY = this.y + (this.height - DH * this._scale) / 2;

        for (const key of Object.keys(ActionUIGamepad.DEFAULT_LAYOUT)) {
            const ov = this._configOverrides[key];
            if (ov === false) continue;
            const cfg = Object.assign({}, ActionUIGamepad.DEFAULT_LAYOUT[key],
                (ov && typeof ov === 'object') ? ov : {});
            const comp = this._makeControl(key, cfg);
            if (comp) this._addChild(comp);
        }
    }

    // Design-space (x,y,w,h) -> absolute screen (x,y,w,h), applying anchor + scale.
    // x,y in the returned rect are the TOP-LEFT of the control.
    _rect(cfg, w, h) {
        const DW = ActionUIGamepad.DESIGN_W, DH = ActionUIGamepad.DESIGN_H;
        const nx = cfg.dx || 0, ny = cfg.dy || 0;   // optional per-control nudge
        let dx, dy;
        switch (cfg.anchor) {
            case 'tr': dx = DW - cfg.x - w; dy = cfg.y;           break;
            case 'bl': dx = cfg.x;          dy = DH - cfg.y - h;  break;
            case 'br': dx = DW - cfg.x - w; dy = DH - cfg.y - h;  break;
            case 'bc': dx = DW / 2 + cfg.x; dy = DH - cfg.y - h;  break;
            default:   dx = cfg.x;          dy = cfg.y;           break;   // 'tl'
        }
        return {
            x: this._offX + (dx + nx) * this._scale,
            y: this._offY + (dy + ny) * this._scale,
            w: w * this._scale,
            h: h * this._scale,
        };
    }

    _makeControl(key, cfg) {
        const isStick = (key === 'leftStick' || key === 'rightStick');
        const isTrig  = (key === 'l2' || key === 'r2');
        const isDpad  = (key === 'dpad');

        // Gamepad controls are pointer/touch only — they must not become ActionUI
        // keyboard-nav focus targets (the dev's other UI still gets keynav).
        const common = { isInteractive: false };

        if (isStick) {
            const floating = (cfg.mode ?? 'fixed') === 'floating';
            const base = cfg.r;
            // floating needs slack around the base to move it; fixed doesn't
            const boxD = base * (floating ? 3.2 : 2.2);
            const rc = this._rect({ ...cfg, x: cfg.x - boxD / 2, y: cfg.y - boxD / 2 }, boxD, boxD);
            return new ActionUIVirtualStick({
                ...common,
                x: rc.x, y: rc.y, width: rc.w, height: rc.h,
                baseRadius: base * this._scale, knobRadius: base * this._scale * 0.44,
                slot: cfg.slot, mode: floating ? 'floating' : 'fixed',
                deadzone: cfg.deadzone ?? 0.12,
                hideWhenIdle: cfg.hideWhenIdle ?? false,
            });
        }

        if (isTrig) {
            const rc = this._rect(cfg, cfg.w, cfg.h);
            if (this.analogTriggers) {
                return new ActionUITriggerButton({
                    ...common,
                    x: rc.x, y: rc.y, width: rc.w, height: rc.h, slot: cfg.slot,
                    orient: cfg.orient ?? (rc.w >= rc.h ? 'h' : 'v'),
                    fillFrom: cfg.fillFrom,
                    action: cfg.action, label: cfg.label,
                });
            }
            return new ActionUIGamepadButton({
                ...common,
                x: rc.x, y: rc.y, width: rc.w, height: rc.h, shape: 'round-rect',
                action: cfg.action, label: cfg.label,
            });
        }

        if (isDpad) return this._makeDpad(cfg);

        if (cfg.shape === 'round-rect') {
            const rc = this._rect(cfg, cfg.w, cfg.h);
            return new ActionUIGamepadButton({
                ...common,
                x: rc.x, y: rc.y, width: rc.w, height: rc.h, shape: 'round-rect',
                action: cfg.action, label: cfg.label, accent: cfg.accent ?? null,
            });
        }
        // circle: cfg.x/cfg.y is its CENTRE
        const d = cfg.r * 2;
        const rc = this._rect({ ...cfg, x: cfg.x - cfg.r, y: cfg.y - cfg.r }, d, d);
        return new ActionUIGamepadButton({
            ...common,
            x: rc.x, y: rc.y, width: rc.w, height: rc.h, shape: 'circle',
            action: cfg.action, label: cfg.label, accent: cfg.accent ?? null,
        });
    }

    // The whole cross is one component doing its own per-arm hit-testing, so a
    // held finger can roll between directions (and onto two at once). cfg.x/cfg.y
    // is the d-pad CENTRE in design space; cfg.w is the full cross extent.
    _makeDpad(cfg) {
        const d = cfg.w;
        const rc = this._rect({ ...cfg, x: cfg.x - d / 2, y: cfg.y - d / 2 }, d, d);
        const s = rc.w, seg = s / 3;
        const cx = rc.x + s / 2, cy = rc.y + s / 2;

        const g = new ActionUIComponent({ x: rc.x, y: rc.y, width: s, height: s });
        g.isInteractive = false;   // pointer/touch only; not a keynav target
        g._arms = [
            { action: 'DirUp',    label: '▲', x: cx - seg / 2,   y: cy - seg * 1.5 },
            { action: 'DirDown',  label: '▼', x: cx - seg / 2,   y: cy + seg * 0.5 },
            { action: 'DirLeft',  label: '◀', x: cx - seg * 1.5, y: cy - seg / 2   },
            { action: 'DirRight', label: '▶', x: cx + seg * 0.5, y: cy - seg / 2   },
        ].map(a => ({ ...a, w: seg, h: seg }));
        g._activeId = null;
        g._held = new Set();

        const armAt = (px, py) => g._arms.filter(a =>
            px >= a.x && px <= a.x + a.w && py >= a.y && py <= a.y + a.h);

        const apply = (px, py) => {
            const now = new Set(armAt(px, py).map(a => a.action));
            const input = g._ui && g._ui.input;
            for (const a of g._arms) {
                const on = now.has(a.action);
                if (on && !g._held.has(a.action)) { g._held.add(a.action); input && input.setVirtualButton(a.action, true); }
                if (!on && g._held.has(a.action)) { g._held.delete(a.action); input && input.setVirtualButton(a.action, false); }
            }
        };
        const clear = () => {
            const input = g._ui && g._ui.input;
            for (const act of g._held) input && input.setVirtualButton(act, false);
            g._held.clear();
        };
        const begin = (id, px, py) => {
            if (g._activeId !== null) return;
            if (px < g.x || px > g.x + g.width || py < g.y || py > g.y + g.height) return;
            g._activeId = id;
            g._pointerCaptured = (id === 'mouse');
            g._touchCaptured   = (id !== 'mouse');
            apply(px, py);
        };
        const end = () => {
            g._activeId = null;
            g._pointerCaptured = false;
            g._touchCaptured = false;
            clear();
        };

        g.onPointerDown = (px, py) => begin('mouse', px, py);
        g.onPointerMove = (px, py) => { if (g._activeId === 'mouse') apply(px, py); };
        g.onPointerUp   = ()       => { if (g._activeId === 'mouse') end(); };
        g.onTouchDown   = (id, px, py) => begin(id, px, py);
        g.onTouchMove   = (id, px, py) => { if (g._activeId === id) apply(px, py); };
        g.onTouchUp     = (id)     => { if (g._activeId === id) end(); };

        g._pressT = 0;
        g._onUpdate = (dt) => {
            g._pressT = ActionUIDrawUtils.lerp(g._pressT, g._activeId !== null ? 1 : 0,
                dt / g.theme.animDurationFast);
        };

        g.draw = (ctx) => {
            if (!g.visible) return;
            const t = g.theme;
            const r = t.radiusSm ?? 4;
            const input = g._ui && g._ui.input;
            for (const a of g._arms) {
                // lit from finger here OR a physical d-pad / stick-as-direction
                const on = g._held.has(a.action) ||
                    (input && input.isKeyPressed && input.isKeyPressed(a.action));
                const col = on ? t.colorPrimary : t.withAlpha(t.colorSurfaceRaised, 0.55);
                ActionUIDrawUtils.fillRoundRect(ctx, a.x, a.y, a.w, a.h, r, col);
                ActionUIDrawUtils.strokeRoundRect(ctx, a.x, a.y, a.w, a.h, r, t.withAlpha(t.colorBorder, 0.9), 2);
                ActionUIDrawUtils.text(ctx, a.label, a.x + a.w / 2, a.y + a.h / 2,
                    t.font(t.fontSizeSm, t.fontWeightBold), t.withAlpha('#ffffff', 0.85), 'center', 'middle');
            }
        };

        return g;
    }

    _addChild(comp) {
        comp._ui = this._ui;
        comp._parent = this;
        this.children.push(comp);
        if (this._ui && !this._ui._components.includes(comp)) this._ui.add(comp);
    }

    // Children are registered with ActionUI and draw themselves.
    draw(ctx) {}

    // Reposition + relayout (e.g. after a resolution change).
    setBounds(x, y, w, h) {
        this.x = x; this.y = y; this.width = w; this.height = h;
        for (const c of this.children) this._ui && this._ui.remove(c.id);
        this.children = [];
        this._built = false;
        this._build();
    }
}
