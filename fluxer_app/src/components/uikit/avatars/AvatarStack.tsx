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

import {PreloadableUserPopout} from '@app/components/channel/PreloadableUserPopout';
import {Avatar} from '@app/components/uikit/Avatar';
import styles from '@app/components/uikit/avatars/AvatarStack.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import type {UserRecord} from '@app/records/UserRecord';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import React from 'react';

export interface AvatarStackProps {
	children?: React.ReactNode;
	users?: ReadonlyArray<UserRecord>;
	size?: number;
	maxVisible?: number;
	overlap?: number;
	className?: string;
	guildId?: string | null;
	channelId?: string | null;
	renderAvatar?: (user: UserRecord, size: number) => React.ReactNode;
	enableProfileModal?: boolean;
	showTooltips?: boolean;
	remainingContent?: React.ReactNode;
	onUserContextMenu?: (event: React.MouseEvent<HTMLElement>, user: UserRecord) => void;
}

export const AvatarStack: React.FC<AvatarStackProps> = observer(
	({
		children,
		users,
		size = 28,
		maxVisible = 3,
		overlap,
		className,
		guildId,
		channelId,
		renderAvatar,
		enableProfileModal = true,
		showTooltips = true,
		remainingContent,
		onUserContextMenu,
	}) => {
		const {t} = useLingui();

		const childArray = React.Children.toArray(children).filter(Boolean);

		const userChildren =
			users?.map((user) => {
				const displayName = NicknameUtils.getNickname(user, guildId ?? undefined, channelId ?? undefined);
				const avatarNode = renderAvatar?.(user, size) ?? (
					<Avatar user={user} size={size} guildId={guildId ?? undefined} />
				);
				if (!avatarNode) return null;

				if (enableProfileModal) {
					const profileTrigger = (
						<FocusRing offset={-2}>
							<button type="button" className={styles.avatarButton} aria-label={t`Open profile for ${displayName}`}>
								{avatarNode}
							</button>
						</FocusRing>
					);
					return (
						<PreloadableUserPopout
							key={user.id}
							user={user}
							isWebhook={false}
							guildId={guildId ?? undefined}
							channelId={channelId ?? undefined}
							disableContextMenu={true}
							tooltip={showTooltips ? displayName : undefined}
						>
							{profileTrigger}
						</PreloadableUserPopout>
					);
				}

				const content = <div className={styles.avatarContent}>{avatarNode}</div>;
				if (!showTooltips) {
					return React.cloneElement(content, {key: user.id});
				}

				return (
					<Tooltip key={user.id} text={displayName}>
						{content}
					</Tooltip>
				);
			}) ?? [];

		const resolvedChildren = users ? userChildren.filter(Boolean) : childArray;
		const totalCount = resolvedChildren.length;

		const visibleChildren = resolvedChildren.slice(0, maxVisible);
		const remainingCount = Math.max(0, totalCount - maxVisible);
		const computedOutline = Math.min(3, Math.max(1, Math.round(size * 0.05)));
		const computedOverlap = overlap !== undefined ? overlap : Math.round(-0.35 * size);

		const cssVars = {
			'--avatar-size': `${size}px`,
			'--avatar-overlap': `${computedOverlap}px`,
			'--avatar-outline': `${computedOutline}px`,
		} as React.CSSProperties;

		const wrapWithContextMenu = (node: React.ReactNode, user: UserRecord) => {
			if (!onUserContextMenu) return node;
			const displayName = NicknameUtils.getNickname(user, guildId ?? undefined, channelId ?? undefined);
			return (
				<div
					className={styles.avatarContextMenuWrap}
					onContextMenu={(e) => onUserContextMenu(e, user)}
					role="group"
					aria-label={displayName ?? user.username}
				>
					{node}
				</div>
			);
		};

		const userChildrenWithContextMenu =
			users && onUserContextMenu
				? userChildren.map((child, index) => {
						const user = users[index];
						return user ? wrapWithContextMenu(child, user) : child;
					})
				: resolvedChildren;

		const finalVisibleChildren = users ? userChildrenWithContextMenu.slice(0, maxVisible) : visibleChildren;

		return (
			<div className={clsx(styles.container, className)} style={cssVars}>
				{finalVisibleChildren.map((child, index) => (
					<div
						key={index}
						className={clsx(
							styles.avatar,
							(index < finalVisibleChildren.length - 1 || remainingCount > 0) && styles.withMask,
						)}
					>
						{child}
					</div>
				))}
				{remainingCount > 0 && (remainingContent ?? <div className={styles.remainingCount}>+{remainingCount}</div>)}
			</div>
		);
	},
);
