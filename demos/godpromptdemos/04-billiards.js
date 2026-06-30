// BILLIARDS - ActionEngine 3D showcase: ActionRenderer3D + the FULL physics shape catalog +
// ActionFPSController3D drop-in. You walk around a pool hall in first person.
//
// SHAPE CATALOG (one of every renderable ActionEngine 3D shape kind is in this scene):
//   Box, Sphere, Plane, Cone, Cylinder, Capsule, Convex, Mesh (GeometryBuilder). Plus ActionSprite3D
//   billboards for the light bulbs. (Compound shapes are skipped - they don't render in this engine.)
// LIGHTS: a directional sun + TWO omni (point) lights - one casts shadows, one does not.
// DECOR outside the play area: a locked F1 car (mesh), a dynamic trophy (mesh), a physics-enabled
//   rocket (mesh), a parked airplane (mesh), and a cone/cylinder/capsule/convex landmark row.
class Game {
    static WIDTH = 1024;
    static HEIGHT = 640;

    constructor(canvases, input, audio) {
        this.input = input;
        this.audio = audio;
        this.gameCanvas = canvases.gameCanvas;
        this.guiCtx = canvases.guiCtx;
        this.debugCtx = canvases.debugCtx;

        // The 3D session (renderer + world + player + lights) is NOT built here. It's created on PLAY
        // by buildScene() and dropped by destroyScene() on MAIN MENU, so NOTHING 3D exists while the
        // front-end is up. The renderer re-attaches to this SAME canvas each time - the webgl context
        // belongs to the canvas Game handed us, so it's reused, not leaked.
        this.renderer3D = null; this.camera = null; this.world = null; this.player = null;
        this.balls = []; this.sprites = []; this.cue = null; this.score = 0; this._sceneBuilt = false;
        // light placement (x = east/west, z = north/south) - applied when the scene builds.
        this.lightPositions = {
            east: new Vector3(88, 26, 0), west: new Vector3(-88, 26, 0),
            north: new Vector3(0, 26, 95), south: new Vector3(0, 26, -95),
        };
        this.spawn = new Vector3(0, 18, -48);
        this.lastCmd = { forward: 0, right: 0 };

        this.aimYaw = 0; this.aimPitch = -0.15; this.maxPitch = 1.4;
        this.lookSensitivity = 0.0022;
        this._frameDt = 1 / 60; this._fireWanted = false;
        this.debugOpen = false;
        this.paused = false;

        // FRONT-END state machine: a splash + main menu sit IN FRONT of the 3D world, so we never
        // dump the player straight into a locked-pointer scene. 'splash' -> 'menu' -> 'playing'.
        this.screen = 'splash';
        this._splashT = 0; this._t = 0;
        // drifting numbered pool balls for the menu background (pure 2D, no physics).
        const cols = ['#f6c700', '#1f6fff', '#e23b2e', '#7a3cb8', '#ff7a18', '#1f9e5a', '#111418'];
        this._menuBalls = cols.map((col, i) => ({
            n: i < 6 ? i + 1 : 8, col,
            x: Math.random(), y: Math.random(),
            vx: (Math.random() * 2 - 1) * 0.025, vy: (Math.random() * 2 - 1) * 0.025,
            r: 24 + Math.random() * 12,
        }));

        this.gameCanvas.addEventListener('mousedown', () => {
            if (this.screen !== 'playing' || this.paused) return;             // front-end clicks never grab the pointer
            if (this.debugOpen) return;                                       // let debug buttons take the click
            if (document.pointerLockElement !== this.gameCanvas) this.gameCanvas.requestPointerLock();
            else this._fireWanted = true;
        });
        this.registerDebugElements();
        this.registerUIElements();
        this.setupAudio();
        console.log('[Billiards] ready');
    }

