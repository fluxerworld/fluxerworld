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

import {hmacSha256, md5, md5Base64, randomHex, randomUUID, sha256} from '@fluxer/s3/src/utils/Crypto';
import {describe, expect, it} from 'vitest';

describe('Crypto', () => {
	describe('hmacSha256', () => {
		it('should generate HMAC-SHA256 with string key', () => {
			const result = hmacSha256('secret', 'message');
			expect(result).toBeInstanceOf(Buffer);
			expect(result.toString('hex')).toHaveLength(64);
		});

		it('should generate HMAC-SHA256 with buffer key', () => {
			const result = hmacSha256(Buffer.from('secret'), 'message');
			expect(result).toBeInstanceOf(Buffer);
		});

		it('should be deterministic', () => {
			const result1 = hmacSha256('key', 'data');
			const result2 = hmacSha256('key', 'data');
			expect(result1.equals(result2)).toBe(true);
		});
	});

	describe('sha256', () => {
		it('should generate SHA256 hash from string', () => {
			const result = sha256('hello');
			expect(result).toHaveLength(64);
			expect(result).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
		});

		it('should generate SHA256 hash from buffer', () => {
			const result = sha256(Buffer.from('hello'));
			expect(result).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
		});
	});

	describe('md5', () => {
		it('should generate MD5 hash from string', () => {
			const result = md5('hello');
			expect(result).toHaveLength(32);
			expect(result).toBe('5d41402abc4b2a76b9719d911017c592');
		});

		it('should generate MD5 hash from buffer', () => {
			const result = md5(Buffer.from('hello'));
			expect(result).toBe('5d41402abc4b2a76b9719d911017c592');
		});
	});

	describe('md5Base64', () => {
		it('should generate MD5 hash in base64 from string', () => {
			const result = md5Base64('hello');
			expect(result).toBe('XUFAKrxLKna5cZ2REBfFkg==');
		});

		it('should generate MD5 hash in base64 from buffer', () => {
			const result = md5Base64(Buffer.from('hello'));
			expect(result).toBe('XUFAKrxLKna5cZ2REBfFkg==');
		});
	});

	describe('randomHex', () => {
		it('should generate hex string of correct length', () => {
			const result = randomHex(16);
			expect(result).toHaveLength(32);
			expect(result).toMatch(/^[0-9a-f]+$/);
		});

		it('should generate different values', () => {
			const result1 = randomHex(16);
			const result2 = randomHex(16);
			expect(result1).not.toBe(result2);
		});
	});

	describe('randomUUID', () => {
		it('should generate valid UUID', () => {
			const result = randomUUID();
			expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
		});

		it('should generate unique UUIDs', () => {
			const result1 = randomUUID();
			const result2 = randomUUID();
			expect(result1).not.toBe(result2);
		});
	});
});
