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

import * as AccessibilityActionCreators from '@app/actions/AccessibilityActionCreators';
import {Message} from '@app/components/channel/Message';
import {SettingsTabSection} from '@app/components/modals/shared/SettingsTabLayout';
import styles from '@app/components/modals/tabs/chat_settings_tab/InteractionTab.module.css';
import {KeyboardKey} from '@app/components/uikit/KeyboardKey';
import {SwitchGroup, SwitchGroupItem} from '@app/components/uikit/SwitchGroup';
import {ChannelRecord} from '@app/records/ChannelRecord';
import {MessageRecord} from '@app/records/MessageRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import ChannelStore from '@app/stores/ChannelStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import UserStore from '@app/stores/UserStore';
import {SHIFT_KEY_SYMBOL} from '@app/utils/KeyboardUtils';
import {MessageStates, MessageTypes} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useEffect, useMemo} from 'react';

const MessageActionBarPreview = observer(
	({
		showActionBar,
		showShiftExpand,
		onlyMoreButton,
	}: {
		showActionBar: boolean;
		showQuickReactions: boolean;
		showShiftExpand: boolean;
		onlyMoreButton: boolean;
	}) => {
		const {t} = useLingui();
		const fakeData = useMemo(() => {
			const currentUser = UserStore.getCurrentUser();
			const author = currentUser?.toJSON() || {
				id: '1000000000000000010',
				username: 'PreviewUser',
				discriminator: '0000',
				global_name: 'Preview User',
				avatar: null,
				avatar_color: null,
				bot: false,
				system: false,
				flags: 0,
			};

			const fakeChannel = new ChannelRecord({
				id: '1000000000000000020',
				type: 0,
				name: 'action-bar-fake-channel',
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

			const fakeMessage = new MessageRecord(
				{
					id: '1000000000000000030',
					channel_id: '1000000000000000020',
					author,
					type: MessageTypes.DEFAULT,
					flags: 0,
					pinned: false,
					mention_everyone: false,
					content: showActionBar ? t`This message shows the action bar` : t`This message doesn't show the action bar`,
					timestamp: new Date().toISOString(),
					state: MessageStates.SENT,
				},
				{skipUserCache: true},
			);

			return {fakeChannel, fakeMessage};
		}, [showActionBar]);

		useEffect(() => {
			ChannelStore.handleChannelCreate({channel: fakeData.fakeChannel.toJSON()});
			return () => {
				ChannelStore.handleChannelDelete({channel: fakeData.fakeChannel.toJSON()});
			};
		}, [fakeData.fakeChannel]);

		return (
			<div className={styles.previewContainer}>
				<div
					className={styles.previewBox}
					data-force-show-action-bar={showActionBar ? 'true' : 'false'}
					style={{
						pointerEvents: 'none',
					}}
				>
					{showActionBar && (
						<style>
							{`
							[data-force-show-action-bar="true"] [class*="buttons"] {
								opacity: 1 !important;
								pointer-events: none !important;
							}
							[data-force-show-action-bar="true"] [class*="hoverAction"] {
								opacity: 1 !important;
								pointer-events: none !important;
							}
						`}
						</style>
					)}
					<Message
						channel={fakeData.fakeChannel}
						message={fakeData.fakeMessage}
						removeTopSpacing={true}
						previewMode={true}
					/>
				</div>
				<div
					className={`${styles.shiftHint} ${!showActionBar || onlyMoreButton || !showShiftExpand ? styles.shiftHintDisabled : ''}`}
				>
					<span className={styles.shiftHintText}>{t`Hold`}</span>
					<KeyboardKey>{SHIFT_KEY_SYMBOL}</KeyboardKey>
					<span className={styles.shiftHintText}>{t`to expand action bar`}</span>
				</div>
			</div>
		);
	},
);

export const InteractionTabContent: React.FC = observer(() => {
	const {t} = useLingui();
	const mobileLayout = MobileLayoutStore;

	const {
		showMessageActionBar,
		showMessageActionBarQuickReactions,
		showMessageActionBarShiftExpand,
		showMessageActionBarOnlyMoreButton,
	} = AccessibilityStore;

	if (mobileLayout.enabled) {
		return (
			<SettingsTabSection
				title={t`Message Action Bar`}
				description={t`Message action bar settings are only available on desktop.`}
			>
				{null}
			</SettingsTabSection>
		);
	}

	return (
		<SettingsTabSection
			title={t`Message Action Bar`}
			description={t`Customize the action bar that appears when hovering over messages.`}
		>
			<div className={styles.sectionContent}>
				<MessageActionBarPreview
					showActionBar={showMessageActionBar}
					showQuickReactions={showMessageActionBarQuickReactions}
					showShiftExpand={showMessageActionBarShiftExpand}
					onlyMoreButton={showMessageActionBarOnlyMoreButton}
				/>
				<SwitchGroup>
					<SwitchGroupItem
						label={t`Show message action bar`}
						value={showMessageActionBar}
						onChange={(value) => AccessibilityActionCreators.update({showMessageActionBar: value})}
					/>
					<SwitchGroupItem
						label={t`Show only more button`}
						value={showMessageActionBarOnlyMoreButton}
						onChange={(value) => AccessibilityActionCreators.update({showMessageActionBarOnlyMoreButton: value})}
						disabled={!showMessageActionBar}
					/>
					<SwitchGroupItem
						label={t`Show Quick Reactions`}
						value={showMessageActionBarQuickReactions}
						onChange={(value) => AccessibilityActionCreators.update({showMessageActionBarQuickReactions: value})}
						disabled={!showMessageActionBar || showMessageActionBarOnlyMoreButton}
					/>
					<SwitchGroupItem
						label={t`Enable Shift to Expand`}
						value={showMessageActionBarShiftExpand}
						onChange={(value) => AccessibilityActionCreators.update({showMessageActionBarShiftExpand: value})}
						disabled={!showMessageActionBar || showMessageActionBarOnlyMoreButton}
					/>
				</SwitchGroup>
			</div>
		</SettingsTabSection>
	);
});
