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

import * as MediaViewerActionCreators from '@app/actions/MediaViewerActionCreators';
import {ExpiryFootnote} from '@app/components/common/ExpiryFootnote';
import styles from '@app/components/modals/MediaModal.module.css';
import {MobileVideoViewer} from '@app/components/modals/MobileVideoViewer';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Scroller} from '@app/components/uikit/Scroller';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import PoweredByKlipySvg from '@app/images/powered-by-klipy.svg?react';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import LayerManager from '@app/stores/LayerManager';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import {useLingui} from '@lingui/react/macro';
import {
	ArrowSquareOutIcon,
	CaretLeftIcon,
	CaretRightIcon,
	DotsThreeIcon,
	DownloadSimpleIcon,
	InfoIcon,
	MagnifyingGlassMinusIcon,
	MagnifyingGlassPlusIcon,
	StarIcon,
	XIcon,
} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import type {CSSProperties, FC, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent} from 'react';
import {
	createElement,
	forwardRef,
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {createPortal} from 'react-dom';
import {TransformComponent, TransformWrapper} from 'react-zoom-pan-pinch';

interface MediaModalProps {
	title: string;
	fileName?: string;
	fileSize?: string;
	dimensions?: string;
	expiryInfo?: {
		expiresAt: Date | null;
		isExpired: boolean;
	};
	isFavorited?: boolean;
	onFavorite?: () => void;
	onSave?: () => void;
	onOpenInBrowser?: () => void;
	onInfo?: () => void;
	additionalActions?: ReactNode;
	children: ReactNode;
	enablePanZoom?: boolean;
	currentIndex?: number;
	totalAttachments?: number;
	onPrevious?: () => void;
	onNext?: () => void;
	thumbnails?: ReadonlyArray<MediaThumbnail>;
	onSelectThumbnail?: (index: number) => void;
	providerName?: string;
	videoSrc?: string;
	initialTime?: number;
	mediaType?: 'image' | 'video' | 'audio';
	onMenuOpen?: () => void;
}

interface MediaThumbnail {
	src: string;
	alt?: string;
	type?: 'image' | 'gif' | 'gifv' | 'video' | 'audio';
}

interface ControlButtonProps {
	icon: ReactNode;
	label: string;
	onClick: () => void;
	variant?: 'default' | 'primary' | 'danger';
	active?: boolean;
	disabled?: boolean;
}

const ControlButton = observer(
	forwardRef<HTMLButtonElement, ControlButtonProps>(
		({icon, label, onClick, variant = 'default', active = false, disabled = false}, ref) => {
			const getVariantClass = () => {
				if (active) {
					if (variant === 'primary') return styles.controlButtonPrimaryActive;
					if (variant === 'danger') return styles.controlButtonDangerActive;
					return styles.controlButtonDefaultActive;
				}
				if (variant === 'primary') return styles.controlButtonPrimary;
				if (variant === 'danger') return styles.controlButtonDanger;
				return styles.controlButtonDefault;
			};

			return (
				<FocusRing offset={-2} enabled={!disabled}>
					<button
						ref={ref}
						type="button"
						onClick={disabled ? undefined : onClick}
						className={clsx(styles.controlButton, getVariantClass(), disabled && styles.controlButtonDisabled)}
						aria-label={label}
						aria-pressed={active}
						disabled={disabled}
					>
						{icon}
					</button>
				</FocusRing>
			);
		},
	),
);

ControlButton.displayName = 'ControlButton';

interface FileInfoProps {
	fileName?: string;
	fileSize?: string;
	dimensions?: string;
	expiryInfo?: {
		expiresAt: Date | null;
		isExpired: boolean;
	};
	currentIndex?: number;
	totalAttachments?: number;
	onPrevious?: () => void;
	onNext?: () => void;
}

const FileInfo: FC<FileInfoProps> = observer(
	({fileName, fileSize, dimensions, expiryInfo, currentIndex, totalAttachments, onPrevious, onNext}: FileInfoProps) => {
		const {t} = useLingui();
		const hasNavigation = currentIndex !== undefined && totalAttachments !== undefined && totalAttachments > 1;

		if (!fileName && !hasNavigation) {
			return null;
		}

		return (
			<div className={styles.fileInfoInline}>
				{fileName && (
					<div className={styles.fileInfoContent}>
						<p className={styles.fileInfoName}>{fileName}</p>
						<p className={styles.fileInfoMeta}>
							{[fileSize, dimensions].filter(Boolean).join(' \u2022 ')}
							{expiryInfo?.expiresAt && AccessibilityStore.showAttachmentExpiryIndicator && (
								<>
									{(fileSize || dimensions) && ' \u2022 '}
									<ExpiryFootnote expiresAt={expiryInfo.expiresAt} isExpired={expiryInfo.isExpired} inline />
								</>
							)}
						</p>
					</div>
				)}

				{hasNavigation && (
					<div className={styles.fileInfoNavigation}>
						<ControlButton
							icon={<CaretLeftIcon size={16} weight="bold" />}
							label={t`Previous attachment`}
							onClick={onPrevious ?? (() => {})}
							disabled={currentIndex === 0}
						/>
						<span className={styles.fileInfoNavigationText}>{t`${currentIndex + 1}/${totalAttachments}`}</span>
						<ControlButton
							icon={<CaretRightIcon size={16} weight="bold" />}
							label={t`Next attachment`}
							onClick={onNext ?? (() => {})}
							disabled={currentIndex === totalAttachments - 1}
						/>
					</div>
				)}
			</div>
		);
	},
);

interface ControlsProps {
	isFavorited?: boolean;
	onFavorite?: () => void;
	onSave?: () => void;
	onOpenInBrowser?: () => void;
	onInfo?: () => void;
	onClose: () => void;
	additionalActions?: ReactNode;
	zoomState?: 'fit' | 'zoomed';
	onZoom?: (state: 'fit' | 'zoomed') => void;
	enableZoomControls?: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getViewportPadding = () => {
	const minSide = Math.min(window.innerWidth, window.innerHeight);
	return Math.round(clamp(minSide * 0.05, 16, 64));
};

const Controls: FC<ControlsProps> = observer(
	({
		isFavorited,
		onFavorite,
		onSave,
		onOpenInBrowser,
		onInfo,
		onClose,
		additionalActions,
		zoomState = 'fit',
		onZoom,
		enableZoomControls = false,
	}: ControlsProps) => {
		const {t} = useLingui();
		const [isHoveringActions, setIsHoveringActions] = useState(false);
		const hasActions =
			onFavorite || onSave || onOpenInBrowser || onInfo || (enableZoomControls && onZoom) || additionalActions;
		const isZoomed = zoomState === 'zoomed';
		const showActions = hasActions && (!isZoomed || isHoveringActions);

		return (
			<div
				className={styles.controlsBox}
				role="toolbar"
				aria-label={t`Media controls`}
				onMouseEnter={() => setIsHoveringActions(true)}
				onMouseLeave={() => setIsHoveringActions(false)}
			>
				{showActions && (
					<div className={styles.actionControlsBox}>
						{enableZoomControls && onZoom && (
							<Tooltip text={zoomState === 'fit' ? t`Zoom in` : t`Zoom out`} position="bottom">
								<span>
									<ControlButton
										icon={
											zoomState === 'fit' ? (
												<MagnifyingGlassPlusIcon size={18} weight="bold" />
											) : (
												<MagnifyingGlassMinusIcon size={18} weight="bold" />
											)
										}
										label={zoomState === 'fit' ? t`Zoom in` : t`Zoom out`}
										onClick={() => onZoom(zoomState === 'fit' ? 'zoomed' : 'fit')}
									/>
								</span>
							</Tooltip>
						)}

						{onFavorite && (
							<Tooltip text={isFavorited ? t`Remove from favorites` : t`Add to favorites`} position="bottom">
								<span>
									<ControlButton
										icon={<StarIcon size={18} weight={isFavorited ? 'fill' : 'bold'} />}
										label={isFavorited ? t`Remove from favorites` : t`Add to favorites`}
										onClick={onFavorite}
										variant={isFavorited ? 'primary' : 'default'}
										active={isFavorited}
									/>
								</span>
							</Tooltip>
						)}

						{onSave && (
							<Tooltip text={t`Save media`} position="bottom">
								<span>
									<ControlButton
										icon={<DownloadSimpleIcon size={18} weight="bold" />}
										label={t`Save media`}
										onClick={onSave}
									/>
								</span>
							</Tooltip>
						)}

						{onOpenInBrowser && (
							<Tooltip text={t`Open in browser`} position="bottom">
								<span>
									<ControlButton
										icon={<ArrowSquareOutIcon size={18} weight="bold" />}
										label={t`Open in browser`}
										onClick={onOpenInBrowser}
									/>
								</span>
							</Tooltip>
						)}

						{onInfo && (
							<Tooltip text={t`Show media information`} position="bottom">
								<span>
									<ControlButton
										icon={<InfoIcon size={18} weight="bold" />}
										label={t`Show media information`}
										onClick={onInfo}
									/>
								</span>
							</Tooltip>
						)}

						{additionalActions}
					</div>
				)}

				<div className={styles.closeControlBox}>
					<Tooltip text={t`Close modal`} position="bottom">
						<span>
							<ControlButton icon={<XIcon size={18} weight="bold" />} label={t`Close modal`} onClick={onClose} />
						</span>
					</Tooltip>
				</div>
			</div>
		);
	},
);

interface CompactMobileControlsProps {
	onClose: () => void;
	onMenuOpen?: () => void;
}

const CompactMobileControls: FC<CompactMobileControlsProps> = observer(
	({onClose, onMenuOpen}: CompactMobileControlsProps) => {
		const {t} = useLingui();

		return (
			<div className={styles.mobileTopBarControls} role="toolbar" aria-label={t`Media controls`}>
				<ControlButton icon={<XIcon size={20} weight="bold" />} label={t`Close`} onClick={onClose} />
				{onMenuOpen && (
					<ControlButton
						icon={<DotsThreeIcon size={20} weight="bold" />}
						label={t`More options`}
						onClick={onMenuOpen}
					/>
				)}
			</div>
		);
	},
);

type ZoomState = 'fit' | 'zoomed';

interface DesktopMediaViewerProps {
	children: ReactNode;
	onClose: () => void;
	onZoomStateChange?: (state: ZoomState) => void;
	zoomState?: ZoomState;
	onZoom?: (state: ZoomState) => void;
}

const DesktopMediaViewer: FC<DesktopMediaViewerProps> = observer(
	({children, onClose, onZoomStateChange, zoomState: externalZoomState, onZoom}: DesktopMediaViewerProps) => {
		const [internalZoomState, setInternalZoomState] = useState<ZoomState>('fit');
		const [panX, setPanX] = useState(0);
		const [panY, setPanY] = useState(0);
		const [isDragging, setIsDragging] = useState(false);
		const [isHoveringContent, setIsHoveringContent] = useState(false);
		const [dragStart, setDragStart] = useState({x: 0, y: 0});
		const containerRef = useRef<HTMLButtonElement>(null);
		const contentRef = useRef<HTMLDivElement>(null);
		const dragStartedOnImageRef = useRef(false);
		const dragDistanceRef = useRef(0);
		const zoomStateBeforeDragRef = useRef<ZoomState>('fit');
		const currentZoomStateRef = useRef<ZoomState>('fit');

		const zoomState = externalZoomState ?? internalZoomState;
		currentZoomStateRef.current = zoomState;

		useLayoutEffect(() => {
			if (externalZoomState === undefined) {
				return;
			}

			setPanX(0);
			setPanY(0);
		}, [externalZoomState]);

		const updateZoomState = useCallback(
			(newState: ZoomState) => {
				if (currentZoomStateRef.current === newState) {
					return;
				}

				currentZoomStateRef.current = newState;
				setPanX(0);
				setPanY(0);

				if (externalZoomState !== undefined) {
					onZoom?.(newState);
				} else {
					setInternalZoomState(newState);
					onZoomStateChange?.(newState);
				}
			},
			[onZoomStateChange, onZoom, externalZoomState],
		);

		const handleMouseDown = useCallback(
			(e: ReactMouseEvent) => {
				if (e.button !== 0) {
					return;
				}

				const currentZoom = currentZoomStateRef.current;

				if (e.target === containerRef.current) {
					if (currentZoom === 'fit') {
						return;
					}
					return;
				}

				dragStartedOnImageRef.current = true;
				dragDistanceRef.current = 0;
				zoomStateBeforeDragRef.current = currentZoom;

				if (currentZoom === 'zoomed') {
					setIsDragging(true);
					setDragStart({x: e.clientX - panX, y: e.clientY - panY});
				} else {
					updateZoomState('zoomed');
				}
			},
			[panX, panY, updateZoomState],
		);

		const handleMouseMove = useCallback(
			(e: ReactMouseEvent) => {
				if (isDragging && dragStartedOnImageRef.current) {
					const dx = e.clientX - dragStart.x - panX;
					const dy = e.clientY - dragStart.y - panY;
					dragDistanceRef.current += Math.sqrt(dx * dx + dy * dy);
				}
			},
			[isDragging, dragStart, panX, panY],
		);

		const handleMouseUp = useCallback(() => {
			setIsDragging(false);

			if (dragStartedOnImageRef.current && dragDistanceRef.current < 5 && zoomStateBeforeDragRef.current === 'zoomed') {
				updateZoomState('fit');
			}

			dragStartedOnImageRef.current = false;
			dragDistanceRef.current = 0;
		}, [updateZoomState]);

		const handleDoubleClick = useCallback(() => {
			updateZoomState(currentZoomStateRef.current === 'fit' ? 'zoomed' : 'fit');
		}, [updateZoomState]);

		const handleBackdropClick = useCallback(
			(e: React.SyntheticEvent<HTMLButtonElement>) => {
				if (e.target === e.currentTarget && !dragStartedOnImageRef.current) {
					onClose();
				}
			},
			[onClose],
		);

		useEffect(() => {
			const handleGlobalMouseMove = (e: MouseEvent) => {
				if (isDragging && currentZoomStateRef.current === 'zoomed' && containerRef.current && contentRef.current) {
					const newX = e.clientX - dragStart.x;
					const newY = e.clientY - dragStart.y;

					const containerRect = containerRef.current.getBoundingClientRect();
					const contentRect = contentRef.current.getBoundingClientRect();

					const zoomScaleValue = 2.5;
					const maxX = Math.max(0, (contentRect.width * zoomScaleValue - containerRect.width) / 2);
					const maxY = Math.max(0, (contentRect.height * zoomScaleValue - containerRect.height) / 2);

					const clampedX = Math.max(-maxX, Math.min(maxX, newX));
					const clampedY = Math.max(-maxY, Math.min(maxY, newY));

					setPanX(clampedX);
					setPanY(clampedY);

					const dx = e.clientX - (dragStart.x + panX);
					const dy = e.clientY - (dragStart.y + panY);
					dragDistanceRef.current += Math.sqrt(dx * dx + dy * dy);
				}
			};

			const handleGlobalMouseUp = () => {
				setIsDragging(false);

				if (
					dragStartedOnImageRef.current &&
					dragDistanceRef.current < 5 &&
					zoomStateBeforeDragRef.current === 'zoomed'
				) {
					updateZoomState('fit');
				}

				dragStartedOnImageRef.current = false;
				dragDistanceRef.current = 0;
			};

			if (isDragging) {
				document.addEventListener('mousemove', handleGlobalMouseMove, {passive: true});
				document.addEventListener('mouseup', handleGlobalMouseUp);
				return () => {
					document.removeEventListener('mousemove', handleGlobalMouseMove);
					document.removeEventListener('mouseup', handleGlobalMouseUp);
				};
			}
			return;
		}, [isDragging, dragStart, panX, panY, updateZoomState]);

		const zoomScale = zoomState === 'zoomed' ? 2.5 : 1;

		const getCursor = () => {
			if (!isHoveringContent) return 'default';
			if (isDragging) return 'grabbing';
			if (zoomState === 'zoomed') return 'zoom-out';
			return 'zoom-in';
		};

		return (
			<button
				type="button"
				ref={containerRef}
				className={styles.desktopViewerContainer}
				style={{cursor: getCursor()}}
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onDoubleClick={handleDoubleClick}
				onClick={handleBackdropClick}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						handleBackdropClick(e);
					}
				}}
			>
				<div
					ref={contentRef}
					className={styles.desktopViewerContent}
					role="img"
					style={{
						transform: `translate3d(${panX / zoomScale}px, ${panY / zoomScale}px, 0) scale(${zoomScale})`,
						transformOrigin: 'center center',
						willChange: isDragging ? 'transform' : 'auto',
					}}
					onMouseEnter={() => setIsHoveringContent(true)}
					onMouseLeave={() => setIsHoveringContent(false)}
					onKeyDown={(e) => e.stopPropagation()}
					onClick={(e) => e.stopPropagation()}
				>
					{children}
				</div>
			</button>
		);
	},
);

