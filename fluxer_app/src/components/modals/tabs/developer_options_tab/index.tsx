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
import {SettingsTabContainer, SettingsTabContent} from '@app/components/modals/shared/SettingsTabLayout';
import {AccountPremiumTabContent} from '@app/components/modals/tabs/developer_options_tab/AccountPremiumTab';
import {GeneralTabContent} from '@app/components/modals/tabs/developer_options_tab/GeneralTab';
import {MockingTabContent} from '@app/components/modals/tabs/developer_options_tab/MockingTab';
import {NagbarsTabContent} from '@app/components/modals/tabs/developer_options_tab/NagbarsTab';
import {ToolsTabContent} from '@app/components/modals/tabs/developer_options_tab/ToolsTab';
import {TypographyTabContent} from '@app/components/modals/tabs/developer_options_tab/TypographyTab';
import GatewayConnectionStore from '@app/stores/gateway/GatewayConnectionStore';
import NagbarStore from '@app/stores/NagbarStore';
import UserStore from '@app/stores/UserStore';
import {Trans} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

const DeveloperOptionsTab: React.FC = observer(() => {
	const socket = GatewayConnectionStore.socket;
	const nagbarState = NagbarStore;
	const user = UserStore.currentUser;

	if (!(user && socket)) return null;

	return (
		<SettingsTabContainer>
			<SettingsTabContent>
				<SettingsSection id="general" title={<Trans>General</Trans>}>
					<GeneralTabContent />
				</SettingsSection>

				<SettingsSection id="account_premium" title={<Trans>Account & Premium</Trans>}>
					<AccountPremiumTabContent user={user} />
				</SettingsSection>

				<SettingsSection id="mocking" title={<Trans>Mocking</Trans>}>
					<MockingTabContent />
				</SettingsSection>

				<SettingsSection id="nagbars" title={<Trans>Nagbars</Trans>}>
					<NagbarsTabContent nagbarState={nagbarState} />
				</SettingsSection>

				<SettingsSection id="tools" title={<Trans>Tools</Trans>}>
					<ToolsTabContent socket={socket} />
				</SettingsSection>

				<SettingsSection id="typography" title={<Trans>Typography</Trans>}>
					<TypographyTabContent />
				</SettingsSection>
			</SettingsTabContent>
		</SettingsTabContainer>
	);
});

export default DeveloperOptionsTab;
