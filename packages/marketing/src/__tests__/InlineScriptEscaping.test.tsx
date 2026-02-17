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

import {escapeInlineScriptValue} from '@fluxer/marketing/src/pages/InlineScriptEscaping';
import {describe, expect, it} from 'vitest';

describe('escapeInlineScriptValue', () => {
	it('escapes backslash for safe embedding in single-quoted JS strings', () => {
		expect(escapeInlineScriptValue('path\\to\\file')).toBe('path\\\\to\\\\file');
		expect(escapeInlineScriptValue('\\\\')).toBe('\\\\\\\\');
	});

	it('escapes newline for safe embedding in single-quoted JS strings', () => {
		expect(escapeInlineScriptValue('line1\nline2')).toBe('line1\\nline2');
		expect(escapeInlineScriptValue('\n')).toBe('\\n');
	});

	it('escapes carriage return for safe embedding in single-quoted JS strings', () => {
		expect(escapeInlineScriptValue('a\rb')).toBe('a\\rb');
		expect(escapeInlineScriptValue('\r\n')).toBe('\\r\\n');
	});

	it('escapes single quote to prevent string breakout', () => {
		expect(escapeInlineScriptValue("don't")).toBe("don\\'t");
		expect(escapeInlineScriptValue("it's")).toBe("it\\'s");
		expect(escapeInlineScriptValue("'")).toBe("\\'");
	});

	it('escapes combined XSS-payload characters that could break out of JS strings', () => {
		const payload = "'; alert('xss'); //";
		expect(escapeInlineScriptValue(payload)).toBe("\\'; alert(\\'xss\\'); //");
	});

	it('returns plain text unchanged when no special characters', () => {
		expect(escapeInlineScriptValue('Hello world')).toBe('Hello world');
		expect(escapeInlineScriptValue('Error: invalid amount')).toBe('Error: invalid amount');
	});
});
