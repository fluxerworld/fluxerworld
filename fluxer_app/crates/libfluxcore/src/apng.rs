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

use png::{BlendOp, DisposeOp};
use std::io::Cursor;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn crop_and_rotate_apng(
    input: &[u8],
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    rotation_deg: u32,
    resize_width: Option<u32>,
    resize_height: Option<u32>,
) -> Result<Box<[u8]>, JsValue> {
    process_apng(
        input,
        x,
        y,
        width,
        height,
        rotation_deg,
        resize_width,
        resize_height,
    )
}

#[allow(clippy::too_many_arguments)]
fn process_apng(
    input: &[u8],
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    rotation_deg: u32,
    resize_width: Option<u32>,
    resize_height: Option<u32>,
) -> Result<Box<[u8]>, JsValue> {
    let cursor = Cursor::new(input);
    let mut decoder = png::Decoder::new(cursor);
    decoder.set_transformations(png::Transformations::EXPAND | png::Transformations::STRIP_16);

    let mut reader = decoder
        .read_info()
        .map_err(|e| JsValue::from_str(&format!("png read_info: {e}")))?;

    let info = reader.info();
    let animation_control = info
        .animation_control()
        .ok_or_else(|| JsValue::from_str("Not an animated PNG"))?;

    let screen_width = info.width;
    let screen_height = info.height;

    let crop_x = x.min(screen_width);
    let crop_y = y.min(screen_height);
    let crop_w = width.min(screen_width - crop_x);
    let crop_h = height.min(screen_height - crop_y);

    if crop_w == 0 || crop_h == 0 {
        return Err(JsValue::from_str("Crop area is empty"));
    }

    let rotation = rotation_deg.rem_euclid(360);

    let (base_w, base_h) = match rotation {
        90 | 270 => (crop_h, crop_w),
        _ => (crop_w, crop_h),
    };

    let (target_w, target_h) = match (
        resize_width.filter(|w| *w > 0),
        resize_height.filter(|h| *h > 0),
    ) {
        (Some(w), Some(h)) => (w, h),
        _ => (base_w, base_h),
    };

    if target_w == 0 || target_h == 0 {
        return Err(JsValue::from_str("Target dimensions are empty"));
    }

    if crop_x == 0
        && crop_y == 0
        && crop_w == screen_width
        && crop_h == screen_height
        && rotation == 0
        && target_w == screen_width
        && target_h == screen_height
    {
        return Ok(input.to_vec().into_boxed_slice());
    }

    let mut output = Cursor::new(Vec::new());
    let mut encoder = png::Encoder::new(&mut output, target_w, target_h);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    encoder
        .set_animated(animation_control.num_frames, animation_control.num_plays)
        .map_err(|e| JsValue::from_str(&format!("png set_animated: {e}")))?;
    encoder.validate_sequence(true);
    let mut writer = encoder
        .write_header()
        .map_err(|e| JsValue::from_str(&format!("png write_header: {e}")))?;

    let mut canvas = vec![0u8; (screen_width * screen_height * 4) as usize];
    let mut previous_canvas: Option<Vec<u8>> = None;

    let mut processed_any = false;
    const MAX_TOTAL_PIXELS: u64 = 200_000_000;
    let mut processed_pixels: u64 = 0;

    let mut frame_buffer = vec![0u8; (screen_width * screen_height * 4) as usize];

    while let Ok(frame_info) = reader.next_frame_info() {
        processed_any = true;

        let dispose_op = frame_info.dispose_op;
        let blend_op = frame_info.blend_op;
        let delay_num = frame_info.delay_num;
        let delay_den = frame_info.delay_den;
        let fx = frame_info.x_offset as usize;
        let fy = frame_info.y_offset as usize;
        let fw = frame_info.width as usize;
        let fh = frame_info.height as usize;
        let rect_x = frame_info.x_offset;
        let rect_y = frame_info.y_offset;
        let rect_w = frame_info.width;
        let rect_h = frame_info.height;

        if dispose_op == DisposeOp::Previous {
            previous_canvas = Some(canvas.clone());
        }

        reader
            .next_frame(&mut frame_buffer)
            .map_err(|e| JsValue::from_str(&format!("png next_frame: {e}")))?;

        if blend_op == BlendOp::Source {
            draw_frame_on_canvas_source(&mut canvas, screen_width, fx, fy, fw, fh, &frame_buffer);
        } else {
            draw_frame_on_canvas_over(&mut canvas, screen_width, fx, fy, fw, fh, &frame_buffer);
        }

        let (cw, ch) = (crop_w as usize, crop_h as usize);
        let cropped = crop_rgba(
            &canvas,
            screen_width as usize,
            screen_height as usize,
            crop_x as usize,
            crop_y as usize,
            cw,
            ch,
        )?;

        let (rotated, rw, rh) = match rotation {
            90 => rotate_rgba_90(&cropped, cw, ch),
            180 => rotate_rgba_180(&cropped, cw, ch),
            270 => rotate_rgba_270(&cropped, cw, ch),
            _ => (cropped, cw, ch),
        };

        let (final_rgba, _fw, _fh) = if target_w as usize != rw || target_h as usize != rh {
            let resized =
                resize_rgba_nearest(&rotated, rw, rh, target_w as usize, target_h as usize);
            (resized, target_w as usize, target_h as usize)
        } else {
            (rotated, rw, rh)
        };

        processed_pixels += (final_rgba.len() / 4) as u64;
        if processed_pixels > MAX_TOTAL_PIXELS {
            return Err(JsValue::from_str(
                "Animated PNG is too large to crop. Try reducing its dimensions or number of frames.",
            ));
        }

        writer
            .set_frame_delay(delay_num, delay_den)
            .map_err(|e| JsValue::from_str(&format!("png set_frame_delay: {e}")))?;

        writer
            .set_dispose_op(dispose_op)
            .map_err(|e| JsValue::from_str(&format!("png set_dispose_op: {e}")))?;
        writer
            .set_blend_op(blend_op)
            .map_err(|e| JsValue::from_str(&format!("png set_blend_op: {e}")))?;

        writer
            .write_image_data(&final_rgba)
            .map_err(|e| JsValue::from_str(&format!("png write_image_data: {e}")))?;

        match dispose_op {
            DisposeOp::Background => {
                clear_rect(&mut canvas, screen_width, rect_x, rect_y, rect_w, rect_h);
            }
            DisposeOp::Previous => {
                if let Some(prev) = previous_canvas.take() {
                    canvas = prev;
                }
            }
            _ => {}
        }
    }

    if !processed_any {
        return Err(JsValue::from_str("APNG has no frames"));
    }

    writer
        .finish()
        .map_err(|e| JsValue::from_str(&format!("png finish: {e}")))?;

    Ok(output.into_inner().into_boxed_slice())
}

