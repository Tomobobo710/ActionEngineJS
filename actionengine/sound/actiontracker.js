//actionengine/sound/actiontracker.js
//
// ActionTracker — a chiptune tracker you author as plain data.
//
// A song is an object, not a script. There is no DSL and no parser: the grid below
// IS the format, and the engine reads it directly. Playback runs on a real tracker
// tick clock (speed ticks per row, tempo in BPM) against the audio clock via a
// lookahead scheduler, so it is sample-tight instead of drifting.
//
//   const song = {
//     bpm: 125,                       // tempo (Fxx >= 0x20 changes it live)
//     speed: 6,                       // ticks per row   (Fxx < 0x20 changes it live)
//     rowsPerBeat: 4,                 // 4 rows/beat = 16th-note grid
//     instruments: {
//       lead: { wave: "pulse", duty: 0.5, adsr: [0.01, 0.10, 0.6, 0.08], gain: 0.5 },
//       bass: { wave: "triangle", adsr: [0.01, 0.20, 0.8, 0.10], gain: 0.6 },
//       hat:  { wave: "noise", filter: { type: "highpass", frequency: 7000 },
//               adsr: [0.001, 0.04, 0.0, 0.03], gain: 0.3 },
//     },
//     channels: ["lead", "bass", "hat"],   // one column per voice; string = default inst
//     patterns: {
//       A: [                            // array of rows; each row = one cell per channel
//         ["C-5 407", "C-3", "hat"],     // cell: "NOTE [inst] [effect]"
//         [null,      null,   null],     // null/"" = empty (previous note keeps ringing)
//         ["E-5",     null,   "hat"],
//         ["OFF",     null,   null],     // "OFF" = release the ringing note
//       ],
//     },
//     order: ["A", "A"],                // playlist of pattern keys
//     loop: 0,                          // order index to loop back to (false = no loop)
//   };
//   tracker.play(song);
//
// A cell is either a string or an object:
//   string: "C-5", "C-5 lead", "C-5 lead 4A2", "C-5 4A2", "--- A04", "OFF"
//           note tokens: C-5 / C#5 / Db4 / MIDI number / OFF / --- (no note)
//           trailing 3-char hex token = effect column (see below)
//   object: { note: "C-5", inst: "lead", fx: "4A2", vol: 0.8, len: 2, slide: -12,
//             vib: {rate:6,depth:30}, arp: [0,4,7] }
//     note  — note string or MIDI number; "OFF"/"K" releases; null/"" is empty
//     inst  — instrument key (defaults to the channel's instrument)
//     fx    — effect string "XYZ" or array ["A04", "4A2"] (processed in order)
//     vol   — 0..1 note volume (sets the channel volume, like Cxx but normalized)
//     len   — gate length in rows, then auto-release (default: ring until next note/OFF)
//     slide — semitones to glide to over the gate (great for lasers/kicks)
//     vib   — vibrato: rate in Hz, depth in cents (overrides instrument vibrato)
//     arp   — semitone offsets cycled per tick (overrides 0xx and instrument arp)
//
// EFFECT COLUMN — classic ProTracker / FastTracker II hex commands (XYZ):
//   0xy  arpeggio: cycle base/+x/+y semitones each tick
//   1xx  portamento up   (xx/64 semitones per tick)
//   2xx  portamento down
//   3xx  tone portamento: glide to the new note at xx/64 semitones per tick
//   4xy  vibrato: rate x*2 Hz, depth y*12 cents (000 keeps previous settings)
//   5xy  tone porta (3xx target) + volume slide
//   6xy  vibrato + volume slide
//   7xy  tremolo: rate x*2 Hz, depth y/16
//   8xx  set pan: 00=left, 80=center, FF=right
//   Axy  volume slide: +x/64 up or -y/64 down per tick
//   Bxx  position jump: go to order index xx
//   Cxx  set volume: xx/64 (0..1)
//   Dxy  pattern break: next pattern, row x*10+y (decimal digits)
//   E1x  fine portamento up   (x/16 semitone, once)
//   E2x  fine portamento down
//   E6x  pattern loop: x=0 marks loop start; x>0 jumps back x times
//   E9x  retrigger note every x ticks
//   EAx  fine volume slide up   (+x/64, once)
//   EBx  fine volume slide down
//   ECx  note cut at tick x
//   EDx  note delay: trigger the note x ticks into the row
//   EEx  pattern delay: hold the current row for x extra rows
//   Fxx  speed (xx < 0x20) or tempo/BPM (xx >= 0x20)
//   Kxx  key off (release envelope; same as "OFF")
//   Pxy  pan slide: +x right / -y left per tick (64 units = full scale)
//   Rxy  retrigger every y ticks with volume slide x (0 none, 1-8 down, 9-F up)
//   Txy  tremor: x+1 ticks on, y+1 ticks off, repeating
//   9xx  sample offset: soundfont notes start xx*256 samples in (900 = last)
//   E3x  glissando (tone porta in semitones)   E4x / E7x  vibrato / tremolo waveform
//   E5x  finetune (1/8 semitones)             Gxx / Hxy  global volume / global volume slide
//   X1x / X2x  extra-fine portamento up / down (x/64 semitone)
//
// Instruments are where the character lives. Beyond wave/duty/adsr/gain/filter/pan:
//   sf2:      0..127 | "drums"             // play via the attached ActionSoundFont
//             (tracker.setSoundFont) instead of the synth; GM program number,
//             "drums" = percussion kit. gain scales velocity; bank optional.
//             drums default to the Standard kit; kit: n picks another (8 Room,
//             16 Power, 24 Electronic, 25 TR-808, 32 Jazz, 40 Brush, 48 Orchestra).
//             ring: n = cymbal ring-out seconds (default 3, fades immediately).
//             note: ["C-4","E-4","G-4"] chords play polyphonically on sf2 channels.
//   unison:   { voices: 3, detune: 20 }   // stacked detuned oscillators = fat lead/pad
//   drive:    0..1                        // waveshaper grit (acid bass, hot lead)
//   filterEnv:{ amount: 3000, adsr:[a,d,s,r] } // cutoff sweep around filter.frequency
//   pitchEnv: { amount: 24, decay: 0.08 } // start +N semitones, drop to pitch (kicks/lasers)
//   vibrato:  { rate: 6, depth: 25, delay: 0.1 } // auto vibrato (delay before onset)
//   arp:      { notes: [0,4,7], speed: 1 } // auto arpeggio, speed = rows per step
//   tremolo:  { rate: 8, depth: 0.4 }     // amplitude wobble
//   glide:    0.08                        // portamento seconds from the channel's last note
//   nna:      "cut"|"continue"|"off"|"fade" // New Note Action: what the old note does when a new one starts
//   send:     0..1                        // into song.delay (also per channel: { inst, send })
//   volumeEnv:{ points:[[tick,level],...], sustain, loop:[a,b], fadeout } // XM-style,
//             level 0..1, ticks relative to note start; overrides adsr when present
//   panEnv:   { points:[[tick,pan],...], sustain, loop:[a,b] } // panning envelope,
//             pan -1..1, interpolated per tick; adds to channel pan
// A cell's slide/vib/arp/fx override the instrument's behavior for that note.
//
// VOLUME COLUMN (FT2-style) — a second command slot independent of the effect column:
//   object: { note:"C-5", vcol:"70" }   string: "C-5 V70" or "C-5 V70 432"
//   00-40  set volume (val/64)          50     set panning (val/255 mapped to -1..1)
//   60-6F  volume slide down per tick   70-7F  volume slide up per tick
//   80-8F  fine volume slide down       90-9F  fine volume slide up
//   A0-AF  vibrato speed                B0-BF  vibrato depth
//   C0-CF  pan slide left               D0-DF  pan slide right
//   E0-EF  tone portamento speed
//   Volume column slides stack with effect column slides. Vibrato/porta share state.
//
// MUTE / SOLO — handle.setMute(channelIndex, bool), handle.setSolo(channelIndex, bool).
//   When any channel is soloed, only soloed channels produce sound.

const ACTION_NOTE_OFFSETS = {
    C: 0, "C#": 1, DB: 1, D: 2, "D#": 3, EB: 3, E: 4, F: 5,
    "F#": 6, GB: 6, G: 7, "G#": 8, AB: 8, A: 9, "A#": 10, BB: 10, B: 11
};

class ActionTracker {
    static NOTE_OFFSETS = {
        C: 0, "C#": 1, DB: 1, D: 2, "D#": 3, EB: 3, E: 4, F: 5,
        "F#": 6, GB: 6, G: 7, "G#": 8, AB: 8, A: 9, "A#": 10, BB: 10, B: 11
    };

    constructor(context, destination) {
        this.context = context;
        this.output = context.createGain();
        this.output.gain.value = 1;
        this.output.connect(destination || context.destination);

        this.lookahead = 0.12; // seconds scheduled ahead of the audio clock
        // SF2 noteOn/noteOff are real-time calls, so songs that use sf2 channels
        // keep a tighter horizon; pure-synth songs keep the full lookahead.
        this.sf2Lookahead = 0.12;  // sf2 notes are scheduled on the audio clock now, same horizon as synth
        this.tickMs = 25; // scheduler wake-up interval
        this._noise = null;
        this._pulseCache = new Map();
        this._handles = new Set();
        this.soundFont = null;
        this.worklet = null;           // ActionAudioWorkletHost, see attachWorklet()
        this._wHandles = new Map();
    }

    // Run songs on the audio-thread engine: the sequencer itself then lives in the
    // AudioWorklet (same code, see actionaudioworklet.js), so nothing on the page can make
    // a note late, and no lookahead is needed. The worklet's tracker output feeds
    // this.output, so setVolume() and anything tapping this.output keep working.
    attachWorklet(host) {
        if (!host || this.worklet === host) return;
        this.worklet = host;
        host.onTracker = (m) => this._onWorkletMessage(m);
        host.ready.then(() => {
            if (host.node) host.node.connect(this.output, 1, 0);
            if (this.soundFont) this._workletSoundFont(true);
        }, () => {});
    }

    _useWorklet() {
        return !!(this.worklet && !this.worklet.failed);
    }

    _workletSoundFont(on) {
        const host = this.worklet;
        if (!host || !host._sfLoaded) return;
        host.send({ t: "trk", op: "sf", value: on });
        host.send({ t: "sfBus", value: on });   // the node synth is routed into this.output too
    }

    // Attach an ActionSoundFont player. Instruments with { sf2: program } route
    // their notes to it; everything else stays on the oscillator synth.
    setSoundFont(sf) {
        this.soundFont = sf;
        if (this._useWorklet()) this._workletSoundFont(!!sf);
        // Node routing only for a synth on this tracker's context (an offline render hands
        // the live synth over just for its sample data - leave its wiring alone).
        if (sf && sf.synth && sf.synth.gainMaster && sf.synth.ctx === this.context) {
            try { sf.synth.gainMaster.disconnect(); } catch (e) {}
            sf.synth.gainMaster.connect(this.output);
        }
    }

