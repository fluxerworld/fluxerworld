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

const RANGE_START_TO_START = 0;
const RANGE_END_TO_END = 2;

interface MessageSelectionCopyOptions {
	rootElement: HTMLElement;
	selection: Selection | null;
	getMessagePlaintext?: (messageId: string) => string | null;
}

interface PreparedRowText {
	text: string;
	isGroupStart: boolean;
}

interface HeaderInfo {
	headerElement: HTMLElement;
	username: string;
	timestamp: string;
}

export function buildMessageSelectionCopyText(options: MessageSelectionCopyOptions): string | null {
	const {rootElement, selection, getMessagePlaintext} = options;

	if (!isSelectionInsideRoot(selection, rootElement)) {
		return null;
	}

	const selectionRange = getSelectionRange(selection);
	if (!selectionRange) {
		return null;
	}

	const selectedRows = getSelectedMessageRows(rootElement, selectionRange);
	if (selectedRows.length < 2) {
		return null;
	}

	const preparedRows = selectedRows
		.map((row) => prepareRowText(row, selectionRange, getMessagePlaintext))
		.filter((preparedRow): preparedRow is PreparedRowText => preparedRow != null && preparedRow.text.length > 0);

	if (preparedRows.length < 2) {
		return null;
	}

	return joinPreparedRows(preparedRows);
}

function isSelectionInsideRoot(selection: Selection | null, rootElement: HTMLElement): boolean {
	if (!selection) {
		return false;
	}

	const anchorNode = selection.anchorNode;
	const focusNode = selection.focusNode;
	if (!anchorNode || !focusNode) {
		return false;
	}

	return rootElement.contains(anchorNode) && rootElement.contains(focusNode);
}

function getSelectionRange(selection: Selection | null): Range | null {
	if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
		return null;
	}

	const range = selection.getRangeAt(0);
	if (range.collapsed) {
		return null;
	}

	return range;
}

function getSelectedMessageRows(rootElement: HTMLElement, selectionRange: Range): Array<HTMLElement> {
	const messageRows = Array.from(rootElement.querySelectorAll<HTMLElement>('[data-message-id][data-is-group-start]'));
	return messageRows.filter((row) => rangeIntersectsNode(selectionRange, row));
}

function rangeIntersectsNode(range: Range, node: Node): boolean {
	try {
		return range.intersectsNode(node);
	} catch {
		return false;
	}
}

function prepareRowText(
	row: HTMLElement,
	selectionRange: Range,
	getMessagePlaintext?: (messageId: string) => string | null,
): PreparedRowText | null {
	const rowSelectionRange = getRowSelectionRange(row, selectionRange);
	if (!rowSelectionRange) {
		return null;
	}

	const rawRowText = sanitiseCopiedText(rowSelectionRange.toString());
	if (!rawRowText.trim()) {
		return null;
	}

	const isGroupStart = isGroupStartRow(row);
	const messagePlaintext = getResolvedMessagePlaintext(row, rowSelectionRange, getMessagePlaintext);
	if (!isGroupStart) {
		return {text: messagePlaintext ?? rawRowText, isGroupStart};
	}

	const headerInfo = getHeaderInfo(row);
	if (!headerInfo || !rangeIntersectsNode(rowSelectionRange, headerInfo.headerElement)) {
		return {text: messagePlaintext ?? rawRowText, isGroupStart};
	}

	const rowBodyWithoutHeader = messagePlaintext ?? removeHeaderPrefix(rawRowText, headerInfo);
	const normalisedHeader = `${headerInfo.username} — ${headerInfo.timestamp}`;
	return {
		text: rowBodyWithoutHeader ? `${normalisedHeader}\n${rowBodyWithoutHeader}` : normalisedHeader,
		isGroupStart,
	};
}

function getResolvedMessagePlaintext(
	row: HTMLElement,
	rowSelectionRange: Range,
	getMessagePlaintext?: (messageId: string) => string | null,
): string | null {
	if (!getMessagePlaintext || !isEntireRowSelected(row, rowSelectionRange)) {
		return null;
	}

	const messageId = row.dataset.messageId;
	if (!messageId) {
		return null;
	}

	const plaintext = getMessagePlaintext(messageId);
	return plaintext && plaintext.trim().length > 0 ? plaintext : null;
}

function getRowSelectionRange(row: HTMLElement, selectionRange: Range): Range | null {
	const rowRange = row.ownerDocument.createRange();
	rowRange.selectNodeContents(row);

	const intersectionRange = selectionRange.cloneRange();

	if (selectionRange.compareBoundaryPoints(RANGE_START_TO_START, rowRange) < 0) {
		intersectionRange.setStart(rowRange.startContainer, rowRange.startOffset);
	}

	if (selectionRange.compareBoundaryPoints(RANGE_END_TO_END, rowRange) > 0) {
		intersectionRange.setEnd(rowRange.endContainer, rowRange.endOffset);
	}

	if (intersectionRange.collapsed) {
		return null;
	}

	return intersectionRange;
}

function isEntireRowSelected(row: HTMLElement, rowSelectionRange: Range): boolean {
	const fullRowRange = row.ownerDocument.createRange();
	fullRowRange.selectNodeContents(row);

	return (
		rowSelectionRange.compareBoundaryPoints(RANGE_START_TO_START, fullRowRange) === 0 &&
		rowSelectionRange.compareBoundaryPoints(RANGE_END_TO_END, fullRowRange) === 0
	);
}

function sanitiseCopiedText(text: string): string {
	return normaliseLineEndings(text)
		.replace(/\u00a0/gu, ' ')
		.replace(/[ \t]+\n/gu, '\n')
		.trimEnd();
}

function isGroupStartRow(row: HTMLElement): boolean {
	return row.dataset.isGroupStart === 'true';
}

