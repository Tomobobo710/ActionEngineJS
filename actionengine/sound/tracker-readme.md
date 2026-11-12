# ActionTracker — crash course

A chiptune tracker you author as **plain JS data**. No DSL, no parser, no assets, no
samples — everything is synthesized. The grid IS the format. Playback runs on a real
tracker tick clock (ProTracker/FT2 semantics) scheduled against the WebAudio clock,
so it's sample-tight and doesn't drift.

Engine: `actionengine/sound/actiontracker.js` (vanilla JS, zero dependencies).
Optionally, instruments can play through a General MIDI soundfont instead of the
synth (see **SoundFont instruments**).

---

## Quick start

```js
const song = {
    bpm: 125, speed: 6, rowsPerBeat: 4,
    instruments: {
        lead: { wave: "pulse", duty: 0.5, adsr: [0.01, 0.08, 0.6, 0.06], gain: 0.4 },
        bass: { wave: "triangle", adsr: [0.01, 0.15, 0.7, 0.08], gain: 0.55 },
        hat:  { wave: "noise", filter: { type: "highpass", frequency: 7500 },
                adsr: [0.001, 0.03, 0, 0.02], gain: 0.2 }
    },
    channels: ["lead", "bass", "hat"],
    patterns: {
        A: [
            ["C-5", "C-3", "C-6"],
            [null,  null,  null ],
            ["E-5", null,  "C-6"],
            ["OFF", "G-2", null ]
        ]
    },
    order: ["A", "A"],
    loop: 0
};

const tracker = new ActionTracker(audioContext, destinationNode);
const handle = tracker.play(song);
// later: handle.stop() / handle.pause() / handle.resume()
```

In a browser, the AudioContext must be unlocked by a user gesture first
(`audio.unlock()` in the AudioManager, or `context.resume()` yourself).

---

## Timing model

```
rowDuration  = 60 / bpm / rowsPerBeat     // one grid row (a 16th note at rowsPerBeat 4)
tickDuration = rowDuration / speed        // the atomic processing step
```

- **Tick 0 of each row**: the sequencer reads the grid. Notes trigger, effects are
  parsed and armed, sequencer commands (jump/break/loop/speed) resolve.
- **Every tick**: modulation runs — vibrato, portamento, arpeggio, volume/pan slides,
  envelopes, tremolo, retrigger, cuts, as ramps that start exactly at the tick.
- **Where it runs.** By default the whole tracker runs on the audio thread, inside the
  engine's AudioWorklet (`ActionAudioManager.engine = "auto"`): the same sequencer code,
  one tick at a time at its exact sample frame. Nothing on the page (UI, game logic, GC,
  a dropped frame) can make a note late, and there is no lookahead.