fn draw_frame_on_canvas_source(
    canvas: &mut [u8],
    canvas_width: u32,
    fx: usize,
    fy: usize,
    fw: usize,
    fh: usize,
    buffer: &[u8],
) {
    let cw = canvas_width as usize;

    for row in 0..fh {
        let canvas_y = fy + row;
        let canvas_offset = (canvas_y * cw + fx) * 4;
        let frame_offset = row * fw * 4;

        if canvas_offset + fw * 4 <= canvas.len() && frame_offset + fw * 4 <= buffer.len() {
            canvas[canvas_offset..canvas_offset + fw * 4]
                .copy_from_slice(&buffer[frame_offset..frame_offset + fw * 4]);
        }
    }
}

fn draw_frame_on_canvas_over(
    canvas: &mut [u8],
    canvas_width: u32,
    fx: usize,
    fy: usize,
    fw: usize,
    fh: usize,
    buffer: &[u8],
) {
    let cw = canvas_width as usize;

    for row in 0..fh {
        let canvas_y = fy + row;
        let canvas_offset = (canvas_y * cw + fx) * 4;
        let frame_offset = row * fw * 4;

        if canvas_offset + fw * 4 <= canvas.len() && frame_offset + fw * 4 <= buffer.len() {
            let frame_row = &buffer[frame_offset..frame_offset + fw * 4];
            let canvas_row = &mut canvas[canvas_offset..canvas_offset + fw * 4];

            for i in 0..fw {
                let pixel_idx = i * 4;
                let alpha = frame_row[pixel_idx + 3];
                if alpha > 0 {
                    canvas_row[pixel_idx] = frame_row[pixel_idx];
                    canvas_row[pixel_idx + 1] = frame_row[pixel_idx + 1];
                    canvas_row[pixel_idx + 2] = frame_row[pixel_idx + 2];
                    canvas_row[pixel_idx + 3] = frame_row[pixel_idx + 3];
                }
            }
        }
    }
}