    static noteToMidi(note) {
        if (typeof note === "number") return note;
        const m = String(note).trim().match(/^([A-Ga-g])([#b]?)[- ]?(\d+)$/);
        if (!m) return null;
        const letter = m[1].toUpperCase();
        const accidental = m[2] === "#" ? "#" : m[2] ? "b" : "";
        const key = (letter + accidental).toUpperCase();
        const offset = ActionTracker.NOTE_OFFSETS[key];
        if (offset === undefined) return null;
        return (parseInt(m[3], 10) + 1) * 12 + offset;
    }

    static midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    static topMidi(midi) {
        return Array.isArray(midi) ? Math.max(...midi) : midi;
    }

    // Play a song object. Returns a transport handle: stop/pause/resume/setVolume.
    play(song, options = {}) {
        if (this._useWorklet()) {
            const handle = this._playWorklet(song, options);
            if (handle) return handle;
        }
        const normalized = this._normalize(song);
        const handle = this._createHandle(normalized, options);
        this._handles.add(handle);
        handle._start();
        return handle;
    }

    // One-shot sound effect. Accepts a tiny song, or a single voice spec:
    //   tracker.playSfx({ inst: {wave:"saw", adsr:[0.001,0.1,0,0.05]}, note:"A-5",
    //                     len: 1, slide: -24, vol: 0.6 })
    playSfx(spec, options = {}) {
        if (spec.patterns || spec.order) return this.play(spec, { ...options, loop: false });
        const inst = spec.inst || { wave: "sine", adsr: [0.005, 0.1, 0, 0.05] };
        const song = {
            bpm: options.bpm || 120,
            rowsPerBeat: 1,
            instruments: { sfx: inst },
            channels: ["sfx"],
            patterns: { P: [[{ note: spec.note ?? 69, vol: spec.vol, len: spec.len ?? 1, slide: spec.slide, vib: spec.vib, arp: spec.arp, fx: spec.fx }]] },
            order: ["P"],
            loop: false
        };
        return this.play(song, { ...options, loop: false });
    }

    setVolume(value) {
        this.output.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.context.currentTime, 0.02);
    }

    stopAll() {
        for (const handle of [...this._handles]) handle.stop();
    }

    // ---- audio-thread playback: a handle that mirrors the worklet's ----

    _playWorklet(song, options) {
        const host = this.worklet, ctx = this.context, tracker = this;
        const hid = host._nextId++;
        const order = song.order && song.order.length ? song.order : Object.keys(song.patterns || {});
        const startOrder = Math.max(0, Math.min(order.length - 1, options.startOrder | 0));
        const handle = {
            engine: "worklet",
            isPlaying: true,
            isPaused: false,
            _hid: hid,
            _song: song,
            // The worklet owns the channel state; this mirrors mute/solo for UIs that read it.
            _channels: (song.channels || []).map(() => ({ muted: false, solo: false })),
            _posQueue: [],
            _pos: { time: 0, order: startOrder, row: Math.max(0, options.startRow | 0), pattern: order[startOrder], td: 0 },
            onEnd: options.onEnd || null,
            onRow: options.onRow || null
        };
        // Rows arrive from the worklet as they play; `position` is what is heard now.
        Object.defineProperty(handle, "position", {
            get: () => {
                const now = ctx.currentTime;
                const q = handle._posQueue;
                while (q.length && q[0].time <= now) handle._pos = q.shift();
                const p = handle._pos;
                const tick = p.td > 0 ? Math.min(31, Math.max(0, Math.floor((now - p.time) / p.td))) : 0;
                return { order: p.order, row: p.row, pattern: p.pattern, tick };
            }
        });
        Object.defineProperty(handle, "orderIndex", { get: () => handle._pos.order });
        Object.defineProperty(handle, "row", { get: () => handle._pos.row });
        const send = (op, extra) => host.send({ t: "trk", op, hid, ...extra });
        handle.stop = () => {
            if (!handle.isPlaying && !handle.isPaused) return;
            handle.isPlaying = false;
            handle.isPaused = false;
            send("stop");
            tracker._handles.delete(handle);
            tracker._wHandles.delete(hid);
        };
        handle.pause = () => {
            if (!handle.isPlaying || handle.isPaused) return;
            handle.isPaused = true;
            send("pause");
        };
        handle.resume = () => {
            if (!handle.isPaused) return;
            handle.isPaused = false;
            handle._posQueue.length = 0;
            send("resume");
        };
        handle.setVolume = (v) => send("volume", { value: v });
        handle.setMute = (i, muted) => { if (handle._channels[i]) handle._channels[i].muted = !!muted; send("mute", { i, value: !!muted }); };
        handle.setSolo = (i, solo) => { if (handle._channels[i]) handle._channels[i].solo = !!solo; send("solo", { i, value: !!solo }); };

        const opts = { volume: options.volume ?? 1, loop: options.loop, startOrder: options.startOrder | 0, startRow: options.startRow | 0 };
        try {
            host.send({ t: "trk", op: "play", hid, song, opts, at: options.at ?? ctx.currentTime + 0.03 });
        } catch (e) {
            console.warn("[ActionTracker] song could not be sent to the audio thread, using the node engine:", e && e.message ? e.message : e);
            return null;
        }
        this._handles.add(handle);
        this._wHandles.set(hid, handle);
        return handle;
    }

    _onWorkletMessage(m) {
        const h = this._wHandles.get(m.hid);
        if (!h) return;
        if (m.t === "trkRow") {
            h._posQueue.push({ time: m.time, order: m.order, row: m.row, pattern: m.pattern, td: m.td });
            if (h._posQueue.length > 256) h._posQueue.shift();
            if (h.onRow) h.onRow(m.order, m.row, m.time);
        } else if (m.t === "trkEnd") {
            h.isPlaying = false;
            this._handles.delete(h);
            this._wHandles.delete(m.hid);
            if (h.onEnd) setTimeout(() => h.onEnd(), Math.max(0, m.endTime - this.context.currentTime) * 1000 + 500);
        }
    }

    /**
     * Length of one pass through the song in seconds (tempo/speed changes, jumps, pattern
     * loops and delays included), without playing it. Looping songs count one pass;
     * a song that jumps back forever is capped at `maxSeconds`.
     */
    songDuration(song, options = {}, maxSeconds = 1800) {
        const s = this._normalize(song);
        const state = this._initState(s, options);
        const h = {
            _song: s, _state: state, _nextTime: 0, _done: false,
            _channels: s.channels.map((cfg) => ({ cfg }))
        };
        h._endOfOrder = () => { h._done = true; };
        while (!h._done && h._nextTime < maxSeconds) {
            if (state.tick === 0 && !state.replay) {
                const cells = (s.patterns[s.order[state.orderIndex]] || [])[state.row] || [];
                this._sequencerFx(h._channels.map((c, i) => this._parseCell(cells[i], c.cfg, s.instruments)), state);
            }
            this._advanceTick(h);
        }
        return h._nextTime;
    }

    // ---- internals ----

    _normalize(song) {
        const channels = (song.channels || []).map((c) =>
            typeof c === "string" ? { inst: c, gain: 1, pan: 0 } : { gain: 1, pan: 0, ...c }
        );
        return {
            speed: Math.max(1, song.speed || 6),
            bpm: song.bpm || song.tempo || 125,
            rowsPerBeat: song.rowsPerBeat || 4,
            instruments: song.instruments || {},
            channels,
            patterns: song.patterns || {},
            order: song.order && song.order.length ? song.order : Object.keys(song.patterns || {}),
            loop: song.loop === undefined ? false : song.loop,
            swing: ActionTracker._normalizeSwing(song.swing),
            delay: ActionTracker._normalizeDelay(song.delay),
            delay2: ActionTracker._normalizeDelay(song.delay2)
        };
    }

    // song.delay: a real tempo-synced echo that channels send into.
    //   time      delay in rows (follows the tempo, Fxx included)        default 3 (dotted 8th)
    //   feedback  0..0.9, how much of each repeat comes back                default 0.35
    //   tone      lowpass (Hz) on every pass, so repeats darken like tape   default 3000
    //   pingpong  repeats alternate left / right: true or "left" (first repeat on
    //             the left), "right" (first on the right), false (each side echoes itself)
    //   level     wet level                                                  default 1
    // Channels choose how much they send: channel { send: 0..1 } (default 0), or an
    // instrument's own `send`, which wins for its notes. Mute/solo apply to the send.
    // song.delay2: an optional second echo (same fields, its own time) for a part that
    // wants a different echo than the rest - e.g. a tight slapback. Sends: `send2`.
    // Wxx re-times only the first echo.
    static _normalizeDelay(d) {
        if (!d) return null;
        const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
        return {
            time: clamp(d.time ?? 3, 0.25, 64),
            feedback: clamp(d.feedback ?? 0.35, 0, 0.9),
            tone: clamp(d.tone ?? 3000, 200, 16000),
            pingpong: d.pingpong === false ? false : d.pingpong === "right" ? "right" : "left",
            level: Math.max(0, d.level ?? 1)
        };
    }

    _delaySeconds(song, state, which = 1) {
        const rows = which === 2 ? song.delay2.time : (state.delayRows ?? song.delay.time);
        return Math.min(3.9, (rows * 60) / state.tempo / song.rowsPerBeat);
    }

    _sendFor(c, inst, which = 1) {
        const k = which === 2 ? "send2" : "send";
        return Math.max(0, Math.min(1, (inst && inst[k]) ?? c.cfg[k] ?? 0));
    }

    // How long the echo keeps ringing after the last note (until repeats fall ~60 dB).
    _delayTail(song) {
        const tail = (d, which) => {
            if (!d) return 0;
            const repeats = Math.log(0.001) / Math.log(Math.max(0.01, d.feedback));
            return Math.min(6, repeats * this._delaySeconds(song, { tempo: song.bpm }, which));
        };
        return Math.max(tail(song.delay, 1), tail(song.delay2, 2));
    }

    // Node engine: ping-pong delay graph. input -> delay -> tone lowpass -> out, and back
    // round through `feedback` (to the other side when ping-ponging). Mirrors the
    // audio-thread delay in actionaudioworklet.js.
    _makeNodeDelay(song, dest, d = song.delay) {
        const ctx = this.context;
        const side = () => {
            const dl = ctx.createDelay(4);
            const lp = ctx.createBiquadFilter();
            lp.type = "lowpass";
            lp.frequency.value = d.tone;
            lp.Q.value = -3.01;                      // no resonance bump (Butterworth)
            const fb = ctx.createGain();
            fb.gain.value = d.feedback;
            dl.connect(lp);
            lp.connect(fb);
            return { dl, lp, fb };
        };
        const input = ctx.createGain();
        const L = side(), R = side();
        const merger = ctx.createChannelMerger(2);
        const wet = ctx.createGain();
        wet.gain.value = d.level;
        const nodes = [input, L.dl, L.lp, L.fb, R.dl, R.lp, R.fb, merger, wet];
        if (d.pingpong) {
            const mono = ctx.createGain();           // (L + R) / 2 into the left line
            mono.channelCount = 1;
            mono.channelCountMode = "explicit";
            input.connect(mono);
            mono.connect(d.pingpong === "right" ? R.dl : L.dl);      // first repeat on that side
            L.fb.connect(R.dl);
            R.fb.connect(L.dl);
            nodes.push(mono);
        } else {
            const split = ctx.createChannelSplitter(2);
            input.connect(split);
            split.connect(L.dl, 0);
            split.connect(R.dl, 1);
            L.fb.connect(L.dl);
            R.fb.connect(R.dl);
            nodes.push(split);
        }
        L.lp.connect(merger, 0, 0);
        R.lp.connect(merger, 0, 1);
        merger.connect(wet);
        wet.connect(dest);
        return {
            input,
            setTime: (sec, at) => [L.dl, R.dl].forEach((dl) => dl.delayTime.setTargetAtTime(sec, at, 0.05)),
            disconnect: () => nodes.forEach((n) => { try { n.disconnect(); } catch (e) {} })
        };
    }

    _setDelayTime(handle, time) {
        const first = !handle._delayTimed;
        const at = first ? Math.max(0, time - 0.2) : time;        // settle before the first note
        if (handle._delay) handle._delay.setTime(this._delaySeconds(handle._song, handle._state), at);
        if (handle._delay2) handle._delay2.setTime(this._delaySeconds(handle._song, handle._state, 2), at);
        handle._delayTimed = true;
    }

    // song.swing: a number (rows of delay on the off-16ths) or { amount, unit }, where
    // unit is the swung step in rows (1 = 16ths, 2 = 8ths at rowsPerBeat 4) and amount
    // is how late the off-beat lands, in rows (0.5 = half a row; 0 = straight).
    static _normalizeSwing(swing) {
        if (!swing) return null;
        const s = typeof swing === "number" ? { amount: swing, unit: 1 } : swing;
        const unit = Math.max(1, Math.round(s.unit || 1));
        const amount = Math.max(0, Math.min(0.95, s.amount || 0));   // one row absorbs it, so < 1 row
        return amount > 0 ? { amount, unit } : null;
    }

    _createHandle(song, options) {
        const tracker = this;
        const ctx = this.context;
        const volume = options.volume ?? 1;
        const songLoop = options.loop === undefined ? song.loop : options.loop;

        const state = tracker._initState(song, options);
        const tickDur = () => tracker._tickDur(song, state);

        const handle = {
            isPlaying: false,
            isPaused: false,
            _state: state,
            _posQueue: [],                    // scheduled rows, {time, order, row, pattern, td}
            _pos: { time: 0, order: state.orderIndex, row: state.row, pattern: song.order[state.orderIndex], td: 0 },
            _sf2Timers: new Set(),            // pending soundfont note on/off timeouts
            _song: song,
            _channels: song.channels.map((cfg) => tracker._newChannelState(cfg)),
            _gain: null,
            _timer: null,
            _nextTime: 0,
            onEnd: options.onEnd || null,
            onRow: options.onRow || null
        };

        // `position` is what is being HEARD now, not what the scheduler has reached:
        // with a long lookahead the scheduler runs ahead of the audio clock.
        Object.defineProperty(handle, "position", {
            get: () => {
                const now = ctx.currentTime;
                const q = handle._posQueue;
                while (q.length && q[0].time <= now) handle._pos = q.shift();
                const p = handle._pos;
                const tick = p.td > 0 ? Math.min(state.speed - 1, Math.max(0, Math.floor((now - p.time) / p.td))) : 0;
                return { order: p.order, row: p.row, pattern: p.pattern, tick };
            }
        });
        Object.defineProperty(handle, "orderIndex", { get: () => state.orderIndex });
        Object.defineProperty(handle, "row", { get: () => state.row });

        handle._start = () => {
            if (handle.isPlaying) return;
            handle._gain = ctx.createGain();
            handle._gain.gain.value = volume;
            handle._gain.connect(tracker.output);
            // Each channel gets its own bus so mute/solo act instantly, even on notes the
            // scheduler has already queued ahead of the audio clock.
            // song.delay: one echo per playback, after the handle gain's input so stop and
            // setVolume act on the tails too.
            handle._delay = song.delay ? tracker._makeNodeDelay(song, handle._gain) : null;
            handle._delay2 = song.delay2 ? tracker._makeNodeDelay(song, handle._gain, song.delay2) : null;
            handle._channels.forEach((c) => {
                c.bus = ctx.createGain();
                c.bus.connect(handle._gain);
                c.dest = c.bus;
                c.handle = handle;
                if (handle._delay) {
                    c.send = ctx.createGain();
                    c.send.gain.value = tracker._sendFor(c, song.instruments[c.cfg.inst]);
                    c.bus.connect(c.send);
                    c.send.connect(handle._delay.input);
                }
                if (handle._delay2) {
                    c.send2 = ctx.createGain();
                    c.send2.gain.value = tracker._sendFor(c, song.instruments[c.cfg.inst], 2);
                    c.bus.connect(c.send2);
                    c.send2.connect(handle._delay2.input);
                }
            });
            tracker._allocSf2Channels(handle._channels, song);
            syncAudibility();
            // options.lookahead (seconds) is an OPT-IN for music players: schedule further
            // ahead so main-thread stalls (UI, game logic, GC) can't make notes late.
            // It never delays the start of playback, and stop/mute/volume stay instant.
            // Leave it unset for anything that must react quickly.
            handle._lookahead = options.lookahead !== undefined
                ? Math.max(0.02, options.lookahead)
                : handle._channels.some((c) => c.sf2)
                    ? Math.min(tracker.lookahead, tracker.sf2Lookahead)
                    : tracker.lookahead;
            handle.isPlaying = true;
            handle.isPaused = false;
            handle._nextTime = ctx.currentTime + 0.06;
            handle._timer = setInterval(() => handle._pump(), tracker.tickMs);
            handle._pump();
        };

        handle._pump = () => {
            if (!handle.isPlaying || handle.isPaused) return;
            let guard = 0;
            while (handle._nextTime < ctx.currentTime + handle._lookahead && guard++ < 512) {
                handle._processTick(handle._nextTime);
                handle._advanceTick();
                if (!handle.isPlaying) break;
            }
        };

        handle._processTick = (time) => tracker._processTick(handle, time);
        handle._advanceTick = () => tracker._advanceTick(handle);

        handle._endOfOrder = () => {
            if (songLoop !== false && songLoop !== null && songLoop !== undefined) {
                state.orderIndex = typeof songLoop === "number"
                    ? Math.max(0, Math.min(songLoop, song.order.length - 1))
                    : 0;
                state.row = 0;
                state.loopStart = {};
                state.loopCount = {};
            } else {
                handle._finish();
            }
        };

        handle._finish = () => {
            const endTime = handle._nextTime;
            handle._channels.forEach((c) => {
                if (c.voice && c.voice.sf2) tracker._sf2NoteOff(c, endTime);
                else if (c.voice) tracker._stopVoice(c.voice, endTime, 0.15);
                c.voice = null;
                tracker._stopBackground(c, endTime, 0.15);
            });
            handle.isPlaying = false;
            clearInterval(handle._timer);
            handle._timer = null;
            const g = handle._gain;
            const tail = tracker._delayTail(song);                 // let the echo ring out
            if (g) g.gain.setTargetAtTime(0, endTime + 0.4 + tail, 0.1);
            tracker._handles.delete(handle);
            if (handle._sf2Sends) {
                const sends = handle._sf2Sends;
                setTimeout(() => sends.forEach((s) => { try { s.disconnect(); } catch (e) {} }),
                    Math.max(0, endTime - ctx.currentTime + tail + 1) * 1000);
            }
            if (handle.onEnd) {
                const ms = Math.max(0, endTime - ctx.currentTime) * 1000 + 500;
                setTimeout(() => handle.onEnd(), ms);
            }
        };

        handle.stop = () => {
            if (!handle.isPlaying && !handle.isPaused) return;
            handle._halted = true;
            const t = ctx.currentTime;
            handle._sf2Timers.forEach((id) => clearTimeout(id));
            handle._sf2Timers.clear();
            tracker._sf2ReleaseAll(handle);
            handle._channels.forEach((c) => {
                if (c.voice && !c.voice.sf2) tracker._stopVoice(c.voice, t, 0.03);
                c.voice = null;
                tracker._stopBackground(c, t, 0.03);
            });
            handle.isPlaying = false;
            handle.isPaused = false;
            clearInterval(handle._timer);
            handle._timer = null;
            if (handle._gain) handle._gain.gain.setTargetAtTime(0, t, 0.02);
            // The soundfont synth outlives this playback: unhook its channels from our echo.
            if (handle._sf2Sends) handle._sf2Sends.forEach((s) => { try { s.disconnect(); } catch (e) {} });
            tracker._handles.delete(handle);
        };

        handle.pause = () => {
            if (!handle.isPlaying || handle.isPaused) return;
            handle.isPaused = true;
            handle._halted = true;
            clearInterval(handle._timer);
            handle._timer = null;
            const t = ctx.currentTime;
            handle._sf2Timers.forEach((id) => clearTimeout(id));
            handle._sf2Timers.clear();
            tracker._sf2ReleaseAll(handle);
            handle._channels.forEach((c) => {
                if (c.voice && !c.voice.sf2) tracker._stopVoice(c.voice, t, 0.03);
                c.voice = null;
                tracker._stopBackground(c, t, 0.03);
            });
            if (handle._gain) handle._gain.gain.setTargetAtTime(0, t, 0.02);
        };

        handle.resume = () => {
            if (!handle.isPaused) return;
            handle.isPaused = false;
            handle._halted = false;
            handle._posQueue.length = 0;
            if (handle._gain) handle._gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
            handle._nextTime = ctx.currentTime + 0.06;
            state.tick = 0;
            handle._timer = setInterval(() => handle._pump(), tracker.tickMs);
            handle._pump();
        };

        handle.setVolume = (v) => {
            if (handle._gain) handle._gain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.02);
        };

        const syncAudibility = () => {
            const anySolo = handle._channels.some((ch) => ch.solo);
            const now = ctx.currentTime;
            handle._channels.forEach((ch) => {
                const audible = !ch.muted && (!anySolo || ch.solo);
                if (ch.sf2) {
                    // Channel gain sits after every note node (release tails,
                    // ring-outs, reverb included), so it silences all of it. A
                    // MIDI channel shared by several tracker channels (drums) stays
                    // open while any of them is audible; the per-note expression
                    // gain in the tick loop silences the muted ones.
                    const shared = handle._channels.filter((o) => o.sf2 && o.sf2.ch === ch.sf2.ch);
                    const open = shared.some((o) => !o.muted && (!anySolo || o.solo));
                    tracker.soundFont.synth.setChannelGain(ch.sf2.ch, open ? ch.sf2.level ?? 1 : 0);
                } else if (ch.bus) {
                    const g = ch.bus.gain;
                    g.cancelScheduledValues(now);
                    g.setTargetAtTime(audible ? 1 : 0, now, 0.004);
                }
            });
        };

        handle.setMute = (i, muted) => {
            if (handle._channels[i]) handle._channels[i].muted = !!muted;
            syncAudibility();
        };

        handle.setSolo = (i, solo) => {
            if (handle._channels[i]) handle._channels[i].solo = !!solo;
            syncAudibility();
        };

        return handle;
    }

    // ---- sequencing (shared with the audio-thread tracker) ----

    _tickDur(song, state) {
        const base = 60 / state.tempo / song.rowsPerBeat / state.speed;
        return song.swing ? base * this._swingFactor(song.swing, state.row) : base;
    }

    // Swing: in every pair of `unit`-row steps, the last row of the first step is
    // stretched and the last row of the second shortened by the same amount, so the
    // off-beat lands `amount` rows late and each pair keeps its length (bar lines and
    // song length don't move). Counted from the start of the pattern.
    _swingFactor(swing, row) {
        const u = swing.unit, pos = row % (2 * u);
        if (pos === u - 1) return 1 + swing.amount;
        if (pos === 2 * u - 1) return 1 - swing.amount;
        return 1;
    }

    // Transport state; options.startOrder / startRow begin mid-song, with the tempo and
    // speed changes (Fxx) before that point replayed so the song is at the right tempo.
    _initState(song, options) {
        const state = {
            tempo: song.bpm,
            speed: song.speed,
            orderIndex: 0,
            row: 0,
            tick: 0,
            patternDelay: 0,
            replay: false,
            loopStart: {},
            loopCount: {},
            loopJump: null,
            jumpTo: null,
            breakTo: null,
            globalVol: 1,            // Gxx (0..1)
            gvSlide: 0,              // Hxy, per tick
            delayRows: null          // Wxx: echo time in rows (null = song.delay.time)
        };
        const startOrder = Math.max(0, Math.min(song.order.length - 1, options.startOrder | 0));
        const startRow = Math.max(0, options.startRow | 0);
        if (startOrder > 0 || startRow > 0) {
            const cfgs = song.channels;
            const scan = (key, rows) => {
                const pattern = song.patterns[key] || [];
                for (let r = 0; r < Math.min(rows, pattern.length); r++) {
                    (pattern[r] || []).forEach((cell, i) => {
                        const parsed = cell ? this._parseCell(cell, cfgs[i] || {}, song.instruments) : null;
                        if (!parsed) return;
                        parsed.fx.forEach((fx) => {
                            if (fx.cmd === "G") { state.globalVol = Math.min(64, fx.val) / 64; return; }
                            if (fx.cmd === "W") { if (fx.val) state.delayRows = fx.val; return; }
                            if (fx.cmd !== "F" || fx.val === 0) return;
                            if (fx.val < 0x20) state.speed = fx.val; else state.tempo = fx.val;
                        });
                    });
                }
            };
            for (let o = 0; o < startOrder; o++) scan(song.order[o], Infinity);
            scan(song.order[startOrder], startRow);
            state.orderIndex = startOrder;
            state.row = Math.min(startRow, Math.max(0, (song.patterns[song.order[startOrder]] || []).length - 1));
        }
        return state;
    }

    _processTick(handle, time) {
        const song = handle._song, state = handle._state;
        const tickDur = () => this._tickDur(song, state);
        const key = song.order[state.orderIndex];
        const pattern = song.patterns[key] || [];
        const cells = pattern[state.row] || [];
        // The echo follows the tempo (first tick, after every Fxx tempo change) and Wxx.
        const delayKey = state.tempo + "/" + state.delayRows;
        if ((handle._delay || handle._delay2) && handle._delayTempo !== delayKey) {
            handle._delayTempo = delayKey;
            this._setDelayTime(handle, time);
        }
        if (state.tick === 0) {
            handle._posQueue.push({ time, order: state.orderIndex, row: state.row, pattern: key, td: tickDur() });
            handle.onRow && handle.onRow(state.orderIndex, state.row, time);
            // EEx replays hold the row without retriggering notes or effects.
            if (!state.replay) {
                const parsed = handle._channels.map((c, i) =>
                    this._parseCell(cells[i], c.cfg, song.instruments)
                );
                this._sequencerFx(parsed, state);
                handle._channels.forEach((c, i) => this._rowTick(c, parsed[i], time, song, state));
            }
        }
        if (state.gvSlide) state.globalVol = Math.max(0, Math.min(1, state.globalVol + state.gvSlide));
        handle._channels.forEach((c) => this._tickChannel(c, time, song, state, tickDur, handle._channels));
    }

    _advanceTick(handle) {
        const song = handle._song, state = handle._state;
        handle._nextTime += this._tickDur(song, state);
        state.tick++;
        if (state.tick < state.speed) return;
        state.tick = 0;

        if (state.patternDelay > 0) {
            state.patternDelay--;
            state.replay = true;
            return;
        }
        if (state.replay) state.replay = false;
        if (state.jumpTo !== null) {
            state.orderIndex = Math.max(0, Math.min(state.jumpTo, song.order.length - 1));
            state.row = 0;
            state.jumpTo = null;
            state.loopStart = {};
            state.loopCount = {};
            return;
        }
        if (state.breakTo !== null) {
            const breakRow = state.breakTo;
            state.breakTo = null;
            state.orderIndex++;
            state.loopStart = {};
            state.loopCount = {};
            if (state.orderIndex >= song.order.length) {
                handle._endOfOrder();
                return;
            }
            state.row = breakRow;
            const p = song.patterns[song.order[state.orderIndex]] || [];
            if (state.row >= p.length) state.row = 0;
            return;
        }
        if (state.loopJump !== null) {
            state.row = state.loopJump;
            state.loopJump = null;
            return;
        }
        state.row++;
        const pattern = song.patterns[song.order[state.orderIndex]] || [];
        if (state.row >= pattern.length) {
            state.row = 0;
            state.orderIndex++;
            state.loopStart = {};
            state.loopCount = {};
            if (state.orderIndex >= song.order.length) handle._endOfOrder();
        }
    }

    _newChannelState(cfg) {
        return {
            cfg,
            dest: null,
            voice: null,
            inst: cfg.inst,
            midi: null,
            baseFreq: 440,
            curFreq: 440,
            vol: 1,
            pan: cfg.pan ?? 0,
            noteTick: 0,
            gateTicks: null,
            portaTarget: null,
            portaSpeed: 0,
            slideUp: 0,
            slideDown: 0,
            vibRate: 0,
            vibDepth: 0,
            vibPos: 0,
            tremRate: 0,
            tremDepth: 0,
            tremPos: 0,
            arpNotes: null,
            arpFromFx: false,
            arpTickEvery: 1,
            volSlideUp: 0,
            volSlideDown: 0,
            panSlide: 0,
            vVolSlideUp: 0,
            vVolSlideDown: 0,
            vPanSlide: 0,
            retrigger: 0,
            retrigVol: 0,
            cutTick: null,
            delayTick: null,
            pendingCell: null,
            tremorOn: 0,
            tremorOff: 0,
            tremorPos: 0,
            glideFreq: null,
            vibWave: 0,              // E4x: 0 sine, 1 ramp down, 2 square, 3 random (+4: keep phase on new notes)
            tremWave: 0,             // E7x: same values
            gliss: false,            // E3x: tone portamento in whole semitones
            lastOffset: 0,           // 9xx memory (900 reuses it)
            noteOffset: 0,           // sample offset for the note being triggered (soundfont notes)
            bg: [],                  // NNA: earlier synth notes still sounding on this channel
            sfBgKeys: [],            // NNA "continue": earlier soundfont keys left ringing
            muted: false,
            solo: false
        };
    }

    // ---- cell & effect parsing ----

    _parseCell(cell, channel, instruments) {
        if (cell === null || cell === undefined || cell === "") return null;
        let note = null, inst = null, vol, len, slide, vib, arp, fxRaw = null, vcolRaw = null;
        if (typeof cell === "string") {
            const tokens = cell.trim().split(/\s+/);
            let i = 0;
            if (tokens[i] && this._parseEffect(tokens[i])) {
                fxRaw = tokens[i++];
            } else if (tokens[i] !== undefined) {
                note = tokens[i++];
            }
            while (i < tokens.length) {
                const t = tokens[i++];
                // Instrument names win over effects: "pad" is an instrument, not P a d.
                if (instruments[t]) inst = t;
                else if (/^[Vv][0-9A-Fa-f]{2}$/.test(t)) vcolRaw = t.slice(1);
                else if (this._parseEffect(t)) fxRaw = fxRaw ? (Array.isArray(fxRaw) ? [...fxRaw, t] : [fxRaw, t]) : t;
            }
        } else {
            note = cell.note;
            inst = cell.inst;
            vol = cell.vol;
            len = cell.len;
            slide = cell.slide;
            vib = cell.vib;
            arp = cell.arp;
            fxRaw = cell.fx;
            vcolRaw = cell.vcol;
        }

        const fx = [];
        if (fxRaw) {
            const list = Array.isArray(fxRaw) ? fxRaw : [fxRaw];
            list.forEach((s) => {
                const p = this._parseEffect(s);
                if (p) fx.push(p);
                else console.warn(`[ActionTracker] bad effect "${s}"`);
            });
        }

        let vcol = null;
        if (vcolRaw !== null && vcolRaw !== undefined) {
            const val = typeof vcolRaw === "number" ? vcolRaw : parseInt(vcolRaw, 16);
            if (!isNaN(val) && val >= 0 && val <= 255) vcol = val;
        }

        let off = false, midi = null;
        if (note !== null && note !== undefined) {
            if (Array.isArray(note)) {
                // Chord: soundfont channels play every note; synth channels take the top.
                const ms = note.map((n) => ActionTracker.noteToMidi(n)).filter((m) => m !== null);
                if (ms.length) midi = ms;
            } else {
                const n = String(note).toUpperCase();
                if (n === "OFF" || n === "==" || n === "K") off = true;
                else if (n !== "---" && n !== "...") midi = ActionTracker.noteToMidi(note);
            }
        }
        if (!off && midi === null && !inst && vol === undefined && !fx.length && vcol === null &&
            len === undefined && slide === undefined && !vib && !arp) return null;

        return {
            off,
            hasNote: midi !== null,
            midi,
            inst: inst || (midi !== null || off ? channel.inst : null),
            vol, len, slide, vib, arp, fx, vcol
        };
    }

    _parseEffect(str) {
        if (typeof str !== "string") return null;
        const m = str.trim().match(/^([0-9A-Za-z])([0-9A-Fa-f])([0-9A-Fa-f])$/);
        if (!m) return null;
        const x = parseInt(m[2], 16);
        const y = parseInt(m[3], 16);
        return { cmd: m[1].toUpperCase(), x, y, val: x * 16 + y };
    }

    // ---- sequencer-level effects (B/D/F/E6/EE), processed once per row ----

    _sequencerFx(parsed, state) {
        state.gvSlide = 0;                        // Hxy lasts one row, like the other slides
        parsed.forEach((cell) => {
            if (!cell) return;
            cell.fx.forEach((fx) => {
                switch (fx.cmd) {
                    case "G":                             // global volume 00..40
                        state.globalVol = Math.min(64, fx.val) / 64;
                        break;
                    case "H":                             // global volume slide: x up, y down, per tick
                        state.gvSlide = fx.x ? fx.x / 64 : -fx.y / 64;
                        break;
                    case "W":                             // echo time: xx rows from here on
                        if (fx.val) state.delayRows = fx.val;
                        break;
                    case "B":
                        state.jumpTo = fx.val;
                        break;
                    case "D":
                        state.breakTo = fx.x * 10 + fx.y;
                        break;
                    case "F":
                        if (fx.val === 0) break;
                        if (fx.val < 0x20) state.speed = fx.val;
                        else state.tempo = fx.val;
                        break;
                    case "E":
                        if (fx.x === 6) {
                            const key = state.orderIndex;
                            if (fx.y === 0) {
                                state.loopStart[key] = state.row;
                            } else {
                                if (state.loopCount[key] === undefined) state.loopCount[key] = fx.y;
                                if (state.loopCount[key] > 0) {
                                    state.loopCount[key]--;
                                    state.loopJump = state.loopStart[key] ?? 0;
                                } else {
                                    delete state.loopCount[key];
                                }
                            }
                        } else if (fx.x === 14) {
                            state.patternDelay += fx.y;
                        }
                        break;
                }
            });
        });
    }

    // ---- row tick (tick 0): notes, keyoff, delay, per-row effect setup ----

    _rowTick(c, cell, time, song, state) {
        // Reset per-row modulation state; effects below re-arm it.
        c.slideUp = 0;
        c.slideDown = 0;
        c.volSlideUp = 0;
        c.volSlideDown = 0;
        c.panSlide = 0;
        c.vVolSlideUp = 0;
        c.vVolSlideDown = 0;
        c.vPanSlide = 0;
        c.cutTick = null;
        c.delayTick = null;
        c.pendingCell = null;
        c.retrigger = 0;
        c.retrigVol = 0;
        c.tremorOn = 0;
        c.tremorOff = 0;
        c.tremorPos = 0;
        // 0xx arpeggio only lives while the effect is present; instrument arp persists.
        if (c.arpFromFx && !(cell && cell.fx.some((f) => f.cmd === "0"))) {
            c.arpNotes = null;
            c.arpFromFx = false;
        }

        if (!cell) return;

        if (cell.off) {
            this._keyOff(c, time);
        } else if (cell.hasNote) {
            const delayed = cell.fx.some((f) => f.cmd === "E" && f.x === 13 && f.y > 0);
            if (delayed) {
                c.pendingCell = cell;
            } else {
                this._triggerNote(c, cell, time, song, state);
            }
        } else if (cell.inst && song.instruments[cell.inst]) {
            c.inst = cell.inst;
        }

        if (cell.vcol !== null) this._applyVolCol(c, cell.vcol, time);
        cell.fx.forEach((fx) => this._applyNoteFx(c, cell, fx, time, song, state));
    }

    _triggerNote(c, cell, time, song, state) {
        const inst = song.instruments[cell.inst] || song.instruments[c.inst] || {};
        if (cell.inst) c.inst = cell.inst;
        const prevFreq = c.voice ? c.curFreq : c.glideFreq;
        const noteFreq = ActionTracker.midiToFreq(ActionTracker.topMidi(cell.midi));
        // E5x finetune for this note: 0..7 up, 8..F down, in 1/8 semitones.
        const ft = cell.fx.find((f) => f.cmd === "E" && f.x === 5);
        const fine = ft ? (ft.y < 8 ? ft.y : ft.y - 16) / 8 : 0;
        const freq = fine ? noteFreq * Math.pow(2, fine / 12) : noteFreq;
        // 9xx sample offset (soundfont notes): xx * 256 samples into the sample; 900 = last one.
        const so = cell.fx.find((f) => f.cmd === "9");
        if (so && so.val) c.lastOffset = so.val;
        c.noteOffset = so ? (c.lastOffset || 0) * 256 : 0;

        const tonePorta = cell.fx.find((f) => f.cmd === "3" || f.cmd === "5");
        if (tonePorta && (c.voice || (inst.sf2 !== undefined && c.sf2))) {
            // Tone portamento keeps the current note and glides it to the new one.
            c.midi = cell.midi;
            c.baseFreq = freq;
            if (tonePorta.val > 0) c.portaSpeed = tonePorta.val / 64;
            c.portaTarget = freq;
            if (cell.vol !== undefined) c.vol = Math.max(0, Math.min(1, cell.vol));
            c.gateTicks = cell.len != null ? Math.round(cell.len * state.speed) : null;
            return;
        }

        if (inst.sf2 !== undefined) {
            if (!this.soundFont || !this.soundFont.synth || !c.sf2) return;
            // The old note gets its instrument's New Note Action, whatever kind it is.
            if (c.voice && c.voice.sf2) this._sf2HandOff(c, time);
            else if (c.voice) this._handOff(c, time);      // a synth note: was left sounding before
            c.voice = null;
            c.midi = cell.midi;
            c.baseFreq = noteFreq;                // pitch bend is measured from the key, so finetune shows as bend
            c.curFreq = freq;
            c.glideFreq = freq;
            c.noteTick = 0;
            c.gateTicks = cell.len != null ? Math.round(cell.len * state.speed) : null;
            c.portaTarget = null;
            c.portaSpeed = 0;
            if (cell.vol !== undefined) c.vol = Math.max(0, Math.min(1, cell.vol));
            this._sf2NoteOn(c, inst, time);
            c.voice = { sf2: true, inst, level: 1, lastGain: null, vol0: Math.max(c.vol, 1 / 127), releasing: false, stopped: false };
        } else {
            if (c.voice && c.voice.sf2) this._sf2HandOff(c, time);
            else if (c.voice) this._handOff(c, time);
            c.midi = cell.midi;
            c.baseFreq = freq;
            c.curFreq = freq;
            c.glideFreq = freq;
            c.noteTick = 0;
            c.gateTicks = cell.len != null ? Math.round(cell.len * state.speed) : null;
            c.portaTarget = null;
            c.portaSpeed = 0;
            if (cell.vol !== undefined) c.vol = Math.max(0, Math.min(1, cell.vol));
            c.voice = this._createVoice(c, inst, freq, time);
        }

        // Cell slide: glide to an offset over the gate.
        if (cell.slide) {
            const gate = (cell.len ?? song.rowsPerBeat) * state.speed;
            c.portaTarget = freq * Math.pow(2, cell.slide / 12);
            c.portaSpeed = Math.abs(cell.slide) / Math.max(1, gate);
        } else if (inst.glide && prevFreq != null) {
            c.curFreq = prevFreq;
            c.voice.lastFreq = prevFreq;
            c.portaTarget = freq;
            const tickDur = (60 / state.tempo / song.rowsPerBeat) / state.speed;
            c.portaSpeed = Math.abs(Math.log2(freq / prevFreq)) * 12 / Math.max(1, inst.glide / tickDur);
        }

        // Instrument auto-vibrato (cell vib overrides).
        const vib = cell.vib || inst.vibrato;
        if (vib) {
            c.vibRate = vib.rate || 6;
            c.vibDepth = vib.depth || 25;
            const tickDur = (60 / state.tempo / song.rowsPerBeat) / state.speed;
            if (!(c.vibWave & 4)) c.vibPos = -(vib.delay || 0) / tickDur;    // E4x +4 keeps the phase
        } else if (!cell.fx.some((f) => f.cmd === "4" || f.cmd === "6")) {
            c.vibRate = 0;
            c.vibDepth = 0;
            if (!(c.vibWave & 4)) c.vibPos = 0;
        }

        // Instrument auto-arpeggio (cell arp / 0xx override), speed in rows.
        if (cell.arp && cell.arp.length) {
            c.arpNotes = cell.arp;
            c.arpFromFx = false;
            c.arpTickEvery = 1;
        } else if (inst.arp && inst.arp.notes && inst.arp.notes.length && !cell.fx.some((f) => f.cmd === "0")) {
            c.arpNotes = inst.arp.notes;
            c.arpFromFx = false;
            c.arpTickEvery = Math.max(1, Math.round((inst.arp.speed || 1) * state.speed));
        }
    }

    _applyNoteFx(c, cell, fx, time, song, state) {
        const { cmd, x, y, val } = fx;
        switch (cmd) {
            case "0":
                if (val !== 0) {
                    c.arpNotes = [0, x, y];
                    c.arpFromFx = true;
                    c.arpTickEvery = 1;
                }
                break;
            case "1":
                if (val) c.slideUp = val / 64;
                break;
            case "2":
                if (val) c.slideDown = val / 64;
                break;
            case "3":
                if (val) c.portaSpeed = val / 64;
                break;
            case "4":
                if (val !== 0) {
                    if (x) c.vibRate = x * 2;
                    if (y) c.vibDepth = y * 12;
                }
                break;
            case "5":
                this._volSlideFromXY(c, x, y);
                break;
            case "6":
                this._volSlideFromXY(c, x, y);
                break;
            case "7":
                if (val !== 0) {
                    if (x) c.tremRate = x * 2;
                    if (y) c.tremDepth = y / 16;
                }
                break;
            case "8":
                c.pan = (val / 255) * 2 - 1;
                break;
            case "A":
                this._volSlideFromXY(c, x, y);
                break;
            case "C":
                c.vol = Math.max(0, Math.min(1, val / 64));
                break;
            case "K":
                this._keyOff(c, time);
                break;
            case "P":
                c.panSlide = (x - y) / 64;
                break;
            case "R":
                c.retrigger = Math.max(1, y);
                c.retrigVol = x === 0 ? 0 : x <= 8 ? -(x * 8) / 64 : ((x - 8) * 8) / 64;
                break;
            case "T":
                c.tremorOn = x + 1;
                c.tremorOff = y + 1;
                break;
            case "X":                                     // FT2 extra-fine portamento, once
                if (x === 1 && y) c.curFreq *= Math.pow(2, y / 64 / 12);
                else if (x === 2 && y) c.curFreq /= Math.pow(2, y / 64 / 12);
                break;
            case "E":
                this._applyExtendedFx(c, cell, fx, time, song, state);
                break;
        }
    }

    _volSlideFromXY(c, x, y) {
        if (x) c.volSlideUp = x / 64;
        if (y) c.volSlideDown = y / 64;
    }

    _applyVolCol(c, val, time) {
        if (val <= 0x40) { c.vol = val / 64; return; }
        if (val === 0x50) { c.pan = (0x50 / 255) * 2 - 1; return; }
        const group = val >> 4;
        const param = val & 0x0F;
        switch (group) {
            case 6: c.vVolSlideDown = param / 64; break;
            case 7: c.vVolSlideUp = param / 64; break;
            case 8: c.vol = Math.max(0, c.vol - param / 64); break;
            case 9: c.vol = Math.min(1, c.vol + param / 64); break;
            case 10: if (param) c.vibRate = param * 2; break;
            case 11: if (param) c.vibDepth = param * 12; break;
            case 12: c.vPanSlide = -param / 64; break;
            case 13: c.vPanSlide = param / 64; break;
            case 14: if (param) c.portaSpeed = param / 64; break;
        }
    }

    _applyExtendedFx(c, cell, fx, time, song, state) {
        const { x, y } = fx;
        switch (x) {
            case 1:
                if (y) c.curFreq *= Math.pow(2, y / 16 / 12);
                break;
            case 2:
                if (y) c.curFreq /= Math.pow(2, y / 16 / 12);
                break;
            case 3:                                       // glissando on/off
                c.gliss = y > 0;
                break;
            case 4:                                       // vibrato waveform
                c.vibWave = y & 7;
                break;
            case 5:                                       // finetune: applied when the note triggers
                break;
            case 7:                                       // tremolo waveform
                c.tremWave = y & 7;
                break;
            case 9:
                c.retrigger = Math.max(1, y);
                c.retrigVol = 0;
                break;
            case 10:
                c.vol = Math.min(1, c.vol + y / 64);
                break;
            case 11:
                c.vol = Math.max(0, c.vol - y / 64);
                break;
            case 12:
                c.cutTick = y;
                break;
            case 13:
                if (y > 0 && cell.hasNote) {
                    c.delayTick = y;
                    c.pendingCell = cell;
                }
                break;
        }
    }

    // ---- per-tick channel processing: pitch, modulation, amp, filter ----

    _tickChannel(c, time, song, state, tickDur, channels) {
        const dt = tickDur();

        // Delayed note (EDx): trigger when its tick arrives.
        if (c.pendingCell && c.delayTick !== null && state.tick >= c.delayTick) {
            const cell = c.pendingCell;
            c.pendingCell = null;
            c.delayTick = null;
            this._triggerNote(c, cell, time, song, state);
        }

        if (c.bg.length) this._tickBackground(c, time, state, dt);
        if (!c.voice) return;
        if (c.voice.sf2) {
            this._tickSf2Channel(c, time, song, state, tickDur, channels);
            return;
        }
        const v = c.voice;
        const inst = v.inst;
        c.noteTick++;

        // Volume slides (Axy / 5xy / 6xy) and pan slide (Pxy), per tick.
        if (c.volSlideUp) c.vol = Math.min(1, c.vol + c.volSlideUp);
        if (c.volSlideDown) c.vol = Math.max(0, c.vol - c.volSlideDown);
        if (c.panSlide) c.pan = Math.max(-1, Math.min(1, c.pan + c.panSlide));
        // Volume column slides stack with effect column slides.
        if (c.vVolSlideUp) c.vol = Math.min(1, c.vol + c.vVolSlideUp);
        if (c.vVolSlideDown) c.vol = Math.max(0, c.vol - c.vVolSlideDown);
        if (c.vPanSlide) c.pan = Math.max(-1, Math.min(1, c.pan + c.vPanSlide));

        // Note cut (ECx) and fixed gate (len).
        if (c.cutTick !== null && state.tick >= c.cutTick) {
            this._keyOff(c, time);
        }
        if (c.gateTicks !== null && c.noteTick >= c.gateTicks) {
            this._keyOff(c, time);
        }

        // Retrigger (E9x / Rxy).
        if (c.retrigger && c.noteTick > 0 && c.noteTick % c.retrigger === 0) {
            this._retrigger(c, time, song, state);
            if (!c.voice) return;
        }

        // ---- pitch ----
        let freq = c.curFreq;
        const porting = c.portaTarget !== null;
        if (c.portaTarget !== null) {
            const diff = Math.log2(c.portaTarget / freq) * 12;
            const step = c.portaSpeed || Math.abs(diff);
            if (Math.abs(diff) <= step) {
                freq = c.portaTarget;
                c.portaTarget = null;
            } else {
                freq *= Math.pow(2, (Math.sign(diff) * step) / 12);
            }
            c.curFreq = freq;
        } else {
            if (c.slideUp) c.curFreq *= Math.pow(2, c.slideUp / 12);
            if (c.slideDown) c.curFreq /= Math.pow(2, c.slideDown / 12);
            freq = c.curFreq;
        }
        if (porting && c.gliss) freq = ActionTracker._snapSemitone(freq);      // E3x
        freq = Math.max(20, Math.min(12000, freq));

        // Arpeggio: 0xx / cell arp cycle per tick; instrument arp every N ticks.
        let arpOffset = 0;
        if (c.arpNotes && c.arpNotes.length) {
            const every = c.arpTickEvery || 1;
            const idx = Math.floor(Math.max(0, c.noteTick - 1) / every) % c.arpNotes.length;
            arpOffset = c.arpNotes[idx];
        }

        // Instrument pitch envelope (kicks/lasers): exponential fall to base.
        let envOffset = 0;
        if (v.pitchEnv) {
            const elapsed = time - v.start;
            envOffset = v.pitchEnv.amount * Math.exp(-elapsed / v.pitchEnv.tau);
            if (Math.abs(envOffset) < 0.01) v.pitchEnv = null;
        }

        // Vibrato: instrument auto-vib or 4xy, sine sampled per tick.
        let vibOffset = 0;
        if (c.vibDepth > 0 && c.vibRate > 0) {
            c.vibPos += dt;
            if (c.vibPos >= 0) vibOffset = (c.vibDepth / 100) * ActionTracker._wave(c.vibWave, c.vibRate, c.vibPos);
        }

        const finalFreq = freq * Math.pow(2, (arpOffset + envOffset + vibOffset) / 12);
        const fromFreq = v.lastFreq ?? finalFreq;
        this._rampFreq(v, fromFreq, finalFreq, time, dt);
        v.lastFreq = finalFreq;

        // ---- amplitude: ADSR or XM volume envelope, times channel volume ----
        let level;
        if (v.volumeEnv) {
            level = this._volumeEnvLevel(v, c.noteTick - 1) * v.peak;
            if (v.envDone && !v.releasing) this._keyOff(c, time);
        } else {
            level = this._ampEnv(v, time);
        }
        if (v.releasing) {
            if (v.volumeEnv && v.volumeEnv.fadeout) {
                if (level <= 0.001) {
                    this._stopVoice(v, time, 0);
                    c.voice = null;
                    return;
                }
            } else {
                const rel = Math.max(0.01, v.release);
                const elapsed = time - v.releaseAt;
                level = Math.max(0, v.releaseFrom * (1 - elapsed / rel));
                if (elapsed >= rel) {
                    this._stopVoice(v, time, 0);
                    c.voice = null;
                    return;
                }
            }
        }
        v.level = level;

        // Tremolo: instrument auto-trem or 7xy.
        let trem = 1;
        const tremRate = c.tremRate || inst.tremolo?.rate;
        const tremDepth = c.tremDepth || inst.tremolo?.depth;
        if (tremRate && tremDepth) {
            c.tremPos += dt;
            trem = 1 - tremDepth / 2 + (tremDepth / 2) * ActionTracker._wave(c.tremWave, tremRate, c.tremPos);
        }
        // Tremor (Txy): hard on/off gating.
        if (c.tremorOn || c.tremorOff) {
            const period = c.tremorOn + c.tremorOff;
            const phase = c.tremorPos % period;
            trem = phase < c.tremorOn ? 1 : 0;
            c.tremorPos++;
        }

        const gainVal = Math.max(0, level * c.vol * trem * state.globalVol);
        // Mute/solo is the channel bus (see syncAudibility), so queued notes obey it too.
        const outGain = c.bus ? gainVal : (!c.muted && (!channels.some((ch) => ch.solo) || c.solo) ? gainVal : 0);
        const fromGain = v.lastGain ?? 0;
        this._rampGain(v, fromGain, outGain, time, dt);
        v.lastGain = outGain;

        // Panning envelope: interpolate points per tick, add to channel pan.
        let finalPan = c.pan;
        if (v.panEnv) {
            finalPan += this._panEnvLevel(v, c.noteTick - 1);
        }
        this._setPan(v, Math.max(-1, Math.min(1, finalPan)), time);

        // ---- filter envelope ----
        if (v.filter && v.filterEnv) {
            const fe = v.filterEnv;
            const elapsed = time - v.start;
            const [a = 0.01, d = 0.1, s = 0.5] = fe.adsr;
            let env;
            if (elapsed < a) env = elapsed / Math.max(1e-4, a);
            else if (elapsed < a + d) env = 1 - (1 - s) * ((elapsed - a) / Math.max(1e-4, d));
            else env = s;
            if (v.releasing) {
                const relElapsed = time - v.releaseAt;
                env *= Math.max(0, 1 - relElapsed / Math.max(0.01, fe.release));
            }
            const cutoff = Math.max(20, Math.min(20000, fe.base + fe.amount * env));
            const fromCut = v.lastCut ?? cutoff;
            this._rampCutoff(v, fromCut, cutoff, time, dt);
            v.lastCut = cutoff;
        }
    }

    _ampEnv(v, time) {
        const elapsed = time - v.start;
        const { attack, decay, sustain, peak } = v;
        if (elapsed < attack) return peak * (elapsed / Math.max(1e-4, attack));
        if (elapsed < attack + decay) {
            const t = (elapsed - attack) / Math.max(1e-4, decay);
            return peak * (1 - (1 - sustain) * t);
        }
        return peak * sustain;
    }

    // XM volume envelope: points [[tick, level], ...], sustain point index, loop
    // point indices, fadeout in ticks after keyoff.
    _volumeEnvLevel(v, tick) {
        const env = v.volumeEnv;
        const pts = env.points;
        if (!pts || !pts.length) return 1;
        let t = tick;
        if (env.loop && t > pts[pts.length - 1][0]) {
            const [a, b] = env.loop;
            const start = pts[a][0];
            const end = pts[b][0];
            if (end > start) t = start + ((t - start) % (end - start));
        }
        let level = pts[pts.length - 1][1];
        for (let i = 0; i < pts.length; i++) {
            if (t <= pts[i][0]) {
                if (i === 0) level = pts[0][1];
                else {
                    const [t0, l0] = pts[i - 1];
                    const [t1, l1] = pts[i];
                    const f = (t - t0) / Math.max(1e-4, t1 - t0);
                    level = l0 + (l1 - l0) * f;
                }
                break;
            }
        }
        if (env.sustain !== undefined && !v.releasing && tick >= pts[env.sustain][0]) {
            level = pts[env.sustain][1];
        }
        if (env.fadeout && v.releasing) {
            level *= Math.max(0, 1 - (tick - (v.releaseTick ?? tick)) / env.fadeout);
        }
        if (!env.loop && env.sustain === undefined && tick >= pts[pts.length - 1][0]) {
            if (pts[pts.length - 1][1] <= 0.001) v.envDone = true;
        }
        return Math.max(0, Math.min(1, level));
    }

    _panEnvLevel(v, tick) {
        const env = v.panEnv;
        const pts = env.points;
        if (!pts || !pts.length) return 0;
        let t = tick;
        if (env.loop && t > pts[pts.length - 1][0]) {
            const [a, b] = env.loop;
            const start = pts[a][0];
            const end = pts[b][0];
            if (end > start) t = start + ((t - start) % (end - start));
        }
        let pan = pts[pts.length - 1][1];
        for (let i = 0; i < pts.length; i++) {
            if (t <= pts[i][0]) {
                if (i === 0) pan = pts[0][1];
                else {
                    const [t0, p0] = pts[i - 1];
                    const [t1, p1] = pts[i];
                    const f = (t - t0) / Math.max(1e-4, t1 - t0);
                    pan = p0 + (p1 - p0) * f;
                }
                break;
            }
        }
        if (env.sustain !== undefined && !v.releasing && tick >= pts[env.sustain][0]) {
            pan = pts[env.sustain][1];
        }
        return Math.max(-1, Math.min(1, pan));
    }

    // ---- voice lifecycle ----

    _retrigger(c, time, song, state) {
        if (!c.voice || c.midi === null) return;
        if (c.retrigVol) c.vol = Math.max(0, Math.min(1, c.vol + c.retrigVol));
        const inst = song.instruments[c.inst] || {};
        const freq = ActionTracker.midiToFreq(ActionTracker.topMidi(c.midi));
        if (c.voice.sf2) {
            this._sf2NoteOff(c, time);
            this._sf2NoteOn(c, inst, time);
            c.voice = { sf2: true, inst, level: 1, lastGain: null, vol0: Math.max(c.vol, 1 / 127), releasing: false, stopped: false };
        } else {
            this._stopVoice(c.voice, time, 0.005);
            c.voice = this._createVoice(c, inst, freq, time);
        }
        c.curFreq = freq;
        c.baseFreq = freq;
        c.noteTick = 0;
        c.portaTarget = null;
    }

    _keyOff(c, time) {
        // An OFF also releases notes an NNA left sounding on this channel.
        for (const b of c.bg) this._keyOffVoice(b, time, b.bgTick);
        if (c.sfBgKeys.length) { this._sf2KeysOff(c, c.sfBgKeys, time); c.sfBgKeys = []; }
        const v = c.voice;
        if (!v || v.releasing) return;
        v.releasing = true;
        v.releaseAt = time;
        v.releaseTick = c.noteTick;
        v.releaseFrom = v.level || 0;
        if (v.sf2) this._sf2NoteOff(c, time);
    }

    // ---- effect helpers ----

    // Vibrato / tremolo LFO (E4x / E7x waveform), -1..1. Sine stays exactly the old formula.
    static _wave(type, rate, pos) {
        const t = type & 3;
        if (t === 0) return Math.sin(2 * Math.PI * rate * pos);
        const x = rate * pos, ph = x - Math.floor(x);
        if (t === 1) return 1 - 2 * ph;                   // ramp down
        if (t === 2) return ph < 0.5 ? 1 : -1;           // square
        return Math.random() * 2 - 1;                     // random
    }

    static _snapSemitone(freq) {
        return 440 * Math.pow(2, Math.round(12 * Math.log2(freq / 440)) / 12);
    }

    // ---- New Note Actions (instrument `nna`) ----
    // What happens to a synth channel's sounding note when a new one starts:
    //   "cut" (default) stop it, "continue" let it play on, "off" release it,
    //   "fade" release it (XM volume envelopes run their fadeout).
    // Notes left sounding play out their own envelope (no channel effects reach them),
    // honour their `len`, release on the channel's next OFF, and at most MAX_BACKGROUND
    // per channel are kept (the oldest is cut).
    static MAX_BACKGROUND = 4;

    _handOff(c, time) {
        const v = c.voice;
        const nna = (v.inst && v.inst.nna) || "cut";
        if (nna === "cut" || v.releasing && v.level <= 0.001) { this._stopVoice(v, time, 0.02); return; }
        v.bgVol = c.vol;
        v.bgTick = c.noteTick;
        v.gateLeft = c.gateTicks !== null ? c.gateTicks - c.noteTick : null;
        if (nna === "off" || nna === "fade") this._keyOffVoice(v, time, c.noteTick);
        c.bg.push(v);
        while (c.bg.length > ActionTracker.MAX_BACKGROUND) this._stopVoice(c.bg.shift(), time, 0.02);
    }

    // The soundfont version: "continue" leaves the old keys ringing (the channel's next
    // OFF releases them); anything else releases them - their own release - at the new
    // note's time (not now: with a lookahead the old note may still be queued).
    _sf2HandOff(c, time) {
        const oldInst = c.voice.inst || {};
        if (oldInst.nna === "continue" && c.midi !== null) {
            c.sfBgKeys.push(...(Array.isArray(c.midi) ? c.midi : [c.midi]));
            while (c.sfBgKeys.length > ActionTracker.MAX_BACKGROUND * 4) this._sf2KeysOff(c, [c.sfBgKeys.shift()], time);
        } else this._sf2NoteOff(c, time);
    }

    _keyOffVoice(v, time, tick) {
        if (!v || v.releasing) return;
        v.releasing = true;
        v.releaseAt = time;
        v.releaseTick = tick;
        v.releaseFrom = v.level || 0;
    }

    // Envelope level for a background voice (same rules as the foreground voice).
    _voiceAmp(v, time, tick) {
        let level = v.volumeEnv ? this._volumeEnvLevel(v, tick) * v.peak : this._ampEnv(v, time);
        if (v.volumeEnv && v.envDone && !v.releasing) this._keyOffVoice(v, time, tick);
        if (v.releasing) {
            if (v.volumeEnv && v.volumeEnv.fadeout) {
                if (level <= 0.001) return -1;
            } else {
                const rel = Math.max(0.01, v.release);
                const elapsed = time - v.releaseAt;
                if (elapsed >= rel) return -1;
                level = Math.max(0, v.releaseFrom * (1 - elapsed / rel));
            }
        }
        return level;
    }

    _tickBackground(c, time, state, dt) {
        for (let i = c.bg.length - 1; i >= 0; i--) {
            const v = c.bg[i];
            v.bgTick++;
            if (v.gateLeft !== null && !v.releasing && --v.gateLeft <= 0) this._keyOffVoice(v, time, v.bgTick);
            const level = this._voiceAmp(v, time, v.bgTick - 1);
            if (level < 0) { this._stopVoice(v, time, 0); c.bg.splice(i, 1); continue; }
            v.level = level;
            const out = Math.max(0, level * v.bgVol * state.globalVol);
            this._rampGain(v, v.lastGain ?? 0, out, time, dt);
            v.lastGain = out;
        }
    }

    // Stop / pause / end of song: silence notes an NNA left sounding.
    _stopBackground(c, time, quick) {
        for (const v of c.bg) this._stopVoice(v, time, quick);
        c.bg = [];
        if (c.sfBgKeys.length) { this._sf2KeysOff(c, c.sfBgKeys, time); c.sfBgKeys = []; }
    }

    // ---- soundfont (SF2) channels ----
    // Instruments with { sf2: program } play through the attached ActionSoundFont
    // instead of the oscillator synth. Each gets a dedicated MIDI channel;
    // { sf2: "drums" } uses the GM percussion kit on channel 9. Pitch modulation
    // (porta/slides/arp/vibrato) rides the MIDI pitch bend, volume/mute rides the
    // per-note expression gain, and the soundfont's own ADSR shapes the note.

    // The soundfont instrument a tracker channel needs a MIDI channel for: its own, or
    // else the first soundfont instrument any of its notes switches to (a channel can
    // start on a synth and change to a soundfont instrument mid-song).
    _sf2InstFor(c, i, song) {
        const own = song.instruments[c.cfg.inst];
        if (own && own.sf2 !== undefined) return own;
        const names = Object.keys(song.instruments).filter((k) => song.instruments[k] && song.instruments[k].sf2 !== undefined);
        if (!names.length) return null;
        const isSf2 = new Set(names);
        for (const k of song.order) {
            for (const row of song.patterns[k] || []) {
                const cell = row && row[i];
                if (!cell) continue;
                const name = typeof cell === "object" ? cell.inst
                    : String(cell).trim().split(/\s+/).find((t) => isSf2.has(t));
                if (name && isSf2.has(name)) return song.instruments[name];
            }
        }
        return null;
    }

    // A note whose soundfont instrument isn't the program its MIDI channel is set to
    // (the channel switched instruments): change program / bank at that note.
    _sf2Program(c, inst, at) {
        if (!c.sf2 || c.sf2.ch === 9 || inst.sf2 === "drums" || inst.percussion) return;
        const bank = inst.bank ?? 0;
        if (c.sf2.prog === inst.sf2 && c.sf2.bank === bank) return;
        this._sf2SetProgram(c.sf2.ch, inst.sf2, bank, at);
        c.sf2.prog = inst.sf2;
        c.sf2.bank = bank;
    }

    _sf2SetProgram(ch, program, bank) {
        const synth = this.soundFont.synth;
        synth.bankChange(ch, bank);
        synth.programChange(ch, program);
    }

    _allocSf2Channels(channels, song) {
        const sf = this.soundFont;
        if (!sf || !sf.synth) return;
        let next = 0;
        channels.forEach((c, i) => {
            const inst = this._sf2InstFor(c, i, song);
            if (!inst) return;
            let ch;
            if (inst.sf2 === "drums" || inst.percussion) {
                ch = 9;
                sf.synth.setPercussionPart(9, true);
                sf.synth.programChange(9, inst.kit ?? 0);
                sf.synth.setPercussionRing(9, inst.ring ?? 3);
            } else {
                while (next === 9) next++;
                if (next > 15) return;
                ch = next++;
                sf.synth.setPercussionPart(ch, false);
                sf.synth.bankChange(ch, inst.bank ?? 0);
                sf.synth.programChange(ch, inst.sf2);
            }
            sf.synth.pitchBendSensitivity(ch, 12);
            sf.synth.pitchBend(ch, 0, 0x40);
            sf.synth.volumeChange(ch, ch === 9 ? 127 : 100);
            sf.synth.panpotChange(ch, 64);
            // `level` is a linear channel gain after velocity (may exceed 1), for
            // soundfont samples recorded much quieter or louder than their neighbours.
            const level = inst.level ?? 1;
            sf.synth.setChannelGain(ch, level);
            c.sf2 = { ch, level, prog: inst.sf2, bank: inst.bank ?? 0 };
            // Echo sends from the soundfont channel (one per MIDI channel; drums share 9).
            const h = c.handle;
            [[h && h._delay, 1, "_sf2SendByCh"], [h && h._delay2, 2, "_sf2Send2ByCh"]].forEach(([dl, which, byCh]) => {
                const amount = dl ? this._sendFor(c, inst, which) : 0;
                if (!(amount > 0 && sf.synth.channelGain && sf.synth.channelGain[ch])) return;
                h._sf2Sends = h._sf2Sends || [];
                h[byCh] = h[byCh] || {};
                let g = h[byCh][ch];
                if (!g) {
                    g = this.context.createGain();
                    g.gain.value = 0;
                    sf.synth.channelGain[ch].connect(g);
                    g.connect(dl.input);
                    h[byCh][ch] = g;
                    h._sf2Sends.push(g);
                }
                // The synth's channels still carry raw 16-bit sample values; its master gain
                // scales them (1/65535). Tapping before it, the send has to apply that too.
                const scale = sf.synth.gainMaster ? sf.synth.gainMaster.gain.value : 1;
                g.gain.value = Math.max(g.gain.value, amount * scale);
            });
        });
    }

    _sf2Notes(c) {
        const sf = this.soundFont;
        if (!sf || !sf.synth || !c.sf2) return [];
        const notes = sf.synth.currentNoteOn[c.sf2.ch] || [];
        // Several tracker channels can share one MIDI channel (every drums
        // instrument lands on ch 9), so only touch the keys this channel played.
        const keys = Array.isArray(c.midi) ? c.midi : [c.midi];
        return notes.filter((n) => keys.includes(n.key));
    }

    _sf2NoteOn(c, inst, time) {
        const sf = this.soundFont;
        const vel = Math.max(1, Math.min(127, Math.round(c.vol * (inst.gain ?? 1) * 127)));
        const notes = Array.isArray(c.midi) ? c.midi.slice() : [c.midi];
        const ch = c.sf2.ch;
        // Scheduled on the audio clock, sample-accurate like oscillator voices.
        // (Timers used to fire these; they drifted by milliseconds per note.)
        const at = Math.max(time ?? this.context.currentTime, this.context.currentTime);
        this._sf2Program(c, inst, at);
        sf.synth.pitchBend(ch, 0, 0x40, at);
        notes.forEach((m) => sf.noteOn(m, vel, ch, at, c.noteOffset || 0));
    }

    // Release specific keys on a channel's MIDI channel (NNA background keys).
    _sf2KeysOff(c, keys, time) {
        const sf = this.soundFont;
        if (!sf || !sf.synth || !c.sf2) return;
        const at = time === undefined ? undefined : Math.max(time, this.context.currentTime);
        keys.forEach((m) => sf.noteOff(m, 127, c.sf2.ch, at));
    }

    // Stop/pause: release every note actually sounding on the handle's MIDI channels.
    // With a lookahead the channel's current keys (c.midi) belong to the latest QUEUED
    // note, not necessarily to what is ringing, so key-by-key offs could miss notes.
    _sf2ReleaseAll(handle) {
        const sf = this.soundFont;
        if (!sf || !sf.synth) return;
        const chans = new Set(handle._channels.filter((c) => c.sf2).map((c) => c.sf2.ch));
        chans.forEach((ch) => {
            const keys = new Set((sf.synth.currentNoteOn[ch] || []).map((n) => n.key));
            keys.forEach((k) => sf.noteOff(k, 127, ch));
        });
    }

    _sf2NoteOff(c, time) {
        const sf = this.soundFont;
        if (!sf || !sf.synth || !c.sf2 || c.midi === null) return;
        const notes = Array.isArray(c.midi) ? c.midi.slice() : [c.midi];
        const ch = c.sf2.ch;
        const at = time === undefined ? undefined : Math.max(time, this.context.currentTime);
        notes.forEach((m) => sf.noteOff(m, 127, ch, at));
    }

    _tickSf2Channel(c, time, song, state, tickDur, channels) {
        const dt = tickDur();
        const v = c.voice;
        const inst = v.inst;
        c.noteTick++;

        if (c.volSlideUp) c.vol = Math.min(1, c.vol + c.volSlideUp);
        if (c.volSlideDown) c.vol = Math.max(0, c.vol - c.volSlideDown);
        if (c.panSlide) c.pan = Math.max(-1, Math.min(1, c.pan + c.panSlide));
        if (c.vVolSlideUp) c.vol = Math.min(1, c.vol + c.vVolSlideUp);
        if (c.vVolSlideDown) c.vol = Math.max(0, c.vol - c.vVolSlideDown);
        if (c.vPanSlide) c.pan = Math.max(-1, Math.min(1, c.pan + c.vPanSlide));

        if (c.cutTick !== null && state.tick >= c.cutTick) this._keyOff(c, time);
        if (c.gateTicks !== null && c.noteTick >= c.gateTicks) this._keyOff(c, time);
        if (c.retrigger && c.noteTick > 0 && c.noteTick % c.retrigger === 0) {
            this._retrigger(c, time, song, state);
            if (!c.voice) return;
        }

        // Pitch: same modulation math as the synth path, applied as pitch bend
        // relative to the triggered note.
        let freq = c.curFreq;
        const porting = c.portaTarget !== null;
        if (c.portaTarget !== null) {
            const diff = Math.log2(c.portaTarget / freq) * 12;
            const step = c.portaSpeed || Math.abs(diff);
            if (Math.abs(diff) <= step) {
                freq = c.portaTarget;
                c.portaTarget = null;
            } else {
                freq *= Math.pow(2, (Math.sign(diff) * step) / 12);
            }
            c.curFreq = freq;
        } else {
            if (c.slideUp) c.curFreq *= Math.pow(2, c.slideUp / 12);
            if (c.slideDown) c.curFreq /= Math.pow(2, c.slideDown / 12);
            freq = c.curFreq;
        }
        if (porting && c.gliss) freq = ActionTracker._snapSemitone(freq);      // E3x
        let arpOffset = 0;
        if (c.arpNotes && c.arpNotes.length) {
            const every = c.arpTickEvery || 1;
            const idx = Math.floor(Math.max(0, c.noteTick - 1) / every) % c.arpNotes.length;
            arpOffset = c.arpNotes[idx];
        }
        let vibOffset = 0;
        if (c.vibDepth > 0 && c.vibRate > 0) {
            c.vibPos += dt;
            if (c.vibPos >= 0) vibOffset = (c.vibDepth / 100) * ActionTracker._wave(c.vibWave, c.vibRate, c.vibPos);
        }
        const finalFreq = freq * Math.pow(2, (arpOffset + vibOffset) / 12);
        const semis = Math.max(-12, Math.min(12, 12 * Math.log2(finalFreq / c.baseFreq)));
        const bend = Math.max(0, Math.min(16383, Math.round(8192 + (semis / 12) * 8191)));
        this._sf2Bend(c, bend, time);

        // The soundfont's release envelope runs on its own; drop the voice when done.
        if (v.releasing) {
            v.level = 0;
            const rel = (inst.release ?? 0.4) + 0.1;
            if (time - v.releaseAt >= rel) c.voice = null;
            return;
        }

        let trem = 1;
        const tremRate = c.tremRate || inst.tremolo?.rate;
        const tremDepth = c.tremDepth || inst.tremolo?.depth;
        if (tremRate && tremDepth) {
            c.tremPos += dt;
            trem = 1 - tremDepth / 2 + (tremDepth / 2) * ActionTracker._wave(c.tremWave, tremRate, c.tremPos);
        }
        if (c.tremorOn || c.tremorOff) {
            const period = c.tremorOn + c.tremorOff;
            trem = (c.tremorPos % period) < c.tremorOn ? 1 : 0;
            c.tremorPos++;
        }

        const anySolo = channels.some((ch) => ch.solo);
        const audible = !c.muted && (!anySolo || c.solo);
        // The note's starting volume is already in its MIDI velocity, so the expression
        // gain only carries changes since note-on (slides, tremolo, mute). Applying c.vol
        // here again stepped every note down a few ticks after its attack - the click
        // between notes - and made soundfont parts quieter than written.
        const outGain = audible ? Math.max(0, (c.vol / (v.vol0 || 1)) * trem * state.globalVol) : 0;
        // A new note's expression gain starts at the soundfont default (1).
        const fromGain = v.lastGain ?? (audible ? 1 : 0);
        this._sf2Expr(c, fromGain, outGain, Math.max(-1, Math.min(1, c.pan)), time, dt);
        v.lastGain = outGain;
        v.level = c.vol * trem;
    }

    // ---- voice parameter writes (the audio-thread tracker overrides these) ----

    _rampFreq(v, from, to, time, dt) {
        v.sources.forEach((src) => {
            if (v.isNoise) {
                src.playbackRate.setValueAtTime(Math.max(0.05, from / 440), time);
                src.playbackRate.linearRampToValueAtTime(Math.max(0.05, to / 440), time + dt);
            } else {
                src.frequency.setValueAtTime(from, time);
                src.frequency.linearRampToValueAtTime(to, time + dt);
            }
        });
    }

    _rampGain(v, from, to, time, dt) {
        v.gain.gain.setValueAtTime(from, time);
        v.gain.gain.linearRampToValueAtTime(to, time + dt);
    }

    _setPan(v, pan, time) {
        v.panner.pan.setValueAtTime(pan, time);
    }

    _rampCutoff(v, from, to, time, dt) {
        v.filter.frequency.setValueAtTime(from, time);
        v.filter.frequency.linearRampToValueAtTime(to, time + dt);
    }

    _sf2Bend(c, bend, time) {
        this.soundFont.synth.pitchBend(c.sf2.ch, bend & 0x7f, (bend >> 7) & 0x7f, time);
    }

    _sf2Expr(c, from, to, pan, time, dt) {
        this._sf2Notes(c).forEach((n) => {
            const g = n.expressionGainNode.gain;
            g.setValueAtTime(from, time);
            g.linearRampToValueAtTime(to, time + dt);
            n.panner.setPosition(Math.sin((pan * Math.PI) / 2), 0, Math.cos((pan * Math.PI) / 2));
        });
    }

    _createVoice(c, inst, freq, time) {
        const ctx = this.context;
        const wave = inst.wave || "sine";
        const isNoise = wave === "noise";
        const voices = isNoise ? 1 : Math.max(1, inst.unison?.voices || 1);
        const detune = inst.unison?.detune || 0;
        const peak = (inst.gain ?? 0.5) * (c.cfg.gain ?? 1) / Math.sqrt(voices);
        // Under load a tick can be processed after its time has passed. Scheduling a
        // voice in the past let its first samples play before the envelope existed
        // (amp at the GainNode default of 1) - a one-sample click. Never start earlier
        // than now.
        time = Math.max(time, ctx.currentTime);

        const sources = [];
        const extras = [];
        for (let i = 0; i < voices; i++) {
            let src;
            const spread = voices > 1 ? (i / (voices - 1) - 0.5) * 2 * detune : 0;
            if (isNoise) {
                src = ctx.createBufferSource();
                src.buffer = this._noiseBuffer();
                src.loop = true;
                src.playbackRate.setValueAtTime(Math.max(0.05, freq / 440), time);
            } else {
                src = ctx.createOscillator();
                if (wave === "pulse") src.setPeriodicWave(this._pulseWave(inst.duty ?? 0.5, freq));
                else src.type = wave === "saw" ? "sawtooth" : wave;
                src.detune.setValueAtTime(spread, time);
                src.frequency.setValueAtTime(freq, time);
            }
            src.start(time);
            sources.push(src);
        }

        // Graph: sources -> [drive] -> [filter] -> amp -> panner -> dest.
        let head = ctx.createGain();
        head.gain.value = 1;
        // unison.spread (0..1): place the detuned voices across the stereo field. Each
        // source gets its own panner; the drive/filter/amp nodes after it process the
        // two channels independently, so the width survives the whole chain.
        const spreadAmt = !isNoise && voices > 1 ? Math.max(0, Math.min(1, inst.unison?.spread || 0)) : 0;
        sources.forEach((s, i) => {
            if (spreadAmt > 0) {
                const sp = ctx.createStereoPanner();
                sp.pan.value = spreadAmt * ((i / (voices - 1)) * 2 - 1);
                s.connect(sp);
                sp.connect(head);
                extras.push(sp);
            } else s.connect(head);
        });
        extras.push(head);

        if (inst.drive) {
            const shaper = ctx.createWaveShaper();
            shaper.curve = this._driveCurve(inst.drive);
            shaper.oversample = "2x";
            head.connect(shaper);
            head = shaper;
            extras.push(shaper);
        }

        let filter = null;
        let filterEnv = null;
        if (inst.filter || inst.filterEnv) {
            filter = ctx.createBiquadFilter();
            filter.type = inst.filter?.type || "lowpass";
            filter.Q.value = inst.filter?.Q ?? inst.filterEnv?.Q ?? 1;
            const base = inst.filter?.frequency ?? 1000;
            filter.frequency.value = base;            // not the 350 Hz default before `time`
            filter.frequency.setValueAtTime(base, time);
            head.connect(filter);
            head = filter;
            extras.push(filter);
            if (inst.filterEnv) {
                filterEnv = {
                    base,
                    amount: inst.filterEnv.amount ?? 2000,
                    adsr: inst.filterEnv.adsr || [0.01, 0.1, 0.5],
                    release: (inst.filterEnv.adsr || [])[3] ?? 0.1
                };
            }
        }

        const gain = ctx.createGain();
        gain.gain.value = 0;                          // silent from creation, not the default 1
        gain.gain.setValueAtTime(0, time);
        head.connect(gain);
        head = gain;
        // Echo send level for this note's instrument (the channel's send bus).
        if (c.send) c.send.gain.setValueAtTime(this._sendFor(c, inst), time);
        if (c.send2) c.send2.gain.setValueAtTime(this._sendFor(c, inst, 2), time);

        const panner = ctx.createStereoPanner();
        panner.pan.value = c.pan;
        head.connect(panner);
        panner.connect(c.dest || this.output);

        const [a = 0.01, d = 0.1, s = 0.6, r = 0.08] = inst.adsr || [];
        return {
            sources, gain, panner, extras, filter, filterEnv, inst,
            isNoise, peak,
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
    }

    _stopVoice(voice, time, quick) {
        if (!voice || voice.stopped) return;
        voice.stopped = true;
        const ctx = this.context;
        const at = Math.max(time, ctx.currentTime);
        const r = Math.max(0.005, quick ?? 0.02);
        const g = voice.gain.gain;
        g.cancelScheduledValues(at);
        // Ramp from the last written output gain, not the raw envelope level:
        // the level ignores mute/solo, so restarting it here blips muted channels.
        g.setValueAtTime(voice.lastGain ?? 0, at);
        g.linearRampToValueAtTime(0, at + r);
        const stopAt = at + r + 0.02;
        voice.sources.forEach((src) => {
            try { src.stop(stopAt); } catch (e) {}
        });
    }

    _driveCurve(amount) {
        const k = 1 + Math.max(0, Math.min(1, amount)) * 30;
        const n = 512;
        const curve = new Float32Array(n);
        const norm = Math.tanh(k);
        for (let i = 0; i < n; i++) {
            const x = (i / (n - 1)) * 2 - 1;
            curve[i] = Math.tanh(k * x) / norm;
        }
        return curve;
    }

    _noiseBuffer() {
        if (this._noise) return this._noise;
        const ctx = this.context;
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this._noise = buffer;
        return buffer;
    }

    // Band-limited pulse wave via its Fourier series, so duty cycles don't alias.
    // The harmonic count depends on pitch, so cache one wave per duty per octave,
    // sized for the top of that octave (plus slide headroom) so nothing aliases.
    _pulseWave(duty, freq) {
        const octave = Math.max(0, Math.floor(Math.log2(Math.max(freq, 20) / 20)));
        const key = duty.toFixed(3) + ":" + octave;
        if (this._pulseCache.has(key)) return this._pulseCache.get(key);
        const ctx = this.context;
        const topFreq = 20 * Math.pow(2, octave + 1);
        const n = Math.max(2, Math.min(48, Math.floor(ctx.sampleRate / 2 / topFreq)));
        const real = new Float32Array(n + 1);
        const imag = new Float32Array(n + 1);
        for (let h = 1; h <= n; h++) {
            real[h] = (2 * Math.sin(2 * Math.PI * h * duty)) / (Math.PI * h);
            imag[h] = (2 * (1 - Math.cos(2 * Math.PI * h * duty))) / (Math.PI * h);
        }
        const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
        this._pulseCache.set(key, wave);
        return wave;
    }
}