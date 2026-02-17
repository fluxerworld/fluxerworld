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

pub mod animation;
pub mod apng;
pub mod gateway;
pub mod gif;
pub mod static_image;

pub use animation::is_animated_image;
pub use apng::crop_and_rotate_apng;
pub use gateway::decompress_zstd_frame;
pub use gif::crop_and_rotate_gif;
pub use static_image::crop_and_rotate_image;
