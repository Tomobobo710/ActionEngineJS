// actionengine/sound/audiomanager.js
class ActionAudioManager {
    constructor() {
        this.context = null;
        this.enabled = true;
        this.sounds = new Map();
        this.samples = new Map();
        this.sampleDefinitions = new Map();
        this.masterGain = null;
        this.baseVolume = 0.2;
        this.initializeAudioContext();
        // Add tracking for scheduled MIDI events
        this.scheduledMIDIEvents = new Set();
        // MIDI state tracking
        this.midiReady = false;
        this.sf2Player = null;
        this.activeSounds = new Map();
        this.midiChannels = new Array(16).fill(null).map(() => ({
            volume: 127,
            pan: 64,
            expression: 127,
            program: 0,
            bank: 0,
            pitchBend: 0,
            pitchBendSensitivity: 2,
            duration: 0.5  // Add default duration
        }));

        this.midiProgramMap = {
            // Piano (0-7)
            acoustic_grand_piano: 0,
            bright_acoustic_piano: 1,
            electric_grand_piano: 2,
            honkytonk_piano: 3,
            electric_piano_1: 4,
            electric_piano_2: 5,
            harpsichord: 6,
            clavinet: 7,

            // Chromatic Percussion (8-15)
            celesta: 8,
            glockenspiel: 9,
            music_box: 10,
            vibraphone: 11,
            marimba: 12,
            xylophone: 13,
            tubular_bells: 14,
            dulcimer: 15,

            // Organ (16-23)
            drawbar_organ: 16,
            percussive_organ: 17,
            rock_organ: 18,
            church_organ: 19,
            reed_organ: 20,
            accordion: 21,
            harmonica: 22,
            tango_accordion: 23,

            // Guitar (24-31)
            acoustic_guitar_nylon: 24,
            acoustic_guitar_steel: 25,
            electric_guitar_jazz: 26,
            electric_guitar_clean: 27,
            electric_guitar_muted: 28,
            overdriven_guitar: 29,
            distortion_guitar: 30,
            guitar_harmonics: 31,

            // Bass (32-39)
            acoustic_bass: 32,
            electric_bass_finger: 33,
            electric_bass_pick: 34,
            fretless_bass: 35,
            slap_bass_1: 36,
            slap_bass_2: 37,
            synth_bass_1: 38,
            synth_bass_2: 39,

            // Strings (40-47)
            violin: 40,
            viola: 41,
            cello: 42,
            contrabass: 43,
            tremolo_strings: 44,
            pizzicato_strings: 45,
            orchestral_harp: 46,
            timpani: 47,

            // Ensemble (48-55)
            string_ensemble_1: 48,
            string_ensemble_2: 49,
            synth_strings_1: 50,
            synth_strings_2: 51,
            choir_aahs: 52,
            voice_oohs: 53,
            synth_choir: 54,
            orchestra_hit: 55,

            // Brass (56-63)
            trumpet: 56,
            trombone: 57,
            tuba: 58,
            muted_trumpet: 59,
            french_horn: 60,
            brass_section: 61,
            synth_brass_1: 62,
            synth_brass_2: 63,

            // Reed (64-71)
            soprano_sax: 64,
            alto_sax: 65,
            tenor_sax: 66,
            baritone_sax: 67,
            oboe: 68,
            english_horn: 69,
            bassoon: 70,
            clarinet: 71,

            // Pipe (72-79)
            piccolo: 72,
            flute: 73,
            recorder: 74,
            pan_flute: 75,
            blown_bottle: 76,
            shakuhachi: 77,
            whistle: 78,
            ocarina: 79,

            // Synth Lead (80-87)
            lead_1_square: 80,
            lead_2_sawtooth: 81,
            lead_3_calliope: 82,
            lead_4_chiff: 83,
            lead_5_charang: 84,
            lead_6_voice: 85,
            lead_7_fifths: 86,
            lead_8_bass_lead: 87,

            // Synth Pad (88-95)
            pad_1_new_age: 88,
            pad_2_warm: 89,
            pad_3_polysynth: 90,
            pad_4_choir: 91,
            pad_5_bowed: 92,
            pad_6_metallic: 93,
            pad_7_halo: 94,
            pad_8_sweep: 95,

            // Synth Effects (96-103)
            fx_1_rain: 96,
            fx_2_soundtrack: 97,
            fx_3_crystal: 98,
            fx_4_atmosphere: 99,
            fx_5_brightness: 100,
            fx_6_goblins: 101,
            fx_7_echoes: 102,
            fx_8_scifi: 103,

            // Ethnic (104-111)
            sitar: 104,
            banjo: 105,
            shamisen: 106,
            koto: 107,
            kalimba: 108,
            bagpipe: 109,
            fiddle: 110,
            shanai: 111,

            // Percussive (112-119)
            tinkle_bell: 112,
            agogo: 113,
            steel_drums: 114,
            woodblock: 115,
            taiko_drum: 116,
            melodic_tom: 117,
            synth_drum: 118,
            reverse_cymbal: 119,

            // Sound Effects (120-127)
            guitar_fret_noise: 120,
            breath_noise: 121,
            seashore: 122,
            bird_tweet: 123,
            telephone_ring: 124,
            helicopter: 125,
            applause: 126,
            gunshot: 127
        };
    }

