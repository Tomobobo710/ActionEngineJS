// game/game.js — ActionPhysics2D Demo

const SCENES = ['Stacking', 'Pyramid', 'SquarePyramid', 'Callbacks'];

const PALETTE = [
    '#00d4ff', '#ff6b6b', '#ffd93d', '#6bcb77', '#c084fc',
    '#fb923c', '#f472b6', '#2dd4bf', '#a3e635', '#e879f9',
    '#38bdf8', '#f87171', '#facc15', '#4ade80', '#a78bfa'
];

function pickColor(i) {
    return PALETTE[i % PALETTE.length];
}

class Game {
    static WIDTH = 800;
    static HEIGHT = 600;

    constructor(canvases, input, audio) {
        this.input = input;
        this.audio = audio;
        this.W = Game.WIDTH;
        this.H = Game.HEIGHT;

        this.gameCanvas = canvases.gameCanvas;
        this.gameCtx = this.gameCanvas.getContext('2d');
        this.guiCanvas = canvases.guiCanvas;
        this.guiCtx = canvases.guiCtx;
        this.debugCanvas = canvases.debugCanvas;
        this.debugCtx = canvases.debugCtx;

        // Timing
        this.lastTime = performance.now();
        this.dt = 0;
        this.physicsAccumulator = 0;
        this.fixedDt = 1 / 60;
        this.timeScale = 0.25; // slowmo enabled by default
        this.renderAlpha = 1; // interpolation factor for smooth rendering
        this.fps = 0;
        this._fpsTimer = 0;
        this._fpsCounter = 0;

        // State
        this.paused = false;
        this.slowMo = true; // enabled by default
        this.debugVisible = false;
        this.showAABBs = false;
        this.showContacts = false;
        this.currentScene = 0;
        this.spawnMode = 'circle'; // 'circle' | 'box' | 'bullet'
        this.colorIndex = 0;

        // Visual data per body
        this.bodyColors = new Map();

        // Contact visualization
        this.activeManifolds = [];
        this.contactFlashes = [];

        // Callbacks scene logging
        this.contactLog = [];
        this.maxLogLines = 15;
        this.playerBody = null;
        this.contactListView = null;

        // ActionUI setup
        const theme = new ActionUITheme({
            colorBackground: '#050510', colorSurface: '#0a0a1a', colorSurfaceRaised: '#0f0f2a',
            colorPrimary: '#4682be', colorPrimaryHover: '#5a9fd4', colorAccent: '#00d4ff', colorSuccess: '#00c896',
        });
        this.ui = new ActionUI(canvases, input, theme);

        // Setup
        this.setupAudio();
        this.setupGUI();
        this.buildScene(this.currentScene);

        console.log('ActionPhysics2D Demo Ready');
    }

    // ── Audio ──────────────────────────────────

    setupAudio() {
        this.audio.createSweepSound('hit_hard', {
            startFreq: 300, endFreq: 80, type: 'triangle', duration: 0.18,
            envelope: { attack: 0.005, decay: 0.07, sustain: 0.1, release: 0.1 }
        });
        this.audio.createSweepSound('hit_soft', {
            startFreq: 600, endFreq: 300, type: 'sine', duration: 0.1,
            envelope: { attack: 0.005, decay: 0.04, sustain: 0.05, release: 0.05 }
        });
        this.audio.createNoiseSound('bullet_fire', {
            noiseType: 'white', duration: 0.15,
            envelope: { attack: 0.005, decay: 0.05, sustain: 0.05, release: 0.05 },
            filterOptions: { frequency: 2000, Q: 1, type: 'bandpass' }
        });
        this.audio.createSweepSound('spawn', {
            startFreq: 200, endFreq: 700, type: 'sine', duration: 0.15,
            envelope: { attack: 0.01, decay: 0.08, sustain: 0, release: 0.06 }
        });
        this.audio.createComplexSound('scene_change', {
            frequencies: [440, 554, 659], types: ['sine', 'sine', 'sine'],
            mix: [0.4, 0.3, 0.3], duration: 0.4,
            envelope: { attack: 0.02, decay: 0.15, sustain: 0.2, release: 0.23 }
        });
        this.audio.setVolume(0.5);
    }

    // ── GUI Setup ─────────────────────────────

