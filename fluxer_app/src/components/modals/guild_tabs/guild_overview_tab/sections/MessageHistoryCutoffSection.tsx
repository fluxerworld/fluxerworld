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

import {SettingsSection} from '@app/components/modals/guild_tabs/guild_overview_tab/components/SettingsSection';
import {Button} from '@app/components/uikit/button/Button';
import type {FormInputs} from '@app/utils/modals/guild_tabs/GuildOverviewTabUtils';
import {openMessageHistoryThresholdSettings} from '@app/utils/modals/guild_tabs/GuildOverviewTabUtils';
import {Trans} from '@lingui/react/macro';
import type React from 'react';
import type {UseFormReturn} from 'react-hook-form';

export const MessageHistoryCutoffSection: React.FC<{
	form: UseFormReturn<FormInputs>;
	canManageGuild: boolean;
	guildId: string;
}> = ({form: _form, canManageGuild, guildId}) => {
	return (
		<SettingsSection
			title={<Trans>Change what users without Read Message History can see</Trans>}
			description={
				<Trans>
					Use a dedicated modal to set a message history threshold date for members who don't have Read Message History.
				</Trans>
			}
		>
			<Button
				variant="secondary"
				onClick={() => openMessageHistoryThresholdSettings(guildId)}
				disabled={!canManageGuild}
			>
				<Trans>Open Message History Threshold</Trans>
			</Button>
		</SettingsSection>
	);
};
