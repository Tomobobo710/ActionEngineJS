//actionengine/rendering/renderers/actionrenderer3D/canvasmanager3D.js
class CanvasManager3D {
    constructor(canvas) {
        this.canvas = canvas;
        this._clearColor = [0.529, 0.808, 0.922, 1.0]; // Default light blue

        // --- WebXR (additive, opt-in) ---
        // When an immersive session is active, ActionXR points xrFramebuffer at the
        // XRWebGLLayer's framebuffer so resetToDefaultFramebuffer() targets the headset
        // instead of the canvas backbuffer (null). suppressClear lets the XR loop clear the
        // shared stereo framebuffer exactly ONCE per frame (before the eye loop) rather than
        // once per eye — a per-eye clear would wipe the eye drawn just before it.
        // Both default to the no-op values, so flatscreen rendering is completely unchanged.
        this.xrFramebuffer = null;
        this.suppressClear = false;

        this.initializeContext();
    }

    initializeContext() {
        // xrCompatible:true asks the browser to create the context on the same adapter the XR
        // device presents from, so requesting a session later never forces a context loss +
        // re-create. It's harmless (ignored) when no XR hardware is present.
        this.gl = this.canvas.getContext("webgl2", { xrCompatible: true });
        if (!this.gl) {
            throw new Error("WebGL2 not supported");
        }
        console.log("[CanvasManager3D] Using WebGL 2.0");
    }
    
    getContext() {
        return this.gl;
    }
    
    clear() {
        // In XR the stereo framebuffer is cleared once per frame by ActionXR, not once per eye.
        if (this.suppressClear) return;
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }

    resetToDefaultFramebuffer() {
        // xrFramebuffer is null on flatscreen (== the default backbuffer), or the XRWebGLLayer
        // framebuffer while an immersive session is running.
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.xrFramebuffer);
    }
    
    setClearColor(r, g, b, a = 1.0) {
        this._clearColor = [r, g, b, a];
        this.gl.clearColor(r, g, b, a);
    }
}
