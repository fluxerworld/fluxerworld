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

import {Config} from '@fluxer/api/src/Config';
import {Logger} from '@fluxer/api/src/Logger';
import {VoiceRepository} from '@fluxer/api/src/voice/VoiceRepository';

export class VoiceDataInitializer {
	async initialize(): Promise<void> {
		if (!Config.voice.enabled || !Config.voice.defaultRegion) {
			return;
		}

		const defaultRegion = Config.voice.defaultRegion;
		const livekitApiKey = Config.voice.apiKey;
		const livekitApiSecret = Config.voice.apiSecret;

		if (!livekitApiKey || !livekitApiSecret) {
			Logger.warn('[VoiceDataInitializer] LiveKit API key/secret not configured, cannot create default region');
			return;
		}

		try {
			const repository = new VoiceRepository();

			const existingRegions = await repository.listRegions();
			if (existingRegions.length > 0) {
				Logger.info(
					`[VoiceDataInitializer] ${existingRegions.length} voice region(s) already exist, skipping default region creation`,
				);
				return;
			}

			Logger.info('[VoiceDataInitializer] Creating default voice region from config...');

			const livekitEndpoint =
				Config.voice.url ||
				(() => {
					const protocol = new URL(Config.endpoints.apiPublic).protocol.slice(0, -1) === 'https' ? 'wss' : 'ws';
					return `${protocol}://${new URL(Config.endpoints.apiPublic).hostname}/livekit`;
				})();

			await repository.createRegion({
				id: defaultRegion.id,
				name: defaultRegion.name,
				emoji: defaultRegion.emoji,
				latitude: defaultRegion.latitude,
				longitude: defaultRegion.longitude,
				isDefault: true,
				restrictions: {
					vipOnly: false,
					requiredGuildFeatures: new Set(),
					allowedGuildIds: new Set(),
					allowedUserIds: new Set(),
				},
			});
			Logger.info(`[VoiceDataInitializer] Created region: ${defaultRegion.name} (${defaultRegion.id})`);

			const serverId = `${defaultRegion.id}-server-1`;

			await repository.createServer({
				regionId: defaultRegion.id,
				serverId,
				endpoint: livekitEndpoint,
				apiKey: livekitApiKey,
				apiSecret: livekitApiSecret,
				isActive: true,
				restrictions: {
					vipOnly: false,
					requiredGuildFeatures: new Set(),
					allowedGuildIds: new Set(),
					allowedUserIds: new Set(),
				},
			});

			Logger.info(`[VoiceDataInitializer] Created server: ${serverId} -> ${livekitEndpoint}`);
			Logger.info('[VoiceDataInitializer] Successfully created default voice region');
		} catch (error) {
			Logger.error({error}, '[VoiceDataInitializer] Failed to create default voice region');
		}
	}
}
