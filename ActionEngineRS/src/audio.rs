//! Audio system for ActionEngine
//!
//! Provides audio loading and playback.
//! Supports WAV, MP3, and OGG on all platforms (native and WASM).

// Platform-specific audio backends
#[cfg(all(feature = "glow-backend", target_os = "linux"))]
pub mod pulse;
#[cfg(all(feature = "glow-backend", any(target_os = "windows", target_os = "macos")))]
pub mod cpal;
#[cfg(all(feature = "glow-backend", target_arch = "wasm32"))]
pub mod web;

/// Raw audio data in a playable format
#[derive(Clone)]
pub struct Sound {
    /// Sample rate in Hz (e.g., 44100)
    pub sample_rate: u32,
    /// Number of channels (1 = mono, 2 = stereo)
    pub channels: u16,
    /// Audio samples as f32 in range [-1.0, 1.0], interleaved for stereo
    pub samples: Vec<f32>,
}

impl Sound {
    /// Load a WAV file from bytes
    pub fn from_wav(data: &[u8]) -> Result<Self, String> {
        parse_wav(data)
    }

    /// Load an MP3 file from bytes
    pub fn from_mp3(data: &[u8]) -> Result<Self, String> {
        parse_mp3(data)
    }

    /// Load an OGG Vorbis file from bytes
    pub fn from_ogg(data: &[u8]) -> Result<Self, String> {
        parse_ogg(data)
    }

    /// Get duration in seconds
    pub fn duration(&self) -> f32 {
        self.samples.len() as f32 / (self.sample_rate as f32 * self.channels as f32)
    }
}

/// Parse a WAV file from bytes
fn parse_wav(data: &[u8]) -> Result<Sound, String> {
    if data.len() < 44 {
        return Err("WAV file too small".to_string());
    }

    // Check RIFF header
    if &data[0..4] != b"RIFF" {
        return Err("Not a RIFF file".to_string());
    }

    // Check WAVE format
    if &data[8..12] != b"WAVE" {
        return Err("Not a WAVE file".to_string());
    }

    // Find fmt chunk
    let mut pos = 12;
    let mut sample_rate = 0u32;
    let mut channels = 0u16;
    let mut bits_per_sample = 0u16;
    let mut audio_format = 0u16;

    while pos + 8 <= data.len() {
        let chunk_id = &data[pos..pos + 4];
        let chunk_size = u32::from_le_bytes([data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]]) as usize;

        if chunk_id == b"fmt " {
            if chunk_size < 16 || pos + 8 + chunk_size > data.len() {
                return Err("Invalid fmt chunk".to_string());
            }
            let fmt = &data[pos + 8..];
            audio_format = u16::from_le_bytes([fmt[0], fmt[1]]);
            channels = u16::from_le_bytes([fmt[2], fmt[3]]);
            sample_rate = u32::from_le_bytes([fmt[4], fmt[5], fmt[6], fmt[7]]);
            bits_per_sample = u16::from_le_bytes([fmt[14], fmt[15]]);
        } else if chunk_id == b"data" {
            if audio_format == 0 {
                return Err("fmt chunk must come before data chunk".to_string());
            }

            // Only support PCM (1) and IEEE float (3)
            if audio_format != 1 && audio_format != 3 {
                return Err(format!("Unsupported audio format: {} (only PCM and IEEE float supported)", audio_format));
            }

            let audio_data = &data[pos + 8..pos + 8 + chunk_size.min(data.len() - pos - 8)];

            let samples = if audio_format == 3 {
                // IEEE float
                if bits_per_sample == 32 {
                    audio_data
                        .chunks_exact(4)
                        .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
                        .collect()
                } else {
                    return Err(format!("Unsupported float bit depth: {}", bits_per_sample));
                }
            } else {
                // PCM
                match bits_per_sample {
                    8 => audio_data
                        .iter()
                        .map(|&b| (b as f32 - 128.0) / 128.0)
                        .collect(),
                    16 => audio_data
                        .chunks_exact(2)
                        .map(|b| i16::from_le_bytes([b[0], b[1]]) as f32 / 32768.0)
                        .collect(),
                    24 => audio_data
                        .chunks_exact(3)
                        .map(|b| {
                            let val = i32::from_le_bytes([0, b[0], b[1], b[2]]) >> 8;
                            val as f32 / 8388608.0
                        })
                        .collect(),
                    32 => audio_data
                        .chunks_exact(4)
                        .map(|b| i32::from_le_bytes([b[0], b[1], b[2], b[3]]) as f32 / 2147483648.0)
                        .collect(),
                    _ => return Err(format!("Unsupported bit depth: {}", bits_per_sample)),
                }
            };

            return Ok(Sound {
                sample_rate,
                channels,
                samples,
            });
        }

        pos += 8 + chunk_size;
        // Chunks are word-aligned
        if chunk_size % 2 == 1 {
            pos += 1;
        }
    }

    Err("No data chunk found".to_string())
}

/// Parse an MP3 file from bytes (pure Rust, works on all platforms)
fn parse_mp3(data: &[u8]) -> Result<Sound, String> {
    let (header, sample_iter) = puremp3::read_mp3(data)
        .map_err(|e| format!("MP3 decode error: {:?}", e))?;

    let sample_rate = header.sample_rate.hz();
    let channels = match header.channels {
        puremp3::Channels::Mono => 1u16,
        _ => 2u16, // Stereo, JointStereo, DualChannel all produce stereo output
    };

    let mut samples = Vec::new();

    // read_mp3 returns (left, right) samples
    for (left, right) in sample_iter {
        if channels == 1 {
            samples.push((left + right) / 2.0);
        } else {
            samples.push(left);
            samples.push(right);
        }
    }

    if samples.is_empty() {
        return Err("No audio data in MP3".to_string());
    }

    Ok(Sound {
        sample_rate,
        channels,
        samples,
    })
}

/// Parse an OGG Vorbis file from bytes (pure Rust, works on all platforms)
fn parse_ogg(data: &[u8]) -> Result<Sound, String> {
    use lewton::inside_ogg::OggStreamReader;
    use std::io::Cursor;

    let cursor = Cursor::new(data);
    let mut reader = OggStreamReader::new(cursor).map_err(|e| format!("OGG error: {:?}", e))?;

    let sample_rate = reader.ident_hdr.audio_sample_rate;
    let channels = reader.ident_hdr.audio_channels as u16;

    let mut samples = Vec::new();

    while let Some(packet) = reader
        .read_dec_packet_itl()
        .map_err(|e| format!("OGG decode error: {:?}", e))?
    {
        // Convert i16 samples to f32
        for sample in packet {
            samples.push(sample as f32 / 32768.0);
        }
    }

    if samples.is_empty() {
        return Err("No audio data in OGG".to_string());
    }

    Ok(Sound {
        sample_rate,
        channels,
        samples,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wav_header_validation() {
        // Too small
        assert!(parse_wav(&[0; 10]).is_err());

        // Wrong magic
        assert!(parse_wav(&[0; 44]).is_err());
    }
}
