// GO FISH - networked 2-player. The NETWORKING showcase.
//
// This game is about ActionNetManagerGUI + a clean HOST-AUTHORITY protocol, but it also
// shows the stuff the lobby does NOT do for you, so the experience still feels finished:
//
//   * A real app SHELL: an input-element main menu -> Online (-> the ActionNet lobby) with
//     Single Player greyed out. The lobby's "Back" returns you to this menu.
//   * BACKGROUND IS YOUR JOB. ActionNetManagerGUI draws the login/lobby but never clears the
//     canvas. So we clear the gui layer every frame and paint our own animated background
//     behind it (cheap ocean: gradient + light shafts + rising bubbles).
//   * ActionUI NAMEPLATES driven by ActionNet identities (gui.getUsername() + the userList).
//   * FULL CONNECTION LIFECYCLE: ready-handshake to deal, an input-element "Leave" button,
//     and host/guest-aware disconnect handling that drops both players back to the lobby.
//
// PROTOCOL (host authority - one source of truth, see hostResolveAsk):
//   guest -> host : {type:'ready'}            guest is in, deal me in
//   guest -> host : {type:'ask', rank}        guest's move
//   host  -> guest: {type:'state', ...view}   authoritative per-player view after every change
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

class Game {
    static WIDTH = 800;
    static HEIGHT = 600;

    constructor(canvases, input, audio) {
        this.input = input;
        this.audio = audio;
        this.guiCtx = canvases.guiCtx;
        this.gameCtx = canvases.gameCanvas.getContext('2d');
        this.debugCtx = canvases.debugCtx;
        this.W = Game.WIDTH; this.H = Game.HEIGHT;

        // The turnkey P2P lobby + login UI. gameId namespaces us on the public tracker.
        this.gui = new ActionNetManagerGUI(canvases, input, audio, {
            mode: 'p2p',
            p2pConfig: { gameId: 'actionengine-gofish-v1' }
        });
        // A small ActionUI just for the in-game nameplates (fed by ActionNet usernames).
        this.ui = new ActionUI(canvases, input);
        this.ui.setTheme('ocean');

        this.screen = 'menu';        // menu | net | game
        this.isHost = false;
        this.gameState = 'waiting';  // waiting | playing | over
        this.myName = ''; this.oppName = '';

        // Local PLAYER VIEW (host fills its own; guest receives its own via 'state').
        this.view = { hand: [], myBooks: 0, oppBooks: 0, oppCount: 0, myTurn: false, over: false, message: '', winner: '' };
        this._ranksInHand = []; this._prevBooks = 0;
        this.g = null;               // authoritative state, HOST ONLY

        // Cheap animated ocean background.
        this._t = 0;
        this.bubbles = [];
        for (let i = 0; i < 26; i++) this.bubbles.push({ x: Math.random() * this.W, y: Math.random() * this.H, r: 2 + Math.random() * 6, spd: 20 + Math.random() * 40, ph: Math.random() * 6.28 });

        this.setupAudio();
        this.registerElements();
        this.buildNameplates();
        this.setupNetworking();
        console.log('[GoFish] ready (menu)');
    }

    setupAudio() {
        this.audio.createSweepSound('deal', { startFreq: 500, endFreq: 700, type: 'sine', duration: 0.08, envelope: { attack: 0.005, decay: 0.05, sustain: 0, release: 0.02 } });
        this.audio.createComplexSound('book', { frequencies: [523, 659, 784], types: ['sine', 'triangle', 'sine'], mix: [0.4, 0.3, 0.3], duration: 0.4, envelope: { attack: 0.01, decay: 0.15, sustain: 0.2, release: 0.23 } });
        this.audio.createSweepSound('fish', { startFreq: 400, endFreq: 200, type: 'triangle', duration: 0.25, envelope: { attack: 0.01, decay: 0.12, sustain: 0.1, release: 0.11 } });
        this.audio.createSweepSound('click', { startFreq: 520, endFreq: 760, type: 'triangle', duration: 0.06, envelope: { attack: 0.005, decay: 0.05, sustain: 0, release: 0 } });
        this.audio.setVolume(0.5);
    }

