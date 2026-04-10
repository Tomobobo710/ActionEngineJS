/******************************************************************************
 * ActionUITheme — design tokens and canvas drawing utilities
 * All visual decisions live here.
 ******************************************************************************/

// ─────────────────────────────────────────────────────────────────────────────
// ActionUITheme — design tokens
// ─────────────────────────────────────────────────────────────────────────────
class ActionUITheme {
    constructor(overrides = {}) {
        // Core palette
        this.colorBackground        = '#1a1a2e';
        this.colorSurface           = '#16213e';
        this.colorSurfaceRaised     = '#0f3460';
        this.colorSurfaceOverlay    = 'rgba(15,52,96,0.97)';
        this.colorPrimary           = '#e94560';
        this.colorPrimaryHover      = '#ff6b81';
        this.colorPrimaryActive     = '#c73652';
        this.colorPrimaryText       = '#ffffff';
        this.colorSecondary         = '#533483';
        this.colorAccent            = '#00d4ff';
        this.colorAccentDim         = 'rgba(0,212,255,0.18)';
        this.colorSuccess           = '#2ecc71';
        this.colorWarning           = '#f39c12';
        this.colorDanger            = '#e74c3c';
        this.colorInfo              = '#3498db';
        this.colorDisabled          = '#4a4a6a';
        this.colorDisabledText      = '#7a7a9a';
        this.colorText              = '#e8e8f0';
        this.colorTextMuted         = '#9898b8';
        this.colorTextInverse       = '#1a1a2e';
        this.colorBorder            = 'rgba(255,255,255,0.12)';
        this.colorBorderFocus       = '#00d4ff';
        this.colorKbFocusActive     = '#f0c040';  // yellow for active keyboard focus
        this.colorShadow            = 'rgba(0,0,0,0.55)';
        this.colorScrollTrack       = 'rgba(255,255,255,0.06)';
        this.colorScrollThumb       = 'rgba(255,255,255,0.22)';
        this.colorScrollThumbHover  = 'rgba(255,255,255,0.40)';

        // Typography
        this.fontFamily             = 'system-ui, -apple-system, Arial, sans-serif';
        this.fontFamilyMono         = 'ui-monospace, Consolas, monospace';
        this.fontSizeXs             = 10;
        this.fontSizeSm             = 12;
        this.fontSizeMd             = 14;
        this.fontSizeLg             = 16;
        this.fontSizeXl             = 20;
        this.fontSizeXxl            = 28;
        this.fontSizeDisplay        = 40;
        this.fontWeightNormal       = '400';
        this.fontWeightMedium       = '500';
        this.fontWeightBold         = '700';

        // Spacing
        this.spacingXs              = 4;
        this.spacingSm              = 8;
        this.spacingMd              = 12;
        this.spacingLg              = 16;
        this.spacingXl              = 24;
        this.spacingXxl             = 32;

        // Shape
        this.radiusSm               = 4;
        this.radiusMd               = 8;
        this.radiusLg               = 12;
        this.radiusXl               = 20;
        this.radiusPill             = 999;
        this.radiusCircle           = '50%';

        // Motion
        this.animDurationFast       = 0.10;
        this.animDurationNormal     = 0.18;
        this.animDurationSlow       = 0.32;

        // Component defaults
        this.buttonHeight           = 36;
        this.buttonPaddingH         = 16;
        this.inputHeight            = 36;
        this.checkboxSize           = 18;
        this.sliderTrackHeight      = 6;
        this.sliderThumbSize        = 18;
        this.progressBarHeight      = 10;
        this.toggleWidth            = 46;
        this.toggleHeight           = 26;
        this.tabHeight              = 38;
        this.scrollbarWidth         = 8;
        this.tooltipMaxWidth        = 220;
        this.notificationWidth      = 280;
        this.notificationDuration   = 3.2;
        this.modalOverlayColor      = 'rgba(0,0,0,0.72)';
        this.panelPadding           = 16;
        this.shadowBlur             = 18;
        this.shadowOffsetY          = 4;

        Object.assign(this, overrides);
    }

    // Helper — resolve semantic color names
    resolveColor(name) {
        const map = {
            primary:   this.colorPrimary,
            secondary: this.colorSecondary,
            accent:    this.colorAccent,
            success:   this.colorSuccess,
            warning:   this.colorWarning,
            danger:    this.colorDanger,
            info:      this.colorInfo,
            surface:   this.colorSurface,
            text:      this.colorText,
            muted:     this.colorTextMuted,
        };
        return map[name] || name;
    }

