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

import * as TextCopyActionCreators from '@app/actions/TextCopyActionCreators';
import * as UserProfileActionCreators from '@app/actions/UserProfileActionCreators';
import styles from '@app/components/modals/guild_tabs/GuildAuditLogTab.module.css';
import {Avatar} from '@app/components/uikit/Avatar';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import type {UserRecord} from '@app/records/UserRecord';
import {useLingui} from '@lingui/react/macro';
import clsx from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

interface UserTagParts {
	name: string;
	discriminator: string | null;
}

const splitTag = (tag: string): UserTagParts => {
	const idx = tag.lastIndexOf('#');
	if (idx <= 0) return {name: tag, discriminator: null};
	return {name: tag.slice(0, idx), discriminator: tag.slice(idx + 1)};
};

export const ColorDot: React.FC<{color: string; className?: string}> = ({color, className}) => (
	<span className={clsx(styles.colorHook, className)} style={{backgroundColor: color}} aria-hidden />
);

export const InlineCode: React.FC<{children: React.ReactNode; className?: string; title?: string}> = ({
	children,
	className,
	title,
}) => {
	const content = <span className={clsx(styles.inlineCode, className)}>{children}</span>;
	return title ? <Tooltip text={title}>{content}</Tooltip> : content;
};

export const UserHook: React.FC<{user: UserRecord; className?: string}> = ({user, className}) => {
	const parts = splitTag(user.tag);
	return (
		<span className={clsx(styles.userHook, className)}>
			<span className={styles.userName}>{user.displayName ?? parts.name}</span>
			{parts.discriminator ? <span className={styles.discrim}>#{parts.discriminator}</span> : null}
		</span>
	);
};

export const TargetHook: React.FC<{label: string; className?: string; title?: string}> = ({
	label,
	className,
	title,
}) => {
	const content = <strong className={clsx(styles.targetHook, className)}>{label}</strong>;
	return title ? <Tooltip text={title}>{content}</Tooltip> : content;
};

interface ClickableUserProps {
	user: UserRecord;
	guildId?: string;
	className?: string;
	showAvatar?: boolean;
}

export const ClickableUser: React.FC<ClickableUserProps> = observer(({user, guildId, className, showAvatar = true}) => {
	const handleClick = (event: React.MouseEvent) => {
		event.stopPropagation();
		UserProfileActionCreators.openUserProfile(user.id, guildId);
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		event.stopPropagation();
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			UserProfileActionCreators.openUserProfile(user.id, guildId);
		}
	};

	return (
		<FocusRing offset={-2}>
			<span
				className={clsx(styles.clickableUser, className)}
				onClick={handleClick}
				onKeyDown={handleKeyDown}
				role="button"
				tabIndex={0}
			>
				{showAvatar ? <Avatar user={user} size={16} guildId={guildId} /> : null}
				<span className={styles.clickableUserName}>{user.displayName}</span>
			</span>
		</FocusRing>
	);
});

interface CopyIdInlineProps {
	id: string;
	children: React.ReactNode;
	className?: string;
}

export const CopyIdInline: React.FC<CopyIdInlineProps> = ({id, children, className}) => {
	const {i18n, t} = useLingui();

	const copyId = useCallback(() => {
		void TextCopyActionCreators.copy(i18n, id);
	}, [i18n, id]);

	const handleClick = useCallback(
		(event: React.MouseEvent) => {
			event.stopPropagation();
			copyId();
		},
		[copyId],
	);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			event.stopPropagation();
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				copyId();
			}
		},
		[copyId],
	);

	return (
		<Tooltip text={t`Click to copy ID`}>
			<FocusRing offset={-2}>
				<span
					className={clsx(styles.copyIdInline, className)}
					onClick={handleClick}
					onKeyDown={handleKeyDown}
					role="button"
					tabIndex={0}
				>
					{children}
				</span>
			</FocusRing>
		</Tooltip>
	);
};