    // ---------- raw input-element buttons (menu + in-game leave) ----------
    registerElements() {
        this.input.registerElement('btn_online', { bounds: () => ({ x: 300, y: 300, width: 200, height: 56 }) }, 'gui');
        this.input.registerElement('btn_single', { bounds: () => ({ x: 300, y: 372, width: 200, height: 56 }) }, 'gui');
        this.input.registerElement('btn_leave', { bounds: () => ({ x: 350, y: 16, width: 100, height: 30 }) }, 'gui');
    }

    // ---------- ActionUI nameplates (names come from ActionNet) ----------
    buildNameplates() {
        const t = this.ui.theme;
        const mk = (x, label) => {
            const p = this.ui.makePanel({ x, y: 14, width: 250, height: 58, shadow: true });
            const av = new ActionUIAvatarDisplay({ x: x + 12, y: 24, size: 38, name: label, status: 'online' });
            const nm = new ActionUILabel({ x: x + 60, y: 22, width: 182, height: 20, text: label, fontSize: t.fontSizeMd, fontWeight: t.fontWeightBold, color: 'text' });
            const bk = new ActionUILabel({ x: x + 60, y: 44, width: 182, height: 16, text: 'Books 0', fontSize: t.fontSizeSm, color: 'muted' });
            p.addChild(av); p.addChild(nm); p.addChild(bk);
            return { panel: p, avatar: av, name: nm, books: bk };
        };
        this.npOpp = mk(16, 'Opponent');
        this.npMe = mk(534, 'You');
    }

    setupNetworking() {
        const net = this.gui.getNetManager();

        // Host-authority message handlers.
        this.gui.registerMessageHandler('ready', () => { if (this.isHost) this.hostStartGame(); });
        this.gui.registerMessageHandler('ask', (m) => { if (this.isHost) this.hostResolveAsk('guest', m.rank); });
        this.gui.registerMessageHandler('state', (m) => { if (!this.isHost) this.applyView(m); });

        // Identities: opponent name comes from the live user list.
        net.on('userList', (users) => {
            const me = this.gui.getUsername();
            const o = (users || []).find(u => u.username !== me);
            if (o) this.oppName = o.displayName || o.username;
        });

        // Entering a room -> the game takes over. (Host gets this once alone on create, again
        // when the guest connects; the deal is gated on the guest's 'ready', so both are safe.)
        this.gui.on('joinedRoom', () => {
            this.screen = 'game';
            this.isHost = net.isCurrentUserHost ? net.isCurrentUserHost() : false;
            this.gameState = 'waiting';
            this.view.message = this.isHost ? 'Waiting for an opponent to join...' : 'Joining game...';
            if (!this.isHost) net.send({ type: 'ready' });
        });

        // FULL LIFECYCLE: back out, leave, and disconnect, all routed sensibly.
        this.gui.on('back', () => { this.screen = 'menu'; });            // lobby Back -> main menu
        this.gui.on('leftRoom', () => { if (this.screen === 'game') this.returnToLobby('You left the match.'); });
        net.on('hostLeft', () => { if (this.screen === 'game') this.returnToLobby('Host left - back to lobby.'); });
        net.on('guestLeft', () => { if (this.screen === 'game') this.returnToLobby('Opponent left - back to lobby.'); });
    }

    leaveMatch() { this.audio.play('click', { volume: 0.3 }); this.returnToLobby('You left the match.'); }
    // ONE clean teardown path for every exit: self-leave, host/guest disconnect, or quit.
    // leaveRoom() is the engine's proper teardown - it closes the data channel + peer
    // connections and resets the net manager's room state. It's idempotent (no-ops if we're
    // already out), and on a remote drop it's what actually clears our lingering room state.
    returnToLobby(msg) {
        this.screen = 'net';                       // flip the UI FIRST so leaveRoom()'s 'leftRoom' echo is ignored
        this.gui.getNetManager().leaveRoom();      // close channels/peer-connections + reset net state
        this.g = null; this._prevBooks = 0;
        this.gameState = 'waiting';
        this.view = { hand: [], myBooks: 0, oppBooks: 0, oppCount: 0, myTurn: false, over: false, message: '', winner: '' };
        this.clearCardElements();
        this.oppName = '';
        this.ui.notify(msg, 'info');
    }

    // ===================== HOST AUTHORITY (verified core) =====================
    other(seat) { return seat === 'host' ? 'guest' : 'host'; }
    seatName(seat) { return seat === 'host' ? 'Host' : 'Guest'; }

