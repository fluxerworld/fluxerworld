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

import styles from '@app/components/channel/embeds/attachments/TextualAttachmentPreview.module.css';
import {
	PREVIEW_LIMIT_KB,
	type PreviewViewportStyle,
	type TextualAttachmentCodePanelProps,
} from '@app/components/channel/embeds/attachments/TextualAttachmentPreviewUtils';
import {Spinner} from '@app/components/uikit/Spinner';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {WarningCircleIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {useLayoutEffect, useMemo, useRef, useState} from 'react';

export function TextualAttachmentCodePanel({
	canExpand,
	fillAvailableSpace = false,
	highlightedHtml,
	isExpanded,
	previewError,
	status,
	textContent,
	visibleLineCount,
	wrapText,
	wrapperClassName,
}: TextualAttachmentCodePanelProps) {
	const {i18n} = useLingui();
	const hasLoadedText = textContent !== null;
	const viewportRef = useRef<HTMLDivElement | null>(null);
	const [horizontalScrollbarSize, setHorizontalScrollbarSize] = useState(0);

	useLayoutEffect(() => {
		const viewportNode = viewportRef.current;
		if (!viewportNode) {
			return;
		}

		const updateScrollbarSize = () => {
			if (wrapText) {
				setHorizontalScrollbarSize((currentSize) => (currentSize === 0 ? currentSize : 0));
				return;
			}

			const hasHorizontalOverflow = viewportNode.scrollWidth - viewportNode.clientWidth > 1;
			if (!hasHorizontalOverflow) {
				setHorizontalScrollbarSize((currentSize) => (currentSize === 0 ? currentSize : 0));
				return;
			}

			const measuredScrollbarSize = Math.max(viewportNode.offsetHeight - viewportNode.clientHeight, 0);
			const nextScrollbarSize = measuredScrollbarSize > 0 ? measuredScrollbarSize : 8;
			setHorizontalScrollbarSize((currentSize) =>
				currentSize === nextScrollbarSize ? currentSize : nextScrollbarSize,
			);
		};

		updateScrollbarSize();
		const observer = new ResizeObserver(updateScrollbarSize);
		observer.observe(viewportNode);

		const codeBlockNode = viewportNode.querySelector('pre');
		if (codeBlockNode) {
			observer.observe(codeBlockNode);
		}

		return () => {
			observer.disconnect();
		};
	}, [highlightedHtml, isExpanded, visibleLineCount, wrapText]);

	const viewportStyle = useMemo<PreviewViewportStyle>(
		() => ({
			'--preview-horizontal-scrollbar-size': `${horizontalScrollbarSize}px`,
			'--preview-visible-lines': `${Math.max(visibleLineCount, 1)}`,
		}),
		[horizontalScrollbarSize, visibleLineCount],
	);

	if (status === 'error') {
		return (
			<div className={clsx(styles.previewSurface, wrapperClassName)} aria-live="polite">
				<div className={styles.previewError}>
					<WarningCircleIcon size={16} weight="bold" />
					<span>
						{previewError?.type === 'size'
							? i18n._(msg`File is too large for inline preview (limit ${PREVIEW_LIMIT_KB} KB).`)
							: i18n._(msg`Unable to load preview.`)}
						{previewError?.type === 'network' && previewError.message ? ` ${previewError.message}` : ''}
					</span>
				</div>
			</div>
		);
	}

	if (!hasLoadedText) {
		return (
			<div className={clsx(styles.previewSurface, wrapperClassName)} aria-live="polite">
				<div className={styles.loadingState}>
					<Spinner size="small" />
				</div>
			</div>
		);
	}

	return (
		<div className={clsx(styles.previewSurface, wrapperClassName)} aria-live="polite">
			<div
				ref={viewportRef}
				className={clsx(
					styles.previewViewport,
					(isExpanded && canExpand) || fillAvailableSpace
						? styles.previewViewportExpanded
						: styles.previewViewportCollapsed,
					fillAvailableSpace && styles.previewViewportFill,
				)}
				style={viewportStyle}
			>
				<pre
					className={clsx(
						styles.previewCode,
						wrapText && styles.previewCodeWrap,
						fillAvailableSpace && styles.previewCodeFill,
					)}
				>
					<code className="hljs" dangerouslySetInnerHTML={{__html: highlightedHtml}} />
				</pre>
			</div>
		</div>
	);
}
