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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import type {MarketingArchitecture, MarketingPlatform} from '@fluxer/marketing/src/MarketingContext';

export function detectPlatform(userAgent: string): MarketingPlatform {
	const ua = userAgent.toLowerCase();

	if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
	if (ua.includes('android')) return 'android';
	if (ua.includes('windows')) return 'windows';
	if (ua.includes('macintosh') || ua.includes('mac os x')) return 'macos';
	if (ua.includes('linux') && !ua.includes('android')) return 'linux';
	return 'unknown';
}

export function detectArchitecture(userAgent: string, platform: MarketingPlatform): MarketingArchitecture {
	const ua = userAgent.toLowerCase();

	if (platform === 'windows') {
		return ua.includes('arm64') || ua.includes('aarch64') ? 'arm64' : 'x64';
	}

	if (platform === 'linux') {
		return ua.includes('arm64') || ua.includes('aarch64') || ua.includes('armv8') ? 'arm64' : 'x64';
	}

	if (platform === 'macos') {
		if (
			ua.includes('arm64') ||
			ua.includes('aarch64') ||
			ua.includes('apple silicon') ||
			ua.includes('apple m1') ||
			ua.includes('apple m2') ||
			ua.includes('apple m3')
		) {
			return 'arm64';
		}
		return ua.includes('x86_64') ? 'x64' : 'arm64';
	}

	if (platform === 'android') return 'arm64';
	return 'unknown';
}
