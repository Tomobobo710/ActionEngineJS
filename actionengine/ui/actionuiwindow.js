/******************************************************************************
 * ActionUIWindow — draggable, resizable window container with title bar
 ******************************************************************************/

class ActionUIWindow extends ActionUIComponent {
    constructor(props = {}) {
        super(props);
        this.title = props.title || 'Window';
        this.resizable = props.resizable !== false;
        this.onClose = props.onClose || null;
        
        this.children = [];
        this.isDragging = false;
        this.isResizing = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this._pointerCaptured = false;
        this.minWidth = props.minWidth || 150;
        this.minHeight = props.minHeight || 100;
        
        this.titleBarHeight = 32;
        this.resizeHandleSize = 12;
        this.padding = 8;
        
        this._closeHovered = false;
    }

    addChild(comp) {
        comp._ui = this._ui;
        comp._parent = this;
        this.children.push(comp);
        // DO NOT auto-register with ActionUI — window draws children itself
        return this;
    }

    _pointInRect(px, py, rect) {
        return px >= rect.x && px < rect.x + rect.width &&
               py >= rect.y && py < rect.y + rect.height;
    }

    onPointerDown(px, py) {
        if (!this.visible) return;

        // Bring to front (highest z-index) on ANY click
        this._bringToFront();

        const closeBtn = this._getCloseButtonBounds();
        const resizeHandle = this._getResizeHandleBounds();
        const titleBar = this._getTitleBarBounds();

        // Close button click
        if (this._pointInRect(px, py, closeBtn)) {
            this.visible = false;
            if (this.onClose) this.onClose(this);
            return;
        }

        // Resize handle
        if (this.resizable && this._pointInRect(px, py, resizeHandle)) {
            this.isResizing = true;
            return;
        }

        // Title bar drag — capture pointer and return early so children don't process
        if (this._pointInRect(px, py, titleBar)) {
            this.isDragging = true;
            this._pointerCaptured = true;
            this.dragOffsetX = px - this.x;
            this.dragOffsetY = py - this.y;
            return;
        }

        // Pass to children with relative coordinates (only if child contains point)
        const contentX = this.x + this.padding;
        const contentY = this.y + this.titleBarHeight + this.padding;
        const relX = px - contentX;
        const relY = py - contentY;
        this.children.forEach(c => {
            if (c.containsPoint(relX, relY)) {
                c.onPointerDown(relX, relY);
            }
        });
    }

    onPointerUp(px, py) {
        this.isDragging = false;
        this.isResizing = false;
        this._pointerCaptured = false;
        // Pass to children with relative coordinates (only if child contains point)
        const contentX = this.x + this.padding;
        const contentY = this.y + this.titleBarHeight + this.padding;
        const relX = px - contentX;
        const relY = py - contentY;
        this.children.forEach(c => {
            if (c.containsPoint(relX, relY)) {
                c.onPointerUp(relX, relY);
            }
        });
    }

    onPointerMove(px, py) {
        if (!this.visible) return;

        if (this.isDragging) {
            this.x = px - this.dragOffsetX;
            this.y = py - this.dragOffsetY;
        } else if (this.isResizing) {
            const newWidth = Math.max(this.minWidth, px - this.x);
            const newHeight = Math.max(this.minHeight, py - this.y);
            this.width = newWidth;
            this.height = newHeight;
        }

        // Hover states
        const closeBtn = this._getCloseButtonBounds();
        this._closeHovered = this._pointInRect(px, py, closeBtn);

        // Pass to children with relative coordinates
        const contentX = this.x + this.padding;
        const contentY = this.y + this.titleBarHeight + this.padding;
        const relX = px - contentX;
        const relY = py - contentY;
        this.children.forEach(c => {
            // For hover state, always pass move events to all children
            c.onPointerMove(relX, relY);
        });
    }

    _getTitleBarBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.titleBarHeight
        };
    }

    _getCloseButtonBounds() {
        const btnSize = 24;
        return {
            x: this.x + this.width - this.padding - btnSize,
            y: this.y + (this.titleBarHeight - btnSize) / 2,
            width: btnSize,
            height: btnSize
        };
    }

    _getResizeHandleBounds() {
        return {
            x: this.x + this.width - this.resizeHandleSize,
            y: this.y + this.height - this.resizeHandleSize,
            width: this.resizeHandleSize,
            height: this.resizeHandleSize
        };
    }

    _bringToFront() {
        if (!this._ui) return;
        // Find max z-index among all windows and dropdowns (but not modals - they stay on top)
        let maxZ = 0;
        this._ui._components.forEach(c => {
            if ((c instanceof ActionUIWindow || c instanceof ActionUIDropdown) && c !== this) {
                maxZ = Math.max(maxZ, c.zIndex);
            }
        });
        this.zIndex = maxZ + 1;
    }

    _onUpdate(dt) {
        this.children.forEach(c => { c._ui = this._ui; c.update(dt); });
    }

    draw(ctx) {
        if (!this.visible) return;

        ctx.save();
        this._applyOpacity(ctx);

        // Background
        ctx.fillStyle = this.theme.colorSurface;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Border
        ctx.strokeStyle = this.theme.colorPrimary;
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        // Title bar background
        ctx.fillStyle = this.theme.colorSurfaceRaised;
        ctx.fillRect(this.x, this.y, this.width, this.titleBarHeight);

        // Title text
        ctx.fillStyle = this.theme.colorText;
        ctx.font = `${this.theme.fontWeightBold} ${this.theme.fontSizeMd}px ${this.theme.fontFamily}`;
        ctx.textBaseline = 'middle';
        ctx.fillText(this.title, this.x + this.padding, this.y + this.titleBarHeight / 2);

        // Close button
        this._drawButton(ctx, this._getCloseButtonBounds(), '✕', this._closeHovered);

        // Resize handle indicator
        if (this.resizable) {
            const rh = this._getResizeHandleBounds();
            ctx.fillStyle = this.theme.colorTextMuted;
            ctx.fillRect(rh.x, rh.y, rh.width, rh.height);
        }

        // Draw children with clipping
        ctx.save();
        const contentX = this.x + this.padding;
        const contentY = this.y + this.titleBarHeight + this.padding;
        const contentW = this.width - this.padding * 2;
        const contentH = this.height - this.titleBarHeight - this.padding * 2;
        
        // Clip to content area
        ctx.beginPath();
        ctx.rect(contentX, contentY, contentW, contentH);
        ctx.clip();
        
        // Translate context so children are drawn relative to content area
        ctx.translate(contentX, contentY);
        
        // Update child widths to match content area (for text wrapping)
        this.children.forEach(c => {
            if (c.wrap) c.width = contentW;
        });
        
        // Draw children with relative coordinates
        this.children.forEach(c => {
            c.draw(ctx);
        });
        
        ctx.restore();

        this._restoreOpacity(ctx);
        ctx.restore();
    }

    _drawButton(ctx, bounds, symbol, hovered) {
        ctx.fillStyle = hovered ? this.theme.colorPrimaryHover : this.theme.colorSurfaceRaised;
        ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
        ctx.strokeStyle = this.theme.colorPrimary;
        ctx.lineWidth = 1;
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

        ctx.fillStyle = this.theme.colorText;
        ctx.font = `${this.theme.fontWeightMedium} ${this.theme.fontSizeMd}px ${this.theme.fontFamily}`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(symbol, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        ctx.textAlign = 'left';
    }
}
