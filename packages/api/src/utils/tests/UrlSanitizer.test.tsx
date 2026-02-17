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

import {sanitizeOptionalAbsoluteUrl, sanitizeOptionalAbsoluteUrlOrNull} from '@fluxer/api/src/utils/UrlSanitizer';
import {describe, expect, it} from 'vitest';

describe('sanitizeOptionalAbsoluteUrl', () => {
	it('returns undefined for nullish values', () => {
		expect(sanitizeOptionalAbsoluteUrl(undefined)).toBeUndefined();
		expect(sanitizeOptionalAbsoluteUrl(null)).toBeUndefined();
	});

	it('returns undefined for empty or whitespace-only values', () => {
		expect(sanitizeOptionalAbsoluteUrl('')).toBeUndefined();
		expect(sanitizeOptionalAbsoluteUrl('   ')).toBeUndefined();
	});

	it('returns undefined for invalid URLs', () => {
		expect(sanitizeOptionalAbsoluteUrl('not-a-valid-url')).toBeUndefined();
	});

	it('trims and normalises valid absolute URLs', () => {
		expect(sanitizeOptionalAbsoluteUrl(' https://example.com/path ')).toBe('https://example.com/path');
		expect(sanitizeOptionalAbsoluteUrl('https://example.com')).toBe('https://example.com/');
	});
});

describe('sanitizeOptionalAbsoluteUrlOrNull', () => {
	it('returns null for invalid inputs', () => {
		expect(sanitizeOptionalAbsoluteUrlOrNull(undefined)).toBeNull();
		expect(sanitizeOptionalAbsoluteUrlOrNull(null)).toBeNull();
		expect(sanitizeOptionalAbsoluteUrlOrNull('not-a-valid-url')).toBeNull();
	});

	it('returns normalised URLs for valid inputs', () => {
		expect(sanitizeOptionalAbsoluteUrlOrNull(' https://example.com/path ')).toBe('https://example.com/path');
	});
});
