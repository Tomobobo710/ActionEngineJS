//actionengine/sound/soundfont/actionsoundfont.js
// ActionSoundFont - Custom SoundFont player implementation
// Drop-in replacement for 3rd party sf2-player library

/**
 * ActionSoundFont Class
 * Provides SoundFont2 playback capabilities using Web Audio API
 */
class ActionSoundFont {
  constructor(ctx) {
    this.ctx = ctx;
    this.synth = null;
    this._channel = 0;
    this._bankIndex = 0;
    this._programIndex = 0;
  }

  set channel(channel) {
    this._channel = channel;
  }

  set bank(index) {
    this._bankIndex = index;
    if (this.synth) {
      this.synth.bankChange(this._channel, index);
    }
  }

  get banks() {
    if (!this.synth || !this.synth.programSet) return [];
    return Object.keys(this.synth.programSet).map((id) => ({
      id,
      name: ("000" + parseInt(id, 10)).slice(-3)
    }));
  }

  set program(index) {
    this._programIndex = index;
    if (this.synth) {
      this.synth.programChange(this._channel, index);
    }
  }

  get programs() {
    if (!this.synth || !this.synth.programSet) return [];
    const { programSet } = this.synth;
    return Object.keys(programSet[this._bankIndex] || {}).map((id) => ({
      id,
      name: ("000" + (parseInt(id, 10) + 1)).slice(-3) + ":" + programSet[this._bankIndex][id]
    }));
  }

  /**
   * Load SoundFont from base64 encoded data
   * @param {string} base64String - Base64 encoded SF2 data
   */
  async loadSoundFontFromBase64(base64String) {
    const base64 = base64String.split(",")[1] || base64String;

    let uint8Array;
    if (Uint8Array.fromBase64) {
      uint8Array = Uint8Array.fromBase64(base64);
    } else {
      const binaryString = atob(base64);
      const len = binaryString.length;
      uint8Array = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
    }

    await this.bootSynth(uint8Array.buffer);
  }

  /**
   * Load a SoundFont chainloaded via SF2Loader (many small chunk .js files
   * instead of one multi-megabyte script). See sf2loader.js.
   * @param {string} packageName - name registered by an SF2Index.js, e.g. "TimGM6mb"
   * @param {Function} [onProgress] - called with a fraction 0..1 as chunks load
   */
  async loadSoundFontPackage(packageName, onProgress = null) {
    const bytes = await SF2Loader.load(packageName, onProgress);
    await this.bootSynth(bytes.buffer);
  }

  /**
   * Boot the synthesizer with SF2 data
   * @param {ArrayBuffer} arrayBuffer - SF2 file data
   */
  async bootSynth(arrayBuffer) {
    const input = new Uint8Array(arrayBuffer);
    this.synth = new ActionSynthesizer(input, this.ctx);
    this.synth.init();
    this.synth.start();

    // Wait for programSet to be populated
    await this.waitForReference(() => this.synth.programSet);
  }

  /**
   * Wait for a reference to be defined
   * @param {Function} refGetter - Function that returns the reference to wait for
   */
  waitForReference(refGetter) {
    return new Promise((resolve) => {
      const check = () => {
        const ref = refGetter();
        if (ref !== undefined && Object.keys(ref).length > 0) {
          resolve();
        } else {
          setTimeout(check, 16);
        }
      };
      check();
    });
  }

  /**
   * Play a MIDI note
   * @param {number} midiNumber - MIDI note number (0-127)
   * @param {number} velocity - Note velocity (0-127)
   * @param {number} channel - MIDI channel (0-15)
   */
  noteOn(midiNumber, velocity = 127, channel, when, offset = 0) {
    if (!this.synth) return;
    this.synth.noteOn(channel !== undefined ? channel : this._channel, midiNumber, velocity, when, offset);
  }

  /**
   * Stop a MIDI note
   * @param {number} midiNumber - MIDI note number (0-127)
   * @param {number} velocity - Release velocity (0-127)
   * @param {number} channel - MIDI channel (0-15)
   */
  noteOff(midiNumber, velocity = 127, channel, when) {
    if (!this.synth) return;
    this.synth.noteOff(channel !== undefined ? channel : this._channel, midiNumber, when);
  }
}