    async initializeMIDI() {
        if (this.sf2Player) return;

        try {
            this.sf2Player = new SoundFont(this.context); // Pass the context
            await this.sf2Player.loadSoundFontFromBase64(window.TimGM6mb_BASE64);
            this.midiReady = true;
        } catch (error) {
            console.error("[AudioManager] Failed to initialize SF2 player:", error);
        }
    }

    // MIDI Control Methods
    programChange(channel, program) {
        if (!this.midiReady || !this.sf2Player) return;
        this.midiChannels[channel].program = program;
        this.sf2Player.channel = channel;
        this.sf2Player.program = program;
    }

    bankSelect(channel, bank) {
        if (!this.midiReady || !this.sf2Player) return;
        this.midiChannels[channel].bank = bank;
        this.sf2Player.channel = channel;
        this.sf2Player.bank = bank;
    }

    noteOn(channel, note, velocity) {
        if (!this.midiReady || !this.sf2Player) return;
        this.sf2Player.noteOn(note, velocity, channel);
    }

    noteOff(channel, note) {
        if (!this.midiReady || !this.sf2Player) return;
        this.sf2Player.noteOff(note, 127, channel);
    }

    pitchBend(channel, value) {
        if (!this.midiReady) return;
        this.midiChannels[channel].pitchBend = value;
        // TODO: Implement pitch bend with SF2 player if supported
    }

    setChannelVolume(channel, value) {
        if (!this.midiReady) return;
        this.midiChannels[channel].volume = value;
        // TODO: Implement volume control with SF2 player if supported
    }

    setChannelPan(channel, value) {
        if (!this.midiReady) return;
        this.midiChannels[channel].pan = value;
        // TODO: Implement pan with SF2 player if supported
    }

    allNotesOff(channel) {
        if (!this.midiReady) return;
        // Send noteOff for all possible notes on this channel
        for (let note = 0; note < 128; note++) {
            this.noteOff(channel, note);
        }
    }

    resetAllControllers(channel) {
        if (!this.midiReady) return;
        const ch = this.midiChannels[channel];
        ch.volume = 127;
        ch.pan = 64;
        ch.expression = 127;
        ch.pitchBend = 0;
        this.allNotesOff(channel);
    }

    // Original createSound maintained for compatibility
    createSound(name, options, type = "simple") {
        // Handle legacy format where options is just a frequency number
        if (typeof options === "number") {
            console.log(`[AudioManager] trigger, setting ${this.midiToFrequency(options)}`);
            options = {
                frequency: this.midiToFrequency(options),
                oscillatorType: type !== "simple" ? type : "sine" // type parameter was oscillatorType in old format
            };
            type = "simple";
        }

        switch (type) {
            case "sonicpi":
                const parsed = this.parseSonicPi(options.script, options.samples);

                if (options.samples) {
                    // Check once if we need MIDI
                    if (Object.values(options.samples).some((def) => def.soundType === "midi")) {
                        this.initializeMIDI();
                    }

                    // Then just store all the definitions
                    Object.entries(options.samples).forEach(([sampleName, definition]) => {
                        this.sampleDefinitions.set(sampleName, definition);
                    });
                }

                this.sounds.set(name, {
                    type: "sonicpi",
                    script: options.script,
                    parsedSequence: parsed.sequence,
                    samples: options.samples || {},
                    bpm: parsed.bpm
                });
                break;

            case "simple":
                default:
                    // Extract the envelope values with defaults
                    const envelope = options.envelope || {
                        attack: 0.1,
                        decay: 0.2,
                        sustain: 0.7,
                        release: 0.3
                    };

                    // Create the sound definition with all parameters
                    this.sounds.set(name, {
                        type: "simple", 
                        oscillatorType: options.type || "sine", // This handles the waveform
                        frequency: options.frequency || 440,
                        amp: options.amp || 0.5,
                        duration: options.duration || 1,
                        envelope: envelope
                    });
                    break;
                    }
                }

    initializeAudioContext() {
        const enableAudio = () => {
            if (!this.context) {
                this.context = new (window.AudioContext || window.webkitAudioContext)();
                this.masterGain = this.context.createGain();
                this.masterGain.connect(this.context.destination);
                this.setVolume(0.5);

                // Create sample buffers once context is available
                this.createSampleBuffers();
                console.log("[AudioManager] Initialized audio context..");
            }
            document.removeEventListener("click", enableAudio);
            document.removeEventListener("touchstart", enableAudio);
            document.removeEventListener("keydown", enableAudio);
        };
        document.addEventListener("click", enableAudio);
        document.addEventListener("touchstart", enableAudio);
        document.addEventListener("keydown", enableAudio);
    }