- **Node fallback** (`engine = "nodes"`, or when the worklet can't load): a 25ms
  `setInterval` pump on the main thread schedules Web Audio nodes inside a 120ms
  lookahead window, on the audio clock. Same sound; stalls longer than the lookahead
  make notes late.

At 125 BPM / speed 6 / rowsPerBeat 4: row = 0.12s, tick = 0.02s, 6 ticks per row.
Patterns can be any length (16 rows = one 4/4 bar at rowsPerBeat 4).

---

## Song object

| field         | meaning                                                        | default |
|---------------|----------------------------------------------------------------|---------|
| `bpm`         | tempo (beats per minute)                                       | 125     |
| `speed`       | ticks per row                                                  | 6       |
| `rowsPerBeat` | rows per beat (4 = 16th-note grid)                             | 4       |
| `instruments` | map of name → instrument spec (see below)                      | `{}`    |
| `channels`    | one entry per grid column: `"instName"` or `{inst, gain, pan}` | required|
| `patterns`    | map of key → array of rows; each row = one cell per channel    | `{}`    |
| `order`       | playlist of pattern keys                                       | all keys|
| `loop`        | order index to loop back to; `false` = play once and stop      | `false` |

`pan` is −1..1. Channel `gain` scales the instrument. Extra/missing cells in a row
are treated as empty.

---

## Cells

A cell is a **string**, an **object**, or `null`/`""` (empty).

### String form

```
"C-5"              note
"C-5 lead"         note + instrument override
"C-5 432"          note + effect column (vibrato)
"C-5 lead 432"     all three
"C-5 V70 432"      volume column (V-prefix token) AND effect column
"--- A04"          no note, effect only (previous note keeps ringing, slides down)
"OFF"              key off (release envelope). Also "==" and "K".
```

Notes: `C-5`, `C#5`, `Db4`, `Bb-1` — letter, optional #/b, optional dash/space,
**octave digit required**. Plain MIDI numbers work too (`69` = A-4).
`---` / `...` = "no note" (use with effects). `null` = fully empty row cell.

### Object form

```js
{ note: "C-5", inst: "lead", vol: 0.8, len: 4, fx: ["432", "A04"], vcol: "71" }
```

| field   | meaning                                                             |
|---------|---------------------------------------------------------------------|
| `note`  | note string / MIDI number / `"OFF"` / `null` (effect-only row)      |
| `inst`  | instrument key override                                             |
| `vol`   | 0..1 note volume (like Cxx, normalized)                             |
| `len`   | gate length **in rows**, then auto key-off. Omit = ring until next note/OFF |
| `slide` | semitones to glide to over the gate (negative = down). Lasers, kicks |
| `vib`   | `{rate: Hz, depth: cents}` — overrides instrument vibrato           |
| `arp`   | `[0, 3, 7]` semitone offsets cycled **per tick**                    |
| `fx`    | effect string `"XYZ"` or array `["A04", "432"]`, processed in order |
| `vcol`  | volume column: hex string `"71"` or number `0x71`                   |

---

## Effect column (ProTracker / FT2)

Three chars: command + two hex digits. `x` = first digit, `y` = second, `val` = xx.

| cmd    | action |
|--------|--------|
| `0xy`  | arpeggio: cycle base / +x / +y semitones each tick |
| `1xx`  | portamento **up**, xx/64 semitones per tick |
| `2xx`  | portamento **down** |
| `3xx`  | tone portamento: glide the *existing* voice to the cell's note at xx/64 semitones/tick (no retrigger) |
| `4xy`  | vibrato: rate x·2 Hz, depth y·12 cents. `400` keeps previous settings |
| `5xy`  | tone porta (last 3xx target) + volume slide |
| `6xy`  | vibrato + volume slide |
| `7xy`  | tremolo: rate x·2 Hz, depth y/16 |
| `8xx`  | set pan: 00 = hard left, 80 = center, FF = hard right |
| `Axy`  | volume slide per tick: **x/64 up, y/64 down** (A04 = slide DOWN, A40 = up) |
| `Bxx`  | position jump to order index xx (**hex**) |
| `Cxx`  | set volume xx/64 |
| `Dxy`  | pattern break: next order entry, row x·10+y (**decimal digits**, max 99) |
| `E1x`  | fine porta up x/16 semitone, once |
| `E2x`  | fine porta down, once |
| `E6x`  | pattern loop: y=0 marks loop start at this row; y>0 jumps back y times |
| `E9x`  | retrigger note every x ticks (**resets each row** — repeat it on every row you want it) |
| `EAx`  | fine volume up x/64, once |
| `EBx`  | fine volume down, once |
| `ECx`  | hard note cut at tick x |
| `EDx`  | note delay: trigger the note x ticks into the row |
| `EEx`  | pattern delay: hold this row for x extra rows (notes do NOT retrigger during the hold) |
| `Fxx`  | xx < 0x20 → speed (ticks/row); xx ≥ 0x20 → tempo in **decimal** BPM (F7D = 125) |
| `Kxx`  | key off (same as OFF) |
| `Pxy`  | pan slide per tick: (x−y)/64 |
| `Rxy`  | retrigger every y ticks with volume slide x (0 none, 1–8 down, 9–F up) |
| `Txy`  | tremor: x+1 ticks on, y+1 ticks off, repeating (hard gate) |

Multiple effects per cell: `fx: ["432", "A04"]` or string `"C-5 432 A04"`.
Command letters are case-insensitive; digits are hex.

---

## Volume column (FT2-style second slot)

`Vxx` token in strings, `vcol` in objects. One byte, hex 00–FF. Independent of the
effect column — **slides from both columns stack**. Vibrato/porta share state with
the effect column.

| value   | action |
|---------|--------|
| `00–40` | set volume (val/64) |
| `50`    | pan preset (fixed position — use effect `8xx` for exact pan) |
| `60–6F` | volume slide down, param/64 per tick |
| `70–7F` | volume slide up |
| `80–8F` | fine volume slide down, once |
| `90–9F` | fine volume slide up, once |
| `A0–AF` | vibrato speed (param·2 Hz) |
| `B0–BF` | vibrato depth (param·12 cents) |
| `C0–CF` | pan slide left, param/64 per tick |
| `D0–DF` | pan slide right |
| `E0–EF` | tone porta speed, param/64 |

Classic use: arpeggio in the effect column + pan slides in the volume column on the
same channel, e.g. `"C-4 VD2 037"` → `{ note: "C-4", vcol: "D2", fx: "037" }`.

---

## Instruments

This is where the character lives. Base fields:

```js
{ wave: "pulse", duty: 0.25, gain: 0.4, adsr: [0.01, 0.1, 0.6, 0.08] }
```

- `wave`: `"sine"`, `"square"`, `"triangle"`, `"saw"` (or `"sawtooth"`),
  `"pulse"` (band-limited, `duty` 0..1), `"noise"` (looped buffer, pitched by playbackRate).
- `adsr`: `[attack, decay, sustain, release]` — a/d/r in seconds, sustain is a level 0..1.
- `gain`: output level (keep leads ~0.3–0.45, kicks ~0.8–0.9; the mix sums).
- `filter`: `{ type: "lowpass"|"highpass"|"bandpass", frequency: Hz, Q }`.

Expressive features (all optional, all code-only):

| feature | spec | what it does |
|---------|------|--------------|
| `unison` | `{voices: 3, detune: 20, spread: 0.8}` | stacked detuned oscillators (cents spread). Fat leads/pads/reese. Optional `spread` 0..1 fans the voices across the stereo field (0 = mono, the default) |
| `drive` | `0..1` | tanh waveshaper grit. Acid bass, hot leads |
| `filterEnv` | `{amount: 3000, adsr: [a,d,s,r]}` | cutoff sweep around `filter.frequency` (Hz amount) |
| `pitchEnv` | `{amount: 24, decay: 0.08}` | start +N semitones, exponential fall to pitch. Kicks, lasers |
| `vibrato` | `{rate: 6, depth: 25, delay: 0.1}` | auto vibrato (Hz, cents, seconds before onset) |
| `arp` | `{notes: [0,4,7], speed: 1}` | auto arpeggio; speed = **rows** per step |
| `tremolo` | `{rate: 8, depth: 0.4}` | amplitude wobble |
| `glide` | `0.05` | auto portamento (seconds) from the channel's previous note |
| `volumeEnv` | `{points: [[tick, level], ...], sustain: idx, loop: [a,b], fadeout: ticks}` | XM-style envelope, overrides ADSR while active. Levels 0..1, ticks from note start |
| `panEnv` | `{points: [[tick, pan], ...], sustain: idx, loop: [a,b]}` | panning envelope, pan −1..1, adds to channel pan |

Cell-level `slide`/`vib`/`arp`/`fx` override the instrument's behavior for that note.
Instrument recipes worth stealing:

- **Reese bass**: saw, unison 2 detune 30, drive 0.3, lowpass 180 Hz Q5 + filterEnv.
- **Kick**: sine, pitchEnv {amount: 20–28, decay: 0.05–0.07}, adsr [0.002, 0.1, 0, 0.04].
- **Rhodes-ish stab**: pulse 0.25, volumeEnv with fast attack and decaying points.
- **Supersaw lead**: saw, unison 4 detune 22, drive 0.35, vibrato with delay, glide.
- **Evolving pad**: saw unison 3, slow filterEnv (attack ~1s), panEnv loop, tremolo.

---

## SoundFont instruments

Any instrument can play a General MIDI program from an attached `ActionSoundFont`
instead of the oscillator synth. Mix both freely in one song.

```js
instruments: {
    piano: { sf2: 0,  gain: 0.8 },                         // GM program number
    vibes: { sf2: 11, vibrato: { rate: 5, depth: 12, delay: 0.25 } },
    kit:   { sf2: "drums", kit: 25, ring: 2 }              // percussion on MIDI ch 9
}
// cells: notes as usual; an array plays a chord on sf2 channels
{ note: ["C-4", "E-4", "G-4"], len: 8 }
```

| field  | meaning |
|--------|---------|
| `sf2`  | GM program 0..127, or `"drums"` for the percussion kit |
| `bank` | optional bank number |
| `kit`  | drum kit: 0 Standard, 8 Room, 16 Power, 24 Electronic, 25 TR-808, 32 Jazz, 40 Brush, 48 Orchestra |
| `ring` | cymbal ring-out in seconds (default 3) |
| `gain` | scales note velocity |
| `level` | linear channel gain after velocity (default 1, may exceed 1) — evens out samples recorded at very different levels |

Attach the player once it has loaded:

```js
await audio.initializeMIDI();                 // loads the bundled TimGM6mb soundfont
audio.tracker.setSoundFont(audio.sf2Player);
```

Each sf2 instrument gets its own MIDI channel (15 melodic + drums). Pitch effects
(porta, slides, arp, vibrato) ride pitch bend (±12 semitones), volume/tremolo/mute
ride per-note expression, and the soundfont's own envelope shapes the note — synth
fields like `adsr`, `filter`, `unison` don't apply. On synth channels a chord array
plays only its top note.

---

## Transport handle & API

```js
const handle = tracker.play(song, { volume: 0.9, loop: false, onEnd, onRow });
handle.stop();  handle.pause();  handle.resume();
handle.setVolume(0.5);
handle.setMute(channelIndex, true);   // silence one channel
handle.setSolo(channelIndex, true);   // when ANY solo is active, only soloed channels sound
handle.isPlaying;  handle.isPaused;
handle.position;   // {order, row, tick, pattern} — what is being heard right now
handle.orderIndex; handle.row;
handle._state;     // {tempo, speed, orderIndex, row, tick, ...} live internals
handle._channels;  // per-channel state (muted/solo flags, vol, pan, voice...)
```

`onRow(orderIndex, row, audioTime)` fires per row — use it to drive visuals. On the audio-thread engine it fires as the row plays (a few ms after `audioTime`); on the node engine, when the row is scheduled, ahead of it.
`onEnd()` fires when a non-looping song finishes.

### Starting mid-song

```js
tracker.play(song, { startOrder: 12, startRow: 0 });   // begin at order index 12
```

`startOrder` (order-list index) and `startRow` start playback anywhere. Every `Fxx`
tempo/speed change before that point is replayed first, so the song comes in at the
tempo it would have had at that spot. Pattern loops (`E6x`) and jumps (`Bxx`/`Dxx`)
before the start point are not simulated.

### Long lookahead (node engine only)

Ignored on the audio-thread engine, which needs no lookahead.

```js
tracker.play(song, { lookahead: 0.5 });   // seconds scheduled ahead of the audio clock
```

The scheduler runs on the main thread, so a stall there (UI work, game logic,
garbage collection, recording) longer than the lookahead makes notes late. The
default is short (0.12 s for synth songs, 0.1 s with soundfont channels).
`lookahead` raises it for **this playback only**, so music shrugs off long stalls.

- It does **not** delay the start of playback: the first note still sounds right away.
- `stop()`, `pause()`, `setVolume()`, `setMute()` and `setSolo()` stay instant
  (they act on gain nodes after the queued notes and cancel queued soundfont notes).
- `handle.position` reports what is audible, not how far the scheduler has run.
- `onRow` fires when a row is *scheduled*, up to `lookahead` early; its `audioTime`
  argument says when it will be heard.
- Sound effects and anything else played without the option are unaffected.

Don't use it for anything that must react to gameplay instantly mid-song (for
example tempo or effect changes driven by the game), since queued rows are
already committed.

