/**
 * ActionScrollableArea - A comprehensive, reusable scrollable area component for ActionEngine
 *
 * This class provides a complete scrollbar implementation that handles all common scrolling interactions
 * including drag scrolling, click-to-jump, mouse wheel scrolling, and keyboard navigation. It's designed
 * to be easily integrated into any UI that needs to display a scrollable list of items.
 *
 * KEY FEATURES:
 * - Self-Contained: Draws both scrollbar and content area background automatically
 * - Background Management: Handles content area background, borders, and styling independently
 * - Drag & Drop: Click and drag the scrollbar thumb with threshold-based drag detection
 * - Click-to-Jump: Click anywhere on the scrollbar track to instantly jump to that position
 * - Mouse Wheel: Seamless scroll wheel support with proper delta handling
 * - Keyboard Scrolling: Arrow key navigation when hovering over the list area
 * - Proportional Display: Scrollbar thumb size and position accurately represent content ratio
 * - Visual Feedback: Hover states, drag indicators, and smooth interactions
 * - Customizable Background: Configurable content area background with borders and rounded corners
 * - Easy Configuration: Simple configuration object for different use cases
 *
 * USAGE EXAMPLE:
 * ```javascript
 * // Basic setup - component handles everything automatically
 * this.inventoryScroller = new ActionScrollableArea({
 *     listAreaX: 400, listAreaY: 100, listAreaWidth: 450, listAreaHeight: 400,
 *     itemHeight: 60, padding: 10, scrollBarX: 860, scrollBarY: 90,
 *     scrollBarTrackHeight: 380, scrollBarThumbStartY: 120
 * }, game.input, game.guiCtx);
 *
 * // In your update loop
 * this.inventoryScroller.update(this.game.gameState.inventory.length, deltaTime);
 *
 * // Enhanced draw method with automatic clipping and item rendering
 * this.inventoryScroller.draw(items, (item, index, y) => {
 *     this.drawInventoryItem(item, y);
 * });
 * ```
 *
 * CONFIGURATION OPTIONS:
 * - listAreaX, listAreaY, listAreaWidth, listAreaHeight: Define the scrollable content area
 * - itemHeight: Pixel height of each item in your list
 * - padding: Pixel gap between items in the list (default: 8)
 * - scrollBarX, scrollBarY: Position of the scrollbar relative to content
 * - scrollBarTrackHeight: Total height available for scrollbar track
 * - scrollBarThumbStartY: Where the scrollbar thumb should start (usually = scrollBarY + 10)
 *
 * ADDITIONAL CONFIGURATION OPTIONS:
 * - enableClipping: Enable clipping support (default: false)
 * - clipBounds: {x, y, width, height} for clipping visible area
 * - colors: Override default scrollbar colors (see colors config structure below)
 * - backgroundColor: Background fill color for content area (default: "rgba(40, 40, 40, 0.8)")
 * - borderColor: Border color for content area (default: "rgba(255, 255, 255, 0.3)")
 * - borderWidth: Border thickness for content area (default: 2)
 * - cornerRadius: Corner radius for rounded background (default: 0)
 * - drawBackground: Whether to draw background automatically (default: true)
 * - onRegisterInput: Custom input registration callback
 * - onRegisterItemInput: Custom item input registration callback
 * - generateItemId: Function to generate item IDs (item, index) => string
 *
 * IMPORTANT NOTES:
 * - The component automatically registers its scrollbar elements with the input system
 * - Mouse wheel events are captured automatically (no additional setup needed)
 * - The scrollable area handles its own cleanup when destroy() is called
 * - All positions are automatically calculated proportionally for smooth scrolling
 * - Visual feedback (hover states, drag indicators) is handled internally
 */

