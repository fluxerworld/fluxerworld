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

export interface UserInfo {
	id: string;
	username: string;
	discriminator: number;
	avatar: string | null;
	email?: string;
	acls?: Array<string>;
}

export interface LoggerInterface {
	debug(obj: Record<string, unknown> | string, msg?: string): void;
	info(obj: Record<string, unknown> | string, msg?: string): void;
	warn(obj: Record<string, unknown> | string, msg?: string): void;
	error(obj: Record<string, unknown> | string, msg?: string): void;
}

interface FetchUserOptions {
	logger?: LoggerInterface;
}

export async function fetchUser(
	apiEndpoint: string,
	accessToken: string,
	options?: FetchUserOptions,
): Promise<UserInfo | null> {
	try {
		const response = await fetch(`${apiEndpoint}/users/@me`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		if (!response.ok) {
			options?.logger?.warn({status: response.status, apiEndpoint}, 'OAuth2 user fetch failed');
			return null;
		}

		return (await response.json()) as UserInfo;
	} catch (err) {
		options?.logger?.error(
			{error: err instanceof Error ? err.message : String(err), apiEndpoint},
			'OAuth2 user fetch error',
		);
		return null;
	}
}