    createSampleBuffers() {
        this.sampleDefinitions.forEach((definition, sampleName) => {
            // Skip buffer creation for MIDI samples
            if (definition.soundType === "midi") {
                console.log(`[AudioManager] Skipping buffer creation for MIDI instrument: ${sampleName}`);
                return;
            }
            const bufferSize = this.context.sampleRate * 2;
            const buffer = this.context.createBuffer(2, bufferSize, this.context.sampleRate);
            const left = buffer.getChannelData(0);
            const right = buffer.getChannelData(1);

            for (let i = 0; i < bufferSize; i++) {
                const t = i / this.context.sampleRate;
                let value;

                switch (definition.type) {
                    case "sin":
                        // Adjust decay to be less aggressive
                        const decayFactor = definition.decay * 5; // Slow down the decay
                        value = Math.sin(t * definition.frequency * 2 * Math.PI) * Math.exp(-t / decayFactor);
                        break;
                    case "square":
                        value = Math.sign(Math.sin(t * definition.frequency)) * Math.exp(-t * definition.decay);
                        break;
                    case "saw":
                        value = ((t * definition.frequency) % 1) * 2 - 1;
                        value *= Math.exp(-t * definition.decay);
                        break;
                    default:
                        value = Math.sin(t * definition.frequency) * Math.exp(-t * definition.decay);
                }

                left[i] = right[i] = value;
            }

            this.samples.set(sampleName, buffer);
            console.log(`[AudioManager] Created buffer for sample: ${sampleName}`);
        });
    }

    preloadSample(name, definition) {
        if (!this.context) return;

        const bufferSize = this.context.sampleRate * 2;
        const buffer = this.context.createBuffer(2, bufferSize, this.context.sampleRate);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

        for (let i = 0; i < bufferSize; i++) {
            const t = i / this.context.sampleRate;
            let value;

            switch (definition.type) {
                case "sin":
                    value = Math.sin(t * definition.frequency) * Math.exp(-t * definition.decay);
                    break;
                case "square":
                    value = Math.sign(Math.sin(t * definition.frequency)) * Math.exp(-t * definition.decay);
                    break;
                case "saw":
                    value = ((t * definition.frequency) % 1) * 2 - 1;
                    value *= Math.exp(-t * definition.decay);
                    break;
                default:
                    value = Math.sin(t * definition.frequency) * Math.exp(-t * definition.decay);
            }

            left[i] = right[i] = value;
        }

        this.samples.set(name, buffer);
        console.log(`[AudioManager] Preloaded sample: ${name}`);
    }

    // New method for creating FM synthesis sounds
    createFMSound(
        name,
        {
            carrierFreq,
            modulatorFreq,
            modulationIndex = 100,
            type = "sine",
            duration,
            envelope = {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.5,
                release: 0.1
            }
        }
    ) {
        this.sounds.set(name, {
            type: "fm",
            carrierFreq,
            modulatorFreq,
            modulationIndex,
            oscillatorType: type,
            duration,
            envelope
        });
    }

    // Create multi-oscillator sound
    createComplexSound(
        name,
        {
            frequencies = [], // Array of frequency values
            types = [], // Array of oscillator types
            mix = [], // Array of volume levels
            duration,
            envelope = {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.5,
                release: 0.1
            }
        }
    ) {
        this.sounds.set(name, {
            type: "complex",
            frequencies,
            oscillatorTypes: types,
            mix,
            duration,
            envelope
        });
    }

    // Create noise-based sound
    createNoiseSound(
        name,
        {
            duration,
            noiseType = "white", // 'white', 'pink', or 'brown'
            envelope = {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.5,
                release: 0.1
            },
            filterOptions = {
                frequency: 1000,
                Q: 1,
                type: "lowpass"
            }
        }
    ) {
        this.sounds.set(name, {
            type: "noise",
            noiseType,
            duration,
            envelope,
            filterOptions
        });
    }

    // Create sweep effect sound
    createSweepSound(
        name,
        {
            startFreq,
            endFreq,
            type = "sine",
            duration,
            envelope = {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.5,
                release: 0.1
            }
        }
    ) {
        this.sounds.set(name, {
            type: "sweep",
            startFreq,
            endFreq,
            oscillatorType: type,
            duration,
            envelope
        });
    }

    // Helper to parse parameters like "attack: 0.1, release: 0.3"
    parseParameters(paramsString) {
        const params = {};
        const pairs = paramsString.split(",");

        for (const pair of pairs) {
            const [key, value] = pair.split(":").map((s) => s.trim());
            params[key] = parseFloat(value);
        }

        return params;
    }

