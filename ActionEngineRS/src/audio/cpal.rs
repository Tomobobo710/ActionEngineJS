//! Audio playback using cpal (for Windows and macOS)

use super::Sound;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, SizedSample};
use std::sync::{Arc, Mutex};

/// A handle to a playing sound that can be used to stop it
#[derive(Clone)]
pub struct SoundHandle {
    inner: Arc<Mutex<SoundState>>,
}

impl SoundHandle {
    /// Stop this sound
    pub fn stop(&self) {
        if let Ok(mut state) = self.inner.lock() {
            state.stopped = true;
        }
    }

    /// Check if this sound is still playing
    pub fn is_playing(&self) -> bool {
        if let Ok(state) = self.inner.lock() {
            !state.stopped && state.position < state.samples.len()
        } else {
            false
        }
    }
}

struct SoundState {
    samples: Vec<f32>,
    channels: u16,
    position: usize,
    volume: f32,
    looping: bool,
    stopped: bool,
}

/// Audio manager that handles sound playback
pub struct AudioManager {
    _stream: cpal::Stream,
    sounds: Arc<Mutex<Vec<Arc<Mutex<SoundState>>>>>,
    device_sample_rate: u32,
    device_channels: u16,
    master_volume: Arc<Mutex<f32>>,
}

impl AudioManager {
    /// Create a new audio manager
    pub fn new() -> Result<Self, String> {
        let host = cpal::default_host();
        let device = host
            .default_output_device()
            .ok_or("No output device available")?;

        let config = device
            .default_output_config()
            .map_err(|e| e.to_string())?;

        let sample_rate = u32::from(config.sample_rate());
        let channels = config.channels() as u16;

        let sounds: Arc<Mutex<Vec<Arc<Mutex<SoundState>>>>> = Arc::new(Mutex::new(Vec::new()));
        let sounds_clone = sounds.clone();

        let master_volume = Arc::new(Mutex::new(1.0f32));
        let master_volume_clone = master_volume.clone();

        let stream = match config.sample_format() {
            cpal::SampleFormat::F32 => build_stream::<f32>(
                &device,
                &config.into(),
                sounds_clone,
                master_volume_clone,
            )?,
            cpal::SampleFormat::I16 => build_stream::<i16>(
                &device,
                &config.into(),
                sounds_clone,
                master_volume_clone,
            )?,
            cpal::SampleFormat::U16 => build_stream::<u16>(
                &device,
                &config.into(),
                sounds_clone,
                master_volume_clone,
            )?,
            _ => return Err("Unsupported sample format".to_string()),
        };

        stream.play().map_err(|e| e.to_string())?;

        Ok(Self {
            _stream: stream,
            sounds,
            device_sample_rate: sample_rate,
            device_channels: channels,
            master_volume,
        })
    }

    /// Set master volume (0.0 to 1.0)
    pub fn set_master_volume(&mut self, volume: f32) {
        if let Ok(mut v) = self.master_volume.lock() {
            *v = volume.clamp(0.0, 1.0);
        }
    }

    /// Get master volume
    pub fn master_volume(&self) -> f32 {
        self.master_volume.lock().map(|v| *v).unwrap_or(1.0)
    }

    /// Play a sound and return a handle to control it
    pub fn play(&mut self, sound: &Sound, volume: f32, looping: bool) -> SoundHandle {
        // Resample if necessary
        let samples = if sound.sample_rate != self.device_sample_rate
            || sound.channels != self.device_channels
        {
            resample(
                &sound.samples,
                sound.sample_rate,
                sound.channels,
                self.device_sample_rate,
                self.device_channels,
            )
        } else {
            sound.samples.clone()
        };

        let state = Arc::new(Mutex::new(SoundState {
            samples,
            channels: self.device_channels,
            position: 0,
            volume: volume.clamp(0.0, 1.0),
            looping,
            stopped: false,
        }));

        if let Ok(mut sounds) = self.sounds.lock() {
            sounds.push(state.clone());
        }

        SoundHandle { inner: state }
    }

