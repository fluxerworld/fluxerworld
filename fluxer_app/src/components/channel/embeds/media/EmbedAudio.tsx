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
import {deriveDefaultNameFromMessage} from '@app/components/channel/embeds/EmbedUtils';
import styles from '@app/components/channel/embeds/media/EmbedAudio.module.css';
import {getMediaButtonVisibility} from '@app/components/channel/embeds/media/MediaButtonUtils';
import type {BaseMediaProps} from '@app/components/channel/embeds/media/MediaTypes';
import {InlineAudioPlayer} from '@app/components/media_player/components/InlineAudioPlayer';
import {MediaContextMenu} from '@app/components/uikit/context_menu/MediaContextMenu';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useDeleteAttachment} from '@app/hooks/useDeleteAttachment';
import {useMediaFavorite} from '@app/hooks/useMediaFavorite';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import messageStyles from '@app/styles/Message.module.css';
import {createSaveHandler} from '@app/utils/FileDownloadUtils';
import {buildMediaProxyURL} from '@app/utils/MediaProxyUtils';
import type {MessageAttachment} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {useLingui} from '@lingui/react/macro';
import {TrashIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import {type FC, useCallback} from 'react';

type EmbedAudioProps = BaseMediaProps & {
	src: string;
	title?: string;
	duration?: number;
	embedUrl?: string;
	fileSize?: number;
	mediaAttachments?: ReadonlyArray<MessageAttachment>;
	isPreview?: boolean;
};

const EmbedAudio: FC<EmbedAudioProps> = observer(
	({
		src,
		title,
		duration: apiDuration,
		embedUrl,
		channelId,
		messageId,
		attachmentId,
		embedIndex,
		message,
		contentHash,
		onDelete,
		fileSize,
		isPreview,
	}) => {
		const {t} = useLingui();
		const effectiveSrc = buildMediaProxyURL(src);
		const {enabled: isMobile} = MobileLayoutStore;

		const defaultName =
			title || deriveDefaultNameFromMessage({message, attachmentId, embedIndex, url: embedUrl || src, proxyUrl: src});

		const {
			isFavorited,
			toggleFavorite: handleFavoriteClick,
			canFavorite,
		} = useMediaFavorite({
			channelId,
			messageId,
			attachmentId,
			embedIndex,
			defaultName,
			contentHash,
		});

		const handleContextMenu = useCallback(
			(e: React.MouseEvent) => {
				if (!message || isPreview) return;

				e.preventDefault();
				e.stopPropagation();

				ContextMenuActionCreators.openFromEvent(e, ({onClose}) => (
					<MediaContextMenu
						message={message}
						originalSrc={src}
						type="audio"
						contentHash={contentHash}
						attachmentId={attachmentId}
						defaultName={defaultName}
						onClose={onClose}
						onDelete={onDelete || (() => {})}
					/>
				));
			},
			[message, src, contentHash, attachmentId, defaultName, onDelete, isPreview],
		);

		const handleDownload = useCallback(
			(e: React.MouseEvent) => {
				e.preventDefault();
				e.stopPropagation();
				createSaveHandler(src, 'audio')();
			},
			[src],
		);

		const handleDeleteClick = useDeleteAttachment(message, attachmentId);

		const containerStyles: React.CSSProperties = isMobile
			? {
					display: 'grid',
					width: '100%',
					maxWidth: '100%',
					minWidth: 0,
				}
			: {
					display: 'grid',
					width: '100%',
					maxWidth: 'min(100%, 400px)',
					minWidth: 'min(400px, 100%)',
				};

		const {showDeleteButton, showDownloadButton} = getMediaButtonVisibility(
			canFavorite,
			isPreview ? undefined : message,
			attachmentId,
			{disableDelete: !!isPreview},
		);

		return (
			<div style={containerStyles} className={styles.container}>
				{showDeleteButton && (
					<Tooltip text={t`Delete`} position="top">
						<button
							type="button"
							onClick={handleDeleteClick}
							className={clsx(messageStyles.hoverAction, styles.deleteButton)}
							aria-label={t`Delete attachment`}
						>
							<TrashIcon size={16} weight="bold" />
						</button>
					</Tooltip>
				)}
				<InlineAudioPlayer
					src={effectiveSrc}
					title={defaultName}
					fileSize={fileSize}
					duration={apiDuration}
					isMobile={isMobile}
					isFavorited={isFavorited}
					canFavorite={canFavorite}
					onFavoriteClick={handleFavoriteClick}
					onDownloadClick={showDownloadButton ? handleDownload : undefined}
					onContextMenu={handleContextMenu}
				/>
			</div>
		);
	},
);

export default EmbedAudio;
