/******************************************************************************
 * DEMO — ActionUI Component Gallery
 * Uses tabs to switch between content panels within 800x600
 * Parent visibility cascades to children automatically
 ******************************************************************************/

const DEMO = { WIDTH: 800, HEIGHT: 600, BG: '#0d0d1a', PANEL: { x: 12, y: 56, w: 776, h: 532 } };

class Game {
    static WIDTH = DEMO.WIDTH;
    static HEIGHT = DEMO.HEIGHT;

    constructor(canvases, input, audio) {
        this.input = input;
        this.audio = audio;
        this.gameCanvas = canvases.gameCanvas;
        this.gameCtx = this.gameCanvas.getContext('2d');
        this.guiCanvas = canvases.guiCanvas;
        this.guiCtx = canvases.guiCtx;
        this.debugCanvas = canvases.debugCanvas;
        this.debugCtx = canvases.debugCtx;
        this.lastTime = performance.now();
        this.frameCount = 0;
        this._bgTime = 0;

        const theme = new ActionUITheme({
            colorBackground: '#0d0d1a', colorSurface: '#131326', colorSurfaceRaised: '#1a1a3a',
            colorPrimary: '#7c6aff', colorPrimaryHover: '#9d8fff', colorAccent: '#00e5cc', colorSuccess: '#00c896',
        });
        this.ui = new ActionUI(canvases, input, theme);

        this._setupAudio();
        this._buildHeader();
        this._buildTabPanels();
        this._buildContextMenu();
        this._switchTab(0);
    }

