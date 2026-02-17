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

import {Embed} from '@fluxer/api/src/models/Embed';
import {EmbedAuthor} from '@fluxer/api/src/models/EmbedAuthor';
import {EmbedFooter} from '@fluxer/api/src/models/EmbedFooter';
import {EmbedProvider} from '@fluxer/api/src/models/EmbedProvider';
import {describe, expect, it} from 'vitest';

describe('EmbedAuthor icon URL sanitisation', () => {
	it('normalises empty icon_url values to null', () => {
		const author = new EmbedAuthor({
			name: 'Alice',
			url: 'https://remote.example/@alice',
			icon_url: '',
		});

		expect(author.iconUrl).toBeNull();
		expect(author.toMessageEmbedAuthor().icon_url).toBeNull();
	});

	it('normalises invalid icon_url values to null', () => {
		const author = new EmbedAuthor({
			name: 'Alice',
			url: 'https://remote.example/@alice',
			icon_url: 'not-a-valid-url',
		});

		expect(author.iconUrl).toBeNull();
		expect(author.toMessageEmbedAuthor().icon_url).toBeNull();
	});

	it('keeps valid icon_url values', () => {
		const author = new EmbedAuthor({
			name: 'Alice',
			url: ' https://remote.example/@alice ',
			icon_url: ' https://remote.example/avatar.png ',
		});

		expect(author.url).toBe('https://remote.example/@alice');
		expect(author.iconUrl).toBe('https://remote.example/avatar.png');
		expect(author.toMessageEmbedAuthor().url).toBe('https://remote.example/@alice');
		expect(author.toMessageEmbedAuthor().icon_url).toBe('https://remote.example/avatar.png');
	});

	it('normalises invalid author url values to null', () => {
		const author = new EmbedAuthor({
			name: 'Alice',
			url: 'not-a-valid-url',
			icon_url: 'https://remote.example/avatar.png',
		});

		expect(author.url).toBeNull();
		expect(author.toMessageEmbedAuthor().url).toBeNull();
	});
});

describe('EmbedFooter icon URL sanitisation', () => {
	it('normalises empty icon_url values to null', () => {
		const footer = new EmbedFooter({
			text: 'Example Server',
			icon_url: '',
		});

		expect(footer.iconUrl).toBeNull();
		expect(footer.toMessageEmbedFooter().icon_url).toBeNull();
	});

	it('normalises invalid icon_url values to null', () => {
		const footer = new EmbedFooter({
			text: 'Example Server',
			icon_url: 'not-a-valid-url',
		});

		expect(footer.iconUrl).toBeNull();
		expect(footer.toMessageEmbedFooter().icon_url).toBeNull();
	});

	it('keeps valid icon_url values', () => {
		const footer = new EmbedFooter({
			text: 'Example Server',
			icon_url: ' https://remote.example/server-icon.png ',
		});

		expect(footer.iconUrl).toBe('https://remote.example/server-icon.png');
		expect(footer.toMessageEmbedFooter().icon_url).toBe('https://remote.example/server-icon.png');
	});
});

describe('Embed URL sanitisation', () => {
	it('normalises invalid embed url values to null', () => {
		const embed = new Embed({
			type: 'rich',
			title: null,
			description: null,
			url: 'not-a-valid-url',
			timestamp: null,
			color: null,
			author: null,
			provider: null,
			thumbnail: null,
			image: null,
			video: null,
			footer: null,
			fields: null,
			nsfw: null,
			children: null,
		});

		expect(embed.url).toBeNull();
		expect(embed.toMessageEmbed().url).toBeNull();
	});

	it('keeps valid embed urls', () => {
		const embed = new Embed({
			type: 'rich',
			title: null,
			description: null,
			url: ' https://remote.example/post/1 ',
			timestamp: null,
			color: null,
			author: null,
			provider: null,
			thumbnail: null,
			image: null,
			video: null,
			footer: null,
			fields: null,
			nsfw: null,
			children: null,
		});

		expect(embed.url).toBe('https://remote.example/post/1');
		expect(embed.toMessageEmbed().url).toBe('https://remote.example/post/1');
	});
});

describe('EmbedProvider URL sanitisation', () => {
	it('normalises invalid provider url values to null', () => {
		const provider = new EmbedProvider({
			name: 'Example',
			url: 'not-a-valid-url',
		});

		expect(provider.url).toBeNull();
		expect(provider.toMessageEmbedProvider().url).toBeNull();
	});

	it('keeps valid provider urls', () => {
		const provider = new EmbedProvider({
			name: 'Example',
			url: ' https://remote.example ',
		});

		expect(provider.url).toBe('https://remote.example/');
		expect(provider.toMessageEmbedProvider().url).toBe('https://remote.example/');
	});
});
