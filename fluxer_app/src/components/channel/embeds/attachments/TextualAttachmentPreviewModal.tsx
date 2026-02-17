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
import styles from '@app/components/channel/embeds/attachments/TextualAttachmentPreview.module.css';
import {TextualAttachmentPreviewFooter} from '@app/components/channel/embeds/attachments/TextualAttachmentPreviewFooter';
import {
	getLineCount,
	type TextualAttachmentPreviewModalProps,
} from '@app/components/channel/embeds/attachments/TextualAttachmentPreviewUtils';
import * as Modal from '@app/components/modals/Modal';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useMemo} from 'react';

export const TextualAttachmentPreviewModal = observer(function TextualAttachmentPreviewModal({
	attachment,
	highlightedHtml,
	inferredLanguageCode,
	onClose,
	onMoreOptions,
	onSelectLanguage,
	previewError,
	selectedLanguage,
	status,
	textContent,
	wrapText,
}: TextualAttachmentPreviewModalProps) {
	const {i18n} = useLingui();
	const lineCount = useMemo(() => getLineCount(textContent), [textContent]);
	const visibleLineCount = useMemo(() => Math.max(lineCount, 1), [lineCount]);

	return (
		<Modal.Root size="fullscreen" onClose={onClose} className={styles.modalRoot}>
			<Modal.ScreenReaderLabel text={i18n._(msg`Attachment preview`)} />
			<div className={styles.modalLayout}>
				<div className={styles.modalBody}>
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
						wrapperClassName={styles.modalPreviewSurface}
					/>
				</div>
				<TextualAttachmentPreviewFooter
					attachment={attachment}
					canExpand={false}
					inferredLanguageCode={inferredLanguageCode}
					isExpanded
					lineCount={lineCount}
					onMoreOptions={onMoreOptions}
					onSelectLanguage={onSelectLanguage}
					selectedLanguage={selectedLanguage}
					showExpandButton={false}
				/>
			</div>
		</Modal.Root>
	);
});