One-shot SFX:

```js
tracker.playSfx({
    inst: { wave: "saw", adsr: [0.001, 0.12, 0, 0.04], gain: 0.5 },
    note: "A-5", len: 1, slide: -30, vol: 0.6
});
// or pass a tiny song object ({patterns, order}) for multi-note SFX (coin, jingle).
```

Also: `tracker.setVolume(0..1)` (master), `tracker.stopAll()`.

### Offline render / WAV export

```js
const buffer = await audio.render("song", { mute: [false, true], onProgress: (p) => {} });
const blob = ActionAudioManager.encodeWav(buffer);     // 16-bit stereo WAV
```

Renders one pass of a tracker sound (by name) or a song object in an
OfflineAudioContext — much faster than real time — ending exactly on the song's last
tick. Same output as live playback through the tracker, before the master volume.
Options: `startOrder`, `startRow`, `volume`, `sampleRate`, `mute` / `solo`
(arrays of booleans by channel), `onProgress(0..1)`. Loads the soundfont if the song
needs it. `tracker.songDuration(song)` gives the length of one pass without playing.

### AudioManager integration

```js
audio.createSound("song", songData, "tracker");   // register
audio.unlock();                                  // on first user gesture
const instance = audio.play("song");             // returns wrapper
instance.trackerHandle;                          // the real handle (mute/solo/position)
audio.stopSound("song");
```

