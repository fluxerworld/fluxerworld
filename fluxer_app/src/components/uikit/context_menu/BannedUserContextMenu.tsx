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

import type {GuildBan} from '@app/actions/GuildActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import {BanDetailsModal} from '@app/components/modals/BanDetailsModal';
import {RevokeBanIcon, ViewDetailsIcon} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {Trans} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface BannedUserContextMenuProps {
	ban: GuildBan;
	onClose: () => void;
	onRevoke: () => void;
}

export const BannedUserContextMenu: React.FC<BannedUserContextMenuProps> = observer(({ban, onClose, onRevoke}) => {
	const handleViewDetails = () => {
		onClose();
		ModalActionCreators.push(modal(() => <BanDetailsModal ban={ban} onRevoke={onRevoke} />));
	};

	const handleRevokeBan = () => {
		onClose();
		onRevoke();
	};

	return (
		<>
			<MenuGroup>
				<MenuItem icon={<ViewDetailsIcon />} onClick={handleViewDetails}>
					<Trans>View Details</Trans>
				</MenuItem>
			</MenuGroup>
			<MenuGroup>
				<MenuItem icon={<RevokeBanIcon />} danger onClick={handleRevokeBan}>
					<Trans>Revoke Ban</Trans>
				</MenuItem>
			</MenuGroup>
		</>
	);
});
