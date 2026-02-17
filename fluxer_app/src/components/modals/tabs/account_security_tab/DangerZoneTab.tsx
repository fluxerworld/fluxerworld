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
import {modal} from '@app/actions/ModalActionCreators';
import {AccountDeleteModal} from '@app/components/modals/AccountDeleteModal';
import {AccountDisableModal} from '@app/components/modals/AccountDisableModal';
import {GuildOwnershipWarningModal} from '@app/components/modals/GuildOwnershipWarningModal';
import {SettingsTabSection} from '@app/components/modals/shared/SettingsTabLayout';
import styles from '@app/components/modals/tabs/account_security_tab/AccountTab.module.css';
import {Button} from '@app/components/uikit/button/Button';
import type {UserRecord} from '@app/records/UserRecord';
import GuildStore from '@app/stores/GuildStore';
import {Trans} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface DangerZoneTabProps {
	user: UserRecord;
	isClaimed: boolean;
}

export const DangerZoneTabContent: React.FC<DangerZoneTabProps> = observer(({user, isClaimed}) => {
	const handleDisableAccount = () => {
		ModalActionCreators.push(modal(() => <AccountDisableModal />));
	};

	const handleDeleteAccount = () => {
		const ownedGuilds = GuildStore.getOwnedGuilds(user.id);
		if (ownedGuilds.length > 0) {
			ModalActionCreators.push(modal(() => <GuildOwnershipWarningModal ownedGuilds={ownedGuilds} />));
		} else {
			ModalActionCreators.push(modal(() => <AccountDeleteModal />));
		}
	};

	return (
		<>
			{isClaimed && (
				<SettingsTabSection
					title={<Trans>Disable Account</Trans>}
					description={<Trans>Temporarily disable your account. You can reactivate it later by signing back in.</Trans>}
				>
					<Button variant="danger-secondary" className={styles.claimButton} small={true} onClick={handleDisableAccount}>
						<Trans>Disable Account</Trans>
					</Button>
				</SettingsTabSection>
			)}

			<SettingsTabSection
				title={<Trans>Delete Account</Trans>}
				description={
					<Trans>Permanently delete your account and all associated data. This action cannot be undone.</Trans>
				}
			>
				<Button variant="danger-primary" className={styles.claimButton} small={true} onClick={handleDeleteAccount}>
					<Trans>Delete Account</Trans>
				</Button>
			</SettingsTabSection>
		</>
	);
});