/**
 * ActionSynthesizer Class
 * Core synthesizer engine for SoundFont playback
 */
class ActionSynthesizer {
  constructor(input, ctx) {
    this.input = input;
    this.ctx = ctx || this.getAudioContext();
    this.parser = null;
    this.bank = 0;
    this.bankSet = [];
    this.programSet = {};

    // Audio nodes
    this.gainMaster = this.ctx.createGain();
    this.bufSrc = this.ctx.createBufferSource();

    // Per-channel output gain: every note (including release tails and
    // percussion ring-outs) routes through its channel's node, so muting a
    // channel silences all of its sound, not just currently-held notes.
    this.channelGain = Array.from({ length: 16 }, () => {
      const g = this.ctx.createGain();
      g.connect(this.gainMaster);
      return g;
    });

    // MIDI channel state (16 channels)
    this.channelInstrument = new Array(16).fill(0);
    this.channelBank = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 127, 0, 0, 0, 0]; // Channel 10 = drums
    this.channelVolume = new Array(16).fill(127);
    this.channelPanpot = new Array(16).fill(64);
    this.channelPitchBend = new Array(16).fill(8192);
    this.channelPitchBendSensitivity = new Array(16).fill(2);
    this.channelExpression = new Array(16).fill(127);
    this.channelHold = new Array(16).fill(false);

    // Percussion settings
    this.percussionPart = [
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      false,
      false,
      false
    ];
    this.percussionVolume = new Array(128).fill(127);
    this.percussionRing = new Array(16).fill(3);

    // Active notes
    this.currentNoteOn = Array.from({ length: 16 }, () => []);

    // Volume settings
    this.baseVolume = 1 / 0xffff;
    this.masterVolume = 16384;

