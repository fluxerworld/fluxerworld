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
import {Nagbar} from '@app/components/layout/Nagbar';
import {NagbarButton} from '@app/components/layout/NagbarButton';
import {NagbarContent} from '@app/components/layout/NagbarContent';
import {UserSettingsModal} from '@app/components/modals/UserSettingsModal';
import UserStore from '@app/stores/UserStore';
import {shouldShowPremiumFeatures} from '@app/utils/PremiumUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';

export const GiftInventoryNagbar = observer(({isMobile}: {isMobile: boolean}) => {
	const {t} = useLingui();
	const currentUser = UserStore.currentUser;
	const unreadCount = currentUser?.unreadGiftInventoryCount ?? 1;

	if (!shouldShowPremiumFeatures()) {
		return null;
	}

	const message =
		unreadCount === 1
			? t`You have a new gift code waiting in your Gift Inventory.`
			: t`You have ${unreadCount} new gift codes waiting in your Gift Inventory.`;

	const handleOpenGiftInventory = () => {
		ModalActionCreators.push(modal(() => <UserSettingsModal initialTab="gift_inventory" />));
	};

	return (
		<Nagbar isMobile={isMobile} backgroundColor="var(--brand-primary)" textColor="var(--text-on-brand-primary)">
			<NagbarContent
				isMobile={isMobile}
				message={message}
				actions={
					<NagbarButton isMobile={isMobile} onClick={handleOpenGiftInventory}>
						<Trans>View Gift Inventory</Trans>
					</NagbarButton>
				}
			/>
		</Nagbar>
	);
});
