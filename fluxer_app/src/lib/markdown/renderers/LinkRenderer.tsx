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

import * as InviteActionCreators from '@app/actions/InviteActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as NavigationActionCreators from '@app/actions/NavigationActionCreators';
import * as ThemeActionCreators from '@app/actions/ThemeActionCreators';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {ExternalLinkWarningModal} from '@app/components/modals/ExternalLinkWarningModal';
import {UserSettingsModal} from '@app/components/modals/UserSettingsModal';
import {GuildIcon} from '@app/components/popouts/GuildIcon';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Logger} from '@app/lib/Logger';
import jumpLinkStyles from '@app/lib/markdown/renderers/MessageJumpLink.module.css';
import {MarkdownContext, type RendererProps} from '@app/lib/markdown/renderers/RendererTypes';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {GuildRecord} from '@app/records/GuildRecord';
import ChannelStore from '@app/stores/ChannelStore';
import DeveloperModeStore from '@app/stores/DeveloperModeStore';
import GuildStore from '@app/stores/GuildStore';
import TrustedDomainStore from '@app/stores/TrustedDomainStore';
import markupStyles from '@app/styles/Markup.module.css';
import {APP_PROTOCOL_PREFIX} from '@app/utils/AppProtocol';
import {getDMDisplayName, getIcon, getName} from '@app/utils/ChannelUtils';
import {
	isInternalChannelHost,
	parseChannelJumpLink,
	parseChannelUrl,
	parseMessageJumpLink,
} from '@app/utils/DeepLinkUtils';
import * as InviteUtils from '@app/utils/InviteUtils';
import {goToMessage} from '@app/utils/MessageNavigator';
import {openExternalUrl} from '@app/utils/NativeUtils';
import * as ThemeUtils from '@app/utils/ThemeUtils';
import {ME} from '@fluxer/constants/src/AppConstants';
import type {LinkNode} from '@fluxer/markdown_parser/src/types/Nodes';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {CaretRightIcon, ChatTeardropIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

const logger = new Logger('LinkRenderer');

interface JumpLinkMentionProps {
	channel: ChannelRecord;
	guild: GuildRecord | null;
	messageId?: string;
	i18n: I18n;
	interactive?: boolean;
}

const JumpLinkMention = observer(function JumpLinkMention({
	channel,
	guild,
	messageId,
	i18n,
	interactive = true,
}: JumpLinkMentionProps) {
	const handleClick = useCallback(
		(event: React.MouseEvent<HTMLButtonElement | HTMLSpanElement>) => {
			if (!interactive) return;
			event.preventDefault();
			event.stopPropagation();

			if (messageId) {
				goToMessage(channel.id, messageId);
				return;
			}

			NavigationActionCreators.selectChannel(channel.guildId ?? undefined, channel.id);
		},
		[channel.id, channel.guildId, messageId],
	);

	const displayName = channel.isPrivate() ? getDMDisplayName(channel) : (channel.name ?? channel.id);
	const labelText = guild ? guild.name : displayName;
	const shouldShowChannelInfo = !messageId && Boolean(channel.guildId);
	const channelDisplayName = channel.name ?? getName(channel);
	const isDMChannel = channel.isPrivate() && !channel.guildId;
	const shouldShowDMIconLabel = isDMChannel && !messageId;
	const hasDetailChunk = Boolean(messageId) || shouldShowChannelInfo;
	const ariaLabel = messageId
		? labelText
			? i18n._(msg`Jump to the message in ${labelText}`)
			: i18n._(msg`Jump to the linked message`)
		: labelText
			? i18n._(msg`Jump to ${labelText}`)
			: i18n._(msg`Jump to the linked channel`);

	const Component = interactive ? 'button' : 'span';

	return (
		<Component
			{...(interactive ? {type: 'button'} : {})}
			className={clsx(markupStyles.mention, interactive && markupStyles.interactive, jumpLinkStyles.jumpLinkButton)}
			onClick={handleClick}
			aria-label={ariaLabel}
			tabIndex={interactive ? 0 : -1}
		>
			<span className={jumpLinkStyles.jumpLinkInfo}>
				{guild ? (
					<span className={jumpLinkStyles.jumpLinkGuild}>
						<GuildIcon
							id={guild.id}
							name={guild.name}
							icon={guild.icon}
							className={jumpLinkStyles.jumpLinkGuildIcon}
							containerProps={{'data-jump-link-guild-icon': ''}}
						/>
						<span className={jumpLinkStyles.jumpLinkGuildName}>{guild.name}</span>
					</span>
				) : shouldShowDMIconLabel ? (
					<span className={jumpLinkStyles.jumpLinkDm}>
						<span className={jumpLinkStyles.jumpLinkChannelIcon}>{getIcon(channel, {size: 12})}</span>
						<span className={jumpLinkStyles.jumpLinkDmName}>{displayName}</span>
					</span>
				) : (
					<span className={jumpLinkStyles.jumpLinkLabel}>{displayName}</span>
				)}
				{hasDetailChunk && (
					<span className={jumpLinkStyles.jumpLinkMessage} aria-hidden="true">
						<CaretRightIcon size={6} weight="bold" className={jumpLinkStyles.jumpLinkCaret} />
						{messageId ? (
							<span className={jumpLinkStyles.jumpLinkMessageIcon}>
								<ChatTeardropIcon size={12} weight="fill" />
							</span>
						) : (
							shouldShowChannelInfo && (
								<span className={jumpLinkStyles.jumpLinkChannel}>
									<span className={jumpLinkStyles.jumpLinkChannelIcon}>{getIcon(channel, {size: 12})}</span>
									<span className={jumpLinkStyles.jumpLinkChannelName}>{channelDisplayName}</span>
								</span>
							)
						)}
					</span>
				)}
			</span>
		</Component>
	);
});

export const LinkRenderer = observer(function LinkRenderer({
	node,
	id,
	renderChildren,
	options,
}: RendererProps<LinkNode>): React.ReactElement {
	const i18n = options.i18n!;
	const {url, text} = node;
	const content = text ? renderChildren([text]) : url;

	const inviteCode = InviteUtils.findInvite(url);
	const themeCode = ThemeUtils.findTheme(url);
	const messageJumpTarget = parseMessageJumpLink(url);
	const jumpTarget = messageJumpTarget ?? parseChannelJumpLink(url);
	const jumpChannel = jumpTarget ? (ChannelStore.getChannel(jumpTarget.channelId) ?? null) : null;
	const jumpGuild = jumpChannel?.guildId ? (GuildStore.getGuild(jumpChannel.guildId) ?? null) : null;
	const isInlineReplyContext = options.context === MarkdownContext.RESTRICTED_INLINE_REPLY;
	const shouldDisableInteractions = options.disableInteractions === true;

	if (jumpTarget && jumpChannel) {
		const mention = (
			<JumpLinkMention
				channel={jumpChannel}
				guild={jumpGuild}
				messageId={messageJumpTarget?.messageId}
				i18n={i18n}
				interactive={!isInlineReplyContext && !shouldDisableInteractions}
			/>
		);

		return shouldDisableInteractions || isInlineReplyContext ? mention : <FocusRing key={id}>{mention}</FocusRing>;
	}

	if (shouldDisableInteractions) {
		return (
			<span key={id} className={markupStyles.link}>
				{content}
			</span>
		);
	}

	const shouldShowAccessDeniedModal = Boolean(jumpTarget && !jumpChannel);

	let isInternal = false;
	let handleClick: ((e: React.MouseEvent) => void) | undefined;

	if (shouldShowAccessDeniedModal) {
		handleClick = (event) => {
			event.preventDefault();
			event.stopPropagation();
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={i18n._(msg`Channel Access Denied`)}
						description={i18n._(msg`You do not have access to the channel where this message was sent.`)}
						primaryText={i18n._(msg`Okay`)}
						primaryVariant="primary"
						secondaryText={false}
						onPrimary={() => {}}
					/>
				)),
			);
		};
		isInternal = true;
	} else if (url === `${APP_PROTOCOL_PREFIX}dev`) {
		handleClick = (e) => {
			e.preventDefault();
			if (DeveloperModeStore.isDeveloper) {
				ModalActionCreators.push(modal(() => <UserSettingsModal initialTab="developer_options" />));
			} else {
				ModalActionCreators.push(
					modal(() => (
						<ConfirmModal
							title={i18n._(msg`Secret Link Found!`)}
							description={i18n._(msg`You found a secret link, but it wasn't meant for you!`)}
							primaryText={i18n._(msg`Okay`)}
							primaryVariant="primary"
							secondaryText={false}
							onPrimary={() => {}}
						/>
					)),
				);
			}
		};
		isInternal = true;
	} else {
		try {
			const parsed = new URL(url);
			isInternal = isInternalChannelHost(parsed.host) && parsed.pathname.startsWith('/channels/');

			if (inviteCode) {
				handleClick = (e) => {
					e.preventDefault();
					InviteActionCreators.acceptAndTransitionToChannel(inviteCode, i18n);
				};
			} else if (themeCode) {
				handleClick = (e) => {
					e.preventDefault();
					ThemeActionCreators.openAcceptModal(themeCode, i18n);
				};
				isInternal = true;
			} else if (isInternal) {
				const channelJump = parseChannelJumpLink(url);
				if (channelJump) {
					handleClick = (e) => {
						e.preventDefault();
						NavigationActionCreators.selectChannel(
							channelJump.scope === ME ? undefined : channelJump.scope,
							channelJump.channelId,
						);
					};
				} else if (parseChannelUrl(url)) {
					handleClick = (e) => {
						e.preventDefault();
						NavigationActionCreators.deselectGuild();
					};
				} else {
					isInternal = false;
				}
			}

			if (!isInternal && !inviteCode) {
				const isTrusted = TrustedDomainStore.isTrustedDomain(parsed.hostname);
				if (!isTrusted) {
					handleClick = (e) => {
						e.preventDefault();
						ModalActionCreators.push(modal(() => <ExternalLinkWarningModal url={url} />));
					};
				}
			}
		} catch (_error) {
			logger.warn('Invalid URL in link:', url);
		}
	}

	return (
		<FocusRing key={id}>
			<a
				href={url}
				target={isInternal ? undefined : '_blank'}
				rel={isInternal ? undefined : 'noopener noreferrer'}
				onClick={(e) => {
					e.stopPropagation();
					if (handleClick) {
						handleClick(e);
						return;
					}
					if (!isInternal) {
						e.preventDefault();
						void openExternalUrl(url);
					}
				}}
				className={markupStyles.link}
			>
				{content}
			</a>
		</FocusRing>
	);
});
