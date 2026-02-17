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

import {EmbedMediaFlags, EmbedMediaFlagsDescriptions} from '@fluxer/constants/src/ChannelConstants';
import {createBitflagInt32Type, Int32Type} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const EmbedAuthorResponse = z.object({
	name: z.string().describe('The name of the author'),
	url: z.url().nullish().describe('The URL of the author'),
	icon_url: z.url().nullish().describe('The URL of the author icon'),
	proxy_icon_url: z.url().nullish().describe('The proxied URL of the author icon'),
});

export type EmbedAuthorResponse = z.infer<typeof EmbedAuthorResponse>;

export const EmbedFooterResponse = z.object({
	text: z.string().describe('The footer text'),
	icon_url: z.url().nullish().describe('The URL of the footer icon'),
	proxy_icon_url: z.url().nullish().describe('The proxied URL of the footer icon'),
});

export type EmbedFooterResponse = z.infer<typeof EmbedFooterResponse>;

export const EmbedMediaResponse = z.object({
	url: z.string().describe('The URL of the media'),
	proxy_url: z.url().nullish().describe('The proxied URL of the media'),
	content_type: z.string().nullish().describe('The MIME type of the media'),
	content_hash: z.string().nullish().describe('The hash of the media content'),
	width: Int32Type.nullish().describe('The width of the media in pixels'),
	height: Int32Type.nullish().describe('The height of the media in pixels'),
	description: z.string().nullish().describe('The description of the media'),
	placeholder: z.string().nullish().describe('The base64 encoded placeholder image for lazy loading'),
	duration: Int32Type.nullish().describe('The duration of the media in seconds'),
	flags: createBitflagInt32Type(
		EmbedMediaFlags,
		EmbedMediaFlagsDescriptions,
		'The bitwise flags for this media',
		'EmbedMediaFlags',
	),
});

export type EmbedMediaResponse = z.infer<typeof EmbedMediaResponse>;

export const EmbedFieldResponse = z.object({
	name: z.string().describe('The name of the field'),
	value: z.string().describe('The value of the field'),
	inline: z.boolean().describe('Whether the field should be displayed inline'),
});

export type EmbedFieldResponse = z.infer<typeof EmbedFieldResponse>;

interface MessageEmbedChildResponseData {
	type: string;
	url?: string | null;
	title?: string | null;
	color?: number | null;
	timestamp?: string | null;
	description?: string | null;
	author?: EmbedAuthorResponse | null;
	image?: EmbedMediaResponse | null;
	thumbnail?: EmbedMediaResponse | null;
	footer?: EmbedFooterResponse | null;
	fields?: Array<EmbedFieldResponse> | null;
	provider?: EmbedAuthorResponse | null;
	video?: EmbedMediaResponse | null;
	audio?: EmbedMediaResponse | null;
	nsfw?: boolean | null;
}

interface MessageEmbedResponseData extends MessageEmbedChildResponseData {
	children?: Array<MessageEmbedChildResponseData> | null;
}

export const MessageEmbedChildResponse = z.object({
	type: z.string().describe('The type of embed (e.g., rich, image, video, gifv, article, link)'),
	url: z.url().nullish().describe('The URL of the embed'),
	title: z.string().nullish().describe('The title of the embed'),
	color: Int32Type.nullish().describe('The color code of the embed sidebar'),
	timestamp: z.iso.datetime().nullish().describe('The ISO 8601 timestamp of the embed content'),
	description: z.string().nullish().describe('The description of the embed'),
	author: EmbedAuthorResponse.nullish().describe('The author information of the embed'),
	image: EmbedMediaResponse.nullish().describe('The image of the embed'),
	thumbnail: EmbedMediaResponse.nullish().describe('The thumbnail of the embed'),
	footer: EmbedFooterResponse.nullish().describe('The footer of the embed'),
	fields: z.array(EmbedFieldResponse).max(25).nullish().describe('The fields of the embed'),
	provider: EmbedAuthorResponse.nullish().describe('The provider of the embed (e.g., YouTube, Twitter)'),
	video: EmbedMediaResponse.nullish().describe('The video of the embed'),
	audio: EmbedMediaResponse.nullish().describe('The audio of the embed'),
	nsfw: z.boolean().nullish().describe('Whether the embed is flagged as NSFW'),
});

export type MessageEmbedChildResponse = z.infer<typeof MessageEmbedChildResponse>;

export const MessageEmbedResponse: z.ZodType<MessageEmbedResponseData> = MessageEmbedChildResponse.extend({
	children: z
		.array(MessageEmbedChildResponse)
		.max(1)
		.nullish()
		.describe('Internal nested embeds generated by unfurlers'),
});

export type MessageEmbedResponse = z.infer<typeof MessageEmbedResponse>;

export interface EmbedAuthor {
	readonly name: string;
	readonly url?: string;
	readonly icon_url?: string;
	readonly proxy_icon_url?: string;
}

export interface EmbedFooter {
	readonly text: string;
	readonly icon_url?: string;
	readonly proxy_icon_url?: string;
}

export interface EmbedMedia {
	readonly url: string;
	readonly proxy_url?: string;
	readonly content_type?: string;
	readonly content_hash?: string | null;
	readonly width?: number;
	readonly height?: number;
	readonly placeholder?: string;
	readonly flags: number;
	readonly description?: string;
	readonly duration?: number;
	readonly nsfw?: boolean;
}

export interface EmbedField {
	readonly name: string;
	readonly value: string;
	readonly inline: boolean;
}

export interface MessageEmbed {
	readonly id?: string;
	readonly type: string;
	readonly url?: string;
	readonly title?: string;
	readonly color?: number;
	readonly timestamp?: string;
	readonly description?: string;
	readonly author?: EmbedAuthor;
	readonly image?: EmbedMedia;
	readonly thumbnail?: EmbedMedia;
	readonly footer?: EmbedFooter;
	readonly fields?: ReadonlyArray<EmbedField>;
	readonly provider?: EmbedAuthor;
	readonly video?: EmbedMedia;
	readonly audio?: EmbedMedia;
	readonly children?: ReadonlyArray<MessageEmbedChild>;
	readonly flags?: number;
	readonly nsfw?: boolean;
}

export interface MessageEmbedChild {
	readonly id?: string;
	readonly type: string;
	readonly url?: string;
	readonly title?: string;
	readonly color?: number;
	readonly timestamp?: string;
	readonly description?: string;
	readonly author?: EmbedAuthor;
	readonly image?: EmbedMedia;
	readonly thumbnail?: EmbedMedia;
	readonly footer?: EmbedFooter;
	readonly fields?: ReadonlyArray<EmbedField>;
	readonly provider?: EmbedAuthor;
	readonly video?: EmbedMedia;
	readonly audio?: EmbedMedia;
	readonly flags?: number;
	readonly nsfw?: boolean;
}