    // Helper to convert MIDI note numbers to frequency
    midiToFrequency(note) {
        if (typeof note !== "number" || isNaN(note)) {
            console.warn("[AudioManager] Invalid MIDI note:", note);
            return 440; // Return A4 as default
        }
        return 440 * Math.pow(2, (note - 69) / 12);
    }

    // Enhanced play method to handle all sound types
    play(name, options = {}) {
        console.log(`[AudioManager] Playing sound...`);
        if (!this.enabled || !this.context) return;

        const sound = this.sounds.get(name);
        if (!sound) return;

        let controlObject;

        switch (sound.type) {
            case "simple":
                controlObject = this.playSimple(sound, options);
                break;
            case "fm":
                controlObject = this.playFM(sound, options);
                break;
            case "complex":
                controlObject = this.playComplex(sound, options);
                break;
            case "noise":
                controlObject = this.playNoise(sound, options);
                break;
            case "sweep":
                controlObject = this.playSweep(sound, options);
                break;
            case "sonicpi":
                console.log(`[AudioManager] Playing Pi sound... ${sound}`);
                controlObject = this.playSonicPi(sound, options);
                break;
            default:
                console.warn(`[AudioManager] Unknown sound type for ${name}`);
                return;
        }

        if (controlObject) {
            this.activeSounds.set(name, controlObject);
        }
        return controlObject;
    }

    stopSound(name) {
        const sound = this.activeSounds.get(name);
        if (sound) {
            const now = this.context.currentTime;

            if (sound.nodes) {
                // Handle WebAudio nodes
                sound.nodes.forEach((node) => {
                    if (node.gain) {
                        node.gain.setValueAtTime(node.gain.value, now);
                        node.gain.linearRampToValueAtTime(0, now + 0.05);
                    }
                    setTimeout(() => {
                        try {
                            if (node.stop) {
                                node.stop();
                            }
                        } catch (e) {
                            // Node might have already stopped
                        }
                    }, 50);
                });
            }

            // If this is a MIDI sound, handle note offs
            if (sound.midiNotes) {
                sound.midiNotes.forEach((note) => {
                    if (this.sf2Player) {
                        this.sf2Player.noteOff(note.note, note.velocity || 127, note.channel || 0);
                    }
                });
            }

            this.activeSounds.delete(name);
        }
    }

    stopAllSounds() {
        // Stop all active sounds
        this.activeSounds.forEach((sound, name) => {
            this.stopSound(name);
        });

        // Clear all scheduled MIDI timeouts
        this.scheduledMIDIEvents.forEach((timeoutId) => {
            clearTimeout(timeoutId);
        });
        this.scheduledMIDIEvents.clear();

        // Additionally ensure all MIDI notes are off on all channels
        if (this.sf2Player) {
            for (let channel = 0; channel < 16; channel++) {
                this.allNotesOff(channel);
            }
        }

        this.activeSounds.clear();
    }

    // Original simple oscillator playback (maintained for compatibility)
    playSimple(sound, { pan = 0 } = {}) {
        const oscillator = this.context.createOscillator();
        console.log("[AudioManager] Sound config:", sound);
        console.log("[AudioManager] Setting oscillator type to:", sound.oscillatorType);
        oscillator.type = sound.oscillatorType;
        const gainNode = this.context.createGain();
        const stereoPanner = this.context.createStereoPanner();

        // Set the oscillator type from the sound definition
        oscillator.type = sound.oscillatorType;
        oscillator.frequency.value = sound.frequency;

        stereoPanner.pan.value = pan;

        // Apply the ADSR envelope
        const now = this.context.currentTime;
        const envelope = sound.envelope;

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(sound.amp, now + envelope.attack);
        gainNode.gain.linearRampToValueAtTime(sound.amp * envelope.sustain, now + envelope.attack + envelope.decay);
        gainNode.gain.linearRampToValueAtTime(0, now + envelope.attack + envelope.decay + envelope.release);

        oscillator.connect(gainNode);
        gainNode.connect(stereoPanner);
        stereoPanner.connect(this.masterGain);

        oscillator.start();
        oscillator.stop(now + envelope.attack + envelope.decay + envelope.release);

        return {
            oscillator,
            nodes: [oscillator, gainNode, stereoPanner]
        };
    }

    // FM synthesis playback
    playFM(sound, { pan = 0 } = {}) {
        const carrier = this.context.createOscillator();
        const modulator = this.context.createOscillator();
        const modulatorGain = this.context.createGain();
        const gainNode = this.context.createGain();
        const stereoPanner = this.context.createStereoPanner();

        carrier.type = sound.oscillatorType;
        modulator.type = "sine";

        carrier.frequency.value = sound.carrierFreq;
        modulator.frequency.value = sound.modulatorFreq;
        modulatorGain.gain.value = sound.modulationIndex;

        stereoPanner.pan.value = pan;

        modulator.connect(modulatorGain);
        modulatorGain.connect(carrier.frequency);
        carrier.connect(gainNode);
        gainNode.connect(stereoPanner);
        stereoPanner.connect(this.masterGain);

        this.applyEnvelope(gainNode.gain, sound.envelope, sound.duration);

        carrier.start();
        modulator.start();
        carrier.stop(this.context.currentTime + sound.duration);
        modulator.stop(this.context.currentTime + sound.duration);

        return carrier;
    }

