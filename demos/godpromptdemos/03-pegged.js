// PEGGED - the ActionPhysics2D showcase, polished: an ActionEngine splash, an ActionUI menu,
// a dynamic zoom/follow camera, slow-mo (that even drags the background with it), a ball trail,
// programmatic ActionSprite2D background orbs, and a hand-laid organic peg layout.
//
// Physics: dynamic circle ball vs static circle pegs / orange targets / bouncy bumpers, oriented
// box bars + side walls, and a moving box BUCKET that catches the ball via a real collision
// callback (ActionPhysics2D has no sensors, so we detect onContact then remove the ball that same
// frame -> reads as "caught", never bounced). Smooth rendering via getInterpolatedState(alpha).
const W = 800, H = 600;
const STEP = 1 / 120;
const LAUNCH = { x: 400, y: 46 };
const BUCKET_Y = 700, DESTROY_Y = 900;

class Game {
    static WIDTH = W;
    static HEIGHT = H;

    constructor(canvases, input, audio) {
        this.input = input;
        this.audio = audio;
        this.gameCanvas = canvases.gameCanvas;
        this.gameCtx = this.gameCanvas.getContext('2d');
        this.guiCtx = canvases.guiCtx;
        this.debugCtx = canvases.debugCtx;

        this.ui = new ActionUI(canvases, input);
        this.ui.setTheme('neon');
        this.renderer2D = new ActionRenderer2D(this.gameCanvas);   // draws ActionSprite2D onto our 2D context

        this.world = new ActionPhysicsWorld2D({ gravityY: 720 });
        this.cam = { x: 400, y: 360, zoom: 0.74 };
        this.timeScale = 1; this._acc = 0; this._simT = 0; this._bgT = 0; this.alpha = 0;
        this._toRemove = []; this.aimWorld = { x: 400, y: 300 };
        this.pegs = []; this.boxes = []; this.ball = null; this.trail = [];
        this.score = 0; this.ballsLeft = 10; this.targetsLeft = 0; this.bucket = null;

        this.state = 'splash'; this._splashT = 0;

        this.buildBackgroundSprites();
        this.buildMenu();
        this.buildPause();
        this.setupAudio();
        console.log('[Pegged] ready');
    }

    // ---------- programmatic ActionSprite2D background orbs ----------
    glowCanvas(size, hex) {
        const cv = document.createElement('canvas'); cv.width = cv.height = size;
        const x = cv.getContext('2d'); const r = size / 2;
        const g = x.createRadialGradient(r, r, 0, r, r, r);
        g.addColorStop(0, hex); g.addColorStop(0.4, hex.length === 7 ? hex + '80' : hex); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.beginPath(); x.arc(r, r, r, 0, Math.PI * 2); x.fill();
        return cv;
    }
    buildBackgroundSprites() {
        const defs = [['#3a5cff', 260, 180, 200], ['#a855f7', 220, 620, 380], ['#00d4ff', 200, 400, 520], ['#ff5fa2', 180, 700, 140]];
        this.orbs = defs.map(([hex, size, x, y]) => {
            const sp = new ActionSprite2D({ image: this.glowCanvas(size, hex), x, y, width: size, height: size, alpha: 0.5 });
            sp._home = { x, y }; sp._ph = Math.random() * 6.28; this.renderer2D.addSprite(sp); return sp;
        });
    }

