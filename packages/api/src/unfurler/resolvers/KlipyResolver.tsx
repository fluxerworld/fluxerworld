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
import {BaseResolver} from '@fluxer/api/src/unfurler/resolvers/BaseResolver';
import {buildEmbedMediaPayload} from '@fluxer/api/src/unfurler/resolvers/media/MediaMetadataHelpers';
import type {MessageEmbedResponse} from '@fluxer/schema/src/domains/message/EmbedSchemas';
import {URLType} from '@fluxer/schema/src/primitives/UrlValidators';

interface KlipyMediaFormat {
	url?: string;
	width?: number;
	height?: number;
}

interface KlipyFileFormats {
	gif?: KlipyMediaFormat;
	webp?: KlipyMediaFormat;
	mp4?: KlipyMediaFormat;
}

interface KlipyFile {
	hd?: KlipyFileFormats;
	md?: KlipyFileFormats;
	sm?: KlipyFileFormats;
}

interface KlipyMedia {
	uuid?: string;
	slug?: string;
	description?: string;
	title?: string;
	file?: KlipyFile;
	type?: string;
}

export class KlipyResolver extends BaseResolver {
	override transformUrl(url: URL): URL | null {
		if (url.hostname !== 'klipy.com') {
			return null;
		}
		const pathMatch = url.pathname.match(/^\/(gif|gifs|clip|clips)\/([^/]+)/);
		if (!pathMatch) {
			return null;
		}
		const [, type, slug] = pathMatch;
		const normalizedType = type.startsWith('clip') ? 'clips' : 'gifs';
		return new URL(`https://klipy.com/${normalizedType}/${slug}/player`);
	}

	match(url: URL, mimeType: string, _content: Uint8Array): boolean {
		return mimeType.startsWith('text/html') && url.hostname === 'klipy.com';
	}

	async resolve(url: URL, content: Uint8Array, isNSFWAllowed: boolean = false): Promise<Array<MessageEmbedResponse>> {
		const playerContent = Buffer.from(content).toString('utf-8');
		const media = this.extractMediaFromPlayerPage(playerContent);
		if (!media) {
			return [];
		}
		const {thumbnail: thumbnailFormat, video: videoFormat} = this.extractMediaFormats(media);
		const thumbnail = thumbnailFormat ? await this.resolveKlipyMedia(url, thumbnailFormat, isNSFWAllowed) : undefined;
		const video = videoFormat ? await this.resolveKlipyMedia(url, videoFormat, isNSFWAllowed) : undefined;
		const embed: MessageEmbedResponse = {
			type: 'gifv',
			url: url.href,
			provider: {name: 'KLIPY', url: 'https://klipy.com'},
			thumbnail: thumbnail ?? undefined,
			video: video ?? undefined,
		};
		return [embed];
	}

	private async resolveKlipyMedia(
		baseUrl: URL,
		format: KlipyMediaFormat,
		isNSFWAllowed: boolean,
	): Promise<MessageEmbedResponse['image']> {
		if (!format.url) {
			return null;
		}
		const resolvedUrl = this.resolveRelativeURL(baseUrl.href, format.url);
		if (!resolvedUrl || !URLType.safeParse(resolvedUrl).success) {
			return null;
		}
		try {
			const metadata = await this.mediaService.getMetadata({
				type: 'external',
				url: resolvedUrl,
				isNSFWAllowed,
			});
			return buildEmbedMediaPayload(resolvedUrl, metadata, {
				width: format.width,
				height: format.height,
			});
		} catch (error) {
			Logger.error({error}, 'Failed to resolve Klipy media URL metadata');
			return null;
		}
	}

	private extractMediaFromPlayerPage(content: string): KlipyMedia | null {
		const scriptMatches = content.matchAll(/self\.__next_f\.push\(\[1,"(.*?)"\]\)/gs);
		for (const match of scriptMatches) {
			if (!match[1]) {
				continue;
			}
			const media = this.parseNextFlightData(match[1]);
			if (media?.file) {
				return media;
			}
		}
		return null;
	}

	private parseNextFlightData(encodedData: string): KlipyMedia | null {
		try {
			const unescaped = JSON.parse(`"${encodedData}"`) as string;
			const colonIndex = unescaped.indexOf(':');
			if (colonIndex === -1) {
				return null;
			}
			const jsonArrayStr = unescaped.slice(colonIndex + 1);
			const flightArray = JSON.parse(jsonArrayStr) as Array<unknown>;
			for (const item of flightArray) {
				if (this.isMediaContainer(item)) {
					return item.media;
				}
			}
			return null;
		} catch {
			return null;
		}
	}

	private isMediaContainer(item: unknown): item is {media: KlipyMedia} {
		return (
			typeof item === 'object' &&
			item !== null &&
			'media' in item &&
			typeof (item as {media: unknown}).media === 'object' &&
			(item as {media: {file?: unknown}}).media !== null &&
			'file' in ((item as {media: {file?: unknown}}).media ?? {})
		);
	}

	private extractMediaFormats(media: KlipyMedia): {thumbnail?: KlipyMediaFormat; video?: KlipyMediaFormat} {
		const file = media.file;
		return {
			thumbnail: file?.hd?.webp,
			video: file?.hd?.mp4,
		};
	}
}