    hostStartGame() {
        if (!this.isHost || this.g) return;          // deal exactly once
        const deck = [];
        for (const r of RANKS) for (let i = 0; i < 4; i++) deck.push(r);
        for (let i = deck.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [deck[i], deck[j]] = [deck[j], deck[i]]; }
        this.g = { hands: { host: deck.splice(0, 7), guest: deck.splice(0, 7) }, books: { host: 0, guest: 0 }, deck, turn: 'host', over: false };
        this.hostHarvestBooks('host');
        this.hostHarvestBooks('guest');
        this.hostFinishTurn();
        this.hostBroadcast('Game start - Host goes first.');
    }
    hostHarvestBooks(seat) {
        const counts = {};
        for (const c of this.g.hands[seat]) counts[c] = (counts[c] || 0) + 1;
        for (const r in counts) if (counts[r] >= 4) { this.g.hands[seat] = this.g.hands[seat].filter(c => c !== r); this.g.books[seat]++; }
    }
    hostResolveAsk(asker, rank) {
        const g = this.g;
        if (!g || g.over) return;
        if (g.turn !== asker) return;
        if (!g.hands[asker].includes(rank)) return;
        const responder = this.other(asker);
        const have = g.hands[responder].filter(c => c === rank);
        let msg;
        if (have.length) {
            g.hands[responder] = g.hands[responder].filter(c => c !== rank);
            for (let i = 0; i < have.length; i++) g.hands[asker].push(rank);
            msg = `${this.seatName(asker)} asked for ${rank} and got ${have.length}. Goes again.`;
        } else {
            let drew = null;
            if (g.deck.length) { drew = g.deck.pop(); g.hands[asker].push(drew); }
            if (drew === rank) { msg = `${this.seatName(asker)} said Go Fish... and fished the ${rank}! Goes again.`; }
            else { msg = `${this.seatName(asker)} asked for ${rank}. Go Fish!`; g.turn = responder; }
        }
        this.hostHarvestBooks(asker);
        this.hostFinishTurn();
        this.hostBroadcast(msg);
    }
    hostFinishTurn() {
        const g = this.g;
        while (g.hands[g.turn].length === 0 && g.deck.length) { g.hands[g.turn].push(g.deck.pop()); this.hostHarvestBooks(g.turn); }
        if (g.books.host + g.books.guest >= 13 || g.hands[g.turn].length === 0) g.over = true;
    }
    hostBroadcast(msg) {
        const g = this.g;
        const viewFor = (seat) => ({
            type: 'state', hand: g.hands[seat].slice(), myBooks: g.books[seat],
            oppBooks: g.books[this.other(seat)], oppCount: g.hands[this.other(seat)].length,
            myTurn: !g.over && g.turn === seat, over: g.over, message: msg,
            winner: g.over ? this.winnerText(g.books[seat], g.books[this.other(seat)]) : '',
        });
        this.gui.getNetManager().send(viewFor('guest'));
        this.applyView(viewFor('host'));
    }
    winnerText(mine, theirs) { return mine > theirs ? 'YOU WIN!' : mine < theirs ? 'YOU LOSE' : 'TIE GAME'; }

    // ===================== SHARED VIEW =====================
    applyView(v) {
        const gainedBook = v.myBooks > this._prevBooks;
        this._prevBooks = v.myBooks;
        this.view = { hand: v.hand || [], myBooks: v.myBooks || 0, oppBooks: v.oppBooks || 0, oppCount: v.oppCount || 0, myTurn: !!v.myTurn, over: !!v.over, message: v.message || '', winner: v.winner || '' };
        this.gameState = v.over ? 'over' : 'playing';
        this.rebuildCardElements();
        if (gainedBook) this.audio.play('book');
        else if (/Go Fish/.test(this.view.message)) this.audio.play('fish');
        else this.audio.play('deal');
    }
    requestAsk(rank) {
        if (this.gameState !== 'playing' || !this.view.myTurn) return;
        if (this.isHost) this.hostResolveAsk('host', rank);
        else this.gui.getNetManager().send({ type: 'ask', rank });
    }
    rebuildCardElements() {
        this.clearCardElements();
        this._ranksInHand = [...new Set(this.view.hand)].sort((a, b) => RANKS.indexOf(a) - RANKS.indexOf(b));
        this._ranksInHand.forEach((r, i) => {
            const x = 60 + i * 56;
            this.input.registerElement('card_' + r, { bounds: () => ({ x, y: 468, width: 50, height: 76 }) }, 'gui');
        });
    }
    clearCardElements() { (this._ranksInHand || []).forEach(r => this.input.removeElement('card_' + r, 'gui')); this._ranksInHand = []; }

