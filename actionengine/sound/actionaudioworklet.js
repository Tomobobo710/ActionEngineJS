//actionengine/sound/actionaudioworklet.js
/**
 * ActionAudioWorklet - the sound engine on the audio thread.
 *
 * Every sound is rendered inside ONE AudioWorkletNode, so nothing on the page (UI,
 * game logic, GC, a busy frame) can delay or glitch playback. The main thread only
 * sends small messages ("start this voice", "stop that one").
 *
 * LOADING: browsers block worklet modules loaded from files or blob: URLs on file://
 * pages (tested: Chromium blocks both, Firefox blocks files). data: URLs work on both
 * file:// and http(s)://, so the module is shipped as a data: URL built from the
 * source text of ActionAudioWorkletModule below (Function.prototype.toString). That
 * function must therefore be COMPLETELY SELF-CONTAINED: no references to anything
 * outside its own body, no imports.
 *
 * Message protocol (main -> worklet), all plain data:
 *   { t: "voice", id, at, prio, ...voice }   start a voice
 *       at     : AudioContext time to start (<= currentTime means "now"), sample-accurate
 *       prio   : 0 music, 1 sfx (sfx voices are stolen last)
 *       osc    : "sine" | "square" | "sawtooth" | "triangle" | "noise"
 *       noise  : "white" | "pink" | "brown"                  (osc "noise")
 *       freq   : Hz
 *       sweep  : { to, dur }      exponential glide freq -> to over dur s, then hold
 *       fm     : { freq, index }  sine modulator: frequency += index * sin(2 pi freq t)
 *       filter : { type, frequency, Q, gain }   BiquadFilterNode-compatible
 *       env    : [[seconds, level], ...] breakpoints, linear between them; the voice ends
 *                after the last breakpoint
 *       pan, gain
 *   { t: "stop", id, fade }       fade out over `fade` seconds, then free
 *   { t: "gain", id, value }      change a voice's gain (smoothed)
 *   { t: "stopAll", fade }
 *   { t: "ping", n }              replied to with { t: "pong", n } once everything sent
 *                                 before it has been applied (used to sync offline renders)
 *   { t: "sfLoad", samples, banks }   SoundFont: Int16 sample arrays + zone tables
 *                                     banks[bank][program][key] = zone (see startSample)
 *   { t: "midi", op, ch, ... , at }   MIDI channel events, sample-accurate when `at` is set:
 *       op "on" {key, vel} | "off" {key} | "allOff" | "program" {value} | "bank" {value}
 *          | "volume" {value} | "pan" {value} | "bend" {value: 0..16383} | "sens" {value}
 *          | "expr" {value} | "perc" {value: bool} | "ring" {value: s} | "gain" {value}
 * Worklet -> main:
 *   { t: "ended", id }            a voice finished (envelope done or faded out)
 *   { t: "stats", voices, peak, steals }   roughly twice a second
 */
