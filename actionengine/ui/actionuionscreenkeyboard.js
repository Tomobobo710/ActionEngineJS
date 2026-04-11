/******************************************************************************
 * ActionUIOnScreenKeyboard — QWERTY keyboard modal for gamepad text input
 * Fully navigable with keynav (Dir keys + Action1 to type)
 ******************************************************************************/

class ActionUIOnScreenKeyboard extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.isInteractive = true;
        this.target        = props.target || null;  // ActionUITextInput to type into
        this._showT        = 0;
        this._showing      = false;
        this._shift        = false;
        this._caps         = false;
        this._kbRow        = 0;
        this._kbCol        = 0;
        this._pressedT     = 0;  // key press animation timer
        this._pressedRow   = -1;
        this._pressedCol   = -1;
        this._hoverRow     = -1;
        this._hoverCol     = -1;
        this.zIndex        = 200;

        // QWERTY layout: each row is an array of keys
        // Keys can be: { label, value } or { label, value, width } for special keys
        this._rows = [
            [
                { label: '1', value: '1' }, { label: '2', value: '2' }, { label: '3', value: '3' },
                { label: '4', value: '4' }, { label: '5', value: '5' }, { label: '6', value: '6' },
                { label: '7', value: '7' }, { label: '8', value: '8' }, { label: '9', value: '9' },
                { label: '0', value: '0' }, { label: '←', value: 'backspace', width: 1.5 },
            ],
            [
                { label: 'q', value: 'q' }, { label: 'w', value: 'w' }, { label: 'e', value: 'e' },
                { label: 'r', value: 'r' }, { label: 't', value: 't' }, { label: 'y', value: 'y' },
                { label: 'u', value: 'u' }, { label: 'i', value: 'i' }, { label: 'o', value: 'o' },
                { label: 'p', value: 'p' },
            ],
            [
                { label: 'a', value: 'a' }, { label: 's', value: 's' }, { label: 'd', value: 'd' },
                { label: 'f', value: 'f' }, { label: 'g', value: 'g' }, { label: 'h', value: 'h' },
                { label: 'j', value: 'j' }, { label: 'k', value: 'k' }, { label: 'l', value: 'l' },
                { label: '⌫', value: 'delete', width: 1.5 },
            ],
            [
                { label: '⇧', value: 'shift', width: 1.5 },
                { label: 'z', value: 'z' }, { label: 'x', value: 'x' }, { label: 'c', value: 'c' },
                { label: 'v', value: 'v' }, { label: 'b', value: 'b' }, { label: 'n', value: 'n' },
                { label: 'm', value: 'm' },
                { label: '⇧', value: 'shift', width: 1.5 },
            ],
            [
                { label: '?123', value: 'symbols', width: 1.5 },
                { label: 'Space', value: ' ', width: 4 },
                { label: 'Enter', value: 'enter', width: 1.5 },
                { label: 'Done', value: 'done', width: 1.5 },
            ],
        ];

        // Symbols layout
        this._symbolRows = [
            [
                { label: '!', value: '!' }, { label: '@', value: '@' }, { label: '#', value: '#' },
                { label: '$', value: '$' }, { label: '%', value: '%' }, { label: '^', value: '^' },
                { label: '&', value: '&' }, { label: '*', value: '*' }, { label: '(', value: '(' },
                { label: ')', value: ')' }, { label: '←', value: 'backspace', width: 1.5 },
            ],
            [
                { label: '~', value: '~' }, { label: '`', value: '`' }, { label: '|', value: '|' },
                { label: '\\', value: '\\' }, { label: '{', value: '{' }, { label: '}', value: '}' },
                { label: '[', value: '[' }, { label: ']', value: ']' }, { label: ';', value: ';' },
                { label: ':', value: ':' },
            ],
            [
                { label: '"', value: '"' }, { label: '\'', value: '\'' }, { label: '<', value: '<' },
                { label: '>', value: '>' }, { label: ',', value: ',' }, { label: '.', value: '.' },
                { label: '?', value: '?' }, { label: '/', value: '/' }, { label: '_', value: '_' },
                { label: '⌫', value: 'delete', width: 1.5 },
            ],
            [
                { label: 'ABC', value: 'symbols', width: 1.5 },
                { label: '-', value: '-' }, { label: '+', value: '+' }, { label: '=', value: '=' },
                { label: '(', value: '(' }, { label: ')', value: ')' }, { label: '!', value: '!' },
                { label: '?', value: '?' },
                { label: '⇧', value: 'shift', width: 1.5 },
            ],
            [
                { label: '?123', value: 'symbols', width: 1.5 },
                { label: 'Space', value: ' ', width: 4 },
                { label: 'Enter', value: 'enter', width: 1.5 },
                { label: 'Done', value: 'done', width: 1.5 },
            ],
        ];

        // Compute layout metrics
        this._keyWidth = 42;
        this._keyHeight = 38;
        this._keyGap = 4;
        this._padding = 12;

        // Calculate total width/height
        this._computeSize();

        // Center on screen (800x600)
        this.x = (800 - this._totalWidth) / 2;
        this.y = 600 - this._totalHeight - 20;
    }

    _computeSize() {
        const kw = this._keyWidth;
        const kh = this._keyHeight;
        const gap = this._keyGap;
        const pad = this._padding;

        let maxRowKeys = 0;
        let maxRowWidth = 0;
        for (const row of this._rows) {
            let rowW = 0;
            let keyCount = 0;
            for (const key of row) {
                const w = key.width || 1;
                rowW += w * kw + (w - 1) * gap;
                keyCount += w;
            }
            rowW += (row.length - 1) * gap;
            if (rowW > maxRowWidth) maxRowWidth = rowW;
            if (keyCount > maxRowKeys) maxRowKeys = keyCount;
        }

        this._totalWidth = maxRowWidth + pad * 2;
        this._totalHeight = this._rows.length * (kh + gap) - gap + pad * 2;
        this._rowWidths = [];
        for (const row of this._rows) {
            let rowW = 0;
            for (const key of row) {
                const w = key.width || 1;
                rowW += w * kw + (w - 1) * gap;
            }
            rowW += (row.length - 1) * gap;
            this._rowWidths.push(rowW);
        }
    }

    _getCurrentRows() {
        return this._symbols ? this._symbolRows : this._rows;
    }

    _getKeyBounds(row, col) {
        const rows = this._getCurrentRows();
        const rowData = rows[row];
        if (!rowData || !rowData[col]) return null;

        const kw = this._keyWidth;
        const kh = this._keyHeight;
        const gap = this._keyGap;
        const pad = this._padding;
        const key = rowData[col];
        const w = key.width || 1;

        // Calculate x offset for this key within the row
        let xOffset = 0;
        for (let i = 0; i < col; i++) {
            const prevW = rowData[i].width || 1;
            xOffset += prevW * kw + (prevW - 1) * gap + gap;
        }

        // Center the row within the keyboard
        const rowW = this._rowWidths[row];
        const rowOffsetX = (this._totalWidth - rowW) / 2;

        return {
            x: this.x + pad + rowOffsetX + xOffset,
            y: this.y + pad + row * (kh + gap),
            width: w * kw + (w - 1) * gap,
            height: kh,
            key: key
        };
    }

    open() {
        this._showing = true;
        this.visible = true;
        this._kbRow = 0;
        this._kbCol = 0;
        this._shift = false;
        this._caps = false;
        this._symbols = false;
    }

    close() {
        this._showing = false;

        // Blur the target text input but keep keyboard focus on it
        if (this.target) {
            this.target._focused = false;
            if (this._ui) {
                this._ui._focusedId = null;
                // Keep _kbFocus on the TextInput so navigation continues from there
            }
            this.target = null;
        }
    }

    _onUpdate(dt) {
        const target = this._showing ? 1 : 0;
        this._showT = ActionUIDrawUtils.lerp(this._showT, target, dt / this.theme.animDurationNormal);
        if (!this._showing && this._showT < 0.01) this.visible = false;

        // Key press animation fade out
        if (this._pressedT > 0) {
            this._pressedT = Math.max(0, this._pressedT - dt / 0.15);  // 150ms fade
            if (this._pressedT <= 0) {
                this._pressedRow = -1;
                this._pressedCol = -1;
            }
        }
    }

    _typeChar(char) {
        if (this.target && this.target._focused) {
            this.target.onChar(char);
        }
    }

    _handleSpecialKey(value) {
        switch (value) {
            case 'backspace':
                if (this.target && this.target._focused) {
                    this.target.onKeyDown('Backspace');
                }
                break;
            case 'delete':
                if (this.target && this.target._focused) {
                    this.target.onKeyDown('Delete');
                }
                break;
            case 'shift':
                if (this._caps) {
                    this._caps = false;
                    this._shift = false;
                } else if (this._shift) {
                    this._caps = true;
                    this._shift = false;
                } else {
                    this._shift = true;
                }
                break;
            case 'enter':
                if (this.target && this.target._focused) {
                    this.target.onKeyDown('Enter');
                }
                break;
            case 'done':
                this.close();
                break;
            case 'symbols':
                this._symbols = !this._symbols;
                this._kbCol = 0; // Reset column when switching layouts
                break;
        }
    }

    _getLabel(key) {
        if (this._symbols) {
            return key.label;
        }
        if (key.value.length === 1 && /[a-z]/.test(key.value)) {
            return this._caps ? key.value.toUpperCase() : (this._shift ? key.value.toUpperCase() : key.value);
        }
        return key.label;
    }

    onKeyDown(key) {
        if (!this._showing) return;
        const rows = this._getCurrentRows();

        if (key === 'DirLeft') {
            if (this._kbCol > 0) {
                this._kbCol--;
            } else if (this._kbRow > 0) {
                this._kbRow--;
                this._kbCol = Math.max(0, rows[this._kbRow].length - 1);
            }
        } else if (key === 'DirRight') {
            const maxCol = rows[this._kbRow].length - 1;
            if (this._kbCol < maxCol) {
                this._kbCol++;
            } else if (this._kbRow < rows.length - 1) {
                this._kbRow++;
                this._kbCol = 0;
            }
        } else if (key === 'DirUp') {
            if (this._kbRow > 0) {
                this._kbRow--;
                // Try to keep same column, clamp to row length
                this._kbCol = Math.min(this._kbCol, rows[this._kbRow].length - 1);
            }
        } else if (key === 'DirDown') {
            if (this._kbRow < rows.length - 1) {
                this._kbRow++;
                this._kbCol = Math.min(this._kbCol, rows[this._kbRow].length - 1);
            }
        } else if (key === 'Action1') {
            // Press the focused key
            const bounds = this._getKeyBounds(this._kbRow, this._kbCol);
            if (bounds) {
                // Trigger press animation
                this._pressedT = 1;
                this._pressedRow = this._kbRow;
                this._pressedCol = this._kbCol;

                const keyData = bounds.key;
                if (keyData.value.length === 1) {
                    // Regular character
                    let char = keyData.value;
                    if (/[a-z]/.test(char)) {
                        char = this._caps ? char.toUpperCase() : (this._shift ? char.toUpperCase() : char);
                    }
                    this._typeChar(char);
                    // Auto-release shift if not caps
                    if (this._shift && !this._caps) this._shift = false;
                } else {
                    this._handleSpecialKey(keyData.value);
                }
            }
        } else if (key === 'Action2') {
            this.close();
        }
    }

    onPointerDown(px, py) {
        if (!this._showing || !this.enabled) return;
        const rows = this._getCurrentRows();
        for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < rows[r].length; c++) {
                const b = this._getKeyBounds(r, c);
                if (b && px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height) {
                    // Trigger press animation
                    this._pressedT = 1;
                    this._pressedRow = r;
                    this._pressedCol = c;

                    const keyData = b.key;
                    if (keyData.value.length === 1) {
                        let char = keyData.value;
                        if (/[a-z]/.test(char)) {
                            char = this._caps ? char.toUpperCase() : (this._shift ? char.toUpperCase() : char);
                        }
                        this._typeChar(char);
                        if (this._shift && !this._caps) this._shift = false;
                    } else {
                        this._handleSpecialKey(keyData.value);
                    }
                    return;
                }
            }
        }
    }

    onPointerMove(px, py) {
        if (!this._showing || !this.enabled) {
            this._hoverRow = -1;
            this._hoverCol = -1;
            return;
        }
        const rows = this._getCurrentRows();
        let found = false;
        for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < rows[r].length; c++) {
                const b = this._getKeyBounds(r, c);
                if (b && px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height) {
                    this._hoverRow = r;
                    this._hoverCol = c;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
        if (!found) {
            this._hoverRow = -1;
            this._hoverCol = -1;
        }
    }

    containsPoint(px, py) {
        if (!this._showing || !this.visible) return false;
        return px >= this.x && px <= this.x + this._totalWidth &&
               py >= this.y && py <= this.y + this._totalHeight;
    }

    draw(ctx) {
        if (!this.visible || this._showT < 0.01) return;
        const t = this.theme;
        const a = ActionUIDrawUtils.easeOut(this._showT);

        ctx.save();
        ctx.globalAlpha = a;

        // Background panel
        ActionUIDrawUtils.shadow(ctx, t.colorShadow, 30, 0, 10);
        ActionUIDrawUtils.fillRoundRect(ctx, this.x, this.y, this._totalWidth, this._totalHeight, t.radiusLg, t.colorSurfaceOverlay);
        ActionUIDrawUtils.clearShadow(ctx);
        ActionUIDrawUtils.strokeRoundRect(ctx, this.x, this.y, this._totalWidth, this._totalHeight, t.radiusLg, t.colorBorder, 1.5);

        // Draw keys
        const rows = this._getCurrentRows();
        for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < rows[r].length; c++) {
                this._drawKey(ctx, r, c, t);
            }
        }

        // Status bar (show current mode)
        const statusY = this.y + this._totalHeight - 2;
        let modeText = '';
        if (this._caps) modeText = 'CAPS';
        else if (this._shift) modeText = 'SHIFT';
        else if (this._symbols) modeText = 'SYMBOLS';
        else modeText = 'ABC';

        if (modeText) {
            ActionUIDrawUtils.text(ctx, modeText,
                this.x + this._totalWidth / 2, statusY - 2,
                t.font(10, t.fontWeightMedium), t.colorTextMuted, 'center', 'bottom'
            );
        }

        ctx.restore();
    }

    _drawKey(ctx, row, col, t) {
        const b = this._getKeyBounds(row, col);
        if (!b) return;

        const isFocused = this._showing && row === this._kbRow && col === this._kbCol;
        const isHovered = this._hoverRow === row && this._hoverCol === col;
        const isPressed = this._pressedT > 0 && row === this._pressedRow && col === this._pressedCol;
        const isSpecial = b.key.width && b.key.width > 1;
        const label = this._getLabel(b.key);

        // Key background - use theme colors for all states
        let bgColor = t.colorSurfaceRaised;
        let borderColor = t.colorBorder;

        if (isPressed) {
            // Pressed state: use colorPrimaryActive with focus ring
            bgColor = t.colorPrimaryActive;
            borderColor = t.colorKbFocusActive;
        } else if (isFocused) {
            // Focused state: use colorPrimaryHover with focus border
            bgColor = t.withAlpha(t.colorPrimaryHover, 0.35);
            borderColor = t.colorBorderFocus;
        } else if (isHovered) {
            // Hover state: subtle highlight
            bgColor = t.withAlpha(t.colorPrimaryHover, 0.15);
            borderColor = t.withAlpha(t.colorBorderFocus, 0.5);
        }

        // Special key states (only if not pressed)
        if (isSpecial && !isPressed) {
            if (b.key.value === 'shift') {
                bgColor = this._caps ? t.withAlpha(t.colorPrimary, 0.4) : (this._shift ? t.withAlpha(t.colorPrimaryHover, 0.35) : bgColor);
            } else if (b.key.value === 'done') {
                bgColor = t.withAlpha(t.colorSuccess, 0.2);
            } else if (b.key.value === 'symbols') {
                bgColor = this._symbols ? t.withAlpha(t.colorPrimary, 0.3) : bgColor;
            }
        }

        // Slight scale down when pressed for tactile feel
        if (isPressed) {
            const scale = 0.95;
            const cx = b.x + b.width / 2;
            const cy = b.y + b.height / 2;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(scale, scale);
            ctx.translate(-cx, -cy);
        }

        ActionUIDrawUtils.fillRoundRect(ctx, b.x, b.y, b.width, b.height, t.radiusSm, bgColor);
        ActionUIDrawUtils.strokeRoundRect(ctx, b.x, b.y, b.width, b.height, t.radiusSm, borderColor, isFocused || isPressed || isHovered ? 2 : 1);

        // Key label - use theme text colors
        const fontSize = isSpecial ? 11 : t.fontSizeMd;
        const fontWeight = isSpecial ? t.fontWeightMedium : t.fontWeightRegular;
        const textColor = isPressed ? t.colorPrimaryText : (isFocused || isHovered ? t.colorPrimary : t.colorText);

        ActionUIDrawUtils.text(ctx, label,
            b.x + b.width / 2, b.y + b.height / 2,
            t.font(fontSize, fontWeight), textColor, 'center', 'middle'
        );

        if (isPressed) {
            ctx.restore();
        }
    }

    getBounds() {
        return { x: this.x, y: this.y, width: this._totalWidth, height: this._totalHeight };
    }
}
