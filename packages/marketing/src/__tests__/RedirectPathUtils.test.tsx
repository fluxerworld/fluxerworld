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

import {sanitizeInternalRedirectPath} from '@fluxer/marketing/src/RedirectPathUtils';
import {describe, expect, test} from 'vitest';

describe('sanitizeInternalRedirectPath', () => {
	test('allows same-site relative paths', () => {
		expect(sanitizeInternalRedirectPath('/partners')).toBe('/partners');
		expect(sanitizeInternalRedirectPath('/download?channel=canary')).toBe('/download?channel=canary');
		expect(sanitizeInternalRedirectPath('/docs#faq')).toBe('/docs#faq');
	});

	test('rejects absolute and protocol-relative external redirects', () => {
		expect(sanitizeInternalRedirectPath('https://evil.example/path')).toBe('/');
		expect(sanitizeInternalRedirectPath('//evil.example/path')).toBe('/');
		expect(sanitizeInternalRedirectPath('javascript:alert(1)')).toBe('/');
	});

	test('normalises blank and relative values to internal paths', () => {
		expect(sanitizeInternalRedirectPath('')).toBe('/');
		expect(sanitizeInternalRedirectPath('   ')).toBe('/');
		expect(sanitizeInternalRedirectPath('download')).toBe('/download');
	});
});
