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
        this.colorGhostBg           = '#2a2a4a';
        this.colorGhostBorder       = '#4a4a6a';

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

// ─────────────────────────────────────────────────────────────────────────────
// Theme Presets
// ─────────────────────────────────────────────────────────────────────────────
const ACTION_UI_THEME_PRESETS = {
    dark: {
        colorBackground: '#1a1a2e', colorSurface: '#16213e', colorSurfaceRaised: '#0f3460',
        colorSurfaceOverlay: 'rgba(15,52,96,0.97)', colorPrimary: '#7c6aff', colorPrimaryHover: '#ff6b81',
        colorPrimaryActive: '#c73652', colorPrimaryText: '#ffffff', colorSecondary: '#533483',
        colorAccent: '#00d4ff', colorAccentDim: 'rgba(0,212,255,0.18)', colorSuccess: '#2ecc71',
        colorWarning: '#f39c12', colorDanger: '#e74c3c', colorInfo: '#3498db', colorDisabled: '#4a4a6a',
        colorDisabledText: '#7a7a9a', colorText: '#e8e8f0', colorTextMuted: '#9898b8',
        colorTextInverse: '#1a1a2e', colorBorder: 'rgba(255,255,255,0.12)', colorBorderFocus: '#00d4ff',
        colorKbFocusActive: '#f0c040', colorShadow: 'rgba(0,0,0,0.55)', colorScrollTrack: 'rgba(255,255,255,0.06)',
        colorScrollThumb: 'rgba(255,255,255,0.22)', colorScrollThumbHover: 'rgba(255,255,255,0.40)',
        colorGhostBg: '#2a2a4a', colorGhostBorder: '#4a4a6a',
        modalOverlayColor: 'rgba(0,0,0,0.72)'
    },
    light: {
        colorBackground: '#f8f9fa', colorSurface: '#ffffff', colorSurfaceRaised: '#f0f2f5',
        colorSurfaceOverlay: 'rgba(240,242,245,0.97)', colorPrimary: '#2563eb', colorPrimaryHover: '#3b82f6',
        colorPrimaryActive: '#1e40af', colorPrimaryText: '#ffffff', colorSecondary: '#218bb8',
        colorAccent: '#06b6d4', colorAccentDim: 'rgba(6,182,212,0.18)', colorSuccess: '#10b981',
        colorWarning: '#f59e0b', colorDanger: '#ef4444', colorInfo: '#3b82f6', colorDisabled: '#d1d5db',
        colorDisabledText: '#9ca3af', colorText: '#1f2937', colorTextMuted: '#6b7280',
        colorTextInverse: '#ffffff', colorBorder: 'rgba(0,0,0,0.12)', colorBorderFocus: '#06b6d4',
        colorKbFocusActive: '#fbbf24', colorShadow: 'rgba(0,0,0,0.10)', colorScrollTrack: 'rgba(0,0,0,0.06)',
        colorScrollThumb: 'rgba(0,0,0,0.20)', colorScrollThumbHover: 'rgba(0,0,0,0.35)',
        colorGhostBg: '#f0f0f0', colorGhostBorder: '#cccccc',
        modalOverlayColor: 'rgba(0,0,0,0.50)'
    },
    neon: {
        colorBackground: '#0a0e27', colorSurface: '#141829', colorSurfaceRaised: '#1e2749',
        colorSurfaceOverlay: 'rgba(30,39,73,0.97)', colorPrimary: '#ff006e', colorPrimaryHover: '#ff1a7f',
        colorPrimaryActive: '#e00055', colorPrimaryText: '#ffffff', colorSecondary: '#7c3aed',
        colorAccent: '#00f5ff', colorAccentDim: 'rgba(0,245,255,0.18)', colorSuccess: '#39ff14',
        colorWarning: '#ffbe0b', colorDanger: '#ff4757', colorInfo: '#00d4ff', colorDisabled: '#475569',
        colorDisabledText: '#64748b', colorText: '#f0f0ff', colorTextMuted: '#b0b0d0',
        colorTextInverse: '#0a0e27', colorBorder: 'rgba(255,0,110,0.20)', colorBorderFocus: '#00f5ff',
        colorKbFocusActive: '#ffbe0b', colorShadow: 'rgba(255,0,110,0.40)', colorScrollTrack: 'rgba(255,0,110,0.08)',
        colorScrollThumb: 'rgba(0,245,255,0.30)', colorScrollThumbHover: 'rgba(0,245,255,0.50)',
        colorGhostBg: '#2d0a1f', colorGhostBorder: '#7d2a6f',
        modalOverlayColor: 'rgba(10,14,39,0.80)'
    },
    ocean: {
        colorBackground: '#0c1f2d', colorSurface: '#0f2a3d', colorSurfaceRaised: '#184860',
        colorSurfaceOverlay: 'rgba(24,72,96,0.97)', colorPrimary: '#0ea5e9', colorPrimaryHover: '#38bdf8',
        colorPrimaryActive: '#0284c7', colorPrimaryText: '#ffffff', colorSecondary: '#0369a1',
        colorAccent: '#06b6d4', colorAccentDim: 'rgba(6,182,212,0.18)', colorSuccess: '#14b8a6',
        colorWarning: '#f97316', colorDanger: '#ef4444', colorInfo: '#0ea5e9', colorDisabled: '#334155',
        colorDisabledText: '#64748b', colorText: '#e0f2fe', colorTextMuted: '#7dd3fc',
        colorTextInverse: '#0c1f2d', colorBorder: 'rgba(6,182,212,0.20)', colorBorderFocus: '#06b6d4',
        colorKbFocusActive: '#fbbf24', colorShadow: 'rgba(15,23,42,0.55)', colorScrollTrack: 'rgba(6,182,212,0.06)',
        colorScrollThumb: 'rgba(6,182,212,0.25)', colorScrollThumbHover: 'rgba(6,182,212,0.40)',
        colorGhostBg: '#0a1f3f', colorGhostBorder: '#0e5a7f',
        modalOverlayColor: 'rgba(12,31,45,0.75)'
    },
    forest: {
        colorBackground: '#1a2f1f', colorSurface: '#2d3d34', colorSurfaceRaised: '#3d4f46',
        colorSurfaceOverlay: 'rgba(61,79,70,0.97)', colorPrimary: '#10b981', colorPrimaryHover: '#34d399',
        colorPrimaryActive: '#059669', colorPrimaryText: '#ffffff', colorSecondary: '#047857',
        colorAccent: '#8b5cf6', colorAccentDim: 'rgba(139,92,246,0.18)', colorSuccess: '#6ee7b7',
        colorWarning: '#fbbf24', colorDanger: '#f87171', colorInfo: '#8b5cf6', colorDisabled: '#4b5563',
        colorDisabledText: '#9ca3af', colorText: '#ecfdf5', colorTextMuted: '#a7f3d0',
        colorTextInverse: '#1a2f1f', colorBorder: 'rgba(16,185,129,0.20)', colorBorderFocus: '#6ee7b7',
        colorKbFocusActive: '#fbbf24', colorShadow: 'rgba(0,0,0,0.50)', colorScrollTrack: 'rgba(16,185,129,0.08)',
        colorScrollThumb: 'rgba(139,92,246,0.25)', colorScrollThumbHover: 'rgba(139,92,246,0.40)',
        colorGhostBg: '#1a3a2f', colorGhostBorder: '#2d6a5a',
        modalOverlayColor: 'rgba(26,47,31,0.75)'
    }
};