    // Multi-oscillator playback
    playComplex(sound, { pan = 0 } = {}) {
        const stereoPanner = this.context.createStereoPanner();
        const masterGain = this.context.createGain();
        const oscillators = [];

        stereoPanner.pan.value = pan;
        masterGain.connect(stereoPanner);
        stereoPanner.connect(this.masterGain);

        sound.frequencies.forEach((freq, i) => {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();

            osc.type = sound.oscillatorTypes[i] || "sine";
            osc.frequency.value = freq;
            gain.gain.value = sound.mix[i] || 0.5;

            osc.connect(gain);
            gain.connect(masterGain);
            oscillators.push(osc);
        });

        this.applyEnvelope(masterGain.gain, sound.envelope, sound.duration);

        oscillators.forEach((osc) => {
            osc.start();
            osc.stop(this.context.currentTime + sound.duration);
        });

        return oscillators;
    }

    // Noise generation and playback
    playNoise(sound, { pan = 0 } = {}) {
        const bufferSize = this.context.sampleRate * sound.duration;
        const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const data = buffer.getChannelData(0);

        // Generate noise based on type
        switch (sound.noiseType) {
            case "white":
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                break;
            case "pink": {
                let b0 = 0,
                    b1 = 0,
                    b2 = 0,
                    b3 = 0,
                    b4 = 0,
                    b5 = 0;
                for (let i = 0; i < bufferSize; i++) {
                    const white = Math.random() * 2 - 1;
                    b0 = 0.99886 * b0 + white * 0.0555179;
                    b1 = 0.99332 * b1 + white * 0.0750759;
                    b2 = 0.969 * b2 + white * 0.153852;
                    b3 = 0.8665 * b3 + white * 0.3104856;
                    b4 = 0.55 * b4 + white * 0.5329522;
                    b5 = -0.7616 * b5 - white * 0.016898;
                    data[i] = b0 + b1 + b2 + b3 + b4 + b5;
                }
                break;
            }
            case "brown": {
                let lastOut = 0;
                for (let i = 0; i < bufferSize; i++) {
                    const white = Math.random() * 2 - 1;
                    data[i] = (lastOut + 0.02 * white) / 1.02;
                    lastOut = data[i];
                }
                break;
            }
        }

        const noise = this.context.createBufferSource();
        const filter = this.context.createBiquadFilter();
        const gainNode = this.context.createGain();
        const stereoPanner = this.context.createStereoPanner();

        noise.buffer = buffer;

        filter.type = sound.filterOptions.type;
        filter.frequency.value = sound.filterOptions.frequency;
        filter.Q.value = sound.filterOptions.Q;

        stereoPanner.pan.value = pan;

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(stereoPanner);
        stereoPanner.connect(this.masterGain);

        this.applyEnvelope(gainNode.gain, sound.envelope, sound.duration);

        noise.start();
        return noise;
    }

