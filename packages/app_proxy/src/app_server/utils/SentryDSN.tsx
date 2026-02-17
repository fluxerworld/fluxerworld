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

export interface SentryDSN {
	projectId: string;
	publicKey: string;
	targetUrl: string;
	pathPrefix: string;
}

export function parseSentryDSN(dsn: string | undefined): SentryDSN | null {
	if (!dsn?.trim()) {
		return null;
	}

	try {
		const parsed = new URL(dsn.trim());

		if (!parsed.protocol || !parsed.host) {
			return null;
		}

		const pathPart = parsed.pathname.replace(/^\/+|\/+$/g, '');
		const segments = pathPart ? pathPart.split('/') : [];

		if (segments.length === 0) {
			return null;
		}

		const projectId = segments[segments.length - 1]!;
		const prefixSegments = segments.slice(0, -1);
		const pathPrefix = prefixSegments.length > 0 ? `/${prefixSegments.join('/')}` : '';

		const publicKey = parsed.username;
		if (!publicKey) {
			return null;
		}

		return {
			projectId,
			publicKey,
			targetUrl: `${parsed.protocol}//${parsed.host}`,
			pathPrefix,
		};
	} catch {
		return null;
	}
}
