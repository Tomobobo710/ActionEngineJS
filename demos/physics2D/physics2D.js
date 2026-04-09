// game/game.js — ActionPhysics2D Demo

const SCENES = ['Stacking', 'Pyramid', 'SquarePyramid', 'Funnel', 'Mixed', 'Chaos'];

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
        // Scene buttons (bottom bar)
        const bw = 80, gap = 4;
        const totalW = SCENES.length * (bw + gap) - gap;
        const startX = (this.W - totalW) / 2;
        this.sceneButtons = SCENES.map((name, i) => {
            const btn = { id: `scene_${i}`, label: name, x: startX + i * (bw + gap), y: this.H - 40, w: bw, h: 30, hovered: false };
            this.input.registerElement(btn.id, { bounds: () => ({ x: btn.x, y: btn.y, width: btn.w, height: btn.h }) });
            return btn;
        });

        // Top-right control buttons
        this.ctrlButtons = [
            { id: 'btn_slowmo', label: 'Slow', x: this.W - 315, y: 10, w: 50, h: 26, hovered: false },
            { id: 'btn_pause', label: 'Pause', x: this.W - 260, y: 10, w: 50, h: 26, hovered: false },
            { id: 'btn_reset', label: 'Reset', x: this.W - 205, y: 10, w: 50, h: 26, hovered: false },
            { id: 'btn_aabb', label: 'AABB', x: this.W - 150, y: 10, w: 46, h: 26, hovered: false },
            { id: 'btn_cps', label: 'CPs', x: this.W - 100, y: 10, w: 38, h: 26, hovered: false },
        ];
        this.ctrlButtons.forEach(b => {
            this.input.registerElement(b.id, { bounds: () => ({ x: b.x, y: b.y, width: b.w, height: b.h }) });
        });

        // Spawn mode buttons
        this.modeButtons = [
            { id: 'mode_circle', label: 'Circle', mode: 'circle', x: 14, y: 10, w: 58, h: 26, hovered: false },
            { id: 'mode_box', label: 'Box', mode: 'box', x: 76, y: 10, w: 42, h: 26, hovered: false },
            { id: 'mode_bullet', label: 'Bullet', mode: 'bullet', x: 122, y: 10, w: 55, h: 26, hovered: false },
        ];
        this.modeButtons.forEach(b => {
            this.input.registerElement(b.id, { bounds: () => ({ x: b.x, y: b.y, width: b.w, height: b.h }) });
        });
    }

    // ── Scene Building ─────────────────────────

    buildScene(idx) {
        this.world = new ActionPhysicsWorld2D();

        this.bodyColors = new Map();
        this.activeManifolds = [];
        this.contactFlashes = [];
        this.colorIndex = 0;

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
            case 3: this.sceneFunnel(); break;
            case 4: this.sceneMixed(); break;
            case 5: this.sceneChaos(); break;
        }

        this.audio.play('scene_change', { volume: 0.12 });
    }

    addWalls(restitution = 0.3, friction = 0.5) {
        const T = 25;
        const floorOffset = 50; // raise floor up by this many pixels
        // Floor
        this.addStaticBox(this.W / 2, this.H - T / 2 - floorOffset, this.W / 2 + T, T / 2, 0, restitution, friction);
        // Left
        this.addStaticBox(-T / 2, this.H / 2, T / 2, this.H / 2 + T, 0, restitution, friction);
        // Right
        this.addStaticBox(this.W + T / 2, this.H / 2, T / 2, this.H / 2 + T, 0, restitution, friction);
    }

    addCeiling(restitution = 0.3, friction = 0.5) {
        this.addStaticBox(this.W / 2, -12, this.W / 2 + 25, 12, 0, restitution, friction);
    }

    addStaticBox(x, y, hw, hh, angle = 0, restitution = 0.3, friction = 0.5) {
        const shape = new ActionBoxShape2D(hw, hh);
        const body = this.world.createBody(shape, {
            type: 'static', x, y, angle, friction, restitution
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

        // Some circles on the ramp
        for (let i = 0; i < 5; i++) {
            this.spawnCircle(120 + i * 20, 280 - i * 30, 10 + Math.random() * 8, {
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

    sceneFunnel() {
        this.addWalls(0.4, 0.3);

        // Funnel walls
        this.addStaticBox(220, 260, 120, 8, 0.65, 0.4, 0.2);
        this.addStaticBox(580, 260, 120, 8, -0.65, 0.4, 0.2);

        // Shelves below funnel with gap
        this.addStaticBox(250, 400, 100, 8, 0, 0.3, 0.4);
        this.addStaticBox(550, 400, 100, 8, 0, 0.3, 0.4);

        // Rain of objects
        for (let i = 0; i < 25; i++) {
            const x = 250 + Math.random() * 300;
            const y = -30 - i * 26;
            if (Math.random() > 0.4) {
                this.spawnCircle(x, y, 8 + Math.random() * 12, { restitution: 0.45 });
            } else {
                this.spawnBox(x, y, 8 + Math.random() * 12, 6 + Math.random() * 8, {
                    angle: Math.random() * Math.PI, restitution: 0.35
                });
            }
        }
    }

    sceneMixed() {
        this.addWalls(0.4, 0.4);

        // Platforms
        this.addStaticBox(200, 380, 90, 8, 0.3, 0.3, 0.6);
        this.addStaticBox(580, 300, 90, 8, -0.25, 0.3, 0.6);
        this.addStaticBox(400, 430, 80, 8, 0, 0.3, 0.6);

        // Circles
        for (let i = 0; i < 10; i++) {
            this.spawnCircle(
                100 + Math.random() * 600,
                50 + Math.random() * 200,
                10 + Math.random() * 16,
                { restitution: 0.3 + Math.random() * 0.4 }
            );
        }

        // Boxes
        for (let i = 0; i < 8; i++) {
            this.spawnBox(
                100 + Math.random() * 600,
                50 + Math.random() * 200,
                10 + Math.random() * 18,
                8 + Math.random() * 12,
                { angle: Math.random() * Math.PI, restitution: 0.2 + Math.random() * 0.3 }
            );
        }
    }

    sceneChaos() {
        this.addWalls(0.6, 0.2);
        this.addCeiling(0.6, 0.2);

        // Spinning rotor platforms (static, rotated each frame)
        this.chaosRotors = [
            { body: this.addStaticBox(200, 250, 70, 8, 0, 0.5, 0.1), speed: 1.8 },
            { body: this.addStaticBox(600, 350, 70, 8, 0, 0.5, 0.1), speed: -2.2 },
            { body: this.addStaticBox(400, 180, 60, 8, 0, 0.5, 0.1), speed: 1.4 },
        ];

        // Chaos objects
        for (let i = 0; i < 25; i++) {
            const x = 80 + Math.random() * 640;
            const y = 80 + Math.random() * 400;
            const vx = (Math.random() - 0.5) * 500;
            const vy = (Math.random() - 0.5) * 500;
            if (Math.random() > 0.35) {
                this.spawnCircle(x, y, 8 + Math.random() * 14, {
                    restitution: 0.65, vx, vy
                });
            } else {
                this.spawnBox(x, y, 10 + Math.random() * 14, 8 + Math.random() * 10, {
                    angle: Math.random() * Math.PI,
                    restitution: 0.65, friction: 0.15, vx, vy
                });
            }
        }
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

        this.handleInput();

        if (!this.paused) {
            // Chaos rotors
            if (this.currentScene === 4 && this.chaosRotors) {
                for (const cr of this.chaosRotors) {
                    cr.body.angle += cr.speed * this.dt;
                    cr.body._aabbDirty = true;
                }
            }

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
        // Scene buttons
        this.sceneButtons.forEach((b, i) => {
            b.hovered = this.input.isElementHovered(b.id);
            if (this.input.isElementJustPressed(b.id)) {
                this.currentScene = i;
                this.buildScene(i);
            }
        });

        // Control buttons
        this.ctrlButtons.forEach(b => {
            b.hovered = this.input.isElementHovered(b.id);
        });
        if (this.input.isElementJustPressed('btn_slowmo')) {
            this.slowMo = !this.slowMo;
            this.timeScale = this.slowMo ? 0.25 : 1.0;
        }
        if (this.input.isElementJustPressed('btn_pause')) this.paused = !this.paused;
        if (this.input.isElementJustPressed('btn_reset')) this.buildScene(this.currentScene);
        if (this.input.isElementJustPressed('btn_aabb')) this.showAABBs = !this.showAABBs;
        if (this.input.isElementJustPressed('btn_cps')) this.showContacts = !this.showContacts;

        // Mode buttons
        this.modeButtons.forEach(b => {
            b.hovered = this.input.isElementHovered(b.id);
            if (this.input.isElementJustPressed(b.id)) this.spawnMode = b.mode;
        });

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
            this.spawnCircle(x, y, 10 + Math.random() * 14, { restitution: 0.4 });
            this.audio.play('spawn', { volume: 0.15 });
        } else if (this.spawnMode === 'box') {
            this.spawnBox(x, y, 10 + Math.random() * 16, 8 + Math.random() * 12, {
                angle: Math.random() * Math.PI, restitution: 0.3
            });
            this.audio.play('spawn', { volume: 0.15 });
        }
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
        const ctx = this.guiCtx;
        ctx.clearRect(0, 0, this.W, this.H);

        // Top bar
        ctx.fillStyle = 'rgba(5,5,15,0.72)';
        ctx.fillRect(0, 0, this.W, 42);

        // Mode buttons
        for (const b of this.modeButtons) {
            const active = this.spawnMode === b.mode;
            this.drawButton(ctx, b, active);
        }

        // Stats (center)
        ctx.fillStyle = '#6899bb';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        const s = this.world.stats;
        ctx.fillText(
            `Bodies: ${s.bodyCount}  |  Dynamic: ${s.dynamicCount}  |  Sleeping: ${s.sleepingCount}  |  Contacts: ${s.contactCount}  |  FPS: ${this.fps}`,
            this.W / 2, 30
        );

        // Control buttons
        for (const b of this.ctrlButtons) {
            const active = (b.id === 'btn_slowmo' && this.slowMo) ||
                           (b.id === 'btn_pause' && this.paused) ||
                           (b.id === 'btn_aabb' && this.showAABBs) ||
                           (b.id === 'btn_cps' && this.showContacts);
            this.drawButton(ctx, b, active);
        }

        // Bottom scene bar
        ctx.fillStyle = 'rgba(5,5,15,0.78)';
        ctx.fillRect(0, this.H - 48, this.W, 48);

        this.sceneButtons.forEach((b, i) => {
            this.drawButton(ctx, b, i === this.currentScene);
        });

        // Hints
        ctx.fillStyle = 'rgba(100,130,160,0.5)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
            'Click: spawn  |  ◀▶: scenes  |  Action1: mode  |  Action4: pause  |  F9: debug',
            this.W / 2, this.H - 52
        );
    }

    drawButton(ctx, b, active) {
        ctx.fillStyle = active ? 'rgba(70,130,190,0.9)'
                       : b.hovered ? 'rgba(50,70,100,0.85)'
                       : 'rgba(20,25,42,0.85)';
        ctx.strokeStyle = active ? '#5599cc' : 'rgba(60,80,120,0.5)';
        ctx.lineWidth = active ? 1.5 : 1;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = active ? '#ddeeff' : b.hovered ? '#b0c8e0' : '#6a7a8a';
        ctx.font = active ? 'bold 10px monospace' : '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
        ctx.textBaseline = 'alphabetic';
    }

    // ── Debug Layer ────────────────────────────

    drawDebug() {
        const ctx = this.debugCtx;
        ctx.clearRect(0, 0, this.W, this.H);

        const px = 10, py = 48;
        const panelW = 260, panelH = 310;

        ctx.fillStyle = 'rgba(0,12,4,0.88)';
        ctx.strokeStyle = '#00aa44';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(px, py, panelW, panelH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00ff66';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const s = this.world.stats;
        const lines = [
            '── ActionPhysicsWorld2D Debug ──',
            '',
            `Scene         : ${SCENES[this.currentScene]}`,
            `Bodies        : ${s.bodyCount}`,
            `Dynamic       : ${s.dynamicCount}`,
            `Sleeping      : ${s.sleepingCount} / ${s.dynamicCount}`,
            `Contacts      : ${s.contactCount}`,
            `CCD hits      : ${s.ccdCount}`,
            `Gravity       : (${this.world.gravityX}, ${this.world.gravityY})`,
            '',
            `Vel iters     : ${this.world.solver.velocityIterations}`,
            `Pos iters     : ${this.world.solver.positionIterations}`,
            `CCD           : ${this.world.enableCCD ? 'ON' : 'OFF'}`,
            `Broadphase    : ${this.world.broadphase.cellSize}px cells`,
            '',
            `FPS           : ${this.fps}`,
            `dt            : ${(this.dt * 1000).toFixed(1)}ms`,
            `Spawn mode    : ${this.spawnMode}`,
            `Show AABB     : ${this.showAABBs}`,
            `Show CPs      : ${this.showContacts}`,
        ];

        for (let i = 0; i < lines.length; i++) {
            const col = lines[i].startsWith('──') ? '#44ff88'
                      : lines[i].includes('Sleeping') ? (s.sleepingCount > 0 ? '#88ffaa' : '#00ff66')
                      : '#00ff66';
            ctx.fillStyle = col;
            ctx.fillText(lines[i], px + 10, py + 10 + i * 14);
        }

        ctx.textBaseline = 'alphabetic';
    }
}
