// actionengine/display/canvasmanager.js
class CanvasManager {
    static get WIDTH() { return 800; }
    static get HEIGHT() { return 600; }

    constructor() {
        this.container = document.getElementById("appContainer");

        // Create the three canvases with explicit roles
        this.gameCanvas = this.createCanvas("gameCanvas"); // Pure game rendering
        this.guiCanvas = this.createCanvas("guiCanvas"); // All UI/interactive elements
        this.debugCanvas = this.createCanvas("debugCanvas"); // Debug overlay

        // Get 2D contexts
        this.guiCtx = this.guiCanvas.getContext("2d");
        this.debugCtx = this.debugCanvas.getContext("2d");

        // Note: We don't get game context here as it might be 2D or WebGL

        this.setupCanvasStyles();
        this.setupResizeHandler();
        this.resizeCanvases();
    }

    createCanvas(id) {
        const canvas = document.createElement("canvas");
        canvas.id = id;
        canvas.width = CanvasManager.WIDTH;
        canvas.height = CanvasManager.HEIGHT;
        this.container.appendChild(canvas);
        return canvas;
    }

    setupCanvasStyles() {
        // Game canvas is base layer
        this.gameCanvas.style.zIndex = "1";

        // GUI canvas gets events and overlays game
        this.guiCanvas.style.zIndex = "2";

        // Debug on top, no events
        this.debugCanvas.style.zIndex = "3";
    }

    setupResizeHandler() {
        window.addEventListener("resize", () => this.resizeCanvases());
        window.addEventListener("orientationchange", () => this.resizeCanvases());
    }

    resizeCanvases() {
        const containerWidth = this.container.clientWidth;
        const containerHeight = this.container.clientHeight;

        const scale = Math.min(containerWidth / CanvasManager.WIDTH, containerHeight / CanvasManager.HEIGHT);

        const scaledWidth = CanvasManager.WIDTH * scale;
        const scaledHeight = CanvasManager.HEIGHT * scale;

        // Apply scaling to all canvases
        [this.gameCanvas, this.guiCanvas, this.debugCanvas].forEach((canvas) => {
            canvas.style.width = `${scaledWidth}px`;
            canvas.style.height = `${scaledHeight}px`;
        });
    }

    getCanvases() {
        return {
            gameCanvas: this.gameCanvas,
            guiCanvas: this.guiCanvas,
            debugCanvas: this.debugCanvas,
            guiCtx: this.guiCtx,
            debugCtx: this.debugCtx
        };
    }
}