fn clear_rect(canvas: &mut [u8], canvas_width: u32, x: u32, y: u32, w: u32, h: u32) {
    let cw = canvas_width as usize;
    let x = x as usize;
    let y = y as usize;
    let w = w as usize;
    let h = h as usize;

    for row in 0..h {
        let canvas_y = y + row;
        let offset = (canvas_y * cw + x) * 4;
        if offset + w * 4 <= canvas.len() {
            for i in 0..w {
                let idx = offset + i * 4;
                canvas[idx] = 0;
                canvas[idx + 1] = 0;
                canvas[idx + 2] = 0;
                canvas[idx + 3] = 0;
            }
        }
    }
}

fn crop_rgba(
    src: &[u8],
    src_w: usize,
    src_h: usize,
    x: usize,
    y: usize,
    w: usize,
    h: usize,
) -> Result<Vec<u8>, JsValue> {
    if x + w > src_w || y + h > src_h {
        return Err(JsValue::from_str("Crop rect out of bounds"));
    }

    let mut dst = vec![0u8; w * h * 4];

    for row in 0..h {
        let src_y = y + row;
        let src_offset = (src_y * src_w + x) * 4;
        let dst_offset = row * w * 4;
        dst[dst_offset..dst_offset + w * 4].copy_from_slice(&src[src_offset..src_offset + w * 4]);
    }

    Ok(dst)
}

fn rotate_rgba_90(src: &[u8], src_w: usize, src_h: usize) -> (Vec<u8>, usize, usize) {
    let dst_w = src_h;
    let dst_h = src_w;
    let mut dst = vec![0u8; dst_w * dst_h * 4];

    for y in 0..src_h {
        for x in 0..src_w {
            let src_idx = (y * src_w + x) * 4;
            let dst_x = src_h - 1 - y;
            let dst_y = x;
            let dst_idx = (dst_y * dst_w + dst_x) * 4;
            dst[dst_idx..dst_idx + 4].copy_from_slice(&src[src_idx..src_idx + 4]);
        }
    }

    (dst, dst_w, dst_h)
}

fn rotate_rgba_180(src: &[u8], src_w: usize, src_h: usize) -> (Vec<u8>, usize, usize) {
    let mut dst = vec![0u8; src.len()];
    for y in 0..src_h {
        for x in 0..src_w {
            let src_idx = (y * src_w + x) * 4;
            let dst_x = src_w - 1 - x;
            let dst_y = src_h - 1 - y;
            let dst_idx = (dst_y * src_w + dst_x) * 4;
            dst[dst_idx..dst_idx + 4].copy_from_slice(&src[src_idx..src_idx + 4]);
        }
    }
    (dst, src_w, src_h)
}

fn rotate_rgba_270(src: &[u8], src_w: usize, src_h: usize) -> (Vec<u8>, usize, usize) {
    let dst_w = src_h;
    let dst_h = src_w;
    let mut dst = vec![0u8; dst_w * dst_h * 4];

    for y in 0..src_h {
        for x in 0..src_w {
            let src_idx = (y * src_w + x) * 4;
            let dst_x = y;
            let dst_y = dst_h - 1 - x;
            let dst_idx = (dst_y * dst_w + dst_x) * 4;
            dst[dst_idx..dst_idx + 4].copy_from_slice(&src[src_idx..src_idx + 4]);
        }
    }

    (dst, dst_w, dst_h)
}

fn resize_rgba_nearest(
    src: &[u8],
    src_w: usize,
    src_h: usize,
    dst_w: usize,
    dst_h: usize,
) -> Vec<u8> {
    let mut dst = vec![0u8; dst_w * dst_h * 4];

    for dy in 0..dst_h {
        let sy = dy * src_h / dst_h;
        for dx in 0..dst_w {
            let sx = dx * src_w / dst_w;
            let src_idx = (sy * src_w + sx) * 4;
            let dst_idx = (dy * dst_w + dx) * 4;
            dst[dst_idx..dst_idx + 4].copy_from_slice(&src[src_idx..src_idx + 4]);
        }
    }

    dst
}
