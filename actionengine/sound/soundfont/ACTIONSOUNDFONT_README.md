# ActionSoundFont - Custom SoundFont Implementation

A custom implementation of SoundFont2 playback to replace the 3rd party sf2-player library.

## Overview

ActionSoundFont provides identical functionality to the original 3rd party library but is entirely self-contained within the ActionEngine codebase. It includes:

- **ActionSoundFont** - Main class providing the SoundFont player API
- **ActionParser** - SF2 file parser (RIFF/SF2 format)
- **ActionReverb** - Reverb effect processor
- **ActionSynthesizer** - Core synthesis engine
- **ActionSynthesizerNote** - Individual note playback

## Files

```
actionengine/sound/
├── actionsoundfont.js      # Main SoundFont player class
├── actionparser.js          # SF2 file parser
├── actionreverb.js          # Reverb effect
└── audiomanager.js          # Audio manager (uses ActionSoundFont)
```

## Migration from 3rd Party Library

### Before (3rd party library):
```html
<script src="actionengine/3rdparty/sf2-player/parser.js"></script>
<script src="actionengine/3rdparty/sf2-player/reverb.js"></script>
<script src="actionengine/3rdparty/sf2-player/sound_font_synth_note.js"></script>
<script src="actionengine/3rdparty/sf2-player/sound_font_synth.js"></script>
<script src="actionengine/3rdparty/sf2-player/sf2-player.js"></script>
```

### After (ActionSoundFont):
```html
<script src="actionengine/sound/actionreverb.js"></script>
<script src="actionengine/sound/actionparser.js"></script>
<script src="actionengine/sound/actionsoundfont.js"></script>
```

**Important:** Load files in this order (reverb → parser → soundfont).

## API Compatibility

ActionSoundFont is a **drop-in replacement** with identical API:

```javascript
// Works with both old and new implementation
const soundFont = new SoundFont(audioContext);
await soundFont.loadSoundFontFromBase64(base64Data);

// Set program and channel
soundFont.program = 0;  // Piano
soundFont.channel = 0;

// Play notes
soundFont.noteOn(60, 127, 0);   // Middle C, max velocity, channel 0
soundFont.noteOff(60, 127, 0);  // Release note
```

## Usage in AudioManager

The AudioManager already uses the correct API, so no changes are needed:

```javascript
// From audiomanager.js - already compatible!
async initializeMIDI() {
    if (this.sf2Player) return;
    
    try {
        this.sf2Player = new SoundFont(this.context);
        await this.sf2Player.loadSoundFontFromBase64(window.TimGM6mb_BASE64);
        this.midiReady = true;
    } catch (error) {
        console.error("[AudioManager] Failed to initialize SF2 player:", error);
    }
}
```

## Implementation Details

### ActionSoundFont Class
Provides the main API surface:
- `loadSoundFontFromBase64(base64String)` - Load SF2 data
- `noteOn(note, velocity, channel)` - Play MIDI note
- `noteOff(note, velocity, channel)` - Stop MIDI note
- `program` setter/getter - Instrument selection
- `channel` setter/getter - MIDI channel
- `bank` setter/getter - Bank selection

### ActionParser Class
Parses SoundFont2 (.sf2) files:
- RIFF chunk parsing
- SF2 structure parsing (INFO, sdta, pdta)
- Preset and instrument extraction
- Sample data decoding
- Sample rate adjustment

### ActionSynthesizer Class
Core synthesis engine:
- 16 MIDI channels
- Per-channel state (volume, pan, pitch bend, etc.)
- Instrument and bank management
- Note-on/note-off handling
- Percussion support (channel 10)

### ActionSynthesizerNote Class
Individual note playback:
- ADSR envelope (Attack, Decay, Sustain, Release)
- Sample playback with looping
- Pitch bend support
- Pan and filter effects
- Reverb integration

### ActionReverb Class
Reverb effect processor:
- Convolution-based reverb
- Impulse response generation
- Dry/wet mix control
- Filter effects
- Configurable decay and time

## Features Implemented

✅ Full SF2 file parsing
✅ Multi-channel MIDI playback (16 channels)
✅ Instrument selection (128 programs)
✅ Bank selection
✅ ADSR envelope support
✅ Sample looping
✅ Pitch bend
✅ Pan/balance control
✅ Volume and expression
✅ Reverb effects
✅ Percussion mode (channel 10)
✅ Note velocity
✅ Sample rate adjustment

## Testing

To test the implementation:

1. Load a SoundFont file (e.g., TimGM6mb)
2. Play notes through various instruments
3. Test MIDI features (pitch bend, volume, pan)
4. Verify percussion on channel 10
5. Check reverb effects

```javascript
// Test script
const audioContext = new AudioContext();
const sf = new ActionSoundFont(audioContext);

await sf.loadSoundFontFromBase64(soundFontData);

// Piano on channel 0
sf.program = 0;
sf.channel = 0;
sf.noteOn(60, 100, 0);  // Middle C

setTimeout(() => {
    sf.noteOff(60, 100, 0);
}, 1000);
```

## Performance Considerations

- **Shared Reverb**: Single reverb instance shared across all channels to reduce memory
- **Sample Caching**: Parsed samples are cached in the bank set
- **On-Demand Parsing**: SF2 files are only parsed once during initialization
- **Web Audio API**: Leverages native browser audio processing

## Limitations

- Simplified modulator support (full SF2 modulators not implemented)
- Basic filter implementation (lowpass only for now)
- Limited LFO support
- No real-time sample streaming (entire SF2 loaded into memory)

## Browser Compatibility

Requires modern browsers with:
- Web Audio API support
- AudioContext
- Typed Arrays (Int16Array, Float32Array, Uint8Array)
- ES6+ features (classes, arrow functions, async/await)

## Future Enhancements

- [ ] Additional filter types (highpass, bandpass)
- [ ] LFO (Low Frequency Oscillator) support
- [ ] More comprehensive modulator support
- [ ] Real-time SF2 streaming for large files
- [ ] Additional effect types (chorus, delay)
- [ ] SoundFont preset browser UI

## Credits

Based on concepts from the sf2-player library but completely rewritten for ActionEngine.

## License

Part of ActionEngineJS - see main project license.
