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

import {Logger} from '@fluxer/api/src/Logger';
import type {AuthSession} from '@fluxer/api/src/models/AuthSession';
import {getLocationLabelFromIp} from '@fluxer/api/src/utils/IpUtils';
import {resolveSessionClientInfo} from '@fluxer/api/src/utils/UserAgentUtils';
import type {AuthSessionResponse} from '@fluxer/schema/src/domains/auth/AuthSchemas';
import {uint8ArrayToBase64} from 'uint8array-extras';

async function resolveAuthSessionLocation(session: AuthSession): Promise<string | null> {
	try {
		return await getLocationLabelFromIp(session.clientIp);
	} catch (error) {
		Logger.warn({error, clientIp: session.clientIp}, 'Failed to resolve location from IP');
		return null;
	}
}

export async function mapAuthSessionsToResponse({
	authSessions,
	currentSessionId,
}: {
	authSessions: Array<AuthSession>;
	currentSessionId?: Uint8Array;
}): Promise<Array<AuthSessionResponse>> {
	const sortedSessions = authSessions.toSorted((a, b) => {
		const aTime = a.approximateLastUsedAt?.getTime() || 0;
		const bTime = b.approximateLastUsedAt?.getTime() || 0;
		return bTime - aTime;
	});

	const locationResults = await Promise.allSettled(
		sortedSessions.map((session) => resolveAuthSessionLocation(session)),
	);

	return sortedSessions.map((authSession, index): AuthSessionResponse => {
		const locationResult = locationResults[index];
		const clientLocation = locationResult?.status === 'fulfilled' ? locationResult.value : null;

		let clientOs: string;
		let clientPlatform: string;

		if (authSession.clientUserAgent) {
			const parsed = resolveSessionClientInfo({
				userAgent: authSession.clientUserAgent,
				isDesktopClient: authSession.clientIsDesktop,
			});
			clientOs = parsed.clientOs;
			clientPlatform = parsed.clientPlatform;
		} else {
			clientOs = authSession.clientOs || 'Unknown';
			clientPlatform = authSession.clientPlatform || 'Unknown';
		}

		const idHash = uint8ArrayToBase64(authSession.sessionIdHash, {urlSafe: true});
		const isCurrent = currentSessionId ? Buffer.compare(authSession.sessionIdHash, currentSessionId) === 0 : false;

		return {
			id_hash: idHash,
			client_info: {
				platform: clientPlatform,
				os: clientOs,
				browser: undefined,
				location: clientLocation
					? {
							city: clientLocation.split(',').at(0)?.trim() || null,
							region: clientLocation.split(',').at(1)?.trim() || null,
							country: clientLocation.split(',').at(2)?.trim() || null,
						}
					: null,
			},
			approx_last_used_at: authSession.approximateLastUsedAt?.toISOString() || null,
			current: isCurrent,
		};
	});
}
