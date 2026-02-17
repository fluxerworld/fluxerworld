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

import * as ExpressionPickerActionCreators from '@app/actions/ExpressionPickerActionCreators';
import * as FavoriteMemeActionCreators from '@app/actions/FavoriteMemeActionCreators';
import * as GifActionCreators from '@app/actions/GifActionCreators';
import styles from '@app/components/channel/GifPicker.module.css';
import {useGifVideoPool} from '@app/components/channel/GifVideoPool';
import type {GifPickerGridItemData} from '@app/components/channel/pickers/gif/GifPickerTypes';
import {usePooledVideo} from '@app/components/channel/pickers/shared/usePooledVideo';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import FavoriteMemeStore from '@app/stores/FavoriteMemeStore';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import * as FavoriteMemeUtils from '@app/utils/FavoriteMemeUtils';
import * as KlipyUtils from '@app/utils/KlipyUtils';
import * as TenorUtils from '@app/utils/TenorUtils';
import {useLingui} from '@lingui/react/macro';
import {StarIcon, TrendUpIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import type React from 'react';
import {useCallback, useRef, useState} from 'react';

const VIDEO_FILE_EXTENSION_REGEX = /\.(mp4|webm|mov|m4v)(?:$|\?)/iu;

function isVideoSourceUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return VIDEO_FILE_EXTENSION_REGEX.test(url.pathname);
	} catch {
		return VIDEO_FILE_EXTENSION_REGEX.test(value);
	}
}

