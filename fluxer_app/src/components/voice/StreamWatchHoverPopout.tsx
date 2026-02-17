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

import * as NavigationActionCreators from '@app/actions/NavigationActionCreators';
import * as VoiceCallLayoutActionCreators from '@app/actions/VoiceCallLayoutActionCreators';
import {useTooltipPortalRoot} from '@app/components/uikit/tooltip/Tooltip';
import {parseStreamKey} from '@app/components/voice/StreamKeys';
import {StreamWatchHoverCard} from '@app/components/voice/StreamWatchHoverCard';
import {useStreamPreview} from '@app/components/voice/useStreamPreview';
import {useStreamWatchState} from '@app/components/voice/useStreamWatchState';
import {useMergeRefs} from '@app/hooks/useMergeRefs';
import {usePendingVoiceConnection} from '@app/hooks/usePendingVoiceConnection';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import PermissionStore from '@app/stores/PermissionStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {canViewStreamPreview} from '@app/utils/StreamPreviewPermissionUtils';
import type {Placement} from '@floating-ui/react';
import {
	autoUpdate,
	FloatingPortal,
	flip,
	offset,
	safePolygon,
	shift,
	useFloating,
	useFocus,
	useHover,
	useInteractions,
} from '@floating-ui/react';
import {ME} from '@fluxer/constants/src/AppConstants';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import type {MotionStyle, Transition} from 'framer-motion';
import {AnimatePresence, motion} from 'framer-motion';
import {Track} from 'livekit-client';
import {observer} from 'mobx-react-lite';
import type {FocusEvent, HTMLAttributes, MouseEvent, ReactElement, Ref, SyntheticEvent} from 'react';
import {Children, cloneElement, useCallback, useEffect, useMemo, useState} from 'react';

interface StreamWatchHoverPopoutProps extends HTMLAttributes<HTMLElement> {
	streamKey: string;
	guildId: string | null;
	channelId: string | null;
	enabled: boolean;
	children: ReactElement<HTMLAttributes<HTMLElement> & {ref?: Ref<HTMLElement>}>;
}

const FLOATING_INITIAL = {opacity: 0, scale: 0.98};
const FLOATING_INITIAL_REDUCED = {opacity: 1, scale: 1};
const FLOATING_ANIMATE = {opacity: 1, scale: 1};
const FLOATING_EXIT = {opacity: 0, scale: 0.98};
const FLOATING_EXIT_REDUCED = {opacity: 1, scale: 1};
const FLOATING_TRANSITION: Transition = {
	opacity: {duration: 0.1},
	scale: {type: 'spring', damping: 25, stiffness: 500},
};
const FLOATING_TRANSITION_REDUCED: Transition = {duration: 0};
const FLOATING_PLACEMENT: Placement = 'right';

