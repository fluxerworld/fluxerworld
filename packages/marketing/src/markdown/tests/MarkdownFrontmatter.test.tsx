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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import {
	getContent,
	getInt,
	getIntOr,
	getString,
	getStringOr,
	parseFrontmatter,
} from '@fluxer/marketing/src/markdown/MarkdownFrontmatter';
import {describe, expect, it} from 'vitest';

describe('MarkdownFrontmatter', () => {
	describe('parseFrontmatter', () => {
		it('returns empty data for markdown without frontmatter', () => {
			const markdown = '# Hello World\n\nSome content';
			const result = parseFrontmatter(markdown);
			expect(result.data).toEqual({});
			expect(result.content).toBe(markdown);
		});

		it('parses frontmatter from markdown', () => {
			const markdown = '---\ntitle: My Title\nauthor: John Doe\n---\n\n# Content';
			const result = parseFrontmatter(markdown);
			expect(result.data).toEqual({
				title: 'My Title',
				author: 'John Doe',
			});
			expect(result.content).toBe('# Content');
		});

		it('handles frontmatter with no content after', () => {
			const markdown = '---\nkey: value\n---\n';
			const result = parseFrontmatter(markdown);
			expect(result.data).toEqual({key: 'value'});
			expect(result.content).toBe('');
		});

		it('handles values with colons', () => {
			const markdown = '---\nurl: https://example.com\n---\n\nContent';
			const result = parseFrontmatter(markdown);
			expect(result.data.url).toBe('https://example.com');
		});

		it('trims whitespace from keys and values', () => {
			const markdown = '---\n  key  :   value  \n---\n\nContent';
			const result = parseFrontmatter(markdown);
			expect(result.data).toEqual({key: 'value'});
		});

		it('ignores empty lines in frontmatter', () => {
			const markdown = '---\nkey1: value1\n\nkey2: value2\n---\n\nContent';
			const result = parseFrontmatter(markdown);
			expect(result.data).toEqual({
				key1: 'value1',
				key2: 'value2',
			});
		});

		it('ignores lines without separator', () => {
			const markdown = '---\nvalid: yes\ninvalid line\n---\n\nContent';
			const result = parseFrontmatter(markdown);
			expect(result.data).toEqual({valid: 'yes'});
		});

		it('ignores lines with empty key', () => {
			const markdown = '---\nvalid: yes\n: value with no key\n---\n\nContent';
			const result = parseFrontmatter(markdown);
			expect(result.data).toEqual({valid: 'yes'});
		});

		it('returns original content when frontmatter is not closed', () => {
			const markdown = '---\nkey: value\n# No closing delimiter';
			const result = parseFrontmatter(markdown);
			expect(result.data).toEqual({});
			expect(result.content).toBe(markdown);
		});
	});

	describe('getString', () => {
		it('returns value for existing key', () => {
			const frontmatter = parseFrontmatter('---\ntitle: Test\n---\n');
			expect(getString(frontmatter, 'title')).toBe('Test');
		});

		it('returns null for non-existent key', () => {
			const frontmatter = parseFrontmatter('---\ntitle: Test\n---\n');
			expect(getString(frontmatter, 'missing')).toBeNull();
		});
	});

	describe('getStringOr', () => {
		it('returns value for existing key', () => {
			const frontmatter = parseFrontmatter('---\ntitle: Test\n---\n');
			expect(getStringOr(frontmatter, 'title', 'Default')).toBe('Test');
		});

		it('returns fallback for non-existent key', () => {
			const frontmatter = parseFrontmatter('---\ntitle: Test\n---\n');
			expect(getStringOr(frontmatter, 'missing', 'Default')).toBe('Default');
		});
	});

	describe('getInt', () => {
		it('returns integer for valid numeric value', () => {
			const frontmatter = parseFrontmatter('---\ncount: 42\n---\n');
			expect(getInt(frontmatter, 'count')).toBe(42);
		});

		it('returns null for non-numeric value', () => {
			const frontmatter = parseFrontmatter('---\ncount: abc\n---\n');
			expect(getInt(frontmatter, 'count')).toBeNull();
		});

		it('returns null for non-existent key', () => {
			const frontmatter = parseFrontmatter('---\ntitle: Test\n---\n');
			expect(getInt(frontmatter, 'missing')).toBeNull();
		});
	});

	describe('getIntOr', () => {
		it('returns integer for valid numeric value', () => {
			const frontmatter = parseFrontmatter('---\ncount: 42\n---\n');
			expect(getIntOr(frontmatter, 'count', 0)).toBe(42);
		});

		it('returns fallback for non-numeric value', () => {
			const frontmatter = parseFrontmatter('---\ncount: abc\n---\n');
			expect(getIntOr(frontmatter, 'count', 100)).toBe(100);
		});

		it('returns fallback for non-existent key', () => {
			const frontmatter = parseFrontmatter('---\ntitle: Test\n---\n');
			expect(getIntOr(frontmatter, 'missing', 50)).toBe(50);
		});
	});

	describe('getContent', () => {
		it('returns content without frontmatter', () => {
			const frontmatter = parseFrontmatter('---\ntitle: Test\n---\n\n# Heading\n\nParagraph');
			expect(getContent(frontmatter)).toBe('# Heading\n\nParagraph');
		});

		it('returns full content when no frontmatter', () => {
			const frontmatter = parseFrontmatter('# Heading\n\nParagraph');
			expect(getContent(frontmatter)).toBe('# Heading\n\nParagraph');
		});
	});
});
