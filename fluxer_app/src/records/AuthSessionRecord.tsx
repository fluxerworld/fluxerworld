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

import type {AuthSessionLocation, AuthSessionResponse} from '@fluxer/schema/src/domains/auth/AuthSchemas';

export class AuthSessionRecord {
	readonly id: string;
	readonly approxLastUsedAt: Date | null;
	readonly clientOs: string;
	readonly clientPlatform: string;
	readonly clientLocation: string | null;
	readonly isCurrent: boolean;
	private readonly clientInfo: AuthSessionResponse['client_info'] | null;

	constructor(data: AuthSessionResponse) {
		this.id = data.id_hash;
		this.approxLastUsedAt = data.approx_last_used_at ? new Date(data.approx_last_used_at) : null;
		this.clientInfo = data.client_info ?? null;
		this.clientOs = this.clientInfo?.os ?? 'Unknown';
		this.clientPlatform = this.clientInfo?.platform ?? 'Unknown';
		this.clientLocation = getLocationLabel(this.clientInfo?.location ?? null);
		this.isCurrent = data.current;
	}

	toJSON(): AuthSessionResponse {
		return {
			id_hash: this.id,
			approx_last_used_at: this.approxLastUsedAt?.toISOString() ?? null,
			client_info: this.clientInfo,
			current: this.isCurrent,
		};
	}

	equals(other: AuthSessionRecord): boolean {
		return JSON.stringify(this) === JSON.stringify(other);
	}
}

function getLocationLabel(location: AuthSessionLocation | null): string | null {
	if (!location) {
		return null;
	}

	const parts = [location.city, location.region, location.country].filter(Boolean);
	return parts.length ? parts.join(', ') : null;
}
