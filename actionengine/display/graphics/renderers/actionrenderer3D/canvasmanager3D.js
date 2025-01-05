// actionengine/display/graphics/renderers/actionrenderer3D/weatherrenderer3D.js
class CanvasManager3D {
    constructor(canvas) {
        this.canvas = canvas;
        this.initializeContext();
        this.initializeGLState();
    }

    initializeContext() {
        this.gl = this.canvas.getContext("webgl2");
        if (!this.gl) {
            this.gl = this.canvas.getContext("webgl");
            if (!this.gl) {
                throw new Error("WebGL not supported");
            }
            this._isWebGL2 = false;  // Changed to _isWebGL2
            console.log("[CanvasManager3D] Using WebGL 1.0");
        } else {
            this._isWebGL2 = true;   // Changed to _isWebGL2
            console.log("[CanvasManager3D] Using WebGL 2.0");
        }
    }

    initializeGLState() {
        // Basic setup
        this.gl.clearColor(0.529, 0.808, 0.922, 1.0);
        this.gl.viewport(0, 0, Game.WIDTH, Game.HEIGHT);

        // Depth testing setup
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);

        // Face culling setup
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.frontFace(this.gl.CCW);
        this.gl.cullFace(this.gl.BACK);

        // Disable blending by default
        this.gl.disable(this.gl.BLEND);
    }

    getContext() {
        return this.gl;
    }

    isWebGL2() {
        return this._isWebGL2;  // Return the private property
    }

    clear() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }

    setViewport(width, height) {
        this.gl.viewport(0, 0, width, height);
    }

    enableBlending() {
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    }

    disableBlending() {
        this.gl.disable(this.gl.BLEND);
    }

    bindFramebuffer(framebuffer) {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    }

    resetToDefaultFramebuffer() {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.setViewport(Game.WIDTH, Game.HEIGHT);
        this.gl.clearColor(0.529, 0.808, 0.922, 1.0);
    }
}