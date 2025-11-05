// actionengine/sound/actionsoundfont.js
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
    return Object.keys(this.synth.programSet).map(id => ({
      id,
      name: ('000' + parseInt(id, 10)).slice(-3)
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
    return Object.keys(programSet[this._bankIndex] || {}).map(id => ({
      id,
      name: ('000' + (parseInt(id, 10) + 1)).slice(-3) + ':' + programSet[this._bankIndex][id]
    }));
  }

  /**
   * Load SoundFont from base64 encoded data
   * @param {string} base64String - Base64 encoded SF2 data
   */
  async loadSoundFontFromBase64(base64String) {
    const base64 = base64String.split(',')[1] || base64String;
    const binaryString = atob(base64);
    const len = binaryString.length;
    const arrayBuffer = new ArrayBuffer(len);
    const uint8Array = new Uint8Array(arrayBuffer);

    for (let i = 0; i < len; i++) {
      uint8Array[i] = binaryString.charCodeAt(i);
    }

    await this.bootSynth(arrayBuffer);
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
    return new Promise(resolve => {
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
  noteOn(midiNumber, velocity = 127, channel) {
    if (!this.synth) return;
    this.synth.noteOn(channel !== undefined ? channel : this._channel, midiNumber, velocity);
  }

  /**
   * Stop a MIDI note
   * @param {number} midiNumber - MIDI note number (0-127)
   * @param {number} velocity - Release velocity (0-127)
   * @param {number} channel - MIDI channel (0-15)
   */
  noteOff(midiNumber, velocity = 127, channel) {
    if (!this.synth) return;
    this.synth.noteOff(channel !== undefined ? channel : this._channel, midiNumber, velocity);
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
    this.percussionPart = [false, false, false, false, false, false, false, false, false, true, false, false, false, false, false, false];
    this.percussionVolume = new Array(128).fill(127);
    
    // Active notes
    this.currentNoteOn = Array.from({ length: 16 }, () => []);
    
    // Volume settings
    this.baseVolume = 1 / 0xffff;
    this.masterVolume = 16384;
    
    // Shared reverb
    if (!ActionSynthesizer.sharedReverb) {
      ActionSynthesizer.sharedReverb = new ActionReverb(this.ctx, { mix: 0.315 });
    }
    this.reverb = new Array(16).fill(ActionSynthesizer.sharedReverb);
  }

  init(mode = 'GM') {
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
      const presetName = preset.name.replace(/\0*$/, '');
      
      if (typeof preset.instrument !== 'number') continue;
      
      const instrument = instruments[preset.instrument];
      if (instrument.name.replace(/\0*$/, '') === 'EOI') continue;
      
      if (banks[bankNumber] === undefined) {
        banks[bankNumber] = [];
      }
      
      const bank = banks[bankNumber];
      bank[presetNumber] = { name: presetName };
      
      for (let j = 0; j < instrument.info.length; j++) {
        this.createNoteInfo(parser, instrument.info[j], bank[presetNumber]);
      }
      
      if (!programSet[bankNumber]) {
        programSet[bankNumber] = {};
      }
      programSet[bankNumber][presetNumber] = presetName;
    }
    
    this.programSet = programSet;
    return banks;
  }

  createNoteInfo(parser, info, preset) {
    const generator = info.generator;
    if (generator.keyRange === undefined || generator.sampleID === undefined) return;
    
    const getAmount = (gen, key, defaultVal = 0) => {
      return gen[key] ? gen[key].amount : defaultVal;
    };
    
    const volAttack = getAmount(generator, 'attackVolEnv', -12000);
    const volDecay = getAmount(generator, 'decayVolEnv', -12000);
    const volSustain = getAmount(generator, 'sustainVolEnv');
    const volRelease = getAmount(generator, 'releaseVolEnv', -12000);
    const tune = getAmount(generator, 'coarseTune') + getAmount(generator, 'fineTune') / 100;
    const scale = getAmount(generator, 'scaleTuning', 100) / 100;
    
    for (let i = generator.keyRange.lo; i <= generator.keyRange.hi; i++) {
      if (preset[i]) continue;
      
      const sampleId = getAmount(generator, 'sampleID');
      const sampleHeader = parser.sampleHeader[sampleId];
      
      preset[i] = {
        sample: parser.sample[sampleId],
        sampleRate: sampleHeader.sampleRate,
        sampleModes: getAmount(generator, 'sampleModes'),
        basePlaybackRate: Math.pow(1.0594630943592953, (
          i - getAmount(generator, 'overridingRootKey', sampleHeader.originalPitch) +
          tune + (sampleHeader.pitchCorrection / 100)
        ) * scale),
        start: getAmount(generator, 'startAddrsCoarseOffset') * 32768 + getAmount(generator, 'startAddrsOffset'),
        end: getAmount(generator, 'endAddrsCoarseOffset') * 32768 + getAmount(generator, 'endAddrsOffset'),
        loopStart: sampleHeader.startLoop + getAmount(generator, 'startloopAddrsCoarseOffset') * 32768 + getAmount(generator, 'startloopAddrsOffset'),
        loopEnd: sampleHeader.endLoop + getAmount(generator, 'endloopAddrsCoarseOffset') * 32768 + getAmount(generator, 'endloopAddrsOffset'),
        volAttack: Math.pow(2, volAttack / 1200),
        volDecay: Math.pow(2, volDecay / 1200),
        volSustain: volSustain / 1000,
        volRelease: Math.pow(2, volRelease / 1200),
        initialAttenuation: getAmount(generator, 'initialAttenuation'),
        initialFilterFc: getAmount(generator, 'initialFilterFc', 13500),
        initialFilterQ: getAmount(generator, 'initialFilterQ'),
        pan: getAmount(generator, 'pan') ? getAmount(generator, 'pan') / 1200 : undefined
      };
    }
  }

  noteOn(channel, key, velocity) {
    const bankIndex = this.channelBank[channel];
    let bank = this.bankSet[bankIndex] || this.bankSet[0];
    
    if (!bank) {
      console.warn('No valid bank found');
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
    instrumentKey.reverb = this.reverb[channel];
    
    // Play the note
    const note = new ActionSynthesizerNote(this.ctx, this.gainMaster, instrumentKey);
    note.noteOn();
    this.currentNoteOn[channel].push(note);
  }

  noteOff(channel, key) {
    const currentNoteOn = this.currentNoteOn[channel];
    const hold = this.channelHold[channel];
    
    for (let i = currentNoteOn.length - 1; i >= 0; i--) {
      const note = currentNoteOn[i];
      if (note.key === key) {
        note.noteOff();
        if (!hold) {
          note.release();
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

  pitchBend(channel, lowerByte, higherByte) {
    const bend = (lowerByte & 0x7f) | ((higherByte & 0x7f) << 7);
    const calculated = bend - 8192;
    
    const currentNoteOn = this.currentNoteOn[channel];
    for (let i = 0; i < currentNoteOn.length; i++) {
      currentNoteOn[i].updatePitchBend(calculated);
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

  getAudioContext() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.createGain = ctx.createGain || ctx.createGainNode;
    return ctx;
  }
}

ActionSynthesizer.sharedReverb = null;

/**
 * ActionSynthesizerNote Class
 * Represents a single playing note
 */
class ActionSynthesizerNote {
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

  noteOn() {
    const ctx = this.ctx;
    const instrument = this.instrument;
    const now = ctx.currentTime;
    
    // Create audio buffer from sample
    const sample = instrument.sample.subarray(0, instrument.sample.length + (instrument.end || 0));
    const audioBuffer = ctx.createBuffer(1, sample.length, instrument.sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    channelData.set(sample);
    
    // Setup buffer source
    this.bufferSource.buffer = audioBuffer;
    this.bufferSource.loop = (instrument.sampleModes & 1) !== 0;
    this.bufferSource.loopStart = (instrument.loopStart || 0) / instrument.sampleRate;
    this.bufferSource.loopEnd = (instrument.loopEnd || sample.length) / instrument.sampleRate;
    this.bufferSource.playbackRate.value = instrument.basePlaybackRate;
    
    // Setup panner
    this.panner.panningModel = 'equalpower';
    const pan = instrument.pan !== undefined ? instrument.pan : instrument.panpot;
    this.panner.setPosition(
      Math.sin(pan * Math.PI / 2),
      0,
      Math.cos(pan * Math.PI / 2)
    );
    
    // Setup filter
    this.filter.type = 'lowpass';
    this.filter.frequency.value = this.amountToFreq(instrument.initialFilterFc);
    this.filter.Q.value = Math.pow(10, (instrument.initialFilterQ || 0) / 200);
    
    // Setup expression
    this.expressionGainNode.gain.value = (instrument.expression || 127) / 127;
    
    // Setup volume envelope (ADSR)
    let volume = instrument.volume * (this.velocity / 127) * (1 - (instrument.initialAttenuation || 0) / 1000);
    volume = Math.max(0, volume);
    
    const outputGain = this.outputGainNode.gain;
    outputGain.setValueAtTime(0, now);
    outputGain.setTargetAtTime(volume, now, instrument.volAttack || 0.01);
    const attackEnd = now + (instrument.volAttack || 0.01) * 3;
    outputGain.setValueAtTime(volume, attackEnd);
    outputGain.linearRampToValueAtTime(volume * (instrument.volSustain || 0.7), attackEnd + (instrument.volDecay || 0.1));
    
    // Connect nodes
    this.bufferSource.connect(this.filter);
    this.filter.connect(this.panner);
    this.panner.connect(this.expressionGainNode);
    this.expressionGainNode.connect(this.outputGainNode);
    
    // Connect through reverb
    this.connect();
    
    // Start playback
    const startTime = (instrument.start || 0) / instrument.sampleRate;
    this.bufferSource.start(0, startTime);
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

  release() {
    const now = this.ctx.currentTime;
    const instrument = this.instrument;
    const releaseTime = (instrument.volRelease || 0.3);
    
    const outputGain = this.outputGainNode.gain;
    outputGain.cancelScheduledValues(now);
    outputGain.setValueAtTime(outputGain.value, now);
    outputGain.linearRampToValueAtTime(0, now + releaseTime);
    
    if (instrument.sampleModes === 1 || instrument.sampleModes === 3) {
      this.bufferSource.stop(now + releaseTime);
    } else {
      this.bufferSource.loop = false;
    }
  }

  updatePitchBend(pitchBend) {
    const semitones = (pitchBend / (pitchBend < 0 ? 8192 : 8191)) * this.instrument.pitchBendSensitivity;
    const newRate = this.instrument.basePlaybackRate * Math.pow(2, semitones / 12);
    this.bufferSource.playbackRate.setValueAtTime(newRate, this.ctx.currentTime);
  }

  amountToFreq(val) {
    return Math.pow(2, ((val || 0) - 6900) / 1200) * 440;
  }
}

// Export to window for global access (matching original library)
window.ActionSoundFont = ActionSoundFont;
window.SoundFont = ActionSoundFont; // Also expose as SoundFont for drop-in replacement