function getHeaderInfo(row: HTMLElement): HeaderInfo | null {
	const headerElement = findHeaderElement(row);
	if (!headerElement) {
		return null;
	}

	const usernameElement = headerElement.querySelector<HTMLElement>('[data-user-id]');
	const timestampElement = headerElement.querySelector<HTMLElement>('time');
	if (!usernameElement || !timestampElement) {
		return null;
	}

	const username = collapseWhitespace(getTextContentWithoutAriaHidden(usernameElement));
	const timestamp = collapseWhitespace(getTextContentWithoutAriaHidden(timestampElement));
	if (!username || !timestamp) {
		return null;
	}

	return {
		headerElement,
		username,
		timestamp,
	};
}

function getTextContentWithoutAriaHidden(element: HTMLElement): string {
	let text = '';

	for (const childNode of element.childNodes) {
		if (childNode.nodeType === Node.TEXT_NODE) {
			text += childNode.textContent ?? '';
			continue;
		}

		if (childNode.nodeType !== Node.ELEMENT_NODE) {
			continue;
		}

		const childElement = childNode as HTMLElement;
		if (childElement.getAttribute('aria-hidden') === 'true') {
			continue;
		}

		text += getTextContentWithoutAriaHidden(childElement);
	}

	return text;
}

function findHeaderElement(row: HTMLElement): HTMLElement | null {
	const headings = row.querySelectorAll<HTMLElement>('h3');
	for (const heading of headings) {
		if (heading.querySelector('[data-user-id]') && heading.querySelector('time')) {
			return heading;
		}
	}

	return null;
}

function removeHeaderPrefix(rowText: string, headerInfo: HeaderInfo): string {
	const normalisedRowText = normaliseLineEndings(rowText);
	const lines = normalisedRowText.split('\n');
	let firstTextLineIndex = 0;

	while (firstTextLineIndex < lines.length && collapseWhitespace(lines[firstTextLineIndex]).length === 0) {
		firstTextLineIndex += 1;
	}

	if (firstTextLineIndex >= lines.length) {
		return '';
	}

	const username = collapseWhitespace(headerInfo.username);
	const timestamp = collapseWhitespace(headerInfo.timestamp);
	const firstLine = collapseWhitespace(lines[firstTextLineIndex]);
	const secondLine = firstTextLineIndex + 1 < lines.length ? collapseWhitespace(lines[firstTextLineIndex + 1]) : '';

	if (lineContainsHeader(firstLine, username, timestamp)) {
		const firstLineWithoutHeader = removeInlineHeaderPrefix(lines[firstTextLineIndex], username, timestamp);
		const bodyText = [firstLineWithoutHeader, ...lines.slice(firstTextLineIndex + 1)].join('\n').replace(/^\n+/u, '');
		return stripLeadingHeaderSeparator(bodyText);
	}

	if (firstLine.includes(username) && lineContainsTimestamp(secondLine, timestamp)) {
		const secondLineWithoutTimestamp = removeTimestampLinePrefix(lines[firstTextLineIndex + 1] ?? '', timestamp);
		const bodyText = [secondLineWithoutTimestamp, ...lines.slice(firstTextLineIndex + 2)]
			.join('\n')
			.replace(/^\n+/u, '');
		return stripLeadingHeaderSeparator(bodyText);
	}

	const headerPrefixPattern = createHeaderPrefixPattern(username, timestamp);
	return stripLeadingHeaderSeparator(normalisedRowText.replace(headerPrefixPattern, '').replace(/^\n+/u, ''));
}

function lineContainsHeader(line: string, username: string, timestamp: string): boolean {
	return line.includes(username) && lineContainsTimestamp(line, timestamp);
}

function lineContainsTimestamp(line: string, timestamp: string): boolean {
	const withoutLeadingDash = line.replace(/^(?:[-—]\s*)+/u, '');
	return withoutLeadingDash.includes(timestamp);
}

function createHeaderPrefixPattern(username: string, timestamp: string): RegExp {
	const escapedUsername = escapeRegExp(username);
	const escapedTimestamp = escapeRegExp(timestamp);
	return new RegExp(`^\\s*${escapedUsername}\\s*(?:\\n\\s*)?(?:[-—]\\s*)*${escapedTimestamp}\\s*`, 'u');
}

function removeInlineHeaderPrefix(line: string, username: string, timestamp: string): string {
	const escapedUsername = escapeRegExp(username);
	const escapedTimestamp = escapeRegExp(timestamp);
	const inlineHeaderPattern = new RegExp(`^\\s*${escapedUsername}\\s*(?:[-—]\\s*)*${escapedTimestamp}\\s*`, 'u');
	return line.replace(inlineHeaderPattern, '');
}

function removeTimestampLinePrefix(line: string, timestamp: string): string {
	const escapedTimestamp = escapeRegExp(timestamp);
	const timestampPrefixPattern = new RegExp(`^\\s*(?:[-—]\\s*)*${escapedTimestamp}\\s*`, 'u');
	return line.replace(timestampPrefixPattern, '');
}

function stripLeadingHeaderSeparator(value: string): string {
	return value.replace(/^\s*(?:[-—]\s*)+/u, '');
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function collapseWhitespace(value: string): string {
	return value.replace(/\s+/gu, ' ').trim();
}

function normaliseLineEndings(value: string): string {
	return value.replace(/\r\n/gu, '\n');
}

function joinPreparedRows(rows: Array<PreparedRowText>): string {
	let result = '';

	for (const row of rows) {
		if (!row.text.trim()) {
			continue;
		}

		if (result.length > 0) {
			result += row.isGroupStart ? '\n\n' : '\n';
		}

		result += row.text;
	}

	return result;
}
