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

import {getStatusTypeLabel} from '@app/AppConstants';
import {getStatusGeometry} from '@app/components/uikit/AvatarStatusGeometry';
import {getAvatarStatusLayout} from '@app/components/uikit/AvatarStatusLayout';
import styles from '@app/components/uikit/BaseAvatar.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {TYPING_BRIDGE_RIGHT_SHIFT_RATIO} from '@app/components/uikit/TypingConstants';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import FocusManager from '@app/lib/FocusManager';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import typingStyles from '@app/styles/Typing.module.css';
import type {StatusType} from '@fluxer/constants/src/StatusConstants';
import {normalizeStatus, StatusTypes} from '@fluxer/constants/src/StatusConstants';
import {useLingui} from '@lingui/react/macro';
import {motion} from 'framer-motion';
import React, {useEffect, useId, useState} from 'react';

interface BaseAvatarProps {
	size: number;
	avatarUrl: string;
	hoverAvatarUrl?: string;
	status?: StatusType | string | null;
	shouldPlayAnimated?: boolean;
	isTyping?: boolean;
	showOffline?: boolean;
	className?: string;
	isClickable?: boolean;
	userTag?: string;
	statusLabel?: string | null;
	disableStatusTooltip?: boolean;
	isMobileStatus?: boolean;
}

