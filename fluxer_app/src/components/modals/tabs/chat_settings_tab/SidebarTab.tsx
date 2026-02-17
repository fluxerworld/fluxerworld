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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import * as UserGuildSettingsActionCreators from '@app/actions/UserGuildSettingsActionCreators';
import * as UserSettingsActionCreators from '@app/actions/UserSettingsActionCreators';
import {Switch} from '@app/components/form/Switch';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import GuildStore from '@app/stores/GuildStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

export const SidebarTabContent: React.FC = observer(() => {
	const {t} = useLingui();
	const defaultHideMutedChannels = UserSettingsStore.getDefaultHideMutedChannels();

	const handleToggle = useCallback(
		(value: boolean) => {
			if (value) {
				ModalActionCreators.push(
					ModalActionCreators.modal(() => (
						<ConfirmModal
							title={t`Hide muted channels by default?`}
							description={
								<Trans>
									New communities you join will automatically have muted channels hidden. Would you also like to apply
									this setting to all your existing communities?
								</Trans>
							}
							primaryText={t`Apply to all communities`}
							secondaryText={t`New communities only`}
							onPrimary={async () => {
								await UserSettingsActionCreators.update({defaultHideMutedChannels: true});
								const guildIds = GuildStore.getGuildIds();
								for (const guildId of guildIds) {
									UserGuildSettingsActionCreators.updateGuildSettings(
										guildId,
										{hide_muted_channels: true},
										{persistImmediately: true},
									);
								}
							}}
							onSecondary={async () => {
								await UserSettingsActionCreators.update({defaultHideMutedChannels: true});
							}}
						/>
					)),
				);
			} else {
				ModalActionCreators.push(
					ModalActionCreators.modal(() => (
						<ConfirmModal
							title={t`Stop hiding muted channels by default?`}
							description={
								<Trans>
									New communities you join will no longer have muted channels hidden automatically. Would you also like
									to show muted channels in all your existing communities?
								</Trans>
							}
							primaryText={t`Show in all communities`}
							secondaryText={t`New communities only`}
							onPrimary={async () => {
								await UserSettingsActionCreators.update({defaultHideMutedChannels: false});
								const guildIds = GuildStore.getGuildIds();
								for (const guildId of guildIds) {
									UserGuildSettingsActionCreators.updateGuildSettings(
										guildId,
										{hide_muted_channels: false},
										{persistImmediately: true},
									);
								}
							}}
							onSecondary={async () => {
								await UserSettingsActionCreators.update({defaultHideMutedChannels: false});
							}}
						/>
					)),
				);
			}
		},
		[t],
	);

	return (
		<Switch
			label={t`Hide muted channels by default`}
			description={t`Automatically hide muted channels in the sidebar when you join new communities`}
			value={defaultHideMutedChannels}
			onChange={handleToggle}
		/>
	);
});
