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
import {Attachment} from '@app/components/channel/embeds/attachments/Attachment';
import {AttachmentMosaic} from '@app/components/channel/embeds/attachments/AttachmentMosaic';
import {Embed} from '@app/components/channel/embeds/Embed';
import {GiftEmbed} from '@app/components/channel/GiftEmbed';
import {InviteEmbed} from '@app/components/channel/InviteEmbed';
import {getAttachmentRenderingState} from '@app/components/channel/MessageAttachmentStateUtils';
import styles from '@app/components/channel/MessageAttachments.module.css';
import {MessageReactions} from '@app/components/channel/MessageReactions';
import {useMessageViewContext} from '@app/components/channel/MessageViewContext';
import {ThemeEmbed} from '@app/components/channel/ThemeEmbed';
import {GroupDMAvatar} from '@app/components/common/GroupDMAvatar';
import {GuildIcon} from '@app/components/popouts/GuildIcon';
import {Avatar} from '@app/components/uikit/Avatar';
import {MediaContextMenu} from '@app/components/uikit/context_menu/MediaContextMenu';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useStickerAnimation} from '@app/hooks/useStickerAnimation';
import {SafeMarkdown} from '@app/lib/markdown';
import {MarkdownContext} from '@app/lib/markdown/renderers/RendererTypes';
import type {MessageRecord} from '@app/records/MessageRecord';
import GuildStore from '@app/stores/GuildStore';
import StickerStore from '@app/stores/StickerStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import markupStyles from '@app/styles/Markup.module.css';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import {useForwardedMessageContext} from '@app/utils/ForwardedMessageUtils';
import {goToMessage} from '@app/utils/MessageNavigator';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import type {MessageEmbed} from '@fluxer/schema/src/domains/message/EmbedSchemas';
import type {
	MessageAttachment,
	MessageSnapshot,
	MessageStickerItem,
} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {Trans} from '@lingui/react/macro';
import {ArrowBendUpRightIcon, CaretRightIcon, HashIcon, NotePencilIcon, SpeakerHighIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

const ForwardedFromSource = observer(({message}: {message: MessageRecord}) => {
	const {sourceChannel, sourceGuild, sourceUser, hasAccessToSource, displayName} = useForwardedMessageContext(message);

	const handleJumpToOriginal = useCallback(() => {
		if (message.messageReference && sourceChannel) {
			goToMessage(message.messageReference.channel_id, message.messageReference.message_id);
		}
	}, [message.messageReference, sourceChannel]);

	const renderChannelIcon = useCallback(() => {
		if (!sourceChannel) return null;

		const iconSize = 16;

		if (sourceChannel.type === ChannelTypes.DM_PERSONAL_NOTES) {
			return <NotePencilIcon className={styles.forwardedSourceIcon} weight="fill" size={iconSize} />;
		}
		if (sourceChannel.type === ChannelTypes.DM && sourceUser) {
			return (
				<div className={styles.forwardedSourceAvatar}>
					<Avatar user={sourceUser} size={iconSize} status={null} />
				</div>
			);
		}
		if (sourceChannel.type === ChannelTypes.GROUP_DM) {
			return (
				<div className={styles.forwardedSourceAvatar}>
					<GroupDMAvatar channel={sourceChannel} size={iconSize} />
				</div>
			);
		}
		if (sourceChannel.type === ChannelTypes.GUILD_VOICE) {
			return <SpeakerHighIcon className={styles.forwardedSourceIcon} weight="fill" size={iconSize} />;
		}
		return <HashIcon className={styles.forwardedSourceIcon} weight="bold" size={iconSize} />;
	}, [sourceChannel, sourceUser]);

	if (!hasAccessToSource || !sourceChannel || !displayName || !message.messageReference) {
		return null;
	}

	if (
		sourceChannel.type === ChannelTypes.DM ||
		sourceChannel.type === ChannelTypes.GROUP_DM ||
		sourceChannel.type === ChannelTypes.DM_PERSONAL_NOTES
	) {
		return (
			<FocusRing>
				<button type="button" onClick={handleJumpToOriginal} className={styles.forwardedSourceButton}>
					<span className={styles.forwardedSourceLabel}>
						<Trans>Forwarded from</Trans>
					</span>
					<span className={styles.forwardedSourceInfo}>
						{renderChannelIcon()}
						<span className={styles.forwardedSourceName}>{displayName}</span>
					</span>
				</button>
			</FocusRing>
		);
	}

	if (sourceGuild) {
		return (
			<FocusRing>
				<button type="button" onClick={handleJumpToOriginal} className={styles.forwardedSourceButton}>
					<span className={styles.forwardedSourceLabel}>
						<Trans>Forwarded from</Trans>
					</span>
					<span className={styles.forwardedSourceInfo}>
						<GuildIcon
							id={sourceGuild.id}
							name={sourceGuild.name}
							icon={sourceGuild.icon}
							className={styles.forwardedSourceGuildIcon}
							sizePx={16}
						/>
						<span className={styles.forwardedSourceName}>{sourceGuild.name}</span>
						<CaretRightIcon className={styles.forwardedSourceChevron} weight="bold" size={12} />
						{renderChannelIcon()}
						<span className={styles.forwardedSourceName}>{displayName}</span>
					</span>
				</button>
			</FocusRing>
		);
	}

	return null;
});

interface ForwardedMessageContentProps {
	message: MessageRecord;
	snapshot: MessageSnapshot;
	onDelete?: (bypassConfirm?: boolean) => void;
}

const ForwardedMessageContent = observer(({message, snapshot, onDelete}: ForwardedMessageContentProps) => {
	const snapshotIsPreview = true;
	return (
		<div className={styles.forwardedContainer}>
			<div className={styles.forwardedBar} />
			<div className={styles.forwardedContent}>
				<div className={styles.forwardedHeader}>
					<ArrowBendUpRightIcon className={styles.forwardedIcon} weight="bold" />
					<span className={styles.forwardedLabel}>
						<Trans>Forwarded</Trans>
					</span>
				</div>

				{snapshot.content && (
					<div className={clsx(markupStyles.markup)} data-search-highlight-scope="message">
						<SafeMarkdown
							content={snapshot.content}
							options={{
								context: MarkdownContext.STANDARD_WITH_JUMBO,
								messageId: message.id,
								channelId: message.channelId,
							}}
						/>
					</div>
				)}

				{snapshot.attachments && snapshot.attachments.length > 0 && (
					<div className={styles.attachmentsContainer}>
						{(() => {
							const {enrichedAttachments, mediaAttachments, shouldUseMosaic} = getAttachmentRenderingState(
								snapshot.attachments,
							);
							return (
								<>
									{shouldUseMosaic && (
										<AttachmentMosaic
											attachments={mediaAttachments}
											message={message}
											isPreview={snapshotIsPreview}
											onDelete={onDelete}
										/>
									)}
									{enrichedAttachments.map((attachment: MessageAttachment) => (
										<Attachment
											key={attachment.id}
											attachment={attachment}
											isPreview={snapshotIsPreview}
											message={message}
											renderInMosaic={shouldUseMosaic}
											onDelete={onDelete}
										/>
									))}
								</>
							);
						})()}
					</div>
				)}

				{snapshot.embeds && snapshot.embeds.length > 0 && UserSettingsStore.getRenderEmbeds() && (
					<div className={styles.attachmentsContainer}>
						{snapshot.embeds.map((embed: MessageEmbed, index: number) => {
							const embedKey = `${embed.id}-${index}`;
							return (
								<Embed
									embed={embed}
									key={embedKey}
									message={message}
									embedIndex={index}
									contextualEmbeds={snapshot.embeds}
									onDelete={onDelete}
									isPreview={snapshotIsPreview}
								/>
							);
						})}
					</div>
				)}

				<ForwardedFromSource message={message} />
			</div>
		</div>
	);
});

export const MessageAttachments = observer(() => {
	const {message, handleDelete, previewContext, onPopoutToggle, readonlyPreview} = useMessageViewContext();
	const isPreview = Boolean(previewContext);
	const reactionsIsPreview = isPreview || Boolean(readonlyPreview);
	const {shouldAnimate, interactionHandlers} = useStickerAnimation();
	return (
		<>
			{message.messageSnapshots && message.messageSnapshots.length > 0 && (
				<ForwardedMessageContent message={message} snapshot={message.messageSnapshots[0]} onDelete={handleDelete} />
			)}

			{message.invites.map((code) => (
				<FocusRing key={code}>
					<InviteEmbed code={code} />
				</FocusRing>
			))}

			{message.themes.map((themeId) => (
				<FocusRing key={themeId}>
					<ThemeEmbed themeId={themeId} />
				</FocusRing>
			))}

			{message.gifts.map((code) => (
				<FocusRing key={code}>
					<GiftEmbed code={code} />
				</FocusRing>
			))}

			{message.stickers && message.stickers.length > 0 && (
				<div className={styles.stickersContainer}>
					{message.stickers.map((sticker: MessageStickerItem) => {
						const stickerUrl = AvatarUtils.getStickerURL({
							id: sticker.id,
							animated: shouldAnimate,
							size: 320,
						});

						const stickerRecord = StickerStore.getStickerById(sticker.id);
						const guild = stickerRecord?.guildId ? GuildStore.getGuild(stickerRecord.guildId) : null;

						const tooltipContent = () => (
							<div className={styles.stickerTooltip}>
								<span className={styles.stickerName}>{sticker.name}</span>
								{guild && (
									<div className={styles.stickerGuildInfo}>
										<GuildIcon
											id={guild.id}
											name={guild.name}
											icon={guild.icon}
											className={styles.stickerGuildIcon}
											sizePx={16}
										/>
										<span className={styles.stickerGuildName}>{guild.name}</span>
									</div>
								)}
							</div>
						);

						const handleContextMenu = (e: React.MouseEvent) => {
							e.preventDefault();
							e.stopPropagation();

							ContextMenuActionCreators.openFromEvent(e, ({onClose}) => (
								<MediaContextMenu
									message={message}
									originalSrc={stickerUrl}
									type="image"
									defaultName={sticker.name}
									onClose={onClose}
									onDelete={handleDelete}
								/>
							));
						};

						return (
							<Tooltip key={sticker.id} text={tooltipContent}>
								<FocusRing>
									<div
										role="img"
										className={styles.stickerWrapper}
										data-message-sticker="true"
										onContextMenu={handleContextMenu}
										{...interactionHandlers}
									>
										<img
											src={stickerUrl}
											alt={stickerRecord?.description || sticker.name}
											className={styles.stickerImage}
											width="160"
											height="160"
										/>
									</div>
								</FocusRing>
							</Tooltip>
						);
					})}
				</div>
			)}

			{(() => {
				const {enrichedAttachments, mediaAttachments} = getAttachmentRenderingState(message.attachments);
				const inlineMedia = UserSettingsStore.getInlineAttachmentMedia();
				const shouldWrapInMosaic = inlineMedia && mediaAttachments.length > 0;
				return (
					<>
						{shouldWrapInMosaic && (
							<AttachmentMosaic
								attachments={mediaAttachments}
								message={message}
								isPreview={isPreview}
								onDelete={handleDelete}
							/>
						)}
						{enrichedAttachments.map((attachment) => (
							<Attachment
								key={attachment.id}
								attachment={attachment}
								isPreview={isPreview}
								message={message}
								renderInMosaic={shouldWrapInMosaic}
								onDelete={handleDelete}
							/>
						))}
					</>
				);
			})()}

			{UserSettingsStore.getRenderEmbeds() &&
				!message.suppressEmbeds &&
				message.embeds.map((embed, index) => {
					const embedKey = `${embed.id}-${index}`;
					return (
						<Embed
							embed={embed}
							key={embedKey}
							message={message}
							embedIndex={index}
							onDelete={handleDelete}
							isPreview={isPreview}
						/>
					);
				})}

			{UserSettingsStore.getRenderReactions() && message.reactions.length > 0 && (
				<MessageReactions message={message} isPreview={reactionsIsPreview} onPopoutToggle={onPopoutToggle} />
			)}
		</>
	);
});
