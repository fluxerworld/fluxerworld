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

import {Message} from '@app/components/channel/Message';
import {
	SettingsTabContainer,
	SettingsTabContent,
	SettingsTabSection,
} from '@app/components/modals/shared/SettingsTabLayout';
import {SubsectionTitle} from '@app/components/modals/tabs/component_gallery_tab/ComponentGalleryTabSubsectionTitle';
import styles from '@app/components/modals/tabs/component_gallery_tab/MessagesTab.module.css';
import {ChannelRecord} from '@app/records/ChannelRecord';
import {GuildMemberRecord} from '@app/records/GuildMemberRecord';
import {MessageRecord} from '@app/records/MessageRecord';
import ChannelStore from '@app/stores/ChannelStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import {cdnUrl} from '@app/utils/UrlUtils';
import {ChannelTypes, MessageTypes} from '@fluxer/constants/src/ChannelConstants';
import {MS_PER_HOUR} from '@fluxer/date_utils/src/DateConstants';
import type {MessageEmbed} from '@fluxer/schema/src/domains/message/EmbedSchemas';
import type {
	MessageAttachment,
	Message as MessageType,
} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import type {UserPartial} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {Trans} from '@lingui/react/macro';
import type React from 'react';
import {useEffect, useMemo} from 'react';

const MOCK_GUILD_ID = '1000000000000000001';
const MOCK_CHANNEL_ID = '1000000000000000002';
const MOCK_TIMED_OUT_USER_ID = '1000000000000000003';

let mockIdCounter = 0;
const generateMockId = () => String(Date.now() * 1000 + mockIdCounter++);

const createMockUser = (overrides?: Partial<UserPartial>): UserPartial => ({
	id: overrides?.id ?? generateMockId(),
	username: overrides?.username ?? 'MockUser',
	discriminator: '0000',
	global_name: null,
	avatar: null,
	avatar_color: null,
	bot: overrides?.bot ?? false,
	system: overrides?.system ?? false,
	flags: 0,
});

const createMockChannel = (): ChannelRecord =>
	new ChannelRecord({
		id: MOCK_CHANNEL_ID,
		type: ChannelTypes.GUILD_TEXT,
		guild_id: MOCK_GUILD_ID,
		name: 'mock-channel',
	});

const createMockMessage = (overrides?: Partial<MessageType>): MessageRecord =>
	new MessageRecord(
		{
			id: overrides?.id ?? generateMockId(),
			channel_id: MOCK_CHANNEL_ID,
			guild_id: MOCK_GUILD_ID,
			author: overrides?.author ?? createMockUser(),
			type: overrides?.type ?? MessageTypes.DEFAULT,
			content: overrides?.content ?? 'Hello, world!',
			timestamp: overrides?.timestamp ?? new Date().toISOString(),
			embeds: overrides?.embeds ?? [],
			attachments: overrides?.attachments ?? [],
			flags: overrides?.flags ?? 0,
			pinned: overrides?.pinned ?? false,
			mention_everyone: overrides?.mention_everyone ?? false,
		},
		{skipUserCache: true},
	);

const ATTACHMENT_IMAGE_PATHS = [
	'avatars/0.png',
	'avatars/1.png',
	'avatars/2.png',
	'avatars/3.png',
	'avatars/4.png',
	'avatars/5.png',
	'web/android-chrome-192x192.png',
	'web/android-chrome-512x512.png',
	'web/apple-touch-icon.png',
	'web/og-image-default.png',
];

const createMockAttachments = (count: number): Array<MessageAttachment> =>
	Array.from({length: count}, (_, i) => {
		const assetPath = ATTACHMENT_IMAGE_PATHS[i % ATTACHMENT_IMAGE_PATHS.length];
		const url = cdnUrl(assetPath);
		return {
			id: generateMockId(),
			filename: `image-${i + 1}.png`,
			content_type: 'image/png',
			size: 1024,
			url,
			proxy_url: url,
			width: 400,
			height: 300,
			flags: 0,
		};
	});