export function GifPickerGridItem({
	item,
	coords,
	onClose,
	autoSendKlipyGifs,
	gifAutoPlay,
	searchTerm,
	onShowTrending,
	onSearchCategory,
	isFocused = false,
	itemKey,
}: {
	item: GifPickerGridItemData;
	coords: {
		position: 'absolute' | 'sticky';
		left?: number;
		right?: number;
		width: number;
		top?: number;
		height: number;
	};
	onClose?: () => void;
	autoSendKlipyGifs: boolean;
	gifAutoPlay: boolean;
	searchTerm: string;
	onShowTrending: () => void;
	onSearchCategory: (term: string) => void;
	isFocused?: boolean;
	itemKey?: string;
}) {
	const {t, i18n} = useLingui();
	const [isFavoritePending, setIsFavoritePending] = useState(false);

	const videoPool = useGifVideoPool();
	const videoContainerRef = useRef<HTMLDivElement>(null);

	const isSkeleton = item.type === 'skeleton';

	const proxySrc = (() => {
		if (item.type === 'gif') return item.gif.proxy_src;
		if (item.type === 'category') return item.previewProxySrc;
		return null;
	})();
	const mediaSourceUrl = (() => {
		if (item.type === 'gif') return item.gif.src;
		if (item.type === 'category') return item.previewUrl;
		return null;
	})();
	const usesVideoElement = !isSkeleton && mediaSourceUrl !== null && isVideoSourceUrl(mediaSourceUrl);

	const videoRef = usePooledVideo({
		src: usesVideoElement ? proxySrc : null,
		containerRef: videoContainerRef,
		videoPool,
		autoPlay: gifAutoPlay,
		enabled: usesVideoElement,
	});

	const playOnHover = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (event.pointerType !== 'mouse') return;
			videoRef.current?.play().catch(() => {});
		},
		[videoRef],
	);

	const stopOnHoverEnd = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (event.pointerType !== 'mouse') return;
			const v = videoRef.current;
			if (!v) return;
			v.pause();
			try {
				v.currentTime = 0;
			} catch {}
		},
		[videoRef],
	);

	const handleClick = useCallback(
		(event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => {
			if (isSkeleton) return;

			if (item.type === 'category') {
				if (item.id === 'favorites') {
					ExpressionPickerActionCreators.setTab('memes');
				} else if (item.id === 'trending') {
					onShowTrending();
				} else {
					onSearchCategory(item.id);
				}
				return;
			}

			const gif = item.gif;
			const provider = RuntimeConfigStore.gifProvider;
			const shareId = provider === 'klipy' ? (KlipyUtils.extractKlipySlug(gif.url) ?? gif.id) : gif.id;
			if (!shareId) return;

			GifActionCreators.registerShare(shareId, searchTerm);
			const shiftKey = 'shiftKey' in event ? event.shiftKey : false;

			const shareUrl =
				provider === 'klipy'
					? KlipyUtils.resolveKlipyShareUrl({
							url: gif.url,
							fallbackSlug: shareId,
						})
					: gif.url;

			ComponentDispatch.dispatch('GIF_SELECT', {
				gif: {
					...gif,
					id: shareId,
					url: shareUrl,
				},
				autoSend: autoSendKlipyGifs && !shiftKey,
			});

			if (!shiftKey) onClose?.();
		},
		[autoSendKlipyGifs, isSkeleton, item, onClose, onSearchCategory, onShowTrending, searchTerm],
	);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			handleClick(event);
		},
		[handleClick],
	);

	const hoverPlaybackHandlers = gifAutoPlay
		? null
		: {
				onPointerEnter: playOnHover,
				onPointerLeave: stopOnHoverEnd,
			};

	if (isSkeleton) {
		return (
			<div
				className={clsx(styles.gridItem, styles.skeletonItem, isFocused && styles.gridItemFocused)}
				style={coords}
				data-grid-item={itemKey}
			>
				<div className={styles.gifMediaContainer}>
					<div className={styles.gifVideoContainer} />
				</div>
			</div>
		);
	}

	if (item.type === 'category') {
		let icon: React.ReactNode = null;
		let categoryClassName = styles.gridItemCategory;

		if (item.id === 'favorites') {
			icon = <StarIcon className={styles.gridItemIcon} />;
			categoryClassName = clsx(styles.gridItemCategory, styles.gridItemFavorites);
		} else if (item.id === 'trending') {
			icon = <TrendUpIcon className={styles.gridItemIcon} />;
		}

		return (
			<div
				role="button"
				tabIndex={0}
				className={clsx(styles.gridItem, categoryClassName, isFocused && styles.gridItemFocused)}
				onClick={handleClick}
				onKeyDown={handleKeyDown}
				style={coords}
				data-grid-item={itemKey}
				{...(hoverPlaybackHandlers ?? {})}
			>
				<div className={styles.gifMediaContainer}>
					{usesVideoElement ? (
						<div ref={videoContainerRef} className={styles.gifVideoContainer} />
					) : (
						<img className={styles.gif} src={proxySrc ?? ''} alt="" loading="lazy" />
					)}
				</div>
				<div className={styles.gridItemBackdrop} />
				<div className={styles.gridItemCategoryTitle}>
					{icon}
					<div className={styles.gridItemCategoryTitleText}>{item.title}</div>
				</div>
			</div>
		);
	}

	const gif = item.gif;
	const provider = RuntimeConfigStore.gifProvider;
	const normalizedKlipySlug = provider === 'klipy' ? (KlipyUtils.extractKlipySlug(gif.url) ?? gif.id) : null;
	const tenorSlugId = provider === 'tenor' ? TenorUtils.extractTenorSlugId(gif.url) : null;
	const favoriteMemes = FavoriteMemeStore.memes;
	const isFavorited =
		provider === 'klipy'
			? FavoriteMemeUtils.isFavoritedByKlipySlug(favoriteMemes, normalizedKlipySlug) ||
				(normalizedKlipySlug !== gif.id && FavoriteMemeUtils.isFavoritedByKlipySlug(favoriteMemes, gif.id))
			: FavoriteMemeUtils.isFavoritedByTenorSlugId(favoriteMemes, tenorSlugId);

	const handleFavoriteClick = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (isFavoritePending) return;

		setIsFavoritePending(true);
		try {
			if (isFavorited) {
				const meme =
					provider === 'klipy'
						? (FavoriteMemeUtils.findFavoritedMeme(favoriteMemes, {klipySlug: normalizedKlipySlug}) ??
							(normalizedKlipySlug !== gif.id
								? FavoriteMemeUtils.findFavoritedMeme(favoriteMemes, {klipySlug: gif.id})
								: null))
						: FavoriteMemeUtils.findFavoritedMeme(favoriteMemes, {tenorSlugId});
				if (meme) {
					await FavoriteMemeActionCreators.deleteFavoriteMeme(i18n, meme.id);
				}
			} else {
				const defaultName = FavoriteMemeUtils.deriveDefaultNameFromEmbedMedia(i18n, {
					url: gif.url,
					proxy_url: gif.proxy_src,
					flags: 0,
				});

				await FavoriteMemeActionCreators.createFavoriteMemeFromUrl(i18n, {
					url: gif.proxy_src,
					name: defaultName || gif.title,
					klipySlug: provider === 'klipy' ? (normalizedKlipySlug ?? undefined) : undefined,
					tenorSlugId: provider === 'tenor' ? (tenorSlugId ?? undefined) : undefined,
				});
			}
		} finally {
			setIsFavoritePending(false);
		}
	};

	const favoriteTooltipText = (() => {
		if (isFavoritePending) return t`Updating favorites…`;
		if (isFavorited) return t`Remove from favorites`;
		return t`Add to favorites`;
	})();

	return (
		<FocusRing offset={-2}>
			<div
				role="button"
				tabIndex={0}
				className={clsx(
					styles.gridItem,
					styles.gridItemGif,
					styles.gridItemGifPicker,
					isFocused && styles.gridItemFocused,
					isFavoritePending && styles.gridItemFavoritePending,
				)}
				onClick={handleClick}
				onKeyDown={handleKeyDown}
				style={coords}
				data-grid-item={itemKey}
				{...(hoverPlaybackHandlers ?? {})}
			>
				<div className={styles.gifMediaContainer}>
					{usesVideoElement ? (
						<div ref={videoContainerRef} className={styles.gifVideoContainer} />
					) : (
						<img className={styles.gif} src={proxySrc ?? ''} alt="" loading="lazy" />
					)}
				</div>

				<div className={styles.gridItemBackdrop} />

				<div className={styles.hoverActionButtons}>
					<Tooltip text={favoriteTooltipText} position="top">
						<FocusRing offset={-2}>
							<button
								type="button"
								onMouseDown={(e) => e.preventDefault()}
								onClick={handleFavoriteClick}
								className={clsx(styles.favoriteButton, isFavorited && styles.favoriteButtonActive)}
								aria-label={isFavorited ? t`Remove from favorites` : t`Add to favorites`}
								aria-busy={isFavoritePending}
								aria-pressed={isFavorited}
								disabled={isFavoritePending}
							>
								{isFavoritePending ? (
									<span className={styles.favoriteButtonSpinner} aria-hidden="true" />
								) : (
									<StarIcon
										size={18}
										weight={isFavorited ? 'fill' : 'bold'}
										className={isFavorited ? styles.favoriteButtonActiveIcon : styles.favoriteButtonIcon}
									/>
								)}
							</button>
						</FocusRing>
					</Tooltip>
				</div>
			</div>
		</FocusRing>
	);
}
