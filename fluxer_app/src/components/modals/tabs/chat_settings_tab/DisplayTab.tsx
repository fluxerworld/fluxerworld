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

import * as UserSettingsActionCreators from '@app/actions/UserSettingsActionCreators';
import {Switch} from '@app/components/form/Switch';
import {SettingsTabSection} from '@app/components/modals/shared/SettingsTabLayout';
import styles from '@app/components/modals/tabs/chat_settings_tab/DisplayTab.module.css';
import type {RadioOption} from '@app/components/uikit/radio_group/RadioGroup';
import {RadioGroup} from '@app/components/uikit/radio_group/RadioGroup';
import {SwitchGroup, SwitchGroupItem} from '@app/components/uikit/SwitchGroup';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import {RenderSpoilers} from '@fluxer/constants/src/UserConstants';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

const spoilerOptions = (i18n: I18n): ReadonlyArray<RadioOption<number>> => [
	{
		value: RenderSpoilers.ON_CLICK,
		name: i18n._(msg`On click`),
		desc: i18n._(msg`Show spoiler content when clicked`),
	},
	{
		value: RenderSpoilers.IF_MODERATOR,
		name: i18n._(msg`In channels I moderate`),
		desc: i18n._(msg`Always show spoiler content in channels where you have the "Manage Messages" permission`),
	},
	{
		value: RenderSpoilers.ALWAYS,
		name: i18n._(msg`Always`),
		desc: i18n._(msg`Always show spoiler content`),
	},
];

export const DisplayTabContent: React.FC = observer(() => {
	const {t, i18n} = useLingui();
	const userSettings = UserSettingsStore;

	return (
		<>
			<SettingsTabSection
				title={t(msg`Media Display`)}
				description={t(
					msg`Control how images, videos and other media are shown. All media is resized and converted. Extremely large files that cannot be compressed into a preview will not embed regardless of these settings.`,
				)}
			>
				<div className={styles.sectionContent}>
					<SwitchGroup>
						<SwitchGroupItem
							label={t(msg`When posted as links to chat`)}
							value={userSettings.inlineEmbedMedia}
							onChange={(value) => UserSettingsActionCreators.update({inlineEmbedMedia: value})}
						/>
						<SwitchGroupItem
							label={t(msg`When uploaded directly to Fluxer`)}
							value={userSettings.inlineAttachmentMedia}
							onChange={(value) => UserSettingsActionCreators.update({inlineAttachmentMedia: value})}
						/>
					</SwitchGroup>
				</div>
			</SettingsTabSection>

			<SettingsTabSection
				title={t(msg`Link Previews`)}
				description={t(msg`Control how website links are previewed in chat`)}
			>
				<div className={styles.sectionContent}>
					<Switch
						label={t(msg`Show embeds and preview website links`)}
						value={userSettings.renderEmbeds}
						onChange={(value) => UserSettingsActionCreators.update({renderEmbeds: value})}
					/>
				</div>
			</SettingsTabSection>

			<SettingsTabSection title={t(msg`Reactions`)} description={t(msg`Configure emoji reactions on messages`)}>
				<div className={styles.sectionContent}>
					<Switch
						label={t(msg`Show emoji reactions on messages`)}
						value={userSettings.renderReactions}
						onChange={(value) => UserSettingsActionCreators.update({renderReactions: value})}
					/>
				</div>
			</SettingsTabSection>

			<SettingsTabSection
				title={t(msg`Spoiler Content`)}
				description={t(msg`Control how spoiler content is displayed`)}
			>
				<div className={styles.radioSection}>
					<div className={styles.radioLabelContainer}>
						<div className={styles.radioLabel}>
							<Trans>Show spoiler content</Trans>
						</div>
					</div>
					<RadioGroup
						options={spoilerOptions(i18n)}
						value={userSettings.renderSpoilers}
						onChange={(value) => UserSettingsActionCreators.update({renderSpoilers: value})}
						aria-label={t(msg`Show spoiler content`)}
					/>
				</div>
			</SettingsTabSection>
		</>
	);
});
