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

import {Parser} from '@fluxer/markdown_parser/src/parser/Parser';
import {NodeType, ParserFlags} from '@fluxer/markdown_parser/src/types/Enums';
import {describe, expect, test} from 'vitest';

describe('Fluxer Markdown Parser', () => {
	test('empty input', () => {
		const input = '';
		const flags = 0;
		const parser = new Parser(input, flags);
		const {nodes: ast} = parser.parse();
		expect(ast).toHaveLength(0);
	});

	test('multiple consecutive newlines', () => {
		const input = 'First paragraph.\n\n\n\nSecond paragraph.';
		const flags = 0;
		const parser = new Parser(input, flags);
		const {nodes: ast} = parser.parse();

		expect(ast).toEqual([
			{type: NodeType.Text, content: 'First paragraph.\n'},
			{type: NodeType.Text, content: '\n\n\n'},
			{type: NodeType.Text, content: 'Second paragraph.'},
		]);
	});

	test('multiple newlines between blocks', () => {
		const input = '# Heading\n\n\n\nParagraph.';
		const flags = ParserFlags.ALLOW_HEADINGS;
		const parser = new Parser(input, flags);
		const {nodes: ast} = parser.parse();

		expect(ast).toEqual([
			{
				type: NodeType.Heading,
				level: 1,
				children: [{type: NodeType.Text, content: 'Heading'}],
			},
			{type: NodeType.Text, content: 'Paragraph.'},
		]);
	});

	test('preserve consecutive newlines between paragraphs', () => {
		const input = 'First paragraph\n\n\n\nSecond paragraph';
		const flags = 0;
		const parser = new Parser(input, flags);
		const {nodes: ast} = parser.parse();

		expect(ast).toEqual([
			{type: NodeType.Text, content: 'First paragraph\n'},
			{type: NodeType.Text, content: '\n\n\n'},
			{type: NodeType.Text, content: 'Second paragraph'},
		]);
	});

	test('flags disabling spoilers', () => {
		const input = 'This is a ||secret|| message';
		const flags = 0;
		const parser = new Parser(input, flags);
		const {nodes: ast} = parser.parse();

		expect(ast).toEqual([{type: NodeType.Text, content: 'This is a ||secret|| message'}]);
	});

	test('flags disabling headings', () => {
		const input = '# Heading 1';
		const flags = 0;
		const parser = new Parser(input, flags);
		const {nodes: ast} = parser.parse();

		expect(ast).toEqual([{type: NodeType.Text, content: '# Heading 1'}]);
	});

	test('flags disabling code blocks', () => {
		const input = '```rust\nfn main() {}\n```';
		const flags = 0;
		const parser = new Parser(input, flags);
		const {nodes: ast} = parser.parse();

		expect(ast).toEqual([{type: NodeType.Text, content: '```rust\nfn main() {}\n```'}]);
	});

	test('flags disabling custom links', () => {
		const input = '[Rust](https://www.rust-lang.org)';
		const flags = 0;
		const parser = new Parser(input, flags);
		const {nodes: ast} = parser.parse();

		expect(ast).toEqual([{type: NodeType.Text, content: '[Rust](https://www.rust-lang.org)'}]);
	});

	test('flags partial', () => {
		const input = '# Heading\nThis is a ||secret|| message with a [link](https://example.com).';
		const flags = ParserFlags.ALLOW_HEADINGS | ParserFlags.ALLOW_SPOILERS;
		const parser = new Parser(input, flags);
		const {nodes: ast} = parser.parse();

		expect(ast).toEqual([
			{
				type: NodeType.Heading,
				level: 1,
				children: [{type: NodeType.Text, content: 'Heading'}],
			},
			{type: NodeType.Text, content: 'This is a '},
			{type: NodeType.Spoiler, isBlock: false, children: [{type: NodeType.Text, content: 'secret'}]},
			{type: NodeType.Text, content: ' message with a [link](https://example.com).'},
		]);
	});

	test('flags all enabled', () => {
		const input = '# Heading\n||Spoiler|| with a [link](https://example.com).';
		const flags = ParserFlags.ALLOW_HEADINGS | ParserFlags.ALLOW_SPOILERS | ParserFlags.ALLOW_MASKED_LINKS;
		const parser = new Parser(input, flags);
		const {nodes: ast} = parser.parse();

		expect(ast).toEqual([
			{
				type: NodeType.Heading,
				level: 1,
				children: [{type: NodeType.Text, content: 'Heading'}],
			},
			{type: NodeType.Spoiler, isBlock: false, children: [{type: NodeType.Text, content: 'Spoiler'}]},
			{type: NodeType.Text, content: ' with a '},
			{
				type: NodeType.Link,
				text: {type: NodeType.Text, content: 'link'},
				url: 'https://example.com/',
				escaped: false,
			},
			{type: NodeType.Text, content: '.'},
		]);
	});

	test('escaped hyphen prevents list parsing without rendering the backslash', () => {
		const input = 'test\n\\- test';
		const flags = ParserFlags.ALLOW_LISTS;
		const parser = new Parser(input, flags);
		const {nodes: ast} = parser.parse();

		expect(ast).toEqual([{type: NodeType.Text, content: 'test\n- test'}]);
	});

	test('hash-prefixed non-heading lines still parse autolinks', () => {
		const input = '#f https://example.com';
		const flags = ParserFlags.ALLOW_HEADINGS | ParserFlags.ALLOW_AUTOLINKS;
		const parser = new Parser(input, flags);
		const {nodes: ast} = parser.parse();

		expect(ast).toEqual([
			{type: NodeType.Text, content: '#f '},
			{type: NodeType.Link, text: undefined, url: 'https://example.com/', escaped: false},
		]);
	});

	test('hash-prefixed non-heading lines preserve newlines in paragraphs', () => {
		const input = 'Hello\n#f https://example.com';
		const flags = ParserFlags.ALLOW_HEADINGS | ParserFlags.ALLOW_AUTOLINKS;
		const parser = new Parser(input, flags);
		const {nodes: ast} = parser.parse();

		expect(ast).toEqual([
			{type: NodeType.Text, content: 'Hello\n'},
			{type: NodeType.Text, content: '#f '},
			{type: NodeType.Link, text: undefined, url: 'https://example.com/', escaped: false},
		]);
	});
});
