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

import {Parser} from '@fluxer/markdown_parser/src/parser/Parser';
import {ParserFlags} from '@fluxer/markdown_parser/src/types/Enums';
import {renderAstToHtml} from '@fluxer/marketing/src/markdown/AstHtmlRenderer';

export interface MarkdownRenderOptions {
	allowSectionReferences?: boolean;
}

const htmlCommentLineRegex = /^[ \t]*<!--[\s\S]*?-->[ \t]*\n/gm;
const htmlCommentInlineLineRegex = /\n[ \t]*<!--.*?-->[ \t]*(?=\n|$)/gm;
const htmlCommentAnyRegex = /<!--[\s\S]*?-->/g;
const appShortcutRegex = /<%\s*app +([^%]+)\s*%>/g;
const relativeLinkRegex = /\[([^\]]+)\]\((\/[^)]*)\)/g;
const sectionReferenceRegex = /\[([^\]]+)\]\((#[^)]+)\)/g;

const MARKETING_PARSER_FLAGS =
	ParserFlags.ALLOW_SPOILERS |
	ParserFlags.ALLOW_HEADINGS |
	ParserFlags.ALLOW_LISTS |
	ParserFlags.ALLOW_CODE_BLOCKS |
	ParserFlags.ALLOW_MASKED_LINKS |
	ParserFlags.ALLOW_BLOCKQUOTES |
	ParserFlags.ALLOW_MULTILINE_BLOCKQUOTES |
	ParserFlags.ALLOW_TABLES |
	ParserFlags.ALLOW_ALERTS |
	ParserFlags.ALLOW_AUTOLINKS;

const HORIZONTAL_RULE_MARKER = 'FLUXER_HORIZONTAL_RULE_PLACEHOLDER';
const SECTION_REFERENCE_PLACEHOLDER_PREFIX = 'FLUXER_SECTION_REF_';

export function renderMarkdownWithBase(
	markdown: string,
	baseUrl: string,
	appEndpoint: string,
	options?: MarkdownRenderOptions,
	copyLinkText?: string,
): string {
	let processed = markdown;
	const sectionReferences = new Map<string, {text: string; anchor: string}>();

	if (options?.allowSectionReferences) {
		const extracted = extractSectionReferences(processed);
		processed = extracted.text;
		for (const [key, value] of extracted.references) {
			sectionReferences.set(key, value);
		}
	}

	const preprocessed = preprocessMarkdown(
		removeHtmlComments(
			resolveRelativeLinks(replaceAppVariables(expandAppShortcuts(processed, appEndpoint), appEndpoint), baseUrl),
		),
	).trim();

	const parser = new Parser(preprocessed, MARKETING_PARSER_FLAGS);
	const result = parser.parse();

	let html = renderAstToHtml(result.nodes, copyLinkText);
	html = postProcessHtml(html);

	if (options?.allowSectionReferences) {
		html = restoreSectionReferences(html, sectionReferences);
	}

	return html;
}

function preprocessMarkdown(text: string): string {
	const lines = text.split('\n');
	const result: Array<string> = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const nextLine = lines[i + 1];

		if (line.trim() === '---') {
			result.push(HORIZONTAL_RULE_MARKER);
			continue;
		}

		if (nextLine !== undefined && isSetextUnderline(nextLine.trim()) && line.trim().length > 0) {
			const level = nextLine.trim().startsWith('=') ? 1 : 2;
			result.push(`${'#'.repeat(level)} ${line.trim()}`);
			i++;
			continue;
		}

		const extendedHeaderMatch = line.match(/^(#{5,6})\s+(.+)$/);
		if (extendedHeaderMatch) {
			const hashes = extendedHeaderMatch[1];
			const content = extendedHeaderMatch[2];
			const slugBase = createSlugBase(content);
			result.push(`#### ${content} {#${slugBase}-h${hashes.length}-marker}`);
			continue;
		}

		result.push(line);
	}

	return result.join('\n');
}

function isSetextUnderline(line: string): boolean {
	if (line.length === 0) return false;
	return isAllSameChar(line, '=') || isAllSameChar(line, '-');
}

function isAllSameChar(text: string, char: string): boolean {
	for (const c of text) {
		if (c !== char) return false;
	}
	return true;
}

function postProcessHtml(html: string): string {
	let result = html.replaceAll(`<p>${HORIZONTAL_RULE_MARKER}</p>`, '<hr class="my-8">');

	result = result.replace(/<h4 id="([^"]*)-h5-marker"([^>]*)>([\s\S]*?)<\/h4>/g, (_match, slug, attrs, content) => {
		const cleanSlug = slug as string;
		const cleanAttrs = attrs as string;
		const cleanContent = (content as string).replace(
			new RegExp(`data-anchor-link="${cleanSlug}-h5-marker"`, 'g'),
			`data-anchor-link="${cleanSlug}"`,
		);
		return `<h5 id="${cleanSlug}"${cleanAttrs}>${cleanContent}</h5>`;
	});
	result = result.replace(/<h4 id="([^"]*)-h6-marker"([^>]*)>([\s\S]*?)<\/h4>/g, (_match, slug, attrs, content) => {
		const cleanSlug = slug as string;
		const cleanAttrs = attrs as string;
		const cleanContent = (content as string).replace(
			new RegExp(`data-anchor-link="${cleanSlug}-h6-marker"`, 'g'),
			`data-anchor-link="${cleanSlug}"`,
		);
		return `<h6 id="${cleanSlug}"${cleanAttrs}>${cleanContent}</h6>`;
	});

	return result;
}