    // Frequency sweep playback
    playSweep(sound, { pan = 0 } = {}) {
        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();
        const stereoPanner = this.context.createStereoPanner();

        oscillator.type = sound.oscillatorType;
        oscillator.frequency.setValueAtTime(sound.startFreq, this.context.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(sound.endFreq, this.context.currentTime + sound.duration);

        stereoPanner.pan.value = pan;

        oscillator.connect(gainNode);
        gainNode.connect(stereoPanner);
        stereoPanner.connect(this.masterGain);

        this.applyEnvelope(gainNode.gain, sound.envelope, sound.duration);

        oscillator.start();
        oscillator.stop(this.context.currentTime + sound.duration);

        return oscillator;
    }

    parseSonicPi(script, samples) {
        const parser = new SonicPiParser(this);
        return parser.parseScript(script, samples);
    }

    playSonicPi(sound, options = {}) {
        if (!this.enabled || !this.context) return;

        const startTime = this.context.currentTime;
        const allNodes = [];
        const midiNotes = [];
        let isPlaying = true;

        // Get BPM from sound data
        const bpm = sound.bpm || 60;
        const beatDuration = 60 / bpm;

        // Define synthConfigs first
        const synthConfigs = {
            fm: {
                type: "sine",
                modulation: {
                    frequency: 0.5,
                    gain: 50
                }
            },
            prophet: {
                type: "sawtooth",
                detune: 10,
                filterType: "lowpass"
            },
            saw: { type: "sawtooth" },
            mod_pulse: {
                type: "square",
                modulation: {
                    frequency: 0.25,
                    gain: 30
                }
            },
            piano: {
                type: "triangle",
                filterType: "bandpass"
            },
            pluck: {
                type: "triangle",
                filterType: "highpass"
            },
            kalimba: {
                type: "sine",
                filterType: "bandpass"
            },
            tb303: {
                type: "square",
                filterType: "lowpass",
                resonance: 10
            }
        };

        // Effect processors
        const createEffect = {
            echo: (params) => {
                const delay = this.context.createDelay();
                const feedback = this.context.createGain();
                const wetGain = this.context.createGain();

                delay.delayTime.value = params.phase || 0.25;
                feedback.gain.value = params.decay || 0.5;
                wetGain.gain.value = 0.5;

                // Connect feedback loop
                delay.connect(feedback);
                feedback.connect(delay);

                return [delay, feedback, wetGain];
            },
            lpf: (params) => {
                const filter = this.context.createBiquadFilter();
                filter.type = "lowpass";
                filter.frequency.value = params.cutoff || 1000;
                filter.Q.value = params.resonance || 1;
                return [filter];
            },
            reverb: (params) => {
                const convolver = this.context.createConvolver();
                const wetGain = this.context.createGain();
                wetGain.gain.value = params.room || 0.5;

                // Create impulse response
                const length = this.context.sampleRate * (params.room || 0.5) * 3;
                const impulse = this.context.createBuffer(2, length, this.context.sampleRate);
                const left = impulse.getChannelData(0);
                const right = impulse.getChannelData(1);

                for (let i = 0; i < length; i++) {
                    const n = i / length;
                    left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, params.room * 10 || 2);
                    right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, params.room * 10 || 2);
                }

                convolver.buffer = impulse;
                return [convolver, wetGain];
            },
            wobble: (params) => {
                const filter = this.context.createBiquadFilter();
                const lfo = this.context.createOscillator();
                const lfoGain = this.context.createGain();

                filter.type = "lowpass";
                filter.frequency.value = 1000;

                lfo.frequency.value = 1 / (params.phase || 6);
                lfoGain.gain.value = 2000;

                lfo.connect(lfoGain);
                lfoGain.connect(filter.frequency);
                lfo.start();

                return [filter];
            }
        };

        // Apply effects chain
        const applyEffects = (source, effects) => {
            if (!effects || !effects.length) return source;

            let currentNode = source;
            effects.forEach((effect) => {
                if (createEffect[effect.type]) {
                    const nodes = createEffect[effect.type](effect.params);
                    currentNode.connect(nodes[0]);
                    currentNode = nodes[nodes.length - 1];

                    if (nodes.length > 1) {
                        nodes[0].connect(nodes[1]);
                        nodes[1].connect(nodes[0]);
                    }
                }
            });

            return currentNode;
        };

        // Create synth with configurations
        const createSynth = (frequency, synthType, params = {}) => {
            // Use createSound() for the sound definition
            this.createSound("temp", frequency, "simple");
            const soundDef = this.sounds.get("temp");

            // Create and connect nodes like createSynth() currently does
            const oscillator = this.context.createOscillator();
            const gainNode = this.context.createGain();
            const stereoPanner = this.context.createStereoPanner();

            // Use sound definition from createSound()
            oscillator.type = soundDef.oscillatorType;
            oscillator.frequency.value = soundDef.frequency;

            // Keep existing stereo and gain setup
            stereoPanner.pan.value = params.pan || 0;

            // Keep existing gain envelope setup
            const duration = params.duration || 1;
            gainNode.gain.setValueAtTime(0, this.context.currentTime);
            gainNode.gain.linearRampToValueAtTime(1, this.context.currentTime + 0.01);
            gainNode.gain.linearRampToValueAtTime(0, this.context.currentTime + duration);

            // Keep existing connections
            oscillator.connect(gainNode);
            gainNode.connect(stereoPanner);
            stereoPanner.connect(this.masterGain);

            return { oscillator, gainNode, stereoPanner };
        };
        // Create sample functionality
        const createSample = (sampleName, params = {}) => {
            const definition = this.sampleDefinitions.get(sampleName);
            console.log("[AudioManager] Creating sample:", {
                name: sampleName,
                definition,
                params,
                isMIDI: definition?.soundType === "midi",
                hasSampleBuffer: this.samples.has(sampleName),
                midiReady: this.midiReady
            });

            if (definition?.soundType === "midi") {
                const gainNode = this.context.createGain();

                const midiPlayer = {
                    start: (scheduleTime) => {
                        const noteToPlay = params.note || 60;
                        const velocity = Math.floor(definition.amp * 127);
                        const duration = params.duration || 0.1;
                        const delayMs = (scheduleTime - this.context.currentTime) * 1000;

                        setTimeout(() => {
                            this.sf2Player.program = this.midiProgramMap[definition.instrument];
                            this.sf2Player.noteOn(noteToPlay, velocity);
                            // Track the note
                            midiNotes.push({
                                note: noteToPlay,
                                velocity: velocity,
                                channel: 0 // Or whatever channel you're using
                            });
                            const stopTimeout = setTimeout(() => {
                                this.sf2Player.noteOff(noteToPlay);
                                this.scheduledMIDIEvents.delete(stopTimeout);
                            }, duration * 1000);
                            this.scheduledMIDIEvents.add(stopTimeout);
                        }, delayMs);

                        gainNode.gain.setValueAtTime(0, scheduleTime);
                        gainNode.gain.linearRampToValueAtTime(params.amp || 1, scheduleTime + (params.attack || 0.01));
                        gainNode.gain.linearRampToValueAtTime(
                            0,
                            scheduleTime + (params.attack || 0.01) + (params.release || 1)
                        );
                    },
                    stop: () => {
                        const noteToPlay = params.note || 60;
                        this.sf2Player.noteOff(noteToPlay);
                    },
                    connect: (target) => {
                        gainNode.connect(target);
                    }
                };

                return { oscillator: midiPlayer, gainNode };
            }

            if (!this.samples.has(sampleName)) {
                console.warn(`[AudioManager] No synthetic sample found for ${sampleName}`);
                return createSynth(440, "sine", params);
            }

            const source = this.context.createBufferSource();
            const gainNode = this.context.createGain();

            source.buffer = this.samples.get(sampleName);
            source.connect(gainNode);
            gainNode.connect(this.masterGain);

            source.playbackRate.value = params.rate || 1;
            gainNode.gain.value = params.amp || 0.5;

            return { oscillator: source, gainNode };
        };