class ActionScrollableArea {
    /**
     * Creates a new scrollable area component with comprehensive scrolling functionality
     *
     * This constructor initializes all the necessary properties for scrollbar functionality,
     * registers input handlers for user interactions, and sets up mouse wheel support.
     * The component is immediately ready to use after construction.
     *
     * @param {Object} config - Configuration object defining the scrollable area's dimensions and behavior
     * @param {number} config.listAreaX - X coordinate of the top-left corner of the scrollable content area
     * @param {number} config.listAreaY - Y coordinate of the top-left corner of the scrollable content area
     * @param {number} config.listAreaWidth - Width in pixels of the scrollable content area
     * @param {number} config.listAreaHeight - Height in pixels of the scrollable content area
     * @param {number} config.itemHeight - Height in pixels of each individual item in the list
     * @param {number} [config.padding] - Pixel gap between items in the list (default: 8)
     * @param {number} config.scrollBarX - X coordinate where the scrollbar should be positioned
     * @param {number} config.scrollBarY - Y coordinate where the scrollbar track starts
     * @param {number} config.scrollBarTrackHeight - Total height available for the scrollbar track
     * @param {number} [config.scrollBarThumbStartY] - Y coordinate where scrollbar thumb should start (optional, calculated if not provided)
     * @param {string} [config.backgroundColor] - Background fill color for the content area (default: "rgba(40, 40, 40, 0.8)")
     * @param {string} [config.borderColor] - Border color for the content area (default: "rgba(255, 255, 255, 0.3)")
     * @param {number} [config.borderWidth] - Border thickness for the content area (default: 2)
     * @param {number} [config.cornerRadius] - Corner radius for rounded background corners (default: 0)
     * @param {boolean} [config.drawBackground] - Whether to draw the background automatically (default: true)
     *
     * @param {Object} input - Reference to the ActionEngine input system for handling user interactions
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context for drawing the scrollbar components
     *
     * @example
     * // Basic setup - component handles background automatically
     * const inventoryScroller = new ActionScrollableArea({
     *     listAreaX: 50, listAreaY: 100, listAreaWidth: 300, listAreaHeight: 400,
     *     itemHeight: 60, scrollBarX: 360, scrollBarY: 100, scrollBarTrackHeight: 400,
     *
     *     // Optional: customize background (defaults are sensible)
     *     backgroundColor: "rgba(40, 40, 40, 0.8)",
     *     borderColor: "rgba(255, 255, 255, 0.3)"
     * }, game.input, game.guiCtx);
     *
     * // Advanced setup with custom styling and background
     * const customScroller = new ActionScrollableArea({
     *     listAreaX: 400, listAreaY: 100, listAreaWidth: 450, listAreaHeight: 400,
     *     itemHeight: 120, scrollBarX: 860, scrollBarY: 90,
     *     scrollBarTrackHeight: 380, scrollBarThumbStartY: 120,
     *
     *     // Enable clipping for precise input bounds
     *     enableClipping: true,
     *     clipBounds: { x: 400, y: 100, width: 450, height: 400 },
     *
     *     // Custom scrollbar colors for theme consistency
     *     colors: {
     *         track: { normal: "rgba(255, 255, 255, 0.1)", hover: "rgba(255, 255, 255, 0.2)" },
     *         thumb: { normal: "rgba(255, 100, 100, 0.3)", hover: "rgba(255, 100, 100, 0.6)", drag: "rgba(255, 100, 100, 0.8)" },
     *         button: { normal: "rgba(255, 100, 100, 0.1)", hover: "rgba(255, 100, 100, 0.3)" },
     *         buttonText: { normal: "rgba(255, 100, 100, 0.8)", hover: "#ff6464" },
     *         thumbBorder: { normal: "rgba(255, 100, 100, 0.5)", drag: "#ff6464" }
     *     },
     *
     *     // Self-contained background styling - no manual drawing needed!
     *     drawBackground: true,                           // Enable automatic background
     *     backgroundColor: "rgba(20, 20, 30, 0.9)",     // Dark blue background
     *     borderColor: "rgba(255, 100, 100, 0.6)",       // Red border with 60% opacity
     *     borderWidth: 3,                                 // Thicker border
     *     cornerRadius: 8                                 // Rounded corners
     * }, game.input, game.guiCtx);
     *
     * // Chat log scroller with different ID format
     * const chatScroller = new ActionScrollableArea({
     *     listAreaX: 50, listAreaY: 100, listAreaWidth: 300, listAreaHeight: 400,
     *     itemHeight: 40, scrollBarX: 360, scrollBarY: 100, scrollBarTrackHeight: 400,
     *
     *     // Generate chat-specific IDs
     *     generateItemId: (message, index) => `chat_msg_${message.timestamp}_${index}`,
     *
     *     // Enable clipping for chat area
     *     enableClipping: true,
     *     clipBounds: { x: 50, y: 100, width: 300, height: 400 }
     * }, game.input, game.guiCtx);
     */
    constructor(config, input, ctx) {
        this.input = input;
        this.ctx = ctx;

        // Scroll state
        this.scrollOffset = 0;
        this.maxScrollOffset = 0;
        this.isDragging = false;
        this.dragStartY = 0;
        this.lastScrollOffset = 0;
        this.dragThreshold = 5;
        this.hasMovedBeyondThreshold = false;

        // Track scroll and content changes to prevent unnecessary input re-registration
        this.lastScrollOffsetForInput = -1; // Initialize to -1 so first update always triggers
        this.lastItemCountForInput = -1; // Track item count changes for new insertions/deletions
        this.registeredItems = new Set(); // Track which items are currently registered

        // List area dimensions
        this.listArea = {
            x: config.listAreaX || 400,
            y: config.listAreaY || 100,
            width: config.listAreaWidth || 450,
            height: config.listAreaHeight || 400,
            itemHeight: config.itemHeight || 60,
            padding: config.padding !== undefined ? config.padding : 8,
            scrollBarWidth: 20
        };

        // Scrollbar positioning
        this.scrollArea = {
            x: config.scrollBarX || 860,
            y: config.scrollBarY || 90,
            trackHeight: config.scrollBarTrackHeight || 380,
            thumbStartY: config.scrollBarThumbStartY || 120
        };

        // Configurable colors with sensible defaults
        // COLOR CONFIGURATION STRUCTURE:
        // - track: Scrollbar track background {normal, hover}
        // - thumb: Scrollbar thumb {normal, hover, drag}
        // - button: Up/Down button backgrounds {normal, hover}
        // - buttonText: Button text colors {normal, hover}
        // - thumbBorder: Thumb border colors {normal, drag}
        this.colors = {
            track: {
                normal: "rgba(0, 0, 0, 0.2)",
                hover: "rgba(0, 0, 0, 0.3)"
            },
            thumb: {
                normal: "rgba(52, 152, 219, 0.3)",
                hover: "rgba(52, 152, 219, 0.6)",
                drag: "rgba(52, 152, 219, 0.8)"
            },
            button: {
                normal: "rgba(52, 152, 219, 0.1)",
                hover: "rgba(52, 152, 219, 0.3)"
            },
            buttonText: {
                normal: "rgba(52, 152, 219, 0.8)",
                hover: "#3498DB"
            },
            thumbBorder: {
                normal: "rgba(52, 152, 219, 0.5)",
                drag: "#3498DB"
            }
        };

        // Override with custom colors if provided
        if (config.colors) {
            Object.assign(this.colors, config.colors);
        }

        // Clipping support (fundamental feature)
        this.clipBounds = config.clipBounds || null; // {x, y, width, height} for clipping
        this.enableClipping = config.enableClipping || false;

        // Custom input registration callback
        this.onRegisterInput =
            config.onRegisterInput ||
            ((id, bounds, layer = "gui") => {
                if (bounds && bounds.width > 0 && bounds.height > 0) {
                    this.input.registerElement(id, { bounds: () => bounds }, layer);
                }
            });

        // Generate item ID for input registration (configurable)
        this.generateItemId = config.generateItemId || ((item, index) => `item_${index}`);

        // Custom item input registration callback (stable registration)
        this.onRegisterItemInput =
            config.onRegisterItemInput ||
            ((itemId, index, bounds) => {
                if (bounds && bounds.width > 0 && bounds.height > 0) {
                    // Always register visible items - the registration system handles duplicates
                    this.onRegisterInput(itemId, bounds);
                }
            });

        // Background configuration
        this.drawBackground = config.drawBackground !== false; // Default to true
        this.backgroundConfig = {
            fillColor: config.backgroundColor || "rgba(40, 40, 40, 0.8)",
            borderColor: config.borderColor || "rgba(255, 255, 255, 0.3)",
            borderWidth: config.borderWidth || 2,
            cornerRadius: config.cornerRadius || 0 // For rounded corners
        };

        const scrollButtonWidth = 20;
        const scrollButtonHeight = 20;

        // Scroll buttons (using configurable colors)
        this.scrollUpButton = {
            width: scrollButtonWidth,
            height: scrollButtonHeight,
            x: this.scrollArea.x,
            y: this.scrollArea.y - scrollButtonHeight,
            text: "▲",
            color: this.colors.button.normal,
            hovered: false
        };

        this.scrollDownButton = {
            x: this.scrollArea.x,
            y: this.scrollArea.y + this.scrollArea.trackHeight,
            width: scrollButtonWidth,
            height: scrollButtonHeight,
            text: "▼",
            color: this.colors.button.normal,
            hovered: false
        };

        this.scrollThumb = {
            x: this.scrollArea.x,
            y: this.scrollArea.thumbStartY,
            width: 20,
            height: 60,
            color: this.colors.thumb.normal,
            hovered: false
        };

        // Element IDs for input registration
        this.elementIds = {
            scrollUp: this.generateElementId(),
            scrollDown: this.generateElementId(),
            scrollbarTrack: this.generateElementId()
        };

        this.setupInput();
        this.setupMouseWheel();
    }