    /// Stop all sounds
    pub fn stop_all(&mut self) {
        if let Ok(mut sounds) = self.sounds.lock() {
            for sound in sounds.iter() {
                if let Ok(mut state) = sound.lock() {
                    state.stopped = true;
                }
            }
            sounds.clear();
        }
    }
}

fn build_stream<T: SizedSample + FromSample<f32>>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    sounds: Arc<Mutex<Vec<Arc<Mutex<SoundState>>>>>,
    master_volume: Arc<Mutex<f32>>,
) -> Result<cpal::Stream, String> {
    let channels = config.channels as usize;

    let stream = device
        .build_output_stream(
            config,
            move |data: &mut [T], _: &cpal::OutputCallbackInfo| {
                let master_vol = master_volume.lock().map(|v| *v).unwrap_or(1.0);

                // Create a temporary f32 mixing buffer
                let mut mix_buffer = vec![0.0f32; data.len()];

                if let Ok(mut sounds_guard) = sounds.lock() {
                    // Remove finished sounds
                    sounds_guard.retain(|s| {
                        if let Ok(state) = s.lock() {
                            !state.stopped && (state.looping || state.position < state.samples.len())
                        } else {
                            false
                        }
                    });

                    // Mix all sounds into the f32 buffer
                    for sound in sounds_guard.iter() {
                        if let Ok(mut state) = sound.lock() {
                            if state.stopped {
                                continue;
                            }

                            let vol = state.volume * master_vol;

                            for frame in mix_buffer.chunks_mut(channels) {
                                if state.position >= state.samples.len() {
                                    if state.looping {
                                        state.position = 0;
                                    } else {
                                        break;
                                    }
                                }

                                for (i, out_sample) in frame.iter_mut().enumerate() {
                                    let idx = state.position + (i % state.channels as usize);
                                    if idx < state.samples.len() {
                                        *out_sample += state.samples[idx] * vol;
                                    }
                                }

                                state.position += state.channels as usize;
                            }
                        }
                    }
                }

                // Convert f32 mix buffer to output format
                for (out, &mix) in data.iter_mut().zip(mix_buffer.iter()) {
                    let clamped = mix.clamp(-1.0, 1.0);
                    *out = T::from_sample(clamped);
                }
            },
            |err| eprintln!("Audio stream error: {}", err),
            None,
        )
        .map_err(|e| e.to_string())?;

    Ok(stream)
}

/// Simple resampling (linear interpolation)
fn resample(
    samples: &[f32],
    src_rate: u32,
    src_channels: u16,
    dst_rate: u32,
    dst_channels: u16,
) -> Vec<f32> {
    let ratio = src_rate as f64 / dst_rate as f64;
    let src_frames = samples.len() / src_channels as usize;
    let dst_frames = (src_frames as f64 / ratio) as usize;

    let mut result = Vec::with_capacity(dst_frames * dst_channels as usize);

    for dst_frame in 0..dst_frames {
        let src_pos = dst_frame as f64 * ratio;
        let src_frame = src_pos as usize;
        let frac = (src_pos - src_frame as f64) as f32;

        for dst_ch in 0..dst_channels {
            let src_ch = if src_channels == 1 {
                0
            } else {
                dst_ch.min(src_channels - 1)
            };

            let idx1 = src_frame * src_channels as usize + src_ch as usize;
            let idx2 = ((src_frame + 1) * src_channels as usize + src_ch as usize)
                .min(samples.len().saturating_sub(1));

            let s1 = samples.get(idx1).copied().unwrap_or(0.0);
            let s2 = samples.get(idx2).copied().unwrap_or(0.0);

            let sample = s1 * (1.0 - frac) + s2 * frac;
            result.push(sample);
        }
    }

    result
}
