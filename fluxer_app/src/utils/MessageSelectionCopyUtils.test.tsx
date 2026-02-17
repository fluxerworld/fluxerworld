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

import {buildMessageSelectionCopyText} from '@app/utils/MessageSelectionCopyUtils';
import {afterEach, describe, expect, it} from 'vitest';

interface MessageRowDefinition {
	messageId: string;
	isGroupStart: boolean;
	body: string;
	header?: {
		username: string;
		timestamp: string;
		splitAcrossLines?: boolean;
		includeDashInsideTime?: boolean;
	};
}

describe('buildMessageSelectionCopyText', () => {
	afterEach(() => {
		document.body.innerHTML = '';
		window.getSelection()?.removeAllRanges();
	});

	it('keeps username and timestamp on one line and inserts a blank line between groups', () => {
		const rootElement = createRootElement();
		const firstRow = createMessageRow({
			messageId: 'row-1',
			isGroupStart: true,
			header: {
				username: 'Sky',
				timestamp: 'Today at 21:24',
				includeDashInsideTime: true,
			},
			body: 'also the pip is missing',
		});
		const secondRow = createMessageRow({
			messageId: 'row-2',
			isGroupStart: false,
			body: 'oh I think it might not show up for non-video feeds right now',
		});
		const thirdRow = createMessageRow({
			messageId: 'row-3',
			isGroupStart: true,
			header: {
				username: 'Hampus',
				timestamp: 'Today at 21:25',
				includeDashInsideTime: true,
			},
			body: "yeah those are good things I hadn't thought about",
		});

		rootElement.append(firstRow, secondRow, thirdRow);
		selectRange((range) => {
			range.setStartBefore(firstRow);
			range.setEndAfter(thirdRow);
		});

		const copyText = buildMessageSelectionCopyText({
			rootElement,
			selection: window.getSelection(),
		});

		expect(copyText).toBe(
			[
				'Sky — Today at 21:24',
				'also the pip is missing',
				'oh I think it might not show up for non-video feeds right now',
				'',
				'Hampus — Today at 21:25',
				"yeah those are good things I hadn't thought about",
			].join('\n'),
		);
	});

	it('returns null for single-row selections', () => {
		const rootElement = createRootElement();
		const firstRow = createMessageRow({
			messageId: 'row-1',
			isGroupStart: true,
			header: {
				username: 'Sky',
				timestamp: 'Today at 21:24',
			},
			body: 'also the pip is missing',
		});
		rootElement.append(firstRow);

		selectRange((range) => {
			range.setStartBefore(firstRow);
			range.setEndAfter(firstRow);
		});

		const copyText = buildMessageSelectionCopyText({
			rootElement,
			selection: window.getSelection(),
		});

		expect(copyText).toBeNull();
	});

	it('does not inject the header when the selection starts after it', () => {
		const rootElement = createRootElement();
		const firstRow = createMessageRow({
			messageId: 'row-1',
			isGroupStart: true,
			header: {
				username: 'Sky',
				timestamp: 'Today at 21:24',
				includeDashInsideTime: true,
			},
			body: 'also the pip is missing',
		});
		const secondRow = createMessageRow({
			messageId: 'row-2',
			isGroupStart: false,
			body: 'ah I see',
		});
		rootElement.append(firstRow, secondRow);

		const firstBodyNode = firstRow.querySelector<HTMLElement>('[data-body="1"]')?.firstChild;
		if (!firstBodyNode) {
			throw new Error('Expected first row body node to exist.');
		}

		selectRange((range) => {
			range.setStart(firstBodyNode, 9);
			range.setEndAfter(secondRow);
		});

		const copyText = buildMessageSelectionCopyText({
			rootElement,
			selection: window.getSelection(),
		});

		expect(copyText).toBe(['pip is missing', 'ah I see'].join('\n'));
	});

	it('uses markdown plaintext for fully selected message rows', () => {
		const rootElement = createRootElement();
		const firstRow = createMessageRow({
			messageId: 'row-1',
			isGroupStart: true,
			header: {
				username: 'Sky',
				timestamp: 'Today at 21:24',
				includeDashInsideTime: true,
			},
			body: 'hello friend',
		});
		const secondRow = createMessageRow({
			messageId: 'row-2',
			isGroupStart: false,
			body: 'another line',
		});
		rootElement.append(firstRow, secondRow);

		const firstBodyElement = firstRow.querySelector<HTMLElement>('[data-body="1"]');
		if (!firstBodyElement) {
			throw new Error('Expected first row body element to exist.');
		}

		firstBodyElement.textContent = 'hello ';
		const emojiImage = document.createElement('img');
		emojiImage.alt = ':wave:';
		firstBodyElement.append(emojiImage, document.createTextNode(' friend'));

		selectRange((range) => {
			range.setStartBefore(firstRow);
			range.setEndAfter(secondRow);
		});

		const copyText = buildMessageSelectionCopyText({
			rootElement,
			selection: window.getSelection(),
			getMessagePlaintext: (messageId: string) => {
				switch (messageId) {
					case 'row-1':
						return 'hello :wave: friend';
					default:
						return null;
				}
			},
		});

		expect(copyText).toBe(['Sky — Today at 21:24', 'hello :wave: friend', 'another line'].join('\n'));
	});
});

function createRootElement(): HTMLElement {
	const rootElement = document.createElement('div');
	document.body.append(rootElement);
	return rootElement;
}

function createMessageRow(definition: MessageRowDefinition): HTMLElement {
	const rowElement = document.createElement('div');
	rowElement.dataset.messageId = definition.messageId;
	rowElement.dataset.isGroupStart = String(definition.isGroupStart);

	if (definition.header) {
		const headerElement = document.createElement('h3');
		const usernameElement = document.createElement('span');
		usernameElement.dataset.userId = `${definition.messageId}-user`;
		usernameElement.textContent = definition.header.username;

		const timeElement = document.createElement('time');
		timeElement.textContent = definition.header.timestamp;

		headerElement.append(usernameElement);
		if (definition.header.includeDashInsideTime) {
			const hiddenSpacerElement = document.createElement('i');
			hiddenSpacerElement.setAttribute('aria-hidden', 'true');
			hiddenSpacerElement.textContent = ' ';
			timeElement.append(hiddenSpacerElement);

			const separatorElement = document.createElement('span');
			separatorElement.setAttribute('aria-hidden', 'true');
			separatorElement.textContent = ' — ';
			timeElement.append(separatorElement);
		} else if (definition.header.splitAcrossLines) {
			headerElement.append(document.createTextNode('\n'));
			headerElement.append(document.createTextNode('— '));
		} else {
			headerElement.append(document.createTextNode(' — '));
		}
		headerElement.append(timeElement);
		rowElement.append(headerElement);
	}

	const bodyElement = document.createElement('div');
	bodyElement.dataset.body = '1';
	bodyElement.textContent = definition.body;
	rowElement.append(bodyElement);

	return rowElement;
}

function selectRange(initialiseRange: (range: Range) => void): void {
	const range = document.createRange();
	initialiseRange(range);
	const selection = window.getSelection();
	if (!selection) {
		throw new Error('Selection is not available.');
	}

	selection.removeAllRanges();
	selection.addRange(range);
}
