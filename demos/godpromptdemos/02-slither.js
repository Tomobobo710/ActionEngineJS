// SLITHER - the ActionInputHandler showcase.
//
// This game is the reference for INPUT. It uses NO ActionUI at all - every button,
// menu, and clickable board object is a raw input ELEMENT that you register with the
// input handler and hit-test yourself. It demonstrates the whole input surface:
//
//   * registerElement(id, { bounds: () => ({x,y,width,height}) }, layer)  // 'gui' | 'game' | 'debug'
//     - bounds is a FUNCTION (re-read every move), so elements can follow moving objects.
//     - call removeElement(id, layer) when an object disappears, or its hit-area lingers.
//   * isElementHovered(id, layer) / isElementJustPressed(id, layer) / isElementPressed(...)
//     - NOTE: a mousedown with ANY button sets an element "pressed". To tell buttons apart,
//       combine isElementHovered(id) with isLeft/Right/MiddleMouseButtonJustPressed().
//   * Mouse: isLeft/Right/MiddleMouseButtonJustPressed() / ...Down(), getPointerPosition()
//   * Abstract actions: Action1..Action8, Hotbar1-9 (number row), Dir keys, ActionDebugToggle
//   * Every action is triggerable by its KEY *or* by clicking its legend entry (a 'gui' element),
//     proving keys and click-elements drive the same code.
//
// (ActionInputHandler has no mouse-wheel support, so "speed" is bound to Hotbar 1-9.)

const CELL = 20;
const COLS = 30;            // play field is the left 600px...
const ROWS = 30;            // ...600 tall. The right 200px is the input legend.
const PLAY_W = COLS * CELL; // 600
const PANEL_X = PLAY_W;     // legend starts here
// Sidebar legend layout - shared by registration AND drawing so the hit-areas always match the
// boxes, and everything is computed (not hand-placed) so it stays centered as rows are added.
const LEG_X = PANEL_X + 8;      // row left edge
const LEG_W = 184;              // row width
const LEG_TOP = 134;            // y of the first action row
const LEG_PITCH = 28;           // row-to-row spacing
const LEG_H = 26;               // row box height
const CAP_W = 34, CAP_H = 20;   // keycap size (kept vertically centered in each row)

class Game {
    static WIDTH = 800;
    static HEIGHT = 600;