    // Produce a font string
    font(size, weight) {
        return `${weight || this.fontWeightNormal} ${size}px ${this.fontFamily}`;
    }

    fontMono(size, weight) {
        return `${weight || this.fontWeightNormal} ${size}px ${this.fontFamilyMono}`;
    }

    // Convenience gradient builders
    linearGradientV(ctx, x, y, h, topColor, bottomColor) {
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, topColor);
        g.addColorStop(1, bottomColor);
        return g;
    }

    radialGlow(ctx, cx, cy, r, color) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        return g;
    }

    // Parse and alpha-modify a color (only works on rgb/hex forms)
    withAlpha(hexOrRgba, alpha) {
        if (hexOrRgba.startsWith('rgba')) {
            return hexOrRgba.replace(/[\d.]+\)$/, `${alpha})`);
        }
        if (hexOrRgba.startsWith('rgb(')) {
            return hexOrRgba.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
        }
        if (hexOrRgba.startsWith('#')) {
            const hex = hexOrRgba.slice(1);
            const full = hex.length === 3
                ? hex.split('').map(c => c + c).join('')
                : hex;
            const r = parseInt(full.slice(0,2), 16);
            const g = parseInt(full.slice(2,4), 16);
            const b = parseInt(full.slice(4,6), 16);
            return `rgba(${r},${g},${b},${alpha})`;
        }
        return hexOrRgba;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// ActionUIDrawUtils — stateless canvas helpers
// ─────────────────────────────────────────────────────────────────────────────
class ActionUIDrawUtils {

    static roundRect(ctx, x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    static fillRoundRect(ctx, x, y, w, h, r, fill) {
        ctx.save();
        ActionUIDrawUtils.roundRect(ctx, x, y, w, h, r);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.restore();
    }

    static strokeRoundRect(ctx, x, y, w, h, r, stroke, lineWidth = 1) {
        ctx.save();
        ActionUIDrawUtils.roundRect(ctx, x, y, w, h, r);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
        ctx.restore();
    }

    static shadow(ctx, color, blur, offsetX = 0, offsetY = 0) {
        ctx.shadowColor   = color;
        ctx.shadowBlur    = blur;
        ctx.shadowOffsetX = offsetX;
        ctx.shadowOffsetY = offsetY;
    }

    static clearShadow(ctx) {
        ctx.shadowColor   = 'transparent';
        ctx.shadowBlur    = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    static clipRoundRect(ctx, x, y, w, h, r) {
        ActionUIDrawUtils.roundRect(ctx, x, y, w, h, r);
        ctx.clip();
    }

    static text(ctx, str, x, y, font, color, align = 'left', baseline = 'alphabetic') {
        ctx.save();
        ctx.font         = font;
        ctx.fillStyle    = color;
        ctx.textAlign    = align;
        ctx.textBaseline = baseline;
        ctx.fillText(str, x, y);
        ctx.restore();
    }

    static textMeasure(ctx, str, font) {
        ctx.font = font;
        return ctx.measureText(str);
    }

    static textWrapped(ctx, str, x, y, maxWidth, lineHeight, font, color) {
        ctx.save();
        ctx.font         = font;
        ctx.fillStyle    = color;
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'top';
        const words = str.split(' ');
        let line = '';
        let cy = y;
        for (const word of words) {
            const test = line ? line + ' ' + word : word;
            if (ctx.measureText(test).width > maxWidth && line) {
                ctx.fillText(line, x, cy);
                line = word;
                cy  += lineHeight;
            } else {
                line = test;
            }
        }
        if (line) ctx.fillText(line, x, cy);
        ctx.restore();
        return cy;
    }

    static circle(ctx, cx, cy, r, fill, stroke, lineWidth = 1) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        if (fill)   { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
        ctx.restore();
    }

    static line(ctx, x1, y1, x2, y2, color, lineWidth = 1) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth   = lineWidth;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
    }

    // Draw a checkmark path (fitted inside a box at x,y,size)
    static checkmark(ctx, x, y, size, color, lineWidth = 2) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth   = lineWidth;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.beginPath();
        ctx.moveTo(x + size * 0.15, y + size * 0.5);
        ctx.lineTo(x + size * 0.40, y + size * 0.75);
        ctx.lineTo(x + size * 0.85, y + size * 0.25);
        ctx.stroke();
        ctx.restore();
    }

    // Lerp a number
    static lerp(a, b, t) { return a + (b - a) * Math.min(1, Math.max(0, t)); }

    // Ease out cubic
    static easeOut(t) { return 1 - Math.pow(1 - t, 3); }

    // Ease in-out
    static easeInOut(t) { return t < 0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
}
