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

import {Logger} from '@app/lib/Logger';
import {getLanguageFromAttachment, TEXT_PREVIEW_MAX_BYTES} from '@app/utils/AttachmentPreviewUtils';
import type {MessageAttachment} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import highlight from 'highlight.js';
import type {CSSProperties, MouseEvent} from 'react';

const logger = new Logger('TextualAttachmentPreview');

export const PREVIEW_LIMIT_KB = TEXT_PREVIEW_MAX_BYTES / 1024;
export const DEFAULT_PREVIEW_LINES = 6;
export const MAX_EXPANDED_PREVIEW_LINES = 100;

export const previewExpansionState = new Map<string | number, boolean>();

export interface HighlightLanguageOption {
	canonicalCode: string;
	code: string;
}

export type PreviewError = {type: 'size'; message?: string} | {type: 'network'; message?: string};
export type PreviewStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface TextualAttachmentPreviewProps {
	attachment: MessageAttachment;
}

export interface TextualPreviewContextMenuProps {
	onDownload: () => void;
	onToggleWrapText: () => void;
	wrapText: boolean;
}

export interface TextualAttachmentLanguagePopoutProps {
	defaultSearchQuery: string;
	onClose: () => void;
	onSelectLanguage: (languageCode: string) => void;
	selectedLanguage: string;
}

export interface TextualAttachmentCodePanelProps {
	canExpand: boolean;
	fillAvailableSpace?: boolean;
	highlightedHtml: string;
	isExpanded: boolean;
	previewError: PreviewError | null;
	status: PreviewStatus;
	textContent: string | null;
	visibleLineCount: number;
	wrapText: boolean;
	wrapperClassName?: string;
}

export interface PreviewViewportStyle extends CSSProperties {
	'--preview-horizontal-scrollbar-size': string;
	'--preview-visible-lines': string;
}

export interface TextualAttachmentPreviewFooterProps {
	attachment: MessageAttachment;
	canExpand: boolean;
	inferredLanguageCode: string;
	isExpanded: boolean;
	lineCount: number;
	onMoreOptions: (event: MouseEvent<HTMLButtonElement>) => void;
	onOpenFullscreen?: () => void;
	onSelectLanguage: (languageCode: string) => void;
	onToggleExpanded?: () => void;
	selectedLanguage: string;
	showExpandButton?: boolean;
}

export interface TextualAttachmentPreviewModalProps {
	attachment: MessageAttachment;
	highlightedHtml: string;
	inferredLanguageCode: string;
	onClose: () => void;
	onMoreOptions: (event: MouseEvent<HTMLButtonElement>) => void;
	onSelectLanguage: (languageCode: string) => void;
	previewError: PreviewError | null;
	selectedLanguage: string;
	status: PreviewStatus;
	textContent: string | null;
	wrapText: boolean;
}

function buildHighlightLanguageOptions(): Array<HighlightLanguageOption> {
	const optionsMap = new Map<string, HighlightLanguageOption>();

	for (const canonicalCode of highlight.listLanguages()) {
		const languageDefinition = highlight.getLanguage(canonicalCode);
		const aliases = Array.isArray(languageDefinition?.aliases) ? languageDefinition.aliases : [];
		const codes = [canonicalCode, ...aliases];

		for (const candidateCode of codes) {
			const normalizedCode = candidateCode.trim().toLowerCase();
			if (!normalizedCode || optionsMap.has(normalizedCode)) {
				continue;
			}

			optionsMap.set(normalizedCode, {
				canonicalCode,
				code: normalizedCode,
			});
		}
	}

	if (!optionsMap.has('plaintext')) {
		optionsMap.set('plaintext', {
			canonicalCode: 'plaintext',
			code: 'plaintext',
		});
	}

	return Array.from(optionsMap.values()).sort((left, right) => left.code.localeCompare(right.code));
}

export const HIGHLIGHT_LANGUAGE_OPTIONS = buildHighlightLanguageOptions();
export const AUTO_HIGHLIGHT_LANGUAGES = highlight.listLanguages();

function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getAttachmentFileName(attachment: MessageAttachment): string {
	return attachment.filename ?? attachment.title ?? '';
}

function getFileExtension(fileName: string): string | null {
	const extension = fileName.split('.').pop()?.trim().toLowerCase();
	if (!extension) {
		return null;
	}
	return extension;
}

export function inferLanguageCodeFromAttachment(attachment: MessageAttachment): string {
	const fileName = getAttachmentFileName(attachment);
	const extensionCode = getFileExtension(fileName);
	if (extensionCode) {
		return extensionCode;
	}

	const mappedLanguage = getLanguageFromAttachment(attachment)?.trim().toLowerCase();
	if (mappedLanguage) {
		return mappedLanguage;
	}

	return 'plaintext';
}

export function getInitialSelectedLanguage(attachment: MessageAttachment, inferredLanguageCode: string): string {
	if (highlight.getLanguage(inferredLanguageCode)) {
		return inferredLanguageCode;
	}

	const mappedLanguage = getLanguageFromAttachment(attachment)?.trim().toLowerCase();
	if (mappedLanguage && highlight.getLanguage(mappedLanguage)) {
		return mappedLanguage;
	}

	return 'plaintext';
}

export function getLineCount(textContent: string | null): number {
	if (textContent == null || textContent.length === 0) {
		return 0;
	}
	return textContent.split(/\r\n|\r|\n/).length;
}

export function getVisibleLineCount(lineCount: number, isExpanded: boolean): number {
	if (!isExpanded) {
		return DEFAULT_PREVIEW_LINES;
	}

	if (lineCount <= 0) {
		return 1;
	}

	return Math.min(MAX_EXPANDED_PREVIEW_LINES, lineCount);
}

export function highlightTextContent(selectedLanguage: string, textContent: string | null): string {
	if (textContent == null || textContent.length === 0) {
		return '';
	}

	if (selectedLanguage === 'plaintext') {
		return escapeHtml(textContent);
	}

	if (selectedLanguage === 'auto') {
		try {
			return highlight.highlightAuto(textContent, AUTO_HIGHLIGHT_LANGUAGES).value;
		} catch (error) {
			logger.error('Highlight auto failed', error);
			return escapeHtml(textContent);
		}
	}

	if (highlight.getLanguage(selectedLanguage)) {
		try {
			return highlight.highlight(textContent, {
				ignoreIllegals: true,
				language: selectedLanguage,
			}).value;
		} catch (error) {
			logger.error('Highlight failed for selected language', error);
		}
	}

	return escapeHtml(textContent);
}