    // Per-channel reverb (created on first use): a shared bus would keep a
    // muted channel's wet signal audible through every other channel's output.
    this.reverb = new Array(16).fill(null);
  }

  init(mode = "GM") {
    this.gainMaster.disconnect();

    // Parse SF2 file
    this.parser = new ActionParser(this.input, {
      sampleRate: this.ctx.sampleRate
    });
    this.bankSet = this.createAllInstruments();

    // Reset all channels
    for (let i = 0; i < 16; i++) {
      this.programChange(i, 0x00);
      this.volumeChange(i, 0x64);
      this.panpotChange(i, 0x40);
      this.pitchBend(i, 0x00, 0x40);
      this.pitchBendSensitivity(i, 2);
      this.channelHold[i] = false;
      this.channelExpression[i] = 127;
      this.channelBank[i] = i === 9 ? 127 : 0;
    }

    this.setPercussionPart(9, true);
    this.gainMaster.connect(this.ctx.destination);
  }

  start() {
    this.connect();
    this.bufSrc.start(0);
    this.setMasterVolume(16383);
  }

  connect() {
    this.bufSrc.connect(this.gainMaster);
  }

  setMasterVolume(volume) {
    this.masterVolume = volume;
    this.gainMaster.gain.value = this.baseVolume * (volume / 16384);
  }

  createAllInstruments() {
    const { parser } = this;
    parser.parse();

    const presets = parser.createPreset();
    const instruments = parser.createInstrument();
    const banks = [];
    const programSet = [];

    for (let i = 0; i < presets.length; i++) {
      const preset = presets[i];
      const presetNumber = preset.header.preset;
      const bankNumber = preset.header.bank;
      const presetName = preset.name.replace(/\0*$/, "");

      if (typeof preset.instrument !== "number") continue;

      const instrument = instruments[preset.instrument];
      if (instrument.name.replace(/\0*$/, "") === "EOI") continue;

      if (banks[bankNumber] === undefined) {
        banks[bankNumber] = [];
      }

      const bank = banks[bankNumber];
      bank[presetNumber] = { name: presetName };

      // A preset can have several zones, each pointing at a different
      // instrument (drum kits spread their keys across many instruments).
      for (let z = 0; z < preset.info.length; z++) {
        const zone = preset.info[z];
        const instRef = zone.generator.instrument;
        if (instRef === undefined) continue;
        const instrument = instruments[instRef.amount];
        if (!instrument || instrument.name.replace(/\0*$/, "") === "EOI") continue;
        const presetRange = zone.generator.keyRange || { lo: 0, hi: 127 };
        for (let j = 0; j < instrument.info.length; j++) {
          this.createNoteInfo(parser, instrument.info[j], bank[presetNumber], presetRange);
        }
      }

      if (!programSet[bankNumber]) {
        programSet[bankNumber] = {};
      }
      programSet[bankNumber][presetNumber] = presetName;
    }

    this.programSet = programSet;
    return banks;
  }

  createNoteInfo(parser, info, preset, presetRange = { lo: 0, hi: 127 }) {
    const generator = info.generator;
    if (generator.keyRange === undefined || generator.sampleID === undefined) return;

    const getAmount = (gen, key, defaultVal = 0) => {
      return gen[key] ? gen[key].amount : defaultVal;
    };

    const volAttack = getAmount(generator, "attackVolEnv", -12000);
    const volDecay = getAmount(generator, "decayVolEnv", -12000);
    const volSustain = getAmount(generator, "sustainVolEnv");
    const volRelease = getAmount(generator, "releaseVolEnv", -12000);
    const tune = getAmount(generator, "coarseTune") + getAmount(generator, "fineTune") / 100;
    const scale = getAmount(generator, "scaleTuning", 100) / 100;

    const lo = Math.max(generator.keyRange.lo, presetRange.lo);
    const hi = Math.min(generator.keyRange.hi, presetRange.hi);
    for (let i = lo; i <= hi; i++) {
      if (preset[i]) continue;

      const sampleId = getAmount(generator, "sampleID");
      const sampleHeader = parser.sampleHeader[sampleId];

      preset[i] = {
        sample: parser.sample[sampleId],
        sampleRate: sampleHeader.sampleRate,
        sampleModes: getAmount(generator, "sampleModes"),
        basePlaybackRate: Math.pow(
          1.0594630943592953,
          (i -
            getAmount(generator, "overridingRootKey", sampleHeader.originalPitch) +
            tune +
            sampleHeader.pitchCorrection / 100) *
            scale
        ),
        start: getAmount(generator, "startAddrsCoarseOffset") * 32768 + getAmount(generator, "startAddrsOffset"),
        end: getAmount(generator, "endAddrsCoarseOffset") * 32768 + getAmount(generator, "endAddrsOffset"),
        loopStart:
          sampleHeader.startLoop +
          getAmount(generator, "startloopAddrsCoarseOffset") * 32768 +
          getAmount(generator, "startloopAddrsOffset"),
        loopEnd:
          sampleHeader.endLoop +
          getAmount(generator, "endloopAddrsCoarseOffset") * 32768 +
          getAmount(generator, "endloopAddrsOffset"),
        volAttack: Math.pow(2, volAttack / 1200),
        volDecay: Math.pow(2, volDecay / 1200),
        volSustain: volSustain / 1000,
        volRelease: Math.pow(2, volRelease / 1200),
        initialAttenuation: getAmount(generator, "initialAttenuation"),
        initialFilterFc: getAmount(generator, "initialFilterFc", 13500),
        initialFilterQ: getAmount(generator, "initialFilterQ"),
        pan: getAmount(generator, "pan") ? getAmount(generator, "pan") / 1200 : undefined
      };
    }
  }

  /**
   * @param {number} [when] - AudioContext time to start at (default: now). Lets a
   *   sequencer schedule soundfont notes on the audio clock like oscillators.
   */
  noteOn(channel, key, velocity, when, offset = 0) {
    const bankIndex = this.channelBank[channel];
    let bank = this.bankSet[bankIndex] || this.bankSet[0];

    if (!bank) {
      console.warn("No valid bank found");
      return;
    }

    let instrument;
    if (bank[this.channelInstrument[channel]]) {
      instrument = bank[this.channelInstrument[channel]];
    } else if (this.percussionPart[channel]) {
      instrument = this.bankSet[128]?.[0] || this.bankSet[0]?.[0];
    } else {
      instrument = this.bankSet[0]?.[this.channelInstrument[channel]];
    }

    if (!instrument || !instrument[key]) {
      console.warn(`Instrument not found: bank=${bankIndex} program=${this.channelInstrument[channel]} key=${key}`);
      return;
    }

    const instrumentKey = instrument[key];
    let panpot = this.channelPanpot[channel] === 0 ? (Math.random() * 127) | 0 : this.channelPanpot[channel] - 64;
    panpot /= panpot < 0 ? 64 : 63;

    // Create note information
    instrumentKey.channel = channel;
    instrumentKey.key = key;
    instrumentKey.velocity = velocity;
    instrumentKey.panpot = panpot;
    instrumentKey.volume = this.channelVolume[channel] / 127;
    instrumentKey.pitchBend = this.channelPitchBend[channel] - 8192;
    instrumentKey.expression = this.channelExpression[channel];
    instrumentKey.pitchBendSensitivity = Math.round(this.channelPitchBendSensitivity[channel]);
    instrumentKey.reverb = this.reverb[channel] || (this.reverb[channel] = new ActionReverb(this.ctx, { mix: 0.315 }));
    instrumentKey.percussionOneShot = this.percussionPart[channel];
    instrumentKey.ringTime = this.percussionRing[channel];

    // Play the note
    const note = new ActionSynthesizerNote(this.ctx, this.channelGain[channel], instrumentKey);
    note.noteOn(when, offset);
    this.currentNoteOn[channel].push(note);
  }

  /**
   * @param {number} [when] - AudioContext time to release at (default: now). Only
   *   notes that start at or before `when` are released, so a note queued later on
   *   the same key is left alone.
   */
  noteOff(channel, key, when) {
    const currentNoteOn = this.currentNoteOn[channel];
    const hold = this.channelHold[channel];

    for (let i = currentNoteOn.length - 1; i >= 0; i--) {
      const note = currentNoteOn[i];
      if (note.key === key && (when === undefined || note.startTime <= when + 1e-6)) {
        note.noteOff();
        if (!hold) {
          note.release(when);
          currentNoteOn.splice(i, 1);
        }
      }
    }
  }

  programChange(channel, instrument) {
    this.channelInstrument[channel] = instrument;
    this.bankChange(channel, this.channelBank[channel]);
  }

  bankChange(channel, bank) {
    if (this.bankSet[bank]) {
      this.channelBank[channel] = bank;
    } else if (this.percussionPart[channel]) {
      this.channelBank[channel] = 128;
    } else {
      this.channelBank[channel] = 0;
    }
  }

  volumeChange(channel, volume) {
    this.channelVolume[channel] = volume;
  }

  panpotChange(channel, panpot) {
    this.channelPanpot[channel] = panpot;
  }

  pitchBend(channel, lowerByte, higherByte, when) {
    const bend = (lowerByte & 0x7f) | ((higherByte & 0x7f) << 7);
    const calculated = bend - 8192;

    const currentNoteOn = this.currentNoteOn[channel];
    for (let i = 0; i < currentNoteOn.length; i++) {
      currentNoteOn[i].updatePitchBend(calculated, when);
    }

    this.channelPitchBend[channel] = bend;
  }

  pitchBendSensitivity(channel, sensitivity) {
    this.channelPitchBendSensitivity[channel] = sensitivity;
  }

  setPercussionPart(channel, sw) {
    this.channelBank[channel] = 128;
    this.percussionPart[channel] = sw;
  }

  setPercussionRing(channel, seconds) {
    this.percussionRing[channel] = Math.max(0.1, seconds);
  }

  setChannelGain(channel, value) {
    const g = this.channelGain[channel].gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(Math.max(0, value), now + 0.02);
  }

  getAudioContext() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.createGain = ctx.createGain || ctx.createGainNode;
    return ctx;
  }
}