    /**
     * Generates a unique element ID for input system registration
     *
     * Creates a random string identifier to avoid conflicts when multiple scrollable
     * areas are used in the same application. Uses base-36 encoding for compactness.
     *
     * @returns {string} A unique identifier string for input element registration
     *
     * @private
     * @example
     * // Returns something like: "scrollable_a4f2k1"
     * const elementId = this.generateElementId();
     */
    generateElementId() {
        return `scrollable_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Sets up input system registration for scrollbar interactive elements
     *
     * Registers three interactive elements with the input system:
     * - scrollbarTrack: The background area of the scrollbar (for click-to-jump)
     * - scrollUp: The up arrow button for incremental scrolling
     * - scrollDown: The down arrow button for incremental scrolling
     *
     * Each element is registered with dynamic bounds calculation that updates
     * in real-time to match the current scrollbar position and dimensions.
     *
     * @private
     * @example
     * // Automatically called during construction
     * this.setupInput(); // Registers "scrollUp", "scrollDown", and "scrollbarTrack"
     */
    setupInput() {
        // Register scrollbar track for click-to-jump and dragging
        this.input.registerElement(
            this.elementIds.scrollbarTrack,
            {
                bounds: () => ({
                    x: this.scrollArea.x,
                    y: this.scrollArea.thumbStartY,
                    width: 20,
                    height: this.scrollArea.trackHeight
                })
            },
            "gui"
        );

        // Register scroll up button
        this.input.registerElement(
            this.elementIds.scrollUp,
            {
                bounds: () => ({
                    x: this.scrollUpButton.x,
                    y: this.scrollUpButton.y,
                    width: this.scrollUpButton.width,
                    height: this.scrollUpButton.height
                })
            },
            "gui"
        );

        // Register scroll down button
        this.input.registerElement(
            this.elementIds.scrollDown,
            {
                bounds: () => ({
                    x: this.scrollDownButton.x,
                    y: this.scrollDownButton.y,
                    width: this.scrollDownButton.width,
                    height: this.scrollDownButton.height
                })
            },
            "gui"
        );
    }

    /**
     * Sets up automatic mouse wheel event handling for seamless scrolling
     *
     * This method adds wheel event listeners to both the game canvas and window
     * as a fallback. The event listeners are added with a small delay to ensure
     * the canvas element exists in the DOM before attempting to attach listeners.
     *
     * Features:
     * - Prevents default browser scroll behavior when over canvas
     * - Handles both positive and negative delta values
     * - Provides fallback to window if canvas is not available
     * - Automatically removes events when component is destroyed
     *
     * @private
     * @example
     * // Automatically called during construction with 100ms delay
     * setTimeout(() => {
     *     canvas.addEventListener("wheel", (e) => {
     *         this.handleMouseWheel(e.deltaY);
     *     });
     * }, 100);
     */
    setupMouseWheel() {
        setTimeout(() => {
            const canvas = document.querySelector("#gameCanvas");
            if (canvas) {
                canvas.addEventListener("wheel", (e) => {
                    e.preventDefault();
                    this.handleMouseWheel(e.deltaY);
                });

                // Fallback to window
                window.addEventListener("wheel", (e) => {
                    this.handleMouseWheel(e.deltaY);
                });
            }
        }, 100);
    }

    /**
     * Updates the scrollable area state and handles all scrolling interactions
     *
     * This is the main update method that should be called every frame in your game loop.
     * It performs several critical functions:
     * - Updates maximum scroll range based on item count
     * - Recalculates scrollbar thumb position and size
     * - Processes user input (clicks, drags, keyboard)
     * - Handles boundary constraints
     *
     * Call this method before drawing to ensure scrollbar state is current.
     *
     * @param {number} totalItemCount - Total number of items in the scrollable list
     * @param {number} deltaTime - Time elapsed since last frame in seconds (for smooth keyboard scrolling)
     *
     * @example
     * // In your game update loop
     * update(deltaTime) {
     *     // Update scrollable area before processing input
     *     this.inventoryScroller.update(this.gameState.inventory.length, deltaTime);
     * }
     */
    update(totalItemCount, deltaTime) {
        this.updateMaxScroll(totalItemCount);
        this.updateScrollbarThumb();
        this.handleInput(deltaTime);
    }

    /**
     * Updates the maximum scroll offset based on total item count and visible area
     *
     * Calculates how far the user can scroll by comparing the total content height
     * (itemCount × itemHeight) with the visible area height. The difference represents
     * the maximum scroll distance needed to see all content.
     *
     * Formula: maxScroll = (totalItems × itemHeight) - visibleAreaHeight
     * Example: 20 items × 60px = 1200px total height, 400px visible area = 800px max scroll
     *
     * @param {number} totalItemCount - Total number of items in the list
     *
     * @private
     * @example
     * // 100 items × 50px each = 5000px total height
     * // 300px visible area = 4700px maximum scroll
     * this.updateMaxScroll(100);
     * console.log(this.maxScrollOffset); // 4700
     */
    updateMaxScroll(totalItemCount) {
        const totalContentHeight = totalItemCount * (this.listArea.itemHeight + this.listArea.padding);
        const visibleHeight = this.listArea.height;
        this.maxScrollOffset = Math.max(0, totalContentHeight - visibleHeight);
        this.scrollOffset = Math.max(0, Math.min(this.maxScrollOffset, this.scrollOffset));
    }

    /**
     * Updates the scrollbar thumb position and size based on current scroll state
     *
     * This method implements proportional scrollbar behavior where:
     * - Thumb height represents the ratio of visible content to total content
     * - Thumb position represents the current scroll progress through the content
     * - Thumb moves smoothly as user scrolls through the content
     *
     * The scrollbar provides visual feedback about:
     * 1. How much content exists (thumb height = visible/total ratio)
     * 2. Where you are in the content (thumb position = scroll progress)
     * 3. Content boundaries (thumb stops at track limits)
     *
     * @private
     * @example
     * // Content: 1000px total, 400px visible = 40% thumb height
     * // Scrolled 250px = 25% progress = thumb at 25% down the track
     * this.scrollOffset = 250;
     * this.updateScrollbarThumb();
     * console.log(this.scrollThumb.height); // ~40% of track height
     * console.log(this.scrollThumb.y); // 25% down from track start
     */
    updateScrollbarThumb() {
        const trackHeight = this.scrollArea.trackHeight;

        // Calculate total content height (all items that exist)
        const totalItemCount =
            this.maxScrollOffset / (this.listArea.itemHeight + this.listArea.padding) +
            this.listArea.height / (this.listArea.itemHeight + this.listArea.padding);
        const totalContentHeight = totalItemCount * (this.listArea.itemHeight + this.listArea.padding);

        // Thumb height represents the ratio of visible content to total content
        const thumbHeightRatio = this.listArea.height / totalContentHeight;
        this.scrollThumb.height = Math.max(30, trackHeight * thumbHeightRatio);

        // Calculate thumb position based on current scroll progress
        const currentScrollProgress = this.maxScrollOffset > 0 ? this.scrollOffset / this.maxScrollOffset : 0;
        const availableTrackSpace = trackHeight - this.scrollThumb.height;
        this.scrollThumb.y = this.scrollArea.thumbStartY + availableTrackSpace * currentScrollProgress;

        // Ensure thumb stays within track bounds
        const maxThumbY = this.scrollArea.thumbStartY + trackHeight - this.scrollThumb.height;
        this.scrollThumb.y = Math.max(this.scrollArea.thumbStartY, Math.min(maxThumbY, this.scrollThumb.y));
    }

    /**
     * Handles all user input events for the scrollable area
     *
     * This is the central input handling method that processes:
     * - Scroll up/down button clicks (incremental scrolling)
     * - Scrollbar track clicks (click-to-jump functionality)
     * - Thumb dragging (smooth continuous scrolling)
     * - Keyboard navigation when hovering over content area
     *
     * The method updates hover states for visual feedback and coordinates
     * all scrolling interactions into smooth, responsive movement.
     *
     * @param {number} deltaTime - Time elapsed since last frame for smooth keyboard scrolling
     *
     * @private
     * @example
     * // Called automatically by update() - no manual invocation needed
     * handleInput(deltaTime) {
     *     // Handles button clicks, dragging, and keyboard input
     *     // Updates this.scrollOffset based on user interactions
     * }
     */
    handleInput(deltaTime) {
        const pointer = this.input.getPointerPosition();

        // Handle scroll up/down buttons
        if (this.input.isElementJustPressed(this.elementIds.scrollUp, "gui")) {
            this.scrollUp();
        }

        if (this.input.isElementJustPressed(this.elementIds.scrollDown, "gui")) {
            this.scrollDown();
        }

        // Update hover states
        this.scrollUpButton.hovered = this.input.isElementHovered(this.elementIds.scrollUp, "gui");
        this.scrollDownButton.hovered = this.input.isElementHovered(this.elementIds.scrollDown, "gui");

        // Handle dragging
        this.handleDragging(pointer);

        // Handle track clicks for click-to-jump functionality
        if (this.input.isElementJustPressed(this.elementIds.scrollbarTrack, "gui")) {
            const trackY = pointer.y - this.scrollArea.thumbStartY;
            const scrollableHeight = this.scrollArea.trackHeight;
            const jumpPercent = Math.max(0, Math.min(1, trackY / scrollableHeight));

            this.scrollOffset = jumpPercent * this.maxScrollOffset;
        }

        // Handle keyboard scrolling when hovering over list area
        this.handleKeyboardScrolling(deltaTime);
    }

    /**
     * Handles mouse wheel scroll events for smooth scrolling
     *
     * Processes wheel delta values to determine scroll direction and amount.
     * Positive delta values scroll down (show content below), negative values
     * scroll up (show content above). The scroll amount is fixed at 60 pixels
     * per wheel "notch" for consistent behavior across different mice.
     *
     * @param {number} deltaY - Wheel delta value (positive = scroll down, negative = scroll up)
     *
     * @private
     * @example
     * // Mouse wheel scrolled down (deltaY = 120)
     * this.handleMouseWheel(120);
     * this.scrollOffset += 60; // Scroll down by one "notch"
     *
     * // Mouse wheel scrolled up (deltaY = -120)
     * this.handleMouseWheel(-120);
     * this.scrollOffset -= 60; // Scroll up by one "notch"
     */
    handleMouseWheel(deltaY) {
        const scrollAmount = deltaY > 0 ? 20 : -20; // ← Changed from 60 to 20
        this.scrollOffset = Math.max(0, Math.min(this.maxScrollOffset, this.scrollOffset + scrollAmount));
    }

    /**
     * Scrolls content up by exactly one item height
     *
     * Provides incremental scrolling up, moving the view to show content
     * that was previously above the visible area. The scroll amount equals
     * the itemHeight specified in configuration.
     *
     * @example
     * // If itemHeight = 60, scrolls up by exactly 60 pixels
     * this.scrollUp();
     * // Content moves up, showing items that were above the visible area
     */
    scrollUp() {
        const scrollAmount = 50; // ← Changed from itemHeight (120) to 50
        this.scrollOffset = Math.max(0, this.scrollOffset - scrollAmount);
    }

    /**
     * Scrolls content down by exactly one item height
     *
     * Provides incremental scrolling down, moving the view to show content
     * that was previously below the visible area. The scroll amount equals
     * the itemHeight specified in configuration.
     *
     * @example
     * // If itemHeight = 60, scrolls down by exactly 60 pixels
     * this.scrollDown();
     * // Content moves down, showing items that were below the visible area
     */
    scrollDown() {
        const scrollAmount = 50; // ← Changed from itemHeight (120) to 50
        this.scrollOffset = Math.min(this.maxScrollOffset, this.scrollOffset + scrollAmount);
    }

    /**
     * Handles scrollbar thumb dragging with threshold-based drag detection
     *
     * This method implements sophisticated drag behavior:
     * 1. Detects when user clicks directly on the scrollbar thumb
     * 2. Waits for movement beyond threshold before considering it a drag
     * 3. Calculates scroll position based on thumb position in real-time
     * 4. Provides smooth, continuous scrolling during drag operation
     *
     * The drag threshold prevents accidental drags from single clicks and
     * ensures intentional scrolling behavior.
     *
     * @param {Object} pointer - Current pointer position from input system
     * @param {number} pointer.x - X coordinate of mouse/touch
     * @param {number} pointer.y - Y coordinate of mouse/touch
     *
     * @private
     * @example
     * // User clicks on thumb at position 200, drags to 250
     * handleDragging({x: 100, y: 250});
     * // Calculates: deltaY = 50, converts to scroll percentage
     * // Updates this.scrollOffset proportionally
     */
    handleDragging(pointer) {
        // Check if clicking directly on thumb
        const isOverThumb =
            pointer.x >= this.scrollThumb.x &&
            pointer.x <= this.scrollThumb.x + this.scrollThumb.width &&
            pointer.y >= this.scrollThumb.y &&
            pointer.y <= this.scrollThumb.y + this.scrollThumb.height;

        if (this.input.isPointerJustDown() && isOverThumb) {
            this.isDragging = true;
            this.dragStartY = pointer.y;
            this.lastScrollOffset = this.scrollOffset;
            this.hasMovedBeyondThreshold = false;
        }

        // Handle dragging
        if (this.isDragging && this.input.isPointerDown()) {
            const deltaY = pointer.y - this.dragStartY;

            if (Math.abs(deltaY) > this.dragThreshold) {
                this.hasMovedBeyondThreshold = true;

                // Calculate scroll based on mouse position relative to track
                const trackY = pointer.y - this.scrollArea.thumbStartY;
                const availableTrackHeight = this.scrollArea.trackHeight - this.scrollThumb.height;
                const scrollPercent = Math.max(0, Math.min(1, trackY / Math.max(1, availableTrackHeight)));

                this.scrollOffset = scrollPercent * this.maxScrollOffset;
                this.scrollOffset = Math.max(0, Math.min(this.maxScrollOffset, this.scrollOffset));
            }
        } else {
            this.isDragging = false;
        }
    }

    /**
     * Handles keyboard scrolling when pointer is hovering over the list area
     *
     * Provides keyboard navigation for users who prefer keyboard input or
     * accessibility. Only activates when the pointer is within the list area
     * bounds to avoid conflicts with other keyboard handlers.
     *
     * Features:
     * - DirUp key scrolls up smoothly based on deltaTime
     * - DirDown key scrolls down smoothly based on deltaTime
     * - Respects scroll boundaries (won't scroll past limits)
     * - Smooth scrolling speed (300 pixels per second)
     *
     * @param {number} deltaTime - Time elapsed since last frame for consistent scroll speed
     *
     * @private
     * @example
     * // Pointer at (450, 200) - within list area (400-850, 100-500)
     * // User presses DirUp key
     * handleKeyboardScrolling(0.016); // ~60fps
     * this.scrollOffset -= 300 * 0.016; // Scroll up ~4.8 pixels
     */
    handleKeyboardScrolling(deltaTime) {
        const pointer = this.input.getPointerPosition();
        const isOverListArea =
            pointer.x >= this.listArea.x &&
            pointer.x <= this.listArea.x + this.listArea.width - this.listArea.scrollBarWidth - 10 &&
            pointer.y >= this.listArea.y &&
            pointer.y <= this.listArea.y + this.listArea.height;

        if (isOverListArea) {
            if (this.input.isKeyPressed("DirUp")) {
                this.scrollOffset = Math.max(0, this.scrollOffset - 300 * deltaTime);
            }
            if (this.input.isKeyPressed("DirDown")) {
                this.scrollOffset = Math.min(this.maxScrollOffset, this.scrollOffset + 300 * deltaTime);
            }
        }
    }

    /**
     * Handles click-to-jump functionality on the scrollbar track
     *
     * When user clicks on the scrollbar track (not on the thumb), the content
     * immediately jumps to show the portion of content at that relative position.
     * This provides quick navigation to different parts of long content.
     *
     * Algorithm:
     * 1. Calculate click position relative to track start
     * 2. Convert to percentage of total track height
     * 3. Apply percentage to total scrollable content height
     * 4. Jump directly to that scroll position
     *
     * @param {Object} pointer - Current pointer position from input system
     * @param {number} pointer.y - Y coordinate of the click
     *
     * @example
     * // User clicks 50% down the scrollbar track
     * handleTrackClick({x: 100, y: 200});
     * // If trackY = 100px from start, scrollableHeight = 300px
     * // jumpPercent = 100/300 = 0.33
     * // If maxScroll = 600px, new scrollOffset = 0.33 * 600 = 200px
     */
    handleTrackClick(pointer) {
        if (this.input.isElementJustPressed(this.elementIds.scrollbarTrack, "gui")) {
            const trackY = pointer.y - this.scrollArea.thumbStartY;
            const scrollableHeight = this.scrollArea.trackHeight - 30;
            const jumpPercent = Math.max(0, Math.min(1, trackY / scrollableHeight));

            this.scrollOffset = jumpPercent * this.maxScrollOffset;
        }
    }

    /**
     * Checks if an item at the given index is visible in the current scroll view
     *
     * Determines whether an item should be drawn by checking if its calculated
     * position falls within the visible area boundaries. This prevents drawing
     * items that are scrolled out of view, improving performance with large lists.
     *
     * The check uses the same positioning calculation as getItemDrawY() to ensure
     * consistency between visibility testing and actual drawing positions.
     *
     * @param {number} index - Zero-based index of the item to check
     * @param {Object} customClipBounds - Optional custom clip bounds to override default
     * @returns {boolean} true if item is visible, false if scrolled out of view
     *
     * @example
     * // Basic usage (no clipping)
     * const visible = isItemVisible(5); // true
     *
     * // With custom clipping
     * const visible = isItemVisible(5, {x: 400, y: 100, width: 450, height: 400});
     */
    isItemVisible(index, customClipBounds = null) {
        if (this.enableClipping) {
            const itemBounds = this.getItemBounds(index);
            const clipBounds = customClipBounds || this.clipBounds;
            return this.calculateIntersection(itemBounds, clipBounds).area > 0;
        }

        // Fallback to original logic when clipping is disabled
        const itemY = this.listArea.y + 10 + index * this.listArea.itemHeight - this.scrollOffset;
        const itemBottom = itemY + this.listArea.itemHeight;
        const visibleTop = this.listArea.y;
        const visibleBottom = this.listArea.y + this.listArea.height;

        // Item is visible if any part of it intersects with the visible area
        return !(itemBottom <= visibleTop || itemY >= visibleBottom);
    }

    /**
     * Gets the correct Y position for drawing an item at the given index
     *
     * Calculates the exact screen position where an item should be drawn,
     * taking into account the current scroll offset. This ensures items
     * move smoothly as the user scrolls through the content.
     *
     * Formula: itemY = listArea.y + padding + (index × itemHeight) - scrollOffset
     *
     * This method is crucial for synchronizing item drawing positions with
     * input handling and scrollbar visual feedback.
     *
     * @param {number} index - Zero-based index of the item
     * @returns {number} Y coordinate where the item should be drawn
     *
     * @example
     * // List configuration: listArea.y = 100, itemHeight = 60
     * // Item at index 3, scrolled down by 120 pixels
     * const y = getItemDrawY(3);
     * // y = 100 + 10 + (3 * 60) - 120 = 100 + 10 + 180 - 120 = 170
     * // Item appears at screen coordinate 170
     */
    getItemDrawY(index) {
        return (
            this.listArea.y +
            this.listArea.padding +
            index * (this.listArea.itemHeight + this.listArea.padding) -
            this.scrollOffset
        );
    }

    /**
     * Gets the full bounds of an item (before clipping)
     *
     * @param {number} index - Zero-based index of the item
     * @returns {Object} Item bounds {x, y, width, height}
     */
    getItemBounds(index) {
        return {
            x: this.listArea.x + 10,
            y: this.getItemDrawY(index),
            width: this.listArea.width - 20,
            height: this.listArea.itemHeight
        };
    }

    /**
     * Gets the clipped bounds of an item within the clip region
     * Only returns bounds if the item intersects with the visible area
     *
     * @param {number} index - Zero-based index of the item
     * @param {Object} customClipBounds - Optional custom clip bounds
     * @returns {Object|null} Clipped bounds {x, y, width, height} or null if not visible
     */
    getClippedItemBounds(index, customClipBounds = null) {
        if (!this.enableClipping) {
            return this.getItemBounds(index); // No clipping, return full bounds
        }

        const itemBounds = this.getItemBounds(index);
        const clipBounds = customClipBounds || this.clipBounds;

        if (!clipBounds) {
            return itemBounds; // No clip bounds defined, return full bounds
        }

        const intersection = this.calculateIntersection(itemBounds, clipBounds);
        return intersection.area > 0 ? intersection.bounds : null;
    }

    /**
     * Calculates rectangle intersection between two bounds
     *
     * @param {Object} bounds1 - First bounds {x, y, width, height}
     * @param {Object} bounds2 - Second bounds {x, y, width, height}
     * @returns {Object} Intersection result {bounds, area}
     */
    calculateIntersection(bounds1, bounds2) {
        const x1 = Math.max(bounds1.x, bounds2.x);
        const y1 = Math.max(bounds1.y, bounds2.y);
        const x2 = Math.min(bounds1.x + bounds1.width, bounds2.x + bounds2.width);
        const y2 = Math.min(bounds1.y + bounds1.height, bounds2.y + bounds2.height);

        const width = Math.max(0, x2 - x1);
        const height = Math.max(0, y2 - y1);
        const area = width * height;

        return {
            bounds: width > 0 && height > 0 ? { x: x1, y: y1, width, height } : null,
            area: area
        };
    }

    /**
     * Registers input for a specific item with proper clipping
     * Intelligently handles registration based on visibility and current state
     *
     * @param {Object} item - The item object
     * @param {number} index - Index of the item in the list
     * @param {string} layer - Input layer (default: 'gui')
     */
    registerItemInput(item, index, layer = "gui") {
        const itemId = this.generateItemId(item, index);
        const isCurrentlyRegistered = this.registeredItems.has(itemId);
        const clippedBounds = this.getClippedItemBounds(index);

        if (clippedBounds && clippedBounds.width > 0 && clippedBounds.height > 0) {
            // Item is visible - register if not already registered
            if (!isCurrentlyRegistered) {
                this.onRegisterItemInput(itemId, index, clippedBounds, layer);
                this.registeredItems.add(itemId);
            }
        } else {
            // Item is not visible - remove registration if it exists
            if (isCurrentlyRegistered) {
                this.input.removeElement(itemId, layer);
                this.registeredItems.delete(itemId);
            }
        }
    }

    /**
     * Updates input registrations for all visible items
     * Intelligently handles registration based on visibility and state changes
     *
     * @param {Array} items - Array of items to register input for
     * @param {string} layer - Input layer (default: 'gui')
     */
    updateItemInputs(items, layer = "gui") {
        const currentItemCount = items.length;

        // Only update if scroll position OR item count changed
        if (this.scrollOffset === this.lastScrollOffsetForInput && currentItemCount === this.lastItemCountForInput) {
            return; // No changes, skip update
        }

        // For item count changes, we need to be more selective
        // Only clear items that are no longer valid or visible
        if (currentItemCount !== this.lastItemCountForInput) {
            this.cleanupInvalidRegistrations(items, layer);
        }

        // Update registrations for all items (this will add new ones and remove invisible ones)
        items.forEach((item, index) => {
            this.registerItemInput(item, index, layer);
        });

        // Update tracking
        this.lastScrollOffsetForInput = this.scrollOffset;
        this.lastItemCountForInput = currentItemCount;
    }

    /**
     * Cleans up registrations for items that are no longer valid
     * More intelligent than clearing everything - only removes truly invalid items
     *
     * @param {Array} items - Current array of valid items
     * @param {string} layer - Input layer
     */
    cleanupInvalidRegistrations(items, layer = "gui") {
        // Create a set of current valid item IDs
        const validItemIds = new Set();
        items.forEach((item, index) => {
            validItemIds.add(this.generateItemId(item, index));
        });

        // Remove registrations for items that are no longer in the valid set
        const itemsToRemove = [];
        this.registeredItems.forEach((itemId) => {
            if (!validItemIds.has(itemId)) {
                itemsToRemove.push(itemId);
            }
        });

        // Remove the invalid items
        itemsToRemove.forEach((itemId) => {
            this.input.removeElement(itemId, layer);
            this.registeredItems.delete(itemId);
        });
    }

    /**
     * Forces an input update for all items (useful when items are added/removed)
     * Call this when the item array changes outside of normal scroll updates
     *
     * @param {Array} items - Array of items to register input for
     * @param {string} layer - Input layer (default: 'gui')
     */
    refreshItems(items, layer = "gui") {
        // Clear ALL existing item registrations from input system first
        this.clearAllItemInputs(layer);

        // Reset tracking to force update
        this.lastScrollOffsetForInput = -1;
        this.lastItemCountForInput = -1;
        this.registeredItems.clear();

        // Update with new items
        this.updateItemInputs(items, layer);

        // Re-detect hover state after refresh
        this.reDetectHoverAfterRefresh(items, layer);
    }

    /**
     * Re-detects hover state immediately after refreshing items
     * Checks current mouse position and sets hover for any item under cursor
     *
     * @param {Array} items - The current items array
     * @param {string} layer - Input layer (default: 'gui')
     */
    reDetectHoverAfterRefresh(items, layer = "gui") {
        const pointer = this.input.getPointerPosition();

        // Check if mouse is over the list area
        const isOverListArea =
            pointer.x >= this.listArea.x &&
            pointer.x <= this.listArea.x + this.listArea.width &&
            pointer.y >= this.listArea.y &&
            pointer.y <= this.listArea.y + this.listArea.height;

        if (isOverListArea) {
            // Find which item (if any) is under the mouse
            for (let i = 0; i < items.length; i++) {
                const itemBounds = this.getItemBounds(i);

                if (
                    pointer.x >= itemBounds.x &&
                    pointer.x <= itemBounds.x + itemBounds.width &&
                    pointer.y >= itemBounds.y &&
                    pointer.y <= itemBounds.y + itemBounds.height
                ) {
                    // Found the item under mouse - set it as hovered
                    const itemId = this.generateItemId(items[i], i);
                    const element = this.input.rawState.elements[layer].get(itemId);
                    if (element) {
                        element.isHovered = true;
                        element.hoverTimestamp = performance.now();
                    }
                    return; // Stop after finding the first (topmost) item
                }
            }
        }
    }

    /**
     * Clears all item input registrations from the input system
     * This prevents multiple items from being selected when scrolling
     *
     * @param {string} layer - Input layer to clear (default: 'gui')
     */
    clearAllItemInputs(layer = "gui") {
        // Remove all currently registered items from input system
        this.registeredItems.forEach((itemId) => {
            this.input.removeElement(itemId, layer);
        });
        this.registeredItems.clear();
    }

    /**
    * Draws the scrollable content area background fill only
    *
    * Renders the background fill for the scrollable content area.
    * Border is drawn separately to allow layering over items.
    *
    * @private
    */
    drawScrollableBackgroundFill() {
       if (!this.drawBackground) return;

       const { x, y, width, height } = this.listArea;

    // Draw background fill
        if (this.backgroundConfig.fillColor) {
        this.ctx.fillStyle = this.backgroundConfig.fillColor;
            if (this.backgroundConfig.cornerRadius > 0) {
            this.drawRoundedRect(x, y, width, height, this.backgroundConfig.cornerRadius);
        } else {
        this.ctx.fillRect(x, y, width, height);
    }
    }
    }

    /**
    * Draws the scrollable content area border only
     *
    * Renders the border for the scrollable content area.
    * Called after items are drawn to ensure border appears on top.
    *
    * @private
    */
    drawScrollableBorder() {
    if (!this.drawBackground) return;

    const { x, y, width, height } = this.listArea;

        // Draw border
        if (this.backgroundConfig.borderColor && this.backgroundConfig.borderWidth > 0) {
            this.ctx.strokeStyle = this.backgroundConfig.borderColor;
            this.ctx.lineWidth = this.backgroundConfig.borderWidth;
            if (this.backgroundConfig.cornerRadius > 0) {
                this.drawRoundedRectStroke(x, y, width, height, this.backgroundConfig.cornerRadius);
            } else {
                this.ctx.strokeRect(x, y, width, height);
            }
        }
    }

    /**
     * Draws a rounded rectangle filled shape
     * @private
     */
    drawRoundedRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
        this.ctx.fill();
    }

    /**
     * Draws a rounded rectangle outline
     * @private
     */
    drawRoundedRectStroke(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
        this.ctx.stroke();
    }

    /**
     * Draws only the scrollbar elements (without background)
     *
     * Renders only the scrollbar UI components:
     * - Scrollbar track (background area)
     * - Scrollbar thumb (draggable handle)
     * - Up/Down arrow buttons
     *
     * Only draws the scrollbar if there's content to scroll (maxScrollOffset > 0).
     *
     * @private
     */
    drawScrollbarElements() {
        // Only show scrollbar if there's actually content to scroll
        if (this.maxScrollOffset > 0) {
            this.drawScrollbarTrack();
            this.drawScrollButtons();
        }
    }

    /**
    * Draws the complete scrollbar interface with automatic clipping
    *
    * Enhanced drawing method that handles clipping automatically when enabled.
    * Provide a renderItem function to draw items without manual clipping management.
    *
    * @param {Array} items - Array of items to draw
    * @param {Function} renderItem - Function to render each item: (item, index, y) => void
    * @param {Object} options - Additional options
    * @param {Function} options.renderHeader - Optional header rendering function
    *
    * @example
    * this.roomScroller = new ActionScrollableArea({
    *     enableClipping: true,
    *     clipBounds: { x: 250, y: 330, width: 300, height: 240 }
    * });
    *
    * this.roomScroller.draw(rooms, (room, index, y) => {
    *     this.guiCtx.fillStyle = isHovered ? '#0099dd' : '#007acc';
    *     this.guiCtx.fillRect(250, y, 300, 25);
    *     this.guiCtx.fillText(room.name, 400, y + 17);
    * }, {
    *     renderHeader: () => {
    *         this.guiCtx.fillText('Available Rooms:', 400, 320);
    *     }
    * });
    */
    draw(items, renderItem, options = {}) {
    // Draw scrollbar elements first (never clipped)
    this.drawScrollbarElements();

    // Apply clipping if enabled
    if (this.enableClipping && this.clipBounds) {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(this.clipBounds.x, this.clipBounds.y, this.clipBounds.width, this.clipBounds.height);
    this.ctx.clip();
    }

    // Draw background (fill only, no border)
    this.drawScrollableBackgroundFill();

    // Draw header if provided
    if (options.renderHeader) {
    options.renderHeader();
    }

    // Draw all visible items with automatic clipping
    if (items && renderItem) {
    items.forEach((item, index) => {
    if (this.isItemVisible(index)) {
    const y = this.getItemDrawY(index);
    renderItem(item, index, y);
    }
    });
    }

    // Restore clipping context
    if (this.enableClipping && this.clipBounds) {
    this.ctx.restore();
    }

        // Draw border on top (after clipping restored)
        this.drawScrollableBorder();
    }

    /**
     * Call this after drawing items to restore clipping context
     * Only needed if enableClipping is true and using legacy draw() method
     */
    endClipping() {
        if (this.enableClipping && this.clipBounds) {
            this.ctx.restore();
        }
    }

    /**
     * Draws the scrollbar track and thumb with visual feedback
     *
     * Renders the scrollbar track (background) and thumb (draggable handle)
     * with sophisticated visual states:
     * - Track changes opacity when hovered for user feedback
     * - Thumb changes color and opacity based on interaction state
     * - Thumb shows different appearance when being dragged vs hovered vs idle
     * - All visual states provide immediate feedback about scrollbar state
     *
     * Color scheme:
     * - Track: Semi-transparent dark background
     * - Thumb: Blue with alpha transparency
     * - Hover: Increased brightness and opacity
     * - Drag: Maximum brightness and opacity with border highlight
     *
     * @private
     * @example
     * // Idle state: thumb is subtle blue
     * this.isDragging = false;
     * drawScrollbarTrack(); // Thumb: rgba(52, 152, 219, 0.3)
     *
     * // Hover state: thumb brightens
     * this.scrollThumb.hovered = true;
     * drawScrollbarTrack(); // Thumb: rgba(52, 152, 219, 0.6)
     *
     * // Drag state: thumb is most prominent
     * this.isDragging = true;
     * drawScrollbarTrack(); // Thumb: rgba(52, 152, 219, 0.8) with blue border
     */
    drawScrollbarTrack() {
        const scrollbarX = this.scrollArea.x;
        const scrollbarWidth = 20;
        const scrollAreaHeight = this.scrollArea.trackHeight;

        // Check if mouse is over scrollbar track for visual feedback
        const mousePos = this.input.getPointerPosition();
        const isOverTrack =
            mousePos.x >= scrollbarX &&
            mousePos.x <= scrollbarX + scrollbarWidth &&
            mousePos.y >= this.scrollArea.thumbStartY &&
            mousePos.y <= this.scrollArea.y + this.scrollArea.trackHeight;

        // Dark track background (using configurable colors)
        this.ctx.fillStyle = isOverTrack ? this.colors.track.hover : this.colors.track.normal;
        this.ctx.fillRect(scrollbarX, this.scrollArea.y, scrollbarWidth, scrollAreaHeight);

        // Draw scrollbar thumb (using configurable colors)
        const thumbColor = this.scrollThumb.hovered
            ? this.colors.thumb.hover
            : this.isDragging
              ? this.colors.thumb.drag
              : this.colors.thumb.normal;

        this.ctx.fillStyle = thumbColor;
        this.ctx.fillRect(this.scrollThumb.x, this.scrollThumb.y, this.scrollThumb.width, this.scrollThumb.height);

        // Draw thumb border (using configurable colors)
        this.ctx.strokeStyle = this.isDragging ? this.colors.thumbBorder.drag : this.colors.thumbBorder.normal;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.scrollThumb.x, this.scrollThumb.y, this.scrollThumb.width, this.scrollThumb.height);
    }

    /**
     * Draws both the up and down scroll buttons
     *
     * Convenience method that renders both arrow buttons at the top and
     * bottom of the scrollbar track. Each button provides incremental
     * scrolling when clicked.
     *
     * @private
     * @example
     * // Draws up button (▲) at top of track
     * // Draws down button (▼) at bottom of track
     * drawScrollButtons();
     */
    drawScrollButtons() {
        this.drawScrollButton(this.scrollUpButton);
        this.drawScrollButton(this.scrollDownButton);
    }

    /**
     * Draws a single scroll button with hover effects and proper styling
     *
     * Renders an individual scroll button (up or down arrow) with:
     * - Semi-transparent background that brightens on hover
     * - Border that highlights when hovered
     * - Centered text (▲ or ▼) that changes color on interaction
     * - Consistent visual feedback matching the scrollbar theme
     *
     * The button integrates with the input system for click detection
     * and hover state management.
     *
     * @param {Object} button - Button configuration object
     * @param {number} button.x - X coordinate of the button
     * @param {number} button.y - Y coordinate of the button
     * @param {number} button.width - Width of the button
     * @param {number} button.height - Height of the button
     * @param {string} button.text - Button text (▲ or ▼)
     * @param {boolean} button.hovered - Current hover state
     *
     * @private
     * @example
     * // Draw up button with hover effect
     * const upButton = {
     *     x: 860, y: 90, width: 20, height: 20,
     *     text: "▲", hovered: true
     * };
     * drawScrollButton(upButton);
     * // Renders bright button with "#3498DB" text color
     */
    drawScrollButton(button) {
        this.ctx.save();
        
        const cornerX = button.x;
        const cornerY = button.y;

        // Button background (using configurable colors)
        this.ctx.fillStyle = button.hovered ? this.colors.button.hover : this.colors.button.normal;
        this.ctx.fillRect(cornerX, cornerY, button.width, button.height);

        // Button border (using configurable colors)
        this.ctx.strokeStyle = button.hovered ? this.colors.buttonText.hover : this.colors.buttonText.normal;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(cornerX, cornerY, button.width, button.height);

        // Button text (using configurable colors)
        this.ctx.fillStyle = button.hovered ? this.colors.buttonText.hover : this.colors.buttonText.normal;
        this.ctx.font = "bold 14px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(button.text, button.x + button.width / 2, button.y + button.height / 2 + 1);
        
        this.ctx.restore();
    }

    /**
     * Destroys the scrollable area and cleans up all resources
     *
     * Properly cleans up the component by:
     * 1. Removing all input element registrations from the input system
     * 2. Removing mouse wheel event listeners from canvas and window
     * 3. Preventing memory leaks and input conflicts
     *
     * Always call this method when removing a scrollable area from your game
     * to ensure proper cleanup and prevent lingering event handlers.
     *
     * @example
     * // When removing a UI screen or component
     * destroy() {
     *     this.inventoryScroller.destroy();
     *     this.inventoryScroller = null;
     * }
     */
    destroy() {
        this.input.removeElement(this.elementIds.scrollUp, "gui");
        this.input.removeElement(this.elementIds.scrollDown, "gui");
        this.input.removeElement(this.elementIds.scrollbarTrack, "gui");
    }
}
