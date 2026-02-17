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

import * as ContextMenuActionCreators from '@app/actions/ContextMenuActionCreators';
import {TextualAttachmentCodePanel} from '@app/components/channel/embeds/attachments/TextualAttachmentCodePanel';
import styles from '@app/components/channel/embeds/attachments/TextualAttachmentPreview.module.css';
import {TextualAttachmentPreviewBottomSheet} from '@app/components/channel/embeds/attachments/TextualAttachmentPreviewBottomSheet';
import {TextualAttachmentPreviewFooter} from '@app/components/channel/embeds/attachments/TextualAttachmentPreviewFooter';
import {TextualAttachmentPreviewModal} from '@app/components/channel/embeds/attachments/TextualAttachmentPreviewModal';
import {
	DEFAULT_PREVIEW_LINES,
	getAttachmentFileName,
	getInitialSelectedLanguage,
	getLineCount,
	getVisibleLineCount,
	highlightTextContent,
	inferLanguageCodeFromAttachment,
	MAX_EXPANDED_PREVIEW_LINES,
	type PreviewError,
	type PreviewStatus,
	previewExpansionState,
	type TextualAttachmentPreviewProps,
} from '@app/components/channel/embeds/attachments/TextualAttachmentPreviewUtils';
import {TextualPreviewContextMenu} from '@app/components/channel/embeds/attachments/TextualPreviewContextMenu';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import TextualPreviewStore from '@app/stores/TextualPreviewStore';
import {shouldPreviewAttachment, TEXT_PREVIEW_MAX_BYTES} from '@app/utils/AttachmentPreviewUtils';
import {downloadFile} from '@app/utils/FileDownloadUtils';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {type MouseEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';

export const TextualAttachmentPreview = observer(function TextualAttachmentPreview({
	attachment,
}: TextualAttachmentPreviewProps) {
	const {i18n} = useLingui();
	const previewRootRef = useRef<HTMLDivElement | null>(null);
	const shouldShowPreview = shouldPreviewAttachment(attachment);
	const inferredLanguageCode = useMemo(
		() => inferLanguageCodeFromAttachment(attachment),
		[attachment.content_type, attachment.filename, attachment.title],
	);
	const initialSelectedLanguage = useMemo(
		() => getInitialSelectedLanguage(attachment, inferredLanguageCode),
		[attachment, inferredLanguageCode],
	);
	const [selectedLanguage, setSelectedLanguage] = useState(initialSelectedLanguage);
	const [isExpanded, setIsExpanded] = useState(() => previewExpansionState.get(attachment.id) ?? false);
	const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
	const [status, setStatus] = useState<PreviewStatus>('idle');
	const [previewError, setPreviewError] = useState<PreviewError | null>(null);
	const [textContent, setTextContent] = useState<string | null>(null);

	useEffect(() => {
		setSelectedLanguage(getInitialSelectedLanguage(attachment, inferLanguageCodeFromAttachment(attachment)));
		setTextContent(null);
		setStatus('idle');
		setPreviewError(null);
		setIsExpanded(previewExpansionState.get(attachment.id) ?? false);
		setIsFullscreenOpen(false);
	}, [attachment.id]);

	useEffect(() => {
		if (!attachment.url) {
			setStatus('error');
			setPreviewError({type: 'network'});
			return;
		}

		if (attachment.size && attachment.size > TEXT_PREVIEW_MAX_BYTES) {
			setStatus('error');
			setPreviewError({type: 'size'});
			return;
		}

		setStatus('loading');
		setPreviewError(null);
		const controller = new AbortController();

		fetch(attachment.url, {signal: controller.signal})
			.then((response) => {
				if (!response.ok) {
					throw new Error(response.statusText || 'Failed to load preview');
				}
				return response.text();
			})
			.then((value) => {
				if (controller.signal.aborted) {
					return;
				}
				setTextContent(value);
				setStatus('loaded');
			})
			.catch((error) => {
				if (controller.signal.aborted) {
					return;
				}
				setStatus('error');
				setPreviewError({type: 'network', message: error?.message ?? 'Failed to load preview'});
			});

		return () => controller.abort();
	}, [attachment.id, attachment.size, attachment.url]);

	useLayoutEffect(() => {
		const previewRoot = previewRootRef.current;
		if (!previewRoot) {
			return;
		}

		let previousHeight = previewRoot.getBoundingClientRect().height;

		const observer = new ResizeObserver(() => {
			const nextHeight = previewRoot.getBoundingClientRect().height;
			const heightDelta = nextHeight - previousHeight;
			if (Math.abs(heightDelta) < 0.5) {
				return;
			}

			previousHeight = nextHeight;
			ComponentDispatch.dispatch('LAYOUT_RESIZED', {heightDelta});
		});

		observer.observe(previewRoot);

		return () => {
			observer.disconnect();
		};
	}, []);

	const lineCount = useMemo(() => getLineCount(textContent), [textContent]);
	const canExpand = lineCount > DEFAULT_PREVIEW_LINES;
	const inlinePreviewTextContent = useMemo(() => {
		if (!isExpanded || textContent == null) {
			return textContent;
		}

		const lines = textContent.split(/\r\n|\r|\n/);
		if (lines.length <= MAX_EXPANDED_PREVIEW_LINES) {
			return textContent;
		}

		const remainingLineCount = lines.length - MAX_EXPANDED_PREVIEW_LINES;
		const remainingLinesLabel =
			remainingLineCount === 1
				? i18n._(msg`... (${remainingLineCount} line left)`)
				: i18n._(msg`... (${remainingLineCount} lines left)`);
		return [...lines.slice(0, MAX_EXPANDED_PREVIEW_LINES), remainingLinesLabel].join('\n');
	}, [i18n, isExpanded, textContent]);
	const inlinePreviewLineCount = useMemo(() => getLineCount(inlinePreviewTextContent), [inlinePreviewTextContent]);
	const visibleLineCount = useMemo(() => {
		if (!isExpanded) {
			return getVisibleLineCount(lineCount, isExpanded);
		}

		return Math.max(inlinePreviewLineCount, 1);
	}, [inlinePreviewLineCount, isExpanded, lineCount]);

	useEffect(() => {
		if (!canExpand && isExpanded) {
			setIsExpanded(false);
		}
	}, [canExpand, isExpanded]);

	useEffect(() => {
		previewExpansionState.set(attachment.id, canExpand ? isExpanded : false);
	}, [attachment.id, canExpand, isExpanded]);

	const highlightedHtml = useMemo(
		() => highlightTextContent(selectedLanguage, inlinePreviewTextContent),
		[inlinePreviewTextContent, selectedLanguage],
	);
	const fullscreenHighlightedHtml = useMemo(
		() => highlightTextContent(selectedLanguage, textContent),
		[selectedLanguage, textContent],
	);

	const toggleExpanded = useCallback(() => {
		setIsExpanded((current) => !current);
	}, []);

	const handleDownload = useCallback(async () => {
		if (!attachment.url) {
			return;
		}
		await downloadFile(attachment.url, 'file', getAttachmentFileName(attachment) || 'file');
	}, [attachment]);

	const handleContextMenu = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			event.preventDefault();
			event.stopPropagation();

			ContextMenuActionCreators.openFromEvent(event, () => (
				<TextualPreviewContextMenu
					onDownload={handleDownload}
					onToggleWrapText={TextualPreviewStore.toggleWrapText}
					wrapText={TextualPreviewStore.wrapText}
				/>
			));
		},
		[handleDownload],
	);

	const handleOpenFullscreen = useCallback(() => {
		setIsFullscreenOpen(true);
	}, []);

	const handleCloseFullscreen = useCallback(() => {
		setIsFullscreenOpen(false);
	}, []);

	const handleSelectLanguage = useCallback((languageCode: string) => {
		setSelectedLanguage(languageCode);
	}, []);

	if (!shouldShowPreview) {
		return null;
	}

	const isMobile = MobileLayoutStore.isMobileLayout();
	const FullscreenComponent = isMobile ? TextualAttachmentPreviewBottomSheet : TextualAttachmentPreviewModal;

	return (
		<>
			<div ref={previewRootRef} className={styles.textualPreview}>
				<TextualAttachmentCodePanel
					canExpand={canExpand}
					highlightedHtml={highlightedHtml}
					isExpanded={isExpanded}
					previewError={previewError}
					status={status}
					textContent={inlinePreviewTextContent}
					visibleLineCount={visibleLineCount}
					wrapText={TextualPreviewStore.wrapText}
					wrapperClassName={styles.inlinePreviewSurface}
				/>
				<TextualAttachmentPreviewFooter
					attachment={attachment}
					canExpand={canExpand}
					inferredLanguageCode={inferredLanguageCode}
					isExpanded={isExpanded}
					lineCount={lineCount}
					onMoreOptions={handleContextMenu}
					onOpenFullscreen={handleOpenFullscreen}
					onSelectLanguage={handleSelectLanguage}
					onToggleExpanded={toggleExpanded}
					selectedLanguage={selectedLanguage}
				/>
			</div>
			{isFullscreenOpen && (
				<FullscreenComponent
					attachment={attachment}
					highlightedHtml={fullscreenHighlightedHtml}
					inferredLanguageCode={inferredLanguageCode}
					onClose={handleCloseFullscreen}
					onMoreOptions={handleContextMenu}
					onSelectLanguage={handleSelectLanguage}
					previewError={previewError}
					selectedLanguage={selectedLanguage}
					status={status}
					textContent={textContent}
					wrapText={TextualPreviewStore.wrapText}
				/>
			)}
		</>
	);
});