/**
 * ActionSynthesizerNote Class
 * Represents a single playing note
 */
class ActionSynthesizerNote {
  /** @type {WeakMap<Float32Array, Map<string, AudioBuffer>>} */
  static #buffers = new WeakMap();

  static bufferFor(ctx, instrument) {
    const src = instrument.sample;
    const key = `${instrument.end || 0}|${instrument.sampleRate}`;
    let byKey = ActionSynthesizerNote.#buffers.get(src);
    if (!byKey) ActionSynthesizerNote.#buffers.set(src, (byKey = new Map()));
    let buffer = byKey.get(key);
    if (!buffer) {
      const sample = src.subarray(0, src.length + (instrument.end || 0));
      buffer = ctx.createBuffer(1, sample.length, instrument.sampleRate);
      buffer.getChannelData(0).set(sample);
      byKey.set(key, buffer);
    }
    return buffer;
  }

  constructor(ctx, destination, instrument) {
    this.ctx = ctx;
    this.destination = destination;
    this.instrument = instrument;
    this.key = instrument.key;
    this.velocity = instrument.velocity;
    this.noteOffState = false;

    // Audio nodes
    this.bufferSource = ctx.createBufferSource();
    this.panner = ctx.createPanner();
    this.outputGainNode = ctx.createGain();
    this.expressionGainNode = ctx.createGain();
    this.filter = ctx.createBiquadFilter();
  }

