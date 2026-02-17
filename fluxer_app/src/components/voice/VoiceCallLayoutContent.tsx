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

import * as PiPActionCreators from '@app/actions/PiPActionCreators';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Scroller, type ScrollerHandle} from '@app/components/uikit/Scroller';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import styles from '@app/components/voice/VoiceCallView.module.css';
import {VoiceGridLayout} from '@app/components/voice/VoiceGridLayout';
import {parseVoiceParticipantIdentity} from '@app/components/voice/VoiceParticipantSpeakingUtils';
import {VoiceParticipantTile} from '@app/components/voice/VoiceParticipantTile';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import {useLingui} from '@lingui/react/macro';
import {
	isTrackReference,
	ParticipantContext,
	TrackRefContext,
	type TrackReferenceOrPlaceholder,
} from '@livekit/components-react';
import {CaretDownIcon, CaretUpIcon, UsersIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {type Participant, Track} from 'livekit-client';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';

type LayoutMode = 'grid' | 'focus';

interface VoiceCallLayoutContentProps {
	channel: ChannelRecord;
	layoutMode: LayoutMode;
	focusMainTrack: TrackReferenceOrPlaceholder | null;
	carouselTracks: Array<TrackReferenceOrPlaceholder>;
	cameraTracksAll: Array<TrackReferenceOrPlaceholder>;
	filteredCameraTracks: Array<TrackReferenceOrPlaceholder>;
	screenShareTracks: Array<TrackReferenceOrPlaceholder>;
	hasScreenShare: boolean;
	pinnedParticipantIdentity: string | null;
	compact?: boolean;
}

interface FocusLayoutStyle extends React.CSSProperties {
	'--carousel-row-height'?: string;
	'--content-padding'?: string;
	'--focus-expanded-main-max-height'?: string;
	'--focus-mini-tile-max-width'?: string;
	'--focus-mini-grid-gap'?: string;
}

interface FocusMainStyle extends React.CSSProperties {
	'--focus-main-aspect-ratio-value'?: string;
}

const COMPACT_FOCUS_STYLE: FocusLayoutStyle = {
	'--carousel-row-height': '104px',
	'--content-padding': '0.5rem',
	'--focus-mini-tile-max-width': '212px',
	'--focus-mini-grid-gap': '0.5rem',
};

const DEFAULT_FOCUS_MAIN_ASPECT_RATIO = 16 / 9;
const FOCUS_MAIN_VISIBLE_THRESHOLD = 0.35;

export const VoiceCallLayoutContent = observer(function VoiceCallLayoutContent({
	channel,
	layoutMode,
	focusMainTrack,
	carouselTracks,
	cameraTracksAll,
	filteredCameraTracks,
	screenShareTracks,
	hasScreenShare,
	pinnedParticipantIdentity,
	compact = false,
}: VoiceCallLayoutContentProps) {
	const {t} = useLingui();
	const focusLayoutStyle = useMemo(() => (compact ? COMPACT_FOCUS_STYLE : undefined), [compact]);
	const focusMainAspectRatio = DEFAULT_FOCUS_MAIN_ASPECT_RATIO;
	const focusMainWrapperRef = useRef<HTMLDivElement | null>(null);
	const focusLayoutScrollerRef = useRef<ScrollerHandle | null>(null);
	const focusExpandedScrollBodyRef = useRef<HTMLDivElement | null>(null);
	const focusExpandedToggleRowRef = useRef<HTMLDivElement | null>(null);
	const focusMiniGridRef = useRef<HTMLDivElement | null>(null);
	const [focusExpandedMainMaxHeightPx, setFocusExpandedMainMaxHeightPx] = useState<number | null>(null);
	const [focusExpandedRenderEpoch, setFocusExpandedRenderEpoch] = useState(0);
	const hasForcedExpandedRefreshRef = useRef(false);
	const focusLayoutComputedStyle = useMemo<FocusLayoutStyle>(() => {
		return {
			...(focusLayoutStyle ?? {}),
			...(focusExpandedMainMaxHeightPx != null
				? {'--focus-expanded-main-max-height': `${Math.round(focusExpandedMainMaxHeightPx)}px`}
				: {}),
		};
	}, [focusLayoutStyle, focusExpandedMainMaxHeightPx]);
	const focusMainStyle = useMemo<FocusMainStyle>(() => {
		return {
			'--focus-main-aspect-ratio-value': `${focusMainAspectRatio}`,
		};
	}, [focusMainAspectRatio]);
	const [showFocusedTileMirror, setShowFocusedTileMirror] = useState(false);
	const [showParticipantsGrid, setShowParticipantsGrid] = useState(false);
	const [isGridOverflowing, setIsGridOverflowing] = useState(false);
	const hasMiniGrid = carouselTracks.length > 0;
	const canShowParticipantsGridPanel = hasMiniGrid && !compact;
	const visibleCameraTracks = filteredCameraTracks.length > 0 ? filteredCameraTracks : cameraTracksAll;
	const isParticipantsExpanded = canShowParticipantsGridPanel && showParticipantsGrid;

	const focusedTrackContent = useMemo(() => {
		if (!focusMainTrack) return null;
		const identity = focusMainTrack.participant.identity;
		const parsedIdentity = parseVoiceParticipantIdentity(identity);
		if (!parsedIdentity.userId || !parsedIdentity.connectionId) return null;
		return {
			type: focusMainTrack.source === Track.Source.ScreenShare ? 'stream' : 'camera',
			participantIdentity: identity,
			channelId: channel.id,
			guildId: channel.guildId ?? null,
			connectionId: parsedIdentity.connectionId,
			userId: parsedIdentity.userId,
		} as const;
	}, [channel.guildId, channel.id, focusMainTrack]);

	useEffect(() => {
		if (!canShowParticipantsGridPanel) {
			setShowParticipantsGrid(false);
		}
	}, [canShowParticipantsGridPanel]);

	const handleFocusLayoutScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
		const mainWrapper = focusMainWrapperRef.current;
		if (!mainWrapper) {
			setShowFocusedTileMirror(false);
			return;
		}

		const scrollNode = event.currentTarget;
		const scrollRect = scrollNode.getBoundingClientRect();
		const mainRect = mainWrapper.getBoundingClientRect();
		const visibleHeight = Math.max(
			0,
			Math.min(scrollRect.bottom, mainRect.bottom) - Math.max(scrollRect.top, mainRect.top),
		);
		const visibleRatio = mainRect.height > 0 ? visibleHeight / mainRect.height : 0;
		const hasScrolledPastTop = scrollNode.scrollTop > 16;
		setShowFocusedTileMirror(hasScrolledPastTop && visibleRatio < FOCUS_MAIN_VISIBLE_THRESHOLD);
	}, []);

	const handleToggleParticipantsGrid = useCallback(() => {
		setShowParticipantsGrid((previousValue) => !previousValue);
	}, []);

	const handleGridOverflowChange = useCallback((isOverflowing: boolean) => {
		setIsGridOverflowing((previousValue) => (previousValue === isOverflowing ? previousValue : isOverflowing));
	}, []);

	useEffect(() => {
		if (layoutMode !== 'focus' || !focusedTrackContent || !showFocusedTileMirror) {
			PiPActionCreators.hideFocusedTileMirror();
			return;
		}
		PiPActionCreators.showFocusedTileMirror(focusedTrackContent, 'top-right');
		return () => PiPActionCreators.hideFocusedTileMirror();
	}, [focusedTrackContent, layoutMode, showFocusedTileMirror]);

	useLayoutEffect(() => {
		if (!isParticipantsExpanded) {
			setFocusExpandedMainMaxHeightPx(null);
			hasForcedExpandedRefreshRef.current = false;
			return;
		}
		let rafId: number | null = null;
		let rafPass = 0;

		function computeExpandedMainMaxHeight(): boolean {
			const scrollerNode = focusLayoutScrollerRef.current?.getScrollerNode();
			const expandedScrollBody = focusExpandedScrollBodyRef.current;
			const toggleRow = focusExpandedToggleRowRef.current;
			const miniGrid = focusMiniGridRef.current;
			if (!scrollerNode || !expandedScrollBody || !toggleRow || !miniGrid) {
				return false;
			}
			if (scrollerNode.clientHeight <= 0 || miniGrid.clientWidth <= 0) {
				return false;
			}

			const scrollerHeight = scrollerNode.clientHeight;
			const toggleHeight = toggleRow.getBoundingClientRect().height;
			const miniGridWidth = miniGrid.clientWidth;
			const miniGridComputedStyle = window.getComputedStyle(miniGrid);
			const miniGridGap = Number.parseFloat(miniGridComputedStyle.gap) || 12;
			const miniTileMaxWidth =
				Number.parseFloat(miniGridComputedStyle.getPropertyValue('--focus-mini-tile-max-width')) || 380;
			const columns = miniGridWidth >= 1040 ? 4 : miniGridWidth >= 760 ? 3 : miniGridWidth >= 620 ? 2 : 1;
			const maxTileWidth = Math.max(
				1,
				Math.min(miniTileMaxWidth, (miniGridWidth - miniGridGap * Math.max(0, columns - 1)) / columns),
			);
			const maxTileHeight = maxTileWidth / (16 / 9);
			const expandedBodyComputedStyle = window.getComputedStyle(expandedScrollBody);
			const rowGap = Number.parseFloat(expandedBodyComputedStyle.gap) || 12;
			const extraBottomSafety = 12;
			const reservedBottomHeight = toggleHeight + rowGap + maxTileHeight + rowGap + extraBottomSafety;
			const nextMaxHeight = Math.max(140, scrollerHeight - reservedBottomHeight);
			setFocusExpandedMainMaxHeightPx((previousHeight) => {
				if (previousHeight != null && Math.abs(previousHeight - nextMaxHeight) < 0.5) {
					return previousHeight;
				}
				return nextMaxHeight;
			});
			if (!hasForcedExpandedRefreshRef.current) {
				hasForcedExpandedRefreshRef.current = true;
				setFocusExpandedRenderEpoch((previousEpoch) => previousEpoch + 1);
			}
			return true;
		}

		function scheduleRemeasurePasses() {
			if (rafPass >= 4) return;
			rafId = window.requestAnimationFrame(() => {
				rafId = null;
				rafPass += 1;
				const settled = computeExpandedMainMaxHeight();
				if (!settled || rafPass < 3) {
					scheduleRemeasurePasses();
				}
			});
		}

		const hasInitialMeasurement = computeExpandedMainMaxHeight();
		if (!hasInitialMeasurement) {
			scheduleRemeasurePasses();
		} else {
			// Re-measure over a few frames to catch post-commit sizing.
			scheduleRemeasurePasses();
		}

		if (typeof ResizeObserver === 'undefined') {
			return () => {
				if (rafId != null) {
					window.cancelAnimationFrame(rafId);
				}
			};
		}

		const scrollerNode = focusLayoutScrollerRef.current?.getScrollerNode();
		const toggleRow = focusExpandedToggleRowRef.current;
		const miniGrid = focusMiniGridRef.current;
		const expandedScrollBody = focusExpandedScrollBodyRef.current;
		if (!scrollerNode || !toggleRow || !miniGrid || !expandedScrollBody) {
			return;
		}

		const observer = new ResizeObserver(() => {
			computeExpandedMainMaxHeight();
		});

		observer.observe(scrollerNode);
		observer.observe(toggleRow);
		observer.observe(miniGrid);
		observer.observe(expandedScrollBody);

		return () => {
			if (rafId != null) {
				window.cancelAnimationFrame(rafId);
			}
			observer.disconnect();
		};
	}, [carouselTracks.length, isParticipantsExpanded, layoutMode]);
	const participantsToggleLabel = showParticipantsGrid ? t`Hide Participants` : t`Show Participants`;

	const focusLayoutNode = useMemo(() => {
		if (!focusMainTrack && carouselTracks.length === 0) {
			return (
				<div className={clsx(styles.gridLayoutWrapper, compact && styles.gridLayoutWrapperCompact)}>
					<VoiceGridLayout tracks={visibleCameraTracks} compact={compact}>
						<VoiceParticipantTile guildId={channel.guildId} channelId={channel.id} />
					</VoiceGridLayout>
				</div>
			);
		}

		return (
			<div
				className={clsx(
					styles.focusLayoutContent,
					!compact && styles.focusLayoutContentFullscreen,
					compact && styles.focusLayoutContentCompact,
					!isParticipantsExpanded && styles.focusLayoutContentNoParticipants,
					isParticipantsExpanded && styles.focusLayoutParticipantsExpanded,
				)}
				style={focusLayoutComputedStyle}
			>
				<Scroller
					ref={focusLayoutScrollerRef}
					orientation="vertical"
					fade
					className={styles.focusLayoutScroller}
					contentClassName={styles.focusLayoutScrollerContent}
					overflow={isParticipantsExpanded ? 'auto' : 'hidden'}
					onScroll={handleFocusLayoutScroll}
					key="voice-call-focus-layout-scroller"
				>
					{isParticipantsExpanded ? (
						<div ref={focusExpandedScrollBodyRef} className={styles.focusExpandedScrollBody}>
							{focusMainTrack && (
								<div ref={focusMainWrapperRef} className={styles.focusExpandedMainSection}>
									<div className={styles.focusExpandedMainGridViewport}>
										<VoiceGridLayout
											key={`focus-expanded-main-${focusExpandedRenderEpoch}`}
											tracks={[focusMainTrack as TrackReferenceOrPlaceholder]}
										>
											<VoiceParticipantTile
												guildId={channel.guildId}
												channelId={channel.id}
												isPinned={
													(focusMainTrack as TrackReferenceOrPlaceholder).participant.identity ===
													pinnedParticipantIdentity
												}
												showFocusIndicator={false}
											/>
										</VoiceGridLayout>
									</div>
								</div>
							)}
							{canShowParticipantsGridPanel && (
								<>
									<div ref={focusExpandedToggleRowRef} className={styles.focusExpandedToggleRow}>
										<FocusRing offset={-2} className={styles.carouselToggleFocusRing}>
											<Tooltip text={participantsToggleLabel}>
												<button
													type="button"
													className={styles.carouselToggle}
													onClick={handleToggleParticipantsGrid}
													aria-expanded={showParticipantsGrid}
													aria-controls="voice-focus-participants-grid"
													aria-label={participantsToggleLabel}
												>
													{compact ? (
														<UsersIcon weight="bold" className={styles.iconMedium} />
													) : showParticipantsGrid ? (
														<CaretDownIcon weight="bold" className={styles.iconMedium} />
													) : (
														<CaretUpIcon weight="bold" className={styles.iconMedium} />
													)}
												</button>
											</Tooltip>
										</FocusRing>
									</div>
									<div id="voice-focus-participants-grid" className={styles.focusMiniGridSection}>
										<div ref={focusMiniGridRef} className={styles.focusMiniGrid}>
											{carouselTracks.map((trackRef, index) => {
												const key = isTrackReference(trackRef)
													? `${trackRef.participant.identity}-${trackRef.source}`
													: `focus-mini-placeholder-${trackRef.participant.identity}-${index}`;
												const isFocusedTrackMirror =
													focusMainTrack != null &&
													trackRef.participant.identity === focusMainTrack.participant.identity &&
													trackRef.source === focusMainTrack.source;

												return (
													<div key={key} className={styles.focusMiniGridTile}>
														<TrackRefContext.Provider value={trackRef}>
															<ParticipantContext.Provider value={trackRef.participant as Participant}>
																<VoiceParticipantTile
																	guildId={channel.guildId}
																	channelId={channel.id}
																	showFocusIndicator
																	allowAutoSubscribe={!isFocusedTrackMirror}
																	renderFocusedPlaceholder={isFocusedTrackMirror}
																/>
															</ParticipantContext.Provider>
														</TrackRefContext.Provider>
													</div>
												);
											})}
										</div>
									</div>
								</>
							)}
						</div>
					) : (
						<div className={styles.focusLayoutScrollBody}>
							<div ref={focusMainWrapperRef} className={styles.focusLayoutMainWrapper}>
								{focusMainTrack && (
									<div className={styles.focusLayoutMain} style={focusMainStyle}>
										<TrackRefContext.Provider value={focusMainTrack as TrackReferenceOrPlaceholder}>
											<ParticipantContext.Provider
												value={(focusMainTrack as TrackReferenceOrPlaceholder).participant as Participant}
											>
												<VoiceParticipantTile
													guildId={channel.guildId}
													channelId={channel.id}
													isPinned={
														(focusMainTrack as TrackReferenceOrPlaceholder).participant.identity ===
														pinnedParticipantIdentity
													}
													showFocusIndicator={false}
												/>
											</ParticipantContext.Provider>
										</TrackRefContext.Provider>
									</div>
								)}
							</div>
							{canShowParticipantsGridPanel && (
								<div className={styles.carouselToggleWrap}>
									<FocusRing offset={-2} className={styles.carouselToggleFocusRing}>
										<Tooltip text={participantsToggleLabel}>
											<button
												type="button"
												className={styles.carouselToggle}
												onClick={handleToggleParticipantsGrid}
												aria-expanded={showParticipantsGrid}
												aria-controls="voice-focus-participants-grid"
												aria-label={participantsToggleLabel}
											>
												{compact ? (
													<UsersIcon weight="bold" className={styles.iconMedium} />
												) : showParticipantsGrid ? (
													<CaretDownIcon weight="bold" className={styles.iconMedium} />
												) : (
													<CaretUpIcon weight="bold" className={styles.iconMedium} />
												)}
											</button>
										</Tooltip>
									</FocusRing>
								</div>
							)}
						</div>
					)}
				</Scroller>
			</div>
		);
	}, [
		carouselTracks,
		channel.guildId,
		channel.id,
		compact,
		focusMainStyle,
		focusLayoutComputedStyle,
		focusMainTrack,
		handleFocusLayoutScroll,
		canShowParticipantsGridPanel,
		isParticipantsExpanded,
		handleToggleParticipantsGrid,
		participantsToggleLabel,
		pinnedParticipantIdentity,
		showParticipantsGrid,
		t,
		visibleCameraTracks,
	]);

	const gridLayoutNode = useMemo(() => {
		const gridTracks = hasScreenShare ? [...screenShareTracks, ...visibleCameraTracks] : visibleCameraTracks;
		const gridLayoutBody = (
			<div
				className={clsx(
					styles.gridLayoutScrollBody,
					isGridOverflowing && styles.gridLayoutScrollBodyOverflow,
					compact && styles.gridLayoutScrollBodyCompact,
				)}
			>
				<div className={clsx(styles.gridLayoutWrapper, compact && styles.gridLayoutWrapperCompact)}>
					{hasScreenShare ? (
						<div className={styles.screenshareGridLayout}>
							<VoiceGridLayout tracks={gridTracks} onOverflowChange={handleGridOverflowChange} compact={compact}>
								<VoiceParticipantTile guildId={channel.guildId} channelId={channel.id} />
							</VoiceGridLayout>
						</div>
					) : (
						<VoiceGridLayout tracks={gridTracks} onOverflowChange={handleGridOverflowChange} compact={compact}>
							<VoiceParticipantTile guildId={channel.guildId} channelId={channel.id} />
						</VoiceGridLayout>
					)}
				</div>
			</div>
		);

		return (
			<Scroller
				orientation="vertical"
				fade
				className={styles.gridLayoutScroller}
				contentClassName={styles.gridLayoutScrollerContent}
				overflow={isGridOverflowing ? 'auto' : 'hidden'}
			>
				{gridLayoutBody}
			</Scroller>
		);
	}, [
		channel.guildId,
		channel.id,
		compact,
		handleGridOverflowChange,
		hasScreenShare,
		isGridOverflowing,
		screenShareTracks,
		visibleCameraTracks,
	]);

	const mainContentNode = useMemo(() => {
		switch (layoutMode) {
			case 'focus':
				return focusLayoutNode;
			default:
				return gridLayoutNode;
		}
	}, [focusLayoutNode, gridLayoutNode, layoutMode]);

	return <>{mainContentNode}</>;
});