const createMockRichEmbed = (): MessageEmbed => ({
	id: generateMockId(),
	type: 'rich',
	title: 'Example Rich Embed',
	description: 'This embed demonstrates fields, author, timestamp, and thumbnail.',
	color: 0x3b82f6,
	url: 'https://example.com',
	timestamp: new Date().toISOString(),
	author: {
		name: 'Embed Author',
		url: 'https://example.com',
	},
	fields: [
		{name: 'Field 1', value: 'Inline field', inline: true},
		{name: 'Field 2', value: 'Another inline field', inline: true},
		{
			name: 'Field 3',
			value: 'Full-width field showing longer content inside a single block.',
			inline: false,
		},
	],
	footer: {text: 'Footer text here'},
	thumbnail: {
		url: cdnUrl('avatars/2.png'),
		proxy_url: cdnUrl('avatars/2.png'),
		width: 80,
		height: 80,
		flags: 0,
	},
});

interface MessageDisplayProps {
	label: string;
	message: MessageRecord;
	channel: ChannelRecord;
	isCompact: boolean;
}

const MessageDisplay: React.FC<MessageDisplayProps> = ({label, message, channel, isCompact}) => (
	<div className={styles.messageWrapper}>
		<div className={styles.messageLabel}>{label}</div>
		<Message
			channel={channel}
			message={message}
			previewMode={true}
			behaviorOverrides={{
				messageDisplayCompact: isCompact,
				disableContextMenu: true,
				disableContextMenuTracking: true,
			}}
		/>
	</div>
);

