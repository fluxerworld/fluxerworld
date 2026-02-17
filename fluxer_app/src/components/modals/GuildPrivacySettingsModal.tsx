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
import * as UserSettingsActionCreators from '@app/actions/UserSettingsActionCreators';
import {Switch} from '@app/components/form/Switch';
import styles from '@app/components/modals/GuildPrivacySettingsModal.module.css';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import GuildStore from '@app/stores/GuildStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';

export const GuildPrivacySettingsModal = observer(({guildId}: {guildId: string}) => {
	const {t} = useLingui();
	const guild = GuildStore.getGuild(guildId);
	const restrictedGuilds = UserSettingsStore.restrictedGuilds;
	const botRestrictedGuilds = UserSettingsStore.botRestrictedGuilds;

	if (!guild) return null;

	const isDMsAllowed = !restrictedGuilds.includes(guildId);
	const isBotDMsAllowed = !botRestrictedGuilds.includes(guildId);

	const handleToggleDMs = async (value: boolean) => {
		let newRestrictedGuilds: Array<string>;

		if (value) {
			newRestrictedGuilds = restrictedGuilds.filter((id) => id !== guildId);
		} else {
			newRestrictedGuilds = [...restrictedGuilds, guildId];
		}

		await UserSettingsActionCreators.update({
			restrictedGuilds: newRestrictedGuilds,
		});
	};

	const handleToggleBotDMs = async (value: boolean) => {
		let newRestrictedGuilds: Array<string>;

		if (value) {
			newRestrictedGuilds = botRestrictedGuilds.filter((id) => id !== guildId);
		} else {
			newRestrictedGuilds = [...botRestrictedGuilds, guildId];
		}

		await UserSettingsActionCreators.update({
			botRestrictedGuilds: newRestrictedGuilds,
		});
	};

	return (
		<Modal.Root size="small" centered>
			<Modal.Header title={t`Privacy Settings`} />
			<Modal.Content>
				<div className={styles.container}>
					<Switch
						label={t`Direct Messages`}
						description={t`Allow direct messages from other members in this community`}
						value={isDMsAllowed}
						onChange={handleToggleDMs}
					/>
					<Switch
						label={t`Bot Direct Messages`}
						description={t`Allow bots from this community to send you direct messages`}
						value={isBotDMsAllowed}
						onChange={handleToggleBotDMs}
					/>
				</div>
			</Modal.Content>
			<Modal.Footer>
				<Button onClick={() => ModalActionCreators.pop()}>{t`Done`}</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});
