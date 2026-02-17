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
import {DisplayTabContent} from '@app/components/modals/tabs/chat_settings_tab/DisplayTab';
import styles from '@app/components/modals/tabs/chat_settings_tab/Inline.module.css';
import {InputTabContent} from '@app/components/modals/tabs/chat_settings_tab/InputTab';
import {InteractionTabContent} from '@app/components/modals/tabs/chat_settings_tab/InteractionTab';
import {MediaTabContent} from '@app/components/modals/tabs/chat_settings_tab/MediaTab';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

export const ChatSettingsInlineContent: React.FC = observer(() => {
	const {t} = useLingui();
	return (
		<div className={styles.container}>
			<SettingsSection id="display" title={t`Display`}>
				<DisplayTabContent />
			</SettingsSection>
			<SettingsSection id="media" title={t`Media`}>
				<MediaTabContent />
			</SettingsSection>
			<SettingsSection id="input" title={t`Input`}>
				<InputTabContent />
			</SettingsSection>
			<SettingsSection id="interaction" title={t`Interaction`}>
				<InteractionTabContent />
			</SettingsSection>
		</div>
	);
});
