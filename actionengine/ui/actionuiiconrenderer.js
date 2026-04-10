/******************************************************************************
 * ActionUIIconRenderer — draws named vector icons onto a canvas 2d context
 * All icons are drawn into a [0,0,size,size] bounding box
 ******************************************************************************/

class ActionUIIconRenderer {
    static draw(ctx, name, x, y, size, color) {
        const fn = ActionUIIconRenderer._icons[name];
        if (!fn) return;
        ctx.save();
        ctx.translate(x, y);
        ctx.strokeStyle = color;
        ctx.fillStyle   = color;
        ctx.lineWidth   = Math.max(1.5, size * 0.09);
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        fn(ctx, size);
        ctx.restore();
    }

    static _icons = {
        close: (ctx, s) => {
            const m = s * 0.22;
            ctx.beginPath();
            ctx.moveTo(m, m); ctx.lineTo(s-m, s-m);
            ctx.moveTo(s-m, m); ctx.lineTo(m, s-m);
            ctx.stroke();
        },
        check: (ctx, s) => {
            ctx.beginPath();
            ctx.moveTo(s*0.12, s*0.52);
            ctx.lineTo(s*0.42, s*0.78);
            ctx.lineTo(s*0.88, s*0.22);
            ctx.stroke();
        },
        plus: (ctx, s) => {
            ctx.beginPath();
            ctx.moveTo(s/2, s*0.15); ctx.lineTo(s/2, s*0.85);
            ctx.moveTo(s*0.15, s/2); ctx.lineTo(s*0.85, s/2);
            ctx.stroke();
        },
        minus: (ctx, s) => {
            ctx.beginPath();
            ctx.moveTo(s*0.15, s/2); ctx.lineTo(s*0.85, s/2);
            ctx.stroke();
        },
        arrow_right: (ctx, s) => {
            const m = s * 0.28;
            ctx.beginPath();
            ctx.moveTo(m, s/2); ctx.lineTo(s-m, s/2);
            ctx.moveTo(s*0.55, s*0.3); ctx.lineTo(s-m, s/2); ctx.lineTo(s*0.55, s*0.7);
            ctx.stroke();
        },
        arrow_left: (ctx, s) => {
            const m = s * 0.28;
            ctx.beginPath();
            ctx.moveTo(s-m, s/2); ctx.lineTo(m, s/2);
            ctx.moveTo(s*0.45, s*0.3); ctx.lineTo(m, s/2); ctx.lineTo(s*0.45, s*0.7);
            ctx.stroke();
        },
        arrow_up: (ctx, s) => {
            const m = s * 0.28;
            ctx.beginPath();
            ctx.moveTo(s/2, s-m); ctx.lineTo(s/2, m);
            ctx.moveTo(s*0.3, s*0.45); ctx.lineTo(s/2, m); ctx.lineTo(s*0.7, s*0.45);
            ctx.stroke();
        },
        arrow_down: (ctx, s) => {
            const m = s * 0.28;
            ctx.beginPath();
            ctx.moveTo(s/2, m); ctx.lineTo(s/2, s-m);
            ctx.moveTo(s*0.3, s*0.55); ctx.lineTo(s/2, s-m); ctx.lineTo(s*0.7, s*0.55);
            ctx.stroke();
        },
        settings: (ctx, s) => {
            const cx = s/2, cy = s/2, r = s*0.18, R = s*0.36, teeth = 8;
            ctx.beginPath();
            for (let i = 0; i < teeth; i++) {
                const a0 = (Math.PI*2/teeth)*i - 0.3;
                const a1 = a0 + 0.3, a2 = a0 + (Math.PI*2/teeth - 0.3);
                ctx.lineTo(cx + R*Math.cos(a0), cy + R*Math.sin(a0));
                ctx.lineTo(cx + (R+s*0.08)*Math.cos(a1), cy + (R+s*0.08)*Math.sin(a1));
                ctx.lineTo(cx + R*Math.cos(a2), cy + R*Math.sin(a2));
            }
            ctx.closePath();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI*2);
            ctx.stroke();
        },
        info: (ctx, s) => {
            ctx.beginPath();
            ctx.arc(s/2, s/2, s*0.42, 0, Math.PI*2);
            ctx.stroke();
            ActionUIDrawUtils.circle(ctx, s/2, s*0.32, s*0.07, ctx.fillStyle);
            ctx.beginPath();
            ctx.moveTo(s/2, s*0.44); ctx.lineTo(s/2, s*0.70);
            ctx.stroke();
        },
        warning: (ctx, s) => {
            ctx.beginPath();
            ctx.moveTo(s/2, s*0.1);
            ctx.lineTo(s*0.92, s*0.88);
            ctx.lineTo(s*0.08, s*0.88);
            ctx.closePath();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(s/2, s*0.38); ctx.lineTo(s/2, s*0.60);
            ctx.stroke();
            ActionUIDrawUtils.circle(ctx, s/2, s*0.72, s*0.06, ctx.fillStyle);
        },
        star: (ctx, s) => {
            const pts = 5, cx = s/2, cy = s/2, ro = s*0.44, ri = s*0.18;
            ctx.beginPath();
            for (let i = 0; i < pts*2; i++) {
                const a = (Math.PI/pts)*i - Math.PI/2;
                const r = i%2===0 ? ro : ri;
                i===0 ? ctx.moveTo(cx+r*Math.cos(a), cy+r*Math.sin(a))
                      : ctx.lineTo(cx+r*Math.cos(a), cy+r*Math.sin(a));
            }
            ctx.closePath();
            ctx.stroke();
        },
        heart: (ctx, s) => {
            ctx.beginPath();
            ctx.moveTo(s/2, s*0.78);
            ctx.bezierCurveTo(s*0.05, s*0.50, s*0.05, s*0.20, s/2, s*0.36);
            ctx.bezierCurveTo(s*0.95, s*0.20, s*0.95, s*0.50, s/2, s*0.78);
            ctx.stroke();
        },
        search: (ctx, s) => {
            ctx.beginPath();
            ctx.arc(s*0.42, s*0.42, s*0.28, 0, Math.PI*2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(s*0.62, s*0.62); ctx.lineTo(s*0.86, s*0.86);
            ctx.stroke();
        },
        menu: (ctx, s) => {
            const m = s*0.18;
            [s*0.28, s/2, s*0.72].forEach(y => {
                ctx.beginPath();
                ctx.moveTo(m, y); ctx.lineTo(s-m, y);
                ctx.stroke();
            });
        },
        volume: (ctx, s) => {
            ctx.beginPath();
            ctx.moveTo(s*0.12, s*0.38);
            ctx.lineTo(s*0.12, s*0.62);
            ctx.lineTo(s*0.36, s*0.62);
            ctx.lineTo(s*0.62, s*0.82);
            ctx.lineTo(s*0.62, s*0.18);
            ctx.lineTo(s*0.36, s*0.38);
            ctx.closePath();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(s*0.62, s/2, s*0.2, -Math.PI/4, Math.PI/4);
            ctx.stroke();
        },
        play: (ctx, s) => {
            ctx.beginPath();
            ctx.moveTo(s*0.25, s*0.18);
            ctx.lineTo(s*0.82, s/2);
            ctx.lineTo(s*0.25, s*0.82);
            ctx.closePath();
            ctx.fill();
        },
        pause: (ctx, s) => {
            ActionUIDrawUtils.fillRoundRect(ctx, s*0.22, s*0.18, s*0.2, s*0.64, 2, ctx.fillStyle);
            ActionUIDrawUtils.fillRoundRect(ctx, s*0.58, s*0.18, s*0.2, s*0.64, 2, ctx.fillStyle);
        },
        refresh: (ctx, s) => {
            ctx.beginPath();
            ctx.arc(s/2, s/2, s*0.32, -Math.PI*0.9, Math.PI*0.6);
            ctx.stroke();
            const ax = s/2 + s*0.32*Math.cos(Math.PI*0.6);
            const ay = s/2 + s*0.32*Math.sin(Math.PI*0.6);
            ctx.beginPath();
            ctx.moveTo(ax - s*0.12, ay - s*0.04);
            ctx.lineTo(ax, ay);
            ctx.lineTo(ax + s*0.04, ay - s*0.14);
            ctx.stroke();
        },
        trash: (ctx, s) => {
            ctx.beginPath();
            ctx.moveTo(s*0.15, s*0.28); ctx.lineTo(s*0.85, s*0.28);
            ctx.stroke();
            ActionUIDrawUtils.roundRect(ctx, s*0.24, s*0.28, s*0.52, s*0.58, 3);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(s*0.38, s*0.18); ctx.lineTo(s*0.62, s*0.18);
            ctx.stroke();
            [s*0.38, s/2, s*0.62].forEach(x => {
                ctx.beginPath();
                ctx.moveTo(x, s*0.40); ctx.lineTo(x, s*0.74);
                ctx.stroke();
            });
        },
        lock: (ctx, s) => {
            ActionUIDrawUtils.roundRect(ctx, s*0.22, s*0.44, s*0.56, s*0.44, s*0.06);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(s/2, s*0.38, s*0.2, Math.PI, 0);
            ctx.stroke();
            ActionUIDrawUtils.circle(ctx, s/2, s*0.66, s*0.07, ctx.fillStyle);
        },
    };

    // Register custom icons at runtime
    static register(name, drawFn) {
        ActionUIIconRenderer._icons[name] = drawFn;
    }
}
