// actionengine/xr/actionxr.js
//
// ActionXR — minimal, additive WebXR session manager for ActionEngine.
//
// Responsibilities (Phase 0):
//   - detect immersive-vr support
//   - request/end an immersive session from a user gesture
//   - make the engine's WebGL2 context XR-compatible and attach an XRWebGLLayer
//   - drive an XR frame loop and hand each frame's XRViewerPose to a render callback
//
// It does NOT know anything about the scene. The game supplies an onFrame callback and does the
// per-eye rendering (viewport + camera matrices), because that wiring is engine/renderer specific.
//
// Nothing here runs unless start() is called, so importing this file has zero effect on the
// existing flatscreen path.
class ActionXR {
    constructor(gl, canvasManager) {
        this.gl = gl;
        this.canvasManager = canvasManager; // CanvasManager3D — we flip its xrFramebuffer/suppressClear
        this.session = null;
        this.refSpace = null;
        this.baseLayer = null;
        this._onFrame = null;
        this._onEnd = null;
        this._loop = this._loop.bind(this);
    }

    // WebXR is only exposed on secure contexts (https:// or http://localhost). On the Quest
    // browser over LAN that means either HTTPS or `adb reverse` to localhost (see VR_SPIKE.md).
    static async isSupported() {
        if (!("xr" in navigator) || !navigator.xr) return false;
        try {
            return await navigator.xr.isSessionSupported("immersive-vr");
        } catch (e) {
            return false;
        }
    }

    get isPresenting() {
        return !!this.session;
    }

    /**
     * Enter immersive VR. Must be called from a user gesture (click), per the WebXR spec.
     * @param {(time:number, frame:XRFrame, pose:XRViewerPose, layer:XRWebGLLayer, session:XRSession)=>void} onFrame
     * @param {{onEnd?:Function, referenceSpace?:string}} [opts]
     */
    async start(onFrame, opts = {}) {
        if (this.session) return this.session;
        this._onFrame = onFrame;
        this._onEnd = opts.onEnd || null;

        // Ensure the context can present to the XR device. If it was created with
        // { xrCompatible:true } this resolves instantly; otherwise the browser may need to
        // migrate the context to the XR GPU here.
        if (this.gl.makeXRCompatible) {
            await this.gl.makeXRCompatible();
        }

        const session = await navigator.xr.requestSession("immersive-vr", {
            // local-floor puts the origin on the physical floor with a real-world scale (meters),
            // which is what the physics scene assumes. Fall back to local if the runtime lacks it.
            optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"]
        });
        this.session = session;

        // One XRWebGLLayer backs both eyes; getViewport(view) slices it per eye each frame.
        this.baseLayer = new XRWebGLLayer(session, this.gl);
        session.updateRenderState({ baseLayer: this.baseLayer });

        // Point the engine's framebuffer target + clear policy at the headset.
        this.canvasManager.xrFramebuffer = this.baseLayer.framebuffer;

        this.refSpace = await this._requestRefSpace(session, opts.referenceSpace);

        session.addEventListener("end", () => this._handleEnd());

        session.requestAnimationFrame(this._loop);
        return session;
    }

    async end() {
        if (this.session) await this.session.end(); // triggers the 'end' event → _handleEnd
    }

    async _requestRefSpace(session, preferred) {
        const order = preferred ? [preferred, "local-floor", "local"] : ["local-floor", "local"];
        for (const type of order) {
            try {
                return await session.requestReferenceSpace(type);
            } catch (e) {
                /* try next */
            }
        }
        throw new Error("[ActionXR] No usable reference space (local-floor/local both failed).");
    }

    _handleEnd() {
        // Restore the flatscreen path exactly as it was.
        this.canvasManager.xrFramebuffer = null;
        this.canvasManager.suppressClear = false;
        this.session = null;
        this.refSpace = null;
        this.baseLayer = null;
        if (this._onEnd) this._onEnd();
    }

    _loop(time, frame) {
        const session = this.session;
        if (!session) return;

        // Schedule the next frame first so a throw in onFrame doesn't kill the loop.
        session.requestAnimationFrame(this._loop);

        const pose = frame.getViewerPose(this.refSpace);
        if (!pose) return; // tracking not yet available this frame

        const gl = this.gl;
        const layer = session.renderState.baseLayer;

        // Bind the stereo framebuffer and clear it ONCE for both eyes.
        gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
        gl.clearColor(0.5, 0.7, 0.9, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // The game clears per-eye clears itself via canvasManager.suppressClear.
        this._onFrame(time, frame, pose, layer, session);
    }
}

if (typeof window !== "undefined") window.ActionXR = ActionXR;
