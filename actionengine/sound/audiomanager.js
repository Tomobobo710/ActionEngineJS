//actionengine/sound/audiomanager.js
class ActionAudioManager {
    /** AudioContext latencyHint ("interactive" | "balanced" | "playback" | seconds). Set before the first unlock(). */
    static latencyHint = "interactive";

    /**
     * Which sound engine to use. Set before the first unlock().
     *   "auto"    - the audio-thread engine (AudioWorklet) when it loads, else the node engine
     *   "worklet" - same as auto (falls back if the worklet can't load)
     *   "nodes"   - always the original Web Audio node engine
     */
    static engine = "auto";

    constructor() {
        this.context = null;
        // The audio-thread engine (ActionAudioWorkletHost) once unlock() starts it.
        this.worklet = null;
        /** "nodes" | "worklet" - the engine actually in use (decided after unlock()). */
        this.engine = "nodes";
        /** Resolves once the sound engine is up (worklet loaded, or settled on nodes). */
        this.ready = new Promise((resolve) => { this._resolveReady = resolve; });
        this.enabled = true;
        this.sounds = new Map();
        this.samples = new Map();
        this.sampleDefinitions = new Map();
        this.masterGain = null;
        this.baseVolume = 1;      // setVolume(v) sets the master gain to v directly
        this.initializeAudioContext();
        // Add tracking for scheduled MIDI events
        this.scheduledMIDIEvents = new Set();
        // MIDI state tracking
        this.midiReady = false;
        this.sf2Player = null;
        this.tracker = null;
        this.activeSounds = new Map();
        // Enhanced sound tracking for new features
        this.soundInstances = new Map(); // Track individual sound instances
        this.soundVolumes = new Map(); // Individual sound volumes
        this.repeatTimeouts = new Map(); // Track repeat timeouts for cleanup
        this.midiChannels = new Array(16).fill(null).map(() => ({
            volume: 127,
            pan: 64,
            expression: 127,
            program: 0,
            bank: 0,
            pitchBend: 0,
            pitchBendSensitivity: 2,
            duration: 0.5 // Add default duration
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
        if (this._midiLoading) return this._midiLoading;
        if (this.sf2Player) return;
        // The soundfont needs an AudioContext, which only exists after a user
        // gesture. If asked too early, remember the request; unlock() starts it.
        if (!this.context) {
            this._midiWanted = true;
            return;
        }

        this._midiLoading = (async () => {
            try {
                const player = new SoundFont(this.context); // Pass the context
                await player.loadSoundFontPackage("TimGM6mb");
                // The audio-thread engine plays MIDI-API notes itself: hand it the parsed
                // samples and zones (the node synth keeps its copy for the tracker for now).
                await this.ready;
                if (this._useWorklet()) {
                    this.worklet.loadSoundFont(player.synth);
                    this._sfInWorklet = true;
                }
                this.sf2Player = player; // only expose it once it can actually play
                this.midiReady = true;
                this._attachSoundFontToTracker();
            } catch (error) {
                console.error("[AudioManager] Failed to initialize SF2 player:", error);
            } finally {
                this._midiLoading = null;
            }
        })();
        return this._midiLoading;
    }

    // Hook the loaded soundfont into the tracker, including songs that started
    // playing while it was still loading (their sf2 channels start sounding now).
    _attachSoundFontToTracker() {
        const tracker = this.tracker;
        if (!tracker || !this.sf2Player || tracker.soundFont === this.sf2Player) return;
        tracker.setSoundFont(this.sf2Player);
        tracker._handles.forEach((h) => {
            if (h.isPlaying && h._song && h.engine !== "worklet") tracker._allocSf2Channels(h._channels, h._song);
        });
    }

    static songUsesSoundFont(song) {
        return Object.values((song && song.instruments) || {}).some((inst) => inst && inst.sf2 !== undefined);
    }

    // MIDI Control Methods
    // MIDI API. With the audio-thread engine these go to its own SoundFont player;
    // `when` (AudioContext time, optional) makes them sample-accurate.
    _midiToWorklet() {
        return this._sfInWorklet && this._useWorklet();
    }

    programChange(channel, program, when = 0) {
        if (!this.midiReady || !this.sf2Player) return;
        this.midiChannels[channel].program = program;
        if (this._midiToWorklet()) return this.worklet.midi("program", channel, { value: program }, when);
        this.sf2Player.channel = channel;
        this.sf2Player.program = program;
    }

    bankSelect(channel, bank, when = 0) {
        if (!this.midiReady || !this.sf2Player) return;
        this.midiChannels[channel].bank = bank;
        if (this._midiToWorklet()) return this.worklet.midi("bank", channel, { value: bank }, when);
        this.sf2Player.channel = channel;
        this.sf2Player.bank = bank;
    }

    noteOn(channel, note, velocity, when = 0) {
        if (!this.midiReady || !this.sf2Player) return;
        if (this._midiToWorklet()) return this.worklet.midi("on", channel, { key: note, vel: velocity }, when);
        this.sf2Player.noteOn(note, velocity, channel);
    }

    noteOff(channel, note, when = 0) {
        if (!this.midiReady || !this.sf2Player) return;
        if (this._midiToWorklet()) return this.worklet.midi("off", channel, { key: note }, when);
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
        if (this._midiToWorklet()) return this.worklet.midi("allOff", channel);
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
            options = {
                frequency: this.midiToFrequency(options),
                oscillatorType: type !== "simple" ? type : "sine" // type parameter was oscillatorType in old format
            };
            type = "simple";
        }

        switch (type) {
            case "tracker": {
                const song = options.song || options;
                this.sounds.set(name, { type: "tracker", song });
                // Songs with { sf2: ... } instruments need the soundfont: start
                // loading it now (or right after the first user gesture).
                if (ActionAudioManager.songUsesSoundFont(song)) this.initializeMIDI();
                break;
            }

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
            this.unlock();
            document.removeEventListener("click", enableAudio);
            document.removeEventListener("touchstart", enableAudio);
            document.removeEventListener("keydown", enableAudio);
        };
        document.addEventListener("click", enableAudio);
        document.addEventListener("touchstart", enableAudio);
        document.addEventListener("keydown", enableAudio);
    }

    // Create/resume the AudioContext on demand. Safe to call from a user-gesture
    // handler; idempotent. Games that drive audio from canvas input call this first
    // so they don't race the document-level gesture listeners.
    unlock() {
        if (!this.context) {
            // Output buffer size. "interactive" (browser default, ~10 ms) gives the snappiest
            // sound effects but can underrun - audible clicks - when a dense synth song keeps
            // the audio thread busy. "balanced" / "playback" trade latency for headroom.
            const Ctx = window.AudioContext || window.webkitAudioContext;
            try { this.context = new Ctx({ latencyHint: ActionAudioManager.latencyHint }); }
            catch (e) { this.context = new Ctx(); }
            this.masterGain = this.context.createGain();
            this.masterGain.connect(this.context.destination);
            this.setVolume(0.6);   // default master level
            this._startEngine();
            this.createSampleBuffers();
            if (this._midiWanted) {
                this._midiWanted = false;
                this.initializeMIDI();
            }
        }
        if (this.context.state === "suspended") {
            this.context.resume();
        }
        return this.context;
    }

    // Start the audio-thread engine if allowed and supported; otherwise stay on nodes.
    _startEngine() {
        const want = ActionAudioManager.engine;
        if (want === "nodes" || !window.ActionAudioWorkletHost || !this.context.audioWorklet) {
            this._resolveReady("nodes");
            return;
        }
        const host = new ActionAudioWorkletHost(this.context, this.masterGain);
        this.worklet = host;
        host.onFailure = () => {                       // processor crashed mid-run
            if (this.worklet === host) this.worklet = null;
            this.engine = "nodes";
        };
        host.ready.then(
            () => {
                this.engine = "worklet";
                if (this.tracker) this.tracker.attachWorklet(host);
                this._resolveReady("worklet");
            },
            () => { if (this.worklet === host) this.worklet = null; this.engine = "nodes"; this._resolveReady("nodes"); }
        );
    }

    // True when sounds should go to the audio-thread engine (it may still be loading -
    // messages queue until it is ready).
    _useWorklet() {
        return !!(this.worklet && !this.worklet.failed);
    }

    // The node engine's applyEnvelope() as worklet breakpoints: 0 -> volume (attack) ->
    // volume*sustain (attack+decay) -> 0 at `duration`. Sorted by time, like AudioParam events.
    _envBreakpoints(envelope, duration, volume) {
        const { attack, decay, sustain } = envelope;
        return [[0, 0], [attack, volume], [attack + decay, volume * sustain], [duration, 0]].sort((a, b) => a[0] - b[0]);
    }

    // Control object for one or more worklet voices (stop / setVolume like the node ones).
    _workletControl(ids, volume) {
        const host = this.worklet;
        return {
            engine: "worklet", id: ids[0], ids, startVolume: volume,
            stop: () => ids.forEach((id) => host.stop(id, 0.05)),
            setVolume: (v) => ids.forEach((id, i) => host.setGain(id, (volume > 0 ? v / volume : 0) * (this._voiceGains?.get(id) ?? 1)))
        };
    }

    createSampleBuffers() {
        this.sampleDefinitions.forEach((definition, sampleName) => {
            // Skip buffer creation for MIDI samples
            if (definition.soundType === "midi") {
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

    /**
     * Set individual sound volume
     * @param {string} name - Sound name
     * @param {number} volume - Volume level (0.0 to 1.0)
     */
    setSoundVolume(name, volume) {
        volume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
        this.soundVolumes.set(name, volume);

        // Update any currently playing instances
        const instances = this.soundInstances.get(name) || [];
        instances.forEach((instance) => {
            if (instance.engine === "worklet" && instance.setVolume) { instance.setVolume(volume); return; }
            if (instance.gainNode && instance.gainNode.gain) {
                const currentTime = this.context.currentTime;
                const masterVol = this.masterGain ? this.masterGain.gain.value / this.baseVolume : 1.0;
                const finalVolume = volume * masterVol;
                instance.gainNode.gain.setValueAtTime(finalVolume, currentTime);
            }
        });
    }

    /**
     * Get individual sound volume
     * @param {string} name - Sound name
     * @returns {number} Volume level (0.0 to 1.0)
     */
    getSoundVolume(name) {
        return this.soundVolumes.get(name) || 1.0;
    }

    // Enhanced play method to handle all sound types with new options
    play(name, options = {}) {
        if (!this.enabled || !this.context) return;

        const sound = this.sounds.get(name);
        if (!sound) return;

        // Always prevent sound stacking - stop any existing instances of this sound
        const instances = this.soundInstances.get(name) || [];
        if (instances.length > 0) {
            // Stop existing instances
            instances.forEach((instance) => this.stopSoundInstance(instance));
            this.soundInstances.set(name, []);
        }

        // Set up repeat tracking
        const repeatInfo = {
            count: options.repeat || 1,
            current: 0,
            onEnd: options.onEnd || null
        };

        // Play the first instance
        const controlObject = this.playInstance(name, sound, options, repeatInfo);

        return controlObject;
    }

    /**
     * Play a single instance of a sound
     */
    playInstance(name, sound, options, repeatInfo) {
        let controlObject;

        // Apply individual sound volume if set
        const soundVolume = options.volume !== undefined ? options.volume : this.getSoundVolume(name);
        const enhancedOptions = { ...options, volume: soundVolume };

        switch (sound.type) {
            case "simple":
                controlObject = this.playSimple(sound, enhancedOptions);
                break;
            case "fm":
                controlObject = this.playFM(sound, enhancedOptions);
                break;
            case "complex":
                controlObject = this.playComplex(sound, enhancedOptions);
                break;
            case "noise":
                controlObject = this.playNoise(sound, enhancedOptions);
                break;
            case "sweep":
                controlObject = this.playSweep(sound, enhancedOptions);
                break;
            case "sonicpi":
                controlObject = this.playSonicPi(sound, enhancedOptions);
                break;
            case "tracker":
                controlObject = this.playTracker(sound, enhancedOptions);
                break;
            default:
                console.warn(`[AudioManager] Unknown sound type for ${name}`);
                return;
        }

        if (controlObject) {
            // Track this instance
            const instances = this.soundInstances.get(name) || [];
            const instanceData = {
                ...controlObject,
                name: name,
                startTime: this.context.currentTime,
                repeatInfo: repeatInfo
            };
            instances.push(instanceData);
            this.soundInstances.set(name, instances);

            // Set up sound end detection for callbacks and repeats
            this.setupSoundEndDetection(name, sound, instanceData);

            this.activeSounds.set(name, controlObject);
        }
        return controlObject;
    }

    /**
     * Set up sound end detection for callbacks and repeat functionality
     */
    setupSoundEndDetection(name, sound, instanceData) {
        // The tracker schedules its own completion and fires onEnd from the audio clock.
        if (sound.type === "tracker") return;

        // Calculate sound duration
        let duration = sound.duration || 1;
        if (sound.envelope) {
            const env = sound.envelope;
            duration = (env.attack || 0.1) + (env.decay || 0.2) + (env.release || 0.3);
        }

        // Set timeout to handle sound end
        const endTimeout = setTimeout(() => {
            this.handleSoundEnd(name, instanceData);
        }, duration * 1000);

        instanceData.endTimeout = endTimeout;
    }

    /**
     * Handle sound end - cleanup, callbacks, and repeat logic
     */
    handleSoundEnd(name, instanceData) {
        // Remove this instance from tracking
        const instances = this.soundInstances.get(name) || [];
        const index = instances.indexOf(instanceData);
        if (index > -1) {
            instances.splice(index, 1);
            this.soundInstances.set(name, instances);
        }

        const repeatInfo = instanceData.repeatInfo;
        repeatInfo.current++;

        // Check if we should repeat
        const shouldRepeat = repeatInfo.count === -1 || repeatInfo.current < repeatInfo.count;

        if (shouldRepeat) {
            // Schedule next repeat
            const repeatTimeout = setTimeout(() => {
                const sound = this.sounds.get(name);
                if (sound) {
                    this.playInstance(name, sound, instanceData.options || {}, repeatInfo);
                }
            }, 50); // Small delay between repeats

            // Track repeat timeout for cleanup
            const repeatTimeouts = this.repeatTimeouts.get(name) || [];
            repeatTimeouts.push(repeatTimeout);
            this.repeatTimeouts.set(name, repeatTimeouts);
        } else {
            // Sound is completely finished, call onEnd callback
            if (repeatInfo.onEnd) {
                try {
                    repeatInfo.onEnd({
                        soundName: name,
                        totalRepeats: repeatInfo.current
                    });
                } catch (error) {
                    console.error(`[AudioManager] Error in onEnd callback for ${name}:`, error);
                }
            }
        }
    }

    /**
     * Stop a specific sound instance
     */
    stopSoundInstance(instanceData) {
        const now = this.context.currentTime;

        // Self-managing sources (tracker, sonicpi) expose their own stop().
        if (typeof instanceData.stop === "function") {
            instanceData.stop();
        }

        // Clear end timeout
        if (instanceData.endTimeout) {
            clearTimeout(instanceData.endTimeout);
        }

        // Stop audio nodes
        if (instanceData.nodes) {
            instanceData.nodes.forEach((node) => {
                if (node.gain) {
                    node.gain.setValueAtTime(node.gain.value, now);
                    node.gain.linearRampToValueAtTime(0, now + 0.05);
                }
                setTimeout(() => {
                    try {
                        if (node.stop) node.stop();
                    } catch (e) {
                        // Node might have already stopped
                    }
                }, 50);
            });
        }

        // Handle MIDI notes
        if (instanceData.midiNotes) {
            instanceData.midiNotes.forEach((note) => {
                if (this.sf2Player) {
                    this.sf2Player.noteOff(note.note, note.velocity || 127, note.channel || 0);
                }
            });
        }
    }

    stopSound(name) {
        // Stop all instances of this sound
        const instances = this.soundInstances.get(name) || [];
        instances.forEach((instance) => {
            this.stopSoundInstance(instance);
        });
        this.soundInstances.set(name, []);

        // Clear any pending repeat timeouts
        const repeatTimeouts = this.repeatTimeouts.get(name) || [];
        repeatTimeouts.forEach((timeout) => clearTimeout(timeout));
        this.repeatTimeouts.set(name, []);

        // Original stopSound logic for backward compatibility
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
        if (this.worklet) this.worklet.stopAll(0.05);
        // Stop all sound instances
        this.soundInstances.forEach((instances, name) => {
            instances.forEach((instance) => {
                this.stopSoundInstance(instance);
            });
        });
        this.soundInstances.clear();

        // Clear all repeat timeouts
        this.repeatTimeouts.forEach((timeouts) => {
            timeouts.forEach((timeout) => clearTimeout(timeout));
        });
        this.repeatTimeouts.clear();

        // Stop all active sounds (original logic)
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

    // Original simple oscillator playback (enhanced with volume support)
    playSimple(sound, { pan = 0, volume = 1.0, when = 0 } = {}) {
        if (this._useWorklet()) {
            // Same envelope as the node path: 0 -> amp (attack) -> amp*sustain (decay) -> 0 (release).
            const e = sound.envelope;
            const amp = sound.amp * volume;
            const env = [[0, 0], [e.attack, amp], [e.attack + e.decay, amp * e.sustain], [e.attack + e.decay + e.release, 0]];
            const id = this.worklet.voice({ at: when, prio: 1, osc: sound.oscillatorType, freq: sound.frequency, env, pan, gain: 1 });
            return this._workletControl([id], volume);
        }
        const oscillator = this.context.createOscillator();
        oscillator.type = sound.oscillatorType;
        const gainNode = this.context.createGain();
        const stereoPanner = this.context.createStereoPanner();

        // Set the oscillator type from the sound definition
        oscillator.type = sound.oscillatorType;
        oscillator.frequency.value = sound.frequency;

        stereoPanner.pan.value = pan;

        // Apply the ADSR envelope with individual volume
        const now = this.context.currentTime;
        const envelope = sound.envelope;
        const finalAmp = sound.amp * volume; // Apply individual sound volume

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(finalAmp, now + envelope.attack);
        gainNode.gain.linearRampToValueAtTime(finalAmp * envelope.sustain, now + envelope.attack + envelope.decay);
        gainNode.gain.linearRampToValueAtTime(0, now + envelope.attack + envelope.decay + envelope.release);

        // Store gain node for potential volume changes
        const controlObject = {
            oscillator,
            gainNode,
            nodes: [oscillator, gainNode, stereoPanner]
        };

        oscillator.connect(gainNode);
        gainNode.connect(stereoPanner);
        stereoPanner.connect(this.masterGain);

        oscillator.start();
        oscillator.stop(now + envelope.attack + envelope.decay + envelope.release);

        return controlObject;
    }

    // FM synthesis playback (enhanced with volume support)
    playFM(sound, { pan = 0, volume = 1.0, when = 0 } = {}) {
        if (this._useWorklet()) {
            const id = this.worklet.voice({
                at: when, prio: 1, osc: sound.oscillatorType, freq: sound.carrierFreq,
                fm: { freq: sound.modulatorFreq, index: sound.modulationIndex },
                env: this._envBreakpoints(sound.envelope, sound.duration, volume), pan, gain: 1
            });
            return this._workletControl([id], volume);
        }
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

        this.applyEnvelope(gainNode.gain, sound.envelope, sound.duration, volume);

        carrier.start();
        modulator.start();
        carrier.stop(this.context.currentTime + sound.duration);
        modulator.stop(this.context.currentTime + sound.duration);

        return {
            oscillator: carrier,
            gainNode,
            nodes: [carrier, modulator, gainNode, stereoPanner]
        };
    }

    // Multi-oscillator playback (enhanced with volume support)
    playComplex(sound, { pan = 0, volume = 1.0, when = 0 } = {}) {
        if (this._useWorklet()) {
            // One voice per partial, all sharing the envelope - the same sum as the node graph.
            const env = this._envBreakpoints(sound.envelope, sound.duration, volume);
            this._voiceGains = this._voiceGains || new Map();
            const ids = sound.frequencies.map((freq, i) => {
                const mix = sound.mix[i] || 0.5;
                const id = this.worklet.voice({ at: when, prio: 1, osc: sound.oscillatorTypes[i] || "sine", freq, env, pan, gain: mix },
                    () => this._voiceGains.delete(id));
                this._voiceGains.set(id, mix);
                return id;
            });
            return this._workletControl(ids, volume);
        }
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

        this.applyEnvelope(masterGain.gain, sound.envelope, sound.duration, volume);

        oscillators.forEach((osc) => {
            osc.start();
            osc.stop(this.context.currentTime + sound.duration);
        });

        return {
            oscillator: oscillators[0], // For compatibility
            gainNode: masterGain,
            nodes: [masterGain, stereoPanner, ...oscillators]
        };
    }

    // Noise generation and playback (enhanced with volume support)
    playNoise(sound, { pan = 0, volume = 1.0, when = 0 } = {}) {
        if (this._useWorklet()) {
            const f = sound.filterOptions || {};
            const id = this.worklet.voice({
                at: when, prio: 1, osc: "noise", noise: sound.noiseType || "white",
                filter: { type: f.type || "lowpass", frequency: f.frequency ?? 350, Q: f.Q ?? 1, gain: f.gain ?? 0 },
                // The node version's buffer is exactly `duration` long, so nothing plays past it.
                env: this._envBreakpoints(sound.envelope, sound.duration, volume), pan, gain: 1
            });
            return this._workletControl([id], volume);
        }
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

        this.applyEnvelope(gainNode.gain, sound.envelope, sound.duration, volume);

        noise.start();
        return {
            oscillator: noise,
            gainNode,
            nodes: [noise, filter, gainNode, stereoPanner]
        };
    }

    // Frequency sweep playback (enhanced with volume support)
    playSweep(sound, { pan = 0, volume = 1.0, when = 0 } = {}) {
        if (this._useWorklet()) {
            const id = this.worklet.voice({
                at: when, prio: 1, osc: sound.oscillatorType, freq: sound.startFreq,
                sweep: { to: sound.endFreq, dur: sound.duration },
                env: this._envBreakpoints(sound.envelope, sound.duration, volume), pan, gain: 1
            });
            return this._workletControl([id], volume);
        }
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

        this.applyEnvelope(gainNode.gain, sound.envelope, sound.duration, volume);

        oscillator.start();
        oscillator.stop(this.context.currentTime + sound.duration);

        return {
            oscillator,
            gainNode,
            nodes: [oscillator, gainNode, stereoPanner]
        };
    }

    // Tracker playback: a song authored as plain data, scheduled on the audio clock.
    /**
     * Render a tracker sound (its name) or a song object offline, much faster than real
     * time, into an AudioBuffer: exactly one pass of the song, ending on its last tick.
     * Same output as live playback through the tracker (before the master volume).
     *
     *   const buffer = await audio.render("song", { mute: [false, true], onProgress: (p) => ... });
     *   const blob = ActionAudioManager.encodeWav(buffer);       // 16-bit stereo WAV
     *
     * options: startOrder, startRow, volume (1), sampleRate (the live one),
     *          mute / solo (arrays of booleans by channel), onProgress(0..1)
     */
    async render(source, options = {}) {
        const def = typeof source === "string" ? this.sounds.get(source) : null;
        const song = def ? def.song : source;
        if (!song || !song.patterns) throw new Error("[AudioManager] render(): not a tracker song: " + source);
        const sampleRate = options.sampleRate || (this.context && this.context.sampleRate) || 48000;
        const needsSf = ActionAudioManager.songUsesSoundFont(song);
        if (needsSf) {
            if (!this.sf2Player) await this.initializeMIDI();
            if (this._midiLoading) await this._midiLoading;
        }
        const synth = this.sf2Player && this.sf2Player.synth;

        const probe = new ActionTracker({ createGain: () => ({ gain: { value: 1 }, connect() {} }) }, null);
        const length = probe.songDuration(song, options);
        const ctx = new OfflineAudioContext(2, Math.ceil(length * sampleRate), sampleRate);
        const tracker = new ActionTracker(ctx, ctx.destination);
        const orderLen = song.order && song.order.length ? song.order.length : Object.keys(song.patterns).length;
        const onRow = options.onProgress ? (o) => options.onProgress(Math.min(1, (o + 1) / orderLen)) : null;
        const playOpts = { volume: options.volume ?? 1, loop: false, startOrder: options.startOrder, startRow: options.startRow, onRow };

        let host = null;
        if (window.ActionAudioWorkletHost && ctx.audioWorklet && ActionAudioManager.engine !== "nodes") {
            host = new ActionAudioWorkletHost(ctx, ctx.destination);
            try { await host.ready; } catch (e) { host = null; }
        }
        if (host) {
            tracker.attachWorklet(host);
            if (needsSf && synth) { host.loadSoundFont(synth); tracker.setSoundFont({ synth }); }
            ctx.suspend(0).then(async () => {
                const handle = tracker._playWorklet(song, { ...playOpts, at: 0 });
                ActionAudioManager._applyMuteSolo(handle, options);
                await host.sync();
                ctx.resume();
            });
            const buffer = await ctx.startRendering();
            if (options.onProgress) options.onProgress(1);
            return buffer;
        }

        // Node fallback: queue the whole song up front (a lookahead longer than the song),
        // then render. Slower, but the same sound as the node engine plays live.
        if (needsSf && synth) {
            const sf = new SoundFont(ctx);
            await sf.bootSynth(synth.input.buffer.slice(0));
            tracker.setSoundFont(sf);
        }
        const handle = tracker.play(song, { ...playOpts, lookahead: length + 1 });
        ActionAudioManager._applyMuteSolo(handle, options);
        const ticks = length * 200;                      // generous: 512 ticks per 25 ms pump
        await new Promise((r) => setTimeout(r, Math.max(100, (ticks / 512) * 30)));
        clearInterval(handle._timer);
        const buffer = await ctx.startRendering();
        if (options.onProgress) options.onProgress(1);
        return buffer;
    }

    static _applyMuteSolo(handle, options) {
        (options.mute || []).forEach((m, i) => { if (m) handle.setMute(i, true); });
        (options.solo || []).forEach((s, i) => { if (s) handle.setSolo(i, true); });
    }

    /** 16-bit PCM WAV (stereo, or mono for a 1-channel buffer) from an AudioBuffer. */
    static encodeWav(buffer) {
        const chans = Math.min(2, buffer.numberOfChannels);
        const data = Array.from({ length: chans }, (_, c) => buffer.getChannelData(c));
        const frames = buffer.length, bytes = 44 + frames * chans * 2;
        const v = new DataView(new ArrayBuffer(bytes));
        const str = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
        str(0, "RIFF"); v.setUint32(4, bytes - 8, true); str(8, "WAVE");
        str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, chans, true);
        v.setUint32(24, buffer.sampleRate, true); v.setUint32(28, buffer.sampleRate * chans * 2, true);
        v.setUint16(32, chans * 2, true); v.setUint16(34, 16, true);
        str(36, "data"); v.setUint32(40, frames * chans * 2, true);
        let off = 44;
        for (let i = 0; i < frames; i++) {
            for (let c = 0; c < chans; c++) { v.setInt16(off, Math.max(-1, Math.min(1, data[c][i])) * 32767, true); off += 2; }
        }
        return new Blob([v.buffer], { type: "audio/wav" });
    }

    // The shared tracker, on the audio-thread engine when that is running.
    getTracker() {
        if (!this.tracker) this.tracker = new ActionTracker(this.context, this.masterGain);
        if (this.engine === "worklet" && this.worklet && !this.tracker.worklet) this.tracker.attachWorklet(this.worklet);
        this._attachSoundFontToTracker();
        return this.tracker;
    }

    playTracker(sound, options = {}) {
        this.getTracker();
        if (!this.sf2Player && ActionAudioManager.songUsesSoundFont(sound.song)) this.initializeMIDI();
        const handle = this.tracker.play(sound.song, options);
        return {
            stop: () => handle.stop(),
            pause: () => handle.pause(),
            resume: () => handle.resume(),
            setVolume: (v) => handle.setVolume(v),
            isPlaying: () => handle.isPlaying,
            nodes: [],
            trackerHandle: handle
        };
    }

    parseSonicPi(script, samples) {
        const parser = new SonicPiParser(this);
        return parser.parseScript(script, samples);
    }

    // SonicPi on the audio-thread engine: every event is scheduled up front on the audio
    // clock (the node path fires each one from a setTimeout). Same sounds as the node path:
    // `play` = sine at the note, `sample` = the synthetic buffer or a SoundFont note.
    // Scripts using echo / reverb / wobble keep the node path (those effects live there).
    _playSonicPiWorklet(sound, options) {
        const host = this.worklet;
        const t0 = this.context.currentTime + 0.02;
        const volume = options.volume ?? 1;
        const ids = [];
        const midiNotes = [];
        // Envelope through breakpoints in order (equal times = a jump), cut at `end` -
        // the source stops there.
        const cut = (pts, end) => {
            const out = [];
            for (let i = 0; i < pts.length; i++) {
                const [t, v] = pts[i];
                if (t >= end) {
                    const [ta, va] = out.length ? out[out.length - 1] : [0, 0];
                    out.push([end, t > ta ? va + (v - va) * ((end - ta) / (t - ta)) : v]);
                    return out;
                }
                out.push([t, v]);
            }
            return out;
        };
        // The node path reaches the output twice: once from where the voice is built (a
        // synth through a StereoPanner, a sample straight), once after its effects (panned if
        // the event has a pan, else straight). Straight mono = both sides at full level, i.e.
        // a centre voice at sqrt(2). Unfiltered paths with the same pan merge into one voice.
        // StereoPannerNode laws, as [left, right] gains: a mono input is equal-power; a
        // stereo input (the synthetic sample buffers, L = R) folds one side into the other.
        const panMono = (p) => { const x = ((p + 1) / 2) * (Math.PI / 2); return [Math.cos(x), Math.sin(x)]; };
        const panStereo = (p) => p <= 0
            ? [1 + Math.cos(((p + 1) * Math.PI) / 2), Math.sin(((p + 1) * Math.PI) / 2)]
            : [Math.cos((p * Math.PI) / 2), 1 + Math.sin((p * Math.PI) / 2)];
        // The node path reaches the output twice: once from where the voice is built (a
        // synth through a StereoPanner, a sample straight), once after its effects (panned if
        // the event has a pan, else straight). Unfiltered paths merge into one voice; two
        // straight paths are the same connection made twice, which Web Audio keeps as one.
        const emit = (spec, filter, isSample) => {
            const p = spec.pan || 0;
            const first = isSample ? [1, 1] : panMono(p);
            const second = p ? (isSample ? panStereo(p) : panMono(p)) : [1, 1];
            const g = spec.gain;
            if (!filter && isSample && !p) { ids.push(host.voice({ ...spec, lr: [g, g], gain: 1 })); return; }
            if (!filter) { ids.push(host.voice({ ...spec, lr: [g * (first[0] + second[0]), g * (first[1] + second[1])], gain: 1 })); return; }
            ids.push(host.voice({ ...spec, lr: [g * first[0], g * first[1]], gain: 1 }));
            ids.push(host.voice({ ...spec, lr: [g * second[0], g * second[1]], gain: 1, filter }));
        };
        let lastEnd = 0;
        for (const event of sound.parsedSequence) {
            if (event.command !== "play" && event.command !== "sample") continue;
            const at = t0 + event.time;
            const attack = event.attack || 0.01;
            const release = event.release || 1;
            const amp = event.amp || 0.5;
            const end = attack + release;
            const outer = [[0, 0], [attack, amp], [end, 0]];
            const lpf = (event.effects || []).find((e) => e.type === "lpf");
            const filter = lpf ? { type: "lowpass", frequency: lpf.params.cutoff || 1000, Q: lpf.params.resonance || 1 } : null;

            if (event.command === "sample") {
                const definition = this.sampleDefinitions.get(event.sample);
                if (definition?.soundType === "midi") {
                    const note = event.note || 60;
                    const vel = Math.floor(definition.amp * 127);
                    this.programChange(0, this.midiProgramMap[definition.instrument], at);
                    this.noteOn(0, note, vel, at);
                    this.noteOff(0, note, at + (event.duration || 0.1));
                    midiNotes.push(note);
                    lastEnd = Math.max(lastEnd, event.time + (event.duration || 0.1));
                    continue;
                }
                const buffer = this.samples.get(event.sample);
                if (buffer) {
                    emit({ at, prio: 0, pcm: host.pcm(buffer), rate: event.rate || 1, env: outer, pan: event.pan || 0, gain: volume }, filter, true);
                    lastEnd = Math.max(lastEnd, event.time + end);
                    continue;
                }
                console.warn(`[AudioManager] No synthetic sample found for ${event.sample}`);
            }
            // Synth note: the node path schedules two envelopes on the same gain - the event's
            // 0 -> amp (attack) -> 0 (end) and, a moment later (from its setTimeout), the synth's
            // own 0 -> 1 (10 ms) -> 0 (duration). They interleave on one timeline, so the
            // synth's ramp to 1 lands last and the note peaks at 1 whatever `amp` says.
            const inner = [[0.0001, 0], [0.0101, 1], [(event.duration || 1) + 0.0001, 0]];
            const merged = [...outer, ...inner].map((pt, i) => [pt[0], pt[1], i]).sort((x, y) => x[0] - y[0] || x[2] - y[2]);
            const env = cut(merged.map(([t, v]) => [t, v]), end);
            const freq = event.command === "play" ? this.midiToFrequency(event.note) : 440;
            emit({ at, prio: 0, osc: "sine", freq, env, pan: event.pan || 0, gain: volume }, filter, false);
            lastEnd = Math.max(lastEnd, event.time + end);
        }
        let isPlaying = true;
        const control = this._workletControl(ids, volume);
        const timer = setTimeout(() => { isPlaying = false; }, (t0 - this.context.currentTime + lastEnd) * 1000);
        return {
            ...control,
            stop: () => {
                isPlaying = false;
                clearTimeout(timer);
                control.stop();
                for (const note of midiNotes) this.noteOff(0, note);
            },
            nodes: [],
            midiNotes,
            isPlaying: () => isPlaying
        };
    }

    playSonicPi(sound, options = {}) {
        if (!this.enabled || !this.context) return;
        const nodeOnlyFx = (e) => (e.effects || []).some((fx) => fx.type !== "lpf");
        if (this._useWorklet() && !sound.parsedSequence.some(nodeOnlyFx)) return this._playSonicPiWorklet(sound, options);

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

            if (event.command !== "play" && event.command !== "sample") {
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

    // ADSR envelope utility (enhanced with volume support)
    applyEnvelope(gainParam, envelope, duration, volume = 1.0) {
        const { attack, decay, sustain, release } = envelope;
        const now = this.context.currentTime;

        gainParam.setValueAtTime(0, now);
        gainParam.linearRampToValueAtTime(volume, now + attack);
        gainParam.linearRampToValueAtTime(volume * sustain, now + attack + decay);
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
