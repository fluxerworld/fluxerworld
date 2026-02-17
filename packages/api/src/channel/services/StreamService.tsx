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

import {type ChannelID, createChannelID, type UserID} from '@fluxer/api/src/BrandedTypes';
import type {ChannelService} from '@fluxer/api/src/channel/services/ChannelService';
import type {StreamPreviewService} from '@fluxer/api/src/channel/services/StreamPreviewService';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import {getMetricsService} from '@fluxer/api/src/infrastructure/MetricsService';
import type {ICacheService} from '@fluxer/cache/src/ICacheService';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {EmptyStreamThumbnailPayloadError} from '@fluxer/errors/src/domains/channel/EmptyStreamThumbnailPayloadError';
import {InvalidStreamKeyFormatError} from '@fluxer/errors/src/domains/channel/InvalidStreamKeyFormatError';
import {InvalidStreamThumbnailPayloadError} from '@fluxer/errors/src/domains/channel/InvalidStreamThumbnailPayloadError';
import {StreamKeyChannelMismatchError} from '@fluxer/errors/src/domains/channel/StreamKeyChannelMismatchError';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';
import {StreamKeyScopeMismatchError} from '@fluxer/errors/src/domains/oauth/StreamKeyScopeMismatchError';
import {seconds} from 'itty-time';

type ParsedStreamKey = {scope: 'guild' | 'dm'; guildId?: string; channelId: string; connectionId: string};

export class StreamService {
	constructor(
		private readonly cacheService: ICacheService,
		private readonly channelService: ChannelService,
		private readonly gatewayService: IGatewayService,
		private readonly streamPreviewService: StreamPreviewService,
	) {}

	private parseStreamKey(streamKey: string): ParsedStreamKey | null {
		const parts = streamKey.split(':');
		if (parts.length !== 3) return null;
		const [scopeRaw, channelId, connectionId] = parts;
		if (!channelId || !connectionId) return null;
		if (!/^[0-9]+$/.test(channelId)) return null;
		if (scopeRaw === 'dm') {
			return {scope: 'dm', channelId, connectionId};
		}
		if (!/^[0-9]+$/.test(scopeRaw)) return null;
		return {scope: 'guild', guildId: scopeRaw, channelId, connectionId};
	}

	private getParsedStreamKeyOrThrow(streamKey: string): ParsedStreamKey {
		const parsedKey = this.parseStreamKey(streamKey);
		if (!parsedKey) {
			throw new InvalidStreamKeyFormatError();
		}
		return parsedKey;
	}

	private getChannelIdFromParsedKeyOrThrow(parsedKey: ParsedStreamKey): ChannelID {
		try {
			return createChannelID(BigInt(parsedKey.channelId));
		} catch {
			throw new InvalidStreamKeyFormatError();
		}
	}

	private async assertStreamChannelAccess(params: {
		userId: UserID;
		channelId: ChannelID;
		parsedKey: ParsedStreamKey;
	}): Promise<void> {
		const channel = await this.channelService.getChannel({userId: params.userId, channelId: params.channelId});

		if (channel.guildId) {
			if (params.parsedKey.scope !== 'guild') {
				throw new StreamKeyScopeMismatchError();
			}
			if (params.parsedKey.guildId !== channel.guildId.toString()) {
				throw new StreamKeyScopeMismatchError();
			}
			const hasConnect = await this.gatewayService.checkPermission({
				guildId: channel.guildId,
				channelId: params.channelId,
				userId: params.userId,
				permission: Permissions.CONNECT,
			});
			if (!hasConnect) {
				throw new MissingPermissionsError();
			}
		} else if (params.parsedKey.scope !== 'dm') {
			throw new StreamKeyScopeMismatchError();
		}

		if (params.parsedKey.channelId !== params.channelId.toString()) {
			throw new StreamKeyChannelMismatchError();
		}
	}

	async updateStreamRegion(params: {streamKey: string; region?: string}): Promise<void> {
		await this.cacheService.set(
			`stream_region:${params.streamKey}`,
			{region: params.region, updatedAt: Date.now()},
			seconds('1 day'),
		);
	}

	async getPreview(params: {
		userId: UserID;
		streamKey: string;
	}): Promise<{buffer: Uint8Array; contentType: string} | null> {
		const parsedKey = this.getParsedStreamKeyOrThrow(params.streamKey);
		const channelId = this.getChannelIdFromParsedKeyOrThrow(parsedKey);

		await this.assertStreamChannelAccess({
			userId: params.userId,
			channelId,
			parsedKey,
		});

		const preview = await this.streamPreviewService.getPreview(params.streamKey);
		if (preview) {
			getMetricsService().counter({name: 'fluxer.stream.preview.fetched', value: 1});
		}
		return preview;
	}

	async uploadPreview(params: {
		userId: UserID;
		streamKey: string;
		channelId: ChannelID;
		thumbnail: string;
		contentType?: string;
	}): Promise<void> {
		const parsedKey = this.getParsedStreamKeyOrThrow(params.streamKey);
		await this.assertStreamChannelAccess({
			userId: params.userId,
			channelId: params.channelId,
			parsedKey,
		});

		let body: Uint8Array;
		try {
			body = Uint8Array.from(Buffer.from(params.thumbnail, 'base64'));
		} catch {
			throw new InvalidStreamThumbnailPayloadError();
		}
		if (body.byteLength === 0) {
			throw new EmptyStreamThumbnailPayloadError();
		}

		await this.streamPreviewService.uploadPreview({
			streamKey: params.streamKey,
			channelId: params.channelId,
			userId: params.userId,
			body,
			contentType: params.contentType,
		});

		getMetricsService().counter({name: 'fluxer.stream.preview.uploaded', value: 1});
	}
}
