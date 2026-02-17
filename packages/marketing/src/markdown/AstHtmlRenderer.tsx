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

import type {ValueOf} from '@fluxer/constants/src/ValueOf';
import {AlertType, NodeType, TableAlignment} from '@fluxer/markdown_parser/src/types/Enums';
import type {
	AlertNode,
	BlockquoteNode,
	CodeBlockNode,
	FormattingNode,
	HeadingNode,
	InlineCodeNode,
	LinkNode,
	ListItem,
	ListNode,
	Node,
	SequenceNode,
	SpoilerNode,
	SubtextNode,
	TableCellNode,
	TableNode,
	TableRowNode,
	TextNode,
} from '@fluxer/markdown_parser/src/types/Nodes';

const headingSlugRegex = /[^\p{L}\p{N}]+/gu;
const headingSlugCollapseRegex = /-+/g;
const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const headerIdRegex = /\s*\{#([^}]+)\}\s*$/;

export function renderAstToHtml(nodes: Array<Node>, copyLinkText?: string): string {
	const blocks = groupIntoBlocks(nodes);
	return blocks
		.map((block) => {
			if (block.type === 'paragraph') {
				return renderParagraph(block.nodes);
			}
			return renderBlockNode(block.node, copyLinkText);
		})
		.join('\n\n');
}

interface ParagraphBlock {
	type: 'paragraph';
	nodes: Array<Node>;
}

interface SingleBlock {
	type: 'single';
	node: Node;
}

type Block = ParagraphBlock | SingleBlock;

function isInlineNode(node: Node): boolean {
	switch (node.type) {
		case NodeType.Text:
		case NodeType.Strong:
		case NodeType.Emphasis:
		case NodeType.Underline:
		case NodeType.Strikethrough:
		case NodeType.Spoiler:
		case NodeType.InlineCode:
		case NodeType.Link:
		case NodeType.Sequence:
			return true;
		default:
			return false;
	}
}

function groupIntoBlocks(nodes: Array<Node>): Array<Block> {
	const blocks: Array<Block> = [];
	let currentInlineGroup: Array<Node> = [];

	function flushInlineGroup(): void {
		if (currentInlineGroup.length > 0) {
			const trimmed = trimInlineGroup(currentInlineGroup);
			if (trimmed.length > 0) {
				blocks.push({type: 'paragraph', nodes: trimmed});
			}
			currentInlineGroup = [];
		}
	}

	for (const node of nodes) {
		if (isInlineNode(node)) {
			currentInlineGroup.push(node);
		} else {
			flushInlineGroup();
			blocks.push({type: 'single', node});
		}
	}

	flushInlineGroup();
	return blocks;
}

function trimInlineGroup(nodes: Array<Node>): Array<Node> {
	let start = 0;
	let end = nodes.length;

	while (start < end) {
		const node = nodes[start];
		if (node.type === NodeType.Text && node.content.trim() === '') {
			start++;
		} else {
			break;
		}
	}

	while (end > start) {
		const node = nodes[end - 1];
		if (node.type === NodeType.Text && node.content.trim() === '') {
			end--;
		} else {
			break;
		}
	}

	if (start === end) {
		return [];
	}

	const result = nodes.slice(start, end);
	if (result.length > 0) {
		const firstNode = result[0];
		if (firstNode.type === NodeType.Text) {
			result[0] = {...firstNode, content: firstNode.content.trimStart()};
		}
		const lastNode = result[result.length - 1];
		if (lastNode.type === NodeType.Text) {
			result[result.length - 1] = {...lastNode, content: lastNode.content.trimEnd()};
		}
	}

	return result;
}

function renderParagraph(nodes: Array<Node>): string {
	const content = nodes.map((node) => renderInlineNode(node)).join('');
	const withEmails = autoLinkEmails(content);
	return `<p>${withEmails}</p>`;
}

function renderInlineNode(node: Node): string {
	switch (node.type) {
		case NodeType.Text:
			return renderTextNode(node);
		case NodeType.Strong:
		case NodeType.Emphasis:
		case NodeType.Underline:
		case NodeType.Strikethrough:
		case NodeType.Sequence:
			return renderFormattingNode(node);
		case NodeType.Spoiler:
			return renderSpoilerNode(node as SpoilerNode);
		case NodeType.InlineCode:
			return renderInlineCodeNode(node);
		case NodeType.Link:
			return renderLinkNode(node);
		default:
			return '';
	}
}

function renderBlockNode(node: Node, copyLinkText?: string): string {
	switch (node.type) {
		case NodeType.Heading:
			return renderHeadingNode(node, copyLinkText);
		case NodeType.Subtext:
			return renderSubtextNode(node);
		case NodeType.Blockquote:
			return renderBlockquoteNode(node);
		case NodeType.List:
			return renderListNode(node);
		case NodeType.CodeBlock:
			return renderCodeBlockNode(node);
		case NodeType.Table:
			return renderTableNode(node);
		case NodeType.Alert:
			return renderAlertNode(node);
		default:
			return '';
	}
}

function renderTextNode(node: TextNode): string {
	const escaped = escapeHtml(node.content);
	return escaped.replaceAll('\n', '<br>');
}

function renderFormattingNode(node: FormattingNode | SequenceNode): string {
	const content = node.children.map((child) => renderInlineNode(child)).join('');
	switch (node.type) {
		case NodeType.Strong:
			return `<strong>${content}</strong>`;
		case NodeType.Emphasis:
			return `<em>${content}</em>`;
		case NodeType.Underline:
			return `<u>${content}</u>`;
		case NodeType.Strikethrough:
			return `<s>${content}</s>`;
		case NodeType.Sequence:
			return content;
		default:
			return content;
	}
}

function renderSpoilerNode(node: SpoilerNode): string {
	const content = node.children.map((child) => renderInlineNode(child)).join('');
	return `<span class="spoiler">${content}</span>`;
}

function renderHeadingNode(node: HeadingNode, copyLinkText?: string): string {
	const level = Math.min(Math.max(node.level, 1), 6);
	const tag = `h${level}`;
	const textContent = getTextContent(node.children);
	const [cleanText, customId] = extractHeaderId(textContent);
	const content = customId.length > 0 ? renderChildrenWithoutHeaderId(node.children) : renderHeadingChildren(node);
	const slug = customId.length > 0 ? customId : createHeadingSlug(cleanText);
	const linkButton = renderHeadingLinkButton(slug, copyLinkText);
	return `<${tag} id="${escapeHtmlAttribute(slug)}" class="heading-anchor-container" style="scroll-margin-top: var(--anchor-offset, 200px)">${content}${linkButton}</${tag}>`;
}

function renderHeadingLinkButton(slug: string, copyLinkText?: string): string {
	const linkIconSvg =
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="w-4 h-4"><path d="M137.54,186.36a8,8,0,0,1,0,11.31l-9.94,10A56,56,0,0,1,48.38,128.4L72.5,104.28A56,56,0,0,1,149.31,102a8,8,0,1,1-10.64,12,40,40,0,0,0-54.85,1.63L59.7,139.72a40,40,0,0,0,56.58,56.58l9.94-9.94A8,8,0,0,1,137.54,186.36Zm70.08-138a56.06,56.06,0,0,0-79.22,0l-9.94,9.95a8,8,0,0,0,11.32,11.31l9.94-9.94a40,40,0,0,1,56.58,56.58L172.18,140.4A40,40,0,0,1,117.33,142,8,8,0,1,0,106.69,154a56,56,0,0,0,76.81-2.26l24.12-24.12A56.06,56.06,0,0,0,207.62,48.38Z"/></svg>';
	const checkIconSvg =
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="24" class="w-4 h-4"><polyline points="40,144 96,200 224,72"/></svg>';
	const ariaLabel = copyLinkText ?? 'Copy link to section';
	return `<button type="button" class="heading-anchor-link" data-anchor-link="${escapeHtmlAttribute(slug)}" aria-label="${escapeHtmlAttribute(ariaLabel)}"><span class="link-icon">${linkIconSvg}</span><span class="check-icon">${checkIconSvg}</span></button>`;
}

function renderChildrenWithoutHeaderId(children: Array<Node>): string {
	const content = children.map((child) => renderInlineNode(child)).join('');
	return content.replace(headerIdRegex, '').trim();
}

function renderHeadingChildren(node: HeadingNode): string {
	return node.children.map((child) => renderInlineNode(child)).join('');
}

function renderSubtextNode(node: SubtextNode): string {
	const content = node.children.map((child) => renderInlineNode(child)).join('');
	return `<small>${content}</small>`;
}

function renderBlockquoteNode(node: BlockquoteNode): string {
	const content = node.children.map((child) => renderInlineNode(child)).join('');
	return `<blockquote>${content}</blockquote>`;
}

function renderListNode(node: ListNode): string {
	const tag = node.ordered ? 'ol' : 'ul';
	const items = node.items.map((item) => renderListItem(item)).join('\n');
	return `<${tag}>\n${items}\n</${tag}>`;
}

function renderListItem(item: ListItem): string {
	const content = item.children.map((child) => renderListItemChild(child)).join('');
	const withEmails = autoLinkEmails(content);
	return `<li>${withEmails}</li>`;
}

function renderListItemChild(node: Node): string {
	if (node.type === NodeType.List) {
		return `\n${renderListNode(node)}\n`;
	}
	return renderInlineNode(node);
}

function renderCodeBlockNode(node: CodeBlockNode): string {
	const escapedContent = escapeHtml(node.content);
	if (node.language) {
		return `<pre><code class="language-${escapeHtml(node.language)}">${escapedContent}</code></pre>`;
	}
	return `<pre><code>${escapedContent}</code></pre>`;
}

function renderInlineCodeNode(node: InlineCodeNode): string {
	return `<strong>${escapeHtml(node.content)}</strong>`;
}

function renderLinkNode(node: LinkNode): string {
	const escapedUrl = escapeHtml(node.url);
	if (node.text) {
		const textContent = renderInlineNode(node.text);
		return `<a class="text-[#4641D9] hover:underline" href="${escapedUrl}">${textContent}</a>`;
	}
	return `<a class="text-[#4641D9] hover:underline" href="${escapedUrl}">${escapedUrl}</a>`;
}

function renderTableNode(node: TableNode): string {
	const headerHtml = renderTableRowNode(node.header, true, node.alignments);
	const bodyRows = node.rows.map((row) => renderTableRowNode(row, false, node.alignments)).join('\n');
	const bodyHtml = node.rows.length > 0 ? `<tbody>\n${bodyRows}\n</tbody>` : '';
	return `<table class="border-collapse border border-gray-300 w-full my-4">\n<thead>\n${headerHtml}\n</thead>\n${bodyHtml}\n</table>`;
}

function renderTableRowNode(
	node: TableRowNode,
	isHeader: boolean,
	alignments?: Array<ValueOf<typeof TableAlignment>>,
): string {
	const cells = node.cells.map((cell, index) => renderTableCellNode(cell, isHeader, alignments?.[index])).join('\n');
	return `<tr>\n${cells}\n</tr>`;
}

function renderTableCellNode(
	node: TableCellNode,
	isHeader: boolean,
	alignment?: ValueOf<typeof TableAlignment>,
): string {
	const content = node.children.map((child) => renderInlineNode(child)).join('');
	const tag = isHeader ? 'th' : 'td';
	const baseClass = isHeader
		? 'border border-gray-300 px-4 py-2 bg-gray-50 font-semibold'
		: 'border border-gray-300 px-4 py-2';

	let alignStyle = '';
	if (alignment) {
		switch (alignment) {
			case TableAlignment.Left:
				alignStyle = ' text-left';
				break;
			case TableAlignment.Center:
				alignStyle = ' text-center';
				break;
			case TableAlignment.Right:
				alignStyle = ' text-right';
				break;
		}
	}

	return `<${tag} class="${baseClass}${alignStyle}">${content}</${tag}>`;
}

function renderAlertNode(node: AlertNode): string {
	const content = node.children.map((child) => renderInlineNode(child)).join('');
	const alertClass = getAlertClass(node.alertType);
	return `<div class="alert ${alertClass}">${content}</div>`;
}

function getAlertClass(alertType: ValueOf<typeof AlertType>): string {
	switch (alertType) {
		case AlertType.Note:
			return 'alert-note';
		case AlertType.Tip:
			return 'alert-tip';
		case AlertType.Important:
			return 'alert-important';
		case AlertType.Warning:
			return 'alert-warning';
		case AlertType.Caution:
			return 'alert-caution';
		default:
			return 'alert-note';
	}
}

function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function escapeHtmlAttribute(text: string): string {
	return text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function createHeadingSlug(text: string): string {
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

function extractHeaderId(raw: string): [string, string] {
	const match = raw.match(headerIdRegex);
	if (!match) return [raw, ''];
	const customId = match[1] ?? '';
	const clean = raw.replace(match[0], '').trim();
	return [clean, customId.trim()];
}

function getTextContent(nodes: Array<Node>): string {
	return nodes
		.map((node) => {
			if (node.type === NodeType.Text) {
				return node.content;
			}
			if ('children' in node && Array.isArray(node.children)) {
				return getTextContent(node.children);
			}
			if (node.type === NodeType.InlineCode) {
				return node.content;
			}
			return '';
		})
		.join('');
}

function autoLinkEmails(html: string): string {
	const parts = splitByTags(html);
	return parts
		.map((part) => {
			if (part.isTag) {
				return part.content;
			}
			return part.content.replace(emailRegex, (email) => {
				return `<a class="text-[#4641D9] hover:underline" href="mailto:${email}">${email}</a>`;
			});
		})
		.join('');
}

interface HtmlPart {
	content: string;
	isTag: boolean;
}

function splitByTags(html: string): Array<HtmlPart> {
	const parts: Array<HtmlPart> = [];
	let currentText = '';
	let i = 0;

	while (i < html.length) {
		if (html[i] === '<') {
			if (currentText.length > 0) {
				parts.push({content: currentText, isTag: false});
				currentText = '';
			}
			let tagEnd = html.indexOf('>', i);
			if (tagEnd === -1) {
				tagEnd = html.length;
			}
			parts.push({content: html.slice(i, tagEnd + 1), isTag: true});
			i = tagEnd + 1;
		} else {
			currentText += html[i];
			i++;
		}
	}

	if (currentText.length > 0) {
		parts.push({content: currentText, isTag: false});
	}

	return parts;
}