        // Process all events sequentially
        sound.parsedSequence.forEach((event) => {
            const eventTime = startTime + event.time;
            console.log("[AudioManager] Processing event:", event);

            if (event.command !== "play" && event.command !== "sample") {
                console.log("[AudioManager] Skipping non-playable command:", event.command);
                return;
            }

            // Create a timeout for this event in the sequence
            const sequenceTimeout = setTimeout(
                () => {
                    if (!isPlaying) return; // Skip if we've been stopped

                    const {
                        oscillator: source,
                        gainNode,
                        stereoPanner
                    } = event.command === "sample"
                        ? createSample(event.sample, event)
                        : createSynth(event.note, event.synth || "simple", {
                              oscillatorType: event.type || "sine",
                              duration: event.duration || 1,
                              pan: event.pan
                          });

                    const attack = event.attack || 0.01;
                    const release = event.release || 1;
                    const amp = event.amp || 0.5;

                    let outputNode = gainNode;
                    if (event.effects && event.effects.length) {
                        outputNode = applyEffects(gainNode, event.effects);
                    }

                    if (event.pan) {
                        const panner = this.context.createStereoPanner();
                        panner.pan.value = event.pan;
                        outputNode.connect(panner);
                        panner.connect(this.masterGain);
                    } else {
                        outputNode.connect(this.masterGain);
                    }

                    gainNode.gain.setValueAtTime(0, eventTime);
                    gainNode.gain.linearRampToValueAtTime(amp, eventTime + attack);
                    gainNode.gain.linearRampToValueAtTime(0, eventTime + attack + release);

                    if (event.command === "sample") {
                        source.start(eventTime);
                        source.stop(eventTime + attack + release);
                    } else {
                        source.frequency.setValueAtTime(this.midiToFrequency(event.note), eventTime);
                        source.start(eventTime);
                        source.stop(eventTime + attack + release);
                    }

                    allNodes.push(source);
                },
                (eventTime - this.context.currentTime) * 1000
            );

            // Track this timeout
            this.scheduledMIDIEvents.add(sequenceTimeout);
        });

        // Return the control object with everything needed to stop the sequence
        return {
            stop: () => {
                isPlaying = false;
                allNodes.forEach((node) => {
                    try {
                        if (node.stop) node.stop();
                    } catch (e) {
                        // Node might have already stopped
                    }
                });
                // Stop any MIDI notes
                midiNotes.forEach((note) => {
                    if (this.sf2Player) {
                        this.sf2Player.noteOff(note.note, note.velocity || 127, note.channel || 0);
                    }
                });
                // Clear any pending timeouts
                this.scheduledMIDIEvents.forEach((timeout) => {
                    clearTimeout(timeout);
                });
                this.scheduledMIDIEvents.clear();
            },
            nodes: allNodes,
            midiNotes: midiNotes,
            isPlaying: () => isPlaying
        };
    }

    // ADSR envelope utility
    applyEnvelope(gainParam, envelope, duration) {
        const { attack, decay, sustain, release } = envelope;
        const now = this.context.currentTime;

        gainParam.setValueAtTime(0, now);
        gainParam.linearRampToValueAtTime(1, now + attack);
        gainParam.linearRampToValueAtTime(sustain, now + attack + decay);
        gainParam.linearRampToValueAtTime(0, now + duration);
    }

    setVolume(value) {
        if (this.masterGain) {
            const scaledVolume = this.baseVolume * value;
            this.masterGain.gain.setValueAtTime(scaledVolume, this.context.currentTime);
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        if (this.context) {
            if (this.enabled) {
                this.context.resume();
            } else {
                this.context.suspend();
            }
        }

        // Stop any active MIDI events if disabling
        if (!this.enabled) {
            this.scheduledMIDIEvents.forEach((timeout) => {
                clearTimeout(timeout);
            });
            this.scheduledMIDIEvents.clear();

            // Stop MIDI notes if sf2Player exists
            if (this.sf2Player) {
                this.stopAllSounds();
            }
        }

        return this.enabled;
    }
}