    constructor(canvases, input, audio) {
        this.input = input;
        this.audio = audio;
        this.gameCtx = canvases.gameCanvas.getContext('2d');
        this.guiCtx = canvases.guiCtx;
        this.debugCtx = canvases.debugCtx;
        this.W = Game.WIDTH; this.H = Game.HEIGHT;

        this.state = 'menu';        // menu | playing | paused | over
        this.score = 0; this.best = 0;
        this._t = 0; this._acc = 0;
        this.bgStyle = 0;           // 0 plasma | 1 rings | 2 stripes
        this.wrap = false;          // walls kill, or wrap around?
        this.colorIdx = 0;
        this.foodColorIdx = 0;
        this.showGrid = false;
        this.bgSpeed = 1; this._bgT = 0;   // background animation clock (its own scaled time)
        this.speedLevel = 5;        // 1..9 (Hotbar)
        this.diff = 1;              // menu difficulty 0..2
        this.showInspector = false; // ActionDebugToggle -> live input inspector

        this.PALETTES = [
            { head: '#00f5ff', body: '#39ff14' },
            { head: '#ff206e', body: '#fbff12' },
            { head: '#a855f7', body: '#22d3ee' },
            { head: '#f97316', body: '#f43f5e' },
        ];
        this.FOOD_COLORS = ['#ff006e', '#ffd500', '#00e676', '#ff6d00', '#d946ef'];
        this.DIFFS = [{ name: 'Chill', step: 0.16 }, { name: 'Normal', step: 0.12 }, { name: 'Manic', step: 0.085 }];

        this.gems = [];             // clickable board tokens {id, x, y, life}
        this._gemSeq = 0; this._gemTimer = 2;
        this.beacons = [];          // {x, y} teleport pads placed by middle-click
        this.flash = {};            // actionId -> seconds remaining (legend glow on use)

        // The unified action table: key OR legend-click triggers fn (hold actions read continuously).
        this.actions = [
            { id: 'pause', key: 'Pause', tag: 'P', name: 'Pause', fn: () => this.togglePause() },
            { id: 'grid', key: 'Action1', tag: 'Spc', name: 'Grid lines', fn: () => { this.showGrid = !this.showGrid; } },
            // raw key: 'KeyH' isn't in the action map, so this row reads it directly via isRawKeyJustPressed.
            { id: 'food', raw: 'KeyH', tag: 'H', name: 'Food color', fn: () => { this.foodColorIdx = (this.foodColorIdx + 1) % this.FOOD_COLORS.length; } },
            { id: 'turbo', key: 'Action2', tag: 'Sft', name: 'Turbo (hold)', hold: true },
            { id: 'color', key: 'Action3', tag: 'E', name: 'Slither color', fn: () => { this.colorIdx = (this.colorIdx + 1) % this.PALETTES.length; } },
            { id: 'walls', key: 'Action4', tag: 'Q', name: 'Toggle walls', fn: () => { this.wrap = !this.wrap; } },
            { id: 'bg', key: 'Action5', tag: 'Z', name: 'BG style', fn: () => { this.bgStyle = (this.bgStyle + 1) % 3; } },
            // two more RAW keys (Action1-8 are all taken) - slow down / speed up the background.
            { id: 'bgslow', raw: 'BracketLeft', tag: '[', name: 'BG slower', fn: () => { this.bgSpeed = Math.max(0, this.bgSpeed - 0.5); } },
            { id: 'bgfast', raw: 'BracketRight', tag: ']', name: 'BG faster', fn: () => { this.bgSpeed = Math.min(4, this.bgSpeed + 0.5); } },
            { id: 'clear', key: 'Action6', tag: 'X', name: 'Clear board', fn: () => this.clearBoard() },
            { id: 'gem', key: 'Action7', tag: 'C', name: 'Spawn gem', fn: () => this.spawnGem() },
            { id: 'shuffle', key: 'Action8', tag: 'F', name: 'Move food', fn: () => this.placeFood() },
        ];
        // the mouse wheel fires these SAME two actions (two inputs -> one action).
        this.actBgSlow = this.actions.find(a => a.id === 'bgslow');
        this.actBgFast = this.actions.find(a => a.id === 'bgfast');

        this.setupAudio();
        // Bind the P key to a CUSTOM action. registerAction(name, [rawCodes]) is the clean way to add
        // a key that isn't in the default action map - then read it with the normal isKeyJustPressed('Pause').
        this.input.registerAction('Pause', ['KeyP']);
        this.registerMenuElements();
        this.registerLegendElements();
        this.resetSnake();
    }

