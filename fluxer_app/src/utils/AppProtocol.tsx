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

// Must match the protocol the Electron desktop app registers via
// app.setAsDefaultProtocolClient (fluxer-desktop/src/main.ts → PROTOCOL).
// Was 'fluxer' from the upstream codebase — silently broke every
// "Open in desktop" deep link on fluxer.world because nothing was
// registered for fluxer:// here.
export const APP_PROTOCOL = 'fluxerworld';
export const APP_PROTOCOL_PREFIX = `${APP_PROTOCOL}://`;
export function buildAppProtocolUrl(path: string): string {
	const cleaned = path.replace(/^\/+/, '');
	return `${APP_PROTOCOL_PREFIX}${cleaned}`;
}
