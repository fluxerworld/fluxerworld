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

import {
	EmbedAuthorResponse,
	EmbedFieldResponse,
	EmbedFooterResponse,
	EmbedMediaResponse,
	MessageEmbedResponse,
} from '@fluxer/schema/src/domains/message/EmbedSchemas';
import {describe, expect, it} from 'vitest';

describe('EmbedAuthorResponse', () => {
	it('accepts valid author with name only', () => {
		const result = EmbedAuthorResponse.safeParse({
			name: 'Test Author',
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.name).toBe('Test Author');
		}
	});

	it('accepts author with all fields', () => {
		const result = EmbedAuthorResponse.safeParse({
			name: 'Test Author',
			url: 'https://example.com',
			icon_url: 'https://example.com/icon.png',
			proxy_icon_url: 'https://proxy.example.com/icon.png',
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.url).toBe('https://example.com');
		}
	});

	it('accepts null optional fields', () => {
		const result = EmbedAuthorResponse.safeParse({
			name: 'Test Author',
			url: null,
			icon_url: null,
		});
		expect(result.success).toBe(true);
	});

	it('requires name', () => {
		const result = EmbedAuthorResponse.safeParse({
			url: 'https://example.com',
		});
		expect(result.success).toBe(false);
	});
});

describe('EmbedFooterResponse', () => {
	it('accepts valid footer with text only', () => {
		const result = EmbedFooterResponse.safeParse({
			text: 'Footer text',
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.text).toBe('Footer text');
		}
	});

	it('accepts footer with all fields', () => {
		const result = EmbedFooterResponse.safeParse({
			text: 'Footer text',
			icon_url: 'https://example.com/icon.png',
			proxy_icon_url: 'https://proxy.example.com/icon.png',
		});
		expect(result.success).toBe(true);
	});

	it('accepts null icon urls', () => {
		const result = EmbedFooterResponse.safeParse({
			text: 'Footer text',
			icon_url: null,
			proxy_icon_url: null,
		});
		expect(result.success).toBe(true);
	});

	it('requires text', () => {
		const result = EmbedFooterResponse.safeParse({
			icon_url: 'https://example.com/icon.png',
		});
		expect(result.success).toBe(false);
	});
});

describe('EmbedMediaResponse', () => {
	it('accepts valid media with url and flags', () => {
		const result = EmbedMediaResponse.safeParse({
			url: 'https://example.com/image.png',
			flags: 0,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.url).toBe('https://example.com/image.png');
		}
	});

	it('accepts media with all fields', () => {
		const result = EmbedMediaResponse.safeParse({
			url: 'https://example.com/image.png',
			proxy_url: 'https://proxy.example.com/image.png',
			content_type: 'image/png',
			content_hash: 'abc123',
			width: 800,
			height: 600,
			description: 'An image',
			placeholder: 'placeholder-data',
			duration: 0,
			flags: 0,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.width).toBe(800);
			expect(result.data.height).toBe(600);
		}
	});

	it('accepts null optional fields', () => {
		const result = EmbedMediaResponse.safeParse({
			url: 'https://example.com/image.png',
			proxy_url: null,
			content_type: null,
			content_hash: null,
			width: null,
			height: null,
			flags: 0,
		});
		expect(result.success).toBe(true);
	});

	it('requires url', () => {
		const result = EmbedMediaResponse.safeParse({
			flags: 0,
		});
		expect(result.success).toBe(false);
	});

	it('requires flags', () => {
		const result = EmbedMediaResponse.safeParse({
			url: 'https://example.com/image.png',
		});
		expect(result.success).toBe(false);
	});

	it('requires width and height to be integers', () => {
		const result = EmbedMediaResponse.safeParse({
			url: 'https://example.com/image.png',
			width: 800.5,
			height: 600,
			flags: 0,
		});
		expect(result.success).toBe(false);
	});
});