    setupAudio() {
        this.audio.createSweepSound('eat', { startFreq: 440, endFreq: 880, type: 'square', duration: 0.1, envelope: { attack: 0.01, decay: 0.06, sustain: 0, release: 0.03 } });
        this.audio.createSweepSound('gem', { startFreq: 660, endFreq: 1320, type: 'triangle', duration: 0.14, envelope: { attack: 0.01, decay: 0.08, sustain: 0, release: 0.05 } });
        this.audio.createComplexSound('smash', { frequencies: [180, 90], types: ['sawtooth', 'square'], mix: [0.6, 0.4], duration: 0.18, envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.07 } });
        this.audio.createSweepSound('click', { startFreq: 520, endFreq: 760, type: 'triangle', duration: 0.06, envelope: { attack: 0.005, decay: 0.05, sustain: 0, release: 0 } });
        this.audio.createComplexSound('die', { frequencies: [220, 160, 110], types: ['sawtooth', 'triangle', 'sine'], mix: [0.5, 0.3, 0.2], duration: 0.5, envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.29 } });
        this.audio.setVolume(0.5);
    }
    sfx(n, v = 0.4) { this.audio.play(n, { volume: v }); }

    // ---------- input ELEMENT registration ----------
    // 'gui'-layer elements: the menu. Registered ONCE; bounds are functions so they always hit-test true.
    registerMenuElements() {
        this.input.registerElement('menu_play', { bounds: () => ({ x: 150, y: 330, width: 300, height: 58 }) }, 'gui');
        for (let i = 0; i < 3; i++) {
            this.input.registerElement('menu_diff' + i, { bounds: () => ({ x: 150 + i * 105, y: 420, width: 95, height: 40 }) }, 'gui');
        }
    }
    // 'gui'-layer elements: the action legend (each row clickable, mirrors its hotkey).
    registerLegendElements() {
        this.actions.forEach((a, i) => {
            this.input.registerElement('act_' + a.id, { bounds: () => ({ x: LEG_X, y: LEG_TOP + i * LEG_PITCH, width: LEG_W, height: LEG_H }) }, 'gui');
        });
    }

    // ---------- game-layer clickable tokens ----------
    spawnGem() {
        if (this.gems.length >= 6) return;
        let p, tries = 0;
        do { p = { x: (Math.random() * COLS) | 0, y: (Math.random() * ROWS) | 0 }; tries++; }
        while (tries < 50 && (this.snake.some(s => s.x === p.x && s.y === p.y) || (this.food.x === p.x && this.food.y === p.y) || this.gems.some(g => g.x === p.x && g.y === p.y)));
        const id = ++this._gemSeq;
        const gem = { id, x: p.x, y: p.y, life: 8 };
        this.gems.push(gem);
        // Register a 'game'-layer element whose bounds follow this gem's cell.
        this.input.registerElement('gem_' + id, { bounds: () => ({ x: gem.x * CELL, y: gem.y * CELL, width: CELL, height: CELL }) }, 'game');
    }
    removeGem(id) {
        this.gems = this.gems.filter(g => g.id !== id);
        this.input.removeElement('gem_' + id, 'game');   // critical: drop the hit-area too
    }
    clearBoard() { this.gems.slice().forEach(g => this.removeGem(g.id)); this.beacons = []; }

    resetSnake() {
        this.snake = [{ x: 8, y: 15 }, { x: 7, y: 15 }, { x: 6, y: 15 }];
        this.dir = { x: 1, y: 0 }; this.pendingDir = { x: 1, y: 0 };
        this.grow = 0;
        this.placeFood();
    }
    placeFood() {
        let f;
        do { f = { x: (Math.random() * COLS) | 0, y: (Math.random() * ROWS) | 0 }; }
        while (this.snake.some(s => s.x === f.x && s.y === f.y));
        this.food = f;
    }

    begin() {
        this.state = 'playing';
        this.score = 0; this._acc = 0;
        this.speedLevel = [3, 5, 7][this.diff];
        this.clearBoard();
        this.resetSnake();
    }
    togglePause() { if (this.state === 'playing') this.state = 'paused'; else if (this.state === 'paused') this.state = 'playing'; }

    stepTime() {
        // base from the Hotbar speed level (1 slow .. 9 fast), halved while Turbo is held
        const base = 0.20 - (this.speedLevel - 1) * 0.017;
        const turbo = this.input.isKeyPressed('Action2') || this.input.isElementPressed('act_turbo', 'gui');
        return Math.max(0.04, turbo ? base * 0.5 : base);
    }

    fire(a) { this.flash[a.id] = 0.35; this.sfx('click', 0.25); if (a.fn) a.fn(); }

    action_update(dt) {
        dt = Math.min(dt || 0, 0.05);
        this._t += dt;
        this._bgT += dt * this.bgSpeed;   // background runs on its own [ / ]-scaled clock

        // Mouse WHEEL drives BG speed too - it fires the SAME actions as the [ and ] keys.
        // Two different inputs (a raw key OR the wheel) routed to one action. Scroll up = faster.
        const wy = this.input.consumeWheel().y;
        if (wy < 0) this.fire(this.actBgFast);
        else if (wy > 0) this.fire(this.actBgSlow);
        for (const k in this.flash) { this.flash[k] -= dt; if (this.flash[k] <= 0) delete this.flash[k]; }

        // Live input inspector toggle (debug layer) - always available.
        if (this.input.isKeyJustPressed('ActionDebugToggle')) this.showInspector = !this.showInspector;

        if (this.state === 'menu' || this.state === 'over') { this.handleMenu(); return; }

        this.handleActions();   // action keys + legend clicks
        this.handleBoardMouse(); // clickable gems + middle-click beacons

        if (this.state !== 'playing') return;

        // Steering (no 180 reversal).
        if (this.input.isKeyJustPressed('DirUp') && this.dir.y === 0) this.pendingDir = { x: 0, y: -1 };
        else if (this.input.isKeyJustPressed('DirDown') && this.dir.y === 0) this.pendingDir = { x: 0, y: 1 };
        else if (this.input.isKeyJustPressed('DirLeft') && this.dir.x === 0) this.pendingDir = { x: -1, y: 0 };
        else if (this.input.isKeyJustPressed('DirRight') && this.dir.x === 0) this.pendingDir = { x: 1, y: 0 };

        // Gem lifetimes.
        for (const g of this.gems.slice()) { g.life -= dt; if (g.life <= 0) this.removeGem(g.id); }
        this._gemTimer -= dt;
        if (this._gemTimer <= 0) { this._gemTimer = 3.5; this.spawnGem(); }

        const st = this.stepTime();
        this._acc += dt;
        while (this._acc >= st) { this._acc -= st; this.step(); if (this.state !== 'playing') break; }
    }

    handleMenu() {
        // PLAY (also serves as RETRY on the game-over screen)
        if (this.input.isElementJustPressed('menu_play', 'gui') || this.input.isKeyJustPressed('Action1')) { this.sfx('click'); this.begin(); return; }
        for (let i = 0; i < 3; i++) {
            if (this.input.isElementJustPressed('menu_diff' + i, 'gui')) { this.sfx('click'); this.diff = i; }
        }
    }

    handleActions() {
        // Hotbar 1-9 -> speed level
        for (let n = 1; n <= 9; n++) if (this.input.isKeyJustPressed('Hotbar' + n)) { this.speedLevel = n; this.flash['speed'] = 0.35; this.sfx('click', 0.2); }
        // Each action: key OR legend-click triggers it (hold actions are read live in stepTime()).
        for (const a of this.actions) {
            if (a.hold) continue;
            // a.raw -> read an UNMAPPED key code directly; otherwise resolve the abstract action.
            const keyHit = a.raw ? this.input.isRawKeyJustPressed(a.raw) : this.input.isKeyJustPressed(a.key);
            if (keyHit || this.input.isElementJustPressed('act_' + a.id, 'gui')) this.fire(a);
        }
    }

    handleBoardMouse() {
        const p = this.input.getPointerPosition();
        const inPlay = p.x >= 0 && p.x < PLAY_W && p.y >= 0 && p.y < this.H;
        // Clickable gems: hover + a specific mouse button = different game actions.
        for (const g of this.gems.slice()) {
            const id = 'gem_' + g.id;
            if (!this.input.isElementHovered(id, 'game')) continue;
            if (this.input.isLeftMouseButtonJustPressed()) { this.score += 50; this.grow += 2; this.sfx('gem', 0.5); this.removeGem(g.id); }
            else if (this.input.isRightMouseButtonJustPressed()) { this.score += 25; this.sfx('smash', 0.5); this.removeGem(g.id); }
        }
        // Middle-click an empty cell -> drop a teleport beacon (distinct third button).
        if (inPlay && this.input.isMiddleMouseButtonJustPressed()) {
            const cx = (p.x / CELL) | 0, cy = (p.y / CELL) | 0;
            if (!this.beacons.some(b => b.x === cx && b.y === cy)) { this.beacons.push({ x: cx, y: cy }); this.sfx('click', 0.3); }
        }
    }

    step() {
        this.dir = this.pendingDir;
        let hx = this.snake[0].x + this.dir.x, hy = this.snake[0].y + this.dir.y;
        if (this.wrap) { hx = (hx + COLS) % COLS; hy = (hy + ROWS) % ROWS; }
        const head = { x: hx, y: hy };

        if (!this.wrap && (hx < 0 || hx >= COLS || hy < 0 || hy >= ROWS)) return this.die();
        if (this.snake.some(s => s.x === head.x && s.y === head.y)) return this.die();

        this.snake.unshift(head);

        // Teleport beacon?
        const bi = this.beacons.findIndex(b => b.x === head.x && b.y === head.y);
        if (bi >= 0) { this.beacons.splice(bi, 1); this.score += 5; let t; do { t = { x: (Math.random() * COLS) | 0, y: (Math.random() * ROWS) | 0 }; } while (this.snake.some(s => s.x === t.x && s.y === t.y)); this.snake[0] = t; this.sfx('gem', 0.3); }

        if (head.x === this.food.x && head.y === this.food.y) { this.score += 10; this.grow += 1; this.sfx('eat', 0.4); this.placeFood(); }

        if (this.grow > 0) this.grow--; else this.snake.pop();
    }

    die() { this.state = 'over'; this.best = Math.max(this.best, this.score); this.sfx('die'); }

    // ============================ DRAW ============================
    action_draw(alpha) {
        const ctx = this.gameCtx;
        this.drawBackground(ctx);
        if (this.state !== 'menu') { this.drawBoard(ctx); }

        // GUI layer: legend panel + menu/overlays
        const g = this.guiCtx;
        g.clearRect(0, 0, this.W, this.H);
        this.drawLegend(g);
        if (this.state === 'menu' || this.state === 'over') this.drawMenu(g);
        if (this.state === 'paused') { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, PLAY_W, this.H); g.fillStyle = '#e0f7ff'; g.font = 'bold 44px monospace'; g.textAlign = 'center'; g.fillText('PAUSED', PLAY_W / 2, 290); g.fillStyle = '#9fd9c8'; g.font = '16px monospace'; g.fillText('P to resume', PLAY_W / 2, 328); }

        // DEBUG layer: live input inspector
        this.debugCtx.clearRect(0, 0, this.W, this.H);
        if (this.showInspector) this.drawInspector(this.debugCtx);
    }

    drawBackground(ctx) {
        const t = this._bgT;
        if (this.bgStyle === 0) {                 // plasma on the grid
            for (let gy = 0; gy < ROWS; gy++) {
                for (let gx = 0; gx < COLS; gx++) {
                    const v = Math.sin(gx * 0.3 + t) + Math.sin(gy * 0.3 + t * 1.3) + Math.sin((gx + gy) * 0.2 + t * 0.7);
                    const hue = (v * 60 + t * 40) % 360;
                    ctx.fillStyle = `hsl(${(hue + 360) % 360}, 65%, 14%)`;
                    ctx.fillRect(gx * CELL, gy * CELL, CELL, CELL);
                }
            }
        } else if (this.bgStyle === 1) {          // rotating rings
            ctx.fillStyle = '#070a18'; ctx.fillRect(0, 0, PLAY_W, this.H);
            const cx = PLAY_W / 2, cy = this.H / 2;
            for (let r = 320; r > 0; r -= 26) {
                const hue = (r * 1.4 + t * 60) % 360;
                ctx.strokeStyle = `hsla(${hue},70%,55%,0.25)`; ctx.lineWidth = 10;
                ctx.beginPath(); ctx.arc(cx, cy, r + Math.sin(t * 2 + r * 0.05) * 8, 0, Math.PI * 2); ctx.stroke();
            }
        } else {                                  // diagonal hue stripes
            for (let i = -10; i < COLS + ROWS; i += 2) {
                const hue = (i * 12 + t * 80) % 360;
                ctx.fillStyle = `hsl(${(hue + 360) % 360},60%,15%)`;
                ctx.save(); ctx.beginPath();
                ctx.moveTo(i * CELL, 0); ctx.lineTo((i + 1) * CELL, 0); ctx.lineTo((i + 1 - ROWS) * CELL, this.H); ctx.lineTo((i - ROWS) * CELL, this.H);
                ctx.closePath(); ctx.fill(); ctx.restore();
            }
        }
        // play-field border
        ctx.strokeStyle = this.wrap ? 'rgba(120,255,180,0.5)' : 'rgba(255,120,140,0.6)';
        ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, PLAY_W - 3, this.H - 3);
    }

    drawBoard(ctx) {
        // grid lines (Action1 / Space toggles this)
        if (this.showGrid) {
            ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1;
            ctx.beginPath();
            for (let c = 1; c < COLS; c++) { ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, this.H); }
            for (let r = 1; r < ROWS; r++) { ctx.moveTo(0, r * CELL); ctx.lineTo(PLAY_W, r * CELL); }
            ctx.stroke();
        }
        // beacons
        for (const b of this.beacons) {
            const cx = b.x * CELL + CELL / 2, cy = b.y * CELL + CELL / 2;
            ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(cx, cy, CELL / 2 - 2 + Math.sin(this._t * 6) * 2, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(168,85,247,0.5)'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
        }
        // food
        const foodCol = this.FOOD_COLORS[this.foodColorIdx];
        ctx.fillStyle = foodCol; ctx.shadowColor = foodCol; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(this.food.x * CELL + CELL / 2, this.food.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // gems (clickable) - pulse + highlight on hover
        for (const gm of this.gems) {
            const hov = this.input.isElementHovered('gem_' + gm.id, 'game');
            const cx = gm.x * CELL + CELL / 2, cy = gm.y * CELL + CELL / 2;
            const r = (CELL / 2 - 1) * (hov ? 1.0 : 0.82) + Math.sin(this._t * 8 + gm.id) * 1.5;
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
            ctx.fillStyle = hov ? '#ffff66' : '#ffd166'; ctx.shadowColor = '#ffd166'; ctx.shadowBlur = hov ? 18 : 8;
            ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore(); ctx.shadowBlur = 0;
        }
        // snake
        const pal = this.PALETTES[this.colorIdx];
        this.snake.forEach((s, i) => {
            ctx.fillStyle = i === 0 ? pal.head : pal.body;
            ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
        });
    }

    drawLegend(g) {
        g.fillStyle = 'rgba(10,12,28,0.92)'; g.fillRect(PANEL_X, 0, this.W - PANEL_X, this.H);
        g.strokeStyle = 'rgba(120,180,255,0.25)'; g.lineWidth = 1; g.strokeRect(PANEL_X + 0.5, 0.5, this.W - PANEL_X - 1, this.H - 1);
        g.textAlign = 'left';
        g.fillStyle = '#cfe3ff'; g.font = 'bold 18px monospace'; g.fillText('INPUTS', PANEL_X + 12, 28);
        g.font = '13px monospace'; g.fillStyle = '#8fb3e0';
        g.fillText(`Score ${this.score}`, PANEL_X + 12, 56);
        g.fillStyle = this.flash['speed'] ? '#fff36b' : '#8fb3e0';
        g.fillText(`Speed ${this.speedLevel}  (keys 1-9)`, PANEL_X + 12, 76);
        g.fillStyle = '#6f8fb8'; g.font = '11px monospace';
        g.fillText('WASD / Arrows steer', PANEL_X + 12, 100);
        g.fillText('Walls: ' + (this.wrap ? 'WRAP' : 'SOLID'), PANEL_X + 12, 116);

        // Action rows (clickable elements). Glow when used. Everything is centered on the row's
        // mid-line (midY) with textBaseline 'middle', so keycap + label sit dead-centre at any size.
        this.actions.forEach((a, i) => {
            const x = LEG_X, y = LEG_TOP + i * LEG_PITCH, w = LEG_W, h = LEG_H, midY = y + h / 2;
            const hov = this.input.isElementHovered('act_' + a.id, 'gui');
            const lit = this.flash[a.id] != null || (a.hold && (this.input.isKeyPressed(a.key) || this.input.isElementPressed('act_' + a.id, 'gui')));
            g.fillStyle = lit ? 'rgba(120,220,255,0.30)' : hov ? 'rgba(120,180,255,0.16)' : 'rgba(255,255,255,0.05)';
            g.fillRect(x, y, w, h);
            g.strokeStyle = lit ? '#7fe3ff' : 'rgba(255,255,255,0.12)'; g.lineWidth = lit ? 2 : 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
            // keycap - centered vertically in the row
            const capX = x + 8, capY = midY - CAP_H / 2;
            g.fillStyle = '#1a2440'; g.fillRect(capX, capY, CAP_W, CAP_H);
            g.strokeStyle = '#3a5a8a'; g.lineWidth = 1; g.strokeRect(capX + 0.5, capY + 0.5, CAP_W - 1, CAP_H - 1);
            g.textBaseline = 'middle';
            g.fillStyle = '#cfe3ff'; g.font = 'bold 12px monospace'; g.textAlign = 'center'; g.fillText(a.tag, capX + CAP_W / 2, midY + 1);
            g.textAlign = 'left'; g.fillStyle = '#dbe8ff'; g.font = '13px monospace'; g.fillText(a.name, capX + CAP_W + 10, midY + 1);
            g.textBaseline = 'alphabetic';
        });
        // mouse hints (anchored below the last row)
        const my = LEG_TOP + this.actions.length * LEG_PITCH + 20;
        g.fillStyle = '#cfe3ff'; g.font = 'bold 12px monospace'; g.fillText('MOUSE', PANEL_X + 12, my);
        g.fillStyle = '#9fc0e8'; g.font = '11px monospace';
        g.fillText('L-click gem: collect +50', PANEL_X + 12, my + 18);
        g.fillText('R-click gem: smash +25', PANEL_X + 12, my + 33);
        g.fillText('M-click cell: beacon', PANEL_X + 12, my + 48);
        g.fillStyle = '#7fe3ff'; g.fillText('Wheel: BG speed - / +', PANEL_X + 12, my + 63);
        g.fillStyle = '#6f8fb8'; g.fillText('F9/Tab: inspector', PANEL_X + 12, my + 81);
    }

    drawMenu(g) {
        const over = this.state === 'over';
        g.textAlign = 'center';
        if (over) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, PLAY_W, this.H); }
        g.fillStyle = over ? '#ff5470' : '#eaf6ff'; g.font = 'bold 64px monospace';
        g.fillText(over ? 'GAME OVER' : 'SLITHER', PLAY_W / 2, over ? 200 : 220);
        g.font = '16px monospace'; g.fillStyle = '#9fc0e8';
        g.fillText(over ? `Score ${this.score}   Best ${this.best}` : 'ActionInputHandler showcase', PLAY_W / 2, over ? 250 : 268);

        // PLAY / RETRY button (a 'gui' input element)
        const hovPlay = this.input.isElementHovered('menu_play', 'gui');
        const pressPlay = this.input.isElementPressed('menu_play', 'gui');
        g.fillStyle = pressPlay ? '#1f8fff' : hovPlay ? '#3aa6ff' : '#2b7fd6';
        g.fillRect(150, 330, 300, 58);
        g.strokeStyle = '#bfe2ff'; g.lineWidth = 2; g.strokeRect(150, 330, 300, 58);
        g.fillStyle = '#fff'; g.font = 'bold 26px monospace'; g.fillText(over ? 'RETRY' : 'PLAY', PLAY_W / 2, 369);

        // difficulty chips (3 'gui' elements)
        if (!over) {
            g.font = '13px monospace';
            for (let i = 0; i < 3; i++) {
                const x = 150 + i * 105, sel = this.diff === i, hov = this.input.isElementHovered('menu_diff' + i, 'gui');
                g.fillStyle = sel ? '#39ff14' : hov ? 'rgba(120,200,255,0.3)' : 'rgba(255,255,255,0.08)';
                g.fillRect(x, 420, 95, 40);
                g.strokeStyle = sel ? '#aaffaa' : 'rgba(255,255,255,0.2)'; g.lineWidth = sel ? 2 : 1; g.strokeRect(x, 420, 95, 40);
                g.fillStyle = sel ? '#06210a' : '#dbe8ff'; g.fillText(this.DIFFS[i].name, x + 47, 445);
            }
            g.fillStyle = '#6f8fb8'; g.font = '12px monospace'; g.fillText('click PLAY or press Space', PLAY_W / 2, 500);
        }
    }

    drawInspector(d) {
        const p = this.input.getPointerPosition();
        const cx = (p.x / CELL) | 0, cy = (p.y / CELL) | 0;
        const lines = [
            'INPUT INSPECTOR',
            `pointer: ${p.x | 0}, ${p.y | 0}`,
            `cell:    ${cx}, ${cy}`,
            `mouse L:${this.input.isLeftMouseButtonDown() ? 1 : 0} M:${this.input.isMiddleMouseButtonDown() ? 1 : 0} R:${this.input.isRightMouseButtonDown() ? 1 : 0}`,
            `gems: ${this.gems.length}   beacons: ${this.beacons.length}`,
            `state: ${this.state}   speed: ${this.speedLevel}`,
        ];
        d.fillStyle = 'rgba(0,0,0,0.75)'; d.fillRect(8, 8, 230, 8 + lines.length * 18 + 6);
        d.strokeStyle = '#39ff14'; d.lineWidth = 1; d.strokeRect(8.5, 8.5, 229, 8 + lines.length * 18 + 5);
        d.textAlign = 'left'; d.font = '12px monospace';
        lines.forEach((ln, i) => { d.fillStyle = i === 0 ? '#39ff14' : '#cfeede'; d.fillText(ln, 18, 28 + i * 18); });
    }
}