    setupAudio() {
        this.audio.createComplexSound('clack', { frequencies: [900, 1400], types: ['sine', 'triangle'], mix: [0.6, 0.4], duration: 0.08, envelope: { attack: 0.002, decay: 0.05, sustain: 0, release: 0.03 } });
        this.audio.createSweepSound('pot', { startFreq: 500, endFreq: 1000, type: 'sine', duration: 0.18, envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.07 } });
        this.audio.createSweepSound('click', { startFreq: 520, endFreq: 760, type: 'triangle', duration: 0.06, envelope: { attack: 0.005, decay: 0.05, sustain: 0, release: 0 } });
        this.audio.setVolume(0.5);
    }

    // ---------- 3D SESSION LIFECYCLE: build on PLAY, destroy on MAIN MENU ----------
    // Instantiate the renderer (reusing this canvas's webgl context), lights, world, table, balls,
    // decor, and the FPS player. Everything 3D lives and dies with one game session.
    buildScene() {
        this.renderer3D = new ActionRenderer3D(this.gameCanvas);     // same canvas -> same gl2 context, fresh managers
        this.camera = new ActionCamera(); this.camera.fov = Math.PI * 0.45;
        this.renderer3D.applyLightingProfile(new ActionLightingProfile({
            autoFit: true, sun: { direction: [-0.6, -1.0, -0.4], intensity: 1.8 }, range: 300, ambient: { intensity: 0.5 }
        }));
        const lm = this.renderer3D.lightManager;
        lm.createPointLight(this.lightPositions.east, new Vector3(1.0, 0.45, 0.15), 2.0, 150, true);    // E - ORANGE, SHADOWS ON
        lm.createPointLight(this.lightPositions.west, new Vector3(0.25, 0.5, 1.0), 1.9, 150, true);     // W - BLUE, SHADOWS ON
        lm.createPointLight(this.lightPositions.north, new Vector3(0.3, 1.0, 0.4), 1.5, 170, false);    // N - GREEN, SHADOWS OFF
        lm.createPointLight(this.lightPositions.south, new Vector3(0.95, 0.3, 0.95), 1.5, 170, false);  // S - MAGENTA, SHADOWS OFF

        this.world = new ActionPhysicsWorld3D();
        this.balls = []; this.sprites = []; this.cue = null; this.score = 0;
        this.buildTable();
        this.buildPockets();   // BLACK PLANES sunk into each pocket
        this.rackBalls();
        this.buildDecor();     // cone/cylinder/capsule/convex + mesh rocket + meshes

        this.spawn = new Vector3(0, this.feltTopY + 14, -48);
        this.player = new ActionFPSController3D(this.world, {
            position: this.spawn.clone ? this.spawn.clone() : new Vector3(0, this.feltTopY + 14, -48),
            weapons: false, combat: false, model: false, view: { modes: ['first'] }
        });
        this.player.captureRenderState();
        this.aimYaw = 0; this.aimPitch = -0.15;
        this._sceneBuilt = true;
    }
    // Drop every 3D handle so the renderer + world + player are garbage-collected. The canvas and its
    // webgl context stay (Game owns them); a fresh renderer reattaches on the next buildScene().
    destroyScene() {
        this.renderer3D = null; this.camera = null; this.world = null; this.player = null;
        this.balls = []; this.sprites = []; this.cue = null; this.ballSpecs = null;
        this._sceneBuilt = false;
    }

    addBox(w, h, d, pos, color) { const b = new ActionPhysicsBox3D(w, h, d, 0, pos, color); this.world.addObject(b); return b; }

    // ---------- table with PROPERLY ALIGNED rails (a clean picture frame) ----------
    buildTable() {
        this.addBox(400, 8, 400, new Vector3(0, -4, 0), '#243B2A');   // floor (top at y=0)
        this.feltTopY = 4;
        const FW = 64, FD = 124;                                       // felt: x in [-32,32], z in [-62,62], top at y=4
        this.addBox(FW, 8, FD, new Vector3(0, 0, 0), '#0b6e3b');

        // BOARDS lined up as a frame: long rails run the FULL length (covering the corners),
        // short rails fit exactly BETWEEN them along the felt's inner faces.
        const RT = 6, RH = 8, ry = this.feltTopY + RH / 2;            // rail thickness/height; sit on the felt
        const innerX = FW / 2, innerZ = FD / 2;                        // 32, 62
        const longLen = FD + RT * 2;                                   // 136 - left/right own the corners
        this.addBox(RT, RH, longLen, new Vector3(innerX + RT / 2, ry, 0), '#5b3a1a');   // right  (x = 35)
        this.addBox(RT, RH, longLen, new Vector3(-innerX - RT / 2, ry, 0), '#5b3a1a');  // left   (x = -35)
        this.addBox(FW, RH, RT, new Vector3(0, ry, innerZ + RT / 2), '#5b3a1a');        // far    (z = 65)
        this.addBox(FW, RH, RT, new Vector3(0, ry, -innerZ - RT / 2), '#5b3a1a');       // near   (z = -65)

        // pocket logic positions (corners + side middles), all on the inner long-rail line
        this.pockets = [
            { x: -innerX, z: -innerZ }, { x: innerX, z: -innerZ }, { x: -innerX, z: 0 },
            { x: innerX, z: 0 }, { x: -innerX, z: innerZ }, { x: innerX, z: innerZ }
        ];
        this.pocketR = 7;
    }

    // ---------- BLACK PLANES sunk into each pocket (the Plane shape) ----------
    buildPockets() {
        for (const p of this.pockets) {
            // Nudge each plane INWARD off the rail so the black sits fully on the green felt.
            const ix = p.x - Math.sign(p.x) * 5;
            const iz = p.z === 0 ? 0 : p.z - Math.sign(p.z) * 5;
            // orientation 1 = flat XZ plane; mass 0 = static; sits just above the felt surface.
            const plane = new ActionPhysicsPlane3D(1, 8, 8, 0, new Vector3(ix, this.feltTopY + 0.2, iz), 1, false);
            plane.triangles.forEach(t => { t.color = '#000000'; });   // recolor the plane black (the "hole")
            this.world.addObject(plane);
        }
    }

    addBall(x, z, color, mass, opts, label, cue = false) {
        const obj = new ActionPhysicsSphere3D(2.4, mass, new Vector3(x, this.feltTopY + 3, z), color, opts);
        this.world.addObject(obj);
        const ball = { obj, color, cue, label };
        this.balls.push(ball);
        if (cue) this.cue = ball;
        return ball;
    }

    rackBalls() {
        for (const b of this.balls) this.world.removeObject(b.obj);
        this.balls = []; this.score = 0;
        this.ballSpecs = [
            { color: '#ffcc00', mass: 1, opts: { restitution: 0.95, friction: 0.4, linearDamping: 0.5, angularDamping: 0.5 }, label: 'bouncy' },
            { color: '#0066ff', mass: 1, opts: { restitution: 0.2, friction: 0.95, linearDamping: 0.9, angularDamping: 0.9 }, label: 'grippy' },
            { color: '#ff3333', mass: 1, opts: { restitution: 0.4, friction: 0.3, linearDamping: 0.08, angularDamping: 0.08 }, label: 'slippery' },
            { color: '#9933ff', mass: 5, opts: { restitution: 0.3, friction: 0.6, linearDamping: 0.8, angularDamping: 0.8 }, label: 'heavy (m5)' },
            { color: '#ff8800', mass: 0.3, opts: { restitution: 0.6, friction: 0.5, linearDamping: 0.8, angularDamping: 0.8 }, label: 'light (m0.3)' },
            { color: '#33cc33', mass: 1, opts: { restitution: 0.4, friction: 0.6, linearDamping: 0.9, angularDamping: 0.9 }, label: 'standard' },
        ];
        let i = 0;
        for (let row = 0; row < 3; row++) for (let c = 0; c <= row; c++) { const s = this.ballSpecs[i]; this.addBall((c - row / 2) * 5.4, 30 + row * 5, s.color, s.mass, s.opts, s.label); i++; }
        this.addBall(0, -35, '#ffffff', 1, { restitution: 0.5, friction: 0.5, linearDamping: 0.6, angularDamping: 0.6 }, 'cue ball', true);
    }

    // ============ DECOR (outside the play area) ============
    buildDecor() {
        // Landmark row of the remaining primitive shapes (static), off to one side.
        this.world.addObject(new ActionPhysicsCone3D(5, 12, 0, new Vector3(-78, 6, -40), '#ff7a18'));     // CONE  (traffic cone)
        this.world.addObject(new ActionPhysicsCylinder3D(5, 14, 0, new Vector3(-78, 7, 0), '#9aa3ad'));   // CYLINDER (barrel)
        this.world.addObject(new ActionPhysicsCapsule3D(3, 14, 0, new Vector3(-78, 7, 40), '#c0392b'));   // CAPSULE (bollard)
        // CONVEX hull crystal (a bipyramid) - static landmark
        const crystal = [{ x: 0, y: 6, z: 0 }, { x: 0, y: -6, z: 0 }, { x: 5, y: 0, z: 0 }, { x: -5, y: 0, z: 0 }, { x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: -5 }];
        this.world.addObject(new ActionPhysicsConvexShape3D(crystal, 0, new Vector3(-100, 6, 20), []));

        this.buildRocket(new Vector3(80, 36, 50));    // MESH (GeometryBuilder) WITH PHYSICS - it drops
        this.buildF1(new Vector3(80, 0, 0));          // MESH (GeometryBuilder) - LOCKED race car (mass 0)
        this.buildTrophy(new Vector3(-92, 34, -20));  // MESH (GeometryBuilder) WITH PHYSICS - drops & settles
        this.buildAirplane(new Vector3(104, 5, -42));  // MESH (GeometryBuilder) - parked plane on the F1/rocket side

        // Visible "bulb" markers so you can SEE where each omni light sits (one per side).
        this.addBulb(this.lightPositions.east, '#ff8030');   // orange
        this.addBulb(this.lightPositions.west, '#5090ff');   // blue
        this.addBulb(this.lightPositions.north, '#50ff70');  // green
        this.addBulb(this.lightPositions.south, '#ff50ff');  // magenta
    }

    // A glowing bulb billboard - a PROGRAMMATIC sprite: draw a radial glow on a canvas, hand its
    // PNG data to ActionSprite3D (which needs base64Data). No image assets, all from code.
    addBulb(pos, hex) {
        const cv = document.createElement('canvas'); cv.width = cv.height = 64;
        const x = cv.getContext('2d');
        const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
        grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.3, hex); grd.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = grd; x.beginPath(); x.arc(32, 32, 32, 0, Math.PI * 2); x.fill();
        const b64 = cv.toDataURL('image/png').split(',')[1];
        this.sprites.push(new ActionSprite3D({ base64Data: b64, position: new Vector3(pos.x, pos.y, pos.z), width: 7, height: 7, billboard: true }));
    }

    // A parked airplane BUILT with GeometryBuilder: octagonal fuselage + nose cone + wings + tail +
    // canopy + propeller, then one static physics mesh (mass 0). Forward = +x.
    buildAirplane(pos) {
        const b = new GeometryBuilder();
        const v = [], n = [], c = [], idx = [];
        const BODY = [0.82, 0.84, 0.9], RED = [0.85, 0.15, 0.15], GLASS = [0.35, 0.55, 0.78], DARK = [0.15, 0.16, 0.2];
        const push = (x, y, z, col) => { v.push(x, y, z); n.push(0, 1, 0); c.push(...col); return v.length / 3 - 1; };
        const box = (cx, cy, cz, sx, sy, sz, col) => {
            b.setReferencePoint({ x: cx, y: cy, z: cz });
            const hx = sx / 2, hy = sy / 2, hz = sz / 2, P = (x, y, z) => push(cx + x, cy + y, cz + z, col);
            const a = P(-hx, -hy, -hz), bb = P(hx, -hy, -hz), cc = P(hx, hy, -hz), d = P(-hx, hy, -hz);
            const e = P(-hx, -hy, hz), f = P(hx, -hy, hz), g = P(hx, hy, hz), h = P(-hx, hy, hz);
            b.createQuad(idx, v, a, bb, cc, d); b.createQuad(idx, v, e, f, g, h);
            b.createQuad(idx, v, a, d, h, e); b.createQuad(idx, v, bb, f, g, cc);
            b.createQuad(idx, v, d, cc, g, h); b.createQuad(idx, v, a, e, f, bb);
        };
        // fuselage: octagon tube along X from x0 to x1
        b.setReferencePoint({ x: 0, y: 0, z: 0 });
        const N = 8, r = 2, x0 = -9, x1 = 7, back = [], front = [];
        for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, yy = Math.cos(a) * r, zz = Math.sin(a) * r; back.push(push(x0, yy, zz, BODY)); front.push(push(x1, yy, zz, BODY)); }
        for (let i = 0; i < N; i++) { const j = (i + 1) % N; b.createQuad(idx, v, back[i], back[j], front[j], front[i]); }
        const tail = push(x0 - 2, 0, 0, BODY); for (let i = 0; i < N; i++) { const j = (i + 1) % N; b.createTriangle(idx, v, tail, back[i], back[j]); } // tail cap
        // nose cone (front ring -> apex)
        b.setReferencePoint({ x: x1 + 1.5, y: 0, z: 0 });
        const apex = push(x1 + 4, 0, 0, RED); for (let i = 0; i < N; i++) { const j = (i + 1) % N; b.createTriangle(idx, v, front[i], front[j], apex); }
        box(2, 1.8, 0, 3.5, 1.4, 2.4, GLASS);     // canopy
        box(-0.5, 0, 0, 4.5, 0.4, 24, BODY);      // main wings (span along z)
        box(-7.5, 0.4, 0, 3, 0.3, 9, BODY);       // horizontal stabilizer
        box(-8, 2.4, 0, 2.6, 4, 0.4, RED);        // vertical tail fin
        box(x1 + 4.1, 0, 0, 0.3, 6.5, 0.7, DARK); // propeller blade (vertical)
        box(x1 + 4.1, 0, 0, 0.3, 0.7, 6.5, DARK); // propeller blade (horizontal)
        this.airplane = b.createPhysicsObject(this.world, v, n, c, idx, 0, pos);  // mass 0 = static landmark
    }

    // The trophy: cup + stem + base BUILT with GeometryBuilder, then one DYNAMIC physics mesh (mass 2).
    buildTrophy(pos) {
        const b = new GeometryBuilder();
        const v = [], n = [], c = [], idx = [];
        const GOLD = [0.95, 0.78, 0.25], DARK = [0.5, 0.38, 0.12];
        const push = (x, y, z, col) => { v.push(x, y, z); n.push(0, 1, 0); c.push(...col); return v.length / 3 - 1; };
        // octagonal frustum from y0 (radius r0) to y1 (radius r1), with end caps.
        const frustum = (y0, y1, r0, r1, col) => {
            b.setReferencePoint({ x: 0, y: (y0 + y1) / 2, z: 0 });
            const N = 8, bot = [], top = [];
            for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; bot.push(push(Math.cos(a) * r0, y0, Math.sin(a) * r0, col)); top.push(push(Math.cos(a) * r1, y1, Math.sin(a) * r1, col)); }
            for (let i = 0; i < N; i++) { const j = (i + 1) % N; b.createQuad(idx, v, bot[i], bot[j], top[j], top[i]); }
            const bc = push(0, y0, 0, col), tc = push(0, y1, 0, col);
            for (let i = 0; i < N; i++) { const j = (i + 1) % N; b.createTriangle(idx, v, bc, bot[j], bot[i]); b.createTriangle(idx, v, tc, top[i], top[j]); }
        };
        frustum(0, 1.6, 3, 3, DARK);     // base
        frustum(1.6, 5, 1, 1, GOLD);     // stem
        frustum(5, 9, 2.4, 4, GOLD);     // cup (flares out at the top)
        this.trophy = b.createPhysicsObject(this.world, v, n, c, idx, 2, pos);  // mass 2 -> it HAS physics
    }

    // The F1 car: a multi-part mesh BUILT with GeometryBuilder (chassis + nose + cockpit + wings +
    // four wheels), then turned into ONE static physics mesh. mass 0 = LOCKED in place.
    buildF1(pos) {
        const b = new GeometryBuilder();
        const v = [], n = [], c = [], idx = [];
        const RED = [0.88, 0.02, 0.0], WHITE = [0.91, 0.91, 0.93], BLACK = [0.09, 0.09, 0.12];
        const push = (x, y, z, col) => { v.push(x, y, z); n.push(0, 1, 0); c.push(...col); return v.length / 3 - 1; };
        // an axis-aligned box centred at (cx,cy,cz); reference point at its centre auto-winds the 6 quads.
        const box = (cx, cy, cz, sx, sy, sz, col) => {
            b.setReferencePoint({ x: cx, y: cy, z: cz });
            const hx = sx / 2, hy = sy / 2, hz = sz / 2, P = (x, y, z) => push(cx + x, cy + y, cz + z, col);
            const a = P(-hx, -hy, -hz), bb = P(hx, -hy, -hz), cc = P(hx, hy, -hz), d = P(-hx, hy, -hz);
            const e = P(-hx, -hy, hz), f = P(hx, -hy, hz), g = P(hx, hy, hz), h = P(-hx, hy, hz);
            b.createQuad(idx, v, a, bb, cc, d); b.createQuad(idx, v, e, f, g, h);
            b.createQuad(idx, v, a, d, h, e); b.createQuad(idx, v, bb, f, g, cc);
            b.createQuad(idx, v, d, cc, g, h); b.createQuad(idx, v, a, e, f, bb);
        };
        // an octagonal wheel: axle along Z, round face in the XY plane.
        const wheel = (cx, cy, cz, r, w) => {
            b.setReferencePoint({ x: cx, y: cy, z: cz });
            const N = 8, hz = w / 2, back = [], front = [];
            for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, yy = Math.cos(a) * r, xx = Math.sin(a) * r; back.push(push(cx + xx, cy + yy, cz - hz, BLACK)); front.push(push(cx + xx, cy + yy, cz + hz, BLACK)); }
            for (let i = 0; i < N; i++) { const j = (i + 1) % N; b.createQuad(idx, v, back[i], back[j], front[j], front[i]); }
            const bc = push(cx, cy, cz - hz, BLACK), fc = push(cx, cy, cz + hz, BLACK);
            for (let i = 0; i < N; i++) { const j = (i + 1) % N; b.createTriangle(idx, v, bc, back[j], back[i]); b.createTriangle(idx, v, fc, front[i], front[j]); }
        };
        box(0, 2.6, 0, 15, 1.6, 3.4, RED);     // chassis tub
        box(9, 2.4, 0, 6, 1.2, 2.4, RED);      // nose cone (front = +x)
        box(-2, 3.7, 0, 4, 1.6, 2.6, WHITE);   // cockpit
        box(-5, 3.4, 0, 3.5, 1.2, 1.8, RED);   // engine cover
        box(11.5, 1.4, 0, 1.6, 0.3, 7.5, BLACK); // front wing
        box(-8.5, 5.2, 0, 1.2, 0.4, 6.5, BLACK); // rear wing
        box(-8.2, 3.6, 2.6, 0.4, 3.4, 0.5, BLACK); // rear wing endplate R
        box(-8.2, 3.6, -2.6, 0.4, 3.4, 0.5, BLACK); // rear wing endplate L
        for (const [x, z] of [[6, 3.0], [6, -3.0], [-6, 3.0], [-6, -3.0]]) wheel(x, 2.0, z, 2.0, 1.6);
        this.f1 = b.createPhysicsObject(this.world, v, n, c, idx, 0, pos);  // mass 0 = LOCKED
    }

    // MESH via GeometryBuilder - octagonal rocket (body prism + nose cone + 4 fins), WITH PHYSICS.
    buildRocket(pos) {
        const b = new GeometryBuilder();
        const v = [], n = [], c = [], idx = [];
        const SIDES = 8, R = 3.4, BODY_H = 16, NOSE_H = 9;
        const push = (x, y, z, col) => { v.push(x, y, z); n.push(0, 1, 0); c.push(...col); return v.length / 3 - 1; };
        const ring = (y, r, col) => { const ids = []; for (let i = 0; i < SIDES; i++) { const a = (i / SIDES) * Math.PI * 2; ids.push(push(Math.cos(a) * r, y, Math.sin(a) * r, col)); } return ids; };
        b.setReferencePoint({ x: 0, y: BODY_H / 2, z: 0 });
        const bot = ring(0, R, [0.85, 0.85, 0.9]), top = ring(BODY_H, R, [0.85, 0.85, 0.9]);
        for (let i = 0; i < SIDES; i++) { const j = (i + 1) % SIDES; b.createQuad(idx, v, bot[i], bot[j], top[j], top[i]); }
        b.setReferencePoint({ x: 0, y: BODY_H + NOSE_H / 2, z: 0 });
        const noseRing = ring(BODY_H, R, [0.9, 0.2, 0.2]);
        const apex = push(0, BODY_H + NOSE_H, 0, [0.9, 0.2, 0.2]);
        for (let i = 0; i < SIDES; i++) { const j = (i + 1) % SIDES; b.createTriangle(idx, v, noseRing[i], noseRing[j], apex); }
        for (let f = 0; f < 4; f++) {
            const a = (f / 4) * Math.PI * 2, cx = Math.cos(a), sz = Math.sin(a);
            b.setReferencePoint({ x: cx * (R + 3), y: 3, z: sz * (R + 3) });
            const p1 = push(cx * R, 8, sz * R, [0.2, 0.4, 0.9]), p2 = push(cx * R, 0, sz * R, [0.2, 0.4, 0.9]), p3 = push(cx * (R + 6), 0, sz * (R + 6), [0.2, 0.4, 0.9]);
            b.createTriangle(idx, v, p1, p2, p3, false, true);
        }
        this.rocket = b.createPhysicsObject(this.world, v, n, c, idx, 3, pos);  // mass 3 -> it HAS physics
    }

    // ---------- input-element debug menu (gui layer) ----------
    registerDebugElements() {
        this.input.registerElement('dbg_resetPlayer', { bounds: () => ({ x: Game.WIDTH - 230, y: 54, width: 204, height: 40 }) }, 'gui');
        this.input.registerElement('dbg_resetGame', { bounds: () => ({ x: Game.WIDTH - 230, y: 106, width: 204, height: 40 }) }, 'gui');
    }
    resetPlayer() { this.player.setPosition(this.spawn.clone ? this.spawn.clone() : new Vector3(0, this.feltTopY + 14, -48)); this.audio.play('click', { volume: 0.3 }); }
    resetGame() { this.rackBalls(); this.resetPlayer(); }

    // ---------- front-end UI elements (gui layer): PLAY + pause menu ----------
    registerUIElements() {
        const W = Game.WIDTH;
        this.input.registerElement('menu_play', { bounds: () => ({ x: (W - 280) / 2, y: 380, width: 280, height: 64 }) }, 'gui');
        this.input.registerElement('pause_resume', { bounds: () => ({ x: (W - 240) / 2, y: 300, width: 240, height: 54 }) }, 'gui');
        this.input.registerElement('pause_menu', { bounds: () => ({ x: (W - 240) / 2, y: 366, width: 240, height: 54 }) }, 'gui');
    }
    startGame() {
        this.buildScene();                                  // instantiate the renderer + world + player NOW
        this.screen = 'playing'; this.paused = false;
        this.audio.play('click', { volume: 0.4 });
    }
    resumeGame() { this.paused = false; this.audio.play('click', { volume: 0.3 }); }
    // The "shut it down" path: release the pointer, DESTROY the 3D session, and return to the menu.
    toMainMenu() {
        if (document.pointerLockElement) document.exitPointerLock();   // release input capture
        this.paused = false; this.debugOpen = false;
        this.destroyScene();                                // tear the renderer + world + player down
        this.screen = 'menu';
        this.audio.play('click', { volume: 0.3 });
    }
    _shade(hex, amt) {
        let h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const cl = v => Math.max(0, Math.min(255, v + amt)) | 0;
        return `rgb(${cl(parseInt(h.substr(0, 2), 16))},${cl(parseInt(h.substr(2, 2), 16))},${cl(parseInt(h.substr(4, 2), 16))})`;
    }
    // A 2D billiard ball: shaded body + white number disc + glossy highlight.
    drawPoolBall(ctx, x, y, r, col, n) {
        const grd = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
        grd.addColorStop(0, this._shade(col, 90)); grd.addColorStop(0.5, col); grd.addColorStop(1, this._shade(col, -70));
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f4f1e8'; ctx.beginPath(); ctx.arc(x, y, r * 0.46, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a1a1a'; ctx.font = `bold ${Math.round(r * 0.58)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(n), x, y + r * 0.05); ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(x - r * 0.32, y - r * 0.4, r * 0.3, r * 0.18, -0.5, 0, Math.PI * 2); ctx.fill();
    }
    roundRectPath(ctx, x, y, w, h, r) {
        r = Math.min(r, h / 2, w / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }
    // Translucent rounded HUD background pill.
    pill(ctx, x, y, w, h, fill = 'rgba(6,12,22,0.66)') {
        this.roundRectPath(ctx, x, y, w, h, 11);
        ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();
    }
    // A flashy-cheap button: drawn rect + hover, hit-tested by the input element of the same id.
    uiButton(ctx, id, x, y, w, h, label, accent) {
        const hov = this.input.isElementHovered(id, 'gui');
        ctx.fillStyle = hov ? accent : 'rgba(255,255,255,0.07)';
        ctx.fillRect(x, y, w, h);
        ctx.lineWidth = hov ? 2.5 : 1.5; ctx.strokeStyle = hov ? '#ffffff' : 'rgba(255,255,255,0.35)';
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.fillStyle = hov ? '#05140a' : '#eaf6ff';
        ctx.font = `bold ${Math.round(h * 0.34)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, x + w / 2, y + h / 2 + 1); ctx.textBaseline = 'alphabetic';
    }

    strike() {
        if (!this.cue) return;
        const d = this.player.getLookDirection();
        const len = Math.hypot(d.x, d.z) || 1, F = 220;
        this.cue.obj.body.applyImpulse(new Vector3((d.x / len) * F, 0, (d.z / len) * F));
        this.audio.play('clack', { volume: 0.4 });
    }

    moveState() {
        const p = this.player, c = this.lastCmd || {};
        const v = p.body.linearVelocity, sp = Math.hypot(v.x, v.z);
        if (!p.grounded) return 'AIRBORNE';
        if (p._sliding) return 'SLIDING';
        const moving = (c.forward || 0) !== 0 || (c.right || 0) !== 0 || sp > 3;
        if (p.crouching) return moving ? 'CROUCH-MOVING' : 'CROUCHING';
        if (!moving) return 'IDLE';
        if (c.sprint) return 'SPRINTING';
        if (c.walk) return 'WALKING';
        return 'RUNNING';
    }

    action_update(dt) {
        this._frameDt = Math.min(dt || 1 / 60, 0.05);
        this._t += this._frameDt;

        // FRONT-END: splash auto-advances (or skip on click/space); menu waits for PLAY. The 3D
        // world keeps rendering as a live backdrop, but its physics never steps until 'playing'.
        if (this.screen === 'splash') {
            this._splashT += this._frameDt;
            if (this._splashT > 2.6 || this.input.isPointerJustDown() ||
                this.input.isRawKeyJustPressed('Space') || this.input.isRawKeyJustPressed('Enter')) this.screen = 'menu';
            return;
        }
        if (this.screen === 'menu') {
            if (this.input.isElementJustPressed('menu_play', 'gui')) this.startGame();
            return;
        }

        // Debug menu toggle (frees the cursor so you can click the buttons).
        if (this.input.isKeyJustPressed('ActionDebugToggle')) {
            this.debugOpen = !this.debugOpen;
            if (this.debugOpen && document.pointerLockElement) document.exitPointerLock();
        }
        if (this.debugOpen) {
            if (this.input.isElementJustPressed('dbg_resetPlayer', 'gui')) this.resetPlayer();
            if (this.input.isElementJustPressed('dbg_resetGame', 'gui')) this.resetGame();
        }

        // PAUSE on the P key (a RAW key - 'KeyP' isn't in the default action map, so we read it directly).
        if (this.input.isRawKeyJustPressed('KeyP')) { this.paused = !this.paused; if (this.paused && document.pointerLockElement) document.exitPointerLock(); }
        if (this.paused) {
            // Pause menu: RESUME or quit back to the main menu (which shuts the session down).
            if (this.input.isElementJustPressed('pause_resume', 'gui')) this.resumeGame();
            else if (this.input.isElementJustPressed('pause_menu', 'gui')) this.toMainMenu();
            return;   // freeze look/aim while paused (physics is frozen in fixed_update)
        }

        const m = this.input.consumeLockedPointerMovement();
        if (m.x || m.y) {
            this.aimYaw += -m.x * this.lookSensitivity;
            this.aimPitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.aimPitch - m.y * this.lookSensitivity));
        }
        this.player.aim(this.aimYaw, this.aimPitch);
        if (this.input.isKeyJustPressed('Action3')) this.rackBalls();
        this.player.update(this._frameDt);
    }

    action_fixed_update(fixedDt) {
        if (this.screen !== 'playing' || this.paused) return;   // no sim on the front-end or while paused
        const cmd = this.player.sampleCommand(this.input);
        cmd.yaw = this.aimYaw; cmd.pitch = this.aimPitch;
        this.lastCmd = cmd;
        this.player.setLook(this.aimYaw, this.aimPitch);
        if (this._fireWanted) { this.strike(); this._fireWanted = false; }

        this.player.beginStep(cmd, fixedDt);
        this.world.fixed_update(fixedDt);
        this.player.endStep(fixedDt);
        this.player.captureRenderState();

        // RESPAWN if the player falls off the world.
        if (this.player.body.position.y < -30) this.resetPlayer();

        // Pot balls that reach a pocket (or fall off).
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const b = this.balls[i], p = b.obj.body.position;
            if (p.y < -20) { this.world.removeObject(b.obj); this.balls.splice(i, 1); if (b === this.cue) this.cue = null; continue; }
            for (const pk of this.pockets) {
                if (Math.hypot(p.x - pk.x, p.z - pk.z) < this.pocketR && Math.abs(p.y - (this.feltTopY + 3)) < 6) {
                    this.world.removeObject(b.obj); this.balls.splice(i, 1);
                    if (b === this.cue) this.cue = null; else this.score += 10;
                    this.audio.play('pot', { volume: 0.4 }); break;
                }
            }
        }
    }

    action_draw(alpha) {
        const ctx = this.guiCtx, W = Game.WIDTH, H = Game.HEIGHT;

        // FRONT-END: no renderer exists (the 3D session is torn down). The splash/menu are drawn fully
        // opaque on the gui layer, which sits ON TOP of the gameCanvas - so the dormant 3D canvas
        // underneath is completely covered. Nothing 3D is touched here.
        if (this.screen !== 'playing') {
            ctx.clearRect(0, 0, W, H);
            if (this.screen === 'splash') this.drawSplash(ctx, W, H); else this.drawMenu(ctx, W, H);
            this.debugCtx.clearRect(0, 0, W, H);
            return;
        }

        // PLAYING: render the full 3D scene.
        this.player.updateCamera(this.camera, alpha, this._frameDt);
        const scene = Array.from(this.world.objects).concat(this.player.getRenderObjects(alpha)).concat(this.sprites);
        this.renderer3D.render({ renderableObjects: scene, camera: this.camera, clearColor: { r: 0.05, g: 0.07, b: 0.10, a: 1 } });
        ctx.clearRect(0, 0, W, H);

        // crosshair (only while looking around / locked)
        if (document.pointerLockElement === this.gameCanvas && !this.debugOpen) {
            ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(W / 2 - 9, H / 2); ctx.lineTo(W / 2 - 3, H / 2);
            ctx.moveTo(W / 2 + 3, H / 2); ctx.lineTo(W / 2 + 9, H / 2);
            ctx.moveTo(W / 2, H / 2 - 9); ctx.lineTo(W / 2, H / 2 - 3);
            ctx.moveTo(W / 2, H / 2 + 3); ctx.lineTo(W / 2, H / 2 + 9); ctx.stroke();
        }

        // --- TOP-LEFT: score + balls (single pill) ---
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.font = 'bold 20px monospace';
        const scoreTxt = `Score ${this.score}    Balls ${this.balls.length - (this.cue ? 1 : 0)}`;
        const scoreW = ctx.measureText(scoreTxt).width;
        this.pill(ctx, 12, 12, scoreW + 28, 38);
        ctx.fillStyle = '#e0f0ff'; ctx.fillText(scoreTxt, 26, 37);
        if (!this.cue) {
            ctx.font = 'bold 13px monospace';
            const warn = 'Cue ball potted — E to rerack', warnW = ctx.measureText(warn).width;
            this.pill(ctx, 12, 58, warnW + 24, 28, 'rgba(70,12,12,0.62)');
            ctx.fillStyle = '#ff9a9a'; ctx.fillText(warn, 24, 77);
        }

        // --- MIDDLE-LEFT: controls reference (its own pill, vertically centred) ---
        const ctrls = [
            ['Click', 'lock / strike'], ['WASD', 'move'], ['Shift', 'sprint'],
            ['X / C', 'walk / crouch'], ['Space', 'jump'], ['E', 'rerack'], ['P / F9', 'pause / debug'],
        ];
        const cpW = 184, cRow = 19, cpH = ctrls.length * cRow + 34, cpY = (H - cpH) / 2;
        this.pill(ctx, 12, cpY, cpW, cpH);
        ctx.fillStyle = '#7fb0ff'; ctx.font = 'bold 11px monospace'; ctx.fillText('CONTROLS', 26, cpY + 22);
        ctx.font = '12px monospace';
        let crowY = cpY + 42;
        for (const [k, a] of ctrls) {
            ctx.fillStyle = '#cfe3ff'; ctx.fillText(k, 26, crowY);
            ctx.fillStyle = '#8aa6c8'; ctx.fillText(a, 84, crowY);
            crowY += cRow;
        }

        // --- BOTTOM-LEFT: FPS movement-state (pill) ---
        const st = this.moveState();
        const v = this.player.body.linearVelocity, sp = Math.hypot(v.x, v.z);
        const sub = `speed ${sp.toFixed(0)}    ${this.player.grounded ? 'grounded' : 'airborne'}`;
        ctx.font = 'bold 26px monospace'; const stW = ctx.measureText(st).width;
        ctx.font = '13px monospace'; const subW = ctx.measureText(sub).width;
        const mW = Math.max(stW, subW) + 28, mH = 60, mY = H - mH - 12;
        this.pill(ctx, 12, mY, mW, mH);
        ctx.font = 'bold 26px monospace'; ctx.fillStyle = '#7CFC98'; ctx.fillText(st, 26, mY + 32);
        ctx.font = '13px monospace'; ctx.fillStyle = '#9fb6cf'; ctx.fillText(sub, 26, mY + 50);

        // debug menu (input-element buttons) - drawn on the gui layer
        if (this.debugOpen) {
            ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W - 244, 12, 232, 168);
            ctx.strokeStyle = '#39ff14'; ctx.lineWidth = 1; ctx.strokeRect(W - 244.5, 12.5, 231, 167);
            ctx.fillStyle = '#39ff14'; ctx.font = 'bold 14px monospace'; ctx.fillText('DEBUG (F9)', W - 232, 36);
            const btn = (id, label, y) => {
                const hov = this.input.isElementHovered(id, 'gui');
                ctx.fillStyle = hov ? 'rgba(120,220,255,0.30)' : 'rgba(255,255,255,0.08)'; ctx.fillRect(W - 230, y, 204, 40);
                ctx.strokeStyle = hov ? '#7fe3ff' : 'rgba(255,255,255,0.2)'; ctx.strokeRect(W - 230.5, y + 0.5, 203, 39);
                ctx.fillStyle = '#eaf6ff'; ctx.font = '14px monospace'; ctx.textAlign = 'center'; ctx.fillText(label, W - 128, y + 25); ctx.textAlign = 'left';
            };
            btn('dbg_resetPlayer', 'RESET PLAYER', 54);
            btn('dbg_resetGame', 'RESET GAME', 106);
            ctx.fillStyle = '#9fb6cf'; ctx.font = '11px monospace'; ctx.fillText('cursor freed - click a button', W - 232, 166);
        }

        // --- BOTTOM-RIGHT: ball-physics legend (pill) ---
        if (this.ballSpecs) {
            ctx.textAlign = 'left'; ctx.font = '12px monospace';
            const rows = this.ballSpecs.length, lh = 17;
            const lpW = 150, lpH = rows * lh + 30, lpX = W - lpW - 12, lpY = H - lpH - 12;
            this.pill(ctx, lpX, lpY, lpW, lpH);
            ctx.fillStyle = '#aabbcc'; ctx.font = 'bold 11px monospace'; ctx.fillText('BALL PHYSICS', lpX + 14, lpY + 20);
            ctx.font = '12px monospace';
            let ly = lpY + 38;
            for (const s of this.ballSpecs) {
                ctx.fillStyle = s.color; ctx.fillRect(lpX + 14, ly - 10, 11, 11);
                ctx.fillStyle = '#c8d4e0'; ctx.fillText(s.label, lpX + 32, ly); ly += lh;
            }
        }

        // pause overlay (the world is frozen) - now with a real RESUME / MAIN MENU choice
        if (this.paused) {
            ctx.fillStyle = 'rgba(2,4,12,0.72)'; ctx.fillRect(0, 0, W, H);
            ctx.textAlign = 'center';
            ctx.shadowColor = '#39b6ff'; ctx.shadowBlur = 18;
            ctx.fillStyle = '#eaf6ff'; ctx.font = 'bold 50px monospace'; ctx.fillText('PAUSED', W / 2, 232);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#9fb6cf'; ctx.font = '14px monospace'; ctx.fillText('physics frozen', W / 2, 262);
            this.uiButton(ctx, 'pause_resume', (W - 240) / 2, 300, 240, 54, 'RESUME', 'rgba(90,200,120,0.92)');
            this.uiButton(ctx, 'pause_menu', (W - 240) / 2, 366, 240, 54, 'MAIN MENU', 'rgba(255,140,80,0.92)');
            ctx.fillStyle = '#6f8fb8'; ctx.font = '12px monospace'; ctx.fillText('P resumes too', W / 2, 446);
        }

        this.debugCtx.clearRect(0, 0, W, H);
    }

    // ---------- front-end screens (cheap, flashy, all 2D over the 3D backdrop) ----------
    drawSplash(ctx, W, H) {
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#0a1226'); bg.addColorStop(1, '#04060e');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        const t = this._t, cx = W / 2, cy = H / 2 - 16;
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
        // expanding accent rings
        for (let i = 0; i < 3; i++) {
            const f = ((t * 0.5 + i / 3) % 1);
            ctx.strokeStyle = `rgba(120,200,255,${0.22 * (1 - f)})`; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(cx, cy, 60 + f * 220, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.textAlign = 'center';
        ctx.shadowColor = '#39b6ff'; ctx.shadowBlur = 22 + pulse * 18;
        ctx.fillStyle = '#eaf6ff'; ctx.font = 'bold 56px monospace'; ctx.fillText('ACTION ENGINE', cx, cy);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#7fb0ff'; ctx.font = '16px monospace'; ctx.fillText('p r e s e n t s', cx, cy + 38);
        if ((t % 1) < 0.6) { ctx.fillStyle = 'rgba(200,220,255,0.7)'; ctx.font = '14px monospace'; ctx.fillText('click or press space', cx, H - 56); }
    }
    drawMenu(ctx, W, H) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0a1428'); g.addColorStop(0.55, '#060a18'); g.addColorStop(1, '#03060f');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const cx = W / 2, t = this._t;
        // drifting numbered pool balls in the background (pure 2D - they wrap around the screen)
        for (const b of this._menuBalls) {
            const x = (((b.x + b.vx * t) % 1) + 1) % 1 * W;
            const y = (((b.y + b.vy * t) % 1) + 1) % 1 * H;
            this.drawPoolBall(ctx, x, y, b.r, b.col, b.n);
        }
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ff8a3c'; ctx.shadowBlur = 26;
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 76px monospace'; ctx.fillText('BILLIARDS', cx, 196 + Math.sin(t * 1.5) * 4);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#9fc0e8'; ctx.font = '17px monospace'; ctx.fillText('first-person 3D physics · ActionEngine', cx, 240);
        this.uiButton(ctx, 'menu_play', (W - 280) / 2, 380, 280, 64, 'PLAY', 'rgba(90,200,120,0.92)');
        ctx.fillStyle = '#6f8fb8'; ctx.font = '13px monospace';
        ctx.fillText('WASD move · mouse look · click to strike · Shift sprint · C crouch · Space jump', cx, 482);
        ctx.fillText('P pauses in-game · F9 debug menu', cx, 504);
    }
}
