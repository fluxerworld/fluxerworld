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

import {TextualAttachmentCodePanel} from '@app/components/channel/embeds/attachments/TextualAttachmentCodePanel';
import styles from '@app/components/channel/embeds/attachments/TextualAttachmentPreviewBottomSheet.module.css';
import {
	getAttachmentFileName,
	getLineCount,
	type TextualAttachmentPreviewModalProps,
} from '@app/components/channel/embeds/attachments/TextualAttachmentPreviewUtils';
import {BottomSheet} from '@app/components/uikit/bottom_sheet/BottomSheet';
import {MenuBottomSheet, type MenuGroupType} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import TextualPreviewStore from '@app/stores/TextualPreviewStore';
import {downloadFile} from '@app/utils/FileDownloadUtils';
import {formatFileSize} from '@app/utils/FileUtils';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {DotsThreeIcon, DownloadSimpleIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useCallback, useMemo, useState} from 'react';

export const TextualAttachmentPreviewBottomSheet = observer(function TextualAttachmentPreviewBottomSheet({
	attachment,
	highlightedHtml,
	onClose,
	previewError,
	status,
	textContent,
	wrapText,
}: TextualAttachmentPreviewModalProps) {
	const {i18n} = useLingui();
	const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
	const lineCount = useMemo(() => getLineCount(textContent), [textContent]);
	const visibleLineCount = useMemo(() => Math.max(lineCount, 1), [lineCount]);
	const fileName = getAttachmentFileName(attachment);

	let fileSizeLabel = '';
	if (typeof attachment.size === 'number') {
		fileSizeLabel = formatFileSize(attachment.size);
	}

	const handleDownload = useCallback(async () => {
		if (!attachment.url) {
			return;
		}
		await downloadFile(attachment.url, 'file', fileName || 'file');
	}, [attachment.url, fileName]);

	const handleOpenMoreOptions = useCallback(() => {
		setMoreOptionsOpen(true);
	}, []);

	const handleCloseMoreOptions = useCallback(() => {
		setMoreOptionsOpen(false);
	}, []);

	const moreOptionsGroups = useMemo<Array<MenuGroupType>>(
		() => [
			{
				items: [
					{
						icon: <DownloadSimpleIcon size={20} />,
						label: i18n._(msg`Download`),
						onClick: handleDownload,
					},
					{
						icon: undefined,
						label: i18n._(msg`Wrap text`),
						checked: wrapText,
						onChange: TextualPreviewStore.toggleWrapText,
					},
				],
			},
		],
		[handleDownload, i18n, wrapText],
	);

	return (
		<>
			<BottomSheet
				isOpen
				onClose={onClose}
				snapPoints={[0, 1]}
				initialSnap={1}
				title={i18n._(msg`Attachment preview`)}
				disablePadding
			>
				<div className={styles.container}>
					<div className={styles.codeContainer}>
						<TextualAttachmentCodePanel
							canExpand
							fillAvailableSpace
							highlightedHtml={highlightedHtml}
							isExpanded
							previewError={previewError}
							status={status}
							textContent={textContent}
							visibleLineCount={visibleLineCount}
							wrapText={wrapText}
							wrapperClassName={styles.codeSurface}
						/>
					</div>
					<div className={styles.footer}>
						<div className={styles.fileSection}>
							<div className={styles.fileMeta}>
								<span className={styles.fileName}>{fileName}</span>
								{fileSizeLabel && <span className={styles.fileSize}>{fileSizeLabel}</span>}
							</div>
						</div>
						<div className={styles.footerActions}>
							<button
								type="button"
								className={styles.actionButton}
								onClick={handleDownload}
								aria-label={i18n._(msg`Download`)}
							>
								<DownloadSimpleIcon size={20} weight="regular" />
							</button>
							<button
								type="button"
								className={styles.actionButton}
								onClick={handleOpenMoreOptions}
								aria-label={i18n._(msg`More options`)}
							>
								<DotsThreeIcon size={20} weight="bold" />
							</button>
						</div>
					</div>
				</div>
			</BottomSheet>
			<MenuBottomSheet
				isOpen={moreOptionsOpen}
				onClose={handleCloseMoreOptions}
				title={i18n._(msg`Options`)}
				groups={moreOptionsGroups}
			/>
		</>
	);
});