interface MobileMediaViewerProps {
	children: ReactNode;
}

const MobileMediaViewer: FC<MobileMediaViewerProps> = observer(({children}: MobileMediaViewerProps) => {
	return (
		<div className={styles.mobileViewerContainer}>
			<TransformWrapper
				initialScale={1}
				minScale={1}
				maxScale={5}
				wheel={{step: 0.1}}
				pinch={{step: 5}}
				doubleClick={{
					disabled: false,
					step: 0.7,
					mode: 'toggle',
				}}
				centerOnInit
				centerZoomedOut
				panning={{disabled: false}}
				disabled={false}
			>
				<TransformComponent wrapperClass={styles.transformWrapper} contentClass={styles.transformContent}>
					{children}
				</TransformComponent>
			</TransformWrapper>
		</div>
	);
});

export const MediaModal: FC<MediaModalProps> = observer(
	({
		title,
		fileName,
		fileSize,
		dimensions,
		expiryInfo,
		isFavorited,
		onFavorite,
		onSave,
		onOpenInBrowser,
		onInfo,
		additionalActions,
		children,
		enablePanZoom = false,
		currentIndex,
		totalAttachments,
		onPrevious,
		onNext,
		thumbnails,
		onSelectThumbnail,
		providerName,
		videoSrc,
		initialTime,
		mediaType,
		onMenuOpen,
	}: MediaModalProps) => {
		const {enabled: isMobile} = MobileLayoutStore;
		const modalKey = useRef(Math.random().toString(36).substring(7));
		const prefersReducedMotion = AccessibilityStore.useReducedMotion;
		const [zoomState, setZoomState] = useState<ZoomState>('fit');
		const [viewportPadding, setViewportPadding] = useState(getViewportPadding);
		const headerBarRef = useRef<HTMLDivElement>(null);
		const thumbnailCarouselRef = useRef<HTMLDivElement>(null);
		const navigationOverlayRef = useRef<HTMLDivElement>(null);
		const klipyAttributionRef = useRef<HTMLDivElement>(null);
		const latestIndexRef = useRef(currentIndex ?? 0);
		const [topOverlayHeight, setTopOverlayHeight] = useState(0);
		const [bottomOverlayHeight, setBottomOverlayHeight] = useState(0);

		const measureOverlayHeights = useCallback(() => {
			const nextTopOverlayHeight = Math.ceil(headerBarRef.current?.getBoundingClientRect().height ?? 0);
			const nextBottomOverlayHeight = Math.ceil(
				Math.max(
					thumbnailCarouselRef.current?.getBoundingClientRect().height ?? 0,
					navigationOverlayRef.current?.getBoundingClientRect().height ?? 0,
					klipyAttributionRef.current?.getBoundingClientRect().height ?? 0,
				),
			);

			setTopOverlayHeight((previousHeight) =>
				previousHeight === nextTopOverlayHeight ? previousHeight : nextTopOverlayHeight,
			);
			setBottomOverlayHeight((previousHeight) =>
				previousHeight === nextBottomOverlayHeight ? previousHeight : nextBottomOverlayHeight,
			);
		}, []);

		const handleClose = useCallback(() => {
			MediaViewerActionCreators.closeMediaViewer();
		}, []);

		const handleZoom = useCallback((state: ZoomState) => {
			setZoomState((previousState) => (previousState === state ? previousState : state));
		}, []);

		useEffect(() => {
			if (currentIndex !== undefined) {
				latestIndexRef.current = currentIndex;
			}
		}, [currentIndex]);

		useEffect(() => {
			LayerManager.addLayer('modal', modalKey.current, handleClose);
			return () => {
				LayerManager.removeLayer('modal', modalKey.current);
			};
		}, [handleClose]);

		useEffect(() => {
			const originalOverflow = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = originalOverflow;
			};
		}, []);

		useEffect(() => {
			const updateViewportPadding = () => setViewportPadding(getViewportPadding());
			updateViewportPadding();

			window.addEventListener('resize', updateViewportPadding);
			return () => window.removeEventListener('resize', updateViewportPadding);
		}, []);

		useEffect(() => {
			const handleKeyDown = (e: KeyboardEvent) => {
				if (e.defaultPrevented) return;

				if (e.key === 'Escape') {
					handleClose();
					return;
				}

				const target = e.target as HTMLElement | null;
				if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
					return;
				}

				if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && currentIndex !== undefined && onSelectThumbnail) {
					const count = thumbnails?.length ?? 0;
					if (count > 1) {
						e.preventDefault();
						const delta = e.key === 'ArrowRight' ? 1 : -1;
						const latest = latestIndexRef.current;
						const nextIndex = (latest + delta + count) % count;
						latestIndexRef.current = nextIndex;
						setZoomState('fit');
						setRovingThumbnailIndex(nextIndex);
						onSelectThumbnail(nextIndex);
						return;
					}
				}

				if (e.key === 'ArrowLeft' && onPrevious) {
					e.preventDefault();
					onPrevious();
					return;
				}

				if (e.key === 'ArrowRight' && onNext) {
					e.preventDefault();
					onNext();
					return;
				}
			};
			window.addEventListener('keydown', handleKeyDown);
			return () => window.removeEventListener('keydown', handleKeyDown);
		}, [handleClose, onPrevious, onNext, onSelectThumbnail, thumbnails]);

		const hasThumbnailCarousel =
			thumbnails && thumbnails.length > 1 && currentIndex !== undefined && onSelectThumbnail !== undefined;

		const contentSizingStyle = useMemo(() => {
			const minimumTopOverlayHeight = isMobile ? 40 : 48;
			const hasNavigationOverlay = currentIndex !== undefined && totalAttachments !== undefined && totalAttachments > 1;
			const hasBottomOverlay =
				zoomState === 'fit' &&
				(Boolean(providerName === 'KLIPY') || Boolean(hasThumbnailCarousel) || hasNavigationOverlay);
			const minimumBottomOverlayHeight = hasBottomOverlay ? 48 : 0;

			const hasSideNavButtons = hasThumbnailCarousel && zoomState !== 'zoomed' && !isMobile;
			const navButtonInset = 12 + 48 + 12;
			const sideOverlayWidth = hasSideNavButtons ? Math.max(0, navButtonInset - viewportPadding) : 0;

			return {
				'--media-content-padding': `${viewportPadding}px`,
				'--media-edge-padding': `${viewportPadding}px`,
				'--media-top-overlay-height': `${Math.max(topOverlayHeight, minimumTopOverlayHeight)}px`,
				'--media-bottom-overlay-height': `${Math.max(bottomOverlayHeight, minimumBottomOverlayHeight)}px`,
				'--media-overlay-gap': '8px',
				'--media-side-overlay-width': `${sideOverlayWidth}px`,
			} as CSSProperties;
		}, [
			viewportPadding,
			topOverlayHeight,
			bottomOverlayHeight,
			isMobile,
			currentIndex,
			totalAttachments,
			zoomState,
			providerName,
			hasThumbnailCarousel,
		]);

		useLayoutEffect(() => {
			measureOverlayHeights();

			const observer = new ResizeObserver(() => {
				measureOverlayHeights();
			});

			if (headerBarRef.current) observer.observe(headerBarRef.current);
			if (thumbnailCarouselRef.current) observer.observe(thumbnailCarouselRef.current);
			if (navigationOverlayRef.current) observer.observe(navigationOverlayRef.current);
			if (klipyAttributionRef.current) observer.observe(klipyAttributionRef.current);

			return () => observer.disconnect();
		}, [measureOverlayHeights, hasThumbnailCarousel, providerName, currentIndex, totalAttachments, zoomState]);

		const thumbnailCount = thumbnails?.length ?? 0;
		const thumbnailButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
		const [rovingThumbnailIndex, setRovingThumbnailIndex] = useState<number>(() => currentIndex ?? 0);

		useEffect(() => {
			thumbnailButtonRefs.current = thumbnailButtonRefs.current.slice(0, thumbnailCount);
		}, [thumbnailCount]);

		useEffect(() => {
			if (!thumbnailCount && rovingThumbnailIndex !== 0) {
				setRovingThumbnailIndex(0);
				return;
			}

			if (thumbnailCount && rovingThumbnailIndex >= thumbnailCount) {
				setRovingThumbnailIndex(thumbnailCount - 1);
			}
		}, [thumbnailCount, rovingThumbnailIndex]);

		useEffect(() => {
			if (currentIndex !== undefined && currentIndex !== rovingThumbnailIndex) {
				setRovingThumbnailIndex(currentIndex);
			}
		}, [currentIndex, rovingThumbnailIndex]);

		const handleThumbnailSelect = useCallback(
			(index: number) => {
				if (!onSelectThumbnail || currentIndex === undefined) return;
				setZoomState('fit');
				setRovingThumbnailIndex(index);
				onSelectThumbnail(index);
			},
			[onSelectThumbnail, currentIndex],
		);

		const focusThumbnailButton = useCallback((index: number) => {
			const button = thumbnailButtonRefs.current[index];
			button?.focus();
		}, []);

		const handleThumbnailKeyDown = useCallback(
			(e: ReactKeyboardEvent<HTMLElement>) => {
				if (!thumbnailCount) return;

				let nextIndex = rovingThumbnailIndex;
				if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
					nextIndex = (rovingThumbnailIndex + 1) % thumbnailCount;
				} else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
					nextIndex = (rovingThumbnailIndex - 1 + thumbnailCount) % thumbnailCount;
				} else if (e.key === 'Home') {
					nextIndex = 0;
				} else if (e.key === 'End') {
					nextIndex = thumbnailCount - 1;
				} else {
					return;
				}

				if (nextIndex === rovingThumbnailIndex) return;

				e.preventDefault();
				e.stopPropagation();
				handleThumbnailSelect(nextIndex);
				focusThumbnailButton(nextIndex);
			},
			[focusThumbnailButton, handleThumbnailSelect, rovingThumbnailIndex, thumbnailCount],
		);

		const {t} = useLingui();
		const wrappedChildren = useMemo(() => <div className={styles.mediaContainer}>{children}</div>, [children]);

		const isMobileVideo = isMobile && mediaType === 'video' && videoSrc;
		const showDesktopControls = !isMobile;
		const showCompactMobileControls = isMobile && !isMobileVideo;

		const mediaContent = isMobileVideo
			? createElement(MobileVideoViewer, {
					src: videoSrc,
					initialTime,
					loop: true,
					onClose: handleClose,
					onMenuOpen,
				})
			: enablePanZoom
				? isMobile
					? createElement(MobileMediaViewer, null, wrappedChildren)
					: createElement(DesktopMediaViewer, {
							onClose: handleClose,
							onZoomStateChange: setZoomState,
							zoomState,
							onZoom: handleZoom,
							children: wrappedChildren,
						})
				: createElement(
						'div',
						{className: styles.nonZoomMediaContainer},
						createElement('div', {
							className: styles.nonZoomBackdrop,
							role: 'button',
							tabIndex: 0,
							onClick: handleClose,
							onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									handleClose();
								}
							},
							'aria-label': 'Close media viewer',
						}),
						createElement(
							'div',
							{className: styles.nonZoomContent},
							createElement('div', {className: styles.nonZoomContentInner}, wrappedChildren),
						),
					);

		const modalContent = (
			<AnimatePresence>
				<div className={styles.modalOverlay}>
					<motion.div
						className={styles.modalBackdrop}
						initial={{opacity: 0}}
						animate={{opacity: 1}}
						exit={{opacity: 0}}
						transition={prefersReducedMotion ? {duration: 0} : {duration: 0.2}}
						aria-hidden="true"
						onClick={handleClose}
					/>

					<motion.div
						className={styles.modalContent}
						initial={{opacity: 0}}
						animate={{opacity: 1}}
						exit={{opacity: 0}}
						transition={prefersReducedMotion ? {duration: 0} : {duration: 0.2}}
						role="dialog"
						aria-modal="true"
						aria-label={title}
					>
						<div
							className={clsx(styles.modalContentInner, zoomState === 'zoomed' && styles.modalContentInnerZoomed)}
							style={contentSizingStyle}
						>
							<div ref={headerBarRef} className={styles.headerBar}>
								{zoomState !== 'zoomed' && (
									<div className={styles.headerMeta}>
										<FileInfo
											fileName={fileName}
											fileSize={fileSize}
											dimensions={dimensions}
											expiryInfo={expiryInfo}
											currentIndex={currentIndex}
											totalAttachments={totalAttachments}
											onPrevious={onPrevious}
											onNext={onNext}
										/>
									</div>
								)}

								{showDesktopControls && (
									<div className={styles.headerControls}>
										<Controls
											isFavorited={isFavorited}
											onFavorite={onFavorite}
											onSave={onSave}
											onOpenInBrowser={onOpenInBrowser}
											onInfo={onInfo}
											onClose={handleClose}
											additionalActions={additionalActions}
											zoomState={zoomState}
											onZoom={enablePanZoom && !isMobile ? handleZoom : undefined}
											enableZoomControls={enablePanZoom && !isMobile}
										/>
									</div>
								)}

								{showCompactMobileControls && (
									<div className={styles.headerControls}>
										<CompactMobileControls onClose={handleClose} onMenuOpen={onMenuOpen} />
									</div>
								)}
							</div>

							<div className={clsx(styles.mediaArea, zoomState === 'zoomed' && styles.mediaAreaZoomed)}>
								{mediaContent}
							</div>

							{providerName === 'KLIPY' && zoomState === 'fit' && (
								<div ref={klipyAttributionRef} className={styles.klipyAttribution}>
									<PoweredByKlipySvg />
								</div>
							)}

							{hasThumbnailCarousel && zoomState !== 'zoomed' && !isMobile && (
								<>
									<div className={styles.floatingNavButtonLeft}>
										<Tooltip text={t`Previous attachment`} position="right">
											<span>
												<FocusRing offset={-2}>
													<button
														type="button"
														className={styles.floatingNavButton}
														onClick={onPrevious ?? (() => {})}
														aria-label={t`Previous attachment`}
													>
														<CaretLeftIcon size={24} weight="bold" />
													</button>
												</FocusRing>
											</span>
										</Tooltip>
									</div>
									<div className={styles.floatingNavButtonRight}>
										<Tooltip text={t`Next attachment`} position="left">
											<span>
												<FocusRing offset={-2}>
													<button
														type="button"
														className={styles.floatingNavButton}
														onClick={onNext ?? (() => {})}
														aria-label={t`Next attachment`}
													>
														<CaretRightIcon size={24} weight="bold" />
													</button>
												</FocusRing>
											</span>
										</Tooltip>
									</div>
								</>
							)}

							{hasThumbnailCarousel && zoomState !== 'zoomed' && (
								<div ref={thumbnailCarouselRef} className={styles.thumbnailCarouselWrapper}>
									<Scroller
										className={styles.thumbnailCarouselScroller}
										orientation="horizontal"
										overflow="auto"
										fade={false}
										key="media-modal-thumbnail-carousel-scroller"
										role="listbox"
										aria-label={t`Attachment thumbnails`}
										onKeyDown={handleThumbnailKeyDown}
									>
										<div className={styles.thumbnailCarousel}>
											{thumbnails?.map((thumb: MediaThumbnail, index: number) => {
												const isSelected = currentIndex === index;
												const isRovingTarget = rovingThumbnailIndex === index;
												const isFirstThumbnail = index === 0;
												const isLastThumbnail = index === thumbnailCount - 1;

												return (
													<FocusRing key={`${thumb.src}-${index}`} offset={-2}>
														<button
															ref={(el) => {
																thumbnailButtonRefs.current[index] = el;
															}}
															type="button"
															role="option"
															aria-selected={isSelected}
															aria-label={thumb.alt ?? t`Attachment ${index + 1}`}
															className={clsx(styles.thumbnailButton, isSelected && styles.thumbnailButtonSelected)}
															tabIndex={isRovingTarget ? 0 : -1}
															onClick={() => handleThumbnailSelect(index)}
															onKeyDown={handleThumbnailKeyDown}
														>
															<div
																className={clsx(
																	styles.thumbnailImageWrapper,
																	isFirstThumbnail && styles.thumbnailImageWrapperFirst,
																	isLastThumbnail && styles.thumbnailImageWrapperLast,
																)}
															>
																{thumb.type === 'video' || thumb.type === 'gifv' ? (
																	<video
																		className={styles.thumbnailVideo}
																		src={thumb.src}
																		muted
																		playsInline
																		preload="metadata"
																		aria-label={thumb.alt ?? t`Video preview`}
																	/>
																) : thumb.type === 'audio' ? (
																	<div className={styles.thumbnailPlaceholder}>{t`Audio`}</div>
																) : (
																	<img
																		src={thumb.src}
																		alt={thumb.alt ?? ''}
																		className={styles.thumbnailImage}
																		draggable={false}
																	/>
																)}
															</div>
														</button>
													</FocusRing>
												);
											})}
										</div>
									</Scroller>
								</div>
							)}

							{!hasThumbnailCarousel &&
								currentIndex !== undefined &&
								totalAttachments !== undefined &&
								totalAttachments > 1 && (
									<div ref={navigationOverlayRef} className={styles.navigationOverlay}>
										<Tooltip text={t`Previous attachment`} position="top">
											<span>
												<ControlButton
													icon={<CaretLeftIcon size={20} weight="bold" />}
													label={t`Previous attachment`}
													onClick={onPrevious ?? (() => {})}
													disabled={currentIndex === 0}
												/>
											</span>
										</Tooltip>

										<span className={styles.navigationText}>{t`${currentIndex + 1} of ${totalAttachments}`}</span>

										<Tooltip text={t`Next attachment`} position="top">
											<span>
												<ControlButton
													icon={<CaretRightIcon size={20} weight="bold" />}
													label={t`Next attachment`}
													onClick={onNext ?? (() => {})}
													disabled={currentIndex === totalAttachments - 1}
												/>
											</span>
										</Tooltip>
									</div>
								)}
						</div>
					</motion.div>
				</div>
			</AnimatePresence>
		);

		return createPortal(modalContent, document.body);
	},
);
