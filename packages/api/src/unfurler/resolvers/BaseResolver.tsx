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

import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import {Logger} from '@fluxer/api/src/Logger';
import {buildEmbedMediaPayload} from '@fluxer/api/src/unfurler/resolvers/media/MediaMetadataHelpers';
import type {MessageEmbedResponse} from '@fluxer/schema/src/domains/message/EmbedSchemas';
import {URLType} from '@fluxer/schema/src/primitives/UrlValidators';

export abstract class BaseResolver {
	constructor(protected mediaService: IMediaService) {}

	abstract match(url: URL, mimeType: string, content: Uint8Array): boolean;
	abstract resolve(url: URL, content: Uint8Array, isNSFWAllowed?: boolean): Promise<Array<MessageEmbedResponse>>;

	transformUrl(_url: URL): URL | null {
		return null;
	}

	protected resolveRelativeURL(baseUrl: string, relativeUrl?: string): string | null {
		if (!relativeUrl) {
			return null;
		}
		try {
			return new URL(relativeUrl, baseUrl).href;
		} catch (error) {
			Logger.error({error}, 'Failed to resolve relative URL');
			return relativeUrl;
		}
	}

	protected async resolveMediaURL(
		url: URL,
		mediaUrl?: string | null,
		isNSFWAllowed: boolean = false,
	): Promise<MessageEmbedResponse['image']> {
		if (!mediaUrl) {
			return null;
		}

		const resolvedUrl = this.resolveRelativeURL(url.href, mediaUrl);
		if (resolvedUrl && URLType.safeParse(resolvedUrl).success) {
			try {
				const metadata = await this.mediaService.getMetadata({
					type: 'external',
					url: resolvedUrl,
					isNSFWAllowed,
				});
				return buildEmbedMediaPayload(resolvedUrl, metadata);
			} catch (error) {
				Logger.error({error}, 'Failed to resolve media URL metadata');
				return null;
			}
		}

		return null;
	}
}