    setupAudio() {
        this.audio.createSweepSound('launch', { startFreq: 300, endFreq: 600, type: 'triangle', duration: 0.12, envelope: { attack: 0.005, decay: 0.08, sustain: 0, release: 0.03 } });
        this.audio.createSweepSound('ping', { startFreq: 700, endFreq: 1000, type: 'sine', duration: 0.07, envelope: { attack: 0.002, decay: 0.05, sustain: 0, release: 0.02 } });
        this.audio.createComplexSound('target', { frequencies: [660, 990, 1320], types: ['sine', 'triangle', 'sine'], mix: [0.4, 0.35, 0.25], duration: 0.18, envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.07 } });
        this.audio.createComplexSound('bump', { frequencies: [180, 260], types: ['sine', 'square'], mix: [0.6, 0.4], duration: 0.1, envelope: { attack: 0.002, decay: 0.07, sustain: 0, release: 0.03 } });
        this.audio.createSweepSound('catch', { startFreq: 500, endFreq: 900, type: 'sine', duration: 0.2, envelope: { attack: 0.01, decay: 0.12, sustain: 0.05, release: 0.08 } });
        this.audio.createComplexSound('fanfare', { frequencies: [523, 659, 784, 1047], types: ['sine', 'triangle', 'sine', 'sine'], mix: [0.3, 0.3, 0.2, 0.2], duration: 0.7, envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.35 } });
        this.audio.createSweepSound('ui', { startFreq: 520, endFreq: 780, type: 'triangle', duration: 0.07, envelope: { attack: 0.005, decay: 0.06, sustain: 0, release: 0 } });
        this.audio.setVolume(0.5);
    }
    sfx(n, v = 0.4) { this.audio.play(n, { volume: v }); }

    // ---------- ActionUI menu ----------
    buildMenu() {
        const t = this.ui.theme, px = 270, pw = 260;
        const panel = this.ui.makePanel({ x: px, y: 196, width: pw, height: 250, title: '', shadow: true });
        this.menuPanel = panel;
        panel.addChild(new ActionUILabel({ text: 'PEGGED', x: px, y: 216, width: pw, height: 44, fontSize: t.fontSizeDisplay, fontWeight: t.fontWeightBold, color: 'primary', align: 'center', shadow: true }));
        panel.addChild(new ActionUILabel({ text: 'an ActionPhysics2D showcase', x: px, y: 262, width: pw, height: 18, fontSize: t.fontSizeSm, color: 'muted', align: 'center' }));
        panel.addChild(new ActionUIButton({ text: 'PLAY', x: px + 50, y: 296, width: pw - 100, height: 46, variant: 'primary', fontSize: 22, onClick: () => { this.sfx('ui', 0.2); this.startGame(); } }));
        panel.addChild(new ActionUISlider({ x: px + 40, y: 360, width: pw - 80, height: 30, min: 0, max: 100, value: 50, label: 'Volume', color: 'primary', onChange: (v) => this.audio.setVolume(v / 100) }));
        panel.addChild(new ActionUILabel({ text: 'aim + click to launch · hold Shift = slow-mo', x: px, y: 410, width: pw, height: 16, fontSize: t.fontSizeXs, color: 'muted', align: 'center' }));
    }
    buildPause() {
        const t = this.ui.theme, px = 290, pw = 220;
        const panel = this.ui.makePanel({ x: px, y: 200, width: pw, height: 210, title: '', shadow: true });
        this.pausePanel = panel;
        panel.addChild(new ActionUILabel({ text: 'PAUSED', x: px, y: 222, width: pw, height: 36, fontSize: t.fontSizeXxl, fontWeight: t.fontWeightBold, color: 'primary', align: 'center', shadow: true }));
        panel.addChild(new ActionUIButton({ text: 'RESUME', x: px + 40, y: 280, width: pw - 80, height: 44, variant: 'success', fontSize: 18, onClick: () => { this.sfx('ui', 0.2); this.resume(); } }));
        panel.addChild(new ActionUIButton({ text: 'QUIT TO MENU', x: px + 40, y: 332, width: pw - 80, height: 38, variant: 'ghost', onClick: () => { this.sfx('ui', 0.2); this.quitToMenu(); } }));
    }
    syncPanels() { this.menuPanel.visible = this.state === 'menu'; this.pausePanel.visible = this.state === 'paused'; }

    pauseToggle() {
        if (this.state === 'paused') { this.resume(); }
        else if (this.state === 'aim' || this.state === 'flight' || this.state === 'fever') { this._prePause = this.state; this.state = 'paused'; this.sfx('ui', 0.2); }
    }
    resume() { this.state = this._prePause || 'aim'; }
    quitToMenu() { this.removeBall(); this.state = 'menu'; }

    startGame() { this.buildLevel(); this.state = 'aim'; }

    // ---------- level (organic layout: arches + flowers, working AROUND the bars) ----------
    buildLevel() {
        this.world.bodies.length = 0;
        this.pegs = []; this.boxes = []; this.score = 0; this.ballsLeft = 10; this.targetsLeft = 0;
        this.ball = null; this.trail = []; this._acc = 0; this.state = 'aim';

        // side walls (their OWN colour, distinct from the bars) - span the FULL board, no top/bottom gap
        this.addBox(14, 450, 14, 540, 0, '#0e8a8a');
        this.addBox(786, 450, 14, 540, 0, '#0e8a8a');
        // two angled deflector bars (indigo) - the layout is built to leave clearance around these
        this.bars = [this.addBox(214, 350, 50, 7, 0.5, '#6a5cff', 0.55), this.addBox(586, 350, 50, 7, -0.5, '#6a5cff', 0.55)];

        // an ARCH of pegs raining across the top (alternating targets)
        this.addArch(400, -70, 300, 15, Math.PI * 0.22, Math.PI * 0.78, (i) => i % 2 === 0 ? 'target' : 'peg');
        // FLOWERS (centre target + petal ring), placed clear of the bars
        this.addFlower(120, 250); this.addFlower(680, 250);
        this.addFlower(400, 300, { petalR: 38 });
        this.addFlower(250, 470); this.addFlower(550, 470);
        // a couple of loose accent pegs to soften the gaps
        for (const [x, y] of [[400, 430], [330, 380], [470, 380]]) this.addPeg(x, y, 'peg');
        // permanent bouncy BUMPERS framing the lower field
        for (const [x, y] of [[245, 285], [555, 285], [400, 560]]) this.addPeg(x, y, 'bumper');

        this.targetsLeft = this.pegs.filter(p => p.kind === 'target').length;

        // moving BUCKET, far below the pegs (catch via real collision callback)
        this.bucket = this.world.createBody(new ActionBoxShape2D(52, 11), { type: 'static', x: 400, y: BUCKET_Y, restitution: 0.05, friction: 0.6 });
        this.bucket.userData = { kind: 'bucket' };
        this._bucketHit = false;
        this.bucket.onContact((other) => { if (other && other.userData && other.userData.kind === 'ball') this._bucketHit = true; });
    }

    addBox(x, y, hw, hh, angle, color, restitution = 0.3) {
        const body = this.world.createBody(new ActionBoxShape2D(hw, hh), { type: 'static', x, y, angle, restitution, friction: 0.4 });
        this.boxes.push({ body, hw, hh, color }); return body;
    }
    addPeg(x, y, kind) {
        const bumper = kind === 'bumper', r = bumper ? 15 : 8;
        const body = this.world.createBody(new ActionCircleShape2D(r), { type: 'static', x, y, restitution: bumper ? 1.05 : 0.5, friction: 0.2 });
        const peg = { body, x, y, r, kind, alive: true, hit: 0 };
        body.userData = peg;
        body.onContactStart((other) => {
            if (!peg.alive || !other || !other.userData || other.userData.kind !== 'ball') return;
            if (peg.kind === 'bumper') { peg.hit = 1; this.sfx('bump', 0.35); return; }
            peg.alive = false; this._toRemove.push(peg);
        });
        this.pegs.push(peg); return peg;
    }
    addArch(cx, cy, r, count, a0, a1, kindFn) {
        for (let i = 0; i < count; i++) { const t = count === 1 ? 0 : i / (count - 1), a = a0 + (a1 - a0) * t; this.addPeg(cx + Math.cos(a) * r, cy + Math.sin(a) * r, typeof kindFn === 'function' ? kindFn(i) : kindFn || 'peg'); }
    }
    addFlower(cx, cy, opts = {}) {
        const petals = opts.petals || 6, pr = opts.petalR || 30;
        this.addPeg(cx, cy, 'target');
        for (let i = 0; i < petals; i++) { const a = (i / petals) * Math.PI * 2 - Math.PI / 2; this.addPeg(cx + Math.cos(a) * pr, cy + Math.sin(a) * pr, 'peg'); }
    }

    // ---------- ball lifecycle ----------
    launch() {
        let dx = this.aimWorld.x - LAUNCH.x, dy = this.aimWorld.y - LAUNCH.y;
        if (dy < 0.25) dy = 0.25;
        const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
        this.ball = this.world.createBody(new ActionCircleShape2D(8), { type: 'dynamic', x: LAUNCH.x, y: LAUNCH.y, restitution: 0.45, friction: 0.2, density: 1 });
        this.ball.userData = { kind: 'ball' };
        this.ball.setLinearVelocity(dx * 540, dy * 540);
        this.ballsLeft--; this.state = 'flight'; this._caught = false; this._bucketHit = false; this.trail = [];
        this.sfx('launch', 0.4);
    }
    removeBall() { if (this.ball) { this.world.removeBody(this.ball); this.ball = null; } this.trail = []; }
    afterBall() {
        if (this.targetsLeft <= 0) { this.state = 'win'; this.sfx('fanfare', 0.5); }
        else if (this.ballsLeft <= 0) this.state = 'over';
        else this.state = 'aim';
    }
    processRemovals() {
        if (!this._toRemove.length) return;
        for (const peg of this._toRemove) {
            this.world.removeBody(peg.body);
            if (peg.kind === 'target') { this.score += 1000; this.targetsLeft--; this.sfx('target', 0.5); if (this.targetsLeft === 0 && this.ball) this.state = 'fever'; }
            else { this.score += 100; this.sfx('ping', 0.3); }
        }
        this._toRemove.length = 0;
    }
    updateBallState() {
        if (!this.ball) return;
        if (this._bucketHit && !this._caught) { this._caught = true; this.ballsLeft++; this.sfx('catch', 0.5); this.removeBall(); this.afterBall(); return; }
        const p = this.ball.position;
        if (p.y > DESTROY_Y || p.x < -80 || p.x > 880) { this.removeBall(); this.afterBall(); }
    }

    // ---------- camera ----------
    screenToWorld(sx, sy) { return { x: (sx - W / 2) / this.cam.zoom + this.cam.x, y: (sy - H / 2) / this.cam.zoom + this.cam.y }; }
    updateCamera() {
        let tx = 400, ty = 360, tz = 0.74;
        if ((this.state === 'flight' || this.state === 'fever') && this.ball) { tx = this.ball.position.x; ty = this.ball.position.y; tz = this.state === 'fever' ? 2.2 : 1.4; }
        const k = this.state === 'fever' ? 0.12 : 0.08;
        this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k; this.cam.zoom += (tz - this.cam.zoom) * k;
    }

    action_update(dt) {
        dt = Math.min(dt || 0, 0.05);
        this.ui.update(dt);
        this.syncPanels();
        const ptr = this.input.getPointerPosition();
        this.aimWorld = this.screenToWorld(ptr.x, ptr.y);

        if (this.input.isRawKeyJustPressed('KeyP')) this.pauseToggle();   // P = a RAW key (not in the action map)
        if (this.state === 'paused') { this._bgT += dt * 0.15; this.updateOrbs(dt * 0.15); return; }

        if (this.state === 'splash') {
            this._splashT += dt;
            if (this._splashT > 2.6 || this.input.isKeyJustPressed('Action1') || this.input.isLeftMouseButtonJustPressed()) this.state = 'menu';
            this._bgT += dt; this.updateOrbs(dt); return;
        }
        if (this.state === 'menu') { this._bgT += dt; this.updateOrbs(dt); return; }

        if (this.state === 'aim' && (this.input.isLeftMouseButtonJustPressed() || this.input.isPointerJustDown())) this.launch();
        if ((this.state === 'win' || this.state === 'over') && this.input.isKeyJustPressed('Action1')) this.buildLevel();

        const slowHeld = this.input.isKeyPressed('Action2');
        this.timeScale = this.state === 'fever' ? 0.22 : slowHeld ? 0.3 : 1.0;
        this._bgT += dt * this.timeScale;        // BACKGROUND slows with the action too
        this.updateOrbs(dt * this.timeScale);

        this._acc += dt * this.timeScale;
        let steps = 0;
        while (this._acc >= STEP && steps < 8) {
            this._simT += STEP;
            this.bucket.setPosition(400 + Math.sin(this._simT * 1.0) * 250, BUCKET_Y);
            for (const pg of this.pegs) if (pg.hit > 0) pg.hit = Math.max(0, pg.hit - STEP * 4);
            this.world.fixed_update(STEP);
            this._acc -= STEP; steps++;
            this.processRemovals(); this.updateBallState();
        }
        this.alpha = this._acc / STEP;
        if (this.ball) { const p = this.ball.position; this.trail.push({ x: p.x, y: p.y }); if (this.trail.length > 22) this.trail.shift(); }
        this.updateCamera();
    }
    updateOrbs(dt) {
        for (const o of this.orbs) { o._ph += dt * 0.5; o.x = o._home.x + Math.sin(o._ph) * 50; o.y = o._home.y + Math.cos(o._ph * 0.8) * 40; o.alpha = 0.35 + 0.18 * Math.sin(o._ph * 1.3); }
    }

    // ---------- draw ----------
    action_draw() {
        const ctx = this.gameCtx;
        const slow = this.timeScale < 1;
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, slow ? '#0a1230' : '#0a0a22'); grad.addColorStop(1, slow ? '#10204a' : '#161636');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        this.renderer2D.renderSprites();    // programmatic ActionSprite2D background orbs (screen space)

        if (this.state === 'splash') { this.drawSplash(ctx); this.guiCtx.clearRect(0, 0, W, H); this.debugCtx.clearRect(0, 0, W, H); return; }

        const g = this.guiCtx; g.clearRect(0, 0, W, H);
        if (this.state === 'menu') {
            g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, W, H);
            this.ui.draw('gui'); this.debugCtx.clearRect(0, 0, W, H); return;
        }

        // ===== world (camera transform) =====
        ctx.save();
        ctx.translate(W / 2, H / 2); ctx.scale(this.cam.zoom, this.cam.zoom); ctx.translate(-this.cam.x, -this.cam.y);
        for (const b of this.boxes) { ctx.save(); ctx.translate(b.body.position.x, b.body.position.y); ctx.rotate(b.body.angle); ctx.fillStyle = b.color; ctx.fillRect(-b.hw, -b.hh, b.hw * 2, b.hh * 2); ctx.restore(); }
        // bucket
        ctx.save(); ctx.translate(this.bucket.position.x, this.bucket.position.y); ctx.fillStyle = '#1f8fff'; ctx.fillRect(-52, -11, 104, 22); ctx.fillStyle = 'rgba(160,220,255,0.5)'; ctx.fillRect(-52, -11, 104, 5); ctx.restore();
        // pegs
        for (const p of this.pegs) {
            if (!p.alive) continue;
            const cx = p.body.position.x, cy = p.body.position.y;
            if (p.kind === 'bumper') { ctx.fillStyle = p.hit > 0 ? '#ffffff' : '#a855f7'; ctx.shadowColor = '#c084fc'; ctx.shadowBlur = 14; }
            else if (p.kind === 'target') { const pulse = 0.5 + 0.5 * Math.sin(this._bgT * 4 + cx); ctx.fillStyle = '#ff8800'; ctx.shadowColor = '#ffb347'; ctx.shadowBlur = 8 + pulse * 9; }
            else { ctx.fillStyle = '#4aa3ff'; ctx.shadowColor = '#4aa3ff'; ctx.shadowBlur = 7; }
            ctx.beginPath(); ctx.arc(cx, cy, p.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(cx - p.r * 0.3, cy - p.r * 0.3, p.r * 0.3, 0, Math.PI * 2); ctx.fill();
        }
        // ball trail
        for (let i = 0; i < this.trail.length; i++) { const t = this.trail[i], a = (i / this.trail.length); ctx.fillStyle = `rgba(120,200,255,${a * 0.5})`; ctx.beginPath(); ctx.arc(t.x, t.y, 8 * a, 0, Math.PI * 2); ctx.fill(); }
        // ball
        if (this.ball) { const s = this.ball.getInterpolatedState(this.alpha); ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#bfe6ff'; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(s.x, s.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }
        // aim guide
        if (this.state === 'aim') {
            let dx = this.aimWorld.x - LAUNCH.x, dy = this.aimWorld.y - LAUNCH.y; if (dy < 0.25) dy = 0.25;
            const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2 / this.cam.zoom; ctx.setLineDash([6, 8]);
            ctx.beginPath(); ctx.moveTo(LAUNCH.x, LAUNCH.y); ctx.lineTo(LAUNCH.x + dx * 160, LAUNCH.y + dy * 160); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.fillStyle = '#cfe0ff'; ctx.shadowColor = '#cfe0ff'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(LAUNCH.x, LAUNCH.y, 12, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.restore();

        // slow-mo tint overlay (screen space)
        if (slow && this.state !== 'fever') { ctx.fillStyle = 'rgba(80,140,255,0.08)'; ctx.fillRect(0, 0, W, H); }

        // ===== HUD (styled pills) =====
        this.drawHUD(g);
        if (this.timeScale < 1 && this.state !== 'fever') { this.banner(g, '◄◄ SLOW-MO', 64, '#7fb0ff', 'rgba(40,70,140,0.85)'); }
        if (this.state === 'fever') { g.fillStyle = 'rgba(255,140,0,0.12)'; g.fillRect(0, 0, W, H); this.banner(g, '★ EXTREME FEVER ★', 96, '#ffce8a', 'rgba(150,70,0,0.9)', 26); }
        if (this.state === 'win' || this.state === 'over') {
            g.fillStyle = 'rgba(4,6,20,0.7)'; g.fillRect(0, 0, W, H);
            this.pill(g, W / 2 - 180, 224, 360, 130, 'rgba(16,20,48,0.95)', this.state === 'win' ? '#6ee7b7' : '#ff6b6b', 14);
            g.fillStyle = this.state === 'win' ? '#6ee7b7' : '#ff6b6b'; g.font = 'bold 44px monospace'; g.textAlign = 'center';
            g.fillText(this.state === 'win' ? 'CLEARED!' : 'OUT OF BALLS', W / 2, 274);
            g.fillStyle = '#eaf2ff'; g.font = '20px monospace'; g.fillText(`Final Score  ${this.score}`, W / 2, 308);
            g.fillStyle = '#8fa6c8'; g.font = '14px monospace'; g.fillText('Space to play again', W / 2, 338);
        }

        // pause overlay (frozen world behind) + ActionUI resume/quit menu
        if (this.state === 'paused') { g.fillStyle = 'rgba(4,6,20,0.6)'; g.fillRect(0, 0, W, H); this.ui.draw('gui'); }
        this.debugCtx.clearRect(0, 0, W, H);
    }

    // ---------- HUD helpers ----------
    rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    pill(g, x, y, w, h, fill, stroke, r = 9) { this.rr(g, x, y, w, h, r); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke(); } }
    banner(g, text, y, color, bg, size = 18) {
        g.font = `bold ${size}px monospace`; g.textAlign = 'center'; const w = g.measureText(text).width + 36;
        this.pill(g, W / 2 - w / 2, y - size, w, size + 14, bg, color, 8);
        g.fillStyle = color; g.fillText(text, W / 2, y);
    }
    drawHUD(g) {
        // top scrim for legibility
        const sc = g.createLinearGradient(0, 0, 0, 64); sc.addColorStop(0, 'rgba(6,8,24,0.85)'); sc.addColorStop(1, 'rgba(6,8,24,0)');
        g.fillStyle = sc; g.fillRect(0, 0, W, 64);
        // SCORE pill (left)
        this.pill(g, 14, 12, 168, 42, 'rgba(16,22,54,0.9)', 'rgba(74,163,255,0.6)');
        g.textAlign = 'left'; g.fillStyle = '#7fb0ff'; g.font = '10px monospace'; g.fillText('SCORE', 26, 26);
        g.fillStyle = '#eaf2ff'; g.font = 'bold 20px monospace'; g.fillText(String(this.score), 26, 47);
        // TARGETS pill (center) with a little target ring
        this.pill(g, W / 2 - 84, 12, 168, 42, 'rgba(46,28,10,0.9)', 'rgba(255,154,60,0.7)');
        g.textAlign = 'left'; g.fillStyle = '#ffb874'; g.font = '10px monospace'; g.fillText('TARGETS', W / 2 - 56, 26);
        g.fillStyle = '#ff9a3c'; g.font = 'bold 20px monospace'; g.fillText(String(this.targetsLeft), W / 2 - 56, 47);
        const tx = W / 2 + 60, ty = 33; g.strokeStyle = '#ff9a3c'; g.lineWidth = 2; g.beginPath(); g.arc(tx, ty, 9, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#ff9a3c'; g.beginPath(); g.arc(tx, ty, 3.5, 0, Math.PI * 2); g.fill();
        // BALLS pill (right) with ball dots
        this.pill(g, W - 182, 12, 168, 42, 'rgba(16,22,54,0.9)', 'rgba(190,220,255,0.5)');
        g.textAlign = 'left'; g.fillStyle = '#bcd6ff'; g.font = '10px monospace'; g.fillText('BALLS', W - 170, 26);
        g.fillStyle = '#eaf2ff'; g.font = 'bold 20px monospace'; g.fillText(String(this.ballsLeft), W - 170, 47);
        for (let i = 0; i < Math.min(this.ballsLeft, 6); i++) { g.fillStyle = '#cfe6ff'; g.beginPath(); g.arc(W - 130 + i * 18, 33, 5, 0, Math.PI * 2); g.fill(); }
        // bottom hint pill
        g.font = '12px monospace'; const hint = 'aim + click  ·  hold Shift slow-mo  ·  P pause';
        const hw = g.measureText(hint).width + 28; this.pill(g, W / 2 - hw / 2, H - 30, hw, 22, 'rgba(8,10,28,0.7)', null, 8);
        g.fillStyle = '#8fa6c8'; g.textAlign = 'center'; g.fillText(hint, W / 2, H - 15);
    }

    drawSplash(ctx) {
        const t = this._splashT;
        const fade = Math.min(1, t * 1.2) * Math.min(1, (2.6 - t) * 2.5);
        ctx.save(); ctx.globalAlpha = Math.max(0, fade);
        // a few "physics" dots arcing in
        for (let i = 0; i < 8; i++) { const a = t * 2 + i * 0.8; const x = W / 2 + Math.cos(a) * (80 + i * 8); const y = 230 + Math.sin(a * 1.3) * (40 + i * 4); ctx.fillStyle = `hsl(${(i * 40 + t * 60) % 360},80%,60%)`; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); }
        ctx.shadowBlur = 0;
        const s = 1 + Math.sin(t * 3) * 0.03;
        ctx.translate(W / 2, 330); ctx.scale(s, s);
        ctx.fillStyle = '#eaf6ff'; ctx.font = 'bold 56px monospace'; ctx.textAlign = 'center'; ctx.shadowColor = '#4aa3ff'; ctx.shadowBlur = 24;
        ctx.fillText('ActionEngine', 0, 0); ctx.shadowBlur = 0;
        ctx.fillStyle = '#7fb0ff'; ctx.font = '18px monospace'; ctx.fillText('2D physics  ·  presents', 0, 36);
        ctx.restore();
    }
}
