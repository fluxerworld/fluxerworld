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
import {Typing} from '@app/components/channel/Typing';
import {Switch} from '@app/components/form/Switch';
import {ChannelItemCore} from '@app/components/layout/ChannelItem';
import channelItemSurfaceStyles from '@app/components/layout/ChannelItemSurface.module.css';
import {SettingsTabSection} from '@app/components/modals/shared/SettingsTabLayout';
import styles from '@app/components/modals/tabs/appearance_tab/InterfaceTab.module.css';
import {AvatarStack} from '@app/components/uikit/avatars/AvatarStack';
import {MockAvatar} from '@app/components/uikit/MockAvatar';
import type {RadioOption} from '@app/components/uikit/radio_group/RadioGroup';
import {RadioGroup} from '@app/components/uikit/radio_group/RadioGroup';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import AccessibilityStore, {ChannelTypingIndicatorMode} from '@app/stores/AccessibilityStore';
import {cdnUrl} from '@app/utils/UrlUtils';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';

const ChannelListPreview = observer(({mode}: {mode: ChannelTypingIndicatorMode}) => {
	const typingIndicator =
		mode !== ChannelTypingIndicatorMode.HIDDEN ? (
			<Tooltip
				text={() => (
					<span className={styles.tooltipContent}>
						<strong>Kenji</strong>, <strong>Amara</strong> and <strong>Mateo</strong> are typing...
					</span>
				)}
			>
				<div className={styles.typingContainer}>
					<Typing className={styles.typingAnimationWrapper} color="var(--surface-interactive-selected-color)" />
					{mode === ChannelTypingIndicatorMode.AVATARS && (
						<AvatarStack size={12} maxVisible={5} className={styles.typingAvatars}>
							{[1, 2, 3].map((index) => (
								<MockAvatar
									key={index}
									size={12}
									userTag={`User ${index}`}
									avatarUrl={cdnUrl(`avatars/${index}.png`)}
								/>
							))}
						</AvatarStack>
					)}
				</div>
			</Tooltip>
		) : undefined;

	return (
		<div className={styles.previewContainer}>
			<div className={styles.previewContent}>
				<ChannelItemCore
					channel={{name: 'general', type: 0}}
					isSelected={true}
					typingIndicator={typingIndicator}
					className={clsx(
						'cursor-default',
						channelItemSurfaceStyles.channelItemSurface,
						channelItemSurfaceStyles.channelItemSurfaceSelected,
					)}
				/>
			</div>
		</div>
	);
});

export const InterfaceTabContent: React.FC = observer(() => {
	const {t} = useLingui();
	const channelTypingIndicatorOptions: ReadonlyArray<RadioOption<ChannelTypingIndicatorMode>> = [
		{
			value: ChannelTypingIndicatorMode.AVATARS,
			name: t`Typing Indicator + Avatars`,
			desc: t`Show typing indicator with user avatars in the channel list`,
		},
		{
			value: ChannelTypingIndicatorMode.INDICATOR_ONLY,
			name: t`Typing Indicator Only`,
			desc: t`Show just the typing indicator without avatars`,
		},
		{
			value: ChannelTypingIndicatorMode.HIDDEN,
			name: t`Hidden`,
			desc: t`Don't show typing indicators in the channel list`,
		},
	];

	return (
		<>
			<SettingsTabSection
				title={t`Channel list typing indicators`}
				description={t`Choose how typing indicators appear in the channel list when someone is typing in a channel.`}
			>
				<ChannelListPreview mode={AccessibilityStore.channelTypingIndicatorMode} />
				<RadioGroup
					options={channelTypingIndicatorOptions}
					value={AccessibilityStore.channelTypingIndicatorMode}
					onChange={(value) => AccessibilityActionCreators.update({channelTypingIndicatorMode: value})}
					aria-label={t`Channel list typing indicator mode`}
				/>
				<div className={styles.switchWrapper}>
					<Switch
						label={t`Show typing on selected channel`}
						description={t`When disabled (default), typing indicators won't appear on the channel you're currently viewing.`}
						value={AccessibilityStore.showSelectedChannelTypingIndicator}
						onChange={(value) => AccessibilityActionCreators.update({showSelectedChannelTypingIndicator: value})}
					/>
				</div>
			</SettingsTabSection>

			<SettingsTabSection
				title={t`Keyboard Hints`}
				description={t`Control whether keyboard shortcut hints appear inside tooltips.`}
			>
				<div className={styles.switchWrapper}>
					<Switch
						label={t`Hide keyboard hints in tooltips`}
						description={t`When enabled, shortcut badges are hidden in tooltip popups.`}
						value={AccessibilityStore.hideKeyboardHints}
						onChange={(value) => AccessibilityActionCreators.update({hideKeyboardHints: value})}
					/>
				</div>
			</SettingsTabSection>

			<SettingsTabSection
				title={t`Voice channel join behavior`}
				description={t`Control how you join voice channels in communities.`}
			>
				<Switch
					label={t`Require double-click to join voice channels`}
					description={t`When enabled, you'll need to double-click on voice channels to join them. When disabled (default), single-clicking will join the channel immediately.`}
					value={AccessibilityStore.voiceChannelJoinRequiresDoubleClick}
					onChange={(value) =>
						AccessibilityActionCreators.update({
							voiceChannelJoinRequiresDoubleClick: value,
						})
					}
				/>
			</SettingsTabSection>
		</>
	);
});
