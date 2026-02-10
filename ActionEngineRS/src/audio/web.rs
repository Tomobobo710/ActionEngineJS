//! Audio playback using WebAudio API (for WASM)

use super::Sound;
use std::sync::{Arc, Mutex};
use wasm_bindgen::JsCast;
use web_sys::{AudioBuffer, AudioBufferSourceNode, AudioContext, GainNode};

/// A handle to a playing sound that can be used to stop it
#[derive(Clone)]
pub struct SoundHandle {
    source: Arc<Mutex<Option<AudioBufferSourceNode>>>,
    stopped: Arc<Mutex<bool>>,
}

impl SoundHandle {
    /// Stop this sound
    pub fn stop(&self) {
        if let Ok(mut stopped) = self.stopped.lock() {
            *stopped = true;
        }
        if let Ok(mut source) = self.source.lock() {
            if let Some(s) = source.take() {
                let _ = s.stop();
            }
        }
    }

    /// Check if this sound is still playing
    pub fn is_playing(&self) -> bool {
        if let Ok(stopped) = self.stopped.lock() {
            !*stopped
        } else {
            false
        }
    }
}

/// Audio manager that handles sound playback
pub struct AudioManager {
    context: AudioContext,
    master_volume: f32,
    master_gain: GainNode,
}

impl AudioManager {
    /// Create a new audio manager
    pub fn new() -> Result<Self, String> {
        let context = AudioContext::new().map_err(|e| format!("Failed to create AudioContext: {:?}", e))?;

        let master_gain = context
            .create_gain()
            .map_err(|e| format!("Failed to create gain node: {:?}", e))?;

        master_gain
            .connect_with_audio_node(&context.destination())
            .map_err(|e| format!("Failed to connect gain node: {:?}", e))?;

        Ok(Self {
            context,
            master_volume: 1.0,
            master_gain,
        })
    }

    /// Set master volume (0.0 to 1.0)
    pub fn set_master_volume(&mut self, volume: f32) {
        self.master_volume = volume.clamp(0.0, 1.0);
        self.master_gain.gain().set_value(self.master_volume);
    }

    /// Get master volume
    pub fn master_volume(&self) -> f32 {
        self.master_volume
    }

    /// Play a sound and return a handle to control it
    pub fn play(&mut self, sound: &Sound, volume: f32, looping: bool) -> SoundHandle {
        // Resume the AudioContext if suspended (browser autoplay policy)
        if self.context.state() == web_sys::AudioContextState::Suspended {
            let _ = self.context.resume();
        }

        let stopped = Arc::new(Mutex::new(false));
        let source_holder: Arc<Mutex<Option<AudioBufferSourceNode>>> = Arc::new(Mutex::new(None));

        // Create audio buffer
        let buffer = match self.create_buffer(sound) {
            Ok(b) => b,
            Err(e) => {
                eprintln!("Failed to create audio buffer: {}", e);
                return SoundHandle {
                    source: source_holder,
                    stopped,
                };
            }
        };

        // Create source node
        let source = match self.context.create_buffer_source() {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Failed to create buffer source: {:?}", e);
                return SoundHandle {
                    source: source_holder,
                    stopped,
                };
            }
        };

        source.set_buffer(Some(&buffer));
        source.set_loop(looping);

        // Create gain node for this sound's volume
        let gain = match self.context.create_gain() {
            Ok(g) => g,
            Err(e) => {
                eprintln!("Failed to create gain node: {:?}", e);
                return SoundHandle {
                    source: source_holder,
                    stopped,
                };
            }
        };

        gain.gain().set_value(volume);

        // Connect: source -> gain -> master_gain -> destination
        if source.connect_with_audio_node(&gain).is_err() {
            eprintln!("Failed to connect source to gain");
        }
        if gain.connect_with_audio_node(&self.master_gain).is_err() {
            eprintln!("Failed to connect gain to master");
        }

        // Start playback
        if source.start().is_err() {
            eprintln!("Failed to start audio source");
        }

        // Store the source for stopping later
        if let Ok(mut holder) = source_holder.lock() {
            *holder = Some(source);
        }

        // Set up ended callback
        let stopped_clone = stopped.clone();
        let source_clone = source_holder.clone();
        let onended = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
            if let Ok(mut s) = stopped_clone.lock() {
                *s = true;
            }
            if let Ok(mut src) = source_clone.lock() {
                *src = None;
            }
        }) as Box<dyn FnMut()>);

        if let Ok(holder) = source_holder.lock() {
            if let Some(s) = holder.as_ref() {
                s.set_onended(Some(onended.as_ref().unchecked_ref()));
            }
        }

        // Leak the closure to prevent it from being dropped
        onended.forget();

        SoundHandle {
            source: source_holder,
            stopped,
        }
    }

    /// Stop all sounds
    pub fn stop_all(&mut self) {
        // WebAudio doesn't have a built-in stop-all, individual handles must be stopped
    }

    fn create_buffer(&self, sound: &Sound) -> Result<AudioBuffer, String> {
        let num_frames = sound.samples.len() / sound.channels as usize;

        let buffer = self
            .context
            .create_buffer(sound.channels as u32, num_frames as u32, sound.sample_rate as f32)
            .map_err(|e| format!("Failed to create buffer: {:?}", e))?;

        // Copy samples to buffer channels using copy_to_channel
        if sound.channels == 1 {
            buffer
                .copy_to_channel(&sound.samples, 0)
                .map_err(|e| format!("Failed to copy channel data: {:?}", e))?;
        } else {
            // Stereo: deinterleave into separate channel buffers
            let mut left = Vec::with_capacity(num_frames);
            let mut right = Vec::with_capacity(num_frames);

            for chunk in sound.samples.chunks(2) {
                left.push(chunk.get(0).copied().unwrap_or(0.0));
                right.push(chunk.get(1).copied().unwrap_or(0.0));
            }

            buffer
                .copy_to_channel(&left, 0)
                .map_err(|e| format!("Failed to copy left channel: {:?}", e))?;
            buffer
                .copy_to_channel(&right, 1)
                .map_err(|e| format!("Failed to copy right channel: {:?}", e))?;
        }

        Ok(buffer)
    }
}