export const StreamWatchHoverPopout = observer(function StreamWatchHoverPopout({
	streamKey,
	guildId,
	channelId,
	enabled,
	children,
	...rest
}: StreamWatchHoverPopoutProps) {
	const {t} = useLingui();
	const portalRoot = useTooltipPortalRoot();
	const isMobileLayout = MobileLayoutStore.isMobileLayout();
	const isPopoutEnabled = useMemo(() => enabled && !isMobileLayout, [enabled, isMobileLayout]);
	const [isOpen, setIsOpen] = useState(false);
	const floatingMiddleware = useMemo(() => [offset(16), flip(), shift({padding: 8})], []);
	const floatingOptions = useMemo(
		() => ({
			open: isOpen,
			onOpenChange: setIsOpen,
			placement: FLOATING_PLACEMENT,
			middleware: floatingMiddleware,
			whileElementsMounted: autoUpdate,
		}),
		[floatingMiddleware, isOpen, setIsOpen],
	);
	const {x, y, refs, strategy, context} = useFloating(floatingOptions);
	useEffect(() => {
		if (!isPopoutEnabled && isOpen) {
			setIsOpen(false);
		}
	}, [isPopoutEnabled, isOpen]);
	const hoverDelay = useMemo(() => ({open: 200, close: 150}), []);
	const hoverSafePolygon = useMemo(() => safePolygon({buffer: 4, requireIntent: false}), []);
	const hoverOptions = useMemo(
		() => ({delay: hoverDelay, handleClose: hoverSafePolygon}),
		[hoverDelay, hoverSafePolygon],
	);
	const hover = useHover(context, hoverOptions);
	const focus = useFocus(context);
	const interactions = useMemo(() => [hover, focus], [focus, hover]);
	const {getReferenceProps, getFloatingProps} = useInteractions(interactions);
	const canFetchStreamPreview = canViewStreamPreview({
		guildId,
		channelId,
		hasConnectPermission: () =>
			PermissionStore.can(Permissions.CONNECT, {guildId: guildId ?? undefined, channelId: channelId ?? undefined}),
	});
	const isPreviewActive = useMemo(
		() => isOpen && isPopoutEnabled && canFetchStreamPreview,
		[isOpen, isPopoutEnabled, canFetchStreamPreview],
	);
	const {previewUrl, isPreviewLoading} = useStreamPreview(isPreviewActive, streamKey);
	const streamWatchStateArgs = useMemo(
		() => ({
			streamKey,
			guildId,
			channelId,
		}),
		[streamKey, guildId, channelId],
	);
	const {isWatching, isPendingJoin, canWatch, startWatching} = useStreamWatchState(streamWatchStateArgs);
	const isConnectedToChannel = useMemo(() => {
		if (!channelId) return false;
		return MediaEngineStore.channelId === channelId && MediaEngineStore.guildId === (guildId ?? null);
	}, [channelId, guildId, MediaEngineStore.channelId, MediaEngineStore.guildId]);

	const handleNavigateToWatch = useCallback(() => {
		if (guildId && channelId) {
			NavigationActionCreators.selectChannel(guildId, channelId);
		} else if (channelId) {
			NavigationActionCreators.selectChannel(ME, channelId);
		}
	}, [guildId, channelId]);

	const {markPending: markWatchNavigationPending} = usePendingVoiceConnection({
		guildId,
		channelId,
		onConnected: handleNavigateToWatch,
	});

	const isOwnLocalStream = useMemo(() => {
		const localConnectionId = MediaEngineStore.connectionId;
		if (!localConnectionId || !streamKey) return false;
		const parsed = parseStreamKey(streamKey);
		return parsed?.connectionId === localConnectionId;
	}, [streamKey, MediaEngineStore.connectionId]);

	const child = Children.only(children);
	const referenceRefs = useMemo(() => [refs.setReference, child.props.ref], [refs.setReference, child.props.ref]);
	const mergedRef = useMergeRefs(referenceRefs);
	const watchLabel = useMemo(() => {
		if (isOwnLocalStream) return t`You're Streaming!`;
		if (isWatching) return t`Watching Stream`;
		return t`Watch Stream`;
	}, [isOwnLocalStream, isWatching, t]);
	const watchDisabled = useMemo(
		() => isOwnLocalStream || !canWatch || isPendingJoin || isWatching,
		[isOwnLocalStream, canWatch, isPendingJoin, isWatching],
	);
	const fallbackProps = useMemo(() => ({...rest}), [rest]);
	const {
		onMouseEnter: onRestMouseEnter,
		onMouseLeave: onRestMouseLeave,
		onFocus: onRestFocus,
		onBlur: onRestBlur,
		onContextMenu: onRestContextMenu,
		onClick: onRestClick,
		...restProps
	} = rest;
	const {
		onMouseEnter: onChildMouseEnter,
		onMouseLeave: onChildMouseLeave,
		onFocus: onChildFocus,
		onBlur: onChildBlur,
		onContextMenu: onChildContextMenu,
		onClick: onChildClick,
	} = child.props;
	const stopPropagation = useCallback((event: SyntheticEvent) => {
		event.stopPropagation();
	}, []);
	const handleReferenceMouseEnter = useCallback(
		(event: MouseEvent<HTMLElement>) => {
			onChildMouseEnter?.(event);
			onRestMouseEnter?.(event);
		},
		[onChildMouseEnter, onRestMouseEnter],
	);
	const handleReferenceMouseLeave = useCallback(
		(event: MouseEvent<HTMLElement>) => {
			onChildMouseLeave?.(event);
			onRestMouseLeave?.(event);
		},
		[onChildMouseLeave, onRestMouseLeave],
	);
	const handleReferenceFocus = useCallback(
		(event: FocusEvent<HTMLElement>) => {
			onChildFocus?.(event);
			onRestFocus?.(event);
		},
		[onChildFocus, onRestFocus],
	);
	const handleReferenceBlur = useCallback(
		(event: FocusEvent<HTMLElement>) => {
			onChildBlur?.(event);
			onRestBlur?.(event);
		},
		[onChildBlur, onRestBlur],
	);
	const handleReferenceContextMenu = useCallback(
		(event: MouseEvent<HTMLElement>) => {
			onChildContextMenu?.(event);
			onRestContextMenu?.(event);
		},
		[onChildContextMenu, onRestContextMenu],
	);
	const handleReferenceClick = useCallback(
		(event: MouseEvent<HTMLElement>) => {
			onChildClick?.(event);
			onRestClick?.(event);
		},
		[onChildClick, onRestClick],
	);
	const referenceHandlers = useMemo(
		() => ({
			onMouseEnter: handleReferenceMouseEnter,
			onMouseLeave: handleReferenceMouseLeave,
			onFocus: handleReferenceFocus,
			onBlur: handleReferenceBlur,
			onContextMenu: handleReferenceContextMenu,
			onClick: handleReferenceClick,
		}),
		[
			handleReferenceMouseEnter,
			handleReferenceMouseLeave,
			handleReferenceFocus,
			handleReferenceBlur,
			handleReferenceContextMenu,
			handleReferenceClick,
		],
	);
	const referenceProps = useMemo(
		() =>
			getReferenceProps({
				...restProps,
				...referenceHandlers,
				ref: mergedRef,
				...(isOpen && {'data-popout-open': 'true'}),
			}),
		[getReferenceProps, isOpen, mergedRef, referenceHandlers, restProps],
	);
	const floatingProps = useMemo(
		() =>
			getFloatingProps({
				ref: refs.setFloating,
				onMouseDown: stopPropagation,
				onTouchStart: stopPropagation,
				onClick: stopPropagation,
			}),
		[getFloatingProps, refs.setFloating, stopPropagation],
	);
	const floatingStyles = useMemo(
		(): MotionStyle => ({
			position: strategy,
			left: x ?? 0,
			top: y ?? 0,
			zIndex: 'var(--z-index-tooltip)',
			visibility: x === null || y === null ? 'hidden' : 'visible',
			pointerEvents: 'auto',
		}),
		[strategy, x, y],
	);

	const streamParticipantIdentity = useMemo(() => {
		const parsed = parseStreamKey(streamKey);
		if (!parsed) return null;
		const {connectionId} = parsed;
		if (!connectionId) return null;
		const participants = MediaEngineStore.participants;
		for (const p of Object.values(participants)) {
			if (p.connectionId === connectionId) return p.identity;
		}
		return null;
	}, [streamKey, MediaEngineStore.participants]);

	const handleWatch = useCallback(
		(event: SyntheticEvent) => {
			event.stopPropagation();
			if (watchDisabled) return;
			startWatching();
			if (streamParticipantIdentity) {
				VoiceCallLayoutActionCreators.setLayoutMode('focus');
				VoiceCallLayoutActionCreators.setPinnedParticipant(streamParticipantIdentity, Track.Source.ScreenShare);
				VoiceCallLayoutActionCreators.markUserOverride();
			}
			if (isConnectedToChannel) {
				handleNavigateToWatch();
			} else if (channelId) {
				markWatchNavigationPending();
			}
		},
		[
			startWatching,
			watchDisabled,
			streamParticipantIdentity,
			isConnectedToChannel,
			channelId,
			handleNavigateToWatch,
			markWatchNavigationPending,
		],
	);

	const handlePreviewClick = useCallback(
		(event: MouseEvent<Element>) => {
			event.stopPropagation();
			if (isWatching && streamParticipantIdentity) {
				VoiceCallLayoutActionCreators.setLayoutMode('focus');
				VoiceCallLayoutActionCreators.setPinnedParticipant(streamParticipantIdentity, Track.Source.ScreenShare);
				VoiceCallLayoutActionCreators.markUserOverride();
			} else if (!watchDisabled) {
				handleWatch(event);
			}
		},
		[isWatching, streamParticipantIdentity, watchDisabled, handleWatch],
	);

	if (!isPopoutEnabled) {
		return cloneElement(child, fallbackProps);
	}

	return (
		<>
			{cloneElement(child, referenceProps)}
			{portalRoot && (
				<FloatingPortal root={portalRoot}>
					<AnimatePresence>
						{isOpen && (
							<motion.div
								{...floatingProps}
								style={floatingStyles}
								initial={AccessibilityStore.useReducedMotion ? FLOATING_INITIAL_REDUCED : FLOATING_INITIAL}
								animate={FLOATING_ANIMATE}
								exit={AccessibilityStore.useReducedMotion ? FLOATING_EXIT_REDUCED : FLOATING_EXIT}
								transition={AccessibilityStore.useReducedMotion ? FLOATING_TRANSITION_REDUCED : FLOATING_TRANSITION}
							>
								<StreamWatchHoverCard
									variant="list"
									previewUrl={previewUrl}
									isPreviewLoading={isPreviewLoading}
									watchLabel={watchLabel}
									watchDisabled={watchDisabled}
									isWatching={isWatching}
									isSubmitting={isPendingJoin}
									onWatch={handleWatch}
									onPreviewClick={handlePreviewClick}
									showProtip={!isWatching}
								/>
							</motion.div>
						)}
					</AnimatePresence>
				</FloatingPortal>
			)}
		</>
	);
});
