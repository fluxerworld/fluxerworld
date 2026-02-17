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

import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {
	AttachmentURLType,
	setIsDevelopment,
	URLType,
	URLWithFragmentType,
} from '@fluxer/schema/src/primitives/UrlValidators';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('URLType', () => {
	it('accepts valid HTTPS URLs', () => {
		const result = URLType.safeParse('https://example.com');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('https://example.com');
		}
	});

	it('accepts valid HTTP URLs', () => {
		const result = URLType.safeParse('http://example.com');
		expect(result.success).toBe(true);
	});

	it('accepts URLs with paths', () => {
		const result = URLType.safeParse('https://example.com/path/to/resource');
		expect(result.success).toBe(true);
	});

	it('accepts URLs with query parameters', () => {
		const result = URLType.safeParse('https://example.com/page?param=value');
		expect(result.success).toBe(true);
	});

	it('accepts URLs with subdomains', () => {
		const result = URLType.safeParse('https://sub.domain.example.com');
		expect(result.success).toBe(true);
	});

	it('accepts URLs with ports', () => {
		const result = URLType.safeParse('https://example.com:8080');
		expect(result.success).toBe(true);
	});

	it('rejects URLs without protocol', () => {
		const result = URLType.safeParse('example.com');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_URL_FORMAT);
		}
	});

	it('rejects URLs with fragments', () => {
		const result = URLType.safeParse('https://example.com#section');
		expect(result.success).toBe(false);
	});

	it('rejects FTP URLs', () => {
		const result = URLType.safeParse('ftp://example.com');
		expect(result.success).toBe(false);
	});

	it('rejects file URLs', () => {
		const result = URLType.safeParse('file:///path/to/file');
		expect(result.success).toBe(false);
	});

	it('rejects URLs exceeding max length', () => {
		const longPath = 'a'.repeat(2040);
		const result = URLType.safeParse(`https://example.com/${longPath}`);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(ValidationErrorCodes.URL_LENGTH_INVALID);
		}
	});

	it('rejects empty strings', () => {
		const result = URLType.safeParse('');
		expect(result.success).toBe(false);
	});

	it('trims whitespace', () => {
		const result = URLType.safeParse('  https://example.com  ');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('https://example.com');
		}
	});
});

describe('URLWithFragmentType', () => {
	it('accepts URLs with fragments', () => {
		const result = URLWithFragmentType.safeParse('https://example.com#section');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('https://example.com#section');
		}
	});

	it('accepts URLs without fragments', () => {
		const result = URLWithFragmentType.safeParse('https://example.com');
		expect(result.success).toBe(true);
	});

	it('accepts complex fragments', () => {
		const result = URLWithFragmentType.safeParse('https://example.com/page#section-1.2');
		expect(result.success).toBe(true);
	});
});

describe('AttachmentURLType', () => {
	it('accepts valid HTTPS URLs', () => {
		const result = AttachmentURLType.safeParse('https://example.com/image.png');
		expect(result.success).toBe(true);
	});

	it('accepts valid attachment:// URLs', () => {
		const result = AttachmentURLType.safeParse('attachment://image.png');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('attachment://image.png');
		}
	});

	it('accepts attachment URLs with unicode filenames', () => {
		const result = AttachmentURLType.safeParse('attachment://archivo.png');
		expect(result.success).toBe(true);
	});

	it('accepts attachment URLs with numbers', () => {
		const result = AttachmentURLType.safeParse('attachment://file123.txt');
		expect(result.success).toBe(true);
	});

	it('accepts attachment URLs with underscores and hyphens', () => {
		const result = AttachmentURLType.safeParse('attachment://my_file-name.txt');
		expect(result.success).toBe(true);
	});

	it('rejects attachment URLs with empty filename', () => {
		const result = AttachmentURLType.safeParse('attachment://');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_URL_OR_ATTACHMENT_FORMAT);
		}
	});

	it('rejects attachment URLs with invalid filename characters', () => {
		const result = AttachmentURLType.safeParse('attachment://file name.txt');
		expect(result.success).toBe(false);
	});

	it('rejects attachment URLs with path separators', () => {
		const result = AttachmentURLType.safeParse('attachment://path/file.txt');
		expect(result.success).toBe(false);
	});

	it('rejects URLs without valid protocol', () => {
		const result = AttachmentURLType.safeParse('ftp://example.com/file.txt');
		expect(result.success).toBe(false);
	});

	it('rejects URLs exceeding max length', () => {
		const longFilename = 'a'.repeat(2040);
		const result = AttachmentURLType.safeParse(`https://example.com/${longFilename}`);
		expect(result.success).toBe(false);
	});

	it('trims and normalizes input', () => {
		const result = AttachmentURLType.safeParse('  attachment://file.txt  ');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('attachment://file.txt');
		}
	});
});

describe('URL validators in development mode', () => {
	beforeEach(() => {
		setIsDevelopment(true);
	});

	afterEach(() => {
		setIsDevelopment(false);
	});

	it('accepts localhost URLs in development mode', () => {
		const result = URLType.safeParse('http://localhost:3000');
		expect(result.success).toBe(true);
	});

	it('accepts URLs without TLD in development mode', () => {
		const result = URLType.safeParse('http://myservice:8080');
		expect(result.success).toBe(true);
	});

	it('accepts attachment URLs to local services', () => {
		const result = AttachmentURLType.safeParse('http://localhost:3000/image.png');
		expect(result.success).toBe(true);
	});
});

describe('URL validators in production mode', () => {
	beforeEach(() => {
		setIsDevelopment(false);
	});

	it('rejects localhost URLs in production mode', () => {
		const result = URLType.safeParse('http://localhost:3000');
		expect(result.success).toBe(false);
	});

	it('rejects URLs without TLD in production mode', () => {
		const result = URLType.safeParse('http://myservice:8080');
		expect(result.success).toBe(false);
	});
});
