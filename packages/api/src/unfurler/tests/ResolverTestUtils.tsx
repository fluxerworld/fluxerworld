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

import crypto from 'node:crypto';
import {
	IMediaService,
	type MediaProxyFrameRequest,
	type MediaProxyFrameResponse,
	type MediaProxyMetadataRequest,
	type MediaProxyMetadataResponse,
} from '@fluxer/api/src/infrastructure/IMediaService';
import {formatLockKey, generateLockToken} from '@fluxer/cache/src/CacheLockValidation';
import {ICacheService} from '@fluxer/cache/src/ICacheService';

export class MockMediaService extends IMediaService {
	private nsfwUrls = new Set<string>();
	private animatedUrls = new Set<string>();
	private customMetadata = new Map<string, Partial<MediaProxyMetadataResponse>>();
	private failingUrls = new Set<string>();

	markAsNsfw(url: string): void {
		this.nsfwUrls.add(url);
	}

	markAsAnimated(url: string): void {
		this.animatedUrls.add(url);
	}

	setMetadata(url: string, metadata: Partial<MediaProxyMetadataResponse>): void {
		this.customMetadata.set(url, metadata);
	}

	markAsFailing(url: string): void {
		this.failingUrls.add(url);
	}

	reset(): void {
		this.nsfwUrls.clear();
		this.animatedUrls.clear();
		this.customMetadata.clear();
		this.failingUrls.clear();
	}

	async getMetadata(request: MediaProxyMetadataRequest): Promise<MediaProxyMetadataResponse | null> {
		const url = request.type === 'external' ? request.url : request.type === 'base64' ? 'base64' : 'unknown';

		if (this.failingUrls.has(url)) {
			throw new Error('Media service error');
		}

		const custom = this.customMetadata.get(url);

		return {
			format: custom?.format ?? 'png',
			content_type: custom?.content_type ?? 'image/png',
			content_hash: custom?.content_hash ?? crypto.createHash('md5').update(url).digest('hex'),
			size: custom?.size ?? 1024,
			width: custom?.width ?? 128,
			height: custom?.height ?? 128,
			animated: custom?.animated ?? this.animatedUrls.has(url),
			nsfw: custom?.nsfw ?? this.nsfwUrls.has(url),
			placeholder: custom?.placeholder,
			duration: custom?.duration,
		};
	}

	getExternalMediaProxyURL(url: string): string {
		return `https://media-proxy.test/${encodeURIComponent(url)}`;
	}

	async getThumbnail(): Promise<Buffer | null> {
		return Buffer.alloc(1024);
	}

	async extractFrames(_request: MediaProxyFrameRequest): Promise<MediaProxyFrameResponse> {
		return {
			frames: [
				{
					timestamp: 0,
					mime_type: 'image/png',
					base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
				},
			],
		};
	}
}

export class MockCacheService extends ICacheService {
	private cache = new Map<string, unknown>();
	private sets = new Map<string, Set<string>>();
	private locks = new Map<string, {token: string; expiresAt: number}>();

	reset(): void {
		this.cache.clear();
		this.sets.clear();
		this.locks.clear();
	}

	async get<T>(key: string): Promise<T | null> {
		return (this.cache.get(key) as T) ?? null;
	}

	async set<T>(key: string, value: T, _ttlSeconds?: number): Promise<void> {
		this.cache.set(key, value);
	}

	async delete(key: string): Promise<void> {
		this.cache.delete(key);
	}

	async getAndDelete<T>(key: string): Promise<T | null> {
		const value = await this.get<T>(key);
		if (value !== null) {
			this.cache.delete(key);
		}
		return value;
	}

	async exists(key: string): Promise<boolean> {
		return this.cache.has(key);
	}

	async expire(_key: string, _ttlSeconds: number): Promise<void> {
		return;
	}

	async ttl(_key: string): Promise<number> {
		return -1;
	}

	async mget<T>(keys: Array<string>): Promise<Array<T | null>> {
		const results: Array<T | null> = [];
		for (const key of keys) {
			results.push(await this.get<T>(key));
		}
		return results;
	}

	async mset<T>(entries: Array<{key: string; value: T; ttlSeconds?: number}>): Promise<void> {
		for (const entry of entries) {
			await this.set(entry.key, entry.value, entry.ttlSeconds);
		}
	}

