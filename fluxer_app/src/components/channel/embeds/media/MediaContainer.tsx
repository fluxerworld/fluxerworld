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

import mediaStyles from '@app/components/channel/embeds/media/MediaContainer.module.css';
import {LongPressable} from '@app/components/LongPressable';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import {useLingui} from '@lingui/react/macro';
import {DownloadSimpleIcon, StarIcon, TrashIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import {forwardRef, type ReactNode} from 'react';

const MIN_SIZE_FOR_OVERLAYS = 120;

export const shouldShowOverlays = (renderedWidth?: number, renderedHeight?: number): boolean => {
	if (renderedWidth === undefined || renderedHeight === undefined) {
		return true;
	}
	return renderedWidth >= MIN_SIZE_FOR_OVERLAYS && renderedHeight >= MIN_SIZE_FOR_OVERLAYS;
};

type LongPressEvent = React.PointerEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>;

interface MediaContainerProps {
	children: ReactNode;
	className?: string;
	style?: React.CSSProperties;
	showFavoriteButton?: boolean;
	isFavorited?: boolean;
	onFavoriteClick?: (e: React.MouseEvent) => void;
	showDownloadButton?: boolean;
	onDownloadClick?: (e: React.MouseEvent) => void;
	showDeleteButton?: boolean;
	onDeleteClick?: (e: React.MouseEvent) => void;
	onContextMenu?: (e: React.MouseEvent) => void;
	onMouseEnter?: (e: React.MouseEvent) => void;
	onMouseLeave?: (e: React.MouseEvent) => void;
	onLongPress?: (e: LongPressEvent) => void;
	renderedWidth?: number;
	renderedHeight?: number;
	forceShowFavoriteButton?: boolean;
}

export const MediaContainer = observer(
	forwardRef<HTMLDivElement, MediaContainerProps>(
		(
			{
				children,
				className,
				style,
				showFavoriteButton = false,
				isFavorited = false,
				onFavoriteClick,
				showDownloadButton = false,
				onDownloadClick,
				showDeleteButton = false,
				onDeleteClick,
				onContextMenu,
				onMouseEnter,
				onMouseLeave,
				onLongPress,
				renderedWidth,
				renderedHeight,
				forceShowFavoriteButton = false,
			},
			ref,
		) => {
			const {t} = useLingui();
			const isMobileLayout = MobileLayoutStore.isMobileLayout();

			const handleDownloadClick = (e: React.MouseEvent) => {
				e.stopPropagation();
				onDownloadClick?.(e);
			};

			const handleDeleteClick = (e: React.MouseEvent) => {
				e.stopPropagation();
				onDeleteClick?.(e);
			};

			const isMediaTooSmall =
				renderedWidth !== undefined &&
				renderedHeight !== undefined &&
				(renderedWidth < MIN_SIZE_FOR_OVERLAYS || renderedHeight < MIN_SIZE_FOR_OVERLAYS);

			const shouldShowFavorite = showFavoriteButton && (forceShowFavoriteButton || !isMediaTooSmall);
			const shouldShowDownload = showDownloadButton && !isMediaTooSmall;
			const shouldShowDelete = showDeleteButton && !isMediaTooSmall;

			const hasAnyButton = shouldShowFavorite || shouldShowDownload || shouldShowDelete;

			const useLongPress = isMobileLayout && onLongPress;

			const content = (
				<>
					{hasAnyButton && (
						<div className={mediaStyles.mediaHoverAction}>
							{shouldShowDelete && onDeleteClick && (
								<Tooltip text={t`Delete`} position="top">
									<button
										type="button"
										onClick={handleDeleteClick}
										className={`${mediaStyles.actionButton} ${mediaStyles.deleteButton}`}
										aria-label={t`Delete attachment`}
									>
										<TrashIcon size={18} weight="bold" className={mediaStyles.actionIcon} />
									</button>
								</Tooltip>
							)}
							{shouldShowDownload && onDownloadClick && (
								<Tooltip text={t`Download`} position="top">
									<button
										type="button"
										onClick={handleDownloadClick}
										className={mediaStyles.actionButton}
										aria-label={t`Download media`}
									>
										<DownloadSimpleIcon size={18} weight="bold" className={mediaStyles.actionIcon} />
									</button>
								</Tooltip>
							)}
							{shouldShowFavorite && onFavoriteClick && (
								<Tooltip text={isFavorited ? t`Remove from favorites` : t`Add to favorites`} position="top">
									<button
										type="button"
										onClick={onFavoriteClick}
										className={clsx(mediaStyles.actionButton, isFavorited && mediaStyles.favoriteButtonActive)}
										aria-label={isFavorited ? t`Remove from favorites` : t`Add to favorites`}
									>
										<StarIcon size={18} weight={isFavorited ? 'fill' : 'bold'} className={mediaStyles.actionIcon} />
									</button>
								</Tooltip>
							)}
						</div>
					)}
					{children}
				</>
			);

			if (useLongPress) {
				return (
					<LongPressable
						ref={ref}
						className={clsx(mediaStyles.mediaContainer, className)}
						style={style}
						onContextMenu={onContextMenu}
						onMouseEnter={onMouseEnter}
						onMouseLeave={onMouseLeave}
						onLongPress={onLongPress}
					>
						{content}
					</LongPressable>
				);
			}

			return (
				// biome-ignore lint/a11y/noStaticElementInteractions: This container wraps interactive media elements
				<div
					ref={ref}
					className={clsx(mediaStyles.mediaContainer, className)}
					style={style}
					onContextMenu={onContextMenu}
					onMouseEnter={onMouseEnter}
					onMouseLeave={onMouseLeave}
				>
					{content}
				</div>
			);
		},
	),
);