    setupGUI() {
        const t = this.ui.theme;

        // Top background panel
        this.ui.add(new ActionUIPanel({
            x: 0, y: 0, width: this.W, height: 45,
            title: null, shadow: false, fill: true, border: false
        }));

        // Hint label at top
        this.ui.makeLabel({
            text: 'Action1: change shape  |  Click: spawn  |  Arrow Keys: force  |  Action4: pause  |  DebugKey: debug',
            x: 0, y: 0, width: this.W, height: 16,
            fontSize: t.fontSizeSm, color: t.colorTextMuted, align: 'center'
        });

        // Spawn mode buttons (top left)
        this.modeButtons = [
            { btn: this.ui.makeButton({ text: 'Circle', x: 14, y: 15, width: 60, height: 26, variant: 'secondary', onClick: () => { this.spawnMode = 'circle'; this.updateButtonStates(); } }) },
            { btn: this.ui.makeButton({ text: 'Box', x: 78, y: 15, width: 50, height: 26, variant: 'secondary', onClick: () => { this.spawnMode = 'box'; this.updateButtonStates(); } }) },
            { btn: this.ui.makeButton({ text: 'Bullet', x: 132, y: 15, width: 60, height: 26, variant: 'secondary', onClick: () => { this.spawnMode = 'bullet'; this.updateButtonStates(); } }) }
        ];
        this.modeNames = ['circle', 'box', 'bullet'];

        // Control buttons (top right)
        this.ctrlButtons = [
            { btn: this.ui.makeButton({ text: 'Slow', x: this.W - 310, y: 15, width: 50, height: 26, variant: 'ghost', onClick: () => { this.slowMo = !this.slowMo; this.updateButtonStates(); } }) },
            { btn: this.ui.makeButton({ text: 'Pause', x: this.W - 255, y: 15, width: 50, height: 26, variant: 'ghost', onClick: () => { this.paused = !this.paused; this.updateButtonStates(); } }) },
            { btn: this.ui.makeButton({ text: 'Reset', x: this.W - 200, y: 15, width: 50, height: 26, variant: 'ghost', onClick: () => this.buildScene(this.currentScene) }) },
            { btn: this.ui.makeButton({ text: 'AABB', x: this.W - 145, y: 15, width: 48, height: 26, variant: 'ghost', onClick: () => { this.showAABBs = !this.showAABBs; this.updateButtonStates(); } }) },
            { btn: this.ui.makeButton({ text: 'CPs', x: this.W - 92, y: 15, width: 40, height: 26, variant: 'ghost', onClick: () => { this.showContacts = !this.showContacts; this.updateButtonStates(); } }) }
        ];

        // Bottom background panel
        this.ui.add(new ActionUIPanel({
            x: 0, y: this.H - 48, width: this.W, height: 48,
            title: null, shadow: false, fill: true, border: false
        }));

        // Scene buttons (bottom bar)
        const sceneButtonW = 110;
        const totalSceneW = SCENES.length * (sceneButtonW + 4) - 4;
        const sceneStartX = (this.W - totalSceneW) / 2;
        this.sceneButtons = SCENES.map((name, i) => ({
            btn: this.ui.makeButton({
                text: name,
                x: sceneStartX + i * (sceneButtonW + 4),
                y: this.H - 36,
                width: sceneButtonW,
                height: 28,
                variant: 'secondary',
                onClick: () => { this.currentScene = i; this.buildScene(i); this.updateButtonStates(); }
            })
        }));
        
        this.updateButtonStates();

        // Stats label (bottom center)
        this.statsLabel = this.ui.makeLabel({
            text: '',
            x: 0, y: 530, width: this.W, height: 14,
            fontSize: t.fontSizeSm, color: t.colorTextMuted, align: 'center'
        });

        // Debug panel
        this.debugPanel = new ActionUIPanel({
            x: 10, y: 48, width: 320, height: 220,
            title: 'Debug Info', shadow: true, visible: false, layer: 'debug'
        });
        this.ui.add(this.debugPanel);

        this.debugLabels = [];
        const debugLines = [
            'Scene', 'Bodies', 'Dynamic', 'Sleeping', 'Contacts', 'Gravity',
            'Vel iters', 'Broadphase', 'FPS', 'dt', 'Spawn', 'AABB', 'CPs'
        ];
        debugLines.forEach((label, i) => {
            const lbl = new ActionUILabel({
                text: `${label}: --`,
                x: 20, y: 95 + i * 13, width: 280, height: 12,
                fontSize: t.fontSizeSm, color: t.colorTextMuted, layer: 'debug'
            });
            this.debugPanel.addChild(lbl);
            this.debugLabels.push(lbl);
        });
    }

