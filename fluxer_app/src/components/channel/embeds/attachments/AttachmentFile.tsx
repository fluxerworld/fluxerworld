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
import {TextualAttachmentPreview} from '@app/components/channel/embeds/attachments/TextualAttachmentPreview';
import {splitFilename} from '@app/components/channel/embeds/EmbedUtils';
import {canDeleteAttachmentUtil} from '@app/components/channel/MessageActionUtils';
import {useMaybeMessageViewContext} from '@app/components/channel/MessageViewContext';
import {MediaContextMenu} from '@app/components/uikit/context_menu/MediaContextMenu';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useDeleteAttachment} from '@app/hooks/useDeleteAttachment';
import type {MessageRecord} from '@app/records/MessageRecord';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import attachmentFileStyles from '@app/styles/AttachmentFile.module.css';
import messageStyles from '@app/styles/Message.module.css';
import {shouldPreviewAttachment} from '@app/utils/AttachmentPreviewUtils';
import {downloadFile} from '@app/utils/FileDownloadUtils';
import {formatFileSize} from '@app/utils/FileUtils';
import type {MessageAttachment} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {useLingui} from '@lingui/react/macro';
import {
	DownloadSimpleIcon,
	FileArchiveIcon,
	FileAudioIcon,
	FileCodeIcon,
	FileIcon,
	FileImageIcon,
	FilePdfIcon,
	FilePptIcon,
	FileTextIcon,
	FileVideoIcon,
	FileXlsIcon,
	TrashIcon,
	WarningCircleIcon,
} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';

interface AttachmentFileProps {
	attachment: MessageAttachment;
	isPreview?: boolean;
	message?: MessageRecord;
}

export const AttachmentFile = observer(({attachment, message, isPreview}: AttachmentFileProps) => {
	const {t} = useLingui();
	const {enabled: isMobile} = MobileLayoutStore;
	const isExpired = Boolean(attachment.expired);
	const fileName = attachment.title || attachment.filename;
	const fileSize = formatFileSize(attachment.size);
	const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

	const {name: fileNameWithoutExt, extension: fileExt} = splitFilename(fileName);
	const showTextPreview = !isPreview && shouldPreviewAttachment(attachment);

	const getFileTypeIcon = () => {
		const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
		const textTypes = ['txt', 'rtf', 'md', 'log'];
		const archiveTypes = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'];
		const audioTypes = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma'];
		const videoTypes = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv'];
		const codeTypes = [
			'js',
			'jsx',
			'ts',
			'tsx',
			'py',
			'java',
			'c',
			'cpp',
			'h',
			'css',
			'html',
			'json',
			'xml',
			'yml',
			'yaml',
			'sh',
			'go',
			'rs',
			'rb',
			'php',
		];
		const excelTypes = ['xls', 'xlsx', 'csv'];
		const presentationTypes = ['ppt', 'pptx'];
		const documentTypes = ['doc', 'docx'];

		if (imageTypes.includes(fileExtension)) return <FileImageIcon size={32} />;
		if (fileExtension === 'pdf') return <FilePdfIcon size={32} />;
		if (textTypes.includes(fileExtension)) return <FileTextIcon size={32} />;
		if (documentTypes.includes(fileExtension)) return <FileTextIcon size={32} />;
		if (archiveTypes.includes(fileExtension)) return <FileArchiveIcon size={32} />;
		if (audioTypes.includes(fileExtension)) return <FileAudioIcon size={32} />;
		if (videoTypes.includes(fileExtension)) return <FileVideoIcon size={32} />;
		if (codeTypes.includes(fileExtension)) return <FileCodeIcon size={32} />;
		if (excelTypes.includes(fileExtension)) return <FileXlsIcon size={32} />;
		if (presentationTypes.includes(fileExtension)) return <FilePptIcon size={32} />;

		return <FileIcon size={32} />;
	};

	let containerStyles: React.CSSProperties;
	if (isMobile) {
		containerStyles = {
			display: 'grid',
			width: '100%',
			maxWidth: '100%',
			minWidth: 0,
		};
	} else if (showTextPreview) {
		containerStyles = {
			display: 'grid',
			width: '100%',
			maxWidth: '50vw',
			minWidth: 0,
		};
	} else {
		containerStyles = {
			display: 'grid',
			width: '100%',
			maxWidth: '400px',
			minWidth: 'min(400px, 100%)',
		};
	}

	const handleDownload = async (e: React.MouseEvent) => {
		e.preventDefault();
		if (!attachment.url || isExpired) return;
		await downloadFile(attachment.url, 'file', fileName);
	};

	const handleDelete = useDeleteAttachment(message, attachment.id);
	const canDelete = canDeleteAttachmentUtil(message) && !isMobile;
	const showDeleteButton = canDelete && !isPreview;
	const messageViewContext = useMaybeMessageViewContext();

	const handleContextMenu = (e: React.MouseEvent) => {
		if (!message || isPreview) return;
		e.preventDefault();
		e.stopPropagation();

		ContextMenuActionCreators.openFromEvent(e, ({onClose}) => (
			<MediaContextMenu
				message={message}
				originalSrc={attachment.url ?? ''}
				proxyURL={attachment.proxy_url ?? undefined}
				type="file"
				contentHash={attachment.content_hash}
				attachmentId={attachment.id}
				defaultName={attachment.filename}
				defaultAltText={attachment.filename}
				onClose={onClose}
				onDelete={isPreview ? () => {} : (messageViewContext?.handleDelete ?? (() => {}))}
			/>
		));
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: context menu on container is intentional
		<div style={containerStyles} className={attachmentFileStyles.container} onContextMenu={handleContextMenu}>
			{showDeleteButton && (
				<button
					type="button"
					onClick={handleDelete}
					className={clsx(messageStyles.hoverAction, attachmentFileStyles.deleteButton)}
					aria-label={t`Delete attachment`}
				>
					<TrashIcon size={16} weight="bold" />
				</button>
			)}
			{showTextPreview ? (
				<TextualAttachmentPreview attachment={attachment} />
			) : (
				<div className={attachmentFileStyles.attachmentContainer}>
					<div className={attachmentFileStyles.iconContainer}>{getFileTypeIcon()}</div>
					<div className={attachmentFileStyles.fileInfoContainer}>
						<p className={attachmentFileStyles.fileName}>
							<span className={attachmentFileStyles.fileNameTruncate}>{fileNameWithoutExt}</span>
							<span className={attachmentFileStyles.fileExtension}>{fileExt}</span>
						</p>
						<p className={attachmentFileStyles.fileSize}>{fileSize}</p>
					</div>
					{isExpired ? (
						<Tooltip text={t`Attachment expired`}>
							<div className={clsx(attachmentFileStyles.downloadButton, attachmentFileStyles.downloadButtonDisabled)}>
								<WarningCircleIcon size={20} weight="bold" />
							</div>
						</Tooltip>
					) : (
						<button
							type="button"
							onClick={handleDownload}
							className={attachmentFileStyles.downloadButton}
							aria-label={t`Download`}
							disabled={!attachment.url}
						>
							<DownloadSimpleIcon size={20} weight="bold" />
						</button>
					)}
				</div>
			)}
		</div>
	);
});
