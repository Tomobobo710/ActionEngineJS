# ActionEngine VR

> **Update — VR is now engine-native and on by default in the packaged demo.**
> The controller/locomotion work prototyped in the `arcade/` repo (`arcade/game/vr.js`) has been
> backported into the engine as a generic driver, and `core/app.js` was made XR-aware. Any
> `App`-based game — `demo.js` / `index.html`'s `game.js` included — now gets an **Enter VR** button
> automatically when the runtime supports `immersive-vr`, with **no per-game code**.
>
> **What was added/changed for the backport:**
> - **`actionengine/xr/actionxr.js`** — WebXR session manager (unchanged from the spike; identical to the arcade's).
> - **`actionengine/xr/actionvr.js`** — **New.** `ActionVR`, a de-arcade'd generic driver: head-tracked
>   stereo + smooth locomotion (left stick glides the tracking origin relative to head gaze) + snap
>   turn (right stick) + controller buttons forwarded to the engine's virtual actions (Action1..10).
>   It owns the tracking-space origin itself, so "walk around" works in any scene without a bespoke
>   character controller. Disables the shadow pass + sun sprite while presenting (both fight the
>   per-eye loop), and restores them on exit.
> - **`actionengine/core/app.js`** — refactored `loop()` into `_update(now)→alpha` + draw; when
>   presenting, the flat RAF chain suspends and the XR session drives `_frameXR`, which runs the same
>   update phases then delegates the draw to `ActionVR.renderStereo` (scene drawn once per eye). Adds
>   `_setupVR()` (feature-detect + inject the Enter VR button) and `_onVRStart/_onVREnd`.
> - **`demo.html` / `index.html`** — load the two `xr/` scripts before `core/app.js`.
>
> **Run the demo in VR:** `node serve.js`, `adb reverse tcp:8080 tcp:8080`, open
> `http://localhost:8080/demo.html` in the Quest browser (localhost is a secure context) and press
> Enter VR. Same `adb reverse` / HTTPS options as the spike below.
>
> **Not yet backported (scope was controllers + locomotion):** the world-space clickable UI panel +
> laser (so 2D menus work in VR) and modelled hands — see the arcade's `game/vr.js` for the reference
> implementation. Sub-renderers other than the main object pass (sprites/water/weather) still only
> approximate stereo, as noted below.

---

## Phase 0 Spike (original — superseded by the above)

The standalone `vr-game.js` + `vr.html` spike below still works and is kept for reference, but the
engine-native path above is the one wired into the demo.


Proves the engine's real WebGL2 scene can render **in stereo into a Quest 3** with head tracking,
by wiring WebXR straight into the existing renderer. It is intentionally small and additive: the
flatscreen engine path is untouched.

## What this spike does

- Boots the engine **without** `core/app.js` (whose loop is hardwired to `requestAnimationFrame`).
- Renders a physics scene (a floor + a falling pile of boxes/spheres) on the flatscreen as a
  **preview**, with an **Enter VR** button.
- On Enter VR, drives an `xrSession.requestAnimationFrame` loop, rendering the scene **once per eye**
  using each eye's exact WebXR view + projection matrices. Look around with your head.

## Files

| File | What it is |
|------|-----------|
| `actionengine/xr/actionxr.js` | **New.** WebXR session manager (support check, session lifecycle, `XRWebGLLayer`, ref space, per-frame viewer-pose loop). Nothing runs unless `start()` is called. |
| `vr-game.js` | **New.** The spike: scene, flat preview loop, and the per-eye stereo render. |
| `vr.html` | **New.** Loads the engine in the same order as `index.html` (minus `app.js`/`game.js`) + the two files above. |
| `serve.js` | **New.** Zero-dep static server. |
| `actionengine/rendering/renderers/actionrenderer3D/canvasmanager3D.js` | **Edited (guarded).** `xrCompatible` context; `xrFramebuffer` render target; `suppressClear` so the stereo buffer clears once/frame not once/eye. All default to the old behavior. |
| `actionengine/rendering/renderers/actionrenderer3D/objectrenderer3D.js` | **Edited (additive).** Added `_viewOverride` next to the existing `_projectionOverride`, so each eye's view matrix flows through verbatim. Null = unchanged. |

## Run it on Quest 3 (standalone browser)

WebXR only runs in a **secure context** — `https://` or `http://localhost`. Two ways in:

### Option A — `adb reverse` (simplest, no certificates)

Quest in developer mode, connected by USB (accept the "Allow USB debugging" prompt in the headset):

```bash
node serve.js                      # serves http://localhost:8080
adb reverse tcp:8080 tcp:8080      # headset's localhost:8080 → this PC
```

In the **Quest browser**, open: `http://localhost:8080/vr.html`
`localhost` is a secure context, so the **Enter VR** button will be enabled. Press it, look around.

### Option B — HTTPS over Wi-Fi (no cable)

```bash
openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 365 \
  -subj "/CN=$(hostname -I | awk '{print $1}')"
node serve.js --https              # serves https://<pc-ip>:8443
```

In the Quest browser open `https://<your-pc-ip>:8443/vr.html`, accept the self-signed cert warning,
then Enter VR. (PC and Quest must be on the same network.)

## Also works on PCVR

Any WebXR runtime works: Quest Link/Air Link then open the page in the desktop browser, or a
SteamVR headset. Same code path as standalone — WebXR abstracts the device.

## What is deliberately NOT in Phase 0

These are the next phases, called out so nothing here is mistaken for finished VR:

- **Controllers / input.** No hands, laser pointer, or buttons yet. → Phase 1.
- **World-space UI.** The engine's 2D overlay canvases (score/menus) are invisible in VR; they need
  to become in-world textured quads. → Phase 2.
- **Shadows + sun sprite are disabled in the spike.** The shadow pass rebinds the framebuffer and
  viewport (fighting the per-eye loop), and the sun sprite builds its own non-XR matrices (would
  ghost in stereo). Re-enabling them cleanly is part of the full renderer refactor.
- **Full matrix externalization.** Only the main object pass reads the per-eye override. Sprites,
  water, weather, and the sun still reconstruct matrices from a single camera. The real fix is to
  make every sub-renderer source view/projection from the camera object.

## If the Enter VR button is disabled

- You're not on a secure context → use Option A or B above (not a plain LAN IP over http).
- The browser isn't the Quest browser / no XR runtime → check `navigator.xr` exists.
- The status line under the button prints the specific reason.