    updateButtonStates() {
        // Update mode buttons
        this.modeButtons.forEach((m, i) => {
            m.btn.variant = this.spawnMode === this.modeNames[i] ? 'primary' : 'secondary';
        });
        
        // Update scene buttons
        this.sceneButtons.forEach((s, i) => {
            s.btn.variant = this.currentScene === i ? 'primary' : 'secondary';
        });

        // Update control buttons (toggle states)
        this.ctrlButtons[0].btn.variant = this.slowMo ? 'primary' : 'ghost';
        this.ctrlButtons[1].btn.variant = this.paused ? 'primary' : 'ghost';
        this.ctrlButtons[3].btn.variant = this.showAABBs ? 'primary' : 'ghost';
        this.ctrlButtons[4].btn.variant = this.showContacts ? 'primary' : 'ghost';
    }

    // ── Scene Building ─────────────────────────

    buildScene(idx) {
        this.world = new ActionPhysicsWorld2D();

        this.bodyColors = new Map();
        this.activeManifolds = [];
        this.contactFlashes = [];
        this.colorIndex = 0;

        // Hide ListView if not in callbacks scene
        if (this.contactListView) {
            this.contactListView.visible = (idx === 3);
        }

        this.world.onContact((m) => {
            this.activeManifolds.push(m);
            // Impact sound
            const impA = m.bodyA.linearVelocity.lengthSquared();
            const impB = m.bodyB.linearVelocity.lengthSquared();
            const imp = Math.sqrt(impA + impB);
            if (imp > 150) {
                for (let c = 0; c < m.contacts.length; c++) {
                    this.contactFlashes.push({
                        x: m.contacts[c].worldPoint.x,
                        y: m.contacts[c].worldPoint.y,
                        life: 1, maxLife: 1,
                        intensity: Math.min(1, imp / 400)
                    });
                }
                if (imp > 300) {
                    this.audio.play('hit_hard', { volume: Math.min(0.15, imp / 3000) });
                } else {
                    this.audio.play('hit_soft', { volume: Math.min(0.1, imp / 4000) });
                }
            }
        });

        switch (idx) {
            case 0: this.sceneStacking(); break;
            case 1: this.scenePyramid(); break;
            case 2: this.sceneSquarePyramid(); break;
            case 3: this.sceneCallbacks(); break;
        }

        this.audio.play('scene_change', { volume: 0.12 });
    }

    addWalls(restitution = 0.3, friction = 0.5) {
        const T = 25;
        const floorOffset = 50; // raise floor up by this many pixels
        // Floor
        this.addStaticBox(this.W / 2, this.H - T / 2 - floorOffset, this.W / 2 + T, T / 2, 0, restitution, friction, { type: 'wall', name: 'Floor' });
        // Left
        this.addStaticBox(-T / 2, this.H / 2, T / 2, this.H / 2 + T, 0, restitution, friction, { type: 'wall', name: 'Left Wall' });
        // Right
        this.addStaticBox(this.W + T / 2, this.H / 2, T / 2, this.H / 2 + T, 0, restitution, friction, { type: 'wall', name: 'Right Wall' });
    }

    addCeiling(restitution = 0.3, friction = 0.5) {
        this.addStaticBox(this.W / 2, -12, this.W / 2 + 25, 12, 0, restitution, friction);
    }

    addStaticBox(x, y, hw, hh, angle = 0, restitution = 0.3, friction = 0.5, userData = null) {
        const shape = new ActionBoxShape2D(hw, hh);
        const body = this.world.createBody(shape, {
            type: 'static', x, y, angle, friction, restitution, userData
        });
        this.bodyColors.set(body.id, '#334455');
        return body;
    }

    spawnCircle(x, y, radius, opts = {}) {
        const shape = new ActionCircleShape2D(radius);
        const body = this.world.createBody(shape, {
            type: 'dynamic', x, y,
            density: opts.density || 1,
            restitution: opts.restitution !== undefined ? opts.restitution : 0.35,
            friction: opts.friction !== undefined ? opts.friction : 0.5,
            linearDamping: opts.linearDamping !== undefined ? opts.linearDamping : 0.01,
            angularDamping: opts.angularDamping !== undefined ? opts.angularDamping : 0.01
        });
        if (opts.vx !== undefined || opts.vy !== undefined) {
            body.setLinearVelocity(opts.vx || 0, opts.vy || 0);
        }
        this.bodyColors.set(body.id, opts.color || pickColor(this.colorIndex++));
        return body;
    }