function expandAppShortcuts(text: string, appEndpoint: string): string {
	return replaceMatches(text, appShortcutRegex, (_match, path) => {
		const cleanPath = path.trim();
		const display = buildAppDisplay(appEndpoint, cleanPath);
		const url = `${appEndpoint}/${cleanPath}`;
		return `[${display}](${url})`;
	});
}

function buildAppDisplay(appEndpoint: string, path: string): string {
	const parts = appEndpoint.split('://');
	if (parts.length === 2 && parts[1]) {
		return `${parts[1]}/${path}`;
	}
	return `${appEndpoint}/${path}`;
}

function replaceAppVariables(text: string, appEndpoint: string): string {
	const [protocol, host] = extractProtocolAndHost(appEndpoint);
	return text.replaceAll('%app.proto%', protocol).replaceAll('%app.host%', host);
}

function extractProtocolAndHost(appEndpoint: string): [string, string] {
	const parts = appEndpoint.split('://');
	if (parts.length === 2 && parts[0] && parts[1]) {
		return [parts[0], parts[1]];
	}
	return ['https', appEndpoint];
}

function resolveRelativeLinks(text: string, baseUrl: string): string {
	const base = normalizeBase(baseUrl);
	return replaceMatches(text, relativeLinkRegex, (_match, linkText, path) => `[${linkText}](${base}${path})`);
}

function removeHtmlComments(text: string): string {
	const step1 = text.replace(htmlCommentLineRegex, '');
	const step2 = step1.replace(htmlCommentInlineLineRegex, '');
	return step2.replace(htmlCommentAnyRegex, '');
}

function normalizeBase(baseUrl: string): string {
	return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

const headingSlugRegex = /[^\p{L}\p{N}]+/gu;
const headingSlugCollapseRegex = /-+/g;

function createSlugBase(text: string): string {
	const lower = text.toLowerCase();
	const hyphenated = lower.replace(headingSlugRegex, '-');
	const collapsed = hyphenated.replace(headingSlugCollapseRegex, '-');
	const trimmed = trimHyphens(collapsed).trim();
	return trimmed.length === 0 ? 'section' : trimmed;
}

function trimHyphens(text: string): string {
	let start = 0;
	let end = text.length;
	while (start < end && text[start] === '-') {
		start += 1;
	}
	while (end > start && text[end - 1] === '-') {
		end -= 1;
	}
	return text.slice(start, end);
}

function replaceMatches(
	text: string,
	regex: RegExp,
	replacer: (match: string, ...groups: Array<string>) => string,
): string {
	const matches = Array.from(text.matchAll(new RegExp(regex.source, regex.flags)));
	return matches.reduce((acc, match) => {
		const [fullMatch, ...groups] = match;
		if (!fullMatch) return acc;
		const replacement = replacer(fullMatch, ...(groups as Array<string>));
		return acc.split(fullMatch).join(replacement);
	}, text);
}

interface SectionReferenceExtraction {
	text: string;
	references: Map<string, {text: string; anchor: string}>;
}

function extractSectionReferences(text: string): SectionReferenceExtraction {
	const references = new Map<string, {text: string; anchor: string}>();
	let counter = 0;

	const processed = text.replace(sectionReferenceRegex, (_match, linkText, anchor) => {
		const placeholder = `${SECTION_REFERENCE_PLACEHOLDER_PREFIX}${counter}`;
		references.set(placeholder, {text: linkText, anchor});
		counter++;
		return placeholder;
	});

	return {text: processed, references};
}

function restoreSectionReferences(html: string, references: Map<string, {text: string; anchor: string}>): string {
	let result = html;
	for (const [placeholder, {text, anchor}] of references) {
		const link = `<a class="text-[#4641D9] hover:underline" href="${escapeHtmlAttribute(anchor)}">${escapeHtmlContent(text)}</a>`;
		result = result.replaceAll(placeholder, link);
	}
	return result;
}

function escapeHtmlAttribute(text: string): string {
	return text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeHtmlContent(text: string): string {
	return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
