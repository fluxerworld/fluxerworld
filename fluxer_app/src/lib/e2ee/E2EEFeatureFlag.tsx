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

// Single point of truth for "is E2EE turned on for this user?" while the
// feature is gated behind a flag for safety. Because the flag must be
// read at module-init time on a cold load (Olm bootstrap, gateway
// MESSAGE_CREATE handler, etc.) the implementation is intentionally
// synchronous and dependency-free — it consults localStorage with a
// hard-coded default. To enable for a user open DevTools and run:
//
//   localStorage.setItem('fluxer:e2ee:enabled', '1')
//   location.reload()
//
// Flip DEFAULT_ENABLED to true (or read it from the runtime config
// once a server-side switch lands) when the feature is ready for
// general rollout.

const STORAGE_KEY = 'fluxer:e2ee:enabled';
const DEFAULT_ENABLED = false;

export function isE2EEFeatureEnabled(): boolean {
	if (typeof window === 'undefined') return DEFAULT_ENABLED;
	try {
		const value = window.localStorage.getItem(STORAGE_KEY);
		if (value === '1') return true;
		if (value === '0') return false;
	} catch {
		// localStorage unavailable (private mode quirks, etc.) — fall through.
	}
	return DEFAULT_ENABLED;
}
