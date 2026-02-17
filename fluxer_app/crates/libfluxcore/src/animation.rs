/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

use gif::{ColorOutput, DecodeOptions};
use std::io::Cursor;
use wasm_bindgen::prelude::*;

const PNG_SIGNATURE: [u8; 8] = [137, 80, 78, 71, 13, 10, 26, 10];

enum ImageFormat {
    Gif,
    Png,
    Webp,
    Avif,
    Unknown,
}

fn detect_format(input: &[u8]) -> ImageFormat {
    if input.len() >= 6 && &input[..6] == b"GIF89a" {
        return ImageFormat::Gif;
    }
    if input.len() >= 6 && &input[..6] == b"GIF87a" {
        return ImageFormat::Gif;
    }
    if input.len() >= PNG_SIGNATURE.len() && input[..PNG_SIGNATURE.len()] == PNG_SIGNATURE {
        return ImageFormat::Png;
    }
    if input.len() >= 12 && &input[..4] == b"RIFF" && &input[8..12] == b"WEBP" {
        return ImageFormat::Webp;
    }
    if is_avif_file(input) {
        return ImageFormat::Avif;
    }
    ImageFormat::Unknown
}

fn is_animated_gif(input: &[u8]) -> bool {
    let mut options = DecodeOptions::new();
    options.set_color_output(ColorOutput::RGBA);
    let cursor = Cursor::new(input);
    let mut reader = match options.read_info(cursor) {
        Ok(reader) => reader,
        Err(_) => return false,
    };

    let mut frame_count = 0;
    loop {
        match reader.read_next_frame() {
            Ok(Some(_frame)) => {
                frame_count += 1;
                if frame_count > 1 {
                    return true;
                }
            }
            Ok(None) => break,
            Err(_) => return false,
        }
    }
    false
}

fn has_apng_actl(input: &[u8]) -> bool {
    if input.len() < PNG_SIGNATURE.len() || input[..PNG_SIGNATURE.len()] != PNG_SIGNATURE {
        return false;
    }

    let mut offset = PNG_SIGNATURE.len();
    while offset + 12 <= input.len() {
        let length_bytes = &input[offset..offset + 4];
        let length = u32::from_be_bytes(length_bytes.try_into().unwrap()) as usize;
        let chunk_type = &input[offset + 4..offset + 8];
        if chunk_type == b"acTL" {
            return true;
        }
        offset = offset
            .saturating_add(8)
            .saturating_add(length)
            .saturating_add(4);
    }

    false
}

fn has_webp_anim(input: &[u8]) -> bool {
    if input.len() < 12 || &input[..4] != b"RIFF" || &input[8..12] != b"WEBP" {
        return false;
    }

    let mut offset = 12;
    while offset + 8 <= input.len() {
        let chunk_id = &input[offset..offset + 4];
        let size_bytes = &input[offset + 4..offset + 8];
        let size = u32::from_le_bytes(size_bytes.try_into().unwrap()) as usize;

        if chunk_id == b"ANIM" {
            return true;
        }

        let advance = 8 + size + (size % 2);
        offset = offset.saturating_add(advance);
    }

    false
}

fn is_avif_file(input: &[u8]) -> bool {
    if input.len() < 12 {
        return false;
    }

    let box_type = &input[4..8];

    if box_type != b"ftyp" {
        return false;
    }

    let brand = &input[8..12];
    brand == b"avif" || brand == b"avis"
}

fn has_avif_anim(input: &[u8]) -> bool {
    if !is_avif_file(input) {
        return false;
    }

    if input.len() < 12 {
        return false;
    }

    let brand = &input[8..12];
    brand == b"avis"
}

#[wasm_bindgen]
pub fn is_animated_image(input: &[u8]) -> bool {
    match detect_format(input) {
        ImageFormat::Gif => is_animated_gif(input),
        ImageFormat::Png => has_apng_actl(input),
        ImageFormat::Webp => has_webp_anim(input),
        ImageFormat::Avif => has_avif_anim(input),
        ImageFormat::Unknown => false,
    }
}
