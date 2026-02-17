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

use image::imageops::FilterType;
use image::{DynamicImage, GenericImageView, ImageFormat, RgbaImage, imageops};
use std::io::Cursor;
use wasm_bindgen::prelude::*;

fn normalize_rotation(rotation_deg: u32) -> u32 {
    rotation_deg % 360
}

fn map_format_hint(hint: &str) -> Result<ImageFormat, JsValue> {
    match hint.trim().to_lowercase().as_str() {
        "png" | "apng" => Ok(ImageFormat::Png),
        "jpeg" | "jpg" => Ok(ImageFormat::Jpeg),
        "webp" => Ok(ImageFormat::WebP),
        "avif" => Ok(ImageFormat::Avif),
        "gif" => Ok(ImageFormat::Gif),
        _ => Err(JsValue::from_str("Unsupported static format")),
    }
}

#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn crop_and_rotate_image(
    input: &[u8],
    format_hint: &str,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    rotation_deg: u32,
    resize_width: Option<u32>,
    resize_height: Option<u32>,
) -> Result<Box<[u8]>, JsValue> {
    let format = map_format_hint(format_hint)?;
    let dynamic_image = image::load_from_memory_with_format(input, format)
        .map_err(|err| JsValue::from_str(&format!("Failed to decode {format_hint}: {err}")))?;

    let (img_w, img_h) = dynamic_image.dimensions();
    let crop_x = x.min(img_w);
    let crop_y = y.min(img_h);
    let crop_w = width.min(img_w.saturating_sub(crop_x));
    let crop_h = height.min(img_h.saturating_sub(crop_y));

    if crop_w == 0 || crop_h == 0 {
        return Err(JsValue::from_str("Crop area is empty"));
    }

    let cropped: RgbaImage = dynamic_image
        .crop_imm(crop_x, crop_y, crop_w, crop_h)
        .to_rgba8();

    let rotated = match normalize_rotation(rotation_deg) {
        90 => imageops::rotate90(&cropped),
        180 => imageops::rotate180(&cropped),
        270 => imageops::rotate270(&cropped),
        _ => cropped.clone(),
    };

    let target_w = resize_width.filter(|w| *w > 0).unwrap_or(rotated.width());
    let target_h = resize_height.filter(|h| *h > 0).unwrap_or(rotated.height());

    if target_w == 0 || target_h == 0 {
        return Err(JsValue::from_str("Target dimensions are empty"));
    }

    let final_buffer = if target_w == rotated.width() && target_h == rotated.height() {
        rotated
    } else {
        imageops::resize(&rotated, target_w, target_h, FilterType::Lanczos3)
    };

    let final_frame = DynamicImage::ImageRgba8(final_buffer);
    let mut output = Cursor::new(Vec::new());
    final_frame
        .write_to(&mut output, format)
        .map_err(|err| JsValue::from_str(&format!("Failed to encode {format_hint}: {err}")))?;

    Ok(output.into_inner().into_boxed_slice())
}
