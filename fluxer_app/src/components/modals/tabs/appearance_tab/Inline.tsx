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

import {SettingsSection} from '@app/components/modals/shared/SettingsSection';
import {ChannelListTabContent} from '@app/components/modals/tabs/appearance_tab/ChannelListTab';
import styles from '@app/components/modals/tabs/appearance_tab/Inline.module.css';
import {InterfaceTabContent} from '@app/components/modals/tabs/appearance_tab/InterfaceTab';
import {MessagesTabContent} from '@app/components/modals/tabs/appearance_tab/MessagesTab';
import {ThemeTabContent} from '@app/components/modals/tabs/appearance_tab/ThemeTab';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

export const AppearanceInlineContent: React.FC = observer(() => {
	const {t} = useLingui();
	return (
		<div className={styles.container}>
			<SettingsSection id="theme" title={t`Theme`}>
				<ThemeTabContent />
			</SettingsSection>
			<SettingsSection id="messages" title={t`Messages`}>
				<MessagesTabContent />
			</SettingsSection>
			<SettingsSection id="interface" title={t`Interface`}>
				<InterfaceTabContent />
			</SettingsSection>
			<SettingsSection id="channel-list" title={t`Channel List`}>
				<ChannelListTabContent />
			</SettingsSection>
		</div>
	);
});
