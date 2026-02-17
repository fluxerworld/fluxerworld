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

import {AlertType, NodeType, TableAlignment} from '@fluxer/markdown_parser/src/types/Enums';
import type {
	AlertNode,
	BlockquoteNode,
	CodeBlockNode,
	HeadingNode,
	InlineCodeNode,
	LinkNode,
	ListNode,
	Node,
	SpoilerNode,
	SubtextNode,
	TableCellNode,
	TableNode,
	TableRowNode,
} from '@fluxer/markdown_parser/src/types/Nodes';
import {renderAstToHtml} from '@fluxer/marketing/src/markdown/AstHtmlRenderer';
import {describe, expect, it} from 'vitest';

describe('AstHtmlRenderer', () => {
	describe('renderAstToHtml', () => {
		it('renders empty node array', () => {
			const result = renderAstToHtml([]);
			expect(result).toBe('');
		});

		it('renders text node as paragraph', () => {
			const nodes: Array<Node> = [{type: NodeType.Text, content: 'Hello world'}];
			const result = renderAstToHtml(nodes);
			expect(result).toBe('<p>Hello world</p>');
		});

		it('escapes HTML in text nodes', () => {
			const nodes: Array<Node> = [{type: NodeType.Text, content: '<script>alert("xss")</script>'}];
			const result = renderAstToHtml(nodes);
			expect(result).toBe('<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>');
		});

		it('renders headings with slugs', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Heading,
					level: 1,
					children: [{type: NodeType.Text, content: 'Welcome'}],
				} as HeadingNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('<h1 id="welcome"');
			expect(result).toContain('data-anchor-link="welcome"');
			expect(result).toMatch(/<h1[^>]*>Welcome.*<\/h1>/);
		});

		it('renders headings with custom IDs', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Heading,
					level: 2,
					children: [{type: NodeType.Text, content: 'Section Title {#custom-id}'}],
				} as HeadingNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('id="custom-id"');
		});

		it('escapes custom heading IDs to prevent attribute injection', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Heading,
					level: 1,
					children: [{type: NodeType.Text, content: 'Title {#x" onmouseover="alert(1)}'}],
				} as HeadingNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('id="x&quot; onmouseover=&quot;alert(1)"');
			expect(result).toContain('data-anchor-link="x&quot; onmouseover=&quot;alert(1)"');
		});

		it('renders strong formatting', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Strong,
					children: [{type: NodeType.Text, content: 'bold text'}],
				},
			];
			const result = renderAstToHtml(nodes);
			expect(result).toBe('<p><strong>bold text</strong></p>');
		});

		it('renders emphasis formatting', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Emphasis,
					children: [{type: NodeType.Text, content: 'italic text'}],
				},
			];
			const result = renderAstToHtml(nodes);
			expect(result).toBe('<p><em>italic text</em></p>');
		});

		it('renders underline formatting', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Underline,
					children: [{type: NodeType.Text, content: 'underlined'}],
				},
			];
			const result = renderAstToHtml(nodes);
			expect(result).toBe('<p><u>underlined</u></p>');
		});

		it('renders strikethrough formatting', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Strikethrough,
					children: [{type: NodeType.Text, content: 'struck'}],
				},
			];
			const result = renderAstToHtml(nodes);
			expect(result).toBe('<p><s>struck</s></p>');
		});

		it('renders spoiler nodes', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Spoiler,
					children: [{type: NodeType.Text, content: 'hidden'}],
					isBlock: false,
				} as SpoilerNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toBe('<p><span class="spoiler">hidden</span></p>');
		});

		it('renders inline code as strong', () => {
			const nodes: Array<Node> = [{type: NodeType.InlineCode, content: 'const x = 1'} as InlineCodeNode];
			const result = renderAstToHtml(nodes);
			expect(result).toBe('<p><strong>const x = 1</strong></p>');
		});

		it('renders links with text', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Link,
					url: 'https://example.com',
					text: {type: NodeType.Text, content: 'Example'},
					escaped: false,
				} as LinkNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('href="https://example.com"');
			expect(result).toContain('>Example</a>');
		});

		it('renders links without text', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Link,
					url: 'https://example.com',
					escaped: false,
				} as LinkNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('href="https://example.com"');
			expect(result).toContain('>https://example.com</a>');
		});

		it('escapes HTML in link URLs to prevent attribute breakout', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Link,
					url: '" onclick="alert(1)',
					text: {type: NodeType.Text, content: 'Click'},
					escaped: false,
				} as LinkNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('&quot;');
			expect(result).toBe(
				'<p><a class="text-[#4641D9] hover:underline" href="&quot; onclick=&quot;alert(1)">Click</a></p>',
			);
		});

		it('renders blockquotes', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Blockquote,
					children: [{type: NodeType.Text, content: 'quoted text'}],
				} as BlockquoteNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toBe('<blockquote>quoted text</blockquote>');
		});

		it('renders unordered lists', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.List,
					ordered: false,
					items: [
						{children: [{type: NodeType.Text, content: 'item 1'}]},
						{children: [{type: NodeType.Text, content: 'item 2'}]},
					],
				} as ListNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('<ul>');
			expect(result).toContain('<li>item 1</li>');
			expect(result).toContain('<li>item 2</li>');
			expect(result).toContain('</ul>');
		});

		it('renders ordered lists', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.List,
					ordered: true,
					items: [{children: [{type: NodeType.Text, content: 'first'}]}],
				} as ListNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('<ol>');
			expect(result).toContain('<li>first</li>');
			expect(result).toContain('</ol>');
		});

		it('renders code blocks', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.CodeBlock,
					content: 'function hello() {}',
					language: 'javascript',
				} as CodeBlockNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('<pre><code class="language-javascript">');
			expect(result).toContain('function hello() {}');
			expect(result).toContain('</code></pre>');
		});

		it('renders code blocks without language', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.CodeBlock,
					content: 'plain code',
				} as CodeBlockNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toBe('<pre><code>plain code</code></pre>');
		});

		it('renders subtext', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Subtext,
					children: [{type: NodeType.Text, content: 'small text'}],
				} as SubtextNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toBe('<small>small text</small>');
		});

		it('renders tables', () => {
			const headerRow: TableRowNode = {
				type: NodeType.TableRow,
				cells: [
					{type: NodeType.TableCell, children: [{type: NodeType.Text, content: 'Header 1'}]} as TableCellNode,
					{type: NodeType.TableCell, children: [{type: NodeType.Text, content: 'Header 2'}]} as TableCellNode,
				],
			};
			const dataRow: TableRowNode = {
				type: NodeType.TableRow,
				cells: [
					{type: NodeType.TableCell, children: [{type: NodeType.Text, content: 'Cell 1'}]} as TableCellNode,
					{type: NodeType.TableCell, children: [{type: NodeType.Text, content: 'Cell 2'}]} as TableCellNode,
				],
			};
			const nodes: Array<Node> = [
				{
					type: NodeType.Table,
					header: headerRow,
					alignments: [TableAlignment.Left, TableAlignment.Right],
					rows: [dataRow],
				} as TableNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('<table');
			expect(result).toContain('<thead>');
			expect(result).toContain('<th');
			expect(result).toContain('Header 1');
			expect(result).toContain('<tbody>');
			expect(result).toContain('<td');
			expect(result).toContain('Cell 1');
		});

		it('renders alerts', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Alert,
					alertType: AlertType.Warning,
					children: [{type: NodeType.Text, content: 'Warning message'}],
				} as AlertNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('class="alert alert-warning"');
			expect(result).toContain('Warning message');
		});

		it('auto-links emails in paragraphs', () => {
			const nodes: Array<Node> = [{type: NodeType.Text, content: 'Contact us at support@example.com'}];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('href="mailto:support@example.com"');
			expect(result).toContain('>support@example.com</a>');
		});

		it('converts newlines to br in text', () => {
			const nodes: Array<Node> = [{type: NodeType.Text, content: 'line one\nline two'}];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('line one<br>line two');
		});

		it('handles mixed inline and block content', () => {
			const nodes: Array<Node> = [
				{type: NodeType.Text, content: 'Intro text'},
				{
					type: NodeType.Heading,
					level: 2,
					children: [{type: NodeType.Text, content: 'Section'}],
				} as HeadingNode,
				{type: NodeType.Text, content: 'More text'},
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('<p>Intro text</p>');
			expect(result).toContain('<h2');
			expect(result).toContain('<p>More text</p>');
		});

		it('renders sequence nodes by joining children', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Sequence,
					children: [
						{type: NodeType.Text, content: 'part1 '},
						{type: NodeType.Text, content: 'part2'},
					],
				},
			];
			const result = renderAstToHtml(nodes);
			expect(result).toBe('<p>part1 part2</p>');
		});

		it('renders heading with nested formatted children for slug extraction', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Heading,
					level: 2,
					children: [
						{
							type: NodeType.Strong,
							children: [{type: NodeType.Text, content: 'Bold Title'}],
						},
					],
				} as HeadingNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('id="bold-title"');
			expect(result).toContain('<strong>Bold Title</strong>');
		});

		it('renders heading with inline code child for slug extraction', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Heading,
					level: 3,
					children: [{type: NodeType.InlineCode, content: 'codeRef'} as InlineCodeNode],
				} as HeadingNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('id="coderef"');
			expect(result).toContain('<strong>codeRef</strong>');
		});

		it('handles malformed HTML tags without closing bracket in autolink', () => {
			const nodes: Array<Node> = [{type: NodeType.Text, content: 'text <unclosed tag'}];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('&lt;unclosed tag');
		});

		it('renders table with center alignment', () => {
			const headerRow: TableRowNode = {
				type: NodeType.TableRow,
				cells: [{type: NodeType.TableCell, children: [{type: NodeType.Text, content: 'Center'}]} as TableCellNode],
			};
			const nodes: Array<Node> = [
				{
					type: NodeType.Table,
					header: headerRow,
					alignments: [TableAlignment.Center],
					rows: [],
				} as TableNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('text-center');
		});

		it('renders table without alignments', () => {
			const headerRow: TableRowNode = {
				type: NodeType.TableRow,
				cells: [{type: NodeType.TableCell, children: [{type: NodeType.Text, content: 'No Align'}]} as TableCellNode],
			};
			const nodes: Array<Node> = [
				{
					type: NodeType.Table,
					header: headerRow,
					alignments: [],
					rows: [],
				} as TableNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('No Align');
		});

		it('renders all alert types', () => {
			const alertTypes = [AlertType.Note, AlertType.Tip, AlertType.Important, AlertType.Warning, AlertType.Caution];
			for (const alertType of alertTypes) {
				const nodes: Array<Node> = [
					{
						type: NodeType.Alert,
						alertType,
						children: [{type: NodeType.Text, content: 'Message'}],
					} as AlertNode,
				];
				const result = renderAstToHtml(nodes);
				expect(result).toContain('class="alert');
			}
		});

		it('renders nested list inside list item', () => {
			const nestedList: ListNode = {
				type: NodeType.List,
				ordered: false,
				items: [{children: [{type: NodeType.Text, content: 'nested item'}]}],
			};
			const nodes: Array<Node> = [
				{
					type: NodeType.List,
					ordered: false,
					items: [{children: [{type: NodeType.Text, content: 'parent'}, nestedList]}],
				} as ListNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('<ul>');
			expect(result).toContain('nested item');
		});

		it('trims whitespace-only text nodes from paragraph', () => {
			const nodes: Array<Node> = [
				{type: NodeType.Text, content: '   '},
				{type: NodeType.Text, content: 'actual content'},
				{type: NodeType.Text, content: '   '},
			];
			const result = renderAstToHtml(nodes);
			expect(result).toBe('<p>actual content</p>');
		});

		it('renders heading with empty text as section slug', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Heading,
					level: 1,
					children: [{type: NodeType.Text, content: '   '}],
				} as HeadingNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('id="section"');
		});

		it('handles unknown inline node types gracefully', () => {
			const nodes: Array<Node> = [{type: 'UnknownType' as NodeType, content: 'unknown'} as unknown as Node];
			const result = renderAstToHtml(nodes);
			expect(result).toBe('');
		});

		it('handles unknown block node types gracefully', () => {
			const nodes: Array<Node> = [
				{type: NodeType.Text, content: 'before'},
				{type: 'UnknownBlock' as NodeType} as unknown as Node,
				{type: NodeType.Text, content: 'after'},
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('<p>before</p>');
			expect(result).toContain('<p>after</p>');
		});

		it('handles unknown node types in heading for slug generation', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Heading,
					level: 2,
					children: [{type: 'UnknownInline' as NodeType} as unknown as Node],
				} as HeadingNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('id="section"');
		});

		it('handles unknown alert type with default class', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Alert,
					alertType: 'UnknownAlertType' as AlertType,
					children: [{type: NodeType.Text, content: 'Unknown alert'}],
				} as AlertNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('alert-note');
		});

		it('returns empty for paragraph with only whitespace text nodes', () => {
			const nodes: Array<Node> = [{type: NodeType.Text, content: '   \n   \n   '}];
			const result = renderAstToHtml(nodes);
			expect(result).toBe('');
		});

		it('handles heading with formatting that has unknown nested type', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Heading,
					level: 2,
					children: [
						{
							type: NodeType.Strong,
							children: [
								{
									type: NodeType.Emphasis,
									children: [{type: NodeType.Text, content: 'nested'}],
								},
							],
						},
					],
				} as HeadingNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('<strong><em>nested</em></strong>');
		});

		it('handles heading with trailing special chars for slug trimming', () => {
			const nodes: Array<Node> = [
				{
					type: NodeType.Heading,
					level: 2,
					children: [{type: NodeType.Text, content: 'Title!!!'}],
				} as HeadingNode,
			];
			const result = renderAstToHtml(nodes);
			expect(result).toContain('id="title"');
		});
	});
});