    spawnBox(x, y, hw, hh, opts = {}) {
        const shape = new ActionBoxShape2D(hw, hh);
        const body = this.world.createBody(shape, {
            type: 'dynamic', x, y,
            angle: opts.angle || 0,
            density: opts.density || 1,
            restitution: opts.restitution !== undefined ? opts.restitution : 0.2,
            friction: opts.friction !== undefined ? opts.friction : 0.5,
            linearDamping: opts.linearDamping !== undefined ? opts.linearDamping : 0.01,
            angularDamping: opts.angularDamping !== undefined ? opts.angularDamping : 0.01
        });
        if (opts.vx !== undefined || opts.vy !== undefined) {
            body.setLinearVelocity(opts.vx || 0, opts.vy || 0);
        }
        this.bodyColors.set(body.id, opts.color || pickColor(this.colorIndex++));
        return body;
    }

    // ── Scenes ─────────────────────────────────

    sceneStacking() {
        this.addWalls(0.3, 0.6);

        // Shelf
        this.addStaticBox(400, 420, 100, 8, 0, 0.2, 0.8);
        // Ramp
        this.addStaticBox(180, 350, 100, 8, 0.35, 0.2, 0.6);

        // Stack of boxes on shelf
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 3; col++) {
                this.spawnBox(370 + col * 22, 390 - row * 22, 10, 10, {
                    restitution: 0.05, friction: 0.7
                });
            }
        }

        // Some circles on the ramp - different fixed sizes (inverted order)
        const circleSizes = [20, 18, 16, 14, 12];
        for (let i = 0; i < 5; i++) {
            this.spawnCircle(120 + i * 20, 280 - i * 30, circleSizes[i], {
                restitution: 0.3
            });
        }

        // Launcher ball
        this.spawnCircle(60, 200, 22, {
            density: 3, restitution: 0.5,
            vx: 500, vy: 50, color: '#f4a261'
        });
    }

    scenePyramid() {
        this.addWalls(0.2, 0.7);

        const rows = 9;
        const bw = 22, bh = 14; // rectangular bricks
        for (let row = 0; row < rows; row++) {
            const count = rows - row;
            const startX = this.W / 2 - count * (bw + 2) / 2 + bw / 2;
            const y = this.H - 90 - row * (bh + 2);
            for (let col = 0; col < count; col++) {
                this.spawnBox(startX + col * (bw + 2), y, bw / 2, bh / 2, {
                    restitution: 0.1, friction: 0.7
                });
            }
        }

        // Cannonball
        this.spawnCircle(40, 350, 20, {
            density: 5, restitution: 0.3,
            vx: 900, vy: -100, color: '#e63946'
        });
    }

    sceneSquarePyramid() {
        this.addWalls(0.15, 0.8);

        // Larger square pyramid — 12 rows of 20px squares
        const rows = 12;
        const size = 20;
        for (let row = 0; row < rows; row++) {
            const count = rows - row;
            const startX = this.W / 2 - count * (size + 1) / 2 + size / 2;
            const y = this.H - 90 - row * (size + 1);
            for (let col = 0; col < count; col++) {
                this.spawnBox(startX + col * (size + 1), y, size / 2, size / 2, {
                    restitution: 0.05, friction: 0.8
                });
            }
        }

        // Two cannonballs from opposite sides
        this.spawnCircle(40, 380, 18, {
            density: 5, restitution: 0.3,
            vx: 2000, vy: -50, color: '#e63946'
        });
        this.spawnCircle(this.W - 40, 480, 16, {
            density: 4, restitution: 0.3,
            vx: -4000, vy: 0, color: '#457b9d'
        });
    }

    fireBullet(x, y, tx, ty) {
        const dx = tx - x, dy = ty - y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return;
        this.spawnCircle(x, y, 5, {
            density: 3, restitution: 0.5, friction: 0.1,
            vx: (dx / len) * 2000,
            vy: (dy / len) * 2000,
            color: '#ff2d55'
        });
        this.audio.play('bullet_fire', { volume: 0.5 });
    }

    // ── Callbacks Scene ────────────────────────

    sceneCallbacks() {
        // Clear contact log and set up ListView
        this.contactLog = [];
        this.spawnedBodyCount = 0;
        
        // Remove old ListView if exists
        if (this.contactListView) {
            this.ui.remove(this.contactListView);
        }

        // Create ListView for contact log with opacity
        this.contactListView = new ActionUIListView({
            x: 10, y: 55, width: 400, height: 200,
            itemHeight: 16, padding: 8, maxItems: this.maxLogLines, layer: 'gui'
        });
        this.contactListView.opacity = 0.5;
        this.ui.add(this.contactListView);

        // Use standard walls
        this.addWalls(0.1, 0.9);

        // Player ball
        this.playerBody = this.world.createBody(new ActionCircleShape2D(15), {
            type: 'dynamic',
            x: 100,
            y: 100,
            restitution: 0.5,
            friction: 0.3,
            linearDamping: 0.05,
            angularDamping: 0.05,
            density: 0.01,
            userData: { type: 'player', name: 'Player Ball' }
        });
        this.bodyColors.set(this.playerBody.id, '#00ff55');

        this.playerBody.onContactStart((otherBody) => {
            this.log(`PLAYER contacted: ${otherBody.userData.name}`);
            this.audio.play('hit_hard', { volume: 0.2 });
        });

        this.playerBody.onContact((otherBody) => {
            // Log once per contact (not every frame)
            if (!this.playerBody._lastLoggedContacts) {
                this.playerBody._lastLoggedContacts = new Set();
            }
            if (!this.playerBody._lastLoggedContacts.has(otherBody.id)) {
                this.log(`~ touching ${otherBody.userData.name}`);
                this.playerBody._lastLoggedContacts.add(otherBody.id);
            }
        });

        this.playerBody.onContactEnd((otherBody) => {
            this.log(`PLAYER left: ${otherBody.userData.name}`);
            if (this.playerBody._lastLoggedContacts) {
                this.playerBody._lastLoggedContacts.delete(otherBody.id);
            }
        });

        // Pre-placed example objects
        const examples = [
            { x: 300, y: 150, shape: 'circle', radius: 20, name: 'Blue Ball' },
            { x: 500, y: 150, shape: 'box', w: 25, h: 25, name: 'Red Box' },
            { x: 700, y: 200, shape: 'circle', radius: 15, name: 'Yellow Sphere' },
            { x: 400, y: 350, shape: 'box', w: 60, h: 15, name: 'Green Platform' },
        ];

        const colors = ['#4488ff', '#ff4444', '#ffff00', '#44ff44'];

        examples.forEach((ex, idx) => {
            let body;
            if (ex.shape === 'circle') {
                body = this.world.createBody(new ActionCircleShape2D(ex.radius), {
                    type: 'dynamic',
                    x: ex.x,
                    y: ex.y,
                    restitution: 0.2,
                    friction: 0.8,
                    linearDamping: 0.1,
                    angularDamping: 0.1,
                    density: 1.0,
                    userData: { type: 'example', name: ex.name }
                });
            } else {
                body = this.world.createBody(new ActionBoxShape2D(ex.w, ex.h), {
                    type: 'dynamic',
                    x: ex.x,
                    y: ex.y,
                    restitution: 0.1,
                    friction: 0.9,
                    linearDamping: 0.15,
                    angularDamping: 0.15,
                    density: 1.0,
                    userData: { type: 'example', name: ex.name }
                });
            }

            this.bodyColors.set(body.id, colors[idx]);

            body.onContactStart((otherBody) => {
                if (otherBody === this.playerBody) {
                    this.log(`${ex.name} touched by PLAYER`);
                }
            });

            body.onContactEnd((otherBody) => {
                if (otherBody === this.playerBody) {
                    this.log(`${ex.name} lost PLAYER`);
                }
            });
        });
    }

    log(msg) {
        const timestamp = new Date().toLocaleTimeString();
        const logMsg = `[${timestamp}] ${msg}`;
        this.contactLog.unshift(logMsg);
        if (this.contactLog.length > this.maxLogLines) {
            this.contactLog.pop();
        }
        
        // Add to ListView if it exists
        if (this.contactListView) {
            this.contactListView.addItem(logMsg);
        }
    }

    // ── ActionEngine Hooks ─────────────────────

    action_update() {
        const now = performance.now();
        this.dt = Math.min((now - this.lastTime) / 1000, 0.05);
        this.lastTime = now;

        // FPS
        this._fpsTimer += this.dt;
        this._fpsCounter++;
        if (this._fpsTimer >= 0.5) {
            this.fps = Math.round(this._fpsCounter / this._fpsTimer);
            this._fpsTimer = 0;
            this._fpsCounter = 0;
        }

        this.ui.update(this.dt);
        this.handleInput();

        if (!this.paused) {
            // Fixed timestep physics (decoupled from framerate)
            // timeScale controls simulation speed, not timestep size
            this.physicsAccumulator += this.dt * this.timeScale;
            while (this.physicsAccumulator >= this.fixedDt) {
                this.activeManifolds = [];
                this.world.fixed_update(this.fixedDt);
                this.physicsAccumulator -= this.fixedDt;
            }

            // Interpolation factor: how far we are between the last and next physics step
            this.renderAlpha = this.physicsAccumulator / this.fixedDt;

            // Update flashes (fade out 2x faster)
            for (let i = this.contactFlashes.length - 1; i >= 0; i--) {
                this.contactFlashes[i].life -= this.dt * 8;
                if (this.contactFlashes[i].life <= 0) this.contactFlashes.splice(i, 1);
            }

            // Cull offscreen bodies
            for (let i = this.world.bodies.length - 1; i >= 0; i--) {
                const b = this.world.bodies[i];
                if (b.type === 'static') continue;
                if (b.position.y > this.H + 300 || b.position.y < -500 ||
                    b.position.x < -300 || b.position.x > this.W + 300) {
                    this.world.removeBody(b);
                    this.bodyColors.delete(b.id);
                }
            }
        }
    }

    action_draw() {
        this.drawGame();
        this.drawGUI();
        if (this.debugVisible) this.drawDebug();
        else this.debugCtx.clearRect(0, 0, this.W, this.H);
    }

    // ── Input ──────────────────────────────────

    handleInput() {
        // Update timeScale based on slowMo
        this.timeScale = this.slowMo ? 0.25 : 1.0;

        // Keys
        if (this.input.isKeyJustPressed('ActionDebugToggle')) this.debugVisible = !this.debugVisible;
        if (this.input.isKeyJustPressed('Action1')) {
            const modes = ['circle', 'box', 'bullet'];
            this.spawnMode = modes[(modes.indexOf(this.spawnMode) + 1) % modes.length];
        }
        if (this.input.isKeyJustPressed('Action2')) this.showContacts = !this.showContacts;
        if (this.input.isKeyJustPressed('Action3')) this.showAABBs = !this.showAABBs;
        if (this.input.isKeyJustPressed('Action5')) {
            this.slowMo = !this.slowMo;
            this.timeScale = this.slowMo ? 0.25 : 1.0;
        }
        if (this.input.isKeyJustPressed('Action4')) this.paused = !this.paused;

        // Arrow push (all four directions)
        if (this.input.isKeyPressed('DirUp')) {
            for (const b of this.world.bodies) {
                if (b.type === 'dynamic') b.applyForce(0, -300 * b.mass);
            }
        }
        if (this.input.isKeyPressed('DirDown')) {
            for (const b of this.world.bodies) {
                if (b.type === 'dynamic') b.applyForce(0, 200 * b.mass);
            }
        }
        if (this.input.isKeyPressed('DirLeft')) {
            for (const b of this.world.bodies) {
                if (b.type === 'dynamic') b.applyForce(-300 * b.mass, 0);
            }
        }
        if (this.input.isKeyPressed('DirRight')) {
            for (const b of this.world.bodies) {
                if (b.type === 'dynamic') b.applyForce(300 * b.mass, 0);
            }
        }

        // Pointer spawning
        if (this.input.isPointerJustDown()) {
            const pos = this.input.getPointerPosition();
            const mx = pos.x, my = pos.y;
            if (mx !== undefined && my !== undefined && my > 44 && my < this.H - 48) {
                this.spawnAtPointer(mx, my);
            }
        }
    }

    spawnAtPointer(x, y) {
        if (this.spawnMode === 'bullet') {
            this.fireBullet(this.W / 2, this.H - 100, x, y);
        } else if (this.spawnMode === 'circle') {
            const body = this.spawnCircle(x, y, 10 + Math.random() * 14, { restitution: 0.4 });
            if (this.currentScene === 3) this.attachSpawnedBodyCallbacks(body);
            this.audio.play('spawn', { volume: 0.15 });
        } else if (this.spawnMode === 'box') {
            const body = this.spawnBox(x, y, 10 + Math.random() * 16, 8 + Math.random() * 12, {
                angle: Math.random() * Math.PI, restitution: 0.3
            });
            if (this.currentScene === 3) this.attachSpawnedBodyCallbacks(body);
            this.audio.play('spawn', { volume: 0.15 });
        }
    }

    attachSpawnedBodyCallbacks(body) {
        const name = body.shape.type === ActionShapeType2D.CIRCLE ? `Spawned Circle ${this.spawnedBodyCount || 0}` : `Spawned Box ${this.spawnedBodyCount || 0}`;
        if (!body.userData) body.userData = {};
        body.userData.name = name;
        this.spawnedBodyCount = (this.spawnedBodyCount || 0) + 1;
        
        body.onContactStart((otherBody) => {
            if (otherBody === this.playerBody) {
                this.log(`${body.userData.name} touched by PLAYER`);
            }
        });

        body.onContactEnd((otherBody) => {
            if (otherBody === this.playerBody) {
                this.log(`${body.userData.name} lost PLAYER`);
            }
        });
    }

    // ── Game Layer ─────────────────────────────

    drawGame() {
        const ctx = this.gameCtx;

        // Background
        const bg = ctx.createRadialGradient(this.W / 2, this.H / 2, 60, this.W / 2, this.H / 2, this.W);
        bg.addColorStop(0, '#1a1a2e');
        bg.addColorStop(1, '#0d0d1a');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, this.W, this.H);

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.025)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= this.W; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.H); ctx.stroke();
        }
        for (let y = 0; y <= this.H; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke();
        }

        // AABBs
        if (this.showAABBs) {
            ctx.strokeStyle = 'rgba(255,255,0,0.15)';
            ctx.lineWidth = 1;
            for (const b of this.world.bodies) {
                const a = b.getAABB();
                ctx.strokeRect(a.minX, a.minY, a.width, a.height);
            }
        }

        // Bodies (with interpolation for smooth slowmo)
        for (const b of this.world.bodies) {
            this.drawBody(ctx, b, this.renderAlpha);
        }

        // Contact flashes
        for (const f of this.contactFlashes) {
            const alpha = f.life * f.intensity;
            ctx.save();
            ctx.globalAlpha = alpha;
            const r = 3.5 * f.intensity * f.life; // 4x smaller
            const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.4, '#ffcc66');
            grad.addColorStop(1, 'rgba(255,120,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Contact points overlay
        if (this.showContacts) {
            for (const m of this.activeManifolds) {
                for (const cp of m.contacts) {
                    ctx.fillStyle = '#ff0';
                    ctx.beginPath();
                    ctx.arc(cp.worldPoint.x, cp.worldPoint.y, 3, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = '#0f0';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(cp.worldPoint.x, cp.worldPoint.y);
                    ctx.lineTo(cp.worldPoint.x + m.normal.x * 20, cp.worldPoint.y + m.normal.y * 20);
                    ctx.stroke();
                }
            }
        }

        // Pause overlay
        if (this.paused) {
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(0, 0, this.W, this.H);
            ctx.fillStyle = '#e0e8f0';
            ctx.font = 'bold 36px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('PAUSED', this.W / 2, this.H / 2);
            ctx.font = '14px monospace';
            ctx.fillStyle = '#8899aa';
            ctx.fillText('Action4 or Pause button to resume', this.W / 2, this.H / 2 + 36);
        }
    }

    drawBody(ctx, body, alpha = 1) {
        const color = this.bodyColors.get(body.id) || '#888';
        const isStatic = body.type === 'static';
        const asleep = body.type === 'dynamic' && !body.isAwake;

        // Use interpolated position for smooth rendering
        const state = isStatic ? { x: body.position.x, y: body.position.y, angle: body.angle }
                               : body.getInterpolatedState(alpha);

        ctx.save();
        ctx.translate(state.x, state.y);
        ctx.rotate(state.angle);

        if (body.shape.type === ActionShapeType2D.CIRCLE) {
            const r = body.shape.radius;

            if (!isStatic && !asleep) {
                ctx.shadowColor = color;
                ctx.shadowBlur = 8;
            }

            ctx.fillStyle = asleep ? '#3a3f4a' : color;
            ctx.globalAlpha = isStatic ? 0.55 : (asleep ? 0.35 : 0.85);
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Rotation line
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(r * 0.8, 0);
            ctx.stroke();

            // Border (inset by half lineWidth so stroke stays inside shape)
            ctx.globalAlpha = 1;
            const circleLineWidth = asleep ? 1 : 1.5;
            ctx.strokeStyle = asleep ? '#555' : (isStatic ? '#475569' : color);
            ctx.lineWidth = circleLineWidth;
            if (asleep) ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.arc(0, 0, r - circleLineWidth / 2, 0, Math.PI * 2);
            ctx.stroke();
            if (asleep) ctx.setLineDash([]);

            // Sleep indicator
            if (asleep) {
                ctx.globalAlpha = 0.6;
                ctx.fillStyle = '#8899aa';
                ctx.font = `${Math.max(8, r * 0.5)}px Arial`;
                ctx.textAlign = 'center';
                ctx.fillText('z', r * 0.5, -r * 0.4);
                ctx.font = `${Math.max(6, r * 0.35)}px Arial`;
                ctx.fillText('z', r * 0.8, -r * 0.8);
            }

        } else if (body.shape.type === ActionShapeType2D.BOX) {
            const hw = body.shape.halfWidth;
            const hh = body.shape.halfHeight;

            if (!isStatic && !asleep) {
                ctx.shadowColor = color;
                ctx.shadowBlur = 6;
            }

            ctx.fillStyle = asleep ? '#3a3f4a' : color;
            ctx.globalAlpha = isStatic ? 0.5 : (asleep ? 0.3 : 0.8);
            ctx.fillRect(-hw, -hh, hw * 2, hh * 2);
            ctx.shadowBlur = 0;

            ctx.globalAlpha = 1;
            const boxLineWidth = asleep ? 1 : 1.5;
            ctx.strokeStyle = asleep ? '#555' : (isStatic ? '#475569' : color);
            ctx.lineWidth = boxLineWidth;
            if (asleep) ctx.setLineDash([4, 3]);
            ctx.strokeRect(-hw + boxLineWidth / 2, -hh + boxLineWidth / 2, hw * 2 - boxLineWidth, hh * 2 - boxLineWidth);
            if (asleep) ctx.setLineDash([]);

            // Center cross (awake only)
            if (!isStatic && !asleep) {
                ctx.strokeStyle = 'rgba(255,255,255,0.25)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-hw * 0.3, 0); ctx.lineTo(hw * 0.3, 0);
                ctx.moveTo(0, -hh * 0.3); ctx.lineTo(0, hh * 0.3);
                ctx.stroke();
            }

            // Sleep indicator
            if (asleep) {
                ctx.globalAlpha = 0.6;
                ctx.fillStyle = '#8899aa';
                const sz = Math.max(8, Math.min(hw, hh) * 0.45);
                ctx.font = `${sz}px Arial`;
                ctx.textAlign = 'center';
                ctx.fillText('z', hw * 0.35, -hh * 0.25);
                ctx.font = `${sz * 0.7}px Arial`;
                ctx.fillText('z', hw * 0.65, -hh * 0.65);
            }
        }

        ctx.restore();
    }

    // ── GUI Layer ──────────────────────────────

    drawGUI() {
        this.guiCtx.clearRect(0, 0, this.W, this.H);

        // Update stats label
        const s = this.world.stats;
        this.statsLabel.text = `Bodies: ${s.bodyCount}  |  Dynamic: ${s.dynamicCount}  |  Sleeping: ${s.sleepingCount}  |  Contacts: ${s.contactCount}  |  FPS: ${this.fps}`;

        // ActionUI draws buttons automatically
        this.ui.draw('gui');
    }

    // ── Debug Layer ────────────────────────────

    drawDebug() {
        this.debugCtx.clearRect(0, 0, this.W, this.H);

        // Toggle debug panel visibility
        this.debugPanel.visible = this.debugVisible;

        if (this.debugVisible) {
            const s = this.world.stats;
            const values = [
                SCENES[this.currentScene],
                s.bodyCount.toString(),
                s.dynamicCount.toString(),
                `${s.sleepingCount} / ${s.dynamicCount}`,
                s.contactCount.toString(),
                `(${this.world.gravityX}, ${this.world.gravityY})`,
                this.world.solver.velocityIterations.toString(),
                `${this.world.broadphase.cellSize}px cells`,
                this.fps.toString(),
                `${(this.dt * 1000).toFixed(1)}ms`,
                this.spawnMode,
                this.showAABBs.toString(),
                this.showContacts.toString()
            ];

            this.debugLabels.forEach((label, i) => {
                const labelName = label.text.split(':')[0];
                label.text = `${labelName}: ${values[i]}`;
            });

            // Draw debug UI
            this.ui.draw('debug');
        }
    }
}
