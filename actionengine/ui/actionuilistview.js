/******************************************************************************
 * ActionUIListView — scrollable list of items
 * Displays an array of items with automatic scrolling and overflow handling
 ******************************************************************************/

class ActionUIListView extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.items = props.items || []; // Array of strings or objects with toString()
        this.itemHeight = props.itemHeight || 20; // Height per item
        this.padding = props.padding || 8; // Padding inside the list
        this.maxItems = props.maxItems || null; // null = no limit, otherwise trim oldest
        this.wheelScrollMultiplier = props.wheelScrollMultiplier || 3; // items to scroll per wheel tick
        this._scrollY = 0; // Current scroll position
        this._targetScrollY = 0; // Target scroll for smooth scrolling
        this._hoveredIndex = -1;
        this._lastItemCount = 0; // Track when items change to auto-scroll
    }

    // Scroll to bottom (for console behavior)
    scrollToBottom() {
        const maxScroll = Math.max(0, this.items.length * this.itemHeight - (this.height - this.padding * 2));
        this._targetScrollY = maxScroll;
    }

    // Add item to list
    addItem(item) {
        this.items.push(item);
        
        // Trim oldest if maxItems set
        if (this.maxItems && this.items.length > this.maxItems) {
            this.items.shift();
        }
        
        // Auto-scroll to bottom on new item
        this.scrollToBottom();
    }

    // Clear all items
    clear() {
        this.items = [];
        this._scrollY = 0;
        this._targetScrollY = 0;
    }

    _onUpdate(dt) {
        // Smooth scroll towards target
        const scrollDiff = this._targetScrollY - this._scrollY;
        if (Math.abs(scrollDiff) > 0.1) {
            this._scrollY += scrollDiff * Math.min(1, dt * 8); // Smooth over time
        } else {
            this._scrollY = this._targetScrollY;
        }

        // Auto-scroll if new items added
        if (this.items.length > this._lastItemCount) {
            this.scrollToBottom();
            this._lastItemCount = this.items.length;
        }
    }

    onPointerMove(px, py) {
        if (!this.containsPoint(px, py)) {
            this._hoveredIndex = -1;
            return;
        }

        const relY = py - this.y - this.padding + this._scrollY;
        const index = Math.floor(relY / this.itemHeight);
        this._hoveredIndex = (index >= 0 && index < this.items.length) ? index : -1;
    }

    onPointerDown(px, py) {
        // Can be extended for click handling on items
    }

    onMouseWheel(wheelDelta) {
        // wheelDelta: positive = scroll up, negative = scroll down
        const scrollAmount = wheelDelta * this.itemHeight * this.wheelScrollMultiplier;
        const maxScroll = Math.max(0, this.items.length * this.itemHeight - (this.height - this.padding * 2));
        this._targetScrollY = Math.max(0, Math.min(maxScroll, this._targetScrollY - scrollAmount));
    }

    draw(ctx) {
        if (!this.visible) return;
        const t = this.theme;

        ctx.save();
        this._applyOpacity(ctx);

        // Background
        ActionUIDrawUtils.fillRoundRect(ctx, this.x, this.y, this.width, this.height, t.radiusMd, t.colorSurface);

        // Border
        ActionUIDrawUtils.strokeRoundRect(ctx, this.x, this.y, this.width, this.height, t.radiusMd, t.colorBorder, 1);

        // Clip inner area for scrolling
        ctx.save();
        ActionUIDrawUtils.roundRect(ctx, this.x + 1, this.y + 1, this.width - 2, this.height - 2, t.radiusMd - 1);
        ctx.clip();

        // Draw items
        const innerWidth = this.width - this.padding * 2;
        const innerHeight = this.height - this.padding * 2;
        const visibleItemCount = Math.ceil(innerHeight / this.itemHeight) + 1;
        const startIndex = Math.max(0, Math.floor(this._scrollY / this.itemHeight) - 1);
        const endIndex = Math.min(this.items.length, startIndex + visibleItemCount + 2);

        ctx.font = t.font(t.fontSizeSm);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        for (let i = startIndex; i < endIndex; i++) {
            const item = this.items[i];
            const itemY = this.y + this.padding + i * this.itemHeight - this._scrollY;

            // Only draw if visible in viewport
            if (itemY + this.itemHeight < this.y || itemY > this.y + this.height) continue;

            // Hover background
            if (this._hoveredIndex === i) {
                ctx.fillStyle = t.withAlpha(t.colorBorderFocus, 0.2);
                ctx.fillRect(this.x + this.padding, itemY, innerWidth, this.itemHeight);
            }

            // Item text
            ctx.fillStyle = t.colorText;
            const displayText = typeof item === 'string' ? item : (item.toString ? item.toString() : String(item));
            ctx.fillText(displayText, this.x + this.padding + 4, itemY + this.itemHeight / 2);
        }

        ctx.restore();

        // Scrollbar
        this._drawScrollbar(ctx, t, innerHeight);

        this._restoreOpacity(ctx);
        ctx.restore();
    }

    _drawScrollbar(ctx, t, innerHeight) {
        const totalHeight = this.items.length * this.itemHeight;
        if (totalHeight <= innerHeight) return; // No scrollbar needed

        const scrollbarX = this.x + this.width - 6;
        const scrollbarWidth = 4;
        const scrollbarHeight = Math.max(20, (innerHeight / totalHeight) * innerHeight);
        const maxScroll = totalHeight - innerHeight;
        const scrollRatio = maxScroll > 0 ? this._scrollY / maxScroll : 0;
        const scrollbarY = this.y + this.padding + scrollRatio * (innerHeight - scrollbarHeight);

        // Track
        ctx.fillStyle = t.withAlpha(t.colorBorder, 0.3);
        ctx.fillRect(scrollbarX, this.y + this.padding, scrollbarWidth, innerHeight);

        // Thumb
        ctx.fillStyle = t.withAlpha(t.colorBorderFocus, 0.6);
        ActionUIDrawUtils.fillRoundRect(ctx, scrollbarX, scrollbarY, scrollbarWidth, scrollbarHeight, 2, ctx.fillStyle);
    }
}