  // offset: samples to skip into the sample (tracker 9xx sample offset)
  noteOn(when, offset = 0) {
    const ctx = this.ctx;
    const instrument = this.instrument;
    const now = Math.max(ctx.currentTime, when ?? 0);
    this.startTime = now;

    // Audio buffer for this sample: built once and reused. Copying the whole sample
    // into a fresh buffer on every note stalled the main thread (and the garbage it
    // left behind caused GC pauses), which made scheduled notes land late - clicks.
    const audioBuffer = ActionSynthesizerNote.bufferFor(ctx, instrument);

    // Setup buffer source
    this.bufferSource.buffer = audioBuffer;
    this.bufferSource.loop = (instrument.sampleModes & 1) !== 0;
    this.bufferSource.loopStart = (instrument.loopStart || 0) / instrument.sampleRate;
    this.bufferSource.loopEnd = (instrument.loopEnd || sample.length) / instrument.sampleRate;
    this.bufferSource.playbackRate.value = instrument.basePlaybackRate;

    // Setup panner
    this.panner.panningModel = "equalpower";
    const pan = instrument.pan !== undefined ? instrument.pan : instrument.panpot;
    this.panner.setPosition(Math.sin((pan * Math.PI) / 2), 0, Math.cos((pan * Math.PI) / 2));

    // Setup filter
    this.filter.type = "lowpass";
    this.filter.frequency.value = this.amountToFreq(instrument.initialFilterFc);
    this.filter.Q.value = Math.pow(10, (instrument.initialFilterQ || 0) / 200);

    // Setup expression
    this.expressionGainNode.gain.value = (instrument.expression || 127) / 127;

    // Setup volume envelope (ADSR)
    let volume = instrument.volume * (this.velocity / 127) * (1 - (instrument.initialAttenuation || 0) / 1000);
    volume = Math.max(0, volume);

    const outputGain = this.outputGainNode.gain;
    const tau = instrument.volAttack || 0.01;
    outputGain.value = 0;
    outputGain.setValueAtTime(0, now);
    outputGain.setTargetAtTime(volume, now, tau);
    const attackEnd = now + tau * 3;
    outputGain.setValueAtTime(volume, attackEnd);
    // Envelope shape, kept so a release scheduled for a later time knows the level
    // it starts from (see levelAt).
    this.env = { t0: now, tau, attackEnd, volume, ring: null, decayEnd: 0, sustain: 0 };
    if (instrument.percussionOneShot && (instrument.sampleModes & 1)) {
      // Loop-mode drums (cymbals): ring out over ringTime, fading immediately.
      const ring = instrument.ringTime ?? 3;
      outputGain.linearRampToValueAtTime(0, now + ring);
      this.ringStopTime = now + ring;
      this.env.ring = now + ring;
    } else {
      this.env.decayEnd = attackEnd + (instrument.volDecay || 0.1);
      this.env.sustain = volume * (instrument.volSustain || 0.7);
      outputGain.linearRampToValueAtTime(this.env.sustain, this.env.decayEnd);
    }

    // Connect nodes
    this.bufferSource.connect(this.filter);
    this.filter.connect(this.panner);
    this.panner.connect(this.expressionGainNode);
    this.expressionGainNode.connect(this.outputGainNode);

    // Connect through reverb
    this.connect();

    // Start playback
    const startTime = ((instrument.start || 0) + (offset || 0)) / instrument.sampleRate;
    this.bufferSource.start(now, startTime);
    if (this.ringStopTime !== undefined) this.bufferSource.stop(this.ringStopTime);
  }

