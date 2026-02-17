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

import {AudioResolver} from '@fluxer/api/src/unfurler/resolvers/AudioResolver';
import {createTestAudioContent, MockMediaService} from '@fluxer/api/src/unfurler/tests/ResolverTestUtils';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('AudioResolver', () => {
	let mediaService: MockMediaService;
	let resolver: AudioResolver;

	beforeEach(() => {
		mediaService = new MockMediaService();
		resolver = new AudioResolver(mediaService);
	});

	afterEach(() => {
		mediaService.reset();
	});

	describe('match', () => {
		it('matches audio/mpeg mime type', () => {
			const url = new URL('https://example.com/song.mp3');
			const result = resolver.match(url, 'audio/mpeg', new Uint8Array(0));
			expect(result).toBe(true);
		});

		it('matches audio/wav mime type', () => {
			const url = new URL('https://example.com/sound.wav');
			const result = resolver.match(url, 'audio/wav', new Uint8Array(0));
			expect(result).toBe(true);
		});

		it('matches audio/ogg mime type', () => {
			const url = new URL('https://example.com/track.ogg');
			const result = resolver.match(url, 'audio/ogg', new Uint8Array(0));
			expect(result).toBe(true);
		});

		it('matches audio/flac mime type', () => {
			const url = new URL('https://example.com/music.flac');
			const result = resolver.match(url, 'audio/flac', new Uint8Array(0));
			expect(result).toBe(true);
		});

		it('matches audio/aac mime type', () => {
			const url = new URL('https://example.com/audio.aac');
			const result = resolver.match(url, 'audio/aac', new Uint8Array(0));
			expect(result).toBe(true);
		});

		it('does not match video mime types', () => {
			const url = new URL('https://example.com/video.mp4');
			const result = resolver.match(url, 'video/mp4', new Uint8Array(0));
			expect(result).toBe(false);
		});

		it('does not match image mime types', () => {
			const url = new URL('https://example.com/image.png');
			const result = resolver.match(url, 'image/png', new Uint8Array(0));
			expect(result).toBe(false);
		});

		it('does not match text/html mime types', () => {
			const url = new URL('https://example.com/page.html');
			const result = resolver.match(url, 'text/html', new Uint8Array(0));
			expect(result).toBe(false);
		});

		it('does not match application/json mime types', () => {
			const url = new URL('https://example.com/data.json');
			const result = resolver.match(url, 'application/json', new Uint8Array(0));
			expect(result).toBe(false);
		});
	});

	describe('resolve', () => {
		it('returns an audio embed with correct structure', async () => {
			const url = new URL('https://example.com/song.mp3');
			const content = createTestAudioContent();

			const embeds = await resolver.resolve(url, content);

			expect(embeds).toHaveLength(1);
			expect(embeds[0]!.type).toBe('audio');
			expect(embeds[0]!.url).toBe('https://example.com/song.mp3');
			expect(embeds[0]!.audio).toBeDefined();
		});

		it('includes audio metadata in embed', async () => {
			const url = new URL('https://example.com/track.mp3');
			const content = createTestAudioContent();

			mediaService.setMetadata('base64', {
				format: 'mp3',
				content_type: 'audio/mpeg',
				width: undefined,
				height: undefined,
				duration: 180,
			});

			const embeds = await resolver.resolve(url, content);

			expect(embeds[0]!.audio).toBeDefined();
			expect(embeds[0]!.audio!.url).toBe('https://example.com/track.mp3');
		});

		it('handles NSFW content when allowed', async () => {
			const url = new URL('https://example.com/audio.mp3');
			const content = createTestAudioContent();

			mediaService.setMetadata('base64', {nsfw: true});

			const embeds = await resolver.resolve(url, content, true);

			expect(embeds).toHaveLength(1);
			expect(embeds[0]!.audio).toBeDefined();
		});

		it('handles NSFW content when not allowed', async () => {
			const url = new URL('https://example.com/audio.mp3');
			const content = createTestAudioContent();

			mediaService.setMetadata('base64', {nsfw: true});

			const embeds = await resolver.resolve(url, content, false);

			expect(embeds).toHaveLength(1);
		});

		it('handles URLs with query parameters', async () => {
			const url = new URL('https://example.com/song.mp3?token=abc123');
			const content = createTestAudioContent();

			const embeds = await resolver.resolve(url, content);

			expect(embeds[0]!.url).toBe('https://example.com/song.mp3?token=abc123');
		});

		it('handles URLs with fragments', async () => {
			const url = new URL('https://example.com/playlist.mp3#track2');
			const content = createTestAudioContent();

			const embeds = await resolver.resolve(url, content);

			expect(embeds[0]!.url).toBe('https://example.com/playlist.mp3#track2');
		});

		it('preserves URL encoding in result', async () => {
			const url = new URL('https://example.com/my%20song.mp3');
			const content = createTestAudioContent();

			const embeds = await resolver.resolve(url, content);

			expect(embeds[0]!.url).toContain('my%20song.mp3');
		});
	});
});