    _setupAudio() {
        this.audio.createSweepSound('click', { startFreq: 600, endFreq: 900, type: 'triangle', duration: 0.07, envelope: { attack: 0.005, decay: 0.065, sustain: 0, release: 0 } });
        this.audio.createSweepSound('hover', { startFreq: 400, endFreq: 500, type: 'sine', duration: 0.05, envelope: { attack: 0.01, decay: 0.04, sustain: 0, release: 0 } });
        this.audio.createComplexSound('notify', { frequencies: [523, 659, 784], types: ['sine','sine','sine'], mix: [0.4, 0.35, 0.25], duration: 0.3, envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.18 } });
        this.audio.createFMSound('toggle', { carrierFreq: 440, modulatorFreq: 220, modulationIndex: 30, type: 'sine', duration: 0.12, envelope: { attack: 0.01, decay: 0.11, sustain: 0, release: 0 } });
        this.audio.createSweepSound('slide', { startFreq: 300, endFreq: 400, type: 'sine', duration: 0.06, envelope: { attack: 0.01, decay: 0.05, sustain: 0, release: 0 } });
    }
    _playClick() { this.audio.play('click', { volume: 0.18 }); }
    _playHover() { this.audio.play('hover', { volume: 0.06 }); }
    _playNotify() { this.audio.play('notify', { volume: 0.25 }); }
    _playToggle() { this.audio.play('toggle', { volume: 0.18 }); }
    _playSlide() { this.audio.play('slide', { volume: 0.08 }); }

    _buildHeader() {
        const t = this.ui.theme;
        this.ui.makeLabel({ text: 'ActionUI', x: 20, y: 8, width: 300, height: 40, fontSize: t.fontSizeXl, fontWeight: t.fontWeightBold, color: t.colorPrimary, shadow: true });
        this.ui.makeLabel({ text: 'Component Gallery', x: 130, y: 18, width: 240, height: 24, fontSize: t.fontSizeSm, color: t.colorTextMuted });
        this.tabBar = this.ui.makeTabBar({
            x: 380, y: 10, width: 400, height: 34,
            tabs: [{ label: 'Controls', id: 'controls' }, { label: 'Inputs', id: 'inputs' }, { label: 'Display', id: 'display' }, { label: 'Feedback', id: 'feedback' }, { label: 'Themes', id: 'themes' }, { label: 'Console', id: 'console' }],
            selected: 0, onChange: (id, tabBar) => { this._playClick(); const idx = this.tabBar.tabs.findIndex(t => t.id === id); this._switchTab(idx); }
        });
        this.ui.makeSeparator({ x: 0, y: 52, width: 800, height: 1 });
        this.ui.makeBadge({ x: 100, y: 12, count: 1, color: 'success', size: 18, tooltip: 'v1.0' });
    }

    _buildTabPanels() {
        this._tabPanels = [];
        this._buildControlsPanel();
        this._buildInputsPanel();
        this._buildDisplayPanel();
        this._buildFeedbackPanel();
        this._buildThemesPanel();
        this._buildConsolePanel();
    }

    _switchTab(index) {
        this._tabPanels.forEach((panel, i) => { panel.visible = (i === index); });
    }

    // Helper: add component to panel (auto-registers with ActionUI)
    _child(panel, comp) {
        panel.addChild(comp);
        return comp;
    }

    _buildControlsPanel() {
        const { x, y, w, h } = DEMO.PANEL;
        const t = this.ui.theme;
        const pad = 14;
        const halfW = Math.floor((w - pad * 2 - 10) / 2);
        const panel = new ActionUIPanel({ x, y, width: w, height: h, title: 'Buttons & Controls', shadow: true });
        this.ui.add(panel);
        this._tabPanels.push(panel);

        let cy = y + 46;
        this._child(panel, new ActionUILabel({ text: 'Button Variants', x: x + pad, y: cy, width: halfW, height: 18, fontSize: t.fontSizeSm, fontWeight: t.fontWeightMedium, color: t.colorTextMuted, uppercase: true }));
        cy += 22;
        [{ text: 'Primary', variant: 'primary' }, { text: 'Secondary', variant: 'secondary' }, { text: 'Ghost', variant: 'ghost' }, { text: 'Danger', variant: 'danger' }, { text: 'Success', variant: 'success' }].forEach(({ text, variant }) => {
            this._child(panel, new ActionUIButton({ x: x + pad, y: cy, width: halfW, height: 32, text, variant, tooltip: `${variant} button`, onClick: () => { this._playClick(); this.ui.notify(`Clicked: ${text}`, variant === 'danger' ? 'danger' : 'success'); } }));
            cy += 38;
        });
        this._child(panel, new ActionUIButton({ x: x + pad, y: cy, width: halfW, height: 32, text: 'Disabled', variant: 'primary', enabled: false, tooltip: 'This button is disabled' }));

        const rx = x + pad + halfW + 10;
        cy = y + 46;
        this._child(panel, new ActionUILabel({ text: 'Icon Buttons', x: rx, y: cy, width: halfW, height: 18, fontSize: t.fontSizeSm, fontWeight: t.fontWeightMedium, color: t.colorTextMuted, uppercase: true }));
        cy += 22;
        const icons = ['play','pause','refresh','trash','settings','search','menu','volume'];
        const ibSize = 34, cols = 4;
        icons.forEach((icon, i) => {
            this._child(panel, new ActionUIIconButton({ x: rx + (i % cols) * (ibSize + 6), y: cy + Math.floor(i / cols) * (ibSize + 6), width: ibSize, height: ibSize, icon, variant: 'ghost', tooltip: icon, onClick: () => { this._playClick(); this.ui.notify(`Icon: ${icon}`, 'info'); } }));
        });
        cy += 80;
        this._child(panel, new ActionUISeparator({ x: rx, y: cy, width: halfW, height: 1, label: 'Toggles' }));
        cy += 18;
        [{ label: 'Enable sounds', checked: true }, { label: 'Dark mode', checked: true }, { label: 'Notifications', checked: false }].forEach(({ label, checked }) => {
            this._child(panel, new ActionUICheckbox({ x: rx, y: cy, width: halfW, height: 24, label, checked, onChange: () => this._playToggle() }));
            cy += 28;
        });
        cy += 4;
        this._child(panel, new ActionUIToggleSwitch({ x: rx, y: cy, label: 'Auto-save', checked: true, color: 'primary', clickableLabel: true, onChange: () => this._playToggle() }));
        cy += 32;
        [{ label: 'Show hints', checked: false, color: 'accent' }, { label: 'Beta features', checked: false, color: 'warning' }].forEach(({ label, checked, color }) => {
            this._child(panel, new ActionUIToggleSwitch({ x: rx, y: cy, label, checked, color, onChange: () => this._playToggle() }));
            cy += 32;
        });
        cy += 6;
        this._child(panel, new ActionUISeparator({ x: rx, y: cy, width: halfW, height: 1, label: 'Radio' }));
        cy += 18;
        this._child(panel, new ActionUIRadioGroup({ x: rx, y: cy, width: halfW, height: 80, options: [{ label: 'Option Alpha', value: 'a' }, { label: 'Option Beta', value: 'b' }, { label: 'Option Gamma', value: 'c' }], selected: 0, onChange: () => this._playClick() }));
    }

    _buildInputsPanel() {
        const { x, y, w, h } = DEMO.PANEL;
        const t = this.ui.theme;
        const pad = 14;
        const halfW = Math.floor((w - pad * 2 - 10) / 2);
        const panel = new ActionUIPanel({ x, y, width: w, height: h, title: 'Inputs & Values', shadow: true });
        this.ui.add(panel);
        this._tabPanels.push(panel);

        let cy = y + 46;
        this._child(panel, new ActionUILabel({ text: 'Text Fields', x: x + pad, y: cy, width: halfW, height: 16, fontSize: t.fontSizeSm, fontWeight: t.fontWeightMedium, color: t.colorTextMuted, uppercase: true }));
        cy += 20;
        this._child(panel, new ActionUITextInput({ x: x + pad, y: cy, width: halfW, height: 34, placeholder: 'Enter your name…', label: 'Name', tooltip: 'Press Action1 with gamepad to open on-screen keyboard' }));
        cy += 52;
        this._child(panel, new ActionUITextInput({ x: x + pad, y: cy, width: halfW, height: 34, placeholder: 'Search…', label: 'Search', tooltip: 'Press Action1 with gamepad to open on-screen keyboard' }));
        cy += 52;
        this._child(panel, new ActionUITextInput({ x: x + pad, y: cy, width: halfW, height: 34, placeholder: '••••••••', label: 'Password', password: true, tooltip: 'Press Action1 with gamepad to open on-screen keyboard' }));
        cy += 52;

        const rx = x + pad + halfW + 10;
        cy = y + 46;
        this._child(panel, new ActionUILabel({ text: 'Sliders', x: rx, y: cy, width: halfW, height: 16, fontSize: t.fontSizeSm, fontWeight: t.fontWeightMedium, color: t.colorTextMuted, uppercase: true }));
        cy += 20;
        this.volumeSlider = this._child(panel, new ActionUISlider({ x: rx, y: cy, width: halfW, height: 34, min: 0, max: 100, value: 70, label: 'Volume', color: 'primary', onChange: (value, slider) => { this._playSlide(); this.audio.setVolume(value / 100); } }));
        cy += 42;
        this._child(panel, new ActionUISlider({ x: rx, y: cy, width: halfW, height: 34, min: 0, max: 10, value: 5, step: 1, label: 'Level', color: 'accent' }));
        cy += 42;
        this._child(panel, new ActionUISlider({ x: rx, y: cy, width: halfW, height: 34, min: 0, max: 1, value: 0.35, label: 'Opacity', color: 'success' }));

        cy = y + 310;
        this._child(panel, new ActionUISeparator({ x: x + pad, y: cy, width: w - pad * 2, height: 1, label: 'Progress' }));
        cy += 18;
        this.progressBar = this._child(panel, new ActionUIProgressBar({ x: x + pad, y: cy, width: w - pad * 2, height: 14, value: 0.65, color: 'primary', label: 'Loading', showPct: true, striped: true, animated: true }));
        cy += 28;
        this._child(panel, new ActionUIProgressBar({ x: x + pad, y: cy, width: (w - pad * 2 - 10) / 2, height: 10, value: 0.38, color: 'success', animated: true }));
        this._child(panel, new ActionUIProgressBar({ x: x + pad + (w - pad * 2 - 10) / 2 + 10, y: cy, width: (w - pad * 2 - 10) / 2, height: 10, value: 0.82, color: 'warning', animated: true }));
        cy += 24;
        this._child(panel, new ActionUIProgressBar({ x: x + pad, y: cy, width: (w - pad * 2 - 10) / 2, height: 10, value: 0.18, color: 'danger', animated: true }));

        const by = y + 380;
        this._child(panel, new ActionUISeparator({ x: rx, y: by, width: halfW, height: 1, label: 'Steppers' }));
        const sy = by + 18;
        this._child(panel, new ActionUINumberStepper({ x: rx, y: sy, width: halfW, height: 34, label: 'Players', value: 4, min: 1, max: 8 }));
    }

    _buildDisplayPanel() {
        const { x, y, w, h } = DEMO.PANEL;
        const t = this.ui.theme;
        const pad = 14;
        const halfW = Math.floor((w - pad * 2 - 10) / 2);
        const panel = new ActionUIPanel({ x, y, width: w, height: h, title: 'Display & Visuals', shadow: true });
        this.ui.add(panel);
        this._tabPanels.push(panel);

        let cy = y + 46;
        this._child(panel, new ActionUILabel({ text: 'Avatars', x: x + pad, y: cy, width: halfW, height: 16, fontSize: t.fontSizeSm, fontWeight: t.fontWeightMedium, color: t.colorTextMuted, uppercase: true }));
        cy += 20;
        [{ name: 'Alice Morgan', status: 'online' }, { name: 'Bob Chen', status: 'away' }, { name: 'Carlos Diaz', status: 'offline' }, { name: 'Dana Lee', status: 'online' }].forEach(({ name, status }, i) => {
            this._child(panel, new ActionUIAvatarDisplay({ x: x + pad + i * 52, y: cy, size: 42, name, status, tooltip: name, onClick: () => { this._playClick(); this.ui.notify(`Hello, ${name}!`, 'info'); } }));
        });
        cy += 58;
        this._child(panel, new ActionUISeparator({ x: x + pad, y: cy, width: halfW, height: 1, label: 'Color Palette' }));
        cy += 18;
        [{ color: '#7c6aff', label: 'Primary' }, { color: '#e94560', label: 'Red' }, { color: '#00e5cc', label: 'Teal' }, { color: '#f39c12', label: 'Amber' }, { color: '#00c896', label: 'Green' }].forEach(({ color, label }, i) => {
            this._child(panel, new ActionUIColorSwatch({ x: x + pad + i * 44, y: cy, size: 36, color, label, tooltip: label, onClick: () => { this._playClick(); this.ui.notify(`Color: ${color}`, 'info'); } }));
        });
        cy += 58;

        const rx = x + pad + halfW + 10;
        cy = y + 46;
        this._child(panel, new ActionUISeparator({ x: rx, y: cy, width: halfW, height: 1, label: 'Spinners' }));
        cy += 18;
        [{ color: 'primary', size: 36, label: 'Loading' }, { color: 'accent', size: 28, label: 'Sync' }, { color: 'success', size: 22, label: 'OK' }, { color: 'warning', size: 18, label: '' }].forEach(({ color, size, label }, i) => {
            this._child(panel, new ActionUISpinner({ x: rx + i * 54, y: cy, size, color, label, speed: 1.2 + i * 0.4 }));
        });
        cy += 62;
        this._child(panel, new ActionUISeparator({ x: rx, y: cy, width: halfW, height: 1, label: 'Badges' }));
        cy += 18;
        [1, 5, 12, 99, 200].forEach((count, i) => {
            this._child(panel, new ActionUIBadge({ x: rx + i * 42, y: cy, count, size: 24, color: ['danger','warning','info','success','primary'][i], tooltip: `${count} notification${count!==1?'s':''}` }));
        });
        cy += 44;

        const sy = y + 260;
        const halfPanelW = Math.floor((w - pad * 2 - 10) / 2);

        // Left scroll panel
        this._child(panel, new ActionUISeparator({ x: x + pad, y: sy, width: halfPanelW, height: 1, label: 'Scroll Panel A' }));
        const spyA = sy + 18;
        const scrollPanelA = this._child(panel, new ActionUIScrollPanel({ x: x + pad, y: spyA, width: halfPanelW, height: 200, itemHeight: 28, padding: 4 }));
        ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa'].forEach((name, i) => {
            const btn = new ActionUIButton({ x: 4, y: 4 + i * 28, width: halfPanelW - 28, height: 24, text: name, variant: i % 2 === 0 ? 'ghost' : 'secondary', fontSize: 11, onClick: () => { this._playClick(); this.ui.notify(name, 'info'); } });
            scrollPanelA.addChild(btn);
            btn._parent = panel;
        });

        // Right scroll panel
        this._child(panel, new ActionUISeparator({ x: x + pad + halfPanelW + 10, y: sy, width: halfPanelW, height: 1, label: 'Scroll Panel B' }));
        const spyB = sy + 18;
        const scrollPanelB = this._child(panel, new ActionUIScrollPanel({ x: x + pad + halfPanelW + 10, y: spyB, width: halfPanelW, height: 200, itemHeight: 28, padding: 4 }));
        ['Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon'].forEach((name, i) => {
            const btn = new ActionUIButton({ x: 4, y: 4 + i * 28, width: halfPanelW - 28, height: 24, text: name, variant: i % 2 === 0 ? 'ghost' : 'secondary', fontSize: 11, onClick: () => { this._playClick(); this.ui.notify(name, 'info'); } });
            scrollPanelB.addChild(btn);
            btn._parent = panel;
        });
    }

    _buildThemesPanel() {
        const { x, y, w, h } = DEMO.PANEL;
        const t = this.ui.theme;
        const pad = 14;
        const panel = new ActionUIPanel({ x, y, width: w, height: h, title: 'Theme Selection', shadow: true });
        this.ui.add(panel);
        this._tabPanels.push(panel);

        let cy = y + 46;
        const halfW = w - pad * 2;

        this._child(panel, new ActionUILabel({
            text: 'Select a theme to change the UI appearance',
            x: x + pad, y: cy, width: halfW, height: 16,
            fontSize: t.fontSizeSm, fontWeight: t.fontWeightMedium,
            color: t.colorTextMuted,
        }));
        cy += 24;

        this._child(panel, new ActionUIDropdown({
            x: x + pad, y: cy, width: halfW, height: 34,
            label: 'Theme',
            options: [
                { label: 'Galactic Dark', value: 'dark' },
                { label: 'Neon Synthwave', value: 'neon' },
                { label: 'Ocean Depths', value: 'ocean' },
                { label: 'Forest Mist', value: 'forest' },
                { label: 'Classic Light', value: 'light' },
            ],
            selected: 0,
            onChange: (value, dropdown) => { this._playClick(); this.ui.notify(`Theme: ${value}`, 'info'); }
        }));
        cy += 52;

        this._child(panel, new ActionUISeparator({ x: x + pad, y: cy, width: halfW, height: 1, label: 'Color Palette' }));
        cy += 18;

        [{ color: '#7c6aff', label: 'Primary' }, { color: '#e94560', label: 'Red' }, { color: '#00e5cc', label: 'Teal' }, { color: '#f39c12', label: 'Amber' }, { color: '#00c896', label: 'Green' }].forEach(({ color, label }, i) => {
            this._child(panel, new ActionUIColorSwatch({ x: x + pad + i * 44, y: cy, size: 36, color, label, tooltip: label, onClick: () => { this._playClick(); this.ui.notify(`Color: ${color}`, 'info'); } }));
        });
    }

    _buildConsolePanel() {
        const { x, y, w, h } = DEMO.PANEL;
        const t = this.ui.theme;
        const pad = 14;
        const panel = new ActionUIPanel({ x, y, width: w, height: h, title: 'Console', shadow: true });
        this.ui.add(panel);
        this._tabPanels.push(panel);

        let cy = y + 46;
        const panelW = w - pad * 2;

        // ListView for messages
        this.consoleList = this._child(panel, new ActionUIListView({
            x: x + pad, y: cy, width: panelW, height: 340,
            itemHeight: 18, padding: 8, maxItems: 50
        }));
        cy += 350;

        // Text input for console
        this.consoleInput = this._child(panel, new ActionUITextInput({
            x: x + pad, y: cy, width: panelW, height: 34,
            placeholder: 'Type a message and press Enter to submit...',
            label: 'Input',
            onSubmit: (value) => {
                if (value.trim()) {
                    this._playClick();
                    this.consoleList.addItem(`> ${value}`);
                    this.consoleInput.value = '';
                }
            }
        }));
        cy += 52;

        // Clear button
        this._child(panel, new ActionUIButton({
            x: x + pad, y: cy, width: panelW / 2 - 5, height: 32,
            text: 'Clear', variant: 'ghost',
            onClick: () => {
                this._playClick();
                this.consoleList.clear();
                this.ui.notify('Console cleared', 'info');
            }
        }));

        // Add sample message button
        this._child(panel, new ActionUIButton({
            x: x + pad + panelW / 2 + 5, y: cy, width: panelW / 2 - 5, height: 32,
            text: 'Add Sample', variant: 'ghost',
            onClick: () => {
                this._playClick();
                const messages = [
                    '[System] Ready',
                    '[Player] Hello world!',
                    '[Warning] Low memory',
                    '[Error] Connection failed',
                    '[Success] All systems online'
                ];
                const msg = messages[Math.floor(Math.random() * messages.length)];
                this.consoleList.addItem(msg);
                this.ui.notify('Message added', 'info');
            }
        }));

        // Add initial message
        this.consoleList.addItem('[System] Console initialized');
    }

    _buildFeedbackPanel() {
        const { x, y, w, h } = DEMO.PANEL;
        const t = this.ui.theme;
        const pad = 14;
        const halfW = Math.floor((w - pad * 2 - 10) / 2);
        const panel = new ActionUIPanel({ x, y, width: w, height: h, title: 'Feedback & Dialogs', shadow: true });
        this.ui.add(panel);
        this._tabPanels.push(panel);

        let cy = y + 46;
        this._child(panel, new ActionUILabel({ text: 'Notifications', x: x + pad, y: cy, width: halfW, height: 16, fontSize: t.fontSizeSm, fontWeight: t.fontWeightMedium, color: t.colorTextMuted, uppercase: true }));
        cy += 20;
        const notifTypes = ['info', 'success', 'warning', 'danger'];
        const notifW = Math.floor((halfW - 10 * 3) / 4);
        notifTypes.forEach((type, i) => {
            this._child(panel, new ActionUIButton({ x: x + pad + i * (notifW + 10), y: cy, width: notifW, height: 32, text: type.charAt(0).toUpperCase() + type.slice(1), variant: type === 'info' ? 'ghost' : type === 'success' ? 'success' : type === 'danger' ? 'danger' : 'ghost', fontSize: 11, onClick: () => { this._playNotify(); this.ui.notify(`This is a ${type} toast.`, type); } }));
        });
        cy += 48;
        this._child(panel, new ActionUILabel({ text: 'Toast notifications appear in the top-right corner and auto-dismiss after a few seconds.', x: x + pad, y: cy, width: halfW, height: 80, fontSize: t.fontSizeSm, color: t.colorTextMuted, wrap: true }));

        const rx = x + pad + halfW + 10;
        cy = y + 46;
        this._child(panel, new ActionUISeparator({ x: rx, y: cy, width: halfW, height: 1, label: 'Modal Dialog' }));
        cy += 18;
        this._child(panel, new ActionUIButton({ x: rx, y: cy, width: halfW, height: 36, text: 'Open Dialog', variant: 'primary', icon: 'info', tooltip: 'Opens a blocking modal dialog', onClick: () => {
            this._playClick();
            this.ui.openModal({ title: 'Confirm Action', message: 'Are you sure you want to proceed? This action cannot be undone.', buttons: [{ label: 'Cancel', value: 'cancel', variant: 'ghost' }, { label: 'Confirm', value: 'ok', variant: 'primary' }], onClose: (val) => { this._playClick(); this.ui.notify(val === 'ok' ? 'Confirmed!' : 'Cancelled.', val === 'ok' ? 'success' : 'warning'); } });
        }}));
        cy += 52;
        this._child(panel, new ActionUILabel({ text: 'Context Menu', x: rx, y: cy, width: halfW, height: 16, fontSize: t.fontSizeSm, fontWeight: t.fontWeightMedium, color: t.colorTextMuted, uppercase: true }));
        cy += 20;
        this._child(panel, new ActionUILabel({ text: 'Right-click anywhere on the screen to open a context menu with additional options.', x: rx, y: cy, width: halfW, height: 60, fontSize: t.fontSizeSm, color: t.colorTextMuted, wrap: true }));
        cy += 70;
        this._child(panel, new ActionUISeparator({ x: rx, y: cy, width: halfW, height: 1, label: 'Quick Actions' }));
        cy += 18;
        this._child(panel, new ActionUIButton({ x: rx, y: cy, width: halfW, height: 32, text: 'Show All Notifications', variant: 'accent', onClick: () => { this._playNotify(); ['info', 'success', 'warning', 'danger'].forEach((type, i) => { setTimeout(() => this.ui.notify(`Batch notification ${i + 1}`, type), i * 200); }); } }));
        cy += 42;
        this._child(panel, new ActionUIButton({ x: rx, y: cy, width: halfW, height: 32, text: 'Reset Demo', variant: 'ghost', onClick: () => { this._playClick(); this.ui.notify('Demo reset!', 'info'); } }));
    }

    _buildContextMenu() {
        this._ctxMenu = this.ui.makeContextMenu({
            items: [
                { label: 'New Component', icon: 'plus', value: 'new' },
                { label: 'Duplicate', icon: 'refresh', value: 'dupe' },
                { separator: true },
                { label: 'Settings', icon: 'settings', value: 'settings' },
                { label: 'Toggle Theme', icon: 'star', value: 'theme' },
                { separator: true },
                { label: 'Report Bug', icon: 'warning', value: 'bug' },
                { label: 'Delete', icon: 'trash', value: 'delete' },
            ],
            onChange: (val) => { this._playClick(); this.ui.notify(`Menu: ${val}`, 'info'); }
        });
    }

    action_update() {
        const now = performance.now();
        const dt = Math.min((now - this.lastTime) / 1000, 0.05);
        this.lastTime = now;
        this.frameCount++;
        this._bgTime += dt;
        if (this.progressBar) this.progressBar.value = (Math.sin(this._bgTime * 0.4) * 0.5 + 0.5);
        if (this.input.isRightMouseButtonJustPressed && this.input.isRightMouseButtonJustPressed()) {
            const ptr = this.input.getPointerPosition();
            this.ui.showContextMenu(this._ctxMenu, ptr.x, ptr.y);
        }
        this.ui.update(dt);
    }

    action_draw() {
        this._drawBackground();
        this.guiCtx.clearRect(0, 0, DEMO.WIDTH, DEMO.HEIGHT);
        this.ui.draw('gui');
        this.debugCtx.clearRect(0, 0, DEMO.WIDTH, DEMO.HEIGHT);
    }

    _drawBackground() {
        const ctx = this.gameCtx;
        const w = DEMO.WIDTH, h = DEMO.HEIGHT;
        ctx.fillStyle = DEMO.BG;
        ctx.fillRect(0, 0, w, h);
        ctx.save();
        ctx.strokeStyle = 'rgba(124,106,255,0.04)';
        ctx.lineWidth = 1;
        const gridSize = 40;
        const offX = (this._bgTime * 8) % gridSize;
        const offY = (this._bgTime * 4) % gridSize;
        for (let gx = -gridSize + offX; gx < w + gridSize; gx += gridSize) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
        for (let gy = -gridSize + offY; gy < h + gridSize; gy += gridSize) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
        ctx.restore();
        this._drawGlow(ctx, 80, 80, 200, 'rgba(124,106,255,0.07)');
        this._drawGlow(ctx, w-60, h-60, 180, 'rgba(0,229,204,0.05)');
        this._drawGlow(ctx, w/2, h+80, 300, 'rgba(124,106,255,0.04)');
    }

    _drawGlow(ctx, cx, cy, r, color) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, color);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
}