function ActionAudioWorkletModule() {
    const MAX_VOICES = 128;
    const TWO_PI = Math.PI * 2;

    // ------------------------------------------------------------ wavetables
    // Band-limited square / sawtooth / triangle built like Web Audio's own oscillators:
    // the Fourier series from the Web Audio spec, one table per pitch range holding only
    // the partials below Nyquist, all scaled by the peak of the full-band table (Web Audio
    // normalises its built-in waves the same way).
    const TABLE_SIZE = 4096, TABLE_MASK = TABLE_SIZE - 1, MAX_PARTIALS = TABLE_SIZE / 2 - 1;
    const LADDER = [];                               // partial counts, ~1/4 octave apart
    for (let n = 1; n <= MAX_PARTIALS; n = Math.max(n + 1, Math.floor(n * 1.1892))) LADDER.push(n);
    const PICK = new Int16Array(MAX_PARTIALS + 1);   // allowed partials -> ladder index
    for (let a = 0, k = 0; a <= MAX_PARTIALS; a++) { while (k + 1 < LADDER.length && LADDER[k + 1] <= a) k++; PICK[a] = k; }

    // In-place radix-2 FFT (used inverse, once, to build tables).
    function fft(re, im, inverse) {
        const n = re.length;
        for (let i = 1, j = 0; i < n; i++) {
            let bit = n >> 1;
            for (; j & bit; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
        }
        for (let len = 2; len <= n; len <<= 1) {
            const ang = (inverse ? 2 : -2) * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
            for (let i = 0; i < n; i += len) {
                let cr = 1, ci = 0;
                for (let k = 0; k < len / 2; k++) {
                    const a = i + k, b = a + len / 2;
                    const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
                    re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
                    const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
                }
            }
        }
    }
    const COEF = {
        square:   (n) => (n % 2 ? 4 / (n * Math.PI) : 0),
        sawtooth: (n) => (2 * (n % 2 ? 1 : -1)) / (n * Math.PI),
        triangle: (n) => (8 * Math.sin((n * Math.PI) / 2)) / ((Math.PI * n) * (Math.PI * n))
    };
    function buildTables(coef) {
        const tables = [];
        let scale = 1;
        for (let k = LADDER.length - 1; k >= 0; k--) {           // full band first: it sets the scale
            const re = new Float64Array(TABLE_SIZE), im = new Float64Array(TABLE_SIZE);
            // x[t] = sum b_n sin(2 pi n t / N): put -b/2 j at +n and +b/2 j at -n, then inverse FFT.
            for (let n = 1; n <= LADDER[k]; n++) { const b = coef(n); im[n] = -b / 2; im[TABLE_SIZE - n] = b / 2; }
            fft(re, im, true);
            const t = new Float32Array(TABLE_SIZE + 1);
            if (k === LADDER.length - 1) { let peak = 0; for (let i = 0; i < TABLE_SIZE; i++) peak = Math.max(peak, Math.abs(re[i])); scale = peak > 0 ? 1 / peak : 1; }
            for (let i = 0; i < TABLE_SIZE; i++) t[i] = re[i] * scale;
            t[TABLE_SIZE] = t[0];                                  // guard sample for interpolation
            tables[k] = t;
        }
        return tables;
    }
    const WAVES = [null, buildTables(COEF.square), buildTables(COEF.sawtooth), buildTables(COEF.triangle)];
    const OSC = { sine: 0, square: 1, sawtooth: 2, saw: 2, triangle: 3, noise: 4 };
    const NOISE = { white: 0, pink: 1, brown: 2 };

    // One table for a PeriodicWave (x = sum a_n cos + b_n sin), normalised to peak 1 as
    // Web Audio does by default. Used for the tracker's pulse waves.
    function periodicTable(a, b) {
        const re = new Float64Array(TABLE_SIZE), im = new Float64Array(TABLE_SIZE);
        for (let n = 1; n < a.length && n < TABLE_SIZE / 2; n++) {
            re[n] = a[n] / 2; re[TABLE_SIZE - n] = a[n] / 2; im[n] = -b[n] / 2; im[TABLE_SIZE - n] = b[n] / 2;
        }
        fft(re, im, true);
        let peak = 0; for (let i = 0; i < TABLE_SIZE; i++) peak = Math.max(peak, Math.abs(re[i]));
        const k = peak > 0 ? 1 / peak : 1, t = new Float32Array(TABLE_SIZE + 1);
        for (let i = 0; i < TABLE_SIZE; i++) t[i] = re[i] * k;
        t[TABLE_SIZE] = t[0];
        return t;
    }

    // AudioParam-style linear ramp { T, dt, from, to } (seconds); before T it holds `pre`
    // (or `from`), after T + dt it holds `to`.
    function rampAt(r, t) {
        if (t < r.T) return r.pre !== undefined ? r.pre : r.from;
        if (!(r.dt > 0)) return r.to;
        const f = (t - r.T) / r.dt;
        return f >= 1 ? r.to : r.from + (r.to - r.from) * f;
    }

    // WaveShaperNode with oversample "2x": windowed-sinc half-band interpolation and
    // decimation (16 taps per phase) around the curve lookup.
    const HB = (() => {
        const w = new Float64Array(16); let sum = 0;
        for (let m = 0; m < 16; m++) {
            const d = m - 7.5, x = Math.PI * d;
            const win = 0.42 + 0.5 * Math.cos((Math.PI * d) / 8.5) + 0.08 * Math.cos((2 * Math.PI * d) / 8.5);
            w[m] = (Math.sin(x) / x) * win; sum += w[m];
        }
        for (let m = 0; m < 16; m++) w[m] /= sum;
        return w;
    })();
    function makeOS() { return { x: new Float64Array(16), o: new Float64Array(16), e: new Float64Array(8) }; }
    function shapeCurve(c, x) {
        const N = c.length, v = ((N - 1) / 2) * (x + 1);
        if (v <= 0) return c[0];
        if (v >= N - 1) return c[N - 1];
        const k = v | 0;
        return c[k] + (c[k + 1] - c[k]) * (v - k);
    }
    function shapeOS(st, x, curve) {
        const X = st.x, O = st.o, Ev = st.e;
        for (let m = 0; m < 15; m++) X[m] = X[m + 1];
        X[15] = x;
        let mid = 0;
        for (let m = 0; m < 16; m++) mid += HB[m] * X[m];             // halfway between X[7] and X[8]
        for (let m = 0; m < 15; m++) O[m] = O[m + 1];
        O[15] = shapeCurve(curve, mid);
        for (let m = 0; m < 7; m++) Ev[m] = Ev[m + 1];
        Ev[7] = shapeCurve(curve, X[7]);
        let acc = 0;
        for (let m = 0; m < 16; m++) acc += HB[m] * O[m];
        return 0.5 * Ev[0] + 0.5 * acc;
    }

    // ------------------------------------------------------------ tracker (audio thread)
    // The real ActionTracker sequencer runs here (its class source is prepended to this
    // module by the host), one tick at a time exactly at its frame: process() splits every
    // block at tick boundaries. Only the voice layer is replaced - voices render straight
    // to samples instead of building node graphs - so every effect, envelope and
    // sequencing rule is literally the same code as the node tracker.
    const HAS_TRACKER = typeof ActionTracker !== "undefined";
    const PULSE = new Map();
    const BUS_K = Math.exp(-1 / (0.004 * sampleRate));               // mute/solo bus: setTargetAtTime 4 ms
    const WTracker = HAS_TRACKER ? class extends ActionTracker {
        constructor(engine) {
            super({ createGain: () => ({ gain: { value: 1 }, connect() {} }) }, null);
            const E = engine;
            this.engine = E;
            this.context = { get currentTime() { return E.clockFrame / sampleRate; } };
            this.soundFont = null;
            this.handles = new Map();     // hid -> handle (playing or paused)
            this.live = new Set();        // handles that still have sound (fading included)
        }

        frameOf(time) { return Math.max(this.engine.clockFrame, Math.ceil(time * sampleRate - 1e-6)); }

        // ---- transport (messages from the main thread) ----
        msg(m) {
            if (m.op === "play") return this.play(m);
            if (m.op === "sf") {
                this.soundFont = m.value ? { synth: true } : null;
                for (const h of this.handles.values()) if (h.isPlaying) this._allocSf2Channels(h._channels, h._song);
                return;
            }
            const h = this.handles.get(m.hid);
            if (!h) return;
            const now = this.context.currentTime;
            switch (m.op) {
                case "stop":
                case "pause": {
                    if (!h.isPlaying && !h.isPaused) return;
                    if (m.op === "pause" && (!h.isPlaying || h.isPaused)) return;
                    this._sf2ReleaseAll(h);
                    h._channels.forEach((c) => {
                        if (c.voice && !c.voice.sf2) this._stopVoice(c.voice, now, 0.03);
                        c.voice = null;
                    });
                    this._target(h, 0, now, 0.02);
                    if (m.op === "stop") { h.isPlaying = false; h.isPaused = false; this.handles.delete(h.hid); }
                    else h.isPaused = true;
                    break;
                }
                case "resume":
                    if (!h.isPaused) return;
                    h.isPaused = false;
                    this._target(h, h._volume, now, 0.02);
                    h._nextTime = now + 0.06;
                    h._state.tick = 0;
                    break;
                case "volume": this._target(h, Math.max(0, Math.min(1, m.value)), now, 0.02); break;
                case "mute": if (h._channels[m.i]) h._channels[m.i].muted = !!m.value; this._sync(h); break;
                case "solo": if (h._channels[m.i]) h._channels[m.i].solo = !!m.value; this._sync(h); break;
            }
        }

        play(m) {
            const E = this.engine, tracker = this;
            const song = this._normalize(m.song);
            const opts = m.opts || {};
            const volume = opts.volume ?? 1;
            const songLoop = opts.loop === undefined ? song.loop : opts.loop;
            const hid = m.hid;
            const h = {
                hid, isPlaying: true, isPaused: false, _volume: volume,
                _state: this._initState(song, opts), _song: song,
                _channels: song.channels.map((cfg) => this._newChannelState(cfg)),
                // Rows are reported to the main thread as they play (position / onRow).
                _posQueue: { push: (q) => E.port.postMessage({ t: "trkRow", hid, order: q.order, row: q.row, pattern: q.pattern, time: q.time, td: q.td }) },
                onRow: null,
                g: volume, gT: volume, gK: 0, pend: null, hg: new Float32Array(128),
                _nextTime: Math.max(m.at || 0, this.context.currentTime)
            };
            h._channels.forEach((c) => {
                c.bus = { g: 1, gT: 1, arr: new Float32Array(128) };
                c.dest = c.bus;
                c.handle = h;
            });
            h._endOfOrder = () => {
                const st = h._state;
                if (songLoop !== false && songLoop !== null && songLoop !== undefined) {
                    st.orderIndex = typeof songLoop === "number" ? Math.max(0, Math.min(songLoop, song.order.length - 1)) : 0;
                    st.row = 0;
                    st.loopStart = {};
                    st.loopCount = {};
                } else h._finish();
            };
            h._finish = () => {
                const endTime = h._nextTime;
                h._channels.forEach((c) => {
                    if (c.voice && c.voice.sf2) tracker._sf2NoteOff(c, endTime);
                    else if (c.voice) tracker._stopVoice(c.voice, endTime, 0.15);
                    c.voice = null;
                });
                h.isPlaying = false;
                tracker._target(h, 0, endTime + 0.4, 0.1);
                tracker.handles.delete(hid);
                E.port.postMessage({ t: "trkEnd", hid, endTime });
            };
            this.handles.set(hid, h);
            this.live.add(h);
            this._allocSf2Channels(h._channels, song);
            this._sync(h);
        }

        // GainNode.setTargetAtTime on the handle gain (one pending event, like the node path uses).
        _target(h, value, at, tau) {
            const k = Math.exp(-1 / (Math.max(1e-4, tau) * sampleRate));
            if (at <= this.context.currentTime + 1e-9) { h.gT = value; h.gK = k; h.pend = null; }
            else h.pend = { F: Math.ceil(at * sampleRate), target: value, k };
        }

        _sync(h) {
            const anySolo = h._channels.some((ch) => ch.solo);
            h._channels.forEach((ch) => {
                const audible = !ch.muted && (!anySolo || ch.solo);
                if (ch.sf2) {
                    const shared = h._channels.filter((o) => o.sf2 && o.sf2.ch === ch.sf2.ch);
                    const open = shared.some((o) => !o.muted && (!anySolo || o.solo));
                    this.engine.midi({ op: "gain", ch: ch.sf2.ch, value: open ? ch.sf2.level ?? 1 : 0 }, this.engine.clockFrame);
                } else if (ch.bus) ch.bus.gT = audible ? 1 : 0;
            });
        }

        // ---- clock: called by process() ----
        nextFrame(blockStart, r0, n) {
            let next = n;
            for (const h of this.handles.values()) {
                if (!h.isPlaying || h.isPaused) continue;
                const f = Math.ceil(h._nextTime * sampleRate - 1e-6) - blockStart;
                if (f < next) next = f;
            }
            return Math.max(r0, next);
        }

        runTicks(frame) {
            for (const h of this.handles.values()) {
                let guard = 0;
                while (h.isPlaying && !h.isPaused && Math.ceil(h._nextTime * sampleRate - 1e-6) <= frame && guard++ < 64) {
                    this._processTick(h, h._nextTime);
                    this._advanceTick(h);
                }
            }
        }

        prune() {
            if (!this.live.size) return;
            for (const h of this.live) {
                if (h.isPlaying || h.isPaused) continue;
                if (!this.engine.tvoices.some((v) => v.handle === h)) this.live.delete(h);
            }
        }

        // Handle gain + channel bus gain curves for frames [r0, r1), then the voices.
        render(TL, TR, r0, r1, blockStart) {
            for (const h of this.live) {
                const hg = h.hg;
                for (let i = r0; i < r1; i++) {
                    if (h.pend && blockStart + i >= h.pend.F) { h.gT = h.pend.target; h.gK = h.pend.k; h.pend = null; }
                    h.g = h.gT + (h.g - h.gT) * h.gK;
                    hg[i] = h.g;
                }
                for (const c of h._channels) {
                    const b = c.bus, arr = b.arr;
                    for (let i = r0; i < r1; i++) { b.g = b.gT + (b.g - b.gT) * BUS_K; arr[i] = b.g; }
                }
            }
            const list = this.engine.tvoices;
            for (let k = list.length - 1; k >= 0; k--) {
                const v = list[k];
                this.renderVoice(v, TL, TR, r0, r1, blockStart);
                if (!v.active) { list[k] = list[list.length - 1]; list.pop(); }
            }
        }

        // ---- synth voices ----
        pulseTable(duty, freq) {
            const octave = Math.max(0, Math.floor(Math.log2(Math.max(freq, 20) / 20)));
            const key = duty.toFixed(3) + ":" + octave;
            let t = PULSE.get(key);
            if (t) return t;
            const topFreq = 20 * Math.pow(2, octave + 1);
            const n = Math.max(2, Math.min(48, Math.floor(sampleRate / 2 / topFreq)));
            const a = new Float64Array(n + 1), b = new Float64Array(n + 1);
            for (let k = 1; k <= n; k++) {
                a[k] = (2 * Math.sin(2 * Math.PI * k * duty)) / (Math.PI * k);
                b[k] = (2 * (1 - Math.cos(2 * Math.PI * k * duty))) / (Math.PI * k);
            }
            t = periodicTable(a, b);
            PULSE.set(key, t);
            return t;
        }

        _createVoice(c, inst, freq, time) {
            const wave = inst.wave || "sine";
            const isNoise = wave === "noise";
            const voices = isNoise ? 1 : Math.max(1, inst.unison?.voices || 1);
            const detune = inst.unison?.detune || 0;
            const peak = (inst.gain ?? 0.5) * (c.cfg.gain ?? 1) / Math.sqrt(voices);
            time = Math.max(time, this.context.currentTime);
            const spreadAmt = !isNoise && voices > 1 ? Math.max(0, Math.min(1, inst.unison?.spread || 0)) : 0;
            const srcs = [];
            for (let i = 0; i < voices; i++) {
                const cents = voices > 1 ? (i / (voices - 1) - 0.5) * 2 * detune : 0;
                const sp = spreadAmt > 0 ? spreadAmt * ((i / (voices - 1)) * 2 - 1) : 0;
                const x = ((sp + 1) / 2) * (Math.PI / 2);
                srcs.push({ det: Math.pow(2, cents / 1200), ph: 0, pl: Math.cos(x), pr: Math.sin(x) });
            }
            let osc = 0, table = null;
            if (isNoise) osc = 4;
            else if (wave === "pulse") { osc = 5; table = this.pulseTable(inst.duty ?? 0.5, freq); }
            else osc = OSC[wave === "saw" ? "sawtooth" : wave] ?? 0;

            let fl = null, fr = null, filterEnv = null, base = 0;
            const ftype = inst.filter?.type || "lowpass";
            const fQ = inst.filter?.Q ?? inst.filterEnv?.Q ?? 1;
            if (inst.filter || inst.filterEnv) {
                base = inst.filter?.frequency ?? 1000;
                fl = { fb0: 1, fb1: 0, fb2: 0, fa1: 0, fa2: 0, fx1: 0, fx2: 0, fy1: 0, fy2: 0 };
                biquad(fl, ftype, base, fQ, 0);
                fr = { ...fl };
                if (inst.filterEnv) {
                    filterEnv = {
                        base,
                        amount: inst.filterEnv.amount ?? 2000,
                        adsr: inst.filterEnv.adsr || [0.01, 0.1, 0.5],
                        release: (inst.filterEnv.adsr || [])[3] ?? 0.1
                    };
                }
            }
            const [a = 0.01, d = 0.1, s = 0.6, r = 0.08] = inst.adsr || [];
            const v = {
                active: true, owner: c, handle: c.handle,
                startF: Math.ceil(time * sampleRate - 1e-6), stopF: -1,
                osc, table, srcs, stereo: spreadAmt > 0, npos: 0,
                drive: inst.drive ? { curve: this._driveCurve(inst.drive), L: makeOS(), R: makeOS() } : null,
                fl, fr, ftype, fQ, cutCur: base,
                fR: { T: time, dt: 0, from: freq, to: freq },
                gR: { T: time, dt: 0, from: 0, to: 0 },
                cR: fl ? { T: time, dt: 0, from: base, to: base } : null,
                pan: c.pan,
                // fields the shared tracker logic reads and writes
                filter: !!fl, filterEnv, inst, isNoise, peak,
                attack: a, decay: d, sustain: s, release: r,
                level: 0, lastFreq: freq, lastGain: 0, lastCut: null,
                start: time,
                releasing: false, releaseAt: 0, releaseTick: 0, releaseFrom: 0,
                pitchEnv: inst.pitchEnv
                    ? { amount: inst.pitchEnv.amount || 0, tau: Math.max(0.005, (inst.pitchEnv.decay || 0.1) / 3) }
                    : null,
                volumeEnv: inst.volumeEnv || null,
                panEnv: inst.panEnv || null,
                envDone: false,
                stopped: false
            };
            this.engine.tvoices.push(v);
            return v;
        }

        _stopVoice(voice, time, quick) {
            if (!voice || voice.stopped) return;
            voice.stopped = true;
            const at = Math.max(time, this.context.currentTime);
            const r = Math.max(0.005, quick ?? 0.02);
            // cancelScheduledValues(at) drops a ramp that ends at `at`: that tick then holds
            // its start value. Then setValueAtTime(lastGain, at) and a ramp to 0.
            const g = voice.gR;
            const pre = g.dt > 0 && g.T < at && g.T + g.dt >= at - 1e-9 ? g.from : rampAt(g, at);
            voice.gR = { T: at, dt: r, from: voice.lastGain ?? 0, to: 0, pre };
            voice.stopF = Math.ceil((at + r + 0.02) * sampleRate - 1e-6);
        }

        _rampFreq(v, from, to, time, dt) { v.fR = { T: time, dt, from, to }; }
        _rampGain(v, from, to, time, dt) { v.gR = { T: time, dt, from, to }; }
        _setPan(v, pan) { v.pan = pan; }
        _rampCutoff(v, from, to, time, dt) { v.cR = { T: time, dt, from, to }; }

        renderVoice(v, TL, TR, r0, r1, blockStart) {
            const E = this.engine, sr = sampleRate, nyq = sr / 2;
            const start = Math.max(r0, v.startF - blockStart);
            if (start >= r1) return;
            const srcs = v.srcs, ns = srcs.length, stereo = v.stereo;
            const hg = v.handle.hg, bg = v.owner.bus.arr;
            // StereoPannerNode: equal-power for a mono input; a stereo input folds one side in.
            const p = Math.max(-1, Math.min(1, v.pan));
            const x = !stereo ? ((p + 1) / 2) * (Math.PI / 2) : p <= 0 ? ((p + 1) * Math.PI) / 2 : (p * Math.PI) / 2;
            const pmL = Math.cos(x), pmR = Math.sin(x);
            // AudioBufferSourceNode.playbackRate is k-rate: one value per render quantum.
            const nRate = v.osc === 4 ? Math.max(0.05, rampAt(v.fR, blockStart / sr) / 440) : 0;
            const noise = E.noise, NN = noise.length;
            const fl = v.fl, fr = v.fr, cr = v.cR;
            const cutMoving = fl && cr && cr.dt > 0 && cr.from !== cr.to;
            const drive = v.drive;
            const waves = v.osc >= 1 && v.osc <= 3 ? WAVES[v.osc] : null;
            for (let i = start; i < r1; i++) {
                const g = blockStart + i;
                if (v.stopF >= 0 && g >= v.stopF) { v.active = false; return; }
                const t = g / sr;
                let a = 0, b = 0;
                if (v.osc === 4) {
                    const k = v.npos | 0;
                    a = noise[k] + (noise[k + 1 < NN ? k + 1 : 0] - noise[k]) * (v.npos - k);
                    v.npos += nRate;
                    if (v.npos >= NN) v.npos -= NN;
                } else {
                    const f = rampAt(v.fR, t);
                    for (let q = 0; q < ns; q++) {
                        const src = srcs[q], fs = f * src.det, ph = src.ph;
                        let y;
                        if (v.osc === 0) y = Math.sin(TWO_PI * ph);
                        else {
                            let tb = v.table;
                            if (!tb) { const af = Math.abs(fs); tb = waves[PICK[Math.max(1, af > 0 ? Math.min(MAX_PARTIALS, Math.floor(nyq / af)) : MAX_PARTIALS)]]; }
                            const z = ph * TABLE_SIZE, i0 = z | 0, j = i0 & TABLE_MASK;
                            y = tb[j] + (tb[j + 1] - tb[j]) * (z - i0);
                        }
                        let np = ph + fs / sr;
                        np -= Math.floor(np);
                        src.ph = np;
                        if (stereo) { a += y * src.pl; b += y * src.pr; } else a += y;
                    }
                }
                if (drive) { a = shapeOS(drive.L, a, drive.curve); if (stereo) b = shapeOS(drive.R, b, drive.curve); }
                if (fl) {
                    if (cr && (i === start || (cutMoving && (g & 7) === 0))) {
                        const fc = rampAt(cr, t);
                        if (fc !== v.cutCur) {
                            v.cutCur = fc;
                            biquadCoef(fl, v.ftype, fc, v.fQ, 0);
                            fr.fb0 = fl.fb0; fr.fb1 = fl.fb1; fr.fb2 = fl.fb2; fr.fa1 = fl.fa1; fr.fa2 = fl.fa2;
                        }
                    }
                    let y = fl.fb0 * a + fl.fb1 * fl.fx1 + fl.fb2 * fl.fx2 - fl.fa1 * fl.fy1 - fl.fa2 * fl.fy2;
                    fl.fx2 = fl.fx1; fl.fx1 = a; fl.fy2 = fl.fy1; fl.fy1 = y; a = y;
                    if (stereo) {
                        y = fr.fb0 * b + fr.fb1 * fr.fx1 + fr.fb2 * fr.fx2 - fr.fa1 * fr.fy1 - fr.fa2 * fr.fy2;
                        fr.fx2 = fr.fx1; fr.fx1 = b; fr.fy2 = fr.fy1; fr.fy1 = y; b = y;
                    }
                }
                const amp = rampAt(v.gR, t) * hg[i] * bg[i];
                a *= amp; b *= amp;
                if (!stereo) { TL[i] += a * pmL; TR[i] += a * pmR; }
                else if (p <= 0) { TL[i] += a + b * pmL; TR[i] += b * pmR; }
                else { TL[i] += a * pmL; TR[i] += b + a * pmR; }
            }
        }

        // ---- SoundFont channels: the engine's own SoundFont player ----
        _allocSf2Channels(channels, song) {
            if (!this.soundFont) return;
            const E = this.engine, F = E.clockFrame;
            const set = (ch, op, value) => E.midi({ op, ch, value }, F);
            let next = 0;
            channels.forEach((c) => {
                const inst = song.instruments[c.cfg.inst];
                if (!inst || inst.sf2 === undefined) return;
                let ch;
                if (inst.sf2 === "drums" || inst.percussion) {
                    ch = 9;
                    set(9, "perc", true);
                    set(9, "program", inst.kit ?? 0);
                    set(9, "ring", inst.ring ?? 3);
                } else {
                    while (next === 9) next++;
                    if (next > 15) return;
                    ch = next++;
                    set(ch, "perc", false);
                    set(ch, "bank", inst.bank ?? 0);
                    set(ch, "program", inst.sf2);
                }
                set(ch, "sens", 12);
                this._bend(ch, 8192, F);
                set(ch, "volume", ch === 9 ? 127 : 100);
                set(ch, "pan", 64);
                const level = inst.level ?? 1;
                set(ch, "gain", level);
                c.sf2 = { ch, level };
            });
        }

        // Pitch bend for the notes still held on a channel (the node synth bends only the
        // notes it has not released; release tails keep their pitch).
        _bend(ch, value, frame) {
            const E = this.engine, c = E.channels[ch];
            c.bend = value;
            const d = value - 8192, mul = Math.pow(2, ((d / (d < 0 ? 8192 : 8191)) * c.sens) / 12);
            for (const v of E.voices) if (v.active && v.kind === 1 && v.ch === ch && (v.relAt < 0 || v.relAt > frame)) v.bendMul = mul;
        }

        _sf2NoteOn(c, inst, time) {
            const E = this.engine;
            const vel = Math.max(1, Math.min(127, Math.round(c.vol * (inst.gain ?? 1) * 127)));
            const notes = Array.isArray(c.midi) ? c.midi : [c.midi];
            const f = this.frameOf(time ?? this.context.currentTime);
            this._bend(c.sf2.ch, 8192, f);
            notes.forEach((m) => E.startSample(c.sf2.ch, m, vel, f));
        }

        _sf2NoteOff(c, time) {
            if (!this.soundFont || !c.sf2 || c.midi === null) return;
            const notes = Array.isArray(c.midi) ? c.midi : [c.midi];
            const f = this.frameOf(time ?? this.context.currentTime);
            notes.forEach((m) => this.engine.releaseKey(c.sf2.ch, m, f));
        }

        _sf2ReleaseAll(h) {
            const chans = new Set(h._channels.filter((c) => c.sf2).map((c) => c.sf2.ch));
            const F = this.engine.clockFrame;
            for (const v of this.engine.voices) if (v.active && v.kind === 1 && chans.has(v.ch) && v.relAt < 0) v.relAt = F;
        }

        _sf2Bend(c, bend, time) { this._bend(c.sf2.ch, bend, this.frameOf(time)); }

        // Per-note expression gain ramp + pan, for the keys this tracker channel played.
        _sf2Expr(c, from, to, pan, time, dt) {
            const keys = Array.isArray(c.midi) ? c.midi : [c.midi];
            const ch = c.sf2.ch;
            const x = ((pan + 1) / 2) * (Math.PI / 2), pl = Math.cos(x), pr = Math.sin(x);
            for (const v of this.engine.voices) {
                if (!v.active || v.kind !== 1 || v.ch !== ch || v.relAt >= 0 || !keys.includes(v.key)) continue;
                v.exprR = { T: time, dt, from, to };
                v.panL = pl; v.panR = pr;
            }
        }
    } : null;

    // ------------------------------------------------------------ biquad (Web Audio formulas)
    function biquad(v, type, f, Q, gainDb) {
        biquadCoef(v, type, f, Q, gainDb);
        v.fx1 = v.fx2 = v.fy1 = v.fy2 = 0;
    }
    function biquadCoef(v, type, f, Q, gainDb) {
        const w0 = TWO_PI * Math.min(f, sampleRate / 2 * 0.9999) / sampleRate;
        const cw = Math.cos(w0), sw = Math.sin(w0);
        const A = Math.pow(10, (gainDb || 0) / 40);
        let b0, b1, b2, a0, a1, a2;
        if (type === "lowpass" || type === "highpass") {
            const alpha = sw / (2 * Math.pow(10, Q / 20));        // Web Audio: Q in dB here
            if (type === "lowpass") { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; }
            else { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; }
            a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
        } else if (type === "lowshelf" || type === "highshelf") {
            const alpha = (sw / 2) * Math.sqrt(2), sA = 2 * Math.sqrt(A) * alpha;
            if (type === "lowshelf") {
                b0 = A * ((A + 1) - (A - 1) * cw + sA); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - sA);
                a0 = (A + 1) + (A - 1) * cw + sA; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - sA;
            } else {
                b0 = A * ((A + 1) + (A - 1) * cw + sA); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - sA);
                a0 = (A + 1) - (A - 1) * cw + sA; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - sA;
            }
        } else {
            const alpha = sw / (2 * Math.max(1e-4, Q));
            if (type === "bandpass") { b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
            else if (type === "notch") { b0 = 1; b1 = -2 * cw; b2 = 1; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
            else if (type === "allpass") { b0 = 1 - alpha; b1 = -2 * cw; b2 = 1 + alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
            else { b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A; }  // peaking
        }
        v.fb0 = b0 / a0; v.fb1 = b1 / a0; v.fb2 = b2 / a0; v.fa1 = a1 / a0; v.fa2 = a2 / a0;
    }

    function makeVoice() {
        return {
            active: false, id: 0, prio: 0, age: 0,
            startFrame: 0, started: false,
            osc: 0, phase: 0, freq: 440,
            sweepMul: 1, sweepLeft: 0,
            fmFreq: 0, fmIndex: 0, fmPhase: 0,
            noise: 0, n0: 0, n1: 0, n2: 0, n3: 0, n4: 0, n5: 0, n6: 0, nLast: 0,
            filter: false, fb0: 1, fb1: 0, fb2: 0, fa1: 0, fa2: 0, fx1: 0, fx2: 0, fy1: 0, fy2: 0,
            envF: new Float64Array(16), envV: new Float32Array(16), envN: 0, seg: 0, frame: 0,
            // SoundFont sample voice (kind 1)
            kind: 0, smp: null, smpEnd: 0, pos: 0, inc: 0, bendMul: 1, loop: false, ls: 0, le: 0,
            ch: 0, key: 0, vol: 0, tauF: 1, attF: 0, decF: 0, sus: 0, ringF: -1, expr: 1,
            relAt: -1, relStart: 0, relFrom: 0, relF: 1, released: false, level: 0,
            gain: 1, gainTarget: 1,
            panL: 0.7071, panR: 0.7071,
            fading: false, fadeLeft: 0, fadeStep: 0, fadeMul: 1
        };
    }

    // ------------------------------------------------------------ SoundFont state
    // Samples are raw 16-bit integers (as the parser stores them); the node synth's master
    // gain scales them by 1/65535 * 16383/16384, so do the same.
    const SF_SCALE = (1 / 0xffff) * (16383 / 16384);
    const REVERB_MIX = 0.315;
    function makeChannel(i) {
        return { program: 0, bank: i === 9 ? 128 : 0, volume: 100, pan: 64, bend: 8192, sens: 2, expr: 127,
                 perc: i === 9, ring: 3, gain: 1, gainTarget: 1, gainStep: 0, g0: 1, g1: 1 };
    }

    // ------------------------------------------------------------ reverb
    // Shared algorithmic reverb standing in for the node synth's 3 s noise-impulse
    // convolver (too heavy for the audio thread): eight damped feedback combs + four
    // allpasses per side (Freeverb topology), each comb's feedback set for the same ~2.25 s
    // decay, then the same 2.2 kHz lowpass, at the same 0.315 mix.
    function makeReverb() {
        const k = sampleRate / 44100;
        const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], ALLP = [556, 441, 341, 225], SPREAD = 23;
        const T60 = 2.8;
        const side = (off) => ({
            combs: COMBS.map((d) => { const n = Math.round((d + off) * k); return { buf: new Float32Array(n), i: 0, store: 0, fb: Math.pow(10, (-3 * n) / (T60 * sampleRate)) }; }),
            allp: ALLP.map((d) => ({ buf: new Float32Array(Math.round((d + off) * k)), i: 0 })),
            lp: { fb0: 1, fb1: 0, fb2: 0, fa1: 0, fa2: 0, fx1: 0, fx2: 0, fy1: 0, fy2: 0 }
        });
        const r = { L: side(0), R: side(SPREAD), input: new Float32Array(128), active: 0 };
        biquad(r.L.lp, "lowpass", 2200, 1, 0); biquad(r.R.lp, "lowpass", 2200, 1, 0);
        return r;
    }
    let REVERB_GAIN = 0.0127;       // calibrated against the node convolver (see tests)
    const DAMP = 0.25;
    function reverbSide(sd, x) {
        let out = 0;
        for (let c = 0; c < 8; c++) {
            const cb = sd.combs[c];
            const y = cb.buf[cb.i];
            cb.store = y * (1 - DAMP) + cb.store * DAMP;
            cb.buf[cb.i] = x + cb.store * cb.fb;
            if (++cb.i >= cb.buf.length) cb.i = 0;
            out += y;
        }
        for (let a = 0; a < 4; a++) {
            const ap = sd.allp[a];
            const b = ap.buf[ap.i];
            ap.buf[ap.i] = out + b * 0.5;
            out = b - out;
            if (++ap.i >= ap.buf.length) ap.i = 0;
        }
        const f = sd.lp;
        const y = f.fb0 * out + f.fb1 * f.fx1 + f.fb2 * f.fx2 - f.fa1 * f.fy1 - f.fa2 * f.fy2;
        f.fx2 = f.fx1; f.fx1 = out; f.fy2 = f.fy1; f.fy1 = y;
        return y;
    }

    class ActionAudioEngine extends AudioWorkletProcessor {
        constructor() {
            super();
            this.voices = Array.from({ length: MAX_VOICES }, makeVoice);
            this.ageCounter = 0;
            this.steals = 0;
            this.peak = 0;
            this.statFrames = 0;
            this.endedQueue = [];
            this.sf = null;                                    // { samples, banks }
            this.pcm = new Map();                              // id -> { data, rate } (uploaded AudioBuffers)
            this.channels = Array.from({ length: 16 }, (_, i) => makeChannel(i));
            this.pending = [];                                 // future-timed MIDI events, by frame
            this.reverb = makeReverb();
            this.clockFrame = 0;                               // audio time the tracker sees (frames)
            this.sfBus = false;                                // SoundFont notes -> output 1 (tracker)
            this.tvoices = [];                                 // tracker synth voices
            this.noise = new Float32Array(Math.round(sampleRate * 2) || 96000);
            for (let i = 0; i < this.noise.length; i++) this.noise[i] = Math.random() * 2 - 1;
            this.trk = WTracker ? new WTracker(this) : null;
            this.port.onmessage = (e) => this.onMessage(e.data);
        }

        onMessage(m) {
            if (m.t === "voice") this.startVoice(m);
            else if (m.t === "stop") { const v = this.find(m.id); if (v) this.fade(v, m.fade ?? 0.05); }
            else if (m.t === "gain") { const v = this.find(m.id); if (v) v.gainTarget = m.value; }
            else if (m.t === "stopAll") { for (const v of this.voices) if (v.active) this.fade(v, m.fade ?? 0.05); }
            else if (m.t === "ping") this.port.postMessage({ t: "pong", n: m.n });
            else if (m.t === "pcmLoad") this.pcm.set(m.id, { data: m.data, rate: m.rate });
            else if (m.t === "pcmFree") this.pcm.delete(m.id);
            else if (m.t === "sfLoad") this.sf = { samples: m.samples, banks: m.banks };
            else if (m.t === "reverbGain") REVERB_GAIN = m.value;          // calibration hook
            else if (m.t === "trk") { if (this.trk) { this.clockFrame = currentFrame; this.trk.msg(m); } }
            else if (m.t === "sfBus") this.sfBus = !!m.value;
            else if (m.t === "midi") {
                const frame = Math.round((m.at || 0) * sampleRate);
                if (frame > currentFrame + 128) { this.pending.push({ frame, m }); this.pending.sort((a, b) => a.frame - b.frame); }
                else this.midi(m, Math.max(frame, currentFrame));
            }
        }

        // ---------------------------------------------------------------- MIDI channels
        // Same rules as ActionSynthesizer (programChange / bankChange / noteOn lookup).
        bankChange(ch, bank) {
            const c = this.channels[ch];
            const banks = this.sf ? this.sf.banks : [];
            if (banks[bank]) c.bank = bank; else c.bank = c.perc ? 128 : 0;
        }

        midi(m, frame) {
            const ch = m.ch | 0, c = this.channels[ch];
            switch (m.op) {
                case "on": if ((m.vel | 0) > 0) this.startSample(ch, m.key | 0, m.vel | 0, frame); else this.releaseKey(ch, m.key | 0, frame); break;
                case "off": this.releaseKey(ch, m.key | 0, frame); break;
                case "allOff": for (const v of this.voices) if (v.active && v.kind === 1 && v.ch === ch && v.relAt < 0) v.relAt = frame; break;
                case "program": c.program = m.value | 0; this.bankChange(ch, c.bank); break;
                case "bank": this.bankChange(ch, m.value | 0); break;
                case "volume": c.volume = m.value; break;
                case "pan": c.pan = m.value; break;
                case "sens": c.sens = m.value; break;
                case "expr": c.expr = m.value; break;
                case "perc": c.bank = 128; c.perc = !!m.value; break;
                case "ring": c.ring = Math.max(0.1, m.value); break;
                case "gain": c.gainTarget = Math.max(0, m.value); c.gainStep = (c.gainTarget - c.gain) / Math.max(1, Math.round(0.02 * sampleRate)); break;
                case "bend": {
                    c.bend = m.value;
                    const d = m.value - 8192, semis = (d / (d < 0 ? 8192 : 8191)) * c.sens;
                    const mul = Math.pow(2, semis / 12);
                    for (const v of this.voices) if (v.active && v.kind === 1 && v.ch === ch) v.bendMul = mul;
                    break;
                }
            }
        }

        releaseKey(ch, key, frame) {
            for (const v of this.voices) {
                if (v.active && v.kind === 1 && v.ch === ch && v.key === key && v.relAt < 0 && v.startFrame <= frame + 1) v.relAt = frame;
            }
        }

        // A SoundFont note: zone lookup, envelope and filter as ActionSynthesizerNote.
        startSample(ch, key, vel, frame) {
            if (!this.sf) return;
            const c = this.channels[ch];
            const banks = this.sf.banks;
            const bank = banks[c.bank] || banks[0];
            if (!bank) return;
            let inst = bank[c.program];
            if (!inst) inst = c.perc ? ((banks[128] && banks[128][0]) || (banks[0] && banks[0][0])) : (banks[0] && banks[0][c.program]);
            const z = inst && inst[key];
            if (!z) return;
            const v = this.allocate(0);
            if (!v) return;
            v.active = true; v.kind = 1; v.id = -1; v.prio = 0; v.age = ++this.ageCounter;
            v.startFrame = frame; v.started = false;
            v.ch = ch; v.key = key;
            v.smp = this.sf.samples[z.s];
            v.smpEnd = Math.min(v.smp.length, v.smp.length + (z.end || 0));
            v.pos = z.start || 0;
            v.inc = (z.base * z.rate) / sampleRate;
            v.bendMul = 1;
            v.loop = (z.modes & 1) !== 0;
            v.ls = z.ls || 0; v.le = z.le > v.ls ? Math.min(z.le, v.smpEnd) : v.smpEnd;
            v.vol = Math.max(0, (c.volume / 127) * (vel / 127) * (1 - (z.atten || 0) / 1000));
            const tau = z.att || 0.01;
            v.tauF = Math.max(1e-6, tau * sampleRate);
            v.attF = Math.round(tau * 3 * sampleRate);
            if (c.perc && v.loop) { v.ringF = Math.round(c.ring * sampleRate); v.decF = 0; v.sus = 0; }
            else { v.ringF = -1; v.decF = v.attF + Math.round((z.dec || 0.1) * sampleRate); v.sus = v.vol * (z.sus || 0.7); }
            v.relAt = -1; v.released = false; v.relF = Math.max(1, Math.round((z.rel || 0.3) * sampleRate)); v.level = 0;
            v.expr = (c.expr || 127) / 127; v.exprR = null;
            v.filter = true; biquad(v, "lowpass", Math.pow(2, ((z.fc ?? 13500) - 6900) / 1200) * 440, Math.pow(10, (z.q || 0) / 200), 0);
            let pan;
            if (z.pan !== undefined && z.pan !== null) pan = z.pan;
            else { const p = c.pan === 0 ? (Math.random() * 127) | 0 : c.pan - 64; pan = p / (p < 0 ? 64 : 63); }
            const x = ((Math.max(-1, Math.min(1, pan)) + 1) / 2) * (Math.PI / 2);
            v.panL = Math.cos(x); v.panR = Math.sin(x);
            v.gain = v.gainTarget = 1; v.fading = false; v.fadeMul = 1;
        }

        // Render one SoundFont voice into L/R (and the reverb send) for frames [i, n).
        renderSample(v, L, R, rin, i, n, blockStart, bn) {
            const c = this.channels[v.ch];
            const smp = v.smp, end = v.smpEnd;
            const g0 = c.g0, gd = (c.g1 - c.g0) / (bn || n);
            const exR = v.exprR;
            for (; i < n; i++) {
                const g = blockStart + i, t = g - v.startFrame;
                let level;
                if (v.relAt >= 0 && g >= v.relAt) {
                    if (!v.released) { v.released = true; v.relFrom = v.level; v.relStart = g; }
                    level = v.relFrom * (1 - (g - v.relStart) / v.relF);
                    if (level <= 0) { this.free(v); return; }
                } else if (t < v.attF) level = v.vol * (1 - Math.exp(-t / v.tauF));
                else if (v.ringF >= 0) { if (t >= v.ringF) { this.free(v); return; } level = v.vol * (1 - (t - v.attF) / Math.max(1, v.ringF - v.attF)); }
                else if (t < v.decF) level = v.vol + (v.sus - v.vol) * ((t - v.attF) / Math.max(1, v.decF - v.attF));
                else level = v.sus;
                v.level = level;
                if (v.loop && v.pos >= v.le) v.pos -= v.le - v.ls;
                const idx = v.pos | 0;
                if (idx >= end - 1) { this.free(v); return; }
                const fr = v.pos - idx;
                const s = smp[idx] + (smp[idx + 1] - smp[idx]) * fr;
                v.pos += v.inc * v.bendMul;
                const y = v.fb0 * s + v.fb1 * v.fx1 + v.fb2 * v.fx2 - v.fa1 * v.fy1 - v.fa2 * v.fy2;
                v.fx2 = v.fx1; v.fx1 = s; v.fy2 = v.fy1; v.fy1 = y;
                const out = y * level * (exR ? rampAt(exR, g / sampleRate) : v.expr) * (g0 + gd * i) * SF_SCALE;
                const oL = out * v.panL, oR = out * v.panR;
                L[i] += oL; R[i] += oR;
                rin[i] += (oL + oR) * 0.5;
            }
        }

        find(id) {
            for (const v of this.voices) if (v.active && v.id === id) return v;
            return null;
        }

        // Free voice, else steal: lowest priority first, then the oldest.
        allocate(prio) {
            let best = null;
            for (const v of this.voices) if (!v.active) return v;
            for (const v of this.voices) {
                if (v.prio > prio) continue;
                if (!best || v.prio < best.prio || (v.prio === best.prio && v.age < best.age)) best = v;
            }
            if (best) { this.steals++; if (best.kind !== 1) this.endedQueue.push(best.id); best.kind = 0; best.smp = null; }
            return best;
        }

        startVoice(m) {
            const v = this.allocate(m.prio | 0);
            if (!v) return;                                   // everything is higher priority: drop it
            v.active = true; v.kind = 0; v.smp = null; v.id = m.id; v.prio = m.prio | 0; v.age = ++this.ageCounter;
            const startFrame = Math.round((m.at || 0) * sampleRate);
            v.startFrame = Math.max(startFrame, currentFrame);
            v.started = false;
            v.osc = OSC[m.osc] ?? 0;
            v.phase = 0;
            v.freq = m.freq || 440;
            // Exponential sweep: multiply the frequency by a constant factor each sample.
            if (m.sweep && m.sweep.dur > 0 && m.sweep.to > 0 && v.freq > 0) {
                const frames = Math.max(1, Math.round(m.sweep.dur * sampleRate));
                v.sweepMul = Math.pow(m.sweep.to / v.freq, 1 / frames); v.sweepLeft = frames;
            } else { v.sweepMul = 1; v.sweepLeft = 0; }
            if (m.fm) { v.fmFreq = m.fm.freq || 0; v.fmIndex = m.fm.index || 0; } else { v.fmFreq = 0; v.fmIndex = 0; }
            v.fmPhase = 0;
            v.noise = NOISE[m.noise] ?? 0;
            // PCM playback of an uploaded buffer (osc 5), linear interpolation, `rate` = playbackRate.
            const pcm = m.pcm ? this.pcm.get(m.pcm) : null;
            if (m.pcm) {
                if (!pcm) { v.active = false; this.endedQueue.push(v.id); return; }
                v.osc = 5; v.smp = pcm.data; v.pos = 0; v.inc = (pcm.rate / sampleRate) * (m.rate || 1);
            }
            v.n0 = v.n1 = v.n2 = v.n3 = v.n4 = v.n5 = v.n6 = v.nLast = 0;
            if (m.filter && m.filter.type) { v.filter = true; biquad(v, m.filter.type, m.filter.frequency ?? 350, m.filter.Q ?? 1, m.filter.gain ?? 0); }
            else v.filter = false;
            const env = m.env && m.env.length ? m.env : [[0, 0], [0.01, 1], [0.3, 0]];
            v.envN = Math.min(16, env.length);
            for (let i = 0; i < v.envN; i++) { v.envF[i] = Math.round(env[i][0] * sampleRate); v.envV[i] = env[i][1]; }
            v.seg = 0; v.frame = 0;
            v.gain = v.gainTarget = m.gain ?? 1;
            // Equal-power pan, the same law as StereoPannerNode for a mono source.
            const x = ((Math.max(-1, Math.min(1, m.pan || 0)) + 1) / 2) * (Math.PI / 2);
            v.panL = Math.cos(x); v.panR = Math.sin(x);
            if (m.lr) { v.panL = m.lr[0]; v.panR = m.lr[1]; }       // explicit left/right gains
            v.fading = false; v.fadeMul = 1;
        }

        fade(v, seconds) {
            const n = Math.max(1, Math.round(seconds * sampleRate));
            v.fading = true; v.fadeLeft = n; v.fadeStep = v.fadeMul / n;
        }

        free(v) {
            v.active = false;
            if (v.kind === 1) { v.kind = 0; v.smp = null; return; }    // MIDI notes have no listener
            this.endedQueue.push(v.id);
        }

        process(inputs, outputs) {
            const out = outputs[0];
            const L = out[0], R = out[1] || out[0];
            const n = L.length;
            L.fill(0); if (R !== L) R.fill(0);
            // Output 1 = the tracker bus (connected to ActionTracker.output by the host).
            const tout = outputs[1];
            const TL = tout && tout[0] ? tout[0] : L, TR = tout && tout[0] ? (tout[1] || tout[0]) : R;
            if (TL !== L) { TL.fill(0); if (TR !== TL) TR.fill(0); }
            const blockStart = currentFrame;
            this.clockFrame = blockStart;
            // Future-timed MIDI events that fall in this block.
            while (this.pending.length && this.pending[0].frame < blockStart + n) { const e = this.pending.shift(); this.midi(e.m, Math.max(e.frame, blockStart)); }
            // Channel gain ramps (20 ms, like setChannelGain), interpolated across the block.
            for (const c of this.channels) {
                c.g0 = c.gain;
                if (c.gainStep) { c.gain += c.gainStep * n; if ((c.gainStep > 0 && c.gain >= c.gainTarget) || (c.gainStep < 0 && c.gain <= c.gainTarget)) { c.gain = c.gainTarget; c.gainStep = 0; } }
                c.g1 = c.gain;
            }
            const rin = this.reverb.input; rin.fill(0);
            this.anySample = false;
            // SoundFont notes (and their reverb) go to the tracker bus while a tracker owns the
            // soundfont - the node synth's output is routed into the tracker the same way.
            const SL = this.sfBus ? TL : L, SR = this.sfBus ? TR : R;

            // Render in segments split at tracker tick frames, running each tick exactly
            // at its frame (no lookahead: the sequencer lives on this thread).
            const trk = this.trk;
            let r0 = 0;
            for (;;) {
                const r1 = trk ? trk.nextFrame(blockStart, r0, n) : n;
                if (r1 > r0) {
                    this.renderRange(L, R, SL, SR, rin, r0, r1, blockStart, n);
                    if (trk && (this.tvoices.length || trk.live.size)) trk.render(TL, TR, r0, r1, blockStart);
                }
                if (r1 >= n) break;
                this.clockFrame = blockStart + r1;
                trk.runTicks(blockStart + r1);
                r0 = r1;
            }
            this.clockFrame = blockStart + n;
            if (trk) trk.prune();
            const anySample = this.anySample;
            this.finishBlock(L, R, SL, SR, TL, rin, n, anySample);
            return true;
        }

        renderRange(L, R, SL, SR, rin, r0, r1, blockStart, n) {
            const gainSmooth = 1 - Math.exp(-1 / (0.005 * sampleRate));     // ~5 ms
            const nyquist = sampleRate / 2;
            for (const v of this.voices) {
                if (!v.active) continue;
                let i = r0;
                if (!v.started) {
                    if (v.startFrame >= blockStart + r1) continue;           // starts later
                    i = Math.max(r0, v.startFrame - blockStart);             // sample-accurate start
                    v.started = true;
                }
                if (v.kind === 1) { this.anySample = true; this.renderSample(v, SL, SR, rin, i, r1, blockStart, n); continue; }
                // Wavetable: a steady pitch picks one table per block; a moving pitch (FM, sweep)
                // picks per sample from the instantaneous frequency, like Web Audio does.
                let table = null;
                const waves = v.osc >= 1 && v.osc <= 3 ? WAVES[v.osc] : null;
                const moving = waves && (v.fmIndex !== 0 || v.sweepLeft > 0);
                if (waves && !moving) {
                    const f = Math.abs(v.freq);
                    table = waves[PICK[Math.max(1, f > 0 ? Math.min(MAX_PARTIALS, Math.floor(nyquist / f)) : MAX_PARTIALS)]];
                }
                for (; i < r1; i++) {
                    // Envelope (linear between breakpoints).
                    while (v.seg < v.envN - 1 && v.frame >= v.envF[v.seg + 1]) v.seg++;
                    if (v.seg >= v.envN - 1) { this.free(v); break; }
                    const f0 = v.envF[v.seg], f1 = v.envF[v.seg + 1];
                    const span = f1 - f0;
                    const env = span > 0 ? v.envV[v.seg] + (v.envV[v.seg + 1] - v.envV[v.seg]) * ((v.frame - f0) / span) : v.envV[v.seg + 1];
                    v.frame++;

                    // Source.
                    let s;
                    if (v.osc === 5) {
                        const idx = v.pos | 0, d = v.smp;
                        if (idx >= d.length - 1) { this.free(v); break; }
                        s = d[idx] + (d[idx + 1] - d[idx]) * (v.pos - idx);
                        v.pos += v.inc;
                    } else if (v.osc === 4) {
                        const white = Math.random() * 2 - 1;
                        if (v.noise === 0) s = white;
                        else if (v.noise === 1) {                         // Paul Kellet's pink (same as the node engine)
                            v.n0 = 0.99886 * v.n0 + white * 0.0555179; v.n1 = 0.99332 * v.n1 + white * 0.0750759;
                            v.n2 = 0.969 * v.n2 + white * 0.153852;    v.n3 = 0.8665 * v.n3 + white * 0.3104856;
                            v.n4 = 0.55 * v.n4 + white * 0.5329522;    v.n5 = -0.7616 * v.n5 - white * 0.016898;
                            s = v.n0 + v.n1 + v.n2 + v.n3 + v.n4 + v.n5;
                        } else { s = (v.nLast + 0.02 * white) / 1.02; v.nLast = s; }   // brown
                    } else {
                        let f = v.freq;
                        if (v.fmIndex) { f += v.fmIndex * Math.sin(TWO_PI * v.fmPhase); v.fmPhase += v.fmFreq / sampleRate; if (v.fmPhase >= 1) v.fmPhase -= 1; }
                        const t = v.phase;
                        if (v.osc === 0) s = Math.sin(TWO_PI * t);
                        else {
                            if (moving) { const af = Math.abs(f); table = waves[PICK[Math.max(1, af > 0 ? Math.min(MAX_PARTIALS, Math.floor(nyquist / af)) : MAX_PARTIALS)]]; }
                            const x = t * TABLE_SIZE, i0 = x | 0, fr = x - i0;
                            s = table[i0 & TABLE_MASK] + (table[(i0 & TABLE_MASK) + 1] - table[i0 & TABLE_MASK]) * fr;
                        }
                        let ph = t + f / sampleRate;
                        ph -= Math.floor(ph);
                        v.phase = ph;
                        if (v.sweepLeft > 0) { v.freq *= v.sweepMul; v.sweepLeft--; }
                    }
                    if (v.filter) {
                        const y = v.fb0 * s + v.fb1 * v.fx1 + v.fb2 * v.fx2 - v.fa1 * v.fy1 - v.fa2 * v.fy2;
                        v.fx2 = v.fx1; v.fx1 = s; v.fy2 = v.fy1; v.fy1 = y; s = y;
                    }

                    v.gain += (v.gainTarget - v.gain) * gainSmooth;
                    if (v.fading) {
                        v.fadeMul -= v.fadeStep;
                        if (--v.fadeLeft <= 0 || v.fadeMul <= 0) { this.free(v); break; }
                    }
                    const y = s * env * v.gain * v.fadeMul;
                    L[i] += y * v.panL;
                    R[i] += y * v.panR;
                }
            }
        }

        finishBlock(L, R, SL, SR, TL, rin, n, anySample) {
            // Reverb: runs while SoundFont voices feed it, then for its tail (~3 s).
            if (anySample) this.reverb.active = Math.round(3 * sampleRate);
            if (this.reverb.active > 0) {
                this.reverb.active -= n;
                const rv = this.reverb, wet = REVERB_MIX * REVERB_GAIN;
                for (let i = 0; i < n; i++) {
                    const x = rin[i];
                    SL[i] += reverbSide(rv.L, x) * wet;
                    SR[i] += reverbSide(rv.R, x) * wet;
                }
            }

            // Lightweight stats + ended notifications (outside the per-sample loop).
            for (let i = 0; i < n; i++) { const a = Math.abs(L[i]); if (a > this.peak) this.peak = a; }
            if (TL !== L) for (let i = 0; i < n; i++) { const a = Math.abs(TL[i]); if (a > this.peak) this.peak = a; }
            if (this.endedQueue.length) {
                for (const id of this.endedQueue) this.port.postMessage({ t: "ended", id });
                this.endedQueue.length = 0;
            }
            this.statFrames += n;
            if (this.statFrames >= sampleRate / 2) {
                let count = 0; for (const v of this.voices) if (v.active) count++;
                this.port.postMessage({ t: "stats", voices: count, peak: this.peak, steals: this.steals });
                this.statFrames = 0; this.peak = 0;
            }
        }
    }

    registerProcessor("action-audio-engine", ActionAudioEngine);
}

/**
 * ActionAudioWorkletHost - main-thread side. Loads the module as a data: URL, creates
 * the node, queues messages until it is ready, and reports voice endings.
 */
class ActionAudioWorkletHost {
    constructor(context, destination) {
        this.context = context;
        this.node = null;
        this.failed = false;
        this.stats = { voices: 0, peak: 0, steals: 0 };
        this._queue = [];
        this._nextId = 1;
        this._onEnded = new Map();       // id -> callback
        this._pings = new Map();         // n -> resolve
        this._pingN = 0;
        this.ready = this._load(destination);
    }

    static moduleURL() {
        // The tracker's sequencer runs on the audio thread too: its class source goes in
        // first, so the module can subclass it (see WTracker).
        const tracker = typeof ActionTracker !== "undefined" ? ActionTracker.toString() + ";\n" : "";
        const source = tracker + "(" + ActionAudioWorkletModule.toString() + ")();";
        // UTF-8 safe base64 (the source may contain non-ASCII characters in comments).
        const bytes = new TextEncoder().encode(source);
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return "data:text/javascript;base64," + btoa(bin);
    }

    async _load(destination) {
        try {
            if (!this.context.audioWorklet) throw new Error("AudioWorklet not supported");
            await this.context.audioWorklet.addModule(ActionAudioWorkletHost.moduleURL());
            this.node = new AudioWorkletNode(this.context, "action-audio-engine", {
                numberOfInputs: 0, numberOfOutputs: 2, outputChannelCount: [2, 2]   // 0 main, 1 tracker
            });
            this.node.connect(destination);
            this.node.port.onmessage = (e) => this._onMessage(e.data);
            this.node.onprocessorerror = (e) => {
                console.error("[ActionAudioWorklet] processor crashed - sound engine stopped", e);
                this.failed = true;
                if (this.onFailure) this.onFailure(e);
            };
            for (const m of this._queue) this.node.port.postMessage(m);
            this._queue.length = 0;
            return true;
        } catch (e) {
            console.warn("[ActionAudioWorklet] could not start the audio-thread engine:", e && e.message ? e.message : e);
            this.failed = true;
            this._queue.length = 0;
            throw e;
        }
    }

    _onMessage(m) {
        if (m.t === "ended") {
            const cb = this._onEnded.get(m.id);
            if (cb) { this._onEnded.delete(m.id); try { cb(); } catch (e) { console.error(e); } }
        } else if (m.t === "pong") {
            const done = this._pings.get(m.n);
            if (done) { this._pings.delete(m.n); done(); }
        } else if (m.t === "trkRow" || m.t === "trkEnd") {
            if (this.onTracker) this.onTracker(m);
        } else if (m.t === "stats") {
            this.stats = { voices: m.voices, peak: m.peak, steals: m.steals };
        }
    }

    send(msg) {
        if (this.failed) return;
        if (this.node) this.node.port.postMessage(msg);
        else this._queue.push(msg);
    }

    /**
     * Upload an AudioBuffer (channel 0) once; returns the id a voice's `pcm` field takes.
     * The same buffer object is only sent the first time.
     */
    pcm(buffer) {
        if (!this._pcmIds) this._pcmIds = new WeakMap();
        let id = this._pcmIds.get(buffer);
        if (!id) {
            id = this._nextId++;
            this._pcmIds.set(buffer, id);
            this.send({ t: "pcmLoad", id, data: buffer.getChannelData(0).slice(), rate: buffer.sampleRate });
        }
        return id;
    }

    /** Start a voice; returns its id. `onEnded` fires when it finishes. */
    voice(spec, onEnded) {
        const id = this._nextId++;
        if (onEnded) this._onEnded.set(id, onEnded);
        this.send({ t: "voice", id, ...spec });
        return id;
    }

    /**
     * Resolves once the worklet has applied every message sent before this call.
     * Needed for OfflineAudioContext renders, which otherwise finish before messages land:
     * suspend the context at 0, send, `await host.sync()`, then resume.
     */
    sync() {
        return this.ready.then(() => new Promise((resolve) => {
            const n = ++this._pingN;
            this._pings.set(n, resolve);
            this.send({ t: "ping", n });
        }));
    }

    /**
     * Send a parsed SoundFont (ActionSynthesizer after init()) to the worklet: the Int16
     * sample arrays (copied, the node synth keeps its own) and compact zone tables.
     */
    loadSoundFont(synth) {
        const samples = synth.parser.sample;
        const index = new Map(samples.map((smp, i) => [smp, i]));
        const banks = [];
        synth.bankSet.forEach((bank, b) => {
            if (!bank) return;
            banks[b] = [];
            bank.forEach((preset, p) => {
                if (!preset) return;
                const keys = [];
                for (let k = 0; k < 128; k++) {
                    const z = preset[k];
                    if (!z || !z.sample) continue;
                    keys[k] = { s: index.get(z.sample), rate: z.sampleRate, modes: z.sampleModes, base: z.basePlaybackRate,
                                start: z.start, end: z.end, ls: z.loopStart, le: z.loopEnd,
                                att: z.volAttack, dec: z.volDecay, sus: z.volSustain, rel: z.volRelease,
                                atten: z.initialAttenuation, fc: z.initialFilterFc, q: z.initialFilterQ, pan: z.pan };
                }
                banks[b][p] = keys;
            });
        });
        this.send({ t: "sfLoad", samples, banks });
        this._sfLoaded = true;
    }

    /** MIDI channel event: op "on" | "off" | "program" | "bank" | "volume" | ... (see protocol). */
    midi(op, ch, fields = {}, at = 0) { this.send({ t: "midi", op, ch, at, ...fields }); }

    stop(id, fade = 0.05) { this.send({ t: "stop", id, fade }); }
    setGain(id, value) { this.send({ t: "gain", id, value }); }
    stopAll(fade = 0.05) { this.send({ t: "stopAll", fade }); }
}

window.ActionAudioWorkletModule = ActionAudioWorkletModule;
window.ActionAudioWorkletHost = ActionAudioWorkletHost;
