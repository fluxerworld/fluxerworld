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
import {AccountPremiumTabContent} from '@app/components/modals/tabs/developer_options_tab/AccountPremiumTab';
import {GeneralTabContent} from '@app/components/modals/tabs/developer_options_tab/GeneralTab';
import styles from '@app/components/modals/tabs/developer_options_tab/Inline.module.css';
import {MockingTabContent} from '@app/components/modals/tabs/developer_options_tab/MockingTab';
import {NagbarsTabContent} from '@app/components/modals/tabs/developer_options_tab/NagbarsTab';
import {ToolsTabContent} from '@app/components/modals/tabs/developer_options_tab/ToolsTab';
import {TypographyTabContent} from '@app/components/modals/tabs/developer_options_tab/TypographyTab';
import GatewayConnectionStore from '@app/stores/gateway/GatewayConnectionStore';
import NagbarStore from '@app/stores/NagbarStore';
import UserStore from '@app/stores/UserStore';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

export const DeveloperOptionsInlineContent: React.FC = observer(() => {
	const {t} = useLingui();
	const socket = GatewayConnectionStore.socket;
	const nagbarState = NagbarStore;
	const user = UserStore.currentUser;

	if (!(user && socket)) return null;

	return (
		<div className={styles.container}>
			<SettingsSection id="general" title={t`General`}>
				<GeneralTabContent />
			</SettingsSection>
			<SettingsSection id="account_premium" title={t`Account & Premium`}>
				<AccountPremiumTabContent user={user} />
			</SettingsSection>
			<SettingsSection id="mocking" title={t`Mocking`}>
				<MockingTabContent />
			</SettingsSection>
			<SettingsSection id="nagbars" title={t`Nagbars`}>
				<NagbarsTabContent nagbarState={nagbarState} />
			</SettingsSection>
			<SettingsSection id="tools" title={t`Tools`}>
				<ToolsTabContent socket={socket} />
			</SettingsSection>
			<SettingsSection id="typography" title={t`Typography`}>
				<TypographyTabContent />
			</SettingsSection>
		</div>
	);
});
