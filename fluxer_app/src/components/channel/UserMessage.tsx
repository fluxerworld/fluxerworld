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

import * as MessageActionCreators from '@app/actions/MessageActionCreators';
import {EditingMessageInput} from '@app/components/channel/EditingMessageInput';
import {MessageAttachments} from '@app/components/channel/MessageAttachments';
import {MessageAuthorInfo} from '@app/components/channel/MessageAuthorInfo';
import {MessageAvatar} from '@app/components/channel/MessageAvatar';
import {MessageUsername} from '@app/components/channel/MessageUsername';
import {useMessageViewContext} from '@app/components/channel/MessageViewContext';
import {ReplyPreview} from '@app/components/channel/ReplyPreview';
import {TimestampWithTooltip} from '@app/components/channel/TimestampWithTooltip';
import {UserTag} from '@app/components/channel/UserTag';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import FocusManager from '@app/lib/FocusManager';
import {SafeMarkdown} from '@app/lib/markdown';
import {parse} from '@app/lib/markdown/renderers';
import {MarkdownContext} from '@app/lib/markdown/renderers/RendererTypes';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import EmojiStore from '@app/stores/EmojiStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildStore from '@app/stores/GuildStore';
import MessageEditStore from '@app/stores/MessageEditStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import UserStore from '@app/stores/UserStore';
import markupStyles from '@app/styles/Markup.module.css';
import styles from '@app/styles/Message.module.css';
import {createSystemMessage} from '@app/utils/CommandUtils';
import * as DateUtils from '@app/utils/DateUtils';
import {checkEmojiAvailability} from '@app/utils/ExpressionPermissionUtils';
import {SpoilerSyncProvider} from '@app/utils/SpoilerUtils';
import {FLUXERBOT_ID} from '@fluxer/constants/src/AppConstants';
import {MessageEmbedTypes, MessageFlags, MessageStates, MessageTypes} from '@fluxer/constants/src/ChannelConstants';
import {NodeType} from '@fluxer/markdown_parser/src/types/Enums';
import {Trans, useLingui} from '@lingui/react/macro';
import {BellSlashIcon, EyeIcon, WarningCircleIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {autorun} from 'mobx';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';

const MessageStateToClassName: Record<string, string> = {
	[MessageStates.SENT]: styles.messageSent,
	[MessageStates.SENDING]: styles.messageSending,
	[MessageStates.FAILED]: styles.messageFailed,
};
const CUSTOM_EMOJI_MARKDOWN_PATTERN = /<a?:[a-zA-Z0-9_+-]{2,}:([0-9]+)>/g;

export const UserMessage = observer(() => {
	const {t, i18n} = useLingui();
	const {
		message,
		channel,
		handleDelete,
		isHovering,
		shouldGroup,
		messageDisplayCompact,
		previewContext,
		previewOverrides,
	} = useMessageViewContext();
	const [animateEmoji, setAnimateEmoji] = useState(UserSettingsStore.getAnimateEmoji() && FocusManager.isFocused());
	const [value, setValue] = useState('');
	const hasInitializedEditingRef = useRef(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const isEditing = MessageEditStore.isEditing(message.channelId, message.id);
	const userAuthor = UserStore.getUser(message.author.id);
	const author = message.webhookId != null ? message.author : (userAuthor ?? message.author);
	const formattedDate = DateUtils.getRelativeDateString(message.timestamp, i18n);
	const showUserAvatarsInCompactMode = AccessibilityStore.showUserAvatarsInCompactMode;
	const {nodes: astNodes} = useMemo(
		() =>
			parse({
				content: message.content,
				context: MarkdownContext.STANDARD_WITH_JUMBO,
			}),
		[message.content],
	);

	const shouldHideContent =
		UserSettingsStore.getRenderEmbeds() &&
		message.embeds.length > 0 &&
		message.embeds.every((embed) => embed.type === MessageEmbedTypes.IMAGE || embed.type === MessageEmbedTypes.GIFV) &&
		astNodes.length === 1 &&
		astNodes[0].type === NodeType.Link &&
		!message.suppressEmbeds;

	const guild = GuildStore.getGuild(channel.guildId ?? '');
	const member = GuildMemberStore.getMember(guild?.id ?? '', author?.id ?? '');
	const shouldAppearAuthorless = false;

	const mobileLayout = MobileLayoutStore;
	const checkCustomEmojiAvailability = useCallback(
		(content: string): boolean => {
			CUSTOM_EMOJI_MARKDOWN_PATTERN.lastIndex = 0;

			let match: RegExpExecArray | null = null;
			while ((match = CUSTOM_EMOJI_MARKDOWN_PATTERN.exec(content))) {
				const emojiId = match[1];
				const emoji = EmojiStore.getEmojiById(emojiId);
				if (!emoji) {
					continue;
				}

				const availability = checkEmojiAvailability(i18n, emoji, channel);
				if (availability.canUse) {
					continue;
				}

				if (availability.lockReason) {
					const errorMessage = createSystemMessage(channel.id, availability.lockReason);
					MessageActionCreators.createOptimistic(channel.id, errorMessage.toJSON());
				}
				return true;
			}

			return false;
		},
		[channel, i18n],
	);

	const onSubmit = useCallback(
		(actualContent?: string) => {
			if (message.messageSnapshots) {
				return;
			}
			const content = (actualContent ?? value).trim();
			if (!content) {
				handleDelete();
				return;
			}

			if (checkCustomEmojiAvailability(content)) {
				return;
			}

			MessageActionCreators.edit(channel.id, message.id, content).then((result) => {
				if (result) {
					MessageEditStore.clearDraftContent(message.id);
					MessageActionCreators.stopEdit(channel.id);
				}
			});
		},
		[channel.id, handleDelete, message.id, value, message.messageSnapshots, checkCustomEmojiAvailability],
	);

	const cancelEditing = useCallback(() => {
		MessageActionCreators.stopEdit(message.channelId);
	}, [message.channelId]);

	const handleDismissSystemMessage = useCallback(() => {
		MessageActionCreators.deleteOptimistic(message.channelId, message.id);
	}, [message.channelId, message.id]);

	const shouldShowEditingInput = isEditing && !previewContext && !mobileLayout.enabled;

	const renderMessageContent = useCallback(() => {
		if (shouldShowEditingInput) {
			return (
				<EditingMessageInput
					channel={channel}
					onCancel={cancelEditing}
					onSubmit={onSubmit}
					textareaRef={textareaRef}
					value={value}
					setValue={setValue}
				/>
			);
		}

		if (shouldHideContent) return null;

		return (
			<div className={clsx(markupStyles.markup)} data-search-highlight-scope="message">
				<SafeMarkdown
					content={message.content}
					options={{
						context: MarkdownContext.STANDARD_WITH_JUMBO,
						messageId: message.id,
						channelId: message.channelId,
					}}
				/>
				{(message.editedTimestamp || message.isEditing) &&
					(message.isEditing ? (
						<span className={styles.editedLabel}> {t`(edited)`}</span>
					) : (
						<TimestampWithTooltip date={message.editedTimestamp!} className={styles.editedTimestamp}>
							<span className={styles.editedLabel}> {t`(edited)`}</span>
						</TimestampWithTooltip>
					))}
			</div>
		);
	}, [
		shouldShowEditingInput,
		shouldHideContent,
		message.content,
		message.id,
		message.channelId,
		message.editedTimestamp,
		message.isEditing,
		channel,
		cancelEditing,
		onSubmit,
		value,
		t,
	]);

	useLayoutEffect(() => {
		if (isEditing) {
			if (!hasInitializedEditingRef.current) {
				hasInitializedEditingRef.current = true;
				const persistedDraft =
					MessageEditStore.getEditingContent(channel.id, message.id) ?? MessageEditStore.getDraftContent(message.id);
				const initialValue = persistedDraft ?? message.content;
				setValue(initialValue);
				textareaRef.current?.focus();
				textareaRef.current?.setSelectionRange(initialValue.length, initialValue.length);
			} else {
				textareaRef.current?.focus();
			}
		} else {
			hasInitializedEditingRef.current = false;
			setValue('');
		}
	}, [channel.id, isEditing, message.content, message.id]);

	useEffect(() => {
		if (!isEditing) {
			return;
		}
		MessageEditStore.setEditingContent(channel.id, message.id, value);
	}, [channel.id, isEditing, message.id, value]);

	useEffect(() => {
		if (animateEmoji) return;
		const emojiImgs = document.querySelectorAll(
			`img[data-message-id="${message.id}"][data-animated="true"]`,
		) as NodeListOf<HTMLImageElement>;

		for (const img of emojiImgs) {
			const url = new URL(img.src, window.location.origin);
			url.searchParams.set('animated', isHovering.toString());
			img.src = url.toString();
		}
	}, [animateEmoji, isHovering, message.id]);

	useEffect(() => {
		const disposer = autorun(() => {
			const shouldAnimate = UserSettingsStore.animateEmoji && FocusManager.isFocused();
			setAnimateEmoji(shouldAnimate);

			const emojiImgs = document.querySelectorAll(
				`img[data-message-id="${message.id}"][data-animated="true"]`,
			) as NodeListOf<HTMLImageElement>;

			for (const img of emojiImgs) {
				const url = new URL(img.src, window.location.origin);
				url.searchParams.set('animated', shouldAnimate.toString());
				img.src = url.toString();
			}
		});

		return () => disposer();
	}, [message.id]);

	if (message.type === MessageTypes.CLIENT_SYSTEM && message.author.id === FLUXERBOT_ID) {
		return (
			<SpoilerSyncProvider>
				<div className={styles.messageContent}>
					<h3 className={styles.messageAuthorInfo}>
						<span className={styles.messageAuthorRow}>
							<span className={styles.messageAuthorPart}>
								<MessageUsername
									user={author}
									message={message}
									guild={guild}
									member={member ?? undefined}
									className={styles.messageUsername}
									isPreview={!!previewContext}
									previewColor={previewOverrides?.usernameColor}
									previewName={previewOverrides?.displayName}
								/>
								<UserTag className={styles.userTagOffset} system={author.system} />
							</span>
							<TimestampWithTooltip date={message.timestamp} className={styles.messageTimestamp}>
								<span className={styles.authorDashSeparator} aria-hidden="true">
									{' \u2014 '}
								</span>
								{formattedDate}
							</TimestampWithTooltip>
						</span>
					</h3>

					<div className={styles.messageText}>
						<div className={clsx(markupStyles.markup)} data-search-highlight-scope="message">
							<SafeMarkdown
								content={message.content}
								options={{
									context: MarkdownContext.STANDARD_WITH_JUMBO,
									messageId: message.id,
									channelId: message.channelId,
								}}
							/>
						</div>

						<div className={styles.systemMessageContainer}>
							<EyeIcon className={styles.systemMessageIcon} />
							<div>
								<Trans>
									only you can see this message.{' '}
									<button
										type="button"
										className={styles.systemMessageDismissButton}
										onClick={handleDismissSystemMessage}
										key="dismiss"
									>
										dismiss
									</button>
								</Trans>
							</div>
						</div>
					</div>
				</div>

				<div className={styles.messageGutterLeft} />

				<MessageAvatar
					user={author}
					message={message}
					guildId={guild?.id}
					size={40}
					className={styles.messageAvatar}
					isHovering={isHovering}
					isPreview={!!previewContext}
				/>

				<div className={styles.messageGutterRight} />

				<div className={styles.container}>
					<MessageAttachments />
				</div>
			</SpoilerSyncProvider>
		);
	}

	if (messageDisplayCompact) {
		return (
			<SpoilerSyncProvider>
				{message.messageReference && message.messageReference.type === 0 && (
					<ReplyPreview
						message={message}
						channelId={channel.id}
						animateEmoji={animateEmoji}
						messageDisplayCompact={messageDisplayCompact}
					/>
				)}

				<div className={styles.compactContentWrapper}>
					<MessageAuthorInfo
						message={message}
						author={author}
						guild={guild}
						member={member ?? undefined}
						shouldGroup={shouldGroup}
						shouldAppearAuthorless={shouldAppearAuthorless}
						messageDisplayCompact={messageDisplayCompact}
						showUserAvatarsInCompactMode={showUserAvatarsInCompactMode}
						mobileLayoutEnabled={mobileLayout.enabled}
						isHovering={isHovering}
						formattedDate={formattedDate}
						previewContext={previewContext}
						previewOverrides={previewOverrides}
					/>
					{!shouldHideContent && (
						<span className={clsx(styles.compactInlineContent, MessageStateToClassName[message.state])}>
							{isEditing && !previewContext && !mobileLayout.enabled ? (
								<EditingMessageInput
									channel={channel}
									onCancel={cancelEditing}
									onSubmit={onSubmit}
									textareaRef={textareaRef}
									value={value}
									setValue={setValue}
								/>
							) : (
								<span className={clsx(markupStyles.markup, 'inline')} data-search-highlight-scope="message">
									<SafeMarkdown
										content={message.content}
										options={{
											context: MarkdownContext.STANDARD_WITH_JUMBO,
											messageId: message.id,
											channelId: message.channelId,
										}}
									/>
									{(message.editedTimestamp || message.isEditing) &&
										(message.isEditing ? (
											<span className={styles.editedLabel}> {t`(edited)`}</span>
										) : (
											<TimestampWithTooltip date={message.editedTimestamp!} className={styles.editedTimestamp}>
												<span className={styles.editedLabel}> {t`(edited)`}</span>
											</TimestampWithTooltip>
										))}
								</span>
							)}
						</span>
					)}
				</div>

				<div className={styles.container}>
					<MessageAttachments />
				</div>

				{mobileLayout.enabled && message.state === MessageStates.FAILED && (
					<div className={styles.mobileFailedIndicator}>
						<WarningCircleIcon weight="fill" className={styles.mobileFailedIcon} />
						<span>{t`Failed to send message. Hold for options.`}</span>
					</div>
				)}
			</SpoilerSyncProvider>
		);
	}

	return (
		<SpoilerSyncProvider>
			{message.messageReference && message.messageReference.type === 0 && (
				<ReplyPreview
					message={message}
					channelId={channel.id}
					animateEmoji={animateEmoji}
					messageDisplayCompact={messageDisplayCompact}
				/>
			)}

			{(message.content || isEditing) && (!shouldHideContent || isEditing) && (
				<div className={styles.messageContent}>
					{!shouldGroup && (
						<h3 className={styles.messageAuthorInfo}>
							<span className={styles.messageAuthorRow}>
								<span className={styles.messageAuthorPart}>
									<MessageUsername
										user={author}
										message={message}
										guild={guild}
										member={member ?? undefined}
										className={styles.messageUsername}
										isPreview={!!previewContext}
										previewColor={previewOverrides?.usernameColor}
										previewName={previewOverrides?.displayName}
									/>
									{author.bot && <UserTag className={styles.userTagOffset} system={author.system} />}
								</span>
								<TimestampWithTooltip date={message.timestamp} className={styles.messageTimestamp}>
									<span className={styles.authorDashSeparator} aria-hidden="true">
										{' \u2014 '}
									</span>
									{formattedDate}
								</TimestampWithTooltip>
							</span>

							{(message.flags & MessageFlags.SUPPRESS_NOTIFICATIONS) !== 0 && (
								<Tooltip text={t`This was a @silent message.`}>
									<BellSlashIcon weight="fill" className={styles.silentMessageIcon} />
								</Tooltip>
							)}
						</h3>
					)}

					<div className={clsx(styles.messageText, MessageStateToClassName[message.state])}>
						{renderMessageContent()}
					</div>
				</div>
			)}

			{shouldGroup && (
				<MessageAuthorInfo
					message={message}
					author={author}
					guild={guild}
					member={member ?? undefined}
					shouldGroup={shouldGroup}
					shouldAppearAuthorless={shouldAppearAuthorless}
					messageDisplayCompact={messageDisplayCompact}
					showUserAvatarsInCompactMode={showUserAvatarsInCompactMode}
					mobileLayoutEnabled={mobileLayout.enabled}
					isHovering={isHovering}
					formattedDate={formattedDate}
					previewContext={previewContext}
					previewOverrides={previewOverrides}
				/>
			)}

			{!shouldGroup && (
				<>
					<div className={styles.messageGutterLeft} />
					<MessageAvatar
						user={author}
						message={message}
						guildId={guild?.id}
						size={40}
						className={styles.messageAvatar}
						isHovering={isHovering}
						isPreview={!!previewContext}
					/>
					<div className={styles.messageGutterRight} />
				</>
			)}

			<div className={styles.container}>
				{((!message.content && !isEditing) || (shouldHideContent && !isEditing)) && !shouldGroup && (
					<h3 className={styles.messageAuthorInfo}>
						<span className={styles.messageAuthorRow}>
							<span className={styles.messageAuthorPart}>
								<MessageUsername
									user={author}
									message={message}
									guild={guild}
									member={member ?? undefined}
									className={styles.messageUsername}
									isPreview={!!previewContext}
									previewColor={previewOverrides?.usernameColor}
									previewName={previewOverrides?.displayName}
								/>
								{author.bot && <UserTag className={styles.userTagOffset} system={author.system} />}
							</span>
							<TimestampWithTooltip date={message.timestamp} className={styles.messageTimestamp}>
								<span className={styles.authorDashSeparator} aria-hidden="true">
									{' \u2014 '}
								</span>
								{formattedDate}
							</TimestampWithTooltip>
						</span>

						{(message.flags & MessageFlags.SUPPRESS_NOTIFICATIONS) !== 0 && (
							<Tooltip text={t`This was a @silent message.`}>
								<BellSlashIcon weight="fill" className={styles.silentMessageIcon} />
							</Tooltip>
						)}
					</h3>
				)}

				<MessageAttachments />
			</div>

			{mobileLayout.enabled && message.state === MessageStates.FAILED && (
				<div className={styles.mobileFailedIndicator}>
					<WarningCircleIcon weight="fill" className={styles.mobileFailedIcon} />
					<span>{t`Failed to send message. Hold for options.`}</span>
				</div>
			)}
		</SpoilerSyncProvider>
	);
});