The tracker is created lazily at `audio.tracker`. Load order in HTML:
`actiontracker.js` after `audiomanager.js`, before your game script.

---

## Composing actual songs (the workflow that works)

1. **Chord data first.** A map of chord name → `{bass, root, pad, iv: [intervals]}`.
   Extended chords (9ths, 13ths) sound richer than triads.
2. **Bar builders.** A helper that takes (chord, options) and returns the literal
   16-row grid: `bar(chord, {drums: "shuffle", bass: "roll", lead: [...], pad: true})`.
   Options control layer density — that's your arrangement dynamics.
3. **Hand-compose the hook.** `[row, note, gateRows, fx?]` tuples per chord.
   Rhythmic motif (short-short-long), question/answer phrasing, variation on repeat.
   Do NOT generate the melody algorithmically — it shows.
4. **Drum tables by intensity.** none → pulse → light → std → shuffle → drive.
   DnB = syncopated kick (0, 7, 10, 13), NOT four-on-the-floor. Ghost snares at low vol.
5. **Arrangement = the order list.** Reuse patterns, shift progressions between
   sections, build → gap of silence → drop. For long tracks, generate distinct
   patterns per section and bring layers in one at a time.
6. **Effects serve the music.** Vibrato on held notes like a singer, porta risers
   into drops, retrigger snare crescendos, tremor gates as a production choice,
   F03 for a half-time breakdown, E6x loops for tension, EE1 for the dramatic hold.