  connect() {
    if (this.instrument.reverb) {
      this.instrument.reverb.connect(this.outputGainNode).connect(this.destination);
    } else {
      this.outputGainNode.connect(this.destination);
    }
  }

  disconnect() {
    try {
      this.outputGainNode.disconnect();
    } catch (e) {}
  }

  noteOff() {
    this.noteOffState = true;
  }

  isNoteOff() {
    return this.noteOffState;
  }

  // Envelope level at audio time t, from the shape scheduled in noteOn.
  levelAt(t) {
    const e = this.env;
    if (!e || t <= e.t0) return 0;
    if (t < e.attackEnd) return e.volume * (1 - Math.exp(-(t - e.t0) / e.tau));
    if (e.ring !== null) return t >= e.ring ? 0 : e.volume * (1 - (t - e.attackEnd) / (e.ring - e.attackEnd));
    if (t >= e.decayEnd) return e.sustain;
    return e.volume + (e.sustain - e.volume) * ((t - e.attackEnd) / (e.decayEnd - e.attackEnd));
  }

  /** @param {number} [when] - AudioContext time to release at (default: now). */
  release(when) {
    const ctx = this.ctx;
    const now = Math.max(ctx.currentTime, when ?? 0);
    const instrument = this.instrument;
    const releaseTime = instrument.volRelease || 0.3;
    const outputGain = this.outputGainNode.gain;

    // Released before it ever started (a queued note dropped by stop): never play it.
    if (this.startTime !== undefined && now <= this.startTime && ctx.currentTime < this.startTime) {
      outputGain.cancelScheduledValues(0);
      outputGain.value = 0;
      try { this.bufferSource.stop(this.startTime); } catch (e) {}
      return;
    }

    // Fade from the level the envelope will actually be at `now`. cancelAndHold keeps
    // an in-progress ramp's value; without it, compute the level from the envelope.
    // Only for a release happening now: scheduled ahead, Chrome starts the following
    // ramp from the previous event (end of decay), so the note fades from its attack.
    if (outputGain.cancelAndHoldAtTime && now <= ctx.currentTime + 0.005) {
      outputGain.cancelAndHoldAtTime(now);
    } else {
      outputGain.cancelScheduledValues(now);
      outputGain.setValueAtTime(this.levelAt(now), now);
    }
    outputGain.linearRampToValueAtTime(0, now + releaseTime);

    if (instrument.sampleModes === 1 || instrument.sampleModes === 3) {
      this.bufferSource.stop(now + releaseTime);
    } else {
      this.bufferSource.stop(now + releaseTime + 0.05);
    }
  }

  updatePitchBend(pitchBend, when) {
    const semitones = (pitchBend / (pitchBend < 0 ? 8192 : 8191)) * this.instrument.pitchBendSensitivity;
    const newRate = this.instrument.basePlaybackRate * Math.pow(2, semitones / 12);
    this.bufferSource.playbackRate.setValueAtTime(newRate, Math.max(this.ctx.currentTime, when ?? 0));
  }

  amountToFreq(val) {
    return Math.pow(2, ((val || 0) - 6900) / 1200) * 440;
  }
}

// Export to window for global access (matching original library)
window.ActionSoundFont = ActionSoundFont;
window.SoundFont = ActionSoundFont; // Also expose as SoundFont for drop-in replacement
