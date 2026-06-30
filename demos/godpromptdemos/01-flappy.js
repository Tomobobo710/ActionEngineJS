// FLAPPY — ActionEngine 2D + hand-rolled dt physics wrapped in a FULL ActionUI front-end.
// This is the "kitchen sink" UI example: it touches almost every ActionUI widget so a model
// can see each one used in anger, in context, inside a real game:
//   Panel, Label, Button, IconButton, Slider, ToggleSwitch, Checkbox, RadioGroup, Dropdown,
//   NumberStepper, TextInput, ColorSwatch, Separator, TabBar, ListView, ScrollPanel,
//   ProgressBar, Spinner, Badge, AvatarDisplay, Window (draggable), ContextMenu (right-click),
//   Modal, Notifications, Tooltips.
// Every "screen" is just an ActionUIPanel whose .visible we flip from one state machine.
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
        this.FLAP = -480;
        this.PIPE_W = 80;
        this.READY_DUR = 1.2;

        this.settings = {
            difficulty: 'normal',
            gapTweak: 0,                  // NumberStepper, -40..+40
            control: 'tap',               // RadioGroup: tap | hold
            showHints: true,              // Checkbox
            soundOn: true,                // ToggleSwitch
            uiSounds: true,               // Checkbox
            volume: 0.5,                  // Slider
            birdColor: '#f97316',         // ColorSwatch
            pipeColor: '#14b8a6',         // ColorSwatch
            theme: 'ocean',               // Dropdown
        };
        this.DIFFS = {
            easy:   { GAP: 210, SPEED: 165, SPAWN: 1.6, GRAVITY: 1400 },
            normal: { GAP: 170, SPEED: 200, SPAWN: 1.4, GRAVITY: 1600 },
            hard:   { GAP: 135, SPEED: 255, SPAWN: 1.15, GRAVITY: 1750 },
        };
        this.MEDALS = [{ s: 20, name: 'GOLD' }, { s: 10, name: 'SILVER' }, { s: 5, name: 'BRONZE' }];

        this.state = 'menu';   // menu|options|scores|playing|getready|paused|over
        this.score = 0; this.best = 0; this.newBest = false;
        this._scroll = 0; this._readyTimer = 0; this._saveTimer = 0;
        this._wingT = 0; this._flapPulse = 0;   // wing animation state
        this._newBestPending = false;
        // Pre-generated random starfield (positions fixed once; only twinkle animates).
        this._stars = [];
        for (let i = 0; i < 60; i++) {
            this._stars.push({
                x: Math.random() * this.W,
                y: Math.random() * this.H * 0.6,
                size: Math.random() < 0.15 ? 2 : 1,
                phase: Math.random() * Math.PI * 2,
                par: 4 + Math.random() * 10,   // individual parallax speed
            });
        }

        this.stats = this.loadStats();
        this.scores = this.loadScores();
        this.best = this.scores.length ? this.scores[0].score : 0;

        this.ui = new ActionUI(canvases, input);
        this.ui.setTheme(this.settings.theme);
        this.setupAudio();
        this.buildMenu();
        this.buildOptions();
        this.buildScores();
        this.buildStatsWindow();
        this.buildHUD();
        this.buildGameOver();
        this.buildContextMenu();
        this.applyDifficulty();
        this.reset();
        this.syncUI();
    }

    // addChild returns the panel (for chaining), so use this to keep a handle on the child.
    addC(panel, comp) { panel.addChild(comp); return comp; }

    // ---------- persistence ----------
    loadScores() {
        try { const r = localStorage.getItem('flappy.scores'); if (r) return JSON.parse(r); } catch (e) {}
        return [{ score: 8, name: 'ACE' }, { score: 5, name: 'PRO' }, { score: 3, name: 'NEW' }];
    }
    saveScores() { try { localStorage.setItem('flappy.scores', JSON.stringify(this.scores)); } catch (e) {} }
    loadStats() {
        try { const r = localStorage.getItem('flappy.stats'); if (r) return JSON.parse(r); } catch (e) {}
        return { games: 0, totalPipes: 0, best: 0 };
    }
    saveStats() { try { localStorage.setItem('flappy.stats', JSON.stringify(this.stats)); } catch (e) {} }

    recordScore(s, name) {
        this.scores.push({ score: s, name: (name || 'YOU').toUpperCase().slice(0, 4) });
        this.scores.sort((a, b) => b.score - a.score);
        this.scores = this.scores.slice(0, 8);
        this.best = this.scores[0].score;
        this.saveScores();
        this.refreshScoreList();
    }

    setupAudio() {
        this.audio.createSweepSound('flap', { startFreq: 600, endFreq: 300, type: 'sine', duration: 0.1, envelope: { attack: 0.005, decay: 0.06, sustain: 0, release: 0.03 } });
        this.audio.createSweepSound('score', { startFreq: 660, endFreq: 990, type: 'triangle', duration: 0.12, envelope: { attack: 0.01, decay: 0.07, sustain: 0, release: 0.04 } });
        this.audio.createComplexSound('hit', { frequencies: [200, 120], types: ['sawtooth', 'square'], mix: [0.6, 0.4], duration: 0.4, envelope: { attack: 0.005, decay: 0.2, sustain: 0.1, release: 0.19 } });
        this.audio.createSweepSound('ui', { startFreq: 520, endFreq: 780, type: 'triangle', duration: 0.07, envelope: { attack: 0.005, decay: 0.06, sustain: 0, release: 0 } });
        this.audio.createComplexSound('fanfare', { frequencies: [523, 659, 784, 1047], types: ['sine', 'triangle', 'sine', 'sine'], mix: [0.3, 0.3, 0.2, 0.2], duration: 0.6, envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.3 } });
        this.audio.setVolume(this.settings.volume);
    }
    sfx(name, vol = 0.35) { if (this.settings.soundOn) this.audio.play(name, { volume: vol }); }
    uifx() { if (this.settings.soundOn && this.settings.uiSounds) this.audio.play('ui', { volume: 0.2 }); }

    // ---------- screen: main menu ----------
    buildMenu() {
        const t = this.ui.theme;
        const px = 250, pw = 300;
        const panel = this.ui.makePanel({ x: px, y: 150, width: pw, height: 400, title: '', shadow: true });
        this.menuPanel = panel;
        panel.addChild(new ActionUIAvatarDisplay({ x: px + pw / 2 - 24, y: 168, size: 48, name: 'Player One', status: 'online', tooltip: 'Welcome, pilot' }));
        panel.addChild(new ActionUILabel({ text: 'FLAPPY', x: px, y: 224, width: pw, height: 44, fontSize: t.fontSizeDisplay, fontWeight: t.fontWeightBold, color: 'primary', align: 'center', shadow: true }));
        panel.addChild(new ActionUILabel({ text: 'an ActionUI kitchen sink', x: px, y: 268, width: pw, height: 18, fontSize: t.fontSizeSm, color: 'muted', align: 'center' }));
        const bx = px + 50, bw = pw - 100;
        panel.addChild(new ActionUIButton({ text: 'PLAY', x: bx, y: 298, width: bw, height: 44, variant: 'primary', fontSize: 22, tooltip: 'Start a run', onClick: () => { this.uifx(); this.begin(); } }));
        panel.addChild(new ActionUIButton({ text: 'OPTIONS', x: bx, y: 348, width: bw, height: 36, variant: 'secondary', tooltip: 'Tweak the game', onClick: () => { this.uifx(); this.go('options'); } }));
        panel.addChild(new ActionUIButton({ text: 'HIGH SCORES', x: bx, y: 390, width: bw, height: 36, variant: 'ghost', tooltip: 'See the leaderboard', onClick: () => { this.uifx(); this._newBestPending = false; this.go('scores'); } }));
        this.scoreBadge = new ActionUIBadge({ x: bx + bw - 14, y: 384, count: 1, size: 22, color: 'warning', tooltip: 'New best!' });
        panel.addChild(this.scoreBadge);
        panel.addChild(new ActionUIButton({ text: 'STATS', x: bx, y: 432, width: bw, height: 30, variant: 'ghost', fontSize: 12, tooltip: 'Lifetime stats (draggable window)', onClick: () => { this.uifx(); this.openStats(); } }));
        this.hintLabel = this.addC(panel, new ActionUILabel({ text: 'Space / tap to flap   -   right-click for menu', x: px, y: 474, width: pw, height: 18, fontSize: t.fontSizeXs, color: 'muted', align: 'center' }));
    }

    // ---------- screen: options (TabBar: Gameplay / Audio / Display) ----------
    buildOptions() {
        const t = this.ui.theme;
        const px = 210, pw = 380, pad = 20;
        const panel = this.ui.makePanel({ x: px, y: 110, width: pw, height: 420, title: 'Options', shadow: true });
        this.optionsPanel = panel;
        const cx = px + pad, cw = pw - pad * 2;

        this.optTabs = ['gameplay', 'audio', 'display'];
        this.tabGameplay = []; this.tabAudio = []; this.tabDisplay = [];
        panel.addChild(new ActionUITabBar({ x: cx, y: 150, width: cw, height: 32, selected: 0,
            tabs: [{ label: 'Gameplay', id: 'gameplay' }, { label: 'Audio', id: 'audio' }, { label: 'Display', id: 'display' }],
            onChange: (id) => { this.uifx(); this.showOptTab(id); } }));

        const add = (arr, comp) => { panel.addChild(comp); arr.push(comp); return comp; };

        // -- Gameplay --
        add(this.tabGameplay, new ActionUIDropdown({ x: cx, y: 200, width: cw, height: 34, label: 'Difficulty', selected: 1,
            options: [{ label: 'Easy', value: 'easy' }, { label: 'Normal', value: 'normal' }, { label: 'Hard', value: 'hard' }],
            onChange: (v) => { this.uifx(); this.settings.difficulty = v; this.applyDifficulty(); } }));
        add(this.tabGameplay, new ActionUINumberStepper({ x: cx, y: 258, width: cw, height: 34, label: 'Pipe gap tweak', value: 0, min: -40, max: 40, step: 10,
            onChange: (v) => { this.settings.gapTweak = v; this.applyDifficulty(); } }));
        add(this.tabGameplay, new ActionUISeparator({ x: cx, y: 308, width: cw, height: 1, label: 'Controls' }));
        add(this.tabGameplay, new ActionUIRadioGroup({ x: cx, y: 322, width: cw, height: 56, selected: 0, direction: 'horizontal',
            options: [{ label: 'Tap to flap', value: 'tap' }, { label: 'Hold to fly', value: 'hold' }],
            onChange: (v) => { this.uifx(); this.settings.control = v; } }));
        add(this.tabGameplay, new ActionUICheckbox({ x: cx, y: 384, width: cw, height: 24, label: 'Show hints', checked: true,
            onChange: (c) => { this.uifx(); this.settings.showHints = c; this.hintLabel.visible = c; } }));

        // -- Audio --
        add(this.tabAudio, new ActionUISlider({ x: cx, y: 200, width: cw, height: 34, min: 0, max: 100, value: 50, label: 'Volume', color: 'primary',
            onChange: (v) => { this.settings.volume = v / 100; this.audio.setVolume(this.settings.volume); } }));
        add(this.tabAudio, new ActionUIToggleSwitch({ x: cx, y: 254, label: 'Sound effects', checked: true, color: 'success', clickableLabel: true,
            onChange: (c) => { this.settings.soundOn = c; this.uifx(); } }));
        add(this.tabAudio, new ActionUICheckbox({ x: cx, y: 298, width: cw, height: 24, label: 'UI click sounds', checked: true,
            onChange: (c) => { this.settings.uiSounds = c; this.uifx(); } }));
        add(this.tabAudio, new ActionUILabel({ text: 'Sounds are synthesized at runtime by ActionAudioManager.', x: cx, y: 336, width: cw, height: 40, fontSize: t.fontSizeXs, color: 'muted', wrap: true }));

        // -- Display --
        add(this.tabDisplay, new ActionUIDropdown({ x: cx, y: 200, width: cw, height: 34, label: 'UI Theme', selected: 2,
            options: [{ label: 'Galactic Dark', value: 'dark' }, { label: 'Neon Synthwave', value: 'neon' }, { label: 'Ocean Depths', value: 'ocean' }, { label: 'Forest Mist', value: 'forest' }, { label: 'Classic Light', value: 'light' }],
            onChange: (v) => { this.uifx(); this.settings.theme = v; this.ui.setTheme(v); } }));
        add(this.tabDisplay, new ActionUISeparator({ x: cx, y: 256, width: cw, height: 1, label: 'Bird Color' }));
        ['#f97316', '#ef4444', '#22d3ee', '#a3e635', '#e879f9', '#fbbf24'].forEach((col, i) => {
            add(this.tabDisplay, new ActionUIColorSwatch({ x: cx, y: 274, size: 40, color: col, tooltip: col,
                onClick: () => { this.uifx(); this.settings.birdColor = col; this.ui.notify('Bird color set', 'success'); } })).x = cx + i * 56;
        });
        add(this.tabDisplay, new ActionUISeparator({ x: cx, y: 330, width: cw, height: 1, label: 'Pipe Color' }));
        ['#14b8a6', '#22c55e', '#0ea5e9', '#f43f5e', '#a855f7', '#eab308'].forEach((col, i) => {
            add(this.tabDisplay, new ActionUIColorSwatch({ x: cx, y: 348, size: 40, color: col, tooltip: col,
                onClick: () => { this.uifx(); this.settings.pipeColor = col; this.ui.notify('Pipe color set', 'success'); } })).x = cx + i * 56;
        });

        panel.addChild(new ActionUIButton({ text: 'BACK', x: cx, y: 470, width: cw, height: 36, variant: 'ghost', onClick: () => { this.uifx(); this.go('menu'); } }));
        this.showOptTab('gameplay');
    }
    showOptTab(id) {
        this.tabGameplay.forEach(c => c.visible = id === 'gameplay');
        this.tabAudio.forEach(c => c.visible = id === 'audio');
        this.tabDisplay.forEach(c => c.visible = id === 'display');
    }

    // ---------- screen: high scores + achievements (second TabBar) ----------
    buildScores() {
        const t = this.ui.theme;
        const px = 240, pw = 320, pad = 20;
        const panel = this.ui.makePanel({ x: px, y: 110, width: pw, height: 420, title: 'Leaderboard', shadow: true });
        this.scoresPanel = panel;
        const cx = px + pad, cw = pw - pad * 2;

        panel.addChild(new ActionUITabBar({ x: cx, y: 150, width: cw, height: 30, selected: 0,
            tabs: [{ label: 'Scores', id: 'scores' }, { label: 'Achievements', id: 'ach' }],
            onChange: (id) => { this.uifx(); this.showScoresTab(id); } }));

        this.scoreList = this.addC(panel, new ActionUIListView({ x: cx, y: 192, width: cw, height: 210, itemHeight: 26, padding: 8, maxItems: 8 }));

        this.achPanel = this.addC(panel, new ActionUIScrollPanel({ x: cx, y: 192, width: cw, height: 210, itemHeight: 30, padding: 4 }));
        this.achievements = [
            { name: 'First Flight', test: () => this.stats.best >= 1 },
            { name: 'Bronze Pilot', test: () => this.stats.best >= 5 },
            { name: 'Silver Ace', test: () => this.stats.best >= 10 },
            { name: 'Gold Legend', test: () => this.stats.best >= 20 },
            { name: 'Persistent (5 games)', test: () => this.stats.games >= 5 },
            { name: 'Centurion (100 pipes)', test: () => this.stats.totalPipes >= 100 },
        ];
        this.achievements.forEach((a, i) => {
            const done = a.test();
            const btn = new ActionUIButton({ x: 4, y: 4 + i * 32, width: cw - 30, height: 28, text: (done ? '[x] ' : '[ ] ') + a.name, variant: done ? 'success' : 'ghost', fontSize: 12, enabled: false });
            this.achPanel.addChild(btn); btn._parent = panel;
        });

        this.clearBtn = this.addC(panel, new ActionUIButton({ text: 'Clear Scores', x: cx, y: 414, width: cw, height: 30, variant: 'danger',
            onClick: () => { this.uifx(); this.ui.openModal({ title: 'Clear Scores?', message: 'This permanently erases your high score table.',
                buttons: [{ label: 'Cancel', value: 'no', variant: 'ghost' }, { label: 'Clear', value: 'yes', variant: 'danger' }],
                onClose: (v) => { if (v === 'yes') { this.scores = []; this.best = 0; this.saveScores(); this.refreshScoreList(); this.ui.notify('Scores cleared', 'info'); } } }); } }));
        panel.addChild(new ActionUIButton({ text: 'BACK', x: cx, y: 450, width: cw, height: 36, variant: 'ghost', onClick: () => { this.uifx(); this.go('menu'); } }));
        this.refreshScoreList();
        this.showScoresTab('scores');
    }
    showScoresTab(id) {
        this.scoreList.visible = id === 'scores';
        this.clearBtn.visible = id === 'scores';
        this.achPanel.visible = id === 'ach';
    }
    refreshScoreList() {
        if (!this.scoreList) return;
        this.scoreList.clear();
        if (!this.scores.length) { this.scoreList.addItem('  -- no scores yet --'); return; }
        this.scores.forEach((s, i) => {
            this.scoreList.addItem(`${String(i + 1).padStart(2, ' ')}.  ${(s.name || 'YOU').padEnd(4, ' ')}   ${String(s.score).padStart(4, ' ')}`);
        });
    }

    // ---------- draggable stats window ----------
    buildStatsWindow() {
        const t = this.ui.theme;
        const win = new ActionUIWindow({ x: 470, y: 130, width: 280, height: 210, title: 'Lifetime Stats', resizable: true, visible: false });
        this.statsWin = win;
        this.statGames = new ActionUILabel({ text: '', x: 0, y: 4, width: 250, height: 22, fontSize: t.fontSizeMd, color: 'text' });
        this.statBest = new ActionUILabel({ text: '', x: 0, y: 32, width: 250, height: 22, fontSize: t.fontSizeMd, color: 'text' });
        this.statPipes = new ActionUILabel({ text: '', x: 0, y: 60, width: 250, height: 22, fontSize: t.fontSizeMd, color: 'text' });
        this.statAvg = new ActionUILabel({ text: '', x: 0, y: 88, width: 250, height: 22, fontSize: t.fontSizeMd, color: 'text' });
        win.addChild(this.statGames); win.addChild(this.statBest); win.addChild(this.statPipes); win.addChild(this.statAvg);
        win.addChild(new ActionUILabel({ text: 'Drag me by the title bar. Resize from the corner.', x: 0, y: 120, width: 250, height: 40, fontSize: t.fontSizeXs, color: 'muted', wrap: true }));
        win.onClose = () => { this.statsWin.visible = false; };
        this.ui.add(win);
    }
    openStats() {
        const s = this.stats;
        this.statGames.text = `Games played:  ${s.games}`;
        this.statBest.text = `Best score:    ${s.best}`;
        this.statPipes.text = `Pipes cleared: ${s.totalPipes}`;
        this.statAvg.text = `Avg / game:    ${s.games ? (s.totalPipes / s.games).toFixed(1) : '0.0'}`;
        this.statsWin.visible = true;
    }

    // ---------- in-game HUD + get-ready ----------
    buildHUD() {
        const t = this.ui.theme;
        this.hudScore = this.ui.makeLabel({ text: '0', x: 0, y: 24, width: this.W, height: 48, fontSize: 44, fontWeight: t.fontWeightBold, color: 'text', align: 'center', shadow: true });
        this.hudBest = this.ui.makeLabel({ text: '', x: 16, y: 16, width: 200, height: 20, fontSize: t.fontSizeSm, color: 'muted', align: 'left' });
        this.pauseBtn = this.ui.makeIconButton({ x: this.W - 50, y: 14, width: 34, height: 34, icon: 'pause', variant: 'ghost', tooltip: 'Pause (P)', onClick: () => { this.uifx(); this.pause(); } });
        this.readyBar = this.ui.makeProgressBar({ x: 250, y: 300, width: 300, height: 16, value: 0, color: 'accent', label: 'Get Ready', showPct: false, striped: true, animated: true });
    }

    // ---------- game over ----------
    buildGameOver() {
        const t = this.ui.theme;
        const px = 250, pw = 300;
        const panel = this.ui.makePanel({ x: px, y: 130, width: pw, height: 372, title: '', shadow: true });
        this.overPanel = panel;
        panel.addChild(new ActionUILabel({ text: 'GAME OVER', x: px, y: 148, width: pw, height: 38, fontSize: t.fontSizeXxl, fontWeight: t.fontWeightBold, color: 'danger', align: 'center', shadow: true }));
        this.overScore = this.addC(panel, new ActionUILabel({ text: '', x: px, y: 192, width: pw, height: 28, fontSize: t.fontSizeXl, color: 'text', align: 'center' }));
        this.overBest = this.addC(panel, new ActionUILabel({ text: '', x: px, y: 222, width: pw, height: 20, fontSize: t.fontSizeSm, color: 'muted', align: 'center' }));
        this.medalBar = this.addC(panel, new ActionUIProgressBar({ x: px + 40, y: 250, width: pw - 80, height: 12, value: 0, color: 'warning', label: '', showPct: false, animated: true }));
        this.newBestBadge = this.addC(panel, new ActionUILabel({ text: '* NEW BEST *', x: px, y: 280, width: pw, height: 20, fontSize: t.fontSizeMd, fontWeight: t.fontWeightBold, color: 'warning', align: 'center', visible: false }));
        this.saveSpinner = this.addC(panel, new ActionUISpinner({ x: px + pw / 2 - 14, y: 300, size: 28, color: 'accent', label: 'Saving', visible: false }));
        this.nameInput = this.addC(panel, new ActionUITextInput({ x: px + 40, y: 304, width: 130, height: 32, placeholder: 'INIT', label: '', maxLength: 4, value: 'YOU', visible: false }));
        this.saveBtn = this.addC(panel, new ActionUIButton({ text: 'SAVE', x: px + 180, y: 304, width: 80, height: 32, variant: 'primary', visible: false, onClick: () => this.commitName() }));
        const bx = px + 40, bw = pw - 80;
        this.retryBtn = this.addC(panel, new ActionUIButton({ text: 'RETRY', x: bx, y: 348, width: bw, height: 42, variant: 'success', fontSize: 20, tooltip: 'Go again', onClick: () => { this.uifx(); this.begin(); } }));
        panel.addChild(new ActionUIButton({ text: 'MENU', x: bx, y: 396, width: bw, height: 32, variant: 'ghost', onClick: () => { this.uifx(); this.go('menu'); } }));
    }
    commitName() {
        this.uifx();
        this.recordScore(this._lastScore, this.nameInput.value);
        this.nameInput.visible = false; this.saveBtn.visible = false;
        this.refreshAchievements();
        this.ui.notify('Score saved!', 'success');
        this.overBest.text = `Best  ${this.best}`;
    }

    // ---------- right-click context menu ----------
    buildContextMenu() {
        this.ctxMenu = this.ui.makeContextMenu({
            items: [
                { label: 'Play / Restart', icon: 'play', value: 'play' },
                { label: 'Toggle Sound', icon: 'volume', value: 'sound' },
                { separator: true },
                { label: 'Options', icon: 'settings', value: 'options' },
                { label: 'High Scores', icon: 'star', value: 'scores' },
                { label: 'Main Menu', icon: 'menu', value: 'menu' },
            ],
            onChange: (v) => {
                this.uifx();
                if (v === 'play') this.begin();
                else if (v === 'sound') { this.settings.soundOn = !this.settings.soundOn; this.ui.notify('Sound ' + (this.settings.soundOn ? 'on' : 'off'), 'info'); }
                else if (v === 'options') this.go('options');
                else if (v === 'scores') this.go('scores');
                else if (v === 'menu') this.go('menu');
            }
        });
    }

    refreshAchievements() {
        if (!this.achPanel) return;
        this.achPanel.children.forEach((btn, i) => {
            const a = this.achievements[i]; if (!a) return;
            const done = a.test();
            btn.text = (done ? '[x] ' : '[ ] ') + a.name;
            btn.variant = done ? 'success' : 'ghost';
        });
    }

    // ---------- state plumbing ----------
    go(state) { this.state = state; this.syncUI(); }
    syncUI() {
        this.menuPanel.visible = this.state === 'menu';
        this.optionsPanel.visible = this.state === 'options';
        this.scoresPanel.visible = this.state === 'scores';
        this.overPanel.visible = this.state === 'over';
        const hud = this.state === 'playing' || this.state === 'paused' || this.state === 'getready';
        this.hudScore.visible = hud;
        this.hudBest.visible = hud;
        this.pauseBtn.visible = this.state === 'playing' || this.state === 'getready';
        this.readyBar.visible = this.state === 'getready';
        this.scoreBadge.visible = this.state === 'menu' && this._newBestPending;
        if (this.hintLabel) this.hintLabel.visible = this.state === 'menu' && this.settings.showHints;
    }
    applyDifficulty() {
        const d = this.DIFFS[this.settings.difficulty];
        this.GAP = Math.max(110, d.GAP + this.settings.gapTweak);
        this.PIPE_SPEED = d.SPEED; this.SPAWN = d.SPAWN; this.GRAVITY = d.GRAVITY;
    }

    reset() { this.bird = { x: 220, y: this.H / 2, vy: 0, r: 16 }; this.pipes = []; this._spawnTimer = 0; }
    begin() {
        this.applyDifficulty();
        this.score = 0; this.newBest = false;
        this.reset();
        this.hudBest.text = `Best ${this.best}`;
        this._readyTimer = this.READY_DUR; this.readyBar.value = 0; this.readyBar._displayV = 0;
        this.go('getready');
    }
    flap() { this.bird.vy = this.FLAP; this._flapPulse = 1; this.sfx('flap', 0.3); }
    pause() { if (this.state === 'playing' || this.state === 'getready') this.go('paused'); }
    resume() { if (this.state === 'paused') this.go(this._readyTimer > 0 ? 'getready' : 'playing'); }

    medalFor(s) { for (const m of this.MEDALS) if (s >= m.s) return m; return null; }

    die() {
        this.state = 'over';
        this._lastScore = this.score;
        this.stats.games++; this.stats.totalPipes += this.score;
        if (this.score > this.stats.best) this.stats.best = this.score;
        this.saveStats();

        const wasBest = this.scores.length ? this.score > this.scores[0].score : this.score > 0;
        this.newBest = wasBest && this.score > 0;
        this._newBestPending = this.newBest;

        // medal progress bar (toward next medal up from current score)
        const m = this.medalFor(this.score);
        let nextTarget = 5, label = 'Next: BRONZE';
        if (this.score >= 20) { nextTarget = 20; label = 'GOLD!'; }
        else if (this.score >= 10) { nextTarget = 20; label = 'Next: GOLD'; }
        else if (this.score >= 5) { nextTarget = 10; label = 'Next: SILVER'; }
        this.medalBar._displayV = 0;   // start empty so it fills up cleanly each game-over
        this.medalBar.value = Math.min(1, this.score / nextTarget);
        this.medalBar.label = m ? `${m.name}  (${label})` : label;

        this.overScore.text = `Score  ${this.score}`;
        this.overBest.text = `Best  ${this.best}`;

        // New best -> name entry; otherwise just record immediately with a brief "saving" spinner.
        this.newBestBadge.visible = this.newBest;
        this.nameInput.visible = this.newBest;
        this.saveBtn.visible = this.newBest;
        if (this.newBest) {
            this.sfx('fanfare', 0.4);
        } else {
            this.recordScore(this.score, 'YOU');
            this.refreshAchievements();
            this.saveSpinner.visible = true; this._saveTimer = 0.6;
        }
        this.sfx('hit', 0.5);
        this.syncUI();
    }

    action_update(dt) {
        dt = Math.min(dt || 0, 0.05);
        this.ui.update(dt);
        this._scroll += dt;
        // Wing flap animation: a fast base beat, sped up briefly after each flap.
        this._wingT += dt * (10 + this._flapPulse * 28);
        this._flapPulse = Math.max(0, this._flapPulse - dt * 4);

        // Right-click context menu, available everywhere.
        if (this.input.isRightMouseButtonJustPressed && this.input.isRightMouseButtonJustPressed()) {
            const p = this.input.getPointerPosition();
            this.ui.showContextMenu(this.ctxMenu, p.x, p.y);
        }

        // Pause toggle on the P key (a RAW key - 'KeyP' isn't in the default action map).
        if (this.input.isRawKeyJustPressed('KeyP')) {
            if (this.state === 'playing' || this.state === 'getready') return this.pause();
            if (this.state === 'paused') return this.resume();
        }

        // "Saving" spinner countdown on the game-over screen.
        if (this.saveSpinner.visible && this._saveTimer > 0) {
            this._saveTimer -= dt;
            if (this._saveTimer <= 0) this.saveSpinner.visible = false;
        }

        if (this.state === 'getready') {
            this._readyTimer -= dt;
            this.readyBar.value = 1 - Math.max(0, this._readyTimer) / this.READY_DUR;
            this.bird.y = this.H / 2 + Math.sin(this._wingT * 0.6) * 10;   // gentle hover bob
            this._flapPulse = Math.max(this._flapPulse, 0.4);              // keep it flapping
            if (this._readyTimer <= 0) { this.state = 'playing'; this.syncUI(); }
            return;
        }
        if (this.state !== 'playing') return;

        const held = this.input.isKeyPressed('Action1') || this.input.isPointerDown();
        const tapped = this.input.isKeyJustPressed('Action1') || this.input.isPointerJustDown();
        if (this.settings.control === 'hold') {
            if (held) { this.bird.vy -= 2600 * dt; this.bird.vy = Math.max(this.bird.vy, -380); this._flapPulse = Math.max(this._flapPulse, 0.7); }
        } else if (tapped) {
            this.flap();
        }

        this.bird.vy += this.GRAVITY * dt;
        this.bird.y += this.bird.vy * dt;

        this._spawnTimer -= dt;
        if (this._spawnTimer <= 0) {
            this._spawnTimer = this.SPAWN;
            const margin = 80;
            const gapY = margin + Math.random() * (this.H - this.GAP - margin * 2);
            this.pipes.push({ x: this.W + this.PIPE_W, gapY, passed: false });
        }

        for (const p of this.pipes) {
            p.x -= this.PIPE_SPEED * dt;
            if (!p.passed && p.x + this.PIPE_W < this.bird.x) { p.passed = true; this.score++; this.sfx('score', 0.35); }
        }
        this.pipes = this.pipes.filter(p => p.x + this.PIPE_W > -10);

        if (this.bird.y + this.bird.r > this.H || this.bird.y - this.bird.r < 0) return this.die();
        for (const p of this.pipes) {
            if (this.bird.x + this.bird.r > p.x && this.bird.x - this.bird.r < p.x + this.PIPE_W) {
                if (this.bird.y - this.bird.r < p.gapY || this.bird.y + this.bird.r > p.gapY + this.GAP) return this.die();
            }
        }
        this.hudScore.text = `${this.score}`;
    }

    // Lighten/darken a #rrggbb by amt (-255..255), returns an rgb() string.
    shade(hex, amt) {
        let h = (hex || '#f97316').replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const cl = v => Math.max(0, Math.min(255, v + amt)) | 0;
        return `rgb(${cl(parseInt(h.substr(0, 2), 16))},${cl(parseInt(h.substr(2, 2), 16))},${cl(parseInt(h.substr(4, 2), 16))})`;
    }

    // One feathered wing: an ellipse with a couple of feather creases, rotated about a shoulder pivot.
    drawWing(ctx, color, ang, yoff) {
        const r = this.bird.r;
        ctx.save();
        ctx.translate(-r * 0.15, yoff);
        ctx.rotate(ang);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(-r * 0.55, 0, r * 0.9, r * 0.46, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(-r * 0.25, i * 3);
            ctx.lineTo(-r * 1.3, i * 4);
            ctx.stroke();
        }
        ctx.restore();
    }

    // A layered, animated bird drawn entirely from canvas primitives (no sprites, no emoji).
    drawBird(ctx) {
        const r = this.bird.r;
        const base = this.settings.birdColor;
        const light = this.shade(base, 48);
        const dark = this.shade(base, -55);
        const flap = Math.sin(this._wingT);                 // -1..1 wing beat
        const wingAng = -0.2 + flap * 0.85 - this._flapPulse * 0.5;
        const beakOpen = this._flapPulse * 3.5;
        const tilt = Math.max(-0.5, Math.min(1.0, this.bird.vy / 600));

        ctx.save();
        ctx.translate(this.bird.x, this.bird.y);

        // soft drop shadow on the world, under the bird (drawn before rotation)
        ctx.save();
        ctx.globalAlpha = 0.18; ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(0, r + 10, r * 1.1, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        ctx.rotate(tilt);

        // far wing (behind body, darker for depth)
        this.drawWing(ctx, dark, wingAng - 0.3, -3);

        // tail feathers (three quills that splay with the beat)
        for (let i = -1; i <= 1; i++) {
            ctx.fillStyle = i === 0 ? base : dark;
            ctx.beginPath();
            ctx.moveTo(-r * 0.7, 0);
            ctx.lineTo(-r * 1.85, i * r * 0.5 - 2 + flap * 2);
            ctx.lineTo(-r * 1.5, i * r * 0.18);
            ctx.closePath(); ctx.fill();
        }

        // body
        ctx.fillStyle = base;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.18, r * 0.96, 0, 0, Math.PI * 2); ctx.fill();
        // back shading (top)
        ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = dark;
        ctx.beginPath(); ctx.ellipse(-2, -r * 0.35, r * 0.95, r * 0.55, -0.25, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // belly highlight (lower-front)
        ctx.fillStyle = light;
        ctx.beginPath(); ctx.ellipse(r * 0.18, r * 0.35, r * 0.72, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        // body outline
        ctx.strokeStyle = dark; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.18, r * 0.96, 0, 0, Math.PI * 2); ctx.stroke();

        // cheek blush
        ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#ff8fa3';
        ctx.beginPath(); ctx.arc(r * 0.5, r * 0.12, r * 0.22, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // near wing (front, lighter)
        this.drawWing(ctx, light, wingAng, 2);

        // eye with pupil + glint, and a small brow
        const ex = r * 0.58, ey = -r * 0.42;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, r * 0.36, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#15202b'; ctx.beginPath(); ctx.arc(ex + r * 0.1, ey + 0.5, r * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + r * 0.04, ey - r * 0.1, r * 0.07, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ex - r * 0.25, ey - r * 0.42); ctx.lineTo(ex + r * 0.32, ey - r * 0.5); ctx.stroke();

        // two-part beak that opens slightly on a flap
        const bx = r * 1.02;
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath(); ctx.moveTo(bx - 2, -r * 0.18); ctx.lineTo(bx + r * 0.75, -r * 0.05 - beakOpen * 0.4); ctx.lineTo(bx - 2, r * 0.05); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d97706';
        ctx.beginPath(); ctx.moveTo(bx - 2, r * 0.08); ctx.lineTo(bx + r * 0.62, r * 0.16 + beakOpen); ctx.lineTo(bx - 2, r * 0.28); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(bx - 2, r * 0.06); ctx.lineTo(bx + r * 0.6, r * 0.1); ctx.stroke();

        ctx.restore();
    }

    // rounded-rect path (manual, so it works regardless of ctx.roundRect support)
    roundRect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    // ---------- parallax background (drawn in every state, behind the UI) ----------
    drawBackground(ctx) {
        const W = this.W, H = this.H, s = this._scroll;
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, '#0b1a2b'); sky.addColorStop(0.5, '#163a55'); sky.addColorStop(1, '#2a6b7a');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

        // moon with soft halo + craters
        const mx = 630, my = 110;
        const halo = ctx.createRadialGradient(mx, my, 0, mx, my, 95);
        halo.addColorStop(0, 'rgba(255,247,220,0.35)'); halo.addColorStop(1, 'transparent');
        ctx.fillStyle = halo; ctx.fillRect(mx - 95, my - 95, 190, 190);
        ctx.fillStyle = '#f5efd0'; ctx.beginPath(); ctx.arc(mx, my, 34, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(120,110,80,0.18)';
        ctx.beginPath(); ctx.arc(mx - 10, my - 8, 7, 0, Math.PI * 2); ctx.arc(mx + 12, my + 7, 5, 0, Math.PI * 2); ctx.arc(mx + 3, my - 14, 4, 0, Math.PI * 2); ctx.fill();

        // twinkling stars: random positions (fixed at startup), each drifting + twinkling on its own
        for (const star of this._stars) {
            const sx = ((star.x - s * star.par) % W + W) % W;
            const tw = 0.3 + 0.7 * Math.abs(Math.sin(s * 1.5 + star.phase));
            ctx.fillStyle = `rgba(255,255,255,${(0.12 + tw * 0.5).toFixed(3)})`;
            ctx.fillRect(sx, star.y, star.size, star.size);
        }

        // two hill layers (back slow, front faster) + clouds
        this.drawHills(ctx, s * 12, H * 0.70, 70, '#16435a', 0.9, 150);
        this.drawHills(ctx, s * 26, H * 0.80, 95, '#0f2c3c', 1.0, 200);
        this.drawClouds(ctx);
    }
    drawHills(ctx, offset, baseY, amp, color, alpha, wl) {
        ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(0, this.H);
        for (let x = 0; x <= this.W; x += 8) {
            const y = baseY + Math.sin((x + offset) / wl) * amp * 0.5 + Math.sin((x + offset) / (wl * 0.37)) * amp * 0.2;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(this.W, this.H); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    drawClouds(ctx) {
        const defs = [{ x: 120, y: 90, s: 1 }, { x: 400, y: 60, s: 1.3 }, { x: 700, y: 150, s: 0.8 }, { x: 250, y: 205, s: 1.1 }];
        ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = '#cfe8f0';
        for (const c of defs) {
            let cx = (c.x - this._scroll * 18) % (this.W + 220); if (cx < -110) cx += this.W + 220;
            ctx.beginPath();
            ctx.ellipse(cx, c.y, 34 * c.s, 18 * c.s, 0, 0, Math.PI * 2);
            ctx.ellipse(cx + 28 * c.s, c.y + 4 * c.s, 26 * c.s, 15 * c.s, 0, 0, Math.PI * 2);
            ctx.ellipse(cx - 28 * c.s, c.y + 5 * c.s, 24 * c.s, 14 * c.s, 0, 0, Math.PI * 2);
            ctx.ellipse(cx, c.y - 8 * c.s, 22 * c.s, 16 * c.s, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // ---------- polished pipes ----------
    drawPipe(ctx, p) {
        const base = this.settings.pipeColor;
        const light = this.shade(base, 38), dark = this.shade(base, -55);
        const x = p.x, w = this.PIPE_W, capH = 24, over = 7;
        const by = p.gapY + this.GAP;
        this.pipeBody(ctx, x, 0, w, p.gapY - capH + 2, base, light, dark);
        this.pipeCap(ctx, x - over, p.gapY - capH, w + over * 2, capH, base, light, dark);
        this.pipeBody(ctx, x, by + capH - 2, w, this.H - by - capH + 2, base, light, dark);
        this.pipeCap(ctx, x - over, by, w + over * 2, capH, base, light, dark);
    }
    pipeBody(ctx, x, y, w, h, base, light, dark) {
        if (h <= 0) return;
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, dark); g.addColorStop(0.18, light); g.addColorStop(0.5, base); g.addColorStop(0.85, base); g.addColorStop(1, dark);
        ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + w * 0.22, y, 4, h);  // gloss stripe
        ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y, w - 2, h);
    }
    pipeCap(ctx, x, y, w, h, base, light, dark) {
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, dark); g.addColorStop(0.18, light); g.addColorStop(0.5, base); g.addColorStop(0.85, base); g.addColorStop(1, dark);
        ctx.fillStyle = g; this.roundRect(ctx, x, y, w, h, 6); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; this.roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 6); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(x + 5, y + 3, w - 10, 3);  // top gloss
    }

    action_draw(alpha) {
        const ctx = this.gameCtx;
        this.drawBackground(ctx);

        const showWorld = this.state === 'playing' || this.state === 'paused' || this.state === 'over' || this.state === 'getready';
        if (showWorld) {
            for (const p of this.pipes) this.drawPipe(ctx, p);
            this.drawBird(ctx);
        }

        this.guiCtx.clearRect(0, 0, this.W, this.H);
        if (this.state === 'paused') {
            this.guiCtx.fillStyle = 'rgba(0,0,0,0.5)'; this.guiCtx.fillRect(0, 0, this.W, this.H);
            this.guiCtx.fillStyle = '#e0f2fe'; this.guiCtx.font = 'bold 48px monospace'; this.guiCtx.textAlign = 'center';
            this.guiCtx.fillText('PAUSED', this.W / 2, 260);
            this.guiCtx.font = '18px monospace'; this.guiCtx.fillStyle = '#7dd3fc';
            this.guiCtx.fillText('P to resume', this.W / 2, 300);
        }
        if (this.state === 'over') { this.guiCtx.fillStyle = 'rgba(0,0,0,0.45)'; this.guiCtx.fillRect(0, 0, this.W, this.H); }
        this.ui.draw('gui');
        this.debugCtx.clearRect(0, 0, this.W, this.H);
    }
}