    // ============================ UPDATE ============================
    action_update(dt) {
        dt = Math.min(dt || 0, 0.05);
        this._t += dt;
        for (const b of this.bubbles) { b.y -= b.spd * dt; if (b.y < -b.r) { b.y = this.H + b.r; b.x = Math.random() * this.W; } }
        this.ui.update(dt);

        // nameplates only visible in-game; refresh their text from ActionNet + view
        const inGame = this.screen === 'game';
        this.npMe.panel.visible = inGame; this.npOpp.panel.visible = inGame;
        if (inGame) {
            this.myName = this.gui.getUsername() || 'You';
            this.npMe.name.text = this.myName; this.npMe.avatar.name = this.myName; this.npMe.books.text = 'Books ' + this.view.myBooks;
            this.npMe.name.color = this.view.myTurn ? 'success' : 'text';
            const opp = this.oppName || 'Opponent';
            this.npOpp.name.text = opp; this.npOpp.avatar.name = opp; this.npOpp.books.text = 'Books ' + this.view.oppBooks;
            this.npOpp.name.color = (!this.view.myTurn && this.gameState === 'playing') ? 'success' : 'text';
        }

        if (this.screen === 'menu') { this.updateMenu(); return; }
        if (this.screen === 'net') { this.gui.action_update(dt); return; }
        // screen === 'game'
        if (this.input.isElementJustPressed('btn_leave', 'gui')) return this.leaveMatch();
        if (this.gameState === 'playing' && this.view.myTurn) {
            for (const r of this._ranksInHand) {
                if (this.input.isElementJustPressed('card_' + r, 'gui') ||
                    (this.input.isLeftMouseButtonJustPressed() && this.input.isElementHovered('card_' + r, 'gui'))) { this.requestAsk(r); break; }
            }
        }
    }

    updateMenu() {
        if (this.input.isElementJustPressed('btn_online', 'gui')) { this.audio.play('click', { volume: 0.3 }); this.screen = 'net'; }
        // btn_single is intentionally disabled (no handler).
    }

    // ============================ DRAW ============================
    action_draw(alpha) {
        this.drawOcean(this.gameCtx);
        const g = this.guiCtx;
        g.clearRect(0, 0, this.W, this.H);                 // <-- we clear; the lobby never does
        if (this.screen === 'menu') this.drawMenu(g);
        else if (this.screen === 'net') this.gui.action_draw();
        else this.drawGame(g);
        this.ui.draw('gui');                               // nameplates + toasts on top
        this.debugCtx.clearRect(0, 0, this.W, this.H);
    }