class SonicPiParser {
    constructor(context) {
        this.context = context;
        this.functions = new Map();
        this.bpm = 60;
        this.beatDuration = 60 / this.bpm;
        this.effectsStack = [];
    }

    parseScript(script) {
        const bpmMatch = script.match(/use_bpm\s+(\d+)/);
        if (bpmMatch) {
            this.bpm = parseInt(bpmMatch[1]);
            this.beatDuration = 60 / this.bpm;
        }

        const functionMatches = script.matchAll(/define\s+:(\w+)\s+do\s*([\s\S]*?)\s*end/g);
        for (const match of functionMatches) {
            this.functions.set(match[1], match[2].trim());
        }

        const sequence = [];
        let currentTime = 0;

        const mainScript = script.replace(/define\s+:\w+\s+do[\s\S]*?end/g, "").trim();
        currentTime = this.processScript(mainScript, sequence, currentTime);

        return {
            sequence: sequence.sort((a, b) => a.time - b.time),
            bpm: this.bpm,
            totalDuration: currentTime
        };
    }

    processScript(script, sequence, startTime) {
        let currentTime = startTime;
        const lines = script.split("\n");

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line || line.startsWith("#")) continue;

            const fxMatch = line.match(/with_fx\s+:(\w+)(?:\s*,\s*(.+))?\s+do/);
            if (fxMatch) {
                const [_, fxType, paramString] = fxMatch;
                const fxParams = this.parseParams(paramString || "");

                this.effectsStack.push({
                    type: fxType,
                    params: fxParams
                });

                let fxContent = "";
                let depth = 1;
                let j = i + 1;

                while (depth > 0 && j < lines.length) {
                    if (lines[j].includes("with_fx")) depth++;
                    if (lines[j].trim() === "end") depth--;
                    if (depth > 0) fxContent += lines[j] + "\n";
                    j++;
                }

                currentTime = this.processScript(fxContent, sequence, currentTime);

                this.effectsStack.pop();

                i = j - 1;
                continue;
            }

            const timesMatch = line.match(/(\d+)\.times\s+do/);
            if (timesMatch) {
                const count = parseInt(timesMatch[1]);
                let loopContent = "";
                let depth = 1;
                let j = i + 1;

                while (depth > 0 && j < lines.length) {
                    if (lines[j].includes(".times do")) depth++;
                    if (lines[j].trim() === "end") depth--;
                    if (depth > 0) loopContent += lines[j] + "\n";
                    j++;
                }

                for (let k = 0; k < count; k++) {
                    currentTime = this.processScript(loopContent, sequence, currentTime);
                }

                i = j - 1;
                continue;
            }

            const sleepMatch = line.match(/sleep\s+([\d.]+)/);
            if (sleepMatch) {
                currentTime += parseFloat(sleepMatch[1]) * this.beatDuration;
                continue;
            }

            const sampleMatch = line.match(/sample\s+:(\w+)(?:\s*,\s*(.+))?/);
            if (sampleMatch) {
                const [_, name, paramString] = sampleMatch;
                const params = this.parseParams(paramString || "");
                sequence.push({
                    command: "sample",
                    time: currentTime,
                    sample: name,
                    effects: [...this.effectsStack],
                    ...params
                });
                continue;
            }

            const playMatch = line.match(/play\s+(\d+)(?:\s*,\s*(.+))?/);
            if (playMatch) {
                const [_, note, paramString] = playMatch;
                const params = this.parseParams(paramString || "");
                sequence.push({
                    command: "play",
                    time: currentTime,
                    note: parseInt(note),
                    effects: [...this.effectsStack],
                    ...params
                });
                continue;
            }

            const functionCall = line.match(/:?(\w+)/);
            if (functionCall && this.functions.has(functionCall[1])) {
                currentTime = this.processScript(this.functions.get(functionCall[1]), sequence, currentTime);
            }
        }

        return currentTime;
    }

    parseParams(paramString) {
        if (!paramString) return {};
        const params = {};
        const matches = paramString.match(/(\w+):\s*([^,\s]+)/g) || [];
        matches.forEach((match) => {
            const [key, value] = match.split(":").map((s) => s.trim());
            params[key] = isNaN(value) ? value : parseFloat(value);
        });
        return params;
    }
}