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

import {renderMarkdownWithBase} from '@fluxer/marketing/src/markdown/MarkdownRenderer';
import {describe, expect, it} from 'vitest';

describe('MarkdownRenderer', () => {
	const baseUrl = 'https://example.com';
	const appEndpoint = 'https://app.example.com';

	describe('renderMarkdownWithBase', () => {
		it('renders plain text as paragraph', () => {
			const markdown = 'Hello world';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('<p>Hello world</p>');
		});

		it('renders headings', () => {
			const markdown = '# Title\n\nParagraph text';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('<h1');
			expect(result).toContain('Title');
		});

		it('renders bold text', () => {
			const markdown = 'This is **bold** text';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('<strong>bold</strong>');
		});

		it('renders italic text', () => {
			const markdown = 'This is *italic* text';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('<em>italic</em>');
		});

		it('renders links', () => {
			const markdown = 'Check out [this link](https://example.org/)';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('href="https://example.org/"');
			expect(result).toContain('>this link</a>');
		});

		it('resolves relative links with base URL', () => {
			const markdown = 'See [our policy](/privacy)';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('href="https://example.com/privacy"');
		});

		it('renders unordered lists', () => {
			const markdown = '- Item one\n- Item two\n- Item three';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('<ul>');
			expect(result).toContain('<li>Item one</li>');
			expect(result).toContain('<li>Item two</li>');
			expect(result).toContain('<li>Item three</li>');
			expect(result).toContain('</ul>');
		});

		it('renders ordered lists', () => {
			const markdown = '1. First\n2. Second\n3. Third';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('<ol>');
			expect(result).toContain('<li>First</li>');
			expect(result).toContain('</ol>');
		});

		it('renders code blocks', () => {
			const markdown = '```javascript\nconst x = 1;\n```';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('<pre><code class="language-javascript">');
			expect(result).toContain('const x = 1;');
		});

		it('renders blockquotes', () => {
			const markdown = '> This is a quote';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('<blockquote>');
			expect(result).toContain('This is a quote');
		});

		it('removes HTML comments', () => {
			const markdown = 'Text before\n<!-- comment -->\nText after';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).not.toContain('comment');
			expect(result).toContain('Text before');
			expect(result).toContain('Text after');
		});

		it('converts horizontal rules on their own line', () => {
			const markdown = '# Heading\n\n---\n\n# Another Heading';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('<hr class="my-8">');
		});

		it('expands app shortcuts', () => {
			const markdown = 'Go to <% app settings %>';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('href="https://app.example.com/settings"');
			expect(result).toContain('app.example.com/settings');
		});

		it('replaces app variables', () => {
			const markdown = 'Protocol: %app.proto% Host: %app.host%';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('https');
			expect(result).toContain('app.example.com');
		});

		it('handles setext-style headings', () => {
			const markdown = 'Title\n=====\n\nText';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('<h1');
			expect(result).toContain('Title');
		});

		it('handles h2 setext-style headings', () => {
			const markdown = 'Subtitle\n--------\n\nText';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('<h2');
			expect(result).toContain('Subtitle');
		});

		it('handles h5 headings', () => {
			const markdown = '##### Deep heading';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('<h5');
			expect(result).toContain('Deep heading');
		});

		it('handles h6 headings', () => {
			const markdown = '###### Deepest heading';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('<h6');
			expect(result).toContain('Deepest heading');
		});

		it('renders tables', () => {
			const markdown = '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('<table');
			expect(result).toContain('Header 1');
			expect(result).toContain('Cell 1');
		});

		it('renders content with headings creating separate blocks', () => {
			const markdown = '# Title\n\nIntro text.\n\n# Another Section\n\nMore text.';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('<h1');
			expect(result).toContain('Intro text');
			expect(result).toContain('Another Section');
			expect(result).toContain('More text');
		});

		it('escapes HTML in content', () => {
			const markdown = 'Text with <script>alert("xss")</script>';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).not.toContain('<script>');
			expect(result).toContain('&lt;script&gt;');
		});

		it('auto-links emails', () => {
			const markdown = 'Contact us at support@fluxer.com';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('href="mailto:support@fluxer.com"');
		});

		it('handles empty markdown', () => {
			const markdown = '';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toBe('');
		});

		it('handles whitespace-only markdown', () => {
			const markdown = '   \n   \n   ';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toBe('');
		});

		it('handles app endpoint without protocol separator', () => {
			const markdown = 'Go to <% app settings %>';
			const result = renderMarkdownWithBase(markdown, baseUrl, 'app.example.com');
			expect(result).toContain('app.example.com/settings');
		});

		it('handles app variables with malformed endpoint', () => {
			const markdown = 'Protocol: %app.proto% Host: %app.host%';
			const result = renderMarkdownWithBase(markdown, baseUrl, 'no-protocol-here');
			expect(result).toContain('https');
			expect(result).toContain('no-protocol-here');
		});

		it('handles slug generation with leading/trailing special chars', () => {
			const markdown = '##### ---Special Title---';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('id="special-title"');
		});

		it('handles slug generation with only special chars', () => {
			const markdown = '##### ---';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).toContain('id="section"');
		});

		it('handles base URL with trailing slash', () => {
			const markdown = 'See [link](/path)';
			const result = renderMarkdownWithBase(markdown, 'https://example.com/', appEndpoint);
			expect(result).toContain('href="https://example.com/path"');
		});

		it('removes inline HTML comments', () => {
			const markdown = 'Start <!-- inline comment --> End';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).not.toContain('inline comment');
			expect(result).toContain('Start');
			expect(result).toContain('End');
		});

		it('removes multiline HTML comments', () => {
			const markdown = 'Before\n<!--\nmulti\nline\n-->\nAfter';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).not.toContain('multi');
			expect(result).toContain('Before');
			expect(result).toContain('After');
		});
	});

	describe('section references', () => {
		it('does not render section references without the flag', () => {
			const markdown = 'See [Section 16](#16-contact-us) for details';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint);
			expect(result).not.toContain('href="#16-contact-us"');
			expect(result).toContain('[Section 16](#16-contact-us)');
		});

		it('renders section references as anchor links when flag is enabled', () => {
			const markdown = 'See [Section 16](#16-contact-us) for details';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint, {allowSectionReferences: true});
			expect(result).toContain('href="#16-contact-us"');
			expect(result).toContain('>Section 16</a>');
		});

		it('renders multiple section references', () => {
			const markdown = 'See [Section 1](#intro) and [Section 2](#conclusion)';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint, {allowSectionReferences: true});
			expect(result).toContain('href="#intro"');
			expect(result).toContain('>Section 1</a>');
			expect(result).toContain('href="#conclusion"');
			expect(result).toContain('>Section 2</a>');
		});

		it('applies correct styling to section reference links', () => {
			const markdown = '[Click here](#target)';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint, {allowSectionReferences: true});
			expect(result).toContain('class="text-[#4641D9] hover:underline"');
		});

		it('escapes HTML in section reference text', () => {
			const markdown = '[<script>alert("xss")</script>](#target)';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint, {allowSectionReferences: true});
			expect(result).not.toContain('<script>');
			expect(result).toContain('&lt;script&gt;');
		});

		it('escapes HTML in section reference anchor', () => {
			const markdown = '[Section](#"><script>alert("xss")</script>)';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint, {allowSectionReferences: true});
			expect(result).not.toContain('<script>');
			expect(result).toContain('&quot;');
		});

		it('handles section references with complex anchor names', () => {
			const markdown = '[Contact Us](#16-contact-us-and-more)';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint, {allowSectionReferences: true});
			expect(result).toContain('href="#16-contact-us-and-more"');
			expect(result).toContain('>Contact Us</a>');
		});

		it('renders section references within other content', () => {
			const markdown = '# Heading\n\nSee [Section 1](#section-1) for more.\n\n## Section 1\n\nContent here.';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint, {allowSectionReferences: true});
			expect(result).toContain('<h1');
			expect(result).toContain('href="#section-1"');
			expect(result).toContain('<h2');
		});

		it('handles empty options object', () => {
			const markdown = 'See [Section 16](#16-contact-us)';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint, {});
			expect(result).not.toContain('href="#16-contact-us"');
		});

		it('handles section reference with special characters in text', () => {
			const markdown = '[Section & More](#target)';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint, {allowSectionReferences: true});
			expect(result).toContain('href="#target"');
			expect(result).toContain('>Section &amp; More</a>');
		});

		it('handles section reference at start of line', () => {
			const markdown = '[Introduction](#intro)';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint, {allowSectionReferences: true});
			expect(result).toContain('href="#intro"');
		});

		it('handles section reference at end of line', () => {
			const markdown = 'For more information, see [Section 5](#section-5)';
			const result = renderMarkdownWithBase(markdown, baseUrl, appEndpoint, {allowSectionReferences: true});
			expect(result).toContain('href="#section-5"');
		});
	});
});