describe('EmbedFieldResponse', () => {
	it('accepts valid field', () => {
		const result = EmbedFieldResponse.safeParse({
			name: 'Field Name',
			value: 'Field Value',
			inline: false,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.name).toBe('Field Name');
			expect(result.data.value).toBe('Field Value');
		}
	});

	it('accepts inline field', () => {
		const result = EmbedFieldResponse.safeParse({
			name: 'Field Name',
			value: 'Field Value',
			inline: true,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.inline).toBe(true);
		}
	});

	it('requires all fields', () => {
		const result = EmbedFieldResponse.safeParse({
			name: 'Field Name',
			value: 'Field Value',
		});
		expect(result.success).toBe(false);
	});

	it('requires name', () => {
		const result = EmbedFieldResponse.safeParse({
			value: 'Field Value',
			inline: false,
		});
		expect(result.success).toBe(false);
	});

	it('requires value', () => {
		const result = EmbedFieldResponse.safeParse({
			name: 'Field Name',
			inline: false,
		});
		expect(result.success).toBe(false);
	});
});

describe('MessageEmbedResponse', () => {
	it('accepts valid embed with type only', () => {
		const result = MessageEmbedResponse.safeParse({
			type: 'rich',
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe('rich');
		}
	});

	it('accepts full rich embed', () => {
		const result = MessageEmbedResponse.safeParse({
			type: 'rich',
			url: 'https://example.com',
			title: 'Embed Title',
			color: 0xff5500,
			timestamp: '2024-01-15T12:30:00.000Z',
			description: 'This is a description',
			author: {
				name: 'Author Name',
				url: 'https://example.com/author',
			},
			image: {
				url: 'https://example.com/image.png',
				flags: 0,
			},
			thumbnail: {
				url: 'https://example.com/thumb.png',
				flags: 0,
			},
			footer: {
				text: 'Footer text',
			},
			fields: [
				{name: 'Field 1', value: 'Value 1', inline: false},
				{name: 'Field 2', value: 'Value 2', inline: true},
			],
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.title).toBe('Embed Title');
			expect(result.data.fields).toHaveLength(2);
		}
	});

	it('accepts video embed', () => {
		const result = MessageEmbedResponse.safeParse({
			type: 'video',
			url: 'https://example.com/video',
			video: {
				url: 'https://example.com/video.mp4',
				flags: 0,
				width: 1920,
				height: 1080,
			},
			provider: {
				name: 'Video Provider',
			},
		});
		expect(result.success).toBe(true);
	});

	it('accepts audio embed', () => {
		const result = MessageEmbedResponse.safeParse({
			type: 'audio',
			audio: {
				url: 'https://example.com/audio.mp3',
				flags: 0,
				duration: 180,
			},
		});
		expect(result.success).toBe(true);
	});

	it('accepts null optional fields', () => {
		const result = MessageEmbedResponse.safeParse({
			type: 'rich',
			url: null,
			title: null,
			color: null,
			timestamp: null,
			description: null,
			author: null,
			image: null,
			thumbnail: null,
			footer: null,
			fields: null,
		});
		expect(result.success).toBe(true);
	});

	it('requires type', () => {
		const result = MessageEmbedResponse.safeParse({
			title: 'Title without type',
		});
		expect(result.success).toBe(false);
	});

	it('accepts nsfw flag', () => {
		const result = MessageEmbedResponse.safeParse({
			type: 'image',
			nsfw: true,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.nsfw).toBe(true);
		}
	});

	it('accepts color as integer', () => {
		const result = MessageEmbedResponse.safeParse({
			type: 'rich',
			color: 16711680,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.color).toBe(16711680);
		}
	});

	it('rejects non-integer color', () => {
		const result = MessageEmbedResponse.safeParse({
			type: 'rich',
			color: 123.45,
		});
		expect(result.success).toBe(false);
	});

	it('accepts valid ISO timestamp', () => {
		const result = MessageEmbedResponse.safeParse({
			type: 'rich',
			timestamp: '2024-01-15T12:30:00Z',
		});
		expect(result.success).toBe(true);
	});
});
