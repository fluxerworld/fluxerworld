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
import {ActiveNowTabContent} from '@app/components/modals/tabs/appearance_tab/ActiveNowTab';
import {ChannelListTabContent} from '@app/components/modals/tabs/appearance_tab/ChannelListTab';
import {FavoritesTabContent} from '@app/components/modals/tabs/appearance_tab/FavoritesTab';
import {HdrTabContent, shouldShowHdrSettings} from '@app/components/modals/tabs/appearance_tab/HdrTab';
import {InterfaceTabContent} from '@app/components/modals/tabs/appearance_tab/InterfaceTab';
import {AppearanceTabPreview, MessagesTabContent} from '@app/components/modals/tabs/appearance_tab/MessagesTab';
import {
	AppZoomLevelTabContent,
	FontSizeTabContent,
	useAppZoomLevelDescription,
} from '@app/components/modals/tabs/appearance_tab/ScalingTab';
import {ThemeTabContent} from '@app/components/modals/tabs/appearance_tab/ThemeTab';
import {shouldShowAppZoomLevel} from '@app/components/modals/utils/AppZoomLevelUtils';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

export const AppearanceTab: React.FC = observer(() => {
	const {t} = useLingui();
	const showZoomLevel = shouldShowAppZoomLevel();
	const showHdrSettings = shouldShowHdrSettings();
	const appZoomLevelDescription = useAppZoomLevelDescription();

	return (
		<SettingsTabContainer>
			{!MobileLayoutStore.enabled && <AppearanceTabPreview />}
			<SettingsTabContent>
				<SettingsSection
					id="theme"
					title={t`Theme`}
					description={t`Choose between dark, coal, or light appearance. You can still add custom CSS overrides below for limitless control.`}
				>
					<ThemeTabContent />
				</SettingsSection>

				{showHdrSettings ? (
					<SettingsSection
						id="hdr"
						title={t`High Dynamic Range`}
						description={t`Control how HDR images are displayed on HDR-capable monitors.`}
					>
						<HdrTabContent />
					</SettingsSection>
				) : null}

				<SettingsSection
					id="chat-font-scaling"
					title={t`Chat Font Scaling`}
					description={t`Adjust the font size in the chat area.`}
				>
					<FontSizeTabContent />
				</SettingsSection>

				{showZoomLevel ? (
					<SettingsSection id="app-zoom-level" title={t`App Zoom Level`} description={appZoomLevelDescription}>
						<AppZoomLevelTabContent />
					</SettingsSection>
				) : null}

				<SettingsSection
					id="messages"
					title={t`Messages`}
					description={t`Choose how messages are displayed in chat channels.`}
				>
					<MessagesTabContent />
				</SettingsSection>

				<SettingsSection
					id="interface"
					title={t`Interface`}
					description={t`Customize interface elements and behaviors.`}
				>
					<InterfaceTabContent />
				</SettingsSection>

				<SettingsSection
					id="channel-list"
					title={t`Channel List`}
					description={t`Control unread indicator behavior for muted channels in channel lists.`}
				>
					<ChannelListTabContent />
				</SettingsSection>

				<SettingsSection
					id="active-now"
					title={t`Active Now`}
					description={t`Control how Active Now surfaces across the app.`}
				>
					<ActiveNowTabContent />
				</SettingsSection>

				<SettingsSection
					id="favorites"
					title={t`Favorites`}
					description={t`Control the visibility of favorites throughout the app.`}
				>
					<FavoritesTabContent />
				</SettingsSection>
			</SettingsTabContent>
		</SettingsTabContainer>
	);
});
