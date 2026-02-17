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

import {TextualAttachmentLanguagePopout} from '@app/components/channel/embeds/attachments/TextualAttachmentLanguagePopout';
import styles from '@app/components/channel/embeds/attachments/TextualAttachmentPreview.module.css';
import {
	getAttachmentFileName,
	type TextualAttachmentPreviewFooterProps,
} from '@app/components/channel/embeds/attachments/TextualAttachmentPreviewUtils';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Popout} from '@app/components/uikit/popout/Popout';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {formatFileSize} from '@app/utils/FileUtils';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {ArrowsOutIcon, CaretDownIcon, CodeIcon, DotsThreeIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';

export function TextualAttachmentPreviewFooter({
	attachment,
	canExpand,
	inferredLanguageCode,
	isExpanded,
	lineCount,
	onMoreOptions,
	onOpenFullscreen,
	onSelectLanguage,
	onToggleExpanded,
	selectedLanguage,
	showExpandButton = true,
}: TextualAttachmentPreviewFooterProps) {
	const {i18n} = useLingui();
	const fileName = getAttachmentFileName(attachment);
	let fileSizeLabel = '';
	if (typeof attachment.size === 'number') {
		fileSizeLabel = formatFileSize(attachment.size);
	}

	let expandButtonLabel = '';
	if (lineCount === 1) {
		expandButtonLabel = isExpanded ? i18n._(msg`Collapse (1 line)`) : i18n._(msg`Expand (1 line)`);
	} else {
		expandButtonLabel = isExpanded
			? i18n._(msg`Collapse (${lineCount} lines)`)
			: i18n._(msg`Expand (${lineCount} lines)`);
	}

	const languageButtonLabel = i18n._(msg`Change language`);
	const fullscreenButtonLabel = i18n._(msg`View whole file`);
	const moreButtonLabel = i18n._(msg`More options`);

	return (
		<div className={styles.footer}>
			{showExpandButton && canExpand && onToggleExpanded && (
				<Tooltip text={expandButtonLabel}>
					<FocusRing offset={-2}>
						<button
							type="button"
							className={styles.expandButton}
							onClick={onToggleExpanded}
							aria-label={expandButtonLabel}
							aria-expanded={isExpanded}
						>
							<CaretDownIcon
								size={18}
								weight="bold"
								className={clsx(styles.expandIcon, isExpanded && styles.expandIconExpanded)}
							/>
						</button>
					</FocusRing>
				</Tooltip>
			)}
			<div className={styles.fileSection}>
				<div className={styles.fileMeta}>
					<span className={styles.fileName}>{fileName}</span>
					{fileSizeLabel && <span className={styles.fileSize}>{fileSizeLabel}</span>}
				</div>
			</div>
			<div className={styles.footerActions}>
				<Popout
					position="top-end"
					offsetMainAxis={8}
					render={({onClose}) => (
						<TextualAttachmentLanguagePopout
							defaultSearchQuery={inferredLanguageCode}
							onClose={onClose}
							onSelectLanguage={onSelectLanguage}
							selectedLanguage={selectedLanguage}
						/>
					)}
				>
					<FocusRing offset={-2}>
						<button type="button" className={styles.controlButton} aria-label={languageButtonLabel}>
							<CodeIcon size={18} weight="regular" />
						</button>
					</FocusRing>
				</Popout>
				{onOpenFullscreen && (
					<Tooltip text={fullscreenButtonLabel}>
						<FocusRing offset={-2}>
							<button
								type="button"
								className={styles.controlButton}
								onClick={onOpenFullscreen}
								aria-label={fullscreenButtonLabel}
							>
								<ArrowsOutIcon size={18} weight="regular" />
							</button>
						</FocusRing>
					</Tooltip>
				)}
				<Tooltip text={moreButtonLabel}>
					<FocusRing offset={-2}>
						<button type="button" className={styles.controlButton} onClick={onMoreOptions} aria-label={moreButtonLabel}>
							<DotsThreeIcon size={18} weight="bold" />
						</button>
					</FocusRing>
				</Tooltip>
			</div>
		</div>
	);
}