export const MessagesTab: React.FC = () => {
	const mockChannel = useMemo(() => createMockChannel(), []);

	useEffect(() => {
		ChannelStore.handleChannelCreate({channel: mockChannel.toJSON()});

		const timedOutUser = createMockUser({id: MOCK_TIMED_OUT_USER_ID, username: 'TimedOutUser'});
		const timedOutMember = new GuildMemberRecord(MOCK_GUILD_ID, {
			user: timedOutUser,
			roles: [],
			joined_at: new Date().toISOString(),
			communication_disabled_until: new Date(Date.now() + MS_PER_HOUR).toISOString(),
		});

		GuildMemberStore.members[MOCK_GUILD_ID] = {
			...GuildMemberStore.members[MOCK_GUILD_ID],
			[timedOutMember.user.id]: timedOutMember,
		};

		return () => {
			ChannelStore.handleChannelDelete({channel: mockChannel.toJSON()});
			delete GuildMemberStore.members[MOCK_GUILD_ID];
		};
	}, [mockChannel]);

	const singleLineMessage = useMemo(() => createMockMessage({content: 'This is a single line message.'}), []);
	const multiLineMessage = useMemo(
		() =>
			createMockMessage({
				content:
					'This is a multi-line message.\nLine two demonstrates wrapping.\nLine three makes sure vertical spacing is visible.',
			}),
		[],
	);
	const markdownMessage = useMemo(
		() =>
			createMockMessage({
				content: '**Bold**, *italic*, `inline code`, ~~strikethrough~~, and ||spoiler||.',
			}),
		[],
	);
	const regularUserMessage = useMemo(
		() =>
			createMockMessage({
				author: createMockUser({username: 'RegularUser'}),
				content: 'Message from a regular user.',
			}),
		[],
	);
	const botUserMessage = useMemo(
		() =>
			createMockMessage({
				author: createMockUser({username: 'BotUser', bot: true}),
				content: 'Message from a bot user.',
			}),
		[],
	);
	const systemUserMessage = useMemo(
		() =>
			createMockMessage({
				author: createMockUser({username: 'SystemUser', bot: true, system: true}),
				content: 'Message from a system user.',
			}),
		[],
	);
	const timedOutUserMessage = useMemo(
		() =>
			createMockMessage({
				author: createMockUser({id: MOCK_TIMED_OUT_USER_ID, username: 'TimedOutUser'}),
				content: 'Message from a timed out user (clock icon should appear).',
			}),
		[],
	);
	const richEmbedMessage = useMemo(
		() =>
			createMockMessage({
				content: 'Message with a rich embed:',
				embeds: [createMockRichEmbed()],
			}),
		[],
	);
	const attachmentMessages = useMemo(
		() =>
			Array.from({length: 10}, (_, i) => ({
				count: i + 1,
				message: createMockMessage({
					content: '',
					attachments: createMockAttachments(i + 1),
				}),
			})),
		[],
	);

	return (
		<SettingsTabContainer>
			<SettingsTabContent>
				<SettingsTabSection
					title={<Trans>Display Modes</Trans>}
					description={<Trans>Cozy and compact text variations.</Trans>}
				>
					<div className={styles.displayModeRow}>
						<div className={styles.displayModeColumn}>
							<div className={styles.displayModeHeader}>
								<Trans>Cozy Mode</Trans>
							</div>
							<MessageDisplay label="Single line" message={singleLineMessage} channel={mockChannel} isCompact={false} />
							<MessageDisplay label="Multi-line" message={multiLineMessage} channel={mockChannel} isCompact={false} />
							<MessageDisplay label="Markdown" message={markdownMessage} channel={mockChannel} isCompact={false} />
						</div>
						<div className={styles.displayModeColumn}>
							<div className={styles.displayModeHeader}>
								<Trans>Compact Mode</Trans>
							</div>
							<MessageDisplay label="Single line" message={singleLineMessage} channel={mockChannel} isCompact={true} />
							<MessageDisplay label="Multi-line" message={multiLineMessage} channel={mockChannel} isCompact={true} />
							<MessageDisplay label="Markdown" message={markdownMessage} channel={mockChannel} isCompact={true} />
						</div>
					</div>
				</SettingsTabSection>

				<SettingsTabSection
					title={<Trans>Author Variations</Trans>}
					description={<Trans>Regular, bot, system, and timed out users rendered in cozy and compact modes.</Trans>}
				>
					<div className={styles.displayModeRow}>
						<div className={styles.displayModeColumn}>
							<div className={styles.displayModeHeader}>
								<Trans>Cozy Mode</Trans>
							</div>
							<MessageDisplay
								label="Regular user"
								message={regularUserMessage}
								channel={mockChannel}
								isCompact={false}
							/>
							<MessageDisplay label="Bot user" message={botUserMessage} channel={mockChannel} isCompact={false} />
							<MessageDisplay label="System user" message={systemUserMessage} channel={mockChannel} isCompact={false} />
							<MessageDisplay
								label="Timed out user"
								message={timedOutUserMessage}
								channel={mockChannel}
								isCompact={false}
							/>
						</div>
						<div className={styles.displayModeColumn}>
							<div className={styles.displayModeHeader}>
								<Trans>Compact Mode</Trans>
							</div>
							<MessageDisplay
								label="Regular user"
								message={regularUserMessage}
								channel={mockChannel}
								isCompact={true}
							/>
							<MessageDisplay label="Bot user" message={botUserMessage} channel={mockChannel} isCompact={true} />
							<MessageDisplay label="System user" message={systemUserMessage} channel={mockChannel} isCompact={true} />
							<MessageDisplay
								label="Timed out user"
								message={timedOutUserMessage}
								channel={mockChannel}
								isCompact={true}
							/>
						</div>
					</div>
				</SettingsTabSection>

				<SettingsTabSection
					title={<Trans>Embeds</Trans>}
					description={<Trans>Rich embeds with actual CDN thumbnails.</Trans>}
				>
					<div className={styles.messagesColumn}>
						<SubsectionTitle>
							<Trans>Rich Embed</Trans>
						</SubsectionTitle>
						<MessageDisplay
							label="With fields, author, footer"
							message={richEmbedMessage}
							channel={mockChannel}
							isCompact={false}
						/>
					</div>
				</SettingsTabSection>

				<SettingsTabSection
					title={<Trans>Attachment Mosaics</Trans>}
					description={<Trans>Layouts for 1-10 image attachments using CDN assets.</Trans>}
				>
					<div className={styles.mosaicGrid}>
						{attachmentMessages.map(({count, message}) => (
							<div key={count} className={styles.mosaicItem}>
								<div className={styles.mosaicLabel}>
									{count} {count === 1 ? 'image' : 'images'}
								</div>
								<div className={styles.messageWrapper}>
									<Message
										channel={mockChannel}
										message={message}
										previewMode={true}
										behaviorOverrides={{
											messageDisplayCompact: false,
											disableContextMenu: true,
											disableContextMenuTracking: true,
										}}
									/>
								</div>
							</div>
						))}
					</div>
				</SettingsTabSection>
			</SettingsTabContent>
		</SettingsTabContainer>
	);
};