	async deletePattern(pattern: string): Promise<number> {
		const regex = new RegExp(pattern.replace(/\*/g, '.*'));
		let deletedCount = 0;
		for (const key of this.cache.keys()) {
			if (regex.test(key)) {
				this.cache.delete(key);
				deletedCount++;
			}
		}
		return deletedCount;
	}

	async acquireLock(key: string, ttlSeconds: number): Promise<string | null> {
		const lockKey = formatLockKey(key);
		const existingLock = this.locks.get(lockKey);
		if (existingLock && existingLock.expiresAt > Date.now()) {
			return null;
		}
		const token = generateLockToken();
		this.locks.set(lockKey, {token, expiresAt: Date.now() + ttlSeconds * 1000});
		return token;
	}

	async releaseLock(key: string, token: string): Promise<boolean> {
		const lockKey = formatLockKey(key);
		const lock = this.locks.get(lockKey);
		if (!lock || lock.token !== token) {
			return false;
		}
		this.locks.delete(lockKey);
		return true;
	}

	async getAndRenewTtl<T>(key: string, _newTtlSeconds: number): Promise<T | null> {
		return await this.get<T>(key);
	}

	async publish(_channel: string, _message: string): Promise<void> {
		return;
	}

	async sadd(key: string, member: string, _ttlSeconds?: number): Promise<void> {
		let set = this.sets.get(key);
		if (!set) {
			set = new Set<string>();
			this.sets.set(key, set);
		}
		set.add(member);
	}

	async srem(key: string, member: string): Promise<void> {
		const set = this.sets.get(key);
		if (set) {
			set.delete(member);
			if (set.size === 0) {
				this.sets.delete(key);
			}
		}
	}

	async smembers(key: string): Promise<Set<string>> {
		return this.sets.get(key) ?? new Set<string>();
	}

	async sismember(key: string, member: string): Promise<boolean> {
		const set = this.sets.get(key);
		return set?.has(member) ?? false;
	}
}

export function createMockContent(html: string): Uint8Array {
	return new TextEncoder().encode(html);
}

export function createMinimalHtml(options: {
	title?: string;
	description?: string;
	image?: string;
	siteName?: string;
	themeColor?: string;
	video?: string;
	audio?: string;
}): string {
	const metaTags: Array<string> = [];

	if (options.title) {
		metaTags.push(`<meta property="og:title" content="${escapeHtml(options.title)}" />`);
	}
	if (options.description) {
		metaTags.push(`<meta property="og:description" content="${escapeHtml(options.description)}" />`);
	}
	if (options.image) {
		metaTags.push(`<meta property="og:image" content="${escapeHtml(options.image)}" />`);
	}
	if (options.siteName) {
		metaTags.push(`<meta property="og:site_name" content="${escapeHtml(options.siteName)}" />`);
	}
	if (options.themeColor) {
		metaTags.push(`<meta name="theme-color" content="${escapeHtml(options.themeColor)}" />`);
	}
	if (options.video) {
		metaTags.push(`<meta property="og:video" content="${escapeHtml(options.video)}" />`);
	}
	if (options.audio) {
		metaTags.push(`<meta property="og:audio" content="${escapeHtml(options.audio)}" />`);
	}

	return `<!DOCTYPE html>
<html>
<head>
${options.title ? `<title>${escapeHtml(options.title)}</title>` : ''}
${metaTags.join('\n')}
</head>
<body></body>
</html>`;
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

export const PNG_MAGIC_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const GIF_MAGIC_BYTES = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
export const JPEG_MAGIC_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

export function createTestImageContent(type: 'png' | 'gif' | 'jpeg'): Uint8Array {
	const header =
		type === 'png' ? PNG_MAGIC_BYTES : type === 'gif' ? GIF_MAGIC_BYTES : type === 'jpeg' ? JPEG_MAGIC_BYTES : [];
	const content = new Uint8Array(128);
	content.set(header);
	return content;
}

export function createTestAudioContent(): Uint8Array {
	return new Uint8Array(128);
}

export function createTestVideoContent(): Uint8Array {
	return new Uint8Array(128);
}