---

## Gotchas (learned the hard way)

- `A04` slides **down**. x = up, y = down. Same for `Pxy` (x right, y left).
- `Bxx` order index is **hex**; `Dxy` target row is **decimal digits** (x·10+y).
- `Fxx`: below 0x20 it's speed, at/above it's decimal BPM. `F03` = half-time feel,
  `F7D` = 125 BPM. Changes take effect from the next tick.
- `E9x`/`Rxy` reset every row — put them on **each row** you want retriggering.
- `0xy` arpeggio dies when the effect is absent from the next row; instrument
  `arp` persists. Cell `arp: [...]` cycles per tick, instrument arp per N rows.
- `3xx` tone porta needs a note in the cell AND a ringing voice — it glides the
  old voice, no retrigger. Great for vocal-style slides between chord tones.
- `---` = effect-only row (note keeps ringing). `null` = empty (per-row effects
  reset, note keeps ringing). `OFF` = release. `ECx` = hard cut at tick x.
- `EEx` holds the row without retriggering notes (replay flag) — safe to use.
- `E6x`: `E60` marks the loop start row; `E62` later jumps back twice, then falls through.
- Instrument names take priority over effect tokens in string cells, so an
  instrument called `pad` works as `"C-4 pad"`. Flip side: an instrument named like
  an effect (`"A04"`) shadows that effect in string form — use object cells then.
- Note strings need the octave digit: `"C-5"` yes, `"C"` no. `Bb-1` is valid (flat syntax).
- `volumeEnv` overrides ADSR while the voice lives; `fadeout` applies after key-off.
- Keep an eye on gain staging: 10 channels × 0.5 gain will clip. Lead ~0.35,
  bass ~0.45, pads ~0.12, kicks ~0.85 is a working balance.
- The pump has a 512-tick guard per wake-up — if you simulate time jumps in tests,
  advance `context.currentTime` in small increments and call `handle._pump()`.
- Testing without a browser: mock AudioContext with Proxy-based no-op nodes
  (`createGain/Oscillator/BufferSource/BiquadFilter/WaveShaper/StereoPanner/PeriodicWave`,
  params need `setValueAtTime/linearRampToValueAtTime/setTargetAtTime/cancelScheduledValues`,
  oscillators need `detune`).

---

## File map

```
actionengine/sound/actiontracker.js   the engine (this doc's subject)
actionengine/sound/audiomanager.js    "tracker" sound type, getTracker(), render(), unlock()
actionengine/sound/actionaudioworklet.js  the audio-thread engine; runs this tracker's code
                                      (actiontracker.js must be loaded before unlock())
actionengine/sound/soundfont/         ActionSoundFont player + bundled TimGM6mb (sf2 instruments)
```

Go write a banger.