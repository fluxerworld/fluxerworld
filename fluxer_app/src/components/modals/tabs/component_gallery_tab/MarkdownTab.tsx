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
	SettingsTabHeader,
} from '@app/components/modals/shared/SettingsTabLayout';
import appearanceStyles from '@app/components/modals/tabs/AppearanceTab.module.css';
import {SubsectionTitle} from '@app/components/modals/tabs/component_gallery_tab/ComponentGalleryTabSubsectionTitle';
import styles from '@app/components/modals/tabs/component_gallery_tab/MarkdownTab.module.css';
import {Scroller} from '@app/components/uikit/Scroller';
import {ChannelRecord} from '@app/records/ChannelRecord';
import {MessageRecord} from '@app/records/MessageRecord';
import ChannelStore from '@app/stores/ChannelStore';
import UserStore from '@app/stores/UserStore';
import {MessagePreviewContext, MessageStates, MessageTypes} from '@fluxer/constants/src/ChannelConstants';
import {Trans, useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useEffect, useMemo} from 'react';

export const MarkdownTab: React.FC = observer(() => {
	const {t} = useLingui();

	const {fakeChannel, createMessage, markdownSections} = useMemo(() => {
		const currentUser = UserStore.getCurrentUser();
		const author = currentUser?.toJSON() || {
			id: '1000000000000000010',
			username: 'MarkdownUser',
			discriminator: '0000',
			global_name: 'Markdown Preview User',
			avatar: null,
			avatar_color: null,
			bot: false,
			system: false,
			flags: 0,
		};

		const fakeChannel = new ChannelRecord({
			id: '1000000000000000011',
			type: 0,
			name: 'markdown-preview',
			position: 0,
			parent_id: null,
			topic: null,
			url: null,
			nsfw: false,
			last_message_id: null,
			last_pin_timestamp: null,
			bitrate: null,
			user_limit: null,
			permission_overwrites: [],
		});

		const tabOpenedAt = new Date();

		const markdownSections = [
			{
				title: t`Text Formatting`,
				items: [
					{label: '**bold**', content: '**bold text**'},
					{label: '*italic*', content: '*italic text*'},
					{label: '***bold italic***', content: '***bold italic***'},
					{label: '__underline__', content: '__underline text__'},
					{label: '~~strikethrough~~', content: '~~strikethrough text~~'},
					{label: '`code`', content: '`inline code`'},
					{label: '||spoiler||', content: '||spoiler text||'},
					{label: '\\*escaped\\*', content: '\\*escaped asterisks\\*'},
				],
			},
			{
				title: t`Headings`,
				items: [
					{label: '#', content: '# Heading 1'},
					{label: '##', content: '## Heading 2'},
					{label: '###', content: '### Heading 3'},
					{label: '####', content: '#### Heading 4'},
				],
			},
			{
				title: t`Links`,
				items: [
					{label: '[text](url)', content: '[Masked Link](https://fluxer.app)'},
					{label: '<url>', content: '<https://fluxer.app>'},
					{label: 'url', content: 'https://fluxer.app'},
					{label: '<email>', content: '<contact@fluxer.app>'},
				],
			},
			{
				title: t`Lists`,
				items: [
					{label: 'Unordered', content: '- First item\n- Second item\n- Third item'},
					{label: 'Ordered', content: '1. First item\n2. Second item\n3. Third item'},
					{
						label: 'Nested',
						content: '- Parent item\n  - Nested item\n  - Another nested\n- Another parent',
					},
				],
			},
			{
				title: t`Blockquotes`,
				items: [
					{label: 'Single line', content: '> Single line quote'},
					{label: 'Multi-line', content: '> Multi-line quote\n> Spans multiple lines\n> Continues here'},
					{
						label: 'Alternative',
						content: '>>> Multi-line quote\nContinues without > on each line\nUntil the message ends',
					},
				],
			},
			{
				title: t`Code Blocks`,
				items: [
					{label: 'Plain', content: '```\nfunction example() {\n  return "Hello";\n}\n```'},
					{
						label: 'JavaScript',
						// biome-ignore lint/suspicious/noTemplateCurlyInString: this is intended
						content: '```js\nfunction greet(name) {\n  console.log(`Hello, ${name}!`);\n}\n```',
					},
					{
						label: 'Python',
						content: '```py\ndef factorial(n):\n    return 1 if n <= 1 else n * factorial(n-1)\n```',
					},
				],
			},
			{
				title: t`Alerts / Callouts`,
				items: [
					{label: '[!NOTE]', content: '> [!NOTE]\n> Helpful information here'},
					{label: '[!TIP]', content: '> [!TIP]\n> Useful suggestion here'},
					{label: '[!IMPORTANT]', content: '> [!IMPORTANT]\n> Critical information here'},
					{label: '[!WARNING]', content: '> [!WARNING]\n> Exercise caution here'},
					{label: '[!CAUTION]', content: '> [!CAUTION]\n> Potential risks here'},
				],
			},
			{
				title: t`Special Features`,
				items: [
					{label: 'Subtext', content: '-# This is subtext that appears smaller and dimmed'},
					{label: 'Block Spoiler', content: '||\nBlock spoiler content\nClick to reveal!\n||'},
					{label: 'Unicode Emojis', content: '🎉 🚀 ❤️ 👍 😀'},
					{label: 'Shortcodes', content: ':tm: :copyright: :registered:'},
				],
			},
			{
				title: t`Mentions & Timestamps`,
				items: [
					{label: '@everyone', content: '@everyone'},
					{label: '@here', content: '@here'},
					{label: 'Short Time', content: '<t:1618936830:t>'},
					{label: 'Long Time', content: '<t:1618936830:T>'},
					{label: 'Short Date', content: '<t:1618936830:d>'},
					{label: 'Long Date', content: '<t:1618936830:D>'},
					{label: 'Default', content: '<t:1618936830:f>'},
					{label: 'Full', content: '<t:1618936830:F>'},
					{label: 'Short Date/Time', content: '<t:1618936830:s>'},
					{label: 'Relative', content: '<t:1618936830:R>'},
				],
			},
		];

		return {
			fakeChannel,
			createMessage: (content: string, index: string) => {
				return new MessageRecord(
					{
						id: `10000000000000001${index.replace('-', '')}`,
						channel_id: '1000000000000000011',
						author,
						type: MessageTypes.DEFAULT,
						flags: 0,
						pinned: false,
						mention_everyone: false,
						content,
						timestamp: tabOpenedAt.toISOString(),
						state: MessageStates.SENT,
					},
					{skipUserCache: true},
				);
			},
			markdownSections,
		};
	}, [t]);

	useEffect(() => {
		ChannelStore.handleChannelCreate({channel: fakeChannel.toJSON()});
		return () => {
			ChannelStore.handleChannelDelete({channel: fakeChannel.toJSON()});
		};
	}, [fakeChannel]);

	return (
		<SettingsTabContainer>
			<SettingsTabHeader
				title={<Trans>Markdown Preview</Trans>}
				description={<Trans>Each message below demonstrates a single markdown feature with live preview.</Trans>}
			/>
			<SettingsTabContent>
				<div className={styles.sectionsContainer}>
					{markdownSections.map((section, sectionIndex) => (
						<div key={sectionIndex} className={styles.section}>
							<div className={styles.sectionHeader}>
								<SubsectionTitle>{section.title}</SubsectionTitle>
							</div>
							{section.items.map((item, itemIndex) => {
								const message = createMessage(item.content, `${sectionIndex}-${itemIndex}`);
								return (
									<div key={itemIndex} className={styles.item}>
										<div className={styles.itemHeader}>
											<code className={styles.itemLabel}>{item.label}</code>
										</div>
										<div className={appearanceStyles.previewWrapper}>
											<div
												className={clsx(appearanceStyles.previewContainer, appearanceStyles.previewContainerCozy)}
												style={{
													height: 'auto',
													minHeight: '60px',
													maxHeight: '300px',
												}}
											>
												<Scroller
													key="markdown-preview-scroller"
													className={appearanceStyles.previewMessagesContainer}
													style={{
														height: 'auto',
														minHeight: '60px',
														maxHeight: '280px',
														pointerEvents: 'auto',
														paddingBottom: '16px',
													}}
												>
													<Message
														channel={fakeChannel}
														message={message}
														previewContext={MessagePreviewContext.SETTINGS}
														shouldGroup={false}
													/>
												</Scroller>
												<div className={appearanceStyles.previewOverlay} />
											</div>
										</div>
									</div>
								);
							})}
						</div>
					))}
				</div>
			</SettingsTabContent>
		</SettingsTabContainer>
	);
});