export const BaseAvatar = React.forwardRef<HTMLDivElement, BaseAvatarProps>(
	(
		{
			size,
			avatarUrl,
			hoverAvatarUrl,
			status,
			shouldPlayAnimated = false,
			isTyping = false,
			showOffline = true,
			className,
			isClickable = false,
			userTag,
			statusLabel,
			disableStatusTooltip = false,
			isMobileStatus = false,
			...props
		},
		ref,
	) => {
		const {t, i18n} = useLingui();
		const [isFocused, setIsFocused] = useState(FocusManager.isFocused());

		useEffect(() => {
			const unsubscribe = FocusManager.subscribe(setIsFocused);
			return unsubscribe;
		}, []);

		const normalizedStatus = status == null ? null : normalizeStatus(status);
		const renderableStatus = resolveRenderableStatus(normalizedStatus);

		const layout = getAvatarStatusLayout(size, isMobileStatus);
		const SNAPPY_TRANSITION = {
			type: 'tween',
			duration: AccessibilityStore.useReducedMotion ? 0 : 0.16,
			ease: 'easeOut',
		} as const;

		const rawId = useId();
		const safeId = rawId.replace(/:/g, '');
		const dynamicAvatarMaskId = `svg-mask-avatar-dynamic-${safeId}`;

		const isMobileOnline = isMobileStatus && renderableStatus === StatusTypes.ONLINE && !isTyping;

		const shouldShowStatus =
			layout.supportsStatus &&
			(isTyping || (normalizedStatus != null && (showOffline || renderableStatus !== StatusTypes.OFFLINE)));

		const shouldUseDynamicAvatarMask = shouldShowStatus && !isMobileOnline;
		const statusGeom = shouldUseDynamicAvatarMask ? getStatusGeometry(size, false) : null;

		const cutoutR = statusGeom?.radius ?? 0;
		const cutoutCx = statusGeom?.cx ?? 0;
		const cutoutCy = statusGeom?.cy ?? 0;

		const typingDeltaW = layout.innerTypingWidth - layout.innerStatusWidth;
		const extendW = Math.max(0, typingDeltaW);
		const typingBridgeShift = extendW * TYPING_BRIDGE_RIGHT_SHIFT_RATIO;

		const baseBridgeRect = {
			x: cutoutCx,
			y: cutoutCy - cutoutR,
			width: 0,
			height: cutoutR * 2,
		};

		const typingBridgeRect = {
			x: cutoutCx - extendW + typingBridgeShift,
			y: cutoutCy - cutoutR,
			width: extendW,
			height: cutoutR * 2,
		};

		const baseLeftCap = {cx: cutoutCx};
		const typingLeftCap = {cx: cutoutCx - extendW + typingBridgeShift};
		const baseRightCap = {cx: cutoutCx};
		const typingRightCap = {cx: cutoutCx + typingBridgeShift};

		const candidateUrl = shouldPlayAnimated && hoverAvatarUrl && isFocused ? hoverAvatarUrl : avatarUrl;

		const [imgError, setImgError] = useState(false);

		useEffect(() => {
			setImgError(false);
			if (!candidateUrl) return;
			const img = new Image();
			img.onerror = () => setImgError(true);
			img.src = candidateUrl;
		}, [candidateUrl]);

		if (!candidateUrl || imgError) return null;

		const avatarMaskId = shouldUseDynamicAvatarMask
			? dynamicAvatarMaskId
			: resolveAvatarMaskId({shouldShowStatus, isTyping, isMobileOnline, size});

		const statusMaskId = isMobileOnline
			? `svg-mask-status-online-mobile-${size}`
			: `svg-mask-status-${renderableStatus}`;

		const statusColor = `var(--status-${renderableStatus})`;

		const baseR = layout.innerStatusHeight / 2;
		const typingR = layout.innerTypingHeight / 2;

		const typingAnimation = {
			width: layout.innerTypingWidth,
			height: layout.innerTypingHeight,
			right: layout.innerTypingRight,
			bottom: layout.innerTypingBottom,
			borderRadius: typingR,
		};

		const statusAnimation = {
			width: layout.innerStatusWidth,
			height: layout.innerStatusHeight,
			right: layout.innerStatusRight,
			bottom: layout.innerStatusBottom,
			borderRadius: isMobileOnline ? 0 : baseR,
		};

		const dotDelays = [0, 250, 500] as const;

		const ariaLabel = statusLabel && userTag ? `${userTag}, ${statusLabel}` : userTag || t`Avatar`;
		const effectiveStatusLabel = statusLabel || (normalizedStatus ? getStatusTypeLabel(i18n, normalizedStatus) : '');

		return (
			<FocusRing offset={-2} enabled={isClickable}>
				{/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-label is supported by both button and img roles */}
				<div
					ref={ref}
					className={`${styles.container} ${isClickable ? styles.clickable : ''} ${className || ''}`.trim()}
					role={isClickable ? 'button' : 'img'}
					aria-label={ariaLabel}
					style={{width: size, height: size}}
					aria-hidden={false}
					tabIndex={isClickable ? 0 : undefined}
					{...props}
				>
					<svg
						viewBox={`0 0 ${size} ${size}`}
						className={styles.overlay}
						style={{borderRadius: '50%'}}
						aria-hidden
						role="presentation"
					>
						{shouldUseDynamicAvatarMask && statusGeom && (
							<defs>
								<mask id={dynamicAvatarMaskId} maskUnits="userSpaceOnUse" x={0} y={0} width={size} height={size}>
									<circle fill="white" cx={size / 2} cy={size / 2} r={size / 2} />
									<motion.circle
										fill="black"
										cy={cutoutCy}
										r={cutoutR}
										initial={false}
										animate={isTyping ? typingRightCap : baseRightCap}
										transition={SNAPPY_TRANSITION}
									/>
									<motion.rect
										fill="black"
										rx={0}
										ry={0}
										initial={false}
										animate={isTyping ? typingBridgeRect : baseBridgeRect}
										transition={SNAPPY_TRANSITION}
									/>
									<motion.circle
										fill="black"
										cy={cutoutCy}
										r={cutoutR}
										initial={false}
										animate={isTyping ? typingLeftCap : baseLeftCap}
										transition={SNAPPY_TRANSITION}
									/>
								</mask>
							</defs>
						)}
						<image
							href={candidateUrl}
							width={size}
							height={size}
							mask={`url(#${avatarMaskId})`}
							preserveAspectRatio="xMidYMid slice"
						/>
					</svg>

					<div className={styles.hoverOverlay} style={{borderRadius: '50%'}} />

					{shouldShowStatus && (
						<Tooltip text={effectiveStatusLabel}>
							<motion.div
								className={styles.statusContainer}
								style={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									pointerEvents: isTyping || disableStatusTooltip ? 'none' : 'auto',
									overflow: 'hidden',
								}}
								initial={false}
								animate={isTyping ? typingAnimation : statusAnimation}
								transition={SNAPPY_TRANSITION}
								role="img"
								aria-label={isTyping ? t`Typing indicator` : t`${effectiveStatusLabel} status`}
							>
								{isTyping ? (
									<div
										style={{
											width: '100%',
											height: '100%',
											backgroundColor: statusColor,
											borderRadius: 'inherit',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
										}}
									>
										<div
											style={{
												display: 'flex',
												alignItems: 'center',
												gap: Math.round(layout.innerTypingHeight * 0.12),
											}}
										>
											{dotDelays.map((delay) => (
												<div
													key={delay}
													className={typingStyles.dot}
													style={{
														width: Math.round(layout.innerTypingHeight * 0.25),
														height: Math.round(layout.innerTypingHeight * 0.25),
														borderRadius: '50%',
														backgroundColor: 'white',
														animationDelay: `${delay}ms`,
													}}
												/>
											))}
										</div>
									</div>
								) : (
									<StatusIndicatorSvg
										width={layout.innerStatusWidth}
										height={isMobileOnline ? layout.innerStatusHeight : layout.innerStatusWidth}
										statusColor={statusColor}
										statusMaskId={statusMaskId}
									/>
								)}
							</motion.div>
						</Tooltip>
					)}
				</div>
			</FocusRing>
		);
	},
);

BaseAvatar.displayName = 'BaseAvatar';

const resolveRenderableStatus = (status: StatusType | null | undefined): StatusType => {
	if (status == null) return StatusTypes.OFFLINE;
	if (status === StatusTypes.INVISIBLE) return StatusTypes.OFFLINE;
	return status;
};

const resolveAvatarMaskId = ({
	shouldShowStatus,
	isTyping,
	isMobileOnline,
	size,
}: {
	shouldShowStatus: boolean;
	isTyping: boolean;
	isMobileOnline: boolean;
	size: number;
}): string => {
	if (!shouldShowStatus) return 'svg-mask-avatar-default';
	if (isTyping) return `svg-mask-avatar-status-typing-${size}`;
	if (isMobileOnline) return `svg-mask-avatar-status-mobile-${size}`;
	return `svg-mask-avatar-status-round-${size}`;
};

interface StatusIndicatorSvgProps {
	width: number;
	height: number;
	statusColor: string;
	statusMaskId: string;
}

const StatusIndicatorSvg = ({width, height, statusColor, statusMaskId}: StatusIndicatorSvgProps) => (
	<svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
		<rect x={0} y={0} width={width} height={height} fill={statusColor} mask={`url(#${statusMaskId})`} />
	</svg>
);