    drawOcean(ctx) {
        const grad = ctx.createLinearGradient(0, 0, 0, this.H);
        grad.addColorStop(0, '#031b2e'); grad.addColorStop(0.55, '#06425a'); grad.addColorStop(1, '#0a6b6b');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, this.W, this.H);
        // light shafts (3 cheap translucent beams)
        ctx.save(); ctx.globalAlpha = 0.06; ctx.fillStyle = '#bdf3ff';
        for (let i = 0; i < 3; i++) {
            const x = 120 + i * 260 + Math.sin(this._t * 0.3 + i) * 30;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 70, 0); ctx.lineTo(x + 200, this.H); ctx.lineTo(x + 90, this.H); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        // rising bubbles
        for (const b of this.bubbles) {
            const x = b.x + Math.sin(this._t * 1.5 + b.ph) * 6;
            ctx.strokeStyle = 'rgba(190,243,255,0.35)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(190,243,255,0.10)'; ctx.fill();
        }
    }

    drawMenu(g) {
        g.textAlign = 'center';
        g.fillStyle = '#eaffff'; g.font = 'bold 72px monospace'; g.fillText('GO FISH', this.W / 2, 200);
        g.font = '16px monospace'; g.fillStyle = '#9fd9e8'; g.fillText('ActionNet P2P showcase', this.W / 2, 240);

        // ONLINE (enabled input element)
        const hov = this.input.isElementHovered('btn_online', 'gui'), pr = this.input.isElementPressed('btn_online', 'gui');
        g.fillStyle = pr ? '#0e7c9b' : hov ? '#1aa6c9' : '#138eb0'; g.fillRect(300, 300, 200, 56);
        g.strokeStyle = '#bdf3ff'; g.lineWidth = 2; g.strokeRect(300, 300, 200, 56);
        g.fillStyle = '#fff'; g.font = 'bold 24px monospace'; g.fillText('ONLINE', this.W / 2, 337);

        // SINGLE PLAYER (greyed / disabled)
        g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(300, 372, 200, 56);
        g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 1; g.strokeRect(300, 372, 200, 56);
        g.fillStyle = '#5b7480'; g.font = 'bold 18px monospace'; g.fillText('SINGLE PLAYER', this.W / 2, 405);
        g.font = '12px monospace'; g.fillText('(coming soon)', this.W / 2, 446);
    }

    drawGame(g) {
        // translucent table over the ocean
        this.roundRect(g, 40, 84, 720, 470, 16); g.fillStyle = 'rgba(4,30,26,0.66)'; g.fill();
        g.strokeStyle = 'rgba(120,220,200,0.25)'; g.lineWidth = 2; this.roundRect(g, 40, 84, 720, 470, 16); g.stroke();

        // in-game Leave (raw input element)
        const lh = this.input.isElementHovered('btn_leave', 'gui');
        g.fillStyle = lh ? 'rgba(255,90,110,0.85)' : 'rgba(255,90,110,0.55)'; g.fillRect(350, 16, 100, 30);
        g.strokeStyle = '#ffd0d6'; g.lineWidth = 1; g.strokeRect(350, 16, 100, 30);
        g.fillStyle = '#fff'; g.font = 'bold 14px monospace'; g.textAlign = 'center'; g.fillText('LEAVE', 400, 36);

        if (this.gameState === 'waiting') {
            g.fillStyle = '#cdeef0'; g.font = '20px monospace'; g.fillText(this.view.message || 'Connecting...', this.W / 2, 320);
            return;
        }

        // opponent hand (card backs)
        g.textAlign = 'center';
        for (let i = 0; i < this.view.oppCount; i++) { g.fillStyle = '#0e5a6e'; g.fillRect(70 + i * 24, 120, 20, 30); g.strokeStyle = '#072e3a'; g.strokeRect(70 + i * 24, 120, 20, 30); }

        // message + turn banner
        g.fillStyle = '#fff'; g.font = '18px monospace'; g.fillText(this.view.message, this.W / 2, 290);
        g.fillStyle = this.view.myTurn ? '#6ee7b7' : '#9fb6cf';
        g.fillText(this.view.myTurn ? 'YOUR TURN - click a rank to ask' : "OPPONENT'S TURN", this.W / 2, 322);

        // my hand (clickable rank cards)
        this._ranksInHand.forEach((r, i) => {
            const x = 60 + i * 56, count = this.view.hand.filter(c => c === r).length;
            const hov = this.view.myTurn && this.input.isElementHovered('card_' + r, 'gui');
            const lift = hov ? 8 : 0;
            g.fillStyle = hov ? '#ffffff' : '#e8f6f0'; g.fillRect(x, 468 - lift, 50, 76);
            g.strokeStyle = '#0c2a2a'; g.lineWidth = 2; g.strokeRect(x, 468 - lift, 50, 76);
            g.fillStyle = (r === 'J' || r === 'Q' || r === 'K' || r === 'A') ? '#c0392b' : '#12343a';
            g.font = 'bold 22px monospace'; g.fillText(r, x + 25, 468 - lift + 34);
            g.font = '13px monospace'; g.fillText('x' + count, x + 25, 468 - lift + 60);
        });

        if (this.gameState === 'over') {
            g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, this.W, this.H);
            g.fillStyle = this.view.winner === 'YOU WIN!' ? '#6ee7b7' : this.view.winner === 'TIE GAME' ? '#ffd93d' : '#ff6b6b';
            g.font = 'bold 48px monospace'; g.fillText(this.view.winner, this.W / 2, 280);
            g.fillStyle = '#cdeef0'; g.font = '16px monospace'; g.fillText('LEAVE to return to the lobby', this.W / 2, 330);
        }
    }

    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }
}
