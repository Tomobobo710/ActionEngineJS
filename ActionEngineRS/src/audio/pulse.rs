//! Audio playback using PulseAudio
//!
//! Uses libpulse-simple for straightforward audio output.
//! Works with both PulseAudio and PipeWire (via pipewire-pulse).

use super::Sound;
use libpulse_binding::sample::{Format, Spec};
use libpulse_binding::stream::Direction;
use libpulse_simple_binding::Simple;
use std::sync::{Arc, Mutex};
use std::thread;

/// A handle to a playing sound that can be used to stop it
#[derive(Clone)]
pub struct SoundHandle {
    stopped: Arc<Mutex<bool>>,
}

impl SoundHandle {
    /// Stop this sound
    pub fn stop(&self) {
        if let Ok(mut stopped) = self.stopped.lock() {
            *stopped = true;
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
    master_volume: f32,
}

impl AudioManager {
    /// Create a new audio manager
    pub fn new() -> Result<Self, String> {
        // Test that PulseAudio is available by creating a temporary connection
        let spec = Spec {
            format: Format::S16le,
            channels: 2,
            rate: 44100,
        };

        let _ = Simple::new(
            None,                // Default server
            "ActionEngine",      // Application name
            Direction::Playback, // Playback stream
            None,                // Default device
            "Test",              // Stream description
            &spec,
            None, // Default channel map
            None, // Default buffering
        )
        .map_err(|e| format!("Failed to connect to PulseAudio: {:?}", e))?;

        Ok(Self {
            master_volume: 1.0,
        })
    }

    /// Set master volume (0.0 to 1.0)
    pub fn set_master_volume(&mut self, volume: f32) {
        self.master_volume = volume.clamp(0.0, 1.0);
    }

    /// Get master volume
    pub fn master_volume(&self) -> f32 {
        self.master_volume
    }

    /// Play a sound and return a handle to control it
    pub fn play(&mut self, sound: &Sound, volume: f32, looping: bool) -> SoundHandle {
        let stopped = Arc::new(Mutex::new(false));
        let stopped_clone = stopped.clone();

        let vol = volume * self.master_volume;

        // Convert samples to i16 and prepare for playback
        let samples: Vec<i16> = if sound.channels == 1 {
            // Mono to stereo
            sound
                .samples
                .iter()
                .flat_map(|&s| {
                    let scaled = (s * vol * 32767.0).clamp(-32768.0, 32767.0) as i16;
                    [scaled, scaled]
                })
                .collect()
        } else {
            // Stereo
            sound
                .samples
                .iter()
                .map(|&s| (s * vol * 32767.0).clamp(-32768.0, 32767.0) as i16)
                .collect()
        };

        let sample_rate = sound.sample_rate;

        // Play in a separate thread
        thread::spawn(move || {
            let spec = Spec {
                format: Format::S16le,
                channels: 2,
                rate: sample_rate,
            };

            let pulse = match Simple::new(
                None,
                "ActionEngine",
                Direction::Playback,
                None,
                "Sound Effect",
                &spec,
                None,
                None,
            ) {
                Ok(p) => p,
                Err(e) => {
                    eprintln!("Failed to create PulseAudio stream: {:?}", e);
                    return;
                }
            };

            // Convert i16 samples to bytes
            let bytes: Vec<u8> = samples
                .iter()
                .flat_map(|&s| s.to_le_bytes())
                .collect();

            // Write in small chunks to allow responsive stopping
            // ~50ms chunks at 44100Hz stereo = 44100 * 2 * 2 * 0.05 = 8820 bytes
            const CHUNK_SIZE: usize = 8820;

            loop {
                let mut offset = 0;

                while offset < bytes.len() {
                    // Check if stopped before each chunk
                    if let Ok(stopped) = stopped_clone.lock() {
                        if *stopped {
                            return;
                        }
                    }

                    let end = (offset + CHUNK_SIZE).min(bytes.len());
                    let chunk = &bytes[offset..end];

                    if let Err(e) = pulse.write(chunk) {
                        eprintln!("PulseAudio write error: {:?}", e);
                        return;
                    }

                    offset = end;
                }

                if !looping {
                    // Drain only at the end for non-looping sounds
                    let _ = pulse.drain();
                    break;
                }
            }

            // Mark as stopped
            if let Ok(mut stopped) = stopped_clone.lock() {
                *stopped = true;
            }
        });

        SoundHandle { stopped }
    }

    /// Stop all sounds
    pub fn stop_all(&mut self) {
        // Individual sounds need to be stopped via their handles
    }
}
