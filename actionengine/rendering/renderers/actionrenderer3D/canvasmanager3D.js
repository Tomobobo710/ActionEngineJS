//actionengine/rendering/renderers/actionrenderer3D/canvasmanager3D.js
class CanvasManager3D {
    constructor(canvas) {
        this.canvas = canvas;
        this._clearColor = [0.529, 0.808, 0.922, 1.0]; // Default light blue
        this.initializeContext();
    }
    
    initializeContext() {
        this.gl = this.canvas.getContext("webgl2");
        if (!this.gl) {
            throw new Error("WebGL2 not supported");
        }
        console.log("[CanvasManager3D] Using WebGL 2.0");
    }
    
    getContext() {
        return this.gl;
    }
    
    clear() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }
    
    resetToDefaultFramebuffer() {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }
    
    setClearColor(r, g, b, a = 1.0) {
        this._clearColor = [r, g, b, a];
        this.gl.clearColor(r, g, b, a);
    }
}
